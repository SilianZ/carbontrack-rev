<?php

declare(strict_types=1);

namespace CarbonTrack\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use DateTimeImmutable;

class Message extends Model
{
    use SoftDeletes;

    protected $table = 'messages';

    protected $fillable = [
        'sender_id',
        'receiver_id',
        'title',
        'content',
        'is_read',
        'priority',
        // Following columns are not present in localhost.sql schema and must not be mass-assigned:
        // 'type', 'read_at', 'related_entity_type', 'related_entity_id'
    ];

    protected $casts = [
        'is_read' => 'boolean',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime'
    ];

    protected $dates = ['deleted_at'];

    public $timestamps = true;

    // Message types
    const TYPE_SYSTEM = 'system';
    const TYPE_NOTIFICATION = 'notification';
    const TYPE_APPROVAL = 'approval';
    const TYPE_REJECTION = 'rejection';
    const TYPE_EXCHANGE = 'exchange';
    const TYPE_WELCOME = 'welcome';
    const TYPE_REMINDER = 'reminder';

    // Priority levels
    const PRIORITY_LOW = 'low';
    const PRIORITY_NORMAL = 'normal';
    const PRIORITY_HIGH = 'high';
    const PRIORITY_URGENT = 'urgent';

    /**
     * Get the sender of the message
     */
    public function sender()
    {
        return $this->belongsTo(User::class, 'sender_id');
    }

    /**
     * Get the receiver of the message
     */
    public function receiver()
    {
        return $this->belongsTo(User::class, 'receiver_id');
    }

    /**
     * Scope to get unread messages
     */
    public function scopeUnread($Silian_query)
    {
        return $Silian_query->where('is_read', false);
    }

    /**
     * Scope to get read messages
     */
    public function scopeRead($Silian_query)
    {
        return $Silian_query->where('is_read', true);
    }

    /**
     * Scope to get messages by type
     */
    public function scopeByType($Silian_query, string $Silian_type)
    {
        // 'type' column not available in provided schema; no-op filter for compatibility
        return $Silian_query;
    }

    /**
     * Scope to get messages by priority
     */
    public function scopeByPriority($Silian_query, string $Silian_priority)
    {
        return $Silian_query->where('priority', $Silian_priority);
    }

    /**
     * Scope to get messages for a specific user (received)
     */
    public function scopeForUser($Silian_query, int $Silian_userId)
    {
        return $Silian_query->where('receiver_id', $Silian_userId);
    }

    /**
     * Scope to get messages sent by a specific user
     */
    public function scopeFromUser($Silian_query, int $Silian_userId)
    {
        return $Silian_query->where('sender_id', $Silian_userId);
    }

    /**
     * Scope to get recent messages (within specified days)
     */
    public function scopeRecent($Silian_query, int $Silian_days = 30)
    {
        $Silian_threshold = (new DateTimeImmutable("now"))->modify("-{$Silian_days} days")->format('Y-m-d H:i:s');
        return $Silian_query->where('created_at', '>', $Silian_threshold);
    }

    /**
     * Mark message as read
     */
    public function markAsRead(): void
    {
        if (!$this->is_read) {
            $this->update([
                'is_read' => true,
            ]);
        }
    }

    /**
     * Mark message as unread
     */
    public function markAsUnread(): void
    {
        if ($this->is_read) {
            $this->update([
                'is_read' => false,
            ]);
        }
    }

    /**
     * Check if message is high priority
     */
    public function isHighPriority(): bool
    {
        if (!$this->priorityColumnExists()) {
            return false;
        }

        $Silian_value = $this->getAttribute('priority');
        if ($Silian_value === null) {
            return false;
        }

        return in_array($Silian_value, [self::PRIORITY_HIGH, self::PRIORITY_URGENT], true);
    }

    /**
     * Check if message is system message
     */
    public function isSystemMessage(): bool
    {
        // Without 'type' column, treat null sender as system message
        return $this->sender_id === null;
    }

    /**
     * Get message age in human readable format
     */
    public function getAgeAttribute(): string
    {
        return $this->created_at->diffForHumans();
    }

    /**
     * Get related entity (if any)
     */
    public function getRelatedEntity()
    {
        // Related entity columns are not available in the provided DB schema
        return null;
    }

    /**
     * Create a system message
     */
    public static function createSystemMessage(
        int $Silian_receiverId,
        string $Silian_title,
        string $Silian_content,
        string $Silian_type = self::TYPE_SYSTEM,
        string $Silian_priority = self::PRIORITY_NORMAL,
        ?string $Silian_relatedEntityType = null,
        ?int $Silian_relatedEntityId = null
    ): self {
        // The provided DB schema (localhost.sql) does not include 'type', 'priority', 'related_entity_*', or 'read_at'.
        // We store a minimal message compatible with that schema.
        $Silian_data = [
            'sender_id' => null, // System message
            'receiver_id' => $Silian_receiverId,
            'title' => $Silian_title,
            'content' => $Silian_content,
            'is_read' => false
        ];

        if (static::priorityColumnExistsStatic()) {
            $Silian_data['priority'] = in_array($Silian_priority, self::getValidPriorities(), true)
                ? $Silian_priority
                : self::PRIORITY_NORMAL;
        }

        return static::create($Silian_data);
    }

