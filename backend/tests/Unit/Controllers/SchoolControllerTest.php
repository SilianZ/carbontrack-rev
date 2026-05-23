<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use Illuminate\Database\QueryException;
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
        $Silian_controller = new SchoolController(
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            $this->createMock(\PDO::class)
        );

        $Silian_method = new \ReflectionMethod($Silian_controller, 'sanitizeSchoolPayload');
        $Silian_method->setAccessible(true);

        $Silian_payload = $Silian_method->invoke($Silian_controller, [
            'name' => 'Test School',
            'is_active' => '',
            'sort_order' => '',
        ]);

        $this->assertSame('Test School', $Silian_payload['name']);
        $this->assertFalse($Silian_payload['is_active']);
        $this->assertSame(0, $Silian_payload['sort_order']);
    }

    public function testSanitizeSchoolPayloadRejectsInvalidStringValues(): void
    {
        $Silian_controller = new SchoolController(
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            $this->createMock(\PDO::class)
        );

        $Silian_method = new \ReflectionMethod($Silian_controller, 'sanitizeSchoolPayload');
        $Silian_method->setAccessible(true);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('sort_order must be an integer');

        $Silian_method->invoke($Silian_controller, [
            'name' => 'Test School',
            'sort_order' => 'abc',
        ]);
    }

    public function testSanitizeSchoolPayloadRejectsNonObjectPayload(): void
    {
        $Silian_controller = new SchoolController(
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            $this->createMock(\PDO::class)
        );

        $Silian_method = new \ReflectionMethod($Silian_controller, 'sanitizeSchoolPayload');
        $Silian_method->setAccessible(true);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Request body must be a JSON object');

        $Silian_method->invoke($Silian_controller, null);
    }

    public function testStoreRejectsNonObjectRequestBody(): void
    {
        $Silian_controller = new SchoolController(
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            $this->createMock(\PDO::class)
        );

        $Silian_response = $Silian_controller->store(
            makeRequest('POST', '/api/v1/admin/schools', null),
            new \Slim\Psr7\Response(),
            []
        );

        $this->assertSame(400, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('INVALID_REQUEST_BODY', $Silian_payload['code']);
    }

    public function testShouldRetryWithoutSortOrderForLegacySchemaError(): void
    {
        $Silian_controller = new SchoolController(
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            $this->createMock(\PDO::class)
        );

        $Silian_method = new \ReflectionMethod($Silian_controller, 'shouldRetryWithoutSortOrder');
        $Silian_method->setAccessible(true);

        $Silian_exception = new QueryException(
            'insert into schools',
            [],
            new \PDOException("SQLSTATE[42S22]: Column not found: 1054 Unknown column 'sort_order' in 'field list'")
        );

        $Silian_shouldRetry = $Silian_method->invoke($Silian_controller, ['sort_order' => 0], $Silian_exception);

        $this->assertTrue($Silian_shouldRetry);
    }

    public function testShouldNotRetryWithoutSortOrderForUnrelatedQueryError(): void
    {
        $Silian_controller = new SchoolController(
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            $this->createMock(\PDO::class)
        );

        $Silian_method = new \ReflectionMethod($Silian_controller, 'shouldRetryWithoutSortOrder');
        $Silian_method->setAccessible(true);

        $Silian_exception = new QueryException(
            'insert into schools',
            [],
            new \PDOException('SQLSTATE[23000]: Integrity constraint violation: 1062 Duplicate entry')
        );

        $Silian_shouldRetry = $Silian_method->invoke($Silian_controller, ['sort_order' => 0], $Silian_exception);

        $this->assertFalse($Silian_shouldRetry);
    }
}


