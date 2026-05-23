<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Models\CronRun;
use CarbonTrack\Models\CronTask;
use CarbonTrack\Support\SyntheticRequestFactory;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use Psr\Log\LoggerInterface;

class CronSchedulerService
{
    public const TASK_SUPPORT_SLA_SWEEP = 'support_sla_sweep';
    public const TASK_BADGE_AUTO_AWARD = 'badge_auto_award';
    public const TASK_LEADERBOARD_REFRESH = 'leaderboard_refresh';
    public const TASK_STREAK_LEADERBOARD_REFRESH = 'streak_leaderboard_refresh';

    private const LOCK_TIMEOUT_SECONDS = 600;
    private const RUN_STATUS_SUCCESS = 'success';
    private const RUN_STATUS_FAILED = 'failed';
    private const RUN_STATUS_SKIPPED = 'skipped';
    private const TASK_STATUS_IDLE = 'idle';
    private const TASK_STATUS_RUNNING = 'running';
    private const TASK_STATUS_SUCCESS = 'success';
    private const TASK_STATUS_FAILED = 'failed';
    private const VALID_TRIGGER_SOURCES = ['cron_endpoint', 'legacy_endpoint', 'admin_manual'];
    private const STALE_COMPLETION_ERROR = 'task_lock_lost';
    private const VALID_TASK_STATUSES = [
        self::TASK_STATUS_IDLE,
        self::TASK_STATUS_RUNNING,
        self::TASK_STATUS_SUCCESS,
        self::TASK_STATUS_FAILED,
    ];
    private const VALID_RUN_STATUSES = [
        self::RUN_STATUS_SUCCESS,
        self::RUN_STATUS_FAILED,
        self::RUN_STATUS_SKIPPED,
    ];

    public function __construct(
        private PDO $db,
        private LoggerInterface $logger,
        private AuditLogService $auditLogService,
        private ErrorLogService $errorLogService,
        private SupportRoutingEngineService $supportRoutingEngineService,
        private BadgeService $badgeService,
        private LeaderboardService $leaderboardService,
        private StreakLeaderboardService $streakLeaderboardService
    ) {
    }

    public function listTasks(): array
    {
        $Silian_now = $this->now();

        return array_map(
            fn (CronTask $Silian_task): array => $this->formatTask($Silian_task, $Silian_now),
            CronTask::query()->orderBy('task_key')->get()->all()
        );
    }

    public function updateTask(string $Silian_taskKey, array $Silian_payload): array
    {
        $Silian_taskKey = $this->normalizeLookupTaskKey($Silian_taskKey);
        $Silian_task = $this->findTask($Silian_taskKey);
        if ($Silian_task === null) {
            throw new \RuntimeException('Cron task not found');
        }

        $Silian_isRegisteredTask = $this->isRegisteredTaskKey($Silian_taskKey);
        if (!$Silian_isRegisteredTask) {
            $this->assertOnlyDisableForUnregisteredTask($Silian_payload);
        }

        $Silian_changed = false;
        $Silian_scheduleChanged = false;
        if (array_key_exists('enabled', $Silian_payload)) {
            $Silian_task->enabled = $this->normalizeBoolean($Silian_payload['enabled'], 'enabled');
            $Silian_changed = true;
            $Silian_scheduleChanged = true;
        }

        if (array_key_exists('interval_minutes', $Silian_payload)) {
            $Silian_task->interval_minutes = $this->normalizeIntervalMinutes($Silian_payload['interval_minutes']);
            $Silian_changed = true;
            $Silian_scheduleChanged = true;
        }

        if (array_key_exists('settings', $Silian_payload)) {
            $Silian_settings = $Silian_payload['settings'];
            if ($Silian_settings !== null && !is_array($Silian_settings)) {
                throw new \InvalidArgumentException('settings must be an object');
            }
            $Silian_task->settings_json = $this->encodeJson($Silian_settings ?? []);
            $Silian_changed = true;
        }

        if (!$Silian_changed) {
            throw new \InvalidArgumentException('No cron task fields provided');
        }

        $Silian_now = $this->now();
        if ($Silian_scheduleChanged) {
            if ($Silian_task->enabled) {
                $Silian_task->next_run_at = $this->addMinutes($Silian_now, (int) $Silian_task->interval_minutes);
            } else {
                $Silian_task->next_run_at = null;
            }
        }

        $Silian_task->updated_at = $Silian_now;
        $Silian_task->save();

        return $this->formatTask($Silian_task, $Silian_now);
    }

