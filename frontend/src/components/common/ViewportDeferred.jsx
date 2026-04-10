import React from 'react';

export default function ViewportDeferred({
  children,
  fallback = null,
  rootMargin = '300px 0px',
  className = '',
}) {
  const containerRef = React.useRef(null);
  const [shouldRender, setShouldRender] = React.useState(false);

  React.useEffect(() => {
    if (shouldRender) {
      return undefined;
    }

    const node = containerRef.current;
    if (!node) {
      return undefined;
    }

    const activate = () => {
      if (typeof React.startTransition === 'function') {
        React.startTransition(() => setShouldRender(true));
        return;
      }

      setShouldRender(true);
    };

    if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
      activate();
      return undefined;
    }

    const observer = new window.IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          activate();
          observer.disconnect();
        }
      },
      { rootMargin }
    );

    observer.observe(node);

    return () => observer.disconnect();
  }, [rootMargin, shouldRender]);

  return (
    <div ref={containerRef} className={className}>
      {shouldRender ? children : fallback}
    </div>
  );
}
