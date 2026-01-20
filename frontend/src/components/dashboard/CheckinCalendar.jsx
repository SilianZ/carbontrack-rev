import React, { useMemo, useState } from 'react';
import { format, isAfter } from 'date-fns';
import { Calendar } from '../ui/calendar';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Button } from '../ui/Button';
import { Badge } from '../ui/badge';
import { CalendarDays, Flame, RefreshCcw } from 'lucide-react';
import { cn } from '../../lib/utils';
import { useTranslation } from '../../hooks/useTranslation';

const toDateKey = (date) => format(date, 'yyyy-MM-dd');

export function CheckinCalendar({
  checkins = [],
  stats = {},
  quota = {},
  meta = {},
  month,
  loading = false,
  onMonthChange,
  onMakeup,
}) {
  const { t } = useTranslation();
  const [selectedDay, setSelectedDay] = useState(null);

  const checkinMap = useMemo(() => {
    const map = new Map();
    checkins.forEach((item) => {
      if (item?.date) {
        map.set(item.date, item);
      }
    });
    return map;
  }, [checkins]);

  const { checkinDates, makeupDates } = useMemo(() => {
    const dates = [];
    const makeup = [];
    checkins.forEach((item) => {
      if (!item?.date) return;
      const date = new Date(`${item.date}T00:00:00`);
      dates.push(date);
      if (item.source === 'makeup') {
        makeup.push(date);
      }
    });
    return { checkinDates: dates, makeupDates: makeup };
  }, [checkins]);

  const selectedKey = selectedDay ? toDateKey(selectedDay) : '';
  const selectedCheckin = selectedKey ? checkinMap.get(selectedKey) : null;
  const serverToday = meta?.server_today ? new Date(`${meta.server_today}T00:00:00`) : null;
  const todayDate = serverToday ?? new Date();
  const isFutureSelected = selectedDay ? isAfter(selectedDay, todayDate) : false;
  const remaining = quota?.remaining ?? null;
  const canMakeup = Boolean(selectedDay && !selectedCheckin && !isFutureSelected && remaining !== null && remaining > 0);

  const handleMakeup = () => {
    if (!selectedDay || !onMakeup) return;
    onMakeup({ date: selectedKey });
  };

  const currentStreak = stats?.current_streak ?? 0;
  const longestStreak = stats?.longest_streak ?? 0;
  const totalDays = stats?.total_days ?? 0;
  const activeToday = stats?.active_today ?? false;

  return (
    <Card className="border-emerald-100 bg-gradient-to-br from-emerald-50 via-white to-sky-50">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="text-lg font-semibold text-emerald-800 flex items-center gap-2">
              <CalendarDays className="h-5 w-5" />
              {t('dashboard.checkin.calendarTitle', '活动日历')}
            </CardTitle>
            <CardDescription className="text-sm text-emerald-700">
              {t('dashboard.checkin.calendarDescription', '每天提交一次碳减排记录即可点亮当日。')}
            </CardDescription>
          </div>
          {typeof remaining === 'number' && (
            <Badge variant="secondary" className="bg-emerald-100 text-emerald-700">
              {t('dashboard.checkin.makeupRemaining', '补打卡剩余 {{count}}', { count: remaining })}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-emerald-100 bg-white/80 p-3">
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <Flame className="h-4 w-4" />
              {t('dashboard.checkin.currentStreak', '当前连击')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-emerald-800">{currentStreak}</div>
            <div className="text-xs text-emerald-600">
              {activeToday
                ? t('dashboard.checkin.todayChecked', '今日已打卡')
                : t('dashboard.checkin.todayMissing', '今天还未打卡')}
            </div>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-white/80 p-3">
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <Flame className="h-4 w-4" />
              {t('dashboard.checkin.longestStreak', '历史最长')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-emerald-800">{longestStreak}</div>
            <div className="text-xs text-emerald-600">
              {t('dashboard.checkin.totalDays', '累计打卡 {{count}} 天', { count: totalDays })}
            </div>
          </div>
          <div className="rounded-lg border border-emerald-100 bg-white/80 p-3">
            <div className="flex items-center gap-2 text-sm text-emerald-700">
              <RefreshCcw className="h-4 w-4" />
              {t('dashboard.checkin.makeupQuota', '补打卡额度')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-emerald-800">
              {remaining ?? '--'}
            </div>
            <div className="text-xs text-emerald-600">{t('dashboard.checkin.monthlyReset', '每月重置')}</div>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-100 bg-white/90 p-3">
          <Calendar
            mode="single"
            selected={selectedDay}
            onSelect={setSelectedDay}
            month={month}
            onMonthChange={onMonthChange}
            disabled={{ after: todayDate }}
            modifiers={{
              checked: checkinDates,
              makeup: makeupDates,
              today: todayDate,
            }}
            modifiersClassNames={{
              checked: 'bg-emerald-500 text-white hover:bg-emerald-600',
              makeup: 'bg-amber-400 text-white hover:bg-amber-500',
            }}
            classNames={{
              day_today: 'bg-emerald-100 text-emerald-900',
            }}
          />

          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-500" />
              {t('dashboard.checkin.legendActive', '提交日活跃')}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              {t('dashboard.checkin.legendMakeup', '补打卡')}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-100 bg-white/80 p-3">
          <div className="text-sm text-emerald-700 font-medium">
            {selectedDay
              ? t('dashboard.checkin.selectedDate', '已选择 {{date}}', { date: selectedKey })
              : t('dashboard.checkin.selectHint', '选择日期以查看状态')}
          </div>
          <div className="mt-1 text-xs text-emerald-600">
            {selectedDay
              ? selectedCheckin
                ? `${t('dashboard.checkin.statusChecked', '已打卡')} · ${
                  selectedCheckin.source === 'makeup'
                    ? t('dashboard.checkin.statusMakeup', '补打卡')
                    : t('dashboard.checkin.statusRecord', '提交记录')
                }`
                : isFutureSelected
                  ? t('dashboard.checkin.statusFuture', '未来日期不可补打卡')
                  : t('dashboard.checkin.statusMissing', '未打卡')
              : t('dashboard.checkin.selectHelper', '点击日历上的日期后，可补打卡缺失的日子。')}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleMakeup}
              disabled={!canMakeup || loading}
              className={cn(!canMakeup && 'opacity-60')}
            >
              {t('dashboard.checkin.makeupAction', '去补打卡')}
            </Button>
            {remaining === 0 && (
              <span className="text-xs text-amber-600">{t('dashboard.checkin.makeupQuotaUsed', '本月补打卡额度已用完')}</span>
            )}
            {canMakeup && (
              <span className="text-xs text-emerald-600">{t('dashboard.checkin.makeupHint', '将跳转到提交活动页面完成补打卡')}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
