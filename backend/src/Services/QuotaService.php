<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Models\User;
use CarbonTrack\Models\UserUsageStats;
use Illuminate\Support\Carbon;

class QuotaService
{
    /**
     * Check if a user can consume a resource and consume it if allowed.
     * Supports two types of limits: 'daily_limit' (quota) and 'rate_limit' (token bucket).
     *
     * @param User $user
     * @param string $resource e.g., 'llm'
     * @param int $cost
     * @return bool
     * @throws \Exception
     */
    public function checkAndConsume(User $Silian_user, string $Silian_resource, int $Silian_cost = 1): bool
    {
        // 1. Get Effective Config
        $Silian_config = $this->getEffectiveConfig($Silian_user, $Silian_resource);

        // If no config found, assume allowed (or blocked depending on policy).
        // Let's assume blocked if empty to be safe, or allow strictly if explicit.
        if (empty($Silian_config)) {
            return false; // No quota configured = No access
        }

        // 2. Check Daily Limit (Quota)
        if (isset($Silian_config['daily_limit'])) {
            $Silian_maxDaily = (int)$Silian_config['daily_limit'];
            if (!$this->checkDailyQuota($Silian_user->id, $Silian_resource, $Silian_maxDaily, $Silian_cost)) {
                return false;
            }
        }

        // 2b. Check Monthly Limit (Quota)
        if (isset($Silian_config['monthly_limit'])) {
            $Silian_maxMonthly = (int)$Silian_config['monthly_limit'];
            if (!$this->checkMonthlyQuota($Silian_user->id, $Silian_resource, $Silian_maxMonthly, $Silian_cost)) {
                return false;
            }
        }

        // 3. Check Rate Limit (Token Bucket)
        // 'rate_limit' represents tokens added per minute, or capacity.
        // Let's assume 'rate_limit' = max burst capacity AND refill rate per minute for simplicity,
        // or we can strictly follow standard token bucket params if config allows.
        // config: { "rate_limit": 60 } -> 60 requests per minute.
        if (isset($Silian_config['rate_limit'])) {
            $Silian_ratePerMinute = (float)$Silian_config['rate_limit'];
            if (!$this->checkTokenBucket($Silian_user->id, $Silian_resource, $Silian_ratePerMinute, $Silian_cost)) {
                return false;
            }
        }

        return true;
    }

    public function getEffectiveConfig(User $Silian_user, string $Silian_resource): array
    {
        // 1. Group Config
        $Silian_group = $Silian_user->group;
        $Silian_groupConfig = $Silian_group ? $Silian_group->getQuotaConfig($Silian_resource) : [];

        // 2. User Override
        $Silian_userOverride = $Silian_user->quota_override[$Silian_resource] ?? [];

        // Merge: User overrides keys in group
        return array_merge($Silian_groupConfig, $Silian_userOverride);
    }

    private function checkDailyQuota(int $Silian_userId, string $Silian_resource, int $Silian_limit, int $Silian_cost): bool
    {
        $Silian_key = "{$Silian_resource}_daily";
        $Silian_stats = UserUsageStats::where('user_id', $Silian_userId)
            ->where('resource_key', $Silian_key)
            ->first();

        $Silian_now = Carbon::now();
        $Silian_resetAt = $this->toCarbon($Silian_stats?->reset_at);
        $Silian_counter = (float)($Silian_stats?->counter ?? 0);

        // Reset if needed (new day)
        if (!$Silian_resetAt || $Silian_now >= $Silian_resetAt) {
            $Silian_counter = 0;
            // Set next reset to tomorrow 00:00:00
            $Silian_resetAt = $Silian_now->copy()->addDay()->startOfDay();
        }

        if (($Silian_counter + $Silian_cost) > $Silian_limit) {
            return false;
        }

        $Silian_counter += $Silian_cost;
        $this->persistUsageStats($Silian_userId, $Silian_key, $Silian_counter, $Silian_now, $Silian_resetAt);

        return true;
    }

