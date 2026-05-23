<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Models\UserPasskey;
use CarbonTrack\Models\WebauthnChallenge;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\NativeWebauthnProvider;
use CarbonTrack\Services\PasskeyConfig;
use CarbonTrack\Services\PasskeyOperationException;
use CarbonTrack\Services\PasskeyService;
use CarbonTrack\Services\RegionService;
use CarbonTrack\Services\WebauthnProviderInterface;
use CarbonTrack\Tests\Integration\TestSchemaBuilder;
use Monolog\Logger;
use PDO;
use PHPUnit\Framework\TestCase;

class PasskeyServiceTest extends TestCase
{
    private PDO $pdo;
    private PasskeyConfig $config;
    private PasskeyService $service;
    private AuditLogService $auditLogService;
    private RegionService $regionService;

    protected function setUp(): void
    {
        parent::setUp();

        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        TestSchemaBuilder::init($this->pdo);

        $this->config = new PasskeyConfig([
            'PASSKEYS_ENABLED' => 'true',
            'PASSKEYS_RP_ID' => 'app.example.test',
            'PASSKEYS_RP_NAME' => 'CarbonTrack Test',
            'PASSKEYS_ORIGINS' => 'https://app.example.test',
            'PASSKEYS_CHALLENGE_TTL_SECONDS' => '300',
            'PASSKEYS_REGISTRATION_TIMEOUT_MS' => '180000',
            'PASSKEYS_AUTHENTICATION_TIMEOUT_MS' => '120000',
        ]);

        $this->auditLogService = $this->createMock(AuditLogService::class);
        $this->auditLogService->method('log')->willReturn(true);

        $this->regionService = $this->createMock(RegionService::class);
        $this->regionService->method('getRegionContext')->willReturn([
            'region_code' => null,
            'region_label' => null,
            'country_code' => null,
            'state_code' => null,
        ]);

        $this->service = $this->createService(new NativeWebauthnProvider());
    }

    public function testBeginRegistrationStoresChallengeAndBuildsOptions(): void
    {
        $this->insertExistingPasskey();

        $Silian_result = $this->service->beginRegistration($this->userFixture(), [
            'label' => 'MacBook Pro',
        ]);

        $this->assertNotEmpty($Silian_result['challenge_id']);
        $this->assertSame('app.example.test', $Silian_result['public_key']['rp']['id']);
        $this->assertSame('CarbonTrack Test', $Silian_result['public_key']['rp']['name']);
        $this->assertCount(1, $Silian_result['public_key']['excludeCredentials']);
        $this->assertSame('existing-credential', $Silian_result['public_key']['excludeCredentials'][0]['id']);
        $this->assertTrue($Silian_result['integration']['available']);
        $this->assertSame('native', $Silian_result['integration']['implementation']);

        $Silian_challengeStmt = $this->pdo->prepare('SELECT * FROM webauthn_challenges WHERE challenge_id = :challenge_id');
        $Silian_challengeStmt->execute(['challenge_id' => $Silian_result['challenge_id']]);
        $Silian_stored = $Silian_challengeStmt->fetch(PDO::FETCH_ASSOC);

        $this->assertNotFalse($Silian_stored);
        $this->assertSame('registration', $Silian_stored['flow_type']);
        $this->assertSame('550e8400-e29b-41d4-a716-4466554400aa', $Silian_stored['user_uuid']);
        $this->assertNotEmpty($Silian_stored['challenge']);
    }

    public function testCompleteRegistrationValidatesAndPersistsPasskey(): void
    {
        $Silian_registration = $this->service->beginRegistration($this->userFixture(), [
            'label' => 'Desk Key',
        ]);
        $Silian_keyPair = $this->generateEcKeyPair();
        $Silian_credential = $this->buildRegistrationCredential(
            $Silian_registration['public_key']['challenge'],
            'https://app.example.test',
            $Silian_keyPair['x'],
            $Silian_keyPair['y'],
            'credential-registration-1'
        );

        $Silian_result = $this->service->completeRegistration($this->userFixture(), [
            'challenge_id' => $Silian_registration['challenge_id'],
            'credential' => $Silian_credential,
        ]);

        $Silian_expectedCredentialId = $this->base64UrlEncode('credential-registration-1');
        $this->assertSame('Desk Key', $Silian_result['label']);
        $this->assertSame($Silian_expectedCredentialId, $Silian_result['credential_id']);
        $this->assertSame(0, $Silian_result['sign_count']);

        $Silian_stored = $this->pdo->query('SELECT * FROM user_passkeys WHERE credential_id = "' . $Silian_expectedCredentialId . '"')->fetch(PDO::FETCH_ASSOC);
        $this->assertIsArray($Silian_stored);
        $Silian_publicKey = json_decode((string) $Silian_stored['public_key'], true);
        $this->assertSame('EC2', $Silian_publicKey['kty']);
        $this->assertSame(-7, $Silian_publicKey['alg']);
        $this->assertSame('internal', json_decode((string) $Silian_stored['transports'], true)[0]);
    }

