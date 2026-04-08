import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { formatNumber, formatDateSafe } from '../../lib/utils';
import { adminAPI } from '../../lib/api';
import { Loader2, CheckCircle, XCircle, Eye, Search, Clock } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Alert, AlertTitle, AlertDescription } from '../ui/Alert';
import { Pagination } from '../ui/Pagination';
import { prefetchPresignedUrls } from '../../lib/fileAccess';
import R2Image from '../common/R2Image';
import { toast } from 'react-hot-toast';
// merged into utils import above

const EXCHANGE_STATUS_BADGE_STYLES = {
  pending: 'border border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300',
  processing: 'border border-amber-200 bg-amber-100 text-amber-800 dark:border-amber-500/30 dark:bg-amber-500/15 dark:text-amber-300',
  shipped: 'border border-purple-200 bg-purple-100 text-purple-800 dark:border-purple-500/30 dark:bg-purple-500/15 dark:text-purple-300',
  completed: 'border border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300',
  rejected: 'border border-red-200 bg-red-100 text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300',
  cancelled: 'border border-slate-200 bg-slate-100 text-slate-700 dark:border-border dark:bg-muted dark:text-muted-foreground',
};

function renderExchangeStatusBadge(status, t) {
  const baseClassName = 'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium';
  switch (status) {
    case 'pending':
      return (
        <span className={`${baseClassName} ${EXCHANGE_STATUS_BADGE_STYLES.pending}`}>
          <Clock className="mr-1 h-3 w-3" /> {t('admin.exchanges.status.pending')}
        </span>
      );
    case 'processing':
      return (
        <span className={`${baseClassName} ${EXCHANGE_STATUS_BADGE_STYLES.processing}`}>
          <Loader2 className="mr-1 h-3 w-3 animate-spin" /> {t('admin.exchanges.status.processing')}
        </span>
      );
    case 'shipped':
      return <span className={`${baseClassName} ${EXCHANGE_STATUS_BADGE_STYLES.shipped}`}>{t('admin.exchanges.status.shipped')}</span>;
    case 'completed':
      return (
        <span className={`${baseClassName} ${EXCHANGE_STATUS_BADGE_STYLES.completed}`}>
          <CheckCircle className="mr-1 h-3 w-3" /> {t('admin.exchanges.status.completed')}
        </span>
      );
    case 'rejected':
      return (
        <span className={`${baseClassName} ${EXCHANGE_STATUS_BADGE_STYLES.rejected}`}>
          <XCircle className="mr-1 h-3 w-3" /> {t('admin.exchanges.status.rejected')}
        </span>
      );
    case 'cancelled':
      return (
        <span className={`${baseClassName} ${EXCHANGE_STATUS_BADGE_STYLES.cancelled}`}>
          <XCircle className="mr-1 h-3 w-3" /> {t('admin.exchanges.status.cancelled')}
        </span>
      );
    default:
      return null;
  }
}

