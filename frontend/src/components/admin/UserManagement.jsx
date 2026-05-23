import Silian_React, { useEffect as Silian_useEffect, useMemo as Silian_useMemo, useRef as Silian_useRef, useState as Silian_useState } from 'react';
import { useSearchParams as Silian_useSearchParams } from 'react-router-dom';
import { useQuery as Silian_useQuery, useMutation as Silian_useMutation, useQueryClient as Silian_useQueryClient } from 'react-query';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { adminAPI as Silian_adminAPI } from '../../lib/api';
import { formatDateSafe as Silian_formatDateSafe } from '../../lib/utils';
import {
  Loader2 as Silian_Loader2,
  Trash2 as Silian_Trash2,
  CheckCircle as Silian_CheckCircle,
  XCircle as Silian_XCircle,
  Search as Silian_Search,
  PlusCircle as Silian_PlusCircle,
  Sparkles as Silian_Sparkles,
  Shield as Silian_Shield,
  Ban as Silian_Ban,
  Users as Silian_UsersIcon,
  Eye as Silian_Eye,
  Fingerprint as Silian_Fingerprint,
  Leaf as Silian_Leaf,
  ClipboardList as Silian_ClipboardList,
  CalendarDays as Silian_CalendarDays,
  Award as Silian_Award,
  Settings as Silian_Settings,
  Flame as Silian_Flame,
  RefreshCcw as Silian_RefreshCcw,
  ChevronDown as Silian_ChevronDown,
  ChevronUp as Silian_ChevronUp,
} from 'lucide-react';
import { Button as Silian_Button } from '../ui/Button';
import { Input as Silian_Input } from '../ui/Input';
import { Alert as Silian_Alert, AlertTitle as Silian_AlertTitle, AlertDescription as Silian_AlertDescription } from '../ui/Alert';
import { Pagination as Silian_Pagination } from '../ui/Pagination';
import { Checkbox as Silian_Checkbox } from '../ui/checkbox';
import { Switch as Silian_Switch } from '../ui/switch';
import {
  AlertDialog as Silian_AlertDialog,
  AlertDialogAction as Silian_AlertDialogAction,
  AlertDialogCancel as Silian_AlertDialogCancel,
  AlertDialogContent as Silian_AlertDialogContent,
  AlertDialogDescription as Silian_AlertDialogDescription,
  AlertDialogFooter as Silian_AlertDialogFooter,
  AlertDialogHeader as Silian_AlertDialogHeader,
  AlertDialogTitle as Silian_AlertDialogTitle,
} from '../ui/alert-dialog';
import {
  Dialog as Silian_Dialog,
  DialogContent as Silian_DialogContent,
  DialogDescription as Silian_DialogDescription,
  DialogFooter as Silian_DialogFooter,
  DialogHeader as Silian_DialogHeader,
  DialogTitle as Silian_DialogTitle,
} from '../ui/dialog';
import { Label as Silian_Label } from '../ui/label';
import { Textarea as Silian_Textarea } from '../ui/textarea';
import { Badge as Silian_Badge } from '../ui/badge';
import Silian_BadgeBulkAwardDialog from './badges/BadgeBulkAwardDialog';
import Silian_SecurityActivityList from '../security/SecurityActivityList';
import Silian_R2Image from '@/components/common/R2Image';
import { resolveR2ImageSource as Silian_resolveR2ImageSource } from '@/lib/r2Image';
import { toast as Silian_toast } from 'react-hot-toast';

const Silian_DEFAULT_FILTERS = {
  search: '',
  role: '',
  status: '',
  page: 1,
  limit: 10,
  sort: 'created_at_desc',
};

const Silian_USER_ROLE_OPTIONS = ['user', 'support', 'admin'];

const Silian_normalizeRole = (Silian_user = {}) => {
  if (Silian_user.is_admin === true || Silian_user.is_admin === 1 || Silian_user.is_admin === '1') {
    return 'admin';
  }
  const Silian_role = typeof Silian_user.role === 'string' ? Silian_user.role.trim().toLowerCase() : '';
  if (Silian_USER_ROLE_OPTIONS.includes(Silian_role)) {
    return Silian_role;
  }
  return 'user';
};

const Silian_normalizeUser = (Silian_user = {}) => {
  const Silian_toNumber = (Silian_value) => {
    const Silian_num = Number(Silian_value);
    return Number.isFinite(Silian_num) ? Silian_num : 0;
  };
  return {
    ...Silian_user,
    is_admin: Silian_user.is_admin === true || Silian_user.is_admin === 1 || Silian_user.is_admin === '1',
    role: Silian_normalizeRole(Silian_user),
    checkin_days: Silian_toNumber(Silian_user.checkin_days),
    makeup_checkins: Silian_toNumber(Silian_user.makeup_checkins),
  };
};

const Silian_normalizeUserBadgeEntry = (Silian_entry = {}) => ({
  ...Silian_entry,
  id: Silian_entry.id,
  badge: Silian_entry.badge || {},
});

const Silian_normalizeRecentBadge = (Silian_entry = {}) => Silian_normalizeUserBadgeEntry(Silian_entry);

const Silian_normalizeMetrics = (Silian_metrics = {}) => ({
  total_points_earned: Number(Silian_metrics.total_points_earned ?? 0),
  total_points_balance: Number(Silian_metrics.total_points_balance ?? 0),
  total_carbon_saved: Number(Silian_metrics.total_carbon_saved ?? 0),
  total_records: Number(Silian_metrics.total_records ?? 0),
  total_approved_records: Number(Silian_metrics.total_approved_records ?? 0),
});

const Silian_normalizeBadgeSummary = (Silian_summary = {}) => ({
  awarded: Number(Silian_summary.awarded ?? 0),
  revoked: Number(Silian_summary.revoked ?? 0),
  total: Number(Silian_summary.total ?? (Number(Silian_summary.awarded ?? 0) + Number(Silian_summary.revoked ?? 0))),
});

const Silian_getUserIdentifier = (Silian_user) => Silian_user?.uuid || Silian_user?.id || null;

function Silian_normalizeUsersResponse(Silian_response) {
  const Silian_payload = Silian_response?.data?.data || Silian_response?.data || {};
  if (Array.isArray(Silian_payload.users)) {
    return {
      users: Silian_payload.users.map(Silian_normalizeUser),
      pagination: Silian_payload.pagination || {},
    };
  }
  const Silian_nested = Silian_payload.data || {};
  const Silian_users = Array.isArray(Silian_nested.users) ? Silian_nested.users.map(Silian_normalizeUser) : [];
  return {
    users: Silian_users,
    pagination: Silian_nested.pagination || {},
  };
}

