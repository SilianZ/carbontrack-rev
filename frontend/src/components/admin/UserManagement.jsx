import React, { useEffect, useMemo, useRef, useState } from 'react';
import { format } from 'date-fns';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { adminAPI } from '../../lib/api';
import {
  Loader2,
  Trash2,
  CheckCircle,
  XCircle,
  Search,
  PlusCircle,
  Sparkles,
  Shield,
  Ban,
  Users as UsersIcon,
  Eye,
  Leaf,
  ClipboardList,
  CalendarDays,
  Award,
  Edit,
  Settings,
  Flame,
  RefreshCcw,
} from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Alert, AlertTitle, AlertDescription } from '../ui/Alert';
import { Pagination } from '../ui/Pagination';
import { Checkbox } from '../ui/checkbox';
import { Switch } from '../ui/switch';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';
import { Label } from '../ui/label';
import { Textarea } from '../ui/textarea';
import { Badge } from '../ui/badge';
import BadgeBulkAwardDialog from './badges/BadgeBulkAwardDialog';
import R2Image from '@/components/common/R2Image';
import { toast } from 'react-hot-toast';

const DEFAULT_FILTERS = {
  search: '',
  role: '',
  status: '',
  page: 1,
  limit: 10,
  sort: 'created_at_desc',
};

const normalizeUser = (user = {}) => {
  const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };
  return {
    ...user,
    is_admin: user.is_admin === true || user.is_admin === 1 || user.is_admin === '1',
    checkin_days: toNumber(user.checkin_days),
    makeup_checkins: toNumber(user.makeup_checkins),
  };
};

const normalizeUserBadgeEntry = (entry = {}) => ({
  ...entry,
  id: entry.id,
  badge: entry.badge || {},
});

const normalizeRecentBadge = (entry = {}) => normalizeUserBadgeEntry(entry);

const normalizeMetrics = (metrics = {}) => ({
  total_points_earned: Number(metrics.total_points_earned ?? 0),
  total_points_balance: Number(metrics.total_points_balance ?? 0),
  total_carbon_saved: Number(metrics.total_carbon_saved ?? 0),
  total_records: Number(metrics.total_records ?? 0),
  total_approved_records: Number(metrics.total_approved_records ?? 0),
});

const normalizeBadgeSummary = (summary = {}) => ({
  awarded: Number(summary.awarded ?? 0),
  revoked: Number(summary.revoked ?? 0),
  total: Number(summary.total ?? (Number(summary.awarded ?? 0) + Number(summary.revoked ?? 0))),
});

function normalizeUsersResponse(response) {
  const payload = response?.data?.data || response?.data || {};
  if (Array.isArray(payload.users)) {
    return {
      users: payload.users.map(normalizeUser),
      pagination: payload.pagination || {},
    };
  }
  const nested = payload.data || {};
  const users = Array.isArray(nested.users) ? nested.users.map(normalizeUser) : [];
  return {
    users,
    pagination: nested.pagination || {},
  };
}

