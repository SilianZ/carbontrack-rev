<?php

declare(strict_types=1);

namespace CarbonTrack\Controllers;

use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\StatisticsService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class StatsController
{
    public function __construct(
        private StatisticsService $statisticsService,
        private AuditLogService $auditLogService,
        private ErrorLogService $errorLogService
    ) {}

    public function getPublicSummary(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_params = $Silian_request->getQueryParams();
            $Silian_forceParam = $Silian_params['force'] ?? $Silian_params['refresh'] ?? null;
            $Silian_forceRefresh = false;
            if ($Silian_forceParam !== null) {
                $Silian_parsed = filter_var($Silian_forceParam, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                if ($Silian_parsed !== null) {
                    $Silian_forceRefresh = $Silian_parsed;
                }
            }

            $Silian_data = $this->statisticsService->getPublicStats($Silian_forceRefresh);

            $this->logSystemAudit('public_stats_summary_viewed', $Silian_request, [
                'data' => [
                    'force_refresh' => $Silian_forceRefresh,
                    'keys' => array_keys($Silian_data),
                ],
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => $Silian_data,
            ]);
        } catch (\Throwable $Silian_e) {
            try {
                $this->errorLogService->logException($Silian_e, $Silian_request, ['context' => 'public_stats_summary_failed']);
            } catch (\Throwable $Silian_ignore) {
                // swallow
            }

            $this->logSystemAudit('public_stats_summary_failed', $Silian_request, [
                'data' => ['error' => $Silian_e->getMessage()],
            ], 'failed');

            if (($_ENV['APP_ENV'] ?? '') === 'testing') {
                throw $Silian_e;
            }
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'error' => 'Unable to load statistics',
            ], 500);
        }
    }

    private function logSystemAudit(string $Silian_action, Request $Silian_request, array $Silian_context = [], string $Silian_status = 'success'): void
    {
        try {
            $this->auditLogService->logSystemEvent($Silian_action, 'statistics', array_merge([
                'request_id' => $Silian_request->getAttribute('request_id'),
                'request_method' => $Silian_request->getMethod(),
                'endpoint' => (string)$Silian_request->getUri()->getPath(),
                'status' => $Silian_status,
                'request_data' => $Silian_context['data'] ?? null,
            ], $Silian_context));
        } catch (\Throwable $Silian_ignore) {
            // 审计日志失败不阻断主流程
        }
    }

    private function jsonResponse(Response $Silian_response, array $Silian_data, int $Silian_status = 200): Response
    {
        $Silian_encoded = json_encode($Silian_data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $Silian_response->getBody()->write($Silian_encoded === false ? '{}' : $Silian_encoded);
        return $Silian_response->withHeader('Content-Type', 'application/json')->withStatus($Silian_status);
    }
}

