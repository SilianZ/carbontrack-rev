<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Models\AchievementBadge;
use CarbonTrack\Models\UserBadge;
use CarbonTrack\Models\User;
use CarbonTrack\Support\SyntheticRequestFactory;
use Illuminate\Database\ConnectionInterface;
use PDO;
use DateTimeImmutable;
use DateTimeZone;
use CarbonTrack\Services\CheckinService;
use CarbonTrack\Services\MessageService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Models\Message;
use Monolog\Logger;

/**
 * Service layer handling creation, assignment, and evaluation of achievement badges.
 */
class BadgeService
{
    private ConnectionInterface $connection;
    private MessageService $messageService;
    private AuditLogService $auditLogService;
    private Logger $logger;
    private ?CheckinService $checkinService;
    private ?ErrorLogService $errorLogService;

    /** @var array<string,bool> */
    private array $supportedOperators = ['>=' => true, '>' => true, '<=' => true, '<' => true, '==' => true, '!=' => true];

    public function __construct(
        ConnectionInterface $Silian_connection,
        MessageService $Silian_messageService,
        AuditLogService $Silian_auditLogService,
        Logger $Silian_logger,
        ?CheckinService $Silian_checkinService = null,
        ?ErrorLogService $Silian_errorLogService = null
    ) {
        $this->connection = $Silian_connection;
        $this->messageService = $Silian_messageService;
        $this->auditLogService = $Silian_auditLogService;
        $this->logger = $Silian_logger;
        $this->checkinService = $Silian_checkinService;
        $this->errorLogService = $Silian_errorLogService;
    }

    /**
     * @return array<int,AchievementBadge>
     */
    public function listBadges(bool $Silian_includeInactive = false): array
    {
        $Silian_query = AchievementBadge::query()->orderBy('sort_order')->orderBy('id');
        if (!$Silian_includeInactive) {
            $Silian_query->where('is_active', true)->whereNull('deleted_at');
        }
        return $Silian_query->get()->all();
    }

    public function findBadge(int $Silian_id): ?AchievementBadge
    {
        return AchievementBadge::query()->where('id', $Silian_id)->first();
    }

    public function createBadge(array $Silian_data, int $Silian_adminId): AchievementBadge
    {
        return $this->connection->transaction(function () use ($Silian_data, $Silian_adminId) {
            $Silian_badge = new AchievementBadge($this->sanitizeBadgePayload($Silian_data));
            $Silian_badge->uuid = $Silian_data['uuid'] ?? $this->generateUuid();
            $Silian_badge->save();

            $this->auditLogService->log([
                'user_id' => $Silian_adminId,
                'action' => 'badge_created',
                'entity_type' => 'achievement_badge',
                'entity_id' => $Silian_badge->id,
                'new_value' => json_encode($Silian_badge->toArray(), JSON_UNESCAPED_UNICODE),
            ]);

            return $Silian_badge;
        });
    }

    public function updateBadge(int $Silian_badgeId, array $Silian_data, int $Silian_adminId): ?AchievementBadge
    {
        return $this->connection->transaction(function () use ($Silian_badgeId, $Silian_data, $Silian_adminId) {
            $Silian_badge = AchievementBadge::query()->find($Silian_badgeId);
            if (!$Silian_badge) {
                return null;
            }
            $Silian_original = $Silian_badge->toArray();
            $Silian_badge->fill($this->sanitizeBadgePayload($Silian_data));
            if (array_key_exists('is_active', $Silian_data)) {
                $Silian_badge->is_active = (bool) $Silian_data['is_active'];
            }
            if (array_key_exists('auto_grant_enabled', $Silian_data)) {
                $Silian_badge->auto_grant_enabled = (bool) $Silian_data['auto_grant_enabled'];
            }
            $Silian_badge->save();

            $this->auditLogService->logDataChange(
                'badge_management',
                'badge_updated',
                $Silian_adminId,
                'admin',
                'achievement_badges',
                $Silian_badge->id,
                $Silian_original,
                $Silian_badge->toArray()
            );

            return $Silian_badge;
        });
    }

