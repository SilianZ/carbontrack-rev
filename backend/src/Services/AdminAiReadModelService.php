<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use PDO;

class AdminAiReadModelService
{
    public function __construct(
        private PDO $db,
        private ?StatisticsService $statisticsService = null,
        private ?CronSchedulerService $cronSchedulerService = null
    ) {
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public function execute(string $Silian_actionName, array $Silian_payload): array
    {
        return match ($Silian_actionName) {
            'get_admin_stats' => [
                'scope' => 'admin_stats',
                'data' => $this->statisticsService?->getAdminStats(false) ?? [],
            ],
            'get_pending_carbon_records' => $this->queryPendingCarbonRecords($Silian_payload),
            'get_llm_usage_analytics' => $this->queryLlmUsageAnalytics((int) ($Silian_payload['days'] ?? 30)),
            'get_activity_statistics' => $this->queryActivityStatistics($Silian_payload),
            'generate_admin_report' => $this->buildAdminReport((int) ($Silian_payload['days'] ?? 30)),
            'search_users' => $this->queryUsers($Silian_payload),
            'get_user_overview' => $this->queryUserOverview($Silian_payload),
            'get_exchange_orders' => $this->queryExchangeOrders($Silian_payload),
            'get_exchange_order_detail' => $this->queryExchangeOrderDetail($Silian_payload),
            'get_product_catalog' => $this->queryProductCatalog($Silian_payload),
            'get_passkey_admin_stats' => $this->queryPasskeyAdminStats(),
            'get_passkey_admin_list' => $this->queryPasskeyAdminList($Silian_payload),
            'get_cron_tasks' => $this->queryCronTasks(),
            'get_cron_runs' => $this->queryCronRuns($Silian_payload),
            'search_system_logs' => $this->querySystemLogs($Silian_payload),
            'get_broadcast_history' => $this->queryBroadcastHistory($Silian_payload),
            'search_broadcast_recipients' => $this->queryBroadcastRecipients($Silian_payload),
            default => throw new \RuntimeException('Unsupported read action: ' . $Silian_actionName),
        };
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function queryPendingCarbonRecords(array $Silian_payload): array
    {
        $Silian_limit = max(1, min(20, (int) ($Silian_payload['limit'] ?? 5)));
        $Silian_status = trim((string) ($Silian_payload['status'] ?? 'pending'));
        $Silian_where = ['r.deleted_at IS NULL', 'r.status = :status'];
        $Silian_params = [':status' => $Silian_status];

        if (!empty($Silian_payload['record_ids']) && is_array($Silian_payload['record_ids'])) {
            $Silian_placeholders = [];
            foreach (array_values($Silian_payload['record_ids']) as $Silian_index => $Silian_id) {
                $Silian_placeholder = ':record_id_' . $Silian_index;
                $Silian_placeholders[] = $Silian_placeholder;
                $Silian_params[$Silian_placeholder] = (string) $Silian_id;
            }
            if ($Silian_placeholders !== []) {
                $Silian_where[] = 'r.id IN (' . implode(',', $Silian_placeholders) . ')';
            }
        }

        $Silian_sql = "SELECT r.id, r.status, r.date, r.carbon_saved, r.points_earned, u.username, u.email,
                       a.name_zh AS activity_name_zh, a.name_en AS activity_name_en
                FROM carbon_records r
                LEFT JOIN users u ON u.id = r.user_id
                LEFT JOIN carbon_activities a ON a.id = r.activity_id
                WHERE " . implode(' AND ', $Silian_where) . "
                ORDER BY r.created_at DESC
                LIMIT :limit";
        $Silian_stmt = $this->db->prepare($Silian_sql);
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_stmt->bindValue($Silian_key, $Silian_value);
        }
        $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
        $Silian_stmt->execute();

        $Silian_items = [];
        foreach ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $Silian_row) {
            $Silian_items[] = [
                'id' => $Silian_row['id'],
                'status' => $Silian_row['status'],
                'date' => $Silian_row['date'],
                'carbon_saved' => $Silian_row['carbon_saved'] !== null ? (float) $Silian_row['carbon_saved'] : null,
                'points_earned' => $Silian_row['points_earned'] !== null ? (int) $Silian_row['points_earned'] : null,
                'username' => $Silian_row['username'],
                'email' => $Silian_row['email'],
                'activity_name' => $Silian_row['activity_name_zh'] ?: ($Silian_row['activity_name_en'] ?: null),
            ];
        }

        $Silian_countStmt = $this->db->prepare("SELECT COUNT(*) FROM carbon_records r WHERE " . implode(' AND ', $Silian_where));
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_countStmt->bindValue($Silian_key, $Silian_value);
        }
        $Silian_countStmt->execute();

