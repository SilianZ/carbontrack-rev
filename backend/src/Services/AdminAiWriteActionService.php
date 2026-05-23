<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Support\InputValueNormalizer;
use PDO;

class AdminAiWriteActionService
{
    public function __construct(
        private PDO $db,
        private ?AuditLogService $auditLogService = null,
        private ?MessageService $messageService = null,
        private ?BadgeService $badgeService = null,
        private ?CronSchedulerService $cronSchedulerService = null
    ) {
    }

    /**
     * @param array<string,mixed> $payload
     * @param array<string,mixed> $logContext
     * @return array<string,mixed>
     */
    public function execute(string $Silian_actionName, array $Silian_payload, array $Silian_logContext = []): array
    {
        return match ($Silian_actionName) {
            'approve_carbon_records' => $this->reviewCarbonRecords('approve', $Silian_payload, $Silian_logContext),
            'reject_carbon_records' => $this->reviewCarbonRecords('reject', $Silian_payload, $Silian_logContext),
            'adjust_user_points' => $this->adjustUserPoints($Silian_payload, $Silian_logContext),
            'create_user' => $this->createUserAccount($Silian_payload, $Silian_logContext),
            'update_user_status' => $this->updateUserStatus($Silian_payload, $Silian_logContext),
            'award_badge_to_user' => $this->awardBadgeToUser($Silian_payload, $Silian_logContext),
            'revoke_badge_from_user' => $this->revokeBadgeFromUser($Silian_payload, $Silian_logContext),
            'update_exchange_status' => $this->updateExchangeStatus($Silian_payload, $Silian_logContext),
            'update_product_status' => $this->updateProductStatus($Silian_payload, $Silian_logContext),
            'adjust_product_inventory' => $this->adjustProductInventory($Silian_payload, $Silian_logContext),
            'update_cron_task' => $this->updateCronTask($Silian_payload, $Silian_logContext),
            'run_cron_task' => $this->runCronTask($Silian_payload, $Silian_logContext),
            default => throw new \RuntimeException('Unsupported write action: ' . $Silian_actionName),
        };
    }

