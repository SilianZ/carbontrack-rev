<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Models\UserPasskey;
use CarbonTrack\Models\WebauthnChallenge;
use CarbonTrack\Services\Webauthn\Base64Url;
use CarbonTrack\Support\Uuid;
use Monolog\Logger;
use PDO;

class PasskeyService
{
    private const FLOW_AUTHENTICATION = 'authentication';
    private const FLOW_REGISTRATION = 'registration';
    private const ADMIN_PASSKEY_SORTS = [
        'created_at_desc',
        'last_used_at_desc',
        'sign_count_desc',
    ];
    private UserProfileViewService $userProfileViewService;

    public function __construct(
        private PasskeyConfig $config,
        private UserPasskey $userPasskeyModel,
        private WebauthnChallenge $challengeModel,
        private WebauthnProviderInterface $webauthnProvider,
        private AuditLogService $auditLogService,
        private PDO $db,
        private RegionService $regionService,
        private ?CheckinService $checkinService = null,
        private ?CloudflareR2Service $r2Service = null,
        private ?ErrorLogService $errorLogService = null,
        private ?Logger $logger = null,
        ?UserProfileViewService $Silian_userProfileViewService = null
    ) {
        $this->userProfileViewService = $Silian_userProfileViewService ?? new UserProfileViewService($regionService);
    }

    /**
     * @param array<string, mixed> $user
     * @return array<int, array<string, mixed>>
     */
    public function listForUser(array $Silian_user): array
    {
        $Silian_userId = $this->requireUserId($Silian_user);
        $Silian_userUuid = $this->requireUserUuid($Silian_user);
        $Silian_passkeys = $this->userPasskeyModel->listActiveByUserUuid($Silian_userUuid);

        $this->auditLogService->log([
            'action' => 'passkey_list_viewed',
            'operation_category' => 'authentication',
            'user_id' => $Silian_userId,
            'actor_type' => 'user',
            'affected_table' => 'user_passkeys',
            'status' => 'success',
            'change_type' => 'read',
            'data' => ['count' => count($Silian_passkeys)],
        ]);

        return array_map([$this, 'toPublicSummary'], $Silian_passkeys);
    }

