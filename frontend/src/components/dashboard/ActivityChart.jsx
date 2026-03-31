import React from 'react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from 'recharts';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { useTranslation } from '../../hooks/useTranslation';

export function ActivityChart({ 
  data = [], 
  type = 'line', 
  title, 
  description,
  dataKey = 'value',
  xAxisKey = 'date',
  color = '#10b981',
  loading = false 
}) {
  const { t, currentLanguage } = useTranslation();
  const { resolvedTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';
  const axisColor = isDark ? 'rgba(244, 244, 245, 0.72)' : '#666';
  const gridColor = isDark ? 'rgba(244, 244, 245, 0.14)' : '#f0f0f0';
  const tooltipLabelColor = isDark ? 'rgba(244, 244, 245, 0.82)' : '#666';
  const tooltipContentStyle = {
    backgroundColor: isDark ? 'rgba(24, 24, 27, 0.96)' : 'white',
    border: isDark ? '1px solid rgba(244, 244, 245, 0.12)' : '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: isDark
      ? '0 16px 40px rgba(0, 0, 0, 0.35)'
      : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    color: isDark ? '#f4f4f5' : '#18181b'
  };

  if (loading) {
    return (
      <Card className="flex h-full flex-col border-border/80 bg-card/95">
        <CardHeader>
          <div className="animate-pulse">
            <div className="mb-2 h-6 w-1/2 rounded bg-muted"></div>
            <div className="h-4 w-3/4 rounded bg-muted"></div>
          </div>
        </CardHeader>
        <CardContent className="flex-1">
          <div className="h-full min-h-[24rem] animate-pulse rounded bg-muted"></div>
        </CardContent>
      </Card>
    );
  }

  const formatTooltipValue = (value, name) => {
    if (name === 'carbon_saved') {
      return [`${value} ${t('dashboard.carbonUnit')}`, t('activities.carbonSaved')];
    }
    if (name === 'points') {
      return [`${value} ${t('dashboard.points')}`, t('dashboard.points')];
    }
    if (name === 'activities') {
      return [`${value} ${t('dashboard.activities')}`, t('dashboard.activities')];
    }
    return [value, name];
  };

  const formatXAxisLabel = (value) => {
    // 如果是日期格式，进行格式化
    if (typeof value === 'string' && value.includes('-')) {
      const date = new Date(value);
      return date.toLocaleDateString(currentLanguage, { month: 'short', day: 'numeric' });
    }
    return value;
  };

  return (
    <Card className="flex h-full flex-col border-border/80 bg-card/95">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description && <CardDescription>{description}</CardDescription>}
      </CardHeader>
      <CardContent className="flex-1">
        {data.length === 0 ? (
          <div className="flex h-full min-h-[24rem] items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="text-4xl mb-2">📊</div>
              <p>{t('dashboard.noDataAvailable')}</p>
              <p className="text-sm mt-1">{t('dashboard.startRecordingActivities')}</p>
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[24rem]">
            <ResponsiveContainer width="100%" height="100%">
              {type === 'line' ? (
                <LineChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis 
                    dataKey={xAxisKey}
                    tickFormatter={formatXAxisLabel}
                    stroke={axisColor}
                    fontSize={12}
                  />
                  <YAxis stroke={axisColor} fontSize={12} />
                  <Tooltip 
                    formatter={formatTooltipValue}
                    labelStyle={{ color: tooltipLabelColor }}
                    contentStyle={tooltipContentStyle}
                  />
                  <Line 
                    type="monotone" 
                    dataKey={dataKey} 
                    stroke={color} 
                    strokeWidth={2}
                    dot={{ fill: color, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: color, strokeWidth: 2 }}
                  />
                </LineChart>
              ) : (
                <BarChart data={data}>
                  <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
                  <XAxis 
                    dataKey={xAxisKey}
                    tickFormatter={formatXAxisLabel}
                    stroke={axisColor}
                    fontSize={12}
                  />
                  <YAxis stroke={axisColor} fontSize={12} />
                  <Tooltip 
                    formatter={formatTooltipValue}
                    labelStyle={{ color: tooltipLabelColor }}
                    contentStyle={tooltipContentStyle}
                  />
                  <Bar 
                    dataKey={dataKey} 
                    fill={color}
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
