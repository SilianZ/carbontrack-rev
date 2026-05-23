import Silian_React from 'react';
import { LineChart as Silian_LineChart, Line as Silian_Line, XAxis as Silian_XAxis, YAxis as Silian_YAxis, CartesianGrid as Silian_CartesianGrid, Tooltip as Silian_Tooltip, ResponsiveContainer as Silian_ResponsiveContainer, BarChart as Silian_BarChart, Bar as Silian_Bar } from 'recharts';
import { useTheme as Silian_useTheme } from 'next-themes';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../../components/ui/Card';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';

export function ActivityChart({
  data: Silian_data = [],
  type: Silian_type = 'line',
  title: Silian_title,
  description: Silian_description,
  dataKey: Silian_dataKey = 'value',
  xAxisKey: Silian_xAxisKey = 'date',
  color: Silian_color = '#10b981',
  loading: Silian_loading = false
}) {
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['activities', 'dashboard', 'date']);
  const { resolvedTheme: Silian_resolvedTheme } = Silian_useTheme();
  const Silian_isDark = Silian_resolvedTheme === 'dark';
  const Silian_axisColor = Silian_isDark ? 'rgba(244, 244, 245, 0.72)' : '#666';
  const Silian_gridColor = Silian_isDark ? 'rgba(244, 244, 245, 0.14)' : '#f0f0f0';
  const Silian_tooltipLabelColor = Silian_isDark ? 'rgba(244, 244, 245, 0.82)' : '#666';
  const Silian_tooltipContentStyle = {
    backgroundColor: Silian_isDark ? 'rgba(24, 24, 27, 0.96)' : 'white',
    border: Silian_isDark ? '1px solid rgba(244, 244, 245, 0.12)' : '1px solid #e5e7eb',
    borderRadius: '8px',
    boxShadow: Silian_isDark
      ? '0 16px 40px rgba(0, 0, 0, 0.35)'
      : '0 4px 6px -1px rgba(0, 0, 0, 0.1)',
    color: Silian_isDark ? '#f4f4f5' : '#18181b'
  };

  if (Silian_loading) {
    return (
      <Silian_Card className="flex h-full flex-col border-border/80 bg-card/95">
        <Silian_CardHeader>
          <div className="animate-pulse">
            <div className="mb-2 h-6 w-1/2 rounded bg-muted"></div>
            <div className="h-4 w-3/4 rounded bg-muted"></div>
          </div>
        </Silian_CardHeader>
        <Silian_CardContent className="flex-1">
          <div className="h-full min-h-[24rem] animate-pulse rounded bg-muted"></div>
        </Silian_CardContent>
      </Silian_Card>
    );
  }

  const Silian_formatTooltipValue = (Silian_value, Silian_name) => {
    if (Silian_name === 'carbon_saved') {
      return [`${Silian_value} ${Silian_t('dashboard.carbonUnit')}`, Silian_t('activities.carbonSaved')];
    }
    if (Silian_name === 'points') {
      return [`${Silian_value} ${Silian_t('dashboard.points')}`, Silian_t('dashboard.points')];
    }
    if (Silian_name === 'activities') {
      return [`${Silian_value} ${Silian_t('dashboard.activities')}`, Silian_t('dashboard.activities')];
    }
    return [Silian_value, Silian_name];
  };

  const Silian_formatXAxisLabel = (Silian_value) => {
    // 如果是日期格式，进行格式化
    if (typeof Silian_value === 'string' && Silian_value.includes('-')) {
      const Silian_date = new Date(Silian_value);
      return Silian_date.toLocaleDateString(Silian_currentLanguage, { month: 'short', day: 'numeric' });
    }
    return Silian_value;
  };

  return (
    <Silian_Card className="flex h-full flex-col border-border/80 bg-card/95">
      <Silian_CardHeader>
        <Silian_CardTitle>{Silian_title}</Silian_CardTitle>
        {Silian_description && <Silian_CardDescription>{Silian_description}</Silian_CardDescription>}
      </Silian_CardHeader>
      <Silian_CardContent className="flex-1">
        {Silian_data.length === 0 ? (
          <div className="flex h-full min-h-[24rem] items-center justify-center text-muted-foreground">
            <div className="text-center">
              <div className="text-4xl mb-2">📊</div>
              <p>{Silian_t('dashboard.noDataAvailable')}</p>
              <p className="text-sm mt-1">{Silian_t('dashboard.startRecordingActivities')}</p>
            </div>
          </div>
        ) : (
          <div className="h-full min-h-[24rem]">
            <Silian_ResponsiveContainer width="100%" height="100%">
              {Silian_type === 'line' ? (
                <Silian_LineChart data={Silian_data}>
                  <Silian_CartesianGrid strokeDasharray="3 3" stroke={Silian_gridColor} />
                  <Silian_XAxis
                    dataKey={Silian_xAxisKey}
                    tickFormatter={Silian_formatXAxisLabel}
                    stroke={Silian_axisColor}
                    fontSize={12}
                  />
                  <Silian_YAxis stroke={Silian_axisColor} fontSize={12} />
                  <Silian_Tooltip
                    formatter={Silian_formatTooltipValue}
                    labelStyle={{ color: Silian_tooltipLabelColor }}
                    contentStyle={Silian_tooltipContentStyle}
                  />
                  <Silian_Line
                    type="monotone"
                    dataKey={Silian_dataKey}
                    stroke={Silian_color}
                    strokeWidth={2}
                    dot={{ fill: Silian_color, strokeWidth: 2, r: 4 }}
                    activeDot={{ r: 6, stroke: Silian_color, strokeWidth: 2 }}
                  />
                </Silian_LineChart>
              ) : (
                <Silian_BarChart data={Silian_data}>
                  <Silian_CartesianGrid strokeDasharray="3 3" stroke={Silian_gridColor} />
                  <Silian_XAxis
                    dataKey={Silian_xAxisKey}
                    tickFormatter={Silian_formatXAxisLabel}
                    stroke={Silian_axisColor}
                    fontSize={12}
                  />
                  <Silian_YAxis stroke={Silian_axisColor} fontSize={12} />
                  <Silian_Tooltip
                    formatter={Silian_formatTooltipValue}
                    labelStyle={{ color: Silian_tooltipLabelColor }}
                    contentStyle={Silian_tooltipContentStyle}
                  />
                  <Silian_Bar
                    dataKey={Silian_dataKey}
                    fill={Silian_color}
                    radius={[4, 4, 0, 0]}
                  />
                </Silian_BarChart>
              )}
            </Silian_ResponsiveContainer>
          </div>
        )}
      </Silian_CardContent>
    </Silian_Card>
  );
}
