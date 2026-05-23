<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Performance;

use PHPUnit\Framework\TestCase;

class ApiPerformanceTest extends TestCase
{
    public function testCarbonCalculationPerformance(): void
    {
        $Silian_iterations = 1000;
        $Silian_startTime = microtime(true);

        for ($Silian_i = 0; $Silian_i < $Silian_iterations; $Silian_i++) {
            // Simulate carbon calculation
            $Silian_carbonFactor = 2.5;
            $Silian_amount = rand(1, 100);
            $Silian_carbonSaved = $Silian_carbonFactor * $Silian_amount;
            $Silian_points = $Silian_carbonSaved * 10;

            // Basic validation
            $this->assertGreaterThan(0, $Silian_carbonSaved);
            $this->assertGreaterThan(0, $Silian_points);
        }

        $Silian_endTime = microtime(true);
        $Silian_totalTime = $Silian_endTime - $Silian_startTime;
        $Silian_avgTime = $Silian_totalTime / $Silian_iterations;

        // Assert that average calculation time is under 1ms
        $this->assertLessThan(0.001, $Silian_avgTime,
            "Carbon calculation should complete in under 1ms on average. Actual: {$Silian_avgTime}s");

        echo "\nPerformance Results:\n";
        echo "Total iterations: {$Silian_iterations}\n";
        echo "Total time: " . round($Silian_totalTime * 1000, 2) . "ms\n";
        echo "Average time per calculation: " . round($Silian_avgTime * 1000, 4) . "ms\n";
    }

    public function testPasswordHashingPerformance(): void
    {
        $Silian_iterations = 10; // Fewer iterations as password hashing is intentionally slow
        $Silian_startTime = microtime(true);

        for ($Silian_i = 0; $Silian_i < $Silian_iterations; $Silian_i++) {
            $Silian_password = 'testpassword' . $Silian_i;
            $Silian_hash = password_hash($Silian_password, PASSWORD_DEFAULT);
            $this->assertTrue(password_verify($Silian_password, $Silian_hash));
        }

        $Silian_endTime = microtime(true);
        $Silian_totalTime = $Silian_endTime - $Silian_startTime;
        $Silian_avgTime = $Silian_totalTime / $Silian_iterations;

        // Password hashing should be reasonably fast but secure
        $this->assertLessThan(1.0, $Silian_avgTime,
            "Password hashing should complete in under 1 second on average. Actual: {$Silian_avgTime}s");

        echo "\nPassword Hashing Performance:\n";
        echo "Total iterations: {$Silian_iterations}\n";
        echo "Total time: " . round($Silian_totalTime * 1000, 2) . "ms\n";
        echo "Average time per hash: " . round($Silian_avgTime * 1000, 2) . "ms\n";
    }

    public function testJsonProcessingPerformance(): void
    {
        $Silian_iterations = 10000;
        $Silian_testData = [
            'user_id' => 123,
            'activity' => 'walking',
            'amount' => 5.5,
            'carbon_saved' => 13.75,
            'points' => 137,
            'timestamp' => '2025-01-01 12:00:00',
            'metadata' => [
                'location' => 'Beijing',
                'weather' => 'sunny',
                'temperature' => 25
            ]
        ];

        $Silian_startTime = microtime(true);

        for ($Silian_i = 0; $Silian_i < $Silian_iterations; $Silian_i++) {
            $Silian_json = json_encode($Silian_testData);
            $Silian_decoded = json_decode($Silian_json, true);

            $this->assertIsString($Silian_json);
            $this->assertIsArray($Silian_decoded);
            $this->assertEquals($Silian_testData['user_id'], $Silian_decoded['user_id']);
        }

        $Silian_endTime = microtime(true);
        $Silian_totalTime = $Silian_endTime - $Silian_startTime;
        $Silian_avgTime = $Silian_totalTime / $Silian_iterations;

        // JSON processing should be very fast
        $this->assertLessThan(0.0001, $Silian_avgTime,
            "JSON processing should complete in under 0.1ms on average. Actual: {$Silian_avgTime}s");

        echo "\nJSON Processing Performance:\n";
        echo "Total iterations: {$Silian_iterations}\n";
        echo "Total time: " . round($Silian_totalTime * 1000, 2) . "ms\n";
        echo "Average time per operation: " . round($Silian_avgTime * 1000, 4) . "ms\n";
    }

    public function testMemoryUsage(): void
    {
        $Silian_initialMemory = memory_get_usage();

        // Simulate processing multiple activities
        $Silian_activities = [];
        for ($Silian_i = 0; $Silian_i < 1000; $Silian_i++) {
            $Silian_activities[] = [
                'id' => $Silian_i,
                'type' => 'walking',
                'amount' => rand(1, 20),
                'carbon_saved' => rand(1, 50),
                'points' => rand(10, 500),
                'created_at' => date('Y-m-d H:i:s')
            ];
        }

        $Silian_peakMemory = memory_get_peak_usage();
        $Silian_memoryUsed = $Silian_peakMemory - $Silian_initialMemory;

        // Memory usage should be reasonable (under 10MB for 1000 activities)
        $this->assertLessThan(10 * 1024 * 1024, $Silian_memoryUsed,
            "Memory usage should be under 10MB. Actual: " . round($Silian_memoryUsed / 1024 / 1024, 2) . "MB");

        echo "\nMemory Usage Test:\n";
        echo "Activities processed: 1000\n";
        echo "Memory used: " . round($Silian_memoryUsed / 1024 / 1024, 2) . "MB\n";
        echo "Peak memory: " . round($Silian_peakMemory / 1024 / 1024, 2) . "MB\n";
    }
}

