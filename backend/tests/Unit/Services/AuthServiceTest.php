<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\ErrorLogService;
use Firebase\JWT\JWT;
use PHPUnit\Framework\TestCase;
use PDO;

class AuthServiceTest extends TestCase
{
    private AuthService $authService;
    private string $jwtSecret = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
    private AuditLogService $auditLogService;
    private ErrorLogService $errorLogService;

    protected function setUp(): void
    {
        parent::setUp();

        // Mock PDO for testing
        $Silian_mockPdo = $this->createMock(\PDO::class);
        $this->auditLogService = $this->createMock(AuditLogService::class);
        $this->errorLogService = $this->createMock(ErrorLogService::class);

        $this->authService = new AuthService($this->jwtSecret, 'HS256', 86400, $this->auditLogService, $this->errorLogService);
        $this->authService->setDatabase($Silian_mockPdo);
    }

    public function testGenerateJwtToken(): void
    {
        $Silian_user = [
            'id' => 1,
            'uuid' => 'test-uuid',
            'username' => 'testuser',
            'email' => 'test@example.com',
            'is_admin' => false
        ];

        $Silian_token = $this->authService->generateJwtToken($Silian_user);

        $this->assertIsString($Silian_token);
        $this->assertNotEmpty($Silian_token);

        // Token should have 3 parts separated by dots
        $Silian_parts = explode('.', $Silian_token);
        $this->assertCount(3, $Silian_parts);
    }

    public function testValidateJwtToken(): void
    {
        $Silian_user = [
            'id' => 1,
            'uuid' => '550e8400-e29b-41d4-a716-446655440000',
            'username' => 'testuser',
            'email' => 'test@example.com',
            'is_admin' => false
        ];

        $Silian_token = $this->authService->generateJwtToken($Silian_user);
        $Silian_decoded = $this->authService->validateJwtToken($Silian_token);

        $this->assertIsArray($Silian_decoded);
        $this->assertEquals($Silian_user['id'], $Silian_decoded['user']->id);
        $this->assertEquals($Silian_user['username'], $Silian_decoded['user']->username);
        $this->assertEquals($Silian_user['uuid'], $Silian_decoded['user']->uuid);
    }

    public function testValidateTokenNormalizesUuidIntoMiddlewarePayload(): void
    {
        $Silian_user = [
            'id' => 42,
            'uuid' => '550e8400-e29b-41d4-a716-446655440042',
            'username' => 'uuid-user',
            'email' => 'uuid@example.com',
            'is_admin' => false,
        ];

        $Silian_token = $this->authService->generateJwtToken($Silian_user);
        $Silian_payload = $this->authService->validateToken($Silian_token);

        $this->assertSame($Silian_user['id'], $Silian_payload['user_id']);
        $this->assertSame($Silian_user['uuid'], $Silian_payload['uuid']);
        $this->assertSame($Silian_user['email'], $Silian_payload['email']);
        $this->assertSame('user', $Silian_payload['role']);
        $this->assertSame($Silian_user['uuid'], $Silian_payload['user']['uuid']);
    }

    public function testGenerateTokenMarksSupportUsers(): void
    {
        $Silian_user = [
            'id' => 7,
            'uuid' => '550e8400-e29b-41d4-a716-446655440007',
            'username' => 'support-user',
            'email' => 'support@example.com',
            'role' => 'support',
            'is_admin' => false,
        ];

        $Silian_token = $this->authService->generateToken($Silian_user);
        $Silian_payload = $this->authService->validateToken($Silian_token);

        $this->assertSame('support', $Silian_payload['role']);
        $this->assertTrue($Silian_payload['user']['is_support']);
        $this->assertFalse($Silian_payload['user']['is_admin']);
    }

    public function testNormalizeUserRoleViewNormalizesFlagsConsistently(): void
    {
        $Silian_normalized = $this->authService->normalizeUserRoleView([
            'role' => 'support',
            'is_admin' => 0,
        ]);

        $this->assertSame('support', $Silian_normalized['role']);
        $this->assertFalse($Silian_normalized['is_admin']);
        $this->assertTrue($Silian_normalized['is_support']);
    }

    public function testGenerateJwtTokenUsesUuidAsSubjectWhenAvailable(): void
    {
        $Silian_user = [
            'id' => 9,
            'uuid' => '550e8400-e29b-41d4-a716-446655440009',
            'username' => 'subject-user',
            'email' => 'subject@example.com',
            'is_admin' => false,
        ];

        $Silian_token = $this->authService->generateJwtToken($Silian_user);
        $Silian_decoded = $this->authService->validateJwtToken($Silian_token);

        $this->assertIsArray($Silian_decoded);
        $this->assertSame($Silian_user['uuid'], $Silian_decoded['sub']);
    }

