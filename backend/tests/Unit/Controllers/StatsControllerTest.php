<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use CarbonTrack\Controllers\StatsController;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\StatisticsService;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Response;

class StatsControllerTest extends TestCase
{
    public function testGetPublicSummaryWritesAuditLog(): void
    {
        $Silian_statisticsService = $this->createMock(StatisticsService::class);
        $Silian_statisticsService->expects($this->once())
            ->method('getPublicStats')
            ->with(false)
            ->willReturn([
                'total_users' => 12,
                'total_checkins' => 34,
            ]);

        $Silian_auditLogService = $this->createMock(AuditLogService::class);
        $Silian_auditLogService->expects($this->once())->method('logSystemEvent')->willReturn(true);

        $Silian_controller = new StatsController(
            $Silian_statisticsService,
            $Silian_auditLogService,
            $this->createMock(ErrorLogService::class)
        );

        $Silian_request = makeRequest('GET', '/stats/summary')->withAttribute('request_id', 'req-stats');
        $Silian_response = $Silian_controller->getPublicSummary($Silian_request, new Response());

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame(12, $Silian_payload['data']['total_users']);
    }
}