<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\AdminAiIntentService;
use CarbonTrack\Services\Ai\LlmClientInterface;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;

class AdminAiIntentServiceTest extends TestCase
{
    public function testServiceReportsDisabledWithoutClient(): void
    {
        $Silian_service = new AdminAiIntentService(null, new NullLogger());

        $this->assertFalse($Silian_service->isEnabled());
        $this->expectException(\RuntimeException::class);
        $Silian_service->analyzeIntent('anything', []);
    }

    public function testAnalyzeIntentParsesActionSuggestion(): void
    {
        $Silian_responsePayload = $this->createChatResponse([
            'intent' => [
                'type' => 'action',
                'label' => 'Approve records 10 and 11',
                'confidence' => 0.88,
                'reasoning' => '明确指出要审批两个记录',
                'action' => [
                    'name' => 'approve_carbon_records',
                    'summary' => 'Approve records 10,11',
                    'api' => [
                        'method' => 'PUT',
                        'path' => '/api/v1/admin/activities/review',
                        'payload' => [
                            'action' => 'approve',
                            'record_ids' => [10, 11],
                            'review_note' => null,
                        ],
                    ],
                    'autoExecute' => true,
                ],
                'missing' => [],
            ],
        ]);

        $Silian_client = new FakeLlmClient($Silian_responsePayload);
        $Silian_auditLogService = $this->createMock(AuditLogService::class);
        $Silian_auditLogService->expects($this->once())->method('logAdminOperation')->willReturn(true);
        $Silian_service = new AdminAiIntentService($Silian_client, new NullLogger(), ['model' => 'test-model'], null, null, $Silian_auditLogService, $this->createMock(ErrorLogService::class));

        $Silian_result = $Silian_service->analyzeIntent('审批 10 11', []);

        $this->assertSame('action', $Silian_result['intent']['type']);
        $this->assertSame('approve_carbon_records', $Silian_result['intent']['action']['name']);
        $this->assertSame([10, 11], $Silian_result['intent']['action']['api']['payload']['record_ids']);
        $this->assertTrue($Silian_result['intent']['action']['autoExecute']);
        $this->assertSame('test-model', $Silian_result['metadata']['model']);
    }

    public function testAnalyzeIntentHeuristicNavigationFallback(): void
    {
        $Silian_responsePayload = $this->createChatResponse([
            'intent' => [
                'type' => 'fallback',
                'label' => 'Activity Review',
                'confidence' => 0.7,
                'reasoning' => 'user asked for carbon record review',
                'target' => [
                    'routeId' => 'carbon record review',
                ],
            ],
        ]);

        $Silian_client = new FakeLlmClient($Silian_responsePayload);
        $Silian_service = new AdminAiIntentService($Silian_client, new NullLogger(), ['model' => 'test-model']);

        $Silian_result = $Silian_service->analyzeIntent('carbon record review', []);

        $this->assertSame('navigate', $Silian_result['intent']['type']);
        $this->assertSame('/admin/activities', $Silian_result['intent']['target']['route']);
    }

    public function testAnalyzeIntentDetectsMissingRequirements(): void
    {
        $Silian_responsePayload = $this->createChatResponse([
            'intent' => [
                'type' => 'action',
                'label' => 'Approve records',
                'confidence' => 0.6,
                'reasoning' => '未提供具体记录ID',
                'action' => [
                    'name' => 'approve_carbon_records',
                    'summary' => 'Approve selected records',
                    'api' => [
                        'method' => 'PUT',
                        'path' => '/api/v1/admin/activities/review',
                        'payload' => [
                            'action' => 'approve',
                            'record_ids' => [],
                        ],
                    ],
                ],
                'missing' => [],
            ],
        ]);

        $Silian_service = new AdminAiIntentService(new FakeLlmClient($Silian_responsePayload), new NullLogger());

        $Silian_result = $Silian_service->analyzeIntent('帮我审批下刚才的活动', []);

        $this->assertSame('action', $Silian_result['intent']['type']);
        $this->assertNotEmpty($Silian_result['intent']['missing']);
        $this->assertSame('record_ids', $Silian_result['intent']['missing'][0]['field']);
    }

    public function testAnalyzeIntentFallsBackWhenRouteUnknown(): void
    {
        $Silian_responsePayload = $this->createChatResponse([
            'intent' => [
                'type' => 'navigate',
                'label' => 'Go somewhere',
                'confidence' => 0.4,
                'target' => [
                    'routeId' => 'non-existent',
                    'route' => '/admin/unknown',
                ],
            ],
        ]);

        $Silian_service = new AdminAiIntentService(new FakeLlmClient($Silian_responsePayload), new NullLogger());
        $Silian_result = $Silian_service->analyzeIntent('去未知页面', []);

        $this->assertSame('fallback', $Silian_result['intent']['type']);
    }

