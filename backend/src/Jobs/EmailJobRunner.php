<?php

declare(strict_types=1);

namespace CarbonTrack\Jobs;

use CarbonTrack\Support\SyntheticRequestFactory;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\EmailService;
use CarbonTrack\Services\ErrorLogService;
use Monolog\Logger;
use CarbonTrack\Services\NotificationPreferenceService;
use CarbonTrack\Models\Message;

class EmailJobRunner
{
    /**
     * Execute an email job immediately.
     *
     * @param array<string,mixed> $payload
     */
    public static function run(
        EmailService $Silian_emailService,
        Logger $Silian_logger,
        string $Silian_jobType,
        array $Silian_payload,
        ?AuditLogService $Silian_auditLogService = null,
        ?ErrorLogService $Silian_errorLogService = null
    ): void
    {
        if ($Silian_jobType === '') {
            $Silian_logger->warning('Email job received without a job type.');
            self::logAudit($Silian_auditLogService, 'email_job_missing_type', $Silian_jobType, $Silian_payload, 'failed');
            return;
        }

        try {
            switch ($Silian_jobType) {
                case 'message_notification':
                    self::runMessageNotificationJob($Silian_emailService, $Silian_logger, $Silian_payload);
                    break;

                case 'message_notification_bulk':
                    self::runBulkNotificationJob($Silian_emailService, $Silian_logger, $Silian_payload);
                    break;

                case 'exchange_confirmation':
                    self::runExchangeConfirmationJob($Silian_emailService, $Silian_logger, $Silian_payload);
                    break;

                case 'exchange_status_update':
                    self::runExchangeStatusUpdateJob($Silian_emailService, $Silian_logger, $Silian_payload);
                    break;

                case 'activity_approved_notification':
                    self::runActivityApprovedJob($Silian_emailService, $Silian_logger, $Silian_payload);
                    break;

                case 'activity_rejected_notification':
                    self::runActivityRejectedJob($Silian_emailService, $Silian_logger, $Silian_payload);
                    break;

                case 'broadcast_announcement':
                    self::runBroadcastAnnouncementJob($Silian_emailService, $Silian_logger, $Silian_payload);
                    break;

                case 'carbon_record_review_summary':
                    self::runCarbonRecordReviewSummaryJob($Silian_emailService, $Silian_logger, $Silian_payload);
                    break;

                default:
                    $Silian_logger->warning('Unknown email job type received', ['job_type' => $Silian_jobType]);
                    self::logAudit($Silian_auditLogService, 'email_job_unknown_type', $Silian_jobType, $Silian_payload, 'failed');
                    break;
            }

            self::logAudit($Silian_auditLogService, 'email_job_processed', $Silian_jobType, $Silian_payload);
        } catch (\Throwable $Silian_e) {
            $Silian_logger->error('Unhandled exception while executing email job', [
                'job_type' => $Silian_jobType,
                'error' => $Silian_e->getMessage(),
            ]);
            self::logAudit($Silian_auditLogService, 'email_job_failed', $Silian_jobType, $Silian_payload, 'failed', ['error' => $Silian_e->getMessage()]);
            self::logError($Silian_errorLogService, $Silian_e, $Silian_jobType, $Silian_payload);
        }
    }

    private static function logAudit(
        ?AuditLogService $Silian_auditLogService,
        string $Silian_action,
        string $Silian_jobType,
        array $Silian_payload,
        string $Silian_status = 'success',
        array $Silian_extra = []
    ): void {
        if (!$Silian_auditLogService) {
            return;
        }

        try {
            $Silian_auditLogService->logSystemEvent($Silian_action, 'email_job', [
                'status' => $Silian_status,
                'request_method' => 'CLI',
                'endpoint' => '/jobs/email/' . ($Silian_jobType !== '' ? $Silian_jobType : 'unknown'),
                'request_data' => array_merge([
                    'job_type' => $Silian_jobType,
                    'payload_keys' => array_keys($Silian_payload),
                ], $Silian_extra),
            ]);
        } catch (\Throwable $Silian_ignore) {
            // 审计日志失败不阻断任务
        }
    }

