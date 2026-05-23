import Silian_React from 'react';
import { Outlet as Silian_Outlet, useLocation as Silian_useLocation } from 'react-router-dom';
import { Navbar as Silian_Navbar } from './Navbar';
import Silian_RouteErrorBoundary from '../common/RouteErrorBoundary';
import Silian_PropTypes from 'prop-types';
import Silian_i18n from '../../lib/i18n';

const Silian_Footer = Silian_React.lazy(() => import('./Footer').then((Silian_module) => ({ default: Silian_module.Footer })));

export function Layout({ showFooter: Silian_showFooter = true }) {
  const Silian_location = Silian_useLocation();
  const Silian_isHomeRoute = Silian_location.pathname === '/';
  const [Silian_showDeferredFooter, Silian_setShowDeferredFooter] = Silian_React.useState(false);

  const Silian_t = Silian_React.useCallback((Silian_key) => {
    const Silian_fallbackMap = {
      'errors.unexpected': '发生未知错误',
      'errors.tryAgain': '请稍后重试或刷新页面',
      'common.retry': '重试',
    };

    return Silian_i18n.t(Silian_key, { defaultValue: Silian_fallbackMap[Silian_key] || Silian_key });
  }, []);

  Silian_React.useEffect(() => {
    if (!Silian_showFooter || Silian_showDeferredFooter) {
      return undefined;
    }

    let Silian_cancelled = false;
    let Silian_idleHandle = null;
    const Silian_timeoutHandle = window.setTimeout(() => {
      const Silian_activate = () => {
        if (Silian_cancelled) {
          return;
        }

        if (typeof Silian_React.startTransition === 'function') {
          Silian_React.startTransition(() => Silian_setShowDeferredFooter(true));
          return;
        }

        Silian_setShowDeferredFooter(true);
      };

      if (typeof window.requestIdleCallback === 'function') {
        Silian_idleHandle = window.requestIdleCallback(Silian_activate, { timeout: 1500 });
        return;
      }

      Silian_activate();
    }, 1500);

    return () => {
      Silian_cancelled = true;
      window.clearTimeout(Silian_timeoutHandle);
      if (Silian_idleHandle != null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(Silian_idleHandle);
      }
    };
  }, [Silian_showDeferredFooter, Silian_showFooter]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Silian_Navbar />

      <main className="flex-1">
        <Silian_RouteErrorBoundary t={Silian_t}>
          <Silian_Outlet />
        </Silian_RouteErrorBoundary>
      </main>

      {Silian_showFooter && Silian_showDeferredFooter ? (
        <Silian_React.Suspense fallback={null}>
          <Silian_Footer enableLiveSummary={!Silian_isHomeRoute} />
        </Silian_React.Suspense>
      ) : null}
    </div>
  );
}

Layout.propTypes = {
  showFooter: Silian_PropTypes.bool,
};

// 简化布局（不显示页脚）
export function SimpleLayout() {
  return <Layout showFooter={false} />;
}

// 认证页面布局
export function AuthLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Silian_Navbar />
      <main className="flex-1">
        <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <Silian_Outlet />
        </div>
      </main>
    </div>
  );
}
