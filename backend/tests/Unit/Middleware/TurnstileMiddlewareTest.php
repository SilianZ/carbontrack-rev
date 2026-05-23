<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Middleware;

use PHPUnit\Framework\TestCase;
use CarbonTrack\Middleware\TurnstileMiddleware;
use CarbonTrack\Services\TurnstileService;
use CarbonTrack\Services\AuditLogService;

class TurnstileMiddlewareTest extends TestCase
{
    public function testClassExists(): void
    {
        $this->assertTrue(class_exists(TurnstileMiddleware::class));
    }

    public function testProtectedRouteMissingToken(): void
    {
        $Silian_svc = $this->createMock(TurnstileService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_mw = new TurnstileMiddleware($Silian_svc, $Silian_audit);

        $Silian_request = makeRequest('POST', '/api/v1/auth/login');
        $Silian_handler = $this->createMock(\Psr\Http\Server\RequestHandlerInterface::class);
        $_ENV['APP_ENV'] = 'production';
        $Silian_resp = $Silian_mw->process($Silian_request, $Silian_handler);
        $this->assertEquals(403, $Silian_resp->getStatusCode());
    }

    public function testProtectedRouteVerified(): void
    {
        $Silian_svc = $this->createMock(TurnstileService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_mw = new TurnstileMiddleware($Silian_svc, $Silian_audit);

        $Silian_svc->method('verify')->willReturn(['success' => true]);
        $_ENV['APP_ENV'] = 'production';

        $Silian_request = makeRequest('POST', '/api/v1/auth/login', ['cf_turnstile_response' => 'token']);
        $Silian_handler = new class implements \Psr\Http\Server\RequestHandlerInterface {
            public function handle(\Psr\Http\Message\ServerRequestInterface $Silian_request): \Psr\Http\Message\ResponseInterface {
                $Silian_resp = new \Slim\Psr7\Response();
                $Silian_resp->getBody()->write('ok');
                return $Silian_resp;
            }
        };

        $Silian_resp = $Silian_mw->process($Silian_request, $Silian_handler);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
    }
}


