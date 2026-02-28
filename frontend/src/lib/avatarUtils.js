const isHttpUrl = (value) => /^https?:\/\//i.test(value);

const cleanPath = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  return trimmed.replace(/^\/+/, '');
};

const normalizeString = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed || '';
};

export const resolveAvatarAsset = (input) => {
  if (!input || typeof input !== 'object') {
    return { src: '', filePath: '', alt: '' };
  }

  const urlCandidates = [
    normalizeString(input.icon_url),
    normalizeString(input.url),
    normalizeString(input.avatar_url),
    normalizeString(input.image_url),
    normalizeString(input.icon_presigned_url),
    normalizeString(input.presigned_url),
    normalizeString(input.avatar_presigned_url),
  ];

  let src = '';
  let filePath = '';

  for (const candidate of urlCandidates) {
    if (!candidate) continue;
    if (isHttpUrl(candidate) || candidate.startsWith('data:')) {
      src = candidate;
      break;
    }
    if (!filePath) {
      filePath = cleanPath(candidate);
    }
  }

  if (!src) {
    const pathCandidates = [
      normalizeString(input.file_path),
      normalizeString(input.icon_path),
      normalizeString(input.avatar_path),
    ];

    for (const candidate of pathCandidates) {
      if (!candidate) continue;
      const cleaned = cleanPath(candidate);
      if (cleaned) {
        filePath = cleaned;
        break;
      }
    }
  }

  return {
    src,
    filePath,
    alt: normalizeString(input.name || input.username || input.title || ''),
  };
};

export const buildAvatarDisplayProps = (input) => {
  const { src, filePath, alt } = resolveAvatarAsset(input);
  const fallbackInitial = alt ? alt.charAt(0).toUpperCase() : '';
  return {
    src,
    filePath,
    alt,
    fallbackInitial,
  };
};
