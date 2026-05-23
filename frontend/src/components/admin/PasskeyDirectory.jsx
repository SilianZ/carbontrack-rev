import Silian_React from 'react';
import { useNavigate as Silian_useNavigate } from 'react-router-dom';
import { useQuery as Silian_useQuery } from 'react-query';
import {
  Clock3 as Silian_Clock3,
  Fingerprint as Silian_Fingerprint,
  KeyRound as Silian_KeyRound,
  Loader2 as Silian_Loader2,
  Search as Silian_Search,
  ShieldCheck as Silian_ShieldCheck,
  UserRound as Silian_UserRound,
} from 'lucide-react';

import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { adminAPI as Silian_adminAPI } from '../../lib/api';
import { formatDateSafe as Silian_formatDateSafe } from '../../lib/utils';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription, AlertTitle as Silian_AlertTitle } from '../ui/Alert';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../ui/Card';
import { Input as Silian_Input } from '../ui/Input';
import { Pagination as Silian_Pagination } from '../ui/Pagination';
import { Badge as Silian_Badge } from '../ui/badge';

const Silian_DEFAULT_FILTERS = {
  q: '',
  page: 1,
  limit: 10,
  sort: 'created_at_desc',
};

function Silian_getBackupBadge(Silian_t, Silian_passkey) {
  if (Silian_passkey?.backup_state) {
    return (
      <Silian_Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
        {Silian_t('admin.passkeys.backup.synced')}
      </Silian_Badge>
    );
  }

  if (Silian_passkey?.backup_eligible) {
    return (
      <Silian_Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300">
        {Silian_t('admin.passkeys.backup.available')}
      </Silian_Badge>
    );
  }

  return (
    <Silian_Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600 dark:border-border dark:bg-muted dark:text-muted-foreground">
      {Silian_t('admin.passkeys.backup.unavailable')}
    </Silian_Badge>
  );
}

