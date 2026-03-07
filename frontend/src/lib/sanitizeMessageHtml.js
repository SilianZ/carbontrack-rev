import DOMPurify from 'dompurify';

const SAFE_URI_PATTERN = /^(?:(?:https?|mailto|tel):|#|\/)/i;
const SANITIZE_OPTIONS = {
  ALLOWED_TAGS: [
    'a',
    'abbr',
    'b',
    'blockquote',
    'br',
    'code',
    'em',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'li',
    'ol',
    'p',
    'pre',
    'strong',
    'u',
    'ul',
  ],
  ALLOWED_ATTR: ['href', 'rel', 'target', 'title'],
  FORBID_ATTR: ['style'],
  FORBID_TAGS: ['form', 'iframe', 'input', 'meta', 'object', 'script', 'style', 'textarea'],
};

const MESSAGE_SANITIZE_HOOK_SENTINEL = '__carbontrack_message_sanitize_hook_registered__';

function isMessageHookRegisteredGlobally() {
  return globalThis[MESSAGE_SANITIZE_HOOK_SENTINEL] === true;
}

function markMessageHookRegisteredGlobally() {
  globalThis[MESSAGE_SANITIZE_HOOK_SENTINEL] = true;
}

function sanitizeLinkAttributes(node) {
  if (node.tagName !== 'A') {
    return;
  }

  const href = (node.getAttribute('href') || '').trim();
  if (!href || !SAFE_URI_PATTERN.test(href)) {
    node.removeAttribute('href');
  }

  if (node.hasAttribute('href')) {
    node.setAttribute('rel', 'noopener noreferrer');
    node.setAttribute('target', '_blank');
  } else {
    node.removeAttribute('rel');
    node.removeAttribute('target');
  }
}

if (!isMessageHookRegisteredGlobally()) {
  DOMPurify.addHook('afterSanitizeAttributes', sanitizeLinkAttributes);
  markMessageHookRegisteredGlobally();
}

export function sanitizeMessageHtml(content) {
  const dirty = typeof content === 'string' ? content : '';

  return DOMPurify.sanitize(dirty, {
    ...SANITIZE_OPTIONS,
    ALLOW_DATA_ATTR: false,
  });
}