    /**
     * @param array<string, mixed> $user
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function beginRegistration(array $Silian_user, array $Silian_payload = []): array
    {
        $this->ensureEnabled();

        $Silian_userId = $this->requireUserId($Silian_user);
        $Silian_userUuid = $this->requireUserUuid($Silian_user);
        $this->challengeModel->deleteExpired();

        $Silian_label = $this->sanitizeLabel($Silian_payload['label'] ?? null);
        $Silian_passkeys = $this->userPasskeyModel->listActiveByUserUuid($Silian_userUuid);
        $Silian_challengeId = Uuid::generateV4();
        $Silian_challenge = Base64Url::encode(random_bytes(32));
        $Silian_userHandle = $this->resolveUserHandle($Silian_user);
        $Silian_expiresAt = gmdate('Y-m-d H:i:s', time() + $this->config->getChallengeTtlSeconds());

        $this->challengeModel->create([
            'challenge_id' => $Silian_challengeId,
            'user_uuid' => $Silian_userUuid,
            'flow_type' => self::FLOW_REGISTRATION,
            'challenge' => $Silian_challenge,
            'request_id' => $_SERVER['HTTP_X_REQUEST_ID'] ?? ($_SERVER['REQUEST_ID'] ?? null),
            'context' => [
                'label' => $Silian_label,
                'username' => $Silian_user['username'] ?? null,
                'email' => $Silian_user['email'] ?? null,
                'user_handle' => $Silian_userHandle,
                'rp_id' => $this->config->getRpId(),
            ],
            'expires_at' => $Silian_expiresAt,
        ]);

        $Silian_options = $this->buildRegistrationOptions($Silian_user, $Silian_userHandle, $Silian_challenge, $Silian_passkeys);

        $this->logPasskeyEvent('passkey_registration_options_created', $Silian_userId, 'success', [
            'challenge_id' => $Silian_challengeId,
            'exclude_credentials' => count($Silian_passkeys),
            'label' => $Silian_label,
            'integration_available' => $this->webauthnProvider->isAvailable(),
        ], 'create', 'webauthn_challenges');

        return [
            'challenge_id' => $Silian_challengeId,
            'expires_at' => $Silian_expiresAt,
            'public_key' => $Silian_options,
            'integration' => $this->buildIntegrationMetadata(),
        ];
    }

    /**
     * @param array<string, mixed> $user
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function completeRegistration(array $Silian_user, array $Silian_payload): array
    {
        $this->ensureEnabled();

        $Silian_userId = $this->requireUserId($Silian_user);
        $Silian_userUuid = $this->requireUserUuid($Silian_user);
        $Silian_challengeId = $this->requireChallengeId($Silian_payload);
        $Silian_credential = $this->requireCredentialPayload($Silian_payload);

        $Silian_challengeRecord = $this->challengeModel->findActive($Silian_challengeId, self::FLOW_REGISTRATION, $Silian_userUuid);
        if ($Silian_challengeRecord === null) {
            $this->logPasskeyEvent('passkey_registration_failed', $Silian_userId, 'failed', [
                'challenge_id' => $Silian_challengeId,
                'reason' => 'challenge_not_found',
            ]);
            throw new PasskeyOperationException('Passkey challenge was not found or has expired.', 'CHALLENGE_NOT_FOUND', 404);
        }

        $Silian_verified = $this->webauthnProvider->verifyRegistrationResponse(
            $Silian_credential,
            $Silian_challengeRecord,
            $Silian_user,
            $this->config
        );

        if (!$this->challengeModel->markConsumed((int) $Silian_challengeRecord['id'])) {
            throw new PasskeyOperationException('Challenge has already been consumed or expired.', 'PASSKEY_CHALLENGE_CONSUMED', 400);
        }

        $Silian_credentialId = trim((string) ($Silian_verified['credential_id'] ?? ''));
        if ($Silian_credentialId === '') {
            throw new PasskeyOperationException('Verified passkey response did not contain a credential id.', 'INVALID_CREDENTIAL', 400);
        }

        if ($this->userPasskeyModel->findActiveByCredentialId($Silian_credentialId) !== null) {
            $this->logPasskeyEvent('passkey_registration_failed', $Silian_userId, 'failed', [
                'challenge_id' => $Silian_challengeId,
                'reason' => 'duplicate_credential',
                'credential_id' => $Silian_credentialId,
            ]);
            throw new PasskeyOperationException('This passkey is already registered.', 'PASSKEY_ALREADY_EXISTS', 409);
        }

        $Silian_context = is_array($Silian_challengeRecord['context'] ?? null) ? $Silian_challengeRecord['context'] : [];
        $Silian_created = $this->userPasskeyModel->create([
            'user_uuid' => $Silian_userUuid,
            'credential_id' => $Silian_credentialId,
            'credential_type' => $Silian_verified['credential_type'] ?? 'public-key',
            'label' => $this->sanitizeLabel($Silian_payload['label'] ?? ($Silian_context['label'] ?? null)),
            'public_key' => (string) ($Silian_verified['public_key'] ?? ''),
            'rp_id' => (string) ($Silian_verified['rp_id'] ?? $this->config->getRpId()),
            'user_handle' => (string) ($Silian_verified['user_handle'] ?? ($Silian_context['user_handle'] ?? $this->resolveUserHandle($Silian_user))),
            'transports' => is_array($Silian_verified['transports'] ?? null) ? $Silian_verified['transports'] : [],
            'aaguid' => $Silian_verified['aaguid'] ?? null,
            'sign_count' => (int) ($Silian_verified['sign_count'] ?? 0),
            'attestation_format' => $Silian_verified['attestation_format'] ?? null,
            'backup_eligible' => !empty($Silian_verified['backup_eligible']),
            'backup_state' => !empty($Silian_verified['backup_state']),
            'meta' => is_array($Silian_verified['meta'] ?? null) ? $Silian_verified['meta'] : null,
            'last_used_at' => $Silian_verified['last_used_at'] ?? null,
            'attested_at' => $Silian_verified['attested_at'] ?? null,
        ]);

        if (empty($Silian_created)) {
            throw new PasskeyOperationException('Passkey registration could not be stored.', 'PASSKEY_PERSIST_FAILED', 500);
        }

        $this->logPasskeyEvent('passkey_registered', $Silian_userId, 'success', [
            'challenge_id' => $Silian_challengeId,
            'passkey_id' => $Silian_created['id'] ?? null,
            'label' => $Silian_created['label'] ?? null,
        ], 'create', 'user_passkeys');

        return $this->toPublicSummary($Silian_created);
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function beginAuthentication(array $Silian_payload = []): array
    {
        $this->ensureEnabled();
        $this->challengeModel->deleteExpired();

        $Silian_identifier = $this->sanitizeIdentifier($Silian_payload['identifier'] ?? null);
        $Silian_user = null;
        $Silian_passkeys = [];
        $Silian_userUuid = null;
        $Silian_auditUserId = null;

        if ($Silian_identifier !== null) {
            $Silian_user = $this->findUserByIdentifier($Silian_identifier);
            if ($Silian_user !== null && $this->userHasValidUuid($Silian_user)) {
                $Silian_candidateUserUuid = strtolower((string) $Silian_user['uuid']);
                $Silian_candidatePasskeys = $this->userPasskeyModel->listActiveByUserUuid($Silian_candidateUserUuid);
                if ($Silian_candidatePasskeys !== []) {
                    $Silian_userUuid = $Silian_candidateUserUuid;
                    $Silian_auditUserId = (int) $Silian_user['id'];
                    $Silian_passkeys = $Silian_candidatePasskeys;
                }
            }
        }

        $Silian_challengeId = Uuid::generateV4();
        $Silian_challenge = Base64Url::encode(random_bytes(32));
        $Silian_expiresAt = gmdate('Y-m-d H:i:s', time() + $this->config->getChallengeTtlSeconds());
        $this->challengeModel->create([
            'challenge_id' => $Silian_challengeId,
            'user_uuid' => $Silian_userUuid,
            'flow_type' => self::FLOW_AUTHENTICATION,
            'challenge' => $Silian_challenge,
            'request_id' => $_SERVER['HTTP_X_REQUEST_ID'] ?? ($_SERVER['REQUEST_ID'] ?? null),
            'context' => [
                'identifier' => $Silian_identifier,
                'rp_id' => $this->config->getRpId(),
            ],
            'expires_at' => $Silian_expiresAt,
        ]);

        if ($Silian_auditUserId !== null) {
            $this->auditLogService->log([
                'action' => 'passkey_authentication_options_created',
                'operation_category' => 'authentication',
                'user_id' => $Silian_auditUserId,
                'actor_type' => 'user',
                'affected_table' => 'webauthn_challenges',
                'status' => 'success',
                'change_type' => 'create',
                'data' => [
                    'challenge_id' => $Silian_challengeId,
                    'allow_credentials' => count($Silian_passkeys),
                ],
            ]);
        }

        return [
            'challenge_id' => $Silian_challengeId,
            'expires_at' => $Silian_expiresAt,
            'public_key' => $this->buildAuthenticationOptions($Silian_challenge, $Silian_passkeys),
            'integration' => $this->buildIntegrationMetadata(),
        ];
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    public function completeAuthentication(array $Silian_payload): array
    {
        $this->ensureEnabled();

        $Silian_challengeId = $this->requireChallengeId($Silian_payload);
        $Silian_credential = $this->requireCredentialPayload($Silian_payload);
        $Silian_challengeRecord = $this->challengeModel->findActive($Silian_challengeId, self::FLOW_AUTHENTICATION);
        if ($Silian_challengeRecord === null) {
            throw new PasskeyOperationException('Passkey challenge was not found or has expired.', 'CHALLENGE_NOT_FOUND', 404);
        }

        $Silian_credentialId = $this->extractCredentialId($Silian_credential);
        $Silian_passkey = $this->userPasskeyModel->findActiveByCredentialId($Silian_credentialId);
        if ($Silian_passkey === null) {
            throw new PasskeyOperationException('Passkey credential was not found.', 'PASSKEY_NOT_FOUND', 404);
        }

        if (
            isset($Silian_challengeRecord['user_uuid'])
            && $Silian_challengeRecord['user_uuid'] !== null
            && strcasecmp((string) $Silian_challengeRecord['user_uuid'], (string) ($Silian_passkey['user_uuid'] ?? '')) !== 0
        ) {
            throw new PasskeyOperationException('Passkey credential does not match the challenged account.', 'PASSKEY_ACCOUNT_MISMATCH', 401);
        }

        $Silian_verified = $this->webauthnProvider->verifyAuthenticationResponse(
            $Silian_credential,
            $Silian_challengeRecord,
            $Silian_passkey,
            $this->config
        );

        if (!$this->challengeModel->markConsumed((int) $Silian_challengeRecord['id'])) {
            throw new PasskeyOperationException('Challenge has already been consumed or expired.', 'PASSKEY_CHALLENGE_CONSUMED', 400);
        }

        $Silian_updated = $this->userPasskeyModel->touchAuthentication(
            (int) $Silian_passkey['id'],
            (int) ($Silian_verified['sign_count'] ?? (int) ($Silian_passkey['sign_count'] ?? 0)),
            !empty($Silian_verified['backup_state']),
            $Silian_verified['last_used_at'] ?? gmdate('Y-m-d H:i:s')
        );
        if (!$Silian_updated) {
            throw new PasskeyOperationException('Passkey authentication state could not be updated.', 'PASSKEY_TOUCH_FAILED', 500);
        }

        $Silian_user = $this->findUserDetailedByUuid((string) ($Silian_passkey['user_uuid'] ?? ''));
        if ($Silian_user === null) {
            throw new PasskeyOperationException('The passkey owner account was not found.', 'PASSKEY_USER_NOT_FOUND', 404);
        }
        $this->requireUserUuid($Silian_user);

        $Silian_context = is_array($Silian_challengeRecord['context'] ?? null) ? $Silian_challengeRecord['context'] : [];
        $Silian_identifier = $this->sanitizeIdentifier($Silian_context['identifier'] ?? null);
        if ($Silian_identifier !== null && !$this->userMatchesIdentifier($Silian_user, $Silian_identifier)) {
            throw new PasskeyOperationException('Passkey credential does not match the challenged account.', 'PASSKEY_ACCOUNT_MISMATCH', 401);
        }

        $this->touchUserLogin((int) $Silian_user['id']);
        if ($this->checkinService !== null) {
            try {
                $this->checkinService->syncUserCheckinsFromRecords((int) $Silian_user['id']);
            } catch (\Throwable $Silian_exception) {
                if ($this->logger !== null) {
                    $this->logger->debug('Failed to sync user checkins on passkey login', [
                        'error' => $Silian_exception->getMessage(),
                        'user_id' => $Silian_user['id'],
                    ]);
                }
            }
        }

        $this->auditLogService->log([
            'action' => 'passkey_login',
            'operation_category' => 'authentication',
            'user_id' => $Silian_user['id'],
            'actor_type' => 'user',
            'affected_table' => 'user_passkeys',
            'status' => 'success',
            'change_type' => 'update',
            'data' => [
                'passkey_id' => $Silian_passkey['id'],
                'credential_id' => $Silian_credentialId,
            ],
        ]);

        $Silian_freshPasskey = $this->userPasskeyModel->findActiveByCredentialId($Silian_credentialId) ?? $Silian_passkey;

        return [
            'user' => $this->formatUserPayload($Silian_user),
            'passkey' => $this->toPublicSummary($Silian_freshPasskey),
        ];
    }

    /**
     * @param array<string, mixed> $user
     */
    public function deleteForUser(array $Silian_user, int $Silian_passkeyId): void
    {
        $this->ensureEnabled();

        $Silian_userId = $this->requireUserId($Silian_user);
        $Silian_userUuid = $this->requireUserUuid($Silian_user);

        $Silian_passkey = $this->userPasskeyModel->findActiveByIdForUserUuid($Silian_passkeyId, $Silian_userUuid);
        if ($Silian_passkey === null) {
            throw new PasskeyOperationException('Passkey was not found.', 'PASSKEY_NOT_FOUND', 404);
        }

        if (!$this->userPasskeyModel->disable($Silian_passkeyId, $Silian_userUuid)) {
            throw new PasskeyOperationException('Passkey could not be deleted.', 'PASSKEY_DELETE_FAILED', 500);
        }

        $this->logPasskeyEvent('passkey_deleted', $Silian_userId, 'success', [
            'passkey_id' => $Silian_passkeyId,
            'credential_id' => $Silian_passkey['credential_id'] ?? null,
        ], 'delete', 'user_passkeys');
    }

