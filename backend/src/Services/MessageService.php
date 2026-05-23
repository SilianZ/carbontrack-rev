<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Jobs\EmailJobRunner;
use CarbonTrack\Models\Message;
use CarbonTrack\Models\User;
use CarbonTrack\Services\EmailService;
use CarbonTrack\Services\NotificationPreferenceService;
use Monolog\Logger;

class MessageService
{
    private Logger $logger;
    private AuditLogService $auditLogService;
    private ?ErrorLogService $errorLogService;
    private ?EmailService $emailService;
    /** @var callable|null */
    private $userResolver;
    private bool $responseFlushedForAsyncEmail = false;
    private ?string $emailDispatcherScript = null;
    /** @var array<int,array{job_type:string,payload:array<string,mixed>}> */
    private array $pendingEmailJobs = [];
    private bool $emailShutdownRegistered = false;

    /**
     * @var array<string,string>
     */
    private const TYPE_CATEGORY_MAP = [
        Message::TYPE_SYSTEM => NotificationPreferenceService::CATEGORY_SYSTEM,
        Message::TYPE_NOTIFICATION => NotificationPreferenceService::CATEGORY_SYSTEM,
        Message::TYPE_APPROVAL => NotificationPreferenceService::CATEGORY_ACTIVITY,
        Message::TYPE_REJECTION => NotificationPreferenceService::CATEGORY_ACTIVITY,
        Message::TYPE_EXCHANGE => NotificationPreferenceService::CATEGORY_TRANSACTION,
        Message::TYPE_WELCOME => NotificationPreferenceService::CATEGORY_SYSTEM,
        Message::TYPE_REMINDER => NotificationPreferenceService::CATEGORY_SYSTEM,
        'record_submitted' => NotificationPreferenceService::CATEGORY_ACTIVITY,
        'record_approved' => NotificationPreferenceService::CATEGORY_ACTIVITY,
        'record_rejected' => NotificationPreferenceService::CATEGORY_ACTIVITY,
        'new_record_pending' => NotificationPreferenceService::CATEGORY_ACTIVITY,
        'product_exchanged' => NotificationPreferenceService::CATEGORY_TRANSACTION,
        'new_exchange_pending' => NotificationPreferenceService::CATEGORY_TRANSACTION,
        'exchange_status_updated' => NotificationPreferenceService::CATEGORY_TRANSACTION,
        'direct_message' => NotificationPreferenceService::CATEGORY_MESSAGE,
        'message' => NotificationPreferenceService::CATEGORY_MESSAGE,
    ];

    /**
     * Message types that already have a dedicated email notification.
     *
     * @var array<int,string>
     */
    private const TYPES_WITH_DEDICATED_EMAIL = [
        'product_exchanged',
        'exchange_status_updated',
        'record_approved',
        'record_rejected',
    ];

    public function __construct(Logger $Silian_logger, AuditLogService $Silian_auditLogService, ?EmailService $Silian_emailService = null, ?ErrorLogService $Silian_errorLogService = null)
    {
        $this->logger = $Silian_logger;
        $this->auditLogService = $Silian_auditLogService;
        $this->emailService = $Silian_emailService;
        $this->errorLogService = $Silian_errorLogService;
        $this->userResolver = null;
        $Silian_scriptPath = realpath(dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'bin' . DIRECTORY_SEPARATOR . 'email_dispatcher.php');
        $this->emailDispatcherScript = $Silian_scriptPath !== false ? $Silian_scriptPath : null;
    }

    /**
     * @param callable|null $resolver receives (int $userId): ?User
     */
    public function setUserResolver(?callable $Silian_resolver): void
    {
        $this->userResolver = $Silian_resolver;
    }

    /**
     * Send a message between users
     */
    public function sendMessage(
        int $Silian_receiverId,
        string $Silian_type,
        string $Silian_title,
        string $Silian_content,
        string $Silian_priority = Message::PRIORITY_NORMAL,
        ?int $Silian_senderId = null,
        bool $Silian_sendEmail = true
    ): Message {
        $Silian_message = Message::create([
            'sender_id' => $Silian_senderId,
            'receiver_id' => $Silian_receiverId,
            'title' => $Silian_title,
            'content' => $Silian_content,
            'is_read' => false,
            'priority' => $Silian_priority
        ]);

        $this->logger->info('Message sent', [
            'message_id' => $Silian_message->id,
            'sender_id' => $Silian_senderId,
            'receiver_id' => $Silian_receiverId,
            'type' => $Silian_type,
            'priority' => $Silian_priority
        ]);

        // Log the message sending
        $this->auditLogService->log([
            'user_id' => $Silian_senderId,
            'action' => 'message_sent',
            'entity_type' => 'message',
            'entity_id' => $Silian_message->id,
            'new_value' => json_encode([
                'receiver_id' => $Silian_receiverId,
                'title' => $Silian_title,
                'type' => $Silian_type,
                'priority' => $Silian_priority
            ]),
            'notes' => 'Message sent to user ' . $Silian_receiverId
        ]);

        if ($Silian_sendEmail) {
            $this->maybeSendLinkedEmail($Silian_receiverId, $Silian_title, $Silian_content, $Silian_type, $Silian_priority);
        }

        return $Silian_message;
    }

    /**
     * Send system message
     */
    public function sendSystemMessage(
        int $Silian_receiverId,
        string $Silian_title,
        string $Silian_content,
        string $Silian_type = Message::TYPE_SYSTEM,
        string $Silian_priority = Message::PRIORITY_NORMAL,
        ?string $Silian_relatedEntityType = null,
        ?int $Silian_relatedEntityId = null,
        bool $Silian_sendEmail = true
    ): Message {
        $Silian_message = Message::createSystemMessage(
            $Silian_receiverId,
            $Silian_title,
            $Silian_content,
            $Silian_type,
            $Silian_priority,
            $Silian_relatedEntityType,
            $Silian_relatedEntityId
        );

        if ($Silian_sendEmail) {
            $this->maybeSendLinkedEmail($Silian_receiverId, $Silian_title, $Silian_content, $Silian_type, $Silian_priority);
        }

        return $Silian_message;
    }