    public function testFallbackHeuristicSuggestsNavigation(): void
    {
        $Silian_responsePayload = $this->createChatResponse([
            'intent' => [
                'type' => 'fallback',
                'label' => 'No match',
                'confidence' => 0.2,
                'reasoning' => 'Not sure what to do',
            ],
        ]);

        $Silian_service = new AdminAiIntentService(new FakeLlmClient($Silian_responsePayload), new NullLogger());

        $Silian_result = $Silian_service->analyzeIntent('carbon record review', []);

        $this->assertSame('navigate', $Silian_result['intent']['type']);
        $this->assertSame('/admin/activities', $Silian_result['intent']['target']['route']);
    }

    public function testCustomConfigurationOverridesDefaults(): void
    {
        $Silian_responsePayload = $this->createChatResponse([
            'intent' => [
                'type' => 'navigate',
                'label' => 'Open custom',
                'confidence' => 0.7,
                'target' => [
                    'routeId' => 'custom-dashboard',
                    'route' => '/admin/custom-dashboard',
                ],
            ],
        ]);

        $Silian_config = [
            'navigationTargets' => [
                [
                    'id' => 'custom-dashboard',
                    'label' => 'Custom Dashboard',
                    'route' => '/admin/custom-dashboard',
                ],
            ],
            'quickActions' => [],
            'managementActions' => [],
        ];

        $Silian_service = new AdminAiIntentService(new FakeLlmClient($Silian_responsePayload), new NullLogger(), [], $Silian_config);

        $Silian_result = $Silian_service->analyzeIntent('打开自定义面板', []);

        $this->assertSame('navigate', $Silian_result['intent']['type']);
        $this->assertSame('/admin/custom-dashboard', $Silian_result['intent']['target']['route']);
    }

    public function testDiagnosticsReportsDisabledWhenClientMissing(): void
    {
        $Silian_service = new AdminAiIntentService(null, new NullLogger());

        $Silian_diagnostics = $Silian_service->getDiagnostics();

        $this->assertFalse($Silian_diagnostics['enabled']);
        $this->assertSame('skipped', $Silian_diagnostics['connectivity']['status']);
        $this->assertFalse($Silian_diagnostics['client']['available']);
    }

    public function testDiagnosticsConnectivityCheckSuccess(): void
    {
        $Silian_response = [
            'model' => 'diag-model',
            'choices' => [
                [
                    'finish_reason' => 'stop',
                    'message' => [
                        'role' => 'assistant',
                        'content' => 'OK',
                    ],
                ],
            ],
            'usage' => [
                'prompt_tokens' => 3,
                'completion_tokens' => 1,
                'total_tokens' => 4,
            ],
        ];

        $Silian_client = new FakeLlmClient($Silian_response);
        $Silian_service = new AdminAiIntentService($Silian_client, new NullLogger(), ['model' => 'diag-model']);

        $Silian_diagnostics = $Silian_service->getDiagnostics(true);

        $this->assertTrue($Silian_diagnostics['enabled']);
        $this->assertSame('ok', $Silian_diagnostics['connectivity']['status']);
        $this->assertSame('diag-model', $Silian_diagnostics['connectivity']['model']);
        $this->assertNotNull($Silian_client->lastPayload);
        $this->assertSame(1, $Silian_client->lastPayload['max_tokens']);
        $this->assertSame('Ping', $Silian_client->lastPayload['messages'][1]['content']);
    }

    public function testDiagnosticsConnectivityCheckError(): void
    {
        $Silian_client = new ThrowingLlmClient(new \RuntimeException('bad gateway'));
        $Silian_auditLogService = $this->createMock(AuditLogService::class);
        $Silian_auditLogService->expects($this->once())->method('logAdminOperation')->willReturn(true);
        $Silian_errorLogService = $this->createMock(ErrorLogService::class);
        $Silian_errorLogService->expects($this->once())->method('logException');
        $Silian_service = new AdminAiIntentService($Silian_client, new NullLogger(), [], null, null, $Silian_auditLogService, $Silian_errorLogService);

        $Silian_diagnostics = $Silian_service->getDiagnostics(true);

        $this->assertSame('error', $Silian_diagnostics['connectivity']['status']);
        $this->assertSame('bad gateway', $Silian_diagnostics['connectivity']['error']);
        $this->assertSame(\RuntimeException::class, $Silian_diagnostics['connectivity']['exception']);
    }

    /**
     * @param array<string,mixed> $content
     * @return array<string,mixed>
     */
    private function createChatResponse(array $Silian_content): array
    {
        return [
            'id' => 'chatcmpl-test',
            'object' => 'chat.completion',
            'created' => time(),
            'model' => 'test-model',
            'choices' => [
                [
                    'index' => 0,
                    'message' => [
                        'role' => 'assistant',
                        'content' => json_encode($Silian_content, JSON_UNESCAPED_UNICODE),
                    ],
                    'finish_reason' => 'stop',
                ],
            ],
            'usage' => [
                'prompt_tokens' => 10,
                'completion_tokens' => 20,
                'total_tokens' => 30,
            ],
        ];
    }
}

class FakeLlmClient implements LlmClientInterface
{
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

    /** @var array<string,mixed>|null */
    public ?array $lastPayload = null;
}

class ThrowingLlmClient implements LlmClientInterface
{
    public function __construct(private \Throwable $throwable)
    {
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public function createChatCompletion(array $Silian_payload): array
    {
        throw $this->throwable;
    }
}

