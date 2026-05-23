const Silian_ANNOUNCEMENT_TITLE_PATTERN = /(公告|系统|\b(?:announcement|system|broadcast|boardcast)\b)/i;

export function isAnnouncementMessage(Silian_message) {
  if (!Silian_message) {
    return false;
  }

  if (Silian_message.type === 'system') {
    return true;
  }

  if (Silian_message.sender_id !== null) {
    return false;
  }

  const Silian_title = typeof Silian_message.title === 'string' ? Silian_message.title : '';
  return Silian_ANNOUNCEMENT_TITLE_PATTERN.test(Silian_title.toLowerCase());
}

export { Silian_ANNOUNCEMENT_TITLE_PATTERN as ANNOUNCEMENT_TITLE_PATTERN };