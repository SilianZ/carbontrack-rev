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
        iconClassName: 'bg-blue-500/12 text-blue-500',
      };
    case 'logout':
      return {
        icon: LogOut,
        iconClassName: 'bg-muted text-muted-foreground',
      };
    case 'password_change':
      return {
        icon: KeyRound,
        iconClassName: 'bg-amber-500/12 text-amber-500',
      };
    case 'passkey_registered':
      return {
        icon: Fingerprint,
        iconClassName: 'bg-emerald-500/12 text-emerald-500',
      };
    case 'passkey_deleted':
      return {
        icon: Trash2,
        iconClassName: 'bg-rose-500/12 text-rose-500',
      };
    case 'passkey_label_updated':
      return {
        icon: Pencil,
        iconClassName: 'bg-violet-500/12 text-violet-500',
      };
    case 'passkey_login':
    default:
      return {
        icon: ShieldCheck,
        iconClassName: 'bg-emerald-500/12 text-emerald-500',
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
  const { t } = useTranslation(['common', 'securityActivity']);

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
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
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
              'rounded-xl border border-border bg-card',
              compact ? 'px-3 py-3' : 'px-4 py-4'
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', presentation.iconClassName)}>
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{copy.title}</p>
                  <Badge
                    variant="outline"
                    className={cn(
                      'border-emerald-500/20 bg-emerald-500/10 text-emerald-500',
                      item.status !== 'success' && 'border-rose-500/20 bg-rose-500/10 text-rose-500'
                    )}
                  >
                    {item.status === 'success' ? t('securityActivity.status.success') : t('securityActivity.status.other')}
                  </Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{copy.description}</p>
                {metaParts.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">{metaParts.join(' · ')}</p>
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
