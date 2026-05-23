import Silian_React, { useEffect as Silian_useEffect, useMemo as Silian_useMemo, useState as Silian_useState } from 'react';
import { Link as Silian_Link } from 'react-router-dom';
import { useMutation as Silian_useMutation, useQuery as Silian_useQuery, useQueryClient as Silian_useQueryClient } from 'react-query';
import { toast as Silian_toast } from 'react-hot-toast';
import { BarChart3 as Silian_BarChart3, CheckCircle2 as Silian_CheckCircle2, Clock3 as Silian_Clock3, Loader2 as Silian_Loader2, Mail as Silian_Mail, Save as Silian_Save, Shield as Silian_Shield, Star as Silian_Star, Ticket as Silian_Ticket, UserRound as Silian_UserRound, Wand2 as Silian_Wand2 } from 'lucide-react';

import { adminAPI as Silian_adminAPI } from '../../lib/api';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { TICKET_CATEGORY_OPTIONS as Silian_TICKET_CATEGORY_OPTIONS, TICKET_PRIORITY_OPTIONS as Silian_TICKET_PRIORITY_OPTIONS, TICKET_STATUS_OPTIONS as Silian_TICKET_STATUS_OPTIONS, formatSupportDate as Silian_formatSupportDate, getPriorityVariant as Silian_getPriorityVariant, getSlaMeta as Silian_getSlaMeta, getSlaMilestoneMeta as Silian_getSlaMilestoneMeta, getSlaTone as Silian_getSlaTone, getStatusTone as Silian_getStatusTone, getTagTone as Silian_getTagTone } from '../../lib/supportTickets';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../../components/ui/Card';
import { Button as Silian_Button } from '../../components/ui/Button';
import { Input as Silian_Input } from '../../components/ui/Input';
import { Textarea as Silian_Textarea } from '../../components/ui/textarea';
import { Badge as Silian_Badge } from '../../components/ui/badge';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription } from '../../components/ui/Alert';
import { Tabs as Silian_Tabs, TabsContent as Silian_TabsContent, TabsList as Silian_TabsList, TabsTrigger as Silian_TabsTrigger } from '../../components/ui/Tabs';
import { Checkbox as Silian_Checkbox } from '../../components/ui/checkbox';
import { Switch as Silian_Switch } from '../../components/ui/switch';
import {
  Select as Silian_Select,
  SelectContent as Silian_SelectContent,
  SelectItem as Silian_SelectItem,
  SelectTrigger as Silian_SelectTrigger,
  SelectValue as Silian_SelectValue,
} from '../../components/ui/select';

const Silian_DAY_OPTIONS = [14, 30, 60];
const Silian_WEEKDAY_OPTIONS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const Silian_TAG_COLOR_OPTIONS = ['emerald', 'sky', 'amber', 'rose', 'violet', 'slate'];

const Silian_EMPTY_TAG_FORM = {
  id: null,
  name: '',
  slug: '',
  color: 'emerald',
  description: '',
  is_active: true,
};

const Silian_EMPTY_RULE_FORM = {
  id: null,
  name: '',
  description: '',
  is_active: true,
  sort_order: 0,
  match_category: 'all',
  match_priority: 'all',
  match_weekdays: [],
  match_time_start: '',
  match_time_end: '',
  timezone: 'Asia/Shanghai',
  assign_to: 'none',
  score_boost: 0,
  required_agent_level: 'none',
  skill_hints: '',
  tag_ids: [],
};

const Silian_EMPTY_ROUTING_SETTINGS = {
  ai_enabled: true,
  ai_timeout_ms: 12000,
  due_soon_minutes: 30,
  weights: {},
  fallback: {},
  defaults: {},
};

function Silian_MetricCard({ icon: Silian_icon, label: Silian_label, value: Silian_value, hint: Silian_hint }) {
  const Silian_renderedIcon = Silian_React.createElement(Silian_icon, { className: 'h-5 w-5' });

  return (
    <Silian_Card>
      <Silian_CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{Silian_label}</p>
            <p className="mt-3 text-3xl font-semibold">{Silian_value}</p>
            {Silian_hint ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{Silian_hint}</p> : null}
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            {Silian_renderedIcon}
          </span>
        </div>
      </Silian_CardContent>
    </Silian_Card>
  );
}

function Silian_BreakdownSection({ title: Silian_title, description: Silian_description, items: Silian_items = [], renderLabel: Silian_renderLabel, renderMeta: Silian_renderMeta }) {
  const Silian_maxCount = Math.max(1, ...Silian_items.map((Silian_item) => Number(Silian_item.count ?? Silian_item.trigger_count ?? 0)));
  const Silian_totalCount = Silian_items.reduce((Silian_sum, Silian_item) => Silian_sum + Number(Silian_item.count ?? Silian_item.trigger_count ?? 0), 0);

  return (
    <Silian_Card>
      <Silian_CardHeader>
        <Silian_CardTitle>{Silian_title}</Silian_CardTitle>
        <Silian_CardDescription>{Silian_description}</Silian_CardDescription>
      </Silian_CardHeader>
      <Silian_CardContent className="space-y-3">
        {Silian_items.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">--</p>}
        {Silian_items.map((Silian_item, Silian_index) => {
          const Silian_count = Number(Silian_item.count ?? Silian_item.trigger_count ?? 0);
          const Silian_width = `${Math.max(10, Math.round((Silian_count / Silian_maxCount) * 100))}%`;
          const Silian_share = Silian_totalCount > 0 ? `${Math.round((Silian_count / Silian_totalCount) * 100)}%` : '0%';
          return (
            <div key={`${Silian_title}-${Silian_index}`} className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 text-sm font-medium">{Silian_renderLabel(Silian_item)}</div>
                <div className="shrink-0 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  {Silian_renderMeta ? Silian_renderMeta(Silian_item) : `${Silian_count} · ${Silian_share}`}
                </div>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width: Silian_width }} />
              </div>
            </div>
          );
        })}
      </Silian_CardContent>
    </Silian_Card>
  );
}

function Silian_TicketQueueCard({ ticket: Silian_ticket, selected: Silian_selected, onSelect: Silian_onSelect, t: Silian_t, locale: Silian_locale }) {
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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">#{Silian_ticket.id}</p>
          <p className="mt-2 truncate font-medium">{Silian_ticket.subject}</p>
          <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{Silian_ticket.latest_message_preview || '--'}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
          <Silian_Ticket className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Silian_Badge variant="outline" className={Silian_getStatusTone(Silian_ticket.status)}>{Silian_t(`support.statuses.${Silian_ticket.status}`)}</Silian_Badge>
        <Silian_Badge variant={Silian_getPriorityVariant(Silian_ticket.priority)}>{Silian_t(`support.priorities.${Silian_ticket.priority}`)}</Silian_Badge>
        {Silian_slaMeta.state ? <Silian_Badge variant="outline" className={Silian_getSlaTone(Silian_slaMeta.state)}>{Silian_t(`support.slaStatuses.${Silian_slaMeta.state}`, { defaultValue: Silian_slaMeta.state })}</Silian_Badge> : null}
      </div>

      <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
        {Silian_formatSupportDate(Silian_ticket.last_replied_at || Silian_ticket.created_at, Silian_locale)} · {Silian_slaMeta.relativeLabel}
      </p>
    </button>
  );
}

