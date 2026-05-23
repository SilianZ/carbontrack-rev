<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use PDO;
use Monolog\Logger;

/**
 * SystemLogService
 * 负责持久化请求级别系统日志，不抛异常影响主流程。
 */
class SystemLogService
{
    private PDO $db;
    private Logger $logger;
    /** @var array<int, string|null> */
    private array $userUuidCache = [];

    // 截断阈值，防止巨大请求/响应撑爆日志表
    private int $maxBodyLength = 8000; // characters

    public function __construct(PDO $Silian_db, Logger $Silian_logger)
    {
        $this->db = $Silian_db;
        $this->logger = $Silian_logger;
    }

    public function log(array $Silian_data): ?int
    {
        if ($this->isWriteDisabled()) {
            return null;
        }

        try {
            $Silian_requestId = $Silian_data['request_id'] ?? null;
            if ($Silian_requestId !== null) {
                $Silian_requestId = substr((string) $Silian_requestId, 0, 64);
            }
            $Silian_requestBody = $this->sanitizeBody($Silian_data['request_body'] ?? null);
            $Silian_responseBody = $this->sanitizeBody($Silian_data['response_body'] ?? null);
            $Silian_serverMeta = $this->buildServerMeta(
                $Silian_data['server_params'] ?? [],
                [
                    'method' => $Silian_data['method'] ?? null,
                    'path' => $Silian_data['path'] ?? null,
                    'ip_address' => $Silian_data['ip_address'] ?? null,
                ]
            );
            $Silian_userUuid = $this->resolveUserUuid($Silian_data);

            // 为了兼容 MySQL 和 SQLite，采用字符串形式写 created_at，使用默认的 CURRENT_TIMESTAMP 进行处理
            $Silian_stmt = $this->db->prepare("INSERT INTO system_logs (
                request_id, method, path, status_code, user_id, user_uuid, ip_address, user_agent, duration_ms, request_body, response_body, server_meta
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)");

            $Silian_stmt->execute([
                $Silian_requestId,
                $Silian_data['method'] ?? null,
                $Silian_data['path'] ?? null,
                $Silian_data['status_code'] ?? null,
                $Silian_data['user_id'] ?? null,
                $Silian_userUuid,
                $Silian_data['ip_address'] ?? null,
                $Silian_data['user_agent'] ?? null,
                $Silian_data['duration_ms'] ?? null,
                $Silian_requestBody,
                $Silian_responseBody,
                $Silian_serverMeta
            ]);
            $Silian_id = (int) $this->db->lastInsertId();
            return $Silian_id > 0 ? $Silian_id : null;
        } catch (\Throwable $Silian_e) {
            // 记录系统日志插入失败的警告，不影响主流程
            try {
                $this->logger->warning('System log insert failed', [
                    'error' => $Silian_e->getMessage(),
                ]);
            } catch (\Throwable $Silian_ignore) {
                // swallow secondary logging failure
            }
        }
        return null;
    }

    private function sanitizeBody($Silian_body): ?string
    {
        if ($Silian_body === null) {
            return null;
        }
        if (is_array($Silian_body)) {
            // 复制数组并脱敏常见敏感字段
            $Silian_clone = $Silian_body;
            $Silian_sensitive = ['password','pass','token','authorization','auth','secret'];
            foreach ($Silian_sensitive as $Silian_key) {
                if (isset($Silian_clone[$Silian_key])) { $Silian_clone[$Silian_key] = '[REDACTED]'; }
            }
            $Silian_body = json_encode($Silian_clone, JSON_UNESCAPED_UNICODE);
        } elseif (!is_string($Silian_body)) {
            $Silian_body = json_encode($Silian_body, JSON_UNESCAPED_UNICODE);
        }

        if ($Silian_body === false) {
            return null;
        }

        if (mb_strlen($Silian_body, 'UTF-8') > $this->maxBodyLength) {
            $Silian_body = mb_substr($Silian_body, 0, $this->maxBodyLength, 'UTF-8') . '...[TRUNCATED]';
        }
        return $Silian_body;
    }

