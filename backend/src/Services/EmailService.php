<?php

namespace CarbonTrack\Services;

use CarbonTrack\Models\Message;
use CarbonTrack\Support\SyntheticRequestFactory;
use Monolog\Logger;
use PHPMailer\PHPMailer\PHPMailer;

class EmailService
{
    protected ?PHPMailer $mailer = null;
    protected $config;
    protected $logger;
    protected bool $forceSimulation = false;
    private ?string $lastError = null;
    // These will be initialized from environment variables (with config fallbacks) in the constructor
    private string $fromAddress;
    private string $fromName;
    private string $appName;
    private string $supportEmail;
    private ?string $frontendUrl = null;
    private ?NotificationPreferenceService $preferenceService = null;
    private ?AuditLogService $auditLogService = null;
    private ?ErrorLogService $errorLogService = null;

    private const TAG_ACTIVITY_NAME = '{{activity_name}}';
    private const TAG_POINTS_EARNED = '{{points_earned}}';
    private const TAG_REASON = '{{reason}}';
    private const TAG_PRODUCT_NAME = '{{product_name}}';
    private const TAG_QUANTITY = '{{quantity}}';
    private const TAG_TOTAL_POINTS = '{{total_points}}';
    private const TAG_STATUS = '{{status}}';
    private const TAG_ADMIN_NOTES = '{{admin_notes}}';
    private const BROADCAST_CONTENT_FORMAT_TEXT = 'text';
    private const BROADCAST_CONTENT_FORMAT_HTML = 'html';
    private const BROADCAST_RENDER_PROFILE_HTML = 'announcement_html_v1';
    private const DEFAULT_LAYOUT_TEMPLATE = <<<HTML
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>{{email_title}}</title>
</head>
<body style="margin:0;padding:24px;font-family:Arial,sans-serif;background-color:#f5f7fa;color:#1f2937;">
    <div style="max-width:640px;margin:0 auto;background:#ffffff;border-radius:12px;overflow:hidden;padding:32px;box-shadow:0 10px 40px rgba(15,23,42,0.08);">
        <h1 style="margin-top:0;font-size:24px;color:#0ea5e9;">{{email_title}}</h1>
        <div style="font-size:16px;line-height:1.6;">{{content}}</div>
        {{buttons}}
        <div style="margin-top:32px;font-size:13px;color:#6b7280;border-top:1px solid #e5e7eb;padding-top:16px;text-align:center;">
            <p style="margin:0 0 8px 0;">&copy; {{current_year}} {{app_name}}. All rights reserved.</p>
            <p style="margin:0;">Need help? <a href="mailto:{{support_email}}" style="color:#0ea5e9;text-decoration:none;">{{support_email}}</a></p>
            {{footer_note}}
        </div>
    </div>
</body>
</html>
HTML;
    private const DEFAULT_BUTTON_COLOR = '#0ea5e9';

    public function __construct(
        array $Silian_config,
        Logger $Silian_logger,
        ?NotificationPreferenceService $Silian_preferenceService = null,
        ?AuditLogService $Silian_auditLogService = null,
        ?ErrorLogService $Silian_errorLogService = null
    )
    {
        $this->config = $Silian_config;
        $this->logger = $Silian_logger;
        $this->preferenceService = $Silian_preferenceService;
        $this->auditLogService = $Silian_auditLogService;
        $this->errorLogService = $Silian_errorLogService;
        $this->forceSimulation = $this->normalizeForceSimulation($Silian_config['force_simulation'] ?? false);

        // Initialize identity fields from environment first, then config, then sane defaults
        $this->fromAddress = (string) ($_ENV['MAIL_FROM_ADDRESS']
            ?? ($this->config['from_address'] ?? $this->config['from_email'] ?? 'noreply@example.com'));
        $this->fromName = (string) ($_ENV['MAIL_FROM_NAME']
            ?? ($this->config['from_name'] ?? 'CarbonTrack'));

        if (!$this->forceSimulation && class_exists(PHPMailer::class)) {
            $this->mailer = new PHPMailer(true);
            $this->configureMailer();
        } else {
            $this->mailer = null;

            if ($this->forceSimulation) {
                $this->logger->info('EmailService running in forced simulation mode.');
            } else {
                $this->logger->warning('PHPMailer not available; EmailService will simulate sending emails.');
            }
        }

        // APP_NAME (or fallback to MAIL_FROM_NAME, then config, then 'CarbonTrack')
        $Silian_appNameEnv = $_ENV['APP_NAME'] ?? ($_ENV['MAIL_FROM_NAME'] ?? null);
        if (is_string($Silian_appNameEnv) && trim($Silian_appNameEnv) !== '') {
            $this->appName = $Silian_appNameEnv;
        } elseif (is_string($this->config['app_name'] ?? null) && trim((string) $this->config['app_name']) !== '') {
            $this->appName = (string) $this->config['app_name'];
        } else {
            $this->appName = $this->fromName ?: 'CarbonTrack';
        }

        // SUPPORT_EMAIL (or fallback to reply_to, then MAIL_FROM_ADDRESS, then default)
        $Silian_support = $_ENV['SUPPORT_EMAIL']
            ?? ($this->config['support_email'] ?? ($this->config['reply_to'] ?? null));
        if (!is_string($Silian_support) || trim((string) $Silian_support) === '') {
            $Silian_support = $_ENV['MAIL_FROM_ADDRESS'] ?? $this->fromAddress ?? 'support@example.com';
        }
        $this->supportEmail = (string) $Silian_support;

        // FRONTEND_URL (prefer explicit env, then APP_URL, then config)
        $Silian_frontend = $_ENV['FRONTEND_URL']
            ?? ($_ENV['APP_URL'] ?? ($this->config['frontend_url'] ?? null));
        $this->frontendUrl = is_string($Silian_frontend) && trim((string) $Silian_frontend) !== '' ? (string) $Silian_frontend : null;
    }

    private function normalizeForceSimulation($Silian_value): bool
    {
        if (is_bool($Silian_value)) {
            return $Silian_value;
        }

        if (is_string($Silian_value)) {
            $Silian_value = strtolower(trim($Silian_value));
            return in_array($Silian_value, ['1', 'true', 'yes', 'on'], true);
        }

        return (bool) $Silian_value;
    }

    private function configureMailer(): void
    {
        try {
            if ($this->mailer === null) {
                return;
            }

            $Silian_debugLevel = (int) ($this->config['smtp_debug'] ?? 0);
            $this->mailer->SMTPDebug = $Silian_debugLevel;
            if ($Silian_debugLevel > 0) {
                $this->mailer->Debugoutput = function ($Silian_str, $Silian_level): void {
                    try {
                        $this->logger->debug('SMTP debug output', ['level' => $Silian_level, 'message' => $Silian_str]);
                    } catch (\Throwable $Silian_logError) {
                        // Swallow logging errors to avoid breaking mail flow
                    }
                };
            }

            $this->mailer->isSMTP();
            $this->mailer->Host = $this->config['host'] ?? '';
            $this->mailer->SMTPAuth = !empty($this->config['username']);
            $this->mailer->Username = $this->config['username'] ?? '';
            $this->mailer->Password = $this->config['password'] ?? '';

            $Silian_encryption = $this->config['encryption'] ?? 'tls';
            if (in_array($Silian_encryption, ['ssl', 'tls'], true)) {
                $Silian_constant = $Silian_encryption === 'ssl'
                    ? 'PHPMailer\\PHPMailer\\PHPMailer::ENCRYPTION_SMTPS'
                    : 'PHPMailer\\PHPMailer\\PHPMailer::ENCRYPTION_STARTTLS';

                $this->mailer->SMTPSecure = defined($Silian_constant) ? constant($Silian_constant) : $Silian_encryption;
            } else {
                $this->mailer->SMTPSecure = $Silian_encryption;
            }

            $this->mailer->Port = (int) ($this->config['port'] ?? 587);

            // Prioritize environment variables for identity fields
            $Silian_fromAddress = $_ENV['MAIL_FROM_ADDRESS']
                ?? ($this->config['from_address'] ?? ($this->config['from_email'] ?? 'noreply@example.com'));
            $Silian_fromName = $_ENV['MAIL_FROM_NAME']
                ?? ($this->config['from_name'] ?? 'CarbonTrack');
            $this->fromAddress = $Silian_fromAddress ?: 'noreply@example.com';
            $this->fromName = $Silian_fromName ?: 'CarbonTrack';

            $this->mailer->setFrom($this->fromAddress, $this->fromName);
            $this->mailer->isHTML(true);
            $this->mailer->CharSet = 'UTF-8';
        } catch (\Throwable $Silian_e) {
            $this->logger->error("Mailer configuration error: {$Silian_e->getMessage()}");
            $this->logAudit('email_service_configuration_failed', [
                'host' => $this->config['host'] ?? null,
                'port' => $this->config['port'] ?? null,
            ], 'failed');
            $this->logError($Silian_e, '/internal/email/configure', 'Mailer configuration error', [
                'host' => $this->config['host'] ?? null,
                'port' => $this->config['port'] ?? null,
            ]);
            $this->mailer = null;
        }
    }

