<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use CarbonTrack\Controllers\AuthController;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\EmailService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\TurnstileService;
use CarbonTrack\Services\MessageService;
use CarbonTrack\Services\CloudflareR2Service;
use CarbonTrack\Services\RegionService;
use CarbonTrack\Services\CheckinService;
use CarbonTrack\Services\UserProfileViewService;
use PHPUnit\Framework\TestCase;

class AuthControllerTest extends TestCase
{
    public function testAuthControllerCanBeInstantiated(): void
    {
        // Create mocks
        $Silian_mockAuthService = $this->createMock(AuthService::class);
        $Silian_mockEmailService = $this->createMock(EmailService::class);
        $Silian_mockTurnstileService = $this->createMock(TurnstileService::class);
        $Silian_mockAuditLogService = $this->createMock(AuditLogService::class);
        $Silian_mockMessageService = $this->createMock(MessageService::class);
        $Silian_mockR2Service = $this->createMock(CloudflareR2Service::class);
        $Silian_mockLogger = $this->createMock(\Monolog\Logger::class);
        $Silian_mockPdo = $this->createMock(\PDO::class);
        $Silian_mockRegion = $this->createMock(RegionService::class);

        $Silian_authController = new AuthController(
            $Silian_mockAuthService,
            $Silian_mockEmailService,
            $Silian_mockTurnstileService,
            $Silian_mockAuditLogService,
            $Silian_mockMessageService,
            $Silian_mockR2Service,
            $Silian_mockLogger,
            $Silian_mockPdo,
            $this->createMock(\CarbonTrack\Services\ErrorLogService::class),
            $Silian_mockRegion
        );

        $this->assertInstanceOf(AuthController::class, $Silian_authController);
    }

    public function testAuthControllerHasRequiredMethods(): void
    {
        $this->assertTrue(method_exists(AuthController::class, 'register'));
        $this->assertTrue(method_exists(AuthController::class, 'login'));
        $this->assertTrue(method_exists(AuthController::class, 'logout'));
        $this->assertTrue(method_exists(AuthController::class, 'sendVerificationCode'));
        $this->assertTrue(method_exists(AuthController::class, 'verifyEmail'));
        $this->assertTrue(method_exists(AuthController::class, 'me'));
        $this->assertTrue(method_exists(AuthController::class, 'forgotPassword'));
        $this->assertTrue(method_exists(AuthController::class, 'resetPassword'));
        $this->assertTrue(method_exists(AuthController::class, 'changePassword'));
    }

    public function testAuthControllerMethodsArePublic(): void
    {
        $Silian_reflection = new \ReflectionClass(AuthController::class);

        $Silian_registerMethod = $Silian_reflection->getMethod('register');
        $this->assertTrue($Silian_registerMethod->isPublic());

        $Silian_loginMethod = $Silian_reflection->getMethod('login');
        $this->assertTrue($Silian_loginMethod->isPublic());

        $Silian_logoutMethod = $Silian_reflection->getMethod('logout');
        $this->assertTrue($Silian_logoutMethod->isPublic());

        $Silian_meMethod = $Silian_reflection->getMethod('me');
        $this->assertTrue($Silian_meMethod->isPublic());
    }

