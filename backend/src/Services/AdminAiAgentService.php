<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Services\Ai\LlmClientInterface;
use CarbonTrack\Support\SyntheticRequestFactory;
use PDO;
use Psr\Log\LoggerInterface;

class AdminAiAgentService
{
    private const ALLOWED_CONTEXT_KEYS = [
        'activeRoute',
        'selectedRecordIds',
        'selectedUserId',
        'locale',
        'timezone',
    ];

    private string $model;
    private float $temperature;
    private int $maxTokens;
    private bool $enabled;

    /** @var array<string,mixed> */
    private array $agentConfig = [];

    /** @var array<string,array<string,mixed>> */
    private array $navigationTargets = [];

    /** @var array<string,array<string,mixed>> */
    private array $quickActions = [];

    /** @var array<string,array<string,mixed>> */
    private array $actionDefinitions = [];

    private AdminAiConversationStoreService $conversationStoreService;
    private AdminAiReadModelService $readModelService;
    private AdminAiWriteActionService $writeActionService;
    private AdminAiResultFormatterService $resultFormatterService;

    public function __construct(
        private PDO $db,
        private ?LlmClientInterface $client,
        private LoggerInterface $logger,
        array $Silian_config = [],
        ?array $Silian_commandConfig = null,
        private ?LlmLogService $llmLogService = null,
        private ?AuditLogService $auditLogService = null,
        private ?ErrorLogService $errorLogService = null,
        private ?StatisticsService $statisticsService = null,
        private ?MessageService $messageService = null,
        private ?BadgeService $badgeService = null,
        ?AdminAiReadModelService $Silian_readModelService = null,
        ?AdminAiWriteActionService $Silian_writeActionService = null,
        ?AdminAiConversationStoreService $Silian_conversationStoreService = null,
        ?AdminAiResultFormatterService $Silian_resultFormatterService = null
    ) {
        $this->model = (string) ($Silian_config['model'] ?? 'google/gemini-2.5-flash-lite');
        $this->temperature = isset($Silian_config['temperature']) ? (float) $Silian_config['temperature'] : 0.2;
        $this->maxTokens = isset($Silian_config['max_tokens']) ? (int) $Silian_config['max_tokens'] : 900;
        $this->enabled = $client !== null;
        $this->conversationStoreService = $Silian_conversationStoreService ?? new AdminAiConversationStoreService($db, $logger, $this->auditLogService);
        $this->readModelService = $Silian_readModelService ?? new AdminAiReadModelService($db, $this->statisticsService);
        $this->writeActionService = $Silian_writeActionService ?? new AdminAiWriteActionService($db, $this->auditLogService, $this->messageService, $this->badgeService);
        $this->resultFormatterService = $Silian_resultFormatterService ?? new AdminAiResultFormatterService();
        $this->loadCommandConfig($Silian_commandConfig ?? []);
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    /**
     * @param array<string,mixed> $context
     * @param array<string,mixed>|null $decision
     * @param array<string,mixed> $logContext
     * @return array<string,mixed>
     */
    public function chat(
        ?string $Silian_conversationId,
        ?string $Silian_message,
        array $Silian_context = [],
        ?array $Silian_decision = null,
        array $Silian_logContext = []
    ): array {
        if (!$this->enabled) {
            throw new \RuntimeException('AI agent service is disabled');
        }

        $Silian_normalizedContext = $this->normalizeContext($Silian_context);
        $Silian_normalizedMessage = trim((string) ($Silian_message ?? ''));
        $Silian_conversationId = $this->normalizeConversationId($Silian_conversationId) ?? $this->generateConversationId();

        if ($Silian_normalizedMessage === '' && $Silian_decision === null) {
            throw new \InvalidArgumentException('Either message or decision is required.');
        }

        if ($Silian_decision !== null) {
            return $this->handleDecision($Silian_conversationId, $Silian_decision, $Silian_normalizedContext, $Silian_logContext);
        }

        $this->conversationStoreService->logConversationEvent('admin_ai_user_message', $Silian_logContext, [
            'conversation_id' => $Silian_conversationId,
            'visible_text' => $Silian_normalizedMessage,
            'role' => 'user',
            'context' => $Silian_normalizedContext,
        ]);

        $Silian_turnNo = $this->conversationStoreService->getNextTurnNo($Silian_conversationId);
        $Silian_history = $this->conversationStoreService->fetchHistoryMessages(
            $Silian_conversationId,
            max(2, (int) ($this->agentConfig['max_history_messages'] ?? 12))
        );
        $Silian_payload = [
            'model' => $this->model,
            'temperature' => $this->temperature,
            'max_tokens' => $this->maxTokens,
            'messages' => $this->buildMessages($Silian_history, $Silian_normalizedMessage, $Silian_normalizedContext),
            'tools' => $this->buildTools(),
            'tool_choice' => 'auto',
        ];

        $Silian_startedAt = microtime(true);
        $Silian_llmLogId = null;
        try {
            $Silian_rawResponse = $this->client->createChatCompletion($Silian_payload);
            $Silian_llmLogId = $this->logLlmCall($Silian_payload['messages'], $Silian_rawResponse, $Silian_logContext, $Silian_normalizedContext, $Silian_conversationId, $Silian_turnNo, $Silian_startedAt);
        } catch (\Throwable $Silian_exception) {
            $this->logLlmFailure($Silian_payload['messages'], $Silian_logContext, $Silian_normalizedContext, $Silian_conversationId, $Silian_turnNo, $Silian_startedAt, $Silian_exception);
            $this->logError($Silian_exception, $Silian_logContext, [
                'conversation_id' => $Silian_conversationId,
                'message' => $Silian_normalizedMessage,
                'context' => $Silian_normalizedContext,
            ]);
            throw new \RuntimeException('LLM_UNAVAILABLE', 0, $Silian_exception);
        }

        $Silian_outcome = $this->processModelResponse($Silian_conversationId, $Silian_normalizedMessage, $Silian_normalizedContext, $Silian_logContext, $Silian_rawResponse);
        $this->updateLlmConversationSnapshot($Silian_llmLogId, $Silian_normalizedMessage, $Silian_outcome, $Silian_normalizedContext);

        if (($Silian_outcome['assistant_text'] ?? '') !== '') {
            $this->conversationStoreService->logConversationEvent('admin_ai_assistant_message', $Silian_logContext, [
                'conversation_id' => $Silian_conversationId,
                'visible_text' => $Silian_outcome['assistant_text'],
                'role' => 'assistant',
                'meta' => $Silian_outcome['meta'] ?? null,
                'suggestion' => $Silian_outcome['suggestion'] ?? null,
                'proposal' => $Silian_outcome['proposal'] ?? null,
                'result' => $Silian_outcome['result'] ?? null,
            ]);
        }

        return [
            'success' => true,
            'conversation_id' => $Silian_conversationId,
            'message' => $Silian_outcome['assistant_text'] ?? '',
            'metadata' => array_merge($Silian_outcome['metadata'] ?? [], [
                'timestamp' => gmdate(DATE_ATOM),
            ]),
            'conversation' => $this->getConversationDetail($Silian_conversationId),
        ];
    }

    /**
     * @param array<string,mixed> $filters
     * @return array<int,array<string,mixed>>
     */
    public function listConversations(array $Silian_filters = []): array
    {
        return $this->conversationStoreService->listConversations($Silian_filters);
    }


    /**
     * @return array<string,mixed>
     */
    public function getConversationDetail(string $Silian_conversationId): array
    {
        return $this->conversationStoreService->getConversationDetail($Silian_conversationId);
    }

    private function loadCommandConfig(array $Silian_commandConfig): void
    {
        $Silian_defaults = self::defaultCommandConfig();
        $Silian_provided = $Silian_commandConfig;

        $this->navigationTargets = $this->indexById($Silian_provided['navigationTargets'] ?? $Silian_defaults['navigationTargets']);
        $this->quickActions = $this->indexById($Silian_provided['quickActions'] ?? $Silian_defaults['quickActions']);
        $this->actionDefinitions = $this->indexById($Silian_provided['managementActions'] ?? $Silian_defaults['managementActions'], 'name');
        $this->agentConfig = is_array($Silian_provided['agent'] ?? null) ? $Silian_provided['agent'] : ($Silian_defaults['agent'] ?? []);
    }

    private function indexById(array $Silian_items, string $Silian_key = 'id'): array
    {
        $Silian_indexed = [];
        foreach ($Silian_items as $Silian_item) {
            if (!is_array($Silian_item)) {
                continue;
            }
            $Silian_identifier = $Silian_item[$Silian_key] ?? null;
            if (!is_string($Silian_identifier) || $Silian_identifier === '') {
                continue;
            }
            $Silian_indexed[$Silian_identifier] = $Silian_item;
        }

        return $Silian_indexed;
    }

    private static function defaultCommandConfig(): array
    {
        return [
            'agent' => [
                'max_history_messages' => 12,
                'default_confirmation_policy' => 'write_requires_confirmation',
            ],
            'navigationTargets' => [],
            'quickActions' => [],
            'managementActions' => [],
        ];
    }

    private function buildSystemPrompt(): string
    {
        $Silian_lines = [
            'You are the CarbonTrack admin AI assistant.',
            'Operate as a multi-turn administrative agent.',
            'Use tools whenever navigation, data lookup, or execution is required.',
            'Never claim a write action has executed before explicit confirmation.',
            'If required fields are missing, ask a concise follow-up question.',
            'Keep answers concise and operational.',
        ];

        if ($this->actionDefinitions !== []) {
            $Silian_lines[] = 'Available management actions:';
            foreach ($this->actionDefinitions as $Silian_name => $Silian_definition) {
                $Silian_lines[] = sprintf(
                    '- %s (%s): %s [risk=%s, confirm=%s]',
                    $Silian_name,
                    (string) ($Silian_definition['label'] ?? $Silian_name),
                    (string) ($Silian_definition['description'] ?? $Silian_definition['label'] ?? $Silian_name),
                    (string) ($Silian_definition['risk_level'] ?? 'read'),
                    !empty($Silian_definition['requires_confirmation']) ? 'yes' : 'no'
                );

                $Silian_keywords = array_values(array_filter(
                    is_array($Silian_definition['keywords'] ?? null) ? $Silian_definition['keywords'] : [],
                    static fn ($Silian_item): bool => is_string($Silian_item) && trim($Silian_item) !== ''
                ));
                if ($Silian_keywords !== []) {
                    $Silian_lines[] = '  keywords: ' . implode(', ', $Silian_keywords);
                }
            }
        }

        return implode("\n", $Silian_lines);
    }

    private function buildMessages(array $Silian_history, string $Silian_message, array $Silian_context): array
    {
        $Silian_messages = [[
            'role' => 'system',
            'content' => $this->buildSystemPrompt(),
        ]];

        foreach ($Silian_history as $Silian_entry) {
            $Silian_messages[] = [
                'role' => $Silian_entry['role'],
                'content' => $Silian_entry['content'],
            ];
        }

        if ($Silian_context !== []) {
            $Silian_messages[] = [
                'role' => 'system',
                'content' => 'Current admin UI context: ' . json_encode($Silian_context, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            ];
        }

        $Silian_messages[] = [
            'role' => 'user',
            'content' => $Silian_message,
        ];

        return $Silian_messages;
    }

    private function buildTools(): array
    {
        $Silian_tools = [];

        if ($this->navigationTargets !== []) {
            $Silian_tools[] = [
                'type' => 'function',
                'function' => [
                    'name' => 'navigate',
                    'description' => 'Suggest a navigation target in the admin UI.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'destination' => [
                                'type' => 'string',
                                'enum' => array_keys($this->navigationTargets),
                            ],
                            'parameters' => [
                                'type' => 'object',
                                'additionalProperties' => true,
                            ],
                        ],
                        'required' => ['destination'],
                    ],
                ],
            ];
        }

