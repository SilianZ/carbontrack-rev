<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Services\Webauthn\Base64Url;
use CarbonTrack\Services\Webauthn\CborDecoder;

class NativeWebauthnProvider implements WebauthnProviderInterface
{
    private const FLAG_USER_PRESENT = 0x01;
    private const FLAG_USER_VERIFIED = 0x04;
    private const FLAG_BACKUP_ELIGIBLE = 0x08;
    private const FLAG_BACKUP_STATE = 0x10;
    private const FLAG_ATTESTED_CREDENTIAL_DATA = 0x40;
    private const FLAG_EXTENSION_DATA = 0x80;

    public function isAvailable(): bool
    {
        return extension_loaded('openssl');
    }

    public function getMetadata(): array
    {
        return [
            'package' => null,
            'implementation' => 'native',
            'available' => $this->isAvailable(),
            'expected_extension' => 'openssl',
        ];
    }

    public function verifyRegistrationResponse(
        array $Silian_credential,
        array $Silian_challengeRecord,
        array $Silian_user,
        PasskeyConfig $Silian_config
    ): array {
        unset($Silian_user);

        $this->ensureAvailable();

        try {
            $Silian_clientData = $this->decodeClientData($Silian_credential, 'webauthn.create', (string) $Silian_challengeRecord['challenge'], $Silian_config);
            $Silian_attestationObject = $this->decodeRequiredResponseField($Silian_credential, 'attestationObject');
            $Silian_decodedAttestation = CborDecoder::decode($Silian_attestationObject);
            if (!is_array($Silian_decodedAttestation)) {
                throw new \InvalidArgumentException('Attestation object must decode to a CBOR map.');
            }

            $Silian_fmt = (string) ($Silian_decodedAttestation['fmt'] ?? '');
            $Silian_authDataBinary = $Silian_decodedAttestation['authData'] ?? null;
            if (!is_string($Silian_authDataBinary) || $Silian_authDataBinary === '') {
                throw new \InvalidArgumentException('Attestation authData is missing.');
            }

            $Silian_parsedAuthData = $this->parseAuthenticatorData($Silian_authDataBinary, true);
            $this->assertRpIdHash($Silian_parsedAuthData['rp_id_hash'], $Silian_config->getRpId());
            $this->assertUserPresence($Silian_parsedAuthData['user_present']);

            if ($Silian_config->getUserVerificationPreference() === 'required') {
                $this->assertUserVerification($Silian_parsedAuthData['user_verified']);
            }

            $Silian_credentialPublicKeyBytes = $Silian_parsedAuthData['credential_public_key'] ?? null;
            if (!is_string($Silian_credentialPublicKeyBytes) || $Silian_credentialPublicKeyBytes === '') {
                throw new \InvalidArgumentException('Credential public key is missing.');
            }

            $Silian_normalizedKey = $this->normalizeCredentialPublicKey($Silian_credentialPublicKeyBytes);
            $this->verifyAttestationStatement(
                $Silian_fmt,
                is_array($Silian_decodedAttestation['attStmt'] ?? null) ? $Silian_decodedAttestation['attStmt'] : [],
                $Silian_authDataBinary,
                $Silian_clientData['hash'],
                $Silian_normalizedKey
            );

            return [
                'credential_id' => $Silian_parsedAuthData['credential_id'],
                'credential_type' => 'public-key',
                'public_key' => json_encode($Silian_normalizedKey, JSON_UNESCAPED_SLASHES),
                'rp_id' => $Silian_config->getRpId(),
                'user_handle' => is_array($Silian_challengeRecord['context'] ?? null)
                    ? (string) (($Silian_challengeRecord['context']['user_handle'] ?? '') ?: '')
                    : '',
                'transports' => $this->extractTransports($Silian_credential),
                'aaguid' => $Silian_parsedAuthData['aaguid'],
                'sign_count' => $Silian_parsedAuthData['sign_count'],
                'attestation_format' => $Silian_fmt !== '' ? $Silian_fmt : 'none',
                'backup_eligible' => $Silian_parsedAuthData['backup_eligible'],
                'backup_state' => $Silian_parsedAuthData['backup_state'],
                'meta' => [
                    'provider' => 'native',
                    'public_key_algorithm' => $Silian_normalizedKey['alg'] ?? null,
                    'credential_public_key' => Base64Url::encode($Silian_credentialPublicKeyBytes),
                    'authenticator_attachment' => $Silian_credential['authenticatorAttachment'] ?? null,
                ],
                'attested_at' => gmdate('Y-m-d H:i:s'),
            ];
        } catch (PasskeyOperationException $Silian_exception) {
            throw $Silian_exception;
        } catch (\Throwable $Silian_exception) {
            throw new PasskeyOperationException(
                'Passkey registration response validation failed.',
                'INVALID_REGISTRATION_RESPONSE',
                400,
                $Silian_exception
            );
        }
    }

