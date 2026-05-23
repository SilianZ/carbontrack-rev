<?php

declare(strict_types=1);

namespace CarbonTrack\Controllers;

use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\CronSchedulerService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\SupportRoutingEngineService;
use CarbonTrack\Services\SupportTicketService;
use CarbonTrack\Services\TurnstileService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;

class SupportTicketController
{
    public function __construct(
        private SupportTicketService $supportTicketService,
        private AuthService $authService,
        private TurnstileService $turnstileService,
        private LoggerInterface $logger,
        private ErrorLogService $errorLogService,
        private ?SupportRoutingEngineService $supportRoutingEngineService = null,
        private ?AuditLogService $auditLogService = null,
        private ?CronSchedulerService $cronSchedulerService = null
    ) {
    }

    public function runSlaSweep(Request $Silian_request, Response $Silian_response): Response
    {
        $Silian_providedKey = $this->resolveInvocationKey($Silian_request, 'X-SLA-Sweep-Key');
        $Silian_configuredKey = trim((string) ($_ENV['SUPPORT_SLA_SWEEP_KEY'] ?? getenv('SUPPORT_SLA_SWEEP_KEY') ?: ''));

        if ($Silian_configuredKey === '') {
            $this->auditLogService?->logSystemEvent('support_sla_sweep_endpoint_unconfigured', 'support_sla_sweep', [
                'status' => 'failed',
                'request_method' => 'POST',
                'endpoint' => (string) $Silian_request->getUri()->getPath(),
                'request_id' => $Silian_request->getAttribute('request_id'),
                'request_data' => ['remote_addr' => $this->clientIp($Silian_request)],
            ]);

            return $this->scheduledJson($Silian_response, ['success' => false, 'message' => 'SLA sweep key is not configured', 'code' => 'SLA_SWEEP_UNAVAILABLE'], 503);
        }

        if ($Silian_providedKey === '' || !hash_equals($Silian_configuredKey, $Silian_providedKey)) {
            $this->auditLogService?->logSystemEvent('support_sla_sweep_endpoint_denied', 'support_sla_sweep', [
                'status' => 'failed',
                'request_method' => 'POST',
                'endpoint' => (string) $Silian_request->getUri()->getPath(),
                'request_id' => $Silian_request->getAttribute('request_id'),
                'request_data' => ['remote_addr' => $this->clientIp($Silian_request)],
            ]);

            return $this->scheduledJson($Silian_response, ['success' => false, 'message' => 'Invalid SLA sweep key', 'code' => 'FORBIDDEN'], 403);
        }

        if ($this->cronSchedulerService === null && $this->supportRoutingEngineService === null) {
            return $this->scheduledJson($Silian_response, ['success' => false, 'message' => 'SLA sweep engine unavailable', 'code' => 'SLA_SWEEP_UNAVAILABLE'], 503);
        }

        try {
            if ($this->cronSchedulerService !== null) {
                $Silian_taskRun = $this->cronSchedulerService->runTaskNow(CronSchedulerService::TASK_SUPPORT_SLA_SWEEP, 'legacy_endpoint', [
                    'request_id' => $Silian_request->getAttribute('request_id'),
                    'remote_addr' => $this->clientIp($Silian_request),
                ]);
                if (($Silian_taskRun['status'] ?? null) !== 'success') {
                    $Silian_status = ($Silian_taskRun['status'] ?? null) === 'skipped' ? 409 : 503;
                    $Silian_message = $Silian_taskRun['error_message'] ?? 'SLA sweep did not complete successfully';
                    $this->auditLogService?->logSystemEvent('support_sla_sweep_endpoint_triggered', 'support_sla_sweep', [
                        'status' => 'failed',
                        'request_method' => 'POST',
                        'endpoint' => (string) $Silian_request->getUri()->getPath(),
                        'request_id' => $Silian_request->getAttribute('request_id'),
                        'request_data' => ['remote_addr' => $this->clientIp($Silian_request)],
                        'new_data' => $Silian_taskRun,
                    ]);

                    return $this->scheduledJson($Silian_response, [
                        'success' => false,
                        'message' => $Silian_message,
                        'code' => 'SLA_SWEEP_FAILED',
                        'data' => $Silian_taskRun,
                    ], $Silian_status);
                }
                $Silian_result = $Silian_taskRun['result'] ?? [];
            } else {
                $Silian_result = $this->supportRoutingEngineService->runSlaSweep();
            }
            $this->auditLogService?->logSystemEvent('support_sla_sweep_endpoint_triggered', 'support_sla_sweep', [
                'status' => 'success',
                'request_method' => 'POST',
                'endpoint' => (string) $Silian_request->getUri()->getPath(),
                'request_id' => $Silian_request->getAttribute('request_id'),
                'request_data' => $Silian_result + ['remote_addr' => $this->clientIp($Silian_request)],
            ]);

            return $this->scheduledJson($Silian_response, ['success' => true, 'data' => $Silian_result]);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to run SLA sweep');
        }
    }

