import Silian_React, { useMemo as Silian_useMemo, useState as Silian_useState, useCallback as Silian_useCallback } from 'react';
import { useQuery as Silian_useQuery } from 'react-query';
import {
  Activity as Silian_Activity,
  ShieldCheck as Silian_ShieldCheck,
  Sparkles as Silian_Sparkles,
  RefreshCw as Silian_RefreshCw,
  Users as Silian_Users,
  Loader2 as Silian_Loader2,
  Clock as Silian_Clock,
  TrendingUp as Silian_TrendingUp,
  TrendingDown as Silian_TrendingDown
} from 'lucide-react';
import {
  ResponsiveContainer as Silian_ResponsiveContainer,
  ComposedChart as Silian_ComposedChart,
  BarChart as Silian_BarChart,
  Bar as Silian_Bar,
  Line as Silian_Line,
  XAxis as Silian_XAxis,
  YAxis as Silian_YAxis,
  CartesianGrid as Silian_CartesianGrid,
  Tooltip as Silian_Tooltip,
  PieChart as Silian_PieChart,
  Pie as Silian_Pie,
  Cell as Silian_Cell,
  Legend as Silian_Legend
} from 'recharts';

import { adminAPI as Silian_adminAPI } from '../../lib/api';
import { searchLogs as Silian_searchLogs, fetchRelatedLogs as Silian_fetchRelatedLogs } from '../../lib/api/logSearch';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../../components/ui/Card';
import { Button as Silian_Button } from '../../components/ui/Button';
import { Input as Silian_Input } from '../../components/ui/Input';
import { Badge as Silian_Badge } from '../../components/ui/badge';
import { Dialog as Silian_Dialog, DialogContent as Silian_DialogContent, DialogHeader as Silian_DialogHeader, DialogTitle as Silian_DialogTitle } from '../../components/ui/dialog';
import { ScrollArea as Silian_ScrollArea } from '../../components/ui/scroll-area';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription, AlertTitle as Silian_AlertTitle } from '../../components/ui/Alert';
import Silian_JsonTreeViewer from '../../components/logs/JsonTreeViewer';
import Silian_RequestIdRelatedDrawer from '../../components/logs/RequestIdRelatedDrawer';
import { cn as Silian_cn } from '../../lib/utils';

const Silian_formatNumber = (Silian_value, Silian_locale) => {
  const Silian_num = Number(Silian_value);
  return Number.isFinite(Silian_num) ? Silian_num.toLocaleString(Silian_locale) : '-';
};

const Silian_safeDate = (Silian_value, Silian_locale) => (Silian_value ? new Date(Silian_value).toLocaleString(Silian_locale) : '-');

const Silian_parseMaybeJson = (Silian_value) => {
  if (Silian_value == null) return null;
  if (typeof Silian_value === 'object') return Silian_value;
  if (typeof Silian_value !== 'string') return Silian_value;
  try {
    return JSON.parse(Silian_value);
  } catch {
    return Silian_value;
  }
};

const Silian_CHART_COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#8b5cf6', '#ef4444', '#14b8a6', '#f97316', '#0ea5e9'];

const Silian_safeNumber = (Silian_value, Silian_fallback = 0) => {
  const Silian_num = Number(Silian_value);
  return Number.isFinite(Silian_num) ? Silian_num : Silian_fallback;
};

const Silian_buildTopData = (Silian_items, Silian_key, Silian_limit, Silian_otherLabel = 'Other') => {
  const Silian_list = Array.isArray(Silian_items) ? Silian_items : [];
  if (Silian_list.length <= Silian_limit) return Silian_list;
  const Silian_top = Silian_list.slice(0, Silian_limit);
  const Silian_rest = Silian_list.slice(Silian_limit);
  const Silian_other = Silian_rest.reduce(
    (Silian_acc, Silian_item) => ({
      calls: Silian_acc.calls + Silian_safeNumber(Silian_item.calls),
      tokens: Silian_acc.tokens + Silian_safeNumber(Silian_item.tokens)
    }),
    { calls: 0, tokens: 0 }
  );
  return [...Silian_top, { [Silian_key]: Silian_otherLabel, ...Silian_other }];
};

function Silian_StatCard({ title: Silian_title, value: Silian_value, subtitle: Silian_subtitle, icon: Silian_icon, tone: Silian_tone }) {
  const Silian_IconComponent = Silian_icon;
  return (
    <Silian_Card className={Silian_cn('border-l-4', Silian_tone)}>
      <Silian_CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <Silian_CardTitle className="text-sm font-medium text-muted-foreground">{Silian_title}</Silian_CardTitle>
          <Silian_IconComponent className="h-4 w-4 text-muted-foreground" />
        </div>
      </Silian_CardHeader>
      <Silian_CardContent className="space-y-1">
        <div className="text-2xl font-semibold">{Silian_value}</div>
        {Silian_subtitle && <p className="text-xs text-muted-foreground">{Silian_subtitle}</p>}
      </Silian_CardContent>
    </Silian_Card>
  );
}

function Silian_InsightCard({ title: Silian_title, value: Silian_value, subtitle: Silian_subtitle, trend: Silian_trend }) {
  const Silian_TrendIcon = Silian_trend === 'up' ? Silian_TrendingUp : Silian_trend === 'down' ? Silian_TrendingDown : null;
  return (
    <div className="rounded-xl border bg-card px-4 py-3 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          {Silian_title}
        </div>
        {Silian_TrendIcon && (
          <Silian_TrendIcon className={Silian_cn('h-4 w-4', Silian_trend === 'up' ? 'text-emerald-500' : 'text-rose-500')} />
        )}
      </div>
      <div className="mt-2 text-xl font-semibold">{Silian_value}</div>
      {Silian_subtitle && <div className="mt-1 text-[11px] text-muted-foreground">{Silian_subtitle}</div>}
    </div>
  );
}

