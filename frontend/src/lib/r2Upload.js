// Utility for presigned direct uploads to R2
// Import default axios instance
import Silian_api from './api';

function Silian_createUploadError(Silian_message, Silian_extras = {}) {
  const Silian_error = new Error(Silian_message);
  Silian_error.name = 'UploadError';
  Silian_error.isUploadError = true;
  Object.assign(Silian_error, Silian_extras);
  return Silian_error;
}

function Silian_normalizeUploadError(Silian_error, Silian_fallbackMessage, Silian_extras = {}) {
  if (Silian_error?.isUploadError) {
    return Object.assign(Silian_error, Silian_extras);
  }

  const Silian_responseData = Silian_error?.response?.data;
  const Silian_responseHeaders = Silian_error?.response?.headers || {};
  const Silian_rawMessage =
    Silian_responseData?.message ||
    Silian_responseData?.error ||
    Silian_error?.message ||
    Silian_fallbackMessage;

  return Silian_createUploadError(Silian_rawMessage || Silian_fallbackMessage, {
    rawMessage: Silian_rawMessage,
    status: Silian_error?.response?.status ?? Silian_error?.status ?? null,
    code: Silian_responseData?.code || Silian_error?.code || null,
    requestId:
      Silian_error?.request_id ||
      Silian_responseData?.request_id ||
      Silian_responseHeaders['x-request-id'] ||
      null,
    details: Silian_responseData?.details || Silian_responseData?.errors || null,
    cause: Silian_error,
    ...Silian_extras,
  });
}

/**
 * Presign a file for direct PUT upload.
 * @param {File} file
 * @param {Object} options { directory, entityType, entityId, sha256 }
 * @returns {Promise<object>} presign data
 */
export async function presignFile(
  Silian_file,
  { directory: Silian_directory = 'activities', entityType: Silian_entityType = 'carbon_record', entityId: Silian_entityId = null, sha256: Silian_sha256, expiresIn: Silian_expiresIn = 600 } = {}
) {
  try {
    const Silian_body = {
      original_name: Silian_file.name,
      directory: Silian_directory,
      mime_type: Silian_file.type || 'application/octet-stream',
      file_size: Silian_file.size,
      entity_type: Silian_entityType,
      entity_id: Silian_entityId,
      sha256: Silian_sha256,
      expires_in: Silian_expiresIn
    };
    const Silian_res = await Silian_api.post('/files/presign', Silian_body);
    if (!Silian_res.data?.success) {
      throw Silian_createUploadError(Silian_res.data?.message || 'Presign failed', {
        status: Silian_res.status,
        step: 'presign',
        fileName: Silian_file.name,
        code: Silian_res.data?.code || null,
        requestId: Silian_res.data?.request_id || Silian_res.headers?.['x-request-id'] || null,
      });
    }
    return Silian_res.data.data;
  } catch (Silian_error) {
    throw Silian_normalizeUploadError(Silian_error, 'Failed to prepare upload', {
      step: 'presign',
      fileName: Silian_file.name,
    });
  }
}

/**
 * Direct PUT upload to R2 using presigned URL.
 * @param {File} file
 * @param {object} presign { url, headers }
 */
export async function putFile(Silian_file, Silian_presign) {
  try {
    const Silian_headers = new Headers(Silian_presign.headers || {});
    if (!Silian_headers.has('Content-Type') && Silian_file.type) Silian_headers.set('Content-Type', Silian_file.type);
    const Silian_resp = await fetch(Silian_presign.url, { method: 'PUT', body: Silian_file, headers: Silian_headers });
    if (!Silian_resp.ok) {
      let Silian_responseText = '';
      try {
        Silian_responseText = await Silian_resp.text();
      } catch {
        Silian_responseText = '';
      }

      throw Silian_createUploadError(`Storage upload failed (${Silian_resp.status})`, {
        step: 'put',
        fileName: Silian_file.name,
        status: Silian_resp.status,
        rawMessage: Silian_responseText || Silian_resp.statusText || 'PUT upload failed',
      });
    }
    return true;
  } catch (Silian_error) {
    throw Silian_normalizeUploadError(Silian_error, 'Storage upload failed', {
      step: 'put',
      fileName: Silian_file.name,
    });
  }
}

