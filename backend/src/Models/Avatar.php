<?php

declare(strict_types=1);

namespace CarbonTrack\Models;

use PDO;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Support\InputValueNormalizer;
use Psr\Log\LoggerInterface;
use Slim\Psr7\Factory\ServerRequestFactory;

class Avatar
{
    private PDO $db;

    private LoggerInterface $logger;

    private ?ErrorLogService $errorLogService;

    public function __construct(PDO $Silian_db, LoggerInterface $Silian_logger, ?ErrorLogService $Silian_errorLogService = null)
    {
        $this->db = $Silian_db;
        $this->logger = $Silian_logger;
        $this->errorLogService = $Silian_errorLogService;
    }

    /**
     * 获取头像列表，可按需包含停用头像
     */
    public function getAvailableAvatars(?string $Silian_category = null, bool $Silian_includeInactive = false): array
    {
        $Silian_sql = "
            SELECT id, uuid, name, description, file_path, thumbnail_path,
                   category, sort_order, is_default, is_active
            FROM avatars
            WHERE deleted_at IS NULL
        ";

        $Silian_params = [];

        if (!$Silian_includeInactive) {
            $Silian_sql .= " AND is_active = 1";
        }

        if ($Silian_category) {
            $Silian_sql .= " AND category = ?";
            $Silian_params[] = $Silian_category;
        }

        $Silian_sql .= " ORDER BY sort_order ASC, id ASC";

        try {
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute($Silian_params);
            $Silian_result = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC);

            return $Silian_result;
        } catch (\Exception $Silian_e) {
            $this->logErrorWithService($Silian_e, 'Avatar query failed:');
            return [];
        }
    }

    /**
     * 根据ID获取头像信息
     */
    public function getAvatarById(int $Silian_avatarId): ?array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT id, uuid, name, description, file_path, thumbnail_path,
                   category, sort_order, is_default, is_active
            FROM avatars
            WHERE id = ? AND deleted_at IS NULL
        ");
        $Silian_stmt->execute([$Silian_avatarId]);

        $Silian_avatar = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return $Silian_avatar ?: null;
    }

    /**
     * 根据UUID获取头像信息
     */
    public function getAvatarByUuid(string $Silian_uuid): ?array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT id, uuid, name, description, file_path, thumbnail_path,
                   category, sort_order, is_default, is_active
            FROM avatars
            WHERE uuid = ? AND deleted_at IS NULL
        ");
        $Silian_stmt->execute([$Silian_uuid]);

        $Silian_avatar = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return $Silian_avatar ?: null;
    }

    /**
     * 获取默认头像
     */
    public function getDefaultAvatar(): ?array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT id, uuid, name, description, file_path, thumbnail_path,
                   category, sort_order, is_default
            FROM avatars
            WHERE is_default = 1 AND is_active = 1 AND deleted_at IS NULL
            LIMIT 1
        ");
        $Silian_stmt->execute();

        $Silian_avatar = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return $Silian_avatar ?: null;
    }

    /**
     * 获取头像分类列表
     */
    public function getAvatarCategories(): array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT DISTINCT category, COUNT(*) as count
            FROM avatars
            WHERE is_active = 1 AND deleted_at IS NULL
            GROUP BY category
            ORDER BY category ASC
        ");
        $Silian_stmt->execute();

        return $Silian_stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * 验证头像是否可用
     */
    public function isAvatarAvailable(int $Silian_avatarId): bool
    {
        $Silian_stmt = $this->db->prepare("
            SELECT COUNT(*) as count
            FROM avatars
            WHERE id = ? AND is_active = 1 AND deleted_at IS NULL
        ");
        $Silian_stmt->execute([$Silian_avatarId]);

        $Silian_result = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return $Silian_result['count'] > 0;
    }

    /**
     * 创建新头像（管理员功能）
     */
    public function createAvatar(array $Silian_data): int
    {
        $Silian_uuid = $this->generateUUID();
        $Silian_data = $this->normalizePersistenceData($Silian_data);
        $Silian_transactionStarted = false;

        try {
            if ($this->shouldResetDefaultAvatar($Silian_data)) {
                $this->db->beginTransaction();
                $Silian_transactionStarted = true;
                $this->clearDefaultAvatarFlags();
            }

            $Silian_stmt = $this->db->prepare("
                INSERT INTO avatars (
                    uuid, name, description, file_path, thumbnail_path,
                    category, sort_order, is_active, is_default,
                    created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW())
            ");

            $Silian_stmt->execute([
                $Silian_uuid,
                $Silian_data['name'],
                $Silian_data['description'] ?? null,
                $Silian_data['file_path'],
                $Silian_data['thumbnail_path'] ?? null,
                $Silian_data['category'] ?? 'default',
                $Silian_data['sort_order'] ?? 0,
                $Silian_data['is_active'] ?? 1,
                $Silian_data['is_default'] ?? 0
            ]);

            $Silian_avatarId = (int)$this->db->lastInsertId();

            if ($Silian_transactionStarted) {
                $this->db->commit();
            }

            return $Silian_avatarId;
        } catch (\Throwable $Silian_e) {
            if ($Silian_transactionStarted) {
                $this->db->rollBack();
            }

            throw $Silian_e;
        }
    }

    /**
     * 更新头像信息（管理员功能）
     */
    public function updateAvatar(int $Silian_avatarId, array $Silian_data): bool
    {
        $Silian_data = $this->normalizePersistenceData($Silian_data);
        ['fields' => $Silian_fields, 'params' => $Silian_params] = $this->buildUpdatePayload($Silian_data);
        $Silian_transactionStarted = false;

        if (empty($Silian_fields)) {
            return false;
        }

        $Silian_fields[] = "updated_at = NOW()";
        $Silian_params[] = $Silian_avatarId;

        try {
            if ($this->shouldResetDefaultAvatar($Silian_data)) {
                $this->db->beginTransaction();
                $Silian_transactionStarted = true;
                $this->clearDefaultAvatarFlags($Silian_avatarId);
            }

            $Silian_sql = "UPDATE avatars SET " . implode(', ', $Silian_fields) . " WHERE id = ? AND deleted_at IS NULL";
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_result = $Silian_stmt->execute($Silian_params);

            if ($Silian_transactionStarted) {
                $this->db->commit();
            }

            return $Silian_result;
        } catch (\Throwable $Silian_e) {
            if ($Silian_transactionStarted) {
                $this->db->rollBack();
            }

            throw $Silian_e;
        }
    }

    /**
     * @return array<int, array{id:int, username:?string, email:?string}>
     */
    public function getUsersAssignedToAvatar(int $Silian_avatarId): array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT id, username, email
            FROM users
            WHERE avatar_id = ? AND deleted_at IS NULL
            ORDER BY id ASC
        ");
        $Silian_stmt->execute([$Silian_avatarId]);

        return $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * @return array{reassigned_user_count:int,users:array<int,array{id:int,username:?string,email:?string}>,fallback_avatar:array<string,mixed>|null}
     */
    public function updateAvatarAndReassignUsers(int $Silian_avatarId, array $Silian_data, ?int $Silian_fallbackAvatarId): array
    {
        $Silian_data = $this->normalizePersistenceData($Silian_data);
        ['fields' => $Silian_fields, 'params' => $Silian_params] = $this->buildUpdatePayload($Silian_data);

        if (empty($Silian_fields)) {
            return [
                'reassigned_user_count' => 0,
                'users' => [],
                'fallback_avatar' => null,
            ];
        }

        $Silian_fields[] = "updated_at = NOW()";
        $Silian_params[] = $Silian_avatarId;

        $this->db->beginTransaction();

        try {
            $Silian_affectedUsers = $this->lockUsersAssignedToAvatar($Silian_avatarId);
            $Silian_fallbackAvatar = null;
            if ($Silian_affectedUsers !== []) {
                $Silian_fallbackAvatar = $this->lockFallbackDefaultAvatar($Silian_avatarId, $Silian_fallbackAvatarId);
                if ($Silian_fallbackAvatar === null) {
                    throw new AvatarFallbackUnavailableException();
                }
                $Silian_fallbackAvatarId = (int) $Silian_fallbackAvatar['id'];
            }

            if ($this->shouldResetDefaultAvatar($Silian_data)) {
                $this->clearDefaultAvatarFlags($Silian_avatarId);
            }

            $Silian_sql = "UPDATE avatars SET " . implode(', ', $Silian_fields) . " WHERE id = ? AND deleted_at IS NULL";
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute($Silian_params);

            $Silian_affectedRows = 0;
            if ($Silian_affectedUsers !== []) {
                $Silian_stmt = $this->db->prepare("
                    UPDATE users
                    SET avatar_id = ?, updated_at = NOW()
                    WHERE avatar_id = ? AND deleted_at IS NULL
                ");
                $Silian_stmt->execute([$Silian_fallbackAvatarId, $Silian_avatarId]);
                $Silian_affectedRows = $Silian_stmt->rowCount();
            }

            $this->db->commit();

            return [
                'reassigned_user_count' => $Silian_affectedRows,
                'users' => $Silian_affectedUsers,
                'fallback_avatar' => $Silian_fallbackAvatar,
            ];
        } catch (\Throwable $Silian_e) {
            $this->db->rollBack();
            throw $Silian_e;
        }
    }

    /**
     * @return array<int, array{id:int, username:?string, email:?string}>
     */
    private function lockUsersAssignedToAvatar(int $Silian_avatarId): array
    {
        $Silian_lockClause = $this->rowLockClause();
        $Silian_stmt = $this->db->prepare("
            SELECT id, username, email
            FROM users
            WHERE avatar_id = ? AND deleted_at IS NULL
            ORDER BY id ASC
            {$Silian_lockClause}
        ");
        $Silian_stmt->execute([$Silian_avatarId]);

        return $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    /**
     * @return array<string,mixed>|null
     */
    private function lockFallbackDefaultAvatar(int $Silian_avatarId, ?int $Silian_fallbackAvatarId): ?array
    {
        $Silian_sql = "
            SELECT id, name, file_path, thumbnail_path, category, is_default, is_active
            FROM avatars
            WHERE is_default = 1
              AND is_active = 1
              AND deleted_at IS NULL
              AND id <> ?
        ";
        $Silian_params = [$Silian_avatarId];

        if ($Silian_fallbackAvatarId !== null && $Silian_fallbackAvatarId > 0) {
            $Silian_sql .= " AND id = ?";
            $Silian_params[] = $Silian_fallbackAvatarId;
        }

        $Silian_sql .= " ORDER BY sort_order ASC, id ASC LIMIT 1" . $this->rowLockClause();

        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute($Silian_params);
        $Silian_fallbackAvatar = $Silian_stmt->fetch(PDO::FETCH_ASSOC);

        return is_array($Silian_fallbackAvatar) ? $Silian_fallbackAvatar : null;
    }

    private function rowLockClause(): string
    {
        try {
            $Silian_driver = strtolower((string) $this->db->getAttribute(PDO::ATTR_DRIVER_NAME));
        } catch (\Throwable) {
            return '';
        }

        return in_array($Silian_driver, ['mysql', 'pgsql'], true) ? ' FOR UPDATE' : '';
    }

    /**
     * Normalize controller/input payload before persisting to integer-backed columns.
     *
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    private function normalizePersistenceData(array $Silian_data): array
    {
        if (array_key_exists('sort_order', $Silian_data)) {
            $Silian_data['sort_order'] = InputValueNormalizer::integer($Silian_data['sort_order'], 'sort_order');
        }

        foreach (['is_active', 'is_default'] as $Silian_field) {
            if (!array_key_exists($Silian_field, $Silian_data)) {
                continue;
            }

            $Silian_data[$Silian_field] = InputValueNormalizer::booleanFlagInteger($Silian_data[$Silian_field], $Silian_field);
        }

        return $Silian_data;
    }

    /**
     * @param array<string,mixed> $data
     * @return array{fields:array<int,string>,params:array<int,mixed>}
     */
    private function buildUpdatePayload(array $Silian_data): array
    {
        $Silian_fields = [];
        $Silian_params = [];

        $Silian_allowedFields = [
            'name', 'description', 'file_path', 'thumbnail_path',
            'category', 'sort_order', 'is_active', 'is_default'
        ];

        foreach ($Silian_allowedFields as $Silian_field) {
            if (array_key_exists($Silian_field, $Silian_data)) {
                $Silian_fields[] = "{$Silian_field} = ?";
                $Silian_params[] = $Silian_data[$Silian_field];
            }
        }

        return [
            'fields' => $Silian_fields,
            'params' => $Silian_params,
        ];
    }

    /**
     * 软删除头像（管理员功能）
     */
    public function deleteAvatar(int $Silian_avatarId): bool
    {
        // 检查是否有用户正在使用此头像
        $Silian_stmt = $this->db->prepare("
            SELECT COUNT(*) as count
            FROM users
            WHERE avatar_id = ? AND deleted_at IS NULL
        ");
        $Silian_stmt->execute([$Silian_avatarId]);
        $Silian_result = $Silian_stmt->fetch(PDO::FETCH_ASSOC);

        if ($Silian_result['count'] > 0) {
            // 如果有用户使用，将他们的头像改为默认头像
            $Silian_defaultAvatar = $this->getDefaultAvatar();
            if ($Silian_defaultAvatar) {
                $Silian_stmt = $this->db->prepare("
                    UPDATE users
                    SET avatar_id = ?, updated_at = NOW()
                    WHERE avatar_id = ? AND deleted_at IS NULL
                ");
                $Silian_stmt->execute([$Silian_defaultAvatar['id'], $Silian_avatarId]);
            }
        }

        // 软删除头像
        $Silian_stmt = $this->db->prepare("
            UPDATE avatars
            SET deleted_at = NOW(), updated_at = NOW()
            WHERE id = ? AND deleted_at IS NULL
        ");

        return $Silian_stmt->execute([$Silian_avatarId]);
    }

    /**
     * 恢复已删除的头像（管理员功能）
     */
    public function restoreAvatar(int $Silian_avatarId): bool
    {
        $Silian_stmt = $this->db->prepare("
            UPDATE avatars
            SET deleted_at = NULL, updated_at = NOW()
            WHERE id = ? AND deleted_at IS NOT NULL
        ");

        return $Silian_stmt->execute([$Silian_avatarId]);
    }

    /**
     * 设置默认头像（管理员功能）
     */
    public function setDefaultAvatar(int $Silian_avatarId): bool
    {
        $this->db->beginTransaction();

        try {
            $this->clearDefaultAvatarFlags($Silian_avatarId);

            // 设置新的默认头像
            $Silian_stmt = $this->db->prepare("
                UPDATE avatars
                SET is_default = 1, updated_at = NOW()
                WHERE id = ? AND deleted_at IS NULL
            ");
            $Silian_stmt->execute([$Silian_avatarId]);

            $this->db->commit();
            return true;

        } catch (\Exception $Silian_e) {
            $this->db->rollBack();
            return false;
        }
    }

    private function shouldResetDefaultAvatar(array $Silian_data): bool
    {
        return array_key_exists('is_default', $Silian_data) && (int) $Silian_data['is_default'] === 1;
    }

    private function clearDefaultAvatarFlags(?int $Silian_excludeAvatarId = null): void
    {
        $Silian_sql = "
            UPDATE avatars
            SET is_default = 0, updated_at = NOW()
            WHERE deleted_at IS NULL AND is_default = 1
        ";

        $Silian_params = [];

        if ($Silian_excludeAvatarId !== null) {
            $Silian_sql .= " AND id <> ?";
            $Silian_params[] = $Silian_excludeAvatarId;
        }

        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute($Silian_params);
    }

    /**
     * 批量更新头像排序（管理员功能）
     */
    public function updateSortOrders(array $Silian_sortOrders): bool
    {
        $this->db->beginTransaction();

        try {
            $Silian_stmt = $this->db->prepare("
                UPDATE avatars
                SET sort_order = ?, updated_at = NOW()
                WHERE id = ? AND deleted_at IS NULL
            ");

            foreach ($Silian_sortOrders as $Silian_avatarId => $Silian_sortOrder) {
                $Silian_stmt->execute([$Silian_sortOrder, $Silian_avatarId]);
            }

            $this->db->commit();
            return true;

        } catch (\Exception $Silian_e) {
            $this->db->rollBack();
            return false;
        }
    }

    /**
     * 获取头像使用统计（管理员功能）
     */
    public function getAvatarUsageStats(): array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT
                a.id,
                a.name,
                a.category,
                COUNT(u.id) as user_count,
                a.is_default,
                a.is_active
            FROM avatars a
            LEFT JOIN users u ON a.id = u.avatar_id AND u.deleted_at IS NULL
            WHERE a.deleted_at IS NULL
            GROUP BY a.id, a.name, a.category, a.is_default, a.is_active
            ORDER BY user_count DESC, a.sort_order ASC
        ");
        $Silian_stmt->execute();

        return $Silian_stmt->fetchAll(PDO::FETCH_ASSOC);
    }

    /**
     * 生成UUID
     */
    private function generateUUID(): string
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


    private function logErrorWithService(\Throwable $Silian_exception, string $Silian_contextMessage): void
    {
        if ($this->errorLogService) {
            try {
                $Silian_factory = new ServerRequestFactory();
                $Silian_request = $Silian_factory->createServerRequest('GET', '/internal/avatar');
                $this->errorLogService->logException($Silian_exception, $Silian_request, ['context_message' => $Silian_contextMessage]);
                return;
            } catch (\Throwable $Silian_loggingError) {
                $this->logger->error('ErrorLogService logging failed for avatar model', [
                    'message' => $Silian_loggingError->getMessage(),
                    'context_message' => $Silian_contextMessage,
                    'exception_type' => get_class($Silian_loggingError),
                ]);
            }
        }

        $this->logger->error(trim($Silian_contextMessage . ' ' . $Silian_exception->getMessage()), [
            'exception_type' => get_class($Silian_exception),
            'exception_file' => $Silian_exception->getFile(),
            'exception_line' => $Silian_exception->getLine(),
        ]);
    }

}
