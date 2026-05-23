<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use PDO;
use Psr\Log\LoggerInterface;

class AdminAiConversationStoreService
{
    public function __construct(
        private PDO $db,
        private LoggerInterface $logger,
        private ?AuditLogService $auditLogService = null
    ) {
    }

    /**
     * @param array<string,mixed> $filters
     * @return array<int,array<string,mixed>>
     */
    public function listConversations(array $Silian_filters = []): array
    {
        $Silian_limit = max(1, min(50, (int) ($Silian_filters['limit'] ?? 20)));
        $Silian_actorId = isset($Silian_filters['actor_id']) && is_numeric((string) $Silian_filters['actor_id'])
            ? (int) $Silian_filters['actor_id']
            : (isset($Silian_filters['admin_id']) && is_numeric((string) $Silian_filters['admin_id']) ? (int) $Silian_filters['admin_id'] : null);
        $Silian_status = isset($Silian_filters['status']) ? strtolower(trim((string) $Silian_filters['status'])) : null;
        $Silian_model = isset($Silian_filters['model']) ? trim((string) $Silian_filters['model']) : null;
        $Silian_dateFrom = $this->normalizeDateBoundary($Silian_filters['date_from'] ?? null, false);
        $Silian_dateTo = $this->normalizeDateBoundary($Silian_filters['date_to'] ?? null, true);
        $Silian_hasPendingAction = $this->normalizeBooleanFilter($Silian_filters['has_pending_action'] ?? null);
        $Silian_conversationIdFilter = $this->normalizeConversationId(isset($Silian_filters['conversation_id']) ? (string) $Silian_filters['conversation_id'] : null);

        $Silian_sql = "SELECT
                    c.conversation_id,
                    c.started_at,
                    c.last_activity_at,
                    c.admin_id,
                    c.title,
                    c.last_message_preview,
                    COALESCE(msg.message_count, 0) AS message_count,
                    COALESCE(pending.pending_action_count, 0) AS pending_action_count,
                    COALESCE(llm.llm_calls, 0) AS llm_calls,
                    COALESCE(llm.total_tokens, 0) AS total_tokens,
                    llm.last_model
                FROM admin_ai_conversations c
                LEFT JOIN (
                    SELECT conversation_id, COUNT(*) AS message_count
                    FROM admin_ai_messages
                    WHERE kind = 'message'
                    GROUP BY conversation_id
                ) msg ON msg.conversation_id = c.conversation_id
                LEFT JOIN (
                    SELECT conversation_id, COUNT(*) AS pending_action_count
                    FROM admin_ai_messages
                    WHERE kind = 'action_proposed' AND status = 'pending'
                    GROUP BY conversation_id
                ) pending ON pending.conversation_id = c.conversation_id
                LEFT JOIN (
                    SELECT
                        logs.conversation_id,
                        COUNT(*) AS llm_calls,
                        COALESCE(SUM(logs.total_tokens), 0) AS total_tokens,
                        (
                            SELECT latest.model
                            FROM llm_logs latest
                            WHERE latest.conversation_id = logs.conversation_id
                            ORDER BY latest.created_at DESC, latest.id DESC
                            LIMIT 1
                        ) AS last_model
                    FROM llm_logs logs
                    WHERE logs.conversation_id IS NOT NULL
                      AND logs.conversation_id <> ''
                    GROUP BY logs.conversation_id
                ) llm ON llm.conversation_id = c.conversation_id
                WHERE 1 = 1";
        /** @var array<string,array{0:mixed,1:int}> $params */
        $Silian_params = [];
        if ($Silian_actorId !== null) {
            $Silian_sql .= " AND c.admin_id = :actor_id";
            $Silian_params[':actor_id'] = [$Silian_actorId, PDO::PARAM_INT];
        }
        if ($Silian_conversationIdFilter !== null) {
            $Silian_sql .= " AND c.conversation_id = :conversation_id";
            $Silian_params[':conversation_id'] = [$Silian_conversationIdFilter, PDO::PARAM_STR];
        }
        if ($Silian_dateFrom !== null) {
            $Silian_sql .= " AND c.last_activity_at >= :date_from";
            $Silian_params[':date_from'] = [$Silian_dateFrom, PDO::PARAM_STR];
        }
        if ($Silian_dateTo !== null) {
            $Silian_sql .= " AND c.last_activity_at <= :date_to";
            $Silian_params[':date_to'] = [$Silian_dateTo, PDO::PARAM_STR];
        }
        if ($Silian_model !== null && $Silian_model !== '') {
            $Silian_sql .= " AND llm.last_model LIKE :model";
            $Silian_params[':model'] = ['%' . $Silian_model . '%', PDO::PARAM_STR];
        }
        if ($Silian_status === 'waiting_confirmation') {
            $Silian_sql .= " AND COALESCE(pending.pending_action_count, 0) > 0";
        } elseif ($Silian_status === 'active') {
            $Silian_sql .= " AND COALESCE(pending.pending_action_count, 0) = 0";
        }
        if ($Silian_hasPendingAction === true) {
            $Silian_sql .= " AND COALESCE(pending.pending_action_count, 0) > 0";
        } elseif ($Silian_hasPendingAction === false) {
            $Silian_sql .= " AND COALESCE(pending.pending_action_count, 0) = 0";
        }

        $Silian_sql .= " ORDER BY c.last_activity_at DESC LIMIT :limit";

        try {
            $Silian_stmt = $this->db->prepare($Silian_sql);
            foreach ($Silian_params as $Silian_key => [$Silian_value, $Silian_type]) {
                $Silian_stmt->bindValue($Silian_key, $Silian_value, $Silian_type);
            }
            $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
            $Silian_stmt->execute();

            $Silian_items = [];
            foreach ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $Silian_row) {
                $Silian_conversationId = (string) ($Silian_row['conversation_id'] ?? '');
                if ($Silian_conversationId === '') {
                    continue;
                }

                $Silian_pendingCount = (int) ($Silian_row['pending_action_count'] ?? 0);
                $Silian_items[] = [
                    'conversation_id' => $Silian_conversationId,
                    'started_at' => $Silian_row['started_at'] ?? null,
                    'last_activity_at' => $Silian_row['last_activity_at'] ?? null,
                    'admin_id' => $Silian_row['admin_id'] !== null ? (int) $Silian_row['admin_id'] : null,
                    'message_count' => (int) ($Silian_row['message_count'] ?? 0),
                    'total_tokens' => (int) ($Silian_row['total_tokens'] ?? 0),
                    'llm_calls' => (int) ($Silian_row['llm_calls'] ?? 0),
                    'last_model' => $Silian_row['last_model'] ?? null,
                    'status' => $Silian_pendingCount > 0 ? 'waiting_confirmation' : 'active',
                    'pending_action_count' => $Silian_pendingCount,
                    'title' => $Silian_row['title'] ?? null,
                    'last_message_preview' => $Silian_row['last_message_preview'] ?? null,
                ];
            }

            return $Silian_items;
        } catch (\Throwable $Silian_exception) {
            $this->logger->warning('Failed to list admin AI conversations from dedicated store.', [
                'error' => $Silian_exception->getMessage(),
            ]);
            return [];
        }
    }

    /**
     * @return array<string,mixed>
     */
    public function getConversationDetail(string $Silian_conversationId): array
    {
        $Silian_conversationId = $this->normalizeConversationId($Silian_conversationId) ?? '';
        if ($Silian_conversationId === '') {
            throw new \InvalidArgumentException('Invalid conversation id');
        }

        $Silian_messages = $this->fetchConversationTimeline($Silian_conversationId);
        $Silian_totals = $this->fetchConversationTokenSummary($Silian_conversationId);
        $Silian_pendingActions = array_values(array_filter(array_map(
            static fn (array $Silian_item): ?array => ($Silian_item['kind'] ?? null) === 'action_proposed' && ($Silian_item['status'] ?? null) === 'pending'
                ? ($Silian_item['proposal'] ?? null)
                : null,
            $Silian_messages
        )));

        $Silian_title = null;
        $Silian_startedAt = null;
        $Silian_lastActivityAt = null;
        $Silian_messageCount = 0;
        foreach ($Silian_messages as $Silian_item) {
            $Silian_createdAt = $Silian_item['created_at'] ?? null;
            if ($Silian_createdAt !== null && ($Silian_startedAt === null || $Silian_createdAt < $Silian_startedAt)) {
                $Silian_startedAt = $Silian_createdAt;
            }
            if ($Silian_createdAt !== null && ($Silian_lastActivityAt === null || $Silian_createdAt > $Silian_lastActivityAt)) {
                $Silian_lastActivityAt = $Silian_createdAt;
            }
            if (($Silian_item['kind'] ?? null) === 'message') {
                $Silian_messageCount++;
                if ($Silian_title === null && ($Silian_item['role'] ?? null) === 'user') {
                    $Silian_title = $this->buildPreview((string) ($Silian_item['content'] ?? ''), 80);
                }
            }
        }

        return [
            'conversation_id' => $Silian_conversationId,
            'summary' => [
                'title' => $Silian_title,
                'started_at' => $Silian_startedAt,
                'last_activity_at' => $Silian_lastActivityAt,
                'message_count' => $Silian_messageCount,
                'pending_action_count' => count($Silian_pendingActions),
                'status' => count($Silian_pendingActions) > 0 ? 'waiting_confirmation' : 'active',
                'total_tokens' => (int) ($Silian_totals['total_tokens'] ?? 0),
                'llm_calls' => (int) ($Silian_totals['llm_calls'] ?? 0),
                'last_model' => $Silian_totals['last_model'] ?? null,
            ],
            'messages' => $Silian_messages,
            'llm_calls' => $this->fetchConversationLlmCalls($Silian_conversationId),
            'pending_actions' => $Silian_pendingActions,
        ];
    }

    /**
     * @return array<int,array{role:string,content:string}>
     */
    public function fetchHistoryMessages(string $Silian_conversationId, int $Silian_maxHistory = 12): array
    {
        $Silian_timeline = $this->fetchStoredConversationTimeline($Silian_conversationId);
        $Silian_history = [];
        foreach ($Silian_timeline as $Silian_item) {
            if (($Silian_item['kind'] ?? null) !== 'message') {
                continue;
            }
            $Silian_content = trim((string) ($Silian_item['content'] ?? ''));
            if ($Silian_content === '') {
                continue;
            }
            $Silian_history[] = [
                'role' => ($Silian_item['role'] ?? null) === 'user' ? 'user' : 'assistant',
                'content' => $Silian_content,
            ];
        }

        $Silian_maxHistory = max(2, $Silian_maxHistory);
        return count($Silian_history) > $Silian_maxHistory ? array_slice($Silian_history, -$Silian_maxHistory) : $Silian_history;
    }

    public function getNextTurnNo(string $Silian_conversationId): int
    {
        $Silian_stmt = $this->db->prepare('SELECT COALESCE(MAX(turn_no), 0) FROM llm_logs WHERE conversation_id = :conversation_id');
        $Silian_stmt->execute([':conversation_id' => $Silian_conversationId]);
        return ((int) $Silian_stmt->fetchColumn()) + 1;
    }

    /**
     * @return array<string,mixed>|null
     */
    public function findProposal(string $Silian_conversationId, int $Silian_proposalId): ?array
    {
        try {
            $Silian_stmt = $this->db->prepare("SELECT * FROM admin_ai_messages
                WHERE id = :id
                  AND conversation_id = :conversation_id
                  AND kind = 'action_proposed'");
            $Silian_stmt->execute([':id' => $Silian_proposalId, ':conversation_id' => $Silian_conversationId]);
            $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
            if (is_array($Silian_row)) {
                $Silian_meta = $this->decodeJson($Silian_row['meta_json'] ?? null);
                $Silian_data = isset($Silian_meta['data']) && is_array($Silian_meta['data']) ? $Silian_meta['data'] : $Silian_meta;
                return [
                    'id' => (int) ($Silian_row['id'] ?? 0),
                    'status' => $Silian_row['status'] ?? null,
                    'action_name' => $Silian_data['action_name'] ?? null,
                    'payload' => $Silian_data['payload'] ?? null,
                ];
            }
        } catch (\Throwable $Silian_exception) {
            $this->logger->warning('Failed to load admin AI proposal from dedicated store.', [
                'conversation_id' => $Silian_conversationId,
                'proposal_id' => $Silian_proposalId,
                'error' => $Silian_exception->getMessage(),
            ]);
        }

        return null;
    }

    /**
     * @param array<string,mixed> $meta
     */
    public function updateProposalStatus(int $Silian_proposalId, string $Silian_status, array $Silian_meta = []): void
    {
        try {
            $Silian_stmt = $this->db->prepare("SELECT meta_json FROM admin_ai_messages WHERE id = :id");
            $Silian_stmt->execute([':id' => $Silian_proposalId]);
            $Silian_existingRaw = $Silian_stmt->fetchColumn();
            if ($Silian_existingRaw !== false) {
                $Silian_existing = $this->decodeJson(is_string($Silian_existingRaw) ? $Silian_existingRaw : null);
                $Silian_existing['data'] = isset($Silian_existing['data']) && is_array($Silian_existing['data']) ? $Silian_existing['data'] : [];
                $Silian_existing['data']['decision_meta'] = $Silian_meta;

                $Silian_update = $this->db->prepare("UPDATE admin_ai_messages
                    SET status = :status, meta_json = :meta_json, updated_at = CURRENT_TIMESTAMP
                    WHERE id = :id");
                $Silian_update->execute([
                    ':status' => $Silian_status,
                    ':meta_json' => json_encode($Silian_existing, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    ':id' => $Silian_proposalId,
                ]);
            }
        } catch (\Throwable $Silian_exception) {
            $this->logger->warning('Failed to update admin AI proposal in dedicated store.', [
                'proposal_id' => $Silian_proposalId,
                'error' => $Silian_exception->getMessage(),
            ]);
        }
    }

    /**
     * @param array<string,mixed> $logContext
     * @param array<string,mixed> $payload
     */
    public function logConversationEvent(string $Silian_action, array $Silian_logContext, array $Silian_payload): ?int
    {
        $Silian_conversationId = $Silian_payload['conversation_id'] ?? ($Silian_logContext['conversation_id'] ?? null);
        $Silian_visibleText = isset($Silian_payload['visible_text']) ? trim((string) $Silian_payload['visible_text']) : null;
        $Silian_requestPayload = isset($Silian_payload['request_data']) && is_array($Silian_payload['request_data']) ? $Silian_payload['request_data'] : [];

        $Silian_requestData = array_filter([
            'conversation_id' => $Silian_conversationId,
            'visible_text' => $Silian_visibleText,
            'role' => $Silian_payload['role'] ?? null,
            'tool_name' => $Silian_payload['tool_name'] ?? null,
            'action_name' => $Silian_payload['action_name'] ?? ($Silian_requestPayload['action_name'] ?? null),
            'label' => $Silian_payload['label'] ?? ($Silian_requestPayload['label'] ?? null),
            'summary' => $Silian_payload['summary'] ?? ($Silian_requestPayload['summary'] ?? null),
            'payload' => isset($Silian_payload['payload']) && is_array($Silian_payload['payload'])
                ? $Silian_payload['payload']
                : (isset($Silian_requestPayload['payload']) && is_array($Silian_requestPayload['payload']) ? $Silian_requestPayload['payload'] : null),
            'proposal_id' => isset($Silian_payload['proposal_id']) ? (int) $Silian_payload['proposal_id'] : null,
            'risk_level' => $Silian_payload['risk_level'] ?? ($Silian_requestPayload['risk_level'] ?? null),
            'meta' => isset($Silian_payload['meta']) && is_array($Silian_payload['meta']) ? $Silian_payload['meta'] : null,
            'suggestion' => isset($Silian_payload['suggestion']) && is_array($Silian_payload['suggestion']) ? $Silian_payload['suggestion'] : null,
            'proposal' => isset($Silian_payload['proposal']) && is_array($Silian_payload['proposal']) ? $Silian_payload['proposal'] : null,
            'result' => isset($Silian_payload['result']) && is_array($Silian_payload['result']) ? $Silian_payload['result'] : null,
        ], static fn ($Silian_value) => $Silian_value !== null && $Silian_value !== '');

        if ($Silian_requestPayload !== []) {
            $Silian_requestData = array_merge($Silian_requestData, ['request_payload' => $Silian_requestPayload]);
        }

        $Silian_storedMessageId = $this->storeConversationEvent($Silian_action, $Silian_logContext, [
            'conversation_id' => $Silian_conversationId,
            'visible_text' => $Silian_visibleText,
            'status' => $Silian_payload['status'] ?? 'success',
            'request_data' => $Silian_requestData,
            'response_code' => $Silian_payload['response_code'] ?? null,
        ]);

        if ($this->auditLogService !== null) {
            try {
                $this->auditLogService->logAdminOperation(
                    $Silian_action,
                    isset($Silian_logContext['actor_id']) && is_numeric((string) $Silian_logContext['actor_id']) ? (int) $Silian_logContext['actor_id'] : null,
                    'admin_ai',
                    [
                        'request_id' => $Silian_logContext['request_id'] ?? null,
                        'endpoint' => $Silian_logContext['source'] ?? '/admin/ai/chat',
                        'request_method' => 'POST',
                        'status' => $Silian_payload['status'] ?? 'success',
                        'conversation_id' => is_string($Silian_conversationId) ? $Silian_conversationId : null,
                        'request_data' => $Silian_requestData,
                        'new_data' => isset($Silian_payload['new_data']) && is_array($Silian_payload['new_data']) ? $Silian_payload['new_data'] : null,
                        'record_id' => isset($Silian_payload['proposal_id']) ? (int) $Silian_payload['proposal_id'] : $Silian_storedMessageId,
                        'table' => 'admin_ai_messages',
                    ]
                );
            } catch (\Throwable $Silian_exception) {
                $this->logger->warning('Failed to write admin AI conversation audit log.', [
                    'action' => $Silian_action,
                    'error' => $Silian_exception->getMessage(),
                ]);
            }
        }

        return $Silian_storedMessageId;
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    private function fetchConversationTimeline(string $Silian_conversationId): array
    {
        return $this->fetchStoredConversationTimeline($Silian_conversationId);
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    private function fetchConversationLlmCalls(string $Silian_conversationId): array
    {
        $Silian_stmt = $this->db->prepare("SELECT *
            FROM llm_logs
            WHERE conversation_id = :conversation_id
            ORDER BY COALESCE(turn_no, 0) ASC, created_at ASC, id ASC");
        $Silian_stmt->execute([':conversation_id' => $Silian_conversationId]);

        $Silian_items = [];
        foreach ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $Silian_row) {
            $Silian_items[] = [
                'id' => (int) ($Silian_row['id'] ?? 0),
                'turn_no' => $Silian_row['turn_no'] !== null ? (int) $Silian_row['turn_no'] : null,
                'request_id' => $Silian_row['request_id'] ?? null,
                'model' => $Silian_row['model'] ?? null,
                'status' => $Silian_row['status'] ?? null,
                'total_tokens' => $Silian_row['total_tokens'] !== null ? (int) $Silian_row['total_tokens'] : null,
                'latency_ms' => $Silian_row['latency_ms'] !== null ? (float) $Silian_row['latency_ms'] : null,
                'created_at' => $Silian_row['created_at'] ?? null,
            ];
        }

        return $Silian_items;
    }

    /**
     * @return array<string,mixed>
     */
    private function fetchConversationTokenSummary(string $Silian_conversationId): array
    {
        $Silian_stmt = $this->db->prepare("SELECT COUNT(*) AS llm_calls, COALESCE(SUM(total_tokens), 0) AS total_tokens
            FROM llm_logs WHERE conversation_id = :conversation_id");
        $Silian_stmt->execute([':conversation_id' => $Silian_conversationId]);
        $Silian_summary = $Silian_stmt->fetch(PDO::FETCH_ASSOC) ?: [];

        $Silian_modelStmt = $this->db->prepare("SELECT model FROM llm_logs
            WHERE conversation_id = :conversation_id
            ORDER BY created_at DESC, id DESC LIMIT 1");
        $Silian_modelStmt->execute([':conversation_id' => $Silian_conversationId]);

        return [
            'llm_calls' => (int) ($Silian_summary['llm_calls'] ?? 0),
            'total_tokens' => (int) ($Silian_summary['total_tokens'] ?? 0),
            'last_model' => $Silian_modelStmt->fetchColumn() ?: null,
        ];
    }

    /**
     * @param array<string,mixed> $payload
     */
    private function storeConversationEvent(string $Silian_action, array $Silian_logContext, array $Silian_payload): ?int
    {
        $Silian_conversationId = $this->normalizeConversationId(isset($Silian_payload['conversation_id']) ? (string) $Silian_payload['conversation_id'] : null);
        if ($Silian_conversationId === null) {
            return null;
        }

        $Silian_kind = $this->mapConversationActionToKind($Silian_action);
        $Silian_role = $this->mapConversationActionToRole($Silian_action);
        $Silian_content = isset($Silian_payload['visible_text']) ? trim((string) $Silian_payload['visible_text']) : null;
        $Silian_requestData = isset($Silian_payload['request_data']) && is_array($Silian_payload['request_data']) ? $Silian_payload['request_data'] : [];
        $Silian_status = isset($Silian_payload['status']) ? trim((string) $Silian_payload['status']) : 'success';
        $Silian_responseCode = isset($Silian_payload['response_code']) && is_numeric((string) $Silian_payload['response_code'])
            ? (int) $Silian_payload['response_code']
            : null;

        $Silian_metaJson = json_encode([
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'response_code' => $Silian_responseCode,
            'data' => $Silian_requestData,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        try {
            $this->ensureConversationRecord(
                $Silian_conversationId,
                isset($Silian_logContext['actor_id']) && is_numeric((string) $Silian_logContext['actor_id']) ? (int) $Silian_logContext['actor_id'] : null,
                $Silian_content,
                $Silian_kind,
                $Silian_role
            );

            $Silian_stmt = $this->db->prepare("INSERT INTO admin_ai_messages (
                conversation_id, kind, role, action, status, content, request_id, response_code, meta_json
            ) VALUES (
                :conversation_id, :kind, :role, :action, :status, :content, :request_id, :response_code, :meta_json
            )");
            $Silian_stmt->execute([
                ':conversation_id' => $Silian_conversationId,
                ':kind' => $Silian_kind,
                ':role' => $Silian_role,
                ':action' => $Silian_action,
                ':status' => $Silian_status !== '' ? $Silian_status : 'success',
                ':content' => $Silian_content !== '' ? $Silian_content : null,
                ':request_id' => $Silian_logContext['request_id'] ?? null,
                ':response_code' => $Silian_responseCode,
                ':meta_json' => $Silian_metaJson,
            ]);

            $Silian_messageId = (int) $this->db->lastInsertId();
            $this->touchConversationRecord($Silian_conversationId, $Silian_content, $Silian_kind, $Silian_role);
            return $Silian_messageId > 0 ? $Silian_messageId : null;
        } catch (\Throwable $Silian_exception) {
            $this->logger->warning('Failed to write admin AI conversation store record.', [
                'action' => $Silian_action,
                'conversation_id' => $Silian_conversationId,
                'error' => $Silian_exception->getMessage(),
            ]);
            return null;
        }
    }

    private function ensureConversationRecord(
        string $Silian_conversationId,
        ?int $Silian_adminId,
        ?string $Silian_content,
        string $Silian_kind,
        ?string $Silian_role
    ): void {
        $Silian_title = $Silian_kind === 'message' && $Silian_role === 'user' ? $this->buildPreview($Silian_content, 80) : null;
        $Silian_preview = $Silian_kind === 'message' ? $this->buildPreview($Silian_content, 120) : null;
        $Silian_existsStmt = $this->db->prepare("SELECT id FROM admin_ai_conversations WHERE conversation_id = :conversation_id LIMIT 1");
        $Silian_existsStmt->execute([':conversation_id' => $Silian_conversationId]);
        $Silian_exists = $Silian_existsStmt->fetchColumn();

        if ($Silian_exists === false) {
            $Silian_insert = $this->db->prepare("INSERT INTO admin_ai_conversations (
                conversation_id, admin_id, title, last_message_preview
            ) VALUES (
                :conversation_id, :admin_id, :title, :last_message_preview
            )");
            $Silian_insert->execute([
                ':conversation_id' => $Silian_conversationId,
                ':admin_id' => $Silian_adminId,
                ':title' => $Silian_title,
                ':last_message_preview' => $Silian_preview,
            ]);
            return;
        }

        $Silian_update = $this->db->prepare("UPDATE admin_ai_conversations
            SET
                admin_id = COALESCE(admin_id, :admin_id),
                title = COALESCE(title, :title),
                last_message_preview = COALESCE(:last_message_preview, last_message_preview),
                last_activity_at = CURRENT_TIMESTAMP
            WHERE conversation_id = :conversation_id");
        $Silian_update->execute([
            ':admin_id' => $Silian_adminId,
            ':title' => $Silian_title,
            ':last_message_preview' => $Silian_preview,
            ':conversation_id' => $Silian_conversationId,
        ]);
    }

    private function touchConversationRecord(string $Silian_conversationId, ?string $Silian_content, string $Silian_kind, ?string $Silian_role): void
    {
        $Silian_title = $Silian_kind === 'message' && $Silian_role === 'user' ? $this->buildPreview($Silian_content, 80) : null;
        $Silian_preview = $Silian_kind === 'message' ? $this->buildPreview($Silian_content, 120) : null;

        $Silian_stmt = $this->db->prepare("UPDATE admin_ai_conversations
            SET
                title = COALESCE(title, :title),
                last_message_preview = COALESCE(:last_message_preview, last_message_preview),
                last_activity_at = CURRENT_TIMESTAMP
            WHERE conversation_id = :conversation_id");
        $Silian_stmt->execute([
            ':title' => $Silian_title,
            ':last_message_preview' => $Silian_preview,
            ':conversation_id' => $Silian_conversationId,
        ]);
    }

    /**
     * @return array<int,array<string,mixed>>
     */
    private function fetchStoredConversationTimeline(string $Silian_conversationId): array
    {
        try {
            $Silian_stmt = $this->db->prepare("SELECT id, kind, role, action, status, content, request_id, response_code, meta_json, created_at
                FROM admin_ai_messages
                WHERE conversation_id = :conversation_id
                ORDER BY created_at ASC, id ASC");
            $Silian_stmt->execute([':conversation_id' => $Silian_conversationId]);

            $Silian_messages = [];
            foreach ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [] as $Silian_row) {
                $Silian_meta = $this->decodeJson($Silian_row['meta_json'] ?? null);
                $Silian_data = isset($Silian_meta['data']) && is_array($Silian_meta['data']) ? $Silian_meta['data'] : [];
                $Silian_proposal = null;
                if (($Silian_row['kind'] ?? null) === 'action_proposed') {
                    $Silian_proposal = [
                        'proposal_id' => (int) ($Silian_row['id'] ?? 0),
                        'action_name' => $Silian_data['action_name'] ?? null,
                        'label' => $Silian_data['label'] ?? null,
                        'summary' => $Silian_data['summary'] ?? ($Silian_row['content'] ?? null),
                        'payload' => $Silian_data['payload'] ?? null,
                        'risk_level' => $Silian_data['risk_level'] ?? null,
                        'status' => $Silian_row['status'] ?? null,
                    ];
                }

                $Silian_messages[] = [
                    'id' => (int) ($Silian_row['id'] ?? 0),
                    'kind' => $Silian_row['kind'] ?? 'event',
                    'role' => $Silian_row['role'] ?? 'assistant',
                    'action' => $Silian_row['action'] ?? null,
                    'status' => $Silian_row['status'] ?? null,
                    'content' => $Silian_row['content'] ?? null,
                    'proposal' => $Silian_proposal,
                    'meta' => [
                        'request_id' => $Silian_meta['request_id'] ?? ($Silian_row['request_id'] ?? null),
                        'response_code' => $Silian_meta['response_code'] ?? ($Silian_row['response_code'] !== null ? (int) $Silian_row['response_code'] : null),
                        'data' => $Silian_data,
                    ],
                    'created_at' => $Silian_row['created_at'] ?? null,
                ];
            }

            return $Silian_messages;
        } catch (\Throwable $Silian_exception) {
            $this->logger->warning('Failed to fetch admin AI conversation timeline from dedicated store.', [
                'conversation_id' => $Silian_conversationId,
                'error' => $Silian_exception->getMessage(),
            ]);
            return [];
        }
    }

    private function mapConversationActionToKind(string $Silian_action): string
    {
        return match (true) {
            $Silian_action === 'admin_ai_user_message', $Silian_action === 'admin_ai_assistant_message' => 'message',
            $Silian_action === 'admin_ai_action_proposed' => 'action_proposed',
            $Silian_action === 'admin_ai_tool_invocation' => 'tool',
            str_starts_with($Silian_action, 'admin_ai_action_') => 'action_event',
            default => 'event',
        };
    }

    private function mapConversationActionToRole(string $Silian_action): ?string
    {
        return match ($Silian_action) {
            'admin_ai_user_message' => 'user',
            'admin_ai_assistant_message' => 'assistant',
            default => null,
        };
    }

    private function normalizeConversationId(?string $Silian_conversationId): ?string
    {
        if (!is_string($Silian_conversationId)) {
            return null;
        }

        $Silian_conversationId = trim($Silian_conversationId);
        if ($Silian_conversationId === '') {
            return null;
        }

        return preg_match('/^[A-Za-z0-9._:-]{6,128}$/', $Silian_conversationId) === 1 ? $Silian_conversationId : null;
    }

    private function normalizeDateBoundary(mixed $Silian_value, bool $Silian_endOfDay): ?string
    {
        if ($Silian_value === null || $Silian_value === '') {
            return null;
        }

        if (!is_string($Silian_value)) {
            return null;
        }

        $Silian_value = trim($Silian_value);
        if ($Silian_value === '') {
            return null;
        }

        if (preg_match('/\d{2}:\d{2}:\d{2}$/', $Silian_value) === 1) {
            return $Silian_value;
        }

        return $Silian_value . ($Silian_endOfDay ? ' 23:59:59' : ' 00:00:00');
    }

    private function normalizeBooleanFilter(mixed $Silian_value): ?bool
    {
        if (is_bool($Silian_value)) {
            return $Silian_value;
        }

        if (is_numeric($Silian_value)) {
            return (int) $Silian_value === 1;
        }

        if (!is_string($Silian_value)) {
            return null;
        }

        return match (strtolower(trim($Silian_value))) {
            '1', 'true', 'yes', 'y' => true,
            '0', 'false', 'no', 'n' => false,
            default => null,
        };
    }

    private function buildPreview(?string $Silian_value, int $Silian_maxLength): ?string
    {
        if (!is_string($Silian_value)) {
            return null;
        }

        $Silian_trimmed = trim($Silian_value);
        if ($Silian_trimmed === '') {
            return null;
        }

        if (mb_strlen($Silian_trimmed, 'UTF-8') <= $Silian_maxLength) {
            return $Silian_trimmed;
        }

        return mb_substr($Silian_trimmed, 0, $Silian_maxLength, 'UTF-8') . '...';
    }

    /**
     * @return array<string,mixed>
     */
    private function decodeJson(mixed $Silian_raw): array
    {
        if (!is_string($Silian_raw) || $Silian_raw === '') {
            return [];
        }

        $Silian_decoded = json_decode($Silian_raw, true);
        return is_array($Silian_decoded) ? $Silian_decoded : [];
    }
}
