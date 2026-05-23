import Silian_React, { useEffect as Silian_useEffect, useMemo as Silian_useMemo, useState as Silian_useState } from 'react';
import { useQuery as Silian_useQuery } from 'react-query';
import { format as Silian_format } from 'date-fns';
import { adminAPI as Silian_adminAPI } from '@/lib/api';
import { useTranslation as Silian_useTranslation } from '@/hooks/useTranslation';
import { Dialog as Silian_Dialog, DialogContent as Silian_DialogContent, DialogDescription as Silian_DialogDescription, DialogHeader as Silian_DialogHeader, DialogTitle as Silian_DialogTitle } from '@/components/ui/dialog';
import { Input as Silian_Input } from '@/components/ui/Input';
import { Select as Silian_Select, SelectContent as Silian_SelectContent, SelectItem as Silian_SelectItem, SelectTrigger as Silian_SelectTrigger, SelectValue as Silian_SelectValue } from '@/components/ui/select';
import { Pagination as Silian_Pagination } from '@/components/ui/Pagination';
import { Badge as Silian_Badge } from '@/components/ui/badge';
import { Loader2 as Silian_Loader2, Search as Silian_Search, Users as Silian_Users } from 'lucide-react';

const Silian_DEFAULT_PAGINATION = {
  current_page: 1,
  per_page: 10,
  total_items: 0,
  total_pages: 0,
};

const Silian_STATUS_OPTIONS = [
  { value: 'awarded', i18n: 'admin.badges.recipients.status.awarded', fallback: '已授予' },
  { value: 'revoked', i18n: 'admin.badges.recipients.status.revoked', fallback: '已收回' },
  { value: 'all', i18n: 'admin.badges.recipients.status.all', fallback: '全部' },
];

