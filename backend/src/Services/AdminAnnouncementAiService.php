<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Support\SyntheticRequestFactory;
use CarbonTrack\Services\Ai\LlmClientInterface;
use Psr\Log\LoggerInterface;

class AdminAnnouncementAiService
{
    public const ACTION_GENERATE = 'generate';
    public const ACTION_REWRITE = 'rewrite';
    public const ACTION_COMPRESS = 'compress';
    public const ACTION_CONVERT = 'convert';

    /** @var array<int,string> */
    public const SUPPORTED_ACTIONS = [
        self::ACTION_GENERATE,
        self::ACTION_REWRITE,
        self::ACTION_COMPRESS,
        self::ACTION_CONVERT,
    ];

    private string $model;
    private float $temperature;
    private int $maxTokens;
    private bool $enabled;

    public function __construct(
        private ?LlmClientInterface $client,
        private LoggerInterface $logger,
        array $Silian_config = [],
        private ?LlmLogService $llmLogService = null,
        private ?AuditLogService $auditLogService = null,
        private ?ErrorLogService $errorLogService = null
    ) {
        $this->model = (string) ($Silian_config['model'] ?? 'google/gemini-2.5-flash-lite');
        $this->temperature = isset($Silian_config['temperature']) ? (float) $Silian_config['temperature'] : 0.2;
        $this->maxTokens = isset($Silian_config['max_tokens']) ? (int) $Silian_config['max_tokens'] : 1800;
        $this->enabled = $client !== null;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    public static function normalizeAction(mixed $Silian_value): string
    {
        $Silian_normalized = is_string($Silian_value) ? strtolower(trim($Silian_value)) : '';

        return in_array($Silian_normalized, self::SUPPORTED_ACTIONS, true)
            ? $Silian_normalized
            : self::ACTION_GENERATE;
    }

    /**
     * @param array<string,mixed> $input
     * @param array<string,mixed> $logContext
     * @return array<string,mixed>
     */
    public function generateDraft(array $Silian_input, array $Silian_logContext = []): array
    {
        if (!$this->enabled) {
            throw new AdminAnnouncementAiException('AI service is disabled');
        }

        $Silian_normalized = $this->normalizeInput($Silian_input);
        $Silian_messages = $this->buildMessages($Silian_normalized);
        $Silian_promptTranscript = $this->buildPromptTranscript($Silian_messages);

        $Silian_payload = [
            'model' => $this->model,
            'temperature' => $this->temperature,
            'max_tokens' => $this->maxTokens,
            'messages' => $Silian_messages,
            'response_format' => ['type' => 'json_object'],
        ];

        $Silian_startedAt = microtime(true);

        try {
            $Silian_rawResponse = $this->client->createChatCompletion($Silian_payload);
            $this->logLlmCall($Silian_promptTranscript, $Silian_rawResponse, $Silian_logContext, $Silian_normalized, $Silian_startedAt);
        } catch (\Throwable $Silian_e) {
            $this->logger->error('Admin announcement AI call failed', [
                'exception' => $Silian_e::class,
                'message' => $Silian_e->getMessage(),
            ]);
            $this->logLlmFailure($Silian_promptTranscript, $Silian_logContext, $Silian_normalized, $Silian_startedAt, $Silian_e);
            $this->logAudit('admin_announcement_ai_service_failed', $Silian_logContext, [
                'status' => 'failed',
                'request_data' => [
                    'action' => $Silian_normalized['action'],
                    'priority' => $Silian_normalized['priority'],
                    'content_format' => $Silian_normalized['content_format'],
                    'error' => $Silian_e->getMessage(),
                ],
            ]);
            $this->logError($Silian_e, $Silian_logContext, $Silian_normalized);
            throw new AdminAnnouncementAiUnavailableException('LLM_UNAVAILABLE', 0, $Silian_e);
        }

        $Silian_result = $this->processResponse($Silian_rawResponse, $Silian_normalized);
        $this->logAudit('admin_announcement_ai_service_succeeded', $Silian_logContext, [
            'request_data' => [
                'action' => $Silian_normalized['action'],
                'priority' => $Silian_normalized['priority'],
                'content_format' => $Silian_normalized['content_format'],
                'model' => $Silian_rawResponse['model'] ?? $this->model,
                'success' => $Silian_result['success'] ?? false,
            ],
        ]);

        return $Silian_result;
    }

    /**
     * @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    private function normalizeInput(array $Silian_input): array
    {
        return [
            'action' => self::normalizeAction($Silian_input['action'] ?? null),
            'title' => trim((string) ($Silian_input['title'] ?? '')),
            'content' => trim((string) ($Silian_input['content'] ?? '')),
            'instruction' => trim((string) ($Silian_input['instruction'] ?? '')),
            'priority' => $this->normalizePriority($Silian_input['priority'] ?? null),
            'content_format' => $this->normalizeContentFormat($Silian_input['content_format'] ?? null),
        ];
    }

    private function normalizePriority(mixed $Silian_value): string
    {
        $Silian_normalized = is_string($Silian_value) ? strtolower(trim($Silian_value)) : 'normal';
        return in_array($Silian_normalized, ['low', 'normal', 'high', 'urgent'], true) ? $Silian_normalized : 'normal';
    }

    private function normalizeContentFormat(mixed $Silian_value): string
    {
        $Silian_normalized = is_string($Silian_value) ? strtolower(trim($Silian_value)) : 'html';
        return in_array($Silian_normalized, ['text', 'html'], true) ? $Silian_normalized : 'html';
    }

    /**
     * @param array<string,mixed> $input
     * @return array<int,array<string,string>>
     */
    private function buildMessages(array $Silian_input): array
    {
        return [
            ['role' => 'system', 'content' => $this->buildSystemPrompt()],
            ['role' => 'user', 'content' => $this->buildUserPrompt($Silian_input)],
        ];
    }

    private function buildSystemPrompt(): string
    {
        return implode("\n", [
            'You are an announcement HTML editor for an admin broadcast system.',
            'You produce SAFE, SANITIZED-FRIENDLY announcement drafts that render well in both a web inbox and an email preview.',
            '',
            'HTML profile constraints:',
            '- Allowed tags: h1, h2, h3, h4, p, br, strong, em, u, ul, ol, li, blockquote, code, pre, table, thead, tbody, tr, th, td, a, hr',
            '- Allowed attributes: href, title, target, rel, scope, colspan, rowspan, align',
            '- No <html>, <head>, <body>, <style>, <script>, <iframe>, <img>, <video>, <audio>, <form>, classes, inline styles, or event handlers.',
            '- Use <pre><code>...</code></pre> for code blocks.',
            '- Links must be descriptive and use absolute https:// URLs when necessary.',
            '- Do not invent facts, dates, discounts, deadlines, promises, or policies that are not present in the input.',
            '- If information is missing, keep the draft generic and honest instead of hallucinating details.',
            '',
            'Output rules:',
            '- Return a valid JSON object only.',
            '- Do not use Markdown fences.',
            '- JSON schema:',
            '{',
            '  "title": "string",',
            '  "content": "string"',
            '}',
            '- "content" must be the final HTML fragment only.',
            '- "title" should be concise, professional, and ready to use as the broadcast title.',
        ]);
    }

    /**
     * @param array<string,mixed> $input
     */
    private function buildUserPrompt(array $Silian_input): string
    {
        $Silian_lines = array_merge(
            $this->buildIntentInstructions((string) $Silian_input['action'], ((string) $Silian_input['content']) !== ''),
            [
                '',
                'Project constraints:',
                '- The HTML result must survive sanitizer cleanup without losing key meaning.',
                '- Prefer headings, paragraphs, lists, blockquotes, code blocks, simple tables, and safe links.',
                '- Match urgency to the provided priority without exaggeration.',
                '',
                'Context:',
                'Title: ' . (((string) $Silian_input['title']) !== '' ? (string) $Silian_input['title'] : '(untitled announcement)'),
                'Priority: ' . (string) $Silian_input['priority'],
                'Current editor content format: ' . (string) $Silian_input['content_format'],
                'Current draft / notes:',
                ((string) $Silian_input['content']) !== '' ? (string) $Silian_input['content'] : '(no existing content yet)',
            ]
        );

        if (((string) $Silian_input['instruction']) !== '') {
            $Silian_lines[] = '';
            $Silian_lines[] = 'Additional admin request:';
            $Silian_lines[] = (string) $Silian_input['instruction'];
        }

        $Silian_lines[] = '';
        $Silian_lines[] = 'Return only the JSON object.';

        return implode("\n", $Silian_lines);
    }

    /**
     * @return array<int,string>
     */
    private function buildIntentInstructions(string $Silian_action, bool $Silian_hasContent): array
    {
        return match ($Silian_action) {
            self::ACTION_REWRITE => [
                'Task: polish and rewrite the existing announcement draft.',
                '- Preserve all confirmed facts.',
                '- Improve clarity, structure, scannability, and trustworthiness.',
            ],
            self::ACTION_COMPRESS => [
                'Task: compress the existing announcement draft.',
                '- Keep only essential actionable information.',
                '- Preserve dates, deadlines, and required user actions if present.',
            ],
            self::ACTION_CONVERT => [
                'Task: convert the provided notes or plain text into safe announcement HTML.',
                '- Organize the material into clear semantic sections.',
                '- Preserve meaning and avoid adding new facts.',
            ],
            default => $Silian_hasContent
                ? [
                    'Task: generate a refined announcement HTML draft from the provided title, notes, and constraints.',
                    '- Use the supplied draft or notes as the content source of truth.',
                    '- Fill structural gaps only, not factual gaps.',
                ]
                : [
                    'Task: generate a first-draft announcement HTML fragment from the provided title and constraints.',
                    '- If the input lacks details, produce a generic but honest draft.',
                ],
        };
    }

    /**
     * @param array<int,array<string,string>> $messages
     */
    private function buildPromptTranscript(array $Silian_messages): string
    {
        $Silian_chunks = [];
        foreach ($Silian_messages as $Silian_message) {
            $Silian_role = strtoupper((string) ($Silian_message['role'] ?? 'message'));
            $Silian_content = (string) ($Silian_message['content'] ?? '');
            $Silian_chunks[] = "=== {$Silian_role} ===\n{$Silian_content}";
        }

        return implode("\n\n", $Silian_chunks);
    }

    /**
     * @param array<string,mixed> $rawResponse
     * @param array<string,mixed> $input
     * @return array<string,mixed>
     */
    private function processResponse(array $Silian_rawResponse, array $Silian_input): array
    {
        $Silian_messageContent = $this->extractMessageContent($Silian_rawResponse);
        $Silian_decoded = $this->decodeJsonContent($Silian_messageContent);

        if (!is_array($Silian_decoded)) {
            if ($this->looksLikeHtml($Silian_messageContent)) {
                $Silian_decoded = [
                    'title' => (string) ($Silian_input['title'] ?: 'Announcement'),
                    'content' => trim($Silian_messageContent),
                ];
            } else {
                return [
                    'success' => false,
                    'error' => 'Failed to parse AI response',
                    'raw_content' => $Silian_messageContent,
                    'metadata' => [
                        'model' => $Silian_rawResponse['model'] ?? $this->model,
                        'usage' => $Silian_rawResponse['usage'] ?? null,
                        'finish_reason' => $Silian_rawResponse['choices'][0]['finish_reason'] ?? null,
                    ],
                ];
            }
        }

        $Silian_title = trim((string) ($Silian_decoded['title'] ?? $Silian_input['title'] ?? ''));
        $Silian_content = trim((string) ($Silian_decoded['content'] ?? $Silian_decoded['html'] ?? ''));

        if ($Silian_title === '') {
            $Silian_title = (string) ($Silian_input['title'] ?: 'Announcement');
        }

        if ($Silian_content === '') {
            return [
                'success' => false,
                'error' => 'AI response did not include announcement content',
                'raw_content' => $Silian_messageContent,
                'metadata' => [
                    'model' => $Silian_rawResponse['model'] ?? $this->model,
                    'usage' => $Silian_rawResponse['usage'] ?? null,
                    'finish_reason' => $Silian_rawResponse['choices'][0]['finish_reason'] ?? null,
                ],
            ];
        }

        return [
            'success' => true,
            'result' => [
                'title' => $Silian_title,
                'content' => $Silian_content,
                'content_format' => 'html',
                'action' => (string) $Silian_input['action'],
            ],
            'metadata' => [
                'model' => $Silian_rawResponse['model'] ?? $this->model,
                'usage' => $Silian_rawResponse['usage'] ?? null,
                'finish_reason' => $Silian_rawResponse['choices'][0]['finish_reason'] ?? null,
            ],
        ];
    }

    /**
     * @param array<string,mixed> $rawResponse
     */
    private function extractMessageContent(array $Silian_rawResponse): string
    {
        $Silian_choice = $Silian_rawResponse['choices'][0] ?? [];
        $Silian_content = $Silian_choice['message']['content'] ?? '';
        return is_string($Silian_content) ? trim($Silian_content) : '';
    }

    /**
     * @return array<string,mixed>|null
     */
    private function decodeJsonContent(string $Silian_content): ?array
    {
        if ($Silian_content === '') {
            return null;
        }

        $Silian_cleaned = preg_replace('/^```(?:json)?\s*/i', '', $Silian_content);
        if (!is_string($Silian_cleaned)) {
            $Silian_cleaned = $Silian_content;
        }

        $Silian_cleaned = preg_replace('/\s*```$/', '', $Silian_cleaned);
        if (!is_string($Silian_cleaned)) {
            $Silian_cleaned = $Silian_content;
        }

        $Silian_decoded = json_decode(trim($Silian_cleaned), true);
        if (!is_array($Silian_decoded) && preg_match('/\{.*\}/s', $Silian_cleaned, $Silian_matches) === 1) {
            $Silian_decoded = json_decode($Silian_matches[0], true);
        }

        return is_array($Silian_decoded) ? $Silian_decoded : null;
    }

    private function looksLikeHtml(string $Silian_content): bool
    {
        return $Silian_content !== '' && preg_match('/<\/?[a-z][^>]*>/i', $Silian_content) === 1;
    }

    /**
     * @param array<string,mixed> $rawResponse
     * @param array<string,mixed> $logContext
     * @param array<string,mixed> $context
     */
    private function logLlmCall(string $Silian_prompt, array $Silian_rawResponse, array $Silian_logContext, array $Silian_context, float $Silian_startedAt): void
    {
        if (!$this->llmLogService) {
            return;
        }

        $Silian_durationMs = (microtime(true) - $Silian_startedAt) * 1000.0;
        $Silian_responseId = $Silian_rawResponse['id'] ?? ($Silian_rawResponse['metadata']['request_id'] ?? null);

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
            'context' => $Silian_context,
        ]);
    }

    /**
     * @param array<string,mixed> $logContext
     * @param array<string,mixed> $context
     */
    private function logLlmFailure(string $Silian_prompt, array $Silian_logContext, array $Silian_context, float $Silian_startedAt, \Throwable $Silian_error): void
    {
        if (!$this->llmLogService) {
            return;
        }

        $Silian_durationMs = (microtime(true) - $Silian_startedAt) * 1000.0;

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
            'context' => $Silian_context,
        ]);
    }

    private function logAudit(string $Silian_action, array $Silian_logContext, array $Silian_context = []): void
    {
        if (!$this->auditLogService) {
            return;
        }

        try {
            $Silian_actorId = isset($Silian_logContext['actor_id']) && is_numeric((string) $Silian_logContext['actor_id'])
                ? (int) $Silian_logContext['actor_id']
                : null;
            $this->auditLogService->logAdminOperation($Silian_action, $Silian_actorId, 'admin_announcement_ai_service', array_merge([
                'request_id' => $Silian_logContext['request_id'] ?? null,
                'endpoint' => $Silian_logContext['source'] ?? '/admin/ai/announcement-drafts',
                'request_method' => 'POST',
                'status' => 'success',
            ], $Silian_context));
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
                $Silian_logContext['source'] ?? '/admin/ai/announcement-drafts',
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
}