    public function testMeUsesCompatibleSchoolAndRegionFields(): void
    {
        $Silian_mockAuthService = $this->createMock(AuthService::class);
        $Silian_mockEmailService = $this->createMock(EmailService::class);
        $Silian_mockTurnstileService = $this->createMock(TurnstileService::class);
        $Silian_mockAuditLogService = $this->createMock(AuditLogService::class);
        $Silian_mockMessageService = $this->createMock(MessageService::class);
        $Silian_mockLogger = $this->createMock(\Monolog\Logger::class);
        $Silian_mockRegion = $this->createMock(RegionService::class);
        $Silian_mockRegion->method('getRegionContext')
            ->with('US-UM-81')
            ->willReturn([
                'region_code' => 'US-UM-81',
                'region_label' => 'US-UM-81',
                'country_code' => 'US',
                'state_code' => 'UM-81',
                'country_name' => 'United States',
                'state_name' => null,
            ]);

        $Silian_selectStmt = $this->createMock(\PDOStatement::class);
        $Silian_selectStmt->method('execute')->willReturn(true);
        $Silian_selectStmt->method('fetch')->willReturn([
            'id' => 5,
            'uuid' => 'u-5',
            'username' => 'legacy-user',
            'email' => 'legacy@example.com',
            'school_id' => null,
            'school_name' => null,
            'school' => 'Legacy Academy',
            'region_code' => null,
            'location' => 'US-UM-81',
            'points' => 9,
            'is_admin' => 0,
            'avatar_id' => null,
            'avatar_path' => null,
            'created_at' => '2025-01-01 00:00:00',
        ]);

        $Silian_unreadStmt = $this->createMock(\PDOStatement::class);
        $Silian_unreadStmt->method('execute')->willReturn(true);
        $Silian_unreadStmt->method('fetchColumn')->willReturn(3);

        $Silian_mockPdo = $this->createMock(\PDO::class);
        $Silian_mockPdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_selectStmt, $Silian_unreadStmt);

        $Silian_mockAuthService->method('getCurrentUser')->willReturn(['id' => 5]);

        $Silian_controller = new AuthController(
            $Silian_mockAuthService,
            $Silian_mockEmailService,
            $Silian_mockTurnstileService,
            $Silian_mockAuditLogService,
            $Silian_mockMessageService,
            null,
            $Silian_mockLogger,
            $Silian_mockPdo,
            $this->createMock(\CarbonTrack\Services\ErrorLogService::class),
            $Silian_mockRegion,
            null,
            new UserProfileViewService($Silian_mockRegion)
        );

        $Silian_request = makeRequest('GET', '/auth/me');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->me($Silian_request, $Silian_response);

        $this->assertSame(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertSame('Legacy Academy', $Silian_json['data']['school_name']);
        $this->assertSame('US-UM-81', $Silian_json['data']['region_code']);
        $this->assertSame(3, $Silian_json['data']['unread_messages']);
    }

    public function testAuthControllerHasCorrectDependencies(): void
    {
        $Silian_reflection = new \ReflectionClass(AuthController::class);
        $Silian_constructor = $Silian_reflection->getConstructor();
        $Silian_parameters = $Silian_constructor->getParameters();

        $this->assertCount(12, $Silian_parameters);

        $Silian_expectedTypes = [
            'CarbonTrack\Services\AuthService',
            'CarbonTrack\Services\EmailService',
            'CarbonTrack\Services\TurnstileService',
            'CarbonTrack\Services\AuditLogService',
            'CarbonTrack\Services\MessageService',
            'CarbonTrack\Services\CloudflareR2Service',
            'Monolog\Logger',
            'PDO',
            'CarbonTrack\Services\ErrorLogService',
            'CarbonTrack\Services\RegionService',
            'CarbonTrack\Services\CheckinService',
            'CarbonTrack\Services\UserProfileViewService'
        ];
        $Silian_nullableIndexes = [5, 8, 10, 11];

        foreach ($Silian_parameters as $Silian_index => $Silian_parameter) {
            $Silian_type = $Silian_parameter->getType();
            if ($Silian_type instanceof \ReflectionNamedType) {
                $this->assertEquals($Silian_expectedTypes[$Silian_index], $Silian_type->getName());
                if (in_array($Silian_index, $Silian_nullableIndexes, true)) {
                    $this->assertTrue($Silian_type->allowsNull());
                } else {
                    $this->assertFalse($Silian_type->allowsNull());
                }
            }
        }

    }

