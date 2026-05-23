<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Middleware;

use CarbonTrack\Middleware\SupportMiddleware;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\ErrorLogService;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

class SupportMiddlewareTest extends TestCase
{
    public function testRejectsWhenUnauthenticated(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(null);

        $Silian_middleware = new SupportMiddleware($Silian_auth, $this->createMock(LoggerInterface::class));
        $Silian_response = $Silian_middleware->process(
            makeRequest('GET', '/api/v1/support/tickets')->withAttribute('request_id', 'req-support-auth'),
            $this->createMock(\Psr\Http\Server\RequestHandlerInterface::class)
        );

        $this->assertSame(401, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('Authentication required', $Silian_payload['message']);
        $this->assertSame('Authentication required', $Silian_payload['error']);
        $this->assertSame('AUTH_REQUIRED', $Silian_payload['code']);
        $this->assertSame('req-support-auth', $Silian_payload['request_id']);
    }

    public function testRejectsRegularUsers(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 8, 'role' => 'user', 'is_admin' => false]);
        $Silian_auth->method('isSupportUser')->willReturn(false);

        $Silian_middleware = new SupportMiddleware($Silian_auth, $this->createMock(LoggerInterface::class));
        $Silian_response = $Silian_middleware->process(
            makeRequest('GET', '/api/v1/support/tickets'),
            $this->createMock(\Psr\Http\Server\RequestHandlerInterface::class)
        );

        $this->assertSame(403, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('Support access required', $Silian_payload['message']);
        $this->assertSame('Support access required', $Silian_payload['error']);
        $this->assertSame('SUPPORT_REQUIRED', $Silian_payload['code']);
    }

    public function testAllowsSupportUsers(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 3, 'role' => 'support', 'is_admin' => false, 'is_support' => true]);
        $Silian_auth->method('isSupportUser')->willReturn(true);

        $Silian_middleware = new SupportMiddleware($Silian_auth, $this->createMock(LoggerInterface::class));
        $Silian_handler = new class implements \Psr\Http\Server\RequestHandlerInterface {
            public function handle(\Psr\Http\Message\ServerRequestInterface $Silian_request): \Psr\Http\Message\ResponseInterface
            {
                TestCase::assertSame(3, $Silian_request->getAttribute('user')['id'] ?? null);
                $Silian_response = new \Slim\Psr7\Response();
                $Silian_response->getBody()->write('ok');
                return $Silian_response;
            }
        };

        $Silian_response = $Silian_middleware->process(makeRequest('GET', '/api/v1/support/tickets'), $Silian_handler);

        $this->assertSame(200, $Silian_response->getStatusCode());
    }

    public function testLogsStructuredFallbackWhenErrorLogServiceFails(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willThrowException(new \RuntimeException('auth exploded'));

        $Silian_errorLogService = $this->createMock(ErrorLogService::class);
        $Silian_errorLogService->expects($this->once())
            ->method('logException')
            ->willThrowException(new \RuntimeException('logger exploded'));

        $Silian_logger = $this->createMock(LoggerInterface::class);
        $Silian_logger->expects($this->once())
            ->method('error')
            ->with(
                'ErrorLogService logging failed for support middleware',
                $this->callback(static function (array $Silian_context): bool {
                    return ($Silian_context['request_id'] ?? null) === 'req-support-1'
                        && ($Silian_context['path'] ?? null) === '/api/v1/support/tickets'
                        && ($Silian_context['method'] ?? null) === 'GET'
                        && ($Silian_context['exception_type'] ?? null) === \RuntimeException::class
                        && ($Silian_context['logging_exception_type'] ?? null) === \RuntimeException::class
                        && ($Silian_context['logging_error_message'] ?? null) === 'logger exploded';
                })
            );
        $Silian_logger->expects($this->once())
            ->method('warning')
            ->with(
                'SupportMiddleware error: auth exploded',
                $this->callback(static function (array $Silian_context): bool {
                    return ($Silian_context['request_id'] ?? null) === 'req-support-1'
                        && ($Silian_context['path'] ?? null) === '/api/v1/support/tickets'
                        && ($Silian_context['method'] ?? null) === 'GET'
                        && ($Silian_context['exception_type'] ?? null) === \RuntimeException::class
                        && ($Silian_context['exception_message'] ?? null) === 'auth exploded';
                })
            );

        $Silian_middleware = new SupportMiddleware($Silian_auth, $Silian_logger, $Silian_errorLogService);
        $Silian_response = $Silian_middleware->process(
            makeRequest('GET', '/api/v1/support/tickets')->withAttribute('request_id', 'req-support-1'),
            $this->createMock(\Psr\Http\Server\RequestHandlerInterface::class)
        );

        $this->assertSame(500, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame('INTERNAL_ERROR', $Silian_payload['code']);
    }
}
