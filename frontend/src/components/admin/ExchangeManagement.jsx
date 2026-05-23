import Silian_React, { useEffect as Silian_useEffect, useMemo as Silian_useMemo, useState as Silian_useState } from 'react';
import { useLocation as Silian_useLocation } from 'react-router-dom';
import { useQuery as Silian_useQuery, useMutation as Silian_useMutation, useQueryClient as Silian_useQueryClient } from 'react-query';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { formatNumber as Silian_formatNumber, formatDateSafe as Silian_formatDateSafe } from '../../lib/utils';
import { adminAPI as Silian_adminAPI } from '../../lib/api';
import { Loader2 as Silian_Loader2, CheckCircle as Silian_CheckCircle, XCircle as Silian_XCircle, Eye as Silian_Eye, Search as Silian_Search, Clock as Silian_Clock } from 'lucide-react';
import { Button as Silian_Button } from '../ui/Button';
import { Input as Silian_Input } from '../ui/Input';
import { Textarea as Silian_Textarea } from '../ui/textarea';
import {
  Dialog as Silian_Dialog,
  DialogContent as Silian_DialogContent,
  DialogDescription as Silian_DialogDescription,
  DialogFooter as Silian_DialogFooter,
  DialogHeader as Silian_DialogHeader,
  DialogTitle as Silian_DialogTitle,
} from '../ui/dialog';
import { Alert as Silian_Alert, AlertTitle as Silian_AlertTitle, AlertDescription as Silian_AlertDescription } from '../ui/Alert';
import { Pagination as Silian_Pagination } from '../ui/Pagination';
import { prefetchPresignedUrls as Silian_prefetchPresignedUrls } from '../../lib/fileAccess';
import Silian_R2Image from '../common/R2Image';
import { toast as Silian_toast } from 'react-hot-toast';
// merged into utils import above

const Silian_EXCHANGE_STATUS_BADGE_STYLES = {
  pending: 'border border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300',
  processing: 'border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300',
  shipped: 'border border-purple-200 bg-purple-100 text-purple-800 dark:border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-300',
  completed: 'border border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300',
  rejected: 'border border-red-200 bg-red-100 text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300',
  cancelled: 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-border dark:bg-muted dark:text-muted-foreground',
};

function Silian_renderExchangeStatusBadge(Silian_status, Silian_t) {
  const Silian_baseClassName = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
  switch (Silian_status) {
    case 'pending':
      return (
        <span className={`${Silian_baseClassName} ${Silian_EXCHANGE_STATUS_BADGE_STYLES.pending}`}>
          <Silian_Clock className="mr-1 h-3 w-3" /> {Silian_t('admin.exchanges.status.pending')}
        </span>
      );
    case 'processing':
      return (
        <span className={`${Silian_baseClassName} ${Silian_EXCHANGE_STATUS_BADGE_STYLES.processing}`}>
          <Silian_Loader2 className="mr-1 h-3 w-3 animate-spin" /> {Silian_t('admin.exchanges.status.processing')}
        </span>
      );
    case 'shipped':
      return <span className={`${Silian_baseClassName} ${Silian_EXCHANGE_STATUS_BADGE_STYLES.shipped}`}>{Silian_t('admin.exchanges.status.shipped')}</span>;
    case 'completed':
      return (
        <span className={`${Silian_baseClassName} ${Silian_EXCHANGE_STATUS_BADGE_STYLES.completed}`}>
          <Silian_CheckCircle className="mr-1 h-3 w-3" /> {Silian_t('admin.exchanges.status.completed')}
        </span>
      );
    case 'rejected':
      return (
        <span className={`${Silian_baseClassName} ${Silian_EXCHANGE_STATUS_BADGE_STYLES.rejected}`}>
          <Silian_XCircle className="mr-1 h-3 w-3" /> {Silian_t('admin.exchanges.status.rejected')}
        </span>
      );
    case 'cancelled':
      return (
        <span className={`${Silian_baseClassName} ${Silian_EXCHANGE_STATUS_BADGE_STYLES.cancelled}`}>
          <Silian_XCircle className="mr-1 h-3 w-3" /> {Silian_t('admin.exchanges.status.cancelled')}
        </span>
      );
    default:
      return null;
  }
}

