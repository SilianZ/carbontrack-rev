<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\AdminAnnouncementAiException;
use CarbonTrack\Services\AdminAnnouncementAiService;
use CarbonTrack\Services\AdminAnnouncementAiUnavailableException;
use CarbonTrack\Services\Ai\LlmClientInterface;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

class AdminAnnouncementAiServiceTest extends TestCase
{
    public function testUnavailableExceptionIsAutoloadable(): void
    {
        $this->assertTrue(class_exists(AdminAnnouncementAiUnavailableException::class));
    }

    public function testServiceReportsDisabledWithoutClient(): void
    {
        $Silian_service = new AdminAnnouncementAiService(null, new NullLogger());

        $this->assertFalse($Silian_service->isEnabled());
        $this->expectException(AdminAnnouncementAiException::class);
        $Silian_service->generateDraft(['title' => 'Hello']);
    }

    public function testGenerateDraftParsesJsonPayload(): void
    {
        $Silian_response = [
            'id' => 'chatcmpl-test',
            'model' => 'test-model',
            'choices' => [[
                'message' => [
                    'content' => json_encode([
                        'title' => 'System Maintenance Notice',
                        'content' => '<h2>Maintenance</h2><p>Services will be briefly unavailable tonight.</p>',
                    ], JSON_UNESCAPED_UNICODE),
                ],
                'finish_reason' => 'stop',
            ]],
            'usage' => ['total_tokens' => 42],
        ];

        $Silian_client = new AdminAnnouncementAiFakeLlmClient($Silian_response);
        $Silian_auditLogService = $this->createMock(AuditLogService::class);
        $Silian_auditLogService->expects($this->once())->method('logAdminOperation')->willReturn(true);
        $Silian_service = new AdminAnnouncementAiService($Silian_client, new NullLogger(), ['model' => 'test-model'], null, $Silian_auditLogService, $this->createMock(ErrorLogService::class));

        $Silian_result = $Silian_service->generateDraft([
            'action' => 'generate',
            'title' => 'Maintenance',
            'content' => 'Need a brief announcement',
            'instruction' => 'Keep it concise',
            'priority' => 'high',
            'content_format' => 'html',
        ]);

        $this->assertTrue($Silian_result['success']);
        $this->assertSame('System Maintenance Notice', $Silian_result['result']['title']);
        $this->assertStringContainsString('<h2>Maintenance</h2>', $Silian_result['result']['content']);
        $this->assertSame('html', $Silian_result['result']['content_format']);
        $this->assertSame('test-model', $Silian_result['metadata']['model']);
        $this->assertNotNull($Silian_client->lastPayload);
        $this->assertSame('json_object', $Silian_client->lastPayload['response_format']['type']);
    }

    public function testGenerateDraftHandlesMarkdownWrappedJson(): void
    {
        $Silian_response = [
            'choices' => [[
                'message' => [
                    'content' => "```json\n" . json_encode([
                        'title' => 'FAQ Update',
                        'content' => '<p>Updated frequently asked questions are now available.</p>',
                    ], JSON_UNESCAPED_UNICODE) . "\n```",
                ],
                'finish_reason' => 'stop',
            ]],
        ];

        $Silian_service = new AdminAnnouncementAiService(new AdminAnnouncementAiFakeLlmClient($Silian_response), new NullLogger());
        $Silian_result = $Silian_service->generateDraft([
            'title' => 'FAQ',
            'content' => 'Add update',
        ]);

        $this->assertTrue($Silian_result['success']);
        $this->assertSame('FAQ Update', $Silian_result['result']['title']);
    }

    public function testGenerateDraftFallsBackToHtmlContent(): void
    {
        $Silian_response = [
            'choices' => [[
                'message' => [
                    'content' => '<h3>Reminder</h3><p>Please complete your profile.</p>',
                ],
                'finish_reason' => 'stop',
            ]],
        ];

        $Silian_service = new AdminAnnouncementAiService(new AdminAnnouncementAiFakeLlmClient($Silian_response), new NullLogger());
        $Silian_result = $Silian_service->generateDraft([
            'title' => 'Profile reminder',
        ]);

        $this->assertTrue($Silian_result['success']);
        $this->assertSame('Profile reminder', $Silian_result['result']['title']);
        $this->assertStringContainsString('<h3>Reminder</h3>', $Silian_result['result']['content']);
    }

    public function testGenerateDraftWrapsClientFailureAsUnavailableException(): void
    {
        $Silian_client = new class implements LlmClientInterface {
            public function createChatCompletion(array $Silian_payload): array
            {
                throw new AdminAnnouncementAiTestProviderException('provider down');
            }
        };

        $Silian_auditLogService = $this->createMock(AuditLogService::class);
        $Silian_auditLogService->expects($this->once())->method('logAdminOperation')->willReturn(true);
        $Silian_errorLogService = $this->createMock(ErrorLogService::class);
        $Silian_errorLogService->expects($this->once())->method('logException');
        $Silian_service = new AdminAnnouncementAiService($Silian_client, new NullLogger(), [], null, $Silian_auditLogService, $Silian_errorLogService);

        $this->expectException(AdminAnnouncementAiUnavailableException::class);
        $Silian_service->generateDraft([
            'title' => 'Maintenance',
            'content' => 'Need a draft',
        ]);
    }
}

class AdminAnnouncementAiFakeLlmClient implements LlmClientInterface
{
    /** @var array<string,mixed>|null */
    public ?array $lastPayload = null;

    /**
     * @param array<string,mixed> $response
     */
    public function __construct(private array $response)
    {
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public function createChatCompletion(array $Silian_payload): array
    {
        $this->lastPayload = $Silian_payload;
        return $this->response;
    }
}

class AdminAnnouncementAiTestProviderException extends \RuntimeException
{
}
