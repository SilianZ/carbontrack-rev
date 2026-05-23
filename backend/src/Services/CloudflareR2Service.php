<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use Aws\S3\S3Client;
use Aws\Exception\AwsException;
use CarbonTrack\Support\SyntheticRequestFactory;
use Monolog\Logger;
use Psr\Http\Message\UploadedFileInterface;

class CloudflareR2Service
{
    private S3Client $s3Client;
    private Logger $logger;
    private string $bucketName;
    private string $publicUrl;
    private string $endpoint;
    private AuditLogService $auditLogService;
    private ?ErrorLogService $errorLogService;

    // 允许的图片类型
    private const ALLOWED_MIME_TYPES = [
        'image/jpeg',
        'image/jpg',
        'image/png',
        'image/gif',
        'image/webp'
    ];

    // 允许的文件扩展名
    private const ALLOWED_EXTENSIONS = [
        'jpg', 'jpeg', 'png', 'gif', 'webp'
    ];

    // 最大文件大小 (5MB)
    private const MAX_FILE_SIZE = 5 * 1024 * 1024;

    public function __construct(
        string $Silian_accessKeyId,
        string $Silian_secretAccessKey,
        string $Silian_endpoint,
        string $Silian_bucketName,
        ?string $Silian_publicUrl,
        Logger $Silian_logger,
        AuditLogService $Silian_auditLogService,
        ?ErrorLogService $Silian_errorLogService = null
    ) {
        $this->bucketName = $Silian_bucketName;
        $this->logger = $Silian_logger;
        $this->auditLogService = $Silian_auditLogService;
        $this->errorLogService = $Silian_errorLogService;
        $this->endpoint = rtrim($Silian_endpoint, "/");

    // 是否禁用 TLS 校验（仅用于开发/诊断）
    $Silian_disableVerify = !empty($_ENV['R2_DISABLE_TLS_VERIFY']);

        // 初始化S3客户端（兼容Cloudflare R2）
        $this->s3Client = new S3Client([
            'version' => 'latest',
            'region' => 'auto', // R2使用auto region
            'endpoint' => $Silian_endpoint,
            'credentials' => [
                'key' => $Silian_accessKeyId,
                'secret' => $Silian_secretAccessKey,
            ],
            'use_path_style_endpoint' => true,
            'http' => [
                'timeout' => 30,
                'connect_timeout' => 10,
            ]
        ]);

        // 直接在底层 guzzle 客户端上设置 verify (S3Client 支持透传 'verify' 配置)
        if ($Silian_disableVerify) {
            try {
                $this->s3Client = new S3Client([
                    'version' => 'latest',
                    'region' => 'auto',
                    'endpoint' => $Silian_endpoint,
                    'credentials' => [
                        'key' => $Silian_accessKeyId,
                        'secret' => $Silian_secretAccessKey,
                    ],
                    'use_path_style_endpoint' => true,
                    'http' => [
                        'timeout' => 30,
                        'connect_timeout' => 10,
                    ],
                    'verify' => false
                ]);
                $this->logger->warning('R2 TLS certificate verification DISABLED (R2_DISABLE_TLS_VERIFY=1). Do not use in production.');
            } catch (\Throwable $Silian_e) {
                $this->logFailure('r2_client_recreate_failed', $Silian_e, [
                    'endpoint' => $Silian_endpoint,
                    'bucket_name' => $Silian_bucketName,
                ], '/internal/r2/client');
                $this->logger->error('Failed to recreate S3Client with verify=false', ['error' => $Silian_e->getMessage()]);
            }
        }

        // 计算公共访问基地址
        $Silian_derivedBase = $this->derivePublicBase($Silian_endpoint, $Silian_bucketName);
        $Silian_finalPublicUrl = $Silian_publicUrl ? rtrim($Silian_publicUrl, '/') : $Silian_derivedBase;
        $this->publicUrl = $Silian_finalPublicUrl;

        if (!$Silian_publicUrl) {
            // 记录一次警告，提示使用了推导的公共URL
            try {
                $this->logger->warning('R2 public base URL is not configured. Using derived fallback.', [
                    'derived_public_base' => $Silian_derivedBase,
                    'endpoint' => $Silian_endpoint,
                    'bucket' => $Silian_bucketName
                ]);
            } catch (\Throwable $Silian_ignore) {}
        }
    }

    /**
     * 暴露允许的 MIME 类型（只读）
     */
    public function getAllowedMimeTypes(): array
    {
        return self::ALLOWED_MIME_TYPES;
    }

    /**
     * 暴露允许的扩展名（只读）
     */
    public function getAllowedExtensions(): array
    {
        return self::ALLOWED_EXTENSIONS;
    }

    /**
     * 获取最大文件大小（字节）
     */
    public function getMaxFileSize(): int
    {
        return self::MAX_FILE_SIZE;
    }

    public function getBucketName(): string
    {
        return $this->bucketName;
    }

