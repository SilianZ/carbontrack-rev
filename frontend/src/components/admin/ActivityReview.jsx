import Silian_React, { useState as Silian_useState, useEffect as Silian_useEffect, useRef as Silian_useRef, useMemo as Silian_useMemo } from 'react';
import { useLocation as Silian_useLocation } from 'react-router-dom';
import { ImagePreviewGallery as Silian_ImagePreviewGallery } from '../common/ImagePreviewGallery';
import { useQuery as Silian_useQuery, useMutation as Silian_useMutation, useQueryClient as Silian_useQueryClient } from 'react-query';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { formatNumber as Silian_formatNumber, formatDateSafe as Silian_formatDateSafe } from '../../lib/utils';
import { adminAPI as Silian_adminAPI } from '../../lib/api';
import { Loader2 as Silian_Loader2, CheckCircle as Silian_CheckCircle, XCircle as Silian_XCircle, Eye as Silian_Eye, Search as Silian_Search, MessageSquare as Silian_MessageSquare, Clock as Silian_Clock } from 'lucide-react';
import { Button as Silian_Button } from '../ui/Button';
import { Input as Silian_Input } from '../ui/Input';
import { Textarea as Silian_Textarea } from '../ui/textarea';
import { Checkbox as Silian_Checkbox } from '../ui/checkbox';
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
import { ActivityDetailModal as Silian_ActivityDetailModal } from '../activities/ActivityDetailModal';
import { toast as Silian_toast } from 'react-hot-toast';
// merged into utils import above

