import Silian_React from 'react';
import { Plus as Silian_Plus, ShoppingBag as Silian_ShoppingBag, MessageSquare as Silian_MessageSquare, BarChart3 as Silian_BarChart3, Settings as Silian_Settings, Award as Silian_Award } from 'lucide-react';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../../components/ui/Card';
import { Button as Silian_Button } from '../../components/ui/Button';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';

export function QuickActions({ userStats: Silian_userStats = {}, onActionClick: Silian_onActionClick }) {
  const { t: Silian_t } = Silian_useTranslation(['dashboard']);
  const Silian_pointsBalance = Number(Silian_userStats.points_balance ?? 0);
  const Silian_rawMinExchangePoints = Silian_userStats.min_exchange_points;
  const Silian_minExchangePoints = Silian_rawMinExchangePoints === null || Silian_rawMinExchangePoints === undefined
    ? null
    : Number(Silian_rawMinExchangePoints);
  const Silian_showPointsHint = Number.isFinite(Silian_minExchangePoints) && Silian_minExchangePoints > 0 && Silian_pointsBalance < Silian_minExchangePoints;
  const Silian_pointsNeeded = Silian_showPointsHint ? Math.max(Silian_minExchangePoints - Silian_pointsBalance, 0) : 0;

  const Silian_actions = [
    {
      id: 'record',
      title: Silian_t('dashboard.quickActions.recordActivity'),
      description: Silian_t('dashboard.quickActions.recordActivityDesc'),
      icon: Silian_Plus,
      color: 'bg-green-500 hover:bg-green-600',
      href: '/calculate',
      primary: true
    },
    {
      id: 'store',
      title: Silian_t('dashboard.quickActions.browseStore'),
      description: Silian_t('dashboard.quickActions.browseStoreDesc'),
      icon: Silian_ShoppingBag,
      color: 'bg-blue-500 hover:bg-blue-600',
      href: '/store',
      badge: Silian_userStats.available_products || null
    },
    {
      id: 'messages',
      title: Silian_t('dashboard.quickActions.checkMessages'),
      description: Silian_t('dashboard.quickActions.checkMessagesDesc'),
      icon: Silian_MessageSquare,
      color: 'bg-purple-500 hover:bg-purple-600',
      href: '/messages',
      badge: Silian_userStats.unread_messages || null
    },
    {
      id: 'history',
      title: Silian_t('dashboard.quickActions.viewHistory'),
      description: Silian_t('dashboard.quickActions.viewHistoryDesc'),
      icon: Silian_BarChart3,
      color: 'bg-orange-500 hover:bg-orange-600',
      href: '/activities'
    },
    {
      id: 'achievements',
      title: Silian_t('dashboard.quickActions.achievements'),
      description: Silian_t('dashboard.quickActions.achievementsDesc'),
      icon: Silian_Award,
      color: 'bg-yellow-500 hover:bg-yellow-600',
      href: '/achievements',
      badge: Silian_userStats.new_achievements || null
    },
    {
      id: 'settings',
      title: Silian_t('dashboard.quickActions.settings'),
      description: Silian_t('dashboard.quickActions.settingsDesc'),
      icon: Silian_Settings,
      color: 'bg-zinc-700 hover:bg-zinc-600',
      href: '/profile'
    }
  ];

  const Silian_handleActionClick = (Silian_action) => {
    if (Silian_onActionClick) {
      Silian_onActionClick(Silian_action);
    } else if (Silian_action.href) {
      window.location.href = Silian_action.href;
    }
  };

  return (
    <Silian_Card className="flex h-full flex-col border-border/80 bg-card/95">
      <Silian_CardHeader>
        <Silian_CardTitle>{Silian_t('dashboard.quickActions.title')}</Silian_CardTitle>
        <Silian_CardDescription>
          {Silian_t('dashboard.quickActions.description')}
        </Silian_CardDescription>
      </Silian_CardHeader>

      <Silian_CardContent className="flex flex-1 flex-col">
        <div className="grid auto-rows-fr grid-cols-2 gap-4">
          {Silian_actions.map((Silian_action) => {
            const Silian_Icon = Silian_action.icon;

            return (
              <Silian_Button
                key={Silian_action.id}
                variant={Silian_action.primary ? "default" : "outline"}
                className={`relative flex h-full min-h-[9.5rem] w-full min-w-0 overflow-hidden flex-col items-start justify-start gap-3 p-4 text-left whitespace-normal ${Silian_action.primary ? Silian_action.color : 'border-border bg-background/40 hover:bg-muted/60'
                  }`}
                onClick={() => Silian_handleActionClick(Silian_action)}
              >
                {Silian_action.badge && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
                    {Silian_action.badge > 99 ? Silian_t('dashboard.quickActions.badgeOverflow', { count: 99 }) : Silian_action.badge}
                  </div>
                )}

                <div className="flex w-full min-w-0 items-start gap-3">
                  <Silian_Icon className={`mt-1 h-6 w-6 flex-shrink-0 ${Silian_action.primary ? 'text-white' : 'text-foreground/80'}`} />
                  <span className={`block min-w-0 flex-1 break-words text-base font-semibold leading-snug [overflow-wrap:anywhere] sm:text-lg ${Silian_action.primary ? 'text-white' : 'text-foreground'}`}>
                    {Silian_action.title}
                  </span>
                </div>
                <p className={`w-full break-words text-sm leading-5 [overflow-wrap:anywhere] ${Silian_action.primary ? 'text-emerald-50/90' : 'text-muted-foreground'}`}>
                  {Silian_action.description}
                </p>
              </Silian_Button>
            );
          })}
        </div>

        {/* 特殊提示 */}
        {Silian_showPointsHint && (
          <div className="mt-4 rounded-lg border border-blue-500/25 bg-blue-500/10 p-3">
            <div className="flex items-center gap-2 text-blue-500">
              <Silian_Award className="h-4 w-4" />
              <span className="text-sm font-medium">
                {Silian_t('dashboard.quickActions.pointsHint')}
              </span>
            </div>
            <p className="mt-1 text-xs text-blue-400">
              {Silian_t('dashboard.quickActions.pointsHintDesc', {
                current: Silian_pointsBalance,
                needed: Silian_pointsNeeded
              })}
            </p>
          </div>
        )}

        {Silian_userStats.pending_reviews > 0 && (
          <div className="mt-4 rounded-lg border border-orange-500/25 bg-orange-500/10 p-3">
            <div className="flex items-center gap-2 text-orange-500">
              <Silian_MessageSquare className="h-4 w-4" />
              <span className="text-sm font-medium">
                {Silian_t('dashboard.quickActions.pendingReviews')}
              </span>
            </div>
            <p className="mt-1 text-xs text-orange-400">
              {Silian_t('dashboard.quickActions.pendingReviewsDesc', {
                count: Silian_userStats.pending_reviews
              })}
            </p>
          </div>
        )}
      </Silian_CardContent>
    </Silian_Card>
  );
}
