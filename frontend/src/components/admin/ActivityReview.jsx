import React, { useState, useEffect, useRef, useMemo } from 'react';
import { ImagePreviewGallery } from '../common/ImagePreviewGallery';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { formatNumber, formatDateSafe } from '../../lib/utils';
import { adminAPI } from '../../lib/api';
import { Loader2, CheckCircle, XCircle, Eye, Search, MessageSquare, Clock } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/textarea';
import { Checkbox } from '../ui/checkbox';
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
import { ActivityDetailModal } from '../activities/ActivityDetailModal';
import { toast } from 'react-hot-toast';
// merged into utils import above

export function ActivityReview() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState({
    search: '',
    status: 'pending', // Default to pending activities
    page: 1,
    limit: 10,
    sort: 'created_at_asc' // Oldest first for review
  });
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [selectedIds, setSelectedIds] = useState([]);
  const [decisionDialog, setDecisionDialog] = useState({ open: false, mode: null, activity: null, bulkIds: [], reason: '', error: '' });
  const [confirmSuccess, setConfirmSuccess] = useState(false);
  // 自动刷新控制
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshIntervalMs, setRefreshIntervalMs] = useState(15000); // 15s 默认

  // 标记是否已完成首次加载
  const initialLoadedRef = useRef(false);

  // 使用碳减排记录审核接口（多路由别名: /admin/activities | /admin/carbon-records | /admin/carbon-activities/pending）
  const { data, isLoading, error, isFetching, refetch } = useQuery(
    ['adminActivities', filters],
    () => adminAPI.getActivityRecords(filters).then(r => r.data),
    {
      keepPreviousData: true,
      refetchInterval: autoRefresh && !selectedActivity ? refreshIntervalMs : false,
      refetchIntervalInBackground: true
    }
  );

  useEffect(() => {
    if (!isLoading && !error) {
      initialLoadedRef.current = true;
    }
  }, [isLoading, error]);

  // 后端记录列表结构：{ success, data: [ { record... } ], pagination: {...} }
  // 兼容旧结构：{ data: { activities: [...] } } 或直接数组。
  // 归一化：将 carbon_records 与 carbon_activities 定义混合的不同字段统一到渲染层字段
  const normalizedActivities = useMemo(() => {
    const rawRecords = data?.data?.activities || data?.data?.records || data?.data || data?.activities || [];
    const recordsArray = Array.isArray(rawRecords) ? rawRecords : [];

    return recordsArray.map((item) => {
      // 判断是“记录”还是“活动定义”
      const isRecord = 'status' in item && ('carbon_saved' in item || 'points_earned' in item || 'user_id' in item);
      const username = item.user_username || item.username || item.user_name || item.user || '-';
      const activityName = item.activity_name || item.activity_name_zh || item.activity_name_en || item.combined_name || item.name_zh || item.name_en || t('activities.unknownActivity');
      const categoryRaw = item.activity_category || item.category || 'unknown';
      const unitRaw = item.activity_unit || item.unit || '';
      const description = item.description || item.notes || item.note || item.remark || item.comments || '';
      return {
        id: item.id,
        images: item.images || [],
        user_username: username,
        activity_name: activityName,
        activity_category: categoryRaw || 'unknown',
        activity_unit: unitRaw || '-',
        data_value: item.data_value || item.amount || item.data || 0,
        carbon_saved: item.carbon_saved || 0,
        points_earned: item.points_earned || 0,
        status: item.status || (isRecord ? 'pending' : (item.is_active ? 'approved' : 'pending')),
        created_at: item.created_at || item.date || item.updated_at || null,
        description,
      };
    });
  }, [data, t]);

  useEffect(() => {
    const pendingSet = new Set(
      normalizedActivities
        .filter((item) => item.status === 'pending')
        .map((item) => item.id)
    );
    setSelectedIds((prev) => {
      const filtered = prev.filter((id) => pendingSet.has(id));
      if (filtered.length === prev.length && filtered.every((id, index) => id === prev[index])) {
        return prev;
      }
      return filtered;
    });
  }, [normalizedActivities]);

  const selectablePendingIds = normalizedActivities
    .filter((item) => item.status === 'pending')
    .map((item) => item.id);
  const selectedPendingIds = selectedIds.filter((id) => selectablePendingIds.includes(id));
  const headerCheckboxState =
    selectablePendingIds.length === 0
      ? false
      : selectedPendingIds.length === selectablePendingIds.length
        ? true
        : selectedPendingIds.length > 0
          ? 'indeterminate'
          : false;

  const pagination = data?.data?.pagination || data?.pagination || { page: filters.page, limit: filters.limit, total: normalizedActivities.length, pages: 1 };

  const reviewActivityMutation = useMutation(
    ({ id, status, admin_notes }) => adminAPI.reviewActivity(id, { status, admin_notes }),
    {
      onSuccess: () => {
        // show a short success animation on confirm button, then close dialog and refresh
        setConfirmSuccess(true);
        setTimeout(() => {
          setConfirmSuccess(false);
          queryClient.invalidateQueries('adminActivities');
          queryClient.invalidateQueries('activities'); // Invalidate user's activities as well
          toast.success(t('admin.activities.reviewSuccess'));
          setSelectedActivity(null);
          closeDecisionDialog();
        }, 600);
      },
      onError: (err) => {
        toast.error(t('admin.activities.reviewFailed'));
        console.error('Activity review failed:', err);
      }
    }
  );

  const reviewActivitiesBulkMutation = useMutation(
    ({ action, review_note, record_ids }) => adminAPI.reviewActivitiesBulk({ action, review_note, record_ids }),
    {
      onSuccess: () => {
        // show success animation then refresh and clear selection
        setConfirmSuccess(true);
        setTimeout(() => {
          setConfirmSuccess(false);
          queryClient.invalidateQueries('adminActivities');
          queryClient.invalidateQueries('activities');
          toast.success(t('admin.activities.reviewSuccess'));
          setSelectedActivity(null);
          setSelectedIds([]);
          closeDecisionDialog();
        }, 600);
      },
      onError: (err) => {
        toast.error(t('admin.activities.reviewFailed'));
        console.error('Bulk activity review failed:', err);
      }
    }
  );

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const handlePageChange = (page) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleViewDetails = (activity) => {
    setSelectedActivity(activity);
  };

  const closeDecisionDialog = () => {
    setDecisionDialog({ open: false, mode: null, activity: null, bulkIds: [], reason: '', error: '' });
  };

  const openApproveDialog = (activity) => {
    setDecisionDialog({ open: true, mode: 'approve', activity, bulkIds: [], reason: '', error: '' });
  };

  const openRejectDialog = (activity) => {
    setDecisionDialog({ open: true, mode: 'reject', activity, bulkIds: [], reason: '', error: '' });
  };

  const clearSelection = () => setSelectedIds([]);

  const handleToggleSelect = (activityId, status, checked) => {
    if (status !== 'pending') {
      return;
    }
    setSelectedIds((prev) => {
      const exists = prev.includes(activityId);
      if (checked && !exists) {
        return [...prev, activityId];
      }
      if (!checked && exists) {
        return prev.filter((id) => id !== activityId);
      }
      return prev;
    });
  };

  const handleToggleSelectAll = (checked) => {
    if (checked) {
      setSelectedIds((prev) => Array.from(new Set([...prev, ...selectablePendingIds])));
    } else {
      setSelectedIds((prev) => prev.filter((id) => !selectablePendingIds.includes(id)));
    }
  };

  const openBulkApproveDialog = () => {
    if (selectedPendingIds.length === 0) {
      return;
    }
    setDecisionDialog({ open: true, mode: 'approve', activity: null, bulkIds: selectedPendingIds, reason: '', error: '' });
  };

  const openBulkRejectDialog = () => {
    if (selectedPendingIds.length === 0) {
      return;
    }
    setDecisionDialog({ open: true, mode: 'reject', activity: null, bulkIds: selectedPendingIds, reason: '', error: '' });
  };

  const handleDecisionReasonChange = (event) => {
    const value = event.target.value;
    setDecisionDialog((prev) => ({ ...prev, reason: value, error: value.trim() ? '' : prev.error }));
  };

  const handleDecisionConfirm = () => {
    const bulkIds = decisionDialog.bulkIds || [];

    if (bulkIds.length > 0) {
      if (decisionDialog.mode === 'approve') {
        reviewActivitiesBulkMutation.mutate(
          { action: 'approve', record_ids: bulkIds },
          { onSettled: closeDecisionDialog }
        );
        return;
      }

      const trimmedReason = decisionDialog.reason.trim();
      if (!trimmedReason) {
        setDecisionDialog((prev) => ({ ...prev, error: t('admin.activities.rejectReasonRequired') }));
        return;
      }

      reviewActivitiesBulkMutation.mutate(
        { action: 'reject', review_note: trimmedReason, record_ids: bulkIds },
        { onSettled: closeDecisionDialog }
      );
      return;
    }

    if (!decisionDialog.activity) {
      return;
    }

    const basePayload = { id: decisionDialog.activity.id };

    if (decisionDialog.mode === 'approve') {
      reviewActivityMutation.mutate(
        { ...basePayload, status: 'approved' },
        { onSettled: closeDecisionDialog }
      );
      return;
    }

    const trimmedReason = decisionDialog.reason.trim();
    if (!trimmedReason) {
      setDecisionDialog((prev) => ({ ...prev, error: t('admin.activities.rejectReasonRequired') }));
      return;
    }

    reviewActivityMutation.mutate(
      { ...basePayload, status: 'rejected', admin_notes: trimmedReason },
      { onSettled: closeDecisionDialog }
    );
  };

  // Combined loading state for single + bulk review mutations
  const isReviewSubmitting = reviewActivityMutation.isLoading || reviewActivitiesBulkMutation.isLoading;

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">{t('admin.activities.title')}</h2>
      <p className="text-muted-foreground">{t('admin.activities.description')}</p>

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
                placeholder={t('admin.activities.searchPlaceholder')}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.activities.status')}</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">{t('common.all')}</option>
              <option value="pending">{t('activities.status.pending')}</option>
              <option value="approved">{t('activities.status.approved')}</option>
              <option value="rejected">{t('activities.status.rejected')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.sort.sortBy')}</label>
            <select
              value={filters.sort}
              onChange={(e) => handleFilterChange('sort', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="created_at_asc">{t('common.sort.oldest')}</option>
              <option value="created_at_desc">{t('common.sort.newest')}</option>
            </select>
          </div>
          <div className="flex flex-col space-y-2 md:col-span-3 lg:col-span-1">
            <label className="flex items-center text-sm font-medium text-gray-700 space-x-2">
              <input
                type="checkbox"
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
              />
              <span>{t('common.autoRefresh') || 'Auto Refresh'}</span>
            </label>
            {autoRefresh && (
              <div className="flex items-center space-x-2">
                <select
                  value={refreshIntervalMs}
                  onChange={(e) => setRefreshIntervalMs(parseInt(e.target.value, 10))}
                  className="w-full px-2 py-1 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
                >
                  <option value={5000}>5s</option>
                  <option value={10000}>10s</option>
                  <option value={15000}>15s</option>
                  <option value={30000}>30s</option>
                  <option value={60000}>60s</option>
                </select>
                <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
                  {isFetching ? <Loader2 className="h-3 w-3 animate-spin" /> : t('common.refreshNow') || 'Refresh'}
                </Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {(!initialLoadedRef.current && isLoading) ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{t('errors.loadFailed')}</AlertDescription>
        </Alert>
  ) : normalizedActivities.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg shadow-sm border">
          <h3 className="text-xl font-semibold">{t('admin.activities.noActivitiesFound')}</h3>
          <p className="text-muted-foreground mt-2">{t('admin.activities.tryDifferentFilters')}</p>
        </div>
      ) : (
        <>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            {selectedPendingIds.length > 0 ? (
              <p className="text-sm text-gray-600">
                {t('admin.activities.selectedCount', { count: selectedPendingIds.length })}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {t('admin.activities.selectionHint')}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={clearSelection}
              disabled={selectedPendingIds.length === 0 || reviewActivitiesBulkMutation.isLoading}
            >
              {t('admin.activities.clearSelection')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={openBulkApproveDialog}
              disabled={selectedPendingIds.length === 0 || reviewActivitiesBulkMutation.isLoading}
              className="group inline-flex items-center transition-transform duration-150 hover:scale-105"
            >
              {reviewActivitiesBulkMutation.isLoading && decisionDialog.bulkIds && decisionDialog.bulkIds.length > 0 && decisionDialog.mode === 'approve' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <CheckCircle className="mr-2 h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
              )}
              {t('admin.activities.bulkApprove')}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={openBulkRejectDialog}
              disabled={selectedPendingIds.length === 0 || reviewActivitiesBulkMutation.isLoading}
            >
              {reviewActivitiesBulkMutation.isLoading && decisionDialog.bulkIds && decisionDialog.bulkIds.length > 0 && decisionDialog.mode === 'reject' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              {t('admin.activities.bulkReject')}
            </Button>
          </div>
        </div>

          <div className="overflow-x-auto bg-white rounded-lg shadow-sm border relative">
            {initialLoadedRef.current && isFetching && (
              <div className="absolute top-2 right-2 flex items-center text-xs text-gray-500">
                <Loader2 className="h-3 w-3 animate-spin mr-1" /> {t('common.loading')}
              </div>
            )}
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <Checkbox
                      aria-label={t('admin.activities.selectAll')}
                      checked={headerCheckboxState}
                      onCheckedChange={(value) => handleToggleSelectAll(value === true)}
                      disabled={selectablePendingIds.length === 0}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.activities.table.images')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.activities.table.user')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.activities.table.activity')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.activities.table.data')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.activities.table.carbonSaved')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.activities.table.points')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.activities.table.status')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.activities.table.date')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {normalizedActivities.map((activity) => (
                  <tr key={activity.id}>
                    <td className="px-4 py-4 align-top">
                      <Checkbox
                        aria-label={t('admin.activities.selectRecord')}
                        checked={selectedIds.includes(activity.id)}
                        disabled={activity.status !== 'pending'}
                        onCheckedChange={(value) => handleToggleSelect(activity.id, activity.status, value === true)}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap align-top">
                      <ImagePreviewGallery images={activity.images || []} maxThumbnails={1} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{activity.user_username}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">{activity.activity_name}</div>
                        <div className="text-sm text-gray-500">{t(`activities.categories.${activity.activity_category}`, activity.activity_category)}</div>
                      {activity.description && (
                        <div className="mt-1 text-xs text-gray-600 flex items-start max-w-[36rem]">
                          <MessageSquare className="h-3 w-3 mr-1 mt-[2px] text-gray-500" />
                          <span className="truncate" title={activity.description}>{activity.description}</span>
                        </div>
                      )}
                    </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatNumber(activity.data_value)} {t(`units.${activity.activity_unit}`, activity.activity_unit)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatNumber(activity.carbon_saved)} kg CO2e</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">+{formatNumber(activity.points_earned)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {activity.status === 'pending' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                          <Clock className="h-3 w-3 mr-1" /> {t('activities.status.pending')}
                        </span>
                      )}
                      {activity.status === 'approved' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          <CheckCircle className="h-3 w-3 mr-1" /> {t('activities.status.approved')}
                        </span>
                      )}
                      {activity.status === 'rejected' && (
                        <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          <XCircle className="h-3 w-3 mr-1" /> {t('activities.status.rejected')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{formatDateSafe(activity.created_at, 'yyyy-MM-dd')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Button variant="ghost" size="sm" onClick={() => handleViewDetails(activity)} className="mr-2">
                        <Eye className="h-4 w-4" />
                      </Button>
                      {activity.status === 'pending' && (
                        <>
                          <Button variant="ghost" size="sm" onClick={() => openApproveDialog(activity)} className="mr-2 text-green-600 hover:text-green-800">
                            <CheckCircle className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openRejectDialog(activity)} className="text-red-600 hover:text-red-800">
                            <XCircle className="h-4 w-4" />
                          </Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination
            // 后端字段: page, pages, limit, total
            // 兼容旧字段: current_page, total_pages, per_page, total_items
            currentPage={pagination.page || pagination.current_page || 1}
            totalPages={pagination.pages || pagination.total_pages || 1}
            onPageChange={handlePageChange}
            itemsPerPage={pagination.limit || pagination.per_page || filters.limit}
            totalItems={pagination.total || pagination.total_items || normalizedActivities.length}
          />
        </>
      )}

      <ActivityDetailModal
        activity={selectedActivity}
        isOpen={!!selectedActivity}
        onClose={() => setSelectedActivity(null)}
      />
      <Dialog open={decisionDialog.open} onOpenChange={(open) => (!open ? closeDecisionDialog() : null)}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {decisionDialog.mode === 'approve'
                ? t('admin.activities.dialog.approveTitle')
                : t('admin.activities.dialog.rejectTitle')}
            </DialogTitle>
            <DialogDescription>
              {decisionDialog.mode === 'approve'
                ? t('admin.activities.dialog.approveDescription')
                : t('admin.activities.dialog.rejectDescription')}
            </DialogDescription>
          </DialogHeader>
          {decisionDialog.activity && (
            <div className="mb-4 rounded-xl border border-emerald-200/40 bg-emerald-50/40 px-3 py-2 text-sm text-emerald-700">
              <span className="font-medium">{decisionDialog.activity.activity_name}</span> · {decisionDialog.activity.user_username}
            </div>
          )}
          {decisionDialog.mode === 'reject' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700" htmlFor="reject-reason">
                {t('admin.activities.dialog.reasonLabel')}
              </label>
              <Textarea
                id="reject-reason"
                rows={4}
                value={decisionDialog.reason}
                onChange={handleDecisionReasonChange}
                placeholder={t('admin.activities.dialog.reasonPlaceholder')}
              />
              {decisionDialog.error && (
                <p className="text-xs text-red-500">{decisionDialog.error}</p>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={closeDecisionDialog}>
              {t('common.cancel')}
            </Button>
            <Button
              variant={decisionDialog.mode === 'reject' ? 'destructive' : 'default'}
              onClick={handleDecisionConfirm}
              disabled={isReviewSubmitting}
              className="group inline-flex items-center transition-transform duration-150 hover:scale-105"
            >
              {confirmSuccess ? (
                <span className="inline-flex items-center bg-green-600 text-white px-3 py-1 rounded-md animate-pulse">
                  <CheckCircle className="h-4 w-4 mr-2" />
                  {t('admin.activities.dialog.approveAction')}
                </span>
              ) : isReviewSubmitting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : decisionDialog.mode === 'approve' ? (
                <CheckCircle className="mr-2 h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
              ) : (
                <XCircle className="mr-2 h-4 w-4" />
              )}
              {!confirmSuccess && (
                decisionDialog.mode === 'approve'
                  ? t('admin.activities.dialog.approveAction')
                  : t('admin.activities.dialog.rejectAction')
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