    public function sendEmail(string $Silian_toEmail, string $Silian_toName, string $Silian_subject, string $Silian_bodyHtml, string $Silian_bodyText = ""): bool
    {
        $this->lastError = null;
        try {
            $Silian_mailer = $this->mailer;

            if (!$this->forceSimulation && $Silian_mailer instanceof PHPMailer) {
                $Silian_mailer->clearAddresses();
                if (method_exists($Silian_mailer, 'clearAttachments')) {
                    $Silian_mailer->clearAttachments();
                }
                if (method_exists($Silian_mailer, 'clearBCCs')) {
                    $Silian_mailer->clearBCCs();
                }
                $Silian_mailer->addAddress($Silian_toEmail, $Silian_toName);

                $Silian_mailer->Subject = $Silian_subject;
                $Silian_mailer->Body = $Silian_bodyHtml;
                $Silian_mailer->AltBody = $Silian_bodyText ?: strip_tags($Silian_bodyHtml);

                $Silian_mailer->send();
                $this->logger->info('Email sent successfully', ['to' => $Silian_toEmail, 'subject' => $Silian_subject]);
                $this->logAudit('email_sent', [
                    'to' => $Silian_toEmail,
                    'subject' => $Silian_subject,
                    'delivery_mode' => 'smtp',
                ]);
                return true;
            }

            $Silian_reason = $this->forceSimulation ? 'force_simulation' : 'mailer_unavailable';
            $this->logger->info('Simulated email send', ['to' => $Silian_toEmail, 'subject' => $Silian_subject, 'reason' => $Silian_reason]);
            $this->logAudit('email_simulated', [
                'to' => $Silian_toEmail,
                'subject' => $Silian_subject,
                'reason' => $Silian_reason,
            ]);
            return true;
        } catch (\Throwable $Silian_e) {
            $this->logger->error('Message could not be sent.', ['to' => $Silian_toEmail, 'subject' => $Silian_subject, 'error' => $Silian_e->getMessage()]);
            $this->logAudit('email_send_failed', [
                'to' => $Silian_toEmail,
                'subject' => $Silian_subject,
            ], 'failed');
            $this->logError($Silian_e, '/internal/email/send', 'Email send failed', [
                'to' => $Silian_toEmail,
                'subject' => $Silian_subject,
            ]);
            $this->lastError = $Silian_e->getMessage();
            return false;
        }
    }

    /**
     * Send a broadcast email using BCC to protect recipient privacy
     * @param array<int, array{email:string, name: string|null}> $recipients
     */
    public function sendBroadcastEmail(array $Silian_recipients, string $Silian_subject, string $Silian_bodyHtml, string $Silian_bodyText = "", ?string $Silian_category = null): bool
    {
        $this->lastError = null;
        $Silian_category = $Silian_category ?: NotificationPreferenceService::CATEGORY_ANNOUNCEMENT;
        $Silian_cleaned = [];
        foreach ($Silian_recipients as $Silian_recipient) {
            $Silian_email = trim((string)($Silian_recipient['email'] ?? ''));
            if ($Silian_email === '') {
                continue;
            }
            $Silian_name = $Silian_recipient['name'] ?? null;
            if (!$this->shouldSendEmail($Silian_email, $Silian_category)) {
                continue;
            }
            $Silian_cleaned[] = ['email' => $Silian_email, 'name' => $Silian_name];
        }

        if (empty($Silian_cleaned)) {
            $this->lastError = 'No deliverable email recipients provided';
            $this->logAudit('broadcast_email_skipped_no_recipients', [
                'subject' => $Silian_subject,
                'category' => $Silian_category,
                'requested_recipient_count' => count($Silian_recipients),
            ], 'skipped');
            return false;
        }

        try {
            $Silian_mailer = $this->mailer;

            if (!$this->forceSimulation && $Silian_mailer instanceof PHPMailer) {
                if (method_exists($Silian_mailer, 'clearAddresses')) {
                    $Silian_mailer->clearAddresses();
                }
                if (method_exists($Silian_mailer, 'clearBCCs')) {
                    $Silian_mailer->clearBCCs();
                }
                if (method_exists($Silian_mailer, 'clearAttachments')) {
                    $Silian_mailer->clearAttachments();
                }

                $Silian_mailer->addAddress($this->fromAddress, $this->fromName);
                foreach ($Silian_cleaned as $Silian_recipient) {
                    $Silian_mailer->addBCC($Silian_recipient['email'], (string)($Silian_recipient['name'] ?? ''));
                }

                $Silian_mailer->Subject = $Silian_subject;
                $Silian_mailer->Body = $Silian_bodyHtml;
                $Silian_mailer->AltBody = $Silian_bodyText ?: strip_tags($Silian_bodyHtml);

                $Silian_mailer->send();
                $this->logger->info('Broadcast email sent successfully', [
                    'recipient_count' => count($Silian_cleaned),
                    'subject' => $Silian_subject,
                    'category' => $Silian_category,
                ]);
                $this->logAudit('broadcast_email_sent', [
                    'recipient_count' => count($Silian_cleaned),
                    'subject' => $Silian_subject,
                    'category' => $Silian_category,
                    'delivery_mode' => 'smtp',
                ]);
                return true;
            }

            $Silian_reason = $this->forceSimulation ? 'force_simulation' : 'mailer_unavailable';
            $this->logger->info('Simulated broadcast email send', [
                'recipient_count' => count($Silian_cleaned),
                'subject' => $Silian_subject,
                'reason' => $Silian_reason,
                'category' => $Silian_category,
            ]);
            $this->logAudit('broadcast_email_simulated', [
                'recipient_count' => count($Silian_cleaned),
                'subject' => $Silian_subject,
                'reason' => $Silian_reason,
                'category' => $Silian_category,
            ]);
            return true;
        } catch (\Throwable $Silian_e) {
            $this->logger->error('Broadcast email could not be sent.', [
                'subject' => $Silian_subject,
                'error' => $Silian_e->getMessage()
            ]);
            $this->logAudit('broadcast_email_failed', [
                'subject' => $Silian_subject,
                'category' => $Silian_category,
                'requested_recipient_count' => count($Silian_recipients),
            ], 'failed');
            $this->logError($Silian_e, '/internal/email/broadcast', 'Broadcast email send failed', [
                'subject' => $Silian_subject,
                'category' => $Silian_category,
                'requested_recipient_count' => count($Silian_recipients),
            ]);
            $this->lastError = $Silian_e->getMessage();
            return false;
        }
    }

