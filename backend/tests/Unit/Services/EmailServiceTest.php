<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\EmailService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\NotificationPreferenceService;
use Monolog\Handler\TestHandler;
use Monolog\Logger;
use PHPUnit\Framework\TestCase;

class EmailServiceTest extends TestCase
{
    public function testClassExists(): void
    {
        $this->assertTrue(class_exists(EmailService::class));
    }

    public function testSendEmailWithoutMailerSimulatesDelivery(): void
    {
        $Silian_config = [
            'debug' => false,
            'host' => 'smtp.example.com',
            'username' => 'user',
            'password' => 'pass',
            'port' => 465,
            'from_email' => 'noreply@example.com',
            'from_name' => 'No Reply',
            'templates_path' => __DIR__ . '/',
            'force_simulation' => true,
        ];

        $Silian_handler = new TestHandler();
        $Silian_logger = new Logger('email-service-test');
        $Silian_logger->pushHandler($Silian_handler);

        $Silian_service = new EmailService($Silian_config, $Silian_logger, null);

        $Silian_result = $Silian_service->sendEmail('to@example.com', 'To', 'Subj', '<b>body</b>', 'body');

        $this->assertTrue($Silian_result);
        $this->assertTrue(
            $Silian_handler->hasInfoThatContains('Simulated email send'),
            'Expected simulated email log when EmailService runs in simulation mode.'
        );

        $Silian_simulationRecords = array_values(array_filter(
            $Silian_handler->getRecords(),
            static fn(array $Silian_record): bool => $Silian_record['message'] === 'Simulated email send'
        ));
        $this->assertNotEmpty($Silian_simulationRecords, 'Expected simulation log record to be captured.');
        $Silian_record = $Silian_simulationRecords[0];
        $this->assertSame('force_simulation', $Silian_record['context']['reason'] ?? null);
    }

    public function testSendMessageNotificationRespectsPreferences(): void
    {
        $Silian_config = [
            'debug' => false,
            'host' => 'smtp.example.com',
            'username' => 'user',
            'password' => 'pass',
            'port' => 465,
            'from_email' => 'noreply@example.com',
            'from_name' => 'No Reply',
            'templates_path' => __DIR__ . '/',
            'force_simulation' => true,
            'app_name' => 'CarbonTrack QA',
            'frontend_url' => 'https://app.example.com',
        ];

        $Silian_handlerAllow = new TestHandler();
        $Silian_loggerAllow = new Logger('email-service-allow');
        $Silian_loggerAllow->pushHandler($Silian_handlerAllow);

        $Silian_preferenceAllow = new class(true, $Silian_loggerAllow) extends NotificationPreferenceService {
            private bool $result;

            public function __construct(bool $Silian_result, Logger $Silian_logger)
            {
                parent::__construct($Silian_logger);
                $this->result = $Silian_result;
            }

            public function shouldSendEmailByEmail(string $Silian_email, string $Silian_category): bool
            {
                return $this->result;
            }
        };

        $Silian_serviceAllow = new EmailService($Silian_config, $Silian_loggerAllow, $Silian_preferenceAllow);
        $this->assertTrue($Silian_serviceAllow->sendMessageNotification(
            'to@example.com',
            'User',
            'A subject',
            "Line one\n\nLine two",
            'system',
            'high'
        ));
        $this->assertTrue(
            $Silian_handlerAllow->hasInfoThatContains('Simulated email send'),
            'Expected simulated send when preferences allow email delivery.'
        );

        $Silian_handlerBlock = new TestHandler();
        $Silian_loggerBlock = new Logger('email-service-block');
        $Silian_loggerBlock->pushHandler($Silian_handlerBlock);

        $Silian_preferenceBlock = new class(false, $Silian_loggerBlock) extends NotificationPreferenceService {
            private bool $result;

            public function __construct(bool $Silian_result, Logger $Silian_logger)
            {
                parent::__construct($Silian_logger);
                $this->result = $Silian_result;
            }

            public function shouldSendEmailByEmail(string $Silian_email, string $Silian_category): bool
            {
                return $this->result;
            }
        };

        $Silian_serviceBlock = new EmailService($Silian_config, $Silian_loggerBlock, $Silian_preferenceBlock);
        $this->assertFalse($Silian_serviceBlock->sendMessageNotification(
            'to@example.com',
            'User',
            'Blocked subject',
            'Any content',
            'system',
            'normal'
        ));
        $this->assertFalse(
            $Silian_handlerBlock->hasInfoThatContains('Simulated email send'),
            'Expected no send when preferences block email delivery.'
        );
    }

