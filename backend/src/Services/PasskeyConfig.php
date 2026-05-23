<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

class PasskeyConfig
{
    private const DEFAULT_ALLOWED_ALGORITHMS = [-7, -257];
    private const DEFAULT_TRANSPORTS = ['internal', 'hybrid', 'usb', 'ble', 'nfc'];

    /**
     * @param array<string, mixed>|null $env
     */
    public function __construct(private ?array $env = null)
    {
        $this->env = $env ?? $_ENV;
    }

    public function isEnabled(): bool
    {
        return $this->getBool('PASSKEYS_ENABLED', true);
    }

    public function getRpId(): string
    {
        $Silian_frontendHost = $this->resolveHostFromUrl((string) ($this->env['FRONTEND_URL'] ?? ''));
        $Silian_allowedOriginHosts = $this->getAllowedOriginHosts();

        $Silian_value = trim((string) ($this->env['PASSKEYS_RP_ID'] ?? ''));
        if ($Silian_value !== '') {
            $Silian_rpId = strtolower($Silian_value);

            if ($Silian_frontendHost !== null) {
                if ($this->isRpIdCompatibleWithHost($Silian_rpId, $Silian_frontendHost)) {
                    return $Silian_rpId;
                }
            } elseif ($Silian_allowedOriginHosts === [] || $this->isRpIdCompatibleWithAnyHost($Silian_rpId, $Silian_allowedOriginHosts)) {
                return $Silian_rpId;
            }
        }

        if ($Silian_frontendHost !== null) {
            return $Silian_frontendHost;
        }

        if ($Silian_allowedOriginHosts !== []) {
            return $Silian_allowedOriginHosts[0];
        }

        $Silian_appUrlHost = $this->resolveHostFromUrl((string) ($this->env['APP_URL'] ?? ''));
        if ($Silian_appUrlHost !== null) {
            return $Silian_appUrlHost;
        }

        return 'localhost';
    }

    public function getRpName(): string
    {
        $Silian_value = trim((string) ($this->env['PASSKEYS_RP_NAME'] ?? ''));
        if ($Silian_value !== '') {
            return $Silian_value;
        }

        $Silian_appName = trim((string) ($this->env['APP_NAME'] ?? ''));
        return $Silian_appName !== '' ? $Silian_appName : 'CarbonTrack';
    }

    /**
     * @return string[]
     */
    public function getAllowedOrigins(): array
    {
        $Silian_origins = $this->normalizeOrigins($this->splitCsv((string) ($this->env['PASSKEYS_ORIGINS'] ?? '')));
        $Silian_frontendOrigin = $this->resolveOriginFromUrl((string) ($this->env['FRONTEND_URL'] ?? ''));

        if ($Silian_frontendOrigin !== null) {
            $Silian_origins[] = $Silian_frontendOrigin;
        }

        $Silian_origins = array_values(array_unique($Silian_origins));
        if ($Silian_origins !== []) {
            return $Silian_origins;
        }

        $Silian_appOrigin = $this->resolveOriginFromUrl((string) ($this->env['APP_URL'] ?? ''));
        return $Silian_appOrigin !== null ? [$Silian_appOrigin] : [];
    }

    public function getChallengeTtlSeconds(): int
    {
        return max(60, $this->getInt('PASSKEYS_CHALLENGE_TTL_SECONDS', 300));
    }

    public function getRegistrationTimeoutMs(): int
    {
        return max(60000, $this->getInt('PASSKEYS_REGISTRATION_TIMEOUT_MS', $this->getChallengeTtlSeconds() * 1000));
    }

    public function getAuthenticationTimeoutMs(): int
    {
        return max(30000, $this->getInt('PASSKEYS_AUTHENTICATION_TIMEOUT_MS', $this->getChallengeTtlSeconds() * 1000));
    }

    public function getAttestationPreference(): string
    {
        $Silian_value = trim((string) ($this->env['PASSKEYS_ATTESTATION'] ?? 'none'));
        return $Silian_value !== '' ? $Silian_value : 'none';
    }

    public function getResidentKeyPreference(): string
    {
        $Silian_value = trim((string) ($this->env['PASSKEYS_RESIDENT_KEY'] ?? 'preferred'));
        return $Silian_value !== '' ? $Silian_value : 'preferred';
    }

    public function getUserVerificationPreference(): string
    {
        $Silian_value = trim((string) ($this->env['PASSKEYS_USER_VERIFICATION'] ?? 'preferred'));
        return $Silian_value !== '' ? $Silian_value : 'preferred';
    }

    public function getAuthenticatorAttachment(): ?string
    {
        $Silian_value = trim((string) ($this->env['PASSKEYS_AUTHENTICATOR_ATTACHMENT'] ?? ''));
        return $Silian_value !== '' ? $Silian_value : null;
    }

