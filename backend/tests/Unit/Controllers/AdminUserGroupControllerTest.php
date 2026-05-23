<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use CarbonTrack\Controllers\AdminUserGroupController;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\UserGroupService;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Response;

class AdminUserGroupControllerTest extends TestCase
{
    public function testMetaReturnsQuotaDefinitions(): void
    {
        $Silian_service = $this->createMock(UserGroupService::class);
        $Silian_auditLogService = $this->createMock(AuditLogService::class);
        $Silian_errorLogService = $this->createMock(ErrorLogService::class);

        $Silian_service->method('getQuotaDefinitions')->willReturn(['llm.daily_limit', 'llm.rate_limit']);
        $Silian_service->method('getSupportRoutingFieldDefinitions')->willReturn([
            ['key' => 'first_response_minutes', 'type' => 'number'],
        ]);
        $Silian_service->method('getSupportRoutingDefaults')->willReturn([
            'first_response_minutes' => 240,
        ]);
        $Silian_auditLogService->expects($this->once())->method('logAdminOperation')->willReturn(true);

        $Silian_controller = new AdminUserGroupController($Silian_service, $Silian_auditLogService, $Silian_errorLogService);
        $Silian_request = makeRequest('GET', '/admin/users/groups/meta')->withAttribute('user_id', 1);
        $Silian_response = new Response();

        $Silian_result = $Silian_controller->meta($Silian_request, $Silian_response);

        $this->assertSame(200, $Silian_result->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_result->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame(['llm.daily_limit', 'llm.rate_limit'], $Silian_payload['data']['quota_definitions']);
        $this->assertSame('first_response_minutes', $Silian_payload['data']['support_routing_fields'][0]['key']);
        $this->assertSame(240, $Silian_payload['data']['support_routing_defaults']['first_response_minutes']);
    }
}
