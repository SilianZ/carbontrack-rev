<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use CarbonTrack\Controllers\SystemLogController;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\AuthService;
use PHPUnit\Framework\TestCase;

class SystemLogControllerTest extends TestCase
{
    public function testListUsesDistinctGeneralSearchBindings(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => true]);
        $Silian_auth->method('isAdminUser')->willReturn(true);
        $Silian_bound = [];

        $Silian_countStmt = $this->createMock(\PDOStatement::class);
        $Silian_countStmt->expects($this->exactly(9))
            ->method('bindValue')
            ->willReturnCallback(function (string $Silian_key, $Silian_value, ?int $Silian_type = null) use (&$Silian_bound) {
                $Silian_bound['count'][$Silian_key] = [$Silian_value, $Silian_type];
                return true;
            });
        $Silian_countStmt->expects($this->once())->method('execute')->willReturn(true);
        $Silian_countStmt->expects($this->once())->method('fetchColumn')->willReturn(0);

        $Silian_listStmt = $this->createMock(\PDOStatement::class);
        $Silian_listStmt->expects($this->exactly(11))
            ->method('bindValue')
            ->willReturnCallback(function (string $Silian_key, $Silian_value, ?int $Silian_type = null) use (&$Silian_bound) {
                $Silian_bound['list'][$Silian_key] = [$Silian_value, $Silian_type];
                return true;
            });
        $Silian_listStmt->expects($this->once())->method('execute')->willReturn(true);
        $Silian_listStmt->expects($this->once())->method('fetchAll')->willReturn([]);

        $Silian_pdo->expects($this->exactly(2))
            ->method('prepare')
            ->willReturnCallback(function (string $Silian_sql) use ($Silian_countStmt, $Silian_listStmt) {
                static $Silian_prepareCalls = 0;
                $Silian_prepareCalls++;
                $this->assertStringContainsString('request_id LIKE :q_request_id', $Silian_sql);
                $this->assertStringContainsString('path LIKE :q_path', $Silian_sql);
                $this->assertStringContainsString('server_meta LIKE :q_server_meta', $Silian_sql);
                return $Silian_prepareCalls === 1 ? $Silian_countStmt : $Silian_listStmt;
            });

        $Silian_controller = new SystemLogController($Silian_pdo, $Silian_auth, $Silian_audit);
        $Silian_request = makeRequest('GET', '/admin/system-logs', null, ['q' => 'trace']);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_result = $Silian_controller->list($Silian_request, $Silian_response);
        $this->assertSame(200, $Silian_result->getStatusCode());
        $this->assertSame('%trace%', $Silian_bound['count'][':q_request_id'][0] ?? null);
        $this->assertSame('%trace%', $Silian_bound['count'][':q_path'][0] ?? null);
        $this->assertSame('%trace%', $Silian_bound['count'][':q_server_meta'][0] ?? null);
        $this->assertSame(20, $Silian_bound['list'][':limit'][0] ?? null);
        $this->assertSame(0, $Silian_bound['list'][':offset'][0] ?? null);
    }
}
