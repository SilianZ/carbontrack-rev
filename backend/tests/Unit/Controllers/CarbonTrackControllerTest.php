<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use PHPUnit\Framework\TestCase;
use CarbonTrack\Controllers\CarbonTrackController;
use CarbonTrack\Services\CarbonCalculatorService;
use CarbonTrack\Services\RegionService;
use CarbonTrack\Services\UserProfileViewService;

class CarbonTrackControllerTest extends TestCase
{
    private function makeUserProfileViewService(): UserProfileViewService
    {
        return new UserProfileViewService(new RegionService(null, null, null, null));
    }

    private function makeController(
        \PDO $Silian_pdo,
        $Silian_calc,
        $Silian_msg,
        $Silian_audit,
        $Silian_auth,
        $Silian_errorLogService = null,
        $Silian_r2Service = null,
        $Silian_checkinService = null,
        $Silian_quotaService = null,
        $Silian_badgeService = null
    ): CarbonTrackController {
        return new CarbonTrackController(
            $Silian_pdo,
            $Silian_calc,
            $Silian_msg,
            $Silian_audit,
            $Silian_auth,
            $this->makeUserProfileViewService(),
            $Silian_errorLogService,
            $Silian_r2Service,
            $Silian_checkinService,
            $Silian_quotaService,
            $Silian_badgeService
        );
    }

    public function testControllerClassExists(): void
    {
        $this->assertTrue(class_exists(CarbonTrackController::class));
    }

    public function testCalculateReturnsNumbers(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_calc = $this->getMockBuilder(CarbonCalculatorService::class)->disableOriginalConstructor()->onlyMethods(['calculateCarbonSavings'])->getMock();
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);

