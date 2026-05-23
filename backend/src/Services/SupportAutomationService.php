<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Models\SupportAssigneeProfile;
use CarbonTrack\Models\SupportRoutingSetting;
use CarbonTrack\Models\SupportTicketAutomationRule;
use CarbonTrack\Models\SupportTicketTag;
use CarbonTrack\Models\SupportTicketTagAssignment;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use Psr\Log\LoggerInterface;

class SupportAutomationService
{
    private const VALID_COLORS = ['slate', 'emerald', 'sky', 'amber', 'rose', 'violet'];

    public function __construct(
        private PDO $db,
        private LoggerInterface $logger,
        private AuditLogService $auditLogService,
        private ErrorLogService $errorLogService,
        private UserProfileViewService $userProfileViewService
    ) {
    }

    public function listAssignableUsers(): array
    {
        $Silian_stmt = $this->db->query("
            SELECT
                u.id,
                u.uuid,
                u.username,
                u.email,
                u.role,
                u.is_admin,
                u.status,
                u.school_id,
                s.name AS school_name,
                u.region_code,
                u.group_id,
                u.lastlgn,
                u.created_at,
                u.updated_at,
                COALESCE(p.level, CASE WHEN u.is_admin = 1 OR u.role = 'admin' THEN 5 WHEN u.role = 'support' THEN 2 ELSE 1 END) AS routing_level,
                COALESCE(p.skills_json, '[]') AS skills_json,
                COALESCE(p.languages_json, '[]') AS languages_json,
                COALESCE(p.max_active_tickets, 10) AS max_active_tickets,
                COALESCE(p.is_auto_assignable, 1) AS is_auto_assignable,
                COALESCE(p.weight_overrides_json, '{}') AS weight_overrides_json,
                COALESCE(p.status, CASE WHEN u.status = 'active' THEN 'active' ELSE 'offline' END) AS routing_status,
                COALESCE(feedback.avg_rating, 3.5) AS avg_feedback_rating,
                COALESCE(feedback.rating_count, 0) AS rating_count,
                SUM(CASE WHEN t.id IS NOT NULL THEN 1 ELSE 0 END) AS assigned_total_count,
                SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END) AS open_count,
                SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
                SUM(CASE WHEN t.status = 'waiting_user' THEN 1 ELSE 0 END) AS waiting_user_count,
                SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) AS resolved_count,
                SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END) AS closed_count
            FROM users u
            LEFT JOIN schools s ON s.id = u.school_id
            LEFT JOIN support_assignee_profiles p ON p.user_id = u.id
            LEFT JOIN support_tickets t ON t.assigned_to = u.id
            LEFT JOIN (
                SELECT rated_user_id, AVG(rating) AS avg_rating, COUNT(*) AS rating_count
                FROM support_ticket_feedback
                GROUP BY rated_user_id
            ) feedback ON feedback.rated_user_id = u.id
            WHERE u.deleted_at IS NULL
              AND (u.is_admin = 1 OR u.role IN ('support', 'admin'))
            GROUP BY
                u.id,
                u.uuid,
                u.username,
                u.email,
                u.role,
                u.is_admin,
                u.status,
                u.school_id,
                s.name,
                u.region_code,
                u.group_id,
                u.lastlgn,
                u.created_at,
                u.updated_at,
                p.level,
                p.skills_json,
                p.languages_json,
                p.max_active_tickets,
                p.is_auto_assignable,
                p.weight_overrides_json,
                p.status,
                feedback.avg_rating,
                feedback.rating_count
            ORDER BY u.is_admin DESC, COALESCE(u.username, u.email, '') ASC, u.id ASC
        ");

        return array_map(fn (array $Silian_row): array => $this->formatAssignableUser($Silian_row), $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    public function getAssignableUserDetail(int $Silian_userId): ?array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT
                u.id,
                u.uuid,
                u.username,
                u.email,
                u.role,
                u.is_admin,
                u.status,
                u.school_id,
                s.name AS school_name,
                u.region_code,
                u.group_id,
                u.lastlgn,
                u.created_at,
                u.updated_at,
                u.admin_notes,
                COALESCE(p.level, CASE WHEN u.is_admin = 1 OR u.role = 'admin' THEN 5 WHEN u.role = 'support' THEN 2 ELSE 1 END) AS routing_level,
                COALESCE(p.skills_json, '[]') AS skills_json,
                COALESCE(p.languages_json, '[]') AS languages_json,
                COALESCE(p.max_active_tickets, 10) AS max_active_tickets,
                COALESCE(p.is_auto_assignable, 1) AS is_auto_assignable,
                COALESCE(p.weight_overrides_json, '{}') AS weight_overrides_json,
                COALESCE(p.status, CASE WHEN u.status = 'active' THEN 'active' ELSE 'offline' END) AS routing_status,
                COALESCE(feedback.avg_rating, 3.5) AS avg_feedback_rating,
                COALESCE(feedback.rating_count, 0) AS rating_count,
                SUM(CASE WHEN t.id IS NOT NULL THEN 1 ELSE 0 END) AS assigned_total_count,
                SUM(CASE WHEN t.status = 'open' THEN 1 ELSE 0 END) AS open_count,
                SUM(CASE WHEN t.status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
                SUM(CASE WHEN t.status = 'waiting_user' THEN 1 ELSE 0 END) AS waiting_user_count,
                SUM(CASE WHEN t.status = 'resolved' THEN 1 ELSE 0 END) AS resolved_count,
                SUM(CASE WHEN t.status = 'closed' THEN 1 ELSE 0 END) AS closed_count
            FROM users u
            LEFT JOIN schools s ON s.id = u.school_id
            LEFT JOIN support_assignee_profiles p ON p.user_id = u.id
            LEFT JOIN support_tickets t ON t.assigned_to = u.id
            LEFT JOIN (
                SELECT rated_user_id, AVG(rating) AS avg_rating, COUNT(*) AS rating_count
                FROM support_ticket_feedback
                GROUP BY rated_user_id
            ) feedback ON feedback.rated_user_id = u.id
            WHERE u.id = :id
              AND u.deleted_at IS NULL
              AND (u.is_admin = 1 OR u.role IN ('support', 'admin'))
            GROUP BY
                u.id,
                u.uuid,
                u.username,
                u.email,
                u.role,
                u.is_admin,
                u.status,
                u.school_id,
                s.name,
                u.region_code,
                u.group_id,
                u.lastlgn,
                u.created_at,
                u.updated_at,
                u.admin_notes,
                p.level,
                p.skills_json,
                p.languages_json,
                p.max_active_tickets,
                p.is_auto_assignable,
                p.weight_overrides_json,
                p.status,
                feedback.avg_rating,
                feedback.rating_count
            LIMIT 1
        ");
        $Silian_stmt->execute(['id' => $Silian_userId]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        if (!$Silian_row) {
            return null;
        }

        $Silian_detail = $this->formatAssignableUser($Silian_row);
        $Silian_detail['admin_notes'] = $Silian_row['admin_notes'] ?? null;
        $Silian_detail['recent_tickets'] = $this->recentTicketsForAssignee($Silian_userId);
        $Silian_detail['feedback_summary'] = $this->feedbackSummaryForAssignee($Silian_userId);
        $Silian_detail['feedback_entries'] = $this->feedbackEntriesForAssignee($Silian_userId);
        $Silian_detail['routing_profile'] = [
            'user_id' => $Silian_detail['id'],
            'level' => (int) ($Silian_row['routing_level'] ?? 1),
            'skills' => $this->decodeJsonList($Silian_row['skills_json'] ?? null),
            'languages' => $this->decodeJsonList($Silian_row['languages_json'] ?? null),
            'max_active_tickets' => (int) ($Silian_row['max_active_tickets'] ?? 10),
            'is_auto_assignable' => !empty($Silian_row['is_auto_assignable']),
            'weight_overrides' => $this->decodeJsonObject($Silian_row['weight_overrides_json'] ?? null) ?? [],
            'status' => $Silian_row['routing_status'] ?? 'active',
            'avg_feedback_rating' => round((float) ($Silian_row['avg_feedback_rating'] ?? 3.5), 2),
            'rating_count' => (int) ($Silian_row['rating_count'] ?? 0),
        ];

        return $Silian_detail;
    }

    public function getRoutingSettings(): array
    {
        $Silian_row = $this->findRoutingSettingsRow();
        return $this->formatRoutingSettings($Silian_row ?? []);
    }

    public function saveRoutingSettings(array $Silian_actor, array $Silian_payload): array
    {
        $Silian_existing = $this->findRoutingSettingsRow();
        $Silian_weights = $this->normalizeJsonObject($Silian_payload['weights'] ?? ($this->decodeJsonObject($Silian_existing['weights_json'] ?? null) ?? []));
        $Silian_fallback = $this->normalizeJsonObject($Silian_payload['fallback'] ?? ($this->decodeJsonObject($Silian_existing['fallback_json'] ?? null) ?? []));
        $Silian_defaults = $this->normalizeJsonObject($Silian_payload['defaults'] ?? ($this->decodeJsonObject($Silian_existing['defaults_json'] ?? null) ?? []));
        $Silian_data = [
            'ai_enabled' => array_key_exists('ai_enabled', $Silian_payload) ? (bool) $Silian_payload['ai_enabled'] : (bool) ($Silian_existing['ai_enabled'] ?? true),
            'ai_timeout_ms' => max(1000, (int) ($Silian_payload['ai_timeout_ms'] ?? ($Silian_existing['ai_timeout_ms'] ?? 12000))),
            'due_soon_minutes' => max(1, (int) ($Silian_payload['due_soon_minutes'] ?? ($Silian_existing['due_soon_minutes'] ?? 30))),
            'weights_json' => json_encode($Silian_weights, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'fallback_json' => json_encode($Silian_fallback, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'defaults_json' => json_encode($Silian_defaults, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'updated_at' => $this->now(),
        ];

        if ($Silian_existing !== null) {
            $Silian_settings = SupportRoutingSetting::find((int) $Silian_existing['id']);
            $Silian_settings?->fill($Silian_data);
            $Silian_settings?->save();
            $Silian_result = $this->findRoutingSettingsRow();
            $Silian_action = 'support_routing_settings_updated';
        } else {
            $Silian_settings = SupportRoutingSetting::create($Silian_data + ['created_at' => $this->now()]);
            $Silian_result = $this->findRoutingSettingsRow((int) ($Silian_settings->id ?? 0));
            $Silian_action = 'support_routing_settings_created';
        }

        $Silian_formatted = $this->formatRoutingSettings($Silian_result ?? []);
        $this->auditLogService->log([
            'user_id' => (int) ($Silian_actor['id'] ?? 0),
            'action' => $Silian_action,
            'operation_category' => 'support',
            'actor_type' => !empty($Silian_actor['is_admin']) ? 'admin' : 'support',
            'affected_table' => 'support_routing_settings',
            'affected_id' => (int) ($Silian_formatted['id'] ?? 0),
            'status' => 'success',
            'new_data' => $Silian_formatted,
        ]);

        return $Silian_formatted;
    }

    public function getAssigneeRoutingProfile(int $Silian_userId): ?array
    {
        $Silian_detail = $this->getAssignableUserDetail($Silian_userId);
        if ($Silian_detail === null) {
            return null;
        }

        return $Silian_detail['routing_profile'] ?? null;
    }

    public function saveAssigneeRoutingProfile(array $Silian_actor, int $Silian_userId, array $Silian_payload): array
    {
        $Silian_assignee = $this->getAssignableUserDetail($Silian_userId);
        if ($Silian_assignee === null) {
            throw new \RuntimeException('Support assignee not found');
        }

        $Silian_existing = $this->findAssigneeProfileRow($Silian_userId);
        $Silian_data = [
            'user_id' => $Silian_userId,
            'level' => max(1, min(5, (int) ($Silian_payload['level'] ?? ($Silian_existing['level'] ?? ($Silian_assignee['routing_profile']['level'] ?? 1))))),
            'skills_json' => json_encode($this->normalizeStringList($Silian_payload['skills'] ?? $this->decodeJsonList($Silian_existing['skills_json'] ?? null)), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'languages_json' => json_encode($this->normalizeStringList($Silian_payload['languages'] ?? $this->decodeJsonList($Silian_existing['languages_json'] ?? null)), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'max_active_tickets' => max(1, (int) ($Silian_payload['max_active_tickets'] ?? ($Silian_existing['max_active_tickets'] ?? 10))),
            'is_auto_assignable' => array_key_exists('is_auto_assignable', $Silian_payload) ? (bool) $Silian_payload['is_auto_assignable'] : (bool) ($Silian_existing['is_auto_assignable'] ?? true),
            'weight_overrides_json' => json_encode($this->normalizeJsonObject($Silian_payload['weight_overrides'] ?? ($this->decodeJsonObject($Silian_existing['weight_overrides_json'] ?? null) ?? [])), JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'status' => $this->normalizeProfileStatus($Silian_payload['status'] ?? ($Silian_existing['status'] ?? 'active')),
            'updated_at' => $this->now(),
        ];

        if ($Silian_existing !== null) {
            $Silian_profile = SupportAssigneeProfile::find((int) $Silian_existing['id']);
            $Silian_profile?->fill($Silian_data);
            $Silian_profile?->save();
            $Silian_action = 'support_assignee_profile_updated';
        } else {
            SupportAssigneeProfile::create($Silian_data + ['created_at' => $this->now()]);
            $Silian_action = 'support_assignee_profile_created';
        }

        $Silian_detail = $this->getAssignableUserDetail($Silian_userId);
        $this->auditLogService->log([
            'user_id' => (int) ($Silian_actor['id'] ?? 0),
            'action' => $Silian_action,
            'operation_category' => 'support',
            'actor_type' => !empty($Silian_actor['is_admin']) ? 'admin' : 'support',
            'affected_table' => 'support_assignee_profiles',
            'affected_id' => $Silian_userId,
            'status' => 'success',
            'new_data' => $Silian_detail['routing_profile'] ?? null,
        ]);

        return $Silian_detail ?? [];
    }

    public function listTags(): array
    {
        $Silian_stmt = $this->db->query("
            SELECT
                t.*,
                COUNT(DISTINCT sta.ticket_id) AS ticket_count
            FROM support_ticket_tags t
            LEFT JOIN support_ticket_tag_assignments sta ON sta.tag_id = t.id
            GROUP BY t.id
            ORDER BY t.is_active DESC, t.name ASC, t.id ASC
        ");

        return array_map(fn (array $Silian_row): array => $this->formatTag($Silian_row), $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    public function saveTag(array $Silian_actor, array $Silian_payload, ?int $Silian_tagId = null): array
    {
        $Silian_existing = $Silian_tagId ? $this->findTagRow($Silian_tagId) : null;
        if ($Silian_tagId && $Silian_existing === null) {
            throw new \RuntimeException('Tag not found');
        }

        $Silian_name = $this->requireString($Silian_payload['name'] ?? null, 'name');
        $Silian_slug = $this->normalizeSlug($Silian_payload['slug'] ?? $Silian_name);
        $Silian_color = $this->normalizeColor($Silian_payload['color'] ?? ($Silian_existing['color'] ?? 'emerald'));
        $Silian_description = $this->nullableString($Silian_payload['description'] ?? null);
        $Silian_isActive = array_key_exists('is_active', $Silian_payload) ? (bool) $Silian_payload['is_active'] : (bool) ($Silian_existing['is_active'] ?? true);

        $Silian_duplicateStmt = $this->db->prepare('SELECT id FROM support_ticket_tags WHERE slug = :slug AND (:tag_id_null IS NULL OR id <> :tag_id_compare) LIMIT 1');
        $Silian_duplicateStmt->execute([
            'slug' => $Silian_slug,
            'tag_id_null' => $Silian_tagId,
            'tag_id_compare' => $Silian_tagId,
        ]);
        if ($Silian_duplicateStmt->fetchColumn()) {
            throw new \InvalidArgumentException('Tag slug already exists');
        }

        $Silian_now = $this->now();
        if ($Silian_existing) {
            $Silian_tag = SupportTicketTag::find($Silian_tagId);
            $Silian_tag->fill([
                'slug' => $Silian_slug,
                'name' => $Silian_name,
                'color' => $Silian_color,
                'description' => $Silian_description,
                'is_active' => $Silian_isActive,
                'updated_at' => $Silian_now,
            ]);
            $Silian_tag->save();
            $Silian_result = $this->findTagRow($Silian_tagId);
            $Silian_action = 'support_tag_updated';
        } else {
            $Silian_tag = SupportTicketTag::create([
                'slug' => $Silian_slug,
                'name' => $Silian_name,
                'color' => $Silian_color,
                'description' => $Silian_description,
                'is_active' => $Silian_isActive,
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ]);
            $Silian_result = $this->findTagRow((int) $Silian_tag->id);
            $Silian_action = 'support_tag_created';
        }

        $this->auditLogService->log([
            'user_id' => (int) ($Silian_actor['id'] ?? 0),
            'action' => $Silian_action,
            'operation_category' => 'support',
            'actor_type' => !empty($Silian_actor['is_admin']) ? 'admin' : 'support',
            'affected_table' => 'support_ticket_tags',
            'affected_id' => (int) ($Silian_result['id'] ?? 0),
            'status' => 'success',
            'new_data' => $Silian_result,
        ]);

        return $this->formatTag($Silian_result ?: []);
    }

    public function listRules(): array
    {
        $Silian_stmt = $this->db->query("
            SELECT
                r.*,
                assignee.username AS assignee_username,
                assignee.email AS assignee_email
            FROM support_ticket_automation_rules r
            LEFT JOIN users assignee ON assignee.id = r.assign_to
            ORDER BY r.sort_order ASC, r.id ASC
        ");
        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return array_map(fn (array $Silian_row): array => $this->formatRule($Silian_row), $Silian_rows);
    }

    public function saveRule(array $Silian_actor, array $Silian_payload, ?int $Silian_ruleId = null): array
    {
        $Silian_existing = $Silian_ruleId ? $this->findRuleRow($Silian_ruleId) : null;
        if ($Silian_ruleId && $Silian_existing === null) {
            throw new \RuntimeException('Rule not found');
        }

        $Silian_name = $this->requireString($Silian_payload['name'] ?? null, 'name');
        $Silian_description = $this->nullableString($Silian_payload['description'] ?? null);
        $Silian_isActive = array_key_exists('is_active', $Silian_payload) ? (bool) $Silian_payload['is_active'] : (bool) ($Silian_existing['is_active'] ?? true);
        $Silian_sortOrder = isset($Silian_payload['sort_order']) ? (int) $Silian_payload['sort_order'] : (int) ($Silian_existing['sort_order'] ?? 0);
        $Silian_matchCategory = $this->nullableString($Silian_payload['match_category'] ?? ($Silian_existing['match_category'] ?? null));
        $Silian_matchPriority = $this->nullableString($Silian_payload['match_priority'] ?? ($Silian_existing['match_priority'] ?? null));
        $Silian_weekdays = $this->normalizeWeekdays($Silian_payload['match_weekdays'] ?? $this->decodeJsonList($Silian_existing['match_weekdays'] ?? null));
        $Silian_timeStart = $this->normalizeTime($Silian_payload['match_time_start'] ?? ($Silian_existing['match_time_start'] ?? null));
        $Silian_timeEnd = $this->normalizeTime($Silian_payload['match_time_end'] ?? ($Silian_existing['match_time_end'] ?? null));
        $Silian_timezone = $this->normalizeTimezone($Silian_payload['timezone'] ?? ($Silian_existing['timezone'] ?? 'Asia/Shanghai'));
        $Silian_assignTo = $this->normalizeAssignableUser($Silian_payload['assign_to'] ?? ($Silian_existing['assign_to'] ?? null));
        $Silian_scoreBoost = isset($Silian_payload['score_boost']) ? round((float) $Silian_payload['score_boost'], 2) : (float) ($Silian_existing['score_boost'] ?? ($Silian_assignTo ? 20 : 0));
        $Silian_requiredAgentLevel = $this->normalizeRequiredAgentLevel($Silian_payload['required_agent_level'] ?? ($Silian_existing['required_agent_level'] ?? null));
        $Silian_skillHints = $this->normalizeStringList($Silian_payload['skill_hints'] ?? $this->decodeJsonList($Silian_existing['skill_hints_json'] ?? null));
        $Silian_tagIds = $this->normalizeTagIds($Silian_payload['tag_ids'] ?? $this->decodeJsonList($Silian_existing['add_tag_ids'] ?? null));

        $Silian_now = $this->now();
        $Silian_data = [
            'name' => $Silian_name,
            'description' => $Silian_description,
            'is_active' => $Silian_isActive,
            'sort_order' => $Silian_sortOrder,
            'match_category' => $Silian_matchCategory,
            'match_priority' => $Silian_matchPriority,
            'match_weekdays' => $Silian_weekdays === [] ? null : json_encode($Silian_weekdays),
            'match_time_start' => $Silian_timeStart,
            'match_time_end' => $Silian_timeEnd,
            'timezone' => $Silian_timezone,
            'assign_to' => $Silian_assignTo,
            'score_boost' => $Silian_scoreBoost,
            'required_agent_level' => $Silian_requiredAgentLevel,
            'skill_hints_json' => $Silian_skillHints === [] ? null : json_encode($Silian_skillHints, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            'add_tag_ids' => $Silian_tagIds === [] ? null : json_encode($Silian_tagIds),
            'stop_processing' => false,
            'updated_at' => $Silian_now,
        ];

        if ($Silian_existing) {
            $Silian_rule = SupportTicketAutomationRule::find($Silian_ruleId);
            $Silian_rule->fill($Silian_data);
            $Silian_rule->save();
            $Silian_result = $this->findRuleRow($Silian_ruleId);
            $Silian_action = 'support_rule_updated';
        } else {
            $Silian_rule = SupportTicketAutomationRule::create($Silian_data + [
                'trigger_count' => 0,
                'last_triggered_at' => null,
                'created_at' => $Silian_now,
            ]);
            $Silian_result = $this->findRuleRow((int) $Silian_rule->id);
            $Silian_action = 'support_rule_created';
        }

        $this->auditLogService->log([
            'user_id' => (int) ($Silian_actor['id'] ?? 0),
            'action' => $Silian_action,
            'operation_category' => 'support',
            'actor_type' => !empty($Silian_actor['is_admin']) ? 'admin' : 'support',
            'affected_table' => 'support_ticket_automation_rules',
            'affected_id' => (int) ($Silian_result['id'] ?? 0),
            'status' => 'success',
            'new_data' => $Silian_result,
        ]);

        return $this->formatRule($Silian_result ?: []);
    }

    public function getReports(array $Silian_query = []): array
    {
        $Silian_days = max(7, min(90, (int) ($Silian_query['days'] ?? 14)));

        return [
            'summary' => $this->summaryMetrics(),
            'timeline' => $this->createdTimeline($Silian_days),
            'by_status' => $this->breakdown('status'),
            'by_category' => $this->breakdown('category'),
            'by_priority' => $this->breakdown('priority'),
            'by_assignee' => $this->assigneeBreakdown(),
            'by_agent_level' => $this->agentLevelBreakdown(),
            'by_tag' => $this->tagBreakdown(),
            'rule_hits' => $this->ruleHitBreakdown(),
            'routing_outcomes' => $this->routingOutcomeBreakdown(),
        ];
    }

    public function applyRulesToTicket(int $Silian_ticketId, ?array $Silian_ticket = null, string $Silian_trigger = 'created'): array
    {
        $Silian_ticketRow = $Silian_ticket ?? $this->findTicketRow($Silian_ticketId);
        if ($Silian_ticketRow === null) {
            throw new \RuntimeException('Ticket not found');
        }

        $Silian_rulesStmt = $this->db->query("
            SELECT
                r.*,
                assignee.username AS assignee_username,
                assignee.email AS assignee_email
            FROM support_ticket_automation_rules r
            LEFT JOIN users assignee ON assignee.id = r.assign_to
            WHERE r.is_active = 1
            ORDER BY r.sort_order ASC, r.id ASC
        ");
        $Silian_rules = $Silian_rulesStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $Silian_ticketTags = $this->getTagsForTicketIds([$Silian_ticketId]);
        $Silian_applied = [];

        foreach ($Silian_rules as $Silian_rule) {
            if (!$this->ruleMatchesTicket($Silian_rule, $Silian_ticketRow)) {
                continue;
            }

            $Silian_appliedTagIds = [];
            $Silian_ruleTagIds = $this->decodeJsonList($Silian_rule['add_tag_ids'] ?? null);
            foreach ($Silian_ruleTagIds as $Silian_tagId) {
                $Silian_tagId = (int) $Silian_tagId;
                if ($Silian_tagId <= 0 || isset($Silian_ticketTags[$Silian_ticketId][$Silian_tagId])) {
                    continue;
                }
                $Silian_tagRow = $this->findTagRow($Silian_tagId);
                if ($Silian_tagRow === null || empty($Silian_tagRow['is_active'])) {
                    continue;
                }
                SupportTicketTagAssignment::create([
                    'ticket_id' => $Silian_ticketId,
                    'tag_id' => $Silian_tagId,
                    'source_type' => 'rule',
                    'rule_id' => (int) $Silian_rule['id'],
                    'created_at' => $this->now(),
                ]);
                $Silian_ticketTags[$Silian_ticketId][$Silian_tagId] = $this->formatTag($Silian_tagRow);
                $Silian_appliedTagIds[] = $Silian_tagId;
            }

            if ($Silian_appliedTagIds !== [] || !empty($Silian_rule['assign_to']) || (float) ($Silian_rule['score_boost'] ?? 0) !== 0.0) {
                $this->touchRuleMetrics((int) $Silian_rule['id']);
                $Silian_applied[] = [
                    'rule_id' => (int) $Silian_rule['id'],
                    'rule_name' => (string) $Silian_rule['name'],
                    'assigned_to' => !empty($Silian_rule['assign_to']) ? (int) $Silian_rule['assign_to'] : null,
                    'score_boost' => round((float) ($Silian_rule['score_boost'] ?? 0), 2),
                    'required_agent_level' => isset($Silian_rule['required_agent_level']) ? (int) $Silian_rule['required_agent_level'] : null,
                    'tag_ids' => $Silian_appliedTagIds,
                ];

                $this->auditLogService->log([
                    'user_id' => null,
                    'action' => 'support_rule_applied',
                    'operation_category' => 'support',
                    'actor_type' => 'system',
                    'affected_table' => 'support_tickets',
                    'affected_id' => $Silian_ticketId,
                    'status' => 'success',
                    'data' => [
                        'trigger' => $Silian_trigger,
                        'rule_id' => (int) $Silian_rule['id'],
                        'assigned_to' => !empty($Silian_rule['assign_to']) ? (int) $Silian_rule['assign_to'] : null,
                        'score_boost' => round((float) ($Silian_rule['score_boost'] ?? 0), 2),
                        'tag_ids' => $Silian_appliedTagIds,
                    ],
                ]);
            }
        }

        return [
            'assigned_to' => isset($Silian_ticketRow['assigned_to']) ? (int) $Silian_ticketRow['assigned_to'] : null,
            'assignment_source' => $Silian_ticketRow['assignment_source'] ?? null,
            'assigned_rule_id' => isset($Silian_ticketRow['assigned_rule_id']) ? (int) $Silian_ticketRow['assigned_rule_id'] : null,
            'applied_rules' => $Silian_applied,
            'tags' => array_values($Silian_ticketTags[$Silian_ticketId] ?? []),
        ];
    }

    public function getTagsForTicket(int $Silian_ticketId): array
    {
        return array_values($this->getTagsForTicketIds([$Silian_ticketId])[$Silian_ticketId] ?? []);
    }

    public function getTagsForTicketIds(array $Silian_ticketIds): array
    {
        $Silian_ticketIds = array_values(array_unique(array_filter(array_map('intval', $Silian_ticketIds), fn (int $Silian_id): bool => $Silian_id > 0)));
        if ($Silian_ticketIds === []) {
            return [];
        }

        $Silian_sql = '
            SELECT
                sta.ticket_id,
                sta.source_type,
                sta.rule_id,
                t.*
            FROM support_ticket_tag_assignments sta
            INNER JOIN support_ticket_tags t ON t.id = sta.tag_id
            WHERE sta.ticket_id IN (' . implode(',', array_fill(0, count($Silian_ticketIds), '?')) . ')
            ORDER BY t.name ASC, t.id ASC
        ';
        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute($Silian_ticketIds);
        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        $Silian_tagsByTicket = [];
        foreach ($Silian_rows as $Silian_row) {
            $Silian_ticketId = (int) $Silian_row['ticket_id'];
            $Silian_tag = $this->formatTag($Silian_row);
            $Silian_tag['source_type'] = $Silian_row['source_type'] ?? 'rule';
            $Silian_tag['rule_id'] = isset($Silian_row['rule_id']) ? (int) $Silian_row['rule_id'] : null;
            $Silian_tagsByTicket[$Silian_ticketId][$Silian_tag['id']] = $Silian_tag;
        }

        return $Silian_tagsByTicket;
    }

    private function summaryMetrics(): array
    {
        $Silian_stmt = $this->db->query("
            SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'open' THEN 1 ELSE 0 END) AS open_count,
                SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) AS in_progress_count,
                SUM(CASE WHEN status = 'waiting_user' THEN 1 ELSE 0 END) AS waiting_user_count,
                SUM(CASE WHEN status = 'resolved' THEN 1 ELSE 0 END) AS resolved_count,
                SUM(CASE WHEN status = 'closed' THEN 1 ELSE 0 END) AS closed_count,
                SUM(CASE WHEN assigned_to IS NULL THEN 1 ELSE 0 END) AS unassigned_count,
                SUM(CASE WHEN assignment_source = 'smart' THEN 1 ELSE 0 END) AS smart_assigned_count,
                SUM(CASE WHEN assignment_source = 'manual' THEN 1 ELSE 0 END) AS manual_assigned_count,
                SUM(CASE WHEN sla_status IN ('breached', 'escalated') THEN 1 ELSE 0 END) AS sla_breach_count
            FROM support_tickets
        ");
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $Silian_avgResolutionHours = null;
        $Silian_resolutionStmt = $this->db->query('SELECT created_at, resolved_at FROM support_tickets WHERE resolved_at IS NOT NULL');
        $Silian_resolutionRows = $Silian_resolutionStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        if ($Silian_resolutionRows !== []) {
            $Silian_hours = [];
            foreach ($Silian_resolutionRows as $Silian_resolutionRow) {
                try {
                    $Silian_createdAt = new DateTimeImmutable((string) $Silian_resolutionRow['created_at']);
                    $Silian_resolvedAt = new DateTimeImmutable((string) $Silian_resolutionRow['resolved_at']);
                    $Silian_hours[] = max(0, ($Silian_resolvedAt->getTimestamp() - $Silian_createdAt->getTimestamp()) / 3600);
                } catch (\Throwable) {
                    continue;
                }
            }
            if ($Silian_hours !== []) {
                $Silian_avgResolutionHours = round(array_sum($Silian_hours) / count($Silian_hours), 1);
            }
        }

        return [
            'total' => (int) ($Silian_row['total'] ?? 0),
            'open' => (int) ($Silian_row['open_count'] ?? 0),
            'in_progress' => (int) ($Silian_row['in_progress_count'] ?? 0),
            'waiting_user' => (int) ($Silian_row['waiting_user_count'] ?? 0),
            'resolved' => (int) ($Silian_row['resolved_count'] ?? 0),
            'closed' => (int) ($Silian_row['closed_count'] ?? 0),
            'unassigned' => (int) ($Silian_row['unassigned_count'] ?? 0),
            'smart_assignment_count' => (int) ($Silian_row['smart_assigned_count'] ?? 0),
            'manual_assigned' => (int) ($Silian_row['manual_assigned_count'] ?? 0),
            'sla_breach_count' => (int) ($Silian_row['sla_breach_count'] ?? 0),
            'avg_resolution_hours' => $Silian_avgResolutionHours,
        ];
    }

    private function createdTimeline(int $Silian_days): array
    {
        $Silian_startDate = (new DateTimeImmutable('today'))->modify('-' . ($Silian_days - 1) . ' days')->format('Y-m-d 00:00:00');
        $Silian_stmt = $this->db->prepare("
            SELECT DATE(created_at) AS date_key, COUNT(*) AS ticket_count
            FROM support_tickets
            WHERE created_at >= :start_date
            GROUP BY DATE(created_at)
            ORDER BY DATE(created_at) ASC
        ");
        $Silian_stmt->execute(['start_date' => $Silian_startDate]);
        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $Silian_indexed = [];
        foreach ($Silian_rows as $Silian_row) {
            $Silian_indexed[(string) $Silian_row['date_key']] = (int) $Silian_row['ticket_count'];
        }

        $Silian_result = [];
        for ($Silian_i = 0; $Silian_i < $Silian_days; $Silian_i++) {
            $Silian_date = (new DateTimeImmutable('today'))->modify('-' . ($Silian_days - $Silian_i - 1) . ' days')->format('Y-m-d');
            $Silian_result[] = ['date' => $Silian_date, 'count' => (int) ($Silian_indexed[$Silian_date] ?? 0)];
        }

        return $Silian_result;
    }

    private function breakdown(string $Silian_field): array
    {
        $Silian_stmt = $this->db->query("
            SELECT {$Silian_field} AS bucket, COUNT(*) AS ticket_count
            FROM support_tickets
            GROUP BY {$Silian_field}
            ORDER BY ticket_count DESC, {$Silian_field} ASC
        ");

        return array_map(fn (array $Silian_row): array => [
            'key' => (string) ($Silian_row['bucket'] ?? ''),
            'count' => (int) ($Silian_row['ticket_count'] ?? 0),
        ], $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    private function assigneeBreakdown(): array
    {
        $Silian_stmt = $this->db->query("
            SELECT
                COALESCE(u.username, 'unassigned') AS label,
                t.assigned_to,
                COUNT(*) AS ticket_count
            FROM support_tickets t
            LEFT JOIN users u ON u.id = t.assigned_to
            GROUP BY t.assigned_to, COALESCE(u.username, 'unassigned')
            ORDER BY ticket_count DESC, label ASC
        ");

        return array_map(fn (array $Silian_row): array => [
            'id' => isset($Silian_row['assigned_to']) ? (int) $Silian_row['assigned_to'] : null,
            'label' => (string) ($Silian_row['label'] ?? 'unassigned'),
            'count' => (int) ($Silian_row['ticket_count'] ?? 0),
        ], $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    private function agentLevelBreakdown(): array
    {
        $Silian_stmt = $this->db->query("
            SELECT
                COALESCE(p.level, 0) AS level_bucket,
                COUNT(*) AS assignee_count
            FROM support_assignee_profiles p
            INNER JOIN users u ON u.id = p.user_id
            WHERE u.deleted_at IS NULL
              AND (u.is_admin = 1 OR u.role IN ('support', 'admin'))
            GROUP BY COALESCE(p.level, 0)
            ORDER BY level_bucket ASC
        ");

        return array_map(static fn (array $Silian_row): array => [
            'level' => (int) ($Silian_row['level_bucket'] ?? 0),
            'count' => (int) ($Silian_row['assignee_count'] ?? 0),
        ], $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    private function tagBreakdown(): array
    {
        $Silian_stmt = $this->db->query("
            SELECT
                t.id,
                t.slug,
                t.name,
                t.color,
                COUNT(sta.ticket_id) AS ticket_count
            FROM support_ticket_tags t
            LEFT JOIN support_ticket_tag_assignments sta ON sta.tag_id = t.id
            GROUP BY t.id
            ORDER BY ticket_count DESC, t.name ASC
        ");

        return array_map(fn (array $Silian_row): array => [
            'id' => (int) $Silian_row['id'],
            'slug' => (string) $Silian_row['slug'],
            'name' => (string) $Silian_row['name'],
            'color' => (string) $Silian_row['color'],
            'count' => (int) ($Silian_row['ticket_count'] ?? 0),
        ], $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    private function ruleHitBreakdown(): array
    {
        $Silian_stmt = $this->db->query("
            SELECT id, name, trigger_count, last_triggered_at, is_active
            FROM support_ticket_automation_rules
            ORDER BY trigger_count DESC, sort_order ASC, id ASC
        ");

        return array_map(fn (array $Silian_row): array => [
            'id' => (int) $Silian_row['id'],
            'name' => (string) $Silian_row['name'],
            'trigger_count' => (int) ($Silian_row['trigger_count'] ?? 0),
            'last_triggered_at' => $Silian_row['last_triggered_at'] ?? null,
            'is_active' => !empty($Silian_row['is_active']),
        ], $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    private function routingOutcomeBreakdown(): array
    {
        $Silian_stmt = $this->db->query("
            SELECT
                COALESCE(`trigger`, 'unknown') AS trigger_bucket,
                COUNT(*) AS run_count,
                SUM(CASE WHEN winner_user_id IS NULL THEN 1 ELSE 0 END) AS no_winner_count,
                SUM(CASE WHEN used_ai = 1 THEN 1 ELSE 0 END) AS used_ai_count
            FROM support_ticket_routing_runs
            GROUP BY COALESCE(`trigger`, 'unknown')
            ORDER BY run_count DESC, trigger_bucket ASC
        ");

        return array_map(static fn (array $Silian_row): array => [
            'trigger' => (string) ($Silian_row['trigger_bucket'] ?? 'unknown'),
            'count' => (int) ($Silian_row['run_count'] ?? 0),
            'no_winner_count' => (int) ($Silian_row['no_winner_count'] ?? 0),
            'used_ai_count' => (int) ($Silian_row['used_ai_count'] ?? 0),
        ], $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    private function touchRuleMetrics(int $Silian_ruleId): void
    {
        $Silian_stmt = $this->db->prepare("
            UPDATE support_ticket_automation_rules
            SET trigger_count = trigger_count + 1,
                last_triggered_at = :last_triggered_at,
                updated_at = :updated_at
            WHERE id = :id
        ");
        $Silian_now = $this->now();
        $Silian_stmt->execute([
            'last_triggered_at' => $Silian_now,
            'updated_at' => $Silian_now,
            'id' => $Silian_ruleId,
        ]);
    }

    private function findTicketRow(int $Silian_ticketId): ?array
    {
        $Silian_stmt = $this->db->prepare('SELECT * FROM support_tickets WHERE id = :id LIMIT 1');
        $Silian_stmt->execute(['id' => $Silian_ticketId]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return $Silian_row ?: null;
    }

    private function findTagRow(int $Silian_tagId): ?array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT
                t.*,
                COUNT(DISTINCT sta.ticket_id) AS ticket_count
            FROM support_ticket_tags t
            LEFT JOIN support_ticket_tag_assignments sta ON sta.tag_id = t.id
            WHERE t.id = :id
            GROUP BY t.id
            LIMIT 1
        ");
        $Silian_stmt->execute(['id' => $Silian_tagId]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return $Silian_row ?: null;
    }

    private function findRuleRow(int $Silian_ruleId): ?array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT
                r.*,
                assignee.username AS assignee_username,
                assignee.email AS assignee_email
            FROM support_ticket_automation_rules r
            LEFT JOIN users assignee ON assignee.id = r.assign_to
            WHERE r.id = :id
            LIMIT 1
        ");
        $Silian_stmt->execute(['id' => $Silian_ruleId]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return $Silian_row ?: null;
    }

    private function findRoutingSettingsRow(?int $Silian_settingsId = null): ?array
    {
        $Silian_sql = 'SELECT * FROM support_routing_settings';
        $Silian_params = [];
        if ($Silian_settingsId !== null && $Silian_settingsId > 0) {
            $Silian_sql .= ' WHERE id = :id';
            $Silian_params['id'] = $Silian_settingsId;
        }
        $Silian_sql .= ' ORDER BY id ASC LIMIT 1';
        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute($Silian_params);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return $Silian_row ?: null;
    }

    private function findAssigneeProfileRow(int $Silian_userId): ?array
    {
        $Silian_stmt = $this->db->prepare('SELECT * FROM support_assignee_profiles WHERE user_id = :user_id LIMIT 1');
        $Silian_stmt->execute(['user_id' => $Silian_userId]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return $Silian_row ?: null;
    }

    private function ruleMatchesTicket(array $Silian_rule, array $Silian_ticket): bool
    {
        if (!empty($Silian_rule['match_category']) && (string) $Silian_rule['match_category'] !== (string) ($Silian_ticket['category'] ?? '')) {
            return false;
        }
        if (!empty($Silian_rule['match_priority']) && (string) $Silian_rule['match_priority'] !== (string) ($Silian_ticket['priority'] ?? '')) {
            return false;
        }

        $Silian_timezone = $this->normalizeTimezone($Silian_rule['timezone'] ?? 'Asia/Shanghai');
        $Silian_now = new DateTimeImmutable('now', new DateTimeZone($Silian_timezone));
        $Silian_weekday = strtolower($Silian_now->format('D'));
        $Silian_ruleWeekdays = $this->decodeJsonList($Silian_rule['match_weekdays'] ?? null);
        if ($Silian_ruleWeekdays !== [] && !in_array($Silian_weekday, $Silian_ruleWeekdays, true)) {
            return false;
        }

        $Silian_timeStart = $Silian_rule['match_time_start'] ?? null;
        $Silian_timeEnd = $Silian_rule['match_time_end'] ?? null;
        if ($Silian_timeStart || $Silian_timeEnd) {
            $Silian_currentTime = $Silian_now->format('H:i');
            if (!$this->timeWindowMatches($Silian_currentTime, $Silian_timeStart, $Silian_timeEnd)) {
                return false;
            }
        }

        return true;
    }

    private function timeWindowMatches(string $Silian_current, ?string $Silian_start, ?string $Silian_end): bool
    {
        if (!$Silian_start || !$Silian_end) {
            return true;
        }
        if ($Silian_start <= $Silian_end) {
            return $Silian_current >= $Silian_start && $Silian_current <= $Silian_end;
        }
        return $Silian_current >= $Silian_start || $Silian_current <= $Silian_end;
    }

    private function formatTag(array $Silian_row): array
    {
        return [
            'id' => (int) ($Silian_row['id'] ?? 0),
            'slug' => (string) ($Silian_row['slug'] ?? ''),
            'name' => (string) ($Silian_row['name'] ?? ''),
            'color' => (string) ($Silian_row['color'] ?? 'emerald'),
            'description' => $Silian_row['description'] ?? null,
            'is_active' => !empty($Silian_row['is_active']),
            'ticket_count' => (int) ($Silian_row['ticket_count'] ?? 0),
            'source_type' => $Silian_row['source_type'] ?? null,
            'rule_id' => isset($Silian_row['rule_id']) ? (int) $Silian_row['rule_id'] : null,
            'created_at' => $Silian_row['created_at'] ?? null,
            'updated_at' => $Silian_row['updated_at'] ?? null,
        ];
    }

    private function formatAssignableUser(array $Silian_row): array
    {
        $Silian_profileFields = $this->userProfileViewService->buildProfileFields($Silian_row);
        $Silian_legacyDisplayFields = $this->userProfileViewService->buildLegacyDisplayFields($Silian_row, $Silian_profileFields);
        $Silian_maxActiveTickets = max(1, (int) ($Silian_row['max_active_tickets'] ?? 10));
        $Silian_activeCount = (int) (($Silian_row['open_count'] ?? 0) + ($Silian_row['in_progress_count'] ?? 0) + ($Silian_row['waiting_user_count'] ?? 0));

        return [
            'id' => (int) ($Silian_row['id'] ?? 0),
            'uuid' => $Silian_row['uuid'] ?? null,
            'username' => $Silian_row['username'] ?? null,
            'email' => $Silian_row['email'] ?? null,
            'role' => !empty($Silian_row['is_admin']) ? 'admin' : strtolower((string) ($Silian_row['role'] ?? 'support')),
            'status' => $Silian_row['status'] ?? null,
            'school_id' => $Silian_profileFields['school_id'] ?? (isset($Silian_row['school_id']) ? (int) $Silian_row['school_id'] : null),
            'school' => $Silian_legacyDisplayFields['school'] ?? null,
            'region_code' => $Silian_profileFields['region_code'] ?? ($Silian_row['region_code'] ?? null),
            'location' => $Silian_legacyDisplayFields['location'] ?? null,
            'group_id' => isset($Silian_row['group_id']) ? (int) $Silian_row['group_id'] : null,
            'last_login_at' => $Silian_row['lastlgn'] ?? null,
            'created_at' => $Silian_row['created_at'] ?? null,
            'updated_at' => $Silian_row['updated_at'] ?? null,
            'assigned_total_count' => (int) ($Silian_row['assigned_total_count'] ?? 0),
            'open_count' => (int) ($Silian_row['open_count'] ?? 0),
            'in_progress_count' => (int) ($Silian_row['in_progress_count'] ?? 0),
            'waiting_user_count' => (int) ($Silian_row['waiting_user_count'] ?? 0),
            'resolved_count' => (int) ($Silian_row['resolved_count'] ?? 0),
            'closed_count' => (int) ($Silian_row['closed_count'] ?? 0),
            'routing_level' => (int) ($Silian_row['routing_level'] ?? 1),
            'skills' => $this->decodeJsonList($Silian_row['skills_json'] ?? null),
            'languages' => $this->decodeJsonList($Silian_row['languages_json'] ?? null),
            'max_active_tickets' => $Silian_maxActiveTickets,
            'is_auto_assignable' => !empty($Silian_row['is_auto_assignable']),
            'routing_status' => $Silian_row['routing_status'] ?? 'active',
            'avg_feedback_rating' => round((float) ($Silian_row['avg_feedback_rating'] ?? 3.5), 2),
            'rating_count' => (int) ($Silian_row['rating_count'] ?? 0),
            'available_capacity' => max(0, $Silian_maxActiveTickets - $Silian_activeCount),
            'weight_overrides' => $this->decodeJsonObject($Silian_row['weight_overrides_json'] ?? null) ?? [],
        ];
    }

    private function recentTicketsForAssignee(int $Silian_userId): array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT id, subject, status, priority, last_replied_at, updated_at, created_at
            FROM support_tickets
            WHERE assigned_to = :assigned_to
            ORDER BY COALESCE(last_replied_at, updated_at, created_at) DESC, id DESC
            LIMIT 10
        ");
        $Silian_stmt->execute(['assigned_to' => $Silian_userId]);

        return array_map(static fn (array $Silian_row): array => [
            'id' => (int) ($Silian_row['id'] ?? 0),
            'subject' => (string) ($Silian_row['subject'] ?? ''),
            'status' => (string) ($Silian_row['status'] ?? ''),
            'priority' => (string) ($Silian_row['priority'] ?? ''),
            'last_replied_at' => $Silian_row['last_replied_at'] ?? null,
            'updated_at' => $Silian_row['updated_at'] ?? null,
            'created_at' => $Silian_row['created_at'] ?? null,
        ], $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    private function feedbackSummaryForAssignee(int $Silian_userId): array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT
                COUNT(*) AS rating_count,
                AVG(rating) AS avg_rating,
                MAX(COALESCE(updated_at, created_at)) AS last_feedback_at,
                SUM(CASE WHEN rating = 5 THEN 1 ELSE 0 END) AS rating_5_count,
                SUM(CASE WHEN rating = 4 THEN 1 ELSE 0 END) AS rating_4_count,
                SUM(CASE WHEN rating = 3 THEN 1 ELSE 0 END) AS rating_3_count,
                SUM(CASE WHEN rating = 2 THEN 1 ELSE 0 END) AS rating_2_count,
                SUM(CASE WHEN rating = 1 THEN 1 ELSE 0 END) AS rating_1_count
            FROM support_ticket_feedback
            WHERE rated_user_id = :user_id
        ");
        $Silian_stmt->execute(['user_id' => $Silian_userId]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC) ?: [];
        $Silian_ratingCount = (int) ($Silian_row['rating_count'] ?? 0);

        return [
            'average_rating' => $Silian_ratingCount > 0 ? round((float) ($Silian_row['avg_rating'] ?? 0), 2) : null,
            'rating_count' => $Silian_ratingCount,
            'last_feedback_at' => $Silian_row['last_feedback_at'] ?? null,
            'distribution' => array_map(static function (int $Silian_rating) use ($Silian_row): array {
                return [
                    'rating' => $Silian_rating,
                    'count' => (int) ($Silian_row[sprintf('rating_%d_count', $Silian_rating)] ?? 0),
                ];
            }, [5, 4, 3, 2, 1]),
        ];
    }

    private function feedbackEntriesForAssignee(int $Silian_userId, int $Silian_limit = 20): array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT
                f.id,
                f.ticket_id,
                f.user_id,
                f.rating,
                f.comment,
                f.created_at,
                f.updated_at,
                reviewer.username AS reviewer_username,
                reviewer.email AS reviewer_email,
                ticket.subject AS ticket_subject,
                ticket.status AS ticket_status,
                ticket.priority AS ticket_priority
            FROM support_ticket_feedback f
            LEFT JOIN users reviewer ON reviewer.id = f.user_id AND reviewer.deleted_at IS NULL
            INNER JOIN support_tickets ticket ON ticket.id = f.ticket_id
            WHERE f.rated_user_id = :user_id
            ORDER BY COALESCE(f.updated_at, f.created_at) DESC, f.id DESC
            LIMIT :limit
        ");
        $Silian_stmt->bindValue(':user_id', $Silian_userId, PDO::PARAM_INT);
        $Silian_stmt->bindValue(':limit', max(1, $Silian_limit), PDO::PARAM_INT);
        $Silian_stmt->execute();

        return array_map(static function (array $Silian_row): array {
            return [
                'id' => (int) ($Silian_row['id'] ?? 0),
                'ticket_id' => (int) ($Silian_row['ticket_id'] ?? 0),
                'rating' => (int) ($Silian_row['rating'] ?? 0),
                'comment' => $Silian_row['comment'] ?? null,
                'created_at' => $Silian_row['created_at'] ?? null,
                'updated_at' => $Silian_row['updated_at'] ?? null,
                'reviewer' => [
                    'id' => (int) ($Silian_row['user_id'] ?? 0),
                    'username' => $Silian_row['reviewer_username'] ?? null,
                    'email' => $Silian_row['reviewer_email'] ?? null,
                ],
                'ticket' => [
                    'id' => (int) ($Silian_row['ticket_id'] ?? 0),
                    'subject' => (string) ($Silian_row['ticket_subject'] ?? ''),
                    'status' => (string) ($Silian_row['ticket_status'] ?? ''),
                    'priority' => (string) ($Silian_row['ticket_priority'] ?? ''),
                ],
            ];
        }, $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    private function formatRule(array $Silian_row): array
    {
        $Silian_tagIds = array_map('intval', $this->decodeJsonList($Silian_row['add_tag_ids'] ?? null));
        return [
            'id' => (int) ($Silian_row['id'] ?? 0),
            'name' => (string) ($Silian_row['name'] ?? ''),
            'description' => $Silian_row['description'] ?? null,
            'is_active' => !empty($Silian_row['is_active']),
            'sort_order' => (int) ($Silian_row['sort_order'] ?? 0),
            'match_category' => $Silian_row['match_category'] ?? null,
            'match_priority' => $Silian_row['match_priority'] ?? null,
            'match_weekdays' => $this->decodeJsonList($Silian_row['match_weekdays'] ?? null),
            'match_time_start' => $Silian_row['match_time_start'] ?? null,
            'match_time_end' => $Silian_row['match_time_end'] ?? null,
            'timezone' => $Silian_row['timezone'] ?? 'Asia/Shanghai',
            'assign_to' => isset($Silian_row['assign_to']) ? (int) $Silian_row['assign_to'] : null,
            'assign_user' => !empty($Silian_row['assign_to']) ? [
                'id' => (int) $Silian_row['assign_to'],
                'username' => $Silian_row['assignee_username'] ?? null,
                'email' => $Silian_row['assignee_email'] ?? null,
            ] : null,
            'score_boost' => round((float) ($Silian_row['score_boost'] ?? 0), 2),
            'required_agent_level' => isset($Silian_row['required_agent_level']) && $Silian_row['required_agent_level'] !== null ? (int) $Silian_row['required_agent_level'] : null,
            'skill_hints' => $this->decodeJsonList($Silian_row['skill_hints_json'] ?? null),
            'tag_ids' => $Silian_tagIds,
            'tags' => $Silian_tagIds === [] ? [] : $this->loadTagsByIds($Silian_tagIds),
            'trigger_count' => (int) ($Silian_row['trigger_count'] ?? 0),
            'last_triggered_at' => $Silian_row['last_triggered_at'] ?? null,
            'created_at' => $Silian_row['created_at'] ?? null,
            'updated_at' => $Silian_row['updated_at'] ?? null,
        ];
    }

    private function loadTagsByIds(array $Silian_tagIds): array
    {
        $Silian_tagIds = array_values(array_unique(array_filter(array_map('intval', $Silian_tagIds), fn (int $Silian_id): bool => $Silian_id > 0)));
        if ($Silian_tagIds === []) {
            return [];
        }

        $Silian_stmt = $this->db->prepare('SELECT * FROM support_ticket_tags WHERE id IN (' . implode(',', array_fill(0, count($Silian_tagIds), '?')) . ') ORDER BY name ASC');
        $Silian_stmt->execute($Silian_tagIds);
        return array_map(fn (array $Silian_row): array => $this->formatTag($Silian_row), $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    private function normalizeAssignableUser(mixed $Silian_value): ?int
    {
        if ($Silian_value === null || $Silian_value === '') {
            return null;
        }
        $Silian_userId = (int) $Silian_value;
        if ($Silian_userId <= 0) {
            return null;
        }
        $Silian_stmt = $this->db->prepare("
            SELECT id
            FROM users
            WHERE id = :id
              AND deleted_at IS NULL
              AND (is_admin = 1 OR role IN ('support', 'admin'))
            LIMIT 1
        ");
        $Silian_stmt->execute(['id' => $Silian_userId]);
        if (!$Silian_stmt->fetchColumn()) {
            throw new \InvalidArgumentException('Assigned user must be support or admin');
        }
        return $Silian_userId;
    }

    private function normalizeTagIds(mixed $Silian_value): array
    {
        $Silian_ids = [];
        foreach ($this->decodeList($Silian_value) as $Silian_item) {
            $Silian_tagId = (int) $Silian_item;
            if ($Silian_tagId <= 0) {
                continue;
            }
            if ($this->findTagRow($Silian_tagId) === null) {
                throw new \InvalidArgumentException('Invalid tag id: ' . $Silian_tagId);
            }
            $Silian_ids[] = $Silian_tagId;
        }
        return array_values(array_unique($Silian_ids));
    }

    private function normalizeWeekdays(mixed $Silian_value): array
    {
        $Silian_valid = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
        $Silian_days = [];
        foreach ($this->decodeList($Silian_value) as $Silian_item) {
            $Silian_day = strtolower(trim((string) $Silian_item));
            if ($Silian_day === '') {
                continue;
            }
            if (!in_array($Silian_day, $Silian_valid, true)) {
                throw new \InvalidArgumentException('Invalid weekday: ' . $Silian_day);
            }
            $Silian_days[] = $Silian_day;
        }
        return array_values(array_unique($Silian_days));
    }

    private function normalizeTime(mixed $Silian_value): ?string
    {
        $Silian_time = $this->nullableString($Silian_value);
        if ($Silian_time === null) {
            return null;
        }
        if (!preg_match('/^(?:[01]\d|2[0-3]):[0-5]\d$/', $Silian_time)) {
            throw new \InvalidArgumentException('Invalid time value');
        }
        return $Silian_time;
    }

    private function normalizeRequiredAgentLevel(mixed $Silian_value): ?int
    {
        if ($Silian_value === null || $Silian_value === '') {
            return null;
        }
        $Silian_level = (int) $Silian_value;
        if ($Silian_level < 1 || $Silian_level > 5) {
            throw new \InvalidArgumentException('required_agent_level must be between 1 and 5');
        }
        return $Silian_level;
    }

    private function normalizeProfileStatus(mixed $Silian_value): string
    {
        $Silian_status = strtolower($this->nullableString($Silian_value) ?? 'active');
        if (!in_array($Silian_status, ['active', 'backup', 'offline'], true)) {
            throw new \InvalidArgumentException('Invalid routing profile status');
        }
        return $Silian_status;
    }

    private function normalizeTimezone(mixed $Silian_value): string
    {
        $Silian_timezone = $this->nullableString($Silian_value) ?? 'Asia/Shanghai';
        try {
            new DateTimeZone($Silian_timezone);
        } catch (\Throwable $Silian_e) {
            throw new \InvalidArgumentException('Invalid timezone');
        }
        return $Silian_timezone;
    }

    private function normalizeColor(mixed $Silian_value): string
    {
        $Silian_color = strtolower($this->nullableString($Silian_value) ?? 'emerald');
        if (!in_array($Silian_color, self::VALID_COLORS, true)) {
            throw new \InvalidArgumentException('Invalid tag color');
        }
        return $Silian_color;
    }

    private function normalizeSlug(mixed $Silian_value): string
    {
        $Silian_slug = strtolower(trim((string) $Silian_value));
        $Silian_slug = preg_replace('/[^a-z0-9]+/', '-', $Silian_slug) ?? '';
        $Silian_slug = trim($Silian_slug, '-');
        if ($Silian_slug === '') {
            throw new \InvalidArgumentException('Tag slug is required');
        }
        return substr($Silian_slug, 0, 64);
    }

    private function normalizeStringList(mixed $Silian_value): array
    {
        $Silian_items = [];
        foreach ($this->decodeList($Silian_value) as $Silian_item) {
            $Silian_normalized = trim((string) $Silian_item);
            if ($Silian_normalized === '') {
                continue;
            }
            $Silian_items[] = $Silian_normalized;
        }
        return array_values(array_unique($Silian_items));
    }

    private function normalizeJsonObject(mixed $Silian_value): array
    {
        if (is_array($Silian_value)) {
            return $Silian_value;
        }
        if (is_string($Silian_value) && trim($Silian_value) !== '') {
            $Silian_decoded = json_decode($Silian_value, true);
            if (is_array($Silian_decoded)) {
                return $Silian_decoded;
            }
        }
        return [];
    }

    private function requireString(mixed $Silian_value, string $Silian_field): string
    {
        $Silian_string = $this->nullableString($Silian_value);
        if ($Silian_string === null) {
            throw new \InvalidArgumentException(sprintf('%s is required', $Silian_field));
        }
        return $Silian_string;
    }

    private function nullableString(mixed $Silian_value): ?string
    {
        if ($Silian_value === null) {
            return null;
        }
        $Silian_string = trim((string) $Silian_value);
        return $Silian_string === '' ? null : $Silian_string;
    }

    private function decodeJsonList(?string $Silian_json): array
    {
        if (!is_string($Silian_json) || trim($Silian_json) === '') {
            return [];
        }
        $Silian_decoded = json_decode($Silian_json, true);
        return is_array($Silian_decoded) ? array_values($Silian_decoded) : [];
    }

    private function decodeJsonObject(?string $Silian_json): ?array
    {
        if (!is_string($Silian_json) || trim($Silian_json) === '') {
            return null;
        }
        $Silian_decoded = json_decode($Silian_json, true);
        return is_array($Silian_decoded) ? $Silian_decoded : null;
    }

    private function formatRoutingSettings(array $Silian_row): array
    {
        $Silian_defaults = [
            'first_response_minutes' => 240,
            'resolution_minutes' => 1440,
            'routing_weight' => 1.0,
            'min_agent_level' => 1,
            'overdue_boost' => 1.0,
            'tier_label' => 'standard',
        ];
        $Silian_weights = [
            'group_weight' => 15,
            'priority_weight' => 18,
            'severity_weight' => 24,
            'escalation_weight' => 10,
            'rule_weight' => 20,
            'skill_weight' => 16,
            'level_weight' => 10,
            'feedback_weight' => 8,
            'overdue_weight' => 18,
            'load_penalty_weight' => 22,
        ];
        $Silian_fallback = [
            'use_priority_as_severity' => true,
            'default_feedback_rating' => 3.5,
        ];

        return [
            'id' => isset($Silian_row['id']) ? (int) $Silian_row['id'] : null,
            'ai_enabled' => array_key_exists('ai_enabled', $Silian_row) ? !empty($Silian_row['ai_enabled']) : true,
            'ai_timeout_ms' => (int) ($Silian_row['ai_timeout_ms'] ?? 12000),
            'due_soon_minutes' => (int) ($Silian_row['due_soon_minutes'] ?? 30),
            'weights' => array_replace($Silian_weights, $this->decodeJsonObject($Silian_row['weights_json'] ?? null) ?? []),
            'fallback' => array_replace($Silian_fallback, $this->decodeJsonObject($Silian_row['fallback_json'] ?? null) ?? []),
            'defaults' => array_replace($Silian_defaults, $this->decodeJsonObject($Silian_row['defaults_json'] ?? null) ?? []),
            'created_at' => $Silian_row['created_at'] ?? null,
            'updated_at' => $Silian_row['updated_at'] ?? null,
        ];
    }

    private function decodeList(mixed $Silian_value): array
    {
        if (is_array($Silian_value)) {
            return array_values($Silian_value);
        }
        if (is_string($Silian_value)) {
            $Silian_decoded = json_decode($Silian_value, true);
            if (is_array($Silian_decoded)) {
                return array_values($Silian_decoded);
            }
            return array_values(array_filter(array_map('trim', explode(',', $Silian_value)), static fn (string $Silian_item): bool => $Silian_item !== ''));
        }
        return [];
    }

    private function now(): string
    {
        return date('Y-m-d H:i:s');
    }
}
