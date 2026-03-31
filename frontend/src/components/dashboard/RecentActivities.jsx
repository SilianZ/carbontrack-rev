import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Clock, CheckCircle, XCircle, AlertCircle, Eye } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { useTranslation } from '../../hooks/useTranslation';
import { formatNumber } from '../../lib/utils';

export function RecentActivities({ activities = [], loading = false, onViewAll }) {
  const { t, tUnit, currentLanguage } = useTranslation();
  const navigate = useNavigate();
  const carbonUnit = t('dashboard.carbonUnit');
  const isChineseLocale = currentLanguage?.toLowerCase().startsWith('zh');

  const openActivityHistoryDetail = (activityId) => {
    if (!activityId) return;
    navigate(`/activities?activityId=${encodeURIComponent(activityId)}`);
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
      default:
        return <AlertCircle className="h-4 w-4 text-orange-600" />;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'approved':
        return 'bg-green-500/12 text-green-600';
      case 'rejected':
        return 'bg-red-500/12 text-red-600';
      case 'pending':
      default:
        return 'bg-orange-500/12 text-orange-600';
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now - date);
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    
    if (diffDays === 1) {
      return t('date.today');
    } else if (diffDays === 2) {
      return t('date.yesterday');
    } else if (diffDays <= 7) {
      return `${diffDays - 1} ${t('date.daysAgo')}`;
    } else {
      return date.toLocaleDateString(currentLanguage, {
        month: 'short', 
        day: 'numeric' 
      });
    }
  };

  const getActivityName = (activity) => {
    if (isChineseLocale) {
      return activity.activity_name_zh || activity.activity_name_en || activity.activity_name || t('activities.unknownActivity');
    }
    return activity.activity_name_en || activity.activity_name_zh || activity.activity_name || t('activities.unknownActivity');
  };

  if (loading) {
    return (
      <Card className="border-border/80 bg-card/95">
        <CardHeader>
          <div className="animate-pulse">
            <div className="mb-2 h-6 w-1/2 rounded bg-muted"></div>
            <div className="h-4 w-3/4 rounded bg-muted"></div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-muted"></div>
                  <div className="flex-1">
                    <div className="mb-2 h-4 w-3/4 rounded bg-muted"></div>
                    <div className="h-3 w-1/2 rounded bg-muted"></div>
                  </div>
                  <div className="h-6 w-16 rounded bg-muted"></div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-border/80 bg-card/95">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5 text-blue-600" />
              {t('dashboard.recentActivities')}
            </CardTitle>
            <CardDescription>
              {t('dashboard.recentActivitiesDesc')}
            </CardDescription>
          </div>
          {activities.length > 0 && (
            <Button variant="outline" size="sm" onClick={onViewAll}>
              <Eye className="h-4 w-4 mr-1" />
              {t('dashboard.viewAll')}
            </Button>
          )}
        </div>
      </CardHeader>
      
      <CardContent>
        {activities.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🌱</div>
            <p className="mb-2 text-muted-foreground">{t('dashboard.noRecentActivities')}</p>
            <p className="text-sm text-muted-foreground">{t('dashboard.startRecordingHint')}</p>
            <Button className="mt-4" onClick={() => navigate('/calculate')}>
              {t('dashboard.recordFirstActivity')}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {activities.slice(0, 5).map((activity) => (
              <div
                key={activity.id}
                role="button"
                tabIndex={0}
                className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={() => openActivityHistoryDetail(activity.id)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openActivityHistoryDetail(activity.id);
                  }
                }}
              >
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/12">
                    {getStatusIcon(activity.status)}
                  </div>
                </div>
                
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {getActivityName(activity)}
                    </p>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(activity.status)}`}>
                      {t(`activities.status.${activity.status}`)}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{formatDate(activity.created_at)}</span>
                    <span>
                      {activity.data}
                      {activity.unit ? ` ${tUnit(activity.unit)}` : ''}
                    </span>
                    {(() => {
                      const formatted = formatNumber(activity.carbon_saved, 2);
                      return formatted !== null ? (
                        <span className="text-green-600">
                          {formatted} {carbonUnit}
                        </span>
                      ) : null;
                    })()}
                    {activity.points_earned && activity.status === 'approved' && (
                      <span className="text-blue-600">
                        +{activity.points_earned} {t('dashboard.points')}
                      </span>
                    )}
                  </div>
                </div>
                
                <div className="flex-shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation();
                      openActivityHistoryDetail(activity.id);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
            
            {activities.length > 5 && (
              <div className="border-t border-border pt-4 text-center">
                <Button variant="outline" onClick={onViewAll}>
                  {t('dashboard.viewAllActivities', { count: activities.length })}
                </Button>
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

