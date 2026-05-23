<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Services\Ai\LlmClientInterface;
use CarbonTrack\Support\SyntheticRequestFactory;
use Psr\Log\LoggerInterface;

class SupportRoutingTriageService
{
    private string $model;
    private float $temperature;
    private int $maxTokens;

    public function __construct(
        private ?LlmClientInterface $client,
        private LoggerInterface $logger,
        array $Silian_config = [],
        private ?LlmLogService $llmLogService = null,
        private ?AuditLogService $auditLogService = null,
        private ?ErrorLogService $errorLogService = null
    ) {
        $this->model = (string) ($Silian_config['model'] ?? 'google/gemini-2.5-flash-lite');
        $this->temperature = isset($Silian_config['temperature']) ? (float) $Silian_config['temperature'] : 0.1;
        $this->maxTokens = isset($Silian_config['max_tokens']) ? (int) $Silian_config['max_tokens'] : 500;
    }

    public function triage(array $Silian_ticket, array $Silian_context = []): array
    {
        $Silian_fallback = $this->fallbackTriage($Silian_ticket, $Silian_context);
        $Silian_aiEnabled = (bool) ($Silian_context['ai_enabled'] ?? false);
        $Silian_logContext = is_array($Silian_context['log_context'] ?? null) ? $Silian_context['log_context'] : [];

        if (!$Silian_aiEnabled || $this->client === null) {
            $Silian_reason = !$Silian_aiEnabled ? 'ai_disabled' : 'llm_unavailable';
            $this->logAudit('support_ticket_triage_fallback', $Silian_logContext, [
                'request_data' => ['reason' => $Silian_reason, 'ticket_id' => (int) ($Silian_ticket['id'] ?? 0)],
            ]);

            return [
                'used_ai' => false,
                'fallback_reason' => $Silian_reason,
                'triage' => $Silian_fallback,
            ];
        }

        $Silian_body = trim((string) ($Silian_context['message_body'] ?? ''));
        $Silian_groupRouting = is_array($Silian_context['group_routing'] ?? null) ? $Silian_context['group_routing'] : [];
        $Silian_prompt = $this->buildPrompt($Silian_ticket, $Silian_body, $Silian_groupRouting);
        $Silian_payload = [
            'model' => $this->model,
            'temperature' => $this->temperature,
            'max_tokens' => $this->maxTokens,
            'messages' => [
                ['role' => 'system', 'content' => $Silian_prompt['system']],
                ['role' => 'user', 'content' => $Silian_prompt['user']],
            ],
            'response_format' => ['type' => 'json_object'],
        ];

        $Silian_startedAt = microtime(true);

        try {
            $Silian_rawResponse = $this->client->createChatCompletion($Silian_payload);
            $Silian_parsed = $this->parseResponse($Silian_rawResponse, $Silian_fallback);
            $this->logLlmCall($Silian_prompt['user'], $Silian_rawResponse, $Silian_logContext, [
                'ticket_id' => (int) ($Silian_ticket['id'] ?? 0),
                'feature' => 'support_routing_triage',
            ], $Silian_startedAt);
            $this->logAudit('support_ticket_triage_completed', $Silian_logContext, [
                'request_data' => [
                    'ticket_id' => (int) ($Silian_ticket['id'] ?? 0),
                    'model' => $Silian_rawResponse['model'] ?? $this->model,
                    'severity' => $Silian_parsed['severity'],
                ],
            ]);

            return [
                'used_ai' => true,
                'fallback_reason' => null,
                'triage' => $Silian_parsed,
            ];
        } catch (\Throwable $Silian_exception) {
            $this->logger->warning('Support triage AI call failed, using fallback', [
                'ticket_id' => (int) ($Silian_ticket['id'] ?? 0),
                'error' => $Silian_exception->getMessage(),
            ]);
            $this->logLlmFailure($Silian_prompt['user'], $Silian_logContext, [
                'ticket_id' => (int) ($Silian_ticket['id'] ?? 0),
                'feature' => 'support_routing_triage',
            ], $Silian_startedAt, $Silian_exception);
            $this->logAudit('support_ticket_triage_fallback', $Silian_logContext, [
                'request_data' => [
                    'ticket_id' => (int) ($Silian_ticket['id'] ?? 0),
                    'reason' => 'llm_error',
                    'error' => $Silian_exception->getMessage(),
                ],
                'status' => 'failed',
            ]);
            $this->logError($Silian_exception, $Silian_logContext, [
                'ticket_id' => (int) ($Silian_ticket['id'] ?? 0),
                'feature' => 'support_routing_triage',
            ]);

            return [
                'used_ai' => false,
                'fallback_reason' => 'llm_error',
                'triage' => $Silian_fallback,
            ];
        }
    }

