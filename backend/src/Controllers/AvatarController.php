<?php

declare(strict_types=1);

namespace CarbonTrack\Controllers;

use CarbonTrack\Models\Message;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use CarbonTrack\Models\Avatar;
use CarbonTrack\Models\AvatarFallbackUnavailableException;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\CloudflareR2Service;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\MessageService;
use CarbonTrack\Support\InputValueNormalizer;
use Monolog\Logger;

class AvatarController
{
    private const ERR_INVALID_REQUEST_BODY = 'Request body must be a JSON object';

    private Avatar $avatarModel;
    private AuthService $authService;
    private ?AuditLogService $auditLogService;
    private ?CloudflareR2Service $r2Service;
    private ?Logger $logger;
    private ?ErrorLogService $errorLogService;
    private ?MessageService $messageService;

    public function __construct(
        Avatar $Silian_avatarModel,
        AuthService $Silian_authService,
        AuditLogService $Silian_auditLogService = null,
        CloudflareR2Service $Silian_r2Service = null,
        Logger $Silian_logger = null,
        ErrorLogService $Silian_errorLogService = null,
        MessageService $Silian_messageService = null
    ) {
        $this->avatarModel = $Silian_avatarModel;
        $this->authService = $Silian_authService;
        $this->auditLogService = $Silian_auditLogService;
        $this->r2Service = $Silian_r2Service;
        $this->logger = $Silian_logger;
        $this->errorLogService = $Silian_errorLogService;
        $this->messageService = $Silian_messageService;
    }