    public function sendMessageNotification(
        string $Silian_toEmail,
        string $Silian_toName,
        string $Silian_subject,
        string $Silian_messageBody,
        string $Silian_category,
        string $Silian_priority = Message::PRIORITY_NORMAL
    ): bool {
        if (!$this->shouldSendEmail($Silian_toEmail, $Silian_category)) {
            return false;
        }

        $Silian_buttons = [];
        $Silian_messagesUrl = $this->buildFrontendUrl('messages');
        if ($Silian_messagesUrl) {
            $Silian_buttons[] = [
                'text' => 'View in CarbonTrack',
                'url' => $Silian_messagesUrl,
                'color' => self::DEFAULT_BUTTON_COLOR,
            ];
        }

        $Silian_priorityNotice = $this->buildPriorityNoticeText($Silian_priority);

        $Silian_contentHtml = '<p style="margin:0 0 16px 0;">' . sprintf('Hello %s,', $this->esc($Silian_toName)) . '</p>';
        if ($Silian_priorityNotice !== '') {
            $Silian_contentHtml .= '<p style="margin:0 0 16px 0;color:#dc2626;font-weight:600;">' . $this->esc($Silian_priorityNotice) . '</p>';
        }
        $Silian_contentHtml .= '<p style="margin:0 0 12px 0;">You have a new notification in ' . $this->esc($this->appName) . '.</p>';
        $Silian_contentHtml .= '<div style="margin:16px 0;padding:16px;background:#f8fafc;border-radius:12px;">'
            . $this->renderMessageContentHtml($Silian_messageBody)
            . '</div>';
        $Silian_contentHtml .= '<p style="margin:12px 0 0 0;">You can review the full details in the app at any time.</p>';

        $Silian_bodyHtml = $this->renderLayout($Silian_subject, $Silian_contentHtml, $Silian_buttons);
        $Silian_bodyText = $this->buildTextBody($Silian_bodyHtml, $Silian_buttons);

        return $this->sendEmail($Silian_toEmail, $Silian_toName, $Silian_subject, $Silian_bodyHtml, $Silian_bodyText);
    }

    /**
     * @param array{
     *   eyebrow?: string,
     *   intro?: string,
     *   summary?: string,
     *   ticket?: array{id?: int|string|null,subject?: string|null},
     *   details?: array<int, array{label:string,value:string}>,
     *   changes?: array<int, array{label:string,from?:string|null,to?:string|null,value?:string|null}>,
     *   message?: array{label?:string,body?:string|null},
     *   button_label?: string,
     *   button_path?: string,
     *   closing?: string,
     *   footer_note?: string
     * } $payload
     */
    public function sendSupportTicketNotification(
        string $Silian_toEmail,
        string $Silian_toName,
        string $Silian_subject,
        array $Silian_payload,
        string $Silian_category,
        string $Silian_priority = Message::PRIORITY_NORMAL
    ): bool {
        if (!$this->shouldSendEmail($Silian_toEmail, $Silian_category)) {
            return false;
        }

        $Silian_buttons = [];
        $Silian_buttonPath = trim((string) ($Silian_payload['button_path'] ?? ''));
        $Silian_buttonUrl = $Silian_buttonPath !== '' ? $this->buildFrontendUrl($Silian_buttonPath) : null;
        if ($Silian_buttonUrl) {
            $Silian_buttons[] = [
                'text' => (string) ($Silian_payload['button_label'] ?? 'Open ticket'),
                'url' => $Silian_buttonUrl,
                'color' => self::DEFAULT_BUTTON_COLOR,
            ];
        }

        $Silian_priorityNotice = $this->buildPriorityNoticeText($Silian_priority);
        $Silian_contentHtml = '<p style="margin:0 0 16px 0;">' . sprintf('Hello %s,', $this->esc($Silian_toName)) . '</p>';
        if ($Silian_priorityNotice !== '') {
            $Silian_contentHtml .= '<p style="margin:0 0 16px 0;color:#dc2626;font-weight:600;">' . $this->esc($Silian_priorityNotice) . '</p>';
        }

        $Silian_contentHtml .= $this->renderSupportTicketNotificationContent($Silian_payload);

        $Silian_bodyHtml = $this->renderLayout(
            $Silian_subject,
            $Silian_contentHtml,
            $Silian_buttons,
            isset($Silian_payload['footer_note']) ? (string) $Silian_payload['footer_note'] : null
        );
        $Silian_bodyText = $this->buildTextBody($Silian_bodyHtml, $Silian_buttons);

        return $this->sendEmail($Silian_toEmail, $Silian_toName, $Silian_subject, $Silian_bodyHtml, $Silian_bodyText);
    }

    /**
     * @param array<int, array{email:string,name:string|null}> $recipients
     */
    public function sendAnnouncementBroadcast(
        array $Silian_recipients,
        string $Silian_title,
        string $Silian_content,
        string $Silian_priority = Message::PRIORITY_NORMAL,
        string $Silian_contentFormat = self::BROADCAST_CONTENT_FORMAT_TEXT,
        ?string $Silian_renderProfile = null,
        ?int $Silian_renderVersion = null,
        ?string $Silian_sourceKind = null
    ): bool {
        if (empty($Silian_recipients)) {
            $this->lastError = 'No deliverable email recipients provided';
            return false;
        }

        $Silian_subject = $this->buildAnnouncementSubject($Silian_title, $Silian_priority);
        $Silian_priorityNotice = $this->buildPriorityNoticeText($Silian_priority);

        $Silian_contentHtml = '<p style="margin:0 0 16px 0;">'
            . sprintf('Hello %s community member,', $this->esc($this->appName))
            . '</p>';

        if ($Silian_priorityNotice !== '') {
            $Silian_contentHtml .= '<p style="margin:0 0 16px 0;color:#dc2626;font-weight:600;">' . $this->esc($Silian_priorityNotice) . '</p>';
        }

        $Silian_leadIn = $this->esc($this->appName) . ' has published a new announcement';
        $Silian_contentHtml .= '<p style="margin:0 0 12px 0;">'
            . $Silian_leadIn
            . ':</p>';

        $Silian_contentHtml .= '<div style="margin:16px 0;padding:16px;background:#f8fafc;border-radius:12px;">'
            . '<h2 style="margin:0 0 12px 0;font-size:18px;color:#0f172a;">' . $this->esc($Silian_title) . '</h2>'
            . $this->renderAnnouncementContentHtml($Silian_content, $Silian_contentFormat, $Silian_renderProfile)
            . '</div>';

        $Silian_contentHtml .= '<p style="margin:12px 0 0 0;">You can review the announcement in your inbox at any time.</p>';

        $Silian_buttons = [];
        $Silian_messagesUrl = $this->buildFrontendUrl('messages');
        if ($Silian_messagesUrl) {
            $Silian_buttons[] = [
                'text' => 'View announcements',
                'url' => $Silian_messagesUrl,
                'color' => self::DEFAULT_BUTTON_COLOR,
            ];
        }

        $Silian_bodyHtml = $this->renderLayout($Silian_subject, $Silian_contentHtml, $Silian_buttons);
        $Silian_bodyText = $this->buildTextBody($Silian_bodyHtml, $Silian_buttons);

        return $this->sendBroadcastEmail(
            $Silian_recipients,
            $Silian_subject,
            $Silian_bodyHtml,
            $Silian_bodyText,
            NotificationPreferenceService::CATEGORY_ANNOUNCEMENT
        );
    }

    /**
     * Send a message notification email to multiple recipients using BCC.
     *
     * @param array<int, array{email:string,name:string|null}> $recipients
     */
    public function sendMessageNotificationToMany(
        array $Silian_recipients,
        string $Silian_subject,
        string $Silian_messageBody,
        string $Silian_category,
        string $Silian_priority = Message::PRIORITY_NORMAL
    ): bool {
        if (empty($Silian_recipients)) {
            $this->lastError = 'No recipients provided for bulk notification.';
            return false;
        }

        $Silian_buttons = [];
        $Silian_messagesUrl = $this->buildFrontendUrl('messages');
        if ($Silian_messagesUrl) {
            $Silian_buttons[] = [
                'text' => 'Open CarbonTrack',
                'url' => $Silian_messagesUrl,
                'color' => self::DEFAULT_BUTTON_COLOR,
            ];
        }

        $Silian_priorityNotice = $this->buildPriorityNoticeText($Silian_priority);

        $Silian_contentHtml = '<p style="margin:0 0 16px 0;">Hello,</p>';
        if ($Silian_priorityNotice !== '') {
            $Silian_contentHtml .= '<p style="margin:0 0 16px 0;color:#dc2626;font-weight:600;">' . $this->esc($Silian_priorityNotice) . '</p>';
        }
        $Silian_contentHtml .= '<p style="margin:0 0 12px 0;">There is a new notification in ' . $this->esc($this->appName) . ' that may require your attention.</p>';
        $Silian_contentHtml .= '<div style="margin:16px 0;padding:16px;background:#f8fafc;border-radius:12px;">'
            . $this->renderMessageContentHtml($Silian_messageBody)
            . '</div>';
        $Silian_contentHtml .= '<p style="margin:12px 0 0 0;">You can review the full details in the app at any time.</p>';

        $Silian_bodyHtml = $this->renderLayout($Silian_subject, $Silian_contentHtml, $Silian_buttons);
        $Silian_bodyText = $this->buildTextBody($Silian_bodyHtml, $Silian_buttons);

        return $this->sendBroadcastEmail($Silian_recipients, $Silian_subject, $Silian_bodyHtml, $Silian_bodyText, $Silian_category);
    }

