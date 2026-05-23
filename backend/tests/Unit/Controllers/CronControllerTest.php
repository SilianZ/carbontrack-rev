<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use CarbonTrack\Controllers\CronController;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\CronSchedulerService;
use CarbonTrack\Services\ErrorLogService;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

class CronControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        unset($_ENV['CRON_RUN_KEY']);
    }

    public function testRunReturnsServiceUnavailableWhenCronKeyIsMissing(): void
    {
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())->method('logSystemEvent')->willReturn(true);

        $Silian_controller = new CronController(
            $this->createMock(CronSchedulerService::class),
            $this->createMock(LoggerInterface::class),
            $this->createMock(ErrorLogService::class),
            $Silian_audit
        );

        $Silian_response = $Silian_controller->run(
            makeRequest('POST', '/api/v1/cron/run'),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(503, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertSame('CRON_UNAVAILABLE', $Silian_payload['code']);
        $this->assertArrayHasKey('request_id', $Silian_payload);
        $this->assertSame('no-store, no-cache, max-age=0, must-revalidate', $Silian_response->getHeaderLine('Cache-Control'));
    }

    public function testRunReturnsForbiddenForInvalidKey(): void
    {
        $_ENV['CRON_RUN_KEY'] = 'expected-secret';

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())->method('logSystemEvent')->willReturn(true);

        $Silian_controller = new CronController(
            $this->createMock(CronSchedulerService::class),
            $this->createMock(LoggerInterface::class),
            $this->createMock(ErrorLogService::class),
            $Silian_audit
        );

        $Silian_response = $Silian_controller->run(
            makeRequest('POST', '/api/v1/cron/run', ['key' => 'bad']),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(403, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertArrayHasKey('request_id', $Silian_payload);
    }

    public function testRunStillReturnsForbiddenWhenAuditLogFails(): void
    {
        $_ENV['CRON_RUN_KEY'] = 'expected-secret';

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('logSystemEvent')
            ->willThrowException(new \RuntimeException('audit down'));

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_logger->expects($this->once())->method('warning');

        $Silian_controller = new CronController(
            $this->createMock(CronSchedulerService::class),
            $Silian_logger,
            $this->createMock(ErrorLogService::class),
            $Silian_audit
        );

        $Silian_response = $Silian_controller->run(
            makeRequest('POST', '/api/v1/cron/run', ['key' => 'bad']),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(403, $Silian_response->getStatusCode());
    }

    public function testRunReturnsSchedulerSummaryForValidKey(): void
    {
        $_ENV['CRON_RUN_KEY'] = 'expected-secret';

        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->once())
            ->method('runDueTasks')
            ->with('cron_endpoint', $this->arrayHasKey('request_id'))
            ->willReturn([
                'triggered_at' => '2026-04-10 12:00:00',
                'due' => ['support_sla_sweep'],
                'executed' => [['task_key' => 'support_sla_sweep', 'status' => 'success']],
                'failed' => [],
                'skipped' => [],
            ]);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())->method('logSystemEvent')->willReturn(true);

        $Silian_controller = new CronController(
            $Silian_scheduler,
            $this->createMock(LoggerInterface::class),
            $this->createMock(ErrorLogService::class),
            $Silian_audit
        );

        $Silian_response = $Silian_controller->run(
            makeRequest('POST', '/api/v1/cron/run', ['key' => 'expected-secret']),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
    }

    public function testRunReturnsFailureWhenDueTaskFails(): void
    {
        $_ENV['CRON_RUN_KEY'] = 'expected-secret';

        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->once())
            ->method('runDueTasks')
            ->willReturn([
                'triggered_at' => '2026-04-10 12:00:00',
                'due' => ['support_sla_sweep'],
                'executed' => [],
                'failed' => [['task_key' => 'support_sla_sweep', 'status' => 'failed']],
                'skipped' => [],
            ]);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())->method('logSystemEvent')->willReturn(true);

        $Silian_controller = new CronController(
            $Silian_scheduler,
            $this->createMock(LoggerInterface::class),
            $this->createMock(ErrorLogService::class),
            $Silian_audit
        );

        $Silian_response = $Silian_controller->run(
            makeRequest('POST', '/api/v1/cron/run', ['key' => 'expected-secret']),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(503, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
    }

    public function testRunReturnsConflictWhenAllDueTasksAreSkipped(): void
    {
        $_ENV['CRON_RUN_KEY'] = 'expected-secret';

        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->once())
            ->method('runDueTasks')
            ->willReturn([
                'triggered_at' => '2026-04-10 12:00:00',
                'due' => ['support_sla_sweep'],
                'executed' => [],
                'failed' => [],
                'skipped' => [['task_key' => 'support_sla_sweep', 'status' => 'skipped']],
            ]);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())->method('logSystemEvent')->willReturn(true);

        $Silian_controller = new CronController(
            $Silian_scheduler,
            $this->createMock(LoggerInterface::class),
            $this->createMock(ErrorLogService::class),
            $Silian_audit
        );

        $Silian_response = $Silian_controller->run(
            makeRequest('POST', '/api/v1/cron/run', ['key' => 'expected-secret']),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(409, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
    }

    public function testRunReturnsConflictWhenBatchIsPartiallySkipped(): void
    {
        $_ENV['CRON_RUN_KEY'] = 'expected-secret';

        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->once())
            ->method('runDueTasks')
            ->willReturn([
                'triggered_at' => '2026-04-10 12:00:00',
                'due' => ['support_sla_sweep', 'leaderboard_refresh'],
                'executed' => [['task_key' => 'leaderboard_refresh', 'status' => 'success']],
                'failed' => [],
                'skipped' => [['task_key' => 'support_sla_sweep', 'status' => 'skipped']],
            ]);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('logSystemEvent')
            ->with(
                'cron_run_endpoint_triggered',
                'cron_scheduler',
                $this->callback(static function (array $Silian_context): bool {
                    return ($Silian_context['status'] ?? null) === 'failed';
                })
            )
            ->willReturn(true);

        $Silian_controller = new CronController(
            $Silian_scheduler,
            $this->createMock(LoggerInterface::class),
            $this->createMock(ErrorLogService::class),
            $Silian_audit
        );

        $Silian_response = $Silian_controller->run(
            makeRequest('POST', '/api/v1/cron/run', ['key' => 'expected-secret']),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(409, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
    }

    public function testJsonFallsBackWhenPayloadCannotBeEncoded(): void
    {
        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_logger->expects($this->once())->method('error');

        $Silian_controller = new CronController(
            $this->createMock(CronSchedulerService::class),
            $Silian_logger,
            $this->createMock(ErrorLogService::class),
            $this->createMock(AuditLogService::class)
        );

        $Silian_method = new \ReflectionMethod($Silian_controller, 'json');
        $Silian_method->setAccessible(true);

        $Silian_request = makeRequest('POST', '/api/v1/cron/run');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_invalidPayload = ['message' => "\xB1\x31"];

        $Silian_result = $Silian_method->invoke($Silian_controller, $Silian_request, $Silian_response, $Silian_invalidPayload, 500);
        $Silian_payload = json_decode((string) $Silian_result->getBody(), true, 512, JSON_THROW_ON_ERROR);

        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('INTERNAL_ERROR', $Silian_payload['code']);
    }
}
