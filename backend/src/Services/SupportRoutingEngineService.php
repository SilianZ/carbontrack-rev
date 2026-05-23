<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Models\SupportTicketRoutingRun;
use CarbonTrack\Models\SupportTicketTagAssignment;
use CarbonTrack\Support\SyntheticRequestFactory;
use DateTimeImmutable;
use DateTimeZone;
use PDO;
use Psr\Log\LoggerInterface;

class SupportRoutingEngineService
{
    private ?DateTimeZone $appTimeZone = null;

    public function __construct(
        private PDO $db,
        private LoggerInterface $logger,
        private AuditLogService $auditLogService,
        private ErrorLogService $errorLogService,
        private SupportRoutingTriageService $triageService,
        private ?MessageService $messageService = null,
        private ?EmailService $emailService = null
    ) {
    }

    public function routeTicket(int $Silian_ticketId, string $Silian_trigger = 'created', array $Silian_options = []): ?array
    {
        $Silian_ticket = $this->loadTicket($Silian_ticketId);
        if ($Silian_ticket === null) {
            throw new \RuntimeException('Ticket not found');
        }

        $Silian_force = (bool) ($Silian_options['force'] ?? false);
        if (!$Silian_force && !empty($Silian_ticket['assignment_locked'])) {
            return $this->buildLockedResult($Silian_ticket, $Silian_trigger);
        }

        $Silian_settings = $this->loadRoutingSettings();
        $Silian_groupRouting = $this->resolveGroupRouting($Silian_ticket, $Silian_settings['defaults']);
        $this->ensureDeadlineFields($Silian_ticket, $Silian_groupRouting);
        $Silian_ticket = $this->loadTicket($Silian_ticketId) ?? $Silian_ticket;

        $Silian_triageResult = $this->triageService->triage($Silian_ticket, [
            'ai_enabled' => $Silian_settings['ai_enabled'],
            'group_routing' => $Silian_groupRouting,
            'message_body' => $this->loadFirstMessageBody($Silian_ticketId),
            'log_context' => [
                'request_id' => $Silian_options['request_id'] ?? null,
                'actor_type' => 'system',
                'source' => '/support/routing/engine',
            ],
        ]);

        $Silian_matchedRules = [];
        $Silian_matchedRuleIds = [];
        $Silian_tagIds = [];
        $Silian_skillHints = $Silian_triageResult['triage']['suggested_skills'] ?? [];
        $Silian_requiredLevel = max(1, (int) ($Silian_groupRouting['min_agent_level'] ?? 1), (int) ($Silian_triageResult['triage']['required_agent_level'] ?? 1));

        foreach ($this->loadActiveRules() as $Silian_rule) {
            if (!$this->ruleMatchesTicket($Silian_rule, $Silian_ticket)) {
                continue;
            }

            $Silian_matchedRules[] = $Silian_rule;
            $Silian_matchedRuleIds[] = (int) $Silian_rule['id'];
            $Silian_tagIds = array_merge($Silian_tagIds, $this->decodeJsonList($Silian_rule['add_tag_ids'] ?? null));
            $Silian_skillHints = array_merge($Silian_skillHints, $this->decodeJsonList($Silian_rule['skill_hints_json'] ?? null));
            if (($Silian_rule['required_agent_level'] ?? null) !== null) {
                $Silian_requiredLevel = max($Silian_requiredLevel, (int) $Silian_rule['required_agent_level']);
            }
        }

        $Silian_skillHints = array_values(array_unique(array_filter(array_map(static fn ($Silian_value): string => trim((string) $Silian_value), $Silian_skillHints), static fn (string $Silian_value): bool => $Silian_value !== '')));
        $Silian_scoredCandidates = [];
        foreach ($this->loadCandidateRows() as $Silian_candidate) {
            $Silian_score = $this->scoreCandidate($Silian_candidate, $Silian_ticket, $Silian_groupRouting, $Silian_settings['weights'], $Silian_triageResult['triage'], $Silian_matchedRules, $Silian_requiredLevel, $Silian_skillHints);
            if ($Silian_score !== null) {
                $Silian_scoredCandidates[] = $Silian_score;
            }
        }

        usort($Silian_scoredCandidates, function (array $Silian_left, array $Silian_right): int {
            if ($Silian_left['total_score'] === $Silian_right['total_score']) {
                if ($Silian_left['available_capacity'] === $Silian_right['available_capacity']) {
                    if ($Silian_left['avg_feedback_rating'] === $Silian_right['avg_feedback_rating']) {
                        return $Silian_left['candidate']['id'] <=> $Silian_right['candidate']['id'];
                    }
                    return $Silian_right['avg_feedback_rating'] <=> $Silian_left['avg_feedback_rating'];
                }
                return $Silian_right['available_capacity'] <=> $Silian_left['available_capacity'];
            }

            return $Silian_right['total_score'] <=> $Silian_left['total_score'];
        });

        $Silian_winner = $Silian_scoredCandidates[0] ?? null;
        $Silian_winnerId = $Silian_winner['candidate']['id'] ?? null;
        $Silian_winnerScore = $Silian_winner['total_score'] ?? null;
        $Silian_topFactors = $this->normalizeTopFactors($Silian_winner['breakdown'] ?? []);
        $Silian_summary = [
            'locked' => false,
            'used_ai' => (bool) $Silian_triageResult['used_ai'],
            'fallback_reason' => $Silian_triageResult['fallback_reason'],
            'matched_rule_ids' => $Silian_matchedRuleIds,
            'required_agent_level' => $Silian_requiredLevel,
            'suggested_skills' => $Silian_skillHints,
            'winner_score' => $Silian_winnerScore,
            'winner_label' => $Silian_winner !== null ? ($Silian_winner['candidate']['username'] ?? $Silian_winner['candidate']['email'] ?? ('User #' . (int) ($Silian_winner['candidate']['id'] ?? 0))) : null,
            'top_factors' => $Silian_topFactors,
        ];

        try {
            $this->db->beginTransaction();
            $this->applyMatchedTags($Silian_ticketId, $Silian_matchedRules, $Silian_tagIds);
            foreach ($Silian_matchedRuleIds as $Silian_ruleId) {
                $this->touchRuleMetrics($Silian_ruleId);
            }

            $Silian_run = SupportTicketRoutingRun::create([
                'ticket_id' => $Silian_ticketId,
                'trigger' => $Silian_trigger,
                'used_ai' => !empty($Silian_triageResult['used_ai']),
                'fallback_reason' => $Silian_triageResult['fallback_reason'],
                'triage_json' => $this->encodeJson($Silian_triageResult['triage']),
                'matched_rule_ids_json' => $this->encodeJson($Silian_matchedRuleIds),
                'candidate_scores_json' => $this->encodeJson(array_map(fn (array $Silian_candidate): array => [
                    'candidate' => $Silian_candidate['candidate'],
                    'candidate_id' => (int) ($Silian_candidate['candidate']['id'] ?? 0),
                    'total_score' => round((float) ($Silian_candidate['total_score'] ?? 0), 2),
                    'breakdown' => $Silian_candidate['breakdown'],
                    'available_capacity' => $Silian_candidate['available_capacity'],
                    'avg_feedback_rating' => $Silian_candidate['avg_feedback_rating'],
                ], $Silian_scoredCandidates)),
                'winner_user_id' => $Silian_winnerId !== null ? (int) $Silian_winnerId : null,
                'winner_score' => $Silian_winnerScore !== null ? round((float) $Silian_winnerScore, 2) : null,
                'summary_json' => $this->encodeJson($Silian_summary),
            ]);

            $Silian_updates = [
                'assignment_locked' => 0,
                'last_routing_run_id' => (int) $Silian_run->id,
                'updated_at' => $this->now(),
            ];
            if ($Silian_winnerId !== null) {
                $Silian_updates['assigned_to'] = (int) $Silian_winnerId;
                $Silian_updates['assignment_source'] = 'smart';
                $Silian_updates['assigned_rule_id'] = $this->resolvePrimaryRuleId($Silian_matchedRules, (int) $Silian_winnerId);
            }
            $this->updateTicket($Silian_ticketId, $Silian_updates);
            $this->db->commit();

            if ($Silian_winnerId !== null) {
                $Silian_assignedUser = $this->loadUser((int) $Silian_winnerId);
                if ($Silian_assignedUser !== null) {
                    $this->notifyAssignee(
                        $Silian_assignedUser,
                        sprintf('Ticket #%d assigned to you', $Silian_ticketId),
                        sprintf("Smart routing assigned ticket #%d.\nSubject: %s\nReason: %s", $Silian_ticketId, (string) ($Silian_ticket['subject'] ?? ''), (string) ($Silian_triageResult['triage']['summary'] ?? '')),
                        $Silian_ticketId
                    );
                }
            }

            $this->auditLogService->logSystemEvent('support_ticket_routed', 'support_routing', [
                'status' => 'success',
                'request_method' => 'SYSTEM',
                'endpoint' => '/support/routing/engine',
                'request_data' => [
                    'ticket_id' => $Silian_ticketId,
                    'trigger' => $Silian_trigger,
                    'winner_user_id' => $Silian_winnerId,
                    'matched_rule_ids' => $Silian_matchedRuleIds,
                    'fallback_reason' => $Silian_triageResult['fallback_reason'],
                ],
            ]);

            return [
                'assigned_to' => $Silian_winnerId !== null ? (int) $Silian_winnerId : null,
                'assignment_source' => $Silian_winnerId !== null ? 'smart' : null,
                'matched_rule_ids' => $Silian_matchedRuleIds,
                'routing_run_id' => (int) $Silian_run->id,
                'summary' => $Silian_summary,
            ];
        } catch (\Throwable $Silian_exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            $this->logError($Silian_exception, ['ticket_id' => $Silian_ticketId, 'trigger' => $Silian_trigger]);
            throw $Silian_exception;
        }
    }

