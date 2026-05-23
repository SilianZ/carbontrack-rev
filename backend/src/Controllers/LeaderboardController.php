<?php

declare(strict_types=1);

namespace CarbonTrack\Controllers;

use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\CronSchedulerService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\LeaderboardService;
use Monolog\Logger;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class LeaderboardController
{
    public function __construct(
        private LeaderboardService $leaderboardService,
        private Logger $logger,
        private AuditLogService $auditLogService,
        private ErrorLogService $errorLogService,
        private ?CronSchedulerService $cronSchedulerService = null
    ) {}

    public function triggerRefresh(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_query = $Silian_request->getQueryParams();
            $Silian_providedKey = (string) ($Silian_query['key'] ?? $Silian_query['trigger_key'] ?? '');
            $Silian_expectedKey = trim((string) ($_ENV['LEADERBOARD_TRIGGER_KEY'] ?? ''));

            if ($Silian_expectedKey === '') {
                $this->logSystemAudit('leaderboard_refresh_unconfigured', $Silian_request, [
                    'data' => ['reason' => 'missing_trigger_key_config'],
                ], 'failed');

                return $this->json($Silian_response, [
                    'success' => false,
                    'message' => 'Trigger key is not configured on the server',
                ], 503);
            }

            if ($Silian_providedKey === '' || !hash_equals($Silian_expectedKey, $Silian_providedKey)) {
                $this->logSystemAudit('leaderboard_refresh_rejected', $Silian_request, [
                    'data' => ['reason' => 'invalid_trigger_key'],
                ], 'failed');

                return $this->json($Silian_response, [
                    'success' => false,
                    'message' => 'Invalid trigger key',
                ], 403);
            }

            if ($this->cronSchedulerService !== null) {
                $Silian_taskRun = $this->cronSchedulerService->runTaskNow(CronSchedulerService::TASK_LEADERBOARD_REFRESH, 'legacy_endpoint', [
                    'request_id' => $Silian_request->getAttribute('request_id'),
                ]);
                if (($Silian_taskRun['status'] ?? null) !== 'success') {
                    $Silian_status = ($Silian_taskRun['status'] ?? null) === 'skipped' ? 409 : 503;
                    $Silian_message = $Silian_taskRun['error_message'] ?? 'Leaderboard refresh did not complete successfully';
                    $this->logSystemAudit('leaderboard_refresh_failed', $Silian_request, [
                        'data' => $Silian_taskRun,
                    ], 'failed');

                    return $this->json($Silian_response, [
                        'success' => false,
                        'message' => $Silian_message,
                        'data' => $Silian_taskRun,
                    ], $Silian_status);
                }
                $Silian_meta = $Silian_taskRun['result'] ?? [];
            } else {
                $Silian_snapshot = $this->leaderboardService->rebuildCache('manual-trigger');
                $Silian_meta = [
                    'generated_at' => $Silian_snapshot['generated_at'] ?? null,
                    'expires_at' => $Silian_snapshot['expires_at'] ?? null,
                    'global_count' => isset($Silian_snapshot['global']) ? count($Silian_snapshot['global']) : 0,
                    'regions_count' => isset($Silian_snapshot['regions']) ? count($Silian_snapshot['regions']) : 0,
                    'schools_count' => isset($Silian_snapshot['schools']) ? count($Silian_snapshot['schools']) : 0,
                ];
            }

            $this->logger->info('Leaderboard cache refreshed via trigger', $Silian_meta);
            $this->logSystemAudit('leaderboard_cache_refreshed', $Silian_request, [
                'data' => $Silian_meta,
            ]);

            return $this->json($Silian_response, [
                'success' => true,
                'message' => 'Leaderboard cache refreshed',
                'data' => $Silian_meta,
            ]);
        } catch (\Throwable $Silian_e) {
            try {
                $this->errorLogService->logException($Silian_e, $Silian_request, ['context' => 'leaderboard_refresh_failed']);
            } catch (\Throwable $Silian_ignore) {
                // swallow
            }

            $this->logSystemAudit('leaderboard_refresh_failed', $Silian_request, [
                'data' => ['error' => $Silian_e->getMessage()],
            ], 'failed');

            return $this->json($Silian_response, [
                'success' => false,
                'message' => 'Failed to refresh leaderboard cache',
            ], 500);
        }
    }

    private function logSystemAudit(string $Silian_action, Request $Silian_request, array $Silian_context = [], string $Silian_status = 'success'): void
    {
        try {
            $this->auditLogService->logSystemEvent($Silian_action, 'leaderboard', array_merge([
                'request_id' => $Silian_request->getAttribute('request_id'),
                'request_method' => $Silian_request->getMethod(),
                'endpoint' => (string)$Silian_request->getUri()->getPath(),
                'status' => $Silian_status,
                'request_data' => $Silian_context['data'] ?? null,
                'old_data' => $Silian_context['old_data'] ?? null,
                'new_data' => $Silian_context['new_data'] ?? null,
            ], $Silian_context));
        } catch (\Throwable $Silian_ignore) {
            // 审计日志失败不阻断主流程
        }
    }

    private function json(Response $Silian_response, array $Silian_data, int $Silian_status = 200): Response
    {
        $Silian_payload = json_encode($Silian_data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $Silian_response->getBody()->write($Silian_payload === false ? '{}' : $Silian_payload);
        return $Silian_response->withHeader('Content-Type', 'application/json')->withStatus($Silian_status);
    }
}
