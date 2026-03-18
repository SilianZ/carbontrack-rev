import React from 'react';
import { Award, Lock, RefreshCw } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import R2Image from '../common/R2Image';
import { Button } from '../ui/Button';
import { resolveR2ImageSource } from '../../lib/r2Image';

export function AchievementBadges({ badges = [], userBadges = [], loading = false, onTriggerAuto, isAdmin = false }) {
  const { t } = useTranslation();
  const ownedMap = new Map();
  userBadges.forEach((entry) => {
    const record = entry?.user_badge || {};
    if (record.badge_id) {
      ownedMap.set(record.badge_id, record);
    }
  });

  const ownedCount = ownedMap.size;
  const totalCount = badges.length;
  const completion = totalCount > 0 ? Math.round((ownedCount / totalCount) * 100) : 0;
  const topBadges = badges.slice(0, 8);

  return (
    <div className="rounded-lg border border-border/80 bg-card/95 p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            {t('dashboard.achievementBadges')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {totalCount > 0
              ? t('dashboard.badgeProgress',  { owned: ownedCount, total: totalCount })
              : t('dashboard.noBadgesAvailable')}
          </p>
        </div>
        {isAdmin && (
          <Button
            variant="outline"
            size="sm"
            onClick={onTriggerAuto}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            {t('dashboard.triggerBadgeAuto')}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="aspect-square animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : totalCount === 0 ? (
        <div className="rounded-md bg-muted/60 p-4 text-center text-sm text-muted-foreground">
          {t('dashboard.noBadgesHint')}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
              style={{ width: `${completion}%` }}
            ></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {topBadges.map((badge) => {
              const owned = ownedMap.has(badge.id);
              const userBadge = ownedMap.get(badge.id);
              const badgeImage = resolveR2ImageSource({
                urlCandidates: [badge.icon_url, badge.icon_presigned_url],
                pathCandidates: [badge.icon_path],
              });
              return (
                <div
                  key={badge.id}
                  className={`relative flex flex-col items-center gap-3 rounded-lg border p-3 transition ${
                    owned ? 'border-green-500/70 bg-green-500/5 shadow-md' : 'border-border bg-background/50 hover:border-border/80'
                  }`}
                >
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/50">
                    {badgeImage.src || badgeImage.filePath ? (
                      <R2Image
                        src={badgeImage.src || undefined}
                        filePath={badgeImage.filePath || undefined}
                        alt={badge.name_zh || badge.name_en}
                        className="w-full h-full object-cover"
                        fallback={<div className="text-xs text-muted-foreground">IMG</div>}
                      />
                    ) : (
                      <Award className="h-8 w-8 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-foreground">{badge.name_zh || badge.name_en}</p>
                    <p className="text-xs text-muted-foreground">{badge.name_en}</p>
                  </div>
                  <div className="w-full text-center">
                    {owned ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                        <Award className="h-3 w-3" />
                        {t('dashboard.badgeUnlocked')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Lock className="h-3 w-3" />
                        {t('dashboard.badgeLocked')}
                      </span>
                    )}
                  </div>
                  {owned && userBadge?.awarded_at && (
                    <p className="text-[11px] text-muted-foreground">
                      {t('dashboard.badgeAwardedAt')}: {new Date(userBadge.awarded_at).toLocaleDateString()}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default AchievementBadges;
