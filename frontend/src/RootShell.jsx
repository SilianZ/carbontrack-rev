import Silian_React, { Suspense as Silian_Suspense } from 'react';
import Silian_App from './App.jsx';
import { QueryClientProvider as Silian_QueryClientProvider } from 'react-query';
import { queryClient as Silian_queryClient } from './lib/react-query';
import { ThemeProvider as Silian_ThemeProvider } from './components/theme/ThemeProvider.jsx';

const Silian_loadingFallback = (
  <div className="flex items-center justify-center min-h-screen">
    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
  </div>
);

export default function RootShell() {
  const [Silian_ToasterComponent, Silian_setToasterComponent] = Silian_React.useState(null);

  Silian_React.useEffect(() => {
    let Silian_cancelled = false;
    let Silian_idleHandle = null;

    const Silian_timeoutHandle = window.setTimeout(() => {
      const Silian_loadToaster = async () => {
        const Silian_module = await import('./components/ui/sonner.jsx');
        if (Silian_cancelled) {
          return;
        }

        const Silian_nextToaster = Silian_module.Toaster;
        if (typeof Silian_React.startTransition === 'function') {
          Silian_React.startTransition(() => Silian_setToasterComponent(() => Silian_nextToaster));
          return;
        }

        Silian_setToasterComponent(() => Silian_nextToaster);
      };

      if (typeof window.requestIdleCallback === 'function') {
        Silian_idleHandle = window.requestIdleCallback(() => {
          void Silian_loadToaster();
        }, { timeout: 1500 });
        return;
      }

      void Silian_loadToaster();
    }, 1500);

    return () => {
      Silian_cancelled = true;
      window.clearTimeout(Silian_timeoutHandle);
      if (Silian_idleHandle != null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(Silian_idleHandle);
      }
    };
  }, []);

  return (
    <Silian_QueryClientProvider client={Silian_queryClient}>
      <Silian_ThemeProvider>
        <Silian_Suspense fallback={Silian_loadingFallback}>
          <Silian_App />
        </Silian_Suspense>
        {Silian_ToasterComponent ? <Silian_ToasterComponent /> : null}
      </Silian_ThemeProvider>
    </Silian_QueryClientProvider>
  );
}