    public function verifyAuthenticationResponse(
        array $Silian_credential,
        array $Silian_challengeRecord,
        array $Silian_passkey,
        PasskeyConfig $Silian_config
    ): array {
        $this->ensureAvailable();

        try {
            $Silian_clientData = $this->decodeClientData($Silian_credential, 'webauthn.get', (string) $Silian_challengeRecord['challenge'], $Silian_config);
            $Silian_authenticatorData = $this->decodeRequiredResponseField($Silian_credential, 'authenticatorData');
            $Silian_signature = $this->decodeRequiredResponseField($Silian_credential, 'signature');
            $Silian_parsedAuthData = $this->parseAuthenticatorData($Silian_authenticatorData, false);

            $this->assertRpIdHash($Silian_parsedAuthData['rp_id_hash'], (string) ($Silian_passkey['rp_id'] ?? $Silian_config->getRpId()));
            $this->assertUserPresence($Silian_parsedAuthData['user_present']);

            if ($Silian_config->getUserVerificationPreference() === 'required') {
                $this->assertUserVerification($Silian_parsedAuthData['user_verified']);
            }

            $Silian_expectedUserHandle = trim((string) ($Silian_passkey['user_handle'] ?? ''));
            $Silian_presentedUserHandle = null;
            if (isset($Silian_credential['response']['userHandle']) && $Silian_credential['response']['userHandle'] !== null) {
                $Silian_presentedUserHandle = Base64Url::encode(Base64Url::decode((string) $Silian_credential['response']['userHandle']));
            }

            if ($Silian_presentedUserHandle !== null && $Silian_expectedUserHandle !== '' && !hash_equals($Silian_expectedUserHandle, $Silian_presentedUserHandle)) {
                throw new PasskeyOperationException('Passkey user handle mismatch.', 'INVALID_USER_HANDLE', 400);
            }

            $Silian_normalizedKey = $this->loadStoredPublicKey((string) ($Silian_passkey['public_key'] ?? ''));
            $Silian_signedPayload = $Silian_authenticatorData . $Silian_clientData['hash'];
            if (!$this->verifySignature($Silian_signedPayload, $Silian_signature, $Silian_normalizedKey, (int) ($Silian_normalizedKey['alg'] ?? 0))) {
                throw new PasskeyOperationException('Passkey signature verification failed.', 'INVALID_SIGNATURE', 401);
            }

            $Silian_storedSignCount = (int) ($Silian_passkey['sign_count'] ?? 0);
            $Silian_newSignCount = (int) ($Silian_parsedAuthData['sign_count'] ?? 0);
            if ($Silian_storedSignCount > 0 && $Silian_newSignCount > 0 && $Silian_newSignCount <= $Silian_storedSignCount) {
                throw new PasskeyOperationException('Authenticator sign count did not advance.', 'SIGN_COUNT_REPLAY', 401);
            }

            return [
                'credential_id' => $this->extractCredentialId($Silian_credential),
                'sign_count' => $Silian_newSignCount,
                'user_handle' => $Silian_expectedUserHandle,
                'backup_eligible' => $Silian_parsedAuthData['backup_eligible'],
                'backup_state' => $Silian_parsedAuthData['backup_state'],
                'last_used_at' => gmdate('Y-m-d H:i:s'),
            ];
        } catch (PasskeyOperationException $Silian_exception) {
            throw $Silian_exception;
        } catch (\Throwable $Silian_exception) {
            throw new PasskeyOperationException(
                'Passkey authentication response validation failed.',
                'INVALID_AUTHENTICATION_RESPONSE',
                401,
                $Silian_exception
            );
        }
    }

