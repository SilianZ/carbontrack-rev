import React, { useMemo, useState } from 'react';
import PropTypes from 'prop-types';
import { X, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import R2Image from './R2Image';

/**
 * 通用图片预览组件
 * props:
 *  images: Array<{url?:string, public_url?:string, file_path?:string, original_name?:string, presigned_url?:string} | string>
 *  maxThumbnails?: number
 *  size?: 'sm'|'md'
 */
export function ImagePreviewGallery({ images, maxThumbnails = 3, size = 'sm', className = '' }) {
  const { t } = useTranslation();
  const [lightboxIndex, setLightboxIndex] = useState(-1);

  const normalized = useMemo(() => {
    if (!Array.isArray(images)) {
      return [];
    }
    return images
      .map((raw) => {
        const base = typeof raw === 'string' ? { url: raw } : (raw || {});
        const url = base.public_url ?? base.url ?? null;
        const filePath = typeof base.file_path === 'string' ? base.file_path : null;
        const presignedUrl = base.presigned_url ?? null;
        return {
          ...base,
          url,
          file_path: filePath ? filePath.replace(/^\/+/, '') : null,
          presigned_url: presignedUrl,
          original_name: base.original_name || base.name || null,
        };
      })
      .filter((item) => item && (item.url || item.file_path || item.presigned_url));
  }, [images]);

  if (!normalized.length) {
    return (
      <div className={`text-xs text-gray-400 italic flex items-center gap-1 ${className}`}>
        <ImageIcon className="h-3 w-3" /> {t('images.none', 'No images')}
      </div>
    );
  }

  const thumbSizeClass = size === 'sm' ? 'h-12 w-12' : 'h-20 w-20';
  const toDisplay = normalized.slice(0, maxThumbnails);
  const overflow = normalized.length - toDisplay.length;

  const resolveKey = (img, idx) => img.file_path || img.url || `image-${idx}`;
  const resolveSrc = (img) => (img.url && /^https?:\/\//i.test(img.url) ? img.url : img.presigned_url || undefined);

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {toDisplay.map((img, idx) => (
        <button
          key={resolveKey(img, idx)}
          type="button"
          className={`relative border rounded-md overflow-hidden bg-gray-50 hover:ring-2 hover:ring-green-500 transition ${thumbSizeClass}`}
          onClick={() => setLightboxIndex(idx)}
          title={img.original_name || t('images.clickToPreview', 'Click to preview')}
        >
          <R2Image
            src={resolveSrc(img)}
            filePath={img.file_path || undefined}
            alt={img.original_name || `image-${idx}`}
            className="object-cover w-full h-full"
            fallback={<div className="w-full h-full bg-gray-100 text-gray-400 text-[10px] flex items-center justify-center">IMG</div>}
          />
          {overflow > 0 && idx === toDisplay.length - 1 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-semibold">
              +{overflow}
            </div>
          )}
        </button>
      ))}

      {lightboxIndex >= 0 && (
        <div className="fixed inset-0 z-50 bg-black/70 flex flex-col">
          <div className="flex justify-end p-3">
            <button
              onClick={() => setLightboxIndex(-1)}
              className="text-white/80 hover:text-white p-2"
              aria-label={t('common.close', 'Close')}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 pb-6 select-none">
            <button
              disabled={lightboxIndex === 0}
              onClick={() => setLightboxIndex((current) => Math.max(0, current - 1))}
              className="p-3 text-white/70 hover:text-white disabled:opacity-30"
              aria-label={t('images.prev', 'Previous')}
            >
              <ChevronLeft className="h-10 w-10" />
            </button>
            <div className="max-h-[75vh] max-w-[85vw] flex items-center justify-center">
              <R2Image
                key={resolveKey(normalized[lightboxIndex], lightboxIndex)}
                src={resolveSrc(normalized[lightboxIndex])}
                filePath={normalized[lightboxIndex].file_path || undefined}
                alt={normalized[lightboxIndex].original_name || `image-${lightboxIndex}`}
                className="max-h-[75vh] max-w-[85vw] object-contain shadow-2xl rounded-md"
                fallback={<div className="max-h-[75vh] max-w-[85vw] bg-black/30 text-white text-xs flex items-center justify-center rounded-md">IMG</div>}
              />
            </div>
            <button
              disabled={lightboxIndex === normalized.length - 1}
              onClick={() => setLightboxIndex((current) => Math.min(normalized.length - 1, current + 1))}
              className="p-3 text-white/70 hover:text-white disabled:opacity-30"
              aria-label={t('images.next', 'Next')}
            >
              <ChevronRight className="h-10 w-10" />
            </button>
          </div>
          <div className="pb-4 text-center text-white text-xs opacity-80">
            {t('images.counter', '{{current}} / {{total}}', { current: lightboxIndex + 1, total: normalized.length })}
          </div>
        </div>
      )}
    </div>
  );
}

ImagePreviewGallery.propTypes = {
  images: PropTypes.any,
  maxThumbnails: PropTypes.number,
  size: PropTypes.oneOf(['sm', 'md']),
  className: PropTypes.string,
};

export default ImagePreviewGallery;
