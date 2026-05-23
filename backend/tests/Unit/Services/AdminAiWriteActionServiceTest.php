<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\AdminAiWriteActionService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\MessageService;
use CarbonTrack\Tests\Integration\TestSchemaBuilder;
use Monolog\Logger;
use PHPUnit\Framework\TestCase;
use PDO;

class AdminAiWriteActionServiceTest extends TestCase
{
    private function makePdo(): PDO
    {
        $Silian_pdo = new PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        TestSchemaBuilder::init($Silian_pdo);
        return $Silian_pdo;
    }

    public function testExecuteCreateUserPersistsHashedPasswordAndProfile(): void
    {
        $Silian_pdo = $this->makePdo();
        $Silian_auditLogService = new AuditLogService($Silian_pdo, new Logger('test'));
        $Silian_service = new AdminAiWriteActionService($Silian_pdo, $Silian_auditLogService);

        $Silian_result = $Silian_service->execute('create_user', [
            'username' => 'workspace_admin',
            'email' => 'workspace-admin@example.com',
            'password' => 'TempPass#2026',
            'status' => 'active',
            'is_admin' => true,
            'school_id' => 1,
            'admin_notes' => 'created in write service test',
        ], [
            'request_id' => 'req-write-service-create-1',
            'actor_id' => 1,
            'source' => '/admin/ai/chat',
        ]);

        $this->assertSame('create_user', $Silian_result['action']);
        $this->assertSame('workspace_admin', $Silian_result['user']['username']);
        $this->assertTrue((bool) $Silian_result['user']['is_admin']);

        $Silian_user = $Silian_pdo->query("SELECT username, email, password, status, is_admin, admin_notes FROM users WHERE username = 'workspace_admin'")
            ->fetch(PDO::FETCH_ASSOC);
        $this->assertIsArray($Silian_user);
        $this->assertSame('workspace-admin@example.com', $Silian_user['email']);
        $this->assertSame('active', $Silian_user['status']);
        $this->assertSame('1', (string) $Silian_user['is_admin']);
        $this->assertSame('created in write service test', $Silian_user['admin_notes']);
        $this->assertNotSame('TempPass#2026', $Silian_user['password']);
        $this->assertTrue(password_verify('TempPass#2026', (string) $Silian_user['password']));

        $Silian_auditCount = (int) $Silian_pdo->query("SELECT COUNT(*) FROM audit_logs WHERE action = 'user_created'")->fetchColumn();
        $this->assertSame(1, $Silian_auditCount);
    }