    public function fallbackTriage(array $Silian_ticket, array $Silian_context = []): array
    {
        $Silian_priority = strtolower((string) ($Silian_ticket['priority'] ?? 'normal'));
        $Silian_prioritySeverity = [
            'low' => 'low',
            'normal' => 'medium',
            'high' => 'high',
            'urgent' => 'critical',
        ];
        $Silian_priorityAgentLevel = [
            'low' => 1,
            'normal' => 2,
            'high' => 3,
            'urgent' => 4,
        ];

        $Silian_groupRouting = is_array($Silian_context['group_routing'] ?? null) ? $Silian_context['group_routing'] : [];
        $Silian_requiredAgentLevel = max(
            1,
            (int) ($Silian_groupRouting['min_agent_level'] ?? 1),
            (int) ($Silian_priorityAgentLevel[$Silian_priority] ?? 2)
        );

        return [
            'severity' => $Silian_prioritySeverity[$Silian_priority] ?? 'medium',
            'escalation_risk' => in_array($Silian_priority, ['high', 'urgent'], true) ? 'high' : 'medium',
            'required_agent_level' => $Silian_requiredAgentLevel,
            'suggested_skills' => [],
            'language' => null,
            'confidence' => 0.35,
            'summary' => sprintf('Fallback triage based on priority %s', $Silian_priority),
        ];
    }