    public function getLastError(): ?string
    {
        return $this->lastError;
    }

    public function getSupportEmail(): string
    {
        return $this->supportEmail;
    }

    private function buildAnnouncementSubject(string $Silian_title, string $Silian_priority): string
    {
        $Silian_prefix = '';
        $Silian_normalized = strtolower(trim($Silian_priority));
        if ($Silian_normalized === Message::PRIORITY_URGENT) {
            $Silian_prefix = '[URGENT] ';
        } elseif ($Silian_normalized === Message::PRIORITY_HIGH) {
            $Silian_prefix = '[HIGH] ';
        }

        $Silian_trimmedTitle = trim($Silian_title);
        if ($Silian_trimmedTitle === '') {
            $Silian_trimmedTitle = 'Platform announcement';
        }

        return $Silian_prefix . $Silian_trimmedTitle;
    }

    /**
     * Load an email template from disk, falling back to provided content when unavailable.
     */
    private function readTemplate(string $Silian_filename, string $Silian_fallback): string
    {
        $Silian_base = $this->config['templates_path'] ?? '';
        $Silian_base = $Silian_base !== '' ? rtrim($Silian_base, "/\\") . DIRECTORY_SEPARATOR : '';
        $Silian_path = $Silian_base . ltrim($Silian_filename, "/\\");

        try {
            $Silian_contents = @file_get_contents($Silian_path);
        } catch (\Throwable $Silian_e) {
            $Silian_contents = false;
        }

        if ($Silian_contents === false || $Silian_contents === '') {
            try {
                $this->logger->warning('Email template missing or unreadable', [
                    'template' => $Silian_path
                ]);
            } catch (\Throwable $Silian_logError) {
                // Ignore logging failures to keep mail flow resilient
            }
            return $Silian_fallback;
        }

        return $Silian_contents;
    }

    private function esc(string $Silian_value): string
    {
        return htmlspecialchars($Silian_value, ENT_QUOTES, 'UTF-8');
    }

    private function buildFrontendUrl(?string $Silian_path = null): ?string
    {
        if ($this->frontendUrl === null || $this->frontendUrl === '') {
            return null;
        }

        $Silian_base = rtrim($this->frontendUrl, '/');
        if ($Silian_path === null || $Silian_path === '') {
            return $Silian_base;
        }

        return $Silian_base . '/' . ltrim($Silian_path, '/');
    }

    /**
     * Render the shared email layout.
     *
     * @param array<int, array{text:string,url:string,color?:string}> $buttons
     */
    private function renderLayout(string $Silian_title, string $Silian_contentHtml, array $Silian_buttons = [], ?string $Silian_footerNote = null): string
    {
        $Silian_layout = $this->readTemplate('layout.html', self::DEFAULT_LAYOUT_TEMPLATE);
        $Silian_buttonHtml = $this->buildButtonsHtml($Silian_buttons);

        $Silian_replacements = [
            '{{email_title}}' => $this->esc($Silian_title),
            '{{content}}' => $Silian_contentHtml,
            '{{buttons}}' => $Silian_buttonHtml,
            '{{app_name}}' => $this->esc($this->appName),
            '{{current_year}}' => date('Y'),
            '{{support_email}}' => $this->esc($this->supportEmail),
            '{{footer_note}}' => $Silian_footerNote ? '<p>' . $this->esc($Silian_footerNote) . '</p>' : '',
        ];

        return str_replace(array_keys($Silian_replacements), array_values($Silian_replacements), $Silian_layout);
    }

    /**
     * @param array{
     *   eyebrow?: string,
     *   intro?: string,
     *   summary?: string,
     *   ticket?: array{id?: int|string|null,subject?: string|null},
     *   details?: array<int, array{label:string,value:string}>,
     *   changes?: array<int, array{label:string,from?:string|null,to?:string|null,value?:string|null}>,
     *   message?: array{label?:string,body?:string|null},
     *   closing?: string
     * } $payload
     */
    private function renderSupportTicketNotificationContent(array $Silian_payload): string
    {
        $Silian_contentHtml = '';
        $Silian_eyebrow = trim((string) ($Silian_payload['eyebrow'] ?? 'Support ticket'));
        $Silian_intro = trim((string) ($Silian_payload['intro'] ?? ''));
        $Silian_summary = trim((string) ($Silian_payload['summary'] ?? ''));
        $Silian_ticket = is_array($Silian_payload['ticket'] ?? null) ? $Silian_payload['ticket'] : [];
        $Silian_ticketId = trim((string) ($Silian_ticket['id'] ?? ''));
        $Silian_ticketSubject = trim((string) ($Silian_ticket['subject'] ?? ''));

        if ($Silian_eyebrow !== '') {
            $Silian_contentHtml .= '<div style="display:inline-block;margin:0 0 14px 0;padding:6px 12px;border-radius:999px;background:#e0f2fe;color:#0369a1;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;">'
                . $this->esc($Silian_eyebrow)
                . '</div>';
        }

        if ($Silian_intro !== '') {
            $Silian_contentHtml .= '<p style="margin:0 0 14px 0;">' . $this->esc($Silian_intro) . '</p>';
        }

        $Silian_contentHtml .= '<div style="margin:18px 0 22px 0;padding:22px 22px 18px 22px;border-radius:18px;background:linear-gradient(180deg,#f8fbff 0%,#eef6ff 100%);border:1px solid #dbeafe;">';
        if ($Silian_ticketId !== '') {
            $Silian_contentHtml .= '<p style="margin:0 0 8px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0369a1;">Ticket #' . $this->esc($Silian_ticketId) . '</p>';
        }
        if ($Silian_ticketSubject !== '') {
            $Silian_contentHtml .= '<h2 style="margin:0 0 12px 0;font-size:24px;line-height:1.3;color:#0f172a;">' . $this->esc($Silian_ticketSubject) . '</h2>';
        }
        if ($Silian_summary !== '') {
            $Silian_contentHtml .= '<p style="margin:0;color:#334155;font-size:15px;line-height:1.7;">' . $this->esc($Silian_summary) . '</p>';
        }
        $Silian_contentHtml .= $this->renderSupportTicketDetailsHtml(is_array($Silian_payload['details'] ?? null) ? $Silian_payload['details'] : []);
        $Silian_contentHtml .= '</div>';

        $Silian_contentHtml .= $this->renderSupportTicketChangesHtml(is_array($Silian_payload['changes'] ?? null) ? $Silian_payload['changes'] : []);

        if (is_array($Silian_payload['message'] ?? null)) {
            $Silian_message = $Silian_payload['message'];
            $Silian_messageBody = trim((string) ($Silian_message['body'] ?? ''));
            if ($Silian_messageBody !== '') {
                $Silian_label = trim((string) ($Silian_message['label'] ?? 'Latest update'));
                $Silian_contentHtml .= '<div style="margin:0 0 22px 0;padding:20px;border-radius:16px;background:#f8fafc;border-left:4px solid #0ea5e9;">';
                if ($Silian_label !== '') {
                    $Silian_contentHtml .= '<p style="margin:0 0 12px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0369a1;">'
                        . $this->esc($Silian_label)
                        . '</p>';
                }
                $Silian_contentHtml .= $this->renderMessageContentHtml($Silian_messageBody);
                $Silian_contentHtml .= '</div>';
            }
        }

        $Silian_closing = trim((string) ($Silian_payload['closing'] ?? ''));
        if ($Silian_closing !== '') {
            $Silian_contentHtml .= '<p style="margin:0;">' . $this->esc($Silian_closing) . '</p>';
        }

        return $Silian_contentHtml;
    }

