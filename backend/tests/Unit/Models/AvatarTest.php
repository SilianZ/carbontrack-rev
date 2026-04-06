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
        $pdo = $this->createMock(\PDO::class);
        $stmt = $this->createMock(\PDOStatement::class);
        $stmt->method('execute')->willReturn(true);
        $stmt->method('fetchAll')->willReturn([
            ['id'=>1,'category'=>'c1','is_default'=>0],
            ['id'=>2,'category'=>'c1','is_default'=>1]
        ]);
        $pdo->method('prepare')->willReturn($stmt);

        $model = new Avatar($pdo);
        $list = $model->getAvailableAvatars('c1');
        $this->assertCount(2, $list);
        $this->assertEquals('c1', $list[0]['category']);
    }

    public function testGetAvatarByIdReturnsNullWhenNotFound(): void
    {
        $pdo = $this->createMock(\PDO::class);
        $stmt = $this->createMock(\PDOStatement::class);
        $stmt->method('execute')->willReturn(true);
        $stmt->method('fetch')->willReturn(false);
        $pdo->method('prepare')->willReturn($stmt);

        $model = new Avatar($pdo);
        $res = $model->getAvatarById(999);
        $this->assertNull($res);
    }

    public function testGetAvailableAvatarsLogsViaLoggerWhenErrorLogServiceFails(): void
    {
        $pdo = $this->createMock(\PDO::class);
        $stmt = $this->createMock(\PDOStatement::class);
        $stmt->method('execute')->willThrowException(new \PDOException('db down'));
        $pdo->method('prepare')->willReturn($stmt);

        $errorLogService = $this->createMock(ErrorLogService::class);
        $errorLogService->method('logException')->willThrowException(new \RuntimeException('logger down'));

        $logger = $this->createMock(LoggerInterface::class);
        $logger->expects($this->exactly(2))
            ->method('error')
            ->with(
                $this->logicalOr(
                    $this->equalTo('ErrorLogService logging failed for avatar model'),
                    $this->equalTo('Avatar query failed: db down')
                ),
                $this->isType('array')
            );

        $model = new Avatar($pdo, $errorLogService, $logger);
        $list = $model->getAvailableAvatars('c1');

        $this->assertSame([], $list);
    }
}


