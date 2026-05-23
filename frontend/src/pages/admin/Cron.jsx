import Silian_React, { useEffect as Silian_useEffect, useMemo as Silian_useMemo, useState as Silian_useState } from 'react';
import { useMutation as Silian_useMutation, useQuery as Silian_useQuery, useQueryClient as Silian_useQueryClient } from 'react-query';
import { toast as Silian_toast } from 'react-hot-toast';
import { Loader2 as Silian_Loader2, Play as Silian_Play, RefreshCw as Silian_RefreshCw } from 'lucide-react';

import { adminAPI as Silian_adminAPI } from '../../lib/api';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../../components/ui/Card';
import { Button as Silian_Button } from '../../components/ui/Button';
import { Badge as Silian_Badge } from '../../components/ui/badge';
import { Switch as Silian_Switch } from '../../components/ui/switch';
import { Input as Silian_Input } from '../../components/ui/Input';
import {
  Select as Silian_Select,
  SelectContent as Silian_SelectContent,
  SelectItem as Silian_SelectItem,
  SelectTrigger as Silian_SelectTrigger,
  SelectValue as Silian_SelectValue,
} from '../../components/ui/select';

function Silian_formatDateTime(Silian_value, Silian_locale) {
  if (!Silian_value) {
    return '--';
  }

  const Silian_normalized = typeof Silian_value === 'string' && Silian_value.includes(' ') ? Silian_value.replace(' ', 'T') : Silian_value;
  const Silian_parsed = new Date(Silian_normalized);
  if (Number.isNaN(Silian_parsed.getTime())) {
    return Silian_value;
  }

  return new Intl.DateTimeFormat(Silian_locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(Silian_parsed);
}

function Silian_taskStatusTone(Silian_status) {
  switch (Silian_status) {
    case 'success':
      return 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-200';
    case 'failed':
      return 'border-rose-200 bg-rose-50 text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200';
    case 'running':
      return 'border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/30 dark:bg-sky-500/10 dark:text-sky-200';
    default:
      return 'border-slate-200 bg-slate-50 text-slate-700 dark:border-slate-500/30 dark:bg-slate-500/10 dark:text-slate-200';
  }
}

function Silian_translateCronStatus(Silian_t, Silian_status) {
  if (Silian_status === 'idle' || Silian_status === 'running' || Silian_status === 'success' || Silian_status === 'failed' || Silian_status === 'skipped') {
    return Silian_t(`admin.cron.status.${Silian_status}`);
  }

  return Silian_status || 'idle';
}

function Silian_translateTriggerSource(Silian_t, Silian_triggerSource) {
  if (Silian_triggerSource === 'cron_endpoint' || Silian_triggerSource === 'legacy_endpoint' || Silian_triggerSource === 'admin_manual') {
    return Silian_t(`admin.cron.triggerSources.${Silian_triggerSource}`);
  }

  return Silian_triggerSource || '--';
}

export default function AdminCronPage() {
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['admin', 'common', 'errors']);
  const Silian_locale = Silian_currentLanguage === 'zh' ? 'zh-CN' : 'en-US';
  const Silian_queryClient = Silian_useQueryClient();
  const [Silian_taskFilter, Silian_setTaskFilter] = Silian_useState('all');
  const [Silian_statusFilter, Silian_setStatusFilter] = Silian_useState('all');
  const [Silian_drafts, Silian_setDrafts] = Silian_useState({});
  const [Silian_dirtyTaskKeys, Silian_setDirtyTaskKeys] = Silian_useState({});

  const Silian_tasksQuery = Silian_useQuery(['admin-cron-tasks'], async () => {
    const Silian_response = await Silian_adminAPI.getCronTasks();
    return Silian_response.data?.data ?? [];
  });

  const Silian_runsQuery = Silian_useQuery(['admin-cron-runs', Silian_taskFilter, Silian_statusFilter], async () => {
    const Silian_params = {
      limit: 20,
      ...(Silian_taskFilter !== 'all' ? { task_key: Silian_taskFilter } : {}),
      ...(Silian_statusFilter !== 'all' ? { status: Silian_statusFilter } : {}),
    };
    const Silian_response = await Silian_adminAPI.getCronRuns(Silian_params);
    return Silian_response.data?.data ?? { items: [], pagination: { page: 1, limit: 20, total: 0 } };
  });

  const Silian_tasks = Silian_useMemo(() => Silian_tasksQuery.data ?? [], [Silian_tasksQuery.data]);
  const Silian_runs = Silian_useMemo(() => Silian_runsQuery.data?.items ?? [], [Silian_runsQuery.data]);

  const Silian_saveTaskMutation = Silian_useMutation(
    ({ taskKey: Silian_taskKey, payload: Silian_payload }) => Silian_adminAPI.updateCronTask(Silian_taskKey, Silian_payload),
    {
      onSuccess: (Silian__, Silian_variables) => {
        Silian_setDirtyTaskKeys((Silian_current) => {
          const Silian_next = { ...Silian_current };
          delete Silian_next[Silian_variables.taskKey];
          return Silian_next;
        });
        Silian_toast.success(Silian_t('admin.cron.messages.saved'));
        Silian_queryClient.invalidateQueries(['admin-cron-tasks']);
      },
      onError: (Silian_error) => {
        Silian_toast.error(Silian_error?.response?.data?.message || Silian_error?.message || Silian_t('errors.operationFailed'));
      },
    }
  );

  const Silian_runTaskMutation = Silian_useMutation(
    (Silian_taskKey) => Silian_adminAPI.runCronTask(Silian_taskKey),
    {
      onSuccess: () => {
        Silian_toast.success(Silian_t('admin.cron.messages.executed'));
      },
      onError: (Silian_error) => {
        Silian_toast.error(Silian_error?.response?.data?.message || Silian_error?.message || Silian_t('errors.operationFailed'));
      },
      onSettled: () => {
        Silian_queryClient.invalidateQueries(['admin-cron-tasks']);
        Silian_queryClient.invalidateQueries(['admin-cron-runs']);
      },
    }
  );

  Silian_useEffect(() => {
    if (!Silian_tasks.length) {
      return;
    }

    const Silian_activeSaveTaskKey = Silian_saveTaskMutation.isLoading ? (Silian_saveTaskMutation.variables?.taskKey ?? null) : null;
    const Silian_activeRunTaskKey = Silian_runTaskMutation.isLoading ? (Silian_runTaskMutation.variables ?? null) : null;

    Silian_setDrafts((Silian_current) => {
      const Silian_next = {};
      for (const Silian_task of Silian_tasks) {
        const Silian_isDirty = Boolean(Silian_dirtyTaskKeys[Silian_task.task_key]);
        const Silian_shouldPreserveDraft = Silian_isDirty || Silian_task.task_key === Silian_activeSaveTaskKey || Silian_task.task_key === Silian_activeRunTaskKey;
        Silian_next[Silian_task.task_key] = Silian_shouldPreserveDraft && Silian_current[Silian_task.task_key]
          ? Silian_current[Silian_task.task_key]
          : {
              enabled: Boolean(Silian_task.enabled),
              interval_minutes: String(Silian_task.interval_minutes ?? ''),
            };
      }
      return Silian_next;
    });
  }, [Silian_dirtyTaskKeys, Silian_runTaskMutation.isLoading, Silian_runTaskMutation.variables, Silian_saveTaskMutation.isLoading, Silian_saveTaskMutation.variables, Silian_tasks]);

  const Silian_summary = Silian_useMemo(() => {
    const Silian_enabled = Silian_tasks.filter((Silian_task) => Silian_task.enabled).length;
    const Silian_due = Silian_tasks.filter((Silian_task) => Silian_task.is_due).length;
    const Silian_failed = Silian_tasks.filter((Silian_task) => Silian_task.last_status === 'failed').length;
    return { enabled: Silian_enabled, due: Silian_due, failed: Silian_failed };
  }, [Silian_tasks]);

  const Silian_parseIntervalMinutes = (Silian_rawValue) => {
    const Silian_normalized = String(Silian_rawValue ?? '').trim();
    if (Silian_normalized === '') {
      return null;
    }

    const Silian_parsed = Number(Silian_normalized);
    if (!Number.isInteger(Silian_parsed) || Silian_parsed < 1 || Silian_parsed > 1440) {
      return null;
    }

    return Silian_parsed;
  };

  const Silian_saveDraftForTask = (Silian_taskKey, Silian_draft) => {
    const Silian_task = Silian_tasks.find((Silian_item) => Silian_item.task_key === Silian_taskKey);
    const Silian_isDisableUnregisteredTask = Silian_task?.is_registered === false && Silian_draft.enabled === false;
    const Silian_intervalMinutes = Silian_isDisableUnregisteredTask ? null : Silian_parseIntervalMinutes(Silian_draft.interval_minutes);

    if (!Silian_isDisableUnregisteredTask && Silian_intervalMinutes === null) {
      Silian_toast.error(Silian_t('admin.cron.messages.invalidInterval'));
      return;
    }

    const Silian_payload = {
      enabled: Silian_draft.enabled,
    };

    if (!Silian_isDisableUnregisteredTask) {
      Silian_payload.interval_minutes = Silian_intervalMinutes;
    }

    Silian_saveTaskMutation.mutate({
      taskKey: Silian_taskKey,
      payload: Silian_payload,
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[1.8rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f5fbff_100%)] px-6 py-6 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.95)_0%,rgba(14,116,144,0.18)_100%)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600/80 dark:text-sky-300/80">
          {Silian_t('admin.cron.eyebrow')}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{Silian_t('admin.cron.title')}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{Silian_t('admin.cron.subtitle')}</p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Silian_Card>
          <Silian_CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{Silian_t('admin.cron.summary.enabled')}</p>
            <p className="mt-3 text-3xl font-semibold">{Silian_summary.enabled}</p>
          </Silian_CardContent>
        </Silian_Card>
        <Silian_Card>
          <Silian_CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{Silian_t('admin.cron.summary.due')}</p>
            <p className="mt-3 text-3xl font-semibold">{Silian_summary.due}</p>
          </Silian_CardContent>
        </Silian_Card>
        <Silian_Card>
          <Silian_CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{Silian_t('admin.cron.summary.failed')}</p>
            <p className="mt-3 text-3xl font-semibold">{Silian_summary.failed}</p>
          </Silian_CardContent>
        </Silian_Card>
      </div>

      <Silian_Card>
        <Silian_CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Silian_CardTitle>{Silian_t('admin.cron.tasks.title')}</Silian_CardTitle>
            <Silian_CardDescription>{Silian_t('admin.cron.tasks.subtitle')}</Silian_CardDescription>
          </div>
          <Silian_Button type="button" variant="outline" onClick={() => Silian_queryClient.invalidateQueries(['admin-cron-tasks'])}>
            <Silian_RefreshCw className="mr-2 h-4 w-4" />
            {Silian_t('admin.cron.actions.refresh')}
          </Silian_Button>
        </Silian_CardHeader>
        <Silian_CardContent className="space-y-4">
          {Silian_tasksQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Silian_Loader2 className="h-4 w-4 animate-spin" />
              {Silian_t('common.loading')}
            </div>
          ) : null}

          {Silian_tasks.map((Silian_task) => {
            const Silian_draft = Silian_drafts[Silian_task.task_key] ?? {
              enabled: Boolean(Silian_task.enabled),
              interval_minutes: String(Silian_task.interval_minutes ?? ''),
            };
            const Silian_intervalMinutes = Silian_parseIntervalMinutes(Silian_draft.interval_minutes);
            const Silian_canDisableUnregisteredTask = Silian_task.is_registered === false && Silian_draft.enabled === false;
            const Silian_saveLoading = Silian_saveTaskMutation.isLoading && Silian_saveTaskMutation.variables?.taskKey === Silian_task.task_key;
            const Silian_runLoading = Silian_runTaskMutation.isLoading && Silian_runTaskMutation.variables === Silian_task.task_key;
            const Silian_saveDisabled = Silian_runLoading || (Silian_task.is_registered === false ? !Silian_canDisableUnregisteredTask : Silian_intervalMinutes === null);

            return (
              <div key={Silian_task.task_key} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-5 py-5 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-semibold">{Silian_task.task_name}</h2>
                      <Silian_Badge variant="outline" className={Silian_taskStatusTone(Silian_task.last_status)}>
                        {Silian_translateCronStatus(Silian_t, Silian_task.last_status || 'idle')}
                      </Silian_Badge>
                      {Silian_task.is_due ? (
                        <Silian_Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                          {Silian_t('admin.cron.tasks.dueNow')}
                        </Silian_Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{Silian_task.description || '--'}</p>
                    <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{Silian_t('admin.cron.tasks.nextRun')}</p>
                        <p className="mt-2">{Silian_formatDateTime(Silian_task.next_run_at, Silian_locale)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{Silian_t('admin.cron.tasks.lastFinished')}</p>
                        <p className="mt-2">{Silian_formatDateTime(Silian_task.last_finished_at, Silian_locale)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{Silian_t('admin.cron.tasks.duration')}</p>
                        <p className="mt-2">{Silian_task.last_duration_ms ?? '--'} ms</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{Silian_t('admin.cron.tasks.failures')}</p>
                        <p className="mt-2">{Silian_task.consecutive_failures ?? 0}</p>
                      </div>
                    </div>
                    {Silian_task.last_error ? (
                      <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                        {Silian_task.last_error}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[140px_160px_auto] xl:w-[420px]">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{Silian_t('admin.cron.tasks.enabled')}</label>
                      <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 dark:border-white/10 dark:bg-slate-950/70">
                        <Silian_Switch
                          checked={Boolean(Silian_draft.enabled)}
                          onCheckedChange={(Silian_checked) => {
                            Silian_setDrafts((Silian_current) => ({
                              ...Silian_current,
                              [Silian_task.task_key]: { ...Silian_draft, enabled: Silian_checked },
                            }));
                            Silian_setDirtyTaskKeys((Silian_current) => ({ ...Silian_current, [Silian_task.task_key]: true }));
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{Silian_t('admin.cron.tasks.intervalMinutes')}</label>
                      <Silian_Input
                        type="number"
                        min="1"
                        max="1440"
                        aria-invalid={Silian_intervalMinutes === null}
                        value={Silian_draft.interval_minutes}
                        onChange={(Silian_event) => {
                          Silian_setDrafts((Silian_current) => ({
                            ...Silian_current,
                            [Silian_task.task_key]: { ...Silian_draft, interval_minutes: Silian_event.target.value },
                          }));
                          Silian_setDirtyTaskKeys((Silian_current) => ({ ...Silian_current, [Silian_task.task_key]: true }));
                        }}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Silian_Button
                        type="button"
                        className="flex-1"
                        onClick={() => Silian_saveDraftForTask(Silian_task.task_key, Silian_draft)}
                        disabled={Silian_saveDisabled}
                        loading={Silian_saveLoading}
                      >
                        {Silian_t('admin.cron.actions.save')}
                      </Silian_Button>
                      <Silian_Button
                        type="button"
                        variant="outline"
                        aria-label={Silian_t('admin.cron.actions.runNow')}
                        title={Silian_t('admin.cron.actions.runNow')}
                        onClick={() => Silian_runTaskMutation.mutate(Silian_task.task_key)}
                        disabled={Silian_saveLoading}
                        loading={Silian_runLoading}
                      >
                        <Silian_Play className="h-4 w-4" />
                      </Silian_Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </Silian_CardContent>
      </Silian_Card>

      <Silian_Card>
        <Silian_CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <Silian_CardTitle>{Silian_t('admin.cron.runs.title')}</Silian_CardTitle>
            <Silian_CardDescription>{Silian_t('admin.cron.runs.subtitle')}</Silian_CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Silian_Select value={Silian_taskFilter} onValueChange={Silian_setTaskFilter}>
              <Silian_SelectTrigger className="min-w-[220px]">
                <Silian_SelectValue placeholder={Silian_t('admin.cron.filters.task')} />
              </Silian_SelectTrigger>
              <Silian_SelectContent>
                <Silian_SelectItem value="all">{Silian_t('admin.cron.filters.allTasks')}</Silian_SelectItem>
                {Silian_tasks.map((Silian_task) => (
                  <Silian_SelectItem key={Silian_task.task_key} value={Silian_task.task_key}>
                    {Silian_task.task_name}
                  </Silian_SelectItem>
                ))}
              </Silian_SelectContent>
            </Silian_Select>
            <Silian_Select value={Silian_statusFilter} onValueChange={Silian_setStatusFilter}>
              <Silian_SelectTrigger className="min-w-[180px]">
                <Silian_SelectValue placeholder={Silian_t('admin.cron.filters.status')} />
              </Silian_SelectTrigger>
              <Silian_SelectContent>
                <Silian_SelectItem value="all">{Silian_t('admin.cron.filters.allStatuses')}</Silian_SelectItem>
                <Silian_SelectItem value="success">{Silian_t('admin.cron.status.success')}</Silian_SelectItem>
                <Silian_SelectItem value="failed">{Silian_t('admin.cron.status.failed')}</Silian_SelectItem>
                <Silian_SelectItem value="skipped">{Silian_t('admin.cron.status.skipped')}</Silian_SelectItem>
              </Silian_SelectContent>
            </Silian_Select>
          </div>
        </Silian_CardHeader>
        <Silian_CardContent className="space-y-3">
          {Silian_runsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Silian_Loader2 className="h-4 w-4 animate-spin" />
              {Silian_t('common.loading')}
            </div>
          ) : null}

          {!Silian_runs.length && !Silian_runsQuery.isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{Silian_t('admin.cron.runs.empty')}</p>
          ) : null}

          {Silian_runs.map((Silian_run) => (
            <div key={Silian_run.id} className="rounded-[1.3rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{Silian_run.task_key}</p>
                    <Silian_Badge variant="outline" className={Silian_taskStatusTone(Silian_run.status)}>
                      {Silian_translateCronStatus(Silian_t, Silian_run.status)}
                    </Silian_Badge>
                    <Silian_Badge variant="outline">{Silian_translateTriggerSource(Silian_t, Silian_run.trigger_source)}</Silian_Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {Silian_formatDateTime(Silian_run.started_at, Silian_locale)} · {Silian_run.duration_ms ?? '--'} ms
                  </p>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {Silian_run.error_message ? Silian_run.error_message : JSON.stringify(Silian_run.result || {})}
                </div>
              </div>
            </div>
          ))}
        </Silian_CardContent>
      </Silian_Card>
    </div>
  );
}
