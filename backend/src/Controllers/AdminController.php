<?php

declare(strict_types=1);

namespace CarbonTrack\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\CloudflareR2Service;
use CarbonTrack\Services\CheckinService;
use CarbonTrack\Services\BadgeService;
use CarbonTrack\Services\StatisticsService;
use CarbonTrack\Services\QuotaConfigService;
use CarbonTrack\Services\UserProfileViewService;
use CarbonTrack\Support\InputValueNormalizer;
use CarbonTrack\Support\Uuid;
use PDO;
use DateTimeImmutable;
use DateTimeZone;

class AdminController
{
    private const SECURITY_ACTIVITY_ACTIONS = [
        'login',
        'passkey_login',
        'logout',
        'password_change',
        'passkey_registered',
        'passkey_deleted',
        'passkey_label_updated',
    ];
    private const SECURITY_ACTIVITY_TYPE_FILTERS = [
        'all' => self::SECURITY_ACTIVITY_ACTIONS,
        'sign_ins' => ['login', 'passkey_login'],
        'passkey_changes' => ['passkey_registered', 'passkey_deleted', 'passkey_label_updated'],
        'password_changes' => ['password_change'],
        'logouts' => ['logout'],
    ];
    private const SECURITY_ACTIVITY_PERIOD_FILTERS = [
        'all' => null,
        '7d' => 7,
        '30d' => 30,
        '90d' => 90,
    ];

    private UserProfileViewService $userProfileViewService;

    public function __construct(
        private PDO $db,
        private AuthService $authService,
        private AuditLogService $auditLog,
        private BadgeService $badgeService,
        private StatisticsService $statisticsService,
        private CheckinService $checkinService,
        private QuotaConfigService $quotaConfigService,
        UserProfileViewService $Silian_userProfileViewService,
        private ?ErrorLogService $errorLogService = null,
        private ?CloudflareR2Service $r2Service = null
    ) {
        $this->userProfileViewService = $Silian_userProfileViewService;
    }


    private ?string $lastLoginColumn = null;
    /**
     * 用户列表（带简单过滤与分页）
     */
    public function getUsers(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->jsonResponse($Silian_response, ['error' => 'Access denied'], 403);
            }

            $Silian_params = $Silian_request->getQueryParams();
            $Silian_page   = max(1, (int)($Silian_params['page'] ?? 1));
            $Silian_limit  = min(100, max(10, (int)($Silian_params['limit'] ?? 20)));
            $Silian_offset = ($Silian_page - 1) * $Silian_limit;

            $Silian_rawSearch = $Silian_params['q'] ?? $Silian_params['search'] ?? $Silian_params['keyword'] ?? $Silian_params['query'] ?? null;
            $Silian_search   = $Silian_rawSearch !== null ? trim((string)$Silian_rawSearch) : '';
            $Silian_status   = trim((string)($Silian_params['status'] ?? ''));
            $Silian_schoolId = (int)($Silian_params['school_id'] ?? 0);
            $Silian_userUuid = '';
            if (isset($Silian_params['user_uuid']) && is_string($Silian_params['user_uuid'])) {
                $Silian_userUuid = trim((string) $Silian_params['user_uuid']);
            } elseif (isset($Silian_params['userUuid']) && is_string($Silian_params['userUuid'])) {
                $Silian_userUuid = trim((string) $Silian_params['userUuid']);
            }
            $Silian_roleFilter = isset($Silian_params['role']) ? strtolower(trim((string) $Silian_params['role'])) : '';
            if (!in_array($Silian_roleFilter, ['user', 'support', 'admin'], true)) {
                $Silian_roleFilter = '';
            }
            $Silian_isAdminParam = $Silian_params['is_admin'] ?? null;
            $Silian_isAdmin  = $Silian_isAdminParam;
            if ($Silian_isAdmin !== null) {
                $Silian_normalizedIsAdmin = (string)$Silian_isAdmin;
                if (in_array($Silian_normalizedIsAdmin, ['0', '1'], true)) {
                    $Silian_isAdmin = (int)$Silian_normalizedIsAdmin;
                } else {
                    $Silian_isAdmin = null;
                }
            }
            $Silian_sort     = (string)($Silian_params['sort'] ?? 'created_at_desc');

            $Silian_where = ['u.deleted_at IS NULL'];
            $Silian_queryParams = [];
            if ($Silian_search !== '') {
                $Silian_where[] = '(u.username LIKE :search_username OR u.email LIKE :search_email OR u.uuid LIKE :search_uuid)';
                $Silian_queryParams['search_username'] = "%{$Silian_search}%";
                $Silian_queryParams['search_email'] = "%{$Silian_search}%";
                $Silian_queryParams['search_uuid'] = "%{$Silian_search}%";
            }
            if ($Silian_status !== '') {
                $Silian_where[] = 'u.status = :status';
                $Silian_queryParams['status'] = $Silian_status;
            }
            if ($Silian_userUuid !== '' && Uuid::isValid($Silian_userUuid)) {
                $Silian_where[] = 'u.uuid = :user_uuid';
                $Silian_queryParams['user_uuid'] = strtolower($Silian_userUuid);
            }
            if ($Silian_schoolId > 0) {
                $Silian_where[] = 'u.school_id = :school_id';
                $Silian_queryParams['school_id'] = $Silian_schoolId;
            }
            if ($Silian_roleFilter === 'admin') {
                $Silian_where[] = '(u.is_admin = 1 OR LOWER(COALESCE(u.role, \'user\')) = :role_admin)';
                $Silian_queryParams['role_admin'] = 'admin';
            } elseif ($Silian_roleFilter === 'support') {
                $Silian_where[] = 'u.is_admin = 0 AND LOWER(COALESCE(u.role, \'user\')) = :role_support';
                $Silian_queryParams['role_support'] = 'support';
            } elseif ($Silian_roleFilter === 'user') {
                $Silian_where[] = 'u.is_admin = 0 AND LOWER(COALESCE(u.role, \'user\')) = :role_user';
                $Silian_queryParams['role_user'] = 'user';
            } elseif ($Silian_isAdmin !== null) {
                $Silian_where[] = 'u.is_admin = :is_admin';
                $Silian_queryParams['is_admin'] = (int)$Silian_isAdmin;
            }
            $Silian_whereClause = implode(' AND ', $Silian_where);

            $Silian_sortMap = [
                'username_asc' => 'u.username ASC',
                'username_desc' => 'u.username DESC',
                'email_asc' => 'u.email ASC',
                'email_desc' => 'u.email DESC',
                'points_asc' => 'u.points ASC',
                'points_desc' => 'u.points DESC',
                'created_at_asc' => 'u.created_at ASC',
                'created_at_desc' => 'u.created_at DESC',
            ];
            $Silian_orderBy = $Silian_sortMap[$Silian_sort] ?? 'u.created_at DESC';

