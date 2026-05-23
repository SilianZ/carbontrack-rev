<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Support\SyntheticRequestFactory;
use Monolog\Logger;
use PDO;

class LeaderboardService
{
    private const DEFAULT_TTL = 600; // 10 minutes
    private const GLOBAL_LIMIT = 50;
    private const REGION_LIMIT = 20;
    private const SCHOOL_LIMIT = 20;

    private PDO $db;
    private RegionService $regionService;
    private ?Logger $logger;
    private ?AuditLogService $auditLogService;
    private ?ErrorLogService $errorLogService;
    private UserProfileViewService $userProfileViewService;
    private string $cacheFile;
    private int $ttlSeconds;

    public function __construct(PDO $Silian_db, RegionService $Silian_regionService, ?Logger $Silian_logger = null, ?string $Silian_cacheDir = null, ?int $Silian_ttlSeconds = null, ?AuditLogService $Silian_auditLogService = null, ?ErrorLogService $Silian_errorLogService = null, ?UserProfileViewService $Silian_userProfileViewService = null)
    {
        $this->db = $Silian_db;
        $this->regionService = $Silian_regionService;
        $this->logger = $Silian_logger;
        $this->auditLogService = $Silian_auditLogService;
        $this->errorLogService = $Silian_errorLogService;
        $this->userProfileViewService = $Silian_userProfileViewService ?? new UserProfileViewService($Silian_regionService);
        $Silian_baseDir = $Silian_cacheDir ?? (dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'cache');
        if (!is_dir($Silian_baseDir)) {
            @mkdir($Silian_baseDir, 0755, true);
        }
        $this->cacheFile = rtrim($Silian_baseDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'leaderboards.json';
        $this->ttlSeconds = $this->validateTtl($Silian_ttlSeconds ?? (int) ($_ENV['LEADERBOARD_CACHE_TTL'] ?? self::DEFAULT_TTL));
    }

    public function getSnapshot(bool $Silian_forceRefresh = false): array
    {
        if (!$Silian_forceRefresh) {
            $Silian_cached = $this->readCache();
            if ($Silian_cached !== null) {
                return $Silian_cached;
            }
        }

        return $this->rebuildCache('auto');
    }

    public function rebuildCache(?string $Silian_reason = null): array
    {
        try {
            $Silian_data = $this->generateSnapshot();
            $this->writeCache($Silian_data, $Silian_reason);
            $this->logAudit('leaderboard_cache_rebuilt', 'success', [
                'reason' => $Silian_reason,
                'entries_global' => count($Silian_data['global'] ?? []),
            ]);
            return $Silian_data;
        } catch (\Throwable $Silian_e) {
            $this->log('error', 'Failed to rebuild leaderboard cache', [
                'error' => $Silian_e->getMessage(),
                'reason' => $Silian_reason,
            ]);
            $this->logAudit('leaderboard_cache_rebuild_failed', 'failed', [
                'reason' => $Silian_reason,
                'error' => $Silian_e->getMessage(),
            ]);
            $this->logError($Silian_e, '/internal/leaderboard/rebuild', [
                'reason' => $Silian_reason,
            ]);
            return $this->readCache() ?? [
                'generated_at' => null,
                'expires_at' => null,
                'global' => [],
                'regions' => [],
                'schools' => [],
            ];
        }
    }

    private function generateSnapshot(): array
    {
        $Silian_sql = "SELECT u.id, u.username, COALESCE(u.points, 0) AS total_points,
                    u.avatar_id, u.region_code, u.school_id, s.name AS school_name, a.file_path AS avatar_path
                FROM users u
                LEFT JOIN avatars a ON u.avatar_id = a.id
                LEFT JOIN schools s ON u.school_id = s.id
                WHERE u.deleted_at IS NULL
                ORDER BY u.points DESC, u.id ASC";

        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute();
        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $Silian_global = [];
        $Silian_regions = [];
        $Silian_schools = [];

        foreach ($Silian_rows as $Silian_row) {
            $Silian_profileFields = $this->userProfileViewService->buildProfileFields($Silian_row);
            $Silian_entry = $this->formatEntry($Silian_row, $Silian_profileFields);

            if (count($Silian_global) < self::GLOBAL_LIMIT) {
                $Silian_entry['rank'] = count($Silian_global) + 1;
                $Silian_global[] = $Silian_entry;
            }

            $Silian_regionCode = $Silian_profileFields['region_code'] ?? null;
            if ($Silian_regionCode) {
                if (!isset($Silian_regions[$Silian_regionCode])) {
                    $Silian_context = [
                        'region_code' => $Silian_profileFields['region_code'] ?? $Silian_regionCode,
                        'country_code' => $Silian_profileFields['country_code'] ?? null,
                        'state_code' => $Silian_profileFields['state_code'] ?? null,
                        'region_label' => $Silian_profileFields['region_label'] ?? null,
                    ];
                    $Silian_regions[$Silian_regionCode] = [
                        'region_code' => $Silian_context['region_code'] ?? $Silian_regionCode,
                        'country_code' => $Silian_context['country_code'] ?? null,
                        'state_code' => $Silian_context['state_code'] ?? null,
                        'region_label' => $Silian_context['region_label'] ?? null,
                        'entries' => [],
                    ];
                }
                if (count($Silian_regions[$Silian_regionCode]['entries']) < self::REGION_LIMIT) {
                    $Silian_entry['rank'] = count($Silian_regions[$Silian_regionCode]['entries']) + 1;
                    $Silian_regions[$Silian_regionCode]['entries'][] = $Silian_entry;
                }
            }

            $Silian_schoolId = isset($Silian_row['school_id']) ? (int) $Silian_row['school_id'] : 0;
            if ($Silian_schoolId > 0) {
                if (!isset($Silian_schools[$Silian_schoolId])) {
                    $Silian_schools[$Silian_schoolId] = [
                        'school_id' => $Silian_schoolId,
                        'school_name' => $Silian_profileFields['school_name'] ?? null,
                        'entries' => [],
                    ];
                }
                if (count($Silian_schools[$Silian_schoolId]['entries']) < self::SCHOOL_LIMIT) {
                    $Silian_entry['rank'] = count($Silian_schools[$Silian_schoolId]['entries']) + 1;
                    $Silian_schools[$Silian_schoolId]['entries'][] = $Silian_entry;
                }
            }
        }

        $Silian_generatedAt = (new \DateTimeImmutable('now'))->format(DATE_ATOM);
        $Silian_expiresAt = (new \DateTimeImmutable('now'))->modify(sprintf('+%d seconds', $this->ttlSeconds))->format(DATE_ATOM);

        return [
            'generated_at' => $Silian_generatedAt,
            'expires_at' => $Silian_expiresAt,
            'ttl' => $this->ttlSeconds,
            'global' => $Silian_global,
            'regions' => $Silian_regions,
            'schools' => $Silian_schools,
        ];
    }

    private function readCache(): ?array
    {
        if (!is_file($this->cacheFile)) {
            return null;
        }

        $Silian_modified = @filemtime($this->cacheFile);
        if ($Silian_modified === false || (time() - $Silian_modified) > $this->ttlSeconds) {
            return null;
        }

        $Silian_contents = @file_get_contents($this->cacheFile);
        if ($Silian_contents === false) {
            return null;
        }

        $Silian_decoded = json_decode($Silian_contents, true);
        if (!is_array($Silian_decoded)) {
            return null;
        }

        return $Silian_decoded;
    }

    private function writeCache(array $Silian_data, ?string $Silian_reason = null): void
    {
        if (!is_dir(dirname($this->cacheFile))) {
            @mkdir(dirname($this->cacheFile), 0755, true);
        }
        $Silian_payload = json_encode($Silian_data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        if ($Silian_payload === false) {
            return;
        }
        @file_put_contents($this->cacheFile, $Silian_payload, LOCK_EX);
        $this->log('info', 'Leaderboard cache written', [
            'reason' => $Silian_reason,
            'entries_global' => count($Silian_data['global'] ?? []),
        ]);
        $this->logAudit('leaderboard_cache_written', 'success', [
            'reason' => $Silian_reason,
            'entries_global' => count($Silian_data['global'] ?? []),
        ]);
    }

    private function formatEntry(array $Silian_row, array $Silian_profileFields): array
    {
        return [
            'id' => isset($Silian_row['id']) ? (int) $Silian_row['id'] : null,
            'username' => $Silian_row['username'] ?? null,
            'total_points' => isset($Silian_row['total_points']) ? (float) $Silian_row['total_points'] : 0.0,
            'avatar_id' => isset($Silian_row['avatar_id']) ? (int) $Silian_row['avatar_id'] : null,
            'avatar_path' => $Silian_row['avatar_path'] ?? null,
            'region_code' => $Silian_profileFields['region_code'] ?? null,
            'school_id' => isset($Silian_row['school_id']) ? (int) $Silian_row['school_id'] : null,
            'school_name' => $Silian_profileFields['school_name'] ?? null,
        ];
    }

    private function validateTtl(int $Silian_value): int
    {
        return max(60, min($Silian_value, 3600));
    }

    private function log(string $Silian_level, string $Silian_message, array $Silian_context = []): void
    {
        if (!$this->logger) {
            return;
        }
        try {
            $this->logger->log($Silian_level, $Silian_message, $Silian_context);
        } catch (\Throwable $Silian_ignore) {
            // swallow logger failures
        }
    }

    private function logAudit(string $Silian_action, string $Silian_status, array $Silian_data = []): void
    {
        if (!$this->auditLogService) {
            return;
        }

        try {
            $this->auditLogService->logSystemEvent($Silian_action, 'leaderboard_service', [
                'status' => $Silian_status,
                'endpoint' => '/internal/leaderboard/cache',
                'request_method' => 'SYSTEM',
                'request_data' => $Silian_data,
            ]);
        } catch (\Throwable $Silian_ignore) {
            // 审计日志失败不阻断主流程
        }
    }

    private function logError(\Throwable $Silian_exception, string $Silian_path, array $Silian_context = []): void
    {
        if (!$this->errorLogService) {
            return;
        }

        try {
            $Silian_request = SyntheticRequestFactory::fromContext($Silian_path, 'SYSTEM', null, [], $Silian_context, ['PHP_SAPI' => PHP_SAPI]);
            $this->errorLogService->logException($Silian_exception, $Silian_request, $Silian_context);
        } catch (\Throwable $Silian_ignore) {
            // swallow secondary logging failure
        }
    }
}
