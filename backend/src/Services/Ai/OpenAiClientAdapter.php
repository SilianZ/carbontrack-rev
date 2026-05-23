<?php

declare(strict_types=1);

namespace CarbonTrack\Services\Ai;

use GuzzleHttp\Psr7\Request;
use OpenAI\Client;
use Psr\Http\Client\ClientInterface as HttpClientInterface;
use Psr\Http\Message\ResponseInterface;

/**
 * Adapter that wraps the official openai-php client and exposes a minimal interface.
 */
class OpenAiClientAdapter implements LlmClientInterface
{
    public function __construct(
        private Client $client,
        private ?HttpClientInterface $httpClient = null,
        private string $baseUri = 'https://api.openai.com/v1',
        private ?string $apiKey = null,
        private ?string $organization = null
    ) {}

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    public function createChatCompletion(array $Silian_payload): array
    {
        try {
            $Silian_response = $this->client->chat()->create($Silian_payload);

            return $Silian_response->toArray();
        } catch (\TypeError $Silian_exception) {
            if (!$this->shouldFallbackToRawHttp($Silian_exception)) {
                throw $Silian_exception;
            }

            return $this->createChatCompletionViaHttp($Silian_payload);
        }
    }

    /**
     * Some OpenAI-compatible gateways omit x-request-id, which breaks openai-php response hydration.
     */
    private function shouldFallbackToRawHttp(\TypeError $Silian_exception): bool
    {
        return str_contains($Silian_exception->getMessage(), 'MetaInformation::__construct()')
            || str_contains($Silian_exception->getMessage(), 'MetaInformation::from()');
    }

    /**
     * @param array<string,mixed> $payload
     * @return array<string,mixed>
     */
    private function createChatCompletionViaHttp(array $Silian_payload): array
    {
        if ($this->httpClient === null || !is_string($this->apiKey) || trim($this->apiKey) === '') {
            throw new \RuntimeException('LLM raw HTTP fallback is not configured.');
        }

        $Silian_body = json_encode($Silian_payload, JSON_THROW_ON_ERROR);
        $Silian_request = new Request(
            'POST',
            $this->buildChatCompletionUri(),
            $this->buildHeaders(),
            $Silian_body
        );

        $Silian_response = $this->httpClient->sendRequest($Silian_request);
        $Silian_contents = (string) $Silian_response->getBody();
        $Silian_decoded = json_decode($Silian_contents, true);

        if ($Silian_response->getStatusCode() >= 400) {
            $Silian_message = $this->extractErrorMessage($Silian_decoded, $Silian_response);
            throw new \RuntimeException($Silian_message);
        }

        if (!is_array($Silian_decoded)) {
            throw new \RuntimeException('LLM returned an invalid JSON response.');
        }

        return $this->normalizeRawResponseMetadata($Silian_decoded, $Silian_response);
    }

    private function buildChatCompletionUri(): string
    {
        $Silian_baseUri = trim($this->baseUri);
        if ($Silian_baseUri === '') {
            $Silian_baseUri = 'https://api.openai.com/v1';
        }

        if (!preg_match('#^https?://#i', $Silian_baseUri)) {
            $Silian_baseUri = 'https://' . ltrim($Silian_baseUri, '/');
        }

        return rtrim($Silian_baseUri, '/') . '/chat/completions';
    }

    /**
     * @return array<string,string>
     */
    private function buildHeaders(): array
    {
        $Silian_headers = [
            'Authorization' => 'Bearer ' . trim((string) $this->apiKey),
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
        ];

        $Silian_organization = trim((string) $this->organization);
        if ($Silian_organization !== '') {
            $Silian_headers['OpenAI-Organization'] = $Silian_organization;
        }

        return $Silian_headers;
    }

    /**
     * @param mixed $decoded
     */
    private function extractErrorMessage(mixed $Silian_decoded, ResponseInterface $Silian_response): string
    {
        if (is_array($Silian_decoded)) {
            $Silian_error = $Silian_decoded['error'] ?? null;
            if (is_string($Silian_error) && trim($Silian_error) !== '') {
                return trim($Silian_error);
            }

            if (is_array($Silian_error)) {
                $Silian_message = $Silian_error['message'] ?? null;
                if (is_string($Silian_message) && trim($Silian_message) !== '') {
                    return trim($Silian_message);
                }
            }
        }

        return sprintf('LLM request failed with status %d.', $Silian_response->getStatusCode());
    }

    /**
     * @param array<string,mixed> $decoded
     * @return array<string,mixed>
     */
    private function normalizeRawResponseMetadata(array $Silian_decoded, ResponseInterface $Silian_response): array
    {
        $Silian_requestId = trim($Silian_response->getHeaderLine('x-request-id'));
        if ($Silian_requestId === '') {
            $Silian_requestId = isset($Silian_decoded['metadata']['request_id']) && is_string($Silian_decoded['metadata']['request_id'])
                ? trim($Silian_decoded['metadata']['request_id'])
                : '';
        }
        if ($Silian_requestId === '' && isset($Silian_decoded['id']) && is_string($Silian_decoded['id'])) {
            $Silian_requestId = trim($Silian_decoded['id']);
        }
        if ($Silian_requestId === '') {
            $Silian_requestId = $this->generateRequestId();
        }

        if (!isset($Silian_decoded['metadata']) || !is_array($Silian_decoded['metadata'])) {
            $Silian_decoded['metadata'] = [];
        }

        $Silian_decoded['metadata']['request_id'] = $Silian_requestId;
        if (!isset($Silian_decoded['id']) || !is_string($Silian_decoded['id']) || trim($Silian_decoded['id']) === '') {
            $Silian_decoded['id'] = $Silian_requestId;
        }

        return $Silian_decoded;
    }

    private function generateRequestId(): string
    {
        try {
            return 'llm-' . bin2hex(random_bytes(8));
        } catch (\Throwable) {
            return 'llm-' . str_replace('.', '', uniqid('', true));
        }
    }
}

