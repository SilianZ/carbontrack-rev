<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\AdminAiAgentService;
use CarbonTrack\Services\Ai\LlmClientInterface;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\BadgeService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\LlmLogService;
use CarbonTrack\Services\MessageService;
use CarbonTrack\Tests\Integration\TestSchemaBuilder;
use Monolog\Logger;
use PHPUnit\Framework\TestCase;
use PDO;
use Psr\Log\NullLogger;

class AdminAiAgentServiceTest extends TestCase
{
    private function makePdo(): PDO
    {
        $Silian_pdo = new PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        TestSchemaBuilder::init($Silian_pdo);
        return $Silian_pdo;
    }

    public function testChatCreatesConversationAndRestoresHistoryFromLogs(): void
    {
        $Silian_pdo = $this->makePdo();
        $Silian_logger = new Logger('test');
        $Silian_auditLogService = new AuditLogService($Silian_pdo, $Silian_logger);
        $Silian_llmLogService = new LlmLogService($Silian_pdo, $Silian_logger);
        $Silian_errorLogService = new ErrorLogService($Silian_pdo, new NullLogger());

        $Silian_activityId = '550e8400-e29b-41d4-a716-446655440001';
        $Silian_pdo->exec("INSERT INTO users (id, username, email, status, is_admin, uuid) VALUES (2, 'review_user', 'review@example.com', 'active', 0, '550e8400-e29b-41d4-a716-4466554400b2')");
        $Silian_pdo->exec("INSERT INTO carbon_records (id, user_id, activity_id, status, date, carbon_saved, points_earned) VALUES ('rec-read-1', 2, '{$Silian_activityId}', 'pending', '2026-03-20', 3.5, 8)");

        $Silian_service = new AdminAiAgentService(
            $Silian_pdo,
            new QueueLlmClient([
                $this->toolResponse('manage_admin', [
                    'action' => 'get_pending_carbon_records',
                    'payload' => [
                        'limit' => 5,
                    ],
                ]),
            ]),
            new NullLogger(),
            ['model' => 'test-model'],
            [
                'agent' => ['max_history_messages' => 12],
                'managementActions' => [
                    [
                        'name' => 'get_pending_carbon_records',
                        'label' => 'Get pending carbon records',
                        'description' => 'Read pending carbon records.',
                        'api' => ['payloadTemplate' => ['status' => 'pending', 'limit' => 5, 'record_ids' => []]],
                        'requires' => [],
                        'contextHints' => [],
                        'risk_level' => 'read',
                        'requires_confirmation' => false,
                    ],
                ],
            ],
            $Silian_llmLogService,
            $Silian_auditLogService,
            $Silian_errorLogService
        );

        $Silian_result = $Silian_service->chat(null, '查看待审核碳记录', [], null, [
            'request_id' => 'req-read-1',
            'actor_type' => 'admin',
            'actor_id' => 1,
            'source' => '/admin/ai/chat',
        ]);

        $this->assertTrue($Silian_result['success']);
        $this->assertNotEmpty($Silian_result['conversation_id']);
        $this->assertStringContainsString('待处理记录', $Silian_result['message']);
        $this->assertSame(1, $Silian_result['conversation']['summary']['llm_calls']);
        $this->assertCount(2, array_filter($Silian_result['conversation']['messages'], static fn (array $Silian_item): bool => ($Silian_item['kind'] ?? null) === 'message'));
        $Silian_conversationCount = (int) $Silian_pdo->query("SELECT COUNT(*) FROM admin_ai_conversations WHERE conversation_id IS NOT NULL")->fetchColumn();
        $Silian_messageCount = (int) $Silian_pdo->query("SELECT COUNT(*) FROM admin_ai_messages WHERE conversation_id IS NOT NULL")->fetchColumn();
        $this->assertSame(1, $Silian_conversationCount);
        $this->assertSame(3, $Silian_messageCount);

        $Silian_llmCount = (int) $Silian_pdo->query("SELECT COUNT(*) FROM llm_logs WHERE conversation_id IS NOT NULL")->fetchColumn();
        $this->assertSame(1, $Silian_llmCount);
    }

    public function testApplyPayloadTemplateDoesNotInjectCronWriteDefaults(): void
    {
        $Silian_service = new AdminAiAgentService(
            $this->makePdo(),
            new QueueLlmClient([]),
            new NullLogger(),
            ['model' => 'test-model'],
            [
                'managementActions' => [
                    [
                        'name' => 'update_cron_task',
                        'label' => 'Update cron task',
                        'description' => 'Update cron task.',
                        'api' => ['payloadTemplate' => ['task_key' => null]],
                        'requires' => ['task_key'],
                        'contextHints' => [],
                        'risk_level' => 'write',
                        'requires_confirmation' => true,
                    ],
                ],
            ]
        );

        $Silian_method = new \ReflectionMethod($Silian_service, 'applyPayloadTemplate');
        $Silian_method->setAccessible(true);

        $Silian_payload = $Silian_method->invoke($Silian_service, [
            'api' => ['payloadTemplate' => ['task_key' => null]],
            'contextHints' => [],
        ], [
            'task_key' => 'legacy_removed_task',
            'enabled' => false,
        ], []);

        $this->assertSame('legacy_removed_task', $Silian_payload['task_key']);
        $this->assertFalse($Silian_payload['enabled']);
        $this->assertArrayNotHasKey('interval_minutes', $Silian_payload);
    }

