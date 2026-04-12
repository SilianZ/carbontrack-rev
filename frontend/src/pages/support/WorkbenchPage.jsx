import React, { useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from 'react-query';
import { AlertTriangle, ArrowRight, LifeBuoy, TimerReset } from 'lucide-react';

import { useTranslation } from '../../hooks/useTranslation';
import { supportAPI } from '../../lib/api';
import { checkAuthStatus } from '../../lib/auth';
import { formatSupportDate, getPriorityVariant, getSlaMeta, getSlaTone, getStatusTone } from '../../lib/supportTickets';
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

function TransferRequestRow({ ticket, request, t, locale }) {
  const fromLabel = request?.from_user?.username || request?.requester?.username || request?.from_user?.email || request?.requester?.email || '--';

  return (
    <Link
      to={`/support/tickets/${ticket.id}`}
      className="rounded-[1.6rem] border border-amber-300/70 bg-white/90 px-5 py-4 shadow-sm transition hover:border-amber-400 hover:bg-white dark:border-amber-400/30 dark:bg-slate-950/40 dark:hover:border-amber-300/50 dark:hover:bg-slate-950/70"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700 dark:text-amber-300">#{ticket.id}</span>
            <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-50">{ticket.subject}</p>
          </div>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            {t('support.portal.transferWorkbench.requestedBy', { name: fromLabel })}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {request?.reason?.trim() || t('support.portal.transferWorkbench.noReason')}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
            {t('support.transferStatuses.pending')}
          </Badge>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {formatSupportDate(request?.created_at || ticket.updated_at || ticket.created_at, locale)}
          </p>
          <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-200">
            {t('support.portal.transferWorkbench.reviewAction')}
            <ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </Link>
  );
}

export default function SupportWorkbenchPage() {
  const { t, currentLanguage } = useTranslation(['date', 'support']);
  const locale = currentLanguage === 'zh' ? 'zh-CN' : 'en-US';
  const currentUser = useMemo(() => checkAuthStatus().user, []);

  const ticketsQuery = useQuery(
    ['support-workbench-tickets'],
    () => supportAPI.getTickets({ limit: 50 }),
    { refetchOnWindowFocus: false }
  );
  const pendingTransfersQuery = useQuery(
    ['support-workbench-pending-transfers'],
    () => supportAPI.getTickets({ limit: 6, pending_transfer_target: 1 }),
    { refetchOnWindowFocus: false }
  );

  const tickets = useMemo(
    () => ticketsQuery.data?.data?.data?.items ?? [],
    [ticketsQuery.data]
  );
  const pendingTransferTickets = useMemo(
    () => pendingTransfersQuery.data?.data?.data?.items ?? [],
    [pendingTransfersQuery.data]
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

    return {
      urgentFocus,
      waitingFirstResponse,
      mine,
      pendingTransfers: pendingTransferTickets,
    };
  }, [tickets, pendingTransferTickets, currentUser?.id, locale]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f4fbff_100%)] px-6 py-6 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.94)_0%,rgba(8,47,73,0.85)_100%)]">
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
      </section>

      {viewModel.pendingTransfers.length > 0 ? (
        <section className="rounded-[2rem] border border-amber-300 bg-[linear-gradient(135deg,#fff7d6_0%,#fffdf3_100%)] px-6 py-6 shadow-sm dark:border-amber-400/30 dark:bg-[linear-gradient(135deg,rgba(120,53,15,0.45)_0%,rgba(15,23,42,0.92)_100%)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700/90 dark:text-amber-200/90">
                {t('support.portal.transferWorkbench.eyebrow')}
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">{t('support.portal.transferWorkbench.title')}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">
                {t('support.portal.transferWorkbench.subtitle', { count: viewModel.pendingTransfers.length })}
              </p>
            </div>
            <Badge variant="outline" className="w-fit border-amber-400/70 bg-white/80 px-3 py-1 text-sm text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100">
              {t('support.portal.transferWorkbench.countBadge', { count: viewModel.pendingTransfers.length })}
            </Badge>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {viewModel.pendingTransfers.map((ticket) => (
              <TransferRequestRow
                key={`transfer-${ticket.id}`}
                ticket={ticket}
                request={ticket.pending_transfer_request}
                t={t}
                locale={locale}
              />
            ))}
          </div>
        </section>
      ) : null}

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
      </div>
    </div>
  );
}
