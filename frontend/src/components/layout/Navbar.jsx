import Silian_React, { useState as Silian_useState, useEffect as Silian_useEffect, useMemo as Silian_useMemo, useRef as Silian_useRef } from 'react';
import { createPortal as Silian_createPortal } from 'react-dom';
import Silian_clsx from 'clsx';
import { Link as Silian_Link, useLocation as Silian_useLocation, useNavigate as Silian_useNavigate } from 'react-router-dom';
import {
  Menu as Silian_Menu,
  X as Silian_X,
  Home as Silian_Home,
  Calculator as Silian_Calculator,
  BarChart3 as Silian_BarChart3,
  ShoppingBag as Silian_ShoppingBag,
  Settings as Silian_Settings,
  LogOut as Silian_LogOut,
  Bell as Silian_Bell,
  MessageSquare as Silian_MessageSquare,
  Info as Silian_Info,
  Headset as Silian_Headset
} from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { checkAuthStatus as Silian_checkAuthStatus, authAPI as Silian_authAPI, hasSupportPortalAccess as Silian_hasSupportPortalAccess } from '../../lib/auth';
import { useUnreadMessagesCount as Silian_useUnreadMessagesCount } from '../../hooks/useUnreadMessagesCount';
import { Button as Silian_Button } from '../ui/Button';

const Silian_LanguageSwitcher = Silian_React.lazy(() => import('../LanguageSwitcher'));
const Silian_ThemeToggle = Silian_React.lazy(() => import('../ThemeToggle').then((Silian_module) => ({ default: Silian_module.ThemeToggle })));
const Silian_R2Image = Silian_React.lazy(() => import('../common/R2Image'));

const Silian_NAV_SECTION_ORDER = ['overview', 'insights', 'marketplace'];

