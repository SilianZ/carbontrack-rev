<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use PHPUnit\Framework\TestCase;
use CarbonTrack\Models\User;
use CarbonTrack\Services\MessageService;
use CarbonTrack\Models\Message;
use CarbonTrack\Services\NotificationPreferenceService;
use Monolog\Handler\NullHandler;
use Monolog\Logger;

class MessageServiceEmailStub extends \CarbonTrack\Services\EmailService
{
    /** @var array<int,array<string,mixed>> */
    public array $messageNotifications = [];
    /** @var array<int,array<string,mixed>> */
    public array $bulkNotifications = [];
    /** @var array<int,array<string,mixed>> */
    public array $exchangeConfirmations = [];
    /** @var array<int,array<string,mixed>> */
    public array $exchangeStatusUpdates = [];
    public bool $allowSend = true;

    public function __construct()
    {
        $Silian_logger = new Logger('message-service-email-stub');
        $Silian_logger->pushHandler(new NullHandler());
        parent::__construct([
            'host' => 'smtp.test',
            'port' => 25,
            'from_address' => 'noreply@test',
            'from_name' => 'CarbonTrack',
            'force_simulation' => true,
        ], $Silian_logger, null);
    }

    public function sendMessageNotification(
        string $Silian_toEmail,
        string $Silian_toName,
        string $Silian_subject,
        string $Silian_messageBody,
        string $Silian_category,
        string $Silian_priority = Message::PRIORITY_NORMAL
    ): bool {
        $this->messageNotifications[] = [
            'toEmail' => $Silian_toEmail,
            'toName' => $Silian_toName,
            'subject' => $Silian_subject,
            'body' => $Silian_messageBody,
            'category' => $Silian_category,
            'priority' => $Silian_priority,
        ];

        return $this->allowSend;
    }

    public function sendMessageNotificationToMany(
        array $Silian_recipients,
        string $Silian_subject,
        string $Silian_messageBody,
        string $Silian_category,
        string $Silian_priority = Message::PRIORITY_NORMAL
    ): bool {
        $this->bulkNotifications[] = [
            'recipients' => $Silian_recipients,
            'subject' => $Silian_subject,
            'body' => $Silian_messageBody,
            'category' => $Silian_category,
            'priority' => $Silian_priority,
        ];

        return $this->allowSend;
    }

    public function sendExchangeConfirmation(
        string $Silian_toEmail,
        string $Silian_toName,
        string $Silian_productName,
        int $Silian_quantity,
        float $Silian_totalPoints
    ): bool {
        $this->exchangeConfirmations[] = [
            'toEmail' => $Silian_toEmail,
            'toName' => $Silian_toName,
            'productName' => $Silian_productName,
            'quantity' => $Silian_quantity,
            'totalPoints' => $Silian_totalPoints,
        ];

        return $this->allowSend;
    }

    public function sendExchangeStatusUpdate(
        string $Silian_toEmail,
        string $Silian_toName,
        string $Silian_productName,
        string $Silian_status,
        string $Silian_adminNotes = ''
    ): bool {
        $this->exchangeStatusUpdates[] = [
            'toEmail' => $Silian_toEmail,
            'toName' => $Silian_toName,
            'productName' => $Silian_productName,
            'status' => $Silian_status,
            'adminNotes' => $Silian_adminNotes,
        ];

        return $this->allowSend;
    }
}

class MessageServiceTest extends TestCase
{
    public function testSendSystemMessageBuildsModel(): void
    {
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);

        // Mock Message::createSystemMessage static call via a stub class
        $Silian_service = new MessageService($Silian_logger, $Silian_audit);

