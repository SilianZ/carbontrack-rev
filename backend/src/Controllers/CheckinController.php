<?php

declare(strict_types=1);

namespace CarbonTrack\Controllers;

use CarbonTrack\Models\UserUsageStats;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\CheckinService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\QuotaService;
use DateTimeImmutable;
use DateTimeZone;
use Monolog\Logger;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class CheckinController
{
    private DateTimeZone $timezone;

    public function __construct(
        private AuthService $authService,
        private CheckinService $checkinService,
        private QuotaService $quotaService,
        private AuditLogService $auditLogService,
        private Logger $logger,
        private ?ErrorLogService $errorLogService = null
    ) {
        $Silian_tzName = $_ENV['APP_TIMEZONE'] ?? date_default_timezone_get();
        if (!$Silian_tzName) {
            $Silian_tzName = 'UTC';
        }
        $this->timezone = new DateTimeZone($Silian_tzName);
    }

    public function list(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'message' => 'Unauthorized',
                    'code' => 'UNAUTHORIZED',
                ], 401);
            }

            [$Silian_startDate, $Silian_endDate] = $this->resolveRange($Silian_request->getQueryParams());
            if (!$Silian_startDate || !$Silian_endDate) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'message' => 'Invalid date range',
                    'code' => 'INVALID_RANGE',
                ], 400);
            }

            $Silian_checkins = $this->checkinService->getCheckinsForRange((int) $Silian_user['id'], $Silian_startDate, $Silian_endDate);
            $Silian_stats = $this->checkinService->getUserStreakStats((int) $Silian_user['id']);
            $Silian_quota = $this->buildMakeupQuotaSummary($Silian_request, (int) $Silian_user['id']);
            $Silian_serverToday = (new DateTimeImmutable('now', $this->timezone))->format('Y-m-d');

            $this->auditLogService->logUserAction(
                (int) $Silian_user['id'],
                'checkin_calendar_viewed',
                ['range' => ['start' => $Silian_startDate, 'end' => $Silian_endDate]]
            );

            return $this->json($Silian_response, [
                'success' => true,
                'data' => [
                    'range' => [
                        'start_date' => $Silian_startDate,
                        'end_date' => $Silian_endDate,
                    ],
                    'checkins' => $Silian_checkins,
                    'stats' => $Silian_stats,
                    'makeup_quota' => $Silian_quota,
                    'meta' => [
                        'timezone' => $this->timezone->getName(),
                        'server_today' => $Silian_serverToday,
                    ],
                ],
            ]);
        } catch (\Throwable $Silian_e) {
            $this->logException($Silian_e, $Silian_request, 'Failed to load checkin calendar');
            return $this->json($Silian_response, [
                'success' => false,
                'message' => 'Failed to load checkin calendar',
            ], 500);
        }
    }

    public function makeup(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'message' => 'Unauthorized',
                    'code' => 'UNAUTHORIZED',
                ], 401);
            }

            $Silian_body = $Silian_request->getParsedBody();
            if (!is_array($Silian_body)) {
                $Silian_body = [];
            }
            $Silian_rawDate = isset($Silian_body['date']) ? trim((string) $Silian_body['date']) : '';
            $Silian_recordId = isset($Silian_body['record_id']) ? trim((string) $Silian_body['record_id']) : '';
            if ($Silian_rawDate === '') {
                return $this->json($Silian_response, [
                    'success' => false,
                    'message' => 'Missing date',
                    'code' => 'DATE_REQUIRED',
                ], 400);
            }
            if ($Silian_recordId === '') {
                return $this->json($Silian_response, [
                    'success' => false,
                    'message' => 'Missing record id',
                    'code' => 'RECORD_REQUIRED',
                ], 400);
            }

            $Silian_date = $this->normalizeDate($Silian_rawDate);
            if (!$Silian_date) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'message' => 'Invalid date',
                    'code' => 'INVALID_DATE',
                ], 400);
            }

            $Silian_today = new DateTimeImmutable('now', $this->timezone);
            if ($Silian_date > $Silian_today->setTime(0, 0, 0)) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'message' => 'Cannot check in for future dates',
                    'code' => 'DATE_IN_FUTURE',
                ], 400);
            }

            $Silian_userModel = $this->authService->getCurrentUserModel($Silian_request);
            if (!$Silian_userModel) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'message' => 'Unauthorized',
                    'code' => 'UNAUTHORIZED',
                ], 401);
            }

            $Silian_recordStmt = $this->checkinService->getConnection()->prepare(
                "SELECT id FROM carbon_records WHERE id = :rid AND user_id = :uid AND deleted_at IS NULL LIMIT 1"
            );
            $Silian_recordStmt->execute([
                'rid' => $Silian_recordId,
                'uid' => (int) $Silian_user['id'],
            ]);
            $Silian_recordExists = $Silian_recordStmt->fetchColumn();
            $Silian_recordStmt->closeCursor();
            if (!$Silian_recordExists) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'message' => 'Record not found',
                    'code' => 'RECORD_NOT_FOUND',
                ], 404);
            }

            $Silian_normalizedDate = $Silian_date->format('Y-m-d');
            if ($this->checkinService->hasCheckin((int) $Silian_user['id'], $Silian_normalizedDate)) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'message' => 'Already checked in for this date',
                    'code' => 'ALREADY_CHECKED_IN',
                ], 409);
            }

            if (!$this->quotaService->checkAndConsume($Silian_userModel, 'checkin_makeup', 1)) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'message' => 'Makeup quota exceeded',
                    'code' => 'QUOTA_EXCEEDED',
                    'translation_key' => 'error.quota.exceeded',
                ], 429);
            }

            $Silian_note = isset($Silian_body['note']) ? trim((string) $Silian_body['note']) : null;
            $Silian_ok = $this->checkinService->createMakeupCheckin((int) $Silian_user['id'], $Silian_normalizedDate, $Silian_note, $Silian_recordId);
            if (!$Silian_ok) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'message' => 'Failed to apply makeup checkin',
                    'code' => 'CHECKIN_FAILED',
                ], 500);
            }

            $this->auditLogService->logDataChange(
                'user',
                'checkin_makeup',
                (int) $Silian_user['id'],
                'user',
                'user_checkins',
                null,
                null,
                null,
                [
                    'checkin_date' => $Silian_normalizedDate,
                    'note' => $Silian_note,
                    'record_id' => $Silian_recordId,
                ]
            );

            $Silian_stats = $this->checkinService->getUserStreakStats((int) $Silian_user['id']);
            $Silian_quota = $this->buildMakeupQuotaSummary($Silian_request, (int) $Silian_user['id']);

            return $this->json($Silian_response, [
                'success' => true,
                'data' => [
                    'checkin_date' => $Silian_normalizedDate,
                    'stats' => $Silian_stats,
                    'makeup_quota' => $Silian_quota,
                ],
            ]);
        } catch (\Throwable $Silian_e) {
            $this->logException($Silian_e, $Silian_request, 'Failed to apply makeup checkin');
            return $this->json($Silian_response, [
                'success' => false,
                'message' => 'Failed to apply makeup checkin',
            ], 500);
        }
    }

    private function resolveRange(array $Silian_params): array
    {
        $Silian_month = isset($Silian_params['month']) ? trim((string) $Silian_params['month']) : '';
        $Silian_startRaw = isset($Silian_params['start_date']) ? trim((string) $Silian_params['start_date']) : '';
        $Silian_endRaw = isset($Silian_params['end_date']) ? trim((string) $Silian_params['end_date']) : '';

        $Silian_start = null;
        $Silian_end = null;

        if ($Silian_month !== '') {
            $Silian_monthDate = DateTimeImmutable::createFromFormat('Y-m', $Silian_month, $this->timezone);
            if ($Silian_monthDate) {
                $Silian_start = $Silian_monthDate->modify('first day of this month');
                $Silian_end = $Silian_monthDate->modify('last day of this month');
            }
        }

        if (!$Silian_start && $Silian_startRaw !== '') {
            $Silian_start = $this->normalizeDate($Silian_startRaw);
        }

        if (!$Silian_end && $Silian_endRaw !== '') {
            $Silian_end = $this->normalizeDate($Silian_endRaw);
        }

        if (!$Silian_start || !$Silian_end) {
            $Silian_now = new DateTimeImmutable('now', $this->timezone);
            $Silian_start = $Silian_start ?: $Silian_now->modify('first day of this month');
            $Silian_end = $Silian_end ?: $Silian_now->modify('last day of this month');
        }

        if ($Silian_end < $Silian_start) {
            [$Silian_start, $Silian_end] = [$Silian_end, $Silian_start];
        }

        $Silian_maxDays = 370;
        $Silian_diffDays = (int) $Silian_start->diff($Silian_end)->format('%a');
        if ($Silian_diffDays > $Silian_maxDays) {
            $Silian_end = $Silian_start->modify(sprintf('+%d days', $Silian_maxDays));
        }

        return [
            $Silian_start->format('Y-m-d'),
            $Silian_end->format('Y-m-d'),
        ];
    }

    private function buildMakeupQuotaSummary(Request $Silian_request, int $Silian_userId): array
    {
        $Silian_userModel = $this->authService->getCurrentUserModel($Silian_request);
        if (!$Silian_userModel) {
            return [
                'limit' => null,
                'used' => 0,
                'remaining' => null,
                'reset_at' => null,
            ];
        }

        $Silian_config = $this->quotaService->getEffectiveConfig($Silian_userModel, 'checkin_makeup');
        $Silian_limit = isset($Silian_config['monthly_limit']) ? (int) $Silian_config['monthly_limit'] : null;

        $Silian_usage = UserUsageStats::where('user_id', $Silian_userId)
            ->where('resource_key', 'checkin_makeup_monthly')
            ->first();

        $Silian_used = (int) ($Silian_usage?->counter ?? 0);
        $Silian_resetAt = $Silian_usage?->reset_at?->format('Y-m-d H:i:s');
        $Silian_remaining = $Silian_limit !== null ? max($Silian_limit - $Silian_used, 0) : null;

        return [
            'limit' => $Silian_limit,
            'used' => $Silian_used,
            'remaining' => $Silian_remaining,
            'reset_at' => $Silian_resetAt,
        ];
    }

    private function normalizeDate(string $Silian_raw): ?DateTimeImmutable
    {
        $Silian_raw = trim($Silian_raw);
        if ($Silian_raw === '') {
            return null;
        }
        $Silian_candidate = DateTimeImmutable::createFromFormat('Y-m-d', $Silian_raw, $this->timezone);
        if ($Silian_candidate instanceof DateTimeImmutable && $Silian_candidate->format('Y-m-d') === $Silian_raw) {
            return $Silian_candidate->setTime(0, 0, 0);
        }

        try {
            $Silian_fallback = new DateTimeImmutable($Silian_raw, $this->timezone);
            return $Silian_fallback->setTime(0, 0, 0);
        } catch (\Throwable $Silian_e) {
            return null;
        }
    }

    private function json(Response $Silian_response, array $Silian_data, int $Silian_status = 200): Response
    {
        $Silian_payload = json_encode($Silian_data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        $Silian_response->getBody()->write($Silian_payload === false ? '{}' : $Silian_payload);
        return $Silian_response->withHeader('Content-Type', 'application/json')->withStatus($Silian_status);
    }

    private function logException(\Throwable $Silian_e, Request $Silian_request, string $Silian_message): void
    {
        try {
            $this->logger->error($Silian_message, ['error' => $Silian_e->getMessage()]);
        } catch (\Throwable $Silian_ignore) {
            // ignore logger errors
        }

        if ($this->errorLogService) {
            try {
                $this->errorLogService->logException($Silian_e, $Silian_request, ['context_message' => $Silian_message]);
            } catch (\Throwable $Silian_ignore) {
                // ignore error log failures
            }
        }
    }
}
