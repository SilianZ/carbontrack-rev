<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Models\SupportTicket;
use CarbonTrack\Models\SupportTicketAttachment;
use CarbonTrack\Models\SupportTicketFeedback;
use CarbonTrack\Models\SupportTicketMessage;
use PDO;
use Psr\Log\LoggerInterface;

class SupportTicketService
{
    public const STATUS_OPEN = 'open';
    public const STATUS_IN_PROGRESS = 'in_progress';
    public const STATUS_WAITING_USER = 'waiting_user';
    public const STATUS_RESOLVED = 'resolved';
    public const STATUS_CLOSED = 'closed';

    public const TRANSFER_STATUS_PENDING = 'pending';
    public const TRANSFER_STATUS_APPROVED = 'approved';
    public const TRANSFER_STATUS_REJECTED = 'rejected';
    public const TRANSFER_STATUS_CANCELLED = 'cancelled';

    private const VALID_CATEGORIES = ['website_bug', 'business_issue', 'feature_request', 'account', 'other'];
    private const VALID_STATUSES = [
        self::STATUS_OPEN,
        self::STATUS_IN_PROGRESS,
        self::STATUS_WAITING_USER,
        self::STATUS_RESOLVED,
        self::STATUS_CLOSED,
    ];
    private const VALID_PRIORITIES = ['low', 'normal', 'high', 'urgent'];
    private const VALID_TRANSFER_STATUSES = [
        self::TRANSFER_STATUS_PENDING,
        self::TRANSFER_STATUS_APPROVED,
        self::TRANSFER_STATUS_REJECTED,
        self::TRANSFER_STATUS_CANCELLED,
    ];
    private const FEEDBACK_ALLOWED_STATUSES = [
        self::STATUS_RESOLVED,
        self::STATUS_CLOSED,
    ];

    public function __construct(
        private PDO $db,
        private LoggerInterface $logger,
        private AuditLogService $auditLogService,
        private ErrorLogService $errorLogService,
        private FileMetadataService $fileMetadataService,
        private ?EmailService $emailService = null,
        private ?MessageService $messageService = null,
        private ?CloudflareR2Service $r2Service = null,
        private ?SupportAutomationService $supportAutomationService = null,
        private ?SupportRoutingEngineService $supportRoutingEngineService = null
    ) {
    }

    public function createTicket(array $Silian_actor, array $Silian_payload): array
    {
        $Silian_subject = $this->requireString($Silian_payload['subject'] ?? null, 'subject');
        $Silian_body = $this->requireString($Silian_payload['content'] ?? null, 'content');
        $Silian_category = $this->normalizeCategory($Silian_payload['category'] ?? null);
        $Silian_priority = $this->normalizePriority($Silian_payload['priority'] ?? null);
        $Silian_attachments = $this->normalizeAttachments($Silian_payload['attachments'] ?? []);
        $Silian_now = $this->now();

        try {
            $this->db->beginTransaction();

            $Silian_ticket = SupportTicket::create([
                'user_id' => (int) $Silian_actor['id'],
                'subject' => $Silian_subject,
                'category' => $Silian_category,
                'status' => self::STATUS_OPEN,
                'priority' => $Silian_priority,
                'last_replied_at' => $Silian_now,
                'last_reply_by_role' => 'user',
            ]);

            $Silian_message = SupportTicketMessage::create([
                'ticket_id' => (int) $Silian_ticket->id,
                'sender_id' => (int) $Silian_actor['id'],
                'sender_role' => 'user',
                'sender_name' => $this->actorName($Silian_actor),
                'body' => $Silian_body,
            ]);

            $this->attachFiles((int) $Silian_ticket->id, (int) $Silian_message->id, $Silian_attachments, (int) $Silian_actor['id'], false);
            $this->db->commit();

            $this->auditLogService->log([
                'user_id' => (int) $Silian_actor['id'],
                'action' => 'support_ticket_created',
                'operation_category' => 'support',
                'actor_type' => 'user',
                'affected_table' => 'support_tickets',
                'affected_id' => (int) $Silian_ticket->id,
                'status' => 'success',
                'new_data' => ['category' => $Silian_category, 'priority' => $Silian_priority, 'attachment_count' => count($Silian_attachments)],
            ]);

            if ($this->supportRoutingEngineService !== null) {
                try {
                    $this->supportRoutingEngineService->routeTicket((int) $Silian_ticket->id, 'created');
                } catch (\Throwable $Silian_routingException) {
                    $this->logger->warning('Support ticket routing failed after ticket creation', [
                        'ticket_id' => (int) $Silian_ticket->id,
                        'error' => $Silian_routingException->getMessage(),
                    ]);
                    $this->recordFailure($Silian_routingException, 'support_ticket_routing_failed', $Silian_actor, (int) $Silian_ticket->id);
                }
            }

            $Silian_detail = $this->getTicketDetailForUser((int) $Silian_actor['id'], (int) $Silian_ticket->id);
            $this->notifySupportMailbox(
                sprintf('New support ticket #%d: %s', (int) $Silian_ticket->id, $Silian_subject),
                $this->supportMailboxBody($Silian_actor, $Silian_detail, $Silian_body),
                $this->buildSupportMailboxEmailPayload(
                    $Silian_actor,
                    $Silian_detail,
                    (int) ($Silian_ticket->id ?? 0),
                    'A new support ticket was created and is ready for triage.',
                    'Original message',
                    $Silian_body
                )
            );
            return $Silian_detail;
        } catch (\Throwable $Silian_e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            $this->recordFailure($Silian_e, 'support_ticket_create_failed', $Silian_actor, null);
            throw $Silian_e;
        }
    }

    public function listUserTickets(int $Silian_userId, array $Silian_query = []): array
    {
        $Silian_result = $this->listTickets(false, ['user_id' => $Silian_userId], $Silian_query);
        $this->auditLogService->log([
            'user_id' => $Silian_userId,
            'action' => 'support_ticket_list_viewed',
            'operation_category' => 'support',
            'actor_type' => 'user',
            'affected_table' => 'support_tickets',
            'status' => 'success',
            'data' => $Silian_result['pagination'],
        ]);
        return $Silian_result;
    }

    public function getTicketDetailForUser(int $Silian_userId, int $Silian_ticketId): array
    {
        $Silian_ticket = $this->findTicketForUser($Silian_userId, $Silian_ticketId);
        if ($Silian_ticket === null) {
            throw new \RuntimeException('Ticket not found');
        }
        $Silian_detail = $this->formatTicketDetail($Silian_ticket, false);
        $this->auditLogService->log([
            'user_id' => $Silian_userId,
            'action' => 'support_ticket_detail_viewed',
            'operation_category' => 'support',
            'actor_type' => 'user',
            'affected_table' => 'support_tickets',
            'affected_id' => $Silian_ticketId,
            'status' => 'success',
        ]);
        return $Silian_detail;
    }

    public function addUserMessage(array $Silian_actor, int $Silian_ticketId, array $Silian_payload): array
    {
        $Silian_ticket = $this->findTicketForUser((int) $Silian_actor['id'], $Silian_ticketId);
        if ($Silian_ticket === null) {
            throw new \RuntimeException('Ticket not found');
        }
        if (($Silian_ticket['status'] ?? '') === self::STATUS_CLOSED) {
            throw new \RuntimeException('Closed tickets cannot receive new replies');
        }

        $Silian_body = $this->requireString($Silian_payload['content'] ?? null, 'content');
        $Silian_attachments = $this->normalizeAttachments($Silian_payload['attachments'] ?? []);
        $Silian_now = $this->now();

        try {
            $this->db->beginTransaction();
            $Silian_message = SupportTicketMessage::create([
                'ticket_id' => $Silian_ticketId,
                'sender_id' => (int) $Silian_actor['id'],
                'sender_role' => 'user',
                'sender_name' => $this->actorName($Silian_actor),
                'body' => $Silian_body,
            ]);
            $this->attachFiles($Silian_ticketId, (int) $Silian_message->id, $Silian_attachments, (int) $Silian_actor['id'], false);
            $Silian_nextStatus = in_array((string) $Silian_ticket['status'], [self::STATUS_WAITING_USER, self::STATUS_RESOLVED], true)
                ? self::STATUS_OPEN
                : (string) $Silian_ticket['status'];
            $Silian_updates = [
                'status' => $Silian_nextStatus,
                'last_replied_at' => $Silian_now,
                'last_reply_by_role' => 'user',
                'updated_at' => $Silian_now,
            ];
            $Silian_reopenedResolvedTicket = $Silian_nextStatus === self::STATUS_OPEN && (
                (string) ($Silian_ticket['status'] ?? '') === self::STATUS_RESOLVED
                || (string) ($Silian_ticket['sla_status'] ?? '') === 'resolved'
                || !empty($Silian_ticket['resolved_at'])
                || !empty($Silian_ticket['closed_at'])
            );
            if ($Silian_reopenedResolvedTicket) {
                $Silian_updates['resolved_at'] = null;
                $Silian_updates['closed_at'] = null;
                $Silian_updates['sla_status'] = 'pending';
            }
            $this->updateTicket($Silian_ticketId, $Silian_updates);
            $this->db->commit();

            $this->auditLogService->log([
                'user_id' => (int) $Silian_actor['id'],
                'action' => 'support_ticket_reply_created',
                'operation_category' => 'support',
                'actor_type' => 'user',
                'affected_table' => 'support_ticket_messages',
                'affected_id' => (int) $Silian_message->id,
                'status' => 'success',
                'data' => ['ticket_id' => $Silian_ticketId, 'attachment_count' => count($Silian_attachments)],
            ]);

            $Silian_detail = $this->getTicketDetailForUser((int) $Silian_actor['id'], $Silian_ticketId);
            $this->notifySupportMailbox(
                sprintf('User replied on support ticket #%d: %s', $Silian_ticketId, $Silian_ticket['subject'] ?? ''),
                $this->supportMailboxBody($Silian_actor, $Silian_detail, $Silian_body),
                $this->buildSupportMailboxEmailPayload(
                    $Silian_actor,
                    $Silian_detail,
                    $Silian_ticketId,
                    'The requester added a new reply to an existing support ticket.',
                    'Latest reply',
                    $Silian_body
                )
            );
            return $Silian_detail;
        } catch (\Throwable $Silian_e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            $this->recordFailure($Silian_e, 'support_ticket_reply_create_failed', $Silian_actor, $Silian_ticketId);
            throw $Silian_e;
        }
    }

    public function submitTicketFeedback(array $Silian_actor, int $Silian_ticketId, array $Silian_payload): array
    {
        $Silian_ticket = $this->findTicketForUser((int) $Silian_actor['id'], $Silian_ticketId);
        if ($Silian_ticket === null) {
            throw new \RuntimeException('Ticket not found');
        }
        if (!in_array((string) ($Silian_ticket['status'] ?? ''), self::FEEDBACK_ALLOWED_STATUSES, true)) {
            throw new \RuntimeException('Feedback is only available after the ticket is resolved or closed');
        }

        $Silian_ratedUserId = (int) ($Silian_payload['rated_user_id'] ?? 0);
        if ($Silian_ratedUserId <= 0) {
            throw new \InvalidArgumentException('rated_user_id is required');
        }

        $Silian_candidate = $this->findFeedbackCandidate($Silian_ticketId, $Silian_ratedUserId);
        if ($Silian_candidate === null) {
            throw new \InvalidArgumentException('Rated user is not eligible for feedback on this ticket');
        }

        $Silian_rating = $this->normalizeRating($Silian_payload['rating'] ?? null);
        $Silian_comment = $this->normalizeFeedbackComment($Silian_payload['comment'] ?? null);
        $Silian_feedback = $this->findFeedbackRecord($Silian_ticketId, (int) $Silian_actor['id'], $Silian_ratedUserId);
        $Silian_isNew = $Silian_feedback === null;
        $Silian_now = $this->now();

        if ($Silian_feedback === null) {
            $Silian_feedback = SupportTicketFeedback::create([
                'ticket_id' => $Silian_ticketId,
                'user_id' => (int) $Silian_actor['id'],
                'rated_user_id' => $Silian_ratedUserId,
                'rating' => $Silian_rating,
                'comment' => $Silian_comment,
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ]);
        } else {
            $Silian_feedback->fill([
                'rating' => $Silian_rating,
                'comment' => $Silian_comment,
                'updated_at' => $Silian_now,
            ]);
            $Silian_feedback->save();
        }

        $this->auditLogService->log([
            'user_id' => (int) $Silian_actor['id'],
            'action' => $Silian_isNew ? 'support_ticket_feedback_created' : 'support_ticket_feedback_updated',
            'operation_category' => 'support',
            'actor_type' => 'user',
            'affected_table' => 'support_ticket_feedback',
            'affected_id' => (int) ($Silian_feedback->id ?? 0),
            'status' => 'success',
            'data' => [
                'ticket_id' => $Silian_ticketId,
                'rated_user_id' => $Silian_ratedUserId,
                'rating' => $Silian_rating,
            ],
        ]);

        return $this->getTicketDetailForUser((int) $Silian_actor['id'], $Silian_ticketId);
    }