    public function testChatRestoresConversationFromLlmLogsWhenAuditWritesFail(): void
    {
        $Silian_pdo = $this->makePdo();
        $Silian_llmLogService = new LlmLogService($Silian_pdo, new Logger('test'));
        $Silian_errorLogService = new ErrorLogService($Silian_pdo, new NullLogger());

        $Silian_activityId = '550e8400-e29b-41d4-a716-446655440001';
        $Silian_pdo->exec("INSERT INTO users (id, username, email, status, is_admin, uuid) VALUES (2, 'review_user', 'review@example.com', 'active', 0, '550e8400-e29b-41d4-a716-4466554400b4')");
        $Silian_pdo->exec("INSERT INTO carbon_records (id, user_id, activity_id, status, date, carbon_saved, points_earned) VALUES ('rec-read-2', 2, '{$Silian_activityId}', 'pending', '2026-03-20', 3.5, 8)");

        $Silian_auditLogService = $this->getMockBuilder(AuditLogService::class)
            ->setConstructorArgs([$Silian_pdo, new Logger('test')])
            ->onlyMethods(['logAdminOperation', 'getLastInsertId'])
            ->getMock();
        $Silian_auditLogService->method('logAdminOperation')->willReturn(false);
        $Silian_auditLogService->method('getLastInsertId')->willReturn(null);

        $Silian_service = new AdminAiAgentService(
            $Silian_pdo,
            new QueueLlmClient([
                $this->toolResponse('manage_admin', [
                    'action' => 'get_pending_carbon_records',
                    'payload' => [
                        'limit' => 5,
                    ],
                ]),
            ]),
            new NullLogger(),
            ['model' => 'test-model'],
            [
                'agent' => ['max_history_messages' => 12],
                'managementActions' => [
                    [
                        'name' => 'get_pending_carbon_records',
                        'label' => 'Get pending carbon records',
                        'description' => 'Read pending carbon records.',
                        'api' => ['payloadTemplate' => ['status' => 'pending', 'limit' => 5, 'record_ids' => []]],
                        'requires' => [],
                        'contextHints' => [],
                        'risk_level' => 'read',
                        'requires_confirmation' => false,
                    ],
                ],
            ],
            $Silian_llmLogService,
            $Silian_auditLogService,
            $Silian_errorLogService
        );

        $Silian_result = $Silian_service->chat(null, '查看待审核碳记录', [], null, [
            'request_id' => 'req-read-fallback-1',
            'actor_type' => 'admin',
            'actor_id' => 1,
            'source' => '/admin/ai/chat',
        ]);

        $this->assertTrue($Silian_result['success']);
        $Silian_visibleMessages = array_values(array_filter($Silian_result['conversation']['messages'], static fn (array $Silian_item): bool => ($Silian_item['kind'] ?? null) === 'message'));
        $this->assertCount(2, $Silian_visibleMessages);
        $this->assertSame('查看待审核碳记录', $Silian_visibleMessages[0]['content']);
        $this->assertStringContainsString('待处理记录', (string) $Silian_visibleMessages[1]['content']);

        $Silian_conversations = $Silian_service->listConversations(['admin_id' => 1]);
        $this->assertCount(1, $Silian_conversations);
        $this->assertSame($Silian_result['conversation_id'], $Silian_conversations[0]['conversation_id']);
        $this->assertSame(2, $Silian_conversations[0]['message_count']);
        $this->assertStringContainsString('待处理记录', (string) $Silian_conversations[0]['last_message_preview']);
        $Silian_storedCount = (int) $Silian_pdo->query("SELECT COUNT(*) FROM admin_ai_messages WHERE conversation_id = '{$Silian_result['conversation_id']}'")->fetchColumn();
        $this->assertSame(3, $Silian_storedCount);
    }

    public function testChatFallsBackToKeywordMatchedActionWhenModelReturnsNoToolCall(): void
    {
        $Silian_pdo = $this->makePdo();
        $Silian_logger = new Logger('test');
        $Silian_auditLogService = new AuditLogService($Silian_pdo, $Silian_logger);
        $Silian_llmLogService = new LlmLogService($Silian_pdo, $Silian_logger);
        $Silian_errorLogService = new ErrorLogService($Silian_pdo, new NullLogger());

        $Silian_activityId = '550e8400-e29b-41d4-a716-446655440001';
        $Silian_pdo->exec("INSERT INTO users (id, username, email, status, is_admin, uuid) VALUES (2, 'review_user', 'review@example.com', 'active', 0, '550e8400-e29b-41d4-a716-4466554400b7')");
        $Silian_pdo->exec("INSERT INTO carbon_records (id, user_id, activity_id, status, date, carbon_saved, points_earned) VALUES ('rec-read-3', 2, '{$Silian_activityId}', 'pending', '2026-03-20', 2.4, 6)");

        $Silian_service = new AdminAiAgentService(
            $Silian_pdo,
            new QueueLlmClient([
                $this->plainTextResponse('我先想想。'),
            ]),
            new NullLogger(),
            ['model' => 'test-model'],
            [
                'agent' => ['max_history_messages' => 12],
                'managementActions' => [
                    [
                        'name' => 'get_pending_carbon_records',
                        'label' => 'Get pending carbon records',
                        'description' => 'Read pending carbon records.',
                        'api' => ['payloadTemplate' => ['status' => 'pending', 'limit' => 5, 'record_ids' => []]],
                        'requires' => [],
                        'contextHints' => [],
                        'risk_level' => 'read',
                        'requires_confirmation' => false,
                        'keywords' => ['待审核碳记录', '待审核记录', '碳记录', '待审批'],
                    ],
                ],
            ],
            $Silian_llmLogService,
            $Silian_auditLogService,
            $Silian_errorLogService
        );

        $Silian_result = $Silian_service->chat(null, '帮我查看当前待审核碳记录，并按优先级给出处理建议。', [], null, [
            'request_id' => 'req-read-heuristic-1',
            'actor_type' => 'admin',
            'actor_id' => 1,
            'source' => '/admin/ai/chat',
        ]);

        $this->assertTrue($Silian_result['success']);
        $this->assertStringContainsString('待处理记录', $Silian_result['message']);
        $Silian_toolEvents = array_values(array_filter(
            $Silian_result['conversation']['messages'],
            static fn (array $Silian_item): bool => ($Silian_item['kind'] ?? null) === 'tool'
        ));
        $this->assertCount(1, $Silian_toolEvents);
        $this->assertSame('get_pending_carbon_records', $Silian_toolEvents[0]['meta']['data']['action_name']);
    }

