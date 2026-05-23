<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Integration;

use CarbonTrack\Controllers\AdminController;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\BadgeService;
use CarbonTrack\Services\CheckinService;
use CarbonTrack\Services\RegionService;
use CarbonTrack\Services\StatisticsService;
use CarbonTrack\Services\QuotaConfigService;
use CarbonTrack\Services\UserProfileViewService;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Response;

class AdminStatsIntegrationTest extends TestCase
{
    private function makeControllerWithData(): AdminController
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        TestSchemaBuilder::init($Silian_pdo);

        $Silian_adminId = (int) $Silian_pdo->query("SELECT id FROM users WHERE is_admin = 1 LIMIT 1")->fetchColumn();
        if ($Silian_adminId === 0) {
            $Silian_pdo->exec("INSERT INTO users (id, username, email, status, is_admin, points, created_at) VALUES (1, 'admin', 'admin@example.com', 'active', 1, 1000, '2025-09-01 00:00:00')");
            $Silian_adminId = 1;
        }

        $Silian_pdo->exec("INSERT INTO users (id, username, email, status, is_admin, points, created_at) VALUES
            (2, 'active_user', 'active@example.com', 'active', 0, 120, datetime('now','-1 day')),
            (3, 'inactive_user', 'inactive@example.com', 'inactive', 0, 10, datetime('now','-40 day')),
            (4, 'suspended_user', 'suspended@example.com', 'suspended', 0, 5, datetime('now','-5 day'))");

        $Silian_insertPoint = $Silian_pdo->prepare("INSERT INTO points_transactions (id, uid, status, points, created_at) VALUES (:id, :uid, :status, :points, :created_at)");
        $Silian_insertPoint->execute([':id' => 'pt_1', ':uid' => 2, ':status' => 'approved', ':points' => 10, ':created_at' => date('Y-m-d H:i:s', strtotime('-2 days'))]);
        $Silian_insertPoint->execute([':id' => 'pt_2', ':uid' => 2, ':status' => 'approved', ':points' => 20, ':created_at' => date('Y-m-d H:i:s', strtotime('-1 day'))]);
        $Silian_insertPoint->execute([':id' => 'pt_3', ':uid' => 3, ':status' => 'pending', ':points' => 5, ':created_at' => date('Y-m-d H:i:s', strtotime('-1 day'))]);
        $Silian_insertPoint->execute([':id' => 'pt_4', ':uid' => 4, ':status' => 'rejected', ':points' => 8, ':created_at' => date('Y-m-d H:i:s', strtotime('-3 day'))]);

        $Silian_insertCarbon = $Silian_pdo->prepare("INSERT INTO carbon_records (id, user_id, activity_id, carbon_saved, points_earned, status, created_at) VALUES (:id, :user_id, :activity_id, :carbon_saved, :points_earned, :status, :created_at)");
        $Silian_insertCarbon->execute([':id' => 'cr_1', ':user_id' => 2, ':activity_id' => 'act_a', ':carbon_saved' => 5.5, ':points_earned' => 2, ':status' => 'approved', ':created_at' => date('Y-m-d H:i:s', strtotime('-2 day'))]);
        $Silian_insertCarbon->execute([':id' => 'cr_2', ':user_id' => 2, ':activity_id' => 'act_b', ':carbon_saved' => 3.2, ':points_earned' => 1, ':status' => 'approved', ':created_at' => date('Y-m-d H:i:s', strtotime('-6 day'))]);
        $Silian_insertCarbon->execute([':id' => 'cr_3', ':user_id' => 3, ':activity_id' => 'act_c', ':carbon_saved' => 1.0, ':points_earned' => 0, ':status' => 'pending', ':created_at' => date('Y-m-d H:i:s', strtotime('-1 day'))]);

        $Silian_pdo->exec("INSERT INTO carbon_activities (id, name_zh, name_en, is_active, created_at) VALUES
            ('act_a', '活动A', 'Activity A', 1, datetime('now')),
            ('act_b', '活动B', 'Activity B', 1, datetime('now')),
            ('act_c', '活动C', 'Activity C', 0, datetime('now'))");

        $Silian_insertExchange = $Silian_pdo->prepare("INSERT INTO point_exchanges (id, user_id, status, points_used, created_at) VALUES (:id, :user_id, :status, :points_used, :created_at)");
        $Silian_insertExchange->execute([':id' => 'ex_1', ':user_id' => 2, ':status' => 'completed', ':points_used' => 15, ':created_at' => date('Y-m-d H:i:s', strtotime('-4 day'))]);
        $Silian_insertExchange->execute([':id' => 'ex_2', ':user_id' => 3, ':status' => 'pending', ':points_used' => 7, ':created_at' => date('Y-m-d H:i:s', strtotime('-1 day'))]);

        $Silian_pdo->exec("INSERT INTO messages (sender_id, receiver_id, title, content, priority, is_read, created_at) VALUES
            ($Silian_adminId, 2, 'Notice', 'Please review', 'urgent', 0, datetime('now','-2 day')),
            ($Silian_adminId, 3, 'Reminder', 'Update profile', 'normal', 1, datetime('now','-3 day')),
            ($Silian_adminId, 4, 'Alert', 'Pending action', 'high', 0, datetime('now','-1 day'))");

        $Silian_authService = new class('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'HS256', 3600) extends AuthService {
            private array $admin;
            public function __construct($Silian_secret, $Silian_alg, $Silian_exp)
            {
                parent::__construct($Silian_secret, $Silian_alg, $Silian_exp);
                $this->admin = [
                    'id' => 1,
                    'is_admin' => true,
                ];
            }
            public function getCurrentUser(\Psr\Http\Message\ServerRequestInterface $Silian_request): ?array
            {
                return $this->admin;
            }
        };

        $Silian_auditLog = $this->createMock(AuditLogService::class);
        $Silian_badgeService = $this->createMock(BadgeService::class);
        $Silian_statsCacheDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'carbontrack_stats_cache_' . uniqid();
        $Silian_statsService = new StatisticsService($Silian_pdo, $Silian_statsCacheDir, 0, 0);

        $Silian_checkinService = new CheckinService($Silian_pdo, null, 'UTC');

        $Silian_quotaConfigService = new QuotaConfigService();

        return new AdminController(
            $Silian_pdo,
            $Silian_authService,
            $Silian_auditLog,
            $Silian_badgeService,
            $Silian_statsService,
            $Silian_checkinService,
            $Silian_quotaConfigService,
            new UserProfileViewService(new RegionService(null, null, null, null)),
            null,
            null
        );
    }

    public function testGetStatsReturnsTypedAggregates(): void
    {
        $Silian_controller = $this->makeControllerWithData();
        $Silian_request = makeRequest('GET', '/admin/stats');
        $Silian_response = new Response();

        $Silian_result = $Silian_controller->getStats($Silian_request, $Silian_response);
        $this->assertSame(200, $Silian_result->getStatusCode());

        $Silian_payload = json_decode((string) $Silian_result->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertTrue($Silian_payload['success']);
        $Silian_data = $Silian_payload['data'];

        $this->assertSame(4, $Silian_data['users']['total_users']);
        $this->assertSame(2, $Silian_data['users']['active_users']);
        $this->assertSame(2, $Silian_data['users']['inactive_users']);
        $this->assertSame(3, $Silian_data['users']['new_users_30d']);
        $this->assertEquals(0.5, $Silian_data['users']['active_ratio']);
        $this->assertEquals(0.75, $Silian_data['users']['new_users_ratio']);

        $this->assertSame(4, $Silian_data['transactions']['total_transactions']);
        $this->assertSame(1, $Silian_data['transactions']['pending_transactions']);
        $this->assertSame(2, $Silian_data['transactions']['approved_transactions']);
        $this->assertSame(1, $Silian_data['transactions']['rejected_transactions']);
        $this->assertEquals(30.0, $Silian_data['transactions']['total_points_awarded']);
        $this->assertEquals(0.5, $Silian_data['transactions']['approval_rate']);
        $this->assertEquals(15.0, $Silian_data['transactions']['avg_points_per_transaction']);
        $this->assertSame(4, $Silian_data['transactions']['last7_transactions']);

        $this->assertSame(2, $Silian_data['exchanges']['total_exchanges']);
        $this->assertSame(1, $Silian_data['exchanges']['completed_exchanges']);
        $this->assertEquals(22.0, $Silian_data['exchanges']['total_points_spent']);
        $this->assertGreaterThan(0, $Silian_data['exchanges']['completion_rate']);

        $this->assertSame(3, $Silian_data['messages']['total_messages']);
        $this->assertSame(2, $Silian_data['messages']['unread_messages']);
        $this->assertSame(1, $Silian_data['messages']['read_messages']);
        $this->assertGreaterThan(0, $Silian_data['messages']['unread_ratio']);
        $this->assertArrayHasKey('priority_breakdown', $Silian_data['messages']);
        $this->assertArrayHasKey('daily_counts', $Silian_data['messages']);
        $this->assertGreaterThan(0, count($Silian_data['messages']['priority_breakdown']));
        $Silian_priorityTotals = array_sum(array_map(static fn(array $Silian_entry): int => (int) ($Silian_entry['total'] ?? 0), $Silian_data['messages']['priority_breakdown']));
        $this->assertSame(3, $Silian_priorityTotals);
        $Silian_dailyTotals = array_sum(array_map(static fn(array $Silian_entry): int => (int) ($Silian_entry['total'] ?? 0), $Silian_data['messages']['daily_counts']));
        $this->assertSame(3, $Silian_dailyTotals);

        $this->assertSame(3, $Silian_data['activities']['total_records']);
        $this->assertSame(2, $Silian_data['activities']['approved_records']);
        $this->assertSame(1, $Silian_data['activities']['pending_records']);
        $this->assertSame(0, $Silian_data['activities']['rejected_records']);
        $this->assertSame(5, $Silian_data['activities']['total_activities']);
        $this->assertSame(4, $Silian_data['activities']['active_activities']);
        $this->assertSame(1, $Silian_data['activities']['inactive_activities']);

        $this->assertSame(3, $Silian_data['carbon']['total_records']);
        $this->assertSame(1, $Silian_data['carbon']['pending_records']);
        $this->assertSame(2, $Silian_data['carbon']['approved_records']);
        $this->assertEquals(8.7, $Silian_data['carbon']['total_carbon_saved']);
        $this->assertEquals(3.0, $Silian_data['carbon']['total_points_earned']);
        $this->assertGreaterThan(0, $Silian_data['carbon']['average_daily_carbon']);

        $this->assertArrayHasKey('trend_summary', $Silian_data);
        $this->assertEquals(8.7, $Silian_data['trend_summary']['carbon_last7']);
        $this->assertEquals(4, $Silian_data['trend_summary']['transactions_last7']);
        $this->assertEquals(30.0, $Silian_data['trend_summary']['points_last7']);
        $this->assertArrayHasKey('recent', $Silian_data);
        $this->assertNotEmpty($Silian_data['recent']['pending_transactions']);
        $this->assertNotEmpty($Silian_data['recent']['pending_carbon_records']);
        $this->assertNotEmpty($Silian_data['recent']['latest_users']);

        $this->assertIsInt($Silian_data['transactions']['total_transactions']);
        $this->assertIsNumeric($Silian_data['transactions']['total_points_awarded']);
        $this->assertIsFloat($Silian_data['carbon']['total_carbon_saved']);
        $this->assertIsFloat($Silian_data['users']['active_ratio']);
    }
}