        // mock auth current user
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1]);

        // mock activity lookup via CarbonActivity::findById uses PDO directly through the controller
        $Silian_activityStmt = $this->createMock(\PDOStatement::class);
        $Silian_activityStmt->method('execute')->willReturn(true);
        $Silian_activityStmt->method('fetch')->willReturn(['id' => 'uuid-1', 'unit' => 'km']);
        $Silian_pdo->method('prepare')->willReturn($Silian_activityStmt);

        // calculator output
        // adapt controller expect to use calculate or similar mapping
        $Silian_calc->method('calculateCarbonSavings')->willReturn([
            'carbon_savings' => 25.0
        ]);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_calc, $Silian_msg, $Silian_audit, $Silian_auth);

        $Silian_request = makeRequest('POST', '/carbon-track/calculate', ['activity_id' => 'uuid-1', 'data' => 10]);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->calculate($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(25.0, $Silian_json['data']['carbon_saved']);
        $this->assertEquals(250, $Silian_json['data']['points_earned']);
    }

    public function testCalculateMissingFields(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_calc = $this->createMock(CarbonCalculatorService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1]);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_calc, $Silian_msg, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('POST', '/carbon-track/calculate', ['activity_id' => 'uuid-1']);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->calculate($Silian_request, $Silian_response);
        $this->assertEquals(400, $Silian_resp->getStatusCode());
    }

    public function testGetCarbonFactors(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_calc = $this->createMock(CarbonCalculatorService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_calc, $Silian_msg, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/carbon-track/factors');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getCarbonFactors($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_data = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_data['success']);
    }

    public function testGetUserStats(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_calc = $this->createMock(CarbonCalculatorService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>1]);

        $Silian_summaryStmt = $this->createMock(\PDOStatement::class);
        $Silian_summaryStmt->method('execute')->willReturn(true);
        $Silian_summaryStmt->method('fetch')->willReturn([
            'total_records'=>3,
            'approved_records'=>1,
            'pending_records'=>1,
            'rejected_records'=>1,
            'total_carbon_saved'=>10.5,
            'total_points_earned'=>100
        ]);

        $Silian_monthlyStmt = $this->createMock(\PDOStatement::class);
        $Silian_monthlyStmt->method('execute')->willReturn(true);
        $Silian_monthlyStmt->method('fetchAll')->willReturn([
            ['month'=>'2025-01','records_count'=>1,'carbon_saved'=>5,'points_earned'=>50]
        ]);

        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_summaryStmt, $Silian_monthlyStmt);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_calc, $Silian_msg, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/carbon-track/stats');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getUserStats($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(3, $Silian_json['data']['overview']['total_records']);
        $this->assertCount(1, $Silian_json['data']['monthly']);
    }

    public function testSubmitRecordSuccess(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_calc = $this->createMock(CarbonCalculatorService::class);
        $Silian_calc->method('calculateCarbonSavings')->willReturn(['carbon_savings'=>12.3]);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_msg->expects($this->once())->method('sendMessage');
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_audit->expects($this->once())->method('log');
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>1,'username'=>'user']);

        // find activity
        $Silian_activityStmt = $this->createMock(\PDOStatement::class);
        $Silian_activityStmt->method('execute')->willReturn(true);
        $Silian_activityStmt->method('fetch')->willReturn(['id'=>'a1','name_zh'=>'活动','unit'=>'km']);
        // insert record
        $Silian_insert = $this->createMock(\PDOStatement::class);
        $Silian_insert->method('execute')->willReturn(true);
        // select admins
        $Silian_admins = $this->createMock(\PDOStatement::class);
        $Silian_admins->method('execute')->willReturn(true);
        $Silian_admins->method('fetchAll')->willReturn([['id'=>9], ['id'=>10]]);

        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_activityStmt, $Silian_insert, $Silian_admins);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_calc, $Silian_msg, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('POST', '/carbon-track/record', ['activity_id'=>'a1','amount'=>5,'date'=>'2025-08-01']);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->submitRecord($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(123, $Silian_json['calculation']['points_earned']);
    }

    public function testSubmitRecordMakeupAlreadyCheckedInReturnsConflict(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_calc = $this->createMock(CarbonCalculatorService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_checkin = $this->createMock(\CarbonTrack\Services\CheckinService::class);
        $Silian_quota = $this->createMock(\CarbonTrack\Services\QuotaService::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'username' => 'user']);
        $Silian_auth->method('getCurrentUserModel')->willReturn(new \CarbonTrack\Models\User(['id' => 1]));
        $Silian_checkin->method('hasCheckin')->willReturn(true);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_calc, $Silian_msg, $Silian_audit, $Silian_auth, null, null, $Silian_checkin, $Silian_quota);

        $Silian_request = makeRequest('POST', '/carbon-track/record', [
            'activity_id' => 'a1',
            'amount' => 5,
            'date' => '2025-08-01',
            'checkin_date' => '2025-07-01'
        ]);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->submitRecord($Silian_request, $Silian_response);

        $this->assertSame(409, $Silian_resp->getStatusCode());
    }

    public function testReviewRecordRejectFlow(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $Silian_pdo->sqliteCreateFunction('NOW', static function (): string {
            return date('Y-m-d H:i:s');
        });

        $Silian_pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email TEXT, full_name TEXT, points REAL DEFAULT 0)');
        $Silian_pdo->exec('CREATE TABLE carbon_activities (id TEXT PRIMARY KEY, name_zh TEXT, name_en TEXT, category TEXT, unit TEXT)');
        $Silian_pdo->exec('CREATE TABLE carbon_records (
            id TEXT PRIMARY KEY,
            user_id INTEGER,
            activity_id TEXT,
            status TEXT,
            points_earned REAL,
            carbon_saved REAL,
            amount REAL,
            review_note TEXT,
            reviewed_by INTEGER,
            reviewed_at TEXT,
            deleted_at TEXT
        )');

        $Silian_pdo->exec("INSERT INTO users (id, username, email, full_name, points) VALUES (1, 'u1', 'user@example.com', 'User One', 0)");
        $Silian_pdo->exec("INSERT INTO carbon_activities (id, name_zh, name_en, category, unit) VALUES ('a1', '活动', 'Activity', 'general', 'kg')");
        $Silian_pdo->exec("INSERT INTO carbon_records (id, user_id, activity_id, status, points_earned, carbon_saved, amount) VALUES ('r2', 1, 'a1', 'pending', 20, 5, 10)");

        $Silian_calc = $this->createMock(CarbonCalculatorService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_msg->expects($this->once())
            ->method('sendCarbonRecordReviewSummary')
            ->with(
                $this->equalTo(1),
                $this->equalTo('reject'),
                $this->callback(function (array $Silian_records): bool {
                    $this->assertCount(1, $Silian_records);
                    $this->assertSame('r2', $Silian_records[0]['id']);
                    $this->assertSame('rejected', $Silian_records[0]['status']);
                    return true;
                }),
                $this->equalTo('资料不完整'),
                $this->callback(function (array $Silian_options): bool {
                    $this->assertSame(9, $Silian_options['reviewed_by_id']);
                    return true;
                })
            );

        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_audit->expects($this->once())->method('logAdminOperation');

        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 9, 'username' => 'admin', 'is_admin' => true]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_calc, $Silian_msg, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('PUT', '/admin/activities/r2/review', ['action' => 'reject', 'review_note' => '资料不完整']);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->reviewRecord($Silian_request, $Silian_response, ['id' => 'r2']);

        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertSame(['r2'], $Silian_json['processed_ids']);

        $Silian_row = $Silian_pdo->query("SELECT status, review_note FROM carbon_records WHERE id = 'r2'")->fetch(\PDO::FETCH_ASSOC);
        $this->assertSame('rejected', $Silian_row['status']);
        $this->assertSame('资料不完整', $Silian_row['review_note']);
    }

    public function testReviewRecordsBulkApprovesAndAggregatesNotifications(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $Silian_pdo->sqliteCreateFunction('NOW', static function (): string {
            return date('Y-m-d H:i:s');
        });

        $Silian_pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email TEXT, full_name TEXT, points REAL DEFAULT 0)');
        $Silian_pdo->exec('CREATE TABLE carbon_activities (id TEXT PRIMARY KEY, name_zh TEXT, name_en TEXT, category TEXT, unit TEXT)');
        $Silian_pdo->exec('CREATE TABLE carbon_records (
            id TEXT PRIMARY KEY,
            user_id INTEGER,
            activity_id TEXT,
            status TEXT,
            points_earned REAL,
            carbon_saved REAL,
            amount REAL,
            review_note TEXT,
            reviewed_by INTEGER,
            reviewed_at TEXT,
            deleted_at TEXT
        )');

        $Silian_pdo->exec("INSERT INTO users (id, username, email, full_name, points) VALUES (3, 'u3', 'user3@example.com', 'User Three', 10)");
        $Silian_pdo->exec("INSERT INTO carbon_activities (id, name_zh, name_en, category, unit) VALUES ('a3', '节能', 'Energy Saving', 'energy', 'kWh')");
        $Silian_pdo->exec("INSERT INTO carbon_records (id, user_id, activity_id, status, points_earned, carbon_saved, amount) VALUES ('r10', 3, 'a3', 'pending', 15, 2.5, 5)");
        $Silian_pdo->exec("INSERT INTO carbon_records (id, user_id, activity_id, status, points_earned, carbon_saved, amount) VALUES ('r11', 3, 'a3', 'pending', 25, 3.5, 7)");

        $Silian_calc = $this->createMock(CarbonCalculatorService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_msg->expects($this->once())
            ->method('sendCarbonRecordReviewSummary')
            ->with(
                $this->equalTo(3),
                $this->equalTo('approve'),
                $this->callback(function (array $Silian_records): bool {
                    $this->assertCount(2, $Silian_records);
                    $Silian_ids = array_column($Silian_records, 'id');
                    sort($Silian_ids);
                    $this->assertSame(['r10', 'r11'], $Silian_ids);
                    foreach ($Silian_records as $Silian_record) {
                        $this->assertSame('approved', $Silian_record['status']);
                    }
                    return true;
                }),
                $this->isNull(),
                $this->callback(function (array $Silian_options): bool {
                    $this->assertSame(9, $Silian_options['reviewed_by_id']);
                    return true;
                })
            );

        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_audit->expects($this->exactly(2))->method('logAdminOperation');

        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 9, 'username' => 'admin', 'is_admin' => true]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_calc, $Silian_msg, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('PUT', '/admin/activities/review', ['action' => 'approve', 'record_ids' => ['r10', 'r11']]);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->reviewRecordsBulk($Silian_request, $Silian_response);

        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertSame(['r10', 'r11'], $Silian_json['processed_ids']);
        $this->assertEmpty($Silian_json['missing_ids']);

        $Silian_ids = $Silian_pdo->query("SELECT id, status FROM carbon_records ORDER BY id")->fetchAll(\PDO::FETCH_ASSOC);
        foreach ($Silian_ids as $Silian_row) {
            $this->assertSame('approved', $Silian_row['status']);
        }

        $Silian_points = $Silian_pdo->query('SELECT points FROM users WHERE id = 3')->fetchColumn();
        $this->assertEquals(50, $Silian_points);
    }

    public function testGetPendingRecordsUsesCanonicalSchoolName(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_calc = $this->createMock(CarbonCalculatorService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 9, 'is_admin' => true]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_countStmt = $this->createMock(\PDOStatement::class);
        $Silian_countStmt->method('execute')->willReturn(true);
        $Silian_countStmt->method('fetch')->willReturn(['total' => 1]);

        $Silian_listStmt = $this->createMock(\PDOStatement::class);
        $Silian_listStmt->method('bindValue')->willReturn(true);
        $Silian_listStmt->method('execute')->willReturn(true);
        $Silian_listStmt->method('fetchAll')->willReturn([
            [
                'id' => 'r1',
                'images' => null,
                'username' => 'alice',
                'email' => 'alice@example.com',
                'school_name' => 'Canonical Academy',
                'activity_name_zh' => '节能',
                'activity_name_en' => 'Energy Saving',
                'category' => 'energy',
                'amount' => 3,
                'unit' => 'times',
                'carbon_saved' => 1.2,
                'points_earned' => 12,
                'status' => 'pending',
            ],
        ]);

        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_countStmt, $Silian_listStmt);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_calc, $Silian_msg, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/admin/activities/pending');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getPendingRecords($Silian_request, $Silian_response);

        $this->assertSame(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertSame('Canonical Academy', $Silian_json['data'][0]['school_name']);
    }

    public function testGetRecordDetailAsAdmin(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_calc = $this->createMock(CarbonCalculatorService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>9]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('bindValue')->willReturn(true);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_stmt->method('fetch')->willReturn(['id'=>'r3','images'=>null]);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_calc, $Silian_msg, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/carbon-track/transactions/r3');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getRecordDetail($Silian_request, $Silian_response, ['id' => 'r3']);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
    }

    public function testGetUserRecordsPaged(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_calc = $this->createMock(CarbonCalculatorService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>1]);

        $Silian_countStmt = $this->createMock(\PDOStatement::class);
        $Silian_countStmt->method('execute')->willReturn(true);
        $Silian_countStmt->method('fetch')->willReturn(['total'=>1]);

        $Silian_listStmt = $this->createMock(\PDOStatement::class);
        $Silian_listStmt->method('bindValue')->willReturn(true);
        $Silian_listStmt->method('execute')->willReturn(true);
        $Silian_listStmt->method('fetchAll')->willReturn([
            ['id'=>'r1','images'=>null]
        ]);

        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_countStmt, $Silian_listStmt);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_calc, $Silian_msg, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/carbon-track/records');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getUserRecords($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(1, $Silian_json['pagination']['total']);
    }

    public function testSubmitRecordValidationMissingField(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_calc = $this->createMock(CarbonCalculatorService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>1]);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_calc, $Silian_msg, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('POST', '/carbon-track/record', ['activity_id' => 'a1', 'amount' => 1]); // missing date
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->submitRecord($Silian_request, $Silian_response);
        $this->assertEquals(400, $Silian_resp->getStatusCode());
    }

    public function testGetRecordDetailForbiddenForOtherUser(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_calc = $this->createMock(CarbonCalculatorService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>2]);
        $Silian_auth->method('isAdminUser')->willReturn(false);

        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('bindValue')->willReturn(true);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_stmt->method('fetch')->willReturn(false); // not found when not owner
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_calc, $Silian_msg, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/carbon-track/transactions/r1');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getRecordDetail($Silian_request, $Silian_response, ['id' => 'r1']);
        $this->assertEquals(404, $Silian_resp->getStatusCode());
    }

    public function testReviewRecordApproveFlow(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_calc = $this->createMock(CarbonCalculatorService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>9]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        // fetch record
        $Silian_fetch = $this->createMock(\PDOStatement::class);
        $Silian_fetch->method('bindValue')->willReturn(true);
        $Silian_fetch->method('execute')->willReturn(true);
        $Silian_fetch->method('fetchAll')->willReturn([
            ['id'=>'r1','user_id'=>1,'points_earned'=>20,'status'=>'pending']
        ]);
        // update record status
        $Silian_update = $this->createMock(\PDOStatement::class);
        $Silian_update->method('execute')->willReturn(true);
        // update user points
        $Silian_updatePoints = $this->createMock(\PDOStatement::class);
        $Silian_updatePoints->method('execute')->willReturn(true);

        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_fetch, $Silian_update, $Silian_updatePoints);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_calc, $Silian_msg, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('PUT', '/carbon-track/transactions/r1/approve', ['action' => 'approve']);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->reviewRecord($Silian_request, $Silian_response, ['id' => 'r1']);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
    }

    public function testReviewRecordUnifiedStatusApproved(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_calc = $this->createMock(CarbonCalculatorService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>9]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        // fetch record
        $Silian_fetch = $this->createMock(\PDOStatement::class);
        $Silian_fetch->method('bindValue')->willReturn(true);
        $Silian_fetch->method('execute')->willReturn(true);
        $Silian_fetch->method('fetchAll')->willReturn([
            ['id'=>'r9','user_id'=>1,'points_earned'=>30,'status'=>'pending']
        ]);
        // update record status
        $Silian_update = $this->createMock(\PDOStatement::class);
        $Silian_update->method('execute')->willReturn(true);
        // update user points
        $Silian_updatePoints = $this->createMock(\PDOStatement::class);
        $Silian_updatePoints->method('execute')->willReturn(true);

        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_fetch, $Silian_update, $Silian_updatePoints);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_calc, $Silian_msg, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('PUT', '/carbon-track/transactions/r9', ['status' => 'approved']);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->reviewRecord($Silian_request, $Silian_response, ['id' => 'r9']);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
    }

    public function testDeleteTransactionForOwner(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_calc = $this->createMock(CarbonCalculatorService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>3]);
        $Silian_auth->method('isAdminUser')->willReturn(false);

        $Silian_update = $this->createMock(\PDOStatement::class);
        $Silian_update->method('execute')->willReturn(true);
        $Silian_pdo->method('prepare')->willReturn($Silian_update);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_calc, $Silian_msg, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('DELETE', '/carbon-track/transactions/r2');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->deleteTransaction($Silian_request, $Silian_response, ['id' => 'r2']);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
    }

    public function testGetPendingRecordsRequiresAdmin(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_calc = $this->createMock(CarbonCalculatorService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>1]);
        $Silian_auth->method('isAdmin')->willReturn(false);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_calc, $Silian_msg, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/admin/activities');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getPendingRecords($Silian_request, $Silian_response);
        $this->assertEquals(403, $Silian_resp->getStatusCode());
    }

    public function testGetPendingRecordsSuccess(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_calc = $this->createMock(CarbonCalculatorService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>9]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_countStmt = $this->createMock(\PDOStatement::class);
        $Silian_countStmt->method('execute')->willReturn(true);
        $Silian_countStmt->method('fetch')->willReturn(['total'=>1]);

        $Silian_listStmt = $this->createMock(\PDOStatement::class);
        $Silian_listStmt->method('bindValue')->willReturn(true);
        $Silian_listStmt->method('execute')->willReturn(true);
        $Silian_listStmt->method('fetchAll')->willReturn([
            ['id'=>'r1','images'=>null]
        ]);

        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_countStmt, $Silian_listStmt);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_calc, $Silian_msg, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/admin/activities');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getPendingRecords($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(1, $Silian_json['pagination']['total']);
    }

    public function testGetPendingRecordsUsesDistinctSearchBindings(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_calc = $this->createMock(CarbonCalculatorService::class);
        $Silian_msg = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 9, 'is_admin' => true]);
        $Silian_auth->method('isAdminUser')->willReturn(true);
        $Silian_countBound = [];
        $Silian_listBound = [];

        $Silian_countStmt = $this->createMock(\PDOStatement::class);
        $Silian_countStmt->expects($this->exactly(4))
            ->method('bindValue')
            ->willReturnCallback(function (string $Silian_key, $Silian_value, ?int $Silian_type = null) use (&$Silian_countBound) {
                $Silian_countBound[$Silian_key] = [$Silian_value, $Silian_type];
                return true;
            });
        $Silian_countStmt->expects($this->once())->method('execute')->willReturn(true);
        $Silian_countStmt->expects($this->once())->method('fetch')->willReturn(['total' => 0]);

        $Silian_listStmt = $this->createMock(\PDOStatement::class);
        $Silian_listStmt->expects($this->exactly(6))
            ->method('bindValue')
            ->willReturnCallback(function (string $Silian_key, $Silian_value, ?int $Silian_type = null) use (&$Silian_listBound) {
                $Silian_listBound[$Silian_key] = [$Silian_value, $Silian_type];
                return true;
            });
        $Silian_listStmt->expects($this->once())->method('execute')->willReturn(true);
        $Silian_listStmt->expects($this->once())->method('fetchAll')->willReturn([]);

        $Silian_pdo->expects($this->exactly(2))
            ->method('prepare')
            ->willReturnCallback(function (string $Silian_sql) use ($Silian_countStmt, $Silian_listStmt) {
                static $Silian_prepareCalls = 0;
                $Silian_prepareCalls++;
                $this->assertStringContainsString('u.username LIKE :search_username', $Silian_sql);
                $this->assertStringContainsString('u.email LIKE :search_email', $Silian_sql);
                $this->assertStringContainsString('a.name_zh LIKE :search_name_zh', $Silian_sql);
                $this->assertStringContainsString('a.name_en LIKE :search_name_en', $Silian_sql);
                return $Silian_prepareCalls === 1 ? $Silian_countStmt : $Silian_listStmt;
            });

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_calc, $Silian_msg, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/admin/activities', null, ['search' => 'green']);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->getPendingRecords($Silian_request, $Silian_response);
        $this->assertSame(200, $Silian_resp->getStatusCode());
        $this->assertSame('%green%', $Silian_countBound['search_username'][0] ?? null);
        $this->assertSame('%green%', $Silian_countBound['search_email'][0] ?? null);
        $this->assertSame('%green%', $Silian_countBound['search_name_zh'][0] ?? null);
        $this->assertSame('%green%', $Silian_countBound['search_name_en'][0] ?? null);
        $this->assertSame(20, $Silian_listBound['limit'][0] ?? null);
        $this->assertSame(0, $Silian_listBound['offset'][0] ?? null);
    }
}