        if ($this->quickActions !== []) {
            $Silian_tools[] = [
                'type' => 'function',
                'function' => [
                    'name' => 'execute_shortcut',
                    'description' => 'Suggest a quick action in the admin UI.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'shortcut_id' => [
                                'type' => 'string',
                                'enum' => array_keys($this->quickActions),
                            ],
                        ],
                        'required' => ['shortcut_id'],
                    ],
                ],
            ];
        }

        if ($this->actionDefinitions !== []) {
            $Silian_tools[] = [
                'type' => 'function',
                'function' => [
                    'name' => 'manage_admin',
                    'description' => 'Run a read-only admin query or prepare a write action proposal.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'action' => [
                                'type' => 'string',
                                'enum' => array_keys($this->actionDefinitions),
                            ],
                            'payload' => [
                                'type' => 'object',
                                'additionalProperties' => true,
                            ],
                        ],
                        'required' => ['action'],
                    ],
                ],
            ];
        }

        return $Silian_tools;
    }

    private function processModelResponse(string $Silian_conversationId, string $Silian_userMessage, array $Silian_context, array $Silian_logContext, array $Silian_rawResponse): array
    {
        $Silian_choice = $Silian_rawResponse['choices'][0] ?? [];
        $Silian_message = $Silian_choice['message'] ?? [];
        $Silian_toolCalls = $Silian_message['tool_calls'] ?? [];
        $Silian_content = isset($Silian_message['content']) ? trim((string) $Silian_message['content']) : '';

        if ($Silian_toolCalls === []) {
            $Silian_fallback = $this->resolveKeywordFallbackAction($Silian_userMessage, $Silian_content);
            if ($Silian_fallback !== null) {
                return $this->handleManageAdminTool($Silian_conversationId, $Silian_fallback, $Silian_context, $Silian_logContext, $Silian_rawResponse);
            }

            return [
                'assistant_text' => $Silian_content !== '' ? $Silian_content : '我暂时无法完成这项操作，请再具体一些。',
                'metadata' => $this->extractMetadata($Silian_rawResponse),
            ];
        }

        $Silian_toolCall = $Silian_toolCalls[0];
        $Silian_functionName = (string) ($Silian_toolCall['function']['name'] ?? '');
        $Silian_arguments = json_decode((string) ($Silian_toolCall['function']['arguments'] ?? '{}'), true);
        if (!is_array($Silian_arguments)) {
            $Silian_arguments = [];
        }

        return match ($Silian_functionName) {
            'navigate' => $this->handleNavigationTool($Silian_arguments, $Silian_rawResponse),
            'execute_shortcut' => $this->handleShortcutTool($Silian_arguments, $Silian_rawResponse),
            'manage_admin' => $this->handleManageAdminTool($Silian_conversationId, $Silian_arguments, $Silian_context, $Silian_logContext, $Silian_rawResponse),
            default => [
                'assistant_text' => '我没有找到可执行的管理员工具，请换个说法再试一次。',
                'metadata' => $this->extractMetadata($Silian_rawResponse),
            ],
        };
    }

    private function handleNavigationTool(array $Silian_arguments, array $Silian_rawResponse): array
    {
        $Silian_destination = $Silian_arguments['destination'] ?? null;
        if (!is_string($Silian_destination) || !isset($this->navigationTargets[$Silian_destination])) {
            return [
                'assistant_text' => '我暂时无法定位到对应的后台页面。',
                'metadata' => $this->extractMetadata($Silian_rawResponse),
            ];
        }

        $Silian_target = $this->navigationTargets[$Silian_destination];
        $Silian_query = isset($Silian_arguments['parameters']) && is_array($Silian_arguments['parameters']) ? $Silian_arguments['parameters'] : [];

        return [
            'assistant_text' => sprintf('建议前往“%s”继续处理。', (string) ($Silian_target['label'] ?? $Silian_destination)),
            'suggestion' => [
                'type' => 'navigate',
                'label' => $Silian_target['label'] ?? $Silian_destination,
                'route' => $Silian_target['route'] ?? null,
                'query' => $Silian_query,
            ],
            'metadata' => $this->extractMetadata($Silian_rawResponse),
        ];
    }

    private function handleShortcutTool(array $Silian_arguments, array $Silian_rawResponse): array
    {
        $Silian_shortcutId = $Silian_arguments['shortcut_id'] ?? null;
        if (!is_string($Silian_shortcutId) || !isset($this->quickActions[$Silian_shortcutId])) {
            return [
                'assistant_text' => '我暂时无法定位到对应的快捷操作。',
                'metadata' => $this->extractMetadata($Silian_rawResponse),
            ];
        }

        $Silian_target = $this->quickActions[$Silian_shortcutId];
        return [
            'assistant_text' => sprintf('建议直接使用快捷操作“%s”。', (string) ($Silian_target['label'] ?? $Silian_shortcutId)),
            'suggestion' => [
                'type' => 'quick_action',
                'label' => $Silian_target['label'] ?? $Silian_shortcutId,
                'route' => $Silian_target['route'] ?? null,
                'query' => $Silian_target['query'] ?? [],
            ],
            'metadata' => $this->extractMetadata($Silian_rawResponse),
        ];
    }

    private function handleManageAdminTool(
        string $Silian_conversationId,
        array $Silian_arguments,
        array $Silian_context,
        array $Silian_logContext,
        array $Silian_rawResponse
    ): array {
        $Silian_actionName = $Silian_arguments['action'] ?? null;
        if (!is_string($Silian_actionName) || !isset($this->actionDefinitions[$Silian_actionName])) {
            return [
                'assistant_text' => '我暂时无法执行这个后台动作。',
                'metadata' => $this->extractMetadata($Silian_rawResponse),
            ];
        }

        $Silian_definition = $this->actionDefinitions[$Silian_actionName];
        $Silian_payload = isset($Silian_arguments['payload']) && is_array($Silian_arguments['payload']) ? $Silian_arguments['payload'] : [];
        $Silian_payload = $this->applyPayloadTemplate($Silian_definition, $Silian_payload, $Silian_context);
        $Silian_missing = $this->resolveMissingRequirements((array) ($Silian_definition['requires'] ?? []), $Silian_payload);

        if ($Silian_missing !== []) {
            return [
                'assistant_text' => '还缺少必要信息：' . implode('、', array_map(static fn (array $Silian_item) => (string) $Silian_item['field'], $Silian_missing)) . '。',
                'metadata' => $this->extractMetadata($Silian_rawResponse),
                'meta' => ['missing' => $Silian_missing],
            ];
        }

        $Silian_persistedPayload = $this->preparePersistedActionPayload($Silian_actionName, $Silian_payload);
        $Silian_toolLabel = (string) ($Silian_definition['label'] ?? $Silian_actionName);
        $Silian_toolSummary = $this->resultFormatterService->buildProposalSummary($Silian_definition, $Silian_payload);

        $this->conversationStoreService->logConversationEvent('admin_ai_tool_invocation', $Silian_logContext, [
            'conversation_id' => $Silian_conversationId,
            'visible_text' => sprintf('调用工具：%s', $Silian_toolLabel),
            'tool_name' => $Silian_actionName,
            'action_name' => $Silian_actionName,
            'label' => $Silian_toolLabel,
            'summary' => $Silian_toolSummary,
            'request_data' => [
                'action_name' => $Silian_actionName,
                'label' => $Silian_toolLabel,
                'summary' => $Silian_toolSummary,
                'payload' => $Silian_persistedPayload,
            ],
        ]);

        $Silian_isReadAction = ($Silian_definition['risk_level'] ?? 'read') === 'read' && empty($Silian_definition['requires_confirmation']);
        if ($Silian_isReadAction) {
            $Silian_result = $this->executeReadAction($Silian_actionName, $Silian_payload);
            return [
                'assistant_text' => $this->resultFormatterService->formatReadActionResult($Silian_actionName, $Silian_result),
                'result' => $Silian_result,
                'metadata' => $this->extractMetadata($Silian_rawResponse),
                'meta' => ['action_name' => $Silian_actionName],
            ];
        }

        $Silian_summary = $this->resultFormatterService->buildProposalSummary($Silian_definition, $Silian_payload);
        $Silian_proposalData = [
            'conversation_id' => $Silian_conversationId,
            'action_name' => $Silian_actionName,
            'label' => $Silian_definition['label'] ?? $Silian_actionName,
            'summary' => $Silian_summary,
            'payload' => $Silian_persistedPayload,
            'risk_level' => $Silian_definition['risk_level'] ?? 'write',
            'requires_confirmation' => true,
        ];

        $Silian_proposalId = $this->conversationStoreService->logConversationEvent('admin_ai_action_proposed', $Silian_logContext, [
            'conversation_id' => $Silian_conversationId,
            'visible_text' => $Silian_summary,
            'request_data' => $Silian_proposalData,
            'status' => 'pending',
        ]);

        return [
            'assistant_text' => sprintf("已整理待执行操作：%s\n如需执行，请确认。", $Silian_summary),
            'proposal' => array_merge($Silian_proposalData, [
                'proposal_id' => $Silian_proposalId,
                'status' => 'pending',
            ]),
            'metadata' => $this->extractMetadata($Silian_rawResponse),
            'meta' => ['action_name' => $Silian_actionName, 'proposal_id' => $Silian_proposalId],
        ];
    }

    private function handleDecision(string $Silian_conversationId, array $Silian_decision, array $Silian_context, array $Silian_logContext): array
    {
        $Silian_proposalId = isset($Silian_decision['proposal_id']) && is_numeric((string) $Silian_decision['proposal_id'])
            ? (int) $Silian_decision['proposal_id']
            : 0;
        $Silian_outcome = strtolower(trim((string) ($Silian_decision['outcome'] ?? '')));

        if ($Silian_proposalId <= 0 || !in_array($Silian_outcome, ['confirm', 'reject'], true)) {
            throw new \InvalidArgumentException('Invalid decision payload.');
        }

        $Silian_proposal = $this->conversationStoreService->findProposal($Silian_conversationId, $Silian_proposalId);
        if ($Silian_proposal === null) {
            throw new \RuntimeException('PROPOSAL_NOT_FOUND');
        }

        $Silian_actionName = (string) ($Silian_proposal['action_name'] ?? '');
        $Silian_payload = is_array($Silian_proposal['payload'] ?? null) ? $Silian_proposal['payload'] : [];

        if ($Silian_outcome === 'reject') {
            $this->conversationStoreService->updateProposalStatus($Silian_proposalId, 'failed', ['decision' => 'rejected']);
            $this->conversationStoreService->logConversationEvent('admin_ai_action_rejected', $Silian_logContext, [
                'conversation_id' => $Silian_conversationId,
                'proposal_id' => $Silian_proposalId,
                'action_name' => $Silian_actionName,
                'request_data' => $Silian_payload,
            ]);
            $Silian_assistantText = '已取消该待执行操作。你可以补充条件后重新下达指令。';
            $this->conversationStoreService->logConversationEvent('admin_ai_assistant_message', $Silian_logContext, [
                'conversation_id' => $Silian_conversationId,
                'visible_text' => $Silian_assistantText,
                'role' => 'assistant',
                'meta' => ['decision' => 'rejected', 'proposal_id' => $Silian_proposalId],
            ]);
            return [
                'success' => true,
                'conversation_id' => $Silian_conversationId,
                'message' => $Silian_assistantText,
                'metadata' => ['decision' => 'rejected', 'timestamp' => gmdate(DATE_ATOM)],
                'conversation' => $this->getConversationDetail($Silian_conversationId),
            ];
        }

            $this->conversationStoreService->logConversationEvent('admin_ai_action_confirmed', $Silian_logContext, [
            'conversation_id' => $Silian_conversationId,
            'proposal_id' => $Silian_proposalId,
            'action_name' => $Silian_actionName,
            'request_data' => $Silian_payload,
        ]);

        try {
            $Silian_executeLogContext = $Silian_logContext;
            $Silian_executeLogContext['conversation_id'] = $Silian_conversationId;
            $Silian_result = $this->executeWriteAction($Silian_actionName, $Silian_payload, $Silian_executeLogContext);
            $this->conversationStoreService->updateProposalStatus($Silian_proposalId, 'success', ['decision' => 'confirmed', 'result' => $Silian_result]);
            $this->conversationStoreService->logConversationEvent('admin_ai_action_executed', $Silian_logContext, [
                'conversation_id' => $Silian_conversationId,
                'proposal_id' => $Silian_proposalId,
                'action_name' => $Silian_actionName,
                'request_data' => $Silian_payload,
                'new_data' => $Silian_result,
            ]);
            $Silian_assistantText = $this->resultFormatterService->formatWriteActionResult($Silian_actionName, $Silian_result);
            $Silian_meta = ['decision' => 'confirmed', 'proposal_id' => $Silian_proposalId, 'result' => $Silian_result];
        } catch (\Throwable $Silian_exception) {
            $this->conversationStoreService->updateProposalStatus($Silian_proposalId, 'failed', ['decision' => 'confirmed', 'error' => $Silian_exception->getMessage()]);
            $this->conversationStoreService->logConversationEvent('admin_ai_action_failed', $Silian_logContext, [
                'conversation_id' => $Silian_conversationId,
                'proposal_id' => $Silian_proposalId,
                'action_name' => $Silian_actionName,
                'request_data' => $Silian_payload,
                'status' => 'failed',
            ]);
            $this->logError($Silian_exception, $Silian_logContext, [
                'conversation_id' => $Silian_conversationId,
                'proposal_id' => $Silian_proposalId,
                'action_name' => $Silian_actionName,
            ]);
            $Silian_assistantText = '执行该操作时出现错误，请稍后重试。';
            $Silian_meta = ['decision' => 'confirmed', 'proposal_id' => $Silian_proposalId, 'error' => $Silian_exception->getMessage()];
        }

        $this->conversationStoreService->logConversationEvent('admin_ai_assistant_message', $Silian_logContext, [
            'conversation_id' => $Silian_conversationId,
            'visible_text' => $Silian_assistantText,
            'role' => 'assistant',
            'meta' => $Silian_meta,
        ]);

        return [
            'success' => true,
            'conversation_id' => $Silian_conversationId,
            'message' => $Silian_assistantText,
            'metadata' => array_merge($Silian_meta, ['timestamp' => gmdate(DATE_ATOM)]),
            'conversation' => $this->getConversationDetail($Silian_conversationId),
        ];
    }

    private function applyPayloadTemplate(array $Silian_definition, array $Silian_payload, array $Silian_context): array
    {
        $Silian_template = isset($Silian_definition['api']['payloadTemplate']) && is_array($Silian_definition['api']['payloadTemplate'])
            ? $Silian_definition['api']['payloadTemplate']
            : [];
        $Silian_finalPayload = array_merge($Silian_template, $Silian_payload);

        $Silian_contextHints = isset($Silian_definition['contextHints']) && is_array($Silian_definition['contextHints'])
            ? $Silian_definition['contextHints']
            : [];
        if (in_array('selectedRecordIds', $Silian_contextHints, true) && empty($Silian_finalPayload['record_ids']) && !empty($Silian_context['selectedRecordIds'])) {
            $Silian_finalPayload['record_ids'] = array_values((array) $Silian_context['selectedRecordIds']);
        }
        if (
            in_array('selectedUserId', $Silian_contextHints, true)
            && empty($Silian_finalPayload['user_id'])
            && !empty($Silian_context['selectedUserId'])
            && is_numeric((string) $Silian_context['selectedUserId'])
        ) {
            $Silian_finalPayload['user_id'] = (int) $Silian_context['selectedUserId'];
        }
        if (isset($Silian_finalPayload['days']) && is_numeric($Silian_finalPayload['days'])) {
            $Silian_finalPayload['days'] = max(7, min(90, (int) $Silian_finalPayload['days']));
        }
        if (isset($Silian_finalPayload['limit']) && is_numeric($Silian_finalPayload['limit'])) {
            $Silian_finalPayload['limit'] = max(1, min(50, (int) $Silian_finalPayload['limit']));
        }

        return $Silian_finalPayload;
    }

    private function resolveMissingRequirements(array $Silian_requirements, array $Silian_payload): array
    {
        $Silian_missing = [];
        foreach ($Silian_requirements as $Silian_field) {
            if (is_array($Silian_field) && isset($Silian_field['anyOf']) && is_array($Silian_field['anyOf'])) {
                $Silian_hasValue = false;
                foreach ($Silian_field['anyOf'] as $Silian_candidate) {
                    if (!is_string($Silian_candidate) || $Silian_candidate === '') {
                        continue;
                    }
                    $Silian_value = $Silian_payload[$Silian_candidate] ?? null;
                    $Silian_hasCandidateValue = is_array($Silian_value)
                        ? count(array_filter($Silian_value, static fn ($Silian_item) => $Silian_item !== null && $Silian_item !== '' && $Silian_item !== [])) > 0
                        : ($Silian_value !== null && $Silian_value !== '');
                    if ($Silian_hasCandidateValue) {
                        $Silian_hasValue = true;
                        break;
                    }
                }

                if (!$Silian_hasValue) {
                    $Silian_missing[] = ['field' => (string) ($Silian_field['label'] ?? implode('_or_', $Silian_field['anyOf']))];
                }
                continue;
            }

            if (!is_string($Silian_field) || $Silian_field === '') {
                continue;
            }

            $Silian_value = $Silian_payload[$Silian_field] ?? null;
            $Silian_isMissing = is_array($Silian_value)
                ? count(array_filter($Silian_value, static fn ($Silian_item) => $Silian_item !== null && $Silian_item !== '' && $Silian_item !== [])) === 0
                : ($Silian_value === null || $Silian_value === '');

            if ($Silian_isMissing) {
                $Silian_missing[] = ['field' => $Silian_field];
            }
        }

        return $Silian_missing;
    }

    private function executeReadAction(string $Silian_actionName, array $Silian_payload): array
    {
        return $this->readModelService->execute($Silian_actionName, $Silian_payload);
    }

    private function executeWriteAction(string $Silian_actionName, array $Silian_payload, array $Silian_logContext): array
    {
        return $this->writeActionService->execute($Silian_actionName, $Silian_payload, $Silian_logContext);
    }

    private function logLlmCall(
        array $Silian_messages,
        array $Silian_rawResponse,
        array $Silian_logContext,
        array $Silian_context,
        string $Silian_conversationId,
        int $Silian_turnNo,
        float $Silian_startedAt
    ): ?int {
        if ($this->llmLogService === null) {
            return null;
        }

        $Silian_choice = $Silian_rawResponse['choices'][0] ?? [];
        $Silian_message = $Silian_choice['message'] ?? [];
        $Silian_responseId = $Silian_rawResponse['id'] ?? ($Silian_rawResponse['response_id'] ?? null);
        $Silian_responseText = isset($Silian_message['content']) ? (string) $Silian_message['content'] : json_encode($Silian_rawResponse, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);

        return $this->llmLogService->log([
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'actor_type' => $Silian_logContext['actor_type'] ?? 'admin',
            'actor_id' => $Silian_logContext['actor_id'] ?? null,
            'conversation_id' => $Silian_conversationId,
            'turn_no' => $Silian_turnNo,
            'source' => $Silian_logContext['source'] ?? '/admin/ai/chat',
            'model' => $Silian_rawResponse['model'] ?? $this->model,
            'prompt' => $Silian_messages,
            'response_raw' => $Silian_responseText,
            'response_id' => is_string($Silian_responseId) ? $Silian_responseId : null,
            'status' => 'success',
            'usage' => $Silian_rawResponse['usage'] ?? null,
            'latency_ms' => round((microtime(true) - $Silian_startedAt) * 1000, 2),
            'context' => [
                'conversation_context' => $Silian_context,
                'tool_calls' => $Silian_message['tool_calls'] ?? [],
            ],
        ]);
    }

    private function logLlmFailure(
        array $Silian_messages,
        array $Silian_logContext,
        array $Silian_context,
        string $Silian_conversationId,
        int $Silian_turnNo,
        float $Silian_startedAt,
        \Throwable $Silian_exception
    ): void {
        if ($this->llmLogService === null) {
            return;
        }

        $this->llmLogService->log([
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'actor_type' => $Silian_logContext['actor_type'] ?? 'admin',
            'actor_id' => $Silian_logContext['actor_id'] ?? null,
            'conversation_id' => $Silian_conversationId,
            'turn_no' => $Silian_turnNo,
            'source' => $Silian_logContext['source'] ?? '/admin/ai/chat',
            'model' => $this->model,
            'prompt' => $Silian_messages,
            'response_raw' => null,
            'status' => 'failed',
            'error_message' => $Silian_exception->getMessage(),
            'latency_ms' => round((microtime(true) - $Silian_startedAt) * 1000, 2),
            'context' => [
                'conversation_context' => $Silian_context,
            ],
        ]);
    }

    private function logError(\Throwable $Silian_exception, array $Silian_logContext, array $Silian_extra = []): void
    {
        if ($this->errorLogService === null) {
            return;
        }

        try {
            $Silian_request = SyntheticRequestFactory::fromContext(
                $Silian_logContext['source'] ?? '/admin/ai/chat',
                'POST',
                isset($Silian_logContext['request_id']) ? (string) $Silian_logContext['request_id'] : null,
                [],
                $Silian_extra
            );
            $this->errorLogService->logException($Silian_exception, $Silian_request, $Silian_extra);
        } catch (\Throwable $Silian_loggingError) {
            $this->logger->warning('Failed to persist admin AI error log.', [
                'error' => $Silian_loggingError->getMessage(),
                'original_error' => $Silian_exception->getMessage(),
            ]);
        }
    }

    /**
     * @param array<string,mixed> $outcome
     * @param array<string,mixed> $context
     */
    private function updateLlmConversationSnapshot(?int $Silian_llmLogId, string $Silian_userMessage, array $Silian_outcome, array $Silian_context): void
    {
        if ($Silian_llmLogId === null) {
            return;
        }

        try {
            $Silian_stmt = $this->db->prepare('SELECT context_json FROM llm_logs WHERE id = :id LIMIT 1');
            $Silian_stmt->execute([':id' => $Silian_llmLogId]);
            $Silian_existing = $this->decodeJson($Silian_stmt->fetchColumn() ?: null);
            $Silian_existing['conversation_context'] = $Silian_context;
            $Silian_existing['conversation_snapshot'] = array_filter([
                'user_message' => $Silian_userMessage !== '' ? $Silian_userMessage : null,
                'assistant_message' => isset($Silian_outcome['assistant_text']) && trim((string) $Silian_outcome['assistant_text']) !== ''
                    ? trim((string) $Silian_outcome['assistant_text'])
                    : null,
                'suggestion' => isset($Silian_outcome['suggestion']) && is_array($Silian_outcome['suggestion']) ? $Silian_outcome['suggestion'] : null,
                'proposal' => isset($Silian_outcome['proposal']) && is_array($Silian_outcome['proposal']) ? $Silian_outcome['proposal'] : null,
                'result' => isset($Silian_outcome['result']) && is_array($Silian_outcome['result']) ? $Silian_outcome['result'] : null,
                'meta' => isset($Silian_outcome['meta']) && is_array($Silian_outcome['meta']) ? $Silian_outcome['meta'] : null,
                'metadata' => isset($Silian_outcome['metadata']) && is_array($Silian_outcome['metadata']) ? $Silian_outcome['metadata'] : null,
            ], static fn ($Silian_value) => $Silian_value !== null && $Silian_value !== '');

            $Silian_update = $this->db->prepare('UPDATE llm_logs SET context_json = :context_json WHERE id = :id');
            $Silian_update->execute([
                ':context_json' => json_encode($Silian_existing, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                ':id' => $Silian_llmLogId,
            ]);
        } catch (\Throwable $Silian_exception) {
            $this->logger->warning('Failed to update admin AI LLM conversation snapshot.', [
                'llm_log_id' => $Silian_llmLogId,
                'error' => $Silian_exception->getMessage(),
            ]);
        }
    }

    private function extractMetadata(array $Silian_rawResponse): array
    {
        $Silian_choice = $Silian_rawResponse['choices'][0] ?? [];
        $Silian_finishReason = $Silian_choice['finish_reason'] ?? null;

        return array_filter([
            'model' => $Silian_rawResponse['model'] ?? $this->model,
            'usage' => is_array($Silian_rawResponse['usage'] ?? null) ? $Silian_rawResponse['usage'] : null,
            'finish_reason' => is_string($Silian_finishReason) ? $Silian_finishReason : null,
            'response_id' => isset($Silian_rawResponse['id']) && is_string($Silian_rawResponse['id']) ? $Silian_rawResponse['id'] : null,
        ], static fn ($Silian_value) => $Silian_value !== null);
    }

    private function normalizeContext(array $Silian_context): array
    {
        $Silian_normalized = [];
        foreach (self::ALLOWED_CONTEXT_KEYS as $Silian_key) {
            if (!array_key_exists($Silian_key, $Silian_context)) {
                continue;
            }
            $Silian_value = $Silian_context[$Silian_key];
            if (is_string($Silian_value)) {
                $Silian_trimmed = trim($Silian_value);
                if ($Silian_trimmed !== '') {
                    $Silian_normalized[$Silian_key] = $Silian_trimmed;
                }
                continue;
            }
            if (is_int($Silian_value) || is_float($Silian_value) || is_bool($Silian_value)) {
                $Silian_normalized[$Silian_key] = $Silian_value;
                continue;
            }
            if (is_array($Silian_value)) {
                $Silian_normalized[$Silian_key] = array_values(array_filter($Silian_value, static fn ($Silian_item) => !is_array($Silian_item) && !is_object($Silian_item) && trim((string) $Silian_item) !== ''));
            }
        }

        return $Silian_normalized;
    }

    /**
     * @return array<string,mixed>|null
     */
    private function resolveKeywordFallbackAction(string $Silian_userMessage, string $Silian_assistantContent = ''): ?array
    {
        if ($this->actionDefinitions === []) {
            return null;
        }

        $Silian_combined = trim($Silian_userMessage . ' ' . $Silian_assistantContent);
        if ($Silian_combined === '') {
            return null;
        }

        $Silian_normalizedText = $this->normalizeMatchText($Silian_combined);
        $Silian_bestAction = null;
        $Silian_bestScore = 0;

        foreach ($this->actionDefinitions as $Silian_name => $Silian_definition) {
            $Silian_score = $this->scoreActionKeywordMatch($Silian_normalizedText, $Silian_name, $Silian_definition);
            if ($Silian_score > $Silian_bestScore) {
                $Silian_bestScore = $Silian_score;
                $Silian_bestAction = $Silian_name;
            }
        }

        if ($Silian_bestAction === null || $Silian_bestScore < 2) {
            return null;
        }

        return [
            'action' => $Silian_bestAction,
            'payload' => [],
        ];
    }

    private function scoreActionKeywordMatch(string $Silian_normalizedText, string $Silian_name, array $Silian_definition): int
    {
        $Silian_score = 0;
        $Silian_terms = array_merge(
            [$Silian_name],
            [(string) ($Silian_definition['label'] ?? '')],
            [(string) ($Silian_definition['description'] ?? '')],
            is_array($Silian_definition['keywords'] ?? null) ? $Silian_definition['keywords'] : []
        );

        foreach ($Silian_terms as $Silian_term) {
            if (!is_string($Silian_term)) {
                continue;
            }

            $Silian_candidate = $this->normalizeMatchText($Silian_term);
            if ($Silian_candidate === '' || mb_strlen($Silian_candidate, 'UTF-8') < 2) {
                continue;
            }

            if (str_contains($Silian_normalizedText, $Silian_candidate)) {
                $Silian_score += mb_strlen($Silian_candidate, 'UTF-8') >= 6 ? 3 : 2;
            }
        }

        return $Silian_score;
    }

    private function normalizeMatchText(string $Silian_value): string
    {
        $Silian_lower = function_exists('mb_strtolower') ? mb_strtolower($Silian_value, 'UTF-8') : strtolower($Silian_value);
        $Silian_normalized = preg_replace('/[\s\-_]+/u', '', $Silian_lower);
        return is_string($Silian_normalized) ? $Silian_normalized : trim($Silian_lower);
    }

    private function normalizeConversationId(?string $Silian_conversationId): ?string
    {
        if (!is_string($Silian_conversationId)) {
            return null;
        }

        $Silian_normalized = trim($Silian_conversationId);
        if ($Silian_normalized === '') {
            return null;
        }

        return preg_match('/^[A-Za-z0-9._:-]{8,64}$/', $Silian_normalized) === 1 ? $Silian_normalized : null;
    }

    private function generateConversationId(): string
    {
        try {
            return 'admin-ai-' . bin2hex(random_bytes(8));
        } catch (\Throwable) {
            return 'admin-ai-' . str_replace('.', '', uniqid('', true));
        }
    }

    private function preparePersistedActionPayload(string $Silian_actionName, array $Silian_payload): array
    {
        if ($Silian_actionName !== 'create_user') {
            return $Silian_payload;
        }

        $Silian_sanitized = $Silian_payload;
        $Silian_password = isset($Silian_sanitized['password']) ? trim((string) $Silian_sanitized['password']) : '';
        if ($Silian_password !== '' && empty($Silian_sanitized['password_hash'])) {
            $Silian_passwordHash = password_hash($Silian_password, PASSWORD_DEFAULT);
            if (!is_string($Silian_passwordHash) || $Silian_passwordHash === '') {
                throw new \RuntimeException('Unable to hash password.');
            }
            $Silian_sanitized['password_hash'] = $Silian_passwordHash;
        }

        unset($Silian_sanitized['password']);
        if (!empty($Silian_sanitized['password_hash'])) {
            $Silian_sanitized['password_provided'] = true;
        }

        return $Silian_sanitized;
    }

    /**
     * @return array<string,mixed>
     */
    private function decodeJson($Silian_raw): array
    {
        if (!is_string($Silian_raw) || $Silian_raw === '') {
            return [];
        }

        $Silian_decoded = json_decode($Silian_raw, true);
        return is_array($Silian_decoded) ? $Silian_decoded : [];
    }

}
