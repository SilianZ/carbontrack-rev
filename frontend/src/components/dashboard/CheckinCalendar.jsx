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
  const { t } = useTranslation(['dashboard']);
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
    <Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-sky-500/10">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg font-semibold text-emerald-500">
              <CalendarDays className="h-5 w-5" />
              {t('dashboard.checkin.calendarTitle')}
            </CardTitle>
            <CardDescription className="text-sm text-emerald-400">
              {t('dashboard.checkin.calendarDescription')}
            </CardDescription>
          </div>
          {typeof remaining === 'number' && (
            <Badge variant="secondary" className="bg-emerald-500/15 text-emerald-500">
              {t('dashboard.checkin.makeupRemaining',  { count: remaining })}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-emerald-500/20 bg-card/90 p-3">
            <div className="flex items-center gap-2 text-sm text-emerald-500">
              <Flame className="h-4 w-4" />
              {t('dashboard.checkin.currentStreak')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{currentStreak}</div>
            <div className="text-xs text-emerald-400">
              {activeToday
                ? t('dashboard.checkin.todayChecked')
                : t('dashboard.checkin.todayMissing')}
            </div>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-card/90 p-3">
            <div className="flex items-center gap-2 text-sm text-emerald-500">
              <Flame className="h-4 w-4" />
              {t('dashboard.checkin.longestStreak')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{longestStreak}</div>
            <div className="text-xs text-emerald-400">
              {t('dashboard.checkin.totalDays',  { count: totalDays })}
            </div>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-card/90 p-3">
            <div className="flex items-center gap-2 text-sm text-emerald-500">
              <RefreshCcw className="h-4 w-4" />
              {t('dashboard.checkin.makeupQuota')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {remaining ?? '--'}
            </div>
            <div className="text-xs text-emerald-400">{t('dashboard.checkin.monthlyReset')}</div>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-500/20 bg-card/95 p-3">
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
              {t('dashboard.checkin.legendActive')}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              {t('dashboard.checkin.legendMakeup')}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-500/20 bg-card/90 p-3">
          <div className="text-sm font-medium text-foreground">
            {selectedDay
              ? t('dashboard.checkin.selectedDate',  { date: selectedKey })
              : t('dashboard.checkin.selectHint')}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {selectedDay
              ? selectedCheckin
                ? `${t('dashboard.checkin.statusChecked')} · ${
                  selectedCheckin.source === 'makeup'
                    ? t('dashboard.checkin.statusMakeup')
                    : t('dashboard.checkin.statusRecord')
                }`
                : isFutureSelected
                  ? t('dashboard.checkin.statusFuture')
                  : t('dashboard.checkin.statusMissing')
              : t('dashboard.checkin.selectHelper')}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button
              size="sm"
              onClick={handleMakeup}
              disabled={!canMakeup || loading}
              className={cn(!canMakeup && 'opacity-60')}
            >
              {t('dashboard.checkin.makeupAction')}
            </Button>
            {remaining === 0 && (
              <span className="text-xs text-amber-500">{t('dashboard.checkin.makeupQuotaUsed')}</span>
            )}
            {canMakeup && (
              <span className="text-xs text-emerald-500">{t('dashboard.checkin.makeupHint')}</span>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
