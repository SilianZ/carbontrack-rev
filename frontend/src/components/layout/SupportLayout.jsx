import React, { useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { Headset, Inbox, Sparkles } from 'lucide-react';
import { motion as Motion } from 'framer-motion';

import { Navbar } from './Navbar';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';

const NAV_LINKS = [
  {
    key: 'queue',
    to: '/support/tickets',
    icon: Inbox
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

  const activeLink = translatedLinks.find((link) => location.pathname.startsWith(link.to)) ?? translatedLinks[0];

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <Navbar />
      <div className="relative min-h-[calc(100vh-4rem)] overflow-hidden">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(14,165,233,0.18),_transparent_35%),radial-gradient(circle_at_top_right,_rgba(249,115,22,0.2),_transparent_30%),linear-gradient(180deg,_rgba(15,23,42,0.98),_rgba(2,6,23,1))]" />
        <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl gap-8 px-4 py-6 sm:px-6 lg:grid-cols-[280px_minmax(0,1fr)] lg:px-8">
          <Motion.aside
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.28, ease: 'easeOut' }}
            className="flex h-fit flex-col rounded-[2rem] border border-white/10 bg-white/5 p-5 backdrop-blur-xl"
          >
            <div className="flex items-start gap-3 border-b border-white/10 pb-5">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-400 to-orange-400 text-slate-950 shadow-lg shadow-sky-500/20">
                <Headset className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-200/80">
                  {t('support.portal.badge')}
                </p>
                <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white">
                  {t('support.portal.title')}
                </h1>
                <p className="mt-2 text-sm leading-relaxed text-slate-300">
                  {t('support.portal.subtitle')}
                </p>
              </div>
            </div>

            <nav className="mt-5 space-y-2">
              {translatedLinks.map((link) => {
                const Icon = link.icon;
                const isActive = location.pathname.startsWith(link.to);

                return (
                  <NavLink
                    key={link.to}
                    to={link.to}
                    className={cn(
                      'group flex items-start gap-3 rounded-2xl border border-transparent px-4 py-3 transition-all duration-200',
                      isActive
                        ? 'border-sky-300/25 bg-sky-400/10 text-white'
                        : 'text-slate-300 hover:border-white/10 hover:bg-white/5 hover:text-white'
                    )}
                  >
                    <span className={cn(
                      'mt-0.5 flex h-10 w-10 items-center justify-center rounded-2xl bg-white/8 text-slate-200 transition-colors',
                      isActive && 'bg-sky-300/15 text-sky-100'
                    )}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium">{link.label}</span>
                      <span className="mt-1 block text-xs leading-relaxed text-slate-400 group-hover:text-slate-300">
                        {link.description}
                      </span>
                    </span>
                  </NavLink>
                );
              })}
            </nav>

            <div className="mt-6 rounded-[1.5rem] border border-orange-300/15 bg-orange-400/10 p-4 text-sm text-slate-200">
              <div className="flex items-center gap-2 font-medium text-orange-100">
                <Sparkles className="h-4 w-4" />
                {t('support.portal.tipTitle')}
              </div>
              <p className="mt-2 leading-relaxed text-slate-300">
                {t('support.portal.tip')}
              </p>
            </div>
          </Motion.aside>

          <Motion.section
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.32, ease: 'easeOut', delay: 0.04 }}
            className="min-w-0 rounded-[2rem] border border-white/10 bg-white text-slate-950 shadow-2xl shadow-slate-950/30 dark:bg-slate-900 dark:text-slate-100"
          >
            <header className="border-b border-slate-200/80 px-6 py-5 dark:border-slate-800">
              <p className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-400">
                {t('support.portal.currentView')}
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight">
                {activeLink?.label}
              </h2>
              <p className="mt-1 max-w-2xl text-sm text-slate-500 dark:text-slate-400">
                {activeLink?.description}
              </p>
            </header>
            <main className="min-w-0 px-6 py-6">
              <Outlet />
            </main>
          </Motion.section>
        </div>
      </div>
    </div>
  );
}
