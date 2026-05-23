<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\AdminAiConversationStoreService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Tests\Integration\TestSchemaBuilder;
use Monolog\Logger;
use PHPUnit\Framework\TestCase;
use PDO;
use Psr\Log\NullLogger;

class AdminAiConversationStoreServiceTest extends TestCase
{
    private function makePdo(): PDO
    {
        $Silian_pdo = new PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        TestSchemaBuilder::init($Silian_pdo);
        return $Silian_pdo;
    }

    public function testLogConversationEventBuildsDetailAndProposalState(): void
    {
        $Silian_pdo = $this->makePdo();
        $Silian_auditLogService = new AuditLogService($Silian_pdo, new Logger('test'));
        $Silian_service = new AdminAiConversationStoreService($Silian_pdo, new NullLogger(), $Silian_auditLogService);

        $Silian_conversationId = 'admin-ai-store-1001';
        $Silian_logContext = [
            'request_id' => 'req-store-detail-1',
            'actor_id' => 7,
            'source' => '/admin/ai/chat',
        ];

        $Silian_service->logConversationEvent('admin_ai_user_message', $Silian_logContext, [
            'conversation_id' => $Silian_conversationId,
            'visible_text' => '查看待审核记录',
            'role' => 'user',
        ]);
        $Silian_proposalId = $Silian_service->logConversationEvent('admin_ai_action_proposed', $Silian_logContext, [
            'conversation_id' => $Silian_conversationId,
            'visible_text' => '待确认审批 1 条记录',
            'status' => 'pending',
            'action_name' => 'approve_carbon_records',
            'label' => 'Approve records',
            'summary' => '待确认审批 1 条记录',
            'payload' => ['record_ids' => ['rec-store-1']],
            'risk_level' => 'write',
        ]);
        $Silian_service->logConversationEvent('admin_ai_assistant_message', $Silian_logContext, [
            'conversation_id' => $Silian_conversationId,
            'visible_text' => '请确认是否执行审批。',
            'role' => 'assistant',
        ]);

        $this->assertIsInt($Silian_proposalId);
        $Silian_proposal = $Silian_service->findProposal($Silian_conversationId, $Silian_proposalId);
        $this->assertIsArray($Silian_proposal);
        $this->assertSame('approve_carbon_records', $Silian_proposal['action_name']);

        $Silian_service->updateProposalStatus($Silian_proposalId, 'success', [
            'decision' => 'confirmed',
        ]);

        $Silian_detail = $Silian_service->getConversationDetail($Silian_conversationId);
        $this->assertSame($Silian_conversationId, $Silian_detail['conversation_id']);
        $this->assertSame('查看待审核记录', $Silian_detail['summary']['title']);
        $this->assertSame(2, $Silian_detail['summary']['message_count']);
        $this->assertSame(0, $Silian_detail['summary']['pending_action_count']);
        $this->assertCount(3, $Silian_detail['messages']);
        $this->assertSame('success', $Silian_detail['messages'][1]['status']);
        $this->assertSame($Silian_proposalId, $Silian_detail['messages'][1]['proposal']['proposal_id']);

        $Silian_storedPreview = $Silian_pdo->query("SELECT title, last_message_preview FROM admin_ai_conversations WHERE conversation_id = '{$Silian_conversationId}'")
            ->fetch(PDO::FETCH_ASSOC);
        $this->assertIsArray($Silian_storedPreview);
        $this->assertSame('查看待审核记录', $Silian_storedPreview['title']);
        $this->assertSame('请确认是否执行审批。', $Silian_storedPreview['last_message_preview']);

        $Silian_auditTarget = $Silian_pdo->query("SELECT affected_table FROM audit_logs WHERE action = 'admin_ai_action_proposed' ORDER BY id DESC LIMIT 1")
            ->fetchColumn();
        $this->assertSame('admin_ai_messages', $Silian_auditTarget);
    }

    public function testListConversationsAppliesPendingAndModelFilters(): void
    {
        $Silian_pdo = $this->makePdo();
        $Silian_service = new AdminAiConversationStoreService($Silian_pdo, new NullLogger());

        $Silian_pdo->exec("
            INSERT INTO admin_ai_conversations (conversation_id, admin_id, title, last_message_preview, started_at, last_activity_at)
            VALUES
            ('admin-ai-store-2001', 7, '待确认会话', '需要确认', '2026-03-20 10:00:00', '2026-03-20 10:05:00'),
            ('admin-ai-store-2002', 7, '普通会话', '已完成', '2026-03-18 09:00:00', '2026-03-18 09:05:00')
        ");
        $Silian_pdo->exec("
            INSERT INTO admin_ai_messages (conversation_id, kind, role, action, status, content, meta_json, created_at)
            VALUES
            ('admin-ai-store-2001', 'message', 'user', 'admin_ai_user_message', 'success', '会话一', '{\"data\":{\"visible_text\":\"会话一\"}}', '2026-03-20 10:00:00'),
            ('admin-ai-store-2001', 'action_proposed', NULL, 'admin_ai_action_proposed', 'pending', '待确认', '{\"data\":{\"action_name\":\"approve_carbon_records\",\"payload\":{\"record_ids\":[\"rec-1\"]}}}', '2026-03-20 10:05:00'),
            ('admin-ai-store-2002', 'message', 'user', 'admin_ai_user_message', 'success', '会话二', '{\"data\":{\"visible_text\":\"会话二\"}}', '2026-03-18 09:00:00')
        ");
        $Silian_pdo->exec("
            INSERT INTO llm_logs (request_id, actor_type, actor_id, conversation_id, turn_no, source, model, prompt, response_raw, status, total_tokens, created_at)
            VALUES
            ('req-store-a', 'admin', 7, 'admin-ai-store-2001', 1, '/admin/ai/chat', 'gpt-5.4', 'hello', '{\"ok\":true}', 'success', 11, '2026-03-20 10:01:00'),
            ('req-store-b', 'admin', 7, 'admin-ai-store-2002', 1, '/admin/ai/chat', 'gemini-2.5-flash', 'hello', '{\"ok\":true}', 'success', 9, '2026-03-18 09:01:00')
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
        $this->assertSame('admin-ai-store-2001', $Silian_filtered[0]['conversation_id']);
        $this->assertSame('waiting_confirmation', $Silian_filtered[0]['status']);
        $this->assertSame(1, $Silian_filtered[0]['pending_action_count']);
        $this->assertSame('gpt-5.4', $Silian_filtered[0]['last_model']);
    }
}
