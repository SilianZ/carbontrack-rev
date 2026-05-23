<?php

declare(strict_types=1);

namespace CarbonTrack\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\ErrorLogService;
use PDO;

/**
 * SystemLogController
 * 管理员查询系统请求级日志。
 * 列表接口不返回 request_body / response_body 详情；详情接口才返回且做脱敏。
 */
class SystemLogController
{
    private PDO $db;
    private AuthService $authService;
    private AuditLogService $auditLogService;
    private ?ErrorLogService $errorLogService;

    private const SENSITIVE_KEYS = ['password','pass','token','authorization','auth','secret'];

    public function __construct(PDO $Silian_db, AuthService $Silian_authService, AuditLogService $Silian_auditLogService, ?ErrorLogService $Silian_errorLogService = null)
    {
        $this->db = $Silian_db;
        $this->authService = $Silian_authService;
        $this->auditLogService = $Silian_auditLogService;
        $this->errorLogService = $Silian_errorLogService;
    }

    /**
     * GET /api/v1/admin/system-logs
     * 支持过滤: method, status_code, user_id, path(模糊), request_id, date_from, date_to
     * 分页: page, limit
     */
    public function list(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_admin = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_admin || !$this->authService->isAdminUser($Silian_admin)) {
                return $this->json($Silian_response, ['error' => 'Access denied'], 403);
            }

            $Silian_q = $Silian_request->getQueryParams();
            $Silian_page = max(1, (int)($Silian_q['page'] ?? 1));
            $Silian_limit = min(100, max(10, (int)($Silian_q['limit'] ?? 20)));
            $Silian_offset = ($Silian_page - 1) * $Silian_limit;

            $Silian_conditions = [];
            $Silian_params = [];

