<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Middleware;

use PHPUnit\Framework\TestCase;
use CarbonTrack\Middleware\CorsMiddleware;

class CorsMiddlewareTest extends TestCase
{
    public function testClassExists(): void
    {
        $this->assertTrue(class_exists(CorsMiddleware::class));
    }

    public function testPreflightOptionsAddsHeadersAnd200(): void
    {
        $_ENV['CORS_ALLOWED_ORIGINS'] = '*';
        $_ENV['CORS_ALLOWED_METHODS'] = 'GET,POST,PUT,DELETE,OPTIONS';
        $_ENV['CORS_ALLOWED_HEADERS'] = 'Content-Type,Authorization,X-Request-ID';

        $Silian_mw = new CorsMiddleware();
        $Silian_request = makeRequest('OPTIONS', '/api/v1/ping', null, null, [
            'Origin' => ['https://example.com']
        ]);
        $Silian_handler = new class implements \Psr\Http\Server\RequestHandlerInterface {
            public function handle(\Psr\Http\Message\ServerRequestInterface $Silian_request): \Psr\Http\Message\ResponseInterface {
                return new \Slim\Psr7\Response();
            }
        };

        $Silian_resp = $Silian_mw->process($Silian_request, $Silian_handler);
        $this->assertEquals(204, $Silian_resp->getStatusCode());
        $this->assertNotEmpty($Silian_resp->getHeaderLine('Access-Control-Allow-Methods'));
        $this->assertNotEmpty($Silian_resp->getHeaderLine('Access-Control-Allow-Headers'));
        $this->assertSame('true', $Silian_resp->getHeaderLine('Access-Control-Allow-Credentials'));
    }

    public function testGetWithAllowedOriginSetsAllowOriginHeader(): void
    {
        $_ENV['CORS_ALLOWED_ORIGINS'] = 'https://a.com,https://b.com';
        $Silian_mw = new CorsMiddleware();
        $Silian_request = makeRequest('GET', '/api/v1/ping', null, null, [
            'Origin' => ['https://a.com']
        ]);
        $Silian_handler = new class implements \Psr\Http\Server\RequestHandlerInterface {
            public function handle(\Psr\Http\Message\ServerRequestInterface $Silian_request): \Psr\Http\Message\ResponseInterface {
                $Silian_r = new \Slim\Psr7\Response(204);
                return $Silian_r;
            }
        };
        $Silian_resp = $Silian_mw->process($Silian_request, $Silian_handler);
        $this->assertEquals(204, $Silian_resp->getStatusCode());
        $this->assertEquals('https://a.com', $Silian_resp->getHeaderLine('Access-Control-Allow-Origin'));
    }
}


