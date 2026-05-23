<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use CarbonTrack\Controllers\AdminAiController;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\AdminAnnouncementAiUnavailableException;
use CarbonTrack\Services\AdminAnnouncementAiService;
use CarbonTrack\Services\AdminAiAgentService;
use CarbonTrack\Services\AdminAiIntentService;
use CarbonTrack\Services\AdminAiCommandRepository;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\ErrorLogService;
use PHPUnit\Framework\TestCase;
use Psr\Log\NullLogger;
use Slim\Psr7\Response;

class AdminAiControllerTest extends TestCase
{
    private const ACTIVE_CONFIG_PATH = '/path/config.php';
    private const INTENT_ROUTE = '/admin/ai/intents';
    private const CHAT_ROUTE = '/admin/ai/chat';

    public function testAnalyzeReturnsParsedIntent(): void
    {
        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin']);
        $Silian_authService->method('isAdminUser')->willReturn(true);

        $Silian_intentService = $this->createMock(AdminAiIntentService::class);
        $Silian_intentService->method('isEnabled')->willReturn(true);
        $Silian_intentService->method('analyzeIntent')->willReturn([
            'intent' => [
                'type' => 'navigate',
                'label' => 'User Management',
                'confidence' => 0.91,
                'target' => [
                    'routeId' => 'users',
                    'route' => '/admin/users',
                    'mode' => 'navigation',
                    'query' => [],
                ],
                'missing' => [],
            ],
            'alternatives' => [],
            'metadata' => [
                'model' => 'test',
                'usage' => null,
                'finish_reason' => 'stop',
            ],
        ]);

        $Silian_announcementAiService = $this->createMock(AdminAnnouncementAiService::class);

        $Silian_commandRepo = $this->createMock(AdminAiCommandRepository::class);
        $Silian_commandRepo->method('getFingerprint')->willReturn('test-fingerprint');
        $Silian_commandRepo->method('getActivePath')->willReturn(self::ACTIVE_CONFIG_PATH);
        $Silian_commandRepo->method('getLastModified')->willReturn(1234567890);
        $Silian_auditLogService = $this->createMock(AuditLogService::class);
        $Silian_auditLogService->expects($this->once())->method('logAdminOperation')->willReturn(true);

        $Silian_controller = new AdminAiController(
            $Silian_authService,
            $Silian_intentService,
            $Silian_announcementAiService,
            $Silian_commandRepo,
            $Silian_auditLogService,
            $this->createMock(ErrorLogService::class),
            new NullLogger()
        );

        $Silian_request = makeRequest('POST', self::INTENT_ROUTE, ['query' => '打开用户管理']);
        $Silian_response = $Silian_controller->analyze($Silian_request, new Response());

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame('navigate', $Silian_payload['intent']['type']);
        $this->assertSame('users', $Silian_payload['intent']['target']['routeId']);
        $this->assertSame('test', $Silian_payload['metadata']['model']);
        $this->assertArrayHasKey('timestamp', $Silian_payload['metadata']);
    }

    public function testChatReturnsConversationPayload(): void
    {
        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin']);
        $Silian_authService->method('isAdminUser')->willReturn(true);

        $Silian_intentService = $this->createMock(AdminAiIntentService::class);
        $Silian_announcementAiService = $this->createMock(AdminAnnouncementAiService::class);
        $Silian_commandRepo = $this->createMock(AdminAiCommandRepository::class);
        $Silian_auditLogService = $this->createMock(AuditLogService::class);
        $Silian_auditLogService->expects($this->once())->method('logAdminOperation')->willReturn(true);

        $Silian_agentService = $this->createMock(AdminAiAgentService::class);
        $Silian_agentService->method('isEnabled')->willReturn(true);
        $Silian_agentService->expects($this->once())
            ->method('chat')
            ->with(
                null,
                '帮我汇总最近的 AI 会话',
                $this->isType('array'),
                null,
                $this->isType('array')
            )
            ->willReturn([
                'success' => true,
                'conversation_id' => 'admin-ai-12345678',
                'message' => '已整理最近的 AI 会话情况。',
                'conversation' => [
                    'conversation_id' => 'admin-ai-12345678',
                    'summary' => ['message_count' => 2],
                    'messages' => [],
                    'llm_calls' => [],
                    'pending_actions' => [],
                ],
            ]);

        $Silian_controller = new AdminAiController(
            $Silian_authService,
            $Silian_intentService,
            $Silian_announcementAiService,
            $Silian_commandRepo,
            $Silian_auditLogService,
            $this->createMock(ErrorLogService::class),
            new NullLogger(),
            $Silian_agentService
        );

        $Silian_request = makeRequest('POST', self::CHAT_ROUTE, [
            'message' => '帮我汇总最近的 AI 会话',
            'context' => ['activeRoute' => '/admin/llm-usage'],
        ]);
        $Silian_response = $Silian_controller->chat($Silian_request, new Response());

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame('admin-ai-12345678', $Silian_payload['conversation_id']);
    }

