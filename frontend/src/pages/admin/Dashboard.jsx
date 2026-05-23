import Silian_React, { useCallback as Silian_useCallback, useMemo as Silian_useMemo, useState as Silian_useState } from 'react';
import { useNavigate as Silian_useNavigate } from 'react-router-dom';
import { useQuery as Silian_useQuery } from 'react-query';
import { adminAPI as Silian_adminAPI } from '../../lib/api';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../../components/ui/Card';
import { Button as Silian_Button } from '../../components/ui/Button';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription, AlertTitle as Silian_AlertTitle } from '../../components/ui/Alert';
import {
  Loader2 as Silian_Loader2,
  AlertCircle as Silian_AlertCircle,
  RefreshCw as Silian_RefreshCw,
  LineChart as Silian_LineChartIcon,
  Clock as Silian_Clock,
  Users as Silian_Users,
  Leaf as Silian_Leaf,
  Activity as Silian_Activity,
  Package as Silian_Package,
  MessageSquare as Silian_MessageSquare,
  TrendingUp as Silian_TrendingUp,
  ArrowUpRight as Silian_ArrowUpRight,
  ArrowDownRight as Silian_ArrowDownRight,
  Sparkles as Silian_Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer as Silian_ResponsiveContainer,
  ComposedChart as Silian_ComposedChart,
  Bar as Silian_Bar,
  XAxis as Silian_XAxis,
  YAxis as Silian_YAxis,
  CartesianGrid as Silian_CartesianGrid,
  Tooltip as Silian_Tooltip,
  Legend as Silian_Legend,
  Line as Silian_Line,
  Area as Silian_Area,
  PieChart as Silian_PieChart,
  Pie as Silian_Pie,
  Cell as Silian_Cell,
} from 'recharts';

const Silian_CHART_COLORS = [
  '#3b82f6', // 蓝色
  '#10b981', // 绿色
  '#8b5cf6', // 紫色
  '#f59e0b', // 橙色
  '#ec4899', // 粉色
  '#14b8a6', // 青色
  '#f97316', // 深橙
  '#06b6d4', // 天蓝
];

const Silian_CHART_GRADIENTS = [
  { start: '#60a5fa', end: '#3b82f6' }, // 蓝色渐变
  { start: '#34d399', end: '#10b981' }, // 绿色渐变
  { start: '#a78bfa', end: '#8b5cf6' }, // 紫色渐变
  { start: '#fbbf24', end: '#f59e0b' }, // 橙色渐变
  { start: '#f472b6', end: '#ec4899' }, // 粉色渐变
  { start: '#2dd4bf', end: '#14b8a6' }, // 青色渐变
  { start: '#fb923c', end: '#f97316' }, // 深橙渐变
  { start: '#22d3ee', end: '#06b6d4' }, // 天蓝渐变
];

const Silian_safeNumber = (Silian_value) => {
  if (Silian_value === null || Silian_value === undefined) {
    return 0;
  }
  const Silian_numeric = Number(Silian_value);
  return Number.isFinite(Silian_numeric) ? Silian_numeric : 0;
};

const Silian_safeDivide = (Silian_numerator, Silian_denominator) => {
  if (!Silian_denominator || Number.isNaN(Silian_denominator)) {
    return 0;
  }
  return Silian_numerator / Silian_denominator;
};

