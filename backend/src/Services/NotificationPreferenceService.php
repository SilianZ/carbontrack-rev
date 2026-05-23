<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Models\User;
use CarbonTrack\Support\SyntheticRequestFactory;
use Monolog\Logger;

class NotificationPreferenceService
{
    public const CATEGORY_VERIFICATION = 'verification';
    public const CATEGORY_SECURITY = 'security';
    public const CATEGORY_SYSTEM = 'system';
    public const CATEGORY_TRANSACTION = 'transaction';
    public const CATEGORY_ACTIVITY = 'activity';
    public const CATEGORY_ANNOUNCEMENT = 'announcement';
    public const CATEGORY_MESSAGE = 'message';
    public const CATEGORY_SUPPORT = 'support';

    /**
     * @var array<string, array{label:string, locked:bool}>
     */
    private const CATEGORY_DEFINITIONS = [
        self::CATEGORY_VERIFICATION => ['label' => 'Account verification', 'locked' => true],
        self::CATEGORY_SECURITY => ['label' => 'Security alerts', 'locked' => true],
        self::CATEGORY_SYSTEM => ['label' => 'System updates', 'locked' => false],
        self::CATEGORY_TRANSACTION => ['label' => 'Point exchanges', 'locked' => false],
        self::CATEGORY_ACTIVITY => ['label' => 'Activity reviews', 'locked' => false],
        self::CATEGORY_ANNOUNCEMENT => ['label' => 'Announcements', 'locked' => false],
        self::CATEGORY_MESSAGE => ['label' => 'Direct messages', 'locked' => true],
        self::CATEGORY_SUPPORT => ['label' => 'Support tickets', 'locked' => false],
    ];

    /**
     * Bitmask mapping for optional categories (1 bit = category disabled).
     * Locked categories must not appear here.
     *
     * @var array<string,int>
     */
    private const CATEGORY_BITMASKS = [
        self::CATEGORY_SYSTEM => 1 << 0,
        self::CATEGORY_TRANSACTION => 1 << 1,
        self::CATEGORY_ACTIVITY => 1 << 2,
        self::CATEGORY_ANNOUNCEMENT => 1 << 3,
        self::CATEGORY_SUPPORT => 1 << 4,
    ];

    /**
     * @var array<int,int>
     */
    private array $maskCache = [];
    /**
     * @var array<string, int>
     */
    private array $userIdByEmailCache = [];

    private Logger $logger;
    private ?AuditLogService $auditLogService;
    private ?ErrorLogService $errorLogService;

    public function __construct(Logger $Silian_logger, ?AuditLogService $Silian_auditLogService = null, ?ErrorLogService $Silian_errorLogService = null)
    {
        $this->logger = $Silian_logger;
        $this->auditLogService = $Silian_auditLogService;
        $this->errorLogService = $Silian_errorLogService;
    }

    /**
     * @return array<string, array{label:string, locked:bool}>
     */
    public function allCategories(): array
    {
        return self::CATEGORY_DEFINITIONS;
    }

    /**
     * @return array<int, array{category:string,label:string,locked:bool,email_enabled:bool}>
     */
    public function getPreferencesForUser(int $Silian_userId): array
    {
        $Silian_mask = $this->getMaskForUser($Silian_userId);

        $Silian_result = [];
        foreach (self::CATEGORY_DEFINITIONS as $Silian_category => $Silian_meta) {
            $Silian_emailEnabled = true;
            if (!$Silian_meta['locked'] && isset(self::CATEGORY_BITMASKS[$Silian_category])) {
                $Silian_emailEnabled = ($Silian_mask & self::CATEGORY_BITMASKS[$Silian_category]) === 0;
            }

            $Silian_result[] = [
                'category' => $Silian_category,
                'label' => $Silian_meta['label'],
                'locked' => $Silian_meta['locked'],
                'email_enabled' => $Silian_meta['locked'] ? true : $Silian_emailEnabled,
            ];
        }

        return $Silian_result;
    }

