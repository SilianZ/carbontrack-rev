import React, { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { adminAPI } from '../../lib/api';
import { useTranslation } from '../../hooks/useTranslation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/Alert';
import {
  Loader2,
  AlertCircle,
  RefreshCw,
  LineChart as LineChartIcon,
  Clock,
  Users,
  Leaf,
  Activity,
  Package,
  MessageSquare,
  TrendingUp,
  ArrowUpRight,
  ArrowDownRight,
  Sparkles,
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
  Area,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const CHART_COLORS = [
  '#3b82f6', // 蓝色
  '#10b981', // 绿色
  '#8b5cf6', // 紫色
  '#f59e0b', // 橙色
  '#ec4899', // 粉色
  '#14b8a6', // 青色
  '#f97316', // 深橙
  '#06b6d4', // 天蓝
];

const CHART_GRADIENTS = [
  { start: '#60a5fa', end: '#3b82f6' }, // 蓝色渐变
  { start: '#34d399', end: '#10b981' }, // 绿色渐变
  { start: '#a78bfa', end: '#8b5cf6' }, // 紫色渐变
  { start: '#fbbf24', end: '#f59e0b' }, // 橙色渐变
  { start: '#f472b6', end: '#ec4899' }, // 粉色渐变
  { start: '#2dd4bf', end: '#14b8a6' }, // 青色渐变
  { start: '#fb923c', end: '#f97316' }, // 深橙渐变
  { start: '#22d3ee', end: '#06b6d4' }, // 天蓝渐变
];

const safeNumber = (value) => {
  if (value === null || value === undefined) {
    return 0;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : 0;
};

const safeDivide = (numerator, denominator) => {
  if (!denominator || Number.isNaN(denominator)) {
    return 0;
  }
  return numerator / denominator;
};

export default function AdminDashboardPage() {
  const { t, currentLanguage } = useTranslation(['activities', 'admin', 'common', 'dashboard', 'date', 'errors', 'messages', 'units']);
  const isEnglish = (currentLanguage || '').toLowerCase().startsWith('en');
  const navigate = useNavigate();
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const refreshIntervalMs = 30000;

  const statsQuery = useQuery(
    ['adminStats'],
    async () => {
      const res = await adminAPI.getStats();
      return res.data?.data || {};
    },
    {
      staleTime: 15000,
      refetchOnWindowFocus: false,
      refetchInterval: autoRefresh ? refreshIntervalMs : false,
      keepPreviousData: true,
      onSuccess: (data) => {
        if (data?.generated_at) {
          const generated = new Date(data.generated_at);
          if (!Number.isNaN(generated.getTime())) {
            setLastUpdated(generated);
            return;
          }
        }
        setLastUpdated(new Date());
      },
    }
  );

  const isLoading = statsQuery.isLoading;
  const isError = statsQuery.isError;
  const error = statsQuery.error;
  const refetch = statsQuery.refetch;
  const isFetching = statsQuery.isFetching;

  const integerFormatter = useMemo(() => new Intl.NumberFormat(currentLanguage), [currentLanguage]);
  const decimalFormatter = useMemo(() => new Intl.NumberFormat(currentLanguage, { maximumFractionDigits: 2 }), [currentLanguage]);
  const percentFormatter = useMemo(() => new Intl.NumberFormat(currentLanguage, { style: 'percent', maximumFractionDigits: 1 }), [currentLanguage]);
  const shortDateFormatter = useMemo(() => new Intl.DateTimeFormat(currentLanguage, { month: 'short', day: 'numeric' }), [currentLanguage]);
  const longDateFormatter = useMemo(() => new Intl.DateTimeFormat(currentLanguage, { year: 'numeric', month: 'short', day: 'numeric' }), [currentLanguage]);

  const formatDateLabel = (value, formatter) => {
    if (!value) {
      return value;
    }
    const date = new Date(`${value}T00:00:00`);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return formatter.format(date);
  };
  const formatDateTime = (value) => {
    if (!value) {
      return '--';
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      return value;
    }
    return date.toLocaleString(currentLanguage);
  };


  const normalizedStats = useMemo(() => {
    const base = statsQuery.data ?? {};
    const users = {
      total: safeNumber(base.users?.total_users),
      active: safeNumber(base.users?.active_users),
      inactive: safeNumber(base.users?.inactive_users),
      new30d: safeNumber(base.users?.new_users_30d),
      activeRatio: Number(base.users?.active_ratio ?? safeDivide(safeNumber(base.users?.active_users), safeNumber(base.users?.total_users))),
      newUsersRatio: Number(base.users?.new_users_ratio ?? safeDivide(safeNumber(base.users?.new_users_30d), safeNumber(base.users?.total_users))),
    };

    const transactions = {
      total: safeNumber(base.transactions?.total_transactions),
      pending: safeNumber(base.transactions?.pending_transactions),
      approved: safeNumber(base.transactions?.approved_transactions),
      rejected: safeNumber(base.transactions?.rejected_transactions),
      totalPointsAwarded: Number(base.transactions?.total_points_awarded ?? 0),
      totalCarbonSaved: Number(base.transactions?.total_carbon_saved ?? base.carbon?.total_carbon_saved ?? 0),
      approvalRate: Number(base.transactions?.approval_rate ?? safeDivide(safeNumber(base.transactions?.approved_transactions), safeNumber(base.transactions?.total_transactions))),
      pendingRatio: Number(base.transactions?.pending_ratio ?? safeDivide(safeNumber(base.transactions?.pending_transactions), safeNumber(base.transactions?.total_transactions))),
      avgPointsPerTransaction: Number(base.transactions?.avg_points_per_transaction ?? 0),
      last7Transactions: safeNumber(base.transactions?.last7_transactions),
      last7PointsAwarded: Number(base.transactions?.last7_points_awarded ?? 0),
    };

    const exchanges = {
      total: safeNumber(base.exchanges?.total_exchanges),
      pending: safeNumber(base.exchanges?.pending_exchanges),
      completed: safeNumber(base.exchanges?.completed_exchanges),
      other: safeNumber(base.exchanges?.other_exchanges),
      totalPointsSpent: Number(base.exchanges?.total_points_spent ?? 0),
      completionRate: Number(base.exchanges?.completion_rate ?? safeDivide(safeNumber(base.exchanges?.completed_exchanges), safeNumber(base.exchanges?.total_exchanges))),
    };

    const messages = {
      total: safeNumber(base.messages?.total_messages),
      unread: safeNumber(base.messages?.unread_messages),
      read: safeNumber(base.messages?.read_messages ?? (safeNumber(base.messages?.total_messages) - safeNumber(base.messages?.unread_messages))),
      unreadRatio: Number(base.messages?.unread_ratio ?? safeDivide(safeNumber(base.messages?.unread_messages), safeNumber(base.messages?.total_messages))),
    };

    const activities = {
      totalRecords: safeNumber(base.activities?.total_records),
      approvedRecords: safeNumber(base.activities?.approved_records),
      pendingRecords: safeNumber(base.activities?.pending_records),
      rejectedRecords: safeNumber(base.activities?.rejected_records),
      catalogTotal: safeNumber(base.activities?.total_activities),
      catalogActive: safeNumber(base.activities?.active_activities),
      catalogInactive: safeNumber(base.activities?.inactive_activities ?? (safeNumber(base.activities?.total_activities) - safeNumber(base.activities?.active_activities))),
    };

    const carbon = {
      totalRecords: safeNumber(base.carbon?.total_records),
      pendingRecords: safeNumber(base.carbon?.pending_records),
      approvedRecords: safeNumber(base.carbon?.approved_records),
      rejectedRecords: safeNumber(base.carbon?.rejected_records),
      totalCarbonSaved: Number(base.carbon?.total_carbon_saved ?? 0),
      totalPointsEarned: Number(base.carbon?.total_points_earned ?? 0),
      last7CarbonSaved: Number(base.carbon?.last7_carbon_saved ?? 0),
      last7PointsEarned: Number(base.carbon?.last7_points_earned ?? 0),
      averageCarbonPerRecord: Number(base.carbon?.average_carbon_per_record ?? 0),
      averageDailyCarbon: Number(base.carbon?.average_daily_carbon ?? 0),
      approvalRate: Number(base.carbon?.approval_rate ?? safeDivide(safeNumber(base.carbon?.approved_records), safeNumber(base.carbon?.total_records))),
    };

    const trends = Array.isArray(base.trends)
      ? base.trends.map((item) => ({
          date: item?.date ?? '',
          transactions: safeNumber(item?.transactions),
          carbon_saved: safeNumber(item?.carbon_saved),
          points_awarded: Number(item?.points_awarded ?? 0),
          approved_records: safeNumber(item?.approved_records),
        }))
      : [];

    const trendSummary = {
      carbonLast7: Number(base.trend_summary?.carbon_last7 ?? 0),
      carbonPrev7: Number(base.trend_summary?.carbon_prev7 ?? 0),
      carbonDelta: Number(base.trend_summary?.carbon_delta ?? 0),
      carbonDeltaRate: Number(base.trend_summary?.carbon_delta_rate ?? 0),
      transactionsLast7: safeNumber(base.trend_summary?.transactions_last7),
      pointsLast7: Number(base.trend_summary?.points_last7 ?? 0),
      averageDailyCarbon30d: Number(base.trend_summary?.average_daily_carbon_30d ?? 0),
    };

    const recent = {
      pendingTransactions: Array.isArray(base.recent?.pending_transactions) ? base.recent.pending_transactions : [],
      pendingCarbonRecords: Array.isArray(base.recent?.pending_carbon_records) ? base.recent.pending_carbon_records : [],
      latestUsers: Array.isArray(base.recent?.latest_users) ? base.recent.latest_users : [],
    };

    return { users, transactions, exchanges, messages, activities, carbon, trends, trendSummary, recent };
  }, [statsQuery.data]);


  const trendChartData = useMemo(() => {
    const entries = normalizedStats.trends;
    if (!entries.length) {
      return [];
    }
    return entries.map((entry, index, array) => {
      const start = Math.max(0, index - 6);
      const window = array.slice(start, index + 1);
      const carbonAvg = safeDivide(window.reduce((sum, item) => sum + item.carbon_saved, 0), window.length || 1);
      const transactionAvg = safeDivide(window.reduce((sum, item) => sum + item.transactions, 0), window.length || 1);
      return {
        ...entry,
        carbon_avg: carbonAvg,
        transactions_avg: transactionAvg,
      };
    });
  }, [normalizedStats.trends]);

  const trendSummary = normalizedStats.trendSummary;
  const carbonStats = normalizedStats.carbon;
  const recent = normalizedStats.recent;


  const transactionStatusData = useMemo(() => {
    const { pending, approved, rejected, total } = normalizedStats.transactions;
    const other = Math.max(total - (pending + approved + rejected), 0);
    const data = [
      { label: t('admin.dashboard.statusPending'), value: pending },
      { label: t('admin.dashboard.statusApproved'), value: approved },
      { label: t('admin.dashboard.statusRejected'), value: rejected },
    ];
    if (other > 0) {
      data.push({ label: t('admin.dashboard.statusOther'), value: other });
    }
    return data;
  }, [normalizedStats.transactions, t]);

  const exchangeStatusData = useMemo(() => {
    const { pending, completed, total } = normalizedStats.exchanges;
    const other = Math.max(total - (pending + completed), 0);
    const data = [
      { label: t('admin.dashboard.statusPending'), value: pending },
      { label: t('admin.dashboard.statusCompleted'), value: completed },
    ];
    if (other > 0) {
      data.push({ label: t('admin.dashboard.statusOther'), value: other });
    }
    return data;
  }, [normalizedStats.exchanges, t]);

  const userStatusData = useMemo(() => {
    const { active, inactive, total } = normalizedStats.users;
    const other = Math.max(total - (active + inactive), 0);
    const data = [
      { label: t('admin.dashboard.statusActive'), value: active },
      { label: t('admin.dashboard.statusInactive'), value: inactive },
    ];
    if (other > 0) {
      data.push({ label: t('admin.dashboard.statusOther'), value: other });
    }
    return data;
  }, [normalizedStats.users, t]);

  const messageStatusData = useMemo(() => ([
    { label: t('admin.dashboard.unreadMessages'), value: normalizedStats.messages.unread },
    { label: t('admin.dashboard.readMessages'), value: normalizedStats.messages.read },
  ]), [normalizedStats.messages, t]);

  const miniStats = useMemo(() => {
    const { users, transactions, carbon, trendSummary } = normalizedStats;
    const activeRatioValue = users.activeRatio ?? safeDivide(users.active, users.total);
    const avgPointsValue = transactions.avgPointsPerTransaction;
    const pointsLast7Value = transactions.last7PointsAwarded ?? 0;
    const pendingCarbonValue = carbon.pendingRecords ?? 0;
    const avgDailyCarbonValue = trendSummary.averageDailyCarbon30d ?? 0;

    const formatPercentValue = (value) => {
      if (value === null || value === undefined) {
        return '--';
      }
      const numeric = Number(value);
      return Number.isFinite(numeric) ? percentFormatter.format(numeric) : '--';
    };

    const formatDecimalValue = (value, unit = '') => {
      if (value === null || value === undefined) {
        return '--';
      }
      const numeric = Number(value);
      if (!Number.isFinite(numeric)) {
        return '--';
      }
      return `${decimalFormatter.format(numeric)}${unit}`.trim();
    };

    return [
      {
        key: 'activeRatio',
        label: t('admin.dashboard.mini.activeRatio'),
        value: formatPercentValue(activeRatioValue),
      },
      {
        key: 'avgPoints',
        label: t('admin.dashboard.mini.avgPointsPerTransaction'),
        value: formatDecimalValue(avgPointsValue, ` ${t('units.points')}`),
      },
      {
        key: 'pointsLast7',
        label: t('admin.dashboard.mini.pointsLast7'),
        value: formatDecimalValue(pointsLast7Value, ` ${t('units.points')}`),
      },
      {
        key: 'pendingCarbon',
        label: t('admin.dashboard.mini.pendingCarbonRecords'),
        value: integerFormatter.format(Math.max(0, pendingCarbonValue)),
      },
      {
        key: 'avgDailyCarbon',
        label: t('admin.dashboard.mini.averageDailyCarbon30d'),
        value: formatDecimalValue(avgDailyCarbonValue, ` ${t('units.kg')}`),
      },
    ];
  }, [normalizedStats, t, percentFormatter, decimalFormatter, integerFormatter]);

  const insights = useMemo(() => {
    const { users, transactions, exchanges, messages, carbon, trendSummary } = normalizedStats;

    const approvalRate = Number.isFinite(transactions.approvalRate)
      ? transactions.approvalRate
      : safeDivide(transactions.approved, transactions.total);
    const carbonPerUser = users.active > 0 ? carbon.totalCarbonSaved / users.active : 0;
    const unreadRate = Number.isFinite(messages.unreadRatio)
      ? messages.unreadRatio
      : safeDivide(messages.unread, messages.total);
    const pointsRedemptionRate = transactions.totalPointsAwarded > 0
      ? exchanges.totalPointsSpent / transactions.totalPointsAwarded
      : 0;
    const transactionsPerActiveUser = users.active > 0 ? transactions.total / users.active : 0;

    const weeklyDeltaText =
      trendSummary.carbonPrev7 > 0 || trendSummary.carbonLast7 > 0
        ? trendSummary.carbonDelta >= 0
          ? t('admin.dashboard.insights.carbonLast7DaysDeltaPositive', {
              delta: decimalFormatter.format(trendSummary.carbonDelta),
              rate: percentFormatter.format(Math.abs(trendSummary.carbonDeltaRate)),
            })
          : t('admin.dashboard.insights.carbonLast7DaysDeltaNegative', {
              delta: decimalFormatter.format(Math.abs(trendSummary.carbonDelta)),
              rate: percentFormatter.format(Math.abs(trendSummary.carbonDeltaRate)),
            })
        : t('admin.dashboard.noData');

    return [
      {
        key: 'approval',
        label: t('admin.dashboard.insights.approvalRate'),
        value: percentFormatter.format(approvalRate),
        description: t('admin.dashboard.insights.approvalRateHint', {
          approved: integerFormatter.format(transactions.approved),
          total: integerFormatter.format(transactions.total),
        }),
      },
      {
        key: 'carbonPerUser',
        label: t('admin.dashboard.insights.carbonPerUser'),
        value: `${decimalFormatter.format(carbonPerUser)} ${t('units.kg')}`,
        description: t('admin.dashboard.insights.carbonPerUserHint', {
          active: integerFormatter.format(users.active),
        }),
      },
      {
        key: 'weeklyCarbon',
        label: t('admin.dashboard.insights.carbonLast7Days'),
        value: `${decimalFormatter.format(trendSummary.carbonLast7)} ${t('units.kg')}`,
        description: weeklyDeltaText,
      },
      {
        key: 'unreadRate',
        label: t('admin.dashboard.insights.unreadRate'),
        value: percentFormatter.format(unreadRate),
        description: t('admin.dashboard.insights.unreadRateHint', {
          unread: integerFormatter.format(messages.unread),
          total: integerFormatter.format(messages.total),
        }),
      },
      {
        key: 'pointsRedemption',
        label: t('admin.dashboard.insights.pointsRedemption'),
        value: percentFormatter.format(pointsRedemptionRate),
        description: t('admin.dashboard.insights.pointsRedemptionHint', {
          spent: integerFormatter.format(exchanges.totalPointsSpent),
          awarded: integerFormatter.format(transactions.totalPointsAwarded),
        }),
      },
      {
        key: 'transactionsPerUser',
        label: t('admin.dashboard.insights.transactionsPerUser'),
        value: decimalFormatter.format(transactionsPerActiveUser),
        description: t('admin.dashboard.insights.transactionsPerUserHint', {
          active: integerFormatter.format(users.active),
        }),
      },
      {
        key: 'dailyCarbon',
        label: t('admin.dashboard.insights.averageDailyCarbon'),
        value: `${decimalFormatter.format(carbon.averageDailyCarbon)} ${t('units.kg')}`,
        description: t('admin.dashboard.insights.averageDailyCarbonHint', {
          records: integerFormatter.format(carbon.totalRecords),
        }),
      },
    ];
  }, [normalizedStats, t, integerFormatter, decimalFormatter, percentFormatter]);

  const topCarbonDays = useMemo(() => {
    if (!normalizedStats.trends.length) {
      return [];
    }
    return [...normalizedStats.trends]
      .sort((a, b) => b.carbon_saved - a.carbon_saved)
      .slice(0, 5);
  }, [normalizedStats.trends]);

  const openAdminExchangeDetail = useCallback((exchange) => {
    if (!exchange?.id) {
      navigate('/admin/exchanges');
      return;
    }
    navigate('/admin/exchanges', {
      state: {
        selectedExchange: exchange,
      },
    });
  }, [navigate]);

  const openAdminActivityReviewDetail = useCallback((activity) => {
    if (!activity?.id) {
      navigate('/admin/activities?tab=review');
      return;
    }
    navigate('/admin/activities?tab=review', {
      state: {
        selectedActivity: activity,
      },
    });
  }, [navigate]);

  const openAdminUserDetail = useCallback((user) => {
    if (!user) {
      navigate('/admin/users');
      return;
    }

    const searchParams = new URLSearchParams();
    const preferredUuid = user.uuid || user.user_uuid || user.userUuid || null;
    if (preferredUuid) {
      searchParams.set('userUuid', String(preferredUuid));
    } else if (user.id) {
      searchParams.set('userId', String(user.id));
    }

    const query = searchParams.toString();
    navigate(query ? `/admin/users?${query}` : '/admin/users');
  }, [navigate]);

  const summaryCards = useMemo(() => {
    const newUserShare = normalizedStats.users.total
      ? percentFormatter.format(normalizedStats.users.newUsersRatio ?? safeDivide(normalizedStats.users.new30d, normalizedStats.users.total))
      : t('admin.dashboard.noData');

    const weeklyCarbonDeltaText =
      trendSummary.carbonPrev7 > 0 || trendSummary.carbonLast7 > 0
        ? trendSummary.carbonDelta >= 0
          ? t('admin.dashboard.summaryCarbonTrendUp', {
              value: decimalFormatter.format(trendSummary.carbonDelta),
              rate: percentFormatter.format(Math.abs(trendSummary.carbonDeltaRate)),
            })
          : t('admin.dashboard.summaryCarbonTrendDown', {
              value: decimalFormatter.format(Math.abs(trendSummary.carbonDelta)),
              rate: percentFormatter.format(Math.abs(trendSummary.carbonDeltaRate)),
            })
        : t('admin.dashboard.noData');

    return [
      {
        key: 'users',
        icon: Users,
        title: t('admin.dashboard.totalUsers'),
        primary: integerFormatter.format(normalizedStats.users.total),
        secondary: `${t('admin.dashboard.activeUsers')}: ${integerFormatter.format(normalizedStats.users.active)}`,
        onClick: () => navigate('/admin/users'),
      },
      {
        key: 'newUsers',
        icon: TrendingUp,
        title: t('admin.dashboard.newUsers30d'),
        primary: integerFormatter.format(normalizedStats.users.new30d),
        secondary:
          normalizedStats.users.total > 0
            ? t('admin.dashboard.newUsers30dShare', { value: newUserShare })
            : t('admin.dashboard.noData'),
      },
      {
        key: 'transactions',
        icon: LineChartIcon,
        title: t('admin.dashboard.totalTransactions'),
        primary: integerFormatter.format(normalizedStats.transactions.total),
        secondary: `${t('admin.dashboard.approvedTransactions')}: ${integerFormatter.format(normalizedStats.transactions.approved)} · ${t('admin.dashboard.pendingTransactions')}: ${integerFormatter.format(normalizedStats.transactions.pending)}`,
        onClick: () => navigate('/admin/activities'),
      },
      {
        key: 'carbon',
        icon: Leaf,
        title: t('admin.dashboard.totalCarbonSaved'),
        primary: `${decimalFormatter.format(carbonStats.totalCarbonSaved)} ${t('units.kg')}`,
        secondary: `${t('admin.dashboard.totalPointsAwarded')}: ${integerFormatter.format(normalizedStats.transactions.totalPointsAwarded)}`,
      },
      {
        key: 'exchanges',
        icon: Package,
        title: t('admin.dashboard.totalExchanges'),
        primary: integerFormatter.format(normalizedStats.exchanges.total),
        secondary: `${t('admin.dashboard.pendingExchanges')}: ${integerFormatter.format(normalizedStats.exchanges.pending)} · ${t('admin.dashboard.totalPointsSpent')}: ${integerFormatter.format(normalizedStats.exchanges.totalPointsSpent)}`,
        onClick: () => navigate('/admin/exchanges'),
      },
      {
        key: 'activities',
        icon: Activity,
        title: t('admin.dashboard.totalActivities'),
        primary: integerFormatter.format(normalizedStats.activities.totalRecords),
        secondary: `${t('admin.dashboard.approvedActivities')}: ${integerFormatter.format(normalizedStats.activities.approvedRecords)} · ${t('admin.dashboard.pendingActivities')}: ${integerFormatter.format(normalizedStats.activities.pendingRecords)}`,
        onClick: () => navigate('/admin/activities'),
      },
      {
        key: 'messages',
        icon: MessageSquare,
        title: t('admin.dashboard.totalMessages'),
        primary: integerFormatter.format(normalizedStats.messages.total),
        secondary: `${t('admin.dashboard.unreadMessages')}: ${integerFormatter.format(normalizedStats.messages.unread)}`,
        onClick: () => navigate('/admin/broadcast'),
      },
      {
        key: 'carbon7d',
        icon: Leaf,
        title: t('admin.dashboard.carbonSaved7d'),
        primary: `${decimalFormatter.format(trendSummary.carbonLast7)} ${t('units.kg')}`,
        secondary: weeklyCarbonDeltaText,
      },
    ];
  }, [normalizedStats, trendSummary, t, integerFormatter, decimalFormatter, percentFormatter, navigate, carbonStats]);

  const renderDonutChart = (data) => {
    const total = data.reduce((sum, item) => sum + safeNumber(item.value), 0);
    if (total <= 0) {
      return (
        <div className="flex h-full flex-col items-center justify-center space-y-3">
          <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
            <Activity className="h-8 w-8 text-muted-foreground/50" />
          </div>
          <p className="text-sm text-muted-foreground">{t('admin.dashboard.noData')}</p>
        </div>
      );
    }
    return (
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <defs>
            {CHART_GRADIENTS.map((gradient, index) => (
              <linearGradient key={index} id={`pieGradient-${index}`} x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={gradient.start} stopOpacity={0.9}/>
                <stop offset="100%" stopColor={gradient.end} stopOpacity={1}/>
              </linearGradient>
            ))}
            {/* 添加径向渐变效果 */}
            {CHART_GRADIENTS.map((gradient, index) => (
              <radialGradient key={`radial-${index}`} id={`pieRadial-${index}`}>
                <stop offset="0%" stopColor={gradient.start} stopOpacity={1}/>
                <stop offset="100%" stopColor={gradient.end} stopOpacity={0.85}/>
              </radialGradient>
            ))}
          </defs>
          <Pie 
            data={data} 
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
            {data.map((entry, index) => (
              <Cell 
                key={entry.label} 
                fill={`url(#pieRadial-${index % CHART_GRADIENTS.length})`}
                className="hover:opacity-80 transition-opacity duration-200 cursor-pointer"
                style={{
                  filter: 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.1))',
                }}
              />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value, name) => [integerFormatter.format(value), name]}
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
          <Legend 
            verticalAlign="bottom"
            height={36}
            iconType="circle"
            wrapperStyle={{ 
              paddingTop: '12px', 
              fontSize: '12px',
              fontWeight: '500',
            }}
          />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  return (
    <div className="min-h-screen min-w-0 w-full max-w-full space-y-8 overflow-x-clip pb-8">
      {/* Hero Header Section */}
      <Card className="min-w-0 overflow-hidden border-2 transition-shadow duration-300 hover:shadow-lg">
        <CardHeader className="space-y-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between sm:gap-6">
            <div className="min-w-0 space-y-3">
              <div className="flex items-center gap-3">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg shadow-green-500/20">
                  <LineChartIcon className="h-7 w-7 text-white" />
                </div>
                <div className="min-w-0">
                  <CardTitle className="break-words bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-2xl font-bold tracking-tight text-transparent sm:text-3xl">
                    {t('admin.dashboard.title')}
                  </CardTitle>
                  <CardDescription className="mt-1 break-words text-base">
                    {t('admin.dashboard.description')}
                  </CardDescription>
                </div>
              </div>
            </div>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:flex-wrap sm:items-center">
              <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-2.5 shadow-sm">
                <input
                  type="checkbox"
                  className="h-4 w-4 rounded border-input bg-background text-green-600 focus:ring-2 focus:ring-green-500 focus:ring-offset-0"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                />
                <span className="text-sm font-medium">
                  {t('admin.dashboard.autoRefresh')}
                </span>
              </div>
              <Button 
                size="default" 
                className="w-full rounded-xl bg-gradient-to-r from-green-500 to-emerald-600 shadow-md transition-all duration-200 hover:from-green-600 hover:to-emerald-700 hover:shadow-lg sm:w-auto" 
                onClick={() => refetch()} 
                disabled={isFetching}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                {t('admin.dashboard.refreshNow')}
              </Button>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-muted/30 px-4 py-2 text-sm text-muted-foreground">
            <Clock className="h-4 w-4 text-green-600" />
            <span className="break-words">
              {t('admin.dashboard.lastUpdated')}: <span className="font-medium text-foreground">{lastUpdated ? formatDateTime(lastUpdated) : '--'}</span>
            </span>
          </div>
        </CardHeader>
          <CardContent className="pb-8">
            {isLoading && (
              <div className="flex flex-col items-center justify-center py-16 space-y-4">
                <div className="relative">
                  <div className="h-16 w-16 rounded-full border-4 border-green-100 dark:border-green-900" />
                  <Loader2 className="absolute inset-0 m-auto h-16 w-16 animate-spin text-green-500" />
                </div>
                <span className="text-base font-medium text-muted-foreground">{t('common.loading')}</span>
              </div>
            )}
            {isError && (
              <Alert variant="destructive" className="border-2">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle className="text-base">{t('common.error')}</AlertTitle>
                <AlertDescription className="text-sm">{error?.message || t('errors.loadFailed')}</AlertDescription>
              </Alert>
            )}
            {!isLoading && !isError && (
              <>
                {/* Main Stats Grid */}
                <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-4">
                  {summaryCards.map((item, index) => {
                    const Icon = item.icon;
                    const gradients = [
                      'from-blue-500/10 to-blue-600/10 dark:from-blue-500/20 dark:to-blue-600/20',
                      'from-green-500/10 to-emerald-600/10 dark:from-green-500/20 dark:to-emerald-600/20',
                      'from-purple-500/10 to-violet-600/10 dark:from-purple-500/20 dark:to-violet-600/20',
                      'from-orange-500/10 to-amber-600/10 dark:from-orange-500/20 dark:to-amber-600/20',
                      'from-pink-500/10 to-rose-600/10 dark:from-pink-500/20 dark:to-rose-600/20',
                      'from-teal-500/10 to-cyan-600/10 dark:from-teal-500/20 dark:to-cyan-600/20',
                      'from-indigo-500/10 to-blue-600/10 dark:from-indigo-500/20 dark:to-blue-600/20',
                      'from-emerald-500/10 to-green-600/10 dark:from-emerald-500/20 dark:to-green-600/20',
                    ];
                    const iconColors = [
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
                      <Card
                        key={item.key}
                        className={`group relative overflow-hidden border-2 transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${
                          item.onClick ? 'cursor-pointer' : ''
                        }`}
                        onClick={item.onClick}
                      >
                        <div className={`absolute inset-0 bg-gradient-to-br ${gradients[index % gradients.length]} opacity-0 group-hover:opacity-100 transition-opacity duration-300`} />
                        <CardContent className="relative p-6 space-y-4">
                          <div className="flex items-start justify-between">
                            <div className={`flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br ${gradients[index % gradients.length]} shadow-md group-hover:scale-110 transition-transform duration-300`}>
                              <Icon className={`h-7 w-7 ${iconColors[index % iconColors.length]}`} />
                            </div>
                            {item.onClick && (
                              <ArrowUpRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity duration-200" />
                            )}
                          </div>
                          <div className="space-y-2">
                            <p className="text-sm font-medium uppercase tracking-wider text-muted-foreground">
                              {item.title}
                            </p>
                            <p className="text-3xl font-bold tracking-tight">{item.primary}</p>
                            <p className="text-xs text-muted-foreground leading-relaxed">{item.secondary}</p>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>

                {/* Mini Stats Bar */}
                <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-5">
                  {miniStats.map((item, index) => {
                    const borderColors = [
                      'border-l-blue-500',
                      'border-l-green-500',
                      'border-l-purple-500',
                      'border-l-orange-500',
                      'border-l-pink-500',
                    ];
                    return (
                      <div 
                        key={item.key} 
                        className={`group rounded-xl border-2 border-l-4 ${borderColors[index % borderColors.length]} bg-card/50 backdrop-blur p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5`}
                      >
                        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
                          {item.label}
                        </p>
                        <p className="text-xl font-bold group-hover:scale-105 transition-transform duration-200">
                          {item.value}
                        </p>
                      </div>
                    );
                  })}
                </div>
            </>
          )}
        </CardContent>
      </Card>      {!isLoading && !isError && (
        <>
          {/* Trends and Insights Section */}
          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="xl:col-span-2 border-2 hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <CardTitle className="flex items-center gap-2 text-2xl">
                      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500/10 to-violet-600/10">
                        <Activity className="h-5 w-5 text-purple-600" />
                      </div>
                      {t('admin.dashboard.trendsTitle')}
                    </CardTitle>
                    <CardDescription className="text-sm">{t('admin.dashboard.trendsSubtitle')}</CardDescription>
                  </div>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    className="rounded-xl border-2 hover:bg-purple-50 hover:border-purple-200 dark:hover:bg-purple-950/30 transition-all duration-200"
                    onClick={() => navigate('/admin/activities')}
                  >
                    <LineChartIcon className="h-4 w-4 mr-2" />
                    {t('admin.dashboard.viewActivities')}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="h-96 pb-6">
                {trendChartData.length ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={trendChartData} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
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
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.3} />
                      <XAxis 
                        dataKey="date" 
                        minTickGap={20} 
                        tickFormatter={(value) => formatDateLabel(value, shortDateFormatter)}
                        stroke="hsl(var(--muted-foreground))"
                        style={{ fontSize: '12px' }}
                      />
                      <YAxis 
                        yAxisId="left" 
                        allowDecimals={false}
                        stroke="#8b5cf6"
                        style={{ fontSize: '12px', fontWeight: '500' }}
                      />
                      <YAxis 
                        yAxisId="right" 
                        orientation="right" 
                        tickFormatter={(value) => decimalFormatter.format(value)}
                        stroke="#10b981"
                        style={{ fontSize: '12px', fontWeight: '500' }}
                      />
                      <Tooltip
                        contentStyle={{ 
                          backgroundColor: 'hsl(var(--card))',
                          border: '2px solid hsl(var(--border))',
                          borderRadius: '12px',
                          boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)',
                          padding: '12px',
                        }}
                        labelStyle={{ fontWeight: '600', marginBottom: '8px', color: 'hsl(var(--foreground))' }}
                        labelFormatter={(value) => formatDateLabel(value, longDateFormatter)}
                        formatter={(value, name) => {
                          if (typeof value === 'number') {
                            if (
                              name === t('admin.dashboard.trendsCarbonSaved') ||
                              name === t('admin.dashboard.trendsCarbonAverage')
                            ) {
                              return [`${decimalFormatter.format(value)} ${t('units.kg')}`, name];
                            }
                            return [integerFormatter.format(value), name];
                          }
                          return [value, name];
                        }}
                      />
                      <Legend 
                        wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: '500' }}
                        iconType="circle"
                      />
                      <Bar
                        yAxisId="left"
                        dataKey="transactions"
                        name={t('admin.dashboard.trendsTransactions')}
                        fill="url(#barGradient)"
                        radius={[8, 8, 0, 0]}
                        maxBarSize={60}
                      />
                      <Area
                        yAxisId="right"
                        type="monotone"
                        dataKey="carbon_saved"
                        name={t('admin.dashboard.trendsCarbonSaved')}
                        stroke="#10b981"
                        fill="url(#colorCarbon)"
                        strokeWidth={3}
                        dot={{ r: 5, strokeWidth: 2, fill: '#ffffff', stroke: '#10b981' }}
                        activeDot={{ r: 7, strokeWidth: 2 }}
                      />
                      <Line
                        yAxisId="right"
                        type="monotone"
                        dataKey="carbon_avg"
                        name={t('admin.dashboard.trendsCarbonAverage')}
                        stroke="#f59e0b"
                        strokeWidth={3}
                        strokeDasharray="8 4"
                        dot={false}
                      />
                    </ComposedChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex h-full items-center justify-center">
                    <div className="text-center space-y-3">
                      <div className="flex justify-center">
                        <div className="h-16 w-16 rounded-full bg-muted/50 flex items-center justify-center">
                          <LineChartIcon className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">{t('admin.dashboard.noData')}</p>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-xl">
                  <Sparkles className="h-5 w-5 text-yellow-500" />
                  {t('admin.dashboard.keyInsights')}
                </CardTitle>
                <CardDescription className="text-sm">{t('admin.dashboard.keyInsightsSubtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-6">
                {insights.map((insight, index) => {
                  const bgGradients = [
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
                      key={insight.key} 
                      className={`group rounded-xl border-2 bg-gradient-to-br ${bgGradients[index % bgGradients.length]} p-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                          {insight.label}
                        </span>
                        <span className="text-xl font-bold group-hover:scale-110 transition-transform duration-200">
                          {insight.value}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground leading-relaxed">{insight.description}</p>
                    </div>
                  );
                })}
              </CardContent>
            </Card>
          </div>

          {/* Status Distribution Charts */}
          <div className="grid gap-6 md:grid-cols-2 xl:grid-cols-4">
            <Card className="group border-2 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <LineChartIcon className="h-4 w-4 text-blue-600" />
                  </div>
                  {t('admin.dashboard.transactionStatusTitle')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('admin.dashboard.transactionStatusSubtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-72 pb-4">
                {renderDonutChart(transactionStatusData)}
              </CardContent>
            </Card>

            <Card className="group border-2 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500/10 to-green-600/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <Users className="h-4 w-4 text-green-600" />
                  </div>
                  {t('admin.dashboard.userStatusTitle')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('admin.dashboard.userStatusSubtitle', {
                    newUsers: integerFormatter.format(normalizedStats.users.new30d),
                  })}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-72 pb-4">
                {renderDonutChart(userStatusData)}
              </CardContent>
            </Card>

            <Card className="group border-2 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-purple-500/10 to-purple-600/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <Package className="h-4 w-4 text-purple-600" />
                  </div>
                  {t('admin.dashboard.exchangeStatusTitle')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('admin.dashboard.exchangeStatusSubtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-72 pb-4">
                {renderDonutChart(exchangeStatusData)}
              </CardContent>
            </Card>

            <Card className="group border-2 hover:shadow-xl transition-all duration-300 hover:-translate-y-1">
              <CardHeader className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-orange-500/10 to-orange-600/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-200">
                    <MessageSquare className="h-4 w-4 text-orange-600" />
                  </div>
                  {t('admin.dashboard.messageStatusTitle')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('admin.dashboard.messageStatusSubtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="h-72 pb-4">
                {renderDonutChart(messageStatusData)}
              </CardContent>
            </Card>
          </div>

          {/* Top Carbon Days */}
          <Card className="border-2 hover:shadow-lg transition-shadow duration-300">
            <CardHeader className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="space-y-1">
                  <CardTitle className="flex items-center gap-2 text-2xl">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-green-500/10 to-emerald-600/10">
                      <TrendingUp className="h-5 w-5 text-green-600" />
                    </div>
                    {t('admin.dashboard.topCarbonDaysTitle')}
                  </CardTitle>
                  <CardDescription className="text-sm">
                    {t('admin.dashboard.topCarbonDaysSubtitle')}
                  </CardDescription>
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  className="rounded-xl border-2 hover:bg-green-50 hover:border-green-200 dark:hover:bg-green-950/30 transition-all duration-200"
                  onClick={() => navigate('/admin/activities')}
                >
                  <Activity className="h-4 w-4 mr-2" />
                  {t('admin.dashboard.viewActivities')}
                </Button>
              </div>
            </CardHeader>
            <CardContent className="pb-6">
              {topCarbonDays.length ? (
                <div className="space-y-3">
                  {topCarbonDays.map((day, index) => {
                    const rankColors = [
                      'from-yellow-400 to-yellow-600 text-white shadow-lg shadow-yellow-500/30',
                      'from-gray-300 to-gray-500 text-white shadow-lg shadow-gray-500/30',
                      'from-orange-400 to-orange-600 text-white shadow-lg shadow-orange-500/30',
                      'from-blue-400 to-blue-600 text-white',
                      'from-purple-400 to-purple-600 text-white',
                    ];
                    return (
                      <div
                        key={day.date}
                        className="group flex items-center gap-4 rounded-xl border-2 bg-gradient-to-r from-card to-muted/20 px-5 py-4 transition-all duration-300 hover:shadow-md hover:-translate-y-0.5"
                      >
                        <div className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br ${rankColors[index]} font-bold transition-transform duration-200 group-hover:scale-110`}>
                          {index + 1}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-base truncate">
                            {formatDateLabel(day.date, longDateFormatter)}
                          </p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            {t('admin.dashboard.trendsTransactions')}: <span className="font-medium text-foreground">{integerFormatter.format(day.transactions)}</span>
                          </p>
                        </div>
                        <div className="flex items-center gap-2 text-right">
                          <Leaf className="h-5 w-5 text-green-600 flex-shrink-0" />
                          <div>
                            <div className="text-lg font-bold whitespace-nowrap">
                              {decimalFormatter.format(day.carbon_saved)}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {t('units.kg')}
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
                    <TrendingUp className="h-8 w-8 text-muted-foreground/50" />
                  </div>
                  <p className="text-sm text-muted-foreground">{t('admin.dashboard.noData')}</p>
                </div>
              )}
            </CardContent>
          </Card>
          {/* Recent Activity Section */}
          <div className="grid gap-6 xl:grid-cols-3">
            <Card className="border-2 hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-amber-500/10 to-amber-600/10 flex items-center justify-center">
                    <Clock className="h-4 w-4 text-amber-600" />
                  </div>
                  {t('admin.dashboard.recentPendingTransactions')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('admin.dashboard.recentPendingTransactionsSubtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-6">
                {recent.pendingTransactions.length ? (
                  recent.pendingTransactions.map((item) => (
                    <div 
                      key={item.id} 
                      role="button"
                      tabIndex={0}
                      className="group cursor-pointer rounded-xl border-2 bg-gradient-to-r from-card to-amber-50/30 px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:to-amber-950/10"
                      onClick={() => openAdminExchangeDetail(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openAdminExchangeDetail(item);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="font-semibold text-sm truncate">
                          {item.username || t('admin.dashboard.unknownUser')}
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-amber-700 dark:text-amber-400 whitespace-nowrap">
                          <Sparkles className="h-3.5 w-3.5" />
                          {decimalFormatter.format(safeNumber(item.points))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="truncate">{formatDateTime(item.created_at)}</span>
                        <span className="uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300">
                          {item.status}
                        </span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 space-y-2">
                    <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                      <Clock className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t('admin.dashboard.noPendingTransactions')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-green-500/10 to-emerald-600/10 flex items-center justify-center">
                    <Leaf className="h-4 w-4 text-green-600" />
                  </div>
                  {t('admin.dashboard.recentPendingCarbon')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('admin.dashboard.recentPendingCarbonSubtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-6">
                {recent.pendingCarbonRecords.length ? (
                  recent.pendingCarbonRecords.map((item) => (
                    <div 
                      key={item.id} 
                      role="button"
                      tabIndex={0}
                      className="group cursor-pointer rounded-xl border-2 bg-gradient-to-r from-card to-green-50/30 px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:to-green-950/10"
                      onClick={() => openAdminActivityReviewDetail(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openAdminActivityReviewDetail(item);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between gap-3 mb-2">
                        <span className="font-semibold text-sm truncate">
                          {(isEnglish
                            ? item.activity_name_en || item.activity_name_zh
                            : item.activity_name_zh || item.activity_name_en) || item.activity_id || t('admin.dashboard.unknownActivity')}
                        </span>
                        <div className="flex items-center gap-1.5 font-mono text-sm font-bold text-green-700 dark:text-green-400 whitespace-nowrap">
                          <Leaf className="h-3.5 w-3.5" />
                          {decimalFormatter.format(safeNumber(item.carbon_saved))}
                        </div>
                      </div>
                      <div className="flex items-center justify-between text-xs text-muted-foreground">
                        <span className="truncate">{item.username || t('admin.dashboard.unknownUser')}</span>
                        <span className="truncate">{formatDateTime(item.created_at)}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 space-y-2">
                    <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                      <Leaf className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t('admin.dashboard.noPendingCarbon')}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-2 hover:shadow-lg transition-shadow duration-300">
              <CardHeader className="space-y-2">
                <CardTitle className="flex items-center gap-2 text-lg">
                  <div className="h-8 w-8 rounded-lg bg-gradient-to-br from-blue-500/10 to-blue-600/10 flex items-center justify-center">
                    <Users className="h-4 w-4 text-blue-600" />
                  </div>
                  {t('admin.dashboard.latestUsers')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('admin.dashboard.latestUsersSubtitle')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3 pb-6">
                {recent.latestUsers.length ? (
                  recent.latestUsers.map((item) => (
                    <div 
                      key={item.id} 
                      role="button"
                      tabIndex={0}
                      className="group cursor-pointer rounded-xl border-2 bg-gradient-to-r from-card to-blue-50/30 px-4 py-3 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:to-blue-950/10"
                      onClick={() => openAdminUserDetail(item)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault();
                          openAdminUserDetail(item);
                        }
                      }}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1">
                        <span className="font-semibold text-sm truncate">{item.username}</span>
                        <span className="text-xs uppercase tracking-wider font-semibold px-2 py-0.5 rounded-md bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300 whitespace-nowrap">
                          {item.status || t('admin.dashboard.statusUnknown')}
                        </span>
                      </div>
                      <div className="text-xs text-muted-foreground truncate mb-1">
                        {item.email || t('admin.dashboard.noEmail')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatDateTime(item.created_at)}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="flex flex-col items-center justify-center py-8 space-y-2">
                    <div className="h-12 w-12 rounded-full bg-muted/50 flex items-center justify-center">
                      <Users className="h-6 w-6 text-muted-foreground/50" />
                    </div>
                    <p className="text-sm text-muted-foreground">{t('admin.dashboard.noRecentUsers')}</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>


        </>
      )}
    </div>
  );
}
