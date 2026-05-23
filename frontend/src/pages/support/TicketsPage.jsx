import Silian_React, { useEffect as Silian_useEffect, useMemo as Silian_useMemo, useState as Silian_useState } from 'react';
import { Link as Silian_Link } from 'react-router-dom';
import { useQuery as Silian_useQuery } from 'react-query';
import { ArrowRight as Silian_ArrowRight, Clock3 as Silian_Clock3, Search as Silian_Search } from 'lucide-react';

import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { useDebouncedValue as Silian_useDebouncedValue } from '../../hooks/useLogSearch';
import { supportAPI as Silian_supportAPI } from '../../lib/api';
import { formatSupportDate as Silian_formatSupportDate, getPriorityVariant as Silian_getPriorityVariant, getSlaMeta as Silian_getSlaMeta, getSlaMilestoneMeta as Silian_getSlaMilestoneMeta, getSlaTone as Silian_getSlaTone, getStatusTone as Silian_getStatusTone, getTagTone as Silian_getTagTone, TICKET_STATUS_OPTIONS as Silian_TICKET_STATUS_OPTIONS } from '../../lib/supportTickets';
import { Input as Silian_Input } from '../../components/ui/Input';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../../components/ui/Card';
import { Badge as Silian_Badge } from '../../components/ui/badge';
import {
  Select as Silian_Select,
  SelectContent as Silian_SelectContent,
  SelectItem as Silian_SelectItem,
  SelectTrigger as Silian_SelectTrigger,
  SelectValue as Silian_SelectValue,
} from '../../components/ui/select';

