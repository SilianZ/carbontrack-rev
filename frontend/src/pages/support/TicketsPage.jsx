import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { ArrowRight, Search, UserRound } from 'lucide-react';

import { useTranslation } from '../../hooks/useTranslation';
import { useDebouncedValue } from '../../hooks/useLogSearch';
import { supportAPI } from '../../lib/api';
import { formatSupportDate, getPriorityVariant, getStatusTone, getTagTone, TICKET_STATUS_OPTIONS } from '../../lib/supportTickets';
import { Input } from '../../components/ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

export default function SupportTicketsPage() {
  const { t, currentLanguage } = useTranslation();
  const [status, setStatus] = useState('all');
  const [assignee, setAssignee] = useState('all');
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search.trim(), 400);

  const ticketsQuery = useQuery(
    ['support-queue', status, assignee, debouncedSearch],
    () => supportAPI.getTickets({
      limit: 30,
      ...(status !== 'all' ? { status } : {}),
      ...(assignee !== 'all' ? { assigned_to: assignee === 'none' ? 0 : Number(assignee) } : {}),
      ...(debouncedSearch ? { q: debouncedSearch } : {}),
    }),
    {
      keepPreviousData: true,
      refetchOnWindowFocus: false,
    }
  );

  const assigneesQuery = useQuery(
    ['support-assignees'],
    async () => {
      const response = await supportAPI.getAssignees();
      return response.data?.data ?? [];
    },
    {
      refetchOnWindowFocus: false,
    }
  );

  const tickets = ticketsQuery.data?.data?.data?.items ?? [];
  const assignees = assigneesQuery.data ?? [];
  const stats = useMemo(() => ({
    total: tickets.length,
    open: tickets.filter((ticket) => ticket.status === 'open').length,
    waiting: tickets.filter((ticket) => ticket.status === 'waiting_user').length,
    urgent: tickets.filter((ticket) => ticket.priority === 'urgent').length,
  }), [tickets]);

  return (
    <div className="space-y-6">
      <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
        <div className="rounded-[1.8rem] border border-slate-200 bg-slate-50 px-5 py-5 dark:border-slate-800 dark:bg-slate-950/40">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            {t('support.portal.queueEyebrow')}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">
            {t('support.portal.queueTitle')}
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-500 dark:text-slate-400">
            {t('support.portal.queueSubtitle')}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 xl:grid-cols-1">
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{t('support.portal.stats.total')}</p>
              <p className="mt-3 text-3xl font-semibold">{stats.total}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{t('support.portal.stats.open')}</p>
              <p className="mt-3 text-3xl font-semibold">{stats.open}</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">{t('support.portal.stats.urgent')}</p>
              <p className="mt-3 text-3xl font-semibold">{stats.urgent}</p>
            </CardContent>
          </Card>
        </div>
      </section>

      <Card>
        <CardHeader>
          <CardTitle>{t('support.portal.workload.title')}</CardTitle>
          <CardDescription>{t('support.portal.workload.subtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {assigneesQuery.isLoading && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading')}</p>
          )}

          {!assigneesQuery.isLoading && assignees.length === 0 && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('support.portal.workload.empty')}</p>
          )}

          {assignees.map((assignee) => (
            <div
              key={assignee.id}
              className="flex flex-col gap-3 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-800 dark:bg-slate-950/30 lg:flex-row lg:items-center lg:justify-between"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="flex h-9 w-9 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                    <UserRound className="h-4 w-4" />
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{assignee.username || assignee.email || `#${assignee.id}`}</p>
                    <p className="truncate text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                      {t(`support.portal.roles.${assignee.role}`)}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3 text-center lg:min-w-[320px]">
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t('support.portal.workload.assigned')}
                  </p>
                  <p className="mt-2 text-xl font-semibold">{assignee.assigned_total_count ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t('support.portal.workload.notStarted')}
                  </p>
                  <p className="mt-2 text-xl font-semibold">{assignee.open_count ?? 0}</p>
                </div>
                <div className="rounded-2xl border border-slate-200 bg-white px-3 py-3 dark:border-slate-700 dark:bg-slate-900">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                    {t('support.portal.workload.inProgress')}
                  </p>
                  <p className="mt-2 text-xl font-semibold">{assignee.in_progress_count ?? 0}</p>
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <CardTitle>{t('support.portal.queueListTitle')}</CardTitle>
            <CardDescription>{t('support.portal.queueListSubtitle')}</CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder={t('support.portal.searchPlaceholder')}
                className="pl-9"
              />
            </div>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger className="w-full min-w-[180px] sm:w-[220px]">
                <SelectValue placeholder={t('support.filters.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('support.filters.allStatuses')}</SelectItem>
                {TICKET_STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                  {t(option.labelKey)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={assignee} onValueChange={setAssignee}>
              <SelectTrigger className="w-full min-w-[180px] sm:w-[260px]">
                <SelectValue placeholder={t('support.portal.assigneeFilter')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('support.portal.assigneeFilterAll')}</SelectItem>
                <SelectItem value="none">{t('support.portal.assigneeFilterUnassigned')}</SelectItem>
                {assignees.map((entry) => (
                  <SelectItem key={entry.id} value={String(entry.id)}>
                    {entry.username || entry.email || `#${entry.id}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticketsQuery.isLoading && (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading')}</p>
          )}

          {!ticketsQuery.isLoading && tickets.length === 0 && (
            <div className="rounded-[1.6rem] border border-dashed border-slate-200 px-6 py-12 text-center dark:border-slate-800">
              <p className="text-lg font-medium">{t('support.portal.emptyTitle')}</p>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('support.portal.emptyDescription')}</p>
            </div>
          )}

          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              to={`/support/tickets/${ticket.id}`}
              className="block rounded-[1.6rem] border border-slate-200 bg-slate-50 px-5 py-5 transition hover:border-sky-300 hover:bg-sky-50/60 dark:border-slate-800 dark:bg-slate-950/30 dark:hover:border-sky-500/40 dark:hover:bg-slate-950"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-slate-500">#{ticket.id}</span>
                    <h3 className="text-lg font-medium">{ticket.subject}</h3>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{ticket.latest_message_preview}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={getStatusTone(ticket.status)} variant="outline">
                    {t(`support.statuses.${ticket.status}`)}
                  </Badge>
                  <Badge variant={getPriorityVariant(ticket.priority)}>
                    {t(`support.priorities.${ticket.priority}`)}
                  </Badge>
                  {(ticket.tags ?? []).map((tag) => (
                    <Badge key={tag.id} variant="outline" className={getTagTone(tag.color)}>
                      {tag.name}
                    </Badge>
                  ))}
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">
                <span>{ticket.requester?.username || ticket.requester?.email || t('support.portal.unknownRequester')}</span>
                <span>{ticket.requester?.email}</span>
                <span>{formatSupportDate(ticket.last_replied_at || ticket.created_at, currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}</span>
                <span>{t('support.portal.messageCount', { count: ticket.message_count  })}</span>
                <span className="inline-flex items-center gap-1">
                  {ticket.assigned_user?.username || t('support.portal.unassigned')}
                  <ArrowRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
