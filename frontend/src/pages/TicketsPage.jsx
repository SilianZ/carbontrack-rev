import Silian_React, { useEffect as Silian_useEffect, useMemo as Silian_useMemo, useState as Silian_useState } from 'react';
import { Link as Silian_Link, useNavigate as Silian_useNavigate } from 'react-router-dom';
import { useQuery as Silian_useQuery } from 'react-query';
import { ArrowRight as Silian_ArrowRight, Clock3 as Silian_Clock3, Ticket as Silian_Ticket } from 'lucide-react';

import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { ticketAPI as Silian_ticketAPI } from '../lib/api';
import { formatSupportDate as Silian_formatSupportDate, getPriorityVariant as Silian_getPriorityVariant, getSlaMeta as Silian_getSlaMeta, getSlaMilestoneMeta as Silian_getSlaMilestoneMeta, getSlaTone as Silian_getSlaTone, getStatusTone as Silian_getStatusTone, TICKET_STATUS_OPTIONS as Silian_TICKET_STATUS_OPTIONS } from '../lib/supportTickets';
import { Button as Silian_Button } from '../components/ui/Button';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../components/ui/Card';
import { Badge as Silian_Badge } from '../components/ui/badge';
import {
  Select as Silian_Select,
  SelectContent as Silian_SelectContent,
  SelectItem as Silian_SelectItem,
  SelectTrigger as Silian_SelectTrigger,
  SelectValue as Silian_SelectValue,
} from '../components/ui/select';

function Silian_UserQueueItem({ ticket: Silian_ticket, selected: Silian_selected, onSelect: Silian_onSelect, t: Silian_t, locale: Silian_locale }) {
  const Silian_slaMeta = Silian_getSlaMeta(Silian_ticket, Silian_locale);

  return (
    <button
      type="button"
      onClick={() => Silian_onSelect(Silian_ticket.id)}
      aria-pressed={Silian_selected}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
        Silian_selected
          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
          : 'border-border bg-background hover:border-emerald-200 dark:hover:border-emerald-500/20'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">#{Silian_ticket.id}</p>
          <p className="mt-2 truncate font-medium">{Silian_ticket.subject}</p>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{Silian_ticket.latest_message_preview || '--'}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
          <Silian_Ticket className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
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

      <p className="mt-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">
        {Silian_formatSupportDate(Silian_ticket.last_replied_at || Silian_ticket.created_at, Silian_locale)} · {Silian_slaMeta.relativeLabel}
      </p>
    </button>
  );
}

