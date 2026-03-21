import React, { useEffect, useMemo, useState } from 'react';
import { useQuery } from 'react-query';
import { format } from 'date-fns';
import { adminAPI } from '@/lib/api';
import { useTranslation } from '@/hooks/useTranslation';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/Input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Pagination } from '@/components/ui/Pagination';
import { Badge } from '@/components/ui/badge';
import { Loader2, Search, Users } from 'lucide-react';

const DEFAULT_PAGINATION = {
  current_page: 1,
  per_page: 10,
  total_items: 0,
  total_pages: 0,
};

const STATUS_OPTIONS = [
  { value: 'awarded', i18n: 'admin.badges.recipients.status.awarded', fallback: '已授予' },
  { value: 'revoked', i18n: 'admin.badges.recipients.status.revoked', fallback: '已收回' },
  { value: 'all', i18n: 'admin.badges.recipients.status.all', fallback: '全部' },
];

function BadgeRecipientsDialog({ open, onOpenChange, badge }) {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({ search: '', status: 'awarded', page: 1 });

  useEffect(() => {
    if (!open) {
      setFilters({ search: '', status: 'awarded', page: 1 });
    }
  }, [open]);

  const query = useQuery(
    ['badgeRecipients', badge?.id, filters],
    () =>
      adminAPI
        .getBadgeRecipients(Number(badge?.id), {
          page: filters.page,
          per_page: 10,
          status: filters.status === 'all' ? undefined : filters.status,
          search: filters.search || undefined,
          include_revoked: filters.status !== 'awarded',
        })
        .then((res) => res.data?.data),
    {
      enabled: open && Boolean(badge?.id),
      keepPreviousData: true,
      select: (data) => {
        if (!data) {
          return { items: [], pagination: DEFAULT_PAGINATION, badge: null };
        }
        return {
          items: Array.isArray(data.items) ? data.items : [],
          pagination: data.pagination || DEFAULT_PAGINATION,
          badge: data.badge || badge || null,
        };
      },
    }
  );

  const recipients = query.data?.items || [];
  const pagination = query.data?.pagination || DEFAULT_PAGINATION;

  const handleSearchChange = (event) => {
    const value = event.target.value;
    setFilters((prev) => ({ ...prev, search: value, page: 1 }));
  };

  const handleStatusChange = (value) => {
    setFilters((prev) => ({ ...prev, status: value, page: 1 }));
  };

  const handlePageChange = (page) => {
    setFilters((prev) => ({ ...prev, page }));
  };

  const dialogTitle = useMemo(() => {
    if (!badge) {
      return t('admin.badges.recipients.title');
    }
    return t('admin.badges.recipients.titleWithName', {
      name: badge.name_zh || badge.name_en || badge.code || `#${badge.id}`,
    });
  }, [badge, t]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>{dialogTitle}</DialogTitle>
          <DialogDescription>
            {t('admin.badges.recipients.subtitle')}
          </DialogDescription>
        </DialogHeader>

        {query.isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {t('common.loading')}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    value={filters.search}
                    onChange={handleSearchChange}
                    placeholder={t('admin.badges.recipients.searchPlaceholder')}
                    className="pl-9"
                  />
                </div>
                <Select value={filters.status} onValueChange={handleStatusChange}>
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUS_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.i18n)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>
                  {t('admin.badges.recipients.totalCount',  { count: pagination.total_items || 0 })}
                </span>
              </div>
            </div>

            {query.error ? (
              <p className="text-sm text-destructive">{t('admin.badges.recipients.loadFailed')}</p>
            ) : recipients.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium uppercase tracking-wide text-muted-foreground">
                        {t('admin.badges.recipients.table.username')}
                      </th>
                      <th className="px-4 py-2 text-left font-medium uppercase tracking-wide text-muted-foreground">
                        {t('admin.badges.recipients.table.email')}
                      </th>
                      <th className="px-4 py-2 text-left font-medium uppercase tracking-wide text-muted-foreground">
                        {t('admin.badges.recipients.table.status')}
                      </th>
                      <th className="px-4 py-2 text-left font-medium uppercase tracking-wide text-muted-foreground">
                        {t('admin.badges.recipients.table.awardedAt')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {recipients.map((entry) => {
                      const user = entry.user || {};
                      const record = entry.user_badge || {};
                      const status = record.status || 'awarded';
                      const awardedAt = record.awarded_at ? format(new Date(record.awarded_at), 'yyyy-MM-dd HH:mm') : '--';

                      return (
                        <tr key={`${user.id}-${record.awarded_at || record.status || 'row'}`} className="transition-colors hover:bg-muted/40">
                          <td className="px-4 py-2 font-medium text-foreground">{user.username || '-'}</td>
                          <td className="px-4 py-2 text-muted-foreground">{user.email || '-'}</td>
                          <td className="px-4 py-2">
                            <Badge variant={status === 'awarded' ? 'success' : 'secondary'}>
                              {status === 'awarded'
                                ? t('admin.badges.recipients.status.awarded')
                                : t('admin.badges.recipients.status.revoked')}
                            </Badge>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">{awardedAt}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {t('admin.badges.recipients.empty')}
              </p>
            )}

            <Pagination
              currentPage={pagination.current_page}
              totalPages={pagination.total_pages}
              onPageChange={handlePageChange}
              itemsPerPage={pagination.per_page}
              totalItems={pagination.total_items}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default BadgeRecipientsDialog;
