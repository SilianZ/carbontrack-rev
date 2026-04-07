export const TICKET_CATEGORY_OPTIONS = [
  { value: 'website_bug', labelKey: 'support.categories.website_bug' },
  { value: 'business_issue', labelKey: 'support.categories.business_issue' },
  { value: 'feature_request', labelKey: 'support.categories.feature_request' },
  { value: 'account', labelKey: 'support.categories.account' },
  { value: 'other', labelKey: 'support.categories.other' },
];

export const TICKET_STATUS_OPTIONS = [
  { value: 'open', labelKey: 'support.statuses.open' },
  { value: 'in_progress', labelKey: 'support.statuses.in_progress' },
  { value: 'waiting_user', labelKey: 'support.statuses.waiting_user' },
  { value: 'resolved', labelKey: 'support.statuses.resolved' },
  { value: 'closed', labelKey: 'support.statuses.closed' },
];

export const TICKET_PRIORITY_OPTIONS = [
  { value: 'low', labelKey: 'support.priorities.low' },
  { value: 'normal', labelKey: 'support.priorities.normal' },
  { value: 'high', labelKey: 'support.priorities.high' },
  { value: 'urgent', labelKey: 'support.priorities.urgent' },
];

export function normalizeUploadedFiles(result) {
  const payload = result?.data ?? result ?? {};
  const entries = Array.isArray(payload?.results)
    ? payload.results
    : payload?.file_path
      ? [payload]
      : [];

  return entries
    .map((entry) => ({
      file_path: entry?.file_path ?? entry?.path ?? '',
      original_name: entry?.original_name ?? entry?.originalName ?? entry?.file_path?.split('/').pop() ?? 'attachment',
      mime_type: entry?.mime_type ?? entry?.mimeType ?? '',
      size: Number(entry?.size ?? 0),
      public_url: entry?.public_url ?? entry?.url ?? null,
      sha256: entry?.sha256 ?? null,
    }))
    .filter((entry) => entry.file_path);
}

export function mergeUploadedFiles(existingFiles = [], result) {
  const nextFiles = normalizeUploadedFiles(result);
  const fileMap = new Map(existingFiles.map((file) => [file.file_path, file]));

  nextFiles.forEach((file) => {
    fileMap.set(file.file_path, file);
  });

  return Array.from(fileMap.values());
}

export function formatSupportDate(value, locale = 'zh-CN', fallback = '--') {
  if (!value) {
    return fallback;
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

export function formatSlaDuration(minutes, locale = 'zh-CN') {
  const absolute = Math.max(0, Math.abs(Math.trunc(minutes)));
  const days = Math.floor(absolute / 1440);
  const hours = Math.floor((absolute % 1440) / 60);
  const mins = absolute % 60;

  if (locale.startsWith('zh')) {
    const parts = [];
    if (days > 0) parts.push(`${days}天`);
    if (hours > 0) parts.push(`${hours}小时`);
    if (mins > 0 || parts.length === 0) parts.push(`${mins}分钟`);
    return parts.join('');
  }

  const parts = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (mins > 0 || parts.length === 0) parts.push(`${mins}m`);
  return parts.join(' ');
}

export function getSlaTone(state) {
  switch (state) {
    case 'due_soon':
      return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200';
    case 'breached':
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200';
    case 'escalated':
      return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200';
    case 'resolved':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200';
    default:
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200';
  }
}

export function getSlaMeta(ticket, locale = 'zh-CN') {
  const summary = ticket?.sla_summary;
  const state = summary?.display_state || ticket?.sla_status || 'pending';
  const dueAt = summary?.active_due_at || null;
  const minutesDelta = typeof summary?.active_minutes_delta === 'number' ? summary.active_minutes_delta : null;

  let relativeLabel = '--';
  if (state === 'resolved') {
    relativeLabel = locale.startsWith('zh') ? '已完成' : 'Completed';
  } else if (minutesDelta !== null) {
    const duration = formatSlaDuration(minutesDelta, locale);
    relativeLabel = minutesDelta < 0
      ? (locale.startsWith('zh') ? `超时 ${duration}` : `Overdue ${duration}`)
      : (locale.startsWith('zh') ? `剩余 ${duration}` : `${duration} remaining`);
  }

  return {
    state,
    dueAt,
    dueAtLabel: formatSupportDate(dueAt, locale),
    relativeLabel,
    activeTarget: summary?.active_target || null,
  };
}

export function getSlaMilestoneMeta(ticket, key, locale = 'zh-CN') {
  const milestone = ticket?.sla_summary?.[key];
  if (!milestone?.due_at) {
    return {
      dueAtLabel: '--',
      relativeLabel: '--',
      state: 'not_configured',
    };
  }

  let relativeLabel = '--';
  if (milestone.state === 'met') {
    relativeLabel = locale.startsWith('zh') ? '已完成' : 'Completed';
  } else if (typeof milestone.minutes_delta === 'number') {
    const duration = formatSlaDuration(milestone.minutes_delta, locale);
    relativeLabel = milestone.minutes_delta < 0
      ? (locale.startsWith('zh') ? `超时 ${duration}` : `Overdue ${duration}`)
      : (locale.startsWith('zh') ? `剩余 ${duration}` : `${duration} remaining`);
  }

  return {
    dueAtLabel: formatSupportDate(milestone.due_at, locale),
    relativeLabel,
    state: milestone.state || 'pending',
  };
}

export function isImageAttachment(attachment) {
  const mimeType = String(attachment?.mime_type ?? '');
  const filePath = String(attachment?.file_path ?? '').toLowerCase();
  return mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(filePath);
}

export function getStatusTone(status) {
  switch (status) {
    case 'open':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200';
    case 'in_progress':
      return 'border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200';
    case 'waiting_user':
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200';
    case 'resolved':
      return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200';
    case 'closed':
      return 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200';
    default:
      return 'border-border bg-muted text-foreground';
  }
}

export function getPriorityVariant(priority) {
  switch (priority) {
    case 'urgent':
      return 'urgent';
    case 'high':
      return 'high';
    case 'low':
      return 'low';
    default:
      return 'normal';
  }
}

export function getTagTone(color) {
  switch (color) {
    case 'rose':
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200';
    case 'sky':
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200';
    case 'amber':
      return 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200';
    case 'violet':
      return 'border-violet-200 bg-violet-50 text-violet-700 dark:border-violet-500/30 dark:bg-violet-500/10 dark:text-violet-200';
    case 'slate':
      return 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200';
    default:
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200';
  }
}
