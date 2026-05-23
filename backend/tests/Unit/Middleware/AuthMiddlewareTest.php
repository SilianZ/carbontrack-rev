<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Middleware;

use PHPUnit\Framework\TestCase;
use CarbonTrack\Middleware\AuthMiddleware;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\AuditLogService;

class AuthMiddlewareTest extends TestCase
{
    public function testClassExists(): void
    {
        $this->assertTrue(class_exists(AuthMiddleware::class));
    }

    public function testProcessWithValidToken(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth->method('validateToken')->willReturn([
            'user_id' => 1,
            'uuid' => '550e8400-e29b-41d4-a716-446655440001',
            'email' => 'a@b.com',
            'role' => 'user',
            'user' => [
                'id' => 1,
                'uuid' => '550e8400-e29b-41d4-a716-446655440001',
                'email' => 'a@b.com',
                'is_admin' => false,
            ],
        ]);
        $Silian_audit->expects($this->once())->method('log');

        $Silian_mw = new AuthMiddleware($Silian_auth, $Silian_audit);

        $Silian_request = makeRequest('GET', '/', null, null, ['Authorization' => 'Bearer token']);
        $Silian_handler = new class implements \Psr\Http\Server\RequestHandlerInterface {
            public function handle(\Psr\Http\Message\ServerRequestInterface $Silian_request): \Psr\Http\Message\ResponseInterface {
                TestCase::assertSame(1, $Silian_request->getAttribute('user_id'));
                TestCase::assertSame('550e8400-e29b-41d4-a716-446655440001', $Silian_request->getAttribute('user_uuid'));
                TestCase::assertSame('a@b.com', $Silian_request->getAttribute('user_email'));
                TestCase::assertSame('user', $Silian_request->getAttribute('user_role'));
                TestCase::assertSame(
                    '550e8400-e29b-41d4-a716-446655440001',
                    $Silian_request->getAttribute('authenticated_user')['uuid'] ?? null
                );

                $Silian_resp = new \Slim\Psr7\Response();
                $Silian_resp->getBody()->write('ok');
                return $Silian_resp;
            }
        };

        $Silian_resp = $Silian_mw->process($Silian_request, $Silian_handler);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
    }

    public function testProcessWithMissingHeader(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_mw = new AuthMiddleware($Silian_auth, $Silian_audit);
        $Silian_request = makeRequest('GET', '/');
        $Silian_handler = $this->createMock(\Psr\Http\Server\RequestHandlerInterface::class);
        $Silian_resp = $Silian_mw->process($Silian_request, $Silian_handler);
        $this->assertEquals(401, $Silian_resp->getStatusCode());
    }
}