    /**
     * @param array<string, mixed> $user
     * @return array<string, mixed>
     */
    public function updateLabelForUser(array $Silian_user, int $Silian_passkeyId, ?string $Silian_label): array
    {
        $Silian_userId = $this->requireUserId($Silian_user);
        $Silian_userUuid = $this->requireUserUuid($Silian_user);

        $Silian_passkey = $this->userPasskeyModel->findActiveByIdForUserUuid($Silian_passkeyId, $Silian_userUuid);
        if ($Silian_passkey === null) {
            throw new PasskeyOperationException('Passkey was not found.', 'PASSKEY_NOT_FOUND', 404);
        }

        $Silian_sanitizedLabel = $this->sanitizeLabel($Silian_label);
        $Silian_currentLabel = $this->sanitizeLabel($Silian_passkey['label'] ?? null);
        if ($Silian_sanitizedLabel === $Silian_currentLabel) {
            return $this->toPublicSummary($Silian_passkey);
        }

        $Silian_updated = $this->userPasskeyModel->updateLabel($Silian_passkeyId, $Silian_userUuid, $Silian_sanitizedLabel);
        if ($Silian_updated === null) {
            throw new PasskeyOperationException('Passkey label could not be updated.', 'PASSKEY_LABEL_UPDATE_FAILED', 500);
        }

        $this->logPasskeyEvent('passkey_label_updated', $Silian_userId, 'success', [
            'passkey_id' => $Silian_passkeyId,
            'credential_id' => $Silian_passkey['credential_id'] ?? null,
            'old_label' => $Silian_passkey['label'] ?? null,
            'new_label' => $Silian_updated['label'] ?? null,
        ], 'update', 'user_passkeys');

        return $this->toPublicSummary($Silian_updated);
    }