    public function testLoginCallsAuthAndWritesAudit(): void
    {
        $Silian_mockAuthService = $this->createMock(AuthService::class);
        $Silian_mockEmailService = $this->createMock(EmailService::class);
        $Silian_mockTurnstileService = $this->createMock(TurnstileService::class);
        $Silian_mockAuditLogService = $this->createMock(AuditLogService::class);
        $Silian_mockMessageService = $this->createMock(MessageService::class);
        $Silian_mockR2Service = $this->createMock(CloudflareR2Service::class);
        $Silian_mockLogger = $this->createMock(\Monolog\Logger::class);
        $Silian_mockRegion = $this->createMock(RegionService::class);

        // mock PDO for selecting user and updating last login
        $Silian_selectStmt = $this->createMock(\PDOStatement::class);
        $Silian_selectStmt->method('execute')->willReturn(true);
        $Silian_selectStmt->method('fetch')->willReturn([
            'id' => 1,
            'uuid' => 'u-1',
            'username' => 'john',
            'email' => 'john@example.com',
            'school_id' => 2,
            'school_name' => 'Test School',
            'points' => 0,
            'is_admin' => 0,
            'avatar_url' => null,
            'lastlgn' => null,
            'password_hash' => password_hash('secret', PASSWORD_DEFAULT),
            'email_verified_at' => null,
            'verification_code' => null,
            'verification_code_expires_at' => null,
            'verification_send_count' => 0,
            'verification_last_sent_at' => null
        ]);
        $Silian_updateStmt = $this->createMock(\PDOStatement::class);
        $Silian_updateStmt->method('execute')->willReturn(true);
        $Silian_verificationStmt = $this->createMock(\PDOStatement::class);
        $Silian_verificationStmt->method('execute')->willReturn(true);
        $Silian_mockPdo = $this->createMock(\PDO::class);
        $Silian_mockPdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_selectStmt, $Silian_updateStmt, $Silian_verificationStmt);

        $Silian_mockAuthService->method('generateToken')->willReturn('fake.jwt.token');
        $Silian_mockAuditLogService->expects($this->atLeastOnce())->method('log');
        $Silian_mockAuditLogService->expects($this->any())->method('logAuthOperation');
        $Silian_mockEmailService->expects($this->once())->method('sendVerificationCode')->willReturn(true);

        $Silian_controller = new AuthController(
            $Silian_mockAuthService,
            $Silian_mockEmailService,
            $Silian_mockTurnstileService,
            $Silian_mockAuditLogService,
            $Silian_mockMessageService,
            $Silian_mockR2Service,
            $Silian_mockLogger,
            $Silian_mockPdo,
            $this->createMock(\CarbonTrack\Services\ErrorLogService::class),
            $Silian_mockRegion
        );

        $Silian_request = makeRequest('POST', '/login', ['username' => 'john', 'password' => 'secret']);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->login($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals('fake.jwt.token', $Silian_json['data']['token']);
        $this->assertEquals('john', $Silian_json['data']['user']['username']);
        $this->assertTrue($Silian_json['data']['email_verification_required']);
        $this->assertTrue($Silian_json['data']['email_verification_sent']);
        $this->assertNotEmpty($Silian_json['data']['verification_expires_at']);
    }

