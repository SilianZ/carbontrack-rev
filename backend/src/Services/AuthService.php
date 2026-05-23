<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Support\Uuid;
use CarbonTrack\Support\SyntheticRequestFactory;
use Firebase\JWT\JWT;
use Firebase\JWT\Key;
use Psr\Http\Message\ServerRequestInterface as Request;
use PDO;

class AuthService
{
    private string $jwtSecret;
    private string $jwtAlgorithm;
    private int $jwtExpiration;
    private ?PDO $db = null;
    private ?AuditLogService $auditLogService;
    private ?ErrorLogService $errorLogService;

    public function __construct(
        string $Silian_jwtSecret,
        string $Silian_jwtAlgorithm = 'HS256',
        int $Silian_jwtExpiration = 86400,
        ?AuditLogService $Silian_auditLogService = null,
        ?ErrorLogService $Silian_errorLogService = null
    )
    {
        $this->jwtSecret = $Silian_jwtSecret;
        $this->jwtAlgorithm = $Silian_jwtAlgorithm;
        $this->jwtExpiration = $Silian_jwtExpiration;
        $this->auditLogService = $Silian_auditLogService;
        $this->errorLogService = $Silian_errorLogService;
    }

    public function setDatabase(PDO $Silian_db): void
    {
        $this->db = $Silian_db;
    }

    /**
     * 生成JWT令牌
     */
    public function generateToken(array $Silian_user): string
    {
        $Silian_normalizedUser = $this->normalizeAuthenticatedUser($Silian_user);
        $Silian_subject = $Silian_normalizedUser['uuid'] ?? null;
        if ($Silian_subject === null && isset($Silian_normalizedUser['id'])) {
            $Silian_subject = (string) $Silian_normalizedUser['id'];
        }
        if ($Silian_subject === null || $Silian_subject === '') {
            throw new \RuntimeException('Unable to generate token without a stable subject');
        }

        $Silian_now = time();
        $Silian_payload = [
            'iss' => 'carbontrack',
            'aud' => 'carbontrack-users',
            'iat' => $Silian_now,
            'exp' => $Silian_now + $this->jwtExpiration,
            'sub' => $Silian_subject,
            'user' => [
                'id' => $Silian_normalizedUser['id'] ?? null,
                'uuid' => $Silian_normalizedUser['uuid'] ?? null,
                'username' => $Silian_normalizedUser['username'] ?? null,
                'email' => $Silian_normalizedUser['email'] ?? null,
                'points' => (int)($Silian_normalizedUser['points'] ?? 0),
                'role' => $Silian_normalizedUser['role'] ?? 'user',
                'is_admin' => (bool)($Silian_normalizedUser['is_admin'] ?? 0),
                'is_support' => (bool)($Silian_normalizedUser['is_support'] ?? false),
            ]
        ];

        return JWT::encode($Silian_payload, $this->jwtSecret, $this->jwtAlgorithm);
    }

    /**
     * 验证JWT令牌
     */
    public function verifyToken(string $Silian_token): ?array
    {
        try {
            // 允许少量时钟偏移，默认 60 秒，可通过环境变量 JWT_LEEWAY 配置
            if (class_exists(\Firebase\JWT\JWT::class)) {
                $Silian_leeway = isset($_ENV['JWT_LEEWAY']) ? (int)$_ENV['JWT_LEEWAY'] : 60;
                if ($Silian_leeway > 0) {
                    \Firebase\JWT\JWT::$leeway = $Silian_leeway;
                }
            }
            $Silian_decoded = JWT::decode($Silian_token, new Key($this->jwtSecret, $this->jwtAlgorithm));
            return (array)$Silian_decoded;
        } catch (\Exception $Silian_e) {
            return null;
        }
    }