    public function testCompleteRegistrationParsesCredentialPublicKeyWhenExtensionsFollow(): void
    {
        $Silian_registration = $this->service->beginRegistration($this->userFixture(), [
            'label' => 'Desk Key With Extensions',
        ]);
        $Silian_keyPair = $this->generateEcKeyPair();
        $Silian_credentialIdBytes = 'credential-registration-ext-1';

        $Silian_result = $this->service->completeRegistration($this->userFixture(), [
            'challenge_id' => $Silian_registration['challenge_id'],
            'credential' => $this->buildRegistrationCredential(
                $Silian_registration['public_key']['challenge'],
                'https://app.example.test',
                $Silian_keyPair['x'],
                $Silian_keyPair['y'],
                $Silian_credentialIdBytes,
                $this->cborMap([
                    'credProtect' => 1,
                ])
            ),
        ]);

        $Silian_expectedCredentialId = $this->base64UrlEncode($Silian_credentialIdBytes);
        $this->assertSame($Silian_expectedCredentialId, $Silian_result['credential_id']);

        $Silian_stored = $this->pdo->query('SELECT public_key FROM user_passkeys WHERE credential_id = "' . $Silian_expectedCredentialId . '"')->fetch(PDO::FETCH_ASSOC);
        $this->assertIsArray($Silian_stored);
        $Silian_publicKey = json_decode((string) $Silian_stored['public_key'], true);
        $this->assertSame('EC2', $Silian_publicKey['kty']);
        $this->assertSame(-7, $Silian_publicKey['alg']);
    }

    public function testCompleteAuthenticationVerifiesAssertionAndUpdatesCounter(): void
    {
        $Silian_registration = $this->service->beginRegistration($this->userFixture(), [
            'label' => 'Phone',
        ]);
        $Silian_keyPair = $this->generateEcKeyPair();
        $Silian_credentialIdBytes = 'credential-auth-1';
        $Silian_credentialId = $this->base64UrlEncode($Silian_credentialIdBytes);

        $this->service->completeRegistration($this->userFixture(), [
            'challenge_id' => $Silian_registration['challenge_id'],
            'credential' => $this->buildRegistrationCredential(
                $Silian_registration['public_key']['challenge'],
                'https://app.example.test',
                $Silian_keyPair['x'],
                $Silian_keyPair['y'],
                $Silian_credentialIdBytes
            ),
        ]);

        $Silian_authentication = $this->service->beginAuthentication([
            'identifier' => 'admin@testdomain.com',
        ]);

        $this->assertCount(1, $Silian_authentication['public_key']['allowCredentials']);
        $this->assertSame($Silian_credentialId, $Silian_authentication['public_key']['allowCredentials'][0]['id']);

        $Silian_result = $this->service->completeAuthentication([
            'challenge_id' => $Silian_authentication['challenge_id'],
            'credential' => $this->buildAuthenticationCredential(
                $Silian_authentication['public_key']['challenge'],
                'https://app.example.test',
                $Silian_credentialId,
                $Silian_keyPair['private_key'],
                'NTUwZTg0MDAtZTI5Yi00MWQ0LWE3MTYtNDQ2NjU1NDQwMGFh',
                2
            ),
        ]);

        $this->assertSame('admin_user', $Silian_result['user']['username']);
        $this->assertSame($Silian_credentialId, $Silian_result['passkey']['credential_id']);
        $this->assertSame(2, $Silian_result['passkey']['sign_count']);
        $this->assertNotEmpty($Silian_result['passkey']['last_used_at']);

        $Silian_stored = $this->pdo->query('SELECT sign_count, last_used_at FROM user_passkeys WHERE credential_id = "' . $Silian_credentialId . '"')->fetch(PDO::FETCH_ASSOC);
        $this->assertSame('2', (string) $Silian_stored['sign_count']);
        $this->assertNotEmpty($Silian_stored['last_used_at']);
    }

