// Utility for presigned direct uploads to R2
// Import default axios instance
import api from './api';

function createUploadError(message, extras = {}) {
  const error = new Error(message);
  error.name = 'UploadError';
  error.isUploadError = true;
  Object.assign(error, extras);
  return error;
}

function normalizeUploadError(error, fallbackMessage, extras = {}) {
  if (error?.isUploadError) {
    return Object.assign(error, extras);
  }

  const responseData = error?.response?.data;
  const responseHeaders = error?.response?.headers || {};
  const rawMessage =
    responseData?.message ||
    responseData?.error ||
    error?.message ||
    fallbackMessage;

  return createUploadError(rawMessage || fallbackMessage, {
    rawMessage,
    status: error?.response?.status ?? error?.status ?? null,
    code: responseData?.code || error?.code || null,
    requestId:
      error?.request_id ||
      responseData?.request_id ||
      responseHeaders['x-request-id'] ||
      null,
    details: responseData?.details || responseData?.errors || null,
    cause: error,
    ...extras,
  });
}

/**
 * Presign a file for direct PUT upload.
 * @param {File} file
 * @param {Object} options { directory, entityType, entityId, sha256 }
 * @returns {Promise<object>} presign data
 */
export async function presignFile(
  file,
  { directory = 'activities', entityType = 'carbon_record', entityId = null, sha256, expiresIn = 600 } = {}
) {
  try {
    const body = {
      original_name: file.name,
      directory,
      mime_type: file.type || 'application/octet-stream',
      file_size: file.size,
      entity_type: entityType,
      entity_id: entityId,
      sha256,
      expires_in: expiresIn
    };
    const res = await api.post('/files/presign', body);
    if (!res.data?.success) {
      throw createUploadError(res.data?.message || 'Presign failed', {
        status: res.status,
        step: 'presign',
        fileName: file.name,
        code: res.data?.code || null,
        requestId: res.data?.request_id || res.headers?.['x-request-id'] || null,
      });
    }
    return res.data.data;
  } catch (error) {
    throw normalizeUploadError(error, 'Failed to prepare upload', {
      step: 'presign',
      fileName: file.name,
    });
  }
}

/**
 * Direct PUT upload to R2 using presigned URL.
 * @param {File} file
 * @param {object} presign { url, headers }
 */
export async function putFile(file, presign) {
  try {
    const headers = new Headers(presign.headers || {});
    if (!headers.has('Content-Type') && file.type) headers.set('Content-Type', file.type);
    const resp = await fetch(presign.url, { method: 'PUT', body: file, headers });
    if (!resp.ok) {
      let responseText = '';
      try {
        responseText = await resp.text();
      } catch {
        responseText = '';
      }

      throw createUploadError(`Storage upload failed (${resp.status})`, {
        step: 'put',
        fileName: file.name,
        status: resp.status,
        rawMessage: responseText || resp.statusText || 'PUT upload failed',
      });
    }
    return true;
  } catch (error) {
    throw normalizeUploadError(error, 'Storage upload failed', {
      step: 'put',
      fileName: file.name,
    });
  }
}

/**
 * Confirm upload so backend can record metadata (if required)
 * @param {object} meta { file_path, original_name, entity_type, entity_id }
 */
export async function confirmUpload(meta) {
  try {
    const res = await api.post('/files/confirm', meta);
    if (!res.data?.success) {
      throw createUploadError(res.data?.message || 'Confirm failed', {
        status: res.status,
        step: 'confirm',
        fileName: meta?.original_name || null,
        code: res.data?.code || null,
        requestId: res.data?.request_id || res.headers?.['x-request-id'] || null,
      });
    }
    return res.data.data;
  } catch (error) {
    throw normalizeUploadError(error, 'Failed to confirm upload', {
      step: 'confirm',
      fileName: meta?.original_name || null,
    });
  }
}

/**
 * Full pipeline: presign -> PUT -> confirm (skip confirm if duplicate or no confirm flag)
 * Returns normalized image object with url + meta
 */
export async function uploadViaPresign(file, opts = {}) {
  try {
    const presign = await presignFile(file, opts);
    const buildResult = (extra = {}) => {
      const result = {
        url: presign.public_url || null,
        file_path: presign.file_path,
        thumbnail_path: presign.thumbnail_path || null,
        presigned_url: presign.presigned_url || null,
        original_name: file.name,
        mime_type: file.type,
        size: file.size,
        ...extra,
      };
      result.duplicate = Boolean(extra.duplicate ?? result.duplicate ?? false);
      if (extra.file_path) result.file_path = extra.file_path;
      if (extra.thumbnail_path) result.thumbnail_path = extra.thumbnail_path;
      if (extra.url) result.url = extra.url;
      if (extra.presigned_url) result.presigned_url = extra.presigned_url;
      return result;
    };

    const confirmPayload = {
      file_path: presign.file_path,
      original_name: file.name,
      entity_type: opts.entityType || 'carbon_record',
      entity_id: opts.entityId || null,
    };

    if (presign.duplicate) {
      let confirmedMeta = null;
      if (presign.confirm_required) {
        try {
          confirmedMeta = await confirmUpload(confirmPayload);
        } catch (e) {
          console.warn('Confirm upload failed for duplicate', e);
        }
      }
      return buildResult({ duplicate: true, ...(confirmedMeta || {}) });
    }

    await putFile(file, presign);

    let confirmMeta = null;
    if (presign.confirm_required !== false) {
      try {
        confirmMeta = await confirmUpload(confirmPayload);
      } catch (e) {
        console.warn('Confirm upload failed', e);
      }
    }

    return buildResult({ duplicate: false, ...(confirmMeta || {}) });
  } catch (error) {
    throw normalizeUploadError(error, 'Upload failed', {
      fileName: file.name,
    });
  }
}

/**
 * Batch upload files sequentially (can optimize to parallel with concurrency limit)
 */
export async function batchUpload(files, opts = {}, onProgress) {
  const results = [];
  let index = 0;
  for (const f of files) {
    // naive SHA256 omitted for speed; could add WebCrypto hashing if dedupe important client-side
    const img = await uploadViaPresign(f, opts);
    results.push(img);
    index++; if (onProgress) onProgress(index, files.length, img);
  }
  return results;
}