                        $Silian_lastLoginSelect = $this->buildLastLoginSelect('u');

$Silian_sql = "
                SELECT
                    u.id, u.uuid, u.username, u.email, u.school_id,
                    u.points, u.is_admin, u.role, u.status, u.avatar_id, u.created_at, u.updated_at,
                    u.group_id, u.quota_override, u.admin_notes,
                    {$Silian_lastLoginSelect},
                    s.name as school_name,
                    g.name as group_name,
                    a.name as avatar_name, a.file_path as avatar_path,
                    COUNT(pt.id) as total_transactions,
                    COALESCE(SUM(CASE WHEN pt.status = 'approved' THEN pt.points ELSE 0 END), 0) as earned_points,
                    COALESCE(cr.total_carbon_saved, 0) as total_carbon_saved,
                    COALESCE(uc.checkin_days, 0) as checkin_days,
                    COALESCE(uc.makeup_checkins, 0) as makeup_checkins,
                    uc.last_checkin_date,
                    COALESCE(pk.passkey_count, 0) as passkey_count,
                    pk.last_passkey_used_at,
                    COALESCE(ub.badges_awarded, 0) as badges_awarded,
                    COALESCE(ub.badges_revoked, 0) as badges_revoked,
                    COALESCE(ub.active_badges, 0) as active_badges,
                    ub.last_badge_awarded_at
                FROM users u
                LEFT JOIN schools s ON u.school_id = s.id
                LEFT JOIN user_groups g ON u.group_id = g.id
                LEFT JOIN avatars a ON u.avatar_id = a.id
                LEFT JOIN points_transactions pt ON u.id = pt.uid AND pt.deleted_at IS NULL
                LEFT JOIN (
                    SELECT user_id, COALESCE(SUM(carbon_saved), 0) AS total_carbon_saved
                    FROM carbon_records
                    WHERE status = 'approved' AND deleted_at IS NULL
                    GROUP BY user_id
                ) cr ON u.id = cr.user_id
                LEFT JOIN (
                    SELECT user_id,
                        COUNT(*) AS checkin_days,
                        SUM(CASE WHEN source = 'makeup' THEN 1 ELSE 0 END) AS makeup_checkins,
                        MAX(checkin_date) AS last_checkin_date
                    FROM user_checkins
                    GROUP BY user_id
                ) uc ON u.id = uc.user_id
                LEFT JOIN (
                    SELECT
                        user_uuid,
                        COUNT(*) AS passkey_count,
                        MAX(last_used_at) AS last_passkey_used_at
                    FROM user_passkeys
                    WHERE disabled_at IS NULL
                    GROUP BY user_uuid
                ) pk ON u.uuid = pk.user_uuid
                LEFT JOIN (
                    SELECT user_id,
                        COUNT(*) AS badge_records,
                        SUM(CASE WHEN status = 'awarded' THEN 1 ELSE 0 END) AS badges_awarded,
                        SUM(CASE WHEN status = 'revoked' THEN 1 ELSE 0 END) AS badges_revoked,
                        COUNT(DISTINCT CASE WHEN status = 'awarded' THEN badge_id ELSE NULL END) AS active_badges,
                        MAX(awarded_at) AS last_badge_awarded_at
                    FROM user_badges
                    GROUP BY user_id
                ) ub ON u.id = ub.user_id
                WHERE {$Silian_whereClause}
                GROUP BY u.id
                ORDER BY {$Silian_orderBy}
                LIMIT :limit OFFSET :offset";

