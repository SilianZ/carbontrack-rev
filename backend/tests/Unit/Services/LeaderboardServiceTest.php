<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\LeaderboardService;
use CarbonTrack\Services\RegionService;
use CarbonTrack\Services\UserProfileViewService;
use PHPUnit\Framework\TestCase;

class LeaderboardServiceTest extends TestCase
{
    public function testRebuildCacheUsesCompatibleSchoolAndRegionFields(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $Silian_pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, points REAL, avatar_id INTEGER, region_code TEXT, school_id INTEGER, deleted_at TEXT)');
        $Silian_pdo->exec('CREATE TABLE schools (id INTEGER PRIMARY KEY, name TEXT)');
        $Silian_pdo->exec('CREATE TABLE avatars (id INTEGER PRIMARY KEY, file_path TEXT)');
        $Silian_pdo->exec("INSERT INTO schools (id, name) VALUES (7, 'Canonical Academy')");
        $Silian_pdo->exec("INSERT INTO users (id, username, points, avatar_id, region_code, school_id, deleted_at) VALUES (1, 'alice', 520, NULL, 'US-UM-81', 7, NULL)");

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

        $Silian_cacheDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ct_leaderboard_cache_' . uniqid('', true);
        mkdir($Silian_cacheDir, 0777, true);

        try {
            $Silian_service = new LeaderboardService(
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
            @unlink($Silian_cacheDir . DIRECTORY_SEPARATOR . 'leaderboards.json');
            @rmdir($Silian_cacheDir);
        }
    }
}