    /**
     * Send carbon tracking submission notification
     */
    /**
     * @param mixed $transaction Backward-compatible transaction object/array
     */
    public function sendCarbonTrackingSubmissionNotification($Silian_transaction): Message
    {
        $Silian_user = is_array($Silian_transaction) ? ($Silian_transaction['user'] ?? null) : ($Silian_transaction->user ?? null);
        $Silian_activity = is_array($Silian_transaction) ? ($Silian_transaction['activity'] ?? null) : ($Silian_transaction->activity ?? null);

        $Silian_title = '碳减排记录提交成功 / Carbon Tracking Record Submitted';
        $Silian_content = "您的碳减排记录已成功提交，正在等待审核。\n\n" .
                  "活动：{$Silian_activity->getCombinedName()}\n" .
                  "数据：{$Silian_transaction->raw} {$Silian_activity->unit}\n" .
                  "预计积分：{$Silian_transaction->points}\n" .
                  "提交时间：{$Silian_transaction->created_at}\n\n" .
                  "我们将在1-3个工作日内完成审核，请耐心等待。\n\n" .
                  "Your carbon reduction record has been submitted successfully and is pending review.\n\n" .
                  "Activity: {$Silian_activity->getCombinedName()}\n" .
                  "Data: {$Silian_transaction->raw} {$Silian_activity->unit}\n" .
                  "Expected Points: {$Silian_transaction->points}\n" .
                  "Submitted: {$Silian_transaction->created_at}\n\n" .
                  "We will complete the review within 1-3 business days. Please be patient.";

        return $this->sendSystemMessage(
            $Silian_user->id,
            $Silian_title,
            $Silian_content,
            Message::TYPE_NOTIFICATION,
            Message::PRIORITY_NORMAL,
            null,
            null
        );
    }

    /**
     * Send carbon tracking approval notification
     */
    /**
     * @param mixed $transaction Backward-compatible transaction object/array
     */
    public function sendCarbonTrackingApprovalNotification($Silian_transaction, User $Silian_approver): Message
    {
        $Silian_user = is_array($Silian_transaction) ? ($Silian_transaction['user'] ?? null) : ($Silian_transaction->user ?? null);
        $Silian_activity = is_array($Silian_transaction) ? ($Silian_transaction['activity'] ?? null) : ($Silian_transaction->activity ?? null);

        $Silian_title = '🎉 碳减排记录审核通过 / Carbon Tracking Record Approved';
        $Silian_content = "恭喜！您的碳减排记录已通过审核。\n\n" .
                  "活动：{$Silian_activity->getCombinedName()}\n" .
                  "数据：{$Silian_transaction->raw} {$Silian_activity->unit}\n" .
                  "获得积分：{$Silian_transaction->points}\n" .
                  "审核时间：{$Silian_transaction->approved_at}\n" .
                  "审核员：{$Silian_approver->username}\n\n" .
                  "积分已添加到您的账户，当前总积分：{$Silian_user->points}\n\n" .
                  "感谢您为环保事业做出的贡献！\n\n" .
                  "Congratulations! Your carbon reduction record has been approved.\n\n" .
                  "Activity: {$Silian_activity->getCombinedName()}\n" .
                  "Data: {$Silian_transaction->raw} {$Silian_activity->unit}\n" .
                  "Points Earned: {$Silian_transaction->points}\n" .
                  "Approved: {$Silian_transaction->approved_at}\n" .
                  "Reviewer: {$Silian_approver->username}\n\n" .
                  "Points have been added to your account. Current total: {$Silian_user->points}\n\n" .
                  "Thank you for your contribution to environmental protection!";

        $Silian_message = $this->sendSystemMessage(
            $Silian_user->id,
            $Silian_title,
            $Silian_content,
            Message::TYPE_APPROVAL,
            Message::PRIORITY_HIGH,
            null,
            null,
            false
        );

        $this->sendActivityApprovedEmail($Silian_user, $Silian_activity, $Silian_transaction);

        return $Silian_message;
    }

    /**
     * Send carbon tracking rejection notification
     */
    /**
     * @param mixed $transaction Backward-compatible transaction object/array
     */
    public function sendCarbonTrackingRejectionNotification($Silian_transaction, User $Silian_approver, ?string $Silian_reason = null): Message
    {
        $Silian_user = is_array($Silian_transaction) ? ($Silian_transaction['user'] ?? null) : ($Silian_transaction->user ?? null);
        $Silian_activity = is_array($Silian_transaction) ? ($Silian_transaction['activity'] ?? null) : ($Silian_transaction->activity ?? null);

        $Silian_title = '❌ 碳减排记录审核未通过 / Carbon Tracking Record Rejected';
        $Silian_content = "很抱歉，您的碳减排记录未通过审核。\n\n" .
                  "活动：{$Silian_activity->getCombinedName()}\n" .
                  "数据：{$Silian_transaction->raw} {$Silian_activity->unit}\n" .
                  "审核时间：{$Silian_transaction->approved_at}\n" .
                  "审核员：{$Silian_approver->username}\n\n";

        if ($Silian_reason) {
            $Silian_content .= "拒绝原因：{$Silian_reason}\n\n";
        }

        $Silian_content .= "请检查提交的信息是否准确完整，您可以重新提交正确的记录。\n\n" .
                   "如有疑问，请联系管理员。\n\n" .
                   "Sorry, your carbon reduction record was not approved.\n\n" .
                   "Activity: {$Silian_activity->getCombinedName()}\n" .
                   "Data: {$Silian_transaction->raw} {$Silian_activity->unit}\n" .
                   "Reviewed: {$Silian_transaction->approved_at}\n" .
                   "Reviewer: {$Silian_approver->username}\n\n";

        if ($Silian_reason) {
            $Silian_content .= "Reason: {$Silian_reason}\n\n";
        }

        $Silian_content .= "Please check if the submitted information is accurate and complete. You can resubmit the correct record.\n\n" .
                   "If you have any questions, please contact the administrator.";

        $Silian_message = $this->sendSystemMessage(
            $Silian_user->id,
            $Silian_title,
            $Silian_content,
            Message::TYPE_REJECTION,
            Message::PRIORITY_HIGH,
            null,
            null,
            false
        );

        $this->sendActivityRejectedEmail($Silian_user, $Silian_activity, $Silian_reason);

        return $Silian_message;
    }

    /**
     * Send product exchange confirmation notification
     */
    /**
     * @param mixed $exchange Backward-compatible exchange object/array
     */
    public function sendProductExchangeConfirmation($Silian_exchange): Message
    {
        $Silian_user = is_array($Silian_exchange) ? ($Silian_exchange['user'] ?? null) : ($Silian_exchange->user ?? null);
        $Silian_product = is_array($Silian_exchange) ? ($Silian_exchange['product'] ?? null) : ($Silian_exchange->product ?? null);

        $Silian_title = '🛍️ 商品兑换成功 / Product Exchange Successful';
        $Silian_content = "您已成功兑换商品！\n\n" .
                  "商品：{$Silian_product->name}\n" .
                  "消耗积分：{$Silian_exchange->points_spent}\n" .
                  "兑换时间：{$Silian_exchange->created_at}\n" .
                  "剩余积分：{$Silian_user->points}\n\n" .
                  "我们将尽快为您安排商品配送，请保持联系方式畅通。\n\n" .
                  "感谢您对环保事业的支持！\n\n" .
                  "You have successfully exchanged for a product!\n\n" .
                  "Product: {$Silian_product->name}\n" .
                  "Points Spent: {$Silian_exchange->points_spent}\n" .
                  "Exchange Time: {$Silian_exchange->created_at}\n" .
                  "Remaining Points: {$Silian_user->points}\n\n" .
                  "We will arrange product delivery as soon as possible. Please keep your contact information available.\n\n" .
                  "Thank you for supporting environmental protection!";

        $Silian_message = $this->sendSystemMessage(
            $Silian_user->id,
            $Silian_title,
            $Silian_content,
            Message::TYPE_EXCHANGE,
            Message::PRIORITY_NORMAL,
            null,
            null,
            false
        );

        $Silian_quantity = is_array($Silian_exchange) ? ($Silian_exchange['quantity'] ?? 1) : ($Silian_exchange->quantity ?? 1);
        $Silian_pointsSpent = is_array($Silian_exchange) ? ($Silian_exchange['points_spent'] ?? 0) : ($Silian_exchange->points_spent ?? 0);
        $this->sendExchangeConfirmationEmail($Silian_user, $Silian_product, (int) $Silian_quantity, (float) $Silian_pointsSpent);

        return $Silian_message;
    }