    public function listRuns(array $Silian_query = []): array
    {
        $Silian_page = max(1, (int) ($Silian_query['page'] ?? 1));
        $Silian_limit = min(100, max(1, (int) ($Silian_query['limit'] ?? 20)));

        $Silian_runsQuery = CronRun::query()->orderByDesc('id');
        if (!empty($Silian_query['task_key'])) {
            $Silian_taskKey = strtolower(trim((string) $Silian_query['task_key']));
            if ($Silian_taskKey === '') {
                throw new \InvalidArgumentException('Invalid cron task key filter');
            }
            $Silian_runsQuery->where('task_key', $Silian_taskKey);
        }
        if (!empty($Silian_query['status'])) {
            $Silian_status = strtolower(trim((string) $Silian_query['status']));
            if (!in_array($Silian_status, self::VALID_RUN_STATUSES, true)) {
                throw new \InvalidArgumentException('Invalid cron run status');
            }
            $Silian_runsQuery->where('status', $Silian_status);
        }
        if (!empty($Silian_query['trigger_source'])) {
            $Silian_triggerSource = strtolower(trim((string) $Silian_query['trigger_source']));
            if (!in_array($Silian_triggerSource, self::VALID_TRIGGER_SOURCES, true)) {
                throw new \InvalidArgumentException('Invalid cron trigger source');
            }
            $Silian_runsQuery->where('trigger_source', $Silian_triggerSource);
        }

        $Silian_total = (clone $Silian_runsQuery)->count();
        $Silian_items = $Silian_runsQuery
            ->forPage($Silian_page, $Silian_limit)
            ->get()
            ->map(fn (CronRun $Silian_run): array => $this->formatRun($Silian_run))
            ->all();

        return [
            'items' => $Silian_items,
            'pagination' => [
                'page' => $Silian_page,
                'limit' => $Silian_limit,
                'total' => $Silian_total,
            ],
        ];
    }

    public function runDueTasks(string $Silian_triggerSource = 'cron_endpoint', array $Silian_context = []): array
    {
        $Silian_triggerSource = $this->normalizeTriggerSource($Silian_triggerSource);
        $Silian_now = $this->now();
        $Silian_dueTasks = CronTask::query()
            ->where('enabled', true)
            ->whereNotNull('next_run_at')
            ->where('next_run_at', '<=', $Silian_now)
            ->orderBy('next_run_at')
            ->orderBy('task_key')
            ->get()
            ->all();

        $Silian_response = [
            'triggered_at' => $Silian_now,
            'due' => array_map(static fn (CronTask $Silian_task): string => (string) $Silian_task->task_key, $Silian_dueTasks),
            'executed' => [],
            'failed' => [],
            'skipped' => [],
        ];

        foreach ($Silian_dueTasks as $Silian_task) {
            $Silian_runResult = $this->runTaskInternal((string) $Silian_task->task_key, false, $Silian_triggerSource, $Silian_context);
            if ($Silian_runResult['status'] === self::RUN_STATUS_SUCCESS) {
                $Silian_response['executed'][] = $Silian_runResult;
            } elseif ($Silian_runResult['status'] === self::RUN_STATUS_FAILED) {
                $Silian_response['failed'][] = $Silian_runResult;
            } else {
                $Silian_response['skipped'][] = $Silian_runResult;
            }
        }

        try {
            $this->auditLogService->logSystemEvent('cron_scheduler_batch_completed', 'cron_scheduler', [
                'status' => !empty($Silian_response['failed']) || !empty($Silian_response['skipped']) ? 'failed' : 'success',
                'request_method' => 'SYSTEM',
                'endpoint' => '/cron/run',
                'request_id' => $Silian_context['request_id'] ?? null,
                'request_data' => [
                    'trigger_source' => $Silian_triggerSource,
                    'due_count' => count($Silian_response['due']),
                    'executed_count' => count($Silian_response['executed']),
                    'failed_count' => count($Silian_response['failed']),
                    'skipped_count' => count($Silian_response['skipped']),
                ],
            ]);
        } catch (\Throwable $Silian_exception) {
            $this->logNonCriticalPostRunFailure(
                'Cron scheduler batch audit logging failed',
                'batch',
                $Silian_triggerSource,
                $Silian_context,
                $Silian_exception,
                '/cron/run',
                'cron_scheduler_batch_logging_failed'
            );
        }

        return $Silian_response;
    }

    public function runTaskNow(string $Silian_taskKey, string $Silian_triggerSource = 'admin_manual', array $Silian_context = []): array
    {
        $Silian_taskKey = $this->normalizeLookupTaskKey($Silian_taskKey);
        $Silian_task = $this->findTask($Silian_taskKey);
        if ($Silian_task === null) {
            throw new \RuntimeException('Cron task not found');
        }
        $this->ensureRegisteredTaskKey($Silian_taskKey);

        return $this->runTaskInternal($Silian_taskKey, true, $this->normalizeTriggerSource($Silian_triggerSource), $Silian_context);
    }

