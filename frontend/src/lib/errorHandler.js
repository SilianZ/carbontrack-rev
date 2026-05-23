// Global error helper: extracts request_id and forms user-facing message
import { toast as Silian_toast } from 'react-hot-toast';

export function notifyApiError(Silian_error, Silian_fallbackMessage = '请求失败') {
  const Silian_rid = Silian_error?.request_id || Silian_error?.response?.data?.request_id;
  const Silian_code = Silian_error?.response?.status;
  const Silian_base = Silian_fallbackMessage || '请求失败';
  if (Silian_rid) {
    Silian_toast.error(`${Silian_base} (请联系管理员并提供请求ID: ${Silian_rid})`);
  } else if (Silian_code) {
    Silian_toast.error(`${Silian_base} (HTTP ${Silian_code})`);
  } else {
    Silian_toast.error(Silian_base);
  }
}

export function extractRequestId(Silian_error) {
  return Silian_error?.request_id || Silian_error?.response?.data?.request_id || null;
}