    public function listSupportTickets(array $Silian_actor, array $Silian_query = []): array
    {
        $Silian_pendingTransferTargetView = $this->isPendingTransferTargetQuery($Silian_actor, $Silian_query);
        $Silian_result = $this->listTickets(true, $this->supportTicketBaseFilters($Silian_actor, $Silian_query), $this->supportTicketQuery($Silian_actor, $Silian_query));

        if ($Silian_pendingTransferTargetView && !empty($Silian_result['items'])) {
            $Silian_pendingTransferMap = $this->pendingTransferRequestsForTarget(
                array_map(static fn (array $Silian_item): int => (int) ($Silian_item['id'] ?? 0), $Silian_result['items']),
                (int) ($Silian_actor['id'] ?? 0)
            );
            $Silian_result['items'] = array_map(static function (array $Silian_item) use ($Silian_pendingTransferMap): array {
                $Silian_item['pending_transfer_request'] = $Silian_pendingTransferMap[(int) ($Silian_item['id'] ?? 0)] ?? null;
                return $Silian_item;
            }, $Silian_result['items']);
        }

        $this->auditLogService->log([
            'user_id' => (int) ($Silian_actor['id'] ?? 0),
            'action' => 'support_ticket_queue_viewed',
            'operation_category' => 'support',
            'actor_type' => $this->actorType($Silian_actor),
            'affected_table' => 'support_tickets',
            'status' => 'success',
            'data' => $Silian_result['pagination'],
        ]);
        return $Silian_result;
    }

    public function listSupportAssignees(array $Silian_actor): array
    {
        $Silian_items = $this->supportAutomationService?->listAssignableUsers() ?? [];
        $this->auditLogService->log([
            'user_id' => (int) ($Silian_actor['id'] ?? 0),
            'action' => 'support_assignee_list_viewed',
            'operation_category' => 'support',
            'actor_type' => $this->actorType($Silian_actor),
            'affected_table' => 'users',
            'status' => 'success',
            'data' => ['count' => count($Silian_items)],
        ]);
        return $Silian_items;
    }

    public function getTicketDetailForSupport(array $Silian_actor, int $Silian_ticketId): array
    {
        $Silian_ticket = $this->findTicketForSupport($Silian_actor, $Silian_ticketId, true);
        if ($Silian_ticket === null) {
            throw new \RuntimeException('Ticket not found');
        }
        $Silian_detail = $this->formatTicketDetail($Silian_ticket, true);
        $this->auditLogService->log([
            'user_id' => (int) ($Silian_actor['id'] ?? 0),
            'action' => 'support_ticket_detail_viewed',
            'operation_category' => 'support',
            'actor_type' => $this->actorType($Silian_actor),
            'affected_table' => 'support_tickets',
            'affected_id' => $Silian_ticketId,
            'status' => 'success',
        ]);
        return $Silian_detail;
    }