    public function testWriteActionRequiresConfirmationAndExecutesAfterDecision(): void
    {
        $Silian_pdo = $this->makePdo();
        $Silian_logger = new Logger('test');
        $Silian_auditLogService = new AuditLogService($Silian_pdo, $Silian_logger);
        $Silian_llmLogService = new LlmLogService($Silian_pdo, $Silian_logger);
        $Silian_errorLogService = new ErrorLogService($Silian_pdo, new NullLogger());

        $Silian_activityId = '550e8400-e29b-41d4-a716-446655440001';
        $Silian_pdo->exec("INSERT INTO users (id, username, email, status, is_admin, points, uuid) VALUES (2, 'review_user', 'review@example.com', 'active', 0, 10, '550e8400-e29b-41d4-a716-4466554400b3')");
        $Silian_pdo->exec("INSERT INTO carbon_records (id, user_id, activity_id, status, date, carbon_saved, points_earned) VALUES ('rec-write-1', 2, '{$Silian_activityId}', 'pending', '2026-03-20', 3.5, 8)");

        $Silian_messageService = $this->getMockBuilder(MessageService::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['sendCarbonRecordReviewSummary'])
            ->getMock();
        $Silian_messageService->expects($this->once())
            ->method('sendCarbonRecordReviewSummary');

        $Silian_service = new AdminAiAgentService(
            $Silian_pdo,
            new QueueLlmClient([
                $this->toolResponse('manage_admin', [
                    'action' => 'approve_carbon_records',
                    'payload' => [
                        'record_ids' => ['rec-write-1'],
                        'review_note' => '批量通过',
                    ],
                ]),
            ]),
            new NullLogger(),
            ['model' => 'test-model'],
            [
                'agent' => ['max_history_messages' => 12],
                'managementActions' => [
                    [
                        'name' => 'approve_carbon_records',
                        'label' => 'Approve carbon reduction records',
                        'description' => 'Approve pending records.',
                        'api' => ['payloadTemplate' => ['action' => 'approve', 'record_ids' => [], 'review_note' => null]],
                        'requires' => ['record_ids'],
                        'contextHints' => [],
                        'risk_level' => 'write',
                        'requires_confirmation' => true,
                    ],
                ],
            ],
            $Silian_llmLogService,
            $Silian_auditLogService,
            $Silian_errorLogService,
            null,
            $Silian_messageService
        );

        $Silian_proposalResult = $Silian_service->chat(null, '审批 rec-write-1', [], null, [
            'request_id' => 'req-write-1',
            'actor_type' => 'admin',
            'actor_id' => 1,
            'source' => '/admin/ai/chat',
        ]);

        $this->assertTrue($Silian_proposalResult['success']);
        $this->assertSame('pending', $Silian_proposalResult['conversation']['pending_actions'][0]['status']);
        $Silian_statusBefore = $Silian_pdo->query("SELECT status FROM carbon_records WHERE id = 'rec-write-1'")->fetchColumn();
        $this->assertSame('pending', $Silian_statusBefore);

        $Silian_proposalId = $Silian_proposalResult['conversation']['pending_actions'][0]['proposal_id'];
        $Silian_decisionResult = $Silian_service->chat(
            $Silian_proposalResult['conversation_id'],
            null,
            [],
            ['proposal_id' => $Silian_proposalId, 'outcome' => 'confirm'],
            [
                'request_id' => 'req-write-2',
                'actor_type' => 'admin',
                'actor_id' => 1,
                'source' => '/admin/ai/chat',
            ]
        );

        $this->assertTrue($Silian_decisionResult['success']);
        $this->assertStringContainsString('已批准', $Silian_decisionResult['message']);
        $Silian_statusAfter = $Silian_pdo->query("SELECT status FROM carbon_records WHERE id = 'rec-write-1'")->fetchColumn();
        $this->assertSame('approved', $Silian_statusAfter);

        $Silian_executedCount = (int) $Silian_pdo->query("SELECT COUNT(*) FROM audit_logs WHERE action = 'admin_ai_action_executed'")->fetchColumn();
        $this->assertSame(1, $Silian_executedCount);
    }