    /**
     * Send welcome message to new user
     */
    public function sendWelcomeMessage(User $Silian_user): Message
    {
        return Message::createWelcomeMessage($Silian_user->id);
    }

    /**
     * Send reminder for pending transactions
     */
    public function sendPendingTransactionReminder(User $Silian_user, int $Silian_pendingCount): Message
    {
        $Silian_title = '📋 待审核记录提醒 / Pending Records Reminder';
        $Silian_content = "您有 {$Silian_pendingCount} 条碳减排记录正在等待审核。\n\n" .
                  "我们正在努力处理您的提交，通常在1-3个工作日内完成审核。\n\n" .
                  "如果您的记录超过5个工作日仍未审核，请联系管理员。\n\n" .
                  "感谢您的耐心等待！\n\n" .
                  "You have {$Silian_pendingCount} carbon reduction records pending review.\n\n" .
                  "We are working hard to process your submissions, usually within 1-3 business days.\n\n" .
                  "If your records have not been reviewed for more than 5 business days, please contact the administrator.\n\n" .
                  "Thank you for your patience!";

        return $this->sendSystemMessage(
            $Silian_user->id,
            $Silian_title,
            $Silian_content,
            Message::TYPE_REMINDER,
            Message::PRIORITY_LOW
        );
    }

    /**
     * Send low points warning
     */
    public function sendLowPointsWarning(User $Silian_user): Message
    {
        $Silian_title = '⚠️ 积分余额不足 / Low Points Balance';
        $Silian_content = "您的积分余额较低（当前：{$Silian_user->points}），可能无法兑换心仪的商品。\n\n" .
                  "建议您：\n" .
                  "• 记录更多的碳减排活动\n" .
                  "• 参与平台的环保挑战\n" .
                  "• 邀请朋友加入CarbonTrack\n\n" .
                  "让我们一起为地球环保贡献更多力量！\n\n" .
                  "Your points balance is low (current: {$Silian_user->points}), you may not be able to exchange for desired products.\n\n" .
                  "We suggest you:\n" .
                  "• Record more carbon reduction activities\n" .
                  "• Participate in platform environmental challenges\n" .
                  "• Invite friends to join CarbonTrack\n\n" .
                  "Let's contribute more to environmental protection together!";

        return $this->sendSystemMessage(
            $Silian_user->id,
            $Silian_title,
            $Silian_content,
            Message::TYPE_REMINDER,
            Message::PRIORITY_LOW
        );
    }

    /**
     * Send admin notification for new pending transaction
     */
    /**
     * @param mixed $transaction Backward-compatible transaction object/array
     */
    public function sendAdminPendingTransactionNotification($Silian_transaction): void
    {
        $Silian_user = is_array($Silian_transaction) ? ($Silian_transaction['user'] ?? null) : ($Silian_transaction->user ?? null);
        $Silian_activity = is_array($Silian_transaction) ? ($Silian_transaction['activity'] ?? null) : ($Silian_transaction->activity ?? null);

        $Silian_title = '🔍 新的碳减排记录待审核 / New Carbon Record Pending Review';
        $Silian_content = "有新的碳减排记录需要审核：\n\n" .
                  "用户：{$Silian_user->username} ({$Silian_user->email})\n" .
                  "活动：{$Silian_activity->getCombinedName()}\n" .
                  "数据：{$Silian_transaction->raw} {$Silian_activity->unit}\n" .
                  "预计积分：{$Silian_transaction->points}\n" .
                  "提交时间：{$Silian_transaction->created_at}\n\n" .
                  "请及时处理审核。\n\n" .
                  "New carbon reduction record pending review:\n\n" .
                  "User: {$Silian_user->username} ({$Silian_user->email})\n" .
                  "Activity: {$Silian_activity->getCombinedName()}\n" .
                  "Data: {$Silian_transaction->raw} {$Silian_activity->unit}\n" .
                  "Expected Points: {$Silian_transaction->points}\n" .
                  "Submitted: {$Silian_transaction->created_at}\n\n" .
                  "Please process the review promptly.";

        // Send to all admin users
        $Silian_adminUsers = User::where('is_admin', true)->where('status', 'active')->get();

        if ($Silian_adminUsers->isEmpty()) {
            return;
        }

        $Silian_batch = $Silian_adminUsers->map(function (User $Silian_admin): array {
            return [
                'id' => (int) $Silian_admin->id,
                'email' => $Silian_admin->email ? (string) $Silian_admin->email : null,
                'username' => $Silian_admin->username ? (string) $Silian_admin->username : null,
            ];
        })->all();

        $this->sendAdminNotificationBatch(
            $Silian_batch,
            'new_record_pending',
            $Silian_title,
            $Silian_content,
            Message::PRIORITY_HIGH
        );
    }

    /**
     * Get messages for a user with pagination
     */
    public function getMessagesForUser(
        int $Silian_userId,
        int $Silian_page = 1,
        int $Silian_limit = 20,
        ?string $Silian_type = null,
        ?bool $Silian_unreadOnly = null
    ): array {
        $Silian_query = Message::forUser($Silian_userId)->with(['sender']);

        if ($Silian_type) {
            $Silian_query->byType($Silian_type);
        }

        if ($Silian_unreadOnly !== null) {
            if ($Silian_unreadOnly) {
                $Silian_query->unread();
            } else {
                $Silian_query->read();
            }
        }

        $Silian_total = $Silian_query->count();
        $Silian_messages = $Silian_query->orderBy('created_at', 'desc')
            ->skip(($Silian_page - 1) * $Silian_limit)
            ->take($Silian_limit)
            ->get();

        return [
            'messages' => $Silian_messages->map(function ($Silian_message) {
                return [
                    'id' => $Silian_message->id,
                    'title' => $Silian_message->title,
                    'content' => $Silian_message->content,
                    // Columns may not exist in provided schema; return nulls for compatibility
                    'type' => null,
                    'priority' => null,
                    'is_read' => $Silian_message->is_read,
                    'read_at' => null,
                    'created_at' => $Silian_message->created_at,
                    'age' => $Silian_message->age,
                    'sender' => $Silian_message->sender ? [
                        'id' => $Silian_message->sender->id,
                        'username' => $Silian_message->sender->username
                    ] : null,
                    'related_entity_type' => null,
                    'related_entity_id' => null
                ];
            })->toArray(),
            'pagination' => [
                'page' => $Silian_page,
                'limit' => $Silian_limit,
                'total' => $Silian_total,
                'pages' => ceil($Silian_total / $Silian_limit)
            ],
            'statistics' => Message::getStatisticsForUser($Silian_userId)
        ];
    }

