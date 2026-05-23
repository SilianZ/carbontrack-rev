<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use CarbonTrack\Tests\Integration\TestSchemaBuilder;
use PHPUnit\Framework\TestCase;
use CarbonTrack\Controllers\AdminController;
use CarbonTrack\Services\BadgeService;
use CarbonTrack\Services\CheckinService;
use CarbonTrack\Services\RegionService;
use CarbonTrack\Services\StatisticsService;
use CarbonTrack\Services\QuotaConfigService;
use CarbonTrack\Services\UserProfileViewService;

class AdminControllerTest extends TestCase
{
    private function makeUserProfileViewService(): UserProfileViewService
    {
        return new UserProfileViewService(new RegionService(null, null, null, null));
    }

    private function makeController(
        \PDO $Silian_pdo,
        \CarbonTrack\Services\AuthService $Silian_auth,
        \CarbonTrack\Services\AuditLogService $Silian_audit,
        BadgeService $Silian_badgeService,
        StatisticsService $Silian_statsService,
        CheckinService $Silian_checkinService,
        QuotaConfigService $Silian_quotaConfigService
    ): AdminController {
        return new AdminController(
            $Silian_pdo,
            $Silian_auth,
            $Silian_audit,
            $Silian_badgeService,
            $Silian_statsService,
            $Silian_checkinService,
            $Silian_quotaConfigService,
            $this->makeUserProfileViewService(),
            null,
            null
        );
    }

    public function testControllerClassExists(): void
    {
        $this->assertTrue(class_exists(AdminController::class));
    }