export function UserManagement() {
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['admin', 'common', 'errors', 'pagination', 'securityActivity']);
  const Silian_queryClient = Silian_useQueryClient();
  const [Silian_filters, Silian_setFilters] = Silian_useState(Silian_DEFAULT_FILTERS);
  const [Silian_searchParams, Silian_setSearchParams] = Silian_useSearchParams();
  const Silian_searchInputRef = Silian_useRef(null);
  const [Silian_confirmDialog, Silian_setConfirmDialog] = Silian_useState({ open: false, type: null, user: null, payload: null });
  const [Silian_pointsDialog, Silian_setPointsDialog] = Silian_useState({ open: false, user: null, delta: '', reason: '' });
  const [Silian_selectedUsersMap, Silian_setSelectedUsersMap] = Silian_useState(new Map());
  const [Silian_bulkDialog, Silian_setBulkDialog] = Silian_useState({ open: false, presetUsers: [] });
  const [Silian_detailState, Silian_setDetailState] = Silian_useState({ open: false, userId: null, userUuid: null });
  const [Silian_showRevokedBadges, Silian_setShowRevokedBadges] = Silian_useState(false);
  const [Silian_securityActivityExpanded, Silian_setSecurityActivityExpanded] = Silian_useState(false);
  const [Silian_securityActivityPage, Silian_setSecurityActivityPage] = Silian_useState(1);
  const [Silian_securityActivityFilters, Silian_setSecurityActivityFilters] = Silian_useState({
    type: 'all',
    period: 'all',
  });
  const [Silian_editDialog, Silian_setEditDialog] = Silian_useState({
    open: false,
    user: null,
    notes: '',
    groupId: '',
    quotaFlat: {},
    supportRouting: {}
  });

  const { data: Silian_groups } = Silian_useQuery('adminUserGroups', () =>
    Silian_adminAPI.getUserGroups().then(Silian_res => Silian_res.data?.data || [])
  );

  const { data: Silian_groupMeta } = Silian_useQuery('adminUserGroupMeta', () =>
    Silian_adminAPI.getUserGroupMeta().then(Silian_res => Silian_res.data?.data || {})
  );

  const Silian_apiFilterParams = Silian_useMemo(() => {
    const Silian_base = {
      page: Silian_filters.page,
      limit: Silian_filters.limit,
      sort: Silian_filters.sort,
    };
    const Silian_trimmedSearch = Silian_filters.search.trim();
    if (Silian_trimmedSearch) {
      Silian_base.q = Silian_trimmedSearch;
    }
    if (Silian_filters.status) {
      Silian_base.status = Silian_filters.status;
    }
    if (Silian_filters.role) {
      Silian_base.role = Silian_filters.role;
    }
    return Silian_base;
  }, [Silian_filters]);

  const Silian_usersQuery = Silian_useQuery(
    ['adminUsers', Silian_apiFilterParams],
    () => Silian_adminAPI.getUsers(Silian_apiFilterParams),
    { keepPreviousData: true }
  );

  const Silian_badgesQuery = Silian_useQuery(
    ['adminBadges', 'forAwarding'],
    () => Silian_adminAPI.getBadges({ limit: 200 }),
    { staleTime: 60000 }
  );

  const Silian_detailIdentifier = Silian_detailState.userUuid || Silian_detailState.userId;
  const Silian_securityActivityLimit = Silian_securityActivityExpanded ? 10 : 3;

  const Silian_userOverviewQuery = Silian_useQuery(
    ['adminUserOverview', Silian_detailIdentifier],
    () => Silian_adminAPI.getUserOverview(Silian_detailIdentifier).then((Silian_res) => Silian_res.data?.data),
    {
      enabled: Silian_detailState.open && Boolean(Silian_detailIdentifier),
      select: (Silian_data) => {
        if (!Silian_data) {
          return null;
        }
        const Silian_metrics = Silian_normalizeMetrics(Silian_data.metrics || {});
        const Silian_badgeSummary = Silian_normalizeBadgeSummary(Silian_data.badge_summary || {});
        const Silian_recent = Array.isArray(Silian_data.recent_badges) ? Silian_data.recent_badges.map(Silian_normalizeRecentBadge) : [];
        return {
          ...Silian_data,
          metrics: Silian_metrics,
          badge_summary: Silian_badgeSummary,
          recent_badges: Silian_recent,
        };
      },
    }
  );

  const Silian_userBadgesQuery = Silian_useQuery(
    ['adminUserBadges', Silian_detailIdentifier, Silian_showRevokedBadges],
    () =>
      Silian_adminAPI
        .getUserBadges(Silian_detailIdentifier, { include_revoked: Silian_showRevokedBadges })
        .then((Silian_res) => Silian_res.data?.data),
    {
      enabled: Silian_detailState.open && Boolean(Silian_detailIdentifier),
      select: (Silian_data) => {
        if (!Silian_data) {
          return null;
        }
        const Silian_summary = Silian_normalizeBadgeSummary(Silian_data.summary || {});
        const Silian_metrics = Silian_normalizeMetrics(Silian_data.metrics || {});
        const Silian_badges = Array.isArray(Silian_data.badges) ? Silian_data.badges.map(Silian_normalizeUserBadgeEntry) : [];
        return {
          ...Silian_data,
          summary: Silian_summary,
          metrics: Silian_metrics,
          badges: Silian_badges,
        };
      },
    }
  );

  const Silian_userSecurityActivityQuery = Silian_useQuery(
    ['adminUserSecurityActivity', Silian_detailIdentifier, Silian_securityActivityPage, Silian_securityActivityLimit, Silian_securityActivityFilters.type, Silian_securityActivityFilters.period],
    () =>
      Silian_adminAPI
        .getUserSecurityActivity(Silian_detailIdentifier, {
          page: Silian_securityActivityPage,
          limit: Silian_securityActivityLimit,
          ...Silian_securityActivityFilters,
        })
        .then((Silian_res) => Silian_res.data?.data),
    {
      enabled: Silian_detailState.open && Boolean(Silian_detailIdentifier),
      keepPreviousData: true,
    }
  );

  const Silian_updateUserMutation = Silian_useMutation(
    ({ identifier: Silian_identifier, data: Silian_data }) => Silian_adminAPI.updateUser(Silian_identifier, Silian_data),
    {
      onSuccess: () => {
        Silian_queryClient.invalidateQueries('adminUsers');
        Silian_toast.success(Silian_t('admin.users.updateSuccess'));
      },
      onError: () => {
        Silian_toast.error(Silian_t('admin.users.updateFailed'));
      },
    }
  );

  const Silian_deleteUserMutation = Silian_useMutation(
    (Silian_identifier) => Silian_adminAPI.deleteUser(Silian_identifier),
    {
      onSuccess: () => {
        Silian_queryClient.invalidateQueries('adminUsers');
        Silian_toast.success(Silian_t('admin.users.deleteSuccess'));
      },
      onError: () => {
        Silian_toast.error(Silian_t('admin.users.deleteFailed'));
      },
    }
  );

  const Silian_adjustPointsMutation = Silian_useMutation(
    ({ identifier: Silian_identifier, data: Silian_data }) => Silian_adminAPI.adjustUserPoints(Silian_identifier, Silian_data),
    {
      onSuccess: () => {
        Silian_queryClient.invalidateQueries('adminUsers');
        Silian_toast.success(Silian_t('admin.users.adjustSuccess'));
      },
      onError: () => {
        Silian_toast.error(Silian_t('admin.users.adjustFailed'));
      },
    }
  );

  Silian_useEffect(() => {
    if (Silian_searchParams.get('focus') === 'search' && Silian_searchInputRef.current) {
      Silian_searchInputRef.current.focus();
      Silian_setSearchParams((Silian_prev) => {
        const Silian_next = new URLSearchParams(Silian_prev);
        Silian_next.delete('focus');
        return Silian_next;
      }, { replace: true });
    }
  }, [Silian_searchParams, Silian_setSearchParams]);

  Silian_useEffect(() => {
    const Silian_userUuidParam = Silian_searchParams.get('userUuid');
    const Silian_userIdParam = Silian_searchParams.get('userId');
    if (!Silian_userUuidParam && !Silian_userIdParam) {
      return;
    }
    const Silian_cleanup = () => {
      Silian_setSearchParams((Silian_prev) => {
        const Silian_next = new URLSearchParams(Silian_prev);
        Silian_next.delete('userUuid');
        Silian_next.delete('userId');
        return Silian_next;
      }, { replace: true });
    };
    if (Silian_userUuidParam) {
      const Silian_normalized = Silian_userUuidParam.trim().toLowerCase();
      if (!Silian_normalized) {
        Silian_cleanup();
        return;
      }
      if (!Silian_detailState.open || Silian_detailState.userUuid !== Silian_normalized) {
        Silian_setDetailState({ open: true, userId: null, userUuid: Silian_normalized });
        Silian_setShowRevokedBadges(false);
      }
      Silian_cleanup();
      return;
    }

    const Silian_parsed = Number(Silian_userIdParam);
    if (!Number.isInteger(Silian_parsed) || Silian_parsed <= 0) {
      Silian_cleanup();
      return;
    }
    if (!Silian_detailState.open || Silian_detailState.userId !== Silian_parsed) {
      Silian_setDetailState({ open: true, userId: Silian_parsed, userUuid: null });
      Silian_setShowRevokedBadges(false);
    }
    Silian_cleanup();
  }, [Silian_searchParams, Silian_detailState.open, Silian_detailState.userId, Silian_detailState.userUuid, Silian_setSearchParams, Silian_setShowRevokedBadges]);

  const { users: Silian_users, pagination: Silian_pagination } = Silian_useMemo(() => Silian_normalizeUsersResponse(Silian_usersQuery.data), [Silian_usersQuery.data]);
  const Silian_quotaKeys = Silian_useMemo(() => {
    const Silian_definitions = Silian_groupMeta?.quota_definitions;
    if (Array.isArray(Silian_definitions) && Silian_definitions.length > 0) {
      return Silian_definitions;
    }
    const Silian_sample = Silian_users.find((Silian_entry) => Silian_entry?.quota_flat) || null;
    return Object.keys(Silian_sample?.quota_flat || {});
  }, [Silian_groupMeta, Silian_users]);
  const Silian_quotaTemplate = Silian_useMemo(
    () => Silian_quotaKeys.reduce((Silian_acc, Silian_key) => ({ ...Silian_acc, [Silian_key]: null }), {}),
    [Silian_quotaKeys]
  );
  const Silian_supportRoutingFields = Silian_useMemo(() => {
    const Silian_fields = Silian_groupMeta?.support_routing_fields;
    if (Array.isArray(Silian_fields) && Silian_fields.length > 0) {
      return Silian_fields;
    }
    return [
      { key: 'first_response_minutes', type: 'number', default: 240, label_key: 'admin.groups.supportFirstResponseMinutes' },
      { key: 'resolution_minutes', type: 'number', default: 1440, label_key: 'admin.groups.supportResolutionMinutes' },
      { key: 'routing_weight', type: 'number', default: 1, step: 0.1, label_key: 'admin.groups.supportRoutingWeight' },
      { key: 'min_agent_level', type: 'number', default: 1, min: 1, max: 5, label_key: 'admin.groups.supportMinAgentLevel' },
      { key: 'overdue_boost', type: 'number', default: 1, step: 0.1, label_key: 'admin.groups.supportOverdueBoost' },
      { key: 'tier_label', type: 'text', default: 'standard', label_key: 'admin.groups.supportTierLabel' },
    ];
  }, [Silian_groupMeta]);
  const Silian_buildSupportRoutingOverrideState = (Silian_source = {}) => (
    Silian_supportRoutingFields.reduce((Silian_acc, Silian_field) => {
      Silian_acc[Silian_field.key] = Silian_source?.[Silian_field.key] ?? '';
      return Silian_acc;
    }, {})
  );
  const Silian_isInitialUsersLoading = Silian_usersQuery.isLoading && !Silian_usersQuery.data;
  const Silian_isRefetchingUsers = Silian_usersQuery.isFetching && !!Silian_usersQuery.data;
  const Silian_selectedUser = Silian_useMemo(() => {
    if (!Silian_detailIdentifier) {
      return null;
    }
    return Silian_users.find((Silian_item) => Silian_item.uuid === Silian_detailState.userUuid || Silian_item.id === Silian_detailState.userId) || null;
  }, [Silian_detailIdentifier, Silian_detailState.userId, Silian_detailState.userUuid, Silian_users]);

  const Silian_overviewData = Silian_userOverviewQuery.data || null;
  const Silian_badgeData = Silian_userBadgesQuery.data || null;
  const Silian_badgeRows = Array.isArray(Silian_badgeData?.badges)
    ? Silian_badgeData.badges
    : Array.isArray(Silian_badgeData?.items)
      ? Silian_badgeData.items
      : [];
  const Silian_badgeSummary = Silian_badgeData?.summary || Silian_overviewData?.badge_summary || { awarded: 0, revoked: 0, total: 0 };
  const Silian_overviewUser = Silian_useMemo(
    () => (Silian_overviewData?.user ? Silian_normalizeUser(Silian_overviewData.user) : null),
    [Silian_overviewData]
  );
  const Silian_detailUser = Silian_selectedUser ?? Silian_overviewUser;
  const Silian_checkinStats = Silian_useMemo(
    () => (Silian_overviewData?.checkin_stats || {}),
    [Silian_overviewData]
  );
  const Silian_passkeySummary = Silian_useMemo(
    () => ({
      total: Number(Silian_overviewData?.passkey_summary?.total ?? 0),
      backup_enabled: Number(Silian_overviewData?.passkey_summary?.backup_enabled ?? 0),
      backup_eligible: Number(Silian_overviewData?.passkey_summary?.backup_eligible ?? 0),
      last_used_at: Silian_overviewData?.passkey_summary?.last_used_at ?? null,
      last_registered_at: Silian_overviewData?.passkey_summary?.last_registered_at ?? null,
    }),
    [Silian_overviewData]
  );
  const Silian_recentSecurityActivity = Silian_useMemo(
    () => (Array.isArray(Silian_userSecurityActivityQuery.data?.items) ? Silian_userSecurityActivityQuery.data.items : []),
    [Silian_userSecurityActivityQuery.data]
  );
  const Silian_securityActivityPagination = Silian_userSecurityActivityQuery.data?.pagination || {};

  const Silian_securityActivityTypeOptions = Silian_useMemo(
    () => [
      { value: 'all', label: Silian_t('securityActivity.filters.types.all') },
      { value: 'sign_ins', label: Silian_t('securityActivity.filters.types.signIns') },
      { value: 'passkey_changes', label: Silian_t('securityActivity.filters.types.passkeyChanges') },
      { value: 'password_changes', label: Silian_t('securityActivity.filters.types.passwordChanges') },
      { value: 'logouts', label: Silian_t('securityActivity.filters.types.logouts') },
    ],
    [Silian_t]
  );
  const Silian_securityActivityPeriodOptions = Silian_useMemo(
    () => [
      { value: 'all', label: Silian_t('securityActivity.filters.periods.all') },
      { value: '7d', label: Silian_t('securityActivity.filters.periods.last7Days') },
      { value: '30d', label: Silian_t('securityActivity.filters.periods.last30Days') },
      { value: '90d', label: Silian_t('securityActivity.filters.periods.last90Days') },
    ],
    [Silian_t]
  );
  const Silian_metricsCards = Silian_useMemo(() => {
    if (!Silian_overviewData && !Silian_detailUser) {
      return [];
    }
    const Silian_metrics = Silian_overviewData?.metrics || {};
    return [
      { key: 'balance', label: Silian_t('admin.users.detail.pointsBalance'), value: Silian_detailUser?.points ?? 0, icon: Silian_Award },
      { key: 'earned', label: Silian_t('admin.users.detail.pointsEarned'), value: Silian_metrics.total_points_earned ?? 0, icon: Silian_Sparkles },
      { key: 'carbon', label: Silian_t('admin.users.detail.carbonSaved'), value: Silian_metrics.total_carbon_saved ?? 0, icon: Silian_Leaf },
      { key: 'records', label: Silian_t('admin.users.detail.recordsApproved'), value: Silian_metrics.total_approved_records ?? 0, icon: Silian_ClipboardList },
      { key: 'days', label: Silian_t('admin.users.detail.daysSinceRegistration'), value: Silian_detailUser?.days_since_registration ?? Silian_metrics.days_since_registration ?? 0, icon: Silian_CalendarDays },
    ];
  }, [Silian_overviewData, Silian_detailUser, Silian_t]);

  const Silian_checkinCards = Silian_useMemo(() => {
    if (!Silian_overviewData && !Silian_detailUser) {
      return [];
    }
    return [
      { key: 'current', label: Silian_t('admin.users.checkins.currentStreak'), value: Silian_checkinStats.current_streak ?? 0, icon: Silian_Flame },
      { key: 'longest', label: Silian_t('admin.users.checkins.longestStreak'), value: Silian_checkinStats.longest_streak ?? 0, icon: Silian_Flame },
      { key: 'total', label: Silian_t('admin.users.checkins.totalDays'), value: Silian_checkinStats.total_days ?? Silian_detailUser?.checkin_days ?? 0, icon: Silian_CalendarDays },
      { key: 'makeup', label: Silian_t('admin.users.checkins.makeupDays'), value: Silian_checkinStats.makeup_days ?? Silian_detailUser?.makeup_checkins ?? 0, icon: Silian_RefreshCcw },
    ];
  }, [Silian_overviewData, Silian_detailUser, Silian_checkinStats, Silian_t]);

  const Silian_selectedUsers = Silian_useMemo(() => Array.from(Silian_selectedUsersMap.values()), [Silian_selectedUsersMap]);
  const Silian_badgeOptions = Silian_useMemo(() => {
    const Silian_source = Silian_badgesQuery.data?.data?.data || Silian_badgesQuery.data?.data || [];
    return Array.isArray(Silian_source) ? Silian_source : [];
  }, [Silian_badgesQuery.data]);

  const Silian_allSelectedOnPage = Silian_users.length > 0 && Silian_users.every((Silian_user) => Silian_selectedUsersMap.has(Silian_user.id));
  const Silian_partiallySelected = Silian_users.some((Silian_user) => Silian_selectedUsersMap.has(Silian_user.id)) && !Silian_allSelectedOnPage;

  const Silian_handleFilterChange = (Silian_key, Silian_value) => {
    Silian_setFilters((Silian_prev) => ({ ...Silian_prev, [Silian_key]: Silian_value, page: Silian_key === 'page' ? Silian_value : 1 }));
  };

  const Silian_handlePageChange = (Silian_page) => {
    Silian_handleFilterChange('page', Silian_page);
  };

  const Silian_toggleUserSelection = (Silian_user, Silian_shouldSelect) => {
    Silian_setSelectedUsersMap((Silian_prev) => {
      const Silian_next = new Map(Silian_prev);
      if (Silian_shouldSelect) {
        Silian_next.set(Silian_user.id, Silian_user);
      } else {
        Silian_next.delete(Silian_user.id);
      }
      return Silian_next;
    });
  };

  const Silian_handleSelectAllOnPage = (Silian_shouldSelect) => {
    Silian_setSelectedUsersMap((Silian_prev) => {
      const Silian_next = new Map(Silian_prev);
      if (Silian_shouldSelect) {
        Silian_users.forEach((Silian_user) => Silian_next.set(Silian_user.id, Silian_user));
      } else {
        Silian_users.forEach((Silian_user) => Silian_next.delete(Silian_user.id));
      }
      return Silian_next;
    });
  };

  const Silian_handleToggleStatus = (Silian_user) => {
    const Silian_toActive = Silian_user.status !== 'active';
    Silian_openConfirmDialog({
      type: 'status',
      user: Silian_user,
      payload: { nextStatus: Silian_toActive ? 'active' : 'inactive' },
    });
  };

  const Silian_handleEditUser = (Silian_user) => {
    Silian_openConfirmDialog({
      type: 'role',
      user: Silian_user,
      payload: { nextRole: Silian_normalizeRole(Silian_user) },
    });
  };

  const Silian_handleDeleteUser = (Silian_user) => {
    Silian_openConfirmDialog({ type: 'delete', user: Silian_user, payload: null });
  };

  const Silian_openUserDetail = (Silian_user) => {
    if (!Silian_user) {
      return;
    }
    Silian_setDetailState({ open: true, userId: Silian_user.id ?? null, userUuid: Silian_user.uuid ?? null });
    Silian_setShowRevokedBadges(false);
    Silian_setSecurityActivityExpanded(false);
    Silian_setSecurityActivityPage(1);
    Silian_setSecurityActivityFilters({ type: 'all', period: 'all' });
  };

  const Silian_closeUserDetail = () => {
    Silian_setDetailState({ open: false, userId: null, userUuid: null });
    Silian_setShowRevokedBadges(false);
    Silian_setSecurityActivityExpanded(false);
    Silian_setSecurityActivityPage(1);
    Silian_setSecurityActivityFilters({ type: 'all', period: 'all' });
  };

  const Silian_openConfirmDialog = (Silian_config) => {
    Silian_setConfirmDialog({ open: true, ...Silian_config });
  };

  const Silian_closeConfirmDialog = () => {
    Silian_setConfirmDialog({ open: false, type: null, user: null, payload: null });
  };

  const Silian_handleSecurityActivityFilterChange = (Silian_key, Silian_value) => {
    Silian_setSecurityActivityPage(1);
    Silian_setSecurityActivityFilters((Silian_prev) => ({
      ...Silian_prev,
      [Silian_key]: Silian_value,
    }));
  };

  const Silian_handleConfirmAction = () => {
    if (!Silian_confirmDialog.user || !Silian_confirmDialog.type) {
      Silian_closeConfirmDialog();
      return;
    }
    if (Silian_confirmDialog.type === 'status') {
      const Silian_nextStatus = Silian_confirmDialog.payload.nextStatus;
      const Silian_identifier = Silian_getUserIdentifier(Silian_confirmDialog.user);
      Silian_updateUserMutation.mutate(
        { identifier: Silian_identifier, data: { status: Silian_nextStatus } },
        { onSettled: Silian_closeConfirmDialog }
      );
    } else if (Silian_confirmDialog.type === 'role') {
      const Silian_nextRole = Silian_confirmDialog.payload?.nextRole || Silian_normalizeRole(Silian_confirmDialog.user);
      const Silian_identifier = Silian_getUserIdentifier(Silian_confirmDialog.user);
      Silian_updateUserMutation.mutate(
        { identifier: Silian_identifier, data: { role: Silian_nextRole } },
        { onSettled: Silian_closeConfirmDialog }
      );
    } else if (Silian_confirmDialog.type === 'delete') {
      Silian_deleteUserMutation.mutate(Silian_getUserIdentifier(Silian_confirmDialog.user), { onSettled: Silian_closeConfirmDialog });
    } else {
      Silian_closeConfirmDialog();
    }
  };

  const Silian_openAdjustPoints = (Silian_user) => {
    Silian_setPointsDialog({ open: true, user: Silian_user, delta: '', reason: '' });
  };

  const Silian_closeAdjustPoints = () => {
    Silian_setPointsDialog({ open: false, user: null, delta: '', reason: '' });
  };

  const Silian_handleSubmitAdjustPoints = () => {
    if (!Silian_pointsDialog.user) return;
    const Silian_deltaValue = Number(Silian_pointsDialog.delta);
    if (!Number.isFinite(Silian_deltaValue) || Silian_deltaValue === 0) {
      Silian_toast.error(Silian_t('admin.users.invalidDelta'));
      return;
    }
    const Silian_identifier = Silian_getUserIdentifier(Silian_pointsDialog.user);
    Silian_adjustPointsMutation.mutate(
      { identifier: Silian_identifier, data: { delta: Silian_deltaValue, reason: Silian_pointsDialog.reason } },
      { onSettled: Silian_closeAdjustPoints }
    );
  };

  const Silian_openDetailedEdit = (Silian_user) => {
    Silian_setEditDialog({
      open: true,
      user: Silian_user,
      groupId: Silian_user.group_id || '',
      notes: Silian_user.admin_notes || '',
      quotaFlat: { ...Silian_quotaTemplate, ...(Silian_user.quota_flat || {}) },
      supportRouting: Silian_buildSupportRoutingOverrideState(Silian_user.support_routing_override || {})
    });
  };

  const Silian_closeDetailedEdit = () => {
    Silian_setEditDialog({ open: false, user: null, notes: '', groupId: '', quotaFlat: {}, supportRouting: {} });
  };

  const Silian_handleQuotaChange = (Silian_key, Silian_value) => {
    Silian_setEditDialog(Silian_prev => ({
      ...Silian_prev,
      quotaFlat: {
        ...Silian_prev.quotaFlat,
        [Silian_key]: Silian_value
      }
    }));
  };

  const Silian_handleSupportRoutingChange = (Silian_key, Silian_value) => {
    Silian_setEditDialog((Silian_prev) => ({
      ...Silian_prev,
      supportRouting: {
        ...Silian_prev.supportRouting,
        [Silian_key]: Silian_value,
      },
    }));
  };

  const Silian_handleSubmitDetailedEdit = (Silian_e) => {
    Silian_e.preventDefault();
    if (!Silian_editDialog.user) return;

    const Silian_payload = {
      group_id: Silian_editDialog.groupId || '',
      admin_notes: Silian_editDialog.notes,
      quota_flat: Silian_editDialog.quotaFlat,
      support_routing: Silian_editDialog.supportRouting
    };

    Silian_updateUserMutation.mutate(
      { identifier: Silian_getUserIdentifier(Silian_editDialog.user), data: Silian_payload },
      {
        onSuccess: () => {
          Silian_closeDetailedEdit();
          Silian_toast.success(Silian_t('admin.users.updateSuccess'));
        }
      }
    );
  };

  const Silian_openBulkBadgeDialog = (Silian_usersList) => {
    if (!Silian_usersList || Silian_usersList.length === 0) {
      Silian_toast.error(Silian_t('admin.users.selectUserHint'));
      return;
    }
    Silian_setBulkDialog({ open: true, presetUsers: Silian_usersList });
  };

  const Silian_clearSelection = () => {
    Silian_setSelectedUsersMap(new Map());
  };

  const Silian_renderStatusBadge = (Silian_user) => {
    if (!Silian_user || !Silian_user.status) {
      return (
        <span className="inline-flex items-center rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
          {Silian_t('common.unknown')}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium">
        {Silian_user.status === 'active' ? (
          <span className="flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-100 px-2 py-0.5 text-emerald-800 dark:border-emerald-500/30 dark:bg-emerald-500/15 dark:text-emerald-300">
            <Silian_CheckCircle className="h-3 w-3" />
            {Silian_t('admin.users.statusActive')}
          </span>
        ) : (
          <span className="flex items-center gap-1 rounded-full border border-red-200 bg-red-100 px-2 py-0.5 text-red-800 dark:border-red-500/30 dark:bg-red-500/15 dark:text-red-300">
            <Silian_XCircle className="h-3 w-3" />
            {Silian_t('admin.users.statusInactive')}
          </span>
        )}
      </span>
    );
  };

  const Silian_renderRoleBadge = (Silian_user) => {
    if (!Silian_user) {
      return (
        <Silian_Badge variant="outline">
          {Silian_t('common.unknown')}
        </Silian_Badge>
      );
    }
    const Silian_role = Silian_normalizeRole(Silian_user);
    const Silian_variant = Silian_role === 'admin' ? 'default' : Silian_role === 'support' ? 'secondary' : 'outline';
    return (
      <Silian_Badge variant={Silian_variant}>
        {Silian_role === 'admin'
          ? Silian_t('admin.users.roleAdmin')
          : Silian_role === 'support'
            ? Silian_t('admin.users.roleSupport')
            : Silian_t('admin.users.roleUser')}
      </Silian_Badge>
    );
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold tracking-tight">{Silian_t('admin.users.title')}</h2>
        <p className="text-muted-foreground">{Silian_t('admin.users.description')}</p>
      </div>

      <div className="rounded-lg border border-border bg-card p-6 space-y-4 shadow-sm">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">{Silian_t('common.search')}</label>
            <div className="relative">
              <Silian_Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Silian_Input
                ref={Silian_searchInputRef}
                type="text"
                value={Silian_filters.search}
                onChange={(Silian_e) => Silian_handleFilterChange('search', Silian_e.target.value)}
                placeholder={Silian_t('admin.users.searchPlaceholder')}
                className="pl-10"
              />
            </div>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">{Silian_t('admin.users.role')}</label>
            <select
              value={Silian_filters.role}
              onChange={(Silian_e) => Silian_handleFilterChange('role', Silian_e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">{Silian_t('common.all')}</option>
              <option value="user">{Silian_t('admin.users.roleUser')}</option>
              <option value="support">{Silian_t('admin.users.roleSupport')}</option>
              <option value="admin">{Silian_t('admin.users.roleAdmin')}</option>
            </select>
          </div>
          <div>
            <label className="mb-2 block text-sm font-medium text-foreground">{Silian_t('admin.users.status')}</label>
            <select
              value={Silian_filters.status}
              onChange={(Silian_e) => Silian_handleFilterChange('status', Silian_e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
            >
              <option value="">{Silian_t('common.all')}</option>
              <option value="active">{Silian_t('admin.users.statusActive')}</option>
              <option value="inactive">{Silian_t('admin.users.statusInactive')}</option>
            </select>
          </div>
        </div>

        {Silian_isRefetchingUsers && (
          <div className="flex items-center justify-end gap-2 text-xs text-muted-foreground">
            <Silian_Loader2 className="h-3.5 w-3.5 animate-spin" />
            {Silian_t('admin.users.refreshing')}
          </div>
        )}

        {Silian_selectedUsers.length > 0 && (
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-dashed bg-muted/60 p-3">
            <div className="flex items-center gap-2">
              <Silian_UsersIcon className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">
                {Silian_t('admin.users.selectedCount',  { count: Silian_selectedUsers.length })}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Silian_Button
                variant="outline"
                size="sm"
                onClick={() => Silian_openBulkBadgeDialog(Silian_selectedUsers)}
                disabled={Silian_badgesQuery.isLoading || Silian_badgeOptions.length === 0}
              >
                <Silian_Sparkles className="h-4 w-4 mr-2" />
                {Silian_t('admin.users.bulkAwardBadges')}
              </Silian_Button>
              <Silian_Button variant="ghost" size="sm" onClick={Silian_clearSelection}>
                {Silian_t('common.clear')}
              </Silian_Button>
            </div>
          </div>
        )}
      </div>

      {(() => {
        if (Silian_isInitialUsersLoading) {
          return (
            <div className="flex justify-center items-center h-64">
              <Silian_Loader2 className="h-8 w-8 animate-spin text-green-500" />
            </div>
          );
        }
        if (Silian_usersQuery.error) {
          return (
            <Silian_Alert variant="destructive">
              <Silian_AlertTitle>{Silian_t('common.error')}</Silian_AlertTitle>
              <Silian_AlertDescription>{Silian_t('errors.loadFailed')}</Silian_AlertDescription>
            </Silian_Alert>
          );
        }
        if (Silian_users.length === 0) {
          return (
            <div className="rounded-lg border border-border bg-card py-16 text-center shadow-sm">
              <h3 className="text-xl font-semibold">{Silian_t('admin.users.noUsersFound')}</h3>
              <p className="text-muted-foreground mt-2">{Silian_t('admin.users.tryDifferentFilters')}</p>
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
                      <Silian_Checkbox
                        checked={Silian_allSelectedOnPage ? true : Silian_partiallySelected ? 'indeterminate' : false}
                        onCheckedChange={(Silian_checked) => Silian_handleSelectAllOnPage(Silian_checked === true || Silian_checked === 'indeterminate')}
                        aria-label={Silian_t('admin.users.selectAll')}
                        className="translate-y-0.5"
                      />
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.users.table.username')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.users.table.email')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.groups.title')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.users.table.role')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.users.table.status')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.users.table.badges')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.users.table.passkeys')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.users.table.checkins')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.users.table.carbon')}</th>
                    <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.users.table.points')}</th>
                    <th className="px-6 py-3 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.users.table.actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-card">
                  {Silian_users.map((Silian_user) => {
                    const Silian_isSelected = Silian_selectedUsersMap.has(Silian_user.id);
                    return (
                      <tr key={Silian_user.id} className={Silian_isSelected ? 'bg-emerald-50/40 dark:bg-emerald-950/30' : 'hover:bg-muted/40'}>
                        <td className="px-4 py-3">
                          <Silian_Checkbox
                            checked={Silian_isSelected}
                            onCheckedChange={(Silian_checked) => Silian_toggleUserSelection(Silian_user, Silian_checked === true || Silian_checked === 'indeterminate')}
                            aria-label={Silian_t('admin.users.selectUser',  { username: Silian_user.username })}
                          />
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-foreground">{Silian_user.username}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{Silian_user.email}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{Silian_user.group_name || '-'}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{Silian_renderRoleBadge(Silian_user)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{Silian_renderStatusBadge(Silian_user)}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          <div className="flex flex-col">
                            <span>{Silian_t('admin.users.badgesAwardedCount',  { count: Silian_user.badges_awarded || 0 })}</span>
                            <span className="text-xs text-muted-foreground">
                              {Silian_t('admin.users.activeBadgesCount',  { count: Silian_user.active_badges || 0 })}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          <div className="flex flex-col">
                            <span>{Silian_t('admin.users.passkeyCount', { count: Silian_user.passkey_count || 0 })}</span>
                            <span className="text-xs text-muted-foreground">
                              {(Silian_user.passkey_count || 0) > 0
                                ? Silian_t('admin.users.passkeyLastUsed', {
                                    date: Silian_formatDateSafe(
                                      Silian_user.last_passkey_used_at,
                                      'yyyy-MM-dd HH:mm',
                                      Silian_t('admin.users.passkeyNeverUsed')
                                    ),
                                  })
                                : Silian_t('admin.users.passkeyNeverUsed')}
                            </span>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          <div className="flex flex-col">
                            <span>{Silian_t('admin.users.checkins.totalDaysLabel',  { count: Silian_user.checkin_days || 0 })}</span>
                            <span className="text-xs text-muted-foreground">
                              {Silian_t('admin.users.checkins.makeupDaysLabel',  { count: Silian_user.makeup_checkins || 0 })}
                            </span>
                            {Silian_user.last_checkin_date && (
                              <span className="text-xs text-muted-foreground">
                                {Silian_t('admin.users.checkins.lastDate',  { date: Silian_user.last_checkin_date })}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                          {Number(Silian_user.total_carbon_saved || 0).toLocaleString(Silian_currentLanguage, { maximumFractionDigits: 2 })}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">{Silian_user.points}</td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium space-x-1">
                          <Silian_Button variant="ghost" size="sm" onClick={() => Silian_handleToggleStatus(Silian_user)} title={Silian_t('admin.users.toggleStatusButton')}>
                            <Silian_Ban className="h-4 w-4 mr-1" />
                            {Silian_user.status === 'active' ? Silian_t('admin.users.disable') : Silian_t('admin.users.enable')}
                          </Silian_Button>
                          <Silian_Button variant="ghost" size="sm" onClick={() => Silian_openAdjustPoints(Silian_user)} title={Silian_t('admin.users.promptAdjustPoints', { username: Silian_user.username })}>
                            <Silian_PlusCircle className="h-4 w-4" />
                          </Silian_Button>
                          <Silian_Button variant="ghost" size="sm" onClick={() => Silian_openUserDetail(Silian_user)} title={Silian_t('admin.users.viewDetailsButton')}>
                            <Silian_Eye className="h-4 w-4" />
                          </Silian_Button>
                          <Silian_Button variant="ghost" size="sm" onClick={() => Silian_openDetailedEdit(Silian_user)} title={Silian_t('admin.users.editUser')}>
                            <Silian_Settings className="h-4 w-4" />
                          </Silian_Button>
                          <Silian_Button variant="ghost" size="sm" onClick={() => Silian_handleEditUser(Silian_user)} title={Silian_t('admin.users.changeRoleButton')}>
                            <Silian_Shield className="h-4 w-4" />
                          </Silian_Button>
                          <Silian_Button variant="ghost" size="sm" onClick={() => Silian_openBulkBadgeDialog([Silian_user])} title={Silian_t('admin.users.awardBadgeButton')} disabled={Silian_badgeOptions.length === 0}>
                            <Silian_Sparkles className="h-4 w-4" />
                          </Silian_Button>
                          <Silian_Button variant="ghost" size="sm" onClick={() => Silian_handleDeleteUser(Silian_user)} className="text-red-600 hover:text-red-800" title={Silian_t('admin.users.deleteButton')}>
                            <Silian_Trash2 className="h-4 w-4" />
                          </Silian_Button>
                        </td>
                      </tr>
                    );
                  })}
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
        );
      })()}

      <Silian_AlertDialog open={Silian_confirmDialog.open} onOpenChange={(Silian_open) => (!Silian_open ? Silian_closeConfirmDialog() : null)}>
        <Silian_AlertDialogContent>
          <Silian_AlertDialogHeader>
            <Silian_AlertDialogTitle>
              {Silian_confirmDialog.type === 'status' && Silian_t('admin.users.confirmToggleStatusTitle')}
              {Silian_confirmDialog.type === 'role' && Silian_t('admin.users.confirmToggleAdminTitle')}
              {Silian_confirmDialog.type === 'delete' && Silian_t('admin.users.confirmDeleteTitle')}
            </Silian_AlertDialogTitle>
            <Silian_AlertDialogDescription>
              {Silian_confirmDialog.type === 'status' && Silian_confirmDialog.user && (
                Silian_t('admin.users.confirmToggleStatus', {
                  username: Silian_confirmDialog.user.username,
                  to: Silian_confirmDialog.payload.nextStatus === 'active'
                    ? Silian_t('admin.users.statusActive')
                    : Silian_t('admin.users.statusInactive'),
                })
              )}
              {Silian_confirmDialog.type === 'role' && Silian_confirmDialog.user && (
                <div className="space-y-3">
                  <p>{Silian_t('admin.users.confirmSetRole', { username: Silian_confirmDialog.user.username })}</p>
                  <div className="space-y-2">
                    <Silian_Label htmlFor="confirm-role">{Silian_t('admin.users.roleDialogLabel')}</Silian_Label>
                    <select
                      id="confirm-role"
                      className="h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
                      value={Silian_confirmDialog.payload?.nextRole || Silian_normalizeRole(Silian_confirmDialog.user)}
                      onChange={(Silian_event) => Silian_setConfirmDialog((Silian_current) => ({
                        ...Silian_current,
                        payload: {
                          ...Silian_current.payload,
                          nextRole: Silian_event.target.value,
                        },
                      }))}
                    >
                      <option value="user">{Silian_t('admin.users.roleUser')}</option>
                      <option value="support">{Silian_t('admin.users.roleSupport')}</option>
                      <option value="admin">{Silian_t('admin.users.roleAdmin')}</option>
                    </select>
                  </div>
                </div>
              )}
              {Silian_confirmDialog.type === 'delete' && Silian_confirmDialog.user && (
                Silian_t('admin.users.confirmDelete', { username: Silian_confirmDialog.user.username })
              )}
            </Silian_AlertDialogDescription>
          </Silian_AlertDialogHeader>
          <Silian_AlertDialogFooter>
            <Silian_AlertDialogCancel onClick={Silian_closeConfirmDialog}>{Silian_t('common.cancel')}</Silian_AlertDialogCancel>
            <Silian_AlertDialogAction onClick={Silian_handleConfirmAction}>{Silian_t('common.confirm')}</Silian_AlertDialogAction>
          </Silian_AlertDialogFooter>
        </Silian_AlertDialogContent>
      </Silian_AlertDialog>

      <Silian_Dialog open={Silian_pointsDialog.open} onOpenChange={(Silian_open) => (!Silian_open ? Silian_closeAdjustPoints() : null)}>
        <Silian_DialogContent className="max-w-md">
          <Silian_DialogHeader>
            <Silian_DialogTitle>{Silian_t('admin.users.adjustPointsTitle')}</Silian_DialogTitle>
            <Silian_DialogDescription>
              {Silian_pointsDialog.user ? Silian_t('admin.users.adjustPointsDescription', { username: Silian_pointsDialog.user.username }) : ''}
            </Silian_DialogDescription>
          </Silian_DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-2">
              <Silian_Label htmlFor="points-delta">{Silian_t('admin.users.adjustPointsDelta')}</Silian_Label>
              <Silian_Input
                id="points-delta"
                type="number"
                value={Silian_pointsDialog.delta}
                onChange={(Silian_e) => Silian_setPointsDialog((Silian_prev) => ({ ...Silian_prev, delta: Silian_e.target.value }))}
                placeholder="100"
              />
              <p className="text-xs text-muted-foreground">
                {Silian_t('admin.users.adjustPointsHint')}
              </p>
            </div>
            <div className="space-y-2">
              <Silian_Label htmlFor="points-reason">{Silian_t('admin.users.adjustPointsReason')}</Silian_Label>
              <Silian_Textarea
                id="points-reason"
                rows={3}
                value={Silian_pointsDialog.reason}
                onChange={(Silian_e) => Silian_setPointsDialog((Silian_prev) => ({ ...Silian_prev, reason: Silian_e.target.value }))}
                placeholder={Silian_t('admin.users.adjustPointsReasonPlaceholder')}
              />
            </div>
          </div>
          <Silian_DialogFooter>
            <Silian_Button variant="ghost" onClick={Silian_closeAdjustPoints}>{Silian_t('common.cancel')}</Silian_Button>
            <Silian_Button onClick={Silian_handleSubmitAdjustPoints} disabled={Silian_adjustPointsMutation.isLoading}>
              {Silian_adjustPointsMutation.isLoading && <Silian_Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {Silian_t('common.confirm')}
            </Silian_Button>
          </Silian_DialogFooter>
        </Silian_DialogContent>
      </Silian_Dialog>

      <Silian_Dialog open={Silian_editDialog.open} onOpenChange={(Silian_open) => (!Silian_open ? Silian_closeDetailedEdit() : null)}>
        <Silian_DialogContent className="max-w-lg">
          <Silian_DialogHeader>
            <Silian_DialogTitle>{Silian_t('admin.users.editUser')}</Silian_DialogTitle>
            <Silian_DialogDescription>{Silian_editDialog.user?.username}</Silian_DialogDescription>
          </Silian_DialogHeader>
          <form onSubmit={Silian_handleSubmitDetailedEdit} className="space-y-4">
            <div>
              <Silian_Label>{Silian_t('admin.groups.title')}</Silian_Label>
              <select
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                value={Silian_editDialog.groupId}
                onChange={(Silian_e) => Silian_setEditDialog({ ...Silian_editDialog, groupId: Silian_e.target.value })}
              >
                <option value="">{Silian_t('common.none')}</option>
                {Silian_groups?.map(Silian_g => (
                  <option key={Silian_g.id} value={Silian_g.id}>{Silian_g.name}</option>
                ))}
              </select>
            </div>

            {/* Dynamic Quota Usage Inputs - Render inputs for each flattened quota key */}
            <div className="space-y-3 border-t pt-3 border-b pb-3">
              <Silian_Label className="text-base font-semibold">{Silian_t('admin.groups.quotaOverride')}</Silian_Label>
              {Silian_quotaKeys.length > 0 ? (
                Silian_quotaKeys.map((Silian_key) => (
                  <div key={Silian_key}>
                    <Silian_Label className="capitalize">{Silian_t(`admin.quotas.${Silian_key}`, Silian_key.replace('.', ' '))}</Silian_Label>
                    <Silian_Input
                      type="number"
                      value={Silian_editDialog.quotaFlat?.[Silian_key] ?? ''}
                      onChange={Silian_e => Silian_handleQuotaChange(Silian_key, Silian_e.target.value)}
                      placeholder={Silian_t('common.default')}
                    />
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">{Silian_t('admin.groups.noQuotasAvailable')}</p>
              )}
            </div>
            <div className="space-y-3 border-b pb-3">
              <Silian_Label className="text-base font-semibold">{Silian_t('admin.users.supportRoutingOverrideTitle')}</Silian_Label>
              <p className="text-sm text-muted-foreground">{Silian_t('admin.users.supportRoutingOverrideHint')}</p>
              {Silian_supportRoutingFields.map((Silian_field) => (
                <div key={Silian_field.key}>
                  <Silian_Label>{Silian_t(Silian_field.label_key, Silian_field.key)}</Silian_Label>
                  <Silian_Input
                    type={Silian_field.type === 'number' ? 'number' : 'text'}
                    min={Silian_field.min}
                    max={Silian_field.max}
                    step={Silian_field.step}
                    value={Silian_editDialog.supportRouting?.[Silian_field.key] ?? ''}
                    onChange={(Silian_event) => Silian_handleSupportRoutingChange(Silian_field.key, Silian_event.target.value)}
                    placeholder={Silian_t('admin.users.inheritGroupDefault')}
                  />
                </div>
              ))}
            </div>
            <div>
              <Silian_Label>{Silian_t('admin.groups.notes')}</Silian_Label>
              <Silian_Textarea
                value={Silian_editDialog.notes}
                onChange={Silian_e => Silian_setEditDialog({ ...Silian_editDialog, notes: Silian_e.target.value })}
              />
            </div>
            <Silian_DialogFooter>
              <Silian_Button type="button" variant="ghost" onClick={Silian_closeDetailedEdit}>{Silian_t('common.cancel')}</Silian_Button>
              <Silian_Button type="submit" disabled={Silian_updateUserMutation.isLoading}>{Silian_t('common.save')}</Silian_Button>
            </Silian_DialogFooter>
          </form>
        </Silian_DialogContent>
      </Silian_Dialog>

      <Silian_Dialog open={Silian_detailState.open} onOpenChange={(Silian_open) => (!Silian_open ? Silian_closeUserDetail() : null)}>
        <Silian_DialogContent className="w-[calc(100vw-1.5rem)] max-w-none overflow-hidden p-0 sm:w-[calc(100vw-3rem)] sm:max-w-6xl xl:max-w-7xl 2xl:max-w-[1440px] rounded-[1.5rem] bg-white dark:bg-[#1C1C1E] border-none shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] dark:shadow-[0_20px_60px_-15px_rgba(0,0,0,0.8)]">
          <div className="flex max-h-[calc(100dvh-2rem)] flex-col">
            <Silian_DialogHeader className="shrink-0 px-6 pt-8 pb-4 bg-white dark:bg-black/40 backdrop-blur-xl relative z-10 border-b border-transparent dark:border-white/5">
              <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-full bg-gradient-to-tr from-blue-500 to-indigo-500 text-white shadow-sm ring-4 ring-white dark:ring-[#121212]">
                <span className="text-3xl font-semibold">{Silian_detailUser?.username?.[0]?.toUpperCase() || '?'}</span>
              </div>
              <Silian_DialogTitle className="text-center text-2xl font-semibold tracking-tight text-foreground">
                {Silian_detailUser
                  ? Silian_t('admin.users.detailTitle',  { username: Silian_detailUser.username })
                  : Silian_t('admin.users.detailTitleFallback')}
              </Silian_DialogTitle>
              <Silian_DialogDescription className="text-center text-base mt-1 text-muted-foreground/80">{Silian_detailUser?.email || ''}</Silian_DialogDescription>
            </Silian_DialogHeader>
            <div className="flex-1 bg-zinc-50/80 dark:bg-black/20 overflow-y-auto px-6 pb-8 pt-6 relative isolate">
              {Silian_userOverviewQuery.isLoading ? (
                <div className="flex items-center justify-center py-12 text-sm text-muted-foreground">
                  <Silian_Loader2 className="mr-2 h-5 w-5 animate-spin" />
                  {Silian_t('common.loading')}
                </div>
              ) : Silian_userOverviewQuery.error ? (
                <p className="text-sm text-center text-destructive py-8">{Silian_t('admin.users.detailLoadFailed')}</p>
              ) : Silian_overviewData ? (
                <div className="mx-auto max-w-4xl space-y-8">

              {/* Basic Info - iOS Grouped List */}
              <div className="space-y-2">
                <h4 className="px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.users.detail.basicInformation')}</h4>
                <div className="overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 shadow-sm">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/5 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <span className="text-base font-medium text-foreground">{Silian_t('admin.users.detail.username')}</span>
                    <span className="text-base text-muted-foreground">{Silian_detailUser?.username}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/5 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <span className="text-base font-medium text-foreground">{Silian_t('admin.users.detail.role')}</span>
                    <span className="text-base text-muted-foreground">{Silian_renderRoleBadge(Silian_detailUser)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/5 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <span className="text-base font-medium text-foreground">{Silian_t('admin.users.detail.status')}</span>
                    <span className="text-base text-muted-foreground">{Silian_renderStatusBadge(Silian_detailUser)}</span>
                  </div>
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/5 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <span className="text-base font-medium text-foreground">{Silian_t('admin.users.detail.registrationDays')}</span>
                    <span className="text-base text-muted-foreground">{Silian_detailUser?.days_since_registration ?? 0}</span>
                  </div>
                  {Silian_detailUser?.lastlgn && (
                    <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/5 last:border-0 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <span className="text-base font-medium text-foreground">{Silian_t('admin.users.detail.lastLogin')}</span>
                      <span className="text-base text-muted-foreground">
                        {Silian_formatDateSafe(Silian_detailUser.lastlgn, 'yyyy-MM-dd HH:mm', '--')}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <h4 className="px-4 text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.users.detail.generalMetrics')}</h4>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
                  {Silian_metricsCards.map((Silian_card) => {
                    const Silian_Icon = Silian_card.icon;
                    return (
                      <div key={Silian_card.key} className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 p-4 shadow-sm transition-transform hover:scale-[1.02]">
                        <div className="flex items-center justify-between mb-3 text-muted-foreground">
                          <Silian_Icon className="h-5 w-5 opacity-70" />
                          <p className="text-xs font-medium uppercase tracking-wide opacity-80">{Silian_card.label}</p>
                        </div>
                        <p className="text-2xl font-bold tracking-tight text-foreground text-right mt-1">
                          {Number(Silian_card.value || 0).toLocaleString(Silian_currentLanguage, { maximumFractionDigits: 2 })}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              {Silian_checkinCards.length > 0 && (
                <div className="space-y-2">
                  <div className="px-4">
                    <h4 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">{Silian_t('admin.users.checkins.title')}</h4>
                    <p className="text-xs text-muted-foreground/80 mt-0.5">{Silian_t('admin.users.checkins.subtitle')}</p>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-4">
                    {Silian_checkinCards.map((Silian_card) => {
                      const Silian_Icon = Silian_card.icon;
                      return (
                        <div key={Silian_card.key} className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 p-4 shadow-sm transition-transform hover:scale-[1.02]">
                          <div className="flex items-center justify-between mb-3 text-muted-foreground">
                            <Silian_Icon className="h-5 w-5 opacity-70" />
                            <p className="text-xs font-medium uppercase tracking-wide opacity-80">{Silian_card.label}</p>
                          </div>
                          <p className="text-2xl font-bold tracking-tight text-foreground text-right mt-1">
                            {Number(Silian_card.value || 0).toLocaleString(Silian_currentLanguage, { maximumFractionDigits: 2 })}
                          </p>
                        </div>
                      );
                    })}
                  </div>
                  <div className="px-4 text-xs font-medium text-muted-foreground border-l-2 border-emerald-500 ml-4 py-0.5">
                    {Silian_checkinStats.active_today
                      ? Silian_t('admin.users.checkins.activeToday')
                      : Silian_t('admin.users.checkins.inactiveToday')}
                    {Silian_checkinStats.last_checkin_date || Silian_detailUser?.last_checkin_date ? (
                      <> · {Silian_t('admin.users.checkins.lastDateLong',  { date: Silian_checkinStats.last_checkin_date || Silian_detailUser?.last_checkin_date })}</>
                    ) : null}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <div className="flex items-center gap-3 px-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-500/10 text-blue-500">
                    <Silian_Fingerprint className="h-5 w-5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold tracking-tight text-foreground">{Silian_t('admin.users.security.title')}</h4>
                    <p className="text-xs text-muted-foreground">{Silian_t('admin.users.security.subtitle')}</p>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <div className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground opacity-80">{Silian_t('admin.users.security.passkeysTotal')}</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-foreground text-right">{Silian_passkeySummary.total}</p>
                  </div>
                  <div className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground opacity-80">{Silian_t('admin.users.security.backupEnabled')}</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-foreground text-right">{Silian_passkeySummary.backup_enabled}</p>
                  </div>
                  <div className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground opacity-80">{Silian_t('admin.users.security.backupEligible')}</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-foreground text-right">{Silian_passkeySummary.backup_eligible}</p>
                  </div>
                  <div className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground opacity-80">{Silian_t('admin.users.security.lastPasskeyUsed')}</p>
                    <p className="mt-3 text-sm font-semibold text-foreground text-right">
                      {Silian_formatDateSafe(Silian_passkeySummary.last_used_at, 'yyyy-MM-dd HH:mm', Silian_t('admin.users.security.neverUsed'))}
                    </p>
                  </div>
                </div>
                <div className="overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 shadow-sm">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100 dark:border-white/5">
                    <p className="text-sm font-medium text-foreground">
                      {Silian_securityActivityExpanded
                        ? Silian_t('admin.users.security.expandedHint')
                        : Silian_t('admin.users.security.previewHint')}
                    </p>
                    <Silian_Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-8 rounded-xl px-3 hover:bg-zinc-100 dark:hover:bg-zinc-800 text-blue-600 font-medium"
                      onClick={() => {
                        Silian_setSecurityActivityExpanded((Silian_prev) => !Silian_prev);
                        Silian_setSecurityActivityPage(1);
                      }}
                    >
                      {Silian_securityActivityExpanded ? Silian_t('admin.users.security.collapse') : Silian_t('admin.users.security.expand')}
                      {Silian_securityActivityExpanded ? <Silian_ChevronUp className="ml-1.5 h-4 w-4" /> : <Silian_ChevronDown className="ml-1.5 h-4 w-4" />}
                    </Silian_Button>
                  </div>
                  <div className="p-4">
                  {Silian_securityActivityExpanded && (
                    <div className="grid gap-3 sm:grid-cols-2 mb-4">
                      <label className="space-y-1.5 text-sm">
                        <span className="font-medium px-1 text-muted-foreground">{Silian_t('securityActivity.filters.typeLabel')}</span>
                        <div className="relative">
                          <select
                            value={Silian_securityActivityFilters.type}
                            onChange={(Silian_event) => Silian_handleSecurityActivityFilterChange('type', Silian_event.target.value)}
                            className="h-10 w-full appearance-none rounded-xl border-none bg-zinc-50 dark:bg-white/10 px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-blue-500/20"
                          >
                            {Silian_securityActivityTypeOptions.map((Silian_option) => (
                              <option key={Silian_option.value} value={Silian_option.value}>
                                {Silian_option.label}
                              </option>
                            ))}
                          </select>
                          <Silian_ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                      </label>
                      <label className="space-y-1.5 text-sm">
                        <span className="font-medium px-1 text-muted-foreground">{Silian_t('securityActivity.filters.periodLabel')}</span>
                        <div className="relative">
                          <select
                            value={Silian_securityActivityFilters.period}
                            onChange={(Silian_event) => Silian_handleSecurityActivityFilterChange('period', Silian_event.target.value)}
                            className="h-10 w-full appearance-none rounded-xl border-none bg-zinc-50 dark:bg-white/10 px-4 py-2 pr-8 text-sm focus:ring-2 focus:ring-blue-500/20"
                          >
                            {Silian_securityActivityPeriodOptions.map((Silian_option) => (
                              <option key={Silian_option.value} value={Silian_option.value}>
                                {Silian_option.label}
                              </option>
                            ))}
                          </select>
                          <Silian_ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                        </div>
                      </label>
                    </div>
                  )}
                  {Silian_userSecurityActivityQuery.isError ? (
                    <Silian_Alert variant="destructive" className="rounded-xl mb-4 border-red-500/20 bg-red-500/10">
                      <Silian_AlertTitle>{Silian_t('common.error')}</Silian_AlertTitle>
                      <Silian_AlertDescription>{Silian_t('securityActivity.loadError')}</Silian_AlertDescription>
                    </Silian_Alert>
                  ) : null}
                  <div className="rounded-xl border border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-white/10/30 overflow-hidden">
                    <Silian_SecurityActivityList
                      items={Silian_recentSecurityActivity}
                      compact
                      isLoading={Silian_userSecurityActivityQuery.isLoading}
                      emptyText={Silian_t('admin.users.security.empty')}
                    />
                  </div>
                  {Silian_securityActivityExpanded && !Silian_userSecurityActivityQuery.isError ? (
                    <div className="mt-4 flex justify-center">
                      <Silian_Pagination
                        currentPage={Silian_securityActivityPagination.current_page}
                        totalPages={Silian_securityActivityPagination.total_pages}
                        onPageChange={Silian_setSecurityActivityPage}
                        itemsPerPage={Silian_securityActivityPagination.per_page}
                        totalItems={Silian_securityActivityPagination.total_items}
                      />
                    </div>
                  ) : null}
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4">
                  <div>
                    <h4 className="text-sm font-semibold tracking-tight text-foreground">{Silian_t('admin.users.badgeSummary')}</h4>
                    <p className="text-xs text-muted-foreground">{Silian_t('admin.users.badgeSummaryHint')}</p>
                  </div>
                  <div className="flex items-center justify-end gap-2 text-sm bg-white dark:bg-[#2C2C2E] rounded-full px-3 py-1.5 border border-zinc-100 dark:border-white/5 shadow-sm">
                    <span className="font-medium text-muted-foreground">{Silian_t('admin.users.showRevokedBadges')}</span>
                    <Silian_Switch checked={Silian_showRevokedBadges} onCheckedChange={(Silian_checked) => Silian_setShowRevokedBadges(Boolean(Silian_checked))} className="data-[state=checked]:bg-blue-500" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-4">
                  <div className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground opacity-80">{Silian_t('admin.users.badgesAwarded')}</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-foreground text-right">{Silian_badgeSummary.awarded}</p>
                  </div>
                  <div className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground opacity-80">{Silian_t('admin.users.badgesRevoked')}</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-foreground text-right">{Silian_badgeSummary.revoked}</p>
                  </div>
                  <div className="flex flex-col justify-between overflow-hidden rounded-2xl bg-white dark:bg-[#2C2C2E] border border-zinc-100 dark:border-white/5 p-4 shadow-sm">
                    <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground opacity-80">{Silian_t('admin.users.badgesTotal')}</p>
                    <p className="mt-3 text-3xl font-bold tracking-tight text-foreground text-right">{Silian_badgeSummary.total}</p>
                  </div>
                </div>

                {Silian_userBadgesQuery.isLoading ? (
                  <div className="flex items-center justify-center py-6 text-sm text-muted-foreground">
                    <Silian_Loader2 className="mr-2 h-5 w-5 animate-spin" />
                    {Silian_t('common.loading')}
                  </div>
                ) : Silian_userBadgesQuery.error ? (
                  <p className="text-sm text-destructive px-4">{Silian_t('admin.users.badgesLoadFailed')}</p>
                ) : Silian_badgeRows.length > 0 ? (
                  <div className="overflow-hidden rounded-2xl border border-zinc-100 dark:border-white/5 bg-white dark:bg-[#2C2C2E] shadow-sm">
                    <table className="min-w-full divide-y divide-zinc-100 dark:divide-zinc-800 text-sm">
                      <thead className="bg-zinc-50/50 dark:bg-white/10/30">
                        <tr>
                          <th className="px-6 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">{Silian_t('admin.users.badgeTable.badge')}</th>
                          <th className="px-6 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">{Silian_t('admin.users.badgeTable.status')}</th>
                          <th className="px-6 py-3 text-left font-medium text-muted-foreground text-xs uppercase tracking-wide">{Silian_t('admin.users.badgeTable.awardedAt')}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                        {Silian_badgeRows.map((Silian_entry, Silian_index) => {
                          const Silian_badge = Silian_entry.badge || {};
                          const Silian_record = Silian_entry.user_badge || {};
                          const Silian_badgeImage = Silian_resolveR2ImageSource({
                            urlCandidates: [Silian_badge.icon_url, Silian_badge.icon_presigned_url],
                            pathCandidates: [Silian_badge.icon_path],
                          });
                          return (
                            <tr key={Silian_index} className="transition-colors hover:bg-zinc-50 dark:hover:bg-zinc-800/50">
                              <td className="px-6 py-3">
                                <div className="flex items-center gap-4">
                                  <div className="h-10 w-10 overflow-hidden rounded-xl border border-zinc-100 dark:border-white/5 bg-white shadow-[0_2px_10px_-2px_rgba(0,0,0,0.05)] dark:bg-white/10">
                                    {Silian_badgeImage.src || Silian_badgeImage.filePath ? (
                                      <Silian_R2Image
                                        src={Silian_badgeImage.src || undefined}
                                        filePath={Silian_badgeImage.filePath || undefined}
                                        alt={Silian_badge.name_zh || Silian_badge.name_en}
                                        className="h-full w-full object-cover"
                                      />
                                    ) : (
                                      <Silian_Award className="h-5 w-5 text-muted-foreground m-auto mt-2.5" />
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-semibold text-foreground tracking-tight">{Silian_badge.name_zh || Silian_badge.name_en || '-'}</p>
                                    {Silian_badge.name_en && <p className="text-xs text-muted-foreground">{Silian_badge.name_en}</p>}
                                  </div>
                                </div>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap">
                                <Silian_Badge variant={Silian_record.status === 'awarded' ? 'success' : 'secondary'} className="rounded-full px-2.5 font-medium">{Silian_record.status === 'awarded' ? Silian_t('admin.users.badgeStatusAwarded') : Silian_t('admin.users.badgeStatusRevoked')}</Silian_Badge>
                              </td>
                              <td className="px-6 py-3 whitespace-nowrap text-sm text-muted-foreground font-medium">
                                {Silian_formatDateSafe(Silian_record.awarded_at, 'yyyy-MM-dd HH:mm', '--')}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground px-4 py-4">{Silian_t('admin.users.badgesEmpty')}</p>
                )}
              </div>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{Silian_t('admin.users.detailEmpty')}</p>
              )}
            </div>
          </div>
        </Silian_DialogContent>
      </Silian_Dialog>

      <Silian_BadgeBulkAwardDialog
        open={Silian_bulkDialog.open}
        onOpenChange={(Silian_open) => (!Silian_open ? Silian_setBulkDialog({ open: false, presetUsers: [] }) : null)}
        badges={Silian_badgeOptions}
        defaultSelectedBadgeIds={[]}
        presetUsers={Silian_bulkDialog.presetUsers}
        onCompleted={() => {
          Silian_setBulkDialog({ open: false, presetUsers: [] });
          Silian_queryClient.invalidateQueries('adminUsers');
        }}
        mode="award"
      />
    </div>
  );
}
