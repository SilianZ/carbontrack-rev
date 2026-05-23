<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Models\MultipartUpload;
use CarbonTrack\Support\SyntheticRequestFactory;
use Monolog\Logger;

class MultipartUploadService
{
    public function __construct(
        private Logger $logger,
        private ?AuditLogService $auditLogService = null,
        private ?ErrorLogService $errorLogService = null
    ) {}

    public function registerUpload(string $Silian_uploadId, string $Silian_filePath, int $Silian_userId, string|int|null $Silian_sha256 = null, int $Silian_ttlSeconds = 86400): MultipartUpload
    {
        if (is_int($Silian_sha256) && $Silian_ttlSeconds === 86400) {
            $Silian_ttlSeconds = $Silian_sha256;
            $Silian_sha256 = null;
        }

        $Silian_upload = MultipartUpload::updateOrCreate(
            ['upload_id' => $Silian_uploadId],
            [
                'file_path' => $Silian_filePath,
                'sha256' => $Silian_sha256,
                'user_id' => $Silian_userId,
                'expires_at' => date('Y-m-d H:i:s', time() + max(60, $Silian_ttlSeconds)),
            ]
        );

        $this->logAudit('multipart_upload_registered', [
            'upload_id' => $Silian_uploadId,
            'file_path' => $Silian_filePath,
            'sha256' => $Silian_sha256,
            'user_id' => $Silian_userId,
            'ttl_seconds' => max(60, $Silian_ttlSeconds),
        ]);

        return $Silian_upload;
    }

    public function findActiveUpload(string $Silian_uploadId): ?MultipartUpload
    {
        $Silian_upload = MultipartUpload::where('upload_id', $Silian_uploadId)->first();
        if (!$Silian_upload) {
            return null;
        }

        if ($this->isExpired($Silian_upload)) {
            try {
                $Silian_upload->delete();
                $this->logAudit('multipart_upload_expired_cleared', [
                    'upload_id' => $Silian_uploadId,
                    'user_id' => $Silian_upload->user_id,
                ]);
            } catch (\Throwable $Silian_e) {
                $this->logAudit('multipart_upload_expired_clear_failed', [
                    'upload_id' => $Silian_uploadId,
                    'user_id' => $Silian_upload->user_id,
                ], 'failed');
                $this->logError($Silian_e, '/internal/files/multipart/expired-cleanup', 'Failed to delete expired multipart upload tracker', [
                    'upload_id' => $Silian_uploadId,
                    'user_id' => $Silian_upload->user_id,
                ]);
                $this->logger->warning('Failed to delete expired multipart upload tracker', [
                    'upload_id' => $Silian_uploadId,
                    'error' => $Silian_e->getMessage(),
                ]);
            }
            return null;
        }

        return $Silian_upload;
    }

    public function clearUpload(string $Silian_uploadId): void
    {
        $Silian_deleted = MultipartUpload::where('upload_id', $Silian_uploadId)->delete();
        if ($Silian_deleted > 0) {
            $this->logAudit('multipart_upload_cleared', [
                'upload_id' => $Silian_uploadId,
                'deleted_count' => $Silian_deleted,
            ]);
        }
    }

    private function isExpired(MultipartUpload $Silian_upload): bool
    {
        $Silian_expiresAt = $Silian_upload->expires_at;
        if ($Silian_expiresAt === null) {
            return false;
        }

        if ($Silian_expiresAt instanceof \DateTimeInterface) {
            return $Silian_expiresAt->getTimestamp() < time();
        }

        $Silian_timestamp = strtotime((string) $Silian_expiresAt);
        return $Silian_timestamp !== false && $Silian_timestamp < time();
    }

    private function logAudit(string $Silian_action, array $Silian_context = [], string $Silian_status = 'success'): void
    {
        if ($this->auditLogService === null) {
            return;
        }

        try {
            $this->auditLogService->log([
                'action' => $Silian_action,
                'operation_category' => 'file_management',
                'actor_type' => 'system',
                'status' => $Silian_status,
                'data' => $Silian_context,
            ]);
        } catch (\Throwable $Silian_ignore) {
            // ignore audit failures in multipart tracking
        }
    }

    private function logError(\Throwable $Silian_e, string $Silian_path, string $Silian_message, array $Silian_context = []): void
    {
        if ($this->errorLogService === null) {
            return;
        }

        try {
            $Silian_request = SyntheticRequestFactory::fromContext($Silian_path, 'POST', null, [], $Silian_context);
            $this->errorLogService->logException($Silian_e, $Silian_request, ['context_message' => $Silian_message] + $Silian_context);
        } catch (\Throwable $Silian_ignore) {
            // ignore error log failures in multipart tracking
        }
    }
}
