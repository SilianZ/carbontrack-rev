<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use PHPUnit\Framework\TestCase;
use CarbonTrack\Services\DatabaseService;
use Illuminate\Database\Capsule\Manager as Capsule;

class DatabaseServiceTest extends TestCase
{
    public function testBasicHelpersAndIsConnected(): void
    {
    $Silian_pdo = $this->createMock(\PDO::class);
    $Silian_stmt = $this->createMock(\PDOStatement::class);
    $Silian_pdo->method('query')->with('SELECT 1')->willReturn($Silian_stmt);

        $Silian_connection = $this->getMockBuilder(\Illuminate\Database\Connection::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['getPdo','getTablePrefix','getDatabaseName','select','beginTransaction','commit','rollback'])
            ->getMock();

        $Silian_connection->method('getPdo')->willReturn($Silian_pdo);
        $Silian_connection->method('getTablePrefix')->willReturn('ct_');
        $Silian_connection->method('getDatabaseName')->willReturn('testdb');
        $Silian_connection->method('select')->willReturn([["ok" => 1]]);

        $Silian_capsule = $this->getMockBuilder(Capsule::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['getConnection'])
            ->getMock();
        $Silian_capsule->method('getConnection')->willReturn($Silian_connection);

        $Silian_db = new DatabaseService($Silian_capsule);
        $this->assertSame($Silian_capsule, $Silian_db->getCapsule());
        $this->assertTrue($Silian_db->isConnected());
        $this->assertEquals('ct_', $Silian_db->getTablePrefix());
        $this->assertEquals('testdb', $Silian_db->getDatabaseName());
        $this->assertIsArray($Silian_db->raw('SELECT 1'));

        // transaction calls should not throw with mocked methods
        $Silian_db->beginTransaction();
        $Silian_db->commit();
        $Silian_db->rollback();
    }

    public function testIsConnectedFalseOnException(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_pdo->method('query')->willThrowException(new \Exception('fail'));

        $Silian_connection = $this->getMockBuilder(\Illuminate\Database\Connection::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['getPdo'])
            ->getMock();
        $Silian_connection->method('getPdo')->willReturn($Silian_pdo);

        $Silian_capsule = $this->getMockBuilder(Capsule::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['getConnection'])
            ->getMock();
        $Silian_capsule->method('getConnection')->willReturn($Silian_connection);

        $Silian_db = new DatabaseService($Silian_capsule);
        $this->assertFalse($Silian_db->isConnected());
    }
}
