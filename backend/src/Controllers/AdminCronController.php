<?php

declare(strict_types=1);

namespace CarbonTrack\Controllers;

use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\CronSchedulerService;
use CarbonTrack\Services\ErrorLogService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;

class AdminCronController
{
    public function __construct(
        private CronSchedulerService $cronSchedulerService,
        private AuthService $authService,
        private AuditLogService $auditLogService,
        private LoggerInterface $logger,
        private ErrorLogService $errorLogService
    ) {
    }

    public function listTasks(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_actor = $this->currentUser($Silian_request);
            $Silian_result = $this->cronSchedulerService->listTasks();
            $this->auditLogService->logAdminOperation('admin_cron_tasks_listed', $this->actorId($Silian_actor), 'admin_cron', [
                'table' => 'cron_tasks',
                'request_id' => $Silian_request->getAttribute('request_id'),
                'status' => 'success',
                'new_data' => ['count' => count($Silian_result)],
            ]);

            return $this->json($Silian_request, $Silian_response, ['success' => true, 'data' => $Silian_result]);
        } catch (\Throwable $Silian_exception) {
            return $this->error($Silian_request, $Silian_response, $Silian_exception, 'Failed to load cron tasks');
        }
    }

    public function updateTask(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_actor = $this->currentUser($Silian_request);
            $Silian_taskKey = $this->taskKey($Silian_args);
            $Silian_result = $this->cronSchedulerService->updateTask($Silian_taskKey, $this->body($Silian_request));

            $this->auditLogService->logAdminOperation('admin_cron_task_updated', $this->actorId($Silian_actor), 'admin_cron', [
                'table' => 'cron_tasks',
                'record_id' => null,
                'request_id' => $Silian_request->getAttribute('request_id'),
                'status' => 'success',
                'request_data' => ['task_key' => $Silian_taskKey],
                'new_data' => $Silian_result,
            ]);

            return $this->json($Silian_request, $Silian_response, ['success' => true, 'data' => $Silian_result]);
        } catch (\RuntimeException $Silian_exception) {
            if ($this->isTaskNotFoundException($Silian_exception)) {
                return $this->json($Silian_request, $Silian_response, ['success' => false, 'message' => $Silian_exception->getMessage(), 'code' => 'CRON_TASK_NOT_FOUND'], 404);
            }
            return $this->error($Silian_request, $Silian_response, $Silian_exception, 'Failed to update cron task');
        } catch (\InvalidArgumentException $Silian_exception) {
            return $this->json($Silian_request, $Silian_response, ['success' => false, 'message' => $Silian_exception->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_exception) {
            return $this->error($Silian_request, $Silian_response, $Silian_exception, 'Failed to update cron task');
        }
    }

    public function listRuns(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_actor = $this->currentUser($Silian_request);
            $Silian_result = $this->cronSchedulerService->listRuns($Silian_request->getQueryParams());

            $this->auditLogService->logAdminOperation('admin_cron_runs_listed', $this->actorId($Silian_actor), 'admin_cron', [
                'table' => 'cron_runs',
                'request_id' => $Silian_request->getAttribute('request_id'),
                'status' => 'success',
                'request_data' => $Silian_request->getQueryParams(),
                'new_data' => ['count' => count($Silian_result['items'] ?? [])],
            ]);

            return $this->json($Silian_request, $Silian_response, ['success' => true, 'data' => $Silian_result]);
        } catch (\InvalidArgumentException $Silian_exception) {
            return $this->json($Silian_request, $Silian_response, ['success' => false, 'message' => $Silian_exception->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_exception) {
            return $this->error($Silian_request, $Silian_response, $Silian_exception, 'Failed to load cron runs');
        }
    }

    public function runTask(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_actor = $this->currentUser($Silian_request);
            $Silian_taskKey = $this->taskKey($Silian_args);
            $Silian_result = $this->cronSchedulerService->runTaskNow($Silian_taskKey, 'admin_manual', [
                'request_id' => $Silian_request->getAttribute('request_id'),
                'admin_id' => $this->actorId($Silian_actor),
            ]);

            $this->auditLogService->logAdminOperation('admin_cron_task_triggered', $this->actorId($Silian_actor), 'admin_cron', [
                'table' => 'cron_tasks',
                'request_id' => $Silian_request->getAttribute('request_id'),
                'status' => ($Silian_result['status'] ?? null) === 'success' ? 'success' : 'failed',
                'request_data' => ['task_key' => $Silian_taskKey],
                'new_data' => $Silian_result,
            ]);

            if (($Silian_result['status'] ?? null) !== 'success') {
                $Silian_status = ($Silian_result['status'] ?? null) === 'skipped' ? 409 : 503;

                return $this->json($Silian_request, $Silian_response, [
                    'success' => false,
                    'message' => $Silian_result['error_message'] ?? 'Cron task did not complete successfully',
                    'code' => 'CRON_TASK_FAILED',
                    'data' => $Silian_result,
                ], $Silian_status);
            }

            return $this->json($Silian_request, $Silian_response, ['success' => true, 'data' => $Silian_result]);
        } catch (\RuntimeException $Silian_exception) {
            if ($this->isTaskNotFoundException($Silian_exception)) {
                return $this->json($Silian_request, $Silian_response, ['success' => false, 'message' => $Silian_exception->getMessage(), 'code' => 'CRON_TASK_NOT_FOUND'], 404);
            }
            return $this->error($Silian_request, $Silian_response, $Silian_exception, 'Failed to trigger cron task');
        } catch (\InvalidArgumentException $Silian_exception) {
            return $this->json($Silian_request, $Silian_response, ['success' => false, 'message' => $Silian_exception->getMessage(), 'code' => 'VALIDATION_ERROR'], 422);
        } catch (\Throwable $Silian_exception) {
            return $this->error($Silian_request, $Silian_response, $Silian_exception, 'Failed to trigger cron task');
        }
    }

    private function currentUser(Request $Silian_request): array
    {
        $Silian_user = $this->authService->getCurrentUser($Silian_request);
        return is_array($Silian_user) ? $Silian_user : [];
    }

    private function actorId(array $Silian_actor): ?int
    {
        return isset($Silian_actor['id']) && is_numeric($Silian_actor['id']) ? (int) $Silian_actor['id'] : null;
    }

    private function body(Request $Silian_request): array
    {
        $Silian_body = $Silian_request->getParsedBody();
        return is_array($Silian_body) ? $Silian_body : [];
    }

    private function taskKey(array $Silian_args): string
    {
        $Silian_taskKey = isset($Silian_args['taskKey']) ? trim((string) $Silian_args['taskKey']) : '';
        if ($Silian_taskKey === '') {
            throw new \InvalidArgumentException('Invalid cron task key');
        }
        return $Silian_taskKey;
    }

    private function isTaskNotFoundException(\RuntimeException $Silian_exception): bool
    {
        return $Silian_exception->getMessage() === 'Cron task not found';
    }

    private function error(Request $Silian_request, Response $Silian_response, \Throwable $Silian_exception, string $Silian_message): Response
    {
        $this->logger->error($Silian_message, ['error' => $Silian_exception->getMessage()]);
        try {
            $this->errorLogService->logException($Silian_exception, $Silian_request, ['context_message' => $Silian_message]);
        } catch (\Throwable $Silian_loggingError) {
            $this->logger->error('Admin cron logging failed', ['error' => $Silian_loggingError->getMessage()]);
        }

        return $this->json($Silian_request, $Silian_response, ['success' => false, 'message' => $Silian_message, 'code' => 'INTERNAL_ERROR'], 500);
    }

    private function json(Request $Silian_request, Response $Silian_response, array $Silian_payload, int $Silian_status = 200): Response
    {
        if ($Silian_status >= 400 && !array_key_exists('request_id', $Silian_payload)) {
            $Silian_payload['request_id'] = $Silian_request->getAttribute('request_id');
        }
        try {
            $Silian_json = json_encode(
                $Silian_payload,
                JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
            );
        } catch (\JsonException $Silian_exception) {
            $this->logger->error('Failed to encode admin cron JSON response', [
                'error' => $Silian_exception->getMessage(),
                'status' => $Silian_status,
            ]);

            try {
                $this->errorLogService->logException($Silian_exception, $Silian_request, [
                    'context_message' => 'Failed to encode admin cron JSON response',
                    'status' => $Silian_status,
                ]);
            } catch (\Throwable $Silian_loggingError) {
                $this->logger->error('Admin cron JSON encoding error logging failed', [
                    'error' => $Silian_loggingError->getMessage(),
                ]);
            }

            $Silian_fallbackPayload = [
                'success' => false,
                'message' => 'Failed to encode JSON response',
                'code' => 'JSON_ENCODE_ERROR',
            ];

            if ($Silian_status >= 400) {
                $Silian_requestId = $Silian_request->getAttribute('request_id');
                $Silian_fallbackPayload['request_id'] = is_scalar($Silian_requestId) || $Silian_requestId === null ? $Silian_requestId : null;
            }

            try {
                $Silian_json = json_encode(
                    $Silian_fallbackPayload,
                    JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
                );
            } catch (\JsonException) {
                $Silian_json = '{"success":false,"message":"Failed to encode JSON response","code":"JSON_ENCODE_ERROR"}';
            }
        }

        $Silian_response->getBody()->write($Silian_json);
        return $Silian_response->withStatus($Silian_status)->withHeader('Content-Type', 'application/json');
    }
}