    /**
     * @param array<int, array{category:string,email_enabled:bool}> $preferences
     */
    public function updatePreferences(int $Silian_userId, array $Silian_preferences): void
    {
        $Silian_currentMask = $this->getMaskForUser($Silian_userId);
        $Silian_updatedMask = $Silian_currentMask;

        foreach ($Silian_preferences as $Silian_entry) {
            $Silian_category = (string) ($Silian_entry['category'] ?? '');
            if (!$this->isValidCategory($Silian_category)) {
                continue;
            }

            if ($this->isLockedCategory($Silian_category)) {
                continue;
            }

            $Silian_enabled = (bool) ($Silian_entry['email_enabled'] ?? true);
            $Silian_bit = self::CATEGORY_BITMASKS[$Silian_category] ?? null;
            if ($Silian_bit === null) {
                continue;
            }

            if ($Silian_enabled) {
                $Silian_updatedMask &= ~$Silian_bit;
            } else {
                $Silian_updatedMask |= $Silian_bit;
            }
        }

        if ($Silian_updatedMask !== $Silian_currentMask) {
            try {
                User::query()
                    ->where('id', $Silian_userId)
                    ->update([
                        'notification_email_mask' => $Silian_updatedMask,
                        'updated_at' => date('Y-m-d H:i:s'),
                    ]);
            } catch (\Throwable $Silian_e) {
                $this->logFailure('notification_preferences_update_failed', $Silian_e, [
                    'user_id' => $Silian_userId,
                    'notification_email_mask' => $Silian_updatedMask,
                ], '/internal/notification-preferences/update');
                $this->logger->error('Failed to update notification mask', [
                    'user_id' => $Silian_userId,
                    'error' => $Silian_e->getMessage(),
                ]);
                throw $Silian_e;
            }

            $this->maskCache[$Silian_userId] = $Silian_updatedMask;
        }
    }

    public function shouldSendEmailByEmail(string $Silian_email, string $Silian_category): bool
    {
        $Silian_category = trim($Silian_category);
        if ($Silian_category === '' || !isset(self::CATEGORY_DEFINITIONS[$Silian_category])) {
            return true;
        }

        if ($this->isLockedCategory($Silian_category)) {
            return true;
        }

        if (!isset($this->userIdByEmailCache[$Silian_email])) {
            $Silian_user = User::query()
                ->where('email', $Silian_email)
                ->whereNull('deleted_at')
                ->first(['id', 'notification_email_mask']);

            if ($Silian_user) {
                $this->userIdByEmailCache[$Silian_email] = (int) $Silian_user->id;
                $this->maskCache[$Silian_user->id] = (int) ($Silian_user->notification_email_mask ?? 0);
            } else {
                $this->userIdByEmailCache[$Silian_email] = 0;
            }
        }

        $Silian_userId = $this->userIdByEmailCache[$Silian_email];
        if ($Silian_userId === 0) {
            return true;
        }

        return $this->shouldSendEmail($Silian_userId, $Silian_category);
    }

    public function shouldSendEmail(int $Silian_userId, string $Silian_category): bool
    {
        if (!isset(self::CATEGORY_DEFINITIONS[$Silian_category])) {
            return true;
        }

        if ($this->isLockedCategory($Silian_category)) {
            return true;
        }

        $Silian_bit = self::CATEGORY_BITMASKS[$Silian_category] ?? null;
        if ($Silian_bit === null) {
            return true;
        }

        $Silian_mask = $this->getMaskForUser($Silian_userId);

        return ($Silian_mask & $Silian_bit) === 0;
    }

    private function getMaskForUser(int $Silian_userId): int
    {
        if (!array_key_exists($Silian_userId, $this->maskCache)) {
            try {
                $Silian_mask = User::query()
                    ->where('id', $Silian_userId)
                    ->whereNull('deleted_at')
                    ->value('notification_email_mask');
            } catch (\Throwable $Silian_e) {
                $this->logFailure('notification_preferences_load_failed', $Silian_e, [
                    'user_id' => $Silian_userId,
                ], '/internal/notification-preferences/load');
                $this->logger->warning('Failed to load notification mask; assuming defaults', [
                    'user_id' => $Silian_userId,
                    'error' => $Silian_e->getMessage(),
                ]);
                $Silian_mask = 0;
            }

            $this->maskCache[$Silian_userId] = (int) ($Silian_mask ?? 0);
        }

        return $this->maskCache[$Silian_userId];
    }

    private function isLockedCategory(string $Silian_category): bool
    {
        return self::CATEGORY_DEFINITIONS[$Silian_category]['locked'] ?? false;
    }

    private function isValidCategory(string $Silian_category): bool
    {
        return isset(self::CATEGORY_DEFINITIONS[$Silian_category]);
    }

    private function logFailure(string $Silian_action, \Throwable $Silian_e, array $Silian_context, string $Silian_path): void
    {
        if ($this->auditLogService !== null) {
            try {
                $this->auditLogService->log([
                    'action' => $Silian_action,
                    'operation_category' => 'notification',
                    'actor_type' => 'system',
                    'status' => 'failed',
                    'data' => $Silian_context,
                ]);
            } catch (\Throwable $Silian_ignore) {
                // ignore audit failures for preference service
            }
        }

        if ($this->errorLogService === null) {
            return;
        }

        try {
            $Silian_request = SyntheticRequestFactory::fromContext($Silian_path, 'POST', null, [], $Silian_context);
            $this->errorLogService->logException($Silian_e, $Silian_request, ['context_message' => $Silian_action] + $Silian_context);
        } catch (\Throwable $Silian_ignore) {
            // ignore error log failures for preference service
        }
    }
}