    /**
     * Backward-compatible validateToken used by middleware/tests
     * Returns a normalized payload array or throws an exception on failure
     */
    public function validateToken(string $Silian_token): array
    {
        $Silian_decoded = $this->verifyToken($Silian_token);
        if (!$Silian_decoded) {
            throw new \RuntimeException('Invalid token');
        }

        $Silian_subject = isset($Silian_decoded['sub']) ? trim((string) $Silian_decoded['sub']) : null;
        $Silian_user = [];
        if (isset($Silian_decoded['user'])) {
            $Silian_user = (array) $Silian_decoded['user'];
        } elseif ($Silian_subject !== null && $Silian_subject !== '') {
            if (Uuid::isValid($Silian_subject)) {
                $Silian_user['uuid'] = strtolower($Silian_subject);
            } elseif (ctype_digit($Silian_subject)) {
                $Silian_user['id'] = (int) $Silian_subject;
            }
        }

        if ($Silian_user === []) {
            throw new \RuntimeException('Invalid token');
        }

        $Silian_normalizedUser = $this->normalizeAuthenticatedUser($Silian_user, $Silian_subject);
        return [
            'user_id' => $Silian_normalizedUser['id'] ?? null,
            'uuid' => $Silian_normalizedUser['uuid'] ?? null,
            'email' => $Silian_normalizedUser['email'] ?? null,
            'role' => $Silian_normalizedUser['role'] ?? 'user',
            'user' => $Silian_normalizedUser,
        ];
    }

    /**
     * 从请求中获取当前用户
     */
    public function getCurrentUser(Request $Silian_request): ?array
    {
        $Silian_authenticatedUser = $Silian_request->getAttribute('authenticated_user');
        if (is_array($Silian_authenticatedUser)) {
            return $Silian_authenticatedUser;
        }

        $Silian_tokenPayload = $Silian_request->getAttribute('token_payload');
        if (is_array($Silian_tokenPayload) && isset($Silian_tokenPayload['user']) && is_array($Silian_tokenPayload['user'])) {
            return $Silian_tokenPayload['user'];
        }

        $Silian_authHeader = $Silian_request->getHeaderLine('Authorization');

        if (empty($Silian_authHeader)) {
            return null;
        }

        // 检查Bearer token格式
        if (!preg_match('/Bearer\s+(.*)$/i', $Silian_authHeader, $Silian_matches)) {
            return null;
        }

        $Silian_token = $Silian_matches[1];
        $Silian_decoded = $this->verifyToken($Silian_token);

        if (!$Silian_decoded || !isset($Silian_decoded['user'])) {
            try {
                $Silian_payload = $this->validateToken($Silian_token);
                return is_array($Silian_payload['user'] ?? null) ? $Silian_payload['user'] : null;
            } catch (\Throwable $Silian_e) {
                return null;
            }
        }

        try {
            $Silian_payload = $this->validateToken($Silian_token);
            return is_array($Silian_payload['user'] ?? null) ? $Silian_payload['user'] : null;
        } catch (\Throwable $Silian_e) {
            return null;
        }
    }

    /**
     * Get current user model
     */
    public function getCurrentUserModel(Request $Silian_request): ?\CarbonTrack\Models\User
    {
        $Silian_userData = $this->getCurrentUser($Silian_request);
        if (!$Silian_userData) {
            return null;
        }

        $Silian_userId = $this->normalizeUserId($Silian_userData['id'] ?? null);
        if ($Silian_userId !== null) {
            return \CarbonTrack\Models\User::find($Silian_userId);
        }

        $Silian_userUuid = $this->normalizeUuidValue($Silian_userData['uuid'] ?? null);
        if ($Silian_userUuid !== null) {
            return \CarbonTrack\Models\User::query()->where('uuid', $Silian_userUuid)->first();
        }

        return null;
    }

    /**
     * 检查用户是否为管理员
     */
    public function isAdmin(Request $Silian_request): bool
    {
        $Silian_user = $this->getCurrentUser($Silian_request);
        return $Silian_user && $Silian_user['is_admin'];
    }

