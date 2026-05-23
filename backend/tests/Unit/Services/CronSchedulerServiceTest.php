<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Models\CronRun;
use CarbonTrack\Models\CronTask;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\BadgeService;
use CarbonTrack\Services\CronSchedulerService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\LeaderboardService;
use CarbonTrack\Services\StreakLeaderboardService;
use CarbonTrack\Services\SupportRoutingEngineService;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

class CronSchedulerServiceTest extends TestCase
{
    private static ?Capsule $capsule = null;

    public static function setUpBeforeClass(): void
    {
        self::$capsule = new Capsule();
        self::$capsule->addConnection([
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
        ]);
        self::$capsule->setAsGlobal();
        self::$capsule->bootEloquent();

        self::$capsule->schema()->create('cron_tasks', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->string('task_key');
            $Silian_table->string('task_name');
            $Silian_table->string('description')->nullable();
            $Silian_table->integer('interval_minutes')->default(5);
            $Silian_table->boolean('enabled')->default(true);
            $Silian_table->timestamp('next_run_at')->nullable();
            $Silian_table->timestamp('last_started_at')->nullable();
            $Silian_table->timestamp('last_finished_at')->nullable();
            $Silian_table->string('last_status')->default('idle');
            $Silian_table->text('last_error')->nullable();
            $Silian_table->integer('last_duration_ms')->nullable();
            $Silian_table->integer('consecutive_failures')->default(0);
            $Silian_table->string('lock_token')->nullable();
            $Silian_table->timestamp('locked_at')->nullable();
            $Silian_table->text('settings_json')->nullable();
            $Silian_table->timestamp('created_at')->nullable();
            $Silian_table->timestamp('updated_at')->nullable();
        });

