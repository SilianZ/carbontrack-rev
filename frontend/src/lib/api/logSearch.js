import Silian_api from '../api';

// Unified log search: system / audit / error
// params: { q, date_from, date_to, types, limit_per_type }
export async function searchLogs(Silian_params = {}) {
  const {
    q: Silian_q, date_from: Silian_date_from, date_to: Silian_date_to, types: Silian_types, limit_per_type: Silian_limit_per_type,
    method: Silian_method, status_code: Silian_status_code, user_id: Silian_user_id, request_id: Silian_request_id, path: Silian_path,
    min_duration: Silian_min_duration, max_duration: Silian_max_duration, action: Silian_action, audit_status: Silian_audit_status, error_type: Silian_error_type,
    model: Silian_model, source: Silian_source, actor_type: Silian_actor_type, actor_id: Silian_actor_id, llm_status: Silian_llm_status, conversation_id: Silian_conversation_id, turn_no: Silian_turn_no,
    system_page: Silian_system_page, audit_page: Silian_audit_page, error_page: Silian_error_page, llm_page: Silian_llm_page
  } = Silian_params;
  const Silian_query = new URLSearchParams();
  if (Silian_q) Silian_query.append('q', Silian_q);
  if (Silian_date_from) Silian_query.append('date_from', Silian_date_from);
  if (Silian_date_to) Silian_query.append('date_to', Silian_date_to);
  if (Silian_types?.length) Silian_query.append('types', Silian_types.join(','));
  if (Silian_limit_per_type) Silian_query.append('limit_per_type', Silian_limit_per_type);
  if (Silian_system_page) Silian_query.append('system_page', Silian_system_page);
  if (Silian_audit_page) Silian_query.append('audit_page', Silian_audit_page);
  if (Silian_error_page) Silian_query.append('error_page', Silian_error_page);
  if (Silian_llm_page) Silian_query.append('llm_page', Silian_llm_page);
  if (Silian_method) Silian_query.append('method', Silian_method);
  if (Silian_status_code) Silian_query.append('status_code', Silian_status_code);
  if (Silian_user_id) Silian_query.append('user_id', Silian_user_id);
  if (Silian_request_id) Silian_query.append('request_id', Silian_request_id);
  if (Silian_path) Silian_query.append('path', Silian_path);
  if (Silian_min_duration) Silian_query.append('min_duration', Silian_min_duration);
  if (Silian_max_duration) Silian_query.append('max_duration', Silian_max_duration);
  if (Silian_action) Silian_query.append('action', Silian_action);
  if (Silian_audit_status) Silian_query.append('audit_status', Silian_audit_status);
  if (Silian_error_type) Silian_query.append('error_type', Silian_error_type);
  if (Silian_model) Silian_query.append('model', Silian_model);
  if (Silian_source) Silian_query.append('source', Silian_source);
  if (Silian_actor_type) Silian_query.append('actor_type', Silian_actor_type);
  if (Silian_actor_id) Silian_query.append('actor_id', Silian_actor_id);
  if (Silian_llm_status) Silian_query.append('llm_status', Silian_llm_status);
  if (Silian_conversation_id) Silian_query.append('conversation_id', Silian_conversation_id);
  if (Silian_turn_no) Silian_query.append('turn_no', Silian_turn_no);
  const Silian_res = await Silian_api.get(`/admin/logs/search?${Silian_query.toString()}`);
  return Silian_res.data;
}

// Related logs by request_id (system + audit + error + llm)
export async function fetchRelatedLogs(Silian_requestId) {
  if (!Silian_requestId) return { system: [], audit: [], error: [], llm: [] };
  const Silian_query = new URLSearchParams();
  Silian_query.append('request_id', Silian_requestId);
  Silian_query.append('types', 'system,audit,error,llm');
  Silian_query.append('limit_per_type', '200');
  const Silian_res = await Silian_api.get(`/admin/logs/search?${Silian_query.toString()}`);
  const Silian_payload = Silian_res.data?.data || Silian_res.data || {};
  return {
    system: Silian_payload.system?.items || Silian_payload.system || [],
    audit: Silian_payload.audit?.items || Silian_payload.audit || [],
    error: Silian_payload.error?.items || Silian_payload.error || [],
    llm: Silian_payload.llm?.items || Silian_payload.llm || []
  };
}

// Export logs (CSV or NDJSON) using same query structure as searchLogs.
// format: 'csv' | 'ndjson'
export async function exportLogs(Silian_params = {}, Silian_format = 'csv') {
  const {
    q: Silian_q, date_from: Silian_date_from, date_to: Silian_date_to, types: Silian_types,
    method: Silian_method, status_code: Silian_status_code, user_id: Silian_user_id, request_id: Silian_request_id, path: Silian_path,
    min_duration: Silian_min_duration, max_duration: Silian_max_duration, action: Silian_action, audit_status: Silian_audit_status, error_type: Silian_error_type,
    model: Silian_model, source: Silian_source, actor_type: Silian_actor_type, actor_id: Silian_actor_id, llm_status: Silian_llm_status, conversation_id: Silian_conversation_id, turn_no: Silian_turn_no,
    max: Silian_max
  } = Silian_params;
  const Silian_query = new URLSearchParams();
  if (Silian_q) Silian_query.append('q', Silian_q);
  if (Silian_date_from) Silian_query.append('date_from', Silian_date_from);
  if (Silian_date_to) Silian_query.append('date_to', Silian_date_to);
  if (Silian_types?.length) Silian_query.append('types', Silian_types.join(','));
  if (Silian_method) Silian_query.append('method', Silian_method);
  if (Silian_status_code) Silian_query.append('status_code', Silian_status_code);
  if (Silian_user_id) Silian_query.append('user_id', Silian_user_id);
  if (Silian_request_id) Silian_query.append('request_id', Silian_request_id);
  if (Silian_path) Silian_query.append('path', Silian_path);
  if (Silian_min_duration) Silian_query.append('min_duration', Silian_min_duration);
  if (Silian_max_duration) Silian_query.append('max_duration', Silian_max_duration);
  if (Silian_action) Silian_query.append('action', Silian_action);
  if (Silian_audit_status) Silian_query.append('audit_status', Silian_audit_status);
  if (Silian_error_type) Silian_query.append('error_type', Silian_error_type);
  if (Silian_model) Silian_query.append('model', Silian_model);
  if (Silian_source) Silian_query.append('source', Silian_source);
  if (Silian_actor_type) Silian_query.append('actor_type', Silian_actor_type);
  if (Silian_actor_id) Silian_query.append('actor_id', Silian_actor_id);
  if (Silian_llm_status) Silian_query.append('llm_status', Silian_llm_status);
  if (Silian_conversation_id) Silian_query.append('conversation_id', Silian_conversation_id);
  if (Silian_turn_no) Silian_query.append('turn_no', Silian_turn_no);
  if (Silian_max) Silian_query.append('max', Silian_max);
  Silian_query.append('format', Silian_format);
  const Silian_res = await Silian_api.get(`/admin/logs/export?${Silian_query.toString()}`, { responseType: 'blob' });
  return Silian_res.data; // caller decides how to save
}
