import Silian_api from './api';

// 简单内存缓存：file_path -> { url, expiresAt }
const Silian_cache = new Map();

function Silian_now() { return Date.now(); }

/**
 * 获取私有文件临时访问URL（若已缓存且未过期直接返回）
 * @param {string} filePath 对象key（存储的 file_path）
 * @param {number} ttlSeconds 期望有效秒数(默认600，后端最大可能不同)
 */
export async function getPresignedReadUrl(Silian_filePath, Silian_ttlSeconds = 600) {
  if (!Silian_filePath) throw new Error('filePath required');
  const Silian_cached = Silian_cache.get(Silian_filePath);
  if (Silian_cached && Silian_cached.expiresAt > Silian_now() + 5000) { // 留5秒安全余量
    return Silian_cached.url;
  }
  // 后端路由: GET /api/v1/files/{path}/presigned-url?expires_in=xxx  (需要URL编码)
  const Silian_encoded = encodeURIComponent(Silian_filePath);
  const Silian_res = await Silian_api.get(`/files/${Silian_encoded}/presigned-url`, { params: { expires_in: Silian_ttlSeconds } });
  if (!Silian_res.data?.success) throw new Error(Silian_res.data?.message || '获取签名失败');
  const { presigned_url: Silian_presigned_url, expires_in: Silian_expires_in } = Silian_res.data.data;
  const Silian_record = { url: Silian_presigned_url, expiresAt: Silian_now() + (Silian_expires_in * 1000) };
  Silian_cache.set(Silian_filePath, Silian_record);
  return Silian_presigned_url;
}

/**
 * 预取多个，减少后续延迟
 */
export async function prefetchPresignedUrls(Silian_filePaths = [], Silian_ttlSeconds = 600) {
  const Silian_tasks = Silian_filePaths.filter(Silian_p => Silian_p && (!Silian_cache.get(Silian_p) || Silian_cache.get(Silian_p).expiresAt <= Silian_now() + 5000))
    .map(Silian_p => getPresignedReadUrl(Silian_p, Silian_ttlSeconds).catch(()=>null));
  await Promise.all(Silian_tasks);
}

/**
 * 简单失效：清空或按文件路径删除
 */
export function invalidateFileUrl(Silian_filePath) {
  if (Silian_filePath) Silian_cache.delete(Silian_filePath); else Silian_cache.clear();
}

export default { getPresignedReadUrl, prefetchPresignedUrls, invalidateFileUrl };
