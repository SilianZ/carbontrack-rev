import React, { Suspense } from 'react';
import App from './App.jsx';
import { QueryClientProvider } from 'react-query';
import { queryClient } from './lib/react-query';
import { ThemeProvider } from './components/theme/ThemeProvider.jsx';

const loadingFallback = (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

export default function RootShell() {
  const [ToasterComponent, setToasterComponent] = React.useState(null);

  React.useEffect(() => {
    let cancelled = false;
    let idleHandle = null;

    const timeoutHandle = window.setTimeout(() => {
      const loadToaster = async () => {
        const module = await import('./components/ui/sonner.jsx');
        if (cancelled) {
          return;
        }

        const nextToaster = module.Toaster;
        if (typeof React.startTransition === 'function') {
          React.startTransition(() => setToasterComponent(() => nextToaster));
          return;
        }

        setToasterComponent(() => nextToaster);
      };

      if (typeof window.requestIdleCallback === 'function') {
        idleHandle = window.requestIdleCallback(() => {
          void loadToaster();
        }, { timeout: 1500 });
        return;
      }

      void loadToaster();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutHandle);
      if (idleHandle != null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle);
      }
    };
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider>
        <Suspense fallback={loadingFallback}>
          <App />
        </Suspense>
        {ToasterComponent ? <ToasterComponent /> : null}
      </ThemeProvider>
    </QueryClientProvider>
  );
}
