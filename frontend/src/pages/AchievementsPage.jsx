import Silian_React, { useCallback as Silian_useCallback, useMemo as Silian_useMemo } from 'react';
import { useQuery as Silian_useQuery } from 'react-query';
import { Award as Silian_Award, Lock as Silian_Lock, RefreshCw as Silian_RefreshCw, Sparkles as Silian_Sparkles, CalendarDays as Silian_CalendarDays, Trophy as Silian_Trophy } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { badgeAPI as Silian_badgeAPI, carbonAPI as Silian_carbonAPI } from '../lib/api';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../components/ui/Card';
import { Button as Silian_Button } from '../components/ui/Button';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription } from '../components/ui/Alert';
import { Skeleton as Silian_Skeleton } from '../components/ui/skeleton';
import Silian_R2Image from '../components/common/R2Image';
import { resolveR2ImageSource as Silian_resolveR2ImageSource } from '../lib/r2Image';
import { formatNumber as Silian_formatNumber, formatDateSafe as Silian_formatDateSafe, parseDateFlexible as Silian_parseDateFlexible } from '../lib/utils';

const Silian_TEN_MINUTES = 600;

const Silian_normalizeBadgeId = (Silian_value) => {
  if (Silian_value === undefined || Silian_value === null) {
    return null;
  }
  return String(Silian_value);
};

const Silian_resolveBadgeImage = (Silian_badge = {}) => Silian_resolveR2ImageSource({
  urlCandidates: [Silian_badge.icon_url, Silian_badge.icon_presigned_url],
  pathCandidates: [Silian_badge.icon_path, Silian_badge.icon_thumbnail_path],
});

