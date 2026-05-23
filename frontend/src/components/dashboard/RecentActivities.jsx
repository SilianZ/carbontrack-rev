import Silian_React from 'react';
import { useNavigate as Silian_useNavigate } from 'react-router-dom';
import { Clock as Silian_Clock, CheckCircle as Silian_CheckCircle, XCircle as Silian_XCircle, AlertCircle as Silian_AlertCircle, Eye as Silian_Eye } from 'lucide-react';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../../components/ui/Card';
import { Button as Silian_Button } from '../../components/ui/Button';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { formatNumber as Silian_formatNumber } from '../../lib/utils';

export function RecentActivities({ activities: Silian_activities = [], loading: Silian_loading = false, onViewAll: Silian_onViewAll }) {
  const { t: Silian_t, tUnit: Silian_tUnit, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['activities', 'dashboard', 'date', 'units']);
  const Silian_navigate = Silian_useNavigate();
  const Silian_carbonUnit = Silian_t('dashboard.carbonUnit');
  const Silian_isChineseLocale = Silian_currentLanguage?.toLowerCase().startsWith('zh');

  const Silian_openActivityHistoryDetail = (Silian_activityId) => {
    if (!Silian_activityId) return;
    Silian_navigate(`/activities?activityId=${encodeURIComponent(Silian_activityId)}`);
  };

  const Silian_getStatusIcon = (Silian_status) => {
    switch (Silian_status) {
      case 'approved':
        return <Silian_CheckCircle className="h-4 w-4 text-green-600" />;
      case 'rejected':
        return <Silian_XCircle className="h-4 w-4 text-red-600" />;
      case 'pending':
      default:
        return <Silian_AlertCircle className="h-4 w-4 text-orange-600" />;
    }
  };

  const Silian_getStatusColor = (Silian_status) => {
    switch (Silian_status) {
      case 'approved':
        return 'bg-green-500/12 text-green-600';
      case 'rejected':
        return 'bg-red-500/12 text-red-600';
      case 'pending':
      default:
        return 'bg-orange-500/12 text-orange-600';
    }
  };

  const Silian_formatDate = (Silian_dateString) => {
    const Silian_date = new Date(Silian_dateString);
    const Silian_now = new Date();
    const Silian_diffTime = Math.abs(Silian_now - Silian_date);
    const Silian_diffDays = Math.ceil(Silian_diffTime / (1000 * 60 * 60 * 24));

    if (Silian_diffDays === 1) {
      return Silian_t('date.today');
    } else if (Silian_diffDays === 2) {
      return Silian_t('date.yesterday');
    } else if (Silian_diffDays <= 7) {
      return `${Silian_diffDays - 1} ${Silian_t('date.daysAgo')}`;
    } else {
      return Silian_date.toLocaleDateString(Silian_currentLanguage, {
        month: 'short',
        day: 'numeric'
      });
    }
  };

  const Silian_getActivityName = (Silian_activity) => {
    if (Silian_isChineseLocale) {
      return Silian_activity.activity_name_zh || Silian_activity.activity_name_en || Silian_activity.activity_name || Silian_t('activities.unknownActivity');
    }
    return Silian_activity.activity_name_en || Silian_activity.activity_name_zh || Silian_activity.activity_name || Silian_t('activities.unknownActivity');
  };

  if (Silian_loading) {
    return (
      <Silian_Card className="border-border/80 bg-card/95">
        <Silian_CardHeader>
          <div className="animate-pulse">
            <div className="mb-2 h-6 w-1/2 rounded bg-muted"></div>
            <div className="h-4 w-3/4 rounded bg-muted"></div>
          </div>
        </Silian_CardHeader>
        <Silian_CardContent>
          <div className="space-y-4">
            {[1, 2, 3].map((Silian_i) => (
              <div key={Silian_i} className="animate-pulse">
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
        </Silian_CardContent>
      </Silian_Card>
    );
  }

  return (
    <Silian_Card className="border-border/80 bg-card/95">
      <Silian_CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <Silian_CardTitle className="flex items-center gap-2">
              <Silian_Clock className="h-5 w-5 text-blue-600" />
              {Silian_t('dashboard.recentActivities')}
            </Silian_CardTitle>
            <Silian_CardDescription>
              {Silian_t('dashboard.recentActivitiesDesc')}
            </Silian_CardDescription>
          </div>
          {Silian_activities.length > 0 && (
            <Silian_Button variant="outline" size="sm" onClick={Silian_onViewAll}>
              <Silian_Eye className="h-4 w-4 mr-1" />
              {Silian_t('dashboard.viewAll')}
            </Silian_Button>
          )}
        </div>
      </Silian_CardHeader>

      <Silian_CardContent>
        {Silian_activities.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-2">🌱</div>
            <p className="mb-2 text-muted-foreground">{Silian_t('dashboard.noRecentActivities')}</p>
            <p className="text-sm text-muted-foreground">{Silian_t('dashboard.startRecordingHint')}</p>
            <Silian_Button className="mt-4" onClick={() => Silian_navigate('/calculate')}>
              {Silian_t('dashboard.recordFirstActivity')}
            </Silian_Button>
          </div>
        ) : (
          <div className="space-y-4">
            {Silian_activities.slice(0, 5).map((Silian_activity) => (
              <div
                key={Silian_activity.id}
                role="button"
                tabIndex={0}
                className="flex w-full items-center gap-3 rounded-lg p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                onClick={() => Silian_openActivityHistoryDetail(Silian_activity.id)}
                onKeyDown={(Silian_event) => {
                  if (Silian_event.key === 'Enter' || Silian_event.key === ' ') {
                    Silian_event.preventDefault();
                    Silian_openActivityHistoryDetail(Silian_activity.id);
                  }
                }}
              >
                <div className="flex-shrink-0">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/12">
                    {Silian_getStatusIcon(Silian_activity.status)}
                  </div>
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="truncate text-sm font-medium text-foreground">
                      {Silian_getActivityName(Silian_activity)}
                    </p>
                    <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${Silian_getStatusColor(Silian_activity.status)}`}>
                      {Silian_t(`activities.status.${Silian_activity.status}`)}
                    </span>
                  </div>

                  <div className="flex items-center gap-4 text-xs text-muted-foreground">
                    <span>{Silian_formatDate(Silian_activity.created_at)}</span>
                    <span>
                      {Silian_activity.data}
                      {Silian_activity.unit ? ` ${Silian_tUnit(Silian_activity.unit)}` : ''}
                    </span>
                    {(() => {
                      const Silian_formatted = Silian_formatNumber(Silian_activity.carbon_saved, 2);
                      return Silian_formatted !== null ? (
                        <span className="text-green-600">
                          {Silian_formatted} {Silian_carbonUnit}
                        </span>
                      ) : null;
                    })()}
                    {Silian_activity.points_earned && Silian_activity.status === 'approved' && (
                      <span className="text-blue-600">
                        +{Silian_activity.points_earned} {Silian_t('dashboard.points')}
                      </span>
                    )}
                  </div>
                </div>

                <div className="flex-shrink-0">
                  <Silian_Button
                    variant="ghost"
                    size="sm"
                    onClick={(Silian_event) => {
                      Silian_event.stopPropagation();
                      Silian_openActivityHistoryDetail(Silian_activity.id);
                    }}
                  >
                    <Silian_Eye className="h-4 w-4" />
                  </Silian_Button>
                </div>
              </div>
            ))}

            {Silian_activities.length > 5 && (
              <div className="border-t border-border pt-4 text-center">
                <Silian_Button variant="outline" onClick={Silian_onViewAll}>
                  {Silian_t('dashboard.viewAllActivities', { count: Silian_activities.length })}
                </Silian_Button>
              </div>
            )}
          </div>
        )}
      </Silian_CardContent>
    </Silian_Card>
  );
}

