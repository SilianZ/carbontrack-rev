<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit;

use PHPUnit\Framework\TestCase;

class BasicTest extends TestCase
{
    public function testPhpVersion(): void
    {
        $this->assertGreaterThanOrEqual('8.2', PHP_VERSION);
    }

    public function testEnvironmentVariables(): void
    {
        // Set test environment if not already set
        if (!isset($_ENV['APP_ENV'])) {
            $_ENV['APP_ENV'] = 'testing';
        }
        if (!isset($_ENV['JWT_SECRET'])) {
            $_ENV['JWT_SECRET'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        }

        $this->assertNotEmpty($_ENV['JWT_SECRET']);
        $this->assertNotEmpty($_ENV['APP_ENV']);
    }

    public function testJsonEncoding(): void
    {
        $Silian_data = ['success' => true, 'message' => 'Test'];
        $Silian_json = json_encode($Silian_data);

        $this->assertIsString($Silian_json);
        $this->assertEquals('{"success":true,"message":"Test"}', $Silian_json);
    }

    public function testPasswordHashing(): void
    {
        $Silian_password = 'testpassword123';
        $Silian_hash = password_hash($Silian_password, PASSWORD_DEFAULT);

        $this->assertIsString($Silian_hash);
        $this->assertTrue(password_verify($Silian_password, $Silian_hash));
        $this->assertFalse(password_verify('wrongpassword', $Silian_hash));
    }

    public function testEmailValidation(): void
    {
        $this->assertTrue(filter_var('test@example.com', FILTER_VALIDATE_EMAIL) !== false);
        $this->assertFalse(filter_var('invalid-email', FILTER_VALIDATE_EMAIL) !== false);
    }

    public function testArrayOperations(): void
    {
        $Silian_data = ['a' => 1, 'b' => 2, 'c' => 3];

        $this->assertArrayHasKey('a', $Silian_data);
        $this->assertEquals(1, $Silian_data['a']);
        $this->assertCount(3, $Silian_data);
    }

    public function testStringOperations(): void
    {
        $Silian_str = 'CarbonTrack API';

        $this->assertStringContainsString('Carbon', $Silian_str);
        $this->assertEquals(15, strlen($Silian_str));
        $this->assertEquals('carbontrack api', strtolower($Silian_str));
    }

    public function testDateOperations(): void
    {
        $Silian_date = new \DateTime('2025-01-01 00:00:00');

        $this->assertEquals('2025-01-01', $Silian_date->format('Y-m-d'));
        $this->assertEquals('00:00:00', $Silian_date->format('H:i:s'));
    }

    public function testMathOperations(): void
    {
        // Test carbon calculation
        $Silian_carbonFactor = 2.5; // kg CO2 per km
        $Silian_distance = 10.0; // km
        $Silian_carbonSaved = $Silian_carbonFactor * $Silian_distance;

        $this->assertEquals(25.0, $Silian_carbonSaved);

        // Test points calculation
        $Silian_pointsPerKg = 10;
        $Silian_points = $Silian_carbonSaved * $Silian_pointsPerKg;

        $this->assertEquals(250, $Silian_points);
    }

    public function testUuidGeneration(): void
    {
        $Silian_uuid = bin2hex(random_bytes(16));

        $this->assertIsString($Silian_uuid);
        $this->assertEquals(32, strlen($Silian_uuid));

        // Generate another UUID and ensure they're different
        $Silian_uuid2 = bin2hex(random_bytes(16));
        $this->assertNotEquals($Silian_uuid, $Silian_uuid2);
    }
}