    public function testListConversationsSupportsStatusModelDateAndPendingFilters(): void
    {
        $Silian_pdo = $this->makePdo();
        $Silian_auditLogService = new AuditLogService($Silian_pdo, new Logger('test'));
        $Silian_llmLogService = new LlmLogService($Silian_pdo, new Logger('test'));

        $Silian_service = new AdminAiAgentService(
            $Silian_pdo,
            new QueueLlmClient([]),
            new NullLogger(),
            ['model' => 'test-model'],
            ['agent' => ['max_history_messages' => 12]],
            $Silian_llmLogService,
            $Silian_auditLogService
        );

        $Silian_pdo->exec("
            INSERT INTO admin_ai_conversations (conversation_id, admin_id, title, last_message_preview, started_at, last_activity_at)
            VALUES
            ('admin-ai-11111111', 7, '会话一', '待确认', '2026-03-20 10:00:00', '2026-03-20 10:05:00'),
            ('admin-ai-22222222', 9, '会话二', '会话二', '2026-03-18 09:00:00', '2026-03-18 09:00:00')
        ");
        $Silian_pdo->exec("
            INSERT INTO admin_ai_messages (conversation_id, kind, role, action, status, content, meta_json, created_at)
            VALUES
            ('admin-ai-11111111', 'message', 'user', 'admin_ai_user_message', 'success', '会话一', '{\"data\":{\"visible_text\":\"会话一\"}}', '2026-03-20 10:00:00'),
            ('admin-ai-11111111', 'action_proposed', NULL, 'admin_ai_action_proposed', 'pending', '待确认', '{\"data\":{\"action_name\":\"approve_carbon_records\",\"label\":\"Approve\",\"summary\":\"待确认\",\"payload\":{\"record_ids\":[\"rec-1\"]},\"risk_level\":\"write\"}}', '2026-03-20 10:05:00'),
            ('admin-ai-22222222', 'message', 'user', 'admin_ai_user_message', 'success', '会话二', '{\"data\":{\"visible_text\":\"会话二\"}}', '2026-03-18 09:00:00')
        ");
        $Silian_pdo->exec("
            INSERT INTO llm_logs (request_id, actor_type, actor_id, conversation_id, turn_no, source, model, prompt, response_raw, status, total_tokens, created_at)
            VALUES
            ('req-a', 'admin', 7, 'admin-ai-11111111', 1, '/admin/ai/chat', 'gpt-5.4', 'hello', '{\"ok\":true}', 'success', 11, '2026-03-20 10:01:00'),
            ('req-b', 'admin', 9, 'admin-ai-22222222', 1, '/admin/ai/chat', 'gemini-2.5-flash', 'hello', '{\"ok\":true}', 'success', 9, '2026-03-18 09:01:00')
        ");

        $Silian_filtered = $Silian_service->listConversations([
            'admin_id' => 7,
            'status' => 'waiting_confirmation',
            'model' => 'gpt-5.4',
            'date_from' => '2026-03-19',
            'date_to' => '2026-03-21',
            'has_pending_action' => 'true',
        ]);

        $this->assertCount(1, $Silian_filtered);
        $this->assertSame('admin-ai-11111111', $Silian_filtered[0]['conversation_id']);
        $this->assertSame(7, $Silian_filtered[0]['admin_id']);
        $this->assertSame('waiting_confirmation', $Silian_filtered[0]['status']);
        $this->assertSame(1, $Silian_filtered[0]['pending_action_count']);
        $this->assertSame('gpt-5.4', $Silian_filtered[0]['last_model']);
    }

    public function testSearchUsersReadActionReturnsUserMatches(): void
    {
        $Silian_pdo = $this->makePdo();
        $Silian_logger = new Logger('test');
        $Silian_auditLogService = new AuditLogService($Silian_pdo, $Silian_logger);
        $Silian_llmLogService = new LlmLogService($Silian_pdo, $Silian_logger);
        $Silian_errorLogService = new ErrorLogService($Silian_pdo, new NullLogger());

        $Silian_pdo->exec("INSERT INTO users (id, username, email, status, is_admin, points, uuid) VALUES (2, 'alice_admin', 'alice@example.com', 'active', 0, 36, '550e8400-e29b-41d4-a716-4466554400c2')");

        $Silian_service = new AdminAiAgentService(
            $Silian_pdo,
            new QueueLlmClient([
                $this->toolResponse('manage_admin', [
                    'action' => 'search_users',
                    'payload' => [
                        'search' => 'alice',
                        'limit' => 10,
                    ],
                ]),
            ]),
            new NullLogger(),
            ['model' => 'test-model'],
            [
                'agent' => ['max_history_messages' => 12],
                'managementActions' => [
                    [
                        'name' => 'search_users',
                        'label' => 'Search users',
                        'description' => 'Search admin users list.',
                        'api' => ['payloadTemplate' => ['search' => '', 'limit' => 10]],
                        'requires' => [],
                        'contextHints' => [],
                        'risk_level' => 'read',
                        'requires_confirmation' => false,
                    ],
                ],
            ],
            $Silian_llmLogService,
            $Silian_auditLogService,
            $Silian_errorLogService
        );

        $Silian_result = $Silian_service->chat(null, '查一下 alice 这个用户', [], null, [
            'request_id' => 'req-user-search',
            'actor_type' => 'admin',
            'actor_id' => 1,
            'source' => '/admin/ai/chat',
        ]);

        $this->assertTrue($Silian_result['success']);
        $this->assertStringContainsString('匹配到 1 位用户', $Silian_result['message']);
        $this->assertStringContainsString('alice_admin', $Silian_result['message']);
    }

    public function testAdjustUserPointsUsesSelectedUserContextAndExecutesAfterConfirmation(): void
    {
        $Silian_pdo = $this->makePdo();
        $Silian_logger = new Logger('test');
        $Silian_auditLogService = new AuditLogService($Silian_pdo, $Silian_logger);
        $Silian_llmLogService = new LlmLogService($Silian_pdo, $Silian_logger);
        $Silian_errorLogService = new ErrorLogService($Silian_pdo, new NullLogger());

        $Silian_pdo->exec("INSERT INTO users (id, username, email, status, is_admin, points, uuid) VALUES (2, 'points_user', 'points@example.com', 'active', 0, 10, '550e8400-e29b-41d4-a716-4466554400c3')");

        $Silian_service = new AdminAiAgentService(
            $Silian_pdo,
            new QueueLlmClient([
                $this->toolResponse('manage_admin', [
                    'action' => 'adjust_user_points',
                    'payload' => [
                        'delta' => 25,
                        'reason' => 'manual compensation',
                    ],
                ]),
            ]),
            new NullLogger(),
            ['model' => 'test-model'],
            [
                'agent' => ['max_history_messages' => 12],
                'managementActions' => [
                    [
                        'name' => 'adjust_user_points',
                        'label' => 'Adjust user points',
                        'description' => 'Adjust user points.',
                        'api' => ['payloadTemplate' => ['user_id' => null, 'user_uuid' => null, 'delta' => null, 'reason' => null]],
                        'requires' => [
                            ['anyOf' => ['user_id', 'user_uuid'], 'label' => 'user_id_or_uuid'],
                            'delta',
                        ],
                        'contextHints' => ['selectedUserId'],
                        'risk_level' => 'write',
                        'requires_confirmation' => true,
                    ],
                ],
            ],
            $Silian_llmLogService,
            $Silian_auditLogService,
            $Silian_errorLogService
        );

        $Silian_proposal = $Silian_service->chat(null, '给当前用户加 25 分', ['selectedUserId' => 2], null, [
            'request_id' => 'req-adjust-points-1',
            'actor_type' => 'admin',
            'actor_id' => 1,
            'source' => '/admin/ai/chat',
        ]);

        $this->assertTrue($Silian_proposal['success']);
        $this->assertSame('pending', $Silian_proposal['conversation']['pending_actions'][0]['status']);
        $this->assertSame(10, (int) $Silian_pdo->query("SELECT points FROM users WHERE id = 2")->fetchColumn());

        $Silian_proposalId = $Silian_proposal['conversation']['pending_actions'][0]['proposal_id'];
        $Silian_decision = $Silian_service->chat(
            $Silian_proposal['conversation_id'],
            null,
            [],
            ['proposal_id' => $Silian_proposalId, 'outcome' => 'confirm'],
            [
                'request_id' => 'req-adjust-points-2',
                'actor_type' => 'admin',
                'actor_id' => 1,
                'source' => '/admin/ai/chat',
            ]
        );

        $this->assertTrue($Silian_decision['success']);
        $this->assertStringContainsString('已为用户 points_user 调整积分 25', $Silian_decision['message']);
        $this->assertSame(35, (int) $Silian_pdo->query("SELECT points FROM users WHERE id = 2")->fetchColumn());
    }

    public function testBadgeAwardAndRevokeUseBadgeServiceAfterConfirmation(): void
    {
        $Silian_pdo = $this->makePdo();
        $Silian_logger = new Logger('test');
        $Silian_auditLogService = new AuditLogService($Silian_pdo, $Silian_logger);
        $Silian_llmLogService = new LlmLogService($Silian_pdo, $Silian_logger);
        $Silian_errorLogService = new ErrorLogService($Silian_pdo, new NullLogger());

        $Silian_pdo->exec("INSERT INTO users (id, username, email, status, is_admin, points, uuid) VALUES (2, 'badge_user', 'badge@example.com', 'active', 0, 10, '550e8400-e29b-41d4-a716-4466554400d3')");
        $Silian_pdo->exec("INSERT INTO achievement_badges (id, uuid, code, name_zh, name_en, is_active) VALUES (9, '550e8400-e29b-41d4-a716-4466554400e3', 'pioneer', '先锋徽章', 'Pioneer Badge', 1)");

        $Silian_badgeService = $this->getMockBuilder(BadgeService::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['awardBadge', 'revokeBadge'])
            ->getMock();

        $Silian_badgeService->expects($this->once())
            ->method('awardBadge')
            ->with(
                9,
                2,
                $this->callback(function (array $Silian_context) use ($Silian_pdo): bool {
                    $Silian_pdo->exec("INSERT INTO user_badges (user_id, badge_id, status, awarded_at, awarded_by, source, notes) VALUES (2, 9, 'awarded', '2026-03-23 08:00:00', 1, 'manual', '季度补发')");
                    return ($Silian_context['admin_id'] ?? null) === 1
                        && ($Silian_context['notes'] ?? null) === '季度补发'
                        && ($Silian_context['source'] ?? null) === 'manual';
                })
            );

        $Silian_badgeService->expects($this->once())
            ->method('revokeBadge')
            ->with(9, 2, 1, '误发撤回')
            ->willReturnCallback(function () use ($Silian_pdo): bool {
                $Silian_pdo->exec("UPDATE user_badges SET status = 'revoked', revoked_at = '2026-03-23 08:30:00', revoked_by = 1, notes = '误发撤回' WHERE user_id = 2 AND badge_id = 9");
                return true;
            });

        $Silian_service = new AdminAiAgentService(
            $Silian_pdo,
            new QueueLlmClient([
                $this->toolResponse('manage_admin', [
                    'action' => 'award_badge_to_user',
                    'payload' => [
                        'badge_id' => 9,
                        'notes' => '季度补发',
                    ],
                ]),
                $this->toolResponse('manage_admin', [
                    'action' => 'revoke_badge_from_user',
                    'payload' => [
                        'badge_id' => 9,
                        'notes' => '误发撤回',
                    ],
                ]),
            ]),
            new NullLogger(),
            ['model' => 'test-model'],
            [
                'agent' => ['max_history_messages' => 12],
                'managementActions' => [
                    [
                        'name' => 'award_badge_to_user',
                        'label' => 'Award badge to user',
                        'description' => 'Grant a badge.',
                        'api' => ['payloadTemplate' => ['badge_id' => null, 'user_id' => null, 'user_uuid' => null, 'notes' => null]],
                        'requires' => [
                            'badge_id',
                            ['anyOf' => ['user_id', 'user_uuid'], 'label' => 'user_id_or_uuid'],
                        ],
                        'contextHints' => ['selectedUserId'],
                        'risk_level' => 'write',
                        'requires_confirmation' => true,
                    ],
                    [
                        'name' => 'revoke_badge_from_user',
                        'label' => 'Revoke badge from user',
                        'description' => 'Revoke a badge.',
                        'api' => ['payloadTemplate' => ['badge_id' => null, 'user_id' => null, 'user_uuid' => null, 'notes' => null]],
                        'requires' => [
                            'badge_id',
                            ['anyOf' => ['user_id', 'user_uuid'], 'label' => 'user_id_or_uuid'],
                        ],
                        'contextHints' => ['selectedUserId'],
                        'risk_level' => 'write',
                        'requires_confirmation' => true,
                    ],
                ],
            ],
            $Silian_llmLogService,
            $Silian_auditLogService,
            $Silian_errorLogService,
            null,
            null,
            $Silian_badgeService
        );

        $Silian_awardProposal = $Silian_service->chat(null, '给当前用户发先锋徽章', ['selectedUserId' => 2], null, [
            'request_id' => 'req-badge-award-1',
            'actor_type' => 'admin',
            'actor_id' => 1,
            'source' => '/admin/ai/chat',
        ]);
        $Silian_awardProposalId = $Silian_awardProposal['conversation']['pending_actions'][0]['proposal_id'];
        $Silian_awardDecision = $Silian_service->chat(
            $Silian_awardProposal['conversation_id'],
            null,
            [],
            ['proposal_id' => $Silian_awardProposalId, 'outcome' => 'confirm'],
            [
                'request_id' => 'req-badge-award-2',
                'actor_type' => 'admin',
                'actor_id' => 1,
                'source' => '/admin/ai/chat',
            ]
        );

        $this->assertStringContainsString('发放徽章 先锋徽章', $Silian_awardDecision['message']);
        $this->assertSame('awarded', $Silian_pdo->query("SELECT status FROM user_badges WHERE user_id = 2 AND badge_id = 9")->fetchColumn());

        $Silian_revokeProposal = $Silian_service->chat(null, '把当前用户的先锋徽章撤掉', ['selectedUserId' => 2], null, [
            'request_id' => 'req-badge-revoke-1',
            'actor_type' => 'admin',
            'actor_id' => 1,
            'source' => '/admin/ai/chat',
        ]);
        $Silian_revokeProposalId = $Silian_revokeProposal['conversation']['pending_actions'][0]['proposal_id'];
        $Silian_revokeDecision = $Silian_service->chat(
            $Silian_revokeProposal['conversation_id'],
            null,
            [],
            ['proposal_id' => $Silian_revokeProposalId, 'outcome' => 'confirm'],
            [
                'request_id' => 'req-badge-revoke-2',
                'actor_type' => 'admin',
                'actor_id' => 1,
                'source' => '/admin/ai/chat',
            ]
        );

        $this->assertStringContainsString('撤销用户 badge_user 的徽章 先锋徽章', $Silian_revokeDecision['message']);
        $this->assertSame('revoked', $Silian_pdo->query("SELECT status FROM user_badges WHERE user_id = 2 AND badge_id = 9")->fetchColumn());
    }

    public function testUpdateUserStatusUsesSelectedUserContextAndExecutesAfterConfirmation(): void
    {
        $Silian_pdo = $this->makePdo();
        $Silian_logger = new Logger('test');
        $Silian_auditLogService = new AuditLogService($Silian_pdo, $Silian_logger);
        $Silian_llmLogService = new LlmLogService($Silian_pdo, $Silian_logger);
        $Silian_errorLogService = new ErrorLogService($Silian_pdo, new NullLogger());

        $Silian_pdo->exec("INSERT INTO users (id, username, email, status, is_admin, points, uuid, admin_notes) VALUES (2, 'status_user', 'status@example.com', 'active', 0, 10, '550e8400-e29b-41d4-a716-4466554400f3', null)");

        $Silian_service = new AdminAiAgentService(
            $Silian_pdo,
            new QueueLlmClient([
                $this->toolResponse('manage_admin', [
                    'action' => 'update_user_status',
                    'payload' => [
                        'status' => 'banned',
                        'admin_notes' => 'spam reports confirmed',
                    ],
                ]),
            ]),
            new NullLogger(),
            ['model' => 'test-model'],
            [
                'agent' => ['max_history_messages' => 12],
                'managementActions' => [
                    [
                        'name' => 'update_user_status',
                        'label' => 'Update user status',
                        'description' => 'Update user status.',
                        'api' => ['payloadTemplate' => ['user_id' => null, 'user_uuid' => null, 'status' => null, 'admin_notes' => null]],
                        'requires' => [
                            ['anyOf' => ['user_id', 'user_uuid'], 'label' => 'user_id_or_uuid'],
                            'status',
                        ],
                        'contextHints' => ['selectedUserId'],
                        'risk_level' => 'write',
                        'requires_confirmation' => true,
                    ],
                ],
            ],
            $Silian_llmLogService,
            $Silian_auditLogService,
            $Silian_errorLogService
        );

        $Silian_proposal = $Silian_service->chat(null, '封禁当前用户', ['selectedUserId' => 2], null, [
            'request_id' => 'req-user-status-1',
            'actor_type' => 'admin',
            'actor_id' => 1,
            'source' => '/admin/ai/chat',
        ]);
        $Silian_proposalId = $Silian_proposal['conversation']['pending_actions'][0]['proposal_id'];
        $Silian_decision = $Silian_service->chat(
            $Silian_proposal['conversation_id'],
            null,
            [],
            ['proposal_id' => $Silian_proposalId, 'outcome' => 'confirm'],
            [
                'request_id' => 'req-user-status-2',
                'actor_type' => 'admin',
                'actor_id' => 1,
                'source' => '/admin/ai/chat',
            ]
        );

        $this->assertStringContainsString('状态更新为 banned', $Silian_decision['message']);
        $this->assertSame('banned', $Silian_pdo->query("SELECT status FROM users WHERE id = 2")->fetchColumn());
        $this->assertSame('spam reports confirmed', $Silian_pdo->query("SELECT admin_notes FROM users WHERE id = 2")->fetchColumn());
    }

    public function testCreateUserActionRequiresConfirmationAndPersistsHashedPassword(): void
    {
        $Silian_pdo = $this->makePdo();
        $Silian_logger = new Logger('test');
        $Silian_auditLogService = new AuditLogService($Silian_pdo, $Silian_logger);
        $Silian_llmLogService = new LlmLogService($Silian_pdo, $Silian_logger);
        $Silian_errorLogService = new ErrorLogService($Silian_pdo, new NullLogger());

        $Silian_service = new AdminAiAgentService(
            $Silian_pdo,
            new QueueLlmClient([
                $this->toolResponse('manage_admin', [
                    'action' => 'create_user',
                    'payload' => [
                        'username' => 'new_admin_user',
                        'email' => 'new-admin@example.com',
                        'password' => 'TempPass#2026',
                        'status' => 'active',
                        'is_admin' => true,
                        'school_id' => 1,
                        'admin_notes' => 'created by admin ai',
                    ],
                ]),
            ]),
            new NullLogger(),
            ['model' => 'test-model'],
            [
                'agent' => ['max_history_messages' => 12],
                'managementActions' => [
                    [
                        'name' => 'create_user',
                        'label' => 'Create user',
                        'description' => 'Create a new user account.',
                        'api' => ['payloadTemplate' => [
                            'username' => null,
                            'email' => null,
                            'password' => null,
                            'status' => 'active',
                            'is_admin' => false,
                            'school_id' => null,
                            'group_id' => null,
                            'region_code' => null,
                            'admin_notes' => null,
                        ]],
                        'requires' => ['username', 'email', 'password'],
                        'contextHints' => [],
                        'risk_level' => 'write',
                        'requires_confirmation' => true,
                    ],
                ],
            ],
            $Silian_llmLogService,
            $Silian_auditLogService,
            $Silian_errorLogService
        );

        $Silian_proposal = $Silian_service->chat(null, '新增一个管理员账号', [], null, [
            'request_id' => 'req-create-user-1',
            'actor_type' => 'admin',
            'actor_id' => 1,
            'source' => '/admin/ai/chat',
        ]);

        $Silian_pendingAction = $Silian_proposal['conversation']['pending_actions'][0];
        $this->assertArrayHasKey('password_hash', $Silian_pendingAction['payload']);
        $this->assertArrayNotHasKey('password', $Silian_pendingAction['payload']);
        $this->assertTrue((bool) ($Silian_pendingAction['payload']['password_provided'] ?? false));

        $Silian_proposalLogData = (string) $Silian_pdo->query("SELECT data FROM audit_logs WHERE action = 'admin_ai_action_proposed' ORDER BY id DESC LIMIT 1")->fetchColumn();
        $this->assertStringContainsString('password_hash', $Silian_proposalLogData);
        $this->assertStringNotContainsString('TempPass#2026', $Silian_proposalLogData);

        $Silian_proposalId = $Silian_pendingAction['proposal_id'];
        $Silian_decision = $Silian_service->chat(
            $Silian_proposal['conversation_id'],
            null,
            [],
            ['proposal_id' => $Silian_proposalId, 'outcome' => 'confirm'],
            [
                'request_id' => 'req-create-user-2',
                'actor_type' => 'admin',
                'actor_id' => 1,
                'source' => '/admin/ai/chat',
            ]
        );

        $this->assertStringContainsString('已创建用户 new_admin_user', $Silian_decision['message']);

        $Silian_user = $Silian_pdo->query("SELECT username, email, password, status, is_admin, admin_notes FROM users WHERE username = 'new_admin_user'")->fetch(PDO::FETCH_ASSOC);
        $this->assertIsArray($Silian_user);
        $this->assertSame('new-admin@example.com', $Silian_user['email']);
        $this->assertSame('active', $Silian_user['status']);
        $this->assertSame('1', (string) $Silian_user['is_admin']);
        $this->assertSame('created by admin ai', $Silian_user['admin_notes']);
        $this->assertNotSame('TempPass#2026', $Silian_user['password']);
        $this->assertTrue(password_verify('TempPass#2026', (string) $Silian_user['password']));
    }

    public function testProductStatusAndInventoryActionsExecuteAfterConfirmation(): void
    {
        $Silian_pdo = $this->makePdo();
        $Silian_logger = new Logger('test');
        $Silian_auditLogService = new AuditLogService($Silian_pdo, $Silian_logger);
        $Silian_llmLogService = new LlmLogService($Silian_pdo, $Silian_logger);
        $Silian_errorLogService = new ErrorLogService($Silian_pdo, new NullLogger());

        $Silian_pdo->exec("INSERT INTO products (id, name, stock, status, points_required) VALUES (5, 'Eco Bottle', 12, 'inactive', 80)");

        $Silian_service = new AdminAiAgentService(
            $Silian_pdo,
            new QueueLlmClient([
                $this->toolResponse('manage_admin', [
                    'action' => 'update_product_status',
                    'payload' => [
                        'product_id' => 5,
                        'status' => 'active',
                    ],
                ]),
                $this->toolResponse('manage_admin', [
                    'action' => 'adjust_product_inventory',
                    'payload' => [
                        'product_id' => 5,
                        'stock_delta' => 8,
                        'reason' => 'manual restock',
                    ],
                ]),
            ]),
            new NullLogger(),
            ['model' => 'test-model'],
            [
                'agent' => ['max_history_messages' => 12],
                'managementActions' => [
                    [
                        'name' => 'update_product_status',
                        'label' => 'Update product status',
                        'description' => 'Set product status.',
                        'api' => ['payloadTemplate' => ['product_id' => null, 'status' => null]],
                        'requires' => ['product_id', 'status'],
                        'contextHints' => [],
                        'risk_level' => 'write',
                        'requires_confirmation' => true,
                    ],
                    [
                        'name' => 'adjust_product_inventory',
                        'label' => 'Adjust product inventory',
                        'description' => 'Adjust stock.',
                        'api' => ['payloadTemplate' => ['product_id' => null, 'stock_delta' => null, 'target_stock' => null, 'reason' => null]],
                        'requires' => [
                            'product_id',
                            ['anyOf' => ['stock_delta', 'target_stock'], 'label' => 'stock_delta_or_target_stock'],
                        ],
                        'contextHints' => [],
                        'risk_level' => 'write',
                        'requires_confirmation' => true,
                    ],
                ],
            ],
            $Silian_llmLogService,
            $Silian_auditLogService,
            $Silian_errorLogService
        );

        $Silian_statusProposal = $Silian_service->chat(null, '把 5 号商品上架', [], null, [
            'request_id' => 'req-product-status-1',
            'actor_type' => 'admin',
            'actor_id' => 1,
            'source' => '/admin/ai/chat',
        ]);
        $Silian_statusProposalId = $Silian_statusProposal['conversation']['pending_actions'][0]['proposal_id'];
        $Silian_statusDecision = $Silian_service->chat(
            $Silian_statusProposal['conversation_id'],
            null,
            [],
            ['proposal_id' => $Silian_statusProposalId, 'outcome' => 'confirm'],
            [
                'request_id' => 'req-product-status-2',
                'actor_type' => 'admin',
                'actor_id' => 1,
                'source' => '/admin/ai/chat',
            ]
        );

        $this->assertStringContainsString('Eco Bottle 已更新为 active', $Silian_statusDecision['message']);
        $this->assertSame('active', $Silian_pdo->query("SELECT status FROM products WHERE id = 5")->fetchColumn());

        $Silian_inventoryProposal = $Silian_service->chat(null, '给 5 号商品补货 8 件', [], null, [
            'request_id' => 'req-product-stock-1',
            'actor_type' => 'admin',
            'actor_id' => 1,
            'source' => '/admin/ai/chat',
        ]);
        $Silian_inventoryProposalId = $Silian_inventoryProposal['conversation']['pending_actions'][0]['proposal_id'];
        $Silian_inventoryDecision = $Silian_service->chat(
            $Silian_inventoryProposal['conversation_id'],
            null,
            [],
            ['proposal_id' => $Silian_inventoryProposalId, 'outcome' => 'confirm'],
            [
                'request_id' => 'req-product-stock-2',
                'actor_type' => 'admin',
                'actor_id' => 1,
                'source' => '/admin/ai/chat',
            ]
        );

        $this->assertStringContainsString('库存已从 12 调整到 20', $Silian_inventoryDecision['message']);
        $this->assertSame(20, (int) $Silian_pdo->query("SELECT stock FROM products WHERE id = 5")->fetchColumn());
    }

    /**
     * @param array<string,mixed> $arguments
     * @return array<string,mixed>
     */
    private function toolResponse(string $Silian_toolName, array $Silian_arguments): array
    {
        return [
            'id' => 'resp-test',
            'model' => 'test-model',
            'usage' => ['prompt_tokens' => 10, 'completion_tokens' => 12, 'total_tokens' => 22],
            'choices' => [[
                'finish_reason' => 'tool_calls',
                'message' => [
                    'role' => 'assistant',
                    'content' => '',
                    'tool_calls' => [[
                        'id' => 'call-1',
                        'type' => 'function',
                        'function' => [
                            'name' => $Silian_toolName,
                            'arguments' => json_encode($Silian_arguments, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                        ],
                    ]],
                ],
            ]],
        ];
    }

    private function plainTextResponse(string $Silian_content): array
    {
        return [
            'id' => 'resp-test-text',
            'model' => 'test-model',
            'usage' => ['prompt_tokens' => 10, 'completion_tokens' => 12, 'total_tokens' => 22],
            'choices' => [[
                'finish_reason' => 'stop',
                'message' => [
                    'role' => 'assistant',
                    'content' => $Silian_content,
                ],
            ]],
        ];
    }
}

class QueueLlmClient implements LlmClientInterface
{
    /** @var array<int,array<string,mixed>> */
    private array $responses;

    /**
     * @param array<int,array<string,mixed>> $responses
     */
    public function __construct(array $Silian_responses)
    {
        $this->responses = array_values($Silian_responses);
    }

    public function createChatCompletion(array $Silian_payload): array
    {
        if ($this->responses === []) {
            throw new \RuntimeException('No queued LLM responses left.');
        }

        return array_shift($this->responses);
    }
}
