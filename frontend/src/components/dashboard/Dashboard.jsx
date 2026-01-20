import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { Leaf, Award, TrendingUp, Users, Flame } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { carbonAPI, badgeAPI } from '../../lib/api';
import { checkAuthStatus } from '../../lib/auth';
import { StatsCard } from './StatsCard';
import { ActivityChart } from './ActivityChart';
import { RecentActivities } from './RecentActivities';
import { QuickActions } from './QuickActions';
import AchievementBadges from './AchievementBadges';
import { CheckinCalendar } from './CheckinCalendar';
import { Alert, AlertDescription } from '../ui/Alert';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '../ui/Tabs';
import { toast } from 'react-hot-toast';
import R2Image from '../common/R2Image';

export function Dashboard() {
  const { t } = useTranslation();
  const [user, setUser] = useState(null);
  const [stats, setStats] = useState({});
  const [chartData, setChartData] = useState([]);
  const [recentActivities, setRecentActivities] = useState([]);
  const [badges, setBadges] = useState([]);
  const [userBadges, setUserBadges] = useState([]);
  const [checkins, setCheckins] = useState([]);
  const [checkinStats, setCheckinStats] = useState({});
  const [checkinQuota, setCheckinQuota] = useState({});
  const [checkinMeta, setCheckinMeta] = useState({});
  const [checkinMonth, setCheckinMonth] = useState(new Date());
  const [checkinLoading, setCheckinLoading] = useState(false);
  const [streakScope, setStreakScope] = useState('global');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const didFetchRef = useRef(false);
  const isAdmin = Boolean(user?.is_admin);
  const navigate = useNavigate();

  const getInitial = (value) => {
    if (!value) return 'C';
    const trimmed = String(value).trim();
    return trimmed ? trimmed.charAt(0).toUpperCase() : 'C';
  };

  const renderLeaderboardAvatar = (entry, sizeClass = 'h-8 w-8') => {
    const displayName = entry?.username || entry?.name || '';
    const initial = getInitial(displayName);
    const fallback = (
      <div className={`${sizeClass} rounded-full bg-blue-100 text-blue-600 flex items-center justify-center text-xs font-semibold`}>
        {initial}
      </div>
    );

    const avatarPath = entry?.avatar_path;
    const avatarUrl = entry?.avatar_url;

    if (avatarPath || avatarUrl) {
      const isAbsolute = typeof avatarUrl === 'string' && /^https?:\/\//i.test(avatarUrl);
      const resolvedFilePath = avatarPath || (!isAbsolute ? avatarUrl : undefined);
      return (
        <R2Image
          filePath={resolvedFilePath}
          src={isAbsolute ? avatarUrl : undefined}
          alt={displayName || 'avatar'}
          className={`${sizeClass} rounded-full object-cover border border-white shadow-sm`}
          fallback={fallback}
        />
      );
    }

    return fallback;
  };

  // 先声明，供后续 useEffect 使用，避免 TDZ 报错
  // 合并数据请求，避免 useEffect 使用时触发 TDZ
  const fetchDashboardData = useCallback(async () => {
    try {
      setLoading(true);

      const [statsResponse, chartResponse, activitiesResponse, badgesResponse, userBadgesResponse, checkinsResponse] = await Promise.all([
        carbonAPI.getUserStats(),
        carbonAPI.getChartData({ period: 30 }),
        carbonAPI.getRecentActivities({ limit: 10 }),
        badgeAPI.list(),
        badgeAPI.myBadges(),
        carbonAPI.getCheckins({ month: format(new Date(), 'yyyy-MM') }),
      ]);

      if (statsResponse.data.success) {
        setStats(statsResponse.data.data);
      }

      if (chartResponse.data.success) {
        setChartData(chartResponse.data.data);
      }

      if (activitiesResponse.data.success) {
        setRecentActivities(activitiesResponse.data.data);
      }

      if (badgesResponse.data.success) {
        setBadges(badgesResponse.data.data || []);
      }

      if (userBadgesResponse.data.success) {
        setUserBadges(userBadgesResponse.data.data || []);
      }

      if (checkinsResponse.data.success) {
        const payload = checkinsResponse.data.data || {};
        setCheckins(Array.isArray(payload.checkins) ? payload.checkins : []);
        setCheckinStats(payload.stats || {});
        setCheckinQuota(payload.makeup_quota || {});
        setCheckinMeta(payload.meta || {});
      }
    } catch (err) {
      setError(err.message || t('dashboard.loadError'));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    // 防止在开发模式下 StrictMode 导致的重复执行
    if (didFetchRef.current) return;
    didFetchRef.current = true;

    const { user: currentUser } = checkAuthStatus();
      if (currentUser) {
        setUser(currentUser);
        fetchDashboardData();
    } else {
      setError(t('dashboard.notLoggedIn'));
      setLoading(false);
    }
  }, [t, fetchDashboardData]);

  const fetchCheckins = useCallback(async (targetMonth) => {
    try {
      setCheckinLoading(true);
      const monthKey = format(targetMonth, 'yyyy-MM');
      const response = await carbonAPI.getCheckins({ month: monthKey });
      if (response.data.success) {
        const payload = response.data.data || {};
        setCheckins(Array.isArray(payload.checkins) ? payload.checkins : []);
        setCheckinStats(payload.stats || {});
        setCheckinQuota(payload.makeup_quota || {});
        setCheckinMeta(payload.meta || {});
      }
    } catch (err) {
      toast.error(err.message || t('dashboard.loadError'));
    } finally {
      setCheckinLoading(false);
    }
  }, [t]);

  const handleMonthChange = (nextMonth) => {
    setCheckinMonth(nextMonth);
    fetchCheckins(nextMonth);
  };

  const handleMakeupCheckin = useCallback(({ date }) => {
    if (!date) {
      return;
    }
    navigate(`/calculate?checkin_date=${encodeURIComponent(date)}`);
  }, [navigate]);


  const handleQuickAction = (action) => {
    // 处理快速操作点击
    if (action.href) {
      window.location.href = action.href;
    }
  };

  const handleViewAllActivities = () => {
    window.location.href = '/activities';
  };

  const monthFormatter = useMemo(() => new Intl.DateTimeFormat(undefined, {
    year: 'numeric',
    month: 'long',
  }), []);

  const monthlyAchievements = useMemo(() => {
    const list = Array.isArray(stats.monthly_achievements) ? stats.monthly_achievements : [];
    return list.map((item) => {
      const rawMonth = item?.month || '';
      let label = rawMonth;
      if (rawMonth) {
        const date = new Date(`${rawMonth}-01T00:00:00`);
        if (!Number.isNaN(date.getTime())) {
          label = monthFormatter.format(date);
        }
      }

      return {
        month: rawMonth,
        label,
        points: Number(item?.points_earned ?? item?.points ?? 0),
        carbon: Number(item?.carbon_saved ?? 0),
        records: Number(item?.records_count ?? 0),
      };
    });
  }, [stats.monthly_achievements, monthFormatter]);

  const handleTriggerBadgeAuto = async () => {
    try {
      await badgeAPI.triggerAuto();
      toast.success(t('dashboard.badgeAutoTriggered', '已触发自动授予流程'));
      await fetchDashboardData();
    } catch {
      toast.error(t('dashboard.badgeAutoTriggerFailed', '触发自动授予失败'));
    }
  };

  const streakLeaderboards = stats?.streak_leaderboards || {};
  const streakStats = stats?.streak_stats || {};
  const availableScopes = useMemo(() => {
    const scopes = ['global'];
    if (streakLeaderboards.region?.entries?.length) scopes.push('region');
    if (streakLeaderboards.school?.entries?.length) scopes.push('school');
    return scopes;
  }, [streakLeaderboards]);

  const activeStreakScope = availableScopes.includes(streakScope) ? streakScope : 'global';
  const activeStreakBoard = streakLeaderboards[activeStreakScope] || { entries: [] };

  if (error) {
    return (
      <div className="max-w-7xl mx-auto p-6">
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* 欢迎标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">
            {t('dashboard.welcome')}{user?.username && `, ${user.username}`}！
          </h1>
          <p className="text-gray-600 mt-1">
            {t('dashboard.welcomeDesc')}
          </p>
        </div>
        
        <div className="hidden sm:flex items-center gap-2 text-sm text-gray-500">
          <span>{t('dashboard.lastLogin')}:</span>
          <span>{user?.lastlgn ? new Date(user.lastlgn).toLocaleString('zh-CN') : t('dashboard.firstTime')}</span>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatsCard
          title={t('dashboard.totalPoints')}
          value={stats.total_points || 0}
          unit={t('dashboard.points')}
          change={stats.points_change}
          changeType={stats.points_change > 0 ? 'increase' : stats.points_change < 0 ? 'decrease' : 'neutral'}
          icon={Award}
          color="blue"
          loading={loading}
        />
        
        <StatsCard
          title={t('dashboard.carbonSaved')}
          value={stats.total_carbon_saved || 0}
          unit="kg CO₂"
          change={stats.carbon_change}
          changeType={stats.carbon_change > 0 ? 'increase' : stats.carbon_change < 0 ? 'decrease' : 'neutral'}
          icon={Leaf}
          color="green"
          loading={loading}
        />
        
        <StatsCard
          title={t('dashboard.activitiesCount')}
          value={stats.total_activities || 0}
          unit={t('dashboard.activities')}
          change={stats.activities_change}
          changeType={stats.activities_change > 0 ? 'increase' : stats.activities_change < 0 ? 'decrease' : 'neutral'}
          icon={TrendingUp}
          color="orange"
          loading={loading}
        />
        
        <StatsCard
          title={t('dashboard.rank')}
          value={stats.rank || '-'}
          unit={stats.total_users ? `/ ${stats.total_users}` : ''}
          change={stats.rank_change}
          changeType={stats.rank_change > 0 ? 'decrease' : stats.rank_change < 0 ? 'increase' : 'neutral'}
          icon={Users}
          color="purple"
          loading={loading}
        />
      </div>

      {/* 图表和快速操作 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <ActivityChart
            data={chartData}
            title={t('dashboard.activityTrend')}
            description={t('dashboard.activityTrendDesc')}
            dataKey="carbon_saved"
            xAxisKey="date"
            color="#10b981"
            loading={loading}
          />
        </div>
        
        <div>
          <QuickActions
            userStats={{
              points_balance: stats.total_points,
              unread_messages: stats.unread_messages,
              pending_reviews: stats.pending_reviews,
              available_products: stats.available_products,
              new_achievements: stats.new_achievements
            }}
            onActionClick={handleQuickAction}
          />
        </div>
      </div>

      {/* 最近活动 */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="space-y-6">
          <CheckinCalendar
            checkins={checkins}
            stats={checkinStats}
            quota={checkinQuota}
            meta={checkinMeta}
            month={checkinMonth}
            loading={checkinLoading}
            onMonthChange={handleMonthChange}
            onMakeup={handleMakeupCheckin}
          />
          <RecentActivities
            activities={recentActivities}
            loading={loading}
            onViewAll={handleViewAllActivities}
          />
        </div>

        {/* 成就徽章与排行榜 */}
        <div className="space-y-6">
          <AchievementBadges
            badges={badges}
            userBadges={userBadges}
            loading={loading}
            onTriggerAuto={isAdmin ? handleTriggerBadgeAuto : undefined}
            isAdmin={isAdmin}
          />
          {/* 本月成就 */}
          {monthlyAchievements.length > 0 && (
            <div className="bg-white border rounded-lg shadow-sm p-6 space-y-4">
              <div className="flex items-center justify-between gap-4 flex-wrap">
                <div>
                  <h3 className="text-lg font-semibold text-amber-700 flex items-center gap-2">
                    <Award className="h-5 w-5" />
                    {t('dashboard.monthlyAchievements', '本月成就')}
                  </h3>
                  <p className="text-sm text-amber-600">
                    {t('dashboard.monthlyAchievementsDescription', '追踪你每月的碳减排表现')}
                  </p>
                </div>
              </div>

              {(() => {
                const current = monthlyAchievements[0];
                const history = monthlyAchievements.slice(1, 4);
                return (
                  <div className="space-y-4">
                    <div className="rounded-lg border border-amber-200 bg-gradient-to-br from-amber-50 to-orange-50 p-4">
                      <p className="text-sm font-medium text-amber-700">
                        {t('dashboard.currentMonthAchievement', '{{month}} 成就概览', { month: current.label })}
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-3">
                        <div className="flex flex-col">
                          <span className="text-xs text-amber-500 uppercase tracking-wide">
                            {t('dashboard.monthlyPointsLabel', '积分获得')}
                          </span>
                          <span className="text-lg font-semibold text-amber-700">
                            {t('dashboard.monthlyPointsWithUnit', '{{points}} 积分', {
                              points: current.points.toLocaleString(),
                            })}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-amber-500 uppercase tracking-wide">
                            {t('dashboard.monthlyCarbonLabel', '碳减排')}
                          </span>
                          <span className="text-lg font-semibold text-amber-700">
                            {t('dashboard.monthlyCarbonSaved', '{{amount}} 千克', {
                              amount: current.carbon.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                            })}
                          </span>
                        </div>
                        <div className="flex flex-col">
                          <span className="text-xs text-amber-500 uppercase tracking-wide">
                            {t('dashboard.monthlyRecordsLabel', '记录次数')}
                          </span>
                          <span className="text-lg font-semibold text-amber-700">
                            {t('dashboard.monthlyRecords', '{{count}} 条', {
                              count: current.records.toLocaleString(),
                            })}
                          </span>
                        </div>
                      </div>
                    </div>

                    {history.length > 0 && (
                      <div className="space-y-2">
                        <p className="text-xs font-medium text-amber-600 uppercase tracking-wide">
                          {t('dashboard.previousMonths', '历史月份')}
                        </p>
                        <div className="space-y-2">
                          {history.map((item) => (
                            <div key={item.month || item.label} className="flex items-center justify-between rounded-md border border-amber-100 bg-amber-50/60 px-3 py-2 text-sm">
                              <div className="flex flex-col">
                                <span className="font-medium text-amber-700">{item.label}</span>
                                <span className="text-xs text-amber-500">
                                  {t('dashboard.monthlyCarbonSummary', '{{carbon}} 千克减排 · {{records}} 条记录', {
                                    carbon: item.carbon.toLocaleString(undefined, { maximumFractionDigits: 2 }),
                                    records: item.records.toLocaleString(),
                                  })}
                                </span>
                              </div>
                              <span className="text-sm font-semibold text-amber-700">
                                {t('dashboard.monthlyPointsShort', '+{{points}} 积分', {
                                  points: item.points.toLocaleString(),
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
          {stats.leaderboard && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
              <h3 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                <Users className="h-5 w-5" />
                {t('dashboard.leaderboard')}
              </h3>
              <div className="space-y-3">
                {stats.leaderboard.slice(0, 5).map((entry, index) => {
                  const displayName = entry.username || entry.name || '—';
                  return (
                    <div key={entry.id ?? `${index}-${displayName}`} className="flex items-center gap-3">
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                        index === 0 ? 'bg-yellow-500 text-white' :
                        index === 1 ? 'bg-gray-400 text-white' :
                        index === 2 ? 'bg-orange-500 text-white' :
                        'bg-gray-200 text-gray-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        {renderLeaderboardAvatar(entry)}
                        <span className="truncate text-sm text-blue-700 font-medium">{displayName}</span>
                      </div>
                      {Number.isFinite(entry.total_points) ? (
                        <span className="text-sm text-blue-600">
                          {entry.total_points} {t('common.points')}
                        </span>
                      ) : null}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {stats.streak_leaderboards && (
            <div className="bg-gradient-to-r from-amber-50 via-orange-50 to-rose-50 border border-amber-200 rounded-lg p-6">
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-lg font-semibold text-amber-800 flex items-center gap-2">
                  <Flame className="h-5 w-5" />
                  {t('dashboard.streakLeaderboard', '连击排行榜')}
                </h3>
                <div className="text-xs text-amber-700">
                  {t('dashboard.streakMine', '我的连击')} {streakStats.current_streak ?? 0} · {t('dashboard.streakRank', '排名')} {streakStats.ranks?.[activeStreakScope] ?? '--'}
                </div>
              </div>

              <Tabs value={activeStreakScope} onValueChange={setStreakScope} className="space-y-3">
                <TabsList className="border-amber-200 bg-amber-50/60">
                  {availableScopes.includes('global') && (
                    <TabsTrigger value="global">{t('dashboard.leaderboardScopes.global', '全服')}</TabsTrigger>
                  )}
                  {availableScopes.includes('region') && (
                    <TabsTrigger value="region">{t('dashboard.leaderboardScopes.region', '地区')}</TabsTrigger>
                  )}
                  {availableScopes.includes('school') && (
                    <TabsTrigger value="school">{t('dashboard.leaderboardScopes.school', '学校')}</TabsTrigger>
                  )}
                </TabsList>

                {availableScopes.map((scope) => (
                  <TabsContent key={scope} value={scope}>
                    {streakLeaderboards?.[scope]?.entries?.length ? (
                      <div className="space-y-3">
                        {streakLeaderboards[scope].entries.slice(0, 10).map((entry, index) => (
                          <div key={entry.id ?? `${scope}-${index}`} className="flex items-center gap-3 text-sm text-amber-800">
                            <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                              index === 0 ? 'bg-yellow-500 text-white' :
                              index === 1 ? 'bg-gray-400 text-white' :
                              index === 2 ? 'bg-orange-500 text-white' :
                              'bg-amber-200 text-amber-800'
                            }`}>
                              {index + 1}
                            </div>
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                              {renderLeaderboardAvatar(entry, 'h-7 w-7')}
                              <span className="truncate">{entry.username || entry.name || '-'}</span>
                            </div>
                            <span className="text-xs font-semibold">{entry.current_streak ?? 0} {t('dashboard.streakDays', '天')}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-amber-700">{t('dashboard.streakEmpty', '暂无连击数据')}</p>
                    )}
                  </TabsContent>
                ))}
              </Tabs>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