    /**
     * @param array<int, array{label:string,value:string}> $details
     */
    private function renderSupportTicketDetailsHtml(array $Silian_details): string
    {
        $Silian_rows = [];
        foreach ($Silian_details as $Silian_detail) {
            $Silian_label = trim((string) ($Silian_detail['label'] ?? ''));
            $Silian_value = trim((string) ($Silian_detail['value'] ?? ''));
            if ($Silian_label === '' || $Silian_value === '') {
                continue;
            }

            $Silian_rows[] = '<tr>'
                . '<td style="padding:0 14px 10px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#64748b;vertical-align:top;">' . $this->esc($Silian_label) . '</td>'
                . '<td style="padding:0 0 10px 0;font-size:15px;font-weight:600;color:#0f172a;vertical-align:top;">' . $this->esc($Silian_value) . '</td>'
                . '</tr>';
        }

        if ($Silian_rows === []) {
            return '';
        }

        return '<table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-top:18px;border-collapse:collapse;">'
            . implode('', $Silian_rows)
            . '</table>';
    }

    /**
     * @param array<int, array{label:string,from?:string|null,to?:string|null,value?:string|null}> $changes
     */
    private function renderSupportTicketChangesHtml(array $Silian_changes): string
    {
        $Silian_items = [];
        foreach ($Silian_changes as $Silian_change) {
            $Silian_label = trim((string) ($Silian_change['label'] ?? ''));
            if ($Silian_label === '') {
                continue;
            }

            $Silian_value = trim((string) ($Silian_change['value'] ?? ''));
            $Silian_from = trim((string) ($Silian_change['from'] ?? ''));
            $Silian_to = trim((string) ($Silian_change['to'] ?? ''));

            if ($Silian_value === '' && $Silian_to !== '') {
                $Silian_value = $Silian_from !== ''
                    ? $this->esc($Silian_from) . ' <span style="color:#94a3b8;">&rarr;</span> ' . $this->esc($Silian_to)
                    : $this->esc($Silian_to);
            } elseif ($Silian_value !== '') {
                $Silian_value = $this->esc($Silian_value);
            }

            if ($Silian_value === '') {
                continue;
            }

            $Silian_items[] = '<li style="margin:0 0 10px 0;line-height:1.6;color:#334155;">'
                . '<strong style="color:#0f172a;">' . $this->esc($Silian_label) . ':</strong> '
                . $Silian_value
                . '</li>';
        }

        if ($Silian_items === []) {
            return '';
        }

        return '<div style="margin:0 0 22px 0;">'
            . '<p style="margin:0 0 10px 0;font-size:12px;font-weight:700;letter-spacing:0.08em;text-transform:uppercase;color:#0369a1;">What changed</p>'
            . '<ul style="margin:0;padding-left:20px;">' . implode('', $Silian_items) . '</ul>'
            . '</div>';
    }

    private function renderMessageContentHtml(string $Silian_messageBody): string
    {
        $Silian_normalized = preg_replace("/\r\n|\r/", "\n", (string) $Silian_messageBody);
        $Silian_normalized = trim($Silian_normalized ?? '');
        if ($Silian_normalized === '') {
            return '<p style="margin:0;color:#475569;">No additional message details were provided.</p>';
        }

        $Silian_blocks = preg_split("/\n{2,}/", $Silian_normalized) ?: [$Silian_normalized];
        $Silian_htmlSegments = [];
        foreach ($Silian_blocks as $Silian_block) {
            $Silian_trimmed = trim($Silian_block);
            if ($Silian_trimmed === '') {
                continue;
            }
            $Silian_htmlSegments[] = '<p style="margin:0 0 12px 0;">' . nl2br($this->esc($Silian_trimmed)) . '</p>';
        }

        if (empty($Silian_htmlSegments)) {
            $Silian_htmlSegments[] = '<p style="margin:0;color:#475569;">' . $this->esc($Silian_normalized) . '</p>';
        }

        return implode('', $Silian_htmlSegments);
    }

    private function renderAnnouncementContentHtml(
        string $Silian_content,
        string $Silian_contentFormat = self::BROADCAST_CONTENT_FORMAT_TEXT,
        ?string $Silian_renderProfile = null
    ): string {
        $Silian_normalizedFormat = $this->normalizeBroadcastContentFormat($Silian_contentFormat);
        if ($Silian_normalizedFormat !== self::BROADCAST_CONTENT_FORMAT_HTML) {
            return $this->renderMessageContentHtml($Silian_content);
        }

        $Silian_normalizedProfile = trim((string) ($Silian_renderProfile ?? self::BROADCAST_RENDER_PROFILE_HTML));
        if ($Silian_normalizedProfile !== self::BROADCAST_RENDER_PROFILE_HTML) {
            return $this->renderMessageContentHtml(strip_tags($Silian_content));
        }

        $Silian_normalizedContent = trim($Silian_content);
        if ($Silian_normalizedContent === '') {
            return $this->renderMessageContentHtml('');
        }

        return $Silian_normalizedContent;
    }

    private function normalizeBroadcastContentFormat(string $Silian_value): string
    {
        $Silian_normalized = strtolower(trim($Silian_value));
        return $Silian_normalized === self::BROADCAST_CONTENT_FORMAT_HTML
            ? self::BROADCAST_CONTENT_FORMAT_HTML
            : self::BROADCAST_CONTENT_FORMAT_TEXT;
    }

    private function buildPriorityNoticeText(string $Silian_priority): string
    {
        $Silian_normalized = strtolower(trim($Silian_priority));
        switch ($Silian_normalized) {
            case 'urgent':
                return 'This notification is marked as URGENT. Please review it as soon as possible.';
            case 'high':
                return 'This notification is marked as high priority.';
            default:
                return '';
        }
    }

    /**
     * @param array<int, array{text:string,url:string,color?:string}> $buttons
     */
    private function buildButtonsHtml(array $Silian_buttons): string
    {
        $Silian_items = [];
        foreach ($Silian_buttons as $Silian_button) {
            $Silian_text = trim((string) ($Silian_button['text'] ?? ''));
            $Silian_url = trim((string) ($Silian_button['url'] ?? ''));
            if ($Silian_text === '' || $Silian_url === '') {
                continue;
            }
            $Silian_color = trim((string) ($Silian_button['color'] ?? self::DEFAULT_BUTTON_COLOR));
            $Silian_items[] = sprintf(
                '<a class="cta-button" href="%s" style="background-color:%s">%s</a>',
                $this->esc($Silian_url),
                $this->esc($Silian_color),
                $this->esc($Silian_text)
            );
        }

        if (empty($Silian_items)) {
            return '';
        }

        return '<div class="button-group">' . implode('', $Silian_items) . '</div>';
    }

    /**
     * @param array<int, array{text:string,url:string,color?:string}> $buttons
     */
    private function appendButtonActionsToText(string $Silian_bodyText, array $Silian_buttons): string
    {
        $Silian_links = [];
        foreach ($Silian_buttons as $Silian_button) {
            $Silian_text = trim((string) ($Silian_button['text'] ?? ''));
            $Silian_url = trim((string) ($Silian_button['url'] ?? ''));
            if ($Silian_text === '' || $Silian_url === '') {
                continue;
            }
            $Silian_links[] = $Silian_text . ': ' . $Silian_url;
        }

        if (empty($Silian_links)) {
            return $Silian_bodyText;
        }

        $Silian_bodyText = rtrim($Silian_bodyText);
        $Silian_bodyText .= "\n\nActions:\n" . implode("\n", $Silian_links) . "\n";

        return $Silian_bodyText;
    }

