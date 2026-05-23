<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use CarbonTrack\Controllers\PasskeyController;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\PasskeyService;
use Monolog\Logger;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Response;

class PasskeyControllerTest extends TestCase
{
    public function testBeginRegistrationRequiresAuthentication(): void
    {
        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->method('getCurrentUser')->willReturn(null);

        $Silian_controller = new PasskeyController(
            $Silian_authService,
            $this->createMock(PasskeyService::class),
            $this->createMock(Logger::class),
            $this->createMock(ErrorLogService::class)
        );

        $Silian_response = $Silian_controller->beginRegistration(
            makeRequest('POST', '/users/me/passkeys/registration/options', ['label' => 'Laptop']),
            new Response()
        );

        $this->assertSame(401, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('UNAUTHORIZED', $Silian_payload['code']);
    }

    public function testBeginAuthenticationReturnsServicePayload(): void
    {
        $Silian_passkeyService = $this->createMock(PasskeyService::class);
        $Silian_passkeyService->expects($this->once())
            ->method('beginAuthentication')
            ->with(['identifier' => 'sarah@example.com'])
            ->willReturn([
                'challenge_id' => 'challenge-123',
                'public_key' => [
                    'challenge' => 'abc123',
                ],
            ]);

        $Silian_controller = new PasskeyController(
            $this->createMock(AuthService::class),
            $Silian_passkeyService,
            $this->createMock(Logger::class),
            $this->createMock(ErrorLogService::class)
        );

        $Silian_response = $Silian_controller->beginAuthentication(
            makeRequest('POST', '/auth/passkey/login/options', ['identifier' => 'sarah@example.com']),
            new Response()
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame('challenge-123', $Silian_payload['data']['challenge_id']);
    }

    public function testCompleteAuthenticationReturnsJwtPayload(): void
    {
        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->expects($this->once())
            ->method('generateToken')
            ->with($this->callback(static fn (array $Silian_user): bool => (int) $Silian_user['id'] === 5))
            ->willReturn('jwt-token');

        $Silian_passkeyService = $this->createMock(PasskeyService::class);
        $Silian_passkeyService->expects($this->once())
            ->method('completeAuthentication')
            ->with([
                'challenge_id' => 'challenge-123',
                'credential' => ['id' => 'cred-1'],
            ])
            ->willReturn([
                'user' => [
                    'id' => 5,
                    'username' => 'sarah',
                    'email' => 'sarah@example.com',
                    'points' => 10,
                    'is_admin' => false,
                ],
                'passkey' => [
                    'id' => 11,
                    'credential_id' => 'cred-1',
                ],
            ]);

        $Silian_controller = new PasskeyController(
            $Silian_authService,
            $Silian_passkeyService,
            $this->createMock(Logger::class),
            $this->createMock(ErrorLogService::class)
        );

        $Silian_response = $Silian_controller->completeAuthentication(
            makeRequest('POST', '/auth/passkey/login/verify', [
                'challenge_id' => 'challenge-123',
                'credential' => ['id' => 'cred-1'],
            ]),
            new Response()
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame('jwt-token', $Silian_payload['data']['token']);
        $this->assertSame('sarah', $Silian_payload['data']['user']['username']);
        $this->assertSame('cred-1', $Silian_payload['data']['passkey']['credential_id']);
    }

    public function testUpdateReturnsUpdatedPasskey(): void
    {
        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->method('getCurrentUser')->willReturn([
            'id' => 5,
            'uuid' => '550e8400-e29b-41d4-a716-4466554400aa',
        ]);

        $Silian_passkeyService = $this->createMock(PasskeyService::class);
        $Silian_passkeyService->expects($this->once())
            ->method('updateLabelForUser')
            ->with([
                'id' => 5,
                'uuid' => '550e8400-e29b-41d4-a716-4466554400aa',
            ], 11, 'Office Key')
            ->willReturn([
                'id' => 11,
                'label' => 'Office Key',
                'credential_id' => 'cred-1',
            ]);

        $Silian_controller = new PasskeyController(
            $Silian_authService,
            $Silian_passkeyService,
            $this->createMock(Logger::class),
            $this->createMock(ErrorLogService::class)
        );

        $Silian_response = $Silian_controller->update(
            makeRequest('PATCH', '/users/me/passkeys/11', ['label' => 'Office Key']),
            new Response(),
            ['id' => '11']
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame('Office Key', $Silian_payload['data']['passkey']['label']);
    }

    public function testAdminListRequiresAdminAccess(): void
    {
        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->method('getCurrentUser')->willReturn(['id' => 5, 'is_admin' => false]);
        $Silian_authService->method('isAdminUser')->willReturn(false);

        $Silian_controller = new PasskeyController(
            $Silian_authService,
            $this->createMock(PasskeyService::class),
            $this->createMock(Logger::class),
            $this->createMock(ErrorLogService::class)
        );

        $Silian_response = $Silian_controller->adminList(
            makeRequest('GET', '/admin/passkeys'),
            new Response()
        );

        $this->assertSame(403, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertFalse($Silian_payload['success']);
        $this->assertSame('ACCESS_DENIED', $Silian_payload['code']);
    }

    public function testAdminStatsReturnsServicePayload(): void
    {
        $Silian_authService = $this->createMock(AuthService::class);
        $Silian_authService->method('getCurrentUser')->willReturn(['id' => 1, 'is_admin' => true]);
        $Silian_authService->method('isAdminUser')->willReturn(true);

        $Silian_passkeyService = $this->createMock(PasskeyService::class);
        $Silian_passkeyService->expects($this->once())
            ->method('getAdminStats')
            ->with(1)
            ->willReturn([
                'users_with_passkeys' => 3,
                'total_active_passkeys' => 7,
                'new_passkeys_30d' => 2,
                'passkey_logins_7d' => 4,
                'passkey_logins_30d' => 9,
            ]);

        $Silian_controller = new PasskeyController(
            $Silian_authService,
            $Silian_passkeyService,
            $this->createMock(Logger::class),
            $this->createMock(ErrorLogService::class)
        );

        $Silian_response = $Silian_controller->adminStats(
            makeRequest('GET', '/admin/passkeys/stats'),
            new Response()
        );

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string) $Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame(7, $Silian_payload['data']['total_active_passkeys']);
    }
}