function Silian_QueueItem({ ticket: Silian_ticket, selected: Silian_selected, onSelect: Silian_onSelect, t: Silian_t, locale: Silian_locale }) {
  const Silian_slaMeta = Silian_getSlaMeta(Silian_ticket, Silian_locale);

  return (
    <button
      type="button"
      onClick={() => Silian_onSelect(Silian_ticket.id)}
      aria-pressed={Silian_selected}
      className={`w-full rounded-[1.5rem] border px-4 py-4 text-left transition ${
        Silian_selected
          ? 'border-sky-300 bg-sky-50/80 dark:border-sky-400/40 dark:bg-sky-500/10'
          : 'border-slate-200 bg-white hover:border-sky-200 hover:bg-slate-50 dark:border-white/10 dark:bg-white/5 dark:hover:border-sky-400/20 dark:hover:bg-white/10'
      }`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">#{Silian_ticket.id}</span>
            <p className="truncate text-sm font-semibold">{Silian_ticket.subject}</p>
          </div>
          <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{Silian_ticket.latest_message_preview || Silian_t('support.portal.noPreview')}</p>
        </div>
        <Silian_ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-400" />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-2">
        <Silian_Badge variant="outline" className={Silian_getStatusTone(Silian_ticket.status)}>
          {Silian_t(`support.statuses.${Silian_ticket.status}`)}
        </Silian_Badge>
        <Silian_Badge variant={Silian_getPriorityVariant(Silian_ticket.priority)}>
          {Silian_t(`support.priorities.${Silian_ticket.priority}`)}
        </Silian_Badge>
        {Silian_slaMeta.state ? (
          <Silian_Badge variant="outline" className={Silian_getSlaTone(Silian_slaMeta.state)}>
            {Silian_t(`support.slaStatuses.${Silian_slaMeta.state}`, { defaultValue: Silian_slaMeta.state })}
          </Silian_Badge>
        ) : null}
      </div>

      <div className="mt-3 flex flex-wrap gap-3 text-xs uppercase tracking-[0.2em] text-slate-400">
        <span>{Silian_ticket.requester?.username || Silian_ticket.requester?.email || Silian_t('support.portal.unknownRequester')}</span>
        <span>{Silian_formatSupportDate(Silian_ticket.last_replied_at || Silian_ticket.created_at, Silian_locale)}</span>
        <span>{Silian_slaMeta.relativeLabel}</span>
      </div>
    </button>
  );
}

function Silian_PreviewPanel({ ticket: Silian_ticket, t: Silian_t, locale: Silian_locale }) {
  if (!Silian_ticket) {
    return (
      <Silian_Card className="h-full border-dashed border-slate-300 bg-slate-50/80 shadow-none dark:border-white/10 dark:bg-white/5">
        <Silian_CardContent className="flex h-full min-h-[420px] items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-semibold">{Silian_t('support.portal.previewEmptyTitle')}</p>
            <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{Silian_t('support.portal.previewEmptySubtitle')}</p>
          </div>
        </Silian_CardContent>
      </Silian_Card>
    );
  }

  const Silian_slaMeta = Silian_getSlaMeta(Silian_ticket, Silian_locale);
  const Silian_firstResponseMeta = Silian_getSlaMilestoneMeta(Silian_ticket, 'first_response', Silian_locale);
  const Silian_resolutionMeta = Silian_getSlaMilestoneMeta(Silian_ticket, 'resolution', Silian_locale);

  return (
    <Silian_Card className="border-slate-200/80 shadow-sm dark:border-white/10">
      <Silian_CardHeader className="space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-400">#{Silian_ticket.id}</p>
            <Silian_CardTitle className="mt-2 text-xl">{Silian_ticket.subject}</Silian_CardTitle>
            <Silian_CardDescription className="mt-2">{Silian_ticket.latest_message_preview || Silian_t('support.portal.noPreview')}</Silian_CardDescription>
          </div>
          <Silian_Link
            to={`/support/tickets/${Silian_ticket.id}`}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 px-3 py-2 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:text-sky-700 dark:border-white/10 dark:text-slate-200 dark:hover:border-sky-400/30 dark:hover:text-sky-200"
          >
            {Silian_t('support.portal.openTicket')}
            <Silian_ArrowRight className="h-4 w-4" />
          </Silian_Link>
        </div>

        <div className="flex flex-wrap gap-2">
          <Silian_Badge variant="outline" className={Silian_getStatusTone(Silian_ticket.status)}>
            {Silian_t(`support.statuses.${Silian_ticket.status}`)}
          </Silian_Badge>
          <Silian_Badge variant={Silian_getPriorityVariant(Silian_ticket.priority)}>
            {Silian_t(`support.priorities.${Silian_ticket.priority}`)}
          </Silian_Badge>
          <Silian_Badge variant="outline">
            {Silian_t(`support.categories.${Silian_ticket.category}`)}
          </Silian_Badge>
          {Silian_slaMeta.state ? (
            <Silian_Badge variant="outline" className={Silian_getSlaTone(Silian_slaMeta.state)}>
              {Silian_t(`support.slaStatuses.${Silian_slaMeta.state}`, { defaultValue: Silian_slaMeta.state })}
            </Silian_Badge>
          ) : null}
        </div>
      </Silian_CardHeader>
      <Silian_CardContent className="space-y-5">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{Silian_t('support.portal.previewRequester')}</p>
            <p className="mt-2 text-sm font-semibold">{Silian_ticket.requester?.username || Silian_ticket.requester?.email || '--'}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{Silian_ticket.requester?.email || '--'}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{Silian_t('support.portal.previewAssignee')}</p>
            <p className="mt-2 text-sm font-semibold">{Silian_ticket.assigned_user?.username || Silian_t('support.portal.unassigned')}</p>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{Silian_ticket.assignment_source || '--'}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{Silian_t('support.portal.firstResponseDueLabel')}</p>
            <p className="mt-2 text-sm font-semibold">{Silian_firstResponseMeta.dueAtLabel}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{Silian_firstResponseMeta.relativeLabel}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{Silian_t('support.portal.resolutionDueLabel')}</p>
            <p className="mt-2 text-sm font-semibold">{Silian_resolutionMeta.dueAtLabel}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{Silian_resolutionMeta.relativeLabel}</p>
          </div>
        </div>

        {(Silian_ticket.tags ?? []).length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">{Silian_t('support.portal.tagsTitle')}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              {(Silian_ticket.tags ?? []).map((Silian_tag) => (
                <Silian_Badge key={Silian_tag.id} variant="outline" className={Silian_getTagTone(Silian_tag.color)}>
                  {Silian_tag.name}
                </Silian_Badge>
              ))}
            </div>
          </div>
        ) : null}
      </Silian_CardContent>
    </Silian_Card>
  );
}

