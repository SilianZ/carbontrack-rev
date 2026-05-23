<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use CarbonTrack\Controllers\UserAiController;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\UserAiService;
use CarbonTrack\Services\CarbonCalculatorService;
use CarbonTrack\Services\QuotaService;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\ErrorLogService;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use Slim\Psr7\Response;

// Ensure makeRequest is available
require_once __DIR__ . '/../../bootstrap.php';

class UserAiControllerTest extends TestCase
{
    private $aiService;
    private $calculatorService;
    private $quotaService;
    private $authService;
    private $logger;
    private $auditLogService;
    private $errorLogService;

    protected function setUp(): void
    {
        $this->aiService = $this->createMock(UserAiService::class);
        $this->calculatorService = $this->createMock(CarbonCalculatorService::class);
        $this->quotaService = $this->createMock(QuotaService::class);
        $this->authService = $this->createMock(AuthService::class);
        $this->logger = new NullLogger();
        $this->auditLogService = $this->createMock(AuditLogService::class);
        $this->errorLogService = $this->createMock(ErrorLogService::class);

        // Default quota check pass
        $this->quotaService->method('checkAndConsume')->willReturn(true);

        // Mock getUserIdFromRequest
        $this->authService->method('getUserIdFromRequest')->willReturn(1);
        $this->authService->method('getCurrentUserModel')->willReturn($this->createMock(\CarbonTrack\Models\User::class));
    }

    private function createController(): UserAiController
    {
        return new UserAiController(
            $this->aiService,
            $this->calculatorService,
            $this->quotaService,
            $this->logger,
            $this->authService,
            $this->auditLogService,
            $this->errorLogService
        );
    }

    public function testSuggestActivityReturnsPrediction(): void
    {
        $this->auditLogService->expects($this->once())->method('logUserAction')->willReturn(true);

        $this->aiService->method('suggestActivity')->willReturn([
            'success' => true,
            'prediction' => [
                'activity_name' => 'Bus Ride',
                'amount' => 5,
                'unit' => 'km',
                'confidence' => 0.95
            ]
        ]);

        $this->calculatorService->method('getAvailableActivities')->willReturn([
            [
                'name_en' => 'Bus Ride',
                'name_zh' => '公交',
                'category' => 'transport'
            ]
        ]);

        $Silian_controller = $this->createController();

        $Silian_request = makeRequest('POST', '/ai/suggest-activity', ['query' => 'I took a 5km bus ride']);
        $Silian_response = $Silian_controller->suggestActivity($Silian_request, new Response());

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame('Bus Ride', $Silian_payload['prediction']['activity_name']);
        $this->assertSame(5, $Silian_payload['prediction']['amount']);
    }

    public function testSuggestActivityValidatesEmptyQuery(): void
    {
        $this->auditLogService->expects($this->once())->method('logUserAction')->willReturn(true);

        $Silian_controller = $this->createController();

        $Silian_request = makeRequest('POST', '/ai/suggest-activity', ['query' => '   ']);
        $Silian_response = $Silian_controller->suggestActivity($Silian_request, new Response());

        $this->assertSame(400, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('Query is required', $Silian_payload['error']);
    }

    public function testSuggestActivityHandlesServiceException(): void
    {
        $this->auditLogService->expects($this->once())->method('logUserAction')->willReturn(true);
        $this->errorLogService->expects($this->once())->method('logException');

        $this->aiService->method('suggestActivity')->willThrowException(new \RuntimeException('Service unavailable'));
        $this->calculatorService->method('getAvailableActivities')->willReturn([]);

        $Silian_controller = $this->createController();

        $Silian_request = makeRequest('POST', '/ai/suggest-activity', ['query' => 'test']);
        $Silian_response = $Silian_controller->suggestActivity($Silian_request, new Response());

        $this->assertSame(503, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
    }

    public function testSuggestActivityEnforcesQuota(): void
    {
        // Re-configure the stub for this specific test
        $this->quotaService = $this->createMock(QuotaService::class);
        $this->quotaService->method('checkAndConsume')->willReturn(false);
        $this->auditLogService = $this->createMock(AuditLogService::class);
        $this->auditLogService->expects($this->once())->method('logUserAction')->willReturn(true);

        $this->authService = $this->createMock(AuthService::class);
        $this->authService->method('getCurrentUserModel')->willReturn($this->createMock(\CarbonTrack\Models\User::class));

        $Silian_controller = $this->createController();

        $Silian_request = makeRequest('POST', '/ai/suggest-activity', ['query' => 'test']);
        $Silian_response = $Silian_controller->suggestActivity($Silian_request, new Response());

        // Assuming controller returns 429 when checkAndConsume returns false
        $this->assertSame(429, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('Daily limit or rate limit exceeded', $Silian_payload['error']);
    }
}
