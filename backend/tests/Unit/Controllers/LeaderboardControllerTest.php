<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use CarbonTrack\Controllers\LeaderboardController;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\CronSchedulerService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\LeaderboardService;
use Monolog\Handler\NullHandler;
use Monolog\Logger;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Response;

class LeaderboardControllerTest extends TestCase
{
    public function testTriggerRefreshWritesAuditLog(): void
    {
        $_ENV['LEADERBOARD_TRIGGER_KEY'] = 'secret-key';

        $Silian_leaderboardService = $this->createMock(LeaderboardService::class);
        $Silian_leaderboardService->expects($this->once())
            ->method('rebuildCache')
            ->with('manual-trigger')
            ->willReturn([
                'generated_at' => '2026-03-07T00:00:00Z',
                'expires_at' => '2026-03-07T01:00:00Z',
                'global' => [1, 2],
                'regions' => [1],
                'schools' => [1, 2, 3],
            ]);

        $Silian_auditLogService = $this->createMock(AuditLogService::class);
        $Silian_auditLogService->expects($this->once())->method('logSystemEvent')->willReturn(true);

        $Silian_logger = new Logger('test');
        $Silian_logger->pushHandler(new NullHandler());

        $Silian_controller = new LeaderboardController(
            $Silian_leaderboardService,
            $Silian_logger,
            $Silian_auditLogService,
            $this->createMock(ErrorLogService::class)
        );

        $Silian_request = makeRequest('GET', '/leaderboard/trigger', null, ['key' => 'secret-key'])
            ->withAttribute('request_id', 'req-1');
        $Silian_response = $Silian_controller->triggerRefresh($Silian_request, new Response());

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame(2, $Silian_payload['data']['global_count']);
    }

    public function testTriggerRefreshUsesSchedulerWhenAvailable(): void
    {
        $_ENV['LEADERBOARD_TRIGGER_KEY'] = 'secret-key';

        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->once())
            ->method('runTaskNow')
            ->with(CronSchedulerService::TASK_LEADERBOARD_REFRESH, 'legacy_endpoint', $this->arrayHasKey('request_id'))
            ->willReturn([
                'task_key' => CronSchedulerService::TASK_LEADERBOARD_REFRESH,
                'status' => 'success',
                'result' => [
                    'generated_at' => '2026-03-07T00:00:00Z',
                    'expires_at' => '2026-03-07T01:00:00Z',
                    'global_count' => 4,
                    'regions_count' => 2,
                    'schools_count' => 3,
                ],
            ]);

        $Silian_auditLogService = $this->createMock(AuditLogService::class);
        $Silian_auditLogService->expects($this->once())->method('logSystemEvent')->willReturn(true);

        $Silian_logger = new Logger('test');
        $Silian_logger->pushHandler(new NullHandler());

        $Silian_controller = new LeaderboardController(
            $this->createMock(LeaderboardService::class),
            $Silian_logger,
            $Silian_auditLogService,
            $this->createMock(ErrorLogService::class),
            $Silian_scheduler
        );

        $Silian_request = makeRequest('GET', '/leaderboard/trigger', null, ['key' => 'secret-key'])
            ->withAttribute('request_id', 'req-2');
        $Silian_response = $Silian_controller->triggerRefresh($Silian_request, new Response());

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertSame(4, $Silian_payload['data']['global_count']);
    }

    public function testTriggerRefreshReturnsFailureWhenSchedulerRunFails(): void
    {
        $_ENV['LEADERBOARD_TRIGGER_KEY'] = 'secret-key';

        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->once())
            ->method('runTaskNow')
            ->willReturn([
                'task_key' => CronSchedulerService::TASK_LEADERBOARD_REFRESH,
                'status' => 'failed',
                'error_message' => 'refresh_failed',
                'result' => [],
            ]);

        $Silian_auditLogService = $this->createMock(AuditLogService::class);
        $Silian_auditLogService->expects($this->once())->method('logSystemEvent')->willReturn(true);

        $Silian_logger = new Logger('test');
        $Silian_logger->pushHandler(new NullHandler());

        $Silian_controller = new LeaderboardController(
            $this->createMock(LeaderboardService::class),
            $Silian_logger,
            $Silian_auditLogService,
            $this->createMock(ErrorLogService::class),
            $Silian_scheduler
        );

        $Silian_request = makeRequest('GET', '/leaderboard/trigger', null, ['key' => 'secret-key'])
            ->withAttribute('request_id', 'req-3');
        $Silian_response = $Silian_controller->triggerRefresh($Silian_request, new Response());

        $this->assertSame(503, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
    }
}