    /**
     * Mark message as read
     */
    public function markAsRead(int $Silian_messageId, int $Silian_userId): bool
    {
        $Silian_message = Message::forUser($Silian_userId)->find($Silian_messageId);

        if (!$Silian_message) {
            return false;
        }

        $Silian_message->markAsRead();

        $this->auditLogService->log([
            'user_id' => $Silian_userId,
            'action' => 'message_read',
            'entity_type' => 'message',
            'entity_id' => $Silian_messageId,
            'notes' => 'Message marked as read'
        ]);

        return true;
    }

    /**
     * Mark all messages as read for a user
     */
    public function markAllAsRead(int $Silian_userId): int
    {
        $Silian_count = Message::forUser($Silian_userId)->unread()->count();

        Message::forUser($Silian_userId)->unread()->update([
            'is_read' => true,
        ]);

        $this->auditLogService->log([
            'user_id' => $Silian_userId,
            'action' => 'messages_mark_all_read',
            'entity_type' => 'message',
            'notes' => "Marked {$Silian_count} messages as read"
        ]);

        return $Silian_count;
    }

    /**
     * Delete message for a user (soft delete)
     */
    public function deleteMessage(int $Silian_messageId, int $Silian_userId): bool
    {
        $Silian_message = Message::forUser($Silian_userId)->find($Silian_messageId);

        if (!$Silian_message) {
            return false;
        }

        $Silian_message->delete();

        $this->auditLogService->log([
            'user_id' => $Silian_userId,
            'action' => 'message_deleted',
            'entity_type' => 'message',
            'entity_id' => $Silian_messageId,
            'notes' => 'Message deleted by user'
        ]);

        return true;
    }

    /**
     * Get unread message count for a user
     */
    public function getUnreadCount(int $Silian_userId): int
    {
        return Message::forUser($Silian_userId)->unread()->count();
    }

    /**
     * Send bulk messages to multiple users
     */
    public function sendBulkMessage(
        array $Silian_userIds,
        string $Silian_title,
        string $Silian_content,
        int $Silian_senderId = null,
        string $Silian_type = Message::TYPE_NOTIFICATION,
        string $Silian_priority = Message::PRIORITY_NORMAL
    ): int {
        $Silian_sent = 0;

        foreach ($Silian_userIds as $Silian_userId) {
            try {
                if ($Silian_senderId) {
                    $this->sendMessage($Silian_userId, $Silian_type, $Silian_title, $Silian_content, $Silian_priority, $Silian_senderId);
                } else {
                    $this->sendSystemMessage($Silian_userId, $Silian_title, $Silian_content, $Silian_type, $Silian_priority);
                }
                $Silian_sent++;
            } catch (\Exception $Silian_e) {
                $this->logger->error('Failed to send bulk message', [
                    'user_id' => $Silian_userId,
                    'error' => $Silian_e->getMessage()
                ]);
            }
        }

        return $Silian_sent;
    }

    /**
     * @param array<int, array{id:int,email:string|null,username:string|null,name?:string|null}> $adminUsers
     */
    public function sendAdminNotificationBatch(
        array $Silian_adminUsers,
        string $Silian_type,
        string $Silian_title,
        string $Silian_content,
        string $Silian_priority = Message::PRIORITY_NORMAL
    ): void {
        if (empty($Silian_adminUsers)) {
            return;
        }

        $Silian_messageRows = [];
        $Silian_emailRecipients = [];
        $Silian_now = (new \DateTimeImmutable())->format('Y-m-d H:i:s');
        $Silian_count = 0;

        foreach ($Silian_adminUsers as $Silian_admin) {
            $Silian_adminId = isset($Silian_admin['id']) ? (int) $Silian_admin['id'] : 0;
            if ($Silian_adminId <= 0) {
                continue;
            }

            $Silian_count++;
            $Silian_row = [
                'sender_id' => null,
                'receiver_id' => $Silian_adminId,
                'title' => $Silian_title,
                'content' => $Silian_content,
                'is_read' => false,
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ];

            $Silian_row['priority'] = in_array($Silian_priority, Message::getValidPriorities(), true)
                ? $Silian_priority
                : Message::PRIORITY_NORMAL;

            $Silian_messageRows[] = $Silian_row;

            $Silian_email = isset($Silian_admin['email']) ? trim((string) $Silian_admin['email']) : '';
            if ($Silian_email === '') {
                continue;
            }

            $Silian_name = null;
            if (isset($Silian_admin['username']) && $Silian_admin['username'] !== null && $Silian_admin['username'] !== '') {
                $Silian_name = (string) $Silian_admin['username'];
            } elseif (isset($Silian_admin['name']) && $Silian_admin['name'] !== null && $Silian_admin['name'] !== '') {
                $Silian_name = (string) $Silian_admin['name'];
            }

            if ($Silian_name === null) {
                $Silian_name = $Silian_email;
            }

            $Silian_emailRecipients[] = [
                'email' => $Silian_email,
                'name' => $Silian_name,
            ];
        }

        if (empty($Silian_messageRows)) {
            return;
        }

        $Silian_insertStart = microtime(true);
        try {
            $this->persistSystemMessagesBulk($Silian_messageRows);
        } catch (\Throwable $Silian_e) {
            $this->logger->warning('Bulk admin message insert failed, falling back to per-recipient create', [
                'error' => $Silian_e->getMessage(),
            ]);
            foreach ($Silian_messageRows as $Silian_row) {
                try {
                    $Silian_createRow = $Silian_row;
                    unset($Silian_createRow['created_at'], $Silian_createRow['updated_at']);
                    Message::create($Silian_createRow);
                } catch (\Throwable $Silian_inner) {
                    $this->logger->error('Failed to create admin notification message', [
                        'receiver_id' => $Silian_row['receiver_id'],
                        'error' => $Silian_inner->getMessage(),
                    ]);
                }
            }
        }

        $Silian_duration = round((microtime(true) - $Silian_insertStart) * 1000.0, 2);
        $this->logger->info('Admin notifications inserted', [
            'recipient_count' => $Silian_count,
            'duration_ms' => $Silian_duration,
        ]);

        $this->sendBulkLinkedEmail($Silian_emailRecipients, $Silian_title, $Silian_content, $Silian_type, $Silian_priority);
    }