    /**
     * 获取所有可用头像（用户和管理员都可访问）
     */
    public function getAvatars(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_queryParams = $Silian_request->getQueryParams();
            $Silian_category = $Silian_queryParams['category'] ?? null;
            $Silian_includeInactive = !empty($Silian_queryParams['include_inactive'])
                && filter_var($Silian_queryParams['include_inactive'], FILTER_VALIDATE_BOOLEAN);

            // 检查是否为管理员（容错：AuthService 可能在匿名请求时抛出异常）
            $Silian_user = null;
            $Silian_isAdmin = false;
            try {
                $Silian_user = $this->authService->getCurrentUser($Silian_request);
                $Silian_isAdmin = $Silian_user && !empty($Silian_user['is_admin']);
            } catch (\Throwable $Silian_authEx) {
                // 记日志但不影响公开接口返回
                if (isset($this->logger)) {
                    $this->logger->debug('Anonymous avatar listing (auth not resolved)', [
                        'error' => $Silian_authEx->getMessage()
                    ]);
                }
            }

            if ($Silian_includeInactive && !$Silian_isAdmin) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Admin access required to view inactive avatars',
                    'code' => 'ADMIN_REQUIRED'
                ], 403);
            }

            $Silian_avatars = $this->avatarModel->getAvailableAvatars($Silian_category, $Silian_includeInactive && $Silian_isAdmin);
            $Silian_avatars = array_map([$this, 'formatAvatar'], array_values($Silian_avatars));

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => $Silian_avatars
            ]);

        } catch (\Exception $Silian_e) {
            try { if ($this->errorLogService) { $this->errorLogService->logException($Silian_e, $Silian_request); } } catch (\Throwable $Silian_ignore) {}
            if ($this->logger) {
                $this->logger->error('Get avatars failed', [
                    'error' => $Silian_e->getMessage(),
                    'trace' => $Silian_e->getTraceAsString()
                ]);
            }

            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to get avatars',
                'debug' => getenv('APP_ENV') === 'testing' ? ($Silian_e->getMessage()) : null
            ], 500);
        }
    }

    /**
     * 获取头像分类列表
     */
    public function getAvatarCategories(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_categories = $this->avatarModel->getAvatarCategories();

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => $Silian_categories
            ]);

        } catch (\Exception $Silian_e) {
            try { if ($this->errorLogService) { $this->errorLogService->logException($Silian_e, $Silian_request); } } catch (\Throwable $Silian_ignore) {}
            if ($this->logger) {
                $this->logger->error('Get avatar categories failed', [
                    'error' => $Silian_e->getMessage(),
                    'trace' => $Silian_e->getTraceAsString()
                ]);
            }

            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to get avatar categories'
            ], 500);
        }
    }

    /**
     * 获取单个头像详情（管理员）
     */
    public function getAvatar(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$Silian_user['is_admin']) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Admin access required',
                    'code' => 'ADMIN_REQUIRED'
                ], 403);
            }

            $Silian_avatarId = (int)$Silian_args['id'];
            $Silian_avatar = $this->avatarModel->getAvatarById($Silian_avatarId);

            if (!$Silian_avatar) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Avatar not found',
                    'code' => 'AVATAR_NOT_FOUND'
                ], 404);
            }

            $Silian_avatar = $this->formatAvatar($Silian_avatar);

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => $Silian_avatar
            ]);

        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) {}
            $this->logger->error('Get avatar failed', [
                'error' => $Silian_e->getMessage(),
                'trace' => $Silian_e->getTraceAsString(),
                'avatar_id' => $Silian_args['id'] ?? null
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to get avatar'
            ], 500);
        }
    }

    /**
     * 创建新头像（管理员）
     */
    public function createAvatar(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$Silian_user['is_admin']) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Admin access required',
                    'code' => 'ADMIN_REQUIRED'
                ], 403);
            }

            $Silian_data = $this->normalizeAvatarPayload($Silian_request->getParsedBody());

            // 验证必需字段
            $Silian_requiredFields = ['name', 'file_path'];
            foreach ($Silian_requiredFields as $Silian_field) {
                if (empty($Silian_data[$Silian_field])) {
                    return $this->jsonResponse($Silian_response, [
                        'success' => false,
                        'message' => "Missing required field: {$Silian_field}",
                        'code' => 'MISSING_FIELD'
                    ], 400);
                }
            }

            $this->assertDefaultAvatarStateIsValid($Silian_data);

            // 验证文件路径是否存在（如果是R2路径）
            if (strpos($Silian_data['file_path'], '/avatars/') === 0) {
                $Silian_filePath = ltrim($Silian_data['file_path'], '/');
                if ($this->r2Service === null) {
                    return $this->avatarStorageUnavailableResponse($Silian_response);
                }

                if (!$this->r2Service->fileExists($Silian_filePath)) {
                    return $this->jsonResponse($Silian_response, [
                        'success' => false,
                        'message' => 'Avatar file does not exist',
                        'code' => 'FILE_NOT_FOUND'
                    ], 400);
                }
            }

            // 创建头像
            $Silian_avatarData = [
                'name' => $Silian_data['name'],
                'description' => $Silian_data['description'] ?? null,
                'file_path' => $Silian_data['file_path'],
                'thumbnail_path' => $Silian_data['thumbnail_path'] ?? null,
                'category' => $Silian_data['category'] ?? 'default',
                'sort_order' => $Silian_data['sort_order'] ?? 0,
                'is_active' => $Silian_data['is_active'] ?? 1,
                'is_default' => $Silian_data['is_default'] ?? 0
            ];

            $Silian_avatarId = $this->avatarModel->createAvatar($Silian_avatarData);

            // 记录审计日志
            $this->auditLogService->log([
                'user_id' => $Silian_user['id'],
                'action' => 'avatar_created',
                'entity_type' => 'avatar',
                'entity_id' => $Silian_avatarId,
                'new_value' => json_encode($Silian_avatarData),
                'notes' => 'Avatar created by admin'
            ]);

            $this->logger->info('Avatar created', [
                'avatar_id' => $Silian_avatarId,
                'admin_id' => $Silian_user['id'],
                'avatar_name' => $Silian_data['name']
            ]);

            // 获取创建的头像信息
            $Silian_createdAvatar = $this->avatarModel->getAvatarById($Silian_avatarId);

            $Silian_createdAvatar = $this->formatAvatar($Silian_createdAvatar);

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'message' => 'Avatar created successfully',
                'data' => $Silian_createdAvatar
            ], 201);

        } catch (\InvalidArgumentException $Silian_e) {
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => $Silian_e->getMessage(),
                'code' => $this->avatarValidationErrorCode($Silian_e),
            ], 400);
        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) {}
            $this->logger->error('Create avatar failed', [
                'error' => $Silian_e->getMessage(),
                'trace' => $Silian_e->getTraceAsString(),
                'admin_id' => $Silian_user['id'] ?? null
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to create avatar'
            ], 500);
        }
    }

    /**
     * 更新头像（管理员）
     */
    public function updateAvatar(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$Silian_user['is_admin']) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Admin access required',
                    'code' => 'ADMIN_REQUIRED'
                ], 403);
            }

            $Silian_avatarId = (int)$Silian_args['id'];
            $Silian_data = $this->normalizeAvatarPayload($Silian_request->getParsedBody());

            // 检查头像是否存在
            $Silian_existingAvatar = $this->avatarModel->getAvatarById($Silian_avatarId);
            if (!$Silian_existingAvatar) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Avatar not found',
                    'code' => 'AVATAR_NOT_FOUND'
                ], 404);
            }

            $this->assertDefaultAvatarStateIsValid($Silian_data, $Silian_existingAvatar);

            // 验证文件路径是否存在（如果提供了新的文件路径）
            if (!empty($Silian_data['file_path']) && strpos($Silian_data['file_path'], '/avatars/') === 0) {
                $Silian_filePath = ltrim($Silian_data['file_path'], '/');
                if ($this->r2Service === null) {
                    return $this->avatarStorageUnavailableResponse($Silian_response);
                }

                if (!$this->r2Service->fileExists($Silian_filePath)) {
                    return $this->jsonResponse($Silian_response, [
                        'success' => false,
                        'message' => 'Avatar file does not exist',
                        'code' => 'FILE_NOT_FOUND'
                    ], 400);
                }
            }

            // 准备更新数据
            $Silian_updateData = [];
            $Silian_allowedFields = [
                'name', 'description', 'file_path', 'thumbnail_path',
                'category', 'sort_order', 'is_active', 'is_default'
            ];

            foreach ($Silian_allowedFields as $Silian_field) {
                if (array_key_exists($Silian_field, $Silian_data)) {
                    $Silian_updateData[$Silian_field] = $Silian_data[$Silian_field];
                }
            }

            if (empty($Silian_updateData)) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'No valid fields to update',
                    'code' => 'NO_UPDATE_DATA'
                ], 400);
            }

            $Silian_wasActive = $this->normalizeBooleanValue($Silian_existingAvatar['is_active'] ?? true);
            $Silian_willBeActive = array_key_exists('is_active', $Silian_updateData)
                ? (bool) $Silian_updateData['is_active']
                : $Silian_wasActive;
            $Silian_isDeactivation = $Silian_wasActive && !$Silian_willBeActive;
            $Silian_fallbackAvatar = null;
            $Silian_affectedUsers = [];

            if ($Silian_isDeactivation) {
                try {
                    $Silian_reassignment = $this->avatarModel->updateAvatarAndReassignUsers(
                        $Silian_avatarId,
                        $Silian_updateData,
                        null
                    );
                    $Silian_affectedUsers = $Silian_reassignment['users'] ?? [];
                    $Silian_fallbackAvatar = $Silian_reassignment['fallback_avatar'] ?? null;
                } catch (AvatarFallbackUnavailableException $Silian_e) {
                    return $this->jsonResponse($Silian_response, [
                        'success' => false,
                        'message' => $Silian_e->getMessage(),
                        'code' => 'DEFAULT_AVATAR_REQUIRED'
                    ], 409);
                }
            } else {
                // 更新头像
                $Silian_success = $this->avatarModel->updateAvatar($Silian_avatarId, $Silian_updateData);

                if (!$Silian_success) {
                    return $this->jsonResponse($Silian_response, [
                        'success' => false,
                        'message' => 'Failed to update avatar'
                    ], 500);
                }
            }

            $Silian_notificationSummary = null;
            if ($Silian_isDeactivation && $Silian_fallbackAvatar !== null && $Silian_affectedUsers !== []) {
                $Silian_notificationSummary = $this->notifyUsersAboutAvatarFallback(
                    $Silian_affectedUsers,
                    $Silian_existingAvatar,
                    $Silian_fallbackAvatar,
                    $Silian_request
                );

                if ($this->auditLogService !== null) {
                    $this->auditLogService->log([
                        'user_id' => $Silian_user['id'],
                        'action' => 'avatar_users_reassigned_to_default',
                        'entity_type' => 'avatar',
                        'entity_id' => $Silian_avatarId,
                        'new_value' => json_encode([
                            'fallback_avatar_id' => (int) $Silian_fallbackAvatar['id'],
                            'fallback_avatar_name' => $Silian_fallbackAvatar['name'] ?? null,
                            'affected_user_ids' => array_map(
                                static fn (array $Silian_entry): int => (int) ($Silian_entry['id'] ?? 0),
                                $Silian_affectedUsers
                            ),
                            'notified_count' => $Silian_notificationSummary['notified_count'],
                            'notification_failures' => $Silian_notificationSummary['failed_user_ids'],
                        ], JSON_UNESCAPED_UNICODE),
                        'notes' => 'Users were reassigned to the default avatar after avatar deactivation'
                    ]);
                }
            }

            // 记录审计日志
            if ($this->auditLogService !== null) {
                $this->auditLogService->log([
                    'user_id' => $Silian_user['id'],
                    'action' => 'avatar_updated',
                    'entity_type' => 'avatar',
                    'entity_id' => $Silian_avatarId,
                    'old_value' => json_encode($Silian_existingAvatar),
                    'new_value' => json_encode(array_merge($Silian_updateData, [
                        'fallback_avatar_id' => $Silian_fallbackAvatar['id'] ?? null,
                        'reassigned_user_count' => is_array($Silian_affectedUsers) ? count($Silian_affectedUsers) : 0,
                    ]), JSON_UNESCAPED_UNICODE),
                    'notes' => 'Avatar updated by admin'
                ]);
            }

            if ($this->logger !== null) {
                $this->logger->info('Avatar updated', [
                    'avatar_id' => $Silian_avatarId,
                    'admin_id' => $Silian_user['id'],
                    'updated_fields' => array_keys($Silian_updateData),
                    'reassigned_user_count' => is_array($Silian_affectedUsers) ? count($Silian_affectedUsers) : 0,
                    'notification_failures' => $Silian_notificationSummary['failed_user_ids'] ?? [],
                ]);
            }

            // 获取更新后的头像信息
            $Silian_updatedAvatar = $this->avatarModel->getAvatarById($Silian_avatarId);

            $Silian_updatedAvatar = $this->formatAvatar($Silian_updatedAvatar);

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'message' => 'Avatar updated successfully',
                'data' => $Silian_updatedAvatar
            ]);

        } catch (\InvalidArgumentException $Silian_e) {
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => $Silian_e->getMessage(),
                'code' => $this->avatarValidationErrorCode($Silian_e),
            ], 400);
        } catch (\Exception $Silian_e) {
            if ($this->errorLogService !== null) {
                try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) {}
            }
            if ($this->logger !== null) {
                $this->logger->error('Update avatar failed', [
                    'error' => $Silian_e->getMessage(),
                    'trace' => $Silian_e->getTraceAsString(),
                    'avatar_id' => $Silian_args['id'] ?? null,
                    'admin_id' => $Silian_user['id'] ?? null
                ]);
            }

            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to update avatar'
            ], 500);
        }
    }

    /**
     * 删除头像（管理员）
     */
    public function deleteAvatar(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$Silian_user['is_admin']) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Admin access required',
                    'code' => 'ADMIN_REQUIRED'
                ], 403);
            }

            $Silian_avatarId = (int)$Silian_args['id'];

            // 检查头像是否存在
            $Silian_avatar = $this->avatarModel->getAvatarById($Silian_avatarId);
            if (!$Silian_avatar) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Avatar not found',
                    'code' => 'AVATAR_NOT_FOUND'
                ], 404);
            }

            // 检查是否为默认头像
            if ($Silian_avatar['is_default']) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Cannot delete default avatar',
                    'code' => 'CANNOT_DELETE_DEFAULT'
                ], 400);
            }

            // 软删除头像
            $Silian_success = $this->avatarModel->deleteAvatar($Silian_avatarId);

            if (!$Silian_success) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Failed to delete avatar'
                ], 500);
            }

            // 记录审计日志
            $this->auditLogService->log([
                'user_id' => $Silian_user['id'],
                'action' => 'avatar_deleted',
                'entity_type' => 'avatar',
                'entity_id' => $Silian_avatarId,
                'old_value' => json_encode($Silian_avatar),
                'notes' => 'Avatar deleted by admin'
            ]);

            $this->logger->info('Avatar deleted', [
                'avatar_id' => $Silian_avatarId,
                'admin_id' => $Silian_user['id'],
                'avatar_name' => $Silian_avatar['name']
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'message' => 'Avatar deleted successfully'
            ]);

        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) {}
            $this->logger->error('Delete avatar failed', [
                'error' => $Silian_e->getMessage(),
                'trace' => $Silian_e->getTraceAsString(),
                'avatar_id' => $Silian_args['id'] ?? null,
                'admin_id' => $Silian_user['id'] ?? null
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to delete avatar'
            ], 500);
        }
    }

    /**
     * 恢复已删除的头像（管理员）
     */
    public function restoreAvatar(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$Silian_user['is_admin']) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Admin access required',
                    'code' => 'ADMIN_REQUIRED'
                ], 403);
            }

            $Silian_avatarId = (int)$Silian_args['id'];

            // 恢复头像
            $Silian_success = $this->avatarModel->restoreAvatar($Silian_avatarId);

            if (!$Silian_success) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Failed to restore avatar or avatar not found'
                ], 500);
            }

            // 记录审计日志
            $this->auditLogService->log([
                'user_id' => $Silian_user['id'],
                'action' => 'avatar_restored',
                'entity_type' => 'avatar',
                'entity_id' => $Silian_avatarId,
                'notes' => 'Avatar restored by admin'
            ]);

            $this->logger->info('Avatar restored', [
                'avatar_id' => $Silian_avatarId,
                'admin_id' => $Silian_user['id']
            ]);

            // 获取恢复后的头像信息
            $Silian_restoredAvatar = $this->avatarModel->getAvatarById($Silian_avatarId);

            $Silian_restoredAvatar = $this->formatAvatar($Silian_restoredAvatar);

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'message' => 'Avatar restored successfully',
                'data' => $Silian_restoredAvatar
            ]);

        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) {}
            $this->logger->error('Restore avatar failed', [
                'error' => $Silian_e->getMessage(),
                'trace' => $Silian_e->getTraceAsString(),
                'avatar_id' => $Silian_args['id'] ?? null,
                'admin_id' => $Silian_user['id'] ?? null
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to restore avatar'
            ], 500);
        }
    }

    /**
     * 设置默认头像（管理员）
     */
    public function setDefaultAvatar(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$Silian_user['is_admin']) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Admin access required',
                    'code' => 'ADMIN_REQUIRED'
                ], 403);
            }

            $Silian_avatarId = (int)$Silian_args['id'];

            // 检查头像是否存在且可用
            if (!$this->avatarModel->isAvatarAvailable($Silian_avatarId)) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Avatar not found or not available',
                    'code' => 'AVATAR_NOT_AVAILABLE'
                ], 404);
            }

            // 设置默认头像
            $Silian_success = $this->avatarModel->setDefaultAvatar($Silian_avatarId);

            if (!$Silian_success) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Failed to set default avatar'
                ], 500);
            }

            // 记录审计日志
            $this->auditLogService->log([
                'user_id' => $Silian_user['id'],
                'action' => 'default_avatar_changed',
                'entity_type' => 'avatar',
                'entity_id' => $Silian_avatarId,
                'notes' => 'Default avatar changed by admin'
            ]);

            $this->logger->info('Default avatar changed', [
                'avatar_id' => $Silian_avatarId,
                'admin_id' => $Silian_user['id']
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'message' => 'Default avatar set successfully'
            ]);

        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) {}
            $this->logger->error('Set default avatar failed', [
                'error' => $Silian_e->getMessage(),
                'trace' => $Silian_e->getTraceAsString(),
                'avatar_id' => $Silian_args['id'] ?? null,
                'admin_id' => $Silian_user['id'] ?? null
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to set default avatar'
            ], 500);
        }
    }

    /**
     * 批量更新头像排序（管理员）
     */
    public function updateSortOrders(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$Silian_user['is_admin']) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Admin access required',
                    'code' => 'ADMIN_REQUIRED'
                ], 403);
            }

            $Silian_data = $Silian_request->getParsedBody();

            if (empty($Silian_data['sort_orders']) || !is_array($Silian_data['sort_orders'])) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Invalid sort orders data',
                    'code' => 'INVALID_DATA'
                ], 400);
            }

            // 验证数据格式
            $Silian_sortOrders = [];
            foreach ($Silian_data['sort_orders'] as $Silian_item) {
                if (!isset($Silian_item['id']) || !isset($Silian_item['sort_order'])) {
                    return $this->jsonResponse($Silian_response, [
                        'success' => false,
                        'message' => 'Invalid sort order item format',
                        'code' => 'INVALID_FORMAT'
                    ], 400);
                }
                $Silian_sortOrders[(int)$Silian_item['id']] = (int)$Silian_item['sort_order'];
            }

            // 更新排序
            $Silian_success = $this->avatarModel->updateSortOrders($Silian_sortOrders);

            if (!$Silian_success) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Failed to update sort orders'
                ], 500);
            }

            // 记录审计日志
            $this->auditLogService->log([
                'user_id' => $Silian_user['id'],
                'action' => 'avatar_sort_orders_updated',
                'entity_type' => 'avatar',
                'new_value' => json_encode($Silian_sortOrders),
                'notes' => 'Avatar sort orders updated by admin'
            ]);

            $this->logger->info('Avatar sort orders updated', [
                'admin_id' => $Silian_user['id'],
                'updated_count' => count($Silian_sortOrders)
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'message' => 'Sort orders updated successfully'
            ]);

        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) {}
            $this->logger->error('Update sort orders failed', [
                'error' => $Silian_e->getMessage(),
                'trace' => $Silian_e->getTraceAsString(),
                'admin_id' => $Silian_user['id'] ?? null
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to update sort orders'
            ], 500);
        }
    }

    /**
     * 获取头像使用统计（管理员）
     */
    public function getAvatarUsageStats(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$Silian_user['is_admin']) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Admin access required',
                    'code' => 'ADMIN_REQUIRED'
                ], 403);
            }

            $Silian_stats = $this->avatarModel->getAvatarUsageStats();

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => $Silian_stats
            ]);

        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) {}
            $this->logger->error('Get avatar usage stats failed', [
                'error' => $Silian_e->getMessage(),
                'trace' => $Silian_e->getTraceAsString(),
                'admin_id' => $Silian_user['id'] ?? null
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to get avatar usage stats'
            ], 500);
        }
    }

    /**
     * 上传头像文件（管理员）
     */
    public function uploadAvatarFile(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$Silian_user['is_admin']) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Admin access required',
                    'code' => 'ADMIN_REQUIRED'
                ], 403);
            }

            // 获取上传的文件
            $Silian_uploadedFiles = $Silian_request->getUploadedFiles();
            if (empty($Silian_uploadedFiles['avatar'])) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'No avatar file uploaded',
                    'code' => 'NO_FILE'
                ], 400);
            }

            $Silian_file = $Silian_uploadedFiles['avatar'];

            // 获取请求参数
            $Silian_body = $Silian_request->getParsedBody();
            $Silian_category = $Silian_body['category'] ?? 'default';

            // 上传文件到R2
            $Silian_result = $this->r2Service->uploadFile(
                $Silian_file,
                "avatars/{$Silian_category}",
                $Silian_user['id'],
                'avatar',
                null
            );

            // 记录审计日志
            $this->auditLogService->log([
                'user_id' => $Silian_user['id'],
                'action' => 'avatar_file_uploaded',
                'entity_type' => 'file',
                'new_value' => json_encode([
                    'file_path' => $Silian_result['file_path'],
                    'public_url' => $Silian_result['public_url'],
                    'category' => $Silian_category
                ]),
                'notes' => 'Avatar file uploaded by admin'
            ]);

            $this->logger->info('Avatar file uploaded', [
                'admin_id' => $Silian_user['id'],
                'file_path' => $Silian_result['file_path'],
                'category' => $Silian_category
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'message' => 'Avatar file uploaded successfully',
                'data' => [
                    'file_path' => '/' . $Silian_result['file_path'],
                    'public_url' => $Silian_result['public_url'],
                    'file_size' => $Silian_result['file_size'],
                    'mime_type' => $Silian_result['mime_type']
                ]
            ]);

        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) {}
            $this->logger->error('Upload avatar file failed', [
                'error' => $Silian_e->getMessage(),
                'trace' => $Silian_e->getTraceAsString(),
                'admin_id' => $Silian_user['id'] ?? null
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to upload avatar file'
            ], 500);
        }
    }

    /**
     * Enrich avatar payload with derived URLs for frontend consumption.
     */
    private function formatAvatar(array $Silian_avatar): array
    {
        foreach (['id', 'sort_order'] as $Silian_field) {
            if (array_key_exists($Silian_field, $Silian_avatar) && $Silian_avatar[$Silian_field] !== null) {
                $Silian_avatar[$Silian_field] = (int) $Silian_avatar[$Silian_field];
            }
        }

        foreach (['is_active', 'is_default'] as $Silian_field) {
            if (!array_key_exists($Silian_field, $Silian_avatar) || $Silian_avatar[$Silian_field] === null) {
                continue;
            }

            $Silian_avatar[$Silian_field] = $this->normalizeBooleanValue($Silian_avatar[$Silian_field]);
        }

        $Silian_filePath = $Silian_avatar['file_path'] ?? null;
        if ($Silian_filePath) {
            $Silian_normalizedPath = ltrim((string)$Silian_filePath, '/');
            $Silian_avatar['icon_path'] = $Silian_normalizedPath;
            if ($this->r2Service) {
                try {
                    $Silian_avatar['icon_url'] = $this->r2Service->getPublicUrl($Silian_normalizedPath);
                } catch (\Throwable $Silian_e) {
                    if ($this->logger) {
                        $this->logger->warning('Failed to build avatar icon public URL', [
                            'error' => $Silian_e->getMessage(),
                            'file_path' => $Silian_normalizedPath
                        ]);
                    }
                }
                try {
                    $Silian_avatar['icon_presigned_url'] = $this->r2Service->generatePresignedUrl($Silian_normalizedPath, 600);
                } catch (\Throwable $Silian_e) {
                    if ($this->logger) {
                        $this->logger->warning('Failed to build avatar icon presigned URL', [
                            'error' => $Silian_e->getMessage(),
                            'file_path' => $Silian_normalizedPath
                        ]);
                    }
                }
            }
            if (!isset($Silian_avatar['image_url']) || !$Silian_avatar['image_url']) {
                $Silian_avatar['image_url'] = $Silian_avatar['icon_url'] ?? $Silian_filePath;
            }
            if (!isset($Silian_avatar['url']) || !$Silian_avatar['url']) {
                $Silian_avatar['url'] = $Silian_avatar['icon_url'] ?? ($Silian_avatar['image_url'] ?? $Silian_filePath);
            }
        }

        $Silian_thumbnailPath = $Silian_avatar['thumbnail_path'] ?? null;
        if ($Silian_thumbnailPath) {
            $Silian_normalizedThumb = ltrim((string)$Silian_thumbnailPath, '/');
            if ($this->r2Service) {
                try {
                    $Silian_avatar['thumbnail_url'] = $this->r2Service->getPublicUrl($Silian_normalizedThumb);
                } catch (\Throwable $Silian_e) {
                    if ($this->logger) {
                        $this->logger->warning('Failed to build avatar thumbnail URL', [
                            'error' => $Silian_e->getMessage(),
                            'file_path' => $Silian_normalizedThumb
                        ]);
                    }
                }
            }
        }

        return $Silian_avatar;
    }

    /**
     * 返回JSON响应
     */
    private function jsonResponse(Response $Silian_response, array $Silian_data, int $Silian_status = 200): Response
    {
        $Silian_response->getBody()->write(json_encode($Silian_data, JSON_UNESCAPED_UNICODE));
        return $Silian_response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($Silian_status);
    }

    /**
     * @param mixed $payload
     * @return array<string,mixed>
     */
    private function normalizeAvatarPayload(mixed $Silian_payload): array
    {
        if (!is_array($Silian_payload)) {
            throw new \InvalidArgumentException(self::ERR_INVALID_REQUEST_BODY);
        }

        foreach (['is_active', 'is_default'] as $Silian_field) {
            if (array_key_exists($Silian_field, $Silian_payload)) {
                $Silian_payload[$Silian_field] = InputValueNormalizer::boolean($Silian_payload[$Silian_field], $Silian_field);
            }
        }

        if (array_key_exists('sort_order', $Silian_payload)) {
            $Silian_payload['sort_order'] = InputValueNormalizer::integer($Silian_payload['sort_order'], 'sort_order');
        }

        return $Silian_payload;
    }

    private function avatarValidationErrorCode(\InvalidArgumentException $Silian_exception): string
    {
        if ($Silian_exception->getMessage() === self::ERR_INVALID_REQUEST_BODY) {
            return 'INVALID_REQUEST_BODY';
        }

        return 'VALIDATION_ERROR';
    }

    private function avatarStorageUnavailableResponse(Response $Silian_response): Response
    {
        if ($this->logger !== null) {
            $this->logger->error('Avatar storage service is unavailable');
        }

        return $this->jsonResponse($Silian_response, [
            'success' => false,
            'message' => 'Avatar storage service is unavailable',
            'code' => 'AVATAR_STORAGE_UNAVAILABLE',
        ], 503);
    }

    /**
     * Default avatars must remain active, otherwise downstream fallback selection breaks.
     *
     * @param array<string,mixed> $payload
     * @param array<string,mixed>|null $existingAvatar
     */
    private function assertDefaultAvatarStateIsValid(array $Silian_payload, ?array $Silian_existingAvatar = null): void
    {
        $Silian_wasDefault = $this->normalizeBooleanValue($Silian_existingAvatar['is_default'] ?? false);

        $Silian_isDefault = array_key_exists('is_default', $Silian_payload)
            ? (bool) $Silian_payload['is_default']
            : $Silian_wasDefault;

        $Silian_isActive = array_key_exists('is_active', $Silian_payload)
            ? (bool) $Silian_payload['is_active']
            : $this->normalizeBooleanValue($Silian_existingAvatar['is_active'] ?? true);

        if (($Silian_isDefault || $Silian_wasDefault) && !$Silian_isActive) {
            throw new \InvalidArgumentException('Default avatar must remain active');
        }
    }

    private function normalizeBooleanValue(mixed $Silian_value): bool
    {
        $Silian_normalized = filter_var($Silian_value, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        return $Silian_normalized ?? ((int) $Silian_value === 1);
    }

    /**
     * @param array<int, array{id:int, username:?string, email:?string}> $affectedUsers
     * @param array<string,mixed> $avatar
     * @param array<string,mixed> $fallbackAvatar
     * @return array{notified_count:int,failed_user_ids:array<int,int>}
     */
    private function notifyUsersAboutAvatarFallback(
        array $Silian_affectedUsers,
        array $Silian_avatar,
        array $Silian_fallbackAvatar,
        Request $Silian_request
    ): array {
        if ($this->messageService === null) {
            return [
                'notified_count' => 0,
                'failed_user_ids' => array_map(
                    static fn (array $Silian_entry): int => (int) ($Silian_entry['id'] ?? 0),
                    $Silian_affectedUsers
                ),
            ];
        }

        $Silian_oldAvatarName = trim((string) ($Silian_avatar['name'] ?? ''));
        $Silian_fallbackAvatarName = trim((string) ($Silian_fallbackAvatar['name'] ?? ''));
        $Silian_oldAvatarLabel = $Silian_oldAvatarName !== '' ? $Silian_oldAvatarName : '已停用头像';
        $Silian_fallbackAvatarLabel = $Silian_fallbackAvatarName !== '' ? $Silian_fallbackAvatarName : '默认头像';

        $Silian_title = '您选择的头像已停用 / Selected avatar unavailable';
        $Silian_content = sprintf(
            "您当前使用的头像“%s”已被停用，系统已自动为您切换为默认头像“%s”。\n\n如需调整，请前往个人资料重新选择头像。\n\nThe avatar \"%s\" you selected has been disabled. CarbonTrack has automatically switched your profile to the default avatar \"%s\". You can choose a different avatar anytime from your profile.",
            $Silian_oldAvatarLabel,
            $Silian_fallbackAvatarLabel,
            $Silian_oldAvatarLabel,
            $Silian_fallbackAvatarLabel
        );

        $Silian_notifiedCount = 0;
        $Silian_failedUserIds = [];

        foreach ($Silian_affectedUsers as $Silian_recipient) {
            $Silian_userId = (int) ($Silian_recipient['id'] ?? 0);
            if ($Silian_userId <= 0) {
                continue;
            }

            try {
                $this->messageService->sendSystemMessage(
                    $Silian_userId,
                    $Silian_title,
                    $Silian_content,
                    Message::TYPE_NOTIFICATION,
                    Message::PRIORITY_NORMAL,
                    'avatar',
                    (int) ($Silian_avatar['id'] ?? 0),
                    true
                );
                $Silian_notifiedCount++;
            } catch (\Throwable $Silian_e) {
                $Silian_failedUserIds[] = $Silian_userId;
                if ($this->errorLogService !== null) {
                    try {
                        $this->errorLogService->logException($Silian_e, $Silian_request, [
                            'action' => 'avatar_fallback_notification_failed',
                            'avatar_id' => $Silian_avatar['id'] ?? null,
                            'fallback_avatar_id' => $Silian_fallbackAvatar['id'] ?? null,
                            'recipient_user_id' => $Silian_userId,
                        ]);
                    } catch (\Throwable $Silian_ignore) {
                    }
                }

                if ($this->logger !== null) {
                    $this->logger->warning('Failed to notify user about avatar fallback', [
                        'avatar_id' => $Silian_avatar['id'] ?? null,
                        'fallback_avatar_id' => $Silian_fallbackAvatar['id'] ?? null,
                        'recipient_user_id' => $Silian_userId,
                        'error' => $Silian_e->getMessage(),
                    ]);
                }
            }
        }

        return [
            'notified_count' => $Silian_notifiedCount,
            'failed_user_ids' => $Silian_failedUserIds,
        ];
    }
}

