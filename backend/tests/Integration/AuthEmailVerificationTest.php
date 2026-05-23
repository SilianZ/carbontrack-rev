<?php

declare(strict_types=1);

use CarbonTrack\Controllers\AuthController;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\CloudflareR2Service;
use CarbonTrack\Services\EmailService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\MessageService;
use CarbonTrack\Services\TurnstileService;
use CarbonTrack\Services\RegionService;
use Monolog\Handler\StreamHandler;
use Monolog\Logger;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Response;

final class AuthEmailVerificationTest extends TestCase
{
    private PDO $pdo;

    protected function setUp(): void
    {
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->exec("
            CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
                email TEXT,
                password TEXT,
                school_id INTEGER,
                is_admin INTEGER DEFAULT 0,
                points INTEGER DEFAULT 0,
                avatar_id INTEGER,
                created_at TEXT,
                updated_at TEXT,
                deleted_at TEXT,
                reset_token TEXT,
                reset_token_expires_at TEXT,
                email_verified_at TEXT,
                verification_code TEXT,
                verification_token TEXT,
                verification_code_expires_at TEXT,
                verification_attempts INTEGER DEFAULT 0,
                verification_send_count INTEGER DEFAULT 0,
                verification_last_sent_at TEXT,
                notification_email_mask INTEGER DEFAULT 0
            );
        ");
        $this->pdo->exec("CREATE TABLE schools (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, deleted_at TEXT);");
        $this->pdo->exec("CREATE TABLE avatars (id INTEGER PRIMARY KEY AUTOINCREMENT, file_path TEXT);");
    }

    /**
     * @return array{controller: AuthController, email: EmailService&MockObject}
     */
    private function makeController(): array
    {
        /** @var AuthService&MockObject $auth */
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('generateToken')->willReturn('test-jwt');
        /** @var EmailService&MockObject $email */
        $Silian_email = $this->createMock(EmailService::class);
        /** @var TurnstileService&MockObject $turnstile */
        $Silian_turnstile = $this->createMock(TurnstileService::class);
        $Silian_turnstile->method('verify')->willReturn(['success' => true]);
        /** @var AuditLogService&MockObject $audit */
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->method('logAuthOperation')->willReturn(true);
        /** @var MessageService&MockObject $msg */
        $Silian_msg = $this->createMock(MessageService::class);
        /** @var CloudflareR2Service&MockObject $r2 */
        $Silian_r2 = $this->createMock(CloudflareR2Service::class);
        /** @var ErrorLogService&MockObject $err */
        $Silian_err = $this->createMock(ErrorLogService::class);
        /** @var RegionService&MockObject $region */
        $Silian_region = $this->createMock(RegionService::class);

        $Silian_logger = new Logger('test-email-verification');
        $Silian_logger->pushHandler(new StreamHandler('php://stdout', Logger::WARNING));

        $Silian_controller = new AuthController(
            $Silian_auth,
            $Silian_email,
            $Silian_turnstile,
            $Silian_audit,
            $Silian_msg,
            $Silian_r2,
            $Silian_logger,
            $this->pdo,
            $Silian_err,
            $Silian_region
        );

        return ['controller' => $Silian_controller, 'email' => $Silian_email];
    }

    public function testSendVerificationCodeDispatchesEmail(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $this->pdo->prepare("
            INSERT INTO users (username, email, password, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
        ")->execute(['alice', 'alice@example.com', password_hash('Secret123!', PASSWORD_DEFAULT), $Silian_now, $Silian_now]);

        $Silian_setup = $this->makeController();
        $Silian_controller = $Silian_setup['controller'];
        $Silian_emailMock = $Silian_setup['email'];
        $Silian_emailMock->expects($this->once())
            ->method('sendVerificationCode')
            ->willReturn(true);

        $Silian_request = makeRequest('POST', '/auth/send-verification-code', [
            'email' => 'alice@example.com',
            'cf_turnstile_response' => 'valid-turnstile-token'
        ]);
        $Silian_response = $Silian_controller->sendVerificationCode($Silian_request, new Response());

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string)$Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertArrayHasKey('data', $Silian_payload);

        $Silian_row = $this->pdo->query("SELECT verification_token, verification_send_count FROM users WHERE email='alice@example.com'")->fetch(PDO::FETCH_ASSOC);
        $this->assertNotEmpty($Silian_row['verification_token']);
        $this->assertSame(1, (int)$Silian_row['verification_send_count']);
    }

    public function testVerifyEmailWithTokenMarksUserVerified(): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_token = bin2hex(random_bytes(16));
        $this->pdo->prepare("
            INSERT INTO users (username, email, password, created_at, updated_at, verification_token, verification_code_expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        ")->execute([
            'bob',
            'bob@example.com',
            password_hash('Secret123!', PASSWORD_DEFAULT),
            $Silian_now,
            $Silian_now,
            $Silian_token,
            (new \DateTimeImmutable('+30 minutes'))->format('Y-m-d H:i:s')
        ]);

        $Silian_setup = $this->makeController();
        $Silian_controller = $Silian_setup['controller'];
        // Verification email not sent in this test, so no expectation on email mock

        $Silian_request = makeRequest('POST', '/auth/verify-email', ['token' => $Silian_token]);
        $Silian_response = $Silian_controller->verifyEmail($Silian_request, new Response());

        $this->assertSame(200, $Silian_response->getStatusCode());
        $Silian_payload = json_decode((string)$Silian_response->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertArrayHasKey('data', $Silian_payload);
        $this->assertArrayHasKey('token', $Silian_payload['data']);
        $this->assertArrayHasKey('user', $Silian_payload['data']);
        $this->assertSame('bob@example.com', $Silian_payload['data']['user']['email']);
        $this->assertNotEmpty($Silian_payload['data']['user']['email_verified_at']);

        $Silian_row = $this->pdo->query("SELECT email_verified_at, verification_token FROM users WHERE email='bob@example.com'")->fetch(PDO::FETCH_ASSOC);
        $this->assertNotEmpty($Silian_row['email_verified_at']);
        $this->assertNull($Silian_row['verification_token']);
    }
}