export function UserManagement() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: null, user: null, payload: null });
  const [pointsDialog, setPointsDialog] = useState({ open: false, user: null, delta: '', reason: '' });
  const [selectedUsersMap, setSelectedUsersMap] = useState(new Map());
  const [bulkDialog, setBulkDialog] = useState({ open: false, presetUsers: [] });
  const [detailState, setDetailState] = useState({ open: false, userId: null });
  const [showRevokedBadges, setShowRevokedBadges] = useState(false);
  const [editDialog, setEditDialog] = useState({
    open: false,
    user: null,
    notes: '',
    groupId: '',
    quotaFlat: {}
  });

  const { data: groups } = useQuery('adminUserGroups', () =>
    adminAPI.getUserGroups().then(res => res.data?.data || [])
  );

  const apiFilterParams = useMemo(() => {
    const base = {
      page: filters.page,
      limit: filters.limit,
      sort: filters.sort,
    };
    const trimmedSearch = filters.search.trim();
    if (trimmedSearch) {
      base.q = trimmedSearch;
    }
    if (filters.status) {
      base.status = filters.status;
    }
    if (filters.role === 'admin') {
      base.is_admin = 1;
    } else if (filters.role === 'user') {
      base.is_admin = 0;
    }
    return base;
  }, [filters]);

  const usersQuery = useQuery(
    ['adminUsers', apiFilterParams],
    () => adminAPI.getUsers(apiFilterParams),
    { keepPreviousData: true }
  );

  const badgesQuery = useQuery(
    ['adminBadges', 'forAwarding'],
    () => adminAPI.getBadges({ limit: 200 }),
    { staleTime: 60000 }
  );

  const userOverviewQuery = useQuery(
    ['adminUserOverview', detailState.userId],
    () => adminAPI.getUserOverview(detailState.userId).then((res) => res.data?.data),
    {
      enabled: detailState.open && Boolean(detailState.userId),
      select: (data) => {
        if (!data) {
          return null;
        }
        const metrics = normalizeMetrics(data.metrics || {});
        const badgeSummary = normalizeBadgeSummary(data.badge_summary || {});
        const recent = Array.isArray(data.recent_badges) ? data.recent_badges.map(normalizeRecentBadge) : [];
        return {
          ...data,
          metrics,
          badge_summary: badgeSummary,
          recent_badges: recent,
        };
      },
    }
  );

  const userBadgesQuery = useQuery(
    ['adminUserBadges', detailState.userId, showRevokedBadges],
    () =>
      adminAPI
        .getUserBadges(detailState.userId, { include_revoked: showRevokedBadges })
        .then((res) => res.data?.data),
    {
      enabled: detailState.open && Boolean(detailState.userId),
      select: (data) => {
        if (!data) {
          return null;
        }
        const summary = normalizeBadgeSummary(data.summary || {});
        const metrics = normalizeMetrics(data.metrics || {});
        const badges = Array.isArray(data.badges) ? data.badges.map(normalizeUserBadgeEntry) : [];
        return {
          ...data,
          summary,
          metrics,
          badges,
        };
      },
    }
  );

  const updateUserMutation = useMutation(
    ({ id, data }) => adminAPI.updateUser(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('adminUsers');
        toast.success(t('admin.users.updateSuccess'));
      },
      onError: () => {
        toast.error(t('admin.users.updateFailed'));
      },
    }
  );

  const deleteUserMutation = useMutation(
    (id) => adminAPI.deleteUser(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('adminUsers');
        toast.success(t('admin.users.deleteSuccess'));
      },
      onError: () => {
        toast.error(t('admin.users.deleteFailed'));
      },
    }
  );

  const adjustPointsMutation = useMutation(
    ({ id, data }) => adminAPI.adjustUserPoints(id, data),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('adminUsers');
        toast.success(t('admin.users.adjustSuccess'));
      },
      onError: () => {
        toast.error(t('admin.users.adjustFailed'));
      },
    }
  );

  useEffect(() => {
    if (searchParams.get('focus') === 'search' && searchInputRef.current) {
      searchInputRef.current.focus();
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('focus');
        return next;
      }, { replace: true });
    }
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    const userIdParam = searchParams.get('userId');
    if (!userIdParam) {
      return;
    }
    const cleanup = () => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('userId');
        return next;
      }, { replace: true });
    };
    const parsed = Number(userIdParam);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      cleanup();
      return;
    }
    if (!detailState.open || detailState.userId !== parsed) {
      setDetailState({ open: true, userId: parsed });
      setShowRevokedBadges(false);
    }
    cleanup();
  }, [searchParams, detailState.open, detailState.userId, setSearchParams, setShowRevokedBadges]);

  const { users, pagination } = useMemo(() => normalizeUsersResponse(usersQuery.data), [usersQuery.data]);
  const isInitialUsersLoading = usersQuery.isLoading && !usersQuery.data;
  const isRefetchingUsers = usersQuery.isFetching && !!usersQuery.data;
  const selectedUser = useMemo(() => {
    if (!detailState.userId) {
      return null;
    }
    return users.find((item) => item.id === detailState.userId) || null;
  }, [detailState.userId, users]);

  const overviewData = userOverviewQuery.data || null;
  const badgeData = userBadgesQuery.data || null;
  const badgeRows = Array.isArray(badgeData?.badges)
    ? badgeData.badges
    : Array.isArray(badgeData?.items)
      ? badgeData.items
      : [];
  const badgeSummary = badgeData?.summary || overviewData?.badge_summary || { awarded: 0, revoked: 0, total: 0 };
  const overviewUser = useMemo(
    () => (overviewData?.user ? normalizeUser(overviewData.user) : null),
    [overviewData]
  );
  const detailUser = selectedUser ?? overviewUser;
  const checkinStats = overviewData?.checkin_stats || {};
  const metricsCards = useMemo(() => {
    if (!overviewData && !detailUser) {
      return [];
    }
    const metrics = overviewData?.metrics || {};
    return [
      { key: 'balance', label: t('admin.users.detail.pointsBalance', '积分余额'), value: detailUser?.points ?? 0, icon: Award },
      { key: 'earned', label: t('admin.users.detail.pointsEarned', '累计积分'), value: metrics.total_points_earned ?? 0, icon: Sparkles },
      { key: 'carbon', label: t('admin.users.detail.carbonSaved', '累计碳减排 (kg)'), value: metrics.total_carbon_saved ?? 0, icon: Leaf },
      { key: 'records', label: t('admin.users.detail.recordsApproved', '审核通过记录'), value: metrics.total_approved_records ?? 0, icon: ClipboardList },
      { key: 'days', label: t('admin.users.detail.daysSinceRegistration', '注册天数'), value: detailUser?.days_since_registration ?? metrics.days_since_registration ?? 0, icon: CalendarDays },
    ];
  }, [overviewData, detailUser, t]);

  const checkinCards = useMemo(() => {
    if (!overviewData && !detailUser) {
      return [];
    }
    return [
      { key: 'current', label: t('admin.users.checkins.currentStreak', '当前连击'), value: checkinStats.current_streak ?? 0, icon: Flame },
      { key: 'longest', label: t('admin.users.checkins.longestStreak', '历史最长'), value: checkinStats.longest_streak ?? 0, icon: Flame },
      { key: 'total', label: t('admin.users.checkins.totalDays', '累计打卡'), value: checkinStats.total_days ?? detailUser?.checkin_days ?? 0, icon: CalendarDays },
      { key: 'makeup', label: t('admin.users.checkins.makeupDays', '补打卡'), value: checkinStats.makeup_days ?? detailUser?.makeup_checkins ?? 0, icon: RefreshCcw },
    ];
  }, [overviewData, detailUser, checkinStats, t]);

  const selectedUsers = useMemo(() => Array.from(selectedUsersMap.values()), [selectedUsersMap]);
  const badgeOptions = useMemo(() => {
    const source = badgesQuery.data?.data?.data || badgesQuery.data?.data || [];
    return Array.isArray(source) ? source : [];
  }, [badgesQuery.data]);

  const allSelectedOnPage = users.length > 0 && users.every((user) => selectedUsersMap.has(user.id));
  const partiallySelected = users.some((user) => selectedUsersMap.has(user.id)) && !allSelectedOnPage;

  const handleFilterChange = (key, value) => {
    setFilters((prev) => ({ ...prev, [key]: value, page: key === 'page' ? value : 1 }));
  };

  const handlePageChange = (page) => {
    handleFilterChange('page', page);
  };

  const toggleUserSelection = (user, shouldSelect) => {
    setSelectedUsersMap((prev) => {
      const next = new Map(prev);
      if (shouldSelect) {
        next.set(user.id, user);
      } else {
        next.delete(user.id);
      }
      return next;
    });
  };

  const handleSelectAllOnPage = (shouldSelect) => {
    setSelectedUsersMap((prev) => {
      const next = new Map(prev);
      if (shouldSelect) {
        users.forEach((user) => next.set(user.id, user));
      } else {
        users.forEach((user) => next.delete(user.id));
      }
      return next;
    });
  };

  const handleToggleStatus = (user) => {
    const toActive = user.status !== 'active';
    openConfirmDialog({
      type: 'status',
      user,
      payload: { nextStatus: toActive ? 'active' : 'inactive' },
    });
  };

  const handleEditUser = (user) => {
    const makeAdmin = !user.is_admin;
    openConfirmDialog({
      type: 'role',
      user,
      payload: { makeAdmin },
    });
  };

  const handleDeleteUser = (user) => {
    openConfirmDialog({ type: 'delete', user, payload: null });
  };

  const openUserDetail = (user) => {
    if (!user) {
      return;
    }
    setDetailState({ open: true, userId: user.id });
    setShowRevokedBadges(false);
  };

  const closeUserDetail = () => {
    setDetailState({ open: false, userId: null });
    setShowRevokedBadges(false);
  };

  const openConfirmDialog = (config) => {
    setConfirmDialog({ open: true, ...config });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false, type: null, user: null, payload: null });
  };

  const handleConfirmAction = () => {
    if (!confirmDialog.user || !confirmDialog.type) {
      closeConfirmDialog();
      return;
    }
    if (confirmDialog.type === 'status') {
      const nextStatus = confirmDialog.payload.nextStatus;
      updateUserMutation.mutate(
        { id: confirmDialog.user.id, data: { status: nextStatus } },
        { onSettled: closeConfirmDialog }
      );
    } else if (confirmDialog.type === 'role') {
      const makeAdmin = confirmDialog.payload.makeAdmin;
      updateUserMutation.mutate(
        { id: confirmDialog.user.id, data: { is_admin: makeAdmin } },
        { onSettled: closeConfirmDialog }
      );
    } else if (confirmDialog.type === 'delete') {
      deleteUserMutation.mutate(confirmDialog.user.id, { onSettled: closeConfirmDialog });
    } else {
      closeConfirmDialog();
    }
  };

  const openAdjustPoints = (user) => {
    setPointsDialog({ open: true, user, delta: '', reason: '' });
  };

  const closeAdjustPoints = () => {
    setPointsDialog({ open: false, user: null, delta: '', reason: '' });
  };

  const handleSubmitAdjustPoints = () => {
    if (!pointsDialog.user) return;
    const deltaValue = Number(pointsDialog.delta);
    if (!Number.isFinite(deltaValue) || deltaValue === 0) {
      toast.error(t('admin.users.invalidDelta'));
      return;
    }
    adjustPointsMutation.mutate(
      { id: pointsDialog.user.id, data: { delta: deltaValue, reason: pointsDialog.reason } },
      { onSettled: closeAdjustPoints }
    );
  };

  const openDetailedEdit = (user) => {
    setEditDialog({
      open: true,
      user,
      groupId: user.group_id || '',
      notes: user.admin_notes || '',
      quotaFlat: user.quota_flat || {}
    });
  };

  const closeDetailedEdit = () => {
    setEditDialog({ open: false, user: null, notes: '', groupId: '', quotaFlat: {} });
  };

  const handleQuotaChange = (key, value) => {
    setEditDialog(prev => ({
      ...prev,
      quotaFlat: {
        ...prev.quotaFlat,
        [key]: value
      }
    }));
  };

  const handleSubmitDetailedEdit = (e) => {
    e.preventDefault();
    if (!editDialog.user) return;

    const payload = {
      group_id: editDialog.groupId || '',
      admin_notes: editDialog.notes,
      quota_flat: editDialog.quotaFlat
    };

    updateUserMutation.mutate(
      { id: editDialog.user.id, data: payload },
      {
        onSuccess: () => {
          closeDetailedEdit();
          toast.success(t('admin.users.updateSuccess'));
        }
      }
    );
  };

  const openBulkBadgeDialog = (usersList) => {
    if (!usersList || usersList.length === 0) {
      toast.error(t('admin.users.selectUserHint', '请先选择用户'));
      return;
    }
    setBulkDialog({ open: true, presetUsers: usersList });
  };

  const clearSelection = () => {
    setSelectedUsersMap(new Map());
  };

  const renderStatusBadge = (user) => {
    if (!user || !user.status) {
      return (
        <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-600">
          {t('common.unknown', '未知')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
        {user.status === 'active' ? (
          <span className="bg-green-100 text-green-800 flex items-center gap-1 px-2 py-0.5 rounded-full">
            <CheckCircle className="h-3 w-3" />
            {t('admin.users.statusActive')}
          </span>
        ) : (
          <span className="bg-red-100 text-red-800 flex items-center gap-1 px-2 py-0.5 rounded-full">
            <XCircle className="h-3 w-3" />
            {t('admin.users.statusInactive')}
          </span>
        )}
      </span>
    );
  };

  const renderRoleBadge = (user) => {
    if (!user) {
      return (
        <Badge variant="outline">
          {t('common.unknown', '未知')}
        </Badge>
      );
    }
    return (
      <Badge variant={user.is_admin ? 'default' : 'outline'}>
        {user.is_admin ? t('admin.users.roleAdmin') : t('admin.users.roleUser')}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('admin.users.title')}</h2>
        <p className="text-muted-foreground">{t('admin.users.description')}</p>
      </div>

      <div className="bg-white rounded-lg shadow-sm border p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('common.search')}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
              <Input
                ref={searchInputRef}
                type="text"
                value={filters.search}
                onChange={(e) => handleFilterChange('search', e.target.value)}
                placeholder={t('admin.users.searchPlaceholder')}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.users.role')}</label>
            <select
              value={filters.role}
              onChange={(e) => handleFilterChange('role', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">{t('common.all')}</option>
              <option value="user">{t('admin.users.roleUser')}</option>
              <option value="admin">{t('admin.users.roleAdmin')}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">{t('admin.users.status')}</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-transparent"
            >
              <option value="">{t('common.all')}</option>
              <option value="active">{t('admin.users.statusActive')}</option>
              <option value="inactive">{t('admin.users.statusInactive')}</option>
            </select>
          </div>
        </div>

        {isRefetchingUsers && (
          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {t('admin.users.refreshing')}
          </div>
        )}

        {selectedUsers.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed bg-muted/60 p-3">
            <div className="flex items-center gap-2">
              <UsersIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {t('admin.users.selectedCount', '已选择 {{count}} 位用户', { count: selectedUsers.length })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => openBulkBadgeDialog(selectedUsers)}
                disabled={badgesQuery.isLoading || badgeOptions.length === 0}
              >
                <Sparkles className="h-4 w-4 mr-2" />
                {t('admin.users.bulkAwardBadges', '批量授予徽章')}
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                {t('common.clear', '清空')}
              </Button>
            </div>
          </div>
        )}
      </div>

      {(() => {
        if (isInitialUsersLoading) {
          return (
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin text-green-500" />
            </div>
          );
        }
        if (usersQuery.error) {
          return (
            <Alert variant="destructive">
              <AlertTitle>{t('common.error')}</AlertTitle>
              <AlertDescription>{t('errors.loadFailed')}</AlertDescription>
            </Alert>
          );
        }
        if (users.length === 0) {
          return (
            <div className="text-center py-16 bg-white rounded-lg shadow-sm border">
              <h3 className="text-xl font-semibold">{t('admin.users.noUsersFound')}</h3>
              <p className="text-muted-foreground mt-2">{t('admin.users.tryDifferentFilters')}</p>
            </div>
          );
        }
        return (
          <>
            <div className="overflow-x-auto bg-white rounded-lg shadow-sm border">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <Checkbox
                        checked={allSelectedOnPage ? true : partiallySelected ? 'indeterminate' : false}
                        onCheckedChange={(checked) => handleSelectAllOnPage(checked === true || checked === 'indeterminate')}
                        aria-label={t('admin.users.selectAll', '选择当前页所有用户')}
                        className="translate-y-0.5"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.username')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.email')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.groups.title', '用户组')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.role')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.status')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.badges', '徽章')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.checkins', '打卡')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.carbon', '碳减排')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.points')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">{t('admin.users.table.actions')}</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {users.map((user) => {
                    const isSelected = selectedUsersMap.has(user.id);
                    return (
                      <tr key={user.id} className={isSelected ? 'bg-emerald-50/40' : ''}>
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => toggleUserSelection(user, checked === true || checked === 'indeterminate')}
                            aria-label={t('admin.users.selectUser', '选择用户 {{username}}', { username: user.username })}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{user.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.group_name || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{renderRoleBadge(user)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{renderStatusBadge(user)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex flex-col">
                            <span>{t('admin.users.badgesAwardedCount', '{{count}} 枚', { count: user.badges_awarded || 0 })}</span>
                            <span className="text-xs text-muted-foreground">
                              {t('admin.users.activeBadgesCount', '激活 {{count}}', { count: user.active_badges || 0 })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          <div className="flex flex-col">
                            <span>{t('admin.users.checkins.totalDaysLabel', '累计 {{count}} 天', { count: user.checkin_days || 0 })}</span>
                            <span className="text-xs text-muted-foreground">
                              {t('admin.users.checkins.makeupDaysLabel', '补打卡 {{count}}', { count: user.makeup_checkins || 0 })}
                            </span>
                            {user.last_checkin_date && (
                              <span className="text-xs text-muted-foreground">
                                {t('admin.users.checkins.lastDate', '最近 {{date}}', { date: user.last_checkin_date })}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {Number(user.total_carbon_saved || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{user.points}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(user)} title={t('admin.users.toggleStatusButton', '切换用户状态')}>
                            <Ban className="h-4 w-4 mr-1" />
                            {user.status === 'active' ? t('admin.users.disable') : t('admin.users.enable')}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openAdjustPoints(user)} title={t('admin.users.promptAdjustPoints', { username: user.username })}>
                            <PlusCircle className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openUserDetail(user)} title={t('admin.users.viewDetailsButton', '查看详情')}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openDetailedEdit(user)} title={t('admin.users.editUser', '编辑配置')}>
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)} title={t('admin.users.toggleAdminButton', '切换管理员权限')}>
                            <Shield className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openBulkBadgeDialog([user])} title={t('admin.users.awardBadgeButton', '授予徽章')} disabled={badgeOptions.length === 0}>
                            <Sparkles className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user)} className="text-red-600 hover:text-red-800" title={t('admin.users.deleteButton', '删除用户')}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </td>
                      </tr>
                    );
                  })}
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
        );
      })()}

      <AlertDialog open={confirmDialog.open} onOpenChange={(open) => (!open ? closeConfirmDialog() : null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmDialog.type === 'status' && t('admin.users.confirmToggleStatusTitle', '确认修改状态')}
              {confirmDialog.type === 'role' && t('admin.users.confirmToggleAdminTitle', '确认切换角色')}
              {confirmDialog.type === 'delete' && t('admin.users.confirmDeleteTitle', '确认删除用户')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmDialog.type === 'status' && confirmDialog.user && (
                t('admin.users.confirmToggleStatus', {
                  username: confirmDialog.user.username,
                  to: confirmDialog.payload.nextStatus === 'active'
                    ? t('admin.users.statusActive')
                    : t('admin.users.statusInactive'),
                })
              )}
              {confirmDialog.type === 'role' && confirmDialog.user && (
                t('admin.users.confirmToggleAdmin', { username: confirmDialog.user.username })
              )}
              {confirmDialog.type === 'delete' && confirmDialog.user && (
                t('admin.users.confirmDelete', { username: confirmDialog.user.username })
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeConfirmDialog}>{t('common.cancel', '取消')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction}>{t('common.confirm', '确认')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={pointsDialog.open} onOpenChange={(open) => (!open ? closeAdjustPoints() : null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.users.adjustPointsTitle', '调整积分')}</DialogTitle>
            <DialogDescription>
              {pointsDialog.user ? t('admin.users.adjustPointsDescription', { username: pointsDialog.user.username }) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="points-delta">{t('admin.users.adjustPointsDelta', '积分变动值')}</Label>
              <Input
                id="points-delta"
                type="number"
                value={pointsDialog.delta}
                onChange={(e) => setPointsDialog((prev) => ({ ...prev, delta: e.target.value }))}
                placeholder="100"
              />
              <p className="text-xs text-muted-foreground">
                {t('admin.users.adjustPointsHint', '输入正数表示增加积分，负数表示扣减积分')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="points-reason">{t('admin.users.adjustPointsReason', '调整说明')}</Label>
              <Textarea
                id="points-reason"
                rows={3}
                value={pointsDialog.reason}
                onChange={(e) => setPointsDialog((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder={t('admin.users.adjustPointsReasonPlaceholder', '请输入调整原因，便于审计记录')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeAdjustPoints}>{t('common.cancel', '取消')}</Button>
            <Button onClick={handleSubmitAdjustPoints} disabled={adjustPointsMutation.isLoading}>
              {adjustPointsMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.confirm', '确认')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialog.open} onOpenChange={(open) => (!open ? closeDetailedEdit() : null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('admin.users.editUser', '编辑用户配置')}</DialogTitle>
            <DialogDescription>{editDialog.user?.username}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitDetailedEdit} className="space-y-4">
            <div>
              <Label>{t('admin.groups.title', '用户组')}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={editDialog.groupId}
                onChange={(e) => setEditDialog({ ...editDialog, groupId: e.target.value })}
              >
                <option value="">{t('common.none', '无')}</option>
                {groups?.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Dynamic Quota Usage Inputs - Render inputs for each flattened quota key */}
            <div className="space-y-3 border-t pt-3 border-b pb-3">
              <Label className="text-base font-semibold">{t('admin.groups.quotaOverride', '配额单独设置')}</Label>
              {Object.keys(editDialog.quotaFlat || {}).length > 0 ? (
                Object.entries(editDialog.quotaFlat).map(([key, value]) => (
                  <div key={key}>
                    <Label className="capitalize">{t(`admin.quotas.${key}`, key.replace('.', ' '))}</Label>
                    <Input
                      type="number"
                      value={value ?? ''}
                      onChange={e => handleQuotaChange(key, e.target.value)}
                      placeholder={t('common.default', '默认')}
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{t('admin.groups.noQuotasAvailable', '暂无可配置的配额项目')}</p>
              )}
            </div>
            <div>
              <Label>{t('admin.groups.notes', '备注')}</Label>
              <Textarea
                value={editDialog.notes}
                onChange={e => setEditDialog({ ...editDialog, notes: e.target.value })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={closeDetailedEdit}>{t('common.cancel')}</Button>
              <Button type="submit" disabled={updateUserMutation.isLoading}>{t('common.save')}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={detailState.open} onOpenChange={(open) => (!open ? closeUserDetail() : null)}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>
              {detailUser
                ? t('admin.users.detailTitle', '用户详情：{{username}}', { username: detailUser.username })
                : t('admin.users.detailTitleFallback', '用户详情')}
            </DialogTitle>
            <DialogDescription>{detailUser?.email || ''}</DialogDescription>
          </DialogHeader>
          {userOverviewQuery.isLoading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              {t('common.loading', '加载中...')}
            </div>
          ) : userOverviewQuery.error ? (
            <p className="text-sm text-destructive">{t('admin.users.detailLoadFailed', '无法加载用户详情')}</p>
          ) : overviewData ? (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="rounded-lg border bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('admin.users.detail.username', '用户名')}</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{detailUser?.username}</p>
                </div>
                <div className="rounded-lg border bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('admin.users.detail.role', '角色')}</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{renderRoleBadge(detailUser)}</p>
                </div>
                <div className="rounded-lg border bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('admin.users.detail.status', '状态')}</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{renderStatusBadge(detailUser)}</p>
                </div>
                <div className="rounded-lg border bg-white p-4 shadow-sm">
                  <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('admin.users.detail.registrationDays', '注册天数')}</p>
                  <p className="mt-1 text-sm font-medium text-gray-900">{detailUser?.days_since_registration ?? 0}</p>
                </div>
                {detailUser?.lastlgn && (
                  <div className="rounded-lg border bg-white p-4 shadow-sm sm:col-span-2">
                    <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{t('admin.users.detail.lastLogin', '最近登录')}</p>
                    <p className="mt-1 text-sm font-medium text-gray-900">
                      {format(new Date(detailUser.lastlgn), 'yyyy-MM-dd HH:mm')}
                    </p>
                  </div>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {metricsCards.map((card) => {
                  const Icon = card.icon;
                  return (
                    <div key={card.key} className="rounded-lg border bg-white p-4 shadow-sm">
                      <div className="flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{card.label}</p>
                        <Icon className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <p className="mt-2 text-xl font-semibold">
                        {Number(card.value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                      </p>
                    </div>
                  );
                })}
              </div>

              {checkinCards.length > 0 && (
                <div className="space-y-3">
                  <div>
                    <h4 className="text-base font-semibold">{t('admin.users.checkins.title', '打卡概况')}</h4>
                    <p className="text-sm text-muted-foreground">{t('admin.users.checkins.subtitle', '查看用户连击与补打卡情况')}</p>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                    {checkinCards.map((card) => {
                      const Icon = card.icon;
                      return (
                        <div key={card.key} className="rounded-lg border bg-white p-4 shadow-sm">
                          <div className="flex items-center justify-between">
                            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{card.label}</p>
                            <Icon className="h-4 w-4 text-muted-foreground" />
                          </div>
                          <p className="mt-2 text-xl font-semibold">
                            {Number(card.value || 0).toLocaleString(undefined, { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {checkinStats.active_today
                      ? t('admin.users.checkins.activeToday', '今日已打卡')
                      : t('admin.users.checkins.inactiveToday', '今日未打卡')}
                    {checkinStats.last_checkin_date || detailUser?.last_checkin_date ? (
                      <> · {t('admin.users.checkins.lastDateLong', '最近打卡 {{date}}', { date: checkinStats.last_checkin_date || detailUser?.last_checkin_date })}</>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="space-y-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h4 className="text-base font-semibold">{t('admin.users.badgeSummary', '徽章概况')}</h4>
                    <p className="text-sm text-muted-foreground">{t('admin.users.badgeSummaryHint', '展示授予和回收的徽章统计')}</p>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Switch checked={showRevokedBadges} onCheckedChange={(checked) => setShowRevokedBadges(Boolean(checked))} />
                    <span>{t('admin.users.showRevokedBadges', '显示已收回的徽章')}</span>
                  </div>
                </div>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="rounded-lg border bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('admin.users.badgesAwarded', '授予')}</p>
                    <p className="mt-2 text-2xl font-semibold">{badgeSummary.awarded}</p>
                  </div>
                  <div className="rounded-lg border bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('admin.users.badgesRevoked', '收回')}</p>
                    <p className="mt-2 text-2xl font-semibold">{badgeSummary.revoked}</p>
                  </div>
                  <div className="rounded-lg border bg-white p-4 shadow-sm">
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{t('admin.users.badgesTotal', '总数')}</p>
                    <p className="mt-2 text-2xl font-semibold">{badgeSummary.total}</p>
                  </div>
                </div>

                {userBadgesQuery.isLoading ? (
                  <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {t('common.loading', '加载中...')}
                  </div>
                ) : userBadgesQuery.error ? (
                  <p className="text-sm text-destructive">{t('admin.users.badgesLoadFailed', '无法加载徽章列表')}</p>
                ) : badgeRows.length > 0 ? (
                  <div className="overflow-x-auto">
                    <table className="min-w-full divide-y divide-gray-200 text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-4 py-2 text-left font-medium text-gray-500">{t('admin.users.badgeTable.badge', '徽章')}</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-500">{t('admin.users.badgeTable.status', '状态')}</th>
                          <th className="px-4 py-2 text-left font-medium text-gray-500">{t('admin.users.badgeTable.awardedAt', '授予时间')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 bg-white">
                        {badgeRows.map((entry, index) => {
                          const badge = entry.badge || {};
                          const record = entry.user_badge || {};
                          return (
                            <tr key={index} className="hover:bg-gray-50">
                              <td className="px-4 py-2">
                                <div className="flex items-center gap-3">
                                  <div className="h-10 w-10 overflow-hidden rounded-full border bg-muted">
                                    {badge.icon_url || badge.icon_presigned_url || badge.icon_path ? (
                                      <R2Image
                                        src={badge.icon_url || badge.icon_presigned_url}
                                        filePath={!badge.icon_url && !badge.icon_presigned_url ? badge.icon_path : undefined}
                                        alt={badge.name_zh || badge.name_en}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <Award className="h-5 w-5 text-muted-foreground" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium text-gray-900">{badge.name_zh || badge.name_en || '-'}</p>
                                    {badge.name_en && <p className="text-xs text-muted-foreground">{badge.name_en}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-2">
                                <Badge variant={record.status === 'awarded' ? 'success' : 'secondary'}>{record.status === 'awarded' ? t('admin.users.badgeStatusAwarded', '已授予') : t('admin.users.badgeStatusRevoked', '已收回')}</Badge>
                              </td>
                              <td className="px-4 py-2 text-sm text-muted-foreground">
                                {record.awarded_at ? format(new Date(record.awarded_at), 'yyyy-MM-dd HH:mm') : '--'}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">{t('admin.users.badgesEmpty', '暂无徽章记录')}</p>
                )}
              </div>
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t('admin.users.detailEmpty', '暂无详情数据')}</p>
          )}
        </DialogContent>
      </Dialog>

      <BadgeBulkAwardDialog
        open={bulkDialog.open}
        onOpenChange={(open) => (!open ? setBulkDialog({ open: false, presetUsers: [] }) : null)}
        badges={badgeOptions}
        defaultSelectedBadgeIds={[]}
        presetUsers={bulkDialog.presetUsers}
        onCompleted={() => {
          setBulkDialog({ open: false, presetUsers: [] });
          queryClient.invalidateQueries('adminUsers');
        }}
        mode="award"
      />
    </div>
  );
}