    public function testValidateTokenResolvesLocalUserIdFromUuidSubject(): void
    {
        $Silian_pdo = $this->makeSqliteUsersPdo();
        $Silian_pdo->exec(
            "INSERT INTO users (uuid, username, email, password, status, points, is_admin, created_at, updated_at)
             VALUES ('550e8400-e29b-41d4-a716-4466554400aa', 'uuid-user', 'uuid-user@example.com', 'hash', 'active', 0, 0, '2026-03-11 00:00:00', '2026-03-11 00:00:00')"
        );

        $Silian_service = new AuthService($this->jwtSecret, 'HS256', 86400, $this->auditLogService, $this->errorLogService);
        $Silian_service->setDatabase($Silian_pdo);

        $Silian_token = JWT::encode([
            'iss' => 'carbontrack',
            'aud' => 'carbontrack-users',
            'iat' => time(),
            'exp' => time() + 3600,
            'sub' => '550e8400-e29b-41d4-a716-4466554400aa',
            'user' => [
                'uuid' => '550e8400-e29b-41d4-a716-4466554400aa',
                'username' => 'uuid-user',
                'email' => 'uuid-user@example.com',
                'is_admin' => false,
            ],
        ], $this->jwtSecret, 'HS256');

        $Silian_payload = $Silian_service->validateToken($Silian_token);

        $this->assertSame('550e8400-e29b-41d4-a716-4466554400aa', $Silian_payload['uuid']);
        $this->assertSame(1, $Silian_payload['user_id']);
        $this->assertSame(1, $Silian_payload['user']['id']);
    }

    public function testValidateTokenProvisionLocalUserWhenUuidOnlyIdentityArrives(): void
    {
        $Silian_pdo = $this->makeSqliteUsersPdo();
        $Silian_service = new AuthService($this->jwtSecret, 'HS256', 86400, $this->auditLogService, $this->errorLogService);
        $Silian_service->setDatabase($Silian_pdo);

        $Silian_token = JWT::encode([
            'iss' => 'carbontrack',
            'aud' => 'carbontrack-users',
            'iat' => time(),
            'exp' => time() + 3600,
            'sub' => '550e8400-e29b-41d4-a716-4466554400ab',
            'user' => [
                'uuid' => '550e8400-e29b-41d4-a716-4466554400ab',
                'username' => 'new-sso-user',
                'email' => 'new-sso-user@example.com',
                'is_admin' => false,
            ],
        ], $this->jwtSecret, 'HS256');

        $Silian_payload = $Silian_service->validateToken($Silian_token);

        $this->assertSame('550e8400-e29b-41d4-a716-4466554400ab', $Silian_payload['uuid']);
        $this->assertIsInt($Silian_payload['user_id']);
        $this->assertGreaterThan(0, $Silian_payload['user_id']);
        $this->assertSame(1, (int) $Silian_pdo->query('SELECT COUNT(*) FROM users')->fetchColumn());
        $this->assertSame('new-sso-user', $Silian_pdo->query('SELECT username FROM users LIMIT 1')->fetchColumn());
    }

    public function testValidateTokenProvisionLocalUserNormalizesUnknownRole(): void
    {
        $Silian_pdo = $this->makeSqliteUsersPdo();
        $Silian_service = new AuthService($this->jwtSecret, 'HS256', 86400, $this->auditLogService, $this->errorLogService);
        $Silian_service->setDatabase($Silian_pdo);

        $Silian_token = JWT::encode([
            'iss' => 'carbontrack',
            'aud' => 'carbontrack-users',
            'iat' => time(),
            'exp' => time() + 3600,
            'sub' => '550e8400-e29b-41d4-a716-4466554400ac',
            'user' => [
                'uuid' => '550e8400-e29b-41d4-a716-4466554400ac',
                'username' => 'unknown-role-user',
                'email' => 'unknown-role-user@example.com',
                'role' => 'moderator',
                'is_admin' => false,
            ],
        ], $this->jwtSecret, 'HS256');

        $Silian_payload = $Silian_service->validateToken($Silian_token);

        $this->assertSame('user', $Silian_payload['role']);
        $this->assertSame('user', $Silian_pdo->query('SELECT role FROM users LIMIT 1')->fetchColumn());
        $this->assertSame(0, (int) $Silian_pdo->query('SELECT is_admin FROM users LIMIT 1')->fetchColumn());
    }

    public function testValidateJwtTokenWithInvalidToken(): void
    {
        $Silian_result = $this->authService->validateJwtToken('invalid.token.here');
        $this->assertNull($Silian_result);
    }

    public function testValidateJwtTokenWithExpiredToken(): void
    {
        // Create service with very short expiration for testing
        $Silian_shortExpiryService = new AuthService($this->jwtSecret, 'HS256', -1); // Already expired

        $Silian_user = [
            'id' => 1,
            'uuid' => 'test-uuid',
            'username' => 'testuser',
            'email' => 'test@example.com',
            'is_admin' => false
        ];

        $Silian_expiredToken = $Silian_shortExpiryService->generateJwtToken($Silian_user);
        $Silian_result = $this->authService->validateJwtToken($Silian_expiredToken);

        $this->assertNull($Silian_result);
    }

