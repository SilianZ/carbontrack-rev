import React, { useCallback, useMemo } from 'react';
import { useQuery } from 'react-query';
import { Award, Lock, RefreshCw, Sparkles, CalendarDays, Trophy } from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { badgeAPI, carbonAPI } from '../lib/api';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Alert, AlertDescription } from '../components/ui/Alert';
import { Skeleton } from '../components/ui/skeleton';
import R2Image from '../components/common/R2Image';
import { resolveR2ImageSource } from '../lib/r2Image';
import { formatNumber, formatDateSafe, parseDateFlexible } from '../lib/utils';

const TEN_MINUTES = 600;

const normalizeBadgeId = (value) => {
  if (value === undefined || value === null) {
    return null;
  }
  return String(value);
};

const resolveBadgeImage = (badge = {}) => resolveR2ImageSource({
  urlCandidates: [badge.icon_url, badge.icon_presigned_url],
  pathCandidates: [badge.icon_path, badge.icon_thumbnail_path],
});

export default function AchievementsPage() {
  const { t } = useTranslation();

  const {
    data: badgeListData,
    isLoading: badgesLoading,
    isFetching: badgesFetching,
    error: badgesError,
    refetch: refetchBadges
  } = useQuery(
    ['badges', 'all'],
    async () => {
      const response = await badgeAPI.list({ include_inactive: true });
      if (!response.data?.success) {
        throw new Error(response.data?.message || t('achievements.loadError', '成就数据加载失败'));
      }
      return Array.isArray(response.data.data) ? response.data.data : [];
    },
    {
      staleTime: TEN_MINUTES * 1000,
    }
  );

  const {
    data: myBadgesData,
    isLoading: myBadgesLoading,
    isFetching: myBadgesFetching,
    error: myBadgesError,
    refetch: refetchMyBadges
  } = useQuery(
    ['badges', 'mine'],
    async () => {
      const response = await badgeAPI.myBadges();
      if (!response.data?.success) {
        throw new Error(response.data?.message || t('achievements.loadError', '成就数据加载失败'));
      }
      return Array.isArray(response.data.data) ? response.data.data : [];
    },
    {
      staleTime: TEN_MINUTES * 1000,
    }
  );

  const {
    data: statsData,
    isLoading: statsLoading,
    isFetching: statsFetching,
    error: statsError,
    refetch: refetchStats
  } = useQuery(
    ['user', 'stats', 'achievements'],
    async () => {
      const response = await carbonAPI.getUserStats();
      if (!response.data?.success) {
        throw new Error(response.data?.message || t('achievements.loadError', '成就数据加载失败'));
      }
      return response.data.data || {};
    },
    {
      staleTime: TEN_MINUTES * 1000,
    }
  );

  const badges = badgeListData || [];
  const rawUserBadges = myBadgesData || [];

  const badgesById = useMemo(() => {
    const map = new Map();
    badges.forEach((badge) => {
      const key = normalizeBadgeId(badge?.id ?? badge?.badge_id);
      if (key) {
        map.set(key, badge);
      }
    });
    return map;
  }, [badges]);

  const userBadgeRecords = useMemo(() => {
    const seenLatest = new Map();
    const entries = [];

    rawUserBadges.forEach((entry) => {
      if (!entry) return;
      const record = entry.user_badge || entry;
      if (!record) return;
      const badgeData = entry.badge || record.badge || null;
      const badgeId = normalizeBadgeId(record.badge_id ?? badgeData?.id ?? entry.badge_id);
      if (!badgeId) return;
      const awardedAt = record.awarded_at || record.created_at || record.updated_at || null;
      const normalized = {
        badgeId,
        record,
        badge: badgeData || badgesById.get(badgeId) || null,
        awardedAt,
        progress: record.progress ?? null,
        status: record.status || 'unlocked',
        entry
      };
      entries.push(normalized);

      const existing = seenLatest.get(badgeId);
      if (existing) {
        const existingDate = parseDateFlexible(existing.awardedAt) || new Date(0);
        const currentDate = parseDateFlexible(awardedAt) || new Date(0);
        if (currentDate > existingDate) {
          seenLatest.set(badgeId, normalized);
        }
      } else {
        seenLatest.set(badgeId, normalized);
      }
    });

    return {
      entries,
      latest: seenLatest
    };
  }, [rawUserBadges, badgesById]);

  const unlockedLatest = userBadgeRecords.latest;
  const unlockedBadges = useMemo(() => {
    return Array.from(unlockedLatest.values())
      .map((item) => ({
        ...item,
        badge: item.badge || badgesById.get(item.badgeId) || null,
      }))
      .sort((a, b) => {
        const aDate = parseDateFlexible(a.awardedAt) || new Date(0);
        const bDate = parseDateFlexible(b.awardedAt) || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });
  }, [unlockedLatest, badgesById]);

  const lockedBadges = useMemo(() => {
    return badges.filter((badge) => {
      const key = normalizeBadgeId(badge?.id ?? badge?.badge_id);
      if (!key) return false;
      return !unlockedLatest.has(key) && badge?.is_deleted !== true;
    });
  }, [badges, unlockedLatest]);

  const timeline = useMemo(() => {
    return userBadgeRecords.entries
      .map((item, index) => ({
        id: `${item.badgeId}-${item.awardedAt || index}`,
        badge: item.badge || badgesById.get(item.badgeId) || null,
        awardedAt: item.awardedAt,
        points: item.record?.points_earned ?? item.entry?.points ?? item.badge?.points ?? null,
        description: item.record?.notes || item.record?.description || item.badge?.description || '',
      }))
      .filter((item) => item.awardedAt)
      .sort((a, b) => {
        const aDate = parseDateFlexible(a.awardedAt) || new Date(0);
        const bDate = parseDateFlexible(b.awardedAt) || new Date(0);
        return bDate.getTime() - aDate.getTime();
      });
  }, [userBadgeRecords.entries, badgesById]);

  const totalBadges = badges.length;
  const unlockedCount = unlockedLatest.size;
  const lockedCount = totalBadges - unlockedCount;
  const completion = totalBadges > 0 ? Math.round((unlockedCount / totalBadges) * 100) : 0;

  const totalPointsFromBadges = useMemo(() => {
    return unlockedBadges.reduce((sum, item) => {
      const points = Number(item.record?.points_earned ?? item.badge?.points ?? 0);
      return sum + (Number.isFinite(points) ? points : 0);
    }, 0);
  }, [unlockedBadges]);

  const isLoading = badgesLoading || myBadgesLoading || statsLoading;
  const isFetching = badgesFetching || myBadgesFetching || statsFetching;
  const error = badgesError || myBadgesError || statsError;

  const handleRefresh = useCallback(async () => {
    await Promise.all([refetchBadges(), refetchMyBadges(), refetchStats()]);
  }, [refetchBadges, refetchMyBadges, refetchStats]);

  return (
    <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Trophy className="h-8 w-8 text-yellow-500" />
            {t('achievements.title', '我的成就')}
          </h1>
          <p className="text-gray-600 mt-2">
            {t('achievements.subtitle', '查看您已经解锁的徽章和解锁进度。')}
          </p>
        </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isFetching} className="self-start md:self-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          {t('achievements.refresh', '刷新')}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error.message || t('achievements.loadError', '成就数据加载失败')}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{t('achievements.summary.totalBadges', '徽章总数')}</CardTitle>
            <Award className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold text-gray-900">{totalBadges}</div>
            )}
            <CardDescription className="text-xs text-gray-500 mt-1">
              {t('achievements.summary.totalBadgesHint', '平台目前提供的全部成就徽章数量。')}
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{t('achievements.summary.unlocked', '已解锁')}</CardTitle>
            <Sparkles className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">{unlockedCount}</div>
                {totalPointsFromBadges > 0 && (
                  <p className="text-xs text-green-600 mt-2">
                    {t('achievements.summary.pointsFromBadges', '{{points}} 积分', {
                      points: formatNumber(totalPointsFromBadges, 0),
                    })}
                  </p>
                )}
              </>
            )}
            <CardDescription className="text-xs text-gray-500 mt-1">
              {t('achievements.summary.unlockedHint', '您已经达成的徽章数量。')}
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{t('achievements.summary.locked', '待解锁')}</CardTitle>
            <Lock className="h-4 w-4 text-gray-400" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold text-gray-700">{Math.max(lockedCount, 0)}</div>
            )}
            <CardDescription className="text-xs text-gray-500 mt-1">
              {t('achievements.summary.lockedHint', '继续完成环保行动即可解锁更多徽章。')}
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-gray-500">{t('achievements.summary.completion', '完成度')}</CardTitle>
            <CalendarDays className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <div className="text-2xl font-bold text-blue-600">{completion}%</div>
            )}
            <CardDescription className="text-xs text-gray-500 mt-1">
              {t('achievements.summary.completionHint', '当前徽章解锁进度百分比。')}
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-gray-900">
            <Award className="h-5 w-5 text-yellow-500" />
            {t('achievements.unlocked.title', '已获得徽章')}
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            {t('achievements.unlocked.description', '恭喜，您已经解锁了以下成就徽章。')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-28 rounded-lg" />
              ))}
            </div>
          ) : unlockedBadges.length === 0 ? (
            <div className="text-sm text-gray-500 bg-gray-50 border rounded-md p-6 text-center">
              {t('achievements.unlocked.empty', '暂时还没有解锁任何徽章，快去参与环保行动吧！')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {unlockedBadges.map((item) => {
                const badge = item.badge || {};
                const badgeImage = resolveBadgeImage(badge);
                return (
                  <div
                    key={item.badgeId}
                    className="border rounded-lg p-4 flex gap-4 bg-white hover:shadow-md transition"
                  >
                    <div className="w-16 h-16 rounded-full border bg-white flex items-center justify-center overflow-hidden">
                      {badgeImage.src || badgeImage.filePath ? (
                        <R2Image
                          src={badgeImage.src || undefined}
                          filePath={badgeImage.filePath || undefined}
                          alt={badge.name_zh || badge.name_en || badge.name || 'badge-icon'}
                          className="w-full h-full object-cover"
                          expiresIn={TEN_MINUTES}
                        />
                      ) : (
                        <Award className="h-8 w-8 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="text-base font-semibold text-gray-900">
                        {badge.name_zh || badge.name_en || badge.name || t('achievements.labels.unnamedBadge', '未命名徽章')}
                      </div>
                      <div className="text-xs text-gray-500">
                        {badge.name_en}
                      </div>
                      {item.awardedAt && (
                        <div className="text-xs text-green-600">
                          {t('achievements.unlocked.awardedAt', '解锁时间')}: {formatDateSafe(item.awardedAt, 'yyyy-MM-dd HH:mm')}
                        </div>
                      )}
                      {badge.description_zh || badge.description_en ? (
                        <p className="text-sm text-gray-600 mt-1">
                          {badge.description_zh || badge.description_en}
                        </p>
                      ) : null}
                      {item.record?.points_earned ? (
                        <div className="text-xs text-blue-600">
                          +{item.record.points_earned} {t('common.points', '积分')}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-gray-900">
            <Lock className="h-5 w-5 text-gray-500" />
            {t('achievements.locked.title', '待解锁徽章')}
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            {t('achievements.locked.description', '完成更多环保行动来解锁这些徽章。')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, idx) => (
                <Skeleton key={idx} className="h-28 rounded-lg" />
              ))}
            </div>
          ) : lockedBadges.length === 0 ? (
            <div className="text-sm text-gray-500 bg-green-50 border border-green-100 rounded-md p-6 text-center">
              {t('achievements.locked.empty', '太棒了，您已经解锁了所有徽章！')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {lockedBadges.map((badge) => {
                const badgeImage = resolveBadgeImage(badge);
                return (
                  <div key={badge.id || badge.badge_id}
                    className="border rounded-lg p-4 bg-gray-50 hover:bg-gray-100 transition"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-14 h-14 rounded-full border border-dashed border-gray-300 bg-white flex items-center justify-center overflow-hidden">
                        {badgeImage.src || badgeImage.filePath ? (
                          <R2Image
                            src={badgeImage.src || undefined}
                            filePath={badgeImage.filePath || undefined}
                            alt={badge.name_zh || badge.name_en || badge.name || 'badge-icon'}
                            className="w-full h-full object-cover opacity-60"
                            expiresIn={TEN_MINUTES}
                          />
                        ) : (
                          <Lock className="h-6 w-6 text-gray-300" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-800">
                          {badge.name_zh || badge.name_en || badge.name || t('achievements.labels.unnamedBadge', '未命名徽章')}
                        </div>
                        <div className="text-xs text-gray-500">{badge.name_en}</div>
                      </div>
                    </div>
                    {badge.description_zh || badge.description_en ? (
                      <p className="text-sm text-gray-600 mt-3">
                        {badge.description_zh || badge.description_en}
                      </p>
                    ) : null}
                    {badge.auto_grant_criteria_description ? (
                      <p className="text-xs text-gray-500 mt-2">
                        {t('achievements.locked.requirements', '解锁条件')}: {badge.auto_grant_criteria_description}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2 text-gray-900">
            <Sparkles className="h-5 w-5 text-purple-500" />
            {t('achievements.timeline.title', '成就时间线')}
          </CardTitle>
          <CardDescription className="text-sm text-gray-500">
            {t('achievements.timeline.description', '回顾每一次重要的成就时刻。')}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((_, idx) => (
                <Skeleton key={idx} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : timeline.length === 0 ? (
            <div className="text-sm text-gray-500 bg-gray-50 border rounded-md p-6 text-center">
              {t('achievements.timeline.empty', '暂时还没有成就记录，先去完成一些环保行动吧。')}
            </div>
          ) : (
            <ol className="relative border-l border-gray-200 pl-6 space-y-6">
              {timeline.map((item) => {
                const badge = item.badge || {};
                const badgeImage = resolveBadgeImage(badge);
                return (
                  <li key={item.id} className="relative">
                    <span className="absolute -left-[11px] top-1 flex h-5 w-5 items-center justify-center rounded-full bg-white border border-green-400">
                      <Sparkles className="h-3 w-3 text-green-500" />
                    </span>
                    <div className="bg-white border rounded-lg p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="w-12 h-12 rounded-full overflow-hidden border bg-white flex items-center justify-center">
                          {badgeImage.src || badgeImage.filePath ? (
                            <R2Image
                              src={badgeImage.src || undefined}
                              filePath={badgeImage.filePath || undefined}
                              alt={badge.name_zh || badge.name_en || badge.name || 'badge-icon'}
                              className="w-full h-full object-cover"
                              expiresIn={TEN_MINUTES}
                            />
                          ) : (
                            <Award className="h-5 w-5 text-yellow-500" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold text-gray-900">
                              {badge.name_zh || badge.name_en || badge.name || t('achievements.labels.unnamedBadge', '未命名徽章')}
                            </div>
                            <div className="text-xs text-gray-500">
                              {formatDateSafe(item.awardedAt, 'yyyy-MM-dd HH:mm')}
                            </div>
                          </div>
                          {item.points ? (
                            <div className="text-xs text-blue-600">
                              +{formatNumber(item.points, 0)} {t('common.points', '积分')}
                            </div>
                          ) : null}
                          {item.description ? (
                            <p className="text-sm text-gray-600 leading-relaxed">
                              {item.description}
                            </p>
                          ) : null}
                        </div>
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>
          )}
        </CardContent>
      </Card>

      {statsData && (statsData.monthly_achievements || statsData.leaderboard) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.isArray(statsData.monthly_achievements) && statsData.monthly_achievements.length > 0 && (
            <Card className="bg-gradient-to-r from-yellow-50 via-orange-50 to-pink-50 border-yellow-100">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-yellow-800">
                  <Award className="h-5 w-5" />
                  {t('dashboard.monthlyAchievements', '本月成就')}
                </CardTitle>
                <CardDescription className="text-sm text-yellow-700">
                  {t('achievements.monthly.description', '本月新增的徽章与积分奖励。')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {statsData.monthly_achievements.map((achievement, idx) => (
                  <div key={`${achievement.id || idx}`}
                    className="flex items-center gap-3 text-sm text-yellow-800"
                  >
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="flex-1">
                      {achievement.name || achievement.title || ''}
                    </span>
                    {achievement.points ? (
                      <span className="font-semibold text-yellow-700">+{achievement.points} {t('common.points', '积分')}</span>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {Array.isArray(statsData.leaderboard) && statsData.leaderboard.length > 0 && (
            <Card className="bg-gradient-to-r from-blue-50 via-indigo-50 to-purple-50 border-blue-100">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-blue-900">
                  <Trophy className="h-5 w-5" />
                  {t('dashboard.leaderboard', '排行榜')}
                </CardTitle>
                <CardDescription className="text-sm text-blue-800">
                  {t('achievements.leaderboard.description', '看看社区中的优秀环保达人。')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {statsData.leaderboard.slice(0, 5).map((leader, index) => (
                  <div key={leader.id || index} className="flex items-center gap-3 text-sm text-blue-900">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0
                        ? 'bg-yellow-500 text-white'
                        : index === 1
                        ? 'bg-gray-400 text-white'
                        : index === 2
                        ? 'bg-orange-500 text-white'
                        : 'bg-blue-200 text-blue-900'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="flex-1 truncate">{leader.username || leader.name}</span>
                    {leader.total_points ? (
                      <span className="text-xs font-medium text-blue-800">{leader.total_points} {t('common.points', '积分')}</span>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
  );
}
