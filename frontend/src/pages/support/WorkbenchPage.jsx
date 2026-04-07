import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { AlertTriangle, ArrowRight, Clock3, Inbox, LifeBuoy, TimerReset } from 'lucide-react';

import { useTranslation } from '../../hooks/useTranslation';
import { supportAPI } from '../../lib/api';
import { checkAuthStatus } from '../../lib/auth';
import { formatSupportDate, getPriorityVariant, getSlaMeta, getSlaTone, getStatusTone } from '../../lib/supportTickets';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Badge } from '../../components/ui/badge';
import { Button } from '../../components/ui/Button';

function TicketRow({ ticket, t, locale }) {
  const slaMeta = getSlaMeta(ticket, locale);

  return (
    <Link
      to={`/support/tickets/${ticket.id}`}
      className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 transition hover:border-sky-300 hover:bg-sky-50/60 dark:border-white/10 dark:bg-white/5 dark:hover:border-sky-400/30 dark:hover:bg-sky-500/5"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">#{ticket.id}</span>
          <p className="truncate text-sm font-semibold">{ticket.subject}</p>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{ticket.latest_message_preview || t('support.portal.noPreview')}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
      </div>
      <div className="shrink-0 text-right text-xs uppercase tracking-[0.18em] text-slate-400">
        <div>{formatSupportDate(ticket.last_replied_at || ticket.created_at, locale)}</div>
        <div className="mt-1">{slaMeta.relativeLabel}</div>
        <div className="mt-2 inline-flex items-center gap-1 text-sky-600 dark:text-sky-300">
          {t('support.portal.openTicket')}
          <ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </Link>
  );
}

function Lane({ title, description, icon, tickets, t, locale }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-100">
          {icon}
        </span>
        <div>
          <h2 className="text-lg font-semibold">{title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{description}</p>
        </div>
      </div>
      <div className="space-y-3">
        {tickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
            {t('support.portal.emptyLane')}
          </div>
        ) : (
          tickets.map((ticket) => <TicketRow key={ticket.id} ticket={ticket} t={t} locale={locale} />)
        )}
      </div>
    </section>
  );
}

export default function SupportWorkbenchPage() {
  const { t, currentLanguage } = useTranslation();
  const locale = currentLanguage === 'zh' ? 'zh-CN' : 'en-US';
  const currentUser = useMemo(() => checkAuthStatus().user, []);

  const ticketsQuery = useQuery(
    ['support-workbench-tickets'],
    () => supportAPI.getTickets({ limit: 50 }),
    { refetchOnWindowFocus: false }
  );

  const assigneesQuery = useQuery(
    ['support-workbench-assignees'],
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

  const viewModel = useMemo(() => {
    const openTickets = tickets.filter((ticket) => !['resolved', 'closed'].includes(ticket.status));
    const urgentFocus = [...openTickets]
      .filter((ticket) => {
        const slaState = getSlaMeta(ticket, locale).state;
        return ticket.priority === 'urgent' || ['due_soon', 'breached', 'escalated'].includes(slaState);
      })
      .sort((left, right) => String(right.last_replied_at || right.created_at).localeCompare(String(left.last_replied_at || left.created_at)))
      .slice(0, 5);
    const waitingFirstResponse = [...openTickets]
      .filter((ticket) => !ticket.first_support_response_at)
      .sort((left, right) => String(left.first_response_due_at || '').localeCompare(String(right.first_response_due_at || '')))
      .slice(0, 5);
    const mine = [...openTickets]
      .filter((ticket) => Number(ticket.assigned_to) === Number(currentUser?.id ?? 0))
      .sort((left, right) => String(right.last_replied_at || right.created_at).localeCompare(String(left.last_replied_at || left.created_at)))
      .slice(0, 6);
    const unassigned = [...openTickets]
      .filter((ticket) => !ticket.assigned_to)
      .sort((left, right) => String(right.created_at).localeCompare(String(left.created_at)))
      .slice(0, 6);

    return {
      urgentFocus,
      waitingFirstResponse,
      mine,
      unassigned,
      activeAssignees: assignees.filter((entry) => entry.routing_status === 'active').slice(0, 8),
    };
  }, [tickets, assignees, currentUser?.id, locale]);

  return (
    <div className="space-y-6">
      <section className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
        <div className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f4fbff_100%)] px-6 py-6 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.94)_0%,rgba(8,47,73,0.85)_100%)]">
          <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-600/80 dark:text-sky-300/80">
            {t('support.portal.workbenchEyebrow')}
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight">{t('support.portal.workbenchTitle')}</h2>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button asChild className="rounded-full">
              <Link to="/support/tickets">{t('support.portal.goToQueue')}</Link>
            </Button>
            {viewModel.urgentFocus[0] ? (
              <Button asChild variant="outline" className="rounded-full">
                <Link to={`/support/tickets/${viewModel.urgentFocus[0].id}`}>{t('support.portal.openTopPriority')}</Link>
              </Button>
            ) : null}
          </div>
        </div>

        <Card className="border-slate-200/80 shadow-sm dark:border-white/10">
          <CardHeader>
            <CardTitle>{t('support.portal.activeAssigneesTitle')}</CardTitle>
            <CardDescription>{t('support.portal.activeAssigneesSubtitle')}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {viewModel.activeAssignees.length === 0 ? (
              <p className="text-sm text-slate-500 dark:text-slate-400">{t('support.portal.emptyLane')}</p>
            ) : (
              viewModel.activeAssignees.map((assignee) => (
                <div key={assignee.id} className="flex items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/10 dark:bg-white/5">
                  <div>
                    <p className="text-sm font-semibold">{assignee.username || assignee.email || `#${assignee.id}`}</p>
                    <p className="mt-1 text-xs uppercase tracking-[0.2em] text-slate-400">L{assignee.routing_level ?? 1}</p>
                  </div>
                  <div className="text-right text-sm">
                    <p>{t('support.portal.workload.assigned')}: {assignee.assigned_total_count ?? 0}</p>
                    <p className="text-slate-500 dark:text-slate-400">{t('support.portal.availableCapacity', { count: assignee.available_capacity ?? 0 })}</p>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </section>

      <div className="grid gap-6 xl:grid-cols-2">
        <Lane
          title={t('support.portal.focusLaneTitle')}
          description={t('support.portal.focusLaneSubtitle')}
          icon={<AlertTriangle className="h-4 w-4" />}
          tickets={viewModel.urgentFocus}
          t={t}
          locale={locale}
        />
        <Lane
          title={t('support.portal.firstResponseLaneTitle')}
          description={t('support.portal.firstResponseLaneSubtitle')}
          icon={<TimerReset className="h-4 w-4" />}
          tickets={viewModel.waitingFirstResponse}
          t={t}
          locale={locale}
        />
        <Lane
          title={t('support.portal.myQueueLaneTitle')}
          description={t('support.portal.myQueueLaneSubtitle')}
          icon={<LifeBuoy className="h-4 w-4" />}
          tickets={viewModel.mine}
          t={t}
          locale={locale}
        />
        <Lane
          title={t('support.portal.unassignedLaneTitle')}
          description={t('support.portal.unassignedLaneSubtitle')}
          icon={<Inbox className="h-4 w-4" />}
          tickets={viewModel.unassigned}
          t={t}
          locale={locale}
        />
      </div>
    </div>
  );
}