    private function ensureAvailable(): void
    {
        if (!$this->isAvailable()) {
            throw new PasskeyIntegrationUnavailableException('native-openssl');
        }
    }

    private function decodeClientData(
        array $Silian_credential,
        string $Silian_expectedType,
        string $Silian_expectedChallenge,
        PasskeyConfig $Silian_config
    ): array {
        $Silian_clientDataBinary = $this->decodeRequiredResponseField($Silian_credential, 'clientDataJSON');
        $Silian_clientData = json_decode($Silian_clientDataBinary, true);
        if (!is_array($Silian_clientData)) {
            throw new \InvalidArgumentException('Client data JSON is invalid.');
        }

        if (($Silian_clientData['type'] ?? null) !== $Silian_expectedType) {
            throw new PasskeyOperationException('Unexpected WebAuthn ceremony type.', 'INVALID_CEREMONY_TYPE', 400);
        }

        if (!hash_equals($Silian_expectedChallenge, (string) ($Silian_clientData['challenge'] ?? ''))) {
            throw new PasskeyOperationException('WebAuthn challenge mismatch.', 'INVALID_CHALLENGE', 400);
        }

        $Silian_origin = trim((string) ($Silian_clientData['origin'] ?? ''));
        if ($Silian_origin === '' || !$this->isAllowedOrigin($Silian_origin, $Silian_config->getAllowedOrigins())) {
            throw new PasskeyOperationException('WebAuthn origin is not allowed.', 'INVALID_ORIGIN', 400);
        }

        if (!empty($Silian_clientData['crossOrigin'])) {
            throw new PasskeyOperationException('Cross-origin WebAuthn responses are not allowed.', 'CROSS_ORIGIN_NOT_ALLOWED', 400);
        }

        return [
            'json' => $Silian_clientData,
            'binary' => $Silian_clientDataBinary,
            'hash' => hash('sha256', $Silian_clientDataBinary, true),
        ];
    }

    private function isAllowedOrigin(string $Silian_origin, array $Silian_allowedOrigins): bool
    {
        foreach ($Silian_allowedOrigins as $Silian_allowedOrigin) {
            if (hash_equals(rtrim($Silian_allowedOrigin, '/'), rtrim($Silian_origin, '/'))) {
                return true;
            }
        }

        return false;
    }

    private function decodeRequiredResponseField(array $Silian_credential, string $Silian_field): string
    {
        $Silian_value = $Silian_credential['response'][$Silian_field] ?? null;
        if (!is_string($Silian_value) || trim($Silian_value) === '') {
            throw new \InvalidArgumentException(sprintf('Credential response field %s is missing.', $Silian_field));
        }

        return Base64Url::decode($Silian_value);
    }

    private function extractCredentialId(array $Silian_credential): string
    {
        foreach (['rawId', 'id'] as $Silian_field) {
            $Silian_value = $Silian_credential[$Silian_field] ?? null;
            if (is_string($Silian_value) && trim($Silian_value) !== '') {
                return trim($Silian_value);
            }
        }

        throw new PasskeyOperationException('Credential id is required.', 'MISSING_CREDENTIAL_ID', 400);
    }

