<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use CarbonTrack\Controllers\AdminCronController;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\CronSchedulerService;
use CarbonTrack\Services\ErrorLogService;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

class AdminCronControllerTest extends TestCase
{
    private function makeController(
        ?CronSchedulerService $Silian_scheduler = null,
        ?AuthService $Silian_authService = null,
        ?AuditLogService $Silian_audit = null
    ): AdminCronController {
        return new AdminCronController(
            $Silian_scheduler ?? $this->createMock(CronSchedulerService::class),
            $Silian_authService ?? $this->createMock(AuthService::class),
            $Silian_audit ?? $this->createMock(AuditLogService::class),
            $this->createMock(LoggerInterface::class),
            $this->createMock(ErrorLogService::class)
        );
    }

    public function testListTasksReturnsPayload(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin', 'is_admin' => true]);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())->method('logAdminOperation');

        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->once())
            ->method('listTasks')
            ->willReturn([['task_key' => 'support_sla_sweep']]);

        $Silian_controller = $this->makeController($Silian_scheduler, $Silian_auth, $Silian_audit);
        $Silian_response = $Silian_controller->listTasks(
            makeRequest('GET', '/api/v1/admin/cron/tasks'),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
    }

    public function testUpdateTaskReturnsValidationError(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin', 'is_admin' => true]);

        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->once())
            ->method('updateTask')
            ->with('support_sla_sweep', ['interval_minutes' => 0])
            ->willThrowException(new \InvalidArgumentException('interval_minutes must be between 1 and 1440'));

        $Silian_controller = $this->makeController($Silian_scheduler, $Silian_auth, $this->createMock(AuditLogService::class));
        $Silian_response = $Silian_controller->updateTask(
            makeRequest('PUT', '/api/v1/admin/cron/tasks/support_sla_sweep', ['interval_minutes' => 0]),
            new \Slim\Psr7\Response(),
            ['taskKey' => 'support_sla_sweep']
        );

        $this->assertSame(422, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertArrayHasKey('request_id', $Silian_payload);
    }

    public function testUpdateTaskReturnsNotFoundForUnknownTask(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin', 'is_admin' => true]);

        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->once())
            ->method('updateTask')
            ->with('missing_task', [])
            ->willThrowException(new \RuntimeException('Cron task not found'));

        $Silian_controller = $this->makeController($Silian_scheduler, $Silian_auth, $this->createMock(AuditLogService::class));
        $Silian_response = $Silian_controller->updateTask(
            makeRequest('PUT', '/api/v1/admin/cron/tasks/missing_task', []),
            new \Slim\Psr7\Response(),
            ['taskKey' => 'missing_task']
        );

        $this->assertSame(404, $Silian_response->getStatusCode());
    }

    public function testListRunsReturnsPayload(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin', 'is_admin' => true]);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())->method('logAdminOperation');

        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->once())
            ->method('listRuns')
            ->with([])
            ->willReturn(['items' => [['id' => 1]], 'pagination' => ['page' => 1, 'limit' => 20, 'total' => 1]]);

        $Silian_controller = $this->makeController($Silian_scheduler, $Silian_auth, $Silian_audit);
        $Silian_response = $Silian_controller->listRuns(
            makeRequest('GET', '/api/v1/admin/cron/runs'),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
    }

    public function testRunTaskReturnsPayload(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin', 'is_admin' => true]);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())->method('logAdminOperation');

        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->once())
            ->method('runTaskNow')
            ->with('support_sla_sweep', 'admin_manual', $this->arrayHasKey('request_id'))
            ->willReturn(['task_key' => 'support_sla_sweep', 'status' => 'success']);

        $Silian_controller = $this->makeController($Silian_scheduler, $Silian_auth, $Silian_audit);
        $Silian_response = $Silian_controller->runTask(
            makeRequest('POST', '/api/v1/admin/cron/tasks/support_sla_sweep/run'),
            new \Slim\Psr7\Response(),
            ['taskKey' => 'support_sla_sweep']
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
    }

    public function testRunTaskReturnsFailureWhenTaskRunFails(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin', 'is_admin' => true]);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())->method('logAdminOperation');

        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->once())
            ->method('runTaskNow')
            ->willReturn([
                'task_key' => 'support_sla_sweep',
                'status' => 'failed',
                'error_message' => 'task_failed',
            ]);

        $Silian_controller = $this->makeController($Silian_scheduler, $Silian_auth, $Silian_audit);
        $Silian_response = $Silian_controller->runTask(
            makeRequest('POST', '/api/v1/admin/cron/tasks/support_sla_sweep/run'),
            new \Slim\Psr7\Response(),
            ['taskKey' => 'support_sla_sweep']
        );

        $this->assertSame(503, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
    }

    public function testRunTaskReturnsServerErrorForUnexpectedRuntimeException(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin', 'is_admin' => true]);

        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->once())
            ->method('runTaskNow')
            ->willThrowException(new \RuntimeException('database offline'));

        $Silian_controller = $this->makeController($Silian_scheduler, $Silian_auth, $this->createMock(AuditLogService::class));
        $Silian_response = $Silian_controller->runTask(
            makeRequest('POST', '/api/v1/admin/cron/tasks/support_sla_sweep/run'),
            new \Slim\Psr7\Response(),
            ['taskKey' => 'support_sla_sweep']
        );

        $this->assertSame(500, $Silian_response->getStatusCode());
    }

    public function testJsonFallsBackWhenPayloadCannotBeEncoded(): void
    {
        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_logger->expects($this->atLeastOnce())->method('error');

        $Silian_errorLogService = $this->createMock(ErrorLogService::class);
        $Silian_errorLogService->expects($this->once())->method('logException');

        $Silian_controller = new AdminCronController(
            $this->createMock(CronSchedulerService::class),
            $this->createMock(AuthService::class),
            $this->createMock(AuditLogService::class),
            $Silian_logger,
            $Silian_errorLogService
        );

        $Silian_method = new \ReflectionMethod($Silian_controller, 'json');
        $Silian_method->setAccessible(true);

        $Silian_request = makeRequest('GET', '/api/v1/admin/cron/tasks')->withAttribute('request_id', 'req-admin-cron-json');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_invalidPayload = ['message' => "\xB1\x31"];

        $Silian_result = $Silian_method->invoke($Silian_controller, $Silian_request, $Silian_response, $Silian_invalidPayload, 500);
        $Silian_payload = json_decode((string) $Silian_result->getBody(), true, 512, JSON_THROW_ON_ERROR);

        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('JSON_ENCODE_ERROR', $Silian_payload['code']);
        $this->assertSame('req-admin-cron-json', $Silian_payload['request_id']);
    }
}