    /**
     * @param array<string, mixed> $filters
     * @return array<string, mixed>
     */
    public function listForAdmin(int $Silian_adminId, array $Silian_filters = []): array
    {
        $Silian_page = max(1, (int) ($Silian_filters['page'] ?? 1));
        $Silian_limit = min(100, max(1, (int) ($Silian_filters['limit'] ?? 20)));
        $Silian_offset = ($Silian_page - 1) * $Silian_limit;
        $Silian_search = trim((string) ($Silian_filters['q'] ?? ''));
        $Silian_sort = (string) ($Silian_filters['sort'] ?? 'created_at_desc');
        if (!in_array($Silian_sort, self::ADMIN_PASSKEY_SORTS, true)) {
            $Silian_sort = 'created_at_desc';
        }

        $Silian_result = $this->userPasskeyModel->listAdminPasskeys($Silian_search, $Silian_limit, $Silian_offset, $Silian_sort);
        $Silian_items = $Silian_result['items'] ?? [];
        $Silian_total = (int) ($Silian_result['total'] ?? 0);

        $this->auditLogService->log([
            'action' => 'admin_passkeys_viewed',
            'operation_category' => 'admin',
            'user_id' => $Silian_adminId,
            'actor_type' => 'admin',
            'affected_table' => 'user_passkeys',
            'status' => 'success',
            'change_type' => 'read',
            'data' => [
                'q' => $Silian_search,
                'page' => $Silian_page,
                'limit' => $Silian_limit,
                'sort' => $Silian_sort,
                'count' => count($Silian_items),
            ],
        ]);

        return [
            'passkeys' => $Silian_items,
            'pagination' => [
                'current_page' => $Silian_page,
                'per_page' => $Silian_limit,
                'total_items' => $Silian_total,
                'total_pages' => $Silian_total > 0 ? (int) ceil($Silian_total / $Silian_limit) : 0,
            ],
        ];
    }

