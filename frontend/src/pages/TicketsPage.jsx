import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useQuery } from 'react-query';
import { ArrowRight, Clock3, Ticket } from 'lucide-react';

import { useTranslation } from '../hooks/useTranslation';
import { ticketAPI } from '../lib/api';
import { formatSupportDate, getPriorityVariant, getStatusTone, TICKET_STATUS_OPTIONS } from '../lib/supportTickets';
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

export default function TicketsPage() {
  const { t, currentLanguage } = useTranslation();
  const navigate = useNavigate();
  const [status, setStatus] = useState('all');

  const ticketsQuery = useQuery(
    ['user-tickets', status],
    () => ticketAPI.getTickets(status === 'all' ? { limit: 20 } : { limit: 20, status }),
    {
      keepPreviousData: true,
      refetchOnWindowFocus: false,
    }
  );

  const tickets = ticketsQuery.data?.data?.data?.items ?? [];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8">
      <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] text-emerald-600 dark:text-emerald-300">
            {t('support.userList.eyebrow')}
          </p>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            {t('support.userList.title')}
          </h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">
            {t('support.userList.subtitle')}
          </p>
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

      <Card className="mt-8">
        <CardHeader>
          <CardTitle>{t('support.userList.queueTitle')}</CardTitle>
          <CardDescription>{t('support.userList.queueSubtitle')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {ticketsQuery.isLoading && (
            <p className="text-sm text-muted-foreground">{t('common.loading')}</p>
          )}

          {!ticketsQuery.isLoading && tickets.length === 0 && (
            <div className="rounded-[1.6rem] border border-dashed border-border px-6 py-12 text-center">
              <p className="text-lg font-medium">{t('support.userList.emptyTitle')}</p>
              <p className="mt-2 text-sm text-muted-foreground">{t('support.userList.emptyDescription')}</p>
              <Link to="/help" className="mt-5 inline-flex items-center gap-2 text-sm font-medium text-emerald-600">
                {t('support.userList.emptyAction')}
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
          )}

          {tickets.map((ticket) => (
            <Link
              key={ticket.id}
              to={`/tickets/${ticket.id}`}
              className="block rounded-[1.6rem] border border-border bg-muted/20 px-5 py-5 transition hover:border-emerald-300 hover:bg-muted/35"
            >
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-sm font-semibold text-muted-foreground">#{ticket.id}</span>
                    <h2 className="text-lg font-medium text-foreground">{ticket.subject}</h2>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{ticket.latest_message_preview}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <Badge className={getStatusTone(ticket.status)} variant="outline">
                    {t(`support.statuses.${ticket.status}`)}
                  </Badge>
                  <Badge variant={getPriorityVariant(ticket.priority)}>
                    {t(`support.priorities.${ticket.priority}`)}
                  </Badge>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-4 text-xs uppercase tracking-[0.24em] text-muted-foreground">
                <span>{t(`support.categories.${ticket.category}`)}</span>
                <span className="inline-flex items-center gap-1.5">
                  <Clock3 className="h-3.5 w-3.5" />
                  {formatSupportDate(ticket.last_replied_at || ticket.created_at, currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}
                </span>
                <span>{t('support.userList.replyCount', { count: ticket.message_count  })}</span>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