        return [
            'scope' => 'pending_carbon_records',
            'status' => $Silian_status,
            'total' => (int) $Silian_countStmt->fetchColumn(),
            'items' => $Silian_items,
        ];
    }

    /**
     * @return array<string,mixed>
     */
    private function queryLlmUsageAnalytics(int $Silian_days): array
    {
        $Silian_days = max(7, min(90, $Silian_days));
        $Silian_since = (new \DateTimeImmutable('now', new \DateTimeZone('UTC')))
            ->modify('-' . max(0, $Silian_days - 1) . ' days')
            ->setTime(0, 0, 0)
            ->format('Y-m-d H:i:s');

        $Silian_summaryStmt = $this->db->prepare("SELECT COUNT(*) AS total_calls, COALESCE(SUM(total_tokens), 0) AS total_tokens,
                AVG(latency_ms) AS avg_latency_ms, SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) AS success_calls
            FROM llm_logs WHERE created_at >= :since");
        $Silian_summaryStmt->execute([':since' => $Silian_since]);
        $Silian_summary = $Silian_summaryStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $Silian_topModelStmt = $this->db->prepare("SELECT model, COUNT(*) AS calls FROM llm_logs WHERE created_at >= :since GROUP BY model ORDER BY calls DESC LIMIT 1");
        $Silian_topModelStmt->execute([':since' => $Silian_since]);
        $Silian_topModel = $Silian_topModelStmt->fetch(PDO::FETCH_ASSOC) ?: null;

        $Silian_topSourceStmt = $this->db->prepare("SELECT source, COUNT(*) AS calls FROM llm_logs WHERE created_at >= :since GROUP BY source ORDER BY calls DESC LIMIT 1");
        $Silian_topSourceStmt->execute([':since' => $Silian_since]);
        $Silian_topSource = $Silian_topSourceStmt->fetch(PDO::FETCH_ASSOC) ?: null;

        return [
            'scope' => 'llm_usage_analytics',
            'days' => $Silian_days,
            'total_calls' => (int) ($Silian_summary['total_calls'] ?? 0),
            'total_tokens' => (int) ($Silian_summary['total_tokens'] ?? 0),
            'avg_latency_ms' => isset($Silian_summary['avg_latency_ms']) ? round((float) $Silian_summary['avg_latency_ms'], 2) : null,
            'success_calls' => (int) ($Silian_summary['success_calls'] ?? 0),
            'top_model' => $Silian_topModel['model'] ?? null,
            'top_source' => $Silian_topSource['source'] ?? null,
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function queryActivityStatistics(array $Silian_payload): array
    {
        $Silian_activityId = trim((string) ($Silian_payload['activity_id'] ?? ''));
        $Silian_where = ['r.deleted_at IS NULL'];
        $Silian_params = [];
        if ($Silian_activityId !== '') {
            $Silian_where[] = 'r.activity_id = :activity_id';
            $Silian_params[':activity_id'] = $Silian_activityId;
        }

        $Silian_sql = "SELECT r.activity_id, a.name_zh AS activity_name_zh, a.name_en AS activity_name_en,
                       COUNT(*) AS record_count,
                       SUM(CASE WHEN r.status = 'approved' THEN 1 ELSE 0 END) AS approved_count,
                       SUM(CASE WHEN r.status = 'pending' THEN 1 ELSE 0 END) AS pending_count,
                       COALESCE(SUM(CASE WHEN r.status = 'approved' THEN r.carbon_saved ELSE 0 END), 0) AS approved_carbon_saved
                FROM carbon_records r
                LEFT JOIN carbon_activities a ON a.id = r.activity_id
                WHERE " . implode(' AND ', $Silian_where) . "
                GROUP BY r.activity_id, a.name_zh, a.name_en
                ORDER BY approved_carbon_saved DESC
                LIMIT 10";
        $Silian_stmt = $this->db->prepare($Silian_sql);
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_stmt->bindValue($Silian_key, $Silian_value);
        }
        $Silian_stmt->execute();

        $Silian_items = [];
        foreach ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $Silian_row) {
            $Silian_items[] = [
                'activity_id' => $Silian_row['activity_id'],
                'activity_name' => $Silian_row['activity_name_zh'] ?: ($Silian_row['activity_name_en'] ?: null),
                'record_count' => (int) ($Silian_row['record_count'] ?? 0),
                'approved_count' => (int) ($Silian_row['approved_count'] ?? 0),
                'pending_count' => (int) ($Silian_row['pending_count'] ?? 0),
                'approved_carbon_saved' => (float) ($Silian_row['approved_carbon_saved'] ?? 0),
            ];
        }

        return [
            'scope' => 'activity_statistics',
            'activity_id' => $Silian_activityId !== '' ? $Silian_activityId : null,
            'items' => $Silian_items,
        ];
    }

    /**
     * @return array<string,mixed>
     */
    private function buildAdminReport(int $Silian_days): array
    {
        return [
            'scope' => 'admin_report',
            'days' => $Silian_days,
            'stats' => $this->statisticsService?->getAdminStats(false) ?? [],
            'llm' => $this->queryLlmUsageAnalytics($Silian_days),
            'pending' => $this->queryPendingCarbonRecords(['status' => 'pending', 'limit' => 5]),
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function queryUsers(array $Silian_payload): array
    {
        $Silian_limit = max(1, min(20, (int) ($Silian_payload['limit'] ?? 10)));
        $Silian_search = trim((string) ($Silian_payload['search'] ?? $Silian_payload['q'] ?? $Silian_payload['keyword'] ?? $Silian_payload['query'] ?? ''));
        $Silian_status = trim((string) ($Silian_payload['status'] ?? ''));
        $Silian_userUuid = strtolower(trim((string) ($Silian_payload['user_uuid'] ?? '')));
        $Silian_schoolId = isset($Silian_payload['school_id']) && is_numeric((string) $Silian_payload['school_id']) ? (int) $Silian_payload['school_id'] : null;
        $Silian_role = strtolower(trim((string) ($Silian_payload['role'] ?? '')));

        $Silian_where = ['u.deleted_at IS NULL'];
        $Silian_params = [];
        if ($Silian_search !== '') {
            [$Silian_searchCondition, $Silian_searchParams] = $this->buildLikeCondition(
                ['u.username', 'u.email', 'u.uuid'],
                'user_search',
                '%' . $Silian_search . '%'
            );
            $Silian_where[] = $Silian_searchCondition;
            $Silian_params += $Silian_searchParams;
        }
        if ($Silian_status !== '') {
            $Silian_where[] = 'u.status = :status';
            $Silian_params[':status'] = $Silian_status;
        }
        if ($Silian_userUuid !== '') {
            $Silian_where[] = 'LOWER(u.uuid) = :user_uuid';
            $Silian_params[':user_uuid'] = $Silian_userUuid;
        }
        if ($Silian_schoolId !== null && $Silian_schoolId > 0) {
            $Silian_where[] = 'u.school_id = :school_id';
            $Silian_params[':school_id'] = $Silian_schoolId;
        }
        if ($Silian_role === 'admin') {
            $Silian_where[] = 'u.is_admin = 1';
        } elseif ($Silian_role === 'user') {
            $Silian_where[] = 'u.is_admin = 0';
        }

        $Silian_sort = strtolower(trim((string) ($Silian_payload['sort'] ?? 'created_at_desc')));
        $Silian_orderBy = match ($Silian_sort) {
            'username_asc' => 'u.username ASC, u.id ASC',
            'username_desc' => 'u.username DESC, u.id DESC',
            'points_asc' => 'u.points ASC, u.id ASC',
            'points_desc' => 'u.points DESC, u.id DESC',
            'created_at_asc' => 'u.created_at ASC, u.id ASC',
            default => 'u.created_at DESC, u.id DESC',
        };

        $Silian_sql = "SELECT u.id, u.uuid, u.username, u.email, u.status, u.points, u.is_admin, u.created_at,
                       s.name AS school_name, COALESCE(pk.passkey_count, 0) AS passkey_count
                FROM users u
                LEFT JOIN schools s ON s.id = u.school_id
                LEFT JOIN (
                    SELECT user_uuid, COUNT(*) AS passkey_count
                    FROM user_passkeys
                    WHERE disabled_at IS NULL
                    GROUP BY user_uuid
                ) pk ON LOWER(pk.user_uuid) = LOWER(u.uuid)
                WHERE " . implode(' AND ', $Silian_where) . "
                ORDER BY {$Silian_orderBy}
                LIMIT :limit";
        $Silian_stmt = $this->db->prepare($Silian_sql);
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_stmt->bindValue($Silian_key, $Silian_value);
        }
        $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
        $Silian_stmt->execute();

        $Silian_items = [];
        foreach ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $Silian_row) {
            $Silian_items[] = [
                'id' => isset($Silian_row['id']) ? (int) $Silian_row['id'] : null,
                'uuid' => $Silian_row['uuid'] ?? null,
                'username' => $Silian_row['username'] ?? null,
                'email' => $Silian_row['email'] ?? null,
                'status' => $Silian_row['status'] ?? null,
                'points' => isset($Silian_row['points']) ? (int) $Silian_row['points'] : 0,
                'is_admin' => !empty($Silian_row['is_admin']),
                'school_name' => $Silian_row['school_name'] ?? null,
                'passkey_count' => isset($Silian_row['passkey_count']) ? (int) $Silian_row['passkey_count'] : 0,
                'created_at' => $Silian_row['created_at'] ?? null,
            ];
        }

        $Silian_countStmt = $this->db->prepare("SELECT COUNT(*) FROM users u WHERE " . implode(' AND ', $Silian_where));
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_countStmt->bindValue($Silian_key, $Silian_value);
        }
        $Silian_countStmt->execute();

        return [
            'scope' => 'users',
            'search' => $Silian_search !== '' ? $Silian_search : null,
            'total' => (int) $Silian_countStmt->fetchColumn(),
            'items' => $Silian_items,
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function queryUserOverview(array $Silian_payload): array
    {
        $Silian_user = $this->resolveUserRowFromPayload($Silian_payload);
        if ($Silian_user === null) {
            throw new \RuntimeException('User not found.');
        }

        $Silian_userId = (int) ($Silian_user['id'] ?? 0);
        $Silian_userUuid = strtolower((string) ($Silian_user['uuid'] ?? ''));

        $Silian_carbonStmt = $this->db->prepare("SELECT
                COALESCE(SUM(CASE WHEN status = 'approved' THEN carbon_saved ELSE 0 END), 0) AS total_carbon_saved,
                SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) AS approved_records,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending_records
            FROM carbon_records
            WHERE user_id = :user_id
              AND deleted_at IS NULL");
        $Silian_carbonStmt->execute([':user_id' => $Silian_userId]);
        $Silian_carbon = $Silian_carbonStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $Silian_checkinStmt = $this->db->prepare("SELECT COUNT(*) AS checkin_days, MAX(checkin_date) AS last_checkin_date
            FROM user_checkins WHERE user_id = :user_id");
        $Silian_checkinStmt->execute([':user_id' => $Silian_userId]);
        $Silian_checkins = $Silian_checkinStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $Silian_badgeStmt = $this->db->prepare("SELECT COUNT(*) AS badge_count FROM user_badges WHERE user_id = :user_id");
        $Silian_badgeStmt->execute([':user_id' => $Silian_userId]);
        $Silian_badgeCount = (int) $Silian_badgeStmt->fetchColumn();

        $Silian_passkeyStmt = $this->db->prepare("SELECT COUNT(*) AS passkey_count, MAX(last_used_at) AS last_used_at
            FROM user_passkeys
            WHERE disabled_at IS NULL
              AND LOWER(user_uuid) = :user_uuid");
        $Silian_passkeyStmt->execute([':user_uuid' => $Silian_userUuid]);
        $Silian_passkeys = $Silian_passkeyStmt->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'scope' => 'user_overview',
            'user' => [
                'id' => $Silian_userId,
                'uuid' => $Silian_user['uuid'] ?? null,
                'username' => $Silian_user['username'] ?? null,
                'email' => $Silian_user['email'] ?? null,
                'status' => $Silian_user['status'] ?? null,
                'points' => isset($Silian_user['points']) ? (int) $Silian_user['points'] : 0,
                'is_admin' => !empty($Silian_user['is_admin']),
                'school_name' => $Silian_user['school_name'] ?? null,
                'group_name' => $Silian_user['group_name'] ?? null,
                'created_at' => $Silian_user['created_at'] ?? null,
                'last_login_at' => $Silian_user['lastlgn'] ?? null,
            ],
            'metrics' => [
                'total_carbon_saved' => isset($Silian_carbon['total_carbon_saved']) ? (float) $Silian_carbon['total_carbon_saved'] : 0.0,
                'approved_records' => (int) ($Silian_carbon['approved_records'] ?? 0),
                'pending_records' => (int) ($Silian_carbon['pending_records'] ?? 0),
                'checkin_days' => (int) ($Silian_checkins['checkin_days'] ?? 0),
                'last_checkin_date' => $Silian_checkins['last_checkin_date'] ?? null,
                'badge_count' => $Silian_badgeCount,
                'passkey_count' => (int) ($Silian_passkeys['passkey_count'] ?? 0),
                'last_passkey_used_at' => $Silian_passkeys['last_used_at'] ?? null,
            ],
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function queryExchangeOrders(array $Silian_payload): array
    {
        $Silian_limit = max(1, min(20, (int) ($Silian_payload['limit'] ?? 10)));
        $Silian_status = strtolower(trim((string) ($Silian_payload['status'] ?? '')));
        $Silian_search = trim((string) ($Silian_payload['search'] ?? $Silian_payload['q'] ?? ''));
        $Silian_userId = isset($Silian_payload['user_id']) && is_numeric((string) $Silian_payload['user_id']) ? (int) $Silian_payload['user_id'] : null;
        $Silian_userColumn = $this->resolvePointExchangeUserColumn();

        $Silian_where = ['e.deleted_at IS NULL'];
        $Silian_params = [];
        if ($Silian_status !== '') {
            $Silian_where[] = 'LOWER(e.status) = :status';
            $Silian_params[':status'] = $Silian_status;
        }
        if ($Silian_userId !== null && $Silian_userId > 0) {
            $Silian_where[] = "e.{$Silian_userColumn} = :user_id";
            $Silian_params[':user_id'] = $Silian_userId;
        }
        if ($Silian_search !== '') {
            [$Silian_searchCondition, $Silian_searchParams] = $this->buildLikeCondition(
                [
                    'LOWER(e.id)',
                    'LOWER(COALESCE(e.product_name, \'\'))',
                    'LOWER(COALESCE(e.tracking_number, \'\'))',
                    'LOWER(COALESCE(u.username, \'\'))',
                    'LOWER(COALESCE(u.email, \'\'))',
                ],
                'exchange_search',
                '%' . strtolower($Silian_search) . '%'
            );
            $Silian_where[] = $Silian_searchCondition;
            $Silian_params += $Silian_searchParams;
        }

        $Silian_sort = strtolower(trim((string) ($Silian_payload['sort'] ?? 'created_at_desc')));
        $Silian_orderBy = match ($Silian_sort) {
            'created_at_asc' => 'e.created_at ASC, e.id ASC',
            'status_asc' => 'e.status ASC, e.created_at DESC',
            'points_desc' => 'e.points_used DESC, e.created_at DESC',
            default => 'e.created_at DESC, e.id DESC',
        };

        $Silian_sql = "SELECT e.id, e.status, e.product_name, e.quantity, e.points_used, e.tracking_number, e.created_at,
                       e.updated_at, e.notes, e.{$Silian_userColumn} AS exchange_user_id, u.username, u.email
                FROM point_exchanges e
                LEFT JOIN users u ON u.id = e.{$Silian_userColumn}
                WHERE " . implode(' AND ', $Silian_where) . "
                ORDER BY {$Silian_orderBy}
                LIMIT :limit";
        $Silian_stmt = $this->db->prepare($Silian_sql);
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_stmt->bindValue($Silian_key, $Silian_value);
        }
        $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
        $Silian_stmt->execute();

        $Silian_items = [];
        foreach ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $Silian_row) {
            $Silian_items[] = [
                'id' => $Silian_row['id'] ?? null,
                'status' => $Silian_row['status'] ?? null,
                'product_name' => $Silian_row['product_name'] ?? null,
                'quantity' => isset($Silian_row['quantity']) ? (int) $Silian_row['quantity'] : null,
                'points_used' => isset($Silian_row['points_used']) ? (int) $Silian_row['points_used'] : null,
                'tracking_number' => $Silian_row['tracking_number'] ?? null,
                'user_id' => isset($Silian_row['exchange_user_id']) ? (int) $Silian_row['exchange_user_id'] : null,
                'username' => $Silian_row['username'] ?? null,
                'email' => $Silian_row['email'] ?? null,
                'created_at' => $Silian_row['created_at'] ?? null,
                'updated_at' => $Silian_row['updated_at'] ?? null,
            ];
        }

        $Silian_countStmt = $this->db->prepare("SELECT COUNT(*)
            FROM point_exchanges e
            LEFT JOIN users u ON u.id = e.{$Silian_userColumn}
            WHERE " . implode(' AND ', $Silian_where));
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_countStmt->bindValue($Silian_key, $Silian_value);
        }
        $Silian_countStmt->execute();

        return [
            'scope' => 'exchange_orders',
            'status' => $Silian_status !== '' ? $Silian_status : null,
            'total' => (int) $Silian_countStmt->fetchColumn(),
            'items' => $Silian_items,
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function queryExchangeOrderDetail(array $Silian_payload): array
    {
        $Silian_exchangeId = trim((string) ($Silian_payload['exchange_id'] ?? ''));
        if ($Silian_exchangeId === '') {
            throw new \RuntimeException('exchange_id is required.');
        }

        $Silian_exchange = $this->fetchExchangeRecordById($Silian_exchangeId);
        if ($Silian_exchange === null) {
            throw new \RuntimeException('Exchange order not found.');
        }

        $Silian_userColumn = $this->resolvePointExchangeUserColumn();

        return [
            'scope' => 'exchange_order_detail',
            'exchange' => [
                'id' => $Silian_exchange['id'] ?? null,
                'status' => $Silian_exchange['status'] ?? null,
                'product_id' => isset($Silian_exchange['product_id']) ? (int) $Silian_exchange['product_id'] : null,
                'product_name' => $Silian_exchange['product_name'] ?? null,
                'quantity' => isset($Silian_exchange['quantity']) ? (int) $Silian_exchange['quantity'] : null,
                'points_used' => isset($Silian_exchange['points_used']) ? (int) $Silian_exchange['points_used'] : null,
                'tracking_number' => $Silian_exchange['tracking_number'] ?? null,
                'delivery_address' => $Silian_exchange['delivery_address'] ?? null,
                'contact_phone' => $Silian_exchange['contact_phone'] ?? null,
                'notes' => $Silian_exchange['notes'] ?? null,
                'user_id' => isset($Silian_exchange[$Silian_userColumn]) ? (int) $Silian_exchange[$Silian_userColumn] : null,
                'username' => $Silian_exchange['username'] ?? null,
                'email' => $Silian_exchange['email'] ?? null,
                'created_at' => $Silian_exchange['created_at'] ?? null,
                'updated_at' => $Silian_exchange['updated_at'] ?? null,
            ],
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function queryProductCatalog(array $Silian_payload): array
    {
        $Silian_limit = max(1, min(20, (int) ($Silian_payload['limit'] ?? 10)));
        $Silian_status = strtolower(trim((string) ($Silian_payload['status'] ?? '')));
        $Silian_category = trim((string) ($Silian_payload['category'] ?? ''));
        $Silian_search = trim((string) ($Silian_payload['search'] ?? $Silian_payload['q'] ?? ''));

        $Silian_where = ['p.deleted_at IS NULL'];
        $Silian_params = [];
        if ($Silian_status !== '') {
            $Silian_where[] = 'LOWER(p.status) = :status';
            $Silian_params[':status'] = $Silian_status;
        }
        if ($Silian_category !== '') {
            $Silian_where[] = '(p.category = :category OR p.category_slug = :category_slug)';
            $Silian_params[':category'] = $Silian_category;
            $Silian_params[':category_slug'] = strtolower($Silian_category);
        }
        if ($Silian_search !== '') {
            [$Silian_searchCondition, $Silian_searchParams] = $this->buildLikeCondition(
                ['LOWER(p.name)', 'LOWER(COALESCE(p.description, \'\'))'],
                'product_search',
                '%' . strtolower($Silian_search) . '%'
            );
            $Silian_where[] = $Silian_searchCondition;
            $Silian_params += $Silian_searchParams;
        }

        $Silian_sort = strtolower(trim((string) ($Silian_payload['sort'] ?? 'created_at_desc')));
        $Silian_orderBy = match ($Silian_sort) {
            'points_asc' => 'p.points_required ASC, p.id ASC',
            'points_desc' => 'p.points_required DESC, p.id DESC',
            'stock_desc' => 'p.stock DESC, p.id DESC',
            'created_at_asc' => 'p.created_at ASC, p.id ASC',
            default => 'p.created_at DESC, p.id DESC',
        };

        $Silian_sql = "SELECT p.id, p.name, p.category, p.category_slug, p.points_required, p.stock, p.status, p.created_at,
                       COALESCE(e.total_exchanged, 0) AS total_exchanged
                FROM products p
                LEFT JOIN (
                    SELECT product_id, COUNT(*) AS total_exchanged
                    FROM point_exchanges
                    WHERE deleted_at IS NULL
                    GROUP BY product_id
                ) e ON e.product_id = p.id
                WHERE " . implode(' AND ', $Silian_where) . "
                ORDER BY {$Silian_orderBy}
                LIMIT :limit";
        $Silian_stmt = $this->db->prepare($Silian_sql);
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_stmt->bindValue($Silian_key, $Silian_value);
        }
        $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
        $Silian_stmt->execute();

        $Silian_items = [];
        foreach ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $Silian_row) {
            $Silian_items[] = [
                'id' => isset($Silian_row['id']) ? (int) $Silian_row['id'] : null,
                'name' => $Silian_row['name'] ?? null,
                'category' => $Silian_row['category'] ?? null,
                'category_slug' => $Silian_row['category_slug'] ?? null,
                'points_required' => isset($Silian_row['points_required']) ? (int) $Silian_row['points_required'] : 0,
                'stock' => isset($Silian_row['stock']) ? (int) $Silian_row['stock'] : 0,
                'status' => $Silian_row['status'] ?? null,
                'total_exchanged' => isset($Silian_row['total_exchanged']) ? (int) $Silian_row['total_exchanged'] : 0,
                'created_at' => $Silian_row['created_at'] ?? null,
            ];
        }

        $Silian_countStmt = $this->db->prepare("SELECT COUNT(*) FROM products p WHERE " . implode(' AND ', $Silian_where));
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_countStmt->bindValue($Silian_key, $Silian_value);
        }
        $Silian_countStmt->execute();

        return [
            'scope' => 'product_catalog',
            'total' => (int) $Silian_countStmt->fetchColumn(),
            'items' => $Silian_items,
        ];
    }

    /**
     * @return array<string,mixed>
     */
    private function queryPasskeyAdminStats(): array
    {
        $Silian_statsStmt = $this->db->query("SELECT
                COUNT(*) AS total_passkeys,
                COUNT(DISTINCT user_uuid) AS users_with_passkeys,
                SUM(CASE WHEN backup_eligible = 1 THEN 1 ELSE 0 END) AS backup_eligible_count,
                SUM(CASE WHEN backup_state = 1 THEN 1 ELSE 0 END) AS backup_state_count,
                SUM(CASE WHEN last_used_at IS NULL THEN 1 ELSE 0 END) AS never_used_count,
                MAX(last_used_at) AS last_used_at
            FROM user_passkeys
            WHERE disabled_at IS NULL");
        $Silian_stats = $Silian_statsStmt instanceof \PDOStatement ? ($Silian_statsStmt->fetch(PDO::FETCH_ASSOC) ?: []) : [];

        $Silian_recentStmt = $this->db->query("SELECT COUNT(*) FROM user_passkeys
            WHERE disabled_at IS NULL
              AND last_used_at IS NOT NULL
              AND last_used_at >= datetime('now', '-30 day')");

        return [
            'scope' => 'passkey_admin_stats',
            'total_passkeys' => (int) ($Silian_stats['total_passkeys'] ?? 0),
            'users_with_passkeys' => (int) ($Silian_stats['users_with_passkeys'] ?? 0),
            'backup_eligible_count' => (int) ($Silian_stats['backup_eligible_count'] ?? 0),
            'backup_state_count' => (int) ($Silian_stats['backup_state_count'] ?? 0),
            'never_used_count' => (int) ($Silian_stats['never_used_count'] ?? 0),
            'used_recently_30d' => (int) (($Silian_recentStmt instanceof \PDOStatement ? $Silian_recentStmt->fetchColumn() : 0) ?: 0),
            'last_used_at' => $Silian_stats['last_used_at'] ?? null,
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function queryPasskeyAdminList(array $Silian_payload): array
    {
        $Silian_limit = max(1, min(20, (int) ($Silian_payload['limit'] ?? 10)));
        $Silian_search = trim((string) ($Silian_payload['search'] ?? $Silian_payload['q'] ?? ''));
        $Silian_userId = isset($Silian_payload['user_id']) && is_numeric((string) $Silian_payload['user_id']) ? (int) $Silian_payload['user_id'] : null;

        $Silian_where = ['pk.disabled_at IS NULL'];
        $Silian_params = [];
        if ($Silian_search !== '') {
            [$Silian_searchCondition, $Silian_searchParams] = $this->buildLikeCondition(
                [
                    'LOWER(COALESCE(pk.label, \'\'))',
                    'LOWER(COALESCE(u.username, \'\'))',
                    'LOWER(COALESCE(u.email, \'\'))',
                    'LOWER(COALESCE(pk.user_uuid, \'\'))',
                ],
                'passkey_search',
                '%' . strtolower($Silian_search) . '%'
            );
            $Silian_where[] = $Silian_searchCondition;
            $Silian_params += $Silian_searchParams;
        }
        if ($Silian_userId !== null && $Silian_userId > 0) {
            $Silian_where[] = 'u.id = :user_id';
            $Silian_params[':user_id'] = $Silian_userId;
        }

        $Silian_sort = strtolower(trim((string) ($Silian_payload['sort'] ?? 'last_used_at_desc')));
        $Silian_orderBy = match ($Silian_sort) {
            'created_at_desc' => 'pk.created_at DESC, pk.id DESC',
            'sign_count_desc' => 'pk.sign_count DESC, pk.id DESC',
            default => 'pk.last_used_at DESC, pk.id DESC',
        };

        $Silian_sql = "SELECT pk.id, pk.user_uuid, pk.label, pk.sign_count, pk.backup_eligible, pk.backup_state,
                       pk.last_used_at, pk.created_at, u.id AS user_id, u.username, u.email
                FROM user_passkeys pk
                LEFT JOIN users u ON LOWER(u.uuid) = LOWER(pk.user_uuid)
                WHERE " . implode(' AND ', $Silian_where) . "
                ORDER BY {$Silian_orderBy}
                LIMIT :limit";
        $Silian_stmt = $this->db->prepare($Silian_sql);
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_stmt->bindValue($Silian_key, $Silian_value);
        }
        $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
        $Silian_stmt->execute();

        $Silian_items = [];
        foreach ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $Silian_row) {
            $Silian_items[] = [
                'id' => isset($Silian_row['id']) ? (int) $Silian_row['id'] : null,
                'user_id' => isset($Silian_row['user_id']) ? (int) $Silian_row['user_id'] : null,
                'user_uuid' => $Silian_row['user_uuid'] ?? null,
                'username' => $Silian_row['username'] ?? null,
                'email' => $Silian_row['email'] ?? null,
                'label' => $Silian_row['label'] ?? null,
                'sign_count' => isset($Silian_row['sign_count']) ? (int) $Silian_row['sign_count'] : 0,
                'backup_eligible' => !empty($Silian_row['backup_eligible']),
                'backup_state' => !empty($Silian_row['backup_state']),
                'last_used_at' => $Silian_row['last_used_at'] ?? null,
                'created_at' => $Silian_row['created_at'] ?? null,
            ];
        }

        $Silian_countStmt = $this->db->prepare("SELECT COUNT(*)
            FROM user_passkeys pk
            LEFT JOIN users u ON LOWER(u.uuid) = LOWER(pk.user_uuid)
            WHERE " . implode(' AND ', $Silian_where));
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_countStmt->bindValue($Silian_key, $Silian_value);
        }
        $Silian_countStmt->execute();

        return [
            'scope' => 'passkey_admin_list',
            'total' => (int) $Silian_countStmt->fetchColumn(),
            'items' => $Silian_items,
        ];
    }

    /**
     * @return array<string,mixed>
     */
    private function queryCronTasks(): array
    {
        if ($this->cronSchedulerService !== null) {
            $Silian_items = $this->cronSchedulerService->listTasks();
            return [
                'scope' => 'cron_tasks',
                'total' => count($Silian_items),
                'items' => $Silian_items,
            ];
        }

        $Silian_stmt = $this->db->query("SELECT
                task_key,
                task_name,
                description,
                interval_minutes,
                enabled,
                next_run_at,
                last_started_at,
                last_finished_at,
                last_status,
                last_error,
                last_duration_ms,
                consecutive_failures,
                lock_token,
                locked_at,
                settings_json
            FROM cron_tasks
            ORDER BY task_key ASC");

        $Silian_items = [];
        foreach (($Silian_stmt?->fetchAll(PDO::FETCH_ASSOC)) ?: [] as $Silian_row) {
            $Silian_settings = $this->decodeJson($Silian_row['settings_json'] ?? null);
            $Silian_items[] = [
                'task_key' => $Silian_row['task_key'] ?? null,
                'task_name' => $Silian_row['task_name'] ?? null,
                'description' => $Silian_row['description'] ?? null,
                'interval_minutes' => isset($Silian_row['interval_minutes']) ? (int) $Silian_row['interval_minutes'] : 0,
                'enabled' => !empty($Silian_row['enabled']),
                'next_run_at' => $Silian_row['next_run_at'] ?? null,
                'last_started_at' => $Silian_row['last_started_at'] ?? null,
                'last_finished_at' => $Silian_row['last_finished_at'] ?? null,
                'last_status' => $Silian_row['last_status'] ?? null,
                'last_error' => $Silian_row['last_error'] ?? null,
                'last_duration_ms' => isset($Silian_row['last_duration_ms']) ? (int) $Silian_row['last_duration_ms'] : null,
                'consecutive_failures' => isset($Silian_row['consecutive_failures']) ? (int) $Silian_row['consecutive_failures'] : 0,
                'locked_at' => $Silian_row['locked_at'] ?? null,
                'settings' => $Silian_settings,
                'is_due' => !empty($Silian_row['enabled']) && !empty($Silian_row['next_run_at']) && ($Silian_row['next_run_at'] <= $this->currentCronNow()),
                'is_locked' => !empty($Silian_row['lock_token']) && !empty($Silian_row['locked_at']),
            ];
        }

        return [
            'scope' => 'cron_tasks',
            'total' => count($Silian_items),
            'items' => $Silian_items,
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function queryCronRuns(array $Silian_payload): array
    {
        if ($this->cronSchedulerService !== null) {
            $Silian_result = $this->cronSchedulerService->listRuns($Silian_payload);
            return [
                'scope' => 'cron_runs',
                'total' => (int) (($Silian_result['pagination']['total'] ?? 0)),
                'items' => $Silian_result['items'] ?? [],
                'pagination' => $Silian_result['pagination'] ?? null,
            ];
        }

        $Silian_page = max(1, (int) ($Silian_payload['page'] ?? 1));
        $Silian_limit = max(1, min(100, (int) ($Silian_payload['limit'] ?? 20)));
        $Silian_status = strtolower(trim((string) ($Silian_payload['status'] ?? '')));
        $Silian_taskKey = trim((string) ($Silian_payload['task_key'] ?? ''));
        $Silian_triggerSource = strtolower(trim((string) ($Silian_payload['trigger_source'] ?? '')));
        $Silian_validStatuses = ['success', 'failed', 'skipped'];
        $Silian_validSources = ['cron_endpoint', 'legacy_endpoint', 'admin_manual'];

        $Silian_where = ['1 = 1'];
        $Silian_params = [];
        if ($Silian_taskKey !== '') {
            $Silian_where[] = 'task_key = :task_key';
            $Silian_params[':task_key'] = $Silian_taskKey;
        }
        if ($Silian_status !== '') {
            if (!in_array($Silian_status, $Silian_validStatuses, true)) {
                throw new \InvalidArgumentException('Invalid cron run status');
            }
            $Silian_where[] = 'status = :status';
            $Silian_params[':status'] = $Silian_status;
        }
        if ($Silian_triggerSource !== '') {
            if (!in_array($Silian_triggerSource, $Silian_validSources, true)) {
                throw new \InvalidArgumentException('Invalid cron trigger source');
            }
            $Silian_where[] = 'trigger_source = :trigger_source';
            $Silian_params[':trigger_source'] = $Silian_triggerSource;
        }

        $Silian_countStmt = $this->db->prepare('SELECT COUNT(*) FROM cron_runs WHERE ' . implode(' AND ', $Silian_where));
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_countStmt->bindValue($Silian_key, $Silian_value);
        }
        $Silian_countStmt->execute();
        $Silian_total = (int) $Silian_countStmt->fetchColumn();

        $Silian_sql = 'SELECT id, task_key, trigger_source, request_id, status, started_at, finished_at, duration_ms, result_json, error_message, created_at
            FROM cron_runs
            WHERE ' . implode(' AND ', $Silian_where) . '
            ORDER BY id DESC
            LIMIT :limit OFFSET :offset';
        $Silian_stmt = $this->db->prepare($Silian_sql);
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_stmt->bindValue($Silian_key, $Silian_value);
        }
        $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
        $Silian_stmt->bindValue(':offset', ($Silian_page - 1) * $Silian_limit, PDO::PARAM_INT);
        $Silian_stmt->execute();

        $Silian_items = [];
        foreach (($Silian_stmt->fetchAll(PDO::FETCH_ASSOC)) ?: [] as $Silian_row) {
            $Silian_items[] = [
                'id' => isset($Silian_row['id']) ? (int) $Silian_row['id'] : null,
                'task_key' => $Silian_row['task_key'] ?? null,
                'trigger_source' => $Silian_row['trigger_source'] ?? null,
                'request_id' => $Silian_row['request_id'] ?? null,
                'status' => $Silian_row['status'] ?? null,
                'started_at' => $Silian_row['started_at'] ?? null,
                'finished_at' => $Silian_row['finished_at'] ?? null,
                'duration_ms' => isset($Silian_row['duration_ms']) ? (int) $Silian_row['duration_ms'] : null,
                'result' => $this->decodeJson($Silian_row['result_json'] ?? null),
                'error_message' => $Silian_row['error_message'] ?? null,
                'created_at' => $Silian_row['created_at'] ?? null,
            ];
        }

        return [
            'scope' => 'cron_runs',
            'total' => $Silian_total,
            'items' => $Silian_items,
            'pagination' => [
                'page' => $Silian_page,
                'limit' => $Silian_limit,
                'total' => $Silian_total,
            ],
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function querySystemLogs(array $Silian_payload): array
    {
        $Silian_limit = max(1, min(20, (int) ($Silian_payload['limit'] ?? 10)));
        $Silian_search = trim((string) ($Silian_payload['q'] ?? $Silian_payload['search'] ?? ''));
        $Silian_requestId = trim((string) ($Silian_payload['request_id'] ?? ''));
        $Silian_conversationId = $this->normalizeConversationId(isset($Silian_payload['conversation_id']) ? (string) $Silian_payload['conversation_id'] : null);
        $Silian_requestedTypes = is_array($Silian_payload['types'] ?? null) ? $Silian_payload['types'] : ['audit', 'llm', 'error'];
        $Silian_allowedTypes = ['audit', 'llm', 'error', 'system'];
        $Silian_types = array_values(array_intersect($Silian_allowedTypes, array_map(static fn ($Silian_item) => strtolower(trim((string) $Silian_item)), $Silian_requestedTypes)));
        if ($Silian_types === []) {
            $Silian_types = ['audit', 'llm', 'error'];
        }

        $Silian_items = [];
        $Silian_searchLike = $Silian_search !== '' ? '%' . strtolower($Silian_search) . '%' : null;

        if (in_array('audit', $Silian_types, true)) {
            $Silian_sql = "SELECT id, action, request_id, conversation_id, data, created_at
                FROM audit_logs
                WHERE operation_category = 'admin_ai'";
            $Silian_params = [];
            if ($Silian_requestId !== '') {
                $Silian_sql .= " AND request_id = :request_id";
                $Silian_params[':request_id'] = $Silian_requestId;
            }
            if ($Silian_conversationId !== null) {
                $Silian_sql .= " AND conversation_id = :conversation_id";
                $Silian_params[':conversation_id'] = $Silian_conversationId;
            }
            if ($Silian_searchLike !== null) {
                [$Silian_searchCondition, $Silian_searchParams] = $this->buildLikeCondition(
                    ['LOWER(action)', 'LOWER(COALESCE(data, \'\'))'],
                    'audit_search',
                    $Silian_searchLike
                );
                $Silian_sql .= " AND {$Silian_searchCondition}";
                $Silian_params += $Silian_searchParams;
            }
            $Silian_sql .= " ORDER BY created_at DESC, id DESC LIMIT :limit";
            $Silian_stmt = $this->db->prepare($Silian_sql);
            foreach ($Silian_params as $Silian_key => $Silian_value) {
                $Silian_stmt->bindValue($Silian_key, $Silian_value);
            }
            $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
            $Silian_stmt->execute();
            foreach ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $Silian_row) {
                $Silian_data = $this->decodeJson($Silian_row['data'] ?? null);
                $Silian_items[] = [
                    'type' => 'audit',
                    'id' => (int) ($Silian_row['id'] ?? 0),
                    'request_id' => $Silian_row['request_id'] ?? null,
                    'conversation_id' => $Silian_row['conversation_id'] ?? null,
                    'summary' => $Silian_data['visible_text'] ?? ($Silian_row['action'] ?? null),
                    'created_at' => $Silian_row['created_at'] ?? null,
                ];
            }
        }

        if (in_array('llm', $Silian_types, true)) {
            $Silian_sql = "SELECT id, request_id, conversation_id, turn_no, model, total_tokens, created_at
                FROM llm_logs
                WHERE 1 = 1";
            $Silian_params = [];
            if ($Silian_requestId !== '') {
                $Silian_sql .= " AND request_id = :request_id";
                $Silian_params[':request_id'] = $Silian_requestId;
            }
            if ($Silian_conversationId !== null) {
                $Silian_sql .= " AND conversation_id = :conversation_id";
                $Silian_params[':conversation_id'] = $Silian_conversationId;
            }
            if ($Silian_searchLike !== null) {
                [$Silian_searchCondition, $Silian_searchParams] = $this->buildLikeCondition(
                    [
                        'LOWER(COALESCE(model, \'\'))',
                        'LOWER(COALESCE(prompt, \'\'))',
                        'LOWER(COALESCE(response_raw, \'\'))',
                    ],
                    'llm_search',
                    $Silian_searchLike
                );
                $Silian_sql .= " AND {$Silian_searchCondition}";
                $Silian_params += $Silian_searchParams;
            }
            $Silian_sql .= " ORDER BY created_at DESC, id DESC LIMIT :limit";
            $Silian_stmt = $this->db->prepare($Silian_sql);
            foreach ($Silian_params as $Silian_key => $Silian_value) {
                $Silian_stmt->bindValue($Silian_key, $Silian_value);
            }
            $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
            $Silian_stmt->execute();
            foreach ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $Silian_row) {
                $Silian_items[] = [
                    'type' => 'llm',
                    'id' => (int) ($Silian_row['id'] ?? 0),
                    'request_id' => $Silian_row['request_id'] ?? null,
                    'conversation_id' => $Silian_row['conversation_id'] ?? null,
                    'turn_no' => isset($Silian_row['turn_no']) ? (int) $Silian_row['turn_no'] : null,
                    'summary' => sprintf('%s / %s tokens', (string) ($Silian_row['model'] ?? 'unknown-model'), (string) ($Silian_row['total_tokens'] ?? 0)),
                    'created_at' => $Silian_row['created_at'] ?? null,
                ];
            }
        }

        if (in_array('error', $Silian_types, true)) {
            $Silian_sql = "SELECT id, request_id, error_type, error_message, created_at
                FROM error_logs
                WHERE 1 = 1";
            $Silian_params = [];
            if ($Silian_requestId !== '') {
                $Silian_sql .= " AND request_id = :request_id";
                $Silian_params[':request_id'] = $Silian_requestId;
            }
            if ($Silian_searchLike !== null) {
                [$Silian_searchCondition, $Silian_searchParams] = $this->buildLikeCondition(
                    ['LOWER(COALESCE(error_type, \'\'))', 'LOWER(COALESCE(error_message, \'\'))'],
                    'error_search',
                    $Silian_searchLike
                );
                $Silian_sql .= " AND {$Silian_searchCondition}";
                $Silian_params += $Silian_searchParams;
            }
            $Silian_sql .= " ORDER BY created_at DESC, id DESC LIMIT :limit";
            $Silian_stmt = $this->db->prepare($Silian_sql);
            foreach ($Silian_params as $Silian_key => $Silian_value) {
                $Silian_stmt->bindValue($Silian_key, $Silian_value);
            }
            $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
            $Silian_stmt->execute();
            foreach ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $Silian_row) {
                $Silian_items[] = [
                    'type' => 'error',
                    'id' => (int) ($Silian_row['id'] ?? 0),
                    'request_id' => $Silian_row['request_id'] ?? null,
                    'summary' => trim((string) (($Silian_row['error_type'] ?? 'error') . ': ' . ($Silian_row['error_message'] ?? ''))),
                    'created_at' => $Silian_row['created_at'] ?? null,
                ];
            }
        }

        if (in_array('system', $Silian_types, true)) {
            $Silian_sql = "SELECT id, request_id, method, path, status_code, created_at
                FROM system_logs
                WHERE 1 = 1";
            $Silian_params = [];
            if ($Silian_requestId !== '') {
                $Silian_sql .= " AND request_id = :request_id";
                $Silian_params[':request_id'] = $Silian_requestId;
            }
            if ($Silian_searchLike !== null) {
                [$Silian_searchCondition, $Silian_searchParams] = $this->buildLikeCondition(
                    ['LOWER(COALESCE(method, \'\'))', 'LOWER(COALESCE(path, \'\'))'],
                    'system_search',
                    $Silian_searchLike
                );
                $Silian_sql .= " AND {$Silian_searchCondition}";
                $Silian_params += $Silian_searchParams;
            }
            $Silian_sql .= " ORDER BY created_at DESC, id DESC LIMIT :limit";
            $Silian_stmt = $this->db->prepare($Silian_sql);
            foreach ($Silian_params as $Silian_key => $Silian_value) {
                $Silian_stmt->bindValue($Silian_key, $Silian_value);
            }
            $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
            $Silian_stmt->execute();
            foreach ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $Silian_row) {
                $Silian_items[] = [
                    'type' => 'system',
                    'id' => (int) ($Silian_row['id'] ?? 0),
                    'request_id' => $Silian_row['request_id'] ?? null,
                    'summary' => trim((string) (($Silian_row['method'] ?? 'GET') . ' ' . ($Silian_row['path'] ?? '/') . ' [' . ($Silian_row['status_code'] ?? '?') . ']')),
                    'created_at' => $Silian_row['created_at'] ?? null,
                ];
            }
        }

        usort($Silian_items, static function (array $Silian_left, array $Silian_right): int {
            return strcmp((string) ($Silian_right['created_at'] ?? ''), (string) ($Silian_left['created_at'] ?? ''));
        });
        $Silian_items = array_slice($Silian_items, 0, $Silian_limit);

        return [
            'scope' => 'system_logs',
            'returned_count' => count($Silian_items),
            'items' => $Silian_items,
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function queryBroadcastHistory(array $Silian_payload): array
    {
        $Silian_limit = max(1, min(20, (int) ($Silian_payload['limit'] ?? 10)));
        $Silian_sql = "SELECT id, title, priority, scope, target_count, sent_count, created_by, created_at
            FROM message_broadcasts
            ORDER BY id DESC
            LIMIT :limit";
        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
        $Silian_stmt->execute();

        $Silian_items = [];
        foreach ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $Silian_row) {
            $Silian_items[] = [
                'id' => isset($Silian_row['id']) ? (int) $Silian_row['id'] : null,
                'title' => $Silian_row['title'] ?? null,
                'priority' => $Silian_row['priority'] ?? null,
                'scope' => $Silian_row['scope'] ?? null,
                'target_count' => isset($Silian_row['target_count']) ? (int) $Silian_row['target_count'] : 0,
                'sent_count' => isset($Silian_row['sent_count']) ? (int) $Silian_row['sent_count'] : 0,
                'created_by' => isset($Silian_row['created_by']) ? (int) $Silian_row['created_by'] : null,
                'created_at' => $Silian_row['created_at'] ?? null,
            ];
        }

        $Silian_countStmt = $this->db->query("SELECT COUNT(*) FROM message_broadcasts");

        return [
            'scope' => 'broadcast_history',
            'total' => (int) (($Silian_countStmt instanceof \PDOStatement ? $Silian_countStmt->fetchColumn() : 0) ?: 0),
            'items' => $Silian_items,
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function queryBroadcastRecipients(array $Silian_payload): array
    {
        $Silian_users = $this->queryUsers([
            'search' => $Silian_payload['search'] ?? $Silian_payload['q'] ?? '',
            'status' => $Silian_payload['status'] ?? null,
            'limit' => $Silian_payload['limit'] ?? 20,
        ]);

        return [
            'scope' => 'broadcast_recipients',
            'total' => $Silian_users['total'] ?? 0,
            'items' => $Silian_users['items'] ?? [],
        ];
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>|null
     */
    private function resolveUserRowFromPayload(array $Silian_payload): ?array
    {
        $Silian_userId = isset($Silian_payload['user_id']) && is_numeric((string) $Silian_payload['user_id']) ? (int) $Silian_payload['user_id'] : null;
        $Silian_userUuid = strtolower(trim((string) ($Silian_payload['user_uuid'] ?? '')));

        $Silian_where = ['u.deleted_at IS NULL'];
        $Silian_params = [];
        if ($Silian_userId !== null && $Silian_userId > 0) {
            $Silian_where[] = 'u.id = :user_id';
            $Silian_params[':user_id'] = $Silian_userId;
        } elseif ($Silian_userUuid !== '') {
            $Silian_where[] = 'LOWER(u.uuid) = :user_uuid';
            $Silian_params[':user_uuid'] = $Silian_userUuid;
        } else {
            return null;
        }

        $Silian_stmt = $this->db->prepare("SELECT u.*, s.name AS school_name, g.name AS group_name
            FROM users u
            LEFT JOIN schools s ON s.id = u.school_id
            LEFT JOIN user_groups g ON g.id = u.group_id
            WHERE " . implode(' AND ', $Silian_where) . "
            LIMIT 1");
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_stmt->bindValue($Silian_key, $Silian_value);
        }
        $Silian_stmt->execute();

        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($Silian_row) ? $Silian_row : null;
    }

    private function resolvePointExchangeUserColumn(): string
    {
        static $Silian_resolved = null;
        if ($Silian_resolved !== null) {
            return $Silian_resolved;
        }

        $Silian_resolved = 'user_id';
        try {
            $Silian_driver = (string) ($this->db->getAttribute(PDO::ATTR_DRIVER_NAME) ?: 'mysql');
            if ($Silian_driver === 'sqlite') {
                $Silian_stmt = $this->db->query("PRAGMA table_info(point_exchanges)");
                $Silian_columns = $Silian_stmt ? ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: []) : [];
                $Silian_names = array_map(static fn (array $Silian_column): string => (string) ($Silian_column['name'] ?? ''), $Silian_columns);
                if (!in_array('user_id', $Silian_names, true) && in_array('uid', $Silian_names, true)) {
                    $Silian_resolved = 'uid';
                }
            }
        } catch (\Throwable) {
        }

        return $Silian_resolved;
    }

    /**
     * @return array<string,mixed>|null
     */
    private function fetchExchangeRecordById(string $Silian_exchangeId): ?array
    {
        $Silian_userColumn = $this->resolvePointExchangeUserColumn();
        $Silian_stmt = $this->db->prepare("SELECT e.*, u.username, u.email
            FROM point_exchanges e
            LEFT JOIN users u ON u.id = e.{$Silian_userColumn}
            WHERE e.id = :exchange_id
              AND e.deleted_at IS NULL
            LIMIT 1");
        $Silian_stmt->execute([':exchange_id' => $Silian_exchangeId]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return is_array($Silian_row) ? $Silian_row : null;
    }

    private function normalizeConversationId(?string $Silian_conversationId): ?string
    {
        if (!is_string($Silian_conversationId)) {
            return null;
        }

        $Silian_normalized = trim($Silian_conversationId);
        if ($Silian_normalized === '') {
            return null;
        }

        return preg_match('/^[A-Za-z0-9._:-]{8,64}$/', $Silian_normalized) === 1 ? $Silian_normalized : null;
    }

    private function currentCronNow(): string
    {
        return (new \DateTimeImmutable('now', new \DateTimeZone('Asia/Shanghai')))->format('Y-m-d H:i:s');
    }

    /**
     * @return array<string,mixed>
     */
    private function decodeJson(mixed $Silian_raw): array
    {
        if (!is_string($Silian_raw) || $Silian_raw === '') {
            return [];
        }

        $Silian_decoded = json_decode($Silian_raw, true);
        return is_array($Silian_decoded) ? $Silian_decoded : [];
    }

    /**
     * @param array<int,string> $expressions
     * @return array{0:string,1:array<string,string>}
     */
    private function buildLikeCondition(array $Silian_expressions, string $Silian_prefix, string $Silian_pattern): array
    {
        $Silian_parts = [];
        $Silian_params = [];

        foreach (array_values($Silian_expressions) as $Silian_index => $Silian_expression) {
            $Silian_placeholder = ':' . $Silian_prefix . '_' . $Silian_index;
            $Silian_parts[] = $Silian_expression . ' LIKE ' . $Silian_placeholder;
            $Silian_params[$Silian_placeholder] = $Silian_pattern;
        }

        return ['(' . implode(' OR ', $Silian_parts) . ')', $Silian_params];
    }
}
