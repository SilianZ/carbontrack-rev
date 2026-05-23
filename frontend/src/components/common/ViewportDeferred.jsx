import Silian_React from 'react';

export default function ViewportDeferred({
  children: Silian_children,
  fallback: Silian_fallback = null,
  rootMargin: Silian_rootMargin = '300px 0px',
  className: Silian_className = '',
}) {
  const Silian_containerRef = Silian_React.useRef(null);
  const [Silian_shouldRender, Silian_setShouldRender] = Silian_React.useState(false);

  Silian_React.useEffect(() => {
    if (Silian_shouldRender) {
      return undefined;
    }

    const Silian_node = Silian_containerRef.current;
    if (!Silian_node) {
      return undefined;
    }

    const Silian_activate = () => {
      if (typeof Silian_React.startTransition === 'function') {
        Silian_React.startTransition(() => Silian_setShouldRender(true));
        return;
      }

      Silian_setShouldRender(true);
    };

    if (typeof window === 'undefined' || typeof window.IntersectionObserver !== 'function') {
      Silian_activate();
      return undefined;
    }

    const Silian_observer = new window.IntersectionObserver(
      (Silian_entries) => {
        if (Silian_entries.some((Silian_entry) => Silian_entry.isIntersecting)) {
          Silian_activate();
          Silian_observer.disconnect();
        }
      },
      { rootMargin: Silian_rootMargin }
    );

    Silian_observer.observe(Silian_node);

    return () => Silian_observer.disconnect();
  }, [Silian_rootMargin, Silian_shouldRender]);

  return (
    <div ref={Silian_containerRef} className={Silian_className}>
      {Silian_shouldRender ? Silian_children : Silian_fallback}
    </div>
  );
}
