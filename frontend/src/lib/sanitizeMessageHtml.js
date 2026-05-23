import Silian_DOMPurify from 'dompurify';

const Silian_SAFE_URI_PATTERN = /^(?:(?:https?|mailto|tel):|#|\/)/i;
const Silian_SANITIZE_OPTIONS = {
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

const Silian_MESSAGE_SANITIZE_HOOK_SENTINEL = '__carbontrack_message_sanitize_hook_registered__';

function Silian_isMessageHookRegisteredGlobally() {
  return globalThis[Silian_MESSAGE_SANITIZE_HOOK_SENTINEL] === true;
}

function Silian_markMessageHookRegisteredGlobally() {
  globalThis[Silian_MESSAGE_SANITIZE_HOOK_SENTINEL] = true;
}

function Silian_sanitizeLinkAttributes(Silian_node) {
  if (Silian_node.tagName !== 'A') {
    return;
  }

  const Silian_href = (Silian_node.getAttribute('href') || '').trim();
  if (!Silian_href || !Silian_SAFE_URI_PATTERN.test(Silian_href)) {
    Silian_node.removeAttribute('href');
  }

  if (Silian_node.hasAttribute('href')) {
    Silian_node.setAttribute('rel', 'noopener noreferrer');
    Silian_node.setAttribute('target', '_blank');
  } else {
    Silian_node.removeAttribute('rel');
    Silian_node.removeAttribute('target');
  }
}

if (!Silian_isMessageHookRegisteredGlobally()) {
  Silian_DOMPurify.addHook('afterSanitizeAttributes', Silian_sanitizeLinkAttributes);
  Silian_markMessageHookRegisteredGlobally();
}

export function sanitizeMessageHtml(Silian_content) {
  const Silian_dirty = typeof Silian_content === 'string' ? Silian_content : '';

  return Silian_DOMPurify.sanitize(Silian_dirty, {
    ...Silian_SANITIZE_OPTIONS,
    ALLOW_DATA_ATTR: false,
  });
}
