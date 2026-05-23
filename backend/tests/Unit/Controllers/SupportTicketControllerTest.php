<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use CarbonTrack\Controllers\SupportTicketController;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\CronSchedulerService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\SupportRoutingEngineService;
use CarbonTrack\Services\SupportTicketService;
use CarbonTrack\Services\TurnstileService;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

class SupportTicketControllerTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        unset($_ENV['SUPPORT_SLA_SWEEP_KEY']);
    }

    private function makeController(
        ?SupportTicketService $Silian_supportTicketService = null,
        ?AuthService $Silian_authService = null,
        ?TurnstileService $Silian_turnstileService = null,
        ?SupportRoutingEngineService $Silian_supportRoutingEngineService = null,
        ?AuditLogService $Silian_auditLogService = null,
        ?CronSchedulerService $Silian_cronSchedulerService = null
    ): SupportTicketController {
        return new SupportTicketController(
            $Silian_supportTicketService ?? $this->createMock(SupportTicketService::class),
            $Silian_authService ?? $this->createMock(AuthService::class),
            $Silian_turnstileService ?? $this->createMock(TurnstileService::class),
            $this->createMock(LoggerInterface::class),
            $this->createMock(ErrorLogService::class),
            $Silian_supportRoutingEngineService,
            $Silian_auditLogService,
            $Silian_cronSchedulerService
        );
    }

    public function testCreateTicketRequiresAuthentication(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(null);

        $Silian_controller = $this->makeController(Silian_authService: $Silian_auth);
        $Silian_response = $Silian_controller->createTicket(
            makeRequest('POST', '/api/v1/tickets', ['subject' => 'Need help']),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(401, $Silian_response->getStatusCode());
    }

    public function testCreateTicketRejectsFailedTurnstile(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 9, 'username' => 'user', 'email' => 'user@example.com']);

        $Silian_turnstile = $this->createMock(TurnstileService::class);
        $Silian_turnstile->expects($this->once())
            ->method('verify')
            ->with('bad-token', null)
            ->willReturn(['success' => false]);

        $Silian_controller = $this->makeController(Silian_authService: $Silian_auth, Silian_turnstileService: $Silian_turnstile);
        $Silian_response = $Silian_controller->createTicket(
            makeRequest('POST', '/api/v1/tickets', [
                'subject' => 'Broken page',
                'content' => 'Details',
                'category' => 'website_bug',
                'cf_turnstile_response' => 'bad-token',
            ]),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(403, $Silian_response->getStatusCode());
    }

    public function testGetMyTicketReturnsValidationErrorForInvalidTicketId(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 9, 'role' => 'user']);

        $Silian_service = $this->createMock(SupportTicketService::class);
        $Silian_service->expects($this->never())->method('getTicketDetailForUser');

        $Silian_controller = $this->makeController($Silian_service, $Silian_auth);
        $Silian_response = $Silian_controller->getMyTicket(
            makeRequest('GET', '/api/v1/tickets/0'),
            new \Slim\Psr7\Response(),
            ['ticketId' => '0']
        );

        $this->assertSame(422, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('VALIDATION_ERROR', $Silian_payload['code']);
        $this->assertSame('Invalid ticket id', $Silian_payload['message']);
    }

    public function testListSupportTicketsRequiresAuthentication(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(null);

        $Silian_controller = $this->makeController(Silian_authService: $Silian_auth);
        $Silian_response = $Silian_controller->listSupportTickets(
            makeRequest('GET', '/api/v1/support/tickets'),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(401, $Silian_response->getStatusCode());
    }

    public function testGetSupportTicketReturnsNotFound(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'support', 'is_support' => true]);

        $Silian_service = $this->createMock(SupportTicketService::class);
        $Silian_service->expects($this->once())
            ->method('getTicketDetailForSupport')
            ->with(['id' => 1, 'role' => 'support', 'is_support' => true], 42)
            ->willThrowException(new \RuntimeException('Ticket not found'));

        $Silian_controller = $this->makeController($Silian_service, $Silian_auth);
        $Silian_response = $Silian_controller->getSupportTicket(
            makeRequest('GET', '/api/v1/support/tickets/42'),
            new \Slim\Psr7\Response(),
            ['ticketId' => '42']
        );

        $this->assertSame(404, $Silian_response->getStatusCode());
    }

    public function testGetSupportTicketReturnsValidationErrorForInvalidId(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'support', 'is_support' => true]);

        $Silian_service = $this->createMock(SupportTicketService::class);
        $Silian_service->expects($this->never())->method('getTicketDetailForSupport');

        $Silian_controller = $this->makeController($Silian_service, $Silian_auth);
        $Silian_response = $Silian_controller->getSupportTicket(
            makeRequest('GET', '/api/v1/support/tickets/0'),
            new \Slim\Psr7\Response(),
            ['ticketId' => '0']
        );

        $this->assertSame(422, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('VALIDATION_ERROR', $Silian_payload['code']);
        $this->assertSame('Invalid ticket id', $Silian_payload['message']);
    }

    public function testUpdateSupportTicketReturnsValidationError(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 2, 'role' => 'support', 'is_support' => true]);

        $Silian_service = $this->createMock(SupportTicketService::class);
        $Silian_service->expects($this->once())
            ->method('updateTicketFromSupport')
            ->willThrowException(new \InvalidArgumentException('Invalid status'));

        $Silian_controller = $this->makeController($Silian_service, $Silian_auth);
        $Silian_response = $Silian_controller->updateSupportTicket(
            makeRequest('PATCH', '/api/v1/support/tickets/12', ['status' => 'bad_status']),
            new \Slim\Psr7\Response(),
            ['ticketId' => '12']
        );

        $this->assertSame(422, $Silian_response->getStatusCode());
    }

    public function testListSupportAssigneesReturnsSuccess(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 2, 'role' => 'support', 'is_support' => true]);

        $Silian_service = $this->createMock(SupportTicketService::class);
        $Silian_service->expects($this->once())
            ->method('listSupportAssignees')
            ->with(['id' => 2, 'role' => 'support', 'is_support' => true])
            ->willReturn([
                ['id' => 5, 'username' => 'support-a', 'assigned_total_count' => 6, 'open_count' => 2, 'in_progress_count' => 3],
            ]);

        $Silian_controller = $this->makeController($Silian_service, $Silian_auth);
        $Silian_response = $Silian_controller->listSupportAssignees(
            makeRequest('GET', '/api/v1/support/assignees'),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
    }

    public function testCreateTransferRequestReturnsForbidden(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 2, 'role' => 'support', 'is_support' => true]);

        $Silian_service = $this->createMock(SupportTicketService::class);
        $Silian_service->expects($this->once())
            ->method('createTransferRequest')
            ->willThrowException(new \DomainException('Only the current assignee can request a transfer'));

        $Silian_controller = $this->makeController($Silian_service, $Silian_auth);
        $Silian_response = $Silian_controller->createTransferRequest(
            makeRequest('POST', '/api/v1/support/tickets/12/transfer-requests', ['to_assignee' => 5]),
            new \Slim\Psr7\Response(),
            ['ticketId' => '12']
        );

        $this->assertSame(403, $Silian_response->getStatusCode());
    }

    public function testSubmitMyTicketFeedbackReturnsValidationError(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 9, 'role' => 'user']);

        $Silian_service = $this->createMock(SupportTicketService::class);
        $Silian_service->expects($this->once())
            ->method('submitTicketFeedback')
            ->with(['id' => 9, 'role' => 'user'], 12, ['rated_user_id' => 5, 'rating' => 9])
            ->willThrowException(new \InvalidArgumentException('rating must be between 1 and 5'));

        $Silian_controller = $this->makeController($Silian_service, $Silian_auth);
        $Silian_response = $Silian_controller->submitMyTicketFeedback(
            makeRequest('POST', '/api/v1/tickets/12/feedback', ['rated_user_id' => 5, 'rating' => 9]),
            new \Slim\Psr7\Response(),
            ['ticketId' => '12']
        );

        $this->assertSame(422, $Silian_response->getStatusCode());
    }

    public function testReviewTransferRequestReturnsValidationErrorForInvalidId(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin', 'is_admin' => true]);

        $Silian_controller = $this->makeController(Silian_authService: $Silian_auth);
        $Silian_response = $Silian_controller->reviewTransferRequest(
            makeRequest('PATCH', '/api/v1/support/transfer-requests/bad', ['status' => 'approved']),
            new \Slim\Psr7\Response(),
            ['requestId' => 'bad']
        );

        $this->assertSame(422, $Silian_response->getStatusCode());
    }

    public function testRunSlaSweepReturnsForbiddenForInvalidKey(): void
    {
        $_ENV['SUPPORT_SLA_SWEEP_KEY'] = 'expected-secret';

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())->method('logSystemEvent');

        $Silian_controller = $this->makeController(
            Silian_supportRoutingEngineService: $this->createMock(SupportRoutingEngineService::class),
            Silian_auditLogService: $Silian_audit
        );

        $Silian_response = $Silian_controller->runSlaSweep(
            makeRequest('POST', '/api/v1/support/sla-sweep', ['key' => 'bad']),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(403, $Silian_response->getStatusCode());
        $this->assertSame('no-store, no-cache, max-age=0, must-revalidate', $Silian_response->getHeaderLine('Cache-Control'));
    }

    public function testRunSlaSweepReturnsSummaryForValidKey(): void
    {
        $_ENV['SUPPORT_SLA_SWEEP_KEY'] = 'expected-secret';

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('logSystemEvent')
            ->with(
                'support_sla_sweep_endpoint_triggered',
                'support_sla_sweep',
                $this->callback(static function (array $Silian_context): bool {
                    return ($Silian_context['request_id'] ?? null) === null || is_string($Silian_context['request_id'] ?? null);
                })
            );

        $Silian_engine = $this->createMock(SupportRoutingEngineService::class);
        $Silian_engine->expects($this->once())
            ->method('runSlaSweep')
            ->willReturn(['processed' => 4, 'breached' => 2, 'rerouted' => 1]);

        $Silian_controller = $this->makeController(
            Silian_supportRoutingEngineService: $Silian_engine,
            Silian_auditLogService: $Silian_audit
        );

        $Silian_response = $Silian_controller->runSlaSweep(
            makeRequest('POST', '/api/v1/support/sla-sweep', ['key' => 'expected-secret']),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
    }

    public function testRunSlaSweepUsesSchedulerWhenAvailable(): void
    {
        $_ENV['SUPPORT_SLA_SWEEP_KEY'] = 'expected-secret';

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())->method('logSystemEvent');

        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->once())
            ->method('runTaskNow')
            ->with(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'legacy_endpoint', $this->arrayHasKey('request_id'))
            ->willReturn(['task_key' => CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'status' => 'success', 'result' => ['processed' => 3]]);

        $Silian_controller = $this->makeController(
            Silian_supportRoutingEngineService: $this->createMock(SupportRoutingEngineService::class),
            Silian_auditLogService: $Silian_audit,
            Silian_cronSchedulerService: $Silian_scheduler
        );

        $Silian_response = $Silian_controller->runSlaSweep(
            makeRequest('POST', '/api/v1/support/sla-sweep', ['key' => 'expected-secret']),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertSame(3, $Silian_payload['data']['processed']);
    }

    public function testRunSlaSweepReturnsFailureWhenSchedulerRunFails(): void
    {
        $_ENV['SUPPORT_SLA_SWEEP_KEY'] = 'expected-secret';

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('logSystemEvent')
            ->with(
                'support_sla_sweep_endpoint_triggered',
                'support_sla_sweep',
                $this->callback(static function (array $Silian_context): bool {
                    return ($Silian_context['request_id'] ?? null) === null || is_string($Silian_context['request_id'] ?? null);
                })
            );

        $Silian_scheduler = $this->createMock(CronSchedulerService::class);
        $Silian_scheduler->expects($this->once())
            ->method('runTaskNow')
            ->willReturn([
                'task_key' => CronSchedulerService::TASK_SUPPORT_SLA_SWEEP,
                'status' => 'failed',
                'error_message' => 'task_failed',
                'result' => [],
            ]);

        $Silian_controller = $this->makeController(
            Silian_supportRoutingEngineService: $this->createMock(SupportRoutingEngineService::class),
            Silian_auditLogService: $Silian_audit,
            Silian_cronSchedulerService: $Silian_scheduler
        );

        $Silian_response = $Silian_controller->runSlaSweep(
            makeRequest('POST', '/api/v1/support/sla-sweep', ['key' => 'expected-secret']),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(503, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
    }
}