    /**
     * 生成用于前端直接上传的对象 key （不立即上传）
     * @param string $originalName 原始文件名
     * @param string $directory 目标目录
     * @return array{file_name:string,file_path:string,public_url:string}
     */
    public function generateDirectUploadKey(string $Silian_originalName, string $Silian_directory = 'uploads'): array
    {
        $Silian_extension = strtolower(pathinfo($Silian_originalName, PATHINFO_EXTENSION));
        // 复用内部的文件名生成逻辑（复制一份以避免修改私有方法签名）
        $Silian_uuid = sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
        $Silian_fileName = $Silian_uuid . '.' . $Silian_extension;
        $Silian_date = date('Y/m/d');
        $Silian_filePath = trim($Silian_directory, '/') . '/' . $Silian_date . '/' . $Silian_fileName;
        return [
            'file_name' => $Silian_fileName,
            'file_path' => $Silian_filePath,
            'public_url' => $this->getPublicUrl($Silian_filePath)
        ];
    }

    /**
     * 为 PUT 上传生成预签名 URL（前端直传）
     * @param string $filePath 对象 key
     * @param string $contentType 内容类型
     * @param int $expiresIn 过期秒数（默认 600，最大 3600）
    * @param array $metadata 自定义元数据（键值对）
     * @return array{url:string,method:string,headers:array,expires_in:int,expires_at:string}
     */
    public function generateUploadPresignedUrl(string $Silian_filePath, string $Silian_contentType, int $Silian_expiresIn = 600, array $Silian_metadata = []): array
    {
        $Silian_expiresIn = max(60, min($Silian_expiresIn, 3600));
        try {
            $Silian_normalizedMetadata = $this->normalizeObjectMetadata($Silian_metadata);
            $Silian_commandParams = [
                'Bucket' => $this->bucketName,
                'Key' => $Silian_filePath,
                'ContentType' => $Silian_contentType
            ];
            if ($Silian_normalizedMetadata !== []) {
                $Silian_commandParams['Metadata'] = $Silian_normalizedMetadata;
            }

            $Silian_command = $this->s3Client->getCommand('PutObject', $Silian_commandParams);
            $Silian_request = $this->s3Client->createPresignedRequest($Silian_command, "+{$Silian_expiresIn} seconds");
            $Silian_headers = [
                // 预签名请求必须保持与签名时一致的 Content-Type
                'Content-Type' => $Silian_contentType
            ];
            foreach ($Silian_normalizedMetadata as $Silian_key => $Silian_value) {
                $Silian_headers['x-amz-meta-' . $Silian_key] = $Silian_value;
            }

            return [
                'url' => (string)$Silian_request->getUri(),
                'method' => 'PUT',
                'headers' => $Silian_headers,
                'expires_in' => $Silian_expiresIn,
                'expires_at' => date('Y-m-d H:i:s', time() + $Silian_expiresIn)
            ];
        } catch (AwsException $Silian_e) {
            $this->logFailure('r2_upload_presigned_url_failed', $Silian_e, [
                'file_path' => $Silian_filePath,
                'content_type' => $Silian_contentType,
            ], '/internal/r2/presign-upload');
            $this->logger->error('Failed to generate upload presigned URL', [
                'error' => $Silian_e->getMessage(),
                'file_path' => $Silian_filePath
            ]);
            throw new \RuntimeException('Failed to generate upload presigned URL: ' . $Silian_e->getMessage());
        }
    }

    /**
     * 记录前端直传完成后的审计日志（在确认接口中调用）
     * @param int $userId
     * @param string|null $entityType
     * @param int|null $entityId
     * @param array $fileInfo 从 getFileInfo 获得
     * @param string $originalName 原始文件名
     */
    public function logDirectUploadAudit(int $Silian_userId, ?string $Silian_entityType, ?int $Silian_entityId, array $Silian_fileInfo, string $Silian_originalName): void
    {
        try {
            $this->auditLogService->log([
                'user_id' => $Silian_userId,
                'action' => 'file_uploaded',
                'entity_type' => $Silian_entityType ?: 'file',
                'entity_id' => $Silian_entityId,
                'new_value' => json_encode([
                    'file_path' => $Silian_fileInfo['file_path'] ?? '',
                    'file_size' => $Silian_fileInfo['size'] ?? 0,
                    'mime_type' => $Silian_fileInfo['mime_type'] ?? '',
                    'original_name' => $Silian_originalName,
                    'direct_upload' => true
                ]),
                'notes' => 'Direct file upload to Cloudflare R2 (presigned PUT)'
            ]);
        } catch (\Throwable $Silian_e) {
            $this->logFailure('r2_direct_upload_audit_failed', $Silian_e, [
                'user_id' => $Silian_userId,
                'entity_type' => $Silian_entityType,
                'entity_id' => $Silian_entityId,
                'file_path' => $Silian_fileInfo['file_path'] ?? '',
            ], '/internal/r2/direct-upload-audit');
            $this->logger->error('Failed to log direct upload audit', [
                'error' => $Silian_e->getMessage(),
                'file_path' => $Silian_fileInfo['file_path'] ?? ''
            ]);
        }
    }