export default function AchievementsPage() {
  const { t: Silian_t } = Silian_useTranslation(['achievements', 'common', 'dashboard']);

  const {
    data: Silian_badgeListData,
    isLoading: Silian_badgesLoading,
    isFetching: Silian_badgesFetching,
    error: Silian_badgesError,
    refetch: Silian_refetchBadges
  } = Silian_useQuery(
    ['badges', 'all'],
    async () => {
      const Silian_response = await Silian_badgeAPI.list({ include_inactive: true });
      if (!Silian_response.data?.success) {
        throw new Error(Silian_response.data?.message || Silian_t('achievements.loadError'));
      }
      return Array.isArray(Silian_response.data.data) ? Silian_response.data.data : [];
    },
    {
      staleTime: Silian_TEN_MINUTES * 1000,
    }
  );

  const {
    data: Silian_myBadgesData,
    isLoading: Silian_myBadgesLoading,
    isFetching: Silian_myBadgesFetching,
    error: Silian_myBadgesError,
    refetch: Silian_refetchMyBadges
  } = Silian_useQuery(
    ['badges', 'mine'],
    async () => {
      const Silian_response = await Silian_badgeAPI.myBadges();
      if (!Silian_response.data?.success) {
        throw new Error(Silian_response.data?.message || Silian_t('achievements.loadError'));
      }
      return Array.isArray(Silian_response.data.data) ? Silian_response.data.data : [];
    },
    {
      staleTime: Silian_TEN_MINUTES * 1000,
    }
  );

  const {
    data: Silian_statsData,
    isLoading: Silian_statsLoading,
    isFetching: Silian_statsFetching,
    error: Silian_statsError,
    refetch: Silian_refetchStats
  } = Silian_useQuery(
    ['user', 'stats', 'achievements'],
    async () => {
      const Silian_response = await Silian_carbonAPI.getUserStats();
      if (!Silian_response.data?.success) {
        throw new Error(Silian_response.data?.message || Silian_t('achievements.loadError'));
      }
      return Silian_response.data.data || {};
    },
    {
      staleTime: Silian_TEN_MINUTES * 1000,
    }
  );

  const Silian_badges = Silian_useMemo(() => (
    Array.isArray(Silian_badgeListData) ? Silian_badgeListData : []
  ), [Silian_badgeListData]);
  const Silian_rawUserBadges = Silian_useMemo(() => (
    Array.isArray(Silian_myBadgesData) ? Silian_myBadgesData : []
  ), [Silian_myBadgesData]);

  const Silian_badgesById = Silian_useMemo(() => {
    const Silian_map = new Map();
    Silian_badges.forEach((Silian_badge) => {
      const Silian_key = Silian_normalizeBadgeId(Silian_badge?.id ?? Silian_badge?.badge_id);
      if (Silian_key) {
        Silian_map.set(Silian_key, Silian_badge);
      }
    });
    return Silian_map;
  }, [Silian_badges]);

  const Silian_userBadgeRecords = Silian_useMemo(() => {
    const Silian_seenLatest = new Map();
    const Silian_entries = [];

    Silian_rawUserBadges.forEach((Silian_entry) => {
      if (!Silian_entry) return;
      const Silian_record = Silian_entry.user_badge || Silian_entry;
      if (!Silian_record) return;
      const Silian_badgeData = Silian_entry.badge || Silian_record.badge || null;
      const Silian_badgeId = Silian_normalizeBadgeId(Silian_record.badge_id ?? Silian_badgeData?.id ?? Silian_entry.badge_id);
      if (!Silian_badgeId) return;
      const Silian_awardedAt = Silian_record.awarded_at || Silian_record.created_at || Silian_record.updated_at || null;
      const Silian_normalized = {
        badgeId: Silian_badgeId,
        record: Silian_record,
        badge: Silian_badgeData || Silian_badgesById.get(Silian_badgeId) || null,
        awardedAt: Silian_awardedAt,
        progress: Silian_record.progress ?? null,
        status: Silian_record.status || 'unlocked',
        entry: Silian_entry
      };
      Silian_entries.push(Silian_normalized);

      const Silian_existing = Silian_seenLatest.get(Silian_badgeId);
      if (Silian_existing) {
        const Silian_existingDate = Silian_parseDateFlexible(Silian_existing.awardedAt) || new Date(0);
        const Silian_currentDate = Silian_parseDateFlexible(Silian_awardedAt) || new Date(0);
        if (Silian_currentDate > Silian_existingDate) {
          Silian_seenLatest.set(Silian_badgeId, Silian_normalized);
        }
      } else {
        Silian_seenLatest.set(Silian_badgeId, Silian_normalized);
      }
    });

    return {
      entries: Silian_entries,
      latest: Silian_seenLatest
    };
  }, [Silian_rawUserBadges, Silian_badgesById]);

  const Silian_unlockedLatest = Silian_userBadgeRecords.latest;
  const Silian_unlockedBadges = Silian_useMemo(() => {
    return Array.from(Silian_unlockedLatest.values())
      .map((Silian_item) => ({
        ...Silian_item,
        badge: Silian_item.badge || Silian_badgesById.get(Silian_item.badgeId) || null,
      }))
      .sort((Silian_a, Silian_b) => {
        const Silian_aDate = Silian_parseDateFlexible(Silian_a.awardedAt) || new Date(0);
        const Silian_bDate = Silian_parseDateFlexible(Silian_b.awardedAt) || new Date(0);
        return Silian_bDate.getTime() - Silian_aDate.getTime();
      });
  }, [Silian_unlockedLatest, Silian_badgesById]);

  const Silian_lockedBadges = Silian_useMemo(() => {
    return Silian_badges.filter((Silian_badge) => {
      const Silian_key = Silian_normalizeBadgeId(Silian_badge?.id ?? Silian_badge?.badge_id);
      if (!Silian_key) return false;
      return !Silian_unlockedLatest.has(Silian_key) && Silian_badge?.is_deleted !== true;
    });
  }, [Silian_badges, Silian_unlockedLatest]);

  const Silian_timeline = Silian_useMemo(() => {
    return Silian_userBadgeRecords.entries
      .map((Silian_item, Silian_index) => ({
        id: `${Silian_item.badgeId}-${Silian_item.awardedAt || Silian_index}`,
        badge: Silian_item.badge || Silian_badgesById.get(Silian_item.badgeId) || null,
        awardedAt: Silian_item.awardedAt,
        points: Silian_item.record?.points_earned ?? Silian_item.entry?.points ?? Silian_item.badge?.points ?? null,
        description: Silian_item.record?.notes || Silian_item.record?.description || Silian_item.badge?.description || '',
      }))
      .filter((Silian_item) => Silian_item.awardedAt)
      .sort((Silian_a, Silian_b) => {
        const Silian_aDate = Silian_parseDateFlexible(Silian_a.awardedAt) || new Date(0);
        const Silian_bDate = Silian_parseDateFlexible(Silian_b.awardedAt) || new Date(0);
        return Silian_bDate.getTime() - Silian_aDate.getTime();
      });
  }, [Silian_userBadgeRecords.entries, Silian_badgesById]);

  const Silian_totalBadges = Silian_badges.length;
  const Silian_unlockedCount = Silian_unlockedLatest.size;
  const Silian_lockedCount = Silian_totalBadges - Silian_unlockedCount;
  const Silian_completion = Silian_totalBadges > 0 ? Math.round((Silian_unlockedCount / Silian_totalBadges) * 100) : 0;

  const Silian_totalPointsFromBadges = Silian_useMemo(() => {
    return Silian_unlockedBadges.reduce((Silian_sum, Silian_item) => {
      const Silian_points = Number(Silian_item.record?.points_earned ?? Silian_item.badge?.points ?? 0);
      return Silian_sum + (Number.isFinite(Silian_points) ? Silian_points : 0);
    }, 0);
  }, [Silian_unlockedBadges]);

  const Silian_isLoading = Silian_badgesLoading || Silian_myBadgesLoading || Silian_statsLoading;
  const Silian_isFetching = Silian_badgesFetching || Silian_myBadgesFetching || Silian_statsFetching;
  const Silian_error = Silian_badgesError || Silian_myBadgesError || Silian_statsError;

  const Silian_handleRefresh = Silian_useCallback(async () => {
    await Promise.all([Silian_refetchBadges(), Silian_refetchMyBadges(), Silian_refetchStats()]);
  }, [Silian_refetchBadges, Silian_refetchMyBadges, Silian_refetchStats]);

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-0 right-1/4 -z-10 h-[500px] w-[500px] blur-[120px] bg-gradient-to-bl from-amber-50/50 via-orange-50/30 to-transparent opacity-50 dark:from-amber-900/20 dark:via-orange-900/10 dark:opacity-30 pointer-events-none" />

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8 relative">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2 bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60">
              <Silian_Trophy className="h-8 w-8 text-yellow-500" />
              {Silian_t('achievements.title')}
            </h1>
            <p className="text-muted-foreground mt-2">
              {Silian_t('achievements.subtitle')}
            </p>
          </div>
        <Silian_Button variant="outline" onClick={Silian_handleRefresh} disabled={Silian_isFetching} className="self-start md:self-auto">
          <Silian_RefreshCw className={`h-4 w-4 mr-2 ${Silian_isFetching ? 'animate-spin' : ''}`} />
          {Silian_t('achievements.refresh')}
        </Silian_Button>
      </div>

      {Silian_error && (
        <Silian_Alert variant="destructive">
          <Silian_AlertDescription>
            {Silian_error.message || Silian_t('achievements.loadError')}
          </Silian_AlertDescription>
        </Silian_Alert>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Silian_Card>
          <Silian_CardHeader className="flex flex-row items-center justify-between pb-2">
            <Silian_CardTitle className="text-sm font-medium text-muted-foreground">{Silian_t('achievements.summary.totalBadges')}</Silian_CardTitle>
            <Silian_Award className="h-4 w-4 text-yellow-500" />
          </Silian_CardHeader>
          <Silian_CardContent>
            {Silian_isLoading ? (
              <Silian_Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold">{Silian_totalBadges}</div>
            )}
            <Silian_CardDescription className="text-xs text-muted-foreground mt-1">
              {Silian_t('achievements.summary.totalBadgesHint')}
            </Silian_CardDescription>
          </Silian_CardContent>
        </Silian_Card>

        <Silian_Card>
          <Silian_CardHeader className="flex flex-row items-center justify-between pb-2">
            <Silian_CardTitle className="text-sm font-medium text-muted-foreground">{Silian_t('achievements.summary.unlocked')}</Silian_CardTitle>
            <Silian_Sparkles className="h-4 w-4 text-green-500" />
          </Silian_CardHeader>
          <Silian_CardContent>
            {Silian_isLoading ? (
              <Silian_Skeleton className="h-7 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">{Silian_unlockedCount}</div>
                {Silian_totalPointsFromBadges > 0 && (
                  <p className="text-xs text-green-600 mt-2">
                    {Silian_t('achievements.summary.pointsFromBadges',  {
                      points: Silian_formatNumber(Silian_totalPointsFromBadges, 0),
                    })}
                  </p>
                )}
              </>
            )}
            <Silian_CardDescription className="text-xs text-muted-foreground mt-1">
              {Silian_t('achievements.summary.unlockedHint')}
            </Silian_CardDescription>
          </Silian_CardContent>
        </Silian_Card>

        <Silian_Card>
          <Silian_CardHeader className="flex flex-row items-center justify-between pb-2">
            <Silian_CardTitle className="text-sm font-medium text-muted-foreground">{Silian_t('achievements.summary.locked')}</Silian_CardTitle>
            <Silian_Lock className="h-4 w-4 text-muted-foreground" />
          </Silian_CardHeader>
          <Silian_CardContent>
            {Silian_isLoading ? (
              <Silian_Skeleton className="h-7 w-20" />
            ) : (
              <div className="text-2xl font-bold text-foreground/80">{Math.max(Silian_lockedCount, 0)}</div>
            )}
            <Silian_CardDescription className="text-xs text-muted-foreground mt-1">
              {Silian_t('achievements.summary.lockedHint')}
            </Silian_CardDescription>
          </Silian_CardContent>
        </Silian_Card>

        <Silian_Card>
          <Silian_CardHeader className="flex flex-row items-center justify-between pb-2">
            <Silian_CardTitle className="text-sm font-medium text-muted-foreground">{Silian_t('achievements.summary.completion')}</Silian_CardTitle>
            <Silian_CalendarDays className="h-4 w-4 text-blue-500" />
          </Silian_CardHeader>
          <Silian_CardContent>
            {Silian_isLoading ? (
              <Silian_Skeleton className="h-7 w-24" />
            ) : (
              <div className="text-2xl font-bold text-blue-600">{Silian_completion}%</div>
            )}
            <Silian_CardDescription className="text-xs text-muted-foreground mt-1">
              {Silian_t('achievements.summary.completionHint')}
            </Silian_CardDescription>
          </Silian_CardContent>
        </Silian_Card>
      </div>

      <Silian_Card>
        <Silian_CardHeader className="pb-4">
          <Silian_CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Silian_Award className="h-5 w-5 text-yellow-500" />
            {Silian_t('achievements.unlocked.title')}
          </Silian_CardTitle>
          <Silian_CardDescription className="text-sm text-muted-foreground">
            {Silian_t('achievements.unlocked.description')}
          </Silian_CardDescription>
        </Silian_CardHeader>
        <Silian_CardContent>
          {Silian_isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((Silian__, Silian_idx) => (
                <Silian_Skeleton key={Silian_idx} className="h-28 rounded-lg" />
              ))}
            </div>
          ) : Silian_unlockedBadges.length === 0 ? (
            <div className="bg-muted/60 border rounded-md p-6 text-center text-sm text-muted-foreground">
              {Silian_t('achievements.unlocked.empty')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Silian_unlockedBadges.map((Silian_item) => {
                const Silian_badge = Silian_item.badge || {};
                const Silian_badgeImage = Silian_resolveBadgeImage(Silian_badge);
                return (
                  <div
                    key={Silian_item.badgeId}
                    className="bg-card border rounded-lg p-4 flex gap-4 transition hover:shadow-md"
                  >
                    <div className="bg-background w-16 h-16 rounded-full border flex items-center justify-center overflow-hidden">
                      {Silian_badgeImage.src || Silian_badgeImage.filePath ? (
                        <Silian_R2Image
                          src={Silian_badgeImage.src || undefined}
                          filePath={Silian_badgeImage.filePath || undefined}
                          alt={Silian_badge.name_zh || Silian_badge.name_en || Silian_badge.name || 'badge-icon'}
                          className="w-full h-full object-cover"
                          expiresIn={Silian_TEN_MINUTES}
                        />
                      ) : (
                        <Silian_Award className="h-8 w-8 text-yellow-500" />
                      )}
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="text-base font-semibold">
                        {Silian_badge.name_zh || Silian_badge.name_en || Silian_badge.name || Silian_t('achievements.labels.unnamedBadge')}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {Silian_badge.name_en}
                      </div>
                      {Silian_item.awardedAt && (
                        <div className="text-xs text-green-600">
                          {Silian_t('achievements.unlocked.awardedAt')}: {Silian_formatDateSafe(Silian_item.awardedAt, 'yyyy-MM-dd HH:mm')}
                        </div>
                      )}
                      {Silian_badge.description_zh || Silian_badge.description_en ? (
                        <p className="text-sm text-muted-foreground mt-1">
                          {Silian_badge.description_zh || Silian_badge.description_en}
                        </p>
                      ) : null}
                      {Silian_item.record?.points_earned ? (
                        <div className="text-xs text-blue-600">
                          +{Silian_item.record.points_earned} {Silian_t('common.points')}
                        </div>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Silian_CardContent>
      </Silian_Card>

      <Silian_Card>
        <Silian_CardHeader className="pb-4">
          <Silian_CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Silian_Lock className="h-5 w-5 text-muted-foreground" />
            {Silian_t('achievements.locked.title')}
          </Silian_CardTitle>
          <Silian_CardDescription className="text-sm text-muted-foreground">
            {Silian_t('achievements.locked.description')}
          </Silian_CardDescription>
        </Silian_CardHeader>
        <Silian_CardContent>
          {Silian_isLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((Silian__, Silian_idx) => (
                <Silian_Skeleton key={Silian_idx} className="h-28 rounded-lg" />
              ))}
            </div>
          ) : Silian_lockedBadges.length === 0 ? (
            <div className="border border-green-200/60 bg-green-500/10 rounded-md p-6 text-center text-sm text-muted-foreground">
              {Silian_t('achievements.locked.empty')}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Silian_lockedBadges.map((Silian_badge) => {
                const Silian_badgeImage = Silian_resolveBadgeImage(Silian_badge);
                return (
                  <div key={Silian_badge.id || Silian_badge.badge_id}
                    className="bg-muted/50 border rounded-lg p-4 transition hover:bg-muted"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-background w-14 h-14 rounded-full border border-dashed border-border flex items-center justify-center overflow-hidden">
                        {Silian_badgeImage.src || Silian_badgeImage.filePath ? (
                          <Silian_R2Image
                            src={Silian_badgeImage.src || undefined}
                            filePath={Silian_badgeImage.filePath || undefined}
                            alt={Silian_badge.name_zh || Silian_badge.name_en || Silian_badge.name || 'badge-icon'}
                            className="w-full h-full object-cover opacity-60"
                            expiresIn={Silian_TEN_MINUTES}
                          />
                        ) : (
                          <Silian_Lock className="h-6 w-6 text-muted-foreground/50" />
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold">
                          {Silian_badge.name_zh || Silian_badge.name_en || Silian_badge.name || Silian_t('achievements.labels.unnamedBadge')}
                        </div>
                        <div className="text-xs text-muted-foreground">{Silian_badge.name_en}</div>
                      </div>
                    </div>
                    {Silian_badge.description_zh || Silian_badge.description_en ? (
                      <p className="text-sm text-muted-foreground mt-3">
                        {Silian_badge.description_zh || Silian_badge.description_en}
                      </p>
                    ) : null}
                    {Silian_badge.auto_grant_criteria_description ? (
                      <p className="text-xs text-muted-foreground mt-2">
                        {Silian_t('achievements.locked.requirements')}: {Silian_badge.auto_grant_criteria_description}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </Silian_CardContent>
      </Silian_Card>

      <Silian_Card>
        <Silian_CardHeader className="pb-4">
          <Silian_CardTitle className="text-lg font-semibold flex items-center gap-2">
            <Silian_Sparkles className="h-5 w-5 text-purple-500" />
            {Silian_t('achievements.timeline.title')}
          </Silian_CardTitle>
          <Silian_CardDescription className="text-sm text-muted-foreground">
            {Silian_t('achievements.timeline.description')}
          </Silian_CardDescription>
        </Silian_CardHeader>
        <Silian_CardContent>
          {Silian_isLoading ? (
            <div className="space-y-4">
              {Array.from({ length: 4 }).map((Silian__, Silian_idx) => (
                <Silian_Skeleton key={Silian_idx} className="h-20 rounded-lg" />
              ))}
            </div>
          ) : Silian_timeline.length === 0 ? (
            <div className="bg-muted/60 border rounded-md p-6 text-center text-sm text-muted-foreground">
              {Silian_t('achievements.timeline.empty')}
            </div>
          ) : (
            <ol className="relative border-l border-border pl-6 space-y-6">
              {Silian_timeline.map((Silian_item) => {
                const Silian_badge = Silian_item.badge || {};
                const Silian_badgeImage = Silian_resolveBadgeImage(Silian_badge);
                return (
                  <li key={Silian_item.id} className="relative">
                    <span className="bg-background absolute -left-[11px] top-1 flex h-5 w-5 items-center justify-center rounded-full border border-green-400">
                      <Silian_Sparkles className="h-3 w-3 text-green-500" />
                    </span>
                    <div className="bg-card border rounded-lg p-4 shadow-sm">
                      <div className="flex items-start gap-3">
                        <div className="bg-background w-12 h-12 rounded-full overflow-hidden border flex items-center justify-center">
                          {Silian_badgeImage.src || Silian_badgeImage.filePath ? (
                            <Silian_R2Image
                              src={Silian_badgeImage.src || undefined}
                              filePath={Silian_badgeImage.filePath || undefined}
                              alt={Silian_badge.name_zh || Silian_badge.name_en || Silian_badge.name || 'badge-icon'}
                              className="w-full h-full object-cover"
                              expiresIn={Silian_TEN_MINUTES}
                            />
                          ) : (
                            <Silian_Award className="h-5 w-5 text-yellow-500" />
                          )}
                        </div>
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center justify-between gap-2">
                            <div className="font-semibold">
                              {Silian_badge.name_zh || Silian_badge.name_en || Silian_badge.name || Silian_t('achievements.labels.unnamedBadge')}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {Silian_formatDateSafe(Silian_item.awardedAt, 'yyyy-MM-dd HH:mm')}
                            </div>
                          </div>
                          {Silian_item.points ? (
                            <div className="text-xs text-blue-600">
                              +{Silian_formatNumber(Silian_item.points, 0)} {Silian_t('common.points')}
                            </div>
                          ) : null}
                          {Silian_item.description ? (
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {Silian_item.description}
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
        </Silian_CardContent>
      </Silian_Card>

      {Silian_statsData && (Silian_statsData.monthly_achievements || Silian_statsData.leaderboard) && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.isArray(Silian_statsData.monthly_achievements) && Silian_statsData.monthly_achievements.length > 0 && (
            <Silian_Card className="border-yellow-500/20 bg-gradient-to-r from-yellow-500/10 via-orange-500/10 to-pink-500/10">
              <Silian_CardHeader className="pb-4">
                <Silian_CardTitle className="flex items-center gap-2 text-yellow-500">
                  <Silian_Award className="h-5 w-5" />
                  {Silian_t('dashboard.monthlyAchievements')}
                </Silian_CardTitle>
                <Silian_CardDescription className="text-sm text-yellow-400">
                  {Silian_t('achievements.monthly.description')}
                </Silian_CardDescription>
              </Silian_CardHeader>
              <Silian_CardContent className="space-y-3">
                {Silian_statsData.monthly_achievements.map((Silian_achievement, Silian_idx) => (
                  <div key={`${Silian_achievement.id || Silian_idx}`}
                    className="flex items-center gap-3 text-sm text-foreground"
                  >
                    <span className="w-2 h-2 rounded-full bg-yellow-500" />
                    <span className="flex-1">
                      {Silian_achievement.name || Silian_achievement.title || ''}
                    </span>
                    {Silian_achievement.points ? (
                      <span className="font-semibold text-yellow-500">+{Silian_achievement.points} {Silian_t('common.points')}</span>
                    ) : null}
                  </div>
                ))}
              </Silian_CardContent>
            </Silian_Card>
          )}

          {Array.isArray(Silian_statsData.leaderboard) && Silian_statsData.leaderboard.length > 0 && (
            <Silian_Card className="border-blue-500/20 bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-purple-500/10">
              <Silian_CardHeader className="pb-4">
                <Silian_CardTitle className="flex items-center gap-2 text-blue-500">
                  <Silian_Trophy className="h-5 w-5" />
                  {Silian_t('dashboard.leaderboard')}
                </Silian_CardTitle>
                <Silian_CardDescription className="text-sm text-blue-400">
                  {Silian_t('achievements.leaderboard.description')}
                </Silian_CardDescription>
              </Silian_CardHeader>
              <Silian_CardContent className="space-y-3">
                {Silian_statsData.leaderboard.slice(0, 5).map((Silian_leader, Silian_index) => (
                  <div key={Silian_leader.id || Silian_index} className="flex items-center gap-3 text-sm text-foreground">
                    <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold ${
                      Silian_index === 0
                        ? 'bg-yellow-500 text-white'
                        : Silian_index === 1
                        ? 'bg-zinc-500 text-white'
                        : Silian_index === 2
                        ? 'bg-orange-500 text-white'
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {Silian_index + 1}
                    </div>
                    <span className="flex-1 truncate">{Silian_leader.username || Silian_leader.name}</span>
                    {Silian_leader.total_points ? (
                      <span className="text-xs font-medium text-blue-400">{Silian_leader.total_points} {Silian_t('common.points')}</span>
                    ) : null}
                  </div>
                ))}
              </Silian_CardContent>
            </Silian_Card>
          )}
        </div>
      )}
    </div>
    </div>
  );
}
