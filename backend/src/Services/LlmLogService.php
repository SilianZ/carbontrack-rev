<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use PDO;
use Monolog\Logger;

/**
 * LlmLogService
 * 记录 LLM 调用日志（含提示词与原始响应），用于审计与溯源。
 */
class LlmLogService
{
    private PDO $db;
    private Logger $logger;

    private int $maxPromptLength = 8000;
    private int $maxResponseLength = 120000;
    private int $maxErrorLength = 4000;
    private int $maxContextLength = 8000;

    public function __construct(PDO $Silian_db, Logger $Silian_logger)
    {
        $this->db = $Silian_db;
        $this->logger = $Silian_logger;
    }

    /**
     * @param array<string,mixed> $data
     */
    public function log(array $Silian_data): ?int
    {
        try {
            $Silian_requestId = $this->trimString($Silian_data['request_id'] ?? null, 64);
            $Silian_actorType = $this->trimString($Silian_data['actor_type'] ?? null, 20) ?? 'user';
            $Silian_actorId = isset($Silian_data['actor_id']) ? (int) $Silian_data['actor_id'] : null;
            $Silian_conversationId = $this->trimString($Silian_data['conversation_id'] ?? null, 64);
            $Silian_turnNo = isset($Silian_data['turn_no']) && is_numeric($Silian_data['turn_no']) ? (int) $Silian_data['turn_no'] : null;
            $Silian_source = $this->trimString($Silian_data['source'] ?? null, 120);
            $Silian_model = $this->trimString($Silian_data['model'] ?? null, 120);
            $Silian_prompt = $this->normalizeText($Silian_data['prompt'] ?? null, $this->maxPromptLength);
            $Silian_responseRaw = $this->normalizeText($Silian_data['response_raw'] ?? null, $this->maxResponseLength);
            $Silian_responseId = $this->trimString($Silian_data['response_id'] ?? null, 64);
            $Silian_status = $this->trimString($Silian_data['status'] ?? null, 20);
            $Silian_errorMessage = $this->normalizeText($Silian_data['error_message'] ?? null, $this->maxErrorLength);

            $Silian_usage = $Silian_data['usage'] ?? null;
            $Silian_usageJson = $this->encodeJson($Silian_usage);
            $Silian_usageTokens = $this->extractUsageTokens($Silian_usage);
            $Silian_contextJson = $this->normalizeText($Silian_data['context'] ?? ($Silian_data['context_json'] ?? null), $this->maxContextLength);

            $Silian_latencyMs = isset($Silian_data['latency_ms']) ? (float) $Silian_data['latency_ms'] : null;

            $Silian_stmt = $this->db->prepare("INSERT INTO llm_logs (
                request_id, actor_type, actor_id, conversation_id, turn_no, source, model, prompt, response_raw, response_id,
                status, error_message, prompt_tokens, completion_tokens, total_tokens, latency_ms, usage_json, context_json
            ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)");

            $Silian_stmt->execute([
                $Silian_requestId,
                $Silian_actorType,
                $Silian_actorId,
                $Silian_conversationId,
                $Silian_turnNo,
                $Silian_source,
                $Silian_model,
                $Silian_prompt,
                $Silian_responseRaw,
                $Silian_responseId,
                $Silian_status,
                $Silian_errorMessage,
                $Silian_usageTokens['prompt_tokens'],
                $Silian_usageTokens['completion_tokens'],
                $Silian_usageTokens['total_tokens'],
                $Silian_latencyMs,
                $Silian_usageJson,
                $Silian_contextJson,
            ]);

            $Silian_id = (int) $this->db->lastInsertId();
            return $Silian_id > 0 ? $Silian_id : null;
        } catch (\Throwable $Silian_e) {
            try {
                $this->logger->warning('LLM log insert failed', [
                    'error' => $Silian_e->getMessage(),
                ]);
            } catch (\Throwable $Silian_ignore) {
                // swallow secondary logging failure
            }
        }

        return null;
    }

    private function trimString($Silian_value, int $Silian_maxLength): ?string
    {
        if (!is_string($Silian_value)) {
            return null;
        }
        $Silian_value = trim($Silian_value);
        if ($Silian_value === '') {
            return null;
        }
        if (mb_strlen($Silian_value, 'UTF-8') > $Silian_maxLength) {
            return mb_substr($Silian_value, 0, $Silian_maxLength, 'UTF-8');
        }
        return $Silian_value;
    }

    private function normalizeText($Silian_value, int $Silian_maxLength): ?string
    {
        if ($Silian_value === null) {
            return null;
        }
        if (is_array($Silian_value) || is_object($Silian_value)) {
            $Silian_value = $this->encodeJson($Silian_value);
        }
        if (!is_string($Silian_value)) {
            $Silian_value = (string) $Silian_value;
        }
        if ($Silian_value === '') {
            return null;
        }
        if (mb_strlen($Silian_value, 'UTF-8') > $Silian_maxLength) {
            return mb_substr($Silian_value, 0, $Silian_maxLength, 'UTF-8') . '...[TRUNCATED]';
        }
        return $Silian_value;
    }

    private function encodeJson($Silian_value): ?string
    {
        if ($Silian_value === null) {
            return null;
        }
        if (is_string($Silian_value)) {
            return $Silian_value;
        }
        $Silian_json = json_encode($Silian_value, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        return $Silian_json === false ? null : $Silian_json;
    }

    /**
     * @param mixed $usage
     * @return array{prompt_tokens:int|null,completion_tokens:int|null,total_tokens:int|null}
     */
    private function extractUsageTokens($Silian_usage): array
    {
        if (!is_array($Silian_usage)) {
            return [
                'prompt_tokens' => null,
                'completion_tokens' => null,
                'total_tokens' => null,
            ];
        }

        $Silian_promptTokens = $this->toInt($Silian_usage['prompt_tokens'] ?? ($Silian_usage['input_tokens'] ?? ($Silian_usage['promptTokens'] ?? null)));
        $Silian_completionTokens = $this->toInt($Silian_usage['completion_tokens'] ?? ($Silian_usage['output_tokens'] ?? ($Silian_usage['completionTokens'] ?? null)));
        $Silian_totalTokens = $this->toInt($Silian_usage['total_tokens'] ?? ($Silian_usage['totalTokens'] ?? null));

        if ($Silian_totalTokens === null && ($Silian_promptTokens !== null || $Silian_completionTokens !== null)) {
            $Silian_totalTokens = (int) ($Silian_promptTokens ?? 0) + (int) ($Silian_completionTokens ?? 0);
        }

        return [
            'prompt_tokens' => $Silian_promptTokens,
            'completion_tokens' => $Silian_completionTokens,
            'total_tokens' => $Silian_totalTokens,
        ];
    }

    private function toInt($Silian_value): ?int
    {
        if ($Silian_value === null || $Silian_value === '') {
            return null;
        }
        if (is_numeric($Silian_value)) {
            return (int) $Silian_value;
        }
        return null;
    }
}
