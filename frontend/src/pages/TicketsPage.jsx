import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { ArrowRight, Clock3, Ticket } from 'lucide-react';

import { useTranslation } from '../hooks/useTranslation';
import { ticketAPI } from '../lib/api';
import { formatSupportDate, getPriorityVariant, getSlaMeta, getSlaMilestoneMeta, getSlaTone, getStatusTone, TICKET_STATUS_OPTIONS } from '../lib/supportTickets';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../components/ui/select';

function UserQueueItem({ ticket, selected, onSelect, t, locale }) {
  const slaMeta = getSlaMeta(ticket, locale);

  return (
    <button
      type="button"
      onClick={() => onSelect(ticket.id)}
      aria-pressed={selected}
      className={`w-full rounded-2xl border px-4 py-4 text-left transition ${
        selected
          ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10'
          : 'border-border bg-background hover:border-emerald-200 dark:hover:border-emerald-500/20'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">#{ticket.id}</p>
          <p className="mt-2 truncate font-medium">{ticket.subject}</p>
          <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{ticket.latest_message_preview || '--'}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
          <Ticket className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
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

      <p className="mt-3 text-xs uppercase tracking-[0.22em] text-muted-foreground">
        {formatSupportDate(ticket.last_replied_at || ticket.created_at, locale)} · {slaMeta.relativeLabel}
      </p>
    </button>
  );
}

function TicketPreview({ ticket, t, locale }) {
  if (!ticket) {
    return (
      <Card className="border-dashed">
        <CardContent className="flex min-h-[320px] items-center justify-center">
          <div className="text-center">
            <p className="text-lg font-semibold">{t('support.userList.emptyTitle')}</p>
            <p className="mt-2 text-sm text-muted-foreground">{t('support.userList.emptyDescription')}</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const slaMeta = getSlaMeta(ticket, locale);
  const firstResponseMeta = getSlaMilestoneMeta(ticket, 'first_response', locale);
  const resolutionMeta = getSlaMilestoneMeta(ticket, 'resolution', locale);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">#{ticket.id}</p>
            <CardTitle className="mt-2 text-2xl">{ticket.subject}</CardTitle>
            <CardDescription className="mt-2">{ticket.latest_message_preview || '--'}</CardDescription>
          </div>
          <Link to={`/tickets/${ticket.id}`} className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
            {t('support.portal.openTicket')}
          </Link>
        </div>
        <div className="flex flex-wrap gap-2">
          <Badge variant="outline" className={getStatusTone(ticket.status)}>
            {t(`support.statuses.${ticket.status}`)}
          </Badge>
          <Badge variant={getPriorityVariant(ticket.priority)}>
            {t(`support.priorities.${ticket.priority}`)}
          </Badge>
          <Badge variant="outline">{t(`support.categories.${ticket.category}`)}</Badge>
          {slaMeta.state ? (
            <Badge variant="outline" className={getSlaTone(slaMeta.state)}>
              {t(`support.slaStatuses.${slaMeta.state}`, { defaultValue: slaMeta.state })}
            </Badge>
          ) : null}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-muted/30 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('support.thread.createdAt')}</p>
            <p className="mt-2 text-sm font-medium">{formatSupportDate(ticket.created_at, locale)}</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('support.thread.lastReply')}</p>
            <p className="mt-2 text-sm font-medium">{formatSupportDate(ticket.last_replied_at || ticket.updated_at || ticket.created_at, locale)}</p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-muted/30 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('support.portal.firstResponseDueLabel')}</p>
            <p className="mt-2 text-sm font-medium">{firstResponseMeta.dueAtLabel}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{firstResponseMeta.relativeLabel}</p>
          </div>
          <div className="rounded-2xl border border-border bg-muted/30 px-4 py-4">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('support.portal.resolutionDueLabel')}</p>
            <p className="mt-2 text-sm font-medium">{resolutionMeta.dueAtLabel}</p>
            <p className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{resolutionMeta.relativeLabel}</p>
          </div>
        </div>

        <div className="rounded-2xl border border-border bg-muted/30 px-4 py-4">
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-muted-foreground">{t('support.thread.messageCount')}</p>
          <p className="mt-2 text-sm font-medium">{ticket.message_count ?? 0}</p>
        </div>
      </CardContent>
    </Card>
  );
}

export default function TicketsPage() {
  const { t, currentLanguage } = useTranslation(['common', 'date', 'support']);
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const locale = currentLanguage === 'zh' ? 'zh-CN' : 'en-US';

  const ticketsQuery = useQuery(
    ['user-tickets', status],
    () => ticketAPI.getTickets(status === 'all' ? { limit: 20 } : { limit: 20, status }),
    {
      keepPreviousData: true,
      refetchOnWindowFocus: false,
    }
  );

  const tickets = useMemo(
    () => ticketsQuery.data?.data?.data?.items ?? [],
    [ticketsQuery.data]
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
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">
            {t('support.userList.eyebrow')}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">{t('support.userList.title')}</h1>
          <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{t('support.userList.subtitle')}</p>
        </div>
        <div className="flex flex-wrap gap-3">
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
          <Button className="rounded-full" onClick={() => navigate('/help')}>
            <Ticket className="mr-2 h-4 w-4" />
            {t('support.userList.newTicket')}
          </Button>
        </div>
      </div>

      <div className="mt-8 grid gap-6 xl:grid-cols-[minmax(0,0.95fr)_minmax(360px,0.8fr)]">
        <Card>
          <CardHeader>
            <CardTitle>{t('support.userList.queueTitle')}</CardTitle>
            <CardDescription>{t('support.userList.queueSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {ticketsQuery.isLoading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock3 className="h-4 w-4 animate-pulse" />
                {t('common.loading')}
              </div>
            ) : null}

            {!ticketsQuery.isLoading && tickets.length === 0 ? (
              <div className="rounded-[1.6rem] border border-dashed border-border px-6 py-12 text-center">
                <p className="text-lg font-medium">{t('support.userList.emptyTitle')}</p>
                <p className="mt-2 text-sm text-muted-foreground">{t('support.userList.emptyDescription')}</p>
                <Link to="/help" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-emerald-600">
                  {t('support.userList.emptyAction')}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            ) : null}

            {tickets.map((ticket) => (
              <UserQueueItem
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

        <TicketPreview ticket={selectedTicket} t={t} locale={locale} />
      </div>
    </div>
  );
}