    /**
     * Build a plain-text fallback from the HTML body.
     *
     * @param array<int, array{text:string,url:string,color?:string}> $buttons
     */
    private function buildTextBody(string $Silian_html, array $Silian_buttons = []): string
    {
        $Silian_replacements = [
            '<br>' => "\n",
            '<br/>' => "\n",
            '<br />' => "\n",
        ];
        $Silian_blockBreaksPattern = '/<\s*\/?(p|div|section|article|li|tr|td|h[1-6])[^>]*>/i';
        $Silian_normalized = str_ireplace(array_keys($Silian_replacements), array_values($Silian_replacements), $Silian_html);
        $Silian_normalized = preg_replace($Silian_blockBreaksPattern, "\n", $Silian_normalized ?? $Silian_html);

        $Silian_text = strip_tags($Silian_normalized ?? $Silian_html);
        $Silian_text = html_entity_decode($Silian_text, ENT_QUOTES, 'UTF-8');
        $Silian_text = preg_replace("/\r\n|\r/", "\n", $Silian_text);
        $Silian_text = preg_replace("/[ \t]+\n/", "\n", $Silian_text);
        $Silian_text = preg_replace("/\n{3,}/", "\n\n", $Silian_text);
        $Silian_text = trim($Silian_text ?? '');

        return $this->appendButtonActionsToText($Silian_text, $Silian_buttons);
    }

    private function formatNumber(float $Silian_value): string
    {
        $Silian_formatted = number_format($Silian_value, 2, '.', '');
        return rtrim(rtrim($Silian_formatted, '0'), '.');
    }

    public function getAppName(): string
    {
        return $this->appName;
    }

    /**
     * Schedule an email-related callback to run after response is sent, with synchronous fallback.
     *
     * @param callable $callback Receives a boolean flag indicating whether it's running in async context.
     */
    public function dispatchAsyncEmail(callable $Silian_callback, array $Silian_context = [], bool $Silian_preferAsync = true): bool
    {
        $Silian_sapi = PHP_SAPI ?? php_sapi_name();
        $Silian_isCli = in_array($Silian_sapi, ['cli', 'phpdbg', 'embed'], true);

        if (!$Silian_preferAsync || $this->forceSimulation || $Silian_isCli) {
            return (bool) $Silian_callback(false);
        }

        try {
            register_shutdown_function(function () use ($Silian_callback, $Silian_context): void {
                try {
                    $Silian_callback(true);
                } catch (\Throwable $Silian_e) {
                    try {
                        $this->logger->error('Async email callback failed', [
                            'error' => $Silian_e->getMessage(),
                            'context' => $Silian_context,
                        ]);
                    } catch (\Throwable $Silian_logError) {
                        // ignore logging issues in shutdown context
                    }
                    $this->logAudit('async_email_callback_failed', $Silian_context + [
                        'execution_mode' => 'shutdown',
                    ], 'failed');
                    $this->logError($Silian_e, '/internal/email/async-callback', 'Async email callback failed', $Silian_context + [
                        'execution_mode' => 'shutdown',
                    ]);
                }
            });

            return true;
        } catch (\Throwable $Silian_e) {
            try {
                $this->logger->debug('Failed to register async email callback; falling back to sync send', [
                    'error' => $Silian_e->getMessage(),
                    'context' => $Silian_context,
                ]);
            } catch (\Throwable $Silian_logError) {
                // ignore
            }

            $this->logAudit('async_email_callback_registration_failed', $Silian_context, 'failed');
            $this->logError($Silian_e, '/internal/email/async-register', 'Failed to register async email callback', $Silian_context);

            return (bool) $Silian_callback(false);
        }
    }

    private function shouldSendEmail(string $Silian_email, string $Silian_category): bool
    {
        if ($this->preferenceService === null) {
            return true;
        }

        try {
            return $this->preferenceService->shouldSendEmailByEmail($Silian_email, $Silian_category);
        } catch (\Throwable $Silian_e) {
            $this->logger->warning('Failed to resolve notification preference, falling back to send', [
                'email' => $Silian_email,
                'category' => $Silian_category,
                'error' => $Silian_e->getMessage(),
            ]);

            $this->logAudit('email_preference_lookup_failed', [
                'email' => $Silian_email,
                'category' => $Silian_category,
            ], 'failed');
            $this->logError($Silian_e, '/internal/email/preferences', 'Failed to resolve notification preference', [
                'email' => $Silian_email,
                'category' => $Silian_category,
            ]);

            return true;
        }
    }

    public function sendVerificationCode(
        string $Silian_toEmail,
        string $Silian_toName,
        string $Silian_code,
        int $Silian_expiryMinutes = 30,
        ?string $Silian_verificationLink = null
    ): bool {
        if (!$this->shouldSendEmail($Silian_toEmail, NotificationPreferenceService::CATEGORY_VERIFICATION)) {
            return false;
        }

        $Silian_subject = $this->config['subjects']['verification_code'] ?? 'Your Verification Code';

        $Silian_htmlTemplate = $this->readTemplate(
            'verification_code.html',
            '<p>Hello {{username}},</p><p>Your verification code is <strong>{{verification_code}}</strong>. '
            . 'The code expires in {{expiry_minutes}} minutes.</p>{{link_block}}'
            . '<p>If you did not request this code you can safely ignore this email.</p>'
        );

        $Silian_buttons = [];
        $Silian_linkBlockHtml = '';
        $Silian_safeLink = null;
        if ($Silian_verificationLink) {
            $Silian_safeLink = $this->esc($Silian_verificationLink);
            $Silian_buttons[] = [
                'text' => 'Verify Email',
                'url' => $Silian_verificationLink,
                'color' => self::DEFAULT_BUTTON_COLOR,
            ];
            $Silian_linkBlockHtml = sprintf(
                '<p>You can also open this link directly: <a href="%1$s">%1$s</a></p>',
                $Silian_safeLink
            );
        }

        $Silian_replacements = [
            '{{code}}' => $this->esc($Silian_code),
            '{{verification_code}}' => $this->esc($Silian_code),
            '{{username}}' => $this->esc($Silian_toName),
            '{{expiry_minutes}}' => $this->esc((string) $Silian_expiryMinutes),
            '{{link_block}}' => $Silian_linkBlockHtml,
            '{{verification_link}}' => $Silian_safeLink ?? '',
            '{{link}}' => $Silian_safeLink ?? '',
        ];

        $Silian_bodyHtmlContent = str_replace(array_keys($Silian_replacements), array_values($Silian_replacements), $Silian_htmlTemplate);
        $Silian_bodyHtml = $this->renderLayout('Verify your email address', $Silian_bodyHtmlContent, $Silian_buttons);
        $Silian_bodyText = $this->buildTextBody($Silian_bodyHtml, $Silian_buttons);

        return $this->sendEmail($Silian_toEmail, $Silian_toName, $Silian_subject, $Silian_bodyHtml, $Silian_bodyText);
    }

    public function sendPasswordResetLink(string $Silian_toEmail, string $Silian_toName, string $Silian_link)
    {
        if (!$this->shouldSendEmail($Silian_toEmail, NotificationPreferenceService::CATEGORY_SECURITY)) {
            return false;
        }

        $Silian_subject = $this->config['subjects']['password_reset'] ?? 'Password Reset Request';
        $Silian_htmlTemplate = $this->readTemplate(
            'password_reset.html',
            '<p>Hello {{username}},</p>'
            . '<p>We received a request to reset your password.</p>'
            . '<p>If this was you, use the button below to create a new password.</p>'
            . '<p>If you did not request a password reset you can ignore this message.</p>'
        );

        $Silian_buttons = [];
        if (trim($Silian_link) !== '') {
            $Silian_buttons[] = [
                'text' => 'Reset password',
                'url' => $Silian_link,
                'color' => self::DEFAULT_BUTTON_COLOR,
            ];
        }

        $Silian_contentHtml = str_replace(
            ['{{username}}', '{{link}}'],
            [$this->esc($Silian_toName), $this->esc($Silian_link)],
            $Silian_htmlTemplate
        );
        $Silian_bodyHtml = $this->renderLayout('Reset your password', $Silian_contentHtml, $Silian_buttons);
        $Silian_bodyText = $this->buildTextBody($Silian_bodyHtml, $Silian_buttons);

        return $this->sendEmail($Silian_toEmail, $Silian_toName, $Silian_subject, $Silian_bodyHtml, $Silian_bodyText);
    }