function Silian_BadgeRecipientsDialog({ open: Silian_open, onOpenChange: Silian_onOpenChange, badge: Silian_badge }) {
  const { t: Silian_t } = Silian_useTranslation(['admin', 'common', 'pagination']);
  const [Silian_filters, Silian_setFilters] = Silian_useState({ search: '', status: 'awarded', page: 1 });

  Silian_useEffect(() => {
    if (!Silian_open) {
      Silian_setFilters({ search: '', status: 'awarded', page: 1 });
    }
  }, [Silian_open]);

  const Silian_query = Silian_useQuery(
    ['badgeRecipients', Silian_badge?.id, Silian_filters],
    () =>
      Silian_adminAPI
        .getBadgeRecipients(Number(Silian_badge?.id), {
          page: Silian_filters.page,
          per_page: 10,
          status: Silian_filters.status === 'all' ? undefined : Silian_filters.status,
          search: Silian_filters.search || undefined,
          include_revoked: Silian_filters.status !== 'awarded',
        })
        .then((Silian_res) => Silian_res.data?.data),
    {
      enabled: Silian_open && Boolean(Silian_badge?.id),
      keepPreviousData: true,
      select: (Silian_data) => {
        if (!Silian_data) {
          return { items: [], pagination: Silian_DEFAULT_PAGINATION, badge: null };
        }
        return {
          items: Array.isArray(Silian_data.items) ? Silian_data.items : [],
          pagination: Silian_data.pagination || Silian_DEFAULT_PAGINATION,
          badge: Silian_data.badge || Silian_badge || null,
        };
      },
    }
  );

  const Silian_recipients = Silian_query.data?.items || [];
  const Silian_pagination = Silian_query.data?.pagination || Silian_DEFAULT_PAGINATION;

  const Silian_handleSearchChange = (Silian_event) => {
    const Silian_value = Silian_event.target.value;
    Silian_setFilters((Silian_prev) => ({ ...Silian_prev, search: Silian_value, page: 1 }));
  };

  const Silian_handleStatusChange = (Silian_value) => {
    Silian_setFilters((Silian_prev) => ({ ...Silian_prev, status: Silian_value, page: 1 }));
  };

  const Silian_handlePageChange = (Silian_page) => {
    Silian_setFilters((Silian_prev) => ({ ...Silian_prev, page: Silian_page }));
  };

  const Silian_dialogTitle = Silian_useMemo(() => {
    if (!Silian_badge) {
      return Silian_t('admin.badges.recipients.title');
    }
    return Silian_t('admin.badges.recipients.titleWithName', {
      name: Silian_badge.name_zh || Silian_badge.name_en || Silian_badge.code || `#${Silian_badge.id}`,
    });
  }, [Silian_badge, Silian_t]);

  return (
    <Silian_Dialog open={Silian_open} onOpenChange={Silian_onOpenChange}>
      <Silian_DialogContent className="max-w-3xl">
        <Silian_DialogHeader>
          <Silian_DialogTitle>{Silian_dialogTitle}</Silian_DialogTitle>
          <Silian_DialogDescription>
            {Silian_t('admin.badges.recipients.subtitle')}
          </Silian_DialogDescription>
        </Silian_DialogHeader>

        {Silian_query.isLoading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
            <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" />
            {Silian_t('common.loading')}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-1 items-center gap-2">
                <div className="relative flex-1">
                  <Silian_Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Silian_Input
                    value={Silian_filters.search}
                    onChange={Silian_handleSearchChange}
                    placeholder={Silian_t('admin.badges.recipients.searchPlaceholder')}
                    className="pl-9"
                  />
                </div>
                <Silian_Select value={Silian_filters.status} onValueChange={Silian_handleStatusChange}>
                  <Silian_SelectTrigger className="w-[140px]">
                    <Silian_SelectValue />
                  </Silian_SelectTrigger>
                  <Silian_SelectContent>
                    {Silian_STATUS_OPTIONS.map((Silian_option) => (
                      <Silian_SelectItem key={Silian_option.value} value={Silian_option.value}>
                        {Silian_t(Silian_option.i18n)}
                      </Silian_SelectItem>
                    ))}
                  </Silian_SelectContent>
                </Silian_Select>
              </div>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Silian_Users className="h-4 w-4" />
                <span>
                  {Silian_t('admin.badges.recipients.totalCount',  { count: Silian_pagination.total_items || 0 })}
                </span>
              </div>
            </div>

            {Silian_query.error ? (
              <p className="text-sm text-destructive">{Silian_t('admin.badges.recipients.loadFailed')}</p>
            ) : Silian_recipients.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-border text-sm">
                  <thead className="bg-muted/50">
                    <tr>
                      <th className="px-4 py-2 text-left font-medium uppercase tracking-wide text-muted-foreground">
                        {Silian_t('admin.badges.recipients.table.username')}
                      </th>
                      <th className="px-4 py-2 text-left font-medium uppercase tracking-wide text-muted-foreground">
                        {Silian_t('admin.badges.recipients.table.email')}
                      </th>
                      <th className="px-4 py-2 text-left font-medium uppercase tracking-wide text-muted-foreground">
                        {Silian_t('admin.badges.recipients.table.status')}
                      </th>
                      <th className="px-4 py-2 text-left font-medium uppercase tracking-wide text-muted-foreground">
                        {Silian_t('admin.badges.recipients.table.awardedAt')}
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border bg-card">
                    {Silian_recipients.map((Silian_entry) => {
                      const Silian_user = Silian_entry.user || {};
                      const Silian_record = Silian_entry.user_badge || {};
                      const Silian_status = Silian_record.status || 'awarded';
                      const Silian_awardedAt = Silian_record.awarded_at ? Silian_format(new Date(Silian_record.awarded_at), 'yyyy-MM-dd HH:mm') : '--';

                      return (
                        <tr key={`${Silian_user.id}-${Silian_record.awarded_at || Silian_record.status || 'row'}`} className="transition-colors hover:bg-muted/40">
                          <td className="px-4 py-2 font-medium text-foreground">{Silian_user.username || '-'}</td>
                          <td className="px-4 py-2 text-muted-foreground">{Silian_user.email || '-'}</td>
                          <td className="px-4 py-2">
                            <Silian_Badge variant={Silian_status === 'awarded' ? 'success' : 'secondary'}>
                              {Silian_status === 'awarded'
                                ? Silian_t('admin.badges.recipients.status.awarded')
                                : Silian_t('admin.badges.recipients.status.revoked')}
                            </Silian_Badge>
                          </td>
                          <td className="px-4 py-2 text-muted-foreground">{Silian_awardedAt}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="py-6 text-center text-sm text-muted-foreground">
                {Silian_t('admin.badges.recipients.empty')}
              </p>
            )}

            <Silian_Pagination
              currentPage={Silian_pagination.current_page}
              totalPages={Silian_pagination.total_pages}
              onPageChange={Silian_handlePageChange}
              itemsPerPage={Silian_pagination.per_page}
              totalItems={Silian_pagination.total_items}
            />
          </div>
        )}
      </Silian_DialogContent>
    </Silian_Dialog>
  );
}

export default Silian_BadgeRecipientsDialog;
