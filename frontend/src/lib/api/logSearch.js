import api from '../api';

// Unified log search: system / audit / error
// params: { q, date_from, date_to, types, limit_per_type }
export async function searchLogs(params = {}) {
  const {
    q, date_from, date_to, types, limit_per_type,
    method, status_code, user_id, request_id, path,
    min_duration, max_duration, action, audit_status, error_type,
    model, source, actor_type, actor_id, llm_status,
    system_page, audit_page, error_page, llm_page
  } = params;
  const query = new URLSearchParams();
  if (q) query.append('q', q);
  if (date_from) query.append('date_from', date_from);
  if (date_to) query.append('date_to', date_to);
  if (types?.length) query.append('types', types.join(','));
  if (limit_per_type) query.append('limit_per_type', limit_per_type);
  if (system_page) query.append('system_page', system_page);
  if (audit_page) query.append('audit_page', audit_page);
  if (error_page) query.append('error_page', error_page);
  if (llm_page) query.append('llm_page', llm_page);
  if (method) query.append('method', method);
  if (status_code) query.append('status_code', status_code);
  if (user_id) query.append('user_id', user_id);
  if (request_id) query.append('request_id', request_id);
  if (path) query.append('path', path);
  if (min_duration) query.append('min_duration', min_duration);
  if (max_duration) query.append('max_duration', max_duration);
  if (action) query.append('action', action);
  if (audit_status) query.append('audit_status', audit_status);
  if (error_type) query.append('error_type', error_type);
  if (model) query.append('model', model);
  if (source) query.append('source', source);
  if (actor_type) query.append('actor_type', actor_type);
  if (actor_id) query.append('actor_id', actor_id);
  if (llm_status) query.append('llm_status', llm_status);
  const res = await api.get(`/admin/logs/search?${query.toString()}`);
  return res.data;
}

// Related logs by request_id (system + audit + error + llm)
export async function fetchRelatedLogs(requestId) {
  if (!requestId) return { system: [], audit: [], error: [], llm: [] };
  const res = await api.get(`/admin/logs/related?request_id=${encodeURIComponent(requestId)}`);
  return res.data;
}

// Export logs (CSV or NDJSON) using same query structure as searchLogs.
// format: 'csv' | 'ndjson'
export async function exportLogs(params = {}, format = 'csv') {
  const {
    q, date_from, date_to, types,
    method, status_code, user_id, request_id, path,
    min_duration, max_duration, action, audit_status, error_type,
    model, source, actor_type, actor_id, llm_status,
    max
  } = params;
  const query = new URLSearchParams();
  if (q) query.append('q', q);
  if (date_from) query.append('date_from', date_from);
  if (date_to) query.append('date_to', date_to);
  if (types?.length) query.append('types', types.join(','));
  if (method) query.append('method', method);
  if (status_code) query.append('status_code', status_code);
  if (user_id) query.append('user_id', user_id);
  if (request_id) query.append('request_id', request_id);
  if (path) query.append('path', path);
  if (min_duration) query.append('min_duration', min_duration);
  if (max_duration) query.append('max_duration', max_duration);
  if (action) query.append('action', action);
  if (audit_status) query.append('audit_status', audit_status);
  if (error_type) query.append('error_type', error_type);
  if (model) query.append('model', model);
  if (source) query.append('source', source);
  if (actor_type) query.append('actor_type', actor_type);
  if (actor_id) query.append('actor_id', actor_id);
  if (llm_status) query.append('llm_status', llm_status);
  if (max) query.append('max', max);
  query.append('format', format);
  const res = await api.get(`/admin/logs/export?${query.toString()}`, { responseType: 'blob' });
  return res.data; // caller decides how to save
}