    public function testHashPassword(): void
    {
        $Silian_password = 'testpassword123';
        $Silian_hash = $this->authService->hashPassword($Silian_password);

        $this->assertIsString($Silian_hash);
        $this->assertNotEquals($Silian_password, $Silian_hash);
        $this->assertTrue(password_verify($Silian_password, $Silian_hash));
    }

    public function testVerifyPassword(): void
    {
        $Silian_password = 'testpassword123';
        $Silian_hash = $this->authService->hashPassword($Silian_password);

        $this->assertTrue($this->authService->verifyPassword($Silian_password, $Silian_hash));
        $this->assertFalse($this->authService->verifyPassword('wrongpassword', $Silian_hash));
    }

    public function testValidateEmail(): void
    {
        $this->assertTrue($this->authService->validateEmail('test@example.com'));
        $this->assertTrue($this->authService->validateEmail('user.name+tag@domain.co.uk'));

        $this->assertFalse($this->authService->validateEmail('invalid-email'));
        $this->assertFalse($this->authService->validateEmail('test@'));
        $this->assertFalse($this->authService->validateEmail('@example.com'));
    }

    public function testValidatePasswordStrength(): void
    {
        $Silian_result = $this->authService->validatePasswordStrength('StrongPass123');
        $this->assertTrue($Silian_result['valid']);
        $this->assertEmpty($Silian_result['errors']);

        $Silian_result = $this->authService->validatePasswordStrength('weak');
        $this->assertFalse($Silian_result['valid']);
        $this->assertNotEmpty($Silian_result['errors']);
    }

    public function testIsAdmin(): void
    {
        $Silian_adminUser = ['id' => 1, 'username' => 'admin', 'is_admin' => true];
        $Silian_regularUser = ['id' => 2, 'username' => 'user', 'is_admin' => false];

        $this->assertTrue($this->authService->isAdminUser($Silian_adminUser));
        $this->assertFalse($this->authService->isAdminUser($Silian_regularUser));
    }

    public function testIsSupportUserAcceptsSupportAndAdmin(): void
    {
        $Silian_supportUser = ['id' => 2, 'username' => 'support', 'role' => 'support', 'is_admin' => false];
        $Silian_adminUser = ['id' => 1, 'username' => 'admin', 'role' => 'admin', 'is_admin' => true];
        $Silian_regularUser = ['id' => 3, 'username' => 'user', 'role' => 'user', 'is_admin' => false];

        $this->assertTrue($this->authService->isSupportUser($Silian_supportUser));
        $this->assertTrue($this->authService->isSupportUser($Silian_adminUser));
        $this->assertFalse($this->authService->isSupportUser($Silian_regularUser));
    }

    public function testGenerateSecureToken(): void
    {
        $Silian_token1 = $this->authService->generateSecureToken();
        $Silian_token2 = $this->authService->generateSecureToken();

        $this->assertIsString($Silian_token1);
        $this->assertIsString($Silian_token2);
        $this->assertEquals(64, strlen($Silian_token1)); // 32 bytes = 64 hex chars
        $this->assertNotEquals($Silian_token1, $Silian_token2); // Should be unique
    }

    public function testIsAccountLockedLogsAuditWhenThresholdReached(): void
    {
        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->expects($this->once())->method('execute')->with(['locked-user', '127.0.0.1']);
        $Silian_stmt->method('fetchColumn')->willReturn(5);

        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_pdo->expects($this->once())->method('prepare')->willReturn($Silian_stmt);

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('log')
            ->with($this->callback(function (array $Silian_payload): bool {
                return ($Silian_payload['action'] ?? null) === 'auth_account_locked'
                    && ($Silian_payload['operation_category'] ?? null) === 'authentication'
                    && ($Silian_payload['data']['failed_attempts'] ?? null) === 5;
            }))
            ->willReturn(true);

        $Silian_service = new AuthService($this->jwtSecret, 'HS256', 86400, $Silian_audit, $this->createMock(ErrorLogService::class));
        $Silian_service->setDatabase($Silian_pdo);

        $this->assertTrue($Silian_service->isAccountLocked('locked-user', '127.0.0.1'));
    }

    private function makeSqliteUsersPdo(): PDO
    {
        $Silian_pdo = new PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $Silian_pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $Silian_pdo->exec(
            'CREATE TABLE users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT,
                username TEXT UNIQUE,
                email TEXT UNIQUE,
                password TEXT,
                role TEXT DEFAULT \'user\',
                status TEXT,
                points INTEGER DEFAULT 0,
                is_admin INTEGER DEFAULT 0,
                deleted_at TEXT,
                created_at TEXT,
                updated_at TEXT
            )'
        );

        return $Silian_pdo;
    }
}

