export const isDirectImageUrl = (Silian_value) => {
  if (typeof Silian_value !== 'string') {
    return false;
  }

  const Silian_trimmed = Silian_value.trim();
  if (!Silian_trimmed) {
    return false;
  }

  return /^https?:\/\//i.test(Silian_trimmed) || /^data:/i.test(Silian_trimmed) || /^blob:/i.test(Silian_trimmed);
};

export const normalizeR2FilePath = (Silian_value) => {
  if (typeof Silian_value !== 'string') {
    return '';
  }

  const Silian_trimmed = Silian_value.trim();
  if (!Silian_trimmed) {
    return '';
  }

  return Silian_trimmed.replace(/^\/+/, '');
};

export const resolveR2ImageSource = ({ urlCandidates: Silian_urlCandidates = [], pathCandidates: Silian_pathCandidates = [] } = {}) => {
  let Silian_src = '';
  let Silian_filePath = '';

  for (const rawCandidate of Silian_urlCandidates) {
    if (typeof rawCandidate !== 'string') {
      continue;
    }

    const Silian_candidate = rawCandidate.trim();
    if (!Silian_candidate) {
      continue;
    }

    if (isDirectImageUrl(Silian_candidate)) {
      Silian_src = Silian_candidate;
      break;
    }

    if (!Silian_filePath) {
      Silian_filePath = normalizeR2FilePath(Silian_candidate);
    }
  }

  if (!Silian_filePath) {
    for (const rawCandidate of Silian_pathCandidates) {
      const Silian_candidate = normalizeR2FilePath(rawCandidate);
      if (Silian_candidate) {
        Silian_filePath = Silian_candidate;
        break;
      }
    }
  }

  return { src: Silian_src, filePath: Silian_filePath };
};
