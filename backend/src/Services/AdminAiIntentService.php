<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Support\SyntheticRequestFactory;
use CarbonTrack\Services\Ai\LlmClientInterface;
use JsonException;
use Psr\Log\LoggerInterface;

class AdminAiIntentService
{
    /**
     * @var array<string,array<string,mixed>>
     */
    private array $navigationTargets = [];

    /**
     * @var array<string,array<string,mixed>>
     */
    private array $quickActions = [];

    /**
     * @var array<string,array<string,mixed>>
     */
    private array $actionDefinitions = [];

    private const ALLOWED_CONTEXT_KEYS = [
        'activeRoute',
        'selectedRecordIds',
        'selectedUserId',
        'locale',
        'timezone',
    ];

    public function __construct(
        private ?LlmClientInterface $client,
        private LoggerInterface $logger,
        array $Silian_config = [],
        ?array $Silian_commandConfig = null,
        private ?LlmLogService $llmLogService = null,
        private ?AuditLogService $auditLogService = null,
        private ?ErrorLogService $errorLogService = null
    ) {
        $this->model = (string)($Silian_config['model'] ?? 'google/gemini-2.5-flash-lite');
        $this->temperature = isset($Silian_config['temperature']) ? (float)$Silian_config['temperature'] : 0.2;
        $this->maxTokens = isset($Silian_config['max_tokens']) ? (int)$Silian_config['max_tokens'] : 800;
        $this->enabled = $client !== null;
        $this->loadCommandConfig($Silian_commandConfig ?? []);
    }