    private function buildPrompt(array $Silian_ticket, string $Silian_body, array $Silian_groupRouting): array
    {
        $Silian_system = <<<PROMPT
You classify support tickets for routing. Return only a JSON object.
Output schema:
{
  "severity": "low|medium|high|critical",
  "escalation_risk": "low|medium|high",
  "required_agent_level": 1-5,
  "suggested_skills": ["string"],
  "language": "string|null",
  "confidence": 0.0-1.0,
  "summary": "short explanation"
}

Rules:
- required_agent_level must be an integer from 1 to 5.
- suggested_skills must be concise support skills.
- Do not include markdown.
- Keep summary under 120 characters.
PROMPT;

        $Silian_user = sprintf(
            "Ticket subject: %s\nCategory: %s\nPriority: %s\nUser group routing: %s\nFirst message:\n%s",
            (string) ($Silian_ticket['subject'] ?? ''),
            (string) ($Silian_ticket['category'] ?? ''),
            (string) ($Silian_ticket['priority'] ?? ''),
            json_encode($Silian_groupRouting, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
            $Silian_body
        );

        return ['system' => $Silian_system, 'user' => $Silian_user];
    }

    private function parseResponse(array $Silian_rawResponse, array $Silian_fallback): array
    {
        $Silian_content = (string) (($Silian_rawResponse['choices'][0]['message']['content'] ?? '{}'));
        if (str_contains($Silian_content, '```')) {
            $Silian_content = (string) preg_replace('/^```json\s*|\s*```$/', '', trim($Silian_content));
        }

        $Silian_decoded = json_decode($Silian_content, true);
        if (!is_array($Silian_decoded) && preg_match('/\{.*\}/s', $Silian_content, $Silian_matches) === 1) {
            $Silian_decoded = json_decode($Silian_matches[0], true);
        }
        if (!is_array($Silian_decoded)) {
            return $Silian_fallback;
        }

        $Silian_severity = strtolower((string) ($Silian_decoded['severity'] ?? $Silian_fallback['severity']));
        if (!in_array($Silian_severity, ['low', 'medium', 'high', 'critical'], true)) {
            $Silian_severity = $Silian_fallback['severity'];
        }

        $Silian_risk = strtolower((string) ($Silian_decoded['escalation_risk'] ?? $Silian_fallback['escalation_risk']));
        if (!in_array($Silian_risk, ['low', 'medium', 'high'], true)) {
            $Silian_risk = $Silian_fallback['escalation_risk'];
        }

        $Silian_level = max(1, min(5, (int) ($Silian_decoded['required_agent_level'] ?? $Silian_fallback['required_agent_level'])));
        $Silian_skills = array_values(array_unique(array_filter(array_map(static function ($Silian_value): string {
            return trim((string) $Silian_value);
        }, is_array($Silian_decoded['suggested_skills'] ?? null) ? $Silian_decoded['suggested_skills'] : []), static fn (string $Silian_value): bool => $Silian_value !== '')));

        return [
            'severity' => $Silian_severity,
            'escalation_risk' => $Silian_risk,
            'required_agent_level' => $Silian_level,
            'suggested_skills' => $Silian_skills,
            'language' => ($Silian_decoded['language'] ?? null) !== null ? trim((string) $Silian_decoded['language']) : null,
            'confidence' => max(0.0, min(1.0, (float) ($Silian_decoded['confidence'] ?? $Silian_fallback['confidence']))),
            'summary' => trim((string) ($Silian_decoded['summary'] ?? $Silian_fallback['summary'])),
        ];
    }

    private function logLlmCall(string $Silian_prompt, array $Silian_rawResponse, array $Silian_logContext, array $Silian_context, float $Silian_startedAt): void
    {
        if ($this->llmLogService === null) {
            return;
        }

        $this->llmLogService->log([
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'actor_type' => $Silian_logContext['actor_type'] ?? 'system',
            'actor_id' => $Silian_logContext['actor_id'] ?? null,
            'source' => $Silian_logContext['source'] ?? '/support/routing/triage',
            'model' => $Silian_rawResponse['model'] ?? $this->model,
            'prompt' => $Silian_prompt,
            'response_raw' => $Silian_rawResponse,
            'response_id' => $Silian_rawResponse['id'] ?? ($Silian_rawResponse['metadata']['request_id'] ?? null),
            'status' => 'success',
            'usage' => $Silian_rawResponse['usage'] ?? null,
            'latency_ms' => round((microtime(true) - $Silian_startedAt) * 1000.0, 2),
            'context' => $Silian_context,
        ]);
    }

    private function logLlmFailure(string $Silian_prompt, array $Silian_logContext, array $Silian_context, float $Silian_startedAt, \Throwable $Silian_error): void
    {
        if ($this->llmLogService === null) {
            return;
        }

        $this->llmLogService->log([
            'request_id' => $Silian_logContext['request_id'] ?? null,
            'actor_type' => $Silian_logContext['actor_type'] ?? 'system',
            'actor_id' => $Silian_logContext['actor_id'] ?? null,
            'source' => $Silian_logContext['source'] ?? '/support/routing/triage',
            'model' => $this->model,
            'prompt' => $Silian_prompt,
            'response_raw' => null,
            'response_id' => null,
            'status' => 'failed',
            'error_message' => $Silian_error->getMessage(),
            'usage' => null,
            'latency_ms' => round((microtime(true) - $Silian_startedAt) * 1000.0, 2),
            'context' => $Silian_context,
        ]);
    }

    private function logAudit(string $Silian_action, array $Silian_logContext, array $Silian_context = []): void
    {
        if ($this->auditLogService === null) {
            return;
        }

        try {
            $this->auditLogService->logSystemEvent($Silian_action, 'support_routing_triage', array_merge([
                'request_method' => 'SYSTEM',
                'endpoint' => $Silian_logContext['source'] ?? '/support/routing/triage',
                'request_id' => $Silian_logContext['request_id'] ?? null,
                'status' => $Silian_context['status'] ?? 'success',
            ], $Silian_context));
        } catch (\Throwable) {
            // ignore audit failure
        }
    }

    private function logError(\Throwable $Silian_exception, array $Silian_logContext, array $Silian_context = []): void
    {
        if ($this->errorLogService === null) {
            return;
        }

        try {
            $Silian_request = SyntheticRequestFactory::fromContext(
                $Silian_logContext['source'] ?? '/support/routing/triage',
                'SYSTEM',
                $Silian_logContext['request_id'] ?? null,
                [],
                $Silian_context,
                ['PHP_SAPI' => PHP_SAPI]
            );
            $this->errorLogService->logException($Silian_exception, $Silian_request, $Silian_context);
        } catch (\Throwable) {
            // ignore logging failure
        }
    }
}