function Silian_RoutingRunCard({ run: Silian_run, t: Silian_t, locale: Silian_locale }) {
  const Silian_topCandidates = Array.isArray(Silian_run.candidate_scores) ? Silian_run.candidate_scores.slice(0, 5) : [];

  return (
    <div className="space-y-3 rounded-2xl border border-border px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Silian_Badge variant="outline">{Silian_run.trigger}</Silian_Badge>
          <Silian_Badge variant="outline">{Silian_run.used_ai ? Silian_t('adminSupport.tickets.usedAi') : Silian_t('adminSupport.tickets.fallbackOnly')}</Silian_Badge>
        </div>
        <span className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
          {Silian_formatSupportDate(Silian_run.created_at, Silian_locale)}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 text-sm">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.tickets.routingWinner')}</p>
          <p className="mt-2 font-medium">{Silian_run.summary?.winner_label || Silian_run.winner_user_id || '--'}</p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.tickets.winnerScore', { value: Silian_run.winner_score ?? '--' })}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.tickets.routingDecision')}</p>
          <p className="mt-2 font-medium">{Silian_run.triage?.summary || '--'}</p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{Silian_run.fallback_reason || '--'}</p>
        </div>
      </div>

      {Silian_topCandidates.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.tickets.candidateScores')}</p>
          <div className="space-y-2">
            {Silian_topCandidates.map((Silian_candidate, Silian_index) => (
              <div key={`${Silian_run.id}-${Silian_index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                <span>{Silian_candidate.candidate?.username || Silian_candidate.candidate?.email || `#${Silian_candidate.candidate?.id ?? Silian_candidate.candidate_id ?? '--'}`}</span>
                <span className="font-medium">{Silian_candidate.total_score}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Silian_topFactorsLabel(Silian_value) {
  if (Array.isArray(Silian_value)) {
    return Silian_value.join(' / ');
  }

  if (Silian_value && typeof Silian_value === 'object') {
    return Object.entries(Silian_value)
      .filter(([, Silian_score]) => typeof Silian_score === 'number')
      .sort((Silian_left, Silian_right) => Math.abs(Silian_right[1]) - Math.abs(Silian_left[1]))
      .slice(0, 4)
      .map(([Silian_label, Silian_score]) => `${Silian_label} ${Number(Silian_score).toFixed(2)}`)
      .join(' / ');
  }

  if (typeof Silian_value === 'string') {
    return Silian_value;
  }

  return '';
}

function Silian_formatRatingValue(Silian_value) {
  const Silian_numeric = Number(Silian_value ?? 0);
  return Number.isFinite(Silian_numeric) ? Silian_numeric.toFixed(1) : '0.0';
}

function Silian_RatingStars({ value: Silian_value = 0, className: Silian_className = '' }) {
  const Silian_normalized = Math.max(0, Math.min(5, Number(Silian_value) || 0));

  return (
    <div className={`flex items-center gap-1 ${Silian_className}`}>
      {[1, 2, 3, 4, 5].map((Silian_rating) => {
        const Silian_active = Silian_normalized >= Silian_rating - 0.25;
        return (
          <Silian_Star
            key={Silian_rating}
            className={`h-3.5 w-3.5 ${Silian_active ? 'fill-amber-400 text-amber-400' : 'text-slate-300 dark:text-slate-600'}`}
          />
        );
      })}
    </div>
  );
}

function Silian_FeedbackSnapshot({ averageRating: Silian_averageRating, ratingCount: Silian_ratingCount, t: Silian_t, compact: Silian_compact = false }) {
  const Silian_count = Number(Silian_ratingCount ?? 0);

  if (Silian_count <= 0) {
    return (
      <p className={`text-slate-500 dark:text-slate-400 ${Silian_compact ? 'text-xs' : 'text-sm'}`}>
        {Silian_t('adminSupport.team.feedback.noRatings')}
      </p>
    );
  }

  return (
    <div className={`flex items-center gap-2 ${Silian_compact ? 'text-xs' : 'text-sm'}`}>
      <Silian_RatingStars value={Silian_averageRating} />
      <span className="font-medium text-slate-900 dark:text-slate-100">
        {Silian_t('adminSupport.team.feedback.summaryLine', {
          rating: Silian_formatRatingValue(Silian_averageRating),
          count: Silian_count,
        })}
      </span>
    </div>
  );
}

export default function AdminSupportOpsPage() {
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['adminSupport', 'common', 'date', 'errors', 'messages', 'profile', 'support']);
  const Silian_queryClient = Silian_useQueryClient();
  const [Silian_tab, Silian_setTab] = Silian_useState('team');
  const [Silian_settingsTab, Silian_setSettingsTab] = Silian_useState('rules');
  const [Silian_reportDays, Silian_setReportDays] = Silian_useState(14);
  const [Silian_tagForm, Silian_setTagForm] = Silian_useState(Silian_EMPTY_TAG_FORM);
  const [Silian_ruleForm, Silian_setRuleForm] = Silian_useState(Silian_EMPTY_RULE_FORM);
  const [Silian_isTagDraft, Silian_setIsTagDraft] = Silian_useState(false);
  const [Silian_isRuleDraft, Silian_setIsRuleDraft] = Silian_useState(false);
  const [Silian_selectedAssigneeId, Silian_setSelectedAssigneeId] = Silian_useState(null);
  const [Silian_selectedTicketId, Silian_setSelectedTicketId] = Silian_useState(null);
  const [Silian_ticketStatusFilter, Silian_setTicketStatusFilter] = Silian_useState('all');
  const [Silian_ticketWorkflowStatus, Silian_setTicketWorkflowStatus] = Silian_useState('open');
  const [Silian_ticketWorkflowStateTicketId, Silian_setTicketWorkflowStateTicketId] = Silian_useState(null);
  const [Silian_assigneeDetailTab, Silian_setAssigneeDetailTab] = Silian_useState('overview');
  const [Silian_routingSettingsForm, Silian_setRoutingSettingsForm] = Silian_useState(Silian_EMPTY_ROUTING_SETTINGS);
  const [Silian_assigneeProfileForm, Silian_setAssigneeProfileForm] = Silian_useState(null);

  const Silian_assigneesQuery = Silian_useQuery(['admin-support-assignees'], async () => {
    const Silian_res = await Silian_adminAPI.getSupportAssignees();
    return Silian_res.data?.data ?? [];
  });

  const Silian_tagsQuery = Silian_useQuery(['admin-support-tags'], async () => {
    const Silian_res = await Silian_adminAPI.getSupportTags();
    return Silian_res.data?.data ?? [];
  });

  const Silian_rulesQuery = Silian_useQuery(['admin-support-rules'], async () => {
    const Silian_res = await Silian_adminAPI.getSupportRules();
    return Silian_res.data?.data ?? [];
  });

  const Silian_reportsQuery = Silian_useQuery(['admin-support-reports', Silian_reportDays], async () => {
    const Silian_res = await Silian_adminAPI.getSupportReports({ days: Silian_reportDays });
    return Silian_res.data?.data ?? {};
  });

  const Silian_ticketsQuery = Silian_useQuery(['admin-support-tickets', Silian_ticketStatusFilter], async () => {
    const Silian_res = await Silian_adminAPI.getSupportTickets({
      limit: 25,
      ...(Silian_ticketStatusFilter !== 'all' ? { status: Silian_ticketStatusFilter } : {}),
    });
    return Silian_res.data?.data ?? {};
  });

  const Silian_routingSettingsQuery = Silian_useQuery(['admin-support-routing-settings'], async () => {
    const Silian_res = await Silian_adminAPI.getSupportRoutingSettings();
    return Silian_res.data?.data ?? Silian_EMPTY_ROUTING_SETTINGS;
  });

  const Silian_assigneeDetailQuery = Silian_useQuery(
    ['admin-support-assignee-detail', Silian_selectedAssigneeId],
    async () => {
      const Silian_res = await Silian_adminAPI.getSupportAssigneeDetail(Silian_selectedAssigneeId);
      return Silian_res.data?.data ?? null;
    },
    {
      enabled: Boolean(Silian_selectedAssigneeId),
      refetchOnWindowFocus: false,
    }
  );

  const Silian_ticketDetailQuery = Silian_useQuery(
    ['admin-support-ticket-detail', Silian_selectedTicketId],
    async () => {
      const Silian_res = await Silian_adminAPI.getSupportTicketDetail(Silian_selectedTicketId);
      return Silian_res.data?.data ?? null;
    },
    {
      enabled: Boolean(Silian_selectedTicketId),
      refetchOnWindowFocus: false,
    }
  );

  const Silian_tags = Silian_useMemo(() => Silian_tagsQuery.data ?? [], [Silian_tagsQuery.data]);
  const Silian_rules = Silian_useMemo(() => Silian_rulesQuery.data ?? [], [Silian_rulesQuery.data]);
  const Silian_assignees = Silian_useMemo(() => Silian_assigneesQuery.data ?? [], [Silian_assigneesQuery.data]);
  const Silian_reports = Silian_reportsQuery.data ?? {};
  const Silian_assigneeDetail = Silian_assigneeDetailQuery.data;
  const Silian_tickets = Silian_useMemo(() => Silian_ticketsQuery.data?.items ?? [], [Silian_ticketsQuery.data]);
  const Silian_ticketDetail = Silian_ticketDetailQuery.data;

  const Silian_saveTagMutation = Silian_useMutation(
    async (Silian_payload) => {
      if (Silian_payload.id) {
        return Silian_adminAPI.updateSupportTag(Silian_payload.id, Silian_payload);
      }
      return Silian_adminAPI.createSupportTag(Silian_payload);
    },
    {
      onSuccess: () => {
        Silian_toast.success(Silian_t('adminSupport.messages.tagSaved'));
        Silian_queryClient.invalidateQueries(['admin-support-tags']);
        Silian_setTagForm(Silian_EMPTY_TAG_FORM);
        Silian_setIsTagDraft(false);
      },
      onError: (Silian_error) => {
        Silian_toast.error(Silian_error?.response?.data?.message || Silian_error?.message || Silian_t('errors.operationFailed'));
      },
    }
  );

  const Silian_saveRuleMutation = Silian_useMutation(
    async (Silian_payload) => {
      if (Silian_payload.id) {
        return Silian_adminAPI.updateSupportRule(Silian_payload.id, Silian_payload);
      }
      return Silian_adminAPI.createSupportRule(Silian_payload);
    },
    {
      onSuccess: () => {
        Silian_toast.success(Silian_t('adminSupport.messages.ruleSaved'));
        Silian_queryClient.invalidateQueries(['admin-support-rules']);
        Silian_queryClient.invalidateQueries(['admin-support-reports']);
        Silian_setRuleForm(Silian_EMPTY_RULE_FORM);
        Silian_setIsRuleDraft(false);
      },
      onError: (Silian_error) => {
        Silian_toast.error(Silian_error?.response?.data?.message || Silian_error?.message || Silian_t('errors.operationFailed'));
      },
    }
  );

  const Silian_saveRoutingSettingsMutation = Silian_useMutation(
    async (Silian_payload) => Silian_adminAPI.updateSupportRoutingSettings(Silian_payload),
    {
      onSuccess: () => {
        Silian_toast.success(Silian_t('adminSupport.messages.routingSettingsSaved'));
        Silian_queryClient.invalidateQueries(['admin-support-routing-settings']);
      },
      onError: (Silian_error) => {
        Silian_toast.error(Silian_error?.response?.data?.message || Silian_error?.message || Silian_t('errors.operationFailed'));
      },
    }
  );

  const Silian_saveRoutingProfileMutation = Silian_useMutation(
    async ({ id: Silian_id, payload: Silian_payload }) => Silian_adminAPI.updateSupportAssigneeRoutingProfile(Silian_id, Silian_payload),
    {
      onSuccess: (Silian__, Silian_variables) => {
        Silian_toast.success(Silian_t('adminSupport.messages.profileSaved'));
        Silian_queryClient.invalidateQueries(['admin-support-assignees']);
        Silian_queryClient.invalidateQueries(['admin-support-assignee-detail', Silian_variables.id]);
      },
      onError: (Silian_error) => {
        Silian_toast.error(Silian_error?.response?.data?.message || Silian_error?.message || Silian_t('errors.operationFailed'));
      },
    }
  );

  const Silian_saveTicketWorkflowMutation = Silian_useMutation(
    async ({ id: Silian_id, payload: Silian_payload }) => Silian_adminAPI.updateSupportTicket(Silian_id, Silian_payload),
    {
      onSuccess: (Silian__, Silian_variables) => {
        Silian_toast.success(Silian_t('adminSupport.messages.ticketUpdated'));
        Silian_queryClient.invalidateQueries(['admin-support-tickets']);
        Silian_queryClient.invalidateQueries(['admin-support-ticket-detail', Silian_variables.id]);
        Silian_queryClient.invalidateQueries(['admin-support-reports']);
        Silian_queryClient.invalidateQueries(['support-queue']);
        Silian_queryClient.invalidateQueries(['support-workbench-tickets']);
        Silian_queryClient.invalidateQueries(['support-workbench-pending-transfers']);
      },
      onError: (Silian_error) => {
        Silian_toast.error(Silian_error?.response?.data?.message || Silian_error?.message || Silian_t('errors.operationFailed'));
      },
    }
  );

  const Silian_summaryCards = Silian_useMemo(() => {
    const Silian_summary = Silian_reports.summary ?? {};
    return [
      {
        key: 'total',
        icon: Silian_BarChart3,
        label: Silian_t('adminSupport.summary.total'),
        value: Silian_summary.total ?? 0,
        hint: Silian_t('adminSupport.summary.totalHint'),
      },
      {
        key: 'smartAssigned',
        icon: Silian_Wand2,
        label: Silian_t('adminSupport.summary.smartAssigned'),
        value: Silian_summary.smart_assignment_count ?? 0,
        hint: Silian_t('adminSupport.summary.smartAssignedHint'),
      },
      {
        key: 'unassigned',
        icon: Silian_Clock3,
        label: Silian_t('adminSupport.summary.unassigned'),
        value: Silian_summary.unassigned ?? 0,
        hint: Silian_t('adminSupport.summary.unassignedHint'),
      },
      {
        key: 'slaBreaches',
        icon: Silian_CheckCircle2,
        label: Silian_t('adminSupport.summary.slaBreaches'),
        value: Silian_summary.sla_breach_count ?? 0,
        hint: Silian_t('adminSupport.summary.slaBreachesHint'),
      },
    ];
  }, [Silian_reports.summary, Silian_t]);

  Silian_useEffect(() => {
    if (!Silian_rules.length || Silian_ruleForm.id !== null || Silian_isRuleDraft) {
      return;
    }
    Silian_setRuleForm((Silian_current) => Silian_current.id === null ? Silian_hydrateRuleForm(Silian_rules[0]) : Silian_current);
  }, [Silian_rules, Silian_ruleForm.id, Silian_isRuleDraft]);

  Silian_useEffect(() => {
    if (!Silian_tags.length || Silian_tagForm.id !== null || Silian_isTagDraft) {
      return;
    }
    Silian_setTagForm((Silian_current) => Silian_current.id === null ? Silian_hydrateTagForm(Silian_tags[0]) : Silian_current);
  }, [Silian_tags, Silian_tagForm.id, Silian_isTagDraft]);

  Silian_useEffect(() => {
    if (!Silian_assignees.length) {
      return;
    }

    Silian_setSelectedAssigneeId((Silian_current) => {
      if (Silian_current && Silian_assignees.some((Silian_entry) => Silian_entry.id === Silian_current)) {
        return Silian_current;
      }
      return Silian_assignees[0].id;
    });
  }, [Silian_assignees]);

  Silian_useEffect(() => {
    Silian_setAssigneeDetailTab('overview');
  }, [Silian_selectedAssigneeId]);

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

  Silian_useEffect(() => {
    if (Silian_routingSettingsQuery.data) {
      Silian_setRoutingSettingsForm(Silian_routingSettingsQuery.data);
    }
  }, [Silian_routingSettingsQuery.data]);

  Silian_useEffect(() => {
    if (Silian_assigneeDetail?.routing_profile) {
      Silian_setAssigneeProfileForm({
        level: Silian_assigneeDetail.routing_profile.level ?? 1,
        skills: Array.isArray(Silian_assigneeDetail.routing_profile.skills) ? Silian_assigneeDetail.routing_profile.skills.join(', ') : '',
        languages: Array.isArray(Silian_assigneeDetail.routing_profile.languages) ? Silian_assigneeDetail.routing_profile.languages.join(', ') : '',
        max_active_tickets: Silian_assigneeDetail.routing_profile.max_active_tickets ?? 10,
        is_auto_assignable: Boolean(Silian_assigneeDetail.routing_profile.is_auto_assignable),
        status: Silian_assigneeDetail.routing_profile.status ?? 'active',
        flat_boost: Silian_assigneeDetail.routing_profile.weight_overrides?.flat_boost ?? 0,
      });
    } else {
      Silian_setAssigneeProfileForm(null);
    }
  }, [Silian_assigneeDetail]);

  Silian_useEffect(() => {
    if (!Silian_ticketDetail) {
      return;
    }

    Silian_setTicketWorkflowStatus(Silian_ticketDetail.status || 'open');
    Silian_setTicketWorkflowStateTicketId(Silian_ticketDetail.id ?? null);
  }, [Silian_ticketDetail]);

  const Silian_handleTagSave = () => {
    Silian_saveTagMutation.mutate({
      id: Silian_tagForm.id,
      name: Silian_tagForm.name.trim(),
      slug: Silian_tagForm.slug.trim(),
      color: Silian_tagForm.color,
      description: Silian_tagForm.description.trim() || null,
      is_active: Boolean(Silian_tagForm.is_active),
    });
  };

  const Silian_handleRuleSave = () => {
    Silian_saveRuleMutation.mutate({
      id: Silian_ruleForm.id,
      name: Silian_ruleForm.name.trim(),
      description: Silian_ruleForm.description.trim() || null,
      is_active: Boolean(Silian_ruleForm.is_active),
      sort_order: Number(Silian_ruleForm.sort_order || 0),
      match_category: Silian_ruleForm.match_category === 'all' ? null : Silian_ruleForm.match_category,
      match_priority: Silian_ruleForm.match_priority === 'all' ? null : Silian_ruleForm.match_priority,
      match_weekdays: Silian_ruleForm.match_weekdays,
      match_time_start: Silian_ruleForm.match_time_start || null,
      match_time_end: Silian_ruleForm.match_time_end || null,
      timezone: Silian_ruleForm.timezone.trim() || 'Asia/Shanghai',
      assign_to: Silian_ruleForm.assign_to === 'none' ? null : Number(Silian_ruleForm.assign_to),
      score_boost: Number(Silian_ruleForm.score_boost || 0),
      required_agent_level: Silian_ruleForm.required_agent_level === 'none' ? null : Number(Silian_ruleForm.required_agent_level),
      skill_hints: Silian_ruleForm.skill_hints.split(',').map((Silian_item) => Silian_item.trim()).filter(Boolean),
      tag_ids: Silian_ruleForm.tag_ids,
    });
  };

  const Silian_handleTicketWorkflowSave = () => {
    if (!Silian_selectedTicketId || Silian_saveTicketWorkflowMutation.isLoading || !Silian_isTicketWorkflowStateSynced) {
      return;
    }

    Silian_saveTicketWorkflowMutation.mutate({
      id: Silian_selectedTicketId,
      payload: { status: Silian_ticketWorkflowStatus },
    });
  };

  const Silian_isTicketWorkflowStateSynced = Number(Silian_ticketDetail?.id ?? 0) > 0 && Number(Silian_ticketWorkflowStateTicketId ?? 0) === Number(Silian_ticketDetail?.id ?? 0);
  const Silian_ticketWorkflowSaveDisabled = Silian_saveTicketWorkflowMutation.isLoading || !Silian_isTicketWorkflowStateSynced || Silian_ticketWorkflowStatus === (Silian_ticketDetail?.status || 'open');

  const Silian_handleRoutingSettingsSave = () => {
    Silian_saveRoutingSettingsMutation.mutate({
      ai_enabled: Boolean(Silian_routingSettingsForm.ai_enabled),
      ai_timeout_ms: Number(Silian_routingSettingsForm.ai_timeout_ms || 12000),
      due_soon_minutes: Number(Silian_routingSettingsForm.due_soon_minutes || 30),
      weights: Silian_routingSettingsForm.weights ?? {},
      fallback: Silian_routingSettingsForm.fallback ?? {},
      defaults: Silian_routingSettingsForm.defaults ?? {},
    });
  };

  const Silian_handleAssigneeProfileSave = () => {
    if (!Silian_selectedAssigneeId || !Silian_assigneeProfileForm) {
      return;
    }

    Silian_saveRoutingProfileMutation.mutate({
      id: Silian_selectedAssigneeId,
      payload: {
        level: Number(Silian_assigneeProfileForm.level || 1),
        skills: Silian_assigneeProfileForm.skills.split(',').map((Silian_item) => Silian_item.trim()).filter(Boolean),
        languages: Silian_assigneeProfileForm.languages.split(',').map((Silian_item) => Silian_item.trim()).filter(Boolean),
        max_active_tickets: Number(Silian_assigneeProfileForm.max_active_tickets || 10),
        is_auto_assignable: Boolean(Silian_assigneeProfileForm.is_auto_assignable),
        status: Silian_assigneeProfileForm.status,
        weight_overrides: {
          flat_boost: Number(Silian_assigneeProfileForm.flat_boost || 0),
        },
      },
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[1.8rem] border border-emerald-200 bg-emerald-50 px-6 py-6 dark:border-emerald-500/20 dark:bg-emerald-500/10">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300">
          {Silian_t('adminSupport.eyebrow')}
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">{Silian_t('adminSupport.title')}</h2>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Silian_summaryCards.map((Silian_card) => (
          <Silian_MetricCard key={Silian_card.key} icon={Silian_card.icon} label={Silian_card.label} value={Silian_card.value} hint={Silian_card.hint} />
        ))}
      </section>

      <Silian_Tabs value={Silian_tab} onValueChange={Silian_setTab} className="space-y-6">
        <Silian_TabsList className="rounded-2xl border border-border bg-card p-1">
          <Silian_TabsTrigger value="team" className="rounded-xl border-r-0">{Silian_t('adminSupport.tabs.team')}</Silian_TabsTrigger>
          <Silian_TabsTrigger value="tickets" className="rounded-xl border-r-0">{Silian_t('adminSupport.tabs.tickets')}</Silian_TabsTrigger>
          <Silian_TabsTrigger value="settings" className="rounded-xl border-r-0">{Silian_t('adminSupport.tabs.settings')}</Silian_TabsTrigger>
        </Silian_TabsList>

        <Silian_TabsContent value="team" className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <Silian_Card>
            <Silian_CardHeader>
              <Silian_CardTitle>{Silian_t('adminSupport.team.listTitle')}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('adminSupport.team.listSubtitle')}</Silian_CardDescription>
            </Silian_CardHeader>
            <Silian_CardContent className="space-y-3">
              {Silian_assigneesQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">{Silian_t('common.loading')}</p>}
              {Silian_assignees.map((Silian_assignee) => (
                <button
                  key={Silian_assignee.id}
                  type="button"
                  onClick={() => Silian_setSelectedAssigneeId(Silian_assignee.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${Silian_selectedAssigneeId === Silian_assignee.id ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-border bg-background hover:border-emerald-200 dark:hover:border-emerald-500/20'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{Silian_assignee.username || Silian_assignee.email || `#${Silian_assignee.id}`}</p>
                      <p className="mt-1 truncate text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                        {Silian_t(`adminSupport.roles.${Silian_assignee.role}`)}
                      </p>
                      <div className="mt-3">
                        <Silian_FeedbackSnapshot
                          averageRating={Silian_assignee.avg_feedback_rating}
                          ratingCount={Silian_assignee.rating_count}
                          t={Silian_t}
                          compact
                        />
                      </div>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                      <Silian_UserRound className="h-4 w-4" />
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl border border-slate-200 bg-white px-2 py-3 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.team.metrics.assigned')}</p>
                      <p className="mt-2 text-lg font-semibold">{Silian_assignee.assigned_total_count ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-2 py-3 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.team.metrics.notStarted')}</p>
                      <p className="mt-2 text-lg font-semibold">{Silian_assignee.open_count ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-2 py-3 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.team.metrics.inProgress')}</p>
                      <p className="mt-2 text-lg font-semibold">{Silian_assignee.in_progress_count ?? 0}</p>
                    </div>
                  </div>
                </button>
              ))}
            </Silian_CardContent>
          </Silian_Card>

          <div className="space-y-6">
            <Silian_Card>
              <Silian_CardHeader>
                <Silian_CardTitle>{Silian_t('adminSupport.team.detailTitle')}</Silian_CardTitle>
                <Silian_CardDescription>{Silian_t('adminSupport.team.detailSubtitle')}</Silian_CardDescription>
              </Silian_CardHeader>
              <Silian_CardContent>
                {Silian_assigneeDetailQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Silian_Loader2 className="h-4 w-4 animate-spin" />
                    {Silian_t('common.loading')}
                  </div>
                ) : !Silian_assigneeDetail ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.team.empty')}</p>
                ) : (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-3">
                      <Silian_MetricCard icon={Silian_UserRound} label={Silian_t('adminSupport.team.metrics.assigned')} value={Silian_assigneeDetail.assigned_total_count ?? 0} />
                      <Silian_MetricCard icon={Silian_Clock3} label={Silian_t('adminSupport.team.metrics.notStarted')} value={Silian_assigneeDetail.open_count ?? 0} />
                      <Silian_MetricCard icon={Silian_CheckCircle2} label={Silian_t('adminSupport.team.metrics.inProgress')} value={Silian_assigneeDetail.in_progress_count ?? 0} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-border px-4 py-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Silian_Mail className="h-4 w-4" />
                          {Silian_t('adminSupport.team.contactTitle')}
                        </div>
                        <div className="mt-4 space-y-3 text-sm">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.team.fields.email')}</span>
                            <span className="truncate">{Silian_assigneeDetail.email || '--'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.team.fields.role')}</span>
                            <span>{Silian_t(`adminSupport.roles.${Silian_assigneeDetail.role}`)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.team.fields.status')}</span>
                            <span>{Silian_assigneeDetail.status || '--'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border px-4 py-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Silian_Shield className="h-4 w-4" />
                          {Silian_t('adminSupport.team.profileTitle')}
                        </div>
                        <div className="mt-4 space-y-3 text-sm">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.team.fields.school')}</span>
                            <span>{Silian_assigneeDetail.school || '--'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.team.fields.region')}</span>
                            <span>{Silian_assigneeDetail.region_code || '--'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.team.fields.location')}</span>
                            <span>{Silian_assigneeDetail.location || '--'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.team.fields.group')}</span>
                            <span>{Silian_assigneeDetail.group_id ?? '--'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.team.fields.lastLogin')}</span>
                            <span>{Silian_formatSupportDate(Silian_assigneeDetail.last_login_at, Silian_currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.team.fields.createdAt')}</span>
                            <span>{Silian_formatSupportDate(Silian_assigneeDetail.created_at, Silian_currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                      <div className="rounded-2xl border border-border px-4 py-4">
                        <p className="text-sm font-medium">{Silian_t('adminSupport.team.notesTitle')}</p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-500 dark:text-slate-400">
                          {Silian_assigneeDetail.admin_notes || Silian_t('adminSupport.team.noNotes')}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-border px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{Silian_t('adminSupport.team.routingProfileTitle')}</p>
                          <Silian_Button className="rounded-full" size="sm" onClick={Silian_handleAssigneeProfileSave} loading={Silian_saveRoutingProfileMutation.isLoading}>
                            <Silian_Save className="mr-2 h-4 w-4" />
                            {Silian_t('adminSupport.actions.saveProfile')}
                          </Silian_Button>
                        </div>
                        {Silian_assigneeProfileForm ? (
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">{Silian_t('adminSupport.team.routingFields.level')}</label>
                              <Silian_Input type="number" min="1" max="5" value={Silian_assigneeProfileForm.level} onChange={(Silian_event) => Silian_setAssigneeProfileForm((Silian_current) => ({ ...Silian_current, level: Silian_event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">{Silian_t('adminSupport.team.routingFields.maxActiveTickets')}</label>
                              <Silian_Input type="number" min="1" value={Silian_assigneeProfileForm.max_active_tickets} onChange={(Silian_event) => Silian_setAssigneeProfileForm((Silian_current) => ({ ...Silian_current, max_active_tickets: Silian_event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">{Silian_t('adminSupport.team.routingFields.skills')}</label>
                              <Silian_Input value={Silian_assigneeProfileForm.skills} onChange={(Silian_event) => Silian_setAssigneeProfileForm((Silian_current) => ({ ...Silian_current, skills: Silian_event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">{Silian_t('adminSupport.team.routingFields.languages')}</label>
                              <Silian_Input value={Silian_assigneeProfileForm.languages} onChange={(Silian_event) => Silian_setAssigneeProfileForm((Silian_current) => ({ ...Silian_current, languages: Silian_event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">{Silian_t('adminSupport.team.routingFields.status')}</label>
                              <Silian_Select value={Silian_assigneeProfileForm.status} onValueChange={(Silian_value) => Silian_setAssigneeProfileForm((Silian_current) => ({ ...Silian_current, status: Silian_value }))}>
                                <Silian_SelectTrigger><Silian_SelectValue /></Silian_SelectTrigger>
                                <Silian_SelectContent>
                                  <Silian_SelectItem value="active">{Silian_t('adminSupport.team.routingStatus.active')}</Silian_SelectItem>
                                  <Silian_SelectItem value="backup">{Silian_t('adminSupport.team.routingStatus.backup')}</Silian_SelectItem>
                                  <Silian_SelectItem value="offline">{Silian_t('adminSupport.team.routingStatus.offline')}</Silian_SelectItem>
                                </Silian_SelectContent>
                              </Silian_Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">{Silian_t('adminSupport.team.routingFields.flatBoost')}</label>
                              <Silian_Input type="number" step="0.1" value={Silian_assigneeProfileForm.flat_boost} onChange={(Silian_event) => Silian_setAssigneeProfileForm((Silian_current) => ({ ...Silian_current, flat_boost: Silian_event.target.value }))} />
                            </div>
                            <label className="flex items-center justify-between rounded-2xl border border-border px-4 py-3 md:col-span-2">
                              <span className="text-sm font-medium">{Silian_t('adminSupport.team.routingFields.autoAssignable')}</span>
                              <Silian_Switch checked={Silian_assigneeProfileForm.is_auto_assignable} onCheckedChange={(Silian_checked) => Silian_setAssigneeProfileForm((Silian_current) => ({ ...Silian_current, is_auto_assignable: Silian_checked }))} />
                            </label>
                          </div>
                        ) : null}
                      </div>
                    </div>
                )}
              </Silian_CardContent>
            </Silian_Card>

            <Silian_Card>
              <Silian_CardHeader>
                <Silian_CardTitle>{Silian_t('adminSupport.team.feedback.title')}</Silian_CardTitle>
                <Silian_CardDescription>{Silian_t('adminSupport.team.feedback.subtitle')}</Silian_CardDescription>
              </Silian_CardHeader>
              <Silian_CardContent>
                {!Silian_assigneeDetail ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.team.empty')}</p>
                ) : (
                  <Silian_Tabs value={Silian_assigneeDetailTab} onValueChange={Silian_setAssigneeDetailTab} className="space-y-5">
                    <Silian_TabsList className="grid w-full grid-cols-2 overflow-hidden rounded-[1.2rem] border-slate-200 bg-slate-100/90 dark:border-white/10 dark:bg-white/5">
                      <Silian_TabsTrigger value="overview" className="border-r-slate-200 dark:border-r-white/10">
                        {Silian_t('adminSupport.team.detailTabs.overview')}
                      </Silian_TabsTrigger>
                      <Silian_TabsTrigger value="feedback">
                        {Silian_t('adminSupport.team.detailTabs.feedback')}
                      </Silian_TabsTrigger>
                    </Silian_TabsList>

                    <Silian_TabsContent value="overview" className="space-y-6">
                      <div className="grid gap-4 md:grid-cols-3">
                        <Silian_MetricCard
                          icon={Silian_Star}
                          label={Silian_t('adminSupport.team.feedback.averageLabel')}
                          value={Silian_assigneeDetail.feedback_summary?.average_rating !== null && Silian_assigneeDetail.feedback_summary?.average_rating !== undefined
                            ? Silian_formatRatingValue(Silian_assigneeDetail.feedback_summary.average_rating)
                            : '--'}
                          hint={Silian_t('adminSupport.team.feedback.averageHint')}
                        />
                        <Silian_MetricCard
                          icon={Silian_UserRound}
                          label={Silian_t('adminSupport.team.feedback.countLabel')}
                          value={Silian_assigneeDetail.feedback_summary?.rating_count ?? 0}
                          hint={Silian_t('adminSupport.team.feedback.countHint')}
                        />
                        <Silian_MetricCard
                          icon={Silian_Clock3}
                          label={Silian_t('adminSupport.team.feedback.lastLabel')}
                          value={Silian_formatSupportDate(Silian_assigneeDetail.feedback_summary?.last_feedback_at, Silian_currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}
                          hint={Silian_t('adminSupport.team.feedback.lastHint')}
                        />
                      </div>

                      <div className="rounded-2xl border border-border px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{Silian_t('adminSupport.team.feedback.distributionTitle')}</p>
                          <Silian_FeedbackSnapshot
                            averageRating={Silian_assigneeDetail.feedback_summary?.average_rating}
                            ratingCount={Silian_assigneeDetail.feedback_summary?.rating_count}
                            t={Silian_t}
                          />
                        </div>
                        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                          {Silian_t('adminSupport.team.feedback.routingHint')}
                        </p>
                        <div className="mt-4 space-y-3">
                          {(Silian_assigneeDetail.feedback_summary?.distribution ?? []).map((Silian_bucket) => {
                            const Silian_total = Math.max(1, Number(Silian_assigneeDetail.feedback_summary?.rating_count ?? 0));
                            const Silian_bucketCount = Number(Silian_bucket.count ?? 0);
                            const Silian_width = `${Math.max(Silian_bucketCount > 0 ? 10 : 0, Math.round((Silian_bucketCount / Silian_total) * 100))}%`;

                            return (
                              <div key={`rating-${Silian_bucket.rating}`} className="space-y-2">
                                <div className="flex items-center justify-between gap-3 text-sm">
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{Silian_bucket.rating}</span>
                                    <Silian_RatingStars value={Silian_bucket.rating} />
                                  </div>
                                  <span className="text-slate-500 dark:text-slate-400">
                                    {Silian_t('adminSupport.team.feedback.countValue', { count: Silian_bucketCount })}
                                  </span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                                  <div className="h-2 rounded-full bg-amber-400" style={{ width: Silian_width }} />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    </Silian_TabsContent>

                    <Silian_TabsContent value="feedback" className="space-y-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium">{Silian_t('adminSupport.team.feedback.detailTitle')}</p>
                        <span className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                          {Silian_t('adminSupport.team.feedback.detailCount', { count: Silian_assigneeDetail.feedback_entries?.length ?? 0 })}
                        </span>
                      </div>
                      <p className="text-sm text-slate-500 dark:text-slate-400">
                        {Silian_t('adminSupport.team.feedback.routingHint')}
                      </p>

                      {(Silian_assigneeDetail.feedback_entries ?? []).length === 0 ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">
                          {Silian_t('adminSupport.team.feedback.empty')}
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {(Silian_assigneeDetail.feedback_entries ?? []).map((Silian_entry) => (
                            <div key={Silian_entry.id} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-4 dark:border-slate-700 dark:bg-slate-900">
                              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <p className="text-sm font-semibold text-slate-900 dark:text-slate-100">
                                    {Silian_entry.reviewer?.username || Silian_entry.reviewer?.email || `#${Silian_entry.reviewer?.id ?? '--'}`}
                                  </p>
                                  <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                                    {Silian_t('adminSupport.team.feedback.byLine', {
                                      ticketId: Silian_entry.ticket?.id ?? 0,
                                      subject: Silian_entry.ticket?.subject || '--',
                                    })}
                                  </p>
                                </div>
                                <div className="text-left sm:text-right">
                                  <Silian_RatingStars value={Silian_entry.rating} className="justify-start sm:justify-end" />
                                  <p className="mt-2 text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">
                                    {Silian_formatSupportDate(Silian_entry.updated_at || Silian_entry.created_at, Silian_currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}
                                  </p>
                                </div>
                              </div>

                              <div className="mt-3 flex flex-wrap gap-2">
                                <Silian_Badge variant="outline" className={Silian_getStatusTone(Silian_entry.ticket?.status)}>{Silian_t(`support.statuses.${Silian_entry.ticket?.status}`)}</Silian_Badge>
                                <Silian_Badge variant={Silian_getPriorityVariant(Silian_entry.ticket?.priority)}>{Silian_t(`support.priorities.${Silian_entry.ticket?.priority}`)}</Silian_Badge>
                              </div>

                              <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">
                                {Silian_entry.comment || Silian_t('adminSupport.team.feedback.noComment')}
                              </p>

                              <div className="mt-4">
                                <Silian_Link
                                  to={`/support/tickets/${Silian_entry.ticket?.id}`}
                                  className="inline-flex items-center rounded-full border border-border px-3 py-1 text-xs font-medium text-slate-700 hover:bg-white dark:text-slate-200 dark:hover:bg-slate-950"
                                >
                                  {Silian_t('adminSupport.team.feedback.openTicket')}
                                </Silian_Link>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </Silian_TabsContent>
                  </Silian_Tabs>
                )}
              </Silian_CardContent>
            </Silian_Card>

            <Silian_Card>
              <Silian_CardHeader>
                <Silian_CardTitle>{Silian_t('adminSupport.team.recentTicketsTitle')}</Silian_CardTitle>
                <Silian_CardDescription>{Silian_t('adminSupport.team.recentTicketsSubtitle')}</Silian_CardDescription>
              </Silian_CardHeader>
              <Silian_CardContent className="space-y-3">
                {(Silian_assigneeDetail?.recent_tickets ?? []).length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.team.noRecentTickets')}</p>
                )}
                {(Silian_assigneeDetail?.recent_tickets ?? []).map((Silian_ticket) => (
                  <Silian_Link
                    key={Silian_ticket.id}
                    to={`/support/tickets/${Silian_ticket.id}`}
                    className="block rounded-2xl border border-border px-4 py-4 transition hover:border-emerald-300 hover:bg-emerald-50/40 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">#{Silian_ticket.id} {Silian_ticket.subject}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                          {Silian_formatSupportDate(Silian_ticket.last_replied_at || Silian_ticket.updated_at || Silian_ticket.created_at, Silian_currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Silian_Badge variant="outline" className={Silian_getStatusTone(Silian_ticket.status)}>{Silian_t(`support.statuses.${Silian_ticket.status}`)}</Silian_Badge>
                        <Silian_Badge variant={Silian_getPriorityVariant(Silian_ticket.priority)}>{Silian_t(`support.priorities.${Silian_ticket.priority}`)}</Silian_Badge>
                      </div>
                    </div>
                  </Silian_Link>
                ))}
              </Silian_CardContent>
            </Silian_Card>
          </div>
        </Silian_TabsContent>

        <Silian_TabsContent value="tickets" className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Silian_Card>
            <Silian_CardHeader className="space-y-4">
              <div>
                <Silian_CardTitle>{Silian_t('adminSupport.tickets.listTitle')}</Silian_CardTitle>
                <Silian_CardDescription>{Silian_t('adminSupport.tickets.listSubtitle')}</Silian_CardDescription>
              </div>
              <Silian_Select value={Silian_ticketStatusFilter} onValueChange={Silian_setTicketStatusFilter}>
                <Silian_SelectTrigger>
                  <Silian_SelectValue />
                </Silian_SelectTrigger>
                <Silian_SelectContent>
                  <Silian_SelectItem value="all">{Silian_t('adminSupport.filters.allStatuses')}</Silian_SelectItem>
                  {['open', 'in_progress', 'waiting_user', 'resolved', 'closed'].map((Silian_statusValue) => (
                    <Silian_SelectItem key={Silian_statusValue} value={Silian_statusValue}>
                      {Silian_t(`support.statuses.${Silian_statusValue}`)}
                    </Silian_SelectItem>
                  ))}
                </Silian_SelectContent>
              </Silian_Select>
            </Silian_CardHeader>
            <Silian_CardContent className="space-y-3">
              {Silian_ticketsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Silian_Loader2 className="h-4 w-4 animate-spin" />
                  {Silian_t('common.loading')}
                </div>
              ) : null}
              {Silian_ticketsQuery.error ? (
                <Silian_Alert variant="destructive">
                  <Silian_AlertDescription>{Silian_t('adminSupport.messages.loadFailed')}</Silian_AlertDescription>
                </Silian_Alert>
              ) : null}
              {!Silian_ticketsQuery.isLoading && Silian_tickets.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.tickets.empty')}</p>
              ) : null}
              {Silian_tickets.map((Silian_ticket) => (
                <Silian_TicketQueueCard
                  key={Silian_ticket.id}
                  ticket={Silian_ticket}
                  selected={Silian_ticket.id === Silian_selectedTicketId}
                  onSelect={Silian_setSelectedTicketId}
                  t={Silian_t}
                  locale={Silian_currentLanguage === 'zh' ? 'zh-CN' : 'en-US'}
                />
              ))}
            </Silian_CardContent>
          </Silian_Card>

          <Silian_Card>
            <Silian_CardHeader>
              <Silian_CardTitle>{Silian_t('adminSupport.tickets.detailTitle')}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('adminSupport.tickets.detailSubtitle')}</Silian_CardDescription>
            </Silian_CardHeader>
            <Silian_CardContent className="space-y-5">
              {Silian_ticketDetailQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Silian_Loader2 className="h-4 w-4 animate-spin" />
                  {Silian_t('common.loading')}
                </div>
              ) : Silian_ticketDetailQuery.error ? (
                <Silian_Alert variant="destructive">
                  <Silian_AlertDescription>{Silian_t('adminSupport.messages.loadFailed')}</Silian_AlertDescription>
                </Silian_Alert>
              ) : !Silian_ticketDetail ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.tickets.emptyDetail')}</p>
              ) : (
                (() => {
                  const Silian_locale = Silian_currentLanguage === 'zh' ? 'zh-CN' : 'en-US';
                  const Silian_slaMeta = Silian_getSlaMeta(Silian_ticketDetail, Silian_locale);
                  const Silian_firstResponseMeta = Silian_getSlaMilestoneMeta(Silian_ticketDetail, 'first_response', Silian_locale);
                  const Silian_resolutionMeta = Silian_getSlaMilestoneMeta(Silian_ticketDetail, 'resolution', Silian_locale);

                  return <div className="space-y-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">#{Silian_ticketDetail.id}</p>
                      <h3 className="mt-2 text-2xl font-semibold">{Silian_ticketDetail.subject}</h3>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{Silian_ticketDetail.latest_message_preview || '--'}</p>
                    </div>
                    <Silian_Link to={`/support/tickets/${Silian_ticketDetail.id}`} className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                      {Silian_t('adminSupport.tickets.openInPortal')}
                    </Silian_Link>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Silian_Badge variant="outline" className={Silian_getStatusTone(Silian_ticketDetail.status)}>{Silian_t(`support.statuses.${Silian_ticketDetail.status}`)}</Silian_Badge>
                    <Silian_Badge variant={Silian_getPriorityVariant(Silian_ticketDetail.priority)}>{Silian_t(`support.priorities.${Silian_ticketDetail.priority}`)}</Silian_Badge>
                    {Silian_slaMeta.state ? <Silian_Badge variant="outline" className={Silian_getSlaTone(Silian_slaMeta.state)}>{Silian_t(`support.slaStatuses.${Silian_slaMeta.state}`, { defaultValue: Silian_slaMeta.state })}</Silian_Badge> : null}
                    <Silian_Badge variant="outline">{Silian_t(`support.categories.${Silian_ticketDetail.category}`)}</Silian_Badge>
                  </div>

                  <div className="rounded-2xl border border-border px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.tickets.workflowTitle')}</p>
                    <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
                      <div className="min-w-0 flex-1 space-y-2">
                        <label className="text-sm font-medium">{Silian_t('adminSupport.filters.status')}</label>
                        <Silian_Select value={Silian_ticketWorkflowStatus} onValueChange={Silian_setTicketWorkflowStatus} disabled={Silian_saveTicketWorkflowMutation.isLoading || !Silian_isTicketWorkflowStateSynced}>
                          <Silian_SelectTrigger className="w-full">
                            <Silian_SelectValue />
                          </Silian_SelectTrigger>
                          <Silian_SelectContent>
                            {Silian_TICKET_STATUS_OPTIONS.map((Silian_option) => (
                              <Silian_SelectItem key={Silian_option.value} value={Silian_option.value}>
                                {Silian_t(Silian_option.labelKey)}
                              </Silian_SelectItem>
                            ))}
                          </Silian_SelectContent>
                        </Silian_Select>
                      </div>
                      <Silian_Button
                        type="button"
                        className="rounded-full sm:min-w-[180px]"
                        onClick={Silian_handleTicketWorkflowSave}
                        loading={Silian_saveTicketWorkflowMutation.isLoading}
                        disabled={Silian_ticketWorkflowSaveDisabled}
                      >
                        <Silian_Save className="mr-2 h-4 w-4" />
                        {Silian_t('adminSupport.actions.saveWorkflow')}
                      </Silian_Button>
                    </div>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border px-4 py-4 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.tickets.identityTitle')}</p>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500 dark:text-slate-400">{Silian_t('support.portal.requesterName')}</span>
                          <span>{Silian_ticketDetail.requester?.username || '--'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500 dark:text-slate-400">{Silian_t('support.portal.requesterEmail')}</span>
                          <span className="truncate">{Silian_ticketDetail.requester?.email || '--'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500 dark:text-slate-400">{Silian_t('support.portal.assignedTo')}</span>
                          <span>{Silian_ticketDetail.assigned_user?.username || Silian_t('support.portal.unassigned')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border px-4 py-4 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.tickets.slaTitle')}</p>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500 dark:text-slate-400">{Silian_t('support.portal.firstResponseDueLabel')}</span>
                          <div className="text-right">
                            <div>{Silian_firstResponseMeta.dueAtLabel}</div>
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{Silian_firstResponseMeta.relativeLabel}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500 dark:text-slate-400">{Silian_t('support.portal.resolutionDueLabel')}</span>
                          <div className="text-right">
                            <div>{Silian_resolutionMeta.dueAtLabel}</div>
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{Silian_resolutionMeta.relativeLabel}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500 dark:text-slate-400">{Silian_t('support.portal.assignmentSourceLabel')}</span>
                          <span>{Silian_ticketDetail.assignment_source || '--'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {(Silian_ticketDetail.tags ?? []).length > 0 ? (
                    <div className="rounded-2xl border border-border px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{Silian_t('support.portal.tagsTitle')}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(Silian_ticketDetail.tags ?? []).map((Silian_tag) => (
                          <Silian_Badge key={Silian_tag.id} variant="outline" className={Silian_getTagTone(Silian_tag.color)}>
                            {Silian_tag.name}
                          </Silian_Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <p className="text-sm font-medium">{Silian_t('adminSupport.tickets.messagesTitle')}</p>
                    {(Silian_ticketDetail.messages ?? []).map((Silian_message) => (
                      <div key={Silian_message.id} className="rounded-2xl border border-border px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{Silian_message.sender_name || '--'}</p>
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{Silian_t(`support.senderRoles.${Silian_message.sender_role}`)}</p>
                          </div>
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                            {Silian_formatSupportDate(Silian_message.created_at, Silian_currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}
                          </p>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{Silian_message.body}</p>
                        {(Silian_message.attachments ?? []).length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {Silian_message.attachments.map((Silian_attachment) => (
                              <a
                                key={Silian_attachment.id}
                                href={Silian_attachment.download_url || Silian_attachment.file_path}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
                              >
                                {Silian_attachment.original_name}
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-border px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.tickets.routingSummaryTitle')}</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                        <p className="font-medium">{Silian_t('adminSupport.tickets.topFactors')}</p>
                        <p className="mt-2 text-slate-500 dark:text-slate-400">{Silian_topFactorsLabel(Silian_ticketDetail.routing_summary?.top_factors) || '--'}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                        <p className="font-medium">{Silian_t('adminSupport.tickets.routingFallbackLabel')}</p>
                        <p className="mt-2 text-slate-500 dark:text-slate-400">{Silian_ticketDetail.routing_summary?.fallback_reason || '--'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{Silian_t('adminSupport.tickets.routingRunsTitle')}</p>
                      <span className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{Silian_ticketDetail.routing_runs?.length ?? 0}</span>
                    </div>
                    {(Silian_ticketDetail.routing_runs ?? []).length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.tickets.noRoutingRuns')}</p>
                    ) : (
                      Silian_ticketDetail.routing_runs.map((Silian_run) => (
                        <Silian_RoutingRunCard key={Silian_run.id} run={Silian_run} t={Silian_t} locale={Silian_locale} />
                      ))
                    )}
                  </div>
                </div>;
                })()
              )}
            </Silian_CardContent>
          </Silian_Card>
        </Silian_TabsContent>

        <Silian_TabsContent value="settings" className="space-y-6">
          <Silian_Card>
            <Silian_CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Silian_CardTitle>{Silian_t('adminSupport.tabs.settings')}</Silian_CardTitle>
                <Silian_CardDescription>{Silian_t('adminSupport.reports.subtitle')}</Silian_CardDescription>
              </div>
              <Silian_Tabs value={Silian_settingsTab} onValueChange={Silian_setSettingsTab}>
                <Silian_TabsList className="rounded-2xl border border-border bg-card p-1">
                  <Silian_TabsTrigger value="routing" className="rounded-xl border-r-0">{Silian_t('adminSupport.tabs.routing')}</Silian_TabsTrigger>
                  <Silian_TabsTrigger value="rules" className="rounded-xl border-r-0">{Silian_t('adminSupport.tabs.rules')}</Silian_TabsTrigger>
                  <Silian_TabsTrigger value="tags" className="rounded-xl border-r-0">{Silian_t('adminSupport.tabs.tags')}</Silian_TabsTrigger>
                  <Silian_TabsTrigger value="reports" className="rounded-xl border-r-0">{Silian_t('adminSupport.tabs.reports')}</Silian_TabsTrigger>
                </Silian_TabsList>
              </Silian_Tabs>
            </Silian_CardHeader>
          </Silian_Card>

          <Silian_Tabs value={Silian_settingsTab} onValueChange={Silian_setSettingsTab} className="space-y-6">
        <Silian_TabsContent value="routing">
          <Silian_Card>
            <Silian_CardHeader>
              <Silian_CardTitle>{Silian_t('adminSupport.routing.title')}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('adminSupport.routing.subtitle')}</Silian_CardDescription>
            </Silian_CardHeader>
            <Silian_CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{Silian_t('adminSupport.routing.fields.aiTimeout')}</label>
                  <Silian_Input type="number" value={Silian_routingSettingsForm.ai_timeout_ms ?? 12000} onChange={(Silian_event) => Silian_setRoutingSettingsForm((Silian_current) => ({ ...Silian_current, ai_timeout_ms: Silian_event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{Silian_t('adminSupport.routing.fields.dueSoonMinutes')}</label>
                  <Silian_Input type="number" value={Silian_routingSettingsForm.due_soon_minutes ?? 30} onChange={(Silian_event) => Silian_setRoutingSettingsForm((Silian_current) => ({ ...Silian_current, due_soon_minutes: Silian_event.target.value }))} />
                </div>
                <label className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
                  <span className="text-sm font-medium">{Silian_t('adminSupport.routing.fields.aiEnabled')}</span>
                  <Silian_Switch checked={Boolean(Silian_routingSettingsForm.ai_enabled)} onCheckedChange={(Silian_checked) => Silian_setRoutingSettingsForm((Silian_current) => ({ ...Silian_current, ai_enabled: Silian_checked }))} />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{Silian_t('adminSupport.routing.fields.defaultFirstResponse')}</label>
                  <Silian_Input type="number" value={Silian_routingSettingsForm.defaults?.first_response_minutes ?? 240} onChange={(Silian_event) => Silian_setRoutingSettingsForm((Silian_current) => ({ ...Silian_current, defaults: { ...Silian_current.defaults, first_response_minutes: Number(Silian_event.target.value) } }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{Silian_t('adminSupport.routing.fields.defaultResolution')}</label>
                  <Silian_Input type="number" value={Silian_routingSettingsForm.defaults?.resolution_minutes ?? 1440} onChange={(Silian_event) => Silian_setRoutingSettingsForm((Silian_current) => ({ ...Silian_current, defaults: { ...Silian_current.defaults, resolution_minutes: Number(Silian_event.target.value) } }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Object.entries(Silian_routingSettingsForm.weights ?? {}).map(([Silian_key, Silian_value]) => (
                  <div key={Silian_key} className="space-y-2">
                    <label className="text-sm font-medium">{Silian_t(`adminSupport.routing.weights.${Silian_key}`, Silian_key)}</label>
                    <Silian_Input type="number" step="0.1" value={Silian_value} onChange={(Silian_event) => Silian_setRoutingSettingsForm((Silian_current) => ({ ...Silian_current, weights: { ...Silian_current.weights, [Silian_key]: Number(Silian_event.target.value) } }))} />
                  </div>
                ))}
              </div>

              <Silian_Button className="rounded-full" onClick={Silian_handleRoutingSettingsSave} loading={Silian_saveRoutingSettingsMutation.isLoading}>
                <Silian_Save className="mr-2 h-4 w-4" />
                {Silian_t('adminSupport.actions.saveRoutingSettings')}
              </Silian_Button>
            </Silian_CardContent>
          </Silian_Card>
        </Silian_TabsContent>

        <Silian_TabsContent value="rules" className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <Silian_Card>
            <Silian_CardHeader>
              <Silian_CardTitle>{Silian_t('adminSupport.rules.listTitle')}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('adminSupport.rules.listSubtitle')}</Silian_CardDescription>
            </Silian_CardHeader>
            <Silian_CardContent className="space-y-3">
              <Silian_Button
                variant="outline"
                className="w-full rounded-full"
                onClick={() => {
                  Silian_setIsRuleDraft(true);
                  Silian_setRuleForm(Silian_EMPTY_RULE_FORM);
                }}
              >
                {Silian_t('adminSupport.rules.newRule')}
              </Silian_Button>
              {Silian_rulesQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">{Silian_t('common.loading')}</p>}
              {Silian_rules.map((Silian_rule) => (
                <button
                  key={Silian_rule.id}
                  type="button"
                  onClick={() => {
                    Silian_setIsRuleDraft(false);
                    Silian_setRuleForm(Silian_hydrateRuleForm(Silian_rule));
                  }}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${Silian_ruleForm.id === Silian_rule.id ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-border bg-background hover:border-emerald-200 dark:hover:border-emerald-500/20'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{Silian_rule.name}</p>
                    <Silian_Badge variant="outline" className={Silian_rule.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200'}>
                      {Silian_rule.is_active ? Silian_t('adminSupport.common.active') : Silian_t('adminSupport.common.inactive')}
                    </Silian_Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{Silian_rule.description || Silian_t('adminSupport.common.noDescription')}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {Silian_rule.match_category ? <Silian_Badge variant="outline">{Silian_t(`support.categories.${Silian_rule.match_category}`)}</Silian_Badge> : null}
                    {Silian_rule.match_priority ? <Silian_Badge variant="outline">{Silian_t(`support.priorities.${Silian_rule.match_priority}`)}</Silian_Badge> : null}
                    {Silian_rule.assign_user?.username ? <Silian_Badge variant="outline">{Silian_rule.assign_user.username}</Silian_Badge> : null}
                    <Silian_Badge variant="outline">{Silian_t('adminSupport.rules.scoreBoostBadge', { value: Silian_rule.score_boost ?? 0 })}</Silian_Badge>
                  </div>
                </button>
              ))}
            </Silian_CardContent>
          </Silian_Card>

          <Silian_Card>
            <Silian_CardHeader>
              <Silian_CardTitle>{Silian_t('adminSupport.rules.editorTitle')}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('adminSupport.rules.editorSubtitle')}</Silian_CardDescription>
            </Silian_CardHeader>
            <Silian_CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{Silian_t('adminSupport.rules.fields.name')}</label>
                  <Silian_Input value={Silian_ruleForm.name} onChange={(Silian_event) => Silian_setRuleForm((Silian_current) => ({ ...Silian_current, name: Silian_event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{Silian_t('adminSupport.rules.fields.sortOrder')}</label>
                  <Silian_Input type="number" value={Silian_ruleForm.sort_order} onChange={(Silian_event) => Silian_setRuleForm((Silian_current) => ({ ...Silian_current, sort_order: Silian_event.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{Silian_t('adminSupport.rules.fields.description')}</label>
                <Silian_Textarea rows={3} value={Silian_ruleForm.description} onChange={(Silian_event) => Silian_setRuleForm((Silian_current) => ({ ...Silian_current, description: Silian_event.target.value }))} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{Silian_t('adminSupport.rules.fields.category')}</label>
                  <Silian_Select value={Silian_ruleForm.match_category} onValueChange={(Silian_value) => Silian_setRuleForm((Silian_current) => ({ ...Silian_current, match_category: Silian_value }))}>
                    <Silian_SelectTrigger><Silian_SelectValue /></Silian_SelectTrigger>
                    <Silian_SelectContent>
                      <Silian_SelectItem value="all">{Silian_t('adminSupport.filters.anyCategory')}</Silian_SelectItem>
                      {Silian_TICKET_CATEGORY_OPTIONS.map((Silian_option) => (
                        <Silian_SelectItem key={Silian_option.value} value={Silian_option.value}>{Silian_t(Silian_option.labelKey)}</Silian_SelectItem>
                      ))}
                    </Silian_SelectContent>
                  </Silian_Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{Silian_t('adminSupport.rules.fields.priority')}</label>
                  <Silian_Select value={Silian_ruleForm.match_priority} onValueChange={(Silian_value) => Silian_setRuleForm((Silian_current) => ({ ...Silian_current, match_priority: Silian_value }))}>
                    <Silian_SelectTrigger><Silian_SelectValue /></Silian_SelectTrigger>
                    <Silian_SelectContent>
                      <Silian_SelectItem value="all">{Silian_t('adminSupport.filters.anyPriority')}</Silian_SelectItem>
                      {Silian_TICKET_PRIORITY_OPTIONS.map((Silian_option) => (
                        <Silian_SelectItem key={Silian_option.value} value={Silian_option.value}>{Silian_t(Silian_option.labelKey)}</Silian_SelectItem>
                      ))}
                    </Silian_SelectContent>
                  </Silian_Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{Silian_t('adminSupport.rules.fields.timeStart')}</label>
                  <Silian_Input type="time" value={Silian_ruleForm.match_time_start} onChange={(Silian_event) => Silian_setRuleForm((Silian_current) => ({ ...Silian_current, match_time_start: Silian_event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{Silian_t('adminSupport.rules.fields.timeEnd')}</label>
                  <Silian_Input type="time" value={Silian_ruleForm.match_time_end} onChange={(Silian_event) => Silian_setRuleForm((Silian_current) => ({ ...Silian_current, match_time_end: Silian_event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{Silian_t('adminSupport.rules.fields.timezone')}</label>
                  <Silian_Input value={Silian_ruleForm.timezone} onChange={(Silian_event) => Silian_setRuleForm((Silian_current) => ({ ...Silian_current, timezone: Silian_event.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{Silian_t('adminSupport.rules.fields.weekdays')}</label>
                <div className="flex flex-wrap gap-3 rounded-2xl border border-border px-4 py-3">
                  {Silian_WEEKDAY_OPTIONS.map((Silian_day) => (
                    <label key={Silian_day} className="inline-flex items-center gap-2 text-sm">
                      <Silian_Checkbox
                        checked={Silian_ruleForm.match_weekdays.includes(Silian_day)}
                        onCheckedChange={(Silian_checked) => Silian_setRuleForm((Silian_current) => ({
                          ...Silian_current,
                          match_weekdays: Silian_checked
                            ? [...Silian_current.match_weekdays, Silian_day]
                            : Silian_current.match_weekdays.filter((Silian_entry) => Silian_entry !== Silian_day),
                        }))}
                      />
                      {Silian_t(`adminSupport.weekdays.${Silian_day}`)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{Silian_t('adminSupport.rules.fields.assignTo')}</label>
                <Silian_Select value={Silian_ruleForm.assign_to} onValueChange={(Silian_value) => Silian_setRuleForm((Silian_current) => ({ ...Silian_current, assign_to: Silian_value }))}>
                    <Silian_SelectTrigger><Silian_SelectValue /></Silian_SelectTrigger>
                    <Silian_SelectContent>
                      <Silian_SelectItem value="none">{Silian_t('adminSupport.rules.noAssignee')}</Silian_SelectItem>
                      {Silian_assignees.map((Silian_assignee) => (
                        <Silian_SelectItem key={Silian_assignee.id} value={String(Silian_assignee.id)}>
                          {(Silian_assignee.username || Silian_assignee.email)} ({Silian_t(`adminSupport.roles.${Silian_assignee.role}`)}) · {Silian_t('adminSupport.team.metrics.assigned')} {Silian_assignee.assigned_total_count ?? 0}
                        </Silian_SelectItem>
                      ))}
                    </Silian_SelectContent>
                  </Silian_Select>
                </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{Silian_t('adminSupport.rules.fields.scoreBoost')}</label>
                  <Silian_Input type="number" step="0.1" value={Silian_ruleForm.score_boost} onChange={(Silian_event) => Silian_setRuleForm((Silian_current) => ({ ...Silian_current, score_boost: Silian_event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{Silian_t('adminSupport.rules.fields.requiredAgentLevel')}</label>
                  <Silian_Select value={Silian_ruleForm.required_agent_level} onValueChange={(Silian_value) => Silian_setRuleForm((Silian_current) => ({ ...Silian_current, required_agent_level: Silian_value }))}>
                    <Silian_SelectTrigger><Silian_SelectValue /></Silian_SelectTrigger>
                    <Silian_SelectContent>
                      <Silian_SelectItem value="none">{Silian_t('adminSupport.rules.noRequiredLevel')}</Silian_SelectItem>
                      {[1, 2, 3, 4, 5].map((Silian_level) => (
                        <Silian_SelectItem key={Silian_level} value={String(Silian_level)}>{Silian_t('adminSupport.rules.requiredLevelLabel', { level: Silian_level })}</Silian_SelectItem>
                      ))}
                    </Silian_SelectContent>
                  </Silian_Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{Silian_t('adminSupport.rules.fields.skillHints')}</label>
                  <Silian_Input value={Silian_ruleForm.skill_hints} onChange={(Silian_event) => Silian_setRuleForm((Silian_current) => ({ ...Silian_current, skill_hints: Silian_event.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{Silian_t('adminSupport.rules.fields.tags')}</label>
                <div className="grid gap-3 rounded-2xl border border-border px-4 py-3 md:grid-cols-2">
                  {Silian_tags.length === 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{Silian_t('adminSupport.rules.noTags')}</p>
                  )}
                  {Silian_tags.map((Silian_tag) => (
                    <label key={Silian_tag.id} className="inline-flex items-center gap-3 text-sm">
                      <Silian_Checkbox
                        checked={Silian_ruleForm.tag_ids.includes(Silian_tag.id)}
                        onCheckedChange={(Silian_checked) => Silian_setRuleForm((Silian_current) => ({
                          ...Silian_current,
                          tag_ids: Silian_checked
                            ? [...Silian_current.tag_ids, Silian_tag.id]
                            : Silian_current.tag_ids.filter((Silian_entry) => Silian_entry !== Silian_tag.id),
                        }))}
                      />
                      <Silian_Badge variant="outline" className={Silian_getTagTone(Silian_tag.color)}>{Silian_tag.name}</Silian_Badge>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
                  <span className="text-sm font-medium">{Silian_t('adminSupport.rules.fields.active')}</span>
                  <Silian_Switch checked={Silian_ruleForm.is_active} onCheckedChange={(Silian_checked) => Silian_setRuleForm((Silian_current) => ({ ...Silian_current, is_active: Silian_checked }))} />
                </label>
              </div>

              <Silian_Button className="rounded-full" onClick={Silian_handleRuleSave} loading={Silian_saveRuleMutation.isLoading}>
                <Silian_Save className="mr-2 h-4 w-4" />
                {Silian_t('adminSupport.actions.saveRule')}
              </Silian_Button>
            </Silian_CardContent>
          </Silian_Card>
        </Silian_TabsContent>

        <Silian_TabsContent value="tags" className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <Silian_Card>
            <Silian_CardHeader>
              <Silian_CardTitle>{Silian_t('adminSupport.tags.listTitle')}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('adminSupport.tags.listSubtitle')}</Silian_CardDescription>
            </Silian_CardHeader>
            <Silian_CardContent className="space-y-3">
              <Silian_Button
                variant="outline"
                className="w-full rounded-full"
                onClick={() => {
                  Silian_setIsTagDraft(true);
                  Silian_setTagForm(Silian_EMPTY_TAG_FORM);
                }}
              >
                {Silian_t('adminSupport.tags.newTag')}
              </Silian_Button>
              {Silian_tags.map((Silian_tag) => (
                <button
                  key={Silian_tag.id}
                  type="button"
                  onClick={() => {
                    Silian_setIsTagDraft(false);
                    Silian_setTagForm(Silian_hydrateTagForm(Silian_tag));
                  }}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${Silian_tagForm.id === Silian_tag.id ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-border bg-background hover:border-emerald-200 dark:hover:border-emerald-500/20'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Silian_Badge variant="outline" className={Silian_getTagTone(Silian_tag.color)}>{Silian_tag.name}</Silian_Badge>
                    <span className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{Silian_tag.ticket_count}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{Silian_tag.description || Silian_t('adminSupport.common.noDescription')}</p>
                </button>
              ))}
            </Silian_CardContent>
          </Silian_Card>

          <Silian_Card>
            <Silian_CardHeader>
              <Silian_CardTitle>{Silian_t('adminSupport.tags.editorTitle')}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('adminSupport.tags.editorSubtitle')}</Silian_CardDescription>
            </Silian_CardHeader>
            <Silian_CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{Silian_t('adminSupport.tags.fields.name')}</label>
                  <Silian_Input value={Silian_tagForm.name} onChange={(Silian_event) => Silian_setTagForm((Silian_current) => ({ ...Silian_current, name: Silian_event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{Silian_t('adminSupport.tags.fields.slug')}</label>
                  <Silian_Input value={Silian_tagForm.slug} onChange={(Silian_event) => Silian_setTagForm((Silian_current) => ({ ...Silian_current, slug: Silian_event.target.value }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{Silian_t('adminSupport.tags.fields.color')}</label>
                  <Silian_Select value={Silian_tagForm.color} onValueChange={(Silian_value) => Silian_setTagForm((Silian_current) => ({ ...Silian_current, color: Silian_value }))}>
                    <Silian_SelectTrigger><Silian_SelectValue /></Silian_SelectTrigger>
                    <Silian_SelectContent>
                      {Silian_TAG_COLOR_OPTIONS.map((Silian_color) => (
                        <Silian_SelectItem key={Silian_color} value={Silian_color}>{Silian_t(`adminSupport.colors.${Silian_color}`)}</Silian_SelectItem>
                      ))}
                    </Silian_SelectContent>
                  </Silian_Select>
                </div>
                <label className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
                  <span className="text-sm font-medium">{Silian_t('adminSupport.tags.fields.active')}</span>
                  <Silian_Switch checked={Silian_tagForm.is_active} onCheckedChange={(Silian_checked) => Silian_setTagForm((Silian_current) => ({ ...Silian_current, is_active: Silian_checked }))} />
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{Silian_t('adminSupport.tags.fields.description')}</label>
                <Silian_Textarea rows={3} value={Silian_tagForm.description} onChange={(Silian_event) => Silian_setTagForm((Silian_current) => ({ ...Silian_current, description: Silian_event.target.value }))} />
              </div>

              <Silian_Button className="rounded-full" onClick={Silian_handleTagSave} loading={Silian_saveTagMutation.isLoading}>
                <Silian_Save className="mr-2 h-4 w-4" />
                {Silian_t('adminSupport.actions.saveTag')}
              </Silian_Button>
            </Silian_CardContent>
          </Silian_Card>
        </Silian_TabsContent>

        <Silian_TabsContent value="reports" className="space-y-6">
          <Silian_Card>
            <Silian_CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <Silian_CardTitle>{Silian_t('adminSupport.reports.title')}</Silian_CardTitle>
                <Silian_CardDescription>{Silian_t('adminSupport.reports.subtitle')}</Silian_CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {Silian_DAY_OPTIONS.map((Silian_days) => (
                  <Silian_Button
                    key={Silian_days}
                    type="button"
                    variant={Silian_reportDays === Silian_days ? 'default' : 'outline'}
                    className="rounded-full"
                    onClick={() => Silian_setReportDays(Silian_days)}
                  >
                    {Silian_t('adminSupport.reports.days', { count: Silian_days })}
                  </Silian_Button>
                ))}
              </div>
            </Silian_CardHeader>
            <Silian_CardContent>
              {Silian_reportsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Silian_Loader2 className="h-4 w-4 animate-spin" />
                  {Silian_t('common.loading')}
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <Silian_BreakdownSection
                    title={Silian_t('adminSupport.reports.byStatus')}
                    description={Silian_t('adminSupport.reports.byStatusDescription')}
                    items={Silian_reports.by_status}
                    renderLabel={(Silian_item) => Silian_t(`support.statuses.${Silian_item.key}`)}
                  />
                  <Silian_BreakdownSection
                    title={Silian_t('adminSupport.reports.byCategory')}
                    description={Silian_t('adminSupport.reports.byCategoryDescription')}
                    items={Silian_reports.by_category}
                    renderLabel={(Silian_item) => Silian_t(`support.categories.${Silian_item.key}`)}
                  />
                  <Silian_BreakdownSection
                    title={Silian_t('adminSupport.reports.byPriority')}
                    description={Silian_t('adminSupport.reports.byPriorityDescription')}
                    items={Silian_reports.by_priority}
                    renderLabel={(Silian_item) => Silian_t(`support.priorities.${Silian_item.key}`)}
                  />
                  <Silian_BreakdownSection
                    title={Silian_t('adminSupport.reports.byAssignee')}
                    description={Silian_t('adminSupport.reports.byAssigneeDescription')}
                    items={Silian_reports.by_assignee}
                    renderLabel={(Silian_item) => Silian_item.label}
                  />
                  <Silian_BreakdownSection
                    title={Silian_t('adminSupport.reports.byAgentLevel')}
                    description={Silian_t('adminSupport.reports.byAgentLevelDescription')}
                    items={Silian_reports.by_agent_level}
                    renderLabel={(Silian_item) => Silian_t('adminSupport.reports.agentLevelLabel', { level: Silian_item.level })}
                  />
                  <Silian_BreakdownSection
                    title={Silian_t('adminSupport.reports.byTag')}
                    description={Silian_t('adminSupport.reports.byTagDescription')}
                    items={Silian_reports.by_tag}
                    renderLabel={(Silian_item) => <Silian_Badge variant="outline" className={Silian_getTagTone(Silian_item.color)}>{Silian_item.name}</Silian_Badge>}
                  />
                  <Silian_BreakdownSection
                    title={Silian_t('adminSupport.reports.ruleHits')}
                    description={Silian_t('adminSupport.reports.ruleHitsDescription')}
                    items={Silian_reports.rule_hits}
                    renderLabel={(Silian_item) => Silian_item.name}
                    renderMeta={(Silian_item) => Silian_item.trigger_count}
                  />
                  <Silian_BreakdownSection
                    title={Silian_t('adminSupport.reports.routingOutcomes')}
                    description={Silian_t('adminSupport.reports.routingOutcomesDescription')}
                    items={Silian_reports.routing_outcomes}
                    renderLabel={(Silian_item) => Silian_item.trigger}
                    renderMeta={(Silian_item) => `${Silian_item.count} · AI ${Silian_item.used_ai_count ?? 0}`}
                  />
                </div>
              )}
            </Silian_CardContent>
          </Silian_Card>

          <Silian_Card>
            <Silian_CardHeader>
              <Silian_CardTitle>{Silian_t('adminSupport.reports.timelineTitle')}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('adminSupport.reports.timelineSubtitle')}</Silian_CardDescription>
            </Silian_CardHeader>
            <Silian_CardContent className="space-y-3">
              {(Silian_reports.timeline ?? []).length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">--</p>}
              {(Silian_reports.timeline ?? []).map((Silian_entry) => {
                const Silian_maxCount = Math.max(1, ...(Silian_reports.timeline ?? []).map((Silian_item) => Number(Silian_item.count ?? 0)));
                return (
                  <div key={Silian_entry.date} className="space-y-2">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span>{Silian_entry.date}</span>
                      <span className="text-slate-500 dark:text-slate-400">{Silian_entry.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.max(8, Math.round((Number(Silian_entry.count ?? 0) / Silian_maxCount) * 100))}%` }} />
                    </div>
                  </div>
                );
              })}
            </Silian_CardContent>
          </Silian_Card>
        </Silian_TabsContent>
          </Silian_Tabs>
        </Silian_TabsContent>
      </Silian_Tabs>

      {(Silian_tagsQuery.isError || Silian_rulesQuery.isError || Silian_reportsQuery.isError || Silian_assigneesQuery.isError || Silian_routingSettingsQuery.isError) && (
        <Silian_Alert variant="destructive">
          <Silian_AlertDescription>{Silian_t('adminSupport.messages.loadFailed')}</Silian_AlertDescription>
        </Silian_Alert>
      )}
    </div>
  );
}

function Silian_hydrateTagForm(Silian_tag) {
  return {
    id: Silian_tag.id,
    name: Silian_tag.name ?? '',
    slug: Silian_tag.slug ?? '',
    color: Silian_tag.color ?? 'emerald',
    description: Silian_tag.description ?? '',
    is_active: Boolean(Silian_tag.is_active),
  };
}

function Silian_hydrateRuleForm(Silian_rule) {
  return {
    id: Silian_rule.id,
    name: Silian_rule.name ?? '',
    description: Silian_rule.description ?? '',
    is_active: Boolean(Silian_rule.is_active),
    sort_order: Silian_rule.sort_order ?? 0,
    match_category: Silian_rule.match_category ?? 'all',
    match_priority: Silian_rule.match_priority ?? 'all',
    match_weekdays: Array.isArray(Silian_rule.match_weekdays) ? Silian_rule.match_weekdays : [],
    match_time_start: Silian_rule.match_time_start ?? '',
    match_time_end: Silian_rule.match_time_end ?? '',
    timezone: Silian_rule.timezone ?? 'Asia/Shanghai',
    assign_to: Silian_rule.assign_to ? String(Silian_rule.assign_to) : 'none',
    score_boost: Silian_rule.score_boost ?? 0,
    required_agent_level: Silian_rule.required_agent_level ? String(Silian_rule.required_agent_level) : 'none',
    skill_hints: Array.isArray(Silian_rule.skill_hints) ? Silian_rule.skill_hints.join(', ') : '',
    tag_ids: Array.isArray(Silian_rule.tag_ids) ? Silian_rule.tag_ids : [],
  };
}
