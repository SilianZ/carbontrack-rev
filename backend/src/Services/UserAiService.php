<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Support\SyntheticRequestFactory;
use CarbonTrack\Services\Ai\LlmClientInterface;
use Psr\Log\LoggerInterface;

class UserAiService
{
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
        $this->model = (string)($Silian_config['model'] ?? 'google/gemini-2.5-flash-lite');
        $this->temperature = isset($Silian_config['temperature']) ? (float)$Silian_config['temperature'] : 0.1;
        $this->maxTokens = isset($Silian_config['max_tokens']) ? (int)$Silian_config['max_tokens'] : 500;
        $this->enabled = $client !== null;
    }

    public function isEnabled(): bool
    {
        return $this->enabled;
    }

    /**
     * @param string $query
     * @param array<string> $availableActivities List of activity names/descriptions
     * @param array<string,mixed> $logContext LLM logging context (request_id, actor_type, actor_id, source)
     * @return array
     */
    public function suggestActivity(
        string $Silian_query,
        array $Silian_availableActivities = [],
        array $Silian_clientTimeContext = [],
        array $Silian_logContext = []
    ): array
    {
        if (!$this->enabled) {
            throw new \RuntimeException('AI service is disabled');
        }

        $Silian_messages = $this->buildMessages($Silian_query, $Silian_availableActivities, $Silian_clientTimeContext);

        $Silian_payload = [
            'model' => $this->model,
            'temperature' => $this->temperature,
            'max_tokens' => $this->maxTokens,
            'messages' => $Silian_messages,
            'response_format' => ['type' => 'json_object'] // JSON mode if supported
        ];

        $Silian_startedAt = microtime(true);
        try {
            $Silian_rawResponse = $this->client->createChatCompletion($Silian_payload);
            $this->logLlmCall($Silian_query, $Silian_rawResponse, $Silian_logContext, $Silian_clientTimeContext, $Silian_startedAt);
        } catch (\Throwable $Silian_e) {
            $this->logger->error('User AI suggest call failed', [
                'exception' => $Silian_e::class,
                'message' => $Silian_e->getMessage(),
            ]);
            $this->logLlmFailure($Silian_query, $Silian_logContext, $Silian_clientTimeContext, $Silian_startedAt, $Silian_e);
            $this->logAudit('user_ai_service_suggest_failed', $Silian_logContext, [
                'status' => 'failed',
                'request_data' => [
                    'query_length' => mb_strlen($Silian_query),
                    'source' => $Silian_logContext['source'] ?? null,
                    'error' => $Silian_e->getMessage(),
                ],
            ]);
            $this->logError($Silian_e, $Silian_logContext, [
                'query' => $Silian_query,
                'client_time_context' => $Silian_clientTimeContext,
            ]);
            throw new \RuntimeException('LLM_UNAVAILABLE', 0, $Silian_e);
        }

        $Silian_result = $this->processResponse($Silian_rawResponse, $Silian_availableActivities);
        $this->logAudit('user_ai_service_suggest_succeeded', $Silian_logContext, [
            'request_data' => [
                'query_length' => mb_strlen($Silian_query),
                'source' => $Silian_logContext['source'] ?? null,
                'model' => $Silian_rawResponse['model'] ?? $this->model,
                'activity_uuid' => $Silian_result['prediction']['activity_uuid'] ?? null,
                'confidence' => $Silian_result['prediction']['confidence'] ?? null,
            ],
        ]);

        return $Silian_result;
    }

    private function logLlmCall(string $Silian_prompt, array $Silian_rawResponse, array $Silian_logContext, array $Silian_context, float $Silian_startedAt): void
    {
        if (!$this->llmLogService) {
            return;
        }

        $Silian_durationMs = (microtime(true) - $Silian_startedAt) * 1000.0;
        $Silian_responseId = $Silian_rawResponse['id'] ?? ($Silian_rawResponse['metadata']['request_id'] ?? null);

        $this->llmLogService->log([
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'actor_type' => $Silian_logContext['actor_type'] ?? 'user',
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
            'context' => $Silian_context ?: null,
        ]);
    }

    private function logLlmFailure(string $Silian_prompt, array $Silian_logContext, array $Silian_context, float $Silian_startedAt, \Throwable $Silian_error): void
    {
        if (!$this->llmLogService) {
            return;
        }

        $Silian_durationMs = (microtime(true) - $Silian_startedAt) * 1000.0;

        $this->llmLogService->log([
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'actor_type' => $Silian_logContext['actor_type'] ?? 'user',
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
            'context' => $Silian_context ?: null,
        ]);
    }

    private function buildMessages(string $Silian_query, array $Silian_activities, array $Silian_clientTimeContext = []): array
    {
        $Silian_now = new \DateTimeImmutable('now');
        $Silian_today = $Silian_now->format('Y-m-d');
        $Silian_weekday = $Silian_now->format('l');
        $Silian_clientTimeLine = '';

        $Silian_clientTimeRaw = $Silian_clientTimeContext['client_time'] ?? null;
        $Silian_clientTzRaw = $Silian_clientTimeContext['client_timezone'] ?? null;
        if ($Silian_clientTimeRaw) {
            try {
                $Silian_tz = $Silian_clientTzRaw ? new \DateTimeZone((string)$Silian_clientTzRaw) : null;
                $Silian_clientTime = $Silian_tz ? new \DateTimeImmutable((string)$Silian_clientTimeRaw, $Silian_tz) : new \DateTimeImmutable((string)$Silian_clientTimeRaw);
                $Silian_clientTimeLine = "User local time: " . $Silian_clientTime->format('Y-m-d H:i:s T');
            } catch (\Throwable $Silian_e) {
                $Silian_clientTimeLine = "User local time: " . (string)$Silian_clientTimeRaw . ($Silian_clientTzRaw ? " ({$Silian_clientTzRaw})" : '');
            }
        }

        $Silian_activityLines = [];
        foreach (array_slice($Silian_activities, 0, 500) as $Silian_item) {
            if (is_array($Silian_item)) {
                $Silian_id = (string)($Silian_item['id'] ?? '');
                $Silian_label = $Silian_item['label'] ?? ($Silian_item['name'] ?? '');
                $Silian_category = $Silian_item['category'] ?? ($Silian_item['cat'] ?? 'General');
                $Silian_unit = $Silian_item['unit'] ?? null;
                $Silian_unitPart = $Silian_unit ? " | Unit: {$Silian_unit}" : '';
                $Silian_activityLines[] = "UUID: {$Silian_id} | Category: {$Silian_category} | Name: {$Silian_label}{$Silian_unitPart}";
            } else {
                $Silian_activityLines[] = (string)$Silian_item;
            }
        }
        $Silian_activityList = implode("\n", $Silian_activityLines);
        if (count($Silian_activities) > 500) {
            $Silian_activityList .= "\n... (and more)";
        }

        $Silian_systemPrompt = <<<EOT
You are a CarbonTrack assistant. help extract carbon footprint activity data from user input.
You must return a valid JSON object. Match to the provided activities by UUID.
Today is {$Silian_today} ({$Silian_weekday}).
{$Silian_clientTimeLine}

Available Activity Types (Reference):
{$Silian_activityList}

Instructions:
1. Identify the activity type from the user input. Match it to one of the available UUIDs above if possible.
2. Return the matched activity_uuid (required). If no match, set activity_uuid to null and confidence 0.
3. Include activity_name only as a display label (keep the provided name if matched).
4. Extract the numeric amount and unit. If the unit is missing, infer a standard unit for that activity (e.g., km for transport).
5. Extract the occurrence date if present; output as ISO date string YYYY-MM-DD. If missing or ambiguous, set to null.
6. Return confidence score (0-1).

Output Schema (JSON):
{
    "activity_uuid": "string|null (Use one of the UUIDs provided above; null if none)",
    "activity_name": "string (Best match name, optional)",
    "amount": number,
    "unit": "string",
    "activity_date": "string|null (ISO date YYYY-MM-DD)",
    "notes": "string (Short summary of what was extracted)",
    "confidence": number
}

If no activity is detected, set confidence to 0.
EOT;

        return [
            ['role' => 'system', 'content' => $Silian_systemPrompt],
            ['role' => 'user', 'content' => $Silian_query]
        ];
    }

    private function processResponse(array $Silian_rawResponse, array $Silian_availableActivities = []): array
    {
         $Silian_choice = $Silian_rawResponse['choices'][0] ?? [];
         $Silian_content = $Silian_choice['message']['content'] ?? '{}';

         // Basic cleanup for JSON block if model returns markdown
         if (str_contains($Silian_content, '```')) {
             $Silian_content = preg_replace('/^```json\s*|\s*```$/', '', $Silian_content);
         }

         $Silian_data = json_decode($Silian_content, true);

         if (!is_array($Silian_data)) {
             // Fallback: try to find start and end braces
             if (preg_match('/\{.*\}/s', $Silian_content, $Silian_matches)) {
                 $Silian_data = json_decode($Silian_matches[0], true);
             }
         }

         if (!is_array($Silian_data)) {
             return [
                 'success' => false,
                 'error' => 'Failed to parse AI response',
                 'raw_content' => $Silian_content
             ];
         }

         // Normalize uuid presence and enforce allowed list
         $Silian_allowedUuids = [];
         foreach ($Silian_availableActivities as $Silian_item) {
             if (is_array($Silian_item) && isset($Silian_item['id'])) {
                 $Silian_allowedUuids[] = (string)$Silian_item['id'];
             }
         }
         $Silian_allowedUuids = array_unique($Silian_allowedUuids);

         if (!array_key_exists('activity_uuid', $Silian_data)) {
             $Silian_data['activity_uuid'] = null;
         }
         if (!array_key_exists('activity_date', $Silian_data)) {
             $Silian_data['activity_date'] = null;
         }

         if ($Silian_data['activity_uuid'] !== null && !is_string($Silian_data['activity_uuid'])) {
             $Silian_data['activity_uuid'] = (string)$Silian_data['activity_uuid'];
         }

         if (!empty($Silian_allowedUuids) && $Silian_data['activity_uuid'] !== null && !in_array($Silian_data['activity_uuid'], $Silian_allowedUuids, true)) {
             // If model picked an unknown uuid, drop confidence and clear uuid to signal no match
             $Silian_data['activity_uuid'] = null;
             $Silian_data['confidence'] = 0;
         }

         return [
            'success' => true,
            'prediction' => $Silian_data,
            'metadata' => [
                'model' => $Silian_rawResponse['model'] ?? $this->model,
                'usage' => $Silian_rawResponse['usage'] ?? null
            ]
         ];
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
            $this->auditLogService->logUserAction($Silian_actorId, $Silian_action, array_merge([
                'request_id' => $Silian_logContext['request_id'] ?? null,
                'endpoint' => $Silian_logContext['source'] ?? '/ai/suggest-activity',
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
                $Silian_logContext['source'] ?? '/ai/suggest-activity',
                'POST',
                $Silian_logContext['request_id'] ?? null,
                [],
                $Silian_context
            );
            $this->errorLogService->logException($Silian_exception, $Silian_request, [
                'request_id' => $Silian_logContext['request_id'] ?? null,
                'actor_type' => $Silian_logContext['actor_type'] ?? 'user',
            ]);
        } catch (\Throwable $Silian_ignore) {
            // swallow secondary logging failure
        }
    }
}
