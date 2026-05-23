<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Support\SyntheticRequestFactory;
use DateInterval;
use DateTimeImmutable;
use DateTimeZone;
use PDO;

class StatisticsService
{
    private const MESSAGE_TREND_WINDOW_DAYS = 30;

    private DateTimeZone $timezone;

    public function __construct(
        private PDO $db,
        private ?string $cacheDir = null,
        private ?int $publicTtlSeconds = null,
        private ?int $adminTtlSeconds = null,
        private ?AuditLogService $auditLogService = null,
        private ?ErrorLogService $errorLogService = null
    ) {
        $Silian_tzName = $_ENV['APP_TIMEZONE'] ?? date_default_timezone_get();
        if (!$Silian_tzName) {
            $Silian_tzName = 'UTC';
        }
        $this->timezone = new DateTimeZone($Silian_tzName);
        if ($this->cacheDir === null) {
            $this->cacheDir = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'storage' . DIRECTORY_SEPARATOR . 'cache';
        }
        $this->publicTtlSeconds = $this->validateTtl($this->publicTtlSeconds, (int)($_ENV['STATS_PUBLIC_CACHE_TTL'] ?? 600));
        $this->adminTtlSeconds = $this->validateTtl($this->adminTtlSeconds, (int)($_ENV['STATS_ADMIN_CACHE_TTL'] ?? 180));
    }

    public function getAdminStats(bool $Silian_forceRefresh = false): array
    {
        try {
            if (!$Silian_forceRefresh) {
                $Silian_cached = $this->readCache('admin', $this->adminTtlSeconds);
                if ($Silian_cached !== null) {
                    $this->logAudit('statistics_admin_cache_hit', 'success', ['force_refresh' => false]);
                    return $Silian_cached['data'];
                }
            }

            $Silian_data = $this->computeAdminStats();
            $this->writeCache('admin', $Silian_data, $this->adminTtlSeconds);

            // Refresh public cache alongside admin stats so homepage stays in sync.
            $Silian_public = $this->buildPublicSummary($Silian_data);
            $this->writeCache('public', $Silian_public, $this->publicTtlSeconds);
            $this->logAudit('statistics_admin_computed', 'success', ['force_refresh' => $Silian_forceRefresh]);

            return $Silian_data;
        } catch (\Throwable $Silian_exception) {
            $this->logAudit('statistics_admin_failed', 'failed', ['force_refresh' => $Silian_forceRefresh, 'error' => $Silian_exception->getMessage()]);
            $this->logError($Silian_exception, '/internal/statistics/admin', ['force_refresh' => $Silian_forceRefresh]);
            throw $Silian_exception;
        }
    }

    public function getPublicStats(bool $Silian_forceRefresh = false): array
    {
        try {
            if (!$Silian_forceRefresh) {
                $Silian_cached = $this->readCache('public', $this->publicTtlSeconds);
                if ($Silian_cached !== null) {
                    $this->logAudit('statistics_public_cache_hit', 'success', ['force_refresh' => false]);
                    return $Silian_cached['data'];
                }
            }

            $Silian_adminData = $this->getAdminStats(true);
            $Silian_summary = $this->buildPublicSummary($Silian_adminData);
            $this->writeCache('public', $Silian_summary, $this->publicTtlSeconds);
            $this->logAudit('statistics_public_computed', 'success', ['force_refresh' => $Silian_forceRefresh]);

            return $Silian_summary;
        } catch (\Throwable $Silian_exception) {
            $this->logAudit('statistics_public_failed', 'failed', ['force_refresh' => $Silian_forceRefresh, 'error' => $Silian_exception->getMessage()]);
            $this->logError($Silian_exception, '/internal/statistics/public', ['force_refresh' => $Silian_forceRefresh]);
            throw $Silian_exception;
        }
    }

