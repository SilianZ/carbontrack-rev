<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\AdminAiReadModelService;
use CarbonTrack\Services\AdminAiWriteActionService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\BadgeService;
use CarbonTrack\Services\CronSchedulerService;
use CarbonTrack\Services\MessageService;
use PHPUnit\Framework\TestCase;

class AdminAiCronActionsTest extends TestCase
{
    public function testReadModelSupportsCronTasksAndRuns(): void
    {
        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->once())
            ->method('listTasks')
            ->willReturn([['task_key' => 'support_sla_sweep']]);
        $Silian_scheduler->expects($this->once())
            ->method('listRuns')
            ->with(['task_key' => 'support_sla_sweep'])
            ->willReturn([
                'items' => [['id' => 1, 'task_key' => 'support_sla_sweep']],
                'pagination' => ['page' => 1, 'limit' => 20, 'total' => 1],
            ]);

        $Silian_service = new AdminAiReadModelService(
            new \PDO('sqlite::memory:'),
            null,
            $Silian_scheduler
        );

        $Silian_tasks = $Silian_service->execute('get_cron_tasks', []);
        $Silian_runs = $Silian_service->execute('get_cron_runs', ['task_key' => 'support_sla_sweep']);

        $this->assertSame('cron_tasks', $Silian_tasks['scope']);
        $this->assertSame('cron_runs', $Silian_runs['scope']);
        $this->assertCount(1, $Silian_tasks['items']);
        $this->assertCount(1, $Silian_runs['items']);
    }

    public function testWriteModelSupportsCronTaskUpdateAndRun(): void
    {
        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->once())
            ->method('updateTask')
            ->with('support_sla_sweep', [
                'enabled' => false,
                'interval_minutes' => 15,
                'settings' => ['notify' => true],
            ])
            ->willReturn([
                'task_key' => 'support_sla_sweep',
                'enabled' => false,
                'interval_minutes' => 15,
                'settings' => ['notify' => true],
            ]);
        $Silian_scheduler->expects($this->once())
            ->method('runTaskNow')
            ->with('support_sla_sweep', 'admin_manual', $this->arrayHasKey('request_id'))
            ->willReturn(['task_key' => 'support_sla_sweep', 'status' => 'success']);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->exactly(2))->method('logAdminOperation');

        $Silian_service = new AdminAiWriteActionService(
            new \PDO('sqlite::memory:'),
            $Silian_audit,
            $this->createMock(MessageService::class),
            $this->createMock(BadgeService::class),
            $Silian_scheduler
        );

        $Silian_updateResult = $Silian_service->execute('update_cron_task', [
            'task_key' => 'support_sla_sweep',
            'enabled' => 'false',
            'interval_minutes' => '15',
            'settings' => (object) ['notify' => true],
        ], [
            'actor_id' => 1,
            'request_id' => 'req-1',
            'conversation_id' => 'conv-1',
        ]);

        $Silian_runResult = $Silian_service->execute('run_cron_task', [
            'task_key' => 'support_sla_sweep',
        ], [
            'actor_id' => 1,
            'request_id' => 'req-2',
            'conversation_id' => 'conv-2',
        ]);

        $this->assertSame('update_cron_task', $Silian_updateResult['action']);
        $this->assertSame('run_cron_task', $Silian_runResult['action']);
        $this->assertSame('success', $Silian_runResult['task_run']['status']);
        $this->assertSame(['notify' => true], $Silian_updateResult['task']['settings']);
    }

    public function testWriteModelThrowsWhenCronRunIsNotSuccessful(): void
    {
        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->once())
            ->method('runTaskNow')
            ->willReturn([
                'task_key' => 'support_sla_sweep',
                'status' => 'failed',
                'error_message' => 'task_failed',
            ]);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())->method('logAdminOperation');

        $Silian_service = new AdminAiWriteActionService(
            new \PDO('sqlite::memory:'),
            $Silian_audit,
            $this->createMock(MessageService::class),
            $this->createMock(BadgeService::class),
            $Silian_scheduler
        );

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('task_failed');

        $Silian_service->execute('run_cron_task', [
            'task_key' => 'support_sla_sweep',
        ], [
            'actor_id' => 1,
            'request_id' => 'req-3',
            'conversation_id' => 'conv-3',
        ]);
    }

    public function testWriteModelRejectsInvalidCronTaskUpdatePayload(): void
    {
        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->never())->method('updateTask');

        $Silian_service = new AdminAiWriteActionService(
            new \PDO('sqlite::memory:'),
            $this->createMock(AuditLogService::class),
            $this->createMock(MessageService::class),
            $this->createMock(BadgeService::class),
            $Silian_scheduler
        );

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('settings must be an object or array.');

        $Silian_service->execute('update_cron_task', [
            'task_key' => 'support_sla_sweep',
            'enabled' => 'false',
            'interval_minutes' => '15',
            'settings' => 'not-an-object',
        ], [
            'actor_id' => 1,
            'request_id' => 'req-4',
            'conversation_id' => 'conv-4',
        ]);
    }

    public function testWriteModelRejectsMissingCronTaskKeyForUpdateAndRun(): void
    {
        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->never())->method('updateTask');
        $Silian_scheduler->expects($this->never())->method('runTaskNow');

        $Silian_service = new AdminAiWriteActionService(
            new \PDO('sqlite::memory:'),
            $this->createMock(AuditLogService::class),
            $this->createMock(MessageService::class),
            $this->createMock(BadgeService::class),
            $Silian_scheduler
        );

        try {
            $Silian_service->execute('update_cron_task', [], []);
            $this->fail('Expected InvalidArgumentException for missing task_key on update.');
        } catch (\InvalidArgumentException $Silian_exception) {
            $this->assertSame('task_key is required.', $Silian_exception->getMessage());
        }

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('task_key is required.');

        $Silian_service->execute('run_cron_task', [], []);
    }
}
