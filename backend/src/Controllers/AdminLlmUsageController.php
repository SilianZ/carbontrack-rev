<?php

declare(strict_types=1);

namespace CarbonTrack\Controllers;

use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\ErrorLogService;
use PDO;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class AdminLlmUsageController
{
    public function __construct(
        private PDO $db,
        private AuthService $authService,
        private AuditLogService $auditLogService,
        private ?ErrorLogService $errorLogService = null
    ) {
    }

    /**
     * GET /api/v1/admin/llm-usage
     */
    public function summary(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_admin = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_admin || !$this->authService->isAdminUser($Silian_admin)) {
                return $this->json($Silian_response, ['error' => 'Access denied'], 403);
            }

            $Silian_q = $Silian_request->getQueryParams();
            $Silian_page = max(1, (int) ($Silian_q['page'] ?? 1));
            $Silian_limit = min(200, max(10, (int) ($Silian_q['limit'] ?? 20)));
            $Silian_offset = ($Silian_page - 1) * $Silian_limit;
            $Silian_search = isset($Silian_q['q']) ? trim((string) $Silian_q['q']) : '';
            $Silian_sort = isset($Silian_q['sort']) ? (string) $Silian_q['sort'] : 'llm_used_desc';

            $Silian_where = ['u.deleted_at IS NULL'];
            $Silian_params = [];
            if ($Silian_search !== '') {
                $Silian_where[] = '(u.username LIKE :search_username OR u.email LIKE :search_email)';
                $Silian_searchPattern = '%' . $Silian_search . '%';
                $Silian_params['search_username'] = $Silian_searchPattern;
                $Silian_params['search_email'] = $Silian_searchPattern;
            }
            $Silian_whereClause = implode(' AND ', $Silian_where);

            $Silian_sortMap = [
                'llm_used_desc' => 'COALESCE(usage_stats.counter, 0) DESC',
                'llm_used_asc' => 'COALESCE(usage_stats.counter, 0) ASC',
                'last_used_desc' => 'usage_stats.last_updated_at DESC',
                'username_asc' => 'u.username ASC',
                'username_desc' => 'u.username DESC',
            ];
            $Silian_orderBy = $Silian_sortMap[$Silian_sort] ?? $Silian_sortMap['llm_used_desc'];

            $Silian_sql = "SELECT
                        u.id,
                        u.username,
                        u.email,
                        u.is_admin,
                        u.group_id,
                        u.quota_override,
                        g.name AS group_name,
                        g.config AS group_config,
                        usage_stats.counter AS llm_daily_used,
                        usage_stats.reset_at AS llm_reset_at,
                        usage_stats.last_updated_at AS llm_last_used_at
                    FROM users u
                    LEFT JOIN user_groups g ON u.group_id = g.id
                    LEFT JOIN user_usage_stats usage_stats
                        ON usage_stats.user_id = u.id
                        AND usage_stats.resource_key = 'llm_daily'
                    WHERE {$Silian_whereClause}
                    ORDER BY {$Silian_orderBy}
                    LIMIT :limit OFFSET :offset";

            $Silian_stmt = $this->db->prepare($Silian_sql);
            foreach ($Silian_params as $Silian_key => $Silian_value) {
                $Silian_stmt->bindValue(':' . $Silian_key, $Silian_value);
            }
            $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
            $Silian_stmt->bindValue(':offset', $Silian_offset, PDO::PARAM_INT);
            $Silian_stmt->execute();
            $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $Silian_users = [];
            foreach ($Silian_rows as $Silian_row) {
                $Silian_groupConfig = $this->decodeJson($Silian_row['group_config'] ?? null);
                $Silian_userOverride = $this->decodeJson($Silian_row['quota_override'] ?? null);
                $Silian_effective = array_merge(
                    $Silian_groupConfig['llm'] ?? [],
                    $Silian_userOverride['llm'] ?? []
                );

                $Silian_dailyLimit = isset($Silian_effective['daily_limit']) ? (int) $Silian_effective['daily_limit'] : null;
                $Silian_rateLimit = isset($Silian_effective['rate_limit']) ? (int) $Silian_effective['rate_limit'] : null;
                $Silian_dailyUsed = isset($Silian_row['llm_daily_used']) ? (int) $Silian_row['llm_daily_used'] : 0;
                $Silian_dailyRemaining = $Silian_dailyLimit !== null ? max($Silian_dailyLimit - $Silian_dailyUsed, 0) : null;

                $Silian_users[] = [
                    'id' => (int) $Silian_row['id'],
                    'username' => $Silian_row['username'],
                    'email' => $Silian_row['email'],
                    'is_admin' => (bool) $Silian_row['is_admin'],
                    'group_id' => $Silian_row['group_id'] !== null ? (int) $Silian_row['group_id'] : null,
                    'group_name' => $Silian_row['group_name'],
                    'daily_used' => $Silian_dailyUsed,
                    'daily_limit' => $Silian_dailyLimit,
                    'daily_remaining' => $Silian_dailyRemaining,
                    'rate_limit' => $Silian_rateLimit,
                    'reset_at' => $Silian_row['llm_reset_at'],
                    'last_used_at' => $Silian_row['llm_last_used_at'],
                ];
            }

            $Silian_countSql = "SELECT COUNT(*) FROM users u WHERE {$Silian_whereClause}";
            $Silian_countStmt = $this->db->prepare($Silian_countSql);
            foreach ($Silian_params as $Silian_key => $Silian_value) {
                $Silian_countStmt->bindValue(':' . $Silian_key, $Silian_value);
            }
            $Silian_countStmt->execute();
            $Silian_total = (int) $Silian_countStmt->fetchColumn();

            $Silian_summary = $this->fetchSummary();

            $this->logAudit('admin_llm_usage_summary_viewed', $Silian_admin, $Silian_request, [
                'data' => [
                    'page' => $Silian_page,
                    'limit' => $Silian_limit,
                    'search' => $Silian_search !== '',
                    'sort' => $Silian_sort,
                ],
            ]);

            return $this->json($Silian_response, [
                'success' => true,
                'data' => [
                    'summary' => $Silian_summary,
                    'users' => $Silian_users,
                    'pagination' => [
                        'current_page' => $Silian_page,
                        'per_page' => $Silian_limit,
                        'total_items' => $Silian_total,
                        'total_pages' => $Silian_total > 0 ? (int) ceil($Silian_total / $Silian_limit) : 0,
                    ],
                ],
            ]);
        } catch (\Throwable $Silian_e) {
            try { $this->errorLogService?->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { /* ignore */ }
            $this->logAudit('admin_llm_usage_summary_failed', $Silian_admin ?? null, $Silian_request, [
                'data' => ['error' => $Silian_e->getMessage()],
            ], 'failed');
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * GET /api/v1/admin/llm-usage/analytics
     */
    public function analytics(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_admin = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_admin || !$this->authService->isAdminUser($Silian_admin)) {
                return $this->json($Silian_response, ['error' => 'Access denied'], 403);
            }

            $Silian_q = $Silian_request->getQueryParams();
            $Silian_days = max(7, min(90, (int)($Silian_q['days'] ?? 30)));
            $Silian_recentLimit = max(5, min(30, (int)($Silian_q['recent_limit'] ?? 8)));

            $Silian_now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
            $Silian_start = $Silian_now->modify('-' . max(0, $Silian_days - 1) . ' days')->setTime(0, 0, 0);
            $Silian_since = $Silian_start->format('Y-m-d H:i:s');

            $Silian_summary = $this->fetchSummary();
            $Silian_trends = $this->fetchDailyTrends($Silian_since, $Silian_start, $Silian_now);
            $Silian_distributions = [
                'models' => $this->fetchDistribution('model', 'model', $Silian_since, 8),
                'sources' => $this->fetchDistribution('source', 'source', $Silian_since, 8),
                'actors' => $this->fetchActorDistribution($Silian_since),
                'status' => $this->fetchDistribution('status', 'status', $Silian_since, 4),
            ];
            $Silian_rangeStats = $this->fetchRangeStats($Silian_since);
            $Silian_insights = $this->buildInsights($Silian_trends, $Silian_distributions, $Silian_rangeStats);
            $Silian_recent = $this->fetchRecentConversations($Silian_recentLimit);

            $this->logAudit('admin_llm_usage_analytics_viewed', $Silian_admin, $Silian_request, [
                'data' => [
                    'days' => $Silian_days,
                    'recent_limit' => $Silian_recentLimit,
                ],
            ]);

            return $this->json($Silian_response, [
                'success' => true,
                'data' => [
                    'summary' => $Silian_summary,
                    'range_days' => $Silian_days,
                    'trends' => $Silian_trends,
                    'distributions' => $Silian_distributions,
                    'insights' => $Silian_insights,
                    'recent_conversations' => $Silian_recent,
                ],
            ]);
        } catch (\Throwable $Silian_e) {
            try { $this->errorLogService?->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { /* ignore */ }
            $this->logAudit('admin_llm_usage_analytics_failed', $Silian_admin ?? null, $Silian_request, [
                'data' => ['error' => $Silian_e->getMessage()],
            ], 'failed');
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * GET /api/v1/admin/llm-usage/logs/{id}
     */
    public function logDetail(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_admin = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_admin || !$this->authService->isAdminUser($Silian_admin)) {
                return $this->json($Silian_response, ['error' => 'Access denied'], 403);
            }

            $Silian_id = isset($Silian_args['id']) ? (int) $Silian_args['id'] : 0;
            if ($Silian_id <= 0) {
                return $this->json($Silian_response, ['error' => 'Invalid id'], 400);
            }

            $Silian_stmt = $this->db->prepare('SELECT * FROM llm_logs WHERE id = :id');
            $Silian_stmt->bindValue(':id', $Silian_id, PDO::PARAM_INT);
            $Silian_stmt->execute();
            $Silian_log = $Silian_stmt->fetch(PDO::FETCH_ASSOC);

            if (!$Silian_log) {
                return $this->json($Silian_response, ['error' => 'Not found'], 404);
            }

            $Silian_log['usage'] = $this->decodeJson($Silian_log['usage_json'] ?? null);
            unset($Silian_log['usage_json']);
            $Silian_log['context'] = $this->decodeJson($Silian_log['context_json'] ?? null);
            unset($Silian_log['context_json']);
            $Silian_log['response_raw'] = $this->decodeMaybeJson($Silian_log['response_raw'] ?? null);
            $Silian_log['prompt'] = $this->decodeMaybeJson($Silian_log['prompt'] ?? null);

            $this->logAudit('admin_llm_usage_log_viewed', $Silian_admin, $Silian_request, [
                'record_id' => $Silian_id,
                'data' => ['request_id' => $Silian_log['request_id'] ?? null],
            ]);

            return $this->json($Silian_response, [
                'success' => true,
                'data' => $Silian_log,
            ]);
        } catch (\Throwable $Silian_e) {
            try { $this->errorLogService?->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { /* ignore */ }
            $this->logAudit('admin_llm_usage_log_view_failed', $Silian_admin ?? null, $Silian_request, [
                'data' => ['error' => $Silian_e->getMessage()],
            ], 'failed');
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * @param array<string,mixed> $payload
     */
    private function json(Response $Silian_response, array $Silian_payload, int $Silian_status = 200): Response
    {
        $Silian_response->getBody()->write(json_encode($Silian_payload, JSON_UNESCAPED_UNICODE));
        return $Silian_response->withHeader('Content-Type', 'application/json')->withStatus($Silian_status);
    }

    private function logAudit(string $Silian_action, ?array $Silian_admin, Request $Silian_request, array $Silian_context = [], string $Silian_status = 'success'): void
    {
        try {
            $Silian_adminId = isset($Silian_admin['id']) && is_numeric((string)$Silian_admin['id']) ? (int)$Silian_admin['id'] : null;
            $this->auditLogService->logAdminOperation($Silian_action, $Silian_adminId, 'admin_llm_usage', array_merge([
                'record_id' => $Silian_context['record_id'] ?? null,
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

    private function fetchSummary(): array
    {
        $Silian_now = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
        $Silian_since1d = $Silian_now->modify('-1 day')->format('Y-m-d H:i:s');
        $Silian_since7d = $Silian_now->modify('-7 days')->format('Y-m-d H:i:s');
        $Silian_since30d = $Silian_now->modify('-30 days')->format('Y-m-d H:i:s');

        $Silian_sql = "SELECT
                    COUNT(*) AS total_calls,
                    SUM(CASE WHEN created_at >= :since1d THEN 1 ELSE 0 END) AS calls_24h,
                    SUM(CASE WHEN created_at >= :since7d THEN 1 ELSE 0 END) AS calls_7d,
                    SUM(CASE WHEN created_at >= :since30d_calls THEN 1 ELSE 0 END) AS calls_30d,
                    SUM(CASE WHEN created_at >= :since30d_admin AND actor_type = 'admin' THEN 1 ELSE 0 END) AS admin_calls_30d,
                    SUM(CASE WHEN created_at >= :since30d_user AND actor_type = 'user' THEN 1 ELSE 0 END) AS user_calls_30d,
                    SUM(CASE WHEN created_at >= :since30d_tokens THEN COALESCE(total_tokens, 0) ELSE 0 END) AS tokens_30d,
                    SUM(CASE WHEN created_at >= :since30d_failed AND status = 'failed' THEN 1 ELSE 0 END) AS failed_calls_30d,
                    MAX(created_at) AS last_call_at
                FROM llm_logs";

        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->bindValue(':since1d', $Silian_since1d);
        $Silian_stmt->bindValue(':since7d', $Silian_since7d);
        $Silian_stmt->bindValue(':since30d_calls', $Silian_since30d);
        $Silian_stmt->bindValue(':since30d_admin', $Silian_since30d);
        $Silian_stmt->bindValue(':since30d_user', $Silian_since30d);
        $Silian_stmt->bindValue(':since30d_tokens', $Silian_since30d);
        $Silian_stmt->bindValue(':since30d_failed', $Silian_since30d);
        $Silian_stmt->execute();
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'total_calls' => (int) ($Silian_row['total_calls'] ?? 0),
            'calls_24h' => (int) ($Silian_row['calls_24h'] ?? 0),
            'calls_7d' => (int) ($Silian_row['calls_7d'] ?? 0),
            'calls_30d' => (int) ($Silian_row['calls_30d'] ?? 0),
            'admin_calls_30d' => (int) ($Silian_row['admin_calls_30d'] ?? 0),
            'user_calls_30d' => (int) ($Silian_row['user_calls_30d'] ?? 0),
            'tokens_30d' => (int) ($Silian_row['tokens_30d'] ?? 0),
            'failed_calls_30d' => (int) ($Silian_row['failed_calls_30d'] ?? 0),
            'last_call_at' => $Silian_row['last_call_at'] ?? null,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchDailyTrends(string $Silian_since, \DateTimeImmutable $Silian_start, \DateTimeImmutable $Silian_end): array
    {
        $Silian_sql = "SELECT
                    DATE(created_at) AS log_date,
                    COUNT(*) AS calls,
                    SUM(COALESCE(total_tokens, 0)) AS tokens,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_calls,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_calls,
                    AVG(latency_ms) AS avg_latency_ms
                FROM llm_logs
                WHERE created_at >= :since
                GROUP BY DATE(created_at)
                ORDER BY log_date ASC";

        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->bindValue(':since', $Silian_since);
        $Silian_stmt->execute();
        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $Silian_indexed = [];
        foreach ($Silian_rows as $Silian_row) {
            $Silian_date = $Silian_row['log_date'] ?? null;
            if (!$Silian_date) {
                continue;
            }
            $Silian_indexed[$Silian_date] = [
                'date' => $Silian_date,
                'calls' => (int) ($Silian_row['calls'] ?? 0),
                'tokens' => (int) ($Silian_row['tokens'] ?? 0),
                'success_calls' => (int) ($Silian_row['success_calls'] ?? 0),
                'failed_calls' => (int) ($Silian_row['failed_calls'] ?? 0),
                'avg_latency_ms' => $Silian_row['avg_latency_ms'] !== null ? (float) $Silian_row['avg_latency_ms'] : null,
            ];
        }

        $Silian_cursor = $Silian_start->setTime(0, 0, 0);
        $Silian_endDate = $Silian_end->setTime(0, 0, 0);
        $Silian_points = [];
        while ($Silian_cursor <= $Silian_endDate) {
            $Silian_dateKey = $Silian_cursor->format('Y-m-d');
            $Silian_points[] = $Silian_indexed[$Silian_dateKey] ?? [
                'date' => $Silian_dateKey,
                'calls' => 0,
                'tokens' => 0,
                'success_calls' => 0,
                'failed_calls' => 0,
                'avg_latency_ms' => null,
            ];
            $Silian_cursor = $Silian_cursor->modify('+1 day');
        }

        return $Silian_points;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchDistribution(string $Silian_column, string $Silian_alias, string $Silian_since, int $Silian_limit): array
    {
        $Silian_sql = "SELECT {$Silian_column} AS label,
                    COUNT(*) AS calls,
                    SUM(COALESCE(total_tokens, 0)) AS tokens
                FROM llm_logs
                WHERE created_at >= :since
                  AND {$Silian_column} IS NOT NULL
                  AND {$Silian_column} <> ''
                GROUP BY {$Silian_column}
                ORDER BY calls DESC
                LIMIT :limit";

        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->bindValue(':since', $Silian_since);
        $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
        $Silian_stmt->execute();
        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $Silian_items = [];
        foreach ($Silian_rows as $Silian_row) {
            $Silian_items[] = [
                $Silian_alias => $Silian_row['label'],
                'calls' => (int) ($Silian_row['calls'] ?? 0),
                'tokens' => (int) ($Silian_row['tokens'] ?? 0),
            ];
        }

        return $Silian_items;
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchActorDistribution(string $Silian_since): array
    {
        return $this->fetchDistribution('actor_type', 'actor_type', $Silian_since, 4);
    }

    /**
     * @return array<string, mixed>
     */
    private function fetchRangeStats(string $Silian_since): array
    {
        $Silian_sql = "SELECT
                    COUNT(*) AS total_calls,
                    SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed_calls,
                    SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_calls,
                    AVG(latency_ms) AS avg_latency_ms,
                    AVG(total_tokens) AS avg_tokens_per_call,
                    SUM(COALESCE(total_tokens, 0)) AS total_tokens
                FROM llm_logs
                WHERE created_at >= :since";

        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->bindValue(':since', $Silian_since);
        $Silian_stmt->execute();
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $Silian_p95Latency = $this->computeLatencyPercentile($Silian_since, 0.95, 2000);

        return [
            'total_calls' => (int) ($Silian_row['total_calls'] ?? 0),
            'failed_calls' => (int) ($Silian_row['failed_calls'] ?? 0),
            'success_calls' => (int) ($Silian_row['success_calls'] ?? 0),
            'avg_latency_ms' => $Silian_row['avg_latency_ms'] !== null ? (float) $Silian_row['avg_latency_ms'] : null,
            'p95_latency_ms' => $Silian_p95Latency,
            'avg_tokens_per_call' => $Silian_row['avg_tokens_per_call'] !== null ? (float) $Silian_row['avg_tokens_per_call'] : null,
            'total_tokens' => (int) ($Silian_row['total_tokens'] ?? 0),
        ];
    }

    private function computeLatencyPercentile(string $Silian_since, float $Silian_percentile, int $Silian_limit): ?float
    {
        $Silian_stmt = $this->db->prepare("SELECT latency_ms FROM llm_logs WHERE created_at >= :since AND latency_ms IS NOT NULL ORDER BY latency_ms ASC LIMIT :limit");
        $Silian_stmt->bindValue(':since', $Silian_since);
        $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
        $Silian_stmt->execute();
        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        if (!$Silian_rows) {
            return null;
        }

        $Silian_values = array_map(static fn ($Silian_row) => (float) $Silian_row['latency_ms'], $Silian_rows);
        sort($Silian_values, SORT_NUMERIC);
        $Silian_count = count($Silian_values);
        if ($Silian_count === 0) {
            return null;
        }
        $Silian_index = (int) floor(($Silian_count - 1) * $Silian_percentile);
        return isset($Silian_values[$Silian_index]) ? (float) $Silian_values[$Silian_index] : null;
    }

    /**
     * @param array<int, array<string, mixed>> $trends
     * @param array<string, mixed> $distributions
     * @param array<string, mixed> $rangeStats
     * @return array<string, mixed>
     */
    private function buildInsights(array $Silian_trends, array $Silian_distributions, array $Silian_rangeStats): array
    {
        [$Silian_recentCalls, $Silian_prevCalls, $Silian_callsDelta, $Silian_callsDeltaRate] = $this->computeDelta($Silian_trends, 7, 'calls');
        [$Silian_recentTokens, $Silian_prevTokens, $Silian_tokensDelta, $Silian_tokensDeltaRate] = $this->computeDelta($Silian_trends, 7, 'tokens');

        $Silian_totalCalls = (int) ($Silian_rangeStats['total_calls'] ?? 0);
        $Silian_failedCalls = (int) ($Silian_rangeStats['failed_calls'] ?? 0);
        $Silian_successRate = $Silian_totalCalls > 0 ? ($Silian_totalCalls - $Silian_failedCalls) / $Silian_totalCalls : null;

        $Silian_topModel = $Silian_distributions['models'][0]['model'] ?? null;
        $Silian_topSource = $Silian_distributions['sources'][0]['source'] ?? null;

        $Silian_actorTotals = array_reduce($Silian_distributions['actors'] ?? [], fn ($Silian_carry, $Silian_item) => $Silian_carry + (int) ($Silian_item['calls'] ?? 0), 0);
        $Silian_adminCalls = 0;
        $Silian_userCalls = 0;
        foreach ($Silian_distributions['actors'] ?? [] as $Silian_item) {
            if (($Silian_item['actor_type'] ?? null) === 'admin') {
                $Silian_adminCalls += (int) ($Silian_item['calls'] ?? 0);
            } elseif (($Silian_item['actor_type'] ?? null) === 'user') {
                $Silian_userCalls += (int) ($Silian_item['calls'] ?? 0);
            }
        }
        $Silian_adminShare = $Silian_actorTotals > 0 ? $Silian_adminCalls / $Silian_actorTotals : null;
        $Silian_userShare = $Silian_actorTotals > 0 ? $Silian_userCalls / $Silian_actorTotals : null;

        return [
            'success_rate' => $Silian_successRate,
            'avg_latency_ms' => $Silian_rangeStats['avg_latency_ms'] ?? null,
            'p95_latency_ms' => $Silian_rangeStats['p95_latency_ms'] ?? null,
            'avg_tokens_per_call' => $Silian_rangeStats['avg_tokens_per_call'] ?? null,
            'total_calls' => $Silian_totalCalls,
            'total_tokens' => $Silian_rangeStats['total_tokens'] ?? 0,
            'calls_last_7d' => $Silian_recentCalls,
            'calls_prev_7d' => $Silian_prevCalls,
            'calls_delta' => $Silian_callsDelta,
            'calls_delta_rate' => $Silian_callsDeltaRate,
            'tokens_last_7d' => $Silian_recentTokens,
            'tokens_prev_7d' => $Silian_prevTokens,
            'tokens_delta' => $Silian_tokensDelta,
            'tokens_delta_rate' => $Silian_tokensDeltaRate,
            'top_model' => $Silian_topModel,
            'top_source' => $Silian_topSource,
            'admin_share' => $Silian_adminShare,
            'user_share' => $Silian_userShare,
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $trends
     * @return array{int,int,int,?float}
     */
    private function computeDelta(array $Silian_trends, int $Silian_window, string $Silian_key): array
    {
        $Silian_recentSlice = array_slice($Silian_trends, -$Silian_window);
        $Silian_prevSlice = array_slice($Silian_trends, -$Silian_window * 2, $Silian_window);
        $Silian_recent = array_sum(array_map(static fn ($Silian_item) => (int) ($Silian_item[$Silian_key] ?? 0), $Silian_recentSlice));
        $Silian_previous = array_sum(array_map(static fn ($Silian_item) => (int) ($Silian_item[$Silian_key] ?? 0), $Silian_prevSlice));
        $Silian_delta = $Silian_recent - $Silian_previous;
        $Silian_deltaRate = $Silian_previous > 0 ? $Silian_delta / $Silian_previous : null;
        return [$Silian_recent, $Silian_previous, $Silian_delta, $Silian_deltaRate];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function fetchRecentConversations(int $Silian_limit): array
    {
        $Silian_sql = "SELECT
                    l.id,
                    l.request_id,
                    l.actor_type,
                    l.actor_id,
                    l.source,
                    l.model,
                    l.status,
                    l.response_id,
                    l.total_tokens,
                    l.latency_ms,
                    l.prompt,
                    l.response_raw,
                    l.context_json,
                    l.created_at,
                    u.username AS actor_name,
                    u.email AS actor_email
                FROM llm_logs l
                LEFT JOIN users u ON u.id = l.actor_id
                ORDER BY l.id DESC
                LIMIT :limit";

        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
        $Silian_stmt->execute();
        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $Silian_requestIds = [];
        foreach ($Silian_rows as $Silian_row) {
            $Silian_requestId = isset($Silian_row['request_id']) ? trim((string) $Silian_row['request_id']) : '';
            if ($Silian_requestId !== '') {
                $Silian_requestIds[$Silian_requestId] = true;
            }
        }

        $Silian_requestIdList = array_keys($Silian_requestIds);
        $Silian_systemCounts = $this->fetchRequestIdCounts('system_logs', $Silian_requestIdList);
        $Silian_auditCounts = $this->fetchRequestIdCounts('audit_logs', $Silian_requestIdList);
        $Silian_errorCounts = $this->fetchRequestIdCounts('error_logs', $Silian_requestIdList);
        $Silian_latestSystemLogs = $this->fetchLatestSystemLogsByRequestId($Silian_requestIdList);

        $Silian_result = [];
        foreach ($Silian_rows as $Silian_row) {
            $Silian_requestId = isset($Silian_row['request_id']) ? trim((string) $Silian_row['request_id']) : '';
            $Silian_requestId = $Silian_requestId !== '' ? $Silian_requestId : null;
            $Silian_latestSystemLog = $Silian_requestId !== null ? ($Silian_latestSystemLogs[$Silian_requestId] ?? null) : null;

            $Silian_result[] = [
                'id' => (int) $Silian_row['id'],
                'created_at' => $Silian_row['created_at'] ?? null,
                'actor_type' => $Silian_row['actor_type'],
                'actor_id' => $Silian_row['actor_id'] !== null ? (int) $Silian_row['actor_id'] : null,
                'actor_name' => $Silian_row['actor_name'] ?? null,
                'actor_email' => $Silian_row['actor_email'] ?? null,
                'source' => $Silian_row['source'] ?? null,
                'model' => $Silian_row['model'] ?? null,
                'status' => $Silian_row['status'] ?? null,
                'request_id' => $Silian_requestId,
                'response_id' => $Silian_row['response_id'] ?? null,
                'total_tokens' => $Silian_row['total_tokens'] !== null ? (int) $Silian_row['total_tokens'] : null,
                'latency_ms' => $Silian_row['latency_ms'] !== null ? (float) $Silian_row['latency_ms'] : null,
                'prompt_preview' => $this->buildPreview($Silian_row['prompt'] ?? null, 200),
                'response_preview' => $this->buildPreview($Silian_row['response_raw'] ?? null, 240),
                'context' => $this->decodeJson($Silian_row['context_json'] ?? null),
                'system_path' => $Silian_latestSystemLog['path'] ?? null,
                'system_status_code' => isset($Silian_latestSystemLog['status_code']) ? (int) $Silian_latestSystemLog['status_code'] : null,
                'related' => [
                    'system' => $Silian_requestId !== null ? (int) ($Silian_systemCounts[$Silian_requestId] ?? 0) : 0,
                    'audit' => $Silian_requestId !== null ? (int) ($Silian_auditCounts[$Silian_requestId] ?? 0) : 0,
                    'error' => $Silian_requestId !== null ? (int) ($Silian_errorCounts[$Silian_requestId] ?? 0) : 0,
                ],
            ];
        }

        return $Silian_result;
    }

    /**
     * @param array<int, string> $requestIds
     * @return array<string, int>
     */
    private function fetchRequestIdCounts(string $Silian_table, array $Silian_requestIds): array
    {
        $Silian_tableName = match ($Silian_table) {
            'system_logs' => 'system_logs',
            'audit_logs' => 'audit_logs',
            'error_logs' => 'error_logs',
            default => throw new \InvalidArgumentException('Unsupported request-id aggregate table.'),
        };

        if ($Silian_requestIds === []) {
            return [];
        }

        $Silian_placeholders = $this->buildPositionalPlaceholders(count($Silian_requestIds));
        $Silian_stmt = $this->db->prepare("SELECT request_id, COUNT(*) AS total
            FROM {$Silian_tableName}
            WHERE request_id IN ({$Silian_placeholders})
            GROUP BY request_id");

        foreach ($Silian_requestIds as $Silian_index => $Silian_requestId) {
            $Silian_stmt->bindValue($Silian_index + 1, $Silian_requestId);
        }

        $Silian_stmt->execute();
        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $Silian_counts = [];
        foreach ($Silian_rows as $Silian_row) {
            $Silian_requestId = isset($Silian_row['request_id']) ? trim((string) $Silian_row['request_id']) : '';
            if ($Silian_requestId === '') {
                continue;
            }
            $Silian_counts[$Silian_requestId] = (int) ($Silian_row['total'] ?? 0);
        }

        return $Silian_counts;
    }

    /**
     * @param array<int, string> $requestIds
     * @return array<string, array{path:?string,status_code:?int}>
     */
    private function fetchLatestSystemLogsByRequestId(array $Silian_requestIds): array
    {
        if ($Silian_requestIds === []) {
            return [];
        }

        $Silian_placeholders = $this->buildPositionalPlaceholders(count($Silian_requestIds));
        $Silian_sql = "SELECT s.request_id, s.path, s.status_code
                FROM system_logs s
                INNER JOIN (
                    SELECT request_id, MAX(id) AS latest_id
                    FROM system_logs
                    WHERE request_id IN ({$Silian_placeholders})
                    GROUP BY request_id
                ) latest ON latest.latest_id = s.id";

        $Silian_stmt = $this->db->prepare($Silian_sql);
        foreach ($Silian_requestIds as $Silian_index => $Silian_requestId) {
            $Silian_stmt->bindValue($Silian_index + 1, $Silian_requestId);
        }

        $Silian_stmt->execute();
        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $Silian_items = [];
        foreach ($Silian_rows as $Silian_row) {
            $Silian_requestId = isset($Silian_row['request_id']) ? trim((string) $Silian_row['request_id']) : '';
            if ($Silian_requestId === '') {
                continue;
            }

            $Silian_items[$Silian_requestId] = [
                'path' => $Silian_row['path'] ?? null,
                'status_code' => $Silian_row['status_code'] !== null ? (int) $Silian_row['status_code'] : null,
            ];
        }

        return $Silian_items;
    }

    private function buildPositionalPlaceholders(int $Silian_count): string
    {
        if ($Silian_count <= 0) {
            throw new \InvalidArgumentException('Placeholder count must be positive.');
        }

        return implode(', ', array_fill(0, $Silian_count, '?'));
    }

    private function buildPreview($Silian_value, int $Silian_maxLength): ?string
    {
        if ($Silian_value === null) {
            return null;
        }
        if (is_array($Silian_value) || is_object($Silian_value)) {
            $Silian_value = $this->encodeJson($Silian_value);
        }
        if (!is_string($Silian_value)) {
            $Silian_value = (string) $Silian_value;
        }
        $Silian_value = trim($Silian_value);
        if ($Silian_value === '') {
            return null;
        }
        if (mb_strlen($Silian_value, 'UTF-8') > $Silian_maxLength) {
            return mb_substr($Silian_value, 0, $Silian_maxLength, 'UTF-8') . '...';
        }
        return $Silian_value;
    }

    private function encodeJson($Silian_value): ?string
    {
        if ($Silian_value === null) {
            return null;
        }
        if (is_string($Silian_value)) {
            return $Silian_value;
        }
        $Silian_json = json_encode($Silian_value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        return $Silian_json === false ? null : $Silian_json;
    }

    private function decodeJson($Silian_raw): array
    {
        if (!is_string($Silian_raw) || $Silian_raw === '') {
            return [];
        }
        $Silian_decoded = json_decode($Silian_raw, true);
        return is_array($Silian_decoded) ? $Silian_decoded : [];
    }

    private function decodeMaybeJson($Silian_value)
    {
        if (!is_string($Silian_value) || $Silian_value === '') {
            return $Silian_value;
        }
        $Silian_decoded = json_decode($Silian_value, true);
        return json_last_error() === JSON_ERROR_NONE ? $Silian_decoded : $Silian_value;
    }
}
