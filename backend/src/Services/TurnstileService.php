<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Support\SyntheticRequestFactory;
use Monolog\Logger;

class TurnstileService
{
    private string $secretKey;
    private Logger $logger;
    private string $verifyUrl = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';
    private ?AuditLogService $auditLogService;
    private ?ErrorLogService $errorLogService;
    private ?string $caBundlePath;
    private bool $useNativeCaStore;

    public function __construct(
        string $Silian_secretKey,
        Logger $Silian_logger,
        ?AuditLogService $Silian_auditLogService = null,
        ?ErrorLogService $Silian_errorLogService = null,
        ?string $Silian_caBundlePath = null,
        bool $Silian_useNativeCaStore = false
    )
    {
        $this->secretKey = $Silian_secretKey;
        $this->logger = $Silian_logger;
        $this->auditLogService = $Silian_auditLogService;
        $this->errorLogService = $Silian_errorLogService;
        $this->caBundlePath = is_string($Silian_caBundlePath) && trim($Silian_caBundlePath) !== '' ? trim($Silian_caBundlePath) : null;
        $this->useNativeCaStore = $Silian_useNativeCaStore;
    }

    /**
     * Verify Turnstile token
     *
     * @param string $token The Turnstile token from the client
     * @param string|null $remoteIp The client's IP address
     * @return array Verification result with success status and details
     */
    public function verify(string $Silian_token, ?string $Silian_remoteIp = null): array
    {
        $Silian_appEnv = strtolower((string)($_ENV['APP_ENV'] ?? ''));
        $Silian_bypass = filter_var($_ENV['TURNSTILE_BYPASS'] ?? false, FILTER_VALIDATE_BOOLEAN);
        if ($Silian_appEnv === 'testing' || $Silian_bypass) {
            return ['success' => true, 'bypassed' => true];
        }

        if (empty($Silian_token)) {
            $this->logAudit('turnstile_verification_missing_token', ['remote_ip' => $Silian_remoteIp], 'failed');
            return [
                'success' => false,
                'error' => 'missing-input-response',
                'message' => 'Turnstile token is required'
            ];
        }

        $Silian_postData = [
            'secret' => $this->secretKey,
            'response' => $Silian_token
        ];

        if ($Silian_remoteIp) {
            $Silian_postData['remoteip'] = $Silian_remoteIp;
        }

        try {
            $Silian_ch = curl_init();
            $Silian_curlOptions = [
                CURLOPT_URL => $this->verifyUrl,
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => http_build_query($Silian_postData),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 10,
                CURLOPT_CONNECTTIMEOUT => 5,
                CURLOPT_USERAGENT => 'CarbonTrack/1.0',
                CURLOPT_HTTPHEADER => [
                    'Content-Type: application/x-www-form-urlencoded'
                ],
                CURLOPT_SSL_VERIFYPEER => true,
                CURLOPT_SSL_VERIFYHOST => 2
            ];

            $this->applyCertificateOptions($Silian_curlOptions);
            curl_setopt_array($Silian_ch, $Silian_curlOptions);

            $Silian_response = curl_exec($Silian_ch);
            $Silian_httpCode = curl_getinfo($Silian_ch, CURLINFO_HTTP_CODE);
            $Silian_curlError = curl_error($Silian_ch);
            curl_close($Silian_ch);

            if ($Silian_curlError) {
                $this->logFailure('turnstile_verification_network_failed', new \RuntimeException($Silian_curlError), ['remote_ip' => $Silian_remoteIp], '/internal/turnstile/verify');
                $this->logger->error('Turnstile verification cURL error', [
                    'error' => $Silian_curlError,
                    'token' => substr($Silian_token, 0, 20) . '...',
                    'ip' => $Silian_remoteIp
                ]);

                return [
                    'success' => false,
                    'error' => 'network-error',
                    'message' => 'Failed to connect to Turnstile verification service'
                ];
            }

            if ($Silian_httpCode !== 200) {
                $this->logFailure('turnstile_verification_http_failed', new \RuntimeException('Unexpected HTTP status: ' . $Silian_httpCode), [
                    'http_code' => $Silian_httpCode,
                    'remote_ip' => $Silian_remoteIp,
                ], '/internal/turnstile/verify');
                $this->logger->error('Turnstile verification HTTP error', [
                    'http_code' => $Silian_httpCode,
                    'response' => $Silian_response,
                    'token' => substr($Silian_token, 0, 20) . '...',
                    'ip' => $Silian_remoteIp
                ]);

                return [
                    'success' => false,
                    'error' => 'http-error',
                    'message' => 'Turnstile verification service returned error'
                ];
            }

            $Silian_result = json_decode($Silian_response, true);

            if (json_last_error() !== JSON_ERROR_NONE) {
                $this->logFailure('turnstile_verification_decode_failed', new \RuntimeException(json_last_error_msg()), ['remote_ip' => $Silian_remoteIp], '/internal/turnstile/verify');
                $this->logger->error('Turnstile verification JSON decode error', [
                    'json_error' => json_last_error_msg(),
                    'response' => $Silian_response,
                    'token' => substr($Silian_token, 0, 20) . '...',
                    'ip' => $Silian_remoteIp
                ]);

                return [
                    'success' => false,
                    'error' => 'invalid-response',
                    'message' => 'Invalid response from Turnstile verification service'
                ];
            }

            if ($Silian_result['success']) {
                $this->logAudit('turnstile_verification_succeeded', [
                    'remote_ip' => $Silian_remoteIp,
                    'hostname' => $Silian_result['hostname'] ?? null,
                ]);
                $this->logger->info('Turnstile verification successful', [
                    'token' => substr($Silian_token, 0, 20) . '...',
                    'ip' => $Silian_remoteIp,
                    'challenge_ts' => $Silian_result['challenge_ts'] ?? null,
                    'hostname' => $Silian_result['hostname'] ?? null
                ]);

                return [
                    'success' => true,
                    'challenge_ts' => $Silian_result['challenge_ts'] ?? null,
                    'hostname' => $Silian_result['hostname'] ?? null,
                    'action' => $Silian_result['action'] ?? null,
                    'cdata' => $Silian_result['cdata'] ?? null
                ];
            } else {
                $Silian_errorCodes = $Silian_result['error-codes'] ?? ['unknown-error'];
                $this->logAudit('turnstile_verification_failed', [
                    'remote_ip' => $Silian_remoteIp,
                    'error_codes' => $Silian_errorCodes,
                ], 'failed');
                $this->logger->warning('Turnstile verification failed', [
                    'error_codes' => $Silian_errorCodes,
                    'token' => substr($Silian_token, 0, 20) . '...',
                    'ip' => $Silian_remoteIp
                ]);

                return [
                    'success' => false,
                    'error' => $Silian_errorCodes[0],
                    'error_codes' => $Silian_errorCodes,
                    'message' => $this->getErrorMessage($Silian_errorCodes[0])
                ];
            }

        } catch (\Exception $Silian_e) {
            $this->logFailure('turnstile_verification_exception', $Silian_e, ['remote_ip' => $Silian_remoteIp], '/internal/turnstile/verify');
            $this->logger->error('Turnstile verification exception', [
                'error' => $Silian_e->getMessage(),
                'token' => substr($Silian_token, 0, 20) . '...',
                'ip' => $Silian_remoteIp
            ]);

            return [
                'success' => false,
                'error' => 'internal-error',
                'message' => 'Internal error during Turnstile verification'
            ];
        }
    }

