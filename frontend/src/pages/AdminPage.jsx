import Silian_React, { useMemo as Silian_useMemo, useState as Silian_useState } from 'react';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { UserManagement as Silian_UserManagement } from '../components/admin/UserManagement';
import { ActivityReview as Silian_ActivityReview } from '../components/admin/ActivityReview';
import { ProductManagement as Silian_ProductManagement } from '../components/admin/ProductManagement';
import { ExchangeManagement as Silian_ExchangeManagement } from '../components/admin/ExchangeManagement';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../components/ui/Card';
import { BroadcastCenter as Silian_BroadcastCenter } from '../components/admin/BroadcastCenter';
import { Tabs as Silian_Tabs, TabsContent as Silian_TabsContent, TabsList as Silian_TabsList, TabsTrigger as Silian_TabsTrigger } from '../components/ui/Tabs';
import { useQuery as Silian_useQuery } from 'react-query';
import { adminAPI as Silian_adminAPI } from '../lib/api';
import { Loader2 as Silian_Loader2, AlertCircle as Silian_AlertCircle, RefreshCw as Silian_RefreshCw, LineChart as Silian_LineChartIcon, Clock as Silian_Clock } from 'lucide-react';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription, AlertTitle as Silian_AlertTitle } from '../components/ui/Alert';
import { Button as Silian_Button } from '../components/ui/Button';
import {
  ResponsiveContainer as Silian_ResponsiveContainer,
  ComposedChart as Silian_ComposedChart,
  Line as Silian_Line,
  Bar as Silian_Bar,
  XAxis as Silian_XAxis,
  YAxis as Silian_YAxis,
  CartesianGrid as Silian_CartesianGrid,
  Tooltip as Silian_Tooltip,
  Legend as Silian_Legend,
  PieChart as Silian_PieChart,
  Pie as Silian_Pie,
  Cell as Silian_Cell,
} from 'recharts';

const Silian_MESSAGE_COLORS = ['#22c55e', '#38bdf8'];