    public function awardBadge(int $Silian_badgeId, int $Silian_userId, array $Silian_context = []): ?UserBadge
    {
        $Silian_source = $Silian_context['source'] ?? 'manual';
        $Silian_adminId = $Silian_context['admin_id'] ?? null;
        $Silian_notes = $Silian_context['notes'] ?? null;
        $Silian_meta = $Silian_context['meta'] ?? null;

        return $this->connection->transaction(function () use ($Silian_badgeId, $Silian_userId, $Silian_source, $Silian_adminId, $Silian_notes, $Silian_meta) {
            $Silian_badge = AchievementBadge::query()->find($Silian_badgeId);
            $Silian_user = User::query()->find($Silian_userId);
            if (!$Silian_badge || !$Silian_user) {
                return null;
            }

            $Silian_existing = UserBadge::query()->where('user_id', $Silian_userId)->where('badge_id', $Silian_badgeId)->first();
            if ($Silian_existing && $Silian_existing->isAwarded()) {
                return $Silian_existing;
            }

            if ($Silian_existing) {
                $Silian_existing->status = 'awarded';
                $Silian_existing->awarded_at = date('Y-m-d H:i:s');
                $Silian_existing->awarded_by = $Silian_adminId;
                $Silian_existing->revoked_at = null;
                $Silian_existing->revoked_by = null;
                $Silian_existing->source = $Silian_source;
                if ($Silian_notes !== null) {
                    $Silian_existing->notes = $Silian_notes;
                }
                if ($Silian_meta !== null) {
                    $Silian_existing->meta = $Silian_meta;
                }
                $Silian_existing->save();
                $Silian_userBadge = $Silian_existing;
            } else {
                $Silian_userBadge = new UserBadge([
                    'user_id' => $Silian_userId,
                    'badge_id' => $Silian_badgeId,
                    'status' => 'awarded',
                    'awarded_at' => date('Y-m-d H:i:s'),
                    'awarded_by' => $Silian_adminId,
                    'source' => $Silian_source,
                    'notes' => $Silian_notes,
                    'meta' => $Silian_meta,
                ]);
                $Silian_userBadge->save();
            }

            $this->sendBadgeMessage($Silian_user, $Silian_badge, $Silian_source);
            $this->auditLogService->log([
                'user_id' => $Silian_adminId,
                'action' => 'badge_awarded',
                'entity_type' => 'user_badge',
                'entity_id' => $Silian_userBadge->id,
                'new_value' => json_encode([
                    'user_id' => $Silian_userId,
                    'badge_id' => $Silian_badgeId,
                    'source' => $Silian_source,
                ], JSON_UNESCAPED_UNICODE),
                'notes' => $Silian_notes,
            ]);

            return $Silian_userBadge;
        });
    }