    protected function persistSystemMessagesBulk(array $Silian_rows): void
    {
        if (empty($Silian_rows)) {
            return;
        }

        Message::query()->insert($Silian_rows);
    }

    private function shouldSuppressLinkedEmail(string $Silian_type): bool
    {
        $Silian_normalized = strtolower(trim($Silian_type));
        if ($Silian_normalized === '') {
            return false;
        }

        return in_array($Silian_normalized, self::TYPES_WITH_DEDICATED_EMAIL, true);
    }

    private function maybeSendLinkedEmail(int $Silian_receiverId, string $Silian_title, string $Silian_content, string $Silian_type, string $Silian_priority): void
    {
        if ($this->emailService === null) {
            return;
        }

        if ($this->shouldSuppressLinkedEmail($Silian_type)) {
            return;
        }

        $Silian_recipient = $this->resolveEmailRecipient($Silian_receiverId);
        if ($Silian_recipient === null) {
            return;
        }

        $Silian_subject = $this->buildEmailSubject($Silian_title, $Silian_priority);
        $Silian_category = $this->resolveNotificationCategory($Silian_type);

        $this->dispatchEmail('message_notification', [
            'receiver_id' => $Silian_receiverId,
            'email' => $Silian_recipient['email'],
            'name' => $Silian_recipient['name'],
            'subject' => $Silian_subject,
            'content' => $Silian_content,
            'category' => $Silian_category,
            'priority' => $Silian_priority,
            'type' => $Silian_type,
        ]);
    }

    /**
     * @param array<int, array{email:string,name:string|null}> $recipients
     */
    private function sendBulkLinkedEmail(array $Silian_recipients, string $Silian_title, string $Silian_content, string $Silian_type, string $Silian_priority): void
    {
        if ($this->emailService === null || empty($Silian_recipients)) {
            return;
        }

        if ($this->shouldSuppressLinkedEmail($Silian_type)) {
            return;
        }

        $Silian_formatted = [];
        $Silian_seen = [];
        foreach ($Silian_recipients as $Silian_recipient) {
            $Silian_email = trim((string)($Silian_recipient['email'] ?? ''));
            if ($Silian_email === '') {
                continue;
            }

            $Silian_key = strtolower($Silian_email);
            if (isset($Silian_seen[$Silian_key])) {
                continue;
            }
            $Silian_seen[$Silian_key] = true;

            $Silian_name = $Silian_recipient['name'] ?? null;
            $Silian_formatted[] = [
                'email' => $Silian_email,
                'name' => ($Silian_name !== null && $Silian_name !== '') ? (string) $Silian_name : null,
            ];
        }

        if (empty($Silian_formatted)) {
            return;
        }

        $Silian_subject = $this->buildEmailSubject($Silian_title, $Silian_priority);
        $Silian_category = $this->resolveNotificationCategory($Silian_type);

        $this->dispatchEmail('message_notification_bulk', [
            'recipients' => $Silian_formatted,
            'subject' => $Silian_subject,
            'content' => $Silian_content,
            'category' => $Silian_category,
            'priority' => $Silian_priority,
            'type' => $Silian_type,
        ]);
    }

    /**
     * @param array<int, array{user_id:int,email:string,name:string}> $recipients
     * @return array{queued:bool,recipient_count:int,error?:string}
     */
    public function queueBroadcastEmail(array $Silian_recipients, string $Silian_title, string $Silian_content, string $Silian_priority = Message::PRIORITY_NORMAL, array $Silian_context = []): array
    {
        if ($this->emailService === null) {
            return ['queued' => false, 'recipient_count' => 0, 'error' => 'Email service unavailable'];
        }

        $Silian_formatted = [];
        $Silian_seenEmails = [];
        foreach ($Silian_recipients as $Silian_recipient) {
            $Silian_email = isset($Silian_recipient['email']) ? trim((string)$Silian_recipient['email']) : '';
            if ($Silian_email === '') {
                continue;
            }
            $Silian_key = strtolower($Silian_email);
            if (isset($Silian_seenEmails[$Silian_key])) {
                continue;
            }
            $Silian_seenEmails[$Silian_key] = true;

            $Silian_name = isset($Silian_recipient['name']) && $Silian_recipient['name'] !== ''
                ? (string)$Silian_recipient['name']
                : $Silian_email;

            $Silian_formatted[] = [
                'email' => $Silian_email,
                'name' => $Silian_name,
                'user_id' => isset($Silian_recipient['user_id']) ? (int)$Silian_recipient['user_id'] : null,
            ];
        }

        if (empty($Silian_formatted)) {
            return ['queued' => false, 'recipient_count' => 0];
        }

        $Silian_payload = [
            'recipients' => $Silian_formatted,
            'title' => $Silian_title,
            'content' => $Silian_content,
            'priority' => $Silian_priority,
            'subject' => $this->buildEmailSubject($Silian_title, $Silian_priority),
        ];

        if (!empty($Silian_context)) {
            $Silian_payload['context'] = $Silian_context;
            if (!empty($Silian_context['content_format'])) {
                $Silian_payload['content_format'] = (string) $Silian_context['content_format'];
            }
            if (!empty($Silian_context['render_profile'])) {
                $Silian_payload['render_profile'] = (string) $Silian_context['render_profile'];
            }
            if (array_key_exists('render_version', $Silian_context) && $Silian_context['render_version'] !== null) {
                $Silian_payload['render_version'] = (int) $Silian_context['render_version'];
            }
            if (!empty($Silian_context['source_kind'])) {
                $Silian_payload['source_kind'] = (string) $Silian_context['source_kind'];
            }
        }

        $this->dispatchEmail('broadcast_announcement', $Silian_payload);

        return ['queued' => true, 'recipient_count' => count($Silian_formatted)];
    }

    /**
     * Defer email sending until after the response is flushed when running under web SAPI.
     */
    private function dispatchEmail(string $Silian_jobType, array $Silian_payload): void
    {
        if ($this->emailService === null) {
            return;
        }

        if (PHP_SAPI === 'cli' || PHP_SAPI === 'phpdbg') {
            EmailJobRunner::run($this->emailService, $this->logger, $Silian_jobType, $Silian_payload, $this->auditLogService, $this->errorLogService);
            return;
        }

        $this->pendingEmailJobs[] = [
            'job_type' => $Silian_jobType,
            'payload' => $Silian_payload,
        ];

        if (!$this->emailShutdownRegistered) {
            $this->emailShutdownRegistered = true;
            register_shutdown_function([$this, 'flushPendingEmailJobs']);
        }

        if (function_exists('fastcgi_finish_request') && !$this->responseFlushedForAsyncEmail) {
            $this->responseFlushedForAsyncEmail = true;
            try {
                fastcgi_finish_request();
            } catch (\Throwable $Silian_ignore) {
                // Some SAPIs do not support this call; safe to ignore.
            }
        }
    }

