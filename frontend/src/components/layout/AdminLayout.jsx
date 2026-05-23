import Silian_React, { useEffect as Silian_useEffect, useMemo as Silian_useMemo } from 'react';
import { NavLink as Silian_NavLink, Outlet as Silian_Outlet, useLocation as Silian_useLocation, useNavigate as Silian_useNavigate } from 'react-router-dom';
import { QueryClientProvider as Silian_QueryClientProvider } from 'react-query';
import {
  Award as Silian_Award,
  Bot as Silian_Bot,
  Fingerprint as Silian_Fingerprint,
  Headset as Silian_Headset,
  LayoutDashboard as Silian_LayoutDashboard,
  Leaf as Silian_Leaf,
  PackageCheck as Silian_PackageCheck,
  Radio as Silian_Radio,
  Repeat2 as Silian_Repeat2,
  ScrollText as Silian_ScrollText,
  ShieldCheck as Silian_ShieldCheck,
  TimerReset as Silian_TimerReset,
  Tags as Silian_Tags,
  Sparkles as Silian_Sparkles,
  Stethoscope as Silian_Stethoscope,
  UserCircle2 as Silian_UserCircle2,
  UserCog as Silian_UserCog,
  Users as Silian_Users,
} from 'lucide-react';

import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { queryClient as Silian_queryClient } from '../../lib/react-query';
import { Navbar as Silian_Navbar } from './Navbar';
import {
  SidebarProvider as Silian_SidebarProvider,
  Sidebar as Silian_Sidebar,
  SidebarContent as Silian_SidebarContent,
  SidebarHeader as Silian_SidebarHeader,
  SidebarFooter as Silian_SidebarFooter,
  SidebarMenu as Silian_SidebarMenu,
  SidebarMenuItem as Silian_SidebarMenuItem,
  SidebarMenuButton as Silian_SidebarMenuButton,
  SidebarTrigger as Silian_SidebarTrigger,
  SidebarInset as Silian_SidebarInset,
} from '../ui/sidebar';
import { Button as Silian_Button } from '../ui/Button';
import { Badge as Silian_Badge } from '../ui/badge';
import { cn as Silian_cn } from '../../lib/utils';

const Silian_NAV_LINKS = [
  { key: 'dashboard', to: '/admin/dashboard', icon: Silian_LayoutDashboard },
  { key: 'aiWorkspace', to: '/admin/ai', icon: Silian_Bot },
  { key: 'passkeys', to: '/admin/passkeys', icon: Silian_Fingerprint },
  { key: 'users', to: '/admin/users', icon: Silian_Users },
  { key: 'groups', to: '/admin/users/groups', icon: Silian_UserCog },
  { key: 'activities', to: '/admin/activities', icon: Silian_Leaf },
  { key: 'products', to: '/admin/products', icon: Silian_PackageCheck },
  { key: 'badges', to: '/admin/badges', icon: Silian_Award },
  { key: 'avatars', to: '/admin/avatars', icon: Silian_UserCircle2 },
  { key: 'exchanges', to: '/admin/exchanges', icon: Silian_Repeat2 },
  { key: 'broadcast', to: '/admin/broadcast', icon: Silian_Radio },
  { key: 'supportOps', to: '/admin/support', icon: Silian_Tags },
  { key: 'cron', to: '/admin/cron', icon: Silian_TimerReset },
  { key: 'supportPortal', to: '/support/', icon: Silian_Headset },
  { key: 'llmUsage', to: '/admin/llm-usage', icon: Silian_Sparkles },
  { key: 'systemLogs', to: '/admin/system-logs', icon: Silian_ScrollText },
  { key: 'diagnostics', to: '/admin/diagnostics', icon: Silian_Stethoscope },
];

