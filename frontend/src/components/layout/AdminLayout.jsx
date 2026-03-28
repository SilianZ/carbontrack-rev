import React, { useEffect, useMemo } from 'react';
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { QueryClientProvider } from 'react-query';
import {
  Award,
  Bot,
  Fingerprint,
  LayoutDashboard,
  Leaf,
  PackageCheck,
  Radio,
  Repeat2,
  ScrollText,
  ShieldCheck,
  Sparkles,
  Stethoscope,
  UserCircle2,
  UserCog,
  Users,
} from 'lucide-react';

import { useTranslation } from '../../hooks/useTranslation';
import { queryClient } from '../../lib/react-query';
import { Navbar } from './Navbar';
import {
  SidebarProvider,
  Sidebar,
  SidebarContent,
  SidebarHeader,
  SidebarFooter,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarTrigger,
  SidebarInset,
} from '../ui/sidebar';
import { Button } from '../ui/Button';
import { Badge } from '../ui/badge';
import { cn } from '../../lib/utils';

const NAV_LINKS = [
  { key: 'dashboard', to: '/admin/dashboard', icon: LayoutDashboard },
  { key: 'aiWorkspace', to: '/admin/ai', icon: Bot },
  { key: 'passkeys', to: '/admin/passkeys', icon: Fingerprint },
  { key: 'users', to: '/admin/users', icon: Users },
  { key: 'groups', to: '/admin/users/groups', icon: UserCog },
  { key: 'activities', to: '/admin/activities', icon: Leaf },
  { key: 'products', to: '/admin/products', icon: PackageCheck },
  { key: 'badges', to: '/admin/badges', icon: Award },
  { key: 'avatars', to: '/admin/avatars', icon: UserCircle2 },
  { key: 'exchanges', to: '/admin/exchanges', icon: Repeat2 },
  { key: 'broadcast', to: '/admin/broadcast', icon: Radio },
  { key: 'llmUsage', to: '/admin/llm-usage', icon: Sparkles },
  { key: 'systemLogs', to: '/admin/system-logs', icon: ScrollText },
  { key: 'diagnostics', to: '/admin/diagnostics', icon: Stethoscope },
];

