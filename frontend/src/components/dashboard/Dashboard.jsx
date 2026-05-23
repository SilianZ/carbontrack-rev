import Silian_React, { useState as Silian_useState, useEffect as Silian_useEffect, useRef as Silian_useRef, useCallback as Silian_useCallback, useMemo as Silian_useMemo } from 'react';
import { useNavigate as Silian_useNavigate } from 'react-router-dom';
import { format as Silian_format } from 'date-fns';
import { Leaf as Silian_Leaf, Award as Silian_Award, TrendingUp as Silian_TrendingUp, Users as Silian_Users, Flame as Silian_Flame } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { carbonAPI as Silian_carbonAPI, badgeAPI as Silian_badgeAPI } from '../../lib/api';
import { checkAuthStatus as Silian_checkAuthStatus } from '../../lib/auth';
import { StatsCard as Silian_StatsCard } from './StatsCard';
import { ActivityChart as Silian_ActivityChart } from './ActivityChart';
import { RecentActivities as Silian_RecentActivities } from './RecentActivities';
import { QuickActions as Silian_QuickActions } from './QuickActions';
import Silian_AchievementBadges from './AchievementBadges';
import { CheckinCalendar as Silian_CheckinCalendar } from './CheckinCalendar';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription } from '../ui/Alert';
import { Tabs as Silian_Tabs, TabsList as Silian_TabsList, TabsTrigger as Silian_TabsTrigger, TabsContent as Silian_TabsContent } from '../ui/Tabs';
import { toast as Silian_toast } from 'react-hot-toast';
import Silian_R2Image from '../common/R2Image';

