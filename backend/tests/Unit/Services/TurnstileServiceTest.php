<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use PHPUnit\Framework\TestCase;
use CarbonTrack\Services\TurnstileService;

class TurnstileServiceTest extends TestCase
{
    public function testClassExists(): void
    {
        $this->assertTrue(class_exists(TurnstileService::class));
    }

    public function testVerifyWithEmptyToken(): void
    {
        $Silian_previousAppEnv = $_ENV['APP_ENV'] ?? null;
        $Silian_previousBypass = $_ENV['TURNSTILE_BYPASS'] ?? null;
        $_ENV['APP_ENV'] = 'production';
        $_ENV['TURNSTILE_BYPASS'] = 'false';

        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('log')
            ->with($this->callback(function (array $Silian_payload): bool {
                return ($Silian_payload['action'] ?? null) === 'turnstile_verification_missing_token'
                    && ($Silian_payload['operation_category'] ?? null) === 'security';
            }))
            ->willReturn(true);

        try {
            $Silian_svc = new TurnstileService('secret', $Silian_logger, $Silian_audit, $this->createMock(ErrorLogService::class));
            $Silian_res = $Silian_svc->verify('');
            $this->assertFalse($Silian_res['success']);
            $this->assertEquals('missing-input-response', $Silian_res['error']);
        } finally {
            if ($Silian_previousAppEnv !== null) {
                $_ENV['APP_ENV'] = $Silian_previousAppEnv;
            } else {
                unset($_ENV['APP_ENV']);
            }

            if ($Silian_previousBypass !== null) {
                $_ENV['TURNSTILE_BYPASS'] = $Silian_previousBypass;
            } else {
                unset($_ENV['TURNSTILE_BYPASS']);
            }
        }
    }

    public function testApplyCertificateOptionsAddsConfiguredCaBundleAndNativeStore(): void
    {
        $Silian_logger = $this->createMock(\Monolog\Logger::class);
        $Silian_service = new TurnstileService(
            'secret',
            $Silian_logger,
            null,
            null,
            'C:\\certs\\cacert.pem',
            true
        );

        $Silian_method = new \ReflectionMethod(TurnstileService::class, 'applyCertificateOptions');
        $Silian_method->setAccessible(true);

        $Silian_options = [];
        $Silian_method->invokeArgs($Silian_service, [&$Silian_options]);

        $this->assertSame('C:\\certs\\cacert.pem', $Silian_options[CURLOPT_CAINFO]);

        if (\defined('CURLOPT_SSL_OPTIONS') && \defined('CURLSSLOPT_NATIVE_CA')) {
            $this->assertSame(CURLSSLOPT_NATIVE_CA, $Silian_options[CURLOPT_SSL_OPTIONS]);
        }
    }
}


