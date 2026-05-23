<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Integration;

use CarbonTrack\Controllers\AdminLlmUsageController;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\AuthService;
use PHPUnit\Framework\TestCase;
use PDO;
use Slim\Psr7\Response;

class AdminLlmUsageIntegrationTest extends TestCase
{
    private function makeController(PDO $Silian_pdo): AdminLlmUsageController
    {
        $Silian_authService = new class('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'HS256', 3600) extends AuthService {
            private array $admin = [
                'id' => 1,
                'is_admin' => true,
            ];

            public function getCurrentUser(\Psr\Http\Message\ServerRequestInterface $Silian_request): ?array
            {
                return $this->admin;
            }
        };

        $Silian_auditLogService = $this->createMock(AuditLogService::class);
        $Silian_auditLogService->method('log')->willReturn(true);
        $Silian_auditLogService->method('logAdminOperation')->willReturn(true);

        return new AdminLlmUsageController($Silian_pdo, $Silian_authService, $Silian_auditLogService);
    }

    public function testSummaryReturnsUsageAndUsers(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        TestSchemaBuilder::init($Silian_pdo);

        $Silian_pdo->exec("INSERT INTO user_groups (id, name, code, config, is_default) VALUES (1, 'Free', 'free', '{\"llm\":{\"daily_limit\":10,\"rate_limit\":60}}', 1)");
        $Silian_pdo->exec("INSERT INTO users (id, username, email, status, is_admin, group_id) VALUES (2, 'user_a', 'usera@example.com', 'active', 0, 1)");
        $Silian_pdo->exec("INSERT INTO users (id, username, email, status, is_admin, group_id) VALUES (3, 'admin_b', 'adminb@example.com', 'active', 1, 1)");

        $Silian_lastUpdated = date('Y-m-d H:i:s', strtotime('-1 day'));
        $Silian_resetAt = date('Y-m-d 00:00:00', strtotime('+1 day'));
        $Silian_pdo->exec("INSERT INTO user_usage_stats (user_id, resource_key, counter, last_updated_at, reset_at) VALUES (2, 'llm_daily', 4, '{$Silian_lastUpdated}', '{$Silian_resetAt}')");

        $Silian_logTime = date('Y-m-d H:i:s', strtotime('-2 days'));
        $Silian_pdo->exec("INSERT INTO llm_logs (request_id, actor_type, actor_id, source, model, prompt, response_raw, status, total_tokens, created_at)
            VALUES ('req-1', 'user', 2, 'smart-activity-input', 'test-model', 'hello', '{\"ok\":true}', 'success', 12, '{$Silian_logTime}')");

        $Silian_controller = $this->makeController($Silian_pdo);
        $Silian_request = makeRequest('GET', '/admin/llm-usage');
        $Silian_response = $Silian_controller->summary($Silian_request, new Response());

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame(10, $Silian_payload['data']['users'][0]['daily_limit']);
        $this->assertSame(4, $Silian_payload['data']['users'][0]['daily_used']);
        $this->assertSame(1, $Silian_payload['data']['summary']['calls_30d']);
    }

    public function testSummarySupportsSearchQuery(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        TestSchemaBuilder::init($Silian_pdo);

        $Silian_pdo->exec("INSERT INTO user_groups (id, name, code, config, is_default) VALUES (1, 'Free', 'free', '{\"llm\":{\"daily_limit\":10}}', 1)");
        $Silian_pdo->exec("INSERT INTO users (id, username, email, status, is_admin, group_id) VALUES (2, 'target_user', 'target@example.com', 'active', 0, 1)");
        $Silian_pdo->exec("INSERT INTO users (id, username, email, status, is_admin, group_id) VALUES (3, 'other_user', 'other@example.com', 'active', 0, 1)");

        $Silian_controller = $this->makeController($Silian_pdo);
        $Silian_request = makeRequest('GET', '/admin/llm-usage', null, ['q' => 'target']);
        $Silian_response = $Silian_controller->summary($Silian_request, new Response());

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertCount(1, $Silian_payload['data']['users']);
        $this->assertSame('target_user', $Silian_payload['data']['users'][0]['username']);
    }

    public function testLogDetailReturnsRecord(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        TestSchemaBuilder::init($Silian_pdo);

        $Silian_logTime = date('Y-m-d H:i:s', strtotime('-1 hour'));
        $Silian_pdo->exec("INSERT INTO llm_logs (id, request_id, actor_type, actor_id, source, model, prompt, response_raw, status, total_tokens, created_at)
            VALUES (10, 'req-10', 'admin', 1, 'admin-command', 'model-x', 'ping', '{\"answer\":\"ok\"}', 'success', 5, '{$Silian_logTime}')");

        $Silian_controller = $this->makeController($Silian_pdo);
        $Silian_request = makeRequest('GET', '/admin/llm-usage/logs/10');
        $Silian_response = $Silian_controller->logDetail($Silian_request, new Response(), ['id' => 10]);

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame('req-10', $Silian_payload['data']['request_id']);
        $this->assertSame('admin', $Silian_payload['data']['actor_type']);
    }

    public function testAnalyticsReturnsTrendsAndRecentConversations(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        TestSchemaBuilder::init($Silian_pdo);

        $Silian_pdo->exec("INSERT INTO users (id, username, email, status, is_admin) VALUES (2, 'user_a', 'usera@example.com', 'active', 0)");

        $Silian_logTime = date('Y-m-d H:i:s', strtotime('-1 day'));
        $Silian_secondLogTime = date('Y-m-d H:i:s', strtotime('-2 hours'));
        $Silian_pdo->exec("INSERT INTO llm_logs (id, request_id, actor_type, actor_id, source, model, prompt, response_raw, status, total_tokens, latency_ms, created_at, context_json)
            VALUES (20, 'req-20', 'user', 2, 'smart-activity-input', 'model-x', 'hello', '{\"ok\":true}', 'success', 12, 900, '{$Silian_logTime}', '{\"client_timezone\":\"UTC\"}')");
        $Silian_pdo->exec("INSERT INTO llm_logs (id, request_id, actor_type, actor_id, source, model, prompt, response_raw, status, total_tokens, latency_ms, created_at, context_json)
            VALUES (21, 'req-21', 'user', 2, 'admin-ai', 'model-y', 'follow up', '{\"ok\":true}', 'failed', 18, 1200, '{$Silian_secondLogTime}', '{\"client_timezone\":\"Asia/Shanghai\"}')");
        $Silian_pdo->exec("INSERT INTO system_logs (request_id, method, path, status_code, created_at)
            VALUES ('req-20', 'POST', '/api/v1/ai/suggest-activity', 200, '{$Silian_logTime}')");
        $Silian_pdo->exec("INSERT INTO system_logs (request_id, method, path, status_code, created_at)
            VALUES ('req-20', 'POST', '/api/v1/ai/suggest-activity/retry', 202, '{$Silian_secondLogTime}')");
        $Silian_pdo->exec("INSERT INTO audit_logs (request_id, action, status, created_at)
            VALUES ('req-20', 'admin_llm_usage_analytics_viewed', 'success', '{$Silian_logTime}')");
        $Silian_pdo->exec("INSERT INTO audit_logs (request_id, action, status, created_at)
            VALUES ('req-21', 'admin_llm_usage_analytics_viewed', 'success', '{$Silian_secondLogTime}')");
        $Silian_pdo->exec("INSERT INTO error_logs (request_id, error_type, error_message, created_at)
            VALUES ('req-20', 'RuntimeException', 'boom', '{$Silian_secondLogTime}')");

        $Silian_controller = $this->makeController($Silian_pdo);
        $Silian_request = makeRequest('GET', '/admin/llm-usage/analytics', null, ['days' => 7, 'recent_limit' => 5]);
        $Silian_response = $Silian_controller->analytics($Silian_request, new Response());

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertNotEmpty($Silian_payload['data']['trends']);
        $this->assertNotEmpty($Silian_payload['data']['recent_conversations']);
        $Silian_recentByRequestId = [];
        foreach ($Silian_payload['data']['recent_conversations'] as $Silian_conversation) {
            $Silian_recentByRequestId[$Silian_conversation['request_id']] = $Silian_conversation;
        }

        $this->assertArrayHasKey('req-20', $Silian_recentByRequestId);
        $this->assertArrayHasKey('req-21', $Silian_recentByRequestId);
        $this->assertSame(2, $Silian_recentByRequestId['req-20']['related']['system']);
        $this->assertSame(1, $Silian_recentByRequestId['req-20']['related']['audit']);
        $this->assertSame(1, $Silian_recentByRequestId['req-20']['related']['error']);
        $this->assertSame('/api/v1/ai/suggest-activity/retry', $Silian_recentByRequestId['req-20']['system_path']);
        $this->assertSame(202, $Silian_recentByRequestId['req-20']['system_status_code']);
        $this->assertSame(0, $Silian_recentByRequestId['req-21']['related']['system']);
        $this->assertSame(1, $Silian_recentByRequestId['req-21']['related']['audit']);
        $this->assertSame(0, $Silian_recentByRequestId['req-21']['related']['error']);
        $this->assertNull($Silian_recentByRequestId['req-21']['system_path']);
    }
}
