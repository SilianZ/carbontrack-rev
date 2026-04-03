import React, { useMemo, useState, useCallback } from 'react';
import { useQuery } from 'react-query';
import {
  Activity,
  ShieldCheck,
  Sparkles,
  RefreshCw,
  Users,
  Loader2,
  Clock,
  TrendingUp,
  TrendingDown
} from 'lucide-react';
import {
  ResponsiveContainer,
  ComposedChart,
  BarChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  PieChart,
  Pie,
  Cell,
  Legend
} from 'recharts';

import { adminAPI } from '../../lib/api';
import { searchLogs, fetchRelatedLogs } from '../../lib/api/logSearch';
import { useTranslation } from '../../hooks/useTranslation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '../../components/ui/dialog';
import { ScrollArea } from '../../components/ui/scroll-area';
import { Alert, AlertDescription, AlertTitle } from '../../components/ui/Alert';
import JsonTreeViewer from '../../components/logs/JsonTreeViewer';
import RequestIdRelatedDrawer from '../../components/logs/RequestIdRelatedDrawer';
import { cn } from '../../lib/utils';

const formatNumber = (value, locale) => {
  const num = Number(value);
  return Number.isFinite(num) ? num.toLocaleString(locale) : '-';
};

const safeDate = (value, locale) => (value ? new Date(value).toLocaleString(locale) : '-');

const parseMaybeJson = (value) => {
  if (value == null) return null;
  if (typeof value === 'object') return value;
  if (typeof value !== 'string') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

const CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#0ea5e9'];

const safeNumber = (value, fallback = 0) => {
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
};

const buildTopData = (items, key, limit, otherLabel = 'Other') => {
  const list = Array.isArray(items) ? items : [];
  if (list.length <= limit) return list;
  const top = list.slice(0, limit);
  const rest = list.slice(limit);
  const other = rest.reduce(
    (acc, item) => ({
      calls: acc.calls + safeNumber(item.calls),
      tokens: acc.tokens + safeNumber(item.tokens)
    }),
    { calls: 0, tokens: 0 }
  );
  return [...top, { [key]: otherLabel, ...other }];
};

function StatCard({ title, value, subtitle, icon, tone }) {
  const IconComponent = icon;
  return (
    <Card className={cn('border-l-4', tone)}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
          <IconComponent className="h-4 w-4 text-muted-foreground" />
        </div>
      </CardHeader>
      <CardContent className="space-y-1">
        <div className="text-2xl font-semibold">{value}</div>
        {subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}
      </CardContent>
    </Card>
  );
}

function InsightCard({ title, value, subtitle, trend }) {
  const TrendIcon = trend === 'up' ? TrendingUp : trend === 'down' ? TrendingDown : null;
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
        </div>
        {TrendIcon && (
          <TrendIcon className={cn('h-4 w-4', trend === 'up' ? 'text-emerald-500' : 'text-rose-500')} />
        )}
      </div>
      <div className="mt-2 text-xl font-semibold">{value}</div>
      {subtitle && <div className="mt-1 text-[11px] text-muted-foreground">{subtitle}</div>}
    </div>
  );
}

