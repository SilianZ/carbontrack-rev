<?php

declare(strict_types=1);

namespace CarbonTrack\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use CarbonTrack\Services\CloudflareR2Service;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\FileMetadataService;
use CarbonTrack\Services\FileOwnershipConflictException;
use CarbonTrack\Services\MultipartUploadService;
use Monolog\Logger;
use CarbonTrack\Models\File;

class FileUploadController
{
    private CloudflareR2Service $r2Service;
    private AuthService $authService;
    private AuditLogService $auditLogService;
    private Logger $logger;
    private ErrorLogService $errorLogService;
    private FileMetadataService $fileMetadataService;
    private MultipartUploadService $multipartUploadService;

    public function __construct(
        CloudflareR2Service $Silian_r2Service,
        AuthService $Silian_authService,
        AuditLogService $Silian_auditLogService,
        Logger $Silian_logger,
    ErrorLogService $Silian_errorLogService,
    FileMetadataService $Silian_fileMetadataService,
    MultipartUploadService $Silian_multipartUploadService
    ) {
        $this->r2Service = $Silian_r2Service;
        $this->authService = $Silian_authService;
        $this->auditLogService = $Silian_auditLogService;
        $this->logger = $Silian_logger;
        $this->errorLogService = $Silian_errorLogService;
    $this->fileMetadataService = $Silian_fileMetadataService;
    $this->multipartUploadService = $Silian_multipartUploadService;
    }

    /**
     * 获取前端直传预签名（生成对象 key + 预签名 PUT URL）
     * 前端步骤：
     * 1. POST /api/v1/files/presign {original_name, directory, mime_type, entity_type, entity_id}
     * 2. 使用返回的 url, headers 用 PUT 上传文件二进制
     * 3. 可选：调用 confirm 接口通知后端记录（若需要 DB 记录）
     */
    public function getDirectUploadPresign(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Unauthorized'], 401);
            }

            $Silian_body = $Silian_request->getParsedBody() ?: [];
            $Silian_originalName = trim($Silian_body['original_name'] ?? '');
            $Silian_directory = $Silian_body['directory'] ?? 'uploads';
            $Silian_mimeType = trim($Silian_body['mime_type'] ?? '');
            $Silian_fileSize = isset($Silian_body['file_size']) ? (int)$Silian_body['file_size'] : null; // 前端声明的大小
            $Silian_sha256 = isset($Silian_body['sha256']) ? strtolower(trim($Silian_body['sha256'])) : null;
            $Silian_entityType = $Silian_body['entity_type'] ?? null;
            $Silian_entityId = isset($Silian_body['entity_id']) ? (int)$Silian_body['entity_id'] : null;
            $Silian_expiresIn = isset($Silian_body['expires_in']) ? (int)$Silian_body['expires_in'] : 600;

