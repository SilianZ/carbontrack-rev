<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;
use CarbonTrack\Controllers\AuthController;
use CarbonTrack\Services\{AuthService, EmailService, TurnstileService, AuditLogService, ErrorLogService, MessageService, CloudflareR2Service, RegionService};
use Monolog\Logger;
use Monolog\Handler\StreamHandler;
use Slim\Psr7\Response;
use Slim\Psr7\Factory\ServerRequestFactory;
use Psr\Http\Message\ServerRequestInterface as Request;

final class AuthRegistrationNewSchoolTest extends TestCase
{
    private PDO $pdo;
    private RegionService $regionService;

    protected function setUp(): void
    {
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        // Minimal schema: users & schools
        $this->pdo->exec("CREATE TABLE schools (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT);");
        $this->pdo->exec("CREATE TABLE users (id INTEGER PRIMARY KEY AUTOINCREMENT, uuid TEXT, username TEXT, email TEXT, password TEXT, school_id INTEGER, is_admin INTEGER DEFAULT 0, role TEXT DEFAULT 'user', points INTEGER DEFAULT 0, region_code TEXT, created_at TEXT, updated_at TEXT, deleted_at TEXT, reset_token TEXT, reset_token_expires_at TEXT, email_verified_at TEXT, verification_code TEXT, verification_token TEXT, verification_code_expires_at TEXT, verification_attempts INTEGER DEFAULT 0, verification_send_count INTEGER DEFAULT 0, verification_last_sent_at TEXT, notification_email_mask INTEGER DEFAULT 0);");
        $this->regionService = new RegionService(null, null);
    }

    private function makeController(): AuthController
    {
        // Use PHPUnit mocks – acceptable in tests; underlying type hints allow subclass mocks
        /** @var AuthService&PHPUnit\Framework\MockObject\MockObject $auth */
        $Silian_auth = $this->createMock(AuthService::class);
        $Silian_auth->method('generateToken')->willReturn('fake-jwt');
        /** @var EmailService&PHPUnit\Framework\MockObject\MockObject $email */
        $Silian_email = $this->createMock(EmailService::class);
        $Silian_email->method('sendWelcomeEmail')->willReturn(true);
        $Silian_email->expects($this->once())->method('sendVerificationCode')->willReturn(true);
        /** @var TurnstileService&PHPUnit\Framework\MockObject\MockObject $turnstile */
        $Silian_turnstile = $this->createMock(TurnstileService::class);
    // TurnstileService::verify has return type array; mock must respect signature
    $Silian_turnstile->method('verify')->willReturn(['success' => true]);
        /** @var AuditLogService&PHPUnit\Framework\MockObject\MockObject $audit */
        $Silian_audit = $this->createMock(AuditLogService::class);
    $Silian_audit->method('logAuthOperation')->willReturn(true);
        /** @var MessageService&PHPUnit\Framework\MockObject\MockObject $msg */
        $Silian_msg = $this->createMock(MessageService::class);
        /** @var CloudflareR2Service&PHPUnit\Framework\MockObject\MockObject $r2 */
        $Silian_r2 = $this->createMock(CloudflareR2Service::class);
        $Silian_logger = new Logger('test');
        $Silian_logger->pushHandler(new StreamHandler('php://stdout', Logger::WARNING));
        /** @var ErrorLogService&PHPUnit\Framework\MockObject\MockObject $err */
        $Silian_err = $this->createMock(ErrorLogService::class);
        $Silian_region = $this->regionService;

        return new AuthController($Silian_auth, $Silian_email, $Silian_turnstile, $Silian_audit, $Silian_msg, $Silian_r2, $Silian_logger, $this->pdo, $Silian_err, $Silian_region);
    }

    private function makeRequest(array $Silian_body): Request
    {
        $Silian_factory = new ServerRequestFactory();
        $Silian_req = $Silian_factory->createServerRequest('POST', '/api/v1/auth/register');
        return $Silian_req->withParsedBody($Silian_body);
    }

    public function testRegistrationCreatesNewSchoolWhenOnlyNewSchoolNameProvided(): void
    {
        $Silian_controller = $this->makeController();
        $Silian_pwd = 'Password123!';
        $Silian_body = [
            'username' => 'user_new_school',
            'email' => 'user_new_school@example.com',
            'password' => $Silian_pwd,
            'confirm_password' => $Silian_pwd,
            'new_school_name' => 'Carbon Innovation Institute',
            'country_code' => 'CN',
            'state_code' => 'GD',
            'cf_turnstile_response' => 'test_turnstile_token'
        ];
        $Silian_resp = new Response();
        $Silian_out = $Silian_controller->register($this->makeRequest($Silian_body), $Silian_resp);
        $Silian_data = json_decode((string)$Silian_out->getBody(), true);
        $this->assertEquals(201, $Silian_out->getStatusCode(), 'Should return 201 Created');
        $this->assertTrue($Silian_data['success']);
        // School should be created
        $Silian_stmt = $this->pdo->query("SELECT COUNT(*) AS c FROM schools WHERE LOWER(name)=LOWER('Carbon Innovation Institute')");
        $Silian_count = (int)$Silian_stmt->fetch(PDO::FETCH_ASSOC)['c'];
        $this->assertEquals(1, $Silian_count, 'School should have been inserted exactly once');
        // User should reference that school
        $Silian_stmt = $this->pdo->query("SELECT u.school_id, s.name FROM users u LEFT JOIN schools s ON u.school_id = s.id WHERE u.email='user_new_school@example.com'");
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
        $this->assertNotEmpty($Silian_row['school_id']);
        $this->assertEquals('Carbon Innovation Institute', $Silian_row['name']);
    }

    public function testRegistrationPrefersExistingSchoolWhenBothProvided(): void
    {
        // Seed an existing school
        $Silian_now = date('Y-m-d H:i:s');
        $this->pdo->exec("INSERT INTO schools (name, created_at, updated_at) VALUES ('Existing Academy', '$Silian_now', '$Silian_now')");
        $Silian_schoolId = (int)$this->pdo->lastInsertId();

        $Silian_controller = $this->makeController();
        $Silian_pwd = 'Password123!';
        $Silian_body = [
            'username' => 'user_existing_school',
            'email' => 'user_existing_school@example.com',
            'password' => $Silian_pwd,
            'confirm_password' => $Silian_pwd,
            'school_id' => $Silian_schoolId,
            'new_school_name' => 'Another New School Name', // should be ignored
            'country_code' => 'CN',
            'state_code' => 'GD',
            'cf_turnstile_response' => 'test_turnstile_token'
        ];
        $Silian_resp = new Response();
        $Silian_out = $Silian_controller->register($this->makeRequest($Silian_body), $Silian_resp);
        $Silian_data = json_decode((string)$Silian_out->getBody(), true);
        $this->assertEquals(201, $Silian_out->getStatusCode());
        $this->assertTrue($Silian_data['success']);
        // Ensure no new school was inserted with the new name
        $Silian_stmt = $this->pdo->query("SELECT COUNT(*) AS c FROM schools WHERE LOWER(name)=LOWER('Another New School Name')");
        $Silian_count = (int)$Silian_stmt->fetch(PDO::FETCH_ASSOC)['c'];
        $this->assertEquals(0, $Silian_count, 'Should not create a new school when school_id is provided');
        // User should reference original school id
        $Silian_stmt = $this->pdo->query("SELECT school_id FROM users WHERE email='user_existing_school@example.com'");
        $Silian_userSchool = (int)$Silian_stmt->fetch(PDO::FETCH_ASSOC)['school_id'];
        $this->assertEquals($Silian_schoolId, $Silian_userSchool);
    }
}
