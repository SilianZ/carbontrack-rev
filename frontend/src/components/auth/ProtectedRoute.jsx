import Silian_React, { useEffect as Silian_useEffect, useState as Silian_useState } from 'react';
import Silian_PropTypes from 'prop-types';
import { Navigate as Silian_Navigate, useLocation as Silian_useLocation } from 'react-router-dom';
import { checkAuthStatus as Silian_checkAuthStatus, getDefaultAuthenticatedRoute as Silian_getDefaultAuthenticatedRoute, hasPermission as Silian_hasPermission, hasSupportPortalAccess as Silian_hasSupportPortalAccess } from '../../lib/auth';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';

function Silian_AccessDeniedState({ title: Silian_title, description: Silian_description, backLabel: Silian_backLabel }) {
  return (
    <div className="min-h-screen bg-background px-4 text-foreground flex items-center justify-center">
      <div className="max-w-md text-center">
        <h1 className="mb-4 text-2xl font-bold text-foreground">{Silian_title}</h1>
        <p className="mb-4 text-muted-foreground">{Silian_description}</p>
        <button
          onClick={() => window.history.back()}
          className="text-primary transition-colors hover:text-primary/80"
        >
          {Silian_backLabel}
        </button>
      </div>
    </div>
  );
}

Silian_AccessDeniedState.propTypes = {
  title: Silian_PropTypes.string.isRequired,
  description: Silian_PropTypes.string.isRequired,
  backLabel: Silian_PropTypes.string.isRequired,
};

export function ProtectedRoute({
  children: Silian_children,
  requireAuth: Silian_requireAuth = true,
  requireAdmin: Silian_requireAdmin = false,
  requireSupport: Silian_requireSupport = false,
  permission: Silian_permission = null,
  fallback: Silian_fallback = null
}) {
  const { t: Silian_t } = Silian_useTranslation(['routeGuard']);
  const Silian_location = Silian_useLocation();
  const [Silian_authState, Silian_setAuthState] = Silian_useState(null);

  Silian_useEffect(() => {
    const { isAuthenticated: Silian_isAuthenticated, user: Silian_user } = Silian_checkAuthStatus();
    Silian_setAuthState({ isAuthenticated: Silian_isAuthenticated, user: Silian_user });
  }, []);

  // 加载状态
  if (Silian_authState === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-green-500"></div>
      </div>
    );
  }

  const { isAuthenticated: Silian_isAuthenticated, user: Silian_user } = Silian_authState;
  const Silian_hasSupportAccess = Silian_hasSupportPortalAccess(Silian_user);

  // 需要认证但未登录
  if (Silian_requireAuth && !Silian_isAuthenticated) {
    // 新版登录页路由在 /auth/login，这里兼容 redirect
    const Silian_target = `/auth/login?return=${encodeURIComponent(Silian_location.pathname)}`;
    return <Silian_Navigate to={Silian_target} replace />;
  }

  // 不需要认证但已登录（如登录页面）
  if (!Silian_requireAuth && Silian_isAuthenticated) {
    return <Silian_Navigate to={Silian_getDefaultAuthenticatedRoute(Silian_user)} replace />;
  }

  // 基于资料完整度的引导：如果需要认证且用户资料缺少学校或班级，则跳转到 /onboarding
  if (Silian_requireAuth && Silian_isAuthenticated) {
    const Silian_isVerificationRoute = Silian_location.pathname.startsWith('/auth/verify-email');
    if (!Silian_user?.email_verified_at && !Silian_isVerificationRoute) {
      const Silian_targetPath = `${Silian_location.pathname}${Silian_location.search || ''}`;
      if (typeof window !== 'undefined') {
        sessionStorage.setItem('verification_return_path', Silian_targetPath);
        if (Silian_user?.email) {
          sessionStorage.setItem('pending_verification_email', Silian_user.email);
        }
      }
      const Silian_params = new URLSearchParams();
      Silian_params.set('return', Silian_targetPath);
      if (Silian_user?.email) {
        Silian_params.set('email', Silian_user.email);
      }
      return <Silian_Navigate to={`/auth/verify-email?${Silian_params.toString()}`} replace />;
    }
    const Silian_needsOnboarding = !Silian_hasSupportAccess && !Silian_user?.school_id; // support/admin 不强制补资料
    // 允许本会话临时跳过引导（Onboarding页内点击“暂时跳过”设置的标记）
    const Silian_onboardingSkipped = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('onboarding_skipped') === '1';
    const Silian_currentPath = Silian_location.pathname;
    if (Silian_needsOnboarding && Silian_currentPath !== '/onboarding' && !Silian_onboardingSkipped) {
      // 避免在Onboarding页和登录等特殊页造成循环
      return <Silian_Navigate to="/onboarding" replace />;
    }
  }

  // 需要管理员权限但不是管理员
  if (Silian_requireAdmin && !Silian_user?.is_admin) {
    return Silian_fallback || (
      <Silian_AccessDeniedState
        title={Silian_t('routeGuard.accessDeniedTitle')}
        description={Silian_t('routeGuard.adminRequired')}
        backLabel={Silian_t('routeGuard.goBack')}
      />
    );
  }

  // 需要客服权限但不是客服/管理员
  if (Silian_requireSupport && !Silian_hasSupportAccess) {
    return Silian_fallback || (
      <Silian_AccessDeniedState
        title={Silian_t('routeGuard.accessDeniedTitle')}
        description={Silian_t('routeGuard.supportRequired')}
        backLabel={Silian_t('routeGuard.goBack')}
      />
    );
  }

  // 需要特定权限但没有权限
  if (Silian_permission && !Silian_hasPermission(Silian_permission)) {
    return Silian_fallback || (
      <Silian_AccessDeniedState
        title={Silian_t('routeGuard.permissionDeniedTitle')}
        description={Silian_t('routeGuard.permissionRequired')}
        backLabel={Silian_t('routeGuard.goBack')}
      />
    );
  }

  return Silian_children;
}

// 管理员路由组件
export function AdminRoute({ children: Silian_children, fallback: Silian_fallback = null }) {
  return (
    <ProtectedRoute requireAuth={true} requireAdmin={true} fallback={Silian_fallback}>
      {Silian_children}
    </ProtectedRoute>
  );
}

export function SupportRoute({ children: Silian_children, fallback: Silian_fallback = null }) {
  return (
    <ProtectedRoute requireAuth={true} requireSupport={true} fallback={Silian_fallback}>
      {Silian_children}
    </ProtectedRoute>
  );
}

// 公开路由组件（已登录用户会被重定向）
export function PublicRoute({ children: Silian_children }) {
  return (
    <ProtectedRoute requireAuth={false}>
      {Silian_children}
    </ProtectedRoute>
  );
}

ProtectedRoute.propTypes = {
  children: Silian_PropTypes.node,
  requireAuth: Silian_PropTypes.bool,
  requireAdmin: Silian_PropTypes.bool,
  requireSupport: Silian_PropTypes.bool,
  permission: Silian_PropTypes.string,
  fallback: Silian_PropTypes.node,
};

AdminRoute.propTypes = {
  children: Silian_PropTypes.node,
  fallback: Silian_PropTypes.node,
};

SupportRoute.propTypes = {
  children: Silian_PropTypes.node,
  fallback: Silian_PropTypes.node,
};

PublicRoute.propTypes = {
  children: Silian_PropTypes.node,
};

