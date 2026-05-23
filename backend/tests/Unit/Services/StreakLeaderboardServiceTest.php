<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\RegionService;
use CarbonTrack\Services\StreakLeaderboardService;
use CarbonTrack\Services\UserProfileViewService;
use PHPUnit\Framework\TestCase;

class StreakLeaderboardServiceTest extends TestCase
{
    public function testGetSnapshotLogsAuditWhenCacheHit(): void
    {
        $Silian_cacheDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ct_streak_cache_' . uniqid('', true);
        mkdir($Silian_cacheDir, 0777, true);
        $Silian_cacheFile = $Silian_cacheDir . DIRECTORY_SEPARATOR . 'streak_leaderboards.json';

        $Silian_payload = [
            'generated_at' => '2026-01-01T00:00:00+00:00',
            'expires_at' => '2026-01-01T00:10:00+00:00',
            'global' => [['id' => 1, 'current_streak' => 3]],
            'regions' => [],
            'schools' => [],
            'ranks' => ['global' => [1 => 1], 'regions' => [], 'schools' => []],
        ];
        file_put_contents($Silian_cacheFile, json_encode($Silian_payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('log')
            ->with($this->callback(function (array $Silian_logPayload) use ($Silian_cacheFile): bool {
                return ($Silian_logPayload['action'] ?? null) === 'streak_leaderboard_cache_hit'
                    && ($Silian_logPayload['data']['cache_file'] ?? null) === $Silian_cacheFile;
            }))
            ->willReturn(true);

        $Silian_service = new StreakLeaderboardService(
            $this->createMock(\PDO::class),
            $this->createMock(RegionService::class),
            null,
            $Silian_cacheDir,
            600,
            $Silian_audit,
            null
        );

        $Silian_result = $Silian_service->getSnapshot(false);

        $this->assertSame($Silian_payload['generated_at'], $Silian_result['generated_at']);
        @unlink($Silian_cacheFile);
        @rmdir($Silian_cacheDir);
    }

    public function testRebuildCacheUsesCompatibleSchoolAndRegionFields(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $Silian_pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, region_code TEXT, school_id INTEGER, avatar_id INTEGER, deleted_at TEXT)');
        $Silian_pdo->exec('CREATE TABLE schools (id INTEGER PRIMARY KEY, name TEXT)');
        $Silian_pdo->exec('CREATE TABLE avatars (id INTEGER PRIMARY KEY, file_path TEXT)');
        $Silian_pdo->exec('CREATE TABLE user_checkins (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, checkin_date TEXT)');

        $Silian_today = new \DateTimeImmutable('now');
        $Silian_todayStr = $Silian_today->format('Y-m-d');
        $Silian_yesterdayStr = $Silian_today->modify('-1 day')->format('Y-m-d');

        $Silian_pdo->exec("INSERT INTO schools (id, name) VALUES (7, 'Canonical Academy')");
        $Silian_pdo->exec("INSERT INTO users (id, username, region_code, school_id, avatar_id, deleted_at) VALUES (1, 'alice', 'US-UM-81', 7, NULL, NULL)");
        $Silian_pdo->exec("INSERT INTO user_checkins (user_id, checkin_date) VALUES (1, '{$Silian_yesterdayStr}')");
        $Silian_pdo->exec("INSERT INTO user_checkins (user_id, checkin_date) VALUES (1, '{$Silian_todayStr}')");

        $Silian_regionService = $this->createMock(RegionService::class);
        $Silian_regionService->method('getRegionContext')
            ->willReturnCallback(static function (?string $Silian_value): ?array {
                if ($Silian_value !== 'US-UM-81') {
                    return null;
                }

                return [
                    'region_code' => 'US-UM-81',
                    'region_label' => null,
                    'country_code' => 'US',
                    'state_code' => 'UM-81',
                    'country_name' => 'United States',
                    'state_name' => null,
                ];
            });

        $Silian_cacheDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ct_streak_cache_' . uniqid('', true);
        mkdir($Silian_cacheDir, 0777, true);

        try {
            $Silian_service = new StreakLeaderboardService(
                $Silian_pdo,
                $Silian_regionService,
                null,
                $Silian_cacheDir,
                600,
                null,
                null,
                new UserProfileViewService($Silian_regionService)
            );

            $Silian_snapshot = $Silian_service->rebuildCache('test');

            $this->assertSame('US-UM-81', $Silian_snapshot['global'][0]['region_code']);
            $this->assertSame('Canonical Academy', $Silian_snapshot['global'][0]['school_name']);
            $this->assertArrayHasKey('US-UM-81', $Silian_snapshot['regions']);
            $this->assertSame('Canonical Academy', $Silian_snapshot['schools'][7]['school_name']);
        } finally {
            @unlink($Silian_cacheDir . DIRECTORY_SEPARATOR . 'streak_leaderboards.json');
            @rmdir($Silian_cacheDir);
        }
    }
}
