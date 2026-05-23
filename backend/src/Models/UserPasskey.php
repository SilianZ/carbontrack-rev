<?php

declare(strict_types=1);

namespace CarbonTrack\Models;

use PDO;

class UserPasskey
{
    public function __construct(private PDO $db)
    {
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    public function listActiveByUserUuid(string $Silian_userUuid): array
    {
        $Silian_stmt = $this->db->prepare(
            'SELECT id, user_uuid, credential_id, label, rp_id, user_handle, transports, aaguid, sign_count,
                    last_used_at, attested_at, credential_type, attestation_format, backup_eligible, backup_state,
                    created_at, updated_at
             FROM user_passkeys
             WHERE user_uuid = :user_uuid AND disabled_at IS NULL
             ORDER BY created_at ASC, id ASC'
        );
        $Silian_stmt->execute(['user_uuid' => strtolower($Silian_userUuid)]);

        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return array_map([$this, 'hydratePasskeyRow'], $Silian_rows);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findActiveByCredentialId(string $Silian_credentialId): ?array
    {
        $Silian_stmt = $this->db->prepare(
            'SELECT * FROM user_passkeys
             WHERE credential_id_hash = :credential_id_hash AND disabled_at IS NULL
             LIMIT 1'
        );
        $Silian_stmt->execute([
            'credential_id_hash' => hash('sha256', $Silian_credentialId),
        ]);

        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        if (!$Silian_row) {
            return null;
        }

        return $this->hydratePasskeyRow($Silian_row);
    }

    /**
     * @param array<string, mixed> $record
     * @return array<string, mixed>
     */
    public function create(array $Silian_record): array
    {
        $Silian_now = gmdate('Y-m-d H:i:s');
        $Silian_stmt = $this->db->prepare(
            'INSERT INTO user_passkeys (
                user_uuid, credential_id, credential_id_hash, credential_type, label, public_key, rp_id, user_handle,
                transports, aaguid, sign_count, attestation_format, backup_eligible, backup_state, meta_json,
                last_used_at, attested_at, created_at, updated_at
            ) VALUES (
                :user_uuid, :credential_id, :credential_id_hash, :credential_type, :label, :public_key, :rp_id, :user_handle,
                :transports, :aaguid, :sign_count, :attestation_format, :backup_eligible, :backup_state, :meta_json,
                :last_used_at, :attested_at, :created_at, :updated_at
            )'
        );

        $Silian_stmt->execute([
            'user_uuid' => strtolower((string) $Silian_record['user_uuid']),
            'credential_id' => (string) $Silian_record['credential_id'],
            'credential_id_hash' => hash('sha256', (string) $Silian_record['credential_id']),
            'credential_type' => (string) ($Silian_record['credential_type'] ?? 'public-key'),
            'label' => $Silian_record['label'] ?? null,
            'public_key' => (string) $Silian_record['public_key'],
            'rp_id' => (string) $Silian_record['rp_id'],
            'user_handle' => (string) $Silian_record['user_handle'],
            'transports' => $this->encodeJson($Silian_record['transports'] ?? []),
            'aaguid' => $Silian_record['aaguid'] ?? null,
            'sign_count' => (int) ($Silian_record['sign_count'] ?? 0),
            'attestation_format' => $Silian_record['attestation_format'] ?? null,
            'backup_eligible' => !empty($Silian_record['backup_eligible']) ? 1 : 0,
            'backup_state' => !empty($Silian_record['backup_state']) ? 1 : 0,
            'meta_json' => $this->encodeJson($Silian_record['meta'] ?? null),
            'last_used_at' => $Silian_record['last_used_at'] ?? null,
            'attested_at' => $Silian_record['attested_at'] ?? $Silian_now,
            'created_at' => $Silian_record['created_at'] ?? $Silian_now,
            'updated_at' => $Silian_record['updated_at'] ?? $Silian_now,
        ]);

        $Silian_id = (int) $this->db->lastInsertId();
        $Silian_created = $this->findById($Silian_id);
        return $Silian_created ?? [];
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findActiveByIdForUserUuid(int $Silian_passkeyId, string $Silian_userUuid): ?array
    {
        $Silian_stmt = $this->db->prepare(
            'SELECT * FROM user_passkeys
             WHERE id = :id AND user_uuid = :user_uuid AND disabled_at IS NULL
             LIMIT 1'
        );
        $Silian_stmt->execute([
            'id' => $Silian_passkeyId,
            'user_uuid' => strtolower($Silian_userUuid),
        ]);

        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        if (!$Silian_row) {
            return null;
        }

        return $this->hydratePasskeyRow($Silian_row);
    }

    public function touchAuthentication(int $Silian_passkeyId, int $Silian_signCount, bool $Silian_backupState, ?string $Silian_lastUsedAt = null): bool
    {
        $Silian_stmt = $this->db->prepare(
            'UPDATE user_passkeys
             SET sign_count = :sign_count,
                 backup_state = :backup_state,
                 last_used_at = :last_used_at,
                 updated_at = :updated_at
             WHERE id = :id AND disabled_at IS NULL'
        );

        $Silian_now = gmdate('Y-m-d H:i:s');
        return $Silian_stmt->execute([
            'sign_count' => $Silian_signCount,
            'backup_state' => $Silian_backupState ? 1 : 0,
            'last_used_at' => $Silian_lastUsedAt ?? $Silian_now,
            'updated_at' => $Silian_now,
            'id' => $Silian_passkeyId,
        ]);
    }

    public function disable(int $Silian_passkeyId, string $Silian_userUuid): bool
    {
        $Silian_stmt = $this->db->prepare(
            'UPDATE user_passkeys
             SET disabled_at = :disabled_at, updated_at = :updated_at
             WHERE id = :id AND user_uuid = :user_uuid AND disabled_at IS NULL'
        );

        $Silian_now = gmdate('Y-m-d H:i:s');
        $Silian_stmt->execute([
            'disabled_at' => $Silian_now,
            'updated_at' => $Silian_now,
            'id' => $Silian_passkeyId,
            'user_uuid' => strtolower($Silian_userUuid),
        ]);

        return $Silian_stmt->rowCount() > 0;
    }

    /**
     * @return array<string, mixed>|null
     */
    public function updateLabel(int $Silian_passkeyId, string $Silian_userUuid, ?string $Silian_label): ?array
    {
        $Silian_stmt = $this->db->prepare(
            'UPDATE user_passkeys
             SET label = :label, updated_at = :updated_at
             WHERE id = :id AND user_uuid = :user_uuid AND disabled_at IS NULL'
        );

        $Silian_now = gmdate('Y-m-d H:i:s');
        $Silian_stmt->execute([
            'label' => $Silian_label,
            'updated_at' => $Silian_now,
            'id' => $Silian_passkeyId,
            'user_uuid' => strtolower($Silian_userUuid),
        ]);

        if ($Silian_stmt->rowCount() === 0) {
            $Silian_existing = $this->findActiveByIdForUserUuid($Silian_passkeyId, $Silian_userUuid);
            if ($Silian_existing === null) {
                return null;
            }
        }

        return $this->findActiveByIdForUserUuid($Silian_passkeyId, $Silian_userUuid);
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    public function listAdminPasskeys(
        string $Silian_search = '',
        int $Silian_limit = 20,
        int $Silian_offset = 0,
        string $Silian_sort = 'created_at_desc'
    ): array {
        $Silian_sortMap = [
            'created_at_desc' => 'up.created_at DESC, up.id DESC',
            'last_used_at_desc' => 'CASE WHEN up.last_used_at IS NULL THEN 1 ELSE 0 END ASC, up.last_used_at DESC, up.id DESC',
            'sign_count_desc' => 'up.sign_count DESC, up.id DESC',
        ];
        $Silian_orderBy = $Silian_sortMap[$Silian_sort] ?? $Silian_sortMap['created_at_desc'];

        $Silian_where = ['up.disabled_at IS NULL', 'u.deleted_at IS NULL'];
        $Silian_params = [];
        if ($Silian_search !== '') {
            $Silian_where[] = '(u.username LIKE :search_username OR u.email LIKE :search_email OR up.label LIKE :search_label OR u.uuid LIKE :search_uuid)';
            $Silian_params['search_username'] = '%' . $Silian_search . '%';
            $Silian_params['search_email'] = '%' . $Silian_search . '%';
            $Silian_params['search_label'] = '%' . $Silian_search . '%';
            $Silian_params['search_uuid'] = '%' . $Silian_search . '%';
        }
        $Silian_whereSql = implode(' AND ', $Silian_where);

        $Silian_sql = "
            SELECT
                up.id,
                up.user_uuid,
                up.label,
                up.sign_count,
                up.last_used_at,
                up.attested_at,
                up.backup_eligible,
                up.backup_state,
                up.created_at,
                up.updated_at,
                u.id AS user_id,
                u.username,
                u.email,
                s.name AS school_name
            FROM user_passkeys up
            INNER JOIN users u ON u.uuid = up.user_uuid
            LEFT JOIN schools s ON s.id = u.school_id
            WHERE {$Silian_whereSql}
            ORDER BY {$Silian_orderBy}
            LIMIT :limit OFFSET :offset
        ";
        $Silian_stmt = $this->db->prepare($Silian_sql);
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_stmt->bindValue(':' . $Silian_key, $Silian_value);
        }
        $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
        $Silian_stmt->bindValue(':offset', $Silian_offset, PDO::PARAM_INT);
        $Silian_stmt->execute();
        $Silian_items = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $Silian_countSql = "
            SELECT COUNT(*)
            FROM user_passkeys up
            INNER JOIN users u ON u.uuid = up.user_uuid
            WHERE {$Silian_whereSql}
        ";
        $Silian_countStmt = $this->db->prepare($Silian_countSql);
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_countStmt->bindValue(':' . $Silian_key, $Silian_value);
        }
        $Silian_countStmt->execute();
        $Silian_total = (int) $Silian_countStmt->fetchColumn();

        return [
            'items' => array_map(function (array $Silian_row): array {
                $Silian_row['id'] = (int) ($Silian_row['id'] ?? 0);
                $Silian_row['user_id'] = (int) ($Silian_row['user_id'] ?? 0);
                $Silian_row['user_uuid'] = isset($Silian_row['user_uuid']) ? strtolower((string) $Silian_row['user_uuid']) : null;
                $Silian_row['sign_count'] = (int) ($Silian_row['sign_count'] ?? 0);
                $Silian_row['backup_eligible'] = (bool) ($Silian_row['backup_eligible'] ?? false);
                $Silian_row['backup_state'] = (bool) ($Silian_row['backup_state'] ?? false);
                return $Silian_row;
            }, $Silian_items),
            'total' => $Silian_total,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getAdminPasskeyStats(?string $Silian_since30Days = null): array
    {
        $Silian_stats = [
            'users_with_passkeys' => 0,
            'total_active_passkeys' => 0,
            'new_passkeys_30d' => 0,
        ];

        $Silian_baseSql = '
            SELECT
                COUNT(*) AS total_active_passkeys,
                COUNT(DISTINCT up.user_uuid) AS users_with_passkeys
            FROM user_passkeys up
            INNER JOIN users u ON u.uuid = up.user_uuid
            WHERE up.disabled_at IS NULL
              AND u.deleted_at IS NULL
        ';
        $Silian_baseStmt = $this->db->query($Silian_baseSql);
        $Silian_baseRow = $Silian_baseStmt ? ($Silian_baseStmt->fetch(PDO::FETCH_ASSOC) ?: []) : [];
        $Silian_stats['users_with_passkeys'] = (int) ($Silian_baseRow['users_with_passkeys'] ?? 0);
        $Silian_stats['total_active_passkeys'] = (int) ($Silian_baseRow['total_active_passkeys'] ?? 0);

        if ($Silian_since30Days !== null) {
            $Silian_newStmt = $this->db->prepare(
                'SELECT COUNT(*)
                 FROM user_passkeys up
                 INNER JOIN users u ON u.uuid = up.user_uuid
                 WHERE up.disabled_at IS NULL
                   AND u.deleted_at IS NULL
                   AND up.created_at >= :since_30_days'
            );
            $Silian_newStmt->execute(['since_30_days' => $Silian_since30Days]);
            $Silian_stats['new_passkeys_30d'] = (int) $Silian_newStmt->fetchColumn();
        }

        return $Silian_stats;
    }

    /**
     * @return array<string, mixed>
     */
    public function getUserPasskeySummary(string $Silian_userUuid): array
    {
        $Silian_stmt = $this->db->prepare(
            'SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN backup_state = 1 THEN 1 ELSE 0 END) AS backup_enabled,
                SUM(CASE WHEN backup_eligible = 1 THEN 1 ELSE 0 END) AS backup_eligible,
                MAX(last_used_at) AS last_used_at,
                MAX(created_at) AS last_registered_at
             FROM user_passkeys
             WHERE user_uuid = :user_uuid AND disabled_at IS NULL'
        );
        $Silian_stmt->execute(['user_uuid' => strtolower($Silian_userUuid)]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'total' => (int) ($Silian_row['total'] ?? 0),
            'backup_enabled' => (int) ($Silian_row['backup_enabled'] ?? 0),
            'backup_eligible' => (int) ($Silian_row['backup_eligible'] ?? 0),
            'last_used_at' => $Silian_row['last_used_at'] ?? null,
            'last_registered_at' => $Silian_row['last_registered_at'] ?? null,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findById(int $Silian_id): ?array
    {
        $Silian_stmt = $this->db->prepare(
            'SELECT id, user_uuid, credential_id, label, rp_id, user_handle, transports, aaguid, sign_count,
                    last_used_at, attested_at, credential_type, attestation_format, backup_eligible, backup_state,
                    created_at, updated_at
             FROM user_passkeys
             WHERE id = :id
             LIMIT 1'
        );
        $Silian_stmt->execute(['id' => $Silian_id]);

        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        if (!$Silian_row) {
            return null;
        }

        return $this->hydratePasskeyRow($Silian_row);
    }

    /**
     * @param mixed $value
     */
    private function encodeJson($Silian_value): ?string
    {
        if ($Silian_value === null) {
            return null;
        }

        $Silian_encoded = json_encode($Silian_value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        return $Silian_encoded === false ? null : $Silian_encoded;
    }

    /**
     * @return string[]
     */
    private function decodeJsonList(?string $Silian_value): array
    {
        if ($Silian_value === null || trim($Silian_value) === '') {
            return [];
        }

        $Silian_decoded = json_decode($Silian_value, true);
        if (!is_array($Silian_decoded)) {
            return [];
        }

        return array_values(array_filter(array_map('strval', $Silian_decoded), static fn (string $Silian_item): bool => $Silian_item !== ''));
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function hydratePasskeyRow(array $Silian_row): array
    {
        if (isset($Silian_row['user_uuid'])) {
            $Silian_row['user_uuid'] = strtolower((string) $Silian_row['user_uuid']);
        }
        $Silian_row['transports'] = $this->decodeJsonList($Silian_row['transports'] ?? null);
        $Silian_row['backup_eligible'] = (bool) ($Silian_row['backup_eligible'] ?? false);
        $Silian_row['backup_state'] = (bool) ($Silian_row['backup_state'] ?? false);
        $Silian_row['sign_count'] = (int) ($Silian_row['sign_count'] ?? 0);

        return $Silian_row;
    }
}