    /**
     * @return array<string, mixed>
     */
    public function getAdminStats(int $Silian_adminId): array
    {
        $Silian_since7Days = gmdate('Y-m-d H:i:s', strtotime('-7 days'));
        $Silian_since30Days = gmdate('Y-m-d H:i:s', strtotime('-30 days'));
        $Silian_stats = $this->userPasskeyModel->getAdminPasskeyStats($Silian_since30Days);
        $Silian_stats['passkey_logins_7d'] = $this->countAuditActionSince('passkey_login', $Silian_since7Days);
        $Silian_stats['passkey_logins_30d'] = $this->countAuditActionSince('passkey_login', $Silian_since30Days);

        $this->auditLogService->log([
            'action' => 'admin_passkey_stats_viewed',
            'operation_category' => 'admin',
            'user_id' => $Silian_adminId,
            'actor_type' => 'admin',
            'affected_table' => 'user_passkeys',
            'status' => 'success',
            'change_type' => 'read',
            'data' => $Silian_stats,
        ]);

        return $Silian_stats;
    }

    /**
     * @return array<string, mixed>
     */
    public function getUserPasskeySummary(string $Silian_userUuid): array
    {
        return $this->userPasskeyModel->getUserPasskeySummary($Silian_userUuid);
    }

    /**
     * @param array<string, mixed> $user
     * @param array<int, array<string, mixed>> $existingPasskeys
     * @return array<string, mixed>
     */
    private function buildRegistrationOptions(array $Silian_user, string $Silian_userHandle, string $Silian_challenge, array $Silian_existingPasskeys): array
    {
        $Silian_authenticatorSelection = [
            'residentKey' => $this->config->getResidentKeyPreference(),
            'userVerification' => $this->config->getUserVerificationPreference(),
        ];

        $Silian_attachment = $this->config->getAuthenticatorAttachment();
        if ($Silian_attachment !== null) {
            $Silian_authenticatorSelection['authenticatorAttachment'] = $Silian_attachment;
        }

        return [
            'rp' => [
                'name' => $this->config->getRpName(),
                'id' => $this->config->getRpId(),
            ],
            'user' => [
                'id' => $Silian_userHandle,
                'name' => (string) ($Silian_user['email'] ?? $Silian_user['username'] ?? ('user-' . $this->requireUserId($Silian_user))),
                'displayName' => (string) ($Silian_user['username'] ?? $Silian_user['email'] ?? ('user-' . $this->requireUserId($Silian_user))),
            ],
            'challenge' => $Silian_challenge,
            'pubKeyCredParams' => array_map(
                static fn (int $Silian_alg): array => ['type' => 'public-key', 'alg' => $Silian_alg],
                $this->config->getAllowedAlgorithms()
            ),
            'timeout' => $this->config->getRegistrationTimeoutMs(),
            'attestation' => $this->config->getAttestationPreference(),
            'authenticatorSelection' => $Silian_authenticatorSelection,
            'excludeCredentials' => array_map([$this, 'mapCredentialDescriptor'], $Silian_existingPasskeys),
            'extensions' => [
                'credProps' => true,
            ],
        ];
    }

