import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { ArrowRight, Clock3, Search, UserRound } from 'lucide-react';

import { useTranslation } from '../../hooks/useTranslation';
import { useDebouncedValue } from '../../hooks/useLogSearch';
import { supportAPI } from '../../lib/api';
import { formatSupportDate, getPriorityVariant, getSlaMeta, getSlaMilestoneMeta, getSlaTone, getStatusTone, getTagTone, TICKET_STATUS_OPTIONS } from '../../lib/supportTickets';
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

function QueueItem({ ticket, selected, onSelect, t, locale }) {
  const slaMeta = getSlaMeta(ticket, locale);

  return (
    <button
      type="button"
      onClick={() => onSelect(ticket.id)}
      aria-pressed={selected}
      className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
        selected
          ? 'border-sky-300 bg-sky-50/80 dark:border-sky-400/40 dark:bg-sky-500/10'
          : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:border-sky-400/20 dark:hover:bg-white/10'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">#{ticket.id}</span>
            <p className="truncate text-sm font-semibold">{ticket.subject}</p>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{ticket.latest_message_preview || t('support.portal.noPreview')}</p>
        </div>
        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Badge variant="outline" className={getStatusTone(ticket.status)}>
          {t(`support.statuses.${ticket.status}`)}
        </Badge>
        <Badge variant={getPriorityVariant(ticket.priority)}>
          {t(`support.priorities.${ticket.priority}`)}
        </Badge>
        {slaMeta.state ? (
          <Badge variant="outline" className={getSlaTone(slaMeta.state)}>
            {t(`support.slaStatuses.${slaMeta.state}`, { defaultValue: slaMeta.state })}
          </Badge>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
        <span>{ticket.requester?.username || ticket.requester?.email || t('support.portal.unknownRequester')}</span>
        <span>{formatSupportDate(ticket.last_replied_at || ticket.created_at, locale)}</span>
        <span>{slaMeta.relativeLabel}</span>
      </div>
    </button>
  );
}

function PreviewPanel({ ticket, t, locale }) {
  if (!ticket) {
    return (
      <Card className="h-full border-dashed border-slate-300 bg-slate-50/80 shadow-none dark:border-white/10 dark:bg-white/5">
        <CardContent className="flex h-full min-h-[420px] items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-semibold">{t('support.portal.previewEmptyTitle')}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('support.portal.previewEmptySubtitle')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const slaMeta = getSlaMeta(ticket, locale);
  const firstResponseMeta = getSlaMilestoneMeta(ticket, 'first_response', locale);
  const resolutionMeta = getSlaMilestoneMeta(ticket, 'resolution', locale);

  return (
    <Card className="border-slate-200/80 shadow-sm dark:border-white/10">
      <CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">#{ticket.id}</p>
            <CardTitle className="mt-2 text-xl">{ticket.subject}</CardTitle>
            <CardDescription className="mt-2">{ticket.latest_message_preview || t('support.portal.noPreview')}</CardDescription>
          </div>
          <Link
            to={`/support/tickets/${ticket.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:text-slate-200 dark:hover:border-sky-400/30 dark:hover:text-sky-200"
          >
            {t('support.portal.openTicket')}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={getStatusTone(ticket.status)}>
            {t(`support.statuses.${ticket.status}`)}
          </Badge>
          <Badge variant={getPriorityVariant(ticket.priority)}>
            {t(`support.priorities.${ticket.priority}`)}
          </Badge>
          <Badge variant="outline">
            {t(`support.categories.${ticket.category}`)}
          </Badge>
          {slaMeta.state ? (
            <Badge variant="outline" className={getSlaTone(slaMeta.state)}>
              {t(`support.slaStatuses.${slaMeta.state}`, { defaultValue: slaMeta.state })}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t('support.portal.previewRequester')}</p>
            <p className="mt-2 text-sm font-semibold">{ticket.requester?.username || ticket.requester?.email || '--'}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{ticket.requester?.email || '--'}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t('support.portal.previewAssignee')}</p>
            <p className="mt-2 text-sm font-semibold">{ticket.assigned_user?.username || t('support.portal.unassigned')}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{ticket.assignment_source || '--'}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t('support.portal.firstResponseDueLabel')}</p>
            <p className="mt-2 text-sm font-semibold">{firstResponseMeta.dueAtLabel}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{firstResponseMeta.relativeLabel}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t('support.portal.resolutionDueLabel')}</p>
            <p className="mt-2 text-sm font-semibold">{resolutionMeta.dueAtLabel}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{resolutionMeta.relativeLabel}</p>
          </div>
        </div>

        {(ticket.tags ?? []).length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{t('support.portal.tagsTitle')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(ticket.tags ?? []).map((tag) => (
                <Badge key={tag.id} variant="outline" className={getTagTone(tag.color)}>
                  {tag.name}
                </Badge>
              ))}
            </div>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}

export default function SupportTicketsPage() {
  const { t, currentLanguage } = useTranslation();
  const locale = currentLanguage === 'zh' ? 'zh-CN' : 'en-US';
  const [status, setStatus] = useState('all');
  const [assignee, setAssignee] = useState('all');
  const [search, setSearch] = useState('');
  const [selectedTicketId, setSelectedTicketId] = useState(null);
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
    { refetchOnWindowFocus: false }
  );

  const tickets = useMemo(
    () => ticketsQuery.data?.data?.data?.items ?? [],
    [ticketsQuery.data]
  );
  const assignees = useMemo(
    () => assigneesQuery.data ?? [],
    [assigneesQuery.data]
  );

  useEffect(() => {
    if (!tickets.length) {
      setSelectedTicketId(null);
      return;
    }
    setSelectedTicketId((current) => {
      if (current && tickets.some((ticket) => ticket.id === current)) {
        return current;
      }
      return tickets[0].id;
    });
  }, [tickets]);

  const selectedTicket = useMemo(
    () => tickets.find((ticket) => ticket.id === selectedTicketId) ?? null,
    [tickets, selectedTicketId]
  );

  return (
    <div className="space-y-5">
      <section className="rounded-[1.8rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f5fbff_100%)] px-5 py-5 dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.92)_0%,rgba(15,118,110,0.18)_100%)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600/80 dark:text-sky-300/80">
          {t('support.portal.queueEyebrow')}
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">{t('support.portal.queueTitle')}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          {t('support.portal.queueSubtitle')}
        </p>
      </section>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative min-w-[240px] flex-1 xl:max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t('support.portal.searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Select value={status} onValueChange={setStatus}>
            <SelectTrigger className="min-w-[180px]">
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
            <SelectTrigger className="min-w-[240px]">
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
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)]">
        <Card className="border-slate-200/80 shadow-sm dark:border-white/10">
          <CardHeader>
            <CardTitle>{t('support.portal.queueListTitle')}</CardTitle>
            <CardDescription>{t('support.portal.queueListSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ticketsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Clock3 className="h-4 w-4 animate-pulse" />
                {t('common.loading')}
              </div>
            ) : null}

            {!ticketsQuery.isLoading && tickets.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 px-6 py-12 text-center dark:border-white/10">
                <p className="text-lg font-semibold">{t('support.portal.emptyTitle')}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{t('support.portal.emptyDescription')}</p>
              </div>
            ) : null}

            {tickets.map((ticket) => (
              <QueueItem
                key={ticket.id}
                ticket={ticket}
                selected={ticket.id === selectedTicketId}
                onSelect={setSelectedTicketId}
                t={t}
                locale={locale}
              />
            ))}
          </CardContent>
        </Card>

        <PreviewPanel ticket={selectedTicket} t={t} locale={locale} />
      </div>
    </div>
  );
}