    private function runTaskInternal(string $Silian_taskKey, bool $Silian_forceRun, string $Silian_triggerSource, array $Silian_context): array
    {
        $Silian_task = $this->findTask($Silian_taskKey);
        if ($Silian_task === null) {
            throw new \RuntimeException('Cron task not found');
        }

        $Silian_lockNow = $this->now();
        if ($this->isFreshLockActive($Silian_task, $Silian_lockNow)) {
            return $this->recordSkippedRun($Silian_task, $Silian_triggerSource, $Silian_context, 'task_locked');
        }

        $Silian_lockToken = $this->generateLockToken();
        if (!$this->acquireLock($Silian_taskKey, $Silian_lockToken, $Silian_lockNow, $Silian_forceRun)) {
            return $this->recordSkippedRun($Silian_task, $Silian_triggerSource, $Silian_context, $this->determineSkipReason($Silian_task, $Silian_forceRun, $Silian_lockNow));
        }

        $Silian_startedAt = $Silian_lockNow;
        $Silian_startedAtMicro = microtime(true);
        try {
            $Silian_rawResult = $this->executeTaskHandler($Silian_taskKey, $Silian_triggerSource);
            $Silian_result = $this->normalizeTaskResult($Silian_taskKey, $Silian_rawResult);
            $Silian_finishedAt = $this->now();
            $Silian_durationMs = $this->diffMilliseconds($Silian_startedAtMicro, microtime(true));
            $Silian_freshTask = $this->findTask($Silian_taskKey);
            $Silian_nextRunAt = null;
            if ($Silian_freshTask?->enabled) {
                $Silian_nextRunAt = $Silian_freshTask->next_run_at;
                $Silian_nextRunAt = $this->addMinutes($Silian_finishedAt, (int) $Silian_freshTask->interval_minutes);
            }

            if (!$this->finalizeTaskRun($Silian_taskKey, $Silian_lockToken, [
                'last_finished_at' => $Silian_finishedAt,
                'last_status' => self::TASK_STATUS_SUCCESS,
                'last_error' => null,
                'last_duration_ms' => $Silian_durationMs,
                'consecutive_failures' => 0,
                'next_run_at' => $Silian_freshTask?->enabled ? $Silian_nextRunAt : null,
                'updated_at' => $Silian_finishedAt,
            ], $Silian_triggerSource, $Silian_context)) {
                return $this->recordStaleCompletion($Silian_task, $Silian_triggerSource, $Silian_context, $Silian_startedAt, $Silian_finishedAt, $Silian_durationMs, $Silian_result);
            }

            $Silian_freshTask = $this->findTask($Silian_taskKey);
            $Silian_nextRunAt = $Silian_freshTask?->next_run_at;

            $Silian_runId = null;
            try {
                $Silian_run = CronRun::create([
                    'task_key' => $Silian_taskKey,
                    'trigger_source' => $Silian_triggerSource,
                    'request_id' => $Silian_context['request_id'] ?? null,
                    'status' => self::RUN_STATUS_SUCCESS,
                    'started_at' => $Silian_startedAt,
                    'finished_at' => $Silian_finishedAt,
                    'duration_ms' => $Silian_durationMs,
                    'result_json' => $this->encodeJson($Silian_result),
                    'error_message' => null,
                ]);
                $Silian_runId = (int) $Silian_run->id;
            } catch (\Throwable $Silian_persistenceException) {
                $this->logNonCriticalPostRunFailure('Cron task run-history persistence failed', $Silian_taskKey, $Silian_triggerSource, $Silian_context, $Silian_persistenceException);
            }

            try {
                $this->auditLogService->logSystemEvent('cron_task_run_completed', 'cron_scheduler', [
                    'status' => 'success',
                    'request_method' => 'SYSTEM',
                    'endpoint' => '/internal/cron/' . $Silian_taskKey,
                    'request_id' => $Silian_context['request_id'] ?? null,
                    'request_data' => [
                        'task_key' => $Silian_taskKey,
                        'trigger_source' => $Silian_triggerSource,
                        'duration_ms' => $Silian_durationMs,
                    ],
                    'new_data' => $Silian_result,
                ]);
            } catch (\Throwable $Silian_loggingException) {
                $this->logNonCriticalPostRunFailure(
                    'Cron task completion audit logging failed',
                    $Silian_taskKey,
                    $Silian_triggerSource,
                    $Silian_context,
                    $Silian_loggingException
                );
            }

            return [
                'task_key' => $Silian_taskKey,
                'task_name' => $Silian_task->task_name,
                'status' => self::RUN_STATUS_SUCCESS,
                'run_id' => $Silian_runId,
                'started_at' => $Silian_startedAt,
                'finished_at' => $Silian_finishedAt,
                'duration_ms' => $Silian_durationMs,
                'result' => $Silian_result,
                'next_run_at' => $Silian_nextRunAt,
            ];
        } catch (\Throwable $Silian_exception) {
            $Silian_finishedAt = $this->now();
            $Silian_durationMs = $this->diffMilliseconds($Silian_startedAtMicro, microtime(true));
            $Silian_errorMessage = trim($Silian_exception->getMessage()) !== '' ? $Silian_exception->getMessage() : 'Unknown cron task error';
            $Silian_freshTask = $this->findTask($Silian_taskKey);
            $Silian_nextRunAt = null;
            if ($Silian_freshTask?->enabled) {
                $Silian_nextRunAt = $Silian_freshTask->next_run_at;
                $Silian_nextRunAt = $this->addMinutes($Silian_finishedAt, (int) $Silian_freshTask->interval_minutes);
            }

            if (!$this->finalizeTaskRun($Silian_taskKey, $Silian_lockToken, [
                'last_finished_at' => $Silian_finishedAt,
                'last_status' => self::TASK_STATUS_FAILED,
                'last_error' => $Silian_errorMessage,
                'last_duration_ms' => $Silian_durationMs,
                'consecutive_failures' => (int) ($Silian_task->consecutive_failures ?? 0) + 1,
                'next_run_at' => $Silian_freshTask?->enabled ? $Silian_nextRunAt : null,
                'updated_at' => $Silian_finishedAt,
            ], $Silian_triggerSource, $Silian_context)) {
                return $this->recordStaleCompletion(
                    $Silian_task,
                    $Silian_triggerSource,
                    $Silian_context,
                    $Silian_startedAt,
                    $Silian_finishedAt,
                    $Silian_durationMs,
                    ['reason' => self::STALE_COMPLETION_ERROR, 'original_error' => $Silian_errorMessage],
                    $Silian_exception
                );
            }

            $Silian_freshTask = $this->findTask($Silian_taskKey);
            $Silian_nextRunAt = $Silian_freshTask?->next_run_at;

            $Silian_runId = null;
            try {
                $Silian_run = CronRun::create([
                    'task_key' => $Silian_taskKey,
                    'trigger_source' => $Silian_triggerSource,
                    'request_id' => $Silian_context['request_id'] ?? null,
                    'status' => self::RUN_STATUS_FAILED,
                    'started_at' => $Silian_startedAt,
                    'finished_at' => $Silian_finishedAt,
                    'duration_ms' => $Silian_durationMs,
                    'result_json' => $this->encodeJson([]),
                    'error_message' => $Silian_errorMessage,
                ]);
                $Silian_runId = (int) $Silian_run->id;
            } catch (\Throwable $Silian_persistenceException) {
                $this->logNonCriticalPostRunFailure(
                    'Cron task failed-run persistence failed',
                    $Silian_taskKey,
                    $Silian_triggerSource,
                    $Silian_context,
                    $Silian_persistenceException
                );
            }

            $this->logTaskException($Silian_taskKey, $Silian_triggerSource, $Silian_context, $Silian_exception);
            try {
                $this->auditLogService->logSystemEvent('cron_task_run_failed', 'cron_scheduler', [
                    'status' => 'failed',
                    'request_method' => 'SYSTEM',
                    'endpoint' => '/internal/cron/' . $Silian_taskKey,
                    'request_id' => $Silian_context['request_id'] ?? null,
                    'request_data' => [
                        'task_key' => $Silian_taskKey,
                        'trigger_source' => $Silian_triggerSource,
                        'duration_ms' => $Silian_durationMs,
                    ],
                    'data' => ['error' => $Silian_errorMessage],
                ]);
            } catch (\Throwable $Silian_loggingException) {
                $this->logNonCriticalPostRunFailure(
                    'Cron task failure audit logging failed',
                    $Silian_taskKey,
                    $Silian_triggerSource,
                    $Silian_context,
                    $Silian_loggingException
                );
            }

            return [
                'task_key' => $Silian_taskKey,
                'task_name' => $Silian_task->task_name,
                'status' => self::RUN_STATUS_FAILED,
                'run_id' => $Silian_runId,
                'started_at' => $Silian_startedAt,
                'finished_at' => $Silian_finishedAt,
                'duration_ms' => $Silian_durationMs,
                'result' => [],
                'error_message' => $Silian_errorMessage,
                'next_run_at' => $Silian_nextRunAt,
            ];
        }
    }

