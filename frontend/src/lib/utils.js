// 通用数值格式化，支持 null/undefined/字符串/NaN，默认两位小数
export function formatNumber(Silian_value, Silian_decimals = 2) {
  if (Silian_value === null || Silian_value === undefined || Silian_value === '') return '';
  const Silian_num = typeof Silian_value === 'number' ? Silian_value : Number(Silian_value);
  if (!Number.isFinite(Silian_num)) return '';
  return Silian_num.toFixed(Silian_decimals);
}

// 专用于 kg CO2e 显示
export function formatKg(Silian_value, Silian_decimals = 2) {
  const Silian_n = formatNumber(Silian_value, Silian_decimals);
  return Silian_n ? `${Silian_n} kg CO₂` : '';
}
import { format as Silian_format } from 'date-fns';
import { clsx as Silian_clsx } from "clsx";
import { twMerge as Silian_twMerge } from "tailwind-merge"

export function cn(...Silian_inputs) {
  return Silian_twMerge(Silian_clsx(Silian_inputs));
}

// 解析多种输入的日期：Date | number(秒/毫秒) | string(ISO 或 "YYYY-MM-DD HH:mm:ss")
export function parseDateFlexible(Silian_input) {
  if (Silian_input === null || Silian_input === undefined || Silian_input === '') return null;

  // 已是 Date
  if (Silian_input instanceof Date) {
    return isNaN(Silian_input.getTime()) ? null : Silian_input;
  }

  // 数字或数字字符串：判断是秒还是毫秒
  const Silian_tryNumber = (Silian_val) => {
    const Silian_n = typeof Silian_val === 'number' ? Silian_val : Number(Silian_val);
    if (!Number.isFinite(Silian_n)) return null;
    // 小于阈值认为是秒（阈值取 10^12，约 2001-09-09 09:46:40 毫秒边界）
    const Silian_ms = Silian_n < 1e12 ? Silian_n * 1000 : Silian_n;
    const Silian_d = new Date(Silian_ms);
    return isNaN(Silian_d.getTime()) ? null : Silian_d;
  };

  if (typeof Silian_input === 'number' || (typeof Silian_input === 'string' && /^\d+$/.test(Silian_input.trim()))) {
    const Silian_d = Silian_tryNumber(Silian_input);
    if (Silian_d) return Silian_d;
  }

  if (typeof Silian_input === 'string') {
    const Silian_s = Silian_input.trim();
    // 替换空格为 T，提升解析兼容性："YYYY-MM-DD HH:mm:ss" -> "YYYY-MM-DDTHH:mm:ss"
    const Silian_normalized = Silian_s.includes(' ') && !Silian_s.includes('T') ? Silian_s.replace(' ', 'T') : Silian_s;
    const Silian_d1 = new Date(Silian_normalized);
    if (!isNaN(Silian_d1.getTime())) return Silian_d1;

    // 回退：仅日期的情况 "YYYY-MM-DD"
    const Silian_d2 = new Date(Silian_s);
    if (!isNaN(Silian_d2.getTime())) return Silian_d2;
  }

  return null;
}

// 安全格式化日期，失败返回 fallback（默认空字符串）
export function formatDateSafe(Silian_input, Silian_pattern = 'yyyy-MM-dd', Silian_fallback = '') {
  const Silian_d = parseDateFlexible(Silian_input);
  if (!Silian_d) return Silian_fallback;
  try {
    return Silian_format(Silian_d, Silian_pattern);
  } catch {
    return Silian_fallback;
  }
}