    public function revokeBadge(int $Silian_badgeId, int $Silian_userId, int $Silian_adminId, ?string $Silian_notes = null): bool
    {
        return $this->connection->transaction(function () use ($Silian_badgeId, $Silian_userId, $Silian_adminId, $Silian_notes) {
            $Silian_userBadge = UserBadge::query()
                ->where('user_id', $Silian_userId)
                ->where('badge_id', $Silian_badgeId)
                ->first();
            if (!$Silian_userBadge || !$Silian_userBadge->isAwarded()) {
                return false;
            }
            $Silian_userBadge->status = 'revoked';
            $Silian_userBadge->revoked_at = date('Y-m-d H:i:s');
            $Silian_userBadge->revoked_by = $Silian_adminId;
            if ($Silian_notes !== null) {
                $Silian_userBadge->notes = $Silian_notes;
            }
            $Silian_userBadge->save();

            $this->auditLogService->log([
                'user_id' => $Silian_adminId,
                'action' => 'badge_revoked',
                'entity_type' => 'user_badge',
                'entity_id' => $Silian_userBadge->id,
                'notes' => $Silian_notes,
            ]);

            return true;
        });
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    public function getUserBadges(int $Silian_userId, bool $Silian_includeRevoked = false): array
    {
        $Silian_query = UserBadge::query()
            ->with('badge')
            ->where('user_id', $Silian_userId)
            ->orderBy('awarded_at', 'desc');
        if (!$Silian_includeRevoked) {
            $Silian_query->where('status', 'awarded');
        }
        return $Silian_query->get()->map(function (UserBadge $Silian_userBadge) {
            $Silian_badge = $Silian_userBadge->badge;
            return [
                'badge' => $Silian_badge ? $Silian_badge->toArray() : null,
                'user_badge' => $Silian_userBadge->toArray(),
            ];
        })->all();
    }

    /**
     * Run automatic badge evaluation across users.
     *
     * @param int|null $badgeId Limit evaluation to single badge
     * @param int|null $userId Evaluate a single user when provided
     * @return array{awarded:int,skipped:int,badges:int,users:int}
     */
    public function runAutoGrant(?int $Silian_badgeId = null, ?int $Silian_userId = null): array
    {
        $Silian_badgesQuery = AchievementBadge::query()
            ->where('auto_grant_enabled', true)
            ->where('is_active', true)
            ->whereNull('deleted_at');
        if ($Silian_badgeId !== null) {
            $Silian_badgesQuery->where('id', $Silian_badgeId);
        }
        $Silian_badges = $Silian_badgesQuery->get();
        if ($Silian_badges->isEmpty()) {
            return ['awarded' => 0, 'skipped' => 0, 'badges' => 0, 'users' => 0];
        }

        $Silian_candidates = $Silian_userId !== null
            ? User::query()->where('id', $Silian_userId)->get()
            : User::query()->where('status', 'active')->whereNull('deleted_at')->get();

        $Silian_awarded = 0;
        $Silian_skipped = 0;

        foreach ($Silian_candidates as $Silian_user) {
            $Silian_metrics = $this->compileUserMetrics((int) $Silian_user->id);
            foreach ($Silian_badges as $Silian_badge) {
                $Silian_criteria = $Silian_badge->auto_grant_criteria ?? [];
                if (!$this->passesCriteria($Silian_criteria, $Silian_metrics)) {
                    $Silian_skipped++;
                    continue;
                }

                $Silian_result = $this->awardBadge((int) $Silian_badge->id, (int) $Silian_user->id, [
                    'source' => $Silian_userId ? 'trigger' : 'auto',
                    'meta' => ['metrics' => $Silian_metrics],
                ]);
                if ($Silian_result) {
                    $Silian_awarded++;
                }
            }
        }

        return [
            'awarded' => $Silian_awarded,
            'skipped' => $Silian_skipped,
            'badges' => $Silian_badges->count(),
            'users' => $Silian_candidates->count(),
        ];
    }

    /**
     * Build metric snapshot for user.
     *
     * @return array<string,float|int>
     */
    public function compileUserMetrics(int $Silian_userId): array
    {
        $Silian_metrics = [
            'total_carbon_saved' => 0.0,
            'total_points_earned' => 0.0,
            'total_approved_records' => 0,
            'total_records' => 0,
            'total_points_balance' => 0.0,
            'days_since_registration' => 0,
            'current_streak' => 0,
            'longest_streak' => 0,
        ];

        try {
            $Silian_sql = "SELECT
                COUNT(*) AS total_records,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_records,
                SUM(CASE WHEN status = 'approved' THEN carbon_saved ELSE 0 END) AS carbon_saved,
                SUM(CASE WHEN status = 'approved' THEN points_earned ELSE 0 END) AS points_earned
            FROM carbon_records
            WHERE user_id = :user_id AND deleted_at IS NULL";
            $Silian_rows = $this->connection->select($Silian_sql, ['user_id' => $Silian_userId]);
            $Silian_row = isset($Silian_rows[0]) ? (array) $Silian_rows[0] : [];
            $Silian_metrics['total_records'] = (int) ($Silian_row['total_records'] ?? 0);
            $Silian_metrics['total_approved_records'] = (int) ($Silian_row['approved_records'] ?? 0);
            $Silian_metrics['total_carbon_saved'] = (float) ($Silian_row['carbon_saved'] ?? 0);
            $Silian_metrics['total_points_earned'] = (float) ($Silian_row['points_earned'] ?? 0);
        } catch (\Throwable $Silian_e) {
            $this->logFailure('badge_metrics_compile_failed', $Silian_e, ['user_id' => $Silian_userId], '/internal/badges/metrics/carbon');
            $this->logger->warning('Failed to compile carbon metrics', ['user_id' => $Silian_userId, 'error' => $Silian_e->getMessage()]);
        }

        // Compute Checkin Streaks
        if ($this->checkinService) {
            try {
                $Silian_streakStats = $this->checkinService->getUserStreakStats($Silian_userId);
                $Silian_metrics['current_streak'] = (int) ($Silian_streakStats['current_streak_days'] ?? 0);
                $Silian_metrics['longest_streak'] = (int) ($Silian_streakStats['longest_streak_days'] ?? 0);
            } catch (\Throwable $Silian_e) {
                $this->logFailure('badge_metrics_streak_failed', $Silian_e, ['user_id' => $Silian_userId], '/internal/badges/metrics/streak');
                $this->logger->warning('Failed to get streak stats for metrics', ['user_id' => $Silian_userId, 'error' => $Silian_e->getMessage()]);
            }
        }

        $Silian_daysFromSql = null;
        try {
            $Silian_diffRows = $this->connection->select("SELECT TIMESTAMPDIFF(DAY, created_at, NOW()) AS diff_days FROM users WHERE id = :user_id LIMIT 1", ['user_id' => $Silian_userId]);
            if (!empty($Silian_diffRows)) {
                $Silian_diffRow = (array) $Silian_diffRows[0];
                $Silian_rawDays = $Silian_diffRow['diff_days'] ?? ($Silian_diffRow['days'] ?? ($Silian_diffRow['DIFF_DAYS'] ?? null));
                if ($Silian_rawDays !== null) {
                    $Silian_daysFromSql = max(0, (int) $Silian_rawDays);
                    $Silian_metrics['days_since_registration'] = $Silian_daysFromSql;
                }
            }
        } catch (\Throwable $Silian_e) {
            $this->logFailure('badge_metrics_registration_days_sql_failed', $Silian_e, ['user_id' => $Silian_userId], '/internal/badges/metrics/registration-days-sql');
            $this->logger->debug('Failed to compute registration days via SQL', ['user_id' => $Silian_userId, 'error' => $Silian_e->getMessage()]);
        }

        try {
            $Silian_user = User::query()->find($Silian_userId);
            if ($Silian_user) {
                $Silian_metrics['total_points_balance'] = (float) $Silian_user->points;
                if ($Silian_user->created_at) {
                    try {
                        if ($Silian_user->created_at instanceof \DateTimeInterface) {
                            $Silian_created = DateTimeImmutable::createFromInterface($Silian_user->created_at);
                            $Silian_now = new DateTimeImmutable('now', $Silian_created->getTimezone());
                        } else {
                            $Silian_timezoneName = $_ENV['APP_TIMEZONE'] ?? date_default_timezone_get();
                            if (!$Silian_timezoneName) {
                                $Silian_timezoneName = 'UTC';
                            }
                            $Silian_timezone = new DateTimeZone($Silian_timezoneName);
                            $Silian_created = new DateTimeImmutable((string) $Silian_user->created_at, $Silian_timezone);
                            $Silian_now = new DateTimeImmutable('now', $Silian_timezone);
                        }
                        $Silian_phpDays = max(0, (int) $Silian_created->diff($Silian_now)->format('%a'));
                        if ($Silian_daysFromSql === null) {
                            $Silian_metrics['days_since_registration'] = $Silian_phpDays;
                        }
                    } catch (\Throwable $Silian_dtEx) {
                        $this->logFailure('badge_metrics_registration_days_php_failed', $Silian_dtEx, ['user_id' => $Silian_userId], '/internal/badges/metrics/registration-days-php');
                        $this->logger->debug('Failed to compute registration days via PHP fallback', ['user_id' => $Silian_userId, 'error' => $Silian_dtEx->getMessage()]);
                    }
                }
            }
        } catch (\Throwable $Silian_e) {
            $this->logFailure('badge_metrics_user_profile_failed', $Silian_e, ['user_id' => $Silian_userId], '/internal/badges/metrics/user-profile');
            $this->logger->warning('Failed to read user profile for metrics', ['user_id' => $Silian_userId, 'error' => $Silian_e->getMessage()]);
        }

        return $Silian_metrics;
    }
    /**
     * @param array<int> $badgeIds
     * @return array<int,array<string,mixed>>
     */
    public function getBadgeAwardStats(array $Silian_badgeIds): array
    {
        if (empty($Silian_badgeIds)) {
            return [];
        }

        $Silian_rows = UserBadge::query()
            ->selectRaw("badge_id, COUNT(*) AS total_records, COUNT(DISTINCT user_id) AS unique_users, SUM(CASE WHEN status = 'awarded' THEN 1 ELSE 0 END) AS awarded_records, SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) AS revoked_records, COUNT(DISTINCT CASE WHEN status = 'awarded' THEN user_id ELSE NULL END) AS awarded_users, MAX(awarded_at) AS last_awarded_at")
            ->whereIn('badge_id', $Silian_badgeIds)
            ->groupBy('badge_id')
            ->get()
            ->keyBy('badge_id');

        $Silian_stats = [];
        foreach ($Silian_badgeIds as $Silian_badgeId) {
            $Silian_row = $Silian_rows->get($Silian_badgeId);
            if ($Silian_row) {
                $Silian_stats[$Silian_badgeId] = [
                    'total_records' => (int) ($Silian_row->total_records ?? 0),
                    'unique_users' => (int) ($Silian_row->unique_users ?? 0),
                    'awarded_records' => (int) ($Silian_row->awarded_records ?? 0),
                    'revoked_records' => (int) ($Silian_row->revoked_records ?? 0),
                    'awarded_users' => (int) ($Silian_row->awarded_users ?? 0),
                    'last_awarded_at' => $Silian_row->last_awarded_at ?? null,
                ];
            } else {
                $Silian_stats[$Silian_badgeId] = [
                    'total_records' => 0,
                    'unique_users' => 0,
                    'awarded_records' => 0,
                    'revoked_records' => 0,
                    'awarded_users' => 0,
                    'last_awarded_at' => null,
                ];
            }
        }

        return $Silian_stats;
    }

    /**
     * @param array{status?:string,search?:string,page?:int,per_page?:int,include_revoked?:bool} $options
     * @return array{items:array<int,array<string,mixed>>,pagination:array<string,int>}
     */
    public function getBadgeRecipients(int $Silian_badgeId, array $Silian_options = []): array
    {
        $Silian_page = max(1, (int) ($Silian_options['page'] ?? 1));
        $Silian_perPage = min(100, max(1, (int) ($Silian_options['per_page'] ?? 20)));
        $Silian_status = $Silian_options['status'] ?? null;
        $Silian_search = trim((string) ($Silian_options['search'] ?? ''));
        $Silian_includeRevoked = (bool) ($Silian_options['include_revoked'] ?? false);

        $Silian_query = UserBadge::query()
            ->with('user')
            ->where('badge_id', $Silian_badgeId);

        if ($Silian_status && in_array($Silian_status, ['awarded', 'revoked'], true)) {
            $Silian_query->where('status', $Silian_status);
        } elseif (!$Silian_includeRevoked) {
            $Silian_query->where('status', 'awarded');
        }

        if ($Silian_search !== '') {
            $Silian_query->whereHas('user', function ($Silian_q) use ($Silian_search) {
                $Silian_q->where('username', 'LIKE', '%' . $Silian_search . '%')
                  ->orWhere('email', 'LIKE', '%' . $Silian_search . '%');
            });
        }

        $Silian_total = (clone $Silian_query)->count();
        $Silian_items = $Silian_query
            ->orderBy('awarded_at', 'desc')
            ->orderBy('id', 'desc')
            ->forPage($Silian_page, $Silian_perPage)
            ->get();

        $Silian_data = $Silian_items->map(function (UserBadge $Silian_userBadge) {
            $Silian_user = $Silian_userBadge->user;
            return [
                'user' => $Silian_user ? [
                    'id' => (int) $Silian_user->id,
                    'username' => $Silian_user->username,
                    'email' => $Silian_user->email,
                    'is_admin' => (bool) ($Silian_user->is_admin ?? false),
                    'status' => $Silian_user->status ?? null,
                    'avatar_id' => $Silian_user->avatar_id ?? null,
                ] : null,
                'user_badge' => $Silian_userBadge->toArray(),
            ];
        })->all();

        return [
            'items' => $Silian_data,
            'pagination' => [
                'current_page' => $Silian_page,
                'per_page' => $Silian_perPage,
                'total_items' => $Silian_total,
                'total_pages' => $Silian_total > 0 ? (int) ceil($Silian_total / $Silian_perPage) : 0,
            ],
        ];
    }



    private function passesCriteria($Silian_criteria, array $Silian_metrics): bool
    {
        if (empty($Silian_criteria) || !is_array($Silian_criteria)) {
            return true;
        }

        $Silian_rules = $Silian_criteria['rules'] ?? $Silian_criteria;
        $Silian_mode = $Silian_criteria['all'] ?? $Silian_criteria['all_required'] ?? true;
        if (is_string($Silian_mode)) {
            $Silian_filtered = filter_var($Silian_mode, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($Silian_filtered !== null) {
                $Silian_mode = $Silian_filtered;
            }
        }
        $Silian_allRequired = (bool) $Silian_mode;

        $Silian_passedAny = false;
        foreach ((array) $Silian_rules as $Silian_rule) {
            if (!is_array($Silian_rule)) {
                continue;
            }
            $Silian_metric = $Silian_rule['metric'] ?? null;
            $Silian_operator = $Silian_rule['operator'] ?? $Silian_rule['op'] ?? '>=';
            $Silian_value = $Silian_rule['value'] ?? null;
            if ($Silian_metric === null || $Silian_value === null) {
                continue;
            }
            if (!isset($Silian_metrics[$Silian_metric])) {
                continue;
            }
            if (!isset($this->supportedOperators[$Silian_operator])) {
                $Silian_operator = '>=';
            }
            $Silian_actual = $Silian_metrics[$Silian_metric];
            if ($this->compare($Silian_actual, $Silian_operator, $Silian_value)) {
                if (!$Silian_allRequired) {
                    return true;
                }
                $Silian_passedAny = true;
            } elseif ($Silian_allRequired) {
                return false;
            }
        }

        return $Silian_allRequired ? $Silian_passedAny : false;
    }

    private function compare($Silian_actual, string $Silian_operator, $Silian_expected): bool
    {
        switch ($Silian_operator) {
            case '>=': return $Silian_actual >= $Silian_expected;
            case '>': return $Silian_actual > $Silian_expected;
            case '<=': return $Silian_actual <= $Silian_expected;
            case '<': return $Silian_actual < $Silian_expected;
            case '==': return $Silian_actual == $Silian_expected;
            case '!=': return $Silian_actual != $Silian_expected;
            default: return false;
        }
    }

    private function sendBadgeMessage(User $Silian_user, AchievementBadge $Silian_badge, string $Silian_source): void
    {
        try {
            $Silian_titleZh = $Silian_badge->message_title_zh ?? ('恭喜解锁成就徽章：' . $Silian_badge->name_zh);
            $Silian_titleEn = $Silian_badge->message_title_en ?? ('New achievement badge unlocked: ' . $Silian_badge->name_en);
            $Silian_bodyZh = $Silian_badge->message_body_zh ?? (
                "亲爱的{$Silian_user->username}，\n\n" .
                "您已获得成就徽章《{$Silian_badge->name_zh}》。继续保持绿色行动！"
            );
            $Silian_bodyEn = $Silian_badge->message_body_en ?? (
                "Dear {$Silian_user->username},\n\n" .
                "You have just unlocked the achievement badge \"{$Silian_badge->name_en}\". Keep up the great climate actions!"
            );

            $Silian_title = $Silian_titleZh . ' / ' . $Silian_titleEn;
            $Silian_content = $Silian_bodyZh . "\n\n---\n" . $Silian_bodyEn;

            $this->messageService->sendSystemMessage(
                (int) $Silian_user->id,
                $Silian_title,
                $Silian_content,
                type: Message::TYPE_NOTIFICATION,
                priority: Message::PRIORITY_NORMAL,
                relatedEntityType: 'achievement_badge',
                relatedEntityId: (int) $Silian_badge->id
            );
        } catch (\Throwable $Silian_e) {
            $this->logFailure('badge_message_send_failed', $Silian_e, [
                'user_id' => (int) $Silian_user->id,
                'badge_id' => (int) $Silian_badge->id,
                'source' => $Silian_source,
            ], '/internal/badges/messages');
            $this->logger->error('Failed to send badge message', ['user_id' => $Silian_user->id, 'badge_id' => $Silian_badge->id, 'error' => $Silian_e->getMessage()]);
        }
    }

    private function sanitizeBadgePayload(array $Silian_data): array
    {
        $Silian_allowed = [
            'code', 'name_zh', 'name_en', 'description_zh', 'description_en',
            'icon_path', 'icon_thumbnail_path', 'is_active', 'sort_order',
            'auto_grant_enabled', 'auto_grant_criteria', 'message_title_zh',
            'message_title_en', 'message_body_zh', 'message_body_en'
        ];
        $Silian_clean = [];
        foreach ($Silian_allowed as $Silian_key) {
            if (array_key_exists($Silian_key, $Silian_data)) {
                $Silian_clean[$Silian_key] = $Silian_data[$Silian_key];
            }
        }
        if (isset($Silian_clean['sort_order'])) {
            $Silian_clean['sort_order'] = (int) $Silian_clean['sort_order'];
        }
        if (isset($Silian_clean['is_active'])) {
            $Silian_clean['is_active'] = (bool) $Silian_clean['is_active'];
        }
        if (isset($Silian_clean['auto_grant_enabled'])) {
            $Silian_clean['auto_grant_enabled'] = (bool) $Silian_clean['auto_grant_enabled'];
        }
        if (isset($Silian_clean['auto_grant_criteria']) && is_string($Silian_clean['auto_grant_criteria'])) {
            $Silian_decoded = json_decode($Silian_clean['auto_grant_criteria'], true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $Silian_clean['auto_grant_criteria'] = $Silian_decoded;
            }
        }
        return $Silian_clean;
    }

    private function generateUuid(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }

    private function logFailure(string $Silian_action, \Throwable $Silian_e, array $Silian_context, string $Silian_path): void
    {
        try {
            $this->auditLogService->log([
                'action' => $Silian_action,
                'operation_category' => 'badge_management',
                'actor_type' => 'system',
                'status' => 'failed',
                'data' => $Silian_context,
            ]);
        } catch (\Throwable $Silian_ignore) {
            // ignore audit failures in badge service
        }

        if ($this->errorLogService === null) {
            return;
        }

        try {
            $Silian_request = SyntheticRequestFactory::fromContext($Silian_path, 'POST', null, [], $Silian_context);
            $this->errorLogService->logException($Silian_e, $Silian_request, ['context_message' => $Silian_action] + $Silian_context);
        } catch (\Throwable $Silian_ignore) {
            // ignore error log failures in badge service
        }
    }
}
