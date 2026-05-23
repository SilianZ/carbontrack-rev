<?php

declare(strict_types=1);

namespace CarbonTrack\Controllers;

use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\SupportAutomationService;
use CarbonTrack\Services\SupportRoutingEngineService;
use CarbonTrack\Services\SupportTicketService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;

class AdminSupportController
{
    public function __construct(
        private SupportAutomationService $supportAutomationService,
        private SupportTicketService $supportTicketService,
        private SupportRoutingEngineService $supportRoutingEngineService,
        private AuthService $authService,
        private AuditLogService $auditLogService,
        private LoggerInterface $logger,
        private ErrorLogService $errorLogService
    ) {
    }

    public function listAssignees(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportAutomationService->listAssignableUsers()]);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to load support assignees');
        }
    }

    public function getAssigneeDetail(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_detail = $this->supportAutomationService->getAssignableUserDetail($this->numericId($Silian_args, 'id'));
            if ($Silian_detail === null) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'Support assignee not found', 'code' => 'ASSIGNEE_NOT_FOUND'], 404);
            }
            return $this->json($Silian_response, ['success' => true, 'data' => $Silian_detail]);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to load support assignee detail');
        }
    }

    public function getRoutingSettings(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportAutomationService->getRoutingSettings()]);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to load support routing settings');
        }
    }

    public function updateRoutingSettings(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_actor = $this->currentUser($Silian_request);
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportAutomationService->saveRoutingSettings($Silian_actor, $this->body($Silian_request))]);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to save support routing settings');
        }
    }

    public function getAssigneeRoutingProfile(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_profile = $this->supportAutomationService->getAssigneeRoutingProfile($this->numericId($Silian_args, 'id'));
            if ($Silian_profile === null) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'Support assignee not found', 'code' => 'ASSIGNEE_NOT_FOUND'], 404);
            }
            return $this->json($Silian_response, ['success' => true, 'data' => $Silian_profile]);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to load support assignee routing profile');
        }
    }

    public function updateAssigneeRoutingProfile(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_actor = $this->currentUser($Silian_request);
            return $this->json($Silian_response, [
                'success' => true,
                'data' => $this->supportAutomationService->saveAssigneeRoutingProfile($Silian_actor, $this->numericId($Silian_args, 'id'), $this->body($Silian_request)),
            ]);
        } catch (\RuntimeException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'ASSIGNEE_NOT_FOUND'], 404);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to save support assignee routing profile');
        }
    }

    public function listTags(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportAutomationService->listTags()]);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to load support tags');
        }
    }

    public function createTag(Request $Silian_request, Response $Silian_response): Response
    {
        return $this->saveTag($Silian_request, $Silian_response, null, 201);
    }

    public function updateTag(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            return $this->saveTag($Silian_request, $Silian_response, $this->numericId($Silian_args, 'id'), 200);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        }
    }

    public function listRules(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportAutomationService->listRules()]);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to load support automation rules');
        }
    }

    public function createRule(Request $Silian_request, Response $Silian_response): Response
    {
        return $this->saveRule($Silian_request, $Silian_response, null, 201);
    }

    public function updateRule(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            return $this->saveRule($Silian_request, $Silian_response, $this->numericId($Silian_args, 'id'), 200);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        }
    }

    public function reports(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportAutomationService->getReports($Silian_request->getQueryParams())]);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to load support reports');
        }
    }

    public function listTickets(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_actor = $this->currentUser($Silian_request);
            $Silian_query = $Silian_request->getQueryParams();
            $Silian_result = $this->supportTicketService->listSupportTickets($Silian_actor, $Silian_query);
            $this->auditLogService->logAdminOperation('admin_support_tickets_listed', $this->actorId($Silian_actor), 'admin_support', [
                'table' => 'support_tickets',
                'request_data' => $Silian_query,
                'request_id' => $Silian_request->getAttribute('request_id'),
                'status' => 'success',
                'new_data' => ['count' => count($Silian_result['items'] ?? [])],
            ]);
            return $this->json($Silian_response, [
                'success' => true,
                'data' => $Silian_result,
            ]);
        } catch (\InvalidArgumentException $Silian_e) {
            $this->auditLogService->logAdminOperation('admin_support_tickets_list_failed', $this->actorId($this->currentUser($Silian_request)), 'admin_support', [
                'table' => 'support_tickets',
                'request_data' => $Silian_request->getQueryParams(),
                'request_id' => $Silian_request->getAttribute('request_id'),
                'status' => 'failed',
                'data' => ['error' => $Silian_e->getMessage()],
            ]);
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_e) {
            $this->auditLogService->logAdminOperation('admin_support_tickets_list_failed', $this->actorId($this->currentUser($Silian_request)), 'admin_support', [
                'table' => 'support_tickets',
                'request_data' => $Silian_request->getQueryParams(),
                'request_id' => $Silian_request->getAttribute('request_id'),
                'status' => 'failed',
                'data' => ['error' => $Silian_e->getMessage()],
            ]);
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to load support tickets');
        }
    }

    public function getTicketDetail(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_ticketId = $this->numericId($Silian_args, 'id');
            $Silian_actor = $this->currentUser($Silian_request);
            $Silian_detail = $this->supportTicketService->getTicketDetailForSupport($Silian_actor, $Silian_ticketId);
            $Silian_limit = (int) ($_ENV['SUPPORT_ROUTING_AUDIT_LIMIT'] ?? 10);
            $Silian_detail['routing_runs'] = $this->supportRoutingEngineService->getRoutingRunsForTicket($Silian_ticketId, max(1, $Silian_limit));
            $this->auditLogService->logAdminOperation('admin_support_ticket_detail_viewed', $this->actorId($Silian_actor), 'admin_support', [
                'table' => 'support_tickets',
                'record_id' => $Silian_ticketId,
                'request_data' => ['routing_audit_limit' => max(1, $Silian_limit)],
                'request_id' => $Silian_request->getAttribute('request_id'),
                'status' => 'success',
            ]);
            return $this->json($Silian_response, ['success' => true, 'data' => $Silian_detail]);
        } catch (\RuntimeException $Silian_e) {
            $this->auditLogService->logAdminOperation('admin_support_ticket_detail_failed', $this->actorId($this->currentUser($Silian_request)), 'admin_support', [
                'table' => 'support_tickets',
                'record_id' => isset($Silian_args['id']) && is_numeric($Silian_args['id']) ? (int) $Silian_args['id'] : null,
                'request_id' => $Silian_request->getAttribute('request_id'),
                'status' => 'failed',
                'data' => ['error' => $Silian_e->getMessage()],
            ]);
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'TICKET_NOT_FOUND'], 404);
        } catch (\InvalidArgumentException $Silian_e) {
            $this->auditLogService->logAdminOperation('admin_support_ticket_detail_failed', $this->actorId($this->currentUser($Silian_request)), 'admin_support', [
                'table' => 'support_tickets',
                'record_id' => isset($Silian_args['id']) && is_numeric($Silian_args['id']) ? (int) $Silian_args['id'] : null,
                'request_id' => $Silian_request->getAttribute('request_id'),
                'status' => 'failed',
                'data' => ['error' => $Silian_e->getMessage()],
            ]);
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_e) {
            $this->auditLogService->logAdminOperation('admin_support_ticket_detail_failed', $this->actorId($this->currentUser($Silian_request)), 'admin_support', [
                'table' => 'support_tickets',
                'record_id' => isset($Silian_args['id']) && is_numeric($Silian_args['id']) ? (int) $Silian_args['id'] : null,
                'request_id' => $Silian_request->getAttribute('request_id'),
                'status' => 'failed',
                'data' => ['error' => $Silian_e->getMessage()],
            ]);
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to load support ticket detail');
        }
    }

    public function updateTicket(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        $Silian_actor = $this->currentUser($Silian_request);
        $Silian_ticketId = null;
        $Silian_requestData = $this->body($Silian_request);

        try {
            $Silian_ticketId = $this->numericId($Silian_args, 'id');
            $Silian_detail = $this->supportTicketService->updateTicketFromSupport($Silian_actor, $Silian_ticketId, $Silian_requestData);
            $this->auditLogService->logAdminOperation('admin_support_ticket_updated', $this->actorId($Silian_actor), 'admin_support', [
                'table' => 'support_tickets',
                'record_id' => $Silian_ticketId,
                'request_data' => $Silian_requestData,
                'request_id' => $Silian_request->getAttribute('request_id'),
                'status' => 'success',
            ]);
            return $this->json($Silian_response, ['success' => true, 'data' => $Silian_detail]);
        } catch (\DomainException $Silian_e) {
            $this->logTicketUpdateFailure($Silian_request, $Silian_actor, $Silian_ticketId, $Silian_requestData, $Silian_e);
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'FORBIDDEN'], 403);
        } catch (\RuntimeException $Silian_e) {
            $this->logTicketUpdateFailure($Silian_request, $Silian_actor, $Silian_ticketId, $Silian_requestData, $Silian_e);
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'TICKET_NOT_FOUND'], 404);
        } catch (\InvalidArgumentException $Silian_e) {
            $this->logTicketUpdateFailure($Silian_request, $Silian_actor, $Silian_ticketId, $Silian_requestData, $Silian_e);
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_e) {
            $this->logTicketUpdateFailure($Silian_request, $Silian_actor, $Silian_ticketId, $Silian_requestData, $Silian_e);
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to update support ticket');
        }
    }

    private function logTicketUpdateFailure(Request $Silian_request, array $Silian_actor, ?int $Silian_ticketId, array $Silian_requestData, \Throwable $Silian_exception): void
    {
        $this->auditLogService->logAdminOperation('admin_support_ticket_update_failed', $this->actorId($Silian_actor), 'admin_support', [
            'table' => 'support_tickets',
            'record_id' => $Silian_ticketId,
            'request_data' => $Silian_requestData,
            'request_id' => $Silian_request->getAttribute('request_id'),
            'status' => 'failed',
            'data' => ['error' => $Silian_exception->getMessage()],
        ]);

        try {
            $this->errorLogService->logException($Silian_exception, $Silian_request, [
                'context_message' => 'Admin support ticket update failed',
                'ticket_id' => $Silian_ticketId,
                'request_data' => $Silian_requestData,
            ]);
        } catch (\Throwable $Silian_loggingError) {
            $this->logger->error('Admin support ticket update failure logging failed', [
                'error' => $Silian_loggingError->getMessage(),
                'ticket_id' => $Silian_ticketId,
            ]);
        }
    }

    private function saveTag(Request $Silian_request, Response $Silian_response, ?int $Silian_tagId, int $Silian_status): Response
    {
        try {
            $Silian_actor = $this->currentUser($Silian_request);
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportAutomationService->saveTag($Silian_actor, $this->body($Silian_request), $Silian_tagId)], $Silian_status);
        } catch (\RuntimeException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'TAG_NOT_FOUND'], 404);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to save support tag');
        }
    }

    private function saveRule(Request $Silian_request, Response $Silian_response, ?int $Silian_ruleId, int $Silian_status): Response
    {
        try {
            $Silian_actor = $this->currentUser($Silian_request);
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportAutomationService->saveRule($Silian_actor, $this->body($Silian_request), $Silian_ruleId)], $Silian_status);
        } catch (\RuntimeException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'RULE_NOT_FOUND'], 404);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to save support automation rule');
        }
    }

    private function currentUser(Request $Silian_request): array
    {
        $Silian_user = $this->authService->getCurrentUser($Silian_request);
        return is_array($Silian_user) ? $Silian_user : [];
    }

    private function body(Request $Silian_request): array
    {
        $Silian_body = $Silian_request->getParsedBody();
        return is_array($Silian_body) ? $Silian_body : [];
    }

    private function numericId(array $Silian_args, string $Silian_key): int
    {
        $Silian_value = isset($Silian_args[$Silian_key]) ? (int) $Silian_args[$Silian_key] : 0;
        if ($Silian_value <= 0) {
            throw new \InvalidArgumentException('Invalid id');
        }
        return $Silian_value;
    }

    private function error(Request $Silian_request, Response $Silian_response, \Throwable $Silian_e, string $Silian_message): Response
    {
        $this->logger->error($Silian_message, ['error' => $Silian_e->getMessage()]);
        try {
            $this->errorLogService->logException($Silian_e, $Silian_request, ['context_message' => $Silian_message]);
        } catch (\Throwable $Silian_loggingError) {
            $this->logger->error('Admin support logging failed', ['error' => $Silian_loggingError->getMessage()]);
        }
        return $this->json($Silian_response, ['success' => false, 'message' => $Silian_message, 'code' => 'INTERNAL_ERROR'], 500);
    }

    private function actorId(array $Silian_actor): ?int
    {
        return isset($Silian_actor['id']) && is_numeric($Silian_actor['id']) ? (int) $Silian_actor['id'] : null;
    }

    private function json(Response $Silian_response, array $Silian_payload, int $Silian_status = 200): Response
    {
        $Silian_response->getBody()->write(json_encode($Silian_payload));
        return $Silian_response->withStatus($Silian_status)->withHeader('Content-Type', 'application/json');
    }
}