    public function testExecuteUpdateExchangeStatusUpdatesRowAndSendsNotifications(): void
    {
        $Silian_pdo = $this->makePdo();
        $Silian_auditLogService = new AuditLogService($Silian_pdo, new Logger('test'));

        $Silian_pdo->exec("INSERT INTO users (id, username, email, status, is_admin, uuid) VALUES (210, 'exchange_user', 'exchange@example.com', 'active', 0, '550e8400-e29b-41d4-a716-446655440210')");
        $Silian_pdo->exec("INSERT INTO point_exchanges (id, user_id, product_id, quantity, points_used, product_name, product_price, status, notes, tracking_number, updated_at)
            VALUES ('ex-1001', 210, 5, 2, 160, 'Eco Bottle', 80, 'processing', 'queued', null, '2026-03-23 08:00:00')");

        $Silian_messageService = $this->getMockBuilder(MessageService::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['sendMessage', 'sendExchangeStatusUpdateEmailToUser'])
            ->getMock();
        $Silian_messageService->expects($this->once())
            ->method('sendMessage')
            ->with(
                210,
                'exchange_status_updated',
                '您的兑换商品已发货',
                $this->stringContains('物流单号：SF-20260323'),
                'normal'
            );
        $Silian_messageService->expects($this->once())
            ->method('sendExchangeStatusUpdateEmailToUser')
            ->with(
                210,
                'Eco Bottle',
                'shipped',
                'SF-20260323',
                'warehouse packed',
                'exchange@example.com',
                'exchange_user'
            );

        $Silian_service = new AdminAiWriteActionService($Silian_pdo, $Silian_auditLogService, $Silian_messageService);
        $Silian_result = $Silian_service->execute('update_exchange_status', [
            'exchange_id' => 'ex-1001',
            'status' => 'shipped',
            'tracking_number' => 'SF-20260323',
            'notes' => 'warehouse packed',
        ], [
            'request_id' => 'req-write-service-exchange-1',
            'actor_id' => 1,
            'source' => '/admin/ai/chat',
        ]);

        $this->assertSame('update_exchange_status', $Silian_result['action']);
        $this->assertSame('shipped', $Silian_result['exchange']['status']);
        $this->assertSame('SF-20260323', $Silian_result['exchange']['tracking_number']);

        $Silian_exchange = $Silian_pdo->query("SELECT status, notes, tracking_number FROM point_exchanges WHERE id = 'ex-1001'")
            ->fetch(PDO::FETCH_ASSOC);
        $this->assertIsArray($Silian_exchange);
        $this->assertSame('shipped', $Silian_exchange['status']);
        $this->assertSame('warehouse packed', $Silian_exchange['notes']);
        $this->assertSame('SF-20260323', $Silian_exchange['tracking_number']);

        $Silian_auditCount = (int) $Silian_pdo->query("SELECT COUNT(*) FROM audit_logs WHERE action = 'exchange_status_updated'")->fetchColumn();
        $this->assertSame(1, $Silian_auditCount);
    }

    public function testExecuteApproveCarbonRecordsAwardsPointsSkipsNonPendingAndSendsSummary(): void
    {
        $Silian_pdo = $this->makePdo();
        $Silian_auditLogService = new AuditLogService($Silian_pdo, new Logger('test'));

        $Silian_activityId = '550e8400-e29b-41d4-a716-446655440301';
        $Silian_pdo->exec("INSERT INTO users (id, username, email, status, is_admin, points, uuid) VALUES
            (310, 'review_user', 'review@example.com', 'active', 0, 12, '550e8400-e29b-41d4-a716-446655440310')");
        $Silian_pdo->exec("INSERT INTO carbon_records (id, user_id, activity_id, status, date, carbon_saved, points_earned, created_at) VALUES
            ('rec-approve-1', 310, '{$Silian_activityId}', 'pending', '2026-03-22', 2.5, 6, '2026-03-22 08:00:00'),
            ('rec-approve-2', 310, '{$Silian_activityId}', 'approved', '2026-03-21', 1.1, 4, '2026-03-21 08:00:00')");

        $Silian_messageService = $this->getMockBuilder(MessageService::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['sendCarbonRecordReviewSummary'])
            ->getMock();
        $Silian_messageService->expects($this->once())
            ->method('sendCarbonRecordReviewSummary')
            ->with(
                310,
                'approve',
                $this->callback(function (array $Silian_records): bool {
                    return count($Silian_records) === 1
                        && ($Silian_records[0]['id'] ?? null) === 'rec-approve-1'
                        && ($Silian_records[0]['status'] ?? null) === 'approved';
                }),
                'batch approved',
                ['reviewed_by_id' => 1]
            );

        $Silian_service = new AdminAiWriteActionService($Silian_pdo, $Silian_auditLogService, $Silian_messageService);
        $Silian_result = $Silian_service->execute('approve_carbon_records', [
            'record_ids' => ['rec-approve-1', 'rec-approve-2'],
            'review_note' => 'batch approved',
        ], [
            'request_id' => 'req-write-service-review-1',
            'actor_id' => 1,
            'source' => '/admin/ai/chat',
        ]);

        $this->assertSame('approve', $Silian_result['action']);
        $this->assertSame(1, $Silian_result['processed_count']);
        $this->assertSame(['rec-approve-1'], $Silian_result['processed_ids']);
        $this->assertCount(1, $Silian_result['skipped']);
        $this->assertSame('rec-approve-2', $Silian_result['skipped'][0]['id']);

        $Silian_points = (int) $Silian_pdo->query("SELECT points FROM users WHERE id = 310")->fetchColumn();
        $this->assertSame(18, $Silian_points);
        $Silian_status = $Silian_pdo->query("SELECT status FROM carbon_records WHERE id = 'rec-approve-1'")->fetchColumn();
        $this->assertSame('approved', $Silian_status);

        $Silian_auditCount = (int) $Silian_pdo->query("SELECT COUNT(*) FROM audit_logs WHERE action = 'carbon_record_approve'")->fetchColumn();
        $this->assertSame(1, $Silian_auditCount);
    }
}