export function ExchangeManagement() {
  const { t } = useTranslation(['admin', 'common', 'errors', 'pagination']);
  const queryClient = useQueryClient();
  const location = useLocation();
  const [filters, setFilters] = useState({
    search: '',
    status: '',
    page: 1,
    limit: 10,
    sort: 'created_at_desc'
  });
  const [selectedExchange, setSelectedExchange] = useState(null);
  const [statusDialog, setStatusDialog] = useState({ open: false, exchange: null, status: null, adminNotes: '', error: '' });

  const { data, isLoading, error, isFetching } = useQuery(
    ['adminExchanges', filters],
    () => adminAPI.getExchanges(filters),
    { keepPreviousData: true }
  );

  const updateExchangeStatusMutation = useMutation(
    ({ id, status, admin_notes }) => adminAPI.updateExchangeStatus(id, { status, admin_notes }),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('adminExchanges');
        toast.success(t('admin.exchanges.updateSuccess'));
        setSelectedExchange(null);
      },
      onError: (err) => {
        toast.error(t('admin.exchanges.updateFailed'));
        console.error('Exchange status update failed:', err);
      }
    }
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleViewDetails = (exchange) => {
    setSelectedExchange(exchange);
  };

  const openStatusDialog = (exchange, status) => {
    setStatusDialog({ open: true, exchange, status, adminNotes: '', error: '' });
  };

  const closeStatusDialog = () => {
    setStatusDialog({ open: false, exchange: null, status: null, adminNotes: '', error: '' });
  };

  const handleStatusNotesChange = (event) => {
    const value = event.target.value;
    setStatusDialog((prev) => ({ ...prev, adminNotes: value, error: value.trim() ? '' : prev.error }));
  };

  const handleConfirmStatus = () => {
    if (!statusDialog.exchange || !statusDialog.status) {
      return;
    }

    const requiresNotes = statusDialog.status === 'rejected' || statusDialog.status === 'cancelled';
    const trimmedNotes = statusDialog.adminNotes.trim();

    if (requiresNotes && !trimmedNotes) {
      setStatusDialog((prev) => ({ ...prev, error: t('admin.exchanges.notesRequired') }));
      return;
    }

    updateExchangeStatusMutation.mutate(
      {
        id: statusDialog.exchange.id,
        status: statusDialog.status,
        admin_notes: requiresNotes ? trimmedNotes : undefined,
      },
      { onSettled: () => closeStatusDialog() }
    );
  };

  const exchanges = useMemo(() => (
    Array.isArray(data?.data?.data) ? data.data.data : []
  ), [data]);
  const pagination = data?.data?.pagination || {};

  useEffect(() => {
    const routedExchange = location.state?.selectedExchange;
    if (routedExchange?.id) {
      setSelectedExchange(routedExchange);
    }
  }, [location.state]);

  React.useEffect(() => {
    const paths = exchanges
      .map(e => e.product_image_url)
      .filter(Boolean)
      .filter(u => !u.startsWith('http'));
    if (paths.length) {
      prefetchPresignedUrls(paths).catch(() => {});
    }
  }, [exchanges]);

  const statusRequiresNotes = statusDialog.status === 'rejected' || statusDialog.status === 'cancelled';
  const statusLabel = statusDialog.status ? t(`admin.exchanges.status.${statusDialog.status}`) : '';

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">{t('admin.exchanges.title')}</h2>
      <p className="text-muted-foreground">{t('admin.exchanges.description')}</p>

      <div className="rounded-lg border border-border bg-card p-6 shadow-sm">
        <div className="mb-4 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">{t('common.search')}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder={t('admin.exchanges.searchPlaceholder')}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">{t('admin.exchanges.statusLabel')}</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="">{t('common.all')}</option>
              <option value="pending">{t('admin.exchanges.status.pending')}</option>
              <option value="processing">{t('admin.exchanges.status.processing')}</option>
              <option value="shipped">{t('admin.exchanges.status.shipped')}</option>
              <option value="completed">{t('admin.exchanges.status.completed')}</option>
              <option value="rejected">{t('admin.exchanges.status.rejected')}</option>
              <option value="cancelled">{t('admin.exchanges.status.cancelled')}</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">{t('common.sort.sortBy')}</label>
            <select
              value={filters.sort}
              onChange={(e) => handleFilterChange('sort', e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            >
              <option value="created_at_desc">{t('common.sort.newest')}</option>
              <option value="created_at_asc">{t('common.sort.oldest')}</option>
            </select>
          </div>
        </div>
      </div>

      {isLoading || isFetching ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{t('errors.loadFailed')}</AlertDescription>
        </Alert>
      ) : exchanges.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center shadow-sm">
          <h3 className="text-xl font-semibold">{t('admin.exchanges.noExchangesFound')}</h3>
          <p className="text-muted-foreground mt-2">{t('admin.exchanges.tryDifferentFilters')}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.exchanges.table.user')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.exchanges.table.product')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.exchanges.table.quantity')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.exchanges.table.totalPoints')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.exchanges.table.status')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.exchanges.table.date')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {exchanges.map((exchange) => (
                  <tr key={exchange.id}>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-medium text-foreground">{exchange.user_username}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">{exchange.product_name}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">{formatNumber(exchange.quantity)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm font-semibold text-red-600 dark:text-red-400">-{formatNumber(exchange.total_points)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">{renderExchangeStatusBadge(exchange.status, t)}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-sm text-muted-foreground">{formatDateSafe(exchange.created_at, 'yyyy-MM-dd HH:mm')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button variant="ghost" size="sm" onClick={() => handleViewDetails(exchange)} className="mr-2">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {exchange.status === 'pending' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => openStatusDialog(exchange, 'processing')} className="mr-2 text-blue-600 hover:text-blue-700 dark:text-blue-300 dark:hover:text-blue-200">
                            {t('admin.exchanges.action.process')}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openStatusDialog(exchange, 'rejected')} className="text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200">
                            {t('admin.exchanges.action.reject')}
                          </Button>
                        </>
                      )}
                      {exchange.status === 'processing' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => openStatusDialog(exchange, 'shipped')} className="mr-2 text-purple-600 hover:text-purple-700 dark:text-purple-300 dark:hover:text-purple-200">
                            {t('admin.exchanges.action.ship')}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openStatusDialog(exchange, 'cancelled')} className="text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200">
                            {t('admin.exchanges.action.cancel')}
                          </Button>
                        </>
                      )}
                      {exchange.status === 'shipped' && (
                        <Button variant="ghost" size="sm" onClick={() => openStatusDialog(exchange, 'completed')} className="text-green-600 hover:text-green-700 dark:text-green-300 dark:hover:text-green-200">
                          {t('admin.exchanges.action.complete')}
                        </Button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            currentPage={pagination.current_page}
            totalPages={pagination.total_pages}
            onPageChange={handlePageChange}
            itemsPerPage={pagination.per_page}
            totalItems={pagination.total_items}
          />
        </>
      )}

      <Dialog open={statusDialog.open} onOpenChange={(open) => (!open ? closeStatusDialog() : null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {t('admin.exchanges.statusDialog.title', { status: statusLabel || statusDialog.status || '' })}
            </DialogTitle>
            <DialogDescription>
              {t('admin.exchanges.statusDialog.description', { status: statusLabel || statusDialog.status || '' })}
            </DialogDescription>
          </DialogHeader>
          {statusDialog.exchange && (
            <div className="space-y-2 rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
              <div className="flex items-center justify-between text-foreground/80">
                <span className="font-semibold text-foreground">{statusDialog.exchange.user_username}</span>
                <span>{formatDateSafe(statusDialog.exchange.created_at, 'yyyy-MM-dd HH:mm', '--')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-foreground">{statusDialog.exchange.product_name}</span>
                <span className="font-medium text-red-600 dark:text-red-400">-{formatNumber(statusDialog.exchange.total_points)} {t('common.points')}</span>
              </div>
              {statusDialog.exchange.contact_phone && (
                <p className="text-xs text-muted-foreground">{statusDialog.exchange.contact_phone}</p>
              )}
              {statusDialog.exchange.shipping_address && (
                <p className="text-xs text-muted-foreground">{statusDialog.exchange.shipping_address}</p>
              )}
            </div>
          )}
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="exchange-status-notes">
                {statusRequiresNotes
                  ? t('admin.exchanges.statusDialog.notesRequiredLabel')
                  : t('admin.exchanges.statusDialog.notesLabel')}
              </label>
              <Textarea
                id="exchange-status-notes"
                value={statusDialog.adminNotes}
                onChange={handleStatusNotesChange}
                rows={statusRequiresNotes ? 4 : 3}
                placeholder={t('admin.exchanges.statusDialog.notesPlaceholder')}
              />
              {statusDialog.error && (
                <p className="text-xs text-red-500">{statusDialog.error}</p>
              )}
              {!statusRequiresNotes && (
                <p className="text-xs text-muted-foreground">{t('admin.exchanges.statusDialog.notesOptional')}</p>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={closeStatusDialog} disabled={updateExchangeStatusMutation.isLoading}>
              {t('common.cancel')}
            </Button>
            <Button onClick={handleConfirmStatus} disabled={updateExchangeStatusMutation.isLoading}>
              {updateExchangeStatusMutation.isLoading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : null}
              {t('admin.exchanges.statusDialog.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {selectedExchange && (
        <ExchangeDetailModal
          isOpen={!!selectedExchange}
          onClose={() => setSelectedExchange(null)}
          exchange={selectedExchange}
        />
      )}
    </div>
  );
}

function ExchangeDetailModal({ isOpen, onClose, exchange }) {
  const { t } = useTranslation();

  if (!isOpen || !exchange) return null;

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('admin.exchanges.detail.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2 rounded-lg border border-border bg-muted/40 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-foreground">#{exchange.id}</span>
              <span className="text-muted-foreground">{formatDateSafe(exchange.created_at, 'yyyy-MM-dd HH:mm', '--')}</span>
            </div>
            <div className="text-foreground/80">
              <p className="font-medium">{exchange.user_username}</p>
              {exchange.user_email && <p className="text-xs text-muted-foreground">{exchange.user_email}</p>}
            </div>
            <div className="flex items-center gap-3">
              {exchange.product_image_url && (
                <R2Image
                  src={exchange.product_image_url.startsWith('http') ? exchange.product_image_url : undefined}
                  filePath={exchange.product_image_url.startsWith('http') ? undefined : exchange.product_image_url}
                  alt={exchange.product_name}
                  className="h-12 w-12 rounded-lg object-cover"
                  fallback={<div className="flex h-12 w-12 items-center justify-center rounded-lg bg-muted text-[10px] text-muted-foreground">IMG</div>}
                />
              )}
              <div className="text-sm text-foreground/80">
                <p className="font-medium text-foreground">{exchange.product_name} x {formatNumber(exchange.quantity)}</p>
                <p className="text-xs text-muted-foreground">-{formatNumber(exchange.total_points)} {t('common.points')}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 text-sm text-muted-foreground">
            <div>
              <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.exchanges.detail.status')}</p>
              {renderExchangeStatusBadge(exchange.status, t)}
            </div>
            {exchange.shipping_address && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.exchanges.detail.address')}</p>
                <p className="text-foreground">{exchange.shipping_address}</p>
              </div>
            )}
            {exchange.contact_phone && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.exchanges.detail.phone')}</p>
                <p className="text-foreground">{exchange.contact_phone}</p>
              </div>
            )}
            {exchange.admin_notes && (
              <div>
                <p className="text-xs uppercase tracking-wide text-muted-foreground">{t('admin.exchanges.detail.adminNotes')}</p>
                <p className="rounded-lg bg-muted/60 p-3 text-foreground">{exchange.admin_notes}</p>
              </div>
            )}
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>{t('common.close')}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

