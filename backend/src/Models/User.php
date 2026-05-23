<?php

declare(strict_types=1);

namespace CarbonTrack\Models;

use DateTimeImmutable;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use CarbonTrack\Models\UserGroup;

class User extends Model
{
    use SoftDeletes;

    protected $table = 'users';

    protected $fillable = [
        'id',
        'uuid',
        'username',
        'email',
        'password',
        'role',
        'status',
        'points',
        'school_id',
        'school',
        'region_code',
        'location',
        'is_admin',
        'avatar_id',
        'lastlgn',
        'notification_email_mask',
        'group_id',
        'quota_override',
        'admin_notes'
    ];

    protected $hidden = [
        'password'
    ];

    protected $casts = [
        'points' => 'decimal:2',
        'is_admin' => 'boolean',
        'lastlgn' => 'datetime',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime',
        'notification_email_mask' => 'integer',
        'quota_override' => 'array'
    ];

    protected $dates = ['deleted_at'];

    public $timestamps = true;

    /**
     * Create user from array data (for testing)
     */
    public function __construct(array $Silian_attributes = [])
    {
        parent::__construct($Silian_attributes);

        // Set attributes directly for testing
        foreach ($Silian_attributes as $Silian_key => $Silian_value) {
            if (in_array($Silian_key, $this->fillable)) {
                $this->attributes[$Silian_key] = $Silian_value;
            }
        }
    }

    /**
     * Get user ID
     */
    public function getId(): ?int
    {
        return $this->id;
    }

    /**
     * Get username
     */
    public function getUsername(): ?string
    {
        return $this->username;
    }

    /**
     * Get email
     */
    public function getEmail(): ?string
    {
        return $this->email;
    }

    // real_name 字段已废弃，不再提供访问方法


    /**
     * Get role
     */
    public function getRole(): string
    {
        if ($this->is_admin) {
            return 'admin';
        }

        return $this->role ?? 'user';
    }

    /**
     * Get status
     */
    public function getStatus(): string
    {
        return $this->status ?? 'active';
    }

    /**
     * Get points
     */
    public function getPoints(): float
    {
        return (float) $this->points;
    }

    /**
     * Convert to array (excluding sensitive data)
     */
    public function toArray(): array
    {
        $Silian_array = parent::toArray();
        unset($Silian_array['password']);
        // 安全隐藏已弃用或潜在敏感字段（数据库仍然可能存在列，但接口不暴露）
        unset($Silian_array['real_name'], $Silian_array['class_name']);
        return $Silian_array;
    }

    /**
     * Check if user is admin
     */
    public function isAdmin(): bool
    {
        return $this->getRole() === 'admin';
    }

    public function isSupport(): bool
    {
        return in_array($this->getRole(), ['support', 'admin'], true);
    }

    /**
     * Check if user is active
     */
    public function isActive(): bool
    {
        return $this->getStatus() === 'active';
    }

    /**
     * Check if user has sufficient points
     */
    public function hasSufficientPoints(float $Silian_requiredPoints): bool
    {
        return $this->getPoints() >= $Silian_requiredPoints;
    }

    /**
     * Add points to user
     */
    public function addPoints(float $Silian_points): void
    {
        if ($Silian_points > 0) {
            $this->points = $this->getPoints() + $Silian_points;
        }
    }

    /**
     * Subtract points from user
     */
    public function subtractPoints(float $Silian_points): bool
    {
        if ($this->hasSufficientPoints($Silian_points)) {
            $this->points = $this->getPoints() - $Silian_points;
            return true;
        }
        return false;
    }

    /**
     * Get display name
     */
    public function getDisplayName(): string
    {
        return $this->getUsername();
    }

    /**
     * Validate user data
     */
    public function isValid(): bool
    {
        return empty($this->getValidationErrors());
    }

    /**
     * Get validation errors
     */
    public function getValidationErrors(): array
    {
        $Silian_errors = [];

        if (empty($this->username)) {
            $Silian_errors[] = 'Username is required';
        }

        if (empty($this->email)) {
            $Silian_errors[] = 'Email is required';
        } elseif (!filter_var($this->email, FILTER_VALIDATE_EMAIL)) {
            $Silian_errors[] = 'Invalid email format';
        }

        $Silian_validRoles = ['user', 'support', 'admin'];
        if (!in_array($this->getRole(), $Silian_validRoles)) {
            $Silian_errors[] = 'Invalid role';
        }

        $Silian_validStatuses = ['active', 'inactive', 'suspended'];
        if (!in_array($this->getStatus(), $Silian_validStatuses)) {
            $Silian_errors[] = 'Invalid status';
        }

        return $Silian_errors;
    }

    /**
     * Get the user's points transactions
     */
    public function pointsTransactions()
    {
        return $this->hasMany(PointsTransaction::class, 'uid');
    }

    /**
     * Get the user's exchange transactions
     */
    public function exchangeTransactions()
    {
        return $this->hasMany(ExchangeTransaction::class, 'user_id');
    }

    /**
     * Get messages sent by this user
     */
    public function sentMessages()
    {
        return $this->hasMany(Message::class, 'sender_id');
    }

    /**
     * Get messages received by this user
     */
    public function receivedMessages()
    {
        return $this->hasMany(Message::class, 'receiver_id');
    }

    /**
     * Get the canonical school relation.
     * Display values should still be resolved via UserProfileViewService.
     */
    public function schoolInfo()
    {
        return $this->belongsTo(School::class, 'school_id');
    }

    /**
     * Get audit logs for this user
     */
    public function auditLogs()
    {
        return $this->hasMany(AuditLog::class, 'user_id');
    }

    /**
     * Scope to get active users only
     */
    public function scopeActive($Silian_query)
    {
        return $Silian_query->where('status', 'active');
    }

    /**
     * Scope to get admin users only
     */
    public function scopeAdmins($Silian_query)
    {
        return $Silian_query->where('is_admin', true);
    }

    public function scopeSupport($Silian_query)
    {
        return $Silian_query->where(function ($Silian_builder) {
            $Silian_builder->where('is_admin', true)->orWhere('role', 'support');
        });
    }

    /**
     * Update last login time
     */
    public function updateLastLogin(): void
    {
        $this->update(['lastlgn' => new DateTimeImmutable()]);
    }

    /**
     * Get unread messages count
     */
    public function getUnreadMessagesCount(): int
    {
        return $this->receivedMessages()
            ->where('is_read', false)
            ->whereNull('deleted_at')
            ->count();
    }

    /**
     * Get the user's group
     */
    public function group()
    {
        return $this->belongsTo(UserGroup::class, 'group_id');
    }
}
