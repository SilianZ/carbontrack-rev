import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import {
  Clock3,
  Fingerprint,
  KeyRound,
  Loader2,
  Search,
  ShieldCheck,
  UserRound,
} from 'lucide-react';

import { useTranslation } from '../../hooks/useTranslation';
import { adminAPI } from '../../lib/api';
import { formatDateSafe } from '../../lib/utils';
import { Alert, AlertDescription, AlertTitle } from '../ui/Alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Input } from '../ui/Input';
import { Pagination } from '../ui/Pagination';
import { Badge } from '../ui/badge';

const DEFAULT_FILTERS = {
  q: '',
  page: 1,
  limit: 10,
  sort: 'created_at_desc',
};

function getBackupBadge(t, passkey) {
  if (passkey?.backup_state) {
    return (
      <Badge variant="outline" className="border-emerald-200 bg-emerald-50 text-emerald-700">
        {t('admin.passkeys.backup.synced')}
      </Badge>
    );
  }

  if (passkey?.backup_eligible) {
    return (
      <Badge variant="outline" className="border-amber-200 bg-amber-50 text-amber-700">
        {t('admin.passkeys.backup.available')}
      </Badge>
    );
  }

  return (
    <Badge variant="outline" className="border-slate-200 bg-slate-50 text-slate-600">
      {t('admin.passkeys.backup.unavailable')}
    </Badge>
  );
}

export function PasskeyDirectory() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [filters, setFilters] = React.useState(DEFAULT_FILTERS);

  const passkeysQuery = useQuery(
    ['adminPasskeys', filters],
    () => adminAPI.getPasskeys(filters),
    { keepPreviousData: true }
  );

  const statsQuery = useQuery(
    ['adminPasskeyStats'],
    () => adminAPI.getPasskeyStats()
  );

  const payload = passkeysQuery.data?.data?.data || passkeysQuery.data?.data || {};
  const passkeys = Array.isArray(payload.passkeys) ? payload.passkeys : [];
  const pagination = payload.pagination || {};
  const stats = statsQuery.data?.data?.data || statsQuery.data?.data || {};

  const statCards = [
    {
      key: 'users_with_passkeys',
      label: t('admin.passkeys.stats.usersWithPasskeys'),
      value: stats.users_with_passkeys ?? 0,
      icon: UserRound,
    },
    {
      key: 'total_active_passkeys',
      label: t('admin.passkeys.stats.totalActivePasskeys'),
      value: stats.total_active_passkeys ?? 0,
      icon: Fingerprint,
    },
    {
      key: 'new_passkeys_30d',
      label: t('admin.passkeys.stats.newPasskeys30d'),
      value: stats.new_passkeys_30d ?? 0,
      icon: KeyRound,
    },
    {
      key: 'passkey_logins_7d',
      label: t('admin.passkeys.stats.passkeyLogins7d'),
      value: stats.passkey_logins_7d ?? 0,
      icon: ShieldCheck,
    },
    {
      key: 'passkey_logins_30d',
      label: t('admin.passkeys.stats.passkeyLogins30d'),
      value: stats.passkey_logins_30d ?? 0,
      icon: Clock3,
    },
  ];

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value,
      page: key === 'page' ? value : 1,
    }));
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('admin.passkeys.title')}</h2>
        <p className="text-muted-foreground">{t('admin.passkeys.description')}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <Card key={card.key}>
              <CardContent className="flex items-center justify-between p-5">
                <div className="space-y-1">
                  <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{card.label}</p>
                  <p className="text-2xl font-semibold text-slate-900">
                    {statsQuery.isLoading ? '...' : Number(card.value || 0).toLocaleString()}
                  </p>
                </div>
                <div className="flex h-11 w-11 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
                  <Icon className="h-5 w-5" />
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.passkeys.listTitle')}</CardTitle>
          <CardDescription>{t('admin.passkeys.listDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-[minmax(0,1fr),220px]">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={filters.q}
                onChange={(event) => handleFilterChange('q', event.target.value)}
                placeholder={t('admin.passkeys.searchPlaceholder')}
                className="pl-10"
              />
            </div>
            <select
              value={filters.sort}
              onChange={(event) => handleFilterChange('sort', event.target.value)}
              className="h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
            >
              <option value="created_at_desc">{t('admin.passkeys.sort.createdAtDesc')}</option>
              <option value="last_used_at_desc">{t('admin.passkeys.sort.lastUsedAtDesc')}</option>
              <option value="sign_count_desc">{t('admin.passkeys.sort.signCountDesc')}</option>
            </select>
          </div>

          {passkeysQuery.isError ? (
            <Alert variant="destructive">
              <AlertTitle>{t('common.error')}</AlertTitle>
              <AlertDescription>{t('admin.passkeys.loadError')}</AlertDescription>
            </Alert>
          ) : passkeysQuery.isLoading && !passkeysQuery.data ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : passkeys.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 px-4 py-10 text-center text-sm text-muted-foreground">
              {t('admin.passkeys.empty')}
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-slate-200 text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">{t('admin.passkeys.table.user')}</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">{t('admin.passkeys.table.label')}</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">{t('admin.passkeys.table.createdAt')}</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">{t('admin.passkeys.table.lastUsedAt')}</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">{t('admin.passkeys.table.signCount')}</th>
                      <th className="px-4 py-3 text-left font-medium text-slate-500">{t('admin.passkeys.table.backup')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white">
                    {passkeys.map((passkey) => (
                      <tr key={passkey.id} className="hover:bg-slate-50">
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            className="text-left"
                            onClick={() => navigate(`/admin/users?userUuid=${passkey.user_uuid}`)}
                          >
                            <div className="font-medium text-slate-900">{passkey.username}</div>
                            <div className="text-xs text-slate-500">{passkey.email}</div>
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {passkey.label || t('admin.passkeys.unnamed')}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDateSafe(passkey.created_at, 'yyyy-MM-dd HH:mm', '--')}
                        </td>
                        <td className="px-4 py-3 text-slate-600">
                          {formatDateSafe(passkey.last_used_at, 'yyyy-MM-dd HH:mm', t('admin.passkeys.neverUsed'))}
                        </td>
                        <td className="px-4 py-3 text-slate-700">
                          {Number(passkey.sign_count || 0).toLocaleString()}
                        </td>
                        <td className="px-4 py-3">
                          {getBackupBadge(t, passkey)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <Pagination
                currentPage={pagination.current_page}
                totalPages={pagination.total_pages}
                onPageChange={(page) => handleFilterChange('page', page)}
                itemsPerPage={pagination.per_page}
                totalItems={pagination.total_items}
              />
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

export default PasskeyDirectory;
