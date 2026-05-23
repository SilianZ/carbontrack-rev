<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\AuditLogService;
use PHPUnit\Framework\TestCase;
use CarbonTrack\Services\CarbonCalculatorService;
use CarbonTrack\Services\ErrorLogService;

class CarbonCalculatorServiceTest extends TestCase
{
    private CarbonCalculatorService $carbonCalculator;

    protected function setUp(): void
    {
        parent::setUp();

        // Create mock logger for testing
        $Silian_mockLogger = $this->createMock(\Monolog\Logger::class);
        $this->carbonCalculator = new CarbonCalculatorService($Silian_mockLogger);
    }

    public function testCalculateCarbonReduction(): void
    {
        // Test basic calculation
        $Silian_activity = [
            'carbon_factor' => 2.5, // kg CO2 per unit
            'unit' => 'km'
        ];
        $Silian_amount = 10.0; // 10 km

        $Silian_result = $this->carbonCalculator->calculateCarbonReduction($Silian_activity, $Silian_amount);

        $this->assertEquals(25.0, $Silian_result); // 2.5 * 10 = 25 kg CO2
    }

    public function testCalculateCarbonReductionWithZeroAmount(): void
    {
        $Silian_activity = [
            'carbon_factor' => 2.5,
            'unit' => 'km'
        ];
        $Silian_amount = 0.0;

        $Silian_result = $this->carbonCalculator->calculateCarbonReduction($Silian_activity, $Silian_amount);

        $this->assertEquals(0.0, $Silian_result);
    }

    public function testCalculateCarbonReductionWithNegativeAmount(): void
    {
        $Silian_activity = [
            'carbon_factor' => 2.5,
            'unit' => 'km'
        ];
        $Silian_amount = -5.0;

        $Silian_result = $this->carbonCalculator->calculateCarbonReduction($Silian_activity, $Silian_amount);

        $this->assertEquals(0.0, $Silian_result); // Should not allow negative values
    }

    public function testCalculatePoints(): void
    {
        $Silian_carbonAmount = 25.0; // kg CO2
        $Silian_pointsPerKg = 10; // 10 points per kg CO2

        $Silian_result = $this->carbonCalculator->calculatePoints($Silian_carbonAmount, $Silian_pointsPerKg);

        $this->assertEquals(250, $Silian_result); // 25 * 10 = 250 points
    }

    public function testCalculatePointsWithDefaultRate(): void
    {
        $Silian_carbonAmount = 10.0; // kg CO2

        $Silian_result = $this->carbonCalculator->calculatePoints($Silian_carbonAmount);

        $this->assertEquals(100, $Silian_result); // Default rate is 10 points per kg
    }

    public function testCalculatePointsWithZeroCarbonAmount(): void
    {
        $Silian_carbonAmount = 0.0;

        $Silian_result = $this->carbonCalculator->calculatePoints($Silian_carbonAmount);

        $this->assertEquals(0, $Silian_result);
    }

    public function testValidateActivityData(): void
    {
        // Valid activity data
        $Silian_validActivity = [
            'id' => 'uuid-123',
            'name_zh' => '步行',
            'name_en' => 'Walking',
            'carbon_factor' => 2.5,
            'unit' => 'km',
            'category' => 'transport'
        ];

        $this->assertTrue($this->carbonCalculator->validateActivityData($Silian_validActivity));

        // Invalid activity data - missing required fields
        $Silian_invalidActivity1 = [
            'id' => 'uuid-123',
            'name_zh' => '步行'
            // Missing other required fields
        ];

        $this->assertFalse($this->carbonCalculator->validateActivityData($Silian_invalidActivity1));

        // Invalid activity data - invalid carbon factor
        $Silian_invalidActivity2 = [
            'id' => 'uuid-123',
            'name_zh' => '步行',
            'name_en' => 'Walking',
            'carbon_factor' => -1.0, // Negative factor
            'unit' => 'km',
            'category' => 'transport'
        ];

        $this->assertFalse($this->carbonCalculator->validateActivityData($Silian_invalidActivity2));

        // Update payload: allow partial fields as long as recognised field present
        $Silian_updatePayload = ['is_active' => false];
        $this->assertTrue($this->carbonCalculator->validateActivityData($Silian_updatePayload, true));

        $Silian_invalidUpdate = ['name_en' => ''];
        $this->assertFalse($this->carbonCalculator->validateActivityData($Silian_invalidUpdate, true));

        $this->assertFalse($this->carbonCalculator->validateActivityData([], true));
    }

    public function testValidateAmount(): void
    {
        $this->assertTrue($this->carbonCalculator->validateAmount(10.5));
        $this->assertTrue($this->carbonCalculator->validateAmount(0.0));
        $this->assertTrue($this->carbonCalculator->validateAmount(1000.0));

        $this->assertFalse($this->carbonCalculator->validateAmount(-5.0));
        $this->assertFalse($this->carbonCalculator->validateAmount(-0.1));
    }

    public function testGetSupportedUnits(): void
    {
        $Silian_units = $this->carbonCalculator->getSupportedUnits();

        $this->assertIsArray($Silian_units);
        $this->assertContains('km', $Silian_units);
        $this->assertContains('kg', $Silian_units);
        $this->assertContains('hours', $Silian_units);
        $this->assertContains('times', $Silian_units);
        $this->assertContains('kWh', $Silian_units);
    }

