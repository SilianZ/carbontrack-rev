<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Support\SyntheticRequestFactory;
use DateTimeImmutable;
use DateTimeInterface;
use DateTimeZone;
use Monolog\Logger;
use PDO;

class CheckinService
{
    private PDO $db;
    private ?Logger $logger;
    private DateTimeZone $timezone;
    private string $driver;
    private ?AuditLogService $auditLogService;
    private ?ErrorLogService $errorLogService;

    public function __construct(
        PDO $Silian_db,
        ?Logger $Silian_logger = null,
        ?string $Silian_timezone = null,
        ?AuditLogService $Silian_auditLogService = null,
        ?ErrorLogService $Silian_errorLogService = null
    )
    {
        $this->db = $Silian_db;
        $this->logger = $Silian_logger;
        $this->auditLogService = $Silian_auditLogService;
        $this->errorLogService = $Silian_errorLogService;
        $Silian_tzName = $Silian_timezone ?? ($_ENV['APP_TIMEZONE'] ?? date_default_timezone_get());
        if (!$Silian_tzName) {
            $Silian_tzName = 'UTC';
        }
        $this->timezone = new DateTimeZone($Silian_tzName);
        try {
            $this->driver = (string) $Silian_db->getAttribute(PDO::ATTR_DRIVER_NAME);
        } catch (\Throwable $Silian_e) {
            $this->driver = 'mysql';
        }
    }

    public function recordCheckinFromSubmission(int $Silian_userId, ?string $Silian_recordId = null, ?DateTimeInterface $Silian_submittedAt = null): bool
    {
        $Silian_submittedAt = $Silian_submittedAt ?: new DateTimeImmutable('now', $this->timezone);
        $Silian_date = $this->formatDate($Silian_submittedAt);
        return $this->recordCheckinForDate($Silian_userId, $Silian_date, 'record', $Silian_recordId, $Silian_submittedAt);
    }

    public function createMakeupCheckin(
        int $Silian_userId,
        string $Silian_date,
        ?string $Silian_note = null,
        ?string $Silian_recordId = null,
        ?DateTimeInterface $Silian_createdAt = null
    ): bool
    {
        $Silian_createdAt = $Silian_createdAt ?: new DateTimeImmutable('now', $this->timezone);
        return $this->recordCheckinForDate($Silian_userId, $Silian_date, 'makeup', $Silian_recordId, $Silian_createdAt, $Silian_note);
    }

    public function recordCheckinForDate(
        int $Silian_userId,
        string $Silian_date,
        string $Silian_source,
        ?string $Silian_recordId = null,
        ?DateTimeInterface $Silian_createdAt = null,
        ?string $Silian_note = null
    ): bool {
        $Silian_createdAt = $Silian_createdAt ?: new DateTimeImmutable('now', $this->timezone);
        $Silian_date = $this->normalizeDateString($Silian_date) ?? $Silian_date;
        return $this->insertCheckin($Silian_userId, $Silian_date, $Silian_source, $Silian_recordId, $Silian_createdAt, $Silian_note);
    }

    public function syncUserCheckinsFromRecords(int $Silian_userId): int
    {
        $Silian_sql = $this->driver === 'sqlite'
            ? "INSERT OR IGNORE INTO user_checkins (user_id, checkin_date, source, record_id, created_at)
                SELECT cr.user_id, DATE(cr.created_at) AS checkin_date, 'record' AS source, MIN(cr.id) AS record_id, MIN(cr.created_at) AS created_at
                FROM carbon_records cr
                LEFT JOIN user_checkins uc ON uc.record_id = cr.id
                WHERE cr.user_id = :uid AND cr.deleted_at IS NULL AND uc.id IS NULL
                GROUP BY cr.user_id, DATE(cr.created_at)"
            : "INSERT IGNORE INTO user_checkins (user_id, checkin_date, source, record_id, created_at)
                SELECT cr.user_id, DATE(cr.created_at) AS checkin_date, 'record' AS source, MIN(cr.id) AS record_id, MIN(cr.created_at) AS created_at
                FROM carbon_records cr
                LEFT JOIN user_checkins uc ON uc.record_id = cr.id
                WHERE cr.user_id = :uid AND cr.deleted_at IS NULL AND uc.id IS NULL
                GROUP BY cr.user_id, DATE(cr.created_at)";

        try {
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute(['uid' => $Silian_userId]);
            $Silian_count = $Silian_stmt->rowCount();
            if ($Silian_count > 0) {
                $this->logAudit('checkin_sync_completed', [
                    'user_id' => $Silian_userId,
                    'synced_count' => $Silian_count,
                ]);
            }

            return $Silian_count;
        } catch (\Throwable $Silian_e) {
            $this->logAudit('checkin_sync_failed', [
                'user_id' => $Silian_userId,
            ], 'failed');
            $this->logError($Silian_e, '/internal/checkins/sync', 'Failed to sync user checkins from records', [
                'user_id' => $Silian_userId,
            ]);
            $this->log('Checkin sync failed', [
                'error' => $Silian_e->getMessage(),
                'user_id' => $Silian_userId,
            ]);
            return 0;
        }
    }