    public function runSlaSweep(): array
    {
        $Silian_stmt = $this->db->query("
            SELECT id
            FROM support_tickets
            WHERE status IN ('open', 'in_progress', 'waiting_user')
            ORDER BY id ASC
        ");
        $Silian_ticketIds = array_map('intval', $Silian_stmt->fetchAll(PDO::FETCH_COLUMN) ?: []);
        $Silian_processed = 0;
        $Silian_breached = 0;
        $Silian_rerouted = 0;
        $Silian_now = $this->now();

        foreach ($Silian_ticketIds as $Silian_ticketId) {
            $Silian_ticket = $this->loadTicket($Silian_ticketId);
            if ($Silian_ticket === null) {
                continue;
            }

            $Silian_firstResponseBreached = empty($Silian_ticket['first_support_response_at']) && !empty($Silian_ticket['first_response_due_at']) && (string) $Silian_ticket['first_response_due_at'] < $Silian_now;
            $Silian_resolutionBreached = !empty($Silian_ticket['resolution_due_at']) && (string) $Silian_ticket['resolution_due_at'] < $Silian_now;
            if (!$Silian_firstResponseBreached && !$Silian_resolutionBreached) {
                continue;
            }

            $Silian_currentSlaStatus = strtolower((string) ($Silian_ticket['sla_status'] ?? 'pending'));
            if ($Silian_currentSlaStatus === 'escalated') {
                continue;
            }

            $Silian_processed++;
            $Silian_breached++;
            $Silian_updates = ['sla_status' => 'breached', 'updated_at' => $Silian_now];
            if (empty($Silian_ticket['assignment_locked'])) {
                if ($Silian_currentSlaStatus !== 'breached') {
                    $Silian_updates['escalation_level'] = (int) ($Silian_ticket['escalation_level'] ?? 0) + 1;
                }
                $this->updateTicket($Silian_ticketId, $Silian_updates);
                try {
                    $Silian_routeResult = $this->routeTicket($Silian_ticketId, 'sla_breach', ['force' => true]);
                    if (($Silian_routeResult['assigned_to'] ?? null) !== null) {
                        $this->updateTicket($Silian_ticketId, [
                            'sla_status' => 'escalated',
                            'updated_at' => $this->now(),
                        ]);
                        $Silian_rerouted++;
                    }
                } catch (\Throwable $Silian_exception) {
                    $this->logger->warning('Support SLA reroute failed', [
                        'ticket_id' => $Silian_ticketId,
                        'error' => $Silian_exception->getMessage(),
                    ]);
                    $this->logError($Silian_exception, [
                        'ticket_id' => $Silian_ticketId,
                        'trigger' => 'sla_breach',
                    ]);
                }
            } else {
                $this->updateTicket($Silian_ticketId, $Silian_updates);
            }
        }

        $this->auditLogService->logSystemEvent('support_ticket_sla_sweep_completed', 'support_routing', [
            'status' => 'success',
            'request_method' => 'CLI',
            'endpoint' => '/jobs/support/sla-sweep',
            'request_data' => ['processed' => $Silian_processed, 'breached' => $Silian_breached, 'rerouted' => $Silian_rerouted],
        ]);

        return ['processed' => $Silian_processed, 'breached' => $Silian_breached, 'rerouted' => $Silian_rerouted];
    }

    public function getRoutingSummaryForTicket(int $Silian_ticketId): ?array
    {
        $Silian_stmt = $this->db->prepare('
            SELECT summary_json, id
            FROM support_ticket_routing_runs
            WHERE ticket_id = :ticket_id
            ORDER BY id DESC
            LIMIT 1
        ');
        $Silian_stmt->execute(['ticket_id' => $Silian_ticketId]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        if (!$Silian_row) {
            return null;
        }

        $Silian_summary = $this->decodeJsonObject($Silian_row['summary_json'] ?? null) ?? [];
        $Silian_summary['top_factors'] = $this->normalizeTopFactors($Silian_summary['top_factors'] ?? []);
        $Silian_summary['last_run_id'] = (int) ($Silian_row['id'] ?? 0);
        return $Silian_summary;
    }

    public function buildSlaSummaryForTicket(array $Silian_ticket, ?array $Silian_routingSettings = null): array
    {
        $Silian_settings = $Silian_routingSettings ?? $this->loadRoutingSettings();
        $Silian_dueSoonMinutes = max(1, (int) ($Silian_settings['due_soon_minutes'] ?? 30));

        $Silian_firstResponse = $this->buildMilestoneSummary(
            $Silian_ticket['first_response_due_at'] ?? null,
            $Silian_ticket['first_support_response_at'] ?? null,
            (string) ($Silian_ticket['sla_status'] ?? 'pending'),
            $Silian_dueSoonMinutes
        );

        $Silian_resolvedAt = $Silian_ticket['resolved_at'] ?? $Silian_ticket['closed_at'] ?? null;
        $Silian_resolution = $this->buildMilestoneSummary(
            $Silian_ticket['resolution_due_at'] ?? null,
            $Silian_resolvedAt,
            (string) ($Silian_ticket['sla_status'] ?? 'pending'),
            $Silian_dueSoonMinutes
        );

        $Silian_activeTarget = empty($Silian_ticket['first_support_response_at']) ? 'first_response' : 'resolution';
        $Silian_activeSummary = $Silian_activeTarget === 'first_response' ? $Silian_firstResponse : $Silian_resolution;
        $Silian_displayState = $this->resolveDisplayState($Silian_ticket, $Silian_activeSummary['state'] ?? 'pending');

        return [
            'due_soon_minutes' => $Silian_dueSoonMinutes,
            'display_state' => $Silian_displayState,
            'active_target' => $Silian_activeTarget,
            'active_due_at' => $Silian_activeSummary['due_at'] ?? null,
            'active_minutes_delta' => $Silian_activeSummary['minutes_delta'] ?? null,
            'first_response' => $Silian_firstResponse,
            'resolution' => $Silian_resolution,
        ];
    }

    public function getSlaSettingsSnapshot(): array
    {
        return $this->loadRoutingSettings();
    }

    public function getRoutingRunsForTicket(int $Silian_ticketId, int $Silian_limit = 10): array
    {
        $Silian_stmt = $this->db->prepare('
            SELECT *
            FROM support_ticket_routing_runs
            WHERE ticket_id = :ticket_id
            ORDER BY id DESC
            LIMIT :limit
        ');
        $Silian_stmt->bindValue(':ticket_id', $Silian_ticketId, PDO::PARAM_INT);
        $Silian_stmt->bindValue(':limit', max(1, $Silian_limit), PDO::PARAM_INT);
        $Silian_stmt->execute();
        return array_map(function (array $Silian_row): array {
            $Silian_candidateScores = json_decode((string) ($Silian_row['candidate_scores_json'] ?? '[]'), true);
            $Silian_summary = $this->decodeJsonObject($Silian_row['summary_json'] ?? null) ?? [];
            $Silian_summary['top_factors'] = $this->normalizeTopFactors($Silian_summary['top_factors'] ?? []);
            $Silian_winnerUserId = isset($Silian_row['winner_user_id']) ? (int) $Silian_row['winner_user_id'] : null;

            return [
                'id' => (int) ($Silian_row['id'] ?? 0),
                'ticket_id' => (int) ($Silian_row['ticket_id'] ?? 0),
                'trigger' => (string) ($Silian_row['trigger'] ?? 'unknown'),
                'used_ai' => !empty($Silian_row['used_ai']),
                'fallback_reason' => $Silian_row['fallback_reason'] ?? null,
                'triage' => $this->decodeJsonObject($Silian_row['triage_json'] ?? null) ?? [],
                'matched_rule_ids' => array_map('intval', $this->decodeJsonList($Silian_row['matched_rule_ids_json'] ?? null)),
                'candidate_scores' => is_array($Silian_candidateScores) ? $Silian_candidateScores : [],
                'winner_user_id' => $Silian_winnerUserId,
                'winner_score' => isset($Silian_row['winner_score']) ? (float) $Silian_row['winner_score'] : null,
                'summary' => $Silian_summary,
                'created_at' => $Silian_row['created_at'] ?? null,
                'updated_at' => $Silian_row['updated_at'] ?? null,
            ];
        }, $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    private function buildLockedResult(array $Silian_ticket, string $Silian_trigger): array
    {
        return [
            'assigned_to' => isset($Silian_ticket['assigned_to']) ? (int) $Silian_ticket['assigned_to'] : null,
            'assignment_source' => $Silian_ticket['assignment_source'] ?? null,
            'matched_rule_ids' => [],
            'routing_run_id' => isset($Silian_ticket['last_routing_run_id']) ? (int) $Silian_ticket['last_routing_run_id'] : null,
            'summary' => [
                'locked' => true,
                'used_ai' => false,
                'fallback_reason' => 'assignment_locked',
                'matched_rule_ids' => [],
                'required_agent_level' => null,
                'suggested_skills' => [],
                'winner_score' => null,
                'top_factors' => [],
                'trigger' => $Silian_trigger,
            ],
        ];
    }

    private function loadTicket(int $Silian_ticketId): ?array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT
                t.*,
                requester.username AS requester_username,
                requester.email AS requester_email,
                requester.group_id AS requester_group_id,
                requester.quota_override AS requester_quota_override,
                requester.role AS requester_role
            FROM support_tickets t
            INNER JOIN users requester ON requester.id = t.user_id
            WHERE t.id = :id
            LIMIT 1
        ");
        $Silian_stmt->execute(['id' => $Silian_ticketId]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return $Silian_row ?: null;
    }

    private function loadFirstMessageBody(int $Silian_ticketId): string
    {
        $Silian_stmt = $this->db->prepare('
            SELECT body
            FROM support_ticket_messages
            WHERE ticket_id = :ticket_id
            ORDER BY id ASC
            LIMIT 1
        ');
        $Silian_stmt->execute(['ticket_id' => $Silian_ticketId]);
        return trim((string) ($Silian_stmt->fetchColumn() ?: ''));
    }

    private function loadRoutingSettings(): array
    {
        $Silian_stmt = $this->db->query('SELECT * FROM support_routing_settings ORDER BY id ASC LIMIT 1');
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);

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

        if (!$Silian_row) {
            return [
                'id' => null,
                'ai_enabled' => false,
                'ai_timeout_ms' => 12000,
                'due_soon_minutes' => 30,
                'weights' => $Silian_weights,
                'fallback' => $Silian_fallback,
                'defaults' => $Silian_defaults,
            ];
        }

        return [
            'id' => (int) ($Silian_row['id'] ?? 0),
            'ai_enabled' => !empty($Silian_row['ai_enabled']),
            'ai_timeout_ms' => (int) ($Silian_row['ai_timeout_ms'] ?? 12000),
            'due_soon_minutes' => (int) ($Silian_row['due_soon_minutes'] ?? 30),
            'weights' => array_replace($Silian_weights, $this->decodeJsonObject($Silian_row['weights_json'] ?? null) ?? []),
            'fallback' => array_replace($Silian_fallback, $this->decodeJsonObject($Silian_row['fallback_json'] ?? null) ?? []),
            'defaults' => array_replace($Silian_defaults, $this->decodeJsonObject($Silian_row['defaults_json'] ?? null) ?? []),
        ];
    }

    private function resolveGroupRouting(array $Silian_ticket, array $Silian_defaults): array
    {
        $Silian_groupId = isset($Silian_ticket['requester_group_id']) ? (int) $Silian_ticket['requester_group_id'] : 0;
        $Silian_groupRouting = $Silian_defaults;

        if ($Silian_groupId > 0) {
            $Silian_stmt = $this->db->prepare('SELECT config FROM user_groups WHERE id = :id LIMIT 1');
            $Silian_stmt->execute(['id' => $Silian_groupId]);
            $Silian_config = $this->decodeJsonObject($Silian_stmt->fetchColumn() ?: null) ?? [];
            $Silian_supportRouting = is_array($Silian_config['support_routing'] ?? null) ? $Silian_config['support_routing'] : [];
            $Silian_groupRouting = array_replace($Silian_groupRouting, $Silian_supportRouting);
        }

        $Silian_requesterOverride = $this->decodeJsonObject($Silian_ticket['requester_quota_override'] ?? null) ?? [];
        $Silian_supportRoutingOverride = is_array($Silian_requesterOverride['support_routing'] ?? null) ? $Silian_requesterOverride['support_routing'] : [];

        return array_replace($Silian_groupRouting, $Silian_supportRoutingOverride);
    }

    private function buildMilestoneSummary(?string $Silian_dueAt, ?string $Silian_completedAt, string $Silian_slaStatus, int $Silian_dueSoonMinutes): array
    {
        if (!$Silian_dueAt) {
            return [
                'due_at' => null,
                'completed_at' => $Silian_completedAt,
                'minutes_delta' => null,
                'state' => 'not_configured',
            ];
        }

        $Silian_timezone = $this->appTimeZone();
        $Silian_now = new DateTimeImmutable($this->now(), $Silian_timezone);
        $Silian_due = new DateTimeImmutable($Silian_dueAt, $Silian_timezone);
        $Silian_minutesDelta = (int) floor(($Silian_due->getTimestamp() - $Silian_now->getTimestamp()) / 60);

        if ($Silian_completedAt) {
            return [
                'due_at' => $Silian_dueAt,
                'completed_at' => $Silian_completedAt,
                'minutes_delta' => $Silian_minutesDelta,
                'state' => 'met',
            ];
        }

        $Silian_state = 'pending';
        if ($Silian_minutesDelta < 0) {
            $Silian_state = $Silian_slaStatus === 'escalated' ? 'escalated' : 'breached';
        } elseif ($Silian_minutesDelta <= $Silian_dueSoonMinutes) {
            $Silian_state = 'due_soon';
        }

        return [
            'due_at' => $Silian_dueAt,
            'completed_at' => null,
            'minutes_delta' => $Silian_minutesDelta,
            'state' => $Silian_state,
        ];
    }

    private function resolveDisplayState(array $Silian_ticket, string $Silian_activeState): string
    {
        if (in_array((string) ($Silian_ticket['status'] ?? ''), ['resolved', 'closed'], true) || (string) ($Silian_ticket['sla_status'] ?? '') === 'resolved') {
            return 'resolved';
        }

        return match ($Silian_activeState) {
            'escalated' => 'escalated',
            'breached' => 'breached',
            'due_soon' => 'due_soon',
            default => 'pending',
        };
    }

    private function normalizeTopFactors(mixed $Silian_value): array
    {
        if (is_array($Silian_value)) {
            $Silian_isList = array_keys($Silian_value) === range(0, count($Silian_value) - 1);
            if ($Silian_isList) {
                return array_values(array_map(
                    static fn ($Silian_item): string => trim((string) $Silian_item),
                    array_filter(
                        $Silian_value,
                        static fn ($Silian_item): bool => is_scalar($Silian_item) && trim((string) $Silian_item) !== ''
                    )
                ));
            }

            $Silian_pairs = [];
            foreach ($Silian_value as $Silian_key => $Silian_score) {
                if (!is_numeric($Silian_score)) {
                    continue;
                }
                $Silian_pairs[(string) $Silian_key] = (float) $Silian_score;
            }

            uasort($Silian_pairs, static fn (float $Silian_left, float $Silian_right): int => abs($Silian_right) <=> abs($Silian_left));

            return array_slice($Silian_pairs, 0, 4, true);
        }

        if (is_string($Silian_value) && trim($Silian_value) !== '') {
            return [trim($Silian_value)];
        }

        return [];
    }

    private function ensureDeadlineFields(array $Silian_ticket, array $Silian_groupRouting): void
    {
        if (!empty($Silian_ticket['first_response_due_at']) && !empty($Silian_ticket['resolution_due_at'])) {
            return;
        }

        $Silian_createdAt = $Silian_ticket['created_at'] ?? $this->now();
        $Silian_base = new DateTimeImmutable((string) $Silian_createdAt, $this->appTimeZone());
        $Silian_firstResponseDueAt = $Silian_base->modify('+' . max(1, (int) ($Silian_groupRouting['first_response_minutes'] ?? 240)) . ' minutes');
        $Silian_resolutionDueAt = $Silian_base->modify('+' . max(1, (int) ($Silian_groupRouting['resolution_minutes'] ?? 1440)) . ' minutes');

        $Silian_updates = ['updated_at' => $this->now()];
        if (empty($Silian_ticket['first_response_due_at'])) {
            $Silian_updates['first_response_due_at'] = $Silian_firstResponseDueAt->format('Y-m-d H:i:s');
        }
        if (empty($Silian_ticket['resolution_due_at'])) {
            $Silian_updates['resolution_due_at'] = $Silian_resolutionDueAt->format('Y-m-d H:i:s');
        }
        if (empty($Silian_ticket['sla_status'])) {
            $Silian_updates['sla_status'] = 'pending';
        }

        $this->updateTicket((int) $Silian_ticket['id'], $Silian_updates);
    }

    private function loadActiveRules(): array
    {
        $Silian_stmt = $this->db->query("
            SELECT *
            FROM support_ticket_automation_rules
            WHERE is_active = 1
            ORDER BY sort_order ASC, id ASC
        ");
        return $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    private function loadCandidateRows(): array
    {
        $Silian_stmt = $this->db->query("
            SELECT
                u.id,
                u.username,
                u.email,
                u.role,
                u.is_admin,
                u.status AS user_status,
                COALESCE(p.level, 1) AS level,
                COALESCE(p.skills_json, '[]') AS skills_json,
                COALESCE(p.languages_json, '[]') AS languages_json,
                COALESCE(p.max_active_tickets, 10) AS max_active_tickets,
                COALESCE(p.is_auto_assignable, 1) AS is_auto_assignable,
                p.weight_overrides_json,
                COALESCE(p.status, 'active') AS profile_status,
                COALESCE(active.active_count, 0) AS active_count,
                COALESCE(feedback.avg_rating, 3.5) AS avg_feedback_rating,
                COALESCE(feedback.rating_count, 0) AS rating_count
            FROM users u
            LEFT JOIN support_assignee_profiles p ON p.user_id = u.id
            LEFT JOIN (
                SELECT assigned_to, COUNT(*) AS active_count
                FROM support_tickets
                WHERE status IN ('open', 'in_progress', 'waiting_user')
                  AND assigned_to IS NOT NULL
                GROUP BY assigned_to
            ) active ON active.assigned_to = u.id
            LEFT JOIN (
                SELECT
                    rated_user_id,
                    AVG(rating) AS avg_rating,
                    COUNT(*) AS rating_count
                FROM (
                    SELECT rated_user_id, rating
                    FROM support_ticket_feedback
                    ORDER BY id DESC
                    LIMIT 500
                ) recent
                GROUP BY rated_user_id
            ) feedback ON feedback.rated_user_id = u.id
            WHERE u.deleted_at IS NULL
              AND (u.is_admin = 1 OR u.role IN ('support', 'admin'))
            ORDER BY u.id ASC
        ");

        return $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
    }

    private function scoreCandidate(
        array $Silian_candidate,
        array $Silian_ticket,
        array $Silian_groupRouting,
        array $Silian_weights,
        array $Silian_triage,
        array $Silian_matchedRules,
        int $Silian_requiredLevel,
        array $Silian_skillHints
    ): ?array {
        $Silian_userStatus = strtolower((string) ($Silian_candidate['user_status'] ?? ''));
        $Silian_profileStatus = strtolower((string) ($Silian_candidate['profile_status'] ?? ''));
        if ($Silian_userStatus !== 'active' || $Silian_profileStatus !== 'active' || empty($Silian_candidate['is_auto_assignable'])) {
            return null;
        }

        $Silian_candidateLevel = max(1, (int) ($Silian_candidate['level'] ?? 1));
        if ($Silian_candidateLevel < $Silian_requiredLevel) {
            return null;
        }

        $Silian_maxActiveTickets = max(1, (int) ($Silian_candidate['max_active_tickets'] ?? 10));
        $Silian_activeCount = max(0, (int) ($Silian_candidate['active_count'] ?? 0));
        $Silian_loadRatio = $Silian_activeCount / $Silian_maxActiveTickets;
        if ($Silian_loadRatio >= 1.0) {
            return null;
        }

        $Silian_priorityValue = [
            'low' => 0.25,
            'normal' => 0.5,
            'high' => 0.75,
            'urgent' => 1.0,
        ][strtolower((string) ($Silian_ticket['priority'] ?? 'normal'))] ?? 0.5;
        $Silian_severityValue = [
            'low' => 0.25,
            'medium' => 0.5,
            'high' => 0.75,
            'critical' => 1.0,
        ][strtolower((string) ($Silian_triage['severity'] ?? 'medium'))] ?? 0.5;
        $Silian_riskValue = [
            'low' => 0.2,
            'medium' => 0.6,
            'high' => 1.0,
        ][strtolower((string) ($Silian_triage['escalation_risk'] ?? 'medium'))] ?? 0.6;

        $Silian_groupScore = ((float) ($Silian_groupRouting['routing_weight'] ?? 1.0)) * (float) ($Silian_weights['group_weight'] ?? 15);
        $Silian_priorityScore = $Silian_priorityValue * (float) ($Silian_weights['priority_weight'] ?? 18);
        $Silian_severityScore = $Silian_severityValue * (float) ($Silian_weights['severity_weight'] ?? 24);
        $Silian_escalationScore = ($Silian_riskValue + ((int) ($Silian_ticket['escalation_level'] ?? 0) * 0.25)) * (float) ($Silian_weights['escalation_weight'] ?? 10);

        $Silian_ruleBoost = 0.0;
        $Silian_assigneeOverride = 0.0;
        foreach ($Silian_matchedRules as $Silian_rule) {
            $Silian_boost = (float) ($Silian_rule['score_boost'] ?? 0);
            $Silian_ruleBoost += $Silian_boost;
            if (!empty($Silian_rule['assign_to']) && (int) $Silian_rule['assign_to'] === (int) $Silian_candidate['id']) {
                $Silian_assigneeOverride += $Silian_boost;
            }
        }
        $Silian_ruleScore = $Silian_ruleBoost * ((float) ($Silian_weights['rule_weight'] ?? 20) / 20.0);

        $Silian_candidateSkills = array_values(array_unique(array_filter(array_map(static fn ($Silian_value): string => strtolower(trim((string) $Silian_value)), $this->decodeJsonList($Silian_candidate['skills_json'] ?? null)), static fn (string $Silian_value): bool => $Silian_value !== '')));
        $Silian_normalizedSkillHints = array_values(array_unique(array_filter(array_map(static fn ($Silian_value): string => strtolower(trim((string) $Silian_value)), $Silian_skillHints), static fn (string $Silian_value): bool => $Silian_value !== '')));
        $Silian_skillMatches = array_intersect($Silian_candidateSkills, $Silian_normalizedSkillHints);
        $Silian_skillRatio = $Silian_normalizedSkillHints === [] ? 0.5 : (count($Silian_skillMatches) / count($Silian_normalizedSkillHints));
        $Silian_skillScore = $Silian_skillRatio * (float) ($Silian_weights['skill_weight'] ?? 16);

        $Silian_levelRatio = min(1.0, $Silian_candidateLevel / max(1, $Silian_requiredLevel));
        $Silian_levelScore = $Silian_levelRatio * (float) ($Silian_weights['level_weight'] ?? 10);

        $Silian_avgFeedback = max(1.0, min(5.0, (float) ($Silian_candidate['avg_feedback_rating'] ?? 3.5)));
        $Silian_feedbackScore = (($Silian_avgFeedback - 1.0) / 4.0) * (float) ($Silian_weights['feedback_weight'] ?? 8);
        $Silian_overdueScore = $this->ticketOverdueMultiplier($Silian_ticket, $Silian_groupRouting) * (float) ($Silian_weights['overdue_weight'] ?? 18);
        $Silian_loadPenalty = $Silian_loadRatio * (float) ($Silian_weights['load_penalty_weight'] ?? 22);
        $Silian_weightOverrides = $this->decodeJsonObject($Silian_candidate['weight_overrides_json'] ?? null) ?? [];
        $Silian_assigneeOverride += (float) ($Silian_weightOverrides['flat_boost'] ?? 0);

        $Silian_total = $Silian_groupScore
            + $Silian_priorityScore
            + $Silian_severityScore
            + $Silian_escalationScore
            + $Silian_ruleScore
            + $Silian_skillScore
            + $Silian_levelScore
            + $Silian_feedbackScore
            + $Silian_overdueScore
            - $Silian_loadPenalty
            + $Silian_assigneeOverride;

        return [
            'candidate' => [
                'id' => (int) ($Silian_candidate['id'] ?? 0),
                'username' => $Silian_candidate['username'] ?? null,
                'email' => $Silian_candidate['email'] ?? null,
            ],
            'total_score' => round($Silian_total, 2),
            'breakdown' => [
                'group' => round($Silian_groupScore, 2),
                'priority' => round($Silian_priorityScore, 2),
                'severity' => round($Silian_severityScore, 2),
                'escalation' => round($Silian_escalationScore, 2),
                'rule' => round($Silian_ruleScore, 2),
                'skill' => round($Silian_skillScore, 2),
                'level' => round($Silian_levelScore, 2),
                'feedback' => round($Silian_feedbackScore, 2),
                'overdue' => round($Silian_overdueScore, 2),
                'load_penalty' => round($Silian_loadPenalty, 2),
                'assignee_override' => round($Silian_assigneeOverride, 2),
            ],
            'available_capacity' => $Silian_maxActiveTickets - $Silian_activeCount,
            'avg_feedback_rating' => round($Silian_avgFeedback, 2),
        ];
    }

    private function ticketOverdueMultiplier(array $Silian_ticket, array $Silian_groupRouting): float
    {
        $Silian_now = $this->now();
        $Silian_boost = max(0.0, (float) ($Silian_groupRouting['overdue_boost'] ?? 1.0));
        $Silian_firstResponseOverdue = empty($Silian_ticket['first_support_response_at']) && !empty($Silian_ticket['first_response_due_at']) && (string) $Silian_ticket['first_response_due_at'] < $Silian_now;
        $Silian_resolutionOverdue = !empty($Silian_ticket['resolution_due_at']) && (string) $Silian_ticket['resolution_due_at'] < $Silian_now;

        if ($Silian_firstResponseOverdue || $Silian_resolutionOverdue) {
            return max(1.0, $Silian_boost);
        }

        return 0.0;
    }

    private function applyMatchedTags(int $Silian_ticketId, array $Silian_matchedRules, array $Silian_tagIds): void
    {
        $Silian_tagIds = array_values(array_unique(array_filter(array_map('intval', $Silian_tagIds), static fn (int $Silian_id): bool => $Silian_id > 0)));
        if ($Silian_tagIds === []) {
            return;
        }

        $Silian_existing = [];
        $Silian_stmt = $this->db->prepare('SELECT tag_id FROM support_ticket_tag_assignments WHERE ticket_id = :ticket_id');
        $Silian_stmt->execute(['ticket_id' => $Silian_ticketId]);
        foreach ($Silian_stmt->fetchAll(PDO::FETCH_COLUMN) ?: [] as $Silian_tagId) {
            $Silian_existing[(int) $Silian_tagId] = true;
        }

        foreach ($Silian_matchedRules as $Silian_rule) {
            foreach (array_map('intval', $this->decodeJsonList($Silian_rule['add_tag_ids'] ?? null)) as $Silian_tagId) {
                if ($Silian_tagId <= 0 || isset($Silian_existing[$Silian_tagId])) {
                    continue;
                }

                SupportTicketTagAssignment::create([
                    'ticket_id' => $Silian_ticketId,
                    'tag_id' => $Silian_tagId,
                    'source_type' => 'rule',
                    'rule_id' => (int) $Silian_rule['id'],
                    'created_at' => $this->now(),
                ]);
                $Silian_existing[$Silian_tagId] = true;
            }
        }
    }

    private function touchRuleMetrics(int $Silian_ruleId): void
    {
        $Silian_stmt = $this->db->prepare("
            UPDATE support_ticket_automation_rules
            SET trigger_count = trigger_count + 1,
                last_triggered_at = :timestamp,
                updated_at = :timestamp
            WHERE id = :id
        ");
        $Silian_stmt->execute([
            'timestamp' => $this->now(),
            'id' => $Silian_ruleId,
        ]);
    }

    private function ruleMatchesTicket(array $Silian_rule, array $Silian_ticket): bool
    {
        if (!empty($Silian_rule['match_category']) && (string) $Silian_rule['match_category'] !== (string) ($Silian_ticket['category'] ?? '')) {
            return false;
        }
        if (!empty($Silian_rule['match_priority']) && (string) $Silian_rule['match_priority'] !== (string) ($Silian_ticket['priority'] ?? '')) {
            return false;
        }

        $Silian_timezone = (string) ($Silian_rule['timezone'] ?? $this->appTimeZoneName());
        try {
            $Silian_now = new DateTimeImmutable('now', new DateTimeZone($Silian_timezone));
        } catch (\Throwable) {
            $Silian_now = new DateTimeImmutable('now', $this->appTimeZone());
        }

        $Silian_weekdays = $this->decodeJsonList($Silian_rule['match_weekdays'] ?? null);
        if ($Silian_weekdays !== []) {
            $Silian_currentWeekday = strtolower(substr($Silian_now->format('D'), 0, 3));
            if (!in_array($Silian_currentWeekday, $Silian_weekdays, true)) {
                return false;
            }
        }

        $Silian_start = $Silian_rule['match_time_start'] ?? null;
        $Silian_end = $Silian_rule['match_time_end'] ?? null;
        if (($Silian_start || $Silian_end) && !$this->timeWindowMatches($Silian_now->format('H:i'), is_string($Silian_start) ? $Silian_start : null, is_string($Silian_end) ? $Silian_end : null)) {
            return false;
        }

        return true;
    }

    private function timeWindowMatches(string $Silian_current, ?string $Silian_start, ?string $Silian_end): bool
    {
        if ($Silian_start === null || $Silian_end === null) {
            return true;
        }
        if ($Silian_start <= $Silian_end) {
            return $Silian_current >= $Silian_start && $Silian_current <= $Silian_end;
        }
        return $Silian_current >= $Silian_start || $Silian_current <= $Silian_end;
    }

    private function resolvePrimaryRuleId(array $Silian_matchedRules, int $Silian_winnerUserId): ?int
    {
        $Silian_bestRuleId = null;
        $Silian_bestScore = -INF;
        foreach ($Silian_matchedRules as $Silian_rule) {
            $Silian_score = (float) ($Silian_rule['score_boost'] ?? 0);
            if (!empty($Silian_rule['assign_to']) && (int) $Silian_rule['assign_to'] === $Silian_winnerUserId) {
                $Silian_score += 1000;
            }
            if ($Silian_score > $Silian_bestScore) {
                $Silian_bestScore = $Silian_score;
                $Silian_bestRuleId = (int) $Silian_rule['id'];
            }
        }
        return $Silian_bestRuleId;
    }

    private const TICKET_UPDATE_ALLOWED_FIELDS = [
        'assigned_to',
        'assignment_source',
        'assigned_rule_id',
        'assignment_locked',
        'first_support_response_at',
        'first_response_due_at',
        'resolution_due_at',
        'sla_status',
        'escalation_level',
        'last_routing_run_id',
        'updated_at',
    ];

    private function updateTicket(int $Silian_ticketId, array $Silian_fields): void
    {
        $Silian_assignments = [];
        $Silian_params = ['id' => $Silian_ticketId];
        foreach ($Silian_fields as $Silian_field => $Silian_value) {
            if (!in_array($Silian_field, self::TICKET_UPDATE_ALLOWED_FIELDS, true)) {
                $this->logger->warning('SupportRoutingEngineService::updateTicket rejected disallowed field', [
                    'field' => $Silian_field,
                    'ticket_id' => $Silian_ticketId,
                ]);
                continue;
            }
            $Silian_assignments[] = sprintf('%s = :%s', $Silian_field, $Silian_field);
            $Silian_params[$Silian_field] = $Silian_value;
        }
        if ($Silian_assignments === []) {
            return;
        }
        $Silian_stmt = $this->db->prepare('UPDATE support_tickets SET ' . implode(', ', $Silian_assignments) . ' WHERE id = :id');
        $Silian_stmt->execute($Silian_params);
    }

    private function loadUser(int $Silian_userId): ?array
    {
        $Silian_stmt = $this->db->prepare('SELECT id, username, email FROM users WHERE id = :id LIMIT 1');
        $Silian_stmt->execute(['id' => $Silian_userId]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return $Silian_row ?: null;
    }

    private function notifyAssignee(array $Silian_user, string $Silian_subject, string $Silian_body, int $Silian_ticketId): void
    {
        $Silian_userId = (int) ($Silian_user['id'] ?? 0);
        $Silian_messageSent = false;
        $Silian_emailSent = false;

        try {
            if ($this->messageService !== null && $Silian_userId > 0) {
                $this->messageService->sendSystemMessage(
                    $Silian_userId,
                    $Silian_subject,
                    $Silian_body,
                    'support_ticket',
                    'normal',
                    'support_ticket',
                    $Silian_ticketId,
                    false
                );
                $Silian_messageSent = true;
            }
        } catch (\Throwable $Silian_exception) {
            $this->logger->warning('Failed to send smart assignment system notification', [
                'ticket_id' => $Silian_ticketId,
                'user_id' => $Silian_userId,
                'error' => $Silian_exception->getMessage(),
            ]);
            $this->recordNotificationFailure($Silian_exception, 'support_routing_system_notification_failed', [
                'ticket_id' => $Silian_ticketId,
                'user_id' => $Silian_userId,
                'subject' => $Silian_subject,
            ]);
        }

        try {
            if ($this->emailService !== null && !empty($Silian_user['email'])) {
                $this->emailService->sendMessageNotification(
                    (string) $Silian_user['email'],
                    (string) ($Silian_user['username'] ?? $Silian_user['email']),
                    $Silian_subject,
                    $Silian_body,
                    NotificationPreferenceService::CATEGORY_SUPPORT,
                    'normal'
                );
                $Silian_emailSent = true;
            }
        } catch (\Throwable $Silian_exception) {
            $this->logger->warning('Failed to send smart assignment email notification', [
                'ticket_id' => $Silian_ticketId,
                'user_id' => $Silian_userId,
                'error' => $Silian_exception->getMessage(),
            ]);
            $this->recordNotificationFailure($Silian_exception, 'support_routing_email_notification_failed', [
                'ticket_id' => $Silian_ticketId,
                'user_id' => $Silian_userId,
                'subject' => $Silian_subject,
            ]);
        }

        $this->auditLogService->log([
            'user_id' => $Silian_userId > 0 ? $Silian_userId : null,
            'action' => 'support_routing_assignee_notified',
            'operation_category' => 'support',
            'actor_type' => 'system',
            'affected_table' => 'support_tickets',
            'affected_id' => $Silian_ticketId,
            'status' => $Silian_messageSent && $Silian_emailSent
                ? 'success'
                : (($Silian_messageSent || $Silian_emailSent) ? 'partial' : 'failed'),
            'data' => [
                'subject' => $Silian_subject,
                'message_sent' => $Silian_messageSent,
                'email_sent' => $Silian_emailSent,
            ],
        ]);
    }

    private function recordNotificationFailure(\Throwable $Silian_exception, string $Silian_action, array $Silian_context): void
    {
        $this->auditLogService->log([
            'user_id' => isset($Silian_context['user_id']) ? (int) $Silian_context['user_id'] : null,
            'action' => $Silian_action,
            'operation_category' => 'support',
            'actor_type' => 'system',
            'affected_table' => 'support_tickets',
            'affected_id' => isset($Silian_context['ticket_id']) ? (int) $Silian_context['ticket_id'] : null,
            'status' => 'failed',
            'data' => $Silian_context + ['error' => $Silian_exception->getMessage()],
        ]);

        $this->logError($Silian_exception, $Silian_context);
    }

    private function decodeJsonList(?string $Silian_json): array
    {
        if ($Silian_json === null || trim($Silian_json) === '') {
            return [];
        }
        $Silian_decoded = json_decode($Silian_json, true);
        return is_array($Silian_decoded) ? array_values($Silian_decoded) : [];
    }

    private function decodeJsonObject(?string $Silian_json): ?array
    {
        if ($Silian_json === null || trim($Silian_json) === '') {
            return null;
        }
        $Silian_decoded = json_decode($Silian_json, true);
        return is_array($Silian_decoded) ? $Silian_decoded : null;
    }

    private function encodeJson(array $Silian_value): string
    {
        return (string) json_encode($Silian_value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function now(): string
    {
        return (new DateTimeImmutable('now', $this->appTimeZone()))->format('Y-m-d H:i:s');
    }

    private function appTimeZoneName(): string
    {
        $Silian_configured = trim((string) ($_ENV['APP_TIMEZONE'] ?? getenv('APP_TIMEZONE') ?: ''));
        return $Silian_configured !== '' ? $Silian_configured : 'Asia/Shanghai';
    }

    private function appTimeZone(): DateTimeZone
    {
        if ($this->appTimeZone !== null) {
            return $this->appTimeZone;
        }

        try {
            $this->appTimeZone = new DateTimeZone($this->appTimeZoneName());
        } catch (\Throwable) {
            $this->appTimeZone = new DateTimeZone('Asia/Shanghai');
        }

        return $this->appTimeZone;
    }

    private function logError(\Throwable $Silian_exception, array $Silian_context = []): void
    {
        try {
            $Silian_request = SyntheticRequestFactory::fromContext(
                '/support/routing/engine',
                'SYSTEM',
                null,
                [],
                $Silian_context,
                ['PHP_SAPI' => PHP_SAPI]
            );
            $this->errorLogService->logException($Silian_exception, $Silian_request, $Silian_context);
        } catch (\Throwable) {
            // ignore
        }
    }
}