export function ActivityReview() {
  const { t: Silian_t } = Silian_useTranslation(['activities', 'admin', 'common', 'errors', 'pagination', 'units']);
  const Silian_queryClient = Silian_useQueryClient();
  const Silian_location = Silian_useLocation();
  const [Silian_filters, Silian_setFilters] = Silian_useState({
    search: '',
    status: 'pending', // Default to pending activities
    page: 1,
    limit: 10,
    sort: 'created_at_asc' // Oldest first for review
  });
  const [Silian_selectedActivity, Silian_setSelectedActivity] = Silian_useState(null);
  const [Silian_selectedIds, Silian_setSelectedIds] = Silian_useState([]);
  const [Silian_decisionDialog, Silian_setDecisionDialog] = Silian_useState({ open: false, mode: null, activity: null, bulkIds: [], reason: '', error: '' });
  const [Silian_confirmSuccess, Silian_setConfirmSuccess] = Silian_useState(false);
  // 自动刷新控制
  const [Silian_autoRefresh, Silian_setAutoRefresh] = Silian_useState(true);
  const [Silian_refreshIntervalMs, Silian_setRefreshIntervalMs] = Silian_useState(15000); // 15s 默认

  // 标记是否已完成首次加载
  const Silian_initialLoadedRef = Silian_useRef(false);

  // 使用碳减排记录审核接口（多路由别名: /admin/activities | /admin/carbon-records | /admin/carbon-activities/pending）
  const { data: Silian_data, isLoading: Silian_isLoading, error: Silian_error, isFetching: Silian_isFetching, refetch: Silian_refetch } = Silian_useQuery(
    ['adminActivities', Silian_filters],
    () => Silian_adminAPI.getActivityRecords(Silian_filters).then(Silian_r => Silian_r.data),
    {
      keepPreviousData: true,
      refetchInterval: Silian_autoRefresh && !Silian_selectedActivity ? Silian_refreshIntervalMs : false,
      refetchIntervalInBackground: true
    }
  );

  Silian_useEffect(() => {
    if (!Silian_isLoading && !Silian_error) {
      Silian_initialLoadedRef.current = true;
    }
  }, [Silian_isLoading, Silian_error]);

  // 后端记录列表结构：{ success, data: [ { record... } ], pagination: {...} }
  // 兼容旧结构：{ data: { activities: [...] } } 或直接数组。
  // 归一化：将 carbon_records 与 carbon_activities 定义混合的不同字段统一到渲染层字段
  const Silian_normalizedActivities = Silian_useMemo(() => {
    const Silian_rawRecords = Silian_data?.data?.activities || Silian_data?.data?.records || Silian_data?.data || Silian_data?.activities || [];
    const Silian_recordsArray = Array.isArray(Silian_rawRecords) ? Silian_rawRecords : [];

    return Silian_recordsArray.map((Silian_item) => {
      // 判断是“记录”还是“活动定义”
      const Silian_isRecord = 'status' in Silian_item && ('carbon_saved' in Silian_item || 'points_earned' in Silian_item || 'user_id' in Silian_item);
      const Silian_username = Silian_item.user_username || Silian_item.username || Silian_item.user_name || Silian_item.user || '-';
      const Silian_activityName = Silian_item.activity_name || Silian_item.activity_name_zh || Silian_item.activity_name_en || Silian_item.combined_name || Silian_item.name_zh || Silian_item.name_en || Silian_t('activities.unknownActivity');
      const Silian_categoryRaw = Silian_item.activity_category || Silian_item.category || 'unknown';
      const Silian_unitRaw = Silian_item.activity_unit || Silian_item.unit || '';
      const Silian_description = Silian_item.description || Silian_item.notes || Silian_item.note || Silian_item.remark || Silian_item.comments || '';
      return {
        id: Silian_item.id,
        images: Silian_item.images || [],
        user_username: Silian_username,
        activity_name: Silian_activityName,
        activity_category: Silian_categoryRaw || 'unknown',
        activity_unit: Silian_unitRaw || '-',
        data_value: Silian_item.data_value || Silian_item.amount || Silian_item.data || 0,
        carbon_saved: Silian_item.carbon_saved || 0,
        points_earned: Silian_item.points_earned || 0,
        status: Silian_item.status || (Silian_isRecord ? 'pending' : (Silian_item.is_active ? 'approved' : 'pending')),
        created_at: Silian_item.created_at || Silian_item.date || Silian_item.updated_at || null,
        description: Silian_description,
      };
    });
  }, [Silian_data, Silian_t]);

  Silian_useEffect(() => {
    const Silian_pendingSet = new Set(
      Silian_normalizedActivities
        .filter((Silian_item) => Silian_item.status === 'pending')
        .map((Silian_item) => Silian_item.id)
    );
    Silian_setSelectedIds((Silian_prev) => {
      const Silian_filtered = Silian_prev.filter((Silian_id) => Silian_pendingSet.has(Silian_id));
      if (Silian_filtered.length === Silian_prev.length && Silian_filtered.every((Silian_id, Silian_index) => Silian_id === Silian_prev[Silian_index])) {
        return Silian_prev;
      }
      return Silian_filtered;
    });
  }, [Silian_normalizedActivities]);

  const Silian_selectablePendingIds = Silian_normalizedActivities
    .filter((Silian_item) => Silian_item.status === 'pending')
    .map((Silian_item) => Silian_item.id);
  const Silian_selectedPendingIds = Silian_selectedIds.filter((Silian_id) => Silian_selectablePendingIds.includes(Silian_id));
  const Silian_headerCheckboxState =
    Silian_selectablePendingIds.length === 0
      ? false
      : Silian_selectedPendingIds.length === Silian_selectablePendingIds.length
        ? true
        : Silian_selectedPendingIds.length > 0
          ? 'indeterminate'
          : false;

  const Silian_pagination = Silian_data?.data?.pagination || Silian_data?.pagination || { page: Silian_filters.page, limit: Silian_filters.limit, total: Silian_normalizedActivities.length, pages: 1 };

  Silian_useEffect(() => {
    const Silian_routedActivity = Silian_location.state?.selectedActivity;
    if (Silian_routedActivity?.id) {
      Silian_setSelectedActivity(Silian_routedActivity);
    }
  }, [Silian_location.state]);

  const Silian_reviewActivityMutation = Silian_useMutation(
    ({ id: Silian_id, status: Silian_status, admin_notes: Silian_admin_notes }) => Silian_adminAPI.reviewActivity(Silian_id, { status: Silian_status, admin_notes: Silian_admin_notes }),
    {
      onSuccess: () => {
        // show a short success animation on confirm button, then close dialog and refresh
        Silian_setConfirmSuccess(true);
        setTimeout(() => {
          Silian_setConfirmSuccess(false);
          Silian_queryClient.invalidateQueries('adminActivities');
          Silian_queryClient.invalidateQueries('activities'); // Invalidate user's activities as well
          Silian_toast.success(Silian_t('admin.activities.reviewSuccess'));
          Silian_setSelectedActivity(null);
          Silian_closeDecisionDialog();
        }, 600);
      },
      onError: (Silian_err) => {
        Silian_toast.error(Silian_t('admin.activities.reviewFailed'));
        console.error('Activity review failed:', Silian_err);
      }
    }
  );

  const Silian_reviewActivitiesBulkMutation = Silian_useMutation(
    ({ action: Silian_action, review_note: Silian_review_note, record_ids: Silian_record_ids }) => Silian_adminAPI.reviewActivitiesBulk({ action: Silian_action, review_note: Silian_review_note, record_ids: Silian_record_ids }),
    {
      onSuccess: () => {
        // show success animation then refresh and clear selection
        Silian_setConfirmSuccess(true);
        setTimeout(() => {
          Silian_setConfirmSuccess(false);
          Silian_queryClient.invalidateQueries('adminActivities');
          Silian_queryClient.invalidateQueries('activities');
          Silian_toast.success(Silian_t('admin.activities.reviewSuccess'));
          Silian_setSelectedActivity(null);
          Silian_setSelectedIds([]);
          Silian_closeDecisionDialog();
        }, 600);
      },
      onError: (Silian_err) => {
        Silian_toast.error(Silian_t('admin.activities.reviewFailed'));
        console.error('Bulk activity review failed:', Silian_err);
      }
    }
  );

  const Silian_handleFilterChange = (Silian_key, Silian_value) => {
    Silian_setFilters(Silian_prev => ({ ...Silian_prev, [Silian_key]: Silian_value, page: 1 }));
  };

  const Silian_handlePageChange = (Silian_page) => {
    Silian_setFilters(Silian_prev => ({ ...Silian_prev, page: Silian_page }));
  };

  const Silian_handleViewDetails = (Silian_activity) => {
    Silian_setSelectedActivity(Silian_activity);
  };

  const Silian_closeDecisionDialog = () => {
    Silian_setDecisionDialog({ open: false, mode: null, activity: null, bulkIds: [], reason: '', error: '' });
  };

  const Silian_openApproveDialog = (Silian_activity) => {
    Silian_setDecisionDialog({ open: true, mode: 'approve', activity: Silian_activity, bulkIds: [], reason: '', error: '' });
  };

  const Silian_openRejectDialog = (Silian_activity) => {
    Silian_setDecisionDialog({ open: true, mode: 'reject', activity: Silian_activity, bulkIds: [], reason: '', error: '' });
  };

  const Silian_clearSelection = () => Silian_setSelectedIds([]);

  const Silian_handleToggleSelect = (Silian_activityId, Silian_status, Silian_checked) => {
    if (Silian_status !== 'pending') {
      return;
    }
    Silian_setSelectedIds((Silian_prev) => {
      const Silian_exists = Silian_prev.includes(Silian_activityId);
      if (Silian_checked && !Silian_exists) {
        return [...Silian_prev, Silian_activityId];
      }
      if (!Silian_checked && Silian_exists) {
        return Silian_prev.filter((Silian_id) => Silian_id !== Silian_activityId);
      }
      return Silian_prev;
    });
  };

  const Silian_handleToggleSelectAll = (Silian_checked) => {
    if (Silian_checked) {
      Silian_setSelectedIds((Silian_prev) => Array.from(new Set([...Silian_prev, ...Silian_selectablePendingIds])));
    } else {
      Silian_setSelectedIds((Silian_prev) => Silian_prev.filter((Silian_id) => !Silian_selectablePendingIds.includes(Silian_id)));
    }
  };

  const Silian_openBulkApproveDialog = () => {
    if (Silian_selectedPendingIds.length === 0) {
      return;
    }
    Silian_setDecisionDialog({ open: true, mode: 'approve', activity: null, bulkIds: Silian_selectedPendingIds, reason: '', error: '' });
  };

  const Silian_openBulkRejectDialog = () => {
    if (Silian_selectedPendingIds.length === 0) {
      return;
    }
    Silian_setDecisionDialog({ open: true, mode: 'reject', activity: null, bulkIds: Silian_selectedPendingIds, reason: '', error: '' });
  };

  const Silian_handleDecisionReasonChange = (Silian_event) => {
    const Silian_value = Silian_event.target.value;
    Silian_setDecisionDialog((Silian_prev) => ({ ...Silian_prev, reason: Silian_value, error: Silian_value.trim() ? '' : Silian_prev.error }));
  };

  const Silian_handleDecisionConfirm = () => {
    const Silian_bulkIds = Silian_decisionDialog.bulkIds || [];

    if (Silian_bulkIds.length > 0) {
      if (Silian_decisionDialog.mode === 'approve') {
        Silian_reviewActivitiesBulkMutation.mutate(
          { action: 'approve', record_ids: Silian_bulkIds },
          { onSettled: Silian_closeDecisionDialog }
        );
        return;
      }

      const Silian_trimmedReason = Silian_decisionDialog.reason.trim();
      if (!Silian_trimmedReason) {
        Silian_setDecisionDialog((Silian_prev) => ({ ...Silian_prev, error: Silian_t('admin.activities.rejectReasonRequired') }));
        return;
      }

      Silian_reviewActivitiesBulkMutation.mutate(
        { action: 'reject', review_note: Silian_trimmedReason, record_ids: Silian_bulkIds },
        { onSettled: Silian_closeDecisionDialog }
      );
      return;
    }

    if (!Silian_decisionDialog.activity) {
      return;
    }

    const Silian_basePayload = { id: Silian_decisionDialog.activity.id };

    if (Silian_decisionDialog.mode === 'approve') {
      Silian_reviewActivityMutation.mutate(
        { ...Silian_basePayload, status: 'approved' },
        { onSettled: Silian_closeDecisionDialog }
      );
      return;
    }

    const Silian_trimmedReason = Silian_decisionDialog.reason.trim();
    if (!Silian_trimmedReason) {
      Silian_setDecisionDialog((Silian_prev) => ({ ...Silian_prev, error: Silian_t('admin.activities.rejectReasonRequired') }));
      return;
    }

    Silian_reviewActivityMutation.mutate(
      { ...Silian_basePayload, status: 'rejected', admin_notes: Silian_trimmedReason },
      { onSettled: Silian_closeDecisionDialog }
    );
  };

  // Combined loading state for single + bulk review mutations
const Silian_isReviewSubmitting = Silian_reviewActivityMutation.isLoading || Silian_reviewActivitiesBulkMutation.isLoading;
  const Silian_reviewStatusClassName = {
    pending: 'border border-blue-200 bg-blue-100 text-blue-800 dark:border-blue-500/30 dark:bg-blue-500/15 dark:text-blue-300',
    approved: 'border border-emerald-200 bg-emerald-100 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300',
    rejected: 'border border-red-200 bg-red-100 text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300',
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">{Silian_t('admin.activities.title')}</h2>
      <p className="text-muted-foreground">{Silian_t('admin.activities.description')}</p>

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
                placeholder={Silian_t('admin.activities.searchPlaceholder')}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">{Silian_t('admin.activities.status')}</label>
            <select
              value={Silian_filters.status}
              onChange={(Silian_e) => Silian_handleFilterChange('status', Silian_e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-transparent"
            >
              <option value="">{Silian_t('common.all')}</option>
              <option value="pending">{Silian_t('activities.status.pending')}</option>
              <option value="approved">{Silian_t('activities.status.approved')}</option>
              <option value="rejected">{Silian_t('activities.status.rejected')}</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">{Silian_t('common.sort.sortBy')}</label>
            <select
              value={Silian_filters.sort}
              onChange={(Silian_e) => Silian_handleFilterChange('sort', Silian_e.target.value)}
              className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-transparent"
            >
              <option value="created_at_asc">{Silian_t('common.sort.oldest')}</option>
              <option value="created_at_desc">{Silian_t('common.sort.newest')}</option>
            </select>
          </div>
          <div className="flex flex-col space-y-2 md:col-span-3 lg:col-span-1">
            <label className="flex items-center space-x-2 text-sm font-medium text-foreground">
              <input
                type="checkbox"
                className="rounded border-input bg-background text-green-600 focus:ring-green-500"
                checked={Silian_autoRefresh}
                onChange={(Silian_e) => Silian_setAutoRefresh(Silian_e.target.checked)}
              />
              <span>{Silian_t('common.autoRefresh') || 'Auto Refresh'}</span>
            </label>
            {Silian_autoRefresh && (
              <div className="flex items-center space-x-2">
                <select
                  value={Silian_refreshIntervalMs}
                  onChange={(Silian_e) => Silian_setRefreshIntervalMs(parseInt(Silian_e.target.value, 10))}
                  className="w-full rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-green-500/20 focus:border-transparent"
                >
                  <option value={5000}>5s</option>
                  <option value={10000}>10s</option>
                  <option value={15000}>15s</option>
                  <option value={30000}>30s</option>
                  <option value={60000}>60s</option>
                </select>
                <Silian_Button variant="outline" size="sm" onClick={() => Silian_refetch()} disabled={Silian_isFetching}>
                  {Silian_isFetching ? <Silian_Loader2 className="h-3 w-3 animate-spin" /> : Silian_t('common.refreshNow') || 'Refresh'}
                </Silian_Button>
              </div>
            )}
          </div>
        </div>
      </div>

      {(!Silian_initialLoadedRef.current && Silian_isLoading) ? (
        <div className="flex justify-center items-center h-64">
          <Silian_Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </div>
      ) : Silian_error ? (
        <Silian_Alert variant="destructive">
          <Silian_AlertTitle>{Silian_t('common.error')}</Silian_AlertTitle>
          <Silian_AlertDescription>{Silian_t('errors.loadFailed')}</Silian_AlertDescription>
        </Silian_Alert>
  ) : Silian_normalizedActivities.length === 0 ? (
        <div className="rounded-lg border border-border bg-card py-16 text-center shadow-sm">
          <h3 className="text-xl font-semibold">{Silian_t('admin.activities.noActivitiesFound')}</h3>
          <p className="text-muted-foreground mt-2">{Silian_t('admin.activities.tryDifferentFilters')}</p>
        </div>
      ) : (
        <>
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            {Silian_selectedPendingIds.length > 0 ? (
              <p className="text-sm text-muted-foreground">
                {Silian_t('admin.activities.selectedCount', { count: Silian_selectedPendingIds.length })}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                {Silian_t('admin.activities.selectionHint')}
              </p>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Silian_Button
              variant="ghost"
              size="sm"
              onClick={Silian_clearSelection}
              disabled={Silian_selectedPendingIds.length === 0 || Silian_reviewActivitiesBulkMutation.isLoading}
            >
              {Silian_t('admin.activities.clearSelection')}
            </Silian_Button>
            <Silian_Button
              variant="outline"
              size="sm"
              onClick={Silian_openBulkApproveDialog}
              disabled={Silian_selectedPendingIds.length === 0 || Silian_reviewActivitiesBulkMutation.isLoading}
              className="group inline-flex items-center transition-transform duration-150 hover:scale-105"
            >
              {Silian_reviewActivitiesBulkMutation.isLoading && Silian_decisionDialog.bulkIds && Silian_decisionDialog.bulkIds.length > 0 && Silian_decisionDialog.mode === 'approve' ? (
                <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Silian_CheckCircle className="mr-2 h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
              )}
              {Silian_t('admin.activities.bulkApprove')}
            </Silian_Button>
            <Silian_Button
              variant="destructive"
              size="sm"
              onClick={Silian_openBulkRejectDialog}
              disabled={Silian_selectedPendingIds.length === 0 || Silian_reviewActivitiesBulkMutation.isLoading}
            >
              {Silian_reviewActivitiesBulkMutation.isLoading && Silian_decisionDialog.bulkIds && Silian_decisionDialog.bulkIds.length > 0 && Silian_decisionDialog.mode === 'reject' ? (
                <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Silian_XCircle className="mr-2 h-4 w-4" />
              )}
              {Silian_t('admin.activities.bulkReject')}
            </Silian_Button>
          </div>
        </div>

          <div className="relative overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
            {Silian_initialLoadedRef.current && Silian_isFetching && (
              <div className="absolute top-2 right-2 flex items-center text-xs text-muted-foreground">
                <Silian_Loader2 className="h-3 w-3 animate-spin mr-1" /> {Silian_t('common.loading')}
              </div>
            )}
            <table className="min-w-full divide-y divide-border">
              <thead className="bg-muted/50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                    <Silian_Checkbox
                      aria-label={Silian_t('admin.activities.selectAll')}
                      checked={Silian_headerCheckboxState}
                      onCheckedChange={(Silian_value) => Silian_handleToggleSelectAll(Silian_value === true)}
                      disabled={Silian_selectablePendingIds.length === 0}
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.activities.table.images')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.activities.table.user')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.activities.table.activity')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.activities.table.data')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.activities.table.carbonSaved')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.activities.table.points')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.activities.table.status')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.activities.table.date')}</th>
                  <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('common.actions')}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border bg-card">
                {Silian_normalizedActivities.map((Silian_activity) => (
                  <tr key={Silian_activity.id}>
                    <td className="px-4 py-4 align-top">
                      <Silian_Checkbox
                        aria-label={Silian_t('admin.activities.selectRecord')}
                        checked={Silian_selectedIds.includes(Silian_activity.id)}
                        disabled={Silian_activity.status !== 'pending'}
                        onCheckedChange={(Silian_value) => Silian_handleToggleSelect(Silian_activity.id, Silian_activity.status, Silian_value === true)}
                      />
                    </td>
                    <td className="px-4 py-4 whitespace-nowrap align-top">
                      <Silian_ImagePreviewGallery images={Silian_activity.images || []} maxThumbnails={1} />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{Silian_activity.user_username}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-foreground">{Silian_activity.activity_name}</div>
                        <div className="text-sm text-muted-foreground">{Silian_t(`activities.categories.${Silian_activity.activity_category}`, Silian_activity.activity_category)}</div>
                      {Silian_activity.description && (
                        <div className="mt-1 flex max-w-[36rem] items-start text-xs text-muted-foreground">
                          <Silian_MessageSquare className="mt-[2px] mr-1 h-3 w-3 text-muted-foreground" />
                          <span className="truncate" title={Silian_activity.description}>{Silian_activity.description}</span>
                        </div>
                      )}
                    </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{Silian_formatNumber(Silian_activity.data_value)} {Silian_t(`units.${Silian_activity.activity_unit}`, Silian_activity.activity_unit)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{Silian_formatNumber(Silian_activity.carbon_saved)} kg CO2e</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-green-600 font-semibold">+{Silian_formatNumber(Silian_activity.points_earned)}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                      {Silian_activity.status === 'pending' && (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${Silian_reviewStatusClassName.pending}`}>
                          <Silian_Clock className="h-3 w-3 mr-1" /> {Silian_t('activities.status.pending')}
                        </span>
                      )}
                      {Silian_activity.status === 'approved' && (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${Silian_reviewStatusClassName.approved}`}>
                          <Silian_CheckCircle className="h-3 w-3 mr-1" /> {Silian_t('activities.status.approved')}
                        </span>
                      )}
                      {Silian_activity.status === 'rejected' && (
                        <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${Silian_reviewStatusClassName.rejected}`}>
                          <Silian_XCircle className="h-3 w-3 mr-1" /> {Silian_t('activities.status.rejected')}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{Silian_formatDateSafe(Silian_activity.created_at, 'yyyy-MM-dd')}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                      <Silian_Button variant="ghost" size="sm" onClick={() => Silian_handleViewDetails(Silian_activity)} className="mr-2">
                        <Silian_Eye className="h-4 w-4" />
                      </Silian_Button>
                      {Silian_activity.status === 'pending' && (
                        <>
                          <Silian_Button variant="ghost" size="sm" onClick={() => Silian_openApproveDialog(Silian_activity)} className="mr-2 text-green-600 hover:text-green-700 dark:text-green-300 dark:hover:text-green-200">
                            <Silian_CheckCircle className="h-4 w-4" />
                          </Silian_Button>
                          <Silian_Button variant="ghost" size="sm" onClick={() => Silian_openRejectDialog(Silian_activity)} className="text-red-600 hover:text-red-700 dark:text-red-300 dark:hover:text-red-200">
                            <Silian_XCircle className="h-4 w-4" />
                          </Silian_Button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Silian_Pagination
            // 后端字段: page, pages, limit, total
            // 兼容旧字段: current_page, total_pages, per_page, total_items
            currentPage={Silian_pagination.page || Silian_pagination.current_page || 1}
            totalPages={Silian_pagination.pages || Silian_pagination.total_pages || 1}
            onPageChange={Silian_handlePageChange}
            itemsPerPage={Silian_pagination.limit || Silian_pagination.per_page || Silian_filters.limit}
            totalItems={Silian_pagination.total || Silian_pagination.total_items || Silian_normalizedActivities.length}
          />
        </>
      )}

      <Silian_ActivityDetailModal
        activity={Silian_selectedActivity}
        isOpen={!!Silian_selectedActivity}
        onClose={() => Silian_setSelectedActivity(null)}
      />
      <Silian_Dialog open={Silian_decisionDialog.open} onOpenChange={(Silian_open) => (!Silian_open ? Silian_closeDecisionDialog() : null)}>
        <Silian_DialogContent className="sm:max-w-lg">
          <Silian_DialogHeader>
            <Silian_DialogTitle>
              {Silian_decisionDialog.mode === 'approve'
                ? Silian_t('admin.activities.dialog.approveTitle')
                : Silian_t('admin.activities.dialog.rejectTitle')}
            </Silian_DialogTitle>
            <Silian_DialogDescription>
              {Silian_decisionDialog.mode === 'approve'
                ? Silian_t('admin.activities.dialog.approveDescription')
                : Silian_t('admin.activities.dialog.rejectDescription')}
            </Silian_DialogDescription>
          </Silian_DialogHeader>
          {Silian_decisionDialog.activity && (
            <div className="mb-4 rounded-xl border border-emerald-200/40 bg-emerald-50/60 px-3 py-2 text-sm text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300">
              <span className="font-medium">{Silian_decisionDialog.activity.activity_name}</span> · {Silian_decisionDialog.activity.user_username}
            </div>
          )}
          {Silian_decisionDialog.mode === 'reject' && (
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground" htmlFor="reject-reason">
                {Silian_t('admin.activities.dialog.reasonLabel')}
              </label>
              <Silian_Textarea
                id="reject-reason"
                rows={4}
                value={Silian_decisionDialog.reason}
                onChange={Silian_handleDecisionReasonChange}
                placeholder={Silian_t('admin.activities.dialog.reasonPlaceholder')}
              />
              {Silian_decisionDialog.error && (
                <p className="text-xs text-red-500">{Silian_decisionDialog.error}</p>
              )}
            </div>
          )}
          <Silian_DialogFooter>
            <Silian_Button variant="outline" onClick={Silian_closeDecisionDialog}>
              {Silian_t('common.cancel')}
            </Silian_Button>
            <Silian_Button
              variant={Silian_decisionDialog.mode === 'reject' ? 'destructive' : 'default'}
              onClick={Silian_handleDecisionConfirm}
              disabled={Silian_isReviewSubmitting}
              className="group inline-flex items-center transition-transform duration-150 hover:scale-105"
            >
              {Silian_confirmSuccess ? (
                <span className="inline-flex items-center bg-green-600 text-white px-3 py-1 rounded-md animate-pulse">
                  <Silian_CheckCircle className="h-4 w-4 mr-2" />
                  {Silian_t('admin.activities.dialog.approveAction')}
                </span>
              ) : Silian_isReviewSubmitting ? (
                <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : Silian_decisionDialog.mode === 'approve' ? (
                <Silian_CheckCircle className="mr-2 h-4 w-4 transition-transform duration-200 group-hover:scale-110" />
              ) : (
                <Silian_XCircle className="mr-2 h-4 w-4" />
              )}
              {!Silian_confirmSuccess && (
                Silian_decisionDialog.mode === 'approve'
                  ? Silian_t('admin.activities.dialog.approveAction')
                  : Silian_t('admin.activities.dialog.rejectAction')
              )}
            </Silian_Button>
          </Silian_DialogFooter>
        </Silian_DialogContent>
      </Silian_Dialog>
    </div>
  );
}

