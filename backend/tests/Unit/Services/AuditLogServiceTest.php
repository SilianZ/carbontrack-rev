<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use Monolog\Logger;
use PHPUnit\Framework\TestCase;
use CarbonTrack\Services\AuditLogService;

class AuditLogServiceTest extends TestCase
{
    private mixed $previousDisableAuditWrites = null;
    private mixed $previousDisableAuditWritesServer = null;
    private mixed $previousAppEnv = null;
    private mixed $previousAppEnvServer = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->previousDisableAuditWrites = $_ENV['DISABLE_AUDIT_LOG_WRITES'] ?? null;
        $this->previousDisableAuditWritesServer = $_SERVER['DISABLE_AUDIT_LOG_WRITES'] ?? null;
        $this->previousAppEnv = $_ENV['APP_ENV'] ?? null;
        $this->previousAppEnvServer = $_SERVER['APP_ENV'] ?? null;
        unset($_ENV['DISABLE_AUDIT_LOG_WRITES']);
        unset($_SERVER['DISABLE_AUDIT_LOG_WRITES']);
        $_ENV['APP_ENV'] = 'development';
        $_SERVER['APP_ENV'] = 'development';
    }

    protected function tearDown(): void
    {
        if ($this->previousDisableAuditWrites === null) {
            unset($_ENV['DISABLE_AUDIT_LOG_WRITES']);
        } else {
            $_ENV['DISABLE_AUDIT_LOG_WRITES'] = $this->previousDisableAuditWrites;
        }
        if ($this->previousDisableAuditWritesServer === null) {
            unset($_SERVER['DISABLE_AUDIT_LOG_WRITES']);
        } else {
            $_SERVER['DISABLE_AUDIT_LOG_WRITES'] = $this->previousDisableAuditWritesServer;
        }
        if ($this->previousAppEnv === null) {
            unset($_ENV['APP_ENV']);
        } else {
            $_ENV['APP_ENV'] = $this->previousAppEnv;
        }
        if ($this->previousAppEnvServer === null) {
            unset($_SERVER['APP_ENV']);
        } else {
            $_SERVER['APP_ENV'] = $this->previousAppEnvServer;
        }

        parent::tearDown();
    }

    public function testClassExists(): void
    {
        $this->assertTrue(class_exists(AuditLogService::class));
    }

    public function testLogUserActionInsertsAndLogs(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);
        $Silian_logger->expects($this->once())->method('info');

        $Silian_svc = new AuditLogService($Silian_pdo, $Silian_logger);
        $Silian_svc->logUserAction(1, 'login', ['ip'=>'127.0.0.1'], '127.0.0.1');
        $this->assertTrue(true);
    }

    public function testGetUserLogsReturnsArray(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_stmt->method('fetchAll')->willReturn([
            ['id'=>1,'user_id'=>1,'action'=>'login']
        ]);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);

        $Silian_svc = new AuditLogService($Silian_pdo, $Silian_logger);
        $Silian_logs = $Silian_svc->getUserLogs(1, 10);
        $this->assertCount(1, $Silian_logs);
        $this->assertEquals('login', $Silian_logs[0]['action']);
    }

    public function testLogSystemEventPersistsNullUserIdForSystemActor(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        $Silian_pdo->exec(
            "CREATE TABLE audit_logs (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NULL,
                user_uuid TEXT NULL,
                conversation_id TEXT NULL,
                actor_type TEXT NOT NULL,
                action TEXT NOT NULL,
                data TEXT NULL,
                ip_address TEXT NULL,
                user_agent TEXT NULL,
                request_method TEXT NULL,
                endpoint TEXT NULL,
                old_data TEXT NULL,
                new_data TEXT NULL,
                affected_table TEXT NULL,
                affected_id INTEGER NULL,
                status TEXT NULL,
                response_code INTEGER NULL,
                session_id TEXT NULL,
                referrer TEXT NULL,
                operation_category TEXT NOT NULL,
                operation_subtype TEXT NULL,
                change_type TEXT NULL,
                request_id TEXT NULL,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            )"
        );

        $Silian_service = new AuditLogService($Silian_pdo, new Logger('test'));

        $this->assertTrue($Silian_service->logSystemEvent('statistics_public_computed', 'statistics_service', [
            'status' => 'success',
            'request_method' => 'SYSTEM',
            'endpoint' => '/internal/statistics',
            'request_data' => ['force_refresh' => false],
        ]));

        $Silian_row = $Silian_pdo->query('SELECT user_id, actor_type, action, operation_category FROM audit_logs LIMIT 1')
            ?->fetch(\PDO::FETCH_ASSOC);

        $this->assertIsArray($Silian_row);
        $this->assertNull($Silian_row['user_id']);
        $this->assertSame('system', $Silian_row['actor_type']);
        $this->assertSame('statistics_public_computed', $Silian_row['action']);
        $this->assertSame('statistics_service', $Silian_row['operation_category']);
    }

    public function testLogAuditSkipsInsertWhenWritesDisabled(): void
    {
        $_ENV['DISABLE_AUDIT_LOG_WRITES'] = 'true';
        $_SERVER['DISABLE_AUDIT_LOG_WRITES'] = 'true';

        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_pdo->expects($this->never())->method('prepare');

        $Silian_service = new AuditLogService($Silian_pdo, $this->createMock(\Monolog\Logger::class));

        $this->assertFalse($Silian_service->log([
            'action' => 'register',
            'operation_category' => 'authentication',
        ]));
    }

    public function testProductionEnvironmentIgnoresDisableFlag(): void
    {
        $_ENV['APP_ENV'] = 'production';
        $_SERVER['APP_ENV'] = 'production';
        $_ENV['DISABLE_AUDIT_LOG_WRITES'] = 'true';
        $_SERVER['DISABLE_AUDIT_LOG_WRITES'] = 'true';

        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_pdo->expects($this->once())->method('prepare')->willReturn($Silian_stmt);
        $Silian_pdo->method('lastInsertId')->willReturn('1');

        $Silian_service = new AuditLogService($Silian_pdo, $this->createMock(\Monolog\Logger::class));

        $this->assertTrue($Silian_service->log([
            'action' => 'register',
            'operation_category' => 'authentication',
        ]));
    }
}


