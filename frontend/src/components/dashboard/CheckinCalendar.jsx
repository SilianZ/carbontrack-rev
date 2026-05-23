import Silian_React, { useMemo as Silian_useMemo, useState as Silian_useState } from 'react';
import { format as Silian_format, isAfter as Silian_isAfter } from 'date-fns';
import { Calendar as Silian_Calendar } from '../ui/calendar';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../ui/Card';
import { Button as Silian_Button } from '../ui/Button';
import { Badge as Silian_Badge } from '../ui/badge';
import { CalendarDays as Silian_CalendarDays, Flame as Silian_Flame, RefreshCcw as Silian_RefreshCcw } from 'lucide-react';
import { cn as Silian_cn } from '../../lib/utils';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';

const Silian_toDateKey = (Silian_date) => Silian_format(Silian_date, 'yyyy-MM-dd');

export function CheckinCalendar({
  checkins: Silian_checkins = [],
  stats: Silian_stats = {},
  quota: Silian_quota = {},
  meta: Silian_meta = {},
  month: Silian_month,
  loading: Silian_loading = false,
  onMonthChange: Silian_onMonthChange,
  onMakeup: Silian_onMakeup,
}) {
  const { t: Silian_t } = Silian_useTranslation(['dashboard']);
  const [Silian_selectedDay, Silian_setSelectedDay] = Silian_useState(null);

  const Silian_checkinMap = Silian_useMemo(() => {
    const Silian_map = new Map();
    Silian_checkins.forEach((Silian_item) => {
      if (Silian_item?.date) {
        Silian_map.set(Silian_item.date, Silian_item);
      }
    });
    return Silian_map;
  }, [Silian_checkins]);

  const { checkinDates: Silian_checkinDates, makeupDates: Silian_makeupDates } = Silian_useMemo(() => {
    const Silian_dates = [];
    const Silian_makeup = [];
    Silian_checkins.forEach((Silian_item) => {
      if (!Silian_item?.date) return;
      const Silian_date = new Date(`${Silian_item.date}T00:00:00`);
      Silian_dates.push(Silian_date);
      if (Silian_item.source === 'makeup') {
        Silian_makeup.push(Silian_date);
      }
    });
    return { checkinDates: Silian_dates, makeupDates: Silian_makeup };
  }, [Silian_checkins]);

  const Silian_selectedKey = Silian_selectedDay ? Silian_toDateKey(Silian_selectedDay) : '';
  const Silian_selectedCheckin = Silian_selectedKey ? Silian_checkinMap.get(Silian_selectedKey) : null;
  const Silian_serverToday = Silian_meta?.server_today ? new Date(`${Silian_meta.server_today}T00:00:00`) : null;
  const Silian_todayDate = Silian_serverToday ?? new Date();
  const Silian_isFutureSelected = Silian_selectedDay ? Silian_isAfter(Silian_selectedDay, Silian_todayDate) : false;
  const Silian_remaining = Silian_quota?.remaining ?? null;
  const Silian_canMakeup = Boolean(Silian_selectedDay && !Silian_selectedCheckin && !Silian_isFutureSelected && Silian_remaining !== null && Silian_remaining > 0);

  const Silian_handleMakeup = () => {
    if (!Silian_selectedDay || !Silian_onMakeup) return;
    Silian_onMakeup({ date: Silian_selectedKey });
  };

  const Silian_currentStreak = Silian_stats?.current_streak ?? 0;
  const Silian_longestStreak = Silian_stats?.longest_streak ?? 0;
  const Silian_totalDays = Silian_stats?.total_days ?? 0;
  const Silian_activeToday = Silian_stats?.active_today ?? false;

  return (
    <Silian_Card className="border-emerald-500/20 bg-gradient-to-br from-emerald-500/10 via-card to-sky-500/10">
      <Silian_CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-3">
          <div>
            <Silian_CardTitle className="flex items-center gap-2 text-lg font-semibold text-emerald-500">
              <Silian_CalendarDays className="h-5 w-5" />
              {Silian_t('dashboard.checkin.calendarTitle')}
            </Silian_CardTitle>
            <Silian_CardDescription className="text-sm text-emerald-400">
              {Silian_t('dashboard.checkin.calendarDescription')}
            </Silian_CardDescription>
          </div>
          {typeof Silian_remaining === 'number' && (
            <Silian_Badge variant="secondary" className="bg-emerald-500/15 text-emerald-500">
              {Silian_t('dashboard.checkin.makeupRemaining',  { count: Silian_remaining })}
            </Silian_Badge>
          )}
        </div>
      </Silian_CardHeader>
      <Silian_CardContent className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-lg border border-emerald-500/20 bg-card/90 p-3">
            <div className="flex items-center gap-2 text-sm text-emerald-500">
              <Silian_Flame className="h-4 w-4" />
              {Silian_t('dashboard.checkin.currentStreak')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{Silian_currentStreak}</div>
            <div className="text-xs text-emerald-400">
              {Silian_activeToday
                ? Silian_t('dashboard.checkin.todayChecked')
                : Silian_t('dashboard.checkin.todayMissing')}
            </div>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-card/90 p-3">
            <div className="flex items-center gap-2 text-sm text-emerald-500">
              <Silian_Flame className="h-4 w-4" />
              {Silian_t('dashboard.checkin.longestStreak')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">{Silian_longestStreak}</div>
            <div className="text-xs text-emerald-400">
              {Silian_t('dashboard.checkin.totalDays',  { count: Silian_totalDays })}
            </div>
          </div>
          <div className="rounded-lg border border-emerald-500/20 bg-card/90 p-3">
            <div className="flex items-center gap-2 text-sm text-emerald-500">
              <Silian_RefreshCcw className="h-4 w-4" />
              {Silian_t('dashboard.checkin.makeupQuota')}
            </div>
            <div className="mt-1 text-2xl font-semibold text-foreground">
              {Silian_remaining ?? '--'}
            </div>
            <div className="text-xs text-emerald-400">{Silian_t('dashboard.checkin.monthlyReset')}</div>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-500/20 bg-card/95 p-3">
          <Silian_Calendar
            mode="single"
            selected={Silian_selectedDay}
            onSelect={Silian_setSelectedDay}
            month={Silian_month}
            onMonthChange={Silian_onMonthChange}
            disabled={{ after: Silian_todayDate }}
            modifiers={{
              checked: Silian_checkinDates,
              makeup: Silian_makeupDates,
              today: Silian_todayDate,
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
              {Silian_t('dashboard.checkin.legendActive')}
            </span>
            <span className="inline-flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-amber-400" />
              {Silian_t('dashboard.checkin.legendMakeup')}
            </span>
          </div>
        </div>

        <div className="rounded-lg border border-emerald-500/20 bg-card/90 p-3">
          <div className="text-sm font-medium text-foreground">
            {Silian_selectedDay
              ? Silian_t('dashboard.checkin.selectedDate',  { date: Silian_selectedKey })
              : Silian_t('dashboard.checkin.selectHint')}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {Silian_selectedDay
              ? Silian_selectedCheckin
                ? `${Silian_t('dashboard.checkin.statusChecked')} · ${
                  Silian_selectedCheckin.source === 'makeup'
                    ? Silian_t('dashboard.checkin.statusMakeup')
                    : Silian_t('dashboard.checkin.statusRecord')
                }`
                : Silian_isFutureSelected
                  ? Silian_t('dashboard.checkin.statusFuture')
                  : Silian_t('dashboard.checkin.statusMissing')
              : Silian_t('dashboard.checkin.selectHelper')}
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Silian_Button
              size="sm"
              onClick={Silian_handleMakeup}
              disabled={!Silian_canMakeup || Silian_loading}
              className={Silian_cn(!Silian_canMakeup && 'opacity-60')}
            >
              {Silian_t('dashboard.checkin.makeupAction')}
            </Silian_Button>
            {Silian_remaining === 0 && (
              <span className="text-xs text-amber-500">{Silian_t('dashboard.checkin.makeupQuotaUsed')}</span>
            )}
            {Silian_canMakeup && (
              <span className="text-xs text-emerald-500">{Silian_t('dashboard.checkin.makeupHint')}</span>
            )}
          </div>
        </div>
      </Silian_CardContent>
    </Silian_Card>
  );
}
