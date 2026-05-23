import Silian_React, { useCallback as Silian_useCallback, useEffect as Silian_useEffect, useRef as Silian_useRef, useState as Silian_useState } from 'react';
import { Image as Silian_ImageIcon } from 'lucide-react';
import { getPresignedReadUrl as Silian_getPresignedReadUrl, invalidateFileUrl as Silian_invalidateFileUrl } from '../../lib/fileAccess';
import { resolveR2ImageSource as Silian_resolveR2ImageSource } from '../../lib/r2Image';

/**
 * 通用私有R2图片组件
 * props:
 *  filePath?: string  (优先: 直接的 file_path)
 *  src?: string       (公网 URL 直接使用；非 URL 字符串会回退为 file_path)
 *  alt?: string
 *  className?: string
 *  expiresIn?: number (秒)
 *  fallback?: ReactNode
 *  onError?: (err)=>void
 */
export function R2Image({ filePath: Silian_filePath, src: Silian_src, alt: Silian_alt='', className: Silian_className='', expiresIn: Silian_expiresIn=600, fallback: Silian_fallback=null, onError: Silian_onError }) {
  const Silian_normalizedInput = Silian_resolveR2ImageSource({
    urlCandidates: [Silian_src],
    pathCandidates: [Silian_filePath],
  });
  const Silian_directSrc = Silian_normalizedInput.src;
  const Silian_resolvedFilePath = Silian_normalizedInput.filePath;

  const [Silian_resolved, Silian_setResolved] = Silian_useState(Silian_directSrc || '');
  const [Silian_err, Silian_setErr] = Silian_useState(null);
  const Silian_retryingRef = Silian_useRef(false);

  Silian_useEffect(() => {
    let Silian_cancelled = false;
    Silian_retryingRef.current = false;
    Silian_setErr(null);

    async function Silian_run() {
      if (Silian_directSrc) { Silian_setResolved(Silian_directSrc); return; }
      if (!Silian_resolvedFilePath) { Silian_setResolved(''); return; }
      try {
        const Silian_url = await Silian_getPresignedReadUrl(Silian_resolvedFilePath, Silian_expiresIn);
        if (!Silian_cancelled) {
          Silian_setResolved(Silian_url);
        }
      } catch (Silian_e) {
        if (!Silian_cancelled) {
          Silian_setErr(Silian_e);
          Silian_onError && Silian_onError(Silian_e);
        }
      }
    }

    Silian_run();
    return () => { Silian_cancelled = true; };
  }, [Silian_directSrc, Silian_resolvedFilePath, Silian_expiresIn, Silian_onError]);

  const Silian_errorClassName = ['bg-muted', 'text-muted-foreground', 'text-xs', 'flex', 'items-center', 'justify-center', Silian_className].filter(Boolean).join(' ');
  const Silian_loadingClassName = ['animate-pulse', 'bg-muted', Silian_className].filter(Boolean).join(' ');

  const Silian_handleImageError = Silian_useCallback(() => {
    if (!Silian_resolvedFilePath) {
      const Silian_error = Silian_err || new Error('R2Image load failed');
      Silian_setErr(Silian_error);
      Silian_onError && Silian_onError(Silian_error);
      return;
    }

    if (Silian_retryingRef.current) {
      const Silian_error = Silian_err || new Error('R2Image load failed');
      Silian_setErr(Silian_error);
      Silian_onError && Silian_onError(Silian_error);
      return;
    }

    Silian_retryingRef.current = true;
    Silian_setResolved('');
    Silian_setErr(null);
    Silian_invalidateFileUrl(Silian_resolvedFilePath);
    Silian_getPresignedReadUrl(Silian_resolvedFilePath, Silian_expiresIn)
      .then((Silian_url) => {
        Silian_setResolved(Silian_url);
        Silian_setErr(null);
      })
      .catch((Silian_error) => {
        Silian_setErr(Silian_error);
        Silian_onError && Silian_onError(Silian_error);
      });
  }, [Silian_err, Silian_expiresIn, Silian_onError, Silian_resolvedFilePath]);

  if (Silian_err) {
    return Silian_fallback || (
      <div className={Silian_errorClassName}>
        <div className="flex flex-col items-center justify-center gap-1">
          <Silian_ImageIcon className="h-4 w-4" />
          <span>IMG</span>
        </div>
      </div>
    );
  }
  if (!Silian_resolved) {
    return <div className={Silian_loadingClassName} />;
  }
  return <img src={Silian_resolved} alt={Silian_alt} className={Silian_className} onError={Silian_handleImageError} />;
}

export default R2Image;