    public function sendActivityApprovedNotification(string $Silian_toEmail, string $Silian_toName, string $Silian_activityName, float $Silian_pointsEarned)
    {
        if (!$this->shouldSendEmail($Silian_toEmail, NotificationPreferenceService::CATEGORY_ACTIVITY)) {
            return false;
        }

        $Silian_subject = $this->config['subjects']['activity_approved'] ?? 'Your Carbon Activity Approved!';
        $Silian_htmlTemplate = $this->readTemplate(
            'activity_approved.html',
            '<p>Hello {{username}},</p>'
            . '<p>Your submission <strong>{{activity_name}}</strong> has been approved.</p>'
            . '<p>You earned <strong>{{points_earned}}</strong> points for this activity.</p>'
        );

        $Silian_buttons = [];
        $Silian_activityUrl = $this->buildFrontendUrl('dashboard/activities');
        if ($Silian_activityUrl) {
            $Silian_buttons[] = [
                'text' => 'View activity history',
                'url' => $Silian_activityUrl,
                'color' => self::DEFAULT_BUTTON_COLOR,
            ];
        }

        $Silian_points = $this->formatNumber($Silian_pointsEarned);
        $Silian_bodyHtmlContent = str_replace(
            [
                '{{username}}',
                self::TAG_ACTIVITY_NAME,
                self::TAG_POINTS_EARNED,
            ],
            [
                $this->esc($Silian_toName),
                $this->esc($Silian_activityName),
                $this->esc($Silian_points),
            ],
            $Silian_htmlTemplate
        );
        $Silian_bodyHtml = $this->renderLayout('Activity approved', $Silian_bodyHtmlContent, $Silian_buttons);
        $Silian_bodyText = $this->buildTextBody($Silian_bodyHtml, $Silian_buttons);

        return $this->sendEmail($Silian_toEmail, $Silian_toName, $Silian_subject, $Silian_bodyHtml, $Silian_bodyText);
    }

    public function sendActivityRejectedNotification(string $Silian_toEmail, string $Silian_toName, string $Silian_activityName, string $Silian_reason)
    {
        if (!$this->shouldSendEmail($Silian_toEmail, NotificationPreferenceService::CATEGORY_ACTIVITY)) {
            return false;
        }

        $Silian_subject = $this->config['subjects']['activity_rejected'] ?? 'Your Carbon Activity Rejected';
        $Silian_htmlTemplate = $this->readTemplate(
            'activity_rejected.html',
            '<p>Hello {{username}},</p>'
            . '<p>We reviewed <strong>{{activity_name}}</strong> but could not approve it.</p>'
            . '<p>Reason: {{reason}}</p>'
            . '<p>You can review the submission, make changes, and resubmit at any time.</p>'
        );

        $Silian_buttons = [];
        $Silian_activityUrl = $this->buildFrontendUrl('dashboard/activities');
        if ($Silian_activityUrl) {
            $Silian_buttons[] = [
                'text' => 'Review submission',
                'url' => $Silian_activityUrl,
                'color' => self::DEFAULT_BUTTON_COLOR,
            ];
        }

        $Silian_bodyHtmlContent = str_replace(
            [
                '{{username}}',
                self::TAG_ACTIVITY_NAME,
                self::TAG_REASON,
            ],
            [
                $this->esc($Silian_toName),
                $this->esc($Silian_activityName),
                $this->esc($Silian_reason),
            ],
            $Silian_htmlTemplate
        );
        $Silian_bodyHtml = $this->renderLayout('Activity requires updates', $Silian_bodyHtmlContent, $Silian_buttons);
        $Silian_bodyText = $this->buildTextBody($Silian_bodyHtml, $Silian_buttons);

        return $this->sendEmail($Silian_toEmail, $Silian_toName, $Silian_subject, $Silian_bodyHtml, $Silian_bodyText);
    }

    public function sendCarbonRecordReviewSummaryEmail(
        string $Silian_toEmail,
        string $Silian_toName,
        string $Silian_action,
        array $Silian_records,
        string $Silian_title,
        ?string $Silian_reviewNote = null,
        ?string $Silian_reviewedBy = null
    ): bool {
        if (!$this->shouldSendEmail($Silian_toEmail, NotificationPreferenceService::CATEGORY_ACTIVITY)) {
            return false;
        }

        $Silian_normalizedAction = strtolower(trim($Silian_action));
        if ($Silian_normalizedAction === 'approved') {
            $Silian_normalizedAction = 'approve';
        } elseif ($Silian_normalizedAction === 'rejected') {
            $Silian_normalizedAction = 'reject';
        }
        $Silian_isApprove = $Silian_normalizedAction === 'approve';

        $Silian_subjectMap = $this->config['subjects']['carbon_record_review_summary'] ?? [];
        if (is_array($Silian_subjectMap)) {
            $Silian_subject = (string) ($Silian_subjectMap[$Silian_normalizedAction] ?? ($Silian_isApprove ? 'Carbon record review approved' : 'Carbon record review result'));
        } else {
            $Silian_subject = is_string($Silian_subjectMap) ? (string) $Silian_subjectMap : ($Silian_isApprove ? 'Carbon record review approved' : 'Carbon record review result');
        }

        $Silian_headline = $Silian_title !== '' ? $Silian_title : ($Silian_isApprove ? 'Carbon record review approved' : 'Carbon record review result');
        $Silian_intro = $Silian_isApprove
            ? 'The following carbon reduction records were approved:'
            : 'The following carbon reduction records require your attention:';

        $Silian_items = [];
        foreach ($Silian_records as $Silian_record) {
            if (!is_array($Silian_record)) {
                continue;
            }

            $Silian_activity = (string) ($Silian_record['activity_name'] ?? 'Activity');
            $Silian_value = $Silian_record['data_value'] ?? null;
            $Silian_unit = $Silian_record['unit'] ?? null;
            $Silian_points = $Silian_record['points_earned'] ?? null;
            $Silian_date = $Silian_record['date'] ?? null;

            $Silian_parts = ['Activity: ' . $this->esc($Silian_activity)];
            if ($Silian_value !== null && $Silian_value !== '') {
                $Silian_dataText = (string) $Silian_value;
                if ($Silian_unit !== null && $Silian_unit !== '') {
                    $Silian_dataText .= ' ' . $Silian_unit;
                }
                $Silian_parts[] = 'Data: ' . $this->esc($Silian_dataText);
            }
            if ($Silian_points !== null && $Silian_points !== '') {
                $Silian_parts[] = 'Points: ' . $this->esc((string) $Silian_points);
            }
            if ($Silian_date !== null && $Silian_date !== '') {
                $Silian_parts[] = 'Date: ' . $this->esc((string) $Silian_date);
            }

            if ($Silian_reviewNote && !empty($Silian_record['review_note'])) {
                $Silian_parts[] = 'Note: ' . $this->esc((string) $Silian_record['review_note']);
            }

            $Silian_items[] = '<li>' . implode(' · ', $Silian_parts) . '</li>';
        }

        if (empty($Silian_items)) {
            $Silian_items[] = '<li>No record details provided.</li>';
        }

        $Silian_listHtml = '<ul style="padding-left:20px;">' . implode('', $Silian_items) . '</ul>';

        $Silian_contentHtml = '<p>Hello ' . $this->esc($Silian_toName) . ',</p>'
            . '<p>' . $this->esc($Silian_intro) . '</p>'
            . $Silian_listHtml;

        if ($Silian_reviewNote) {
            $Silian_contentHtml .= '<p>Review note: ' . $this->esc($Silian_reviewNote) . '</p>';
        }
        if ($Silian_reviewedBy) {
            $Silian_contentHtml .= '<p>Reviewer: ' . $this->esc($Silian_reviewedBy) . '</p>';
        }

        $Silian_buttons = [];
        $Silian_activitiesUrl = $this->buildFrontendUrl('dashboard/activities');
        if ($Silian_activitiesUrl) {
            $Silian_buttons[] = [
                'text' => $Silian_isApprove ? 'View approved records' : 'Review records',
                'url' => $Silian_activitiesUrl,
                'color' => self::DEFAULT_BUTTON_COLOR,
            ];
        }

        $Silian_bodyHtml = $this->renderLayout($Silian_headline, $Silian_contentHtml, $Silian_buttons);
        $Silian_bodyText = $this->buildTextBody($Silian_bodyHtml, $Silian_buttons);

        return $this->sendEmail($Silian_toEmail, $Silian_toName, $Silian_subject, $Silian_bodyHtml, $Silian_bodyText);
    }

