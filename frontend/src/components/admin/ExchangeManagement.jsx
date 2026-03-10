import React, { useState } from 'react';
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

export function ExchangeManagement() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
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

  const exchanges = data?.data?.data || [];
  const pagination = data?.data?.pagination || {};

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

      <div className="bg-white rounded-lg shadow-sm border p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.search')}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
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
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.exchanges.statusLabel')}</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.sort.sortBy')}</label>
            <select
              value={filters.sort}
              onChange={(e) => handleFilterChange('sort', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
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
        <div className="text-center py-16 bg-white rounded-lg shadow-sm border">
          <h3 className="text-xl font-semibold">{t('admin.exchanges.noExchangesFound')}</h3>
          <p className="text-muted-foreground mt-2">{t('admin.exchanges.tryDifferentFilters')}</p>
        </div>
      ) : (
        <>
          <div className="overflow-x-auto bg-white rounded-lg shadow-sm border">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.exchanges.table.user')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.exchanges.table.product')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.exchanges.table.quantity')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.exchanges.table.totalPoints')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.exchanges.table.status')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.exchanges.table.date')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {exchanges.map((exchange) => (
                  <tr key={exchange.id}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{exchange.user_username}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{exchange.product_name}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatNumber(exchange.quantity)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-red-600 font-semibold">-{formatNumber(exchange.total_points)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {exchange.status === 'pending' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <Clock className="h-3 w-3 mr-1" /> {t('admin.exchanges.status.pending')}
                        </span>
                      )}
                      {exchange.status === 'processing' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800">
                          <Loader2 className="h-3 w-3 mr-1 animate-spin" /> {t('admin.exchanges.status.processing')}
                        </span>
                      )}
                      {exchange.status === 'shipped' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">
                          {t('admin.exchanges.status.shipped')}
                        </span>
                      )}
                      {exchange.status === 'completed' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" /> {t('admin.exchanges.status.completed')}
                        </span>
                      )}
                      {(exchange.status === 'rejected' || exchange.status === 'cancelled') && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle className="h-3 w-3 mr-1" /> {t(`admin.exchanges.status.${exchange.status}`)}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateSafe(exchange.created_at, 'yyyy-MM-dd HH:mm')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button variant="ghost" size="sm" onClick={() => handleViewDetails(exchange)} className="mr-2">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {exchange.status === 'pending' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => openStatusDialog(exchange, 'processing')} className="mr-2 text-blue-600 hover:text-blue-800">
                            {t('admin.exchanges.action.process')}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openStatusDialog(exchange, 'rejected')} className="text-red-600 hover:text-red-800">
                            {t('admin.exchanges.action.reject')}
                          </Button>
                        </>
                      )}
                      {exchange.status === 'processing' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => openStatusDialog(exchange, 'shipped')} className="mr-2 text-purple-600 hover:text-purple-800">
                            {t('admin.exchanges.action.ship')}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openStatusDialog(exchange, 'cancelled')} className="text-red-600 hover:text-red-800">
                            {t('admin.exchanges.action.cancel')}
                          </Button>
                        </>
                      )}
                      {exchange.status === 'shipped' && (
                        <Button variant="ghost" size="sm" onClick={() => openStatusDialog(exchange, 'completed')} className="text-green-600 hover:text-green-800">
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
            <div className="space-y-2 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              <div className="flex items-center justify-between text-slate-700">
                <span className="font-semibold text-slate-900">{statusDialog.exchange.user_username}</span>
                <span>{formatDateSafe(statusDialog.exchange.created_at, 'yyyy-MM-dd HH:mm', '--')}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-900">{statusDialog.exchange.product_name}</span>
                <span className="font-medium text-red-600">-{formatNumber(statusDialog.exchange.total_points)} {t('common.points')}</span>
              </div>
              {statusDialog.exchange.contact_phone && (
                <p className="text-xs text-slate-500">{statusDialog.exchange.contact_phone}</p>
              )}
              {statusDialog.exchange.shipping_address && (
                <p className="text-xs text-slate-500">{statusDialog.exchange.shipping_address}</p>
              )}
            </div>
          )}
          <div className="space-y-3">
            <div className="space-y-2">
              <label className="text-sm font-medium text-slate-700" htmlFor="exchange-status-notes">
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
                <p className="text-xs text-slate-500">{t('admin.exchanges.statusDialog.notesOptional')}</p>
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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800"><Clock className="h-3 w-3 mr-1" /> {t('admin.exchanges.status.pending')}</span>;
      case 'processing':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-yellow-100 text-yellow-800"><Loader2 className="h-3 w-3 mr-1 animate-spin" /> {t('admin.exchanges.status.processing')}</span>;
      case 'shipped':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-800">{t('admin.exchanges.status.shipped')}</span>;
      case 'completed':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800"><CheckCircle className="h-3 w-3 mr-1" /> {t('admin.exchanges.status.completed')}</span>;
      case 'rejected':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800"><XCircle className="h-3 w-3 mr-1" /> {t('admin.exchanges.status.rejected')}</span>;
      case 'cancelled':
        return <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800"><XCircle className="h-3 w-3 mr-1" /> {t('admin.exchanges.status.cancelled')}</span>;
      default:
        return null;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => (!open ? onClose() : null)}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t('admin.exchanges.detail.title')}</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div className="grid gap-2 rounded-lg border border-slate-200 bg-slate-50 p-4 text-sm">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-slate-900">#{exchange.id}</span>
              <span className="text-slate-500">{formatDateSafe(exchange.created_at, 'yyyy-MM-dd HH:mm', '--')}</span>
            </div>
            <div className="text-slate-700">
              <p className="font-medium">{exchange.user_username}</p>
              {exchange.user_email && <p className="text-xs text-slate-500">{exchange.user_email}</p>}
            </div>
            <div className="flex items-center gap-3">
              {exchange.product_image_url && (
                <R2Image
                  src={exchange.product_image_url.startsWith('http') ? exchange.product_image_url : undefined}
                  filePath={exchange.product_image_url.startsWith('http') ? undefined : exchange.product_image_url}
                  alt={exchange.product_name}
                  className="h-12 w-12 rounded-lg object-cover"
                  fallback={<div className="h-12 w-12 rounded-lg bg-gray-100 flex items-center justify-center text-[10px] text-gray-400">IMG</div>}
                />
              )}
              <div className="text-sm text-slate-700">
                <p className="font-medium text-slate-900">{exchange.product_name} x {formatNumber(exchange.quantity)}</p>
                <p className="text-xs text-slate-500">-{formatNumber(exchange.total_points)} {t('common.points')}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-3 text-sm text-slate-600">
            <div>
              <p className="text-xs uppercase tracking-wide text-slate-500">{t('admin.exchanges.detail.status')}</p>
              {getStatusBadge(exchange.status)}
            </div>
            {exchange.shipping_address && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{t('admin.exchanges.detail.address')}</p>
                <p className="text-slate-800">{exchange.shipping_address}</p>
              </div>
            )}
            {exchange.contact_phone && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{t('admin.exchanges.detail.phone')}</p>
                <p className="text-slate-800">{exchange.contact_phone}</p>
              </div>
            )}
            {exchange.admin_notes && (
              <div>
                <p className="text-xs uppercase tracking-wide text-slate-500">{t('admin.exchanges.detail.adminNotes')}</p>
                <p className="rounded-lg bg-slate-50 p-3 text-slate-800">{exchange.admin_notes}</p>
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

