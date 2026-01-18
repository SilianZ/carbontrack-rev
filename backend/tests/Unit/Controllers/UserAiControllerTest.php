<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use CarbonTrack\Controllers\UserAiController;
use CarbonTrack\Services\UserAiService;
use CarbonTrack\Services\CarbonCalculatorService;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use Slim\Psr7\Response;

class UserAiControllerTest extends TestCase
{
    public function testSuggestActivityReturnsPrediction(): void
    {
        $aiService = $this->createMock(UserAiService::class);
        $aiService->method('suggestActivity')->willReturn([
            'success' => true,
            'prediction' => [
                'activity_name' => 'Bus Ride',
                'amount' => 5,
                'unit' => 'km',
                'confidence' => 0.95
            ]
        ]);

        $calculatorService = $this->createMock(CarbonCalculatorService::class);
        $calculatorService->method('getAvailableActivities')->willReturn([
            [
                'name_en' => 'Bus Ride',
                'name_zh' => '公交',
                'category' => 'transport'
            ]
        ]);

        $controller = new UserAiController(
            $aiService,
            $calculatorService,
            new NullLogger()
        );

        $request = makeRequest('POST', '/ai/suggest-activity', ['query' => 'I took a 5km bus ride']);
        $response = $controller->suggestActivity($request, new Response());

        $this->assertSame(200, $response->getStatusCode());
        $payload = json_decode((string) $response->getBody(), true);
        $this->assertTrue($payload['success']);
        $this->assertSame('Bus Ride', $payload['prediction']['activity_name']);
        $this->assertSame(5, $payload['prediction']['amount']);
    }

    public function testSuggestActivityValidatesEmptyQuery(): void
    {
        $aiService = $this->createMock(UserAiService::class);
        $calculatorService = $this->createMock(CarbonCalculatorService::class);

        $controller = new UserAiController(
            $aiService,
            $calculatorService,
            new NullLogger()
        );

        $request = makeRequest('POST', '/ai/suggest-activity', ['query' => '   ']);
        $response = $controller->suggestActivity($request, new Response());

        $this->assertSame(400, $response->getStatusCode());
        $payload = json_decode((string) $response->getBody(), true);
        $this->assertFalse($payload['success']);
        $this->assertSame('Query is required', $payload['error']);
    }

    public function testSuggestActivityHandlesServiceException(): void
    {
        $aiService = $this->createMock(UserAiService::class);
        $aiService->method('suggestActivity')->willThrowException(new \RuntimeException('Service unavailable'));

        $calculatorService = $this->createMock(CarbonCalculatorService::class);
        $calculatorService->method('getAvailableActivities')->willReturn([]);

        $controller = new UserAiController(
            $aiService,
            $calculatorService,
            new NullLogger()
        );

        $request = makeRequest('POST', '/ai/suggest-activity', ['query' => 'test']);
        $response = $controller->suggestActivity($request, new Response());

        $this->assertSame(503, $response->getStatusCode());
        $payload = json_decode((string) $response->getBody(), true);
        $this->assertFalse($payload['success']);
    }
}
