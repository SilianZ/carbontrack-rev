import React, { useMemo, useState } from 'react';
import { useTranslation } from '../hooks/useTranslation';
import { UserManagement } from '../components/admin/UserManagement';
import { ActivityReview } from '../components/admin/ActivityReview';
import { ProductManagement } from '../components/admin/ProductManagement';
import { ExchangeManagement } from '../components/admin/ExchangeManagement';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { BroadcastCenter } from '../components/admin/BroadcastCenter';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../components/ui/Tabs';
import { useQuery } from 'react-query';
import { adminAPI } from '../lib/api';
import { Loader2, AlertCircle, RefreshCw, LineChart as LineChartIcon, Clock } from 'lucide-react';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';

const MESSAGE_COLORS = ['#22c55e', '#38bdf8'];

export default function AdminPage() {
  const { t } = useTranslation(['admin', 'common', 'dashboard', 'errors', 'messages', 'pagination', 'units']);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastUpdated, setLastUpdated] = useState(null);
  const refreshIntervalMs = 30_000;

  // 加载管理员统计数据
  const { data: statsData, isLoading: statsLoading, isError: statsError, error, refetch, isFetching } = useQuery(
    ['adminStats'],
    () => adminAPI.getStats().then(res => res.data?.data || {}),
    {
      staleTime: 15_000,
      refetchOnWindowFocus: false,
      refetchInterval: autoRefresh ? refreshIntervalMs : false,
      onSuccess: () => setLastUpdated(new Date()),
    }
  );

  // 加载审计日志
  const [auditPage, setAuditPage] = useState(1);
  const [auditLimit] = useState(50);
  const [auditFilters] = useState({});

  const { data: auditData, isLoading: auditLoading, isError: auditError, refetch: refetchAudit } = useQuery(
    ['adminLogs', auditPage, auditLimit, auditFilters],
    () => adminAPI.getLogs({ page: auditPage, limit: auditLimit, ...auditFilters }).then(res => res.data),
    {
      staleTime: 5_000,
      keepPreviousData: true,
    }
  );

  const number = useMemo(() => new Intl.NumberFormat(), []);
  const decimal = useMemo(() => new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 }), []);
  const percent = useMemo(() => new Intl.NumberFormat(undefined, { style: 'percent', maximumFractionDigits: 1 }), []);

  const messageSummary = useMemo(() => {
    const summary = statsData?.messages ?? {};
    const totalRaw = Number(summary.total_messages ?? 0);
    const unreadRaw = Number(summary.unread_messages ?? 0);
    const readRaw = Number(summary.read_messages ?? (totalRaw - unreadRaw));

    const total = Number.isFinite(totalRaw) ? Math.max(0, totalRaw) : 0;
    const unread = Number.isFinite(unreadRaw) ? Math.max(0, unreadRaw) : 0;
    let read = Number.isFinite(readRaw) ? Math.max(0, readRaw) : Math.max(0, total - unread);
    if (read === 0 && total >= unread) {
      read = Math.max(0, total - unread);
    }
    const ratioRaw = Number(summary.unread_ratio ?? (total > 0 ? unread / total : 0));
    const unreadRatio = Number.isFinite(ratioRaw) ? Math.max(0, ratioRaw) : 0;

    return {
      total,
      unread,
      read,
      unreadRatio,
    };
  }, [statsData]);

  const messageChartData = useMemo(
    () => [
      { name: t('admin.dashboard.messages.readShort'), value: messageSummary.read },
      { name: t('admin.dashboard.messages.unreadShort'), value: messageSummary.unread },
    ],
    [messageSummary.read, messageSummary.unread, t]
  );

  const unreadPercent = messageSummary.total > 0 ? messageSummary.unread / messageSummary.total : 0;
  const unreadRate = Math.min(Math.max(unreadPercent, 0), 1);
  const hasMessageData = messageSummary.total > 0 || messageSummary.unread > 0;

  return (
    <div className="container mx-auto py-8 px-4">
      <h1 className="text-3xl font-bold tracking-tight mb-8">{t('admin.title')}</h1>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-7">
          <TabsTrigger value="dashboard">{t('admin.tabs.dashboard')}</TabsTrigger>
          <TabsTrigger value="users">{t('admin.tabs.users')}</TabsTrigger>
          <TabsTrigger value="activities">{t('admin.tabs.activities')}</TabsTrigger>
          <TabsTrigger value="products">{t('admin.tabs.products')}</TabsTrigger>
          <TabsTrigger value="exchanges">{t('admin.tabs.exchanges')}</TabsTrigger>
          <TabsTrigger value="broadcast">{t('admin.tabs.broadcast')}</TabsTrigger>
          <TabsTrigger value="audit">{t('admin.tabs.audit')}</TabsTrigger>
          {/* Add more admin tabs here */}
        </TabsList>
        <TabsContent value="dashboard" className="mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <CardTitle className="flex items-center gap-2">
                  <LineChartIcon className="h-5 w-5" />
                  {t('admin.dashboard.title')}
                </CardTitle>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      className="accent-green-600"
                      checked={autoRefresh}
                      onChange={(e) => setAutoRefresh(e.target.checked)}
                    />
                    {t('admin.dashboard.autoRefresh')}
                  </label>
                  <Button size="sm" variant="outline" onClick={() => refetch()} disabled={isFetching}>
                    <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
                    {t('admin.dashboard.refreshNow')}
                  </Button>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>
                      {t('admin.dashboard.lastUpdated')}: {lastUpdated ? new Date(lastUpdated).toLocaleTimeString() : '--'}
                    </span>
                  </div>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p>{t('admin.dashboard.description')}</p>
              {/* Admin dashboard content goes here */}
              {statsLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-green-500" />
                  <span className="ml-2 text-muted-foreground">{t('common.loading')}</span>
                </div>
              )}
              {statsError && (
                <Alert variant="destructive" className="mt-4">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t('common.error')}</AlertTitle>
                  <AlertDescription>{error?.message || t('errors.loadFailed')}</AlertDescription>
                </Alert>
              )}
              {!statsLoading && !statsError && (
                <>
                  <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
                    <Card className="p-4 cursor-pointer hover:bg-accent/30 transition" onClick={() => setActiveTab('users')}>
                      <h3 className="font-semibold">{t('admin.dashboard.totalUsers')}</h3>
                      <p className="text-2xl font-bold">{number.format(statsData?.users?.total_users ?? 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('admin.dashboard.activeUsers')}: {number.format(statsData?.users?.active_users ?? 0)}</p>
                    </Card>
                    <Card className="p-4">
                      <h3 className="font-semibold">{t('admin.dashboard.newUsers30d')}</h3>
                      <p className="text-2xl font-bold">{number.format(statsData?.users?.new_users_30d ?? 0)}</p>
                    </Card>
                    <Card className="p-4 cursor-pointer hover:bg-accent/30 transition" onClick={() => setActiveTab('activities')}>
                      <h3 className="font-semibold">{t('admin.dashboard.pendingActivities')}</h3>
                      <p className="text-2xl font-bold">{number.format(statsData?.activities?.pending_records ?? 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('admin.dashboard.approvedActivities')}: {number.format(statsData?.activities?.approved_records ?? 0)}</p>
                    </Card>
                    <Card className="p-4 cursor-pointer hover:bg-accent/30 transition" onClick={() => setActiveTab('exchanges')}>
                      <h3 className="font-semibold">{t('admin.dashboard.pendingExchanges')}</h3>
                      <p className="text-2xl font-bold">{number.format(statsData?.exchanges?.pending_exchanges ?? 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('admin.dashboard.completedExchanges')}: {number.format(statsData?.exchanges?.completed_exchanges ?? 0)}</p>
                    </Card>
                    <Card className="p-4">
                      <h3 className="font-semibold">{t('admin.dashboard.totalTransactions')}</h3>
                      <p className="text-2xl font-bold">{number.format(statsData?.transactions?.total_transactions ?? 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('admin.dashboard.rejectedTransactions')}: {number.format(statsData?.transactions?.rejected_transactions ?? 0)}</p>
                    </Card>
                    <Card className="p-4">
                      <h3 className="font-semibold">{t('admin.dashboard.totalCarbonSaved')}</h3>
                      <p className="text-2xl font-bold">{decimal.format(statsData?.transactions?.total_carbon_saved ?? 0)} {t('units.kg')}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('admin.dashboard.totalPointsAwarded')}: {number.format(statsData?.transactions?.total_points_awarded ?? 0)}</p>
                    </Card>
                    <Card className="p-4">
                      <h3 className="font-semibold">{t('admin.dashboard.totalExchanges')}</h3>
                      <p className="text-2xl font-bold">{number.format(statsData?.exchanges?.total_exchanges ?? 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('admin.dashboard.totalPointsSpent')}: {number.format(statsData?.exchanges?.total_points_spent ?? 0)}</p>
                    </Card>
                    <Card className="p-4 cursor-pointer hover:bg-accent/30 transition" onClick={() => setActiveTab('broadcast')}>
                      <h3 className="font-semibold">{t('admin.dashboard.totalMessages')}</h3>
                      <p className="text-2xl font-bold">{number.format(statsData?.messages?.total_messages ?? 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('admin.dashboard.unreadMessages')}: {number.format(statsData?.messages?.unread_messages ?? 0)}</p>
                    </Card>
                    <Card className="p-4">
                      <h3 className="font-semibold">{t('admin.dashboard.totalActivities')}</h3>
                      <p className="text-2xl font-bold">{number.format(statsData?.activities?.total_records ?? 0)}</p>
                      <p className="text-xs text-muted-foreground mt-1">{t('admin.dashboard.approvedActivities')}: {number.format(statsData?.activities?.approved_records ?? 0)} · {t('admin.dashboard.pendingActivities')}: {number.format(statsData?.activities?.pending_records ?? 0)}</p>
                    </Card>
                  </div>

                  <div className="mt-6 grid gap-6 lg:grid-cols-2">
                    <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
                      <div className="flex items-center justify-between gap-3 flex-wrap">
                        <div>
                          <h3 className="text-lg font-semibold text-foreground">
                            {t('admin.dashboard.messages.title')}
                          </h3>
                          <p className="text-sm text-muted-foreground">
                            {t('admin.dashboard.messages.subtitle')}
                          </p>
                        </div>
                        <div className="rounded-full bg-sky-500/12 px-4 py-2 text-sm font-semibold text-sky-600 dark:text-sky-300">
                          {t('admin.dashboard.messages.unreadBadge')} {number.format(messageSummary.unread)}
                        </div>
                      </div>
                      <div className="mt-6 h-64">
                        {hasMessageData ? (
                          <ResponsiveContainer>
                            <PieChart>
                              <Pie data={messageChartData} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={4} stroke="#fff">
                                {messageChartData.map((entry, index) => (
                                  <Cell key={`admin-message-segment-${entry.name}`} fill={MESSAGE_COLORS[index % MESSAGE_COLORS.length]} />
                                ))}
                              </Pie>
                              <Tooltip
                                formatter={(value, name) => [number.format(value), name]}
                                contentStyle={{
                                  borderRadius: '0.75rem',
                                  border: '1px solid hsl(var(--border))',
                                  backgroundColor: 'hsl(var(--card))',
                                  color: 'hsl(var(--card-foreground))',
                                  boxShadow: '0 10px 25px -15px rgb(0 0 0 / 0.35)',
                                }}
                              />
                            </PieChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
                            {t('admin.dashboard.messages.empty')}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-sm">
                      <h3 className="text-lg font-semibold text-foreground">
                        {t('admin.dashboard.messages.detailsTitle')}
                      </h3>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {t('admin.dashboard.messages.detailsSubtitle')}
                      </p>

                      <div className="mt-6 space-y-3 text-sm text-muted-foreground">
                        <div className="flex items-center justify-between">
                          <span>{t('admin.dashboard.messages.totalLabel')}</span>
                          <span className="font-semibold text-foreground">{number.format(messageSummary.total)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{t('admin.dashboard.messages.readLabel')}</span>
                          <span className="font-semibold text-emerald-600">{number.format(messageSummary.read)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{t('admin.dashboard.messages.unreadLabel')}</span>
                          <span className="font-semibold text-sky-600">{number.format(messageSummary.unread)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span>{t('admin.dashboard.messages.unreadRatioLabel')}</span>
                          <span className="font-semibold text-orange-500">{percent.format(unreadRate)}</span>
                        </div>
                      </div>

                      <div className="mt-6 flex flex-wrap items-center gap-3">
                        <div className="flex-1 rounded-lg bg-muted/50 p-4 text-xs text-muted-foreground">
                          {t('admin.dashboard.messages.tip')}
                        </div>
                        <Button variant="outline" size="sm" onClick={() => setActiveTab('broadcast')}>
                          {t('admin.dashboard.messages.viewBroadcast')}
                        </Button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-6">
                    <h3 className="text-lg font-semibold mb-2">{t('admin.dashboard.trendsTitle')}</h3>
                    <p className="text-sm text-muted-foreground mb-4">{t('admin.dashboard.trendsSubtitle')}</p>
                    <div className="h-72">
                      <ResponsiveContainer>
                        <ComposedChart data={statsData?.trends || []} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="date" />
                          <YAxis yAxisId="left" allowDecimals={false} />
                          <YAxis yAxisId="right" orientation="right" />
                          <Tooltip />
                          <Legend />
                          <Bar yAxisId="left" dataKey="transactions" name={t('admin.dashboard.trendsTransactions')} fill="hsl(var(--chart-2))" />
                          <Line yAxisId="right" type="monotone" dataKey="carbon_saved" name={t('admin.dashboard.trendsCarbonSaved')} stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="users" className="mt-6">
          <UserManagement />
        </TabsContent>
        <TabsContent value="activities" className="mt-6">
          <ActivityReview />
        </TabsContent>
        <TabsContent value="products" className="mt-6">
          <ProductManagement />
        </TabsContent>
        <TabsContent value="exchanges" className="mt-6">
          <ExchangeManagement />
        </TabsContent>
        <TabsContent value="broadcast" className="mt-6">
          <BroadcastCenter />
        </TabsContent>
        <TabsContent value="audit" className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('admin.audit.title')}</CardTitle>
            </CardHeader>
            <CardContent>
              {auditLoading && (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mr-2" />
                  <span>{t('common.loading')}</span>
                </div>
              )}
              {auditError && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertTitle>{t('common.error')}</AlertTitle>
                  <AlertDescription>{auditError.message}</AlertDescription>
                </Alert>
              )}
              {!auditLoading && !auditError && auditData && (
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-sm text-muted-foreground">
                      {t('admin.audit.totalLogs')}: {auditData.pagination.total_items}
                    </span>
                    <Button variant="outline" size="sm" onClick={() => refetchAudit()}>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      {t('common.refresh')}
                    </Button>
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
                        {auditData.logs.map((log) => (
                          <tr key={log.id} className="border-b hover:bg-accent">
                            <td className="p-4 font-mono text-sm">{log.id}</td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                log.actor_type === 'admin' ? 'bg-red-500/12 text-red-700 dark:text-red-300' :
                                log.actor_type === 'user' ? 'bg-blue-500/12 text-blue-700 dark:text-blue-300' :
                                'bg-muted text-foreground'
                              }`}>
                                {log.actor_type}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="text-sm font-medium">{log.action}</span>
                              {log.operation_category && (
                                <span className="ml-2 px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground">
                                  {log.operation_category}
                                </span>
                              )}
                            </td>
                            <td className="p-4">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                log.status === 'success' ? 'bg-green-500/12 text-green-700 dark:text-green-300' :
                                log.status === 'failed' ? 'bg-red-500/12 text-red-700 dark:text-red-300' :
                                'bg-amber-500/12 text-amber-700 dark:text-amber-300'
                              }`}>
                                {log.status}
                              </span>
                            </td>
                            <td className="p-4">
                              <span className="text-sm text-muted-foreground">
                                {new Date(log.created_at).toLocaleString()}
                              </span>
                            </td>
                            <td className="p-4">
                              <div className="space-y-2">
                                {log.data && (
                                  <AuditJsonField json={log.data} title="Request Data" />
                                )}
                                {log.old_data && (
                                  <AuditJsonField json={log.old_data} title="Old Data" />
                                )}
                                {log.new_data && (
                                  <AuditJsonField json={log.new_data} title="New Data" />
                                )}
                                {log.affected_table && (
                                  <div className="text-sm text-muted-foreground">
                                    <span className="font-medium">Affected:</span> {log.affected_table}
                                    {log.affected_id && ` #${log.affected_id}`}
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {auditData.pagination.total_pages > 1 && (
                    <div className="flex items-center justify-between mt-4">
                      <div className="text-sm text-muted-foreground">
                        Showing {((auditData.pagination.current_page - 1) * auditData.pagination.per_page) + 1}-
                        {Math.min(auditData.pagination.current_page * auditData.pagination.per_page, auditData.pagination.total_items)} of {auditData.pagination.total_items}
                      </div>
                      <div className="flex items-center gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAuditPage(Math.max(1, auditPage - 1))}
                          disabled={auditPage === 1}
                        >
                          Previous
                        </Button>
                        <span className="text-sm">
                          Page {auditPage} of {auditData.pagination.total_pages}
                        </span>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setAuditPage(Math.min(auditData.pagination.total_pages, auditPage + 1))}
                          disabled={auditPage === auditData.pagination.total_pages}
                        >
                          Next
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
        <TabsContent value="audit" className="mt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">Audit Logs</h2>
            </div>
            <Card>
              <CardContent className="p-6">
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-8 w-8 animate-spin mr-2" />
                  <span>Loading audit logs...</span>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
        <TabsContent value="audit" className="mt-6">
          <div className="space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-2xl font-bold">{t('admin.tabs.audit')}</h2>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={() => refetchAudit()}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {t('common.refresh')}
                </Button>
              </div>
            </div>

            {auditLoading && (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin mr-2" />
                <span>{t('common.loading')}</span>
              </div>
            )}

            {auditError && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle>{t('common.error')}</AlertTitle>
                <AlertDescription>{auditError.message}</AlertDescription>
              </Alert>
            )}

            {!auditLoading && !auditError && auditData && (
              <div className="space-y-4">
                <div className="flex items-center gap-4 mb-4">
                  <span className="text-sm text-muted-foreground">
                    {t('admin.audit.totalLogs')}: {auditData.pagination.total_items} | 
                    {t('admin.audit.page')}: {auditData.pagination.current_page} / {auditData.pagination.total_pages}
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
                      {auditData.logs.map((log) => (
                        <tr key={log.id} className="border-b hover:bg-accent data-[state=selected]:bg-muted">
                          <td className="p-4 font-medium">{log.id}</td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                log.actor_type === 'admin' ? 'bg-red-500/12 text-red-700 dark:text-red-300' :
                                log.actor_type === 'user' ? 'bg-blue-500/12 text-blue-700 dark:text-blue-300' :
                                'bg-muted text-foreground'
                              }`}>
                                {log.actor_type}
                              </span>
                              {log.user_id && (
                                <span className="text-sm text-muted-foreground">{log.username || log.user_id}</span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <div className="flex items-center gap-2">
                              <span className="text-sm font-medium">{log.action}</span>
                              {log.operation_category && (
                                <span className="px-2 py-1 rounded-full text-xs bg-secondary text-secondary-foreground">
                                  {log.operation_category}
                                </span>
                              )}
                            </div>
                          </td>
                          <td className="p-4">
                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                              log.status === 'success' ? 'bg-green-500/12 text-green-700 dark:text-green-300' :
                              log.status === 'failed' ? 'bg-red-500/12 text-red-700 dark:text-red-300' :
                              'bg-amber-500/12 text-amber-700 dark:text-amber-300'
                            }`}>
                              {log.status}
                            </span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm font-mono">{log.ip_address || 'N/A'}</span>
                          </td>
                          <td className="p-4">
                            <span className="text-sm text-muted-foreground">
                              {new Date(log.created_at).toLocaleString()}
                            </span>
                          </td>
                          <td className="p-4">
                            <div className="space-y-2">
                              {log.data && (
                                <JsonDetails json={log.data} title={t('admin.audit.requestData')} />
                              )}
                              {log.old_data && (
                                <JsonDetails json={log.old_data} title={t('admin.audit.oldData')} />
                              )}
                              {log.new_data && (
                                <JsonDetails json={log.new_data} title={t('admin.audit.newData')} />
                              )}
                              {log.affected_table && (
                                <div className="text-sm">
                                  <span className="font-medium">{t('admin.audit.affected')}:</span> {log.affected_table}
                                  {log.affected_id && ` #${log.affected_id}`}
                                </div>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {auditData.pagination.total_pages > 1 && (
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {t('admin.audit.showing')} {((auditData.pagination.current_page - 1) * auditData.pagination.per_page) + 1}-
                      {Math.min(auditData.pagination.current_page * auditData.pagination.per_page, auditData.pagination.total_items)} {t('admin.audit.of')} {auditData.pagination.total_items}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAuditPage(Math.max(1, auditPage - 1))}
                        disabled={auditPage === 1}
                      >
                        {t('common.previous')}
                      </Button>
                      <span className="text-sm">
                        {t('admin.audit.page')} {auditPage} {t('admin.audit.of')} {auditData.pagination.total_pages}
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setAuditPage(Math.min(auditData.pagination.total_pages, auditPage + 1))}
                        disabled={auditPage === auditData.pagination.total_pages}
                      >
                        {t('common.next')}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

          </div>
        </TabsContent>
        {/* Add more admin tab contents here */}
      </Tabs>
    </div>
  );
}
