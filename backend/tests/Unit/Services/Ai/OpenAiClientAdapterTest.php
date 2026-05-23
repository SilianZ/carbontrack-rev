<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services\Ai;

use CarbonTrack\Services\Ai\OpenAiClientAdapter;
use GuzzleHttp\Psr7\Response as Psr7Response;
use OpenAI\Client;
use OpenAI\Contracts\TransporterContract;
use OpenAI\ValueObjects\Transporter\Payload;
use OpenAI\ValueObjects\Transporter\Response as TransporterResponse;
use PHPUnit\Framework\TestCase;
use Psr\Http\Client\ClientInterface as HttpClientInterface;
use Psr\Http\Message\RequestInterface;
use Psr\Http\Message\ResponseInterface;

class OpenAiClientAdapterTest extends TestCase
{
    public function testCreateChatCompletionFallsBackToRawHttpWhenMetaInformationIsMissing(): void
    {
        $Silian_transporter = new class implements TransporterContract {
            public function requestObject(Payload $Silian_payload): TransporterResponse
            {
                throw new \TypeError('OpenAI\Responses\Meta\MetaInformation::__construct(): Argument #1 ($requestId) must be of type string, null given');
            }

            public function requestContent(Payload $Silian_payload): string
            {
                throw new \LogicException('Not used in this test.');
            }

            public function requestStream(Payload $Silian_payload): ResponseInterface
            {
                throw new \LogicException('Not used in this test.');
            }
        };

        $Silian_httpClient = new class implements HttpClientInterface {
            public ?RequestInterface $request = null;

            public function sendRequest(RequestInterface $Silian_request): ResponseInterface
            {
                $this->request = $Silian_request;

                return new Psr7Response(
                    200,
                    ['Content-Type' => 'application/json'],
                    json_encode([
                        'model' => 'gemini-3.1-flash-lite-preview',
                        'choices' => [[
                            'message' => [
                                'content' => '{"activity_uuid":"abc","amount":3,"unit":"plate"}',
                            ],
                            'finish_reason' => 'stop',
                        ]],
                        'usage' => [
                            'prompt_tokens' => 10,
                            'completion_tokens' => 5,
                            'total_tokens' => 15,
                        ],
                    ], JSON_THROW_ON_ERROR)
                );
            }
        };

        $Silian_payload = [
            'model' => 'gemini-3.1-flash-lite-preview',
            'messages' => [
                ['role' => 'user', 'content' => 'I have finished foods on 3 plates'],
            ],
        ];

        $Silian_adapter = new OpenAiClientAdapter(
            new Client($Silian_transporter),
            $Silian_httpClient,
            'https://example.test/v1',
            'secret-api-key',
            'org-demo'
        );

        $Silian_result = $Silian_adapter->createChatCompletion($Silian_payload);

        $this->assertSame('https://example.test/v1/chat/completions', (string) $Silian_httpClient->request?->getUri());
        $this->assertSame('Bearer secret-api-key', $Silian_httpClient->request?->getHeaderLine('Authorization'));
        $this->assertSame('org-demo', $Silian_httpClient->request?->getHeaderLine('OpenAI-Organization'));
        $this->assertSame($Silian_payload, json_decode((string) $Silian_httpClient->request?->getBody(), true));
        $this->assertSame('gemini-3.1-flash-lite-preview', $Silian_result['model']);
        $this->assertArrayHasKey('metadata', $Silian_result);
        $this->assertIsString($Silian_result['metadata']['request_id'] ?? null);
        $this->assertNotSame('', $Silian_result['metadata']['request_id']);
        $this->assertSame($Silian_result['metadata']['request_id'], $Silian_result['id']);
    }

    public function testCreateChatCompletionRethrowsUnrelatedTypeErrors(): void
    {
        $Silian_transporter = new class implements TransporterContract {
            public function requestObject(Payload $Silian_payload): TransporterResponse
            {
                throw new \TypeError('Unrelated type mismatch.');
            }

            public function requestContent(Payload $Silian_payload): string
            {
                throw new \LogicException('Not used in this test.');
            }

            public function requestStream(Payload $Silian_payload): ResponseInterface
            {
                throw new \LogicException('Not used in this test.');
            }
        };

        $Silian_adapter = new OpenAiClientAdapter(new Client($Silian_transporter));

        $this->expectException(\TypeError::class);
        $this->expectExceptionMessage('Unrelated type mismatch.');

        $Silian_adapter->createChatCompletion([
            'model' => 'test-model',
            'messages' => [
                ['role' => 'user', 'content' => 'hello'],
            ],
        ]);
    }
}
