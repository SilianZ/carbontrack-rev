import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { useQuery } from 'react-query';

import { useTranslation } from '../../hooks/useTranslation';
import { userAPI } from '../../lib/api';
import { Alert, AlertDescription, AlertTitle } from '../ui/Alert';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Pagination } from '../ui/Pagination';
import SecurityActivityList from '../security/SecurityActivityList';

export function SecurityActivityCard() {
  const { t } = useTranslation();
  const [page, setPage] = React.useState(1);
  const [filters, setFilters] = React.useState({
    type: 'all',
    period: 'all',
  });
  const limit = 10;

  const typeOptions = React.useMemo(
    () => [
      { value: 'all', label: t('securityActivity.filters.types.all') },
      { value: 'sign_ins', label: t('securityActivity.filters.types.signIns') },
      { value: 'passkey_changes', label: t('securityActivity.filters.types.passkeyChanges') },
      { value: 'password_changes', label: t('securityActivity.filters.types.passwordChanges') },
      { value: 'logouts', label: t('securityActivity.filters.types.logouts') },
    ],
    [t]
  );
  const periodOptions = React.useMemo(
    () => [
      { value: 'all', label: t('securityActivity.filters.periods.all') },
      { value: '7d', label: t('securityActivity.filters.periods.last7Days') },
      { value: '30d', label: t('securityActivity.filters.periods.last30Days') },
      { value: '90d', label: t('securityActivity.filters.periods.last90Days') },
    ],
    [t]
  );

  const securityActivityQuery = useQuery(
    ['securityActivity', page, limit, filters.type, filters.period],
    () => userAPI.getSecurityActivity({ page, limit, ...filters }),
    { keepPreviousData: true }
  );

  const payload = securityActivityQuery.data?.data?.data || securityActivityQuery.data?.data || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  const pagination = payload.pagination || {};

  const handleFilterChange = (key, value) => {
    setPage(1);
    setFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-emerald-600" />
          {t('securityActivity.title')}
        </CardTitle>
        <CardDescription>{t('securityActivity.description')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {securityActivityQuery.isError ? (
          <Alert variant="destructive">
            <AlertTitle>{t('common.error')}</AlertTitle>
            <AlertDescription>{t('securityActivity.loadError')}</AlertDescription>
          </Alert>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-foreground">{t('securityActivity.filters.typeLabel')}</span>
                <select
                  value={filters.type}
                  onChange={(event) => handleFilterChange('type', event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {typeOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-foreground">{t('securityActivity.filters.periodLabel')}</span>
                <select
                  value={filters.period}
                  onChange={(event) => handleFilterChange('period', event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {periodOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <SecurityActivityList
              items={items}
              isLoading={securityActivityQuery.isLoading}
              emptyText={t('securityActivity.empty')}
            />
            <Pagination
              currentPage={pagination.current_page}
              totalPages={pagination.total_pages}
              onPageChange={setPage}
              itemsPerPage={pagination.per_page}
              totalItems={pagination.total_items}
            />
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default SecurityActivityCard;