    private function computeAdminStats(): array
    {
        $Silian_now = new DateTimeImmutable('now', $this->timezone);
        $Silian_thirtyDaysAgo = $Silian_now->modify('-30 days')->format('Y-m-d H:i:s');
        $Silian_sevenDaysAgo = $Silian_now->modify('-7 days')->format('Y-m-d H:i:s');

        $Silian_driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
        $Silian_dateExpr = $Silian_driver === 'sqlite' ? "substr(created_at,1,10)" : "DATE(created_at)";

        $Silian_carbonDeletedCondition = $Silian_driver === 'sqlite' ? 'deleted_at IS NULL' : "(deleted_at IS NULL OR deleted_at = '0000-00-00 00:00:00')";
        $Silian_carbonDeletedConditionAliasedCr = $Silian_driver === 'sqlite' ? 'cr.deleted_at IS NULL' : "(cr.deleted_at IS NULL OR cr.deleted_at = '0000-00-00 00:00:00')";
        $Silian_activityDeletedCondition = $Silian_driver === 'sqlite' ? 'deleted_at IS NULL' : "(deleted_at IS NULL OR deleted_at = '0000-00-00 00:00:00')";

        $Silian_stmtUser = $this->db->prepare("SELECT COUNT(*) AS total_users,
                SUM(CASE WHEN status='active' THEN 1 ELSE 0 END) AS active_users,
                SUM(CASE WHEN status IN ('inactive','suspended') THEN 1 ELSE 0 END) AS inactive_users,
                SUM(CASE WHEN created_at >= :d30 THEN 1 ELSE 0 END) AS new_users_30d
                FROM users WHERE deleted_at IS NULL");
        $Silian_stmtUser->execute([':d30' => $Silian_thirtyDaysAgo]);
        $Silian_userStatsRaw = $Silian_stmtUser->fetch(PDO::FETCH_ASSOC) ?: [];

        $Silian_transactionStatsRaw = $this->db->query("SELECT COUNT(*) AS total_transactions,
                SUM(CASE WHEN LOWER(status) = 'pending' THEN 1 ELSE 0 END) AS pending_transactions,
                SUM(CASE WHEN LOWER(status) = 'approved' THEN 1 ELSE 0 END) AS approved_transactions,
                SUM(CASE WHEN LOWER(status) = 'rejected' THEN 1 ELSE 0 END) AS rejected_transactions,
                COALESCE(SUM(CASE WHEN LOWER(status) = 'approved' THEN points ELSE 0 END), 0) AS total_points_awarded
                FROM points_transactions WHERE {$Silian_activityDeletedCondition}")?->fetch(PDO::FETCH_ASSOC) ?: [];

        $Silian_txWindowStmt = $this->db->prepare("SELECT COUNT(*) AS total_transactions,
                COALESCE(SUM(CASE WHEN LOWER(status) = 'approved' THEN points ELSE 0 END), 0) AS total_points_awarded
                FROM points_transactions
                WHERE {$Silian_activityDeletedCondition} AND created_at >= :d7");
        $Silian_txWindowStmt->execute([':d7' => $Silian_sevenDaysAgo]);
        $Silian_txWindowRaw = $Silian_txWindowStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $Silian_exchangeStatsRaw = $this->db->query("SELECT COUNT(*) AS total_exchanges,
                SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending_exchanges,
                SUM(CASE WHEN status='completed' THEN 1 ELSE 0 END) AS completed_exchanges,
                SUM(CASE WHEN status NOT IN ('pending','completed') THEN 1 ELSE 0 END) AS other_exchanges,
                COALESCE(SUM(points_used), 0) AS total_points_spent
                FROM point_exchanges WHERE {$Silian_activityDeletedCondition}")?->fetch(PDO::FETCH_ASSOC) ?: [];

        $Silian_messageStatsRaw = $this->db->query("SELECT COUNT(*) AS total_messages,
                SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread_messages,
                SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) AS read_messages
                FROM messages WHERE deleted_at IS NULL")?->fetch(PDO::FETCH_ASSOC) ?: [];

        $Silian_messagePriorityRows = [];
        try {
            $Silian_prioritySql = "SELECT COALESCE(priority, 'normal') AS priority,
                    COUNT(*) AS total,
                    SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread,
                    SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) AS read
                FROM messages
                WHERE deleted_at IS NULL
                GROUP BY COALESCE(priority, 'normal')";
            $Silian_priorityStmt = $this->db->query($Silian_prioritySql);
            if ($Silian_priorityStmt) {
                $Silian_messagePriorityRows = $Silian_priorityStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            }
        } catch (\Throwable $Silian_ignore) {
            $Silian_messagePriorityRows = [];
        }

        $Silian_messageTrendRows = [];
        $Silian_messageTrendStart = $Silian_now
            ->modify('-' . (self::MESSAGE_TREND_WINDOW_DAYS - 1) . ' days')
            ->setTime(0, 0, 0);
        try {
            $Silian_trendSql = "SELECT {$Silian_dateExpr} AS day_label,
                    COUNT(*) AS total,
                    SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread,
                    SUM(CASE WHEN is_read = 1 THEN 1 ELSE 0 END) AS read
                FROM messages
                WHERE deleted_at IS NULL AND created_at >= :start_date
                GROUP BY {$Silian_dateExpr}
                ORDER BY {$Silian_dateExpr}";
            $Silian_trendStmt = $this->db->prepare($Silian_trendSql);
            if ($Silian_trendStmt) {
                $Silian_trendStmt->execute([':start_date' => $Silian_messageTrendStart->format('Y-m-d H:i:s')]);
                $Silian_messageTrendRows = $Silian_trendStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            }
        } catch (\Throwable $Silian_ignore) {
            $Silian_messageTrendRows = [];
        }

        $Silian_activityRecordStatsRaw = $this->db->query("SELECT COUNT(*) AS total_records,
                SUM(CASE WHEN LOWER(status) = 'pending' THEN 1 ELSE 0 END) AS pending_records,
                SUM(CASE WHEN LOWER(status) = 'approved' THEN 1 ELSE 0 END) AS approved_records,
                SUM(CASE WHEN LOWER(status) = 'rejected' THEN 1 ELSE 0 END) AS rejected_records
                FROM carbon_records WHERE {$Silian_carbonDeletedCondition}")?->fetch(PDO::FETCH_ASSOC) ?: [];

        $Silian_activityCatalogStatsRaw = $this->db->query("SELECT COUNT(*) AS total_activities,
                SUM(CASE WHEN is_active = 1 THEN 1 ELSE 0 END) AS active_activities,
                SUM(CASE WHEN is_active = 0 OR is_active IS NULL THEN 1 ELSE 0 END) AS inactive_activities
                FROM carbon_activities WHERE {$Silian_activityDeletedCondition}")?->fetch(PDO::FETCH_ASSOC) ?: [];

        $Silian_carbonStatsRaw = $this->db->query("SELECT COUNT(*) AS total_records,
                SUM(CASE WHEN LOWER(status) = 'pending' THEN 1 ELSE 0 END) AS pending_records,
                SUM(CASE WHEN LOWER(status) = 'approved' THEN 1 ELSE 0 END) AS approved_records,
                SUM(CASE WHEN LOWER(status) = 'rejected' THEN 1 ELSE 0 END) AS rejected_records,
                COALESCE(SUM(CASE WHEN LOWER(status) = 'approved' THEN carbon_saved ELSE 0 END), 0) AS total_carbon_saved,
                COALESCE(SUM(CASE WHEN LOWER(status) = 'approved' THEN points_earned ELSE 0 END), 0) AS total_points_earned
                FROM carbon_records WHERE {$Silian_carbonDeletedCondition}")?->fetch(PDO::FETCH_ASSOC) ?: [];

        $Silian_carbonWindowStmt = $this->db->prepare("SELECT
                    COALESCE(SUM(CASE WHEN LOWER(status) = 'approved' THEN carbon_saved ELSE 0 END), 0) AS carbon_saved,
                    COALESCE(SUM(CASE WHEN LOWER(status) = 'approved' THEN points_earned ELSE 0 END), 0) AS points_earned,
                    SUM(CASE WHEN LOWER(status) = 'pending' THEN 1 ELSE 0 END) AS pending_records,
                    SUM(CASE WHEN LOWER(status) = 'approved' THEN 1 ELSE 0 END) AS approved_records
                FROM carbon_records
                WHERE {$Silian_carbonDeletedCondition} AND created_at >= :d7");
        $Silian_carbonWindowStmt->execute([':d7' => $Silian_sevenDaysAgo]);
        $Silian_carbonWindowRaw = $Silian_carbonWindowStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $Silian_trendTransactions = [];
        try {
            $Silian_trendTxStmt = $this->db->prepare("SELECT {$Silian_dateExpr} AS date,
                        COUNT(*) AS transactions,
                        COALESCE(SUM(CASE WHEN LOWER(status) = 'approved' THEN points ELSE 0 END), 0) AS points_awarded
                    FROM points_transactions
                    WHERE {$Silian_activityDeletedCondition} AND created_at >= :d30
                    GROUP BY {$Silian_dateExpr}");
            $Silian_trendTxStmt->execute([':d30' => $Silian_thirtyDaysAgo]);
            $Silian_trendTransactions = $Silian_trendTxStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $Silian_ignore) {
        }

        $Silian_trendCarbon = [];
        try {
            $Silian_trendCarbonStmt = $this->db->prepare("SELECT {$Silian_dateExpr} AS date,
                        COALESCE(SUM(carbon_saved), 0) AS carbon_saved,
                        COUNT(*) AS approved_records
                    FROM carbon_records
                    WHERE {$Silian_carbonDeletedCondition} AND created_at >= :d30 AND LOWER(status) = 'approved'
                    GROUP BY {$Silian_dateExpr}");
            $Silian_trendCarbonStmt->execute([':d30' => $Silian_thirtyDaysAgo]);
            $Silian_trendCarbon = $Silian_trendCarbonStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $Silian_ignore) {
        }

        $Silian_trendMap = [];
        for ($Silian_i = 29; $Silian_i >= 0; $Silian_i--) {
            $Silian_dateKey = $Silian_now->modify("-{$Silian_i} days")->format('Y-m-d');
            $Silian_trendMap[$Silian_dateKey] = [
                'date' => $Silian_dateKey,
                'transactions' => 0,
                'carbon_saved' => 0.0,
                'points_awarded' => 0.0,
                'approved_records' => 0,
            ];
        }

        foreach ($Silian_trendTransactions as $Silian_row) {
            $Silian_d = (string)($Silian_row['date'] ?? '');
            if ($Silian_d !== '' && isset($Silian_trendMap[$Silian_d])) {
                $Silian_trendMap[$Silian_d]['transactions'] = $this->toInt($Silian_row['transactions'] ?? 0);
                $Silian_trendMap[$Silian_d]['points_awarded'] = $this->toFloat($Silian_row['points_awarded'] ?? 0);
            }
        }

        foreach ($Silian_trendCarbon as $Silian_row) {
            $Silian_d = (string)($Silian_row['date'] ?? '');
            if ($Silian_d !== '' && isset($Silian_trendMap[$Silian_d])) {
                $Silian_trendMap[$Silian_d]['carbon_saved'] = $this->toFloat($Silian_row['carbon_saved'] ?? 0);
                $Silian_trendMap[$Silian_d]['approved_records'] = $this->toInt($Silian_row['approved_records'] ?? 0);
            }
        }

        $Silian_trendData = array_values($Silian_trendMap);
        $Silian_trendCount = count($Silian_trendData);
        $Silian_trendTotals = [
            'transactions' => 0,
            'carbon_saved' => 0.0,
            'points_awarded' => 0.0,
            'approved_records' => 0,
        ];
        foreach ($Silian_trendData as $Silian_entry) {
            $Silian_trendTotals['transactions'] += $Silian_entry['transactions'];
            $Silian_trendTotals['carbon_saved'] += $Silian_entry['carbon_saved'];
            $Silian_trendTotals['points_awarded'] += $Silian_entry['points_awarded'];
            $Silian_trendTotals['approved_records'] += $Silian_entry['approved_records'];
        }

        $Silian_last7 = $Silian_trendCount > 7 ? array_slice($Silian_trendData, -7) : $Silian_trendData;
        $Silian_prev7 = [];
        if ($Silian_trendCount > 7) {
            $Silian_prev7 = array_slice($Silian_trendData, max(0, $Silian_trendCount - 14), max(0, min(7, $Silian_trendCount - 7)));
        }

        $Silian_sumColumn = static function (array $Silian_rows, string $Silian_key): float {
            $Silian_total = 0.0;
            foreach ($Silian_rows as $Silian_row) {
                $Silian_value = $Silian_row[$Silian_key] ?? 0;
                $Silian_total += is_numeric($Silian_value) ? (float) $Silian_value : 0.0;
            }
            return $Silian_total;
        };

        $Silian_carbonLast7 = $Silian_sumColumn($Silian_last7, 'carbon_saved');
        $Silian_carbonPrev7 = $Silian_sumColumn($Silian_prev7, 'carbon_saved');
        $Silian_transactionsLast7 = (int) round($Silian_sumColumn($Silian_last7, 'transactions'));
        $Silian_pointsLast7 = $Silian_sumColumn($Silian_last7, 'points_awarded');

        $Silian_trendSummary = [
            'carbon_last7' => $Silian_carbonLast7,
            'carbon_prev7' => $Silian_carbonPrev7,
            'carbon_delta' => $Silian_carbonLast7 - $Silian_carbonPrev7,
            'carbon_delta_rate' => $this->safeDivide($Silian_carbonLast7 - $Silian_carbonPrev7, max($Silian_carbonPrev7, 1)),
            'transactions_last7' => $Silian_transactionsLast7,
            'points_last7' => $Silian_pointsLast7,
            'average_daily_carbon_30d' => $Silian_trendCount > 0 ? $Silian_trendTotals['carbon_saved'] / max($Silian_trendCount, 1) : 0.0,
        ];

        $Silian_pendingTxStmt = $this->db->prepare("SELECT id, uid AS user_id, username, points, status, created_at
                FROM points_transactions
                WHERE {$Silian_activityDeletedCondition} AND LOWER(status) = 'pending'
                ORDER BY created_at DESC
                LIMIT 5");
        $Silian_pendingTxStmt->execute();
        $Silian_pendingTransactionsList = $Silian_pendingTxStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $Silian_pendingRecordsStmt = $this->db->prepare("SELECT cr.id, cr.user_id, u.username, cr.activity_id,
                    ca.name_zh AS activity_name_zh, ca.name_en AS activity_name_en,
                    cr.carbon_saved, cr.points_earned, cr.created_at
                FROM carbon_records cr
                LEFT JOIN users u ON u.id = cr.user_id
                LEFT JOIN carbon_activities ca ON ca.id = cr.activity_id
                WHERE {$Silian_carbonDeletedConditionAliasedCr} AND LOWER(cr.status) = 'pending'
                ORDER BY cr.created_at DESC
                LIMIT 5");
        $Silian_pendingRecordsStmt->execute();
        $Silian_pendingRecordsList = $Silian_pendingRecordsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $Silian_latestUsersStmt = $this->db->prepare("SELECT id, username, email, status, created_at
                FROM users WHERE deleted_at IS NULL ORDER BY created_at DESC LIMIT 5");
        $Silian_latestUsersStmt->execute();
        $Silian_latestUsers = $Silian_latestUsersStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $Silian_users = $this->normalizeUsersStats($Silian_userStatsRaw);
        $Silian_transactions = $this->normalizeTransactionStats($Silian_transactionStatsRaw, $Silian_txWindowRaw, $Silian_carbonStatsRaw, $Silian_carbonWindowRaw);
        $Silian_exchanges = $this->normalizeExchangeStats($Silian_exchangeStatsRaw);
        $Silian_messagesSummary = $this->normalizeMessageStats($Silian_messageStatsRaw);
        $Silian_priorityStats = $this->normalizeMessagePriorityBreakdown($Silian_messagePriorityRows, $Silian_messagesSummary);
        $Silian_trendSeries = $this->normalizeMessageDailySeries($Silian_messageTrendRows, $Silian_messageTrendStart, $Silian_now, $Silian_messagesSummary);

        $Silian_messages = $Silian_messagesSummary;
        $Silian_messages['priority_breakdown'] = $Silian_priorityStats;
        $Silian_messages['daily_counts'] = $Silian_trendSeries;
        $Silian_activities = $this->normalizeActivityStats($Silian_activityRecordStatsRaw, $Silian_activityCatalogStatsRaw);
        $Silian_carbon = $this->normalizeCarbonStats($Silian_carbonStatsRaw, $Silian_carbonWindowRaw, $Silian_trendTotals, $Silian_trendCount);

        $Silian_recent = [
            'pending_transactions' => $this->formatPendingTransactions($Silian_pendingTransactionsList),
            'pending_carbon_records' => $this->formatPendingCarbonRecords($Silian_pendingRecordsList),
            'latest_users' => $this->formatLatestUsers($Silian_latestUsers),
        ];

        return [
            'users' => $Silian_users,
            'transactions' => $Silian_transactions,
            'exchanges' => $Silian_exchanges,
            'messages' => $Silian_messages,
            'activities' => $Silian_activities,
            'carbon' => $Silian_carbon,
            'trends' => $Silian_trendData,
            'trend_summary' => $Silian_trendSummary,
            'recent' => $Silian_recent,
            'generated_at' => $Silian_now->format(DATE_ATOM),
        ];
    }

    private function buildPublicSummary(array $Silian_adminData): array
    {
        $Silian_generatedAt = new DateTimeImmutable('now', $this->timezone);
        $Silian_users = $Silian_adminData['users'] ?? [];
        $Silian_carbon = $Silian_adminData['carbon'] ?? [];
        $Silian_activities = $Silian_adminData['activities'] ?? [];
        $Silian_transactions = $Silian_adminData['transactions'] ?? [];
        $Silian_messagesSummary = $Silian_adminData['messages'] ?? [];
        $Silian_trend = $Silian_adminData['trend_summary'] ?? [];

        return [
            'generated_at' => $Silian_generatedAt->format(DATE_ATOM),
            'total_users' => $this->toInt($Silian_users['total_users'] ?? 0),
            'active_users' => $this->toInt($Silian_users['active_users'] ?? 0),
            'new_users_30d' => $this->toInt($Silian_users['new_users_30d'] ?? 0),
            'total_records' => $this->toInt($Silian_activities['total_records'] ?? ($Silian_carbon['total_records'] ?? 0)),
            'approved_records' => $this->toInt($Silian_activities['approved_records'] ?? ($Silian_carbon['approved_records'] ?? 0)),
            'pending_records' => $this->toInt($Silian_activities['pending_records'] ?? ($Silian_carbon['pending_records'] ?? 0)),
            'total_carbon_saved' => round($this->toFloat($Silian_carbon['total_carbon_saved'] ?? 0.0), 2),
            'average_daily_carbon_30d' => round($this->toFloat($Silian_trend['average_daily_carbon_30d'] ?? 0.0), 2),
            'carbon_last7' => round($this->toFloat($Silian_trend['carbon_last7'] ?? 0.0), 2),
            'total_points_awarded' => round($this->toFloat($Silian_transactions['total_points_awarded'] ?? ($Silian_carbon['total_points_earned'] ?? 0.0)), 2),
            'transactions_last7' => $this->toInt($Silian_trend['transactions_last7'] ?? 0),
            'total_messages' => $this->toInt($Silian_messagesSummary['total_messages'] ?? 0),
            'unread_messages' => $this->toInt($Silian_messagesSummary['unread_messages'] ?? 0),
            'read_messages' => $this->toInt($Silian_messagesSummary['read_messages'] ?? 0),
            'unread_ratio' => round($this->toFloat($Silian_messagesSummary['unread_ratio'] ?? 0.0), 4),
            'messages' => [
                'total_messages' => $this->toInt($Silian_messagesSummary['total_messages'] ?? 0),
                'unread_messages' => $this->toInt($Silian_messagesSummary['unread_messages'] ?? 0),
                'read_messages' => $this->toInt($Silian_messagesSummary['read_messages'] ?? 0),
                'unread_ratio' => round($this->toFloat($Silian_messagesSummary['unread_ratio'] ?? 0.0), 4),
            ],
        ];
    }

    private function normalizeUsersStats(array $Silian_row): array
    {
        $Silian_total = $this->toInt($Silian_row['total_users'] ?? 0);
        $Silian_active = $this->toInt($Silian_row['active_users'] ?? 0);
        $Silian_inactive = $this->toInt($Silian_row['inactive_users'] ?? 0);
        if ($Silian_inactive === 0 && $Silian_total >= $Silian_active) {
            $Silian_inactive = max(0, $Silian_total - $Silian_active);
        }
        $Silian_newThirty = $this->toInt($Silian_row['new_users_30d'] ?? 0);

        return [
            'total_users' => $Silian_total,
            'active_users' => $Silian_active,
            'inactive_users' => $Silian_inactive,
            'new_users_30d' => $Silian_newThirty,
            'active_ratio' => $this->safeDivide((float) $Silian_active, max($Silian_total, 1)),
            'new_users_ratio' => $this->safeDivide((float) $Silian_newThirty, max($Silian_total, 1)),
        ];
    }

    private function normalizeTransactionStats(array $Silian_row, array $Silian_windowRow, array $Silian_carbonRow, array $Silian_carbonWindowRow): array
    {
        $Silian_total = $this->toInt($Silian_row['total_transactions'] ?? 0);
        $Silian_pending = $this->toInt($Silian_row['pending_transactions'] ?? 0);
        $Silian_approved = $this->toInt($Silian_row['approved_transactions'] ?? 0);
        $Silian_rejected = $this->toInt($Silian_row['rejected_transactions'] ?? 0);
        $Silian_points = $this->toFloat($Silian_row['total_points_awarded'] ?? 0);
        if ($Silian_points <= 0.0) {
            $Silian_points = $this->toFloat($Silian_carbonRow['total_points_earned'] ?? 0);
        }
        $Silian_windowTransactions = $this->toInt($Silian_windowRow['total_transactions'] ?? 0);
        $Silian_windowPoints = $this->toFloat($Silian_windowRow['total_points_awarded'] ?? 0);
        if ($Silian_windowPoints <= 0.0) {
            $Silian_windowPoints = $this->toFloat($Silian_carbonWindowRow['points_earned'] ?? 0);
        }
        $Silian_totalCarbon = $this->toFloat($Silian_carbonRow['total_carbon_saved'] ?? 0);

        $Silian_approvedForAverage = $Silian_approved > 0 ? $Silian_approved : $this->toInt($Silian_carbonRow['approved_records'] ?? 0);
        $Silian_avgPoints = $Silian_approvedForAverage > 0 ? round($Silian_points / $Silian_approvedForAverage, 2) : 0.0;

        return [
            'total_transactions' => $Silian_total,
            'pending_transactions' => $Silian_pending,
            'approved_transactions' => $Silian_approved,
            'rejected_transactions' => $Silian_rejected,
            'total_points_awarded' => $Silian_points,
            'approval_rate' => $this->safeDivide((float) $Silian_approved, max($Silian_total, 1)),
            'pending_ratio' => $this->safeDivide((float) $Silian_pending, max($Silian_total, 1)),
            'avg_points_per_transaction' => $Silian_avgPoints,
            'last7_transactions' => $Silian_windowTransactions,
            'last7_points_awarded' => $Silian_windowPoints,
            'total_carbon_saved' => $Silian_totalCarbon,
        ];
    }

    private function normalizeExchangeStats(array $Silian_row): array
    {
        $Silian_total = $this->toInt($Silian_row['total_exchanges'] ?? 0);
        $Silian_pending = $this->toInt($Silian_row['pending_exchanges'] ?? 0);
        $Silian_completed = $this->toInt($Silian_row['completed_exchanges'] ?? 0);
        $Silian_other = $this->toInt($Silian_row['other_exchanges'] ?? 0);
        if ($Silian_other === 0 && $Silian_total >= ($Silian_pending + $Silian_completed)) {
            $Silian_other = max(0, $Silian_total - $Silian_pending - $Silian_completed);
        }
        $Silian_pointsSpent = $this->toFloat($Silian_row['total_points_spent'] ?? 0);

        return [
            'total_exchanges' => $Silian_total,
            'pending_exchanges' => $Silian_pending,
            'completed_exchanges' => $Silian_completed,
            'other_exchanges' => $Silian_other,
            'total_points_spent' => $Silian_pointsSpent,
            'completion_rate' => $this->safeDivide((float) $Silian_completed, max($Silian_total, 1)),
        ];
    }

    private function normalizeMessageStats(array $Silian_row): array
    {
        $Silian_total = $this->toInt($Silian_row['total_messages'] ?? 0);
        $Silian_unread = $this->toInt($Silian_row['unread_messages'] ?? 0);
        $Silian_read = $this->toInt($Silian_row['read_messages'] ?? 0);
        if ($Silian_read === 0 && $Silian_total >= $Silian_unread) {
            $Silian_read = max(0, $Silian_total - $Silian_unread);
        }

        return [
            'total_messages' => $Silian_total,
            'unread_messages' => $Silian_unread,
            'read_messages' => $Silian_read,
            'unread_ratio' => $this->safeDivide((float) $Silian_unread, max($Silian_total, 1)),
        ];
    }

    private function normalizeMessagePriorityBreakdown(array $Silian_rows, array $Silian_summary): array
    {
        if (empty($Silian_rows) && (($Silian_summary['total_messages'] ?? 0) <= 0)) {
            return [];
        }

        $Silian_orderMap = [
            'urgent' => 0,
            'high' => 1,
            'normal' => 2,
            'low' => 3,
        ];
        $Silian_result = [];

        foreach ($Silian_rows as $Silian_row) {
            $Silian_priorityRaw = (string) ($Silian_row['priority'] ?? 'normal');
            $Silian_priority = strtolower(trim($Silian_priorityRaw));
            if ($Silian_priority === '') {
                $Silian_priority = 'normal';
            }
            $Silian_total = $this->toInt($Silian_row['total'] ?? 0);
            $Silian_unread = $this->toInt($Silian_row['unread'] ?? 0);
            $Silian_read = $this->toInt($Silian_row['read'] ?? 0);
            if ($Silian_read === 0 && $Silian_total >= $Silian_unread) {
                $Silian_read = max(0, $Silian_total - $Silian_unread);
            }

            $Silian_result[] = [
                'priority' => $Silian_priority,
                'total' => $Silian_total,
                'unread' => $Silian_unread,
                'read' => $Silian_read,
                'unread_ratio' => $this->safeDivide((float) $Silian_unread, max($Silian_total, 1)),
                '_order' => $Silian_orderMap[$Silian_priority] ?? 99,
            ];
        }

        usort($Silian_result, static function (array $Silian_a, array $Silian_b): int {
            if ($Silian_a['_order'] === $Silian_b['_order']) {
                return strcmp((string) $Silian_a['priority'], (string) $Silian_b['priority']);
            }
            return $Silian_a['_order'] <=> $Silian_b['_order'];
        });

        $Silian_normalized = array_map(static function (array $Silian_entry): array {
            unset($Silian_entry['_order']);
            return $Silian_entry;
        }, $Silian_result);

        if (empty($Silian_normalized) && ($Silian_summary['total_messages'] ?? 0) > 0) {
            $Silian_total = $this->toInt($Silian_summary['total_messages']);
            $Silian_unread = $this->toInt($Silian_summary['unread_messages'] ?? 0);
            $Silian_read = $this->toInt($Silian_summary['read_messages'] ?? max(0, $Silian_total - $Silian_unread));

            $Silian_normalized[] = [
                'priority' => 'normal',
                'total' => $Silian_total,
                'unread' => $Silian_unread,
                'read' => max(0, $Silian_total - $Silian_unread),
                'unread_ratio' => $this->safeDivide((float) $Silian_unread, max($Silian_total, 1)),
            ];
        }

        return $Silian_normalized;
    }

    private function normalizeMessageDailySeries(
        array $Silian_rows,
        \DateTimeImmutable $Silian_start,
        \DateTimeImmutable $Silian_end,
        array $Silian_summary
    ): array
    {
        $Silian_map = [];
        foreach ($Silian_rows as $Silian_row) {
            $Silian_labelRaw = (string) ($Silian_row['day_label'] ?? '');
            if ($Silian_labelRaw === '') {
                continue;
            }
            $Silian_label = substr($Silian_labelRaw, 0, 10);
            $Silian_total = $this->toInt($Silian_row['total'] ?? 0);
            $Silian_unread = $this->toInt($Silian_row['unread'] ?? 0);
            $Silian_read = $this->toInt($Silian_row['read'] ?? 0);
            if ($Silian_read === 0 && $Silian_total >= $Silian_unread) {
                $Silian_read = max(0, $Silian_total - $Silian_unread);
            }
            $Silian_map[$Silian_label] = [
                'total' => $Silian_total,
                'unread' => $Silian_unread,
                'read' => $Silian_read,
            ];
        }

        $Silian_series = [];
        $Silian_current = $Silian_start->setTime(0, 0, 0);
        $Silian_endDate = $Silian_end->setTime(0, 0, 0);
        $Silian_hasData = false;

        while ($Silian_current <= $Silian_endDate) {
            $Silian_label = $Silian_current->format('Y-m-d');
            $Silian_stats = $Silian_map[$Silian_label] ?? ['total' => 0, 'unread' => 0, 'read' => 0];
            $Silian_series[] = [
                'date' => $Silian_label,
                'total' => $Silian_stats['total'],
                'unread' => $Silian_stats['unread'],
                'read' => $Silian_stats['read'],
            ];
            if ($Silian_stats['total'] > 0 || $Silian_stats['unread'] > 0) {
                $Silian_hasData = true;
            }
            $Silian_current = $Silian_current->modify('+1 day');
        }

        if (!$Silian_hasData && ($Silian_summary['total_messages'] ?? 0) > 0) {
            $Silian_total = $this->toInt($Silian_summary['total_messages']);
            $Silian_unread = $this->toInt($Silian_summary['unread_messages'] ?? 0);
            $Silian_read = $this->toInt($Silian_summary['read_messages'] ?? max(0, $Silian_total - $Silian_unread));

            return [[
                'date' => $Silian_endDate->format('Y-m-d'),
                'total' => $Silian_total,
                'unread' => $Silian_unread,
                'read' => $Silian_read,
            ]];
        }

        return $Silian_series;
    }

    private function normalizeActivityStats(array $Silian_recordRow, array $Silian_catalogRow): array
    {
        $Silian_totalRecords = $this->toInt($Silian_recordRow['total_records'] ?? 0);
        $Silian_approvedRecords = $this->toInt($Silian_recordRow['approved_records'] ?? 0);
        $Silian_pendingRecords = $this->toInt($Silian_recordRow['pending_records'] ?? 0);
        $Silian_rejectedRecords = $this->toInt($Silian_recordRow['rejected_records'] ?? 0);

        $Silian_totalCatalog = $this->toInt($Silian_catalogRow['total_activities'] ?? 0);
        $Silian_activeCatalog = $this->toInt($Silian_catalogRow['active_activities'] ?? 0);
        $Silian_inactiveCatalog = $this->toInt($Silian_catalogRow['inactive_activities'] ?? max(0, $Silian_totalCatalog - $Silian_activeCatalog));

        return [
            'total_records' => $Silian_totalRecords,
            'approved_records' => $Silian_approvedRecords,
            'pending_records' => $Silian_pendingRecords,
            'rejected_records' => $Silian_rejectedRecords,
            'approved_activities' => $Silian_approvedRecords,
            'pending_activities' => $Silian_pendingRecords,
            'rejected_activities' => $Silian_rejectedRecords,
            'total_activities' => $Silian_totalCatalog,
            'active_activities' => $Silian_activeCatalog,
            'inactive_activities' => $Silian_inactiveCatalog,
        ];
    }

    private function normalizeCarbonStats(array $Silian_row, array $Silian_windowRow, array $Silian_trendTotals, int $Silian_trendCount): array
    {
        $Silian_totalRecords = $this->toInt($Silian_row['total_records'] ?? 0);
        $Silian_pendingRecords = $this->toInt($Silian_row['pending_records'] ?? 0);
        $Silian_approvedRecords = $this->toInt($Silian_row['approved_records'] ?? 0);
        $Silian_rejectedRecords = $this->toInt($Silian_row['rejected_records'] ?? 0);
        $Silian_totalCarbon = $this->toFloat($Silian_row['total_carbon_saved'] ?? 0);
        $Silian_totalPointsEarned = $this->toFloat($Silian_row['total_points_earned'] ?? 0);
        $Silian_windowCarbon = $this->toFloat($Silian_windowRow['carbon_saved'] ?? 0);
        $Silian_windowPoints = $this->toFloat($Silian_windowRow['points_earned'] ?? 0);
        $Silian_windowPending = $this->toInt($Silian_windowRow['pending_records'] ?? 0);
        $Silian_windowApproved = $this->toInt($Silian_windowRow['approved_records'] ?? 0);
        $Silian_averageDaily = $Silian_trendCount > 0
            ? $Silian_trendTotals['carbon_saved'] / max($Silian_trendCount, 1)
            : ($Silian_approvedRecords > 0 ? $Silian_totalCarbon / $Silian_approvedRecords : 0.0);

        return [
            'total_records' => $Silian_totalRecords,
            'pending_records' => $Silian_pendingRecords,
            'approved_records' => $Silian_approvedRecords,
            'rejected_records' => $Silian_rejectedRecords,
            'total_carbon_saved' => $Silian_totalCarbon,
            'total_points_earned' => $Silian_totalPointsEarned,
            'last7_carbon_saved' => $Silian_windowCarbon,
            'last7_points_earned' => $Silian_windowPoints,
            'last7_pending_records' => $Silian_windowPending,
            'last7_approved_records' => $Silian_windowApproved,
            'approval_rate' => $this->safeDivide((float) $Silian_approvedRecords, max($Silian_totalRecords, 1)),
            'average_carbon_per_record' => $Silian_approvedRecords > 0 ? round($Silian_totalCarbon / $Silian_approvedRecords, 4) : 0.0,
            'average_daily_carbon' => round($Silian_averageDaily, 4),
        ];
    }

    private function formatPendingTransactions(array $Silian_rows): array
    {
        return array_values(array_map(function (array $Silian_row): array {
            return [
                'id' => $this->toInt($Silian_row['id'] ?? 0),
                'user_id' => $this->toInt($Silian_row['user_id'] ?? $Silian_row['uid'] ?? 0),
                'username' => $Silian_row['username'] ?? null,
                'points' => $this->toFloat($Silian_row['points'] ?? 0),
                'status' => $Silian_row['status'] ?? null,
                'created_at' => $Silian_row['created_at'] ?? null,
            ];
        }, $Silian_rows));
    }

    private function formatPendingCarbonRecords(array $Silian_rows): array
    {
        return array_values(array_map(function (array $Silian_row): array {
            return [
                'id' => $this->toInt($Silian_row['id'] ?? 0),
                'user_id' => $this->toInt($Silian_row['user_id'] ?? 0),
                'username' => $Silian_row['username'] ?? null,
                'activity_id' => $this->toInt($Silian_row['activity_id'] ?? 0),
                'activity_name_zh' => $Silian_row['activity_name_zh'] ?? null,
                'activity_name_en' => $Silian_row['activity_name_en'] ?? null,
                'carbon_saved' => $this->toFloat($Silian_row['carbon_saved'] ?? 0),
                'points_earned' => $this->toFloat($Silian_row['points_earned'] ?? 0),
                'created_at' => $Silian_row['created_at'] ?? null,
            ];
        }, $Silian_rows));
    }

    private function formatLatestUsers(array $Silian_rows): array
    {
        return array_values(array_map(function (array $Silian_row): array {
            return [
                'id' => $this->toInt($Silian_row['id'] ?? 0),
                'username' => $Silian_row['username'] ?? null,
                'email' => $Silian_row['email'] ?? null,
                'status' => $Silian_row['status'] ?? null,
                'created_at' => $Silian_row['created_at'] ?? null,
            ];
        }, $Silian_rows));
    }

    private function toInt(mixed $Silian_value): int
    {
        if ($Silian_value === null || $Silian_value === '') {
            return 0;
        }
        if (is_bool($Silian_value)) {
            return $Silian_value ? 1 : 0;
        }
        if (is_numeric($Silian_value)) {
            return (int) $Silian_value;
        }
        if (is_string($Silian_value)) {
            $Silian_filtered = preg_replace('/[^0-9\\-]/', '', $Silian_value);
            return (int) ($Silian_filtered ?? 0);
        }
        return (int) $Silian_value;
    }

    private function toFloat(mixed $Silian_value): float
    {
        if ($Silian_value === null || $Silian_value === '') {
            return 0.0;
        }
        if (is_numeric($Silian_value)) {
            return (float) $Silian_value;
        }
        if (is_string($Silian_value)) {
            $Silian_filtered = preg_replace('/[^0-9\\-\\.]/', '', $Silian_value);
            return (float) ($Silian_filtered ?? 0);
        }
        return (float) $Silian_value;
    }

    private function safeDivide(float $Silian_numerator, float $Silian_denominator, int $Silian_scale = 4): float
    {
        if ($Silian_denominator <= 0.0) {
            return 0.0;
        }
        return round($Silian_numerator / $Silian_denominator, $Silian_scale);
    }

    private function validateTtl(?int $Silian_provided, int $Silian_default): int
    {
        $Silian_ttl = $Silian_provided ?? $Silian_default;
        if ($Silian_ttl <= 0) {
            return $Silian_default > 0 ? $Silian_default : 300;
        }
        return $Silian_ttl;
    }

    private function readCache(string $Silian_key, int $Silian_ttl): ?array
    {
        $Silian_file = $this->getCacheFilePath($Silian_key);
        if (!is_file($Silian_file)) {
            return null;
        }
        $Silian_content = @file_get_contents($Silian_file);
        if ($Silian_content === false) {
            return null;
        }
        $Silian_data = json_decode($Silian_content, true);
        if (!is_array($Silian_data) || !isset($Silian_data['generated_at'], $Silian_data['data'])) {
            return null;
        }
        try {
            $Silian_generated = new DateTimeImmutable((string) $Silian_data['generated_at']);
        } catch (\Throwable $Silian_e) {
            return null;
        }
        $Silian_expires = $Silian_generated->add(new DateInterval('PT' . max($Silian_ttl, 1) . 'S'));
        if ($Silian_expires <= new DateTimeImmutable('now', $this->timezone)) {
            return null;
        }
        return [
            'generated_at' => $Silian_data['generated_at'],
            'data' => $Silian_data['data'],
        ];
    }

    private function writeCache(string $Silian_key, array $Silian_data, int $Silian_ttl): void
    {
        $Silian_file = $this->getCacheFilePath($Silian_key);
        $Silian_dir = dirname($Silian_file);
        if (!is_dir($Silian_dir)) {
            @mkdir($Silian_dir, 0775, true);
        }
        $Silian_generated = new DateTimeImmutable('now', $this->timezone);
        $Silian_payload = [
            'generated_at' => $Silian_generated->format(DATE_ATOM),
            'expires_at' => $Silian_generated->add(new DateInterval('PT' . max($Silian_ttl, 1) . 'S'))->format(DATE_ATOM),
            'data' => $Silian_data,
        ];

        $Silian_encoded = json_encode($Silian_payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_PRETTY_PRINT);
        if ($Silian_encoded === false) {
            return;
        }

        @file_put_contents($Silian_file, $Silian_encoded, LOCK_EX);
    }

    private function getCacheFilePath(string $Silian_key): string
    {
        $Silian_sanitized = preg_replace('/[^a-zA-Z0-9_\\-]/', '_', $Silian_key);
        return $this->cacheDir . DIRECTORY_SEPARATOR . $Silian_sanitized . '_stats.json';
    }

    private function logAudit(string $Silian_action, string $Silian_status, array $Silian_data = []): void
    {
        if (!$this->auditLogService) {
            return;
        }

        try {
            $this->auditLogService->logSystemEvent($Silian_action, 'statistics_service', [
                'status' => $Silian_status,
                'endpoint' => '/internal/statistics',
                'request_method' => 'SYSTEM',
                'request_data' => $Silian_data,
            ]);
        } catch (\Throwable $Silian_ignore) {
            // 审计日志失败不阻断主流程
        }
    }

    private function logError(\Throwable $Silian_exception, string $Silian_path, array $Silian_context = []): void
    {
        if (!$this->errorLogService) {
            return;
        }

        try {
            $Silian_request = SyntheticRequestFactory::fromContext($Silian_path, 'SYSTEM', null, [], $Silian_context, ['PHP_SAPI' => PHP_SAPI]);
            $this->errorLogService->logException($Silian_exception, $Silian_request, $Silian_context);
        } catch (\Throwable $Silian_ignore) {
            // swallow secondary logging failure
        }
    }
}