export function PasskeyDirectory() {
  const { t: Silian_t } = Silian_useTranslation(['admin', 'common', 'pagination']);
  const Silian_navigate = Silian_useNavigate();
  const [Silian_filters, Silian_setFilters] = Silian_React.useState(Silian_DEFAULT_FILTERS);

  const Silian_passkeysQuery = Silian_useQuery(
    ['adminPasskeys', Silian_filters],
    () => Silian_adminAPI.getPasskeys(Silian_filters),
    { keepPreviousData: true }
  );

  const Silian_statsQuery = Silian_useQuery(
    ['adminPasskeyStats'],
    () => Silian_adminAPI.getPasskeyStats()
  );

  const Silian_payload = Silian_passkeysQuery.data?.data?.data || Silian_passkeysQuery.data?.data || {};
  const Silian_passkeys = Array.isArray(Silian_payload.passkeys) ? Silian_payload.passkeys : [];
  const Silian_pagination = Silian_payload.pagination || {};
  const Silian_stats = Silian_statsQuery.data?.data?.data || Silian_statsQuery.data?.data || {};

  const Silian_statCards = [
    {
      key: 'users_with_passkeys',
      label: Silian_t('admin.passkeys.stats.usersWithPasskeys'),
      value: Silian_stats.users_with_passkeys ?? 0,
      icon: Silian_UserRound,
    },
    {
      key: 'total_active_passkeys',
      label: Silian_t('admin.passkeys.stats.totalActivePasskeys'),
      value: Silian_stats.total_active_passkeys ?? 0,
      icon: Silian_Fingerprint,
    },
    {
      key: 'new_passkeys_30d',
      label: Silian_t('admin.passkeys.stats.newPasskeys30d'),
      value: Silian_stats.new_passkeys_30d ?? 0,
      icon: Silian_KeyRound,
    },
    {
      key: 'passkey_logins_7d',
      label: Silian_t('admin.passkeys.stats.passkeyLogins7d'),
      value: Silian_stats.passkey_logins_7d ?? 0,
      icon: Silian_ShieldCheck,
    },
    {
      key: 'passkey_logins_30d',
      label: Silian_t('admin.passkeys.stats.passkeyLogins30d'),
      value: Silian_stats.passkey_logins_30d ?? 0,
      icon: Silian_Clock3,
    },
  ];

  const Silian_handleFilterChange = (Silian_key, Silian_value) => {
    Silian_setFilters((Silian_prev) => ({
      ...Silian_prev,
      [Silian_key]: Silian_value,
      page: Silian_key === 'page' ? Silian_value : 1,
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{Silian_t('admin.passkeys.title')}</h2>
        <p className="text-muted-foreground">{Silian_t('admin.passkeys.description')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {Silian_statCards.map((Silian_card) => {
          const Silian_Icon = Silian_card.icon;
          return (
            <Silian_Card key={Silian_card.key}>
              <Silian_CardContent className="flex items-center justify-between p-5">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{Silian_card.label}</p>
                  <p className="text-2xl font-semibold text-foreground">
                    {Silian_statsQuery.isLoading ? '...' : Number(Silian_card.value || 0).toLocaleString()}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300">
                  <Silian_Icon className="h-5 w-5" />
                </div>
              </Silian_CardContent>
            </Silian_Card>
          );
        })}
      </div>

      <Silian_Card>
        <Silian_CardHeader>
          <Silian_CardTitle>{Silian_t('admin.passkeys.listTitle')}</Silian_CardTitle>
          <Silian_CardDescription>{Silian_t('admin.passkeys.listDescription')}</Silian_CardDescription>
        </Silian_CardHeader>
        <Silian_CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),220px]">
            <div className="relative">
              <Silian_Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Silian_Input
                value={Silian_filters.q}
                onChange={(Silian_event) => Silian_handleFilterChange('q', Silian_event.target.value)}
                placeholder={Silian_t('admin.passkeys.searchPlaceholder')}
                className="pl-10"
              />
            </div>
            <select
              value={Silian_filters.sort}
              onChange={(Silian_event) => Silian_handleFilterChange('sort', Silian_event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="created_at_desc">{Silian_t('admin.passkeys.sort.createdAtDesc')}</option>
              <option value="last_used_at_desc">{Silian_t('admin.passkeys.sort.lastUsedAtDesc')}</option>
              <option value="sign_count_desc">{Silian_t('admin.passkeys.sort.signCountDesc')}</option>
            </select>
          </div>

          {Silian_passkeysQuery.isError ? (
            <Silian_Alert variant="destructive">
              <Silian_AlertTitle>{Silian_t('common.error')}</Silian_AlertTitle>
              <Silian_AlertDescription>{Silian_t('admin.passkeys.loadError')}</Silian_AlertDescription>
            </Silian_Alert>
          ) : Silian_passkeysQuery.isLoading && !Silian_passkeysQuery.data ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {Silian_t('common.loading')}
            </div>
          ) : Silian_passkeys.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border bg-muted/40 px-4 py-10 text-center text-sm text-muted-foreground">
              {Silian_t('admin.passkeys.empty')}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{Silian_t('admin.passkeys.table.user')}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{Silian_t('admin.passkeys.table.label')}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{Silian_t('admin.passkeys.table.createdAt')}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{Silian_t('admin.passkeys.table.lastUsedAt')}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{Silian_t('admin.passkeys.table.signCount')}</th>
                      <th className="px-4 py-3 text-left font-medium text-muted-foreground">{Silian_t('admin.passkeys.table.backup')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {Silian_passkeys.map((Silian_passkey) => (
                      <tr key={Silian_passkey.id} className="transition-colors hover:bg-muted/40">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="text-left"
                            onClick={() => Silian_navigate(`/admin/users?userUuid=${Silian_passkey.user_uuid}`)}
                          >
                            <div className="font-medium text-foreground">{Silian_passkey.username}</div>
                            <div className="text-xs text-muted-foreground">{Silian_passkey.email}</div>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-foreground/80">
                          {Silian_passkey.label || Silian_t('admin.passkeys.unnamed')}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {Silian_formatDateSafe(Silian_passkey.created_at, 'yyyy-MM-dd HH:mm', '--')}
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {Silian_formatDateSafe(Silian_passkey.last_used_at, 'yyyy-MM-dd HH:mm', Silian_t('admin.passkeys.neverUsed'))}
                        </td>
                        <td className="px-4 py-3 text-foreground/80">
                          {Number(Silian_passkey.sign_count || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          {Silian_getBackupBadge(Silian_t, Silian_passkey)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Silian_Pagination
                currentPage={Silian_pagination.current_page}
                totalPages={Silian_pagination.total_pages}
                onPageChange={(Silian_page) => Silian_handleFilterChange('page', Silian_page)}
                itemsPerPage={Silian_pagination.per_page}
                totalItems={Silian_pagination.total_items}
              />
            </>
          )}
        </Silian_CardContent>
      </Silian_Card>
    </div>
  );
}

export default PasskeyDirectory;
