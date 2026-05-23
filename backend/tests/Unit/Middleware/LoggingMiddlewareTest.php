<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Middleware;

use PHPUnit\Framework\TestCase;
use CarbonTrack\Middleware\LoggingMiddleware;

class LoggingMiddlewareTest extends TestCase
{
    public function testClassExists(): void
    {
        $this->assertTrue(class_exists(LoggingMiddleware::class));
    }

    public function testLogsRequestAndResponse(): void
    {
        $Silian_logger = $this->createMock(\Psr\Log\LoggerInterface::class);
        $Silian_logger->expects($this->atLeastOnce())->method('info');
        $Silian_mw = new LoggingMiddleware($Silian_logger);

        $Silian_request = makeRequest('GET', '/health');
        $Silian_handler = new class implements \Psr\Http\Server\RequestHandlerInterface {
            public function handle(\Psr\Http\Message\ServerRequestInterface $Silian_request): \Psr\Http\Message\ResponseInterface {
                return new \Slim\Psr7\Response(204);
            }
        };

        $Silian_resp = $Silian_mw->process($Silian_request, $Silian_handler);
        $this->assertEquals(204, $Silian_resp->getStatusCode());
    }

    public function testLogsErrorWhenHandlerThrows(): void
    {
        $Silian_logger = $this->createMock(\Psr\Log\LoggerInterface::class);
        $Silian_logger->expects($this->atLeastOnce())->method('error');
        $Silian_mw = new LoggingMiddleware($Silian_logger);

        $Silian_request = makeRequest('GET', '/boom');
        $Silian_handler = new class implements \Psr\Http\Server\RequestHandlerInterface {
            public function handle(\Psr\Http\Message\ServerRequestInterface $Silian_request): \Psr\Http\Message\ResponseInterface {
                throw new \RuntimeException('fail');
            }
        };

        $this->expectException(\RuntimeException::class);
        $Silian_mw->process($Silian_request, $Silian_handler);
    }
}


