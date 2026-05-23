<?php

declare(strict_types=1);

namespace CarbonTrack\Controllers;

use CarbonTrack\Services\AdminAiIntentService;
use CarbonTrack\Services\AdminAiAgentService;
use CarbonTrack\Services\AdminAnnouncementAiException;
use CarbonTrack\Services\AdminAnnouncementAiService;
use CarbonTrack\Services\AdminAnnouncementAiUnavailableException;
use CarbonTrack\Services\AdminAiCommandRepository;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\ErrorLogService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Log\LoggerInterface;

class AdminAiController
{
    public function __construct(
        private AuthService $authService,
        private AdminAiIntentService $intentService,
        private AdminAnnouncementAiService $announcementAiService,
        private AdminAiCommandRepository $commandRepository,
        private AuditLogService $auditLogService,
        private ?ErrorLogService $errorLogService = null,
        private ?LoggerInterface $logger = null,
        private ?AdminAiAgentService $agentService = null
    ) {
    }

    public function chat(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'Admin access required',
                ], 403);
            }

            if ($this->agentService === null || !$this->agentService->isEnabled()) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'AI assistant is not configured. Please set LLM_API_KEY on the server.',
                    'code' => 'AI_DISABLED',
                ], 503);
            }

            $Silian_data = $Silian_request->getParsedBody();
            if (!is_array($Silian_data)) {
                $Silian_data = [];
            }

            $Silian_message = isset($Silian_data['message']) ? trim((string) $Silian_data['message']) : null;
            $Silian_conversationId = isset($Silian_data['conversation_id']) ? trim((string) $Silian_data['conversation_id']) : null;
            $Silian_context = isset($Silian_data['context']) && is_array($Silian_data['context']) ? $Silian_data['context'] : [];
            $Silian_decision = isset($Silian_data['decision']) && is_array($Silian_data['decision']) ? $Silian_data['decision'] : null;
            $Silian_source = isset($Silian_data['source']) && is_string($Silian_data['source']) ? trim($Silian_data['source']) : null;
            if (($Silian_source === null || $Silian_source === '') && isset($Silian_context['activeRoute']) && is_string($Silian_context['activeRoute'])) {
                $Silian_source = trim($Silian_context['activeRoute']);
            }

            if (($Silian_message === null || $Silian_message === '') && $Silian_decision === null) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'Either message or decision is required.',
                    'code' => 'INVALID_INPUT',
                ], 422);
            }

            $Silian_result = $this->agentService->chat($Silian_conversationId, $Silian_message, $Silian_context, $Silian_decision, [
                'request_id' => $Silian_request->getAttribute('request_id'),
                'actor_type' => 'admin',
                'actor_id' => $Silian_user['id'] ?? null,
                'source' => $Silian_source ?? $Silian_request->getUri()->getPath(),
            ]);

            $this->logAdminAudit('admin_ai_chat_completed', $Silian_user, $Silian_request, [
                'conversation_id' => $Silian_result['conversation_id'] ?? null,
                'data' => [
                    'has_decision' => $Silian_decision !== null,
                    'source' => $Silian_source ?? $Silian_request->getUri()->getPath(),
                ],
            ]);

            return $this->json($Silian_response, $Silian_result);
        } catch (\InvalidArgumentException $Silian_exception) {
            return $this->json($Silian_response, [
                'success' => false,
                'error' => $Silian_exception->getMessage(),
                'code' => 'INVALID_INPUT',
            ], 422);
        } catch (\RuntimeException $Silian_runtimeException) {
            if ($Silian_runtimeException->getMessage() === 'LLM_UNAVAILABLE') {
                $this->logException($Silian_runtimeException, $Silian_request, 'AdminAI chat unavailable');
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'AI provider is temporarily unavailable. Please try again later.',
                    'code' => 'AI_UNAVAILABLE',
                ], 503);
            }

            if ($Silian_runtimeException->getMessage() === 'PROPOSAL_NOT_FOUND') {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'Proposal not found for this conversation.',
                    'code' => 'PROPOSAL_NOT_FOUND',
                ], 404);
            }

            $this->logException($Silian_runtimeException, $Silian_request, 'AdminAI chat runtime error');
            return $this->json($Silian_response, [
                'success' => false,
                'error' => 'Failed to process the admin AI request',
                'code' => 'AI_CHAT_ERROR',
            ], 500);
        } catch (\Throwable $Silian_throwable) {
            $this->logException($Silian_throwable, $Silian_request, 'AdminAI chat unexpected error');
            return $this->json($Silian_response, [
                'success' => false,
                'error' => 'Unexpected server error',
                'code' => 'AI_CHAT_SERVER_ERROR',
            ], 500);
        }
    }

    public function workspace(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'Admin access required',
                ], 403);
            }

            $Silian_config = $this->commandRepository->getConfig();
            $Silian_agentConfig = isset($Silian_config['agent']) && is_array($Silian_config['agent']) ? $Silian_config['agent'] : [];
            $Silian_adminId = isset($Silian_user['id']) && is_numeric((string) $Silian_user['id']) ? (int) $Silian_user['id'] : null;
            $Silian_recentConversations = $this->agentService !== null
                ? $this->agentService->listConversations([
                    'limit' => 8,
                    'admin_id' => $Silian_adminId,
                ])
                : [];

            $Silian_data = [
                'assistant' => [
                    'chat_enabled' => $this->agentService?->isEnabled() ?? false,
                    'intent_enabled' => $this->intentService->isEnabled(),
                    'default_confirmation_policy' => isset($Silian_agentConfig['default_confirmation_policy']) && is_string($Silian_agentConfig['default_confirmation_policy'])
                        ? $Silian_agentConfig['default_confirmation_policy']
                        : null,
                    'max_history_messages' => isset($Silian_agentConfig['max_history_messages']) ? (int) $Silian_agentConfig['max_history_messages'] : null,
                    'max_auto_read_steps' => isset($Silian_agentConfig['max_auto_read_steps']) ? (int) $Silian_agentConfig['max_auto_read_steps'] : null,
                    'system_behavior' => array_values(array_filter(
                        isset($Silian_agentConfig['systemBehavior']) && is_array($Silian_agentConfig['systemBehavior']) ? $Silian_agentConfig['systemBehavior'] : [],
                        static fn ($Silian_item): bool => is_string($Silian_item) && trim($Silian_item) !== ''
                    )),
                    'commands_fingerprint' => $this->commandRepository->getFingerprint(),
                    'commands_source' => $this->commandRepository->getActivePath(),
                    'commands_last_modified' => $this->commandRepository->getLastModified(),
                ],
                'navigation_targets' => $this->normalizeWorkspaceNavigationTargets($Silian_config['navigationTargets'] ?? []),
                'quick_actions' => $this->normalizeWorkspaceQuickActions($Silian_config['quickActions'] ?? []),
                'management_actions' => $this->normalizeWorkspaceManagementActions($Silian_config['managementActions'] ?? []),
                'starter_prompts' => $this->buildWorkspaceStarterPrompts($Silian_config['managementActions'] ?? []),
                'recent_conversations' => $Silian_recentConversations,
            ];

            $this->logAdminAudit('admin_ai_workspace_viewed', $Silian_user, $Silian_request, [
                'data' => [
                    'recent_conversation_count' => count($Silian_recentConversations),
                    'chat_enabled' => $Silian_data['assistant']['chat_enabled'],
                    'intent_enabled' => $Silian_data['assistant']['intent_enabled'],
                ],
            ]);

            return $this->json($Silian_response, [
                'success' => true,
                'data' => $Silian_data,
            ]);
        } catch (\Throwable $Silian_throwable) {
            $this->logException($Silian_throwable, $Silian_request, 'AdminAI workspace error');
            return $this->json($Silian_response, [
                'success' => false,
                'error' => 'Failed to load the admin AI workspace',
                'code' => 'AI_WORKSPACE_ERROR',
            ], 500);
        }
    }

    public function conversations(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'Admin access required',
                ], 403);
            }

            if ($this->agentService === null) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'AI assistant is not configured.',
                    'code' => 'AI_DISABLED',
                ], 503);
            }

            $Silian_query = $Silian_request->getQueryParams();
            $Silian_items = $this->agentService->listConversations([
                'limit' => $Silian_query['limit'] ?? 20,
                'actor_id' => $Silian_query['actor_id'] ?? null,
                'admin_id' => $Silian_query['admin_id'] ?? null,
                'status' => $Silian_query['status'] ?? null,
                'model' => $Silian_query['model'] ?? null,
                'date_from' => $Silian_query['date_from'] ?? null,
                'date_to' => $Silian_query['date_to'] ?? null,
                'has_pending_action' => $Silian_query['has_pending_action'] ?? null,
                'conversation_id' => $Silian_query['conversation_id'] ?? null,
            ]);

            $this->logAdminAudit('admin_ai_conversations_viewed', $Silian_user, $Silian_request, [
                'data' => [
                    'limit' => $Silian_query['limit'] ?? 20,
                    'actor_id' => $Silian_query['actor_id'] ?? null,
                    'status' => $Silian_query['status'] ?? null,
                    'model' => $Silian_query['model'] ?? null,
                    'date_from' => $Silian_query['date_from'] ?? null,
                    'date_to' => $Silian_query['date_to'] ?? null,
                    'has_pending_action' => $Silian_query['has_pending_action'] ?? null,
                    'conversation_id' => $Silian_query['conversation_id'] ?? null,
                ],
            ]);

            return $this->json($Silian_response, [
                'success' => true,
                'data' => $Silian_items,
            ]);
        } catch (\Throwable $Silian_throwable) {
            $this->logException($Silian_throwable, $Silian_request, 'AdminAI conversation list error');
            return $this->json($Silian_response, [
                'success' => false,
                'error' => 'Failed to fetch AI conversation history',
                'code' => 'AI_CONVERSATIONS_ERROR',
            ], 500);
        }
    }

    public function conversationDetail(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'Admin access required',
                ], 403);
            }

            if ($this->agentService === null) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'AI assistant is not configured.',
                    'code' => 'AI_DISABLED',
                ], 503);
            }

            $Silian_conversationId = isset($Silian_args['conversation_id']) ? trim((string) $Silian_args['conversation_id']) : '';
            if ($Silian_conversationId === '') {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'conversation_id is required',
                    'code' => 'INVALID_CONVERSATION_ID',
                ], 422);
            }

            $Silian_detail = $this->agentService->getConversationDetail($Silian_conversationId);
            $this->logAdminAudit('admin_ai_conversation_viewed', $Silian_user, $Silian_request, [
                'conversation_id' => $Silian_conversationId,
                'data' => ['conversation_id' => $Silian_conversationId],
            ]);

            return $this->json($Silian_response, [
                'success' => true,
                'data' => $Silian_detail,
            ]);
        } catch (\InvalidArgumentException $Silian_exception) {
            return $this->json($Silian_response, [
                'success' => false,
                'error' => $Silian_exception->getMessage(),
                'code' => 'INVALID_CONVERSATION_ID',
            ], 422);
        } catch (\Throwable $Silian_throwable) {
            $this->logException($Silian_throwable, $Silian_request, 'AdminAI conversation detail error');
            return $this->json($Silian_response, [
                'success' => false,
                'error' => 'Failed to fetch AI conversation detail',
                'code' => 'AI_CONVERSATION_DETAIL_ERROR',
            ], 500);
        }
    }

    public function generateAnnouncementDraft(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'Admin access required',
                ], 403);
            }

            if (!$this->announcementAiService->isEnabled()) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'AI assistant is not configured. Please set LLM_API_KEY on the server.',
                    'code' => 'AI_DISABLED',
                ], 503);
            }

            $Silian_data = $Silian_request->getParsedBody();
            if (!is_array($Silian_data)) {
                $Silian_data = [];
            }

            $Silian_action = isset($Silian_data['action']) ? strtolower(trim((string) $Silian_data['action'])) : AdminAnnouncementAiService::ACTION_GENERATE;
            if (!in_array($Silian_action, AdminAnnouncementAiService::SUPPORTED_ACTIONS, true)) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'Unsupported action. Use generate, rewrite, compress, or convert.',
                    'code' => 'INVALID_ACTION',
                ], 422);
            }

            $Silian_title = trim((string) ($Silian_data['title'] ?? ''));
            $Silian_content = trim((string) ($Silian_data['content'] ?? ''));
            $Silian_instruction = trim((string) ($Silian_data['instruction'] ?? ''));
            $Silian_priority = strtolower(trim((string) ($Silian_data['priority'] ?? 'normal')));
            $Silian_contentFormat = strtolower(trim((string) ($Silian_data['content_format'] ?? 'html')));

            if (!in_array($Silian_priority, ['low', 'normal', 'high', 'urgent'], true)) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'Unsupported priority. Use low, normal, high, or urgent.',
                    'code' => 'INVALID_PRIORITY',
                ], 422);
            }

            if (!in_array($Silian_contentFormat, ['text', 'html'], true)) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'Unsupported content_format. Use text or html.',
                    'code' => 'INVALID_CONTENT_FORMAT',
                ], 422);
            }

            if ($Silian_title === '' && $Silian_content === '' && $Silian_instruction === '') {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'At least one of title, content, or instruction is required.',
                    'code' => 'INVALID_INPUT',
                ], 422);
            }

            $Silian_source = null;
            if (isset($Silian_data['source']) && is_string($Silian_data['source'])) {
                $Silian_source = trim($Silian_data['source']);
            }
            if ($Silian_source === '') {
                $Silian_source = null;
            }

            $Silian_logContext = [
                'request_id' => $Silian_request->getAttribute('request_id'),
                'actor_type' => 'admin',
                'actor_id' => $Silian_user['id'] ?? null,
                'source' => $Silian_source ?? $Silian_request->getUri()->getPath(),
            ];

            $Silian_result = $this->announcementAiService->generateDraft([
                'action' => $Silian_action,
                'title' => $Silian_title,
                'content' => $Silian_content,
                'instruction' => $Silian_instruction,
                'priority' => $Silian_priority,
                'content_format' => $Silian_contentFormat,
            ], $Silian_logContext);

            if (!($Silian_result['success'] ?? false)) {
                $this->logAdminAudit('admin_ai_announcement_draft_invalid', $Silian_user, $Silian_request, [
                    'data' => ['action' => $Silian_action, 'content_format' => $Silian_contentFormat],
                ], 'failed');
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'AI returned an invalid announcement draft. Please retry.',
                    'code' => 'AI_INVALID_RESPONSE',
                ], 502);
            }

            $this->logAdminAudit('admin_ai_announcement_draft_generated', $Silian_user, $Silian_request, [
                'data' => [
                    'action' => $Silian_action,
                    'priority' => $Silian_priority,
                    'content_format' => $Silian_contentFormat,
                    'source' => $Silian_source ?? $Silian_request->getUri()->getPath(),
                ],
            ]);

            return $this->json($Silian_response, [
                'success' => true,
                'data' => $Silian_result['result'] ?? null,
                'metadata' => array_merge($Silian_result['metadata'] ?? [], [
                    'timestamp' => gmdate(DATE_ATOM),
                ]),
            ]);
        } catch (AdminAnnouncementAiUnavailableException $Silian_runtimeException) {
            $this->logException($Silian_runtimeException, $Silian_request, 'AdminAI announcement draft unavailable');
            $this->logAdminAudit('admin_ai_announcement_draft_failed', $Silian_user ?? null, $Silian_request, [
                'data' => ['reason' => 'provider_unavailable'],
            ], 'failed');
            return $this->json($Silian_response, [
                'success' => false,
                'error' => 'AI provider is temporarily unavailable. Please try again later.',
                'code' => 'AI_UNAVAILABLE',
            ], 503);
        } catch (AdminAnnouncementAiException $Silian_runtimeException) {
            $this->logException($Silian_runtimeException, $Silian_request, 'AdminAI announcement draft runtime error');
            $this->logAdminAudit('admin_ai_announcement_draft_failed', $Silian_user ?? null, $Silian_request, [
                'data' => ['reason' => 'runtime_exception'],
            ], 'failed');
            return $this->json($Silian_response, [
                'success' => false,
                'error' => 'Failed to generate announcement draft',
                'code' => 'AI_ANNOUNCEMENT_ERROR',
            ], 500);
        } catch (\Throwable $Silian_throwable) {
            $this->logException($Silian_throwable, $Silian_request, 'AdminAI announcement draft unexpected error');
            $this->logAdminAudit('admin_ai_announcement_draft_failed', $Silian_user ?? null, $Silian_request, [
                'data' => ['reason' => 'unexpected_exception'],
            ], 'failed');
            return $this->json($Silian_response, [
                'success' => false,
                'error' => 'Unexpected server error',
                'code' => 'AI_ANNOUNCEMENT_SERVER_ERROR',
            ], 500);
        }
    }

    public function analyze(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'Admin access required',
                ], 403);
            }

            if (!$this->intentService->isEnabled()) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'AI assistant is not configured. Please set LLM_API_KEY on the server.',
                    'code' => 'AI_DISABLED',
                ], 503);
            }

            $Silian_data = $Silian_request->getParsedBody();
            if (!is_array($Silian_data)) {
                $Silian_data = [];
            }

            $Silian_query = isset($Silian_data['query']) ? trim((string)$Silian_data['query']) : '';
            if ($Silian_query === '') {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'Field "query" is required',
                    'code' => 'INVALID_QUERY',
                ], 422);
            }

            $Silian_context = [];
            if (isset($Silian_data['context']) && is_array($Silian_data['context'])) {
                $Silian_context = $Silian_data['context'];
            }

            $Silian_source = null;
            if (isset($Silian_data['source']) && is_string($Silian_data['source'])) {
                $Silian_source = trim($Silian_data['source']);
            } elseif (isset($Silian_context['activeRoute']) && is_string($Silian_context['activeRoute'])) {
                $Silian_source = trim($Silian_context['activeRoute']);
            }
            if ($Silian_source === '') {
                $Silian_source = null;
            }

            $Silian_mode = isset($Silian_data['mode']) && is_string($Silian_data['mode'])
                ? strtolower($Silian_data['mode'])
                : 'suggest';
            if (!in_array($Silian_mode, ['suggest', 'analyze'], true)) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'Unsupported mode. Use "suggest" or "analyze".',
                    'code' => 'INVALID_MODE',
                ], 422);
            }

            $Silian_logContext = [
                'request_id' => $Silian_request->getAttribute('request_id'),
                'actor_type' => 'admin',
                'actor_id' => $Silian_user['id'] ?? null,
                'source' => $Silian_source ?? $Silian_request->getUri()->getPath(),
            ];
            $Silian_result = $this->intentService->analyzeIntent($Silian_query, $Silian_context, $Silian_logContext);

            $Silian_commandsFingerprint = $this->commandRepository->getFingerprint();

            $Silian_payload = [
                'success' => true,
                'intent' => $Silian_result['intent'] ?? null,
                'alternatives' => $Silian_result['alternatives'] ?? [],
                'metadata' => array_merge($Silian_result['metadata'] ?? [], [
                    'mode' => $Silian_mode,
                    'timestamp' => gmdate(DATE_ATOM),
                    'commandsFingerprint' => $Silian_commandsFingerprint,
                ]),
                'capabilities' => [
                    'fingerprint' => $Silian_commandsFingerprint,
                    'source' => $this->commandRepository->getActivePath(),
                    'lastModified' => $this->commandRepository->getLastModified(),
                ],
            ];

            $this->logAdminAudit('admin_ai_intent_analyzed', $Silian_user, $Silian_request, [
                'data' => [
                    'mode' => $Silian_mode,
                    'source' => $Silian_source ?? $Silian_request->getUri()->getPath(),
                    'intent_type' => $Silian_result['intent']['type'] ?? null,
                ],
            ]);

            return $this->json($Silian_response, $Silian_payload);
        } catch (\RuntimeException $Silian_runtimeException) {
            if ($Silian_runtimeException->getMessage() === 'LLM_UNAVAILABLE') {
                $this->logException($Silian_runtimeException, $Silian_request, 'AdminAI: LLM unavailable');
                $this->logAdminAudit('admin_ai_intent_failed', $Silian_user ?? null, $Silian_request, [
                    'data' => ['reason' => 'provider_unavailable'],
                ], 'failed');
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'AI provider is temporarily unavailable. Please try again later.',
                    'code' => 'AI_UNAVAILABLE',
                ], 503);
            }

            $this->logException($Silian_runtimeException, $Silian_request, 'AdminAI runtime error');
            $this->logAdminAudit('admin_ai_intent_failed', $Silian_user ?? null, $Silian_request, [
                'data' => ['reason' => 'runtime_exception'],
            ], 'failed');
            return $this->json($Silian_response, [
                'success' => false,
                'error' => 'Failed to analyze the command',
                'code' => 'AI_ANALYZE_ERROR',
            ], 500);
        } catch (\Throwable $Silian_throwable) {
            $this->logException($Silian_throwable, $Silian_request, 'AdminAI unexpected error');
            $this->logAdminAudit('admin_ai_intent_failed', $Silian_user ?? null, $Silian_request, [
                'data' => ['reason' => 'unexpected_exception'],
            ], 'failed');
            return $this->json($Silian_response, [
                'success' => false,
                'error' => 'Unexpected server error',
                'code' => 'AI_INTENT_SERVER_ERROR',
            ], 500);
        }
    }

    public function diagnostics(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->json($Silian_response, [
                    'success' => false,
                    'error' => 'Admin access required',
                ], 403);
            }

            $Silian_queryParams = $Silian_request->getQueryParams();
            $Silian_performCheck = false;
            $Silian_flag = $Silian_queryParams['check'] ?? $Silian_queryParams['connectivity'] ?? $Silian_queryParams['ping'] ?? null;
            if (is_string($Silian_flag)) {
                $Silian_performCheck = in_array(strtolower($Silian_flag), ['1', 'true', 'yes', 'on'], true);
            } elseif (is_bool($Silian_flag)) {
                $Silian_performCheck = $Silian_flag;
            }

            $Silian_diagnostics = $this->intentService->getDiagnostics($Silian_performCheck);
            $Silian_diagnostics['commands']['fingerprint'] = $this->commandRepository->getFingerprint();
            $Silian_diagnostics['commands']['source'] = $this->commandRepository->getActivePath();
            $Silian_diagnostics['commands']['lastModified'] = $this->commandRepository->getLastModified();

            $this->logAdminAudit('admin_ai_diagnostics_viewed', $Silian_user, $Silian_request, [
                'data' => ['perform_check' => $Silian_performCheck],
            ]);

            return $this->json($Silian_response, [
                'success' => true,
                'diagnostics' => $Silian_diagnostics,
            ]);
        } catch (\Throwable $Silian_throwable) {
            $this->logException($Silian_throwable, $Silian_request, 'AdminAI diagnostics error');
            $this->logAdminAudit('admin_ai_diagnostics_failed', $Silian_user ?? null, $Silian_request, [
                'data' => ['reason' => 'unexpected_exception'],
            ], 'failed');

            return $this->json($Silian_response, [
                'success' => false,
                'error' => 'Failed to gather AI diagnostics',
                'code' => 'AI_DIAGNOSTICS_ERROR',
            ], 500);
        }
    }

    /**
     * @param array<string,mixed> $payload
     */
    private function json(Response $Silian_response, array $Silian_payload, int $Silian_status = 200): Response
    {
        $Silian_response->getBody()->write(json_encode($Silian_payload, JSON_UNESCAPED_UNICODE));

        return $Silian_response
            ->withHeader('Content-Type', 'application/json')
            ->withStatus($Silian_status);
    }

    /**
     * @param mixed $targets
     * @return array<int,array<string,mixed>>
     */
    private function normalizeWorkspaceNavigationTargets(mixed $Silian_targets): array
    {
        if (!is_array($Silian_targets)) {
            return [];
        }

        $Silian_items = [];
        foreach ($Silian_targets as $Silian_target) {
            if (!is_array($Silian_target)) {
                continue;
            }

            $Silian_route = isset($Silian_target['route']) && is_string($Silian_target['route']) ? trim($Silian_target['route']) : '';
            if ($Silian_route === '') {
                continue;
            }

            $Silian_items[] = [
                'id' => isset($Silian_target['id']) && is_string($Silian_target['id']) ? $Silian_target['id'] : $Silian_route,
                'label' => isset($Silian_target['label']) && is_string($Silian_target['label']) ? $Silian_target['label'] : $Silian_route,
                'description' => isset($Silian_target['description']) && is_string($Silian_target['description']) ? $Silian_target['description'] : null,
                'route' => $Silian_route,
            ];
        }

        return $Silian_items;
    }

    /**
     * @param mixed $actions
     * @return array<int,array<string,mixed>>
     */
    private function normalizeWorkspaceQuickActions(mixed $Silian_actions): array
    {
        if (!is_array($Silian_actions)) {
            return [];
        }

        $Silian_items = [];
        foreach ($Silian_actions as $Silian_action) {
            if (!is_array($Silian_action)) {
                continue;
            }

            $Silian_route = isset($Silian_action['route']) && is_string($Silian_action['route']) ? trim($Silian_action['route']) : '';
            if ($Silian_route === '') {
                continue;
            }

            $Silian_query = isset($Silian_action['query']) && is_array($Silian_action['query']) ? $Silian_action['query'] : [];
            $Silian_items[] = [
                'id' => isset($Silian_action['id']) && is_string($Silian_action['id']) ? $Silian_action['id'] : $Silian_route,
                'label' => isset($Silian_action['label']) && is_string($Silian_action['label']) ? $Silian_action['label'] : $Silian_route,
                'description' => isset($Silian_action['description']) && is_string($Silian_action['description']) ? $Silian_action['description'] : null,
                'route_id' => isset($Silian_action['routeId']) && is_string($Silian_action['routeId']) ? $Silian_action['routeId'] : null,
                'route' => $Silian_route,
                'mode' => isset($Silian_action['mode']) && is_string($Silian_action['mode']) ? $Silian_action['mode'] : 'shortcut',
                'query' => $Silian_query,
            ];
        }

        return $Silian_items;
    }

    /**
     * @param mixed $actions
     * @return array<int,array<string,mixed>>
     */
    private function normalizeWorkspaceManagementActions(mixed $Silian_actions): array
    {
        if (!is_array($Silian_actions)) {
            return [];
        }

        $Silian_items = [];
        foreach ($Silian_actions as $Silian_action) {
            if (!is_array($Silian_action)) {
                continue;
            }

            $Silian_name = isset($Silian_action['name']) && is_string($Silian_action['name']) ? trim($Silian_action['name']) : '';
            if ($Silian_name === '') {
                continue;
            }

            $Silian_items[] = [
                'name' => $Silian_name,
                'label' => isset($Silian_action['label']) && is_string($Silian_action['label']) ? $Silian_action['label'] : $Silian_name,
                'description' => isset($Silian_action['description']) && is_string($Silian_action['description']) ? $Silian_action['description'] : null,
                'risk_level' => isset($Silian_action['risk_level']) && is_string($Silian_action['risk_level']) ? $Silian_action['risk_level'] : null,
                'requires_confirmation' => !empty($Silian_action['requires_confirmation']),
                'context_hints' => array_values(array_filter(
                    isset($Silian_action['contextHints']) && is_array($Silian_action['contextHints']) ? $Silian_action['contextHints'] : [],
                    static fn ($Silian_item): bool => is_string($Silian_item) && trim($Silian_item) !== ''
                )),
                'requirements' => $this->normalizeWorkspaceRequirements($Silian_action['requires'] ?? []),
            ];
        }

        return $Silian_items;
    }

    /**
     * @param mixed $requirements
     * @return array<int,string>
     */
    private function normalizeWorkspaceRequirements(mixed $Silian_requirements): array
    {
        if (!is_array($Silian_requirements)) {
            return [];
        }

        $Silian_labels = [];
        foreach ($Silian_requirements as $Silian_requirement) {
            if (is_string($Silian_requirement) && trim($Silian_requirement) !== '') {
                $Silian_labels[] = trim($Silian_requirement);
                continue;
            }

            if (!is_array($Silian_requirement)) {
                continue;
            }

            if (isset($Silian_requirement['label']) && is_string($Silian_requirement['label']) && trim($Silian_requirement['label']) !== '') {
                $Silian_labels[] = trim($Silian_requirement['label']);
                continue;
            }

            $Silian_anyOf = isset($Silian_requirement['anyOf']) && is_array($Silian_requirement['anyOf']) ? $Silian_requirement['anyOf'] : [];
            $Silian_alternatives = array_values(array_filter($Silian_anyOf, static fn ($Silian_item): bool => is_string($Silian_item) && trim($Silian_item) !== ''));
            if ($Silian_alternatives !== []) {
                $Silian_labels[] = implode(' / ', $Silian_alternatives);
            }
        }

        return array_values(array_unique($Silian_labels));
    }

    /**
     * @param mixed $managementActions
     * @return array<int,array<string,string>>
     */
    private function buildWorkspaceStarterPrompts(mixed $Silian_managementActions): array
    {
        $Silian_actionNames = [];
        if (is_array($Silian_managementActions)) {
            foreach ($Silian_managementActions as $Silian_action) {
                if (is_array($Silian_action) && isset($Silian_action['name']) && is_string($Silian_action['name']) && trim($Silian_action['name']) !== '') {
                    $Silian_actionNames[] = trim($Silian_action['name']);
                }
            }
        }

        $Silian_actionNames = array_values(array_unique($Silian_actionNames));
        $Silian_prompts = [];
        $Silian_catalog = [
            'generate_admin_report' => [
                'id' => 'daily-ops-brief',
                'label' => '生成运营简报',
                'prompt' => '帮我总结最近 7 天后台运营、待处理事项和 AI 使用情况，给我一个简洁的管理简报。',
            ],
            'get_pending_carbon_records' => [
                'id' => 'pending-carbon-review',
                'label' => '梳理待审碳记录',
                'prompt' => '帮我查看当前待审核的碳记录，并按优先级告诉我先处理哪些。',
            ],
            'search_users' => [
                'id' => 'user-investigation',
                'label' => '定位用户问题',
                'prompt' => '帮我搜索用户，并告诉我排查用户账号问题时最先应该看哪些信息。',
            ],
            'get_exchange_orders' => [
                'id' => 'pending-exchanges',
                'label' => '处理兑换订单',
                'prompt' => '帮我查看当前待处理的兑换订单，并总结每单需要的下一步动作。',
            ],
            'search_system_logs' => [
                'id' => 'trace-request',
                'label' => '追踪异常请求',
                'prompt' => '帮我搜索最近的系统日志，并告诉我定位一次后台异常最有效的检索方式。',
            ],
            'get_llm_usage_analytics' => [
                'id' => 'llm-usage',
                'label' => '检查 AI 用量',
                'prompt' => '帮我总结最近 30 天管理员 AI 的会话量、模型分布和异常信号。',
            ],
            'create_user' => [
                'id' => 'create-admin-account',
                'label' => '创建账号模板',
                'prompt' => '我要创建一个新后台账号。先告诉我需要准备哪些字段，再帮我生成可执行的操作草案。',
            ],
        ];

        foreach ($Silian_actionNames as $Silian_actionName) {
            if (isset($Silian_catalog[$Silian_actionName])) {
                $Silian_prompts[] = $Silian_catalog[$Silian_actionName];
            }
            if (count($Silian_prompts) >= 6) {
                break;
            }
        }

        if ($Silian_prompts === []) {
            $Silian_prompts[] = [
                'id' => 'generic-admin-ai',
                'label' => '开始一个治理会话',
                'prompt' => '帮我看看当前后台最值得优先处理的任务，并给我一个可执行的下一步建议。',
            ];
        }

        return $Silian_prompts;
    }

    private function logAdminAudit(string $Silian_action, ?array $Silian_user, Request $Silian_request, array $Silian_context = [], string $Silian_status = 'success'): void
    {
        try {
            $Silian_adminId = isset($Silian_user['id']) && is_numeric((string)$Silian_user['id']) ? (int)$Silian_user['id'] : null;
            $this->auditLogService->logAdminOperation($Silian_action, $Silian_adminId, 'admin_ai', array_merge([
                'request_id' => $Silian_request->getAttribute('request_id'),
                'request_method' => $Silian_request->getMethod(),
                'endpoint' => (string)$Silian_request->getUri()->getPath(),
                'status' => $Silian_status,
                'conversation_id' => $Silian_context['conversation_id'] ?? null,
                'request_data' => $Silian_context['data'] ?? null,
            ], $Silian_context));
        } catch (\Throwable $Silian_ignore) {
            // 审计日志失败不阻断主流程
        }
    }

    private function logException(\Throwable $Silian_exception, Request $Silian_request, string $Silian_context): void
    {
        if ($this->errorLogService) {
            try {
                $this->errorLogService->logException($Silian_exception, $Silian_request, ['context' => $Silian_context]);
                return;
            } catch (\Throwable $Silian_loggingError) {
                // fall back to logger below
                if ($this->logger) {
                    $this->logger->error('Failed to log admin AI exception via ErrorLogService', [
                        'error' => $Silian_loggingError->getMessage(),
                    ]);
                }
            }
        }

        if ($this->logger) {
            $this->logger->error($Silian_context . ': ' . $Silian_exception->getMessage(), [
                'exception' => $Silian_exception::class,
            ]);
        } else {
            error_log(sprintf('%s: %s', $Silian_context, $Silian_exception->getMessage()));
        }
    }
}

