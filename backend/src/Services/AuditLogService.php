<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use PDO;
use Monolog\Logger;
use JsonException;

/**
 * AuditLogService
 * 负责记录详细的用户/管理员/系统操作审计日志，支持数据变更前后对比。
 * 设计目标：失败不影响主业务，不抛出异常到调用层。
 */
class AuditLogService
{
    private const SQL_AND_CREATED_AT_LTE = ' AND created_at <= ?';
    private const SQL_AND_ACTOR_TYPE = ' AND actor_type = ?';
    private const SQL_AND_OPERATION_CATEGORY = ' AND operation_category = ?';

    private PDO $db;
    private Logger $logger;
    private ?int $lastInsertId = null;
    private int $maxDataLength = 10000; // JSON 字段截断长度
    /** @var array<int, string|null> */
    private array $userUuidCache = [];
    private array $sensitiveFields = [
        'password','pass','token','authorization','auth','secret',
        'api_key','access_token','refresh_token','session_id','credit_card'
    ];
    /** @var string[] */
    private array $nullableIntegerFields = [
        'user_id',
        'affected_id',
        'response_code',
    ];

    public function __construct(PDO $Silian_db, Logger $Silian_logger)
    {
        $this->db = $Silian_db;
        $this->logger = $Silian_logger;
    }

    /**
     * 向后兼容的入口：
     *  1) log(array $payload) 直接写入
     *  2) log(string $action, string $category, array $context = []) 推导并调用 logDataChange
     */
    public function log($Silian_arg1, $Silian_arg2 = null, $Silian_arg3 = null): bool
    {
        $this->lastInsertId = null;
        $Silian_result = false;
        try {
            if (is_array($Silian_arg1)) {
                $Silian_payload = $Silian_arg1;
                if (!isset($Silian_payload['operation_category']) || $Silian_payload['operation_category'] === '') {
                    $Silian_actionName = $Silian_payload['action'] ?? '';
                    $Silian_payload['operation_category'] = str_starts_with($Silian_actionName, 'auth_') ? 'authentication' : 'general';
                }
                if (!isset($Silian_payload['actor_type'])) {
                    $Silian_payload['actor_type'] = ($Silian_payload['user_id'] ?? null) ? 'user' : 'system';
                }
                $Silian_result = $this->logAudit($Silian_payload);
            } else {
                $Silian_action = (string)$Silian_arg1;
                $Silian_userId = null;
                $Silian_category = null;
                $Silian_context = [];
                // Determine signature form
                if (is_string($Silian_arg2) && !is_numeric($Silian_arg2)) {
                    // (action, category, context?)
                    $Silian_category = $Silian_arg2;
                    $Silian_context = is_array($Silian_arg3) ? $Silian_arg3 : [];
                } elseif (is_int($Silian_arg2) || (is_numeric($Silian_arg2) && (string)(int)$Silian_arg2 === (string)$Silian_arg2)) {
                    // Legacy (action, userId, context|string)
                    $Silian_userId = (int)$Silian_arg2;
                    if (is_array($Silian_arg3)) { $Silian_context = $Silian_arg3; }
                    elseif ($Silian_arg3 !== null) { $Silian_context = ['message' => (string)$Silian_arg3]; }
                    $Silian_category = $Silian_context['operation_category'] ?? 'general';
                } else {
                    // Unsupported combination
                    $Silian_category = 'general';
                }
                if (!$Silian_category) { $Silian_category = 'general'; }
                $Silian_userIdRaw   = $Silian_context['user_id'] ?? $Silian_context['uid'] ?? $Silian_userId;
                $Silian_recordIdRaw = $Silian_context['record_id'] ?? $Silian_context['affected_id'] ?? null;
                $Silian_finalUserId  = (is_int($Silian_userIdRaw) || (is_numeric($Silian_userIdRaw) && (string)(int)$Silian_userIdRaw === (string)$Silian_userIdRaw)) ? (int)$Silian_userIdRaw : null;
                $Silian_recordId = (is_int($Silian_recordIdRaw) || (is_numeric($Silian_recordIdRaw) && (string)(int)$Silian_recordIdRaw === (string)$Silian_recordIdRaw)) ? (int)$Silian_recordIdRaw : null;
                $Silian_actorType = $Silian_context['actor_type'] ?? ($Silian_context['is_admin'] ?? false ? 'admin' : 'user');
                $Silian_table = $Silian_context['table'] ?? $Silian_context['affected_table'] ?? null;
                $Silian_oldData = $Silian_context['old_data'] ?? null;
                $Silian_newData = $Silian_context['new_data'] ?? null;
                $Silian_result = $this->logDataChange(
                    $Silian_category,
                    $Silian_action,
                    $Silian_finalUserId,
                    $Silian_actorType,
                    $Silian_table,
                    $Silian_recordId,
                    is_array($Silian_oldData) ? $Silian_oldData : null,
                    is_array($Silian_newData) ? $Silian_newData : null,
                    $Silian_context
                );
            }
        } catch (\Throwable $Silian_e) {
            $this->logger->error('AuditLogService::log failed', [
                'error' => $Silian_e->getMessage(),
            ]);
            $Silian_result = false;
        }
        return $Silian_result;
    }