export default function AdminLlmUsagePage() {
  const { t, currentLanguage } = useTranslation();
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [limit] = useState(20);
  const [trendDays, setTrendDays] = useState(30);
  const [recentLimit] = useState(8);
  const [logQuery, setLogQuery] = useState('');
  const [logConversationId, setLogConversationId] = useState('');
  const [logTurnNo, setLogTurnNo] = useState('');
  const [sessionAdminId, setSessionAdminId] = useState('');
  const [sessionStatus, setSessionStatus] = useState('');
  const [sessionModel, setSessionModel] = useState('');
  const [sessionDateFrom, setSessionDateFrom] = useState('');
  const [sessionDateTo, setSessionDateTo] = useState('');
  const [sessionPendingFilter, setSessionPendingFilter] = useState('');
  const [selectedLogId, setSelectedLogId] = useState(null);
  const [selectedConversationId, setSelectedConversationId] = useState(null);
  const [requestDrawerId, setRequestDrawerId] = useState(null);
  const [related, setRelated] = useState({ system: [], audit: [], error: [], llm: [] });
  const [loadingRelated, setLoadingRelated] = useState(false);

  const usageQuery = useQuery(
    ['llmUsage', { search, page, limit }],
    async () => {
      const response = await adminAPI.getLlmUsage({ q: search, page, limit });
      return response.data?.data || response.data;
    },
    { keepPreviousData: true }
  );

  const logsQuery = useQuery(
    ['llmUsageLogs', { logQuery, logConversationId, logTurnNo }],
    async () => {
      const response = await searchLogs({
        q: logQuery,
        types: ['llm'],
        limit_per_type: 30,
        conversation_id: logConversationId || undefined,
        turn_no: logTurnNo || undefined
      });
      return response.data || response;
    },
    { keepPreviousData: true }
  );

  const analyticsQuery = useQuery(
    ['llmUsageAnalytics', trendDays, recentLimit],
    async () => {
      const response = await adminAPI.getLlmUsageAnalytics({ days: trendDays, recent_limit: recentLimit });
      return response.data?.data || response.data;
    },
    { keepPreviousData: true }
  );

  const conversationsQuery = useQuery(
    ['adminAiConversations', {
      sessionAdminId,
      sessionStatus,
      sessionModel,
      sessionDateFrom,
      sessionDateTo,
      sessionPendingFilter
    }],
    async () => {
      const response = await adminAPI.getAiConversations({
        limit: 20,
        admin_id: sessionAdminId || undefined,
        status: sessionStatus || undefined,
        model: sessionModel || undefined,
        date_from: sessionDateFrom || undefined,
        date_to: sessionDateTo || undefined,
        has_pending_action: sessionPendingFilter || undefined
      });
      return response.data?.data || [];
    },
    { keepPreviousData: true }
  );

  const conversationDetailQuery = useQuery(
    ['adminAiConversationDetail', selectedConversationId],
    async () => {
      const response = await adminAPI.getAiConversation(selectedConversationId);
      return response.data?.data || response.data;
    },
    { enabled: Boolean(selectedConversationId) }
  );

  const logDetailQuery = useQuery(
    ['llmLogDetail', selectedLogId],
    async () => {
      const response = await adminAPI.getLlmLogDetail(selectedLogId);
      return response.data?.data || response.data;
    },
    { enabled: Boolean(selectedLogId) }
  );

  const usageData = usageQuery.data || {};
  const summary = useMemo(() => usageQuery.data?.summary || {}, [usageQuery.data]);
  const users = usageData.users || [];
  const pagination = usageData.pagination || {};

  const analyticsData = analyticsQuery.data || {};
  const trendData = analyticsData.trends || [];
  const distributions = analyticsData.distributions || {};
  const insights = useMemo(() => analyticsQuery.data?.insights || {}, [analyticsQuery.data]);
  const recentConversations = analyticsData.recent_conversations || [];

  const llmLogs = logsQuery.data?.data?.llm?.items || [];
  const conversationItems = Array.isArray(conversationsQuery.data) ? conversationsQuery.data : [];

  const canPrev = page > 1;
  const canNext = page < (pagination.total_pages || 1);

  const integerFormatter = useMemo(() => new Intl.NumberFormat(currentLanguage), [currentLanguage]);
  const decimalFormatter = useMemo(() => new Intl.NumberFormat(currentLanguage, { maximumFractionDigits: 2 }), [currentLanguage]);
  const percentFormatter = useMemo(() => new Intl.NumberFormat(currentLanguage, { style: 'percent', maximumFractionDigits: 1 }), [currentLanguage]);
  const shortDateFormatter = useMemo(() => new Intl.DateTimeFormat(currentLanguage, { month: 'short', day: 'numeric' }), [currentLanguage]);
  const chartTooltipContentStyle = useMemo(() => ({
    backgroundColor: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.18)',
    color: 'var(--popover-foreground)'
  }), []);
  const chartTooltipLabelStyle = useMemo(() => ({
    color: 'var(--muted-foreground)',
    fontWeight: 600
  }), []);
  const chartTooltipItemStyle = useMemo(() => ({
    color: 'var(--popover-foreground)'
  }), []);

  const modelData = useMemo(
    () => buildTopData(distributions.models, 'model', 6, t('admin.llmUsage.other')),
    [distributions.models, t]
  );
  const sourceData = useMemo(
    () => buildTopData(distributions.sources, 'source', 6, t('admin.llmUsage.other')),
    [distributions.sources, t]
  );
  const actorData = useMemo(
    () => (distributions.actors || []).map((item) => ({
      ...item,
      actor_label: item.actor_type === 'admin'
        ? t('admin.llmUsage.actorAdmin')
        : item.actor_type === 'user'
          ? t('admin.llmUsage.actorUser')
          : item.actor_type
    })),
    [distributions.actors, t]
  );

  const formatTrendDate = useCallback(
    (value) => {
      if (!value) return value;
      const date = new Date(`${value}T00:00:00`);
      return Number.isNaN(date.getTime()) ? value : shortDateFormatter.format(date);
    },
    [shortDateFormatter]
  );

  const formatDelta = useCallback(
    (delta, rate) => {
      if (delta == null) return '-';
      const sign = delta > 0 ? '+' : '';
      const main = `${sign}${integerFormatter.format(delta)}`;
      if (rate == null) return main;
      return `${main} (${percentFormatter.format(Math.abs(rate))})`;
    },
    [integerFormatter, percentFormatter]
  );

  const insightCards = useMemo(() => ([
    {
      key: 'successRate',
      title: t('admin.llmUsage.insights.successRate'),
      value: insights.success_rate == null ? '-' : percentFormatter.format(insights.success_rate),
      subtitle: t('admin.llmUsage.insights.successRateHint', { total: integerFormatter.format(insights.total_calls || 0) })
    },
    {
      key: 'avgLatency',
      title: t('admin.llmUsage.insights.avgLatency'),
      value: insights.avg_latency_ms == null ? '-' : `${decimalFormatter.format(insights.avg_latency_ms)} ms`,
      subtitle: t('admin.llmUsage.insights.avgLatencyHint')
    },
    {
      key: 'p95Latency',
      title: t('admin.llmUsage.insights.p95Latency'),
      value: insights.p95_latency_ms == null ? '-' : `${decimalFormatter.format(insights.p95_latency_ms)} ms`,
      subtitle: t('admin.llmUsage.insights.p95LatencyHint')
    },
    {
      key: 'avgTokens',
      title: t('admin.llmUsage.insights.avgTokens'),
      value: insights.avg_tokens_per_call == null ? '-' : decimalFormatter.format(insights.avg_tokens_per_call),
      subtitle: t('admin.llmUsage.insights.avgTokensHint')
    },
    {
      key: 'callsDelta',
      title: t('admin.llmUsage.insights.callsDelta'),
      value: formatDelta(insights.calls_delta, insights.calls_delta_rate),
      subtitle: t('admin.llmUsage.insights.callsDeltaHint', { recent: integerFormatter.format(insights.calls_last_7d || 0) }),
      trend: insights.calls_delta > 0 ? 'up' : insights.calls_delta < 0 ? 'down' : null
    },
    {
      key: 'tokensDelta',
      title: t('admin.llmUsage.insights.tokensDelta'),
      value: formatDelta(insights.tokens_delta, insights.tokens_delta_rate),
      subtitle: t('admin.llmUsage.insights.tokensDeltaHint', { recent: integerFormatter.format(insights.tokens_last_7d || 0) }),
      trend: insights.tokens_delta > 0 ? 'up' : insights.tokens_delta < 0 ? 'down' : null
    },
    {
      key: 'topModel',
      title: t('admin.llmUsage.insights.topModel'),
      value: insights.top_model || '-',
      subtitle: t('admin.llmUsage.insights.topModelHint')
    },
    {
      key: 'topSource',
      title: t('admin.llmUsage.insights.topSource'),
      value: insights.top_source || '-',
      subtitle: t('admin.llmUsage.insights.topSourceHint')
    },
    {
      key: 'adminShare',
      title: t('admin.llmUsage.insights.adminShare'),
      value: insights.admin_share == null ? '-' : percentFormatter.format(insights.admin_share),
      subtitle: t('admin.llmUsage.insights.adminShareHint')
    }
  ]), [insights, t, percentFormatter, decimalFormatter, integerFormatter, formatDelta]);

  const summaryCards = useMemo(
    () => ([
      {
        title: t('admin.llmUsage.summary.calls24h'),
        value: formatNumber(summary.calls_24h, currentLanguage),
        subtitle: t('admin.llmUsage.summary.calls24hHint'),
        icon: Clock,
        tone: 'border-amber-400'
      },
      {
        title: t('admin.llmUsage.summary.calls7d'),
        value: formatNumber(summary.calls_7d, currentLanguage),
        subtitle: t('admin.llmUsage.summary.calls7dHint'),
        icon: Activity,
        tone: 'border-emerald-400'
      },
      {
        title: t('admin.llmUsage.summary.calls30d'),
        value: formatNumber(summary.calls_30d, currentLanguage),
        subtitle: t('admin.llmUsage.summary.calls30dHint'),
        icon: Sparkles,
        tone: 'border-indigo-400'
      },
      {
        title: t('admin.llmUsage.summary.tokens30d'),
        value: formatNumber(summary.tokens_30d, currentLanguage),
        subtitle: t('admin.llmUsage.summary.tokens30dHint'),
        icon: ShieldCheck,
        tone: 'border-slate-400'
      },
      {
        title: t('admin.llmUsage.summary.adminCalls'),
        value: formatNumber(summary.admin_calls_30d, currentLanguage),
        subtitle: t('admin.llmUsage.summary.adminCallsHint'),
        icon: Users,
        tone: 'border-blue-400'
      },
      {
        title: t('admin.llmUsage.summary.userCalls'),
        value: formatNumber(summary.user_calls_30d, currentLanguage),
        subtitle: t('admin.llmUsage.summary.userCallsHint'),
        icon: Users,
        tone: 'border-green-400'
      }
    ]),
    [summary, t, currentLanguage]
  );

  const openRelated = useCallback(async (requestId) => {
    if (!requestId) return;
    setSelectedConversationId(null);
    setSelectedLogId(null);
    setRequestDrawerId(requestId);
    setLoadingRelated(true);
    try {
      const response = await fetchRelatedLogs(requestId);
      setRelated(response?.data || response || { system: [], audit: [], error: [], llm: [] });
    } finally {
      setLoadingRelated(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{t('admin.llmUsage.title')}</h1>
          <p className="text-sm text-muted-foreground">{t('admin.llmUsage.subtitle')}</p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            usageQuery.refetch();
            logsQuery.refetch();
            analyticsQuery.refetch();
            conversationsQuery.refetch();
          }}
          disabled={usageQuery.isFetching || logsQuery.isFetching || analyticsQuery.isFetching || conversationsQuery.isFetching}
        >
          <RefreshCw className={cn('mr-2 h-4 w-4', (usageQuery.isFetching || logsQuery.isFetching || analyticsQuery.isFetching || conversationsQuery.isFetching) && 'animate-spin')} />
          {t('admin.llmUsage.refresh')}
        </Button>
      </div>

      {usageQuery.isError && (
        <Alert variant="destructive">
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{usageQuery.error?.message || t('errors.loadFailed')}</AlertDescription>
        </Alert>
      )}

      {analyticsQuery.isError && (
        <Alert variant="destructive">
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{analyticsQuery.error?.message || t('errors.loadFailed')}</AlertDescription>
        </Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {summaryCards.map((card) => (
          <StatCard key={card.title} {...card} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t('admin.llmUsage.charts.title')}</h2>
          <p className="text-sm text-muted-foreground">{t('admin.llmUsage.charts.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[7, 30, 60].map((days) => (
            <Button
              key={days}
              size="sm"
              variant={trendDays === days ? 'default' : 'outline'}
              className="h-8"
              onClick={() => setTrendDays(days)}
              disabled={analyticsQuery.isFetching}
            >
              {t('admin.llmUsage.charts.range', { days })}
            </Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.llmUsage.charts.callsTokens')}</CardTitle>
            <CardDescription>{t('admin.llmUsage.charts.callsTokensHint')}</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {trendData.length ? (
              <ResponsiveContainer>
                <ComposedChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatTrendDate} />
                  <YAxis yAxisId="left" allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" allowDecimals={false} />
                  <Tooltip
                    formatter={(value, name) => [value, name === 'tokens' ? t('admin.llmUsage.charts.tokens') : t('admin.llmUsage.charts.calls')]}
                    labelFormatter={formatTrendDate}
                    contentStyle={chartTooltipContentStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="calls" name={t('admin.llmUsage.charts.calls')} fill={CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
                  <Line yAxisId="right" type="monotone" dataKey="tokens" name={t('admin.llmUsage.charts.tokens')} stroke={CHART_COLORS[1]} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {analyticsQuery.isLoading ? t('common.loading') : t('admin.llmUsage.noData')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('admin.llmUsage.charts.successLatency')}</CardTitle>
            <CardDescription>{t('admin.llmUsage.charts.successLatencyHint')}</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {trendData.length ? (
              <ResponsiveContainer>
                <ComposedChart data={trendData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <XAxis dataKey="date" tickFormatter={formatTrendDate} />
                  <YAxis yAxisId="left" allowDecimals={false} />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip
                    formatter={(value, name) => {
                      if (name === 'avg_latency_ms') {
                        const display = value == null ? '-' : `${decimalFormatter.format(value)} ms`;
                        return [display, t('admin.llmUsage.charts.latency')];
                      }
                      return [value, name === 'success_calls' ? t('admin.llmUsage.charts.success') : t('admin.llmUsage.charts.failed')];
                    }}
                    labelFormatter={formatTrendDate}
                    contentStyle={chartTooltipContentStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="success_calls" stackId="status" name={t('admin.llmUsage.charts.success')} fill={CHART_COLORS[2]} />
                  <Bar yAxisId="left" dataKey="failed_calls" stackId="status" name={t('admin.llmUsage.charts.failed')} fill={CHART_COLORS[4]} />
                  <Line yAxisId="right" type="monotone" dataKey="avg_latency_ms" name={t('admin.llmUsage.charts.latency')} stroke={CHART_COLORS[3]} strokeWidth={2} dot={false} />
                </ComposedChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {analyticsQuery.isLoading ? t('common.loading') : t('admin.llmUsage.noData')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader>
            <CardTitle>{t('admin.llmUsage.charts.modelShare')}</CardTitle>
            <CardDescription>{t('admin.llmUsage.charts.modelShareHint')}</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {modelData.length ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={modelData} dataKey="calls" nameKey="model" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {modelData.map((entry, index) => (
                      <Cell key={`model-${entry.model}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [value, name]}
                    contentStyle={chartTooltipContentStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {analyticsQuery.isLoading ? t('common.loading') : t('admin.llmUsage.noData')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('admin.llmUsage.charts.sourceShare')}</CardTitle>
            <CardDescription>{t('admin.llmUsage.charts.sourceShareHint')}</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {sourceData.length ? (
              <ResponsiveContainer>
                <BarChart data={sourceData} layout="vertical" margin={{ left: 12 }}>
                  <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <XAxis type="number" allowDecimals={false} />
                  <YAxis type="category" dataKey="source" width={90} />
                  <Tooltip
                    formatter={(value) => [value, t('admin.llmUsage.charts.calls')]}
                    contentStyle={chartTooltipContentStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                  <Bar dataKey="calls" fill={CHART_COLORS[1]} radius={[0, 6, 6, 0]} />
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {analyticsQuery.isLoading ? t('common.loading') : t('admin.llmUsage.noData')}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('admin.llmUsage.charts.actorShare')}</CardTitle>
            <CardDescription>{t('admin.llmUsage.charts.actorShareHint')}</CardDescription>
          </CardHeader>
          <CardContent className="h-72">
            {actorData.length ? (
              <ResponsiveContainer>
                <PieChart>
                  <Pie data={actorData} dataKey="calls" nameKey="actor_label" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {actorData.map((entry, index) => (
                      <Cell key={`actor-${entry.actor_label || entry.actor_type}-${index}`} fill={CHART_COLORS[index % CHART_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value, name) => [value, name]}
                    contentStyle={chartTooltipContentStyle}
                    labelStyle={chartTooltipLabelStyle}
                    itemStyle={chartTooltipItemStyle}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {analyticsQuery.isLoading ? t('common.loading') : t('admin.llmUsage.noData')}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('admin.llmUsage.insights.title')}</CardTitle>
          <CardDescription>{t('admin.llmUsage.insights.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {insightCards.map((insight) => (
              <InsightCard
                key={insight.key}
                title={insight.title}
                value={insight.value}
                subtitle={insight.subtitle}
                trend={insight.trend}
              />
            ))}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-2">
          <CardTitle>{t('admin.llmUsage.recent.title')}</CardTitle>
          <CardDescription>{t('admin.llmUsage.recent.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {recentConversations.length === 0 && (
            <div className="text-sm text-muted-foreground">{analyticsQuery.isLoading ? t('common.loading') : t('admin.llmUsage.recent.empty')}</div>
          )}
          {recentConversations.map((log) => {
            const actorLabel = log.actor_type === 'admin'
              ? t('admin.llmUsage.actorAdmin')
              : log.actor_type === 'user'
                ? t('admin.llmUsage.actorUser')
                : log.actor_type;
            return (
            <div key={log.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={log.actor_type === 'admin' ? 'default' : 'secondary'}>
                    {actorLabel || log.actor_type}
                  </Badge>
                  <span className="text-[11px] text-muted-foreground">#{log.actor_id ?? '-'}</span>
                  {log.actor_name && (
                    <span className="text-xs font-medium">{log.actor_name}</span>
                  )}
                  <Badge variant={log.status === 'failed' ? 'destructive' : 'outline'}>
                    {log.status || '-'}
                  </Badge>
                </div>
                <div className="text-xs text-muted-foreground">{safeDate(log.created_at, currentLanguage)}</div>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-3">
                  <span>{t('admin.llmUsage.recent.source')}: <span className="font-mono text-foreground">{log.source || '-'}</span></span>
                  <span>{t('admin.llmUsage.recent.model')}: <span className="font-mono text-foreground">{log.model || '-'}</span></span>
                  {log.system_path && (
                    <span>
                      {t('admin.llmUsage.recent.path')}:{' '}
                      <span className="font-mono text-foreground">
                        {log.system_path}
                        {log.system_status_code ? ` (${log.system_status_code})` : ''}
                      </span>
                    </span>
                  )}
                </div>
                {log.context?.client_time && (
                  <div>{t('admin.llmUsage.recent.clientTime')}: <span className="font-mono text-foreground">{log.context.client_time}</span></div>
                )}
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('admin.llmUsage.recent.prompt')}
                  </div>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-[11px] text-green-200">
                    {log.prompt_preview || '-'}
                  </pre>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {t('admin.llmUsage.recent.response')}
                  </div>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-[11px] text-emerald-200">
                    {log.response_preview || '-'}
                  </pre>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-3">
                  <span>{t('admin.llmUsage.recent.tokens')}: <span className="font-mono text-foreground">{log.total_tokens ?? '-'}</span></span>
                  <span>{t('admin.llmUsage.recent.latency')}: <span className="font-mono text-foreground">{log.latency_ms ?? '-'}</span></span>
                  <span>{t('admin.llmUsage.recent.requestId')}: <span className="font-mono text-foreground">{log.request_id || '-'}</span></span>
                  {log.response_id && (
                    <span>{t('admin.llmUsage.recent.responseId')}: <span className="font-mono text-foreground">{log.response_id}</span></span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">
                    {t('admin.llmUsage.recent.relatedCounts', {
                      system: log.related?.system ?? 0,
                      audit: log.related?.audit ?? 0,
                      error: log.related?.error ?? 0
                    })}
                  </Badge>
                  {log.request_id && (
                    <Button size="sm" variant="outline" onClick={() => openRelated(log.request_id)}>
                      {t('admin.llmUsage.recent.related')}
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => setSelectedLogId(log.id)}>
                    {t('admin.llmUsage.recent.viewDetail')}
                  </Button>
                </div>
              </div>
            </div>
          );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-4">
          <CardTitle>{t('admin.llmUsage.sessions.title')}</CardTitle>
          <CardDescription>{t('admin.llmUsage.sessions.subtitle')}</CardDescription>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Input
              value={sessionAdminId}
              onChange={(event) => setSessionAdminId(event.target.value)}
              placeholder={t('admin.llmUsage.sessions.filters.adminId', { defaultValue: 'Admin ID' })}
              className="h-9"
            />
            <Input
              value={sessionModel}
              onChange={(event) => setSessionModel(event.target.value)}
              placeholder={t('admin.llmUsage.sessions.filters.model', { defaultValue: 'Model' })}
              className="h-9"
            />
            <select
              value={sessionStatus}
              onChange={(event) => setSessionStatus(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t('admin.llmUsage.sessions.filters.allStatus', { defaultValue: 'All statuses' })}</option>
              <option value="active">{t('admin.llmUsage.sessions.active')}</option>
              <option value="waiting_confirmation">{t('admin.llmUsage.sessions.waiting')}</option>
            </select>
            <select
              value={sessionPendingFilter}
              onChange={(event) => setSessionPendingFilter(event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{t('admin.llmUsage.sessions.filters.pendingAny', { defaultValue: 'Any pending state' })}</option>
              <option value="true">{t('admin.llmUsage.sessions.filters.pendingYes', { defaultValue: 'Has pending action' })}</option>
              <option value="false">{t('admin.llmUsage.sessions.filters.pendingNo', { defaultValue: 'No pending action' })}</option>
            </select>
            <Input
              type="date"
              value={sessionDateFrom}
              onChange={(event) => setSessionDateFrom(event.target.value)}
              className="h-9"
            />
            <Input
              type="date"
              value={sessionDateTo}
              onChange={(event) => setSessionDateTo(event.target.value)}
              className="h-9"
            />
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {conversationsQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          )}
          {!conversationsQuery.isLoading && conversationItems.length === 0 && (
            <div className="text-sm text-muted-foreground">{t('admin.llmUsage.sessions.empty')}</div>
          )}
          {conversationItems.map((conversation) => (
            <div key={conversation.conversation_id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{conversation.title || t('admin.llmUsage.sessions.untitled')}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {conversation.last_message_preview || t('admin.llmUsage.sessions.noPreview')}
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-muted-foreground">
                    {conversation.conversation_id}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant={conversation.status === 'waiting_confirmation' ? 'secondary' : 'outline'}>
                    {conversation.status === 'waiting_confirmation'
                      ? t('admin.llmUsage.sessions.waiting')
                      : t('admin.llmUsage.sessions.active')}
                  </Badge>
                  <Button size="sm" variant="outline" onClick={() => setSelectedConversationId(conversation.conversation_id)}>
                    {t('admin.llmUsage.sessions.view')}
                  </Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span>{t('admin.llmUsage.sessions.adminId', { defaultValue: 'Admin' })}: <span className="font-mono text-foreground">#{conversation.admin_id ?? '-'}</span></span>
                <span>{t('admin.llmUsage.sessions.messages')}: <span className="font-mono text-foreground">{conversation.message_count ?? 0}</span></span>
                <span>{t('admin.llmUsage.sessions.tokens')}: <span className="font-mono text-foreground">{conversation.total_tokens ?? 0}</span></span>
                <span>{t('admin.llmUsage.sessions.calls')}: <span className="font-mono text-foreground">{conversation.llm_calls ?? 0}</span></span>
                <span>{t('admin.llmUsage.sessions.pendingCount', { defaultValue: 'Pending' })}: <span className="font-mono text-foreground">{conversation.pending_action_count ?? 0}</span></span>
                <span>{t('admin.llmUsage.sessions.lastModel')}: <span className="font-mono text-foreground">{conversation.last_model || '-'}</span></span>
                <span>{t('admin.llmUsage.sessions.lastActivity')}: <span className="font-mono text-foreground">{safeDate(conversation.last_activity_at, currentLanguage)}</span></span>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>{t('admin.llmUsage.users.title')}</CardTitle>
              <CardDescription>{t('admin.llmUsage.users.subtitle')}</CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Input
                value={search}
                onChange={(event) => {
                  setSearch(event.target.value);
                  setPage(1);
                }}
                placeholder={t('admin.llmUsage.users.searchPlaceholder')}
                className="h-9 w-64"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {usageQuery.isLoading ? (
            <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-4 py-2 text-left">{t('admin.llmUsage.users.columns.user')}</th>
                    <th className="px-4 py-2 text-left">{t('admin.llmUsage.users.columns.role')}</th>
                    <th className="px-4 py-2 text-left">{t('admin.llmUsage.users.columns.group')}</th>
                    <th className="px-4 py-2 text-right">{t('admin.llmUsage.users.columns.dailyUsed')}</th>
                    <th className="px-4 py-2 text-right">{t('admin.llmUsage.users.columns.dailyLimit')}</th>
                    <th className="px-4 py-2 text-right">{t('admin.llmUsage.users.columns.remaining')}</th>
                    <th className="px-4 py-2 text-right">{t('admin.llmUsage.users.columns.rateLimit')}</th>
                    <th className="px-4 py-2 text-left">{t('admin.llmUsage.users.columns.resetAt')}</th>
                    <th className="px-4 py-2 text-left">{t('admin.llmUsage.users.columns.lastUsed')}</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b">
                      <td className="px-4 py-2">
                        <div className="font-medium">{user.username || t('common.none')}</div>
                        <div className="text-[11px] text-muted-foreground">{user.email}</div>
                      </td>
                      <td className="px-4 py-2">
                        <Badge variant={user.is_admin ? 'default' : 'secondary'}>
                          {user.is_admin ? t('admin.llmUsage.users.admin') : t('admin.llmUsage.users.user')}
                        </Badge>
                      </td>
                      <td className="px-4 py-2">{user.group_name || t('common.none')}</td>
                      <td className="px-4 py-2 text-right">{formatNumber(user.daily_used, currentLanguage)}</td>
                      <td className="px-4 py-2 text-right">
                        {user.daily_limit == null ? t('admin.llmUsage.users.unlimited') : formatNumber(user.daily_limit, currentLanguage)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {user.daily_remaining == null ? '-' : formatNumber(user.daily_remaining, currentLanguage)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {user.rate_limit == null ? '-' : formatNumber(user.rate_limit, currentLanguage)}
                      </td>
                      <td className="px-4 py-2">{safeDate(user.reset_at, currentLanguage)}</td>
                      <td className="px-4 py-2">{safeDate(user.last_used_at, currentLanguage)}</td>
                    </tr>
                  ))}
                  {users.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                        {t('admin.llmUsage.users.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
        <div className="flex items-center justify-between border-t px-6 py-3 text-xs text-muted-foreground">
          <span>
            {t('admin.llmUsage.users.pagination', {
              page: pagination.current_page || 1,
              total: pagination.total_pages || 1
            })}
          </span>
          <div className="flex items-center gap-2">
            <Button size="sm" variant="outline" disabled={!canPrev} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              {t('admin.llmUsage.users.prev')}
            </Button>
            <Button size="sm" variant="outline" disabled={!canNext} onClick={() => setPage((p) => p + 1)}>
              {t('admin.llmUsage.users.next')}
            </Button>
          </div>
        </div>
      </Card>

      <Card>
        <CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <CardTitle>{t('admin.llmUsage.logs.title')}</CardTitle>
              <CardDescription>{t('admin.llmUsage.logs.subtitle')}</CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Input
                value={logQuery}
                onChange={(event) => setLogQuery(event.target.value)}
                placeholder={t('admin.llmUsage.logs.searchPlaceholder')}
                className="h-9 w-64"
              />
              <Input
                value={logConversationId}
                onChange={(event) => setLogConversationId(event.target.value)}
                placeholder={t('admin.llmUsage.logs.filters.conversationId', { defaultValue: 'Conversation ID' })}
                className="h-9 w-52 font-mono"
              />
              <Input
                value={logTurnNo}
                onChange={(event) => setLogTurnNo(event.target.value)}
                placeholder={t('admin.llmUsage.logs.filters.turnNo', { defaultValue: 'Turn No.' })}
                className="h-9 w-28 font-mono"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {logsQuery.isLoading ? (
            <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-4 py-2 text-left">{t('admin.llmUsage.logs.columns.time')}</th>
                    <th className="px-4 py-2 text-left">{t('admin.llmUsage.logs.columns.conversationId', { defaultValue: 'Conversation' })}</th>
                    <th className="px-4 py-2 text-right">{t('admin.llmUsage.logs.columns.turnNo', { defaultValue: 'Turn' })}</th>
                    <th className="px-4 py-2 text-left">{t('admin.llmUsage.logs.columns.actor')}</th>
                    <th className="px-4 py-2 text-left">{t('admin.llmUsage.logs.columns.source')}</th>
                    <th className="px-4 py-2 text-left">{t('admin.llmUsage.logs.columns.model')}</th>
                    <th className="px-4 py-2 text-left">{t('admin.llmUsage.logs.columns.status')}</th>
                    <th className="px-4 py-2 text-right">{t('admin.llmUsage.logs.columns.tokens')}</th>
                    <th className="px-4 py-2 text-right">{t('admin.llmUsage.logs.columns.latency')}</th>
                    <th className="px-4 py-2 text-left">{t('admin.llmUsage.logs.columns.requestId')}</th>
                    <th className="px-4 py-2 text-left">{t('admin.llmUsage.logs.columns.prompt')}</th>
                    <th className="px-4 py-2 text-right">{t('admin.llmUsage.logs.columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {llmLogs.map((log) => (
                    <tr key={log.id} className="border-b">
                      <td className="px-4 py-2 whitespace-nowrap">{safeDate(log.created_at, currentLanguage)}</td>
                      <td className="px-4 py-2 max-w-[180px] truncate font-mono text-[11px]" title={log.conversation_id || ''}>
                        {log.conversation_id || '-'}
                      </td>
                      <td className="px-4 py-2 text-right">{log.turn_no ?? '-'}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Badge variant={log.actor_type === 'admin' ? 'default' : 'secondary'}>
                            {log.actor_type || t('common.none')}
                          </Badge>
                          <span className="text-[11px] text-muted-foreground">#{log.actor_id ?? '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 max-w-[160px] truncate" title={log.source || ''}>
                        {log.source || '-'}
                      </td>
                      <td className="px-4 py-2">{log.model || '-'}</td>
                      <td className="px-4 py-2">
                        <Badge variant={log.status === 'failed' ? 'destructive' : 'outline'}>
                          {log.status || '-'}
                        </Badge>
                      </td>
                      <td className="px-4 py-2 text-right">{log.total_tokens ?? '-'}</td>
                      <td className="px-4 py-2 text-right">{log.latency_ms ?? '-'}</td>
                      <td className="px-4 py-2 font-mono text-[11px] truncate max-w-[140px]" title={log.request_id}>
                        {log.request_id ? (
                          <button
                            type="button"
                            className="text-blue-600 hover:underline"
                            onClick={() => openRelated(log.request_id)}
                          >
                            {log.request_id}
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-2 max-w-[220px] truncate font-mono text-[11px]" title={log.prompt}>
                        {log.prompt ? String(log.prompt).slice(0, 120) : '-'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Button size="sm" variant="ghost" onClick={() => setSelectedLogId(log.id)}>
                          {t('admin.llmUsage.logs.view')}
                        </Button>
                      </td>
                    </tr>
                  ))}
                  {llmLogs.length === 0 && (
                    <tr>
                      <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                        {t('admin.llmUsage.logs.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={Boolean(selectedConversationId)} onOpenChange={(open) => !open && setSelectedConversationId(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{t('admin.llmUsage.sessions.detailTitle')}</DialogTitle>
          </DialogHeader>
          {conversationDetailQuery.isLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          )}
          {conversationDetailQuery.data && (
            <ScrollArea className="max-h-[70vh] pr-2">
              <div className="space-y-4 text-xs">
                <div className="grid gap-3 md:grid-cols-2">
                  <DetailItem label={t('admin.llmUsage.sessions.conversationId', { defaultValue: 'Conversation ID' })} value={conversationDetailQuery.data.conversation_id} />
                  <DetailItem label={t('admin.llmUsage.sessions.adminId', { defaultValue: 'Admin' })} value={conversationItems.find((item) => item.conversation_id === conversationDetailQuery.data.conversation_id)?.admin_id ?? '-'} />
                  <DetailItem label={t('admin.llmUsage.sessions.messages')} value={conversationDetailQuery.data.summary?.message_count} />
                  <DetailItem label={t('admin.llmUsage.sessions.tokens')} value={conversationDetailQuery.data.summary?.total_tokens} />
                  <DetailItem label={t('admin.llmUsage.sessions.calls')} value={conversationDetailQuery.data.summary?.llm_calls} />
                  <DetailItem label={t('admin.llmUsage.sessions.lastModel')} value={conversationDetailQuery.data.summary?.last_model || '-'} />
                  <DetailItem label={t('admin.llmUsage.sessions.status')} value={conversationDetailQuery.data.summary?.status || '-'} />
                  <DetailItem label={t('admin.llmUsage.sessions.lastActivity')} value={safeDate(conversationDetailQuery.data.summary?.last_activity_at, currentLanguage)} />
                </div>

                <DetailBlock title={t('admin.llmUsage.sessions.timeline')}>
                  <div className="space-y-3">
                    {(conversationDetailQuery.data.messages || []).map((item) => (
                      <div key={item.id} className="rounded-xl border bg-card p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant={item.role === 'user' ? 'secondary' : 'outline'}>
                              {item.role || item.kind}
                            </Badge>
                            <span className="font-mono text-[11px] text-muted-foreground">{item.action}</span>
                            {item.status && <Badge variant="outline">{item.status}</Badge>}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{safeDate(item.created_at, currentLanguage)}</div>
                        </div>
                        {item.content && (
                          <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-900 p-3 text-[11px] text-emerald-200">
                            {item.content}
                          </pre>
                        )}
                        {item.meta?.request_id && (
                          <div className="mt-2">
                            <Button size="sm" variant="ghost" onClick={() => openRelated(item.meta.request_id)}>
                              {t('admin.llmUsage.recent.related')}
                            </Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </DetailBlock>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(selectedLogId)} onOpenChange={(open) => !open && setSelectedLogId(null)}>
        <DialogContent className="max-w-5xl">
          <DialogHeader>
            <DialogTitle>{t('admin.llmUsage.logs.detailTitle', { id: selectedLogId })}</DialogTitle>
          </DialogHeader>
          {logDetailQuery.isLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          )}
          {logDetailQuery.data && (
            <ScrollArea className="max-h-[70vh] pr-2">
              <div className="space-y-4 text-xs">
                <div className="grid gap-3 md:grid-cols-2">
                  <DetailItem label={t('admin.llmUsage.logs.columns.conversationId', { defaultValue: 'Conversation' })} value={logDetailQuery.data.conversation_id || '-'} />
                  <DetailItem label={t('admin.llmUsage.logs.columns.turnNo', { defaultValue: 'Turn' })} value={logDetailQuery.data.turn_no ?? '-'} />
                  <DetailItem label={t('admin.llmUsage.logs.columns.requestId')} value={logDetailQuery.data.request_id} />
                  <DetailItem label={t('admin.llmUsage.logs.columns.model')} value={logDetailQuery.data.model} />
                  <DetailItem label={t('admin.llmUsage.logs.columns.source')} value={logDetailQuery.data.source} />
                  <DetailItem label={t('admin.llmUsage.logs.columns.status')} value={logDetailQuery.data.status} />
                  <DetailItem label={t('admin.llmUsage.logs.columns.tokens')} value={logDetailQuery.data.total_tokens} />
                  <DetailItem label={t('admin.llmUsage.logs.columns.latency')} value={logDetailQuery.data.latency_ms} />
                  <DetailItem label={t('admin.llmUsage.logs.columns.actor')} value={`${logDetailQuery.data.actor_type} #${logDetailQuery.data.actor_id ?? '-'}`} />
                  <DetailItem label={t('admin.llmUsage.logs.columns.responseId')} value={logDetailQuery.data.response_id || '-'} />
                  <DetailItem label={t('admin.llmUsage.logs.columns.time')} value={safeDate(logDetailQuery.data.created_at, currentLanguage)} />
                </div>

                {logDetailQuery.data.prompt && (
                  <DetailBlock title={t('admin.llmUsage.logs.prompt')}>
                    <JsonTreeViewer value={parseMaybeJson(logDetailQuery.data.prompt)} />
                  </DetailBlock>
                )}

                {logDetailQuery.data.response_raw && (
                  <DetailBlock title={t('admin.llmUsage.logs.response')}>
                    {typeof parseMaybeJson(logDetailQuery.data.response_raw) === 'string' ? (
                      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-[11px] text-green-200">
                        {logDetailQuery.data.response_raw}
                      </pre>
                    ) : (
                      <JsonTreeViewer value={parseMaybeJson(logDetailQuery.data.response_raw)} />
                    )}
                  </DetailBlock>
                )}

                {logDetailQuery.data.error_message && (
                  <DetailBlock title={t('admin.llmUsage.logs.error')}>
                    <pre className="whitespace-pre-wrap rounded bg-rose-50 p-3 text-[11px] text-rose-600">
                      {logDetailQuery.data.error_message}
                    </pre>
                  </DetailBlock>
                )}
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      <RequestIdRelatedDrawer
        open={Boolean(requestDrawerId)}
        requestId={requestDrawerId}
        onClose={() => setRequestDrawerId(null)}
        loading={loadingRelated}
        data={related}
        onRefresh={() => requestDrawerId && openRelated(requestDrawerId)}
      />
    </div>
  );
}

function DetailItem({ label, value }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-muted-foreground">{label}</div>
      <div className="font-mono">{value ?? '-'}</div>
    </div>
  );
}

function DetailBlock({ title, children }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
