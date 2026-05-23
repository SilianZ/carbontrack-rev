import Silian_React, { useMemo as Silian_useMemo } from 'react';
import { Link as Silian_Link } from 'react-router-dom';
import { useQuery as Silian_useQuery } from 'react-query';
import { AlertTriangle as Silian_AlertTriangle, ArrowRight as Silian_ArrowRight, LifeBuoy as Silian_LifeBuoy, TimerReset as Silian_TimerReset } from 'lucide-react';

import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { supportAPI as Silian_supportAPI } from '../../lib/api';
import { checkAuthStatus as Silian_checkAuthStatus } from '../../lib/auth';
import { formatSupportDate as Silian_formatSupportDate, getPriorityVariant as Silian_getPriorityVariant, getSlaMeta as Silian_getSlaMeta, getSlaTone as Silian_getSlaTone, getStatusTone as Silian_getStatusTone } from '../../lib/supportTickets';
import { Badge as Silian_Badge } from '../../components/ui/badge';
import { Button as Silian_Button } from '../../components/ui/Button';

function Silian_TicketRow({ ticket: Silian_ticket, t: Silian_t, locale: Silian_locale }) {
  const Silian_slaMeta = Silian_getSlaMeta(Silian_ticket, Silian_locale);

  return (
    <Silian_Link
      to={`/support/tickets/${Silian_ticket.id}`}
      className="flex items-start justify-between gap-4 rounded-2xl border border-slate-200 bg-white px-4 py-4 transition hover:border-sky-300 hover:bg-sky-50/60 dark:border-white/10 dark:bg-white/5 dark:hover:border-sky-400/30 dark:hover:bg-sky-500/5"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-400">#{Silian_ticket.id}</span>
          <p className="truncate text-sm font-semibold">{Silian_ticket.subject}</p>
        </div>
        <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{Silian_ticket.latest_message_preview || Silian_t('support.portal.noPreview')}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
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
      </div>
      <div className="shrink-0 text-right text-xs uppercase tracking-[0.18em] text-slate-400">
        <div>{Silian_formatSupportDate(Silian_ticket.last_replied_at || Silian_ticket.created_at, Silian_locale)}</div>
        <div className="mt-1">{Silian_slaMeta.relativeLabel}</div>
        <div className="mt-2 inline-flex items-center gap-1 text-sky-600 dark:text-sky-300">
          {Silian_t('support.portal.openTicket')}
          <Silian_ArrowRight className="h-3.5 w-3.5" />
        </div>
      </div>
    </Silian_Link>
  );
}

function Silian_Lane({ title: Silian_title, description: Silian_description, icon: Silian_icon, tickets: Silian_tickets, t: Silian_t, locale: Silian_locale }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-3">
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100 text-slate-700 dark:bg-white/10 dark:text-slate-100">
          {Silian_icon}
        </span>
        <div>
          <h2 className="text-lg font-semibold">{Silian_title}</h2>
          <p className="text-sm text-slate-500 dark:text-slate-400">{Silian_description}</p>
        </div>
      </div>
      <div className="space-y-3">
        {Silian_tickets.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-8 text-sm text-slate-500 dark:border-white/10 dark:text-slate-400">
            {Silian_t('support.portal.emptyLane')}
          </div>
        ) : (
          Silian_tickets.map((Silian_ticket) => <Silian_TicketRow key={Silian_ticket.id} ticket={Silian_ticket} t={Silian_t} locale={Silian_locale} />)
        )}
      </div>
    </section>
  );
}

