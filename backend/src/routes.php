<?php

declare(strict_types=1);

use Slim\App;
use Slim\Routing\RouteCollectorProxy;
use CarbonTrack\Controllers\AuthController;
use CarbonTrack\Controllers\UserController;
use CarbonTrack\Controllers\CarbonTrackController;
use CarbonTrack\Controllers\CarbonActivityController;
use CarbonTrack\Controllers\ProductController;
use CarbonTrack\Controllers\MessageController;
use CarbonTrack\Controllers\SchoolController;
use CarbonTrack\Controllers\AdminController;
use CarbonTrack\Controllers\LeaderboardController;
use CarbonTrack\Controllers\FileUploadController;
use CarbonTrack\Controllers\AvatarController;
use CarbonTrack\Controllers\BadgeController;
use CarbonTrack\Controllers\AdminBadgeController;
use CarbonTrack\Controllers\SystemLogController;
use CarbonTrack\Controllers\AdminAiController;
use CarbonTrack\Controllers\UserAiController;
use CarbonTrack\Controllers\AdminUserGroupController;
use CarbonTrack\Controllers\LogSearchController;
use CarbonTrack\Controllers\AdminLlmUsageController;
use CarbonTrack\Controllers\StatsController;
use CarbonTrack\Controllers\CheckinController;
use CarbonTrack\Controllers\PasskeyController;
use CarbonTrack\Controllers\AdminSupportController;
use CarbonTrack\Controllers\AdminCronController;
use CarbonTrack\Controllers\CronController;
use CarbonTrack\Controllers\SupportTicketController;
use CarbonTrack\Middleware\AuthMiddleware;
use CarbonTrack\Middleware\AdminMiddleware;
use CarbonTrack\Middleware\SupportMiddleware;
use CarbonTrack\Middleware\RequestLoggingMiddleware;

// Constants to avoid duplicated literals
defined('CONTENT_TYPE_JSON') || define('CONTENT_TYPE_JSON', 'application/json');
defined('API_V1_PREFIX') || define('API_V1_PREFIX', '/api/v1');
defined('PATH_AVATARS') || define('PATH_AVATARS', '/avatars');
defined('PATH_AVATAR_ID') || define('PATH_AVATAR_ID', '/avatars/{id:[0-9]+}');
defined('PATH_CARBON_ACTIVITIES') || define('PATH_CARBON_ACTIVITIES', '/carbon-activities');
defined('PATH_CARBON_ACTIVITY_ID') || define('PATH_CARBON_ACTIVITY_ID', '/carbon-activities/{id}');
defined('PATH_TRANSACTIONS_ID_UUID') || define('PATH_TRANSACTIONS_ID_UUID', '/transactions/{id:[0-9a-fA-F\-]+}');
defined('PATH_STATS') || define('PATH_STATS', '/stats');
defined('PATH_PRODUCTS') || define('PATH_PRODUCTS', '/products');
defined('PATH_SCHOOLS') || define('PATH_SCHOOLS', '/schools');
defined('PATH_CLASSES_SUFFIX') || define('PATH_CLASSES_SUFFIX', '/classes');
defined('PATTERN_ID_NUMERIC') || define('PATTERN_ID_NUMERIC', '/{id:[0-9]+}');
defined('PATH_AUTH') || define('PATH_AUTH', '/auth');
defined('PATH_USERS') || define('PATH_USERS', '/users');


