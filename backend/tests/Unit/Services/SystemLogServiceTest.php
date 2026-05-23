<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\SystemLogService;
use Monolog\Logger;
use PDO;
use PHPUnit\Framework\TestCase;

class SystemLogServiceTest extends TestCase
{
    private array $originalServer = [];
    private mixed $previousDisableSystemWrites = null;
    private mixed $previousDisableSystemWritesServer = null;
    private mixed $previousAppEnv = null;
    private mixed $previousAppEnvServer = null;

    protected function setUp(): void
    {
        parent::setUp();
        $this->originalServer = $_SERVER ?? [];
        $this->previousDisableSystemWrites = $_ENV['DISABLE_SYSTEM_LOG_WRITES'] ?? null;
        $this->previousDisableSystemWritesServer = $_SERVER['DISABLE_SYSTEM_LOG_WRITES'] ?? null;
        $this->previousAppEnv = $_ENV['APP_ENV'] ?? null;
        $this->previousAppEnvServer = $_SERVER['APP_ENV'] ?? null;
        unset($_ENV['DISABLE_SYSTEM_LOG_WRITES']);
        unset($_SERVER['DISABLE_SYSTEM_LOG_WRITES']);
        $_ENV['APP_ENV'] = 'development';
        $_SERVER['APP_ENV'] = 'development';
    }

    protected function tearDown(): void
    {
        $_SERVER = $this->originalServer;
        if ($this->previousDisableSystemWrites === null) {
            unset($_ENV['DISABLE_SYSTEM_LOG_WRITES']);
        } else {
            $_ENV['DISABLE_SYSTEM_LOG_WRITES'] = $this->previousDisableSystemWrites;
        }
        if ($this->previousDisableSystemWritesServer === null) {
            unset($_SERVER['DISABLE_SYSTEM_LOG_WRITES']);
        } else {
            $_SERVER['DISABLE_SYSTEM_LOG_WRITES'] = $this->previousDisableSystemWritesServer;
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

    public function testSummaryUsesContextValues(): void
    {
        $Silian_service = $this->makeService();
        $_SERVER = [];

        $Silian_metaJson = $this->invokeBuildServerMeta($Silian_service, ['HTTP_AUTHORIZATION' => 'secret-token'], [
            'method' => 'POST',
            'path' => '/api/system/test',
            'ip_address' => '198.51.100.2',
        ]);

        $Silian_meta = json_decode($Silian_metaJson, true);
        $this->assertIsArray($Silian_meta);
        $this->assertSame('[REDACTED]', $Silian_meta['HTTP_AUTHORIZATION']);
        $this->assertSame('POST', $Silian_meta['_summary']['method']);
        $this->assertSame('/api/system/test', $Silian_meta['_summary']['uri']);
        $this->assertSame('198.51.100.2', $Silian_meta['_summary']['ip']);
    }

    public function testSummaryFallsBackToServerGlobalsWithCloudflareIpPreference(): void
    {
        $Silian_service = $this->makeService();
        $_SERVER = [
            'HTTP_CF_CONNNECTING_IP' => '203.0.113.9',
            'REQUEST_METHOD' => 'DELETE',
            'REQUEST_URI' => '/from-global',
        ];

        $Silian_metaJson = $this->invokeBuildServerMeta($Silian_service, [], []);
        $Silian_meta = json_decode($Silian_metaJson, true);

        $this->assertIsArray($Silian_meta);
        $this->assertSame('DELETE', $Silian_meta['_summary']['method']);
        $this->assertSame('/from-global', $Silian_meta['_summary']['uri']);
        $this->assertSame('203.0.113.9', $Silian_meta['_summary']['ip']);
    }

    public function testSummaryUsesRemoteAddrWhenNoCloudflareHeaders(): void
    {
        $Silian_service = $this->makeService();
        $_SERVER = [];

        $Silian_metaJson = $this->invokeBuildServerMeta($Silian_service, ['REMOTE_ADDR' => '192.0.2.44'], []);
        $Silian_meta = json_decode($Silian_metaJson, true);

        $this->assertIsArray($Silian_meta);
        $this->assertSame('192.0.2.44', $Silian_meta['_summary']['ip']);
    }

    public function testLogReturnsNullWhenWritesDisabled(): void
    {
        $_ENV['DISABLE_SYSTEM_LOG_WRITES'] = 'true';
        $_SERVER['DISABLE_SYSTEM_LOG_WRITES'] = 'true';

        $Silian_pdo = $this->createMock(PDO::class);
        $Silian_pdo->expects($this->never())->method('prepare');

        $Silian_service = new SystemLogService($Silian_pdo, new Logger('test'));

        $Silian_result = $Silian_service->log([
            'request_id' => 'req-1',
            'method' => 'GET',
            'path' => '/api/test',
        ]);

        $this->assertNull($Silian_result);
    }

    public function testProductionEnvironmentIgnoresDisableFlag(): void
    {
        $_ENV['APP_ENV'] = 'production';
        $_SERVER['APP_ENV'] = 'production';
        $_ENV['DISABLE_SYSTEM_LOG_WRITES'] = 'true';
        $_SERVER['DISABLE_SYSTEM_LOG_WRITES'] = 'true';

        $Silian_pdo = $this->createMock(PDO::class);
        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_pdo->expects($this->once())->method('prepare')->willReturn($Silian_stmt);
        $Silian_pdo->method('lastInsertId')->willReturn('1');

        $Silian_service = new SystemLogService($Silian_pdo, new Logger('test'));

        $Silian_result = $Silian_service->log([
            'request_id' => 'req-1',
            'method' => 'GET',
            'path' => '/api/test',
        ]);

        $this->assertSame(1, $Silian_result);
    }

    private function makeService(): SystemLogService
    {
        $Silian_pdo = new PDO('sqlite::memory:');
        $Silian_logger = new Logger('test');
        return new SystemLogService($Silian_pdo, $Silian_logger);
    }

    private function invokeBuildServerMeta(SystemLogService $Silian_service, array $Silian_server, array $Silian_context): string
    {
        $Silian_ref = new \ReflectionClass(SystemLogService::class);
        $Silian_method = $Silian_ref->getMethod('buildServerMeta');
        $Silian_method->setAccessible(true);

        /** @var string $json */
        $Silian_json = $Silian_method->invoke($Silian_service, $Silian_server, $Silian_context);
        return $Silian_json;
    }
}
