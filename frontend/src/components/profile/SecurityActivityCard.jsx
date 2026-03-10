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
  const limit = 10;

  const securityActivityQuery = useQuery(
    ['securityActivity', page, limit],
    () => userAPI.getSecurityActivity({ page, limit }),
    { keepPreviousData: true }
  );

  const payload = securityActivityQuery.data?.data?.data || securityActivityQuery.data?.data || {};
  const items = Array.isArray(payload.items) ? payload.items : [];
  const pagination = payload.pagination || {};

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
