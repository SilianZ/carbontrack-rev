import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { adminAPI } from '../../lib/api';
import { formatDateSafe } from '../../lib/utils';
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
  Fingerprint,
  Leaf,
  ClipboardList,
  CalendarDays,
  Award,
  Settings,
  Flame,
  RefreshCcw,
  ChevronDown,
  ChevronUp,
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
import SecurityActivityList from '../security/SecurityActivityList';
import R2Image from '@/components/common/R2Image';
import { resolveR2ImageSource } from '@/lib/r2Image';
import { toast } from 'react-hot-toast';

const DEFAULT_FILTERS = {
  search: '',
  role: '',
  status: '',
  page: 1,
  limit: 10,
  sort: 'created_at_desc',
};

const USER_ROLE_OPTIONS = ['user', 'support', 'admin'];

const normalizeRole = (user = {}) => {
  if (user.is_admin === true || user.is_admin === 1 || user.is_admin === '1') {
    return 'admin';
  }
  const role = typeof user.role === 'string' ? user.role.trim().toLowerCase() : '';
  if (USER_ROLE_OPTIONS.includes(role)) {
    return role;
  }
  return 'user';
};

const normalizeUser = (user = {}) => {
  const toNumber = (value) => {
    const num = Number(value);
    return Number.isFinite(num) ? num : 0;
  };
  return {
    ...user,
    is_admin: user.is_admin === true || user.is_admin === 1 || user.is_admin === '1',
    role: normalizeRole(user),
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

const getUserIdentifier = (user) => user?.uuid || user?.id || null;

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
  const { t, currentLanguage } = useTranslation();
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchInputRef = useRef(null);
  const [confirmDialog, setConfirmDialog] = useState({ open: false, type: null, user: null, payload: null });
  const [pointsDialog, setPointsDialog] = useState({ open: false, user: null, delta: '', reason: '' });
  const [selectedUsersMap, setSelectedUsersMap] = useState(new Map());
  const [bulkDialog, setBulkDialog] = useState({ open: false, presetUsers: [] });
  const [detailState, setDetailState] = useState({ open: false, userId: null, userUuid: null });
  const [showRevokedBadges, setShowRevokedBadges] = useState(false);
  const [securityActivityExpanded, setSecurityActivityExpanded] = useState(false);
  const [securityActivityPage, setSecurityActivityPage] = useState(1);
  const [securityActivityFilters, setSecurityActivityFilters] = useState({
    type: 'all',
    period: 'all',
  });
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
    if (filters.role) {
      base.role = filters.role;
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

  const detailIdentifier = detailState.userUuid || detailState.userId;
  const securityActivityLimit = securityActivityExpanded ? 10 : 3;

  const userOverviewQuery = useQuery(
    ['adminUserOverview', detailIdentifier],
    () => adminAPI.getUserOverview(detailIdentifier).then((res) => res.data?.data),
    {
      enabled: detailState.open && Boolean(detailIdentifier),
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
    ['adminUserBadges', detailIdentifier, showRevokedBadges],
    () =>
      adminAPI
        .getUserBadges(detailIdentifier, { include_revoked: showRevokedBadges })
        .then((res) => res.data?.data),
    {
      enabled: detailState.open && Boolean(detailIdentifier),
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

  const userSecurityActivityQuery = useQuery(
    ['adminUserSecurityActivity', detailIdentifier, securityActivityPage, securityActivityLimit, securityActivityFilters.type, securityActivityFilters.period],
    () =>
      adminAPI
        .getUserSecurityActivity(detailIdentifier, {
          page: securityActivityPage,
          limit: securityActivityLimit,
          ...securityActivityFilters,
        })
        .then((res) => res.data?.data),
    {
      enabled: detailState.open && Boolean(detailIdentifier),
      keepPreviousData: true,
    }
  );

  const updateUserMutation = useMutation(
    ({ identifier, data }) => adminAPI.updateUser(identifier, data),
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
    (identifier) => adminAPI.deleteUser(identifier),
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
    ({ identifier, data }) => adminAPI.adjustUserPoints(identifier, data),
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
    const userUuidParam = searchParams.get('userUuid');
    const userIdParam = searchParams.get('userId');
    if (!userUuidParam && !userIdParam) {
      return;
    }
    const cleanup = () => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('userUuid');
        next.delete('userId');
        return next;
      }, { replace: true });
    };
    if (userUuidParam) {
      const normalized = userUuidParam.trim().toLowerCase();
      if (!normalized) {
        cleanup();
        return;
      }
      if (!detailState.open || detailState.userUuid !== normalized) {
        setDetailState({ open: true, userId: null, userUuid: normalized });
        setShowRevokedBadges(false);
      }
      cleanup();
      return;
    }

    const parsed = Number(userIdParam);
    if (!Number.isInteger(parsed) || parsed <= 0) {
      cleanup();
      return;
    }
    if (!detailState.open || detailState.userId !== parsed) {
      setDetailState({ open: true, userId: parsed, userUuid: null });
      setShowRevokedBadges(false);
    }
    cleanup();
  }, [searchParams, detailState.open, detailState.userId, detailState.userUuid, setSearchParams, setShowRevokedBadges]);

  const { users, pagination } = useMemo(() => normalizeUsersResponse(usersQuery.data), [usersQuery.data]);
  const isInitialUsersLoading = usersQuery.isLoading && !usersQuery.data;
  const isRefetchingUsers = usersQuery.isFetching && !!usersQuery.data;
  const selectedUser = useMemo(() => {
    if (!detailIdentifier) {
      return null;
    }
    return users.find((item) => item.uuid === detailState.userUuid || item.id === detailState.userId) || null;
  }, [detailIdentifier, detailState.userId, detailState.userUuid, users]);

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
  const checkinStats = useMemo(
    () => (overviewData?.checkin_stats || {}),
    [overviewData]
  );
  const passkeySummary = useMemo(
    () => ({
      total: Number(overviewData?.passkey_summary?.total ?? 0),
      backup_enabled: Number(overviewData?.passkey_summary?.backup_enabled ?? 0),
      backup_eligible: Number(overviewData?.passkey_summary?.backup_eligible ?? 0),
      last_used_at: overviewData?.passkey_summary?.last_used_at ?? null,
      last_registered_at: overviewData?.passkey_summary?.last_registered_at ?? null,
    }),
    [overviewData]
  );
  const recentSecurityActivity = useMemo(
    () => (Array.isArray(userSecurityActivityQuery.data?.items) ? userSecurityActivityQuery.data.items : []),
    [userSecurityActivityQuery.data]
  );
  const securityActivityPagination = userSecurityActivityQuery.data?.pagination || {};

  const securityActivityTypeOptions = useMemo(
    () => [
      { value: 'all', label: t('securityActivity.filters.types.all') },
      { value: 'sign_ins', label: t('securityActivity.filters.types.signIns') },
      { value: 'passkey_changes', label: t('securityActivity.filters.types.passkeyChanges') },
      { value: 'password_changes', label: t('securityActivity.filters.types.passwordChanges') },
      { value: 'logouts', label: t('securityActivity.filters.types.logouts') },
    ],
    [t]
  );
  const securityActivityPeriodOptions = useMemo(
    () => [
      { value: 'all', label: t('securityActivity.filters.periods.all') },
      { value: '7d', label: t('securityActivity.filters.periods.last7Days') },
      { value: '30d', label: t('securityActivity.filters.periods.last30Days') },
      { value: '90d', label: t('securityActivity.filters.periods.last90Days') },
    ],
    [t]
  );
  const metricsCards = useMemo(() => {
    if (!overviewData && !detailUser) {
      return [];
    }
    const metrics = overviewData?.metrics || {};
    return [
      { key: 'balance', label: t('admin.users.detail.pointsBalance'), value: detailUser?.points ?? 0, icon: Award },
      { key: 'earned', label: t('admin.users.detail.pointsEarned'), value: metrics.total_points_earned ?? 0, icon: Sparkles },
      { key: 'carbon', label: t('admin.users.detail.carbonSaved'), value: metrics.total_carbon_saved ?? 0, icon: Leaf },
      { key: 'records', label: t('admin.users.detail.recordsApproved'), value: metrics.total_approved_records ?? 0, icon: ClipboardList },
      { key: 'days', label: t('admin.users.detail.daysSinceRegistration'), value: detailUser?.days_since_registration ?? metrics.days_since_registration ?? 0, icon: CalendarDays },
    ];
  }, [overviewData, detailUser, t]);

  const checkinCards = useMemo(() => {
    if (!overviewData && !detailUser) {
      return [];
    }
    return [
      { key: 'current', label: t('admin.users.checkins.currentStreak'), value: checkinStats.current_streak ?? 0, icon: Flame },
      { key: 'longest', label: t('admin.users.checkins.longestStreak'), value: checkinStats.longest_streak ?? 0, icon: Flame },
      { key: 'total', label: t('admin.users.checkins.totalDays'), value: checkinStats.total_days ?? detailUser?.checkin_days ?? 0, icon: CalendarDays },
      { key: 'makeup', label: t('admin.users.checkins.makeupDays'), value: checkinStats.makeup_days ?? detailUser?.makeup_checkins ?? 0, icon: RefreshCcw },
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
    openConfirmDialog({
      type: 'role',
      user,
      payload: { nextRole: normalizeRole(user) },
    });
  };

  const handleDeleteUser = (user) => {
    openConfirmDialog({ type: 'delete', user, payload: null });
  };

  const openUserDetail = (user) => {
    if (!user) {
      return;
    }
    setDetailState({ open: true, userId: user.id ?? null, userUuid: user.uuid ?? null });
    setShowRevokedBadges(false);
    setSecurityActivityExpanded(false);
    setSecurityActivityPage(1);
    setSecurityActivityFilters({ type: 'all', period: 'all' });
  };

  const closeUserDetail = () => {
    setDetailState({ open: false, userId: null, userUuid: null });
    setShowRevokedBadges(false);
    setSecurityActivityExpanded(false);
    setSecurityActivityPage(1);
    setSecurityActivityFilters({ type: 'all', period: 'all' });
  };

  const openConfirmDialog = (config) => {
    setConfirmDialog({ open: true, ...config });
  };

  const closeConfirmDialog = () => {
    setConfirmDialog({ open: false, type: null, user: null, payload: null });
  };

  const handleSecurityActivityFilterChange = (key, value) => {
    setSecurityActivityPage(1);
    setSecurityActivityFilters((prev) => ({
      ...prev,
      [key]: value,
    }));
  };

  const handleConfirmAction = () => {
    if (!confirmDialog.user || !confirmDialog.type) {
      closeConfirmDialog();
      return;
    }
    if (confirmDialog.type === 'status') {
      const nextStatus = confirmDialog.payload.nextStatus;
      const identifier = getUserIdentifier(confirmDialog.user);
      updateUserMutation.mutate(
        { identifier, data: { status: nextStatus } },
        { onSettled: closeConfirmDialog }
      );
    } else if (confirmDialog.type === 'role') {
      const nextRole = confirmDialog.payload?.nextRole || normalizeRole(confirmDialog.user);
      const identifier = getUserIdentifier(confirmDialog.user);
      updateUserMutation.mutate(
        { identifier, data: { role: nextRole } },
        { onSettled: closeConfirmDialog }
      );
    } else if (confirmDialog.type === 'delete') {
      deleteUserMutation.mutate(getUserIdentifier(confirmDialog.user), { onSettled: closeConfirmDialog });
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
    const identifier = getUserIdentifier(pointsDialog.user);
    adjustPointsMutation.mutate(
      { identifier, data: { delta: deltaValue, reason: pointsDialog.reason } },
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
      { identifier: getUserIdentifier(editDialog.user), data: payload },
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
      toast.error(t('admin.users.selectUserHint'));
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
        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {t('common.unknown')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
        {user.status === 'active' ? (
          <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
            <CheckCircle className="h-3 w-3" />
            {t('admin.users.statusActive')}
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
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
          {t('common.unknown')}
        </Badge>
      );
    }
    const role = normalizeRole(user);
    const variant = role === 'admin' ? 'default' : role === 'support' ? 'secondary' : 'outline';
    return (
      <Badge variant={variant}>
        {role === 'admin'
          ? t('admin.users.roleAdmin')
          : role === 'support'
            ? t('admin.users.roleSupport')
            : t('admin.users.roleUser')}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{t('admin.users.title')}</h2>
        <p className="text-muted-foreground">{t('admin.users.description')}</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">{t('common.search')}</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
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
            <label className="mb-2 block text-sm font-medium text-foreground">{t('admin.users.role')}</label>
            <select
              value={filters.role}
              onChange={(e) => handleFilterChange('role', e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">{t('common.all')}</option>
              <option value="user">{t('admin.users.roleUser')}</option>
              <option value="support">{t('admin.users.roleSupport')}</option>
              <option value="admin">{t('admin.users.roleAdmin')}</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">{t('admin.users.status')}</label>
            <select
              value={filters.status}
              onChange={(e) => handleFilterChange('status', e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
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
                {t('admin.users.selectedCount',  { count: selectedUsers.length })}
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
                {t('admin.users.bulkAwardBadges')}
              </Button>
              <Button variant="ghost" size="sm" onClick={clearSelection}>
                {t('common.clear')}
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
            <div className="rounded-lg border border-border bg-card py-16 text-center shadow-sm">
              <h3 className="text-xl font-semibold">{t('admin.users.noUsersFound')}</h3>
              <p className="text-muted-foreground mt-2">{t('admin.users.tryDifferentFilters')}</p>
            </div>
          );
        }
        return (
          <>
            <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/40">
                  <tr>
                    <th className="px-4 py-3 text-left">
                      <Checkbox
                        checked={allSelectedOnPage ? true : partiallySelected ? 'indeterminate' : false}
                        onCheckedChange={(checked) => handleSelectAllOnPage(checked === true || checked === 'indeterminate')}
                        aria-label={t('admin.users.selectAll')}
                        className="translate-y-0.5"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.users.table.username')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.users.table.email')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.groups.title')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.users.table.role')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.users.table.status')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.users.table.badges')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.users.table.passkeys')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.users.table.checkins')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.users.table.carbon')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.users.table.points')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.users.table.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {users.map((user) => {
                    const isSelected = selectedUsersMap.has(user.id);
                    return (
                      <tr key={user.id} className={isSelected ? 'bg-emerald-50/40 dark:bg-emerald-950/30' : 'hover:bg-muted/40'}>
                        <td className="px-4 py-3">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={(checked) => toggleUserSelection(user, checked === true || checked === 'indeterminate')}
                            aria-label={t('admin.users.selectUser',  { username: user.username })}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{user.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{user.group_name || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{renderRoleBadge(user)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{renderStatusBadge(user)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          <div className="flex flex-col">
                            <span>{t('admin.users.badgesAwardedCount',  { count: user.badges_awarded || 0 })}</span>
                            <span className="text-xs text-muted-foreground">
                              {t('admin.users.activeBadgesCount',  { count: user.active_badges || 0 })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          <div className="flex flex-col">
                            <span>{t('admin.users.passkeyCount', { count: user.passkey_count || 0 })}</span>
                            <span className="text-xs text-muted-foreground">
                              {(user.passkey_count || 0) > 0
                                ? t('admin.users.passkeyLastUsed', {
                                    date: formatDateSafe(
                                      user.last_passkey_used_at,
                                      'yyyy-MM-dd HH:mm',
                                      t('admin.users.passkeyNeverUsed')
                                    ),
                                  })
                                : t('admin.users.passkeyNeverUsed')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          <div className="flex flex-col">
                            <span>{t('admin.users.checkins.totalDaysLabel',  { count: user.checkin_days || 0 })}</span>
                            <span className="text-xs text-muted-foreground">
                              {t('admin.users.checkins.makeupDaysLabel',  { count: user.makeup_checkins || 0 })}
                            </span>
                            {user.last_checkin_date && (
                              <span className="text-xs text-muted-foreground">
                                {t('admin.users.checkins.lastDate',  { date: user.last_checkin_date })}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {Number(user.total_carbon_saved || 0).toLocaleString(currentLanguage, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{user.points}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => handleToggleStatus(user)} title={t('admin.users.toggleStatusButton')}>
                            <Ban className="h-4 w-4 mr-1" />
                            {user.status === 'active' ? t('admin.users.disable') : t('admin.users.enable')}
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openAdjustPoints(user)} title={t('admin.users.promptAdjustPoints', { username: user.username })}>
                            <PlusCircle className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openUserDetail(user)} title={t('admin.users.viewDetailsButton')}>
                            <Eye className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openDetailedEdit(user)} title={t('admin.users.editUser')}>
                            <Settings className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleEditUser(user)} title={t('admin.users.changeRoleButton')}>
                            <Shield className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => openBulkBadgeDialog([user])} title={t('admin.users.awardBadgeButton')} disabled={badgeOptions.length === 0}>
                            <Sparkles className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDeleteUser(user)} className="text-red-600 hover:text-red-800" title={t('admin.users.deleteButton')}>
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
              {confirmDialog.type === 'status' && t('admin.users.confirmToggleStatusTitle')}
              {confirmDialog.type === 'role' && t('admin.users.confirmToggleAdminTitle')}
              {confirmDialog.type === 'delete' && t('admin.users.confirmDeleteTitle')}
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
                <div className="space-y-3">
                  <p>{t('admin.users.confirmSetRole', { username: confirmDialog.user.username })}</p>
                  <div className="space-y-2">
                    <Label htmlFor="confirm-role">{t('admin.users.roleDialogLabel')}</Label>
                    <select
                      id="confirm-role"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      value={confirmDialog.payload?.nextRole || normalizeRole(confirmDialog.user)}
                      onChange={(event) => setConfirmDialog((current) => ({
                        ...current,
                        payload: {
                          ...current.payload,
                          nextRole: event.target.value,
                        },
                      }))}
                    >
                      <option value="user">{t('admin.users.roleUser')}</option>
                      <option value="support">{t('admin.users.roleSupport')}</option>
                      <option value="admin">{t('admin.users.roleAdmin')}</option>
                    </select>
                  </div>
                </div>
              )}
              {confirmDialog.type === 'delete' && confirmDialog.user && (
                t('admin.users.confirmDelete', { username: confirmDialog.user.username })
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={closeConfirmDialog}>{t('common.cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmAction}>{t('common.confirm')}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={pointsDialog.open} onOpenChange={(open) => (!open ? closeAdjustPoints() : null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{t('admin.users.adjustPointsTitle')}</DialogTitle>
            <DialogDescription>
              {pointsDialog.user ? t('admin.users.adjustPointsDescription', { username: pointsDialog.user.username }) : ''}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Label htmlFor="points-delta">{t('admin.users.adjustPointsDelta')}</Label>
              <Input
                id="points-delta"
                type="number"
                value={pointsDialog.delta}
                onChange={(e) => setPointsDialog((prev) => ({ ...prev, delta: e.target.value }))}
                placeholder="100"
              />
              <p className="text-xs text-muted-foreground">
                {t('admin.users.adjustPointsHint')}
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="points-reason">{t('admin.users.adjustPointsReason')}</Label>
              <Textarea
                id="points-reason"
                rows={3}
                value={pointsDialog.reason}
                onChange={(e) => setPointsDialog((prev) => ({ ...prev, reason: e.target.value }))}
                placeholder={t('admin.users.adjustPointsReasonPlaceholder')}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={closeAdjustPoints}>{t('common.cancel')}</Button>
            <Button onClick={handleSubmitAdjustPoints} disabled={adjustPointsMutation.isLoading}>
              {adjustPointsMutation.isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {t('common.confirm')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={editDialog.open} onOpenChange={(open) => (!open ? closeDetailedEdit() : null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('admin.users.editUser')}</DialogTitle>
            <DialogDescription>{editDialog.user?.username}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmitDetailedEdit} className="space-y-4">
            <div>
              <Label>{t('admin.groups.title')}</Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={editDialog.groupId}
                onChange={(e) => setEditDialog({ ...editDialog, groupId: e.target.value })}
              >
                <option value="">{t('common.none')}</option>
                {groups?.map(g => (
                  <option key={g.id} value={g.id}>{g.name}</option>
                ))}
              </select>
            </div>

            {/* Dynamic Quota Usage Inputs - Render inputs for each flattened quota key */}
            <div className="space-y-3 border-t pt-3 border-b pb-3">
              <Label className="text-base font-semibold">{t('admin.groups.quotaOverride')}</Label>
              {Object.keys(editDialog.quotaFlat || {}).length > 0 ? (
                Object.entries(editDialog.quotaFlat).map(([key, value]) => (
                  <div key={key}>
                          <Label className="capitalize">{t(`admin.quotas.${key}`, key.replace('.', ' '))}</Label>
                    <Input
                      type="number"
                      value={value ?? ''}
                      onChange={e => handleQuotaChange(key, e.target.value)}
                            placeholder={t('common.default')}
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{t('admin.groups.noQuotasAvailable')}</p>
              )}
            </div>
            <div>
              <Label>{t('admin.groups.notes')}</Label>
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
        <DialogContent className="w-[calc(100vw-1.5rem)] max-w-none overflow-hidden p-0 sm:w-[calc(100vw-3rem)] sm:max-w-6xl xl:max-w-7xl 2xl:max-w-[1440px] rounded-[1.5rem] bg-white dark:bg-[#1C1C1E] border-none shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]">
          <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
            <DialogHeader className="shrink-0 px-6 pt-8 pb-4 bg-white dark:bg-black/40 backdrop-blur-xl relative z-10 border-b border-transparent dark:border-white/5">
              <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-white shadow-sm ring-4 ring-white dark:ring-[#121212]">
                <span className="text-3xl font-semibold">{detailUser?.username?.[0]?.toUpperCase() || '?'}</span>
              </div>
              <DialogTitle className="text-center text-2xl font-semibold tracking-tight text-foreground">
                {detailUser
                  ? t('admin.users.detailTitle',  { username: detailUser.username })
                  : t('admin.users.detailTitleFallback')}
              </DialogTitle>
              <DialogDescription className="text-center text-base mt-1 text-muted-foreground/80">{detailUser?.email || ''}</DialogDescription>
            </DialogHeader>
            <div className="flex-1 bg-zinc-50/80 dark:bg-black/20 overflow-y-auto px-6 pb-8 pt-6 relative isolate">
              {userOverviewQuery.isLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {t('common.loading')}
                </div>
              ) : userOverviewQuery.error ? (
                <p className="text-sm text-center text-destructive py-8">{t('admin.users.detailLoadFailed')}</p>
              ) : overviewData ? (
                <div className="mx-auto max-w-4xl space-y-8">
              
              {/* Basic Info - iOS Grouped List */}
              <div className="space-y-2">
                <h4 className="px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.users.detail.basicInformation')}</h4>
                <div className="overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 shadow-sm">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/5 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <span className="text-base font-medium text-foreground">{t('admin.users.detail.username')}</span>
                    <span className="text-base text-muted-foreground">{detailUser?.username}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/5 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <span className="text-base font-medium text-foreground">{t('admin.users.detail.role')}</span>
                    <span className="text-base text-muted-foreground">{renderRoleBadge(detailUser)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/5 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <span className="text-base font-medium text-foreground">{t('admin.users.detail.status')}</span>
                    <span className="text-base text-muted-foreground">{renderStatusBadge(detailUser)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/5 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <span className="text-base font-medium text-foreground">{t('admin.users.detail.registrationDays')}</span>
                    <span className="text-base text-muted-foreground">{detailUser?.days_since_registration ?? 0}</span>
                  </div>
                  {detailUser?.lastlgn && (
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/5 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <span className="text-base font-medium text-foreground">{t('admin.users.detail.lastLogin')}</span>
                      <span className="text-base text-muted-foreground">
                        {formatDateSafe(detailUser.lastlgn, 'yyyy-MM-dd HH:mm', '--')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.users.detail.generalMetrics')}</h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {metricsCards.map((card) => {
                    const Icon = card.icon;
                    return (
                      <div key={card.key} className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 p-4 shadow-sm transition-transform hover:scale-[1.02]">
                        <div className="flex items-center justify-between mb-3 text-muted-foreground">
                          <Icon className="h-5 w-5 opacity-70" />
                          <p className="text-xs font-medium uppercase tracking-wide opacity-80">{card.label}</p>
                        </div>
                        <p className="text-2xl font-bold tracking-tight text-foreground text-right mt-1">
                          {Number(card.value || 0).toLocaleString(currentLanguage, { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {checkinCards.length > 0 && (
                <div className="space-y-2">
                  <div className="px-4">
                    <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{t('admin.users.checkins.title')}</h4>
                    <p className="text-xs text-muted-foreground/80 mt-0.5">{t('admin.users.checkins.subtitle')}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
                    {checkinCards.map((card) => {
                      const Icon = card.icon;
                      return (
                        <div key={card.key} className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 p-4 shadow-sm transition-transform hover:scale-[1.02]">
                          <div className="flex items-center justify-between mb-3 text-muted-foreground">
                            <Icon className="h-5 w-5 opacity-70" />
                            <p className="text-xs font-medium uppercase tracking-wide opacity-80">{card.label}</p>
                          </div>
                          <p className="text-2xl font-bold tracking-tight text-foreground text-right mt-1">
                            {Number(card.value || 0).toLocaleString(currentLanguage, { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-4 text-xs font-medium text-muted-foreground border-l-2 border-emerald-500 ml-4 py-0.5">
                    {checkinStats.active_today
                      ? t('admin.users.checkins.activeToday')
                      : t('admin.users.checkins.inactiveToday')}
                    {checkinStats.last_checkin_date || detailUser?.last_checkin_date ? (
                      <> · {t('admin.users.checkins.lastDateLong',  { date: checkinStats.last_checkin_date || detailUser?.last_checkin_date })}</>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center gap-3 px-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                    <Fingerprint className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold tracking-tight text-foreground">{t('admin.users.security.title')}</h4>
                    <p className="text-xs text-muted-foreground">{t('admin.users.security.subtitle')}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground opacity-80">{t('admin.users.security.passkeysTotal')}</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-foreground text-right">{passkeySummary.total}</p>
                  </div>
                  <div className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground opacity-80">{t('admin.users.security.backupEnabled')}</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-foreground text-right">{passkeySummary.backup_enabled}</p>
                  </div>
                  <div className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground opacity-80">{t('admin.users.security.backupEligible')}</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-foreground text-right">{passkeySummary.backup_eligible}</p>
                  </div>
                  <div className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground opacity-80">{t('admin.users.security.lastPasskeyUsed')}</p>
                    <p className="mt-3 text-sm font-semibold text-foreground text-right">
                      {formatDateSafe(passkeySummary.last_used_at, 'yyyy-MM-dd HH:mm', t('admin.users.security.neverUsed'))}
                    </p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 shadow-sm">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/5">
                    <p className="text-sm font-medium text-foreground">
                      {securityActivityExpanded
                        ? t('admin.users.security.expandedHint')
                        : t('admin.users.security.previewHint')}
                    </p>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-xl px-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-blue-600 font-medium"
                      onClick={() => {
                        setSecurityActivityExpanded((prev) => !prev);
                        setSecurityActivityPage(1);
                      }}
                    >
                      {securityActivityExpanded ? t('admin.users.security.collapse') : t('admin.users.security.expand')}
                      {securityActivityExpanded ? <ChevronUp className="ml-1.5 h-4 w-4" /> : <ChevronDown className="ml-1.5 h-4 w-4" />}
                    </Button>
                  </div>
                  <div className="p-4">
                  {securityActivityExpanded && (
                    <div className="grid gap-3 sm:grid-cols-2 mb-4">
                      <label className="space-y-1.5 text-sm">
                        <span className="font-medium px-1 text-muted-foreground">{t('securityActivity.filters.typeLabel')}</span>
                        <div className="relative">
                          <select
                            value={securityActivityFilters.type}
                            onChange={(event) => handleSecurityActivityFilterChange('type', event.target.value)}
                            className="h-10 w-full appearance-none rounded-xl border-none bg-zinc-50 dark:bg-white/10 px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-blue-500/20"
                          >
                            {securityActivityTypeOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                      </label>
                      <label className="space-y-1.5 text-sm">
                        <span className="font-medium px-1 text-muted-foreground">{t('securityActivity.filters.periodLabel')}</span>
                        <div className="relative">
                          <select
                            value={securityActivityFilters.period}
                            onChange={(event) => handleSecurityActivityFilterChange('period', event.target.value)}
                            className="h-10 w-full appearance-none rounded-xl border-none bg-zinc-50 dark:bg-white/10 px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-blue-500/20"
                          >
                            {securityActivityPeriodOptions.map((option) => (
                              <option key={option.value} value={option.value}>
                                {option.label}
                              </option>
                            ))}
                          </select>
                          <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                      </label>
                    </div>
                  )}
                  {userSecurityActivityQuery.isError ? (
                    <Alert variant="destructive" className="rounded-xl mb-4 border-red-500/20 bg-red-500/10">
                      <AlertTitle>{t('common.error')}</AlertTitle>
                      <AlertDescription>{t('securityActivity.loadError')}</AlertDescription>
                    </Alert>
                  ) : null}
                  <div className="rounded-xl border border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/10/30 overflow-hidden">
                    <SecurityActivityList
                      items={recentSecurityActivity}
                      compact
                      isLoading={userSecurityActivityQuery.isLoading}
                      emptyText={t('admin.users.security.empty')}
                    />
                  </div>
                  {securityActivityExpanded && !userSecurityActivityQuery.isError ? (
                    <div className="mt-4 flex justify-center">
                      <Pagination
                        currentPage={securityActivityPagination.current_page}
                        totalPages={securityActivityPagination.total_pages}
                        onPageChange={setSecurityActivityPage}
                        itemsPerPage={securityActivityPagination.per_page}
                        totalItems={securityActivityPagination.total_items}
                      />
                    </div>
                  ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4">
                  <div>
                    <h4 className="text-sm font-semibold tracking-tight text-foreground">{t('admin.users.badgeSummary')}</h4>
                    <p className="text-xs text-muted-foreground">{t('admin.users.badgeSummaryHint')}</p>
                  </div>
                  <div className="flex items-center justify-end gap-2 text-sm bg-white dark:bg-[#2C2C2E] rounded-full px-3 py-1.5 border border-zinc-100 dark:border-white/5 shadow-sm">
                    <span className="font-medium text-muted-foreground">{t('admin.users.showRevokedBadges')}</span>
                    <Switch checked={showRevokedBadges} onCheckedChange={(checked) => setShowRevokedBadges(Boolean(checked))} className="data-[state=checked]:bg-blue-500" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  <div className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground opacity-80">{t('admin.users.badgesAwarded')}</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-foreground text-right">{badgeSummary.awarded}</p>
                  </div>
                  <div className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground opacity-80">{t('admin.users.badgesRevoked')}</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-foreground text-right">{badgeSummary.revoked}</p>
                  </div>
                  <div className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground opacity-80">{t('admin.users.badgesTotal')}</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-foreground text-right">{badgeSummary.total}</p>
                  </div>
                </div>

                {userBadgesQuery.isLoading ? (
                  <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {t('common.loading')}
                  </div>
                ) : userBadgesQuery.error ? (
                  <p className="text-sm text-destructive px-4">{t('admin.users.badgesLoadFailed')}</p>
                ) : badgeRows.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-zinc-100 dark:border-white/5 bg-white dark:bg-[#2C2C2E] shadow-sm">
                    <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                      <thead className="bg-zinc-50/50 dark:bg-white/10/30">
                        <tr>
                          <th className="px-6 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('admin.users.badgeTable.badge')}</th>
                          <th className="px-6 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('admin.users.badgeTable.status')}</th>
                          <th className="px-6 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">{t('admin.users.badgeTable.awardedAt')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {badgeRows.map((entry, index) => {
                          const badge = entry.badge || {};
                          const record = entry.user_badge || {};
                          const badgeImage = resolveR2ImageSource({
                            urlCandidates: [badge.icon_url, badge.icon_presigned_url],
                            pathCandidates: [badge.icon_path],
                          });
                          return (
                            <tr key={index} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                              <td className="px-6 py-3">
                                <div className="flex items-center gap-4">
                                  <div className="h-10 w-10 overflow-hidden rounded-xl border border-zinc-100 dark:border-white/5 bg-white shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] dark:bg-white/10">
                                    {badgeImage.src || badgeImage.filePath ? (
                                      <R2Image
                                        src={badgeImage.src || undefined}
                                        filePath={badgeImage.filePath || undefined}
                                        alt={badge.name_zh || badge.name_en}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <Award className="h-5 w-5 text-muted-foreground m-auto mt-2.5" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-foreground tracking-tight">{badge.name_zh || badge.name_en || '-'}</p>
                                    {badge.name_en && <p className="text-xs text-muted-foreground">{badge.name_en}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap">
                                <Badge variant={record.status === 'awarded' ? 'success' : 'secondary'} className="rounded-full px-2.5 font-medium">{record.status === 'awarded' ? t('admin.users.badgeStatusAwarded') : t('admin.users.badgeStatusRevoked')}</Badge>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-muted-foreground font-medium">
                                {formatDateSafe(record.awarded_at, 'yyyy-MM-dd HH:mm', '--')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground px-4 py-4">{t('admin.users.badgesEmpty')}</p>
                )}
              </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t('admin.users.detailEmpty')}</p>
              )}
            </div>
          </div>
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