    /**
     * @return int[]
     */
    public function getAllowedAlgorithms(): array
    {
        $Silian_values = $this->splitCsv((string) ($this->env['PASSKEYS_ALLOWED_ALGORITHMS'] ?? ''));
        if ($Silian_values === []) {
            return self::DEFAULT_ALLOWED_ALGORITHMS;
        }

        $Silian_algorithms = [];
        foreach ($Silian_values as $Silian_value) {
            if (is_numeric($Silian_value)) {
                $Silian_algorithms[] = (int) $Silian_value;
            }
        }

        return $Silian_algorithms !== [] ? array_values(array_unique($Silian_algorithms)) : self::DEFAULT_ALLOWED_ALGORITHMS;
    }

    /**
     * @return string[]
     */
    public function getDefaultTransports(): array
    {
        $Silian_values = $this->splitCsv((string) ($this->env['PASSKEYS_DEFAULT_TRANSPORTS'] ?? ''));
        return $Silian_values !== [] ? $Silian_values : self::DEFAULT_TRANSPORTS;
    }

    public function getPreferredLibraryPackage(): string
    {
        return 'web-auth/webauthn-lib';
    }

    private function getBool(string $Silian_key, bool $Silian_default): bool
    {
        if (!array_key_exists($Silian_key, $this->env)) {
            return $Silian_default;
        }

        $Silian_value = filter_var($this->env[$Silian_key], FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
        return $Silian_value ?? $Silian_default;
    }

    private function getInt(string $Silian_key, int $Silian_default): int
    {
        if (!array_key_exists($Silian_key, $this->env)) {
            return $Silian_default;
        }

        $Silian_value = filter_var($this->env[$Silian_key], FILTER_VALIDATE_INT);
        return $Silian_value === false ? $Silian_default : (int) $Silian_value;
    }

    /**
     * @return string[]
     */
    private function splitCsv(string $Silian_value): array
    {
        $Silian_parts = array_map('trim', explode(',', $Silian_value));
        $Silian_parts = array_filter($Silian_parts, static fn (string $Silian_item): bool => $Silian_item !== '');
        return array_values(array_unique($Silian_parts));
    }

    /**
     * @param string[] $origins
     * @return string[]
     */
    private function normalizeOrigins(array $Silian_origins): array
    {
        $Silian_normalized = [];

        foreach ($Silian_origins as $Silian_origin) {
            $Silian_normalizedOrigin = $this->resolveOriginFromUrl($Silian_origin);
            $Silian_normalized[] = $Silian_normalizedOrigin ?? trim($Silian_origin);
        }

        return array_values(array_unique(array_filter($Silian_normalized, static fn (string $Silian_origin): bool => $Silian_origin !== '')));
    }

    /**
     * @return string[]
     */
    private function getAllowedOriginHosts(): array
    {
        $Silian_hosts = [];

        foreach ($this->getAllowedOrigins() as $Silian_origin) {
            $Silian_host = $this->resolveHostFromUrl($Silian_origin);
            if ($Silian_host !== null) {
                $Silian_hosts[] = $Silian_host;
            }
        }

        return array_values(array_unique($Silian_hosts));
    }

    private function isRpIdCompatibleWithAnyHost(string $Silian_rpId, array $Silian_hosts): bool
    {
        foreach ($Silian_hosts as $Silian_host) {
            if ($this->isRpIdCompatibleWithHost($Silian_rpId, $Silian_host)) {
                return true;
            }
        }

        return false;
    }

    private function isRpIdCompatibleWithHost(string $Silian_rpId, string $Silian_host): bool
    {
        $Silian_rpId = strtolower(trim($Silian_rpId));
        $Silian_host = strtolower(trim($Silian_host));

        if ($Silian_rpId === '' || $Silian_host === '') {
            return false;
        }

        return $Silian_host === $Silian_rpId || str_ends_with($Silian_host, '.' . $Silian_rpId);
    }

    private function resolveOriginFromUrl(string $Silian_url): ?string
    {
        $Silian_url = trim($Silian_url);
        if ($Silian_url === '') {
            return null;
        }

        $Silian_parts = parse_url($Silian_url);
        if (!is_array($Silian_parts)) {
            return null;
        }

        $Silian_scheme = isset($Silian_parts['scheme']) && is_string($Silian_parts['scheme']) ? strtolower($Silian_parts['scheme']) : '';
        $Silian_host = isset($Silian_parts['host']) && is_string($Silian_parts['host']) ? strtolower($Silian_parts['host']) : '';

        if ($Silian_scheme === '' || $Silian_host === '') {
            return null;
        }

        $Silian_origin = $Silian_scheme . '://' . $Silian_host;
        if (isset($Silian_parts['port']) && is_int($Silian_parts['port'])) {
            $Silian_origin .= ':' . $Silian_parts['port'];
        }

        return $Silian_origin;
    }

    private function resolveHostFromUrl(string $Silian_url): ?string
    {
        $Silian_origin = $this->resolveOriginFromUrl($Silian_url);
        if ($Silian_origin === null) {
            return null;
        }

        $Silian_host = parse_url($Silian_origin, PHP_URL_HOST);
        if (!is_string($Silian_host) || $Silian_host === '') {
            return null;
        }

        return strtolower($Silian_host);
    }
}