    /**
     * Get user ID from request
     *
     * @param Request $request
     * @return int|null
     */
    public function getUserIdFromRequest(Request $Silian_request): ?int
    {
        $Silian_user = $this->getCurrentUser($Silian_request);
        return $this->normalizeUserId($Silian_user['id'] ?? null);
    }

    /**
     * 验证密码强度
     */
    public function validatePasswordStrength(string $Silian_password): array
    {
        $Silian_errors = [];

        if (strlen($Silian_password) < 8) {
            $Silian_errors[] = 'Password must be at least 8 characters long';
        }

        if (!preg_match('/[A-Z]/', $Silian_password)) {
            $Silian_errors[] = 'Password must contain at least one uppercase letter';
        }

        if (!preg_match('/[a-z]/', $Silian_password)) {
            $Silian_errors[] = 'Password must contain at least one lowercase letter';
        }

        if (!preg_match('/[0-9]/', $Silian_password)) {
            $Silian_errors[] = 'Password must contain at least one number';
        }

        return [
            'valid' => empty($Silian_errors),
            'errors' => $Silian_errors
        ];
    }

    /**
     * 生成安全的随机令牌
     */
    public function generateSecureToken(int $Silian_length = 32): string
    {
        return bin2hex(random_bytes($Silian_length));
    }

    /**
     * 验证邮箱格式
     */
    public function validateEmail(string $Silian_email): bool
    {
        return filter_var($Silian_email, FILTER_VALIDATE_EMAIL) !== false;
    }

    /**
     * 检查用户名是否可用
     */
    public function isUsernameAvailable(string $Silian_username, ?int $Silian_excludeUserId = null): bool
    {
        if ($this->db === null) {
            throw new \RuntimeException('Database not set');
        }

        $Silian_sql = "SELECT COUNT(*) FROM users WHERE username = ? AND deleted_at IS NULL";
        $Silian_params = [$Silian_username];

        if ($Silian_excludeUserId) {
            $Silian_sql .= " AND id != ?";
            $Silian_params[] = $Silian_excludeUserId;
        }

        $Silian_stmt = $this->db->prepare($Silian_sql);
        if (!$Silian_stmt) {
            return true;
        }
        $Silian_stmt->execute($Silian_params);

        return $Silian_stmt->fetchColumn() == 0;
    }

    /**
     * 检查邮箱是否可用
     */
    public function isEmailAvailable(string $Silian_email, ?int $Silian_excludeUserId = null): bool
    {
        if ($this->db === null) {
            throw new \RuntimeException('Database not set');
        }

        $Silian_sql = "SELECT COUNT(*) FROM users WHERE email = ? AND deleted_at IS NULL";
        $Silian_params = [$Silian_email];

        if ($Silian_excludeUserId) {
            $Silian_sql .= " AND id != ?";
            $Silian_params[] = $Silian_excludeUserId;
        }

        $Silian_stmt = $this->db->prepare($Silian_sql);
        if (!$Silian_stmt) {
            return true;
        }
        $Silian_stmt->execute($Silian_params);

        return $Silian_stmt->fetchColumn() == 0;
    }

    /**
     * 生成UUID
     */
    public function generateUUID(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }

    /**
     * 哈希密码
     */
    public function hashPassword(string $Silian_password): string
    {
        return password_hash($Silian_password, PASSWORD_DEFAULT);
    }

    /**
     * 验证密码
     */
    public function verifyPassword(string $Silian_password, string $Silian_hash): bool
    {
        return password_verify($Silian_password, $Silian_hash);
    }

    /**
     * 检查令牌是否过期
     */
    public function isTokenExpired(array $Silian_decoded): bool
    {
        return isset($Silian_decoded['exp']) && $Silian_decoded['exp'] < time();
    }