    private static function logError(?ErrorLogService $Silian_errorLogService, \Throwable $Silian_exception, string $Silian_jobType, array $Silian_payload): void
    {
        if (!$Silian_errorLogService) {
            return;
        }

        try {
            $Silian_request = SyntheticRequestFactory::fromContext(
                '/jobs/email/' . ($Silian_jobType !== '' ? $Silian_jobType : 'unknown'),
                'CLI',
                null,
                [],
                ['job_type' => $Silian_jobType, 'payload' => $Silian_payload],
                ['PHP_SAPI' => PHP_SAPI]
            );
            $Silian_errorLogService->logException($Silian_exception, $Silian_request, [
                'job_type' => $Silian_jobType,
            ]);
        } catch (\Throwable $Silian_ignore) {
            // swallow secondary logging failure
        }
    }

    /**
     * @param array<string,mixed> $payload
     */
    private static function runMessageNotificationJob(EmailService $Silian_emailService, Logger $Silian_logger, array $Silian_payload): void
    {
        $Silian_email = (string) ($Silian_payload['email'] ?? '');
        $Silian_name = (string) ($Silian_payload['name'] ?? '');
        $Silian_subject = (string) ($Silian_payload['subject'] ?? '');
        $Silian_content = (string) ($Silian_payload['content'] ?? '');
        $Silian_category = (string) ($Silian_payload['category'] ?? NotificationPreferenceService::CATEGORY_SYSTEM);
        $Silian_priority = (string) ($Silian_payload['priority'] ?? Message::PRIORITY_NORMAL);
        $Silian_receiverId = isset($Silian_payload['receiver_id']) ? (int) $Silian_payload['receiver_id'] : 0;
        $Silian_notificationType = (string) ($Silian_payload['type'] ?? '');

        $Silian_sent = $Silian_emailService->sendMessageNotification(
            $Silian_email,
            $Silian_name !== '' ? $Silian_name : $Silian_email,
            $Silian_subject,
            $Silian_content,
            $Silian_category,
            $Silian_priority
        );

        if (!$Silian_sent) {
            $Silian_logger->debug('Message email was skipped due to user preferences or simulation mode', [
                'receiver_id' => $Silian_receiverId,
                'category' => $Silian_category,
                'notification_type' => $Silian_notificationType,
            ]);
        }
    }

    /**
     * @param array<string,mixed> $payload
     */
    private static function runBulkNotificationJob(EmailService $Silian_emailService, Logger $Silian_logger, array $Silian_payload): void
    {
        $Silian_recipients = $Silian_payload['recipients'] ?? [];
        if (!is_array($Silian_recipients)) {
            $Silian_logger->warning('Bulk email job received invalid recipients payload.');
            return;
        }

        $Silian_subject = (string) ($Silian_payload['subject'] ?? '');
        $Silian_content = (string) ($Silian_payload['content'] ?? '');
        $Silian_category = (string) ($Silian_payload['category'] ?? NotificationPreferenceService::CATEGORY_SYSTEM);
        $Silian_priority = (string) ($Silian_payload['priority'] ?? Message::PRIORITY_NORMAL);
        $Silian_notificationType = (string) ($Silian_payload['type'] ?? '');

        $Silian_sent = $Silian_emailService->sendMessageNotificationToMany(
            $Silian_recipients,
            $Silian_subject,
            $Silian_content,
            $Silian_category,
            $Silian_priority
        );

        if (!$Silian_sent) {
            $Silian_logger->debug('Bulk message email was skipped', [
                'subject' => $Silian_subject,
                'category' => $Silian_category,
                'priority' => $Silian_priority,
                'notification_type' => $Silian_notificationType,
                'recipient_count' => count($Silian_recipients),
            ]);
        }
    }

    /**
     * @param array<string,mixed> $payload
     */
    private static function runActivityApprovedJob(EmailService $Silian_emailService, Logger $Silian_logger, array $Silian_payload): void
    {
        $Silian_email = (string) ($Silian_payload['email'] ?? '');
        if ($Silian_email === '') {
            $Silian_logger->warning('Activity approved job missing recipient email.');
            return;
        }

        $Silian_name = (string) ($Silian_payload['name'] ?? $Silian_email);
        $Silian_activity = (string) ($Silian_payload['activity_name'] ?? '');
        $Silian_points = (float) ($Silian_payload['points'] ?? 0);
        $Silian_userId = isset($Silian_payload['user_id']) ? (int) $Silian_payload['user_id'] : 0;

        try {
            $Silian_emailService->sendActivityApprovedNotification(
                $Silian_email,
                $Silian_name !== '' ? $Silian_name : $Silian_email,
                $Silian_activity,
                $Silian_points
            );
        } catch (\Throwable $Silian_e) {
            $Silian_logger->warning('Failed to send activity approved email', [
                'user_id' => $Silian_userId,
                'error' => $Silian_e->getMessage(),
            ]);
        }
    }

