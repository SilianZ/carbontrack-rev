import DOMPurify from 'dompurify';

export const ANNOUNCEMENT_CONTENT_FORMAT_TEXT = 'text';
export const ANNOUNCEMENT_CONTENT_FORMAT_HTML = 'html';
export const ANNOUNCEMENT_RENDER_PROFILE_HTML = 'announcement_html_v1';

const SAFE_URI_PATTERN = /^(?:(?:https?|mailto|tel):|#|\/)/i;
const SAFE_ALIGN_VALUES = new Set(['left', 'center', 'right']);
const SAFE_SCOPE_VALUES = new Set(['col', 'row', 'colgroup', 'rowgroup']);
const ALLOWED_ANNOUNCEMENT_TAGS = [
  'a',
  'abbr',
  'b',
  'blockquote',
  'br',
  'caption',
  'code',
  'col',
  'colgroup',
  'div',
  'em',
  'h1',
  'h2',
  'h3',
  'h4',
  'hr',
  'i',
  'li',
  'ol',
  'p',
  'pre',
  'strong',
  'table',
  'tbody',
  'td',
  'th',
  'thead',
  'tr',
  'u',
  'ul',
];
const ANNOUNCEMENT_SANITIZE_OPTIONS = {
  ALLOWED_TAGS: ALLOWED_ANNOUNCEMENT_TAGS,
  ALLOWED_ATTR: ['href', 'rel', 'target', 'title', 'colspan', 'rowspan', 'scope', 'align'],
  FORBID_ATTR: ['style'],
  FORBID_TAGS: ['form', 'iframe', 'img', 'input', 'meta', 'object', 'script', 'style', 'textarea', 'video'],
  ALLOW_DATA_ATTR: false,
};

const ANNOUNCEMENT_SANITIZE_HOOK_SENTINEL = '__carbontrack_announcement_sanitize_hook_registered__';

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function sanitizePositiveSpan(node, attributeName) {
  const rawValue = (node.getAttribute(attributeName) || '').trim();
  if (!rawValue) {
    node.removeAttribute(attributeName);
    return;
  }

  const numeric = Number(rawValue);
  if (!Number.isInteger(numeric) || numeric < 1 || numeric > 12) {
    node.removeAttribute(attributeName);
    return;
  }

  node.setAttribute(attributeName, String(numeric));
}

function sanitizeAnnouncementNodeAttributes(node) {
  const tagName = node.tagName;
  if (!tagName) {
    return;
  }

  if (tagName === 'A') {
    const href = (node.getAttribute('href') || '').trim();
    if (!href || !SAFE_URI_PATTERN.test(href)) {
      node.removeAttribute('href');
      node.removeAttribute('rel');
      node.removeAttribute('target');
    } else {
      node.setAttribute('rel', 'noopener noreferrer');
      node.setAttribute('target', '_blank');
    }
  }

  if (tagName === 'TD' || tagName === 'TH') {
    sanitizePositiveSpan(node, 'colspan');
    sanitizePositiveSpan(node, 'rowspan');

    const align = (node.getAttribute('align') || '').trim().toLowerCase();
    if (SAFE_ALIGN_VALUES.has(align)) {
      node.setAttribute('align', align);
    } else {
      node.removeAttribute('align');
    }
  }

  if (tagName === 'TH') {
    const scope = (node.getAttribute('scope') || '').trim().toLowerCase();
    if (SAFE_SCOPE_VALUES.has(scope)) {
      node.setAttribute('scope', scope);
    } else {
      node.removeAttribute('scope');
    }
  }
}

function registerAnnouncementHooks() {
  if (globalThis[ANNOUNCEMENT_SANITIZE_HOOK_SENTINEL] === true) {
    return;
  }

  DOMPurify.addHook('afterSanitizeAttributes', sanitizeAnnouncementNodeAttributes);
  globalThis[ANNOUNCEMENT_SANITIZE_HOOK_SENTINEL] = true;
}

export function normalizeAnnouncementContentFormat(value) {
  const normalized = `${value ?? ''}`.trim().toLowerCase();
  return normalized === ANNOUNCEMENT_CONTENT_FORMAT_HTML
    ? ANNOUNCEMENT_CONTENT_FORMAT_HTML
    : ANNOUNCEMENT_CONTENT_FORMAT_TEXT;
}

export function resolveAnnouncementRenderProfile(contentFormat, renderProfile) {
  if (normalizeAnnouncementContentFormat(contentFormat) !== ANNOUNCEMENT_CONTENT_FORMAT_HTML) {
    return null;
  }

  const normalizedProfile = `${renderProfile ?? ''}`.trim();
  return normalizedProfile || ANNOUNCEMENT_RENDER_PROFILE_HTML;
}

export function contentLooksLikeHtml(content) {
  return /<\/?[a-z][\s\S]*>/i.test(String(content ?? ''));
}

export function renderAnnouncementTextAsHtml(content) {
  const normalized = String(content ?? '')
    .replaceAll(/\r\n?|\u2028|\u2029/g, '\n')
    .trim();
  if (!normalized) {
    return '<p></p>';
  }

  const blocks = normalized.split(/\n{2,}/).map((block) => block.trim()).filter(Boolean);
  if (blocks.length === 0) {
    return '<p></p>';
  }

  return blocks
    .map((block) => `<p>${escapeHtml(block).replaceAll('\n', '<br />')}</p>`)
    .join('');
}

export function renderAnnouncementContentHtml(content, contentFormat = ANNOUNCEMENT_CONTENT_FORMAT_TEXT) {
  const normalizedFormat = normalizeAnnouncementContentFormat(contentFormat);
  if (normalizedFormat !== ANNOUNCEMENT_CONTENT_FORMAT_HTML) {
    return renderAnnouncementTextAsHtml(content);
  }

  registerAnnouncementHooks();
  const dirty = typeof content === 'string' ? content : '';
  const sanitized = DOMPurify.sanitize(dirty, ANNOUNCEMENT_SANITIZE_OPTIONS);
  return sanitized.trim() || '<p></p>';
}