    private function recordSkippedRun(CronTask $Silian_task, string $Silian_triggerSource, array $Silian_context, string $Silian_reason): array
    {
        $Silian_now = $this->now();
        $Silian_runId = null;
        try {
            $Silian_run = CronRun::create([
                'task_key' => (string) $Silian_task->task_key,
                'trigger_source' => $Silian_triggerSource,
                'request_id' => $Silian_context['request_id'] ?? null,
                'status' => self::RUN_STATUS_SKIPPED,
                'started_at' => $Silian_now,
                'finished_at' => $Silian_now,
                'duration_ms' => 0,
                'result_json' => $this->encodeJson(['reason' => $Silian_reason]),
                'error_message' => $Silian_reason,
            ]);
            $Silian_runId = (int) $Silian_run->id;
        } catch (\Throwable $Silian_persistenceException) {
            $this->logNonCriticalPostRunFailure(
                'Cron task skipped-run persistence failed',
                (string) $Silian_task->task_key,
                $Silian_triggerSource,
                $Silian_context,
                $Silian_persistenceException
            );
        }

        try {
            $this->auditLogService->logSystemEvent('cron_task_run_skipped', 'cron_scheduler', [
                'status' => 'skipped',
                'request_method' => 'SYSTEM',
                'endpoint' => '/internal/cron/' . $Silian_task->task_key,
                'request_id' => $Silian_context['request_id'] ?? null,
                'request_data' => [
                    'task_key' => $Silian_task->task_key,
                    'trigger_source' => $Silian_triggerSource,
                    'reason' => $Silian_reason,
                ],
            ]);
        } catch (\Throwable $Silian_loggingException) {
            $this->logNonCriticalPostRunFailure(
                'Cron task skipped audit logging failed',
                (string) $Silian_task->task_key,
                $Silian_triggerSource,
                $Silian_context,
                $Silian_loggingException
            );
        }

        return [
            'task_key' => (string) $Silian_task->task_key,
            'task_name' => (string) $Silian_task->task_name,
            'status' => self::RUN_STATUS_SKIPPED,
            'run_id' => $Silian_runId,
            'started_at' => $Silian_now,
            'finished_at' => $Silian_now,
            'duration_ms' => 0,
            'result' => [],
            'error_message' => $Silian_reason,
            'next_run_at' => $Silian_task->next_run_at,
        ];
    }

