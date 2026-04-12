import React from 'react';
import { Plus, ShoppingBag, MessageSquare, BarChart3, Settings, Award } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useTranslation } from '../../hooks/useTranslation';

export function QuickActions({ userStats = {}, onActionClick }) {
  const { t } = useTranslation(['dashboard']);
  const pointsBalance = Number(userStats.points_balance ?? 0);
  const rawMinExchangePoints = userStats.min_exchange_points;
  const minExchangePoints = rawMinExchangePoints === null || rawMinExchangePoints === undefined
    ? null
    : Number(rawMinExchangePoints);
  const showPointsHint = Number.isFinite(minExchangePoints) && minExchangePoints > 0 && pointsBalance < minExchangePoints;
  const pointsNeeded = showPointsHint ? Math.max(minExchangePoints - pointsBalance, 0) : 0;

  const actions = [
    {
      id: 'record',
      title: t('dashboard.quickActions.recordActivity'),
      description: t('dashboard.quickActions.recordActivityDesc'),
      icon: Plus,
      color: 'bg-green-500 hover:bg-green-600',
      href: '/calculate',
      primary: true
    },
    {
      id: 'store',
      title: t('dashboard.quickActions.browseStore'),
      description: t('dashboard.quickActions.browseStoreDesc'),
      icon: ShoppingBag,
      color: 'bg-blue-500 hover:bg-blue-600',
      href: '/store',
      badge: userStats.available_products || null
    },
    {
      id: 'messages',
      title: t('dashboard.quickActions.checkMessages'),
      description: t('dashboard.quickActions.checkMessagesDesc'),
      icon: MessageSquare,
      color: 'bg-purple-500 hover:bg-purple-600',
      href: '/messages',
      badge: userStats.unread_messages || null
    },
    {
      id: 'history',
      title: t('dashboard.quickActions.viewHistory'),
      description: t('dashboard.quickActions.viewHistoryDesc'),
      icon: BarChart3,
      color: 'bg-orange-500 hover:bg-orange-600',
      href: '/activities'
    },
    {
      id: 'achievements',
      title: t('dashboard.quickActions.achievements'),
      description: t('dashboard.quickActions.achievementsDesc'),
      icon: Award,
      color: 'bg-yellow-500 hover:bg-yellow-600',
      href: '/achievements',
      badge: userStats.new_achievements || null
    },
    {
      id: 'settings',
      title: t('dashboard.quickActions.settings'),
      description: t('dashboard.quickActions.settingsDesc'),
      icon: Settings,
      color: 'bg-zinc-700 hover:bg-zinc-600',
      href: '/profile'
    }
  ];

  const handleActionClick = (action) => {
    if (onActionClick) {
      onActionClick(action);
    } else if (action.href) {
      window.location.href = action.href;
    }
  };

  return (
    <Card className="flex h-full flex-col border-border/80 bg-card/95">
      <CardHeader>
        <CardTitle>{t('dashboard.quickActions.title')}</CardTitle>
        <CardDescription>
          {t('dashboard.quickActions.description')}
        </CardDescription>
      </CardHeader>

      <CardContent className="flex flex-1 flex-col">
        <div className="grid auto-rows-fr grid-cols-2 gap-4">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <Button
                key={action.id}
                variant={action.primary ? "default" : "outline"}
                className={`relative flex h-full min-h-[9.5rem] w-full min-w-0 overflow-hidden flex-col items-start justify-start gap-3 p-4 text-left whitespace-normal ${action.primary ? action.color : 'border-border bg-background/40 hover:bg-muted/60'
                  }`}
                onClick={() => handleActionClick(action)}
              >
                {action.badge && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
                    {action.badge > 99 ? t('dashboard.quickActions.badgeOverflow', { count: 99 }) : action.badge}
                  </div>
                )}

                <div className="flex w-full min-w-0 items-start gap-3">
                  <Icon className={`mt-1 h-6 w-6 flex-shrink-0 ${action.primary ? 'text-white' : 'text-foreground/80'}`} />
                  <span className={`block min-w-0 flex-1 break-words text-base font-semibold leading-snug [overflow-wrap:anywhere] sm:text-lg ${action.primary ? 'text-white' : 'text-foreground'}`}>
                    {action.title}
                  </span>
                </div>
                <p className={`w-full break-words text-sm leading-5 [overflow-wrap:anywhere] ${action.primary ? 'text-emerald-50/90' : 'text-muted-foreground'}`}>
                  {action.description}
                </p>
              </Button>
            );
          })}
        </div>

        {/* 特殊提示 */}
        {showPointsHint && (
          <div className="mt-4 rounded-lg border border-blue-500/25 bg-blue-500/10 p-3">
            <div className="flex items-center gap-2 text-blue-500">
              <Award className="h-4 w-4" />
              <span className="text-sm font-medium">
                {t('dashboard.quickActions.pointsHint')}
              </span>
            </div>
            <p className="mt-1 text-xs text-blue-400">
              {t('dashboard.quickActions.pointsHintDesc', {
                current: pointsBalance,
                needed: pointsNeeded
              })}
            </p>
          </div>
        )}

        {userStats.pending_reviews > 0 && (
          <div className="mt-4 rounded-lg border border-orange-500/25 bg-orange-500/10 p-3">
            <div className="flex items-center gap-2 text-orange-500">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm font-medium">
                {t('dashboard.quickActions.pendingReviews')}
              </span>
            </div>
            <p className="mt-1 text-xs text-orange-400">
              {t('dashboard.quickActions.pendingReviewsDesc', {
                count: userStats.pending_reviews
              })}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