    /**
     * @param array<string,mixed> $payload
     */
    private static function runActivityRejectedJob(EmailService $Silian_emailService, Logger $Silian_logger, array $Silian_payload): void
    {
        $Silian_email = (string) ($Silian_payload['email'] ?? '');
        if ($Silian_email === '') {
            $Silian_logger->warning('Activity rejected job missing recipient email.');
            return;
        }

        $Silian_name = (string) ($Silian_payload['name'] ?? $Silian_email);
        $Silian_activity = (string) ($Silian_payload['activity_name'] ?? '');
        $Silian_reason = (string) ($Silian_payload['reason'] ?? '');
        $Silian_userId = isset($Silian_payload['user_id']) ? (int) $Silian_payload['user_id'] : 0;

        try {
            $Silian_emailService->sendActivityRejectedNotification(
                $Silian_email,
                $Silian_name !== '' ? $Silian_name : $Silian_email,
                $Silian_activity,
                $Silian_reason
            );
        } catch (\Throwable $Silian_e) {
            $Silian_logger->warning('Failed to send activity rejected email', [
                'user_id' => $Silian_userId,
                'error' => $Silian_e->getMessage(),
            ]);
        }
    }

    /**
     * @param array<string,mixed> $payload
     */
    private static function runBroadcastAnnouncementJob(EmailService $Silian_emailService, Logger $Silian_logger, array $Silian_payload): void
    {
        $Silian_recipients = $Silian_payload['recipients'] ?? [];
        if (!is_array($Silian_recipients) || empty($Silian_recipients)) {
            $Silian_logger->debug('Broadcast announcement job skipped due to empty recipients.');
            return;
        }

        $Silian_title = (string) ($Silian_payload['title'] ?? '');
        $Silian_content = (string) ($Silian_payload['content'] ?? '');
        $Silian_priority = (string) ($Silian_payload['priority'] ?? Message::PRIORITY_NORMAL);
        $Silian_context = isset($Silian_payload['context']) && is_array($Silian_payload['context']) ? $Silian_payload['context'] : [];
        $Silian_contentFormat = (string) ($Silian_payload['content_format'] ?? ($Silian_context['content_format'] ?? 'text'));
        $Silian_renderProfile = $Silian_payload['render_profile'] ?? ($Silian_context['render_profile'] ?? null);
        $Silian_renderVersion = isset($Silian_payload['render_version']) ? (int) $Silian_payload['render_version'] : (($Silian_context['render_version'] ?? null) !== null ? (int) $Silian_context['render_version'] : null);
        $Silian_sourceKind = $Silian_payload['source_kind'] ?? ($Silian_context['source_kind'] ?? null);

        $Silian_cleanedRecipients = [];
        foreach ($Silian_recipients as $Silian_entry) {
            if (!is_array($Silian_entry)) {
                continue;
            }
            $Silian_email = isset($Silian_entry['email']) ? trim((string) $Silian_entry['email']) : '';
            if ($Silian_email === '') {
                continue;
            }
            $Silian_name = isset($Silian_entry['name']) && $Silian_entry['name'] !== ''
                ? (string) $Silian_entry['name']
                : $Silian_email;
            $Silian_cleanedRecipients[] = [
                'email' => $Silian_email,
                'name' => $Silian_name,
            ];
        }

        if (empty($Silian_cleanedRecipients)) {
            $Silian_logger->debug('Broadcast announcement job skipped after cleaning recipients.');
            return;
        }

        try {
            $Silian_sent = $Silian_emailService->sendAnnouncementBroadcast(
                $Silian_cleanedRecipients,
                $Silian_title,
                $Silian_content,
                $Silian_priority,
                $Silian_contentFormat,
                is_string($Silian_renderProfile) ? $Silian_renderProfile : null,
                $Silian_renderVersion,
                is_string($Silian_sourceKind) ? $Silian_sourceKind : null
            );

            if (!$Silian_sent) {
                $Silian_logger->debug('Broadcast announcement email was not dispatched.', [
                    'recipient_count' => count($Silian_cleanedRecipients),
                    'priority' => $Silian_priority,
                ]);
            }
        } catch (\Throwable $Silian_e) {
            $Silian_logger->error('Failed to send broadcast announcement email', [
                'error' => $Silian_e->getMessage(),
                'recipient_count' => count($Silian_cleanedRecipients),
            ]);
        }
    }