    private function checkMonthlyQuota(int $Silian_userId, string $Silian_resource, int $Silian_limit, int $Silian_cost): bool
    {
        $Silian_key = "{$Silian_resource}_monthly";
        $Silian_stats = UserUsageStats::where('user_id', $Silian_userId)
            ->where('resource_key', $Silian_key)
            ->first();

        $Silian_now = Carbon::now();
        $Silian_resetAt = $this->toCarbon($Silian_stats?->reset_at);
        $Silian_counter = (float)($Silian_stats?->counter ?? 0);

        // Reset if needed (new month)
        if (!$Silian_resetAt || $Silian_now >= $Silian_resetAt) {
            $Silian_counter = 0;
            $Silian_resetAt = $Silian_now->copy()->addMonthNoOverflow()->startOfMonth();
        }

        if (($Silian_counter + $Silian_cost) > $Silian_limit) {
            return false;
        }

        $Silian_counter += $Silian_cost;
        $this->persistUsageStats($Silian_userId, $Silian_key, $Silian_counter, $Silian_now, $Silian_resetAt);

        return true;
    }

    /**
     * Token Bucket implementation backed by SQL
     */
    private function checkTokenBucket(int $Silian_userId, string $Silian_resource, float $Silian_ratePerMinute, int $Silian_cost): bool
    {
        $Silian_key = "{$Silian_resource}_bucket";
        $Silian_stats = UserUsageStats::where('user_id', $Silian_userId)
            ->where('resource_key', $Silian_key)
            ->first();

        $Silian_capacity = $Silian_ratePerMinute; // Bucket size = rate (1 minute burst)
        $Silian_now = Carbon::now();

        $Silian_lastUpdate = $this->toCarbon($Silian_stats?->last_updated_at) ?? $Silian_now;
        $Silian_secondsPassed = max(0, $Silian_now->getTimestamp() - $Silian_lastUpdate->getTimestamp());
        $Silian_tokensToAdd = ($Silian_secondsPassed / 60) * $Silian_ratePerMinute;

        $Silian_currentTokens = $Silian_stats ? (float)$Silian_stats->counter : $Silian_capacity;
        $Silian_newTokens = min($Silian_capacity, $Silian_currentTokens + $Silian_tokensToAdd);

        if ($Silian_newTokens < $Silian_cost) {
            // Need to save the refill even if failed?
            // Yes, to update timestamp so we don't grant "phantom" tokens next time due to long time gap
            $this->persistUsageStats($Silian_userId, $Silian_key, $Silian_newTokens, $Silian_now, $Silian_stats?->reset_at);
            return false;
        }

        // Consume
        $this->persistUsageStats($Silian_userId, $Silian_key, $Silian_newTokens - $Silian_cost, $Silian_now, $Silian_stats?->reset_at);

        return true;
    }

    /**
     * Normalize database date values (string or Carbon) to Carbon instances.
     */
    private function toCarbon($Silian_value): ?Carbon
    {
        if ($Silian_value instanceof \DateTimeInterface) {
            return Carbon::instance($Silian_value);
        }

        if (is_string($Silian_value) && $Silian_value !== '') {
            return Carbon::parse($Silian_value);
        }

        return null;
    }

    private function persistUsageStats(int $Silian_userId, string $Silian_resourceKey, float $Silian_counter, Carbon $Silian_timestamp, $Silian_resetAt): void
    {
        $Silian_reset = $this->toCarbon($Silian_resetAt);

        UserUsageStats::query()->updateOrInsert(
            ['user_id' => $Silian_userId, 'resource_key' => $Silian_resourceKey],
            [
                'counter' => $Silian_counter,
                'last_updated_at' => $Silian_timestamp->toDateTimeString(),
                'reset_at' => $Silian_reset ? $Silian_reset->toDateTimeString() : null,
            ]
        );
    }
}
