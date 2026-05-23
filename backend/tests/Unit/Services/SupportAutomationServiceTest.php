<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\RegionService;
use CarbonTrack\Services\SupportAutomationService;
use CarbonTrack\Services\UserProfileViewService;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

class SupportAutomationServiceTest extends TestCase
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

        self::$capsule->schema()->create('schools', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->string('name');
        });

        self::$capsule->schema()->create('users', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->string('uuid')->nullable();
            $Silian_table->string('username')->nullable();
            $Silian_table->string('email')->nullable();
            $Silian_table->string('role')->default('user');
            $Silian_table->boolean('is_admin')->default(false);
            $Silian_table->string('status')->default('active');
            $Silian_table->integer('school_id')->nullable();
            $Silian_table->string('region_code')->nullable();
            $Silian_table->integer('group_id')->nullable();
            $Silian_table->timestamp('lastlgn')->nullable();
            $Silian_table->text('admin_notes')->nullable();
            $Silian_table->timestamp('deleted_at')->nullable();
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
            $Silian_table->string('last_reply_by_role')->nullable();
            $Silian_table->timestamp('last_replied_at')->nullable();
            $Silian_table->timestamp('resolved_at')->nullable();
            $Silian_table->timestamp('closed_at')->nullable();
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
            $Silian_table->string('description')->nullable();
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
            $Silian_table->string('description')->nullable();
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
            $Silian_table->boolean('ai_enabled')->default(true);
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
            'support_ticket_feedback',
            'support_ticket_tag_assignments',
            'support_ticket_tags',
            'support_ticket_automation_rules',
            'support_tickets',
            'schools',
            'users',
        ] as $Silian_table) {
            self::$capsule->table($Silian_table)->delete();
        }
    }

    public function testListAssignableUsersUsesSchoolLookupWithoutLegacySchoolColumn(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        self::$capsule->table('schools')->insert([
            'id' => 9,
            'name' => 'Green Academy',
        ]);
        self::$capsule->table('users')->insert([
            'id' => 1,
            'uuid' => 'requester-uuid',
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'is_admin' => 0,
            'status' => 'active',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('users')->insert([
            'id' => 2,
            'uuid' => 'support-uuid',
            'username' => 'supporter',
            'email' => 'support@example.com',
            'role' => 'support',
            'is_admin' => 0,
            'status' => 'active',
            'school_id' => 9,
            'region_code' => 'US-CA',
            'group_id' => 1,
            'lastlgn' => $Silian_now,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('support_tickets')->insert([
            'id' => 10,
            'user_id' => 1,
            'subject' => 'Critical bug',
            'category' => 'website_bug',
            'status' => 'open',
            'priority' => 'urgent',
            'assigned_to' => 2,
            'assignment_source' => 'rule',
            'assigned_rule_id' => 3,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_users = $this->makeService()->listAssignableUsers();

        $this->assertCount(1, $Silian_users);
        $this->assertSame('Green Academy', $Silian_users[0]['school']);
        $this->assertSame('US-CA', $Silian_users[0]['region_code']);
        $this->assertStringContainsString('California', (string) $Silian_users[0]['location']);
        $this->assertSame(1, $Silian_users[0]['assigned_total_count']);
        $this->assertSame(1, $Silian_users[0]['open_count']);
    }

    public function testGetAssignableUserDetailUsesSchoolLookupWithoutLegacySchoolColumn(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        self::$capsule->table('schools')->insert([
            'id' => 9,
            'name' => 'Green Academy',
        ]);
        self::$capsule->table('users')->insert([
            'id' => 2,
            'uuid' => 'support-uuid',
            'username' => 'supporter',
            'email' => 'support@example.com',
            'role' => 'support',
            'is_admin' => 0,
            'status' => 'active',
            'school_id' => 9,
            'region_code' => 'US-CA',
            'group_id' => 1,
            'lastlgn' => $Silian_now,
            'admin_notes' => 'On-call this week',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_detail = $this->makeService()->getAssignableUserDetail(2);

        $this->assertNotNull($Silian_detail);
        $this->assertSame('Green Academy', $Silian_detail['school']);
        $this->assertSame('US-CA', $Silian_detail['region_code']);
        $this->assertStringContainsString('California', (string) $Silian_detail['location']);
        $this->assertSame('On-call this week', $Silian_detail['admin_notes']);
        $this->assertSame([], $Silian_detail['recent_tickets']);
    }

    public function testGetAssignableUserDetailIncludesFeedbackSummaryAndEntries(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        self::$capsule->table('users')->insert([
            [
                'id' => 1,
                'uuid' => 'reviewer-uuid',
                'username' => 'requester',
                'email' => 'requester@example.com',
                'role' => 'user',
                'is_admin' => 0,
                'status' => 'active',
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ],
            [
                'id' => 2,
                'uuid' => 'support-uuid',
                'username' => 'supporter',
                'email' => 'support@example.com',
                'role' => 'support',
                'is_admin' => 0,
                'status' => 'active',
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ],
        ]);
        self::$capsule->table('support_tickets')->insert([
            [
                'id' => 10,
                'user_id' => 1,
                'subject' => 'Bug fix follow-up',
                'category' => 'website_bug',
                'status' => 'resolved',
                'priority' => 'high',
                'assigned_to' => 2,
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ],
            [
                'id' => 11,
                'user_id' => 1,
                'subject' => 'Account issue',
                'category' => 'account',
                'status' => 'closed',
                'priority' => 'normal',
                'assigned_to' => 2,
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ],
        ]);
        self::$capsule->table('support_ticket_feedback')->insert([
            [
                'ticket_id' => 10,
                'user_id' => 1,
                'rated_user_id' => 2,
                'rating' => 5,
                'comment' => '很专业',
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ],
            [
                'ticket_id' => 11,
                'user_id' => 1,
                'rated_user_id' => 2,
                'rating' => 4,
                'comment' => '回复很快',
                'created_at' => date('Y-m-d H:i:s', strtotime('-1 hour')),
                'updated_at' => date('Y-m-d H:i:s', strtotime('-1 hour')),
            ],
        ]);

        $Silian_detail = $this->makeService()->getAssignableUserDetail(2);

        $this->assertNotNull($Silian_detail);
        $this->assertSame(4.5, $Silian_detail['feedback_summary']['average_rating']);
        $this->assertSame(2, $Silian_detail['feedback_summary']['rating_count']);
        $this->assertCount(5, $Silian_detail['feedback_summary']['distribution']);
        $this->assertSame(1, $Silian_detail['feedback_summary']['distribution'][0]['count']);
        $this->assertCount(2, $Silian_detail['feedback_entries']);
        $this->assertSame('Bug fix follow-up', $Silian_detail['feedback_entries'][0]['ticket']['subject']);
        $this->assertSame('requester', $Silian_detail['feedback_entries'][0]['reviewer']['username']);
        $this->assertSame('很专业', $Silian_detail['feedback_entries'][0]['comment']);
    }

    public function testGetAssignableUserDetailKeepsFeedbackEntryWhenReviewerIsSoftDeleted(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        self::$capsule->table('users')->insert([
            'id' => 1,
            'uuid' => 'reviewer-uuid',
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'is_admin' => 0,
            'status' => 'active',
            'deleted_at' => $Silian_now,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('users')->insert([
            'id' => 2,
            'uuid' => 'support-uuid',
            'username' => 'supporter',
            'email' => 'support@example.com',
            'role' => 'support',
            'is_admin' => 0,
            'status' => 'active',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('support_tickets')->insert([
            'id' => 10,
            'user_id' => 1,
            'subject' => 'Historical feedback',
            'category' => 'website_bug',
            'status' => 'resolved',
            'priority' => 'high',
            'assigned_to' => 2,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('support_ticket_feedback')->insert([
            'ticket_id' => 10,
            'user_id' => 1,
            'rated_user_id' => 2,
            'rating' => 5,
            'comment' => '仍应保留',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_detail = $this->makeService()->getAssignableUserDetail(2);

        $this->assertNotNull($Silian_detail);
        $this->assertSame(1, $Silian_detail['feedback_summary']['rating_count']);
        $this->assertCount(1, $Silian_detail['feedback_entries']);
        $this->assertSame(1, $Silian_detail['feedback_entries'][0]['reviewer']['id']);
        $this->assertNull($Silian_detail['feedback_entries'][0]['reviewer']['username']);
        $this->assertNull($Silian_detail['feedback_entries'][0]['reviewer']['email']);
    }

    public function testApplyRulesAddsTagsAndPreservesTicketAssignmentForScoring(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        self::$capsule->table('users')->insert([
            ['id' => 1, 'username' => 'requester', 'email' => 'requester@example.com', 'role' => 'user', 'is_admin' => 0, 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
            ['id' => 2, 'username' => 'supporter', 'email' => 'support@example.com', 'role' => 'support', 'is_admin' => 0, 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
        ]);
        self::$capsule->table('support_tickets')->insert([
            'id' => 10,
            'user_id' => 1,
            'subject' => 'Critical bug',
            'category' => 'website_bug',
            'status' => 'open',
            'priority' => 'urgent',
            'assigned_to' => null,
            'assignment_source' => null,
            'assigned_rule_id' => null,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('support_ticket_tags')->insert([
            'id' => 7,
            'slug' => 'hotfix',
            'name' => 'Hotfix',
            'color' => 'rose',
            'is_active' => 1,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_weekday = strtolower((new DateTimeImmutable('now', new DateTimeZone('Asia/Shanghai')))->format('D'));
        self::$capsule->table('support_ticket_automation_rules')->insert([
            'id' => 3,
            'name' => 'Urgent bug routing',
            'is_active' => 1,
            'sort_order' => 1,
            'match_category' => 'website_bug',
            'match_priority' => 'urgent',
            'match_weekdays' => json_encode([$Silian_weekday]),
            'match_time_start' => '00:00',
            'match_time_end' => '23:59',
            'timezone' => 'Asia/Shanghai',
            'assign_to' => 2,
            'score_boost' => 20,
            'required_agent_level' => 2,
            'skill_hints_json' => json_encode(['billing', 'bug']),
            'add_tag_ids' => json_encode([7]),
            'stop_processing' => 1,
            'trigger_count' => 0,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_service = $this->makeService();
        $Silian_result = $Silian_service->applyRulesToTicket(10, null, 'created');

        $this->assertNull($Silian_result['assigned_to']);
        $this->assertNull($Silian_result['assignment_source']);
        $this->assertNull($Silian_result['assigned_rule_id']);
        $this->assertCount(1, $Silian_result['applied_rules']);
        $this->assertSame(2, $Silian_result['applied_rules'][0]['assigned_to']);
        $this->assertSame(20.0, $Silian_result['applied_rules'][0]['score_boost']);
        $this->assertSame(2, $Silian_result['applied_rules'][0]['required_agent_level']);
        $this->assertCount(1, $Silian_result['tags']);
        $this->assertSame('hotfix', $Silian_result['tags'][0]['slug']);

        $Silian_ticket = self::$capsule->table('support_tickets')->where('id', 10)->first();
        $this->assertNull($Silian_ticket->assigned_to);
        $this->assertNull($Silian_ticket->assignment_source);
        $this->assertNull($Silian_ticket->assigned_rule_id);
        $this->assertSame(1, self::$capsule->table('support_ticket_tag_assignments')->count());
    }

    public function testReportsAggregateCountsAcrossRulesTagsAndAssignments(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_yesterday = date('Y-m-d H:i:s', strtotime('-1 day'));
        self::$capsule->table('users')->insert([
            ['id' => 1, 'username' => 'supporter', 'email' => 'support@example.com', 'role' => 'support', 'is_admin' => 0, 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
        ]);
        self::$capsule->table('support_ticket_tags')->insert([
            ['id' => 7, 'slug' => 'hotfix', 'name' => 'Hotfix', 'color' => 'rose', 'is_active' => 1, 'created_at' => $Silian_now, 'updated_at' => $Silian_now],
        ]);
        self::$capsule->table('support_ticket_automation_rules')->insert([
            'id' => 3,
            'name' => 'Urgent bug routing',
            'is_active' => 1,
            'sort_order' => 1,
            'timezone' => 'Asia/Shanghai',
            'trigger_count' => 4,
            'last_triggered_at' => $Silian_now,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('support_tickets')->insert([
            [
                'id' => 10,
                'user_id' => 1,
                'subject' => 'Critical bug',
                'category' => 'website_bug',
                'status' => 'open',
                'priority' => 'urgent',
                'assigned_to' => 1,
                'assignment_source' => 'smart',
                'assigned_rule_id' => 3,
                'sla_status' => 'escalated',
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
                'resolved_at' => null,
            ],
            [
                'id' => 11,
                'user_id' => 1,
                'subject' => 'Question',
                'category' => 'account',
                'status' => 'resolved',
                'priority' => 'normal',
                'assigned_to' => null,
                'assignment_source' => null,
                'assigned_rule_id' => null,
                'sla_status' => 'resolved',
                'created_at' => $Silian_yesterday,
                'updated_at' => $Silian_now,
                'resolved_at' => $Silian_now,
            ],
        ]);
        self::$capsule->table('support_ticket_tag_assignments')->insert([
            'ticket_id' => 10,
            'tag_id' => 7,
            'source_type' => 'rule',
            'rule_id' => 3,
            'created_at' => $Silian_now,
        ]);

        $Silian_service = $this->makeService();
        $Silian_reports = $Silian_service->getReports(['days' => 14]);

        $this->assertSame(2, $Silian_reports['summary']['total']);
        $this->assertSame(1, $Silian_reports['summary']['smart_assignment_count']);
        $this->assertSame(1, $Silian_reports['summary']['sla_breach_count']);
        $this->assertSame(1, $Silian_reports['summary']['unassigned']);
        $this->assertNotNull($Silian_reports['summary']['avg_resolution_hours']);
        $this->assertNotEmpty($Silian_reports['timeline']);
        $this->assertContains('website_bug', array_column($Silian_reports['by_category'], 'key'));
        $this->assertSame('hotfix', $Silian_reports['by_tag'][0]['slug']);
        $this->assertSame(4, $Silian_reports['rule_hits'][0]['trigger_count']);
    }

    public function testReportsAggregateRoutingOutcomesByTrigger(): void
    {
        $Silian_now = date('Y-m-d H:i:s');

        self::$capsule->table('support_ticket_routing_runs')->insert([
            [
                'ticket_id' => 10,
                'trigger' => 'created',
                'used_ai' => 1,
                'winner_user_id' => 2,
                'winner_score' => 88.5,
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ],
            [
                'ticket_id' => 11,
                'trigger' => 'created',
                'used_ai' => 0,
                'winner_user_id' => null,
                'winner_score' => null,
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ],
            [
                'ticket_id' => 12,
                'trigger' => 'sla_breach',
                'used_ai' => 1,
                'winner_user_id' => 3,
                'winner_score' => 91.0,
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ],
        ]);

        $Silian_reports = $this->makeService()->getReports(['days' => 14]);
        $Silian_byTrigger = [];
        foreach ($Silian_reports['routing_outcomes'] as $Silian_row) {
            $Silian_byTrigger[$Silian_row['trigger']] = $Silian_row;
        }

        $this->assertSame(2, $Silian_byTrigger['created']['count'] ?? null);
        $this->assertSame(1, $Silian_byTrigger['created']['no_winner_count'] ?? null);
        $this->assertSame(1, $Silian_byTrigger['created']['used_ai_count'] ?? null);
        $this->assertSame(1, $Silian_byTrigger['sla_breach']['count'] ?? null);
        $this->assertSame(0, $Silian_byTrigger['sla_breach']['no_winner_count'] ?? null);
        $this->assertSame(1, $Silian_byTrigger['sla_breach']['used_ai_count'] ?? null);
    }

    private function makeService(): SupportAutomationService
    {
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->method('log')->willReturn(true);

        return new SupportAutomationService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $Silian_audit,
            $this->createMock(ErrorLogService::class),
            new UserProfileViewService(new RegionService())
        );
    }
}