    /**
     * @param array<string,mixed> $payload
     * @param array<string,mixed> $logContext
     * @return array<string,mixed>
     */
    private function updateCronTask(array $Silian_payload, array $Silian_logContext): array
    {
        if ($this->cronSchedulerService === null) {
            throw new \RuntimeException('Cron scheduler unavailable.');
        }

        $Silian_taskKey = trim((string) ($Silian_payload['task_key'] ?? ''));
        if ($Silian_taskKey === '') {
            throw new \InvalidArgumentException('task_key is required.');
        }

        $Silian_updatePayload = $this->normalizeCronTaskUpdatePayload($Silian_payload);
        if ($Silian_updatePayload === []) {
            throw new \InvalidArgumentException('No cron task fields provided.');
        }

        $Silian_result = $this->cronSchedulerService->updateTask($Silian_taskKey, $Silian_updatePayload);
        $Silian_adminId = isset($Silian_logContext['actor_id']) && is_numeric((string) $Silian_logContext['actor_id']) ? (int) $Silian_logContext['actor_id'] : null;
        $this->auditLogService?->logAdminOperation('admin_ai_cron_task_updated', $Silian_adminId, 'admin_ai', [
            'table' => 'cron_tasks',
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'endpoint' => $Silian_logContext['source'] ?? '/admin/ai/chat',
            'request_method' => 'POST',
            'conversation_id' => $Silian_logContext['conversation_id'] ?? null,
            'request_data' => ['task_key' => $Silian_taskKey] + $Silian_updatePayload,
            'new_data' => $Silian_result,
            'status' => 'success',
        ]);

        return [
            'action' => 'update_cron_task',
            'task' => $Silian_result,
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function normalizeCronTaskUpdatePayload(array $Silian_payload): array
    {
        $Silian_updatePayload = [];

        if (array_key_exists('enabled', $Silian_payload)) {
            $Silian_updatePayload['enabled'] = InputValueNormalizer::boolean($Silian_payload['enabled'], 'enabled');
        }

        if (array_key_exists('interval_minutes', $Silian_payload)) {
            $Silian_intervalMinutes = InputValueNormalizer::integer($Silian_payload['interval_minutes'], 'interval_minutes');
            if ($Silian_intervalMinutes < 1 || $Silian_intervalMinutes > 1440) {
                throw new \InvalidArgumentException('interval_minutes must be between 1 and 1440.');
            }
            $Silian_updatePayload['interval_minutes'] = $Silian_intervalMinutes;
        }

        if (array_key_exists('settings', $Silian_payload)) {
            $Silian_updatePayload['settings'] = $this->normalizeCronTaskSettings($Silian_payload['settings']);
        }

        return $Silian_updatePayload;
    }

    /**
     * @return array<string,mixed>
     */
    private function normalizeCronTaskSettings(mixed $Silian_settings): array
    {
        if (is_object($Silian_settings)) {
            try {
                $Silian_settings = json_decode(json_encode($Silian_settings, JSON_THROW_ON_ERROR), true, 512, JSON_THROW_ON_ERROR);
            } catch (\JsonException) {
                throw new \InvalidArgumentException('settings must be an object or array.');
            }
        }

        if (!is_array($Silian_settings)) {
            throw new \InvalidArgumentException('settings must be an object or array.');
        }

        return $Silian_settings;
    }

    /**
     * @param array<string,mixed> $payload
     * @param array<string,mixed> $logContext
     * @return array<string,mixed>
     */
    private function runCronTask(array $Silian_payload, array $Silian_logContext): array
    {
        if ($this->cronSchedulerService === null) {
            throw new \RuntimeException('Cron scheduler unavailable.');
        }

        $Silian_taskKey = trim((string) ($Silian_payload['task_key'] ?? ''));
        if ($Silian_taskKey === '') {
            throw new \InvalidArgumentException('task_key is required.');
        }

        $Silian_adminId = isset($Silian_logContext['actor_id']) && is_numeric((string) $Silian_logContext['actor_id']) ? (int) $Silian_logContext['actor_id'] : null;
        $Silian_result = $this->cronSchedulerService->runTaskNow($Silian_taskKey, 'admin_manual', [
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'admin_id' => $Silian_adminId,
            'conversation_id' => $Silian_logContext['conversation_id'] ?? null,
        ]);

        $this->auditLogService?->logAdminOperation('admin_ai_cron_task_triggered', $Silian_adminId, 'admin_ai', [
            'table' => 'cron_tasks',
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'endpoint' => $Silian_logContext['source'] ?? '/admin/ai/chat',
            'request_method' => 'POST',
            'conversation_id' => $Silian_logContext['conversation_id'] ?? null,
            'request_data' => ['task_key' => $Silian_taskKey],
            'new_data' => $Silian_result,
            'status' => ($Silian_result['status'] ?? null) === 'success' ? 'success' : 'failed',
        ]);

        if (($Silian_result['status'] ?? null) !== 'success') {
            throw new \RuntimeException($Silian_result['error_message'] ?? 'Cron task did not complete successfully.');
        }

        return [
            'action' => 'run_cron_task',
            'task_run' => $Silian_result,
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @param array<string,mixed> $logContext
     * @return array<string,mixed>
     */
    private function adjustUserPoints(array $Silian_payload, array $Silian_logContext): array
    {
        $Silian_user = $this->resolveUserRowFromPayload($Silian_payload);
        if ($Silian_user === null) {
            throw new \RuntimeException('User not found.');
        }

        $Silian_delta = isset($Silian_payload['delta']) && is_numeric((string) $Silian_payload['delta']) ? (float) $Silian_payload['delta'] : null;
        if ($Silian_delta === null || abs($Silian_delta) < 0.00001) {
            throw new \RuntimeException('Invalid points delta.');
        }

        $Silian_reason = isset($Silian_payload['reason']) ? trim((string) $Silian_payload['reason']) : null;
        if ($Silian_reason === '') {
            $Silian_reason = null;
        }

        $Silian_userId = (int) ($Silian_user['id'] ?? 0);
        $Silian_oldPoints = isset($Silian_user['points']) ? (int) $Silian_user['points'] : 0;
        $Silian_updatedAt = gmdate('Y-m-d H:i:s');

        $Silian_stmt = $this->db->prepare("UPDATE users
            SET points = COALESCE(points, 0) + :delta,
                updated_at = :updated_at
            WHERE id = :user_id
              AND deleted_at IS NULL");
        $Silian_stmt->execute([
            ':delta' => $Silian_delta,
            ':updated_at' => $Silian_updatedAt,
            ':user_id' => $Silian_userId,
        ]);

        $Silian_freshUser = $this->resolveUserRowFromPayload(['user_id' => $Silian_userId]);
        if ($Silian_freshUser === null) {
            throw new \RuntimeException('User not found after update.');
        }

        $Silian_adminId = isset($Silian_logContext['actor_id']) && is_numeric((string) $Silian_logContext['actor_id']) ? (int) $Silian_logContext['actor_id'] : null;
        $this->auditLogService?->logAdminOperation('user_points_adjusted', $Silian_adminId, 'user_management', [
            'table' => 'users',
            'record_id' => $Silian_userId,
            'old_data' => ['points' => $Silian_oldPoints],
            'new_data' => ['points' => isset($Silian_freshUser['points']) ? (int) $Silian_freshUser['points'] : 0],
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'endpoint' => $Silian_logContext['source'] ?? '/admin/ai/chat',
            'request_method' => 'POST',
            'conversation_id' => $Silian_logContext['conversation_id'] ?? null,
            'request_data' => [
                'delta' => $Silian_delta,
                'reason' => $Silian_reason,
                'user_uuid' => $Silian_freshUser['uuid'] ?? null,
            ],
        ]);

        return [
            'action' => 'adjust_user_points',
            'user' => [
                'id' => $Silian_userId,
                'uuid' => $Silian_freshUser['uuid'] ?? null,
                'username' => $Silian_freshUser['username'] ?? null,
                'email' => $Silian_freshUser['email'] ?? null,
                'points' => isset($Silian_freshUser['points']) ? (int) $Silian_freshUser['points'] : 0,
            ],
            'delta' => $Silian_delta,
            'old_points' => $Silian_oldPoints,
            'new_points' => isset($Silian_freshUser['points']) ? (int) $Silian_freshUser['points'] : 0,
            'reason' => $Silian_reason,
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @param array<string,mixed> $logContext
     * @return array<string,mixed>
     */
    private function createUserAccount(array $Silian_payload, array $Silian_logContext): array
    {
        $Silian_username = trim((string) ($Silian_payload['username'] ?? ''));
        if ($Silian_username === '') {
            throw new \RuntimeException('username is required.');
        }

        $Silian_email = strtolower(trim((string) ($Silian_payload['email'] ?? '')));
        if ($Silian_email === '' || filter_var($Silian_email, FILTER_VALIDATE_EMAIL) === false) {
            throw new \RuntimeException('A valid email is required.');
        }

        $Silian_password = isset($Silian_payload['password']) ? trim((string) $Silian_payload['password']) : '';
        $Silian_passwordHash = trim((string) ($Silian_payload['password_hash'] ?? ''));
        if ($Silian_password === '' && $Silian_passwordHash === '') {
            throw new \RuntimeException('password is required.');
        }

        $Silian_status = strtolower(trim((string) ($Silian_payload['status'] ?? 'active')));
        if ($Silian_status === '') {
            $Silian_status = 'active';
        }

        $Silian_normalizedIsAdmin = $this->normalizeBooleanFilter($Silian_payload['is_admin'] ?? false);
        $Silian_isAdmin = $Silian_normalizedIsAdmin === true ? 1 : 0;

        $Silian_schoolId = isset($Silian_payload['school_id']) && is_numeric((string) $Silian_payload['school_id'])
            ? (int) $Silian_payload['school_id']
            : null;
        if ($Silian_schoolId !== null && $Silian_schoolId > 0 && !$this->schoolExists($Silian_schoolId)) {
            throw new \RuntimeException('School not found.');
        }

        $Silian_groupId = isset($Silian_payload['group_id']) && is_numeric((string) $Silian_payload['group_id'])
            ? (int) $Silian_payload['group_id']
            : null;
        if ($Silian_groupId !== null && $Silian_groupId > 0 && !$this->groupExists($Silian_groupId)) {
            throw new \RuntimeException('User group not found.');
        }

        $Silian_regionCode = trim((string) ($Silian_payload['region_code'] ?? ''));
        $Silian_regionCode = $Silian_regionCode !== '' ? $Silian_regionCode : null;

        $Silian_adminNotes = trim((string) ($Silian_payload['admin_notes'] ?? ''));
        $Silian_adminNotes = $Silian_adminNotes !== '' ? $Silian_adminNotes : null;

        $Silian_usernameCheck = $this->db->prepare("SELECT id FROM users WHERE LOWER(username) = LOWER(:username) AND deleted_at IS NULL LIMIT 1");
        $Silian_usernameCheck->execute([':username' => $Silian_username]);
        if ($Silian_usernameCheck->fetch(PDO::FETCH_ASSOC) !== false) {
            throw new \RuntimeException('Username already exists.');
        }

        $Silian_emailCheck = $this->db->prepare("SELECT id FROM users WHERE LOWER(email) = LOWER(:email) AND deleted_at IS NULL LIMIT 1");
        $Silian_emailCheck->execute([':email' => $Silian_email]);
        if ($Silian_emailCheck->fetch(PDO::FETCH_ASSOC) !== false) {
            throw new \RuntimeException('Email already exists.');
        }

        if ($Silian_passwordHash === '') {
            $Silian_passwordHash = password_hash($Silian_password, PASSWORD_DEFAULT);
            if (!is_string($Silian_passwordHash) || $Silian_passwordHash === '') {
                throw new \RuntimeException('Unable to hash password.');
            }
        }

        $Silian_uuid = $this->generateEntityUuid();
        $Silian_timestamp = gmdate('Y-m-d H:i:s');
        $Silian_stmt = $this->db->prepare("INSERT INTO users
            (username, email, password, uuid, school_id, group_id, region_code, admin_notes, status, is_admin, created_at, updated_at)
            VALUES
            (:username, :email, :password, :uuid, :school_id, :group_id, :region_code, :admin_notes, :status, :is_admin, :created_at, :updated_at)");
        $Silian_stmt->execute([
            ':username' => $Silian_username,
            ':email' => $Silian_email,
            ':password' => $Silian_passwordHash,
            ':uuid' => $Silian_uuid,
            ':school_id' => $Silian_schoolId,
            ':group_id' => $Silian_groupId,
            ':region_code' => $Silian_regionCode,
            ':admin_notes' => $Silian_adminNotes,
            ':status' => $Silian_status,
            ':is_admin' => $Silian_isAdmin,
            ':created_at' => $Silian_timestamp,
            ':updated_at' => $Silian_timestamp,
        ]);

        $Silian_userId = (int) $this->db->lastInsertId();
        $Silian_freshUser = $this->resolveUserRowFromPayload(['user_id' => $Silian_userId]);
        if ($Silian_freshUser === null) {
            throw new \RuntimeException('User not found after creation.');
        }

        $Silian_adminId = isset($Silian_logContext['actor_id']) && is_numeric((string) $Silian_logContext['actor_id']) ? (int) $Silian_logContext['actor_id'] : null;
        $this->auditLogService?->logAdminOperation('user_created', $Silian_adminId, 'user_management', [
            'table' => 'users',
            'record_id' => $Silian_userId,
            'new_data' => [
                'username' => $Silian_freshUser['username'] ?? null,
                'email' => $Silian_freshUser['email'] ?? null,
                'uuid' => $Silian_freshUser['uuid'] ?? null,
                'status' => $Silian_freshUser['status'] ?? null,
                'is_admin' => isset($Silian_freshUser['is_admin']) ? (bool) $Silian_freshUser['is_admin'] : false,
                'school_id' => $Silian_freshUser['school_id'] ?? null,
                'group_id' => $Silian_freshUser['group_id'] ?? null,
                'region_code' => $Silian_freshUser['region_code'] ?? null,
            ],
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'endpoint' => $Silian_logContext['source'] ?? '/admin/ai/chat',
            'request_method' => 'POST',
            'conversation_id' => $Silian_logContext['conversation_id'] ?? null,
            'request_data' => [
                'username' => $Silian_username,
                'email' => $Silian_email,
                'status' => $Silian_status,
                'is_admin' => (bool) $Silian_isAdmin,
                'school_id' => $Silian_schoolId,
                'group_id' => $Silian_groupId,
                'region_code' => $Silian_regionCode,
                'admin_notes' => $Silian_adminNotes,
                'password_provided' => true,
            ],
        ]);

        return [
            'action' => 'create_user',
            'user' => [
                'id' => $Silian_userId,
                'uuid' => $Silian_freshUser['uuid'] ?? null,
                'username' => $Silian_freshUser['username'] ?? null,
                'email' => $Silian_freshUser['email'] ?? null,
                'status' => $Silian_freshUser['status'] ?? null,
                'is_admin' => isset($Silian_freshUser['is_admin']) ? (bool) $Silian_freshUser['is_admin'] : false,
                'school_id' => isset($Silian_freshUser['school_id']) ? (int) $Silian_freshUser['school_id'] : null,
                'school_name' => $Silian_freshUser['school_name'] ?? null,
                'group_id' => isset($Silian_freshUser['group_id']) ? (int) $Silian_freshUser['group_id'] : null,
                'group_name' => $Silian_freshUser['group_name'] ?? null,
                'region_code' => $Silian_freshUser['region_code'] ?? null,
            ],
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @param array<string,mixed> $logContext
     * @return array<string,mixed>
     */
    private function updateUserStatus(array $Silian_payload, array $Silian_logContext): array
    {
        $Silian_user = $this->resolveUserRowFromPayload($Silian_payload);
        if ($Silian_user === null) {
            throw new \RuntimeException('User not found.');
        }

        $Silian_status = strtolower(trim((string) ($Silian_payload['status'] ?? '')));
        if ($Silian_status === '') {
            throw new \RuntimeException('status is required.');
        }

        $Silian_adminNotesProvided = array_key_exists('admin_notes', $Silian_payload);
        $Silian_adminNotes = $Silian_adminNotesProvided ? trim((string) ($Silian_payload['admin_notes'] ?? '')) : null;
        if ($Silian_adminNotes === '' && $Silian_adminNotesProvided) {
            $Silian_adminNotes = null;
        }

        $Silian_userId = (int) ($Silian_user['id'] ?? 0);
        $Silian_sets = ['status = :status', 'updated_at = :updated_at'];
        $Silian_params = [
            ':status' => $Silian_status,
            ':updated_at' => gmdate('Y-m-d H:i:s'),
            ':user_id' => $Silian_userId,
        ];

        if ($Silian_adminNotesProvided) {
            $Silian_sets[] = 'admin_notes = :admin_notes';
            $Silian_params[':admin_notes'] = $Silian_adminNotes;
        }

        $Silian_stmt = $this->db->prepare("UPDATE users
            SET " . implode(', ', $Silian_sets) . "
            WHERE id = :user_id
              AND deleted_at IS NULL");
        $Silian_stmt->execute($Silian_params);

        $Silian_freshUser = $this->resolveUserRowFromPayload(['user_id' => $Silian_userId]);
        if ($Silian_freshUser === null) {
            throw new \RuntimeException('User not found after update.');
        }

        $Silian_adminId = isset($Silian_logContext['actor_id']) && is_numeric((string) $Silian_logContext['actor_id']) ? (int) $Silian_logContext['actor_id'] : null;
        $this->auditLogService?->logAdminOperation('user_status_updated', $Silian_adminId, 'user_management', [
            'table' => 'users',
            'record_id' => $Silian_userId,
            'old_data' => [
                'status' => $Silian_user['status'] ?? null,
                'admin_notes' => $Silian_user['admin_notes'] ?? null,
            ],
            'new_data' => [
                'status' => $Silian_freshUser['status'] ?? null,
                'admin_notes' => $Silian_freshUser['admin_notes'] ?? null,
            ],
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'endpoint' => $Silian_logContext['source'] ?? '/admin/ai/chat',
            'request_method' => 'POST',
            'conversation_id' => $Silian_logContext['conversation_id'] ?? null,
            'request_data' => [
                'user_uuid' => $Silian_freshUser['uuid'] ?? null,
                'status' => $Silian_status,
                'admin_notes' => $Silian_adminNotes,
            ],
        ]);

        return [
            'action' => 'update_user_status',
            'user' => [
                'id' => $Silian_userId,
                'uuid' => $Silian_freshUser['uuid'] ?? null,
                'username' => $Silian_freshUser['username'] ?? null,
                'email' => $Silian_freshUser['email'] ?? null,
                'status' => $Silian_freshUser['status'] ?? null,
                'admin_notes' => $Silian_freshUser['admin_notes'] ?? null,
            ],
            'old_status' => $Silian_user['status'] ?? null,
            'new_status' => $Silian_freshUser['status'] ?? null,
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @param array<string,mixed> $logContext
     * @return array<string,mixed>
     */
    private function awardBadgeToUser(array $Silian_payload, array $Silian_logContext): array
    {
        if ($this->badgeService === null) {
            throw new \RuntimeException('Badge service unavailable.');
        }

        $Silian_user = $this->resolveUserRowFromPayload($Silian_payload);
        if ($Silian_user === null) {
            throw new \RuntimeException('User not found.');
        }

        $Silian_badgeId = isset($Silian_payload['badge_id']) && is_numeric((string) $Silian_payload['badge_id']) ? (int) $Silian_payload['badge_id'] : 0;
        if ($Silian_badgeId <= 0) {
            throw new \RuntimeException('badge_id is required.');
        }

        $Silian_badge = $this->fetchBadgeById($Silian_badgeId);
        if ($Silian_badge === null) {
            throw new \RuntimeException('Badge not found.');
        }

        $Silian_notes = isset($Silian_payload['notes']) ? trim((string) ($Silian_payload['notes'] ?? '')) : null;
        if ($Silian_notes === '') {
            $Silian_notes = null;
        }

        $Silian_userId = (int) ($Silian_user['id'] ?? 0);
        $Silian_adminId = isset($Silian_logContext['actor_id']) && is_numeric((string) $Silian_logContext['actor_id']) ? (int) $Silian_logContext['actor_id'] : null;
        $this->badgeService->awardBadge($Silian_badgeId, $Silian_userId, [
            'source' => 'manual',
            'admin_id' => $Silian_adminId,
            'notes' => $Silian_notes,
            'meta' => [
                'source' => 'admin_ai',
                'conversation_id' => $Silian_logContext['conversation_id'] ?? null,
                'request_id' => $Silian_logContext['request_id'] ?? null,
            ],
        ]);

        $Silian_assignment = $this->fetchUserBadgeAssignment($Silian_userId, $Silian_badgeId);
        if ($Silian_assignment === null) {
            throw new \RuntimeException('Badge award did not persist.');
        }

        $this->auditLogService?->logAdminOperation('badge_awarded_via_ai', $Silian_adminId, 'badge_management', [
            'table' => 'user_badges',
            'record_id' => $Silian_assignment['id'] ?? null,
            'new_data' => [
                'user_id' => $Silian_userId,
                'badge_id' => $Silian_badgeId,
                'status' => $Silian_assignment['status'] ?? null,
            ],
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'endpoint' => $Silian_logContext['source'] ?? '/admin/ai/chat',
            'request_method' => 'POST',
            'conversation_id' => $Silian_logContext['conversation_id'] ?? null,
            'request_data' => [
                'user_uuid' => $Silian_user['uuid'] ?? null,
                'badge_id' => $Silian_badgeId,
                'notes' => $Silian_notes,
            ],
        ]);

        return [
            'action' => 'award_badge_to_user',
            'user' => [
                'id' => $Silian_userId,
                'uuid' => $Silian_user['uuid'] ?? null,
                'username' => $Silian_user['username'] ?? null,
                'email' => $Silian_user['email'] ?? null,
            ],
            'badge' => [
                'id' => $Silian_badgeId,
                'code' => $Silian_badge['code'] ?? null,
                'name' => $this->resolveBadgeDisplayName($Silian_badge),
            ],
            'assignment' => [
                'id' => $Silian_assignment['id'] ?? null,
                'status' => $Silian_assignment['status'] ?? null,
            ],
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @param array<string,mixed> $logContext
     * @return array<string,mixed>
     */
    private function revokeBadgeFromUser(array $Silian_payload, array $Silian_logContext): array
    {
        if ($this->badgeService === null) {
            throw new \RuntimeException('Badge service unavailable.');
        }

        $Silian_user = $this->resolveUserRowFromPayload($Silian_payload);
        if ($Silian_user === null) {
            throw new \RuntimeException('User not found.');
        }

        $Silian_badgeId = isset($Silian_payload['badge_id']) && is_numeric((string) $Silian_payload['badge_id']) ? (int) $Silian_payload['badge_id'] : 0;
        if ($Silian_badgeId <= 0) {
            throw new \RuntimeException('badge_id is required.');
        }

        $Silian_badge = $this->fetchBadgeById($Silian_badgeId);
        if ($Silian_badge === null) {
            throw new \RuntimeException('Badge not found.');
        }

        $Silian_notes = isset($Silian_payload['notes']) ? trim((string) ($Silian_payload['notes'] ?? '')) : null;
        if ($Silian_notes === '') {
            $Silian_notes = null;
        }

        $Silian_userId = (int) ($Silian_user['id'] ?? 0);
        $Silian_before = $this->fetchUserBadgeAssignment($Silian_userId, $Silian_badgeId);
        $Silian_adminId = isset($Silian_logContext['actor_id']) && is_numeric((string) $Silian_logContext['actor_id']) ? (int) $Silian_logContext['actor_id'] : null;
        $Silian_revoked = $this->badgeService->revokeBadge($Silian_badgeId, $Silian_userId, $Silian_adminId ?? 0, $Silian_notes);
        if (!$Silian_revoked) {
            throw new \RuntimeException('Badge revoke failed.');
        }

        $Silian_assignment = $this->fetchUserBadgeAssignment($Silian_userId, $Silian_badgeId);
        if ($Silian_assignment === null) {
            throw new \RuntimeException('Badge revoke result missing.');
        }

        $this->auditLogService?->logAdminOperation('badge_revoked_via_ai', $Silian_adminId, 'badge_management', [
            'table' => 'user_badges',
            'record_id' => $Silian_assignment['id'] ?? null,
            'old_data' => $Silian_before === null ? null : [
                'status' => $Silian_before['status'] ?? null,
            ],
            'new_data' => [
                'status' => $Silian_assignment['status'] ?? null,
            ],
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'endpoint' => $Silian_logContext['source'] ?? '/admin/ai/chat',
            'request_method' => 'POST',
            'conversation_id' => $Silian_logContext['conversation_id'] ?? null,
            'request_data' => [
                'user_uuid' => $Silian_user['uuid'] ?? null,
                'badge_id' => $Silian_badgeId,
                'notes' => $Silian_notes,
            ],
        ]);

        return [
            'action' => 'revoke_badge_from_user',
            'user' => [
                'id' => $Silian_userId,
                'uuid' => $Silian_user['uuid'] ?? null,
                'username' => $Silian_user['username'] ?? null,
                'email' => $Silian_user['email'] ?? null,
            ],
            'badge' => [
                'id' => $Silian_badgeId,
                'code' => $Silian_badge['code'] ?? null,
                'name' => $this->resolveBadgeDisplayName($Silian_badge),
            ],
            'assignment' => [
                'id' => $Silian_assignment['id'] ?? null,
                'status' => $Silian_assignment['status'] ?? null,
            ],
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @param array<string,mixed> $logContext
     * @return array<string,mixed>
     */
    private function updateExchangeStatus(array $Silian_payload, array $Silian_logContext): array
    {
        $Silian_exchangeId = trim((string) ($Silian_payload['exchange_id'] ?? ''));
        if ($Silian_exchangeId === '') {
            throw new \RuntimeException('exchange_id is required.');
        }

        $Silian_status = strtolower(trim((string) ($Silian_payload['status'] ?? '')));
        $Silian_allowedStatuses = ['processing', 'shipped', 'completed', 'cancelled', 'rejected'];
        if (!in_array($Silian_status, $Silian_allowedStatuses, true)) {
            throw new \RuntimeException('Invalid exchange status.');
        }

        $Silian_notes = isset($Silian_payload['notes']) ? trim((string) $Silian_payload['notes']) : null;
        if ($Silian_notes === '') {
            $Silian_notes = null;
        }
        $Silian_trackingNumber = isset($Silian_payload['tracking_number']) ? trim((string) $Silian_payload['tracking_number']) : null;
        if ($Silian_trackingNumber === '') {
            $Silian_trackingNumber = null;
        }

        $Silian_before = $this->fetchExchangeRecordById($Silian_exchangeId);
        if ($Silian_before === null) {
            throw new \RuntimeException('Exchange order not found.');
        }

        $Silian_stmt = $this->db->prepare("UPDATE point_exchanges
            SET status = :status,
                notes = :notes,
                tracking_number = :tracking_number,
                updated_at = :updated_at
            WHERE id = :exchange_id
              AND deleted_at IS NULL");
        $Silian_stmt->execute([
            ':status' => $Silian_status,
            ':notes' => $Silian_notes,
            ':tracking_number' => $Silian_trackingNumber,
            ':updated_at' => gmdate('Y-m-d H:i:s'),
            ':exchange_id' => $Silian_exchangeId,
        ]);

        $Silian_after = $this->fetchExchangeRecordById($Silian_exchangeId);
        if ($Silian_after === null) {
            throw new \RuntimeException('Exchange order not found after update.');
        }

        $Silian_adminId = isset($Silian_logContext['actor_id']) && is_numeric((string) $Silian_logContext['actor_id']) ? (int) $Silian_logContext['actor_id'] : null;
        $this->auditLogService?->logAdminOperation('exchange_status_updated', $Silian_adminId, 'exchange_management', [
            'table' => 'point_exchanges',
            'record_id' => $Silian_exchangeId,
            'old_data' => [
                'status' => $Silian_before['status'] ?? null,
                'notes' => $Silian_before['notes'] ?? null,
                'tracking_number' => $Silian_before['tracking_number'] ?? null,
            ],
            'new_data' => [
                'status' => $Silian_after['status'] ?? null,
                'notes' => $Silian_after['notes'] ?? null,
                'tracking_number' => $Silian_after['tracking_number'] ?? null,
            ],
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'endpoint' => $Silian_logContext['source'] ?? '/admin/ai/chat',
            'request_method' => 'POST',
            'conversation_id' => $Silian_logContext['conversation_id'] ?? null,
            'request_data' => [
                'exchange_id' => $Silian_exchangeId,
                'status' => $Silian_status,
                'notes' => $Silian_notes,
                'tracking_number' => $Silian_trackingNumber,
            ],
        ]);

        $this->sendExchangeStatusNotification($Silian_after, $Silian_status, $Silian_notes, $Silian_trackingNumber);

        return [
            'action' => 'update_exchange_status',
            'exchange' => [
                'id' => $Silian_after['id'] ?? null,
                'status' => $Silian_after['status'] ?? null,
                'product_name' => $Silian_after['product_name'] ?? null,
                'tracking_number' => $Silian_after['tracking_number'] ?? null,
                'username' => $Silian_after['username'] ?? null,
                'email' => $Silian_after['email'] ?? null,
            ],
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @param array<string,mixed> $logContext
     * @return array<string,mixed>
     */
    private function updateProductStatus(array $Silian_payload, array $Silian_logContext): array
    {
        $Silian_productId = isset($Silian_payload['product_id']) && is_numeric((string) $Silian_payload['product_id']) ? (int) $Silian_payload['product_id'] : 0;
        if ($Silian_productId <= 0) {
            throw new \RuntimeException('product_id is required.');
        }

        $Silian_status = strtolower(trim((string) ($Silian_payload['status'] ?? '')));
        if (!in_array($Silian_status, ['active', 'inactive'], true)) {
            throw new \RuntimeException('Invalid product status.');
        }

        $Silian_before = $this->fetchProductById($Silian_productId);
        if ($Silian_before === null) {
            throw new \RuntimeException('Product not found.');
        }

        $Silian_stmt = $this->db->prepare("UPDATE products
            SET status = :status,
                updated_at = :updated_at
            WHERE id = :product_id
              AND deleted_at IS NULL");
        $Silian_stmt->execute([
            ':status' => $Silian_status,
            ':updated_at' => gmdate('Y-m-d H:i:s'),
            ':product_id' => $Silian_productId,
        ]);

        $Silian_after = $this->fetchProductById($Silian_productId);
        if ($Silian_after === null) {
            throw new \RuntimeException('Product not found after update.');
        }

        $Silian_adminId = isset($Silian_logContext['actor_id']) && is_numeric((string) $Silian_logContext['actor_id']) ? (int) $Silian_logContext['actor_id'] : null;
        $this->auditLogService?->logAdminOperation('product_status_updated', $Silian_adminId, 'product_management', [
            'table' => 'products',
            'record_id' => $Silian_productId,
            'old_data' => ['status' => $Silian_before['status'] ?? null],
            'new_data' => ['status' => $Silian_after['status'] ?? null],
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'endpoint' => $Silian_logContext['source'] ?? '/admin/ai/chat',
            'request_method' => 'POST',
            'conversation_id' => $Silian_logContext['conversation_id'] ?? null,
            'request_data' => [
                'product_id' => $Silian_productId,
                'status' => $Silian_status,
            ],
        ]);

        return [
            'action' => 'update_product_status',
            'product' => [
                'id' => $Silian_productId,
                'name' => $Silian_after['name'] ?? null,
                'status' => $Silian_after['status'] ?? null,
                'stock' => isset($Silian_after['stock']) ? (int) $Silian_after['stock'] : 0,
            ],
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @param array<string,mixed> $logContext
     * @return array<string,mixed>
     */
    private function adjustProductInventory(array $Silian_payload, array $Silian_logContext): array
    {
        $Silian_productId = isset($Silian_payload['product_id']) && is_numeric((string) $Silian_payload['product_id']) ? (int) $Silian_payload['product_id'] : 0;
        if ($Silian_productId <= 0) {
            throw new \RuntimeException('product_id is required.');
        }

        $Silian_before = $this->fetchProductById($Silian_productId);
        if ($Silian_before === null) {
            throw new \RuntimeException('Product not found.');
        }

        $Silian_targetStock = array_key_exists('target_stock', $Silian_payload) && is_numeric((string) $Silian_payload['target_stock'])
            ? (int) $Silian_payload['target_stock']
            : null;
        $Silian_stockDelta = array_key_exists('stock_delta', $Silian_payload) && is_numeric((string) $Silian_payload['stock_delta'])
            ? (int) $Silian_payload['stock_delta']
            : null;
        if ($Silian_targetStock === null && $Silian_stockDelta === null) {
            throw new \RuntimeException('Either target_stock or stock_delta is required.');
        }

        $Silian_oldStock = isset($Silian_before['stock']) ? (int) $Silian_before['stock'] : 0;
        $Silian_newStock = $Silian_targetStock ?? ($Silian_oldStock + (int) $Silian_stockDelta);
        if ($Silian_newStock < 0) {
            throw new \RuntimeException('Inventory cannot be negative.');
        }

        $Silian_reason = isset($Silian_payload['reason']) ? trim((string) ($Silian_payload['reason'] ?? '')) : null;
        if ($Silian_reason === '') {
            $Silian_reason = null;
        }

        $Silian_stmt = $this->db->prepare("UPDATE products
            SET stock = :stock,
                updated_at = :updated_at
            WHERE id = :product_id
              AND deleted_at IS NULL");
        $Silian_stmt->execute([
            ':stock' => $Silian_newStock,
            ':updated_at' => gmdate('Y-m-d H:i:s'),
            ':product_id' => $Silian_productId,
        ]);

        $Silian_after = $this->fetchProductById($Silian_productId);
        if ($Silian_after === null) {
            throw new \RuntimeException('Product not found after inventory update.');
        }

        $Silian_adminId = isset($Silian_logContext['actor_id']) && is_numeric((string) $Silian_logContext['actor_id']) ? (int) $Silian_logContext['actor_id'] : null;
        $this->auditLogService?->logAdminOperation('product_inventory_adjusted', $Silian_adminId, 'product_management', [
            'table' => 'products',
            'record_id' => $Silian_productId,
            'old_data' => ['stock' => $Silian_oldStock],
            'new_data' => ['stock' => isset($Silian_after['stock']) ? (int) $Silian_after['stock'] : 0],
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'endpoint' => $Silian_logContext['source'] ?? '/admin/ai/chat',
            'request_method' => 'POST',
            'conversation_id' => $Silian_logContext['conversation_id'] ?? null,
            'request_data' => [
                'product_id' => $Silian_productId,
                'stock_delta' => $Silian_stockDelta,
                'target_stock' => $Silian_targetStock,
                'reason' => $Silian_reason,
            ],
        ]);

        return [
            'action' => 'adjust_product_inventory',
            'product' => [
                'id' => $Silian_productId,
                'name' => $Silian_after['name'] ?? null,
                'status' => $Silian_after['status'] ?? null,
                'stock' => isset($Silian_after['stock']) ? (int) $Silian_after['stock'] : 0,
            ],
            'old_stock' => $Silian_oldStock,
            'new_stock' => isset($Silian_after['stock']) ? (int) $Silian_after['stock'] : 0,
            'stock_delta' => $Silian_stockDelta,
            'reason' => $Silian_reason,
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @param array<string,mixed> $logContext
     * @return array<string,mixed>
     */
    private function reviewCarbonRecords(string $Silian_action, array $Silian_payload, array $Silian_logContext): array
    {
        $Silian_recordIds = array_values(array_unique(array_filter(array_map(
            static fn ($Silian_item) => !is_array($Silian_item) && !is_object($Silian_item) ? trim((string) $Silian_item) : '',
            (array) ($Silian_payload['record_ids'] ?? [])
        ))));
        if ($Silian_recordIds === []) {
            throw new \RuntimeException('No record_ids provided.');
        }

        $Silian_reviewNote = isset($Silian_payload['review_note']) && is_string($Silian_payload['review_note']) ? trim($Silian_payload['review_note']) : null;
        if ($Silian_reviewNote === '') {
            $Silian_reviewNote = null;
        }

        $Silian_records = $this->fetchCarbonRecordsByIds($Silian_recordIds);
        if ($Silian_records === []) {
            throw new \RuntimeException('No records found for provided ids.');
        }

        $Silian_adminId = isset($Silian_logContext['actor_id']) && is_numeric((string) $Silian_logContext['actor_id']) ? (int) $Silian_logContext['actor_id'] : null;
        $Silian_newStatus = $Silian_action === 'approve' ? 'approved' : 'rejected';
        $Silian_reviewedAt = gmdate('Y-m-d H:i:s');
        $Silian_processed = [];
        $Silian_skipped = [];
        $Silian_recordsByUser = [];

        $this->db->beginTransaction();
        try {
            $Silian_updateStmt = $this->db->prepare("UPDATE carbon_records
                SET status = :status, reviewed_by = :reviewed_by, reviewed_at = :reviewed_at, review_note = :review_note
                WHERE id = :record_id");
            $Silian_pointsStmt = $this->db->prepare("UPDATE users SET points = COALESCE(points, 0) + :points WHERE id = :user_id");

            foreach ($Silian_records as $Silian_record) {
                $Silian_recordId = (string) ($Silian_record['id'] ?? '');
                if ($Silian_recordId === '') {
                    continue;
                }
                if (($Silian_record['status'] ?? '') !== 'pending') {
                    $Silian_skipped[] = ['id' => $Silian_recordId, 'status' => $Silian_record['status'] ?? null];
                    continue;
                }

                $Silian_updateStmt->execute([
                    ':status' => $Silian_newStatus,
                    ':reviewed_by' => $Silian_adminId,
                    ':reviewed_at' => $Silian_reviewedAt,
                    ':review_note' => $Silian_reviewNote,
                    ':record_id' => $Silian_recordId,
                ]);

                if ($Silian_action === 'approve') {
                    $Silian_points = (int) ($Silian_record['points_earned'] ?? 0);
                    $Silian_userId = (int) ($Silian_record['user_id'] ?? 0);
                    if ($Silian_points !== 0 && $Silian_userId > 0) {
                        $Silian_pointsStmt->execute([':points' => $Silian_points, ':user_id' => $Silian_userId]);
                    }
                }

                $Silian_processed[] = $Silian_recordId;
                $Silian_record['status'] = $Silian_newStatus;
                $Silian_record['review_note'] = $Silian_reviewNote;
                $Silian_userId = (int) ($Silian_record['user_id'] ?? 0);
                if ($Silian_userId > 0) {
                    $Silian_recordsByUser[$Silian_userId][] = $this->buildReviewSummaryRecord($Silian_record);
                }

                $this->auditLogService?->logAdminOperation(
                    'carbon_record_' . ($Silian_action === 'approve' ? 'approve' : 'reject'),
                    $Silian_adminId,
                    'carbon_management',
                    [
                        'table' => 'carbon_records',
                        'record_id' => $Silian_recordId,
                        'old_data' => ['status' => 'pending'],
                        'new_data' => ['status' => $Silian_newStatus, 'review_note' => $Silian_reviewNote],
                        'request_id' => $Silian_logContext['request_id'] ?? null,
                        'endpoint' => $Silian_logContext['source'] ?? '/admin/ai/chat',
                        'request_method' => 'POST',
                        'conversation_id' => $Silian_logContext['conversation_id'] ?? null,
                    ]
                );
            }

            $this->db->commit();
        } catch (\Throwable $Silian_exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $Silian_exception;
        }

        foreach ($Silian_recordsByUser as $Silian_userId => $Silian_userRecords) {
            if ($this->messageService !== null && $Silian_userRecords !== []) {
                $this->messageService->sendCarbonRecordReviewSummary($Silian_userId, $Silian_action, $Silian_userRecords, $Silian_reviewNote, [
                    'reviewed_by_id' => $Silian_adminId,
                ]);
            }
        }

        return [
            'action' => $Silian_action,
            'processed_ids' => $Silian_processed,
            'processed_count' => count($Silian_processed),
            'skipped' => $Silian_skipped,
            'review_note' => $Silian_reviewNote,
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>|null
     */
    private function resolveUserRowFromPayload(array $Silian_payload): ?array
    {
        $Silian_userId = isset($Silian_payload['user_id']) && is_numeric((string) $Silian_payload['user_id']) ? (int) $Silian_payload['user_id'] : null;
        $Silian_userUuid = strtolower(trim((string) ($Silian_payload['user_uuid'] ?? '')));

        $Silian_where = ['u.deleted_at IS NULL'];
        $Silian_params = [];
        if ($Silian_userId !== null && $Silian_userId > 0) {
            $Silian_where[] = 'u.id = :user_id';
            $Silian_params[':user_id'] = $Silian_userId;
        } elseif ($Silian_userUuid !== '') {
            $Silian_where[] = 'LOWER(u.uuid) = :user_uuid';
            $Silian_params[':user_uuid'] = $Silian_userUuid;
        } else {
            return null;
        }

        $Silian_stmt = $this->db->prepare("SELECT u.*, s.name AS school_name, g.name AS group_name
            FROM users u
            LEFT JOIN schools s ON s.id = u.school_id
            LEFT JOIN user_groups g ON g.id = u.group_id
            WHERE " . implode(' AND ', $Silian_where) . "
            LIMIT 1");
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_stmt->bindValue($Silian_key, $Silian_value);
        }
        $Silian_stmt->execute();

        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($Silian_row) ? $Silian_row : null;
    }

    private function schoolExists(int $Silian_schoolId): bool
    {
        $Silian_stmt = $this->db->prepare("SELECT id FROM schools WHERE id = :school_id AND deleted_at IS NULL LIMIT 1");
        $Silian_stmt->execute([':school_id' => $Silian_schoolId]);
        return $Silian_stmt->fetch(PDO::FETCH_ASSOC) !== false;
    }

    private function groupExists(int $Silian_groupId): bool
    {
        $Silian_stmt = $this->db->prepare("SELECT id FROM user_groups WHERE id = :group_id LIMIT 1");
        $Silian_stmt->execute([':group_id' => $Silian_groupId]);
        return $Silian_stmt->fetch(PDO::FETCH_ASSOC) !== false;
    }

    /**
     * @return array<string,mixed>|null
     */
    private function fetchBadgeById(int $Silian_badgeId): ?array
    {
        $Silian_stmt = $this->db->prepare("SELECT *
            FROM achievement_badges
            WHERE id = :badge_id
              AND deleted_at IS NULL
            LIMIT 1");
        $Silian_stmt->execute([':badge_id' => $Silian_badgeId]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($Silian_row) ? $Silian_row : null;
    }

    /**
     * @return array<string,mixed>|null
     */
    private function fetchUserBadgeAssignment(int $Silian_userId, int $Silian_badgeId): ?array
    {
        $Silian_stmt = $this->db->prepare("SELECT *
            FROM user_badges
            WHERE user_id = :user_id
              AND badge_id = :badge_id
            ORDER BY id DESC
            LIMIT 1");
        $Silian_stmt->execute([
            ':user_id' => $Silian_userId,
            ':badge_id' => $Silian_badgeId,
        ]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($Silian_row) ? $Silian_row : null;
    }

    /**
     * @param array<string,mixed> $badge
     */
    private function resolveBadgeDisplayName(array $Silian_badge): string
    {
        $Silian_name = trim((string) ($Silian_badge['name_zh'] ?? $Silian_badge['name_en'] ?? $Silian_badge['code'] ?? ''));
        return $Silian_name !== '' ? $Silian_name : '未命名徽章';
    }

    /**
     * @return array<string,mixed>|null
     */
    private function fetchProductById(int $Silian_productId): ?array
    {
        $Silian_stmt = $this->db->prepare("SELECT *
            FROM products
            WHERE id = :product_id
              AND deleted_at IS NULL
            LIMIT 1");
        $Silian_stmt->execute([':product_id' => $Silian_productId]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($Silian_row) ? $Silian_row : null;
    }

    private function resolvePointExchangeUserColumn(): string
    {
        static $Silian_resolved = null;
        if ($Silian_resolved !== null) {
            return $Silian_resolved;
        }

        $Silian_resolved = 'user_id';
        try {
            $Silian_driver = (string) ($this->db->getAttribute(PDO::ATTR_DRIVER_NAME) ?: 'mysql');
            if ($Silian_driver === 'sqlite') {
                $Silian_stmt = $this->db->query("PRAGMA table_info(point_exchanges)");
                $Silian_columns = $Silian_stmt ? ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
                $Silian_names = array_map(static fn (array $Silian_column): string => (string) ($Silian_column['name'] ?? ''), $Silian_columns);
                if (!in_array('user_id', $Silian_names, true) && in_array('uid', $Silian_names, true)) {
                    $Silian_resolved = 'uid';
                }
            }
        } catch (\Throwable) {
        }

        return $Silian_resolved;
    }

    /**
     * @return array<string,mixed>|null
     */
    private function fetchExchangeRecordById(string $Silian_exchangeId): ?array
    {
        $Silian_userColumn = $this->resolvePointExchangeUserColumn();
        $Silian_stmt = $this->db->prepare("SELECT e.*, u.username, u.email
            FROM point_exchanges e
            LEFT JOIN users u ON u.id = e.{$Silian_userColumn}
            WHERE e.id = :exchange_id
              AND e.deleted_at IS NULL
            LIMIT 1");
        $Silian_stmt->execute([':exchange_id' => $Silian_exchangeId]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($Silian_row) ? $Silian_row : null;
    }

    /**
     * @param array<string,mixed> $exchange
     */
    private function sendExchangeStatusNotification(array $Silian_exchange, string $Silian_status, ?string $Silian_notes, ?string $Silian_trackingNumber): void
    {
        if ($this->messageService === null) {
            return;
        }

        $Silian_statusMessages = [
            'processing' => '您的兑换订单正在处理中',
            'shipped' => '您的兑换商品已发货',
            'completed' => '您的兑换订单已完成',
            'cancelled' => '您的兑换订单已取消',
            'rejected' => '您的兑换订单已被驳回',
        ];
        $Silian_title = $Silian_statusMessages[$Silian_status] ?? '兑换状态更新';
        $Silian_message = sprintf(
            '您的兑换订单（%s x%s）状态已更新为：%s',
            (string) ($Silian_exchange['product_name'] ?? '未知商品'),
            (string) ($Silian_exchange['quantity'] ?? '1'),
            $Silian_title
        );
        if ($Silian_trackingNumber !== null && $Silian_trackingNumber !== '') {
            $Silian_message .= "\n物流单号：" . $Silian_trackingNumber;
        }
        if ($Silian_notes !== null && $Silian_notes !== '') {
            $Silian_message .= "\n备注：" . $Silian_notes;
        }

        $Silian_userColumn = $this->resolvePointExchangeUserColumn();
        $Silian_userId = isset($Silian_exchange[$Silian_userColumn]) ? (int) $Silian_exchange[$Silian_userColumn] : 0;
        if ($Silian_userId <= 0) {
            return;
        }

        $this->messageService->sendMessage(
            $Silian_userId,
            'exchange_status_updated',
            $Silian_title,
            $Silian_message,
            'normal'
        );
        $this->messageService->sendExchangeStatusUpdateEmailToUser(
            $Silian_userId,
            (string) ($Silian_exchange['product_name'] ?? ''),
            $Silian_status,
            $Silian_trackingNumber,
            $Silian_notes,
            isset($Silian_exchange['email']) ? (string) $Silian_exchange['email'] : null,
            isset($Silian_exchange['username']) ? (string) $Silian_exchange['username'] : null
        );
    }

    /**
     * @param array<int,string> $recordIds
     * @return array<int,array<string,mixed>>
     */
    private function fetchCarbonRecordsByIds(array $Silian_recordIds): array
    {
        if ($Silian_recordIds === []) {
            return [];
        }

        $Silian_placeholders = [];
        $Silian_params = [];
        foreach (array_values($Silian_recordIds) as $Silian_index => $Silian_recordId) {
            $Silian_placeholder = ':record_id_' . $Silian_index;
            $Silian_placeholders[] = $Silian_placeholder;
            $Silian_params[$Silian_placeholder] = $Silian_recordId;
        }

        $Silian_sql = "SELECT r.id, r.user_id, r.activity_id, r.status, r.date, r.carbon_saved, r.points_earned,
                       r.review_note, u.username, u.email, a.name_zh AS activity_name_zh, a.name_en AS activity_name_en
                FROM carbon_records r
                LEFT JOIN users u ON u.id = r.user_id
                LEFT JOIN carbon_activities a ON a.id = r.activity_id
                WHERE r.id IN (" . implode(',', $Silian_placeholders) . ')';
        $Silian_stmt = $this->db->prepare($Silian_sql);
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_stmt->bindValue($Silian_key, $Silian_value);
        }
        $Silian_stmt->execute();

        return $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * @param array<string,mixed> $record
     * @return array<string,mixed>
     */
    private function buildReviewSummaryRecord(array $Silian_record): array
    {
        return [
            'id' => $Silian_record['id'] ?? null,
            'date' => $Silian_record['date'] ?? null,
            'status' => $Silian_record['status'] ?? null,
            'carbon_saved' => isset($Silian_record['carbon_saved']) ? (float) $Silian_record['carbon_saved'] : null,
            'points_earned' => isset($Silian_record['points_earned']) ? (int) $Silian_record['points_earned'] : null,
            'activity_name' => $Silian_record['activity_name_zh'] ?? ($Silian_record['activity_name_en'] ?? null),
            'review_note' => $Silian_record['review_note'] ?? null,
        ];
    }

    private function normalizeBooleanFilter(mixed $Silian_value): ?bool
    {
        if (is_bool($Silian_value)) {
            return $Silian_value;
        }

        if (is_numeric($Silian_value)) {
            return (int) $Silian_value === 1;
        }

        if (!is_string($Silian_value)) {
            return null;
        }

        return match (strtolower(trim($Silian_value))) {
            '1', 'true', 'yes', 'y' => true,
            '0', 'false', 'no', 'n' => false,
            default => null,
        };
    }

    private function generateEntityUuid(): string
    {
        try {
            $Silian_bytes = random_bytes(16);
            $Silian_bytes[6] = chr((ord($Silian_bytes[6]) & 0x0f) | 0x40);
            $Silian_bytes[8] = chr((ord($Silian_bytes[8]) & 0x3f) | 0x80);
            $Silian_hex = bin2hex($Silian_bytes);
            return sprintf(
                '%s-%s-%s-%s-%s',
                substr($Silian_hex, 0, 8),
                substr($Silian_hex, 8, 4),
                substr($Silian_hex, 12, 4),
                substr($Silian_hex, 16, 4),
                substr($Silian_hex, 20, 12)
            );
        } catch (\Throwable) {
            return strtolower(sprintf(
                '%08s-%04s-4%03s-%04s-%012s',
                substr(md5(uniqid('user', true)), 0, 8),
                substr(md5(uniqid('user', true)), 8, 4),
                substr(md5(uniqid('user', true)), 12, 3),
                substr(md5(uniqid('user', true)), 15, 4),
                substr(md5(uniqid('user', true)), 19, 12)
            ));
        }
    }
}
