import Silian_React from 'react';
import { TrendingUp as Silian_TrendingUp, TrendingDown as Silian_TrendingDown, Minus as Silian_Minus } from 'lucide-react';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../ui/Card';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';

export function StatsCard({
  title: Silian_title,
  value: Silian_value,
  unit: Silian_unit = '',
  change: Silian_change = null,
  changeType: Silian_changeType = 'neutral',
  icon: Silian_Icon,
  color: Silian_color = 'blue',
  loading: Silian_loading = false
}) {
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['dashboard']);
  const Silian_colorClasses = {
    blue: {
      bg: 'bg-blue-500/12',
      icon: 'text-blue-600',
      value: 'text-blue-500'
    },
    green: {
      bg: 'bg-green-500/12',
      icon: 'text-green-600',
      value: 'text-green-500'
    },
    orange: {
      bg: 'bg-orange-500/12',
      icon: 'text-orange-600',
      value: 'text-orange-500'
    },
    purple: {
      bg: 'bg-purple-500/12',
      icon: 'text-purple-600',
      value: 'text-purple-500'
    }
  };

  const Silian_changeIcons = {
    increase: Silian_TrendingUp,
    decrease: Silian_TrendingDown,
    neutral: Silian_Minus
  };

  const Silian_changeColors = {
    increase: 'text-green-600',
    decrease: 'text-red-600',
    neutral: 'text-muted-foreground'
  };

  const Silian_ChangeIcon = Silian_changeIcons[Silian_changeType];
  const Silian_classes = Silian_colorClasses[Silian_color];

  if (Silian_loading) {
    return (
      <Silian_Card className="border-border/80 bg-card/95">
        <Silian_CardContent className="p-6">
          <div className="animate-pulse">
            <div className="flex items-center justify-between mb-4">
              <div className="h-4 w-1/2 rounded bg-muted"></div>
              <div className="h-8 w-8 rounded bg-muted"></div>
            </div>
            <div className="mb-2 h-8 w-3/4 rounded bg-muted"></div>
            <div className="h-4 w-1/3 rounded bg-muted"></div>
          </div>
        </Silian_CardContent>
      </Silian_Card>
    );
  }

  return (
    <Silian_Card className="border-border/80 bg-card/95 transition-shadow duration-200 hover:shadow-md">
      <Silian_CardContent className="p-6">
        <div className="flex items-center justify-between mb-4">
          <Silian_CardTitle className="text-sm font-medium text-muted-foreground">
            {Silian_title}
          </Silian_CardTitle>
          {Silian_Icon && (
            <div className={`p-2 rounded-lg ${Silian_classes.bg}`}>
              <Silian_Icon className={`h-5 w-5 ${Silian_classes.icon}`} />
            </div>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-baseline gap-2">
            <span className={`text-2xl font-bold ${Silian_classes.value}`}>
              {typeof Silian_value === 'number' ? Silian_value.toLocaleString(Silian_currentLanguage) : Silian_value}
            </span>
            {Silian_unit && (
              <span className="text-sm text-muted-foreground">{Silian_unit}</span>
            )}
          </div>

          {Silian_change !== null && (
            <div className={`flex items-center gap-1 text-sm ${Silian_changeColors[Silian_changeType]}`}>
              <Silian_ChangeIcon className="h-4 w-4" />
              <span>
                {typeof Silian_change === 'number' ?
                  `${Silian_change > 0 ? '+' : ''}${Silian_change.toFixed(1)}%` :
                  Silian_change
                }
              </span>
              <span className="ml-1 text-muted-foreground">{Silian_t('dashboard.vsLastMonth')}</span>
            </div>
          )}
        </div>
      </Silian_CardContent>
    </Silian_Card>
  );
}
