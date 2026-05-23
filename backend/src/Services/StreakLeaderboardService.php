<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Support\SyntheticRequestFactory;
use DateTimeImmutable;
use DateTimeZone;
use Monolog\Logger;
use PDO;

class StreakLeaderboardService
{
    private const DEFAULT_TTL = 600;
    private const GLOBAL_LIMIT = 50;
    private const REGION_LIMIT = 20;
    private const SCHOOL_LIMIT = 20;

    private PDO $db;
    private RegionService $regionService;
    private ?Logger $logger;
    private string $cacheFile;
    private int $ttlSeconds;
    private DateTimeZone $timezone;
    private ?AuditLogService $auditLogService;
    private ?ErrorLogService $errorLogService;
    private UserProfileViewService $userProfileViewService;

    public function __construct(
        PDO $Silian_db,
        RegionService $Silian_regionService,
        ?Logger $Silian_logger = null,
        ?string $Silian_cacheDir = null,
        ?int $Silian_ttlSeconds = null,
        ?AuditLogService $Silian_auditLogService = null,
        ?ErrorLogService $Silian_errorLogService = null,
        ?UserProfileViewService $Silian_userProfileViewService = null
    )
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
        $this->cacheFile = rtrim($Silian_baseDir, DIRECTORY_SEPARATOR) . DIRECTORY_SEPARATOR . 'streak_leaderboards.json';
        $this->ttlSeconds = $this->validateTtl($Silian_ttlSeconds ?? (int) ($_ENV['STREAK_LEADERBOARD_CACHE_TTL'] ?? self::DEFAULT_TTL));