            if (!empty($Silian_q['method'])) { $Silian_conditions[] = 'method = :method'; $Silian_params['method'] = strtoupper($Silian_q['method']); }
            if (!empty($Silian_q['status_code'])) { $Silian_conditions[] = 'status_code = :status_code'; $Silian_params['status_code'] = (int)$Silian_q['status_code']; }
            if (!empty($Silian_q['user_id'])) { $Silian_conditions[] = 'user_id = :user_id'; $Silian_params['user_id'] = (int)$Silian_q['user_id']; }
            if (!empty($Silian_q['request_id'])) { $Silian_conditions[] = 'request_id = :request_id'; $Silian_params['request_id'] = $Silian_q['request_id']; }
            if (!empty($Silian_q['path'])) { $Silian_conditions[] = 'path LIKE :path'; $Silian_params['path'] = '%' . $Silian_q['path'] . '%'; }
            if (!empty($Silian_q['date_from'])) { $Silian_conditions[] = 'created_at >= :date_from'; $Silian_params['date_from'] = $this->normalizeDateStart($Silian_q['date_from']); }
            if (!empty($Silian_q['date_to'])) { $Silian_conditions[] = 'created_at <= :date_to'; $Silian_params['date_to'] = $this->normalizeDateEnd($Silian_q['date_to']); }
            // super search q: 任意字段模糊匹配（大字段使用 LIKE 可能慢，可后续加全文索引）
            if (!empty($Silian_q['q'])) {
                $Silian_searchPattern = '%' . $Silian_q['q'] . '%';
                $Silian_conditions[] = '(
                    request_id LIKE :q_request_id OR
                    path LIKE :q_path OR
                    method LIKE :q_method OR
                    user_agent LIKE :q_user_agent OR
                    ip_address LIKE :q_ip_address OR
                    CAST(status_code AS CHAR) LIKE :q_status_code OR
                    request_body LIKE :q_request_body OR
                    response_body LIKE :q_response_body OR
                    server_meta LIKE :q_server_meta
                )';
                $Silian_params['q_request_id'] = $Silian_searchPattern;
                $Silian_params['q_path'] = $Silian_searchPattern;
                $Silian_params['q_method'] = $Silian_searchPattern;
                $Silian_params['q_user_agent'] = $Silian_searchPattern;
                $Silian_params['q_ip_address'] = $Silian_searchPattern;
                $Silian_params['q_status_code'] = $Silian_searchPattern;
                $Silian_params['q_request_body'] = $Silian_searchPattern;
                $Silian_params['q_response_body'] = $Silian_searchPattern;
                $Silian_params['q_server_meta'] = $Silian_searchPattern;
            }

            $Silian_where = $Silian_conditions ? ('WHERE ' . implode(' AND ', $Silian_conditions)) : '';

            $Silian_countSql = "SELECT COUNT(*) FROM system_logs {$Silian_where}";
            $Silian_countStmt = $this->db->prepare($Silian_countSql);
            foreach ($Silian_params as $Silian_k => $Silian_v) { $Silian_countStmt->bindValue(':' . $Silian_k, $Silian_v); }
            $Silian_countStmt->execute();
            $Silian_total = (int)$Silian_countStmt->fetchColumn();

            $Silian_sql = "SELECT id, request_id, method, path, status_code, user_id, ip_address, user_agent, duration_ms, created_at
                    FROM system_logs {$Silian_where}
                    ORDER BY id DESC
                    LIMIT :limit OFFSET :offset";
            $Silian_stmt = $this->db->prepare($Silian_sql);
            foreach ($Silian_params as $Silian_k => $Silian_v) { $Silian_stmt->bindValue(':' . $Silian_k, $Silian_v); }
            $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
            $Silian_stmt->bindValue(':offset', $Silian_offset, PDO::PARAM_INT);
            $Silian_stmt->execute();
            $Silian_logs = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC);

            $this->logAudit('admin_system_logs_list_viewed', $Silian_admin, $Silian_request, [
                'data' => [
                    'page' => $Silian_page,
                    'limit' => $Silian_limit,
                    'result_count' => count($Silian_logs),
                ],
            ]);

            return $this->json($Silian_response, [
                'success' => true,
                'data' => [
                    'logs' => $Silian_logs,
                    'pagination' => [
                        'current_page' => $Silian_page,
                        'per_page' => $Silian_limit,
                        'total_items' => $Silian_total,
                        'total_pages' => (int)ceil($Silian_total / $Silian_limit)
                    ]
                ]
            ]);
        } catch (\Exception $Silian_e) {
            try { if ($this->errorLogService) { $this->errorLogService->logException($Silian_e, $Silian_request); } } catch (\Throwable $Silian_ignore) { /* swallow secondary logging failure */ }
            $this->logAudit('admin_system_logs_list_failed', $Silian_admin ?? null, $Silian_request, [
                'data' => ['error' => $Silian_e->getMessage()],
            ], 'failed');
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * GET /api/v1/admin/system-logs/{id}
     * 返回单条日志详情，包含脱敏后的 request_body / response_body。
     */
    public function detail(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_admin = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_admin || !$this->authService->isAdminUser($Silian_admin)) {
                return $this->json($Silian_response, ['error' => 'Access denied'], 403);
            }

            $Silian_id = (int)($Silian_args['id'] ?? 0);
            if ($Silian_id <= 0) {
                return $this->json($Silian_response, ['error' => 'Invalid id'], 400);
            }

            $Silian_stmt = $this->db->prepare('SELECT * FROM system_logs WHERE id = :id');
            $Silian_stmt->bindValue(':id', $Silian_id, PDO::PARAM_INT);
            $Silian_stmt->execute();
            $Silian_log = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
            if (!$Silian_log) {
                return $this->json($Silian_response, ['error' => 'Not found'], 404);
            }

            $Silian_log['request_body'] = $this->decodeMaybeJson($Silian_log['request_body']);
            $Silian_log['response_body'] = $this->decodeMaybeJson($Silian_log['response_body']);
            if (array_key_exists('server_meta', $Silian_log)) {
                $Silian_log['server_meta'] = $this->decodeMaybeJson($Silian_log['server_meta']);
            }
            $Silian_log['request_body'] = $this->redact($Silian_log['request_body']);
            $Silian_log['response_body'] = $this->redact($Silian_log['response_body']);

            $this->logAudit('admin_system_log_detail_viewed', $Silian_admin, $Silian_request, [
                'record_id' => $Silian_id,
                'data' => ['request_id' => $Silian_log['request_id'] ?? null],
            ]);

            return $this->json($Silian_response, [
                'success' => true,
                'data' => $Silian_log
            ]);
        } catch (\Exception $Silian_e) {
            try { if ($this->errorLogService) { $this->errorLogService->logException($Silian_e, $Silian_request); } } catch (\Throwable $Silian_ignore) { /* swallow secondary logging failure */ }
            $this->logAudit('admin_system_log_detail_failed', $Silian_admin ?? null, $Silian_request, [
                'data' => ['error' => $Silian_e->getMessage()],
            ], 'failed');
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    private function logAudit(string $Silian_action, ?array $Silian_admin, Request $Silian_request, array $Silian_context = [], string $Silian_status = 'success'): void
    {
        try {
            $Silian_adminId = isset($Silian_admin['id']) && is_numeric((string)$Silian_admin['id']) ? (int)$Silian_admin['id'] : null;
            $this->auditLogService->logAdminOperation($Silian_action, $Silian_adminId, 'system_logs', array_merge([
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

    private function normalizeDateStart(string $Silian_d): string
    {
        // 如果已经包含时间，直接返回
        if (preg_match('/\d{2}:\d{2}:\d{2}/', $Silian_d)) return $Silian_d;
        return trim($Silian_d) . ' 00:00:00';
    }

    private function normalizeDateEnd(string $Silian_d): string
    {
        if (preg_match('/\d{2}:\d{2}:\d{2}/', $Silian_d)) return $Silian_d;
        return trim($Silian_d) . ' 23:59:59';
    }

    private function decodeMaybeJson($Silian_raw)
    {
        if ($Silian_raw === null) return null;
        if (!is_string($Silian_raw)) return $Silian_raw; // 已经是数组
        $Silian_trim = trim($Silian_raw);
        if ($Silian_trim === '') return null;
        if (($Silian_trim[0] === '{' && substr($Silian_trim, -1) === '}') || ($Silian_trim[0] === '[' && substr($Silian_trim, -1) === ']')) {
            $Silian_decoded = json_decode($Silian_trim, true);
            if (json_last_error() === JSON_ERROR_NONE) return $Silian_decoded;
        }
        return $Silian_raw; // 保留原始字符串
    }

    private function redact($Silian_data)
    {
        if ($Silian_data === null) return null;
        if (is_array($Silian_data)) {
            foreach ($Silian_data as $Silian_k => $Silian_v) {
                if (is_string($Silian_k) && $this->isSensitive($Silian_k)) {
                    $Silian_data[$Silian_k] = '[REDACTED]';
                } elseif (is_array($Silian_v)) {
                    $Silian_data[$Silian_k] = $this->redact($Silian_v);
                }
            }
            return $Silian_data;
        }
        if (is_string($Silian_data)) {
            // 简单字符串内替换（仅键样式出现时）
            foreach (self::SENSITIVE_KEYS as $Silian_key) {
                $Silian_pattern = '/("' . preg_quote($Silian_key, '/') . '"\s*:\s*")[^"]*(")/i';
                $Silian_data = preg_replace($Silian_pattern, '$1[REDACTED]$2', $Silian_data);
            }
            return $Silian_data;
        }
        return $Silian_data;
    }

    private function isSensitive(string $Silian_key): bool
    {
        $Silian_lk = strtolower($Silian_key);
        return in_array($Silian_lk, self::SENSITIVE_KEYS, true);
    }

    private function json(Response $Silian_response, array $Silian_data, int $Silian_status = 200): Response
    {
        $Silian_response->getBody()->write(json_encode($Silian_data, JSON_UNESCAPED_UNICODE));
        return $Silian_response->withHeader('Content-Type', 'application/json')->withStatus($Silian_status);
    }
}
