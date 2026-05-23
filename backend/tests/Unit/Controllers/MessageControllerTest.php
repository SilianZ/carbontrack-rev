<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use PHPUnit\Framework\TestCase;
use CarbonTrack\Controllers\MessageController;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\MessageService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\EmailService;
use CarbonTrack\Services\RegionService;
use CarbonTrack\Services\UserProfileViewService;
use CarbonTrack\Models\Message;

class MessageControllerTest extends TestCase
{
    private function makeUserProfileViewService(?RegionService $Silian_regionService = null): UserProfileViewService
    {
        return new UserProfileViewService($Silian_regionService ?? new RegionService(null, null, null, null));
    }

    private function makeController(
        \PDO $Silian_pdo,
        MessageService $Silian_svc,
        AuditLogService $Silian_audit,
        AuthService $Silian_auth,
        ?EmailService $Silian_emailService = null,
        ?UserProfileViewService $Silian_userProfileViewService = null
    ): MessageController {
        return new MessageController(
            $Silian_pdo,
            $Silian_svc,
            $Silian_audit,
            $Silian_auth,
            $Silian_userProfileViewService ?? $this->makeUserProfileViewService(),
            $Silian_emailService,
            null
        );
    }

    public function testControllerClassExists(): void
    {
        $this->assertTrue(class_exists(MessageController::class));
    }