function Silian_TicketPreview({ ticket: Silian_ticket, t: Silian_t, locale: Silian_locale }) {
  if (!Silian_ticket) {
    return (
      <Silian_Card className="border-dashed">
        <Silian_CardContent className="flex min-h-[320px] items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-semibold">{Silian_t('support.userList.emptyTitle')}</p>
            <p className="mt-2 text-sm text-muted-foreground">{Silian_t('support.userList.emptyDescription')}</p>
          </div>
        </Silian_CardContent>
      </Silian_Card>
    );
  }

  const Silian_slaMeta = Silian_getSlaMeta(Silian_ticket, Silian_locale);
  const Silian_firstResponseMeta = Silian_getSlaMilestoneMeta(Silian_ticket, 'first_response', Silian_locale);
  const Silian_resolutionMeta = Silian_getSlaMilestoneMeta(Silian_ticket, 'resolution', Silian_locale);

  return (
    <Silian_Card>
      <Silian_CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">#{Silian_ticket.id}</p>
            <Silian_CardTitle className="mt-2 text-2xl">{Silian_ticket.subject}</Silian_CardTitle>
            <Silian_CardDescription className="mt-2">{Silian_ticket.latest_message_preview || '--'}</Silian_CardDescription>
          </div>
          <Silian_Link to={`/tickets/${Silian_ticket.id}`} className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
            {Silian_t('support.portal.openTicket')}
          </Silian_Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Silian_Badge variant="outline" className={Silian_getStatusTone(Silian_ticket.status)}>
            {Silian_t(`support.statuses.${Silian_ticket.status}`)}
          </Silian_Badge>
          <Silian_Badge variant={Silian_getPriorityVariant(Silian_ticket.priority)}>
            {Silian_t(`support.priorities.${Silian_ticket.priority}`)}
          </Silian_Badge>
          <Silian_Badge variant="outline">{Silian_t(`support.categories.${Silian_ticket.category}`)}</Silian_Badge>
          {Silian_slaMeta.state ? (
            <Silian_Badge variant="outline" className={Silian_getSlaTone(Silian_slaMeta.state)}>
              {Silian_t(`support.slaStatuses.${Silian_slaMeta.state}`, { defaultValue: Silian_slaMeta.state })}
            </Silian_Badge>
          ) : null}
        </div>
      </Silian_CardHeader>
      <Silian_CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-muted/30 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{Silian_t('support.thread.createdAt')}</p>
            <p className="mt-2 text-sm font-medium">{Silian_formatSupportDate(Silian_ticket.created_at, Silian_locale)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{Silian_t('support.thread.lastReply')}</p>
            <p className="mt-2 text-sm font-medium">{Silian_formatSupportDate(Silian_ticket.last_replied_at || Silian_ticket.updated_at || Silian_ticket.created_at, Silian_locale)}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-muted/30 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{Silian_t('support.portal.firstResponseDueLabel')}</p>
            <p className="mt-2 text-sm font-medium">{Silian_firstResponseMeta.dueAtLabel}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{Silian_firstResponseMeta.relativeLabel}</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{Silian_t('support.portal.resolutionDueLabel')}</p>
            <p className="mt-2 text-sm font-medium">{Silian_resolutionMeta.dueAtLabel}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{Silian_resolutionMeta.relativeLabel}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/30 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{Silian_t('support.thread.messageCount')}</p>
          <p className="mt-2 text-sm font-medium">{Silian_ticket.message_count ?? 0}</p>
        </div>
      </Silian_CardContent>
    </Silian_Card>
  );
}

export default function TicketsPage() {
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['common', 'date', 'support']);
  const Silian_navigate = Silian_useNavigate();
  const [Silian_status, Silian_setStatus] = Silian_useState('all');
  const [Silian_selectedTicketId, Silian_setSelectedTicketId] = Silian_useState(null);
  const Silian_locale = Silian_currentLanguage === 'zh' ? 'zh-CN' : 'en-US';

  const Silian_ticketsQuery = Silian_useQuery(
    ['user-tickets', Silian_status],
    () => Silian_ticketAPI.getTickets(Silian_status === 'all' ? { limit: 20 } : { limit: 20, status: Silian_status }),
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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">
            {Silian_t('support.userList.eyebrow')}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{Silian_t('support.userList.title')}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{Silian_t('support.userList.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Silian_Select value={Silian_status} onValueChange={Silian_setStatus}>
            <Silian_SelectTrigger className="w-full min-w-[180px] sm:w-[220px]">
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
          <Silian_Button className="rounded-full" onClick={() => Silian_navigate('/help')}>
            <Silian_Ticket className="mr-2 h-4 w-4" />
            {Silian_t('support.userList.newTicket')}
          </Silian_Button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.8fr)]">
        <Silian_Card>
          <Silian_CardHeader>
            <Silian_CardTitle>{Silian_t('support.userList.queueTitle')}</Silian_CardTitle>
            <Silian_CardDescription>{Silian_t('support.userList.queueSubtitle')}</Silian_CardDescription>
          </Silian_CardHeader>
          <Silian_CardContent className="space-y-3">
            {Silian_ticketsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Silian_Clock3 className="h-4 w-4 animate-pulse" />
                {Silian_t('common.loading')}
              </div>
            ) : null}

            {!Silian_ticketsQuery.isLoading && Silian_tickets.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-border px-6 py-12 text-center">
                <p className="text-lg font-medium">{Silian_t('support.userList.emptyTitle')}</p>
                <p className="mt-2 text-sm text-muted-foreground">{Silian_t('support.userList.emptyDescription')}</p>
                <Silian_Link to="/help" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-emerald-600">
                  {Silian_t('support.userList.emptyAction')}
                  <Silian_ArrowRight className="h-4 w-4" />
                </Silian_Link>
              </div>
            ) : null}

            {Silian_tickets.map((Silian_ticket) => (
              <Silian_UserQueueItem
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

        <Silian_TicketPreview ticket={Silian_selectedTicket} t={Silian_t} locale={Silian_locale} />
      </div>
    </div>
  );
}