    /**
     * Determine if the priority column exists for the current table (instance context).
     */
    protected function priorityColumnExists(): bool
    {
        return true;
    }

    /**
     * Determine if the priority column exists for the current table (static context).
     */
    protected static function priorityColumnExistsStatic(): bool
    {
        return true;
    }

    /**
     * Create a notification message
     */
    public static function createNotification(
        int $Silian_receiverId,
        string $Silian_title,
        string $Silian_content,
        string $Silian_priority = self::PRIORITY_NORMAL,
        ?string $Silian_relatedEntityType = null,
        ?int $Silian_relatedEntityId = null
    ): self {
        return static::createSystemMessage(
            $Silian_receiverId,
            $Silian_title,
            $Silian_content,
            self::TYPE_NOTIFICATION,
            $Silian_priority,
            $Silian_relatedEntityType,
            $Silian_relatedEntityId
        );
    }

    /**
     * Create an approval notification
     */
    public static function createApprovalNotification(
        int $Silian_receiverId,
        string $Silian_title,
        string $Silian_content,
        ?string $Silian_relatedEntityType = null,
        ?int $Silian_relatedEntityId = null
    ): self {
        return static::createSystemMessage(
            $Silian_receiverId,
            $Silian_title,
            $Silian_content,
            self::TYPE_APPROVAL,
            self::PRIORITY_HIGH,
            $Silian_relatedEntityType,
            $Silian_relatedEntityId
        );
    }

    /**
     * Create a rejection notification
     */
    public static function createRejectionNotification(
        int $Silian_receiverId,
        string $Silian_title,
        string $Silian_content,
        ?string $Silian_relatedEntityType = null,
        ?int $Silian_relatedEntityId = null
    ): self {
        return static::createSystemMessage(
            $Silian_receiverId,
            $Silian_title,
            $Silian_content,
            self::TYPE_REJECTION,
            self::PRIORITY_HIGH,
            $Silian_relatedEntityType,
            $Silian_relatedEntityId
        );
    }

    /**
     * Create an exchange notification
     */
    public static function createExchangeNotification(
        int $Silian_receiverId,
        string $Silian_title,
        string $Silian_content,
        ?string $Silian_relatedEntityType = null,
        ?int $Silian_relatedEntityId = null
    ): self {
        return static::createSystemMessage(
            $Silian_receiverId,
            $Silian_title,
            $Silian_content,
            self::TYPE_EXCHANGE,
            self::PRIORITY_NORMAL,
            $Silian_relatedEntityType,
            $Silian_relatedEntityId
        );
    }

    /**
     * Create a welcome message
     */
    public static function createWelcomeMessage(int $Silian_receiverId): self
    {
        $Silian_title = '欢迎加入CarbonTrack! / Welcome to CarbonTrack!';
        $Silian_content = "亲爱的用户，欢迎加入CarbonTrack碳减排追踪平台！\n\n" .
                  "在这里，您可以：\n" .
                  "• 记录您的碳减排活动\n" .
                  "• 获得碳减排积分\n" .
                  "• 兑换环保商品\n" .
                  "• 查看您的环保贡献\n\n" .
                  "让我们一起为地球环保贡献力量！\n\n" .
                  "Dear user, welcome to CarbonTrack!\n\n" .
                  "Here you can:\n" .
                  "• Record your carbon reduction activities\n" .
                  "• Earn carbon reduction points\n" .
                  "• Exchange for eco-friendly products\n" .
                  "• View your environmental contributions\n\n" .
                  "Let's work together for a greener planet!";

        return static::createSystemMessage(
            $Silian_receiverId,
            $Silian_title,
            $Silian_content,
            self::TYPE_WELCOME,
            self::PRIORITY_NORMAL
        );
    }

    /**
     * Get message statistics for a user
     */
    public static function getStatisticsForUser(int $Silian_userId): array
    {
        $Silian_total = static::forUser($Silian_userId)->count();
        $Silian_unread = static::forUser($Silian_userId)->unread()->count();
        $Silian_read = static::forUser($Silian_userId)->read()->count();

        return [
            'total' => $Silian_total,
            'unread' => $Silian_unread,
            'read' => $Silian_read,
            'by_type' => [],
            'by_priority' => []
        ];
    }

    /**
     * Clean up old read messages
     */
    public static function cleanupOldMessages(int $Silian_daysToKeep = 90): int
    {
        $Silian_threshold = (new DateTimeImmutable("now"))->modify("-{$Silian_daysToKeep} days")->format('Y-m-d H:i:s');
        return (int) static::where('is_read', true)
            ->where('created_at', '<', $Silian_threshold)
            ->delete();
    }

    /**
     * Get valid message types
     */
    public static function getValidTypes(): array
    {
        return [
            self::TYPE_SYSTEM,
            self::TYPE_NOTIFICATION,
            self::TYPE_APPROVAL,
            self::TYPE_REJECTION,
            self::TYPE_EXCHANGE,
            self::TYPE_WELCOME,
            self::TYPE_REMINDER
        ];
    }

    /**
     * Get valid priority levels
     */
    public static function getValidPriorities(): array
    {
        return [
            self::PRIORITY_LOW,
            self::PRIORITY_NORMAL,
            self::PRIORITY_HIGH,
            self::PRIORITY_URGENT
        ];
    }
}
