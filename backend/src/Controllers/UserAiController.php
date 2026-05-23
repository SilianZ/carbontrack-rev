<?php

declare(strict_types=1);

namespace CarbonTrack\Controllers;

use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\UserAiService;
use CarbonTrack\Services\CarbonCalculatorService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\QuotaService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;

class UserAiController
{
    public function __construct(
        private UserAiService $aiService,
        private CarbonCalculatorService $calculatorService,
        private QuotaService $quotaService,
        private LoggerInterface $logger,
        private \CarbonTrack\Services\AuthService $authService,
        private AuditLogService $auditLogService,
        private ErrorLogService $errorLogService
    ) {}

    public function suggestActivity(Request $Silian_request, Response $Silian_response): Response
    {
        $Silian_body = $Silian_request->getParsedBody();
        if (!is_array($Silian_body)) {
            $Silian_body = [];
        }
        $Silian_query = isset($Silian_body['query']) ? trim((string)$Silian_body['query']) : '';
        $Silian_userModel = $this->authService->getCurrentUserModel($Silian_request);
        $Silian_userId = $this->resolveUserId($Silian_request, $Silian_userModel);

        if ($Silian_query === '') {
            $this->logUserAudit('user_ai_suggest_validation_failed', $Silian_request, $Silian_userId, [
                'data' => ['reason' => 'missing_query'],
            ], 'failed');
            return $this->json($Silian_response, ['success' => false, 'error' => 'Query is required'], 400);
        }

        if (mb_strlen($Silian_query) > 500) {
            $this->logUserAudit('user_ai_suggest_validation_failed', $Silian_request, $Silian_userId, [
                'data' => ['reason' => 'query_too_long', 'query_length' => mb_strlen($Silian_query)],
            ], 'failed');
             return $this->json($Silian_response, ['success' => false, 'error' => 'Query too long'], 400);
        }

        $Silian_clientMeta = [];
        if (!empty($Silian_body['client_time'])) {
            $Silian_clientMeta['client_time'] = (string) $Silian_body['client_time'];
        }
        if (!empty($Silian_body['client_timezone'])) {
            $Silian_clientMeta['client_timezone'] = (string) $Silian_body['client_timezone'];
        }

        $Silian_source = null;
        if (!empty($Silian_body['entry'])) {
            $Silian_source = trim((string) $Silian_body['entry']);
        } elseif (!empty($Silian_body['source'])) {
            $Silian_source = trim((string) $Silian_body['source']);
        } elseif (!empty($Silian_body['entry_point'])) {
            $Silian_source = trim((string) $Silian_body['entry_point']);
        }
        if ($Silian_source === '') {
            $Silian_source = null;
        }

        // Quota Check
        if ($Silian_userModel) {
            // 'llm' is the resource key
            if (!$this->quotaService->checkAndConsume($Silian_userModel, 'llm', 1)) {
                $this->logUserAudit('user_ai_suggest_quota_rejected', $Silian_request, $Silian_userId, [
                    'data' => [
                        'source' => $Silian_source ?? $Silian_request->getUri()->getPath(),
                        'query_length' => mb_strlen($Silian_query),
                    ],
                ], 'failed');
                // Return i18n friendly error
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'Daily limit or rate limit exceeded',
                    'code' => 'QUOTA_EXCEEDED', // Frontend can map this to error.quota.exceeded
                    'translation_key' => 'error.quota.exceeded'
                ], 429);
            }
        }

        // Get activities for context
        $Silian_activities = $this->calculatorService->getAvailableActivities(null, null, false);
        $Silian_activityContext = [];
        foreach ($Silian_activities as $Silian_activity) {
            // Keep UUID/id for precise matching
            $Silian_name = $Silian_activity['name_en'] ?? $Silian_activity['name_zh'] ?? ($Silian_activity['combined_name'] ?? null);
            if (isset($Silian_activity['name_en'], $Silian_activity['name_zh'])) {
                $Silian_name = "{$Silian_activity['name_en']} / {$Silian_activity['name_zh']}";
            }
            $Silian_cat = $Silian_activity['category'] ?? 'General';
            $Silian_activityContext[] = [
                'id' => (string)($Silian_activity['id'] ?? ''),
                'label' => $Silian_name ?? $Silian_activity['id'] ?? 'Unknown',
                'category' => $Silian_cat,
                'unit' => $Silian_activity['unit'] ?? null,
            ];
        }

        try {
            $Silian_logContext = [
                'request_id' => $Silian_request->getAttribute('request_id'),
                'actor_type' => 'user',
                'actor_id' => $Silian_userId,
                'source' => $Silian_source ?? $Silian_request->getUri()->getPath(),
            ];
            $Silian_result = $this->aiService->suggestActivity($Silian_query, $Silian_activityContext, $Silian_clientMeta, $Silian_logContext);

            $this->logUserAudit('user_ai_activity_suggested', $Silian_request, $Silian_userId, [
                'data' => [
                    'source' => $Silian_source ?? $Silian_request->getUri()->getPath(),
                    'query_length' => mb_strlen($Silian_query),
                    'prediction' => $Silian_result['prediction']['activity_name'] ?? null,
                ],
            ]);

            return $this->json($Silian_response, $Silian_result);
        } catch (\Throwable $Silian_e) {
            $this->logger->error('AI Suggest Error: ' . $Silian_e->getMessage());
            try {
                $this->errorLogService->logException($Silian_e, $Silian_request, ['context' => 'user_ai_suggest_failed']);
            } catch (\Throwable $Silian_ignore) {
                // swallow
            }

            $this->logUserAudit('user_ai_suggest_failed', $Silian_request, $Silian_userId, [
                'data' => [
                    'source' => $Silian_source ?? $Silian_request->getUri()->getPath(),
                    'query_length' => mb_strlen($Silian_query),
                    'error' => $Silian_e->getMessage(),
                ],
            ], 'failed');

            // Helpful error if disabled
            if ($Silian_e->getMessage() === 'AI service is disabled') {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'AI assistant is not configured on this server.'
                ], 503);
            }

            return $this->json($Silian_response, [
                'success' => false,
                'error' => 'AI Service temporarily unavailable.'
            ], 503);
        }
    }

    private function json(Response $Silian_response, array $Silian_data, int $Silian_status = 200): Response
    {
        $Silian_response->getBody()->write(json_encode($Silian_data, JSON_UNESCAPED_UNICODE));
        return $Silian_response->withHeader('Content-Type', 'application/json')->withStatus($Silian_status);
    }

    private function logUserAudit(string $Silian_action, Request $Silian_request, ?int $Silian_userId, array $Silian_context = [], string $Silian_status = 'success'): void
    {
        try {
            $this->auditLogService->logUserAction($Silian_userId, $Silian_action, array_merge([
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

    private function resolveUserId(Request $Silian_request, mixed $Silian_userModel): ?int
    {
        $Silian_userId = $Silian_request->getAttribute('user_id');
        if (is_numeric($Silian_userId)) {
            return (int)$Silian_userId;
        }

        if (is_object($Silian_userModel) && isset($Silian_userModel->id) && is_numeric((string)$Silian_userModel->id)) {
            return (int)$Silian_userModel->id;
        }

        return null;
    }
}
