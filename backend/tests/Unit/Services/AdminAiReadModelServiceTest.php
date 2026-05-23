<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\AdminAiReadModelService;
use CarbonTrack\Services\StatisticsService;
use CarbonTrack\Tests\Integration\TestSchemaBuilder;
use PHPUnit\Framework\TestCase;
use PDO;

class AdminAiReadModelServiceTest extends TestCase
{
    private function makePdo(): PDO
    {
        $Silian_pdo = new PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        TestSchemaBuilder::init($Silian_pdo);
        return $Silian_pdo;
    }

    public function testExecuteSearchUsersFiltersByRoleAndSearch(): void
    {
        $Silian_pdo = $this->makePdo();
        $Silian_pdo->exec("INSERT INTO users (id, uuid, username, email, status, is_admin, points) VALUES
            (101, '550e8400-e29b-41d4-a716-446655440111', 'admin_alpha', 'admin@example.com', 'active', 1, 42),
            (102, '550e8400-e29b-41d4-a716-446655440112', 'member_beta', 'member@example.com', 'active', 0, 7)");

        $Silian_service = new AdminAiReadModelService($Silian_pdo);
        $Silian_result = $Silian_service->execute('search_users', [
            'search' => 'admin',
            'role' => 'admin',
            'limit' => 10,
        ]);

        $this->assertSame('users', $Silian_result['scope']);
        $this->assertGreaterThanOrEqual(1, $Silian_result['total']);
        $this->assertContains('admin_alpha', array_column($Silian_result['items'], 'username'));
        $this->assertTrue(
            array_reduce(
                $Silian_result['items'],
                static fn (bool $Silian_carry, array $Silian_item): bool => $Silian_carry && !empty($Silian_item['is_admin']),
                true
            )
        );
    }

    public function testExecuteGenerateAdminReportBuildsNestedReadSummary(): void
    {
        $Silian_pdo = $this->makePdo();
        $Silian_activityId = '550e8400-e29b-41d4-a716-446655440201';
        $Silian_pdo->exec("INSERT INTO users (id, uuid, username, email, status, is_admin, points) VALUES
            (103, '550e8400-e29b-41d4-a716-446655440203', 'review_target', 'review@example.com', 'active', 0, 18)");
        $Silian_pdo->exec("INSERT INTO carbon_records (id, user_id, activity_id, status, date, carbon_saved, points_earned, created_at) VALUES
            ('rec-report-1', 103, '{$Silian_activityId}', 'pending', '2026-03-22', 2.5, 5, '2026-03-22 08:00:00')");
        $Silian_pdo->exec("INSERT INTO llm_logs (request_id, actor_type, actor_id, conversation_id, turn_no, source, model, prompt, response_raw, status, total_tokens, latency_ms, created_at)
            VALUES ('req-report-1', 'admin', 1, 'admin-ai-report-1', 1, '/admin/ai/chat', 'test-model', 'prompt', 'response', 'success', 321, 180, '2026-03-22 09:00:00')");

        $Silian_statisticsService = $this->createMock(StatisticsService::class);
        $Silian_statisticsService->expects($this->once())
            ->method('getAdminStats')
            ->with(false)
            ->willReturn([
                'pending_records' => 1,
                'active_users' => 12,
            ]);

        $Silian_service = new AdminAiReadModelService($Silian_pdo, $Silian_statisticsService);
        $Silian_report = $Silian_service->execute('generate_admin_report', ['days' => 30]);

        $this->assertSame('admin_report', $Silian_report['scope']);
        $this->assertSame(30, $Silian_report['days']);
        $this->assertSame(1, $Silian_report['stats']['pending_records']);
        $this->assertSame('llm_usage_analytics', $Silian_report['llm']['scope']);
        $this->assertSame(1, $Silian_report['llm']['total_calls']);
        $this->assertSame('pending_carbon_records', $Silian_report['pending']['scope']);
        $this->assertSame(1, $Silian_report['pending']['total']);
        $this->assertSame('rec-report-1', $Silian_report['pending']['items'][0]['id']);
    }

    public function testExecuteSearchUsersUsesDistinctBindings(): void
    {
        $Silian_pdo = $this->createMock(PDO::class);
        $Silian_listBound = [];
        $Silian_countBound = [];

        $Silian_listStmt = $this->createMock(\PDOStatement::class);
        $Silian_listStmt->expects($this->exactly(4))
            ->method('bindValue')
            ->willReturnCallback(function (string $Silian_key, $Silian_value, ?int $Silian_type = null) use (&$Silian_listBound) {
                $Silian_listBound[$Silian_key] = [$Silian_value, $Silian_type];
                return true;
            });
        $Silian_listStmt->expects($this->once())->method('execute')->willReturn(true);
        $Silian_listStmt->expects($this->once())->method('fetchAll')->willReturn([]);

        $Silian_countStmt = $this->createMock(\PDOStatement::class);
        $Silian_countStmt->expects($this->exactly(3))
            ->method('bindValue')
            ->willReturnCallback(function (string $Silian_key, $Silian_value, ?int $Silian_type = null) use (&$Silian_countBound) {
                $Silian_countBound[$Silian_key] = [$Silian_value, $Silian_type];
                return true;
            });
        $Silian_countStmt->expects($this->once())->method('execute')->willReturn(true);
        $Silian_countStmt->expects($this->once())->method('fetchColumn')->willReturn(0);

        $Silian_pdo->expects($this->exactly(2))
            ->method('prepare')
            ->willReturnCallback(function (string $Silian_sql) use ($Silian_listStmt, $Silian_countStmt) {
                static $Silian_prepareCalls = 0;
                $Silian_prepareCalls++;
                $this->assertStringContainsString('u.username LIKE :user_search_0', $Silian_sql);
                $this->assertStringContainsString('u.email LIKE :user_search_1', $Silian_sql);
                $this->assertStringContainsString('u.uuid LIKE :user_search_2', $Silian_sql);
                return $Silian_prepareCalls === 1 ? $Silian_listStmt : $Silian_countStmt;
            });

        $Silian_service = new AdminAiReadModelService($Silian_pdo);
        $Silian_result = $Silian_service->execute('search_users', [
            'search' => 'admin',
            'limit' => 10,
        ]);

        $this->assertSame('users', $Silian_result['scope']);
        $this->assertSame('%admin%', $Silian_listBound[':user_search_0'][0] ?? null);
        $this->assertSame('%admin%', $Silian_listBound[':user_search_1'][0] ?? null);
        $this->assertSame('%admin%', $Silian_listBound[':user_search_2'][0] ?? null);
        $this->assertSame(10, $Silian_listBound[':limit'][0] ?? null);
        $this->assertSame('%admin%', $Silian_countBound[':user_search_0'][0] ?? null);
    }

    public function testExecuteSearchSystemLogsUsesDistinctBindings(): void
    {
        $Silian_pdo = $this->createMock(PDO::class);
        $Silian_bound = [];

        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->expects($this->exactly(3))
            ->method('bindValue')
            ->willReturnCallback(function (string $Silian_key, $Silian_value, ?int $Silian_type = null) use (&$Silian_bound) {
                $Silian_bound[$Silian_key] = [$Silian_value, $Silian_type];
                return true;
            });
        $Silian_stmt->expects($this->once())->method('execute')->willReturn(true);
        $Silian_stmt->expects($this->once())->method('fetchAll')->willReturn([]);

        $Silian_pdo->expects($this->once())
            ->method('prepare')
            ->with($this->callback(static function (string $Silian_sql): bool {
                return str_contains($Silian_sql, 'LOWER(action) LIKE :audit_search_0')
                    && str_contains($Silian_sql, 'LOWER(COALESCE(data, \'\')) LIKE :audit_search_1')
                    && !str_contains($Silian_sql, 'LIKE :search');
            }))
            ->willReturn($Silian_stmt);

        $Silian_service = new AdminAiReadModelService($Silian_pdo);
        $Silian_result = $Silian_service->execute('search_system_logs', [
            'types' => ['audit'],
            'search' => 'trace',
            'limit' => 5,
        ]);

        $this->assertSame('system_logs', $Silian_result['scope']);
        $this->assertSame('%trace%', $Silian_bound[':audit_search_0'][0] ?? null);
        $this->assertSame('%trace%', $Silian_bound[':audit_search_1'][0] ?? null);
        $this->assertSame(5, $Silian_bound[':limit'][0] ?? null);
    }
}
