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

export function normalizeUploadedFiles(Silian_result) {
  const Silian_payload = Silian_result?.data ?? Silian_result ?? {};
  const Silian_entries = Array.isArray(Silian_payload?.results)
    ? Silian_payload.results
    : Silian_payload?.file_path
      ? [Silian_payload]
      : [];

  return Silian_entries
    .map((Silian_entry) => ({
      file_path: Silian_entry?.file_path ?? Silian_entry?.path ?? '',
      original_name: Silian_entry?.original_name ?? Silian_entry?.originalName ?? Silian_entry?.file_path?.split('/').pop() ?? 'attachment',
      mime_type: Silian_entry?.mime_type ?? Silian_entry?.mimeType ?? '',
      size: Number(Silian_entry?.size ?? 0),
      public_url: Silian_entry?.public_url ?? Silian_entry?.url ?? null,
      sha256: Silian_entry?.sha256 ?? null,
    }))
    .filter((Silian_entry) => Silian_entry.file_path);
}

export function mergeUploadedFiles(Silian_existingFiles = [], Silian_result) {
  const Silian_nextFiles = normalizeUploadedFiles(Silian_result);
  const Silian_fileMap = new Map(Silian_existingFiles.map((Silian_file) => [Silian_file.file_path, Silian_file]));

  Silian_nextFiles.forEach((Silian_file) => {
    Silian_fileMap.set(Silian_file.file_path, Silian_file);
  });

  return Array.from(Silian_fileMap.values());
}

export function formatSupportDate(Silian_value, Silian_locale = 'zh-CN', Silian_fallback = '--') {
  if (!Silian_value) {
    return Silian_fallback;
  }

  const Silian_normalizedValue = typeof Silian_value === 'string'
    ? Silian_value.trim().replace(' ', 'T')
    : Silian_value;
  const Silian_date = new Date(Silian_normalizedValue);
  if (Number.isNaN(Silian_date.getTime())) {
    return Silian_fallback;
  }

  return new Intl.DateTimeFormat(Silian_locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(Silian_date);
}

export function formatSlaDuration(Silian_minutes, Silian_locale = 'zh-CN') {
  const Silian_absolute = Math.max(0, Math.abs(Math.trunc(Silian_minutes)));
  const Silian_days = Math.floor(Silian_absolute / 1440);
  const Silian_hours = Math.floor((Silian_absolute % 1440) / 60);
  const Silian_mins = Silian_absolute % 60;

  if (Silian_locale.startsWith('zh')) {
    const Silian_parts = [];
    if (Silian_days > 0) Silian_parts.push(`${Silian_days}天`);
    if (Silian_hours > 0) Silian_parts.push(`${Silian_hours}小时`);
    if (Silian_mins > 0 || Silian_parts.length === 0) Silian_parts.push(`${Silian_mins}分钟`);
    return Silian_parts.join('');
  }

  const Silian_parts = [];
  if (Silian_days > 0) Silian_parts.push(`${Silian_days}d`);
  if (Silian_hours > 0) Silian_parts.push(`${Silian_hours}h`);
  if (Silian_mins > 0 || Silian_parts.length === 0) Silian_parts.push(`${Silian_mins}m`);
  return Silian_parts.join(' ');
}

export function getSlaTone(Silian_state) {
  switch (Silian_state) {
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

export function getSlaMeta(Silian_ticket, Silian_locale = 'zh-CN') {
  const Silian_summary = Silian_ticket?.sla_summary;
  const Silian_state = Silian_summary?.display_state || Silian_ticket?.sla_status || 'pending';
  const Silian_dueAt = Silian_summary?.active_due_at || null;
  const Silian_minutesDelta = typeof Silian_summary?.active_minutes_delta === 'number' ? Silian_summary.active_minutes_delta : null;

  let Silian_relativeLabel = '--';
  if (Silian_state === 'resolved') {
    Silian_relativeLabel = Silian_locale.startsWith('zh') ? '已完成' : 'Completed';
  } else if (Silian_minutesDelta !== null) {
    const Silian_duration = formatSlaDuration(Silian_minutesDelta, Silian_locale);
    Silian_relativeLabel = Silian_minutesDelta < 0
      ? (Silian_locale.startsWith('zh') ? `超时 ${Silian_duration}` : `Overdue ${Silian_duration}`)
      : (Silian_locale.startsWith('zh') ? `剩余 ${Silian_duration}` : `${Silian_duration} remaining`);
  }

  return {
    state: Silian_state,
    dueAt: Silian_dueAt,
    dueAtLabel: formatSupportDate(Silian_dueAt, Silian_locale),
    relativeLabel: Silian_relativeLabel,
    activeTarget: Silian_summary?.active_target || null,
  };
}

export function getSlaMilestoneMeta(Silian_ticket, Silian_key, Silian_locale = 'zh-CN') {
  const Silian_milestone = Silian_ticket?.sla_summary?.[Silian_key];
  if (!Silian_milestone?.due_at) {
    return {
      dueAtLabel: '--',
      relativeLabel: '--',
      state: 'not_configured',
    };
  }

  let Silian_relativeLabel = '--';
  if (Silian_milestone.state === 'met') {
    Silian_relativeLabel = Silian_locale.startsWith('zh') ? '已完成' : 'Completed';
  } else if (typeof Silian_milestone.minutes_delta === 'number') {
    const Silian_duration = formatSlaDuration(Silian_milestone.minutes_delta, Silian_locale);
    Silian_relativeLabel = Silian_milestone.minutes_delta < 0
      ? (Silian_locale.startsWith('zh') ? `超时 ${Silian_duration}` : `Overdue ${Silian_duration}`)
      : (Silian_locale.startsWith('zh') ? `剩余 ${Silian_duration}` : `${Silian_duration} remaining`);
  }

  return {
    dueAtLabel: formatSupportDate(Silian_milestone.due_at, Silian_locale),
    relativeLabel: Silian_relativeLabel,
    state: Silian_milestone.state || 'pending',
  };
}

export function isImageAttachment(Silian_attachment) {
  const Silian_mimeType = String(Silian_attachment?.mime_type ?? '');
  const Silian_filePath = String(Silian_attachment?.file_path ?? '').toLowerCase();
  return Silian_mimeType.startsWith('image/') || /\.(png|jpe?g|gif|webp|bmp|svg)$/.test(Silian_filePath);
}

export function getStatusTone(Silian_status) {
  switch (Silian_status) {
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

export function getPriorityVariant(Silian_priority) {
  switch (Silian_priority) {
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

export function getTagTone(Silian_color) {
  switch (Silian_color) {
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