    public function testWorkspaceReturnsBootstrapPayload(): void
    {
        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin']);
        $Silian_authService->method('isAdminUser')->willReturn(true);

        $Silian_intentService = $this->createMock(AdminAiIntentService::class);
        $Silian_intentService->method('isEnabled')->willReturn(true);

        $Silian_commandRepo = $this->createMock(AdminAiCommandRepository::class);
        $Silian_commandRepo->method('getConfig')->willReturn([
            'agent' => [
                'default_confirmation_policy' => 'write_requires_confirmation',
                'max_history_messages' => 12,
                'max_auto_read_steps' => 1,
                'systemBehavior' => ['Keep responses concise.'],
            ],
            'navigationTargets' => [
                [
                    'id' => 'aiWorkspace',
                    'label' => 'AI Workspace',
                    'route' => '/admin/ai',
                    'description' => 'Unified admin AI workspace.',
                ],
            ],
            'quickActions' => [
                [
                    'id' => 'open-ai-workspace',
                    'label' => 'Open AI workspace',
                    'description' => 'Jump to the admin AI workspace.',
                    'routeId' => 'aiWorkspace',
                    'route' => '/admin/ai',
                    'mode' => 'shortcut',
                    'query' => ['focus' => 'composer'],
                ],
            ],
            'managementActions' => [
                [
                    'name' => 'generate_admin_report',
                    'label' => 'Generate admin report',
                    'description' => 'Summarize admin operations.',
                    'risk_level' => 'read',
                    'requires_confirmation' => false,
                    'contextHints' => ['selectedUserId'],
                    'requires' => [],
                ],
            ],
        ]);
        $Silian_commandRepo->method('getFingerprint')->willReturn('workspace-fingerprint');
        $Silian_commandRepo->method('getActivePath')->willReturn(self::ACTIVE_CONFIG_PATH);
        $Silian_commandRepo->method('getLastModified')->willReturn(1234567890);

        $Silian_agentService = $this->createMock(AdminAiAgentService::class);
        $Silian_agentService->method('isEnabled')->willReturn(true);
        $Silian_agentService->expects($this->once())
            ->method('listConversations')
            ->with([
                'limit' => 8,
                'admin_id' => 1,
            ])
            ->willReturn([
                [
                    'conversation_id' => 'admin-ai-recent-1',
                    'title' => 'Recent thread',
                    'message_count' => 3,
                ],
            ]);

        $Silian_auditLogService = $this->createMock(AuditLogService::class);
        $Silian_auditLogService->expects($this->once())->method('logAdminOperation')->willReturn(true);

        $Silian_controller = new AdminAiController(
            $Silian_authService,
            $Silian_intentService,
            $this->createMock(AdminAnnouncementAiService::class),
            $Silian_commandRepo,
            $Silian_auditLogService,
            $this->createMock(ErrorLogService::class),
            new NullLogger(),
            $Silian_agentService
        );

        $Silian_request = makeRequest('GET', '/admin/ai/workspace');
        $Silian_response = $Silian_controller->workspace($Silian_request, new Response());

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertTrue($Silian_payload['data']['assistant']['chat_enabled']);
        $this->assertSame('workspace-fingerprint', $Silian_payload['data']['assistant']['commands_fingerprint']);
        $this->assertSame('/admin/ai', $Silian_payload['data']['navigation_targets'][0]['route']);
        $this->assertSame('open-ai-workspace', $Silian_payload['data']['quick_actions'][0]['id']);
        $this->assertSame('generate_admin_report', $Silian_payload['data']['management_actions'][0]['name']);
        $this->assertSame('admin-ai-recent-1', $Silian_payload['data']['recent_conversations'][0]['conversation_id']);
        $this->assertNotEmpty($Silian_payload['data']['starter_prompts']);
    }

