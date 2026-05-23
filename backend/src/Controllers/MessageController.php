<?php

namespace CarbonTrack\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use CarbonTrack\Services\MessageService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\EmailService;
use CarbonTrack\Services\UserProfileViewService;
use CarbonTrack\Models\Message;
use PDO;

class MessageController
{
    private const BROADCAST_CONTENT_FORMAT_TEXT = 'text';
    private const BROADCAST_CONTENT_FORMAT_HTML = 'html';
    private const BROADCAST_RENDER_PROFILE_HTML = 'announcement_html_v1';
    private const BROADCAST_RENDER_VERSION_HTML = 1;
    private const BROADCAST_SOURCE_KIND_ADMIN = 'admin_broadcast';

    private PDO $db;
    private MessageService $messageService;
    private AuditLogService $auditLog;
    private AuthService $authService;
    private ?EmailService $emailService;
    private ?ErrorLogService $errorLogService;
    private UserProfileViewService $userProfileViewService;

    public function __construct(
        PDO $Silian_db,
        MessageService $Silian_messageService,
        AuditLogService $Silian_auditLog,
        AuthService $Silian_authService,
        UserProfileViewService $Silian_userProfileViewService,
        ?EmailService $Silian_emailService = null,
        ?ErrorLogService $Silian_errorLogService = null
    ) {
        $this->db = $Silian_db;
        $this->messageService = $Silian_messageService;
        $this->auditLog = $Silian_auditLog;
        $this->authService = $Silian_authService;
        $this->userProfileViewService = $Silian_userProfileViewService;
        $this->emailService = $Silian_emailService;
        $this->errorLogService = $Silian_errorLogService;
    }

