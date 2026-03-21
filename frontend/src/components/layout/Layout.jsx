import React from 'react';
import { Outlet } from 'react-router-dom';
import { Navbar } from './Navbar';
import { Footer } from './Footer';
import RouteErrorBoundary from '../common/RouteErrorBoundary';
import { useTranslation } from '../../hooks/useTranslation';
import PropTypes from 'prop-types';

export function Layout({ showFooter = true }) {
  const { t } = useTranslation();
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Navbar />
      
      <main className="flex-1">
        <RouteErrorBoundary t={t}>
          <Outlet />
        </RouteErrorBoundary>
      </main>
      
      {showFooter && <Footer />}
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
