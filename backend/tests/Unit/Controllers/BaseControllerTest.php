<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use PHPUnit\Framework\TestCase;
use CarbonTrack\Controllers\BaseController;

class BaseControllerTest extends TestCase
{
    public function testResponseWritesJsonAndStatus(): void
    {
        $Silian_controller = new class extends BaseController {
            public function out($Silian_data, $Silian_status = 201) {
                $Silian_resp = new \Slim\Psr7\Response();
                return $this->response($Silian_resp, $Silian_data, $Silian_status);
            }
        };
        $Silian_resp = $Silian_controller->out(['ok' => true], 201);
        $this->assertEquals(201, $Silian_resp->getStatusCode());
        $this->assertEquals('application/json', $Silian_resp->getHeaderLine('Content-Type'));
        $this->assertSame('{"ok":true}', (string)$Silian_resp->getBody());
    }
}