    /**
     * 上传文件到R2
     */
    public function uploadFile(
        UploadedFileInterface $Silian_file,
        string $Silian_directory = 'uploads',
        ?int $Silian_userId = null,
        ?string $Silian_entityType = null,
        ?int $Silian_entityId = null
    ): array {
        try {
            // 验证文件
            $this->validateFile($Silian_file);

            // 生成文件名和路径
            $Silian_fileName = $this->generateFileName($Silian_file);
            $Silian_filePath = $this->generateFilePath($Silian_directory, $Silian_fileName);

            // 获取文件内容
            $Silian_fileContent = $Silian_file->getStream()->getContents();

            // 上传到R2
            $Silian_result = $this->s3Client->putObject([
                'Bucket' => $this->bucketName,
                'Key' => $Silian_filePath,
                'Body' => $Silian_fileContent,
                'ContentType' => $Silian_file->getClientMediaType(),
                'ContentLength' => $Silian_file->getSize(),
                'Metadata' => [
                    'original_name' => $Silian_file->getClientFilename(),
                    'uploaded_by' => $Silian_userId ? (string)$Silian_userId : 'anonymous',
                    'entity_type' => $Silian_entityType ?: 'unknown',
                    'entity_id' => $Silian_entityId ? (string)$Silian_entityId : '',
                    'upload_time' => date('Y-m-d H:i:s'),
                ]
            ]);

            $Silian_publicUrl = $this->getPublicUrl($Silian_filePath);

            $this->logger->info('File uploaded to R2', [
                'file_path' => $Silian_filePath,
                'file_size' => $Silian_file->getSize(),
                'mime_type' => $Silian_file->getClientMediaType(),
                'user_id' => $Silian_userId,
                'public_url' => $Silian_publicUrl
            ]);

            // 记录审计日志
            if ($Silian_userId) {
                $this->auditLogService->log([
                    'user_id' => $Silian_userId,
                    'action' => 'file_uploaded',
                    'entity_type' => $Silian_entityType ?: 'file',
                    'entity_id' => $Silian_entityId,
                    'new_value' => json_encode([
                        'file_path' => $Silian_filePath,
                        'file_size' => $Silian_file->getSize(),
                        'mime_type' => $Silian_file->getClientMediaType(),
                        'original_name' => $Silian_file->getClientFilename()
                    ]),
                    'notes' => 'File uploaded to Cloudflare R2'
                ]);
            }

            $Silian_presignedUrl = null;
            try {
                $Silian_presignedUrl = $this->generatePresignedUrl($Silian_filePath, 600);
            } catch (\Throwable $Silian_ignore) {
                // presign failures are non-fatal
            }

            return [
                'success' => true,
                'file_path' => $Silian_filePath,
                'public_url' => $Silian_publicUrl,
                'presigned_url' => $Silian_presignedUrl,
                'file_size' => $Silian_file->getSize(),
                'mime_type' => $Silian_file->getClientMediaType(),
                'original_name' => $Silian_file->getClientFilename(),
                'etag' => $Silian_result['ETag'] ?? null
            ];

        } catch (\Exception $Silian_e) {
            $this->logFailure('r2_file_upload_failed', $Silian_e, [
                'file_name' => $Silian_file->getClientFilename(),
                'file_size' => $Silian_file->getSize(),
                'user_id' => $Silian_userId,
            ], '/internal/r2/upload');
            $this->logger->error('Failed to upload file to R2', [
                'error' => $Silian_e->getMessage(),
                'file_name' => $Silian_file->getClientFilename(),
                'file_size' => $Silian_file->getSize(),
                'user_id' => $Silian_userId
            ]);

            throw new \RuntimeException('File upload failed: ' . $Silian_e->getMessage());
        }
    }

    /**
     * 删除文件
     */
    public function deleteFile(string $Silian_filePath, ?int $Silian_userId = null): bool
    {
        try {
            $this->s3Client->deleteObject([
                'Bucket' => $this->bucketName,
                'Key' => $Silian_filePath
            ]);

            $this->logger->info('File deleted from R2', [
                'file_path' => $Silian_filePath,
                'user_id' => $Silian_userId
            ]);

            // 记录审计日志
            if ($Silian_userId) {
                $this->auditLogService->log([
                    'user_id' => $Silian_userId,
                    'action' => 'file_deleted',
                    'entity_type' => 'file',
                    'old_value' => json_encode(['file_path' => $Silian_filePath]),
                    'notes' => 'File deleted from Cloudflare R2'
                ]);
            }

            return true;

        } catch (AwsException $Silian_e) {
            $this->logFailure('r2_file_delete_failed', $Silian_e, [
                'file_path' => $Silian_filePath,
                'user_id' => $Silian_userId,
            ], '/internal/r2/delete');
            $this->logger->error('Failed to delete file from R2', [
                'error' => $Silian_e->getMessage(),
                'file_path' => $Silian_filePath,
                'user_id' => $Silian_userId
            ]);

            return false;
        }
    }

    /**
     * 检查文件是否存在
     */
    public function fileExists(string $Silian_filePath): bool
    {
        try {
            $this->s3Client->headObject([
                'Bucket' => $this->bucketName,
                'Key' => $Silian_filePath
            ]);

            return true;

        } catch (AwsException $Silian_e) {
            return false;
        }
    }

    /**
     * 获取文件信息
     */
    public function getFileInfo(string $Silian_filePath): ?array
    {
        try {
            $Silian_result = $this->s3Client->headObject([
                'Bucket' => $this->bucketName,
                'Key' => $Silian_filePath
            ]);

            $Silian_presignedUrl = null;
            try {
                $Silian_presignedUrl = $this->generatePresignedUrl($Silian_filePath, 600);
            } catch (\Throwable $Silian_ignore) {
                // ignore presign failures
            }

            return [
                'file_path' => $Silian_filePath,
                'public_url' => $this->getPublicUrl($Silian_filePath),
                'size' => $Silian_result['ContentLength'] ?? 0,
                'mime_type' => $Silian_result['ContentType'] ?? 'application/octet-stream',
                'last_modified' => $Silian_result['LastModified'] ?? null,
                'etag' => $Silian_result['ETag'] ?? null,
                'metadata' => $Silian_result['Metadata'] ?? [],
                'presigned_url' => $Silian_presignedUrl
            ];

        } catch (AwsException $Silian_e) {
            $this->logFailure('r2_file_info_failed', $Silian_e, [
                'file_path' => $Silian_filePath,
            ], '/internal/r2/file-info');
            $this->logger->error('Failed to get file info from R2', [
                'error' => $Silian_e->getMessage(),
                'file_path' => $Silian_filePath
            ]);

            return null;
        }
    }