    public function testSendSupportTicketNotificationRendersStructuredHtml(): void
    {
        $Silian_config = [
            'debug' => false,
            'host' => 'smtp.example.com',
            'username' => 'user',
            'password' => 'pass',
            'port' => 465,
            'from_email' => 'noreply@example.com',
            'from_name' => 'No Reply',
            'force_simulation' => true,
            'app_name' => 'CarbonTrack QA',
            'support_email' => 'help@example.com',
            'frontend_url' => 'https://app.example.com',
        ];

        $Silian_logger = new Logger('email-service-support-ticket');
        $Silian_logger->pushHandler(new TestHandler());
        $Silian_service = new class($Silian_config, $Silian_logger, null) extends EmailService {
            public ?array $capturedEmail = null;

            public function sendEmail(string $Silian_toEmail, string $Silian_toName, string $Silian_subject, string $Silian_bodyHtml, string $Silian_bodyText = ''): bool
            {
                $this->capturedEmail = [
                    'to' => $Silian_toEmail,
                    'name' => $Silian_toName,
                    'subject' => $Silian_subject,
                    'bodyHtml' => $Silian_bodyHtml,
                    'bodyText' => $Silian_bodyText,
                ];

                return true;
            }
        };

        $Silian_result = $Silian_service->sendSupportTicketNotification(
            'owner@example.com',
            'Owner',
            'Support ticket #42 updated',
            [
                'eyebrow' => 'Workflow update',
                'intro' => 'We updated the workflow details for your support ticket.',
                'summary' => 'Review the latest status below so you know what changed on our side.',
                'ticket' => [
                    'id' => 42,
                    'subject' => 'Billing mismatch on April export',
                ],
                'details' => [
                    ['label' => 'Status', 'value' => 'In progress'],
                    ['label' => 'Priority', 'value' => 'High'],
                ],
                'changes' => [
                    ['label' => 'Status', 'from' => 'Open', 'to' => 'In progress'],
                    ['label' => 'Priority', 'from' => 'Normal', 'to' => 'High'],
                ],
                'message' => [
                    'label' => 'Latest update',
                    'body' => "We reproduced the export issue.\nA fix is being prepared.",
                ],
                'button_label' => 'Review ticket',
                'button_path' => 'tickets/42',
                'closing' => 'Open CarbonTrack to review the full thread.',
            ],
            NotificationPreferenceService::CATEGORY_SUPPORT,
            'high'
        );

        $this->assertTrue($Silian_result);
        $this->assertNotNull($Silian_service->capturedEmail);
        $this->assertStringContainsString('Billing mismatch on April export', $Silian_service->capturedEmail['bodyHtml']);
        $this->assertStringContainsString('What changed', $Silian_service->capturedEmail['bodyHtml']);
        $this->assertStringContainsString('Latest update', $Silian_service->capturedEmail['bodyHtml']);
        $this->assertStringContainsString('/tickets/42', $Silian_service->capturedEmail['bodyHtml']);
        $this->assertStringContainsString('Status:', $Silian_service->capturedEmail['bodyText']);
        $this->assertStringContainsString('In progress', $Silian_service->capturedEmail['bodyText']);
        $this->assertStringContainsString('Review ticket:', $Silian_service->capturedEmail['bodyText']);
        $this->assertStringContainsString('/tickets/42', $Silian_service->capturedEmail['bodyText']);
    }

    public function testSendMessageNotificationToManyUsesBroadcastAndPreferences(): void
    {
        $Silian_config = [
            'debug' => false,
            'host' => 'smtp.example.com',
            'username' => 'user',
            'password' => 'pass',
            'port' => 465,
            'from_email' => 'noreply@example.com',
            'from_name' => 'No Reply',
            'force_simulation' => true,
            'app_name' => 'CarbonTrack QA',
            'frontend_url' => 'https://app.example.com',
        ];

        $Silian_handler = new TestHandler();
        $Silian_logger = new Logger('email-service-bulk');
        $Silian_logger->pushHandler($Silian_handler);

        $Silian_preference = new class(['admin1@example.com'], $Silian_logger) extends NotificationPreferenceService {
            private array $allowed;

            public function __construct(array $Silian_allowed, Logger $Silian_logger)
            {
                parent::__construct($Silian_logger);
                $this->allowed = array_map('strtolower', $Silian_allowed);
            }

            public function shouldSendEmailByEmail(string $Silian_email, string $Silian_category): bool
            {
                return in_array(strtolower($Silian_email), $this->allowed, true);
            }
        };

        $Silian_service = new EmailService($Silian_config, $Silian_logger, $Silian_preference);

        $Silian_result = $Silian_service->sendMessageNotificationToMany(
            [
                ['email' => 'admin1@example.com', 'name' => 'Admin A'],
                ['email' => 'blocked@example.com', 'name' => 'Admin B'],
            ],
            'Pending review alert',
            "Line 1\n\nLine 2",
            'system',
            'high'
        );

        $this->assertTrue($Silian_result, 'Expected broadcast send when at least one recipient allows email.');
        $Silian_records = array_values(array_filter(
            $Silian_handler->getRecords(),
            static fn(array $Silian_record): bool => $Silian_record['message'] === 'Simulated broadcast email send'
        ));
        $this->assertNotEmpty($Silian_records, 'Simulated broadcast log expected.');
        $Silian_context = $Silian_records[0]['context'] ?? [];
        $this->assertSame(1, $Silian_context['recipient_count'] ?? null, 'Only allowed recipients should be counted.');
        $this->assertSame('system', $Silian_context['category'] ?? null);
    }

