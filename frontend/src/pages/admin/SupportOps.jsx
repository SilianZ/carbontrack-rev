import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import { BarChart3, CheckCircle2, Clock3, Loader2, Mail, Save, Shield, UserRound, Wand2 } from 'lucide-react';

import { adminAPI } from '../../lib/api';
import { useTranslation } from '../../hooks/useTranslation';
import { TICKET_CATEGORY_OPTIONS, TICKET_PRIORITY_OPTIONS, formatSupportDate, getPriorityVariant, getStatusTone, getTagTone } from '../../lib/supportTickets';
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
  tag_ids: [],
  stop_processing: true,
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
          return (
            <div key={`${title}-${index}`} className="space-y-2">
              <div className="flex items-center justify-between gap-4">
                <div className="min-w-0 text-sm font-medium">{renderLabel(item)}</div>
                <div className="shrink-0 text-xs uppercase tracking-[0.2em] text-slate-500 dark:text-slate-400">
                  {renderMeta ? renderMeta(item) : count}
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

export default function AdminSupportOpsPage() {
  const { t, currentLanguage } = useTranslation();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState('team');
  const [reportDays, setReportDays] = useState(14);
  const [tagForm, setTagForm] = useState(EMPTY_TAG_FORM);
  const [ruleForm, setRuleForm] = useState(EMPTY_RULE_FORM);
  const [selectedAssigneeId, setSelectedAssigneeId] = useState(null);

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

  const tags = tagsQuery.data ?? [];
  const rules = rulesQuery.data ?? [];
  const assignees = assigneesQuery.data ?? [];
  const reports = reportsQuery.data ?? {};
  const assigneeDetail = assigneeDetailQuery.data;

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
        key: 'autoAssigned',
        icon: Wand2,
        label: t('adminSupport.summary.autoAssigned'),
        value: summary.auto_assigned ?? 0,
        hint: t('adminSupport.summary.autoAssignedHint'),
      },
      {
        key: 'unassigned',
        icon: Clock3,
        label: t('adminSupport.summary.unassigned'),
        value: summary.unassigned ?? 0,
        hint: t('adminSupport.summary.unassignedHint'),
      },
      {
        key: 'avgResolution',
        icon: CheckCircle2,
        label: t('adminSupport.summary.avgResolution'),
        value: summary.avg_resolution_hours ?? '--',
        hint: t('adminSupport.summary.avgResolutionHint'),
      },
    ];
  }, [reports.summary, t]);

  useEffect(() => {
    if (!rules.length || ruleForm.id !== null) {
      return;
    }
    setRuleForm((current) => current.id === null ? hydrateRuleForm(rules[0]) : current);
  }, [rules, ruleForm.id]);

  useEffect(() => {
    if (!tags.length || tagForm.id !== null) {
      return;
    }
    setTagForm((current) => current.id === null ? hydrateTagForm(tags[0]) : current);
  }, [tags, tagForm.id]);

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
      tag_ids: ruleForm.tag_ids,
      stop_processing: Boolean(ruleForm.stop_processing),
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[1.8rem] border border-emerald-200 bg-emerald-50 px-6 py-6 dark:border-emerald-500/20 dark:bg-emerald-500/10">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-700 dark:text-emerald-300">
          {t('adminSupport.eyebrow')}
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight">{t('adminSupport.title')}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-emerald-900/70 dark:text-emerald-100/80">
          {t('adminSupport.subtitle')}
        </p>
      </section>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <MetricCard key={card.key} icon={card.icon} label={card.label} value={card.value} hint={card.hint} />
        ))}
      </section>

      <Tabs value={tab} onValueChange={setTab} className="space-y-6">
        <TabsList className="rounded-2xl border border-border bg-card p-1">
          <TabsTrigger value="team" className="rounded-xl border-r-0">{t('adminSupport.tabs.team')}</TabsTrigger>
          <TabsTrigger value="rules" className="rounded-xl border-r-0">{t('adminSupport.tabs.rules')}</TabsTrigger>
          <TabsTrigger value="tags" className="rounded-xl border-r-0">{t('adminSupport.tabs.tags')}</TabsTrigger>
          <TabsTrigger value="reports" className="rounded-xl border-r-0">{t('adminSupport.tabs.reports')}</TabsTrigger>
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

        <TabsContent value="rules" className="grid gap-6 xl:grid-cols-[340px_minmax(0,1fr)]">
          <Card>
            <CardHeader>
              <CardTitle>{t('adminSupport.rules.listTitle')}</CardTitle>
              <CardDescription>{t('adminSupport.rules.listSubtitle')}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full rounded-full" onClick={() => setRuleForm(EMPTY_RULE_FORM)}>
                {t('adminSupport.rules.newRule')}
              </Button>
              {rulesQuery.isLoading && <p className="text-sm text-slate-500 dark:text-slate-400">{t('common.loading')}</p>}
              {rules.map((rule) => (
                <button
                  key={rule.id}
                  type="button"
                  onClick={() => setRuleForm(hydrateRuleForm(rule))}
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
                <label className="flex items-center justify-between rounded-2xl border border-border px-4 py-3">
                  <span className="text-sm font-medium">{t('adminSupport.rules.fields.stopProcessing')}</span>
                  <Switch checked={ruleForm.stop_processing} onCheckedChange={(checked) => setRuleForm((current) => ({ ...current, stop_processing: checked }))} />
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
              <Button variant="outline" className="w-full rounded-full" onClick={() => setTagForm(EMPTY_TAG_FORM)}>
                {t('adminSupport.tags.newTag')}
              </Button>
              {tags.map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  onClick={() => setTagForm(hydrateTagForm(tag))}
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

      {(tagsQuery.isError || rulesQuery.isError || reportsQuery.isError || assigneesQuery.isError) && (
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
    tag_ids: Array.isArray(rule.tag_ids) ? rule.tag_ids : [],
    stop_processing: Boolean(rule.stop_processing),
  };
}
