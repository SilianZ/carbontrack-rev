<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Middleware;

use PHPUnit\Framework\TestCase;
use CarbonTrack\Middleware\AdminMiddleware;
use CarbonTrack\Services\AuthService;

class AdminMiddlewareTest extends TestCase
{
    private ?string $previousEnv = null;

    protected function setUp(): void
    {
        $this->previousEnv = $_ENV['APP_ENV'] ?? null;
        $_ENV['APP_ENV'] = 'production';
    }

    protected function tearDown(): void
    {
        if ($this->previousEnv === null) {
            unset($_ENV['APP_ENV']);
        } else {
            $_ENV['APP_ENV'] = $this->previousEnv;
        }
    }

    public function testClassExists(): void
    {
        $this->assertTrue(class_exists(AdminMiddleware::class));
    }

    public function testRejectsWhenNotAuthenticated(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(null);
        $Silian_mw = new AdminMiddleware($Silian_auth);

        $Silian_request = makeRequest('GET', '/');
        $Silian_handler = $this->createMock(\Psr\Http\Server\RequestHandlerInterface::class);
        $Silian_resp = $Silian_mw->process($Silian_request, $Silian_handler);
        $this->assertEquals(401, $Silian_resp->getStatusCode());
    }

    public function testRejectsWhenNotAdmin(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>1,'is_admin'=>0]);
        $Silian_auth->method('isAdminUser')->willReturn(false);
        $Silian_mw = new AdminMiddleware($Silian_auth);

        $Silian_request = makeRequest('GET', '/');
        $Silian_handler = $this->createMock(\Psr\Http\Server\RequestHandlerInterface::class);
        $Silian_resp = $Silian_mw->process($Silian_request, $Silian_handler);
        $this->assertEquals(403, $Silian_resp->getStatusCode());
    }

    public function testPassThroughWhenAdmin(): void
    {
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>1,'is_admin'=>1]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_mw = new AdminMiddleware($Silian_auth);
        $Silian_request = makeRequest('GET', '/');
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