    /**
     * Get human-readable error message for Turnstile error codes
     */
    private function getErrorMessage(string $Silian_errorCode): string
    {
        $Silian_errorMessages = [
            'missing-input-secret' => 'The secret parameter is missing',
            'invalid-input-secret' => 'The secret parameter is invalid or malformed',
            'missing-input-response' => 'The response parameter is missing',
            'invalid-input-response' => 'The response parameter is invalid or malformed',
            'bad-request' => 'The request is invalid or malformed',
            'timeout-or-duplicate' => 'The response is no longer valid: either is too old or has been used previously',
            'internal-error' => 'An internal error happened while validating the response',
            'unknown-error' => 'Unknown error occurred during verification'
        ];

        return $Silian_errorMessages[$Silian_errorCode] ?? 'Unknown error occurred during verification';
    }

    /**
     * Validate that Turnstile is properly configured
     */
    public function isConfigured(): bool
    {
        return !empty($this->secretKey);
    }

    private function logAudit(string $Silian_action, array $Silian_context = [], string $Silian_status = 'success'): void
    {
        if ($this->auditLogService === null) {
            return;
        }

        try {
            $this->auditLogService->log([
                'action' => $Silian_action,
                'operation_category' => 'security',
                'actor_type' => 'system',
                'status' => $Silian_status,
                'data' => $Silian_context,
            ]);
        } catch (\Throwable $Silian_ignore) {
            // ignore audit failures for turnstile service
        }
    }

    private function logFailure(string $Silian_action, \Throwable $Silian_e, array $Silian_context, string $Silian_path): void
    {
        $this->logAudit($Silian_action, $Silian_context, 'failed');

        if ($this->errorLogService === null) {
            return;
        }

        try {
            $Silian_request = SyntheticRequestFactory::fromContext($Silian_path, 'POST', null, [], $Silian_context);
            $this->errorLogService->logException($Silian_e, $Silian_request, ['context_message' => $Silian_action] + $Silian_context);
        } catch (\Throwable $Silian_ignore) {
            // ignore error log failures for turnstile service
        }
    }

    /**
     * @param array<int|string, mixed> $curlOptions
     */
    private function applyCertificateOptions(array &$Silian_curlOptions): void
    {
        if ($this->caBundlePath !== null) {
            $Silian_curlOptions[CURLOPT_CAINFO] = $this->caBundlePath;
        }

        if (
            $this->useNativeCaStore
            && \defined('CURLOPT_SSL_OPTIONS')
            && \defined('CURLSSLOPT_NATIVE_CA')
        ) {
            $Silian_existingSslOptions = $Silian_curlOptions[CURLOPT_SSL_OPTIONS] ?? 0;
            $Silian_curlOptions[CURLOPT_SSL_OPTIONS] = $Silian_existingSslOptions | CURLSSLOPT_NATIVE_CA;
        }
    }
}

