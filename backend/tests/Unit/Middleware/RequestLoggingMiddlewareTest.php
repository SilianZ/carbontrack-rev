<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Middleware;

use CarbonTrack\Middleware\RequestLoggingMiddleware;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\SystemLogService;
use Monolog\Logger;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\RequestHandlerInterface;
use Slim\Psr7\Response;

class RequestLoggingMiddlewareTest extends TestCase
{
    protected function tearDown(): void
    {
        parent::tearDown();
        unset($_SERVER['HTTP_X_REQUEST_ID']);
    }

    public function testInjectsUuidWhenMissing(): void
    {
        $Silian_systemLog = $this->createMock(SystemLogService::class);
        $Silian_systemLog->expects($this->never())->method('log');
        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->method('getCurrentUser')->willReturn(null);
        $Silian_logger = $this->createMock(Logger::class);

        $Silian_middleware = new RequestLoggingMiddleware($Silian_systemLog, $Silian_authService, $Silian_logger);

        $Silian_handler = new class implements RequestHandlerInterface {
            public ?string $header = null;
            public ?string $attribute = null;

            public function handle(ServerRequestInterface $Silian_request): \Psr\Http\Message\ResponseInterface
            {
                $this->header = $Silian_request->getHeaderLine('X-Request-ID');
                $this->attribute = $Silian_request->getAttribute('request_id');
                return new Response(200);
            }
        };

        $Silian_request = makeRequest('POST', '/');
        $Silian_response = $Silian_middleware->process($Silian_request, $Silian_handler);

        $this->assertNotEmpty($Silian_handler->header);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $Silian_handler->header);
        $this->assertSame($Silian_handler->header, $Silian_handler->attribute);
        $this->assertSame($Silian_handler->header, $Silian_response->getHeaderLine('X-Request-ID'));
        $this->assertSame($Silian_handler->header, $_SERVER['HTTP_X_REQUEST_ID']);
    }

    public function testReplacesInvalidRequestIdWithUuid(): void
    {
        $Silian_systemLog = $this->createMock(SystemLogService::class);
        $Silian_systemLog->expects($this->once())
            ->method('log')
            ->with($this->callback(function (array $Silian_context): bool {
                return isset($Silian_context['request_id'])
                    && preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $Silian_context['request_id']) === 1;
            }));

        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->method('getCurrentUser')->willReturn(null);
        $Silian_logger = $this->createMock(Logger::class);

        $Silian_middleware = new RequestLoggingMiddleware($Silian_systemLog, $Silian_authService, $Silian_logger);

        $Silian_handler = new class implements RequestHandlerInterface {
            public ?string $header = null;
            public ?string $attribute = null;

            public function handle(ServerRequestInterface $Silian_request): \Psr\Http\Message\ResponseInterface
            {
                $this->header = $Silian_request->getHeaderLine('X-Request-ID');
                $this->attribute = $Silian_request->getAttribute('request_id');
                return new Response(201);
            }
        };

        $Silian_request = makeRequest('POST', '/api/v1/admin/messages/broadcast', null, null, [
            'X-Request-ID' => ['not-a-uuid'],
            'User-Agent' => ['PHPUnit']
        ]);

        $Silian_response = $Silian_middleware->process($Silian_request, $Silian_handler);

        $this->assertNotSame('not-a-uuid', $Silian_handler->header);
        $this->assertMatchesRegularExpression('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/', $Silian_handler->header);
        $this->assertSame($Silian_handler->header, $Silian_handler->attribute);
        $this->assertSame($Silian_handler->header, $Silian_response->getHeaderLine('X-Request-ID'));
        $this->assertSame($Silian_handler->header, $_SERVER['HTTP_X_REQUEST_ID']);
    }

    public function testPreservesValidRequestId(): void
    {
        $Silian_systemLog = $this->createMock(SystemLogService::class);
        $Silian_systemLog->expects($this->once())
            ->method('log')
            ->with($this->callback(function (array $Silian_context): bool {
                return ($Silian_context['request_id'] ?? null) === '123e4567-e89b-12d3-a456-426614174000'
                    && ($Silian_context['user_id'] ?? null) === 42
                    && ($Silian_context['user_uuid'] ?? null) === '550e8400-e29b-41d4-a716-446655440042';
            }));

        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->method('getCurrentUser')->willReturn([
            'id' => 42,
            'uuid' => '550e8400-e29b-41d4-a716-446655440042',
        ]);
        $Silian_logger = $this->createMock(Logger::class);

        $Silian_middleware = new RequestLoggingMiddleware($Silian_systemLog, $Silian_authService, $Silian_logger);

        $Silian_handler = new class implements RequestHandlerInterface {
            public ?string $header = null;
            public ?string $attribute = null;

            public function handle(ServerRequestInterface $Silian_request): \Psr\Http\Message\ResponseInterface
            {
                $this->header = $Silian_request->getHeaderLine('X-Request-ID');
                $this->attribute = $Silian_request->getAttribute('request_id');
                return new Response(200);
            }
        };

        $Silian_original = '123E4567-E89B-12D3-A456-426614174000';
        $Silian_request = makeRequest('POST', '/api/v1/admin/messages/broadcast', null, null, [
            'X-Request-ID' => [$Silian_original],
            'User-Agent' => ['PHPUnit']
        ]);

        $Silian_response = $Silian_middleware->process($Silian_request, $Silian_handler);

        $this->assertSame('123e4567-e89b-12d3-a456-426614174000', $Silian_handler->header);
        $this->assertSame($Silian_handler->header, $Silian_handler->attribute);
        $this->assertSame($Silian_handler->header, $Silian_response->getHeaderLine('X-Request-ID'));
        $this->assertSame($Silian_handler->header, $_SERVER['HTTP_X_REQUEST_ID']);
    }
}
