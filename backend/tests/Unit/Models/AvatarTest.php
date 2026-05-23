<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Models;

use PHPUnit\Framework\TestCase;
use CarbonTrack\Models\Avatar;
use CarbonTrack\Services\ErrorLogService;
use Psr\Log\LoggerInterface;

class AvatarTest extends TestCase
{
    public function testGetAvailableAvatarsFiltersAndOrders(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_stmt->method('fetchAll')->willReturn([
            ['id'=>1,'category'=>'c1','is_default'=>0],
            ['id'=>2,'category'=>'c1','is_default'=>1]
        ]);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);
        $Silian_logger = $this->createMock(LoggerInterface::class);

        $Silian_model = new Avatar($Silian_pdo, $Silian_logger);
        $Silian_list = $Silian_model->getAvailableAvatars('c1');
        $this->assertCount(2, $Silian_list);
        $this->assertEquals('c1', $Silian_list[0]['category']);
    }

    public function testGetAvailableAvatarsCanIncludeInactive(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('execute')->with(['c1'])->willReturn(true);
        $Silian_stmt->method('fetchAll')->willReturn([
            ['id' => 1, 'category' => 'c1', 'is_active' => 1],
            ['id' => 2, 'category' => 'c1', 'is_active' => 0],
        ]);
        $Silian_pdo->expects($this->once())
            ->method('prepare')
            ->with($this->callback(function (string $Silian_sql): bool {
                $this->assertStringContainsString('WHERE deleted_at IS NULL', $Silian_sql);
                $this->assertStringNotContainsString('AND is_active = 1', $Silian_sql);
                return true;
            }))
            ->willReturn($Silian_stmt);
        $Silian_logger = $this->createMock(LoggerInterface::class);

        $Silian_model = new Avatar($Silian_pdo, $Silian_logger);
        $Silian_list = $Silian_model->getAvailableAvatars('c1', true);
        $this->assertCount(2, $Silian_list);
        $this->assertSame(0, $Silian_list[1]['is_active']);
    }

    public function testGetAvatarByIdReturnsNullWhenNotFound(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_stmt->method('fetch')->willReturn(false);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);
        $Silian_logger = $this->createMock(LoggerInterface::class);

        $Silian_model = new Avatar($Silian_pdo, $Silian_logger);
        $Silian_res = $Silian_model->getAvatarById(999);
        $this->assertNull($Silian_res);
    }

    public function testGetAvailableAvatarsLogsViaLoggerWhenErrorLogServiceFails(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('execute')->willThrowException(new \PDOException('db down'));
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);

        $Silian_errorLogService = $this->createMock(ErrorLogService::class);
        $Silian_errorLogService->method('logException')->willThrowException(new \RuntimeException('logger down'));

        $Silian_loggedMessages = [];
        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_logger->expects($this->exactly(2))
            ->method('error')
            ->willReturnCallback(function (string $Silian_message, array $Silian_context) use (&$Silian_loggedMessages): void {
                $this->assertIsArray($Silian_context);
                $Silian_loggedMessages[] = $Silian_message;
            });

        $Silian_model = new Avatar($Silian_pdo, $Silian_logger, $Silian_errorLogService);
        $Silian_list = $Silian_model->getAvailableAvatars('c1');

        $this->assertSame([], $Silian_list);
        $this->assertSame([
            'ErrorLogService logging failed for avatar model',
            'Avatar query failed: db down',
        ], $Silian_loggedMessages);
    }

    public function testCreateAvatarNormalizesEmptyStringNumericFields(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->expects($this->once())
            ->method('execute')
            ->with($this->callback(function (array $Silian_params): bool {
                $this->assertCount(9, $Silian_params);
                $this->assertIsString($Silian_params[0]);
                $this->assertSame('Demo Avatar', $Silian_params[1]);
                $this->assertSame('/avatars/demo.png', $Silian_params[3]);
                $this->assertSame(0, $Silian_params[6]);
                $this->assertSame(0, $Silian_params[7]);
                $this->assertSame(0, $Silian_params[8]);
                return true;
            }))
            ->willReturn(true);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);
        $Silian_pdo->method('lastInsertId')->willReturn('12');
        $Silian_logger = $this->createMock(LoggerInterface::class);

        $Silian_model = new Avatar($Silian_pdo, $Silian_logger);
        $Silian_avatarId = $Silian_model->createAvatar([
            'name' => 'Demo Avatar',
            'file_path' => '/avatars/demo.png',
            'sort_order' => '',
            'is_active' => '',
            'is_default' => '',
        ]);

        $this->assertSame(12, $Silian_avatarId);
    }

    public function testCreateAvatarClearsOtherDefaultsWhenNewAvatarIsDefault(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_resetStmt = $this->createMock(\PDOStatement::class);
        $Silian_insertStmt = $this->createMock(\PDOStatement::class);
        $Silian_prepareCalls = [];

        $Silian_pdo->expects($this->once())->method('beginTransaction')->willReturn(true);
        $Silian_pdo->expects($this->once())->method('commit')->willReturn(true);
        $Silian_pdo->expects($this->never())->method('rollBack');
        $Silian_pdo->expects($this->exactly(2))
            ->method('prepare')
            ->willReturnCallback(function (string $Silian_sql) use (&$Silian_prepareCalls, $Silian_resetStmt, $Silian_insertStmt) {
                $Silian_prepareCalls[] = $Silian_sql;
                return count($Silian_prepareCalls) === 1 ? $Silian_resetStmt : $Silian_insertStmt;
            });

        $Silian_resetStmt->expects($this->once())
            ->method('execute')
            ->with([])
            ->willReturn(true);

        $Silian_insertStmt->expects($this->once())
            ->method('execute')
            ->with($this->callback(function (array $Silian_params): bool {
                $this->assertSame(1, $Silian_params[8]);
                return true;
            }))
            ->willReturn(true);

        $Silian_pdo->method('lastInsertId')->willReturn('18');
        $Silian_logger = $this->createMock(LoggerInterface::class);

        $Silian_model = new Avatar($Silian_pdo, $Silian_logger);
        $Silian_avatarId = $Silian_model->createAvatar([
            'name' => 'Default Avatar',
            'file_path' => '/avatars/default.png',
            'is_default' => true,
        ]);

        $this->assertSame(18, $Silian_avatarId);
        $this->assertStringContainsString('SET is_default = 0', $Silian_prepareCalls[0]);
        $this->assertStringContainsString('AND is_default = 1', $Silian_prepareCalls[0]);
        $this->assertStringContainsString('INSERT INTO avatars', $Silian_prepareCalls[1]);
    }

    public function testUpdateAvatarNormalizesEmptyStringNumericFields(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->expects($this->once())
            ->method('execute')
            ->with([0, 0, 0, 7])
            ->willReturn(true);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);
        $Silian_logger = $this->createMock(LoggerInterface::class);

        $Silian_model = new Avatar($Silian_pdo, $Silian_logger);
        $Silian_result = $Silian_model->updateAvatar(7, [
            'sort_order' => '',
            'is_active' => '',
            'is_default' => '',
        ]);

        $this->assertTrue($Silian_result);
    }

    public function testUpdateAvatarClearsOtherDefaultsWhenAvatarBecomesDefault(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_resetStmt = $this->createMock(\PDOStatement::class);
        $Silian_updateStmt = $this->createMock(\PDOStatement::class);
        $Silian_prepareCalls = [];

        $Silian_pdo->expects($this->once())->method('beginTransaction')->willReturn(true);
        $Silian_pdo->expects($this->once())->method('commit')->willReturn(true);
        $Silian_pdo->expects($this->never())->method('rollBack');
        $Silian_pdo->expects($this->exactly(2))
            ->method('prepare')
            ->willReturnCallback(function (string $Silian_sql) use (&$Silian_prepareCalls, $Silian_resetStmt, $Silian_updateStmt) {
                $Silian_prepareCalls[] = $Silian_sql;
                return count($Silian_prepareCalls) === 1 ? $Silian_resetStmt : $Silian_updateStmt;
            });

        $Silian_resetStmt->expects($this->once())
            ->method('execute')
            ->with([7])
            ->willReturn(true);

        $Silian_updateStmt->expects($this->once())
            ->method('execute')
            ->with([1, 7])
            ->willReturn(true);

        $Silian_logger = $this->createMock(LoggerInterface::class);

        $Silian_model = new Avatar($Silian_pdo, $Silian_logger);
        $Silian_result = $Silian_model->updateAvatar(7, [
            'is_default' => true,
        ]);

        $this->assertTrue($Silian_result);
        $this->assertStringContainsString('AND id <> ?', $Silian_prepareCalls[0]);
        $this->assertStringContainsString('AND is_default = 1', $Silian_prepareCalls[0]);
        $this->assertStringContainsString('SET is_default = ?', $Silian_prepareCalls[1]);
    }

    public function testGetUsersAssignedToAvatarReturnsRecipients(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->expects($this->once())
            ->method('execute')
            ->with([5])
            ->willReturn(true);
        $Silian_stmt->method('fetchAll')->willReturn([
            ['id' => 101, 'username' => 'alice', 'email' => 'alice@example.com'],
            ['id' => 202, 'username' => 'bob', 'email' => 'bob@example.com'],
        ]);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);
        $Silian_logger = $this->createMock(LoggerInterface::class);

        $Silian_model = new Avatar($Silian_pdo, $Silian_logger);
        $Silian_users = $Silian_model->getUsersAssignedToAvatar(5);

        $this->assertCount(2, $Silian_users);
        $this->assertSame('alice@example.com', $Silian_users[0]['email']);
    }

    public function testUpdateAvatarAndReassignUsersWrapsAvatarAndUserUpdatesInTransaction(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_userSelectStmt = $this->createMock(\PDOStatement::class);
        $Silian_fallbackSelectStmt = $this->createMock(\PDOStatement::class);
        $Silian_avatarStmt = $this->createMock(\PDOStatement::class);
        $Silian_userUpdateStmt = $this->createMock(\PDOStatement::class);
        $Silian_prepareCalls = [];

        $Silian_pdo->method('getAttribute')->with(\PDO::ATTR_DRIVER_NAME)->willReturn('mysql');
        $Silian_pdo->expects($this->once())->method('beginTransaction')->willReturn(true);
        $Silian_pdo->expects($this->once())->method('commit')->willReturn(true);
        $Silian_pdo->expects($this->never())->method('rollBack');
        $Silian_pdo->expects($this->exactly(4))
            ->method('prepare')
            ->willReturnCallback(function (string $Silian_sql) use (&$Silian_prepareCalls, $Silian_userSelectStmt, $Silian_fallbackSelectStmt, $Silian_avatarStmt, $Silian_userUpdateStmt) {
                $Silian_prepareCalls[] = $Silian_sql;
                return match (count($Silian_prepareCalls)) {
                    1 => $Silian_userSelectStmt,
                    2 => $Silian_fallbackSelectStmt,
                    3 => $Silian_avatarStmt,
                    default => $Silian_userUpdateStmt,
                };
            });

        $Silian_userSelectStmt->expects($this->once())
            ->method('execute')
            ->with([7])
            ->willReturn(true);
        $Silian_userSelectStmt->expects($this->once())
            ->method('fetchAll')
            ->with(\PDO::FETCH_ASSOC)
            ->willReturn([
                ['id' => 101, 'username' => 'alice', 'email' => 'alice@example.com'],
                ['id' => 202, 'username' => 'bob', 'email' => 'bob@example.com'],
            ]);

        $Silian_fallbackSelectStmt->expects($this->once())
            ->method('execute')
            ->with([7, 1])
            ->willReturn(true);
        $Silian_fallbackSelectStmt->expects($this->once())
            ->method('fetch')
            ->with(\PDO::FETCH_ASSOC)
            ->willReturn([
                'id' => 1,
                'name' => 'Default Seedling',
                'is_default' => 1,
                'is_active' => 1,
            ]);

        $Silian_avatarStmt->expects($this->once())
            ->method('execute')
            ->with([0, 7])
            ->willReturn(true);

        $Silian_userUpdateStmt->expects($this->once())
            ->method('execute')
            ->with([1, 7])
            ->willReturn(true);
        $Silian_userUpdateStmt->method('rowCount')->willReturn(2);

        $Silian_logger = $this->createMock(LoggerInterface::class);

        $Silian_model = new Avatar($Silian_pdo, $Silian_logger);
        $Silian_reassigned = $Silian_model->updateAvatarAndReassignUsers(7, ['is_active' => false], 1);

        $this->assertSame(2, $Silian_reassigned['reassigned_user_count']);
        $this->assertSame([101, 202], array_column($Silian_reassigned['users'], 'id'));
        $this->assertSame(1, $Silian_reassigned['fallback_avatar']['id']);
        $this->assertStringContainsString('FOR UPDATE', $Silian_prepareCalls[0]);
        $this->assertStringContainsString('is_default = 1', $Silian_prepareCalls[1]);
        $this->assertStringContainsString('FOR UPDATE', $Silian_prepareCalls[1]);
        $this->assertStringContainsString('UPDATE avatars SET is_active = ?', $Silian_prepareCalls[2]);
        $this->assertStringContainsString('UPDATE users', $Silian_prepareCalls[3]);
    }

    public function testUpdateAvatarAndReassignUsersOmitsRowLocksForSqlite(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_userSelectStmt = $this->createMock(\PDOStatement::class);
        $Silian_fallbackSelectStmt = $this->createMock(\PDOStatement::class);
        $Silian_avatarStmt = $this->createMock(\PDOStatement::class);
        $Silian_userUpdateStmt = $this->createMock(\PDOStatement::class);
        $Silian_prepareCalls = [];

        $Silian_pdo->method('getAttribute')->with(\PDO::ATTR_DRIVER_NAME)->willReturn('sqlite');
        $Silian_pdo->expects($this->once())->method('beginTransaction')->willReturn(true);
        $Silian_pdo->expects($this->once())->method('commit')->willReturn(true);
        $Silian_pdo->expects($this->never())->method('rollBack');
        $Silian_pdo->expects($this->exactly(4))
            ->method('prepare')
            ->willReturnCallback(function (string $Silian_sql) use (&$Silian_prepareCalls, $Silian_userSelectStmt, $Silian_fallbackSelectStmt, $Silian_avatarStmt, $Silian_userUpdateStmt) {
                $Silian_prepareCalls[] = $Silian_sql;
                return match (count($Silian_prepareCalls)) {
                    1 => $Silian_userSelectStmt,
                    2 => $Silian_fallbackSelectStmt,
                    3 => $Silian_avatarStmt,
                    default => $Silian_userUpdateStmt,
                };
            });

        $Silian_userSelectStmt->expects($this->once())
            ->method('execute')
            ->with([7])
            ->willReturn(true);
        $Silian_userSelectStmt->expects($this->once())
            ->method('fetchAll')
            ->with(\PDO::FETCH_ASSOC)
            ->willReturn([
                ['id' => 101, 'username' => 'alice', 'email' => 'alice@example.com'],
            ]);

        $Silian_fallbackSelectStmt->expects($this->once())
            ->method('execute')
            ->with([7, 1])
            ->willReturn(true);
        $Silian_fallbackSelectStmt->expects($this->once())
            ->method('fetch')
            ->with(\PDO::FETCH_ASSOC)
            ->willReturn([
                'id' => 1,
                'name' => 'Default Seedling',
                'is_default' => 1,
                'is_active' => 1,
            ]);

        $Silian_avatarStmt->expects($this->once())
            ->method('execute')
            ->with([0, 7])
            ->willReturn(true);

        $Silian_userUpdateStmt->expects($this->once())
            ->method('execute')
            ->with([1, 7])
            ->willReturn(true);
        $Silian_userUpdateStmt->method('rowCount')->willReturn(1);

        $Silian_logger = $this->createMock(LoggerInterface::class);

        $Silian_model = new Avatar($Silian_pdo, $Silian_logger);
        $Silian_reassigned = $Silian_model->updateAvatarAndReassignUsers(7, ['is_active' => false], 1);

        $this->assertSame(1, $Silian_reassigned['reassigned_user_count']);
        $this->assertStringNotContainsString('FOR UPDATE', $Silian_prepareCalls[0]);
        $this->assertStringNotContainsString('FOR UPDATE', $Silian_prepareCalls[1]);
    }

    public function testUpdateAvatarAndReassignUsersRequiresFallbackWhenUsersAreAssigned(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_userSelectStmt = $this->createMock(\PDOStatement::class);
        $Silian_fallbackSelectStmt = $this->createMock(\PDOStatement::class);

        $Silian_pdo->expects($this->once())->method('beginTransaction')->willReturn(true);
        $Silian_pdo->expects($this->never())->method('commit');
        $Silian_pdo->expects($this->once())->method('rollBack')->willReturn(true);
        $Silian_prepareCalls = [];
        $Silian_pdo->expects($this->exactly(2))
            ->method('prepare')
            ->willReturnCallback(function (string $Silian_sql) use (&$Silian_prepareCalls, $Silian_userSelectStmt, $Silian_fallbackSelectStmt) {
                $Silian_prepareCalls[] = $Silian_sql;
                return count($Silian_prepareCalls) === 1 ? $Silian_userSelectStmt : $Silian_fallbackSelectStmt;
            });

        $Silian_userSelectStmt->expects($this->once())
            ->method('execute')
            ->with([7])
            ->willReturn(true);
        $Silian_userSelectStmt->expects($this->once())
            ->method('fetchAll')
            ->with(\PDO::FETCH_ASSOC)
            ->willReturn([
                ['id' => 101, 'username' => 'alice', 'email' => 'alice@example.com'],
            ]);
        $Silian_fallbackSelectStmt->expects($this->once())
            ->method('execute')
            ->with([7])
            ->willReturn(true);
        $Silian_fallbackSelectStmt->expects($this->once())
            ->method('fetch')
            ->with(\PDO::FETCH_ASSOC)
            ->willReturn(false);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_model = new Avatar($Silian_pdo, $Silian_logger);

        $this->expectException(\CarbonTrack\Models\AvatarFallbackUnavailableException::class);

        $Silian_model->updateAvatarAndReassignUsers(7, ['is_active' => false], null);
    }

    public function testUpdateAvatarAndReassignUsersRejectsStaleFallbackAvatarInsideTransaction(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_userSelectStmt = $this->createMock(\PDOStatement::class);
        $Silian_fallbackSelectStmt = $this->createMock(\PDOStatement::class);
        $Silian_prepareCalls = [];

        $Silian_pdo->expects($this->once())->method('beginTransaction')->willReturn(true);
        $Silian_pdo->expects($this->never())->method('commit');
        $Silian_pdo->expects($this->once())->method('rollBack')->willReturn(true);
        $Silian_pdo->expects($this->exactly(2))
            ->method('prepare')
            ->willReturnCallback(function (string $Silian_sql) use (&$Silian_prepareCalls, $Silian_userSelectStmt, $Silian_fallbackSelectStmt) {
                $Silian_prepareCalls[] = $Silian_sql;
                return count($Silian_prepareCalls) === 1 ? $Silian_userSelectStmt : $Silian_fallbackSelectStmt;
            });

        $Silian_userSelectStmt->expects($this->once())
            ->method('execute')
            ->with([7])
            ->willReturn(true);
        $Silian_userSelectStmt->expects($this->once())
            ->method('fetchAll')
            ->with(\PDO::FETCH_ASSOC)
            ->willReturn([
                ['id' => 101, 'username' => 'alice', 'email' => 'alice@example.com'],
            ]);

        $Silian_fallbackSelectStmt->expects($this->once())
            ->method('execute')
            ->with([7, 1])
            ->willReturn(true);
        $Silian_fallbackSelectStmt->expects($this->once())
            ->method('fetch')
            ->with(\PDO::FETCH_ASSOC)
            ->willReturn(false);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_model = new Avatar($Silian_pdo, $Silian_logger);

        $this->expectException(\CarbonTrack\Models\AvatarFallbackUnavailableException::class);

        $Silian_model->updateAvatarAndReassignUsers(7, ['is_active' => false], 1);
    }

    public function testCreateAvatarRejectsInvalidNonEmptyNumericStrings(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_logger = $this->createMock(LoggerInterface::class);

        $Silian_model = new Avatar($Silian_pdo, $Silian_logger);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('sort_order must be an integer');

        $Silian_model->createAvatar([
            'name' => 'Demo Avatar',
            'file_path' => '/avatars/demo.png',
            'sort_order' => 'abc',
        ]);
    }
}


