<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Models\File;
use CarbonTrack\Models\User;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\CloudflareR2Service;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\EmailService;
use CarbonTrack\Services\FileMetadataService;
use CarbonTrack\Services\MessageService;
use CarbonTrack\Services\NotificationPreferenceService;
use CarbonTrack\Services\SupportAutomationService;
use CarbonTrack\Services\SupportTicketService;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

class SupportTicketServiceTest extends TestCase
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
            $Silian_table->string('uuid')->nullable();
            $Silian_table->string('username')->nullable();
            $Silian_table->string('email')->nullable();
            $Silian_table->string('role')->default('user');
            $Silian_table->boolean('is_admin')->default(false);
            $Silian_table->integer('avatar_id')->nullable();
            $Silian_table->string('status')->nullable();
            $Silian_table->integer('school_id')->nullable();
            $Silian_table->string('school')->nullable();
            $Silian_table->string('region_code')->nullable();
            $Silian_table->string('location')->nullable();
            $Silian_table->integer('group_id')->nullable();
            $Silian_table->timestamp('lastlgn')->nullable();
            $Silian_table->text('admin_notes')->nullable();
            $Silian_table->integer('notification_email_mask')->default(0);
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

        self::$capsule->schema()->create('support_ticket_attachments', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->integer('ticket_id');
            $Silian_table->integer('message_id');
            $Silian_table->integer('file_id')->nullable();
            $Silian_table->string('file_path');
            $Silian_table->string('original_name');
            $Silian_table->string('mime_type')->nullable();
            $Silian_table->integer('size')->default(0);
            $Silian_table->string('entity_type')->default('support_ticket_message');
            $Silian_table->timestamp('created_at')->nullable();
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
            $Silian_table->unique(['ticket_id', 'user_id', 'rated_user_id'], 'uniq_ticket_user_rated');
        });

        self::$capsule->schema()->create('avatars', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->string('name')->nullable();
            $Silian_table->string('file_path')->nullable();
            $Silian_table->timestamp('created_at')->nullable();
            $Silian_table->timestamp('updated_at')->nullable();
            $Silian_table->timestamp('deleted_at')->nullable();
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

        self::$capsule->schema()->create('support_ticket_transfer_requests', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->integer('ticket_id');
            $Silian_table->integer('requested_by');
            $Silian_table->integer('from_assignee')->nullable();
            $Silian_table->integer('to_assignee');
            $Silian_table->text('reason')->nullable();
            $Silian_table->string('status')->default('pending');
            $Silian_table->text('review_note')->nullable();
            $Silian_table->integer('reviewed_by')->nullable();
            $Silian_table->timestamp('reviewed_at')->nullable();
            $Silian_table->timestamp('created_at')->nullable();
            $Silian_table->timestamp('updated_at')->nullable();
        });
    }

    protected function setUp(): void
    {
        parent::setUp();

        if (self::$capsule !== null) {
            self::$capsule->table('support_ticket_transfer_requests')->delete();
            self::$capsule->table('support_ticket_tag_assignments')->delete();
            self::$capsule->table('support_ticket_tags')->delete();
            self::$capsule->table('avatars')->delete();
            self::$capsule->table('support_ticket_feedback')->delete();
            self::$capsule->table('support_ticket_attachments')->delete();
            self::$capsule->table('support_ticket_messages')->delete();
            self::$capsule->table('support_tickets')->delete();
            self::$capsule->table('users')->delete();
        }
    }

    public function testListSupportTicketsUsesDistinctSearchBindings(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_errorLog = $this->createMock(ErrorLogService::class);
        $Silian_fileMetadata = $this->createMock(FileMetadataService::class);
        $Silian_audit->method('log')->willReturn(true);
        $Silian_listExecuteParams = null;
        $Silian_countExecuteParams = null;

        $Silian_listStmt = $this->createMock(\PDOStatement::class);
        $Silian_listStmt->expects($this->once())
            ->method('execute')
            ->willReturnCallback(function (array $Silian_params) use (&$Silian_listExecuteParams) {
                $Silian_listExecuteParams = $Silian_params;
                return true;
            });
        $Silian_listStmt->expects($this->once())->method('fetchAll')->willReturn([]);

        $Silian_countStmt = $this->createMock(\PDOStatement::class);
        $Silian_countStmt->expects($this->once())
            ->method('execute')
            ->willReturnCallback(function (array $Silian_params) use (&$Silian_countExecuteParams) {
                $Silian_countExecuteParams = $Silian_params;
                return true;
            });
        $Silian_countStmt->expects($this->once())->method('fetchColumn')->willReturn(0);

        $Silian_pdo->expects($this->exactly(2))
            ->method('prepare')
            ->willReturnCallback(function (string $Silian_sql) use ($Silian_listStmt, $Silian_countStmt) {
                static $Silian_prepareCalls = 0;
                $Silian_prepareCalls++;
                $this->assertStringContainsString('t.subject LIKE :search_subject', $Silian_sql);
                $this->assertStringContainsString('requester.username LIKE :search_username', $Silian_sql);
                $this->assertStringContainsString('requester.email LIKE :search_email', $Silian_sql);
                return $Silian_prepareCalls === 1 ? $Silian_listStmt : $Silian_countStmt;
            });

        $Silian_service = new SupportTicketService($Silian_pdo, $Silian_logger, $Silian_audit, $Silian_errorLog, $Silian_fileMetadata);
        $Silian_result = $Silian_service->listSupportTickets(['id' => 7, 'is_admin' => true], ['q' => 'billing']);

        $this->assertSame([], $Silian_result['items']);
        $this->assertSame('%billing%', $Silian_listExecuteParams['search_subject'] ?? null);
        $this->assertSame('%billing%', $Silian_listExecuteParams['search_username'] ?? null);
        $this->assertSame('%billing%', $Silian_listExecuteParams['search_email'] ?? null);
        $this->assertSame('%billing%', $Silian_countExecuteParams['search_subject'] ?? null);
    }

    public function testSupportReplyRejectsAttachmentOutsideTicketScope(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportUser = User::create([
            'username' => 'support-a',
            'email' => 'support-a@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 50,
            'user_id' => (int) $Silian_requester->id,
            'subject' => 'Cross-ticket leak check',
            'category' => 'website_bug',
            'status' => 'open',
            'priority' => 'normal',
            'assigned_to' => (int) $Silian_supportUser->id,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_errorLog = $this->createMock(ErrorLogService::class);
        $Silian_fileMetadata = $this->createMock(FileMetadataService::class);
        $Silian_audit->method('log')->willReturn(true);

        $Silian_foreignFile = new File([
            'id' => 501,
            'file_path' => 'support-tickets/2026/04/foreign-evidence.png',
            'original_name' => 'foreign-evidence.png',
            'mime_type' => 'image/png',
            'size' => 1234,
            'user_id' => (int) $Silian_requester->id,
        ]);
        $Silian_fileMetadata->expects($this->once())
            ->method('findByFilePath')
            ->with('support-tickets/2026/04/foreign-evidence.png')
            ->willReturn($Silian_foreignFile);

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $Silian_errorLog,
            $Silian_fileMetadata
        );

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Attachment is not authorized for this ticket');

        $Silian_service->addSupportMessage(
            ['id' => (int) $Silian_supportUser->id, 'role' => 'support', 'is_support' => true, 'username' => 'support-a'],
            50,
            [
                'content' => 'Attaching foreign file should fail',
                'attachments' => ['support-tickets/2026/04/foreign-evidence.png'],
            ]
        );
    }

    public function testSupportReplyCanReuseAttachmentAlreadyScopedToTicket(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportUser = User::create([
            'username' => 'support-a',
            'email' => 'support-a@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 51,
            'user_id' => (int) $Silian_requester->id,
            'subject' => 'Scoped attachment reuse',
            'category' => 'website_bug',
            'status' => 'open',
            'priority' => 'normal',
            'assigned_to' => (int) $Silian_supportUser->id,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('support_ticket_messages')->insert([
            'id' => 5101,
            'ticket_id' => 51,
            'sender_id' => (int) $Silian_requester->id,
            'sender_role' => 'user',
            'sender_name' => 'requester',
            'body' => 'Original attachment',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('support_ticket_attachments')->insert([
            'ticket_id' => 51,
            'message_id' => 5101,
            'file_id' => 601,
            'file_path' => 'support-tickets/2026/04/reused-proof.png',
            'original_name' => 'reused-proof.png',
            'mime_type' => 'image/png',
            'size' => 2048,
            'entity_type' => 'support_ticket_message',
            'created_at' => $Silian_now,
        ]);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_errorLog = $this->createMock(ErrorLogService::class);
        $Silian_fileMetadata = $this->createMock(FileMetadataService::class);
        $Silian_audit->method('log')->willReturn(true);

        $Silian_reusedFile = new File([
            'id' => 601,
            'file_path' => 'support-tickets/2026/04/reused-proof.png',
            'original_name' => 'reused-proof.png',
            'mime_type' => 'image/png',
            'size' => 2048,
            'user_id' => (int) $Silian_requester->id,
        ]);
        $Silian_fileMetadata->expects($this->once())
            ->method('findByFilePath')
            ->with('support-tickets/2026/04/reused-proof.png')
            ->willReturn($Silian_reusedFile);

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $Silian_errorLog,
            $Silian_fileMetadata
        );

        $Silian_result = $Silian_service->addSupportMessage(
            ['id' => (int) $Silian_supportUser->id, 'role' => 'support', 'is_support' => true, 'username' => 'support-a'],
            51,
            [
                'content' => 'Reusing already-scoped attachment',
                'attachments' => ['support-tickets/2026/04/reused-proof.png'],
            ]
        );

        $Silian_attachments = self::$capsule->table('support_ticket_attachments')
            ->where('ticket_id', 51)
            ->where('file_path', 'support-tickets/2026/04/reused-proof.png')
            ->get();

        $this->assertSame(2, $Silian_attachments->count());
        $this->assertSame(51, $Silian_result['id']);
    }

    public function testSupportReplyClearsResolvedMarkersWhenTicketReopens(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportUser = User::create([
            'username' => 'support-a',
            'email' => 'support-a@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 52,
            'user_id' => (int) $Silian_requester->id,
            'subject' => 'Reopen from support reply',
            'category' => 'account',
            'status' => 'resolved',
            'priority' => 'normal',
            'assigned_to' => (int) $Silian_supportUser->id,
            'sla_status' => 'resolved',
            'resolved_at' => $Silian_now,
            'closed_at' => $Silian_now,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            $this->createMock(FileMetadataService::class)
        );

        $Silian_result = $Silian_service->addSupportMessage(
            ['id' => (int) $Silian_supportUser->id, 'role' => 'support', 'is_support' => true, 'username' => 'support-a'],
            52,
            ['content' => 'Need more info from user']
        );

        $Silian_ticketRow = self::$capsule->table('support_tickets')->where('id', 52)->first();

        $this->assertSame('waiting_user', $Silian_result['status']);
        $this->assertSame('waiting_user', $Silian_ticketRow->status);
        $this->assertSame('pending', $Silian_ticketRow->sla_status);
        $this->assertNull($Silian_ticketRow->resolved_at);
        $this->assertNull($Silian_ticketRow->closed_at);
    }

    public function testSupportReplyCanResolveTicketWithFinalStatusNotification(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'notification_email_mask' => 0,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportUser = User::create([
            'username' => 'support-a',
            'email' => 'support-a@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 53,
            'user_id' => (int) $Silian_requester->id,
            'subject' => 'Reply and resolve',
            'category' => 'account',
            'status' => 'in_progress',
            'priority' => 'normal',
            'assigned_to' => (int) $Silian_supportUser->id,
            'sla_status' => 'pending',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_messages = $this->createMock(MessageService::class);
        $Silian_messages->expects($this->once())
            ->method('sendSystemMessage')
            ->with(
                (int) $Silian_requester->id,
                'Support replied to your ticket',
                $this->stringContains('Status: Resolved'),
                'message',
                'normal',
                'support_ticket',
                53,
                false
            );

        $Silian_email = $this->createMock(EmailService::class);
        $Silian_email->expects($this->once())
            ->method('sendSupportTicketNotification')
            ->with(
                'requester@example.com',
                'requester',
                'Support replied to ticket #53',
                $this->callback(function (array $Silian_payload): bool {
                    return ($Silian_payload['summary'] ?? null) === 'We posted a new reply and marked the ticket as resolved.'
                        && in_array(['label' => 'Status', 'value' => 'Resolved'], $Silian_payload['details'] ?? [], true)
                        && ($Silian_payload['message']['body'] ?? null) === 'All set now';
                }),
                NotificationPreferenceService::CATEGORY_MESSAGE,
                'normal'
            )
            ->willReturn(true);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->method('log')->willReturn(true);

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $Silian_audit,
            $this->createMock(ErrorLogService::class),
            $this->createMock(FileMetadataService::class),
            $Silian_email,
            $Silian_messages
        );

        $Silian_result = $Silian_service->addSupportMessage(
            ['id' => (int) $Silian_supportUser->id, 'role' => 'support', 'is_support' => true, 'username' => 'support-a'],
            53,
            ['content' => 'All set now', 'status' => 'resolved']
        );

        $Silian_ticketRow = self::$capsule->table('support_tickets')->where('id', 53)->first();

        $this->assertSame('resolved', $Silian_result['status']);
        $this->assertSame('resolved', $Silian_ticketRow->status);
        $this->assertSame('resolved', $Silian_ticketRow->sla_status);
        $this->assertNotNull($Silian_ticketRow->resolved_at);
    }

    public function testUpdateTicketFromSupportSendsUserSupportNotification(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'is_admin' => 0,
            'notification_email_mask' => 0,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportUser = User::create([
            'username' => 'supporter',
            'email' => 'support@example.com',
            'role' => 'support',
            'is_admin' => 0,
            'notification_email_mask' => 0,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 1,
            'user_id' => (int) $Silian_requester->id,
            'subject' => 'Broken dashboard',
            'category' => 'website_bug',
            'status' => 'open',
            'priority' => 'normal',
            'assigned_to' => (int) $Silian_supportUser->id,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_errorLog = $this->createMock(ErrorLogService::class);
        $Silian_fileMetadata = $this->createMock(FileMetadataService::class);
        $Silian_messages = $this->createMock(MessageService::class);
        $Silian_email = $this->createMock(EmailService::class);

        $Silian_audit->method('log')->willReturn(true);

        $Silian_messages->expects($this->once())
            ->method('sendSystemMessage')
            ->with(
                (int) $Silian_requester->id,
                'Support ticket #1 updated',
                $this->stringContains('Status: Open -> In progress'),
                'support_ticket',
                'normal',
                'support_ticket',
                1,
                false
            );

        $Silian_email->expects($this->once())
            ->method('sendSupportTicketNotification')
            ->with(
                'requester@example.com',
                'requester',
                'Support ticket #1 updated',
                $this->callback(function (array $Silian_payload): bool {
                    return ($Silian_payload['button_path'] ?? null) === 'tickets/1'
                        && ($Silian_payload['changes'][0]['label'] ?? null) === 'Status'
                        && ($Silian_payload['changes'][0]['to'] ?? null) === 'In progress'
                        && ($Silian_payload['changes'][1]['label'] ?? null) === 'Priority'
                        && ($Silian_payload['changes'][1]['to'] ?? null) === 'High'
                        && ($Silian_payload['details'][0]['label'] ?? null) === 'Status';
                }),
                NotificationPreferenceService::CATEGORY_SUPPORT,
                'normal'
            )
            ->willReturn(true);

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $Silian_errorLog,
            $Silian_fileMetadata,
            $Silian_email,
            $Silian_messages,
            null
        );

        $Silian_result = $Silian_service->updateTicketFromSupport(
            ['id' => (int) $Silian_supportUser->id, 'role' => 'support', 'is_support' => true],
            1,
            ['status' => 'in_progress', 'priority' => 'high']
        );

        $this->assertSame('in_progress', $Silian_result['status']);
        $this->assertSame('high', $Silian_result['priority']);
    }

    public function testListSupportTicketsCanFilterUnassignedQueue(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportUser = User::create([
            'username' => 'support-a',
            'email' => 'support-a@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_admin = User::create([
            'username' => 'admin-user',
            'email' => 'admin@example.com',
            'role' => 'admin',
            'is_admin' => 1,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            [
                'id' => 1,
                'user_id' => (int) $Silian_requester->id,
                'subject' => 'Unassigned ticket',
                'category' => 'website_bug',
                'status' => 'open',
                'priority' => 'normal',
                'assigned_to' => null,
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ],
            [
                'id' => 2,
                'user_id' => (int) $Silian_requester->id,
                'subject' => 'Assigned ticket',
                'category' => 'account',
                'status' => 'in_progress',
                'priority' => 'high',
                'assigned_to' => (int) $Silian_supportUser->id,
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ],
        ]);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_errorLog = $this->createMock(ErrorLogService::class);
        $Silian_fileMetadata = $this->createMock(FileMetadataService::class);
        $Silian_automation = $this->createMock(SupportAutomationService::class);
        $Silian_audit->method('log')->willReturn(true);
        $Silian_automation->method('getTagsForTicketIds')->willReturn([]);

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $Silian_errorLog,
            $Silian_fileMetadata,
            null,
            null,
            null,
            $Silian_automation
        );

        $Silian_result = $Silian_service->listSupportTickets(
            ['id' => (int) $Silian_admin->id, 'role' => 'admin', 'is_admin' => true],
            ['assigned_to' => 0]
        );

        $this->assertCount(1, $Silian_result['items']);
        $this->assertSame(1, $Silian_result['items'][0]['id']);
    }

    public function testSupportUserOnlySeesAssignedTickets(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportA = User::create([
            'username' => 'support-a',
            'email' => 'support-a@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportB = User::create([
            'username' => 'support-b',
            'email' => 'support-b@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            [
                'id' => 1,
                'user_id' => (int) $Silian_requester->id,
                'subject' => 'Mine',
                'category' => 'website_bug',
                'status' => 'open',
                'priority' => 'normal',
                'assigned_to' => (int) $Silian_supportA->id,
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ],
            [
                'id' => 2,
                'user_id' => (int) $Silian_requester->id,
                'subject' => 'Not mine',
                'category' => 'account',
                'status' => 'open',
                'priority' => 'normal',
                'assigned_to' => (int) $Silian_supportB->id,
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ],
            [
                'id' => 3,
                'user_id' => (int) $Silian_requester->id,
                'subject' => 'Unassigned',
                'category' => 'other',
                'status' => 'open',
                'priority' => 'normal',
                'assigned_to' => null,
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ],
        ]);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_errorLog = $this->createMock(ErrorLogService::class);
        $Silian_fileMetadata = $this->createMock(FileMetadataService::class);
        $Silian_automation = $this->createMock(SupportAutomationService::class);
        $Silian_audit->method('log')->willReturn(true);
        $Silian_automation->method('getTagsForTicketIds')->willReturn([]);

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $Silian_errorLog,
            $Silian_fileMetadata,
            null,
            null,
            null,
            $Silian_automation
        );

        $Silian_result = $Silian_service->listSupportTickets(
            ['id' => (int) $Silian_supportA->id, 'role' => 'support', 'is_support' => true],
            ['assigned_to' => 0]
        );

        $this->assertCount(1, $Silian_result['items']);
        $this->assertSame(1, $Silian_result['items'][0]['id']);
    }

    public function testSupportUserCannotViewOtherAssigneeTicketDetail(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportA = User::create([
            'username' => 'support-a',
            'email' => 'support-a@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportB = User::create([
            'username' => 'support-b',
            'email' => 'support-b@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 10,
            'user_id' => (int) $Silian_requester->id,
            'subject' => 'Other assignee ticket',
            'category' => 'website_bug',
            'status' => 'open',
            'priority' => 'normal',
            'assigned_to' => (int) $Silian_supportB->id,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_errorLog = $this->createMock(ErrorLogService::class);
        $Silian_fileMetadata = $this->createMock(FileMetadataService::class);
        $Silian_audit->method('log')->willReturn(true);

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $Silian_errorLog,
            $Silian_fileMetadata
        );

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Ticket not found');

        $Silian_service->getTicketDetailForSupport(['id' => (int) $Silian_supportA->id, 'role' => 'support', 'is_support' => true], 10);
    }

    public function testTransferTargetCanViewPendingTransferTicketDetail(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportA = User::create([
            'username' => 'support-a',
            'email' => 'support-a@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportB = User::create([
            'username' => 'support-b',
            'email' => 'support-b@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 20,
            'user_id' => (int) $Silian_requester->id,
            'subject' => 'Pending transfer ticket',
            'category' => 'website_bug',
            'status' => 'open',
            'priority' => 'normal',
            'assigned_to' => (int) $Silian_supportA->id,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_ticket_transfer_requests')->insert([
            'ticket_id' => 20,
            'requested_by' => (int) $Silian_supportA->id,
            'from_assignee' => (int) $Silian_supportA->id,
            'to_assignee' => (int) $Silian_supportB->id,
            'reason' => 'Need database expertise',
            'status' => SupportTicketService::TRANSFER_STATUS_PENDING,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_errorLog = $this->createMock(ErrorLogService::class);
        $Silian_fileMetadata = $this->createMock(FileMetadataService::class);
        $Silian_audit->method('log')->willReturn(true);

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $Silian_errorLog,
            $Silian_fileMetadata
        );

        $Silian_detail = $Silian_service->getTicketDetailForSupport(
            ['id' => (int) $Silian_supportB->id, 'role' => 'support', 'is_support' => true],
            20
        );

        $this->assertSame(20, $Silian_detail['id']);
        $this->assertCount(1, $Silian_detail['transfer_requests']);
        $this->assertSame((int) $Silian_supportB->id, $Silian_detail['transfer_requests'][0]['to_assignee']);
    }

    public function testTicketDetailIncludesMessageAvatarMetadata(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_avatarId = self::$capsule->table('avatars')->insertGetId([
            'name' => 'Requester Avatar',
            'file_path' => 'avatars/default/requester.png',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'avatar_id' => $Silian_avatarId,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 21,
            'user_id' => (int) $Silian_requester->id,
            'subject' => 'Avatar metadata check',
            'category' => 'account',
            'status' => 'open',
            'priority' => 'normal',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_ticket_messages')->insert([
            'ticket_id' => 21,
            'sender_id' => (int) $Silian_requester->id,
            'sender_role' => 'user',
            'sender_name' => 'requester',
            'body' => 'Need help',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_r2Service = $this->getMockBuilder(CloudflareR2Service::class)
            ->disableOriginalConstructor()
            ->onlyMethods(['getPublicUrl'])
            ->getMock();
        $Silian_r2Service->expects($this->once())
            ->method('getPublicUrl')
            ->with('avatars/default/requester.png')
            ->willReturn('https://cdn.example.com/avatars/default/requester.png');

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            $this->createMock(FileMetadataService::class),
            null,
            null,
            $Silian_r2Service
        );

        $Silian_detail = $Silian_service->getTicketDetailForUser((int) $Silian_requester->id, 21);

        $this->assertSame('avatars/default/requester.png', $Silian_detail['messages'][0]['avatar_path']);
        $this->assertSame('https://cdn.example.com/avatars/default/requester.png', $Silian_detail['messages'][0]['avatar_url']);
    }

    public function testTransferTargetCanListPendingTransferTicketsSeparately(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportA = User::create([
            'username' => 'support-a',
            'email' => 'support-a@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportB = User::create([
            'username' => 'support-b',
            'email' => 'support-b@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            [
                'id' => 30,
                'user_id' => (int) $Silian_requester->id,
                'subject' => 'Pending transfer to me',
                'category' => 'website_bug',
                'status' => 'open',
                'priority' => 'high',
                'assigned_to' => (int) $Silian_supportA->id,
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ],
            [
                'id' => 31,
                'user_id' => (int) $Silian_requester->id,
                'subject' => 'Assigned to me',
                'category' => 'account',
                'status' => 'in_progress',
                'priority' => 'normal',
                'assigned_to' => (int) $Silian_supportB->id,
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ],
        ]);

        self::$capsule->table('support_ticket_transfer_requests')->insert([
            'ticket_id' => 30,
            'requested_by' => (int) $Silian_supportA->id,
            'from_assignee' => (int) $Silian_supportA->id,
            'to_assignee' => (int) $Silian_supportB->id,
            'reason' => 'Need review by support-b',
            'status' => SupportTicketService::TRANSFER_STATUS_PENDING,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_errorLog = $this->createMock(ErrorLogService::class);
        $Silian_fileMetadata = $this->createMock(FileMetadataService::class);
        $Silian_automation = $this->createMock(SupportAutomationService::class);
        $Silian_audit->method('log')->willReturn(true);
        $Silian_automation->method('getTagsForTicketIds')->willReturn([]);

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $Silian_errorLog,
            $Silian_fileMetadata,
            null,
            null,
            null,
            $Silian_automation
        );

        $Silian_result = $Silian_service->listSupportTickets(
            ['id' => (int) $Silian_supportB->id, 'role' => 'support', 'is_support' => true],
            ['pending_transfer_target' => 1]
        );

        $this->assertCount(1, $Silian_result['items']);
        $this->assertSame(30, $Silian_result['items'][0]['id']);
        $this->assertSame('Need review by support-b', $Silian_result['items'][0]['pending_transfer_request']['reason']);
        $this->assertSame((int) $Silian_supportA->id, $Silian_result['items'][0]['pending_transfer_request']['from_assignee']);
    }

    public function testAdminCanListPendingTransferTicketsAddressedToSelf(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportA = User::create([
            'username' => 'support-a',
            'email' => 'support-a@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_admin = User::create([
            'username' => 'admin-user',
            'email' => 'admin@example.com',
            'role' => 'admin',
            'is_admin' => 1,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            [
                'id' => 40,
                'user_id' => (int) $Silian_requester->id,
                'subject' => 'Pending transfer to admin',
                'category' => 'business_issue',
                'status' => 'open',
                'priority' => 'high',
                'assigned_to' => (int) $Silian_supportA->id,
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ],
            [
                'id' => 41,
                'user_id' => (int) $Silian_requester->id,
                'subject' => 'Another queue ticket',
                'category' => 'account',
                'status' => 'open',
                'priority' => 'normal',
                'assigned_to' => null,
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ],
        ]);

        self::$capsule->table('support_ticket_transfer_requests')->insert([
            'ticket_id' => 40,
            'requested_by' => (int) $Silian_supportA->id,
            'from_assignee' => (int) $Silian_supportA->id,
            'to_assignee' => (int) $Silian_admin->id,
            'reason' => 'Admin review needed',
            'status' => SupportTicketService::TRANSFER_STATUS_PENDING,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_errorLog = $this->createMock(ErrorLogService::class);
        $Silian_fileMetadata = $this->createMock(FileMetadataService::class);
        $Silian_automation = $this->createMock(SupportAutomationService::class);
        $Silian_audit->method('log')->willReturn(true);
        $Silian_automation->method('getTagsForTicketIds')->willReturn([]);

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $Silian_errorLog,
            $Silian_fileMetadata,
            null,
            null,
            null,
            $Silian_automation
        );

        $Silian_result = $Silian_service->listSupportTickets(
            ['id' => (int) $Silian_admin->id, 'role' => 'admin', 'is_admin' => true],
            ['pending_transfer_target' => 1]
        );

        $this->assertCount(1, $Silian_result['items']);
        $this->assertSame(40, $Silian_result['items'][0]['id']);
        $this->assertSame('Admin review needed', $Silian_result['items'][0]['pending_transfer_request']['reason']);
        $this->assertSame((int) $Silian_admin->id, $Silian_result['items'][0]['pending_transfer_request']['to_assignee']);
    }

    public function testCreateTransferRequestCreatesPendingEntry(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportA = User::create([
            'username' => 'support-a',
            'email' => 'support-a@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportB = User::create([
            'username' => 'support-b',
            'email' => 'support-b@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 1,
            'user_id' => (int) $Silian_requester->id,
            'subject' => 'Billing mismatch',
            'category' => 'business_issue',
            'status' => 'open',
            'priority' => 'normal',
            'assigned_to' => (int) $Silian_supportA->id,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_errorLog = $this->createMock(ErrorLogService::class);
        $Silian_fileMetadata = $this->createMock(FileMetadataService::class);
        $Silian_audit->method('log')->willReturn(true);

        $Silian_messages = $this->createMock(MessageService::class);
        $Silian_email = $this->createMock(EmailService::class);
        $Silian_messages->expects($this->once())
            ->method('sendSystemMessage')
            ->with((int) $Silian_supportB->id, 'Transfer request for ticket #1', $this->stringContains('A transfer request is waiting for your review.'), 'support_ticket', 'normal', 'support_ticket', 1, false);
        $Silian_email->expects($this->once())
            ->method('sendSupportTicketNotification')
            ->with(
                'support-b@example.com',
                'support-b',
                'Transfer request for ticket #1',
                $this->callback(function (array $Silian_payload): bool {
                    return ($Silian_payload['button_path'] ?? null) === 'support/tickets/1'
                        && ($Silian_payload['message']['label'] ?? null) === 'Transfer reason'
                        && ($Silian_payload['message']['body'] ?? null) === 'Need a different owner'
                        && ($Silian_payload['details'][0]['label'] ?? null) === 'Status';
                }),
                NotificationPreferenceService::CATEGORY_SUPPORT,
                'normal'
            );

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $Silian_errorLog,
            $Silian_fileMetadata,
            $Silian_email,
            $Silian_messages
        );

        $Silian_result = $Silian_service->createTransferRequest(
            ['id' => (int) $Silian_supportA->id, 'role' => 'support', 'is_support' => true, 'username' => 'support-a'],
            1,
            ['to_assignee' => (int) $Silian_supportB->id, 'reason' => 'Need a different owner']
        );

        $this->assertSame('pending', $Silian_result['status']);
        $this->assertSame((int) $Silian_supportB->id, $Silian_result['to_assignee']);
        $this->assertSame(1, self::$capsule->table('support_ticket_transfer_requests')->count());
    }

    public function testCreateTransferRequestRejectsDuplicatePendingRequest(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'notification_email_mask' => 0,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportA = User::create([
            'username' => 'support-a',
            'email' => 'support-a@example.com',
            'role' => 'support',
            'notification_email_mask' => 0,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportB = User::create([
            'username' => 'support-b',
            'email' => 'support-b@example.com',
            'role' => 'support',
            'notification_email_mask' => 0,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 11,
            'user_id' => (int) $Silian_requester->id,
            'subject' => 'Billing mismatch',
            'category' => 'business_issue',
            'status' => 'open',
            'priority' => 'normal',
            'assigned_to' => (int) $Silian_supportA->id,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('support_ticket_transfer_requests')->insert([
            'ticket_id' => 11,
            'requested_by' => (int) $Silian_supportA->id,
            'from_assignee' => (int) $Silian_supportA->id,
            'to_assignee' => (int) $Silian_supportB->id,
            'reason' => 'Existing request',
            'status' => SupportTicketService::TRANSFER_STATUS_PENDING,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            $this->createMock(FileMetadataService::class)
        );

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('A pending transfer request already exists for this ticket');

        $Silian_service->createTransferRequest(
            ['id' => (int) $Silian_supportA->id, 'role' => 'support', 'is_support' => true, 'username' => 'support-a'],
            11,
            ['to_assignee' => (int) $Silian_supportB->id, 'reason' => 'Need a different owner']
        );
    }

    public function testReviewTransferRequestApprovesWhenTargetAcceptsTicket(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportA = User::create([
            'username' => 'support-a',
            'email' => 'support-a@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportB = User::create([
            'username' => 'support-b',
            'email' => 'support-b@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 1,
            'user_id' => (int) $Silian_requester->id,
            'subject' => 'Billing mismatch',
            'category' => 'business_issue',
            'status' => 'open',
            'priority' => 'normal',
            'assigned_to' => (int) $Silian_supportA->id,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_errorLog = $this->createMock(ErrorLogService::class);
        $Silian_fileMetadata = $this->createMock(FileMetadataService::class);
        $Silian_audit->method('log')->willReturn(true);

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $Silian_errorLog,
            $Silian_fileMetadata
        );

        $Silian_request = $Silian_service->createTransferRequest(
            ['id' => (int) $Silian_supportA->id, 'role' => 'support', 'is_support' => true, 'username' => 'support-a'],
            1,
            ['to_assignee' => (int) $Silian_supportB->id, 'reason' => 'Need a different owner']
        );

        $Silian_messages = $this->createMock(MessageService::class);
        $Silian_email = $this->createMock(EmailService::class);
        $Silian_messages->expects($this->once())
            ->method('sendSystemMessage')
            ->with(
                (int) $Silian_requester->id,
                'Support ticket #1 updated',
                $this->stringContains('Assigned handler: support-a -> support-b'),
                'support_ticket',
                'normal',
                'support_ticket',
                1,
                false
            );
        $Silian_email->expects($this->once())
            ->method('sendSupportTicketNotification')
            ->with(
                'requester@example.com',
                'requester',
                'Support ticket #1 updated',
                $this->callback(function (array $Silian_payload): bool {
                    return ($Silian_payload['button_path'] ?? null) === 'tickets/1'
                        && ($Silian_payload['changes'][0]['label'] ?? null) === 'Assigned handler'
                        && ($Silian_payload['changes'][0]['from'] ?? null) === 'support-a'
                        && ($Silian_payload['changes'][0]['to'] ?? null) === 'support-b'
                        && in_array(
                            ['label' => 'Assignee', 'value' => 'support-b'],
                            $Silian_payload['details'] ?? [],
                            true
                        );
                }),
                NotificationPreferenceService::CATEGORY_SUPPORT,
                'normal'
            );

        $Silian_reviewService = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $Silian_errorLog,
            $Silian_fileMetadata,
            $Silian_email,
            $Silian_messages
        );

        $Silian_result = $Silian_reviewService->reviewTransferRequest(
            ['id' => (int) $Silian_supportB->id, 'role' => 'support', 'is_support' => true, 'username' => 'support-b'],
            (int) $Silian_request['id'],
            ['status' => 'approved', 'review_note' => 'I can take this one']
        );

        $Silian_ticketRow = self::$capsule->table('support_tickets')->where('id', 1)->first();

        $this->assertSame('approved', $Silian_result['status']);
        $this->assertSame((int) $Silian_supportB->id, $Silian_ticketRow->assigned_to);
        $this->assertSame('manual', $Silian_ticketRow->assignment_source);
        $this->assertSame(0, (int) $Silian_ticketRow->assignment_locked);
    }

    public function testReviewTransferRequestRejectsApprovalWhenTicketAssignmentChanged(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportA = User::create([
            'username' => 'support-a',
            'email' => 'support-a@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportB = User::create([
            'username' => 'support-b',
            'email' => 'support-b@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_admin = User::create([
            'username' => 'admin-user',
            'email' => 'admin@example.com',
            'role' => 'admin',
            'is_admin' => 1,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 2,
            'user_id' => (int) $Silian_requester->id,
            'subject' => 'Billing mismatch',
            'category' => 'business_issue',
            'status' => 'open',
            'priority' => 'normal',
            'assigned_to' => (int) $Silian_supportA->id,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_errorLog = $this->createMock(ErrorLogService::class);
        $Silian_fileMetadata = $this->createMock(FileMetadataService::class);
        $Silian_audit->method('log')->willReturn(true);

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $Silian_errorLog,
            $Silian_fileMetadata
        );

        $Silian_request = $Silian_service->createTransferRequest(
            ['id' => (int) $Silian_supportA->id, 'role' => 'support', 'is_support' => true, 'username' => 'support-a'],
            2,
            ['to_assignee' => (int) $Silian_supportB->id, 'reason' => 'Need a different owner']
        );

        self::$capsule->table('support_tickets')->where('id', 2)->update([
            'assigned_to' => (int) $Silian_admin->id,
            'assignment_source' => 'manual',
            'updated_at' => $Silian_now,
        ]);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('Transfer request is stale because the ticket assignee has changed');

        $Silian_service->reviewTransferRequest(
            ['id' => (int) $Silian_supportB->id, 'role' => 'support', 'is_support' => true, 'username' => 'support-b'],
            (int) $Silian_request['id'],
            ['status' => 'approved', 'review_note' => 'I can take this one']
        );
    }

    public function testSubmitTicketFeedbackCreatesEntryForHandledSupportAgent(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportUser = User::create([
            'username' => 'support-a',
            'email' => 'support-a@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 1,
            'user_id' => (int) $Silian_requester->id,
            'subject' => 'Resolved issue',
            'category' => 'account',
            'status' => 'resolved',
            'priority' => 'normal',
            'assigned_to' => (int) $Silian_supportUser->id,
            'resolved_at' => $Silian_now,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        self::$capsule->table('support_ticket_messages')->insert([
            'ticket_id' => 1,
            'sender_id' => (int) $Silian_supportUser->id,
            'sender_role' => 'support',
            'sender_name' => 'support-a',
            'body' => 'Issue fixed',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_errorLog = $this->createMock(ErrorLogService::class);
        $Silian_fileMetadata = $this->createMock(FileMetadataService::class);
        $Silian_audit->method('log')->willReturn(true);

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $Silian_errorLog,
            $Silian_fileMetadata
        );

        $Silian_result = $Silian_service->submitTicketFeedback(
            ['id' => (int) $Silian_requester->id, 'role' => 'user', 'username' => 'requester'],
            1,
            [
                'rated_user_id' => (int) $Silian_supportUser->id,
                'rating' => 5,
                'comment' => '处理很快',
            ]
        );

        $Silian_feedbackRow = self::$capsule->table('support_ticket_feedback')->where('ticket_id', 1)->first();

        $this->assertNotNull($Silian_feedbackRow);
        $this->assertSame(5, $Silian_feedbackRow->rating);
        $this->assertSame('处理很快', $Silian_feedbackRow->comment);
        $this->assertCount(1, $Silian_result['feedback']);
        $this->assertSame((int) $Silian_supportUser->id, $Silian_result['feedback'][0]['rated_user_id']);
        $this->assertSame((int) $Silian_supportUser->id, $Silian_result['feedback_candidates'][0]['id']);
    }

    public function testAddUserMessageClearsResolvedMarkersWhenReopeningTicket(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 60,
            'user_id' => (int) $Silian_requester->id,
            'subject' => 'Need more help',
            'category' => 'account',
            'status' => 'resolved',
            'priority' => 'normal',
            'sla_status' => 'resolved',
            'resolved_at' => $Silian_now,
            'closed_at' => $Silian_now,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            $this->createMock(FileMetadataService::class)
        );

        $Silian_result = $Silian_service->addUserMessage(
            ['id' => (int) $Silian_requester->id, 'role' => 'user', 'username' => 'requester'],
            60,
            ['content' => 'Issue is back again']
        );

        $Silian_ticketRow = self::$capsule->table('support_tickets')->where('id', 60)->first();

        $this->assertSame('open', $Silian_result['status']);
        $this->assertSame('open', $Silian_ticketRow->status);
        $this->assertSame('pending', $Silian_ticketRow->sla_status);
        $this->assertNull($Silian_ticketRow->resolved_at);
        $this->assertNull($Silian_ticketRow->closed_at);
    }

    public function testSubmitTicketFeedbackRequiresResolvedOrClosedTicket(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportUser = User::create([
            'username' => 'support-a',
            'email' => 'support-a@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 2,
            'user_id' => (int) $Silian_requester->id,
            'subject' => 'Still open',
            'category' => 'website_bug',
            'status' => 'open',
            'priority' => 'normal',
            'assigned_to' => (int) $Silian_supportUser->id,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_errorLog = $this->createMock(ErrorLogService::class);
        $Silian_fileMetadata = $this->createMock(FileMetadataService::class);
        $Silian_audit->method('log')->willReturn(true);

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $Silian_errorLog,
            $Silian_fileMetadata
        );

        $this->expectException(\RuntimeException::class);
        $this->expectExceptionMessage('Feedback is only available after the ticket is resolved or closed');

        $Silian_service->submitTicketFeedback(
            ['id' => (int) $Silian_requester->id, 'role' => 'user', 'username' => 'requester'],
            2,
            [
                'rated_user_id' => (int) $Silian_supportUser->id,
                'rating' => 4,
            ]
        );
    }

    public function testAdminAssignmentLocksTicketAndNotifiesTarget(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'notification_email_mask' => 0,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_assignee = User::create([
            'username' => 'support-b',
            'email' => 'support-b@example.com',
            'role' => 'support',
            'notification_email_mask' => 0,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 3,
            'user_id' => (int) $Silian_requester->id,
            'subject' => 'Escalation needed',
            'category' => 'business_issue',
            'status' => 'open',
            'priority' => 'high',
            'assigned_to' => null,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_errorLog = $this->createMock(ErrorLogService::class);
        $Silian_fileMetadata = $this->createMock(FileMetadataService::class);
        $Silian_messages = $this->createMock(MessageService::class);
        $Silian_email = $this->createMock(EmailService::class);
        $Silian_audit->method('log')->willReturn(true);
        $Silian_messages->expects($this->exactly(2))
            ->method('sendSystemMessage')
            ->withConsecutive(
                [
                    (int) $Silian_requester->id,
                    'Support ticket #3 updated',
                    $this->stringContains('Assigned handler'),
                    'support_ticket',
                    'normal',
                    'support_ticket',
                    3,
                    false,
                ],
                [
                    (int) $Silian_assignee->id,
                    'Ticket #3 assigned to you',
                    $this->stringContains('An administrator assigned ticket #3 to you.'),
                    'support_ticket',
                    'normal',
                    'support_ticket',
                    3,
                    false,
                ]
            );
        $Silian_email->expects($this->exactly(2))
            ->method('sendSupportTicketNotification')
            ->withConsecutive(
                [
                    'requester@example.com',
                    'requester',
                    'Support ticket #3 updated',
                    $this->callback(function (array $Silian_payload): bool {
                        return ($Silian_payload['button_path'] ?? null) === 'tickets/3'
                            && ($Silian_payload['changes'][0]['label'] ?? null) === 'Assigned handler'
                            && ($Silian_payload['changes'][0]['to'] ?? null) === 'support-b';
                    }),
                    NotificationPreferenceService::CATEGORY_SUPPORT,
                    'normal',
                ],
                [
                    'support-b@example.com',
                    'support-b',
                    'Ticket #3 assigned to you',
                    $this->callback(function (array $Silian_payload): bool {
                        return ($Silian_payload['button_path'] ?? null) === 'support/tickets/3'
                            && ($Silian_payload['message']['label'] ?? null) === 'Assignment note'
                            && str_contains((string) ($Silian_payload['message']['body'] ?? ''), 'assigned ticket #3 to you')
                            && in_array(
                                ['label' => 'Requester', 'value' => 'requester <requester@example.com>'],
                                $Silian_payload['details'] ?? [],
                                true
                            );
                    }),
                    NotificationPreferenceService::CATEGORY_SUPPORT,
                    'normal',
                ]
            );

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $Silian_errorLog,
            $Silian_fileMetadata,
            $Silian_email,
            $Silian_messages
        );

        $Silian_service->updateTicketFromSupport(
            ['id' => 99, 'role' => 'admin', 'is_admin' => true, 'username' => 'admin-user'],
            3,
            ['assigned_to' => (int) $Silian_assignee->id]
        );

        $Silian_ticketRow = self::$capsule->table('support_tickets')->where('id', 3)->first();
        $this->assertSame((int) $Silian_assignee->id, $Silian_ticketRow->assigned_to);
        $this->assertSame('manual', $Silian_ticketRow->assignment_source);
        $this->assertSame(1, (int) $Silian_ticketRow->assignment_locked);
    }

    public function testAdminAssignmentEmailUsesUpdatedTicketState(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'notification_email_mask' => 0,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_currentAssignee = User::create([
            'username' => 'support-a',
            'email' => 'support-a@example.com',
            'role' => 'support',
            'notification_email_mask' => 0,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_nextAssignee = User::create([
            'username' => 'support-b',
            'email' => 'support-b@example.com',
            'role' => 'support',
            'notification_email_mask' => 0,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 31,
            'user_id' => (int) $Silian_requester->id,
            'subject' => 'Assignment metadata refresh',
            'category' => 'account',
            'status' => 'open',
            'priority' => 'normal',
            'assigned_to' => (int) $Silian_currentAssignee->id,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_errorLog = $this->createMock(ErrorLogService::class);
        $Silian_fileMetadata = $this->createMock(FileMetadataService::class);
        $Silian_messages = $this->createMock(MessageService::class);
        $Silian_email = $this->createMock(EmailService::class);
        $Silian_audit->method('log')->willReturn(true);
        $Silian_messages->expects($this->exactly(2))
            ->method('sendSystemMessage');
        $Silian_email->expects($this->exactly(2))
            ->method('sendSupportTicketNotification')
            ->withConsecutive(
                [
                    'requester@example.com',
                    'requester',
                    'Support ticket #31 updated',
                    $this->anything(),
                    NotificationPreferenceService::CATEGORY_SUPPORT,
                    'normal',
                ],
                [
                    'support-b@example.com',
                    'support-b',
                    'Ticket #31 assigned to you',
                    $this->callback(function (array $Silian_payload): bool {
                        return ($Silian_payload['button_path'] ?? null) === 'support/tickets/31'
                            && in_array(['label' => 'Status', 'value' => 'In progress'], $Silian_payload['details'] ?? [], true)
                            && in_array(['label' => 'Priority', 'value' => 'Urgent'], $Silian_payload['details'] ?? [], true)
                            && in_array(['label' => 'Assignee', 'value' => 'support-b'], $Silian_payload['details'] ?? [], true)
                            && !in_array(['label' => 'Assignee', 'value' => 'support-a'], $Silian_payload['details'] ?? [], true);
                    }),
                    NotificationPreferenceService::CATEGORY_SUPPORT,
                    'normal',
                ],
            );

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $Silian_logger,
            $Silian_audit,
            $Silian_errorLog,
            $Silian_fileMetadata,
            $Silian_email,
            $Silian_messages
        );

        $Silian_service->updateTicketFromSupport(
            ['id' => 99, 'role' => 'admin', 'is_admin' => true, 'username' => 'admin-user'],
            31,
            [
                'assigned_to' => (int) $Silian_nextAssignee->id,
                'status' => 'in_progress',
                'priority' => 'urgent',
            ]
        );
    }

    public function testUpdateTicketFromSupportClearsResolvedMarkersWhenReopened(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_requester = User::create([
            'username' => 'requester',
            'email' => 'requester@example.com',
            'role' => 'user',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
        $Silian_supportUser = User::create([
            'username' => 'support-a',
            'email' => 'support-a@example.com',
            'role' => 'support',
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        self::$capsule->table('support_tickets')->insert([
            'id' => 70,
            'user_id' => (int) $Silian_requester->id,
            'subject' => 'Reopened by support',
            'category' => 'account',
            'status' => 'resolved',
            'priority' => 'normal',
            'assigned_to' => (int) $Silian_supportUser->id,
            'sla_status' => 'resolved',
            'resolved_at' => $Silian_now,
            'closed_at' => $Silian_now,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $this->createMock(AuditLogService::class),
            $this->createMock(ErrorLogService::class),
            $this->createMock(FileMetadataService::class)
        );

        $Silian_result = $Silian_service->updateTicketFromSupport(
            ['id' => (int) $Silian_supportUser->id, 'role' => 'support', 'is_support' => true, 'username' => 'support-a'],
            70,
            ['status' => 'in_progress']
        );

        $Silian_ticketRow = self::$capsule->table('support_tickets')->where('id', 70)->first();

        $this->assertSame('in_progress', $Silian_result['status']);
        $this->assertSame('in_progress', $Silian_ticketRow->status);
        $this->assertSame('pending', $Silian_ticketRow->sla_status);
        $this->assertNull($Silian_ticketRow->resolved_at);
        $this->assertNull($Silian_ticketRow->closed_at);
    }

    public function testNotifyAssigneeMarksAuditAsFailedWhenAllChannelsFail(): void
    {
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
        $Silian_emailService->method('sendSupportTicketNotification')->willThrowException(new \RuntimeException('email failed'));
        $Silian_emailService->method('sendMessageNotification')->willThrowException(new \RuntimeException('email failed'));

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $Silian_audit,
            $this->createMock(ErrorLogService::class),
            $this->createMock(FileMetadataService::class),
            $Silian_emailService,
            $Silian_messageService
        );

        $Silian_method = new \ReflectionMethod($Silian_service, 'notifyAssignee');
        $Silian_method->setAccessible(true);
        $Silian_method->invoke(
            $Silian_service,
            ['id' => 99, 'username' => 'supporter', 'email' => 'support@example.com'],
            'Subject',
            'Body',
            123,
            'support_ticket_manual_assignment_notified'
        );

        $Silian_finalNotificationLog = null;
        foreach ($Silian_loggedPayloads as $Silian_payload) {
            if (($Silian_payload['action'] ?? null) === 'support_ticket_manual_assignment_notified') {
                $Silian_finalNotificationLog = $Silian_payload;
                break;
            }
        }

        $this->assertNotNull($Silian_finalNotificationLog);
        $this->assertSame('failed', $Silian_finalNotificationLog['status'] ?? null);
        $this->assertFalse($Silian_finalNotificationLog['data']['message_sent'] ?? true);
        $this->assertFalse($Silian_finalNotificationLog['data']['email_sent'] ?? true);
    }

    public function testNotifyAssigneeAuditTracksSkippedEmailAsNotSent(): void
    {
        $Silian_loggedPayloads = [];
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('log')
            ->willReturnCallback(static function (array $Silian_payload) use (&$Silian_loggedPayloads): bool {
                $Silian_loggedPayloads[] = $Silian_payload;
                return true;
            });

        $Silian_messageService = $this->createMock(MessageService::class);
        $Silian_messageService->expects($this->once())
            ->method('sendSystemMessage');

        $Silian_emailService = $this->createMock(EmailService::class);
        $Silian_emailService->expects($this->once())
            ->method('sendSupportTicketNotification')
            ->willReturn(false);

        $Silian_service = new SupportTicketService(
            self::$capsule->getConnection()->getPdo(),
            $this->createMock(LoggerInterface::class),
            $Silian_audit,
            $this->createMock(ErrorLogService::class),
            $this->createMock(FileMetadataService::class),
            $Silian_emailService,
            $Silian_messageService
        );

        $Silian_method = new \ReflectionMethod($Silian_service, 'notifyAssignee');
        $Silian_method->setAccessible(true);
        $Silian_method->invoke(
            $Silian_service,
            ['id' => 98, 'username' => 'supporter', 'email' => 'support@example.com'],
            'Subject',
            'Body',
            456,
            'support_ticket_manual_assignment_notified',
            ['button_path' => 'support/tickets/456']
        );

        $this->assertCount(1, $Silian_loggedPayloads);
        $this->assertSame('partial', $Silian_loggedPayloads[0]['status'] ?? null);
        $this->assertTrue($Silian_loggedPayloads[0]['data']['message_sent'] ?? false);
        $this->assertFalse($Silian_loggedPayloads[0]['data']['email_sent'] ?? true);
    }

}
