<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use CarbonTrack\Controllers\AdminSupportController;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\SupportRoutingEngineService;
use CarbonTrack\Services\SupportAutomationService;
use CarbonTrack\Services\SupportTicketService;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

class AdminSupportControllerTest extends TestCase
{
    private function makeController(
        ?SupportAutomationService $Silian_automationService = null,
        ?AuthService $Silian_authService = null,
        ?SupportTicketService $Silian_ticketService = null,
        ?SupportRoutingEngineService $Silian_routingEngineService = null,
        ?AuditLogService $Silian_auditLogService = null,
        ?ErrorLogService $Silian_errorLogService = null
    ): AdminSupportController {
        return new AdminSupportController(
            $Silian_automationService ?? $this->createMock(SupportAutomationService::class),
            $Silian_ticketService ?? $this->createMock(SupportTicketService::class),
            $Silian_routingEngineService ?? $this->createMock(SupportRoutingEngineService::class),
            $Silian_authService ?? $this->createMock(AuthService::class),
            $Silian_auditLogService ?? $this->createMock(AuditLogService::class),
            $this->createMock(LoggerInterface::class),
            $Silian_errorLogService ?? $this->createMock(ErrorLogService::class)
        );
    }

    public function testCreateTagReturnsCreatedPayload(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => true, 'role' => 'admin']);

        $Silian_service = $this->createMock(SupportAutomationService::class);
        $Silian_service->expects($this->once())
            ->method('saveTag')
            ->with(['id' => 1, 'is_admin' => true, 'role' => 'admin'], ['name' => 'Urgent'], null)
            ->willReturn(['id' => 8, 'name' => 'Urgent', 'slug' => 'urgent']);

        $Silian_controller = $this->makeController($Silian_service, $Silian_auth);
        $Silian_response = $Silian_controller->createTag(
            makeRequest('POST', '/api/v1/admin/support/tags', ['name' => 'Urgent']),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(201, $Silian_response->getStatusCode());
    }

    public function testUpdateTagReturnsValidationErrorForInvalidId(): void
    {
        $Silian_controller = $this->makeController();
        $Silian_response = $Silian_controller->updateTag(
            makeRequest('PUT', '/api/v1/admin/support/tags/0', ['name' => 'Urgent']),
            new \Slim\Psr7\Response(),
            ['id' => '0']
        );

        $this->assertSame(422, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('VALIDATION_ERROR', $Silian_payload['code']);
    }

    public function testReportsReturnsValidationError(): void
    {
        $Silian_service = $this->createMock(SupportAutomationService::class);
        $Silian_service->expects($this->once())
            ->method('getReports')
            ->willThrowException(new \InvalidArgumentException('Invalid days'));

        $Silian_controller = $this->makeController($Silian_service);
        $Silian_response = $Silian_controller->reports(
            makeRequest('GET', '/api/v1/admin/support/reports?days=999'),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(422, $Silian_response->getStatusCode());
    }

    public function testGetAssigneeDetailReturnsNotFound(): void
    {
        $Silian_service = $this->createMock(SupportAutomationService::class);
        $Silian_service->expects($this->once())
            ->method('getAssignableUserDetail')
            ->with(42)
            ->willReturn(null);

        $Silian_controller = $this->makeController($Silian_service);
        $Silian_response = $Silian_controller->getAssigneeDetail(
            makeRequest('GET', '/api/v1/admin/support/assignees/42'),
            new \Slim\Psr7\Response(),
            ['id' => '42']
        );

        $this->assertSame(404, $Silian_response->getStatusCode());
    }

    public function testUpdateRoutingSettingsReturnsPayload(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => true, 'role' => 'admin']);

        $Silian_service = $this->createMock(SupportAutomationService::class);
        $Silian_service->expects($this->once())
            ->method('saveRoutingSettings')
            ->with(['id' => 1, 'is_admin' => true, 'role' => 'admin'], ['ai_enabled' => true])
            ->willReturn(['id' => 1, 'ai_enabled' => true]);

        $Silian_controller = $this->makeController($Silian_service, $Silian_auth);
        $Silian_response = $Silian_controller->updateRoutingSettings(
            makeRequest('PUT', '/api/v1/admin/support/routing-settings', ['ai_enabled' => true]),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
    }

    public function testUpdateAssigneeRoutingProfileReturnsNotFound(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => true, 'role' => 'admin']);

        $Silian_service = $this->createMock(SupportAutomationService::class);
        $Silian_service->expects($this->once())
            ->method('saveAssigneeRoutingProfile')
            ->willThrowException(new \RuntimeException('Support assignee not found'));

        $Silian_controller = $this->makeController($Silian_service, $Silian_auth);
        $Silian_response = $Silian_controller->updateAssigneeRoutingProfile(
            makeRequest('PUT', '/api/v1/admin/support/assignees/42/routing-profile', ['level' => 3]),
            new \Slim\Psr7\Response(),
            ['id' => '42']
        );

        $this->assertSame(404, $Silian_response->getStatusCode());
    }

    public function testUpdateRuleReturnsValidationErrorForInvalidId(): void
    {
        $Silian_controller = $this->makeController();
        $Silian_response = $Silian_controller->updateRule(
            makeRequest('PUT', '/api/v1/admin/support/rules/0', ['name' => 'Rule']),
            new \Slim\Psr7\Response(),
            ['id' => '0']
        );

        $this->assertSame(422, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('VALIDATION_ERROR', $Silian_payload['code']);
    }

    public function testListTicketsReturnsQueuePayload(): void
    {
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())->method('logAdminOperation');
        $Silian_ticketService = $this->createMock(SupportTicketService::class);
        $Silian_ticketService->expects($this->once())
            ->method('listSupportTickets')
            ->with([], [])
            ->willReturn(['items' => [['id' => 7]], 'pagination' => ['page' => 1, 'limit' => 20, 'total' => 1]]);

        $Silian_controller = $this->makeController(Silian_ticketService: $Silian_ticketService, Silian_auditLogService: $Silian_audit);
        $Silian_response = $Silian_controller->listTickets(
            makeRequest('GET', '/api/v1/admin/support/tickets'),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
    }

    public function testListTicketsReturnsValidationErrorForInvalidFilters(): void
    {
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())->method('logAdminOperation');

        $Silian_ticketService = $this->createMock(SupportTicketService::class);
        $Silian_ticketService->expects($this->once())
            ->method('listSupportTickets')
            ->with([], ['status' => 'bad'])
            ->willThrowException(new \InvalidArgumentException('Invalid status'));

        $Silian_controller = $this->makeController(Silian_ticketService: $Silian_ticketService, Silian_auditLogService: $Silian_audit);
        $Silian_response = $Silian_controller->listTickets(
            makeRequest('GET', '/api/v1/admin/support/tickets?status=bad', [], ['status' => 'bad']),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(422, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('VALIDATION_ERROR', $Silian_payload['code']);
        $this->assertSame('Invalid status', $Silian_payload['message']);
    }

    public function testGetTicketDetailIncludesRoutingRuns(): void
    {
        $_ENV['SUPPORT_ROUTING_AUDIT_LIMIT'] = '4';
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())->method('logAdminOperation');

        $Silian_ticketService = $this->createMock(SupportTicketService::class);
        $Silian_ticketService->expects($this->once())
            ->method('getTicketDetailForSupport')
            ->with([], 12)
            ->willReturn(['id' => 12, 'subject' => 'Test']);

        $Silian_routingEngine = $this->createMock(SupportRoutingEngineService::class);
        $Silian_routingEngine->expects($this->once())
            ->method('getRoutingRunsForTicket')
            ->with(12, 4)
            ->willReturn([['id' => 90, 'trigger' => 'created']]);

        $Silian_controller = $this->makeController(
            Silian_ticketService: $Silian_ticketService,
            Silian_routingEngineService: $Silian_routingEngine,
            Silian_auditLogService: $Silian_audit
        );

        $Silian_response = $Silian_controller->getTicketDetail(
            makeRequest('GET', '/api/v1/admin/support/tickets/12'),
            new \Slim\Psr7\Response(),
            ['id' => '12']
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertSame(90, $Silian_payload['data']['routing_runs'][0]['id']);
    }

    public function testUpdateTicketReturnsUpdatedPayload(): void
    {
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())->method('logAdminOperation');

        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => true, 'role' => 'admin']);

        $Silian_ticketService = $this->createMock(SupportTicketService::class);
        $Silian_ticketService->expects($this->once())
            ->method('updateTicketFromSupport')
            ->with(['id' => 1, 'is_admin' => true, 'role' => 'admin'], 12, ['status' => 'resolved'])
            ->willReturn(['id' => 12, 'status' => 'resolved']);

        $Silian_controller = $this->makeController(
            Silian_authService: $Silian_auth,
            Silian_ticketService: $Silian_ticketService,
            Silian_auditLogService: $Silian_audit
        );

        $Silian_response = $Silian_controller->updateTicket(
            makeRequest('PATCH', '/api/v1/admin/support/tickets/12', ['status' => 'resolved']),
            new \Slim\Psr7\Response(),
            ['id' => '12']
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('resolved', $Silian_payload['data']['status']);
    }

    public function testUpdateTicketValidationErrorLogsAuditFailure(): void
    {
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('logAdminOperation')
            ->with(
                'admin_support_ticket_update_failed',
                1,
                'admin_support',
                $this->callback(static function (array $Silian_context): bool {
                    return ($Silian_context['table'] ?? null) === 'support_tickets'
                        && ($Silian_context['record_id'] ?? null) === 12
                        && ($Silian_context['status'] ?? null) === 'failed'
                        && ($Silian_context['data']['error'] ?? null) === 'Invalid status';
                })
            );

        $Silian_errorLog = $this->createMock(ErrorLogService::class);
        $Silian_errorLog->expects($this->once())->method('logException');

        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => true, 'role' => 'admin']);

        $Silian_ticketService = $this->createMock(SupportTicketService::class);
        $Silian_ticketService->expects($this->once())
            ->method('updateTicketFromSupport')
            ->with(['id' => 1, 'is_admin' => true, 'role' => 'admin'], 12, ['status' => 'bad'])
            ->willThrowException(new \InvalidArgumentException('Invalid status'));

        $Silian_controller = $this->makeController(
            Silian_authService: $Silian_auth,
            Silian_ticketService: $Silian_ticketService,
            Silian_auditLogService: $Silian_audit,
            Silian_errorLogService: $Silian_errorLog
        );

        $Silian_response = $Silian_controller->updateTicket(
            makeRequest('PATCH', '/api/v1/admin/support/tickets/12', ['status' => 'bad']),
            new \Slim\Psr7\Response(),
            ['id' => '12']
        );

        $this->assertSame(422, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('VALIDATION_ERROR', $Silian_payload['code']);
    }

}
