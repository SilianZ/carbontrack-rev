<?php

declare(strict_types=1);

namespace CarbonTrack\Models;

use PDO;

class WebauthnChallenge
{
    public function __construct(private PDO $db)
    {
    }

    /**
     * @param array<string, mixed> $record
     */
    public function create(array $Silian_record): void
    {
        $Silian_stmt = $this->db->prepare(
            'INSERT INTO webauthn_challenges (
                challenge_id, user_uuid, flow_type, challenge, request_id, context_json, expires_at, consumed_at, created_at, updated_at
            ) VALUES (
                :challenge_id, :user_uuid, :flow_type, :challenge, :request_id, :context_json, :expires_at, :consumed_at, :created_at, :updated_at
            )'
        );

        $Silian_now = gmdate('Y-m-d H:i:s');
        $Silian_stmt->execute([
            'challenge_id' => (string) $Silian_record['challenge_id'],
            'user_uuid' => isset($Silian_record['user_uuid']) && $Silian_record['user_uuid'] !== null
                ? strtolower((string) $Silian_record['user_uuid'])
                : null,
            'flow_type' => (string) $Silian_record['flow_type'],
            'challenge' => (string) $Silian_record['challenge'],
            'request_id' => $Silian_record['request_id'] ?? null,
            'context_json' => $this->encodeJson($Silian_record['context'] ?? null),
            'expires_at' => (string) $Silian_record['expires_at'],
            'consumed_at' => $Silian_record['consumed_at'] ?? null,
            'created_at' => $Silian_record['created_at'] ?? $Silian_now,
            'updated_at' => $Silian_record['updated_at'] ?? $Silian_now,
        ]);
    }

    /**
     * @return array<string, mixed>|null
     */
    public function findActive(string $Silian_challengeId, string $Silian_flowType, ?string $Silian_userUuid = null): ?array
    {
        $Silian_sql = 'SELECT * FROM webauthn_challenges
                WHERE challenge_id = :challenge_id
                  AND flow_type = :flow_type
                  AND consumed_at IS NULL
                  AND expires_at > :current_time';
        $Silian_params = [
            'challenge_id' => $Silian_challengeId,
            'flow_type' => $Silian_flowType,
            'current_time' => $this->utcNow(),
        ];

        if ($Silian_userUuid !== null) {
            $Silian_sql .= ' AND user_uuid = :user_uuid';
            $Silian_params['user_uuid'] = strtolower($Silian_userUuid);
        }

        $Silian_sql .= ' ORDER BY id DESC LIMIT 1';

        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute($Silian_params);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        if (!$Silian_row) {
            return null;
        }

        if (isset($Silian_row['user_uuid']) && $Silian_row['user_uuid'] !== null) {
            $Silian_row['user_uuid'] = strtolower((string) $Silian_row['user_uuid']);
        }
        $Silian_row['context'] = $this->decodeJsonObject($Silian_row['context_json'] ?? null);
        return $Silian_row;
    }

    public function markConsumed(int $Silian_id): bool
    {
        $Silian_stmt = $this->db->prepare(
            'UPDATE webauthn_challenges
             SET consumed_at = :consumed_at, updated_at = :updated_at
             WHERE id = :id AND consumed_at IS NULL'
        );

        $Silian_now = gmdate('Y-m-d H:i:s');
        $Silian_stmt->execute([
            'consumed_at' => $Silian_now,
            'updated_at' => $Silian_now,
            'id' => $Silian_id,
        ]);

        return $Silian_stmt->rowCount() > 0;
    }

    public function deleteExpired(): int
    {
        $Silian_stmt = $this->db->prepare('DELETE FROM webauthn_challenges WHERE expires_at <= :current_time');
        $Silian_stmt->execute([
            'current_time' => $this->utcNow(),
        ]);
        return $Silian_stmt->rowCount();
    }

    private function utcNow(): string
    {
        return gmdate('Y-m-d H:i:s');
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
     * @return array<string, mixed>
     */
    private function decodeJsonObject(?string $Silian_value): array
    {
        if ($Silian_value === null || trim($Silian_value) === '') {
            return [];
        }

        $Silian_decoded = json_decode($Silian_value, true);
        return is_array($Silian_decoded) ? $Silian_decoded : [];
    }
}