    private function parseAuthenticatorData(string $Silian_authData, bool $Silian_requireAttestedCredentialData): array
    {
        if (strlen($Silian_authData) < 37) {
            throw new \InvalidArgumentException('Authenticator data is too short.');
        }

        $Silian_rpIdHash = substr($Silian_authData, 0, 32);
        $Silian_flags = ord($Silian_authData[32]);
        $Silian_signCount = unpack('N', substr($Silian_authData, 33, 4))[1];
        $Silian_offset = 37;

        $Silian_aaguid = null;
        $Silian_credentialId = null;
        $Silian_credentialPublicKey = null;

        if (($Silian_flags & self::FLAG_ATTESTED_CREDENTIAL_DATA) !== 0) {
            if (strlen($Silian_authData) < ($Silian_offset + 18)) {
                throw new \InvalidArgumentException('Authenticator attested credential data is incomplete.');
            }

            $Silian_aaguid = $this->formatUuidLikeHex(substr($Silian_authData, $Silian_offset, 16));
            $Silian_offset += 16;
            $Silian_credentialIdLength = unpack('n', substr($Silian_authData, $Silian_offset, 2))[1];
            $Silian_offset += 2;

            $Silian_credentialId = substr($Silian_authData, $Silian_offset, $Silian_credentialIdLength);
            $Silian_offset += $Silian_credentialIdLength;
            if ($Silian_credentialId === false || $Silian_credentialId === '') {
                throw new \InvalidArgumentException('Credential id is missing from authenticator data.');
            }

            $Silian_oldOffset = $Silian_offset;
            try {
                CborDecoder::decodeWithOffset($Silian_authData, $Silian_offset);
                $Silian_credentialPublicKey = substr($Silian_authData, $Silian_oldOffset, $Silian_offset - $Silian_oldOffset);
            } catch (\Exception $Silian_e) {
                throw new \InvalidArgumentException('Failed to decode credential public key: ' . $Silian_e->getMessage());
            }

            if ($Silian_credentialPublicKey === false || $Silian_credentialPublicKey === '') {
                throw new \InvalidArgumentException('Credential public key is missing from authenticator data.');
            }
        } elseif ($Silian_requireAttestedCredentialData) {
            throw new \InvalidArgumentException('Authenticator data is missing attested credential data.');
        }

        $Silian_extensions = null;
        if (($Silian_flags & self::FLAG_EXTENSION_DATA) !== 0) {
            try {
                $Silian_extensions = CborDecoder::decodeWithOffset($Silian_authData, $Silian_offset);
            } catch (\Exception $Silian_e) {
                throw new \InvalidArgumentException('Failed to decode extensions: ' . $Silian_e->getMessage());
            }
        }

        if ($Silian_offset !== strlen($Silian_authData)) {
            throw new \InvalidArgumentException('Authenticator data contains unexpected trailing bytes.');
        }

        return [
            'rp_id_hash' => $Silian_rpIdHash,
            'sign_count' => (int) $Silian_signCount,
            'user_present' => ($Silian_flags & self::FLAG_USER_PRESENT) !== 0,
            'user_verified' => ($Silian_flags & self::FLAG_USER_VERIFIED) !== 0,
            'backup_eligible' => ($Silian_flags & self::FLAG_BACKUP_ELIGIBLE) !== 0,
            'backup_state' => ($Silian_flags & self::FLAG_BACKUP_STATE) !== 0,
            'aaguid' => $Silian_aaguid,
            'credential_id' => $Silian_credentialId !== null ? Base64Url::encode($Silian_credentialId) : null,
            'credential_public_key' => $Silian_credentialPublicKey,
            'extensions' => $Silian_extensions,
        ];
    }

