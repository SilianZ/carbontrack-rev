<?php

declare(strict_types=1);

namespace CarbonTrack\Models;

use Illuminate\Database\Eloquent\Model;

class UserGroup extends Model
{
    protected $table = 'user_groups';

    protected $fillable = [
        'name',
        'code',
        'config',
        'is_default',
        'notes'
    ];

    protected $casts = [
        'config' => 'array',
        'is_default' => 'boolean'
    ];

    public $timestamps = true;

    /**
     * Get users in this group
     */
    public function users()
    {
        return $this->hasMany(User::class, 'group_id');
    }

    /**
     * Get quota config for a resource (with defaults)
     */
    public function getQuotaConfig(string $Silian_resource): array
    {
        $Silian_config = $this->config ?? [];
        return $Silian_config[$Silian_resource] ?? [];
    }
}