    public function testGetUserMessagesReturnsPaged(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1]);

        $Silian_countStmt = $this->createMock(\PDOStatement::class);
        $Silian_countStmt->method('execute')->willReturn(true);
        $Silian_countStmt->method('fetch')->willReturn(['total' => 2]);

        $Silian_listStmt = $this->createMock(\PDOStatement::class);
        $Silian_listStmt->method('bindValue')->willReturn(true);
        $Silian_listStmt->method('execute')->willReturn(true);
        $Silian_listStmt->method('fetchAll')->willReturn([
            ['id'=>1,'title'=>'t1','content'=>'c1','read_at'=>null],
            ['id'=>2,'title'=>'t2','content'=>'c2','read_at'=>'2025-01-01']
        ]);

        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_countStmt, $Silian_listStmt);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/messages');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getUserMessages($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(2, $Silian_json['pagination']['total']);
        $this->assertFalse($Silian_json['data'][0]['is_read']);
    }

    public function testGetUserMessagesUsesDistinctSearchBindings(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1]);
        $Silian_listBound = [];

        $Silian_countStmt = $this->createMock(\PDOStatement::class);
        $Silian_countStmt->expects($this->once())
            ->method('execute')
            ->with([
                'user_id' => 1,
                'search_title' => '%eco%',
                'search_content' => '%eco%',
            ])
            ->willReturn(true);
        $Silian_countStmt->expects($this->once())->method('fetch')->willReturn(['total' => 0]);

        $Silian_listStmt = $this->createMock(\PDOStatement::class);
        $Silian_listStmt->expects($this->exactly(5))
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
                $this->assertStringContainsString('m.title LIKE :search_title', $Silian_sql);
                $this->assertStringContainsString('m.content LIKE :search_content', $Silian_sql);
                return $Silian_prepareCalls === 1 ? $Silian_countStmt : $Silian_listStmt;
            });

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/messages', null, ['search' => 'eco']);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->getUserMessages($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $this->assertSame(1, $Silian_listBound['user_id'][0] ?? null);
        $this->assertSame('%eco%', $Silian_listBound['search_title'][0] ?? null);
        $this->assertSame('%eco%', $Silian_listBound['search_content'][0] ?? null);
        $this->assertSame(20, $Silian_listBound['limit'][0] ?? null);
        $this->assertSame(0, $Silian_listBound['offset'][0] ?? null);
    }

    public function testGetMessageDetailMarksRead(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 9]);

        // select message
        $Silian_select = $this->createMock(\PDOStatement::class);
        $Silian_select->method('execute')->willReturn(true);
        $Silian_select->method('fetch')->willReturn([
            'id' => 100, 'is_read' => false
        ]);
        // update read_at
        $Silian_update = $this->createMock(\PDOStatement::class);
        $Silian_update->method('execute')->willReturn(true);

        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_select, $Silian_update);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/messages/100');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getMessageDetail($Silian_request, $Silian_response, ['id'=>100]);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(100, $Silian_json['data']['id']);
    }

    public function testGetUnreadCount(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 3]);

        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_stmt->method('fetch')->willReturn([
            'total_unread'=>7,'urgent_unread'=>1,'high_unread'=>2,'system_unread'=>3,'notification_unread'=>4
        ]);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/messages/unread-count');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getUnreadCount($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(7, $Silian_json['data']['total_unread']);
    }

    public function testMarkAllAsReadMarksWhenEmptyIds(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 10]);

        $Silian_updateStmt = $this->createMock(\PDOStatement::class);
        $Silian_updateStmt->method('execute')->willReturn(true);
        $Silian_updateStmt->method('rowCount')->willReturn(5);
        $Silian_pdo->method('prepare')->willReturn($Silian_updateStmt);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('PUT', '/messages/mark-all-read', []);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->markAllAsRead($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(5, $Silian_json['affected_rows']);
    }

    public function testMarkAllAsReadWithIds(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 10]);

        $Silian_updateStmt = $this->createMock(\PDOStatement::class);
        $Silian_updateStmt->method('execute')->willReturn(true);
        $Silian_updateStmt->method('rowCount')->willReturn(2);
        $Silian_pdo->method('prepare')->willReturn($Silian_updateStmt);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('PUT', '/messages/mark-all-read', ['message_ids' => [1,2]]);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->markAllAsRead($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(2, $Silian_json['affected_rows']);
    }

    public function testMarkAsReadNotOwnedReturns404(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 20]);

        $Silian_select = $this->createMock(\PDOStatement::class);
        $Silian_select->method('execute')->willReturn(true);
        $Silian_select->method('fetch')->willReturn(false);
        $Silian_pdo->method('prepare')->willReturn($Silian_select);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('PUT', '/messages/9/read');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->markAsRead($Silian_request, $Silian_response, ['id' => 9]);
        $this->assertEquals(404, $Silian_resp->getStatusCode());
    }

    public function testMarkAsReadSuccess(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 21]);

        $Silian_select = $this->createMock(\PDOStatement::class);
        $Silian_select->method('execute')->willReturn(true);
        $Silian_select->method('fetch')->willReturn(['id' => 300]);

        $Silian_update = $this->createMock(\PDOStatement::class);
        $Silian_update->method('execute')->willReturn(true);

        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_select, $Silian_update);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('PUT', '/messages/300/read');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->markAsRead($Silian_request, $Silian_response, ['id' => 300]);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
    }

    public function testDeleteMessageNotOwned(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 22]);

        $Silian_select = $this->createMock(\PDOStatement::class);
        $Silian_select->method('execute')->willReturn(true);
        $Silian_select->method('fetch')->willReturn(false);
        $Silian_pdo->method('prepare')->willReturn($Silian_select);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('DELETE', '/messages/12');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->deleteMessage($Silian_request, $Silian_response, ['id' => 12]);
        $this->assertEquals(404, $Silian_resp->getStatusCode());
    }

    public function testDeleteMessageSuccess(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 23]);

        $Silian_select = $this->createMock(\PDOStatement::class);
        $Silian_select->method('execute')->willReturn(true);
        $Silian_select->method('fetch')->willReturn(['id' => 77]);

        $Silian_update = $this->createMock(\PDOStatement::class);
        $Silian_update->method('execute')->willReturn(true);

        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_select, $Silian_update);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('DELETE', '/messages/77');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->deleteMessage($Silian_request, $Silian_response, ['id' => 77]);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
    }

    public function testGetMessageStatsAggregates(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 30]);

        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_stmt->method('fetchAll')->willReturn([
            ['type' => 'system', 'priority' => 'high', 'count' => 2, 'unread_count' => 1],
            ['type' => 'notification', 'priority' => 'low', 'count' => 3, 'unread_count' => 0],
        ]);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/messages/stats');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getMessageStats($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(5, $Silian_json['data']['by_type']['system']['total'] + $Silian_json['data']['by_type']['notification']['total']);
    }

    public function testBroadcastRequiresAdmin(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 5, 'is_admin' => false]);
        $Silian_auth->method('isAdminUser')->willReturn(false);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('POST', '/admin/messages/broadcast', ['title' => 'Hello', 'content' => 'World']);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->sendSystemMessage($Silian_request, $Silian_response);
        $this->assertEquals(403, $Silian_resp->getStatusCode());
    }

    public function testBroadcastValidatesPriority(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 6, 'is_admin' => true]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('POST', '/admin/messages/broadcast', [
            'title' => 'Test',
            'content' => 'Payload',
            'priority' => 'unknown-level'
        ]);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->sendSystemMessage($Silian_request, $Silian_response);
        $this->assertEquals(422, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertSame('Invalid priority value', $Silian_json['error']);
    }

    public function testBroadcastSendsMessagesAndReportsInvalidIds(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

        $Silian_pdo->exec('CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            username TEXT,
            email TEXT,
            school_id INTEGER,
            region_code TEXT,
            is_admin INTEGER,
            status TEXT,
            deleted_at TEXT
        )');
        $Silian_pdo->exec('CREATE TABLE schools (
            id INTEGER PRIMARY KEY,
            name TEXT
        )');

        $Silian_pdo->exec('CREATE TABLE system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT
        )');

        $Silian_pdo->exec('CREATE TABLE message_broadcasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT,
            audit_log_id INTEGER,
            system_log_id INTEGER,
            error_log_ids TEXT,
            title TEXT,
            content TEXT,
            priority TEXT,
            scope TEXT,
            target_count INTEGER,
            sent_count INTEGER,
            invalid_user_ids TEXT,
            failed_user_ids TEXT,
            message_ids_snapshot TEXT,
            message_map_snapshot TEXT,
            message_id_count INTEGER,
            content_hash TEXT,
            email_delivery_snapshot TEXT,
            filters_snapshot TEXT,
            meta TEXT,
            created_by INTEGER,
            created_at TEXT,
            updated_at TEXT
        )');

        $Silian_insertUser = $Silian_pdo->prepare('INSERT INTO users (id, username, email, is_admin, status, deleted_at) VALUES (?,?,?,?,?,?)');
        $Silian_insertUser->execute([1, 'User One', 'one@example.com', 0, 'active', null]);
        $Silian_insertUser->execute([3, 'User Three', 'three@example.com', 0, 'active', null]);

        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 42, 'is_admin' => true]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_svc->expects($this->exactly(2))
            ->method('sendSystemMessage')
            ->withConsecutive(
                [1, 'Announcement', 'Broadcast body', Message::TYPE_SYSTEM, 'high'],
                [3, 'Announcement', 'Broadcast body', Message::TYPE_SYSTEM, 'high']
            )
            ->willReturnOnConsecutiveCalls(
                $this->createMock(Message::class),
                $this->createMock(Message::class)
            );

        $Silian_svc->expects($this->once())
            ->method('queueBroadcastEmail')
            ->willReturn(['error' => 'Email service unavailable']);

        $Silian_audit->expects($this->once())->method('log');

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('POST', '/admin/messages/broadcast', [
            'title' => 'Announcement',
            'content' => 'Broadcast body',
            'priority' => 'high',
            'target_users' => [1, 2, 3]
        ]);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->sendSystemMessage($Silian_request, $Silian_response);

        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertSame(2, $Silian_json['sent_count']);
        $this->assertSame(2, $Silian_json['total_targets']);
        $this->assertSame([2], $Silian_json['invalid_user_ids']);
        $this->assertSame('custom', $Silian_json['scope']);
        $this->assertSame('high', $Silian_json['priority']);
        $this->assertFalse($Silian_json['email_delivery']['triggered']);
        $this->assertSame('failed', $Silian_json['email_delivery']['status']);
        $this->assertContains('Email service unavailable', $Silian_json['email_delivery']['errors']);
    }


    public function testHighPriorityBroadcastTriggersEmailBcc(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

        $Silian_pdo->exec('CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            username TEXT,
            email TEXT,
            school_id INTEGER,
            region_code TEXT,
            is_admin INTEGER,
            status TEXT,
            deleted_at TEXT
        )');
        $Silian_pdo->exec('CREATE TABLE schools (
            id INTEGER PRIMARY KEY,
            name TEXT
        )');

        $Silian_pdo->exec('CREATE TABLE system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT
        )');

        $Silian_pdo->exec('CREATE TABLE message_broadcasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT,
            audit_log_id INTEGER,
            system_log_id INTEGER,
            error_log_ids TEXT,
            title TEXT,
            content TEXT,
            priority TEXT,
            scope TEXT,
            target_count INTEGER,
            sent_count INTEGER,
            invalid_user_ids TEXT,
            failed_user_ids TEXT,
            message_ids_snapshot TEXT,
            message_map_snapshot TEXT,
            message_id_count INTEGER,
            content_hash TEXT,
            email_delivery_snapshot TEXT,
            filters_snapshot TEXT,
            meta TEXT,
            created_by INTEGER,
            created_at TEXT,
            updated_at TEXT
        )');

        $Silian_pdo->prepare('INSERT INTO users (id, username, email, is_admin, status, deleted_at) VALUES (?,?,?,?,?,?)')
            ->execute([5, 'User Five', 'user@example.com', 0, 'active', null]);

        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 7, 'is_admin' => true]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_svc->expects($this->once())
            ->method('sendSystemMessage')
            ->with(5, 'Alert', 'System high priority', Message::TYPE_SYSTEM, 'urgent')
            ->willReturn($this->createMock(Message::class));

        $Silian_svc->expects($this->once())
            ->method('queueBroadcastEmail')
            ->willReturn(['queued' => true]);

        $Silian_audit->expects($this->once())->method('log');

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('POST', '/admin/messages/broadcast', [
            'title' => 'Alert',
            'content' => 'System high priority',
            'priority' => 'urgent',
            'target_users' => [5]
        ]);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->sendSystemMessage($Silian_request, $Silian_response);

        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertTrue($Silian_json['email_delivery']['triggered']);
        $this->assertSame(1, $Silian_json['email_delivery']['attempted_recipients']);
        $this->assertSame(0, $Silian_json['email_delivery']['successful_chunks']);
        $this->assertSame([], $Silian_json['email_delivery']['failed_recipient_ids']);
        $this->assertSame('queued', $Silian_json['email_delivery']['status']);
        $this->assertSame([], $Silian_json['email_delivery']['errors']);
    }

    public function testBroadcastSupportsHtmlContentFormatMetadata(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

        $Silian_pdo->exec('CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            username TEXT,
            email TEXT,
            school_id INTEGER,
            region_code TEXT,
            is_admin INTEGER,
            status TEXT,
            deleted_at TEXT
        )');
        $Silian_pdo->exec('CREATE TABLE schools (
            id INTEGER PRIMARY KEY,
            name TEXT
        )');

        $Silian_pdo->exec('CREATE TABLE system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT
        )');

        $Silian_pdo->exec('CREATE TABLE message_broadcasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT,
            audit_log_id INTEGER,
            system_log_id INTEGER,
            error_log_ids TEXT,
            title TEXT,
            content TEXT,
            priority TEXT,
            scope TEXT,
            target_count INTEGER,
            sent_count INTEGER,
            invalid_user_ids TEXT,
            failed_user_ids TEXT,
            message_ids_snapshot TEXT,
            message_map_snapshot TEXT,
            message_id_count INTEGER,
            content_hash TEXT,
            email_delivery_snapshot TEXT,
            filters_snapshot TEXT,
            meta TEXT,
            created_by INTEGER,
            created_at TEXT,
            updated_at TEXT
        )');

        $Silian_pdo->prepare('INSERT INTO users (id, username, email, is_admin, status, deleted_at) VALUES (?,?,?,?,?,?)')
            ->execute([5, 'User Five', 'user@example.com', 0, 'active', null]);

        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 7, 'is_admin' => true]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_svc->expects($this->once())
            ->method('sendSystemMessage')
            ->with(
                5,
                'Alert',
                $this->callback(static function (string $Silian_content): bool {
                    return str_contains($Silian_content, '<h1>Headline</h1>')
                        && str_contains($Silian_content, '<p>Body</p>')
                        && !str_contains($Silian_content, '<script');
                }),
                Message::TYPE_SYSTEM,
                'high'
            )
            ->willReturn($this->createMock(Message::class));

        $Silian_svc->expects($this->once())
            ->method('queueBroadcastEmail')
            ->with(
                $this->anything(),
                'Alert',
                $this->callback(static fn (string $Silian_content): bool => !str_contains($Silian_content, '<script')),
                'high',
                $this->callback(static function (array $Silian_context): bool {
                    return ($Silian_context['content_format'] ?? null) === 'html'
                        && ($Silian_context['render_profile'] ?? null) === 'announcement_html_v1'
                        && ($Silian_context['render_version'] ?? null) === 1
                        && ($Silian_context['source_kind'] ?? null) === 'admin_broadcast';
                })
            )
            ->willReturn(['queued' => true, 'recipient_count' => 1]);

        $Silian_audit->expects($this->once())->method('log');

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('POST', '/admin/messages/broadcast', [
            'title' => 'Alert',
            'content' => '<h1>Headline</h1><script>alert(1)</script><p>Body</p>',
            'content_format' => 'html',
            'render_profile' => 'announcement_html_v1',
            'priority' => 'high',
            'target_users' => [5]
        ]);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->sendSystemMessage($Silian_request, $Silian_response);

        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertSame('html', $Silian_json['content_format']);
        $this->assertSame('announcement_html_v1', $Silian_json['render_profile']);
        $this->assertSame(1, $Silian_json['render_version']);
        $this->assertSame('admin_broadcast', $Silian_json['source_kind']);

        $Silian_metaRow = $Silian_pdo->query('SELECT meta FROM message_broadcasts ORDER BY id DESC LIMIT 1')->fetchColumn();
        $this->assertNotFalse($Silian_metaRow);
        $Silian_meta = json_decode((string)$Silian_metaRow, true);
        $this->assertSame('html', $Silian_meta['content_format']);
        $this->assertSame('announcement_html_v1', $Silian_meta['render_profile']);
        $this->assertSame(1, $Silian_meta['render_version']);
        $this->assertSame('admin_broadcast', $Silian_meta['source_kind']);
    }

    public function testBroadcastSanitizerRemovesBlockedTagsNestedInsideUnsupportedWrappers(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

        $Silian_pdo->exec('CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            username TEXT,
            email TEXT,
            school_id INTEGER,
            region_code TEXT,
            is_admin INTEGER,
            status TEXT,
            deleted_at TEXT
        )');
        $Silian_pdo->exec('CREATE TABLE schools (
            id INTEGER PRIMARY KEY,
            name TEXT
        )');

        $Silian_pdo->exec('CREATE TABLE system_logs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT
        )');

        $Silian_pdo->exec('CREATE TABLE message_broadcasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT,
            audit_log_id INTEGER,
            system_log_id INTEGER,
            error_log_ids TEXT,
            title TEXT,
            content TEXT,
            priority TEXT,
            scope TEXT,
            target_count INTEGER,
            sent_count INTEGER,
            invalid_user_ids TEXT,
            failed_user_ids TEXT,
            message_ids_snapshot TEXT,
            message_map_snapshot TEXT,
            message_id_count INTEGER,
            content_hash TEXT,
            email_delivery_snapshot TEXT,
            filters_snapshot TEXT,
            meta TEXT,
            created_by INTEGER,
            created_at TEXT,
            updated_at TEXT
        )');

        $Silian_pdo->prepare('INSERT INTO users (id, username, email, is_admin, status, deleted_at) VALUES (?,?,?,?,?,?)')
            ->execute([5, 'User Five', 'user@example.com', 0, 'active', null]);

        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 7, 'is_admin' => true]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_svc->expects($this->once())
            ->method('sendSystemMessage')
            ->with(
                5,
                'Alert',
                $this->callback(static function (string $Silian_content): bool {
                    return str_contains($Silian_content, '<p>Safe body</p>')
                        && !str_contains($Silian_content, '<script')
                        && !str_contains($Silian_content, 'alert(1)')
                        && !str_contains($Silian_content, '<svg')
                        && !str_contains($Silian_content, '<span');
                }),
                Message::TYPE_SYSTEM,
                'high'
            )
            ->willReturn($this->createMock(Message::class));

        $Silian_svc->expects($this->once())
            ->method('queueBroadcastEmail')
            ->with(
                $this->anything(),
                'Alert',
                $this->callback(static function (string $Silian_content): bool {
                    return str_contains($Silian_content, '<p>Safe body</p>')
                        && !str_contains($Silian_content, '<script')
                        && !str_contains($Silian_content, 'alert(1)')
                        && !str_contains($Silian_content, '<svg')
                        && !str_contains($Silian_content, '<span');
                }),
                'high',
                $this->callback(static function (array $Silian_context): bool {
                    return ($Silian_context['content_format'] ?? null) === 'html'
                        && ($Silian_context['render_profile'] ?? null) === 'announcement_html_v1'
                        && ($Silian_context['render_version'] ?? null) === 1
                        && ($Silian_context['source_kind'] ?? null) === 'admin_broadcast';
                })
            )
            ->willReturn(['queued' => true, 'recipient_count' => 1]);

        $Silian_audit->expects($this->once())->method('log');

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('POST', '/admin/messages/broadcast', [
            'title' => 'Alert',
            'content' => '<span><script>alert(1)</script></span><svg><script>alert(1)</script></svg><p>Safe body</p>',
            'content_format' => 'html',
            'render_profile' => 'announcement_html_v1',
            'priority' => 'high',
            'target_users' => [5]
        ]);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->sendSystemMessage($Silian_request, $Silian_response);

        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertSame('html', $Silian_json['content_format']);
        $this->assertSame(1, $Silian_json['render_version']);

        $Silian_row = $Silian_pdo->query('SELECT content, meta FROM message_broadcasts ORDER BY id DESC LIMIT 1')->fetch(\PDO::FETCH_ASSOC);
        $this->assertIsArray($Silian_row);
        $this->assertStringContainsString('<p>Safe body</p>', (string)$Silian_row['content']);
        $this->assertStringNotContainsString('<script', (string)$Silian_row['content']);
        $this->assertStringNotContainsString('alert(1)', (string)$Silian_row['content']);
        $this->assertStringNotContainsString('<svg', (string)$Silian_row['content']);
        $this->assertStringNotContainsString('<span', (string)$Silian_row['content']);

        $Silian_meta = json_decode((string)$Silian_row['meta'], true);
        $this->assertSame(1, $Silian_meta['render_version']);
    }


    public function testSearchBroadcastRecipientsReturnsData(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => true]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('bindValue')->willReturn(true);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_stmt->method('fetchAll')->willReturn([
            ['id' => 10, 'username' => 'Alice', 'email' => 'alice@example.com', 'school_id' => 1, 'school_name' => 'Canonical Green', 'region_code' => 'US-UM-81', 'is_admin' => 0, 'status' => 'active'],
            ['id' => 11, 'username' => 'Bob', 'email' => 'bob@example.com', 'school_id' => 2, 'school_name' => 'Harbor Green', 'region_code' => null, 'is_admin' => 0, 'status' => 'active'],
        ]);

        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);

        $Silian_region = $this->createMock(RegionService::class);
        $Silian_region->method('getRegionContext')->willReturnCallback(static function (?string $Silian_value): ?array {
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

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth, null, $this->makeUserProfileViewService($Silian_region));
        $Silian_request = makeRequest('GET', '/admin/messages/broadcast/recipients', null, ['search' => 'example', 'limit' => 1]);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->searchBroadcastRecipients($Silian_request, $Silian_response);

        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertCount(1, $Silian_json['data']);
        $this->assertTrue($Silian_json['pagination']['has_more']);
        $this->assertSame(1, $Silian_json['pagination']['page']);
        $this->assertSame('Canonical Green', $Silian_json['data'][0]['school']);
        $this->assertSame('US-UM-81', $Silian_json['data'][0]['location']);
    }

    public function testSearchBroadcastRecipientsUsesNamedSearchAndIdBindings(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_bound = [];

        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => true]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->expects($this->exactly(6))
            ->method('bindValue')
            ->willReturnCallback(function ($Silian_key, $Silian_value, ?int $Silian_type = null) use (&$Silian_bound) {
                $Silian_bound[$Silian_key] = [$Silian_value, $Silian_type];
                return true;
            });
        $Silian_stmt->expects($this->once())->method('execute')->willReturn(true);
        $Silian_stmt->expects($this->once())->method('fetchAll')->willReturn([]);

        $Silian_pdo->expects($this->once())
            ->method('prepare')
            ->with($this->callback(static function (string $Silian_sql): bool {
                return str_contains($Silian_sql, 'u.username LIKE :search_0')
                    && str_contains($Silian_sql, 'u.email LIKE :search_1')
                    && str_contains($Silian_sql, 'u.id IN (:include_id_0,:include_id_1)');
            }))
            ->willReturn($Silian_stmt);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/admin/messages/broadcast/recipients', null, [
            'search' => 'alice',
            'fields' => 'username,email',
            'include_ids' => [10, 11],
            'limit' => 1,
        ]);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->searchBroadcastRecipients($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $this->assertSame('%alice%', $Silian_bound[':search_0'][0] ?? null);
        $this->assertSame('%alice%', $Silian_bound[':search_1'][0] ?? null);
        $this->assertSame(10, $Silian_bound[':include_id_0'][0] ?? null);
        $this->assertSame(11, $Silian_bound[':include_id_1'][0] ?? null);
        $this->assertSame(2, $Silian_bound[':limit'][0] ?? null);
        $this->assertSame(0, $Silian_bound[':offset'][0] ?? null);
    }

    public function testResolveExplicitRecipientsUsesDisplayAliasesFromCanonicalFields(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);

        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_stmt->method('fetchAll')->willReturn([
            ['id' => 10, 'username' => 'Alice', 'email' => 'alice@example.com', 'school_id' => 1, 'school_name' => 'Canonical Green', 'region_code' => 'US-UM-81', 'is_admin' => 0, 'status' => 'active'],
        ]);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);

        $Silian_region = $this->createMock(RegionService::class);
        $Silian_region->method('getRegionContext')->willReturnCallback(static function (?string $Silian_value): ?array {
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

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth, null, $this->makeUserProfileViewService($Silian_region));

        $Silian_method = new \ReflectionMethod($Silian_controller, 'resolveExplicitRecipients');
        $Silian_method->setAccessible(true);
        $Silian_result = $Silian_method->invoke($Silian_controller, [10]);

        $this->assertNull($Silian_result['error']);
        $this->assertSame('Canonical Green', $Silian_result['records'][10]['school']);
        $this->assertSame('US-UM-81', $Silian_result['records'][10]['location']);
    }

    public function testGetBroadcastHistoryReturnsAggregatedData(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);

        $Silian_pdo->exec('CREATE TABLE message_broadcasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            request_id TEXT,
            audit_log_id INTEGER,
            system_log_id INTEGER,
            error_log_ids TEXT,
            title TEXT,
            content TEXT,
            priority TEXT,
            scope TEXT,
            target_count INTEGER,
            sent_count INTEGER,
            invalid_user_ids TEXT,
            failed_user_ids TEXT,
            message_ids_snapshot TEXT,
            message_map_snapshot TEXT,
            message_id_count INTEGER,
            content_hash TEXT,
            email_delivery_snapshot TEXT,
            filters_snapshot TEXT,
            meta TEXT,
            created_by INTEGER,
            created_at TEXT,
            updated_at TEXT
        )');

        $Silian_pdo->exec('CREATE TABLE messages (
            id INTEGER PRIMARY KEY,
            receiver_id INTEGER,
            title TEXT,
            content TEXT,
            is_read INTEGER,
            created_at TEXT,
            deleted_at TEXT
        )');

        $Silian_pdo->exec('CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            uuid TEXT,
            username TEXT,
            email TEXT,
            status TEXT,
            is_admin INTEGER
        )');

        $Silian_title = 'Hello world';
        $Silian_content = 'Broadcast content';
        $Silian_createdAt = '2025-09-22 10:00:00';
        $Silian_contentHash = hash('sha256', $Silian_title . '||' . $Silian_content);
        $Silian_emailSnapshot = [
            'triggered' => true,
            'attempted_recipients' => 2,
            'successful_chunks' => 1,
            'failed_chunks' => 0,
            'failed_recipient_ids' => [],
            'missing_email_user_ids' => [7],
            'status' => 'sent',
            'errors' => [],
        ];

        $Silian_insertBroadcast = $Silian_pdo->prepare('INSERT INTO message_broadcasts (request_id, audit_log_id, system_log_id, error_log_ids, title, content, priority, scope, target_count, sent_count, invalid_user_ids, failed_user_ids, message_ids_snapshot, message_map_snapshot, message_id_count, content_hash, email_delivery_snapshot, filters_snapshot, meta, created_by, created_at, updated_at) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
        $Silian_insertBroadcast->execute([
            'abc-123',
            321,
            654,
            json_encode([555]),
            $Silian_title,
            $Silian_content,
            'high',
            'custom',
            2,
            2,
            json_encode([7]),
            json_encode([]),
            json_encode([900, 901]),
            json_encode(['1' => 900, '2' => 901]),
            2,
            $Silian_contentHash,
            json_encode($Silian_emailSnapshot),
            json_encode(['scope' => 'custom']),
            json_encode([
                'content_format' => 'html',
                'render_profile' => 'announcement_html_v1',
                'render_version' => 1,
                'source_kind' => 'admin_broadcast',
            ]),
            42,
            $Silian_createdAt,
            $Silian_createdAt,
        ]);

        $Silian_msgStmt = $Silian_pdo->prepare('INSERT INTO messages (id, receiver_id, title, content, is_read, created_at, deleted_at) VALUES (?,?,?,?,?,?,?)');
        $Silian_msgStmt->execute([900, 1, $Silian_title, $Silian_content, 1, $Silian_createdAt, null]);
        $Silian_msgStmt->execute([901, 2, $Silian_title, $Silian_content, 0, $Silian_createdAt, null]);

        $Silian_userStmt = $Silian_pdo->prepare('INSERT INTO users (id, uuid, username, email, status, is_admin) VALUES (?,?,?,?,?,?)');
        $Silian_userStmt->execute([42, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'AdminUser', 'admin@example.com', 'active', 1]);
        $Silian_userStmt->execute([1, '11111111-1111-4111-8111-111111111111', 'Alice', 'alice@example.com', 'active', 0]);
        $Silian_userStmt->execute([2, '22222222-2222-4222-8222-222222222222', 'Bob', 'bob@example.com', 'inactive', 0]);

        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 99, 'is_admin' => true]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/admin/messages/broadcasts');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getBroadcastHistory($Silian_request, $Silian_response);

        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertCount(1, $Silian_json['data']);

        $Silian_item = $Silian_json['data'][0];
        $this->assertSame('Hello world', $Silian_item['title']);
        $this->assertSame(1, $Silian_item['read_count']);
        $this->assertSame(1, $Silian_item['unread_count']);
        $this->assertSame([7], $Silian_item['invalid_user_ids']);
        $this->assertSame('AdminUser', $Silian_item['actor_username']);
        $this->assertSame('abc-123', $Silian_item['request_id']);
        $this->assertSame(321, $Silian_item['audit_log_id']);
        $this->assertSame(654, $Silian_item['system_log_id']);
        $this->assertSame([555], $Silian_item['error_log_ids']);
        $this->assertSame([900, 901], $Silian_item['message_ids']);
        $this->assertSame('html', $Silian_item['content_format']);
        $this->assertSame('announcement_html_v1', $Silian_item['render_profile']);
        $this->assertSame(1, $Silian_item['render_version']);
        $this->assertSame('admin_broadcast', $Silian_item['source_kind']);
        $this->assertSame('sent', $Silian_item['email_delivery']['status']);
        $this->assertSame([7], $Silian_item['email_delivery']['missing_email_user_ids']);
        $this->assertSame([], $Silian_item['email_delivery']['errors']);
        $this->assertSame('11111111-1111-4111-8111-111111111111', $Silian_item['read_users'][0]['user_id']);
        $this->assertSame('11111111-1111-4111-8111-111111111111', $Silian_item['read_users'][0]['uuid']);
        $this->assertSame(1, $Silian_item['read_users'][0]['legacy_user_id']);
        $this->assertSame('active', $Silian_item['read_users'][0]['status']);
        $this->assertFalse($Silian_item['read_users'][0]['is_admin']);
        $this->assertSame('22222222-2222-4222-8222-222222222222', $Silian_item['unread_users'][0]['user_id']);
        $this->assertSame(2, $Silian_item['unread_users'][0]['legacy_user_id']);
    }

    public function testFlushBroadcastQueueMarksQueuedAsSentWithoutForce(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $Silian_pdo->sqliteCreateFunction('NOW', fn(): string => date('Y-m-d H:i:s'));

        $Silian_pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email TEXT, deleted_at TEXT)');
        $Silian_pdo->exec('CREATE TABLE messages (id INTEGER PRIMARY KEY, receiver_id INTEGER, title TEXT, content TEXT, is_read INTEGER DEFAULT 0, created_at TEXT, deleted_at TEXT)');
        $Silian_pdo->exec('CREATE TABLE message_broadcasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            content TEXT,
            priority TEXT,
            created_at TEXT,
            email_delivery_snapshot TEXT,
            message_ids_snapshot TEXT,
            content_hash TEXT,
            updated_at TEXT
        )');

        $Silian_title = 'Queue Notice';
        $Silian_content = 'Please review the latest announcement.';
        $Silian_priority = 'urgent';
        $Silian_createdAt = '2025-01-01 10:00:00';
        $Silian_hash = hash('sha256', $Silian_title . '||' . $Silian_content);

        $Silian_pdo->prepare('INSERT INTO users (id, username, email) VALUES (?,?,?)')
            ->execute([10, 'QueueUser', 'queue@example.com']);

        $Silian_pdo->prepare('INSERT INTO messages (id, receiver_id, title, content, is_read, created_at) VALUES (?,?,?,?,?,?)')
            ->execute([501, 10, $Silian_title, $Silian_content, 0, $Silian_createdAt]);

        $Silian_snapshot = json_encode([
            'triggered' => true,
            'attempted_recipients' => 1,
            'successful_chunks' => 0,
            'failed_chunks' => 0,
            'failed_recipient_ids' => [],
            'missing_email_user_ids' => [],
            'status' => 'queued',
            'errors' => [],
            'completed_at' => null,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $Silian_pdo->prepare('INSERT INTO message_broadcasts (id, title, content, priority, created_at, email_delivery_snapshot, message_ids_snapshot, content_hash) VALUES (?,?,?,?,?,?,?,?)')
            ->execute([1, $Silian_title, $Silian_content, $Silian_priority, $Silian_createdAt, $Silian_snapshot, json_encode([501]), $Silian_hash]);

        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())->method('log');
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 88, 'is_admin' => true]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('POST', '/admin/messages/broadcasts/flush', ['limit' => 5]);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->flushBroadcastEmailQueue($Silian_request, $Silian_response);

        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertSame(1, $Silian_json['count']);
        $this->assertSame('sent', $Silian_json['processed'][0]['status']);

        $Silian_snapshotRow = $Silian_pdo->query('SELECT email_delivery_snapshot FROM message_broadcasts WHERE id = 1')->fetchColumn();
        $this->assertNotFalse($Silian_snapshotRow);
        $Silian_decoded = json_decode((string)$Silian_snapshotRow, true);
        $this->assertSame('sent', $Silian_decoded['status']);
        $this->assertNotEmpty($Silian_decoded['completed_at']);
    }

    public function testFlushBroadcastQueueForceSendFailure(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $Silian_pdo->sqliteCreateFunction('NOW', fn(): string => date('Y-m-d H:i:s'));

        $Silian_pdo->exec('CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email TEXT, deleted_at TEXT)');
        $Silian_pdo->exec('CREATE TABLE messages (id INTEGER PRIMARY KEY, receiver_id INTEGER, title TEXT, content TEXT, is_read INTEGER DEFAULT 0, created_at TEXT, deleted_at TEXT)');
        $Silian_pdo->exec('CREATE TABLE message_broadcasts (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            title TEXT,
            content TEXT,
            priority TEXT,
            created_at TEXT,
            email_delivery_snapshot TEXT,
            message_ids_snapshot TEXT,
            content_hash TEXT,
            updated_at TEXT
        )');

        $Silian_title = 'Force Send';
        $Silian_content = 'Force send announcement';
        $Silian_priority = 'high';
        $Silian_createdAt = '2025-02-02 09:00:00';
        $Silian_hash = hash('sha256', $Silian_title . '||' . $Silian_content);

        $Silian_pdo->prepare('INSERT INTO users (id, username, email) VALUES (?,?,?)')
            ->execute([20, 'ForceUser', 'force@example.com']);

        $Silian_pdo->prepare('INSERT INTO messages (id, receiver_id, title, content, is_read, created_at) VALUES (?,?,?,?,?,?)')
            ->execute([701, 20, $Silian_title, $Silian_content, 0, $Silian_createdAt]);

        $Silian_snapshot = json_encode([
            'triggered' => true,
            'attempted_recipients' => 1,
            'successful_chunks' => 0,
            'failed_chunks' => 0,
            'failed_recipient_ids' => [],
            'missing_email_user_ids' => [],
            'status' => 'queued',
            'errors' => [],
            'completed_at' => null,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        $Silian_pdo->prepare('INSERT INTO message_broadcasts (id, title, content, priority, created_at, email_delivery_snapshot, message_ids_snapshot, content_hash) VALUES (?,?,?,?,?,?,?,?)')
            ->execute([2, $Silian_title, $Silian_content, $Silian_priority, $Silian_createdAt, $Silian_snapshot, json_encode([701]), $Silian_hash]);

        $Silian_svc = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())->method('log');
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 59, 'is_admin' => true]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_emailService = $this->createMock(EmailService::class);
        $Silian_emailService->expects($this->once())
            ->method('sendAnnouncementBroadcast')
            ->willReturn(false);
        $Silian_emailService->method('getLastError')->willReturn('mailer down');

        $Silian_controller = $this->makeController($Silian_pdo, $Silian_svc, $Silian_audit, $Silian_auth, $Silian_emailService);
        $Silian_request = makeRequest('POST', '/admin/messages/broadcasts/flush', ['limit' => 5, 'force' => 1]);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->flushBroadcastEmailQueue($Silian_request, $Silian_response);

        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertSame('failed', $Silian_json['processed'][0]['status']);
        $this->assertContains('mailer down', $Silian_json['processed'][0]['errors']);

        $Silian_snapshotRow = $Silian_pdo->query('SELECT email_delivery_snapshot FROM message_broadcasts WHERE id = 2')->fetchColumn();
        $this->assertNotFalse($Silian_snapshotRow);
        $Silian_decoded = json_decode((string)$Silian_snapshotRow, true);
        $this->assertSame('failed', $Silian_decoded['status']);
        $this->assertContains('mailer down', $Silian_decoded['errors']);
    }
}