            if ($Silian_originalName === '' || $Silian_mimeType === '') {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'original_name and mime_type are required'
                ], 400);
            }

            if (!$this->isValidDirectory($Silian_directory)) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Invalid directory name'
                ], 400);
            }

            // 校验 MIME & 扩展
            $Silian_allowedMime = $this->r2Service->getAllowedMimeTypes();
            if (!in_array($Silian_mimeType, $Silian_allowedMime, true)) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'MIME type not allowed'
                ], 400);
            }
            $Silian_extension = strtolower(pathinfo($Silian_originalName, PATHINFO_EXTENSION));
            if (!in_array($Silian_extension, $this->r2Service->getAllowedExtensions(), true)) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'File extension not allowed'
                ], 400);
            }

            // 文件大小预校验
            if ($Silian_fileSize !== null && $Silian_fileSize > $this->r2Service->getMaxFileSize()) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'File size exceeds limit'
                ], 400);
            }

            // 校验 sha256 格式（64 hex）
            if ($Silian_sha256 && !preg_match('/^[a-f0-9]{64}$/', $Silian_sha256)) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Invalid sha256'
                ], 400);
            }

            // 去重：仅允许当前用户复用自己已持有的 sha256 记录，避免泄露其他用户文件元数据。
            if ($Silian_sha256) {
                $Silian_existing = $this->fileMetadataService->findBySha256($Silian_sha256);
                if ($Silian_existing && $this->isOwnedFileRecord($Silian_existing, (int) $Silian_user['id'])) {
                    return $this->jsonResponse($Silian_response, [
                        'success' => true,
                        'data' => [
                            'duplicate' => true,
                            'file_path' => $Silian_existing->file_path,
                            'public_url' => $this->r2Service->getPublicUrl($Silian_existing->file_path),
                            'sha256' => $Silian_sha256,
                            'reference_count' => $Silian_existing->reference_count,
                            'stored' => true
                        ]
                    ]);
                }
            }

            // 生成对象 key 与预签名
            $Silian_keyInfo = $this->r2Service->generateDirectUploadKey($Silian_originalName, $Silian_directory);
            $Silian_presign = $this->r2Service->generateUploadPresignedUrl(
                $Silian_keyInfo['file_path'],
                $Silian_mimeType,
                $Silian_expiresIn,
                $this->buildDirectUploadMetadata($Silian_user, $Silian_entityType, $Silian_entityId)
            );

            $Silian_data = array_merge($Silian_keyInfo, $Silian_presign, [
                'max_file_size' => $this->r2Service->getMaxFileSize(),
                'entity_type' => $Silian_entityType,
                'entity_id' => $Silian_entityId,
                'confirm_required' => true,
                'sha256' => $Silian_sha256,
                'declared_file_size' => $Silian_fileSize,
                'duplicate' => false
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => $Silian_data
            ]);
        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { $this->logger->error('ErrorLogService failed: ' . $Silian_ignore->getMessage()); }
            $this->logger->error('Generate direct upload presign failed', ['error' => $Silian_e->getMessage()]);
            return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Failed to generate presign'], 500);
        }
    }

    /**
     * 前端直传完成后确认（可用于记录审计日志/数据库 metadata）
     * 请求体：{ file_path, original_name, entity_type?, entity_id? }
     */
    public function confirmDirectUpload(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Unauthorized'], 401);
            }
            $Silian_body = $Silian_request->getParsedBody() ?: [];
            $Silian_filePath = trim($Silian_body['file_path'] ?? '');
            $Silian_originalName = trim($Silian_body['original_name'] ?? '');
            $Silian_entityType = $Silian_body['entity_type'] ?? null;
            $Silian_entityId = isset($Silian_body['entity_id']) ? (int)$Silian_body['entity_id'] : null;
            $Silian_sha256 = isset($Silian_body['sha256']) ? strtolower(trim($Silian_body['sha256'])) : null;

            if ($Silian_sha256 && !preg_match('/^[a-f0-9]{64}$/', $Silian_sha256)) {
                return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Invalid sha256'], 400);
            }

            if ($Silian_filePath === '' || $Silian_originalName === '') {
                return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'file_path and original_name are required'], 400);
            }

            // 初次获取对象信息
            $Silian_info = $this->r2Service->getFileInfo($Silian_filePath);
            if (!$Silian_info) {
                // 可能为 R2 写入后延迟可见，等待再试一次
                usleep(250000); // 250ms
                $Silian_info = $this->r2Service->getFileInfo($Silian_filePath);
            }
            // 若仍未找到，尝试检测是否因为 endpoint 误包含 bucket 造成 key 实际被写成 bucketName/xxx
            if (!$Silian_info) {
                $Silian_altPath = $this->r2Service->getBucketName() . '/' . ltrim($Silian_filePath, '/');
                $Silian_altInfo = $this->r2Service->getFileInfo($Silian_altPath);
                if ($Silian_altInfo) {
                    $this->logger->warning('File found only under bucketName-prefixed key; endpoint may include bucket path (misconfiguration).', [
                        'expected_file_path' => $Silian_filePath,
                        'actual_file_path' => $Silian_altPath,
                        'user_id' => $Silian_user['id']
                    ]);
                    // 改用实际信息，但返回时仍提示
                    $Silian_info = $Silian_altInfo;
                }
            }
            if (!$Silian_info) {
                $this->logger->warning('Confirm direct upload: file not yet visible in R2', [
                    'file_path' => $Silian_filePath,
                    'user_id' => $Silian_user['id']
                ]);
                return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'File not found in storage'], 404);
            }

            // 持久化元数据（如果 sha256 提供，则去重引用计数）
            ['file' => $Silian_fileRecord, 'duplicate' => $Silian_duplicated] = $this->persistDirectUploadOwnership(
                $Silian_filePath,
                (int) $Silian_user['id'],
                $Silian_originalName,
                $Silian_info,
                $Silian_sha256
            );

            // 记录审计日志
            $this->r2Service->logDirectUploadAudit($Silian_user['id'], $Silian_entityType, $Silian_entityId, $Silian_info, $Silian_originalName);

            $Silian_payload = $Silian_info;
            if ($Silian_fileRecord) {
                $Silian_payload['reference_count'] = $Silian_fileRecord->reference_count;
                $Silian_payload['sha256'] = $Silian_fileRecord->sha256 ?: null;
                $Silian_payload['duplicate'] = $Silian_duplicated;
            }

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'message' => 'Upload confirmed',
                'data' => $Silian_payload
            ]);
        } catch (FileOwnershipConflictException $Silian_e) {
            $this->auditLogService->log([
                'user_id' => isset($Silian_user['id']) ? (int) $Silian_user['id'] : null,
                'action' => 'direct_upload_confirmed',
                'operation_category' => 'file_management',
                'affected_table' => 'files',
                'status' => 'failed',
                'data' => [
                    'file_path' => $Silian_body['file_path'] ?? null,
                    'error' => $Silian_e->getMessage(),
                    'error_code' => 'FILE_OWNERSHIP_CONFLICT',
                ],
            ]);
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'File ownership conflict detected',
                'code' => 'FILE_OWNERSHIP_CONFLICT'
            ], 409);
        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { $this->logger->error('ErrorLogService failed: ' . $Silian_ignore->getMessage()); }
            $this->logger->error('Confirm direct upload failed', ['error' => $Silian_e->getMessage()]);
            return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Failed to confirm upload'], 500);
        }
    }

    /**
     * 上传单个文件
     */
    public function uploadFile(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            // 验证用户身份
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 401);
            }

            // 获取上传的文件
            $Silian_uploadedFiles = $Silian_request->getUploadedFiles();
            if (empty($Silian_uploadedFiles['file'])) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'No file uploaded'
                ], 400);
            }

            $Silian_file = $Silian_uploadedFiles['file'];

            // 获取请求参数
            $Silian_body = $Silian_request->getParsedBody();
            $Silian_directory = $Silian_body['directory'] ?? 'uploads';
            $Silian_entityType = $Silian_body['entity_type'] ?? null;
            $Silian_entityId = isset($Silian_body['entity_id']) ? (int)$Silian_body['entity_id'] : null;

            // 验证目录名
            if (!$this->isValidDirectory($Silian_directory)) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Invalid directory name'
                ], 400);
            }

            // 上传文件
            $Silian_result = $this->r2Service->uploadFile(
                $Silian_file,
                $Silian_directory,
                $Silian_user['id'],
                $Silian_entityType,
                $Silian_entityId
            );

            $this->logger->info('File uploaded successfully', [
                'user_id' => $Silian_user['id'],
                'file_path' => $Silian_result['file_path'],
                'entity_type' => $Silian_entityType,
                'entity_id' => $Silian_entityId
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'message' => 'File uploaded successfully',
                'data' => $Silian_result
            ]);

        } catch (\InvalidArgumentException $Silian_e) {
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => $Silian_e->getMessage()
            ], 400);

        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { $this->logger->error('ErrorLogService failed: ' . $Silian_ignore->getMessage()); }
            $this->logger->error('File upload failed', [
                'error' => $Silian_e->getMessage(),
                'trace' => $Silian_e->getTraceAsString()
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'File upload failed'
            ], 500);
        }
    }

    /**
     * 上传多个文件
     */
    public function uploadMultipleFiles(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            // 验证用户身份
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 401);
            }

            // 获取上传的文件
            $Silian_uploadedFiles = $Silian_request->getUploadedFiles();
            if (empty($Silian_uploadedFiles['files']) || !is_array($Silian_uploadedFiles['files'])) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'No files uploaded'
                ], 400);
            }

            $Silian_files = $Silian_uploadedFiles['files'];

            // 获取请求参数
            $Silian_body = $Silian_request->getParsedBody();
            $Silian_directory = $Silian_body['directory'] ?? 'uploads';
            $Silian_entityType = $Silian_body['entity_type'] ?? null;
            $Silian_entityId = isset($Silian_body['entity_id']) ? (int)$Silian_body['entity_id'] : null;

            // 验证目录名
            if (!$this->isValidDirectory($Silian_directory)) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Invalid directory name'
                ], 400);
            }

            // 限制文件数量
            if (count($Silian_files) > 10) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Too many files. Maximum 10 files allowed'
                ], 400);
            }

            // 批量上传文件
            $Silian_result = $this->r2Service->uploadMultipleFiles(
                $Silian_files,
                $Silian_directory,
                $Silian_user['id'],
                $Silian_entityType,
                $Silian_entityId
            );

            $this->logger->info('Multiple files uploaded', [
                'user_id' => $Silian_user['id'],
                'success_count' => $Silian_result['success'],
                'failed_count' => $Silian_result['failed'],
                'entity_type' => $Silian_entityType,
                'entity_id' => $Silian_entityId
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'message' => "Uploaded {$Silian_result['success']} files successfully" .
                           ($Silian_result['failed'] > 0 ? ", {$Silian_result['failed']} failed" : ""),
                'data' => $Silian_result
            ]);

        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { $this->logger->error('ErrorLogService failed: ' . $Silian_ignore->getMessage()); }
            $this->logger->error('Multiple file upload failed', [
                'error' => $Silian_e->getMessage(),
                'trace' => $Silian_e->getTraceAsString()
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'File upload failed'
            ], 500);
        }
    }

    /**
     * 删除文件
     */
    public function deleteFile(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            // 验证用户身份
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 401);
            }

            $Silian_filePath = $Silian_args['path'] ?? '';
            if (empty($Silian_filePath)) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'File path is required'
                ], 400);
            }

            // URL解码文件路径
            $Silian_filePath = urldecode($Silian_filePath);

            $Silian_fileInfo = $this->r2Service->getFileInfo($Silian_filePath);
            if (!$Silian_fileInfo) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'File not found'
                ], 404);
            }

            if (!$this->canDeleteFile($Silian_user, $Silian_filePath, $Silian_fileInfo)) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'You do not have permission to delete this file',
                    'code' => 'FILE_ACCESS_DENIED'
                ], 403);
            }

            // 删除文件
            $Silian_success = $this->r2Service->deleteFile($Silian_filePath, $Silian_user['id']);

            if ($Silian_success) {
                return $this->jsonResponse($Silian_response, [
                    'success' => true,
                    'message' => 'File deleted successfully'
                ]);
            } else {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Failed to delete file'
                ], 500);
            }

        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { $this->logger->error('ErrorLogService failed: ' . $Silian_ignore->getMessage()); }
            $this->logger->error('File deletion failed', [
                'error' => $Silian_e->getMessage(),
                'file_path' => $Silian_args['path'] ?? '',
                'trace' => $Silian_e->getTraceAsString()
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'File deletion failed'
            ], 500);
        }
    }

    /**
     * 获取文件信息
     */
    public function getFileInfo(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            // 验证用户身份
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 401);
            }

            $Silian_filePath = $Silian_args['path'] ?? '';
            if (empty($Silian_filePath)) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'File path is required'
                ], 400);
            }

            // URL解码文件路径
            $Silian_filePath = urldecode($Silian_filePath);

            // 获取文件信息
            $Silian_fileInfo = $this->r2Service->getFileInfo($Silian_filePath);

            if (!$Silian_fileInfo) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'File not found'
                ], 404);
            }

            if (!$this->canReadFile($Silian_user, $Silian_filePath, $Silian_fileInfo)) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'You do not have permission to access this file',
                    'code' => 'FILE_ACCESS_DENIED'
                ], 403);
            }

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => $Silian_fileInfo
            ]);

        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { $this->logger->error('ErrorLogService failed: ' . $Silian_ignore->getMessage()); }
            $this->logger->error('Get file info failed', [
                'error' => $Silian_e->getMessage(),
                'file_path' => $Silian_args['path'] ?? '',
                'trace' => $Silian_e->getTraceAsString()
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to get file info'
            ], 500);
        }
    }

    /**
     * 生成预签名URL
     */
    public function generatePresignedUrl(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            // 验证用户身份
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Unauthorized'
                ], 401);
            }

            $Silian_filePath = $Silian_args['path'] ?? '';
            if (empty($Silian_filePath)) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'File path is required'
                ], 400);
            }

            // URL解码文件路径
            $Silian_filePath = urldecode($Silian_filePath);

            $Silian_fileInfo = $this->r2Service->getFileInfo($Silian_filePath);
            if (!$Silian_fileInfo) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'File not found'
                ], 404);
            }

            if (!$this->canReadFile($Silian_user, $Silian_filePath, $Silian_fileInfo)) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'You do not have permission to access this file',
                    'code' => 'FILE_ACCESS_DENIED'
                ], 403);
            }

            // 获取过期时间（默认10分钟）
            $Silian_queryParams = $Silian_request->getQueryParams();
            $Silian_expiresIn = isset($Silian_queryParams['expires_in']) ? (int)$Silian_queryParams['expires_in'] : 600;

            // 限制过期时间（最大24小时）
            $Silian_expiresIn = min($Silian_expiresIn, 86400);

            // 生成预签名URL
            $Silian_presignedUrl = $this->r2Service->generatePresignedUrl($Silian_filePath, $Silian_expiresIn);

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => [
                    'presigned_url' => $Silian_presignedUrl,
                    'expires_in' => $Silian_expiresIn,
                    'expires_at' => date('Y-m-d H:i:s', time() + $Silian_expiresIn)
                ]
            ]);

        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { $this->logger->error('ErrorLogService failed: ' . $Silian_ignore->getMessage()); }
            $this->logger->error('Generate presigned URL failed', [
                'error' => $Silian_e->getMessage(),
                'file_path' => $Silian_args['path'] ?? '',
                'trace' => $Silian_e->getTraceAsString()
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to generate presigned URL'
            ], 500);
        }
    }

    /**
     * 获取存储统计信息（管理员）
     */
    public function getStorageStats(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            // 验证管理员身份
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$Silian_user['is_admin']) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Admin access required'
                ], 403);
            }

            // 获取存储统计信息
            $Silian_stats = $this->r2Service->getStorageStats();

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => $Silian_stats
            ]);

        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { $this->logger->error('ErrorLogService failed: ' . $Silian_ignore->getMessage()); }
            $this->logger->error('Get storage stats failed', [
                'error' => $Silian_e->getMessage(),
                'trace' => $Silian_e->getTraceAsString()
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to get storage stats'
            ], 500);
        }
    }

    /**
     * 清理过期文件（管理员）
     */
    public function cleanupExpiredFiles(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            // 验证管理员身份
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$Silian_user['is_admin']) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Admin access required'
                ], 403);
            }

            $Silian_body = $Silian_request->getParsedBody();
            $Silian_directory = $Silian_body['directory'] ?? 'temp';
            $Silian_daysOld = isset($Silian_body['days_old']) ? (int)$Silian_body['days_old'] : 7;

            // 限制天数范围
            $Silian_daysOld = max(1, min($Silian_daysOld, 365));

            // 清理过期文件
            $Silian_deletedCount = $this->r2Service->cleanupExpiredFiles($Silian_directory, $Silian_daysOld);

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'message' => "Cleaned up {$Silian_deletedCount} expired files",
                'data' => [
                    'deleted_count' => $Silian_deletedCount,
                    'directory' => $Silian_directory,
                    'days_old' => $Silian_daysOld
                ]
            ]);

        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { $this->logger->error('ErrorLogService failed: ' . $Silian_ignore->getMessage()); }
            $this->logger->error('Cleanup expired files failed', [
                'error' => $Silian_e->getMessage(),
                'trace' => $Silian_e->getTraceAsString()
            ]);

            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to cleanup expired files'
            ], 500);
        }
    }

    /**
     * 列出文件（管理员） /api/v1/admin/files 已在路由引用 getFilesList
     */
    public function getFilesList(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$Silian_user['is_admin']) {
                return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Admin access required'], 403);
            }
            $Silian_query = $Silian_request->getQueryParams();
            $Silian_prefix = $Silian_query['prefix'] ?? null;
            $Silian_limit = isset($Silian_query['limit']) ? (int)$Silian_query['limit'] : 100;
            $Silian_list = $this->r2Service->listFiles($Silian_prefix, $Silian_limit);
            return $this->jsonResponse($Silian_response, $Silian_list, $Silian_list['success'] ? 200 : 500);
        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { $this->logger->error('ErrorLogService failed: ' . $Silian_ignore->getMessage()); }
            return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Failed to list files'], 500);
        }
    }

    /**
     * 初始化分片上传
     */
    public function initMultipartUpload(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Unauthorized'], 401);
            }
            $Silian_body = $Silian_request->getParsedBody() ?: [];
            $Silian_originalName = trim($Silian_body['original_name'] ?? '');
            $Silian_directory = $Silian_body['directory'] ?? 'uploads';
            $Silian_mimeType = trim($Silian_body['mime_type'] ?? 'application/octet-stream');
            $Silian_sha256 = isset($Silian_body['sha256']) ? strtolower(trim($Silian_body['sha256'])) : null;
            if ($Silian_originalName === '' || !$this->isValidDirectory($Silian_directory)) {
                return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Invalid params'], 400);
            }
            if (!$Silian_sha256 || !preg_match('/^[a-f0-9]{64}$/', $Silian_sha256)) {
                return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Invalid sha256'], 400);
            }
            if (!in_array($Silian_mimeType, $this->r2Service->getAllowedMimeTypes(), true)) {
                return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'MIME type not allowed'], 400);
            }
            $Silian_init = $this->r2Service->initMultipartUpload($Silian_originalName, $Silian_directory, $Silian_mimeType);
            $this->multipartUploadService->registerUpload(
                $Silian_init['upload_id'],
                $Silian_init['file_path'],
                (int) $Silian_user['id'],
                $Silian_sha256
            );
            return $this->jsonResponse($Silian_response, ['success' => true, 'data' => $Silian_init]);
        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { $this->logger->error('ErrorLogService failed: ' . $Silian_ignore->getMessage()); }
            return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Failed to init multipart'], 500);
        }
    }

    /**
     * 获取单个分片的预签名上传 URL
     */
    public function getMultipartPartUrl(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Unauthorized'], 401);
            }
            $Silian_query = $Silian_request->getQueryParams();
            $Silian_filePath = $Silian_query['file_path'] ?? '';
            $Silian_uploadId = $Silian_query['upload_id'] ?? '';
            $Silian_partNumber = isset($Silian_query['part_number']) ? (int)$Silian_query['part_number'] : 0;
            if ($Silian_filePath === '' || $Silian_uploadId === '' || $Silian_partNumber < 1) {
                return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Invalid params'], 400);
            }
            $Silian_multipartError = $this->authorizeMultipartUpload($Silian_response, $Silian_user, $Silian_uploadId, $Silian_filePath);
            if ($Silian_multipartError instanceof Response) {
                return $Silian_multipartError;
            }
            $Silian_part = $this->r2Service->generateMultipartPartUrl($Silian_filePath, $Silian_uploadId, $Silian_partNumber);
            return $this->jsonResponse($Silian_response, ['success' => true, 'data' => $Silian_part]);
        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { $this->logger->error('ErrorLogService failed: ' . $Silian_ignore->getMessage()); }
            return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Failed to get part url'], 500);
        }
    }

    /**
     * 完成分片上传
     */
    public function completeMultipartUpload(Request $Silian_request, Response $Silian_response): Response
    {
        $Silian_user = null;
        $Silian_body = [];
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Unauthorized'], 401);
            }
            $Silian_body = $Silian_request->getParsedBody() ?: [];
            $Silian_filePath = $Silian_body['file_path'] ?? '';
            $Silian_uploadId = $Silian_body['upload_id'] ?? '';
            $Silian_parts = $Silian_body['parts'] ?? [];
            $Silian_sha256 = isset($Silian_body['sha256']) ? strtolower(trim($Silian_body['sha256'])) : null;
            if ($Silian_filePath === '' || $Silian_uploadId === '' || !is_array($Silian_parts) || empty($Silian_parts)) {
                return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Invalid params'], 400);
            }
            $Silian_multipartError = $this->authorizeMultipartUpload($Silian_response, $Silian_user, $Silian_uploadId, $Silian_filePath);
            if ($Silian_multipartError instanceof Response) {
                return $Silian_multipartError;
            }
            $Silian_upload = $this->multipartUploadService->findActiveUpload($Silian_uploadId);
            $Silian_effectiveSha256 = $Silian_upload && !empty($Silian_upload->sha256) ? strtolower((string) $Silian_upload->sha256) : $Silian_sha256;
            if (!$Silian_effectiveSha256 || !preg_match('/^[a-f0-9]{64}$/', $Silian_effectiveSha256)) {
                if (!$this->fileMetadataService->findByFilePath($Silian_filePath)) {
                    return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Invalid sha256'], 400);
                }
                $Silian_effectiveSha256 = null;
            }
            $Silian_result = $this->r2Service->completeMultipartUpload($Silian_filePath, $Silian_uploadId, $Silian_parts);
            $Silian_fileInfo = $this->r2Service->getFileInfo($Silian_filePath);
            $Silian_ownershipPersisted = false;
            try {
                $Silian_ownershipPersisted = $this->persistMultipartOwnership($Silian_filePath, (int) $Silian_user['id'], $Silian_fileInfo, $Silian_effectiveSha256);
            } finally {
                $this->multipartUploadService->clearUpload($Silian_uploadId);
            }

            $this->auditLogService->log([
                'user_id' => (int) $Silian_user['id'],
                'action' => 'multipart_upload_completed',
                'operation_category' => 'file_management',
                'affected_table' => 'files',
                'status' => 'success',
                'data' => [
                    'upload_id' => $Silian_uploadId,
                    'file_path' => $Silian_filePath,
                    'ownership_persisted' => $Silian_ownershipPersisted,
                ],
            ]);

            $Silian_result['ownership_persisted'] = $Silian_ownershipPersisted;

            return $this->jsonResponse($Silian_response, ['success' => true, 'data' => $Silian_result]);
        } catch (FileOwnershipConflictException $Silian_e) {
            $Silian_userId = isset($Silian_user['id']) ? (int) $Silian_user['id'] : null;
            $this->auditLogService->log([
                'user_id' => $Silian_userId,
                'action' => 'multipart_upload_completed',
                'operation_category' => 'file_management',
                'affected_table' => 'files',
                'status' => 'failed',
                'data' => [
                    'file_path' => $Silian_body['file_path'] ?? null,
                    'upload_id' => $Silian_body['upload_id'] ?? null,
                    'error' => $Silian_e->getMessage(),
                    'error_code' => 'FILE_OWNERSHIP_CONFLICT',
                ],
            ]);
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'File ownership conflict detected',
                'code' => 'FILE_OWNERSHIP_CONFLICT'
            ], 409);
        } catch (\Exception $Silian_e) {
            $Silian_userId = isset($Silian_user['id']) ? (int) $Silian_user['id'] : null;
            $this->auditLogService->log([
                'user_id' => $Silian_userId,
                'action' => 'multipart_upload_completed',
                'operation_category' => 'file_management',
                'affected_table' => 'files',
                'status' => 'failed',
                'data' => [
                    'file_path' => $Silian_body['file_path'] ?? null,
                    'upload_id' => $Silian_body['upload_id'] ?? null,
                    'error' => $Silian_e->getMessage(),
                ],
            ]);
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { $this->logger->error('ErrorLogService failed: ' . $Silian_ignore->getMessage()); }
            return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Failed to complete multipart'], 500);
        }
    }

    /**
     * 取消分片上传
     */
    public function abortMultipartUpload(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Unauthorized'], 401);
            }
            $Silian_body = $Silian_request->getParsedBody() ?: [];
            $Silian_filePath = $Silian_body['file_path'] ?? '';
            $Silian_uploadId = $Silian_body['upload_id'] ?? '';
            if ($Silian_filePath === '' || $Silian_uploadId === '') {
                return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Invalid params'], 400);
            }
            $Silian_multipartError = $this->authorizeMultipartUpload($Silian_response, $Silian_user, $Silian_uploadId, $Silian_filePath);
            if ($Silian_multipartError instanceof Response) {
                return $Silian_multipartError;
            }
            $Silian_ok = $this->r2Service->abortMultipartUpload($Silian_filePath, $Silian_uploadId);
            if ($Silian_ok) {
                $this->multipartUploadService->clearUpload($Silian_uploadId);
            }
            return $this->jsonResponse($Silian_response, ['success' => $Silian_ok, 'message' => $Silian_ok ? 'Aborted' : 'Abort failed']);
        } catch (\Exception $Silian_e) {
            try { $this->errorLogService->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { $this->logger->error('ErrorLogService failed: ' . $Silian_ignore->getMessage()); }
            return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Failed to abort multipart'], 500);
        }
    }

    /**
     * 验证目录名是否有效
     */

    private function isValidDirectory(string $Silian_directory): bool
    {
        // 允许的根目录名称（可附带子目录段）
        $Silian_allowedRoots = [
            'uploads',
            'avatars',
            'activities',
            'products',
            'badges',
            'support-tickets',
            'temp',
            'documents'
        ];

        $Silian_normalized = trim($Silian_directory);
        if ($Silian_normalized === '') {
            return false;
        }

        $Silian_normalized = trim($Silian_normalized, " /\t\n\r\0\x0B");
        if ($Silian_normalized === '') {
            return false;
        }

        $Silian_segments = explode('/', $Silian_normalized);
        $Silian_root = array_shift($Silian_segments);

        if (!in_array($Silian_root, $Silian_allowedRoots, true)) {
            return false;
        }

        foreach ($Silian_segments as $Silian_segment) {
            if ($Silian_segment === '' || !preg_match('/^[A-Za-z0-9_-]+$/', $Silian_segment)) {
                return false;
            }
        }

        return true;
    }

    private function canReadFile(array $Silian_user, string $Silian_filePath, ?array $Silian_fileInfo = null): bool
    {
        if ($this->isAdminUser($Silian_user) || $this->fileMetadataService->isPubliclyReadablePath($Silian_filePath)) {
            return true;
        }

        return $this->isFileOwner($Silian_user, $Silian_filePath, $Silian_fileInfo);
    }

    private function canDeleteFile(array $Silian_user, string $Silian_filePath, ?array $Silian_fileInfo = null): bool
    {
        if ($this->isAdminUser($Silian_user)) {
            return true;
        }

        return $this->isFileOwner($Silian_user, $Silian_filePath, $Silian_fileInfo);
    }

    private function isFileOwner(array $Silian_user, string $Silian_filePath, ?array $Silian_fileInfo = null): bool
    {
        $Silian_userId = isset($Silian_user['id']) ? (int) $Silian_user['id'] : 0;
        if ($Silian_userId <= 0) {
            return false;
        }

        $Silian_fileRecord = $this->fileMetadataService->findByFilePath($Silian_filePath);
        if ($Silian_fileRecord && (int) ($Silian_fileRecord->user_id ?? 0) === $Silian_userId) {
            return true;
        }

        $Silian_fileInfo ??= $this->r2Service->getFileInfo($Silian_filePath);
        $Silian_ownerId = (int) ($Silian_fileInfo['metadata']['uploaded_by'] ?? 0);

        return $Silian_ownerId > 0 && $Silian_ownerId === $Silian_userId;
    }

    private function isAdminUser(array $Silian_user): bool
    {
        return !empty($Silian_user['is_admin']);
    }

    private function buildDirectUploadMetadata(array $Silian_user, ?string $Silian_entityType, ?int $Silian_entityId): array
    {
        return [
            'uploaded_by' => (string) ((int) ($Silian_user['id'] ?? 0)),
            'entity_type' => $Silian_entityType ?: 'unknown',
            'entity_id' => $Silian_entityId !== null ? (string) $Silian_entityId : '',
            'upload_time' => date('Y-m-d H:i:s'),
        ];
    }

    private function isOwnedFileRecord(File $Silian_fileRecord, int $Silian_userId): bool
    {
        $Silian_existingOwnerId = (int) ($Silian_fileRecord->user_id ?? 0);

        return $Silian_userId > 0 && $Silian_existingOwnerId > 0 && $Silian_existingOwnerId === $Silian_userId;
    }

    private function persistDirectUploadOwnership(string $Silian_filePath, int $Silian_userId, string $Silian_originalName, array $Silian_fileInfo, ?string $Silian_sha256 = null): array
    {
        $Silian_fileRecord = $this->fileMetadataService->findByFilePath($Silian_filePath);
        if ($Silian_fileRecord) {
            $Silian_updated = $this->syncDirectUploadFileRecord($Silian_fileRecord, $Silian_filePath, $Silian_userId, $Silian_originalName, $Silian_fileInfo, $Silian_sha256);
            return ['file' => $Silian_updated, 'duplicate' => false];
        }

        $Silian_duplicated = false;
        $Silian_persistedSha256 = $Silian_sha256;
        $Silian_digestClearedForConflict = false;
        if ($Silian_sha256) {
            $Silian_existing = $this->fileMetadataService->findBySha256($Silian_sha256);
            if ($Silian_existing && $Silian_existing->file_path === $Silian_filePath && $this->isOwnedFileRecord($Silian_existing, $Silian_userId)) {
                return [
                    'file' => $this->fileMetadataService->incrementReference($Silian_existing),
                    'duplicate' => true,
                ];
            }

            if ($Silian_existing) {
                $Silian_persistedSha256 = null;
                $Silian_digestClearedForConflict = true;
            }
        }

        $Silian_fileRecord = $this->fileMetadataService->createRecord(
            $this->buildDirectUploadFileRecordData(
                $Silian_filePath,
                $Silian_userId,
                $Silian_originalName,
                $Silian_fileInfo,
                $Silian_persistedSha256,
                !$Silian_digestClearedForConflict
            )
        );

        return ['file' => $Silian_fileRecord, 'duplicate' => $Silian_duplicated];
    }

    private function syncDirectUploadFileRecord(File $Silian_fileRecord, string $Silian_filePath, int $Silian_userId, string $Silian_originalName, array $Silian_fileInfo, ?string $Silian_sha256 = null): File
    {
        $Silian_existingOwnerId = (int) ($Silian_fileRecord->user_id ?? 0);
        if ($Silian_existingOwnerId > 0 && $Silian_existingOwnerId !== $Silian_userId) {
            throw new FileOwnershipConflictException('File ownership conflict detected for direct upload');
        }

        $Silian_recordData = $this->buildDirectUploadFileRecordData($Silian_filePath, $Silian_userId, $Silian_originalName, $Silian_fileInfo, $Silian_sha256);
        $Silian_fileRecord->user_id = $Silian_userId;
        $Silian_fileRecord->original_name = $Silian_fileRecord->original_name ?: $Silian_recordData['original_name'];
        $Silian_fileRecord->mime_type = $Silian_fileRecord->mime_type ?: $Silian_recordData['mime_type'];
        $Silian_fileRecord->size = (int) ($Silian_fileRecord->size ?? 0) > 0 ? $Silian_fileRecord->size : $Silian_recordData['size'];
        $Silian_fileRecord->reference_count = (int) ($Silian_fileRecord->reference_count ?? 0) > 0 ? $Silian_fileRecord->reference_count : 1;
        if (!empty($Silian_recordData['sha256']) && empty($Silian_fileRecord->sha256)) {
            $Silian_fileRecord->sha256 = $Silian_recordData['sha256'];
        }
        $Silian_fileRecord->save();

        return $Silian_fileRecord;
    }

    private function buildDirectUploadFileRecordData(
        string $Silian_filePath,
        int $Silian_userId,
        string $Silian_originalName,
        array $Silian_fileInfo,
        ?string $Silian_sha256 = null,
        bool $Silian_allowMetadataSha256 = true
    ): array
    {
        $Silian_recordData = [
            'sha256' => $this->resolveFileRecordSha256($Silian_sha256, $Silian_filePath, $Silian_fileInfo, $Silian_originalName, $Silian_allowMetadataSha256),
            'file_path' => $Silian_filePath,
            'mime_type' => $Silian_fileInfo['mime_type'] ?? null,
            'size' => (int) ($Silian_fileInfo['size'] ?? 0),
            'original_name' => $Silian_originalName,
            'user_id' => $Silian_userId,
            'reference_count' => 1,
        ];

        return $Silian_recordData;
    }

    private function persistMultipartOwnership(string $Silian_filePath, int $Silian_userId, ?array $Silian_fileInfo = null, ?string $Silian_sha256 = null): bool
    {
        if ($Silian_userId <= 0) {
            return false;
        }

        $Silian_fileRecord = $this->fileMetadataService->findByFilePath($Silian_filePath);
        if ($Silian_fileRecord) {
            return $this->syncExistingMultipartOwnership($Silian_fileRecord, $Silian_filePath, $Silian_userId, $Silian_fileInfo, $Silian_sha256);
        }

        if (!$Silian_sha256) {
            throw new \InvalidArgumentException('Missing sha256 for multipart upload ownership persistence');
        }

        $Silian_persistedSha256 = $Silian_sha256;
        $Silian_digestClearedForConflict = false;
        $Silian_existing = $this->fileMetadataService->findBySha256($Silian_sha256);
        if ($Silian_existing) {
            $Silian_persistedSha256 = null;
            $Silian_digestClearedForConflict = true;
        }

        $this->fileMetadataService->createRecord(
            $this->buildMultipartFileRecordData(
                $Silian_filePath,
                $Silian_userId,
                $Silian_fileInfo,
                $Silian_persistedSha256,
                !$Silian_digestClearedForConflict
            )
        );

        return true;
    }

    private function syncExistingMultipartOwnership(File $Silian_fileRecord, string $Silian_filePath, int $Silian_userId, ?array $Silian_fileInfo = null, ?string $Silian_sha256 = null): bool
    {
        $Silian_existingOwnerId = (int) ($Silian_fileRecord->user_id ?? 0);
        if ($Silian_existingOwnerId > 0 && $Silian_existingOwnerId !== $Silian_userId) {
            throw new FileOwnershipConflictException('File ownership conflict detected for multipart upload');
        }

        if ($Silian_existingOwnerId === $Silian_userId) {
            return true;
        }

        $Silian_recordData = $this->buildMultipartFileRecordData($Silian_filePath, $Silian_userId, $Silian_fileInfo, $Silian_sha256);
        $Silian_fileRecord->user_id = $Silian_userId;
        $Silian_fileRecord->original_name = $Silian_fileRecord->original_name ?: $Silian_recordData['original_name'];
        $Silian_fileRecord->mime_type = $Silian_fileRecord->mime_type ?: $Silian_recordData['mime_type'];
        $Silian_fileRecord->size = (int) ($Silian_fileRecord->size ?? 0) > 0 ? $Silian_fileRecord->size : $Silian_recordData['size'];
        $Silian_fileRecord->reference_count = (int) ($Silian_fileRecord->reference_count ?? 0) > 0 ? $Silian_fileRecord->reference_count : 1;
        if (!empty($Silian_recordData['sha256']) && empty($Silian_fileRecord->sha256)) {
            $Silian_fileRecord->sha256 = $Silian_recordData['sha256'];
        }
        $Silian_fileRecord->save();

        return true;
    }

    private function buildMultipartFileRecordData(
        string $Silian_filePath,
        int $Silian_userId,
        ?array $Silian_fileInfo = null,
        ?string $Silian_sha256 = null,
        bool $Silian_allowMetadataSha256 = true
    ): array
    {
        $Silian_originalName = (string) ($Silian_fileInfo['metadata']['original_name'] ?? basename($Silian_filePath));
        $Silian_recordData = [
            'sha256' => $this->resolveFileRecordSha256($Silian_sha256, $Silian_filePath, $Silian_fileInfo ?? [], $Silian_originalName, $Silian_allowMetadataSha256),
            'file_path' => $Silian_filePath,
            'mime_type' => $Silian_fileInfo['mime_type'] ?? null,
            'size' => isset($Silian_fileInfo['size']) ? (int) $Silian_fileInfo['size'] : 0,
            'original_name' => $Silian_originalName,
            'user_id' => $Silian_userId,
            'reference_count' => 1,
        ];

        return $Silian_recordData;
    }

    private function resolveFileRecordSha256(
        ?string $Silian_sha256,
        string $Silian_filePath,
        array $Silian_fileInfo,
        string $Silian_originalName,
        bool $Silian_allowMetadataSha256 = true
    ): string
    {
        $Silian_candidate = is_string($Silian_sha256) ? strtolower(trim($Silian_sha256)) : '';
        if ($Silian_candidate !== '' && preg_match('/^[a-f0-9]{64}$/', $Silian_candidate)) {
            return $Silian_candidate;
        }

        if ($Silian_allowMetadataSha256) {
            $Silian_metadataSha256 = strtolower(trim((string) ($Silian_fileInfo['metadata']['sha256'] ?? '')));
            if ($Silian_metadataSha256 !== '' && preg_match('/^[a-f0-9]{64}$/', $Silian_metadataSha256)) {
                return $Silian_metadataSha256;
            }
        }

        return hash('sha256', json_encode([
            'file_path' => $Silian_filePath,
            'etag' => (string) ($Silian_fileInfo['etag'] ?? ''),
            'size' => (int) ($Silian_fileInfo['size'] ?? 0),
            'mime_type' => (string) ($Silian_fileInfo['mime_type'] ?? ''),
            'original_name' => $Silian_originalName,
        ], JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE));
    }

    private function authorizeMultipartUpload(Response $Silian_response, array $Silian_user, string $Silian_uploadId, string $Silian_filePath): ?Response
    {
        $Silian_upload = $this->multipartUploadService->findActiveUpload($Silian_uploadId);
        if (!$Silian_upload) {
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Multipart upload not found',
                'code' => 'MULTIPART_UPLOAD_NOT_FOUND'
            ], 404);
        }

        if ($Silian_upload->file_path !== $Silian_filePath) {
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'You do not have permission to access this multipart upload',
                'code' => 'MULTIPART_ACCESS_DENIED'
            ], 403);
        }

        if (!$this->isAdminUser($Silian_user) && (int) $Silian_upload->user_id !== (int) ($Silian_user['id'] ?? 0)) {
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'You do not have permission to access this multipart upload',
                'code' => 'MULTIPART_ACCESS_DENIED'
            ], 403);
        }

        return null;
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
     * R2 诊断信息
     */
    public function r2Diagnostics(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Unauthorized'], 401);
            }
            $Silian_data = $this->r2Service->diagnostics();
            return $this->jsonResponse($Silian_response, ['success' => true, 'data' => $Silian_data]);
        } catch (\Throwable $Silian_e) {
            return $this->jsonResponse($Silian_response, ['success' => false, 'message' => 'Diagnostics failed: ' . $Silian_e->getMessage()], 500);
        }
    }
}