    private function loadCommandConfig(array $Silian_commandConfig): void
    {
        $Silian_defaults = self::defaultCommandConfig();

        $Silian_provided = $Silian_commandConfig;
        $Silian_navigationTargets = $Silian_provided['navigationTargets'] ?? $Silian_defaults['navigationTargets'];
        $Silian_quickActions = $Silian_provided['quickActions'] ?? $Silian_defaults['quickActions'];
        $Silian_managementActions = $Silian_provided['managementActions'] ?? $Silian_defaults['managementActions'];

        $this->navigationTargets = $this->indexById($Silian_navigationTargets);
        $this->quickActions = $this->indexById($Silian_quickActions);
        $this->actionDefinitions = $this->indexById($Silian_managementActions, 'name');
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
            'navigationTargets' => [
                [
                    'id' => 'dashboard',
                    'label' => 'Admin Dashboard',
                    'route' => '/admin/dashboard',
                    'description' => 'Overall administration overview with key metrics and quick tasks.',
                    'keywords' => ['dashboard', 'overview', 'summary', '仪表盘', '总览', '首页'],
                ],
                [
                    'id' => 'users',
                    'label' => 'User Management',
                    'route' => '/admin/users',
                    'description' => 'Manage users, roles, points, and account status.',
                    'keywords' => ['user', 'account', '用户', '管理用户', '权限'],
                ],
                [
                    'id' => 'activities',
                    'label' => 'Activity Review',
                    'route' => '/admin/activities',
                    'description' => 'Review and moderate carbon reduction activity submissions.',
                    'keywords' => ['activity', 'review', '碳减排', '审批', '活动'],
                ],
                [
                    'id' => 'products',
                    'label' => 'Reward Store',
                    'route' => '/admin/products',
                    'description' => 'Manage redemption products, inventory and pricing.',
                    'keywords' => ['store', 'product', '奖励', '兑换'],
                ],
                [
                    'id' => 'badges',
                    'label' => 'Badge Management',
                    'route' => '/admin/badges',
                    'description' => 'Create, edit and award achievement badges.',
                    'keywords' => ['badge', '荣誉', '勋章', 'create badge', '颁发'],
                ],
                [
                    'id' => 'avatars',
                    'label' => 'Avatar Library',
                    'route' => '/admin/avatars',
                    'description' => 'Manage avatar assets and default selections.',
                    'keywords' => ['avatar', '头像'],
                ],
                [
                    'id' => 'exchanges',
                    'label' => 'Exchange Orders',
                    'route' => '/admin/exchanges',
                    'description' => 'Review redemption requests and update fulfilment status.',
                    'keywords' => ['order', 'exchange', '兑换申请', '物流'],
                ],
                [
                    'id' => 'broadcast',
                    'label' => 'Broadcast Center',
                    'route' => '/admin/broadcast',
                    'description' => 'Compose and send system broadcast messages.',
                    'keywords' => ['broadcast', '通知', 'announcement', '群发'],
                ],
                [
                    'id' => 'systemLogs',
                    'label' => 'System Logs',
                    'route' => '/admin/system-logs',
                    'description' => 'Inspect audit logs and request traces.',
                    'keywords' => ['log', '日志', '监控', '审计'],
                ],
                [
                    'id' => 'llmUsage',
                    'label' => 'LLM Usage',
                    'route' => '/admin/llm-usage',
                    'description' => 'Monitor LLM quota usage, tokens, and prompt audits.',
                    'keywords' => ['llm', 'ai usage', 'quota', '额度', '调用', '模型', '日志'],
                ],
            ],
            'quickActions' => [
                [
                    'id' => 'search-users',
                    'label' => 'Search users',
                    'description' => 'Focus the user search box for quick lookup.',
                    'routeId' => 'users',
                    'route' => '/admin/users',
                    'mode' => 'shortcut',
                    'query' => ['focus' => 'search'],
                    'keywords' => ['search user', 'find user', '查找用户', '搜用户'],
                ],
                [
                    'id' => 'create-badge',
                    'label' => 'Create new badge',
                    'description' => 'Open the badge creation modal.',
                    'routeId' => 'badges',
                    'route' => '/admin/badges',
                    'mode' => 'shortcut',
                    'query' => ['create' => '1'],
                    'keywords' => ['new badge', 'badge builder', '创建徽章'],
                ],
                [
                    'id' => 'pending-activities',
                    'label' => 'Review pending activities',
                    'description' => 'Filter activity review list to pending items.',
                    'routeId' => 'activities',
                    'route' => '/admin/activities',
                    'mode' => 'shortcut',
                    'query' => ['filter' => 'pending'],
                    'keywords' => ['待审批', 'pending', '审核活动'],
                ],
                [
                    'id' => 'compose-broadcast',
                    'label' => 'Compose broadcast',
                    'description' => 'Open the broadcast composer.',
                    'routeId' => 'broadcast',
                    'route' => '/admin/broadcast',
                    'mode' => 'shortcut',
                    'query' => ['compose' => '1'],
                    'keywords' => ['广播', 'announcement', 'new broadcast'],
                ],
            ],
            'managementActions' => [
                [
                    'name' => 'approve_carbon_records',
                    'label' => 'Approve carbon reduction records',
                    'description' => 'Approve one or more pending carbon reduction activity submissions by record id.',
                    'api' => [
                        'method' => 'PUT',
                        'path' => '/api/v1/admin/activities/review',
                        'payloadTemplate' => [
                            'action' => 'approve',
                            'record_ids' => [],
                            'review_note' => null,
                        ],
                    ],
                    'requires' => ['record_ids'],
                    'contextHints' => ['selectedRecordIds'],
                    'autoExecute' => true,
                ],
                [
                    'name' => 'reject_carbon_records',
                    'label' => 'Reject carbon reduction records',
                    'description' => 'Reject one or more pending carbon reduction records with an optional note.',
                    'api' => [
                        'method' => 'PUT',
                        'path' => '/api/v1/admin/activities/review',
                        'payloadTemplate' => [
                            'action' => 'reject',
                            'record_ids' => [],
                            'review_note' => null,
                        ],
                    ],
                    'requires' => ['record_ids'],
                    'contextHints' => ['selectedRecordIds'],
                    'autoExecute' => true,
                ],
            ],
        ];
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public function getDiagnostics(bool $Silian_performConnectivityCheck = false): array
    {
        $Silian_diagnostics = [
            'enabled' => $this->enabled,
            'configuration' => [
                'model' => $this->model,
                'temperature' => $this->temperature,
                'maxTokens' => $this->maxTokens,
            ],
            'client' => [
                'available' => $this->client !== null,
                'class' => $this->client ? $this->client::class : null,
            ],
            'commands' => [
                'navigationTargets' => count($this->navigationTargets),
                'quickActions' => count($this->quickActions),
                'managementActions' => count($this->actionDefinitions),
            ],
            'connectivity' => [
                'status' => $this->enabled ? 'not_checked' : 'skipped',
            ],
        ];

        if (!$Silian_performConnectivityCheck) {
            return $Silian_diagnostics;
        }

        if (!$this->enabled) {
            $Silian_diagnostics['connectivity'] = [
                'status' => 'skipped',
                'reason' => 'LLM client not configured',
            ];

            return $Silian_diagnostics;
        }

        try {
            $Silian_payload = [
                'model' => $this->model,
                'temperature' => 0.0,
                'max_tokens' => 1,
                'messages' => [
                    [
                        'role' => 'system',
                        'content' => 'You are a connectivity probe for diagnostics. Respond with OK.',
                    ],
                    [
                        'role' => 'user',
                        'content' => 'Ping',
                    ],
                ],
            ];

            $Silian_response = $this->client->createChatCompletion($Silian_payload);

            $Silian_diagnostics['connectivity'] = [
                'status' => 'ok',
                'model' => $Silian_response['model'] ?? null,
                'finish_reason' => $Silian_response['choices'][0]['finish_reason'] ?? null,
                'usage' => $Silian_response['usage'] ?? null,
            ];
            $this->logAudit('admin_ai_diagnostics_connectivity_checked', [
                'actor_type' => 'admin',
                'source' => '/admin/ai/diagnostics',
            ], [
                'request_data' => [
                    'status' => 'ok',
                    'model' => $Silian_response['model'] ?? null,
                ],
            ]);
        } catch (\Throwable $Silian_exception) {
            $this->logger->error('Admin AI diagnostics connectivity check failed', [
                'exception' => $Silian_exception::class,
                'message' => $Silian_exception->getMessage(),
            ]);
            $this->logAudit('admin_ai_diagnostics_connectivity_failed', [
                'actor_type' => 'admin',
                'source' => '/admin/ai/diagnostics',
            ], [
                'status' => 'failed',
                'request_data' => ['error' => $Silian_exception->getMessage()],
            ]);
            $this->logError($Silian_exception, [
                'actor_type' => 'admin',
                'source' => '/admin/ai/diagnostics',
            ], [
                'perform_check' => true,
            ]);

            $Silian_diagnostics['connectivity'] = [
                'status' => 'error',
                'exception' => $Silian_exception::class,
                'error' => $Silian_exception->getMessage(),
            ];
        }

        return $Silian_diagnostics;
    }

