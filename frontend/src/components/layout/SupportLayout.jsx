import React, { useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Inbox, LayoutDashboard } from 'lucide-react';
import { motion as Motion } from 'framer-motion';

import { Navbar } from './Navbar';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';

const NAV_LINKS = [
  {
    key: 'workbench',
    to: '/support',
    icon: LayoutDashboard,
  },
  {
    key: 'queue',
    to: '/support/tickets',
    icon: Inbox,
  },
];

export default function SupportLayout() {
  const { t } = useTranslation();
  const location = useLocation();

  const translatedLinks = useMemo(() => NAV_LINKS.map((link) => ({
    ...link,
    label: t(`support.portal.nav.${link.key}`),
    description: t(`support.portal.nav.${link.key}Description`),
  })), [t]);

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f7fafc_0%,#eef5f7_100%)] text-slate-950 dark:bg-[linear-gradient(180deg,#020617_0%,#0f172a_100%)] dark:text-slate-100">
      <Navbar />
      <div className="mx-auto max-w-[1600px] px-4 py-5 sm:px-6 lg:px-8">
        <Motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="overflow-hidden rounded-[2rem] border border-slate-200/80 bg-white shadow-[0_20px_80px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-slate-950/90 dark:shadow-[0_24px_80px_rgba(2,6,23,0.55)]"
        >
          <header className="border-b border-slate-200/80 px-5 py-5 dark:border-white/10 sm:px-6">
            <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-600/80 dark:text-sky-300/80">
                  {t('support.portal.badge')}
                </p>
                <h1 className="mt-3 text-3xl font-semibold tracking-tight">
                  {t('support.portal.title')}
                </h1>
                <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-500 dark:text-slate-400">
                  {t('support.portal.subtitle')}
                </p>
              </div>

              <nav className="flex flex-wrap gap-2">
                {translatedLinks.map((link) => {
                  const Icon = link.icon;
                  const isActive = link.to === '/support'
                    ? location.pathname === '/support' || location.pathname === '/support/'
                    : location.pathname.startsWith(link.to);

                  return (
                    <NavLink
                      key={link.to}
                      to={link.to}
                      className={cn(
                        'flex min-w-[180px] items-start gap-3 rounded-2xl border px-4 py-3 transition',
                        isActive
                          ? 'border-sky-300 bg-sky-50 text-slate-950 shadow-sm dark:border-sky-400/40 dark:bg-sky-500/10 dark:text-white'
                          : 'border-slate-200 bg-slate-50 text-slate-700 hover:border-sky-200 hover:bg-white dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:border-sky-400/30 dark:hover:bg-white/10'
                      )}
                    >
                      <span className={cn(
                        'mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl',
                        isActive
                          ? 'bg-sky-100 text-sky-700 dark:bg-sky-400/20 dark:text-sky-200'
                          : 'bg-white text-slate-600 dark:bg-slate-900 dark:text-slate-300'
                      )}>
                        <Icon className="h-4 w-4" />
                      </span>
                      <span className="min-w-0">
                        <span className="block text-sm font-semibold">{link.label}</span>
                        <span className="mt-1 block text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                          {link.description}
                        </span>
                      </span>
                    </NavLink>
                  );
                })}
              </nav>
            </div>
          </header>

          <main className="min-w-0 px-5 py-5 sm:px-6">
            <Outlet />
          </main>
        </Motion.div>
      </div>
    </div>
  );
}
