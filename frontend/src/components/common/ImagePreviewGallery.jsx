import Silian_React, { useMemo as Silian_useMemo, useState as Silian_useState } from 'react';
import Silian_PropTypes from 'prop-types';
import { X as Silian_X, ChevronLeft as Silian_ChevronLeft, ChevronRight as Silian_ChevronRight, Image as Silian_ImageIcon } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import Silian_R2Image from './R2Image';

/**
 * 通用图片预览组件
 * props:
 *  images: Array<{url?:string, public_url?:string, file_path?:string, original_name?:string, presigned_url?:string} | string>
 *  maxThumbnails?: number
 *  size?: 'sm'|'md'
 */
export function ImagePreviewGallery({ images: Silian_images, maxThumbnails: Silian_maxThumbnails = 3, size: Silian_size = 'sm', className: Silian_className = '' }) {
  const { t: Silian_t } = Silian_useTranslation(['common', 'images']);
  const [Silian_lightboxIndex, Silian_setLightboxIndex] = Silian_useState(-1);

  const Silian_normalized = Silian_useMemo(() => {
    if (!Array.isArray(Silian_images)) {
      return [];
    }
    return Silian_images
      .map((Silian_raw) => {
        const Silian_base = typeof Silian_raw === 'string' ? { url: Silian_raw } : (Silian_raw || {});
        const Silian_url = Silian_base.public_url ?? Silian_base.url ?? null;
        const Silian_filePath = typeof Silian_base.file_path === 'string' ? Silian_base.file_path : null;
        const Silian_presignedUrl = Silian_base.presigned_url ?? null;
        return {
          ...Silian_base,
          url: Silian_url,
          file_path: Silian_filePath ? Silian_filePath.replace(/^\/+/, '') : null,
          presigned_url: Silian_presignedUrl,
          original_name: Silian_base.original_name || Silian_base.name || null,
        };
      })
      .filter((Silian_item) => Silian_item && (Silian_item.url || Silian_item.file_path || Silian_item.presigned_url));
  }, [Silian_images]);

  if (!Silian_normalized.length) {
    return (
      <div className={`flex items-center gap-1 text-xs italic text-muted-foreground ${Silian_className}`}>
        <Silian_ImageIcon className="h-3 w-3" /> {Silian_t('images.none')}
      </div>
    );
  }

  const Silian_thumbSizeClass = Silian_size === 'sm' ? 'h-12 w-12' : 'h-20 w-20';
  const Silian_toDisplay = Silian_normalized.slice(0, Silian_maxThumbnails);
  const Silian_overflow = Silian_normalized.length - Silian_toDisplay.length;

  const Silian_resolveKey = (Silian_img, Silian_idx) => Silian_img.file_path || Silian_img.url || `image-${Silian_idx}`;
  const Silian_resolveSrc = (Silian_img) => (Silian_img.url && /^https?:\/\//i.test(Silian_img.url) ? Silian_img.url : Silian_img.presigned_url || undefined);

  return (
    <div className={`flex items-center gap-2 ${Silian_className}`}>
      {Silian_toDisplay.map((Silian_img, Silian_idx) => (
        <button
          key={Silian_resolveKey(Silian_img, Silian_idx)}
          type="button"
          className={`relative overflow-hidden rounded-md border border-border bg-muted/50 transition hover:ring-2 hover:ring-green-500 ${Silian_thumbSizeClass}`}
          onClick={() => Silian_setLightboxIndex(Silian_idx)}
          title={Silian_img.original_name || Silian_t('images.clickToPreview')}
        >
          <Silian_R2Image
            src={Silian_resolveSrc(Silian_img)}
            filePath={Silian_img.file_path || undefined}
            alt={Silian_img.original_name || `image-${Silian_idx}`}
            className="object-cover w-full h-full"
            fallback={<div className="flex h-full w-full items-center justify-center bg-muted text-[10px] text-muted-foreground">IMG</div>}
          />
          {Silian_overflow > 0 && Silian_idx === Silian_toDisplay.length - 1 && (
            <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-xs font-semibold">
              +{Silian_overflow}
            </div>
          )}
        </button>
      ))}

      {Silian_lightboxIndex >= 0 && (
        <div className="fixed inset-0 z-50 bg-black/70 flex flex-col">
          <div className="flex justify-end p-3">
            <button
              onClick={() => Silian_setLightboxIndex(-1)}
              className="text-white/80 hover:text-white p-2"
              aria-label={Silian_t('common.close')}
            >
              <Silian_X className="h-6 w-6" />
            </button>
          </div>
          <div className="flex-1 flex items-center justify-center px-4 pb-6 select-none">
            <button
              disabled={Silian_lightboxIndex === 0}
              onClick={() => Silian_setLightboxIndex((Silian_current) => Math.max(0, Silian_current - 1))}
              className="p-3 text-white/70 hover:text-white disabled:opacity-30"
              aria-label={Silian_t('images.prev')}
            >
              <Silian_ChevronLeft className="h-10 w-10" />
            </button>
            <div className="max-h-[75vh] max-w-[85vw] flex items-center justify-center">
              <Silian_R2Image
                key={Silian_resolveKey(Silian_normalized[Silian_lightboxIndex], Silian_lightboxIndex)}
                src={Silian_resolveSrc(Silian_normalized[Silian_lightboxIndex])}
                filePath={Silian_normalized[Silian_lightboxIndex].file_path || undefined}
                alt={Silian_normalized[Silian_lightboxIndex].original_name || `image-${Silian_lightboxIndex}`}
                className="max-h-[75vh] max-w-[85vw] object-contain shadow-2xl rounded-md"
                fallback={<div className="max-h-[75vh] max-w-[85vw] bg-black/30 text-white text-xs flex items-center justify-center rounded-md">IMG</div>}
              />
            </div>
            <button
              disabled={Silian_lightboxIndex === Silian_normalized.length - 1}
              onClick={() => Silian_setLightboxIndex((Silian_current) => Math.min(Silian_normalized.length - 1, Silian_current + 1))}
              className="p-3 text-white/70 hover:text-white disabled:opacity-30"
              aria-label={Silian_t('images.next')}
            >
              <Silian_ChevronRight className="h-10 w-10" />
            </button>
          </div>
          <div className="pb-4 text-center text-white text-xs opacity-80">
            {Silian_t('images.counter',  { current: Silian_lightboxIndex + 1, total: Silian_normalized.length })}
          </div>
        </div>
      )}
    </div>
  );
}

ImagePreviewGallery.propTypes = {
  images: Silian_PropTypes.any,
  maxThumbnails: Silian_PropTypes.number,
  size: Silian_PropTypes.oneOf(['sm', 'md']),
  className: Silian_PropTypes.string,
};

export default ImagePreviewGallery;