    public function testConversationsReturnsSessionList(): void
    {
        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin']);
        $Silian_authService->method('isAdminUser')->willReturn(true);

        $Silian_agentService = $this->createMock(AdminAiAgentService::class);
        $Silian_agentService->expects($this->once())
            ->method('listConversations')
            ->with([
                'limit' => '10',
                'actor_id' => null,
                'admin_id' => '7',
                'status' => 'waiting_confirmation',
                'model' => 'gpt-5.4',
                'date_from' => '2026-03-01',
                'date_to' => '2026-03-22',
                'has_pending_action' => 'true',
                'conversation_id' => 'admin-ai-1',
            ])
            ->willReturn([
                [
                    'conversation_id' => 'admin-ai-1',
                    'title' => '测试会话',
                    'message_count' => 3,
                ],
            ]);

        $Silian_controller = new AdminAiController(
            $Silian_authService,
            $this->createMock(AdminAiIntentService::class),
            $this->createMock(AdminAnnouncementAiService::class),
            $this->createMock(AdminAiCommandRepository::class),
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            new NullLogger(),
            $Silian_agentService
        );

        $Silian_request = makeRequest('GET', '/admin/ai/conversations', null, [
            'limit' => '10',
            'admin_id' => '7',
            'status' => 'waiting_confirmation',
            'model' => 'gpt-5.4',
            'date_from' => '2026-03-01',
            'date_to' => '2026-03-22',
            'has_pending_action' => 'true',
            'conversation_id' => 'admin-ai-1',
        ]);
        $Silian_response = $Silian_controller->conversations($Silian_request, new Response());

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame('admin-ai-1', $Silian_payload['data'][0]['conversation_id']);
    }

    public function testConversationDetailReturnsTimeline(): void
    {
        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin']);
        $Silian_authService->method('isAdminUser')->willReturn(true);

        $Silian_agentService = $this->createMock(AdminAiAgentService::class);
        $Silian_agentService->expects($this->once())
            ->method('getConversationDetail')
            ->with('admin-ai-2')
            ->willReturn([
                'conversation_id' => 'admin-ai-2',
                'summary' => ['message_count' => 4],
                'messages' => [['id' => 1, 'kind' => 'message', 'role' => 'user']],
                'llm_calls' => [],
                'pending_actions' => [],
            ]);

        $Silian_controller = new AdminAiController(
            $Silian_authService,
            $this->createMock(AdminAiIntentService::class),
            $this->createMock(AdminAnnouncementAiService::class),
            $this->createMock(AdminAiCommandRepository::class),
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            new NullLogger(),
            $Silian_agentService
        );

        $Silian_request = makeRequest('GET', '/admin/ai/conversations/admin-ai-2');
        $Silian_response = $Silian_controller->conversationDetail($Silian_request, new Response(), ['conversation_id' => 'admin-ai-2']);

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame(4, $Silian_payload['data']['summary']['message_count']);
    }