    /**
     * 刷新令牌
     */
    public function refreshToken(string $Silian_token): ?string
    {
        $Silian_decoded = $this->verifyToken($Silian_token);

        if (!$Silian_decoded || $this->isTokenExpired($Silian_decoded)) {
            return null;
        }

        // 如果令牌在30分钟内过期，则刷新
        if ($Silian_decoded['exp'] - time() < 1800) {
            $Silian_user = (array)$Silian_decoded['user'];
            return $this->generateToken($Silian_user);
        }

        return $Silian_token;
    }

    /**
     * 获取令牌剩余时间
     */
    public function getTokenRemainingTime(string $Silian_token): ?int
    {
        $Silian_decoded = $this->verifyToken($Silian_token);

        if (!$Silian_decoded || !isset($Silian_decoded['exp'])) {
            return null;
        }

        $Silian_remaining = $Silian_decoded['exp'] - time();
        return $Silian_remaining > 0 ? $Silian_remaining : 0;
    }

    /**
     * 验证用户权限
     */
    public function hasPermission(Request $Silian_request, string $Silian_permission): bool
    {
        $Silian_user = $this->getCurrentUser($Silian_request);

        if (!$Silian_user) {
            return false;
        }

        // 管理员拥有所有权限
        if ($Silian_user['is_admin']) {
            return true;
        }

        // 这里可以扩展更复杂的权限系统
        switch ($Silian_permission) {
            case 'view_own_data':
                return true;
            case 'edit_own_profile':
                return true;
            case 'submit_carbon_record':
                return true;
            case 'exchange_products':
                return true;
            default:
                return false;
        }
    }

