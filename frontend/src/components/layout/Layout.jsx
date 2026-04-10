import React from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Navbar } from './Navbar';
import RouteErrorBoundary from '../common/RouteErrorBoundary';
import PropTypes from 'prop-types';
import i18n from '../../lib/i18n';

const Footer = React.lazy(() => import('./Footer').then((module) => ({ default: module.Footer })));

export function Layout({ showFooter = true }) {
  const location = useLocation();
  const isHomeRoute = location.pathname === '/';
  const [showDeferredFooter, setShowDeferredFooter] = React.useState(false);

  const t = React.useCallback((key) => {
    const fallbackMap = {
      'errors.unexpected': '发生未知错误',
      'errors.tryAgain': '请稍后重试或刷新页面',
      'common.retry': '重试',
    };

    return i18n.t(key, { defaultValue: fallbackMap[key] || key });
  }, []);

  React.useEffect(() => {
    if (!showFooter || showDeferredFooter) {
      return undefined;
    }

    let cancelled = false;
    let idleHandle = null;
    const timeoutHandle = window.setTimeout(() => {
      const activate = () => {
        if (cancelled) {
          return;
        }

        if (typeof React.startTransition === 'function') {
          React.startTransition(() => setShowDeferredFooter(true));
          return;
        }

        setShowDeferredFooter(true);
      };

      if (typeof window.requestIdleCallback === 'function') {
        idleHandle = window.requestIdleCallback(activate, { timeout: 1500 });
        return;
      }

      activate();
    }, 1500);

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutHandle);
      if (idleHandle != null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(idleHandle);
      }
    };
  }, [showDeferredFooter, showFooter]);

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        <RouteErrorBoundary t={t}>
          <Outlet />
        </RouteErrorBoundary>
      </main>
      
      {showFooter && showDeferredFooter ? (
        <React.Suspense fallback={null}>
          <Footer enableLiveSummary={!isHomeRoute} />
        </React.Suspense>
      ) : null}
    </div>
  );
}

Layout.propTypes = {
  showFooter: PropTypes.bool,
};

// 简化布局（不显示页脚）
export function SimpleLayout() {
  return <Layout showFooter={false} />;
}

// 认证页面布局
export function AuthLayout() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      <main className="flex-1">
        <div className="flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
