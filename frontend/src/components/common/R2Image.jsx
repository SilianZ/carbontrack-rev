import React, { useCallback, useEffect, useRef, useState } from 'react';
import { getPresignedReadUrl, invalidateFileUrl } from '../../lib/fileAccess';
import { resolveR2ImageSource } from '../../lib/r2Image';

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
export function R2Image({ filePath, src, alt='', className='', expiresIn=600, fallback=null, onError }) {
  const normalizedInput = resolveR2ImageSource({
    urlCandidates: [src],
    pathCandidates: [filePath],
  });
  const directSrc = normalizedInput.src;
  const resolvedFilePath = normalizedInput.filePath;

  const [resolved, setResolved] = useState(directSrc || '');
  const [err, setErr] = useState(null);
  const retryingRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    retryingRef.current = false;
    setErr(null);

    async function run() {
      if (directSrc) { setResolved(directSrc); return; }
      if (!resolvedFilePath) { setResolved(''); return; }
      try {
        const url = await getPresignedReadUrl(resolvedFilePath, expiresIn);
        if (!cancelled) {
          setResolved(url);
        }
      } catch (e) {
        if (!cancelled) {
          setErr(e);
          onError && onError(e);
        }
      }
    }

    run();
    return () => { cancelled = true; };
  }, [directSrc, resolvedFilePath, expiresIn, onError]);

  const errorClassName = ['bg-gray-100', 'text-gray-400', 'text-xs', 'flex', 'items-center', 'justify-center', className].filter(Boolean).join(' ');
  const loadingClassName = ['animate-pulse', 'bg-gray-100', className].filter(Boolean).join(' ');

  const handleImageError = useCallback(() => {
    if (!resolvedFilePath) {
      const error = err || new Error('R2Image load failed');
      setErr(error);
      onError && onError(error);
      return;
    }

    if (retryingRef.current) {
      const error = err || new Error('R2Image load failed');
      setErr(error);
      onError && onError(error);
      return;
    }

    retryingRef.current = true;
    setResolved('');
    setErr(null);
    invalidateFileUrl(resolvedFilePath);
    getPresignedReadUrl(resolvedFilePath, expiresIn)
      .then((url) => {
        setResolved(url);
        setErr(null);
      })
      .catch((error) => {
        setErr(error);
        onError && onError(error);
      });
  }, [err, expiresIn, onError, resolvedFilePath]);

  if (err) {
    return fallback || <div className={errorClassName}>ERR</div>;
  }
  if (!resolved) {
    return <div className={loadingClassName} />;
  }
  return <img src={resolved} alt={alt} className={className} onError={handleImageError} />;
}

export default R2Image;
