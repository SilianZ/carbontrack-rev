import React from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';

export default function FloatingActionButton({ to = '/calculate' }) {
  const { t } = useTranslation(['home']);

  return (
    <Link
      to={to}
      className="fixed right-6 bottom-6 z-40 inline-flex items-center gap-2 rounded-full bg-gradient-to-br from-emerald-500 to-blue-500 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-emerald-500/30 transition-transform duration-300 hover:scale-105 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-emerald-400"
    >
      <Plus className="h-5 w-5" />
      <span className="hidden sm:inline">{t('home.fab.label')}</span>
    </Link>
  );
}