    /**
     * 记录登录尝试
     */
    public function recordLoginAttempt(string $Silian_username, string $Silian_ip, bool $Silian_success): void
    {
        if ($this->db === null) {
            return;
        }

        try {
            $Silian_stmt = $this->db->prepare("
                INSERT INTO login_attempts (username, ip_address, success, attempted_at)
                VALUES (?, ?, ?, NOW())
            ");
            $Silian_stmt->execute([$Silian_username, $Silian_ip, $Silian_success ? 1 : 0]);
        } catch (\Exception $Silian_e) {
            $this->logAudit('auth_login_attempt_record_failed', [
                'username' => $Silian_username,
                'ip_address' => $Silian_ip,
                'success' => $Silian_success,
            ], 'failed');
            $this->logError($Silian_e, '/internal/auth/login-attempts', 'Failed to record login attempt', [
                'username' => $Silian_username,
                'ip_address' => $Silian_ip,
                'success' => $Silian_success,
            ]);
            // 记录失败不应该影响主要流程
        }
    }

    /**
     * 检查是否被锁定（防暴力破解）
     */
    public function isAccountLocked(string $Silian_username, string $Silian_ip): bool
    {
        if ($this->db === null) {
            return false;
        }

        try {
            // 检查最近15分钟内的失败尝试次数
            $Silian_stmt = $this->db->prepare("
                SELECT COUNT(*)
                FROM login_attempts
                WHERE (username = ? OR ip_address = ?)
                AND success = 0
                AND attempted_at > DATE_SUB(NOW(), INTERVAL 15 MINUTE)
            ");
            $Silian_stmt->execute([$Silian_username, $Silian_ip]);

            $Silian_failedAttempts = $Silian_stmt->fetchColumn();

            // 超过5次失败尝试则锁定
            $Silian_isLocked = $Silian_failedAttempts >= 5;
            if ($Silian_isLocked) {
                $this->logAudit('auth_account_locked', [
                    'username' => $Silian_username,
                    'ip_address' => $Silian_ip,
                    'failed_attempts' => (int) $Silian_failedAttempts,
                    'window_minutes' => 15,
                ]);
            }

            return $Silian_isLocked;
        } catch (\Exception $Silian_e) {
            $this->logAudit('auth_lock_status_check_failed', [
                'username' => $Silian_username,
                'ip_address' => $Silian_ip,
            ], 'failed');
            $this->logError($Silian_e, '/internal/auth/lock-status', 'Failed to check account lock status', [
                'username' => $Silian_username,
                'ip_address' => $Silian_ip,
            ]);
            return false;
        }
    }

    /**
     * 清理过期的登录尝试记录
     */
    public function cleanupLoginAttempts(): void
    {
        if ($this->db === null) {
            return;
        }

        try {
            $Silian_stmt = $this->db->prepare("
                DELETE FROM login_attempts
                WHERE attempted_at < DATE_SUB(NOW(), INTERVAL 24 HOUR)
            ");
            $Silian_stmt->execute();
            $Silian_deletedCount = $Silian_stmt->rowCount();
            if ($Silian_deletedCount > 0) {
                $this->logAudit('auth_login_attempts_cleanup_completed', [
                    'deleted_count' => $Silian_deletedCount,
                    'retention_hours' => 24,
                ]);
            }
        } catch (\Exception $Silian_e) {
            $this->logAudit('auth_login_attempts_cleanup_failed', [
                'retention_hours' => 24,
            ], 'failed');
            $this->logError($Silian_e, '/internal/auth/login-attempts/cleanup', 'Failed to cleanup login attempts', [
                'retention_hours' => 24,
            ]);
            // 清理失败不应该影响主要流程
        }
    }

    /**
     * 生成JWT令牌 (别名方法，用于测试)
     */
    public function generateJwtToken(array $Silian_user): string
    {
        return $this->generateToken($Silian_user);
    }

    /**
     * 验证JWT令牌 (别名方法，用于测试)
     */
    public function validateJwtToken(string $Silian_token): ?array
    {
        $Silian_decoded = $this->verifyToken($Silian_token);
        if (!$Silian_decoded) {
            return null;
        }
        // 统一过期校验：若 exp < 当前时间则视为无效
        if (isset($Silian_decoded['exp']) && $Silian_decoded['exp'] < time()) {
            return null;
        }
        return $Silian_decoded;
    }

    /**
     * 检查用户是否为管理员 (重载方法，支持数组参数用于测试)
     */
    public function isAdminUser($Silian_user): bool
    {
        if (is_array($Silian_user)) {
            return $Silian_user['is_admin'] ?? false;
        }

        if ($Silian_user instanceof Request) {
            return $this->isAdmin($Silian_user);
        }

        return false;
    }

    public function isSupportUser($Silian_user): bool
    {
        if (is_array($Silian_user)) {
            if (!empty($Silian_user['is_admin']) || !empty($Silian_user['is_support'])) {
                return true;
            }

            return in_array((string) ($Silian_user['role'] ?? 'user'), ['support', 'admin'], true);
        }

        if ($Silian_user instanceof Request) {
            $Silian_current = $this->getCurrentUser($Silian_user);
            return is_array($Silian_current) ? $this->isSupportUser($Silian_current) : false;
        }

        return false;
    }

    /**
     * @param array<string,mixed> $user
     * @return array<string,mixed>
     */
    public function normalizeUserRoleView(array $Silian_user): array
    {
        return $this->normalizeRoleFlags($Silian_user);
    }

    /**
     * Normalize a token/user payload into a local authenticated user context.
     *
     * UUID is treated as the stable cross-site subject. The local numeric user ID
     * is resolved lazily from the current site's users table and kept for
     * intra-site business logic.
     *
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    private function normalizeAuthenticatedUser(array $Silian_user, ?string $Silian_subject = null): array
    {
        $Silian_userId = $this->normalizeUserId($Silian_user['id'] ?? $Silian_user['user_id'] ?? null);
        $Silian_userUuid = $this->normalizeUuidValue($Silian_user['uuid'] ?? $Silian_user['user_uuid'] ?? null);
        $Silian_subjectUuid = $this->normalizeUuidValue($Silian_subject);

        if ($Silian_userUuid === null && $Silian_subjectUuid !== null) {
            $Silian_userUuid = $Silian_subjectUuid;
        }

        if ($Silian_userId !== null && $Silian_userUuid === null) {
            $Silian_userUuid = $this->ensureUserUuidForLocalId($Silian_userId, $Silian_userUuid) ?? $Silian_userUuid;
        }

        $Silian_localUser = null;
        if ($Silian_userUuid !== null) {
            $Silian_localUser = $this->findLocalUserByUuid($Silian_userUuid);
            if ($Silian_localUser === null) {
                $Silian_localUser = $this->provisionLocalUserForUuid($Silian_userUuid, $Silian_user);
            }
        }

        if ($Silian_localUser === null && $Silian_userId !== null) {
            $Silian_localUser = $this->findLocalUserById($Silian_userId);
        }

        if ($Silian_localUser !== null) {
            $Silian_userId = $this->normalizeUserId($Silian_localUser['id'] ?? null) ?? $Silian_userId;
            $Silian_userUuid = $this->normalizeUuidValue($Silian_localUser['uuid'] ?? null) ?? $Silian_userUuid;
            $Silian_user = array_merge($Silian_user, $Silian_localUser);
        }

        if ($Silian_userId !== null) {
            $Silian_user['id'] = $Silian_userId;
        }
        if ($Silian_userUuid !== null) {
            $Silian_user['uuid'] = $Silian_userUuid;
        }

        if (array_key_exists('points', $Silian_user)) {
            $Silian_user['points'] = (int) ($Silian_user['points'] ?? 0);
        }

        return $this->normalizeRoleFlags($Silian_user);
    }

    /**
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    private function normalizeRoleFlags(array $Silian_user): array
    {
        $Silian_explicitRole = is_string($Silian_user['role'] ?? null) ? strtolower(trim((string) $Silian_user['role'])) : '';
        if (!in_array($Silian_explicitRole, ['user', 'support', 'admin'], true)) {
            $Silian_explicitRole = '';
        }

        $Silian_isAdmin = !empty($Silian_user['is_admin']) || $Silian_explicitRole === 'admin';
        $Silian_role = $Silian_isAdmin ? 'admin' : ($Silian_explicitRole !== '' ? $Silian_explicitRole : 'user');

        $Silian_user['is_admin'] = $Silian_isAdmin;
        $Silian_user['role'] = $Silian_role;
        $Silian_user['is_support'] = $Silian_isAdmin || $Silian_role === 'support';

        return $Silian_user;
    }

    private function normalizeUserId(mixed $Silian_value): ?int
    {
        if (is_int($Silian_value) && $Silian_value > 0) {
            return $Silian_value;
        }

        if (is_string($Silian_value) && ctype_digit($Silian_value)) {
            $Silian_parsed = (int) $Silian_value;
            return $Silian_parsed > 0 ? $Silian_parsed : null;
        }

        return null;
    }

    private function normalizeUuidValue(mixed $Silian_value): ?string
    {
        if (!is_string($Silian_value)) {
            return null;
        }

        $Silian_trimmed = strtolower(trim($Silian_value));
        if ($Silian_trimmed === '' || !Uuid::isValid($Silian_trimmed)) {
            return null;
        }

        return $Silian_trimmed;
    }

    /**
     * Ensure an existing local user has a persisted UUID.
     */
    private function ensureUserUuidForLocalId(int $Silian_userId, ?string $Silian_preferredUuid = null): ?string
    {
        if ($this->db === null) {
            return $Silian_preferredUuid;
        }

        $Silian_row = $this->findLocalUserById($Silian_userId);
        if ($Silian_row === null) {
            return $Silian_preferredUuid;
        }

        $Silian_existingUuid = $this->normalizeUuidValue($Silian_row['uuid'] ?? null);
        if ($Silian_existingUuid !== null) {
            return $Silian_existingUuid;
        }

        $Silian_finalUuid = $Silian_preferredUuid ?? strtolower($this->generateUUID());

        try {
            $Silian_stmt = $this->db->prepare('UPDATE users SET uuid = :uuid, updated_at = :updated_at WHERE id = :id AND deleted_at IS NULL');
            if (!$Silian_stmt) {
                return null;
            }
            $Silian_stmt->execute([
                'uuid' => $Silian_finalUuid,
                'updated_at' => date('Y-m-d H:i:s'),
                'id' => $Silian_userId,
            ]);
        } catch (\Throwable $Silian_e) {
            return null;
        }

        return $Silian_finalUuid;
    }

    /**
     * @param array<string, mixed> $identity
     * @return array<string, mixed>|null
     */
    private function provisionLocalUserForUuid(string $Silian_userUuid, array $Silian_identity): ?array
    {
        if ($this->db === null) {
            return null;
        }

        $Silian_candidate = $this->findBindableLocalUser($Silian_identity);
        if ($Silian_candidate !== null) {
            $Silian_candidateId = $this->normalizeUserId($Silian_candidate['id'] ?? null);
            $Silian_candidateUuid = $this->normalizeUuidValue($Silian_candidate['uuid'] ?? null);
            if ($Silian_candidateId === null) {
                return null;
            }
            if ($Silian_candidateUuid !== null && $Silian_candidateUuid !== $Silian_userUuid) {
                throw new \RuntimeException('Conflicting UUID for existing local user');
            }

            $Silian_stmt = $this->db->prepare('UPDATE users SET uuid = :uuid, updated_at = :updated_at WHERE id = :id');
            if (!$Silian_stmt) {
                return null;
            }
            $Silian_stmt->execute([
                'uuid' => $Silian_userUuid,
                'updated_at' => date('Y-m-d H:i:s'),
                'id' => $Silian_candidateId,
            ]);

            return $this->findLocalUserById($Silian_candidateId);
        }

        $Silian_username = $this->prepareProvisionedUsername($Silian_identity['username'] ?? null, $Silian_userUuid);
        $Silian_email = $this->prepareProvisionedEmail($Silian_identity['email'] ?? null);
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_password = $this->hashPassword(bin2hex(random_bytes(16)));

        $Silian_stmt = $this->db->prepare(
            'INSERT INTO users (uuid, username, email, password, role, status, points, is_admin, created_at, updated_at)
             VALUES (:uuid, :username, :email, :password, :role, :status, :points, :is_admin, :created_at, :updated_at)'
        );
        if (!$Silian_stmt) {
            return null;
        }
        $Silian_normalizedIdentity = $this->normalizeRoleFlags($Silian_identity);
        $Silian_stmt->execute([
            'uuid' => $Silian_userUuid,
            'username' => $Silian_username,
            'email' => $Silian_email,
            'password' => $Silian_password,
            'role' => $Silian_normalizedIdentity['role'],
            'status' => isset($Silian_identity['status']) && is_string($Silian_identity['status']) && trim($Silian_identity['status']) !== ''
                ? trim((string) $Silian_identity['status'])
                : 'active',
            'points' => 0,
            'is_admin' => !empty($Silian_normalizedIdentity['is_admin']) ? 1 : 0,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        return $this->findLocalUserById((int) $this->db->lastInsertId());
    }

    /**
     * @param array<string, mixed> $identity
     * @return array<string, mixed>|null
     */
    private function findBindableLocalUser(array $Silian_identity): ?array
    {
        $Silian_email = $this->prepareProvisionedEmail($Silian_identity['email'] ?? null);
        if ($Silian_email !== null) {
            $Silian_row = $this->findLocalUserByEmail($Silian_email);
            if ($Silian_row !== null) {
                return $Silian_row;
            }
        }

        $Silian_username = isset($Silian_identity['username']) && is_string($Silian_identity['username'])
            ? trim((string) $Silian_identity['username'])
            : '';
        if ($Silian_username !== '') {
            return $this->findLocalUserByUsername($Silian_username);
        }

        return null;
    }

    private function prepareProvisionedEmail(mixed $Silian_email): ?string
    {
        if (!is_string($Silian_email)) {
            return null;
        }

        $Silian_trimmed = trim($Silian_email);
        if ($Silian_trimmed === '' || !filter_var($Silian_trimmed, FILTER_VALIDATE_EMAIL)) {
            return null;
        }

        $Silian_existing = $this->findLocalUserByEmail($Silian_trimmed);
        if ($Silian_existing !== null) {
            $Silian_existingUuid = $this->normalizeUuidValue($Silian_existing['uuid'] ?? null);
            if ($Silian_existingUuid !== null) {
                return null;
            }
        }

        return $Silian_trimmed;
    }

    private function prepareProvisionedUsername(mixed $Silian_username, string $Silian_userUuid): string
    {
        $Silian_base = is_string($Silian_username) ? trim($Silian_username) : '';
        if ($Silian_base === '') {
            $Silian_base = 'user-' . substr(str_replace('-', '', $Silian_userUuid), 0, 12);
        }

        $Silian_candidate = $Silian_base;
        $Silian_suffix = 1;
        while (!$this->isUsernameAvailable($Silian_candidate)) {
            $Silian_candidate = $Silian_base . '-' . $Silian_suffix;
            $Silian_suffix++;
        }

        return $Silian_candidate;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findLocalUserById(int $Silian_userId): ?array
    {
        if ($this->db === null) {
            return null;
        }

        $Silian_stmt = $this->db->prepare('SELECT * FROM users WHERE id = :id AND deleted_at IS NULL LIMIT 1');
        if (!$Silian_stmt) {
            return null;
        }
        $Silian_stmt->execute(['id' => $Silian_userId]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return $Silian_row ?: null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findLocalUserByUuid(string $Silian_userUuid): ?array
    {
        if ($this->db === null) {
            return null;
        }

        $Silian_stmt = $this->db->prepare('SELECT * FROM users WHERE uuid = :uuid AND deleted_at IS NULL LIMIT 1');
        if (!$Silian_stmt) {
            return null;
        }
        $Silian_stmt->execute(['uuid' => $Silian_userUuid]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return $Silian_row ?: null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findLocalUserByEmail(string $Silian_email): ?array
    {
        if ($this->db === null) {
            return null;
        }

        $Silian_stmt = $this->db->prepare('SELECT * FROM users WHERE email = :email AND deleted_at IS NULL LIMIT 1');
        if (!$Silian_stmt) {
            return null;
        }
        $Silian_stmt->execute(['email' => $Silian_email]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return $Silian_row ?: null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findLocalUserByUsername(string $Silian_username): ?array
    {
        if ($this->db === null) {
            return null;
        }

        $Silian_stmt = $this->db->prepare('SELECT * FROM users WHERE username = :username AND deleted_at IS NULL LIMIT 1');
        if (!$Silian_stmt) {
            return null;
        }
        $Silian_stmt->execute(['username' => $Silian_username]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return $Silian_row ?: null;
    }

    private function logAudit(string $Silian_action, array $Silian_context = [], string $Silian_status = 'success'): void
    {
        if (!$this->auditLogService) {
            return;
        }

        try {
            $this->auditLogService->log([
                'action' => $Silian_action,
                'operation_category' => 'authentication',
                'actor_type' => 'system',
                'status' => $Silian_status,
                'data' => $Silian_context,
            ]);
        } catch (\Throwable $Silian_ignore) {
            // ignore audit failures in auth helper service
        }
    }

    private function logError(\Throwable $Silian_e, string $Silian_path, string $Silian_message, array $Silian_context = []): void
    {
        if (!$this->errorLogService) {
            return;
        }

        try {
            $Silian_request = SyntheticRequestFactory::fromContext($Silian_path, 'POST', null, [], $Silian_context);
            $this->errorLogService->logException($Silian_e, $Silian_request, ['context_message' => $Silian_message] + $Silian_context);
        } catch (\Throwable $Silian_ignore) {
            // ignore error log failures in auth helper service
        }
    }
}