    public function analyzeIntent(string $Silian_query, array $Silian_context = [], array $Silian_logContext = []): array
    {
        if (!$this->enabled) {
            throw new \RuntimeException('AI intent service is disabled');
        }

        $Silian_tools = $this->buildTools();

        $Silian_payload = [
            'model' => $this->model,
            'temperature' => $this->temperature,
            'max_tokens' => $this->maxTokens,
            'messages' => $this->buildMessages($Silian_query, $Silian_context),
            'tools' => $Silian_tools,
            'tool_choice' => 'auto',
        ];

        $Silian_startedAt = microtime(true);
        try {
            $Silian_rawResponse = $this->client->createChatCompletion($Silian_payload);
            $this->logLlmCall($Silian_query, $Silian_rawResponse, $Silian_logContext, $Silian_context, $Silian_startedAt);
        } catch (\Throwable $Silian_e) {
            $this->logger->error('Admin AI intent call failed', [
                'exception' => $Silian_e::class,
                'message' => $Silian_e->getMessage(),
            ]);
            $this->logLlmFailure($Silian_query, $Silian_logContext, $Silian_context, $Silian_startedAt, $Silian_e);
            $this->logAudit('admin_ai_intent_service_failed', $Silian_logContext, [
                'status' => 'failed',
                'request_data' => [
                    'query_length' => mb_strlen($Silian_query),
                    'source' => $Silian_logContext['source'] ?? null,
                    'error' => $Silian_e->getMessage(),
                ],
            ]);
            $this->logError($Silian_e, $Silian_logContext, [
                'query' => $Silian_query,
                'context' => $this->filterContextForLogging($Silian_context),
            ]);
            throw new \RuntimeException('LLM_UNAVAILABLE', 0, $Silian_e);
        }

        $Silian_result = $this->processResponse($Silian_rawResponse, $Silian_query);
        $this->logAudit('admin_ai_intent_service_succeeded', $Silian_logContext, [
            'request_data' => [
                'query_length' => mb_strlen($Silian_query),
                'source' => $Silian_logContext['source'] ?? null,
                'intent_type' => $Silian_result['intent']['type'] ?? null,
                'model' => $Silian_rawResponse['model'] ?? $this->model,
            ],
        ]);

        return $Silian_result;
    }