    /**
     * @internal Called automatically on script shutdown.
     */
    public function flushPendingEmailJobs(): void
    {
        if ($this->emailService === null || empty($this->pendingEmailJobs)) {
            return;
        }

        $Silian_jobs = $this->pendingEmailJobs;
        $this->pendingEmailJobs = [];

        if (function_exists('fastcgi_finish_request')) {
            foreach ($Silian_jobs as $Silian_job) {
                EmailJobRunner::run(
                    $this->emailService,
                    $this->logger,
                    $Silian_job['job_type'],
                    $Silian_job['payload'],
                    $this->auditLogService,
                    $this->errorLogService
                );
            }
            return;
        }

        $this->spawnBackgroundEmailProcess($Silian_jobs);
    }

    /**
     * @param array<int,array{job_type:string,payload:array<string,mixed>}> $jobs
     */
    private function spawnBackgroundEmailProcess(array $Silian_jobs): void
    {
        if (empty($Silian_jobs)) {
            return;
        }

        if ($this->emailDispatcherScript === null || !is_file($this->emailDispatcherScript)) {
            foreach ($Silian_jobs as $Silian_job) {
                EmailJobRunner::run($this->emailService, $this->logger, $Silian_job['job_type'], $Silian_job['payload'], $this->auditLogService, $this->errorLogService);
            }
            return;
        }

        $Silian_jobFile = null;

        try {
            $Silian_jobData = [
                'jobs' => $Silian_jobs,
            ];

            $Silian_jobFile = tempnam(sys_get_temp_dir(), 'ct_email_job_');
            if ($Silian_jobFile === false) {
                throw new \RuntimeException('Unable to allocate temporary file for email job.');
            }

            file_put_contents($Silian_jobFile, json_encode($Silian_jobData, JSON_THROW_ON_ERROR));

            $Silian_phpBinary = PHP_BINARY ?: 'php';

            if (stripos(PHP_OS_FAMILY, 'Windows') !== false) {
                $Silian_escapedBinary = str_replace('"', '""', $Silian_phpBinary);
                $Silian_escapedScript = str_replace('"', '""', $this->emailDispatcherScript);
                $Silian_escapedJobFile = str_replace('"', '""', $Silian_jobFile);
                $Silian_command = sprintf('"%s" "%s" "%s"', $Silian_escapedBinary, $Silian_escapedScript, $Silian_escapedJobFile);
                $Silian_process = @popen('start /B "" ' . $Silian_command, 'r');
                if (is_resource($Silian_process)) {
                    pclose($Silian_process);
                } else {
                    throw new \RuntimeException('Unable to spawn background email process.');
                }
            } else {
                $Silian_command = sprintf(
                    '%s %s %s',
                    escapeshellarg($Silian_phpBinary),
                    escapeshellarg($this->emailDispatcherScript),
                    escapeshellarg($Silian_jobFile)
                );
                $Silian_result = @exec($Silian_command . ' > /dev/null 2>&1 &');
                if ($Silian_result === false) {
                    throw new \RuntimeException('Unable to spawn background email process.');
                }
            }
        } catch (\Throwable $Silian_e) {
            $this->logger->warning('Falling back to synchronous email dispatch', [
                'job_count' => count($Silian_jobs),
                'error' => $Silian_e->getMessage(),
            ]);

            if (is_string($Silian_jobFile) && $Silian_jobFile !== '' && is_file($Silian_jobFile)) {
                @unlink($Silian_jobFile);
            }

            foreach ($Silian_jobs as $Silian_job) {
                EmailJobRunner::run($this->emailService, $this->logger, $Silian_job['job_type'], $Silian_job['payload'], $this->auditLogService, $this->errorLogService);
            }
        }
    }