function Silian_TransferRequestRow({ ticket: Silian_ticket, request: Silian_request, t: Silian_t, locale: Silian_locale }) {
  const Silian_fromLabel = Silian_request?.from_user?.username || Silian_request?.requester?.username || Silian_request?.from_user?.email || Silian_request?.requester?.email || '--';

  return (
    <Silian_Link
      to={`/support/tickets/${Silian_ticket.id}`}
      className="rounded-[1.6rem] border border-amber-300/70 bg-white/90 px-5 py-4 shadow-sm transition hover:border-amber-400 hover:bg-white dark:border-amber-400/30 dark:bg-slate-950/40 dark:hover:border-amber-300/50 dark:hover:bg-slate-950/70"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700 dark:text-amber-300">#{Silian_ticket.id}</span>
            <p className="truncate text-base font-semibold text-slate-900 dark:text-slate-50">{Silian_ticket.subject}</p>
          </div>
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
            {Silian_t('support.portal.transferWorkbench.requestedBy', { name: Silian_fromLabel })}
          </p>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            {Silian_request?.reason?.trim() || Silian_t('support.portal.transferWorkbench.noReason')}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <Silian_Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-400/30 dark:bg-amber-400/10 dark:text-amber-200">
            {Silian_t('support.transferStatuses.pending')}
          </Silian_Badge>
          <p className="mt-3 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
            {Silian_formatSupportDate(Silian_request?.created_at || Silian_ticket.updated_at || Silian_ticket.created_at, Silian_locale)}
          </p>
          <div className="mt-4 inline-flex items-center gap-1 text-sm font-medium text-amber-700 dark:text-amber-200">
            {Silian_t('support.portal.transferWorkbench.reviewAction')}
            <Silian_ArrowRight className="h-4 w-4" />
          </div>
        </div>
      </div>
    </Silian_Link>
  );
}