    public function getConnection(): PDO
    {
        return $this->db;
    }

    public function hasCheckin(int $Silian_userId, string $Silian_date): bool
    {
        $Silian_stmt = $this->db->prepare("SELECT 1 FROM user_checkins WHERE user_id = :uid AND checkin_date = :cdate LIMIT 1");
        $Silian_stmt->execute([
            'uid' => $Silian_userId,
            'cdate' => $Silian_date,
        ]);
        return (bool) $Silian_stmt->fetchColumn();
    }

    public function getCheckinsForRange(int $Silian_userId, string $Silian_startDate, string $Silian_endDate): array
    {
        $Silian_stmt = $this->db->prepare("SELECT checkin_date, source, created_at, record_id, notes
            FROM user_checkins
            WHERE user_id = :uid AND checkin_date BETWEEN :start AND :end
            ORDER BY checkin_date ASC");
        $Silian_stmt->execute([
            'uid' => $Silian_userId,
            'start' => $Silian_startDate,
            'end' => $Silian_endDate,
        ]);

        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        return array_map(static function (array $Silian_row): array {
            return [
                'date' => $Silian_row['checkin_date'] ?? null,
                'source' => $Silian_row['source'] ?? 'record',
                'record_id' => $Silian_row['record_id'] ?? null,
                'notes' => $Silian_row['notes'] ?? null,
                'created_at' => $Silian_row['created_at'] ?? null,
            ];
        }, $Silian_rows);
    }

    public function getUserStreakStats(int $Silian_userId, ?DateTimeImmutable $Silian_today = null): array
    {
        $Silian_summary = $this->getUserCheckinSummary($Silian_userId);
        $Silian_dates = $this->getUserCheckinDates($Silian_userId);
        $Silian_today = $Silian_today ?: new DateTimeImmutable('now', $this->timezone);
        $Silian_streaks = $this->computeStreaks($Silian_dates, $Silian_today);

        return array_merge($Silian_summary, $Silian_streaks);
    }

    public function normalizeDateString(string $Silian_raw): ?string
    {
        $Silian_raw = trim($Silian_raw);
        if ($Silian_raw === '') {
            return null;
        }

        $Silian_candidate = DateTimeImmutable::createFromFormat('Y-m-d', $Silian_raw, $this->timezone);
        if ($Silian_candidate instanceof DateTimeImmutable && $Silian_candidate->format('Y-m-d') === $Silian_raw) {
            return $Silian_candidate->format('Y-m-d');
        }

        try {
            $Silian_fallback = new DateTimeImmutable($Silian_raw, $this->timezone);
            return $Silian_fallback->format('Y-m-d');
        } catch (\Throwable $Silian_e) {
            return null;
        }
    }

    private function getUserCheckinDates(int $Silian_userId): array
    {
        $Silian_stmt = $this->db->prepare("SELECT checkin_date FROM user_checkins WHERE user_id = :uid ORDER BY checkin_date ASC");
        $Silian_stmt->execute(['uid' => $Silian_userId]);
        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $Silian_dates = [];
        foreach ($Silian_rows as $Silian_row) {
            $Silian_date = $Silian_row['checkin_date'] ?? null;
            if ($Silian_date !== null && $Silian_date !== '') {
                $Silian_dates[] = $Silian_date;
            }
        }
        return $Silian_dates;
    }

    private function getUserCheckinSummary(int $Silian_userId): array
    {
        $Silian_stmt = $this->db->prepare("SELECT
                COUNT(*) AS total_days,
                SUM(CASE WHEN source = 'makeup' THEN 1 ELSE 0 END) AS makeup_days,
                MAX(checkin_date) AS last_checkin_date
            FROM user_checkins WHERE user_id = :uid");
        $Silian_stmt->execute(['uid' => $Silian_userId]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        return [
            'total_days' => (int) ($Silian_row['total_days'] ?? 0),
            'makeup_days' => (int) ($Silian_row['makeup_days'] ?? 0),
            'last_checkin_date' => $Silian_row['last_checkin_date'] ?? null,
        ];
    }

    private function computeStreaks(array $Silian_dates, DateTimeImmutable $Silian_today): array
    {
        if (empty($Silian_dates)) {
            return [
                'current_streak' => 0,
                'longest_streak' => 0,
                'last_active_date' => null,
                'active_today' => false,
            ];
        }

        $Silian_longest = 1;
        $Silian_streak = 1;
        $Silian_count = count($Silian_dates);

        for ($Silian_i = 1; $Silian_i < $Silian_count; $Silian_i++) {
            $Silian_diff = $this->diffDays($Silian_dates[$Silian_i - 1], $Silian_dates[$Silian_i]);
            if ($Silian_diff === 1) {
                $Silian_streak++;
            } else {
                $Silian_streak = 1;
            }
            if ($Silian_streak > $Silian_longest) {
                $Silian_longest = $Silian_streak;
            }
        }

        $Silian_lastDate = $Silian_dates[$Silian_count - 1];
        $Silian_todayStr = $Silian_today->format('Y-m-d');
        $Silian_yesterdayStr = $Silian_today->modify('-1 day')->format('Y-m-d');
        $Silian_activeToday = ($Silian_lastDate === $Silian_todayStr);

        $Silian_current = 0;
        if ($Silian_lastDate === $Silian_todayStr || $Silian_lastDate === $Silian_yesterdayStr) {
            $Silian_current = 1;
            for ($Silian_i = $Silian_count - 2; $Silian_i >= 0; $Silian_i--) {
                $Silian_diff = $this->diffDays($Silian_dates[$Silian_i], $Silian_dates[$Silian_i + 1]);
                if ($Silian_diff === 1) {
                    $Silian_current++;
                } else {
                    break;
                }
            }
        }

        return [
            'current_streak' => $Silian_current,
            'longest_streak' => $Silian_longest,
            'last_active_date' => $Silian_lastDate,
            'active_today' => $Silian_activeToday,
        ];
    }

    private function diffDays(string $Silian_from, string $Silian_to): int
    {
        $Silian_fromDate = new DateTimeImmutable($Silian_from, $this->timezone);
        $Silian_toDate = new DateTimeImmutable($Silian_to, $this->timezone);
        return (int) $Silian_fromDate->diff($Silian_toDate)->format('%r%a');
    }

    private function insertCheckin(
        int $Silian_userId,
        string $Silian_date,
        string $Silian_source,
        ?string $Silian_recordId,
        DateTimeInterface $Silian_createdAt,
        ?string $Silian_notes = null
    ): bool {
        $Silian_sql = $this->driver === 'sqlite'
            ? "INSERT OR IGNORE INTO user_checkins (user_id, checkin_date, source, record_id, notes, created_at)
                VALUES (:uid, :cdate, :source, :record_id, :notes, :created_at)"
            : "INSERT IGNORE INTO user_checkins (user_id, checkin_date, source, record_id, notes, created_at)
                VALUES (:uid, :cdate, :source, :record_id, :notes, :created_at)";

        try {
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute([
                'uid' => $Silian_userId,
                'cdate' => $Silian_date,
                'source' => $Silian_source,
                'record_id' => $Silian_recordId,
                'notes' => $Silian_notes,
                'created_at' => $Silian_createdAt->format('Y-m-d H:i:s'),
            ]);
            $Silian_inserted = $Silian_stmt->rowCount() > 0;
            if ($Silian_inserted) {
                $this->logAudit('checkin_record_persisted', [
                    'user_id' => $Silian_userId,
                    'checkin_date' => $Silian_date,
                    'source' => $Silian_source,
                    'record_id' => $Silian_recordId,
                ]);
            }

            return $Silian_inserted;
        } catch (\Throwable $Silian_e) {
            $this->logAudit('checkin_persist_failed', [
                'user_id' => $Silian_userId,
                'checkin_date' => $Silian_date,
                'source' => $Silian_source,
                'record_id' => $Silian_recordId,
            ], 'failed');
            $this->logError($Silian_e, '/internal/checkins', 'Failed to persist checkin', [
                'user_id' => $Silian_userId,
                'checkin_date' => $Silian_date,
                'source' => $Silian_source,
                'record_id' => $Silian_recordId,
            ]);
            $this->log('Checkin insert failed', [
                'error' => $Silian_e->getMessage(),
                'user_id' => $Silian_userId,
                'checkin_date' => $Silian_date,
                'source' => $Silian_source,
            ]);
            return false;
        }
    }

    private function formatDate(DateTimeInterface $Silian_date): string
    {
        $Silian_immutable = $Silian_date instanceof DateTimeImmutable ? $Silian_date : DateTimeImmutable::createFromInterface($Silian_date);
        return $Silian_immutable->setTimezone($this->timezone)->format('Y-m-d');
    }

    private function log(string $Silian_message, array $Silian_context = []): void
    {
        if (!$this->logger) {
            return;
        }
        try {
            $this->logger->warning($Silian_message, $Silian_context);
        } catch (\Throwable $Silian_ignore) {
            // ignore logger failures
        }
    }

    private function logAudit(string $Silian_action, array $Silian_context = [], string $Silian_status = 'success'): void
    {
        if (!$this->auditLogService) {
            return;
        }

        try {
            $this->auditLogService->log([
                'action' => $Silian_action,
                'operation_category' => 'checkin',
                'actor_type' => 'system',
                'status' => $Silian_status,
                'data' => $Silian_context,
            ]);
        } catch (\Throwable $Silian_ignore) {
            // ignore audit failures in checkin service
        }
    }

    private function logError(\Throwable $Silian_e, string $Silian_path, string $Silian_message, array $Silian_context = []): void
    {
        if (!$this->errorLogService) {
            return;
        }

        try {
            $Silian_request = SyntheticRequestFactory::fromContext($Silian_path, 'POST', null, [], $Silian_context);
            $this->errorLogService->logException($Silian_e, $Silian_request, ['context_message' => $Silian_message] + $Silian_context);
        } catch (\Throwable $Silian_ignore) {
            // ignore error log failures in checkin service
        }
    }
}
