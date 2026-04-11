import React, { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from 'react-query';
import { toast } from 'react-hot-toast';
import { Loader2, Play, RefreshCw } from 'lucide-react';

import { adminAPI } from '../../lib/api';
import { useTranslation } from '../../hooks/useTranslation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/badge';
import { Switch } from '../../components/ui/switch';
import { Input } from '../../components/ui/Input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../components/ui/select';

function formatDateTime(value, locale) {
  if (!value) {
    return '--';
  }

  const normalized = typeof value === 'string' && value.includes(' ') ? value.replace(' ', 'T') : value;
  const parsed = new Date(normalized);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
}

function taskStatusTone(status) {
  switch (status) {
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

function translateCronStatus(t, status) {
  if (status === 'idle' || status === 'running' || status === 'success' || status === 'failed' || status === 'skipped') {
    return t(`admin.cron.status.${status}`);
  }

  return status || 'idle';
}

function translateTriggerSource(t, triggerSource) {
  if (triggerSource === 'cron_endpoint' || triggerSource === 'legacy_endpoint' || triggerSource === 'admin_manual') {
    return t(`admin.cron.triggerSources.${triggerSource}`);
  }

  return triggerSource || '--';
}

export default function AdminCronPage() {
  const { t, currentLanguage } = useTranslation(['admin', 'common', 'errors']);
  const locale = currentLanguage === 'zh' ? 'zh-CN' : 'en-US';
  const queryClient = useQueryClient();
  const [taskFilter, setTaskFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [drafts, setDrafts] = useState({});
  const [dirtyTaskKeys, setDirtyTaskKeys] = useState({});

  const tasksQuery = useQuery(['admin-cron-tasks'], async () => {
    const response = await adminAPI.getCronTasks();
    return response.data?.data ?? [];
  });

  const runsQuery = useQuery(['admin-cron-runs', taskFilter, statusFilter], async () => {
    const params = {
      limit: 20,
      ...(taskFilter !== 'all' ? { task_key: taskFilter } : {}),
      ...(statusFilter !== 'all' ? { status: statusFilter } : {}),
    };
    const response = await adminAPI.getCronRuns(params);
    return response.data?.data ?? { items: [], pagination: { page: 1, limit: 20, total: 0 } };
  });

  const tasks = useMemo(() => tasksQuery.data ?? [], [tasksQuery.data]);
  const runs = useMemo(() => runsQuery.data?.items ?? [], [runsQuery.data]);

  const saveTaskMutation = useMutation(
    ({ taskKey, payload }) => adminAPI.updateCronTask(taskKey, payload),
    {
      onSuccess: (_, variables) => {
        setDirtyTaskKeys((current) => {
          const next = { ...current };
          delete next[variables.taskKey];
          return next;
        });
        toast.success(t('admin.cron.messages.saved'));
        queryClient.invalidateQueries(['admin-cron-tasks']);
      },
      onError: (error) => {
        toast.error(error?.response?.data?.message || error?.message || t('errors.operationFailed'));
      },
    }
  );

  const runTaskMutation = useMutation(
    (taskKey) => adminAPI.runCronTask(taskKey),
    {
      onSuccess: () => {
        toast.success(t('admin.cron.messages.executed'));
      },
      onError: (error) => {
        toast.error(error?.response?.data?.message || error?.message || t('errors.operationFailed'));
      },
      onSettled: () => {
        queryClient.invalidateQueries(['admin-cron-tasks']);
        queryClient.invalidateQueries(['admin-cron-runs']);
      },
    }
  );

  useEffect(() => {
    if (!tasks.length) {
      return;
    }

    const activeSaveTaskKey = saveTaskMutation.isLoading ? (saveTaskMutation.variables?.taskKey ?? null) : null;
    const activeRunTaskKey = runTaskMutation.isLoading ? (runTaskMutation.variables ?? null) : null;

    setDrafts((current) => {
      const next = {};
      for (const task of tasks) {
        const isDirty = Boolean(dirtyTaskKeys[task.task_key]);
        const shouldPreserveDraft = isDirty || task.task_key === activeSaveTaskKey || task.task_key === activeRunTaskKey;
        next[task.task_key] = shouldPreserveDraft && current[task.task_key]
          ? current[task.task_key]
          : {
              enabled: Boolean(task.enabled),
              interval_minutes: String(task.interval_minutes ?? ''),
            };
      }
      return next;
    });
  }, [dirtyTaskKeys, runTaskMutation.isLoading, runTaskMutation.variables, saveTaskMutation.isLoading, saveTaskMutation.variables, tasks]);

  const summary = useMemo(() => {
    const enabled = tasks.filter((task) => task.enabled).length;
    const due = tasks.filter((task) => task.is_due).length;
    const failed = tasks.filter((task) => task.last_status === 'failed').length;
    return { enabled, due, failed };
  }, [tasks]);

  const parseIntervalMinutes = (rawValue) => {
    const normalized = String(rawValue ?? '').trim();
    if (normalized === '') {
      return null;
    }

    const parsed = Number(normalized);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 1440) {
      return null;
    }

    return parsed;
  };

  const saveDraftForTask = (taskKey, draft) => {
    const task = tasks.find((item) => item.task_key === taskKey);
    const isDisableUnregisteredTask = task?.is_registered === false && draft.enabled === false;
    const intervalMinutes = isDisableUnregisteredTask ? null : parseIntervalMinutes(draft.interval_minutes);

    if (!isDisableUnregisteredTask && intervalMinutes === null) {
      toast.error(t('admin.cron.messages.invalidInterval'));
      return;
    }

    const payload = {
      enabled: draft.enabled,
    };

    if (!isDisableUnregisteredTask) {
      payload.interval_minutes = intervalMinutes;
    }

    saveTaskMutation.mutate({
      taskKey,
      payload,
    });
  };

  return (
    <div className="space-y-6">
      <section className="rounded-[1.8rem] border border-slate-200 bg-[linear-gradient(135deg,#ffffff_0%,#f5fbff_100%)] px-6 py-6 shadow-sm dark:border-white/10 dark:bg-[linear-gradient(135deg,rgba(15,23,42,0.95)_0%,rgba(14,116,144,0.18)_100%)]">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-sky-600/80 dark:text-sky-300/80">
          {t('admin.cron.eyebrow')}
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight">{t('admin.cron.title')}</h1>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-slate-600 dark:text-slate-300">{t('admin.cron.subtitle')}</p>
      </section>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{t('admin.cron.summary.enabled')}</p>
            <p className="mt-3 text-3xl font-semibold">{summary.enabled}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{t('admin.cron.summary.due')}</p>
            <p className="mt-3 text-3xl font-semibold">{summary.due}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <p className="text-xs font-semibold uppercase tracking-[0.22em] text-slate-500 dark:text-slate-400">{t('admin.cron.summary.failed')}</p>
            <p className="mt-3 text-3xl font-semibold">{summary.failed}</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>{t('admin.cron.tasks.title')}</CardTitle>
            <CardDescription>{t('admin.cron.tasks.subtitle')}</CardDescription>
          </div>
          <Button type="button" variant="outline" onClick={() => queryClient.invalidateQueries(['admin-cron-tasks'])}>
            <RefreshCw className="mr-2 h-4 w-4" />
            {t('admin.cron.actions.refresh')}
          </Button>
        </CardHeader>
        <CardContent className="space-y-4">
          {tasksQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : null}

          {tasks.map((task) => {
            const draft = drafts[task.task_key] ?? {
              enabled: Boolean(task.enabled),
              interval_minutes: String(task.interval_minutes ?? ''),
            };
            const intervalMinutes = parseIntervalMinutes(draft.interval_minutes);
            const canDisableUnregisteredTask = task.is_registered === false && draft.enabled === false;
            const saveLoading = saveTaskMutation.isLoading && saveTaskMutation.variables?.taskKey === task.task_key;
            const runLoading = runTaskMutation.isLoading && runTaskMutation.variables === task.task_key;
            const saveDisabled = runLoading || (task.is_registered === false ? !canDisableUnregisteredTask : intervalMinutes === null);

            return (
              <div key={task.task_key} className="rounded-[1.4rem] border border-slate-200 bg-slate-50 px-5 py-5 dark:border-white/10 dark:bg-white/5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-lg font-semibold">{task.task_name}</h2>
                      <Badge variant="outline" className={taskStatusTone(task.last_status)}>
                        {translateCronStatus(t, task.last_status || 'idle')}
                      </Badge>
                      {task.is_due ? (
                        <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-200">
                          {t('admin.cron.tasks.dueNow')}
                        </Badge>
                      ) : null}
                    </div>
                    <p className="text-sm text-slate-600 dark:text-slate-300">{task.description || '--'}</p>
                    <div className="grid gap-3 text-sm sm:grid-cols-2 xl:grid-cols-4">
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('admin.cron.tasks.nextRun')}</p>
                        <p className="mt-2">{formatDateTime(task.next_run_at, locale)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('admin.cron.tasks.lastFinished')}</p>
                        <p className="mt-2">{formatDateTime(task.last_finished_at, locale)}</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('admin.cron.tasks.duration')}</p>
                        <p className="mt-2">{task.last_duration_ms ?? '--'} ms</p>
                      </div>
                      <div>
                        <p className="text-xs uppercase tracking-[0.18em] text-slate-500 dark:text-slate-400">{t('admin.cron.tasks.failures')}</p>
                        <p className="mt-2">{task.consecutive_failures ?? 0}</p>
                      </div>
                    </div>
                    {task.last_error ? (
                      <p className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-200">
                        {task.last_error}
                      </p>
                    ) : null}
                  </div>

                  <div className="grid gap-3 sm:grid-cols-[140px_160px_auto] xl:w-[420px]">
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t('admin.cron.tasks.enabled')}</label>
                      <div className="flex h-10 items-center rounded-xl border border-slate-200 bg-white px-3 dark:border-white/10 dark:bg-slate-950/70">
                        <Switch
                          checked={Boolean(draft.enabled)}
                          onCheckedChange={(checked) => {
                            setDrafts((current) => ({
                              ...current,
                              [task.task_key]: { ...draft, enabled: checked },
                            }));
                            setDirtyTaskKeys((current) => ({ ...current, [task.task_key]: true }));
                          }}
                        />
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="text-sm font-medium">{t('admin.cron.tasks.intervalMinutes')}</label>
                      <Input
                        type="number"
                        min="1"
                        max="1440"
                        aria-invalid={intervalMinutes === null}
                        value={draft.interval_minutes}
                        onChange={(event) => {
                          setDrafts((current) => ({
                            ...current,
                            [task.task_key]: { ...draft, interval_minutes: event.target.value },
                          }));
                          setDirtyTaskKeys((current) => ({ ...current, [task.task_key]: true }));
                        }}
                      />
                    </div>
                    <div className="flex items-end gap-2">
                      <Button
                        type="button"
                        className="flex-1"
                        onClick={() => saveDraftForTask(task.task_key, draft)}
                        disabled={saveDisabled}
                        loading={saveLoading}
                      >
                        {t('admin.cron.actions.save')}
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        aria-label={t('admin.cron.actions.runNow')}
                        title={t('admin.cron.actions.runNow')}
                        onClick={() => runTaskMutation.mutate(task.task_key)}
                        disabled={saveLoading}
                        loading={runLoading}
                      >
                        <Play className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <CardTitle>{t('admin.cron.runs.title')}</CardTitle>
            <CardDescription>{t('admin.cron.runs.subtitle')}</CardDescription>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row">
            <Select value={taskFilter} onValueChange={setTaskFilter}>
              <SelectTrigger className="min-w-[220px]">
                <SelectValue placeholder={t('admin.cron.filters.task')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.cron.filters.allTasks')}</SelectItem>
                {tasks.map((task) => (
                  <SelectItem key={task.task_key} value={task.task_key}>
                    {task.task_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="min-w-[180px]">
                <SelectValue placeholder={t('admin.cron.filters.status')} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t('admin.cron.filters.allStatuses')}</SelectItem>
                <SelectItem value="success">{t('admin.cron.status.success')}</SelectItem>
                <SelectItem value="failed">{t('admin.cron.status.failed')}</SelectItem>
                <SelectItem value="skipped">{t('admin.cron.status.skipped')}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {runsQuery.isLoading ? (
            <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : null}

          {!runs.length && !runsQuery.isLoading ? (
            <p className="text-sm text-slate-500 dark:text-slate-400">{t('admin.cron.runs.empty')}</p>
          ) : null}

          {runs.map((run) => (
            <div key={run.id} className="rounded-[1.3rem] border border-slate-200 bg-slate-50 px-4 py-4 dark:border-white/10 dark:bg-white/5">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{run.task_key}</p>
                    <Badge variant="outline" className={taskStatusTone(run.status)}>
                      {translateCronStatus(t, run.status)}
                    </Badge>
                    <Badge variant="outline">{translateTriggerSource(t, run.trigger_source)}</Badge>
                  </div>
                  <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                    {formatDateTime(run.started_at, locale)} · {run.duration_ms ?? '--'} ms
                  </p>
                </div>
                <div className="text-sm text-slate-600 dark:text-slate-300">
                  {run.error_message ? run.error_message : JSON.stringify(run.result || {})}
                </div>
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