export default function AdminLlmUsagePage() {
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['admin', 'common', 'date', 'errors', 'pagination']);
  const [Silian_search, Silian_setSearch] = Silian_useState('');
  const [Silian_page, Silian_setPage] = Silian_useState(1);
  const [Silian_limit] = Silian_useState(20);
  const [Silian_trendDays, Silian_setTrendDays] = Silian_useState(30);
  const [Silian_recentLimit] = Silian_useState(8);
  const [Silian_logQuery, Silian_setLogQuery] = Silian_useState('');
  const [Silian_logConversationId, Silian_setLogConversationId] = Silian_useState('');
  const [Silian_logTurnNo, Silian_setLogTurnNo] = Silian_useState('');
  const [Silian_sessionAdminId, Silian_setSessionAdminId] = Silian_useState('');
  const [Silian_sessionStatus, Silian_setSessionStatus] = Silian_useState('');
  const [Silian_sessionModel, Silian_setSessionModel] = Silian_useState('');
  const [Silian_sessionDateFrom, Silian_setSessionDateFrom] = Silian_useState('');
  const [Silian_sessionDateTo, Silian_setSessionDateTo] = Silian_useState('');
  const [Silian_sessionPendingFilter, Silian_setSessionPendingFilter] = Silian_useState('');
  const [Silian_selectedLogId, Silian_setSelectedLogId] = Silian_useState(null);
  const [Silian_selectedConversationId, Silian_setSelectedConversationId] = Silian_useState(null);
  const [Silian_requestDrawerId, Silian_setRequestDrawerId] = Silian_useState(null);
  const [Silian_related, Silian_setRelated] = Silian_useState({ system: [], audit: [], error: [], llm: [] });
  const [Silian_loadingRelated, Silian_setLoadingRelated] = Silian_useState(false);

  const Silian_usageQuery = Silian_useQuery(
    ['llmUsage', { search: Silian_search, page: Silian_page, limit: Silian_limit }],
    async () => {
      const Silian_response = await Silian_adminAPI.getLlmUsage({ q: Silian_search, page: Silian_page, limit: Silian_limit });
      return Silian_response.data?.data || Silian_response.data;
    },
    { keepPreviousData: true }
  );

  const Silian_logsQuery = Silian_useQuery(
    ['llmUsageLogs', { logQuery: Silian_logQuery, logConversationId: Silian_logConversationId, logTurnNo: Silian_logTurnNo }],
    async () => {
      const Silian_response = await Silian_searchLogs({
        q: Silian_logQuery,
        types: ['llm'],
        limit_per_type: 30,
        conversation_id: Silian_logConversationId || undefined,
        turn_no: Silian_logTurnNo || undefined
      });
      return Silian_response.data || Silian_response;
    },
    { keepPreviousData: true }
  );

  const Silian_analyticsQuery = Silian_useQuery(
    ['llmUsageAnalytics', Silian_trendDays, Silian_recentLimit],
    async () => {
      const Silian_response = await Silian_adminAPI.getLlmUsageAnalytics({ days: Silian_trendDays, recent_limit: Silian_recentLimit });
      return Silian_response.data?.data || Silian_response.data;
    },
    { keepPreviousData: true }
  );

  const Silian_conversationsQuery = Silian_useQuery(
    ['adminAiConversations', {
      sessionAdminId: Silian_sessionAdminId,
      sessionStatus: Silian_sessionStatus,
      sessionModel: Silian_sessionModel,
      sessionDateFrom: Silian_sessionDateFrom,
      sessionDateTo: Silian_sessionDateTo,
      sessionPendingFilter: Silian_sessionPendingFilter
    }],
    async () => {
      const Silian_response = await Silian_adminAPI.getAiConversations({
        limit: 20,
        admin_id: Silian_sessionAdminId || undefined,
        status: Silian_sessionStatus || undefined,
        model: Silian_sessionModel || undefined,
        date_from: Silian_sessionDateFrom || undefined,
        date_to: Silian_sessionDateTo || undefined,
        has_pending_action: Silian_sessionPendingFilter || undefined
      });
      return Silian_response.data?.data || [];
    },
    { keepPreviousData: true }
  );

  const Silian_conversationDetailQuery = Silian_useQuery(
    ['adminAiConversationDetail', Silian_selectedConversationId],
    async () => {
      const Silian_response = await Silian_adminAPI.getAiConversation(Silian_selectedConversationId);
      return Silian_response.data?.data || Silian_response.data;
    },
    { enabled: Boolean(Silian_selectedConversationId) }
  );

  const Silian_logDetailQuery = Silian_useQuery(
    ['llmLogDetail', Silian_selectedLogId],
    async () => {
      const Silian_response = await Silian_adminAPI.getLlmLogDetail(Silian_selectedLogId);
      return Silian_response.data?.data || Silian_response.data;
    },
    { enabled: Boolean(Silian_selectedLogId) }
  );

  const Silian_usageData = Silian_usageQuery.data || {};
  const Silian_summary = Silian_useMemo(() => Silian_usageQuery.data?.summary || {}, [Silian_usageQuery.data]);
  const Silian_users = Silian_usageData.users || [];
  const Silian_pagination = Silian_usageData.pagination || {};

  const Silian_analyticsData = Silian_analyticsQuery.data || {};
  const Silian_trendData = Silian_analyticsData.trends || [];
  const Silian_distributions = Silian_analyticsData.distributions || {};
  const Silian_insights = Silian_useMemo(() => Silian_analyticsQuery.data?.insights || {}, [Silian_analyticsQuery.data]);
  const Silian_recentConversations = Silian_analyticsData.recent_conversations || [];

  const Silian_llmLogs = Silian_logsQuery.data?.data?.llm?.items || [];
  const Silian_conversationItems = Array.isArray(Silian_conversationsQuery.data) ? Silian_conversationsQuery.data : [];

  const Silian_canPrev = Silian_page > 1;
  const Silian_canNext = Silian_page < (Silian_pagination.total_pages || 1);

  const Silian_integerFormatter = Silian_useMemo(() => new Intl.NumberFormat(Silian_currentLanguage), [Silian_currentLanguage]);
  const Silian_decimalFormatter = Silian_useMemo(() => new Intl.NumberFormat(Silian_currentLanguage, { maximumFractionDigits: 2 }), [Silian_currentLanguage]);
  const Silian_percentFormatter = Silian_useMemo(() => new Intl.NumberFormat(Silian_currentLanguage, { style: 'percent', maximumFractionDigits: 1 }), [Silian_currentLanguage]);
  const Silian_shortDateFormatter = Silian_useMemo(() => new Intl.DateTimeFormat(Silian_currentLanguage, { month: 'short', day: 'numeric' }), [Silian_currentLanguage]);
  const Silian_chartTooltipContentStyle = Silian_useMemo(() => ({
    backgroundColor: 'var(--popover)',
    border: '1px solid var(--border)',
    borderRadius: '12px',
    boxShadow: '0 16px 40px rgba(0, 0, 0, 0.18)',
    color: 'var(--popover-foreground)'
  }), []);
  const Silian_chartTooltipLabelStyle = Silian_useMemo(() => ({
    color: 'var(--muted-foreground)',
    fontWeight: 600
  }), []);
  const Silian_chartTooltipItemStyle = Silian_useMemo(() => ({
    color: 'var(--popover-foreground)'
  }), []);

  const Silian_modelData = Silian_useMemo(
    () => Silian_buildTopData(Silian_distributions.models, 'model', 6, Silian_t('admin.llmUsage.other')),
    [Silian_distributions.models, Silian_t]
  );
  const Silian_sourceData = Silian_useMemo(
    () => Silian_buildTopData(Silian_distributions.sources, 'source', 6, Silian_t('admin.llmUsage.other')),
    [Silian_distributions.sources, Silian_t]
  );
  const Silian_actorData = Silian_useMemo(
    () => (Silian_distributions.actors || []).map((Silian_item) => ({
      ...Silian_item,
      actor_label: Silian_item.actor_type === 'admin'
        ? Silian_t('admin.llmUsage.actorAdmin')
        : Silian_item.actor_type === 'user'
          ? Silian_t('admin.llmUsage.actorUser')
          : Silian_item.actor_type
    })),
    [Silian_distributions.actors, Silian_t]
  );

  const Silian_formatTrendDate = Silian_useCallback(
    (Silian_value) => {
      if (!Silian_value) return Silian_value;
      const Silian_date = new Date(`${Silian_value}T00:00:00`);
      return Number.isNaN(Silian_date.getTime()) ? Silian_value : Silian_shortDateFormatter.format(Silian_date);
    },
    [Silian_shortDateFormatter]
  );

  const Silian_formatDelta = Silian_useCallback(
    (Silian_delta, Silian_rate) => {
      if (Silian_delta == null) return '-';
      const Silian_sign = Silian_delta > 0 ? '+' : '';
      const Silian_main = `${Silian_sign}${Silian_integerFormatter.format(Silian_delta)}`;
      if (Silian_rate == null) return Silian_main;
      return `${Silian_main} (${Silian_percentFormatter.format(Math.abs(Silian_rate))})`;
    },
    [Silian_integerFormatter, Silian_percentFormatter]
  );

  const Silian_trendMetricLabels = Silian_useMemo(() => ({
    calls: Silian_t('admin.llmUsage.charts.calls'),
    tokens: Silian_t('admin.llmUsage.charts.tokens'),
    success_calls: Silian_t('admin.llmUsage.charts.success'),
    failed_calls: Silian_t('admin.llmUsage.charts.failed'),
    avg_latency_ms: Silian_t('admin.llmUsage.charts.latency')
  }), [Silian_t]);

  const Silian_insightCards = Silian_useMemo(() => ([
    {
      key: 'successRate',
      title: Silian_t('admin.llmUsage.insights.successRate'),
      value: Silian_insights.success_rate == null ? '-' : Silian_percentFormatter.format(Silian_insights.success_rate),
      subtitle: Silian_t('admin.llmUsage.insights.successRateHint', { total: Silian_integerFormatter.format(Silian_insights.total_calls || 0) })
    },
    {
      key: 'avgLatency',
      title: Silian_t('admin.llmUsage.insights.avgLatency'),
      value: Silian_insights.avg_latency_ms == null ? '-' : `${Silian_decimalFormatter.format(Silian_insights.avg_latency_ms)} ms`,
      subtitle: Silian_t('admin.llmUsage.insights.avgLatencyHint')
    },
    {
      key: 'p95Latency',
      title: Silian_t('admin.llmUsage.insights.p95Latency'),
      value: Silian_insights.p95_latency_ms == null ? '-' : `${Silian_decimalFormatter.format(Silian_insights.p95_latency_ms)} ms`,
      subtitle: Silian_t('admin.llmUsage.insights.p95LatencyHint')
    },
    {
      key: 'avgTokens',
      title: Silian_t('admin.llmUsage.insights.avgTokens'),
      value: Silian_insights.avg_tokens_per_call == null ? '-' : Silian_decimalFormatter.format(Silian_insights.avg_tokens_per_call),
      subtitle: Silian_t('admin.llmUsage.insights.avgTokensHint')
    },
    {
      key: 'callsDelta',
      title: Silian_t('admin.llmUsage.insights.callsDelta'),
      value: Silian_formatDelta(Silian_insights.calls_delta, Silian_insights.calls_delta_rate),
      subtitle: Silian_t('admin.llmUsage.insights.callsDeltaHint', { recent: Silian_integerFormatter.format(Silian_insights.calls_last_7d || 0) }),
      trend: Silian_insights.calls_delta > 0 ? 'up' : Silian_insights.calls_delta < 0 ? 'down' : null
    },
    {
      key: 'tokensDelta',
      title: Silian_t('admin.llmUsage.insights.tokensDelta'),
      value: Silian_formatDelta(Silian_insights.tokens_delta, Silian_insights.tokens_delta_rate),
      subtitle: Silian_t('admin.llmUsage.insights.tokensDeltaHint', { recent: Silian_integerFormatter.format(Silian_insights.tokens_last_7d || 0) }),
      trend: Silian_insights.tokens_delta > 0 ? 'up' : Silian_insights.tokens_delta < 0 ? 'down' : null
    },
    {
      key: 'topModel',
      title: Silian_t('admin.llmUsage.insights.topModel'),
      value: Silian_insights.top_model || '-',
      subtitle: Silian_t('admin.llmUsage.insights.topModelHint')
    },
    {
      key: 'topSource',
      title: Silian_t('admin.llmUsage.insights.topSource'),
      value: Silian_insights.top_source || '-',
      subtitle: Silian_t('admin.llmUsage.insights.topSourceHint')
    },
    {
      key: 'adminShare',
      title: Silian_t('admin.llmUsage.insights.adminShare'),
      value: Silian_insights.admin_share == null ? '-' : Silian_percentFormatter.format(Silian_insights.admin_share),
      subtitle: Silian_t('admin.llmUsage.insights.adminShareHint')
    }
  ]), [Silian_insights, Silian_t, Silian_percentFormatter, Silian_decimalFormatter, Silian_integerFormatter, Silian_formatDelta]);

  const Silian_summaryCards = Silian_useMemo(
    () => ([
      {
        title: Silian_t('admin.llmUsage.summary.calls24h'),
        value: Silian_formatNumber(Silian_summary.calls_24h, Silian_currentLanguage),
        subtitle: Silian_t('admin.llmUsage.summary.calls24hHint'),
        icon: Silian_Clock,
        tone: 'border-amber-400'
      },
      {
        title: Silian_t('admin.llmUsage.summary.calls7d'),
        value: Silian_formatNumber(Silian_summary.calls_7d, Silian_currentLanguage),
        subtitle: Silian_t('admin.llmUsage.summary.calls7dHint'),
        icon: Silian_Activity,
        tone: 'border-emerald-400'
      },
      {
        title: Silian_t('admin.llmUsage.summary.calls30d'),
        value: Silian_formatNumber(Silian_summary.calls_30d, Silian_currentLanguage),
        subtitle: Silian_t('admin.llmUsage.summary.calls30dHint'),
        icon: Silian_Sparkles,
        tone: 'border-indigo-400'
      },
      {
        title: Silian_t('admin.llmUsage.summary.tokens30d'),
        value: Silian_formatNumber(Silian_summary.tokens_30d, Silian_currentLanguage),
        subtitle: Silian_t('admin.llmUsage.summary.tokens30dHint'),
        icon: Silian_ShieldCheck,
        tone: 'border-slate-400'
      },
      {
        title: Silian_t('admin.llmUsage.summary.adminCalls'),
        value: Silian_formatNumber(Silian_summary.admin_calls_30d, Silian_currentLanguage),
        subtitle: Silian_t('admin.llmUsage.summary.adminCallsHint'),
        icon: Silian_Users,
        tone: 'border-blue-400'
      },
      {
        title: Silian_t('admin.llmUsage.summary.userCalls'),
        value: Silian_formatNumber(Silian_summary.user_calls_30d, Silian_currentLanguage),
        subtitle: Silian_t('admin.llmUsage.summary.userCallsHint'),
        icon: Silian_Users,
        tone: 'border-green-400'
      }
    ]),
    [Silian_summary, Silian_t, Silian_currentLanguage]
  );

  const Silian_openRelated = Silian_useCallback(async (Silian_requestId) => {
    if (!Silian_requestId) return;
    Silian_setSelectedConversationId(null);
    Silian_setSelectedLogId(null);
    Silian_setRequestDrawerId(Silian_requestId);
    Silian_setLoadingRelated(true);
    try {
      const Silian_response = await Silian_fetchRelatedLogs(Silian_requestId);
      Silian_setRelated(Silian_response?.data || Silian_response || { system: [], audit: [], error: [], llm: [] });
    } finally {
      Silian_setLoadingRelated(false);
    }
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold">{Silian_t('admin.llmUsage.title')}</h1>
          <p className="text-sm text-muted-foreground">{Silian_t('admin.llmUsage.subtitle')}</p>
        </div>
        <Silian_Button
          variant="outline"
          size="sm"
          onClick={() => {
            Silian_usageQuery.refetch();
            Silian_logsQuery.refetch();
            Silian_analyticsQuery.refetch();
            Silian_conversationsQuery.refetch();
          }}
          disabled={Silian_usageQuery.isFetching || Silian_logsQuery.isFetching || Silian_analyticsQuery.isFetching || Silian_conversationsQuery.isFetching}
        >
          <Silian_RefreshCw className={Silian_cn('mr-2 h-4 w-4', (Silian_usageQuery.isFetching || Silian_logsQuery.isFetching || Silian_analyticsQuery.isFetching || Silian_conversationsQuery.isFetching) && 'animate-spin')} />
          {Silian_t('admin.llmUsage.refresh')}
        </Silian_Button>
      </div>

      {Silian_usageQuery.isError && (
        <Silian_Alert variant="destructive">
          <Silian_AlertTitle>{Silian_t('common.error')}</Silian_AlertTitle>
          <Silian_AlertDescription>{Silian_usageQuery.error?.message || Silian_t('errors.loadFailed')}</Silian_AlertDescription>
        </Silian_Alert>
      )}

      {Silian_analyticsQuery.isError && (
        <Silian_Alert variant="destructive">
          <Silian_AlertTitle>{Silian_t('common.error')}</Silian_AlertTitle>
          <Silian_AlertDescription>{Silian_analyticsQuery.error?.message || Silian_t('errors.loadFailed')}</Silian_AlertDescription>
        </Silian_Alert>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {Silian_summaryCards.map((Silian_card) => (
          <Silian_StatCard key={Silian_card.title} {...Silian_card} />
        ))}
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{Silian_t('admin.llmUsage.charts.title')}</h2>
          <p className="text-sm text-muted-foreground">{Silian_t('admin.llmUsage.charts.subtitle')}</p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {[7, 30, 60].map((Silian_days) => (
            <Silian_Button
              key={Silian_days}
              size="sm"
              variant={Silian_trendDays === Silian_days ? 'default' : 'outline'}
              className="h-8"
              onClick={() => Silian_setTrendDays(Silian_days)}
              disabled={Silian_analyticsQuery.isFetching}
            >
              {Silian_t('admin.llmUsage.charts.range', { days: Silian_days })}
            </Silian_Button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Silian_Card>
          <Silian_CardHeader>
            <Silian_CardTitle>{Silian_t('admin.llmUsage.charts.callsTokens')}</Silian_CardTitle>
            <Silian_CardDescription>{Silian_t('admin.llmUsage.charts.callsTokensHint')}</Silian_CardDescription>
          </Silian_CardHeader>
          <Silian_CardContent className="h-72">
            {Silian_trendData.length ? (
              <Silian_ResponsiveContainer>
                <Silian_ComposedChart data={Silian_trendData}>
                  <Silian_CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <Silian_XAxis dataKey="date" tickFormatter={Silian_formatTrendDate} />
                  <Silian_YAxis yAxisId="left" allowDecimals={false} />
                  <Silian_YAxis yAxisId="right" orientation="right" allowDecimals={false} />
                  <Silian_Tooltip
                    formatter={(Silian_value, Silian__name, Silian_item) => {
                      const Silian_label = Silian_trendMetricLabels[Silian_item?.dataKey] || Silian_item?.name || Silian_item?.dataKey;
                      return [Silian_value, Silian_label];
                    }}
                    labelFormatter={Silian_formatTrendDate}
                    contentStyle={Silian_chartTooltipContentStyle}
                    labelStyle={Silian_chartTooltipLabelStyle}
                    itemStyle={Silian_chartTooltipItemStyle}
                  />
                  <Silian_Legend />
                  <Silian_Bar yAxisId="left" dataKey="calls" name={Silian_t('admin.llmUsage.charts.calls')} fill={Silian_CHART_COLORS[0]} radius={[6, 6, 0, 0]} />
                  <Silian_Line yAxisId="right" type="monotone" dataKey="tokens" name={Silian_t('admin.llmUsage.charts.tokens')} stroke={Silian_CHART_COLORS[1]} strokeWidth={2} dot={false} />
                </Silian_ComposedChart>
              </Silian_ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {Silian_analyticsQuery.isLoading ? Silian_t('common.loading') : Silian_t('admin.llmUsage.noData')}
              </div>
            )}
          </Silian_CardContent>
        </Silian_Card>

        <Silian_Card>
          <Silian_CardHeader>
            <Silian_CardTitle>{Silian_t('admin.llmUsage.charts.successLatency')}</Silian_CardTitle>
            <Silian_CardDescription>{Silian_t('admin.llmUsage.charts.successLatencyHint')}</Silian_CardDescription>
          </Silian_CardHeader>
          <Silian_CardContent className="h-72">
            {Silian_trendData.length ? (
              <Silian_ResponsiveContainer>
                <Silian_ComposedChart data={Silian_trendData}>
                  <Silian_CartesianGrid strokeDasharray="3 3" vertical={false} />
                  <Silian_XAxis dataKey="date" tickFormatter={Silian_formatTrendDate} />
                  <Silian_YAxis yAxisId="left" allowDecimals={false} />
                  <Silian_YAxis yAxisId="right" orientation="right" />
                  <Silian_Tooltip
                    formatter={(Silian_value, Silian__name, Silian_item) => {
                      const Silian_dataKey = Silian_item?.dataKey;
                      if (Silian_dataKey === 'avg_latency_ms') {
                        const Silian_display = Silian_value == null ? '-' : `${Silian_decimalFormatter.format(Silian_value)} ms`;
                        return [Silian_display, Silian_trendMetricLabels.avg_latency_ms];
                      }
                      return [Silian_value, Silian_trendMetricLabels[Silian_dataKey] || Silian_item?.name || Silian_dataKey];
                    }}
                    labelFormatter={Silian_formatTrendDate}
                    contentStyle={Silian_chartTooltipContentStyle}
                    labelStyle={Silian_chartTooltipLabelStyle}
                    itemStyle={Silian_chartTooltipItemStyle}
                  />
                  <Silian_Legend />
                  <Silian_Bar yAxisId="left" dataKey="success_calls" stackId="status" name={Silian_t('admin.llmUsage.charts.success')} fill={Silian_CHART_COLORS[2]} />
                  <Silian_Bar yAxisId="left" dataKey="failed_calls" stackId="status" name={Silian_t('admin.llmUsage.charts.failed')} fill={Silian_CHART_COLORS[4]} />
                  <Silian_Line yAxisId="right" type="monotone" dataKey="avg_latency_ms" name={Silian_t('admin.llmUsage.charts.latency')} stroke={Silian_CHART_COLORS[3]} strokeWidth={2} dot={false} />
                </Silian_ComposedChart>
              </Silian_ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {Silian_analyticsQuery.isLoading ? Silian_t('common.loading') : Silian_t('admin.llmUsage.noData')}
              </div>
            )}
          </Silian_CardContent>
        </Silian_Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <Silian_Card>
          <Silian_CardHeader>
            <Silian_CardTitle>{Silian_t('admin.llmUsage.charts.modelShare')}</Silian_CardTitle>
            <Silian_CardDescription>{Silian_t('admin.llmUsage.charts.modelShareHint')}</Silian_CardDescription>
          </Silian_CardHeader>
          <Silian_CardContent className="h-72">
            {Silian_modelData.length ? (
              <Silian_ResponsiveContainer>
                <Silian_PieChart>
                  <Silian_Pie data={Silian_modelData} dataKey="calls" nameKey="model" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {Silian_modelData.map((Silian_entry, Silian_index) => (
                      <Silian_Cell key={`model-${Silian_entry.model}-${Silian_index}`} fill={Silian_CHART_COLORS[Silian_index % Silian_CHART_COLORS.length]} />
                    ))}
                  </Silian_Pie>
                  <Silian_Tooltip
                    formatter={(Silian_value, Silian_name) => [Silian_value, Silian_name]}
                    contentStyle={Silian_chartTooltipContentStyle}
                    labelStyle={Silian_chartTooltipLabelStyle}
                    itemStyle={Silian_chartTooltipItemStyle}
                  />
                  <Silian_Legend />
                </Silian_PieChart>
              </Silian_ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {Silian_analyticsQuery.isLoading ? Silian_t('common.loading') : Silian_t('admin.llmUsage.noData')}
              </div>
            )}
          </Silian_CardContent>
        </Silian_Card>

        <Silian_Card>
          <Silian_CardHeader>
            <Silian_CardTitle>{Silian_t('admin.llmUsage.charts.sourceShare')}</Silian_CardTitle>
            <Silian_CardDescription>{Silian_t('admin.llmUsage.charts.sourceShareHint')}</Silian_CardDescription>
          </Silian_CardHeader>
          <Silian_CardContent className="h-72">
            {Silian_sourceData.length ? (
              <Silian_ResponsiveContainer>
                <Silian_BarChart data={Silian_sourceData} layout="vertical" margin={{ left: 12 }}>
                  <Silian_CartesianGrid strokeDasharray="3 3" horizontal={false} />
                  <Silian_XAxis type="number" allowDecimals={false} />
                  <Silian_YAxis type="category" dataKey="source" width={90} />
                  <Silian_Tooltip
                    formatter={(Silian_value) => [Silian_value, Silian_t('admin.llmUsage.charts.calls')]}
                    contentStyle={Silian_chartTooltipContentStyle}
                    labelStyle={Silian_chartTooltipLabelStyle}
                    itemStyle={Silian_chartTooltipItemStyle}
                  />
                  <Silian_Bar dataKey="calls" fill={Silian_CHART_COLORS[1]} radius={[0, 6, 6, 0]} />
                </Silian_BarChart>
              </Silian_ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {Silian_analyticsQuery.isLoading ? Silian_t('common.loading') : Silian_t('admin.llmUsage.noData')}
              </div>
            )}
          </Silian_CardContent>
        </Silian_Card>

        <Silian_Card>
          <Silian_CardHeader>
            <Silian_CardTitle>{Silian_t('admin.llmUsage.charts.actorShare')}</Silian_CardTitle>
            <Silian_CardDescription>{Silian_t('admin.llmUsage.charts.actorShareHint')}</Silian_CardDescription>
          </Silian_CardHeader>
          <Silian_CardContent className="h-72">
            {Silian_actorData.length ? (
              <Silian_ResponsiveContainer>
                <Silian_PieChart>
                  <Silian_Pie data={Silian_actorData} dataKey="calls" nameKey="actor_label" innerRadius={50} outerRadius={90} paddingAngle={2}>
                    {Silian_actorData.map((Silian_entry, Silian_index) => (
                      <Silian_Cell key={`actor-${Silian_entry.actor_label || Silian_entry.actor_type}-${Silian_index}`} fill={Silian_CHART_COLORS[Silian_index % Silian_CHART_COLORS.length]} />
                    ))}
                  </Silian_Pie>
                  <Silian_Tooltip
                    formatter={(Silian_value, Silian_name) => [Silian_value, Silian_name]}
                    contentStyle={Silian_chartTooltipContentStyle}
                    labelStyle={Silian_chartTooltipLabelStyle}
                    itemStyle={Silian_chartTooltipItemStyle}
                  />
                  <Silian_Legend />
                </Silian_PieChart>
              </Silian_ResponsiveContainer>
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                {Silian_analyticsQuery.isLoading ? Silian_t('common.loading') : Silian_t('admin.llmUsage.noData')}
              </div>
            )}
          </Silian_CardContent>
        </Silian_Card>
      </div>

      <Silian_Card>
        <Silian_CardHeader>
          <Silian_CardTitle>{Silian_t('admin.llmUsage.insights.title')}</Silian_CardTitle>
          <Silian_CardDescription>{Silian_t('admin.llmUsage.insights.subtitle')}</Silian_CardDescription>
        </Silian_CardHeader>
        <Silian_CardContent>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {Silian_insightCards.map((Silian_insight) => (
              <Silian_InsightCard
                key={Silian_insight.key}
                title={Silian_insight.title}
                value={Silian_insight.value}
                subtitle={Silian_insight.subtitle}
                trend={Silian_insight.trend}
              />
            ))}
          </div>
        </Silian_CardContent>
      </Silian_Card>

      <Silian_Card>
        <Silian_CardHeader className="space-y-2">
          <Silian_CardTitle>{Silian_t('admin.llmUsage.recent.title')}</Silian_CardTitle>
          <Silian_CardDescription>{Silian_t('admin.llmUsage.recent.subtitle')}</Silian_CardDescription>
        </Silian_CardHeader>
        <Silian_CardContent className="space-y-4">
          {Silian_recentConversations.length === 0 && (
            <div className="text-sm text-muted-foreground">{Silian_analyticsQuery.isLoading ? Silian_t('common.loading') : Silian_t('admin.llmUsage.recent.empty')}</div>
          )}
          {Silian_recentConversations.map((Silian_log) => {
            const Silian_actorLabel = Silian_log.actor_type === 'admin'
              ? Silian_t('admin.llmUsage.actorAdmin')
              : Silian_log.actor_type === 'user'
                ? Silian_t('admin.llmUsage.actorUser')
                : Silian_log.actor_type;
            return (
            <div key={Silian_log.id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Silian_Badge variant={Silian_log.actor_type === 'admin' ? 'default' : 'secondary'}>
                    {Silian_actorLabel || Silian_log.actor_type}
                  </Silian_Badge>
                  <span className="text-[11px] text-muted-foreground">#{Silian_log.actor_id ?? '-'}</span>
                  {Silian_log.actor_name && (
                    <span className="text-xs font-medium">{Silian_log.actor_name}</span>
                  )}
                  <Silian_Badge variant={Silian_log.status === 'failed' ? 'destructive' : 'outline'}>
                    {Silian_log.status || '-'}
                  </Silian_Badge>
                </div>
                <div className="text-xs text-muted-foreground">{Silian_safeDate(Silian_log.created_at, Silian_currentLanguage)}</div>
              </div>

              <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-3">
                  <span>{Silian_t('admin.llmUsage.recent.source')}: <span className="font-mono text-foreground">{Silian_log.source || '-'}</span></span>
                  <span>{Silian_t('admin.llmUsage.recent.model')}: <span className="font-mono text-foreground">{Silian_log.model || '-'}</span></span>
                  {Silian_log.system_path && (
                    <span>
                      {Silian_t('admin.llmUsage.recent.path')}:{' '}
                      <span className="font-mono text-foreground">
                        {Silian_log.system_path}
                        {Silian_log.system_status_code ? ` (${Silian_log.system_status_code})` : ''}
                      </span>
                    </span>
                  )}
                </div>
                {Silian_log.context?.client_time && (
                  <div>{Silian_t('admin.llmUsage.recent.clientTime')}: <span className="font-mono text-foreground">{Silian_log.context.client_time}</span></div>
                )}
              </div>

              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {Silian_t('admin.llmUsage.recent.prompt')}
                  </div>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-[11px] text-green-200">
                    {Silian_log.prompt_preview || '-'}
                  </pre>
                </div>
                <div>
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
                    {Silian_t('admin.llmUsage.recent.response')}
                  </div>
                  <pre className="mt-1 max-h-40 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-[11px] text-emerald-200">
                    {Silian_log.response_preview || '-'}
                  </pre>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-muted-foreground">
                <div className="flex flex-wrap items-center gap-3">
                  <span>{Silian_t('admin.llmUsage.recent.tokens')}: <span className="font-mono text-foreground">{Silian_log.total_tokens ?? '-'}</span></span>
                  <span>{Silian_t('admin.llmUsage.recent.latency')}: <span className="font-mono text-foreground">{Silian_log.latency_ms ?? '-'}</span></span>
                  <span>{Silian_t('admin.llmUsage.recent.requestId')}: <span className="font-mono text-foreground">{Silian_log.request_id || '-'}</span></span>
                  {Silian_log.response_id && (
                    <span>{Silian_t('admin.llmUsage.recent.responseId')}: <span className="font-mono text-foreground">{Silian_log.response_id}</span></span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Silian_Badge variant="secondary">
                    {Silian_t('admin.llmUsage.recent.relatedCounts', {
                      system: Silian_log.related?.system ?? 0,
                      audit: Silian_log.related?.audit ?? 0,
                      error: Silian_log.related?.error ?? 0
                    })}
                  </Silian_Badge>
                  {Silian_log.request_id && (
                    <Silian_Button size="sm" variant="outline" onClick={() => Silian_openRelated(Silian_log.request_id)}>
                      {Silian_t('admin.llmUsage.recent.related')}
                    </Silian_Button>
                  )}
                  <Silian_Button size="sm" variant="ghost" onClick={() => Silian_setSelectedLogId(Silian_log.id)}>
                    {Silian_t('admin.llmUsage.recent.viewDetail')}
                  </Silian_Button>
                </div>
              </div>
            </div>
          );
          })}
        </Silian_CardContent>
      </Silian_Card>

      <Silian_Card>
        <Silian_CardHeader className="space-y-4">
          <Silian_CardTitle>{Silian_t('admin.llmUsage.sessions.title')}</Silian_CardTitle>
          <Silian_CardDescription>{Silian_t('admin.llmUsage.sessions.subtitle')}</Silian_CardDescription>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <Silian_Input
              value={Silian_sessionAdminId}
              onChange={(Silian_event) => Silian_setSessionAdminId(Silian_event.target.value)}
              placeholder={Silian_t('admin.llmUsage.sessions.filters.adminId', { defaultValue: 'Admin ID' })}
              className="h-9"
            />
            <Silian_Input
              value={Silian_sessionModel}
              onChange={(Silian_event) => Silian_setSessionModel(Silian_event.target.value)}
              placeholder={Silian_t('admin.llmUsage.sessions.filters.model', { defaultValue: 'Model' })}
              className="h-9"
            />
            <select
              value={Silian_sessionStatus}
              onChange={(Silian_event) => Silian_setSessionStatus(Silian_event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{Silian_t('admin.llmUsage.sessions.filters.allStatus', { defaultValue: 'All statuses' })}</option>
              <option value="active">{Silian_t('admin.llmUsage.sessions.active')}</option>
              <option value="waiting_confirmation">{Silian_t('admin.llmUsage.sessions.waiting')}</option>
            </select>
            <select
              value={Silian_sessionPendingFilter}
              onChange={(Silian_event) => Silian_setSessionPendingFilter(Silian_event.target.value)}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">{Silian_t('admin.llmUsage.sessions.filters.pendingAny', { defaultValue: 'Any pending state' })}</option>
              <option value="true">{Silian_t('admin.llmUsage.sessions.filters.pendingYes', { defaultValue: 'Has pending action' })}</option>
              <option value="false">{Silian_t('admin.llmUsage.sessions.filters.pendingNo', { defaultValue: 'No pending action' })}</option>
            </select>
            <Silian_Input
              type="date"
              value={Silian_sessionDateFrom}
              onChange={(Silian_event) => Silian_setSessionDateFrom(Silian_event.target.value)}
              className="h-9"
            />
            <Silian_Input
              type="date"
              value={Silian_sessionDateTo}
              onChange={(Silian_event) => Silian_setSessionDateTo(Silian_event.target.value)}
              className="h-9"
            />
          </div>
        </Silian_CardHeader>
        <Silian_CardContent className="space-y-4">
          {Silian_conversationsQuery.isLoading && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Silian_Loader2 className="h-4 w-4 animate-spin" />
              {Silian_t('common.loading')}
            </div>
          )}
          {!Silian_conversationsQuery.isLoading && Silian_conversationItems.length === 0 && (
            <div className="text-sm text-muted-foreground">{Silian_t('admin.llmUsage.sessions.empty')}</div>
          )}
          {Silian_conversationItems.map((Silian_conversation) => (
            <div key={Silian_conversation.conversation_id} className="rounded-xl border bg-card p-4 shadow-sm">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="font-medium">{Silian_conversation.title || Silian_t('admin.llmUsage.sessions.untitled')}</div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    {Silian_conversation.last_message_preview || Silian_t('admin.llmUsage.sessions.noPreview')}
                  </div>
                  <div className="mt-2 font-mono text-[11px] text-muted-foreground">
                    {Silian_conversation.conversation_id}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Silian_Badge variant={Silian_conversation.status === 'waiting_confirmation' ? 'secondary' : 'outline'}>
                    {Silian_conversation.status === 'waiting_confirmation'
                      ? Silian_t('admin.llmUsage.sessions.waiting')
                      : Silian_t('admin.llmUsage.sessions.active')}
                  </Silian_Badge>
                  <Silian_Button size="sm" variant="outline" onClick={() => Silian_setSelectedConversationId(Silian_conversation.conversation_id)}>
                    {Silian_t('admin.llmUsage.sessions.view')}
                  </Silian_Button>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                <span>{Silian_t('admin.llmUsage.sessions.adminId', { defaultValue: 'Admin' })}: <span className="font-mono text-foreground">#{Silian_conversation.admin_id ?? '-'}</span></span>
                <span>{Silian_t('admin.llmUsage.sessions.messages')}: <span className="font-mono text-foreground">{Silian_conversation.message_count ?? 0}</span></span>
                <span>{Silian_t('admin.llmUsage.sessions.tokens')}: <span className="font-mono text-foreground">{Silian_conversation.total_tokens ?? 0}</span></span>
                <span>{Silian_t('admin.llmUsage.sessions.calls')}: <span className="font-mono text-foreground">{Silian_conversation.llm_calls ?? 0}</span></span>
                <span>{Silian_t('admin.llmUsage.sessions.pendingCount', { defaultValue: 'Pending' })}: <span className="font-mono text-foreground">{Silian_conversation.pending_action_count ?? 0}</span></span>
                <span>{Silian_t('admin.llmUsage.sessions.lastModel')}: <span className="font-mono text-foreground">{Silian_conversation.last_model || '-'}</span></span>
                <span>{Silian_t('admin.llmUsage.sessions.lastActivity')}: <span className="font-mono text-foreground">{Silian_safeDate(Silian_conversation.last_activity_at, Silian_currentLanguage)}</span></span>
              </div>
            </div>
          ))}
        </Silian_CardContent>
      </Silian_Card>

      <Silian_Card>
        <Silian_CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Silian_CardTitle>{Silian_t('admin.llmUsage.users.title')}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('admin.llmUsage.users.subtitle')}</Silian_CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Silian_Input
                value={Silian_search}
                onChange={(Silian_event) => {
                  Silian_setSearch(Silian_event.target.value);
                  Silian_setPage(1);
                }}
                placeholder={Silian_t('admin.llmUsage.users.searchPlaceholder')}
                className="h-9 w-64"
              />
            </div>
          </div>
        </Silian_CardHeader>
        <Silian_CardContent className="p-0">
          {Silian_usageQuery.isLoading ? (
            <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
              <Silian_Loader2 className="h-4 w-4 animate-spin" />
              {Silian_t('common.loading')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-4 py-2 text-left">{Silian_t('admin.llmUsage.users.columns.user')}</th>
                    <th className="px-4 py-2 text-left">{Silian_t('admin.llmUsage.users.columns.role')}</th>
                    <th className="px-4 py-2 text-left">{Silian_t('admin.llmUsage.users.columns.group')}</th>
                    <th className="px-4 py-2 text-right">{Silian_t('admin.llmUsage.users.columns.dailyUsed')}</th>
                    <th className="px-4 py-2 text-right">{Silian_t('admin.llmUsage.users.columns.dailyLimit')}</th>
                    <th className="px-4 py-2 text-right">{Silian_t('admin.llmUsage.users.columns.remaining')}</th>
                    <th className="px-4 py-2 text-right">{Silian_t('admin.llmUsage.users.columns.rateLimit')}</th>
                    <th className="px-4 py-2 text-left">{Silian_t('admin.llmUsage.users.columns.resetAt')}</th>
                    <th className="px-4 py-2 text-left">{Silian_t('admin.llmUsage.users.columns.lastUsed')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Silian_users.map((Silian_user) => (
                    <tr key={Silian_user.id} className="border-b">
                      <td className="px-4 py-2">
                        <div className="font-medium">{Silian_user.username || Silian_t('common.none')}</div>
                        <div className="text-[11px] text-muted-foreground">{Silian_user.email}</div>
                      </td>
                      <td className="px-4 py-2">
                        <Silian_Badge variant={Silian_user.is_admin ? 'default' : 'secondary'}>
                          {Silian_user.is_admin ? Silian_t('admin.llmUsage.users.admin') : Silian_t('admin.llmUsage.users.user')}
                        </Silian_Badge>
                      </td>
                      <td className="px-4 py-2">{Silian_user.group_name || Silian_t('common.none')}</td>
                      <td className="px-4 py-2 text-right">{Silian_formatNumber(Silian_user.daily_used, Silian_currentLanguage)}</td>
                      <td className="px-4 py-2 text-right">
                        {Silian_user.daily_limit == null ? Silian_t('admin.llmUsage.users.unlimited') : Silian_formatNumber(Silian_user.daily_limit, Silian_currentLanguage)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {Silian_user.daily_remaining == null ? '-' : Silian_formatNumber(Silian_user.daily_remaining, Silian_currentLanguage)}
                      </td>
                      <td className="px-4 py-2 text-right">
                        {Silian_user.rate_limit == null ? '-' : Silian_formatNumber(Silian_user.rate_limit, Silian_currentLanguage)}
                      </td>
                      <td className="px-4 py-2">{Silian_safeDate(Silian_user.reset_at, Silian_currentLanguage)}</td>
                      <td className="px-4 py-2">{Silian_safeDate(Silian_user.last_used_at, Silian_currentLanguage)}</td>
                    </tr>
                  ))}
                  {Silian_users.length === 0 && (
                    <tr>
                      <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                        {Silian_t('admin.llmUsage.users.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Silian_CardContent>
        <div className="flex items-center justify-between border-t px-6 py-3 text-xs text-muted-foreground">
          <span>
            {Silian_t('admin.llmUsage.users.pagination', {
              page: Silian_pagination.current_page || 1,
              total: Silian_pagination.total_pages || 1
            })}
          </span>
          <div className="flex items-center gap-2">
            <Silian_Button size="sm" variant="outline" disabled={!Silian_canPrev} onClick={() => Silian_setPage((Silian_p) => Math.max(1, Silian_p - 1))}>
              {Silian_t('admin.llmUsage.users.prev')}
            </Silian_Button>
            <Silian_Button size="sm" variant="outline" disabled={!Silian_canNext} onClick={() => Silian_setPage((Silian_p) => Silian_p + 1)}>
              {Silian_t('admin.llmUsage.users.next')}
            </Silian_Button>
          </div>
        </div>
      </Silian_Card>

      <Silian_Card>
        <Silian_CardHeader className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Silian_CardTitle>{Silian_t('admin.llmUsage.logs.title')}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('admin.llmUsage.logs.subtitle')}</Silian_CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Silian_Input
                value={Silian_logQuery}
                onChange={(Silian_event) => Silian_setLogQuery(Silian_event.target.value)}
                placeholder={Silian_t('admin.llmUsage.logs.searchPlaceholder')}
                className="h-9 w-64"
              />
              <Silian_Input
                value={Silian_logConversationId}
                onChange={(Silian_event) => Silian_setLogConversationId(Silian_event.target.value)}
                placeholder={Silian_t('admin.llmUsage.logs.filters.conversationId', { defaultValue: 'Conversation ID' })}
                className="h-9 w-52 font-mono"
              />
              <Silian_Input
                value={Silian_logTurnNo}
                onChange={(Silian_event) => Silian_setLogTurnNo(Silian_event.target.value)}
                placeholder={Silian_t('admin.llmUsage.logs.filters.turnNo', { defaultValue: 'Turn No.' })}
                className="h-9 w-28 font-mono"
              />
            </div>
          </div>
        </Silian_CardHeader>
        <Silian_CardContent className="p-0">
          {Silian_logsQuery.isLoading ? (
            <div className="flex items-center gap-2 px-6 py-8 text-sm text-muted-foreground">
              <Silian_Loader2 className="h-4 w-4 animate-spin" />
              {Silian_t('common.loading')}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-muted/60">
                  <tr>
                    <th className="px-4 py-2 text-left">{Silian_t('admin.llmUsage.logs.columns.time')}</th>
                    <th className="px-4 py-2 text-left">{Silian_t('admin.llmUsage.logs.columns.conversationId', { defaultValue: 'Conversation' })}</th>
                    <th className="px-4 py-2 text-right">{Silian_t('admin.llmUsage.logs.columns.turnNo', { defaultValue: 'Turn' })}</th>
                    <th className="px-4 py-2 text-left">{Silian_t('admin.llmUsage.logs.columns.actor')}</th>
                    <th className="px-4 py-2 text-left">{Silian_t('admin.llmUsage.logs.columns.source')}</th>
                    <th className="px-4 py-2 text-left">{Silian_t('admin.llmUsage.logs.columns.model')}</th>
                    <th className="px-4 py-2 text-left">{Silian_t('admin.llmUsage.logs.columns.status')}</th>
                    <th className="px-4 py-2 text-right">{Silian_t('admin.llmUsage.logs.columns.tokens')}</th>
                    <th className="px-4 py-2 text-right">{Silian_t('admin.llmUsage.logs.columns.latency')}</th>
                    <th className="px-4 py-2 text-left">{Silian_t('admin.llmUsage.logs.columns.requestId')}</th>
                    <th className="px-4 py-2 text-left">{Silian_t('admin.llmUsage.logs.columns.prompt')}</th>
                    <th className="px-4 py-2 text-right">{Silian_t('admin.llmUsage.logs.columns.actions')}</th>
                  </tr>
                </thead>
                <tbody>
                  {Silian_llmLogs.map((Silian_log) => (
                    <tr key={Silian_log.id} className="border-b">
                      <td className="px-4 py-2 whitespace-nowrap">{Silian_safeDate(Silian_log.created_at, Silian_currentLanguage)}</td>
                      <td className="px-4 py-2 max-w-[180px] truncate font-mono text-[11px]" title={Silian_log.conversation_id || ''}>
                        {Silian_log.conversation_id || '-'}
                      </td>
                      <td className="px-4 py-2 text-right">{Silian_log.turn_no ?? '-'}</td>
                      <td className="px-4 py-2">
                        <div className="flex items-center gap-2">
                          <Silian_Badge variant={Silian_log.actor_type === 'admin' ? 'default' : 'secondary'}>
                            {Silian_log.actor_type || Silian_t('common.none')}
                          </Silian_Badge>
                          <span className="text-[11px] text-muted-foreground">#{Silian_log.actor_id ?? '-'}</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 max-w-[160px] truncate" title={Silian_log.source || ''}>
                        {Silian_log.source || '-'}
                      </td>
                      <td className="px-4 py-2">{Silian_log.model || '-'}</td>
                      <td className="px-4 py-2">
                        <Silian_Badge variant={Silian_log.status === 'failed' ? 'destructive' : 'outline'}>
                          {Silian_log.status || '-'}
                        </Silian_Badge>
                      </td>
                      <td className="px-4 py-2 text-right">{Silian_log.total_tokens ?? '-'}</td>
                      <td className="px-4 py-2 text-right">{Silian_log.latency_ms ?? '-'}</td>
                      <td className="px-4 py-2 font-mono text-[11px] truncate max-w-[140px]" title={Silian_log.request_id}>
                        {Silian_log.request_id ? (
                          <button
                            type="button"
                            className="text-primary hover:underline"
                            onClick={() => Silian_openRelated(Silian_log.request_id)}
                          >
                            {Silian_log.request_id}
                          </button>
                        ) : (
                          '-'
                        )}
                      </td>
                      <td className="px-4 py-2 max-w-[220px] truncate font-mono text-[11px]" title={Silian_log.prompt}>
                        {Silian_log.prompt ? String(Silian_log.prompt).slice(0, 120) : '-'}
                      </td>
                      <td className="px-4 py-2 text-right">
                        <Silian_Button size="sm" variant="ghost" onClick={() => Silian_setSelectedLogId(Silian_log.id)}>
                          {Silian_t('admin.llmUsage.logs.view')}
                        </Silian_Button>
                      </td>
                    </tr>
                  ))}
                  {Silian_llmLogs.length === 0 && (
                    <tr>
                      <td colSpan={12} className="px-4 py-8 text-center text-muted-foreground">
                        {Silian_t('admin.llmUsage.logs.empty')}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </Silian_CardContent>
      </Silian_Card>

      <Silian_Dialog open={Boolean(Silian_selectedConversationId)} onOpenChange={(Silian_open) => !Silian_open && Silian_setSelectedConversationId(null)}>
        <Silian_DialogContent className="max-w-5xl">
          <Silian_DialogHeader>
            <Silian_DialogTitle>{Silian_t('admin.llmUsage.sessions.detailTitle')}</Silian_DialogTitle>
          </Silian_DialogHeader>
          {Silian_conversationDetailQuery.isLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Silian_Loader2 className="h-4 w-4 animate-spin" />
              {Silian_t('common.loading')}
            </div>
          )}
          {Silian_conversationDetailQuery.data && (
            <Silian_ScrollArea className="max-h-[70vh] pr-2">
              <div className="space-y-4 text-xs">
                <div className="grid gap-3 md:grid-cols-2">
                  <Silian_DetailItem label={Silian_t('admin.llmUsage.sessions.conversationId', { defaultValue: 'Conversation ID' })} value={Silian_conversationDetailQuery.data.conversation_id} />
                  <Silian_DetailItem label={Silian_t('admin.llmUsage.sessions.adminId', { defaultValue: 'Admin' })} value={Silian_conversationItems.find((Silian_item) => Silian_item.conversation_id === Silian_conversationDetailQuery.data.conversation_id)?.admin_id ?? '-'} />
                  <Silian_DetailItem label={Silian_t('admin.llmUsage.sessions.messages')} value={Silian_conversationDetailQuery.data.summary?.message_count} />
                  <Silian_DetailItem label={Silian_t('admin.llmUsage.sessions.tokens')} value={Silian_conversationDetailQuery.data.summary?.total_tokens} />
                  <Silian_DetailItem label={Silian_t('admin.llmUsage.sessions.calls')} value={Silian_conversationDetailQuery.data.summary?.llm_calls} />
                  <Silian_DetailItem label={Silian_t('admin.llmUsage.sessions.lastModel')} value={Silian_conversationDetailQuery.data.summary?.last_model || '-'} />
                  <Silian_DetailItem label={Silian_t('admin.llmUsage.sessions.status')} value={Silian_conversationDetailQuery.data.summary?.status || '-'} />
                  <Silian_DetailItem label={Silian_t('admin.llmUsage.sessions.lastActivity')} value={Silian_safeDate(Silian_conversationDetailQuery.data.summary?.last_activity_at, Silian_currentLanguage)} />
                </div>

                <Silian_DetailBlock title={Silian_t('admin.llmUsage.sessions.timeline')}>
                  <div className="space-y-3">
                    {(Silian_conversationDetailQuery.data.messages || []).map((Silian_item) => (
                      <div key={Silian_item.id} className="rounded-xl border bg-card p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <Silian_Badge variant={Silian_item.role === 'user' ? 'secondary' : 'outline'}>
                              {Silian_item.role || Silian_item.kind}
                            </Silian_Badge>
                            <span className="font-mono text-[11px] text-muted-foreground">{Silian_item.action}</span>
                            {Silian_item.status && <Silian_Badge variant="outline">{Silian_item.status}</Silian_Badge>}
                          </div>
                          <div className="text-[11px] text-muted-foreground">{Silian_safeDate(Silian_item.created_at, Silian_currentLanguage)}</div>
                        </div>
                        {Silian_item.content && (
                          <pre className="mt-3 whitespace-pre-wrap rounded bg-slate-900 p-3 text-[11px] text-emerald-200">
                            {Silian_item.content}
                          </pre>
                        )}
                        {Silian_item.meta?.request_id && (
                          <div className="mt-2">
                            <Silian_Button size="sm" variant="ghost" onClick={() => Silian_openRelated(Silian_item.meta.request_id)}>
                              {Silian_t('admin.llmUsage.recent.related')}
                            </Silian_Button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </Silian_DetailBlock>
              </div>
            </Silian_ScrollArea>
          )}
        </Silian_DialogContent>
      </Silian_Dialog>

      <Silian_Dialog open={Boolean(Silian_selectedLogId)} onOpenChange={(Silian_open) => !Silian_open && Silian_setSelectedLogId(null)}>
        <Silian_DialogContent className="max-w-5xl">
          <Silian_DialogHeader>
            <Silian_DialogTitle>{Silian_t('admin.llmUsage.logs.detailTitle', { id: Silian_selectedLogId })}</Silian_DialogTitle>
          </Silian_DialogHeader>
          {Silian_logDetailQuery.isLoading && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Silian_Loader2 className="h-4 w-4 animate-spin" />
              {Silian_t('common.loading')}
            </div>
          )}
          {Silian_logDetailQuery.data && (
            <Silian_ScrollArea className="max-h-[70vh] pr-2">
              <div className="space-y-4 text-xs">
                <div className="grid gap-3 md:grid-cols-2">
                  <Silian_DetailItem label={Silian_t('admin.llmUsage.logs.columns.conversationId', { defaultValue: 'Conversation' })} value={Silian_logDetailQuery.data.conversation_id || '-'} />
                  <Silian_DetailItem label={Silian_t('admin.llmUsage.logs.columns.turnNo', { defaultValue: 'Turn' })} value={Silian_logDetailQuery.data.turn_no ?? '-'} />
                  <Silian_DetailItem label={Silian_t('admin.llmUsage.logs.columns.requestId')} value={Silian_logDetailQuery.data.request_id} />
                  <Silian_DetailItem label={Silian_t('admin.llmUsage.logs.columns.model')} value={Silian_logDetailQuery.data.model} />
                  <Silian_DetailItem label={Silian_t('admin.llmUsage.logs.columns.source')} value={Silian_logDetailQuery.data.source} />
                  <Silian_DetailItem label={Silian_t('admin.llmUsage.logs.columns.status')} value={Silian_logDetailQuery.data.status} />
                  <Silian_DetailItem label={Silian_t('admin.llmUsage.logs.columns.tokens')} value={Silian_logDetailQuery.data.total_tokens} />
                  <Silian_DetailItem label={Silian_t('admin.llmUsage.logs.columns.latency')} value={Silian_logDetailQuery.data.latency_ms} />
                  <Silian_DetailItem label={Silian_t('admin.llmUsage.logs.columns.actor')} value={`${Silian_logDetailQuery.data.actor_type} #${Silian_logDetailQuery.data.actor_id ?? '-'}`} />
                  <Silian_DetailItem label={Silian_t('admin.llmUsage.logs.columns.responseId')} value={Silian_logDetailQuery.data.response_id || '-'} />
                  <Silian_DetailItem label={Silian_t('admin.llmUsage.logs.columns.time')} value={Silian_safeDate(Silian_logDetailQuery.data.created_at, Silian_currentLanguage)} />
                </div>

                {Silian_logDetailQuery.data.prompt && (
                  <Silian_DetailBlock title={Silian_t('admin.llmUsage.logs.prompt')}>
                    <Silian_JsonTreeViewer value={Silian_parseMaybeJson(Silian_logDetailQuery.data.prompt)} />
                  </Silian_DetailBlock>
                )}

                {Silian_logDetailQuery.data.response_raw && (
                  <Silian_DetailBlock title={Silian_t('admin.llmUsage.logs.response')}>
                    {typeof Silian_parseMaybeJson(Silian_logDetailQuery.data.response_raw) === 'string' ? (
                      <pre className="max-h-80 overflow-auto whitespace-pre-wrap rounded bg-slate-900 p-3 text-[11px] text-green-200">
                        {Silian_logDetailQuery.data.response_raw}
                      </pre>
                    ) : (
                      <Silian_JsonTreeViewer value={Silian_parseMaybeJson(Silian_logDetailQuery.data.response_raw)} />
                    )}
                  </Silian_DetailBlock>
                )}

                {Silian_logDetailQuery.data.error_message && (
                  <Silian_DetailBlock title={Silian_t('admin.llmUsage.logs.error')}>
                    <pre className="whitespace-pre-wrap rounded bg-rose-50 p-3 text-[11px] text-rose-600">
                      {Silian_logDetailQuery.data.error_message}
                    </pre>
                  </Silian_DetailBlock>
                )}
              </div>
            </Silian_ScrollArea>
          )}
        </Silian_DialogContent>
      </Silian_Dialog>

      <Silian_RequestIdRelatedDrawer
        open={Boolean(Silian_requestDrawerId)}
        requestId={Silian_requestDrawerId}
        onClose={() => Silian_setRequestDrawerId(null)}
        loading={Silian_loadingRelated}
        data={Silian_related}
        onRefresh={() => Silian_requestDrawerId && Silian_openRelated(Silian_requestDrawerId)}
      />
    </div>
  );
}

function Silian_DetailItem({ label: Silian_label, value: Silian_value }) {
  return (
    <div>
      <div className="text-[11px] font-semibold text-muted-foreground">{Silian_label}</div>
      <div className="font-mono">{Silian_value ?? '-'}</div>
    </div>
  );
}

function Silian_DetailBlock({ title: Silian_title, children: Silian_children }) {
  return (
    <div className="space-y-2">
      <div className="text-[11px] font-semibold text-muted-foreground">{Silian_title}</div>
      {Silian_children}
    </div>
  );
}