export default function AdminLayout() {
  const { t: Silian_t } = Silian_useTranslation(['admin', 'footer', 'nav']);
  const Silian_navigate = Silian_useNavigate();
  const Silian_location = Silian_useLocation();

  const Silian_translatedLinks = Silian_useMemo(() => Silian_NAV_LINKS.map((Silian_link) => ({
    ...Silian_link,
    label: Silian_t(`admin.nav.${Silian_link.key}`),
  })), [Silian_t]);

  const Silian_activeLink = Silian_useMemo(
    () => Silian_translatedLinks.find((Silian_link) => Silian_location.pathname.startsWith(Silian_link.to)),
    [Silian_location.pathname, Silian_translatedLinks]
  );

  Silian_useEffect(() => {
    const Silian_target = typeof globalThis !== 'undefined' ? globalThis : undefined;
    if (!Silian_target?.addEventListener) {
      return undefined;
    }

    const Silian_handler = (Silian_event) => {
      if ((Silian_event.metaKey || Silian_event.ctrlKey) && Silian_event.key.toLowerCase() === 'k') {
        Silian_event.preventDefault();
        Silian_navigate('/admin/ai');
      }
    };

    Silian_target.addEventListener('keydown', Silian_handler);
    return () => Silian_target.removeEventListener('keydown', Silian_handler);
  }, [Silian_navigate]);

  Silian_useEffect(() => {
    if (typeof document === 'undefined') {
      return undefined;
    }

    const Silian_previousRootOverflowX = document.documentElement.style.overflowX;
    const Silian_previousBodyOverflowX = document.body.style.overflowX;

    document.documentElement.style.overflowX = 'hidden';
    document.body.style.overflowX = 'hidden';

    return () => {
      document.documentElement.style.overflowX = Silian_previousRootOverflowX;
      document.body.style.overflowX = Silian_previousBodyOverflowX;
    };
  }, []);

  return (
    <Silian_QueryClientProvider client={Silian_queryClient}>
      <div className="min-h-screen bg-background text-foreground">
        <Silian_Navbar />
        <Silian_SidebarProvider>
          <div className="relative flex min-h-[calc(100vh-4rem)] min-w-0 flex-col">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_65%)]" />
            <div className="flex min-w-0 flex-1">
              <Silian_Sidebar className="top-16 border-r border-border bg-card shadow-sm md:h-[calc(100svh-4rem)]">
                <Silian_SidebarHeader className="px-5 py-6">
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <Silian_ShieldCheck className="h-4 w-4" />
                    {Silian_t('admin.title')}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {Silian_t('admin.subtitle')}
                  </p>
                </Silian_SidebarHeader>
                <Silian_SidebarContent className="px-3 py-4">
                  <Silian_SidebarMenu className="gap-1.5">
                    {Silian_translatedLinks.map((Silian_link) => {
                      const Silian_Icon = Silian_link.icon;
                      const Silian_isActive = Silian_location.pathname.startsWith(Silian_link.to);
                      return (
                        <Silian_SidebarMenuItem key={Silian_link.to}>
                          <Silian_SidebarMenuButton
                            asChild
                            isActive={Silian_isActive}
                            tooltip={Silian_link.label}
                            size="lg"
                            variant="outline"
                            className={Silian_cn(
                              'group justify-start rounded-2xl border border-transparent bg-transparent transition-all duration-150 hover:border-emerald-200 hover:bg-emerald-50/80 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10',
                              Silian_isActive && 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-500/45 dark:bg-emerald-500/12 dark:text-emerald-200'
                            )}
                          >
                            <Silian_NavLink
                              to={Silian_link.to}
                              className={({ isActive: Silian_navIsActive }) => Silian_cn(
                                'flex w-full items-center gap-3 text-sm font-medium text-muted-foreground transition-colors',
                                (Silian_isActive || Silian_navIsActive) && 'text-emerald-700 dark:text-emerald-200'
                              )}
                            >
                              <span className={Silian_cn(
                                'flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-emerald-700 transition-all group-hover:border-emerald-300 group-hover:bg-emerald-100 group-hover:text-emerald-700 dark:border-emerald-500/12 dark:bg-emerald-500/8 dark:text-emerald-400 dark:group-hover:border-emerald-500/30 dark:group-hover:bg-emerald-500/12 dark:group-hover:text-emerald-300',
                                Silian_isActive && 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-500/14 dark:text-emerald-300'
                              )}>
                                <Silian_Icon className="h-4 w-4" />
                              </span>
                              <span className="truncate">{Silian_link.label}</span>
                            </Silian_NavLink>
                          </Silian_SidebarMenuButton>
                        </Silian_SidebarMenuItem>
                      );
                    })}
                  </Silian_SidebarMenu>
                </Silian_SidebarContent>
                <Silian_SidebarFooter className="px-5 pb-6 pt-0">
                  <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/70 p-3 shadow-sm">
                    <Silian_Sparkles className="mt-1 h-4 w-4 text-emerald-500" />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {Silian_t('admin.footer.tip')}
                    </p>
                  </div>
                </Silian_SidebarFooter>
              </Silian_Sidebar>
              <Silian_SidebarInset className="relative flex min-w-0 flex-1 flex-col overflow-x-hidden bg-transparent">
                <header className="top-16 z-30 flex w-full max-w-full flex-col gap-4 border-b border-transparent px-4 pb-4 pt-4 sm:px-6 md:px-10">
                  <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4">
                    <Silian_SidebarTrigger className="self-start md:hidden" />
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <Silian_Badge
                        variant="outline"
                        className="w-fit max-w-full rounded-full border-emerald-200 bg-emerald-100/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-700 dark:border-emerald-300/40 dark:bg-emerald-500/18 dark:text-emerald-100 dark:shadow-[0_0_0_1px_rgba(110,231,183,0.08)]"
                      >
                        {Silian_t('admin.header.section')}
                      </Silian_Badge>
                      <h1 className="min-w-0 break-words text-2xl font-semibold tracking-tight text-foreground sm:text-3xl md:text-4xl">
                        {Silian_activeLink?.label}
                      </h1>
                    </div>
                    <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:justify-end md:ml-auto">
                      <Silian_Button
                        variant="outline"
                        className="hidden items-center gap-2 rounded-full border-emerald-200 bg-background/80 px-4 md:inline-flex"
                        onClick={() => Silian_navigate('/support/')}
                      >
                        <Silian_Headset className="h-4 w-4" />
                        {Silian_t('admin.header.openSupportPortal')}
                      </Silian_Button>
                      <Silian_Button
                        variant="outline"
                        className="hidden items-center gap-2 rounded-full border-emerald-200 bg-background/80 px-4 md:inline-flex"
                        onClick={() => Silian_navigate('/admin/ai')}
                      >
                        <Silian_Bot className="h-4 w-4" />
                        {Silian_t('admin.command.openWorkspace', { defaultValue: 'AI 工作台 / Ctrl + K' })}
                      </Silian_Button>
                      <Silian_Button variant="ghost" className="self-start md:hidden" onClick={() => Silian_navigate('/admin/ai')}>
                        <Silian_Bot className="h-4 w-4" />
                      </Silian_Button>
                      <Silian_Button
                        variant="default"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 sm:w-auto"
                        onClick={() => Silian_navigate('/admin/badges?create=1')}
                      >
                        <Silian_Award className="h-4 w-4" />
                        {Silian_t('admin.header.quickBadge')}
                      </Silian_Button>
                    </div>
                  </div>
                </header>
                <main className="min-w-0 overflow-x-hidden px-4 pb-10 pt-6 sm:px-6 md:px-10">
                  <div className="mx-auto w-full min-w-0 max-w-7xl space-y-6">
                    <Silian_Outlet />
                  </div>
                </main>
              </Silian_SidebarInset>
            </div>
          </div>
        </Silian_SidebarProvider>
      </div>
    </Silian_QueryClientProvider>
  );
}
