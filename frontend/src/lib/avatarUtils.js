import { resolveR2ImageSource } from './r2Image';

const normalizeString = (value) => {
  if (typeof value !== 'string') return '';
  const trimmed = value.trim();
  return trimmed || '';
};

export const resolveAvatarAsset = (input) => {
  if (!input || typeof input !== 'object') {
    return { src: '', filePath: '', alt: '' };
  }

  const { src, filePath } = resolveR2ImageSource({
    urlCandidates: [
      normalizeString(input.icon_url),
      normalizeString(input.url),
      normalizeString(input.avatar_url),
      normalizeString(input.image_url),
      normalizeString(input.icon_presigned_url),
      normalizeString(input.presigned_url),
      normalizeString(input.avatar_presigned_url),
    ],
    pathCandidates: [
      normalizeString(input.file_path),
      normalizeString(input.icon_path),
      normalizeString(input.avatar_path),
    ],
  });

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
