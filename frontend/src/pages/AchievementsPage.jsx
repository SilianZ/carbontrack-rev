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
        throw new Error(response.data?.message || t('achievements.loadError'));
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
        throw new Error(response.data?.message || t('achievements.loadError'));
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
        throw new Error(response.data?.message || t('achievements.loadError'));
      }
      return response.data.data || {};
    },
    {
      staleTime: TEN_MINUTES * 1000,
    }
  );

  const badges = useMemo(() => (
    Array.isArray(badgeListData) ? badgeListData : []
  ), [badgeListData]);
  const rawUserBadges = useMemo(() => (
    Array.isArray(myBadgesData) ? myBadgesData : []
  ), [myBadgesData]);

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
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-0 right-1/4 -z-10 h-[500px] w-[500px] blur-[120px] bg-gradient-to-bl from-amber-50/50 via-orange-50/30 to-transparent opacity-50 dark:from-amber-900/20 dark:via-orange-900/10 dark:opacity-30 pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8 relative">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60">
              <Trophy className="h-8 w-8 text-yellow-500" />
              {t('achievements.title')}
            </h1>
            <p className="text-muted-foreground mt-2">
              {t('achievements.subtitle')}
            </p>
          </div>
        <Button variant="outline" onClick={handleRefresh} disabled={isFetching} className="self-start md:self-auto">
          <RefreshCw className={`h-4 w-4 mr-2 ${isFetching ? 'animate-spin' : ''}`} />
          {t('achievements.refresh')}
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertDescription>
            {error.message || t('achievements.loadError')}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('achievements.summary.totalBadges')}</CardTitle>
            <Award className="h-4 w-4 text-yellow-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold">{totalBadges}</div>
            )}
            <CardDescription className="text-xs text-muted-foreground mt-1">
              {t('achievements.summary.totalBadgesHint')}
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('achievements.summary.unlocked')}</CardTitle>
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
                    {t('achievements.summary.pointsFromBadges',  {
                      points: formatNumber(totalPointsFromBadges, 0),
                    })}
                  </p>
                )}
              </>
            )}
            <CardDescription className="text-xs text-muted-foreground mt-1">
              {t('achievements.summary.unlockedHint')}
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('achievements.summary.locked')}</CardTitle>
            <Lock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold text-foreground/80">{Math.max(lockedCount, 0)}</div>
            )}
            <CardDescription className="text-xs text-muted-foreground mt-1">
              {t('achievements.summary.lockedHint')}
            </CardDescription>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{t('achievements.summary.completion')}</CardTitle>
            <CalendarDays className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-7 w-24" />
            ) : (
              <div className="text-2xl font-bold text-blue-600">{completion}%</div>
            )}
            <CardDescription className="text-xs text-muted-foreground mt-1">
              {t('achievements.summary.completionHint')}
            </CardDescription>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            {t('achievements.unlocked.title')}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {t('achievements.unlocked.description')}
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
            <div className="bg-muted/60 border rounded-md p-6 text-center text-sm text-muted-foreground">
              {t('achievements.unlocked.empty')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {unlockedBadges.map((item) => {
                const badge = item.badge || {};
                const badgeImage = resolveBadgeImage(badge);
                return (
                  <div
                    key={item.badgeId}
                    className="bg-card border rounded-lg p-4 flex gap-4 transition hover:shadow-md"
                  >
                    <div className="bg-background w-16 h-16 rounded-full border flex items-center justify-center overflow-hidden">
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
                      <div className="text-base font-semibold">
                        {badge.name_zh || badge.name_en || badge.name || t('achievements.labels.unnamedBadge')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {badge.name_en}
                      </div>
                      {item.awardedAt && (
                        <div className="text-xs text-green-600">
                          {t('achievements.unlocked.awardedAt')}: {formatDateSafe(item.awardedAt, 'yyyy-MM-dd HH:mm')}
                        </div>
                      )}
                      {badge.description_zh || badge.description_en ? (
                        <p className="text-sm text-muted-foreground mt-1">
                          {badge.description_zh || badge.description_en}
                        </p>
                      ) : null}
                      {item.record?.points_earned ? (
                        <div className="text-xs text-blue-600">
                          +{item.record.points_earned} {t('common.points')}
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
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Lock className="h-5 w-5 text-muted-foreground" />
            {t('achievements.locked.title')}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {t('achievements.locked.description')}
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
            <div className="border border-green-200/60 bg-green-500/10 rounded-md p-6 text-center text-sm text-muted-foreground">
              {t('achievements.locked.empty')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {lockedBadges.map((badge) => {
                const badgeImage = resolveBadgeImage(badge);
                return (
                  <div key={badge.id || badge.badge_id}
                    className="bg-muted/50 border rounded-lg p-4 transition hover:bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-background w-14 h-14 rounded-full border border-dashed border-border flex items-center justify-center overflow-hidden">
                        {badgeImage.src || badgeImage.filePath ? (
                          <R2Image
                            src={badgeImage.src || undefined}
                            filePath={badgeImage.filePath || undefined}
                            alt={badge.name_zh || badge.name_en || badge.name || 'badge-icon'}
                            className="w-full h-full object-cover opacity-60"
                            expiresIn={TEN_MINUTES}
                          />
                        ) : (
                          <Lock className="h-6 w-6 text-muted-foreground/50" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">
                          {badge.name_zh || badge.name_en || badge.name || t('achievements.labels.unnamedBadge')}
                        </div>
                        <div className="text-xs text-muted-foreground">{badge.name_en}</div>
                      </div>
                    </div>
                    {badge.description_zh || badge.description_en ? (
                      <p className="text-sm text-muted-foreground mt-3">
                        {badge.description_zh || badge.description_en}
                      </p>
                    ) : null}
                    {badge.auto_grant_criteria_description ? (
                      <p className="text-xs text-muted-foreground mt-2">
                        {t('achievements.locked.requirements')}: {badge.auto_grant_criteria_description}
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
          <CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-500" />
            {t('achievements.timeline.title')}
          </CardTitle>
          <CardDescription className="text-sm text-muted-foreground">
            {t('achievements.timeline.description')}
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
            <div className="bg-muted/60 border rounded-md p-6 text-center text-sm text-muted-foreground">
              {t('achievements.timeline.empty')}
            </div>
          ) : (
            <ol className="relative border-l border-border pl-6 space-y-6">
              {timeline.map((item) => {
                const badge = item.badge || {};
                const badgeImage = resolveBadgeImage(badge);
                return (
                  <li key={item.id} className="relative">
                    <span className="bg-background absolute -left-[11px] top-1 flex h-5 w-5 items-center justify-center rounded-full border border-green-400">
                      <Sparkles className="h-3 w-3 text-green-500" />
                    </span>
                    <div className="bg-card border rounded-lg p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="bg-background w-12 h-12 rounded-full overflow-hidden border flex items-center justify-center">
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
                            <div className="font-semibold">
                              {badge.name_zh || badge.name_en || badge.name || t('achievements.labels.unnamedBadge')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatDateSafe(item.awardedAt, 'yyyy-MM-dd HH:mm')}
                            </div>
                          </div>
                          {item.points ? (
                            <div className="text-xs text-blue-600">
                              +{formatNumber(item.points, 0)} {t('common.points')}
                            </div>
                          ) : null}
                          {item.description ? (
                            <p className="text-sm text-muted-foreground leading-relaxed">
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
            <Card className="border-yellow-500/20 bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-pink-500/10">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-yellow-500">
                  <Award className="h-5 w-5" />
                  {t('dashboard.monthlyAchievements')}
                </CardTitle>
                <CardDescription className="text-sm text-yellow-400">
                  {t('achievements.monthly.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {statsData.monthly_achievements.map((achievement, idx) => (
                  <div key={`${achievement.id || idx}`}
                    className="flex items-center gap-3 text-sm text-foreground"
                  >
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="flex-1">
                      {achievement.name || achievement.title || ''}
                    </span>
                    {achievement.points ? (
                      <span className="font-semibold text-yellow-500">+{achievement.points} {t('common.points')}</span>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {Array.isArray(statsData.leaderboard) && statsData.leaderboard.length > 0 && (
            <Card className="border-blue-500/20 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10">
              <CardHeader className="pb-4">
                <CardTitle className="flex items-center gap-2 text-blue-500">
                  <Trophy className="h-5 w-5" />
                  {t('dashboard.leaderboard')}
                </CardTitle>
                <CardDescription className="text-sm text-blue-400">
                  {t('achievements.leaderboard.description')}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {statsData.leaderboard.slice(0, 5).map((leader, index) => (
                  <div key={leader.id || index} className="flex items-center gap-3 text-sm text-foreground">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0
                        ? 'bg-yellow-500 text-white'
                        : index === 1
                        ? 'bg-zinc-500 text-white'
                        : index === 2
                        ? 'bg-orange-500 text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {index + 1}
                    </div>
                    <span className="flex-1 truncate">{leader.username || leader.name}</span>
                    {leader.total_points ? (
                      <span className="text-xs font-medium text-blue-400">{leader.total_points} {t('common.points')}</span>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}
    </div>
    </div>
  );
}
