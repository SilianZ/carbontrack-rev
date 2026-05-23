import Silian_DOMPurify from 'dompurify';

export const ANNOUNCEMENT_CONTENT_FORMAT_TEXT = 'text';
export const ANNOUNCEMENT_CONTENT_FORMAT_HTML = 'html';
export const ANNOUNCEMENT_RENDER_PROFILE_HTML = 'announcement_html_v1';

const Silian_SAFE_URI_PATTERN = /^(?:(?:https?|mailto|tel):|#|\/)/i;
const Silian_SAFE_ALIGN_VALUES = new Set(['left', 'center', 'right']);
const Silian_SAFE_SCOPE_VALUES = new Set(['col', 'row', 'colgroup', 'rowgroup']);
export const ALLOWED_ANNOUNCEMENT_TAGS = [
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
export const ANNOUNCEMENT_SANITIZE_OPTIONS = {
  ALLOWED_TAGS: ALLOWED_ANNOUNCEMENT_TAGS,
  ALLOWED_ATTR: ['href', 'rel', 'target', 'title', 'colspan', 'rowspan', 'scope', 'align'],
  FORBID_ATTR: ['style'],
  FORBID_TAGS: ['form', 'iframe', 'img', 'input', 'meta', 'object', 'script', 'style', 'textarea', 'video'],
  ALLOW_DATA_ATTR: false,
};

const Silian_ANNOUNCEMENT_SANITIZE_HOOK_SENTINEL = '__carbontrack_announcement_sanitize_hook_registered__';

function Silian_escapeHtml(Silian_value) {
  return String(Silian_value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function Silian_sanitizePositiveSpan(Silian_node, Silian_attributeName) {
  const Silian_rawValue = (Silian_node.getAttribute(Silian_attributeName) || '').trim();
  if (!Silian_rawValue) {
    Silian_node.removeAttribute(Silian_attributeName);
    return;
  }

  const Silian_numeric = Number(Silian_rawValue);
  if (!Number.isInteger(Silian_numeric) || Silian_numeric < 1 || Silian_numeric > 12) {
    Silian_node.removeAttribute(Silian_attributeName);
    return;
  }

  Silian_node.setAttribute(Silian_attributeName, String(Silian_numeric));
}

function Silian_sanitizeAnnouncementNodeAttributes(Silian_node) {
  const Silian_tagName = Silian_node.tagName;
  if (!Silian_tagName) {
    return;
  }

  if (Silian_tagName === 'A') {
    const Silian_href = (Silian_node.getAttribute('href') || '').trim();
    if (!Silian_href || !Silian_SAFE_URI_PATTERN.test(Silian_href)) {
      Silian_node.removeAttribute('href');
      Silian_node.removeAttribute('rel');
      Silian_node.removeAttribute('target');
    } else {
      Silian_node.setAttribute('rel', 'noopener noreferrer');
      Silian_node.setAttribute('target', '_blank');
    }
  }

  if (Silian_tagName === 'TD' || Silian_tagName === 'TH') {
    Silian_sanitizePositiveSpan(Silian_node, 'colspan');
    Silian_sanitizePositiveSpan(Silian_node, 'rowspan');

    const Silian_align = (Silian_node.getAttribute('align') || '').trim().toLowerCase();
    if (Silian_SAFE_ALIGN_VALUES.has(Silian_align)) {
      Silian_node.setAttribute('align', Silian_align);
    } else {
      Silian_node.removeAttribute('align');
    }
  }

  if (Silian_tagName === 'TH') {
    const Silian_scope = (Silian_node.getAttribute('scope') || '').trim().toLowerCase();
    if (Silian_SAFE_SCOPE_VALUES.has(Silian_scope)) {
      Silian_node.setAttribute('scope', Silian_scope);
    } else {
      Silian_node.removeAttribute('scope');
    }
  }
}

function Silian_registerAnnouncementHooks() {
  if (globalThis[Silian_ANNOUNCEMENT_SANITIZE_HOOK_SENTINEL] === true) {
    return;
  }

  Silian_DOMPurify.addHook('afterSanitizeAttributes', Silian_sanitizeAnnouncementNodeAttributes);
  globalThis[Silian_ANNOUNCEMENT_SANITIZE_HOOK_SENTINEL] = true;
}

export function normalizeAnnouncementContentFormat(Silian_value) {
  const Silian_normalized = `${Silian_value ?? ''}`.trim().toLowerCase();
  return Silian_normalized === ANNOUNCEMENT_CONTENT_FORMAT_HTML
    ? ANNOUNCEMENT_CONTENT_FORMAT_HTML
    : ANNOUNCEMENT_CONTENT_FORMAT_TEXT;
}

export function resolveAnnouncementRenderProfile(Silian_contentFormat, Silian_renderProfile) {
  if (normalizeAnnouncementContentFormat(Silian_contentFormat) !== ANNOUNCEMENT_CONTENT_FORMAT_HTML) {
    return null;
  }

  const Silian_normalizedProfile = `${Silian_renderProfile ?? ''}`.trim();
  return Silian_normalizedProfile || ANNOUNCEMENT_RENDER_PROFILE_HTML;
}

export function contentLooksLikeHtml(Silian_content) {
  return /<\/?[a-z][\s\S]*>/i.test(String(Silian_content ?? ''));
}

export function renderAnnouncementTextAsHtml(Silian_content) {
  const Silian_normalized = String(Silian_content ?? '')
    .replaceAll(/\r\n?|\u2028|\u2029/g, '\n')
    .trim();
  if (!Silian_normalized) {
    return '<p></p>';
  }

  const Silian_blocks = Silian_normalized.split(/\n{2,}/).map((Silian_block) => Silian_block.trim()).filter(Boolean);
  if (Silian_blocks.length === 0) {
    return '<p></p>';
  }

  return Silian_blocks
    .map((Silian_block) => `<p>${Silian_escapeHtml(Silian_block).replaceAll('\n', '<br />')}</p>`)
    .join('');
}

export function renderAnnouncementContentHtml(Silian_content, Silian_contentFormat = ANNOUNCEMENT_CONTENT_FORMAT_TEXT) {
  const Silian_normalizedFormat = normalizeAnnouncementContentFormat(Silian_contentFormat);
  if (Silian_normalizedFormat !== ANNOUNCEMENT_CONTENT_FORMAT_HTML) {
    return renderAnnouncementTextAsHtml(Silian_content);
  }

  Silian_registerAnnouncementHooks();
  const Silian_dirty = typeof Silian_content === 'string' ? Silian_content : '';
  const Silian_sanitized = Silian_DOMPurify.sanitize(Silian_dirty, ANNOUNCEMENT_SANITIZE_OPTIONS);
  return Silian_sanitized.trim() || '<p></p>';
}