    /**
     * 获取用户消息列表
     */
    public function getUserMessages(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, ['error' => 'Unauthorized'], 401);
            }

            $Silian_params = $Silian_request->getQueryParams();
            $Silian_page = max(1, intval($Silian_params['page'] ?? 1));
            $Silian_limit = min(50, max(10, intval($Silian_params['limit'] ?? 20)));
            $Silian_offset = ($Silian_page - 1) * $Silian_limit;

            // 构建查询条件
            $Silian_where = ['m.receiver_id = :user_id', 'm.deleted_at IS NULL'];
            $Silian_bindings = ['user_id' => $Silian_user['id']];

            // 状态筛选：前端使用 `status=unread|read`
            if (isset($Silian_params['status']) && $Silian_params['status'] !== '') {
                if ($Silian_params['status'] === 'unread') {
                    $Silian_where[] = 'm.is_read = 0';
                } elseif ($Silian_params['status'] === 'read') {
                    $Silian_where[] = 'm.is_read = 1';
                }
            }

            // 搜索：在 title 和 content 上模糊匹配
            if (!empty($Silian_params['search'])) {
                $Silian_where[] = '(m.title LIKE :search_title OR m.content LIKE :search_content)';
                $Silian_searchPattern = '%' . trim((string)$Silian_params['search']) . '%';
                $Silian_bindings['search_title'] = $Silian_searchPattern;
                $Silian_bindings['search_content'] = $Silian_searchPattern;
            }

            $Silian_whereClause = implode(' AND ', $Silian_where);

            // 计算总数
            $Silian_countSql = "SELECT COUNT(*) as total FROM messages m WHERE {$Silian_whereClause}";
            $Silian_countStmt = $this->db->prepare($Silian_countSql);
            $Silian_countStmt->execute($Silian_bindings);
            $Silian_total = $Silian_countStmt->fetch(PDO::FETCH_ASSOC)['total'];

            // 检查 messages 表是否包含 priority 列（兼容老数据库）
            $Silian_hasPriority = false;
            try {
                $Silian_colStmt = $this->db->query("SHOW COLUMNS FROM messages LIKE 'priority'");
                if ($Silian_colStmt && $Silian_colStmt->fetch()) {
                    $Silian_hasPriority = true;
                }
            } catch (\Throwable $Silian__) {
                // ignore - absence of column will be handled
                $Silian_hasPriority = false;
            }

            // 构建 priority 排序表达式（数值越大优先级越高）
            if ($Silian_hasPriority) {
                $Silian_priorityExpr = "(CASE COALESCE(m.priority,'normal') WHEN 'urgent' THEN 3 WHEN 'high' THEN 2 WHEN 'normal' THEN 1 WHEN 'low' THEN 0 ELSE 1 END)";
            } else {
                // 不存在 priority 列时，使用 0 常量占位（对排序无影响）
                $Silian_priorityExpr = "0";
            }

            // 处理排序参数，确保 priority 排序优先于用户指定排序
            $Silian_sort = trim((string)($Silian_params['sort'] ?? 'created_at_desc'));
            $Silian_userOrder = 'm.created_at DESC';
            $Silian_priorityOrderDir = 'DESC';

            switch ($Silian_sort) {
                case 'created_at_asc':
                    $Silian_userOrder = 'm.created_at ASC';
                    break;
                case 'created_at_desc':
                    $Silian_userOrder = 'm.created_at DESC';
                    break;
                case 'priority_asc':
                    // 用户请求优先级从低到高：priority 升序
                    $Silian_priorityOrderDir = 'ASC';
                    // 仍然在同一优先级内按时间倒序
                    $Silian_userOrder = 'm.created_at DESC';
                    break;
                case 'priority_desc':
                    $Silian_priorityOrderDir = 'DESC';
                    $Silian_userOrder = 'm.created_at DESC';
                    break;
                default:
                    // fallback
                    $Silian_userOrder = 'm.created_at DESC';
            }

            // 最终 ORDER BY：未读优先 -> priority 优先 -> 用户排序 -> 最后按 id 保持稳定
            $Silian_orderParts = [];
            $Silian_orderParts[] = 'm.is_read ASC';
            if ($Silian_hasPriority) {
                $Silian_orderParts[] = $Silian_priorityExpr . ' ' . $Silian_priorityOrderDir;
            }
            $Silian_orderParts[] = $Silian_userOrder;
            $Silian_orderParts[] = 'm.id DESC';
            $Silian_orderClause = implode(', ', $Silian_orderParts);

            // 获取消息列表
            $Silian_sql = "
                SELECT
                    m.*
                FROM messages m
                WHERE {$Silian_whereClause}
                ORDER BY {$Silian_orderClause}
                LIMIT :limit OFFSET :offset
            ";

            $Silian_stmt = $this->db->prepare($Silian_sql);
            foreach ($Silian_bindings as $Silian_key => $Silian_value) {
                $Silian_stmt->bindValue($Silian_key, $Silian_value);
            }
            $Silian_stmt->bindValue('limit', $Silian_limit, PDO::PARAM_INT);
            $Silian_stmt->bindValue('offset', $Silian_offset, PDO::PARAM_INT);
            $Silian_stmt->execute();

            $Silian_messages = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC);

            // Cast is_read to boolean
            foreach ($Silian_messages as &$Silian_msg) {
                $Silian_msg['is_read'] = (bool)($Silian_msg['is_read'] ?? false);
            }

            return $this->json($Silian_response, [
                'success' => true,
                'data' => $Silian_messages,
                'pagination' => [
                    'page' => $Silian_page,
                    'limit' => $Silian_limit,
                    'total' => intval($Silian_total),
                    'pages' => ceil($Silian_total / $Silian_limit)
                ]
            ]);

        } catch (\Exception $Silian_e) {
            try { if ($this->errorLogService) { $this->errorLogService->logException($Silian_e, $Silian_request); } } catch (\Throwable $Silian_ignore) {}
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * 获取消息详情
     */
    public function getMessageDetail(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, ['error' => 'Unauthorized'], 401);
            }

            $Silian_messageId = $Silian_args['id'];

            $Silian_sql = "
                SELECT
                    m.*
                FROM messages m
                WHERE m.id = :message_id AND m.receiver_id = :user_id AND m.deleted_at IS NULL
            ";

            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute([
                'message_id' => $Silian_messageId,
                'user_id' => $Silian_user['id']
            ]);

            $Silian_message = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
            if (!$Silian_message) {
                return $this->json($Silian_response, ['error' => 'Message not found'], 404);
            }

            // 如果消息未读，标记为已读
            if (!($Silian_message['is_read'] ?? false)) {
                $this->markMessageAsRead($Silian_messageId);
                $Silian_message['is_read'] = true;
            }

            return $this->json($Silian_response, [
                'success' => true,
                'data' => $Silian_message
            ]);

        } catch (\Exception $Silian_e) {
            try { if ($this->errorLogService) { $this->errorLogService->logException($Silian_e, $Silian_request); } } catch (\Throwable $Silian_ignore) {}
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * 标记消息为已读
     */
    public function markAsRead(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, ['error' => 'Unauthorized'], 401);
            }

            $Silian_messageId = $Silian_args['id'];

            // 验证消息属于当前用户
            $Silian_sql = "SELECT id FROM messages WHERE id = :id AND receiver_id = :user_id AND deleted_at IS NULL";
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute(['id' => $Silian_messageId, 'user_id' => $Silian_user['id']]);

            if (!$Silian_stmt->fetch()) {
                return $this->json($Silian_response, ['error' => 'Message not found'], 404);
            }

            // 标记为已读
            $this->markMessageAsRead($Silian_messageId);

            return $this->json($Silian_response, [
                'success' => true,
                'message' => 'Message marked as read'
            ]);

        } catch (\Exception $Silian_e) {
            try { if ($this->errorLogService) { $this->errorLogService->logException($Silian_e, $Silian_request); } } catch (\Throwable $Silian_ignore) {}
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * 批量标记消息为已读
     */
    public function markAllAsRead(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, ['error' => 'Unauthorized'], 401);
            }

            $Silian_data = $Silian_request->getParsedBody();
            $Silian_messageIds = $Silian_data['message_ids'] ?? [];

            if (empty($Silian_messageIds)) {
                // 标记所有未读消息为已读
                $Silian_sql = "
                    UPDATE messages
                    SET is_read = 1, updated_at = NOW()
                    WHERE receiver_id = :user_id AND is_read = 0 AND deleted_at IS NULL
                ";
                $Silian_stmt = $this->db->prepare($Silian_sql);
                $Silian_stmt->execute(['user_id' => $Silian_user['id']]);
                $Silian_affectedRows = $Silian_stmt->rowCount();
            } else {
                // 标记指定消息为已读
                $Silian_placeholders = str_repeat('?,', count($Silian_messageIds) - 1) . '?';
                $Silian_sql = "
                    UPDATE messages
                    SET is_read = 1, updated_at = NOW()
                    WHERE receiver_id = ? AND id IN ({$Silian_placeholders}) AND is_read = 0 AND deleted_at IS NULL
                ";
                $Silian_stmt = $this->db->prepare($Silian_sql);
                $Silian_stmt->execute(array_merge([$Silian_user['id']], $Silian_messageIds));
                $Silian_affectedRows = $Silian_stmt->rowCount();
            }

            return $this->json($Silian_response, [
                'success' => true,
                'affected_rows' => $Silian_affectedRows,
                'message' => 'Messages marked as read'
            ]);

        } catch (\Exception $Silian_e) {
            try { if ($this->errorLogService) { $this->errorLogService->logException($Silian_e, $Silian_request); } } catch (\Throwable $Silian_ignore) {}
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * 删除消息
     */
    public function deleteMessage(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, ['error' => 'Unauthorized'], 401);
            }

            $Silian_messageId = $Silian_args['id'];

            // 验证消息属于当前用户
            $Silian_sql = "SELECT id FROM messages WHERE id = :id AND receiver_id = :user_id AND deleted_at IS NULL";
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute(['id' => $Silian_messageId, 'user_id' => $Silian_user['id']]);

            if (!$Silian_stmt->fetch()) {
                return $this->json($Silian_response, ['error' => 'Message not found'], 404);
            }

            // 软删除消息
            $Silian_sql = "UPDATE messages SET deleted_at = NOW() WHERE id = :id";
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute(['id' => $Silian_messageId]);

            // 记录审计日志
            $this->auditLog->log([
                'user_id' => $Silian_user['id'],
                'actor_type' => 'user',
                'action' => 'message_deleted',
                'operation_category' => 'message',
                'affected_table' => 'messages',
                'affected_id' => $Silian_messageId,
                'data' => ['message_id' => $Silian_messageId],
            ]);

            return $this->json($Silian_response, [
                'success' => true,
                'message' => 'Message deleted successfully'
            ]);

        } catch (\Exception $Silian_e) {
            try { if ($this->errorLogService) { $this->errorLogService->logException($Silian_e, $Silian_request); } } catch (\Throwable $Silian_ignore) {}
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * 批量删除消息
     */
    public function deleteMessages(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, ['error' => 'Unauthorized'], 401);
            }

            $Silian_data = $Silian_request->getParsedBody();
            $Silian_messageIds = $Silian_data['message_ids'] ?? [];

            if (empty($Silian_messageIds)) {
                return $this->json($Silian_response, ['error' => 'No message IDs provided'], 400);
            }

            // 验证所有消息都属于当前用户
            $Silian_placeholders = str_repeat('?,', count($Silian_messageIds) - 1) . '?';
            $Silian_sql = "
                SELECT COUNT(*) as count
                FROM messages
                WHERE receiver_id = ? AND id IN ({$Silian_placeholders}) AND deleted_at IS NULL
            ";
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute(array_merge([$Silian_user['id']], $Silian_messageIds));
            $Silian_validCount = $Silian_stmt->fetch(PDO::FETCH_ASSOC)['count'];

            if ($Silian_validCount != count($Silian_messageIds)) {
                return $this->json($Silian_response, ['error' => 'Some messages not found or not owned by user'], 400);
            }

            // 批量软删除
            $Silian_sql = "
                UPDATE messages
                SET deleted_at = NOW()
                WHERE receiver_id = ? AND id IN ({$Silian_placeholders}) AND deleted_at IS NULL
            ";
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute(array_merge([$Silian_user['id']], $Silian_messageIds));
            $Silian_affectedRows = $Silian_stmt->rowCount();

            // 记录审计日志
            $this->auditLog->log([
                'user_id' => $Silian_user['id'],
                'actor_type' => 'user',
                'action' => 'messages_batch_deleted',
                'operation_category' => 'message',
                'affected_table' => 'messages',
                'affected_id' => null,
                'data' => ['message_ids' => $Silian_messageIds, 'count' => $Silian_affectedRows],
            ]);

            return $this->json($Silian_response, [
                'success' => true,
                'affected_rows' => $Silian_affectedRows,
                'message' => 'Messages deleted successfully'
            ]);

        } catch (\Exception $Silian_e) {
            try { if ($this->errorLogService) { $this->errorLogService->logException($Silian_e, $Silian_request); } } catch (\Throwable $Silian_ignore) {}
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * 获取未读消息数量
     */
    public function getUnreadCount(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, ['error' => 'Unauthorized'], 401);
            }

            $Silian_sql = "
                SELECT
                    COUNT(*) as total_unread
                FROM messages
                WHERE receiver_id = :user_id AND is_read = 0 AND deleted_at IS NULL
            ";

            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute(['user_id' => $Silian_user['id']]);
            $Silian_counts = $Silian_stmt->fetch(PDO::FETCH_ASSOC);

            return $this->json($Silian_response, [
                'success' => true,
                'data' => [
                    'total_unread' => intval($Silian_counts['total_unread']),
                    'urgent_unread' => 0,
                    'high_unread' => 0,
                    'system_unread' => 0,
                    'notification_unread' => 0
                ]
            ]);

        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) {}
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * 管理员发送系统消息
     */
    public function sendSystemMessage(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->json($Silian_response, ['error' => 'Admin access required'], 403);
            }

            $Silian_data = $Silian_request->getParsedBody();
            if (!is_array($Silian_data)) {
                return $this->json($Silian_response, ['error' => 'Invalid payload'], 400);
            }

            $Silian_title = trim((string)($Silian_data['title'] ?? ''));
            if ($Silian_title === '') {
                return $this->json($Silian_response, ['error' => 'Missing required field: title'], 400);
            }
            if (mb_strlen($Silian_title, 'UTF-8') > 255) {
                return $this->json($Silian_response, ['error' => 'Title must be 255 characters or less'], 422);
            }

            $Silian_content = trim((string)($Silian_data['content'] ?? ''));
            if ($Silian_content === '') {
                return $this->json($Silian_response, ['error' => 'Missing required field: content'], 400);
            }

            $Silian_contentFormat = $this->normalizeBroadcastContentFormat($Silian_data['content_format'] ?? self::BROADCAST_CONTENT_FORMAT_TEXT);
            if ($Silian_contentFormat === null) {
                return $this->json($Silian_response, ['error' => 'Invalid content_format value'], 422);
            }

            $Silian_renderProfile = $this->normalizeBroadcastRenderProfile($Silian_data['render_profile'] ?? null, $Silian_contentFormat);
            if ($Silian_contentFormat === self::BROADCAST_CONTENT_FORMAT_HTML && $Silian_renderProfile === null) {
                return $this->json($Silian_response, ['error' => 'Invalid render_profile value'], 422);
            }
            $Silian_renderVersion = $this->resolveBroadcastRenderVersion($Silian_contentFormat, $Silian_renderProfile);
            $Silian_sourceKind = self::BROADCAST_SOURCE_KIND_ADMIN;

            $Silian_content = $this->normalizeBroadcastContent($Silian_content, $Silian_contentFormat);
            if ($Silian_content === '') {
                return $this->json($Silian_response, ['error' => 'Content cannot be empty after sanitization'], 422);
            }

            $Silian_priorityRaw = $Silian_data['priority'] ?? Message::PRIORITY_NORMAL;
            $Silian_priority = strtolower(trim((string)$Silian_priorityRaw));
            if ($Silian_priority === '') {
                $Silian_priority = Message::PRIORITY_NORMAL;
            }
            $Silian_validPriorities = Message::getValidPriorities();
            if (!in_array($Silian_priority, $Silian_validPriorities, true)) {
                return $this->json($Silian_response, ['error' => 'Invalid priority value'], 422);
            }

            $Silian_targetUsersRaw = $Silian_data['target_users'] ?? null;
            $Silian_filterGroupsRaw = $Silian_data['target_filters'] ?? null;

            $Silian_targetUserRecords = [];
            $Silian_targetUserIds = [];
            $Silian_invalidTargetIds = [];
            $Silian_errorLogIds = [];
            $Silian_loggedErrorMessages = [];

            if ($Silian_targetUsersRaw !== null) {
                if (!is_array($Silian_targetUsersRaw)) {
                    return $this->json($Silian_response, ['error' => 'target_users must be an array of positive integers'], 400);
                }
                $Silian_resolved = $this->resolveExplicitRecipients($Silian_targetUsersRaw);
                if ($Silian_resolved['error']) {
                    return $this->json($Silian_response, ['error' => $Silian_resolved['error']], $Silian_resolved['status']);
                }
                $Silian_targetUserIds = $Silian_resolved['user_ids'];
                $Silian_targetUserRecords = $Silian_resolved['records'];
                $Silian_invalidTargetIds = $Silian_resolved['invalid_ids'];
            }

            if ($Silian_filterGroupsRaw !== null) {
                if (!is_array($Silian_filterGroupsRaw)) {
                    return $this->json($Silian_response, ['error' => 'target_filters must be an array'], 400);
                }
                $Silian_filterResult = $this->resolveFilteredRecipients($Silian_filterGroupsRaw);
                $Silian_targetUserIds = array_values(array_unique(array_merge($Silian_targetUserIds, $Silian_filterResult['user_ids'])));
                foreach ($Silian_filterResult['records'] as $Silian_id => $Silian_record) {
                    if (!isset($Silian_targetUserRecords[$Silian_id])) {
                        $Silian_targetUserRecords[$Silian_id] = $Silian_record;
                    }
                }
            }

            $Silian_scope = 'all';
            if ($Silian_targetUsersRaw !== null || $Silian_filterGroupsRaw !== null) {
                $Silian_scope = 'custom';
            }

            if ($Silian_scope === 'all' && empty($Silian_targetUserIds)) {
                $Silian_allResult = $this->resolveAllRecipients();
                $Silian_targetUserIds = $Silian_allResult['user_ids'];
                $Silian_targetUserRecords = $Silian_allResult['records'];
            }

            if (empty($Silian_targetUserIds)) {
                return $this->json($Silian_response, ['error' => 'No target users found for broadcast'], 404);
            }

            $Silian_sentCount = 0;
            $Silian_failedUserIds = [];
            $Silian_createdMessageIds = [];
            foreach ($Silian_targetUserIds as $Silian_targetUserId) {
                try {
                    $Silian_message = $this->messageService->sendSystemMessage(
                        (int)$Silian_targetUserId,
                        $Silian_title,
                        $Silian_content,
                        Message::TYPE_SYSTEM,
                        $Silian_priority,
                        null,
                        null,
                        false
                    );
                    $Silian_sentCount++;
                    if ($Silian_message && isset($Silian_message->id)) {
                        $Silian_createdMessageIds[(int)$Silian_targetUserId] = (int)$Silian_message->id;
                    }
                } catch (\Throwable $Silian_e) {
                    $Silian_failedUserIds[] = (int)$Silian_targetUserId;
                    if ($this->errorLogService) {
                        try {
                            $this->errorLogService->logException($Silian_e, $Silian_request);
                        } catch (\Throwable $Silian_ignore) {}
                    }
                }
            }

            $Silian_missingEmailUserIds = [];
            $Silian_emailRecipients = [];
            foreach ($Silian_targetUserIds as $Silian_recipientId) {
                $Silian_record = $Silian_targetUserRecords[$Silian_recipientId] ?? null;
                if ($Silian_record === null) {
                    continue;
                }
                $Silian_email = trim((string)($Silian_record['email'] ?? ''));
                if ($Silian_email === '') {
                    $Silian_missingEmailUserIds[] = (int)$Silian_recipientId;
                    continue;
                }
                $Silian_displayName = $Silian_record['username'] ?? null;
                if ($Silian_displayName === null || $Silian_displayName === '') {
                    $Silian_displayName = $Silian_email;
                }
                $Silian_emailRecipients[] = [
                    'user_id' => (int)$Silian_recipientId,
                    'email' => $Silian_email,
                    'name' => $Silian_displayName,
                ];
            }

            $Silian_allMessageIds = array_values(array_filter($Silian_createdMessageIds));
            $Silian_messageIdCount = count($Silian_allMessageIds);
            $Silian_messageIdSample = $Silian_messageIdCount > 200 ? array_slice($Silian_allMessageIds, 0, 200) : $Silian_allMessageIds;
            $Silian_messageMapSample = $Silian_messageIdCount > 200 ? array_slice($Silian_createdMessageIds, 0, 200, true) : $Silian_createdMessageIds;
            $Silian_contentHash = hash('sha256', $Silian_title . '||' . $Silian_content);

            $Silian_emailDelivery = [
                'triggered' => false,
                'attempted_recipients' => count($Silian_emailRecipients),
                'successful_chunks' => 0,
                'failed_chunks' => 0,
                'failed_recipient_ids' => [],
                'missing_email_user_ids' => $Silian_missingEmailUserIds,
                'status' => count($Silian_emailRecipients) > 0 ? 'queued' : 'skipped',
                'errors' => [],
                'completed_at' => null,
            ];
            if ($this->shouldSendPriorityEmail($Silian_priority) && !empty($Silian_emailRecipients)) {
                $Silian_queueResult = $this->messageService->queueBroadcastEmail(
                    $Silian_emailRecipients,
                    $Silian_title,
                    $Silian_content,
                    $Silian_priority,
                    [
                        'scope' => $Silian_scope,
                        'message_ids' => $Silian_messageIdSample,
                        'content_format' => $Silian_contentFormat,
                        'render_profile' => $Silian_renderProfile,
                        'render_version' => $Silian_renderVersion,
                        'source_kind' => $Silian_sourceKind,
                    ]
                );
                if (!empty($Silian_queueResult['queued'])) {
                    $Silian_emailDelivery['triggered'] = true;
                    $Silian_emailDelivery['status'] = 'queued';
                } elseif (!empty($Silian_queueResult['error'])) {
                    $Silian_normalizedError = trim((string) $Silian_queueResult['error']);
                    if ($Silian_normalizedError !== '') {
                        $Silian_emailDelivery['errors'][] = $Silian_normalizedError;
                        $Silian_loggedErrorMessages[$Silian_normalizedError] = true;
                    }
                    $Silian_emailDelivery['status'] = 'failed';
                    $Silian_errorId = $this->logBroadcastError($Silian_request, 'broadcast_email_queue_failed', [
                        'scope' => $Silian_scope,
                        'message' => $Silian_normalizedError,
                        'priority' => $Silian_priority,
                    ]);
                    if ($Silian_errorId) {
                        $Silian_errorLogIds[] = $Silian_errorId;
                    }
                } else {
                    $Silian_emailDelivery['status'] = 'skipped';
                }
            }

            if (!empty($Silian_emailDelivery['errors'])) {
                foreach ($Silian_emailDelivery['errors'] as $Silian_deliveryError) {
                    $Silian_normalized = trim((string) $Silian_deliveryError);
                    if ($Silian_normalized === '' || isset($Silian_loggedErrorMessages[$Silian_normalized])) {
                        continue;
                    }
                    $Silian_errorId = $this->logBroadcastError($Silian_request, $Silian_normalized, [
                        'scope' => $Silian_scope,
                        'priority' => $Silian_priority,
                    ]);
                    if ($Silian_errorId) {
                        $Silian_errorLogIds[] = $Silian_errorId;
                    }
                    $Silian_loggedErrorMessages[$Silian_normalized] = true;
                }
            }

            $Silian_emailDeliveryForLog = $this->trimEmailDeliveryForLog($Silian_emailDelivery);