        $Silian_tzName = $_ENV['APP_TIMEZONE'] ?? date_default_timezone_get();
        if (!$Silian_tzName) {
            $Silian_tzName = 'UTC';
        }
        $this->timezone = new DateTimeZone($Silian_tzName);
    }

    public function getSnapshot(bool $Silian_forceRefresh = false): array
    {
        if (!$Silian_forceRefresh) {
            $Silian_cached = $this->readCache();
            if ($Silian_cached !== null) {
                $this->logAudit('streak_leaderboard_cache_hit', [
                    'cache_file' => $this->cacheFile,
                ]);
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
            $this->logAudit('streak_leaderboard_cache_rebuilt', [
                'reason' => $Silian_reason,
                'global_entries' => count($Silian_data['global'] ?? []),
            ]);
            return $Silian_data;
        } catch (\Throwable $Silian_e) {
            $this->logAudit('streak_leaderboard_cache_rebuild_failed', [
                'reason' => $Silian_reason,
            ], 'failed');
            $this->logError($Silian_e, '/internal/streak-leaderboard/rebuild', 'Failed to rebuild streak leaderboard cache', [
                'reason' => $Silian_reason,
            ]);
            $this->log('error', 'Failed to rebuild streak leaderboard cache', [
                'error' => $Silian_e->getMessage(),
                'reason' => $Silian_reason,
            ]);
            return $this->readCache() ?? [
                'generated_at' => null,
                'expires_at' => null,
                'global' => [],
                'regions' => [],
                'schools' => [],
                'ranks' => [
                    'global' => [],
                    'regions' => [],
                    'schools' => [],
                ],
            ];
        }
    }

    private function generateSnapshot(): array
    {
        $Silian_sql = "SELECT uc.user_id, uc.checkin_date,
                    u.username, u.region_code, u.school_id, u.avatar_id,
                    s.name AS school_name, a.file_path AS avatar_path
                FROM user_checkins uc
                JOIN users u ON u.id = uc.user_id AND u.deleted_at IS NULL
                LEFT JOIN schools s ON u.school_id = s.id
                LEFT JOIN avatars a ON u.avatar_id = a.id
                ORDER BY uc.user_id ASC, uc.checkin_date ASC";

        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute();

        $Silian_today = new DateTimeImmutable('now', $this->timezone);
        $Silian_todayStr = $Silian_today->format('Y-m-d');
        $Silian_yesterdayStr = $Silian_today->modify('-1 day')->format('Y-m-d');

        $Silian_entries = [];
        $Silian_currentUserId = null;
        $Silian_current = null;

        while ($Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC)) {
            $Silian_userId = isset($Silian_row['user_id']) ? (int) $Silian_row['user_id'] : 0;
            if ($Silian_userId <= 0) {
                continue;
            }
            $Silian_checkinDate = $Silian_row['checkin_date'] ?? null;
            if (!$Silian_checkinDate) {
                continue;
            }

            if ($Silian_currentUserId === null || $Silian_currentUserId !== $Silian_userId) {
                if ($Silian_currentUserId !== null && $Silian_current) {
                    $Silian_entry = $this->buildStreakEntry($Silian_current, $Silian_todayStr, $Silian_yesterdayStr);
                    if ($Silian_entry) {
                        $Silian_entries[] = $Silian_entry;
                    }
                }

                $Silian_currentUserId = $Silian_userId;
                $Silian_profileFields = $this->userProfileViewService->buildProfileFields($Silian_row);
                $Silian_current = [
                    'id' => $Silian_userId,
                    'username' => $Silian_row['username'] ?? null,
                    'region_code' => $Silian_profileFields['region_code'] ?? null,
                    'school_id' => $Silian_profileFields['school_id'] ?? null,
                    'school_name' => $Silian_profileFields['school_name'] ?? null,
                    'avatar_id' => isset($Silian_row['avatar_id']) ? (int) $Silian_row['avatar_id'] : null,
                    'avatar_path' => $Silian_row['avatar_path'] ?? null,
                    'last_date' => null,
                    'current_run' => 0,
                    'longest' => 0,
                    'total' => 0,
                ];
            }

            if (!$Silian_current) {
                continue;
            }

            if ($Silian_current['last_date'] === null) {
                $Silian_current['current_run'] = 1;
                $Silian_current['longest'] = 1;
                $Silian_current['last_date'] = $Silian_checkinDate;
                $Silian_current['total'] = 1;
                continue;
            }

            $Silian_diff = $this->diffDays($Silian_current['last_date'], $Silian_checkinDate);
            if ($Silian_diff === 0) {
                continue;
            }

            if ($Silian_diff === 1) {
                $Silian_current['current_run']++;
            } else {
                $Silian_current['current_run'] = 1;
            }

            if ($Silian_current['current_run'] > $Silian_current['longest']) {
                $Silian_current['longest'] = $Silian_current['current_run'];
            }

            $Silian_current['last_date'] = $Silian_checkinDate;
            $Silian_current['total']++;
        }

        if ($Silian_currentUserId !== null && $Silian_current) {
            $Silian_entry = $this->buildStreakEntry($Silian_current, $Silian_todayStr, $Silian_yesterdayStr);
            if ($Silian_entry) {
                $Silian_entries[] = $Silian_entry;
            }
        }

        $Silian_globalSorted = $this->sortEntries($Silian_entries);
        $Silian_global = $this->limitEntries($Silian_globalSorted, self::GLOBAL_LIMIT);
        $Silian_globalRanks = $this->buildRanks($Silian_globalSorted);

        $Silian_regions = [];
        $Silian_regionRanks = [];
        foreach ($Silian_entries as $Silian_entry) {
            $Silian_regionCode = $Silian_entry['region_code'] ?? null;
            if (!$Silian_regionCode) {
                continue;
            }
            if (!isset($Silian_regions[$Silian_regionCode])) {
                $Silian_context = $this->userProfileViewService->buildRegionFields(['region_code' => $Silian_regionCode]);
                $Silian_regions[$Silian_regionCode] = [
                    'region_code' => $Silian_context['region_code'] ?? $Silian_regionCode,
                    'country_code' => $Silian_context['country_code'] ?? null,
                    'state_code' => $Silian_context['state_code'] ?? null,
                    'region_label' => $Silian_context['region_label'] ?? null,
                    'entries' => [],
                ];
            }
            $Silian_regions[$Silian_regionCode]['entries'][] = $Silian_entry;
        }

        foreach ($Silian_regions as $Silian_regionCode => $Silian_bucket) {
            $Silian_sorted = $this->sortEntries($Silian_bucket['entries']);
            $Silian_regions[$Silian_regionCode]['entries'] = $this->limitEntries($Silian_sorted, self::REGION_LIMIT);
            $Silian_regionRanks[$Silian_regionCode] = $this->buildRanks($Silian_sorted);
        }

        $Silian_schools = [];
        $Silian_schoolRanks = [];
        foreach ($Silian_entries as $Silian_entry) {
            $Silian_schoolId = isset($Silian_entry['school_id']) ? (int) $Silian_entry['school_id'] : 0;
            if ($Silian_schoolId <= 0) {
                continue;
            }
            if (!isset($Silian_schools[$Silian_schoolId])) {
                $Silian_schools[$Silian_schoolId] = [
                    'school_id' => $Silian_schoolId,
                    'school_name' => $Silian_entry['school_name'] ?? null,
                    'entries' => [],
                ];
            }
            $Silian_schools[$Silian_schoolId]['entries'][] = $Silian_entry;
        }

        foreach ($Silian_schools as $Silian_schoolId => $Silian_bucket) {
            $Silian_sorted = $this->sortEntries($Silian_bucket['entries']);
            $Silian_schools[$Silian_schoolId]['entries'] = $this->limitEntries($Silian_sorted, self::SCHOOL_LIMIT);
            $Silian_schoolRanks[$Silian_schoolId] = $this->buildRanks($Silian_sorted);
        }

        $Silian_generatedAt = (new DateTimeImmutable('now', $this->timezone))->format(DATE_ATOM);
        $Silian_expiresAt = (new DateTimeImmutable('now', $this->timezone))
            ->modify(sprintf('+%d seconds', $this->ttlSeconds))
            ->format(DATE_ATOM);

        return [
            'generated_at' => $Silian_generatedAt,
            'expires_at' => $Silian_expiresAt,
            'ttl' => $this->ttlSeconds,
            'global' => $Silian_global,
            'regions' => $Silian_regions,
            'schools' => $Silian_schools,
            'ranks' => [
                'global' => $Silian_globalRanks,
                'regions' => $Silian_regionRanks,
                'schools' => $Silian_schoolRanks,
            ],
        ];
    }

    private function buildStreakEntry(array $Silian_accumulator, string $Silian_todayStr, string $Silian_yesterdayStr): ?array
    {
        $Silian_lastDate = $Silian_accumulator['last_date'] ?? null;
        if (!$Silian_lastDate) {
            return null;
        }

        $Silian_currentStreak = 0;
        if ($Silian_lastDate === $Silian_todayStr || $Silian_lastDate === $Silian_yesterdayStr) {
            $Silian_currentStreak = (int) ($Silian_accumulator['current_run'] ?? 0);
        }

        $Silian_longest = (int) ($Silian_accumulator['longest'] ?? 0);
        if ($Silian_longest <= 0) {
            $Silian_longest = (int) ($Silian_accumulator['current_run'] ?? 0);
        }

        return [
            'id' => $Silian_accumulator['id'] ?? null,
            'username' => $Silian_accumulator['username'] ?? null,
            'region_code' => $Silian_accumulator['region_code'] ?? null,
            'school_id' => $Silian_accumulator['school_id'] ?? null,
            'school_name' => $Silian_accumulator['school_name'] ?? null,
            'avatar_id' => $Silian_accumulator['avatar_id'] ?? null,
            'avatar_path' => $Silian_accumulator['avatar_path'] ?? null,
            'current_streak' => $Silian_currentStreak,
            'longest_streak' => $Silian_longest,
            'total_checkins' => (int) ($Silian_accumulator['total'] ?? 0),
            'last_checkin_date' => $Silian_lastDate,
        ];
    }

    private function diffDays(string $Silian_from, string $Silian_to): int
    {
        $Silian_fromDate = new DateTimeImmutable($Silian_from, $this->timezone);
        $Silian_toDate = new DateTimeImmutable($Silian_to, $this->timezone);
        return (int) $Silian_fromDate->diff($Silian_toDate)->format('%r%a');
    }

    private function sortEntries(array $Silian_entries): array
    {
        usort($Silian_entries, function (array $Silian_a, array $Silian_b): int {
            $Silian_cmp = ($Silian_b['current_streak'] ?? 0) <=> ($Silian_a['current_streak'] ?? 0);
            if ($Silian_cmp !== 0) {
                return $Silian_cmp;
            }
            $Silian_cmp = ($Silian_b['longest_streak'] ?? 0) <=> ($Silian_a['longest_streak'] ?? 0);
            if ($Silian_cmp !== 0) {
                return $Silian_cmp;
            }
            $Silian_cmp = ($Silian_b['total_checkins'] ?? 0) <=> ($Silian_a['total_checkins'] ?? 0);
            if ($Silian_cmp !== 0) {
                return $Silian_cmp;
            }
            $Silian_cmp = strcmp((string) ($Silian_b['last_checkin_date'] ?? ''), (string) ($Silian_a['last_checkin_date'] ?? ''));
            if ($Silian_cmp !== 0) {
                return $Silian_cmp;
            }
            return ($Silian_a['id'] ?? 0) <=> ($Silian_b['id'] ?? 0);
        });
        return $Silian_entries;
    }

    private function limitEntries(array $Silian_entries, int $Silian_limit): array
    {
        $Silian_limited = array_slice($Silian_entries, 0, $Silian_limit);
        foreach ($Silian_limited as $Silian_index => &$Silian_entry) {
            $Silian_entry['rank'] = $Silian_index + 1;
        }
        unset($Silian_entry);
        return $Silian_limited;
    }

    private function buildRanks(array $Silian_sortedEntries): array
    {
        $Silian_ranks = [];
        foreach ($Silian_sortedEntries as $Silian_index => $Silian_entry) {
            $Silian_userId = isset($Silian_entry['id']) ? (int) $Silian_entry['id'] : null;
            if ($Silian_userId !== null && $Silian_userId > 0) {
                $Silian_ranks[$Silian_userId] = $Silian_index + 1;
            }
        }
        return $Silian_ranks;
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
        $this->logAudit('streak_leaderboard_cache_written', [
            'reason' => $Silian_reason,
            'entries_global' => count($Silian_data['global'] ?? []),
            'cache_file' => $this->cacheFile,
        ]);
        $this->log('info', 'Streak leaderboard cache written', [
            'reason' => $Silian_reason,
            'entries_global' => count($Silian_data['global'] ?? []),
        ]);
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

    private function logAudit(string $Silian_action, array $Silian_context = [], string $Silian_status = 'success'): void
    {
        if (!$this->auditLogService) {
            return;
        }

        try {
            $this->auditLogService->log([
                'action' => $Silian_action,
                'operation_category' => 'leaderboard',
                'actor_type' => 'system',
                'status' => $Silian_status,
                'data' => $Silian_context,
            ]);
        } catch (\Throwable $Silian_ignore) {
            // ignore audit failures for streak leaderboard
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
            // ignore error log failures for streak leaderboard
        }
    }
}
