import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import { BarChart3, CheckCircle2, Clock3, Loader2, Mail, Save, Shield, Ticket, UserRound, Wand2 } from 'lucide-react';

import { adminAPI } from '../../lib/api';
import { useTranslation } from '../../hooks/useTranslation';
import { TICKET_CATEGORY_OPTIONS, TICKET_PRIORITY_OPTIONS, formatSupportDate, getPriorityVariant, getSlaMeta, getSlaMilestoneMeta, getSlaTone, getStatusTone, getTagTone } from '../../lib/supportTickets';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Textarea } from '../../components/ui/textarea';
import { Badge } from '../../components/ui/badge';
import { Alert, AlertDescription } from '../../components/ui/Alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '../../components/ui/Tabs';
import { Checkbox } from '../../components/ui/checkbox';
import { Switch } from '../../components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

const DAY_OPTIONS = [14, 30, 60];
const WEEKDAY_OPTIONS = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
const TAG_COLOR_OPTIONS = ['emerald', 'sky', 'amber', 'rose', 'violet', 'slate'];

const EMPTY_TAG_FORM = {
  id: null,
  name: '',
  slug: '',
  color: 'emerald',
  description: '',
  is_active: true,
};

const EMPTY_RULE_FORM = {
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

const EMPTY_ROUTING_SETTINGS = {
  ai_enabled: true,
  ai_timeout_ms: 12000,
  due_soon_minutes: 30,
  weights: {},
  fallback: {},
  defaults: {},
};

function MetricCard({ icon, label, value, hint }) {
  const renderedIcon = React.createElement(icon, { className: 'h-5 w-5' });

  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500 dark:text-slate-400">{label}</p>
            <p className="mt-3 text-3xl font-semibold">{value}</p>
            {hint ? <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{hint}</p> : null}
          </div>
          <span className="flex h-11 w-11 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
            {renderedIcon}
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

function BreakdownSection({ title, description, items = [], renderLabel, renderMeta }) {
  const maxCount = Math.max(1, ...items.map((item) => Number(item.count ?? item.trigger_count ?? 0)));
  const totalCount = items.reduce((sum, item) => sum + Number(item.count ?? item.trigger_count ?? 0), 0);

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">--</p>}
        {items.map((item, index) => {
          const count = Number(item.count ?? item.trigger_count ?? 0);
          const width = `${Math.max(10, Math.round((count / maxCount) * 100))}%`;
          const share = totalCount > 0 ? `${Math.round((count / totalCount) * 100)}%` : '0%';
          return (
            <div key={`${title}-${index}`} className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 text-sm font-medium">{renderLabel(item)}</div>
                <div className="shrink-0 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  {renderMeta ? renderMeta(item) : `${count} · ${share}`}
                </div>
              </div>
              <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                <div className="h-2 rounded-full bg-emerald-500" style={{ width }} />
              </div>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}

function TicketQueueCard({ ticket, selected, onSelect, t, locale }) {
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
          <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">#{ticket.id}</p>
          <p className="mt-2 truncate font-medium">{ticket.subject}</p>
          <p className="mt-2 line-clamp-2 text-sm text-slate-500 dark:text-slate-400">{ticket.latest_message_preview || '--'}</p>
        </div>
        <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
          <Ticket className="h-4 w-4" />
        </span>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <Badge variant="outline" className={getStatusTone(ticket.status)}>{t(`support.statuses.${ticket.status}`)}</Badge>
        <Badge variant={getPriorityVariant(ticket.priority)}>{t(`support.priorities.${ticket.priority}`)}</Badge>
        {slaMeta.state ? <Badge variant="outline" className={getSlaTone(slaMeta.state)}>{t(`support.slaStatuses.${slaMeta.state}`, { defaultValue: slaMeta.state })}</Badge> : null}
      </div>

      <p className="mt-3 text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
        {formatSupportDate(ticket.last_replied_at || ticket.created_at, locale)} · {slaMeta.relativeLabel}
      </p>
    </button>
  );
}

function RoutingRunCard({ run, t, locale }) {
  const topCandidates = Array.isArray(run.candidate_scores) ? run.candidate_scores.slice(0, 5) : [];

  return (
    <div className="space-y-3 rounded-2xl border border-border px-4 py-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2">
          <Badge variant="outline">{run.trigger}</Badge>
          <Badge variant="outline">{run.used_ai ? t('adminSupport.tickets.usedAi') : t('adminSupport.tickets.fallbackOnly')}</Badge>
        </div>
        <span className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
          {formatSupportDate(run.created_at, locale)}
        </span>
      </div>

      <div className="grid gap-3 md:grid-cols-2 text-sm">
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('adminSupport.tickets.routingWinner')}</p>
          <p className="mt-2 font-medium">{run.summary?.winner_label || run.winner_user_id || '--'}</p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{t('adminSupport.tickets.winnerScore', { value: run.winner_score ?? '--' })}</p>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('adminSupport.tickets.routingDecision')}</p>
          <p className="mt-2 font-medium">{run.triage?.summary || '--'}</p>
          <p className="mt-1 text-slate-500 dark:text-slate-400">{run.fallback_reason || '--'}</p>
        </div>
      </div>

      {topCandidates.length > 0 ? (
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('adminSupport.tickets.candidateScores')}</p>
          <div className="space-y-2">
            {topCandidates.map((candidate, index) => (
              <div key={`${run.id}-${index}`} className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm dark:border-slate-700 dark:bg-slate-900">
                <span>{candidate.candidate?.username || `#${candidate.candidate?.id ?? '--'}`}</span>
                <span className="font-medium">{candidate.total_score}</span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export default function AdminSupportOpsPage() {
  const { t, currentLanguage } = useTranslation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('team');
  const [settingsTab, setSettingsTab] = useState('rules');
  const [reportDays, setReportDays] = useState(14);
  const [tagForm, setTagForm] = useState(EMPTY_TAG_FORM);
  const [ruleForm, setRuleForm] = useState(EMPTY_RULE_FORM);
  const [isTagDraft, setIsTagDraft] = useState(false);
  const [isRuleDraft, setIsRuleDraft] = useState(false);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState(null);
  const [selectedTicketId, setSelectedTicketId] = useState(null);
  const [ticketStatusFilter, setTicketStatusFilter] = useState('all');
  const [routingSettingsForm, setRoutingSettingsForm] = useState(EMPTY_ROUTING_SETTINGS);
  const [assigneeProfileForm, setAssigneeProfileForm] = useState(null);

  const assigneesQuery = useQuery(['admin-support-assignees'], async () => {
    const res = await adminAPI.getSupportAssignees();
    return res.data?.data ?? [];
  });

  const tagsQuery = useQuery(['admin-support-tags'], async () => {
    const res = await adminAPI.getSupportTags();
    return res.data?.data ?? [];
  });

  const rulesQuery = useQuery(['admin-support-rules'], async () => {
    const res = await adminAPI.getSupportRules();
    return res.data?.data ?? [];
  });

  const reportsQuery = useQuery(['admin-support-reports', reportDays], async () => {
    const res = await adminAPI.getSupportReports({ days: reportDays });
    return res.data?.data ?? {};
  });

  const ticketsQuery = useQuery(['admin-support-tickets', ticketStatusFilter], async () => {
    const res = await adminAPI.getSupportTickets({
      limit: 25,
      ...(ticketStatusFilter !== 'all' ? { status: ticketStatusFilter } : {}),
    });
    return res.data?.data ?? {};
  });

  const routingSettingsQuery = useQuery(['admin-support-routing-settings'], async () => {
    const res = await adminAPI.getSupportRoutingSettings();
    return res.data?.data ?? EMPTY_ROUTING_SETTINGS;
  });

  const assigneeDetailQuery = useQuery(
    ['admin-support-assignee-detail', selectedAssigneeId],
    async () => {
      const res = await adminAPI.getSupportAssigneeDetail(selectedAssigneeId);
      return res.data?.data ?? null;
    },
    {
      enabled: Boolean(selectedAssigneeId),
      refetchOnWindowFocus: false,
    }
  );

  const ticketDetailQuery = useQuery(
    ['admin-support-ticket-detail', selectedTicketId],
    async () => {
      const res = await adminAPI.getSupportTicketDetail(selectedTicketId);
      return res.data?.data ?? null;
    },
    {
      enabled: Boolean(selectedTicketId),
      refetchOnWindowFocus: false,
    }
  );

  const tags = useMemo(() => tagsQuery.data ?? [], [tagsQuery.data]);
  const rules = useMemo(() => rulesQuery.data ?? [], [rulesQuery.data]);
  const assignees = useMemo(() => assigneesQuery.data ?? [], [assigneesQuery.data]);
  const reports = reportsQuery.data ?? {};
  const assigneeDetail = assigneeDetailQuery.data;
  const tickets = useMemo(() => ticketsQuery.data?.items ?? [], [ticketsQuery.data]);
  const ticketDetail = ticketDetailQuery.data;

  const saveTagMutation = useMutation(
    async (payload) => {
      if (payload.id) {
        return adminAPI.updateSupportTag(payload.id, payload);
      }
      return adminAPI.createSupportTag(payload);
    },
    {
      onSuccess: () => {
        toast.success(t('adminSupport.messages.tagSaved'));
        queryClient.invalidateQueries(['admin-support-tags']);
        setTagForm(EMPTY_TAG_FORM);
        setIsTagDraft(false);
      },
      onError: (error) => {
        toast.error(error?.response?.data?.message || error?.message || t('errors.operationFailed'));
      },
    }
  );

  const saveRuleMutation = useMutation(
    async (payload) => {
      if (payload.id) {
        return adminAPI.updateSupportRule(payload.id, payload);
      }
      return adminAPI.createSupportRule(payload);
    },
    {
      onSuccess: () => {
        toast.success(t('adminSupport.messages.ruleSaved'));
        queryClient.invalidateQueries(['admin-support-rules']);
        queryClient.invalidateQueries(['admin-support-reports']);
        setRuleForm(EMPTY_RULE_FORM);
        setIsRuleDraft(false);
      },
      onError: (error) => {
        toast.error(error?.response?.data?.message || error?.message || t('errors.operationFailed'));
      },
    }
  );

  const saveRoutingSettingsMutation = useMutation(
    async (payload) => adminAPI.updateSupportRoutingSettings(payload),
    {
      onSuccess: () => {
        toast.success(t('adminSupport.messages.routingSettingsSaved'));
        queryClient.invalidateQueries(['admin-support-routing-settings']);
      },
      onError: (error) => {
        toast.error(error?.response?.data?.message || error?.message || t('errors.operationFailed'));
      },
    }
  );

  const saveRoutingProfileMutation = useMutation(
    async ({ id, payload }) => adminAPI.updateSupportAssigneeRoutingProfile(id, payload),
    {
      onSuccess: (_, variables) => {
        toast.success(t('adminSupport.messages.profileSaved'));
        queryClient.invalidateQueries(['admin-support-assignees']);
        queryClient.invalidateQueries(['admin-support-assignee-detail', variables.id]);
      },
      onError: (error) => {
        toast.error(error?.response?.data?.message || error?.message || t('errors.operationFailed'));
      },
    }
  );

  const summaryCards = useMemo(() => {
    const summary = reports.summary ?? {};
    return [
      {
        key: 'total',
        icon: BarChart3,
        label: t('adminSupport.summary.total'),
        value: summary.total ?? 0,
        hint: t('adminSupport.summary.totalHint'),
      },
      {
        key: 'smartAssigned',
        icon: Wand2,
        label: t('adminSupport.summary.smartAssigned'),
        value: summary.smart_assignment_count ?? 0,
        hint: t('adminSupport.summary.smartAssignedHint'),
      },
      {
        key: 'unassigned',
        icon: Clock3,
        label: t('adminSupport.summary.unassigned'),
        value: summary.unassigned ?? 0,
        hint: t('adminSupport.summary.unassignedHint'),
      },
      {
        key: 'slaBreaches',
        icon: CheckCircle2,
        label: t('adminSupport.summary.slaBreaches'),
        value: summary.sla_breach_count ?? 0,
        hint: t('adminSupport.summary.slaBreachesHint'),
      },
    ];
  }, [reports.summary, t]);

  useEffect(() => {
    if (!rules.length || ruleForm.id !== null || isRuleDraft) {
      return;
    }
    setRuleForm((current) => current.id === null ? hydrateRuleForm(rules[0]) : current);
  }, [rules, ruleForm.id, isRuleDraft]);

  useEffect(() => {
    if (!tags.length || tagForm.id !== null || isTagDraft) {
      return;
    }
    setTagForm((current) => current.id === null ? hydrateTagForm(tags[0]) : current);
  }, [tags, tagForm.id, isTagDraft]);

  useEffect(() => {
    if (!assignees.length) {
      return;
    }

    setSelectedAssigneeId((current) => {
      if (current && assignees.some((entry) => entry.id === current)) {
        return current;
      }
      return assignees[0].id;
    });
  }, [assignees]);

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

  useEffect(() => {
    if (routingSettingsQuery.data) {
      setRoutingSettingsForm(routingSettingsQuery.data);
    }
  }, [routingSettingsQuery.data]);

  useEffect(() => {
    if (assigneeDetail?.routing_profile) {
      setAssigneeProfileForm({
        level: assigneeDetail.routing_profile.level ?? 1,
        skills: Array.isArray(assigneeDetail.routing_profile.skills) ? assigneeDetail.routing_profile.skills.join(', ') : '',
        languages: Array.isArray(assigneeDetail.routing_profile.languages) ? assigneeDetail.routing_profile.languages.join(', ') : '',
        max_active_tickets: assigneeDetail.routing_profile.max_active_tickets ?? 10,
        is_auto_assignable: Boolean(assigneeDetail.routing_profile.is_auto_assignable),
        status: assigneeDetail.routing_profile.status ?? 'active',
        flat_boost: assigneeDetail.routing_profile.weight_overrides?.flat_boost ?? 0,
      });
    } else {
      setAssigneeProfileForm(null);
    }
  }, [assigneeDetail]);

  const handleTagSave = () => {
    saveTagMutation.mutate({
      id: tagForm.id,
      name: tagForm.name.trim(),
      slug: tagForm.slug.trim(),
      color: tagForm.color,
      description: tagForm.description.trim() || null,
      is_active: Boolean(tagForm.is_active),
    });
  };

  const handleRuleSave = () => {
    saveRuleMutation.mutate({
      id: ruleForm.id,
      name: ruleForm.name.trim(),
      description: ruleForm.description.trim() || null,
      is_active: Boolean(ruleForm.is_active),
      sort_order: Number(ruleForm.sort_order || 0),
      match_category: ruleForm.match_category === 'all' ? null : ruleForm.match_category,
      match_priority: ruleForm.match_priority === 'all' ? null : ruleForm.match_priority,
      match_weekdays: ruleForm.match_weekdays,
      match_time_start: ruleForm.match_time_start || null,
      match_time_end: ruleForm.match_time_end || null,
      timezone: ruleForm.timezone.trim() || 'Asia/Shanghai',
      assign_to: ruleForm.assign_to === 'none' ? null : Number(ruleForm.assign_to),
      score_boost: Number(ruleForm.score_boost || 0),
      required_agent_level: ruleForm.required_agent_level === 'none' ? null : Number(ruleForm.required_agent_level),
      skill_hints: ruleForm.skill_hints.split(',').map((item) => item.trim()).filter(Boolean),
      tag_ids: ruleForm.tag_ids,
    });
  };

  const handleRoutingSettingsSave = () => {
    saveRoutingSettingsMutation.mutate({
      ai_enabled: Boolean(routingSettingsForm.ai_enabled),
      ai_timeout_ms: Number(routingSettingsForm.ai_timeout_ms || 12000),
      due_soon_minutes: Number(routingSettingsForm.due_soon_minutes || 30),
      weights: routingSettingsForm.weights ?? {},
      fallback: routingSettingsForm.fallback ?? {},
      defaults: routingSettingsForm.defaults ?? {},
    });
  };

  const handleAssigneeProfileSave = () => {
    if (!selectedAssigneeId || !assigneeProfileForm) {
      return;
    }

    saveRoutingProfileMutation.mutate({
      id: selectedAssigneeId,
      payload: {
        level: Number(assigneeProfileForm.level || 1),
        skills: assigneeProfileForm.skills.split(',').map((item) => item.trim()).filter(Boolean),
        languages: assigneeProfileForm.languages.split(',').map((item) => item.trim()).filter(Boolean),
        max_active_tickets: Number(assigneeProfileForm.max_active_tickets || 10),
        is_auto_assignable: Boolean(assigneeProfileForm.is_auto_assignable),
        status: assigneeProfileForm.status,
        weight_overrides: {
          flat_boost: Number(assigneeProfileForm.flat_boost || 0),
        },
      },
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[1.8rem] border border-emerald-200 bg-emerald-50 px-6 py-6 dark:border-emerald-500/20 dark:bg-emerald-500/10">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300">
          {t('adminSupport.eyebrow')}
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">{t('adminSupport.title')}</h2>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <MetricCard key={card.key} icon={card.icon} label={card.label} value={card.value} hint={card.hint} />
        ))}
      </section>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="rounded-2xl border border-border bg-card p-1">
          <TabsTrigger value="team" className="rounded-xl border-r-0">{t('adminSupport.tabs.team')}</TabsTrigger>
          <TabsTrigger value="tickets" className="rounded-xl border-r-0">{t('adminSupport.tabs.tickets')}</TabsTrigger>
          <TabsTrigger value="settings" className="rounded-xl border-r-0">{t('adminSupport.tabs.settings')}</TabsTrigger>
        </TabsList>

        <TabsContent value="team" className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{t('adminSupport.team.listTitle')}</CardTitle>
              <CardDescription>{t('adminSupport.team.listSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {assigneesQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading')}</p>}
              {assignees.map((assignee) => (
                <button
                  key={assignee.id}
                  type="button"
                  onClick={() => setSelectedAssigneeId(assignee.id)}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${selectedAssigneeId === assignee.id ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-border bg-background hover:border-emerald-200 dark:hover:border-emerald-500/20'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-medium">{assignee.username || assignee.email || `#${assignee.id}`}</p>
                      <p className="mt-1 truncate text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                        {t(`adminSupport.roles.${assignee.role}`)}
                      </p>
                    </div>
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-200">
                      <UserRound className="h-4 w-4" />
                    </span>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-2xl border border-slate-200 bg-white px-2 py-3 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('adminSupport.team.metrics.assigned')}</p>
                      <p className="mt-2 text-lg font-semibold">{assignee.assigned_total_count ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-2 py-3 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('adminSupport.team.metrics.notStarted')}</p>
                      <p className="mt-2 text-lg font-semibold">{assignee.open_count ?? 0}</p>
                    </div>
                    <div className="rounded-2xl border border-slate-200 bg-white px-2 py-3 dark:border-slate-700 dark:bg-slate-900">
                      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('adminSupport.team.metrics.inProgress')}</p>
                      <p className="mt-2 text-lg font-semibold">{assignee.in_progress_count ?? 0}</p>
                    </div>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>{t('adminSupport.team.detailTitle')}</CardTitle>
                <CardDescription>{t('adminSupport.team.detailSubtitle')}</CardDescription>
              </CardHeader>
              <CardContent>
                {assigneeDetailQuery.isLoading ? (
                  <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('common.loading')}
                  </div>
                ) : !assigneeDetail ? (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('adminSupport.team.empty')}</p>
                ) : (
                  <div className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-3">
                      <MetricCard icon={UserRound} label={t('adminSupport.team.metrics.assigned')} value={assigneeDetail.assigned_total_count ?? 0} />
                      <MetricCard icon={Clock3} label={t('adminSupport.team.metrics.notStarted')} value={assigneeDetail.open_count ?? 0} />
                      <MetricCard icon={CheckCircle2} label={t('adminSupport.team.metrics.inProgress')} value={assigneeDetail.in_progress_count ?? 0} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <div className="rounded-2xl border border-border px-4 py-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Mail className="h-4 w-4" />
                          {t('adminSupport.team.contactTitle')}
                        </div>
                        <div className="mt-4 space-y-3 text-sm">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{t('adminSupport.team.fields.email')}</span>
                            <span className="truncate">{assigneeDetail.email || '--'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{t('adminSupport.team.fields.role')}</span>
                            <span>{t(`adminSupport.roles.${assigneeDetail.role}`)}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{t('adminSupport.team.fields.status')}</span>
                            <span>{assigneeDetail.status || '--'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="rounded-2xl border border-border px-4 py-4">
                        <div className="flex items-center gap-2 text-sm font-medium">
                          <Shield className="h-4 w-4" />
                          {t('adminSupport.team.profileTitle')}
                        </div>
                        <div className="mt-4 space-y-3 text-sm">
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{t('adminSupport.team.fields.school')}</span>
                            <span>{assigneeDetail.school || '--'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{t('adminSupport.team.fields.region')}</span>
                            <span>{assigneeDetail.region_code || '--'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{t('adminSupport.team.fields.location')}</span>
                            <span>{assigneeDetail.location || '--'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{t('adminSupport.team.fields.group')}</span>
                            <span>{assigneeDetail.group_id ?? '--'}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{t('adminSupport.team.fields.lastLogin')}</span>
                            <span>{formatSupportDate(assigneeDetail.last_login_at, currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}</span>
                          </div>
                          <div className="flex items-center justify-between gap-4">
                            <span className="text-slate-500 dark:text-slate-400">{t('adminSupport.team.fields.createdAt')}</span>
                            <span>{formatSupportDate(assigneeDetail.created_at, currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                      <div className="rounded-2xl border border-border px-4 py-4">
                        <p className="text-sm font-medium">{t('adminSupport.team.notesTitle')}</p>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-500 dark:text-slate-400">
                          {assigneeDetail.admin_notes || t('adminSupport.team.noNotes')}
                        </p>
                      </div>

                      <div className="rounded-2xl border border-border px-4 py-4">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-sm font-medium">{t('adminSupport.team.routingProfileTitle')}</p>
                          <Button className="rounded-full" size="sm" onClick={handleAssigneeProfileSave} loading={saveRoutingProfileMutation.isLoading}>
                            <Save className="mr-2 h-4 w-4" />
                            {t('adminSupport.actions.saveProfile')}
                          </Button>
                        </div>
                        {assigneeProfileForm ? (
                          <div className="mt-4 grid gap-4 md:grid-cols-2">
                            <div className="space-y-2">
                              <label className="text-sm font-medium">{t('adminSupport.team.routingFields.level')}</label>
                              <Input type="number" min="1" max="5" value={assigneeProfileForm.level} onChange={(event) => setAssigneeProfileForm((current) => ({ ...current, level: event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">{t('adminSupport.team.routingFields.maxActiveTickets')}</label>
                              <Input type="number" min="1" value={assigneeProfileForm.max_active_tickets} onChange={(event) => setAssigneeProfileForm((current) => ({ ...current, max_active_tickets: event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">{t('adminSupport.team.routingFields.skills')}</label>
                              <Input value={assigneeProfileForm.skills} onChange={(event) => setAssigneeProfileForm((current) => ({ ...current, skills: event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">{t('adminSupport.team.routingFields.languages')}</label>
                              <Input value={assigneeProfileForm.languages} onChange={(event) => setAssigneeProfileForm((current) => ({ ...current, languages: event.target.value }))} />
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">{t('adminSupport.team.routingFields.status')}</label>
                              <Select value={assigneeProfileForm.status} onValueChange={(value) => setAssigneeProfileForm((current) => ({ ...current, status: value }))}>
                                <SelectTrigger><SelectValue /></SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="active">{t('adminSupport.team.routingStatus.active')}</SelectItem>
                                  <SelectItem value="backup">{t('adminSupport.team.routingStatus.backup')}</SelectItem>
                                  <SelectItem value="offline">{t('adminSupport.team.routingStatus.offline')}</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-2">
                              <label className="text-sm font-medium">{t('adminSupport.team.routingFields.flatBoost')}</label>
                              <Input type="number" step="0.1" value={assigneeProfileForm.flat_boost} onChange={(event) => setAssigneeProfileForm((current) => ({ ...current, flat_boost: event.target.value }))} />
                            </div>
                            <label className="flex items-center justify-between rounded-2xl border border-border px-4 py-3 md:col-span-2">
                              <span className="text-sm font-medium">{t('adminSupport.team.routingFields.autoAssignable')}</span>
                              <Switch checked={assigneeProfileForm.is_auto_assignable} onCheckedChange={(checked) => setAssigneeProfileForm((current) => ({ ...current, is_auto_assignable: checked }))} />
                            </label>
                          </div>
                        ) : null}
                      </div>
                    </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>{t('adminSupport.team.recentTicketsTitle')}</CardTitle>
                <CardDescription>{t('adminSupport.team.recentTicketsSubtitle')}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {(assigneeDetail?.recent_tickets ?? []).length === 0 && (
                  <p className="text-sm text-slate-500 dark:text-slate-400">{t('adminSupport.team.noRecentTickets')}</p>
                )}
                {(assigneeDetail?.recent_tickets ?? []).map((ticket) => (
                  <Link
                    key={ticket.id}
                    to={`/support/tickets/${ticket.id}`}
                    className="block rounded-2xl border border-border px-4 py-4 transition hover:border-emerald-300 hover:bg-emerald-50/40 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <p className="font-medium">#{ticket.id} {ticket.subject}</p>
                        <p className="mt-1 text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                          {formatSupportDate(ticket.last_replied_at || ticket.updated_at || ticket.created_at, currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="outline" className={getStatusTone(ticket.status)}>{t(`support.statuses.${ticket.status}`)}</Badge>
                        <Badge variant={getPriorityVariant(ticket.priority)}>{t(`support.priorities.${ticket.priority}`)}</Badge>
                      </div>
                    </div>
                  </Link>
                ))}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="tickets" className="grid gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
          <Card>
            <CardHeader className="space-y-4">
              <div>
                <CardTitle>{t('adminSupport.tickets.listTitle')}</CardTitle>
                <CardDescription>{t('adminSupport.tickets.listSubtitle')}</CardDescription>
              </div>
              <Select value={ticketStatusFilter} onValueChange={setTicketStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{t('support.filters.allStatuses')}</SelectItem>
                  {['open', 'in_progress', 'waiting_user', 'resolved', 'closed'].map((statusValue) => (
                    <SelectItem key={statusValue} value={statusValue}>
                      {t(`support.statuses.${statusValue}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CardHeader>
            <CardContent className="space-y-3">
              {ticketsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('common.loading')}
                </div>
              ) : null}
              {ticketsQuery.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{t('adminSupport.messages.loadFailed')}</AlertDescription>
                </Alert>
              ) : null}
              {!ticketsQuery.isLoading && tickets.length === 0 ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('adminSupport.tickets.empty')}</p>
              ) : null}
              {tickets.map((ticket) => (
                <TicketQueueCard
                  key={ticket.id}
                  ticket={ticket}
                  selected={ticket.id === selectedTicketId}
                  onSelect={setSelectedTicketId}
                  t={t}
                  locale={currentLanguage === 'zh' ? 'zh-CN' : 'en-US'}
                />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('adminSupport.tickets.detailTitle')}</CardTitle>
              <CardDescription>{t('adminSupport.tickets.detailSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              {ticketDetailQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('common.loading')}
                </div>
              ) : ticketDetailQuery.error ? (
                <Alert variant="destructive">
                  <AlertDescription>{t('adminSupport.messages.loadFailed')}</AlertDescription>
                </Alert>
              ) : !ticketDetail ? (
                <p className="text-sm text-slate-500 dark:text-slate-400">{t('adminSupport.tickets.emptyDetail')}</p>
              ) : (
                (() => {
                  const locale = currentLanguage === 'zh' ? 'zh-CN' : 'en-US';
                  const slaMeta = getSlaMeta(ticketDetail, locale);
                  const firstResponseMeta = getSlaMilestoneMeta(ticketDetail, 'first_response', locale);
                  const resolutionMeta = getSlaMilestoneMeta(ticketDetail, 'resolution', locale);

                  return <div className="space-y-5">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="min-w-0">
                      <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">#{ticketDetail.id}</p>
                      <h3 className="mt-2 text-2xl font-semibold">{ticketDetail.subject}</h3>
                      <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{ticketDetail.latest_message_preview || '--'}</p>
                    </div>
                    <Link to={`/support/tickets/${ticketDetail.id}`} className="inline-flex items-center rounded-full border border-border px-4 py-2 text-sm font-medium hover:bg-muted">
                      {t('adminSupport.tickets.openInPortal')}
                    </Link>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <Badge variant="outline" className={getStatusTone(ticketDetail.status)}>{t(`support.statuses.${ticketDetail.status}`)}</Badge>
                    <Badge variant={getPriorityVariant(ticketDetail.priority)}>{t(`support.priorities.${ticketDetail.priority}`)}</Badge>
                    {slaMeta.state ? <Badge variant="outline" className={getSlaTone(slaMeta.state)}>{t(`support.slaStatuses.${slaMeta.state}`, { defaultValue: slaMeta.state })}</Badge> : null}
                    <Badge variant="outline">{t(`support.categories.${ticketDetail.category}`)}</Badge>
                  </div>

                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="rounded-2xl border border-border px-4 py-4 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('adminSupport.tickets.identityTitle')}</p>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500 dark:text-slate-400">{t('support.portal.requesterName')}</span>
                          <span>{ticketDetail.requester?.username || '--'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500 dark:text-slate-400">{t('support.portal.requesterEmail')}</span>
                          <span className="truncate">{ticketDetail.requester?.email || '--'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500 dark:text-slate-400">{t('support.portal.assignedTo')}</span>
                          <span>{ticketDetail.assigned_user?.username || t('support.portal.unassigned')}</span>
                        </div>
                      </div>
                    </div>
                    <div className="rounded-2xl border border-border px-4 py-4 text-sm">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('adminSupport.tickets.slaTitle')}</p>
                      <div className="mt-3 space-y-2">
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500 dark:text-slate-400">{t('support.portal.firstResponseDueLabel')}</span>
                          <div className="text-right">
                            <div>{firstResponseMeta.dueAtLabel}</div>
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{firstResponseMeta.relativeLabel}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500 dark:text-slate-400">{t('support.portal.resolutionDueLabel')}</span>
                          <div className="text-right">
                            <div>{resolutionMeta.dueAtLabel}</div>
                            <div className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{resolutionMeta.relativeLabel}</div>
                          </div>
                        </div>
                        <div className="flex items-center justify-between gap-4">
                          <span className="text-slate-500 dark:text-slate-400">{t('support.portal.assignmentSourceLabel')}</span>
                          <span>{ticketDetail.assignment_source || '--'}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {(ticketDetail.tags ?? []).length > 0 ? (
                    <div className="rounded-2xl border border-border px-4 py-4">
                      <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('support.portal.tagsTitle')}</p>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {(ticketDetail.tags ?? []).map((tag) => (
                          <Badge key={tag.id} variant="outline" className={getTagTone(tag.color)}>
                            {tag.name}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  ) : null}

                  <div className="space-y-3">
                    <p className="text-sm font-medium">{t('adminSupport.tickets.messagesTitle')}</p>
                    {(ticketDetail.messages ?? []).map((message) => (
                      <div key={message.id} className="rounded-2xl border border-border px-4 py-4">
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div>
                            <p className="font-medium">{message.sender_name || '--'}</p>
                            <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{t(`support.senderRoles.${message.sender_role}`)}</p>
                          </div>
                          <p className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">
                            {formatSupportDate(message.created_at, currentLanguage === 'zh' ? 'zh-CN' : 'en-US')}
                          </p>
                        </div>
                        <p className="mt-3 whitespace-pre-wrap text-sm leading-6 text-slate-600 dark:text-slate-300">{message.body}</p>
                        {(message.attachments ?? []).length > 0 ? (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {message.attachments.map((attachment) => (
                              <a
                                key={attachment.id}
                                href={attachment.download_url || attachment.file_path}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1 text-xs font-medium hover:bg-slate-50 dark:border-slate-700 dark:hover:bg-slate-900"
                              >
                                {attachment.original_name}
                              </a>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    ))}
                  </div>

                  <div className="rounded-2xl border border-border px-4 py-4">
                    <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">{t('adminSupport.tickets.routingSummaryTitle')}</p>
                    <div className="mt-3 grid gap-3 md:grid-cols-2 text-sm">
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                        <p className="font-medium">{t('adminSupport.tickets.topFactors')}</p>
                        <p className="mt-2 text-slate-500 dark:text-slate-400">{(ticketDetail.routing_summary?.top_factors || []).join(' / ') || '--'}</p>
                      </div>
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-700 dark:bg-slate-900">
                        <p className="font-medium">{t('adminSupport.tickets.routingFallbackLabel')}</p>
                        <p className="mt-2 text-slate-500 dark:text-slate-400">{ticketDetail.routing_summary?.fallback_reason || '--'}</p>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium">{t('adminSupport.tickets.routingRunsTitle')}</p>
                      <span className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{ticketDetail.routing_runs?.length ?? 0}</span>
                    </div>
                    {(ticketDetail.routing_runs ?? []).length === 0 ? (
                      <p className="text-sm text-slate-500 dark:text-slate-400">{t('adminSupport.tickets.noRoutingRuns')}</p>
                    ) : (
                      ticketDetail.routing_runs.map((run) => (
                        <RoutingRunCard key={run.id} run={run} t={t} locale={locale} />
                      ))
                    )}
                  </div>
                </div>;
                })()
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="settings" className="space-y-6">
          <Card>
            <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>{t('adminSupport.tabs.settings')}</CardTitle>
                <CardDescription>{t('adminSupport.reports.subtitle')}</CardDescription>
              </div>
              <Tabs value={settingsTab} onValueChange={setSettingsTab}>
                <TabsList className="rounded-2xl border border-border bg-card p-1">
                  <TabsTrigger value="routing" className="rounded-xl border-r-0">{t('adminSupport.tabs.routing')}</TabsTrigger>
                  <TabsTrigger value="rules" className="rounded-xl border-r-0">{t('adminSupport.tabs.rules')}</TabsTrigger>
                  <TabsTrigger value="tags" className="rounded-xl border-r-0">{t('adminSupport.tabs.tags')}</TabsTrigger>
                  <TabsTrigger value="reports" className="rounded-xl border-r-0">{t('adminSupport.tabs.reports')}</TabsTrigger>
                </TabsList>
              </Tabs>
            </CardHeader>
          </Card>

          <Tabs value={settingsTab} onValueChange={setSettingsTab} className="space-y-6">
        <TabsContent value="routing">
          <Card>
            <CardHeader>
              <CardTitle>{t('adminSupport.routing.title')}</CardTitle>
              <CardDescription>{t('adminSupport.routing.subtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adminSupport.routing.fields.aiTimeout')}</label>
                  <Input type="number" value={routingSettingsForm.ai_timeout_ms ?? 12000} onChange={(event) => setRoutingSettingsForm((current) => ({ ...current, ai_timeout_ms: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adminSupport.routing.fields.dueSoonMinutes')}</label>
                  <Input type="number" value={routingSettingsForm.due_soon_minutes ?? 30} onChange={(event) => setRoutingSettingsForm((current) => ({ ...current, due_soon_minutes: event.target.value }))} />
                </div>
                <label className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
                  <span className="text-sm font-medium">{t('adminSupport.routing.fields.aiEnabled')}</span>
                  <Switch checked={Boolean(routingSettingsForm.ai_enabled)} onCheckedChange={(checked) => setRoutingSettingsForm((current) => ({ ...current, ai_enabled: checked }))} />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adminSupport.routing.fields.defaultFirstResponse')}</label>
                  <Input type="number" value={routingSettingsForm.defaults?.first_response_minutes ?? 240} onChange={(event) => setRoutingSettingsForm((current) => ({ ...current, defaults: { ...current.defaults, first_response_minutes: Number(event.target.value) } }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adminSupport.routing.fields.defaultResolution')}</label>
                  <Input type="number" value={routingSettingsForm.defaults?.resolution_minutes ?? 1440} onChange={(event) => setRoutingSettingsForm((current) => ({ ...current, defaults: { ...current.defaults, resolution_minutes: Number(event.target.value) } }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {Object.entries(routingSettingsForm.weights ?? {}).map(([key, value]) => (
                  <div key={key} className="space-y-2">
                    <label className="text-sm font-medium">{t(`adminSupport.routing.weights.${key}`, key)}</label>
                    <Input type="number" step="0.1" value={value} onChange={(event) => setRoutingSettingsForm((current) => ({ ...current, weights: { ...current.weights, [key]: Number(event.target.value) } }))} />
                  </div>
                ))}
              </div>

              <Button className="rounded-full" onClick={handleRoutingSettingsSave} loading={saveRoutingSettingsMutation.isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {t('adminSupport.actions.saveRoutingSettings')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="rules" className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{t('adminSupport.rules.listTitle')}</CardTitle>
              <CardDescription>{t('adminSupport.rules.listSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full rounded-full"
                onClick={() => {
                  setIsRuleDraft(true);
                  setRuleForm(EMPTY_RULE_FORM);
                }}
              >
                {t('adminSupport.rules.newRule')}
              </Button>
              {rulesQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading')}</p>}
              {rules.map((rule) => (
                <button
                  key={rule.id}
                  type="button"
                  onClick={() => {
                    setIsRuleDraft(false);
                    setRuleForm(hydrateRuleForm(rule));
                  }}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${ruleForm.id === rule.id ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-border bg-background hover:border-emerald-200 dark:hover:border-emerald-500/20'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <p className="font-medium">{rule.name}</p>
                    <Badge variant="outline" className={rule.is_active ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200' : 'border-slate-200 bg-slate-100 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200'}>
                      {rule.is_active ? t('adminSupport.common.active') : t('adminSupport.common.inactive')}
                    </Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{rule.description || t('adminSupport.common.noDescription')}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {rule.match_category ? <Badge variant="outline">{t(`support.categories.${rule.match_category}`)}</Badge> : null}
                    {rule.match_priority ? <Badge variant="outline">{t(`support.priorities.${rule.match_priority}`)}</Badge> : null}
                    {rule.assign_user?.username ? <Badge variant="outline">{rule.assign_user.username}</Badge> : null}
                    <Badge variant="outline">{t('adminSupport.rules.scoreBoostBadge', { value: rule.score_boost ?? 0 })}</Badge>
                  </div>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('adminSupport.rules.editorTitle')}</CardTitle>
              <CardDescription>{t('adminSupport.rules.editorSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adminSupport.rules.fields.name')}</label>
                  <Input value={ruleForm.name} onChange={(event) => setRuleForm((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adminSupport.rules.fields.sortOrder')}</label>
                  <Input type="number" value={ruleForm.sort_order} onChange={(event) => setRuleForm((current) => ({ ...current, sort_order: event.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('adminSupport.rules.fields.description')}</label>
                <Textarea rows={3} value={ruleForm.description} onChange={(event) => setRuleForm((current) => ({ ...current, description: event.target.value }))} />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adminSupport.rules.fields.category')}</label>
                  <Select value={ruleForm.match_category} onValueChange={(value) => setRuleForm((current) => ({ ...current, match_category: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('adminSupport.filters.anyCategory')}</SelectItem>
                      {TICKET_CATEGORY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{t(option.labelKey)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adminSupport.rules.fields.priority')}</label>
                  <Select value={ruleForm.match_priority} onValueChange={(value) => setRuleForm((current) => ({ ...current, match_priority: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{t('adminSupport.filters.anyPriority')}</SelectItem>
                      {TICKET_PRIORITY_OPTIONS.map((option) => (
                        <SelectItem key={option.value} value={option.value}>{t(option.labelKey)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adminSupport.rules.fields.timeStart')}</label>
                  <Input type="time" value={ruleForm.match_time_start} onChange={(event) => setRuleForm((current) => ({ ...current, match_time_start: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adminSupport.rules.fields.timeEnd')}</label>
                  <Input type="time" value={ruleForm.match_time_end} onChange={(event) => setRuleForm((current) => ({ ...current, match_time_end: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adminSupport.rules.fields.timezone')}</label>
                  <Input value={ruleForm.timezone} onChange={(event) => setRuleForm((current) => ({ ...current, timezone: event.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('adminSupport.rules.fields.weekdays')}</label>
                <div className="flex flex-wrap gap-3 rounded-2xl border border-border px-4 py-3">
                  {WEEKDAY_OPTIONS.map((day) => (
                    <label key={day} className="inline-flex items-center gap-2 text-sm">
                      <Checkbox
                        checked={ruleForm.match_weekdays.includes(day)}
                        onCheckedChange={(checked) => setRuleForm((current) => ({
                          ...current,
                          match_weekdays: checked
                            ? [...current.match_weekdays, day]
                            : current.match_weekdays.filter((entry) => entry !== day),
                        }))}
                      />
                      {t(`adminSupport.weekdays.${day}`)}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('adminSupport.rules.fields.assignTo')}</label>
                <Select value={ruleForm.assign_to} onValueChange={(value) => setRuleForm((current) => ({ ...current, assign_to: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('adminSupport.rules.noAssignee')}</SelectItem>
                      {assignees.map((assignee) => (
                        <SelectItem key={assignee.id} value={String(assignee.id)}>
                          {(assignee.username || assignee.email)} ({t(`adminSupport.roles.${assignee.role}`)}) · {t('adminSupport.team.metrics.assigned')} {assignee.assigned_total_count ?? 0}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

              <div className="grid gap-4 md:grid-cols-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adminSupport.rules.fields.scoreBoost')}</label>
                  <Input type="number" step="0.1" value={ruleForm.score_boost} onChange={(event) => setRuleForm((current) => ({ ...current, score_boost: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adminSupport.rules.fields.requiredAgentLevel')}</label>
                  <Select value={ruleForm.required_agent_level} onValueChange={(value) => setRuleForm((current) => ({ ...current, required_agent_level: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">{t('adminSupport.rules.noRequiredLevel')}</SelectItem>
                      {[1, 2, 3, 4, 5].map((level) => (
                        <SelectItem key={level} value={String(level)}>{t('adminSupport.rules.requiredLevelLabel', { level })}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adminSupport.rules.fields.skillHints')}</label>
                  <Input value={ruleForm.skill_hints} onChange={(event) => setRuleForm((current) => ({ ...current, skill_hints: event.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('adminSupport.rules.fields.tags')}</label>
                <div className="grid gap-3 rounded-2xl border border-border px-4 py-3 md:grid-cols-2">
                  {tags.length === 0 && (
                    <p className="text-sm text-slate-500 dark:text-slate-400">{t('adminSupport.rules.noTags')}</p>
                  )}
                  {tags.map((tag) => (
                    <label key={tag.id} className="inline-flex items-center gap-3 text-sm">
                      <Checkbox
                        checked={ruleForm.tag_ids.includes(tag.id)}
                        onCheckedChange={(checked) => setRuleForm((current) => ({
                          ...current,
                          tag_ids: checked
                            ? [...current.tag_ids, tag.id]
                            : current.tag_ids.filter((entry) => entry !== tag.id),
                        }))}
                      />
                      <Badge variant="outline" className={getTagTone(tag.color)}>{tag.name}</Badge>
                    </label>
                  ))}
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
                  <span className="text-sm font-medium">{t('adminSupport.rules.fields.active')}</span>
                  <Switch checked={ruleForm.is_active} onCheckedChange={(checked) => setRuleForm((current) => ({ ...current, is_active: checked }))} />
                </label>
              </div>

              <Button className="rounded-full" onClick={handleRuleSave} loading={saveRuleMutation.isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {t('adminSupport.actions.saveRule')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="tags" className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{t('adminSupport.tags.listTitle')}</CardTitle>
              <CardDescription>{t('adminSupport.tags.listSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button
                variant="outline"
                className="w-full rounded-full"
                onClick={() => {
                  setIsTagDraft(true);
                  setTagForm(EMPTY_TAG_FORM);
                }}
              >
                {t('adminSupport.tags.newTag')}
              </Button>
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => {
                    setIsTagDraft(false);
                    setTagForm(hydrateTagForm(tag));
                  }}
                  className={`w-full rounded-2xl border px-4 py-4 text-left transition ${tagForm.id === tag.id ? 'border-emerald-300 bg-emerald-50 dark:border-emerald-500/30 dark:bg-emerald-500/10' : 'border-border bg-background hover:border-emerald-200 dark:hover:border-emerald-500/20'}`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <Badge variant="outline" className={getTagTone(tag.color)}>{tag.name}</Badge>
                    <span className="text-xs uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{tag.ticket_count}</span>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{tag.description || t('adminSupport.common.noDescription')}</p>
                </button>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('adminSupport.tags.editorTitle')}</CardTitle>
              <CardDescription>{t('adminSupport.tags.editorSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adminSupport.tags.fields.name')}</label>
                  <Input value={tagForm.name} onChange={(event) => setTagForm((current) => ({ ...current, name: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adminSupport.tags.fields.slug')}</label>
                  <Input value={tagForm.slug} onChange={(event) => setTagForm((current) => ({ ...current, slug: event.target.value }))} />
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-medium">{t('adminSupport.tags.fields.color')}</label>
                  <Select value={tagForm.color} onValueChange={(value) => setTagForm((current) => ({ ...current, color: value }))}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {TAG_COLOR_OPTIONS.map((color) => (
                        <SelectItem key={color} value={color}>{t(`adminSupport.colors.${color}`)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <label className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
                  <span className="text-sm font-medium">{t('adminSupport.tags.fields.active')}</span>
                  <Switch checked={tagForm.is_active} onCheckedChange={(checked) => setTagForm((current) => ({ ...current, is_active: checked }))} />
                </label>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium">{t('adminSupport.tags.fields.description')}</label>
                <Textarea rows={3} value={tagForm.description} onChange={(event) => setTagForm((current) => ({ ...current, description: event.target.value }))} />
              </div>

              <Button className="rounded-full" onClick={handleTagSave} loading={saveTagMutation.isLoading}>
                <Save className="mr-2 h-4 w-4" />
                {t('adminSupport.actions.saveTag')}
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="reports" className="space-y-6">
          <Card>
            <CardHeader className="gap-4 lg:flex-row lg:items-center lg:justify-between">
              <div>
                <CardTitle>{t('adminSupport.reports.title')}</CardTitle>
                <CardDescription>{t('adminSupport.reports.subtitle')}</CardDescription>
              </div>
              <div className="flex flex-wrap gap-2">
                {DAY_OPTIONS.map((days) => (
                  <Button
                    key={days}
                    type="button"
                    variant={reportDays === days ? 'default' : 'outline'}
                    className="rounded-full"
                    onClick={() => setReportDays(days)}
                  >
                    {t('adminSupport.reports.days', { count: days })}
                  </Button>
                ))}
              </div>
            </CardHeader>
            <CardContent>
              {reportsQuery.isLoading ? (
                <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  {t('common.loading')}
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  <BreakdownSection
                    title={t('adminSupport.reports.byStatus')}
                    description={t('adminSupport.reports.byStatusDescription')}
                    items={reports.by_status}
                    renderLabel={(item) => t(`support.statuses.${item.key}`)}
                  />
                  <BreakdownSection
                    title={t('adminSupport.reports.byCategory')}
                    description={t('adminSupport.reports.byCategoryDescription')}
                    items={reports.by_category}
                    renderLabel={(item) => t(`support.categories.${item.key}`)}
                  />
                  <BreakdownSection
                    title={t('adminSupport.reports.byPriority')}
                    description={t('adminSupport.reports.byPriorityDescription')}
                    items={reports.by_priority}
                    renderLabel={(item) => t(`support.priorities.${item.key}`)}
                  />
                  <BreakdownSection
                    title={t('adminSupport.reports.byAssignee')}
                    description={t('adminSupport.reports.byAssigneeDescription')}
                    items={reports.by_assignee}
                    renderLabel={(item) => item.label}
                  />
                  <BreakdownSection
                    title={t('adminSupport.reports.byAgentLevel')}
                    description={t('adminSupport.reports.byAgentLevelDescription')}
                    items={reports.by_agent_level}
                    renderLabel={(item) => t('adminSupport.reports.agentLevelLabel', { level: item.level })}
                  />
                  <BreakdownSection
                    title={t('adminSupport.reports.byTag')}
                    description={t('adminSupport.reports.byTagDescription')}
                    items={reports.by_tag}
                    renderLabel={(item) => <Badge variant="outline" className={getTagTone(item.color)}>{item.name}</Badge>}
                  />
                  <BreakdownSection
                    title={t('adminSupport.reports.ruleHits')}
                    description={t('adminSupport.reports.ruleHitsDescription')}
                    items={reports.rule_hits}
                    renderLabel={(item) => item.name}
                    renderMeta={(item) => item.trigger_count}
                  />
                  <BreakdownSection
                    title={t('adminSupport.reports.routingOutcomes')}
                    description={t('adminSupport.reports.routingOutcomesDescription')}
                    items={reports.routing_outcomes}
                    renderLabel={(item) => item.trigger}
                    renderMeta={(item) => `${item.count} · AI ${item.used_ai_count ?? 0}`}
                  />
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t('adminSupport.reports.timelineTitle')}</CardTitle>
              <CardDescription>{t('adminSupport.reports.timelineSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(reports.timeline ?? []).length === 0 && <p className="text-sm text-slate-500 dark:text-slate-400">--</p>}
              {(reports.timeline ?? []).map((entry) => {
                const maxCount = Math.max(1, ...(reports.timeline ?? []).map((item) => Number(item.count ?? 0)));
                return (
                  <div key={entry.date} className="space-y-2">
                    <div className="flex items-center justify-between gap-4 text-sm">
                      <span>{entry.date}</span>
                      <span className="text-slate-500 dark:text-slate-400">{entry.count}</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-100 dark:bg-slate-800">
                      <div className="h-2 rounded-full bg-emerald-500" style={{ width: `${Math.max(8, Math.round((Number(entry.count ?? 0) / maxCount) * 100))}%` }} />
                    </div>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        </TabsContent>
          </Tabs>
        </TabsContent>
      </Tabs>

      {(tagsQuery.isError || rulesQuery.isError || reportsQuery.isError || assigneesQuery.isError || routingSettingsQuery.isError) && (
        <Alert variant="destructive">
          <AlertDescription>{t('adminSupport.messages.loadFailed')}</AlertDescription>
        </Alert>
      )}
    </div>
  );
}

function hydrateTagForm(tag) {
  return {
    id: tag.id,
    name: tag.name ?? '',
    slug: tag.slug ?? '',
    color: tag.color ?? 'emerald',
    description: tag.description ?? '',
    is_active: Boolean(tag.is_active),
  };
}

function hydrateRuleForm(rule) {
  return {
    id: rule.id,
    name: rule.name ?? '',
    description: rule.description ?? '',
    is_active: Boolean(rule.is_active),
    sort_order: rule.sort_order ?? 0,
    match_category: rule.match_category ?? 'all',
    match_priority: rule.match_priority ?? 'all',
    match_weekdays: Array.isArray(rule.match_weekdays) ? rule.match_weekdays : [],
    match_time_start: rule.match_time_start ?? '',
    match_time_end: rule.match_time_end ?? '',
    timezone: rule.timezone ?? 'Asia/Shanghai',
    assign_to: rule.assign_to ? String(rule.assign_to) : 'none',
    score_boost: rule.score_boost ?? 0,
    required_agent_level: rule.required_agent_level ? String(rule.required_agent_level) : 'none',
    skill_hints: Array.isArray(rule.skill_hints) ? rule.skill_hints.join(', ') : '',
    tag_ids: Array.isArray(rule.tag_ids) ? rule.tag_ids : [],
  };
}
