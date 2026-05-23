<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Support;

use CarbonTrack\Support\ErrorResponseBuilder;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Headers;
use Slim\Psr7\Request;
use Slim\Psr7\Stream;
use Slim\Psr7\Uri;

class ErrorResponseBuilderTest extends TestCase
{
    public function testDevelopmentEnvironmentContainsMessage(): void
    {
        $Silian_exception = new \RuntimeException('boom', 123);
        $Silian_request = $this->makeRequest(['REQUEST_ID' => 'abc123']);

        $Silian_payload = ErrorResponseBuilder::build($Silian_exception, $Silian_request, 'development', 500);

        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('123', $Silian_payload['code']);
        $this->assertSame('boom', $Silian_payload['message']);
        $this->assertSame(\RuntimeException::class, $Silian_payload['error']);
        $this->assertSame('abc123', $Silian_payload['request_id']);
    }

    public function testProductionEnvironmentOmitsMessage(): void
    {
        $Silian_exception = new \RuntimeException('boom');
        $Silian_request = $this->makeRequest([], ['X-Request-ID' => ['req-001']]);

        $Silian_payload = ErrorResponseBuilder::build($Silian_exception, $Silian_request, 'production', 500);

        $this->assertArrayNotHasKey('message', $Silian_payload);
        $this->assertArrayNotHasKey('error', $Silian_payload);
        $this->assertSame('SERVER_ERROR', $Silian_payload['code']);
        $this->assertSame('req-001', $Silian_payload['request_id']);
    }

    public function testStatusDrivesDefaultErrorCodeForNonServerErrors(): void
    {
        $Silian_exception = new \RuntimeException('Not allowed', 0);
        $Silian_payload = ErrorResponseBuilder::build($Silian_exception, $this->makeRequest(), 'production', 403);

        $this->assertSame('403', $Silian_payload['code']);
    }

    public function testRequestAttributeTakesPriorityAndNormalizesUuid(): void
    {
        $Silian_exception = new \RuntimeException('boom');
        $Silian_request = $this->makeRequest(['REQUEST_ID' => 'server-id'], ['X-Request-ID' => ['REQ-001']]);
        $Silian_request = $Silian_request->withAttribute('request_id', '550E8400-E29B-41D4-A716-446655440001');

        $Silian_payload = ErrorResponseBuilder::build($Silian_exception, $Silian_request, 'production', 500);

        $this->assertSame('550e8400-e29b-41d4-a716-446655440001', $Silian_payload['request_id']);
    }

    public function testRequestIdFallsBackToHeaderWhenAttributeBlank(): void
    {
        $Silian_exception = new \RuntimeException('boom');
        $Silian_request = $this->makeRequest([], ['X-Request-ID' => ['REQ-001']]);
        $Silian_request = $Silian_request->withAttribute('request_id', '   ');

        $Silian_payload = ErrorResponseBuilder::build($Silian_exception, $Silian_request, 'production', 500);

        $this->assertSame('REQ-001', $Silian_payload['request_id']);
    }

    public function testRequestIdFallsBackToServerParamWhenHeaderBlank(): void
    {
        $Silian_exception = new \RuntimeException('boom');
        $Silian_request = $this->makeRequest(
            ['HTTP_X_REQUEST_ID' => '550E8400-E29B-61D4-A716-446655440001'],
            ['X-Request-ID' => ['   ']]
        );

        $Silian_payload = ErrorResponseBuilder::build($Silian_exception, $Silian_request, 'production', 500);

        $this->assertSame('550E8400-E29B-61D4-A716-446655440001', $Silian_payload['request_id']);
    }

    private function makeRequest(array $Silian_serverParams = [], array $Silian_headers = []): Request
    {
        $Silian_uri = new Uri('https', 'example.com', null, '/test');
        $Silian_stream = new Stream(fopen('php://temp', 'r+'));
        $Silian_slimHeaders = new Headers($Silian_headers);

        return new Request('GET', $Silian_uri, $Silian_slimHeaders, [], $Silian_serverParams, $Silian_stream);
    }
}
