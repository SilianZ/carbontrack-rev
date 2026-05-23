<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\UserAiService;
use CarbonTrack\Services\Ai\LlmClientInterface;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

class UserAiServiceTest extends TestCase
{
    private $llmClient;
    private $logger;
    private $auditLogService;
    private $errorLogService;

    protected function setUp(): void
    {
        $this->llmClient = $this->createMock(LlmClientInterface::class);
        $this->logger = new NullLogger();
        $this->auditLogService = $this->createMock(AuditLogService::class);
        $this->errorLogService = $this->createMock(ErrorLogService::class);
    }

    private function createService(array $Silian_config = [], bool $Silian_withClient = true): UserAiService
    {
        return new UserAiService(
            $Silian_withClient ? $this->llmClient : null,
            $this->logger,
            $Silian_config,
            null,
            $this->auditLogService,
            $this->errorLogService
        );
    }

    public function testIsEnabled(): void
    {
        $Silian_serviceWithClient = $this->createService();
        $this->assertTrue($Silian_serviceWithClient->isEnabled());

        $Silian_serviceWithoutClient = $this->createService([], false);
        $this->assertFalse($Silian_serviceWithoutClient->isEnabled());
    }

    public function testSuggestActivityThrowsWhenDisabled(): void
    {
        $Silian_service = $this->createService([], false);

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('AI service is disabled');

        $Silian_service->suggestActivity('some query');
    }

    public function testSuggestActivitySuccess(): void
    {
        $this->auditLogService->expects($this->once())->method('logUserAction')->willReturn(true);

        $Silian_expectedResponse = [
            'activity_name' => 'Bus',
            'amount' => 10,
            'unit' => 'km',
            'activity_uuid' => null,
            'activity_date' => null
        ];

        $Silian_rawResponse = [
            'choices' => [
                [
                    'message' => [
                        'content' => json_encode($Silian_expectedResponse)
                    ]
                ]
            ],
            'model' => 'test-model',
            'usage' => ['total_tokens' => 100]
        ];

        $this->llmClient->expects($this->once())
            ->method('createChatCompletion')
            ->with($this->callback(function ($Silian_payload) {
                return $Silian_payload['model'] === 'google/gemini-2.5-flash-lite'
                    && isset($Silian_payload['messages'][1]['content'])
                    && $Silian_payload['messages'][1]['content'] === 'test query';
            }))
            ->willReturn($Silian_rawResponse);

        $Silian_service = $this->createService();
        $Silian_result = $Silian_service->suggestActivity('test query');

        $this->assertTrue($Silian_result['success']);
        $this->assertEquals($Silian_expectedResponse, $Silian_result['prediction']);
        $this->assertEquals('test-model', $Silian_result['metadata']['model']);
    }

    public function testSuggestActivityHandlesMarkdownJsonBlock(): void
    {
        $Silian_expectedResponse = ['activity' => 'Test', 'activity_uuid' => null, 'activity_date' => null];
        $Silian_jsonString = json_encode($Silian_expectedResponse);
        $Silian_content = "Here is the result:\n```json\n$Silian_jsonString\n```";

        $Silian_rawResponse = [
            'choices' => [
                [
                    'message' => ['content' => $Silian_content]
                ]
            ]
        ];

        $this->llmClient->method('createChatCompletion')->willReturn($Silian_rawResponse);

        $Silian_service = $this->createService();
        $Silian_result = $Silian_service->suggestActivity('test');

        $this->assertTrue($Silian_result['success']);
        $this->assertEquals($Silian_expectedResponse, $Silian_result['prediction']);
    }

    public function testSuggestActivityHandlesFallbackParsing(): void
    {
        $Silian_expectedResponse = ['activity' => 'Test', 'activity_uuid' => null, 'activity_date' => null];
        $Silian_jsonString = json_encode($Silian_expectedResponse);
        $Silian_content = "Sure! $Silian_jsonString is your result.";

        $Silian_rawResponse = [
            'choices' => [
                [
                    'message' => ['content' => $Silian_content]
                ]
            ]
        ];

        $this->llmClient->method('createChatCompletion')->willReturn($Silian_rawResponse);

        $Silian_service = $this->createService();
        $Silian_result = $Silian_service->suggestActivity('test');

        $this->assertTrue($Silian_result['success']);
        $this->assertEquals($Silian_expectedResponse, $Silian_result['prediction']);
    }

    public function testSuggestActivityHandlesInvalidJson(): void
    {
        $Silian_rawResponse = [
            'choices' => [
                [
                    'message' => ['content' => 'Not JSON at all']
                ]
            ]
        ];

        $this->llmClient->method('createChatCompletion')->willReturn($Silian_rawResponse);

        $Silian_service = $this->createService();
        $Silian_result = $Silian_service->suggestActivity('test');

        $this->assertFalse($Silian_result['success']);
        $this->assertEquals('Failed to parse AI response', $Silian_result['error']);
    }

    public function testSuggestActivityHandlesClientException(): void
    {
        $this->auditLogService->expects($this->once())->method('logUserAction')->willReturn(true);
        $this->errorLogService->expects($this->once())->method('logException');

        $this->llmClient->method('createChatCompletion')
            ->willThrowException(new \Exception('API Error'));

        $Silian_service = $this->createService();

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('LLM_UNAVAILABLE');

        $Silian_service->suggestActivity('test');
    }

    public function testConfigOverrides(): void
    {
        $Silian_config = [
            'model' => 'custom-model',
            'temperature' => 0.5,
            'max_tokens' => 1000
        ];

        $Silian_service = $this->createService($Silian_config);

        // We can verify this by checking what createChatCompletion receives
        $this->llmClient->expects($this->once())
            ->method('createChatCompletion')
            ->with($this->callback(function ($Silian_payload) {
                return $Silian_payload['model'] === 'custom-model'
                    && $Silian_payload['temperature'] === 0.5
                    && $Silian_payload['max_tokens'] === 1000;
            }))
            ->willReturn(['choices' => []]); // will fail at parsing but that's fine for this test check

        $Silian_service->suggestActivity('test');
    }
}