    /**
     * @param array<int, array<string, mixed>> $passkeys
     * @return array<string, mixed>
     */
    private function buildAuthenticationOptions(string $Silian_challenge, array $Silian_passkeys): array
    {
        $Silian_options = [
            'challenge' => $Silian_challenge,
            'rpId' => $this->config->getRpId(),
            'timeout' => $this->config->getAuthenticationTimeoutMs(),
            'userVerification' => $this->config->getUserVerificationPreference(),
        ];

        if ($Silian_passkeys !== []) {
            $Silian_options['allowCredentials'] = array_map([$this, 'mapCredentialDescriptor'], $Silian_passkeys);
        }

        return $Silian_options;
    }

    /**
     * @param array<string, mixed> $passkey
     * @return array<string, mixed>
     */
    private function mapCredentialDescriptor(array $Silian_passkey): array
    {
        return [
            'type' => 'public-key',
            'id' => (string) ($Silian_passkey['credential_id'] ?? ''),
            'transports' => is_array($Silian_passkey['transports'] ?? null) && $Silian_passkey['transports'] !== []
                ? array_values($Silian_passkey['transports'])
                : $this->config->getDefaultTransports(),
        ];
    }

    /**
     * @return array<string, mixed>
     */
    private function buildIntegrationMetadata(): array
    {
        return array_merge($this->webauthnProvider->getMetadata(), [
            'enabled' => $this->config->isEnabled(),
            'rp_id' => $this->config->getRpId(),
            'rp_name' => $this->config->getRpName(),
            'allowed_origins' => $this->config->getAllowedOrigins(),
        ]);
    }

    /**
     * @param array<string, mixed> $passkey
     * @return array<string, mixed>
     */
    private function toPublicSummary(array $Silian_passkey): array
    {
        return [
            'id' => isset($Silian_passkey['id']) ? (int) $Silian_passkey['id'] : null,
            'label' => $Silian_passkey['label'] ?? null,
            'credential_id' => $Silian_passkey['credential_id'] ?? null,
            'credential_type' => $Silian_passkey['credential_type'] ?? 'public-key',
            'rp_id' => $Silian_passkey['rp_id'] ?? null,
            'user_handle' => $Silian_passkey['user_handle'] ?? null,
            'transports' => is_array($Silian_passkey['transports'] ?? null) ? $Silian_passkey['transports'] : [],
            'aaguid' => $Silian_passkey['aaguid'] ?? null,
            'sign_count' => (int) ($Silian_passkey['sign_count'] ?? 0),
            'last_used_at' => $Silian_passkey['last_used_at'] ?? null,
            'attested_at' => $Silian_passkey['attested_at'] ?? null,
            'backup_eligible' => (bool) ($Silian_passkey['backup_eligible'] ?? false),
            'backup_state' => (bool) ($Silian_passkey['backup_state'] ?? false),
            'created_at' => $Silian_passkey['created_at'] ?? null,
            'updated_at' => $Silian_passkey['updated_at'] ?? null,
        ];
    }

    private function ensureEnabled(): void
    {
        if (!$this->config->isEnabled()) {
            throw new PasskeyOperationException('Passkeys are disabled by configuration.', 'PASSKEYS_DISABLED', 503);
        }
    }

    /**
     * @param array<string, mixed> $payload
     */
    private function requireChallengeId(array $Silian_payload): string
    {
        $Silian_challengeId = trim((string) ($Silian_payload['challenge_id'] ?? ''));
        if ($Silian_challengeId === '') {
            throw new PasskeyOperationException('challenge_id is required.', 'CHALLENGE_ID_REQUIRED', 400);
        }

        return $Silian_challengeId;
    }

    /**
     * @param array<string, mixed> $payload
     * @return array<string, mixed>
     */
    private function requireCredentialPayload(array $Silian_payload): array
    {
        $Silian_credential = $Silian_payload['credential'] ?? $Silian_payload;
        if (!is_array($Silian_credential)) {
            throw new PasskeyOperationException('credential must be an object.', 'INVALID_CREDENTIAL', 400);
        }

        return $Silian_credential;
    }

