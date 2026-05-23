import Silian_api from '../api';

// 基础列表查询
export async function fetchSystemLogs(Silian_params = {}) {
  const { page: Silian_page = 1, limit: Silian_limit = 20, method: Silian_method, status_code: Silian_status_code, user_id: Silian_user_id, path: Silian_path, request_id: Silian_request_id, date_from: Silian_date_from, date_to: Silian_date_to } = Silian_params;
  const Silian_query = new URLSearchParams();
  Silian_query.append('page', Silian_page);
  Silian_query.append('limit', Silian_limit);
  if (Silian_method) Silian_query.append('method', Silian_method);
  if (Silian_status_code) Silian_query.append('status_code', Silian_status_code);
  if (Silian_user_id) Silian_query.append('user_id', Silian_user_id);
  if (Silian_path) Silian_query.append('path', Silian_path);
  if (Silian_request_id) Silian_query.append('request_id', Silian_request_id);
  if (Silian_date_from) Silian_query.append('date_from', Silian_date_from);
  if (Silian_date_to) Silian_query.append('date_to', Silian_date_to);
  // 使用统一 api 实例；路径不再硬编码协议主机，保持与 baseURL 拼接
  const Silian_res = await Silian_api.get(`/admin/system-logs?${Silian_query.toString()}`);
  return Silian_res.data;
}

// 详情
export async function fetchSystemLogDetail(Silian_id) {
  const Silian_res = await Silian_api.get(`/admin/system-logs/${Silian_id}`);
  return Silian_res.data;
}
