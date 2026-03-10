import React from 'react';
import {
  Fingerprint,
  KeyRound,
  Loader2,
  LogIn,
  LogOut,
  Pencil,
  ShieldCheck,
  Trash2,
} from 'lucide-react';

import { useTranslation } from '../../hooks/useTranslation';
import { Badge } from '../ui/badge';
import { cn, formatDateSafe } from '../../lib/utils';

function getActivityPresentation(action) {
  switch (action) {
    case 'login':
      return {
        icon: LogIn,
        iconClassName: 'bg-blue-50 text-blue-600',
      };
    case 'logout':
      return {
        icon: LogOut,
        iconClassName: 'bg-slate-100 text-slate-600',
      };
    case 'password_change':
      return {
        icon: KeyRound,
        iconClassName: 'bg-amber-50 text-amber-600',
      };
    case 'passkey_registered':
      return {
        icon: Fingerprint,
        iconClassName: 'bg-emerald-50 text-emerald-600',
      };
    case 'passkey_deleted':
      return {
        icon: Trash2,
        iconClassName: 'bg-rose-50 text-rose-600',
      };
    case 'passkey_label_updated':
      return {
        icon: Pencil,
        iconClassName: 'bg-violet-50 text-violet-600',
      };
    case 'passkey_login':
    default:
      return {
        icon: ShieldCheck,
        iconClassName: 'bg-emerald-50 text-emerald-600',
      };
  }
}

function getActivityCopy(t, item) {
  const metadata = item?.metadata || {};
  const label = metadata.new_label || metadata.label || metadata.old_label;

  switch (item?.action) {
    case 'login':
      return {
        title: t('securityActivity.actions.login.title'),
        description: t('securityActivity.actions.login.description'),
      };
    case 'logout':
      return {
        title: t('securityActivity.actions.logout.title'),
        description: t('securityActivity.actions.logout.description'),
      };
    case 'password_change':
      return {
        title: t('securityActivity.actions.password_change.title'),
        description: t('securityActivity.actions.password_change.description'),
      };
    case 'passkey_registered':
      return {
        title: t('securityActivity.actions.passkey_registered.title'),
        description: label
          ? t('securityActivity.actions.passkey_registered.descriptionWithLabel', { label })
          : t('securityActivity.actions.passkey_registered.description'),
      };
    case 'passkey_deleted':
      return {
        title: t('securityActivity.actions.passkey_deleted.title'),
        description: label
          ? t('securityActivity.actions.passkey_deleted.descriptionWithLabel', { label })
          : t('securityActivity.actions.passkey_deleted.description'),
      };
    case 'passkey_label_updated':
      return {
        title: t('securityActivity.actions.passkey_label_updated.title'),
        description: metadata.new_label
          ? t('securityActivity.actions.passkey_label_updated.descriptionWithLabel', { label: metadata.new_label })
          : t('securityActivity.actions.passkey_label_updated.description'),
      };
    case 'passkey_login':
    default:
      return {
        title: t('securityActivity.actions.passkey_login.title'),
        description: label
          ? t('securityActivity.actions.passkey_login.descriptionWithLabel', { label })
          : t('securityActivity.actions.passkey_login.description'),
      };
  }
}

export function SecurityActivityList({
  items = [],
  isLoading = false,
  emptyText,
  compact = false,
  className = '',
}) {
  const { t } = useTranslation();

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {t('common.loading')}
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-muted-foreground">
        {emptyText || t('securityActivity.empty')}
      </div>
    );
  }

  return (
    <div className={cn('space-y-3', className)}>
      {items.map((item) => {
        const presentation = getActivityPresentation(item.action);
        const copy = getActivityCopy(t, item);
        const Icon = presentation.icon;
        const metaParts = [
          formatDateSafe(item.occurred_at, 'yyyy-MM-dd HH:mm'),
          item.ip_address ? t('securityActivity.meta.ipAddress', { ip: item.ip_address }) : null,
          item.request_id ? t('securityActivity.meta.requestId', { id: item.request_id }) : null,
        ].filter(Boolean);

        return (
          <div
            key={item.id}
            className={cn(
              'rounded-xl border border-slate-200 bg-white',
              compact ? 'px-3 py-3' : 'px-4 py-4'
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', presentation.iconClassName)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-slate-900">{copy.title}</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      'border-emerald-200 bg-emerald-50 text-emerald-700',
                      item.status !== 'success' && 'border-rose-200 bg-rose-50 text-rose-700'
                    )}
                  >
                    {item.status === 'success' ? t('securityActivity.status.success') : t('securityActivity.status.other')}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-slate-600">{copy.description}</p>
                {metaParts.length > 0 && (
                  <p className="mt-2 text-xs text-slate-500">{metaParts.join(' · ')}</p>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export default SecurityActivityList;
