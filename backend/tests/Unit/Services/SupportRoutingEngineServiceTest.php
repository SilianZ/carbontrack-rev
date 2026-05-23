<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\EmailService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\MessageService;
use CarbonTrack\Services\SupportRoutingEngineService;
use CarbonTrack\Services\SupportRoutingTriageService;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

class SupportRoutingEngineServiceTest extends TestCase
{
    private static ?Capsule $capsule = null;

    public static function setUpBeforeClass(): void
    {
        self::$capsule = new Capsule();
        self::$capsule->addConnection([
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
        ]);
        self::$capsule->setAsGlobal();
        self::$capsule->bootEloquent();

        self::$capsule->schema()->create('users', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->string('username')->nullable();
            $Silian_table->string('email')->nullable();
            $Silian_table->string('role')->default('user');
            $Silian_table->boolean('is_admin')->default(false);
            $Silian_table->string('status')->default('active');
            $Silian_table->integer('group_id')->nullable();
            $Silian_table->text('quota_override')->nullable();
            $Silian_table->timestamp('deleted_at')->nullable();
            $Silian_table->timestamp('created_at')->nullable();
            $Silian_table->timestamp('updated_at')->nullable();
        });

        self::$capsule->schema()->create('user_groups', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->string('name');
            $Silian_table->string('code');
            $Silian_table->text('config')->nullable();
            $Silian_table->boolean('is_default')->default(false);
            $Silian_table->text('notes')->nullable();
            $Silian_table->timestamp('created_at')->nullable();
            $Silian_table->timestamp('updated_at')->nullable();
        });

        self::$capsule->schema()->create('support_tickets', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->integer('user_id');
            $Silian_table->string('subject');
            $Silian_table->string('category');
            $Silian_table->string('status');
            $Silian_table->string('priority')->default('normal');
            $Silian_table->integer('assigned_to')->nullable();
            $Silian_table->string('assignment_source')->nullable();
            $Silian_table->integer('assigned_rule_id')->nullable();
            $Silian_table->boolean('assignment_locked')->default(false);
            $Silian_table->timestamp('first_support_response_at')->nullable();
            $Silian_table->timestamp('first_response_due_at')->nullable();
            $Silian_table->timestamp('resolution_due_at')->nullable();
            $Silian_table->string('sla_status')->default('pending');
            $Silian_table->integer('escalation_level')->default(0);
            $Silian_table->integer('last_routing_run_id')->nullable();
            $Silian_table->timestamp('created_at')->nullable();
            $Silian_table->timestamp('updated_at')->nullable();
        });

        self::$capsule->schema()->create('support_ticket_messages', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->integer('ticket_id');
            $Silian_table->integer('sender_id')->nullable();
            $Silian_table->string('sender_role')->nullable();
            $Silian_table->string('sender_name')->nullable();
            $Silian_table->text('body');
            $Silian_table->timestamp('created_at')->nullable();
            $Silian_table->timestamp('updated_at')->nullable();
        });

        self::$capsule->schema()->create('support_ticket_feedback', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->integer('ticket_id');
            $Silian_table->integer('user_id');
            $Silian_table->integer('rated_user_id');
            $Silian_table->integer('rating');
            $Silian_table->text('comment')->nullable();
            $Silian_table->timestamp('created_at')->nullable();
            $Silian_table->timestamp('updated_at')->nullable();
        });

        self::$capsule->schema()->create('support_ticket_tags', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->string('slug');
            $Silian_table->string('name');
            $Silian_table->string('color')->default('emerald');
            $Silian_table->boolean('is_active')->default(true);
            $Silian_table->timestamp('created_at')->nullable();
            $Silian_table->timestamp('updated_at')->nullable();
        });

        self::$capsule->schema()->create('support_ticket_tag_assignments', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->integer('ticket_id');
            $Silian_table->integer('tag_id');
            $Silian_table->string('source_type')->default('rule');
            $Silian_table->integer('rule_id')->nullable();
            $Silian_table->timestamp('created_at')->nullable();
        });

        self::$capsule->schema()->create('support_ticket_automation_rules', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->string('name');
            $Silian_table->boolean('is_active')->default(true);
            $Silian_table->integer('sort_order')->default(0);
            $Silian_table->string('match_category')->nullable();
            $Silian_table->string('match_priority')->nullable();
            $Silian_table->text('match_weekdays')->nullable();
            $Silian_table->string('match_time_start')->nullable();
            $Silian_table->string('match_time_end')->nullable();
            $Silian_table->string('timezone')->default('Asia/Shanghai');
            $Silian_table->integer('assign_to')->nullable();
            $Silian_table->decimal('score_boost', 10, 2)->default(0);
            $Silian_table->integer('required_agent_level')->nullable();
            $Silian_table->text('skill_hints_json')->nullable();
            $Silian_table->text('add_tag_ids')->nullable();
            $Silian_table->boolean('stop_processing')->default(false);
            $Silian_table->integer('trigger_count')->default(0);
            $Silian_table->timestamp('last_triggered_at')->nullable();
            $Silian_table->timestamp('created_at')->nullable();
            $Silian_table->timestamp('updated_at')->nullable();
        });

        self::$capsule->schema()->create('support_assignee_profiles', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->integer('user_id');
            $Silian_table->integer('level')->default(1);
            $Silian_table->text('skills_json')->nullable();
            $Silian_table->text('languages_json')->nullable();
            $Silian_table->integer('max_active_tickets')->default(10);
            $Silian_table->boolean('is_auto_assignable')->default(true);
            $Silian_table->text('weight_overrides_json')->nullable();
            $Silian_table->string('status')->default('active');
            $Silian_table->timestamp('created_at')->nullable();
            $Silian_table->timestamp('updated_at')->nullable();
        });

        self::$capsule->schema()->create('support_routing_settings', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->boolean('ai_enabled')->default(false);
            $Silian_table->integer('ai_timeout_ms')->default(12000);
            $Silian_table->integer('due_soon_minutes')->default(30);
            $Silian_table->text('weights_json')->nullable();
            $Silian_table->text('fallback_json')->nullable();
            $Silian_table->text('defaults_json')->nullable();
            $Silian_table->timestamp('created_at')->nullable();
            $Silian_table->timestamp('updated_at')->nullable();
        });

        self::$capsule->schema()->create('support_ticket_routing_runs', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->integer('ticket_id');
            $Silian_table->string('trigger')->default('created');
            $Silian_table->boolean('used_ai')->default(false);
            $Silian_table->string('fallback_reason')->nullable();
            $Silian_table->text('triage_json')->nullable();
            $Silian_table->text('matched_rule_ids_json')->nullable();
            $Silian_table->text('candidate_scores_json')->nullable();
            $Silian_table->integer('winner_user_id')->nullable();
            $Silian_table->decimal('winner_score', 12, 2)->nullable();
            $Silian_table->text('summary_json')->nullable();
            $Silian_table->timestamp('created_at')->nullable();
            $Silian_table->timestamp('updated_at')->nullable();
        });
    }

    protected function setUp(): void
    {
        parent::setUp();
        foreach ([
            'support_ticket_routing_runs',
            'support_routing_settings',
            'support_assignee_profiles',
            'support_ticket_automation_rules',
            'support_ticket_tag_assignments',
            'support_ticket_tags',
            'support_ticket_feedback',
            'support_ticket_messages',
            'support_tickets',
            'user_groups',
            'users',
        ] as $Silian_table) {
            self::$capsule->table($Silian_table)->delete();
        }
    }

    public function testRouteTicketUsesGroupLevelRequirement(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        self::$capsule->table('user_groups')->insert([
            'id' => 1,
            'name' => 'VIP',
            'code' => 'vip',
            'config' => json_encode(['support_routing' => ['min_agent_level' => 4, 'routing_weight' => 1.5]]),
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('users')->insert([
            ['id' => 1, 'username' => 'requester', 'email' => 'requester@example.com', 'role' => 'user', 'group_id' => 1, 'status' => 'active', 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
            ['id' => 2, 'username' => 'junior', 'email' => 'junior@example.com', 'role' => 'support', 'group_id' => null, 'status' => 'active', 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
            ['id' => 3, 'username' => 'senior', 'email' => 'senior@example.com', 'role' => 'support', 'group_id' => null, 'status' => 'active', 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
        ]);

        self::$capsule->table('support_assignee_profiles')->insert([
            ['user_id' => 2, 'level' => 2, 'skills_json' => json_encode([]), 'languages_json' => json_encode([]), 'max_active_tickets' => 10, 'is_auto_assignable' => 1, 'status' => 'active', 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
            ['user_id' => 3, 'level' => 5, 'skills_json' => json_encode([]), 'languages_json' => json_encode([]), 'max_active_tickets' => 10, 'is_auto_assignable' => 1, 'status' => 'active', 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
        ]);

        self::$capsule->table('support_routing_settings')->insert([
            'id' => 1,
            'ai_enabled' => 0,
            'weights_json' => json_encode(['group_weight' => 15]),
            'fallback_json' => json_encode(['default_feedback_rating' => 3.5]),
            'defaults_json' => json_encode(['min_agent_level' => 1]),
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 101,
            'user_id' => 1,
            'subject' => 'VIP complaint',
            'category' => 'business_issue',
            'status' => 'open',
            'priority' => 'normal',
            'sla_status' => 'pending',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('support_ticket_messages')->insert([
            'ticket_id' => 101,
            'sender_id' => 1,
            'sender_role' => 'user',
            'sender_name' => 'requester',
            'body' => 'Please escalate this',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->method('logSystemEvent')->willReturn(true);

        $Silian_engine = new SupportRoutingEngineService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $Silian_audit,
            $this->createMock(ErrorLogService::class),
            new SupportRoutingTriageService(null, $this->createMock(LoggerInterface::class))
        );

        $Silian_result = $Silian_engine->routeTicket(101, 'created');
        $Silian_ticket = self::$capsule->table('support_tickets')->where('id', 101)->first();

        $this->assertSame(3, $Silian_result['assigned_to']);
        $this->assertSame('smart', $Silian_ticket->assignment_source);
        $this->assertSame(3, (int) $Silian_ticket->assigned_to);
        $this->assertNotNull($Silian_ticket->last_routing_run_id);
    }

    public function testRouteTicketCanUseSupportUserWithoutProfileRow(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        self::$capsule->table('users')->insert([
            ['id' => 21, 'username' => 'requester', 'email' => 'requester@example.com', 'role' => 'user', 'status' => 'active', 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
            ['id' => 22, 'username' => 'support-no-profile', 'email' => 'support@example.com', 'role' => 'support', 'status' => 'active', 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
        ]);

        self::$capsule->table('support_routing_settings')->insert([
            'id' => 1,
            'ai_enabled' => 0,
            'weights_json' => json_encode(['group_weight' => 15]),
            'fallback_json' => json_encode(['default_feedback_rating' => 3.5]),
            'defaults_json' => json_encode(['min_agent_level' => 1]),
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 202,
            'user_id' => 21,
            'subject' => 'Profileless support candidate',
            'category' => 'website_bug',
            'status' => 'open',
            'priority' => 'low',
            'sla_status' => 'pending',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('support_ticket_messages')->insert([
            'ticket_id' => 202,
            'sender_id' => 21,
            'sender_role' => 'user',
            'sender_name' => 'requester',
            'body' => 'Please help',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->method('logSystemEvent')->willReturn(true);

        $Silian_engine = new SupportRoutingEngineService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $Silian_audit,
            $this->createMock(ErrorLogService::class),
            new SupportRoutingTriageService(null, $this->createMock(LoggerInterface::class))
        );

        $Silian_result = $Silian_engine->routeTicket(202, 'created');
        $Silian_ticket = self::$capsule->table('support_tickets')->where('id', 202)->first();

        $this->assertSame(22, $Silian_result['assigned_to']);
        $this->assertSame(22, (int) $Silian_ticket->assigned_to);
        $this->assertSame('smart', $Silian_ticket->assignment_source);
    }

    public function testRouteTicketPrefersHigherRatedAssigneeWhenOtherSignalsTie(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        self::$capsule->table('users')->insert([
            ['id' => 61, 'username' => 'requester', 'email' => 'requester@example.com', 'role' => 'user', 'status' => 'active', 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
            ['id' => 62, 'username' => 'low-rated', 'email' => 'low@example.com', 'role' => 'support', 'status' => 'active', 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
            ['id' => 63, 'username' => 'top-rated', 'email' => 'top@example.com', 'role' => 'support', 'status' => 'active', 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
        ]);

        self::$capsule->table('support_assignee_profiles')->insert([
            ['user_id' => 62, 'level' => 3, 'skills_json' => json_encode([]), 'languages_json' => json_encode([]), 'max_active_tickets' => 10, 'is_auto_assignable' => 1, 'status' => 'active', 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
            ['user_id' => 63, 'level' => 3, 'skills_json' => json_encode([]), 'languages_json' => json_encode([]), 'max_active_tickets' => 10, 'is_auto_assignable' => 1, 'status' => 'active', 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
        ]);

        self::$capsule->table('support_ticket_feedback')->insert([
            ['ticket_id' => 900, 'user_id' => 61, 'rated_user_id' => 62, 'rating' => 2, 'comment' => 'slow', 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
            ['ticket_id' => 901, 'user_id' => 61, 'rated_user_id' => 63, 'rating' => 5, 'comment' => 'great', 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
        ]);

        self::$capsule->table('support_routing_settings')->insert([
            'id' => 1,
            'ai_enabled' => 0,
            'weights_json' => json_encode(['feedback_weight' => 8]),
            'fallback_json' => json_encode(['default_feedback_rating' => 3.5]),
            'defaults_json' => json_encode(['min_agent_level' => 1]),
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 602,
            'user_id' => 61,
            'subject' => 'Rating tie-break',
            'category' => 'website_bug',
            'status' => 'open',
            'priority' => 'normal',
            'sla_status' => 'pending',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('support_ticket_messages')->insert([
            'ticket_id' => 602,
            'sender_id' => 61,
            'sender_role' => 'user',
            'sender_name' => 'requester',
            'body' => 'Need help',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->method('logSystemEvent')->willReturn(true);

        $Silian_engine = new SupportRoutingEngineService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $Silian_audit,
            $this->createMock(ErrorLogService::class),
            new SupportRoutingTriageService(null, $this->createMock(LoggerInterface::class))
        );

        $Silian_result = $Silian_engine->routeTicket(602, 'created');

        $this->assertSame(63, $Silian_result['assigned_to']);
    }

    public function testNotifyAssigneeLogsFailedWhenNoChannelSucceeds(): void
    {
        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_logger->expects($this->exactly(2))->method('warning');

        $Silian_loggedPayloads = [];
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->exactly(3))
            ->method('log')
            ->willReturnCallback(static function (array $Silian_payload) use (&$Silian_loggedPayloads): bool {
                $Silian_loggedPayloads[] = $Silian_payload;
                return true;
            });

        $Silian_messageService = $this->createMock(MessageService::class);
        $Silian_messageService->method('sendSystemMessage')->willThrowException(new \RuntimeException('message failed'));

        $Silian_emailService = $this->createMock(EmailService::class);
        $Silian_emailService->method('sendMessageNotification')->willThrowException(new \RuntimeException('email failed'));

        $Silian_engine = new SupportRoutingEngineService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $this->createMock(ErrorLogService::class),
            new SupportRoutingTriageService(null, $this->createMock(LoggerInterface::class)),
            $Silian_messageService,
            $Silian_emailService
        );

        $Silian_method = new \ReflectionMethod($Silian_engine, 'notifyAssignee');
        $Silian_method->setAccessible(true);
        $Silian_method->invoke($Silian_engine, ['id' => 99, 'username' => 'supporter', 'email' => 'support@example.com'], 'Subject', 'Body', 123);

        $Silian_finalNotificationLog = null;
        foreach ($Silian_loggedPayloads as $Silian_payload) {
            if (($Silian_payload['action'] ?? null) === 'support_routing_assignee_notified') {
                $Silian_finalNotificationLog = $Silian_payload;
                break;
            }
        }

        $this->assertNotNull($Silian_finalNotificationLog);
        $this->assertSame('failed', $Silian_finalNotificationLog['status'] ?? null);
        $this->assertFalse($Silian_finalNotificationLog['data']['message_sent'] ?? true);
        $this->assertFalse($Silian_finalNotificationLog['data']['email_sent'] ?? true);
    }

    public function testBuildSlaSummaryMarksTicketAsDueSoon(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_tz = new \DateTimeZone('Asia/Shanghai');
        $Silian_base = new \DateTimeImmutable('now', $Silian_tz);
        self::$capsule->table('support_routing_settings')->insert([
            'id' => 1,
            'ai_enabled' => 0,
            'due_soon_minutes' => 30,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_engine = new SupportRoutingEngineService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            new SupportRoutingTriageService(null, $this->createMock(LoggerInterface::class))
        );

        $Silian_summary = $Silian_engine->buildSlaSummaryForTicket([
            'status' => 'open',
            'sla_status' => 'pending',
            'first_support_response_at' => null,
            'first_response_due_at' => $Silian_base->modify('+20 minutes')->format('Y-m-d H:i:s'),
            'resolution_due_at' => $Silian_base->modify('+3 hours')->format('Y-m-d H:i:s'),
        ]);

        $this->assertSame('due_soon', $Silian_summary['display_state']);
        $this->assertSame('first_response', $Silian_summary['active_target']);
        $this->assertSame('due_soon', $Silian_summary['first_response']['state']);
    }

    public function testBuildSlaSummaryHonorsConfiguredAppTimezone(): void
    {
        $Silian_previousEnv = $_ENV['APP_TIMEZONE'] ?? null;
        $Silian_previousGetenv = getenv('APP_TIMEZONE');
        $_ENV['APP_TIMEZONE'] = 'UTC';
        putenv('APP_TIMEZONE=UTC');

        try {
            $Silian_now = date('Y-m-d H:i:s');
            $Silian_base = new \DateTimeImmutable('now', new \DateTimeZone('UTC'));
            self::$capsule->table('support_routing_settings')->insert([
                'id' => 1,
                'ai_enabled' => 0,
                'due_soon_minutes' => 30,
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ]);

            $Silian_engine = new SupportRoutingEngineService(
                self::$capsule->getConnection()->getPdo(),
                $this->createMock(LoggerInterface::class),
                $this->createMock(AuditLogService::class),
                $this->createMock(ErrorLogService::class),
                new SupportRoutingTriageService(null, $this->createMock(LoggerInterface::class))
            );

            $Silian_summary = $Silian_engine->buildSlaSummaryForTicket([
                'status' => 'open',
                'sla_status' => 'pending',
                'first_support_response_at' => null,
                'first_response_due_at' => $Silian_base->modify('+20 minutes')->format('Y-m-d H:i:s'),
                'resolution_due_at' => $Silian_base->modify('+3 hours')->format('Y-m-d H:i:s'),
            ]);

            $this->assertSame('due_soon', $Silian_summary['display_state']);
            $this->assertSame('due_soon', $Silian_summary['first_response']['state']);
        } finally {
            if ($Silian_previousEnv === null) {
                unset($_ENV['APP_TIMEZONE']);
            } else {
                $_ENV['APP_TIMEZONE'] = $Silian_previousEnv;
            }
            if ($Silian_previousGetenv === false) {
                putenv('APP_TIMEZONE');
            } else {
                putenv('APP_TIMEZONE=' . $Silian_previousGetenv);
            }
        }
    }

    public function testRunSlaSweepDoesNotReEscalateAlreadyEscalatedTicket(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        self::$capsule->table('users')->insert([
            ['id' => 31, 'username' => 'requester', 'email' => 'requester@example.com', 'role' => 'user', 'status' => 'active', 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
            ['id' => 32, 'username' => 'supporter', 'email' => 'support@example.com', 'role' => 'support', 'status' => 'active', 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
        ]);
        self::$capsule->table('support_assignee_profiles')->insert([
            'user_id' => 32,
            'level' => 2,
            'skills_json' => json_encode([]),
            'languages_json' => json_encode([]),
            'max_active_tickets' => 10,
            'is_auto_assignable' => 1,
            'status' => 'active',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('support_routing_settings')->insert([
            'id' => 1,
            'ai_enabled' => 0,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('support_tickets')->insert([
            'id' => 303,
            'user_id' => 31,
            'subject' => 'Already escalated',
            'category' => 'website_bug',
            'status' => 'open',
            'priority' => 'urgent',
            'assigned_to' => 32,
            'assignment_source' => 'smart',
            'assignment_locked' => 0,
            'first_response_due_at' => date('Y-m-d H:i:s', strtotime('-2 hours')),
            'resolution_due_at' => date('Y-m-d H:i:s', strtotime('-1 hour')),
            'sla_status' => 'escalated',
            'escalation_level' => 3,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->method('logSystemEvent')->willReturn(true);

        $Silian_engine = new SupportRoutingEngineService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $Silian_audit,
            $this->createMock(ErrorLogService::class),
            new SupportRoutingTriageService(null, $this->createMock(LoggerInterface::class))
        );

        $Silian_result = $Silian_engine->runSlaSweep();
        $Silian_ticket = self::$capsule->table('support_tickets')->where('id', 303)->first();

        $this->assertSame(['processed' => 0, 'breached' => 0, 'rerouted' => 0], $Silian_result);
        $this->assertSame(3, (int) $Silian_ticket->escalation_level);
        $this->assertSame('escalated', $Silian_ticket->sla_status);
        $this->assertSame(0, (int) self::$capsule->table('support_ticket_routing_runs')->count());
    }

    public function testRunSlaSweepRetriesPreviouslyBreachedTicketWithoutIncrementingEscalationAgain(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        self::$capsule->table('users')->insert([
            ['id' => 41, 'username' => 'requester', 'email' => 'requester@example.com', 'role' => 'user', 'status' => 'active', 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
            ['id' => 42, 'username' => 'supporter', 'email' => 'support@example.com', 'role' => 'support', 'status' => 'active', 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
        ]);
        self::$capsule->table('support_assignee_profiles')->insert([
            'user_id' => 42,
            'level' => 4,
            'skills_json' => json_encode([]),
            'languages_json' => json_encode([]),
            'max_active_tickets' => 10,
            'is_auto_assignable' => 1,
            'status' => 'active',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('support_routing_settings')->insert([
            'id' => 1,
            'ai_enabled' => 0,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('support_tickets')->insert([
            'id' => 404,
            'user_id' => 41,
            'subject' => 'Retry breached reroute',
            'category' => 'website_bug',
            'status' => 'open',
            'priority' => 'low',
            'assigned_to' => 42,
            'assignment_source' => 'smart',
            'assignment_locked' => 0,
            'first_response_due_at' => date('Y-m-d H:i:s', strtotime('-2 hours')),
            'resolution_due_at' => date('Y-m-d H:i:s', strtotime('-1 hour')),
            'sla_status' => 'breached',
            'escalation_level' => 2,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('support_ticket_messages')->insert([
            'ticket_id' => 404,
            'sender_id' => 41,
            'sender_role' => 'user',
            'sender_name' => 'requester',
            'body' => 'Please retry',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->method('logSystemEvent')->willReturn(true);

        $Silian_engine = new SupportRoutingEngineService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $Silian_audit,
            $this->createMock(ErrorLogService::class),
            new SupportRoutingTriageService(null, $this->createMock(LoggerInterface::class))
        );

        $Silian_result = $Silian_engine->runSlaSweep();
        $Silian_ticket = self::$capsule->table('support_tickets')->where('id', 404)->first();

        $this->assertSame(1, $Silian_result['processed']);
        $this->assertSame(1, $Silian_result['breached']);
        $this->assertSame(1, $Silian_result['rerouted']);
        $this->assertSame(2, (int) $Silian_ticket->escalation_level);
        $this->assertSame('escalated', $Silian_ticket->sla_status);
    }

    public function testRunSlaSweepKeepsTicketBreachedWhenRerouteFindsNoWinner(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        self::$capsule->table('users')->insert([
            ['id' => 51, 'username' => 'requester', 'email' => 'requester@example.com', 'role' => 'user', 'status' => 'active', 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
        ]);
        self::$capsule->table('support_routing_settings')->insert([
            'id' => 1,
            'ai_enabled' => 0,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('support_tickets')->insert([
            'id' => 505,
            'user_id' => 51,
            'subject' => 'No winner available',
            'category' => 'website_bug',
            'status' => 'open',
            'priority' => 'high',
            'assignment_locked' => 0,
            'first_response_due_at' => date('Y-m-d H:i:s', strtotime('-2 hours')),
            'resolution_due_at' => date('Y-m-d H:i:s', strtotime('-1 hour')),
            'sla_status' => 'pending',
            'escalation_level' => 0,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('support_ticket_messages')->insert([
            'ticket_id' => 505,
            'sender_id' => 51,
            'sender_role' => 'user',
            'sender_name' => 'requester',
            'body' => 'Please route me',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->method('logSystemEvent')->willReturn(true);

        $Silian_engine = new SupportRoutingEngineService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $Silian_audit,
            $this->createMock(ErrorLogService::class),
            new SupportRoutingTriageService(null, $this->createMock(LoggerInterface::class))
        );

        $Silian_result = $Silian_engine->runSlaSweep();
        $Silian_ticket = self::$capsule->table('support_tickets')->where('id', 505)->first();

        $this->assertSame(1, $Silian_result['processed']);
        $this->assertSame(1, $Silian_result['breached']);
        $this->assertSame(0, $Silian_result['rerouted']);
        $this->assertSame('breached', $Silian_ticket->sla_status);
        $this->assertSame(1, (int) $Silian_ticket->escalation_level);
        $this->assertNull($Silian_ticket->assigned_to);
        $this->assertSame(1, (int) self::$capsule->table('support_ticket_routing_runs')->count());
    }

    public function testRoutingSummaryKeepsTopFactorsMachineReadable(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        self::$capsule->table('support_ticket_routing_runs')->insert([
            'ticket_id' => 101,
            'trigger' => 'created',
            'used_ai' => 1,
            'summary_json' => json_encode([
                'top_factors' => [
                    'severity' => 12.5,
                    'priority' => 9.0,
                ],
            ]),
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_engine = new SupportRoutingEngineService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            new SupportRoutingTriageService(null, $this->createMock(LoggerInterface::class))
        );

        $Silian_summary = $Silian_engine->getRoutingSummaryForTicket(101);
        $Silian_runs = $Silian_engine->getRoutingRunsForTicket(101);

        $this->assertIsArray($Silian_summary['top_factors']);
        $this->assertSame(['severity' => 12.5, 'priority' => 9.0], $Silian_summary['top_factors']);
        $this->assertSame(['severity' => 12.5, 'priority' => 9.0], $Silian_runs[0]['summary']['top_factors']);
    }

    public function testRoutingSummaryTrimsWhitespaceOnlyTopFactorsListEntries(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        self::$capsule->table('support_ticket_routing_runs')->insert([
            'ticket_id' => 102,
            'trigger' => 'created',
            'used_ai' => 1,
            'summary_json' => json_encode([
                'top_factors' => ['  severity  ', '   ', null, 0, 'priority'],
            ]),
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_engine = new SupportRoutingEngineService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            new SupportRoutingTriageService(null, $this->createMock(LoggerInterface::class))
        );

        $Silian_summary = $Silian_engine->getRoutingSummaryForTicket(102);

        $this->assertSame(['severity', '0', 'priority'], $Silian_summary['top_factors']);
    }

    public function testRoutingRunsPreserveStoredCandidateNames(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        self::$capsule->table('support_ticket_routing_runs')->insert([
            'ticket_id' => 103,
            'trigger' => 'created',
            'used_ai' => 1,
            'winner_user_id' => 12,
            'winner_score' => 66.5,
            'candidate_scores_json' => json_encode([
                ['candidate' => ['id' => 11, 'username' => 'alpha'], 'candidate_id' => 11, 'total_score' => 61.2],
                ['candidate' => ['id' => 12, 'username' => 'beta'], 'candidate_id' => 12, 'total_score' => 66.5],
            ]),
            'summary_json' => json_encode(['winner_label' => 'beta']),
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_engine = new SupportRoutingEngineService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            new SupportRoutingTriageService(null, $this->createMock(LoggerInterface::class))
        );

        $Silian_runs = $Silian_engine->getRoutingRunsForTicket(103);

        $this->assertSame('alpha', $Silian_runs[0]['candidate_scores'][0]['candidate']['username']);
        $this->assertSame('beta', $Silian_runs[0]['candidate_scores'][1]['candidate']['username']);
        $this->assertSame('beta', $Silian_runs[0]['summary']['winner_label']);
    }
}