    private function verifyAttestationStatement(
        string $Silian_format,
        array $Silian_attestationStatement,
        string $Silian_authDataBinary,
        string $Silian_clientDataHash,
        array $Silian_normalizedKey
    ): void {
        if ($Silian_format === '' || $Silian_format === 'none') {
            return;
        }

        if ($Silian_format !== 'packed') {
            throw new PasskeyOperationException('Unsupported attestation format.', 'UNSUPPORTED_ATTESTATION_FORMAT', 400);
        }

        $Silian_alg = isset($Silian_attestationStatement['alg']) && is_int($Silian_attestationStatement['alg'])
            ? $Silian_attestationStatement['alg']
            : (int) ($Silian_normalizedKey['alg'] ?? 0);
        $Silian_signature = $Silian_attestationStatement['sig'] ?? null;
        if (!is_string($Silian_signature) || $Silian_signature === '') {
            throw new PasskeyOperationException('Packed attestation signature is missing.', 'INVALID_ATTESTATION', 400);
        }

        $Silian_signedPayload = $Silian_authDataBinary . $Silian_clientDataHash;
        $Silian_verificationKey = $Silian_normalizedKey;
        if (isset($Silian_attestationStatement['x5c']) && is_array($Silian_attestationStatement['x5c']) && isset($Silian_attestationStatement['x5c'][0]) && is_string($Silian_attestationStatement['x5c'][0])) {
            $Silian_verificationKey = [
                'alg' => $Silian_alg,
                'pem' => $this->derToPemCertificate($Silian_attestationStatement['x5c'][0]),
            ];
        }

        if (!$this->verifySignature($Silian_signedPayload, $Silian_signature, $Silian_verificationKey, $Silian_alg)) {
            throw new PasskeyOperationException('Packed attestation signature verification failed.', 'INVALID_ATTESTATION', 400);
        }
    }

    private function normalizeCredentialPublicKey(string $Silian_credentialPublicKeyBytes): array
    {
        $Silian_coseKey = CborDecoder::decode($Silian_credentialPublicKeyBytes);
        if (!is_array($Silian_coseKey)) {
            throw new \InvalidArgumentException('Credential public key CBOR must decode to a map.');
        }

        $Silian_kty = (int) ($Silian_coseKey[1] ?? 0);
        $Silian_alg = (int) ($Silian_coseKey[3] ?? 0);

        if ($Silian_kty === 2) {
            $Silian_curve = (int) ($Silian_coseKey[-1] ?? 0);
            $Silian_x = $Silian_coseKey[-2] ?? null;
            $Silian_y = $Silian_coseKey[-3] ?? null;
            if (!is_string($Silian_x) || !is_string($Silian_y)) {
                throw new \InvalidArgumentException('EC2 credential public key is incomplete.');
            }

            return [
                'alg' => $Silian_alg,
                'kty' => 'EC2',
                'curve' => $this->mapEcCurve($Silian_curve),
                'x' => Base64Url::encode($Silian_x),
                'y' => Base64Url::encode($Silian_y),
                'pem' => $this->buildEcPublicKeyPem($Silian_curve, $Silian_x, $Silian_y),
            ];
        }

        if ($Silian_kty === 3) {
            $Silian_modulus = $Silian_coseKey[-1] ?? null;
            $Silian_exponent = $Silian_coseKey[-2] ?? null;
            if (!is_string($Silian_modulus) || !is_string($Silian_exponent)) {
                throw new \InvalidArgumentException('RSA credential public key is incomplete.');
            }

            return [
                'alg' => $Silian_alg,
                'kty' => 'RSA',
                'n' => Base64Url::encode($Silian_modulus),
                'e' => Base64Url::encode($Silian_exponent),
                'pem' => $this->buildRsaPublicKeyPem($Silian_modulus, $Silian_exponent),
            ];
        }

        throw new PasskeyOperationException('Unsupported credential public key type.', 'UNSUPPORTED_PUBLIC_KEY', 400);
    }