    public function testAnalyzeReturns503WhenServiceDisabled(): void
    {
        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin']);
        $Silian_authService->method('isAdminUser')->willReturn(true);

        $Silian_intentService = $this->createMock(AdminAiIntentService::class);
        $Silian_intentService->method('isEnabled')->willReturn(false);

        $Silian_announcementAiService = $this->createMock(AdminAnnouncementAiService::class);
        $Silian_announcementAiService->method('isEnabled')->willReturn(false);

        $Silian_commandRepo = $this->createMock(AdminAiCommandRepository::class);
        $Silian_commandRepo->method('getFingerprint')->willReturn('test');
        $Silian_commandRepo->method('getActivePath')->willReturn(null);
        $Silian_commandRepo->method('getLastModified')->willReturn(null);

        $Silian_controller = new AdminAiController(
            $Silian_authService,
            $Silian_intentService,
            $Silian_announcementAiService,
            $Silian_commandRepo,
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            new NullLogger()
        );

        $Silian_request = makeRequest('POST', self::INTENT_ROUTE, ['query' => 'something']);
        $Silian_response = $Silian_controller->analyze($Silian_request, new Response());

        $this->assertSame(503, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('AI_DISABLED', $Silian_payload['code']);
    }

    public function testAnalyzeValidatesMissingQuery(): void
    {
        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin']);
        $Silian_authService->method('isAdminUser')->willReturn(true);

        $Silian_intentService = $this->createMock(AdminAiIntentService::class);
        $Silian_intentService->method('isEnabled')->willReturn(true);

        $Silian_announcementAiService = $this->createMock(AdminAnnouncementAiService::class);

        $Silian_commandRepo = $this->createMock(AdminAiCommandRepository::class);
        $Silian_commandRepo->method('getFingerprint')->willReturn('test');
        $Silian_commandRepo->method('getActivePath')->willReturn(null);
        $Silian_commandRepo->method('getLastModified')->willReturn(null);

        $Silian_controller = new AdminAiController(
            $Silian_authService,
            $Silian_intentService,
            $Silian_announcementAiService,
            $Silian_commandRepo,
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            new NullLogger()
        );

        $Silian_request = makeRequest('POST', self::INTENT_ROUTE, ['query' => '  ']);
        $Silian_response = $Silian_controller->analyze($Silian_request, new Response());

        $this->assertSame(422, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('INVALID_QUERY', $Silian_payload['code']);
    }

    public function testDiagnosticsReturnsData(): void
    {
        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin']);
        $Silian_authService->method('isAdminUser')->willReturn(true);

        $Silian_intentService = $this->createMock(AdminAiIntentService::class);
        $Silian_intentService
            ->expects($this->once())
            ->method('getDiagnostics')
            ->with(false)
            ->willReturn([
                'enabled' => true,
                'connectivity' => ['status' => 'not_checked'],
            ]);

        $Silian_announcementAiService = $this->createMock(AdminAnnouncementAiService::class);

        $Silian_commandRepo = $this->createMock(AdminAiCommandRepository::class);
        $Silian_commandRepo->method('getFingerprint')->willReturn('test');
        $Silian_commandRepo->method('getActivePath')->willReturn(self::ACTIVE_CONFIG_PATH);
        $Silian_commandRepo->method('getLastModified')->willReturn(987654321);
        $Silian_auditLogService = $this->createMock(AuditLogService::class);
        $Silian_auditLogService->expects($this->once())->method('logAdminOperation')->willReturn(true);

        $Silian_controller = new AdminAiController(
            $Silian_authService,
            $Silian_intentService,
            $Silian_announcementAiService,
            $Silian_commandRepo,
            $Silian_auditLogService,
            $this->createMock(ErrorLogService::class),
            new NullLogger()
        );

        $Silian_request = makeRequest('GET', '/admin/ai/diagnostics');
        $Silian_response = $Silian_controller->diagnostics($Silian_request, new Response());

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertTrue($Silian_payload['diagnostics']['enabled']);
        $this->assertSame('not_checked', $Silian_payload['diagnostics']['connectivity']['status']);
    }

    public function testDiagnosticsHonorsConnectivityFlag(): void
    {
        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin']);
        $Silian_authService->method('isAdminUser')->willReturn(true);

        $Silian_intentService = $this->createMock(AdminAiIntentService::class);
        $Silian_intentService
            ->expects($this->once())
            ->method('getDiagnostics')
            ->with(true)
            ->willReturn([
                'enabled' => true,
                'connectivity' => ['status' => 'ok'],
            ]);

        $Silian_announcementAiService = $this->createMock(AdminAnnouncementAiService::class);

        $Silian_commandRepo = $this->createMock(AdminAiCommandRepository::class);
        $Silian_commandRepo->method('getFingerprint')->willReturn('test');
        $Silian_commandRepo->method('getActivePath')->willReturn(self::ACTIVE_CONFIG_PATH);
        $Silian_commandRepo->method('getLastModified')->willReturn(987654321);

        $Silian_controller = new AdminAiController(
            $Silian_authService,
            $Silian_intentService,
            $Silian_announcementAiService,
            $Silian_commandRepo,
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            new NullLogger()
        );

        $Silian_request = makeRequest('GET', '/admin/ai/diagnostics', null, ['check' => 'true']);
        $Silian_response = $Silian_controller->diagnostics($Silian_request, new Response());

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertSame('ok', $Silian_payload['diagnostics']['connectivity']['status']);
    }

    public function testGenerateAnnouncementDraftReturnsGeneratedPayload(): void
    {
        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin']);
        $Silian_authService->method('isAdminUser')->willReturn(true);

        $Silian_intentService = $this->createMock(AdminAiIntentService::class);
        $Silian_announcementAiService = $this->createMock(AdminAnnouncementAiService::class);
        $Silian_announcementAiService->method('isEnabled')->willReturn(true);
        $Silian_announcementAiService->expects($this->once())
            ->method('generateDraft')
            ->with($this->callback(function (array $Silian_payload) {
                return $Silian_payload['action'] === 'generate'
                    && $Silian_payload['priority'] === 'high'
                    && $Silian_payload['content_format'] === 'html';
            }), $this->anything())
            ->willReturn([
                'success' => true,
                'result' => [
                    'title' => 'Generated announcement',
                    'content' => '<p>Hello admin</p>',
                    'content_format' => 'html',
                    'action' => 'generate',
                ],
                'metadata' => [
                    'model' => 'test-model',
                    'usage' => ['total_tokens' => 10],
                ],
            ]);

        $Silian_commandRepo = $this->createMock(AdminAiCommandRepository::class);
        $Silian_auditLogService = $this->createMock(AuditLogService::class);
        $Silian_auditLogService->expects($this->once())->method('logAdminOperation')->willReturn(true);

        $Silian_controller = new AdminAiController(
            $Silian_authService,
            $Silian_intentService,
            $Silian_announcementAiService,
            $Silian_commandRepo,
            $Silian_auditLogService,
            $this->createMock(ErrorLogService::class),
            new NullLogger()
        );

        $Silian_request = makeRequest('POST', '/admin/ai/announcement-drafts', [
            'action' => 'generate',
            'title' => 'Maintenance',
            'content' => 'Need a draft',
            'priority' => 'high',
            'content_format' => 'html',
            'instruction' => 'Keep it concise',
        ]);
        $Silian_response = $Silian_controller->generateAnnouncementDraft($Silian_request, new Response());

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame('Generated announcement', $Silian_payload['data']['title']);
        $this->assertSame('test-model', $Silian_payload['metadata']['model']);
        $this->assertArrayHasKey('timestamp', $Silian_payload['metadata']);
    }

    public function testGenerateAnnouncementDraftValidatesAction(): void
    {
        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin']);
        $Silian_authService->method('isAdminUser')->willReturn(true);

        $Silian_intentService = $this->createMock(AdminAiIntentService::class);
        $Silian_announcementAiService = $this->createMock(AdminAnnouncementAiService::class);
        $Silian_announcementAiService->method('isEnabled')->willReturn(true);
        $Silian_commandRepo = $this->createMock(AdminAiCommandRepository::class);

        $Silian_controller = new AdminAiController(
            $Silian_authService,
            $Silian_intentService,
            $Silian_announcementAiService,
            $Silian_commandRepo,
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            new NullLogger()
        );

        $Silian_request = makeRequest('POST', '/admin/ai/announcement-drafts', [
            'action' => 'explode',
            'title' => 'Maintenance',
        ]);
        $Silian_response = $Silian_controller->generateAnnouncementDraft($Silian_request, new Response());

        $this->assertSame(422, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('INVALID_ACTION', $Silian_payload['code']);
    }

    public function testGenerateAnnouncementDraftReturns503WhenProviderUnavailable(): void
    {
        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->method('getCurrentUser')->willReturn(['id' => 1, 'role' => 'admin']);
        $Silian_authService->method('isAdminUser')->willReturn(true);

        $Silian_intentService = $this->createMock(AdminAiIntentService::class);
        $Silian_announcementAiService = $this->createMock(AdminAnnouncementAiService::class);
        $Silian_announcementAiService->method('isEnabled')->willReturn(true);
        $Silian_announcementAiService->method('generateDraft')
            ->willThrowException(new AdminAnnouncementAiUnavailableException('LLM_UNAVAILABLE'));

        $Silian_commandRepo = $this->createMock(AdminAiCommandRepository::class);

        $Silian_controller = new AdminAiController(
            $Silian_authService,
            $Silian_intentService,
            $Silian_announcementAiService,
            $Silian_commandRepo,
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            new NullLogger()
        );

        $Silian_request = makeRequest('POST', '/admin/ai/announcement-drafts', [
            'action' => 'generate',
            'title' => 'Maintenance',
            'content' => 'Need a draft',
            'priority' => 'high',
            'content_format' => 'html',
        ]);
        $Silian_response = $Silian_controller->generateAnnouncementDraft($Silian_request, new Response());

        $this->assertSame(503, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('AI_UNAVAILABLE', $Silian_payload['code']);
    }
}