    private function extractCredentialId(array $Silian_credential): string
    {
        $Silian_credentialId = trim((string) ($Silian_credential['rawId'] ?? $Silian_credential['id'] ?? ''));
        if ($Silian_credentialId === '') {
            throw new PasskeyOperationException('Credential id is required.', 'MISSING_CREDENTIAL_ID', 400);
        }

        return $Silian_credentialId;
    }

    /**
     * @param array<string, mixed> $user
     */
    private function requireUserId(array $Silian_user): int
    {
        $Silian_userId = $Silian_user['id'] ?? null;
        if (!is_numeric($Silian_userId) || (int) $Silian_userId <= 0) {
            throw new PasskeyOperationException('Authenticated user id is missing.', 'INVALID_USER', 400);
        }

        return (int) $Silian_userId;
    }

    /**
     * @param mixed $value
     */
    private function sanitizeLabel($Silian_value): ?string
    {
        if ($Silian_value === null) {
            return null;
        }

        $Silian_label = trim((string) $Silian_value);
        if ($Silian_label === '') {
            return null;
        }

        return mb_substr($Silian_label, 0, 100);
    }

    /**
     * @param mixed $value
     */
    private function sanitizeIdentifier($Silian_value): ?string
    {
        if ($Silian_value === null) {
            return null;
        }

        $Silian_identifier = trim((string) $Silian_value);
        if ($Silian_identifier === '') {
            return null;
        }

        return mb_substr($Silian_identifier, 0, 255);
    }

    /**
     * @param array<string, mixed> $user
     */
    private function resolveUserHandle(array $Silian_user): string
    {
        return Base64Url::encode($this->requireUserUuid($Silian_user));
    }

    /**
     * @param array<string, mixed> $user
     */
    private function requireUserUuid(array $Silian_user): string
    {
        $Silian_uuid = trim((string) ($Silian_user['uuid'] ?? ''));
        if ($Silian_uuid === '' || !Uuid::isValid($Silian_uuid)) {
            throw new PasskeyOperationException(
                'Passkey operations require a valid persisted user UUID.',
                'USER_UUID_REQUIRED',
                409
            );
        }

        return strtolower($Silian_uuid);
    }

    /**
     * @param array<string, mixed> $user
     */
    private function userHasValidUuid(array $Silian_user): bool
    {
        $Silian_uuid = trim((string) ($Silian_user['uuid'] ?? ''));

        return $Silian_uuid !== '' && Uuid::isValid($Silian_uuid);
    }

    /**
     * @param array<string, mixed> $user
     */
    private function userMatchesIdentifier(array $Silian_user, string $Silian_identifier): bool
    {
        if (filter_var($Silian_identifier, FILTER_VALIDATE_EMAIL) !== false) {
            return strcasecmp((string) ($Silian_user['email'] ?? ''), $Silian_identifier) === 0;
        }

        return strcasecmp((string) ($Silian_user['username'] ?? ''), $Silian_identifier) === 0;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findUserByIdentifier(string $Silian_identifier): ?array
    {
        $Silian_field = filter_var($Silian_identifier, FILTER_VALIDATE_EMAIL) !== false ? 'u.email' : 'u.username';
        $Silian_stmt = $this->db->prepare(
            "SELECT u.*, s.name AS school_name, a.file_path AS avatar_path
             FROM users u
             LEFT JOIN schools s ON u.school_id = s.id
             LEFT JOIN avatars a ON u.avatar_id = a.id
             WHERE {$Silian_field} = ? AND u.deleted_at IS NULL
             LIMIT 1"
        );
        $Silian_stmt->execute([$Silian_identifier]);
        $Silian_user = $Silian_stmt->fetch(PDO::FETCH_ASSOC);

        return $Silian_user ?: null;
    }

    /**
     * @return array<string, mixed>|null
     */
    private function findUserDetailedByUuid(string $Silian_userUuid): ?array
    {
        $Silian_stmt = $this->db->prepare(
            'SELECT u.*, s.name AS school_name, a.file_path AS avatar_path
             FROM users u
             LEFT JOIN schools s ON u.school_id = s.id
             LEFT JOIN avatars a ON u.avatar_id = a.id
             WHERE u.uuid = ? AND u.deleted_at IS NULL
             LIMIT 1'
        );
        $Silian_stmt->execute([strtolower($Silian_userUuid)]);
        $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);

        return $Silian_row ?: null;
    }