        self::$capsule->schema()->create('cron_runs', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->string('task_key');
            $Silian_table->string('trigger_source');
            $Silian_table->string('request_id')->nullable();
            $Silian_table->string('status');
            $Silian_table->timestamp('started_at')->nullable();
            $Silian_table->timestamp('finished_at')->nullable();
            $Silian_table->integer('duration_ms')->nullable();
            $Silian_table->text('result_json')->nullable();
            $Silian_table->text('error_message')->nullable();
            $Silian_table->timestamp('created_at')->nullable();
            $Silian_table->timestamp('updated_at')->nullable();
        });
    }

    protected function setUp(): void
    {
        parent::setUp();

        CronRun::query()->delete();
        CronTask::query()->delete();
    }

    public function testRunDueTasksExecutesAllRegisteredTasks(): void
    {
        $Silian_now = $this->now();
        $this->seedTask(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'Support SLA Sweep', 1, true, $Silian_now);
        $this->seedTask(CronSchedulerService::TASK_BADGE_AUTO_AWARD, 'Badge Auto Award', 5, true, $Silian_now);
        $this->seedTask(CronSchedulerService::TASK_LEADERBOARD_REFRESH, 'Leaderboard Refresh', 10, true, $Silian_now);
        $this->seedTask(CronSchedulerService::TASK_STREAK_LEADERBOARD_REFRESH, 'Streak Leaderboard Refresh', 10, true, $Silian_now);

        $Silian_support = $this->createMock(SupportRoutingEngineService::class);
        $Silian_support->expects($this->once())->method('runSlaSweep')->willReturn(['processed' => 2, 'breached' => 1, 'rerouted' => 1]);

        $Silian_badge = $this->createMock(BadgeService::class);
        $Silian_badge->expects($this->once())->method('runAutoGrant')->willReturn(['awarded' => 3, 'skipped' => 4, 'badges' => 2, 'users' => 5]);

        $Silian_leaderboard = $this->createMock(LeaderboardService::class);
        $Silian_leaderboard->expects($this->once())->method('rebuildCache')->with('cron')->willReturn([
            'generated_at' => '2026-04-10T00:00:00Z',
            'expires_at' => '2026-04-10T00:10:00Z',
            'global' => [1, 2],
            'regions' => [1],
            'schools' => [1, 2, 3],
        ]);

        $Silian_streak = $this->createMock(StreakLeaderboardService::class);
        $Silian_streak->expects($this->once())->method('rebuildCache')->with('cron')->willReturn([
            'generated_at' => '2026-04-10T00:00:00Z',
            'expires_at' => '2026-04-10T00:10:00Z',
            'global' => [1],
            'regions' => [1, 2],
            'schools' => [1],
        ]);

        $Silian_service = $this->makeService($Silian_support, $Silian_badge, $Silian_leaderboard, $Silian_streak);
        $Silian_result = $Silian_service->runDueTasks('cron_endpoint', ['request_id' => 'req-1']);

        $this->assertCount(4, $Silian_result['due']);
        $this->assertCount(4, $Silian_result['executed']);
        $this->assertCount(0, $Silian_result['failed']);
        $this->assertCount(0, $Silian_result['skipped']);
        $this->assertSame(4, CronRun::query()->count());
        $this->assertSame('success', CronTask::query()->where('task_key', CronSchedulerService::TASK_SUPPORT_SLA_SWEEP)->value('last_status'));
        $this->assertSame('success', CronTask::query()->where('task_key', CronSchedulerService::TASK_BADGE_AUTO_AWARD)->value('last_status'));
    }

    public function testFailedTaskIncrementsFailureCounterAndRunHistory(): void
    {
        $Silian_now = $this->now();
        $this->seedTask(CronSchedulerService::TASK_BADGE_AUTO_AWARD, 'Badge Auto Award', 5, true, $Silian_now);

        $Silian_badge = $this->createMock(BadgeService::class);
        $Silian_badge->expects($this->once())->method('runAutoGrant')->willThrowException(new \RuntimeException('badge auto award failed'));

        $Silian_service = $this->makeService(
            $this->createMock(SupportRoutingEngineService::class),
            $Silian_badge,
            $this->createMock(LeaderboardService::class),
            $this->createMock(StreakLeaderboardService::class)
        );

        $Silian_result = $Silian_service->runDueTasks('cron_endpoint', ['request_id' => 'req-2']);

        $this->assertCount(1, $Silian_result['failed']);
        $this->assertSame('failed', CronTask::query()->where('task_key', CronSchedulerService::TASK_BADGE_AUTO_AWARD)->value('last_status'));
        $this->assertSame(1, (int) CronTask::query()->where('task_key', CronSchedulerService::TASK_BADGE_AUTO_AWARD)->value('consecutive_failures'));
        $this->assertSame('failed', CronRun::query()->where('task_key', CronSchedulerService::TASK_BADGE_AUTO_AWARD)->value('status'));
    }

    public function testManualRunAllowsDisabledTask(): void
    {
        $this->seedTask(CronSchedulerService::TASK_LEADERBOARD_REFRESH, 'Leaderboard Refresh', 10, false, null);

        $Silian_leaderboard = $this->createMock(LeaderboardService::class);
        $Silian_leaderboard->expects($this->once())->method('rebuildCache')->with('admin-manual')->willReturn([
            'generated_at' => '2026-04-10T00:00:00Z',
            'expires_at' => '2026-04-10T00:10:00Z',
            'global' => [],
            'regions' => [],
            'schools' => [],
        ]);

        $Silian_service = $this->makeService(
            $this->createMock(SupportRoutingEngineService::class),
            $this->createMock(BadgeService::class),
            $Silian_leaderboard,
            $this->createMock(StreakLeaderboardService::class)
        );

        $Silian_result = $Silian_service->runTaskNow(CronSchedulerService::TASK_LEADERBOARD_REFRESH, 'admin_manual', ['request_id' => 'req-3']);

        $this->assertSame('success', $Silian_result['status']);
        $this->assertNull($Silian_result['next_run_at']);
        $this->assertSame('success', CronTask::query()->where('task_key', CronSchedulerService::TASK_LEADERBOARD_REFRESH)->value('last_status'));
        $this->assertSame('success', CronRun::query()->where('task_key', CronSchedulerService::TASK_LEADERBOARD_REFRESH)->value('status'));
    }

    public function testLockedTaskIsSkipped(): void
    {
        $Silian_now = $this->now();
        $this->seedTask(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'Support SLA Sweep', 1, true, $Silian_now, [
            'lock_token' => 'existing-lock',
            'locked_at' => $Silian_now,
        ]);

        $Silian_support = $this->createMock(SupportRoutingEngineService::class);
        $Silian_support->expects($this->never())->method('runSlaSweep');

        $Silian_service = $this->makeService(
            $Silian_support,
            $this->createMock(BadgeService::class),
            $this->createMock(LeaderboardService::class),
            $this->createMock(StreakLeaderboardService::class)
        );

        $Silian_result = $Silian_service->runDueTasks('cron_endpoint', ['request_id' => 'req-4']);

        $this->assertCount(1, $Silian_result['skipped']);
        $this->assertSame('task_locked', $Silian_result['skipped'][0]['error_message']);
        $this->assertSame('skipped', CronRun::query()->where('task_key', CronSchedulerService::TASK_SUPPORT_SLA_SWEEP)->value('status'));
    }

    public function testUpdateTaskDisablesFutureRunWithoutClearingActiveLock(): void
    {
        $Silian_now = $this->now();
        $this->seedTask(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'Support SLA Sweep', 1, true, $Silian_now, [
            'lock_token' => 'existing-lock',
            'locked_at' => $Silian_now,
        ]);

        $Silian_service = $this->makeService(
            $this->createMock(SupportRoutingEngineService::class),
            $this->createMock(BadgeService::class),
            $this->createMock(LeaderboardService::class),
            $this->createMock(StreakLeaderboardService::class)
        );

        $Silian_result = $Silian_service->updateTask(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, ['enabled' => false]);

        $this->assertFalse($Silian_result['enabled']);
        $this->assertNull($Silian_result['next_run_at']);
        $this->assertFalse($Silian_result['is_due']);
        $this->assertSame('existing-lock', CronTask::query()->where('task_key', CronSchedulerService::TASK_SUPPORT_SLA_SWEEP)->value('lock_token'));
    }

    public function testUpdateTaskRejectsNonIntegerInterval(): void
    {
        $this->seedTask(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'Support SLA Sweep', 1, true, $this->now());

        $Silian_service = $this->makeService(
            $this->createMock(SupportRoutingEngineService::class),
            $this->createMock(BadgeService::class),
            $this->createMock(LeaderboardService::class),
            $this->createMock(StreakLeaderboardService::class)
        );

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('interval_minutes must be an integer');

        $Silian_service->updateTask(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, ['interval_minutes' => '1.9']);
    }

    public function testUpdateTaskAllowsDisablingUnregisteredTask(): void
    {
        CronTask::query()->create([
            'task_key' => 'legacy_removed_task',
            'task_name' => 'Legacy Removed Task',
            'description' => 'Legacy',
            'interval_minutes' => 5,
            'enabled' => true,
            'next_run_at' => $this->now(),
            'last_status' => 'idle',
            'consecutive_failures' => 0,
            'settings_json' => '{}',
            'created_at' => $this->now(),
            'updated_at' => $this->now(),
        ]);

        $Silian_service = $this->makeService(
            $this->createMock(SupportRoutingEngineService::class),
            $this->createMock(BadgeService::class),
            $this->createMock(LeaderboardService::class),
            $this->createMock(StreakLeaderboardService::class)
        );

        $Silian_result = $Silian_service->updateTask('legacy_removed_task', ['enabled' => false]);

        $this->assertFalse($Silian_result['enabled']);
        $this->assertFalse($Silian_result['is_registered']);
        $this->assertNull($Silian_result['next_run_at']);
    }

    public function testUpdateTaskRejectsUnsupportedFieldsForUnregisteredTaskAsValidationError(): void
    {
        CronTask::query()->create([
            'task_key' => 'legacy_removed_task',
            'task_name' => 'Legacy Removed Task',
            'description' => 'Legacy',
            'interval_minutes' => 5,
            'enabled' => true,
            'next_run_at' => $this->now(),
            'last_status' => 'idle',
            'consecutive_failures' => 0,
            'settings_json' => '{}',
            'created_at' => $this->now(),
            'updated_at' => $this->now(),
        ]);

        $Silian_service = $this->makeService(
            $this->createMock(SupportRoutingEngineService::class),
            $this->createMock(BadgeService::class),
            $this->createMock(LeaderboardService::class),
            $this->createMock(StreakLeaderboardService::class)
        );

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Unregistered cron tasks can only be disabled');

        $Silian_service->updateTask('legacy_removed_task', [
            'enabled' => false,
            'interval_minutes' => 15,
        ]);
    }

    public function testUpdateTaskKeepsNextRunWhenOnlySettingsChange(): void
    {
        $Silian_nextRunAt = $this->now();
        $this->seedTask(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'Support SLA Sweep', 1, true, $Silian_nextRunAt, [
            'settings_json' => '{"foo":"bar"}',
        ]);

        $Silian_service = $this->makeService(
            $this->createMock(SupportRoutingEngineService::class),
            $this->createMock(BadgeService::class),
            $this->createMock(LeaderboardService::class),
            $this->createMock(StreakLeaderboardService::class)
        );

        $Silian_result = $Silian_service->updateTask(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, [
            'settings' => ['foo' => 'baz'],
        ]);

        $this->assertSame($Silian_nextRunAt, $Silian_result['next_run_at']);
        $this->assertSame($Silian_nextRunAt, CronTask::query()->where('task_key', CronSchedulerService::TASK_SUPPORT_SLA_SWEEP)->value('next_run_at'));
    }

    public function testSuccessfulRunUsesLatestTaskSettingsForNextRunAt(): void
    {
        $Silian_now = $this->now();
        $this->seedTask(CronSchedulerService::TASK_LEADERBOARD_REFRESH, 'Leaderboard Refresh', 10, true, $Silian_now);

        $Silian_leaderboard = $this->createMock(LeaderboardService::class);
        $Silian_leaderboard->expects($this->once())->method('rebuildCache')->with('admin-manual')->willReturn([
            'generated_at' => '2026-04-10T00:00:00Z',
            'expires_at' => '2026-04-10T00:10:00Z',
            'global' => [],
            'regions' => [],
            'schools' => [],
        ]);

        $Silian_service = $this->makeService(
            $this->createMock(SupportRoutingEngineService::class),
            $this->createMock(BadgeService::class),
            $Silian_leaderboard,
            $this->createMock(StreakLeaderboardService::class)
        );

        $Silian_service->updateTask(CronSchedulerService::TASK_LEADERBOARD_REFRESH, ['interval_minutes' => 30]);
        $Silian_result = $Silian_service->runTaskNow(CronSchedulerService::TASK_LEADERBOARD_REFRESH, 'admin_manual', ['request_id' => 'req-5']);

        $this->assertSame('success', $Silian_result['status']);
        $this->assertNotNull($Silian_result['next_run_at']);
        $this->assertSame($Silian_result['next_run_at'], CronTask::query()->where('task_key', CronSchedulerService::TASK_LEADERBOARD_REFRESH)->value('next_run_at'));
    }

    public function testNextRunAtUpdateDoesNotOverrideNewLock(): void
    {
        $Silian_now = $this->now();
        $this->seedTask(CronSchedulerService::TASK_LEADERBOARD_REFRESH, 'Leaderboard Refresh', 10, true, $Silian_now);

        self::$capsule->getConnection()->statement('DROP TRIGGER IF EXISTS cron_task_release_relock');
        self::$capsule->getConnection()->statement("
            CREATE TRIGGER cron_task_release_relock
            AFTER UPDATE ON cron_tasks
            WHEN NEW.task_key = '" . CronSchedulerService::TASK_LEADERBOARD_REFRESH . "'
              AND OLD.lock_token IS NOT NULL
              AND NEW.lock_token IS NULL
            BEGIN
                UPDATE cron_tasks
                SET lock_token = 'new-lock',
                    locked_at = '" . $this->now() . "'
                WHERE task_key = '" . CronSchedulerService::TASK_LEADERBOARD_REFRESH . "';
            END;
        ");

        $Silian_leaderboard = $this->createMock(LeaderboardService::class);
        $Silian_leaderboard->expects($this->once())->method('rebuildCache')->with('admin-manual')->willReturn([
            'generated_at' => '2026-04-10T00:00:00Z',
            'expires_at' => '2026-04-10T00:10:00Z',
            'global' => [],
            'regions' => [],
            'schools' => [],
        ]);

        $Silian_service = new CronSchedulerService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            $this->createMock(SupportRoutingEngineService::class),
            $this->createMock(BadgeService::class),
            $Silian_leaderboard,
            $this->createMock(StreakLeaderboardService::class)
        );

        $Silian_result = $Silian_service->runTaskNow(CronSchedulerService::TASK_LEADERBOARD_REFRESH, 'admin_manual', ['request_id' => 'req-6']);

        $this->assertSame('success', $Silian_result['status']);
        $this->assertNotSame($Silian_now, $Silian_result['next_run_at']);
        $this->assertSame($Silian_result['next_run_at'], CronTask::query()->where('task_key', CronSchedulerService::TASK_LEADERBOARD_REFRESH)->value('next_run_at'));
        $this->assertSame('new-lock', CronTask::query()->where('task_key', CronSchedulerService::TASK_LEADERBOARD_REFRESH)->value('lock_token'));

        self::$capsule->getConnection()->statement('DROP TRIGGER IF EXISTS cron_task_release_relock');
    }

    public function testLockIsNotReleasedBeforeNextRunIsAdvanced(): void
    {
        $Silian_now = $this->now();
        $this->seedTask(CronSchedulerService::TASK_LEADERBOARD_REFRESH, 'Leaderboard Refresh', 10, true, $Silian_now);

        self::$capsule->getConnection()->statement('DROP TRIGGER IF EXISTS cron_task_release_without_next_run_guard');
        self::$capsule->getConnection()->statement("
            CREATE TRIGGER cron_task_release_without_next_run_guard
            BEFORE UPDATE ON cron_tasks
            WHEN NEW.task_key = '" . CronSchedulerService::TASK_LEADERBOARD_REFRESH . "'
              AND OLD.lock_token IS NOT NULL
              AND NEW.lock_token IS NULL
              AND NEW.next_run_at IS OLD.next_run_at
            BEGIN
                SELECT RAISE(FAIL, 'lock released before next_run_at advanced');
            END;
        ");

        $Silian_leaderboard = $this->createMock(LeaderboardService::class);
        $Silian_leaderboard->expects($this->once())->method('rebuildCache')->with('admin-manual')->willReturn([
            'generated_at' => '2026-04-10T00:00:00Z',
            'expires_at' => '2026-04-10T00:10:00Z',
            'global' => [],
            'regions' => [],
            'schools' => [],
        ]);

        $Silian_service = $this->makeService(
            $this->createMock(SupportRoutingEngineService::class),
            $this->createMock(BadgeService::class),
            $Silian_leaderboard,
            $this->createMock(StreakLeaderboardService::class)
        );

        $Silian_result = $Silian_service->runTaskNow(CronSchedulerService::TASK_LEADERBOARD_REFRESH, 'admin_manual', ['request_id' => 'req-guard-1']);

        $this->assertSame('success', $Silian_result['status']);
        $this->assertNotSame($Silian_now, $Silian_result['next_run_at']);
        $this->assertNull(CronTask::query()->where('task_key', CronSchedulerService::TASK_LEADERBOARD_REFRESH)->value('lock_token'));

        self::$capsule->getConnection()->statement('DROP TRIGGER IF EXISTS cron_task_release_without_next_run_guard');
    }

    public function testDurationMillisecondsCapturesSubSecondExecution(): void
    {
        $this->seedTask(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'Support SLA Sweep', 1, true, $this->now());

        $Silian_support = $this->createMock(SupportRoutingEngineService::class);
        $Silian_support->expects($this->once())->method('runSlaSweep')->willReturnCallback(function () {
            usleep(20000);
            return ['processed' => 1, 'breached' => 0, 'rerouted' => 0];
        });

        $Silian_service = $this->makeService(
            $Silian_support,
            $this->createMock(BadgeService::class),
            $this->createMock(LeaderboardService::class),
            $this->createMock(StreakLeaderboardService::class)
        );

        $Silian_result = $Silian_service->runTaskNow(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'admin_manual', ['request_id' => 'req-7']);

        $this->assertGreaterThan(0, $Silian_result['duration_ms']);
        $this->assertGreaterThan(0, (int) CronRun::query()->where('task_key', CronSchedulerService::TASK_SUPPORT_SLA_SWEEP)->value('duration_ms'));
    }

    public function testNextRunUpdateFailureDoesNotFlipSuccessfulRun(): void
    {
        $Silian_now = $this->now();
        $this->seedTask(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'Support SLA Sweep', 1, true, $Silian_now);

        self::$capsule->getConnection()->statement('DROP TRIGGER IF EXISTS cron_task_next_run_fail');
        self::$capsule->getConnection()->statement("
            CREATE TRIGGER cron_task_next_run_fail
            BEFORE UPDATE ON cron_tasks
            WHEN NEW.task_key = '" . CronSchedulerService::TASK_SUPPORT_SLA_SWEEP . "'
              AND NEW.next_run_at IS NOT OLD.next_run_at
            BEGIN
                SELECT RAISE(FAIL, 'next run update failed');
            END;
        ");

        $Silian_support = $this->createMock(SupportRoutingEngineService::class);
        $Silian_support->expects($this->once())->method('runSlaSweep')->willReturn(['processed' => 1, 'breached' => 0, 'rerouted' => 0]);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_logger->expects($this->atLeastOnce())->method('warning');

        $Silian_service = new CronSchedulerService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            $Silian_support,
            $this->createMock(BadgeService::class),
            $this->createMock(LeaderboardService::class),
            $this->createMock(StreakLeaderboardService::class)
        );

        $Silian_result = $Silian_service->runTaskNow(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'admin_manual', ['request_id' => 'req-13']);

        $this->assertSame('success', $Silian_result['status']);
        $this->assertSame('success', CronTask::query()->where('task_key', CronSchedulerService::TASK_SUPPORT_SLA_SWEEP)->value('last_status'));
        $this->assertNotNull(CronTask::query()->where('task_key', CronSchedulerService::TASK_SUPPORT_SLA_SWEEP)->value('lock_token'));

        self::$capsule->getConnection()->statement('DROP TRIGGER IF EXISTS cron_task_next_run_fail');
    }

    public function testListRunsAllowsHistoricalUnknownTaskKeyFilter(): void
    {
        CronRun::query()->create([
            'task_key' => 'legacy_removed_task',
            'trigger_source' => 'legacy_endpoint',
            'request_id' => 'req-legacy',
            'status' => 'success',
            'started_at' => $this->now(),
            'finished_at' => $this->now(),
            'duration_ms' => 12,
            'result_json' => '{}',
            'error_message' => null,
            'created_at' => $this->now(),
        ]);

        $Silian_service = $this->makeService(
            $this->createMock(SupportRoutingEngineService::class),
            $this->createMock(BadgeService::class),
            $this->createMock(LeaderboardService::class),
            $this->createMock(StreakLeaderboardService::class)
        );

        $Silian_result = $Silian_service->listRuns(['task_key' => 'legacy_removed_task']);

        $this->assertSame(1, $Silian_result['pagination']['total']);
        $this->assertSame('legacy_removed_task', $Silian_result['items'][0]['task_key']);
    }

    public function testCompletionAuditFailureDoesNotFlipSuccessfulRun(): void
    {
        $this->seedTask(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'Support SLA Sweep', 1, true, $this->now());

        $Silian_support = $this->createMock(SupportRoutingEngineService::class);
        $Silian_support->expects($this->once())->method('runSlaSweep')->willReturn(['processed' => 1, 'breached' => 0, 'rerouted' => 0]);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->method('logSystemEvent')->willReturnCallback(function (string $Silian_action) {
            if ($Silian_action === 'cron_task_run_completed') {
                throw new \RuntimeException('audit_failed');
            }
            return true;
        });

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_logger->expects($this->once())->method('warning');

        $Silian_service = new CronSchedulerService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $this->createMock(ErrorLogService::class),
            $Silian_support,
            $this->createMock(BadgeService::class),
            $this->createMock(LeaderboardService::class),
            $this->createMock(StreakLeaderboardService::class)
        );

        $Silian_result = $Silian_service->runTaskNow(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'admin_manual', ['request_id' => 'req-8']);

        $this->assertSame('success', $Silian_result['status']);
        $this->assertSame('success', CronTask::query()->where('task_key', CronSchedulerService::TASK_SUPPORT_SLA_SWEEP)->value('last_status'));
        $this->assertSame('success', CronRun::query()->where('task_key', CronSchedulerService::TASK_SUPPORT_SLA_SWEEP)->value('status'));
    }

    public function testRunHistoryPersistenceFailureDoesNotFlipSuccessfulRun(): void
    {
        $this->seedTask(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'Support SLA Sweep', 1, true, $this->now());

        $Silian_support = $this->createMock(SupportRoutingEngineService::class);
        $Silian_support->expects($this->once())->method('runSlaSweep')->willReturn(['processed' => 1, 'breached' => 0, 'rerouted' => 0]);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->method('logSystemEvent')->willReturn(true);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_logger->expects($this->once())->method('warning');

        self::$capsule->getConnection()->statement('DROP TRIGGER IF EXISTS cron_run_insert_fail');
        self::$capsule->getConnection()->statement("
            CREATE TRIGGER cron_run_insert_fail
            BEFORE INSERT ON cron_runs
            WHEN NEW.task_key = '" . CronSchedulerService::TASK_SUPPORT_SLA_SWEEP . "'
            BEGIN
                SELECT RAISE(FAIL, 'cron run insert failed');
            END;
        ");

        $Silian_service = new CronSchedulerService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $this->createMock(ErrorLogService::class),
            $Silian_support,
            $this->createMock(BadgeService::class),
            $this->createMock(LeaderboardService::class),
            $this->createMock(StreakLeaderboardService::class)
        );

        $Silian_result = $Silian_service->runTaskNow(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'admin_manual', ['request_id' => 'req-9']);

        $this->assertSame('success', $Silian_result['status']);
        $this->assertNull($Silian_result['run_id']);
        $this->assertSame('success', CronTask::query()->where('task_key', CronSchedulerService::TASK_SUPPORT_SLA_SWEEP)->value('last_status'));

        self::$capsule->getConnection()->statement('DROP TRIGGER IF EXISTS cron_run_insert_fail');
    }

    public function testFailureExceptionLoggingFailureDoesNotAbortBatch(): void
    {
        $this->seedTask(CronSchedulerService::TASK_BADGE_AUTO_AWARD, 'Badge Auto Award', 5, true, $this->now());

        $Silian_badge = $this->createMock(BadgeService::class);
        $Silian_badge->expects($this->once())->method('runAutoGrant')->willThrowException(new \RuntimeException('badge_failed'));

        $Silian_errorLogService = $this->createMock(ErrorLogService::class);
        $Silian_errorLogService->expects($this->once())->method('logException')->willThrowException(new \RuntimeException('error log failed'));

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_logger->expects($this->atLeastOnce())->method('warning');

        $Silian_service = new CronSchedulerService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $this->createMock(AuditLogService::class),
            $Silian_errorLogService,
            $this->createMock(SupportRoutingEngineService::class),
            $Silian_badge,
            $this->createMock(LeaderboardService::class),
            $this->createMock(StreakLeaderboardService::class)
        );

        $Silian_result = $Silian_service->runDueTasks('cron_endpoint', ['request_id' => 'req-14']);

        $this->assertCount(1, $Silian_result['failed']);
        $this->assertSame('failed', $Silian_result['failed'][0]['status']);
    }

    public function testFailedRunHistoryPersistenceFailureDoesNotAbortBatch(): void
    {
        $this->seedTask(CronSchedulerService::TASK_BADGE_AUTO_AWARD, 'Badge Auto Award', 5, true, $this->now());

        $Silian_badge = $this->createMock(BadgeService::class);
        $Silian_badge->expects($this->once())->method('runAutoGrant')->willThrowException(new \RuntimeException('badge_failed'));

        self::$capsule->getConnection()->statement('DROP TRIGGER IF EXISTS cron_run_insert_fail_failed');
        self::$capsule->getConnection()->statement("
            CREATE TRIGGER cron_run_insert_fail_failed
            BEFORE INSERT ON cron_runs
            WHEN NEW.task_key = '" . CronSchedulerService::TASK_BADGE_AUTO_AWARD . "'
            BEGIN
                SELECT RAISE(FAIL, 'cron failed run insert failed');
            END;
        ");

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_logger->expects($this->atLeastOnce())->method('warning');

        $Silian_service = new CronSchedulerService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            $this->createMock(SupportRoutingEngineService::class),
            $Silian_badge,
            $this->createMock(LeaderboardService::class),
            $this->createMock(StreakLeaderboardService::class)
        );

        $Silian_result = $Silian_service->runDueTasks('cron_endpoint', ['request_id' => 'req-10']);

        $this->assertCount(1, $Silian_result['failed']);
        $this->assertNull($Silian_result['failed'][0]['run_id']);
        self::$capsule->getConnection()->statement('DROP TRIGGER IF EXISTS cron_run_insert_fail_failed');
    }

    public function testSkippedRunPersistenceFailureDoesNotAbortBatch(): void
    {
        $Silian_now = $this->now();
        $this->seedTask(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'Support SLA Sweep', 1, true, $Silian_now, [
            'lock_token' => 'existing-lock',
            'locked_at' => $Silian_now,
        ]);

        self::$capsule->getConnection()->statement('DROP TRIGGER IF EXISTS cron_run_insert_fail_skipped');
        self::$capsule->getConnection()->statement("
            CREATE TRIGGER cron_run_insert_fail_skipped
            BEFORE INSERT ON cron_runs
            WHEN NEW.task_key = '" . CronSchedulerService::TASK_SUPPORT_SLA_SWEEP . "'
            BEGIN
                SELECT RAISE(FAIL, 'cron skipped run insert failed');
            END;
        ");

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_logger->expects($this->atLeastOnce())->method('warning');

        $Silian_service = new CronSchedulerService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            $this->createMock(SupportRoutingEngineService::class),
            $this->createMock(BadgeService::class),
            $this->createMock(LeaderboardService::class),
            $this->createMock(StreakLeaderboardService::class)
        );

        $Silian_result = $Silian_service->runDueTasks('cron_endpoint', ['request_id' => 'req-11']);

        $this->assertCount(1, $Silian_result['skipped']);
        $this->assertNull($Silian_result['skipped'][0]['run_id']);
        self::$capsule->getConnection()->statement('DROP TRIGGER IF EXISTS cron_run_insert_fail_skipped');
    }

    public function testBatchAuditFailureDoesNotAbortRunDueTasks(): void
    {
        $this->seedTask(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'Support SLA Sweep', 1, true, $this->now());

        $Silian_support = $this->createMock(SupportRoutingEngineService::class);
        $Silian_support->expects($this->once())->method('runSlaSweep')->willReturn(['processed' => 1, 'breached' => 0, 'rerouted' => 0]);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->method('logSystemEvent')->willReturnCallback(function (string $Silian_action) {
            if ($Silian_action === 'cron_scheduler_batch_completed') {
                throw new \RuntimeException('batch_audit_failed');
            }
            return true;
        });

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_logger->expects($this->once())->method('warning');

        $Silian_service = new CronSchedulerService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $this->createMock(ErrorLogService::class),
            $Silian_support,
            $this->createMock(BadgeService::class),
            $this->createMock(LeaderboardService::class),
            $this->createMock(StreakLeaderboardService::class)
        );

        $Silian_result = $Silian_service->runDueTasks('cron_endpoint', ['request_id' => 'req-12']);

        $this->assertCount(1, $Silian_result['executed']);
    }

    public function testStaleCompletionIsRecordedAsFailureInsteadOfSuccess(): void
    {
        $this->seedTask(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'Support SLA Sweep', 1, true, $this->now());

        $Silian_support = $this->createMock(SupportRoutingEngineService::class);
        $Silian_support->expects($this->once())->method('runSlaSweep')->willReturnCallback(function (): array {
            CronTask::query()
                ->where('task_key', CronSchedulerService::TASK_SUPPORT_SLA_SWEEP)
                ->update([
                    'lock_token' => 'stolen-lock',
                    'locked_at' => $this->now(),
                    'updated_at' => $this->now(),
                ]);

            return ['processed' => 1, 'breached' => 0, 'rerouted' => 0];
        });

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_logger->expects($this->atLeastOnce())->method('warning');

        $Silian_service = new CronSchedulerService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            $Silian_support,
            $this->createMock(BadgeService::class),
            $this->createMock(LeaderboardService::class),
            $this->createMock(StreakLeaderboardService::class)
        );

        $Silian_result = $Silian_service->runTaskNow(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'admin_manual', ['request_id' => 'req-stale-1']);

        $this->assertSame('failed', $Silian_result['status']);
        $this->assertSame('task_lock_lost', $Silian_result['error_message']);
        $this->assertSame('failed', CronRun::query()->where('task_key', CronSchedulerService::TASK_SUPPORT_SLA_SWEEP)->value('status'));
    }

    private function seedTask(string $Silian_taskKey, string $Silian_taskName, int $Silian_intervalMinutes, bool $Silian_enabled, ?string $Silian_nextRunAt, array $Silian_overrides = []): void
    {
        CronTask::query()->create(array_merge([
            'task_key' => $Silian_taskKey,
            'task_name' => $Silian_taskName,
            'description' => $Silian_taskName,
            'interval_minutes' => $Silian_intervalMinutes,
            'enabled' => $Silian_enabled,
            'next_run_at' => $Silian_nextRunAt,
            'last_status' => 'idle',
            'consecutive_failures' => 0,
            'settings_json' => '{}',
            'created_at' => $this->now(),
            'updated_at' => $this->now(),
        ], $Silian_overrides));
    }

    private function now(): string
    {
        return (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Shanghai')))->format('Y-m-d H:i:s');
    }

    private function makeService(
        SupportRoutingEngineService $Silian_support,
        BadgeService $Silian_badge,
        LeaderboardService $Silian_leaderboard,
        StreakLeaderboardService $Silian_streak
    ): CronSchedulerService {
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->method('logSystemEvent')->willReturn(true);

        return new CronSchedulerService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $Silian_audit,
            $this->createMock(ErrorLogService::class),
            $Silian_support,
            $Silian_badge,
            $Silian_leaderboard,
            $Silian_streak
        );
    }
}