/**
 * Confirm upload so backend can record metadata (if required)
 * @param {object} meta { file_path, original_name, entity_type, entity_id }
 */
export async function confirmUpload(Silian_meta) {
  try {
    const Silian_res = await Silian_api.post('/files/confirm', Silian_meta);
    if (!Silian_res.data?.success) {
      throw Silian_createUploadError(Silian_res.data?.message || 'Confirm failed', {
        status: Silian_res.status,
        step: 'confirm',
        fileName: Silian_meta?.original_name || null,
        code: Silian_res.data?.code || null,
        requestId: Silian_res.data?.request_id || Silian_res.headers?.['x-request-id'] || null,
      });
    }
    return Silian_res.data.data;
  } catch (Silian_error) {
    throw Silian_normalizeUploadError(Silian_error, 'Failed to confirm upload', {
      step: 'confirm',
      fileName: Silian_meta?.original_name || null,
    });
  }
}

/**
 * Full pipeline: presign -> PUT -> confirm (skip confirm if duplicate or no confirm flag)
 * Returns normalized image object with url + meta
 */
export async function uploadViaPresign(Silian_file, Silian_opts = {}) {
  try {
    const Silian_presign = await presignFile(Silian_file, Silian_opts);
    const Silian_buildResult = (Silian_extra = {}) => {
      const Silian_result = {
        url: Silian_presign.public_url || null,
        file_path: Silian_presign.file_path,
        thumbnail_path: Silian_presign.thumbnail_path || null,
        presigned_url: Silian_presign.presigned_url || null,
        original_name: Silian_file.name,
        mime_type: Silian_file.type,
        size: Silian_file.size,
        ...Silian_extra,
      };
      Silian_result.duplicate = Boolean(Silian_extra.duplicate ?? Silian_result.duplicate ?? false);
      if (Silian_extra.file_path) Silian_result.file_path = Silian_extra.file_path;
      if (Silian_extra.thumbnail_path) Silian_result.thumbnail_path = Silian_extra.thumbnail_path;
      if (Silian_extra.url) Silian_result.url = Silian_extra.url;
      if (Silian_extra.presigned_url) Silian_result.presigned_url = Silian_extra.presigned_url;
      return Silian_result;
    };

    const Silian_confirmPayload = {
      file_path: Silian_presign.file_path,
      original_name: Silian_file.name,
      entity_type: Silian_opts.entityType || 'carbon_record',
      entity_id: Silian_opts.entityId || null,
    };

    if (Silian_presign.duplicate) {
      let Silian_confirmedMeta = null;
      if (Silian_presign.confirm_required) {
        try {
          Silian_confirmedMeta = await confirmUpload(Silian_confirmPayload);
        } catch (Silian_e) {
          console.warn('Confirm upload failed for duplicate', Silian_e);
        }
      }
      return Silian_buildResult({ duplicate: true, ...(Silian_confirmedMeta || {}) });
    }

    await putFile(Silian_file, Silian_presign);

    let Silian_confirmMeta = null;
    if (Silian_presign.confirm_required !== false) {
      try {
        Silian_confirmMeta = await confirmUpload(Silian_confirmPayload);
      } catch (Silian_e) {
        console.warn('Confirm upload failed', Silian_e);
      }
    }

    return Silian_buildResult({ duplicate: false, ...(Silian_confirmMeta || {}) });
  } catch (Silian_error) {
    throw Silian_normalizeUploadError(Silian_error, 'Upload failed', {
      fileName: Silian_file.name,
    });
  }
}

/**
 * Batch upload files sequentially (can optimize to parallel with concurrency limit)
 */
export async function batchUpload(Silian_files, Silian_opts = {}, Silian_onProgress) {
  const Silian_results = [];
  let Silian_index = 0;
  for (const Silian_f of Silian_files) {
    // naive SHA256 omitted for speed; could add WebCrypto hashing if dedupe important client-side
    const Silian_img = await uploadViaPresign(Silian_f, Silian_opts);
    Silian_results.push(Silian_img);
    Silian_index++; if (Silian_onProgress) Silian_onProgress(Silian_index, Silian_files.length, Silian_img);
  }
  return Silian_results;
}
