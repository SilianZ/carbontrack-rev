import Silian_React from 'react';
import { ShieldCheck as Silian_ShieldCheck } from 'lucide-react';
import { useQuery as Silian_useQuery } from 'react-query';

import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { userAPI as Silian_userAPI } from '../../lib/api';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription, AlertTitle as Silian_AlertTitle } from '../ui/Alert';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../ui/Card';
import { Pagination as Silian_Pagination } from '../ui/Pagination';
import Silian_SecurityActivityList from '../security/SecurityActivityList';

export function SecurityActivityCard() {
  const { t: Silian_t } = Silian_useTranslation(['common', 'pagination', 'securityActivity']);
  const [Silian_page, Silian_setPage] = Silian_React.useState(1);
  const [Silian_filters, Silian_setFilters] = Silian_React.useState({
    type: 'all',
    period: 'all',
  });
  const Silian_limit = 10;

  const Silian_typeOptions = Silian_React.useMemo(
    () => [
      { value: 'all', label: Silian_t('securityActivity.filters.types.all') },
      { value: 'sign_ins', label: Silian_t('securityActivity.filters.types.signIns') },
      { value: 'passkey_changes', label: Silian_t('securityActivity.filters.types.passkeyChanges') },
      { value: 'password_changes', label: Silian_t('securityActivity.filters.types.passwordChanges') },
      { value: 'logouts', label: Silian_t('securityActivity.filters.types.logouts') },
    ],
    [Silian_t]
  );
  const Silian_periodOptions = Silian_React.useMemo(
    () => [
      { value: 'all', label: Silian_t('securityActivity.filters.periods.all') },
      { value: '7d', label: Silian_t('securityActivity.filters.periods.last7Days') },
      { value: '30d', label: Silian_t('securityActivity.filters.periods.last30Days') },
      { value: '90d', label: Silian_t('securityActivity.filters.periods.last90Days') },
    ],
    [Silian_t]
  );

  const Silian_securityActivityQuery = Silian_useQuery(
    ['securityActivity', Silian_page, Silian_limit, Silian_filters.type, Silian_filters.period],
    () => Silian_userAPI.getSecurityActivity({ page: Silian_page, limit: Silian_limit, ...Silian_filters }),
    { keepPreviousData: true }
  );

  const Silian_payload = Silian_securityActivityQuery.data?.data?.data || Silian_securityActivityQuery.data?.data || {};
  const Silian_items = Array.isArray(Silian_payload.items) ? Silian_payload.items : [];
  const Silian_pagination = Silian_payload.pagination || {};

  const Silian_handleFilterChange = (Silian_key, Silian_value) => {
    Silian_setPage(1);
    Silian_setFilters((Silian_prev) => ({
      ...Silian_prev,
      [Silian_key]: Silian_value,
    }));
  };

  return (
    <Silian_Card>
      <Silian_CardHeader>
        <Silian_CardTitle className="flex items-center gap-2">
          <Silian_ShieldCheck className="h-5 w-5 text-emerald-600" />
          {Silian_t('securityActivity.title')}
        </Silian_CardTitle>
        <Silian_CardDescription>{Silian_t('securityActivity.description')}</Silian_CardDescription>
      </Silian_CardHeader>
      <Silian_CardContent className="space-y-4">
        {Silian_securityActivityQuery.isError ? (
          <Silian_Alert variant="destructive">
            <Silian_AlertTitle>{Silian_t('common.error')}</Silian_AlertTitle>
            <Silian_AlertDescription>{Silian_t('securityActivity.loadError')}</Silian_AlertDescription>
          </Silian_Alert>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="space-y-1 text-sm">
                <span className="font-medium text-foreground">{Silian_t('securityActivity.filters.typeLabel')}</span>
                <select
                  value={Silian_filters.type}
                  onChange={(Silian_event) => Silian_handleFilterChange('type', Silian_event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {Silian_typeOptions.map((Silian_option) => (
                    <option key={Silian_option.value} value={Silian_option.value}>
                      {Silian_option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="space-y-1 text-sm">
                <span className="font-medium text-foreground">{Silian_t('securityActivity.filters.periodLabel')}</span>
                <select
                  value={Silian_filters.period}
                  onChange={(Silian_event) => Silian_handleFilterChange('period', Silian_event.target.value)}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                >
                  {Silian_periodOptions.map((Silian_option) => (
                    <option key={Silian_option.value} value={Silian_option.value}>
                      {Silian_option.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            <Silian_SecurityActivityList
              items={Silian_items}
              isLoading={Silian_securityActivityQuery.isLoading}
              emptyText={Silian_t('securityActivity.empty')}
            />
            <Silian_Pagination
              currentPage={Silian_pagination.current_page}
              totalPages={Silian_pagination.total_pages}
              onPageChange={Silian_setPage}
              itemsPerPage={Silian_pagination.per_page}
              totalItems={Silian_pagination.total_items}
            />
          </>
        )}
      </Silian_CardContent>
    </Silian_Card>
  );
}

export default SecurityActivityCard;
