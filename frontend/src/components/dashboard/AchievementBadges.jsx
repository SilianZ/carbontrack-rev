import Silian_React from 'react';
import { Award as Silian_Award, Lock as Silian_Lock, RefreshCw as Silian_RefreshCw } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import Silian_R2Image from '../common/R2Image';
import { Button as Silian_Button } from '../ui/Button';
import { resolveR2ImageSource as Silian_resolveR2ImageSource } from '../../lib/r2Image';

export function AchievementBadges({ badges: Silian_badges = [], userBadges: Silian_userBadges = [], loading: Silian_loading = false, onTriggerAuto: Silian_onTriggerAuto, isAdmin: Silian_isAdmin = false }) {
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['dashboard']);
  const Silian_isChineseLocale = Silian_currentLanguage?.toLowerCase().startsWith('zh');
  const Silian_ownedMap = new Map();
  Silian_userBadges.forEach((Silian_entry) => {
    const Silian_record = Silian_entry?.user_badge || {};
    if (Silian_record.badge_id) {
      Silian_ownedMap.set(Silian_record.badge_id, Silian_record);
    }
  });

  const Silian_ownedCount = Silian_ownedMap.size;
  const Silian_totalCount = Silian_badges.length;
  const Silian_completion = Silian_totalCount > 0 ? Math.round((Silian_ownedCount / Silian_totalCount) * 100) : 0;
  const Silian_topBadges = Silian_badges.slice(0, 8);
  const Silian_getBadgeName = (Silian_badge) => {
    if (Silian_isChineseLocale) {
      return Silian_badge.name_zh || Silian_badge.name_en || Silian_t('dashboard.leaderboardUnknownName');
    }
    return Silian_badge.name_en || Silian_badge.name_zh || Silian_t('dashboard.leaderboardUnknownName');
  };

  return (
    <div className="rounded-lg border border-border/80 bg-card/95 p-6 shadow-sm">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Silian_Award className="h-5 w-5 text-yellow-500" />
            {Silian_t('dashboard.achievementBadges')}
          </h3>
          <p className="text-sm text-muted-foreground">
            {Silian_totalCount > 0
              ? Silian_t('dashboard.badgeProgress',  { owned: Silian_ownedCount, total: Silian_totalCount })
              : Silian_t('dashboard.noBadgesAvailable')}
          </p>
        </div>
        {Silian_isAdmin && (
          <Silian_Button
            variant="outline"
            size="sm"
            onClick={Silian_onTriggerAuto}
            disabled={Silian_loading}
            className="flex items-center gap-2"
          >
            <Silian_RefreshCw className={`h-4 w-4 ${Silian_loading ? 'animate-spin' : ''}`} />
            {Silian_t('dashboard.triggerBadgeAuto')}
          </Silian_Button>
        )}
      </div>

      {Silian_loading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((Silian__, Silian_idx) => (
            <div key={Silian_idx} className="aspect-square animate-pulse rounded-lg bg-muted" />
          ))}
        </div>
      ) : Silian_totalCount === 0 ? (
        <div className="rounded-md bg-muted/60 p-4 text-center text-sm text-muted-foreground">
          {Silian_t('dashboard.noBadgesHint')}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full bg-gradient-to-r from-green-500 to-emerald-400"
              style={{ width: `${Silian_completion}%` }}
            ></div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {Silian_topBadges.map((Silian_badge) => {
              const Silian_owned = Silian_ownedMap.has(Silian_badge.id);
              const Silian_userBadge = Silian_ownedMap.get(Silian_badge.id);
              const Silian_badgeImage = Silian_resolveR2ImageSource({
                urlCandidates: [Silian_badge.icon_url, Silian_badge.icon_presigned_url],
                pathCandidates: [Silian_badge.icon_path],
              });
              return (
                <div
                  key={Silian_badge.id}
                  className={`relative flex flex-col items-center gap-3 rounded-lg border p-3 transition ${
                    Silian_owned ? 'border-green-500/70 bg-green-500/5 shadow-md' : 'border-border bg-background/50 hover:border-border/80'
                  }`}
                >
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full border border-border bg-muted/50">
                    {Silian_badgeImage.src || Silian_badgeImage.filePath ? (
                      <Silian_R2Image
                        src={Silian_badgeImage.src || undefined}
                        filePath={Silian_badgeImage.filePath || undefined}
                        alt={Silian_getBadgeName(Silian_badge) || Silian_t('dashboard.badgeImageAlt')}
                        className="w-full h-full object-cover"
                        fallback={<div className="text-xs text-muted-foreground">{Silian_t('dashboard.imageFallback')}</div>}
                      />
                    ) : (
                      <Silian_Award className="h-8 w-8 text-muted-foreground/60" />
                    )}
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-foreground">{Silian_getBadgeName(Silian_badge)}</p>
                    {Silian_badge.name_zh && Silian_badge.name_en && Silian_badge.name_zh !== Silian_badge.name_en && (
                      <p className="text-xs text-muted-foreground">
                        {Silian_isChineseLocale ? Silian_badge.name_en : Silian_badge.name_zh}
                      </p>
                    )}
                  </div>
                  <div className="w-full text-center">
                    {Silian_owned ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                        <Silian_Award className="h-3 w-3" />
                        {Silian_t('dashboard.badgeUnlocked')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                        <Silian_Lock className="h-3 w-3" />
                        {Silian_t('dashboard.badgeLocked')}
                      </span>
                    )}
                  </div>
                  {Silian_owned && Silian_userBadge?.awarded_at && (
                    <p className="text-[11px] text-muted-foreground">
                      {Silian_t('dashboard.badgeAwardedAtValue', {
                        date: new Intl.DateTimeFormat(Silian_currentLanguage).format(new Date(Silian_userBadge.awarded_at)),
                      })}
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
