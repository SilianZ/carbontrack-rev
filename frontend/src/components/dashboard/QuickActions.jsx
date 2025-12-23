import React from 'react';
import { Plus, ShoppingBag, MessageSquare, BarChart3, Settings, Award } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useTranslation } from '../../hooks/useTranslation';

export function QuickActions({ userStats = {}, onActionClick }) {
  const { t } = useTranslation();

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
      color: 'bg-gray-500 hover:bg-gray-600',
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
    <Card>
      <CardHeader>
        <CardTitle>{t('dashboard.quickActions.title')}</CardTitle>
        <CardDescription>
          {t('dashboard.quickActions.description')}
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* 固定最多两列：避免在右侧 1/3 宽容器内出现三列导致过窄/错位 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {actions.map((action) => {
            const Icon = action.icon;

            return (
              <Button
                key={action.id}
                variant={action.primary ? "default" : "outline"}
                className={`h-auto w-full p-4 flex flex-col items-start justify-start text-left gap-3 relative whitespace-normal ${action.primary ? action.color : 'hover:bg-gray-50'
                  }`}
                onClick={() => handleActionClick(action)}
              >
                {action.badge && (
                  <div className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-6 w-6 flex items-center justify-center">
                    {action.badge > 99 ? '99+' : action.badge}
                  </div>
                )}

                <div className="flex items-start gap-3 w-full">
                  <Icon className={`h-6 w-6 mt-1 flex-shrink-0 ${action.primary ? 'text-white' : 'text-gray-700'}`} />
                  <span className={`text-lg font-semibold flex-1 ${action.primary ? 'text-white' : 'text-gray-800'}`}>
                    {action.title}
                  </span>
                </div>
                <p className={`text-sm ${action.primary ? 'text-gray-200' : 'text-gray-500'} text-wrap`}>
                  {action.description}
                </p>
              </Button>
            );
          })}
        </div>

        {/* 特殊提示 */}
        {userStats.points_balance !== undefined && userStats.points_balance < 100 && (
          <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center gap-2 text-blue-800">
              <Award className="h-4 w-4" />
              <span className="text-sm font-medium">
                {t('dashboard.quickActions.pointsHint')}
              </span>
            </div>
            <p className="text-xs text-blue-600 mt-1">
              {t('dashboard.quickActions.pointsHintDesc', {
                current: userStats.points_balance || 0,
                needed: 100 - (userStats.points_balance || 0)
              })}
            </p>
          </div>
        )}

        {userStats.pending_reviews > 0 && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="flex items-center gap-2 text-orange-800">
              <MessageSquare className="h-4 w-4" />
              <span className="text-sm font-medium">
                {t('dashboard.quickActions.pendingReviews')}
              </span>
            </div>
            <p className="text-xs text-orange-600 mt-1">
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