export default function AdminDashboardPage() {
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['activities', 'admin', 'common', 'dashboard', 'date', 'errors', 'messages', 'units']);
  const Silian_isEnglish = (Silian_currentLanguage || '').toLowerCase().startsWith('en');
  const Silian_navigate = Silian_useNavigate();
  const [Silian_autoRefresh, Silian_setAutoRefresh] = Silian_useState(true);
  const [Silian_lastUpdated, Silian_setLastUpdated] = Silian_useState(null);
  const Silian_refreshIntervalMs = 30000;

  const Silian_statsQuery = Silian_useQuery(
    ['adminStats'],
    async () => {
      const Silian_res = await Silian_adminAPI.getStats();
      return Silian_res.data?.data || {};
    },
    {
      staleTime: 15000,
      refetchOnWindowFocus: false,
      refetchInterval: Silian_autoRefresh ? Silian_refreshIntervalMs : false,
      keepPreviousData: true,
      onSuccess: (Silian_data) => {
        if (Silian_data?.generated_at) {
          const Silian_generated = new Date(Silian_data.generated_at);
          if (!Number.isNaN(Silian_generated.getTime())) {
            Silian_setLastUpdated(Silian_generated);
            return;
          }
        }
        Silian_setLastUpdated(new Date());
      },
    }
  );

  const Silian_isLoading = Silian_statsQuery.isLoading;
  const Silian_isError = Silian_statsQuery.isError;
  const Silian_error = Silian_statsQuery.error;
  const Silian_refetch = Silian_statsQuery.refetch;
  const Silian_isFetching = Silian_statsQuery.isFetching;

  const Silian_integerFormatter = Silian_useMemo(() => new Intl.NumberFormat(Silian_currentLanguage), [Silian_currentLanguage]);
  const Silian_decimalFormatter = Silian_useMemo(() => new Intl.NumberFormat(Silian_currentLanguage, { maximumFractionDigits: 2 }), [Silian_currentLanguage]);
  const Silian_percentFormatter = Silian_useMemo(() => new Intl.NumberFormat(Silian_currentLanguage, { style: 'percent', maximumFractionDigits: 1 }), [Silian_currentLanguage]);
  const Silian_shortDateFormatter = Silian_useMemo(() => new Intl.DateTimeFormat(Silian_currentLanguage, { month: 'short', day: 'numeric' }), [Silian_currentLanguage]);
  const Silian_longDateFormatter = Silian_useMemo(() => new Intl.DateTimeFormat(Silian_currentLanguage, { year: 'numeric', month: 'short', day: 'numeric' }), [Silian_currentLanguage]);

  const Silian_formatDateLabel = (Silian_value, Silian_formatter) => {
    if (!Silian_value) {
      return Silian_value;
    }
    const Silian_date = new Date(`${Silian_value}T00:00:00`);
    if (Number.isNaN(Silian_date.getTime())) {
      return Silian_value;
    }
    return Silian_formatter.format(Silian_date);
  };
  const Silian_formatDateTime = (Silian_value) => {
    if (!Silian_value) {
      return '--';
    }
    const Silian_date = new Date(Silian_value);
    if (Number.isNaN(Silian_date.getTime())) {
      return Silian_value;
    }
    return Silian_date.toLocaleString(Silian_currentLanguage);
  };


  const Silian_normalizedStats = Silian_useMemo(() => {
    const Silian_base = Silian_statsQuery.data ?? {};
    const Silian_users = {
      total: Silian_safeNumber(Silian_base.users?.total_users),
      active: Silian_safeNumber(Silian_base.users?.active_users),
      inactive: Silian_safeNumber(Silian_base.users?.inactive_users),
      new30d: Silian_safeNumber(Silian_base.users?.new_users_30d),
      activeRatio: Number(Silian_base.users?.active_ratio ?? Silian_safeDivide(Silian_safeNumber(Silian_base.users?.active_users), Silian_safeNumber(Silian_base.users?.total_users))),
      newUsersRatio: Number(Silian_base.users?.new_users_ratio ?? Silian_safeDivide(Silian_safeNumber(Silian_base.users?.new_users_30d), Silian_safeNumber(Silian_base.users?.total_users))),
    };

    const Silian_transactions = {
      total: Silian_safeNumber(Silian_base.transactions?.total_transactions),
      pending: Silian_safeNumber(Silian_base.transactions?.pending_transactions),
      approved: Silian_safeNumber(Silian_base.transactions?.approved_transactions),
      rejected: Silian_safeNumber(Silian_base.transactions?.rejected_transactions),
      totalPointsAwarded: Number(Silian_base.transactions?.total_points_awarded ?? 0),
      totalCarbonSaved: Number(Silian_base.transactions?.total_carbon_saved ?? Silian_base.carbon?.total_carbon_saved ?? 0),
      approvalRate: Number(Silian_base.transactions?.approval_rate ?? Silian_safeDivide(Silian_safeNumber(Silian_base.transactions?.approved_transactions), Silian_safeNumber(Silian_base.transactions?.total_transactions))),
      pendingRatio: Number(Silian_base.transactions?.pending_ratio ?? Silian_safeDivide(Silian_safeNumber(Silian_base.transactions?.pending_transactions), Silian_safeNumber(Silian_base.transactions?.total_transactions))),
      avgPointsPerTransaction: Number(Silian_base.transactions?.avg_points_per_transaction ?? 0),
      last7Transactions: Silian_safeNumber(Silian_base.transactions?.last7_transactions),
      last7PointsAwarded: Number(Silian_base.transactions?.last7_points_awarded ?? 0),
    };

    const Silian_exchanges = {
      total: Silian_safeNumber(Silian_base.exchanges?.total_exchanges),
      pending: Silian_safeNumber(Silian_base.exchanges?.pending_exchanges),
      completed: Silian_safeNumber(Silian_base.exchanges?.completed_exchanges),
      other: Silian_safeNumber(Silian_base.exchanges?.other_exchanges),
      totalPointsSpent: Number(Silian_base.exchanges?.total_points_spent ?? 0),
      completionRate: Number(Silian_base.exchanges?.completion_rate ?? Silian_safeDivide(Silian_safeNumber(Silian_base.exchanges?.completed_exchanges), Silian_safeNumber(Silian_base.exchanges?.total_exchanges))),
    };

    const Silian_messages = {
      total: Silian_safeNumber(Silian_base.messages?.total_messages),
      unread: Silian_safeNumber(Silian_base.messages?.unread_messages),
      read: Silian_safeNumber(Silian_base.messages?.read_messages ?? (Silian_safeNumber(Silian_base.messages?.total_messages) - Silian_safeNumber(Silian_base.messages?.unread_messages))),
      unreadRatio: Number(Silian_base.messages?.unread_ratio ?? Silian_safeDivide(Silian_safeNumber(Silian_base.messages?.unread_messages), Silian_safeNumber(Silian_base.messages?.total_messages))),
    };

    const Silian_activities = {
      totalRecords: Silian_safeNumber(Silian_base.activities?.total_records),
      approvedRecords: Silian_safeNumber(Silian_base.activities?.approved_records),
      pendingRecords: Silian_safeNumber(Silian_base.activities?.pending_records),
      rejectedRecords: Silian_safeNumber(Silian_base.activities?.rejected_records),
      catalogTotal: Silian_safeNumber(Silian_base.activities?.total_activities),
      catalogActive: Silian_safeNumber(Silian_base.activities?.active_activities),
      catalogInactive: Silian_safeNumber(Silian_base.activities?.inactive_activities ?? (Silian_safeNumber(Silian_base.activities?.total_activities) - Silian_safeNumber(Silian_base.activities?.active_activities))),
    };

    const Silian_carbon = {
      totalRecords: Silian_safeNumber(Silian_base.carbon?.total_records),
      pendingRecords: Silian_safeNumber(Silian_base.carbon?.pending_records),
      approvedRecords: Silian_safeNumber(Silian_base.carbon?.approved_records),
      rejectedRecords: Silian_safeNumber(Silian_base.carbon?.rejected_records),
      totalCarbonSaved: Number(Silian_base.carbon?.total_carbon_saved ?? 0),
      totalPointsEarned: Number(Silian_base.carbon?.total_points_earned ?? 0),
      last7CarbonSaved: Number(Silian_base.carbon?.last7_carbon_saved ?? 0),
      last7PointsEarned: Number(Silian_base.carbon?.last7_points_earned ?? 0),
      averageCarbonPerRecord: Number(Silian_base.carbon?.average_carbon_per_record ?? 0),
      averageDailyCarbon: Number(Silian_base.carbon?.average_daily_carbon ?? 0),
      approvalRate: Number(Silian_base.carbon?.approval_rate ?? Silian_safeDivide(Silian_safeNumber(Silian_base.carbon?.approved_records), Silian_safeNumber(Silian_base.carbon?.total_records))),
    };

    const Silian_trends = Array.isArray(Silian_base.trends)
      ? Silian_base.trends.map((Silian_item) => ({
          date: Silian_item?.date ?? '',
          transactions: Silian_safeNumber(Silian_item?.transactions),
          carbon_saved: Silian_safeNumber(Silian_item?.carbon_saved),
          points_awarded: Number(Silian_item?.points_awarded ?? 0),
          approved_records: Silian_safeNumber(Silian_item?.approved_records),
        }))
      : [];

    const Silian_trendSummary = {
      carbonLast7: Number(Silian_base.trend_summary?.carbon_last7 ?? 0),
      carbonPrev7: Number(Silian_base.trend_summary?.carbon_prev7 ?? 0),
      carbonDelta: Number(Silian_base.trend_summary?.carbon_delta ?? 0),
      carbonDeltaRate: Number(Silian_base.trend_summary?.carbon_delta_rate ?? 0),
      transactionsLast7: Silian_safeNumber(Silian_base.trend_summary?.transactions_last7),
      pointsLast7: Number(Silian_base.trend_summary?.points_last7 ?? 0),
      averageDailyCarbon30d: Number(Silian_base.trend_summary?.average_daily_carbon_30d ?? 0),
    };

    const Silian_recent = {
      pendingTransactions: Array.isArray(Silian_base.recent?.pending_transactions) ? Silian_base.recent.pending_transactions : [],
      pendingCarbonRecords: Array.isArray(Silian_base.recent?.pending_carbon_records) ? Silian_base.recent.pending_carbon_records : [],
      latestUsers: Array.isArray(Silian_base.recent?.latest_users) ? Silian_base.recent.latest_users : [],
    };

    return { users: Silian_users, transactions: Silian_transactions, exchanges: Silian_exchanges, messages: Silian_messages, activities: Silian_activities, carbon: Silian_carbon, trends: Silian_trends, trendSummary: Silian_trendSummary, recent: Silian_recent };
  }, [Silian_statsQuery.data]);


  const Silian_trendChartData = Silian_useMemo(() => {
    const Silian_entries = Silian_normalizedStats.trends;
    if (!Silian_entries.length) {
      return [];
    }
    return Silian_entries.map((Silian_entry, Silian_index, Silian_array) => {
      const Silian_start = Math.max(0, Silian_index - 6);
      const Silian_window = Silian_array.slice(Silian_start, Silian_index + 1);
      const Silian_carbonAvg = Silian_safeDivide(Silian_window.reduce((Silian_sum, Silian_item) => Silian_sum + Silian_item.carbon_saved, 0), Silian_window.length || 1);
      const Silian_transactionAvg = Silian_safeDivide(Silian_window.reduce((Silian_sum, Silian_item) => Silian_sum + Silian_item.transactions, 0), Silian_window.length || 1);
      return {
        ...Silian_entry,
        carbon_avg: Silian_carbonAvg,
        transactions_avg: Silian_transactionAvg,
      };
    });
  }, [Silian_normalizedStats.trends]);

  const Silian_trendSummary = Silian_normalizedStats.trendSummary;
  const Silian_carbonStats = Silian_normalizedStats.carbon;
  const Silian_recent = Silian_normalizedStats.recent;


  const Silian_transactionStatusData = Silian_useMemo(() => {
    const { pending: Silian_pending, approved: Silian_approved, rejected: Silian_rejected, total: Silian_total } = Silian_normalizedStats.transactions;
    const Silian_other = Math.max(Silian_total - (Silian_pending + Silian_approved + Silian_rejected), 0);
    const Silian_data = [
      { label: Silian_t('admin.dashboard.statusPending'), value: Silian_pending },
      { label: Silian_t('admin.dashboard.statusApproved'), value: Silian_approved },
      { label: Silian_t('admin.dashboard.statusRejected'), value: Silian_rejected },
    ];
    if (Silian_other > 0) {
      Silian_data.push({ label: Silian_t('admin.dashboard.statusOther'), value: Silian_other });
    }
    return Silian_data;
  }, [Silian_normalizedStats.transactions, Silian_t]);

  const Silian_exchangeStatusData = Silian_useMemo(() => {
    const { pending: Silian_pending, completed: Silian_completed, total: Silian_total } = Silian_normalizedStats.exchanges;
    const Silian_other = Math.max(Silian_total - (Silian_pending + Silian_completed), 0);
    const Silian_data = [
      { label: Silian_t('admin.dashboard.statusPending'), value: Silian_pending },
      { label: Silian_t('admin.dashboard.statusCompleted'), value: Silian_completed },
    ];
    if (Silian_other > 0) {
      Silian_data.push({ label: Silian_t('admin.dashboard.statusOther'), value: Silian_other });
    }
    return Silian_data;
  }, [Silian_normalizedStats.exchanges, Silian_t]);

  const Silian_userStatusData = Silian_useMemo(() => {
    const { active: Silian_active, inactive: Silian_inactive, total: Silian_total } = Silian_normalizedStats.users;
    const Silian_other = Math.max(Silian_total - (Silian_active + Silian_inactive), 0);
    const Silian_data = [
      { label: Silian_t('admin.dashboard.statusActive'), value: Silian_active },
      { label: Silian_t('admin.dashboard.statusInactive'), value: Silian_inactive },
    ];
    if (Silian_other > 0) {
      Silian_data.push({ label: Silian_t('admin.dashboard.statusOther'), value: Silian_other });
    }
    return Silian_data;
  }, [Silian_normalizedStats.users, Silian_t]);

  const Silian_messageStatusData = Silian_useMemo(() => ([
    { label: Silian_t('admin.dashboard.unreadMessages'), value: Silian_normalizedStats.messages.unread },
    { label: Silian_t('admin.dashboard.readMessages'), value: Silian_normalizedStats.messages.read },
  ]), [Silian_normalizedStats.messages, Silian_t]);

  const Silian_miniStats = Silian_useMemo(() => {
    const { users: Silian_users, transactions: Silian_transactions, carbon: Silian_carbon, trendSummary: Silian_trendSummary } = Silian_normalizedStats;
    const Silian_activeRatioValue = Silian_users.activeRatio ?? Silian_safeDivide(Silian_users.active, Silian_users.total);
    const Silian_avgPointsValue = Silian_transactions.avgPointsPerTransaction;
    const Silian_pointsLast7Value = Silian_transactions.last7PointsAwarded ?? 0;
    const Silian_pendingCarbonValue = Silian_carbon.pendingRecords ?? 0;
    const Silian_avgDailyCarbonValue = Silian_trendSummary.averageDailyCarbon30d ?? 0;

    const Silian_formatPercentValue = (Silian_value) => {
      if (Silian_value === null || Silian_value === undefined) {
        return '--';
      }
      const Silian_numeric = Number(Silian_value);
      return Number.isFinite(Silian_numeric) ? Silian_percentFormatter.format(Silian_numeric) : '--';
    };

    const Silian_formatDecimalValue = (Silian_value, Silian_unit = '') => {
      if (Silian_value === null || Silian_value === undefined) {
        return '--';
      }
      const Silian_numeric = Number(Silian_value);
      if (!Number.isFinite(Silian_numeric)) {
        return '--';
      }
      return `${Silian_decimalFormatter.format(Silian_numeric)}${Silian_unit}`.trim();
    };

    return [
      {
        key: 'activeRatio',
        label: Silian_t('admin.dashboard.mini.activeRatio'),
        value: Silian_formatPercentValue(Silian_activeRatioValue),
      },
      {
        key: 'avgPoints',
        label: Silian_t('admin.dashboard.mini.avgPointsPerTransaction'),
        value: Silian_formatDecimalValue(Silian_avgPointsValue, ` ${Silian_t('units.points')}`),
      },
      {
        key: 'pointsLast7',
        label: Silian_t('admin.dashboard.mini.pointsLast7'),
        value: Silian_formatDecimalValue(Silian_pointsLast7Value, ` ${Silian_t('units.points')}`),
      },
      {
        key: 'pendingCarbon',
        label: Silian_t('admin.dashboard.mini.pendingCarbonRecords'),
        value: Silian_integerFormatter.format(Math.max(0, Silian_pendingCarbonValue)),
      },
      {
        key: 'avgDailyCarbon',
        label: Silian_t('admin.dashboard.mini.averageDailyCarbon30d'),
        value: Silian_formatDecimalValue(Silian_avgDailyCarbonValue, ` ${Silian_t('units.kg')}`),
      },
    ];
  }, [Silian_normalizedStats, Silian_t, Silian_percentFormatter, Silian_decimalFormatter, Silian_integerFormatter]);

  const Silian_insights = Silian_useMemo(() => {
    const { users: Silian_users, transactions: Silian_transactions, exchanges: Silian_exchanges, messages: Silian_messages, carbon: Silian_carbon, trendSummary: Silian_trendSummary } = Silian_normalizedStats;

    const Silian_approvalRate = Number.isFinite(Silian_transactions.approvalRate)
      ? Silian_transactions.approvalRate
      : Silian_safeDivide(Silian_transactions.approved, Silian_transactions.total);
    const Silian_carbonPerUser = Silian_users.active > 0 ? Silian_carbon.totalCarbonSaved / Silian_users.active : 0;
    const Silian_unreadRate = Number.isFinite(Silian_messages.unreadRatio)
      ? Silian_messages.unreadRatio
      : Silian_safeDivide(Silian_messages.unread, Silian_messages.total);
    const Silian_pointsRedemptionRate = Silian_transactions.totalPointsAwarded > 0
      ? Silian_exchanges.totalPointsSpent / Silian_transactions.totalPointsAwarded
      : 0;
    const Silian_transactionsPerActiveUser = Silian_users.active > 0 ? Silian_transactions.total / Silian_users.active : 0;

    const Silian_weeklyDeltaText =
      Silian_trendSummary.carbonPrev7 > 0 || Silian_trendSummary.carbonLast7 > 0
        ? Silian_trendSummary.carbonDelta >= 0
          ? Silian_t('admin.dashboard.insights.carbonLast7DaysDeltaPositive', {
              delta: Silian_decimalFormatter.format(Silian_trendSummary.carbonDelta),
              rate: Silian_percentFormatter.format(Math.abs(Silian_trendSummary.carbonDeltaRate)),
            })
          : Silian_t('admin.dashboard.insights.carbonLast7DaysDeltaNegative', {
              delta: Silian_decimalFormatter.format(Math.abs(Silian_trendSummary.carbonDelta)),
              rate: Silian_percentFormatter.format(Math.abs(Silian_trendSummary.carbonDeltaRate)),
            })
        : Silian_t('admin.dashboard.noData');

    return [
      {
        key: 'approval',
        label: Silian_t('admin.dashboard.insights.approvalRate'),
        value: Silian_percentFormatter.format(Silian_approvalRate),
        description: Silian_t('admin.dashboard.insights.approvalRateHint', {
          approved: Silian_integerFormatter.format(Silian_transactions.approved),
          total: Silian_integerFormatter.format(Silian_transactions.total),
        }),
      },
      {
        key: 'carbonPerUser',
        label: Silian_t('admin.dashboard.insights.carbonPerUser'),
        value: `${Silian_decimalFormatter.format(Silian_carbonPerUser)} ${Silian_t('units.kg')}`,
        description: Silian_t('admin.dashboard.insights.carbonPerUserHint', {
          active: Silian_integerFormatter.format(Silian_users.active),
        }),
      },
      {
        key: 'weeklyCarbon',
        label: Silian_t('admin.dashboard.insights.carbonLast7Days'),
        value: `${Silian_decimalFormatter.format(Silian_trendSummary.carbonLast7)} ${Silian_t('units.kg')}`,
        description: Silian_weeklyDeltaText,
      },
      {
        key: 'unreadRate',
        label: Silian_t('admin.dashboard.insights.unreadRate'),
        value: Silian_percentFormatter.format(Silian_unreadRate),
        description: Silian_t('admin.dashboard.insights.unreadRateHint', {
          unread: Silian_integerFormatter.format(Silian_messages.unread),
          total: Silian_integerFormatter.format(Silian_messages.total),
        }),
      },
      {
        key: 'pointsRedemption',
        label: Silian_t('admin.dashboard.insights.pointsRedemption'),
        value: Silian_percentFormatter.format(Silian_pointsRedemptionRate),
        description: Silian_t('admin.dashboard.insights.pointsRedemptionHint', {
          spent: Silian_integerFormatter.format(Silian_exchanges.totalPointsSpent),
          awarded: Silian_integerFormatter.format(Silian_transactions.totalPointsAwarded),
        }),
      },
      {
        key: 'transactionsPerUser',
        label: Silian_t('admin.dashboard.insights.transactionsPerUser'),
        value: Silian_decimalFormatter.format(Silian_transactionsPerActiveUser),
        description: Silian_t('admin.dashboard.insights.transactionsPerUserHint', {
          active: Silian_integerFormatter.format(Silian_users.active),
        }),
      },
      {
        key: 'dailyCarbon',
        label: Silian_t('admin.dashboard.insights.averageDailyCarbon'),
        value: `${Silian_decimalFormatter.format(Silian_carbon.averageDailyCarbon)} ${Silian_t('units.kg')}`,
        description: Silian_t('admin.dashboard.insights.averageDailyCarbonHint', {
          records: Silian_integerFormatter.format(Silian_carbon.totalRecords),
        }),
      },
    ];
  }, [Silian_normalizedStats, Silian_t, Silian_integerFormatter, Silian_decimalFormatter, Silian_percentFormatter]);

  const Silian_topCarbonDays = Silian_useMemo(() => {
    if (!Silian_normalizedStats.trends.length) {
      return [];
    }
    return [...Silian_normalizedStats.trends]
      .sort((Silian_a, Silian_b) => Silian_b.carbon_saved - Silian_a.carbon_saved)
      .slice(0, 5);
  }, [Silian_normalizedStats.trends]);

  const Silian_openAdminExchangeDetail = Silian_useCallback((Silian_exchange) => {
    if (!Silian_exchange?.id) {
      Silian_navigate('/admin/exchanges');
      return;
    }
    Silian_navigate('/admin/exchanges', {
      state: {
        selectedExchange: Silian_exchange,
      },
    });
  }, [Silian_navigate]);

  const Silian_openAdminActivityReviewDetail = Silian_useCallback((Silian_activity) => {
    if (!Silian_activity?.id) {
      Silian_navigate('/admin/activities?tab=review');
      return;
    }
    Silian_navigate('/admin/activities?tab=review', {
      state: {
        selectedActivity: Silian_activity,
      },
    });
  }, [Silian_navigate]);

  const Silian_openAdminUserDetail = Silian_useCallback((Silian_user) => {
    if (!Silian_user) {
      Silian_navigate('/admin/users');
      return;
    }

    const Silian_searchParams = new URLSearchParams();
    const Silian_preferredUuid = Silian_user.uuid || Silian_user.user_uuid || Silian_user.userUuid || null;
    if (Silian_preferredUuid) {
      Silian_searchParams.set('userUuid', String(Silian_preferredUuid));
    } else if (Silian_user.id) {
      Silian_searchParams.set('userId', String(Silian_user.id));
    }

    const Silian_query = Silian_searchParams.toString();
    Silian_navigate(Silian_query ? `/admin/users?${Silian_query}` : '/admin/users');
  }, [Silian_navigate]);

  const Silian_summaryCards = Silian_useMemo(() => {
    const Silian_newUserShare = Silian_normalizedStats.users.total
      ? Silian_percentFormatter.format(Silian_normalizedStats.users.newUsersRatio ?? Silian_safeDivide(Silian_normalizedStats.users.new30d, Silian_normalizedStats.users.total))
      : Silian_t('admin.dashboard.noData');

    const Silian_weeklyCarbonDeltaText =
      Silian_trendSummary.carbonPrev7 > 0 || Silian_trendSummary.carbonLast7 > 0
        ? Silian_trendSummary.carbonDelta >= 0
          ? Silian_t('admin.dashboard.summaryCarbonTrendUp', {
              value: Silian_decimalFormatter.format(Silian_trendSummary.carbonDelta),
              rate: Silian_percentFormatter.format(Math.abs(Silian_trendSummary.carbonDeltaRate)),
            })
          : Silian_t('admin.dashboard.summaryCarbonTrendDown', {
              value: Silian_decimalFormatter.format(Math.abs(Silian_trendSummary.carbonDelta)),
              rate: Silian_percentFormatter.format(Math.abs(Silian_trendSummary.carbonDeltaRate)),
            })
        : Silian_t('admin.dashboard.noData');

    return [
      {
        key: 'users',
        icon: Silian_Users,
        title: Silian_t('admin.dashboard.totalUsers'),
        primary: Silian_integerFormatter.format(Silian_normalizedStats.users.total),
        secondary: `${Silian_t('admin.dashboard.activeUsers')}: ${Silian_integerFormatter.format(Silian_normalizedStats.users.active)}`,
        onClick: () => Silian_navigate('/admin/users'),
      },
      {
        key: 'newUsers',
        icon: Silian_TrendingUp,
        title: Silian_t('admin.dashboard.newUsers30d'),
        primary: Silian_integerFormatter.format(Silian_normalizedStats.users.new30d),
        secondary:
          Silian_normalizedStats.users.total > 0
            ? Silian_t('admin.dashboard.newUsers30dShare', { value: Silian_newUserShare })
            : Silian_t('admin.dashboard.noData'),
      },
      {
        key: 'transactions',
        icon: Silian_LineChartIcon,
        title: Silian_t('admin.dashboard.totalTransactions'),
        primary: Silian_integerFormatter.format(Silian_normalizedStats.transactions.total),
        secondary: `${Silian_t('admin.dashboard.approvedTransactions')}: ${Silian_integerFormatter.format(Silian_normalizedStats.transactions.approved)} · ${Silian_t('admin.dashboard.pendingTransactions')}: ${Silian_integerFormatter.format(Silian_normalizedStats.transactions.pending)}`,
        onClick: () => Silian_navigate('/admin/activities'),
      },
      {
        key: 'carbon',
        icon: Silian_Leaf,
        title: Silian_t('admin.dashboard.totalCarbonSaved'),
        primary: `${Silian_decimalFormatter.format(Silian_carbonStats.totalCarbonSaved)} ${Silian_t('units.kg')}`,
        secondary: `${Silian_t('admin.dashboard.totalPointsAwarded')}: ${Silian_integerFormatter.format(Silian_normalizedStats.transactions.totalPointsAwarded)}`,
      },
      {
        key: 'exchanges',
        icon: Silian_Package,
        title: Silian_t('admin.dashboard.totalExchanges'),
        primary: Silian_integerFormatter.format(Silian_normalizedStats.exchanges.total),
        secondary: `${Silian_t('admin.dashboard.pendingExchanges')}: ${Silian_integerFormatter.format(Silian_normalizedStats.exchanges.pending)} · ${Silian_t('admin.dashboard.totalPointsSpent')}: ${Silian_integerFormatter.format(Silian_normalizedStats.exchanges.totalPointsSpent)}`,
        onClick: () => Silian_navigate('/admin/exchanges'),
      },
      {
        key: 'activities',
        icon: Silian_Activity,
        title: Silian_t('admin.dashboard.totalActivities'),
        primary: Silian_integerFormatter.format(Silian_normalizedStats.activities.totalRecords),
        secondary: `${Silian_t('admin.dashboard.approvedActivities')}: ${Silian_integerFormatter.format(Silian_normalizedStats.activities.approvedRecords)} · ${Silian_t('admin.dashboard.pendingActivities')}: ${Silian_integerFormatter.format(Silian_normalizedStats.activities.pendingRecords)}`,
        onClick: () => Silian_navigate('/admin/activities'),
      },
      {
        key: 'messages',
        icon: Silian_MessageSquare,
        title: Silian_t('admin.dashboard.totalMessages'),
        primary: Silian_integerFormatter.format(Silian_normalizedStats.messages.total),
        secondary: `${Silian_t('admin.dashboard.unreadMessages')}: ${Silian_integerFormatter.format(Silian_normalizedStats.messages.unread)}`,
        onClick: () => Silian_navigate('/admin/broadcast'),
      },
      {
        key: 'carbon7d',
        icon: Silian_Leaf,
        title: Silian_t('admin.dashboard.carbonSaved7d'),
        primary: `${Silian_decimalFormatter.format(Silian_trendSummary.carbonLast7)} ${Silian_t('units.kg')}`,
        secondary: Silian_weeklyCarbonDeltaText,
      },
    ];
  }, [Silian_normalizedStats, Silian_trendSummary, Silian_t, Silian_integerFormatter, Silian_decimalFormatter, Silian_percentFormatter, Silian_navigate, Silian_carbonStats]);

  const Silian_renderDonutChart = (Silian_data) => {
    const Silian_total = Silian_data.reduce((Silian_sum, Silian_item) => Silian_sum + Silian_safeNumber(Silian_item.value), 0);
    if (Silian_total <= 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center space-y-3">
          <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
            <Silian_Activity className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground">{Silian_t('admin.dashboard.noData')}</p>
        </div>
      );
    }
    return (
      <Silian_ResponsiveContainer width="100%" height="100%">
        <Silian_PieChart>
          <defs>
            {Silian_CHART_GRADIENTS.map((Silian_gradient, Silian_index) => (
              <linearGradient key={Silian_index} id={`pieGradient-${Silian_index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={Silian_gradient.start} stopOpacity={0.9}/>
                <stop offset="100%" stopColor={Silian_gradient.end} stopOpacity={1}/>
              </linearGradient>
            ))}
            {/* 添加径向渐变效果 */}
            {Silian_CHART_GRADIENTS.map((Silian_gradient, Silian_index) => (
              <radialGradient key={`radial-${Silian_index}`} id={`pieRadial-${Silian_index}`}>
                <stop offset="0%" stopColor={Silian_gradient.start} stopOpacity={1}/>
                <stop offset="100%" stopColor={Silian_gradient.end} stopOpacity={0.85}/>
              </radialGradient>
            ))}
          </defs>
          <Silian_Pie
            data={Silian_data}
            dataKey="value"
            nameKey="label"
            innerRadius={55}
            outerRadius={85}
            paddingAngle={4}
            strokeWidth={3}
            stroke="hsl(var(--background))"
            animationBegin={0}
            animationDuration={800}
          >
            {Silian_data.map((Silian_entry, Silian_index) => (
              <Silian_Cell
                key={Silian_entry.label}
                fill={`url(#pieRadial-${Silian_index % Silian_CHART_GRADIENTS.length})`}
                className="hover:opacity-80 transition-opacity duration-200 cursor-pointer"
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
                }}
              />
            ))}
          </Silian_Pie>
          <Silian_Tooltip
            formatter={(Silian_value, Silian_name) => [Silian_integerFormatter.format(Silian_value), Silian_name]}
            contentStyle={{
              backgroundColor: 'hsl(var(--card))',
              border: '2px solid hsl(var(--border))',
              borderRadius: '12px',
              boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
              padding: '10px 14px',
            }}
            itemStyle={{ fontWeight: '500' }}
            labelStyle={{ fontWeight: '600', marginBottom: '6px', color: 'hsl(var(--foreground))' }}
          />
          <Silian_Legend
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            wrapperStyle={{
              paddingTop: '12px',
              fontSize: '12px',
              fontWeight: '500',
            }}
          />
        </Silian_PieChart>
      </Silian_ResponsiveContainer>
    );
  };

  return (
    <div className="min-h-screen min-w-0 w-full max-w-full space-y-8 overflow-x-clip pb-8">
      {/* Hero Header Section */}
      <Silian_Card className="min-w-0 overflow-hidden border-2 transition-shadow duration-300 hover:shadow-lg">
        <Silian_CardHeader className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/20">
                  <Silian_LineChartIcon className="h-7 w-7 text-white" />
                </div>
                <div className="min-w-0">
                  <Silian_CardTitle className="break-words bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
                    {Silian_t('admin.dashboard.title')}
                  </Silian_CardTitle>
                  <Silian_CardDescription className="mt-1 break-words text-base">
                    {Silian_t('admin.dashboard.description')}
                  </Silian_CardDescription>
                </div>
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input bg-background text-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-0"
                  checked={Silian_autoRefresh}
                  onChange={(Silian_e) => Silian_setAutoRefresh(Silian_e.target.checked)}
                />
                <span className="text-sm font-medium">
                  {Silian_t('admin.dashboard.autoRefresh')}
                </span>
              </div>
              <Silian_Button
                size="default"
                className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 shadow-md transition-all duration-200 hover:from-green-600 hover:to-emerald-700 hover:shadow-lg sm:w-auto"
                onClick={() => Silian_refetch()}
                disabled={Silian_isFetching}
              >
                <Silian_RefreshCw className={`h-4 w-4 mr-2 ${Silian_isFetching ? 'animate-spin' : ''}`} />
                {Silian_t('admin.dashboard.refreshNow')}
              </Silian_Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
            <Silian_Clock className="h-4 w-4 text-green-600" />
            <span className="break-words">
              {Silian_t('admin.dashboard.lastUpdated')}: <span className="font-medium text-foreground">{Silian_lastUpdated ? Silian_formatDateTime(Silian_lastUpdated) : '--'}</span>
            </span>
          </div>
        </Silian_CardHeader>
          <Silian_CardContent className="pb-8">
            {Silian_isLoading && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-green-100 dark:border-green-900" />
                  <Silian_Loader2 className="absolute inset-0 m-auto h-16 w-16 animate-spin text-green-500" />
                </div>
                <span className="text-base font-medium text-muted-foreground">{Silian_t('common.loading')}</span>
              </div>
            )}
            {Silian_isError && (
              <Silian_Alert variant="destructive" className="border-2">
                <Silian_AlertCircle className="h-5 w-5" />
                <Silian_AlertTitle className="text-base">{Silian_t('common.error')}</Silian_AlertTitle>
                <Silian_AlertDescription className="text-sm">{Silian_error?.message || Silian_t('errors.loadFailed')}</Silian_AlertDescription>
              </Silian_Alert>
            )}
            {!Silian_isLoading && !Silian_isError && (
              <>
                {/* Main Stats Grid */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  {Silian_summaryCards.map((Silian_item, Silian_index) => {
                    const Silian_Icon = Silian_item.icon;
                    const Silian_gradients = [
                      'from-blue-500/10 to-blue-600/10 dark:from-blue-500/20 dark:to-blue-600/20',
                      'from-green-500/10 to-emerald-600/10 dark:from-green-500/20 dark:to-emerald-600/20',
                      'from-purple-500/10 to-violet-600/10 dark:from-purple-500/20 dark:to-violet-600/20',
                      'from-orange-500/10 to-amber-600/10 dark:from-orange-500/20 dark:to-amber-600/20',
                      'from-pink-500/10 to-rose-600/10 dark:from-pink-500/20 dark:to-rose-600/20',
                      'from-teal-500/10 to-cyan-600/10 dark:from-teal-500/20 dark:to-cyan-600/20',
                      'from-indigo-500/10 to-blue-600/10 dark:from-indigo-500/20 dark:to-blue-600/20',
                      'from-emerald-500/10 to-green-600/10 dark:from-emerald-500/20 dark:to-green-600/20',
                    ];
                    const Silian_iconColors = [
                      'text-blue-600 dark:text-blue-400',
                      'text-green-600 dark:text-green-400',
                      'text-purple-600 dark:text-purple-400',
                      'text-orange-600 dark:text-orange-400',
                      'text-pink-600 dark:text-pink-400',
                      'text-teal-600 dark:text-teal-400',
                      'text-indigo-600 dark:text-indigo-400',
                      'text-emerald-600 dark:text-emerald-400',
                    ];
                    return (
                      <Silian_Card
                        key={Silian_item.key}
                        className={`group relative overflow-hidden border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                          Silian_item.onClick ? 'cursor-pointer' : ''
                        }`}
                        onClick={Silian_item.onClick}
                      >
                        <div className={`absolute inset-0 bg-gradient-to-br ${Silian_gradients[Silian_index % Silian_gradients.length]} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                        <Silian_CardContent className="relative p-6 space-y-4">
                          <div className="flex items-start justify-between">
                            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${Silian_gradients[Silian_index % Silian_gradients.length]} shadow-md group-hover:scale-110 transition-transform duration-300`}>
                              <Silian_Icon className={`h-7 w-7 ${Silian_iconColors[Silian_index % Silian_iconColors.length]}`} />
                            </div>
                            {Silian_item.onClick && (
                              <Silian_ArrowUpRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                            )}
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                              {Silian_item.title}
                            </p>
                            <p className="text-3xl font-bold tracking-tight">{Silian_item.primary}</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{Silian_item.secondary}</p>
                          </div>
                        </Silian_CardContent>
                      </Silian_Card>
                    );
                  })}
                </div>

                {/* Mini Stats Bar */}
                <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
                  {Silian_miniStats.map((Silian_item, Silian_index) => {
                    const Silian_borderColors = [
                      'border-l-blue-500',
                      'border-l-green-500',
                      'border-l-purple-500',
                      'border-l-orange-500',
                      'border-l-pink-500',
                    ];
                    return (
                      <div
                        key={Silian_item.key}
                        className={`group rounded-xl border-2 border-l-4 ${Silian_borderColors[Silian_index % Silian_borderColors.length]} bg-card/50 backdrop-blur p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5`}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          {Silian_item.label}
                        </p>
                        <p className="text-xl font-bold group-hover:scale-105 transition-transform duration-200">
                          {Silian_item.value}
                        </p>
                      </div>
                    );
                  })}
                </div>
            </>
          )}
        </Silian_CardContent>
      </Silian_Card>      {!Silian_isLoading && !Silian_isError && (
        <>
          {/* Trends and Insights Section */}
          <div className="grid gap-6 xl:grid-cols-3">
            <Silian_Card className="xl:col-span-2 border-2 hover:shadow-lg transition-shadow duration-300">
              <Silian_CardHeader className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <Silian_CardTitle className="flex items-center gap-2 text-2xl">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/10 to-violet-600/10">
                        <Silian_Activity className="h-5 w-5 text-purple-600" />
                      </div>
                      {Silian_t('admin.dashboard.trendsTitle')}
                    </Silian_CardTitle>
                    <Silian_CardDescription className="text-sm">{Silian_t('admin.dashboard.trendsSubtitle')}</Silian_CardDescription>
                  </div>
                  <Silian_Button
                    variant="outline"
                    size="sm"
                    className="rounded-xl border-2 hover:bg-purple-50 hover:border-purple-200 dark:hover:bg-purple-950/30 transition-all duration-200"
                    onClick={() => Silian_navigate('/admin/activities')}
                  >
                    <Silian_LineChartIcon className="h-4 w-4 mr-2" />
                    {Silian_t('admin.dashboard.viewActivities')}
                  </Silian_Button>
                </div>
              </Silian_CardHeader>
              <Silian_CardContent className="h-96 pb-6">
                {Silian_trendChartData.length ? (
                  <Silian_ResponsiveContainer width="100%" height="100%">
                    <Silian_ComposedChart data={Silian_trendChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="colorCarbon" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#10b981" stopOpacity={0.4}/>
                          <stop offset="95%" stopColor="#10b981" stopOpacity={0.05}/>
                        </linearGradient>
                        <linearGradient id="barGradient" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.9}/>
                          <stop offset="100%" stopColor="#a78bfa" stopOpacity={0.8}/>
                        </linearGradient>
                      </defs>
                      <Silian_CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <Silian_XAxis
                        dataKey="date"
                        minTickGap={20}
                        tickFormatter={(Silian_value) => Silian_formatDateLabel(Silian_value, Silian_shortDateFormatter)}
                        stroke="hsl(var(--muted-foreground))"
                        style={{ fontSize: '12px' }}
                      />
                      <Silian_YAxis
                        yAxisId="left"
                        allowDecimals={false}
                        stroke="#8b5cf6"
                        style={{ fontSize: '12px', fontWeight: '500' }}
                      />
                      <Silian_YAxis
                        yAxisId="right"
                        orientation="right"
                        tickFormatter={(Silian_value) => Silian_decimalFormatter.format(Silian_value)}
                        stroke="#10b981"
                        style={{ fontSize: '12px', fontWeight: '500' }}
                      />
                      <Silian_Tooltip
                        contentStyle={{
                          backgroundColor: 'hsl(var(--card))',
                          border: '2px solid hsl(var(--border))',
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                          padding: '12px',
                        }}
                        labelStyle={{ fontWeight: '600', marginBottom: '8px', color: 'hsl(var(--foreground))' }}
                        labelFormatter={(Silian_value) => Silian_formatDateLabel(Silian_value, Silian_longDateFormatter)}
                        formatter={(Silian_value, Silian_name) => {
                          if (typeof Silian_value === 'number') {
                            if (
                              Silian_name === Silian_t('admin.dashboard.trendsCarbonSaved') ||
                              Silian_name === Silian_t('admin.dashboard.trendsCarbonAverage')
                            ) {
                              return [`${Silian_decimalFormatter.format(Silian_value)} ${Silian_t('units.kg')}`, Silian_name];
                            }
                            return [Silian_integerFormatter.format(Silian_value), Silian_name];
                          }
                          return [Silian_value, Silian_name];
                        }}
                      />
                      <Silian_Legend
                        wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: '500' }}
                        iconType="circle"
                      />
                      <Silian_Bar
                        yAxisId="left"
                        dataKey="transactions"
                        name={Silian_t('admin.dashboard.trendsTransactions')}
                        fill="url(#barGradient)"
                        radius={[8, 8, 0, 0]}
                        maxBarSize={60}
                      />
                      <Silian_Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="carbon_saved"
                        name={Silian_t('admin.dashboard.trendsCarbonSaved')}
                        stroke="#10b981"
                        fill="url(#colorCarbon)"
                        strokeWidth={3}
                        dot={{ r: 5, strokeWidth: 2, fill: '#ffffff', stroke: '#10b981' }}
                        activeDot={{ r: 7, strokeWidth: 2 }}
                      />
                      <Silian_Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="carbon_avg"
                        name={Silian_t('admin.dashboard.trendsCarbonAverage')}
                        stroke="#f59e0b"
                        strokeWidth={3}
                        strokeDasharray="8 4"
                        dot={false}
                      />
                    </Silian_ComposedChart>
                  </Silian_ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center space-y-3">
                      <div className="flex justify-center">
                        <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                          <Silian_LineChartIcon className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{Silian_t('admin.dashboard.noData')}</p>
                    </div>
                  </div>
                )}
              </Silian_CardContent>
            </Silian_Card>

            <Silian_Card className="border-2 hover:shadow-lg transition-shadow duration-300">
              <Silian_CardHeader className="space-y-2">
                <Silian_CardTitle className="flex items-center gap-2 text-xl">
                  <Silian_Sparkles className="h-5 w-5 text-yellow-500" />
                  {Silian_t('admin.dashboard.keyInsights')}
                </Silian_CardTitle>
                <Silian_CardDescription className="text-sm">{Silian_t('admin.dashboard.keyInsightsSubtitle')}</Silian_CardDescription>
              </Silian_CardHeader>
              <Silian_CardContent className="space-y-3 pb-6">
                {Silian_insights.map((Silian_insight, Silian_index) => {
                  const Silian_bgGradients = [
                    'from-blue-50 to-blue-100/50 dark:from-blue-950/30 dark:to-blue-900/20',
                    'from-green-50 to-green-100/50 dark:from-green-950/30 dark:to-green-900/20',
                    'from-purple-50 to-purple-100/50 dark:from-purple-950/30 dark:to-purple-900/20',
                    'from-orange-50 to-orange-100/50 dark:from-orange-950/30 dark:to-orange-900/20',
                    'from-pink-50 to-pink-100/50 dark:from-pink-950/30 dark:to-pink-900/20',
                    'from-teal-50 to-teal-100/50 dark:from-teal-950/30 dark:to-teal-900/20',
                    'from-indigo-50 to-indigo-100/50 dark:from-indigo-950/30 dark:to-indigo-900/20',
                  ];
                  return (
                    <div
                      key={Silian_insight.key}
                      className={`group rounded-xl border-2 bg-gradient-to-br ${Silian_bgGradients[Silian_index % Silian_bgGradients.length]} p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                          {Silian_insight.label}
                        </span>
                        <span className="text-xl font-bold group-hover:scale-110 transition-transform duration-200">
                          {Silian_insight.value}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{Silian_insight.description}</p>
                    </div>
                  );
                })}
              </Silian_CardContent>
            </Silian_Card>
          </div>

          {/* Status Distribution Charts */}
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <Silian_Card className="group border-2 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <Silian_CardHeader className="space-y-2">
                <Silian_CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <Silian_LineChartIcon className="h-4 w-4 text-blue-600" />
                  </div>
                  {Silian_t('admin.dashboard.transactionStatusTitle')}
                </Silian_CardTitle>
                <Silian_CardDescription className="text-xs">
                  {Silian_t('admin.dashboard.transactionStatusSubtitle')}
                </Silian_CardDescription>
              </Silian_CardHeader>
              <Silian_CardContent className="h-72 pb-4">
                {Silian_renderDonutChart(Silian_transactionStatusData)}
              </Silian_CardContent>
            </Silian_Card>

            <Silian_Card className="group border-2 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <Silian_CardHeader className="space-y-2">
                <Silian_CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500/10 to-green-600/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <Silian_Users className="h-4 w-4 text-green-600" />
                  </div>
                  {Silian_t('admin.dashboard.userStatusTitle')}
                </Silian_CardTitle>
                <Silian_CardDescription className="text-xs">
                  {Silian_t('admin.dashboard.userStatusSubtitle', {
                    newUsers: Silian_integerFormatter.format(Silian_normalizedStats.users.new30d),
                  })}
                </Silian_CardDescription>
              </Silian_CardHeader>
              <Silian_CardContent className="h-72 pb-4">
                {Silian_renderDonutChart(Silian_userStatusData)}
              </Silian_CardContent>
            </Silian_Card>

            <Silian_Card className="group border-2 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <Silian_CardHeader className="space-y-2">
                <Silian_CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-600/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <Silian_Package className="h-4 w-4 text-purple-600" />
                  </div>
                  {Silian_t('admin.dashboard.exchangeStatusTitle')}
                </Silian_CardTitle>
                <Silian_CardDescription className="text-xs">
                  {Silian_t('admin.dashboard.exchangeStatusSubtitle')}
                </Silian_CardDescription>
              </Silian_CardHeader>
              <Silian_CardContent className="h-72 pb-4">
                {Silian_renderDonutChart(Silian_exchangeStatusData)}
              </Silian_CardContent>
            </Silian_Card>

            <Silian_Card className="group border-2 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <Silian_CardHeader className="space-y-2">
                <Silian_CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500/10 to-orange-600/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <Silian_MessageSquare className="h-4 w-4 text-orange-600" />
                  </div>
                  {Silian_t('admin.dashboard.messageStatusTitle')}
                </Silian_CardTitle>
                <Silian_CardDescription className="text-xs">
                  {Silian_t('admin.dashboard.messageStatusSubtitle')}
                </Silian_CardDescription>
              </Silian_CardHeader>
              <Silian_CardContent className="h-72 pb-4">
                {Silian_renderDonutChart(Silian_messageStatusData)}
              </Silian_CardContent>
            </Silian_Card>
          </div>

          {/* Top Carbon Days */}
          <Silian_Card className="border-2 hover:shadow-lg transition-shadow duration-300">
            <Silian_CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <Silian_CardTitle className="flex items-center gap-2 text-2xl">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-600/10">
                      <Silian_TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    {Silian_t('admin.dashboard.topCarbonDaysTitle')}
                  </Silian_CardTitle>
                  <Silian_CardDescription className="text-sm">
                    {Silian_t('admin.dashboard.topCarbonDaysSubtitle')}
                  </Silian_CardDescription>
                </div>
                <Silian_Button
                  variant="outline"
                  size="sm"
                  className="rounded-xl border-2 hover:bg-green-50 hover:border-green-200 dark:hover:bg-green-950/30 transition-all duration-200"
                  onClick={() => Silian_navigate('/admin/activities')}
                >
                  <Silian_Activity className="h-4 w-4 mr-2" />
                  {Silian_t('admin.dashboard.viewActivities')}
                </Silian_Button>
              </div>
            </Silian_CardHeader>
            <Silian_CardContent className="pb-6">
              {Silian_topCarbonDays.length ? (
                <div className="space-y-3">
                  {Silian_topCarbonDays.map((Silian_day, Silian_index) => {
                    const Silian_rankColors = [
                      'from-yellow-400 to-yellow-600 text-white shadow-lg shadow-yellow-500/30',
                      'from-gray-300 to-gray-500 text-white shadow-lg shadow-gray-500/30',
                      'from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30',
                      'from-blue-400 to-blue-600 text-white',
                      'from-purple-400 to-purple-600 text-white',
                    ];
                    return (
                      <div
                        key={Silian_day.date}
                        className="group flex items-center gap-4 rounded-xl border-2 bg-gradient-to-r from-card to-muted/20 px-5 py-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                      >
                        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${Silian_rankColors[Silian_index]} font-bold transition-transform duration-200 group-hover:scale-110`}>
                          {Silian_index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-base truncate">
                            {Silian_formatDateLabel(Silian_day.date, Silian_longDateFormatter)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {Silian_t('admin.dashboard.trendsTransactions')}: <span className="font-medium text-foreground">{Silian_integerFormatter.format(Silian_day.transactions)}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-right">
                          <Silian_Leaf className="h-5 w-5 text-green-600 flex-shrink-0" />
                          <div>
                            <div className="text-lg font-bold whitespace-nowrap">
                              {Silian_decimalFormatter.format(Silian_day.carbon_saved)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {Silian_t('units.kg')}
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-12 space-y-3">
                  <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                    <Silian_TrendingUp className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">{Silian_t('admin.dashboard.noData')}</p>
                </div>
              )}
            </Silian_CardContent>
          </Silian_Card>
          {/* Recent Activity Section */}
          <div className="grid gap-6 xl:grid-cols-3">
            <Silian_Card className="border-2 hover:shadow-lg transition-shadow duration-300">
              <Silian_CardHeader className="space-y-2">
                <Silian_CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-600/10 flex items-center justify-center">
                    <Silian_Clock className="h-4 w-4 text-amber-600" />
                  </div>
                  {Silian_t('admin.dashboard.recentPendingTransactions')}
                </Silian_CardTitle>
                <Silian_CardDescription className="text-xs">
                  {Silian_t('admin.dashboard.recentPendingTransactionsSubtitle')}
                </Silian_CardDescription>
              </Silian_CardHeader>
              <Silian_CardContent className="space-y-3 pb-6">
                {Silian_recent.pendingTransactions.length ? (
                  Silian_recent.pendingTransactions.map((Silian_item) => (
                    <div
                      key={Silian_item.id}
                      role="button"
                      tabIndex={0}
                      className="group cursor-pointer rounded-xl border-2 bg-gradient-to-r from-card to-amber-50/30 px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:to-amber-950/10"
                      onClick={() => Silian_openAdminExchangeDetail(Silian_item)}
                      onKeyDown={(Silian_event) => {
                        if (Silian_event.key === 'Enter' || Silian_event.key === ' ') {
                          Silian_event.preventDefault();
                          Silian_openAdminExchangeDetail(Silian_item);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="font-semibold text-sm truncate">
                          {Silian_item.username || Silian_t('admin.dashboard.unknownUser')}
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                          <Silian_Sparkles className="h-3.5 w-3.5" />
                          {Silian_decimalFormatter.format(Silian_safeNumber(Silian_item.points))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="truncate">{Silian_formatDateTime(Silian_item.created_at)}</span>
                        <span className="uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          {Silian_item.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 space-y-2">
                    <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                      <Silian_Clock className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground">{Silian_t('admin.dashboard.noPendingTransactions')}</p>
                  </div>
                )}
              </Silian_CardContent>
            </Silian_Card>

            <Silian_Card className="border-2 hover:shadow-lg transition-shadow duration-300">
              <Silian_CardHeader className="space-y-2">
                <Silian_CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-600/10 flex items-center justify-center">
                    <Silian_Leaf className="h-4 w-4 text-green-600" />
                  </div>
                  {Silian_t('admin.dashboard.recentPendingCarbon')}
                </Silian_CardTitle>
                <Silian_CardDescription className="text-xs">
                  {Silian_t('admin.dashboard.recentPendingCarbonSubtitle')}
                </Silian_CardDescription>
              </Silian_CardHeader>
              <Silian_CardContent className="space-y-3 pb-6">
                {Silian_recent.pendingCarbonRecords.length ? (
                  Silian_recent.pendingCarbonRecords.map((Silian_item) => (
                    <div
                      key={Silian_item.id}
                      role="button"
                      tabIndex={0}
                      className="group cursor-pointer rounded-xl border-2 bg-gradient-to-r from-card to-green-50/30 px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:to-green-950/10"
                      onClick={() => Silian_openAdminActivityReviewDetail(Silian_item)}
                      onKeyDown={(Silian_event) => {
                        if (Silian_event.key === 'Enter' || Silian_event.key === ' ') {
                          Silian_event.preventDefault();
                          Silian_openAdminActivityReviewDetail(Silian_item);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="font-semibold text-sm truncate">
                          {(Silian_isEnglish
                            ? Silian_item.activity_name_en || Silian_item.activity_name_zh
                            : Silian_item.activity_name_zh || Silian_item.activity_name_en) || Silian_item.activity_id || Silian_t('admin.dashboard.unknownActivity')}
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-green-700 dark:text-green-400 whitespace-nowrap">
                          <Silian_Leaf className="h-3.5 w-3.5" />
                          {Silian_decimalFormatter.format(Silian_safeNumber(Silian_item.carbon_saved))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="truncate">{Silian_item.username || Silian_t('admin.dashboard.unknownUser')}</span>
                        <span className="truncate">{Silian_formatDateTime(Silian_item.created_at)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 space-y-2">
                    <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                      <Silian_Leaf className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground">{Silian_t('admin.dashboard.noPendingCarbon')}</p>
                  </div>
                )}
              </Silian_CardContent>
            </Silian_Card>

            <Silian_Card className="border-2 hover:shadow-lg transition-shadow duration-300">
              <Silian_CardHeader className="space-y-2">
                <Silian_CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/10 flex items-center justify-center">
                    <Silian_Users className="h-4 w-4 text-blue-600" />
                  </div>
                  {Silian_t('admin.dashboard.latestUsers')}
                </Silian_CardTitle>
                <Silian_CardDescription className="text-xs">
                  {Silian_t('admin.dashboard.latestUsersSubtitle')}
                </Silian_CardDescription>
              </Silian_CardHeader>
              <Silian_CardContent className="space-y-3 pb-6">
                {Silian_recent.latestUsers.length ? (
                  Silian_recent.latestUsers.map((Silian_item) => (
                    <div
                      key={Silian_item.id}
                      role="button"
                      tabIndex={0}
                      className="group cursor-pointer rounded-xl border-2 bg-gradient-to-r from-card to-blue-50/30 px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:to-blue-950/10"
                      onClick={() => Silian_openAdminUserDetail(Silian_item)}
                      onKeyDown={(Silian_event) => {
                        if (Silian_event.key === 'Enter' || Silian_event.key === ' ') {
                          Silian_event.preventDefault();
                          Silian_openAdminUserDetail(Silian_item);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="font-semibold text-sm truncate">{Silian_item.username}</span>
                        <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 whitespace-nowrap">
                          {Silian_item.status || Silian_t('admin.dashboard.statusUnknown')}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate mb-1">
                        {Silian_item.email || Silian_t('admin.dashboard.noEmail')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {Silian_formatDateTime(Silian_item.created_at)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 space-y-2">
                    <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                      <Silian_Users className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground">{Silian_t('admin.dashboard.noRecentUsers')}</p>
                  </div>
                )}
              </Silian_CardContent>
            </Silian_Card>
          </div>


        </>
      )}
    </div>
  );
}