    public function testSendMessageNotificationToManySkipsWhenNoEligibleRecipients(): void
    {
        $Silian_config = [
            'debug' => false,
            'host' => 'smtp.example.com',
            'username' => 'user',
            'password' => 'pass',
            'port' => 465,
            'from_email' => 'noreply@example.com',
            'from_name' => 'No Reply',
            'force_simulation' => true,
            'frontend_url' => 'https://app.example.com',
        ];

        $Silian_handler = new TestHandler();
        $Silian_logger = new Logger('email-service-bulk-skip');
        $Silian_logger->pushHandler($Silian_handler);

        $Silian_preference = new class($Silian_logger) extends NotificationPreferenceService {
            public function __construct(Logger $Silian_logger)
            {
                parent::__construct($Silian_logger);
            }

            public function shouldSendEmailByEmail(string $Silian_email, string $Silian_category): bool
            {
                return false;
            }
        };

        $Silian_service = new EmailService($Silian_config, $Silian_logger, $Silian_preference);

        $Silian_result = $Silian_service->sendMessageNotificationToMany(
            [
                ['email' => 'blocked@example.com', 'name' => 'Admin'],
            ],
            'Ignored',
            'Body',
            'system',
            'normal'
        );

        $this->assertFalse($Silian_result, 'Expected failure when no recipients are eligible.');
        $this->assertSame(
            'No deliverable email recipients provided',
            $Silian_service->getLastError()
        );
        $this->assertFalse(
            $Silian_handler->hasInfoThatContains('Simulated broadcast email send'),
            'No broadcast send should occur when every recipient is filtered out.'
        );
    }

    public function testSendAnnouncementBroadcastRespectsTemplatesAndPreferences(): void
    {
        $Silian_config = [
            'debug' => false,
            'host' => 'smtp.example.com',
            'username' => 'user',
            'password' => 'pass',
            'port' => 465,
            'from_email' => 'noreply@example.com',
            'from_name' => 'CarbonTrack',
            'force_simulation' => true,
            'frontend_url' => 'https://app.example.com',
        ];

        $Silian_handler = new TestHandler();
        $Silian_logger = new Logger('email-service-announcement');
        $Silian_logger->pushHandler($Silian_handler);

        $Silian_preference = new class($Silian_logger) extends NotificationPreferenceService {
            public function __construct(Logger $Silian_logger)
            {
                parent::__construct($Silian_logger);
            }

            public function shouldSendEmailByEmail(string $Silian_email, string $Silian_category): bool
            {
                return strtolower($Silian_email) === 'allowed@example.com';
            }
        };

        $Silian_service = new EmailService($Silian_config, $Silian_logger, $Silian_preference);

        $Silian_result = $Silian_service->sendAnnouncementBroadcast(
            [
                ['email' => 'allowed@example.com', 'name' => 'Allowed User'],
                ['email' => 'blocked@example.com', 'name' => 'Blocked User'],
            ],
            'Planned maintenance',
            "Systems will undergo maintenance tonight.\nPlease review the announcement in the app.",
            'high'
        );

        $this->assertTrue($Silian_result, 'Expected queued send when at least one recipient allows announcement emails.');
        $Silian_records = array_values(array_filter(
            $Silian_handler->getRecords(),
            static fn(array $Silian_record): bool => $Silian_record['message'] === 'Simulated broadcast email send'
        ));
        $this->assertNotEmpty($Silian_records, 'Expected simulation log for announcement broadcast.');
        $Silian_context = $Silian_records[0]['context'] ?? [];
        $this->assertSame(1, $Silian_context['recipient_count'] ?? null, 'Only allowed recipients should be included.');
        $this->assertSame(
            NotificationPreferenceService::CATEGORY_ANNOUNCEMENT,
            $Silian_context['category'] ?? null,
            'Announcement emails should be tagged with the announcement category.'
        );
    }