$Silian_auditPayload = [
                'action' => 'system_message_broadcast',
                'operation_category' => 'admin_message',
                'user_id' => $Silian_user['id'],
                'actor_type' => 'admin',
                'affected_table' => 'messages',
                'change_type' => 'broadcast',
                'data' => [
                    'title' => $Silian_title,
                    'content' => $Silian_content,
                    'content_format' => $Silian_contentFormat,
                    'render_profile' => $Silian_renderProfile,
                    'render_version' => $Silian_renderVersion,
                    'source_kind' => $Silian_sourceKind,
                    'priority' => $Silian_priority,
                    'scope' => $Silian_scope,
                    'target_count' => count($Silian_targetUserIds),
                    'sent_count' => $Silian_sentCount,
                    'invalid_user_ids' => $Silian_invalidTargetIds,
                    'failed_user_ids' => $Silian_failedUserIds,
                    'message_ids' => $Silian_messageIdSample,
                    'message_id_count' => $Silian_messageIdCount,
                    'message_id_map' => $Silian_messageMapSample,
                    'content_hash' => $Silian_contentHash,
                    'email_delivery' => $Silian_emailDeliveryForLog,
                ],
            ];

            $this->auditLog->log($Silian_auditPayload);
            $Silian_auditLogId = method_exists($this->auditLog, 'getLastInsertId') ? $this->auditLog->getLastInsertId() : null;
            $Silian_requestId = $Silian_request->getAttribute('request_id') ?? $Silian_request->getHeaderLine('X-Request-ID') ?? ($Silian_request->getServerParams()['HTTP_X_REQUEST_ID'] ?? null);
            if (is_string($Silian_requestId)) {
                $Silian_requestId = trim($Silian_requestId);
                if ($Silian_requestId === '') {
                    $Silian_requestId = null;
                }
            } else {
                $Silian_requestId = null;
            }
            $Silian_systemLogId = $this->lookupSystemLogId($Silian_requestId);

            $Silian_cleanErrorLogIds = [];
            foreach ($Silian_errorLogIds as $Silian_candidateId) {
                $Silian_candidateId = (int) $Silian_candidateId;
                if ($Silian_candidateId > 0) {
                    $Silian_cleanErrorLogIds[$Silian_candidateId] = $Silian_candidateId;
                }
            }
            $Silian_cleanErrorLogIds = array_values($Silian_cleanErrorLogIds);

            $Silian_filtersSnapshot = ['scope' => $Silian_scope];
            if ($Silian_filterGroupsRaw !== null) {
                $Silian_filtersSnapshot['target_filters'] = $Silian_filterGroupsRaw;
            }
            if ($Silian_targetUsersRaw !== null) {
                $Silian_filtersSnapshot['explicit_targets'] = $Silian_targetUsersRaw;
            }
            if (empty($Silian_filtersSnapshot['target_filters']) && empty($Silian_filtersSnapshot['explicit_targets'])) {
                $Silian_filtersSnapshot = ['scope' => $Silian_scope];
            }
            if ($Silian_filtersSnapshot === ['scope' => $Silian_scope]) {
                $Silian_filtersSnapshot = null;
            }

            $Silian_metaSnapshot = [];
            $Silian_metaSnapshot['content_format'] = $Silian_contentFormat;
            $Silian_metaSnapshot['render_profile'] = $Silian_renderProfile;
            $Silian_metaSnapshot['render_version'] = $Silian_renderVersion;
            $Silian_metaSnapshot['source_kind'] = $Silian_sourceKind;

            if (!empty($Silian_targetUserRecords)) {
                $Silian_metaSnapshot['target_records_sample'] = array_slice(array_values($Silian_targetUserRecords), 0, 50);
            }
            if (!empty($Silian_loggedErrorMessages)) {
                $Silian_metaSnapshot['error_messages_logged'] = array_keys($Silian_loggedErrorMessages);
            }

            try {
                $Silian_insert = $this->db->prepare('INSERT INTO message_broadcasts (request_id, audit_log_id, system_log_id, error_log_ids, title, content, priority, scope, target_count, sent_count, invalid_user_ids, failed_user_ids, message_ids_snapshot, message_map_snapshot, message_id_count, content_hash, email_delivery_snapshot, filters_snapshot, meta, created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)');
                if ($Silian_insert) {
                    $Silian_insert->execute([
                        $Silian_requestId,
                        $Silian_auditLogId,
                        $Silian_systemLogId,
                        $this->encodeJson($Silian_cleanErrorLogIds),
                        $Silian_title,
                        $Silian_content,
                        $Silian_priority,
                        $Silian_scope,
                        count($Silian_targetUserIds),
                        $Silian_sentCount,
                        $this->encodeJson($Silian_invalidTargetIds),
                        $this->encodeJson($Silian_failedUserIds),
                        $this->encodeJson($Silian_messageIdSample),
                        $this->encodeJson($Silian_messageMapSample),
                        $Silian_messageIdCount,
                        $Silian_contentHash,
                        $this->encodeJson($Silian_emailDeliveryForLog),
                        $this->encodeJson($Silian_filtersSnapshot),
                        $this->encodeJson(!empty($Silian_metaSnapshot) ? $Silian_metaSnapshot : null),
                        $Silian_user['id'] ?? null,
                    ]);
                }
            } catch (\Throwable $Silian_persistError) {
                $this->logBroadcastError($Silian_request, 'broadcast_record_persist_failed', [
                    'message' => $Silian_persistError->getMessage(),
                ]);
            }

                        return $this->json($Silian_response, [
                'success' => true,
                'sent_count' => $Silian_sentCount,
                'total_targets' => count($Silian_targetUserIds),
                'failed_user_ids' => $Silian_failedUserIds,
                'invalid_user_ids' => $Silian_invalidTargetIds,
                'scope' => $Silian_scope,
                'message' => 'System message sent successfully',
                'priority' => $Silian_priority,
                'content_format' => $Silian_contentFormat,
                'render_profile' => $Silian_renderProfile,
                'render_version' => $Silian_renderVersion,
                'source_kind' => $Silian_sourceKind,
                'message_ids' => $Silian_messageIdSample,
                'message_id_count' => $Silian_messageIdCount,
                'email_delivery' => $Silian_emailDelivery,
                'error_log_ids' => $Silian_cleanErrorLogIds,
                'request_id' => $Silian_requestId,
            ]);
        } catch (\Exception $Silian_e) {
            try {
                if ($this->errorLogService) {
                    $this->errorLogService->logException($Silian_e, $Silian_request);
                }
            } catch (\Throwable $Silian_ignore) {}
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }


    /**
     * 获取消息类型统计
     */
    public function getMessageStats(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, ['error' => 'Unauthorized'], 401);
            }

            $Silian_overview = ['total' => 0, 'unread' => 0, 'read' => 0];
            $Silian_byType = [];
            $Silian_raw = [];

            // Try rich aggregation first (works with tests' PDO mock); fallback to simple counts
            try {
                $Silian_aggSql = "
                    SELECT
                        COALESCE(type,'unknown') AS type,
                        COALESCE(priority,'normal') AS priority,
                        COUNT(*) AS count,
                        SUM(CASE WHEN is_read = 0 THEN 1 ELSE 0 END) AS unread_count
                    FROM messages
                    WHERE receiver_id = :user_id AND deleted_at IS NULL
                    GROUP BY COALESCE(type,'unknown'), COALESCE(priority,'normal')
                ";
                $Silian_aggStmt = $this->db->prepare($Silian_aggSql);
                $Silian_aggStmt->execute(['user_id' => $Silian_user['id']]);
                $Silian_raw = $Silian_aggStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

                $Silian_total = 0; $Silian_unread = 0;
                foreach ($Silian_raw as $Silian_row) {
                    $Silian_t = $Silian_row['type'];
                    $Silian_p = $Silian_row['priority'];
                    $Silian_c = (int)$Silian_row['count'];
                    $Silian_u = (int)$Silian_row['unread_count'];
                    if (!isset($Silian_byType[$Silian_t])) {
                        $Silian_byType[$Silian_t] = ['total' => 0, 'unread' => 0, 'by_priority' => []];
                    }
                    $Silian_byType[$Silian_t]['total'] += $Silian_c;
                    $Silian_byType[$Silian_t]['unread'] += $Silian_u;
                    $Silian_byType[$Silian_t]['by_priority'][$Silian_p] = [
                        'total' => $Silian_c,
                        'unread' => $Silian_u
                    ];
                    $Silian_total += $Silian_c; $Silian_unread += $Silian_u;
                }
                $Silian_overview = [
                    'total' => $Silian_total,
                    'unread' => $Silian_unread,
                    'read' => max(0, $Silian_total - $Silian_unread)
                ];
            } catch (\Throwable $Silian_ignored) {
                // Fallback simple counts
                $Silian_simple = $this->db->prepare("SELECT COUNT(*) as total, COUNT(CASE WHEN is_read = 0 THEN 1 END) as unread FROM messages WHERE receiver_id = :user_id AND deleted_at IS NULL");
                $Silian_simple->execute(['user_id' => $Silian_user['id']]);
                $Silian_row = $Silian_simple->fetch(PDO::FETCH_ASSOC) ?: ['total' => 0, 'unread' => 0];
                $Silian_overview = [
                    'total' => (int)$Silian_row['total'],
                    'unread' => (int)$Silian_row['unread'],
                    'read' => max(0, (int)$Silian_row['total'] - (int)$Silian_row['unread'])
                ];
                $Silian_byType = [];
                $Silian_raw = [];
            }

            return $this->json($Silian_response, [
                'success' => true,
                'data' => [
                    'overview' => $Silian_overview,
                    'by_type' => $Silian_byType,
                    'raw_stats' => $Silian_raw
                ]
            ]);

        } catch (\Exception $Silian_e) {
            try { if ($this->errorLogService) { $this->errorLogService->logException($Silian_e, $Silian_request); } } catch (\Throwable $Silian_ignore) {}
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * 获取广播历史（管理员）
     */
        public function getBroadcastHistory(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->json($Silian_response, ['error' => 'Admin access required'], 403);
            }

            $Silian_params = $Silian_request->getQueryParams();
            $Silian_page = max(1, (int)($Silian_params['page'] ?? 1));
            $Silian_limit = min(50, max(5, (int)($Silian_params['limit'] ?? 10)));
            $Silian_offset = ($Silian_page - 1) * $Silian_limit;

            $Silian_total = 0;
            try {
                $Silian_countStmt = $this->db->query('SELECT COUNT(*) FROM message_broadcasts');
                if ($Silian_countStmt !== false) {
                    $Silian_total = (int) $Silian_countStmt->fetchColumn();
                }
            } catch (\Throwable $Silian_countError) {
                $Silian_total = 0;
            }

            $Silian_rows = [];
            try {
                $Silian_listStmt = $this->db->prepare('SELECT * FROM message_broadcasts ORDER BY id DESC LIMIT :limit OFFSET :offset');
                if ($Silian_listStmt) {
                    $Silian_listStmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
                    $Silian_listStmt->bindValue(':offset', $Silian_offset, PDO::PARAM_INT);
                    $Silian_listStmt->execute();
                    $Silian_rows = $Silian_listStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
                }
            } catch (\Throwable $Silian_listError) {
                $Silian_rows = [];
            }

            $Silian_actorIds = [];
            foreach ($Silian_rows as $Silian_row) {
                if (isset($Silian_row['created_by']) && $Silian_row['created_by'] !== null) {
                    $Silian_actorIds[] = (int) $Silian_row['created_by'];
                }
            }
            $Silian_actorMap = !empty($Silian_actorIds) ? $this->loadUsernames($Silian_actorIds) : [];

            $Silian_items = [];
            foreach ($Silian_rows as $Silian_row) {
                $Silian_broadcastId = (int)($Silian_row['id'] ?? 0);
                $Silian_createdBy = isset($Silian_row['created_by']) ? (int)$Silian_row['created_by'] : null;
                $Silian_title = (string)($Silian_row['title'] ?? '');
                $Silian_content = (string)($Silian_row['content'] ?? '');
                $Silian_priority = (string)($Silian_row['priority'] ?? Message::PRIORITY_NORMAL);
                if (!in_array($Silian_priority, Message::getValidPriorities(), true)) {
                    $Silian_priority = Message::PRIORITY_NORMAL;
                }
                $Silian_scope = (string)($Silian_row['scope'] ?? 'all');
                $Silian_targetCount = (int)($Silian_row['target_count'] ?? 0);
                $Silian_sentCount = (int)($Silian_row['sent_count'] ?? 0);
                $Silian_invalidIds = $this->decodeIdList($Silian_row['invalid_user_ids'] ?? []);
                $Silian_failedIds = $this->decodeIdList($Silian_row['failed_user_ids'] ?? []);
                $Silian_messageIds = $this->decodeIdList($Silian_row['message_ids_snapshot'] ?? []);
                $Silian_messageIdCount = isset($Silian_row['message_id_count']) ? (int)$Silian_row['message_id_count'] : (count($Silian_messageIds) ?: null);
                $Silian_messageIdMap = $this->decodeJsonObject($Silian_row['message_map_snapshot'] ?? null);
                $Silian_emailDelivery = $this->normalizeEmailDeliveryMeta($this->decodeJsonValue($Silian_row['email_delivery_snapshot'] ?? null));
                $Silian_meta = $this->decodeJsonObject($Silian_row['meta'] ?? null);
                $Silian_contentFormat = $this->normalizeBroadcastContentFormat($Silian_meta['content_format'] ?? self::BROADCAST_CONTENT_FORMAT_TEXT)
                    ?? self::BROADCAST_CONTENT_FORMAT_TEXT;
                $Silian_renderProfile = $this->normalizeBroadcastRenderProfile($Silian_meta['render_profile'] ?? null, $Silian_contentFormat);
                $Silian_renderVersion = $this->normalizeBroadcastRenderVersion($Silian_meta['render_version'] ?? null, $Silian_contentFormat, $Silian_renderProfile);
                $Silian_sourceKind = $this->normalizeBroadcastSourceKind($Silian_meta['source_kind'] ?? null);
                $Silian_errorIds = $this->decodeIdList($Silian_row['error_log_ids'] ?? []);
                $Silian_requestId = isset($Silian_row['request_id']) ? trim((string)$Silian_row['request_id']) : null;
                if ($Silian_requestId === '') {
                    $Silian_requestId = null;
                }
                $Silian_createdAtRaw = $Silian_row['created_at'] ?? date('Y-m-d H:i:s');
                $Silian_startTime = is_string($Silian_createdAtRaw) ? $Silian_createdAtRaw : date('Y-m-d H:i:s');
                if ($Silian_createdAtRaw instanceof \DateTimeInterface) {
                    $Silian_startTime = $Silian_createdAtRaw->format('Y-m-d H:i:s');
                }
                $Silian_endTime = date('Y-m-d H:i:s', strtotime($Silian_startTime . ' +60 minutes'));
                $Silian_recipients = $this->loadBroadcastRecipients($Silian_title, $Silian_startTime, $Silian_endTime, $Silian_messageIds, $Silian_row['content_hash'] ?? null, true);

                $Silian_readUsers = [];
                $Silian_unreadUsers = [];
                foreach ($Silian_recipients as $Silian_recipient) {
                    $Silian_recipientUuid = isset($Silian_recipient['uuid']) ? strtolower(trim((string)$Silian_recipient['uuid'])) : null;
                    if ($Silian_recipientUuid === '') {
                        $Silian_recipientUuid = null;
                    }
                    $Silian_entry = [
                        'user_id' => $Silian_recipientUuid,
                        'uuid' => $Silian_recipientUuid,
                        'legacy_user_id' => isset($Silian_recipient['receiver_id']) ? (int)$Silian_recipient['receiver_id'] : null,
                        'username' => $Silian_recipient['username'] ?? null,
                        'email' => $Silian_recipient['email'] ?? null,
                        'status' => $Silian_recipient['status'] ?? null,
                        'is_admin' => isset($Silian_recipient['is_admin']) ? (bool)$Silian_recipient['is_admin'] : null,
                        'message_id' => isset($Silian_recipient['id']) ? (int)$Silian_recipient['id'] : null,
                        'read' => (bool)($Silian_recipient['is_read'] ?? false),
                    ];
                    if ($Silian_entry['read']) {
                        $Silian_readUsers[] = $Silian_entry;
                    } else {
                        $Silian_unreadUsers[] = $Silian_entry;
                    }
                }

                $Silian_items[] = [
                    'id' => $Silian_broadcastId,
                    'actor_user_id' => $Silian_createdBy,
                    'actor_username' => ($Silian_createdBy !== null && isset($Silian_actorMap[$Silian_createdBy])) ? $Silian_actorMap[$Silian_createdBy] : null,
                    'title' => $Silian_title,
                    'content' => $Silian_content,
                    'content_format' => $Silian_contentFormat,
                    'render_profile' => $Silian_renderProfile,
                    'render_version' => $Silian_renderVersion,
                    'source_kind' => $Silian_sourceKind,
                    'priority' => $Silian_priority,
                    'scope' => $Silian_scope,
                    'target_count' => $Silian_targetCount,
                    'sent_count' => $Silian_sentCount,
                    'read_count' => count($Silian_readUsers),
                    'unread_count' => count($Silian_unreadUsers),
                    'invalid_user_ids' => $Silian_invalidIds,
                    'failed_user_ids' => $Silian_failedIds,
                    'read_users' => $Silian_readUsers,
                    'unread_users' => $Silian_unreadUsers,
                    'created_at' => $Silian_startTime,
                    'message_id_count' => $Silian_messageIdCount ?? count($Silian_recipients),
                    'message_ids' => $Silian_messageIds,
                    'message_id_map' => $Silian_messageIdMap,
                    'email_delivery' => $Silian_emailDelivery,
                    'request_id' => $Silian_requestId,
                    'audit_log_id' => isset($Silian_row['audit_log_id']) ? (int)$Silian_row['audit_log_id'] : null,
                    'system_log_id' => isset($Silian_row['system_log_id']) ? (int)$Silian_row['system_log_id'] : null,
                    'error_log_ids' => $Silian_errorIds,
                ];
            }

            return $this->json($Silian_response, [
                'success' => true,
                'data' => $Silian_items,
                'pagination' => [
                    'page' => $Silian_page,
                    'limit' => $Silian_limit,
                    'total' => $Silian_total,
                    'pages' => (int) max(1, ceil($Silian_total / max(1, $Silian_limit))),
                ],
            ]);
        } catch (\Throwable $Silian_e) {
            try {
                if ($this->errorLogService) {
                    $this->errorLogService->logException($Silian_e, $Silian_request);
                }
            } catch (\Throwable $Silian_ignore) {}
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * 刷新广播邮件队列并尝试发送（仅限管理员）。
     */
    public function flushBroadcastEmailQueue(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->json($Silian_response, ['error' => 'Admin access required'], 403);
            }

            $Silian_query = $Silian_request->getQueryParams();
            $Silian_body = $Silian_request->getParsedBody();
            $Silian_params = [];
            if (is_array($Silian_query)) {
                $Silian_params = array_merge($Silian_params, $Silian_query);
            }
            if (is_array($Silian_body)) {
                $Silian_params = array_merge($Silian_params, $Silian_body);
            }

            $Silian_limit = isset($Silian_params['limit']) ? (int)$Silian_params['limit'] : 10;
            $Silian_limit = max(1, min(50, $Silian_limit));

            $Silian_forceSend = false;
            if (isset($Silian_params['force'])) {
                $Silian_rawForce = $Silian_params['force'];
                if (is_bool($Silian_rawForce)) {
                    $Silian_forceSend = $Silian_rawForce;
                } elseif (is_numeric($Silian_rawForce)) {
                    $Silian_forceSend = ((int)$Silian_rawForce) !== 0;
                } elseif (is_string($Silian_rawForce)) {
                    $Silian_normalized = strtolower(trim($Silian_rawForce));
                    $Silian_forceSend = in_array($Silian_normalized, ['1', 'true', 'yes', 'on'], true);
                }
            }

            if ($Silian_forceSend && $this->emailService === null) {
                return $this->json($Silian_response, [
                    'error' => 'Email service unavailable, cannot force send queued broadcasts',
                ], 503);
            }

            $Silian_fetchLimit = max($Silian_limit * 3, $Silian_limit);
            $Silian_stmt = $this->db->prepare('SELECT * FROM message_broadcasts ORDER BY created_at ASC LIMIT :limit');
            if (!$Silian_stmt) {
                return $this->json($Silian_response, ['error' => 'Failed to inspect broadcast queue'], 500);
            }
            $Silian_stmt->bindValue(':limit', $Silian_fetchLimit, PDO::PARAM_INT);
            $Silian_stmt->execute();
            $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $Silian_processed = [];
            $Silian_skipped = [];
            $Silian_now = date('Y-m-d H:i:s');

            foreach ($Silian_rows as $Silian_row) {
                if (count($Silian_processed) >= $Silian_limit) {
                    break;
                }

                $Silian_broadcastId = isset($Silian_row['id']) ? (int)$Silian_row['id'] : 0;
                if ($Silian_broadcastId <= 0) {
                    continue;
                }

                $Silian_delivery = $this->normalizeEmailDeliveryMeta($Silian_row['email_delivery_snapshot'] ?? null);
                if (!in_array($Silian_delivery['status'], ['queued', 'partial'], true)) {
                    $Silian_skipped[] = $Silian_broadcastId;
                    continue;
                }

                if ($Silian_delivery['completed_at'] !== null && !$Silian_forceSend) {
                    $Silian_skipped[] = $Silian_broadcastId;
                    continue;
                }

                $Silian_createdAtRaw = $Silian_row['created_at'] ?? $Silian_now;
                if ($Silian_createdAtRaw instanceof \DateTimeInterface) {
                    $Silian_startTime = $Silian_createdAtRaw->format('Y-m-d H:i:s');
                } else {
                    $Silian_startTime = is_string($Silian_createdAtRaw) && $Silian_createdAtRaw !== '' ? $Silian_createdAtRaw : $Silian_now;
                }
                $Silian_endTime = date('Y-m-d H:i:s', strtotime($Silian_startTime . ' +90 minutes'));

                $Silian_messageIds = $this->decodeIdList($Silian_row['message_ids_snapshot'] ?? []);
                $Silian_contentHash = isset($Silian_row['content_hash']) && is_string($Silian_row['content_hash']) ? $Silian_row['content_hash'] : null;
                $Silian_recipients = $this->loadBroadcastRecipients(
                    (string)($Silian_row['title'] ?? ''),
                    $Silian_startTime,
                    $Silian_endTime,
                    $Silian_messageIds,
                    $Silian_contentHash,
                    false
                );

                $Silian_deliverable = [];
                $Silian_missingEmailUserIds = [];
                foreach ($Silian_recipients as $Silian_recipient) {
                    $Silian_receiverId = isset($Silian_recipient['receiver_id']) ? (int)$Silian_recipient['receiver_id'] : 0;
                    if ($Silian_receiverId <= 0) {
                        continue;
                    }
                    if (isset($Silian_deliverable[$Silian_receiverId]) || in_array($Silian_receiverId, $Silian_missingEmailUserIds, true)) {
                        continue;
                    }
                    $Silian_email = trim((string)($Silian_recipient['email'] ?? ''));
                    if ($Silian_email === '') {
                        $Silian_missingEmailUserIds[] = $Silian_receiverId;
                        continue;
                    }
                    $Silian_name = (string)($Silian_recipient['username'] ?? '');
                    if ($Silian_name === '') {
                        $Silian_name = $Silian_email;
                    }
                    $Silian_deliverable[$Silian_receiverId] = [
                        'email' => $Silian_email,
                        'name' => $Silian_name,
                    ];
                }

                $Silian_deliverableList = array_values($Silian_deliverable);
                $Silian_attempted = count($Silian_deliverableList);
                $Silian_meta = $this->decodeJsonObject($Silian_row['meta'] ?? null);
                $Silian_contentFormat = $this->normalizeBroadcastContentFormat($Silian_meta['content_format'] ?? self::BROADCAST_CONTENT_FORMAT_TEXT)
                    ?? self::BROADCAST_CONTENT_FORMAT_TEXT;
                $Silian_renderProfile = $this->normalizeBroadcastRenderProfile($Silian_meta['render_profile'] ?? null, $Silian_contentFormat);
                $Silian_renderVersion = $this->normalizeBroadcastRenderVersion($Silian_meta['render_version'] ?? null, $Silian_contentFormat, $Silian_renderProfile);
                $Silian_sourceKind = $this->normalizeBroadcastSourceKind($Silian_meta['source_kind'] ?? null);

                $Silian_status = $Silian_delivery['status'];
                $Silian_errors = $Silian_delivery['errors'];
                $Silian_failedChunks = $Silian_delivery['failed_chunks'];
                $Silian_successfulChunks = $Silian_delivery['successful_chunks'];
                $Silian_failedRecipientIds = $Silian_delivery['failed_recipient_ids'];

                $Silian_sendResult = true;
                if ($Silian_forceSend && $Silian_attempted > 0 && $this->emailService) {
                    $Silian_payload = [];
                    foreach ($Silian_deliverableList as $Silian_entry) {
                        $Silian_payload[] = [
                            'email' => $Silian_entry['email'],
                            'name' => $Silian_entry['name'],
                        ];
                    }

                    $Silian_sendResult = $this->emailService->sendAnnouncementBroadcast(
                        $Silian_payload,
                        (string)($Silian_row['title'] ?? ''),
                        (string)($Silian_row['content'] ?? ''),
                        (string)($Silian_row['priority'] ?? Message::PRIORITY_NORMAL),
                        $Silian_contentFormat,
                        $Silian_renderProfile,
                        $Silian_renderVersion,
                        $Silian_sourceKind
                    );

                    if ($Silian_sendResult) {
                        $Silian_status = empty($Silian_missingEmailUserIds) ? 'sent' : 'partial';
                        $Silian_successfulChunks = max(1, $Silian_successfulChunks);
                        $Silian_failedChunks = 0;
                        $Silian_failedRecipientIds = [];
                    } else {
                        $Silian_status = 'failed';
                        $Silian_failedChunks = max(1, $Silian_failedChunks);
                        $Silian_successfulChunks = max(0, $Silian_successfulChunks);
                        $Silian_failedRecipientIds = array_keys($Silian_deliverable);
                        $Silian_errorMessage = $this->emailService->getLastError() ?? 'Broadcast email dispatch failed';
                        if ($Silian_errorMessage !== '' && !in_array($Silian_errorMessage, $Silian_errors, true)) {
                            $Silian_errors[] = $Silian_errorMessage;
                        }
                    }
                } else {
                    if ($Silian_attempted > 0) {
                        $Silian_status = empty($Silian_missingEmailUserIds) ? 'sent' : 'partial';
                        $Silian_successfulChunks = max(1, $Silian_successfulChunks);
                        $Silian_failedChunks = 0;
                        $Silian_failedRecipientIds = [];
                    } else {
                        $Silian_status = 'skipped';
                    }
                }

                $Silian_updatedDelivery = [
                    'triggered' => true,
                    'attempted_recipients' => $Silian_attempted,
                    'successful_chunks' => $Silian_successfulChunks,
                    'failed_chunks' => $Silian_failedChunks,
                    'failed_recipient_ids' => array_values(array_unique($Silian_failedRecipientIds)),
                    'missing_email_user_ids' => array_values(array_unique(array_merge(
                        $Silian_delivery['missing_email_user_ids'] ?? [],
                        $Silian_missingEmailUserIds
                    ))),
                    'status' => $Silian_status,
                    'errors' => array_values(array_unique($Silian_errors)),
                    'completed_at' => $Silian_now,
                ];

                $Silian_update = $this->db->prepare('UPDATE message_broadcasts SET email_delivery_snapshot = :snapshot, updated_at = NOW() WHERE id = :id');
                if ($Silian_update) {
                    $Silian_update->execute([
                        ':snapshot' => $this->encodeJson($Silian_updatedDelivery),
                        ':id' => $Silian_broadcastId,
                    ]);
                }

                $Silian_processed[] = [
                    'id' => $Silian_broadcastId,
                    'status' => $Silian_status,
                    'attempted' => $Silian_attempted,
                    'force' => $Silian_forceSend,
                    'missing_email_user_ids' => $Silian_missingEmailUserIds,
                    'errors' => $Silian_updatedDelivery['errors'],
                ];
            }

            if (!empty($Silian_processed)) {
                $Silian_auditPayload = [
                    'action' => 'broadcast_email_flush',
                    'operation_category' => 'admin_message',
                    'user_id' => $Silian_user['id'],
                    'actor_type' => 'admin',
                    'change_type' => 'update',
                    'data' => [
                        'requested_limit' => $Silian_limit,
                        'force_send' => $Silian_forceSend,
                        'processed_ids' => array_column($Silian_processed, 'id'),
                        'skipped_ids' => $Silian_skipped,
                    ],
                ];
                $this->auditLog->log($Silian_auditPayload);
            }

            return $this->json($Silian_response, [
                'success' => true,
                'processed' => $Silian_processed,
                'skipped' => $Silian_skipped,
                'count' => count($Silian_processed),
            ]);
        } catch (\Throwable $Silian_e) {
            try {
                if ($this->errorLogService) {
                    $this->errorLogService->logException($Silian_e, $Silian_request, ['context' => 'flushBroadcastEmailQueue']);
                }
            } catch (\Throwable $Silian_ignore) {}
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    private function logBroadcastError(Request $Silian_request, string $Silian_message, array $Silian_context = []): ?int
    {
        if (!$this->errorLogService) {
            return null;
        }
        try {
            $Silian_payload = array_merge([
                'controller' => 'MessageController',
                'action' => 'sendSystemMessage',
            ], $Silian_context);
            return $this->errorLogService->logError('broadcast_error', $Silian_message, $Silian_request, $Silian_payload);
        } catch (\Throwable $Silian_e) {
            return null;
        }
    }

    private function lookupSystemLogId(?string $Silian_requestId): ?int
    {
        if ($Silian_requestId === null || $Silian_requestId === '') {
            return null;
        }
        try {
            $Silian_stmt = $this->db->prepare('SELECT id FROM system_logs WHERE request_id = :request_id ORDER BY id DESC LIMIT 1');
            if ($Silian_stmt && $Silian_stmt->execute(['request_id' => $Silian_requestId])) {
                $Silian_value = $Silian_stmt->fetchColumn();
                if ($Silian_value !== false) {
                    $Silian_id = (int) $Silian_value;
                    return $Silian_id > 0 ? $Silian_id : null;
                }
            }
        } catch (\Throwable $Silian_ignored) {
        }
        return null;
    }

    private function encodeJson($Silian_value): ?string
    {
        if ($Silian_value === null) {
            return null;
        }
        try {
            $Silian_encoded = json_encode($Silian_value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
            return $Silian_encoded === false ? null : $Silian_encoded;
        } catch (\Throwable $Silian_e) {
            return null;
        }
    }

    private function decodeJsonValue($Silian_value)
    {
        if (is_array($Silian_value)) {
            return $Silian_value;
        }
        if (is_string($Silian_value) && $Silian_value !== '') {
            $Silian_decoded = json_decode($Silian_value, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                return $Silian_decoded;
            }
        }
        return [];
    }

    private function decodeJsonObject($Silian_value): array
    {
        $Silian_decoded = $this->decodeJsonValue($Silian_value);
        return is_array($Silian_decoded) ? $Silian_decoded : [];
    }

    private function decodeAuditData(?string $Silian_raw): array
    {
        if ($Silian_raw === null || $Silian_raw === '') {
            return [];
        }
        $Silian_decoded = json_decode($Silian_raw, true);
        return is_array($Silian_decoded) ? $Silian_decoded : [];
    }

    private function decodeIdList($Silian_value): array
    {
        if (is_array($Silian_value)) {
            return array_values(array_map('intval', $Silian_value));
        }
        if (is_string($Silian_value) && $Silian_value !== '') {
            $Silian_decoded = json_decode($Silian_value, true);
            if (is_array($Silian_decoded)) {
                return array_values(array_map('intval', $Silian_decoded));
            }
            $Silian_parts = preg_split('/[\s,]+/', $Silian_value);
            if ($Silian_parts) {
                $Silian_clean = [];
                foreach ($Silian_parts as $Silian_part) {
                    $Silian_num = (int)$Silian_part;
                    if ($Silian_num > 0) {
                        $Silian_clean[] = $Silian_num;
                    }
                }
                if ($Silian_clean) {
                    return $Silian_clean;
                }
            }
        }
        return [];
    }

    private function loadBroadcastRecipients(
        string $Silian_title,
        string $Silian_start,
        string $Silian_end,
        array $Silian_messageIds = [],
        ?string $Silian_contentHash = null,
        bool $Silian_includeUserContext = true
    ): array
    {
        try {
            $Silian_userColumns = $Silian_includeUserContext
                ? 'u.uuid, u.username, u.email, u.status, u.is_admin'
                : 'u.username, u.email';
            $Silian_ids = array_values(array_filter(array_map('intval', $Silian_messageIds), static fn(int $Silian_value): bool => $Silian_value > 0));
            if (!empty($Silian_ids)) {
                $Silian_placeholders = implode(',', array_fill(0, count($Silian_ids), '?'));
                $Silian_sql = 'SELECT m.id, m.receiver_id, m.is_read, ' . $Silian_userColumns . ' FROM messages m LEFT JOIN users u ON u.id = m.receiver_id WHERE m.deleted_at IS NULL AND m.id IN (' . $Silian_placeholders . ')';
                $Silian_stmt = $this->db->prepare($Silian_sql);
                if (!$Silian_stmt) {
                    return [];
                }
                foreach ($Silian_ids as $Silian_index => $Silian_id) {
                    $Silian_stmt->bindValue($Silian_index + 1, $Silian_id, PDO::PARAM_INT);
                }
                $Silian_stmt->execute();
                return $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            }

            $Silian_sql = 'SELECT m.id, m.receiver_id, m.is_read, ' . $Silian_userColumns . ' FROM messages m LEFT JOIN users u ON u.id = m.receiver_id WHERE m.deleted_at IS NULL AND m.title = :title AND m.created_at >= :start AND m.created_at <= :end';
            $Silian_stmt = $this->db->prepare($Silian_sql);
            if (!$Silian_stmt) {
                return [];
            }
            $Silian_stmt->bindValue(':title', $Silian_title);
            $Silian_stmt->bindValue(':start', $Silian_start);
            $Silian_stmt->bindValue(':end', $Silian_end);
            $Silian_stmt->execute();
            $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            if ($Silian_contentHash !== null && $Silian_contentHash !== '' && !empty($Silian_rows)) {
                $Silian_filtered = [];
                $Silian_contentStmt = $this->db->prepare('SELECT content FROM messages WHERE id = :id');
                foreach ($Silian_rows as $Silian_row) {
                    $Silian_messageId = isset($Silian_row['id']) ? (int)$Silian_row['id'] : 0;
                    if ($Silian_messageId <= 0) {
                        continue;
                    }
                    try {
                        if (!$Silian_contentStmt) {
                            $Silian_filtered = $Silian_rows;
                            break;
                        }
                        $Silian_contentStmt->bindValue(':id', $Silian_messageId, PDO::PARAM_INT);
                        $Silian_contentStmt->execute();
                        $Silian_contentRow = $Silian_contentStmt->fetch(PDO::FETCH_ASSOC);
                        $Silian_contentStmt->closeCursor();
                        $Silian_contentValue = is_array($Silian_contentRow) ? (string)($Silian_contentRow['content'] ?? '') : '';
                        if (hash('sha256', $Silian_title . '||' . $Silian_contentValue) === $Silian_contentHash) {
                            $Silian_filtered[] = $Silian_row;
                        }
                    } catch (\Throwable $Silian_e) {
                        $Silian_filtered = $Silian_rows;
                        break;
                    }
                }
                if (!empty($Silian_filtered)) {
                    return $Silian_filtered;
                }
            }

            return $Silian_rows;
        } catch (\Throwable $Silian_e) {
            return [];
        }
    }

    /**
     * 搜索广播收件人（管理员）
     */
    public function searchBroadcastRecipients(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->json($Silian_response, ['error' => 'Admin access required'], 403);
            }

            $Silian_params = $Silian_request->getQueryParams();
            $Silian_page = max(1, (int)($Silian_params['page'] ?? 1));
            $Silian_limit = min(200, max(1, (int)($Silian_params['limit'] ?? 50)));
            $Silian_offset = ($Silian_page - 1) * $Silian_limit;

            $Silian_criteria = $Silian_params;
            if (isset($Silian_params['ids'])) {
                $Silian_criteria['include_ids'] = $this->sanitizeIdList(is_array($Silian_params['ids']) ? $Silian_params['ids'] : explode(',', (string)$Silian_params['ids']));
            }
            if (isset($Silian_params['exclude_ids'])) {
                $Silian_criteria['exclude_ids'] = $this->sanitizeIdList(is_array($Silian_params['exclude_ids']) ? $Silian_params['exclude_ids'] : explode(',', (string)$Silian_params['exclude_ids']));
            }

            $Silian_rows = $this->performUserSearch($Silian_criteria, $Silian_limit + 1, $Silian_offset);
            $Silian_hasMore = count($Silian_rows) > $Silian_limit;
            if ($Silian_hasMore) {
                $Silian_rows = array_slice($Silian_rows, 0, $Silian_limit);
            }

            $Silian_data = [];
            foreach ($Silian_rows as $Silian_row) {
                $Silian_normalized = $this->normalizeUserRow($Silian_row);
                if ($Silian_normalized['id'] === null) {
                    continue;
                }
                $Silian_data[] = $Silian_normalized;
            }

            return $this->json($Silian_response, [
                'success' => true,
                'data' => $Silian_data,
                'pagination' => [
                    'page' => $Silian_page,
                    'limit' => $Silian_limit,
                    'has_more' => $Silian_hasMore,
                ],
            ]);
        } catch (\Throwable $Silian_e) {
            try {
                if ($this->errorLogService) {
                    $this->errorLogService->logException($Silian_e, $Silian_request);
                }
            } catch (\Throwable $Silian_ignore) {}
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    private function resolveExplicitRecipients(array $Silian_ids): array
    {
        $Silian_result = [
            'error' => null,
            'status' => 200,
            'user_ids' => [],
            'records' => [],
            'invalid_ids' => [],
        ];

        $Silian_sanitized = [];
        foreach ($Silian_ids as $Silian_value) {
            if (is_int($Silian_value) || (is_numeric($Silian_value) && (string)(int)$Silian_value === (string)$Silian_value)) {
                $Silian_intVal = (int)$Silian_value;
                if ($Silian_intVal > 0) {
                    $Silian_sanitized[$Silian_intVal] = $Silian_intVal;
                }
            }
        }

        if (empty($Silian_sanitized)) {
            $Silian_result['error'] = 'target_users must contain at least one valid id';
            $Silian_result['status'] = 400;
            return $Silian_result;
        }

        $Silian_placeholders = implode(',', array_fill(0, count($Silian_sanitized), '?'));
        $Silian_sql = 'SELECT u.id, u.username, u.email, u.school_id, u.region_code, u.is_admin, u.status, s.name AS school_name FROM users u LEFT JOIN schools s ON s.id = u.school_id WHERE u.deleted_at IS NULL AND u.id IN (' . $Silian_placeholders . ')';

        try {
            $Silian_stmt = $this->db->prepare($Silian_sql);
            if (!$Silian_stmt) {
                $Silian_result['error'] = 'Failed to resolve target users';
                $Silian_result['status'] = 500;
                return $Silian_result;
            }

            $Silian_stmt->execute(array_values($Silian_sanitized));
            $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $Silian_collectedIds = [];
            foreach ($Silian_rows as $Silian_row) {
                if (is_array($Silian_row)) {
                    $Silian_id = isset($Silian_row['id']) ? (int)$Silian_row['id'] : 0;
                    if ($Silian_id <= 0) {
                        continue;
                    }
                    $Silian_collectedIds[$Silian_id] = $Silian_id;
                    $Silian_result['records'][$Silian_id] = $this->normalizeUserRow($Silian_row);
                } elseif (is_scalar($Silian_row)) {
                    $Silian_id = (int)$Silian_row;
                    if ($Silian_id <= 0) {
                        continue;
                    }
                    $Silian_collectedIds[$Silian_id] = $Silian_id;
                    if (!isset($Silian_result['records'][$Silian_id])) {
                        $Silian_result['records'][$Silian_id] = $this->normalizeUserRow(['id' => $Silian_id]);
                    }
                }
            }

            $Silian_result['user_ids'] = array_values($Silian_collectedIds);
            $Silian_result['invalid_ids'] = array_values(array_diff($Silian_sanitized, $Silian_result['user_ids']));
        } catch (\Throwable $Silian_e) {
            $Silian_result['error'] = 'Failed to resolve target users';
            $Silian_result['status'] = 500;
        }

        return $Silian_result;
    }

    private function resolveFilteredRecipients(array $Silian_filterGroups): array
    {
        $Silian_aggregated = [
            'user_ids' => [],
            'records' => [],
        ];

        foreach ($Silian_filterGroups as $Silian_filterGroup) {
            if (!is_array($Silian_filterGroup)) {
                continue;
            }
            $Silian_limit = (int)($Silian_filterGroup['limit'] ?? 250);
            $Silian_limit = max(10, min(500, $Silian_limit));
            $Silian_offset = max(0, (int)($Silian_filterGroup['offset'] ?? 0));

            $Silian_searchResult = $this->performUserSearch($Silian_filterGroup, $Silian_limit, $Silian_offset);
            foreach ($Silian_searchResult as $Silian_row) {
                $Silian_id = isset($Silian_row['id']) ? (int)$Silian_row['id'] : 0;
                if ($Silian_id <= 0) {
                    continue;
                }
                $Silian_aggregated['user_ids'][$Silian_id] = $Silian_id;
                $Silian_aggregated['records'][$Silian_id] = $this->normalizeUserRow($Silian_row);
            }
        }

        $Silian_aggregated['user_ids'] = array_values($Silian_aggregated['user_ids']);

        return $Silian_aggregated;
    }

    private function resolveAllRecipients(): array
    {
        $Silian_result = [
            'user_ids' => [],
            'records' => [],
        ];

        try {
            $Silian_sql = 'SELECT u.id, u.username, u.email, u.school_id, u.region_code, u.is_admin, u.status, s.name AS school_name FROM users u LEFT JOIN schools s ON s.id = u.school_id WHERE u.deleted_at IS NULL';
            $Silian_stmt = $this->db->query($Silian_sql);
            if (!$Silian_stmt) {
                return $Silian_result;
            }
            $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            foreach ($Silian_rows as $Silian_row) {
                $Silian_id = isset($Silian_row['id']) ? (int)$Silian_row['id'] : 0;
                if ($Silian_id <= 0) {
                    continue;
                }
                $Silian_result['user_ids'][] = $Silian_id;
                $Silian_result['records'][$Silian_id] = $this->normalizeUserRow($Silian_row);
            }
        } catch (\Throwable $Silian_e) {
            // Swallow exception and return what we have
        }

        return $Silian_result;
    }

    private function performUserSearch(array $Silian_criteria, int $Silian_limit, int $Silian_offset = 0): array
    {
        $Silian_where = ['u.deleted_at IS NULL'];
        $Silian_params = [];

        $Silian_search = trim((string)($Silian_criteria['search'] ?? $Silian_criteria['q'] ?? ''));
        $Silian_fieldsRaw = $Silian_criteria['fields'] ?? null;
        $Silian_fields = [];
        if (is_string($Silian_fieldsRaw)) {
            $Silian_fields = array_filter(array_map('trim', explode(',', $Silian_fieldsRaw)));
        } elseif (is_array($Silian_fieldsRaw)) {
            foreach ($Silian_fieldsRaw as $Silian_candidate) {
                if (is_string($Silian_candidate) && $Silian_candidate !== '') {
                    $Silian_fields[] = trim($Silian_candidate);
                }
            }
        }
        if (empty($Silian_fields)) {
            $Silian_fields = ['username', 'email', 'uuid', 'school', 'location', 'school_name'];
        }

        $Silian_fieldMap = [
            'username' => 'u.username',
            'email' => 'u.email',
            'uuid' => 'u.uuid',
            'school' => 's.name',
            'location' => 'u.region_code',
            'school_name' => 's.name',
            'status' => 'u.status',
            'role' => 'u.role',
        ];

        if ($Silian_search !== '') {
            $Silian_searchParts = [];
            $Silian_searchPattern = '%' . $Silian_search . '%';
            $Silian_searchIndex = 0;
            foreach ($Silian_fields as $Silian_field) {
                $Silian_placeholder = 'search_' . $Silian_searchIndex++;
                if ($Silian_field === 'id') {
                    $Silian_searchParts[] = 'CAST(u.id AS CHAR) LIKE :' . $Silian_placeholder;
                    $Silian_params[$Silian_placeholder] = $Silian_searchPattern;
                    continue;
                }
                if ($Silian_field === 'school') {
                    $Silian_searchParts[] = 's.name LIKE :' . $Silian_placeholder;
                    $Silian_params[$Silian_placeholder] = $Silian_searchPattern;
                    continue;
                }
                if ($Silian_field === 'location') {
                    $Silian_searchParts[] = 'u.region_code LIKE :' . $Silian_placeholder;
                    $Silian_params[$Silian_placeholder] = $Silian_searchPattern;
                    continue;
                }
                if (!isset($Silian_fieldMap[$Silian_field])) {
                    continue;
                }
                $Silian_searchParts[] = $Silian_fieldMap[$Silian_field] . ' LIKE :' . $Silian_placeholder;
                $Silian_params[$Silian_placeholder] = $Silian_searchPattern;
            }
            if (!empty($Silian_searchParts)) {
                $Silian_where[] = '(' . implode(' OR ', $Silian_searchParts) . ')';
            }
        }

        if (!empty($Silian_criteria['school_id'])) {
            $Silian_where[] = 'u.school_id = :school_id';
            $Silian_params['school_id'] = (int)$Silian_criteria['school_id'];
        }

        if (!empty($Silian_criteria['school'])) {
            $Silian_where[] = 's.name LIKE :school_exact';
            $Silian_params['school_exact'] = '%' . trim((string)$Silian_criteria['school']) . '%';
        }

        if (!empty($Silian_criteria['email_suffix'])) {
            $Silian_suffix = ltrim(trim((string)$Silian_criteria['email_suffix']), '@');
            $Silian_where[] = 'u.email LIKE :email_suffix';
            $Silian_params['email_suffix'] = '%@' . $Silian_suffix;
        } elseif (!empty($Silian_criteria['email_domain'])) {
            $Silian_suffix = ltrim(trim((string)$Silian_criteria['email_domain']), '@');
            $Silian_where[] = 'u.email LIKE :email_suffix';
            $Silian_params['email_suffix'] = '%@' . $Silian_suffix;
        }

        if (array_key_exists('status', $Silian_criteria) && $Silian_criteria['status'] !== null && $Silian_criteria['status'] !== '') {
            $Silian_where[] = 'u.status = :status';
            $Silian_params['status'] = trim((string)$Silian_criteria['status']);
        }

        if (array_key_exists('is_admin', $Silian_criteria)) {
            $Silian_value = $Silian_criteria['is_admin'];
            if ($Silian_value === '1' || $Silian_value === 1 || $Silian_value === true || $Silian_value === 'true') {
                $Silian_where[] = 'u.is_admin = 1';
            } elseif ($Silian_value === '0' || $Silian_value === 0 || $Silian_value === false || $Silian_value === 'false') {
                $Silian_where[] = 'u.is_admin = 0';
            }
        }

        if (!empty($Silian_criteria['include_ids']) && is_array($Silian_criteria['include_ids'])) {
            $Silian_clean = $this->sanitizeIdList($Silian_criteria['include_ids']);
            if (!empty($Silian_clean)) {
                $Silian_placeholders = [];
                foreach (array_values($Silian_clean) as $Silian_index => $Silian_id) {
                    $Silian_placeholder = 'include_id_' . $Silian_index;
                    $Silian_placeholders[] = ':' . $Silian_placeholder;
                    $Silian_params[$Silian_placeholder] = $Silian_id;
                }
                $Silian_where[] = 'u.id IN (' . implode(',', $Silian_placeholders) . ')';
            }
        }

        if (!empty($Silian_criteria['exclude_ids']) && is_array($Silian_criteria['exclude_ids'])) {
            $Silian_clean = $this->sanitizeIdList($Silian_criteria['exclude_ids']);
            if (!empty($Silian_clean)) {
                $Silian_placeholders = [];
                foreach (array_values($Silian_clean) as $Silian_index => $Silian_id) {
                    $Silian_placeholder = 'exclude_id_' . $Silian_index;
                    $Silian_placeholders[] = ':' . $Silian_placeholder;
                    $Silian_params[$Silian_placeholder] = $Silian_id;
                }
                $Silian_where[] = 'u.id NOT IN (' . implode(',', $Silian_placeholders) . ')';
            }
        }

        $Silian_conditions = implode(' AND ', $Silian_where);

        $Silian_sql = 'SELECT u.id, u.uuid, u.username, u.email, u.school_id, u.region_code, u.is_admin, u.status, s.name AS school_name '
            . 'FROM users u '
            . 'LEFT JOIN schools s ON s.id = u.school_id '
            . 'WHERE ' . $Silian_conditions . ' '
            . 'ORDER BY u.id DESC '
            . 'LIMIT :limit OFFSET :offset';

        try {
            $Silian_stmt = $this->db->prepare($Silian_sql);
            if (!$Silian_stmt) {
                return [];
            }

            foreach ($Silian_params as $Silian_key => $Silian_value) {
                $Silian_type = PDO::PARAM_STR;
                if ($Silian_key === 'school_id' || str_starts_with($Silian_key, 'include_id_') || str_starts_with($Silian_key, 'exclude_id_')) {
                    $Silian_type = PDO::PARAM_INT;
                    $Silian_value = (int)$Silian_value;
                }
                $Silian_stmt->bindValue(':' . $Silian_key, $Silian_value, $Silian_type);
            }

            $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
            $Silian_stmt->bindValue(':offset', $Silian_offset, PDO::PARAM_INT);
            $Silian_stmt->execute();
            return $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        } catch (\Throwable $Silian_e) {
            return [];
        }
    }

    private function sanitizeIdList(array $Silian_values): array
    {
        $Silian_clean = [];
        foreach ($Silian_values as $Silian_value) {
            if (is_int($Silian_value) || (is_numeric($Silian_value) && (string)(int)$Silian_value === (string)$Silian_value)) {
                $Silian_intVal = (int)$Silian_value;
                if ($Silian_intVal > 0) {
                    $Silian_clean[$Silian_intVal] = $Silian_intVal;
                }
            }
        }
        return array_values($Silian_clean);
    }

    private function normalizeUserRow(array $Silian_row): array
    {
        $Silian_profileFields = $this->userProfileViewService->buildProfileFields($Silian_row);
        $Silian_legacyDisplayFields = $this->userProfileViewService->buildLegacyDisplayFields($Silian_row, $Silian_profileFields);

        return [
            'id' => isset($Silian_row['id']) ? (int)$Silian_row['id'] : null,
            'uuid' => $Silian_row['uuid'] ?? null,
            'username' => $Silian_row['username'] ?? null,
            'email' => $Silian_row['email'] ?? null,
            'school' => $Silian_legacyDisplayFields['school'],
            'school_id' => $Silian_profileFields['school_id'],
            'location' => $Silian_legacyDisplayFields['location'],
            'is_admin' => isset($Silian_row['is_admin']) ? (bool)$Silian_row['is_admin'] : null,
            'status' => $Silian_row['status'] ?? null,
        ];
    }

    private function normalizeEmailDeliveryMeta($Silian_value): array
    {
        $Silian_defaults = [
            'triggered' => false,
            'attempted_recipients' => 0,
            'successful_chunks' => 0,
            'failed_chunks' => 0,
            'failed_recipient_ids' => [],
            'missing_email_user_ids' => [],
            'status' => 'skipped',
            'errors' => [],
            'completed_at' => null,
        ];

        if (is_string($Silian_value) && $Silian_value !== '') {
            $Silian_decoded = json_decode($Silian_value, true);
            if (is_array($Silian_decoded)) {
                $Silian_value = $Silian_decoded;
            }
        }

        if (!is_array($Silian_value)) {
            return $Silian_defaults;
        }

        $Silian_result = $Silian_defaults;
        $Silian_result['triggered'] = (bool)($Silian_value['triggered'] ?? false);
        $Silian_result['attempted_recipients'] = (int)($Silian_value['attempted_recipients'] ?? 0);
        $Silian_result['successful_chunks'] = (int)($Silian_value['successful_chunks'] ?? 0);
        $Silian_result['failed_chunks'] = (int)($Silian_value['failed_chunks'] ?? 0);
        $Silian_result['failed_recipient_ids'] = $this->decodeIdList($Silian_value['failed_recipient_ids'] ?? []);
        $Silian_result['missing_email_user_ids'] = $this->decodeIdList($Silian_value['missing_email_user_ids'] ?? []);
        $Silian_status = (string)($Silian_value['status'] ?? '');
        $Silian_result['status'] = $Silian_status !== '' ? $Silian_status : 'skipped';

        $Silian_errors = $Silian_value['errors'] ?? [];
        if (is_string($Silian_errors)) {
            $Silian_decodedErrors = json_decode($Silian_errors, true);
            if (is_array($Silian_decodedErrors)) {
                $Silian_errors = $Silian_decodedErrors;
            } else {
                $Silian_errors = array_filter(array_map('trim', preg_split('/[\r\n]+/', $Silian_errors) ?: []));
            }
        }
        if (!is_array($Silian_errors)) {
            $Silian_errors = [];
        }
        $Silian_normalizedErrors = [];
        foreach ($Silian_errors as $Silian_error) {
            if (!is_scalar($Silian_error)) {
                continue;
            }
            $Silian_trimmed = trim((string)$Silian_error);
            if ($Silian_trimmed === '' || in_array($Silian_trimmed, $Silian_normalizedErrors, true)) {
                continue;
            }
            $Silian_normalizedErrors[] = $Silian_trimmed;
        }
        $Silian_result['errors'] = $Silian_normalizedErrors;
        $Silian_completedAt = $Silian_value['completed_at'] ?? null;
        if ($Silian_completedAt instanceof \DateTimeInterface) {
            $Silian_completedAt = $Silian_completedAt->format('Y-m-d H:i:s');
        } elseif (!is_string($Silian_completedAt) || $Silian_completedAt === '') {
            $Silian_completedAt = null;
        }
        $Silian_result['completed_at'] = $Silian_completedAt;

        return $Silian_result;
    }

    private function trimEmailDeliveryForLog(array $Silian_delivery): array
    {
        $Silian_result = $Silian_delivery;
        $Silian_limit = 100;
        foreach (['failed_recipient_ids', 'missing_email_user_ids', 'errors'] as $Silian_key) {
            if (!isset($Silian_result[$Silian_key]) || !is_array($Silian_result[$Silian_key])) {
                continue;
            }
            if (count($Silian_result[$Silian_key]) > $Silian_limit) {
                $Silian_result[$Silian_key] = array_slice($Silian_result[$Silian_key], 0, $Silian_limit);
                $Silian_result[$Silian_key . '_truncated'] = true;
            }
        }
        return $Silian_result;
    }

    private function normalizeBroadcastContentFormat($Silian_value): ?string
    {
        $Silian_normalized = strtolower(trim((string) $Silian_value));
        if ($Silian_normalized === '' || $Silian_normalized === self::BROADCAST_CONTENT_FORMAT_TEXT) {
            return self::BROADCAST_CONTENT_FORMAT_TEXT;
        }
        if ($Silian_normalized === self::BROADCAST_CONTENT_FORMAT_HTML) {
            return self::BROADCAST_CONTENT_FORMAT_HTML;
        }

        return null;
    }

    private function normalizeBroadcastRenderProfile($Silian_value, string $Silian_contentFormat): ?string
    {
        if ($Silian_contentFormat !== self::BROADCAST_CONTENT_FORMAT_HTML) {
            return null;
        }

        $Silian_normalized = trim((string) $Silian_value);
        if ($Silian_normalized === '') {
            return self::BROADCAST_RENDER_PROFILE_HTML;
        }

        return $Silian_normalized === self::BROADCAST_RENDER_PROFILE_HTML
            ? self::BROADCAST_RENDER_PROFILE_HTML
            : null;
    }

    private function resolveBroadcastRenderVersion(string $Silian_contentFormat, ?string $Silian_renderProfile): ?int
    {
        if (
            $Silian_contentFormat === self::BROADCAST_CONTENT_FORMAT_HTML
            && $Silian_renderProfile === self::BROADCAST_RENDER_PROFILE_HTML
        ) {
            return self::BROADCAST_RENDER_VERSION_HTML;
        }

        return null;
    }

    private function normalizeBroadcastRenderVersion($Silian_value, string $Silian_contentFormat, ?string $Silian_renderProfile): ?int
    {
        $Silian_resolved = $this->resolveBroadcastRenderVersion($Silian_contentFormat, $Silian_renderProfile);
        if ($Silian_resolved === null) {
            return null;
        }

        return $Silian_resolved;
    }

    private function normalizeBroadcastSourceKind($Silian_value): string
    {
        $Silian_normalized = trim((string) $Silian_value);
        return $Silian_normalized !== '' ? $Silian_normalized : self::BROADCAST_SOURCE_KIND_ADMIN;
    }

    private function normalizeBroadcastContent(string $Silian_content, string $Silian_contentFormat): string
    {
        $Silian_normalized = trim($Silian_content);
        if ($Silian_normalized === '') {
            return '';
        }

        if ($Silian_contentFormat !== self::BROADCAST_CONTENT_FORMAT_HTML) {
            return $Silian_normalized;
        }

        return $this->sanitizeBroadcastAnnouncementHtml($Silian_normalized);
    }

    private function sanitizeBroadcastAnnouncementHtml(string $Silian_html): string
    {
        $Silian_normalized = trim($Silian_html);
        if ($Silian_normalized === '') {
            return '';
        }

        if (!class_exists(\DOMDocument::class)) {
            return trim(strip_tags($Silian_normalized));
        }

        $Silian_wrapperId = '__broadcast_root__';
        $Silian_document = new \DOMDocument('1.0', 'UTF-8');
        $Silian_previous = libxml_use_internal_errors(true);
        try {
            $Silian_loaded = $Silian_document->loadHTML(
                '<?xml encoding="utf-8" ?><div id="' . $Silian_wrapperId . '">' . $Silian_normalized . '</div>',
                LIBXML_HTML_NOIMPLIED | LIBXML_HTML_NODEFDTD
            );

            if ($Silian_loaded === false) {
                return trim(strip_tags($Silian_normalized));
            }

            $Silian_root = $Silian_document->getElementById($Silian_wrapperId);
            if (!$Silian_root instanceof \DOMElement) {
                return trim(strip_tags($Silian_normalized));
            }

            $this->sanitizeBroadcastAnnouncementNode($Silian_root, $Silian_document);

            $Silian_output = '';
            foreach ($Silian_root->childNodes as $Silian_child) {
                $Silian_output .= $Silian_document->saveHTML($Silian_child);
            }

            return trim($Silian_output);
        } catch (\Throwable $Silian_e) {
            return trim(strip_tags($Silian_normalized));
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($Silian_previous);
        }
    }

    private function sanitizeBroadcastAnnouncementNode(\DOMNode $Silian_node, \DOMDocument $Silian_document): void
    {
        if ($Silian_node->nodeType === XML_COMMENT_NODE) {
            if ($Silian_node->parentNode) {
                $Silian_node->parentNode->removeChild($Silian_node);
            }
            return;
        }

        if ($Silian_node->nodeType === XML_ELEMENT_NODE) {
            $Silian_tagName = strtolower($Silian_node->nodeName);
            $Silian_blockedTags = ['form', 'iframe', 'img', 'input', 'meta', 'object', 'script', 'style', 'textarea', 'video'];
            $Silian_allowedTags = ['a', 'abbr', 'b', 'blockquote', 'br', 'caption', 'code', 'col', 'colgroup', 'div', 'em', 'h1', 'h2', 'h3', 'h4', 'hr', 'i', 'li', 'ol', 'p', 'pre', 'strong', 'table', 'tbody', 'td', 'th', 'thead', 'tr', 'u', 'ul'];

            if (in_array($Silian_tagName, $Silian_blockedTags, true)) {
                if ($Silian_node->parentNode) {
                    $Silian_node->parentNode->removeChild($Silian_node);
                }
                return;
            }

            if (!in_array($Silian_tagName, $Silian_allowedTags, true)) {
                $Silian_children = [];
                $Silian_child = $Silian_node->firstChild;
                while ($Silian_child !== null) {
                    $Silian_children[] = $Silian_child;
                    $Silian_child = $Silian_child->nextSibling;
                }

                $this->unwrapBroadcastAnnouncementNode($Silian_node);

                foreach ($Silian_children as $Silian_childNode) {
                    if ($Silian_childNode->parentNode !== null) {
                        $this->sanitizeBroadcastAnnouncementNode($Silian_childNode, $Silian_document);
                    }
                }
                return;
            }

            $this->sanitizeBroadcastAnnouncementAttributes($Silian_node);
        }

        $Silian_child = $Silian_node->firstChild;
        while ($Silian_child !== null) {
            $Silian_next = $Silian_child->nextSibling;
            $this->sanitizeBroadcastAnnouncementNode($Silian_child, $Silian_document);
            $Silian_child = $Silian_next;
        }
    }

    private function unwrapBroadcastAnnouncementNode(\DOMNode $Silian_node): void
    {
        $Silian_parent = $Silian_node->parentNode;
        if ($Silian_parent === null) {
            return;
        }

        while ($Silian_node->firstChild !== null) {
            $Silian_parent->insertBefore($Silian_node->firstChild, $Silian_node);
        }

        $Silian_parent->removeChild($Silian_node);
    }

    private function sanitizeBroadcastAnnouncementAttributes(\DOMNode $Silian_node): void
    {
        if (!$Silian_node instanceof \DOMElement || !$Silian_node->hasAttributes()) {
            return;
        }

        $Silian_tagName = strtolower($Silian_node->tagName);
        $Silian_allowedAttributes = ['title'];
        if ($Silian_tagName === 'a') {
            $Silian_allowedAttributes = ['href', 'rel', 'target', 'title'];
        } elseif ($Silian_tagName === 'td' || $Silian_tagName === 'th') {
            $Silian_allowedAttributes = ['colspan', 'rowspan', 'align', 'title'];
            if ($Silian_tagName === 'th') {
                $Silian_allowedAttributes[] = 'scope';
            }
        }

        $Silian_attributes = [];
        foreach ($Silian_node->attributes as $Silian_attribute) {
            if ($Silian_attribute instanceof \DOMAttr) {
                $Silian_attributes[] = $Silian_attribute->name;
            } elseif ($Silian_attribute instanceof \DOMNode) {
                $Silian_attributes[] = $Silian_attribute->nodeName;
            }
        }

        foreach ($Silian_attributes as $Silian_attributeName) {
            if (!in_array(strtolower($Silian_attributeName), $Silian_allowedAttributes, true)) {
                $Silian_node->removeAttribute($Silian_attributeName);
            }
        }

        if ($Silian_tagName === 'a') {
            $Silian_href = trim((string) $Silian_node->getAttribute('href'));
            if ($Silian_href === '' || !preg_match('/^(?:(?:https?|mailto|tel):|#|\/)/i', $Silian_href)) {
                $Silian_node->removeAttribute('href');
                $Silian_node->removeAttribute('rel');
                $Silian_node->removeAttribute('target');
            } else {
                $Silian_node->setAttribute('rel', 'noopener noreferrer');
                $Silian_node->setAttribute('target', '_blank');
            }
        }

        foreach (['colspan', 'rowspan'] as $Silian_spanAttribute) {
            if (!$Silian_node->hasAttribute($Silian_spanAttribute)) {
                continue;
            }
            $Silian_raw = trim((string) $Silian_node->getAttribute($Silian_spanAttribute));
            $Silian_numeric = ctype_digit($Silian_raw) ? (int) $Silian_raw : 0;
            if ($Silian_numeric < 1 || $Silian_numeric > 12) {
                $Silian_node->removeAttribute($Silian_spanAttribute);
            } else {
                $Silian_node->setAttribute($Silian_spanAttribute, (string) $Silian_numeric);
            }
        }

        if ($Silian_node->hasAttribute('align')) {
            $Silian_align = strtolower(trim((string) $Silian_node->getAttribute('align')));
            if (!in_array($Silian_align, ['left', 'center', 'right'], true)) {
                $Silian_node->removeAttribute('align');
            } else {
                $Silian_node->setAttribute('align', $Silian_align);
            }
        }

        if ($Silian_node->hasAttribute('scope')) {
            $Silian_scope = strtolower(trim((string) $Silian_node->getAttribute('scope')));
            if (!in_array($Silian_scope, ['col', 'row', 'colgroup', 'rowgroup'], true)) {
                $Silian_node->removeAttribute('scope');
            } else {
                $Silian_node->setAttribute('scope', $Silian_scope);
            }
        }
    }

    private function normalizeMessageIdMap($Silian_value): array
    {
        $Silian_result = [];
        if (is_array($Silian_value)) {
            foreach ($Silian_value as $Silian_userId => $Silian_messageId) {
                $Silian_intUserId = is_numeric($Silian_userId) ? (int)$Silian_userId : null;
                $Silian_intMessageId = is_numeric($Silian_messageId) ? (int)$Silian_messageId : null;
                if ($Silian_intUserId !== null && $Silian_intUserId > 0 && $Silian_intMessageId !== null && $Silian_intMessageId > 0) {
                    $Silian_result[$Silian_intUserId] = $Silian_intMessageId;
                }
            }
        } elseif (is_string($Silian_value) && $Silian_value !== '') {
            $Silian_decoded = json_decode($Silian_value, true);
            if (is_array($Silian_decoded)) {
                return $this->normalizeMessageIdMap($Silian_decoded);
            }
        }
        return $Silian_result;
    }

    private function shouldSendPriorityEmail(string $Silian_priority): bool
    {
        return in_array($Silian_priority, [Message::PRIORITY_HIGH, Message::PRIORITY_URGENT], true);
    }

    private function loadUsernames(array $Silian_ids): array
    {
        $Silian_cleanIds = [];
        foreach ($Silian_ids as $Silian_id) {
            $Silian_intId = (int)$Silian_id;
            if ($Silian_intId > 0) {
                $Silian_cleanIds[$Silian_intId] = $Silian_intId;
            }
        }
        if (empty($Silian_cleanIds)) {
            return [];
        }

        try {
            $Silian_placeholders = implode(',', array_fill(0, count($Silian_cleanIds), '?'));
            $Silian_sql = 'SELECT id, username, email FROM users WHERE id IN (' . $Silian_placeholders . ')';
            $Silian_stmt = $this->db->prepare($Silian_sql);
            if (!$Silian_stmt) {
                return [];
            }
            $Silian_index = 1;
            foreach ($Silian_cleanIds as $Silian_userId) {
                $Silian_stmt->bindValue($Silian_index, $Silian_userId, PDO::PARAM_INT);
                $Silian_index++;
            }
            $Silian_stmt->execute();
            $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $Silian_result = [];
            foreach ($Silian_rows as $Silian_row) {
                $Silian_uid = isset($Silian_row['id']) ? (int)$Silian_row['id'] : null;
                if ($Silian_uid === null) {
                    continue;
                }
                $Silian_username = null;
                if (!empty($Silian_row['username'])) {
                    $Silian_username = (string)$Silian_row['username'];
                } elseif (!empty($Silian_row['email'])) {
                    $Silian_username = (string)$Silian_row['email'];
                }
                $Silian_result[$Silian_uid] = $Silian_username;
            }
            return $Silian_result;
        } catch (\Throwable $Silian_e) {
            return [];
        }
    }

    /**
     * 标记消息为已读的私有方法
     */
    private function markMessageAsRead(string $Silian_messageId): void
    {
        $Silian_sql = "UPDATE messages SET is_read = 1, updated_at = NOW() WHERE id = :id AND is_read = 0";
        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute(['id' => $Silian_messageId]);
    }
    private function json(Response $Silian_response, array $Silian_data, int $Silian_status = 200): Response
    {
        $Silian_response->getBody()->write(json_encode($Silian_data));
        return $Silian_response->withStatus($Silian_status)->withHeader('Content-Type', 'application/json');
    }
}