    private function touchUserLogin(int $Silian_userId): void
    {
        $Silian_timestamp = gmdate('Y-m-d H:i:s');

        try {
            $Silian_stmt = $this->db->prepare('UPDATE users SET lastlgn = ? WHERE id = ?');
            $Silian_stmt->execute([$Silian_timestamp, $Silian_userId]);
            return;
        } catch (\Throwable $Silian_exception) {
            if ($this->logger !== null) {
                $this->logger->debug('Failed to update legacy user login timestamp after passkey authentication', [
                    'error' => $Silian_exception->getMessage(),
                    'user_id' => $Silian_userId,
                ]);
            }
        }

        try {
            $Silian_stmt = $this->db->prepare('UPDATE users SET last_login_at = ? WHERE id = ?');
            $Silian_stmt->execute([$Silian_timestamp, $Silian_userId]);
        } catch (\Throwable $Silian_exception) {
            if ($this->logger !== null) {
                $this->logger->debug('Failed to update user login timestamp after passkey authentication', [
                    'error' => $Silian_exception->getMessage(),
                    'user_id' => $Silian_userId,
                ]);
            }
        }
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    private function formatUserPayload(array $Silian_row): array
    {
        $Silian_avatar = $this->resolveAvatar($Silian_row['avatar_path'] ?? $Silian_row['avatar_url'] ?? null);
        $Silian_profileFields = $this->userProfileViewService->buildProfileFields($Silian_row);

        return [
            'id' => (int) ($Silian_row['id'] ?? 0),
            'uuid' => $Silian_row['uuid'] ?? null,
            'username' => $Silian_row['username'] ?? null,
            'email' => $Silian_row['email'] ?? null,
            'school_id' => $Silian_profileFields['school_id'],
            'school_name' => $Silian_profileFields['school_name'],
            'points' => (int) ($Silian_row['points'] ?? 0),
            'is_admin' => (bool) ($Silian_row['is_admin'] ?? 0),
            'email_verified_at' => $Silian_row['email_verified_at'] ?? null,
            'avatar_id' => $Silian_row['avatar_id'] ?? null,
            'avatar_path' => $Silian_avatar['avatar_path'],
            'avatar_url' => $Silian_avatar['avatar_url'],
            'lastlgn' => $Silian_row['lastlgn'] ?? ($Silian_row['last_login_at'] ?? null),
            'status' => $Silian_row['status'] ?? null,
            'updated_at' => $Silian_row['updated_at'] ?? null,
            'region_code' => $Silian_profileFields['region_code'],
            'region_label' => $Silian_profileFields['region_label'],
            'country_code' => $Silian_profileFields['country_code'],
            'state_code' => $Silian_profileFields['state_code'],
            'country_name' => $Silian_profileFields['country_name'],
            'state_name' => $Silian_profileFields['state_name'],
        ];
    }

    /**
     * @return array{avatar_path:?string,avatar_url:?string}
     */
    private function resolveAvatar(?string $Silian_filePath): array
    {
        $Silian_originalPath = $Silian_filePath !== null ? trim($Silian_filePath) : null;
        if ($Silian_originalPath === '') {
            $Silian_originalPath = null;
        }

        $Silian_normalized = $Silian_originalPath ? ltrim($Silian_originalPath, '/') : null;
        $Silian_url = ($Silian_normalized && $this->r2Service !== null) ? $this->r2Service->getPublicUrl($Silian_normalized) : null;

        return [
            'avatar_path' => $Silian_originalPath,
            'avatar_url' => $Silian_url,
        ];
    }

    /**
     * @param array<string, mixed> $data
     */
    private function logPasskeyEvent(
        string $Silian_action,
        int $Silian_userId,
        string $Silian_status,
        array $Silian_data,
        string $Silian_changeType = 'other',
        string $Silian_table = 'user_passkeys'
    ): void {
        $this->auditLogService->log([
            'action' => $Silian_action,
            'operation_category' => 'authentication',
            'user_id' => $Silian_userId,
            'actor_type' => 'user',
            'affected_table' => $Silian_table,
            'status' => $Silian_status,
            'change_type' => $Silian_changeType,
            'data' => $Silian_data,
        ]);
    }

    private function countAuditActionSince(string $Silian_action, string $Silian_since): int
    {
        $Silian_stmt = $this->db->prepare(
            'SELECT COUNT(*)
             FROM audit_logs
             WHERE action = :action
               AND status = :status
               AND created_at >= :since'
        );
        $Silian_stmt->execute([
            'action' => $Silian_action,
            'status' => 'success',
            'since' => $Silian_since,
        ]);

        return (int) $Silian_stmt->fetchColumn();
    }
}
