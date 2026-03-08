const ANNOUNCEMENT_TITLE_PATTERN = /(公告|系统|\b(?:announcement|system|broadcast|boardcast)\b)/i;

export function isAnnouncementMessage(message) {
  if (!message) {
    return false;
  }

  if (message.type === 'system') {
    return true;
  }

  if (message.sender_id !== null) {
    return false;
  }

  const title = typeof message.title === 'string' ? message.title : '';
  return ANNOUNCEMENT_TITLE_PATTERN.test(title.toLowerCase());
}

export { ANNOUNCEMENT_TITLE_PATTERN };