    public function testBeginRegistrationRequiresPersistedUserUuid(): void
    {
        try {
            $this->service->beginRegistration([
                'id' => 1,
                'uuid' => null,
                'username' => 'admin_user',
                'email' => 'admin@testdomain.com',
            ]);
            $this->fail('Expected PasskeyOperationException was not thrown.');
        } catch (PasskeyOperationException $Silian_exception) {
            $this->assertSame('USER_UUID_REQUIRED', $Silian_exception->getErrorCode());
            $this->assertSame(409, $Silian_exception->getHttpStatus());
        }
    }

    public function testBeginAuthenticationReturnsGenericOptionsForUnknownIdentifier(): void
    {
        $Silian_result = $this->service->beginAuthentication([
            'identifier' => 'missing@testdomain.com',
        ]);

        $this->assertNotEmpty($Silian_result['challenge_id']);
        $this->assertArrayNotHasKey('allowCredentials', $Silian_result['public_key']);
    }

    public function testBeginAuthenticationAllowsOmittingIdentifier(): void
    {
        $Silian_result = $this->service->beginAuthentication();

        $this->assertNotEmpty($Silian_result['challenge_id']);
        $this->assertArrayNotHasKey('allowCredentials', $Silian_result['public_key']);
    }

    public function testBeginAuthenticationReturnsGenericOptionsWhenAccountHasNoPasskeys(): void
    {
        $Silian_result = $this->service->beginAuthentication([
            'identifier' => 'admin@testdomain.com',
        ]);

        $this->assertNotEmpty($Silian_result['challenge_id']);
        $this->assertArrayNotHasKey('allowCredentials', $Silian_result['public_key']);
    }

    public function testCompleteAuthenticationRejectsCredentialWhenIdentifierDoesNotMatch(): void
    {
        $Silian_credentialId = 'credential-auth-mismatch';
        $Silian_mockProvider = $this->createMock(WebauthnProviderInterface::class);
        $Silian_mockProvider->method('isAvailable')->willReturn(true);
        $Silian_mockProvider->method('getMetadata')->willReturn([
            'available' => true,
            'implementation' => 'mock',
        ]);
        $Silian_mockProvider->expects($this->once())
            ->method('verifyAuthenticationResponse')
            ->with(
                $this->callback(static fn (array $Silian_credential): bool => ($Silian_credential['id'] ?? null) === $Silian_credentialId),
                $this->isType('array'),
                $this->callback(static fn (array $Silian_passkey): bool => ($Silian_passkey['credential_id'] ?? null) === $Silian_credentialId),
                $this->isInstanceOf(PasskeyConfig::class)
            )
            ->willReturn([
                'credential_id' => $Silian_credentialId,
                'sign_count' => 2,
                'backup_state' => false,
                'last_used_at' => gmdate('Y-m-d H:i:s'),
            ]);
        $Silian_mockProvider->expects($this->never())->method('verifyRegistrationResponse');

        $Silian_service = $this->createService($Silian_mockProvider);
        $this->insertPasskeyForUser(1, $Silian_credentialId, 'Phone', 1);

        $Silian_authentication = $Silian_service->beginAuthentication([
            'identifier' => 'missing@testdomain.com',
        ]);

        try {
            $Silian_service->completeAuthentication([
                'challenge_id' => $Silian_authentication['challenge_id'],
                'credential' => [
                    'id' => $Silian_credentialId,
                    'rawId' => $Silian_credentialId,
                    'type' => 'public-key',
                    'response' => [],
                ],
            ]);
            $this->fail('Expected PasskeyOperationException was not thrown.');
        } catch (PasskeyOperationException $Silian_exception) {
            $this->assertSame('PASSKEY_ACCOUNT_MISMATCH', $Silian_exception->getErrorCode());
            $this->assertSame(401, $Silian_exception->getHttpStatus());
        }
    }

