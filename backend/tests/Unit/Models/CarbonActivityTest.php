<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Models;

use PHPUnit\Framework\TestCase;
use CarbonTrack\Models\CarbonActivity;

class CarbonActivityTest extends TestCase
{
    public function testFindByIdUsesPdo(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_stmt->method('fetch')->willReturn(['id'=>'a1','unit'=>'km']);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);
        $Silian_row = CarbonActivity::findById($Silian_pdo, 'a1');
        $this->assertEquals('a1', $Silian_row['id']);
    }
}


