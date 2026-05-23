<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Middleware;

use PHPUnit\Framework\TestCase;
use CarbonTrack\Middleware\IdempotencyMiddleware;
use CarbonTrack\Services\DatabaseService;

class IdempotencyMiddlewareTest extends TestCase
{
    public function testClassExists(): void
    {
        $this->assertTrue(class_exists(IdempotencyMiddleware::class));
    }

    public function testMissingRequestIdReturns400(): void
    {
        // DatabaseService not used directly in current implementation; pass a dummy stub
        $Silian_db = $this->getMockBuilder(DatabaseService::class)->disableOriginalConstructor()->getMock();
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_mw = new IdempotencyMiddleware($Silian_db, $Silian_logger);

        $Silian_request = makeRequest('POST', '/api/v1/auth/register');
        $Silian_handler = $this->createMock(\Psr\Http\Server\RequestHandlerInterface::class);
        $Silian_resp = $Silian_mw->process($Silian_request, $Silian_handler);
        $this->assertEquals(400, $Silian_resp->getStatusCode());
    }

    public function testPassthroughWhenNotSensitive(): void
    {
        $Silian_db = $this->getMockBuilder(DatabaseService::class)->disableOriginalConstructor()->getMock();
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_mw = new IdempotencyMiddleware($Silian_db, $Silian_logger);

        $Silian_request = makeRequest('POST', '/api/v1/others');
        $Silian_handler = new class implements \Psr\Http\Server\RequestHandlerInterface {
            public function handle(\Psr\Http\Message\ServerRequestInterface $Silian_request): \Psr\Http\Message\ResponseInterface {
                $Silian_resp = new \Slim\Psr7\Response();
                $Silian_resp->getBody()->write('{"ok":true}');
                return $Silian_resp->withHeader('Content-Type','application/json');
            }
        };

        $Silian_resp = $Silian_mw->process($Silian_request, $Silian_handler);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
    }

    public function testInvalidRequestIdFormatReturns400(): void
    {
        $Silian_db = $this->getMockBuilder(DatabaseService::class)->disableOriginalConstructor()->getMock();
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_mw = new IdempotencyMiddleware($Silian_db, $Silian_logger);

        $Silian_request = makeRequest('POST', '/api/v1/exchange', null, null, [
            'X-Request-ID' => ['not-a-uuid']
        ]);
        $Silian_handler = $this->createMock(\Psr\Http\Server\RequestHandlerInterface::class);
        $Silian_resp = $Silian_mw->process($Silian_request, $Silian_handler);
        $this->assertEquals(400, $Silian_resp->getStatusCode());
    }

    public function testSensitiveWithValidUuidPassesThroughAndStoresSafely(): void
    {
        $Silian_db = $this->getMockBuilder(DatabaseService::class)->disableOriginalConstructor()->getMock();
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_mw = new IdempotencyMiddleware($Silian_db, $Silian_logger);

        $Silian_uuid = '123e4567-e89b-12d3-a456-426614174000';
        $Silian_request = makeRequest('POST', '/api/v1/exchange', ['a' => 1], null, [
            'X-Request-ID' => [$Silian_uuid],
            'User-Agent' => ['PHPUnit']
        ]);

        $Silian_handler = new class implements \Psr\Http\Server\RequestHandlerInterface {
            public function handle(\Psr\Http\Message\ServerRequestInterface $Silian_request): \Psr\Http\Message\ResponseInterface {
                $Silian_resp = new \Slim\Psr7\Response(201);
                $Silian_resp->getBody()->write('{"success":true}');
                return $Silian_resp->withHeader('Content-Type','application/json');
            }
        };

        $Silian_resp = $Silian_mw->process($Silian_request, $Silian_handler);
        $this->assertEquals(201, $Silian_resp->getStatusCode());
        $this->assertEquals('application/json', $Silian_resp->getHeaderLine('Content-Type'));
        // When storage fails, middleware swallows error and still returns handler response
        // We can't assert DB writes here without wiring Eloquent; this verifies happy path passthrough.
    }
}