    public function sendExchangeConfirmation(string $Silian_toEmail, string $Silian_toName, string $Silian_productName, int $Silian_quantity, float $Silian_totalPoints)
    {
        if (!$this->shouldSendEmail($Silian_toEmail, NotificationPreferenceService::CATEGORY_TRANSACTION)) {
            return false;
        }

        $Silian_subject = $this->config['subjects']['exchange_confirmation'] ?? 'Your Exchange Order Confirmed';
        $Silian_htmlTemplate = $this->readTemplate(
            'exchange_confirmation.html',
            '<p>Hello {{username}},</p>'
            . '<p>Thanks for redeeming <strong>{{product_name}}</strong>.</p>'
            . '<p>Quantity: {{quantity}} · Points spent: {{total_points}}</p>'
            . '<p>We will notify you when the exchange is ready for pickup.</p>'
        );

        $Silian_buttons = [];
        $Silian_storeUrl = $this->buildFrontendUrl('store');
        if ($Silian_storeUrl) {
            $Silian_buttons[] = [
                'text' => 'Browse more rewards',
                'url' => $Silian_storeUrl,
                'color' => self::DEFAULT_BUTTON_COLOR,
            ];
        }

        $Silian_bodyHtmlContent = str_replace(
            [
                '{{username}}',
                self::TAG_PRODUCT_NAME,
                self::TAG_QUANTITY,
                self::TAG_TOTAL_POINTS,
            ],
            [
                $this->esc($Silian_toName),
                $this->esc($Silian_productName),
                $this->esc((string) $Silian_quantity),
                $this->esc($this->formatNumber($Silian_totalPoints)),
            ],
            $Silian_htmlTemplate
        );
        $Silian_bodyHtml = $this->renderLayout('Exchange confirmed', $Silian_bodyHtmlContent, $Silian_buttons);
        $Silian_bodyText = $this->buildTextBody($Silian_bodyHtml, $Silian_buttons);

        return $this->sendEmail($Silian_toEmail, $Silian_toName, $Silian_subject, $Silian_bodyHtml, $Silian_bodyText);
    }


    public function sendExchangeStatusUpdate(string $Silian_toEmail, string $Silian_toName, string $Silian_productName, string $Silian_status, string $Silian_adminNotes = '')
    {
        if (!$this->shouldSendEmail($Silian_toEmail, NotificationPreferenceService::CATEGORY_TRANSACTION)) {
            return false;
        }

        $Silian_subject = $this->config['subjects']['exchange_status_update'] ?? 'Your Exchange Order Status Updated';
        $Silian_htmlTemplate = $this->readTemplate(
            'exchange_status_update.html',
            '<p>Hello {{username}},</p>'
            . '<p>Your exchange for <strong>{{product_name}}</strong> was updated to <strong>{{status}}</strong>.</p>'
            . '{{admin_notes_block}}'
            . '<p>Thank you for helping us reduce carbon emissions.</p>'
        );

        $Silian_buttons = [];
        $Silian_storeUrl = $this->buildFrontendUrl('store');
        if ($Silian_storeUrl) {
            $Silian_buttons[] = [
                'text' => 'View rewards',
                'url' => $Silian_storeUrl,
                'color' => self::DEFAULT_BUTTON_COLOR,
            ];
        }

        $Silian_notesHtml = '';
        $Silian_notesText = '';
        if ($Silian_adminNotes !== '') {
            $Silian_notesHtml = '<p>Notes from our team: ' . $this->esc($Silian_adminNotes) . '</p>';
            $Silian_notesText = 'Notes from our team: ' . $Silian_adminNotes;
        }

        $Silian_bodyHtmlContent = str_replace(
            [
                '{{username}}',
                self::TAG_PRODUCT_NAME,
                self::TAG_STATUS,
                self::TAG_ADMIN_NOTES,
                '{{admin_notes_block}}',
            ],
            [
                $this->esc($Silian_toName),
                $this->esc($Silian_productName),
                $this->esc($Silian_status),
                $this->esc($Silian_adminNotes),
                $Silian_notesHtml,
            ],
            $Silian_htmlTemplate
        );
        $Silian_bodyHtml = $this->renderLayout('Exchange status update', $Silian_bodyHtmlContent, $Silian_buttons);
        $Silian_bodyText = $this->buildTextBody($Silian_bodyHtml, $Silian_buttons);

        return $this->sendEmail($Silian_toEmail, $Silian_toName, $Silian_subject, $Silian_bodyHtml, $Silian_bodyText);
    }

    public function sendWelcomeEmail(string $Silian_toEmail, string $Silian_toName): bool
    {
        if (!$this->shouldSendEmail($Silian_toEmail, NotificationPreferenceService::CATEGORY_SYSTEM)) {
            return false;
        }

        $Silian_subject = $this->config['subjects']['welcome'] ?? 'Welcome to CarbonTrack';
        $Silian_contentHtml = sprintf(
            '<p>Hello %s,</p>'
            . '<p>Welcome to %s! Your account is ready to go.</p>'
            . '<p>Here are a few ideas to get started:</p>'
            . '<ul>'
            . '<li>Log your recent carbon saving activities.</li>'
            . '<li>Explore the store for rewards.</li>'
            . '<li>Invite friends to join your sustainability journey.</li>'
            . '</ul>',
            $this->esc($Silian_toName),
            $this->esc($this->appName)
        );

        $Silian_buttons = [];
        $Silian_dashboardUrl = $this->buildFrontendUrl('dashboard');
        if ($Silian_dashboardUrl) {
            $Silian_buttons[] = [
                'text' => 'Open dashboard',
                'url' => $Silian_dashboardUrl,
                'color' => self::DEFAULT_BUTTON_COLOR,
            ];
        }

        $Silian_bodyHtml = $this->renderLayout('Welcome aboard', $Silian_contentHtml, $Silian_buttons);
        $Silian_bodyText = $this->buildTextBody($Silian_bodyHtml, $Silian_buttons);

        return $this->sendEmail($Silian_toEmail, $Silian_toName, $Silian_subject, $Silian_bodyHtml, $Silian_bodyText);
    }

    public function sendPasswordResetEmail(string $Silian_toEmail, string $Silian_toName, string $Silian_token): bool
    {
        $Silian_base = $this->config['reset_link_base']
            ?? ($_ENV['FRONTEND_URL'] ?? ($_ENV['APP_URL'] ?? ''));
        $Silian_link = '#';
        if ($Silian_base) {
            $Silian_link = rtrim($Silian_base, '/') . '/reset-password?token=' . urlencode($Silian_token);
            if ($Silian_toEmail !== '') {
                $Silian_link .= '&email=' . urlencode($Silian_toEmail);
            }
        }

        return $this->sendPasswordResetLink($Silian_toEmail, $Silian_toName, $Silian_link);
    }

    private function logAudit(string $Silian_action, array $Silian_context = [], string $Silian_status = 'success'): void
    {
        if ($this->auditLogService === null) {
            return;
        }

        try {
            $this->auditLogService->log([
                'action' => $Silian_action,
                'operation_category' => 'notification',
                'actor_type' => 'system',
                'status' => $Silian_status,
                'data' => $Silian_context,
            ]);
        } catch (\Throwable $Silian_ignore) {
            // ignore audit logging failures inside email service
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
            // ignore error logging failures inside email service
        }
    }
}