    private function loadStoredPublicKey(string $Silian_value): array
    {
        $Silian_decoded = json_decode($Silian_value, true);
        if (is_array($Silian_decoded)) {
            return $Silian_decoded;
        }

        if (strpos($Silian_value, 'BEGIN PUBLIC KEY') !== false) {
            return [
                'alg' => -7,
                'pem' => $Silian_value,
            ];
        }

        throw new PasskeyOperationException('Stored passkey public key is invalid.', 'INVALID_STORED_PUBLIC_KEY', 500);
    }

    private function verifySignature(string $Silian_payload, string $Silian_signature, array $Silian_verificationKey, int $Silian_alg): bool
    {
        $Silian_pem = $Silian_verificationKey['pem'] ?? null;
        if (!is_string($Silian_pem) || $Silian_pem === '') {
            return false;
        }

        $Silian_opensslAlgorithm = $this->mapOpenSslAlgorithm($Silian_alg);
        if ($Silian_opensslAlgorithm === null) {
            return false;
        }

        return openssl_verify($Silian_payload, $Silian_signature, $Silian_pem, $Silian_opensslAlgorithm) === 1;
    }

    private function mapOpenSslAlgorithm(int $Silian_alg): ?int
    {
        if ($Silian_alg === -7) {
            return OPENSSL_ALGO_SHA256;
        }

        if ($Silian_alg === -257) {
            return OPENSSL_ALGO_SHA256;
        }

        return null;
    }

    private function assertRpIdHash(string $Silian_presentedHash, string $Silian_rpId): void
    {
        if (!hash_equals(hash('sha256', strtolower($Silian_rpId), true), $Silian_presentedHash)) {
            throw new PasskeyOperationException('Relying party id hash mismatch.', 'INVALID_RP_ID', 400);
        }
    }

    private function assertUserPresence(bool $Silian_userPresent): void
    {
        if (!$Silian_userPresent) {
            throw new PasskeyOperationException('Authenticator did not signal user presence.', 'USER_PRESENCE_REQUIRED', 400);
        }
    }

    private function assertUserVerification(bool $Silian_userVerified): void
    {
        if (!$Silian_userVerified) {
            throw new PasskeyOperationException('Authenticator did not complete user verification.', 'USER_VERIFICATION_REQUIRED', 400);
        }
    }

    /**
     * @return string[]
     */
    private function extractTransports(array $Silian_credential): array
    {
        $Silian_transports = [];
        if (isset($Silian_credential['response']['transports']) && is_array($Silian_credential['response']['transports'])) {
            $Silian_transports = $Silian_credential['response']['transports'];
        }

        if ($Silian_transports === [] && isset($Silian_credential['authenticatorAttachment']) && is_string($Silian_credential['authenticatorAttachment'])) {
            $Silian_transports[] = $Silian_credential['authenticatorAttachment'] === 'platform' ? 'internal' : $Silian_credential['authenticatorAttachment'];
        }

        return array_values(array_unique(array_filter(array_map('strval', $Silian_transports), static fn (string $Silian_transport): bool => $Silian_transport !== '')));
    }

    private function mapEcCurve(int $Silian_curve): string
    {
        if ($Silian_curve === 1) {
            return 'P-256';
        }

        if ($Silian_curve === 2) {
            return 'P-384';
        }

        if ($Silian_curve === 3) {
            return 'P-521';
        }

        throw new PasskeyOperationException('Unsupported EC public key curve.', 'UNSUPPORTED_PUBLIC_KEY', 400);
    }

    private function buildEcPublicKeyPem(int $Silian_curve, string $Silian_x, string $Silian_y): string
    {
        if ($Silian_curve !== 1) {
            throw new PasskeyOperationException('Only P-256 passkeys are currently supported.', 'UNSUPPORTED_PUBLIC_KEY', 400);
        }

        $Silian_algorithm = $this->derSequence(
            $this->derOid('1.2.840.10045.2.1'),
            $this->derOid('1.2.840.10045.3.1.7')
        );
        $Silian_publicKey = "\x04" . $Silian_x . $Silian_y;
        $Silian_spki = $this->derSequence(
            $Silian_algorithm,
            $this->derBitString($Silian_publicKey)
        );

        return $this->derToPemPublicKey($Silian_spki);
    }