export function Navbar() {
  const { t: Silian_t } = Silian_useTranslation(['nav', 'footer']);
  const Silian_location = Silian_useLocation();
  const Silian_isAdminRoute = Silian_location.pathname.startsWith('/admin');
  const Silian_hasRefreshedUserRef = Silian_useRef(false);
  const [Silian_isOpen, Silian_setIsOpen] = Silian_useState(false);
  const [Silian_user, Silian_setUser] = Silian_useState(null);
  const [Silian_isAuthenticated, Silian_setIsAuthenticated] = Silian_useState(false);
  const [Silian_showSecondaryControls, Silian_setShowSecondaryControls] = Silian_useState(false);
  const { count: Silian_unreadCount, isLoading: Silian_unreadLoading } = Silian_useUnreadMessagesCount({
    enabled: Silian_location.pathname !== '/',
  });
  const Silian_navigate = Silian_useNavigate();
  const Silian_getIsPortrait = () => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return true;
    }
    return window.matchMedia('(orientation: portrait)').matches;
  };
  const [Silian_isPortrait, Silian_setIsPortrait] = Silian_useState(Silian_getIsPortrait);
  const [Silian_renderMobileNav, Silian_setRenderMobileNav] = Silian_useState(false);
  const [Silian_isAnimatingOut, Silian_setIsAnimatingOut] = Silian_useState(false);

  Silian_useEffect(() => {
    const { isAuthenticated: Silian_authStatus, user: Silian_currentUser } = Silian_checkAuthStatus();
    Silian_setIsAuthenticated(Silian_authStatus);
    Silian_setUser(Silian_currentUser);

    if (!Silian_authStatus || Silian_hasRefreshedUserRef.current || Silian_location.pathname === '/') {
      return undefined;
    }

    let Silian_cancelled = false;

    (async () => {
      try {
        const Silian_freshUser = await Silian_authAPI.getCurrentUser();
        if (!Silian_cancelled && Silian_freshUser) {
          Silian_hasRefreshedUserRef.current = true;
          Silian_setUser(Silian_freshUser);
        }
      } catch (Silian_error) {
        Silian_hasRefreshedUserRef.current = false;
        console.error('Failed to refresh current user information', Silian_error);
      }
    })();

    return () => {
      Silian_cancelled = true;
    };
  }, [Silian_location.pathname]);

  Silian_useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const Silian_mediaQuery = window.matchMedia('(orientation: portrait)');
    const Silian_handleOrientationChange = (Silian_event) => {
      Silian_setIsPortrait(Silian_event.matches);
    };
    Silian_setIsPortrait(Silian_mediaQuery.matches);

    if (typeof Silian_mediaQuery.addEventListener === 'function') {
      Silian_mediaQuery.addEventListener('change', Silian_handleOrientationChange);
      return () => Silian_mediaQuery.removeEventListener('change', Silian_handleOrientationChange);
    }

    Silian_mediaQuery.addListener(Silian_handleOrientationChange);
    return () => Silian_mediaQuery.removeListener(Silian_handleOrientationChange);
  }, []);

  Silian_useEffect(() => {
    if (Silian_isOpen) {
      Silian_setRenderMobileNav(true);
      Silian_setIsAnimatingOut(false);
      return;
    }
    if (!Silian_renderMobileNav) {
      return;
    }

    Silian_setIsAnimatingOut(true);
    const Silian_timeout = setTimeout(() => {
      Silian_setRenderMobileNav(false);
      Silian_setIsAnimatingOut(false);
    }, 220);

    return () => clearTimeout(Silian_timeout);
  }, [Silian_isOpen, Silian_renderMobileNav]);

  Silian_useEffect(() => {
    if (!Silian_isPortrait || !Silian_renderMobileNav || typeof document === 'undefined') {
      return;
    }
    const Silian_originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = Silian_originalOverflow;
    };
  }, [Silian_isPortrait, Silian_renderMobileNav]);

  Silian_useEffect(() => {
    Silian_setIsOpen(false);
  }, [Silian_location.pathname]);

  Silian_useEffect(() => {
    if (Silian_showSecondaryControls) {
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
          Silian_React.startTransition(() => Silian_setShowSecondaryControls(true));
          return;
        }

        Silian_setShowSecondaryControls(true);
      };

      if (typeof window.requestIdleCallback === 'function') {
        Silian_idleHandle = window.requestIdleCallback(Silian_activate, { timeout: 1500 });
        return;
      }

      Silian_activate();
    }, 1200);

    return () => {
      Silian_cancelled = true;
      window.clearTimeout(Silian_timeoutHandle);
      if (Silian_idleHandle != null && typeof window.cancelIdleCallback === 'function') {
        window.cancelIdleCallback(Silian_idleHandle);
      }
    };
  }, [Silian_showSecondaryControls]);

  const Silian_mobilePanelId = 'navbar-mobile-panel';
  const Silian_canAccessSupportPortal = Silian_hasSupportPortalAccess(Silian_user);

  const Silian_handleLogout = async () => {
    try {
      await Silian_authAPI.logout();
      Silian_setIsAuthenticated(false);
      Silian_setUser(null);
    } catch (Silian_e) {
      console.error('Logout failed:', Silian_e);
    } finally {
      // 统一跳转到登录页
      Silian_navigate('/auth/login');
    }
  };

  const Silian_toggleMobile = () => {
    Silian_setIsOpen((Silian_prev) => !Silian_prev);
  };

  const Silian_closeMobile = () => {
    Silian_setIsOpen(false);
  };

  const Silian_isActivePath = (Silian_path) => {
    return Silian_location.pathname === Silian_path;
  };

  const Silian_navItems = [
    {
      path: '/',
      label: Silian_t('nav.home'),
      icon: Silian_Home,
      public: true,
      section: 'overview',
      hint: Silian_t('nav.hints.home')
    },
    {
      path: '/about-us',
      label: Silian_t('nav.about'),
      icon: Silian_Info,
      public: true,
      section: 'overview',
      hint: Silian_t('nav.hints.about')
    },
    {
      path: '/calculate',
      label: Silian_t('nav.calculate'),
      icon: Silian_Calculator,
      auth: true,
      section: 'insights',
      hint: Silian_t('nav.hints.calculate')
    },
    {
      path: '/dashboard',
      label: Silian_t('nav.dashboard'),
      icon: Silian_BarChart3,
      auth: true,
      section: 'insights',
      hint: Silian_t('nav.hints.dashboard')
    },
    {
      path: '/store',
      label: Silian_t('nav.products'),
      icon: Silian_ShoppingBag,
      auth: true,
      section: 'marketplace',
      hint: Silian_t('nav.hints.products')
    }
  ];

  const Silian_filteredNavItems = Silian_navItems.filter(Silian_item => {
    if (Silian_item.public) return true;
    if (Silian_item.auth) return Silian_isAuthenticated;
    return true;
  });

  const Silian_navSectionsMeta = Silian_useMemo(() => ({
    overview: {
      title: Silian_t('nav.sections.overview'),
      description: Silian_t('nav.sections.overviewDesc')
    },
    insights: {
      title: Silian_t('nav.sections.insights'),
      description: Silian_t('nav.sections.insightsDesc')
    },
    marketplace: {
      title: Silian_t('nav.sections.marketplace'),
      description: Silian_t('nav.sections.marketplaceDesc')
    }
  }), [Silian_t]);

  const Silian_mobileNavSections = Silian_useMemo(() => {
    return Silian_NAV_SECTION_ORDER
      .map((Silian_key) => {
        const Silian_items = Silian_filteredNavItems.filter(
          (Silian_item) => (Silian_item.section || 'overview') === Silian_key
        );

        if (!Silian_items.length) {
          return null;
        }

        const Silian_sectionMeta = Silian_navSectionsMeta[Silian_key] || {};
        return {
          key: Silian_key,
          ...Silian_sectionMeta,
          items: Silian_items
        };
      })
      .filter(Boolean);
  }, [Silian_filteredNavItems, Silian_navSectionsMeta]);

  const Silian_userInitial = Silian_useMemo(() => {
    if (!Silian_user?.username) return 'C';
    const Silian_trimmed = String(Silian_user.username).trim();
    return Silian_trimmed ? Silian_trimmed.charAt(0).toUpperCase() : 'C';
  }, [Silian_user?.username]);

  const Silian_accountActions = Silian_useMemo(() => {
    if (!Silian_isAuthenticated) {
      return [];
    }

    const Silian_actions = [
      {
        key: 'messages',
        label: Silian_t('nav.messages'),
        to: '/messages',
        icon: Silian_MessageSquare,
        badge: !Silian_unreadLoading && Silian_unreadCount > 0 ? Silian_unreadCount : null
      },
      {
        key: 'profile',
        label: Silian_t('nav.profile'),
        to: '/profile',
        icon: Silian_Settings
      },
      {
        key: 'notifications',
        label: Silian_t('nav.notifications'),
        to: '/settings/notifications',
        icon: Silian_Bell
      }
    ];

    if (Silian_canAccessSupportPortal) {
      Silian_actions.push({
        key: 'support',
        label: Silian_t('nav.support'),
        to: '/support/',
        icon: Silian_Headset
      });
    }

    if (Silian_user?.is_admin) {
      Silian_actions.push({
        key: 'admin',
        label: Silian_t('nav.admin'),
        to: '/admin',
        icon: Silian_Settings
      });
    }

    return Silian_actions;
  }, [Silian_canAccessSupportPortal, Silian_isAuthenticated, Silian_t, Silian_unreadCount, Silian_unreadLoading, Silian_user?.is_admin]);

  const Silian_renderUserAvatar = (Silian_sizeClass = 'h-8 w-8') => {
    const Silian_fallback = (
      <div className={`${Silian_sizeClass} flex items-center justify-center rounded-full bg-green-100 text-green-600 text-sm font-semibold`}>
        {Silian_userInitial}
      </div>
    );

    const Silian_avatarPath = Silian_user?.avatar_path;
    const Silian_avatarUrl = Silian_user?.avatar_url;

    if (!Silian_avatarPath && !Silian_avatarUrl) {
      return Silian_fallback;
    }

    const Silian_isAbsoluteUrl = typeof Silian_avatarUrl === 'string' && /^https?:\/\//i.test(Silian_avatarUrl);
    const Silian_resolvedFilePath = Silian_avatarPath || (!Silian_isAbsoluteUrl ? Silian_avatarUrl : undefined);

    return (
      <Silian_React.Suspense fallback={Silian_fallback}>
        <Silian_R2Image
          filePath={Silian_resolvedFilePath}
          src={Silian_isAbsoluteUrl ? Silian_avatarUrl : undefined}
          alt={Silian_user?.username || 'avatar'}
          className={`${Silian_sizeClass} rounded-full border border-border object-cover`}
          fallback={Silian_fallback}
        />
      </Silian_React.Suspense>
    );
  };

  const Silian_mobileNavigation = Silian_renderMobileNav && typeof document !== 'undefined' && document.body
    ? Silian_createPortal(
        <>
          {Silian_isPortrait && (
            <button
              type="button"
              onClick={Silian_closeMobile}
              aria-label={Silian_t('nav.closeMenu')}
              className={Silian_clsx(
                'fixed inset-0 z-[55] bg-black/45 transition-opacity duration-200 ease-out md:hidden',
                Silian_isAnimatingOut ? 'opacity-0' : 'opacity-100'
              )}
            />
          )}
          <div
            id={Silian_mobilePanelId}
            role={Silian_isPortrait ? 'dialog' : 'region'}
            aria-modal={Silian_isPortrait ? 'true' : undefined}
            className={Silian_clsx(
              'md:hidden border-t border-border bg-background text-foreground',
              Silian_isPortrait
                ? 'fixed inset-0 z-[60] border-0 rounded-none bg-background shadow-2xl shadow-black/20'
                : 'absolute inset-x-0 top-16 z-10 rounded-b-2xl border border-border shadow-lg shadow-black/10',
              Silian_isAnimatingOut ? 'animate-mobile-nav-out' : 'animate-mobile-nav-in'
            )}
          >
            <div
              className={Silian_clsx(
                'space-y-5',
                Silian_isPortrait
                  ? 'h-[100dvh] overflow-y-auto px-4 pt-0 pb-[max(2rem,env(safe-area-inset-bottom))]'
                  : 'px-3 pt-4 pb-6'
              )}
            >
              <div
                className={Silian_clsx(
                  'flex items-center justify-between gap-3',
                  Silian_isPortrait && 'sticky top-0 z-10 -mx-4 border-b border-border bg-background px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))]'
                )}
              >
                <div>
                  <p className="text-sm font-semibold text-foreground">
                    {Silian_t('nav.menuTitle')}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {Silian_t('nav.menuSubtitle')}
                  </p>
                </div>
                <Silian_Button
                  variant="ghost"
                  size="icon"
                  onClick={Silian_closeMobile}
                  aria-label={Silian_t('nav.closeMenu')}
                  className="h-9 w-9 rounded-full border border-border"
                >
                  <Silian_X className="h-4 w-4" />
                </Silian_Button>
              </div>

              {Silian_mobileNavSections.map((Silian_section) => (
                <div
                  key={Silian_section.key}
                  className="rounded-2xl border border-border bg-card/95 p-4 shadow-sm shadow-black/5"
                >
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                      {Silian_section.title}
                    </p>
                    {Silian_section.description && (
                      <p className="mt-1 text-sm text-muted-foreground">{Silian_section.description}</p>
                    )}
                  </div>
                  <div
                    className={Silian_clsx(
                      'mt-4 gap-3',
                      Silian_isPortrait ? 'grid grid-cols-1 min-[420px]:grid-cols-2' : 'flex flex-col'
                    )}
                  >
                    {Silian_section.items.map((Silian_item) => {
                      const Silian_Icon = Silian_item.icon;
                      const Silian_isActive = Silian_isActivePath(Silian_item.path);
                      return (
                        <Silian_Link
                          key={Silian_item.path}
                          to={Silian_item.path}
                          onClick={Silian_closeMobile}
                          className={Silian_clsx(
                            'flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40',
                            Silian_isActive
                              ? 'border-green-200 bg-green-50/80 text-green-700 shadow-sm dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-300'
                              : 'border-border text-muted-foreground hover:border-green-200 hover:bg-accent hover:text-foreground'
                          )}
                        >
                          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
                            <Silian_Icon className="h-5 w-5" />
                          </span>
                          <div className="flex-1">
                            <span className="text-sm font-semibold">{Silian_item.label}</span>
                            {Silian_item.hint && (
                              <p className="mt-0.5 text-xs text-muted-foreground">{Silian_item.hint}</p>
                            )}
                          </div>
                          {Silian_item.badge && Silian_item.badge > 0 && (
                            <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
                              {Silian_item.badge > 99 ? '99+' : Silian_item.badge}
                            </span>
                          )}
                        </Silian_Link>
                      );
                    })}
                  </div>
                </div>
              ))}

              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-sm shadow-black/5">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                        {Silian_t('nav.languageSection')}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {Silian_t('nav.languageDescription')}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {Silian_showSecondaryControls ? (
                        <Silian_React.Suspense fallback={null}>
                          <Silian_LanguageSwitcher
                            variant="outline"
                            size="sm"
                            showText={false}
                            className="border-border bg-background/80 text-foreground hover:bg-accent"
                          />
                          <Silian_ThemeToggle
                            variant="outline"
                            size="icon"
                            className="border-border bg-background/80 text-foreground hover:bg-accent"
                          />
                        </Silian_React.Suspense>
                      ) : (
                        <div className="flex items-center gap-2">
                          <div className="h-9 w-9 rounded-md border border-border bg-background/80" />
                          <div className="h-9 w-9 rounded-md border border-border bg-background/80" />
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {Silian_isAuthenticated ? (
                  <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-sm shadow-black/5">
                    <div className="flex items-center gap-3">
                      {Silian_renderUserAvatar('h-12 w-12')}
                      <div>
                        <p className="text-base font-semibold text-foreground">
                          {Silian_user?.username}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {Silian_t('nav.accountSignedIn')}
                        </p>
                      </div>
                    </div>

                    {Silian_accountActions.length > 0 && (
                      <div
                        className={Silian_clsx(
                          'mt-4 gap-3',
                          Silian_isPortrait ? 'grid grid-cols-2' : 'flex flex-col'
                        )}
                      >
                        {Silian_accountActions.map((Silian_action) => {
                          const Silian_ActionIcon = Silian_action.icon;
                          return (
                            <Silian_Link
                              key={Silian_action.key}
                              to={Silian_action.to}
                              onClick={Silian_closeMobile}
                              className="flex items-center gap-2 rounded-xl border border-border bg-background/80 px-3 py-3 text-sm font-medium text-muted-foreground transition hover:-translate-y-0.5 hover:border-green-200 hover:text-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 dark:bg-background/60"
                            >
                              <Silian_ActionIcon className="h-4 w-4" />
                              <span>{Silian_action.label}</span>
                              {typeof Silian_action.badge === 'number' && Silian_action.badge > 0 && (
                                <span className="ml-auto rounded-full bg-red-500 px-2 text-xs font-semibold text-white">
                                  {Silian_action.badge > 99 ? '99+' : Silian_action.badge}
                                </span>
                              )}
                            </Silian_Link>
                          );
                        })}
                      </div>
                    )}

                    <button
                      onClick={() => {
                        Silian_handleLogout();
                        Silian_closeMobile();
                      }}
                      className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60"
                    >
                      <Silian_LogOut className="h-4 w-4" />
                      {Silian_t('nav.logout')}
                    </button>
                  </div>
                ) : (
                  <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-sm shadow-black/5">
                    <p className="text-base font-semibold text-foreground">
                      {Silian_t('nav.getStarted')}
                    </p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {Silian_t('nav.accountDescription')}
                    </p>
                    <div className="mt-4 space-y-2">
                      <Silian_Link to="/auth/login" onClick={Silian_closeMobile}>
                        <Silian_Button variant="outline" className="w-full justify-center">
                          {Silian_t('nav.login')}
                        </Silian_Button>
                      </Silian_Link>
                      <Silian_Link to="/auth/register" onClick={Silian_closeMobile}>
                        <Silian_Button className="w-full">
                          {Silian_t('nav.register')}
                        </Silian_Button>
                      </Silian_Link>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </>,
        document.body
      )
    : null;

  return (
    <>
      <nav
        className={Silian_clsx(
          'sticky top-0 z-50 transition-all duration-300',
          Silian_isAdminRoute
            ? 'border-b border-border bg-background'
            : Silian_isPortrait && Silian_renderMobileNav
              ? 'border-b border-border bg-background'
            : 'border-b border-black/5 dark:border-white/10 bg-white/70 dark:bg-black/50 backdrop-blur-xl supports-[backdrop-filter]:backdrop-blur-xl'
        )}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Silian_Link to="/" className="flex items-center gap-3 text-xl font-bold text-green-600 dark:text-emerald-400">
            <img src="/favicon.ico" alt="CarbonTrack logo" className="h-12 w-12 shrink-0 object-contain" />
            <span>CarbonTrack</span>
          </Silian_Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 lg:gap-2">
            {Silian_filteredNavItems.map((Silian_item) => {
              const Silian_Icon = Silian_item.icon;
              return (
                <Silian_Link
                  key={Silian_item.path}
                  to={Silian_item.path}
                  className={`relative flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors lg:px-4 ${
                    Silian_isActivePath(Silian_item.path)
                      ? 'bg-green-50 text-green-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'text-muted-foreground hover:bg-green-50/70 hover:text-green-600 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300'
                  }`}
                >
                  <Silian_Icon className="h-4 w-4" />
                  <span className="whitespace-nowrap">{Silian_item.label}</span>
                  {Silian_item.badge && Silian_item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {Silian_item.badge > 99 ? '99+' : Silian_item.badge}
                    </span>
                  )}
                </Silian_Link>
              );
            })}
          </div>

          {/* Desktop User Menu */}
          <div className="hidden md:flex items-center space-x-2">
            {Silian_showSecondaryControls ? (
              <Silian_React.Suspense fallback={null}>
                <Silian_LanguageSwitcher
                  variant="outline"
                  className="rounded-xl border-border bg-background text-foreground hover:bg-muted hover:text-foreground"
                />
                <Silian_ThemeToggle
                  variant="outline"
                  className="rounded-xl border-border bg-background text-foreground hover:bg-muted hover:text-foreground"
                />
              </Silian_React.Suspense>
            ) : (
              <div className="flex items-center space-x-2">
                <div className="h-10 w-[88px] rounded-xl border border-border bg-background" />
                <div className="h-10 w-10 rounded-xl border border-border bg-background" />
              </div>
            )}

            {Silian_isAuthenticated ? (
              <div className="flex items-center space-x-3">
                {/* 站内信图标按钮，仅图标，无文字，点击跳转/messages */}
                <Silian_Button
                  variant="ghost"
                  size="sm"
                  className="relative rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={Silian_t('nav.messages')}
                  onClick={() => Silian_navigate('/messages')}
                >
                  <Silian_Bell className="h-4 w-4" />
                  {!Silian_unreadLoading && Silian_unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                      {Silian_unreadCount > 99 ? '99+' : Silian_unreadCount}
                    </span>
                  )}
                </Silian_Button>
                {/* 用户菜单 */}
                <div className="relative group">
                  <Silian_Button variant="ghost" className="flex items-center gap-3 whitespace-nowrap rounded-xl px-2 text-foreground hover:bg-muted">
                    {Silian_renderUserAvatar('h-8 w-8')}
                    <span className="hidden lg:inline">{Silian_user?.username}</span>
                  </Silian_Button>

                  {/* 下拉菜单 */}
                  <div className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-card text-card-foreground shadow-lg shadow-black/10 opacity-0 invisible transition-all duration-200 group-hover:opacity-100 group-hover:visible">
                    <div className="py-1">
                      <Silian_Link
                        to="/profile"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Silian_Settings className="h-4 w-4" />
                        {Silian_t('nav.profile')}
                      </Silian_Link>

                      <Silian_Link
                        to="/settings/notifications"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Silian_Bell className="h-4 w-4" />
                        {Silian_t('nav.notifications')}
                      </Silian_Link>

                      <Silian_Link
                        to="/help"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Silian_Headset className="h-4 w-4" />
                        {Silian_t('footer.help')}
                      </Silian_Link>

                      {Silian_canAccessSupportPortal && (
                        <Silian_Link
                          to="/support/"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Silian_Headset className="h-4 w-4" />
                          {Silian_t('nav.support')}
                        </Silian_Link>
                      )}

                      {Silian_user?.is_admin && (
                        <Silian_Link
                          to="/admin"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Silian_Settings className="h-4 w-4" />
                          {Silian_t('nav.admin')}
                        </Silian_Link>
                      )}

                      <hr className="my-1 border-border" />

                      <button
                        onClick={Silian_handleLogout}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Silian_LogOut className="h-4 w-4" />
                        {Silian_t('nav.logout')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Silian_Link to="/auth/login">
                  <Silian_Button variant="ghost" className="rounded-xl text-foreground hover:bg-muted">
                    {Silian_t('nav.login')}
                  </Silian_Button>
                </Silian_Link>
                <Silian_Link to="/auth/register">
                  <Silian_Button className="rounded-xl bg-green-600 text-white hover:bg-green-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400">
                    {Silian_t('nav.register')}
                  </Silian_Button>
                </Silian_Link>
              </div>
            )}
          </div>

            {/* Mobile menu button */}
            <div className="md:hidden">
              <Silian_Button
                variant="ghost"
                onClick={Silian_toggleMobile}
                aria-expanded={Silian_isOpen}
                aria-controls={Silian_mobilePanelId}
                aria-label={
                  Silian_isOpen
                    ? Silian_t('nav.closeMenu')
                    : Silian_t('nav.openMenu')
                }
              >
                {Silian_isOpen ? <Silian_X className="h-6 w-6" /> : <Silian_Menu className="h-6 w-6" />}
              </Silian_Button>
            </div>
          </div>
        </div>
      </nav>
      {Silian_mobileNavigation}
    </>
  );
}