    private function acquireLock(string $Silian_taskKey, string $Silian_lockToken, string $Silian_now, bool $Silian_forceRun): bool
    {
        $Silian_staleBefore = $this->addSeconds($Silian_now, -self::LOCK_TIMEOUT_SECONDS);
        $Silian_sql = '
            UPDATE cron_tasks
            SET
                lock_token = :lock_token,
                locked_at = :locked_at,
                last_started_at = :last_started_at,
                last_status = :last_status,
                updated_at = :updated_at
            WHERE task_key = :task_key
              AND (
                    lock_token IS NULL
                    OR locked_at IS NULL
                    OR locked_at < :stale_before
                  )
        ';
        if ($Silian_forceRun) {
            $Silian_params = [
                'lock_token' => $Silian_lockToken,
                'locked_at' => $Silian_now,
                'last_started_at' => $Silian_now,
                'last_status' => self::TASK_STATUS_RUNNING,
                'updated_at' => $Silian_now,
                'task_key' => $Silian_taskKey,
                'stale_before' => $Silian_staleBefore,
            ];
        } else {
            $Silian_sql .= '
              AND enabled = 1
              AND next_run_at IS NOT NULL
              AND next_run_at <= :now_value
            ';
            $Silian_params = [
                'lock_token' => $Silian_lockToken,
                'locked_at' => $Silian_now,
                'last_started_at' => $Silian_now,
                'last_status' => self::TASK_STATUS_RUNNING,
                'updated_at' => $Silian_now,
                'task_key' => $Silian_taskKey,
                'stale_before' => $Silian_staleBefore,
                'now_value' => $Silian_now,
            ];
        }

        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute($Silian_params);

        return $Silian_stmt->rowCount() > 0;
    }

    private function completeTaskRun(string $Silian_taskKey, string $Silian_lockToken, array $Silian_fields): bool
    {
        $Silian_set = [];
        $Silian_params = [
            'task_key' => $Silian_taskKey,
            'lock_token_match' => $Silian_lockToken,
        ];

        foreach ($Silian_fields as $Silian_field => $Silian_value) {
            $Silian_set[] = "{$Silian_field} = :{$Silian_field}";
            $Silian_params[$Silian_field] = $Silian_value;
        }

        $Silian_sql = 'UPDATE cron_tasks SET ' . implode(', ', $Silian_set) . ' WHERE task_key = :task_key AND lock_token = :lock_token_match';
        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute($Silian_params);

        return $Silian_stmt->rowCount() > 0;
    }

    private function finalizeTaskRun(
        string $Silian_taskKey,
        string $Silian_lockToken,
        array $Silian_fields,
        string $Silian_triggerSource = 'internal',
        array $Silian_context = []
    ): bool
    {
        try {
            return $this->completeTaskRun($Silian_taskKey, $Silian_lockToken, $Silian_fields + [
                'lock_token' => null,
                'locked_at' => null,
            ]);
        } catch (\Throwable $Silian_releaseException) {
            $this->logNonCriticalPostRunFailure(
                'Cron task release failed after completion',
                $Silian_taskKey,
                $Silian_triggerSource,
                $Silian_context,
                $Silian_releaseException
            );

            $Silian_fallbackFields = $Silian_fields;
            unset($Silian_fallbackFields['next_run_at']);

            return $this->completeTaskRun($Silian_taskKey, $Silian_lockToken, $Silian_fallbackFields);
        }
    }

    private function executeTaskHandler(string $Silian_taskKey, string $Silian_triggerSource): array
    {
        return match ($Silian_taskKey) {
            self::TASK_SUPPORT_SLA_SWEEP => $this->supportRoutingEngineService->runSlaSweep(),
            self::TASK_BADGE_AUTO_AWARD => $this->badgeService->runAutoGrant(),
            self::TASK_LEADERBOARD_REFRESH => $this->leaderboardService->rebuildCache($this->reasonForTrigger($Silian_triggerSource)),
            self::TASK_STREAK_LEADERBOARD_REFRESH => $this->streakLeaderboardService->rebuildCache($this->reasonForTrigger($Silian_triggerSource)),
            default => throw new \RuntimeException('Unsupported cron task'),
        };
    }

    private function reasonForTrigger(string $Silian_triggerSource): string
    {
        return match ($Silian_triggerSource) {
            'cron_endpoint' => 'cron',
            'legacy_endpoint' => 'legacy-endpoint',
            'admin_manual' => 'admin-manual',
            default => $Silian_triggerSource,
        };
    }

    private function normalizeTaskResult(string $Silian_taskKey, array $Silian_rawResult): array
    {
        return match ($Silian_taskKey) {
            self::TASK_SUPPORT_SLA_SWEEP => [
                'processed' => (int) ($Silian_rawResult['processed'] ?? 0),
                'breached' => (int) ($Silian_rawResult['breached'] ?? 0),
                'rerouted' => (int) ($Silian_rawResult['rerouted'] ?? 0),
            ],
            self::TASK_BADGE_AUTO_AWARD => [
                'awarded' => (int) ($Silian_rawResult['awarded'] ?? 0),
                'skipped' => (int) ($Silian_rawResult['skipped'] ?? 0),
                'badges' => (int) ($Silian_rawResult['badges'] ?? 0),
                'users' => (int) ($Silian_rawResult['users'] ?? 0),
            ],
            self::TASK_LEADERBOARD_REFRESH,
            self::TASK_STREAK_LEADERBOARD_REFRESH => [
                'generated_at' => $Silian_rawResult['generated_at'] ?? null,
                'expires_at' => $Silian_rawResult['expires_at'] ?? null,
                'global_count' => count($Silian_rawResult['global'] ?? []),
                'regions_count' => count($Silian_rawResult['regions'] ?? []),
                'schools_count' => count($Silian_rawResult['schools'] ?? []),
            ],
            default => $Silian_rawResult,
        };
    }