    public function testLoginDoesNotResendWhenVerificationStillValid(): void
    {
        $Silian_mockAuthService = $this->createMock(AuthService::class);
        $Silian_mockEmailService = $this->createMock(EmailService::class);
        $Silian_mockTurnstileService = $this->createMock(TurnstileService::class);
        $Silian_mockAuditLogService = $this->createMock(AuditLogService::class);
        $Silian_mockMessageService = $this->createMock(MessageService::class);
        $Silian_mockR2Service = $this->createMock(CloudflareR2Service::class);
        $Silian_mockLogger = $this->createMock(\Monolog\Logger::class);
        $Silian_mockRegion = $this->createMock(RegionService::class);

        $Silian_now = new \DateTimeImmutable('now');
        $Silian_futureExpiry = $Silian_now->modify('+30 minutes')->format('Y-m-d H:i:s');
        $Silian_lastSentAt = $Silian_now->modify('-30 minutes')->format('Y-m-d H:i:s');
        $Silian_resendAvailableAt = (new \DateTimeImmutable($Silian_lastSentAt))->modify('+1 hour')->format('Y-m-d H:i:s');

        $Silian_selectStmt = $this->createMock(\PDOStatement::class);
        $Silian_selectStmt->method('execute')->willReturn(true);
        $Silian_selectStmt->method('fetch')->willReturn([
            'id' => 2,
            'uuid' => 'u-2',
            'username' => 'alice',
            'email' => 'alice@example.com',
            'school_id' => null,
            'school_name' => null,
            'points' => 0,
            'is_admin' => 0,
            'avatar_url' => null,
            'lastlgn' => null,
            'password_hash' => password_hash('secret', PASSWORD_DEFAULT),
            'email_verified_at' => null,
            'verification_code' => '123456',
            'verification_code_expires_at' => $Silian_futureExpiry,
            'verification_send_count' => 1,
            'verification_last_sent_at' => $Silian_lastSentAt
        ]);
        $Silian_updateStmt = $this->createMock(\PDOStatement::class);
        $Silian_updateStmt->method('execute')->willReturn(true);
        $Silian_mockPdo = $this->createMock(\PDO::class);
        $Silian_mockPdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_selectStmt, $Silian_updateStmt);

        $Silian_mockAuthService->method('generateToken')->willReturn('fake.jwt.token');
        $Silian_mockAuditLogService->expects($this->atLeastOnce())->method('log');
        $Silian_mockAuditLogService->expects($this->any())->method('logAuthOperation');
        $Silian_mockEmailService->expects($this->never())->method('sendVerificationCode');

        $Silian_controller = new AuthController(
            $Silian_mockAuthService,
            $Silian_mockEmailService,
            $Silian_mockTurnstileService,
            $Silian_mockAuditLogService,
            $Silian_mockMessageService,
            $Silian_mockR2Service,
            $Silian_mockLogger,
            $Silian_mockPdo,
            $this->createMock(\CarbonTrack\Services\ErrorLogService::class),
            $Silian_mockRegion
        );

        $Silian_request = makeRequest('POST', '/login', ['identifier' => 'alice@example.com', 'password' => 'secret']);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->login($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals('fake.jwt.token', $Silian_json['data']['token']);
        $this->assertEquals('alice', $Silian_json['data']['user']['username']);
        $this->assertTrue($Silian_json['data']['email_verification_required']);
        $this->assertFalse($Silian_json['data']['email_verification_sent']);
        $this->assertSame($Silian_futureExpiry, $Silian_json['data']['verification_expires_at']);
        $this->assertSame($Silian_resendAvailableAt, $Silian_json['data']['verification_resend_available_at']);
    }

    public function testResolveAvatarPrefersPublicUrl(): void
    {
        $Silian_mockAuthService = $this->createMock(AuthService::class);
        $Silian_mockEmailService = $this->createMock(EmailService::class);
        $Silian_mockTurnstileService = $this->createMock(TurnstileService::class);
        $Silian_mockAuditLogService = $this->createMock(AuditLogService::class);
        $Silian_mockMessageService = $this->createMock(MessageService::class);
        $Silian_mockR2Service = $this->createMock(CloudflareR2Service::class);
        $Silian_mockLogger = $this->createMock(\Monolog\Logger::class);
        $Silian_mockPdo = $this->createMock(\PDO::class);
        $Silian_mockRegion = $this->createMock(RegionService::class);

        $Silian_mockR2Service->expects($this->once())
            ->method('getPublicUrl')
            ->with('avatars/default/avatar_01.png')
            ->willReturn('https://r2-dev.carbontrackapp.com/avatars/default/avatar_01.png');
        $Silian_mockR2Service->expects($this->never())->method('generatePresignedUrl');

        $Silian_controller = new AuthController(
            $Silian_mockAuthService,
            $Silian_mockEmailService,
            $Silian_mockTurnstileService,
            $Silian_mockAuditLogService,
            $Silian_mockMessageService,
            $Silian_mockR2Service,
            $Silian_mockLogger,
            $Silian_mockPdo,
            $this->createMock(\CarbonTrack\Services\ErrorLogService::class),
            $Silian_mockRegion
        );

        $Silian_method = new \ReflectionMethod(AuthController::class, 'resolveAvatar');
        $Silian_method->setAccessible(true);
        $Silian_result = $Silian_method->invoke($Silian_controller, '/avatars/default/avatar_01.png');

        $this->assertSame('/avatars/default/avatar_01.png', $Silian_result['avatar_path']);
        $this->assertSame('https://r2-dev.carbontrackapp.com/avatars/default/avatar_01.png', $Silian_result['avatar_url']);
    }

