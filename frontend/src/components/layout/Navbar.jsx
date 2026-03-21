import React, { useState, useEffect, useMemo } from 'react';
import clsx from 'clsx';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  Menu,
  X,
  Home,
  Calculator,
  BarChart3,
  ShoppingBag,
  Settings,
  LogOut,
  Bell,
  MessageSquare,
  Info
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { checkAuthStatus, authAPI } from '../../lib/auth';
import { useUnreadMessagesCount } from '../../hooks/useUnreadMessagesCount';
import LanguageSwitcher from '../LanguageSwitcher';
import { ThemeToggle } from '../ThemeToggle';
import { Button } from '../ui/Button';
import R2Image from '../common/R2Image';

const NAV_SECTION_ORDER = ['overview', 'insights', 'marketplace'];

export function Navbar() {
  const { t } = useTranslation();
  const location = useLocation();
  const isAdminRoute = location.pathname.startsWith('/admin');
  const [isOpen, setIsOpen] = useState(false);
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const { count: unreadCount, isLoading: unreadLoading } = useUnreadMessagesCount();
  const navigate = useNavigate();
  const getIsPortrait = () => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return true;
    }
    return window.matchMedia('(orientation: portrait)').matches;
  };
  const [isPortrait, setIsPortrait] = useState(getIsPortrait);
  const [renderMobileNav, setRenderMobileNav] = useState(false);
  const [isAnimatingOut, setIsAnimatingOut] = useState(false);

  useEffect(() => {
    const { isAuthenticated: authStatus, user: currentUser } = checkAuthStatus();
    setIsAuthenticated(authStatus);
    setUser(currentUser);

    let cancelled = false;

    if (authStatus) {
      (async () => {
        try {
          const freshUser = await authAPI.getCurrentUser();
          if (!cancelled && freshUser) {
            setUser(freshUser);
          }
        } catch (error) {
          console.error('Failed to refresh current user information', error);
        }
      })();
    }

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) {
      return;
    }
    const mediaQuery = window.matchMedia('(orientation: portrait)');
    const handleOrientationChange = (event) => {
      setIsPortrait(event.matches);
    };
    setIsPortrait(mediaQuery.matches);

    if (typeof mediaQuery.addEventListener === 'function') {
      mediaQuery.addEventListener('change', handleOrientationChange);
      return () => mediaQuery.removeEventListener('change', handleOrientationChange);
    }

    mediaQuery.addListener(handleOrientationChange);
    return () => mediaQuery.removeListener(handleOrientationChange);
  }, []);

  useEffect(() => {
    if (isOpen) {
      setRenderMobileNav(true);
      setIsAnimatingOut(false);
      return;
    }
    if (!renderMobileNav) {
      return;
    }

    setIsAnimatingOut(true);
    const timeout = setTimeout(() => {
      setRenderMobileNav(false);
      setIsAnimatingOut(false);
    }, 220);

    return () => clearTimeout(timeout);
  }, [isOpen, renderMobileNav]);

  useEffect(() => {
    if (!isPortrait || !renderMobileNav || typeof document === 'undefined') {
      return;
    }
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [isPortrait, renderMobileNav]);

  useEffect(() => {
    setIsOpen(false);
  }, [location.pathname]);

  const mobilePanelId = 'navbar-mobile-panel';

  const handleLogout = async () => {
    try {
      await authAPI.logout();
      setIsAuthenticated(false);
      setUser(null);
    } catch (e) {
      console.error('Logout failed:', e);
    } finally {
      // 统一跳转到登录页
      navigate('/auth/login');
    }
  };

  const toggleMobile = () => {
    setIsOpen((prev) => !prev);
  };

  const closeMobile = () => {
    setIsOpen(false);
  };

  const isActivePath = (path) => {
    return location.pathname === path;
  };

  const navItems = [
    {
      path: '/',
      label: t('nav.home'),
      icon: Home,
      public: true,
      section: 'overview',
      hint: t('nav.hints.home')
    },
    {
      path: '/about-us',
      label: t('nav.about'),
      icon: Info,
      public: true,
      section: 'overview',
      hint: t('nav.hints.about')
    },
    {
      path: '/calculate',
      label: t('nav.calculate'),
      icon: Calculator,
      auth: true,
      section: 'insights',
      hint: t('nav.hints.calculate')
    },
    {
      path: '/dashboard',
      label: t('nav.dashboard'),
      icon: BarChart3,
      auth: true,
      section: 'insights',
      hint: t('nav.hints.dashboard')
    },
    {
      path: '/store',
      label: t('nav.products'),
      icon: ShoppingBag,
      auth: true,
      section: 'marketplace',
      hint: t('nav.hints.products')
    }
  ];

  const filteredNavItems = navItems.filter(item => {
    if (item.public) return true;
    if (item.auth) return isAuthenticated;
    return true;
  });

  const navSectionsMeta = useMemo(() => ({
    overview: {
      title: t('nav.sections.overview'),
      description: t('nav.sections.overviewDesc')
    },
    insights: {
      title: t('nav.sections.insights'),
      description: t('nav.sections.insightsDesc')
    },
    marketplace: {
      title: t('nav.sections.marketplace'),
      description: t('nav.sections.marketplaceDesc')
    }
  }), [t]);

  const mobileNavSections = useMemo(() => {
    return NAV_SECTION_ORDER
      .map((key) => {
        const items = filteredNavItems.filter(
          (item) => (item.section || 'overview') === key
        );

        if (!items.length) {
          return null;
        }

        const sectionMeta = navSectionsMeta[key] || {};
        return {
          key,
          ...sectionMeta,
          items
        };
      })
      .filter(Boolean);
  }, [filteredNavItems, navSectionsMeta]);

  const userInitial = useMemo(() => {
    if (!user?.username) return 'C';
    const trimmed = String(user.username).trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : 'C';
  }, [user?.username]);

  const accountActions = useMemo(() => {
    if (!isAuthenticated) {
      return [];
    }

    const actions = [
      {
        key: 'messages',
        label: t('nav.messages'),
        to: '/messages',
        icon: MessageSquare,
        badge: !unreadLoading && unreadCount > 0 ? unreadCount : null
      },
      {
        key: 'profile',
        label: t('nav.profile'),
        to: '/profile',
        icon: Settings
      },
      {
        key: 'notifications',
        label: t('nav.notifications'),
        to: '/settings/notifications',
        icon: Bell
      }
    ];

    if (user?.is_admin) {
      actions.push({
        key: 'admin',
        label: t('nav.admin'),
        to: '/admin',
        icon: Settings
      });
    }

    return actions;
  }, [isAuthenticated, t, unreadCount, unreadLoading, user?.is_admin]);

  const renderUserAvatar = (sizeClass = 'h-8 w-8') => {
    const fallback = (
      <div className={`${sizeClass} flex items-center justify-center rounded-full bg-green-100 text-green-600 text-sm font-semibold`}>
        {userInitial}
      </div>
    );

    const avatarPath = user?.avatar_path;
    const avatarUrl = user?.avatar_url;

    if (!avatarPath && !avatarUrl) {
      return fallback;
    }

    const isAbsoluteUrl = typeof avatarUrl === 'string' && /^https?:\/\//i.test(avatarUrl);
    const resolvedFilePath = avatarPath || (!isAbsoluteUrl ? avatarUrl : undefined);

    return (
      <R2Image
        filePath={resolvedFilePath}
        src={isAbsoluteUrl ? avatarUrl : undefined}
        alt={user?.username || 'avatar'}
        className={`${sizeClass} rounded-full border border-border object-cover`}
        fallback={fallback}
      />
    );
  };

  return (
    <nav
      className={clsx(
        'sticky top-0 z-50 border-b shadow-sm',
        isAdminRoute
          ? 'border-border bg-background'
          : 'border-border/70 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/90'
      )}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo */}
          <Link to="/" className="flex items-center gap-3 text-xl font-bold text-green-600 dark:text-emerald-400">
            <img src="/favicon.ico" alt="CarbonTrack logo" className="h-12 w-12 shrink-0 object-contain" />
            <span>CarbonTrack</span>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden md:flex items-center gap-1 lg:gap-2">
            {filteredNavItems.map((item) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`relative flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium transition-colors lg:px-4 ${
                    isActivePath(item.path)
                      ? 'bg-green-50 text-green-600 dark:bg-emerald-500/15 dark:text-emerald-300'
                      : 'text-muted-foreground hover:bg-green-50/70 hover:text-green-600 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  <span className="whitespace-nowrap">{item.label}</span>
                  {item.badge && item.badge > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-5 w-5 flex items-center justify-center">
                      {item.badge > 99 ? '99+' : item.badge}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>

          {/* Desktop User Menu */}
          <div className="hidden md:flex items-center space-x-2">
            <LanguageSwitcher
              variant="outline"
              className="rounded-xl border-border bg-background text-foreground hover:bg-muted hover:text-foreground"
            />
            <ThemeToggle
              variant="outline"
              className="rounded-xl border-border bg-background text-foreground hover:bg-muted hover:text-foreground"
            />
            
            {isAuthenticated ? (
              <div className="flex items-center space-x-3">
                {/* 站内信图标按钮，仅图标，无文字，点击跳转/messages */}
                <Button
                  variant="ghost"
                  size="sm"
                  className="relative rounded-xl text-muted-foreground hover:bg-muted hover:text-foreground"
                  aria-label={t('nav.messages')}
                  onClick={() => navigate('/messages')}
                >
                  <Bell className="h-4 w-4" />
                  {!unreadLoading && unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                      {unreadCount > 99 ? '99+' : unreadCount}
                    </span>
                  )}
                </Button>
                {/* 用户菜单 */}
                <div className="relative group">
                  <Button variant="ghost" className="flex items-center gap-3 whitespace-nowrap rounded-xl px-2 text-foreground hover:bg-muted">
                    {renderUserAvatar('h-8 w-8')}
                    <span className="hidden lg:inline">{user?.username}</span>
                  </Button>
                  
                  {/* 下拉菜单 */}
                  <div className="absolute right-0 mt-2 w-48 rounded-md border border-border bg-card text-card-foreground shadow-lg shadow-black/10 opacity-0 invisible transition-all duration-200 group-hover:opacity-100 group-hover:visible">
                    <div className="py-1">
                      <Link
                        to="/profile"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Settings className="h-4 w-4" />
                        {t('nav.profile')}
                      </Link>

                      <Link
                        to="/settings/notifications"
                        className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <Bell className="h-4 w-4" />
                        {t('nav.notifications')}
                      </Link>
                      
                      {user?.is_admin && (
                        <Link
                          to="/admin"
                          className="flex items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                        >
                          <Settings className="h-4 w-4" />
                          {t('nav.admin')}
                        </Link>
                      )}
                      
                      <hr className="my-1 border-border" />
                      
                      <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-2 px-4 py-2 text-sm text-muted-foreground hover:bg-accent hover:text-foreground"
                      >
                        <LogOut className="h-4 w-4" />
                        {t('nav.logout')}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center space-x-2">
                <Link to="/auth/login">
                  <Button variant="ghost" className="rounded-xl text-foreground hover:bg-muted">
                    {t('nav.login')}
                  </Button>
                </Link>
                <Link to="/auth/register">
                  <Button className="rounded-xl bg-green-600 text-white hover:bg-green-700 dark:bg-emerald-500 dark:text-slate-950 dark:hover:bg-emerald-400">
                    {t('nav.register')}
                  </Button>
                </Link>
              </div>
            )}
          </div>

          {/* Mobile menu button */}
          <div className="md:hidden">
            <Button
              variant="ghost"
              onClick={toggleMobile}
              aria-expanded={isOpen}
              aria-controls={mobilePanelId}
              aria-label={
                isOpen
                  ? t('nav.closeMenu')
                  : t('nav.openMenu')
              }
            >
              {isOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Navigation */}
      {isPortrait && renderMobileNav && (
        <button
          type="button"
          onClick={closeMobile}
          aria-label={t('nav.closeMenu')}
          className={clsx(
            'fixed inset-x-0 top-16 bottom-0 z-[55] bg-black/30 transition-opacity duration-200 ease-out md:hidden',
            isAnimatingOut ? 'opacity-0' : 'opacity-100'
          )}
        />
      )}
      {renderMobileNav && (
        <div
          id={mobilePanelId}
          role={isPortrait ? 'dialog' : 'region'}
          aria-modal={isPortrait ? 'true' : undefined}
          className={clsx(
            'md:hidden border-t border-border bg-background text-foreground',
            isPortrait
              ? 'fixed inset-x-3 top-20 bottom-4 z-[60] rounded-2xl border border-border shadow-2xl shadow-black/10 backdrop-blur'
              : 'z-10 rounded-b-2xl border border-border shadow-lg shadow-black/10',
            isAnimatingOut ? 'animate-mobile-nav-out' : 'animate-mobile-nav-in'
          )}
        >
          <div
            className={clsx(
              'space-y-5',
              isPortrait ? 'h-full overflow-y-auto px-4 pt-5 pb-8' : 'px-3 pt-4 pb-6'
            )}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-foreground">
                  {t('nav.menuTitle')}
                </p>
                <p className="text-xs text-muted-foreground">
                  {t('nav.menuSubtitle')}
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={closeMobile}
                aria-label={t('nav.closeMenu')}
                className="h-9 w-9 rounded-full border border-border"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>

            {mobileNavSections.map((section) => (
              <div
                key={section.key}
                className="rounded-2xl border border-border bg-card/95 p-4 shadow-sm shadow-black/5"
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-green-600">
                    {section.title}
                  </p>
                  {section.description && (
                    <p className="mt-1 text-sm text-muted-foreground">{section.description}</p>
                  )}
                </div>
                <div
                  className={clsx(
                    'mt-4 gap-3',
                    isPortrait ? 'grid grid-cols-1 min-[420px]:grid-cols-2' : 'flex flex-col'
                  )}
                >
                  {section.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = isActivePath(item.path);
                    return (
                      <Link
                        key={item.path}
                        to={item.path}
                        onClick={closeMobile}
                        className={clsx(
                          'flex w-full items-start gap-3 rounded-2xl border px-3 py-3 text-left transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40',
                          isActive
                            ? 'border-green-200 bg-green-50/80 text-green-700 shadow-sm dark:border-green-900/60 dark:bg-green-950/30 dark:text-green-300'
                            : 'border-border text-muted-foreground hover:border-green-200 hover:bg-accent hover:text-foreground'
                        )}
                      >
                        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
                          <Icon className="h-5 w-5" />
                        </span>
                        <div className="flex-1">
                          <span className="text-sm font-semibold">{item.label}</span>
                          {item.hint && (
                            <p className="mt-0.5 text-xs text-muted-foreground">{item.hint}</p>
                          )}
                        </div>
                        {item.badge && item.badge > 0 && (
                          <span className="ml-auto flex h-5 min-w-[1.25rem] items-center justify-center rounded-full bg-red-500 px-1 text-xs font-semibold text-white">
                            {item.badge > 99 ? '99+' : item.badge}
                          </span>
                        )}
                      </Link>
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
                      {t('nav.languageSection')}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {t('nav.languageDescription')}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <LanguageSwitcher
                      variant="outline"
                      size="sm"
                      showText={false}
                      className="border-border bg-background/80 text-foreground hover:bg-accent"
                    />
                    <ThemeToggle
                      variant="outline"
                      size="icon"
                      className="border-border bg-background/80 text-foreground hover:bg-accent"
                    />
                  </div>
                </div>
              </div>

              {isAuthenticated ? (
                <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-sm shadow-black/5">
                  <div className="flex items-center gap-3">
                    {renderUserAvatar('h-12 w-12')}
                    <div>
                      <p className="text-base font-semibold text-foreground">
                        {user?.username}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {t('nav.accountSignedIn')}
                      </p>
                    </div>
                  </div>

                    {accountActions.length > 0 && (
                      <div
                        className={clsx(
                          'mt-4 gap-3',
                          isPortrait ? 'grid grid-cols-2' : 'flex flex-col'
                        )}
                      >
                        {accountActions.map((action) => {
                          const ActionIcon = action.icon;
                          return (
                            <Link
                              key={action.key}
                              to={action.to}
                              onClick={closeMobile}
                              className="flex items-center gap-2 rounded-xl border border-border bg-background/80 px-3 py-3 text-sm font-medium text-muted-foreground transition hover:-translate-y-0.5 hover:border-green-200 hover:text-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/40 dark:bg-background/60"
                            >
                              <ActionIcon className="h-4 w-4" />
                              <span>{action.label}</span>
                              {typeof action.badge === 'number' && action.badge > 0 && (
                                <span className="ml-auto rounded-full bg-red-500 px-2 text-xs font-semibold text-white">
                                  {action.badge > 99 ? '99+' : action.badge}
                                </span>
                              )}
                            </Link>
                          );
                        })}
                      </div>
                    )}

                  <button
                    onClick={() => {
                      handleLogout();
                      closeMobile();
                    }}
                    className="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-transparent bg-green-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-green-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-green-500/60"
                  >
                    <LogOut className="h-4 w-4" />
                    {t('nav.logout')}
                  </button>
                </div>
              ) : (
                <div className="rounded-2xl border border-border bg-card/95 p-4 shadow-sm shadow-black/5">
                  <p className="text-base font-semibold text-foreground">
                    {t('nav.getStarted')}
                  </p>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {t('nav.accountDescription')}
                  </p>
                  <div className="mt-4 space-y-2">
                    <Link to="/auth/login" onClick={closeMobile}>
                      <Button variant="outline" className="w-full justify-center">
                        {t('nav.login')}
                      </Button>
                    </Link>
                    <Link to="/auth/register" onClick={closeMobile}>
                      <Button className="w-full">
                        {t('nav.register')}
                      </Button>
                    </Link>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