export function ExchangeManagement() {
  const { t: Silian_t } = Silian_useTranslation(['admin', 'common', 'errors', 'pagination']);
  const Silian_queryClient = Silian_useQueryClient();
  const Silian_location = Silian_useLocation();
  const [Silian_filters, Silian_setFilters] = Silian_useState({
    search: '',
    status: '',
    page: 1,
    limit: 10,
    sort: 'created_at_desc'
  });
  const [Silian_selectedExchange, Silian_setSelectedExchange] = Silian_useState(null);
  const [Silian_statusDialog, Silian_setStatusDialog] = Silian_useState({ open: false, exchange: null, status: null, adminNotes: '', error: '' });

  const { data: Silian_data, isLoading: Silian_isLoading, error: Silian_error, isFetching: Silian_isFetching } = Silian_useQuery(
    ['adminExchanges', Silian_filters],
    () => Silian_adminAPI.getExchanges(Silian_filters),
    { keepPreviousData: true }
  );

  const Silian_updateExchangeStatusMutation = Silian_useMutation(
    ({ id: Silian_id, status: Silian_status, admin_notes: Silian_admin_notes }) => Silian_adminAPI.updateExchangeStatus(Silian_id, { status: Silian_status, admin_notes: Silian_admin_notes }),
    {
      onSuccess: () => {
        Silian_queryClient.invalidateQueries('adminExchanges');
        Silian_toast.success(Silian_t('admin.exchanges.updateSuccess'));
        Silian_setSelectedExchange(null);
      },
      onError: (Silian_err) => {
        Silian_toast.error(Silian_t('admin.exchanges.updateFailed'));
        console.error('Exchange status update failed:', Silian_err);
      }
    }
  );

  const Silian_handleFilterChange = (Silian_key, Silian_value) => {
    Silian_setFilters(Silian_prev => ({ ...Silian_prev, [Silian_key]: Silian_value, page: 1 }));
  };

  const Silian_handlePageChange = (Silian_page) => {
    Silian_setFilters(Silian_prev => ({ ...Silian_prev, page: Silian_page }));
  };

  const Silian_handleViewDetails = (Silian_exchange) => {
    Silian_setSelectedExchange(Silian_exchange);
  };

  const Silian_openStatusDialog = (Silian_exchange, Silian_status) => {
    Silian_setStatusDialog({ open: true, exchange: Silian_exchange, status: Silian_status, adminNotes: '', error: '' });
  };

  const Silian_closeStatusDialog = () => {
    Silian_setStatusDialog({ open: false, exchange: null, status: null, adminNotes: '', error: '' });
  };

  const Silian_handleStatusNotesChange = (Silian_event) => {
    const Silian_value = Silian_event.target.value;
    Silian_setStatusDialog((Silian_prev) => ({ ...Silian_prev, adminNotes: Silian_value, error: Silian_value.trim() ? '' : Silian_prev.error }));
  };

  const Silian_handleConfirmStatus = () => {
    if (!Silian_statusDialog.exchange || !Silian_statusDialog.status) {
      return;
    }

    const Silian_requiresNotes = Silian_statusDialog.status === 'rejected' || Silian_statusDialog.status === 'cancelled';
    const Silian_trimmedNotes = Silian_statusDialog.adminNotes.trim();

    if (Silian_requiresNotes && !Silian_trimmedNotes) {
      Silian_setStatusDialog((Silian_prev) => ({ ...Silian_prev, error: Silian_t('admin.exchanges.notesRequired') }));
      return;
    }

    Silian_updateExchangeStatusMutation.mutate(
      {
        id: Silian_statusDialog.exchange.id,
        status: Silian_statusDialog.status,
        admin_notes: Silian_requiresNotes ? Silian_trimmedNotes : undefined,
      },
      { onSettled: () => Silian_closeStatusDialog() }
    );
  };

  const Silian_exchanges = Silian_useMemo(() => (
    Array.isArray(Silian_data?.data?.data) ? Silian_data.data.data : []
  ), [Silian_data]);
  const Silian_pagination = Silian_data?.data?.pagination || {};

  Silian_useEffect(() => {
    const Silian_routedExchange = Silian_location.state?.selectedExchange;
    if (Silian_routedExchange?.id) {
      Silian_setSelectedExchange(Silian_routedExchange);
    }
  }, [Silian_location.state]);

  Silian_React.useEffect(() => {
    const Silian_paths = Silian_exchanges
      .map(Silian_e => Silian_e.product_image_url)
      .filter(Boolean)
      .filter(Silian_u => !Silian_u.startsWith('http'));
    if (Silian_paths.length) {
      Silian_prefetchPresignedUrls(Silian_paths).catch(() => {});
    }
  }, [Silian_exchanges]);

  const Silian_statusRequiresNotes = Silian_statusDialog.status === 'rejected' || Silian_statusDialog.status === 'cancelled';
  const Silian_statusLabel = Silian_statusDialog.status ? Silian_t(`admin.exchanges.status.${Silian_statusDialog.status}`) : '';

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">{Silian_t('admin.exchanges.title')}</h2>
      <p className="text-muted-foreground">{Silian_t('admin.exchanges.description')}</p>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">{Silian_t('common.search')}</label>
            <div className="relative">
              <Silian_Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Silian_Input
                type="text"
                value={Silian_filters.search}
                onChange={(Silian_e) => Silian_handleFilterChange('search', Silian_e.target.value)}
                placeholder={Silian_t('admin.exchanges.searchPlaceholder')}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">{Silian_t('admin.exchanges.statusLabel')}</label>
            <select
              value={Silian_filters.status}
              onChange={(Silian_e) => Silian_handleFilterChange('status', Silian_e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">{Silian_t('common.all')}</option>
              <option value="pending">{Silian_t('admin.exchanges.status.pending')}</option>
              <option value="processing">{Silian_t('admin.exchanges.status.processing')}</option>
              <option value="shipped">{Silian_t('admin.exchanges.status.shipped')}</option>
              <option value="completed">{Silian_t('admin.exchanges.status.completed')}</option>
              <option value="rejected">{Silian_t('admin.exchanges.status.rejected')}</option>
              <option value="cancelled">{Silian_t('admin.exchanges.status.cancelled')}</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">{Silian_t('common.sort.sortBy')}</label>
            <select
              value={Silian_filters.sort}
              onChange={(Silian_e) => Silian_handleFilterChange('sort', Silian_e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="created_at_desc">{Silian_t('common.sort.newest')}</option>
              <option value="created_at_asc">{Silian_t('common.sort.oldest')}</option>
            </select>
          </div>
        </div>
      </div>

      {Silian_isLoading || Silian_isFetching ? (
        <div className="flex justify-center items-center h-64">
          <Silian_Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </div>
      ) : Silian_error ? (
        <Silian_Alert variant="destructive">
          <Silian_AlertTitle>{Silian_t('common.error')}</Silian_AlertTitle>
          <Silian_AlertDescription>{Silian_t('errors.loadFailed')}</Silian_AlertDescription>
        </Silian_Alert>
      ) : Silian_exchanges.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center shadow-sm">
          <h3 className="text-xl font-semibold">{Silian_t('admin.exchanges.noExchangesFound')}</h3>
          <p className="text-muted-foreground mt-2">{Silian_t('admin.exchanges.tryDifferentFilters')}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.exchanges.table.user')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.exchanges.table.product')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.exchanges.table.quantity')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.exchanges.table.totalPoints')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.exchanges.table.status')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.exchanges.table.date')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {Silian_exchanges.map((Silian_exchange) => (
                  <tr key={Silian_exchange.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-foreground">{Silian_exchange.user_username}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">{Silian_exchange.product_name}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">{Silian_formatNumber(Silian_exchange.quantity)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-red-600 dark:text-red-400">-{Silian_formatNumber(Silian_exchange.total_points)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">{Silian_renderExchangeStatusBadge(Silian_exchange.status, Silian_t)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">{Silian_formatDateSafe(Silian_exchange.created_at, 'yyyy-MM-dd HH:mm')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Silian_Button variant="ghost" size="sm" onClick={() => Silian_handleViewDetails(Silian_exchange)} className="mr-2">
                        <Silian_Eye className="h-4 w-4" />
                      </Silian_Button>
                      {Silian_exchange.status === 'pending' && (
                        <>
                          <Silian_Button variant="ghost" size="sm" onClick={() => Silian_openStatusDialog(Silian_exchange, 'processing')} className="mr-2 text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200">
                            {Silian_t('admin.exchanges.action.process')}
                          </Silian_Button>
                          <Silian_Button variant="ghost" size="sm" onClick={() => Silian_openStatusDialog(Silian_exchange, 'rejected')} className="text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200">
                            {Silian_t('admin.exchanges.action.reject')}
                          </Silian_Button>
                        </>
                      )}
                      {Silian_exchange.status === 'processing' && (
                        <>
                          <Silian_Button variant="ghost" size="sm" onClick={() => Silian_openStatusDialog(Silian_exchange, 'shipped')} className="mr-2 text-purple-600 hover:text-purple-700 dark:text-purple-300 dark:hover:text-purple-200">
                            {Silian_t('admin.exchanges.action.ship')}
                          </Silian_Button>
                          <Silian_Button variant="ghost" size="sm" onClick={() => Silian_openStatusDialog(Silian_exchange, 'cancelled')} className="text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200">
                            {Silian_t('admin.exchanges.action.cancel')}
                          </Silian_Button>
                        </>
                      )}
                      {Silian_exchange.status === 'shipped' && (
                        <Silian_Button variant="ghost" size="sm" onClick={() => Silian_openStatusDialog(Silian_exchange, 'completed')} className="text-green-600 hover:text-green-700 dark:text-green-300 dark:hover:text-green-200">
                          {Silian_t('admin.exchanges.action.complete')}
                        </Silian_Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Silian_Pagination
            currentPage={Silian_pagination.current_page}
            totalPages={Silian_pagination.total_pages}
            onPageChange={Silian_handlePageChange}
            itemsPerPage={Silian_pagination.per_page}
            totalItems={Silian_pagination.total_items}
          />
        </>
      )}

      <Silian_Dialog open={Silian_statusDialog.open} onOpenChange={(Silian_open) => (!Silian_open ? Silian_closeStatusDialog() : null)}>
        <Silian_DialogContent className="sm:max-w-lg">
          <Silian_DialogHeader>
            <Silian_DialogTitle>
              {Silian_t('admin.exchanges.statusDialog.title', { status: Silian_statusLabel || Silian_statusDialog.status || '' })}
            </Silian_DialogTitle>
            <Silian_DialogDescription>
              {Silian_t('admin.exchanges.statusDialog.description', { status: Silian_statusLabel || Silian_statusDialog.status || '' })}
            </Silian_DialogDescription>
          </Silian_DialogHeader>
          {Silian_statusDialog.exchange && (
            <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between text-foreground/80">
                <span className="font-semibold text-foreground">{Silian_statusDialog.exchange.user_username}</span>
                <span>{Silian_formatDateSafe(Silian_statusDialog.exchange.created_at, 'yyyy-MM-dd HH:mm', '--')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground">{Silian_statusDialog.exchange.product_name}</span>
                <span className="font-medium text-red-600 dark:text-red-400">-{Silian_formatNumber(Silian_statusDialog.exchange.total_points)} {Silian_t('common.points')}</span>
              </div>
              {Silian_statusDialog.exchange.contact_phone && (
                <p className="text-xs text-muted-foreground">{Silian_statusDialog.exchange.contact_phone}</p>
              )}
              {Silian_statusDialog.exchange.shipping_address && (
                <p className="text-xs text-muted-foreground">{Silian_statusDialog.exchange.shipping_address}</p>
              )}
            </div>
          )}
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="exchange-status-notes">
                {Silian_statusRequiresNotes
                  ? Silian_t('admin.exchanges.statusDialog.notesRequiredLabel')
                  : Silian_t('admin.exchanges.statusDialog.notesLabel')}
              </label>
              <Silian_Textarea
                id="exchange-status-notes"
                value={Silian_statusDialog.adminNotes}
                onChange={Silian_handleStatusNotesChange}
                rows={Silian_statusRequiresNotes ? 4 : 3}
                placeholder={Silian_t('admin.exchanges.statusDialog.notesPlaceholder')}
              />
              {Silian_statusDialog.error && (
                <p className="text-xs text-red-500">{Silian_statusDialog.error}</p>
              )}
              {!Silian_statusRequiresNotes && (
                <p className="text-xs text-muted-foreground">{Silian_t('admin.exchanges.statusDialog.notesOptional')}</p>
              )}
            </div>
          </div>
          <Silian_DialogFooter>
            <Silian_Button variant="outline" onClick={Silian_closeStatusDialog} disabled={Silian_updateExchangeStatusMutation.isLoading}>
              {Silian_t('common.cancel')}
            </Silian_Button>
            <Silian_Button onClick={Silian_handleConfirmStatus} disabled={Silian_updateExchangeStatusMutation.isLoading}>
              {Silian_updateExchangeStatusMutation.isLoading ? (
                <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {Silian_t('admin.exchanges.statusDialog.confirm')}
            </Silian_Button>
          </Silian_DialogFooter>
        </Silian_DialogContent>
      </Silian_Dialog>

      {Silian_selectedExchange && (
        <Silian_ExchangeDetailModal
          isOpen={!!Silian_selectedExchange}
          onClose={() => Silian_setSelectedExchange(null)}
          exchange={Silian_selectedExchange}
        />
      )}
    </div>
  );
}

function Silian_ExchangeDetailModal({ isOpen: Silian_isOpen, onClose: Silian_onClose, exchange: Silian_exchange }) {
  const { t: Silian_t } = Silian_useTranslation();

  if (!Silian_isOpen || !Silian_exchange) return null;

  return (
    <Silian_Dialog open={Silian_isOpen} onOpenChange={(Silian_open) => (!Silian_open ? Silian_onClose() : null)}>
      <Silian_DialogContent className="sm:max-w-2xl">
        <Silian_DialogHeader>
          <Silian_DialogTitle>{Silian_t('admin.exchanges.detail.title')}</Silian_DialogTitle>
        </Silian_DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2 rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">#{Silian_exchange.id}</span>
              <span className="text-muted-foreground">{Silian_formatDateSafe(Silian_exchange.created_at, 'yyyy-MM-dd HH:mm', '--')}</span>
            </div>
            <div className="text-foreground/80">
              <p className="font-medium">{Silian_exchange.user_username}</p>
              {Silian_exchange.user_email && <p className="text-xs text-muted-foreground">{Silian_exchange.user_email}</p>}
            </div>
            <div className="flex items-center gap-3">
              {Silian_exchange.product_image_url && (
                <Silian_R2Image
                  src={Silian_exchange.product_image_url.startsWith('http') ? Silian_exchange.product_image_url : undefined}
                  filePath={Silian_exchange.product_image_url.startsWith('http') ? undefined : Silian_exchange.product_image_url}
                  alt={Silian_exchange.product_name}
                  className="h-12 w-12 rounded-lg object-cover"
                  fallback={<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground">IMG</div>}
                />
              )}
              <div className="text-sm text-foreground/80">
                <p className="font-medium text-foreground">{Silian_exchange.product_name} x {Silian_formatNumber(Silian_exchange.quantity)}</p>
                <p className="text-xs text-muted-foreground">-{Silian_formatNumber(Silian_exchange.total_points)} {Silian_t('common.points')}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 text-sm text-muted-foreground">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{Silian_t('admin.exchanges.detail.status')}</p>
              {Silian_renderExchangeStatusBadge(Silian_exchange.status, Silian_t)}
            </div>
            {Silian_exchange.shipping_address && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{Silian_t('admin.exchanges.detail.address')}</p>
                <p className="text-foreground">{Silian_exchange.shipping_address}</p>
              </div>
            )}
            {Silian_exchange.contact_phone && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{Silian_t('admin.exchanges.detail.phone')}</p>
                <p className="text-foreground">{Silian_exchange.contact_phone}</p>
              </div>
            )}
            {Silian_exchange.admin_notes && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{Silian_t('admin.exchanges.detail.adminNotes')}</p>
                <p className="rounded-lg bg-muted/60 p-3 text-foreground">{Silian_exchange.admin_notes}</p>
              </div>
            )}
          </div>
        </div>
        <Silian_DialogFooter>
          <Silian_Button variant="outline" onClick={Silian_onClose}>{Silian_t('common.close')}</Silian_Button>
        </Silian_DialogFooter>
      </Silian_DialogContent>
    </Silian_Dialog>
  );
}