    public function testSendAnnouncementBroadcastDoesNotExposeInternalMetadataInVisibleCopy(): void
    {
        $Silian_config = [
            'debug' => false,
            'host' => 'smtp.example.com',
            'username' => 'user',
            'password' => 'pass',
            'port' => 465,
            'from_email' => 'noreply@example.com',
            'from_name' => 'CarbonTrack',
            'force_simulation' => true,
            'frontend_url' => 'https://app.example.com',
        ];

        $Silian_handler = new TestHandler();
        $Silian_logger = new Logger('email-service-announcement-visible-copy');
        $Silian_logger->pushHandler($Silian_handler);

        $Silian_service = new class($Silian_config, $Silian_logger, null) extends EmailService {
            public ?array $capturedBroadcast = null;

            public function sendBroadcastEmail(array $Silian_recipients, string $Silian_subject, string $Silian_bodyHtml, string $Silian_bodyText = '', ?string $Silian_category = null): bool
            {
                $this->capturedBroadcast = [
                    'recipients' => $Silian_recipients,
                    'subject' => $Silian_subject,
                    'bodyHtml' => $Silian_bodyHtml,
                    'bodyText' => $Silian_bodyText,
                    'category' => $Silian_category,
                ];

                return true;
            }
        };

        $Silian_result = $Silian_service->sendAnnouncementBroadcast(
            [['email' => 'allowed@example.com', 'name' => 'Allowed User']],
            'Planned maintenance',
            '<p>Systems will undergo maintenance tonight.</p>',
            'high',
            'html',
            'announcement_html_v1',
            1,
            'admin_broadcast'
        );

        $this->assertTrue($Silian_result);
        $this->assertNotNull($Silian_service->capturedBroadcast);
        $this->assertStringContainsString('has published a new announcement', $Silian_service->capturedBroadcast['bodyHtml']);
        $this->assertStringNotContainsString('admin_broadcast', $Silian_service->capturedBroadcast['bodyHtml']);
        $this->assertStringNotContainsString('render v1', $Silian_service->capturedBroadcast['bodyHtml']);
        $this->assertStringNotContainsString('admin_broadcast', $Silian_service->capturedBroadcast['bodyText']);
        $this->assertStringNotContainsString('render v1', $Silian_service->capturedBroadcast['bodyText']);
    }

    public function testTemplateWrappersReturnSuccess(): void
    {
        $Silian_dir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ct_email_tpl_' . uniqid();
        mkdir($Silian_dir);
        $Silian_make = function (string $Silian_name, string $Silian_contentHtml) use ($Silian_dir): void {
            file_put_contents($Silian_dir . DIRECTORY_SEPARATOR . $Silian_name . '.html', $Silian_contentHtml);
        };
        file_put_contents(
            $Silian_dir . DIRECTORY_SEPARATOR . 'layout.html',
            '<html><head><title>{{email_title}}</title></head><body><h1>{{email_title}}</h1>{{content}}{{buttons}}<footer>{{app_name}}</footer></body></html>'
        );
        $Silian_make('verification_code', 'Code: {{code}}');
        $Silian_make('password_reset', 'Link: {{link}}');
        $Silian_make('activity_approved', 'Activity: {{activity_name}} {{points_earned}}');
        $Silian_make('activity_rejected', 'Activity: {{activity_name}} {{reason}}');
        $Silian_make('exchange_confirmation', 'Product: {{product_name}} x{{quantity}} = {{total_points}}');
        $Silian_make('exchange_status_update', 'Product: {{product_name}} {{status}} {{admin_notes}}');

        $Silian_config = [
            'debug' => false,
            'host' => 'smtp.example.com',
            'username' => 'user',
            'password' => 'pass',
            'port' => 465,
            'from_email' => 'noreply@example.com',
            'from_name' => 'No Reply',
            'templates_path' => $Silian_dir . DIRECTORY_SEPARATOR,
            'subjects' => [
                'verification_code' => 'VC',
                'password_reset' => 'PR',
                'activity_approved' => 'AA',
                'activity_rejected' => 'AR',
                'exchange_confirmation' => 'EC',
                'exchange_status_update' => 'ESU',
            ],
            'force_simulation' => true,
            'app_name' => 'CarbonTrack QA',
            'support_email' => 'help@example.com',
            'frontend_url' => 'https://app.example.com',
            'reset_link_base' => 'https://app.example.com',
        ];

        $Silian_handler = new TestHandler();
        $Silian_logger = new Logger('email-service-test');
        $Silian_logger->pushHandler($Silian_handler);

        $Silian_svc = new EmailService($Silian_config, $Silian_logger, null);

        $this->assertTrue($Silian_svc->sendVerificationCode('to@example.com', 'User', '123456'));
        $this->assertTrue($Silian_svc->sendPasswordResetLink('to@example.com', 'User', 'https://reset'));
        $this->assertTrue($Silian_svc->sendActivityApprovedNotification('to@example.com', 'User', 'Act', 10));
        $this->assertTrue($Silian_svc->sendActivityRejectedNotification('to@example.com', 'User', 'Act', 'Bad'));
        $this->assertTrue($Silian_svc->sendExchangeConfirmation('to@example.com', 'User', 'Prod', 2, 100));
        $this->assertTrue($Silian_svc->sendExchangeStatusUpdate('to@example.com', 'User', 'Prod', 'shipped', 'soon'));

        $this->assertTrue($Silian_handler->hasInfoThatContains('Simulated email send'), 'Expected info logs for simulated email sends.');

        foreach (array_filter(
            $Silian_handler->getRecords(),
            static fn(array $Silian_record): bool => $Silian_record['message'] === 'Simulated email send'
        ) as $Silian_record) {
            $this->assertSame('force_simulation', $Silian_record['context']['reason'] ?? null);
        }

        $this->assertNull($Silian_svc->getLastError(), 'Expected EmailService not to record any error during helper sends.');

        foreach (glob($Silian_dir . DIRECTORY_SEPARATOR . '*') as $Silian_f) {
            @unlink($Silian_f);
        }
        @rmdir($Silian_dir);
    }