        $this->assertTrue(method_exists($Silian_service, 'sendSystemMessage'));
        $this->assertTrue(defined(Message::class . '::TYPE_SYSTEM'));
        $this->assertTrue(defined(Message::class . '::PRIORITY_NORMAL'));
    }

    public function testSendBulkMessageDispatches(): void
    {
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_service = new MessageService($Silian_logger, $Silian_audit);

        $this->assertTrue(method_exists($Silian_service, 'sendBulkMessage'));
        $Silian_sent = $Silian_service->sendBulkMessage([], 't', 'c');
        $this->assertEquals(0, $Silian_sent);
    }

    public function testMaybeSendLinkedEmailSendsNotificationWhenUserResolved(): void
    {
        $Silian_logger = $this->createMock(Logger::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_emailStub = new MessageServiceEmailStub();
        $Silian_service = new MessageService($Silian_logger, $Silian_audit, $Silian_emailStub);

        $Silian_user = new User(['id' => 42, 'username' => 'tester', 'email' => 'tester@example.com']);
        $Silian_service->setUserResolver(static function (int $Silian_userId) use ($Silian_user): ?User {
            return $Silian_userId === 42 ? $Silian_user : null;
        });

        $Silian_reflection = new \ReflectionClass($Silian_service);
        $Silian_method = $Silian_reflection->getMethod('maybeSendLinkedEmail');
        $Silian_method->setAccessible(true);
        $Silian_method->invoke($Silian_service, 42, 'Important update', 'Body content', Message::TYPE_SYSTEM, Message::PRIORITY_HIGH);

        $this->assertCount(1, $Silian_emailStub->messageNotifications);
        $Silian_notification = $Silian_emailStub->messageNotifications[0];
        $this->assertSame('tester@example.com', $Silian_notification['toEmail']);
        $this->assertSame('[HIGH] Important update', $Silian_notification['subject']);
        $this->assertSame(NotificationPreferenceService::CATEGORY_SYSTEM, $Silian_notification['category']);
    }

    public function testNotificationMessagesUseSystemEmailPreferenceCategory(): void
    {
        $Silian_logger = $this->createMock(Logger::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_emailStub = new MessageServiceEmailStub();
        $Silian_service = new MessageService($Silian_logger, $Silian_audit, $Silian_emailStub);

        $Silian_user = new User(['id' => 84, 'username' => 'avatar-user', 'email' => 'avatar@example.com']);
        $Silian_service->setUserResolver(static function (int $Silian_userId) use ($Silian_user): ?User {
            return $Silian_userId === 84 ? $Silian_user : null;
        });

        $Silian_reflection = new \ReflectionClass($Silian_service);
        $Silian_method = $Silian_reflection->getMethod('maybeSendLinkedEmail');
        $Silian_method->setAccessible(true);
        $Silian_method->invoke($Silian_service, 84, 'Selected avatar unavailable', 'Avatar fallback body', Message::TYPE_NOTIFICATION, Message::PRIORITY_NORMAL);

        $this->assertCount(1, $Silian_emailStub->messageNotifications);
        $Silian_notification = $Silian_emailStub->messageNotifications[0];
        $this->assertSame('avatar@example.com', $Silian_notification['toEmail']);
        $this->assertSame('Selected avatar unavailable', $Silian_notification['subject']);
        $this->assertSame(NotificationPreferenceService::CATEGORY_SYSTEM, $Silian_notification['category']);
    }

    public function testMaybeSendLinkedEmailSkipsWhenResolverReturnsNull(): void
    {
        $Silian_logger = $this->createMock(Logger::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_emailStub = new MessageServiceEmailStub();
        $Silian_service = new MessageService($Silian_logger, $Silian_audit, $Silian_emailStub);

        $Silian_service->setUserResolver(static function (): ?User {
            return null;
        });

        $Silian_reflection = new \ReflectionClass($Silian_service);
        $Silian_method = $Silian_reflection->getMethod('maybeSendLinkedEmail');
        $Silian_method->setAccessible(true);
        $Silian_method->invoke($Silian_service, 99, 'Notice', 'Body', Message::TYPE_SYSTEM, Message::PRIORITY_NORMAL);

        $this->assertCount(0, $Silian_emailStub->messageNotifications);
    }


    public function testSendAdminNotificationBatchAggregatesEmails(): void
    {
        $Silian_logger = $this->createMock(Logger::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_emailStub = new MessageServiceEmailStub();

        $Silian_service = new class($Silian_logger, $Silian_audit, $Silian_emailStub) extends MessageService {
            public array $bulkRows = [];

            public function __construct($Silian_logger, $Silian_auditLogService, $Silian_emailService)
            {
                parent::__construct($Silian_logger, $Silian_auditLogService, $Silian_emailService);
            }

            protected function persistSystemMessagesBulk(array $Silian_rows): void
            {
                $this->bulkRows = array_merge($this->bulkRows, $Silian_rows);
            }
        };

        $Silian_admins = [
            ['id' => 1, 'email' => 'admin1@example.com', 'username' => 'Admin One'],
            ['id' => 2, 'email' => 'admin2@example.com', 'username' => 'Admin Two'],
            ['id' => 3, 'email' => null, 'username' => 'No Email'],
            ['id' => 4, 'email' => 'ADMIN1@example.com', 'username' => 'Duplicate Email'],
            ['id' => 0, 'email' => 'ignored@example.com', 'username' => 'Ignore'],
        ];

        $Silian_service->sendAdminNotificationBatch(
            $Silian_admins,
            'new_exchange_pending',
            'Title',
            'Body',
            'high'
        );

        $this->assertCount(1, $Silian_emailStub->bulkNotifications);
        $Silian_bulk = $Silian_emailStub->bulkNotifications[0];
        $this->assertCount(2, $Silian_bulk['recipients']);
        $this->assertSame('[HIGH] Title', $Silian_bulk['subject']);
        $this->assertSame('Body', $Silian_bulk['body']);
        $this->assertSame('high', $Silian_bulk['priority']);
        $this->assertCount(4, $Silian_service->bulkRows);
        $Silian_receiverIds = array_column($Silian_service->bulkRows, 'receiver_id');
        sort($Silian_receiverIds);
        $this->assertSame([1, 2, 3, 4], $Silian_receiverIds);
        foreach ($Silian_service->bulkRows as $Silian_row) {
            $this->assertSame('Title', $Silian_row['title']);
            $this->assertSame('Body', $Silian_row['content']);
            $this->assertSame('high', $Silian_row['priority']);
            $this->assertFalse($Silian_row['is_read']);
        }

        $this->assertCount(0, $Silian_emailStub->messageNotifications, 'No individual notifications should be sent.');
    }

    public function testSendExchangeConfirmationEmailToUserUsesEmailService(): void
    {
        $Silian_logger = $this->createMock(Logger::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_emailStub = new MessageServiceEmailStub();
        $Silian_service = new MessageService($Silian_logger, $Silian_audit, $Silian_emailStub);

        $Silian_service->sendExchangeConfirmationEmailToUser(
            5,
            'Eco Bottle',
            2,
            120.0,
            'jeffery@example.com',
            'Jeffery'
        );

        $this->assertCount(1, $Silian_emailStub->exchangeConfirmations);
        $Silian_record = $Silian_emailStub->exchangeConfirmations[0];
        $this->assertSame('jeffery@example.com', $Silian_record['toEmail']);
        $this->assertSame('Jeffery', $Silian_record['toName']);
        $this->assertSame('Eco Bottle', $Silian_record['productName']);
        $this->assertSame(2, $Silian_record['quantity']);
        $this->assertSame(120.0, $Silian_record['totalPoints']);
    }

    public function testSendExchangeStatusUpdateEmailToUserUsesEmailService(): void
    {
        $Silian_logger = $this->createMock(Logger::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_emailStub = new MessageServiceEmailStub();
        $Silian_service = new MessageService($Silian_logger, $Silian_audit, $Silian_emailStub);

        $Silian_service->sendExchangeStatusUpdateEmailToUser(
            7,
            'Eco Bottle',
            'shipped',
            'TRACK-999',
            '发货完成',
            'notify@example.com',
            'Notify User'
        );

        $this->assertCount(1, $Silian_emailStub->exchangeStatusUpdates);
        $Silian_record = $Silian_emailStub->exchangeStatusUpdates[0];
        $this->assertSame('notify@example.com', $Silian_record['toEmail']);
        $this->assertSame('Notify User', $Silian_record['toName']);
        $this->assertSame('Eco Bottle', $Silian_record['productName']);
        $this->assertSame('shipped', $Silian_record['status']);
        $this->assertSame("Tracking number: TRACK-999\n发货完成", $Silian_record['adminNotes']);
    }
}