    public function testGetUsersRequiresAdmin(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_badgeService = $this->createMock(BadgeService::class);
        $Silian_statsService = $this->createMock(StatisticsService::class);
        $Silian_checkinService = $this->createMock(CheckinService::class);
        $Silian_quotaConfigService = new QuotaConfigService();

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => 0]);
        $Silian_auth->method('isAdminUser')->willReturn(false);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_auth, $Silian_audit, $Silian_badgeService, $Silian_statsService, $Silian_checkinService, $Silian_quotaConfigService);
        $Silian_prop = (new \ReflectionClass($Silian_controller))->getProperty('lastLoginColumn');
        $Silian_prop->setAccessible(true);
        $Silian_prop->setValue($Silian_controller, 'lastlgn');
        $Silian_request = makeRequest('GET', '/admin/users');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getUsers($Silian_request, $Silian_response);
        $this->assertEquals(403, $Silian_resp->getStatusCode());
    }

    public function testGetUsersSuccessWithFilters(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_badgeService = $this->createMock(BadgeService::class);
        $Silian_statsService = $this->createMock(StatisticsService::class);
        $Silian_checkinService = $this->createMock(CheckinService::class);
        $Silian_quotaConfigService = new QuotaConfigService();

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 9, 'is_admin' => 1]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_capturedParams = [];

        $Silian_listStmt = $this->createMock(\PDOStatement::class);
        $Silian_listStmt->expects($this->atLeastOnce())
            ->method('bindValue')
            ->willReturnCallback(function ($Silian_param, $Silian_value) use (&$Silian_capturedParams) {
                $Silian_capturedParams[$Silian_param] = $Silian_value;
                return true;
            });
        $Silian_listStmt->method('execute')->willReturn(true);
        $Silian_listStmt->method('fetchAll')->willReturn([
            [
                'id'=>1,
                'username'=>'u1',
                'email'=>'u1@x.com',
                'points'=>100,
                'school_id'=>9,
                'school_name'=>'Canonical Academy',
                'passkey_count' => 2,
                'last_passkey_used_at' => '2026-03-10 09:00:00',
            ]
        ]);

        $Silian_countStmt = $this->createMock(\PDOStatement::class);
        $Silian_countStmt->method('bindValue')->willReturn(true);
        $Silian_countStmt->method('execute')->willReturn(true);
        $Silian_countStmt->method('fetchColumn')->willReturn(1);

        $Silian_pdo->expects($this->exactly(2))
            ->method('prepare')
            ->withConsecutive(
                [
                    $this->callback(function ($Silian_sql) {
                        $this->assertStringContainsString('LOWER(COALESCE(u.role, \'user\')) = :role_user', $Silian_sql);
                        $this->assertStringContainsString('(u.username LIKE :search_username OR u.email LIKE :search_email OR u.uuid LIKE :search_uuid)', $Silian_sql);
                        return true;
                    })
                ],
                [
                    $this->stringContains('COUNT(DISTINCT u.id)')
                ]
            )
            ->willReturnOnConsecutiveCalls($Silian_listStmt, $Silian_countStmt);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_auth, $Silian_audit, $Silian_badgeService, $Silian_statsService, $Silian_checkinService, $Silian_quotaConfigService);
        $Silian_prop = (new \ReflectionClass($Silian_controller))->getProperty('lastLoginColumn');
        $Silian_prop->setAccessible(true);
        $Silian_prop->setValue($Silian_controller, 'lastlgn');
        $Silian_request = makeRequest('GET', '/admin/users', null, ['search' => 'u', 'status' => 'active', 'role' => 'user', 'sort' => 'points_desc']);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getUsers($Silian_request, $Silian_response);

        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(1, $Silian_json['data']['pagination']['total_items']);
        $this->assertEquals('u1', $Silian_json['data']['users'][0]['username']);
        $this->assertSame('Canonical Academy', $Silian_json['data']['users'][0]['school_name']);
        $this->assertSame(2, $Silian_json['data']['users'][0]['passkey_count']);
        $this->assertEquals('%u%', $Silian_capturedParams[':search_username'] ?? null);
        $this->assertEquals('%u%', $Silian_capturedParams[':search_email'] ?? null);
        $this->assertEquals('%u%', $Silian_capturedParams[':search_uuid'] ?? null);
        $this->assertEquals('active', $Silian_capturedParams[':status'] ?? null);
        $this->assertSame('user', $Silian_capturedParams[':role_user'] ?? null);
    }

    public function testLoadUserRowUsesCanonicalSchoolName(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_badgeService = $this->createMock(BadgeService::class);
        $Silian_statsService = $this->createMock(StatisticsService::class);
        $Silian_checkinService = $this->createMock(CheckinService::class);
        $Silian_quotaConfigService = new QuotaConfigService();

        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_stmt->method('fetch')->willReturn([
            'id' => 2,
            'username' => 'legacy',
            'email' => 'legacy@example.com',
            'status' => 'active',
            'is_admin' => 0,
            'points' => 12,
            'created_at' => '2025-01-01 00:00:00',
            'updated_at' => '2025-01-02 00:00:00',
            'school_id' => 7,
            'school_name' => 'Canonical Academy',
            'lastlgn' => null,
        ]);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_auth, $Silian_audit, $Silian_badgeService, $Silian_statsService, $Silian_checkinService, $Silian_quotaConfigService);
        $Silian_prop = (new \ReflectionClass($Silian_controller))->getProperty('lastLoginColumn');
        $Silian_prop->setAccessible(true);
        $Silian_prop->setValue($Silian_controller, 'lastlgn');

        $Silian_method = new \ReflectionMethod($Silian_controller, 'loadUserRow');
        $Silian_method->setAccessible(true);
        $Silian_row = $Silian_method->invoke($Silian_controller, 2);

        $this->assertSame('Canonical Academy', $Silian_row['school_name']);
        $this->assertSame(7, $Silian_row['school_id']);
    }

    public function testSanitizeSupportRoutingOverrideRejectsFractionalIntegerFields(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_badgeService = $this->createMock(BadgeService::class);
        $Silian_statsService = $this->createMock(StatisticsService::class);
        $Silian_checkinService = $this->createMock(CheckinService::class);
        $Silian_quotaConfigService = new QuotaConfigService();

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_auth, $Silian_audit, $Silian_badgeService, $Silian_statsService, $Silian_checkinService, $Silian_quotaConfigService);
        $Silian_method = new \ReflectionMethod($Silian_controller, 'sanitizeSupportRoutingOverride');
        $Silian_method->setAccessible(true);

        $Silian_result = $Silian_method->invoke($Silian_controller, [
            'min_agent_level' => '2.5',
            'resolution_minutes' => '90',
            'routing_weight' => '2.5',
        ]);

        $this->assertArrayNotHasKey('min_agent_level', $Silian_result);
        $this->assertSame(90, $Silian_result['resolution_minutes']);
        $this->assertSame(2.5, $Silian_result['routing_weight']);
    }

    public function testGetUserOverviewIncludesPasskeySummaryAndRecentSecurityActivity(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $Silian_pdo->setAttribute(\PDO::ATTR_DEFAULT_FETCH_MODE, \PDO::FETCH_ASSOC);
        TestSchemaBuilder::init($Silian_pdo);

        $Silian_pdo->exec("
            INSERT INTO user_passkeys (
                user_uuid, credential_id, credential_id_hash, credential_type, label, public_key, rp_id, user_handle,
                transports, sign_count, backup_eligible, backup_state, last_used_at, attested_at, created_at, updated_at
            ) VALUES (
                '550e8400-e29b-41d4-a716-4466554400aa', 'cred-admin', '" . hash('sha256', 'cred-admin') . "', 'public-key', 'Admin Laptop', '{\"alg\":-7}',
                'app.example.test', 'dGVzdA==', '[\"internal\"]', 5, 1, 1,
                '" . gmdate('Y-m-d H:i:s', strtotime('-1 day')) . "',
                '" . gmdate('Y-m-d H:i:s', strtotime('-5 days')) . "',
                '" . gmdate('Y-m-d H:i:s', strtotime('-5 days')) . "',
                '" . gmdate('Y-m-d H:i:s', strtotime('-1 day')) . "'
            )
        ");
        $Silian_stmt = $Silian_pdo->prepare(
            'INSERT INTO audit_logs (user_id, user_uuid, actor_type, action, status, data, operation_category, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $Silian_stmt->execute([1, null, 'user', 'login', 'success', json_encode(['ip_address' => '2.2.2.2']), 'authentication', gmdate('Y-m-d H:i:s', strtotime('-3 hours'))]);
        $Silian_stmt->execute([null, '550e8400-e29b-41d4-a716-4466554400aa', 'user', 'passkey_registered', 'success', json_encode(['passkey_id' => 1, 'label' => 'Admin Laptop']), 'authentication', gmdate('Y-m-d H:i:s', strtotime('-2 hours'))]);

        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => 1]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_badgeService = $this->createMock(BadgeService::class);
        $Silian_badgeService->method('compileUserMetrics')->willReturn([
            'total_points_earned' => 10,
            'total_points_balance' => 1000,
            'total_carbon_saved' => 3.5,
            'total_records' => 2,
            'total_approved_records' => 1,
        ]);
        $Silian_badgeService->method('getUserBadges')->willReturn([]);

        $Silian_statsService = $this->createMock(StatisticsService::class);
        $Silian_checkinService = $this->createMock(CheckinService::class);
        $Silian_checkinService->method('getUserStreakStats')->willReturn([
            'current_streak' => 1,
            'longest_streak' => 3,
            'total_days' => 4,
            'makeup_days' => 0,
        ]);
        $Silian_quotaConfigService = new QuotaConfigService();

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_auth, $Silian_audit, $Silian_badgeService, $Silian_statsService, $Silian_checkinService, $Silian_quotaConfigService);
        $Silian_prop = (new \ReflectionClass($Silian_controller))->getProperty('lastLoginColumn');
        $Silian_prop->setAccessible(true);
        $Silian_prop->setValue($Silian_controller, 'lastlgn');

        $Silian_request = makeRequest('GET', '/admin/users/1/overview');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getUserOverview($Silian_request, $Silian_response, ['id' => 1]);

        $this->assertSame(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertSame(1, $Silian_json['data']['passkey_summary']['total']);
        $this->assertSame(1, $Silian_json['data']['user']['passkey_count']);
        $this->assertCount(2, $Silian_json['data']['recent_security_activity']);
        $this->assertSame('passkey_registered', $Silian_json['data']['recent_security_activity'][0]['action']);
    }

    public function testGetUserOverviewByUuidResolvesSameUser(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $Silian_pdo->setAttribute(\PDO::ATTR_DEFAULT_FETCH_MODE, \PDO::FETCH_ASSOC);
        TestSchemaBuilder::init($Silian_pdo);

        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => 1]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_badgeService = $this->createMock(BadgeService::class);
        $Silian_badgeService->method('compileUserMetrics')->willReturn([]);
        $Silian_badgeService->method('getUserBadges')->willReturn([]);
        $Silian_statsService = $this->createMock(StatisticsService::class);
        $Silian_checkinService = $this->createMock(CheckinService::class);
        $Silian_checkinService->method('getUserStreakStats')->willReturn([]);
        $Silian_quotaConfigService = new QuotaConfigService();

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_auth, $Silian_audit, $Silian_badgeService, $Silian_statsService, $Silian_checkinService, $Silian_quotaConfigService);
        $Silian_prop = (new \ReflectionClass($Silian_controller))->getProperty('lastLoginColumn');
        $Silian_prop->setAccessible(true);
        $Silian_prop->setValue($Silian_controller, 'lastlgn');

        $Silian_request = makeRequest('GET', '/admin/users/by-uuid/550e8400-e29b-41d4-a716-4466554400aa/overview');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getUserOverviewByUuid($Silian_request, $Silian_response, ['uuid' => '550e8400-e29b-41d4-a716-4466554400aa']);

        $this->assertSame(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertSame('550e8400-e29b-41d4-a716-4466554400aa', $Silian_json['data']['user']['uuid']);
    }

    public function testGetUserSecurityActivityAppliesFiltersAndPagination(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $Silian_pdo->setAttribute(\PDO::ATTR_DEFAULT_FETCH_MODE, \PDO::FETCH_ASSOC);
        TestSchemaBuilder::init($Silian_pdo);

        $Silian_insert = $Silian_pdo->prepare(
            'INSERT INTO audit_logs (user_id, user_uuid, actor_type, action, status, data, operation_category, created_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)'
        );
        $Silian_userUuid = '550e8400-e29b-41d4-a716-4466554400aa';
        $Silian_insert->execute([1, $Silian_userUuid, 'user', 'passkey_registered', 'success', json_encode(['label' => 'Laptop']), 'authentication', gmdate('Y-m-d H:i:s', strtotime('-2 days'))]);
        $Silian_insert->execute([1, null, 'user', 'login', 'success', json_encode(['ip_address' => '1.1.1.1']), 'authentication', gmdate('Y-m-d H:i:s', strtotime('-1 days'))]);
        $Silian_insert->execute([1, null, 'user', 'logout', 'success', json_encode([]), 'authentication', gmdate('Y-m-d H:i:s', strtotime('-120 days'))]);

        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 9, 'is_admin' => 1]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('logDataChange')
            ->with(
                'admin',
                'user_security_activity_viewed',
                9,
                'admin',
                'audit_logs',
                1,
                null,
                $this->callback(fn ($Silian_data) => $Silian_data['type'] === 'passkey_changes' && $Silian_data['period'] === '30d' && $Silian_data['count'] === 1),
                $this->callback(fn ($Silian_context) => $Silian_context['change_type'] === 'read')
            );
        $Silian_badgeService = $this->createMock(BadgeService::class);
        $Silian_statsService = $this->createMock(StatisticsService::class);
        $Silian_checkinService = $this->createMock(CheckinService::class);
        $Silian_quotaConfigService = new QuotaConfigService();

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_auth, $Silian_audit, $Silian_badgeService, $Silian_statsService, $Silian_checkinService, $Silian_quotaConfigService);
        $Silian_prop = (new \ReflectionClass($Silian_controller))->getProperty('lastLoginColumn');
        $Silian_prop->setAccessible(true);
        $Silian_prop->setValue($Silian_controller, 'lastlgn');

        $Silian_request = makeRequest('GET', '/admin/users/1/security-activity', null, [
            'page' => 1,
            'limit' => 1,
            'type' => 'passkey_changes',
            'period' => '30d',
        ]);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getUserSecurityActivity($Silian_request, $Silian_response, ['id' => 1]);

        $this->assertSame(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertSame('passkey_changes', $Silian_json['data']['filters']['type']);
        $this->assertSame('30d', $Silian_json['data']['filters']['period']);
        $this->assertSame(1, $Silian_json['data']['pagination']['per_page']);
        $this->assertSame(1, $Silian_json['data']['pagination']['total_items']);
        $this->assertCount(1, $Silian_json['data']['items']);
        $this->assertSame('passkey_registered', $Silian_json['data']['items'][0]['action']);
    }

    public function testGetUsersCanFilterSupportRole(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $Silian_pdo->setAttribute(\PDO::ATTR_DEFAULT_FETCH_MODE, \PDO::FETCH_ASSOC);
        TestSchemaBuilder::init($Silian_pdo);

        $Silian_pdo->exec("INSERT INTO users (id, uuid, username, email, status, is_admin, role, created_at, updated_at) VALUES
            (21, '11111111-1111-4111-8111-111111111111', 'supporter', 'support@example.com', 'active', 0, 'support', '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
            (22, '22222222-2222-4222-8222-222222222222', 'regular', 'user@example.com', 'active', 0, 'user', '2026-01-01 00:00:00', '2026-01-01 00:00:00'),
            (23, '33333333-3333-4333-8333-333333333333', 'adminish', 'admin@example.com', 'active', 1, 'admin', '2026-01-01 00:00:00', '2026-01-01 00:00:00')
        ");

        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => 1, 'role' => 'admin']);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_badgeService = $this->createMock(BadgeService::class);
        $Silian_statsService = $this->createMock(StatisticsService::class);
        $Silian_checkinService = $this->createMock(CheckinService::class);
        $Silian_quotaConfigService = new QuotaConfigService();

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_auth, $Silian_audit, $Silian_badgeService, $Silian_statsService, $Silian_checkinService, $Silian_quotaConfigService);
        $Silian_prop = (new \ReflectionClass($Silian_controller))->getProperty('lastLoginColumn');
        $Silian_prop->setAccessible(true);
        $Silian_prop->setValue($Silian_controller, 'lastlgn');

        $Silian_request = makeRequest('GET', '/admin/users', null, ['role' => 'support', 'page' => 1, 'limit' => 10]);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getUsers($Silian_request, $Silian_response);

        $this->assertSame(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertCount(1, $Silian_json['data']['users']);
        $this->assertSame('supporter', $Silian_json['data']['users'][0]['username']);
        $this->assertSame('support', $Silian_json['data']['users'][0]['role']);
    }

    public function testUpdateUserCanSwitchExplicitRole(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $Silian_pdo->setAttribute(\PDO::ATTR_DEFAULT_FETCH_MODE, \PDO::FETCH_ASSOC);
        TestSchemaBuilder::init($Silian_pdo);

        $Silian_pdo->exec("INSERT INTO users (id, uuid, username, email, status, is_admin, role, created_at, updated_at) VALUES
            (31, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'target-user', 'target@example.com', 'active', 0, 'user', '2026-01-01 00:00:00', '2026-01-01 00:00:00')
        ");

        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => 1, 'role' => 'admin']);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('logDataChange')
            ->with(
                'admin',
                'user_update',
                1,
                'admin',
                'users',
                31,
                null,
                null,
                $this->callback(fn (array $Silian_meta) => in_array('role', $Silian_meta['fields'] ?? [], true) && in_array('is_admin', $Silian_meta['fields'] ?? [], true))
            );
        $Silian_badgeService = $this->createMock(BadgeService::class);
        $Silian_statsService = $this->createMock(StatisticsService::class);
        $Silian_checkinService = $this->createMock(CheckinService::class);
        $Silian_quotaConfigService = new QuotaConfigService();

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_auth, $Silian_audit, $Silian_badgeService, $Silian_statsService, $Silian_checkinService, $Silian_quotaConfigService);
        $Silian_prop = (new \ReflectionClass($Silian_controller))->getProperty('lastLoginColumn');
        $Silian_prop->setAccessible(true);
        $Silian_prop->setValue($Silian_controller, 'lastlgn');

        $Silian_request = makeRequest('PUT', '/admin/users/31', ['role' => 'support']);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->updateUser($Silian_request, $Silian_response, ['id' => 31]);

        $this->assertSame(200, $Silian_resp->getStatusCode());
        $Silian_row = $Silian_pdo->query("SELECT role, is_admin FROM users WHERE id = 31")->fetch();
        $this->assertSame('support', $Silian_row['role']);
        $this->assertSame(0, (int) $Silian_row['is_admin']);
    }

}