    private function buildServerMeta(array $Silian_server, array $Silian_summaryOverride = []): string
    {
        $Silian_clone = $Silian_server;
        $Silian_sensitiveKeys = ['HTTP_AUTHORIZATION','PHP_AUTH_PW','HTTP_COOKIE'];
        foreach ($Silian_sensitiveKeys as $Silian_k) {
            if (isset($Silian_clone[$Silian_k])) { $Silian_clone[$Silian_k] = '[REDACTED]'; }
        }
        $Silian_clone['_summary'] = [
            'method' => $this->resolveSummaryMethod($Silian_clone, $Silian_summaryOverride),
            'uri' => $this->resolveSummaryUri($Silian_clone, $Silian_summaryOverride),
            'ip' => $this->resolveSummaryIp($Silian_clone, $Silian_summaryOverride),
        ];
        $Silian_json = json_encode($Silian_clone, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($Silian_json === false) { return '{}'; }
        if (strlen($Silian_json) > 120000) { // 防止爆炸日志撑满磁盘
            $Silian_json = substr($Silian_json, 0, 120000) . '...[TRUNCATED]';
        }
        return $Silian_json;
    }

    private function resolveSummaryMethod(array $Silian_server, array $Silian_context): ?string
    {
        return $this->firstNonEmptyString([
            $Silian_context['method'] ?? null,
            $Silian_server['REQUEST_METHOD'] ?? null,
            $_SERVER['REQUEST_METHOD'] ?? null,
        ]);
    }

    private function resolveSummaryUri(array $Silian_server, array $Silian_context): ?string
    {
        $Silian_uri = $this->firstNonEmptyString([
            $Silian_server['REQUEST_URI'] ?? null,
            $_SERVER['REQUEST_URI'] ?? null,
        ]);
        if ($Silian_uri !== null) {
            return $Silian_uri;
        }

        return $this->firstNonEmptyString([
            $Silian_context['path'] ?? null,
            $Silian_server['PATH_INFO'] ?? null,
            $_SERVER['PATH_INFO'] ?? null,
        ]);
    }

    private function resolveSummaryIp(array $Silian_server, array $Silian_context): ?string
    {
        $Silian_candidates = [
            $Silian_server['HTTP_CF_CONNNECTING_IP'] ?? null, // common typo with double N
            $_SERVER['HTTP_CF_CONNNECTING_IP'] ?? null,
            $Silian_server['HTTP_CF_CONNECTING_IP'] ?? null,
            $_SERVER['HTTP_CF_CONNECTING_IP'] ?? null,
            $Silian_server['CF_CONNECTING_IP'] ?? null,
            $_SERVER['CF_CONNECTING_IP'] ?? null,
            $Silian_context['ip_address'] ?? null,
            $Silian_server['REMOTE_ADDR'] ?? null,
            $_SERVER['REMOTE_ADDR'] ?? null,
        ];

        foreach ($Silian_candidates as $Silian_raw) {
            if (!is_string($Silian_raw)) {
                continue;
            }
            $Silian_trimmed = trim($Silian_raw);
            if ($Silian_trimmed === '') {
                continue;
            }
            $Silian_first = trim(explode(',', $Silian_trimmed)[0]);
            if ($Silian_first === '') {
                continue;
            }
            if (filter_var($Silian_first, FILTER_VALIDATE_IP)) {
                return $Silian_first;
            }
        }

        return null;
    }

    private function firstNonEmptyString(array $Silian_candidates): ?string
    {
        foreach ($Silian_candidates as $Silian_candidate) {
            if (!is_string($Silian_candidate)) {
                continue;
            }
            $Silian_trimmed = trim($Silian_candidate);
            if ($Silian_trimmed === '') {
                continue;
            }
            return $Silian_trimmed;
        }
        return null;
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

    private function isWriteDisabled(): bool
    {
        if ($this->isProductionEnvironment()) {
            return false;
        }

        $Silian_raw = $_ENV['DISABLE_SYSTEM_LOG_WRITES'] ?? $_SERVER['DISABLE_SYSTEM_LOG_WRITES'] ?? null;
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

