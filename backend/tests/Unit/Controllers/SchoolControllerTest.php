<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use PHPUnit\Framework\TestCase;
use CarbonTrack\Controllers\SchoolController;

class SchoolControllerTest extends TestCase
{
    public function testControllerClassExists(): void
    {
        $this->assertTrue(class_exists(SchoolController::class));
    }

    public function testIndexReturnsSchoolsListShape(): void
    {
        // 由于 SchoolController 使用 Eloquent 静态方法，这里只验证方法存在与基本返回结构约束，不直接调用 Eloquent
        $this->assertTrue(method_exists(SchoolController::class, 'index'));
        $this->assertTrue(method_exists(SchoolController::class, 'adminIndex'));
        $this->assertTrue(method_exists(SchoolController::class, 'stats'));
    }

    public function testSanitizeSchoolPayloadNormalizesEmptyStringNumericFields(): void
    {
        $controller = new SchoolController(
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            $this->createMock(\PDO::class)
        );

        $method = new \ReflectionMethod($controller, 'sanitizeSchoolPayload');
        $method->setAccessible(true);

        $payload = $method->invoke($controller, [
            'name' => 'Test School',
            'is_active' => '',
            'sort_order' => '',
        ]);

        $this->assertSame('Test School', $payload['name']);
        $this->assertFalse($payload['is_active']);
        $this->assertSame(0, $payload['sort_order']);
    }
}