return function (App $Silian_app) {
    // 全局请求日志中间件（放在最前，捕获所有请求）
    try { $Silian_app->add(RequestLoggingMiddleware::class); } catch (\Throwable $Silian_e) { /* ignore if not resolvable */ }
    // 所有 helper 函数仅在闭包内部声明，避免全局污染
    $Silian_registerHealthCheck = function (App $Silian_app) {
        $Silian_app->get('/', function ($Silian_request, $Silian_response) {
            $Silian_request->getMethod();
            $Silian_response->getBody()->write(json_encode([
                'success' => true,
                'message' => 'CarbonTrack API is running',
                'version' => '1.0.0',
                'timestamp' => date('Y-m-d H:i:s')
            ]));
            return $Silian_response->withHeader('Content-Type', CONTENT_TYPE_JSON);
        });
    };

    $Silian_registerApiV1Root = function (RouteCollectorProxy $Silian_group) {
        $Silian_group->get('', function ($Silian_request, $Silian_response) {
            $Silian_request->getMethod();
            $Silian_response->getBody()->write(json_encode([
                'success' => true,
                'message' => 'CarbonTrack API v1',
                'version' => '1.0.0',
                'timestamp' => date('Y-m-d H:i:s'),
                'endpoints' => [
                    'auth' => API_V1_PREFIX . PATH_AUTH,
                    'users' => API_V1_PREFIX . PATH_USERS,
                    'carbon-activities' => API_V1_PREFIX . PATH_CARBON_ACTIVITIES,
                    'carbon-track' => API_V1_PREFIX . '/carbon-track',
                    'products' => API_V1_PREFIX . PATH_PRODUCTS,
                    'exchange' => API_V1_PREFIX . '/exchange',
                    'messages' => API_V1_PREFIX . '/messages',
                    'tickets' => API_V1_PREFIX . '/tickets',
                    'support' => API_V1_PREFIX . '/support',
                    'cron' => API_V1_PREFIX . '/cron/run',
                    'avatars' => API_V1_PREFIX . PATH_AVATARS,
                    'schools' => API_V1_PREFIX . PATH_SCHOOLS,
                    'files' => API_V1_PREFIX . '/files',
                    'admin' => API_V1_PREFIX . '/admin'
                ]
            ]));
            return $Silian_response->withHeader('Content-Type', CONTENT_TYPE_JSON);
        });
    };

    $Silian_registerAuthRoutes = function (RouteCollectorProxy $Silian_group) {
        $Silian_group->group(PATH_AUTH, function (RouteCollectorProxy $Silian_auth) {
            $Silian_auth->post('/register', [AuthController::class, 'register']);
            $Silian_auth->post('/login', [AuthController::class, 'login']);
            $Silian_auth->post('/passkey/login/options', [PasskeyController::class, 'beginAuthentication']);
            $Silian_auth->post('/passkey/login/verify', [PasskeyController::class, 'completeAuthentication']);
            $Silian_auth->post('/logout', [AuthController::class, 'logout']);
            $Silian_auth->post('/forgot-password', [AuthController::class, 'forgotPassword']);
            $Silian_auth->post('/send-verification-code', [AuthController::class, 'sendVerificationCode']);
            $Silian_auth->post('/reset-password', [AuthController::class, 'resetPassword']);
            $Silian_auth->post('/verify-email', [AuthController::class, 'verifyEmail']);
            $Silian_auth->post('/change-password', [AuthController::class, 'changePassword'])->add(AuthMiddleware::class);
        });
    };

    $Silian_registerUserRoutes = function (RouteCollectorProxy $Silian_group) {
        $Silian_group->group(PATH_USERS, function (RouteCollectorProxy $Silian_users) {
            $Silian_users->get('/me', [UserController::class, 'getCurrentUser']);
            $Silian_users->put('/me', [UserController::class, 'updateCurrentUser']);
            $Silian_users->put('/me/profile', [UserController::class, 'updateProfile']);
            $Silian_users->put('/me/avatar', [UserController::class, 'selectAvatar']);
            $Silian_users->get('/me/notification-preferences', [UserController::class, 'getNotificationPreferences']);
            $Silian_users->put('/me/notification-preferences', [UserController::class, 'updateNotificationPreferences']);
            $Silian_users->post('/me/notification-preferences/test-email', [UserController::class, 'sendNotificationTestEmail']);
            $Silian_users->get('/me/badges', [BadgeController::class, 'myBadges']);
            $Silian_users->get('/me/checkins', [CheckinController::class, 'list']);
            $Silian_users->post('/me/checkins/makeup', [CheckinController::class, 'makeup']);
            $Silian_users->get('/me/passkeys', [PasskeyController::class, 'list']);
            $Silian_users->post('/me/passkeys/registration/options', [PasskeyController::class, 'beginRegistration']);
            $Silian_users->post('/me/passkeys/registration/verify', [PasskeyController::class, 'completeRegistration']);
            $Silian_users->patch('/me/passkeys/{id:[0-9]+}', [PasskeyController::class, 'update']);
            $Silian_users->delete('/me/passkeys/{id:[0-9]+}', [PasskeyController::class, 'delete']);
            $Silian_users->get('/me/security-activity', [UserController::class, 'getSecurityActivity']);
            $Silian_users->get('/me/points-history', [UserController::class, 'getPointsHistory']);
            $Silian_users->get('/me/stats', [UserController::class, 'getUserStats']);
            $Silian_users->get('/me/chart-data', [UserController::class, 'getChartData']);
            $Silian_users->get('/me/activities', [UserController::class, 'getRecentActivities']);
        })->add(AuthMiddleware::class);
    };

    $Silian_registerAvatarRoutes = function (RouteCollectorProxy $Silian_group) {
        $Silian_group->get(PATH_AVATARS, [AvatarController::class, 'getAvatars']);
        $Silian_group->get(PATH_AVATARS . '/categories', [AvatarController::class, 'getAvatarCategories']);
    };

    $Silian_registerBadgeRoutes = function (RouteCollectorProxy $Silian_group) {
        $Silian_group->group('/badges', function (RouteCollectorProxy $Silian_badges) {
            $Silian_badges->get('', [BadgeController::class, 'list']);
            $Silian_badges->post('/auto-trigger', [BadgeController::class, 'triggerAuto']);
        })->add(AuthMiddleware::class);
    };

    $Silian_registerCarbonActivitiesRoutes = function (RouteCollectorProxy $Silian_group) {
        $Silian_group->get(PATH_CARBON_ACTIVITIES, [CarbonActivityController::class, 'getActivities']);
        $Silian_group->get(PATH_CARBON_ACTIVITY_ID, [CarbonActivityController::class, 'getActivity']);
    };

    $Silian_registerCarbonTrackRoutes = function (RouteCollectorProxy $Silian_group) {
        $Silian_group->group('/carbon-track', function (RouteCollectorProxy $Silian_carbon) {
            $Silian_carbon->post('/calculate', [CarbonTrackController::class, 'calculate']);
            $Silian_carbon->post('/record', [CarbonTrackController::class, 'submitRecord']);
            $Silian_carbon->get('/transactions', [CarbonTrackController::class, 'getUserRecords']);
            $Silian_carbon->get(PATH_TRANSACTIONS_ID_UUID, [CarbonTrackController::class, 'getRecordDetail']);
            $Silian_carbon->put(PATH_TRANSACTIONS_ID_UUID, [CarbonTrackController::class, 'reviewRecord']);
            $Silian_carbon->put('/transactions/{id:[0-9a-fA-F\-]+}/approve', [CarbonTrackController::class, 'reviewRecord']);
            $Silian_carbon->put('/transactions/{id:[0-9a-fA-F\-]+}/reject', [CarbonTrackController::class, 'reviewRecord']);
            $Silian_carbon->delete(PATH_TRANSACTIONS_ID_UUID, [CarbonTrackController::class, 'deleteTransaction']);
            $Silian_carbon->get('/factors', [CarbonTrackController::class, 'getCarbonFactors']);
            $Silian_carbon->get(PATH_STATS, [CarbonTrackController::class, 'getUserStats']);
        })->add(AuthMiddleware::class);

    // New standardized endpoint documented in OpenAPI replacing legacy /carbon-track/record
    // Enforces image requirement in controller based on path containing '/api/v1/carbon-records'
    $Silian_group->post('/carbon-records', [CarbonTrackController::class, 'submitRecord'])->add(AuthMiddleware::class);
    };

    $Silian_registerProductRoutes = function (RouteCollectorProxy $Silian_group) {
        $Silian_group->group(PATH_PRODUCTS, function (RouteCollectorProxy $Silian_products) {
            $Silian_products->get('', [ProductController::class, 'getProducts']);
            $Silian_products->get('/tags', [ProductController::class, 'searchProductTags']);
            $Silian_products->get(PATTERN_ID_NUMERIC, [ProductController::class, 'getProductDetail']);
            $Silian_products->get('/categories', [ProductController::class, 'getCategories']);
            $Silian_products->post('', [ProductController::class, 'createProduct']);
            $Silian_products->put(PATTERN_ID_NUMERIC, [ProductController::class, 'updateProduct']);
            $Silian_products->delete(PATTERN_ID_NUMERIC, [ProductController::class, 'deleteProduct']);
        });
    };

    $Silian_registerExchangeRoutes = function (RouteCollectorProxy $Silian_group) {
        $Silian_group->group('/exchange', function (RouteCollectorProxy $Silian_exchange) {
            $Silian_exchange->post('', [ProductController::class, 'exchangeProduct']);
            $Silian_exchange->get('/transactions', [ProductController::class, 'getExchangeTransactions']);
            $Silian_exchange->get(PATH_TRANSACTIONS_ID_UUID, [ProductController::class, 'getExchangeTransaction']);
        })->add(AuthMiddleware::class);
    };

    $Silian_registerMessageRoutes = function (RouteCollectorProxy $Silian_group) {
        $Silian_group->group('/messages', function (RouteCollectorProxy $Silian_messages) {
            $Silian_messages->get('', [MessageController::class, 'getUserMessages']);
            $Silian_messages->get(PATTERN_ID_NUMERIC, [MessageController::class, 'getMessageDetail']);
            $Silian_messages->put(PATTERN_ID_NUMERIC . '/read', [MessageController::class, 'markAsRead']);
            $Silian_messages->delete(PATTERN_ID_NUMERIC, [MessageController::class, 'deleteMessage']);
            $Silian_messages->get('/unread-count', [MessageController::class, 'getUnreadCount']);
            $Silian_messages->put('/mark-all-read', [MessageController::class, 'markAllAsRead']);
        })->add(AuthMiddleware::class);
    };

    $Silian_registerTicketRoutes = function (RouteCollectorProxy $Silian_group) {
        $Silian_group->group('/tickets', function (RouteCollectorProxy $Silian_tickets) {
            $Silian_tickets->post('', [SupportTicketController::class, 'createTicket']);
            $Silian_tickets->get('', [SupportTicketController::class, 'listMyTickets']);
            $Silian_tickets->get('/{ticketId:[0-9]+}', [SupportTicketController::class, 'getMyTicket']);
            $Silian_tickets->post('/{ticketId:[0-9]+}/messages', [SupportTicketController::class, 'addMyTicketMessage']);
            $Silian_tickets->post('/{ticketId:[0-9]+}/feedback', [SupportTicketController::class, 'submitMyTicketFeedback']);
        })->add(AuthMiddleware::class);
    };

    $Silian_registerSchoolRoutes = function (RouteCollectorProxy $Silian_group) {
        $Silian_group->get(PATH_SCHOOLS, [SchoolController::class, 'index']);
        $Silian_group->post(PATH_SCHOOLS, [SchoolController::class, 'createOrFetch'])->add(AuthMiddleware::class);
        $Silian_group->get(PATH_SCHOOLS . PATTERN_ID_NUMERIC . PATH_CLASSES_SUFFIX, [SchoolController::class, 'listClasses']);
        $Silian_group->post(PATH_SCHOOLS . PATTERN_ID_NUMERIC . PATH_CLASSES_SUFFIX, [SchoolController::class, 'createClass'])->add(AuthMiddleware::class);
    };

    $Silian_registerAdminRoutes = function (RouteCollectorProxy $Silian_group) {
        $Silian_group->group('/admin', function (RouteCollectorProxy $Silian_admin) {
            $Silian_admin->get(PATH_USERS, [AdminController::class, 'getUsers']);
            $Silian_admin->get('/passkeys', [PasskeyController::class, 'adminList']);
            $Silian_admin->get('/passkeys/stats', [PasskeyController::class, 'adminStats']);
            $Silian_admin->get(PATH_USERS . '/groups', [AdminUserGroupController::class, 'list']);
            $Silian_admin->get(PATH_USERS . '/groups/meta', [AdminUserGroupController::class, 'meta']);
            $Silian_admin->post(PATH_USERS . '/groups', [AdminUserGroupController::class, 'create']);
            $Silian_admin->put(PATH_USERS . '/groups/{id:[0-9]+}', [AdminUserGroupController::class, 'update']);
            $Silian_admin->delete(PATH_USERS . '/groups/{id:[0-9]+}', [AdminUserGroupController::class, 'delete']);

            $Silian_admin->get(PATH_USERS . PATTERN_ID_NUMERIC . '/badges', [AdminController::class, 'getUserBadges']);
            $Silian_admin->get(PATH_USERS . PATTERN_ID_NUMERIC . '/overview', [AdminController::class, 'getUserOverview']);
            $Silian_admin->get(PATH_USERS . PATTERN_ID_NUMERIC . '/security-activity', [AdminController::class, 'getUserSecurityActivity']);
            $Silian_admin->get(PATH_USERS . '/by-uuid/{uuid:[0-9a-fA-F\\-]+}/badges', [AdminController::class, 'getUserBadgesByUuid']);
            $Silian_admin->get(PATH_USERS . '/by-uuid/{uuid:[0-9a-fA-F\\-]+}/overview', [AdminController::class, 'getUserOverviewByUuid']);
            $Silian_admin->get(PATH_USERS . '/by-uuid/{uuid:[0-9a-fA-F\\-]+}/security-activity', [AdminController::class, 'getUserSecurityActivityByUuid']);
            // 用户管理
            $Silian_admin->put(PATH_USERS . PATTERN_ID_NUMERIC, [AdminController::class, 'updateUser']);
            $Silian_admin->delete(PATH_USERS . PATTERN_ID_NUMERIC, [AdminController::class, 'deleteUser']);
            $Silian_admin->post(PATH_USERS . PATTERN_ID_NUMERIC . '/points/adjust', [AdminController::class, 'adjustUserPoints']);
            $Silian_admin->put(PATH_USERS . '/by-uuid/{uuid:[0-9a-fA-F\\-]+}', [AdminController::class, 'updateUserByUuid']);
            $Silian_admin->delete(PATH_USERS . '/by-uuid/{uuid:[0-9a-fA-F\\-]+}', [AdminController::class, 'deleteUserByUuid']);
            $Silian_admin->post(PATH_USERS . '/by-uuid/{uuid:[0-9a-fA-F\\-]+}/points/adjust', [AdminController::class, 'adjustUserPointsByUuid']);
            $Silian_admin->get('/transactions/pending', [AdminController::class, 'getPendingTransactions']);
            $Silian_admin->get(PATH_STATS, [AdminController::class, 'getStats']);
            $Silian_admin->get('/logs', [AdminController::class, 'getLogs']);
            $Silian_admin->get('/ai/workspace', [AdminAiController::class, 'workspace']);
            $Silian_admin->post('/ai/chat', [AdminAiController::class, 'chat']);
            $Silian_admin->get('/ai/conversations', [AdminAiController::class, 'conversations']);
            $Silian_admin->get('/ai/conversations/{conversation_id}', [AdminAiController::class, 'conversationDetail']);
            $Silian_admin->post('/ai/intents', [AdminAiController::class, 'analyze']);
            $Silian_admin->post('/ai/announcement-drafts', [AdminAiController::class, 'generateAnnouncementDraft']);
            $Silian_admin->get('/ai/diagnostics', [AdminAiController::class, 'diagnostics']);
            $Silian_admin->get('/support/assignees', [AdminSupportController::class, 'listAssignees']);
            $Silian_admin->get('/support/assignees/{id:[0-9]+}', [AdminSupportController::class, 'getAssigneeDetail']);
            $Silian_admin->get('/support/assignees/{id:[0-9]+}/routing-profile', [AdminSupportController::class, 'getAssigneeRoutingProfile']);
            $Silian_admin->put('/support/assignees/{id:[0-9]+}/routing-profile', [AdminSupportController::class, 'updateAssigneeRoutingProfile']);
            $Silian_admin->get('/support/routing-settings', [AdminSupportController::class, 'getRoutingSettings']);
            $Silian_admin->put('/support/routing-settings', [AdminSupportController::class, 'updateRoutingSettings']);
            $Silian_admin->get('/support/tags', [AdminSupportController::class, 'listTags']);
            $Silian_admin->post('/support/tags', [AdminSupportController::class, 'createTag']);
            $Silian_admin->put('/support/tags/{id:[0-9]+}', [AdminSupportController::class, 'updateTag']);
            $Silian_admin->get('/support/rules', [AdminSupportController::class, 'listRules']);
            $Silian_admin->post('/support/rules', [AdminSupportController::class, 'createRule']);
            $Silian_admin->put('/support/rules/{id:[0-9]+}', [AdminSupportController::class, 'updateRule']);
            $Silian_admin->get('/support/tickets', [AdminSupportController::class, 'listTickets']);
            $Silian_admin->get('/support/tickets/{id:[0-9]+}', [AdminSupportController::class, 'getTicketDetail']);
            $Silian_admin->patch('/support/tickets/{id:[0-9]+}', [AdminSupportController::class, 'updateTicket']);
            $Silian_admin->get('/support/reports', [AdminSupportController::class, 'reports']);
            $Silian_admin->get('/cron/tasks', [AdminCronController::class, 'listTasks']);
            $Silian_admin->put('/cron/tasks/{taskKey:[^/]+}', [AdminCronController::class, 'updateTask']);
            $Silian_admin->get('/cron/runs', [AdminCronController::class, 'listRuns']);
            $Silian_admin->post('/cron/tasks/{taskKey:[^/]+}/run', [AdminCronController::class, 'runTask']);
            $Silian_admin->post(PATH_SCHOOLS, [SchoolController::class, 'store']);
            $Silian_admin->put(PATH_SCHOOLS . PATTERN_ID_NUMERIC, [SchoolController::class, 'update']);
            $Silian_admin->delete(PATH_SCHOOLS . PATTERN_ID_NUMERIC, [SchoolController::class, 'delete']);
            $Silian_admin->get(PATH_CARBON_ACTIVITIES, [CarbonActivityController::class, 'getActivitiesForAdmin']);
            $Silian_admin->post(PATH_CARBON_ACTIVITIES, [CarbonActivityController::class, 'createActivity']);
            $Silian_admin->get(PATH_CARBON_ACTIVITIES . '/statistics', [CarbonActivityController::class, 'getActivityStatistics']);
            $Silian_admin->put(PATH_CARBON_ACTIVITIES . '/sort-orders', [CarbonActivityController::class, 'updateSortOrders']);
            $Silian_admin->put(PATH_CARBON_ACTIVITY_ID, [CarbonActivityController::class, 'updateActivity']);
            $Silian_admin->delete(PATH_CARBON_ACTIVITY_ID, [CarbonActivityController::class, 'deleteActivity']);
            $Silian_admin->post(PATH_CARBON_ACTIVITY_ID . '/restore', [CarbonActivityController::class, 'restoreActivity']);
            $Silian_admin->get(PATH_CARBON_ACTIVITY_ID . '/statistics', [CarbonActivityController::class, 'getActivityStatistics']);
            $Silian_admin->get('/activities', [CarbonTrackController::class, 'getPendingRecords']);
            // 兼容别名：/admin/carbon-activities/pending 与 /admin/carbon-records
            $Silian_admin->get('/carbon-activities/pending', [CarbonTrackController::class, 'getPendingRecords']);
            $Silian_admin->get('/carbon-records', [CarbonTrackController::class, 'getPendingRecords']);
            // 系统请求日志
            $Silian_admin->get('/system-logs', [SystemLogController::class, 'list']);
            $Silian_admin->get('/system-logs/{id:[0-9]+}', [SystemLogController::class, 'detail']);
            $Silian_admin->get('/llm-usage', [AdminLlmUsageController::class, 'summary']);
            $Silian_admin->get('/llm-usage/analytics', [AdminLlmUsageController::class, 'analytics']);
            $Silian_admin->get('/llm-usage/logs/{id:[0-9]+}', [AdminLlmUsageController::class, 'logDetail']);
            $Silian_admin->get('/logs/search', [LogSearchController::class, 'search']);
            // Unified logs export & related (previously missing, causing 404 in frontend)
            $Silian_admin->get('/logs/export', [LogSearchController::class, 'export']);
            $Silian_admin->get('/logs/related', [LogSearchController::class, 'related']);
            $Silian_admin->put('/activities/review', [CarbonTrackController::class, 'reviewRecordsBulk']);
            $Silian_admin->put('/activities/{id:[0-9a-fA-F\-]+}/review', [CarbonTrackController::class, 'reviewRecord']);
            $Silian_admin->get('/exchanges', [ProductController::class, 'getExchangeRecords']);
            $Silian_admin->get('/exchanges/{id:[0-9a-fA-F\-]+}', [ProductController::class, 'getExchangeRecordDetail']);
            $Silian_admin->put('/exchanges/{id:[0-9a-fA-F\-]+}/status', [ProductController::class, 'updateExchangeStatus']);
            $Silian_admin->put('/exchanges/{id:[0-9a-fA-F\-]+}', [ProductController::class, 'updateExchangeStatus']);
            // 站内信广播
            $Silian_admin->post('/messages/broadcast', [MessageController::class, 'sendSystemMessage']);
            $Silian_admin->get('/messages/broadcast/recipients', [MessageController::class, 'searchBroadcastRecipients']);
            $Silian_admin->get('/messages/broadcasts', [MessageController::class, 'getBroadcastHistory']);
            $Silian_admin->post('/messages/broadcasts/flush', [MessageController::class, 'flushBroadcastEmailQueue']);
            $Silian_admin->get(PATH_PRODUCTS, [ProductController::class, 'getProducts']);
            $Silian_admin->get(PATH_PRODUCTS . '/tags', [ProductController::class, 'searchProductTags']);
            $Silian_admin->post(PATH_PRODUCTS, [ProductController::class, 'createProduct']);
            $Silian_admin->put(PATH_PRODUCTS . PATTERN_ID_NUMERIC, [ProductController::class, 'updateProduct']);
            $Silian_admin->delete(PATH_PRODUCTS . PATTERN_ID_NUMERIC, [ProductController::class, 'deleteProduct']);
            $Silian_admin->get(PATH_AVATARS, [AvatarController::class, 'getAvatars']);
            $Silian_admin->post(PATH_AVATARS, [AvatarController::class, 'createAvatar']);
            $Silian_admin->put(PATH_AVATARS . '/sort-orders', [AvatarController::class, 'updateSortOrders']);
            $Silian_admin->get(PATH_AVATARS . '/usage-stats', [AvatarController::class, 'getAvatarUsageStats']);
            $Silian_admin->post(PATH_AVATARS . '/upload', [AvatarController::class, 'uploadAvatarFile']);
            $Silian_admin->get(PATH_AVATAR_ID, [AvatarController::class, 'getAvatar']);
            $Silian_admin->put(PATH_AVATAR_ID, [AvatarController::class, 'updateAvatar']);
            $Silian_admin->delete(PATH_AVATAR_ID, [AvatarController::class, 'deleteAvatar']);
            $Silian_admin->get('/badges', [AdminBadgeController::class, 'list']);
            $Silian_admin->get('/badges/{id:[0-9]+}', [AdminBadgeController::class, 'detail']);
            $Silian_admin->post('/badges', [AdminBadgeController::class, 'create']);
            $Silian_admin->put('/badges/{id:[0-9]+}', [AdminBadgeController::class, 'update']);
            $Silian_admin->post('/badges/{id:[0-9]+}/award', [AdminBadgeController::class, 'award']);
            $Silian_admin->post('/badges/{id:[0-9]+}/revoke', [AdminBadgeController::class, 'revoke']);
            $Silian_admin->get('/badges/{id:[0-9]+}/recipients', [AdminBadgeController::class, 'recipients']);
            $Silian_admin->post('/badges/auto-trigger', [AdminBadgeController::class, 'triggerAuto']);
            $Silian_admin->post(PATH_AVATAR_ID . '/restore', [AvatarController::class, 'restoreAvatar']);
            $Silian_admin->put(PATH_AVATAR_ID . '/set-default', [AvatarController::class, 'setDefaultAvatar']);
        })->add(AuthMiddleware::class)->add(AdminMiddleware::class);
    };

    $Silian_registerSupportRoutes = function (RouteCollectorProxy $Silian_group) {
        $Silian_group->post('/support/sla-sweep', [SupportTicketController::class, 'runSlaSweep']);
        $Silian_group->post('/cron/run', [CronController::class, 'run']);
        $Silian_group->group('/support', function (RouteCollectorProxy $Silian_support) {
            $Silian_support->get('/assignees', [SupportTicketController::class, 'listSupportAssignees']);
            $Silian_support->get('/tickets', [SupportTicketController::class, 'listSupportTickets']);
            $Silian_support->get('/tickets/{ticketId:[0-9]+}', [SupportTicketController::class, 'getSupportTicket']);
            $Silian_support->post('/tickets/{ticketId:[0-9]+}/messages', [SupportTicketController::class, 'addSupportTicketMessage']);
            $Silian_support->patch('/tickets/{ticketId:[0-9]+}', [SupportTicketController::class, 'updateSupportTicket']);
            $Silian_support->post('/tickets/{ticketId:[0-9]+}/transfer-requests', [SupportTicketController::class, 'createTransferRequest']);
            $Silian_support->patch('/transfer-requests/{requestId:[0-9]+}', [SupportTicketController::class, 'reviewTransferRequest']);
        })->add(AuthMiddleware::class)->add(SupportMiddleware::class);
    };

    $Silian_registerFileRoutes = function (RouteCollectorProxy $Silian_group) {
        $Silian_group->group('/files', function (RouteCollectorProxy $Silian_files) {
            // 前端直传：获取预签名、确认
            $Silian_files->post('/presign', [FileUploadController::class, 'getDirectUploadPresign']);
            $Silian_files->post('/confirm', [FileUploadController::class, 'confirmDirectUpload']);
            // 多分片上传
            $Silian_files->post('/multipart/init', [FileUploadController::class, 'initMultipartUpload']);
            $Silian_files->get('/multipart/part', [FileUploadController::class, 'getMultipartPartUrl']);
            $Silian_files->post('/multipart/complete', [FileUploadController::class, 'completeMultipartUpload']);
            $Silian_files->post('/multipart/abort', [FileUploadController::class, 'abortMultipartUpload']);
            $Silian_files->post('/upload', [FileUploadController::class, 'uploadFile']);
            $Silian_files->post('/upload-multiple', [FileUploadController::class, 'uploadMultipleFiles']);
            $Silian_files->get('/r2/diagnostics', [FileUploadController::class, 'r2Diagnostics']);
            $Silian_files->delete('/{path:.+}', [FileUploadController::class, 'deleteFile']);
            $Silian_files->get('/{path:.+}/info', [FileUploadController::class, 'getFileInfo']);
            $Silian_files->get('/{path:.+}/presigned-url', [FileUploadController::class, 'generatePresignedUrl']);
        })->add(AuthMiddleware::class);
    };

    $Silian_registerLeaderboardRoutes = function (RouteCollectorProxy $Silian_group) {
        $Silian_group->get('/leaderboard/trigger', [LeaderboardController::class, 'triggerRefresh']);
    };

    // Health check
    $Silian_registerHealthCheck($Silian_app);

    // API v1 routes
    $Silian_app->group(API_V1_PREFIX, function (RouteCollectorProxy $Silian_group) use (
        $Silian_registerApiV1Root,
        $Silian_registerAuthRoutes,
        $Silian_registerUserRoutes,
        $Silian_registerAvatarRoutes,
        $Silian_registerBadgeRoutes,
        $Silian_registerCarbonActivitiesRoutes,
        $Silian_registerCarbonTrackRoutes,
        $Silian_registerProductRoutes,
        $Silian_registerExchangeRoutes,
        $Silian_registerMessageRoutes,
        $Silian_registerTicketRoutes,
        $Silian_registerSchoolRoutes,
        $Silian_registerAdminRoutes,
        $Silian_registerSupportRoutes,
        $Silian_registerFileRoutes,
        $Silian_registerLeaderboardRoutes
    ) {
        $Silian_registerApiV1Root($Silian_group);
        $Silian_registerAuthRoutes($Silian_group);
        $Silian_registerUserRoutes($Silian_group);
        $Silian_registerAvatarRoutes($Silian_group);
        $Silian_registerBadgeRoutes($Silian_group);
        $Silian_registerCarbonActivitiesRoutes($Silian_group);
        $Silian_registerCarbonTrackRoutes($Silian_group);
        $Silian_registerProductRoutes($Silian_group);
        $Silian_registerExchangeRoutes($Silian_group);
        $Silian_registerMessageRoutes($Silian_group);
        $Silian_registerTicketRoutes($Silian_group);
        $Silian_registerSchoolRoutes($Silian_group);
        $Silian_registerAdminRoutes($Silian_group);
        $Silian_registerSupportRoutes($Silian_group);
        $Silian_registerFileRoutes($Silian_group);
        $Silian_registerLeaderboardRoutes($Silian_group);

        // Admin file management routes (separate prefix)
        $Silian_group->group('/admin/files', function (RouteCollectorProxy $Silian_adminFiles) {
            $Silian_adminFiles->get('', [FileUploadController::class, 'getFilesList']);
            $Silian_adminFiles->get(PATH_STATS, [FileUploadController::class, 'getStorageStats']);
            $Silian_adminFiles->post('/cleanup', [FileUploadController::class, 'cleanupExpiredFiles']);
        })->add(AuthMiddleware::class)->add(AdminMiddleware::class);

        $Silian_group->get('/stats/summary', [StatsController::class, 'getPublicSummary']);

        // Backward-compatible aliases for activities listing and categories
        $Silian_group->get('/activities', [CarbonTrackController::class, 'getUserRecords'])->add(AuthMiddleware::class);
        $Silian_group->get('/activities/categories', [CarbonActivityController::class, 'getCategories'])->add(AuthMiddleware::class);

        // AI Assistant
        $Silian_group->post('/ai/suggest-activity', [UserAiController::class, 'suggestActivity'])
              ->add(AuthMiddleware::class);
    });

    // Backward-compatible alias group for clients calling /api/auth/* (without version prefix)
    $Silian_app->group('/api', function (RouteCollectorProxy $Silian_api) use ($Silian_registerSchoolRoutes, $Silian_registerMessageRoutes) {
        $Silian_api->group('/auth', function (RouteCollectorProxy $Silian_auth) {
            $Silian_auth->post('/register', [AuthController::class, 'register']);
            $Silian_auth->post('/login', [AuthController::class, 'login']);
            $Silian_auth->post('/logout', [AuthController::class, 'logout']);
            $Silian_auth->post('/forgot-password', [AuthController::class, 'forgotPassword']);
            $Silian_auth->post('/send-verification-code', [AuthController::class, 'sendVerificationCode']);
            $Silian_auth->post('/reset-password', [AuthController::class, 'resetPassword']);
            $Silian_auth->post('/verify-email', [AuthController::class, 'verifyEmail']);
            $Silian_auth->post('/change-password', [AuthController::class, 'changePassword'])->add(AuthMiddleware::class);
        });

        // Backward-compatible aliases for schools endpoints (mirror /api/v1)
        $Silian_registerSchoolRoutes($Silian_api);
        // Also expose messages endpoints without version prefix for older clients/proxies
        // This provides compatibility for requests like /api/messages/unread-count
        $Silian_registerMessageRoutes($Silian_api);
    });

    // Catch-all route for 404
    $Silian_app->map(['GET', 'POST', 'PUT', 'DELETE', 'PATCH'], '/{routes:.+}', function ($Silian_request, $Silian_response) {
        $Silian_request->getMethod();
        $Silian_response->getBody()->write(json_encode([
            'success' => false,
            'message' => 'Route not found',
            'code' => 'ROUTE_NOT_FOUND'
        ]));
        return $Silian_response->withStatus(404)->withHeader('Content-Type', CONTENT_TYPE_JSON);
    });
};