    /**
     * @param array<string,mixed> $payload
     */
    private static function runCarbonRecordReviewSummaryJob(EmailService $Silian_emailService, Logger $Silian_logger, array $Silian_payload): void
    {
        $Silian_email = (string) ($Silian_payload['email'] ?? '');
        if ($Silian_email === '') {
            $Silian_logger->warning('Carbon record review summary job missing recipient email.');
            return;
        }

        $Silian_name = (string) ($Silian_payload['name'] ?? $Silian_email);
        $Silian_action = strtolower((string) ($Silian_payload['action'] ?? 'approve')) === 'approve' ? 'approve' : 'reject';
        $Silian_title = (string) ($Silian_payload['title'] ?? ($Silian_action === 'approve' ? 'Carbon record review approved' : 'Carbon record review result'));
        $Silian_records = $Silian_payload['records'] ?? [];
        if (!is_array($Silian_records)) {
            $Silian_records = [];
        }
        $Silian_reviewNote = isset($Silian_payload['review_note']) ? (string) $Silian_payload['review_note'] : null;
        $Silian_reviewedBy = isset($Silian_payload['reviewed_by']) ? (string) $Silian_payload['reviewed_by'] : null;

        try {
            $Silian_emailService->sendCarbonRecordReviewSummaryEmail(
                $Silian_email,
                $Silian_name,
                $Silian_action,
                $Silian_records,
                $Silian_title,
                $Silian_reviewNote,
                $Silian_reviewedBy
            );
        } catch (\Throwable $Silian_e) {
            $Silian_logger->warning('Failed to send carbon record review summary email', [
                'email' => $Silian_email,
                'error' => $Silian_e->getMessage(),
            ]);
        }
    }

    private static function runExchangeConfirmationJob(EmailService $Silian_emailService, Logger $Silian_logger, array $Silian_payload): void

    {
        $Silian_email = (string) ($Silian_payload['email'] ?? '');
        if ($Silian_email === '') {
            $Silian_logger->warning('Exchange confirmation job missing recipient email.');
            return;
        }

        $Silian_name = (string) ($Silian_payload['name'] ?? $Silian_email);
        $Silian_product = (string) ($Silian_payload['product_name'] ?? '');
        $Silian_quantity = (int) ($Silian_payload['quantity'] ?? 1);
        $Silian_points = (float) ($Silian_payload['points_spent'] ?? 0);
        $Silian_userId = isset($Silian_payload['user_id']) ? (int) $Silian_payload['user_id'] : 0;

        try {
            $Silian_emailService->sendExchangeConfirmation(
                $Silian_email,
                $Silian_name !== '' ? $Silian_name : $Silian_email,
                $Silian_product,
                $Silian_quantity,
                $Silian_points
            );
        } catch (\Throwable $Silian_e) {
            $Silian_logger->warning('Failed to send exchange confirmation email', [
                'user_id' => $Silian_userId,
                'error' => $Silian_e->getMessage(),
            ]);
        }
    }

    /**
     * @param array<string,mixed> $payload
     */
    private static function runExchangeStatusUpdateJob(EmailService $Silian_emailService, Logger $Silian_logger, array $Silian_payload): void
    {
        $Silian_email = (string) ($Silian_payload['email'] ?? '');
        if ($Silian_email === '') {
            $Silian_logger->warning('Exchange status update job missing recipient email.');
            return;
        }

        $Silian_name = (string) ($Silian_payload['name'] ?? $Silian_email);
        $Silian_product = (string) ($Silian_payload['product_name'] ?? '');
        $Silian_status = (string) ($Silian_payload['status'] ?? '');
        $Silian_notes = (string) ($Silian_payload['notes'] ?? '');
        $Silian_userId = isset($Silian_payload['user_id']) ? (int) $Silian_payload['user_id'] : 0;

        try {
            $Silian_emailService->sendExchangeStatusUpdate(
                $Silian_email,
                $Silian_name !== '' ? $Silian_name : $Silian_email,
                $Silian_product,
                $Silian_status,
                $Silian_notes
            );
        } catch (\Throwable $Silian_e) {
            $Silian_logger->warning('Failed to send exchange status update email', [
                'user_id' => $Silian_userId,
                'error' => $Silian_e->getMessage(),
            ]);
        }
    }
}