    public function testCompleteAuthenticationReturnsNotFoundForUnknownCredential(): void
    {
        $Silian_authentication = $this->service->beginAuthentication();

        try {
            $this->service->completeAuthentication([
                'challenge_id' => $Silian_authentication['challenge_id'],
                'credential' => [
                    'id' => 'missing-credential',
                ],
            ]);
            $this->fail('Expected PasskeyOperationException was not thrown.');
        } catch (PasskeyOperationException $Silian_exception) {
            $this->assertSame('PASSKEY_NOT_FOUND', $Silian_exception->getErrorCode());
            $this->assertSame(404, $Silian_exception->getHttpStatus());
        }
    }

    public function testUpdateLabelForUserTrimsValueAndWritesAuditEvent(): void
    {
        $this->insertExistingPasskey();
        $Silian_passkeyId = (int) $this->pdo
            ->query("SELECT id FROM user_passkeys WHERE credential_id = 'existing-credential'")
            ->fetchColumn();

        $Silian_expectedLabel = str_repeat('A', 100);
        $this->auditLogService->expects($this->once())
            ->method('log')
            ->with($this->callback(function (array $Silian_payload) use ($Silian_passkeyId, $Silian_expectedLabel): bool {
                $this->assertSame('passkey_label_updated', $Silian_payload['action']);
                $this->assertSame(1, $Silian_payload['user_id']);
                $this->assertSame('success', $Silian_payload['status']);
                $this->assertSame($Silian_passkeyId, $Silian_payload['data']['passkey_id']);
                $this->assertSame($Silian_expectedLabel, $Silian_payload['data']['new_label']);
                return true;
            }))
            ->willReturn(true);

        $Silian_updated = $this->service->updateLabelForUser($this->userFixture(), $Silian_passkeyId, str_repeat('A', 120));

        $this->assertSame($Silian_expectedLabel, $Silian_updated['label']);
        $Silian_storedLabel = $this->pdo
            ->query("SELECT label FROM user_passkeys WHERE id = {$Silian_passkeyId}")
            ->fetchColumn();
        $this->assertSame($Silian_expectedLabel, $Silian_storedLabel);
    }

    public function testUpdateLabelForUserSkipsNoOpUpdates(): void
    {
        $this->insertExistingPasskey();
        $Silian_passkeyId = (int) $this->pdo
            ->query("SELECT id FROM user_passkeys WHERE credential_id = 'existing-credential'")
            ->fetchColumn();
        $Silian_originalUpdatedAt = (string) $this->pdo
            ->query("SELECT updated_at FROM user_passkeys WHERE id = {$Silian_passkeyId}")
            ->fetchColumn();

        $this->auditLogService->expects($this->never())->method('log');

        $Silian_updated = $this->service->updateLabelForUser($this->userFixture(), $Silian_passkeyId, '  Existing laptop  ');

        $this->assertSame('Existing laptop', $Silian_updated['label']);
        $Silian_storedUpdatedAt = (string) $this->pdo
            ->query("SELECT updated_at FROM user_passkeys WHERE id = {$Silian_passkeyId}")
            ->fetchColumn();
        $this->assertSame($Silian_originalUpdatedAt, $Silian_storedUpdatedAt);
    }

    public function testListForAdminReturnsFilteredSortedPasskeys(): void
    {
        $this->insertPasskeyForUser(1, 'admin-credential', 'Admin Laptop', 2, '2026-03-10 08:00:00');

        $Silian_stmt = $this->pdo->prepare(
            "INSERT INTO users (username, email, password, school_id, status, points, is_admin, uuid)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $Silian_stmt->execute([
            'bob',
            'bob@example.com',
            password_hash('password123', PASSWORD_BCRYPT),
            1,
            'active',
            50,
            0,
            '550e8400-e29b-41d4-a716-4466554400bb',
        ]);
        $Silian_bobId = (int) $this->pdo->lastInsertId();
        $this->insertPasskeyForUser($Silian_bobId, 'bob-credential', 'Bob Phone', 9, '2026-03-10 09:00:00', true);

        $Silian_result = $this->service->listForAdmin(1, [
            'q' => 'bob',
            'sort' => 'sign_count_desc',
            'page' => 1,
            'limit' => 10,
        ]);

