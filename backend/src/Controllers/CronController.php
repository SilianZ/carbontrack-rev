<?php

declare(strict_types=1);

namespace CarbonTrack\Controllers;

use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\CronSchedulerService;
use CarbonTrack\Services\ErrorLogService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;

class CronController
{
    public function __construct(
        private CronSchedulerService $cronSchedulerService,
        private LoggerInterface $logger,
        private ErrorLogService $errorLogService,
        private AuditLogService $auditLogService
    ) {
    }

    public function run(Request $Silian_request, Response $Silian_response): Response
    {
        $Silian_providedKey = $this->resolveInvocationKey($Silian_request, 'X-Cron-Key');
        $Silian_configuredKey = trim((string) ($_ENV['CRON_RUN_KEY'] ?? getenv('CRON_RUN_KEY') ?: ''));

        if ($Silian_configuredKey === '') {
            $this->auditSafely('cron_run_endpoint_unconfigured', [
                'status' => 'failed',
                'request_method' => 'POST',
                'endpoint' => (string) $Silian_request->getUri()->getPath(),
                'request_data' => ['remote_addr' => $this->clientIp($Silian_request)],
                'request_id' => $Silian_request->getAttribute('request_id'),
            ], $Silian_request);

            return $this->json($Silian_request, $Silian_response, [
                'success' => false,
                'message' => 'Cron key is not configured',
                'code' => 'CRON_UNAVAILABLE',
            ], 503);
        }

        if ($Silian_providedKey === '' || !hash_equals($Silian_configuredKey, $Silian_providedKey)) {
            $this->auditSafely('cron_run_endpoint_denied', [
                'status' => 'failed',
                'request_method' => 'POST',
                'endpoint' => (string) $Silian_request->getUri()->getPath(),
                'request_data' => ['remote_addr' => $this->clientIp($Silian_request)],
                'request_id' => $Silian_request->getAttribute('request_id'),
            ], $Silian_request);

            return $this->json($Silian_request, $Silian_response, [
                'success' => false,
                'message' => 'Invalid cron key',
                'code' => 'FORBIDDEN',
            ], 403);
        }

        try {
            $Silian_result = $this->cronSchedulerService->runDueTasks('cron_endpoint', [
                'request_id' => $Silian_request->getAttribute('request_id'),
                'remote_addr' => $this->clientIp($Silian_request),
            ]);

            $this->auditSafely('cron_run_endpoint_triggered', [
                'status' => !empty($Silian_result['failed']) || !empty($Silian_result['skipped']) ? 'failed' : 'success',
                'request_method' => 'POST',
                'endpoint' => (string) $Silian_request->getUri()->getPath(),
                'request_id' => $Silian_request->getAttribute('request_id'),
                'request_data' => [
                    'remote_addr' => $this->clientIp($Silian_request),
                    'due_count' => count($Silian_result['due'] ?? []),
                    'executed_count' => count($Silian_result['executed'] ?? []),
                    'failed_count' => count($Silian_result['failed'] ?? []),
                    'skipped_count' => count($Silian_result['skipped'] ?? []),
                ],
            ], $Silian_request);

            $Silian_failedCount = count($Silian_result['failed'] ?? []);
            $Silian_skippedCount = count($Silian_result['skipped'] ?? []);
            $Silian_executedCount = count($Silian_result['executed'] ?? []);

            if ($Silian_failedCount > 0) {
                return $this->json($Silian_request, $Silian_response, [
                    'success' => false,
                    'message' => 'One or more cron tasks failed',
                    'code' => 'CRON_RUN_FAILED',
                    'data' => $Silian_result,
                ], 503);
            }

            if ($Silian_skippedCount > 0) {
                return $this->json($Silian_request, $Silian_response, [
                    'success' => false,
                    'message' => $Silian_executedCount > 0
                        ? 'One or more cron tasks were skipped'
                        : 'All due cron tasks were skipped',
                    'code' => 'CRON_RUN_SKIPPED',
                    'data' => $Silian_result,
                ], 409);
            }

            return $this->json($Silian_request, $Silian_response, ['success' => true, 'data' => $Silian_result]);
        } catch (\Throwable $Silian_exception) {
            return $this->error($Silian_request, $Silian_response, $Silian_exception, 'Failed to run scheduled cron tasks');
        }
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

    private function auditSafely(string $Silian_action, array $Silian_payload, Request $Silian_request): void
    {
        try {
            $this->auditLogService->logSystemEvent($Silian_action, 'cron_scheduler', $Silian_payload);
        } catch (\Throwable $Silian_exception) {
            $this->logger->warning('Cron endpoint audit logging failed', [
                'action' => $Silian_action,
                'path' => (string) $Silian_request->getUri()->getPath(),
                'error' => $Silian_exception->getMessage(),
            ]);
        }
    }

    private function error(Request $Silian_request, Response $Silian_response, \Throwable $Silian_exception, string $Silian_message): Response
    {
        $this->logger->error($Silian_message, ['error' => $Silian_exception->getMessage()]);
        try {
            $this->errorLogService->logException($Silian_exception, $Silian_request, ['context_message' => $Silian_message]);
        } catch (\Throwable $Silian_loggingError) {
            $this->logger->error('Cron endpoint error logging failed', ['error' => $Silian_loggingError->getMessage()]);
        }

        return $this->json($Silian_request, $Silian_response, [
            'success' => false,
            'message' => $Silian_message,
            'code' => 'INTERNAL_ERROR',
        ], 500);
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
            $this->logger->error('Cron endpoint JSON encoding failed', [
                'status' => $Silian_status,
                'path' => (string) $Silian_request->getUri()->getPath(),
                'error' => $Silian_exception->getMessage(),
            ]);

            $Silian_json = '{"success":false,"message":"Failed to encode response payload","code":"INTERNAL_ERROR"}';
        }

        $Silian_response->getBody()->write($Silian_json);
        return $Silian_response
            ->withStatus($Silian_status)
            ->withHeader('Content-Type', 'application/json')
            ->withHeader('Cache-Control', 'no-store, no-cache, max-age=0, must-revalidate')
            ->withHeader('Pragma', 'no-cache')
            ->withHeader('X-Robots-Tag', 'noindex, nofollow');
    }
}
