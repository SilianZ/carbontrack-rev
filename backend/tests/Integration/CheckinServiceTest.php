<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Integration;

use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\CheckinService;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use PHPUnit\Framework\TestCase;

class CheckinServiceTest extends TestCase
{
    private PDO $pdo;

    protected function setUp(): void
    {
        parent::setUp();
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        TestSchemaBuilder::init($this->pdo);
    }

    public function testStreakStatsAndDuplicateCheckins(): void
    {
        $Silian_service = new CheckinService($this->pdo, null, 'UTC');
        $Silian_userId = (int) $this->pdo->query("SELECT id FROM users LIMIT 1")->fetchColumn();

        $Silian_service->recordCheckinFromSubmission($Silian_userId, 'rec-1', new DateTimeImmutable('2026-01-01 10:00:00', new DateTimeZone('UTC')));
        $Silian_service->recordCheckinFromSubmission($Silian_userId, 'rec-2', new DateTimeImmutable('2026-01-02 10:00:00', new DateTimeZone('UTC')));
        $Silian_service->recordCheckinFromSubmission($Silian_userId, 'rec-3', new DateTimeImmutable('2026-01-02 20:00:00', new DateTimeZone('UTC')));
        $Silian_service->recordCheckinFromSubmission($Silian_userId, 'rec-4', new DateTimeImmutable('2026-01-04 10:00:00', new DateTimeZone('UTC')));

        $Silian_count = (int) $this->pdo->query("SELECT COUNT(*) FROM user_checkins WHERE user_id = {$Silian_userId}")->fetchColumn();
        $this->assertSame(3, $Silian_count);

        $Silian_stats = $Silian_service->getUserStreakStats($Silian_userId, new DateTimeImmutable('2026-01-04', new DateTimeZone('UTC')));
        $this->assertSame(1, $Silian_stats['current_streak']);
        $this->assertSame(2, $Silian_stats['longest_streak']);
        $this->assertSame('2026-01-04', $Silian_stats['last_checkin_date']);
    }

    public function testMakeupCheckin(): void
    {
        $Silian_service = new CheckinService($this->pdo, null, 'UTC');
        $Silian_userId = (int) $this->pdo->query("SELECT id FROM users LIMIT 1")->fetchColumn();

        $Silian_service->createMakeupCheckin($Silian_userId, '2026-01-03', 'manual', 'rec-20260103');

        $this->assertTrue($Silian_service->hasCheckin($Silian_userId, '2026-01-03'));
        $Silian_stats = $Silian_service->getUserStreakStats($Silian_userId, new DateTimeImmutable('2026-01-03', new DateTimeZone('UTC')));
        $this->assertSame(1, $Silian_stats['makeup_days']);
    }

    public function testSyncUserCheckinsLogsAuditWhenRowsInserted(): void
    {
        $Silian_userId = (int) $this->pdo->query("SELECT id FROM users LIMIT 1")->fetchColumn();
        $Silian_stmt = $this->pdo->prepare(
            'INSERT INTO carbon_records (id, user_id, activity_id, amount, unit, carbon_saved, points_earned, date, status, created_at, deleted_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NULL)'
        );
        $Silian_stmt->execute([
            'rec-sync-1',
            $Silian_userId,
            '550e8400-e29b-41d4-a716-446655440001',
            1,
            'times',
            0.019,
            1,
            '2026-01-05',
            'approved',
            '2026-01-05 08:00:00',
        ]);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('log')
            ->with($this->callback(function (array $Silian_payload) use ($Silian_userId): bool {
                return ($Silian_payload['action'] ?? null) === 'checkin_sync_completed'
                    && ($Silian_payload['operation_category'] ?? null) === 'checkin'
                    && ($Silian_payload['data']['user_id'] ?? null) === $Silian_userId
                    && ($Silian_payload['data']['synced_count'] ?? null) === 1;
            }))
            ->willReturn(true);

        $Silian_service = new CheckinService($this->pdo, null, 'UTC', $Silian_audit, null);

        $this->assertSame(1, $Silian_service->syncUserCheckinsFromRecords($Silian_userId));
    }
}
