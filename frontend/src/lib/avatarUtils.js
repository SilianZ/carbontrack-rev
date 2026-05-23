import { resolveR2ImageSource as Silian_resolveR2ImageSource } from './r2Image';

const Silian_normalizeString = (Silian_value) => {
  if (typeof Silian_value !== 'string') return '';
  const Silian_trimmed = Silian_value.trim();
  return Silian_trimmed || '';
};

export const resolveAvatarAsset = (Silian_input) => {
  if (!Silian_input || typeof Silian_input !== 'object') {
    return { src: '', filePath: '', alt: '' };
  }

  const { src: Silian_src, filePath: Silian_filePath } = Silian_resolveR2ImageSource({
    urlCandidates: [
      Silian_normalizeString(Silian_input.icon_url),
      Silian_normalizeString(Silian_input.url),
      Silian_normalizeString(Silian_input.avatar_url),
      Silian_normalizeString(Silian_input.image_url),
      Silian_normalizeString(Silian_input.icon_presigned_url),
      Silian_normalizeString(Silian_input.presigned_url),
      Silian_normalizeString(Silian_input.avatar_presigned_url),
    ],
    pathCandidates: [
      Silian_normalizeString(Silian_input.file_path),
      Silian_normalizeString(Silian_input.icon_path),
      Silian_normalizeString(Silian_input.avatar_path),
    ],
  });

  return {
    src: Silian_src,
    filePath: Silian_filePath,
    alt: Silian_normalizeString(Silian_input.name || Silian_input.username || Silian_input.title || ''),
  };
};

export const buildAvatarDisplayProps = (Silian_input) => {
  const { src: Silian_src, filePath: Silian_filePath, alt: Silian_alt } = resolveAvatarAsset(Silian_input);
  const Silian_fallbackInitial = Silian_alt ? Silian_alt.charAt(0).toUpperCase() : '';
  return {
    src: Silian_src,
    filePath: Silian_filePath,
    alt: Silian_alt,
    fallbackInitial: Silian_fallbackInitial,
  };
};