export default function AdminPage() {
  const { t: Silian_t } = Silian_useTranslation(['admin', 'common', 'dashboard', 'errors', 'messages', 'pagination', 'units']);
  const [Silian_activeTab, Silian_setActiveTab] = Silian_useState('dashboard');
  const [Silian_autoRefresh, Silian_setAutoRefresh] = Silian_useState(true);
  const [Silian_lastUpdated, Silian_setLastUpdated] = Silian_useState(null);
  const Silian_refreshIntervalMs = 30_000;

  // 加载管理员统计数据
  const { data: Silian_statsData, isLoading: Silian_statsLoading, isError: Silian_statsError, error: Silian_error, refetch: Silian_refetch, isFetching: Silian_isFetching } = Silian_useQuery(
    ['adminStats'],
    () => Silian_adminAPI.getStats().then(Silian_res => Silian_res.data?.data || {}),
    {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      refetchInterval: Silian_autoRefresh ? Silian_refreshIntervalMs : false,
      onSuccess: () => Silian_setLastUpdated(new Date()),
    }
  );

  // 加载审计日志
  const [Silian_auditPage, Silian_setAuditPage] = Silian_useState(1);
  const [Silian_auditLimit] = Silian_useState(50);
  const [Silian_auditFilters] = Silian_useState({});

  const { data: Silian_auditData, isLoading: Silian_auditLoading, isError: Silian_auditError, refetch: Silian_refetchAudit } = Silian_useQuery(
    ['adminLogs', Silian_auditPage, Silian_auditLimit, Silian_auditFilters],
    () => Silian_adminAPI.getLogs({ page: Silian_auditPage, limit: Silian_auditLimit, ...Silian_auditFilters }).then(Silian_res => Silian_res.data),
    {
      staleTime: 5_000,
      keepPreviousData: true,
    }
  );

  const Silian_number = Silian_useMemo(() => new Intl.NumberFormat(), []);
  const Silian_decimal = Silian_useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }), []);
  const Silian_percent = Silian_useMemo(() => new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }), []);

  const Silian_messageSummary = Silian_useMemo(() => {
    const Silian_summary = Silian_statsData?.messages ?? {};
    const Silian_totalRaw = Number(Silian_summary.total_messages ?? 0);
    const Silian_unreadRaw = Number(Silian_summary.unread_messages ?? 0);
    const Silian_readRaw = Number(Silian_summary.read_messages ?? (Silian_totalRaw - Silian_unreadRaw));

    const Silian_total = Number.isFinite(Silian_totalRaw) ? Math.max(0, Silian_totalRaw) : 0;
    const Silian_unread = Number.isFinite(Silian_unreadRaw) ? Math.max(0, Silian_unreadRaw) : 0;
    let Silian_read = Number.isFinite(Silian_readRaw) ? Math.max(0, Silian_readRaw) : Math.max(0, Silian_total - Silian_unread);
    if (Silian_read === 0 && Silian_total >= Silian_unread) {
      Silian_read = Math.max(0, Silian_total - Silian_unread);
    }
    const Silian_ratioRaw = Number(Silian_summary.unread_ratio ?? (Silian_total > 0 ? Silian_unread / Silian_total : 0));
    const Silian_unreadRatio = Number.isFinite(Silian_ratioRaw) ? Math.max(0, Silian_ratioRaw) : 0;

    return {
      total: Silian_total,
      unread: Silian_unread,
      read: Silian_read,
      unreadRatio: Silian_unreadRatio,
    };
  }, [Silian_statsData]);

  const Silian_messageChartData = Silian_useMemo(
    () => [
      { name: Silian_t('admin.dashboard.messages.readShort'), value: Silian_messageSummary.read },
      { name: Silian_t('admin.dashboard.messages.unreadShort'), value: Silian_messageSummary.unread },
    ],
    [Silian_messageSummary.read, Silian_messageSummary.unread, Silian_t]
  );

  const Silian_unreadPercent = Silian_messageSummary.total > 0 ? Silian_messageSummary.unread / Silian_messageSummary.total : 0;
  const Silian_unreadRate = Math.min(Math.max(Silian_unreadPercent, 0), 1);
  const Silian_hasMessageData = Silian_messageSummary.total > 0 || Silian_messageSummary.unread > 0;

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold tracking-tight mb-8">{Silian_t('admin.title')}</h1>

      <Silian_Tabs value={Silian_activeTab} onValueChange={Silian_setActiveTab} className="w-full">
        <Silian_TabsList className="grid w-full grid-cols-7">
          <Silian_TabsTrigger value="dashboard">{Silian_t('admin.tabs.dashboard')}</Silian_TabsTrigger>
          <Silian_TabsTrigger value="users">{Silian_t('admin.tabs.users')}</Silian_TabsTrigger>
          <Silian_TabsTrigger value="activities">{Silian_t('admin.tabs.activities')}</Silian_TabsTrigger>
          <Silian_TabsTrigger value="products">{Silian_t('admin.tabs.products')}</Silian_TabsTrigger>
          <Silian_TabsTrigger value="exchanges">{Silian_t('admin.tabs.exchanges')}</Silian_TabsTrigger>
          <Silian_TabsTrigger value="broadcast">{Silian_t('admin.tabs.broadcast')}</Silian_TabsTrigger>
          <Silian_TabsTrigger value="audit">{Silian_t('admin.tabs.audit')}</Silian_TabsTrigger>
          {/* Add more admin tabs here */}
        </Silian_TabsList>
        <Silian_TabsContent value="dashboard" className="mt-6">
          <Silian_Card>
            <Silian_CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <Silian_CardTitle className="flex items-center gap-2">
                  <Silian_LineChartIcon className="h-5 w-5" />
                  {Silian_t('admin.dashboard.title')}
                </Silian_CardTitle>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-green-600"
                      checked={Silian_autoRefresh}
                      onChange={(Silian_e) => Silian_setAutoRefresh(Silian_e.target.checked)}
                    />
                    {Silian_t('admin.dashboard.autoRefresh')}
                  </label>
                  <Silian_Button size="sm" variant="outline" onClick={() => Silian_refetch()} disabled={Silian_isFetching}>
                    <Silian_RefreshCw className={`h-4 w-4 mr-2 ${Silian_isFetching ? 'animate-spin' : ''}`} />
                    {Silian_t('admin.dashboard.refreshNow')}
                  </Silian_Button>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Silian_Clock className="h-4 w-4" />
                    <span>
                      {Silian_t('admin.dashboard.lastUpdated')}: {Silian_lastUpdated ? new Date(Silian_lastUpdated).toLocaleTimeString() : '--'}
                    </span>
                  </div>
                </div>
              </div>
            </Silian_CardHeader>
            <Silian_CardContent>
              <p>{Silian_t('admin.dashboard.description')}</p>
              {/* Admin dashboard content goes here */}
              {Silian_statsLoading && (
                <div className="flex items-center justify-center py-8">
                  <Silian_Loader2 className="h-6 w-6 animate-spin text-green-500" />
                  <span className="ml-2 text-muted-foreground">{Silian_t('common.loading')}</span>
                </div>
              )}
              {Silian_statsError && (
                <Silian_Alert variant="destructive" className="mt-4">
                  <Silian_AlertCircle className="h-4 w-4" />
                  <Silian_AlertTitle>{Silian_t('common.error')}</Silian_AlertTitle>
                  <Silian_AlertDescription>{Silian_error?.message || Silian_t('errors.loadFailed')}</Silian_AlertDescription>
                </Silian_Alert>
              )}
              {!Silian_statsLoading && !Silian_statsError && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
                    <Silian_Card className="p-4 cursor-pointer hover:bg-accent/30 transition" onClick={() => Silian_setActiveTab('users')}>
                      <h3 className="font-semibold">{Silian_t('admin.dashboard.totalUsers')}</h3>
                      <p className="text-2xl font-bold">{Silian_number.format(Silian_statsData?.users?.total_users ?? 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{Silian_t('admin.dashboard.activeUsers')}: {Silian_number.format(Silian_statsData?.users?.active_users ?? 0)}</p>
                    </Silian_Card>
                    <Silian_Card className="p-4">
                      <h3 className="font-semibold">{Silian_t('admin.dashboard.newUsers30d')}</h3>
                      <p className="text-2xl font-bold">{Silian_number.format(Silian_statsData?.users?.new_users_30d ?? 0)}</p>
                    </Silian_Card>
                    <Silian_Card className="p-4 cursor-pointer hover:bg-accent/30 transition" onClick={() => Silian_setActiveTab('activities')}>
                      <h3 className="font-semibold">{Silian_t('admin.dashboard.pendingActivities')}</h3>
                      <p className="text-2xl font-bold">{Silian_number.format(Silian_statsData?.activities?.pending_records ?? 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{Silian_t('admin.dashboard.approvedActivities')}: {Silian_number.format(Silian_statsData?.activities?.approved_records ?? 0)}</p>
                    </Silian_Card>
                    <Silian_Card className="p-4 cursor-pointer hover:bg-accent/30 transition" onClick={() => Silian_setActiveTab('exchanges')}>
                      <h3 className="font-semibold">{Silian_t('admin.dashboard.pendingExchanges')}</h3>
                      <p className="text-2xl font-bold">{Silian_number.format(Silian_statsData?.exchanges?.pending_exchanges ?? 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{Silian_t('admin.dashboard.completedExchanges')}: {Silian_number.format(Silian_statsData?.exchanges?.completed_exchanges ?? 0)}</p>
                    </Silian_Card>
                    <Silian_Card className="p-4">
                      <h3 className="font-semibold">{Silian_t('admin.dashboard.totalTransactions')}</h3>
                      <p className="text-2xl font-bold">{Silian_number.format(Silian_statsData?.transactions?.total_transactions ?? 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{Silian_t('admin.dashboard.rejectedTransactions')}: {Silian_number.format(Silian_statsData?.transactions?.rejected_transactions ?? 0)}</p>
                    </Silian_Card>
                    <Silian_Card className="p-4">
                      <h3 className="font-semibold">{Silian_t('admin.dashboard.totalCarbonSaved')}</h3>
                      <p className="text-2xl font-bold">{Silian_decimal.format(Silian_statsData?.transactions?.total_carbon_saved ?? 0)} {Silian_t('units.kg')}</p>
                      <p className="text-xs text-muted-foreground mt-1">{Silian_t('admin.dashboard.totalPointsAwarded')}: {Silian_number.format(Silian_statsData?.transactions?.total_points_awarded ?? 0)}</p>
                    </Silian_Card>
                    <Silian_Card className="p-4">
                      <h3 className="font-semibold">{Silian_t('admin.dashboard.totalExchanges')}</h3>
                      <p className="text-2xl font-bold">{Silian_number.format(Silian_statsData?.exchanges?.total_exchanges ?? 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{Silian_t('admin.dashboard.totalPointsSpent')}: {Silian_number.format(Silian_statsData?.exchanges?.total_points_spent ?? 0)}</p>
                    </Silian_Card>
                    <Silian_Card className="p-4 cursor-pointer hover:bg-accent/30 transition" onClick={() => Silian_setActiveTab('broadcast')}>
                      <h3 className="font-semibold">{Silian_t('admin.dashboard.totalMessages')}</h3>
                      <p className="text-2xl font-bold">{Silian_number.format(Silian_statsData?.messages?.total_messages ?? 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{Silian_t('admin.dashboard.unreadMessages')}: {Silian_number.format(Silian_statsData?.messages?.unread_messages ?? 0)}</p>
                    </Silian_Card>
                    <Silian_Card className="p-4">
                      <h3 className="font-semibold">{Silian_t('admin.dashboard.totalActivities')}</h3>
                      <p className="text-2xl font-bold">{Silian_number.format(Silian_statsData?.activities?.total_records ?? 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{Silian_t('admin.dashboard.approvedActivities')}: {Silian_number.format(Silian_statsData?.activities?.approved_records ?? 0)} · {Silian_t('admin.dashboard.pendingActivities')}: {Silian_number.format(Silian_statsData?.activities?.pending_records ?? 0)}</p>
                    </Silian_Card>
                  </div>

                  <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">
                            {Silian_t('admin.dashboard.messages.title')}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {Silian_t('admin.dashboard.messages.subtitle')}
                          </p>
                        </div>
                        <div className="rounded-full bg-sky-500/12 px-4 py-2 text-sm font-semibold text-sky-600 dark:text-sky-300">
                          {Silian_t('admin.dashboard.messages.unreadBadge')} {Silian_number.format(Silian_messageSummary.unread)}
                        </div>
                      </div>
                      <div className="mt-6 h-64">
                        {Silian_hasMessageData ? (
                          <Silian_ResponsiveContainer>
                            <Silian_PieChart>
                              <Silian_Pie data={Silian_messageChartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={4} stroke="#fff">
                                {Silian_messageChartData.map((Silian_entry, Silian_index) => (
                                  <Silian_Cell key={`admin-message-segment-${Silian_entry.name}`} fill={Silian_MESSAGE_COLORS[Silian_index % Silian_MESSAGE_COLORS.length]} />
                                ))}
                              </Silian_Pie>
                              <Silian_Tooltip
                                formatter={(Silian_value, Silian_name) => [Silian_number.format(Silian_value), Silian_name]}
                                contentStyle={{
                                  borderRadius: '0.75rem',
                                  border: '1px solid hsl(var(--border))',
                                  backgroundColor: 'hsl(var(--card))',
                                  color: 'hsl(var(--card-foreground))',
                                  boxShadow: '0 10px 25px -15px rgb(0 0 0 / 0.35)',
                                }}
                              />
                            </Silian_PieChart>
                          </Silian_ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            {Silian_t('admin.dashboard.messages.empty')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
                      <h3 className="text-lg font-semibold text-foreground">
                        {Silian_t('admin.dashboard.messages.detailsTitle')}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {Silian_t('admin.dashboard.messages.detailsSubtitle')}
                      </p>

                      <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>{Silian_t('admin.dashboard.messages.totalLabel')}</span>
                          <span className="font-semibold text-foreground">{Silian_number.format(Silian_messageSummary.total)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{Silian_t('admin.dashboard.messages.readLabel')}</span>
                          <span className="font-semibold text-emerald-600">{Silian_number.format(Silian_messageSummary.read)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{Silian_t('admin.dashboard.messages.unreadLabel')}</span>
                          <span className="font-semibold text-sky-600">{Silian_number.format(Silian_messageSummary.unread)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{Silian_t('admin.dashboard.messages.unreadRatioLabel')}</span>
                          <span className="font-semibold text-orange-500">{Silian_percent.format(Silian_unreadRate)}</span>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap items-center gap-3">
                        <div className="flex-1 rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground">
                          {Silian_t('admin.dashboard.messages.tip')}
                        </div>
                        <Silian_Button variant="outline" size="sm" onClick={() => Silian_setActiveTab('broadcast')}>
                          {Silian_t('admin.dashboard.messages.viewBroadcast')}
                        </Silian_Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-2">{Silian_t('admin.dashboard.trendsTitle')}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{Silian_t('admin.dashboard.trendsSubtitle')}</p>
                    <div className="h-72">
                      <Silian_ResponsiveContainer>
                        <Silian_ComposedChart data={Silian_statsData?.trends || []} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <Silian_CartesianGrid strokeDasharray="3 3" />
                          <Silian_XAxis dataKey="date" />
                          <Silian_YAxis yAxisId="left" allowDecimals={false} />
                          <Silian_YAxis yAxisId="right" orientation="right" />
                          <Silian_Tooltip />
                          <Silian_Legend />
                          <Silian_Bar yAxisId="left" dataKey="transactions" name={Silian_t('admin.dashboard.trendsTransactions')} fill="hsl(var(--chart-2))" />
                          <Silian_Line yAxisId="right" type="monotone" dataKey="carbon_saved" name={Silian_t('admin.dashboard.trendsCarbonSaved')} stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                        </Silian_ComposedChart>
                      </Silian_ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </Silian_CardContent>
          </Silian_Card>
        </Silian_TabsContent>
        <Silian_TabsContent value="users" className="mt-6">
          <Silian_UserManagement />
        </Silian_TabsContent>
        <Silian_TabsContent value="activities" className="mt-6">
          <Silian_ActivityReview />
        </Silian_TabsContent>
        <Silian_TabsContent value="products" className="mt-6">
          <Silian_ProductManagement />
        </Silian_TabsContent>
        <Silian_TabsContent value="exchanges" className="mt-6">
          <Silian_ExchangeManagement />
        </Silian_TabsContent>
        <Silian_TabsContent value="broadcast" className="mt-6">
          <Silian_BroadcastCenter />
        </Silian_TabsContent>
        <Silian_TabsContent value="audit" className="mt-6">
          <Silian_Card>
            <Silian_CardHeader>
              <Silian_CardTitle>{Silian_t('admin.audit.title')}</Silian_CardTitle>
            </Silian_CardHeader>
            <Silian_CardContent>
              {Silian_auditLoading && (
                <div className="flex items-center justify-center py-8">
                  <Silian_Loader2 className="h-8 w-8 animate-spin mr-2" />
                  <span>{Silian_t('common.loading')}</span>
                </div>
              )}
              {Silian_auditError && (
                <Silian_Alert variant="destructive">
                  <Silian_AlertCircle className="h-4 w-4" />
                  <Silian_AlertTitle>{Silian_t('common.error')}</Silian_AlertTitle>
                  <Silian_AlertDescription>{Silian_auditError.message}</Silian_AlertDescription>
                </Silian_Alert>
              )}
              {!Silian_auditLoading && !Silian_auditError && Silian_auditData && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-muted-foreground">
                      {Silian_t('admin.audit.totalLogs')}: {Silian_auditData.pagination.total_items}
                    </span>
                    <Silian_Button variant="outline" size="sm" onClick={() => Silian_refetchAudit()}>
                      <Silian_RefreshCw className="h-4 w-4 mr-2" />
                      {Silian_t('common.refresh')}
                    </Silian_Button>
                  </div>
                  <div className="rounded-md border">
                    <table className="w-full">
                      <thead>
                        <tr className="border-b bg-muted/50">
                          <th className="h-12 px-4 text-left align-middle font-medium text-sm">ID</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-sm">Actor</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-sm">Action</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-sm">Status</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-sm">Time</th>
                          <th className="h-12 px-4 text-left align-middle font-medium text-sm">Details</th>
                        </tr>
                      </thead>
                      <tbody>
                        {Silian_auditData.logs.map((Silian_log) => (
                          <tr key={Silian_log.id} className="border-b hover:bg-accent">
                            <td className="p-4 font-mono text-sm">{Silian_log.id}</td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                Silian_log.actor_type === 'admin' ? 'bg-red-500/12 text-red-700 dark:text-red-300' :
                                Silian_log.actor_type === 'user' ? 'bg-blue-500/12 text-blue-700 dark:text-blue-300' :
                                'bg-muted text-foreground'
                              }`}>
                                {Silian_log.actor_type}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="text-sm font-medium">{Silian_log.action}</span>
                              {Silian_log.operation_category && (
                                <span className="ml-2 px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground">
                                  {Silian_log.operation_category}
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                Silian_log.status === 'success' ? 'bg-green-500/12 text-green-700 dark:text-green-300' :
                                Silian_log.status === 'failed' ? 'bg-red-500/12 text-red-700 dark:text-red-300' :
                                'bg-amber-500/12 text-amber-700 dark:text-amber-300'
                              }`}>
                                {Silian_log.status}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="text-sm text-muted-foreground">
                                {new Date(Silian_log.created_at).toLocaleString()}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="space-y-2">
                                {Silian_log.data && (
                                  <AuditJsonField json={Silian_log.data} title="Request Data" />
                                )}
                                {Silian_log.old_data && (
                                  <AuditJsonField json={Silian_log.old_data} title="Old Data" />
                                )}
                                {Silian_log.new_data && (
                                  <AuditJsonField json={Silian_log.new_data} title="New Data" />
                                )}
                                {Silian_log.affected_table && (
                                  <div className="text-sm text-muted-foreground">
                                    <span className="font-medium">Affected:</span> {Silian_log.affected_table}
                                    {Silian_log.affected_id && ` #${Silian_log.affected_id}`}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {Silian_auditData.pagination.total_pages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Showing {((Silian_auditData.pagination.current_page - 1) * Silian_auditData.pagination.per_page) + 1}-
                        {Math.min(Silian_auditData.pagination.current_page * Silian_auditData.pagination.per_page, Silian_auditData.pagination.total_items)} of {Silian_auditData.pagination.total_items}
                      </div>
                      <div className="flex items-center gap-2">
                        <Silian_Button
                          variant="outline"
                          size="sm"
                          onClick={() => Silian_setAuditPage(Math.max(1, Silian_auditPage - 1))}
                          disabled={Silian_auditPage === 1}
                        >
                          Previous
                        </Silian_Button>
                        <span className="text-sm">
                          Page {Silian_auditPage} of {Silian_auditData.pagination.total_pages}
                        </span>
                        <Silian_Button
                          variant="outline"
                          size="sm"
                          onClick={() => Silian_setAuditPage(Math.min(Silian_auditData.pagination.total_pages, Silian_auditPage + 1))}
                          disabled={Silian_auditPage === Silian_auditData.pagination.total_pages}
                        >
                          Next
                        </Silian_Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </Silian_CardContent>
          </Silian_Card>
        </Silian_TabsContent>
        <Silian_TabsContent value="audit" className="mt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Audit Logs</h2>
            </div>
            <Silian_Card>
              <Silian_CardContent className="p-6">
                <div className="flex items-center justify-center py-8">
                  <Silian_Loader2 className="h-8 w-8 animate-spin mr-2" />
                  <span>Loading audit logs...</span>
                </div>
              </Silian_CardContent>
            </Silian_Card>
          </div>
        </Silian_TabsContent>
        <Silian_TabsContent value="audit" className="mt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">{Silian_t('admin.tabs.audit')}</h2>
              <div className="flex items-center gap-2">
                <Silian_Button variant="outline" size="sm" onClick={() => Silian_refetchAudit()}>
                  <Silian_RefreshCw className="h-4 w-4 mr-2" />
                  {Silian_t('common.refresh')}
                </Silian_Button>
              </div>
            </div>

            {Silian_auditLoading && (
              <div className="flex items-center justify-center py-8">
                <Silian_Loader2 className="h-8 w-8 animate-spin mr-2" />
                <span>{Silian_t('common.loading')}</span>
              </div>
            )}

            {Silian_auditError && (
              <Silian_Alert variant="destructive">
                <Silian_AlertCircle className="h-4 w-4" />
                <Silian_AlertTitle>{Silian_t('common.error')}</Silian_AlertTitle>
                <Silian_AlertDescription>{Silian_auditError.message}</Silian_AlertDescription>
              </Silian_Alert>
            )}

            {!Silian_auditLoading && !Silian_auditError && Silian_auditData && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-sm text-muted-foreground">
                    {Silian_t('admin.audit.totalLogs')}: {Silian_auditData.pagination.total_items} |
                    {Silian_t('admin.audit.page')}: {Silian_auditData.pagination.current_page} / {Silian_auditData.pagination.total_pages}
                  </span>
                </div>

                <div className="rounded-md border overflow-hidden">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b bg-muted/50">
                        <th className="h-12 px-4 text-left align-middle font-medium text-sm [&:has([role=checkbox])]:pr-0">
                          ID
                        </th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-sm">Actor</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-sm">Action</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-sm">Status</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-sm">IP</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-sm">Time</th>
                        <th className="h-12 px-4 text-left align-middle font-medium text-sm">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {Silian_auditData.logs.map((Silian_log) => (
                        <tr key={Silian_log.id} className="border-b hover:bg-accent data-[state=selected]:bg-muted">
                          <td className="p-4 font-medium">{Silian_log.id}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                Silian_log.actor_type === 'admin' ? 'bg-red-500/12 text-red-700 dark:text-red-300' :
                                Silian_log.actor_type === 'user' ? 'bg-blue-500/12 text-blue-700 dark:text-blue-300' :
                                'bg-muted text-foreground'
                              }`}>
                                {Silian_log.actor_type}
                              </span>
                              {Silian_log.user_id && (
                                <span className="text-sm text-muted-foreground">{Silian_log.username || Silian_log.user_id}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{Silian_log.action}</span>
                              {Silian_log.operation_category && (
                                <span className="px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground">
                                  {Silian_log.operation_category}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              Silian_log.status === 'success' ? 'bg-green-500/12 text-green-700 dark:text-green-300' :
                              Silian_log.status === 'failed' ? 'bg-red-500/12 text-red-700 dark:text-red-300' :
                              'bg-amber-500/12 text-amber-700 dark:text-amber-300'
                            }`}>
                              {Silian_log.status}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm font-mono">{Silian_log.ip_address || 'N/A'}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-muted-foreground">
                              {new Date(Silian_log.created_at).toLocaleString()}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="space-y-2">
                              {Silian_log.data && (
                                <JsonDetails json={Silian_log.data} title={Silian_t('admin.audit.requestData')} />
                              )}
                              {Silian_log.old_data && (
                                <JsonDetails json={Silian_log.old_data} title={Silian_t('admin.audit.oldData')} />
                              )}
                              {Silian_log.new_data && (
                                <JsonDetails json={Silian_log.new_data} title={Silian_t('admin.audit.newData')} />
                              )}
                              {Silian_log.affected_table && (
                                <div className="text-sm">
                                  <span className="font-medium">{Silian_t('admin.audit.affected')}:</span> {Silian_log.affected_table}
                                  {Silian_log.affected_id && ` #${Silian_log.affected_id}`}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {Silian_auditData.pagination.total_pages > 1 && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {Silian_t('admin.audit.showing')} {((Silian_auditData.pagination.current_page - 1) * Silian_auditData.pagination.per_page) + 1}-
                      {Math.min(Silian_auditData.pagination.current_page * Silian_auditData.pagination.per_page, Silian_auditData.pagination.total_items)} {Silian_t('admin.audit.of')} {Silian_auditData.pagination.total_items}
                    </div>
                    <div className="flex items-center gap-2">
                      <Silian_Button
                        variant="outline"
                        size="sm"
                        onClick={() => Silian_setAuditPage(Math.max(1, Silian_auditPage - 1))}
                        disabled={Silian_auditPage === 1}
                      >
                        {Silian_t('common.previous')}
                      </Silian_Button>
                      <span className="text-sm">
                        {Silian_t('admin.audit.page')} {Silian_auditPage} {Silian_t('admin.audit.of')} {Silian_auditData.pagination.total_pages}
                      </span>
                      <Silian_Button
                        variant="outline"
                        size="sm"
                        onClick={() => Silian_setAuditPage(Math.min(Silian_auditData.pagination.total_pages, Silian_auditPage + 1))}
                        disabled={Silian_auditPage === Silian_auditData.pagination.total_pages}
                      >
                        {Silian_t('common.next')}
                      </Silian_Button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </Silian_TabsContent>
        {/* Add more admin tab contents here */}
      </Silian_Tabs>
    </div>
  );
}
