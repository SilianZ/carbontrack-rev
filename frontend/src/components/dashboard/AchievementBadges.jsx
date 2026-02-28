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
    <div className="bg-white border rounded-lg shadow-sm p-6">
      <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Award className="h-5 w-5 text-yellow-500" />
            {t('dashboard.achievementBadges', '成就徽章')}
          </h3>
          <p className="text-sm text-gray-500">
            {totalCount > 0
              ? t('dashboard.badgeProgress', '{{owned}} / {{total}} 已解锁', { owned: ownedCount, total: totalCount })
              : t('dashboard.noBadgesAvailable', '暂时没有可用的成就徽章')}
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
            {t('dashboard.triggerBadgeAuto', '触发自动授予')}
          </Button>
        )}
      </div>

      {loading ? (
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, idx) => (
            <div key={idx} className="animate-pulse rounded-lg bg-gray-100 aspect-square" />
          ))}
        </div>
      ) : totalCount === 0 ? (
        <div className="text-sm text-gray-500 bg-gray-50 rounded-md p-4 text-center">
          {t('dashboard.noBadgesHint', '完成更多环保行动后，将会开放成就徽章功能。')}
        </div>
      ) : (
        <div className="space-y-4">
          <div className="w-full bg-gray-100 rounded-full h-2 overflow-hidden">
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
                  className={`relative border rounded-lg p-3 flex flex-col items-center gap-3 transition ${
                    owned ? 'border-green-500 shadow-md' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="w-16 h-16 rounded-full bg-gray-50 flex items-center justify-center overflow-hidden border">
                    {badgeImage.src || badgeImage.filePath ? (
                      <R2Image
                        src={badgeImage.src || undefined}
                        filePath={badgeImage.filePath || undefined}
                        alt={badge.name_zh || badge.name_en}
                        className="w-full h-full object-cover"
                        fallback={<div className="text-gray-400 text-xs">IMG</div>}
                      />
                    ) : (
                      <Award className="h-8 w-8 text-gray-300" />
                    )}
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-sm font-semibold text-gray-800">{badge.name_zh || badge.name_en}</p>
                    <p className="text-xs text-gray-500">{badge.name_en}</p>
                  </div>
                  <div className="w-full text-center">
                    {owned ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600">
                        <Award className="h-3 w-3" />
                        {t('dashboard.badgeUnlocked', '已解锁')}
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                        <Lock className="h-3 w-3" />
                        {t('dashboard.badgeLocked', '待解锁')}
                      </span>
                    )}
                  </div>
                  {owned && userBadge?.awarded_at && (
                    <p className="text-[11px] text-gray-400">
                      {t('dashboard.badgeAwardedAt', '解锁时间')}: {new Date(userBadge.awarded_at).toLocaleDateString()}
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