    /**
     * 生成预签名URL（用于临时访问私有文件）
     */
    public function generatePresignedUrl(string $Silian_filePath, int $Silian_expiresIn = 600): string
    {
        try {
            $Silian_command = $this->s3Client->getCommand('GetObject', [
                'Bucket' => $this->bucketName,
                'Key' => $Silian_filePath
            ]);

            $Silian_request = $this->s3Client->createPresignedRequest($Silian_command, "+{$Silian_expiresIn} seconds");

            return (string) $Silian_request->getUri();

        } catch (AwsException $Silian_e) {
            $this->logFailure('r2_presigned_url_failed', $Silian_e, [
                'file_path' => $Silian_filePath,
                'expires_in' => $Silian_expiresIn,
            ], '/internal/r2/presign-get');
            $this->logger->error('Failed to generate presigned URL', [
                'error' => $Silian_e->getMessage(),
                'file_path' => $Silian_filePath
            ]);

            throw new \RuntimeException('Failed to generate presigned URL: ' . $Silian_e->getMessage());
        }
    }

    /**
     * 批量上传文件
     */
    public function uploadMultipleFiles(
        array $Silian_files,
        string $Silian_directory = 'uploads',
        ?int $Silian_userId = null,
        ?string $Silian_entityType = null,
        ?int $Silian_entityId = null
    ): array {
        $Silian_results = [];
        $Silian_errors = [];

        foreach ($Silian_files as $Silian_index => $Silian_file) {
            try {
                $Silian_result = $this->uploadFile($Silian_file, $Silian_directory, $Silian_userId, $Silian_entityType, $Silian_entityId);
                $Silian_results[] = $Silian_result;
            } catch (\Exception $Silian_e) {
                $Silian_errors[] = [
                    'index' => $Silian_index,
                    'file_name' => $Silian_file->getClientFilename(),
                    'error' => $Silian_e->getMessage()
                ];
            }
        }

        return [
            'success' => count($Silian_results),
            'failed' => count($Silian_errors),
            'results' => $Silian_results,
            'errors' => $Silian_errors
        ];
    }

    /**
     * 获取公共URL
     */
    public function getPublicUrl(string $Silian_filePath): string
    {
        return $this->publicUrl . '/' . ltrim($Silian_filePath, '/');
    }

    /**
     * Attempt to resolve an object key from a public-facing URL.
     */
    public function resolveKeyFromUrl(string $Silian_url): ?string
    {
        $Silian_trimmed = trim($Silian_url);
        if ($Silian_trimmed === '') {
            return null;
        }
        if (!preg_match('#^https?://#i', $Silian_trimmed)) {
            return ltrim($Silian_trimmed, '/');
        }

        $Silian_normalized = preg_split('/[?#]/', $Silian_trimmed, 2)[0] ?? $Silian_trimmed;
        $Silian_normalized = rtrim($Silian_normalized, '/');

        $Silian_baseCandidates = [];
        $Silian_defaultBase = rtrim($this->publicUrl, '/');
        if ($Silian_defaultBase !== '') {
            $Silian_baseCandidates[] = $Silian_defaultBase;
        }

        $Silian_endpointBase = rtrim($this->endpoint, '/');
        if ($Silian_endpointBase !== '') {
            $Silian_baseCandidates[] = $Silian_endpointBase;
            $Silian_baseCandidates[] = rtrim($Silian_endpointBase . '/' . ltrim($this->bucketName, '/'), '/');
        }

        $Silian_baseCandidates = array_values(array_filter(array_unique($Silian_baseCandidates)));
        $Silian_bucketPrefix = ltrim($this->bucketName, '/');

        foreach ($Silian_baseCandidates as $Silian_base) {
            if ($Silian_base === '') {
                continue;
            }
            if (str_starts_with($Silian_normalized, $Silian_base . '/')) {
                $Silian_candidate = substr($Silian_normalized, strlen($Silian_base) + 1);
            } elseif ($Silian_normalized === $Silian_base) {
                $Silian_candidate = '';
            } else {
                continue;
            }
            $Silian_candidate = ltrim($Silian_candidate, '/');
            if ($Silian_candidate === '') {
                return null;
            }
            if ($Silian_bucketPrefix !== '' && str_starts_with($Silian_candidate, $Silian_bucketPrefix . '/')) {
                $Silian_candidate = substr($Silian_candidate, strlen($Silian_bucketPrefix) + 1);
                $Silian_candidate = ltrim($Silian_candidate, '/');
            }
            return $Silian_candidate === '' ? null : $Silian_candidate;
        }

        $Silian_pathPart = parse_url($Silian_normalized, PHP_URL_PATH);
        if (!is_string($Silian_pathPart) || $Silian_pathPart === '') {
            return null;
        }
        $Silian_pathPart = ltrim($Silian_pathPart, '/');
        if ($Silian_bucketPrefix !== '' && str_starts_with($Silian_pathPart, $Silian_bucketPrefix . '/')) {
            $Silian_pathPart = substr($Silian_pathPart, strlen($Silian_bucketPrefix) + 1);
            $Silian_pathPart = ltrim($Silian_pathPart, '/');
        }
        return $Silian_pathPart === '' ? null : $Silian_pathPart;
    }