export default function AdminLayout() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();

  const translatedLinks = useMemo(() => NAV_LINKS.map((link) => ({
    ...link,
    label: t(`admin.nav.${link.key}`),
  })), [t]);

  const activeLink = useMemo(
    () => translatedLinks.find((link) => location.pathname.startsWith(link.to)),
    [location.pathname, translatedLinks]
  );

  useEffect(() => {
    const target = typeof globalThis !== 'undefined' ? globalThis : undefined;
    if (!target?.addEventListener) {
      return undefined;
    }

    const handler = (event) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        navigate('/admin/ai');
      }
    };

    target.addEventListener('keydown', handler);
    return () => target.removeEventListener('keydown', handler);
  }, [navigate]);

  return (
    <QueryClientProvider client={queryClient}>
      <div className="min-h-screen bg-background text-foreground">
        <Navbar />
        <SidebarProvider>
          <div className="relative flex min-h-[calc(100vh-4rem)] flex-col">
            <div className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.18),_transparent_65%)]" />
            <div className="flex flex-1">
              <Sidebar className="top-16 border-r border-border bg-card shadow-sm md:h-[calc(100svh-4rem)]">
                <SidebarHeader className="px-5 py-6">
                  <div className="flex items-center gap-3 rounded-2xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-300">
                    <ShieldCheck className="h-4 w-4" />
                    {t('admin.title')}
                  </div>
                  <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                    {t('admin.subtitle')}
                  </p>
                </SidebarHeader>
                <SidebarContent className="px-3 py-4">
                  <SidebarMenu className="gap-1.5">
                    {translatedLinks.map((link) => {
                      const Icon = link.icon;
                      const isActive = location.pathname.startsWith(link.to);
                      return (
                        <SidebarMenuItem key={link.to}>
                          <SidebarMenuButton
                            asChild
                            isActive={isActive}
                            tooltip={link.label}
                            size="lg"
                            variant="outline"
                            className={cn(
                              'group justify-start rounded-2xl border border-transparent bg-transparent transition-all duration-150 hover:border-emerald-200 hover:bg-emerald-50/80 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10',
                              isActive && 'border-emerald-200 bg-emerald-50 text-emerald-700 shadow-sm dark:border-emerald-500/45 dark:bg-emerald-500/12 dark:text-emerald-200'
                            )}
                          >
                            <NavLink
                              to={link.to}
                              className={({ isActive: navIsActive }) => cn(
                                'flex w-full items-center gap-3 text-sm font-medium text-muted-foreground transition-colors',
                                (isActive || navIsActive) && 'text-emerald-700 dark:text-emerald-200'
                              )}
                            >
                              <span className={cn(
                                'flex h-10 w-10 items-center justify-center rounded-xl border border-emerald-200 bg-emerald-100 text-emerald-700 transition-all group-hover:border-emerald-300 group-hover:bg-emerald-100 group-hover:text-emerald-700 dark:border-emerald-500/12 dark:bg-emerald-500/8 dark:text-emerald-400 dark:group-hover:border-emerald-500/30 dark:group-hover:bg-emerald-500/12 dark:group-hover:text-emerald-300',
                                isActive && 'border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-500/35 dark:bg-emerald-500/14 dark:text-emerald-300'
                              )}>
                                <Icon className="h-4 w-4" />
                              </span>
                              <span className="truncate">{link.label}</span>
                            </NavLink>
                          </SidebarMenuButton>
                        </SidebarMenuItem>
                      );
                    })}
                  </SidebarMenu>
                </SidebarContent>
                <SidebarFooter className="px-5 pb-6 pt-0">
                  <div className="flex items-start gap-3 rounded-2xl border border-border bg-background/70 p-3 shadow-sm">
                    <Sparkles className="mt-1 h-4 w-4 text-emerald-500" />
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {t('admin.footer.tip')}
                    </p>
                  </div>
                </SidebarFooter>
              </Sidebar>
              <SidebarInset className="relative flex flex-1 flex-col bg-transparent">
                <header className="top-16 z-30 flex flex-col gap-5 border-b border-transparent px-6 pb-4 pt-6 md:px-10">
                  <div className="flex flex-wrap items-center gap-4">
                    <SidebarTrigger className="md:hidden" />
                    <div className="flex flex-col gap-2">
                      <Badge
                        variant="outline"
                        className="w-fit rounded-full border-emerald-200 bg-emerald-100/85 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.32em] text-emerald-700 dark:border-emerald-300/40 dark:bg-emerald-500/18 dark:text-emerald-100 dark:shadow-[0_0_0_1px_rgba(110,231,183,0.08)]"
                      >
                        {t('admin.header.section')}
                      </Badge>
                      <h1 className="text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                        {activeLink?.label}
                      </h1>
                    </div>
                    <div className="ml-auto flex items-center gap-2">
                      <Button
                        variant="outline"
                        className="hidden items-center gap-2 rounded-full border-emerald-200 bg-background/80 px-4 md:inline-flex"
                        onClick={() => navigate('/admin/ai')}
                      >
                        <Bot className="h-4 w-4" />
                        {t('admin.command.openWorkspace', { defaultValue: 'AI 工作台 / Ctrl + K' })}
                      </Button>
                      <Button variant="ghost" className="md:hidden" onClick={() => navigate('/admin/ai')}>
                        <Bot className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="default"
                        className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4"
                        onClick={() => navigate('/admin/badges?create=1')}
                      >
                        <Award className="h-4 w-4" />
                        {t('admin.header.quickBadge')}
                      </Button>
                    </div>
                  </div>
                </header>
                <main className="px-6 pb-10 pt-6 md:px-10">
                  <div className="mx-auto w-full max-w-7xl space-y-6">
                    <Outlet />
                  </div>
                </main>
              </SidebarInset>
            </div>
          </div>
        </SidebarProvider>
      </div>
    </QueryClientProvider>
  );
}