export default function SupportWorkbenchPage() {
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['date', 'support']);
  const Silian_locale = Silian_currentLanguage === 'zh' ? 'zh-CN' : 'en-US';
  const Silian_currentUser = Silian_useMemo(() => Silian_checkAuthStatus().user, []);

  const Silian_ticketsQuery = Silian_useQuery(
    ['support-workbench-tickets'],
    () => Silian_supportAPI.getTickets({ limit: 50 }),
    { refetchOnWindowFocus: false }
  );
  const Silian_pendingTransfersQuery = Silian_useQuery(
    ['support-workbench-pending-transfers'],
    () => Silian_supportAPI.getTickets({ limit: 6, pending_transfer_target: 1 }),
    { refetchOnWindowFocus: false }
  );

  const Silian_tickets = Silian_useMemo(
    () => Silian_ticketsQuery.data?.data?.data?.items ?? [],
    [Silian_ticketsQuery.data]
  );
  const Silian_pendingTransferTickets = Silian_useMemo(
    () => Silian_pendingTransfersQuery.data?.data?.data?.items ?? [],
    [Silian_pendingTransfersQuery.data]
  );

  const Silian_viewModel = Silian_useMemo(() => {
    const Silian_openTickets = Silian_tickets.filter((Silian_ticket) => !['resolved', 'closed'].includes(Silian_ticket.status));
    const Silian_urgentFocus = [...Silian_openTickets]
      .filter((Silian_ticket) => {
        const Silian_slaState = Silian_getSlaMeta(Silian_ticket, Silian_locale).state;
        return Silian_ticket.priority === 'urgent' || ['due_soon', 'breached', 'escalated'].includes(Silian_slaState);
      })
      .sort((Silian_left, Silian_right) => String(Silian_right.last_replied_at || Silian_right.created_at).localeCompare(String(Silian_left.last_replied_at || Silian_left.created_at)))
      .slice(0, 5);
    const Silian_waitingFirstResponse = [...Silian_openTickets]
      .filter((Silian_ticket) => !Silian_ticket.first_support_response_at)
      .sort((Silian_left, Silian_right) => String(Silian_left.first_response_due_at || '').localeCompare(String(Silian_right.first_response_due_at || '')))
      .slice(0, 5);
    const Silian_mine = [...Silian_openTickets]
      .filter((Silian_ticket) => Number(Silian_ticket.assigned_to) === Number(Silian_currentUser?.id ?? 0))
      .sort((Silian_left, Silian_right) => String(Silian_right.last_replied_at || Silian_right.created_at).localeCompare(String(Silian_left.last_replied_at || Silian_left.created_at)))
      .slice(0, 6);

    return {
      urgentFocus: Silian_urgentFocus,
      waitingFirstResponse: Silian_waitingFirstResponse,
      mine: Silian_mine,
      pendingTransfers: Silian_pendingTransferTickets,
    };
  }, [Silian_tickets, Silian_pendingTransferTickets, Silian_currentUser?.id, Silian_locale]);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f4fbff_100%)] px-6 py-6 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.94)_0%,rgba(8,47,73,0.85)_100%)]">
        <p className="text-xs font-semibold uppercase tracking-[0.32em] text-sky-600/80 dark:text-sky-300/80">
          {Silian_t('support.portal.workbenchEyebrow')}
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">{Silian_t('support.portal.workbenchTitle')}</h2>
        <div className="mt-6 flex flex-wrap gap-3">
          <Silian_Button asChild className="rounded-full">
            <Silian_Link to="/support/tickets">{Silian_t('support.portal.goToQueue')}</Silian_Link>
          </Silian_Button>
          {Silian_viewModel.urgentFocus[0] ? (
            <Silian_Button asChild variant="outline" className="rounded-full">
              <Silian_Link to={`/support/tickets/${Silian_viewModel.urgentFocus[0].id}`}>{Silian_t('support.portal.openTopPriority')}</Silian_Link>
            </Silian_Button>
          ) : null}
        </div>
      </section>

      {Silian_viewModel.pendingTransfers.length > 0 ? (
        <section className="rounded-[2rem] border border-amber-300 bg-[linear-gradient(135deg,#fff7d6_0%,#fffdf3_100%)] px-6 py-6 shadow-sm dark:border-amber-400/30 dark:bg-[linear-gradient(135deg,rgba(120,53,15,0.45)_0%,rgba(15,23,42,0.92)_100%)]">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700/90 dark:text-amber-200/90">
                {Silian_t('support.portal.transferWorkbench.eyebrow')}
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight">{Silian_t('support.portal.transferWorkbench.title')}</h2>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-700 dark:text-slate-300">
                {Silian_t('support.portal.transferWorkbench.subtitle', { count: Silian_viewModel.pendingTransfers.length })}
              </p>
            </div>
            <Silian_Badge variant="outline" className="w-fit border-amber-400/70 bg-white/80 px-3 py-1 text-sm text-amber-800 dark:border-amber-400/40 dark:bg-amber-400/10 dark:text-amber-100">
              {Silian_t('support.portal.transferWorkbench.countBadge', { count: Silian_viewModel.pendingTransfers.length })}
            </Silian_Badge>
          </div>
          <div className="mt-5 grid gap-4 xl:grid-cols-2">
            {Silian_viewModel.pendingTransfers.map((Silian_ticket) => (
              <Silian_TransferRequestRow
                key={`transfer-${Silian_ticket.id}`}
                ticket={Silian_ticket}
                request={Silian_ticket.pending_transfer_request}
                t={Silian_t}
                locale={Silian_locale}
              />
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-6 xl:grid-cols-2">
        <Silian_Lane
          title={Silian_t('support.portal.focusLaneTitle')}
          description={Silian_t('support.portal.focusLaneSubtitle')}
          icon={<Silian_AlertTriangle className="h-4 w-4" />}
          tickets={Silian_viewModel.urgentFocus}
          t={Silian_t}
          locale={Silian_locale}
        />
        <Silian_Lane
          title={Silian_t('support.portal.firstResponseLaneTitle')}
          description={Silian_t('support.portal.firstResponseLaneSubtitle')}
          icon={<Silian_TimerReset className="h-4 w-4" />}
          tickets={Silian_viewModel.waitingFirstResponse}
          t={Silian_t}
          locale={Silian_locale}
        />
        <Silian_Lane
          title={Silian_t('support.portal.myQueueLaneTitle')}
          description={Silian_t('support.portal.myQueueLaneSubtitle')}
          icon={<Silian_LifeBuoy className="h-4 w-4" />}
          tickets={Silian_viewModel.mine}
          t={Silian_t}
          locale={Silian_locale}
        />
      </div>
    </div>
  );
}