    private function formatTask(CronTask $Silian_task, string $Silian_now): array
    {
        $Silian_lockedAt = $this->normalizeDateValue($Silian_task->locked_at);
        $Silian_settings = $this->decodeJsonObject($Silian_task->settings_json) ?? [];

        return [
            'task_key' => (string) $Silian_task->task_key,
            'task_name' => (string) $Silian_task->task_name,
            'description' => $Silian_task->description,
            'is_registered' => $this->isRegisteredTaskKey((string) $Silian_task->task_key),
            'interval_minutes' => (int) ($Silian_task->interval_minutes ?? 0),
            'enabled' => (bool) $Silian_task->enabled,
            'next_run_at' => $Silian_task->next_run_at,
            'last_started_at' => $Silian_task->last_started_at,
            'last_finished_at' => $Silian_task->last_finished_at,
            'last_status' => $Silian_task->last_status,
            'last_error' => $Silian_task->last_error,
            'last_duration_ms' => $Silian_task->last_duration_ms !== null ? (int) $Silian_task->last_duration_ms : null,
            'consecutive_failures' => (int) ($Silian_task->consecutive_failures ?? 0),
            'locked_at' => $Silian_lockedAt,
            'settings' => $Silian_settings,
            'is_due' => (bool) $Silian_task->enabled
                && is_string($Silian_task->next_run_at)
                && $Silian_task->next_run_at !== ''
                && $Silian_task->next_run_at <= $Silian_now,
            'is_locked' => $Silian_lockedAt !== null && $Silian_lockedAt >= $this->addSeconds($Silian_now, -self::LOCK_TIMEOUT_SECONDS),
        ];
    }

    private function formatRun(CronRun $Silian_run): array
    {
        return [
            'id' => (int) $Silian_run->id,
            'task_key' => (string) $Silian_run->task_key,
            'trigger_source' => (string) $Silian_run->trigger_source,
            'request_id' => $Silian_run->request_id,
            'status' => (string) $Silian_run->status,
            'started_at' => $Silian_run->started_at,
            'finished_at' => $Silian_run->finished_at,
            'duration_ms' => $Silian_run->duration_ms !== null ? (int) $Silian_run->duration_ms : null,
            'result' => $this->decodeJsonObject($Silian_run->result_json) ?? [],
            'error_message' => $Silian_run->error_message,
            'created_at' => $Silian_run->created_at,
        ];
    }

    private function findTask(string $Silian_taskKey): ?CronTask
    {
        return CronTask::query()->where('task_key', $Silian_taskKey)->first();
    }

    private function determineSkipReason(CronTask $Silian_task, bool $Silian_forceRun, string $Silian_now): string
    {
        if (!$Silian_forceRun && !$Silian_task->enabled) {
            return 'task_disabled';
        }
        if (!$Silian_forceRun && (!is_string($Silian_task->next_run_at) || $Silian_task->next_run_at === '' || $Silian_task->next_run_at > $Silian_now)) {
            return 'task_not_due';
        }
        return 'task_locked';
    }

    private function isFreshLockActive(CronTask $Silian_task, string $Silian_now): bool
    {
        if (!is_string($Silian_task->lock_token) || trim($Silian_task->lock_token) === '') {
            return false;
        }
        $Silian_lockedAt = $this->normalizeDateValue($Silian_task->locked_at);
        if ($Silian_lockedAt === null) {
            return false;
        }

        return $Silian_lockedAt >= $this->addSeconds($Silian_now, -self::LOCK_TIMEOUT_SECONDS);
    }

    private function normalizeDateValue(mixed $Silian_value): ?string
    {
        if ($Silian_value instanceof \DateTimeInterface) {
            return $Silian_value->format('Y-m-d H:i:s');
        }
        if (is_string($Silian_value) && trim($Silian_value) !== '') {
            return trim($Silian_value);
        }

        return null;
    }

    private function normalizeTaskKey(string $Silian_taskKey): string
    {
        $Silian_normalized = strtolower(trim($Silian_taskKey));
        if ($Silian_normalized === '') {
            throw new \InvalidArgumentException('Cron task key is required');
        }
        return $Silian_normalized;
    }

    private function ensureRegisteredTaskKey(string $Silian_taskKey): void
    {
        if (!$this->isRegisteredTaskKey($Silian_taskKey)) {
            throw new \RuntimeException('Cron task not found');
        }
    }

    private function isRegisteredTaskKey(string $Silian_taskKey): bool
    {
        $Silian_definitions = $this->taskDefinitions();
        return isset($Silian_definitions[$Silian_taskKey]);
    }

    private function normalizeLookupTaskKey(string $Silian_taskKey): string
    {
        return $this->normalizeTaskKey($Silian_taskKey);
    }

    private function assertOnlyDisableForUnregisteredTask(array $Silian_payload): void
    {
        if (!array_key_exists('enabled', $Silian_payload)) {
            throw new \InvalidArgumentException('Unregistered cron tasks can only be disabled');
        }

        if ($this->normalizeBoolean($Silian_payload['enabled'], 'enabled')) {
            throw new \InvalidArgumentException('Unregistered cron tasks can only be disabled');
        }

        if (array_key_exists('interval_minutes', $Silian_payload) || array_key_exists('settings', $Silian_payload)) {
            throw new \InvalidArgumentException('Unregistered cron tasks can only be disabled');
        }
    }

    private function normalizeTriggerSource(string $Silian_triggerSource): string
    {
        $Silian_normalized = strtolower(trim($Silian_triggerSource));
        if (!in_array($Silian_normalized, self::VALID_TRIGGER_SOURCES, true)) {
            throw new \InvalidArgumentException('Invalid cron trigger source');
        }
        return $Silian_normalized;
    }