    public function testSendEmailSimulationWritesAuditLog(): void
    {
        $Silian_config = [
            'debug' => false,
            'host' => 'smtp.example.com',
            'username' => 'user',
            'password' => 'pass',
            'port' => 465,
            'from_email' => 'noreply@example.com',
            'from_name' => 'No Reply',
            'force_simulation' => true,
        ];

        $Silian_logger = new Logger('email-service-audit');
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('log')
            ->with($this->callback(function (array $Silian_payload): bool {
                return ($Silian_payload['action'] ?? null) === 'email_simulated'
                    && ($Silian_payload['operation_category'] ?? null) === 'notification'
                    && ($Silian_payload['data']['to'] ?? null) === 'audit@example.com';
            }))
            ->willReturn(true);

        $Silian_service = new EmailService($Silian_config, $Silian_logger, null, $Silian_audit, null);

        $this->assertTrue($Silian_service->sendEmail('audit@example.com', 'Audit', 'Audit Subject', '<p>Body</p>', 'Body'));
    }

    public function testPreferenceLookupFailureWritesAuditAndErrorLog(): void
    {
        $Silian_config = [
            'debug' => false,
            'host' => 'smtp.example.com',
            'username' => 'user',
            'password' => 'pass',
            'port' => 465,
            'from_email' => 'noreply@example.com',
            'from_name' => 'No Reply',
            'force_simulation' => true,
            'app_name' => 'CarbonTrack QA',
            'frontend_url' => 'https://app.example.com',
        ];

        $Silian_logger = new Logger('email-service-pref-failure');
        $Silian_preference = new class($Silian_logger) extends NotificationPreferenceService {
            public function __construct(Logger $Silian_logger)
            {
                parent::__construct($Silian_logger);
            }

            public function shouldSendEmailByEmail(string $Silian_email, string $Silian_category): bool
            {
                throw new \RuntimeException('preference lookup failed');
            }
        };

        $Silian_actions = [];
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->exactly(2))
            ->method('log')
            ->willReturnCallback(function (array $Silian_payload) use (&$Silian_actions): bool {
                $Silian_actions[] = $Silian_payload['action'] ?? null;
                return true;
            });

        $Silian_error = $this->createMock(ErrorLogService::class);
        $Silian_error->expects($this->once())
            ->method('logException')
            ->with(
                $this->isInstanceOf(\Throwable::class),
                $this->anything(),
                $this->arrayHasKey('context_message')
            )
            ->willReturn(1);

        $Silian_service = new EmailService($Silian_config, $Silian_logger, $Silian_preference, $Silian_audit, $Silian_error);

        $this->assertTrue($Silian_service->sendMessageNotification(
            'fallback@example.com',
            'Fallback',
            'Subject',
            'Body',
            'system'
        ));

        $this->assertContains('email_preference_lookup_failed', $Silian_actions);
        $this->assertContains('email_simulated', $Silian_actions);
    }
}