        $this->assertSame(1, $Silian_result['pagination']['total_items']);
        $this->assertCount(1, $Silian_result['passkeys']);
        $this->assertSame('bob', $Silian_result['passkeys'][0]['username']);
        $this->assertSame('bob@example.com', $Silian_result['passkeys'][0]['email']);
        $this->assertSame('Bob Phone', $Silian_result['passkeys'][0]['label']);
        $this->assertSame(9, $Silian_result['passkeys'][0]['sign_count']);
        $this->assertTrue($Silian_result['passkeys'][0]['backup_state']);
    }

    public function testGetAdminStatsCountsActivePasskeysAndRecentPasskeyLogins(): void
    {
        $this->insertPasskeyForUser(1, 'admin-credential', 'Admin Laptop', 2, gmdate('Y-m-d H:i:s', strtotime('-2 days')));
        $this->insertPasskeyForUser(1, 'admin-credential-2', 'Admin Phone', 4, gmdate('Y-m-d H:i:s', strtotime('-18 days')));

        $Silian_stmt = $this->pdo->prepare(
            "INSERT INTO users (username, email, password, school_id, status, points, is_admin, uuid)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
        );
        $Silian_stmt->execute([
            'retired-user',
            'retired@example.com',
            password_hash('password123', PASSWORD_BCRYPT),
            1,
            'inactive',
            0,
            0,
            '550e8400-e29b-41d4-a716-4466554400bc',
        ]);
        $Silian_deletedUserId = (int) $this->pdo->lastInsertId();
        $this->pdo->prepare('UPDATE users SET deleted_at = ? WHERE id = ?')
            ->execute([gmdate('Y-m-d H:i:s', strtotime('-1 day')), $Silian_deletedUserId]);
        $this->insertPasskeyForUser($Silian_deletedUserId, 'deleted-user-credential', 'Old Device', 8, gmdate('Y-m-d H:i:s', strtotime('-3 days')));

        $Silian_stmt = $this->pdo->prepare(
            "INSERT INTO audit_logs (user_id, actor_type, action, status, operation_category, created_at)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $Silian_stmt->execute([1, 'user', 'passkey_login', 'success', 'authentication', gmdate('Y-m-d H:i:s', strtotime('-2 days'))]);
        $Silian_stmt->execute([1, 'user', 'passkey_login', 'success', 'authentication', gmdate('Y-m-d H:i:s', strtotime('-10 days'))]);
        $Silian_stmt->execute([1, 'user', 'passkey_login', 'success', 'authentication', gmdate('Y-m-d H:i:s', strtotime('-40 days'))]);

        $Silian_stats = $this->service->getAdminStats(1);

        $this->assertSame(1, $Silian_stats['users_with_passkeys']);
        $this->assertSame(2, $Silian_stats['total_active_passkeys']);
        $this->assertSame(2, $Silian_stats['new_passkeys_30d']);
        $this->assertSame(1, $Silian_stats['passkey_logins_7d']);
        $this->assertSame(2, $Silian_stats['passkey_logins_30d']);
    }

    private function userFixture(): array
    {
        return [
            'id' => 1,
            'uuid' => '550e8400-e29b-41d4-a716-4466554400aa',
            'username' => 'admin_user',
            'email' => 'admin@testdomain.com',
            'points' => 1000,
            'is_admin' => true,
        ];
    }

    private function createService(WebauthnProviderInterface $Silian_webauthnProvider): PasskeyService
    {
        return new PasskeyService(
            $this->config,
            new UserPasskey($this->pdo),
            new WebauthnChallenge($this->pdo),
            $Silian_webauthnProvider,
            $this->auditLogService,
            $this->pdo,
            $this->regionService,
            null,
            null,
            $this->createMock(ErrorLogService::class),
            $this->createMock(Logger::class)
        );
    }

    private function insertExistingPasskey(): void
    {
        $this->insertPasskeyForUser(1, 'existing-credential', 'Existing laptop', 7);
    }

    private function insertPasskeyForUser(
        int $Silian_userId,
        string $Silian_credentialId,
        string $Silian_label,
        int $Silian_signCount,
        ?string $Silian_createdAt = null,
        bool $Silian_backupState = false
    ): void {
        $Silian_stmt = $this->pdo->prepare(
            'INSERT INTO user_passkeys (
                user_uuid, credential_id, credential_id_hash, credential_type, label, public_key, rp_id, user_handle,
                transports, aaguid, sign_count, attestation_format, backup_eligible, backup_state, meta_json,
                last_used_at, attested_at, created_at, updated_at
            ) VALUES (
                :user_uuid, :credential_id, :credential_id_hash, :credential_type, :label, :public_key, :rp_id, :user_handle,
                :transports, :aaguid, :sign_count, :attestation_format, :backup_eligible, :backup_state, :meta_json,
                :last_used_at, :attested_at, :created_at, :updated_at
            )'
        );
        $Silian_timestamp = $Silian_createdAt ?? gmdate('Y-m-d H:i:s');
        $Silian_stmt->execute([
            'user_uuid' => $this->userUuidForId($Silian_userId),
            'credential_id' => $Silian_credentialId,
            'credential_id_hash' => hash('sha256', $Silian_credentialId),
            'credential_type' => 'public-key',
            'label' => $Silian_label,
            'public_key' => json_encode(['pem' => 'placeholder', 'alg' => -7]),
            'rp_id' => 'app.example.test',
            'user_handle' => 'dGVzdC11c2Vy',
            'transports' => json_encode(['internal']),
            'aaguid' => null,
            'sign_count' => $Silian_signCount,
            'attestation_format' => null,
            'backup_eligible' => 0,
            'backup_state' => $Silian_backupState ? 1 : 0,
            'meta_json' => null,
            'last_used_at' => $Silian_timestamp,
            'attested_at' => $Silian_timestamp,
            'created_at' => $Silian_timestamp,
            'updated_at' => $Silian_timestamp,
        ]);
    }

    private function userUuidForId(int $Silian_userId): string
    {
        $Silian_stmt = $this->pdo->prepare('SELECT uuid FROM users WHERE id = ? LIMIT 1');
        $Silian_stmt->execute([$Silian_userId]);
        $Silian_uuid = $Silian_stmt->fetchColumn();
        $this->assertNotFalse($Silian_uuid);

        return strtolower((string) $Silian_uuid);
    }

    /**
     * @return array{private_key:resource|\OpenSSLAsymmetricKey,x:string,y:string}
     */
    private function generateEcKeyPair(): array
    {
        $Silian_privateKey = openssl_pkey_new([
            'private_key_type' => OPENSSL_KEYTYPE_EC,
            'curve_name' => 'prime256v1',
        ]);
        if ($Silian_privateKey === false) {
            $this->markTestSkipped('OpenSSL EC key generation is not available in this environment.');
        }
        $Silian_details = openssl_pkey_get_details($Silian_privateKey);
        if (!is_array($Silian_details) || !isset($Silian_details['ec']['x'], $Silian_details['ec']['y'])) {
            $this->markTestSkipped('OpenSSL EC key details are not available in this environment.');
        }

        return [
            'private_key' => $Silian_privateKey,
            'x' => $Silian_details['ec']['x'],
            'y' => $Silian_details['ec']['y'],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildRegistrationCredential(
        string $Silian_challenge,
        string $Silian_origin,
        string $Silian_x,
        string $Silian_y,
        string $Silian_credentialIdBytes,
        ?array $Silian_extensions = null
    ): array {
        $Silian_clientDataJson = json_encode([
            'type' => 'webauthn.create',
            'challenge' => $Silian_challenge,
            'origin' => $Silian_origin,
            'crossOrigin' => false,
        ], JSON_UNESCAPED_SLASHES);

        $Silian_credentialPublicKey = $this->cborEncode($this->cborMap([
            1 => 2,
            3 => -7,
            -1 => 1,
            -2 => $this->cborBytes($Silian_x),
            -3 => $this->cborBytes($Silian_y),
        ]));

        $Silian_flags = 0x45;
        $Silian_extensionData = '';
        if ($Silian_extensions !== null) {
            $Silian_flags |= 0x80;
            $Silian_extensionData = $this->cborEncode($Silian_extensions);
        }

        $Silian_authenticatorData = hash('sha256', 'app.example.test', true)
            . chr($Silian_flags)
            . pack('N', 0)
            . str_repeat("\x00", 16)
            . pack('n', strlen($Silian_credentialIdBytes))
            . $Silian_credentialIdBytes
            . $Silian_credentialPublicKey
            . $Silian_extensionData;

        $Silian_attestationObject = $this->cborEncode($this->cborMap([
            'fmt' => 'none',
            'attStmt' => $this->cborMap([]),
            'authData' => $this->cborBytes($Silian_authenticatorData),
        ]));

        $Silian_credentialId = $this->base64UrlEncode($Silian_credentialIdBytes);

        return [
            'id' => $Silian_credentialId,
            'rawId' => $Silian_credentialId,
            'type' => 'public-key',
            'response' => [
                'clientDataJSON' => $this->base64UrlEncode($Silian_clientDataJson),
                'attestationObject' => $this->base64UrlEncode($Silian_attestationObject),
            ],
            'authenticatorAttachment' => 'platform',
        ];
    }

    /**
     * @param resource|\OpenSSLAsymmetricKey $privateKey
     * @return array<string, mixed>
     */
    private function buildAuthenticationCredential(
        string $Silian_challenge,
        string $Silian_origin,
        string $Silian_credentialId,
        $Silian_privateKey,
        string $Silian_userHandle,
        int $Silian_signCount
    ): array {
        $Silian_clientDataJson = json_encode([
            'type' => 'webauthn.get',
            'challenge' => $Silian_challenge,
            'origin' => $Silian_origin,
            'crossOrigin' => false,
        ], JSON_UNESCAPED_SLASHES);

        $Silian_authenticatorData = hash('sha256', 'app.example.test', true)
            . chr(0x05)
            . pack('N', $Silian_signCount);
        $Silian_signaturePayload = $Silian_authenticatorData . hash('sha256', $Silian_clientDataJson, true);
        openssl_sign($Silian_signaturePayload, $Silian_signature, $Silian_privateKey, OPENSSL_ALGO_SHA256);

        return [
            'id' => $Silian_credentialId,
            'rawId' => $Silian_credentialId,
            'type' => 'public-key',
            'response' => [
                'authenticatorData' => $this->base64UrlEncode($Silian_authenticatorData),
                'clientDataJSON' => $this->base64UrlEncode($Silian_clientDataJson),
                'signature' => $this->base64UrlEncode($Silian_signature),
                'userHandle' => $Silian_userHandle,
            ],
        ];
    }

    /**
     * @param mixed $value
     */
    private function cborEncode($Silian_value): string
    {
        if (is_array($Silian_value) && array_key_exists('__bytes', $Silian_value)) {
            return $this->encodeCborItem(2, (string) $Silian_value['__bytes']);
        }

        if (is_array($Silian_value) && array_key_exists('__map', $Silian_value)) {
            $Silian_encoded = '';
            foreach ($Silian_value['__map'] as $Silian_key => $Silian_item) {
                $Silian_encoded .= $this->cborEncode($Silian_key) . $this->cborEncode($Silian_item);
            }
            return $this->encodeCborHeader(5, count($Silian_value['__map'])) . $Silian_encoded;
        }

        if (is_string($Silian_value)) {
            return $this->encodeCborItem(3, $Silian_value);
        }

        if (is_int($Silian_value)) {
            if ($Silian_value >= 0) {
                return $this->encodeCborHeader(0, $Silian_value);
            }

            return $this->encodeCborHeader(1, (-1 - $Silian_value));
        }

        if (is_bool($Silian_value)) {
            return $Silian_value ? "\xf5" : "\xf4";
        }

        if ($Silian_value === null) {
            return "\xf6";
        }

        throw new \InvalidArgumentException('Unsupported CBOR test value.');
    }

    /**
     * @return array{__bytes:string}
     */
    private function cborBytes(string $Silian_value): array
    {
        return ['__bytes' => $Silian_value];
    }

    /**
     * @return array{__map:array<mixed,mixed>}
     */
    private function cborMap(array $Silian_value): array
    {
        return ['__map' => $Silian_value];
    }

    private function encodeCborItem(int $Silian_majorType, string $Silian_payload): string
    {
        return $this->encodeCborHeader($Silian_majorType, strlen($Silian_payload)) . $Silian_payload;
    }

    private function encodeCborHeader(int $Silian_majorType, int $Silian_value): string
    {
        if ($Silian_value < 24) {
            return chr(($Silian_majorType << 5) | $Silian_value);
        }

        if ($Silian_value < 256) {
            return chr(($Silian_majorType << 5) | 24) . chr($Silian_value);
        }

        if ($Silian_value < 65536) {
            return chr(($Silian_majorType << 5) | 25) . pack('n', $Silian_value);
        }

        return chr(($Silian_majorType << 5) | 26) . pack('N', $Silian_value);
    }

    private function base64UrlEncode(string $Silian_value): string
    {
        return rtrim(strtr(base64_encode($Silian_value), '+/', '-_'), '=');
    }
}