    private function buildTools(): array
    {
        $Silian_tools = [];

        // Tool 1: navigate
        $Silian_navEnum = array_keys($this->navigationTargets);
        if (!empty($Silian_navEnum)) {
            $Silian_tools[] = [
                'type' => 'function',
                'function' => [
                    'name' => 'navigate',
                    'description' => 'Navigate to a specific administration page.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'destination' => [
                                'type' => 'string',
                                'enum' => $Silian_navEnum,
                                'description' => 'The ID of the page to navigate to.',
                            ],
                            'parameters' => [
                                'type' => 'object',
                                'description' => 'Optional query parameters for the navigation.',
                                'additionalProperties' => true,
                            ],
                        ],
                        'required' => ['destination'],
                    ],
                ],
            ];
        }

        // Tool 2: execute_shortcut
        $Silian_shortcutEnum = array_keys($this->quickActions);
        if (!empty($Silian_shortcutEnum)) {
            $Silian_tools[] = [
                'type' => 'function',
                'function' => [
                    'name' => 'execute_shortcut',
                    'description' => 'Execute a predefined quick action or shortcut.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'shortcut_id' => [
                                'type' => 'string',
                                'enum' => $Silian_shortcutEnum,
                                'description' => 'The ID of the shortcut to execute.',
                            ],
                        ],
                        'required' => ['shortcut_id'],
                    ],
                ],
            ];
        }

        // Tool 3: manage_records (generic for management actions)
        $Silian_actionEnum = array_keys($this->actionDefinitions);
        if (!empty($Silian_actionEnum)) {
            $Silian_tools[] = [
                'type' => 'function',
                'function' => [
                    'name' => 'manage_records',
                    'description' => 'Perform a management action on records.',
                    'parameters' => [
                        'type' => 'object',
                        'properties' => [
                            'action' => [
                                'type' => 'string',
                                'enum' => $Silian_actionEnum,
                                'description' => 'The name of the action to perform.',
                            ],
                            'payload' => [
                                'type' => 'object',
                                'description' => 'The payload required for the action (e.g., record_ids, review_note).',
                                'additionalProperties' => true,
                            ],
                        ],
                        'required' => ['action', 'payload'],
                    ],
                ],
            ];
        }

        return $Silian_tools;
    }

    private function buildMessages(string $Silian_query, array $Silian_context): array
    {
        $Silian_systemPrompt = $this->buildSystemPrompt();
        $Silian_userPayload = $this->buildUserPayload($Silian_query, $Silian_context);

        return [
            [
                'role' => 'system',
                'content' => $Silian_systemPrompt,
            ],
            [
                'role' => 'user',
                'content' => $Silian_userPayload,
            ],
        ];
    }

    private function buildSystemPrompt(): string
    {
        $Silian_navDescriptions = [];
        foreach ($this->navigationTargets as $Silian_id => $Silian_target) {
            $Silian_desc = $Silian_target['description'] ?? '';
            $Silian_navDescriptions[] = "- {$Silian_id}: {$Silian_desc} (Keywords: " . implode(', ', $Silian_target['keywords'] ?? []) . ")";
        }

        $Silian_shortcutDescriptions = [];
        foreach ($this->quickActions as $Silian_id => $Silian_action) {
            $Silian_desc = $Silian_action['description'] ?? '';
            $Silian_shortcutDescriptions[] = "- {$Silian_id}: {$Silian_desc} (Keywords: " . implode(', ', $Silian_action['keywords'] ?? []) . ")";
        }

        $Silian_actionDescriptions = [];
        foreach ($this->actionDefinitions as $Silian_name => $Silian_def) {
            $Silian_desc = $Silian_def['description'] ?? '';
            $Silian_actionDescriptions[] = "- {$Silian_name}: {$Silian_desc} (Requires: " . implode(', ', $Silian_def['requires'] ?? []) . ")";
        }

        $Silian_prompt = "You are CarbonTrack's admin AI command planner. Convert administrator natural language into precise instructions using the provided tools.\n\n";

        if (!empty($Silian_navDescriptions)) {
            $Silian_prompt .= "Navigation Targets:\n" . implode("\n", $Silian_navDescriptions) . "\n\n";
        }

        if (!empty($Silian_shortcutDescriptions)) {
            $Silian_prompt .= "Shortcuts:\n" . implode("\n", $Silian_shortcutDescriptions) . "\n\n";
        }

        if (!empty($Silian_actionDescriptions)) {
            $Silian_prompt .= "Management Actions:\n" . implode("\n", $Silian_actionDescriptions) . "\n\n";
        }

        $Silian_prompt .= "Rules:\n";
        $Silian_prompt .= "- Use 'navigate' for page navigation.\n";
        $Silian_prompt .= "- Use 'execute_shortcut' for quick actions.\n";
        $Silian_prompt .= "- Use 'manage_records' for data modification actions.\n";
        $Silian_prompt .= "- If the user's intent is unclear or not supported, do not call any tool.\n";
        $Silian_prompt .= "- Use Chinese labels/reasoning if the user query is Chinese.\n";

        return $Silian_prompt;
    }

    private function buildUserPayload(string $Silian_query, array $Silian_context): string
    {
        $Silian_filteredContext = array_intersect_key($Silian_context, array_flip(self::ALLOWED_CONTEXT_KEYS));

        return json_encode([
            'query' => $Silian_query,
            'context' => $Silian_filteredContext,
        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    }

    private function logLlmCall(string $Silian_prompt, array $Silian_rawResponse, array $Silian_logContext, array $Silian_context, float $Silian_startedAt): void
    {
        if (!$this->llmLogService) {
            return;
        }

        $Silian_durationMs = (microtime(true) - $Silian_startedAt) * 1000.0;
        $Silian_responseId = $Silian_rawResponse['id'] ?? ($Silian_rawResponse['metadata']['request_id'] ?? null);
        $Silian_contextPayload = $this->filterContextForLogging($Silian_context);

        $this->llmLogService->log([
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'actor_type' => $Silian_logContext['actor_type'] ?? 'admin',
            'actor_id' => $Silian_logContext['actor_id'] ?? null,
            'source' => $Silian_logContext['source'] ?? null,
            'model' => $Silian_rawResponse['model'] ?? $this->model,
            'prompt' => $Silian_prompt,
            'response_raw' => $Silian_rawResponse,
            'response_id' => $Silian_responseId,
            'status' => 'success',
            'error_message' => null,
            'usage' => $Silian_rawResponse['usage'] ?? null,
            'latency_ms' => round($Silian_durationMs, 2),
            'context' => $Silian_contextPayload ?: null,
        ]);
    }

    private function logLlmFailure(string $Silian_prompt, array $Silian_logContext, array $Silian_context, float $Silian_startedAt, \Throwable $Silian_error): void
    {
        if (!$this->llmLogService) {
            return;
        }

        $Silian_durationMs = (microtime(true) - $Silian_startedAt) * 1000.0;
        $Silian_contextPayload = $this->filterContextForLogging($Silian_context);

        $this->llmLogService->log([
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'actor_type' => $Silian_logContext['actor_type'] ?? 'admin',
            'actor_id' => $Silian_logContext['actor_id'] ?? null,
            'source' => $Silian_logContext['source'] ?? null,
            'model' => $this->model,
            'prompt' => $Silian_prompt,
            'response_raw' => null,
            'response_id' => null,
            'status' => 'failed',
            'error_message' => $Silian_error->getMessage(),
            'usage' => null,
            'latency_ms' => round($Silian_durationMs, 2),
            'context' => $Silian_contextPayload ?: null,
        ]);
    }

    private function filterContextForLogging(array $Silian_context): array
    {
        if (empty($Silian_context)) {
            return [];
        }

        $Silian_filtered = array_intersect_key($Silian_context, array_flip(self::ALLOWED_CONTEXT_KEYS));
        if (isset($Silian_filtered['selectedRecordIds']) && is_array($Silian_filtered['selectedRecordIds'])) {
            $Silian_ids = array_values(array_filter($Silian_filtered['selectedRecordIds'], fn ($Silian_item) => $Silian_item !== null && $Silian_item !== ''));
            $Silian_filtered['selectedRecordIds'] = array_slice($Silian_ids, 0, 20);
            if (count($Silian_ids) > 20) {
                $Silian_filtered['selectedRecordIds_truncated'] = true;
                $Silian_filtered['selectedRecordIds_total'] = count($Silian_ids);
            }
        }

        return $Silian_filtered;
    }

    private function extractIntentFromContent(?string $Silian_content, string $Silian_originalQuery, array $Silian_rawResponse): ?array
    {
        if (!is_string($Silian_content) || trim($Silian_content) === '') {
            return null;
        }

        $Silian_decoded = json_decode($Silian_content, true);
        if (!is_array($Silian_decoded) || !isset($Silian_decoded['intent']) || !is_array($Silian_decoded['intent'])) {
            return null;
        }

        $Silian_intentData = $Silian_decoded['intent'];
        $Silian_intentType = $Silian_intentData['type'] ?? null;
        $Silian_intent = null;

        switch ($Silian_intentType) {
            case 'navigate':
                $Silian_destination = $Silian_intentData['target']['routeId'] ?? ($Silian_intentData['target']['route'] ?? null);
                $Silian_intent = $this->createNavigationIntent([
                    'destination' => $Silian_destination,
                    'parameters' => $Silian_intentData['target']['query'] ?? [],
                ]);
                if ($Silian_intent === null) {
                    return $this->fallbackIntent($Silian_rawResponse);
                }
                break;
            case 'quick_action':
                $Silian_shortcutId = $Silian_intentData['target']['routeId'] ?? ($Silian_intentData['target']['id'] ?? null);
                $Silian_intent = $this->createShortcutIntent([
                    'shortcut_id' => $Silian_shortcutId,
                ]);
                if ($Silian_intent === null) {
                    return $this->fallbackIntent($Silian_rawResponse);
                }
                break;
            case 'action':
                $Silian_actionName = $Silian_intentData['action']['name'] ?? null;
                $Silian_payload = $Silian_intentData['action']['api']['payload'] ?? [];
                $Silian_intent = $this->createManagementIntent([
                    'action' => $Silian_actionName,
                    'payload' => $Silian_payload,
                ]);
                if ($Silian_intent === null) {
                    return $this->fallbackIntent($Silian_rawResponse);
                }
                break;
            case 'fallback':
                $Silian_heuristic = $this->guessNavigationIntent($Silian_originalQuery);
                if ($Silian_heuristic) {
                    return [
                        'intent' => $Silian_heuristic,
                        'alternatives' => [],
                        'metadata' => $this->extractMetadata($Silian_rawResponse),
                    ];
                }
                return $this->fallbackIntent($Silian_rawResponse);
        }

        if ($Silian_intent === null) {
            return null;
        }

        return [
            'intent' => $Silian_intent,
            'alternatives' => [],
            'metadata' => $this->extractMetadata($Silian_rawResponse),
        ];
    }

    private function processResponse(array $Silian_rawResponse, string $Silian_originalQuery): array
    {
        $Silian_choice = $Silian_rawResponse['choices'][0] ?? [];
        $Silian_message = $Silian_choice['message'] ?? [];
        $Silian_toolCalls = $Silian_message['tool_calls'] ?? [];
        $Silian_content = $Silian_message['content'] ?? null;

        if ($Silian_contentIntent = $this->extractIntentFromContent($Silian_content, $Silian_originalQuery, $Silian_rawResponse)) {
            return $Silian_contentIntent;
        }

        if (empty($Silian_toolCalls)) {
            // Try to parse JSON from content if tool_calls is empty
            if (is_string($Silian_content) && $Silian_content !== '') {
                $Silian_jsonContent = null;
                if (preg_match('/```(?:json)?\s*(\{.*?\})\s*```/s', $Silian_content, $Silian_matches)) {
                    $Silian_jsonContent = $Silian_matches[1];
                } elseif (preg_match('/^\s*\{.*\}\s*$/s', $Silian_content) || stripos($Silian_content, '{') !== false) {
                    $Silian_start = strpos($Silian_content, '{');
                    $Silian_end = strrpos($Silian_content, '}');
                    if ($Silian_start !== false && $Silian_end !== false && $Silian_end > $Silian_start) {
                        $Silian_jsonContent = substr($Silian_content, $Silian_start, $Silian_end - $Silian_start + 1);
                    }
                }

                if ($Silian_jsonContent !== null) {
                    try {
                        $Silian_data = json_decode($Silian_jsonContent, true, 512, JSON_THROW_ON_ERROR);
                        if (is_array($Silian_data) && isset($Silian_data['function'], $Silian_data['parameters'])) {
                            $Silian_func = $Silian_data['function'];
                            $Silian_args = $Silian_data['parameters'];
                            $Silian_intent = null;
                            if ($Silian_func === 'navigate') $Silian_intent = $this->createNavigationIntent($Silian_args);
                            elseif ($Silian_func === 'execute_shortcut') $Silian_intent = $this->createShortcutIntent($Silian_args);
                            elseif ($Silian_func === 'manage_records') $Silian_intent = $this->createManagementIntent($Silian_args);

                            if ($Silian_intent) {
                                return [
                                    'intent' => $Silian_intent,
                                    'alternatives' => [],
                                    'metadata' => $this->extractMetadata($Silian_rawResponse),
                                ];
                            }
                        }
                    } catch (\Throwable $Silian_e) {
                        // ignore json parse error
                    }
                }
            }

            // Fallback to heuristic if no tool called
            $Silian_heuristic = $this->guessNavigationIntent($Silian_originalQuery);
            if ($Silian_heuristic) {
                return [
                    'intent' => $Silian_heuristic,
                    'alternatives' => [],
                    'metadata' => $this->extractMetadata($Silian_rawResponse),
                ];
            }
            return $this->fallbackIntent($Silian_rawResponse);
        }

        // Process the first tool call (we assume single intent for now)
        $Silian_toolCall = $Silian_toolCalls[0];
        $Silian_functionName = $Silian_toolCall['function']['name'] ?? '';
        $Silian_arguments = json_decode($Silian_toolCall['function']['arguments'] ?? '{}', true);

        $Silian_intent = null;

        switch ($Silian_functionName) {
            case 'navigate':
                $Silian_intent = $this->createNavigationIntent($Silian_arguments);
                break;
            case 'execute_shortcut':
                $Silian_intent = $this->createShortcutIntent($Silian_arguments);
                break;
            case 'manage_records':
                $Silian_intent = $this->createManagementIntent($Silian_arguments);
                break;
        }

        if (!$Silian_intent) {
             return $this->fallbackIntent($Silian_rawResponse);
        }

        return [
            'intent' => $Silian_intent,
            'alternatives' => [], // We could potentially ask for multiple tool calls for alternatives
            'metadata' => $this->extractMetadata($Silian_rawResponse),
        ];
    }

    private function createNavigationIntent(array $Silian_args): ?array
    {
        $Silian_destination = $Silian_args['destination'] ?? null;
        if (!$Silian_destination || !isset($this->navigationTargets[$Silian_destination])) {
            return null;
        }

        $Silian_target = $this->navigationTargets[$Silian_destination];
        $Silian_query = $Silian_args['parameters'] ?? [];

        return [
            'type' => 'navigate',
            'label' => $Silian_target['label'],
            'confidence' => 0.9,
            'reasoning' => 'AI determined navigation intent via tool call.',
            'target' => [
                'routeId' => $Silian_destination,
                'route' => $Silian_target['route'],
                'mode' => 'navigation',
                'query' => $Silian_query,
            ],
            'missing' => [],
        ];
    }

    private function createShortcutIntent(array $Silian_args): ?array
    {
        $Silian_shortcutId = $Silian_args['shortcut_id'] ?? null;
        if (!$Silian_shortcutId || !isset($this->quickActions[$Silian_shortcutId])) {
            return null;
        }

        $Silian_action = $this->quickActions[$Silian_shortcutId];

        return [
            'type' => 'quick_action',
            'label' => $Silian_action['label'],
            'confidence' => 0.9,
            'reasoning' => 'AI determined shortcut intent via tool call.',
            'target' => [
                'routeId' => $Silian_action['routeId'] ?? $Silian_shortcutId,
                'route' => $Silian_action['route'] ?? null,
                'mode' => $Silian_action['mode'] ?? 'shortcut',
                'query' => $Silian_action['query'] ?? [],
            ],
            'missing' => [],
        ];
    }

    private function createManagementIntent(array $Silian_args): ?array
    {
        $Silian_actionName = $Silian_args['action'] ?? null;
        if (!$Silian_actionName || !isset($this->actionDefinitions[$Silian_actionName])) {
            return null;
        }

        $Silian_definition = $this->actionDefinitions[$Silian_actionName];
        $Silian_payload = $Silian_args['payload'] ?? [];

        // Merge with template
        $Silian_apiDefinition = $Silian_definition['api'] ?? [];
        $Silian_payloadTemplate = $Silian_apiDefinition['payloadTemplate'] ?? [];
        $Silian_finalPayload = $this->mergePayloadTemplate($Silian_payloadTemplate, $Silian_payload);

        // Check requirements
        $Silian_requires = $Silian_definition['requires'] ?? [];
        $Silian_missing = $this->resolveMissingRequirements($Silian_requires, $Silian_finalPayload);

        return [
            'type' => 'action',
            'label' => $Silian_definition['label'],
            'confidence' => 0.9,
            'reasoning' => 'AI determined management action via tool call.',
            'action' => [
                'name' => $Silian_actionName,
                'summary' => $Silian_definition['label'],
                'api' => [
                    'method' => $Silian_apiDefinition['method'] ?? 'POST',
                    'path' => $Silian_apiDefinition['path'] ?? '',
                    'payload' => $Silian_finalPayload,
                ],
                'autoExecute' => $Silian_definition['autoExecute'] ?? false,
                'requires' => $Silian_requires,
            ],
            'missing' => $Silian_missing,
        ];
    }

    private function extractMetadata(array $Silian_rawResponse): array
    {
        return [
            'model' => $Silian_rawResponse['model'] ?? $this->model,
            'usage' => $Silian_rawResponse['usage'] ?? null,
            'finish_reason' => $Silian_rawResponse['choices'][0]['finish_reason'] ?? null,
        ];
    }

    private function mergePayloadTemplate(array $Silian_template, array $Silian_payload): array
    {
        $Silian_result = $Silian_template;
        foreach ($Silian_payload as $Silian_key => $Silian_value) {
            $Silian_result[$Silian_key] = $Silian_value;
        }
        return $Silian_result;
    }

    private function resolveMissingRequirements(array $Silian_requirements, array $Silian_payload): array
    {
        $Silian_missing = [];
        foreach ($Silian_requirements as $Silian_field) {
            $Silian_value = $Silian_payload[$Silian_field] ?? null;
            $Silian_isMissing = false;
            if (is_array($Silian_value)) {
                $Silian_isMissing = count(array_filter($Silian_value, fn ($Silian_item) => $Silian_item !== null && $Silian_item !== '')) === 0;
            } else {
                $Silian_isMissing = $Silian_value === null || $Silian_value === '' || $Silian_value === [];
            }

            if ($Silian_isMissing) {
                $Silian_missing[] = [
                    'field' => $Silian_field,
                    'description' => sprintf('Provide a value for %s.', $Silian_field),
                ];
            }
        }
        return $Silian_missing;
    }

    private function fallbackIntent(array $Silian_rawResponse = []): array
    {
        return [
            'intent' => [
                'type' => 'fallback',
                'label' => '未能理解的指令',
                'confidence' => 0.0,
                'reasoning' => '无法从输入中提取明确的管理指令，请改用关键字搜索或再具体一些。',
                'missing' => [],
            ],
            'alternatives' => [],
            'metadata' => [
                'model' => $this->model,
                'usage' => $Silian_rawResponse['usage'] ?? null,
                'finish_reason' => 'fallback',
            ],
        ];
    }

    private function guessNavigationIntent(string $Silian_query): ?array
    {
        $Silian_normalizedQuery = trim(mb_strtolower($Silian_query));
        if ($Silian_normalizedQuery === '') {
            return null;
        }

        $Silian_best = null;
        $Silian_bestScore = 0;
        $Silian_matchedKeywords = [];

        foreach ($this->navigationTargets as $Silian_id => $Silian_definition) {
            $Silian_match = $this->computeDefinitionMatch($Silian_normalizedQuery, $Silian_definition);
            if ($Silian_match['score'] > $Silian_bestScore) {
                $Silian_bestScore = $Silian_match['score'];
                $Silian_best = [
                    'type' => 'navigate',
                    'definition' => $Silian_definition,
                    'routeId' => is_string($Silian_id) ? $Silian_id : ($Silian_definition['id'] ?? null),
                ];
                $Silian_matchedKeywords = $Silian_match['keywords'];
            }
        }

        foreach ($this->quickActions as $Silian_id => $Silian_definition) {
            $Silian_match = $this->computeDefinitionMatch($Silian_normalizedQuery, $Silian_definition);
            if ($Silian_match['score'] > $Silian_bestScore) {
                $Silian_bestScore = $Silian_match['score'];
                $Silian_best = [
                    'type' => 'quick_action',
                    'definition' => $Silian_definition,
                    'routeId' => is_string($Silian_id) ? $Silian_id : ($Silian_definition['id'] ?? null),
                ];
                $Silian_matchedKeywords = $Silian_match['keywords'];
            }
        }

        if ($Silian_best === null || $Silian_bestScore === 0) {
            return null;
        }

        $Silian_definition = $Silian_best['definition'];
        $Silian_route = $Silian_definition['route'] ?? null;
        if (!is_string($Silian_route) || $Silian_route === '') {
            return null;
        }

        $Silian_mode = $Silian_best['type'] === 'quick_action' ? ($Silian_definition['mode'] ?? 'shortcut') : 'navigation';
        $Silian_queryParams = [];
        if (isset($Silian_definition['query']) && is_array($Silian_definition['query'])) {
            $Silian_queryParams = $Silian_definition['query'];
        }

        $Silian_confidence = min(0.9, 0.45 + 0.12 * min($Silian_bestScore, 6));
        $Silian_reasoning = 'Matched keywords: ' . implode(', ', array_unique($Silian_matchedKeywords));

        return [
            'type' => $Silian_best['type'],
            'label' => $Silian_definition['label'] ?? ($Silian_best['routeId'] ?? 'Navigate'),
            'confidence' => round($Silian_confidence, 2),
            'reasoning' => $Silian_reasoning,
            'target' => [
                'routeId' => $Silian_best['routeId'],
                'route' => $Silian_route,
                'mode' => $Silian_mode,
                'query' => $Silian_queryParams,
            ],
            'missing' => [],
        ];
    }

    private function computeDefinitionMatch(string $Silian_normalizedQuery, array $Silian_definition): array
    {
        $Silian_score = 0;
        $Silian_matches = [];

        foreach ($this->collectDefinitionKeywords($Silian_definition) as $Silian_keyword) {
            $Silian_keyword = trim(mb_strtolower($Silian_keyword));
            if ($Silian_keyword === '') {
                continue;
            }
            if (mb_strpos($Silian_normalizedQuery, $Silian_keyword) !== false) {
                $Silian_score += max(1, (int) floor(mb_strlen($Silian_keyword) / 4));
                $Silian_matches[] = $Silian_keyword;
            }
        }

        return ['score' => $Silian_score, 'keywords' => $Silian_matches];
    }

    private function collectDefinitionKeywords(array $Silian_definition): array
    {
        $Silian_keywords = [];

        if (!empty($Silian_definition['keywords']) && is_array($Silian_definition['keywords'])) {
            foreach ($Silian_definition['keywords'] as $Silian_keyword) {
                if (is_string($Silian_keyword)) {
                    $Silian_keywords[] = $Silian_keyword;
                }
            }
        }

        foreach (['label', 'description'] as $Silian_field) {
            if (!empty($Silian_definition[$Silian_field]) && is_string($Silian_definition[$Silian_field])) {
                $Silian_keywords[] = $Silian_definition[$Silian_field];
            }
        }

        if (!empty($Silian_definition['route']) && is_string($Silian_definition['route'])) {
            $Silian_keywords[] = str_replace(['/admin/', '/'], ' ', $Silian_definition['route']);
        }

        return $Silian_keywords;
    }

    private function logAudit(string $Silian_action, array $Silian_logContext, array $Silian_context = []): void
    {
        if (!$this->auditLogService) {
            return;
        }

        try {
            $Silian_actorType = $Silian_logContext['actor_type'] ?? 'admin';
            $Silian_actorId = isset($Silian_logContext['actor_id']) && is_numeric((string) $Silian_logContext['actor_id'])
                ? (int) $Silian_logContext['actor_id']
                : null;
            $Silian_payload = array_merge([
                'request_id' => $Silian_logContext['request_id'] ?? null,
                'endpoint' => $Silian_logContext['source'] ?? '/admin/ai/intents',
                'request_method' => 'POST',
                'status' => 'success',
            ], $Silian_context);

            if ($Silian_actorType === 'admin') {
                $this->auditLogService->logAdminOperation($Silian_action, $Silian_actorId, 'admin_ai_service', $Silian_payload);
                return;
            }

            if ($Silian_actorType === 'user') {
                $this->auditLogService->logUserAction($Silian_actorId, $Silian_action, $Silian_payload);
                return;
            }

            $this->auditLogService->logSystemEvent($Silian_action, 'admin_ai_service', $Silian_payload);
        } catch (\Throwable $Silian_ignore) {
            // 审计日志失败不阻断主流程
        }
    }

    private function logError(\Throwable $Silian_exception, array $Silian_logContext, array $Silian_context = []): void
    {
        if (!$this->errorLogService) {
            return;
        }

        try {
            $Silian_request = SyntheticRequestFactory::fromContext(
                $Silian_logContext['source'] ?? '/admin/ai/intents',
                'POST',
                $Silian_logContext['request_id'] ?? null,
                [],
                $Silian_context
            );
            $this->errorLogService->logException($Silian_exception, $Silian_request, [
                'request_id' => $Silian_logContext['request_id'] ?? null,
                'actor_type' => $Silian_logContext['actor_type'] ?? 'admin',
            ]);
        } catch (\Throwable $Silian_ignore) {
            // swallow secondary logging failure
        }
    }

    private string $model;
    private float $temperature;
    private int $maxTokens;
    private bool $enabled;
}