    /**
     * 根据 endpoint 与 bucket 推导一个公共访问基地址
     * 优先使用 Cloudflare R2 公共域名（pub-<account>.r2.dev/<bucket>），否则回退到 endpoint/<bucket>
     */
    private function derivePublicBase(string $Silian_endpoint, string $Silian_bucketName): string
    {
        $Silian_base = '';

        // 尝试从 endpoint 中解析出 accountId
        $Silian_host = '';
        $Silian_scheme = 'https';
        $Silian_parts = @parse_url($Silian_endpoint);
        if (is_array($Silian_parts)) {
            $Silian_host = $Silian_parts['host'] ?? '';
            $Silian_scheme = $Silian_parts['scheme'] ?? 'https';
        }

        // 匹配 <account>.r2.cloudflarestorage.com
        if ($Silian_host && preg_match('/^([a-z0-9]+)\.r2\.cloudflarestorage\.com$/i', $Silian_host, $Silian_m)) {
            $Silian_accountId = $Silian_m[1];
            $Silian_base = sprintf('https://pub-%s.r2.dev/%s', $Silian_accountId, $Silian_bucketName);
        } elseif ($Silian_host) {
            // 其他自定义或兼容 S3 的 endpoint，尽力拼接
            $Silian_endpointTrimmed = rtrim($Silian_endpoint, '/');
            $Silian_base = $Silian_endpointTrimmed . '/' . $Silian_bucketName;
        }

        // 确保非空，最差退回根路径，避免返回 null/空导致拼接异常
        if ($Silian_base === '') {
            $Silian_base = '/' . ltrim($Silian_bucketName, '/');
        }

        return rtrim($Silian_base, '/');
    }

    private function normalizeObjectMetadata(array $Silian_metadata): array
    {
        $Silian_normalized = [];
        foreach ($Silian_metadata as $Silian_key => $Silian_value) {
            if (!is_scalar($Silian_value) || $Silian_value === '') {
                continue;
            }

            $Silian_normalizedKey = strtolower((string) $Silian_key);
            $Silian_normalizedKey = preg_replace('/[^a-z0-9_-]/', '_', $Silian_normalizedKey) ?? '';
            $Silian_normalizedKey = trim($Silian_normalizedKey, '_');
            if ($Silian_normalizedKey === '') {
                continue;
            }

            $Silian_normalized[$Silian_normalizedKey] = (string) $Silian_value;
        }

        return $Silian_normalized;
    }

    /**
     * 验证上传的文件
     */
    private function validateFile(UploadedFileInterface $Silian_file): void
    {
        // 检查上传错误
        if ($Silian_file->getError() !== UPLOAD_ERR_OK) {
            throw new \InvalidArgumentException('File upload error: ' . $this->getUploadErrorMessage($Silian_file->getError()));
        }

        // 检查文件大小
        if ($Silian_file->getSize() > self::MAX_FILE_SIZE) {
            throw new \InvalidArgumentException('File size exceeds maximum allowed size of ' . (self::MAX_FILE_SIZE / 1024 / 1024) . 'MB');
        }

        // 检查MIME类型
        $Silian_mimeType = $Silian_file->getClientMediaType();
        if (!in_array($Silian_mimeType, self::ALLOWED_MIME_TYPES)) {
            throw new \InvalidArgumentException('File type not allowed. Allowed types: ' . implode(', ', self::ALLOWED_MIME_TYPES));
        }

        // 检查文件扩展名
        $Silian_fileName = $Silian_file->getClientFilename();
        $Silian_extension = strtolower(pathinfo($Silian_fileName, PATHINFO_EXTENSION));
        if (!in_array($Silian_extension, self::ALLOWED_EXTENSIONS)) {
            throw new \InvalidArgumentException('File extension not allowed. Allowed extensions: ' . implode(', ', self::ALLOWED_EXTENSIONS));
        }

        // 检查文件内容（简单的魔数检查）
        $Silian_fileContent = $Silian_file->getStream()->getContents();
        $Silian_file->getStream()->rewind(); // 重置流位置

        if (!$this->isValidImageContent($Silian_fileContent, $Silian_mimeType)) {
            throw new \InvalidArgumentException('File content does not match the declared MIME type');
        }
    }

    /**
     * 检查文件内容是否为有效图片
     */
    private function isValidImageContent(string $Silian_content, string $Silian_mimeType): bool
    {
        // 检查文件魔数
        $Silian_magicNumbers = [
            'image/jpeg' => ["\xFF\xD8\xFF"],
            'image/png' => ["\x89\x50\x4E\x47\x0D\x0A\x1A\x0A"],
            'image/gif' => ["GIF87a", "GIF89a"],
            'image/webp' => ["RIFF"]
        ];

        if (!isset($Silian_magicNumbers[$Silian_mimeType])) {
            return false;
        }

        foreach ($Silian_magicNumbers[$Silian_mimeType] as $Silian_magic) {
            if (strpos($Silian_content, $Silian_magic) === 0) {
                return true;
            }
        }

        // 对于WebP，需要额外检查
        if ($Silian_mimeType === 'image/webp') {
            return strpos($Silian_content, 'RIFF') === 0 && strpos($Silian_content, 'WEBP') === 8;
        }

        return false;
    }