    public function testForgotPasswordRequiresTurnstile(): void
    {
        $Silian_mockAuthService = $this->createMock(AuthService::class);
        $Silian_mockEmailService = $this->createMock(EmailService::class);
        $Silian_mockTurnstileService = $this->createMock(TurnstileService::class);
        $Silian_mockAuditLogService = $this->createMock(AuditLogService::class);
        $Silian_mockMessageService = $this->createMock(MessageService::class);
        $Silian_mockR2Service = $this->createMock(CloudflareR2Service::class);
        $Silian_mockLogger = $this->createMock(\Monolog\Logger::class);
        $Silian_mockPdo = $this->createMock(\PDO::class);
        $Silian_mockRegion = $this->createMock(RegionService::class);

        $Silian_mockTurnstileService->expects($this->never())->method('verify');

        $Silian_controller = new AuthController(
            $Silian_mockAuthService,
            $Silian_mockEmailService,
            $Silian_mockTurnstileService,
            $Silian_mockAuditLogService,
            $Silian_mockMessageService,
            $Silian_mockR2Service,
            $Silian_mockLogger,
            $Silian_mockPdo,
            $this->createMock(\CarbonTrack\Services\ErrorLogService::class),
            $Silian_mockRegion
        );

        $Silian_request = makeRequest('POST', '/auth/forgot-password', ['email' => 'john@example.com']);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->forgotPassword($Silian_request, $Silian_response);
        $this->assertEquals(400, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertFalse($Silian_json['success']);
        $this->assertSame('TURNSTILE_FAILED', $Silian_json['code']);
    }

    public function testSendVerificationCodeRequiresTurnstile(): void
    {
        $Silian_mockAuthService = $this->createMock(AuthService::class);
        $Silian_mockEmailService = $this->createMock(EmailService::class);
        $Silian_mockTurnstileService = $this->createMock(TurnstileService::class);
        $Silian_mockAuditLogService = $this->createMock(AuditLogService::class);
        $Silian_mockMessageService = $this->createMock(MessageService::class);
        $Silian_mockR2Service = $this->createMock(CloudflareR2Service::class);
        $Silian_mockLogger = $this->createMock(\Monolog\Logger::class);
        $Silian_mockPdo = $this->createMock(\PDO::class);
        $Silian_mockRegion = $this->createMock(RegionService::class);

        $Silian_mockTurnstileService->expects($this->never())->method('verify');

        $Silian_controller = new AuthController(
            $Silian_mockAuthService,
            $Silian_mockEmailService,
            $Silian_mockTurnstileService,
            $Silian_mockAuditLogService,
            $Silian_mockMessageService,
            $Silian_mockR2Service,
            $Silian_mockLogger,
            $Silian_mockPdo,
            $this->createMock(\CarbonTrack\Services\ErrorLogService::class),
            $Silian_mockRegion
        );

        $Silian_request = makeRequest('POST', '/auth/send-verification-code', ['email' => 'john@example.com']);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->sendVerificationCode($Silian_request, $Silian_response);
        $this->assertEquals(400, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertFalse($Silian_json['success']);
        $this->assertSame('TURNSTILE_FAILED', $Silian_json['code']);
    }

    public function testRegisterRejectsFailedTurnstileVerification(): void
    {
        $Silian_mockAuthService = $this->createMock(AuthService::class);
        $Silian_mockEmailService = $this->createMock(EmailService::class);
        $Silian_mockTurnstileService = $this->createMock(TurnstileService::class);
        $Silian_mockAuditLogService = $this->createMock(AuditLogService::class);
        $Silian_mockMessageService = $this->createMock(MessageService::class);
        $Silian_mockR2Service = $this->createMock(CloudflareR2Service::class);
        $Silian_mockLogger = $this->createMock(\Monolog\Logger::class);
        $Silian_mockPdo = $this->createMock(\PDO::class);
        $Silian_mockRegion = $this->createMock(RegionService::class);

        $Silian_mockTurnstileService->expects($this->once())
            ->method('verify')
            ->with('bad-token')
            ->willReturn(['success' => false, 'error' => 'invalid-input-secret']);

        $Silian_controller = new AuthController(
            $Silian_mockAuthService,
            $Silian_mockEmailService,
            $Silian_mockTurnstileService,
            $Silian_mockAuditLogService,
            $Silian_mockMessageService,
            $Silian_mockR2Service,
            $Silian_mockLogger,
            $Silian_mockPdo,
            $this->createMock(\CarbonTrack\Services\ErrorLogService::class),
            $Silian_mockRegion
        );

        $Silian_request = makeRequest('POST', '/auth/register', [
            'username' => 'john',
            'email' => 'john@example.com',
            'password' => 'secret123',
            'confirm_password' => 'secret123',
            'cf_turnstile_response' => 'bad-token',
        ]);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->register($Silian_request, $Silian_response);
        $this->assertSame(400, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertFalse($Silian_json['success']);
        $this->assertSame('TURNSTILE_FAILED', $Silian_json['code']);
    }

    public function testLoginRejectsFailedTurnstileVerification(): void
    {
        $Silian_mockAuthService = $this->createMock(AuthService::class);
        $Silian_mockEmailService = $this->createMock(EmailService::class);
        $Silian_mockTurnstileService = $this->createMock(TurnstileService::class);
        $Silian_mockAuditLogService = $this->createMock(AuditLogService::class);
        $Silian_mockMessageService = $this->createMock(MessageService::class);
        $Silian_mockR2Service = $this->createMock(CloudflareR2Service::class);
        $Silian_mockLogger = $this->createMock(\Monolog\Logger::class);
        $Silian_mockPdo = $this->createMock(\PDO::class);
        $Silian_mockRegion = $this->createMock(RegionService::class);

        $Silian_mockTurnstileService->expects($this->once())
            ->method('verify')
            ->with('bad-token')
            ->willReturn(['success' => false, 'error' => 'invalid-input-secret']);

        $Silian_controller = new AuthController(
            $Silian_mockAuthService,
            $Silian_mockEmailService,
            $Silian_mockTurnstileService,
            $Silian_mockAuditLogService,
            $Silian_mockMessageService,
            $Silian_mockR2Service,
            $Silian_mockLogger,
            $Silian_mockPdo,
            $this->createMock(\CarbonTrack\Services\ErrorLogService::class),
            $Silian_mockRegion
        );

        $Silian_request = makeRequest('POST', '/auth/login', [
            'identifier' => 'john@example.com',
            'password' => 'secret123',
            'cf_turnstile_response' => 'bad-token',
        ]);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->login($Silian_request, $Silian_response);
        $this->assertSame(400, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertFalse($Silian_json['success']);
        $this->assertSame('TURNSTILE_FAILED', $Silian_json['code']);
    }
}