            $Silian_stmt = $this->db->prepare($Silian_sql);
            foreach ($Silian_queryParams as $Silian_k => $Silian_v) {
                $Silian_stmt->bindValue(":{$Silian_k}", $Silian_v);
            }
            $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
            $Silian_stmt->bindValue(':offset', $Silian_offset, PDO::PARAM_INT);
            $Silian_stmt->execute();
            $Silian_users = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC);

            $Silian_timezoneName = $_ENV['APP_TIMEZONE'] ?? date_default_timezone_get();
            if (!$Silian_timezoneName) {
                $Silian_timezoneName = 'UTC';
            }
            $Silian_timezone = new DateTimeZone($Silian_timezoneName);
            foreach ($Silian_users as &$Silian_row) {
                $Silian_profileFields = $this->userProfileViewService->buildProfileFields($Silian_row);
                $Silian_row['school_id'] = $Silian_profileFields['school_id'];
                $Silian_row['school_name'] = $Silian_profileFields['school_name'];
                $Silian_row['is_admin'] = (bool) ($Silian_row['is_admin'] ?? false);
                $Silian_row['points'] = (float) ($Silian_row['points'] ?? 0);
                $Silian_row['total_transactions'] = (int) ($Silian_row['total_transactions'] ?? 0);
                $Silian_row['earned_points'] = (float) ($Silian_row['earned_points'] ?? 0);
                $Silian_row['total_carbon_saved'] = (float) ($Silian_row['total_carbon_saved'] ?? 0);
                $Silian_row['checkin_days'] = (int) ($Silian_row['checkin_days'] ?? 0);
                $Silian_row['makeup_checkins'] = (int) ($Silian_row['makeup_checkins'] ?? 0);
                $Silian_row['passkey_count'] = (int) ($Silian_row['passkey_count'] ?? 0);
                $Silian_row['badges_awarded'] = (int) ($Silian_row['badges_awarded'] ?? 0);
                $Silian_row['badges_revoked'] = (int) ($Silian_row['badges_revoked'] ?? 0);
                $Silian_row['active_badges'] = (int) ($Silian_row['active_badges'] ?? 0);
                $Silian_override = $this->quotaConfigService->decodeJsonToArray($Silian_row['quota_override'] ?? null);
                $Silian_row['quota_override'] = $Silian_override === null ? null : $this->quotaConfigService->normalizeQuotaConfig($Silian_override);
                $Silian_quotaOverrideConfig = is_array($Silian_row['quota_override']) ? $Silian_row['quota_override'] : [];
                $Silian_row['support_routing_override'] = $this->extractSupportRoutingOverride($Silian_quotaOverrideConfig);
                unset($Silian_quotaOverrideConfig['support_routing']);
                $Silian_row['quota_flat'] = $this->quotaConfigService->flattenQuotas($Silian_quotaOverrideConfig);
                $Silian_row['days_since_registration'] = 0;
                if (!empty($Silian_row['created_at'])) {
                    try {
                        $Silian_created = new DateTimeImmutable((string) $Silian_row['created_at'], $Silian_timezone);
                        $Silian_now = new DateTimeImmutable('now', $Silian_timezone);
                        $Silian_row['days_since_registration'] = max(0, (int) $Silian_created->diff($Silian_now)->format('%a'));
                    } catch (\Throwable $Silian_ignored) {
                        $Silian_row['days_since_registration'] = 0;
                    }
                }
            }
            unset($Silian_row);

            $Silian_countSql = "SELECT COUNT(DISTINCT u.id) FROM users u LEFT JOIN schools s ON u.school_id = s.id WHERE {$Silian_whereClause}";
            $Silian_countStmt = $this->db->prepare($Silian_countSql);
            foreach ($Silian_queryParams as $Silian_k => $Silian_v) {
                $Silian_countStmt->bindValue(":{$Silian_k}", $Silian_v);
            }
            $Silian_countStmt->execute();
            $Silian_total = (int)$Silian_countStmt->fetchColumn();

            $this->auditLog->logDataChange(
                'admin',
                'users_list',
                (int)($Silian_user['id'] ?? 0),
                'admin',
                'users',
                null,
                null,
                null,
                ['filters' => $Silian_params, 'page' => $Silian_page, 'limit' => $Silian_limit]
            );

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => [
                    'users' => $Silian_users,
                    'pagination' => [
                        'current_page' => $Silian_page,
                        'per_page' => $Silian_limit,
                        'total_items' => $Silian_total,
                        'total_pages' => $Silian_total > 0 ? (int)ceil($Silian_total / $Silian_limit) : 0
                    ]
                ]
            ]);
        } catch (\Exception $Silian_e) {
            if (($_ENV['APP_ENV'] ?? '') === 'testing') {
                throw $Silian_e;
            }
            $this->logExceptionWithFallback($Silian_e, $Silian_request, 'getUsers exception: ' . $Silian_e->getMessage() . "\n" . $Silian_e->getTraceAsString());
            return $this->jsonResponse($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    public function getUserBadges(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        return $this->getUserBadgesForTarget($Silian_request, $Silian_response, $Silian_args);
    }

    public function getUserBadgesByUuid(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        return $this->getUserBadgesForTarget($Silian_request, $Silian_response, $Silian_args);
    }

    public function getUserOverview(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        return $this->getUserOverviewForTarget($Silian_request, $Silian_response, $Silian_args);
    }

    public function getUserOverviewByUuid(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        return $this->getUserOverviewForTarget($Silian_request, $Silian_response, $Silian_args);
    }

    public function getUserSecurityActivity(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        return $this->getUserSecurityActivityForTarget($Silian_request, $Silian_response, $Silian_args);
    }

    public function getUserSecurityActivityByUuid(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        return $this->getUserSecurityActivityForTarget($Silian_request, $Silian_response, $Silian_args);
    }

    private function getUserBadgesForTarget(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_admin = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_admin || !$this->authService->isAdminUser($Silian_admin)) {
                return $this->jsonResponse($Silian_response, ['error' => 'Access denied'], 403);
            }

            $Silian_target = $this->resolveUserTarget($Silian_args);
            if ($Silian_target['error'] !== null) {
                return $this->jsonResponse($Silian_response, ['error' => $Silian_target['error']], $Silian_target['status']);
            }
            $Silian_userId = $Silian_target['user']['id'];
            $Silian_userRow = $Silian_target['user'];

            $Silian_query = $Silian_request->getQueryParams();
            $Silian_includeRevoked = !empty($Silian_query['include_revoked']) && filter_var($Silian_query['include_revoked'], FILTER_VALIDATE_BOOLEAN);

            $Silian_badgePayload = $this->buildUserBadgePayload($Silian_userId, $Silian_includeRevoked);
            $Silian_badgePayload['metrics'] = $this->badgeService->compileUserMetrics($Silian_userId);
            $Silian_badgePayload['user'] = $Silian_userRow;

            return $this->jsonResponse($Silian_response, ['success' => true, 'data' => $Silian_badgePayload]);
        } catch (\Throwable $Silian_e) {
            if (($_ENV['APP_ENV'] ?? '') === 'testing') {
                throw $Silian_e;
            }
            $this->logExceptionWithFallback($Silian_e, $Silian_request);
            return $this->jsonResponse($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    private function getUserOverviewForTarget(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_admin = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_admin || !$this->authService->isAdminUser($Silian_admin)) {
                return $this->jsonResponse($Silian_response, ['error' => 'Access denied'], 403);
            }

            $Silian_target = $this->resolveUserTarget($Silian_args);
            if ($Silian_target['error'] !== null) {
                return $this->jsonResponse($Silian_response, ['error' => $Silian_target['error']], $Silian_target['status']);
            }
            $Silian_userId = $Silian_target['user']['id'];
            $Silian_userRow = $Silian_target['user'];

            $Silian_metrics = $this->badgeService->compileUserMetrics($Silian_userId);
            $Silian_badgePayload = $this->buildUserBadgePayload($Silian_userId, true);
            $Silian_checkinStats = $this->checkinService->getUserStreakStats($Silian_userId);
              $Silian_payload = [
                  'user' => $Silian_userRow,
                  'metrics' => $Silian_metrics,
                  'badge_summary' => $Silian_badgePayload['summary'],
                  'recent_badges' => array_slice($Silian_badgePayload['items'], 0, 5),
                  'checkin_stats' => $Silian_checkinStats,
                  'passkey_summary' => $this->getUserPasskeySummary((string) ($Silian_userRow['uuid'] ?? '')),
                  'recent_security_activity' => $this->getRecentSecurityActivity(
                      $Silian_userId,
                      isset($Silian_userRow['uuid']) ? (string) $Silian_userRow['uuid'] : null,
                      10
                  ),
              ];

            return $this->jsonResponse($Silian_response, ['success' => true, 'data' => $Silian_payload]);
        } catch (\Throwable $Silian_e) {
            if (($_ENV['APP_ENV'] ?? '') === 'testing') {
                throw $Silian_e;
            }
            $this->logExceptionWithFallback($Silian_e, $Silian_request);
            return $this->jsonResponse($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * 获取待审核交易列表
     */
    public function getPendingTransactions(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->jsonResponse($Silian_response, ['error' => 'Access denied'], 403);
            }

            $Silian_params = $Silian_request->getQueryParams();
            $Silian_page = max(1, (int)($Silian_params['page'] ?? 1));
            $Silian_limit = min(100, max(10, (int)($Silian_params['limit'] ?? 20)));
            $Silian_offset = ($Silian_page - 1) * $Silian_limit;

            $Silian_sql = "SELECT pt.id, pt.activity_id, pt.points, pt.notes, pt.img AS img, pt.status, pt.created_at, pt.updated_at,
                           u.username, u.email,
                           ca.name_zh as activity_name_zh, ca.name_en as activity_name_en,
                           ca.category, ca.carbon_factor, ca.unit as activity_unit
                    FROM points_transactions pt
                    JOIN users u ON pt.uid = u.id
                    LEFT JOIN carbon_activities ca ON pt.activity_id = ca.id
                    WHERE pt.status = 'pending' AND pt.deleted_at IS NULL
                    ORDER BY pt.created_at ASC
                    LIMIT :limit OFFSET :offset";
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
            $Silian_stmt->bindValue(':offset', $Silian_offset, PDO::PARAM_INT);
            $Silian_stmt->execute();
            $Silian_transactions = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC);

            foreach ($Silian_transactions as &$Silian_t) {
                $Silian_imgs = [];
                if (!empty($Silian_t['img'])) {
                    $Silian_decoded = json_decode((string)$Silian_t['img'], true);
                    if (json_last_error() === JSON_ERROR_NONE && is_array($Silian_decoded)) {
                        $Silian_imgs = $Silian_decoded;
                    } else {
                        $Silian_imgs = [(string)$Silian_t['img']];
                    }
                }
                // 兼容字符串/对象混合，补充预签名直链
                foreach ($Silian_imgs as &$Silian_img) {
                    if (is_string($Silian_img)) {
                        $Silian_img = [ 'url' => $this->r2Service?->generatePresignedUrl($Silian_img, 600) ?? $Silian_img, 'file_path' => $Silian_img ];
                    } elseif (is_array($Silian_img) && !empty($Silian_img['file_path']) && empty($Silian_img['url'])) {
                        $Silian_img['url'] = $this->r2Service?->generatePresignedUrl($Silian_img['file_path'], 600) ?? $Silian_img['file_path'];
                    }
                }
                unset($Silian_img);
                $Silian_t['images'] = $Silian_imgs;
                unset($Silian_t['img']);
            }

            $Silian_total = (int)$this->db->query("SELECT COUNT(*) FROM points_transactions pt WHERE pt.status='pending' AND pt.deleted_at IS NULL")->fetchColumn();

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => [
                    'transactions' => $Silian_transactions,
                    'pagination' => [
                        'current_page' => $Silian_page,
                        'per_page' => $Silian_limit,
                        'total_items' => $Silian_total,
                        'total_pages' => $Silian_total > 0 ? (int)ceil($Silian_total / $Silian_limit) : 0
                    ]
                ]
            ]);
        } catch (\Exception $Silian_e) {
            $this->logExceptionWithFallback($Silian_e, $Silian_request);
            return $this->jsonResponse($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * 管理员统计数据（跨数据库兼容）
     */
    public function getStats(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->jsonResponse($Silian_response, ['error' => 'Access denied'], 403);
            }

            $Silian_params = $Silian_request->getQueryParams();
            $Silian_forceParam = $Silian_params['force'] ?? $Silian_params['refresh'] ?? null;
            if ($Silian_forceParam === null) {
                $Silian_forceRefresh = true;
            } else {
                $Silian_parsed = filter_var($Silian_forceParam, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
                $Silian_forceRefresh = $Silian_parsed ?? true;
            }

            $Silian_stats = $this->statisticsService->getAdminStats($Silian_forceRefresh);

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => $Silian_stats,
            ]);
        } catch (\Throwable $Silian_e) {
            if (($_ENV['APP_ENV'] ?? '') === 'testing') {
                throw $Silian_e;
            }
            $this->logExceptionWithFallback($Silian_e, $Silian_request);
            return $this->jsonResponse($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * 审计日志列表
     */
    public function getLogs(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->jsonResponse($Silian_response, ['error' => 'Access denied'], 403);
            }

            $Silian_params = $Silian_request->getQueryParams();
            $Silian_page = max(1, (int)($Silian_params['page'] ?? 1));
            $Silian_limit = min(100, max(10, (int)($Silian_params['limit'] ?? 50)));
            $Silian_offset = ($Silian_page - 1) * $Silian_limit;

            $Silian_filters = [];
            if (!empty($Silian_params['action'])) {
                $Silian_filters['action'] = '%' . trim($Silian_params['action']) . '%'; // Partial match for action
            }
            if (!empty($Silian_params['actor_type'])) {
                $Silian_filters['actor_type'] = trim($Silian_params['actor_type']);
            }
            if (!empty($Silian_params['user_id'])) {
                $Silian_filters['user_id'] = (int)$Silian_params['user_id'];
            }
            if (!empty($Silian_params['user_uuid']) && is_string($Silian_params['user_uuid']) && Uuid::isValid(trim((string) $Silian_params['user_uuid']))) {
                $Silian_filters['user_uuid'] = strtolower(trim((string) $Silian_params['user_uuid']));
            } elseif (!empty($Silian_params['userUuid']) && is_string($Silian_params['userUuid']) && Uuid::isValid(trim((string) $Silian_params['userUuid']))) {
                $Silian_filters['user_uuid'] = strtolower(trim((string) $Silian_params['userUuid']));
            }
            if (!empty($Silian_params['operation_category'])) {
                $Silian_filters['category'] = trim($Silian_params['operation_category']);
            }
            if (!empty($Silian_params['status'])) {
                $Silian_filters['status'] = trim($Silian_params['status']);
            }
            if (!empty($Silian_params['date_from'])) {
                $Silian_filters['date_from'] = trim($Silian_params['date_from']) . ' 00:00:00';
            }
            if (!empty($Silian_params['date_to'])) {
                $Silian_filters['date_to'] = trim($Silian_params['date_to']) . ' 23:59:59';
            }

            $Silian_logs = $this->auditLog->getAuditLogs($Silian_filters, $Silian_limit, $Silian_offset);

            // Get total count for pagination
            $Silian_countFilters = $Silian_filters;
            unset($Silian_countFilters['limit'], $Silian_countFilters['offset']); // Not needed for count
            $Silian_total = $this->auditLog->getAuditLogsCount($Silian_countFilters);

            $this->auditLog->logAdminOperation('audit_logs_viewed', $Silian_user['id'], 'admin', [
                'filters' => $Silian_filters,
                'page' => $Silian_page,
                'limit' => $Silian_limit
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => [
                    'logs' => $Silian_logs,
                    'pagination' => [
                        'current_page' => $Silian_page,
                        'per_page' => $Silian_limit,
                        'total_items' => $Silian_total,
                        'total_pages' => $Silian_total > 0 ? (int)ceil($Silian_total / $Silian_limit) : 0
                    ]
                ]
            ]);
        } catch (\Exception $Silian_e) {
            $this->logExceptionWithFallback($Silian_e, $Silian_request);
            return $this->jsonResponse($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * 更新用户 is_admin / status
     */
    public function updateUser(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        return $this->updateUserForTarget($Silian_request, $Silian_response, $Silian_args);
    }

    public function updateUserByUuid(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        return $this->updateUserForTarget($Silian_request, $Silian_response, $Silian_args);
    }

    private function updateUserForTarget(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_admin = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_admin || !$this->authService->isAdminUser($Silian_admin)) {
                return $this->jsonResponse($Silian_response, ['error' => 'Access denied'], 403);
            }
            $Silian_target = $this->resolveUserTarget($Silian_args);
            if ($Silian_target['error'] !== null) {
                return $this->jsonResponse($Silian_response, ['error' => $Silian_target['error']], $Silian_target['status']);
            }
            $Silian_userId = $Silian_target['user']['id'];
            $Silian_userRow = $Silian_target['user'];

            $Silian_payload = $Silian_request->getParsedBody() ?? [];
            $Silian_sets = [];
            $Silian_params = ['id' => $Silian_userId];

            if (array_key_exists('role', $Silian_payload)) {
                $Silian_role = strtolower(trim((string) $Silian_payload['role']));
                if (!in_array($Silian_role, ['user', 'support', 'admin'], true)) {
                    return $this->jsonResponse($Silian_response, ['error' => 'Invalid role'], 422);
                }
                $Silian_sets[] = 'role = :role';
                $Silian_params['role'] = $Silian_role;
                $Silian_sets[] = 'is_admin = :is_admin';
                $Silian_params['is_admin'] = $Silian_role === 'admin' ? 1 : 0;
            } elseif (array_key_exists('is_admin', $Silian_payload)) {
                $Silian_sets[] = 'is_admin = :is_admin';
                $Silian_params['is_admin'] = (int)!!$Silian_payload['is_admin'];
                $Silian_sets[] = 'role = :role';
                $Silian_params['role'] = !empty($Silian_payload['is_admin'])
                    ? 'admin'
                    : (strtolower((string) ($Silian_userRow['role'] ?? 'user')) === 'support' ? 'support' : 'user');
            }
            if (array_key_exists('status', $Silian_payload)) {
                $Silian_sets[] = 'status = :status';
                $Silian_params['status'] = trim((string)$Silian_payload['status']);
            }
            if (array_key_exists('group_id', $Silian_payload)) {
                $Silian_sets[] = 'group_id = :group_id';
                $Silian_val = $Silian_payload['group_id'];
                $Silian_params['group_id'] = ($Silian_val === '' || $Silian_val === null) ? null : (int)$Silian_val;
            }
            if (array_key_exists('quota_override', $Silian_payload)) {
                $Silian_sets[] = 'quota_override = :quota_override';
                $Silian_val = $Silian_payload['quota_override'];
                if (is_array($Silian_val)) {
                    $Silian_val = $this->quotaConfigService->normalizeQuotaConfig($Silian_val);
                }
                $Silian_params['quota_override'] = is_array($Silian_val) ? json_encode($Silian_val) : $Silian_val; // null stays null
            }
            if (array_key_exists('quota_flat', $Silian_payload) && is_array($Silian_payload['quota_flat'])) {
                // Fetch current quota override if not provided in payload's quota_override
                if (!array_key_exists('quota_override', $Silian_params)) {
                     // We need to fetch the current value to merge safely
                     $Silian_currStmt = $this->db->prepare("SELECT quota_override FROM users WHERE id = :id");
                     $Silian_currStmt->execute(['id' => $Silian_userId]);
                     $Silian_currRaw = $Silian_currStmt->fetchColumn();
                     $Silian_currentJson = $this->quotaConfigService->decodeJsonToArray($Silian_currRaw) ?? [];
                } else {
                    // If we are also updating quota_override directly, use that as base (unlikely but safe)
                    $Silian_currentJson = $this->quotaConfigService->decodeJsonToArray($Silian_params['quota_override']) ?? [];
                }

                $Silian_newJson = $this->quotaConfigService->unflattenQuotas($Silian_payload['quota_flat'], $Silian_currentJson);

                // If quota_override was already in sets, update it; otherwise add it
                $Silian_jsonStr = json_encode($Silian_newJson);
                if (in_array('quota_override = :quota_override', $Silian_sets)) {
                    $Silian_params['quota_override'] = $Silian_jsonStr;
                } else {
                    $Silian_sets[] = 'quota_override = :quota_override';
                    $Silian_params['quota_override'] = $Silian_jsonStr;
                }
            }
            if (array_key_exists('support_routing', $Silian_payload) && is_array($Silian_payload['support_routing'])) {
                if (!array_key_exists('quota_override', $Silian_params)) {
                    $Silian_currStmt = $this->db->prepare("SELECT quota_override FROM users WHERE id = :id");
                    $Silian_currStmt->execute(['id' => $Silian_userId]);
                    $Silian_currentJson = $this->quotaConfigService->decodeJsonToArray($Silian_currStmt->fetchColumn()) ?? [];
                } else {
                    $Silian_currentJson = $this->quotaConfigService->decodeJsonToArray($Silian_params['quota_override']) ?? [];
                }

                $Silian_supportRoutingOverride = $this->sanitizeSupportRoutingOverride($Silian_payload['support_routing']);
                if ($Silian_supportRoutingOverride === []) {
                    unset($Silian_currentJson['support_routing']);
                } else {
                    $Silian_currentJson['support_routing'] = $Silian_supportRoutingOverride;
                }

                $Silian_jsonStr = $Silian_currentJson === [] ? null : json_encode($Silian_currentJson);
                if (in_array('quota_override = :quota_override', $Silian_sets)) {
                    $Silian_params['quota_override'] = $Silian_jsonStr;
                } else {
                    $Silian_sets[] = 'quota_override = :quota_override';
                    $Silian_params['quota_override'] = $Silian_jsonStr;
                }
            }
            if (array_key_exists('admin_notes', $Silian_payload)) {
                $Silian_sets[] = 'admin_notes = :admin_notes';
                $Silian_params['admin_notes'] = $Silian_payload['admin_notes'];
            }

            if (empty($Silian_sets)) {
                 return $this->jsonResponse($Silian_response, ['error' => 'No fields to update'], 400);
            }

            $Silian_sets[] = 'updated_at = :updated_at';
            $Silian_params['updated_at'] = date('Y-m-d H:i:s');

            $Silian_sql = 'UPDATE users SET ' . implode(', ', $Silian_sets) . ' WHERE id = :id';
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute($Silian_params);

            $this->auditLog->logDataChange(
                'admin',
                'user_update',
                $Silian_admin['id'] ?? null,
                'admin',
                'users',
                $Silian_userId,
                null,
                null,
                [
                    'fields' => array_keys($Silian_params),
                    'user_uuid' => $Silian_userRow['uuid'] ?? null,
                ]
            );

            return $this->jsonResponse($Silian_response, ['success' => true]);
        } catch (\Exception $Silian_e) {
            $this->logExceptionWithFallback($Silian_e, $Silian_request);
            return $this->jsonResponse($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    private function getUserSecurityActivityForTarget(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_admin = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_admin || !$this->authService->isAdminUser($Silian_admin)) {
                return $this->jsonResponse($Silian_response, ['error' => 'Access denied'], 403);
            }

            $Silian_target = $this->resolveUserTarget($Silian_args);
            if ($Silian_target['error'] !== null) {
                return $this->jsonResponse($Silian_response, ['error' => $Silian_target['error']], $Silian_target['status']);
            }

            $Silian_query = $Silian_request->getQueryParams();
            $Silian_page = max(1, (int) ($Silian_query['page'] ?? 1));
            $Silian_limit = min(100, max(1, (int) ($Silian_query['limit'] ?? 20)));
            $Silian_offset = ($Silian_page - 1) * $Silian_limit;
            $Silian_filters = $this->resolveSecurityActivityFilters($Silian_query);
            $Silian_userRow = $Silian_target['user'];
            $Silian_result = $this->fetchSecurityActivityTimeline(
                (int) $Silian_userRow['id'],
                isset($Silian_userRow['uuid']) ? (string) $Silian_userRow['uuid'] : null,
                $Silian_filters,
                $Silian_limit,
                $Silian_offset
            );

            $this->auditLog->logDataChange(
                'admin',
                'user_security_activity_viewed',
                (int) ($Silian_admin['id'] ?? 0),
                'admin',
                'audit_logs',
                (int) $Silian_userRow['id'],
                null,
                [
                    'page' => $Silian_page,
                    'limit' => $Silian_limit,
                    'type' => $Silian_filters['type'],
                    'period' => $Silian_filters['period'],
                    'count' => count($Silian_result['items']),
                ],
                ['change_type' => 'read']
            );

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => [
                    'items' => $Silian_result['items'],
                    'filters' => [
                        'type' => $Silian_filters['type'],
                        'period' => $Silian_filters['period'],
                    ],
                    'pagination' => [
                        'current_page' => $Silian_page,
                        'per_page' => $Silian_limit,
                        'total_items' => $Silian_result['total'],
                        'total_pages' => $Silian_result['total'] > 0 ? (int) ceil($Silian_result['total'] / $Silian_limit) : 0,
                    ],
                ],
            ]);
        } catch (\Throwable $Silian_e) {
            if (($_ENV['APP_ENV'] ?? '') === 'testing') {
                throw $Silian_e;
            }
            $this->logExceptionWithFallback($Silian_e, $Silian_request);
            return $this->jsonResponse($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    public function deleteUser(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        return $this->deleteUserForTarget($Silian_request, $Silian_response, $Silian_args);
    }

    public function deleteUserByUuid(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        return $this->deleteUserForTarget($Silian_request, $Silian_response, $Silian_args);
    }

    private function deleteUserForTarget(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_admin = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_admin || !$this->authService->isAdminUser($Silian_admin)) {
                return $this->jsonResponse($Silian_response, ['error' => 'Access denied'], 403);
            }

            $Silian_target = $this->resolveUserTarget($Silian_args);
            if ($Silian_target['error'] !== null) {
                return $this->jsonResponse($Silian_response, ['error' => $Silian_target['error']], $Silian_target['status']);
            }
            $Silian_userRow = $Silian_target['user'];
            $Silian_userId = $Silian_userRow['id'];

            if ((int) ($Silian_admin['id'] ?? 0) === $Silian_userId) {
                return $this->jsonResponse($Silian_response, ['error' => 'Cannot delete current admin user'], 400);
            }

            $Silian_stmt = $this->db->prepare(
                'UPDATE users SET deleted_at = :deleted_at, updated_at = :updated_at WHERE id = :id AND deleted_at IS NULL'
            );
            $Silian_timestamp = date('Y-m-d H:i:s');
            $Silian_stmt->execute([
                'deleted_at' => $Silian_timestamp,
                'updated_at' => $Silian_timestamp,
                'id' => $Silian_userId,
            ]);

            if ($Silian_stmt->rowCount() < 1) {
                return $this->jsonResponse($Silian_response, ['error' => 'User not found'], 404);
            }

            $this->auditLog->logDataChange(
                'admin',
                'user_delete',
                $Silian_admin['id'] ?? null,
                'admin',
                'users',
                $Silian_userId,
                $Silian_userRow,
                ['deleted_at' => $Silian_timestamp],
                ['user_uuid' => $Silian_userRow['uuid'] ?? null]
            );

            return $this->jsonResponse($Silian_response, ['success' => true]);
        } catch (\Throwable $Silian_e) {
            $this->logExceptionWithFallback($Silian_e, $Silian_request);
            return $this->jsonResponse($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    public function adjustUserPoints(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        return $this->adjustUserPointsForTarget($Silian_request, $Silian_response, $Silian_args);
    }

    public function adjustUserPointsByUuid(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        return $this->adjustUserPointsForTarget($Silian_request, $Silian_response, $Silian_args);
    }

    private function adjustUserPointsForTarget(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_admin = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_admin || !$this->authService->isAdminUser($Silian_admin)) {
                return $this->jsonResponse($Silian_response, ['error' => 'Access denied'], 403);
            }

            $Silian_target = $this->resolveUserTarget($Silian_args);
            if ($Silian_target['error'] !== null) {
                return $this->jsonResponse($Silian_response, ['error' => $Silian_target['error']], $Silian_target['status']);
            }
            $Silian_userRow = $Silian_target['user'];
            $Silian_userId = $Silian_userRow['id'];

            $Silian_payload = $Silian_request->getParsedBody();
            $Silian_data = is_array($Silian_payload) ? $Silian_payload : [];
            $Silian_delta = isset($Silian_data['delta']) && is_numeric($Silian_data['delta']) ? (float) $Silian_data['delta'] : null;
            $Silian_reason = isset($Silian_data['reason']) ? trim((string) $Silian_data['reason']) : null;
            if ($Silian_delta === null || $Silian_delta == 0.0) {
                return $this->jsonResponse($Silian_response, ['error' => 'Invalid points delta'], 400);
            }

            $Silian_updatedAt = date('Y-m-d H:i:s');
            $Silian_stmt = $this->db->prepare(
                'UPDATE users SET points = COALESCE(points, 0) + :delta, updated_at = :updated_at WHERE id = :id AND deleted_at IS NULL'
            );
            $Silian_stmt->execute([
                'delta' => $Silian_delta,
                'updated_at' => $Silian_updatedAt,
                'id' => $Silian_userId,
            ]);

            if ($Silian_stmt->rowCount() < 1) {
                return $this->jsonResponse($Silian_response, ['error' => 'User not found'], 404);
            }

            $Silian_freshUser = $this->loadUserRow($Silian_userId);
            if ($Silian_freshUser === null) {
                return $this->jsonResponse($Silian_response, ['error' => 'User not found'], 404);
            }

            $this->auditLog->logDataChange(
                'admin',
                'user_points_adjusted',
                $Silian_admin['id'] ?? null,
                'admin',
                'users',
                $Silian_userId,
                ['points' => $Silian_userRow['points'] ?? null],
                ['points' => $Silian_freshUser['points'] ?? null],
                [
                    'reason' => $Silian_reason,
                    'delta' => $Silian_delta,
                    'user_uuid' => $Silian_userRow['uuid'] ?? null,
                ]
            );

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => [
                    'user' => $Silian_freshUser,
                    'delta' => $Silian_delta,
                    'reason' => $Silian_reason,
                ],
            ]);
        } catch (\Throwable $Silian_e) {
            $this->logExceptionWithFallback($Silian_e, $Silian_request);
            return $this->jsonResponse($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    private function buildUserBadgePayload(int $Silian_userId, bool $Silian_includeRevoked = false): array
    {
        $Silian_records = $this->badgeService->getUserBadges($Silian_userId, $Silian_includeRevoked);
        $Silian_items = [];
        $Silian_awarded = 0;
        $Silian_revoked = 0;
        foreach ($Silian_records as $Silian_entry) {
            $Silian_badge = $Silian_entry['badge'] ?? null;
            if (is_array($Silian_badge)) {
                $Silian_badge = $this->formatBadgeForAdmin($Silian_badge);
            }
            $Silian_userBadge = $Silian_entry['user_badge'] ?? [];
            $Silian_status = $Silian_userBadge['status'] ?? null;
            if ($Silian_status === 'awarded') {
                $Silian_awarded++;
            } elseif ($Silian_status === 'revoked') {
                $Silian_revoked++;
            }
            $Silian_items[] = [
                'badge' => $Silian_badge,
                'user_badge' => $Silian_userBadge,
            ];
        }

        return [
            'items' => $Silian_items,
            'badges' => $Silian_items,
            'summary' => [
                'awarded' => $Silian_awarded,
                'revoked' => $Silian_revoked,
                'total' => $Silian_awarded + $Silian_revoked,
            ],
        ];
    }

    private function formatBadgeForAdmin(array $Silian_badge): array
    {
        if ($this->r2Service && !empty($Silian_badge['icon_path'])) {
            try {
                $Silian_badge['icon_url'] = $this->r2Service->getPublicUrl($Silian_badge['icon_path']);
                $Silian_badge['icon_presigned_url'] = $this->r2Service->generatePresignedUrl($Silian_badge['icon_path'], 600);
            } catch (\Throwable $Silian_e) {
                // ignore formatting failures for optional assets
            }
        }
        if ($this->r2Service && !empty($Silian_badge['icon_thumbnail_path'])) {
            try {
                $Silian_badge['icon_thumbnail_url'] = $this->r2Service->getPublicUrl($Silian_badge['icon_thumbnail_path']);
            } catch (\Throwable $Silian_ignore) {}
        }
        return $Silian_badge;
    }

    /**
     * @param array<string, mixed> $args
     * @return array{user: array<string, mixed>|null, error: string|null, status: int}
     */
    private function resolveUserTarget(array $Silian_args): array
    {
        if (isset($Silian_args['uuid'])) {
            $Silian_userUuid = trim((string) $Silian_args['uuid']);
            if ($Silian_userUuid === '' || !Uuid::isValid($Silian_userUuid)) {
                return ['user' => null, 'error' => 'Invalid user uuid', 'status' => 400];
            }

            $Silian_user = $this->loadUserRowByUuid($Silian_userUuid);
            if ($Silian_user === null) {
                return ['user' => null, 'error' => 'User not found', 'status' => 404];
            }

            return ['user' => $Silian_user, 'error' => null, 'status' => 200];
        }

        $Silian_userId = isset($Silian_args['id']) ? (int) $Silian_args['id'] : 0;
        if ($Silian_userId <= 0) {
            return ['user' => null, 'error' => 'Invalid user id', 'status' => 400];
        }

        $Silian_user = $this->loadUserRow($Silian_userId);
        if ($Silian_user === null) {
            return ['user' => null, 'error' => 'User not found', 'status' => 404];
        }

        return ['user' => $Silian_user, 'error' => null, 'status' => 200];
    }

    private function loadUserRow(int $Silian_userId): ?array
    {
        return $this->loadUserRowByColumn('u.id = :value', ['value' => $Silian_userId]);
    }

    private function loadUserRowByUuid(string $Silian_userUuid): ?array
    {
        return $this->loadUserRowByColumn('u.uuid = :value', ['value' => strtolower($Silian_userUuid)]);
    }

    /**
     * @param array<string, mixed> $params
     */
    private function loadUserRowByColumn(string $Silian_whereClause, array $Silian_params): ?array
    {
        $Silian_lastLoginSelect = $this->buildLastLoginSelect('u');
        $Silian_stmt = $this->db->prepare(
              'SELECT
                u.id,
                u.uuid,
                u.username,
                u.email,
                u.status,
                u.is_admin,
                u.points,
                u.created_at,
                u.updated_at,
                u.school_id,
                s.name as school_name,
                COALESCE(pk.passkey_count, 0) as passkey_count,
                pk.last_passkey_used_at,
                ' . $Silian_lastLoginSelect . '
             FROM users u
             LEFT JOIN schools s ON u.school_id = s.id
             LEFT JOIN (
                SELECT user_uuid, COUNT(*) AS passkey_count, MAX(last_used_at) AS last_passkey_used_at
                FROM user_passkeys
                WHERE disabled_at IS NULL
                GROUP BY user_uuid
             ) pk ON pk.user_uuid = u.uuid
             WHERE ' . $Silian_whereClause . ' AND u.deleted_at IS NULL
             LIMIT 1'
        );
        $Silian_stmt->execute($Silian_params);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        if (!$Silian_row) {
            return null;
        }
        $Silian_profileFields = $this->userProfileViewService->buildProfileFields($Silian_row);
        $Silian_row['id'] = (int) ($Silian_row['id'] ?? 0);
        $Silian_row['uuid'] = isset($Silian_row['uuid']) ? strtolower((string) $Silian_row['uuid']) : null;
        $Silian_row['school_id'] = $Silian_profileFields['school_id'];
        $Silian_row['school_name'] = $Silian_profileFields['school_name'];
        $Silian_row['is_admin'] = (bool) ($Silian_row['is_admin'] ?? false);
        $Silian_row['points'] = (float) ($Silian_row['points'] ?? 0);
        $Silian_row['passkey_count'] = (int) ($Silian_row['passkey_count'] ?? 0);
        $Silian_row['days_since_registration'] = $this->computeDaysSince($Silian_row['created_at'] ?? null);
        return $Silian_row;
    }

    /**
     * @return array<string, mixed>
     */
    private function getUserPasskeySummary(string $Silian_userUuid): array
    {
        $Silian_stmt = $this->db->prepare(
            'SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN backup_state = 1 THEN 1 ELSE 0 END) AS backup_enabled,
                SUM(CASE WHEN backup_eligible = 1 THEN 1 ELSE 0 END) AS backup_eligible,
                MAX(last_used_at) AS last_used_at,
                MAX(created_at) AS last_registered_at
             FROM user_passkeys
             WHERE user_uuid = :user_uuid AND disabled_at IS NULL'
        );
        $Silian_stmt->execute(['user_uuid' => strtolower($Silian_userUuid)]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'total' => (int) ($Silian_row['total'] ?? 0),
            'backup_enabled' => (int) ($Silian_row['backup_enabled'] ?? 0),
            'backup_eligible' => (int) ($Silian_row['backup_eligible'] ?? 0),
            'last_used_at' => $Silian_row['last_used_at'] ?? null,
            'last_registered_at' => $Silian_row['last_registered_at'] ?? null,
        ];
    }

    /**
     * @return array<int, array<string, mixed>>
     */
    private function getRecentSecurityActivity(int $Silian_userId, ?string $Silian_userUuid, int $Silian_limit): array
    {
        $Silian_result = $this->fetchSecurityActivityTimeline(
            $Silian_userId,
            $Silian_userUuid,
            [
                'type' => 'all',
                'period' => 'all',
                'actions' => self::SECURITY_ACTIVITY_ACTIONS,
                'days' => null,
            ],
            $Silian_limit,
            0
        );

        return $Silian_result['items'];
    }

    /**
     * @param array<string, mixed> $query
     * @return array{type: string, period: string, actions: array<int, string>, days: int|null}
     */
    private function resolveSecurityActivityFilters(array $Silian_query): array
    {
        $Silian_type = (string) ($Silian_query['type'] ?? 'all');
        if (!isset(self::SECURITY_ACTIVITY_TYPE_FILTERS[$Silian_type])) {
            $Silian_type = 'all';
        }

        $Silian_period = (string) ($Silian_query['period'] ?? 'all');
        if (!array_key_exists($Silian_period, self::SECURITY_ACTIVITY_PERIOD_FILTERS)) {
            $Silian_period = 'all';
        }

        $Silian_days = self::SECURITY_ACTIVITY_PERIOD_FILTERS[$Silian_period];

        return [
            'type' => $Silian_type,
            'period' => $Silian_period,
            'actions' => self::SECURITY_ACTIVITY_TYPE_FILTERS[$Silian_type],
            'days' => is_int($Silian_days) ? $Silian_days : null,
        ];
    }

    /**
     * @return array{items: array<int, array<string, mixed>>, total: int}
     */
    private function fetchSecurityActivityTimeline(int $Silian_userId, ?string $Silian_userUuid, array $Silian_filters, int $Silian_limit, int $Silian_offset): array
    {
        $Silian_actions = $Silian_filters['actions'] ?? self::SECURITY_ACTIVITY_ACTIONS;
        $Silian_placeholders = implode(', ', array_fill(0, count($Silian_actions), '?'));
        $Silian_normalizedUuid = is_string($Silian_userUuid) && trim($Silian_userUuid) !== '' ? strtolower(trim($Silian_userUuid)) : null;
        if ($Silian_normalizedUuid !== null) {
            $Silian_where = [
                '(user_uuid = ? OR (user_uuid IS NULL AND user_id = ?))',
                "action IN ({$Silian_placeholders})",
            ];
            $Silian_baseParams = array_merge([$Silian_normalizedUuid, $Silian_userId], $Silian_actions);
        } else {
            $Silian_where = [
                'user_id = ?',
                "action IN ({$Silian_placeholders})",
            ];
            $Silian_baseParams = array_merge([$Silian_userId], $Silian_actions);
        }
        $Silian_days = isset($Silian_filters['days']) && is_int($Silian_filters['days']) ? $Silian_filters['days'] : null;
        if ($Silian_days !== null) {
            $Silian_where[] = $this->buildSecurityActivityPeriodClause($Silian_days);
        }
        $Silian_whereSql = implode(' AND ', $Silian_where);

        $Silian_listStmt = $this->db->prepare(
            "SELECT id, action, status, actor_type, ip_address, user_agent, request_id, data, created_at
             FROM audit_logs
             WHERE {$Silian_whereSql}
             ORDER BY created_at DESC, id DESC
             LIMIT ? OFFSET ?"
        );
        $Silian_listStmt->execute(array_merge($Silian_baseParams, [$Silian_limit, $Silian_offset]));
        $Silian_rows = $Silian_listStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $Silian_countStmt = $this->db->prepare(
            "SELECT COUNT(*)
             FROM audit_logs
             WHERE {$Silian_whereSql}"
        );
        $Silian_countStmt->execute($Silian_baseParams);

        return [
            'items' => array_map([$this, 'normalizeSecurityActivityRow'], $Silian_rows),
            'total' => (int) $Silian_countStmt->fetchColumn(),
        ];
    }

    private function buildSecurityActivityPeriodClause(int $Silian_days): string
    {
        $Silian_safeDays = max(1, $Silian_days);
        $Silian_driver = strtolower((string) $this->db->getAttribute(PDO::ATTR_DRIVER_NAME));

        if ($Silian_driver === 'sqlite') {
            return sprintf("created_at >= datetime('now', '-%d days')", $Silian_safeDays);
        }

        return sprintf('created_at >= DATE_SUB(NOW(), INTERVAL %d DAY)', $Silian_safeDays);
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function normalizeSecurityActivityRow(array $Silian_row): array
    {
        $Silian_metadata = $this->decodeAuditPayload($Silian_row['data'] ?? null);

        return [
            'id' => (int) ($Silian_row['id'] ?? 0),
            'action' => (string) ($Silian_row['action'] ?? ''),
            'status' => (string) ($Silian_row['status'] ?? 'success'),
            'actor_type' => (string) ($Silian_row['actor_type'] ?? 'user'),
            'occurred_at' => $Silian_row['created_at'] ?? null,
            'ip_address' => $Silian_metadata['ip_address'] ?? ($Silian_row['ip_address'] ?? null),
            'user_agent' => $Silian_metadata['user_agent'] ?? ($Silian_row['user_agent'] ?? null),
            'request_id' => $Silian_row['request_id'] ?? null,
            'metadata' => $Silian_metadata,
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function decodeAuditPayload(mixed $Silian_value): array
    {
        if (!is_string($Silian_value) || trim($Silian_value) === '') {
            return [];
        }

        $Silian_decoded = json_decode($Silian_value, true);
        if (!is_array($Silian_decoded)) {
            return [];
        }

        return $Silian_decoded;
    }

    private function computeDaysSince(?string $Silian_timestamp): int
    {
        if (!$Silian_timestamp) {
            return 0;
        }
        try {
            $Silian_timezoneName = $_ENV['APP_TIMEZONE'] ?? date_default_timezone_get();
            if (!$Silian_timezoneName) {
                $Silian_timezoneName = 'UTC';
            }
            $Silian_timezone = new DateTimeZone($Silian_timezoneName);
            $Silian_created = new DateTimeImmutable((string) $Silian_timestamp, $Silian_timezone);
            $Silian_now = new DateTimeImmutable('now', $Silian_timezone);
            return max(0, (int) $Silian_created->diff($Silian_now)->format('%a'));
        } catch (\Throwable $Silian_e) {
            return 0;
        }
    }

    private function buildLastLoginSelect(string $Silian_alias = 'u'): string
    {
        $Silian_column = $this->resolveLastLoginColumn();
        if ($Silian_column === null) {
            return 'NULL AS lastlgn';
        }
        return $Silian_alias . '.' . $Silian_column . ' AS lastlgn';
    }

    private function resolveLastLoginColumn(): ?string
    {
        if ($this->lastLoginColumn !== null) {
            return $this->lastLoginColumn !== '' ? $this->lastLoginColumn : null;
        }

        foreach (['lastlgn', 'last_login_at'] as $Silian_candidate) {
            if ($this->columnExists('users', $Silian_candidate)) {
                $this->lastLoginColumn = $Silian_candidate;
                return $Silian_candidate;
            }
        }

        $this->lastLoginColumn = '';
        return null;
    }

    private function columnExists(string $Silian_table, string $Silian_column): bool
    {
        try {
            $Silian_driver = (string) $this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
        } catch (\Throwable $Silian_e) {
            $Silian_driver = null;
        }

        try {
            if ($Silian_driver === 'sqlite') {
                $Silian_stmt = $this->db->query('PRAGMA table_info(' . $Silian_table . ')');
                if ($Silian_stmt) {
                    while ($Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC)) {
                        if (isset($Silian_row['name']) && strcasecmp((string) $Silian_row['name'], $Silian_column) === 0) {
                            return true;
                        }
                    }
                }
                return false;
            }

            $Silian_stmt = $this->db->prepare(sprintf('SHOW COLUMNS FROM `%s` LIKE ?', $Silian_table));
            if ($Silian_stmt && $Silian_stmt->execute([$Silian_column])) {
                return (bool) $Silian_stmt->fetch(PDO::FETCH_ASSOC);
            }
        } catch (\Throwable $Silian_e) {
            // ignore detection errors
        }

        return false;
    }

    private function extractSupportRoutingOverride(array $Silian_quotaOverride): array
    {
        $Silian_supportRouting = $Silian_quotaOverride['support_routing'] ?? null;
        return is_array($Silian_supportRouting) ? $this->sanitizeSupportRoutingOverride($Silian_supportRouting) : [];
    }

    private function sanitizeSupportRoutingOverride(array $Silian_supportRouting): array
    {
        $Silian_normalized = [];

        foreach ([
            'first_response_minutes' => ['type' => 'int', 'min' => 1],
            'resolution_minutes' => ['type' => 'int', 'min' => 1],
            'routing_weight' => ['type' => 'float', 'min' => 0.1],
            'min_agent_level' => ['type' => 'int', 'min' => 1, 'max' => 5],
            'overdue_boost' => ['type' => 'float', 'min' => 0.0],
            'tier_label' => ['type' => 'string'],
        ] as $Silian_key => $Silian_rule) {
            if (!array_key_exists($Silian_key, $Silian_supportRouting)) {
                continue;
            }

            $Silian_value = $Silian_supportRouting[$Silian_key];
            if ($Silian_value === '' || $Silian_value === null) {
                continue;
            }

            if ($Silian_rule['type'] === 'string') {
                $Silian_text = trim((string) $Silian_value);
                if ($Silian_text !== '') {
                    $Silian_normalized[$Silian_key] = $Silian_text;
                }
                continue;
            }

            if (!is_numeric($Silian_value)) {
                continue;
            }

            if ($Silian_rule['type'] === 'int') {
                try {
                    $Silian_number = InputValueNormalizer::integer($Silian_value, $Silian_key);
                } catch (\InvalidArgumentException) {
                    continue;
                }
            } else {
                $Silian_number = (float) $Silian_value;
            }
            $Silian_number = max($Silian_rule['min'], $Silian_number);
            if (isset($Silian_rule['max'])) {
                $Silian_number = min($Silian_rule['max'], $Silian_number);
            }
            $Silian_normalized[$Silian_key] = $Silian_number;
        }

        return $Silian_normalized;
    }


    private function jsonResponse(Response $Silian_response, array $Silian_data, int $Silian_status = 200): Response
    {
        $Silian_json = json_encode($Silian_data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $Silian_response->getBody()->write($Silian_json === false ? '{}' : $Silian_json);
        return $Silian_response->withHeader('Content-Type', 'application/json')->withStatus($Silian_status);
    }


    private function logExceptionWithFallback(\Throwable $Silian_exception, Request $Silian_request, string $Silian_contextMessage = ''): void
    {
        if ($this->errorLogService) {
            try {
                $Silian_extra = $Silian_contextMessage !== '' ? ['context_message' => $Silian_contextMessage] : [];
                $this->errorLogService->logException($Silian_exception, $Silian_request, $Silian_extra);
                return;
            } catch (\Throwable $Silian_loggingError) {
                error_log('ErrorLogService failed: ' . $Silian_loggingError->getMessage());
            }
        }
        if ($Silian_contextMessage !== '') {
            error_log($Silian_contextMessage);
        } else {
            error_log($Silian_exception->getMessage());
        }
    }

}