    private function buildRsaPublicKeyPem(string $Silian_modulus, string $Silian_exponent): string
    {
        $Silian_rsaPublicKey = $this->derSequence(
            $this->derInteger($Silian_modulus),
            $this->derInteger($Silian_exponent)
        );
        $Silian_algorithm = $this->derSequence(
            $this->derOid('1.2.840.113549.1.1.1'),
            $this->derNull()
        );
        $Silian_spki = $this->derSequence(
            $Silian_algorithm,
            $this->derBitString($Silian_rsaPublicKey)
        );

        return $this->derToPemPublicKey($Silian_spki);
    }

    private function derToPemPublicKey(string $Silian_der): string
    {
        return "-----BEGIN PUBLIC KEY-----\n"
            . chunk_split(base64_encode($Silian_der), 64, "\n")
            . "-----END PUBLIC KEY-----\n";
    }

    private function derToPemCertificate(string $Silian_der): string
    {
        return "-----BEGIN CERTIFICATE-----\n"
            . chunk_split(base64_encode($Silian_der), 64, "\n")
            . "-----END CERTIFICATE-----\n";
    }

    private function derSequence(string ...$Silian_parts): string
    {
        $Silian_payload = implode('', $Silian_parts);
        return "\x30" . $this->derLength(strlen($Silian_payload)) . $Silian_payload;
    }

    private function derBitString(string $Silian_payload): string
    {
        return "\x03" . $this->derLength(strlen($Silian_payload) + 1) . "\x00" . $Silian_payload;
    }

    private function derInteger(string $Silian_payload): string
    {
        if ($Silian_payload === '' || (ord($Silian_payload[0]) & 0x80) !== 0) {
            $Silian_payload = "\x00" . $Silian_payload;
        }

        return "\x02" . $this->derLength(strlen($Silian_payload)) . $Silian_payload;
    }

    private function derNull(): string
    {
        return "\x05\x00";
    }

    private function derOid(string $Silian_oid): string
    {
        $Silian_parts = array_map('intval', explode('.', $Silian_oid));
        $Silian_first = (40 * $Silian_parts[0]) + $Silian_parts[1];
        $Silian_encoded = chr($Silian_first);
        for ($Silian_index = 2, $Silian_count = count($Silian_parts); $Silian_index < $Silian_count; $Silian_index++) {
            $Silian_encoded .= $this->encodeBase128($Silian_parts[$Silian_index]);
        }

        return "\x06" . $this->derLength(strlen($Silian_encoded)) . $Silian_encoded;
    }

    private function encodeBase128(int $Silian_value): string
    {
        $Silian_bytes = [chr($Silian_value & 0x7f)];
        $Silian_value >>= 7;
        while ($Silian_value > 0) {
            array_unshift($Silian_bytes, chr(($Silian_value & 0x7f) | 0x80));
            $Silian_value >>= 7;
        }

        return implode('', $Silian_bytes);
    }

    private function derLength(int $Silian_length): string
    {
        if ($Silian_length < 128) {
            return chr($Silian_length);
        }

        $Silian_bytes = '';
        while ($Silian_length > 0) {
            $Silian_bytes = chr($Silian_length & 0xff) . $Silian_bytes;
            $Silian_length >>= 8;
        }

        return chr(0x80 | strlen($Silian_bytes)) . $Silian_bytes;
    }

    private function formatUuidLikeHex(string $Silian_binary): string
    {
        $Silian_hex = bin2hex($Silian_binary);
        return substr($Silian_hex, 0, 8)
            . '-' . substr($Silian_hex, 8, 4)
            . '-' . substr($Silian_hex, 12, 4)
            . '-' . substr($Silian_hex, 16, 4)
            . '-' . substr($Silian_hex, 20, 12);
    }
}
