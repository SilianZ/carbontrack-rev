<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use CarbonTrack\Tests\Integration\TestSchemaBuilder;
use PHPUnit\Framework\TestCase;
use CarbonTrack\Controllers\UserController;

class UserControllerTest extends TestCase
{
    public function testControllerClassExists(): void
    {
        $this->assertTrue(class_exists(UserController::class));
    }

    public function testUpdateProfileSuccess(): void
    {
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1]);
        $Silian_avatar->method('isAvatarAvailable')->willReturn(true);
        $Silian_avatar->method('getAvatarById')->willReturn([
            'id' => 10,
            'name' => 'Test Avatar',
            'file_path' => '/avatars/default/avatar_01.png'
        ]);
        $Silian_audit->expects($this->once())->method('log');

        // 1) SELECT current user / 2) optional SELECT schools / 3) UPDATE users / 4) SELECT joined user
        $Silian_stmtSelectUser = $this->createMock(\PDOStatement::class);
        $Silian_stmtSelectUser->method('execute')->willReturn(true);
        $Silian_stmtSelectUser->method('fetch')->willReturn([
            'id' => 1,
            'username' => 'john',
            'avatar_id' => null,
            'school_id' => null
        ]);

        $Silian_stmtSelectSchool = $this->createMock(\PDOStatement::class);
        $Silian_stmtSelectSchool->method('execute')->willReturn(true);
        $Silian_stmtSelectSchool->method('fetch')->willReturn(['id' => 5]);

        $Silian_stmtUpdate = $this->createMock(\PDOStatement::class);
        $Silian_stmtUpdate->method('execute')->willReturn(true);

        $Silian_stmtJoined = $this->createMock(\PDOStatement::class);
        $Silian_stmtJoined->method('execute')->willReturn(true);
        $Silian_stmtJoined->method('fetch')->willReturn([
            'id' => 1,
            'uuid' => 'u-1',
            'username' => 'john',
            'email' => 'john@example.com',
            'school_id' => 5,
            'school_name' => 'Test School',
            'points' => 0,
            'is_admin' => 0,
            'avatar_id' => 10,
            'avatar_path' => '/avatars/default/avatar_01.png',
            'lastlgn' => null,
            'updated_at' => '2025-01-01 00:00:00'
        ]);

        $Silian_pdo = $this->createMock(\PDO::class);
        // prepare 顺序: select user -> select school -> update -> select joined
        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls(
            $Silian_stmtSelectUser,
            $Silian_stmtSelectSchool,
            $Silian_stmtUpdate,
            $Silian_stmtJoined
        );

        $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);
        $Silian_turnstile = $this->mockTurnstile();
        $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);
        $Silian_controller = new UserController($Silian_auth, $Silian_audit, $Silian_msg, $Silian_avatar, $Silian_prefs, $Silian_turnstile, null, $Silian_logger, $Silian_pdo, $this->createMock(\CarbonTrack\Services\ErrorLogService::class), null, $Silian_region);

        $Silian_request = makeRequest('PUT', '/users/me/profile', ['avatar_id' => 10, 'school_id' => 5]);
        $Silian_response = new \Slim\Psr7\Response();

        try {
            $Silian_resp = $Silian_controller->updateProfile($Silian_request, $Silian_response);
            $this->assertEquals(200, $Silian_resp->getStatusCode());
            $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
            $this->assertTrue($Silian_json['success']);
            $this->assertEquals(10, $Silian_json['data']['avatar_id']);
            $this->assertEquals('/avatars/default/avatar_01.png', $Silian_json['data']['avatar_path']);
            $this->assertNull($Silian_json['data']['avatar_url']);
        } catch (\Exception $Silian_e) {
            $this->fail('Exception occurred: ' . $Silian_e->getMessage() . ' in ' . $Silian_e->getFile() . ':' . $Silian_e->getLine());
        }
    }

    public function testUpdateProfileRequiresTurnstileForSchoolChange(): void
    {
        $Silian_previousEnv = $_ENV['APP_ENV'] ?? null;
        $_ENV['APP_ENV'] = 'production';

        try {
            $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
            $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
            $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
            $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
            $Silian_logger = $this->createMock(\Monolog\Logger::class);
            $Silian_pdo = $this->createMock(\PDO::class);

            $Silian_auth->method('getCurrentUser')->willReturn(['id' => 7]);

            $Silian_stmtSelectUser = $this->createMock(\PDOStatement::class);
            $Silian_stmtSelectUser->method('execute')->willReturn(true);
            $Silian_stmtSelectUser->method('fetch')->willReturn([
                'id' => 7,
                'username' => 'alice',
                'avatar_id' => null,
                'school_id' => null
            ]);

            $Silian_pdo->method('prepare')->willReturn($Silian_stmtSelectUser);

            $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);
            $Silian_turnstile = $this->createMock(\CarbonTrack\Services\TurnstileService::class);
            $Silian_turnstile->method('isConfigured')->willReturn(true);
            $Silian_turnstile->expects($this->never())->method('verify');

            $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);
            $Silian_controller = new UserController($Silian_auth, $Silian_audit, $Silian_msg, $Silian_avatar, $Silian_prefs, $Silian_turnstile, null, $Silian_logger, $Silian_pdo, null, null, $Silian_region);

            $Silian_request = makeRequest('PUT', '/users/me/profile', ['school_id' => 9]);
            $Silian_response = new \Slim\Psr7\Response();
            $Silian_resp = $Silian_controller->updateProfile($Silian_request, $Silian_response);

            $this->assertSame(400, $Silian_resp->getStatusCode());
            $Silian_payload = json_decode((string)$Silian_resp->getBody(), true);
            $this->assertSame('TURNSTILE_REQUIRED', $Silian_payload['code']);
        } finally {
            if ($Silian_previousEnv === null) {
                unset($_ENV['APP_ENV']);
            } else {
                $_ENV['APP_ENV'] = $Silian_previousEnv;
            }
        }
    }

    public function testUpdateProfileCreatesNewSchoolWithTurnstileVerification(): void
    {
        $Silian_previousEnv = $_ENV['APP_ENV'] ?? null;
        $_ENV['APP_ENV'] = 'production';

        try {
            $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
            $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
            $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
            $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
            $Silian_logger = $this->createMock(\Monolog\Logger::class);

            $Silian_auth->method('getCurrentUser')->willReturn(['id' => 12]);
            $Silian_avatar->method('isAvatarAvailable')->willReturn(true);
            $Silian_audit->expects($this->once())->method('log');

            $Silian_stmtSelectUser = $this->createMock(\PDOStatement::class);
            $Silian_stmtSelectUser->method('execute')->willReturn(true);
            $Silian_stmtSelectUser->method('fetch')->willReturn([
                'id' => 12,
                'username' => 'bob',
                'avatar_id' => null,
                'school_id' => null
            ]);

            $Silian_stmtFindSchool = $this->createMock(\PDOStatement::class);
            $Silian_stmtFindSchool->method('execute')->willReturn(true);
            $Silian_stmtFindSchool->method('fetch')->willReturn(false);

            $Silian_stmtInsertSchool = $this->createMock(\PDOStatement::class);
            $Silian_stmtInsertSchool->method('execute')->willReturn(true);

            $Silian_stmtUpdate = $this->createMock(\PDOStatement::class);
            $Silian_stmtUpdate->method('execute')->willReturn(true);

            $Silian_stmtJoined = $this->createMock(\PDOStatement::class);
            $Silian_stmtJoined->method('execute')->willReturn(true);
            $Silian_stmtJoined->method('fetch')->willReturn([
                'id' => 12,
                'uuid' => 'user-12',
                'username' => 'bob',
                'email' => 'bob@example.com',
                'school_id' => 42,
                'school_name' => 'Climate Academy',
                'points' => 0,
                'is_admin' => 0,
                'avatar_id' => null,
                'avatar_path' => null,
                'lastlgn' => null,
                'updated_at' => '2025-01-02 00:00:00'
            ]);

            $Silian_pdo = $this->createMock(\PDO::class);
            $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls(
                $Silian_stmtSelectUser,
                $Silian_stmtFindSchool,
                $Silian_stmtInsertSchool,
                $Silian_stmtUpdate,
                $Silian_stmtJoined
            );
            $Silian_pdo->method('lastInsertId')->willReturn('42');

            $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);

            $Silian_turnstile = $this->createMock(\CarbonTrack\Services\TurnstileService::class);
            $Silian_turnstile->method('isConfigured')->willReturn(true);
            $Silian_turnstile->expects($this->once())
                ->method('verify')
                ->with('token-123', $this->anything())
                ->willReturn(['success' => true]);

            $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);
            $Silian_controller = new UserController($Silian_auth, $Silian_audit, $Silian_msg, $Silian_avatar, $Silian_prefs, $Silian_turnstile, null, $Silian_logger, $Silian_pdo, null, null, $Silian_region);

            $Silian_request = makeRequest('PUT', '/users/me/profile', [
                'new_school_name' => 'Climate Academy',
                'cf_turnstile_response' => 'token-123'
            ]);
            $Silian_response = new \Slim\Psr7\Response();

            $Silian_resp = $Silian_controller->updateProfile($Silian_request, $Silian_response);
            $this->assertSame(200, $Silian_resp->getStatusCode());

            $Silian_payload = json_decode((string)$Silian_resp->getBody(), true);
            $this->assertTrue($Silian_payload['success']);
            $this->assertSame(42, $Silian_payload['data']['school_id']);
            $this->assertSame('Climate Academy', $Silian_payload['data']['school_name']);
        } finally {
            if ($Silian_previousEnv === null) {
                unset($_ENV['APP_ENV']);
            } else {
                $_ENV['APP_ENV'] = $Silian_previousEnv;
            }
        }
    }

    public function testSelectAvatarInvalidReturns400(): void
    {
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_pdo = $this->createMock(\PDO::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1]);
        $Silian_avatar->method('isAvatarAvailable')->willReturn(false);

        $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);
        $Silian_turnstile = $this->mockTurnstile();
        $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);
        $Silian_controller = new UserController($Silian_auth, $Silian_audit, $Silian_msg, $Silian_avatar, $Silian_prefs, $Silian_turnstile, null, $Silian_logger, $Silian_pdo, $this->createMock(\CarbonTrack\Services\ErrorLogService::class), null, $Silian_region);

        $Silian_request = makeRequest('PUT', '/users/me/avatar', ['avatar_id' => 999]);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->selectAvatar($Silian_request, $Silian_response);
        $this->assertEquals(400, $Silian_resp->getStatusCode());
    }

    public function testGetPointsHistoryReturnsPaged(): void
    {
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1]);

        // list
        $Silian_stmtList = $this->createMock(\PDOStatement::class);
        $Silian_stmtList->method('execute')->willReturn(true);
        $Silian_stmtList->method('fetchAll')->willReturn([
            [
                'id' => 't1', 'uuid' => null, 'type' => 'earn', 'points' => 100,
                'description' => 'walk', 'status' => 'approved', 'activity_id' => 'a1',
                'activity_name' => '步行', 'created_at' => '2025-01-01'
            ]
        ]);
        // count
        $Silian_stmtCount = $this->createMock(\PDOStatement::class);
        $Silian_stmtCount->method('execute')->willReturn(true);
        $Silian_stmtCount->method('fetch')->willReturn(['total' => 1]);

        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_stmtList, $Silian_stmtCount);

        $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);
        $Silian_turnstile = $this->mockTurnstile();
        $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);
        $Silian_controller = new UserController($Silian_auth, $Silian_audit, $Silian_msg, $Silian_avatar, $Silian_prefs, $Silian_turnstile, null, $Silian_logger, $Silian_pdo, $this->createMock(\CarbonTrack\Services\ErrorLogService::class), null, $Silian_region);

        $Silian_request = makeRequest('GET', '/users/me/points-history');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getPointsHistory($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(1, $Silian_json['data']['pagination']['total']);
        $this->assertEquals(100, $Silian_json['data']['transactions'][0]['points']);
        $this->assertEquals('approved', $Silian_json['data']['transactions'][0]['status']);
    }

    public function testGetPointsHistoryUsesCanonicalPointsTransactionSchema(): void
    {
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 2]);

        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $Silian_pdo->exec("CREATE TABLE points_transactions (
            id TEXT PRIMARY KEY,
            uid INTEGER,
            points REAL,
            act TEXT,
            notes TEXT,
            type TEXT,
            status TEXT,
            activity_id TEXT,
            approved_at TEXT,
            created_at TEXT,
            deleted_at TEXT
        )");
        $Silian_pdo->exec("CREATE TABLE carbon_activities (
            id TEXT PRIMARY KEY,
            name_zh TEXT,
            deleted_at TEXT
        )");
        $Silian_pdo->exec("INSERT INTO carbon_activities (id, name_zh, deleted_at) VALUES ('act-1', '步行', NULL)");
        $Silian_pdo->exec("INSERT INTO points_transactions (id, uid, points, act, notes, type, status, activity_id, approved_at, created_at, deleted_at)
            VALUES ('pt-1', 2, 88, 'legacy-act', 'legacy-note', 'earn', 'approved', 'act-1', '2026-04-02 10:00:00', '2026-04-02 09:00:00', NULL)");

        $Silian_controller = new UserController(
            $Silian_auth,
            $this->createMock(\CarbonTrack\Services\AuditLogService::class),
            $this->createMock(\CarbonTrack\Services\MessageService::class),
            $this->createMock(\CarbonTrack\Models\Avatar::class),
            $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class),
            $this->mockTurnstile(),
            null,
            $this->createMock(\Monolog\Logger::class),
            $Silian_pdo,
            $this->createMock(\CarbonTrack\Services\ErrorLogService::class),
            null,
            $this->createMock(\CarbonTrack\Services\RegionService::class)
        );

        $Silian_request = makeRequest('GET', '/users/me/points-history');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getPointsHistory($Silian_request, $Silian_response);

        $this->assertSame(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertSame('pt-1', $Silian_json['data']['transactions'][0]['id']);
        $this->assertNull($Silian_json['data']['transactions'][0]['uuid']);
        $this->assertSame('legacy-note', $Silian_json['data']['transactions'][0]['description']);
        $this->assertSame('步行', $Silian_json['data']['transactions'][0]['activity_name']);
        $this->assertSame('legacy-note', $Silian_json['data']['transactions'][0]['admin_notes']);
    }

    public function testGetUserStatsReturnsAggregates(): void
    {
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1]);

        $Silian_stmtPoints = $this->createMock(\PDOStatement::class);
        $Silian_stmtPoints->method('execute')->willReturn(true);
        $Silian_stmtPoints->method('fetch')->willReturn([
            'total_earned' => 300,
            'total_spent' => 100,
            'earn_count' => 3,
            'spend_count' => 1,
            'pending_count' => 0
        ]);

        $Silian_stmtRecords = $this->createMock(\PDOStatement::class);
        $Silian_stmtRecords->method('execute')->willReturn(true);
        $Silian_stmtRecords->method('fetch')->willReturn([
            'total_activities' => 5,
            'approved_activities' => 4,
            'pending_activities' => 1,
            'rejected_activities' => 0,
            'total_carbon_saved' => 42.3,
            'total_points_earned' => 280
        ]);

        $Silian_stmtMonthly = $this->createMock(\PDOStatement::class);
        $Silian_stmtMonthly->method('execute')->willReturn(true);
        $Silian_stmtMonthly->method('fetchAll')->willReturn([
            ['month' => '2025-01', 'records_count' => 2, 'carbon_saved' => 12.5, 'points_earned' => 125]
        ]);

        $Silian_stmtRecent = $this->createMock(\PDOStatement::class);
        $Silian_stmtRecent->method('execute')->willReturn(true);
        $Silian_stmtRecent->method('fetchAll')->willReturn([]);

        $Silian_stmtUserInfo = $this->createMock(\PDOStatement::class);
        $Silian_stmtUserInfo->method('execute')->willReturn(true);
        $Silian_stmtUserInfo->expects($this->once())->method('fetch')->willReturn([
            'points' => 200,
            'created_at' => '2024-01-01',
            'region_code' => 'US-UM-81',
            'school_id' => 7,
            'school_name' => 'Canonical Academy',
        ]);

        $Silian_stmtRank = $this->createMock(\PDOStatement::class);
        $Silian_stmtRank->method('execute')->willReturn(true);
        $Silian_stmtRank->method('fetch')->willReturn(['rank' => 7]);

        $Silian_stmtTotalUsers = $this->createMock(\PDOStatement::class);
        $Silian_stmtTotalUsers->expects($this->once())->method('fetch')->willReturn(['total' => 200]);

        $Silian_stmtStoreStats = $this->createMock(\PDOStatement::class);
        $Silian_stmtStoreStats->expects($this->once())->method('execute')->with(['current_points' => 200])->willReturn(true);
        $Silian_stmtStoreStats->expects($this->once())->method('fetch')->willReturn([
            'available_products' => 2,
            'min_exchange_points' => 80,
        ]);

        $Silian_stmtLeaderboard = $this->createMock(\PDOStatement::class);
        $Silian_stmtLeaderboard->method('fetchAll')->willReturn([
            ['id' => 99, 'username' => 'alice', 'total_points' => 520, 'avatar_id' => null, 'avatar_path' => null],
        ]);

        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_pdo->method('getAttribute')->willReturn('mysql');
        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls(
            $Silian_stmtPoints,
            $Silian_stmtMonthly,
            $Silian_stmtRecent,
            $Silian_stmtUserInfo,
            $Silian_stmtStoreStats,
            $Silian_stmtRecords,
            $Silian_stmtRank
        );
        $Silian_pdo->method('query')->willReturnCallback(function ($Silian_sql) use ($Silian_stmtTotalUsers, $Silian_stmtLeaderboard) {
            if (stripos($Silian_sql, 'COUNT(*) AS total') !== false && stripos($Silian_sql, 'FROM users') !== false) {
                return $Silian_stmtTotalUsers;
            }
            if (stripos($Silian_sql, 'ORDER BY u.points DESC') !== false) {
                return $Silian_stmtLeaderboard;
            }
            return false;
        });

        $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);
        $Silian_turnstile = $this->mockTurnstile();
        $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);
        $Silian_region->method('getRegionContext')->willReturnCallback(static function (?string $Silian_value): ?array {
            if ($Silian_value !== 'US-UM-81') {
                return null;
            }

            return [
                'region_code' => 'US-UM-81',
                'region_label' => 'US-UM-81',
                'country_code' => 'US',
                'state_code' => 'UM-81',
                'country_name' => 'United States',
                'state_name' => null,
            ];
        });
        $Silian_leaderboardService = $this->createMock(\CarbonTrack\Services\LeaderboardService::class);
        $Silian_leaderboardService->method('getSnapshot')->willReturn([
            'generated_at' => '2025-01-01 00:00:00',
            'expires_at' => '2025-01-01 01:00:00',
            'global' => [
                ['id' => 99, 'username' => 'alice', 'total_points' => 520, 'avatar_id' => null, 'avatar_path' => null],
            ],
            'regions' => [
                'US-UM-81' => [
                    'entries' => [],
                ],
            ],
            'schools' => [
                7 => [
                    'entries' => [],
                ],
            ],
        ]);
        $Silian_controller = new UserController($Silian_auth, $Silian_audit, $Silian_msg, $Silian_avatar, $Silian_prefs, $Silian_turnstile, null, $Silian_logger, $Silian_pdo, $this->createMock(\CarbonTrack\Services\ErrorLogService::class), null, $Silian_region, $Silian_leaderboardService, null, null, new \CarbonTrack\Services\UserProfileViewService($Silian_region));
        $Silian_request = makeRequest('GET', '/users/me/stats');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getUserStats($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(200, $Silian_json['data']['current_points']);
        $this->assertEquals(42.3, $Silian_json['data']['total_carbon_saved']);
        $this->assertEquals(5, $Silian_json['data']['total_activities']);
        $this->assertEquals(300, $Silian_json['data']['total_earned']);
        $this->assertEquals(7, $Silian_json['data']['rank']);
        $this->assertEquals(200, $Silian_json['data']['total_users']);
        $this->assertEquals(2, $Silian_json['data']['available_products']);
        $this->assertEquals(80, $Silian_json['data']['min_exchange_points']);
        $this->assertEquals('2024-01-01', $Silian_json['data']['member_since']);
        $this->assertCount(1, $Silian_json['data']['leaderboard']);
        $this->assertSame('Canonical Academy', $Silian_json['data']['leaderboards']['school']['label']);
        $this->assertSame('US-UM-81', $Silian_json['data']['region_context']['region_code']);
    }


    public function testGetRecentActivitiesReturnsPresignedImages(): void
    {
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);
        $Silian_r2 = $this->createMock(\CarbonTrack\Services\CloudflareR2Service::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 7]);

        $Silian_statement = $this->getMockBuilder(\PDOStatement::class)
            ->onlyMethods(['bindValue', 'execute', 'fetchAll'])
            ->getMock();
        $Silian_statement->method('bindValue')->willReturn(true);
        $Silian_statement->expects($this->once())->method('execute')->willReturn(true);
        $Silian_statement->expects($this->once())->method('fetchAll')->willReturn([
            [
                'id' => 42,
                'activity_id' => 5,
                'activity_name_zh' => '节能',
                'activity_name_en' => 'Energy Saving',
                'category' => 'energy',
                'unit' => 'times',
                'data' => 3.0,
                'carbon_saved' => 1.23,
                'points_earned' => 15,
                'status' => 'approved',
                'created_at' => '2025-09-24 12:00:00',
                'images' => json_encode([[
                    'file_path' => 'proofs/a.jpg',
                    'original_name' => 'evidence.jpg',
                ]]),
            ],
        ]);

        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_pdo->method('prepare')->willReturn($Silian_statement);

        $Silian_r2->method('resolveKeyFromUrl')->willReturnCallback(static function ($Silian_value) {
            return trim((string)$Silian_value, '/');
        });
        $Silian_r2->method('generatePresignedUrl')->willReturn('https://cdn.example.com/proofs/a.jpg?token=abc');
        $Silian_r2->method('getPublicUrl')->willReturn('https://cdn.example.com/proofs/a.jpg');

        $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);
        $Silian_turnstile = $this->mockTurnstile();
        $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);
        $Silian_controller = new UserController($Silian_auth, $Silian_audit, $Silian_msg, $Silian_avatar, $Silian_prefs, $Silian_turnstile, null, $Silian_logger, $Silian_pdo, $Silian_errorLog, $Silian_r2, $Silian_region);

        $Silian_request = makeRequest('GET', '/users/me/activities');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_result = $Silian_controller->getRecentActivities($Silian_request, $Silian_response);

        $this->assertEquals(200, $Silian_result->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_result->getBody(), true);

        $this->assertTrue($Silian_payload['success']);
        $this->assertCount(1, $Silian_payload['data']);
        $Silian_activity = $Silian_payload['data'][0];
        $this->assertSame('approved', $Silian_activity['status']);
        $this->assertArrayHasKey('images', $Silian_activity);
        $this->assertCount(1, $Silian_activity['images']);
        $this->assertSame('proofs/a.jpg', $Silian_activity['images'][0]['file_path']);
        $this->assertNotEmpty($Silian_activity['images'][0]['presigned_url']);
    }

    public function testGetCurrentUserSuccess(): void
    {
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1]);

        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_stmt->method('fetch')->willReturn([
            'id' => 1,
            'uuid' => 'u-1',
            'username' => 'john',
            'email' => 'john@example.com',
            'school_id' => 5,
            'school_name' => 'Test School',
            'points' => 200,
            'is_admin' => 0,
            'avatar_id' => 10,
            'avatar_path' => '/a.png',
            'lastlgn' => null,
            'updated_at' => '2025-01-01 00:00:00'
        ]);

        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);

        $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);
        $Silian_turnstile = $this->mockTurnstile();
        $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);
        $Silian_controller = new UserController($Silian_auth, $Silian_audit, $Silian_msg, $Silian_avatar, $Silian_prefs, $Silian_turnstile, null, $Silian_logger, $Silian_pdo, null, null, $Silian_region);
        $Silian_request = makeRequest('GET', '/users/me');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getCurrentUser($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals('john', $Silian_json['data']['username']);
    }

    public function testGetCurrentUserUsesCanonicalSchoolAndRegionFields(): void
    {
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 3]);

        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_stmt->method('fetch')->willReturn([
            'id' => 3,
            'uuid' => 'u-3',
            'username' => 'canonical-user',
            'email' => 'canonical@example.com',
            'school_id' => 9,
            'school_name' => 'Canonical Academy',
            'region_code' => 'US-UM-81',
            'points' => 15,
            'is_admin' => 0,
            'avatar_id' => null,
            'avatar_path' => null,
            'lastlgn' => null,
            'updated_at' => '2025-01-01 00:00:00'
        ]);

        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);

        $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);
        $Silian_turnstile = $this->mockTurnstile();
        $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);
        $Silian_region->method('getRegionContext')->willReturnCallback(static function (?string $Silian_value): ?array {
            if ($Silian_value !== 'US-UM-81') {
                return null;
            }

            return [
                'region_code' => 'US-UM-81',
                'region_label' => 'United States · Baker Island',
                'country_code' => 'US',
                'state_code' => 'UM-81',
                'country_name' => 'United States',
                'state_name' => 'Baker Island',
            ];
        });

        $Silian_controller = new UserController($Silian_auth, $Silian_audit, $Silian_msg, $Silian_avatar, $Silian_prefs, $Silian_turnstile, null, $Silian_logger, $Silian_pdo, null, null, $Silian_region);
        $Silian_request = makeRequest('GET', '/users/me');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getCurrentUser($Silian_request, $Silian_response);

        $this->assertSame(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertSame('Canonical Academy', $Silian_json['data']['school_name']);
        $this->assertSame('US-UM-81', $Silian_json['data']['region_code']);
        $this->assertSame('US', $Silian_json['data']['country_code']);
        $this->assertSame('UM-81', $Silian_json['data']['state_code']);
    }

    public function testUpdateProfilePersistsCanonicalSchoolAndRegionFields(): void
    {
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1]);
        $Silian_avatar->method('isAvatarAvailable')->willReturn(true);
        $Silian_audit->expects($this->once())
            ->method('log')
            ->with($this->callback(function (array $Silian_payload): bool {
                $this->assertNull($Silian_payload['old_data']['school_id']);
                $this->assertSame('US-UM-80', $Silian_payload['old_data']['region_code']);
                $this->assertSame(9, $Silian_payload['new_data']['school_id']);
                $this->assertSame('US-UM-81', $Silian_payload['new_data']['region_code']);
                $this->assertArrayNotHasKey('school', $Silian_payload['new_data']);
                $this->assertArrayNotHasKey('location', $Silian_payload['new_data']);
                return true;
            }));

        $Silian_stmtSelectUser = $this->createMock(\PDOStatement::class);
        $Silian_stmtSelectUser->method('execute')->willReturn(true);
        $Silian_stmtSelectUser->method('fetch')->willReturn([
            'id' => 1,
            'username' => 'john',
            'avatar_id' => null,
            'school_id' => null,
            'region_code' => 'US-UM-80',
        ]);

        $Silian_stmtSelectSchool = $this->createMock(\PDOStatement::class);
        $Silian_stmtSelectSchool->method('execute')->willReturn(true);
        $Silian_stmtSelectSchool->method('fetch')->willReturn([
            'id' => 9,
            'name' => 'Canonical Academy',
        ]);

        $Silian_stmtUpdate = $this->createMock(\PDOStatement::class);
        $Silian_stmtUpdate->expects($this->once())
            ->method('execute')
            ->with($this->callback(function (array $Silian_params): bool {
                return in_array(9, $Silian_params, true)
                    && in_array('US-UM-81', $Silian_params, true)
                    && !in_array('Canonical Academy', $Silian_params, true)
                    && $Silian_params[count($Silian_params) - 1] === 1;
            }))
            ->willReturn(true);

        $Silian_stmtJoined = $this->createMock(\PDOStatement::class);
        $Silian_stmtJoined->method('execute')->willReturn(true);
        $Silian_stmtJoined->method('fetch')->willReturn([
            'id' => 1,
            'uuid' => 'u-1',
            'username' => 'john',
            'email' => 'john@example.com',
            'school_id' => 9,
            'school_name' => 'Canonical Academy',
            'region_code' => 'US-UM-81',
            'points' => 0,
            'is_admin' => 0,
            'avatar_id' => null,
            'avatar_path' => null,
            'lastlgn' => null,
            'updated_at' => '2025-01-01 00:00:00'
        ]);

        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls(
            $Silian_stmtSelectUser,
            $Silian_stmtSelectSchool,
            $Silian_stmtUpdate,
            $Silian_stmtJoined
        );

        $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);
        $Silian_turnstile = $this->mockTurnstile();
        $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);
        $Silian_region->method('normalizeCountryCode')->willReturn('US');
        $Silian_region->method('normalizeStateCode')->willReturn('UM-81');
        $Silian_region->method('isValidRegion')->with('US', 'UM-81')->willReturn(true);
        $Silian_region->method('buildRegionCode')->with('US', 'UM-81')->willReturn('US-UM-81');
        $Silian_region->method('getRegionContext')->willReturnCallback(static function (?string $Silian_value): ?array {
            $Silian_map = [
                'US-UM-80' => [
                    'region_code' => 'US-UM-80',
                    'region_label' => 'United States · Howland Island',
                    'country_code' => 'US',
                    'state_code' => 'UM-80',
                    'country_name' => 'United States',
                    'state_name' => 'Howland Island',
                ],
                'US-UM-81' => [
                    'region_code' => 'US-UM-81',
                    'region_label' => 'United States · Baker Island',
                    'country_code' => 'US',
                    'state_code' => 'UM-81',
                    'country_name' => 'United States',
                    'state_name' => 'Baker Island',
                ],
            ];

            return $Silian_map[$Silian_value] ?? null;
        });

        $Silian_controller = new UserController($Silian_auth, $Silian_audit, $Silian_msg, $Silian_avatar, $Silian_prefs, $Silian_turnstile, null, $Silian_logger, $Silian_pdo, $this->createMock(\CarbonTrack\Services\ErrorLogService::class), null, $Silian_region);
        $Silian_request = makeRequest('PUT', '/users/me/profile', [
            'school_id' => 9,
            'country_code' => 'US',
            'state_code' => 'UM-81',
        ]);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->updateProfile($Silian_request, $Silian_response);
        $this->assertSame(200, $Silian_resp->getStatusCode());

        $Silian_payload = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame('Canonical Academy', $Silian_payload['data']['school_name']);
        $this->assertSame('US-UM-81', $Silian_payload['data']['region_code']);
        $this->assertSame('UM-81', $Silian_payload['data']['state_code']);
    }

    public function testUpdateCurrentUserDelegatesToUpdateProfile(): void
    {
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1]);
        $Silian_avatar->method('isAvatarAvailable')->willReturn(true);
        $Silian_avatar->method('getAvatarById')->willReturn([
            'id' => 10,
            'name' => 'Test Avatar',
            'file_path' => '/avatars/default/avatar_01.png'
        ]);
        $Silian_audit->expects($this->once())->method('log');

        // 1) SELECT current user / 2) UPDATE users / 3) SELECT joined user
        $Silian_stmtSelectUser = $this->createMock(\PDOStatement::class);
        $Silian_stmtSelectUser->method('execute')->willReturn(true);
        $Silian_stmtSelectUser->method('fetch')->willReturn([
            'id' => 1,
            'username' => 'john',
            'avatar_id' => null,
            'school_id' => null
        ]);

        $Silian_stmtUpdate = $this->createMock(\PDOStatement::class);
        $Silian_stmtUpdate->method('execute')->willReturn(true);

        $Silian_stmtJoined = $this->createMock(\PDOStatement::class);
        $Silian_stmtJoined->method('execute')->willReturn(true);
        $Silian_stmtJoined->method('fetch')->willReturn([
            'id' => 1,
            'uuid' => 'u-1',
            'username' => 'john',
            'email' => 'john@example.com',
            'school_id' => null,
            'school_name' => null,
            'points' => 0,
            'is_admin' => 0,
            'avatar_id' => 10,
            'avatar_path' => '/avatars/default/avatar_01.png',
            'lastlgn' => null,
            'updated_at' => '2025-01-01 00:00:00'
        ]);

        $Silian_pdo = $this->createMock(\PDO::class);
        // prepare 顺序: select user -> update -> select joined
        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls(
            $Silian_stmtSelectUser,
            $Silian_stmtUpdate,
            $Silian_stmtJoined
        );

        $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);
        $Silian_turnstile = $this->mockTurnstile();
        $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);
        $Silian_controller = new UserController($Silian_auth, $Silian_audit, $Silian_msg, $Silian_avatar, $Silian_prefs, $Silian_turnstile, null, $Silian_logger, $Silian_pdo, null, null, $Silian_region);
    $Silian_request = makeRequest('PUT', '/users/me', ['avatar_id' => 10]);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->updateCurrentUser($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(10, $Silian_json['data']['avatar_id']);
    }

    public function testSendNotificationTestEmailActivityUsesLatestRecord(): void
    {
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn([
            'id' => 5,
            'email' => 'user@example.com',
            'username' => 'EcoHero',
        ]);

        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('logAuthOperation')
            ->with(
                'notification_test_email',
                5,
                true,
                $this->callback(function (array $Silian_context): bool {
                    $this->assertSame('activity', $Silian_context['category']);
                    $this->assertArrayHasKey('sample', $Silian_context);
                    $this->assertFalse($Silian_context['sample']['generated']);
                    $this->assertTrue($Silian_context['delivered']);
                    $this->assertFalse($Silian_context['queued']);
                    return true;
                })
            );

        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);

        $Silian_emailService = $this->createMock(\CarbonTrack\Services\EmailService::class);
        $Silian_emailService->expects($this->once())
            ->method('sendActivityApprovedNotification')
            ->with(
                'user@example.com',
                'EcoHero',
                'Metro ride to office',
                42.5
            )
            ->willReturn(true);

        $Silian_emailService->expects($this->once())
            ->method('dispatchAsyncEmail')
            ->with(
                $this->callback(static fn($Silian_callback): bool => is_callable($Silian_callback)),
                $this->callback(function (array $Silian_context): bool {
                    $this->assertSame('activity', $Silian_context['category']);
                    $this->assertArrayHasKey('sample', $Silian_context);
                    $this->assertFalse($Silian_context['sample']['generated']);
                    return true;
                }),
                false
            )
            ->willReturnCallback(function (callable $Silian_callback, array $Silian_context, bool $Silian_preferAsync): bool {
                $this->assertFalse($Silian_preferAsync);
                return (bool) $Silian_callback(false);
            });

        $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);
        $Silian_prefs->method('allCategories')->willReturn([
            'activity' => ['label' => 'Activity reviews', 'locked' => false],
        ]);

        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->expects($this->once())->method('execute')->with(['uid' => 5])->willReturn(true);
        $Silian_stmt->method('fetch')->willReturn([
            'points_earned' => 42.5,
            'created_at' => '2025-01-10 10:00:00',
            'name_en' => 'Metro ride to office',
            'name_zh' => '',
            'unit' => 'km',
        ]);

        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);

        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);
        $Silian_turnstile = $this->mockTurnstile();
        $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);

        $Silian_controller = new UserController(
            $Silian_auth,
            $Silian_audit,
            $Silian_messageService,
            $Silian_avatar,
            $Silian_prefs,
            $Silian_turnstile,
            $Silian_emailService,
            $Silian_logger,
            $Silian_pdo,
            $Silian_errorLog,
            null,
            $Silian_region
        );

        $Silian_request = makeRequest('POST', '/users/me/notification-preferences/test-email', ['category' => 'activity']);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->sendNotificationTestEmail($Silian_request, $Silian_response);
        $this->assertSame(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertTrue($Silian_json['data']['delivered']);
        $this->assertFalse($Silian_json['data']['generated']);
        $this->assertSame('activity', $Silian_json['data']['category']);
        $this->assertSame('activity', $Silian_json['data']['preview']['category']);
        $this->assertArrayHasKey('sample', $Silian_json['data']['preview']);
    }

    public function testSendNotificationTestEmailUsesCanonicalPointExchangeUserId(): void
    {
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn([
            'id' => 11,
            'email' => 'redeemer@example.com',
            'username' => 'Redeemer',
        ]);

        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('logAuthOperation')
            ->with(
                'notification_test_email',
                11,
                true,
                $this->callback(function (array $Silian_context): bool {
                    $this->assertSame('transaction', $Silian_context['category']);
                    $this->assertArrayHasKey('sample', $Silian_context);
                    $this->assertFalse($Silian_context['sample']['generated']);
                    $this->assertSame('Eco Bottle', $Silian_context['sample']['product']);
                    return true;
                })
            );

        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);

        $Silian_emailService = $this->createMock(\CarbonTrack\Services\EmailService::class);
        $Silian_emailService->expects($this->once())
            ->method('sendExchangeConfirmation')
            ->with('redeemer@example.com', 'Redeemer', 'Eco Bottle', 2, 180.0)
            ->willReturn(true);
        $Silian_emailService->expects($this->once())
            ->method('dispatchAsyncEmail')
            ->with(
                $this->callback(static fn($Silian_callback): bool => is_callable($Silian_callback)),
                $this->callback(function (array $Silian_context): bool {
                    $this->assertSame('transaction', $Silian_context['category']);
                    $this->assertFalse($Silian_context['sample']['generated']);
                    return true;
                }),
                false
            )
            ->willReturnCallback(function (callable $Silian_callback, array $Silian_context, bool $Silian_preferAsync): bool {
                $this->assertFalse($Silian_preferAsync);
                return (bool) $Silian_callback(false);
            });

        $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);
        $Silian_prefs->method('allCategories')->willReturn([
            'transaction' => ['label' => 'Reward exchanges', 'locked' => false],
        ]);

        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $Silian_pdo->exec("CREATE TABLE point_exchanges (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL,
            points_used INTEGER NOT NULL,
            product_name TEXT NOT NULL,
            deleted_at TEXT,
            created_at TEXT
        )");
        $Silian_pdo->exec("CREATE TABLE products (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL
        )");
        $Silian_pdo->exec("INSERT INTO products (id, name) VALUES (8, 'Eco Bottle')");
        $Silian_pdo->exec("INSERT INTO point_exchanges (id, user_id, product_id, quantity, points_used, product_name, deleted_at, created_at)
            VALUES ('ex-1', 11, 8, 2, 180, 'Eco Bottle', NULL, '2026-04-02 09:00:00')");

        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);
        $Silian_turnstile = $this->mockTurnstile();
        $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);

        $Silian_controller = new UserController(
            $Silian_auth,
            $Silian_audit,
            $Silian_messageService,
            $Silian_avatar,
            $Silian_prefs,
            $Silian_turnstile,
            $Silian_emailService,
            $Silian_logger,
            $Silian_pdo,
            $Silian_errorLog,
            null,
            $Silian_region
        );

        $Silian_request = makeRequest('POST', '/users/me/notification-preferences/test-email', ['category' => 'transaction']);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->sendNotificationTestEmail($Silian_request, $Silian_response);
        $this->assertSame(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertTrue($Silian_json['data']['delivered']);
        $this->assertFalse($Silian_json['data']['generated']);
        $this->assertSame('Eco Bottle', $Silian_json['data']['preview']['sample']['product']);
    }

    public function testSendNotificationTestEmailMarksGeneratedSampleWhenMissingData(): void
    {
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn([
            'id' => 8,
            'email' => 'preview@example.com',
            'username' => 'PreviewUser',
        ]);

        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('logAuthOperation')
            ->with(
                'notification_test_email',
                8,
                true,
                $this->callback(function (array $Silian_context): bool {
                    $this->assertTrue($Silian_context['generated']);
                    $this->assertArrayHasKey('sample', $Silian_context);
                    $this->assertTrue($Silian_context['sample']['generated']);
                    return true;
                })
            );

        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);

        $Silian_emailService = $this->createMock(\CarbonTrack\Services\EmailService::class);
        $Silian_emailService->expects($this->once())
            ->method('sendActivityApprovedNotification')
            ->with(
                'preview@example.com',
                'PreviewUser',
                $this->stringContains('Test sample'),
                12.5
            )
            ->willReturn(true);

        $Silian_emailService->expects($this->once())
            ->method('dispatchAsyncEmail')
            ->with(
                $this->callback(static fn($Silian_callback): bool => is_callable($Silian_callback)),
                $this->isType('array'),
                false
            )
            ->willReturnCallback(function (callable $Silian_callback, array $Silian_context, bool $Silian_preferAsync): bool {
                $this->assertFalse($Silian_preferAsync);
                return (bool) $Silian_callback(false);
            });

        $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);
        $Silian_prefs->method('allCategories')->willReturn([
            'activity' => ['label' => 'Activity reviews', 'locked' => false],
        ]);

        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->expects($this->once())->method('execute')->with(['uid' => 8])->willReturn(true);
        $Silian_stmt->method('fetch')->willReturn(false);

        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);

        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);
        $Silian_turnstile = $this->mockTurnstile();
        $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);

        $Silian_controller = new UserController(
            $Silian_auth,
            $Silian_audit,
            $Silian_messageService,
            $Silian_avatar,
            $Silian_prefs,
            $Silian_turnstile,
            $Silian_emailService,
            $Silian_logger,
            $Silian_pdo,
            $Silian_errorLog,
            null,
            $Silian_region
        );

        $Silian_request = makeRequest('POST', '/users/me/notification-preferences/test-email', ['category' => 'activity']);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->sendNotificationTestEmail($Silian_request, $Silian_response);
        $this->assertSame(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertTrue($Silian_json['data']['delivered']);
        $this->assertTrue($Silian_json['data']['generated']);
        $this->assertSame('activity', $Silian_json['data']['category']);
        $this->assertStringContainsString('generated preview', $Silian_json['message']);
        $this->assertTrue($Silian_json['data']['preview']['sample']['generated']);
    }

    public function testSendNotificationTestEmailRejectsInvalidCategory(): void
    {
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn([
            'id' => 3,
            'email' => 'user@example.com',
        ]);

        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_audit->expects($this->never())->method('logAuthOperation');

        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);

        $Silian_emailService = $this->createMock(\CarbonTrack\Services\EmailService::class);
        $Silian_emailService->expects($this->never())->method('dispatchAsyncEmail');

        $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);
        $Silian_prefs->method('allCategories')->willReturn([
            'system' => ['label' => 'System updates', 'locked' => false],
        ]);

        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);
        $Silian_turnstile = $this->mockTurnstile();
        $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);

        $Silian_controller = new UserController(
            $Silian_auth,
            $Silian_audit,
            $Silian_messageService,
            $Silian_avatar,
            $Silian_prefs,
            $Silian_turnstile,
            $Silian_emailService,
            $Silian_logger,
            $Silian_pdo,
            $Silian_errorLog,
            null,
            $Silian_region
        );

        $Silian_request = makeRequest('POST', '/users/me/notification-preferences/test-email', ['category' => 'unknown']);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->sendNotificationTestEmail($Silian_request, $Silian_response);
        $this->assertSame(422, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertFalse($Silian_json['success']);
        $this->assertSame('INVALID_CATEGORY', $Silian_json['code']);
    }

    public function testResolveAvatarPrefersPublicUrl(): void
    {
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);
        $Silian_turnstile = $this->mockTurnstile();
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);
        $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);
        $Silian_r2 = $this->createMock(\CarbonTrack\Services\CloudflareR2Service::class);

        $Silian_r2->expects($this->once())
            ->method('getPublicUrl')
            ->with('avatars/default/avatar_01.png')
            ->willReturn('https://r2-dev.carbontrackapp.com/avatars/default/avatar_01.png');
        $Silian_r2->expects($this->never())->method('generatePresignedUrl');

        $Silian_controller = new UserController(
            $Silian_auth,
            $Silian_audit,
            $Silian_messageService,
            $Silian_avatar,
            $Silian_prefs,
            $Silian_turnstile,
            null,
            $Silian_logger,
            $Silian_pdo,
            $Silian_errorLog,
            $Silian_r2,
            $Silian_region
        );

        $Silian_method = new \ReflectionMethod(UserController::class, 'resolveAvatar');
        $Silian_method->setAccessible(true);
        $Silian_result = $Silian_method->invoke($Silian_controller, '/avatars/default/avatar_01.png');

        $this->assertSame('/avatars/default/avatar_01.png', $Silian_result['avatar_path']);
        $this->assertSame('https://r2-dev.carbontrackapp.com/avatars/default/avatar_01.png', $Silian_result['avatar_url']);
    }

    public function testGetSecurityActivityRequiresAuthentication(): void
    {
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(null);

        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);
        $Silian_turnstile = $this->mockTurnstile();
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);
        $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);

        $Silian_controller = new UserController(
            $Silian_auth,
            $Silian_audit,
            $Silian_messageService,
            $Silian_avatar,
            $Silian_prefs,
            $Silian_turnstile,
            null,
            $Silian_logger,
            $Silian_pdo,
            $Silian_errorLog,
            null,
            $Silian_region
        );

        $Silian_response = $Silian_controller->getSecurityActivity(
            makeRequest('GET', '/users/me/security-activity'),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(401, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('UNAUTHORIZED', $Silian_payload['code']);
    }

    public function testGetSecurityActivityReturnsOnlyOwnWhitelistedEvents(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $Silian_pdo->setAttribute(\PDO::ATTR_DEFAULT_FETCH_MODE, \PDO::FETCH_ASSOC);
        TestSchemaBuilder::init($Silian_pdo);

        $Silian_insert = $Silian_pdo->prepare(
            'INSERT INTO audit_logs (user_id, user_uuid, actor_type, action, status, data, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $Silian_insert->execute([1, null, 'user', 'login', 'success', json_encode(['ip_address' => '1.1.1.1']), gmdate('Y-m-d H:i:s', strtotime('-1 hour'))]);
        $Silian_insert->execute([null, '550e8400-e29b-41d4-a716-4466554400aa', 'user', 'passkey_label_updated', 'success', json_encode(['old_label' => 'Old', 'new_label' => 'New', 'passkey_id' => 3]), gmdate('Y-m-d H:i:s', strtotime('-30 minutes'))]);
        $Silian_insert->execute([1, null, 'user', 'passkey_list_viewed', 'success', json_encode(['count' => 2]), gmdate('Y-m-d H:i:s', strtotime('-20 minutes'))]);
        $Silian_insert->execute([2, null, 'user', 'logout', 'success', json_encode([]), gmdate('Y-m-d H:i:s', strtotime('-10 minutes'))]);

        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'uuid' => '550e8400-e29b-41d4-a716-4466554400aa']);

        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('log')
            ->with($this->callback(function (array $Silian_payload): bool {
                $this->assertSame('user_security_activity_viewed', $Silian_payload['action']);
                $this->assertSame(1, $Silian_payload['user_id']);
                return true;
            }))
            ->willReturn(true);

        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);
        $Silian_turnstile = $this->mockTurnstile();
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);
        $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);

        $Silian_controller = new UserController(
            $Silian_auth,
            $Silian_audit,
            $Silian_messageService,
            $Silian_avatar,
            $Silian_prefs,
            $Silian_turnstile,
            null,
            $Silian_logger,
            $Silian_pdo,
            $Silian_errorLog,
            null,
            $Silian_region
        );

        $Silian_response = $Silian_controller->getSecurityActivity(
            makeRequest('GET', '/users/me/security-activity', null, ['page' => 1, 'limit' => 10]),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame(2, $Silian_payload['data']['pagination']['total_items']);
        $this->assertCount(2, $Silian_payload['data']['items']);
        $this->assertSame('all', $Silian_payload['data']['filters']['type']);
        $this->assertSame('all', $Silian_payload['data']['filters']['period']);
        $this->assertSame('passkey_label_updated', $Silian_payload['data']['items'][0]['action']);
        $this->assertSame('New', $Silian_payload['data']['items'][0]['metadata']['new_label']);
        $this->assertSame('login', $Silian_payload['data']['items'][1]['action']);
        $this->assertSame('1.1.1.1', $Silian_payload['data']['items'][1]['ip_address']);
    }

    public function testGetSecurityActivityAppliesTypeAndPeriodFilters(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $Silian_pdo->setAttribute(\PDO::ATTR_DEFAULT_FETCH_MODE, \PDO::FETCH_ASSOC);
        TestSchemaBuilder::init($Silian_pdo);

        $Silian_insert = $Silian_pdo->prepare(
            'INSERT INTO audit_logs (user_id, user_uuid, actor_type, action, status, data, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?)'
        );
        $Silian_insert->execute([1, null, 'user', 'login', 'success', json_encode(['ip_address' => '1.1.1.1']), gmdate('Y-m-d H:i:s', strtotime('-45 days'))]);
        $Silian_insert->execute([null, '550e8400-e29b-41d4-a716-4466554400aa', 'user', 'passkey_login', 'success', json_encode(['label' => 'Phone']), gmdate('Y-m-d H:i:s', strtotime('-3 days'))]);
        $Silian_insert->execute([1, null, 'user', 'password_change', 'success', json_encode([]), gmdate('Y-m-d H:i:s', strtotime('-2 days'))]);

        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'uuid' => '550e8400-e29b-41d4-a716-4466554400aa']);

        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('log')
            ->with($this->callback(function (array $Silian_payload): bool {
                $this->assertSame('sign_ins', $Silian_payload['data']['type']);
                $this->assertSame('30d', $Silian_payload['data']['period']);
                $this->assertSame(1, $Silian_payload['data']['count']);
                return true;
            }))
            ->willReturn(true);

        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);
        $Silian_turnstile = $this->mockTurnstile();
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);
        $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);

        $Silian_controller = new UserController(
            $Silian_auth,
            $Silian_audit,
            $Silian_messageService,
            $Silian_avatar,
            $Silian_prefs,
            $Silian_turnstile,
            null,
            $Silian_logger,
            $Silian_pdo,
            $Silian_errorLog,
            null,
            $Silian_region
        );

        $Silian_response = $Silian_controller->getSecurityActivity(
            makeRequest('GET', '/users/me/security-activity', null, ['page' => 1, 'limit' => 10, 'type' => 'sign_ins', 'period' => '30d']),
            new \Slim\Psr7\Response()
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame('sign_ins', $Silian_payload['data']['filters']['type']);
        $this->assertSame('30d', $Silian_payload['data']['filters']['period']);
        $this->assertSame(1, $Silian_payload['data']['pagination']['total_items']);
        $this->assertCount(1, $Silian_payload['data']['items']);
        $this->assertSame('passkey_login', $Silian_payload['data']['items'][0]['action']);
    }

    public function testBuildSecurityActivityPeriodClauseUsesDatabaseClockForSqlite(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $Silian_pdo->setAttribute(\PDO::ATTR_DEFAULT_FETCH_MODE, \PDO::FETCH_ASSOC);
        TestSchemaBuilder::init($Silian_pdo);

        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_avatar = $this->createMock(\CarbonTrack\Models\Avatar::class);
        $Silian_prefs = $this->createMock(\CarbonTrack\Services\NotificationPreferenceService::class);
        $Silian_turnstile = $this->mockTurnstile();
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);
        $Silian_region = $this->createMock(\CarbonTrack\Services\RegionService::class);

        $Silian_controller = new UserController(
            $Silian_auth,
            $Silian_audit,
            $Silian_messageService,
            $Silian_avatar,
            $Silian_prefs,
            $Silian_turnstile,
            null,
            $Silian_logger,
            $Silian_pdo,
            $Silian_errorLog,
            null,
            $Silian_region
        );

        $Silian_method = new \ReflectionMethod($Silian_controller, 'buildSecurityActivityPeriodClause');
        $Silian_method->setAccessible(true);

        $this->assertSame(
            "created_at >= datetime('now', '-30 days')",
            $Silian_method->invoke($Silian_controller, 30)
        );
    }

    private function mockTurnstile(bool $Silian_configured = false)
    {
        $Silian_mock = $this->createMock(\CarbonTrack\Services\TurnstileService::class);
        $Silian_mock->method('isConfigured')->willReturn($Silian_configured);
        $Silian_mock->method('verify')->willReturn(['success' => true]);
        return $Silian_mock;
    }
}