    private function resolveInvocationKey(Request $Silian_request, string $Silian_headerName): string
    {
        $Silian_headerValue = trim($Silian_request->getHeaderLine($Silian_headerName));
        if ($Silian_headerValue !== '') {
            return $Silian_headerValue;
        }

        $Silian_body = $Silian_request->getParsedBody();
        if (is_array($Silian_body) && is_string($Silian_body['key'] ?? null)) {
            return trim((string) $Silian_body['key']);
        }

        return '';
    }

    private function scheduledJson(Response $Silian_response, array $Silian_payload, int $Silian_status = 200): Response
    {
        return $this->json($Silian_response, $Silian_payload, $Silian_status)
            ->withHeader('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate')
            ->withHeader('Pragma', 'no-cache')
            ->withHeader('X-Robots-Tag', 'noindex, nofollow');
    }

    public function createTicket(Request $Silian_request, Response $Silian_response): Response
    {
        $Silian_actor = $this->currentUser($Silian_request);
        if ($Silian_actor === null) {
            return $this->json($Silian_response, ['success' => false, 'message' => 'Unauthorized', 'code' => 'UNAUTHORIZED'], 401);
        }

        $Silian_payload = $this->body($Silian_request);
        if (!$this->turnstilePassed($Silian_payload['cf_turnstile_response'] ?? null, $Silian_request)) {
            return $this->json($Silian_response, ['success' => false, 'message' => 'Turnstile verification failed', 'code' => 'TURNSTILE_FAILED'], 403);
        }

        try {
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportTicketService->createTicket($Silian_actor, $Silian_payload)], 201);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to create support ticket');
        }
    }

    public function listMyTickets(Request $Silian_request, Response $Silian_response): Response
    {
        $Silian_actor = $this->currentUser($Silian_request);
        if ($Silian_actor === null) {
            return $this->json($Silian_response, ['success' => false, 'message' => 'Unauthorized', 'code' => 'UNAUTHORIZED'], 401);
        }

        try {
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportTicketService->listUserTickets((int) $Silian_actor['id'], $Silian_request->getQueryParams())]);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to list support tickets');
        }
    }

    public function getMyTicket(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        $Silian_actor = $this->currentUser($Silian_request);
        if ($Silian_actor === null) {
            return $this->json($Silian_response, ['success' => false, 'message' => 'Unauthorized', 'code' => 'UNAUTHORIZED'], 401);
        }

        try {
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportTicketService->getTicketDetailForUser((int) $Silian_actor['id'], $this->ticketId($Silian_args))]);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\RuntimeException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => 'Ticket not found', 'code' => 'TICKET_NOT_FOUND'], 404);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to load support ticket');
        }
    }

    public function addMyTicketMessage(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        $Silian_actor = $this->currentUser($Silian_request);
        if ($Silian_actor === null) {
            return $this->json($Silian_response, ['success' => false, 'message' => 'Unauthorized', 'code' => 'UNAUTHORIZED'], 401);
        }

        $Silian_payload = $this->body($Silian_request);
        if (!$this->turnstilePassed($Silian_payload['cf_turnstile_response'] ?? null, $Silian_request)) {
            return $this->json($Silian_response, ['success' => false, 'message' => 'Turnstile verification failed', 'code' => 'TURNSTILE_FAILED'], 403);
        }

        try {
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportTicketService->addUserMessage($Silian_actor, $this->ticketId($Silian_args), $Silian_payload)], 201);
        } catch (\RuntimeException $Silian_e) {
            $Silian_status = $Silian_e->getMessage() === 'Ticket not found' ? 404 : 422;
            $Silian_code = $Silian_status === 404 ? 'TICKET_NOT_FOUND' : 'INVALID_TICKET_STATE';
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => $Silian_code], $Silian_status);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to add support reply');
        }
    }

    public function submitMyTicketFeedback(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        $Silian_actor = $this->currentUser($Silian_request);
        if ($Silian_actor === null) {
            return $this->json($Silian_response, ['success' => false, 'message' => 'Unauthorized', 'code' => 'UNAUTHORIZED'], 401);
        }

        try {
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportTicketService->submitTicketFeedback($Silian_actor, $this->ticketId($Silian_args), $this->body($Silian_request))]);
        } catch (\RuntimeException $Silian_e) {
            $Silian_status = $Silian_e->getMessage() === 'Ticket not found' ? 404 : 422;
            $Silian_code = $Silian_status === 404 ? 'TICKET_NOT_FOUND' : 'INVALID_TICKET_STATE';
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => $Silian_code], $Silian_status);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to submit support ticket feedback');
        }
    }

    public function listSupportTickets(Request $Silian_request, Response $Silian_response): Response
    {
        $Silian_actor = $this->currentUser($Silian_request);
        if ($Silian_actor === null) {
            return $this->json($Silian_response, ['success' => false, 'message' => 'Unauthorized', 'code' => 'UNAUTHORIZED'], 401);
        }

        try {
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportTicketService->listSupportTickets($Silian_actor, $Silian_request->getQueryParams())]);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to list support queue');
        }
    }

    public function listSupportAssignees(Request $Silian_request, Response $Silian_response): Response
    {
        $Silian_actor = $this->currentUser($Silian_request);
        if ($Silian_actor === null) {
            return $this->json($Silian_response, ['success' => false, 'message' => 'Unauthorized', 'code' => 'UNAUTHORIZED'], 401);
        }

        try {
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportTicketService->listSupportAssignees($Silian_actor)]);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to load support assignees');
        }
    }

    public function getSupportTicket(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        $Silian_actor = $this->currentUser($Silian_request);
        if ($Silian_actor === null) {
            return $this->json($Silian_response, ['success' => false, 'message' => 'Unauthorized', 'code' => 'UNAUTHORIZED'], 401);
        }

        try {
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportTicketService->getTicketDetailForSupport($Silian_actor, $this->ticketId($Silian_args))]);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\RuntimeException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => 'Ticket not found', 'code' => 'TICKET_NOT_FOUND'], 404);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to load support queue ticket');
        }
    }

    public function addSupportTicketMessage(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        $Silian_actor = $this->currentUser($Silian_request);
        if ($Silian_actor === null) {
            return $this->json($Silian_response, ['success' => false, 'message' => 'Unauthorized', 'code' => 'UNAUTHORIZED'], 401);
        }

        try {
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportTicketService->addSupportMessage($Silian_actor, $this->ticketId($Silian_args), $this->body($Silian_request))], 201);
        } catch (\RuntimeException $Silian_e) {
            $Silian_status = $Silian_e->getMessage() === 'Ticket not found' ? 404 : 422;
            $Silian_code = $Silian_status === 404 ? 'TICKET_NOT_FOUND' : 'INVALID_TICKET_STATE';
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => $Silian_code], $Silian_status);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to add support staff reply');
        }
    }

    public function updateSupportTicket(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        $Silian_actor = $this->currentUser($Silian_request);
        if ($Silian_actor === null) {
            return $this->json($Silian_response, ['success' => false, 'message' => 'Unauthorized', 'code' => 'UNAUTHORIZED'], 401);
        }

        try {
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportTicketService->updateTicketFromSupport($Silian_actor, $this->ticketId($Silian_args), $this->body($Silian_request))]);
        } catch (\DomainException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'FORBIDDEN'], 403);
        } catch (\RuntimeException $Silian_e) {
            $Silian_status = $Silian_e->getMessage() === 'Ticket not found' ? 404 : 422;
            $Silian_code = $Silian_status === 404 ? 'TICKET_NOT_FOUND' : 'INVALID_TICKET_STATE';
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => $Silian_code], $Silian_status);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to update support ticket');
        }
    }

    public function createTransferRequest(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        $Silian_actor = $this->currentUser($Silian_request);
        if ($Silian_actor === null) {
            return $this->json($Silian_response, ['success' => false, 'message' => 'Unauthorized', 'code' => 'UNAUTHORIZED'], 401);
        }

        try {
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportTicketService->createTransferRequest($Silian_actor, $this->ticketId($Silian_args), $this->body($Silian_request))], 201);
        } catch (\DomainException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'FORBIDDEN'], 403);
        } catch (\RuntimeException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'TICKET_NOT_FOUND'], 404);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to create support transfer request');
        }
    }

    public function reviewTransferRequest(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        $Silian_actor = $this->currentUser($Silian_request);
        if ($Silian_actor === null) {
            return $this->json($Silian_response, ['success' => false, 'message' => 'Unauthorized', 'code' => 'UNAUTHORIZED'], 401);
        }

        $Silian_requestId = isset($Silian_args['requestId']) ? (int) $Silian_args['requestId'] : 0;
        if ($Silian_requestId <= 0) {
            return $this->json($Silian_response, ['success' => false, 'message' => 'Invalid request id', 'code' => 'VALIDATION_ERROR'], 422);
        }

        try {
            return $this->json($Silian_response, ['success' => true, 'data' => $this->supportTicketService->reviewTransferRequest($Silian_actor, $Silian_requestId, $this->body($Silian_request))]);
        } catch (\DomainException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'FORBIDDEN'], 403);
        } catch (\RuntimeException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'TRANSFER_REQUEST_NOT_FOUND'], 404);
        } catch (\InvalidArgumentException $Silian_e) {
            return $this->json($Silian_response, ['success' => false, 'message' => $Silian_e->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_e) {
            return $this->error($Silian_request, $Silian_response, $Silian_e, 'Failed to review support transfer request');
        }
    }

    private function currentUser(Request $Silian_request): ?array
    {
        $Silian_user = $this->authService->getCurrentUser($Silian_request);
        return is_array($Silian_user) ? $Silian_user : null;
    }

    private function body(Request $Silian_request): array
    {
        $Silian_body = $Silian_request->getParsedBody();
        return is_array($Silian_body) ? $Silian_body : [];
    }

    private function ticketId(array $Silian_args): int
    {
        $Silian_ticketId = isset($Silian_args['ticketId']) ? (int) $Silian_args['ticketId'] : 0;
        if ($Silian_ticketId <= 0) {
            throw new \InvalidArgumentException('Invalid ticket id');
        }
        return $Silian_ticketId;
    }

    private function turnstilePassed(mixed $Silian_token, Request $Silian_request): bool
    {
        $Silian_result = $this->turnstileService->verify(is_string($Silian_token) ? trim($Silian_token) : '', $this->clientIp($Silian_request));
        return (bool) ($Silian_result['success'] ?? false);
    }

    private function clientIp(Request $Silian_request): ?string
    {
        $Silian_serverParams = $Silian_request->getServerParams();
        foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'] as $Silian_key) {
            $Silian_value = $Silian_serverParams[$Silian_key] ?? null;
            if (!is_string($Silian_value) || trim($Silian_value) === '') {
                continue;
            }
            return str_contains($Silian_value, ',') ? trim(explode(',', $Silian_value)[0]) : trim($Silian_value);
        }
        return null;
    }

    private function error(Request $Silian_request, Response $Silian_response, \Throwable $Silian_e, string $Silian_message): Response
    {
        $this->logger->error($Silian_message, ['error' => $Silian_e->getMessage()]);
        try {
            $this->errorLogService->logException($Silian_e, $Silian_request, ['context_message' => $Silian_message]);
        } catch (\Throwable $Silian_loggingError) {
            $this->logger->error('Support ticket error logging failed', ['error' => $Silian_loggingError->getMessage()]);
        }
        return $this->json($Silian_response, ['success' => false, 'message' => $Silian_message, 'code' => 'INTERNAL_ERROR'], 500);
    }

    private function json(Response $Silian_response, array $Silian_payload, int $Silian_status = 200): Response
    {
        $Silian_response->getBody()->write(json_encode($Silian_payload));
        return $Silian_response->withStatus($Silian_status)->withHeader('Content-Type', 'application/json');
    }
}