    /**
     * Resolve email recipient details for notifications.
     *
     * @return array{email:string,name:string}|null
     */
    /**
     * @param array<int,array<string,mixed>> $records
     * @param array<string,mixed> $options
     */
    public function sendCarbonRecordReviewSummary(int $Silian_userId, string $Silian_action, array $Silian_records, ?string $Silian_reviewNote = null, array $Silian_options = []): void
    {
        if (empty($Silian_records)) {
            return;
        }

        $Silian_normalizedAction = strtolower(trim($Silian_action));
        if ($Silian_normalizedAction === 'approved') {
            $Silian_normalizedAction = 'approve';
        } elseif ($Silian_normalizedAction === 'rejected') {
            $Silian_normalizedAction = 'reject';
        }

        $Silian_isApprove = $Silian_normalizedAction === 'approve';
        $Silian_title = $Silian_isApprove ? '碳减排记录审核通过通知' : '碳减排记录审核结果';
        $Silian_type = $Silian_isApprove ? 'record_approved' : 'record_rejected';
        $Silian_priority = $Silian_isApprove ? Message::PRIORITY_HIGH : Message::PRIORITY_NORMAL;

        $Silian_lines = [];
        $Silian_lines[] = $Silian_isApprove
            ? '以下碳减排记录已通过审核：'
            : '以下碳减排记录未通过审核：';

        foreach ($Silian_records as $Silian_entry) {
            if (!is_array($Silian_entry)) {
                continue;
            }

            $Silian_activity = (string) ($Silian_entry['activity_name'] ?? '');
            if ($Silian_activity === '') {
                $Silian_activity = '未命名活动';
            }

            $Silian_value = $Silian_entry['data_value'] ?? null;
            $Silian_unit = $Silian_entry['unit'] ?? null;
            $Silian_carbon = $Silian_entry['carbon_saved'] ?? null;
            $Silian_points = $Silian_entry['points_earned'] ?? null;
            $Silian_date = $Silian_entry['date'] ?? null;

            $Silian_parts = [
                '活动：' . $Silian_activity,
            ];

            if ($Silian_value !== null && $Silian_value !== '') {
                $Silian_dataText = (string) $Silian_value;
                if ($Silian_unit !== null && $Silian_unit !== '') {
                    $Silian_dataText .= ' ' . $Silian_unit;
                }
                $Silian_parts[] = '数据：' . $Silian_dataText;
            }

            if ($Silian_carbon !== null && $Silian_carbon !== '') {
                $Silian_parts[] = '碳减排：' . (string) $Silian_carbon;
            }

            if ($Silian_points !== null && $Silian_points !== '') {
                $Silian_parts[] = '积分：' . (string) $Silian_points;
            }

            if ($Silian_date !== null && $Silian_date !== '') {
                $Silian_parts[] = '日期：' . (string) $Silian_date;
            }

            $Silian_lines[] = '- ' . implode('；', $Silian_parts);
        }

        if ($Silian_reviewNote) {
            $Silian_lines[] = '审核备注：' . $Silian_reviewNote;
        }
        if (!empty($Silian_options['reviewed_by'])) {
            $Silian_lines[] = '审核人：' . (string) $Silian_options['reviewed_by'];
        }

        $Silian_lines[] = '';
        $Silian_lines[] = $Silian_isApprove ? 'Approved records:' : 'Rejected records:';
        foreach ($Silian_records as $Silian_entry) {
            if (!is_array($Silian_entry)) {
                continue;
            }

            $Silian_activity = (string) ($Silian_entry['activity_name'] ?? '');
            if ($Silian_activity === '') {
                $Silian_activity = 'Unknown activity';
            }
            $Silian_value = $Silian_entry['data_value'] ?? null;
            $Silian_unit = $Silian_entry['unit'] ?? null;
            $Silian_points = $Silian_entry['points_earned'] ?? null;
            $Silian_date = $Silian_entry['date'] ?? null;

            $Silian_parts = ['Activity: ' . $Silian_activity];
            if ($Silian_value !== null && $Silian_value !== '') {
                $Silian_dataText = (string) $Silian_value;
                if ($Silian_unit !== null && $Silian_unit !== '') {
                    $Silian_dataText .= ' ' . $Silian_unit;
                }
                $Silian_parts[] = 'Data: ' . $Silian_dataText;
            }
            if ($Silian_points !== null && $Silian_points !== '') {
                $Silian_parts[] = 'Points: ' . (string) $Silian_points;
            }
            if ($Silian_date !== null && $Silian_date !== '') {
                $Silian_parts[] = 'Date: ' . (string) $Silian_date;
            }
            $Silian_lines[] = '- ' . implode(', ', $Silian_parts);
        }

        if ($Silian_reviewNote) {
            $Silian_lines[] = 'Review note: ' . $Silian_reviewNote;
        }
        if (!empty($Silian_options['reviewed_by'])) {
            $Silian_lines[] = 'Reviewer: ' . (string) $Silian_options['reviewed_by'];
        }

        $Silian_content = implode("
", $Silian_lines);

        $this->sendSystemMessage(
            $Silian_userId,
            $Silian_title,
            $Silian_content,
            $Silian_type,
            $Silian_priority,
            null,
            null,
            false
        );

        $this->dispatchCarbonRecordReviewSummaryEmail(
            $Silian_userId,
            $Silian_isApprove ? 'approve' : 'reject',
            $Silian_records,
            $Silian_title,
            $Silian_reviewNote,
            $Silian_options
        );
    }

    /**
     * @param array<int,array<string,mixed>> $records
     * @return array<int,array<string,mixed>>
     */
    private function sanitizeReviewSummaryRecords(array $Silian_records): array
    {
        $Silian_normalized = [];
        foreach ($Silian_records as $Silian_record) {
            if (!is_array($Silian_record)) {
                continue;
            }

            $Silian_entry = [
                'activity_name' => (string) ($Silian_record['activity_name'] ?? ''),
            ];

            if (isset($Silian_record['data_value']) && $Silian_record['data_value'] !== '') {
                $Silian_entry['data_value'] = $Silian_record['data_value'];
            }
            if (isset($Silian_record['unit']) && $Silian_record['unit'] !== '') {
                $Silian_entry['unit'] = (string) $Silian_record['unit'];
            }
            if (isset($Silian_record['carbon_saved']) && $Silian_record['carbon_saved'] !== '' && $Silian_record['carbon_saved'] !== null) {
                $Silian_entry['carbon_saved'] = (float) $Silian_record['carbon_saved'];
            }
            if (isset($Silian_record['points_earned']) && $Silian_record['points_earned'] !== '' && $Silian_record['points_earned'] !== null) {
                $Silian_entry['points_earned'] = (float) $Silian_record['points_earned'];
            }
            if (isset($Silian_record['date']) && $Silian_record['date'] !== '') {
                $Silian_entry['date'] = (string) $Silian_record['date'];
            }
            if (isset($Silian_record['review_note']) && $Silian_record['review_note'] !== null && $Silian_record['review_note'] !== '') {
                $Silian_entry['review_note'] = (string) $Silian_record['review_note'];
            }
            if (isset($Silian_record['activity_category']) && $Silian_record['activity_category'] !== '') {
                $Silian_entry['activity_category'] = (string) $Silian_record['activity_category'];
            }

            $Silian_normalized[] = $Silian_entry;
        }

        return $Silian_normalized;
    }

    private function dispatchCarbonRecordReviewSummaryEmail(int $Silian_userId, string $Silian_action, array $Silian_records, string $Silian_title, ?string $Silian_reviewNote, array $Silian_options): void
    {
        if ($this->emailService === null) {
            return;
        }

        $Silian_recipient = $this->resolveEmailRecipient(
            $Silian_userId,
            $Silian_options['fallback_email'] ?? null,
            $Silian_options['fallback_name'] ?? null
        );

        if ($Silian_recipient === null) {
            return;
        }

        $Silian_payload = [
            'user_id' => $Silian_userId,
            'email' => $Silian_recipient['email'],
            'name' => $Silian_recipient['name'],
            'action' => $Silian_action,
            'title' => $Silian_title,
            'records' => $this->sanitizeReviewSummaryRecords($Silian_records),
        ];

        if ($Silian_reviewNote !== null && $Silian_reviewNote !== '') {
            $Silian_payload['review_note'] = $Silian_reviewNote;
        }
        if (!empty($Silian_options['reviewed_by'])) {
            $Silian_payload['reviewed_by'] = (string) $Silian_options['reviewed_by'];
        }
        if (!empty($Silian_options['reviewed_by_id'])) {
            $Silian_payload['reviewed_by_id'] = (int) $Silian_options['reviewed_by_id'];
        }

        $this->dispatchEmail('carbon_record_review_summary', $Silian_payload);
    }

    private function resolveEmailRecipient(int $Silian_userId, ?string $Silian_fallbackEmail = null, ?string $Silian_fallbackName = null): ?array
    {
        if ($Silian_userId > 0 && $this->userResolver !== null) {
            try {
                $Silian_resolved = call_user_func($this->userResolver, $Silian_userId);
                if ($Silian_resolved instanceof User && !empty($Silian_resolved->email)) {
                    $Silian_name = $Silian_resolved->getDisplayName() ?: (string) $Silian_resolved->email;
                    return [
                        'email' => (string) $Silian_resolved->email,
                        'name' => $Silian_name,
                    ];
                }
            } catch (\Throwable $Silian_e) {
                $this->logger->warning('Failed to resolve receiver for email notification', [
                    'receiver_id' => $Silian_userId,
                    'error' => $Silian_e->getMessage(),
                ]);
            }
        }

        if ($Silian_userId > 0) {
            try {
                $Silian_user = User::query()->find($Silian_userId);
                if ($Silian_user instanceof User && !empty($Silian_user->email)) {
                    $Silian_name = $Silian_user->getDisplayName() ?: (string) $Silian_user->email;
                    return [
                        'email' => (string) $Silian_user->email,
                        'name' => $Silian_name,
                    ];
                }
            } catch (\Throwable $Silian_e) {
                $this->logger->warning('Failed to load user for email notification', [
                    'receiver_id' => $Silian_userId,
                    'error' => $Silian_e->getMessage(),
                ]);
            }
        }

        if ($Silian_fallbackEmail !== null && $Silian_fallbackEmail !== '') {
            return [
                'email' => $Silian_fallbackEmail,
                'name' => $Silian_fallbackName && $Silian_fallbackName !== '' ? $Silian_fallbackName : $Silian_fallbackEmail,
            ];
        }

        return null;
    }

    public function sendExchangeConfirmationEmailToUser(
        int $Silian_userId,
        string $Silian_productName,
        int $Silian_quantity,
        float $Silian_pointsSpent,
        ?string $Silian_fallbackEmail = null,
        ?string $Silian_fallbackName = null
    ): void {
        if ($this->emailService === null) {
            return;
        }

        $Silian_recipient = $this->resolveEmailRecipient($Silian_userId, $Silian_fallbackEmail, $Silian_fallbackName);
        if ($Silian_recipient === null) {
            return;
        }

        $this->dispatchEmail('exchange_confirmation', [
            'user_id' => $Silian_userId,
            'email' => $Silian_recipient['email'],
            'name' => $Silian_recipient['name'],
            'product_name' => $Silian_productName,
            'quantity' => $Silian_quantity,
            'points_spent' => $Silian_pointsSpent,
        ]);
    }

    public function sendExchangeStatusUpdateEmailToUser(
        int $Silian_userId,
        string $Silian_productName,
        string $Silian_status,
        ?string $Silian_trackingNumber = null,
        ?string $Silian_adminNotes = null,
        ?string $Silian_fallbackEmail = null,
        ?string $Silian_fallbackName = null
    ): void {
        if ($this->emailService === null) {
            return;
        }

        $Silian_recipient = $this->resolveEmailRecipient($Silian_userId, $Silian_fallbackEmail, $Silian_fallbackName);
        if ($Silian_recipient === null) {
            return;
        }

        $Silian_noteParts = [];
        if ($Silian_trackingNumber !== null && $Silian_trackingNumber !== '') {
            $Silian_noteParts[] = 'Tracking number: ' . $Silian_trackingNumber;
        }
        if ($Silian_adminNotes !== null && $Silian_adminNotes !== '') {
            $Silian_noteParts[] = $Silian_adminNotes;
        }
        $Silian_combinedNotes = implode("\n", $Silian_noteParts);

        $this->dispatchEmail('exchange_status_update', [
            'user_id' => $Silian_userId,
            'email' => $Silian_recipient['email'],
            'name' => $Silian_recipient['name'],
            'product_name' => $Silian_productName,
            'status' => $Silian_status,
            'notes' => $Silian_combinedNotes,
        ]);
    }

    private function resolveNotificationCategory(string $Silian_type): string
    {
        $Silian_key = strtolower(trim($Silian_type));
        if ($Silian_key === '') {
            return NotificationPreferenceService::CATEGORY_SYSTEM;
        }

        if (isset(self::TYPE_CATEGORY_MAP[$Silian_key])) {
            return self::TYPE_CATEGORY_MAP[$Silian_key];
        }

        return NotificationPreferenceService::CATEGORY_SYSTEM;
    }

    private function buildEmailSubject(string $Silian_title, string $Silian_priority): string
    {
        $Silian_prefix = '';
        switch ($Silian_priority) {
            case Message::PRIORITY_URGENT:
                $Silian_prefix = '[URGENT] ';
                break;
            case Message::PRIORITY_HIGH:
                $Silian_prefix = '[HIGH] ';
                break;
        }

        return $Silian_prefix . $Silian_title;
    }

    private function sendActivityApprovedEmail(?User $Silian_user, $Silian_activity, $Silian_transaction): void
    {
        if ($this->emailService === null || !$Silian_user || empty($Silian_user->email)) {
            return;
        }

        $Silian_activityName = '';
        if (is_object($Silian_activity) && method_exists($Silian_activity, 'getCombinedName')) {
            $Silian_activityName = (string) $Silian_activity->getCombinedName();
        } elseif (is_array($Silian_activity)) {
            $Silian_activityName = (string) ($Silian_activity['name'] ?? '');
        } elseif (is_object($Silian_activity) && isset($Silian_activity->name)) {
            $Silian_activityName = (string) $Silian_activity->name;
        }
        $Silian_points = is_array($Silian_transaction) ? ($Silian_transaction['points'] ?? 0) : ($Silian_transaction->points ?? 0);

        $this->dispatchEmail('activity_approved_notification', [
            'user_id' => $Silian_user->id ?? null,
            'email' => (string) $Silian_user->email,
            'name' => $Silian_user->getDisplayName() ?: (string) $Silian_user->email,
            'activity_name' => (string) $Silian_activityName,
            'points' => (float) $Silian_points,
        ]);
    }

    private function sendActivityRejectedEmail(?User $Silian_user, $Silian_activity, ?string $Silian_reason): void
    {
        if ($this->emailService === null || !$Silian_user || empty($Silian_user->email)) {
            return;
        }

        $Silian_activityName = '';
        if (is_object($Silian_activity) && method_exists($Silian_activity, 'getCombinedName')) {
            $Silian_activityName = (string) $Silian_activity->getCombinedName();
        } elseif (is_array($Silian_activity)) {
            $Silian_activityName = (string) ($Silian_activity['name'] ?? '');
        } elseif (is_object($Silian_activity) && isset($Silian_activity->name)) {
            $Silian_activityName = (string) $Silian_activity->name;
        }
        $Silian_reasonText = $Silian_reason ?? 'See in-app notification for details.';

        $this->dispatchEmail('activity_rejected_notification', [
            'user_id' => $Silian_user->id ?? null,
            'email' => (string) $Silian_user->email,
            'name' => $Silian_user->getDisplayName() ?: (string) $Silian_user->email,
            'activity_name' => (string) $Silian_activityName,
            'reason' => (string) $Silian_reasonText,
        ]);
    }

    private function sendExchangeConfirmationEmail(?User $Silian_user, $Silian_product, int $Silian_quantity, float $Silian_pointsSpent): void
    {
        if ($this->emailService === null || !$Silian_user || empty($Silian_user->email)) {
            return;
        }

        $Silian_productName = '';
        if (is_object($Silian_product)) {
            $Silian_productName = (string) ($Silian_product->name ?? '');
        } elseif (is_array($Silian_product)) {
            $Silian_productName = (string) ($Silian_product['name'] ?? '');
        }

        try {
            $this->emailService->sendExchangeConfirmation(
                (string) $Silian_user->email,
                $Silian_user->getDisplayName() ?: (string) $Silian_user->email,
                $Silian_productName,
                $Silian_quantity,
                $Silian_pointsSpent
            );
        } catch (\Throwable $Silian_e) {
            $this->logger->warning('Failed to send exchange confirmation email', [
                'user_id' => $Silian_user->id ?? null,
                'error' => $Silian_e->getMessage(),
            ]);
        }
    }
}


