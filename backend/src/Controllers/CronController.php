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

    public function run(Request $request, Response $response): Response
    {
        $query = $request->getQueryParams();
        $providedKey = is_string($query['key'] ?? null)
            ? trim((string) $query['key'])
            : trim((string) ($_GET['key'] ?? ''));
        $configuredKey = trim((string) ($_ENV['CRON_RUN_KEY'] ?? getenv('CRON_RUN_KEY') ?: ''));

        if ($configuredKey === '') {
            $this->auditLogService->logSystemEvent('cron_run_endpoint_unconfigured', 'cron_scheduler', [
                'status' => 'failed',
                'request_method' => 'GET',
                'endpoint' => (string) $request->getUri()->getPath(),
                'request_data' => ['remote_addr' => $this->clientIp($request)],
                'request_id' => $request->getAttribute('request_id'),
            ]);

            return $this->json($response, [
                'success' => false,
                'message' => 'Cron key is not configured',
                'code' => 'CRON_UNAVAILABLE',
            ], 503);
        }

        if ($providedKey === '' || !hash_equals($configuredKey, $providedKey)) {
            $this->auditLogService->logSystemEvent('cron_run_endpoint_denied', 'cron_scheduler', [
                'status' => 'failed',
                'request_method' => 'GET',
                'endpoint' => (string) $request->getUri()->getPath(),
                'request_data' => ['remote_addr' => $this->clientIp($request)],
                'request_id' => $request->getAttribute('request_id'),
            ]);

            return $this->json($response, [
                'success' => false,
                'message' => 'Invalid cron key',
                'code' => 'FORBIDDEN',
            ], 403);
        }

        try {
            $result = $this->cronSchedulerService->runDueTasks('cron_endpoint', [
                'request_id' => $request->getAttribute('request_id'),
                'remote_addr' => $this->clientIp($request),
            ]);

            $this->auditLogService->logSystemEvent('cron_run_endpoint_triggered', 'cron_scheduler', [
                'status' => empty($result['failed']) ? 'success' : 'failed',
                'request_method' => 'GET',
                'endpoint' => (string) $request->getUri()->getPath(),
                'request_id' => $request->getAttribute('request_id'),
                'request_data' => [
                    'remote_addr' => $this->clientIp($request),
                    'due_count' => count($result['due'] ?? []),
                    'executed_count' => count($result['executed'] ?? []),
                    'failed_count' => count($result['failed'] ?? []),
                    'skipped_count' => count($result['skipped'] ?? []),
                ],
            ]);

            return $this->json($response, ['success' => true, 'data' => $result]);
        } catch (\Throwable $exception) {
            return $this->error($request, $response, $exception, 'Failed to run scheduled cron tasks');
        }
    }

    private function clientIp(Request $request): ?string
    {
        $serverParams = $request->getServerParams();
        foreach (['HTTP_CF_CONNECTING_IP', 'HTTP_X_FORWARDED_FOR', 'HTTP_X_REAL_IP', 'REMOTE_ADDR'] as $key) {
            $value = $serverParams[$key] ?? null;
            if (!is_string($value) || trim($value) === '') {
                continue;
            }
            return str_contains($value, ',') ? trim(explode(',', $value)[0]) : trim($value);
        }

        return null;
    }

    private function error(Request $request, Response $response, \Throwable $exception, string $message): Response
    {
        $this->logger->error($message, ['error' => $exception->getMessage()]);
        try {
            $this->errorLogService->logException($exception, $request, ['context_message' => $message]);
        } catch (\Throwable $loggingError) {
            $this->logger->error('Cron endpoint error logging failed', ['error' => $loggingError->getMessage()]);
        }

        return $this->json($response, [
            'success' => false,
            'message' => $message,
            'code' => 'INTERNAL_ERROR',
        ], 500);
    }

    private function json(Response $response, array $payload, int $status = 200): Response
    {
        $response->getBody()->write(json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        return $response->withStatus($status)->withHeader('Content-Type', 'application/json');
    }
}