    /**
     * 核心写入方法
     */
    public function logAudit(array $Silian_logData): bool
    {
        if ($this->isWriteDisabled()) {
            return false;
        }

        try {
            foreach (['action','operation_category'] as $Silian_req) {
                if (empty($Silian_logData[$Silian_req])) {
                    $this->logger->warning('Audit log missing required field', ['field' => $Silian_req]);
                    return false;
                }
            }

            $Silian_data = $this->sanitizeAuditData($Silian_logData);
            foreach (['data','old_data','new_data'] as $Silian_opt) {
                if (!array_key_exists($Silian_opt, $Silian_data)) { $Silian_data[$Silian_opt] = null; }
            }

            $Silian_stmt = $this->db->prepare(
                "INSERT INTO audit_logs (
                    user_id, user_uuid, conversation_id, actor_type, action, data, ip_address, user_agent,
                    request_method, endpoint, old_data, new_data, affected_table,
                    affected_id, status, response_code, session_id, referrer,
                    operation_category, operation_subtype, change_type, request_id
                ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)"
            );

            // request_id 优先来自显式字段，其次全局 $_SERVER（由中间件注入）
            $Silian_requestId = $Silian_data['request_id'] ?? ($_SERVER['HTTP_X_REQUEST_ID'] ?? null);
            $Silian_userUuid = $this->resolveUserUuid($Silian_data);

            $Silian_ok = $Silian_stmt->execute([
                $Silian_data['user_id'] ?? null,
                $Silian_userUuid,
                $Silian_data['conversation_id'] ?? null,
                $Silian_data['actor_type'] ?? 'user',
                $Silian_data['action'],
                $Silian_data['data'] ?? null,
                $Silian_data['ip_address'] ?? ($_SERVER['REMOTE_ADDR'] ?? null),
                $Silian_data['user_agent'] ?? ($_SERVER['HTTP_USER_AGENT'] ?? null),
                $Silian_data['request_method'] ?? ($_SERVER['REQUEST_METHOD'] ?? null),
                $Silian_data['endpoint'] ?? ($_SERVER['REQUEST_URI'] ?? null),
                $Silian_data['old_data'] ?? null,
                $Silian_data['new_data'] ?? null,
                $Silian_data['affected_table'] ?? null,
                $Silian_data['affected_id'] ?? null,
                $Silian_data['status'] ?? 'success',
                $Silian_data['response_code'] ?? (($_SERVER['REQUEST_METHOD'] ?? null) === 'POST' ? 200 : null),
                $Silian_data['session_id'] ?? (function_exists('session_id') ? session_id() : null),
                $Silian_data['referrer'] ?? ($_SERVER['HTTP_REFERER'] ?? null),
                $Silian_data['operation_category'],
                $Silian_data['operation_subtype'] ?? null,
                $Silian_data['change_type'] ?? 'other',
                $Silian_requestId
            ]);

            if (!$Silian_ok) {
                $this->lastInsertId = null;
                $this->logger->warning('Audit log insert returned false', [
                    'action' => $Silian_data['action'],
                    'category' => $Silian_data['operation_category']
                ]);
                return false;
            }
            $Silian_insertId = (int) $this->db->lastInsertId();
            $this->lastInsertId = $Silian_insertId > 0 ? $Silian_insertId : null;
            return true;
        } catch (\Throwable $Silian_e) {
            $this->logger->error('Audit logging exception', [
                'message' => $Silian_e->getMessage(),
                'trace' => $Silian_e->getTraceAsString(),
            ]);
            return false;
        }
    }

    /**
     * 记录数据变更操作
     */
    public function logDataChange(
        string $Silian_category,
        string $Silian_action,
        ?int $Silian_userId,
        string $Silian_actorType = 'user',
        ?string $Silian_table = null,
        string|int|null $Silian_recordId = null,
        ?array $Silian_oldData = null,
        ?array $Silian_newData = null,
        array $Silian_context = []
    ): bool {
        $Silian_affectedId = null;
        if ($Silian_recordId !== null && (is_int($Silian_recordId) || (ctype_digit((string)$Silian_recordId) && (string)$Silian_recordId === (string)(int)$Silian_recordId))) {
            $Silian_affectedId = (int)$Silian_recordId;
        } elseif ($Silian_recordId !== null) {
            $Silian_context['non_numeric_record_id'] = (string)$Silian_recordId;
        }

        $Silian_logData = [
            'action' => $Silian_action,
            'operation_category' => $Silian_category,
            'user_id' => $Silian_userId,
            'user_uuid' => $Silian_context['user_uuid'] ?? ($Silian_context['uuid'] ?? null),
            'conversation_id' => $Silian_context['conversation_id'] ?? null,
            'actor_type' => $Silian_actorType,
            'affected_table' => $Silian_table,
            'affected_id' => $Silian_affectedId,
            'old_data' => $Silian_oldData ? $this->sanitizeData($Silian_oldData) : null,
            'new_data' => $Silian_newData ? $this->sanitizeData($Silian_newData) : null,
            'change_type' => $this->determineChangeType($Silian_oldData, $Silian_newData),
            'operation_subtype' => $Silian_context['subtype'] ?? null,
            'data' => $Silian_context['request_data'] ?? $this->getRequestData(),
            'request_id' => $Silian_context['request_id'] ?? ($_SERVER['HTTP_X_REQUEST_ID'] ?? null),
            'status' => $Silian_context['status'] ?? 'success'
        ];
        return $this->logAudit($Silian_logData);
    }

    public function logAuthOperation(string $Silian_action, ?int $Silian_userId, bool $Silian_success, array $Silian_context = []): bool
    {
        // Route through legacy log() to satisfy tests that mock log()
        $Silian_payload = [
            'action' => $Silian_action,
            'operation_category' => 'authentication',
            'user_id' => $Silian_userId,
            'actor_type' => 'user',
            'affected_table' => 'users',
            'affected_id' => $Silian_userId,
            'status' => $Silian_success ? 'success' : 'failed',
            'operation_subtype' => $Silian_success ? 'success' : 'failed',
            'request_id' => $Silian_context['request_id'] ?? null,
            'data' => $Silian_context['request_data'] ?? ($Silian_context['data'] ?? null),
            'old_data' => null,
            'new_data' => null
        ];
        return $this->log($Silian_payload);
    }

    public function logAdminOperation(string $Silian_action, ?int $Silian_adminId, string $Silian_category, array $Silian_context = []): bool
    {
        return $this->logDataChange(
            $Silian_category,
            $Silian_action,
            $Silian_adminId,
            'admin',
            $Silian_context['table'] ?? null,
            $Silian_context['record_id'] ?? null,
            $Silian_context['old_data'] ?? null,
            $Silian_context['new_data'] ?? null,
            $Silian_context
        );
    }

    // alias kept: primary log() already exists at top for compatibility

    /**
     * Legacy alias used in older tests: logUserAction($userId, $action, $context)
     */
    public function logUserAction(?int $Silian_userId, string $Silian_action, array $Silian_context = [], ?string $Silian_ip = null): bool
    {
        if ($Silian_ip && !isset($Silian_context['ip_address'])) { $Silian_context['ip_address'] = $Silian_ip; }
        // Reuse high-level logDataChange path
        $Silian_ok = $this->logDataChange(
            'user_action',
            $Silian_action,
            $Silian_userId,
            'user',
            $Silian_context['table'] ?? null,
            $Silian_context['record_id'] ?? null,
            $Silian_context['old_data'] ?? null,
            $Silian_context['new_data'] ?? null,
            $Silian_context
        );
        if ($Silian_ok) {
            $this->logger->info('audit_log_written', [ 'action' => $Silian_action, 'category' => 'user_action', 'user_id' => $Silian_userId ]);
        }
        return $Silian_ok;
    }

    /**
     * Legacy method expected in tests to fetch user logs.
     */
    public function getUserLogs(int $Silian_userId, int $Silian_limit = 50): array
    {
        try {
            $Silian_stmt = $this->db->prepare('SELECT * FROM audit_logs WHERE user_id = :uid OR user_uuid = :user_uuid ORDER BY created_at DESC LIMIT :lim');
            $Silian_stmt->bindValue(':uid', $Silian_userId, \PDO::PARAM_INT);
            $Silian_stmt->bindValue(':user_uuid', $this->lookupUserUuidById($Silian_userId) ?? '', \PDO::PARAM_STR);
            $Silian_stmt->bindValue(':lim', $Silian_limit, \PDO::PARAM_INT);
            $Silian_stmt->execute();
            return $Silian_stmt->fetchAll(\PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $Silian_e) {
            $this->logger->warning('getUserLogs failed', ['error' => $Silian_e->getMessage()]);
            return [];
        }
    }

    public function logSystemEvent(string $Silian_action, string $Silian_category, array $Silian_context = []): bool
    {
        return $this->logDataChange(
            $Silian_category,
            $Silian_action,
            null,
            'system',
            null,
            null,
            null,
            null,
            $Silian_context
        );
    }

    public function getAuditStats(array $Silian_filters = []): array
    {
        try {
            $Silian_sql = "SELECT actor_type, operation_category, COUNT(*) as count, MAX(created_at) as last_activity FROM audit_logs WHERE 1=1";
            $Silian_params = [];
            if (isset($Silian_filters['date_from'])) { $Silian_sql .= " AND created_at >= ?"; $Silian_params[] = $Silian_filters['date_from']; }
            if (isset($Silian_filters['date_to'])) { $Silian_sql .= self::SQL_AND_CREATED_AT_LTE; $Silian_params[] = $Silian_filters['date_to']; }
            if (isset($Silian_filters['actor_type'])) { $Silian_sql .= self::SQL_AND_ACTOR_TYPE; $Silian_params[] = $Silian_filters['actor_type']; }
            if (isset($Silian_filters['category'])) { $Silian_sql .= self::SQL_AND_OPERATION_CATEGORY; $Silian_params[] = $Silian_filters['category']; }
            $Silian_sql .= " GROUP BY actor_type, operation_category ORDER BY count DESC";
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute($Silian_params);
            return $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $Silian_e) {
            $this->logger->error('Failed to get audit stats', ['error' => $Silian_e->getMessage()]);
            return [];
        }
    }

    public function getAuditLogs(array $Silian_filters = [], int $Silian_limit = 100, int $Silian_offset = 0): array
    {
        try {
            $Silian_sql = "SELECT * FROM audit_logs WHERE 1=1";
            $Silian_params = [];
            if (isset($Silian_filters['user_id'])) { $Silian_sql .= " AND user_id = ?"; $Silian_params[] = $Silian_filters['user_id']; }
            if (isset($Silian_filters['user_uuid'])) { $Silian_sql .= " AND user_uuid = ?"; $Silian_params[] = strtolower((string) $Silian_filters['user_uuid']); }
            if (isset($Silian_filters['actor_type'])) { $Silian_sql .= self::SQL_AND_ACTOR_TYPE; $Silian_params[] = $Silian_filters['actor_type']; }
            if (isset($Silian_filters['category'])) { $Silian_sql .= self::SQL_AND_OPERATION_CATEGORY; $Silian_params[] = $Silian_filters['category']; }
            if (isset($Silian_filters['status'])) { $Silian_sql .= " AND status = ?"; $Silian_params[] = $Silian_filters['status']; }
            if (isset($Silian_filters['date_from'])) { $Silian_sql .= " AND created_at >= ?"; $Silian_params[] = $Silian_filters['date_from']; }
            if (isset($Silian_filters['date_to'])) { $Silian_sql .= self::SQL_AND_CREATED_AT_LTE; $Silian_params[] = $Silian_filters['date_to']; }
            $Silian_sql .= " ORDER BY id DESC LIMIT ? OFFSET ?";
            $Silian_params[] = $Silian_limit; $Silian_params[] = $Silian_offset;
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute($Silian_params);
            return $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $Silian_e) {
            $this->logger->error('Failed to get audit logs', ['error' => $Silian_e->getMessage()]);
            return [];
        }
    }

    public function getAuditLogsCount(array $Silian_filters = []): int
    {
        try {
            $Silian_sql = "SELECT COUNT(*) FROM audit_logs WHERE 1=1";
            $Silian_params = [];
            if (isset($Silian_filters['user_id'])) { $Silian_sql .= " AND user_id = ?"; $Silian_params[] = $Silian_filters['user_id']; }
            if (isset($Silian_filters['user_uuid'])) { $Silian_sql .= " AND user_uuid = ?"; $Silian_params[] = strtolower((string) $Silian_filters['user_uuid']); }
            if (isset($Silian_filters['actor_type'])) { $Silian_sql .= self::SQL_AND_ACTOR_TYPE; $Silian_params[] = $Silian_filters['actor_type']; }
            if (isset($Silian_filters['category'])) { $Silian_sql .= self::SQL_AND_OPERATION_CATEGORY; $Silian_params[] = $Silian_filters['category']; }
            if (isset($Silian_filters['status'])) { $Silian_sql .= " AND status = ?"; $Silian_params[] = $Silian_filters['status']; }
            if (isset($Silian_filters['date_from'])) { $Silian_sql .= " AND created_at >= ?"; $Silian_params[] = $Silian_filters['date_from']; }
            if (isset($Silian_filters['date_to'])) { $Silian_sql .= self::SQL_AND_CREATED_AT_LTE; $Silian_params[] = $Silian_filters['date_to']; }
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute($Silian_params);
            return (int)$Silian_stmt->fetchColumn();
        } catch (\Throwable $Silian_e) {
            $this->logger->error('Failed to get audit logs count', ['error' => $Silian_e->getMessage()]);
            return 0;
        }
    }

    public function cleanupOldLogs(int $Silian_days = 365): int
    {
        try {
            $Silian_cutoff = date('Y-m-d H:i:s', strtotime("-$Silian_days days"));
            $Silian_stmt = $this->db->prepare("DELETE FROM audit_logs WHERE created_at < ?");
            $Silian_stmt->execute([$Silian_cutoff]);
            return $Silian_stmt->rowCount();
        } catch (\Throwable $Silian_e) {
            $this->logger->error('Failed to cleanup old audit logs', ['error' => $Silian_e->getMessage(), 'days' => $Silian_days]);
            return 0;
        }
    }

    private function sanitizeAuditData(array $Silian_data): array
    {
        $Silian_sanitized = [];
        foreach ($Silian_data as $Silian_key => $Silian_value) {
            if (in_array(strtolower($Silian_key), $this->sensitiveFields, true)) {
                $Silian_sanitized[$Silian_key] = '[REDACTED]';
                continue;
            }
            if ($Silian_value === null) {
                $Silian_sanitized[$Silian_key] = null;
                continue;
            }
            if (in_array($Silian_key, $this->nullableIntegerFields, true)) {
                $Silian_sanitized[$Silian_key] = $this->normalizeNullableInteger($Silian_value);
                continue;
            }
            if (is_array($Silian_value) || is_object($Silian_value)) {
                try {
                    $Silian_json = json_encode($Silian_value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
                    $Silian_sanitized[$Silian_key] = $this->truncateData($Silian_json);
                } catch (JsonException $Silian_e) {
                    $Silian_sanitized[$Silian_key] = '[JSON_ERROR]';
                }
            } else {
                $Silian_sanitized[$Silian_key] = $this->truncateData((string)$Silian_value);
            }
        }
        return $Silian_sanitized;
    }

    private function normalizeNullableInteger(mixed $Silian_value): ?int
    {
        if ($Silian_value === null) {
            return null;
        }

        if (is_string($Silian_value)) {
            $Silian_trimmed = trim($Silian_value);
            if ($Silian_trimmed === '') {
                return null;
            }
            if (ctype_digit($Silian_trimmed) || preg_match('/^-?\d+$/', $Silian_trimmed) === 1) {
                return (int) $Silian_trimmed;
            }

            return null;
        }

        if (is_int($Silian_value)) {
            return $Silian_value;
        }

        if (is_float($Silian_value)) {
            return (int) $Silian_value;
        }

        if (is_numeric($Silian_value)) {
            return (int) $Silian_value;
        }

        return null;
    }

    private function sanitizeData(array $Silian_data): ?string
    {
        $Silian_sanitized = [];
        foreach ($Silian_data as $Silian_key => $Silian_value) {
            if (in_array(strtolower($Silian_key), $this->sensitiveFields, true)) {
                $Silian_sanitized[$Silian_key] = '[REDACTED]';
                continue;
            }
            if (is_array($Silian_value) || is_object($Silian_value)) {
                try {
                    $Silian_sanitized[$Silian_key] = json_encode($Silian_value, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
                } catch (JsonException $Silian_e) {
                    $Silian_sanitized[$Silian_key] = '[JSON_ERROR]';
                }
            } else {
                $Silian_sanitized[$Silian_key] = $Silian_value;
            }
        }
        try {
            $Silian_json = json_encode($Silian_sanitized, JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR);
            return $this->truncateData($Silian_json);
        } catch (JsonException $Silian_e) {
            return null;
        }
    }

    private function truncateData(string $Silian_data): string
    {
        if (mb_strlen($Silian_data, 'UTF-8') > $this->maxDataLength) {
            return mb_substr($Silian_data, 0, $this->maxDataLength, 'UTF-8') . '...[TRUNCATED]';
        }
        return $Silian_data;
    }

    private function getRequestData(): array
    {
        return [
            'method' => $_SERVER['REQUEST_METHOD'] ?? null,
            'uri' => $_SERVER['REQUEST_URI'] ?? null,
            'query' => $_GET,
            'headers' => function_exists('getallheaders') ? (getallheaders() ?: []) : [],
            'timestamp' => date('Y-m-d H:i:s')
        ];
    }

    private function determineChangeType(?array $Silian_oldData, ?array $Silian_newData): string
    {
        if ($Silian_oldData === null && $Silian_newData !== null) return 'create';
        if ($Silian_oldData !== null && $Silian_newData === null) return 'delete';
        if ($Silian_oldData !== null && $Silian_newData !== null) return 'update';
        if ($Silian_oldData === null && $Silian_newData === null) return 'read';
        return 'other';
    }

    private function resolveUserUuid(array $Silian_data): ?string
    {
        $Silian_explicit = $Silian_data['user_uuid'] ?? $Silian_data['uuid'] ?? $Silian_data['userUuid'] ?? null;
        if (is_string($Silian_explicit)) {
            $Silian_trimmed = strtolower(trim($Silian_explicit));
            if ($Silian_trimmed !== '') {
                return $Silian_trimmed;
            }
        }

        $Silian_userId = $Silian_data['user_id'] ?? null;
        if (is_int($Silian_userId) || (is_numeric($Silian_userId) && (string) (int) $Silian_userId === (string) $Silian_userId)) {
            return $this->lookupUserUuidById((int) $Silian_userId);
        }

        return null;
    }

    private function lookupUserUuidById(int $Silian_userId): ?string
    {
        if ($Silian_userId <= 0) {
            return null;
        }

        if (array_key_exists($Silian_userId, $this->userUuidCache)) {
            return $this->userUuidCache[$Silian_userId];
        }

        try {
            $Silian_stmt = $this->db->prepare('SELECT uuid FROM users WHERE id = :id LIMIT 1');
            if (!$Silian_stmt) {
                return null;
            }
            $Silian_stmt->execute(['id' => $Silian_userId]);
            $Silian_uuid = $Silian_stmt->fetchColumn();
            $Silian_normalized = is_string($Silian_uuid) && trim($Silian_uuid) !== '' ? strtolower(trim($Silian_uuid)) : null;
            $this->userUuidCache[$Silian_userId] = $Silian_normalized;
            return $Silian_normalized;
        } catch (\Throwable $Silian_e) {
            return null;
        }
    }

    public function getLastInsertId(): ?int
    {
        return $this->lastInsertId;
    }

    private function isWriteDisabled(): bool
    {
        if ($this->isProductionEnvironment()) {
            return false;
        }

        $Silian_raw = $_ENV['DISABLE_AUDIT_LOG_WRITES'] ?? $_SERVER['DISABLE_AUDIT_LOG_WRITES'] ?? null;
        if (!is_string($Silian_raw) && !is_numeric($Silian_raw) && !is_bool($Silian_raw)) {
            return false;
        }

        return filter_var($Silian_raw, FILTER_VALIDATE_BOOLEAN) === true;
    }

    private function isProductionEnvironment(): bool
    {
        $Silian_env = strtolower(trim((string) ($_ENV['APP_ENV'] ?? $_SERVER['APP_ENV'] ?? '')));
        return $Silian_env === 'production';
    }
}