    public function testGetCarbonFactorByCategory(): void
    {
        // Test getting carbon factors for transport category
        $Silian_transportFactors = $this->carbonCalculator->getCarbonFactorByCategory('transport');

        $this->assertIsArray($Silian_transportFactors);
        $this->assertArrayHasKey('car', $Silian_transportFactors);
        $this->assertArrayHasKey('bus', $Silian_transportFactors);
        $this->assertArrayHasKey('bicycle', $Silian_transportFactors);

        // Test invalid category
        $Silian_invalidFactors = $this->carbonCalculator->getCarbonFactorByCategory('invalid_category');
        $this->assertEmpty($Silian_invalidFactors);
    }

    public function testConvertUnits(): void
    {
        // Test km to m conversion
        $Silian_result = $this->carbonCalculator->convertUnits(5.0, 'km', 'm');
        $this->assertEquals(5000.0, $Silian_result);

        // Test kg to g conversion
        $Silian_result = $this->carbonCalculator->convertUnits(2.5, 'kg', 'g');
        $this->assertEquals(2500.0, $Silian_result);

        // Test same unit conversion
        $Silian_result = $this->carbonCalculator->convertUnits(10.0, 'km', 'km');
        $this->assertEquals(10.0, $Silian_result);

        // Test unsupported conversion
        $Silian_result = $this->carbonCalculator->convertUnits(10.0, 'km', 'invalid_unit');
        $this->assertEquals(10.0, $Silian_result); // Should return original value
    }

    public function testCalculateMonthlyStats(): void
    {
        $Silian_activities = [
            ['carbon_amount' => 10.0, 'points' => 100, 'created_at' => '2025-01-15'],
            ['carbon_amount' => 15.0, 'points' => 150, 'created_at' => '2025-01-20'],
            ['carbon_amount' => 5.0, 'points' => 50, 'created_at' => '2025-01-25'],
        ];

        $Silian_stats = $this->carbonCalculator->calculateMonthlyStats($Silian_activities);

        $this->assertIsArray($Silian_stats);
        $this->assertEquals(30.0, $Silian_stats['total_carbon_saved']);
        $this->assertEquals(300, $Silian_stats['total_points_earned']);
        $this->assertEquals(3, $Silian_stats['total_activities']);
        $this->assertEquals(10.0, $Silian_stats['average_carbon_per_activity']);
    }

    public function testCalculateMonthlyStatsWithEmptyData(): void
    {
        $Silian_activities = [];

        $Silian_stats = $this->carbonCalculator->calculateMonthlyStats($Silian_activities);

        $this->assertIsArray($Silian_stats);
        $this->assertEquals(0.0, $Silian_stats['total_carbon_saved']);
        $this->assertEquals(0, $Silian_stats['total_points_earned']);
        $this->assertEquals(0, $Silian_stats['total_activities']);
        $this->assertEquals(0.0, $Silian_stats['average_carbon_per_activity']);
    }

    public function testCalculateCarbonSavingsWithProvidedActivity(): void
    {
        $Silian_activity = [
            'id' => 'activity-123',
            'name_zh' => '骑行',
            'name_en' => 'Cycling',
            'category' => 'transport',
            'carbon_factor' => 1.5,
            'unit' => 'km',
        ];

        $Silian_result = $this->carbonCalculator->calculateCarbonSavings($Silian_activity['id'], 4.0, $Silian_activity);

        $this->assertEqualsWithDelta(6.0, $Silian_result['carbon_savings'], 0.0001);
        $this->assertSame(60, $Silian_result['points_earned']);
        $this->assertSame(1.5, $Silian_result['carbon_factor']);
        $this->assertSame('km', $Silian_result['unit']);
        $this->assertSame('activity-123', $Silian_result['activity_id']);
        $this->assertSame('骑行', $Silian_result['activity_name_zh']);
        $this->assertSame('Cycling', $Silian_result['activity_name_en']);
    }

    public function testCalculateCarbonSavingsRejectsNegativeInput(): void
    {
        $this->expectException(\InvalidArgumentException::class);

        $this->carbonCalculator->calculateCarbonSavings('activity-negative', -1, [
            'carbon_factor' => 2,
        ]);
    }

    public function testCalculateCarbonSavingsLogsWhenActivityResolveFails(): void
    {
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('log')
            ->with($this->callback(function (array $Silian_payload): bool {
                return ($Silian_payload['action'] ?? null) === 'carbon_activity_resolve_failed'
                    && ($Silian_payload['operation_category'] ?? null) === 'carbon_management';
            }))
            ->willReturn(true);

        $Silian_error = $this->createMock(ErrorLogService::class);
        $Silian_error->expects($this->once())
            ->method('logException')
            ->with(
                $this->isInstanceOf(\Throwable::class),
                $this->anything(),
                $this->arrayHasKey('context_message')
            )
            ->willReturn(1);

        $Silian_service = new CarbonCalculatorService($Silian_logger, $Silian_audit, $Silian_error);

        $this->expectException(\InvalidArgumentException::class);
        $Silian_service->calculateCarbonSavings('missing-activity', 1.0);
    }
}

