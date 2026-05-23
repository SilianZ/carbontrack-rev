import Silian_React from 'react';
import {
  Fingerprint as Silian_Fingerprint,
  KeyRound as Silian_KeyRound,
  Loader2 as Silian_Loader2,
  LogIn as Silian_LogIn,
  LogOut as Silian_LogOut,
  Pencil as Silian_Pencil,
  ShieldCheck as Silian_ShieldCheck,
  Trash2 as Silian_Trash2,
} from 'lucide-react';

import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { Badge as Silian_Badge } from '../ui/badge';
import { cn as Silian_cn, formatDateSafe as Silian_formatDateSafe } from '../../lib/utils';

function Silian_getActivityPresentation(Silian_action) {
  switch (Silian_action) {
    case 'login':
      return {
        icon: Silian_LogIn,
        iconClassName: 'bg-blue-500/12 text-blue-500',
      };
    case 'logout':
      return {
        icon: Silian_LogOut,
        iconClassName: 'bg-muted text-muted-foreground',
      };
    case 'password_change':
      return {
        icon: Silian_KeyRound,
        iconClassName: 'bg-amber-500/12 text-amber-500',
      };
    case 'passkey_registered':
      return {
        icon: Silian_Fingerprint,
        iconClassName: 'bg-emerald-500/12 text-emerald-500',
      };
    case 'passkey_deleted':
      return {
        icon: Silian_Trash2,
        iconClassName: 'bg-rose-500/12 text-rose-500',
      };
    case 'passkey_label_updated':
      return {
        icon: Silian_Pencil,
        iconClassName: 'bg-violet-500/12 text-violet-500',
      };
    case 'passkey_login':
    default:
      return {
        icon: Silian_ShieldCheck,
        iconClassName: 'bg-emerald-500/12 text-emerald-500',
      };
  }
}

function Silian_getActivityCopy(Silian_t, Silian_item) {
  const Silian_metadata = Silian_item?.metadata || {};
  const Silian_label = Silian_metadata.new_label || Silian_metadata.label || Silian_metadata.old_label;

  switch (Silian_item?.action) {
    case 'login':
      return {
        title: Silian_t('securityActivity.actions.login.title'),
        description: Silian_t('securityActivity.actions.login.description'),
      };
    case 'logout':
      return {
        title: Silian_t('securityActivity.actions.logout.title'),
        description: Silian_t('securityActivity.actions.logout.description'),
      };
    case 'password_change':
      return {
        title: Silian_t('securityActivity.actions.password_change.title'),
        description: Silian_t('securityActivity.actions.password_change.description'),
      };
    case 'passkey_registered':
      return {
        title: Silian_t('securityActivity.actions.passkey_registered.title'),
        description: Silian_label
          ? Silian_t('securityActivity.actions.passkey_registered.descriptionWithLabel', { label: Silian_label })
          : Silian_t('securityActivity.actions.passkey_registered.description'),
      };
    case 'passkey_deleted':
      return {
        title: Silian_t('securityActivity.actions.passkey_deleted.title'),
        description: Silian_label
          ? Silian_t('securityActivity.actions.passkey_deleted.descriptionWithLabel', { label: Silian_label })
          : Silian_t('securityActivity.actions.passkey_deleted.description'),
      };
    case 'passkey_label_updated':
      return {
        title: Silian_t('securityActivity.actions.passkey_label_updated.title'),
        description: Silian_metadata.new_label
          ? Silian_t('securityActivity.actions.passkey_label_updated.descriptionWithLabel', { label: Silian_metadata.new_label })
          : Silian_t('securityActivity.actions.passkey_label_updated.description'),
      };
    case 'passkey_login':
    default:
      return {
        title: Silian_t('securityActivity.actions.passkey_login.title'),
        description: Silian_label
          ? Silian_t('securityActivity.actions.passkey_login.descriptionWithLabel', { label: Silian_label })
          : Silian_t('securityActivity.actions.passkey_login.description'),
      };
  }
}

export function SecurityActivityList({
  items: Silian_items = [],
  isLoading: Silian_isLoading = false,
  emptyText: Silian_emptyText,
  compact: Silian_compact = false,
  className: Silian_className = '',
}) {
  const { t: Silian_t } = Silian_useTranslation(['common', 'securityActivity']);

  if (Silian_isLoading) {
    return (
      <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
        <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" />
        {Silian_t('common.loading')}
      </div>
    );
  }

  if (!Silian_items.length) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
        {Silian_emptyText || Silian_t('securityActivity.empty')}
      </div>
    );
  }

  return (
    <div className={Silian_cn('space-y-3', Silian_className)}>
      {Silian_items.map((Silian_item) => {
        const Silian_presentation = Silian_getActivityPresentation(Silian_item.action);
        const Silian_copy = Silian_getActivityCopy(Silian_t, Silian_item);
        const Silian_Icon = Silian_presentation.icon;
        const Silian_metaParts = [
          Silian_formatDateSafe(Silian_item.occurred_at, 'yyyy-MM-dd HH:mm'),
          Silian_item.ip_address ? Silian_t('securityActivity.meta.ipAddress', { ip: Silian_item.ip_address }) : null,
          Silian_item.request_id ? Silian_t('securityActivity.meta.requestId', { id: Silian_item.request_id }) : null,
        ].filter(Boolean);

        return (
          <div
            key={Silian_item.id}
            className={Silian_cn(
              'rounded-xl border border-border bg-card',
              Silian_compact ? 'px-3 py-3' : 'px-4 py-4'
            )}
          >
            <div className="flex items-start gap-3">
              <div className={Silian_cn('flex h-10 w-10 shrink-0 items-center justify-center rounded-full', Silian_presentation.iconClassName)}>
                <Silian_Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium text-foreground">{Silian_copy.title}</p>
                  <Silian_Badge
                    variant="outline"
                    className={Silian_cn(
                      'border-emerald-500/20 bg-emerald-500/10 text-emerald-500',
                      Silian_item.status !== 'success' && 'border-rose-500/20 bg-rose-500/10 text-rose-500'
                    )}
                  >
                    {Silian_item.status === 'success' ? Silian_t('securityActivity.status.success') : Silian_t('securityActivity.status.other')}
                  </Silian_Badge>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{Silian_copy.description}</p>
                {Silian_metaParts.length > 0 && (
                  <p className="mt-2 text-xs text-muted-foreground">{Silian_metaParts.join(' · ')}</p>
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