export default function SupportTicketsPage() {
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['common', 'date', 'support']);
  const Silian_locale = Silian_currentLanguage === 'zh' ? 'zh-CN' : 'en-US';
  const [Silian_status, Silian_setStatus] = Silian_useState('all');
  const [Silian_search, Silian_setSearch] = Silian_useState('');
  const [Silian_selectedTicketId, Silian_setSelectedTicketId] = Silian_useState(null);
  const Silian_debouncedSearch = Silian_useDebouncedValue(Silian_search.trim(), 400);

  const Silian_ticketsQuery = Silian_useQuery(
    ['support-queue', Silian_status, Silian_debouncedSearch],
    () => Silian_supportAPI.getTickets({
      limit: 30,
      ...(Silian_status !== 'all' ? { status: Silian_status } : {}),
      ...(Silian_debouncedSearch ? { q: Silian_debouncedSearch } : {}),
    }),
    {
      keepPreviousData: true,
      refetchOnWindowFocus: false,
    }
  );

  const Silian_tickets = Silian_useMemo(
    () => Silian_ticketsQuery.data?.data?.data?.items ?? [],
    [Silian_ticketsQuery.data]
  );

  Silian_useEffect(() => {
    if (!Silian_tickets.length) {
      Silian_setSelectedTicketId(null);
      return;
    }
    Silian_setSelectedTicketId((Silian_current) => {
      if (Silian_current && Silian_tickets.some((Silian_ticket) => Silian_ticket.id === Silian_current)) {
        return Silian_current;
      }
      return Silian_tickets[0].id;
    });
  }, [Silian_tickets]);

  const Silian_selectedTicket = Silian_useMemo(
    () => Silian_tickets.find((Silian_ticket) => Silian_ticket.id === Silian_selectedTicketId) ?? null,
    [Silian_tickets, Silian_selectedTicketId]
  );

  return (
    <div className="space-y-5">
      <section className="rounded-[1.8rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f5fbff_100%)] px-5 py-5 dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.92)_0%,rgba(15,118,110,0.18)_100%)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600/80 dark:text-sky-300/80">
          {Silian_t('support.portal.queueEyebrow')}
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">{Silian_t('support.portal.queueTitle')}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">
          {Silian_t('support.portal.queueSubtitle')}
        </p>
      </section>

      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative min-w-[240px] flex-1 xl:max-w-md">
          <Silian_Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <Silian_Input
            value={Silian_search}
            onChange={(Silian_event) => Silian_setSearch(Silian_event.target.value)}
            placeholder={Silian_t('support.portal.searchPlaceholder')}
            className="pl-9"
          />
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          <Silian_Select value={Silian_status} onValueChange={Silian_setStatus}>
            <Silian_SelectTrigger className="min-w-[180px]">
              <Silian_SelectValue placeholder={Silian_t('support.filters.status')} />
            </Silian_SelectTrigger>
            <Silian_SelectContent>
              <Silian_SelectItem value="all">{Silian_t('support.filters.allStatuses')}</Silian_SelectItem>
              {Silian_TICKET_STATUS_OPTIONS.map((Silian_option) => (
                <Silian_SelectItem key={Silian_option.value} value={Silian_option.value}>
                  {Silian_t(Silian_option.labelKey)}
                </Silian_SelectItem>
              ))}
            </Silian_SelectContent>
          </Silian_Select>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.75fr)]">
        <Silian_Card className="border-slate-200/80 shadow-sm dark:border-white/10">
          <Silian_CardHeader>
            <Silian_CardTitle>{Silian_t('support.portal.queueListTitle')}</Silian_CardTitle>
            <Silian_CardDescription>{Silian_t('support.portal.queueListSubtitle')}</Silian_CardDescription>
          </Silian_CardHeader>
          <Silian_CardContent className="space-y-3">
            {Silian_ticketsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                <Silian_Clock3 className="h-4 w-4 animate-pulse" />
                {Silian_t('common.loading')}
              </div>
            ) : null}

            {!Silian_ticketsQuery.isLoading && Silian_tickets.length === 0 ? (
              <div className="rounded-[1.5rem] border border-dashed border-slate-200 px-6 py-12 text-center dark:border-white/10">
                <p className="text-lg font-semibold">{Silian_t('support.portal.emptyTitle')}</p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{Silian_t('support.portal.emptyDescription')}</p>
              </div>
            ) : null}

            {Silian_tickets.map((Silian_ticket) => (
              <Silian_QueueItem
                key={Silian_ticket.id}
                ticket={Silian_ticket}
                selected={Silian_ticket.id === Silian_selectedTicketId}
                onSelect={Silian_setSelectedTicketId}
                t={Silian_t}
                locale={Silian_locale}
              />
            ))}
          </Silian_CardContent>
        </Silian_Card>

        <Silian_PreviewPanel ticket={Silian_selectedTicket} t={Silian_t} locale={Silian_locale} />
      </div>
    </div>
  );
}