    public function addSupportMessage(array $Silian_actor, int $Silian_ticketId, array $Silian_payload): array
    {
        $Silian_ticket = $this->findTicketForSupport($Silian_actor, $Silian_ticketId);
        if ($Silian_ticket === null) {
            throw new \RuntimeException('Ticket not found');
        }

        $Silian_body = $this->requireString($Silian_payload['content'] ?? null, 'content');
        $Silian_attachments = $this->normalizeAttachments($Silian_payload['attachments'] ?? []);
        $Silian_senderRole = !empty($Silian_actor['is_admin']) ? 'admin' : 'support';
        $Silian_now = $this->now();

        try {
            $this->db->beginTransaction();
            $Silian_message = SupportTicketMessage::create([
                'ticket_id' => $Silian_ticketId,
                'sender_id' => (int) $Silian_actor['id'],
                'sender_role' => $Silian_senderRole,
                'sender_name' => $this->actorName($Silian_actor),
                'body' => $Silian_body,
            ]);
            $this->attachFiles($Silian_ticketId, (int) $Silian_message->id, $Silian_attachments, (int) $Silian_actor['id'], true);
            $Silian_targetStatus = self::STATUS_WAITING_USER;
            if (array_key_exists('status', $Silian_payload) && $Silian_payload['status'] !== null && $Silian_payload['status'] !== '') {
                $Silian_targetStatus = $this->normalizeStatus($Silian_payload['status']);
            }

            $Silian_updates = [
                'status' => $Silian_targetStatus,
                'last_replied_at' => $Silian_now,
                'last_reply_by_role' => $Silian_senderRole,
                'updated_at' => $Silian_now,
            ];
            $Silian_reopenedTicket = in_array((string) ($Silian_ticket['status'] ?? ''), [self::STATUS_RESOLVED, self::STATUS_CLOSED], true)
                || (string) ($Silian_ticket['sla_status'] ?? 'pending') === 'resolved'
                || !empty($Silian_ticket['resolved_at'])
                || !empty($Silian_ticket['closed_at']);
            if ($Silian_targetStatus === self::STATUS_RESOLVED) {
                $Silian_updates['resolved_at'] = $Silian_now;
                $Silian_updates['closed_at'] = null;
                $Silian_updates['sla_status'] = 'resolved';
            } elseif ($Silian_targetStatus === self::STATUS_CLOSED) {
                $Silian_updates['closed_at'] = $Silian_now;
                $Silian_updates['sla_status'] = 'resolved';
            } elseif ($Silian_reopenedTicket) {
                $Silian_updates['resolved_at'] = null;
                $Silian_updates['closed_at'] = null;
            }
            if (empty($Silian_ticket['first_support_response_at'])) {
                $Silian_updates['first_support_response_at'] = $Silian_now;
            }
            if ($Silian_reopenedTicket && !in_array($Silian_targetStatus, [self::STATUS_RESOLVED, self::STATUS_CLOSED], true)) {
                $Silian_updates['sla_status'] = 'pending';
            }
            $this->updateTicket($Silian_ticketId, $Silian_updates);
            $this->db->commit();

            $this->auditLogService->log([
                'user_id' => (int) ($Silian_actor['id'] ?? 0),
                'action' => 'support_ticket_support_reply_created',
                'operation_category' => 'support',
                'actor_type' => $this->actorType($Silian_actor),
                'affected_table' => 'support_ticket_messages',
                'affected_id' => (int) $Silian_message->id,
                'status' => 'success',
                'data' => ['ticket_id' => $Silian_ticketId, 'attachment_count' => count($Silian_attachments)],
            ]);

            $Silian_emailTicket = $this->applyTicketUpdatesToSnapshot($Silian_ticket, $Silian_updates);
            $this->notifyUserReply($Silian_emailTicket, $Silian_body, $Silian_ticketId);
            return $this->getTicketDetailForSupport($Silian_actor, $Silian_ticketId);
        } catch (\Throwable $Silian_e) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            $this->recordFailure($Silian_e, 'support_ticket_support_reply_failed', $Silian_actor, $Silian_ticketId);
            throw $Silian_e;
        }
    }

    public function updateTicketFromSupport(array $Silian_actor, int $Silian_ticketId, array $Silian_payload): array
    {
        $Silian_ticket = $this->findTicketForSupport($Silian_actor, $Silian_ticketId);
        if ($Silian_ticket === null) {
            throw new \RuntimeException('Ticket not found');
        }

        $Silian_updates = [];
        $Silian_now = $this->now();
        $Silian_assigneeToNotify = null;
        if (array_key_exists('status', $Silian_payload) && $Silian_payload['status'] !== null && $Silian_payload['status'] !== '') {
            $Silian_status = $this->normalizeStatus($Silian_payload['status']);
            $Silian_updates['status'] = $Silian_status;
            if ($Silian_status === self::STATUS_RESOLVED) {
                $Silian_updates['resolved_at'] = $Silian_now;
                $Silian_updates['sla_status'] = 'resolved';
            }
            if ($Silian_status === self::STATUS_CLOSED) {
                $Silian_updates['closed_at'] = $Silian_now;
                $Silian_updates['sla_status'] = 'resolved';
            }
            if (in_array($Silian_status, [self::STATUS_OPEN, self::STATUS_IN_PROGRESS, self::STATUS_WAITING_USER], true) && ($Silian_ticket['sla_status'] ?? null) === 'resolved') {
                $Silian_updates['sla_status'] = 'pending';
                $Silian_updates['resolved_at'] = null;
                $Silian_updates['closed_at'] = null;
            }
        }
        if (array_key_exists('priority', $Silian_payload) && $Silian_payload['priority'] !== null && $Silian_payload['priority'] !== '') {
            $Silian_updates['priority'] = $this->normalizePriority($Silian_payload['priority']);
        }
        if (array_key_exists('assigned_to', $Silian_payload)) {
            if (empty($Silian_actor['is_admin'])) {
                throw new \DomainException('Only administrators can manually assign or transfer tickets');
            }
            $Silian_assigned = $Silian_payload['assigned_to'];
            if ($Silian_assigned === null || $Silian_assigned === '' || (int) $Silian_assigned <= 0) {
                $Silian_updates['assigned_to'] = null;
                $Silian_updates['assignment_source'] = null;
                $Silian_updates['assigned_rule_id'] = null;
                $Silian_updates['assignment_locked'] = 0;
            } else {
                $Silian_assignee = $this->findAssignableUser((int) $Silian_assigned);
                if ($Silian_assignee === null) {
                    throw new \InvalidArgumentException('Assigned user must be support or admin');
                }
                $Silian_updates['assigned_to'] = (int) $Silian_assignee['id'];
                $Silian_updates['assignment_source'] = 'manual';
                $Silian_updates['assigned_rule_id'] = null;
                $Silian_updates['assignment_locked'] = 1;
                $Silian_assigneeToNotify = $this->loadUserById((int) $Silian_assignee['id']);
            }
        }
        if ($Silian_updates === []) {
            return $this->getTicketDetailForSupport($Silian_actor, $Silian_ticketId);
        }
        $Silian_updates['updated_at'] = $Silian_now;
        $this->updateTicket($Silian_ticketId, $Silian_updates);
        $Silian_updatedTicket = $this->applyTicketUpdatesToSnapshot($Silian_ticket, $Silian_updates, $Silian_assigneeToNotify);
        $this->auditLogService->log([
            'user_id' => (int) ($Silian_actor['id'] ?? 0),
            'action' => 'support_ticket_updated',
            'operation_category' => 'support',
            'actor_type' => $this->actorType($Silian_actor),
            'affected_table' => 'support_tickets',
            'affected_id' => $Silian_ticketId,
            'status' => 'success',
            'old_data' => $Silian_ticket,
            'new_data' => $Silian_updates,
        ]);
        $this->notifyUserTicketUpdated($Silian_ticket, $Silian_updates, $Silian_ticketId, $Silian_updatedTicket);
        if ($Silian_assigneeToNotify !== null) {
            $this->notifyAssignee(
                $Silian_assigneeToNotify,
                sprintf('Ticket #%d assigned to you', $Silian_ticketId),
                sprintf("An administrator assigned ticket #%d to you.\nSubject: %s", $Silian_ticketId, (string) ($Silian_ticket['subject'] ?? '')),
                $Silian_ticketId,
                'support_ticket_manual_assignment_notified',
                [
                    'eyebrow' => 'Assignment update',
                    'intro' => 'An administrator assigned a support ticket to you.',
                    'summary' => 'Review the ticket context and continue the conversation from the support workbench.',
                    'ticket' => [
                        'id' => $Silian_ticketId,
                        'subject' => (string) ($Silian_ticket['subject'] ?? ''),
                    ],
                    'details' => $this->buildTicketEmailDetails($Silian_updatedTicket, [
                        [
                            'label' => 'Requester',
                            'value' => $this->formatRequesterDisplay([
                                'username' => $Silian_ticket['requester_username'] ?? null,
                                'email' => $Silian_ticket['requester_email'] ?? null,
                            ]),
                        ],
                    ]),
                    'message' => [
                        'label' => 'Assignment note',
                        'body' => sprintf("An administrator assigned ticket #%d to you.\nSubject: %s", $Silian_ticketId, (string) ($Silian_ticket['subject'] ?? '')),
                    ],
                    'button_label' => 'Open support ticket',
                    'button_path' => $this->ticketEmailPath($Silian_ticketId, true),
                    'closing' => 'Open the support queue in CarbonTrack to review the full thread and next steps.',
                ]
            );
        }
        return $this->getTicketDetailForSupport($Silian_actor, $Silian_ticketId);
    }

    public function createTransferRequest(array $Silian_actor, int $Silian_ticketId, array $Silian_payload): array
    {
        if ($this->isAdminActor($Silian_actor)) {
            throw new \DomainException('Administrators can manually transfer tickets without creating a request');
        }

        $Silian_actorId = (int) ($Silian_actor['id'] ?? 0);
        if ($Silian_actorId <= 0) {
            throw new \DomainException('Only the current assignee can request a transfer');
        }

        $Silian_targetId = (int) ($Silian_payload['to_assignee'] ?? 0);
        $Silian_assignee = $this->findAssignableUser($Silian_targetId);
        if ($Silian_assignee === null || (int) ($Silian_assignee['id'] ?? 0) === $Silian_actorId) {
            throw new \InvalidArgumentException('Transfer target must be another support or admin user');
        }

        $Silian_reason = $this->nullableString($Silian_payload['reason'] ?? null);
        $Silian_now = $this->now();
        $Silian_requestId = null;

        try {
            $this->db->beginTransaction();

            $Silian_ticket = $this->findTicket($Silian_ticketId, '', [], true);
            if ($Silian_ticket === null) {
                throw new \RuntimeException('Ticket not found');
            }
            if ((int) ($Silian_ticket['assigned_to'] ?? 0) !== $Silian_actorId) {
                throw new \DomainException('Only the current assignee can request a transfer');
            }

            $Silian_existingPending = $this->findPendingTransferRequestForTicket($Silian_ticketId);
            if ($Silian_existingPending !== null) {
                throw new \InvalidArgumentException('A pending transfer request already exists for this ticket');
            }

            $Silian_stmt = $this->db->prepare("
                INSERT INTO support_ticket_transfer_requests (
                    ticket_id, requested_by, from_assignee, to_assignee, reason, status, created_at, updated_at
                ) VALUES (
                    :ticket_id, :requested_by, :from_assignee, :to_assignee, :reason, :status, :created_at, :updated_at
                )
            ");
            $Silian_stmt->execute([
                'ticket_id' => $Silian_ticketId,
                'requested_by' => $Silian_actorId,
                'from_assignee' => $Silian_actorId,
                'to_assignee' => (int) $Silian_assignee['id'],
                'reason' => $Silian_reason,
                'status' => self::TRANSFER_STATUS_PENDING,
                'created_at' => $Silian_now,
                'updated_at' => $Silian_now,
            ]);
            $Silian_requestId = (int) $this->db->lastInsertId();
            $this->db->commit();
        } catch (\Throwable $Silian_exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $Silian_exception;
        }

        $Silian_formatted = $Silian_requestId > 0 ? $this->findTransferRequest($Silian_requestId) : null;
        $this->auditLogService->log([
            'user_id' => $Silian_actorId,
            'action' => 'support_ticket_transfer_requested',
            'operation_category' => 'support',
            'actor_type' => $this->actorType($Silian_actor),
            'affected_table' => 'support_ticket_transfer_requests',
            'affected_id' => $Silian_requestId,
            'status' => 'success',
            'data' => [
                'ticket_id' => $Silian_ticketId,
                'from_assignee' => $Silian_actorId,
                'to_assignee' => (int) $Silian_assignee['id'],
            ],
        ]);

        $Silian_targetUser = $this->loadUserById((int) $Silian_assignee['id']);
        if ($Silian_targetUser !== null) {
            $this->notifyAssignee(
                $Silian_targetUser,
                sprintf('Transfer request for ticket #%d', $Silian_ticketId),
                sprintf(
                    "A transfer request is waiting for your review.\nTicket #%d\nFrom: %s\nReason: %s",
                    $Silian_ticketId,
                    $this->actorName($Silian_actor),
                    $Silian_reason ?? 'No reason provided'
                ),
                $Silian_ticketId,
                'support_ticket_transfer_target_notified',
                [
                    'eyebrow' => 'Transfer request',
                    'intro' => 'A teammate requested to transfer a support ticket to you for review.',
                    'summary' => 'Review the reason below and decide whether to accept ownership.',
                    'ticket' => [
                        'id' => $Silian_ticketId,
                        'subject' => (string) ($Silian_ticket['subject'] ?? ''),
                    ],
                    'details' => $this->buildTicketEmailDetails($Silian_ticket, [
                        ['label' => 'From', 'value' => $this->actorName($Silian_actor)],
                    ]),
                    'message' => [
                        'label' => 'Transfer reason',
                        'body' => $Silian_reason ?? 'No reason provided',
                    ],
                    'button_label' => 'Review transfer',
                    'button_path' => $this->ticketEmailPath($Silian_ticketId, true),
                    'closing' => 'Review the request in CarbonTrack to accept, reject, or follow up with the current owner.',
                ]
            );
        }

        return $Silian_formatted ?? [];
    }

    public function reviewTransferRequest(array $Silian_actor, int $Silian_requestId, array $Silian_payload): array
    {
        $Silian_decision = $this->normalizeTransferStatus($Silian_payload['status'] ?? null);
        if (!in_array($Silian_decision, [self::TRANSFER_STATUS_APPROVED, self::TRANSFER_STATUS_REJECTED, self::TRANSFER_STATUS_CANCELLED], true)) {
            throw new \InvalidArgumentException('Transfer review must approve, reject, or cancel the request');
        }

        $Silian_actorId = (int) ($Silian_actor['id'] ?? 0);
        $Silian_reviewNote = $this->nullableString($Silian_payload['review_note'] ?? null);
        $Silian_now = $this->now();
        $Silian_requestRow = null;
        $Silian_updatedRequest = null;
        $Silian_ticketBeforeTransfer = null;

        try {
            $this->db->beginTransaction();

            $Silian_requestRow = $this->findTransferRequest($Silian_requestId, true);
            if ($Silian_requestRow === null) {
                throw new \RuntimeException('Transfer request not found');
            }
            if (($Silian_requestRow['status'] ?? '') !== self::TRANSFER_STATUS_PENDING) {
                throw new \InvalidArgumentException('Transfer request is no longer pending');
            }

            $Silian_isRequester = $Silian_actorId > 0 && $Silian_actorId === (int) ($Silian_requestRow['requested_by'] ?? 0);
            $Silian_isTarget = $Silian_actorId > 0 && $Silian_actorId === (int) ($Silian_requestRow['to_assignee'] ?? 0);
            if ($Silian_decision === self::TRANSFER_STATUS_CANCELLED && !$Silian_isRequester) {
                throw new \DomainException('Only the transfer requester can cancel this request');
            }
            if (in_array($Silian_decision, [self::TRANSFER_STATUS_APPROVED, self::TRANSFER_STATUS_REJECTED], true) && !$Silian_isTarget) {
                throw new \DomainException('Only the transfer target can approve or reject this request');
            }

            if ($Silian_decision === self::TRANSFER_STATUS_APPROVED) {
                $Silian_ticket = $this->findTicket((int) $Silian_requestRow['ticket_id'], '', [], true);
                if ($Silian_ticket === null) {
                    throw new \RuntimeException('Ticket not found');
                }
                $Silian_ticketBeforeTransfer = $Silian_ticket;
                $Silian_currentAssigneeId = isset($Silian_ticket['assigned_to']) ? (int) $Silian_ticket['assigned_to'] : 0;
                $Silian_expectedAssigneeId = isset($Silian_requestRow['from_assignee']) ? (int) $Silian_requestRow['from_assignee'] : 0;
                if ($Silian_currentAssigneeId !== $Silian_expectedAssigneeId) {
                    throw new \InvalidArgumentException('Transfer request is stale because the ticket assignee has changed');
                }
            }

            $Silian_updateStmt = $this->db->prepare("
                UPDATE support_ticket_transfer_requests
                SET status = :status,
                    review_note = :review_note,
                    reviewed_by = :reviewed_by,
                    reviewed_at = :reviewed_at,
                    updated_at = :updated_at
                WHERE id = :id
                  AND status = :expected_status
            ");
            $Silian_updateStmt->execute([
                'status' => $Silian_decision,
                'review_note' => $Silian_reviewNote,
                'reviewed_by' => $Silian_actorId,
                'reviewed_at' => $Silian_now,
                'updated_at' => $Silian_now,
                'id' => $Silian_requestId,
                'expected_status' => self::TRANSFER_STATUS_PENDING,
            ]);
            if ($Silian_updateStmt->rowCount() !== 1) {
                throw new \InvalidArgumentException('Transfer request is no longer pending');
            }

            if ($Silian_decision === self::TRANSFER_STATUS_APPROVED) {
                $this->updateTicket((int) $Silian_requestRow['ticket_id'], [
                    'assigned_to' => (int) $Silian_requestRow['to_assignee'],
                    'assignment_source' => 'manual',
                    'assigned_rule_id' => null,
                    'assignment_locked' => 0,
                    'updated_at' => $Silian_now,
                ]);
            }

            $this->db->commit();
            $Silian_updatedRequest = $this->findTransferRequest($Silian_requestId);
        } catch (\Throwable $Silian_exception) {
            if ($this->db->inTransaction()) {
                $this->db->rollBack();
            }
            throw $Silian_exception;
        }

        $this->auditLogService->log([
            'user_id' => (int) ($Silian_actor['id'] ?? 0),
            'action' => 'support_ticket_transfer_reviewed',
            'operation_category' => 'support',
            'actor_type' => $this->actorType($Silian_actor),
            'affected_table' => 'support_ticket_transfer_requests',
            'affected_id' => $Silian_requestId,
            'status' => 'success',
            'old_data' => $Silian_requestRow,
            'new_data' => $Silian_updatedRequest,
        ]);

        if (
            $Silian_decision === self::TRANSFER_STATUS_APPROVED
            && $Silian_requestRow !== null
            && $Silian_ticketBeforeTransfer !== null
        ) {
            $this->notifyUserTicketUpdated(
                $Silian_ticketBeforeTransfer,
                ['assigned_to' => (int) ($Silian_requestRow['to_assignee'] ?? 0)],
                (int) ($Silian_requestRow['ticket_id'] ?? 0)
            );
        }

        return $Silian_updatedRequest ?? [];
    }

    private function listTickets(bool $Silian_includeRequester, array $Silian_baseFilters, array $Silian_query): array
    {
        $Silian_page = max(1, (int) ($Silian_query['page'] ?? 1));
        $Silian_limit = min($Silian_includeRequester ? 100 : 50, max(1, (int) ($Silian_query['limit'] ?? ($Silian_includeRequester ? 20 : 10))));
        $Silian_offset = ($Silian_page - 1) * $Silian_limit;

        $Silian_where = ['1 = 1'];
        $Silian_params = [];
        if (isset($Silian_baseFilters['user_id'])) {
            $Silian_where[] = 't.user_id = :user_id';
            $Silian_params['user_id'] = (int) $Silian_baseFilters['user_id'];
        }
        if (array_key_exists('assigned_to', $Silian_baseFilters)) {
            $Silian_assignedTo = $Silian_baseFilters['assigned_to'];
            if ($Silian_assignedTo === null) {
                $Silian_where[] = 't.assigned_to IS NULL';
            } else {
                $Silian_where[] = 't.assigned_to = :base_assigned_to';
                $Silian_params['base_assigned_to'] = (int) $Silian_assignedTo;
            }
        }
        if (array_key_exists('transfer_target', $Silian_baseFilters)) {
            $Silian_where[] = 'EXISTS (
                SELECT 1
                FROM support_ticket_transfer_requests tr
                WHERE tr.ticket_id = t.id
                  AND tr.to_assignee = :transfer_target
                  AND tr.status = :transfer_status
            )';
            $Silian_params['transfer_target'] = (int) $Silian_baseFilters['transfer_target'];
            $Silian_params['transfer_status'] = self::TRANSFER_STATUS_PENDING;
        }
        if (!empty($Silian_query['status'])) {
            $Silian_where[] = 't.status = :status';
            $Silian_params['status'] = $this->normalizeStatus($Silian_query['status']);
        }
        if (!empty($Silian_query['category'])) {
            $Silian_where[] = 't.category = :category';
            $Silian_params['category'] = $this->normalizeCategory($Silian_query['category']);
        }
        if ($Silian_includeRequester && isset($Silian_query['assigned_to']) && $Silian_query['assigned_to'] !== '') {
            $Silian_assignedTo = (int) $Silian_query['assigned_to'];
            if ($Silian_assignedTo <= 0) {
                $Silian_where[] = 't.assigned_to IS NULL';
            } else {
                $Silian_where[] = 't.assigned_to = :assigned_to';
                $Silian_params['assigned_to'] = $Silian_assignedTo;
            }
        }
        if ($Silian_includeRequester && !empty($Silian_query['q'])) {
            $Silian_where[] = '(t.subject LIKE :search_subject OR requester.username LIKE :search_username OR requester.email LIKE :search_email)';
            $Silian_term = trim((string) $Silian_query['q']);
            $Silian_escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $Silian_term);
            $Silian_searchPattern = '%' . $Silian_escaped . '%';
            $Silian_params['search_subject'] = $Silian_searchPattern;
            $Silian_params['search_username'] = $Silian_searchPattern;
            $Silian_params['search_email'] = $Silian_searchPattern;
        }

        $Silian_sql = "
            SELECT
                t.*,
                requester.username AS requester_username,
                requester.email AS requester_email,
                requester.uuid AS requester_uuid,
                assignee.username AS assigned_username,
                (
                    SELECT COUNT(*) FROM support_ticket_messages stm WHERE stm.ticket_id = t.id
                ) AS message_count,
                (
                    SELECT substr(stm.body, 1, 180)
                    FROM support_ticket_messages stm
                    WHERE stm.ticket_id = t.id
                    ORDER BY stm.id DESC
                    LIMIT 1
                ) AS latest_message_preview
            FROM support_tickets t
            INNER JOIN users requester ON requester.id = t.user_id
            LEFT JOIN users assignee ON assignee.id = t.assigned_to
            WHERE " . implode(' AND ', $Silian_where) . "
            ORDER BY COALESCE(t.last_replied_at, t.updated_at, t.created_at) DESC, t.id DESC
            LIMIT {$Silian_limit} OFFSET {$Silian_offset}
        ";
        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute($Silian_params);
        $Silian_slaSettings = $this->supportRoutingEngineService?->getSlaSettingsSnapshot();
        $Silian_items = array_map(
            fn (array $Silian_row): array => $this->formatTicketSummary($Silian_row, $Silian_includeRequester, $Silian_slaSettings),
            $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: []
        );
        if ($Silian_includeRequester && $Silian_items !== [] && $this->supportAutomationService !== null) {
            $Silian_tagsByTicket = $this->supportAutomationService->getTagsForTicketIds(array_map(static fn (array $Silian_item): int => (int) $Silian_item['id'], $Silian_items));
            $Silian_items = array_map(static function (array $Silian_item) use ($Silian_tagsByTicket): array {
                $Silian_item['tags'] = array_values($Silian_tagsByTicket[(int) $Silian_item['id']] ?? []);
                return $Silian_item;
            }, $Silian_items);
        }
        if ($Silian_includeRequester && $Silian_items !== [] && $this->supportRoutingEngineService !== null) {
            $Silian_items = array_map(function (array $Silian_item): array {
                $Silian_item['routing_summary'] = $this->supportRoutingEngineService?->getRoutingSummaryForTicket((int) $Silian_item['id']);
                return $Silian_item;
            }, $Silian_items);
        }
        $Silian_countStmt = $this->db->prepare("
            SELECT COUNT(*)
            FROM support_tickets t
            INNER JOIN users requester ON requester.id = t.user_id
            WHERE " . implode(' AND ', $Silian_where)
        );
        $Silian_countStmt->execute($Silian_params);
        return [
            'items' => $Silian_items,
            'pagination' => ['page' => $Silian_page, 'limit' => $Silian_limit, 'total' => (int) $Silian_countStmt->fetchColumn()],
        ];
    }

    private function findTicketForUser(int $Silian_userId, int $Silian_ticketId): ?array
    {
        return $this->findTicket($Silian_ticketId, 'AND t.user_id = :user_id', ['user_id' => $Silian_userId]);
    }

    private function findTicketForSupport(array $Silian_actor, int $Silian_ticketId, bool $Silian_allowPendingTransferTarget = false): ?array
    {
        if ($this->isAdminActor($Silian_actor)) {
            return $this->findTicket($Silian_ticketId);
        }

        $Silian_actorId = (int) ($Silian_actor['id'] ?? 0);
        if ($Silian_actorId <= 0) {
            return null;
        }

        $Silian_assignedTicket = $this->findTicket($Silian_ticketId, 'AND t.assigned_to = :assigned_to', ['assigned_to' => $Silian_actorId]);
        if ($Silian_assignedTicket !== null || !$Silian_allowPendingTransferTarget) {
            return $Silian_assignedTicket;
        }

        return $this->findTicket(
            $Silian_ticketId,
            'AND EXISTS (
                SELECT 1
                FROM support_ticket_transfer_requests tr
                WHERE tr.ticket_id = t.id
                  AND tr.to_assignee = :transfer_target
                  AND tr.status = :transfer_status
            )',
            [
                'transfer_target' => $Silian_actorId,
                'transfer_status' => self::TRANSFER_STATUS_PENDING,
            ]
        );
    }

    private function findTicket(int $Silian_ticketId, string $Silian_extraWhere = '', array $Silian_params = [], bool $Silian_forUpdate = false): ?array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT
                t.*,
                requester.username AS requester_username,
                requester.email AS requester_email,
                requester.uuid AS requester_uuid,
                assignee.username AS assigned_username
            FROM support_tickets t
            INNER JOIN users requester ON requester.id = t.user_id
            LEFT JOIN users assignee ON assignee.id = t.assigned_to
            WHERE t.id = :ticket_id {$Silian_extraWhere}
            LIMIT 1
            {$this->selectForUpdateClause($Silian_forUpdate)}
        ");
        $Silian_stmt->execute(['ticket_id' => $Silian_ticketId] + $Silian_params);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return $Silian_row ?: null;
    }

    private function formatTicketSummary(array $Silian_row, bool $Silian_includeRequester, ?array $Silian_slaSettings = null): array
    {
        $Silian_summary = [
            'id' => (int) $Silian_row['id'],
            'subject' => (string) $Silian_row['subject'],
            'category' => (string) $Silian_row['category'],
            'status' => (string) $Silian_row['status'],
            'priority' => (string) $Silian_row['priority'],
            'assigned_to' => isset($Silian_row['assigned_to']) ? (int) $Silian_row['assigned_to'] : null,
            'assignment_source' => $Silian_row['assignment_source'] ?? null,
            'assigned_rule_id' => isset($Silian_row['assigned_rule_id']) && $Silian_row['assigned_rule_id'] !== null ? (int) $Silian_row['assigned_rule_id'] : null,
            'assignment_locked' => !empty($Silian_row['assignment_locked']),
            'assigned_user' => $Silian_row['assigned_to'] ? ['id' => (int) $Silian_row['assigned_to'], 'username' => $Silian_row['assigned_username'] ?? null] : null,
            'last_replied_at' => $Silian_row['last_replied_at'] ?? null,
            'last_reply_by_role' => $Silian_row['last_reply_by_role'] ?? null,
            'first_support_response_at' => $Silian_row['first_support_response_at'] ?? null,
            'first_response_due_at' => $Silian_row['first_response_due_at'] ?? null,
            'resolution_due_at' => $Silian_row['resolution_due_at'] ?? null,
            'sla_status' => $Silian_row['sla_status'] ?? 'pending',
            'escalation_level' => (int) ($Silian_row['escalation_level'] ?? 0),
            'last_routing_run_id' => isset($Silian_row['last_routing_run_id']) && $Silian_row['last_routing_run_id'] !== null ? (int) $Silian_row['last_routing_run_id'] : null,
            'created_at' => $Silian_row['created_at'] ?? null,
            'updated_at' => $Silian_row['updated_at'] ?? null,
            'resolved_at' => $Silian_row['resolved_at'] ?? null,
            'closed_at' => $Silian_row['closed_at'] ?? null,
            'message_count' => (int) ($Silian_row['message_count'] ?? 0),
            'latest_message_preview' => $Silian_row['latest_message_preview'] ?? null,
        ];
        if ($this->supportRoutingEngineService !== null) {
            $Silian_summary['sla_summary'] = $this->supportRoutingEngineService->buildSlaSummaryForTicket($Silian_row, $Silian_slaSettings);
        }
        if ($Silian_includeRequester) {
            $Silian_summary['requester'] = [
                'id' => (int) ($Silian_row['user_id'] ?? 0),
                'username' => $Silian_row['requester_username'] ?? null,
                'email' => $Silian_row['requester_email'] ?? null,
                'uuid' => $Silian_row['requester_uuid'] ?? null,
            ];
        }
        return $Silian_summary;
    }

    private function formatTicketDetail(array $Silian_ticket, bool $Silian_includeRequester): array
    {
        $Silian_detail = $this->formatTicketSummary(
            $Silian_ticket,
            $Silian_includeRequester,
            $this->supportRoutingEngineService?->getSlaSettingsSnapshot()
        );
        $Silian_detail['messages'] = $this->messages((int) $Silian_ticket['id']);
        $Silian_detail['feedback_candidates'] = $this->feedbackCandidates((int) $Silian_ticket['id']);
        $Silian_detail['feedback'] = $this->feedback((int) $Silian_ticket['id']);
        if ($Silian_includeRequester && $this->supportAutomationService !== null) {
            $Silian_detail['tags'] = $this->supportAutomationService->getTagsForTicket((int) $Silian_ticket['id']);
        }
        if ($Silian_includeRequester) {
            $Silian_detail['transfer_requests'] = $this->transferRequests((int) $Silian_ticket['id']);
            $Silian_detail['routing_summary'] = $this->supportRoutingEngineService?->getRoutingSummaryForTicket((int) $Silian_ticket['id']);
        }
        return $Silian_detail;
    }

    private function messages(int $Silian_ticketId): array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT
                stm.*,
                avatar.file_path AS sender_avatar_path
            FROM support_ticket_messages stm
            LEFT JOIN users sender ON sender.id = stm.sender_id
            LEFT JOIN avatars avatar ON avatar.id = sender.avatar_id
            WHERE stm.ticket_id = :ticket_id
            ORDER BY stm.id ASC
        ");
        $Silian_stmt->execute(['ticket_id' => $Silian_ticketId]);
        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $Silian_attachments = $this->attachments(array_map(static fn (array $Silian_row): int => (int) $Silian_row['id'], $Silian_rows));
        return array_map(function (array $Silian_row) use ($Silian_attachments): array {
            $Silian_messageId = (int) $Silian_row['id'];
            $Silian_avatar = $this->resolveAvatar($Silian_row['sender_avatar_path'] ?? null);
            return [
                'id' => $Silian_messageId,
                'ticket_id' => (int) $Silian_row['ticket_id'],
                'sender_id' => isset($Silian_row['sender_id']) ? (int) $Silian_row['sender_id'] : null,
                'sender_role' => $Silian_row['sender_role'] ?? null,
                'sender_name' => $Silian_row['sender_name'] ?? null,
                'avatar_path' => $Silian_avatar['avatar_path'],
                'avatar_url' => $Silian_avatar['avatar_url'],
                'body' => $Silian_row['body'] ?? '',
                'created_at' => $Silian_row['created_at'] ?? null,
                'updated_at' => $Silian_row['updated_at'] ?? null,
                'attachments' => $Silian_attachments[$Silian_messageId] ?? [],
            ];
        }, $Silian_rows);
    }

    private function feedbackCandidates(int $Silian_ticketId): array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT DISTINCT
                u.id,
                u.username,
                u.email,
                u.role,
                u.is_admin
            FROM users u
            INNER JOIN (
                SELECT sender_id AS participant_id
                FROM support_ticket_messages
                WHERE ticket_id = :message_ticket_id
                  AND sender_id IS NOT NULL
                  AND sender_role IN ('support', 'admin')
                UNION
                SELECT assigned_to AS participant_id
                FROM support_tickets
                WHERE id = :assigned_ticket_id
                  AND assigned_to IS NOT NULL
            ) participants ON participants.participant_id = u.id
            WHERE u.deleted_at IS NULL
              AND (u.is_admin = 1 OR LOWER(COALESCE(u.role, 'user')) IN ('support', 'admin'))
            ORDER BY COALESCE(u.username, u.email, ''), u.id
        ");
        $Silian_stmt->execute([
            'message_ticket_id' => $Silian_ticketId,
            'assigned_ticket_id' => $Silian_ticketId,
        ]);

        return array_map(static function (array $Silian_row): array {
            $Silian_role = !empty($Silian_row['is_admin']) ? 'admin' : strtolower((string) ($Silian_row['role'] ?? 'support'));
            return [
                'id' => (int) ($Silian_row['id'] ?? 0),
                'username' => $Silian_row['username'] ?? null,
                'email' => $Silian_row['email'] ?? null,
                'role' => $Silian_role,
            ];
        }, $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    private function findFeedbackCandidate(int $Silian_ticketId, int $Silian_ratedUserId): ?array
    {
        foreach ($this->feedbackCandidates($Silian_ticketId) as $Silian_candidate) {
            if ((int) ($Silian_candidate['id'] ?? 0) === $Silian_ratedUserId) {
                return $Silian_candidate;
            }
        }

        return null;
    }

    private function feedback(int $Silian_ticketId): array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT
                f.*,
                reviewer.username AS reviewer_username,
                reviewer.email AS reviewer_email,
                rated.username AS rated_username,
                rated.email AS rated_email,
                rated.role AS rated_role,
                rated.is_admin AS rated_is_admin
            FROM support_ticket_feedback f
            INNER JOIN users reviewer ON reviewer.id = f.user_id
            INNER JOIN users rated ON rated.id = f.rated_user_id
            WHERE f.ticket_id = :ticket_id
            ORDER BY f.id ASC
        ");
        $Silian_stmt->execute(['ticket_id' => $Silian_ticketId]);

        return array_map(static function (array $Silian_row): array {
            $Silian_ratedRole = !empty($Silian_row['rated_is_admin']) ? 'admin' : strtolower((string) ($Silian_row['rated_role'] ?? 'support'));
            return [
                'id' => (int) ($Silian_row['id'] ?? 0),
                'ticket_id' => (int) ($Silian_row['ticket_id'] ?? 0),
                'user_id' => (int) ($Silian_row['user_id'] ?? 0),
                'rated_user_id' => (int) ($Silian_row['rated_user_id'] ?? 0),
                'rating' => (int) ($Silian_row['rating'] ?? 0),
                'comment' => $Silian_row['comment'] ?? null,
                'created_at' => $Silian_row['created_at'] ?? null,
                'updated_at' => $Silian_row['updated_at'] ?? null,
                'reviewer' => [
                    'id' => (int) ($Silian_row['user_id'] ?? 0),
                    'username' => $Silian_row['reviewer_username'] ?? null,
                    'email' => $Silian_row['reviewer_email'] ?? null,
                ],
                'rated_user' => [
                    'id' => (int) ($Silian_row['rated_user_id'] ?? 0),
                    'username' => $Silian_row['rated_username'] ?? null,
                    'email' => $Silian_row['rated_email'] ?? null,
                    'role' => $Silian_ratedRole,
                ],
            ];
        }, $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    private function findFeedbackRecord(int $Silian_ticketId, int $Silian_userId, int $Silian_ratedUserId): ?SupportTicketFeedback
    {
        return SupportTicketFeedback::query()
            ->where('ticket_id', $Silian_ticketId)
            ->where('user_id', $Silian_userId)
            ->where('rated_user_id', $Silian_ratedUserId)
            ->first();
    }

    private function attachments(array $Silian_messageIds): array
    {
        if ($Silian_messageIds === []) {
            return [];
        }
        $Silian_sql = 'SELECT * FROM support_ticket_attachments WHERE message_id IN (' . implode(',', array_fill(0, count($Silian_messageIds), '?')) . ') ORDER BY id ASC';
        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute($Silian_messageIds);
        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $Silian_result = [];
        foreach ($Silian_rows as $Silian_row) {
            $Silian_messageId = (int) $Silian_row['message_id'];
            $Silian_result[$Silian_messageId][] = [
                'id' => (int) $Silian_row['id'],
                'ticket_id' => (int) $Silian_row['ticket_id'],
                'message_id' => $Silian_messageId,
                'file_id' => isset($Silian_row['file_id']) ? (int) $Silian_row['file_id'] : null,
                'file_path' => $Silian_row['file_path'],
                'original_name' => $Silian_row['original_name'],
                'mime_type' => $Silian_row['mime_type'],
                'size' => (int) ($Silian_row['size'] ?? 0),
                'entity_type' => $Silian_row['entity_type'] ?? 'support_ticket_message',
                'download_url' => $this->presignedUrl($Silian_row['file_path'] ?? null),
                'created_at' => $Silian_row['created_at'] ?? null,
            ];
        }
        return $Silian_result;
    }

    private function transferRequests(int $Silian_ticketId): array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT
                tr.*,
                requester.username AS requester_username,
                requester.email AS requester_email,
                from_user.username AS from_username,
                from_user.email AS from_email,
                to_user.username AS to_username,
                to_user.email AS to_email,
                reviewer.username AS reviewer_username,
                reviewer.email AS reviewer_email
            FROM support_ticket_transfer_requests tr
            INNER JOIN users requester ON requester.id = tr.requested_by
            LEFT JOIN users from_user ON from_user.id = tr.from_assignee
            LEFT JOIN users to_user ON to_user.id = tr.to_assignee
            LEFT JOIN users reviewer ON reviewer.id = tr.reviewed_by
            WHERE tr.ticket_id = :ticket_id
            ORDER BY tr.id DESC
        ");
        $Silian_stmt->execute(['ticket_id' => $Silian_ticketId]);

        return array_map(fn (array $Silian_row): array => $this->formatTransferRequest($Silian_row), $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: []);
    }

    private function attachFiles(int $Silian_ticketId, int $Silian_messageId, array $Silian_paths, int $Silian_actorUserId, bool $Silian_supportActor): void
    {
        foreach ($Silian_paths as $Silian_path) {
            $Silian_file = $this->fileMetadataService->findByFilePath($Silian_path);
            if ($Silian_file === null) {
                throw new \InvalidArgumentException('Attachment not found: ' . $Silian_path);
            }
            if (!$Silian_supportActor && (int) ($Silian_file->user_id ?? 0) !== $Silian_actorUserId) {
                throw new \InvalidArgumentException('Attachment ownership mismatch: ' . $Silian_path);
            }
            if ($Silian_supportActor && !$this->canSupportActorAttachFile($Silian_ticketId, $Silian_path, (int) ($Silian_file->user_id ?? 0), $Silian_actorUserId)) {
                throw new \InvalidArgumentException('Attachment is not authorized for this ticket: ' . $Silian_path);
            }
            SupportTicketAttachment::create([
                'ticket_id' => $Silian_ticketId,
                'message_id' => $Silian_messageId,
                'file_id' => (int) ($Silian_file->id ?? 0) ?: null,
                'file_path' => (string) $Silian_file->file_path,
                'original_name' => $Silian_file->original_name,
                'mime_type' => $Silian_file->mime_type,
                'size' => (int) ($Silian_file->size ?? 0),
                'entity_type' => 'support_ticket_message',
                'created_at' => $this->now(),
            ]);
        }
    }

    private function canSupportActorAttachFile(int $Silian_ticketId, string $Silian_path, int $Silian_fileOwnerUserId, int $Silian_actorUserId): bool
    {
        if ($Silian_fileOwnerUserId > 0 && $Silian_fileOwnerUserId === $Silian_actorUserId) {
            return true;
        }

        $Silian_stmt = $this->db->prepare('
            SELECT 1
            FROM support_ticket_attachments
            WHERE ticket_id = :ticket_id
              AND file_path = :file_path
            LIMIT 1
        ');
        $Silian_stmt->execute([
            'ticket_id' => $Silian_ticketId,
            'file_path' => $Silian_path,
        ]);

        return $Silian_stmt->fetchColumn() !== false;
    }

    private function updateTicket(int $Silian_ticketId, array $Silian_fields): void
    {
        $Silian_set = [];
        $Silian_params = ['id' => $Silian_ticketId];
        foreach ($Silian_fields as $Silian_field => $Silian_value) {
            $Silian_set[] = "{$Silian_field} = :{$Silian_field}";
            $Silian_params[$Silian_field] = $Silian_value;
        }
        $Silian_stmt = $this->db->prepare('UPDATE support_tickets SET ' . implode(', ', $Silian_set) . ' WHERE id = :id');
        $Silian_stmt->execute($Silian_params);
    }

    private function findTransferRequest(int $Silian_requestId, bool $Silian_forUpdate = false): ?array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT
                tr.*,
                requester.username AS requester_username,
                requester.email AS requester_email,
                from_user.username AS from_username,
                from_user.email AS from_email,
                to_user.username AS to_username,
                to_user.email AS to_email,
                reviewer.username AS reviewer_username,
                reviewer.email AS reviewer_email
            FROM support_ticket_transfer_requests tr
            INNER JOIN users requester ON requester.id = tr.requested_by
            LEFT JOIN users from_user ON from_user.id = tr.from_assignee
            LEFT JOIN users to_user ON to_user.id = tr.to_assignee
            LEFT JOIN users reviewer ON reviewer.id = tr.reviewed_by
            WHERE tr.id = :id
            LIMIT 1
            {$this->selectForUpdateClause($Silian_forUpdate)}
        ");
        $Silian_stmt->execute(['id' => $Silian_requestId]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);

        return $Silian_row ? $this->formatTransferRequest($Silian_row) : null;
    }

    private function selectForUpdateClause(bool $Silian_forUpdate): string
    {
        if (!$Silian_forUpdate) {
            return '';
        }

        try {
            $Silian_driver = strtolower((string) $this->db->getAttribute(PDO::ATTR_DRIVER_NAME));
        } catch (\Throwable) {
            return '';
        }

        return in_array($Silian_driver, ['mysql', 'pgsql', 'sqlsrv'], true) ? ' FOR UPDATE' : '';
    }

    private function findPendingTransferRequestForTicket(int $Silian_ticketId): ?array
    {
        $Silian_stmt = $this->db->prepare('
            SELECT id
            FROM support_ticket_transfer_requests
            WHERE ticket_id = :ticket_id AND status = :status
            ORDER BY id DESC
            LIMIT 1
        ');
        $Silian_stmt->execute([
            'ticket_id' => $Silian_ticketId,
            'status' => self::TRANSFER_STATUS_PENDING,
        ]);
        $Silian_requestId = $Silian_stmt->fetchColumn();

        return $Silian_requestId ? $this->findTransferRequest((int) $Silian_requestId) : null;
    }

    private function formatTransferRequest(array $Silian_row): array
    {
        return [
            'id' => (int) ($Silian_row['id'] ?? 0),
            'ticket_id' => (int) ($Silian_row['ticket_id'] ?? 0),
            'requested_by' => (int) ($Silian_row['requested_by'] ?? 0),
            'from_assignee' => isset($Silian_row['from_assignee']) ? (int) $Silian_row['from_assignee'] : null,
            'to_assignee' => (int) ($Silian_row['to_assignee'] ?? 0),
            'reason' => $Silian_row['reason'] ?? null,
            'status' => (string) ($Silian_row['status'] ?? self::TRANSFER_STATUS_PENDING),
            'review_note' => $Silian_row['review_note'] ?? null,
            'reviewed_by' => isset($Silian_row['reviewed_by']) ? (int) $Silian_row['reviewed_by'] : null,
            'reviewed_at' => $Silian_row['reviewed_at'] ?? null,
            'created_at' => $Silian_row['created_at'] ?? null,
            'updated_at' => $Silian_row['updated_at'] ?? null,
            'requester' => [
                'id' => (int) ($Silian_row['requested_by'] ?? 0),
                'username' => $Silian_row['requester_username'] ?? null,
                'email' => $Silian_row['requester_email'] ?? null,
            ],
            'from_user' => ($Silian_row['from_assignee'] ?? null) !== null ? [
                'id' => (int) $Silian_row['from_assignee'],
                'username' => $Silian_row['from_username'] ?? null,
                'email' => $Silian_row['from_email'] ?? null,
            ] : null,
            'to_user' => [
                'id' => (int) ($Silian_row['to_assignee'] ?? 0),
                'username' => $Silian_row['to_username'] ?? null,
                'email' => $Silian_row['to_email'] ?? null,
            ],
            'reviewer' => ($Silian_row['reviewed_by'] ?? null) !== null ? [
                'id' => (int) $Silian_row['reviewed_by'],
                'username' => $Silian_row['reviewer_username'] ?? null,
                'email' => $Silian_row['reviewer_email'] ?? null,
            ] : null,
        ];
    }

    private function findAssignableUser(int $Silian_userId): ?array
    {
        $Silian_stmt = $this->db->prepare('SELECT id, role, is_admin FROM users WHERE id = :id AND deleted_at IS NULL LIMIT 1');
        $Silian_stmt->execute(['id' => $Silian_userId]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        if (!$Silian_row) {
            return null;
        }
        $Silian_role = strtolower((string) ($Silian_row['role'] ?? 'user'));
        return (!empty($Silian_row['is_admin']) || in_array($Silian_role, ['support', 'admin'], true)) ? $Silian_row : null;
    }

    private function loadUserById(int $Silian_userId): ?array
    {
        $Silian_stmt = $this->db->prepare('SELECT id, username, email, role, is_admin FROM users WHERE id = :id AND deleted_at IS NULL LIMIT 1');
        $Silian_stmt->execute(['id' => $Silian_userId]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        return $Silian_row ?: null;
    }

    /**
     * @return array{avatar_path:?string,avatar_url:?string}
     */
    private function resolveAvatar(?string $Silian_filePath): array
    {
        $Silian_originalPath = $Silian_filePath !== null ? trim($Silian_filePath) : null;
        if ($Silian_originalPath === '') {
            $Silian_originalPath = null;
        }

        $Silian_normalized = $Silian_originalPath ? ltrim($Silian_originalPath, '/') : null;
        $Silian_url = ($Silian_normalized && $this->r2Service !== null) ? $this->r2Service->getPublicUrl($Silian_normalized) : null;

        return [
            'avatar_path' => $Silian_originalPath,
            'avatar_url' => $Silian_url,
        ];
    }

    private function notifyAssignee(
        array $Silian_user,
        string $Silian_subject,
        string $Silian_body,
        int $Silian_ticketId,
        string $Silian_auditAction,
        ?array $Silian_emailPayload = null
    ): void
    {
        $Silian_userId = (int) ($Silian_user['id'] ?? 0);
        $Silian_messageSent = false;
        $Silian_emailSent = false;

        if ($this->messageService !== null && $Silian_userId > 0) {
            try {
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
            } catch (\Throwable $Silian_exception) {
                $this->logger->warning('Failed to send support assignee system notification', [
                    'ticket_id' => $Silian_ticketId,
                    'user_id' => $Silian_userId,
                    'error' => $Silian_exception->getMessage(),
                ]);
                $this->recordNotificationFailure($Silian_exception, 'support_assignee_system_notification_failed', [
                    'ticket_id' => $Silian_ticketId,
                    'user_id' => $Silian_userId,
                    'subject' => $Silian_subject,
                ]);
            }
        }

        if ($this->emailService !== null && !empty($Silian_user['email'])) {
            try {
                if ($Silian_emailPayload !== null) {
                    $Silian_emailSent = $this->emailService->sendSupportTicketNotification(
                        (string) $Silian_user['email'],
                        (string) ($Silian_user['username'] ?? $Silian_user['email']),
                        $Silian_subject,
                        $Silian_emailPayload,
                        NotificationPreferenceService::CATEGORY_SUPPORT,
                        'normal'
                    );
                } else {
                    $Silian_emailSent = $this->emailService->sendMessageNotification(
                        (string) $Silian_user['email'],
                        (string) ($Silian_user['username'] ?? $Silian_user['email']),
                        $Silian_subject,
                        $Silian_body,
                        NotificationPreferenceService::CATEGORY_SUPPORT,
                        'normal'
                    );
                }
            } catch (\Throwable $Silian_exception) {
                $this->logger->warning('Failed to send support assignee email notification', [
                    'ticket_id' => $Silian_ticketId,
                    'user_id' => $Silian_userId,
                    'error' => $Silian_exception->getMessage(),
                ]);
                $this->recordNotificationFailure($Silian_exception, 'support_assignee_email_notification_failed', [
                    'ticket_id' => $Silian_ticketId,
                    'user_id' => $Silian_userId,
                    'subject' => $Silian_subject,
                ]);
            }
        }

        $this->auditLogService->log([
            'user_id' => $Silian_userId > 0 ? $Silian_userId : null,
            'action' => $Silian_auditAction,
            'operation_category' => 'support',
            'actor_type' => 'system',
            'affected_table' => 'support_tickets',
            'affected_id' => $Silian_ticketId,
            'status' => $Silian_messageSent && $Silian_emailSent
                ? 'success'
                : (($Silian_messageSent || $Silian_emailSent) ? 'partial' : 'failed'),
            'data' => [
                'message_sent' => $Silian_messageSent,
                'email_sent' => $Silian_emailSent,
                'subject' => $Silian_subject,
            ],
        ]);
    }

    private function notifySupportMailbox(string $Silian_subject, string $Silian_body, ?array $Silian_emailPayload = null): void
    {
        if ($this->emailService === null) {
            return;
        }
        $Silian_supportEmail = trim((string) $this->emailService->getSupportEmail());
        if ($Silian_supportEmail === '') {
            return;
        }
        try {
            if ($Silian_emailPayload !== null) {
                $this->emailService->sendSupportTicketNotification(
                    $Silian_supportEmail,
                    'Support Team',
                    $Silian_subject,
                    $Silian_emailPayload,
                    NotificationPreferenceService::CATEGORY_MESSAGE,
                    'high'
                );
            } else {
                $this->emailService->sendMessageNotification($Silian_supportEmail, 'Support Team', $Silian_subject, $Silian_body, NotificationPreferenceService::CATEGORY_MESSAGE, 'high');
            }
        } catch (\Throwable $Silian_e) {
            $this->logger->warning('Failed to send support mailbox notification', ['subject' => $Silian_subject, 'error' => $Silian_e->getMessage()]);
        }
    }

    private function notifyUserReply(array $Silian_ticket, string $Silian_body, int $Silian_ticketId): void
    {
        $Silian_userId = (int) ($Silian_ticket['user_id'] ?? 0);
        $Silian_statusLabel = $this->formatTicketStatusLabel((string) ($Silian_ticket['status'] ?? self::STATUS_WAITING_USER));
        $Silian_messageBody = "Your support ticket has a new reply.\n\nStatus: {$Silian_statusLabel}\n\n" . $Silian_body;
        if ($this->messageService !== null && $Silian_userId > 0) {
            try {
                $this->messageService->sendSystemMessage($Silian_userId, 'Support replied to your ticket', $Silian_messageBody, 'message', 'normal', 'support_ticket', $Silian_ticketId, false);
            } catch (\Throwable $Silian_e) {
                $this->logger->warning('Failed to send support reply message', ['ticket_id' => $Silian_ticketId, 'error' => $Silian_e->getMessage()]);
            }
        }
        if ($this->emailService !== null && !empty($Silian_ticket['requester_email'])) {
            try {
                $this->emailService->sendSupportTicketNotification(
                    (string) $Silian_ticket['requester_email'],
                    (string) ($Silian_ticket['requester_username'] ?? $Silian_ticket['requester_email']),
                    sprintf('Support replied to ticket #%d', $Silian_ticketId),
                    [
                        'eyebrow' => 'Support reply',
                        'intro' => 'Our support team replied to your ticket.',
                        'summary' => $this->supportReplySummary((string) ($Silian_ticket['status'] ?? self::STATUS_WAITING_USER)),
                        'ticket' => [
                            'id' => $Silian_ticketId,
                            'subject' => (string) ($Silian_ticket['subject'] ?? ''),
                        ],
                        'details' => $this->buildTicketEmailDetails($Silian_ticket),
                        'message' => [
                            'label' => 'Latest reply',
                            'body' => $Silian_body,
                        ],
                        'button_label' => 'View ticket',
                        'button_path' => $this->ticketEmailPath($Silian_ticketId, false),
                        'closing' => $this->supportReplyClosing((string) ($Silian_ticket['status'] ?? self::STATUS_WAITING_USER)),
                    ],
                    NotificationPreferenceService::CATEGORY_MESSAGE,
                    'normal'
                );
            } catch (\Throwable $Silian_e) {
                $this->logger->warning('Failed to send support reply email', ['ticket_id' => $Silian_ticketId, 'error' => $Silian_e->getMessage()]);
            }
        }
    }

    private function supportReplySummary(string $Silian_status): string
    {
        return match ($Silian_status) {
            self::STATUS_RESOLVED => 'We posted a new reply and marked the ticket as resolved.',
            self::STATUS_CLOSED => 'We posted a new reply and closed the ticket.',
            self::STATUS_IN_PROGRESS => 'We posted a new reply and kept the ticket in progress.',
            self::STATUS_OPEN => 'We posted a new reply and kept the ticket open.',
            default => 'We posted a new reply and the ticket is now waiting for your response.',
        };
    }

    private function supportReplyClosing(string $Silian_status): string
    {
        return match ($Silian_status) {
            self::STATUS_RESOLVED, self::STATUS_CLOSED => 'If anything is still unclear, open CarbonTrack to review the thread and follow up.',
            default => 'Reply in CarbonTrack whenever you are ready so we can keep the thread moving.',
        };
    }

    private function notifyUserTicketUpdated(array $Silian_ticket, array $Silian_updates, int $Silian_ticketId, ?array $Silian_updatedTicket = null): void
    {
        $Silian_updatedTicket = $Silian_updatedTicket ?? $this->applyTicketUpdatesToSnapshot($Silian_ticket, $Silian_updates);
        $Silian_changeItems = $this->buildTicketUpdateEntries($Silian_ticket, $Silian_updates, $Silian_updatedTicket);
        if ($Silian_changeItems === []) {
            return;
        }

        $Silian_userId = (int) ($Silian_ticket['user_id'] ?? 0);
        $Silian_subject = sprintf('Support ticket #%d updated', $Silian_ticketId);
        $Silian_summary = $this->formatTicketUpdateEntriesAsText($Silian_changeItems);
        $Silian_messageBody = "Your support ticket has been updated.\n\n" . $Silian_summary;

        if ($this->messageService !== null && $Silian_userId > 0) {
            try {
                $this->messageService->sendSystemMessage(
                    $Silian_userId,
                    $Silian_subject,
                    $Silian_messageBody,
                    'support_ticket',
                    'normal',
                    'support_ticket',
                    $Silian_ticketId,
                    false
                );
            } catch (\Throwable $Silian_e) {
                $this->logger->warning('Failed to send support ticket update message', ['ticket_id' => $Silian_ticketId, 'error' => $Silian_e->getMessage()]);
            }
        }

        if ($this->emailService !== null && !empty($Silian_ticket['requester_email'])) {
            try {
                $this->emailService->sendSupportTicketNotification(
                    (string) $Silian_ticket['requester_email'],
                    (string) ($Silian_ticket['requester_username'] ?? $Silian_ticket['requester_email']),
                    $Silian_subject,
                    [
                        'eyebrow' => 'Workflow update',
                        'intro' => 'We updated the workflow details for your support ticket.',
                        'summary' => 'Review the latest status below so you know what changed on our side.',
                        'ticket' => [
                            'id' => $Silian_ticketId,
                            'subject' => (string) ($Silian_ticket['subject'] ?? ''),
                        ],
                        'details' => $this->buildTicketEmailDetails($Silian_updatedTicket),
                        'changes' => $Silian_changeItems,
                        'button_label' => 'Review ticket',
                        'button_path' => $this->ticketEmailPath($Silian_ticketId, false),
                        'closing' => 'You can revisit the ticket thread in CarbonTrack whenever you need the full context.',
                    ],
                    NotificationPreferenceService::CATEGORY_SUPPORT,
                    'normal'
                );
            } catch (\Throwable $Silian_e) {
                $this->logger->warning('Failed to send support ticket update email', ['ticket_id' => $Silian_ticketId, 'error' => $Silian_e->getMessage()]);
            }
        }
    }

    private function applyTicketUpdatesToSnapshot(array $Silian_ticket, array $Silian_updates, ?array $Silian_resolvedAssignee = null): array
    {
        $Silian_updatedTicket = $Silian_ticket;
        foreach ($Silian_updates as $Silian_key => $Silian_value) {
            $Silian_updatedTicket[$Silian_key] = $Silian_value;
        }

        if (!array_key_exists('assigned_to', $Silian_updates)) {
            return $Silian_updatedTicket;
        }

        unset($Silian_updatedTicket['assigned_username'], $Silian_updatedTicket['assigned_user']);
        $Silian_nextAssigneeId = $Silian_updates['assigned_to'];
        if ($Silian_nextAssigneeId === null || $Silian_nextAssigneeId === '' || (int) $Silian_nextAssigneeId <= 0) {
            return $Silian_updatedTicket;
        }

        $Silian_resolvedAssignee = $Silian_resolvedAssignee ?? $this->loadUserById((int) $Silian_nextAssigneeId);
        $Silian_resolvedAssigneeName = trim((string) ($Silian_resolvedAssignee['username'] ?? ''));
        if ($Silian_resolvedAssigneeName === '') {
            return $Silian_updatedTicket;
        }

        $Silian_updatedTicket['assigned_username'] = $Silian_resolvedAssigneeName;
        $Silian_updatedTicket['assigned_user'] = [
            'id' => (int) ($Silian_resolvedAssignee['id'] ?? $Silian_nextAssigneeId),
            'username' => $Silian_resolvedAssigneeName,
        ];

        return $Silian_updatedTicket;
    }

    private function supportMailboxBody(array $Silian_actor, array $Silian_ticket, string $Silian_body): string
    {
        return sprintf(
            "Ticket #%d\nUser: %s <%s>\nCategory: %s\nPriority: %s\nStatus: %s\n\n%s",
            (int) ($Silian_ticket['id'] ?? 0),
            $this->actorName($Silian_actor),
            (string) ($Silian_actor['email'] ?? ''),
            (string) ($Silian_ticket['category'] ?? ''),
            (string) ($Silian_ticket['priority'] ?? 'normal'),
            (string) ($Silian_ticket['status'] ?? self::STATUS_OPEN),
            $Silian_body
        );
    }

    /**
     * @return array<int, array{label:string,from?:string,to?:string,value?:string}>
     */
    private function buildTicketUpdateEntries(array $Silian_ticket, array $Silian_updates, ?array $Silian_updatedTicket = null): array
    {
        $Silian_changes = [];

        if (array_key_exists('status', $Silian_updates)) {
            $Silian_changes[] = [
                'label' => 'Status',
                'from' => $this->formatTicketStatusLabel((string) ($Silian_ticket['status'] ?? 'unknown')),
                'to' => $this->formatTicketStatusLabel((string) ($Silian_updates['status'] ?? 'unknown')),
            ];
        }

        if (array_key_exists('priority', $Silian_updates)) {
            $Silian_changes[] = [
                'label' => 'Priority',
                'from' => $this->formatTicketPriorityLabel((string) ($Silian_ticket['priority'] ?? 'unknown')),
                'to' => $this->formatTicketPriorityLabel((string) ($Silian_updates['priority'] ?? 'unknown')),
            ];
        }

        if (array_key_exists('assigned_to', $Silian_updates)) {
            $Silian_changes[] = [
                'label' => 'Assigned handler',
                'from' => $this->resolveAssigneeLabel($Silian_ticket),
                'to' => $this->resolveAssigneeLabel($Silian_updatedTicket ?? ['assigned_to' => $Silian_updates['assigned_to']]),
            ];
        }

        return $Silian_changes;
    }

    private function buildTicketUpdateSummary(array $Silian_ticket, array $Silian_updates): string
    {
        return $this->formatTicketUpdateEntriesAsText($this->buildTicketUpdateEntries($Silian_ticket, $Silian_updates));
    }

    /**
     * @return array{
     *   eyebrow:string,
     *   intro:string,
     *   summary:string,
     *   ticket:array{id:int,subject:string},
     *   details:array<int, array{label:string,value:string}>,
     *   message:array{label:string,body:string},
     *   button_label:string,
     *   button_path:string,
     *   closing:string
     * }
     */
    private function buildSupportMailboxEmailPayload(
        array $Silian_actor,
        array $Silian_ticket,
        int $Silian_ticketId,
        string $Silian_intro,
        string $Silian_messageLabel,
        string $Silian_body
    ): array {
        return [
            'eyebrow' => 'Support inbox',
            'intro' => $Silian_intro,
            'summary' => 'Review the latest request details below and continue the thread from the support workbench.',
            'ticket' => [
                'id' => $Silian_ticketId,
                'subject' => (string) ($Silian_ticket['subject'] ?? ''),
            ],
            'details' => $this->buildTicketEmailDetails($Silian_ticket, [
                ['label' => 'Requester', 'value' => $this->formatRequesterDisplay($Silian_actor)],
            ]),
            'message' => [
                'label' => $Silian_messageLabel,
                'body' => $Silian_body,
            ],
            'button_label' => 'Open support ticket',
            'button_path' => $this->ticketEmailPath($Silian_ticketId, true),
            'closing' => 'Open CarbonTrack to review the full conversation, attachments, and workflow state.',
        ];
    }

    /**
     * @param array<int, array{label:string,value:string}> $extraDetails
     * @return array<int, array{label:string,value:string}>
     */
    private function buildTicketEmailDetails(array $Silian_ticket, array $Silian_extraDetails = []): array
    {
        $Silian_details = [];

        $Silian_status = $this->formatTicketStatusLabel((string) ($Silian_ticket['status'] ?? self::STATUS_OPEN));
        if ($Silian_status !== '') {
            $Silian_details[] = ['label' => 'Status', 'value' => $Silian_status];
        }

        $Silian_priority = $this->formatTicketPriorityLabel((string) ($Silian_ticket['priority'] ?? 'normal'));
        if ($Silian_priority !== '') {
            $Silian_details[] = ['label' => 'Priority', 'value' => $Silian_priority];
        }

        $Silian_category = $this->formatTicketCategoryLabel((string) ($Silian_ticket['category'] ?? ''));
        if ($Silian_category !== '') {
            $Silian_details[] = ['label' => 'Category', 'value' => $Silian_category];
        }

        $Silian_assignee = $this->resolveAssigneeLabel($Silian_ticket);
        if ($Silian_assignee !== 'Unassigned') {
            $Silian_details[] = ['label' => 'Assignee', 'value' => $Silian_assignee];
        }

        foreach ($Silian_extraDetails as $Silian_detail) {
            $Silian_label = trim((string) ($Silian_detail['label'] ?? ''));
            $Silian_value = trim((string) ($Silian_detail['value'] ?? ''));
            if ($Silian_label === '' || $Silian_value === '') {
                continue;
            }
            $Silian_details[] = ['label' => $Silian_label, 'value' => $Silian_value];
        }

        return $Silian_details;
    }

    private function formatRequesterDisplay(array $Silian_actor): string
    {
        $Silian_name = trim((string) ($Silian_actor['username'] ?? $Silian_actor['requester_username'] ?? ''));
        $Silian_email = trim((string) ($Silian_actor['email'] ?? $Silian_actor['requester_email'] ?? ''));

        if ($Silian_name === '') {
            $Silian_name = $Silian_email !== '' ? $Silian_email : 'User';
        }

        if ($Silian_email === '') {
            return $Silian_name;
        }

        return sprintf('%s <%s>', $Silian_name, $Silian_email);
    }

    private function ticketEmailPath(int $Silian_ticketId, bool $Silian_supportView): string
    {
        return ($Silian_supportView ? 'support/tickets/' : 'tickets/') . $Silian_ticketId;
    }

    private function formatTicketStatusLabel(string $Silian_status): string
    {
        $Silian_normalized = strtolower(trim($Silian_status));
        return match ($Silian_normalized) {
            self::STATUS_OPEN => 'Open',
            self::STATUS_IN_PROGRESS => 'In progress',
            self::STATUS_WAITING_USER => 'Waiting for user',
            self::STATUS_RESOLVED => 'Resolved',
            self::STATUS_CLOSED => 'Closed',
            default => $this->humanizeToken($Silian_status),
        };
    }

    private function formatTicketPriorityLabel(string $Silian_priority): string
    {
        $Silian_normalized = strtolower(trim($Silian_priority));
        return match ($Silian_normalized) {
            'low' => 'Low',
            'normal' => 'Normal',
            'high' => 'High',
            'urgent' => 'Urgent',
            default => $this->humanizeToken($Silian_priority),
        };
    }

    private function formatTicketCategoryLabel(string $Silian_category): string
    {
        $Silian_normalized = strtolower(trim($Silian_category));
        return match ($Silian_normalized) {
            'website_bug' => 'Website bug',
            'business_issue' => 'Business issue',
            'feature_request' => 'Feature request',
            'account' => 'Account',
            'other' => 'Other',
            default => $this->humanizeToken($Silian_category),
        };
    }

    /**
     * @param array<int, array{label:string,from?:string,to?:string,value?:string}> $entries
     */
    private function formatTicketUpdateEntriesAsText(array $Silian_entries): string
    {
        $Silian_lines = [];
        foreach ($Silian_entries as $Silian_entry) {
            $Silian_label = trim((string) ($Silian_entry['label'] ?? ''));
            if ($Silian_label === '') {
                continue;
            }

            $Silian_value = trim((string) ($Silian_entry['value'] ?? ''));
            if ($Silian_value !== '') {
                $Silian_lines[] = sprintf('%s: %s', $Silian_label, $Silian_value);
                continue;
            }

            $Silian_from = trim((string) ($Silian_entry['from'] ?? ''));
            $Silian_to = trim((string) ($Silian_entry['to'] ?? ''));
            if ($Silian_to !== '') {
                $Silian_lines[] = sprintf('%s: %s -> %s', $Silian_label, $Silian_from !== '' ? $Silian_from : 'Unknown', $Silian_to);
            }
        }

        return implode("\n", $Silian_lines);
    }

    private function resolveAssigneeLabel(array $Silian_ticket): string
    {
        $Silian_assignedUser = $Silian_ticket['assigned_user'] ?? null;
        if (is_array($Silian_assignedUser)) {
            $Silian_username = trim((string) ($Silian_assignedUser['username'] ?? ''));
            if ($Silian_username !== '') {
                return $Silian_username;
            }
        }

        $Silian_username = trim((string) ($Silian_ticket['assigned_username'] ?? ''));
        if ($Silian_username !== '') {
            return $Silian_username;
        }

        $Silian_assignedTo = $Silian_ticket['assigned_to'] ?? null;
        if ($Silian_assignedTo === null || $Silian_assignedTo === '' || (int) $Silian_assignedTo <= 0) {
            return 'Unassigned';
        }

        $Silian_user = $this->loadUserById((int) $Silian_assignedTo);
        $Silian_resolvedName = trim((string) ($Silian_user['username'] ?? ''));
        if ($Silian_resolvedName !== '') {
            return $Silian_resolvedName;
        }

        return 'User #' . (int) $Silian_assignedTo;
    }

    private function humanizeToken(string $Silian_value): string
    {
        $Silian_trimmed = trim($Silian_value);
        if ($Silian_trimmed === '') {
            return '';
        }

        return ucwords(str_replace(['_', '-'], ' ', strtolower($Silian_trimmed)));
    }

    private function presignedUrl(?string $Silian_filePath): ?string
    {
        if (!$this->r2Service || !is_string($Silian_filePath) || trim($Silian_filePath) === '') {
            return null;
        }
        try {
            return $this->r2Service->generatePresignedUrl($Silian_filePath, 900);
        } catch (\Throwable $Silian_e) {
            $this->logger->warning('Failed to build support ticket file URL', ['file_path' => $Silian_filePath, 'error' => $Silian_e->getMessage()]);
            return null;
        }
    }

    private function normalizeAttachments(mixed $Silian_attachments): array
    {
        if (!is_array($Silian_attachments)) {
            return [];
        }
        $Silian_paths = [];
        foreach ($Silian_attachments as $Silian_attachment) {
            if (is_string($Silian_attachment) && trim($Silian_attachment) !== '') {
                $Silian_paths[] = trim($Silian_attachment);
                continue;
            }
            if (is_array($Silian_attachment)) {
                $Silian_path = $Silian_attachment['file_path'] ?? $Silian_attachment['path'] ?? null;
                if (is_string($Silian_path) && trim($Silian_path) !== '') {
                    $Silian_paths[] = trim($Silian_path);
                }
            }
        }
        return array_values(array_unique($Silian_paths));
    }

    private function normalizeCategory(mixed $Silian_value): string
    {
        $Silian_category = is_string($Silian_value) ? trim($Silian_value) : '';
        if (!in_array($Silian_category, self::VALID_CATEGORIES, true)) {
            throw new \InvalidArgumentException('Invalid category');
        }
        return $Silian_category;
    }

    private function normalizeStatus(mixed $Silian_value): string
    {
        $Silian_status = is_string($Silian_value) ? trim($Silian_value) : '';
        if (!in_array($Silian_status, self::VALID_STATUSES, true)) {
            throw new \InvalidArgumentException('Invalid status');
        }
        return $Silian_status;
    }

    private function normalizePriority(mixed $Silian_value): string
    {
        $Silian_priority = is_string($Silian_value) && trim($Silian_value) !== '' ? trim($Silian_value) : 'normal';
        if (!in_array($Silian_priority, self::VALID_PRIORITIES, true)) {
            throw new \InvalidArgumentException('Invalid priority');
        }
        return $Silian_priority;
    }

    private function normalizeTransferStatus(mixed $Silian_value): string
    {
        $Silian_status = is_string($Silian_value) ? trim($Silian_value) : '';
        if (!in_array($Silian_status, self::VALID_TRANSFER_STATUSES, true)) {
            throw new \InvalidArgumentException('Invalid transfer status');
        }
        return $Silian_status;
    }

    private function normalizeRating(mixed $Silian_value): int
    {
        if (!is_numeric($Silian_value)) {
            throw new \InvalidArgumentException('rating is required');
        }

        $Silian_rating = (int) $Silian_value;
        if ($Silian_rating < 1 || $Silian_rating > 5) {
            throw new \InvalidArgumentException('rating must be between 1 and 5');
        }

        return $Silian_rating;
    }

    private function normalizeFeedbackComment(mixed $Silian_value): ?string
    {
        $Silian_comment = $this->nullableString($Silian_value);
        if ($Silian_comment !== null && mb_strlen($Silian_comment) > 1000) {
            throw new \InvalidArgumentException('comment must be 1000 characters or fewer');
        }

        return $Silian_comment;
    }

    private function requireString(mixed $Silian_value, string $Silian_field): string
    {
        if (!is_string($Silian_value) || trim($Silian_value) === '') {
            throw new \InvalidArgumentException(sprintf('%s is required', $Silian_field));
        }
        return trim($Silian_value);
    }

    private function nullableString(mixed $Silian_value): ?string
    {
        if (!is_string($Silian_value)) {
            return null;
        }
        $Silian_trimmed = trim($Silian_value);
        return $Silian_trimmed === '' ? null : $Silian_trimmed;
    }

    private function actorName(array $Silian_actor): string
    {
        $Silian_name = trim((string) ($Silian_actor['username'] ?? ''));
        return $Silian_name !== '' ? $Silian_name : ((string) ($Silian_actor['email'] ?? 'User'));
    }

    private function actorType(array $Silian_actor): string
    {
        if ($this->isAdminActor($Silian_actor)) {
            return 'admin';
        }
        if (!empty($Silian_actor['is_support']) || (($Silian_actor['role'] ?? null) === 'support')) {
            return 'support';
        }
        return 'user';
    }

    private function isAdminActor(array $Silian_actor): bool
    {
        return !empty($Silian_actor['is_admin']) || (($Silian_actor['role'] ?? null) === 'admin');
    }

    private function supportTicketBaseFilters(array $Silian_actor, array $Silian_query = []): array
    {
        $Silian_actorId = (int) ($Silian_actor['id'] ?? 0);
        if ($Silian_actorId <= 0) {
            return ['assigned_to' => -1];
        }

        if ($this->isPendingTransferTargetQuery($Silian_actor, $Silian_query)) {
            return ['transfer_target' => $Silian_actorId];
        }

        if ($this->isAdminActor($Silian_actor)) {
            return [];
        }

        return ['assigned_to' => $Silian_actorId];
    }

    private function supportTicketQuery(array $Silian_actor, array $Silian_query): array
    {
        if ($this->isAdminActor($Silian_actor)) {
            return $Silian_query;
        }

        unset($Silian_query['assigned_to']);
        unset($Silian_query['pending_transfer_target']);
        return $Silian_query;
    }

    private function isPendingTransferTargetQuery(array $Silian_actor, array $Silian_query): bool
    {
        $Silian_raw = $Silian_query['pending_transfer_target'] ?? null;
        if (is_bool($Silian_raw)) {
            return $Silian_raw;
        }
        if (is_int($Silian_raw) || is_float($Silian_raw) || (is_string($Silian_raw) && is_numeric($Silian_raw))) {
            return (int) $Silian_raw === 1;
        }
        if (is_string($Silian_raw)) {
            return in_array(strtolower(trim($Silian_raw)), ['true', 'yes', 'on'], true);
        }

        return false;
    }

    private function pendingTransferRequestsForTarget(array $Silian_ticketIds, int $Silian_targetUserId): array
    {
        $Silian_ticketIds = array_values(array_filter(array_map('intval', $Silian_ticketIds), static fn (int $Silian_id): bool => $Silian_id > 0));
        if ($Silian_ticketIds === [] || $Silian_targetUserId <= 0) {
            return [];
        }

        $Silian_placeholders = implode(',', array_fill(0, count($Silian_ticketIds), '?'));
        $Silian_stmt = $this->db->prepare("
            SELECT
                tr.*,
                requester.username AS requester_username,
                requester.email AS requester_email,
                from_user.username AS from_username,
                from_user.email AS from_email,
                to_user.username AS to_username,
                to_user.email AS to_email,
                reviewer.username AS reviewer_username,
                reviewer.email AS reviewer_email
            FROM support_ticket_transfer_requests tr
            INNER JOIN users requester ON requester.id = tr.requested_by
            LEFT JOIN users from_user ON from_user.id = tr.from_assignee
            LEFT JOIN users to_user ON to_user.id = tr.to_assignee
            LEFT JOIN users reviewer ON reviewer.id = tr.reviewed_by
            WHERE tr.ticket_id IN ({$Silian_placeholders})
              AND tr.to_assignee = ?
              AND tr.status = ?
            ORDER BY tr.id DESC
        ");
        $Silian_stmt->execute([
            ...$Silian_ticketIds,
            $Silian_targetUserId,
            self::TRANSFER_STATUS_PENDING,
        ]);

        $Silian_result = [];
        foreach ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $Silian_row) {
            $Silian_ticketId = (int) ($Silian_row['ticket_id'] ?? 0);
            if ($Silian_ticketId > 0 && !isset($Silian_result[$Silian_ticketId])) {
                $Silian_result[$Silian_ticketId] = $this->formatTransferRequest($Silian_row);
            }
        }

        return $Silian_result;
    }

    private function recordFailure(\Throwable $Silian_e, string $Silian_action, array $Silian_actor, ?int $Silian_ticketId): void
    {
        $this->auditLogService->log([
            'user_id' => isset($Silian_actor['id']) ? (int) $Silian_actor['id'] : null,
            'action' => $Silian_action,
            'operation_category' => 'support',
            'actor_type' => $this->actorType($Silian_actor),
            'affected_table' => 'support_tickets',
            'affected_id' => $Silian_ticketId,
            'status' => 'failed',
            'data' => ['error' => $Silian_e->getMessage()],
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

        try {
            $Silian_request = \CarbonTrack\Support\SyntheticRequestFactory::fromContext(
                '/support/notifications',
                'SYSTEM',
                null,
                [],
                $Silian_context,
                ['PHP_SAPI' => PHP_SAPI]
            );
            $this->errorLogService->logException($Silian_exception, $Silian_request, $Silian_context);
        } catch (\Throwable) {
            // ignore secondary logging failure
        }
    }

    private function now(): string
    {
        return date('Y-m-d H:i:s');
    }
}