    private function normalizeBoolean(mixed $Silian_value, string $Silian_field): bool
    {
        if (is_bool($Silian_value)) {
            return $Silian_value;
        }
        if (is_int($Silian_value) || is_float($Silian_value) || (is_string($Silian_value) && is_numeric($Silian_value))) {
            return (int) $Silian_value !== 0;
        }
        if (is_string($Silian_value)) {
            $Silian_normalized = strtolower(trim($Silian_value));
            if (in_array($Silian_normalized, ['true', 'yes', 'on'], true)) {
                return true;
            }
            if (in_array($Silian_normalized, ['false', 'no', 'off'], true)) {
                return false;
            }
        }

        throw new \InvalidArgumentException($Silian_field . ' must be a boolean');
    }

    private function normalizeIntervalMinutes(mixed $Silian_value): int
    {
        if (is_int($Silian_value)) {
            $Silian_interval = $Silian_value;
        } elseif (is_string($Silian_value) && preg_match('/^\d+$/', trim($Silian_value)) === 1) {
            $Silian_interval = (int) trim($Silian_value);
        } else {
            throw new \InvalidArgumentException('interval_minutes must be an integer');
        }
        if ($Silian_interval < 1 || $Silian_interval > 1440) {
            throw new \InvalidArgumentException('interval_minutes must be between 1 and 1440');
        }

        return $Silian_interval;
    }

    private function taskDefinitions(): array
    {
        return [
            self::TASK_SUPPORT_SLA_SWEEP => [
                'task_name' => 'Support SLA Sweep',
                'description' => 'Inspect unresolved support tickets, update SLA status, and reroute escalated tickets.',
            ],
            self::TASK_BADGE_AUTO_AWARD => [
                'task_name' => 'Badge Auto Award',
                'description' => 'Evaluate active users against badge auto-grant rules and award newly qualified badges.',
            ],
            self::TASK_LEADERBOARD_REFRESH => [
                'task_name' => 'Leaderboard Refresh',
                'description' => 'Refresh the main points leaderboard cache for global, regional, and school rankings.',
            ],
            self::TASK_STREAK_LEADERBOARD_REFRESH => [
                'task_name' => 'Streak Leaderboard Refresh',
                'description' => 'Refresh the streak leaderboard cache for current and longest check-in streak rankings.',
            ],
        ];
    }

    private function encodeJson(array $Silian_value): string
    {
        return json_encode($Silian_value, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE) ?: '{}';
    }

    private function decodeJsonObject(?string $Silian_value): ?array
    {
        if (!is_string($Silian_value) || trim($Silian_value) === '') {
            return null;
        }

        $Silian_decoded = json_decode($Silian_value, true);
        return is_array($Silian_decoded) ? $Silian_decoded : null;
    }

    private function logTaskException(string $Silian_taskKey, string $Silian_triggerSource, array $Silian_context, \Throwable $Silian_exception): void
    {
        $this->logger->error('Cron task execution failed', [
            'task_key' => $Silian_taskKey,
            'trigger_source' => $Silian_triggerSource,
            'error' => $Silian_exception->getMessage(),
        ]);

        try {
            $Silian_request = SyntheticRequestFactory::fromContext(
                '/internal/cron/' . $Silian_taskKey,
                'SYSTEM',
                is_string($Silian_context['request_id'] ?? null) ? (string) $Silian_context['request_id'] : null,
                [],
                $Silian_context + [
                    'task_key' => $Silian_taskKey,
                    'trigger_source' => $Silian_triggerSource,
                ],
                ['PHP_SAPI' => PHP_SAPI]
            );

            $this->errorLogService->logException($Silian_exception, $Silian_request, [
                'context_message' => 'cron_task_run_failed',
                'task_key' => $Silian_taskKey,
                'trigger_source' => $Silian_triggerSource,
            ]);
        } catch (\Throwable $Silian_loggingException) {
            $this->logger->warning('Cron task exception logging failed', [
                'task_key' => $Silian_taskKey,
                'trigger_source' => $Silian_triggerSource,
                'error' => $Silian_loggingException->getMessage(),
            ]);
        }
    }

    private function logNonCriticalPostRunFailure(
        string $Silian_message,
        string $Silian_taskKey,
        string $Silian_triggerSource,
        array $Silian_context,
        \Throwable $Silian_exception,
        ?string $Silian_endpoint = null,
        string $Silian_contextMessage = 'cron_task_post_run_recording_failed'
    ): void
    {
        $this->logger->warning($Silian_message, [
            'task_key' => $Silian_taskKey,
            'trigger_source' => $Silian_triggerSource,
            'error' => $Silian_exception->getMessage(),
        ]);

        try {
            $Silian_request = SyntheticRequestFactory::fromContext(
                $Silian_endpoint ?? '/internal/cron/' . $Silian_taskKey,
                'SYSTEM',
                is_string($Silian_context['request_id'] ?? null) ? (string) $Silian_context['request_id'] : null,
                [],
                $Silian_context + [
                    'task_key' => $Silian_taskKey,
                    'trigger_source' => $Silian_triggerSource,
                ],
                ['PHP_SAPI' => PHP_SAPI]
            );

            $this->errorLogService->logException($Silian_exception, $Silian_request, [
                'context_message' => $Silian_contextMessage,
                'task_key' => $Silian_taskKey,
                'trigger_source' => $Silian_triggerSource,
            ]);
        } catch (\Throwable) {
        }
    }

