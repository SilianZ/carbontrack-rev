export const isDirectImageUrl = (value) => {
  if (typeof value !== 'string') {
    return false;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return false;
  }

  return /^https?:\/\//i.test(trimmed) || /^data:/i.test(trimmed) || /^blob:/i.test(trimmed);
};

export const normalizeR2FilePath = (value) => {
  if (typeof value !== 'string') {
    return '';
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return '';
  }

  return trimmed.replace(/^\/+/, '');
};

export const resolveR2ImageSource = ({ urlCandidates = [], pathCandidates = [] } = {}) => {
  let src = '';
  let filePath = '';

  for (const rawCandidate of urlCandidates) {
    if (typeof rawCandidate !== 'string') {
      continue;
    }

    const candidate = rawCandidate.trim();
    if (!candidate) {
      continue;
    }

    if (isDirectImageUrl(candidate)) {
      src = candidate;
      break;
    }

    if (!filePath) {
      filePath = normalizeR2FilePath(candidate);
    }
  }

  if (!filePath) {
    for (const rawCandidate of pathCandidates) {
      const candidate = normalizeR2FilePath(rawCandidate);
      if (candidate) {
        filePath = candidate;
        break;
      }
    }
  }

  return { src, filePath };
};