export function Dashboard() {
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['common', 'dashboard', 'date', 'errors']);
  const [Silian_user, Silian_setUser] = Silian_useState(null);
  const [Silian_stats, Silian_setStats] = Silian_useState({});
  const [Silian_chartData, Silian_setChartData] = Silian_useState([]);
  const [Silian_recentActivities, Silian_setRecentActivities] = Silian_useState([]);
  const [Silian_badges, Silian_setBadges] = Silian_useState([]);
  const [Silian_userBadges, Silian_setUserBadges] = Silian_useState([]);
  const [Silian_checkins, Silian_setCheckins] = Silian_useState([]);
  const [Silian_checkinStats, Silian_setCheckinStats] = Silian_useState({});
  const [Silian_checkinQuota, Silian_setCheckinQuota] = Silian_useState({});
  const [Silian_checkinMeta, Silian_setCheckinMeta] = Silian_useState({});
  const [Silian_checkinMonth, Silian_setCheckinMonth] = Silian_useState(new Date());
  const [Silian_checkinLoading, Silian_setCheckinLoading] = Silian_useState(false);
  const [Silian_streakScope, Silian_setStreakScope] = Silian_useState('global');
  const [Silian_loading, Silian_setLoading] = Silian_useState(true);
  const [Silian_error, Silian_setError] = Silian_useState('');
  const Silian_didFetchRef = Silian_useRef(false);
  const Silian_isAdmin = Boolean(Silian_user?.is_admin);
  const Silian_navigate = Silian_useNavigate();

  const Silian_getInitial = (Silian_value) => {
    if (!Silian_value) return 'C';
    const Silian_trimmed = String(Silian_value).trim();
    return Silian_trimmed ? Silian_trimmed.charAt(0).toUpperCase() : 'C';
  };

  const Silian_renderLeaderboardAvatar = (Silian_entry, Silian_sizeClass = 'h-8 w-8') => {
    const Silian_displayName = Silian_entry?.username || Silian_entry?.name || '';
    const Silian_initial = Silian_getInitial(Silian_displayName);
    const Silian_fallback = (
      <div className={`${Silian_sizeClass} rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold`}>
        {Silian_initial}
      </div>
    );

    const Silian_avatarPath = Silian_entry?.avatar_path;
    const Silian_avatarUrl = Silian_entry?.avatar_url;

    if (Silian_avatarPath || Silian_avatarUrl) {
      const Silian_isAbsolute = typeof Silian_avatarUrl === 'string' && /^https?:\/\//i.test(Silian_avatarUrl);
      const Silian_resolvedFilePath = Silian_avatarPath || (!Silian_isAbsolute ? Silian_avatarUrl : undefined);
      return (
        <Silian_R2Image
          filePath={Silian_resolvedFilePath}
          src={Silian_isAbsolute ? Silian_avatarUrl : undefined}
          alt={Silian_displayName || Silian_t('dashboard.avatarAlt')}
          className={`${Silian_sizeClass} rounded-full object-cover border border-white shadow-sm`}
          fallback={Silian_fallback}
        />
      );
    }

    return Silian_fallback;
  };

  // 先声明，供后续 useEffect 使用，避免 TDZ 报错
  // 合并数据请求，避免 useEffect 使用时触发 TDZ
  const Silian_fetchDashboardData = Silian_useCallback(async () => {
    try {
      Silian_setLoading(true);

      const [Silian_statsResponse, Silian_chartResponse, Silian_activitiesResponse, Silian_badgesResponse, Silian_userBadgesResponse, Silian_checkinsResponse] = await Promise.all([
        Silian_carbonAPI.getUserStats(),
        Silian_carbonAPI.getChartData({ period: 30 }),
        Silian_carbonAPI.getRecentActivities({ limit: 10 }),
        Silian_badgeAPI.list(),
        Silian_badgeAPI.myBadges(),
        Silian_carbonAPI.getCheckins({ month: Silian_format(new Date(), 'yyyy-MM') }),
      ]);

      if (Silian_statsResponse.data.success) {
        Silian_setStats(Silian_statsResponse.data.data);
      }

      if (Silian_chartResponse.data.success) {
        Silian_setChartData(Silian_chartResponse.data.data);
      }

      if (Silian_activitiesResponse.data.success) {
        Silian_setRecentActivities(Silian_activitiesResponse.data.data);
      }

      if (Silian_badgesResponse.data.success) {
        Silian_setBadges(Silian_badgesResponse.data.data || []);
      }

      if (Silian_userBadgesResponse.data.success) {
        Silian_setUserBadges(Silian_userBadgesResponse.data.data || []);
      }

      if (Silian_checkinsResponse.data.success) {
        const Silian_payload = Silian_checkinsResponse.data.data || {};
        Silian_setCheckins(Array.isArray(Silian_payload.checkins) ? Silian_payload.checkins : []);
        Silian_setCheckinStats(Silian_payload.stats || {});
        Silian_setCheckinQuota(Silian_payload.makeup_quota || {});
        Silian_setCheckinMeta(Silian_payload.meta || {});
      }
    } catch (Silian_err) {
      Silian_setError(Silian_err.message || Silian_t('dashboard.loadError'));
    } finally {
      Silian_setLoading(false);
    }
  }, [Silian_t]);

  Silian_useEffect(() => {
    // 防止在开发模式下 StrictMode 导致的重复执行
    if (Silian_didFetchRef.current) return;
    Silian_didFetchRef.current = true;

    const { user: Silian_currentUser } = Silian_checkAuthStatus();
      if (Silian_currentUser) {
        Silian_setUser(Silian_currentUser);
        Silian_fetchDashboardData();
    } else {
      Silian_setError(Silian_t('dashboard.notLoggedIn'));
      Silian_setLoading(false);
    }
  }, [Silian_t, Silian_fetchDashboardData]);

  const Silian_fetchCheckins = Silian_useCallback(async (Silian_targetMonth) => {
    try {
      Silian_setCheckinLoading(true);
      const Silian_monthKey = Silian_format(Silian_targetMonth, 'yyyy-MM');
      const Silian_response = await Silian_carbonAPI.getCheckins({ month: Silian_monthKey });
      if (Silian_response.data.success) {
        const Silian_payload = Silian_response.data.data || {};
        Silian_setCheckins(Array.isArray(Silian_payload.checkins) ? Silian_payload.checkins : []);
        Silian_setCheckinStats(Silian_payload.stats || {});
        Silian_setCheckinQuota(Silian_payload.makeup_quota || {});
        Silian_setCheckinMeta(Silian_payload.meta || {});
      }
    } catch (Silian_err) {
      Silian_toast.error(Silian_err.message || Silian_t('dashboard.loadError'));
    } finally {
      Silian_setCheckinLoading(false);
    }
  }, [Silian_t]);

  const Silian_handleMonthChange = (Silian_nextMonth) => {
    Silian_setCheckinMonth(Silian_nextMonth);
    Silian_fetchCheckins(Silian_nextMonth);
  };

  const Silian_handleMakeupCheckin = Silian_useCallback(({ date: Silian_date }) => {
    if (!Silian_date) {
      return;
    }
    Silian_navigate(`/calculate?checkin_date=${encodeURIComponent(Silian_date)}`);
  }, [Silian_navigate]);


  const Silian_handleQuickAction = (Silian_action) => {
    // 处理快速操作点击
    if (Silian_action.href) {
      window.location.href = Silian_action.href;
    }
  };

  const Silian_handleViewAllActivities = () => {
    window.location.href = '/activities';
  };

  const Silian_monthFormatter = Silian_useMemo(() => new Intl.DateTimeFormat(Silian_currentLanguage, {
    year: 'numeric',
    month: 'long',
  }), [Silian_currentLanguage]);

  const Silian_monthlyAchievements = Silian_useMemo(() => {
    const Silian_list = Array.isArray(Silian_stats.monthly_achievements) ? Silian_stats.monthly_achievements : [];
    return Silian_list.map((Silian_item) => {
      const Silian_rawMonth = Silian_item?.month || '';
      let Silian_label = Silian_rawMonth;
      if (Silian_rawMonth) {
        const Silian_date = new Date(`${Silian_rawMonth}-01T00:00:00`);
        if (!Number.isNaN(Silian_date.getTime())) {
          Silian_label = Silian_monthFormatter.format(Silian_date);
        }
      }

      return {
        month: Silian_rawMonth,
        label: Silian_label,
        points: Number(Silian_item?.points_earned ?? Silian_item?.points ?? 0),
        carbon: Number(Silian_item?.carbon_saved ?? 0),
        records: Number(Silian_item?.records_count ?? 0),
      };
    });
  }, [Silian_stats.monthly_achievements, Silian_monthFormatter]);

  const Silian_handleTriggerBadgeAuto = async () => {
    try {
      await Silian_badgeAPI.triggerAuto();
      Silian_toast.success(Silian_t('dashboard.badgeAutoTriggered'));
      await Silian_fetchDashboardData();
    } catch {
      Silian_toast.error(Silian_t('dashboard.badgeAutoTriggerFailed'));
    }
  };

  const Silian_streakLeaderboards = Silian_stats?.streak_leaderboards || {};
  const Silian_streakStats = Silian_stats?.streak_stats || {};
  const Silian_regionStreakEntryCount = Silian_streakLeaderboards.region?.entries?.length || 0;
  const Silian_schoolStreakEntryCount = Silian_streakLeaderboards.school?.entries?.length || 0;
  const Silian_availableScopes = Silian_useMemo(() => {
    const Silian_scopes = ['global'];
    if (Silian_regionStreakEntryCount) Silian_scopes.push('region');
    if (Silian_schoolStreakEntryCount) Silian_scopes.push('school');
    return Silian_scopes;
  }, [Silian_regionStreakEntryCount, Silian_schoolStreakEntryCount]);

  const Silian_activeStreakScope = Silian_availableScopes.includes(Silian_streakScope) ? Silian_streakScope : 'global';

  if (Silian_error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Silian_Alert variant="destructive">
          <Silian_AlertDescription>{Silian_error}</Silian_AlertDescription>
        </Silian_Alert>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 欢迎标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-foreground">
            {Silian_t('dashboard.welcome')}{Silian_user?.username && `, ${Silian_user.username}`}！
          </h1>
          <p className="mt-1 text-muted-foreground">
            {Silian_t('dashboard.welcomeDesc')}
          </p>
        </div>

        <div className="hidden items-center gap-2 text-sm text-muted-foreground sm:flex">
          <span>{Silian_t('dashboard.lastLogin')}:</span>
          <span>{Silian_user?.lastlgn ? new Date(Silian_user.lastlgn).toLocaleString(Silian_currentLanguage) : Silian_t('dashboard.firstTime')}</span>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Silian_StatsCard
          title={Silian_t('dashboard.totalPoints')}
          value={Silian_stats.total_points || 0}
          unit={Silian_t('dashboard.points')}
          change={Silian_stats.points_change}
          changeType={Silian_stats.points_change > 0 ? 'increase' : Silian_stats.points_change < 0 ? 'decrease' : 'neutral'}
          icon={Silian_Award}
          color="blue"
          loading={Silian_loading}
        />

        <Silian_StatsCard
          title={Silian_t('dashboard.carbonSaved')}
          value={Silian_stats.total_carbon_saved || 0}
          unit={Silian_t('dashboard.carbonUnit')}
          change={Silian_stats.carbon_change}
          changeType={Silian_stats.carbon_change > 0 ? 'increase' : Silian_stats.carbon_change < 0 ? 'decrease' : 'neutral'}
          icon={Silian_Leaf}
          color="green"
          loading={Silian_loading}
        />

        <Silian_StatsCard
          title={Silian_t('dashboard.activitiesCount')}
          value={Silian_stats.total_activities || 0}
          unit={Silian_t('dashboard.activities')}
          change={Silian_stats.activities_change}
          changeType={Silian_stats.activities_change > 0 ? 'increase' : Silian_stats.activities_change < 0 ? 'decrease' : 'neutral'}
          icon={Silian_TrendingUp}
          color="orange"
          loading={Silian_loading}
        />

        <Silian_StatsCard
          title={Silian_t('dashboard.rank')}
          value={Silian_stats.rank || '-'}
          unit={Silian_stats.total_users ? Silian_t('dashboard.rankUnit', { total: Silian_stats.total_users }) : ''}
          change={Silian_stats.rank_change}
          changeType={Silian_stats.rank_change > 0 ? 'decrease' : Silian_stats.rank_change < 0 ? 'increase' : 'neutral'}
          icon={Silian_Users}
          color="purple"
          loading={Silian_loading}
        />
      </div>

      {/* 图表和快速操作 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="h-full lg:col-span-2">
          <Silian_ActivityChart
            data={Silian_chartData}
            title={Silian_t('dashboard.activityTrend')}
            description={Silian_t('dashboard.activityTrendDesc')}
            dataKey="carbon_saved"
            xAxisKey="date"
            color="#10b981"
            loading={Silian_loading}
          />
        </div>

        <div className="h-full">
          <Silian_QuickActions
            userStats={{
              points_balance: Silian_stats.total_points,
              unread_messages: Silian_stats.unread_messages,
              pending_reviews: Silian_stats.pending_reviews,
              available_products: Silian_stats.available_products,
              min_exchange_points: Silian_stats.min_exchange_points,
              new_achievements: Silian_stats.new_achievements
            }}
            onActionClick={Silian_handleQuickAction}
          />
        </div>
      </div>

      {/* 最近活动 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <Silian_CheckinCalendar
            checkins={Silian_checkins}
            stats={Silian_checkinStats}
            quota={Silian_checkinQuota}
            meta={Silian_checkinMeta}
            month={Silian_checkinMonth}
            loading={Silian_checkinLoading}
            onMonthChange={Silian_handleMonthChange}
            onMakeup={Silian_handleMakeupCheckin}
          />
          <Silian_RecentActivities
            activities={Silian_recentActivities}
            loading={Silian_loading}
            onViewAll={Silian_handleViewAllActivities}
          />
        </div>

        {/* 成就徽章与排行榜 */}
        <div className="space-y-6">
          <Silian_AchievementBadges
            badges={Silian_badges}
            userBadges={Silian_userBadges}
            loading={Silian_loading}
            onTriggerAuto={Silian_isAdmin ? Silian_handleTriggerBadgeAuto : undefined}
            isAdmin={Silian_isAdmin}
          />
          {/* 本月成就 */}
          {Silian_monthlyAchievements.length > 0 && (
            <div className="space-y-4 rounded-lg border border-border/80 bg-card/95 p-6 shadow-sm">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="flex items-center gap-2 text-lg font-semibold text-amber-500">
                    <Silian_Award className="h-5 w-5" />
                    {Silian_t('dashboard.monthlyAchievements')}
                  </h3>
                  <p className="text-sm text-amber-400">
                    {Silian_t('dashboard.monthlyAchievementsDescription')}
                  </p>
                </div>
              </div>

              {(() => {
                const Silian_current = Silian_monthlyAchievements[0];
                const Silian_history = Silian_monthlyAchievements.slice(1, 4);
                return (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-amber-500/20 bg-gradient-to-br from-amber-500/10 to-orange-500/10 p-4">
                      <p className="text-sm font-medium text-amber-500">
                        {Silian_t('dashboard.currentMonthAchievement',  { month: Silian_current.label })}
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div className="flex flex-col">
                          <span className="text-xs uppercase tracking-wide text-amber-400">
                            {Silian_t('dashboard.monthlyPointsLabel')}
                          </span>
                          <span className="text-lg font-semibold text-foreground">
                            {Silian_t('dashboard.monthlyPointsWithUnit',  {
                              points: Silian_current.points.toLocaleString(Silian_currentLanguage),
                            })}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs uppercase tracking-wide text-amber-400">
                            {Silian_t('dashboard.monthlyCarbonLabel')}
                          </span>
                          <span className="text-lg font-semibold text-foreground">
                            {Silian_t('dashboard.monthlyCarbonSaved',  {
                              amount: Silian_current.carbon.toLocaleString(Silian_currentLanguage, { maximumFractionDigits: 2 }),
                            })}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs uppercase tracking-wide text-amber-400">
                            {Silian_t('dashboard.monthlyRecordsLabel')}
                          </span>
                          <span className="text-lg font-semibold text-foreground">
                            {Silian_t('dashboard.monthlyRecords',  {
                              count: Silian_current.records.toLocaleString(Silian_currentLanguage),
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {Silian_history.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium uppercase tracking-wide text-amber-400">
                          {Silian_t('dashboard.previousMonths')}
                        </p>
                        <div className="space-y-2">
                          {Silian_history.map((Silian_item) => (
                            <div key={Silian_item.month || Silian_item.label} className="flex items-center justify-between rounded-md border border-amber-500/15 bg-amber-500/5 px-3 py-2 text-sm">
                              <div className="flex flex-col">
                                <span className="font-medium text-foreground">{Silian_item.label}</span>
                                <span className="text-xs text-muted-foreground">
                                  {Silian_t('dashboard.monthlyCarbonSummary',  {
                                    carbon: Silian_item.carbon.toLocaleString(Silian_currentLanguage, { maximumFractionDigits: 2 }),
                                    records: Silian_item.records.toLocaleString(Silian_currentLanguage),
                                  })}
                                </span>
                              </div>
                              <span className="text-sm font-semibold text-amber-500">
                                {Silian_t('dashboard.monthlyPointsShort',  {
                                  points: Silian_item.points.toLocaleString(Silian_currentLanguage),
                                })}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* 排行榜预览 */}
          {Silian_stats.leaderboard && (
            <div className="rounded-lg border border-blue-500/20 bg-gradient-to-r from-blue-500/10 to-purple-500/10 p-6">
              <h3 className="mb-4 flex items-center gap-2 text-lg font-semibold text-blue-500">
                <Silian_Users className="h-5 w-5" />
                {Silian_t('dashboard.leaderboard')}
              </h3>
              <div className="space-y-3">
                {Silian_stats.leaderboard.slice(0, 5).map((Silian_entry, Silian_index) => {
                  const Silian_displayName = Silian_entry.username || Silian_entry.name || Silian_t('dashboard.leaderboardUnknownName');
                  return (
                    <div key={Silian_entry.id ?? `${Silian_index}-${Silian_displayName}`} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        Silian_index === 0 ? 'bg-yellow-500 text-white' :
                        Silian_index === 1 ? 'bg-zinc-500 text-white' :
                        Silian_index === 2 ? 'bg-orange-500 text-white' :
                        'bg-muted text-muted-foreground'
                      }`}>
                        {Silian_index + 1}
                      </div>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {Silian_renderLeaderboardAvatar(Silian_entry)}
                        <span className="truncate text-sm font-medium text-foreground">{Silian_displayName}</span>
                      </div>
                      {Number.isFinite(Silian_entry.total_points) ? (
                        <span className="text-sm text-blue-400">
                          {Number(Silian_entry.total_points).toLocaleString(Silian_currentLanguage)} {Silian_t('common.points')}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {Silian_stats.streak_leaderboards && (
            <div className="rounded-lg border border-amber-500/20 bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-rose-500/10 p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="flex items-center gap-2 text-lg font-semibold text-amber-500">
                  <Silian_Flame className="h-5 w-5" />
                  {Silian_t('dashboard.streakLeaderboard')}
                </h3>
                <div className="text-xs text-amber-400">
                  {Silian_t('dashboard.streakMine')} {Silian_streakStats.current_streak ?? 0} · {Silian_t('dashboard.streakRank')} {Silian_streakStats.ranks?.[Silian_activeStreakScope] ?? '--'}
                </div>
              </div>

              <Silian_Tabs value={Silian_activeStreakScope} onValueChange={Silian_setStreakScope} className="space-y-3">
                <Silian_TabsList className="border-amber-200 bg-amber-50/60">
                  {Silian_availableScopes.includes('global') && (
                    <Silian_TabsTrigger value="global">{Silian_t('dashboard.leaderboardScopes.global')}</Silian_TabsTrigger>
                  )}
                  {Silian_availableScopes.includes('region') && (
                    <Silian_TabsTrigger value="region">{Silian_t('dashboard.leaderboardScopes.region')}</Silian_TabsTrigger>
                  )}
                  {Silian_availableScopes.includes('school') && (
                    <Silian_TabsTrigger value="school">{Silian_t('dashboard.leaderboardScopes.school')}</Silian_TabsTrigger>
                  )}
                </Silian_TabsList>

                {Silian_availableScopes.map((Silian_scope) => (
                  <Silian_TabsContent key={Silian_scope} value={Silian_scope}>
                    {Silian_streakLeaderboards?.[Silian_scope]?.entries?.length ? (
                      <div className="space-y-3">
                        {Silian_streakLeaderboards[Silian_scope].entries.slice(0, 10).map((Silian_entry, Silian_index) => (
                          <div key={Silian_entry.id ?? `${Silian_scope}-${Silian_index}`} className="flex items-center gap-3 text-sm text-foreground">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              Silian_index === 0 ? 'bg-yellow-500 text-white' :
                              Silian_index === 1 ? 'bg-zinc-500 text-white' :
                              Silian_index === 2 ? 'bg-orange-500 text-white' :
                              'bg-muted text-muted-foreground'
                            }`}>
                              {Silian_index + 1}
                            </div>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {Silian_renderLeaderboardAvatar(Silian_entry, 'h-7 w-7')}
                              <span className="truncate">{Silian_entry.username || Silian_entry.name || Silian_t('dashboard.leaderboardUnknownName')}</span>
                            </div>
                            <span className="text-xs font-semibold">{Silian_entry.current_streak ?? 0} {Silian_t('dashboard.streakDays')}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">{Silian_t('dashboard.streakEmpty')}</p>
                    )}
                  </Silian_TabsContent>
                ))}
              </Silian_Tabs>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