    /**
     * @param array<string,mixed> $result
     */
    private function recordStaleCompletion(
        CronTask $Silian_task,
        string $Silian_triggerSource,
        array $Silian_context,
        string $Silian_startedAt,
        string $Silian_finishedAt,
        int $Silian_durationMs,
        array $Silian_result = [],
        ?\Throwable $Silian_exception = null
    ): array {
        $Silian_taskKey = (string) $Silian_task->task_key;
        $Silian_errorMessage = self::STALE_COMPLETION_ERROR;

        $this->logger->warning('Cron task completion aborted because lock ownership was lost', [
            'task_key' => $Silian_taskKey,
            'trigger_source' => $Silian_triggerSource,
            'request_id' => $Silian_context['request_id'] ?? null,
            'original_error' => $Silian_exception?->getMessage(),
        ]);

        if ($Silian_exception !== null) {
            $this->logTaskException($Silian_taskKey, $Silian_triggerSource, $Silian_context, $Silian_exception);
        }

        $Silian_runPayload = $Silian_result !== [] ? $Silian_result : ['reason' => $Silian_errorMessage];
        $Silian_runId = null;
        try {
            $Silian_run = CronRun::create([
                'task_key' => $Silian_taskKey,
                'trigger_source' => $Silian_triggerSource,
                'request_id' => $Silian_context['request_id'] ?? null,
                'status' => self::RUN_STATUS_FAILED,
                'started_at' => $Silian_startedAt,
                'finished_at' => $Silian_finishedAt,
                'duration_ms' => $Silian_durationMs,
                'result_json' => $this->encodeJson($Silian_runPayload),
                'error_message' => $Silian_errorMessage,
            ]);
            $Silian_runId = (int) $Silian_run->id;
        } catch (\Throwable $Silian_persistenceException) {
            $this->logNonCriticalPostRunFailure(
                'Cron task stale-run persistence failed',
                $Silian_taskKey,
                $Silian_triggerSource,
                $Silian_context,
                $Silian_persistenceException
            );
        }

        try {
            $this->auditLogService->logSystemEvent('cron_task_run_failed', 'cron_scheduler', [
                'status' => 'failed',
                'request_method' => 'SYSTEM',
                'endpoint' => '/internal/cron/' . $Silian_taskKey,
                'request_id' => $Silian_context['request_id'] ?? null,
                'request_data' => [
                    'task_key' => $Silian_taskKey,
                    'trigger_source' => $Silian_triggerSource,
                    'duration_ms' => $Silian_durationMs,
                    'reason' => $Silian_errorMessage,
                ],
                'data' => [
                    'error' => $Silian_errorMessage,
                    'result' => $Silian_runPayload,
                ],
            ]);
        } catch (\Throwable $Silian_loggingException) {
            $this->logNonCriticalPostRunFailure(
                'Cron task stale-completion audit logging failed',
                $Silian_taskKey,
                $Silian_triggerSource,
                $Silian_context,
                $Silian_loggingException
            );
        }

        $Silian_freshTask = $this->findTask($Silian_taskKey);

        return [
            'task_key' => $Silian_taskKey,
            'task_name' => $Silian_task->task_name,
            'status' => self::RUN_STATUS_FAILED,
            'run_id' => $Silian_runId,
            'started_at' => $Silian_startedAt,
            'finished_at' => $Silian_finishedAt,
            'duration_ms' => $Silian_durationMs,
            'result' => $Silian_runPayload,
            'error_message' => $Silian_errorMessage,
            'next_run_at' => $Silian_freshTask?->next_run_at,
        ];
    }

    private function now(): string
    {
        return (new DateTimeImmutable('now', new DateTimeZone('Asia/Shanghai')))->format('Y-m-d H:i:s');
    }

    private function addMinutes(string $Silian_dateTime, int $Silian_minutes): string
    {
        return (new DateTimeImmutable($Silian_dateTime, new DateTimeZone('Asia/Shanghai')))
            ->modify(sprintf('+%d minutes', $Silian_minutes))
            ->format('Y-m-d H:i:s');
    }

    private function addSeconds(string $Silian_dateTime, int $Silian_seconds): string
    {
        $Silian_modifier = $Silian_seconds >= 0 ? '+' . $Silian_seconds : (string) $Silian_seconds;
        return (new DateTimeImmutable($Silian_dateTime, new DateTimeZone('Asia/Shanghai')))
            ->modify($Silian_modifier . ' seconds')
            ->format('Y-m-d H:i:s');
    }

    private function diffMilliseconds(float $Silian_startedAt, float $Silian_finishedAt): int
    {
        return (int) max(0, round(($Silian_finishedAt - $Silian_startedAt) * 1000));
    }

    private function generateLockToken(): string
    {
        try {
            return bin2hex(random_bytes(16));
        } catch (\Throwable) {
            if (!function_exists('openssl_random_pseudo_bytes')) {
                throw new \RuntimeException('Unable to generate cron lock token');
            }

            $Silian_bytes = openssl_random_pseudo_bytes(16);
            if (!is_string($Silian_bytes) || $Silian_bytes === '') {
                throw new \RuntimeException('Unable to generate cron lock token');
            }

            return bin2hex($Silian_bytes);
        }
    }
}