    /**
     * 生成唯一文件名
     */
    private function generateFileName(UploadedFileInterface $Silian_file): string
    {
        $Silian_originalName = $Silian_file->getClientFilename();
        $Silian_extension = strtolower(pathinfo($Silian_originalName, PATHINFO_EXTENSION));

        // 生成UUID作为文件名
        $Silian_uuid = sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );

        return $Silian_uuid . '.' . $Silian_extension;
    }

    /**
     * 生成文件路径
     */
    private function generateFilePath(string $Silian_directory, string $Silian_fileName): string
    {
        $Silian_date = date('Y/m/d');
        return trim($Silian_directory, '/') . '/' . $Silian_date . '/' . $Silian_fileName;
    }

    /**
     * 获取上传错误信息
     */
    private function getUploadErrorMessage(int $Silian_errorCode): string
    {
        switch ($Silian_errorCode) {
            case UPLOAD_ERR_INI_SIZE:
                return 'File exceeds upload_max_filesize directive';
            case UPLOAD_ERR_FORM_SIZE:
                return 'File exceeds MAX_FILE_SIZE directive';
            case UPLOAD_ERR_PARTIAL:
                return 'File was only partially uploaded';
            case UPLOAD_ERR_NO_FILE:
                return 'No file was uploaded';
            case UPLOAD_ERR_NO_TMP_DIR:
                return 'Missing temporary folder';
            case UPLOAD_ERR_CANT_WRITE:
                return 'Failed to write file to disk';
            case UPLOAD_ERR_EXTENSION:
                return 'File upload stopped by extension';
            default:
                return 'Unknown upload error';
        }
    }

    /**
     * 清理过期的临时文件
     */
    public function cleanupExpiredFiles(string $Silian_directory = 'temp', int $Silian_daysOld = 7): int
    {
        try {
            $Silian_deletedCount = 0;
            $Silian_cutoffDate = new \DateTime("-{$Silian_daysOld} days");

            $Silian_objects = $this->s3Client->listObjectsV2([
                'Bucket' => $this->bucketName,
                'Prefix' => trim($Silian_directory, '/') . '/'
            ]);

            if (isset($Silian_objects['Contents'])) {
                foreach ($Silian_objects['Contents'] as $Silian_object) {
                    $Silian_lastModified = new \DateTime($Silian_object['LastModified']);

                    if ($Silian_lastModified < $Silian_cutoffDate) {
                        $this->s3Client->deleteObject([
                            'Bucket' => $this->bucketName,
                            'Key' => $Silian_object['Key']
                        ]);
                        $Silian_deletedCount++;
                    }
                }
            }

            $this->logger->info('Cleaned up expired files', [
                'directory' => $Silian_directory,
                'days_old' => $Silian_daysOld,
                'deleted_count' => $Silian_deletedCount
            ]);

            return $Silian_deletedCount;

        } catch (AwsException $Silian_e) {
            $this->logFailure('r2_cleanup_expired_files_failed', $Silian_e, [
                'directory' => $Silian_directory,
                'days_old' => $Silian_daysOld,
            ], '/internal/r2/cleanup');
            $this->logger->error('Failed to cleanup expired files', [
                'error' => $Silian_e->getMessage(),
                'directory' => $Silian_directory
            ]);

            return 0;
        }
    }

    /**
     * 获取存储统计信息
     */
    public function getStorageStats(): array
    {
        try {
            $Silian_objects = $this->s3Client->listObjectsV2([
                'Bucket' => $this->bucketName
            ]);

            $Silian_totalSize = 0;
            $Silian_fileCount = 0;
            $Silian_fileTypes = [];

            if (isset($Silian_objects['Contents'])) {
                foreach ($Silian_objects['Contents'] as $Silian_object) {
                    $Silian_totalSize += $Silian_object['Size'];
                    $Silian_fileCount++;

                    $Silian_extension = strtolower(pathinfo($Silian_object['Key'], PATHINFO_EXTENSION));
                    $Silian_fileTypes[$Silian_extension] = ($Silian_fileTypes[$Silian_extension] ?? 0) + 1;
                }
            }

            return [
                'total_files' => $Silian_fileCount,
                'total_size' => $Silian_totalSize,
                'total_size_mb' => round($Silian_totalSize / 1024 / 1024, 2),
                'file_types' => $Silian_fileTypes,
                'bucket_name' => $this->bucketName
            ];

        } catch (AwsException $Silian_e) {
            $this->logFailure('r2_storage_stats_failed', $Silian_e, [], '/internal/r2/stats');
            $this->logger->error('Failed to get storage stats', [
                'error' => $Silian_e->getMessage()
            ]);

            return [
                'total_files' => 0,
                'total_size' => 0,
                'total_size_mb' => 0,
                'file_types' => [],
                'bucket_name' => $this->bucketName,
                'error' => $Silian_e->getMessage()
            ];
        }
    }

    /**
     * 列出文件（简单分页，最多 1000）
     * @param string|null $prefix 目录前缀
     * @param int $limit
     * @return array
     */
    public function listFiles(?string $Silian_prefix = null, int $Silian_limit = 100): array
    {
        $Silian_limit = max(1, min($Silian_limit, 1000));
        try {
            $Silian_params = [
                'Bucket' => $this->bucketName,
                'MaxKeys' => $Silian_limit
            ];
            if ($Silian_prefix) {
                $Silian_params['Prefix'] = rtrim($Silian_prefix, '/') . '/';
            }
            $Silian_result = $this->s3Client->listObjectsV2($Silian_params);
            $Silian_files = [];
            if (!empty($Silian_result['Contents'])) {
                foreach ($Silian_result['Contents'] as $Silian_obj) {
                    if (isset($Silian_obj['Key']) && substr($Silian_obj['Key'], -1) !== '/') {
                        $Silian_files[] = [
                            'file_path' => $Silian_obj['Key'],
                            'size' => $Silian_obj['Size'] ?? 0,
                            'last_modified' => $Silian_obj['LastModified'] ?? null,
                            'public_url' => $this->getPublicUrl($Silian_obj['Key'])
                        ];
                    }
                }
            }
            return [
                'success' => true,
                'files' => $Silian_files,
                'count' => count($Silian_files)
            ];
        } catch (AwsException $Silian_e) {
            $this->logFailure('r2_list_files_failed', $Silian_e, [
                'prefix' => $Silian_prefix,
                'limit' => $Silian_limit,
            ], '/internal/r2/list');
            $this->logger->error('Failed to list files', ['error' => $Silian_e->getMessage(), 'prefix' => $Silian_prefix]);
            return [
                'success' => false,
                'files' => [],
                'error' => $Silian_e->getMessage()
            ];
        }
    }

    /**
     * 初始化分片上传
     * @return array{upload_id:string,file_path:string}
     */
    public function initMultipartUpload(string $Silian_originalName, string $Silian_directory, string $Silian_contentType): array
    {
        $Silian_keyInfo = $this->generateDirectUploadKey($Silian_originalName, $Silian_directory);
        try {
            $Silian_result = $this->s3Client->createMultipartUpload([
                'Bucket' => $this->bucketName,
                'Key' => $Silian_keyInfo['file_path'],
                'ContentType' => $Silian_contentType
            ]);
            return [
                'upload_id' => $Silian_result['UploadId'],
                'file_path' => $Silian_keyInfo['file_path'],
                'public_url' => $Silian_keyInfo['public_url']
            ];
        } catch (AwsException $Silian_e) {
            $this->logFailure('r2_init_multipart_upload_failed', $Silian_e, [
                'original_name' => $Silian_originalName,
                'directory' => $Silian_directory,
                'content_type' => $Silian_contentType,
            ], '/internal/r2/multipart/init');
            $this->logger->error('Failed to init multipart upload', ['error' => $Silian_e->getMessage()]);
            throw new \RuntimeException('Failed to init multipart upload: ' . $Silian_e->getMessage());
        }
    }

    /**
     * 为指定 part 生成预签名 URL
     * @return array{url:string,part_number:int,headers:array}
     */
    public function generateMultipartPartUrl(string $Silian_filePath, string $Silian_uploadId, int $Silian_partNumber, int $Silian_expiresIn = 600): array
    {
        $Silian_partNumber = max(1, min($Silian_partNumber, 10000));
        $Silian_expiresIn = max(60, min($Silian_expiresIn, 3600));
        try {
            $Silian_command = $this->s3Client->getCommand('UploadPart', [
                'Bucket' => $this->bucketName,
                'Key' => $Silian_filePath,
                'UploadId' => $Silian_uploadId,
                'PartNumber' => $Silian_partNumber
            ]);
            $Silian_request = $this->s3Client->createPresignedRequest($Silian_command, "+{$Silian_expiresIn} seconds");
            return [
                'url' => (string)$Silian_request->getUri(),
                'part_number' => $Silian_partNumber,
                'headers' => []
            ];
        } catch (AwsException $Silian_e) {
            $this->logFailure('r2_generate_multipart_part_url_failed', $Silian_e, [
                'file_path' => $Silian_filePath,
                'upload_id' => $Silian_uploadId,
                'part_number' => $Silian_partNumber,
            ], '/internal/r2/multipart/part-url');
            $this->logger->error('Failed to generate multipart part URL', ['error' => $Silian_e->getMessage()]);
            throw new \RuntimeException('Failed to generate multipart part URL: ' . $Silian_e->getMessage());
        }
    }

    /**
     * 完成分片上传
     * @param array<int,array{part_number:int,etag:string}> $parts
     */
    public function completeMultipartUpload(string $Silian_filePath, string $Silian_uploadId, array $Silian_parts): array
    {
        // 组装为 S3 需要的结构
        $Silian_normalized = [];
        foreach ($Silian_parts as $Silian_p) {
            if (!isset($Silian_p['part_number'], $Silian_p['etag'])) continue;
            $Silian_normalized[] = [
                'PartNumber' => (int)$Silian_p['part_number'],
                'ETag' => $Silian_p['etag']
            ];
        }
        try {
            $Silian_result = $this->s3Client->completeMultipartUpload([
                'Bucket' => $this->bucketName,
                'Key' => $Silian_filePath,
                'UploadId' => $Silian_uploadId,
                'MultipartUpload' => [
                    'Parts' => $Silian_normalized
                ]
            ]);
            return [
                'success' => true,
                'file_path' => $Silian_filePath,
                'public_url' => $this->getPublicUrl($Silian_filePath),
                'etag' => $Silian_result['ETag'] ?? null
            ];
        } catch (AwsException $Silian_e) {
            $this->logFailure('r2_complete_multipart_upload_failed', $Silian_e, [
                'file_path' => $Silian_filePath,
                'upload_id' => $Silian_uploadId,
                'part_count' => count($Silian_normalized),
            ], '/internal/r2/multipart/complete');
            $this->logger->error('Failed to complete multipart upload', ['error' => $Silian_e->getMessage()]);
            throw new \RuntimeException('Failed to complete multipart upload: ' . $Silian_e->getMessage());
        }
    }

    /**
     * 终止分片上传（可用于取消）
     */
    public function abortMultipartUpload(string $Silian_filePath, string $Silian_uploadId): bool
    {
        try {
            $this->s3Client->abortMultipartUpload([
                'Bucket' => $this->bucketName,
                'Key' => $Silian_filePath,
                'UploadId' => $Silian_uploadId
            ]);
            return true;
        } catch (AwsException $Silian_e) {
            $this->logFailure('r2_abort_multipart_upload_failed', $Silian_e, [
                'file_path' => $Silian_filePath,
                'upload_id' => $Silian_uploadId,
            ], '/internal/r2/multipart/abort');
            $this->logger->error('Failed to abort multipart upload', ['error' => $Silian_e->getMessage()]);
            return false;
        }
    }

    /**
     * 诊断服务可用性
     */
    public function diagnostics(): array
    {
        $Silian_errors = [];
        $Silian_checks = [];
        // Bucket list 权限
        try {
            $this->s3Client->listObjectsV2([
                'Bucket' => $this->bucketName,
                'MaxKeys' => 1
            ]);
            $Silian_checks['list_objects'] = true;
        } catch (\Throwable $Silian_e) {
            $this->logFailure('r2_diagnostics_list_objects_failed', $Silian_e, [], '/internal/r2/diagnostics/list');
            $Silian_checks['list_objects'] = false;
            $Silian_errors[] = 'ListObjects failed: ' . $Silian_e->getMessage();
        }
        // 预签名 PUT
        try {
            $Silian_tmpKey = 'diagnostics/_probe_' . date('Ymd_His') . '_' . substr(bin2hex(random_bytes(6)),0,12) . '.txt';
            $Silian_put = $this->generateUploadPresignedUrl($Silian_tmpKey, 'text/plain', 120);
            $Silian_checks['presign_put'] = true;
            $Silian_checks['presign_sample'] = [
                'file_path' => $Silian_tmpKey,
                'url_length' => strlen($Silian_put['url'])
            ];
        } catch (\Throwable $Silian_e) {
            $this->logFailure('r2_diagnostics_presign_failed', $Silian_e, [], '/internal/r2/diagnostics/presign');
            $Silian_checks['presign_put'] = false;
            $Silian_errors[] = 'Presign failed: ' . $Silian_e->getMessage();
        }
        // 计算 endpoint (用于调试展示)
        $Silian_endpoint = method_exists($this->s3Client, 'getEndpoint') ? (string)$this->s3Client->getEndpoint() : 'n/a';
        // 解析 endpoint 是否错误地包含 bucketName（导致双重 /bucket/bucket/）
        $Silian_parsed = parse_url($Silian_endpoint);
        $Silian_path = $Silian_parsed['path'] ?? '';
        $Silian_endpointHasBucketInPath = false;
        $Silian_recommendedEndpoint = $Silian_endpoint;
        if ($Silian_path && trim($Silian_path, '/') === $this->bucketName) {
            $Silian_endpointHasBucketInPath = true;
            // 去掉多余 path 的推荐写法
            $Silian_recommendedEndpoint = rtrim(str_replace('/' . trim($Silian_path, '/'), '', $Silian_endpoint), '/');
        }
        return [
            'bucket' => $this->bucketName,
            'endpoint' => $Silian_endpoint,
            'public_base' => $this->publicUrl,
            'endpoint_has_bucket_path' => $Silian_endpointHasBucketInPath,
            'recommended_endpoint' => $Silian_recommendedEndpoint,
            'tls_verify' => empty($_ENV['R2_DISABLE_TLS_VERIFY']),
            'checks' => $Silian_checks,
            'errors' => $Silian_errors,
            'timestamp' => date('c')
        ];
    }

    private function logFailure(string $Silian_action, \Throwable $Silian_e, array $Silian_context, string $Silian_path): void
    {
        try {
            $this->auditLogService->log([
                'action' => $Silian_action,
                'operation_category' => 'file_management',
                'actor_type' => 'system',
                'status' => 'failed',
                'data' => $Silian_context,
            ]);
        } catch (\Throwable $Silian_ignore) {
            // ignore audit failures in R2 service
        }

        if ($this->errorLogService === null) {
            return;
        }

        try {
            $Silian_request = SyntheticRequestFactory::fromContext($Silian_path, 'POST', null, [], $Silian_context);
            $this->errorLogService->logException($Silian_e, $Silian_request, ['context_message' => $Silian_action] + $Silian_context);
        } catch (\Throwable $Silian_ignore) {
            // ignore error log failures in R2 service
        }
    }
}

