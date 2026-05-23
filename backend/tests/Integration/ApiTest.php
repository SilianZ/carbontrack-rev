<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Integration;

use PHPUnit\Framework\TestCase;
use Slim\App;
use Slim\Factory\AppFactory;
use Slim\Psr7\Factory\ServerRequestFactory;
use DI\Container;

class ApiTest extends TestCase
{
    private App $app;

    protected function setUp(): void
    {
        parent::setUp();

        // Create a test app instance
        $Silian_container = new Container();
        AppFactory::setContainer($Silian_container);
        $this->app = AppFactory::create();

        // Add basic health check route for testing
        $this->app->get('/', function ($Silian_request, $Silian_response) {
            $Silian_response->getBody()->write(json_encode([
                'success' => true,
                'message' => 'CarbonTrack API is running',
                'version' => '1.0.0',
                'timestamp' => date('Y-m-d H:i:s')
            ]));
            return $Silian_response->withHeader('Content-Type', 'application/json');
        });

        // Add test routes
        $this->app->get('/test/ping', function ($Silian_request, $Silian_response) {
            $Silian_response->getBody()->write(json_encode(['pong' => true]));
            return $Silian_response->withHeader('Content-Type', 'application/json');
        });

        $this->app->post('/test/echo', function ($Silian_request, $Silian_response) {
            $Silian_data = $Silian_request->getParsedBody();
            $Silian_response->getBody()->write(json_encode([
                'echo' => $Silian_data,
                'method' => $Silian_request->getMethod(),
                'uri' => (string) $Silian_request->getUri()
            ]));
            return $Silian_response->withHeader('Content-Type', 'application/json');
        });
    }

    public function testHealthCheckEndpoint(): void
    {
        $Silian_request = $this->createRequest('GET', '/');
        $Silian_response = $this->app->handle($Silian_request);

        $this->assertEquals(200, $Silian_response->getStatusCode());
        $this->assertEquals('application/json', $Silian_response->getHeaderLine('Content-Type'));

        $Silian_body = (string) $Silian_response->getBody();
        $Silian_data = json_decode($Silian_body, true);

        $this->assertTrue($Silian_data['success']);
        $this->assertEquals('CarbonTrack API is running', $Silian_data['message']);
        $this->assertEquals('1.0.0', $Silian_data['version']);
        $this->assertArrayHasKey('timestamp', $Silian_data);
    }

    public function testPingEndpoint(): void
    {
        $Silian_request = $this->createRequest('GET', '/test/ping');
        $Silian_response = $this->app->handle($Silian_request);

        $this->assertEquals(200, $Silian_response->getStatusCode());

        $Silian_body = (string) $Silian_response->getBody();
        $Silian_data = json_decode($Silian_body, true);

        $this->assertTrue($Silian_data['pong']);
    }

    public function testEchoEndpoint(): void
    {
        $Silian_testData = [
            'message' => 'Hello, World!',
            'number' => 42,
            'array' => [1, 2, 3]
        ];

        $Silian_request = $this->createRequest('POST', '/test/echo', $Silian_testData);
        $Silian_response = $this->app->handle($Silian_request);

        $this->assertEquals(200, $Silian_response->getStatusCode());

        $Silian_body = (string) $Silian_response->getBody();
        $Silian_data = json_decode($Silian_body, true);

        $this->assertEquals($Silian_testData, $Silian_data['echo']);
        $this->assertEquals('POST', $Silian_data['method']);
        $this->assertTrue(strpos($Silian_data['uri'], '/test/echo') !== false);
    }

    public function testNotFoundEndpoint(): void
    {
        try {
            $Silian_request = $this->createRequest('GET', '/nonexistent');
            $Silian_response = $this->app->handle($Silian_request);
            $this->assertNotEquals(200, $Silian_response->getStatusCode());
        } catch (\Throwable $Silian_e) {
            $this->assertTrue(stripos($Silian_e->getMessage(), 'not found') !== false);
        }
    }

    public function testMethodNotAllowed(): void
    {
        // Try to POST to a GET-only endpoint; Slim may throw MethodNotAllowed exception.
        try {
            $Silian_request = $this->createRequest('POST', '/test/ping');
            $Silian_response = $this->app->handle($Silian_request);
            $this->assertNotEquals(200, $Silian_response->getStatusCode());
        } catch (\Throwable $Silian_e) {
            $this->assertTrue(stripos($Silian_e->getMessage(), 'not allowed') !== false);
        }
    }

    private function createRequest(string $Silian_method, string $Silian_uri, array $Silian_data = [])
    {
        $Silian_serverRequestFactory = new ServerRequestFactory();
        $Silian_request = $Silian_serverRequestFactory->createServerRequest($Silian_method, $Silian_uri);

        if (!empty($Silian_data)) {
            $Silian_request = $Silian_request->withParsedBody($Silian_data);
            $Silian_request = $Silian_request->withHeader('Content-Type', 'application/json');
        }

        return $Silian_request;
    }
}

