<?php

declare(strict_types=1);

namespace CarbonTrack\Controllers;

use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\PasskeyOperationException;
use CarbonTrack\Services\PasskeyService;
use Monolog\Logger;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class PasskeyController
{
    public function __construct(
        private AuthService $authService,
        private PasskeyService $passkeyService,
        private Logger $logger,
        private ?ErrorLogService $errorLogService = null
    ) {
    }

    public function list(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Unauthorized',
                    'code' => 'UNAUTHORIZED',
                ], 401);
            }

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => [
                    'passkeys' => $this->passkeyService->listForUser($Silian_user),
                ],
            ]);
        } catch (PasskeyOperationException $Silian_exception) {
            $this->logException($Silian_exception, $Silian_request, 'Passkey list operation failed');
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => $Silian_exception->getMessage(),
                'code' => $Silian_exception->getErrorCode(),
            ], $Silian_exception->getHttpStatus());
        } catch (\Throwable $Silian_exception) {
            $this->logException($Silian_exception, $Silian_request, 'Failed to list passkeys');
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to list passkeys',
                'code' => 'PASSKEY_LIST_FAILED',
            ], 500);
        }
    }

    public function beginRegistration(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Unauthorized',
                    'code' => 'UNAUTHORIZED',
                ], 401);
            }

            $Silian_body = $Silian_request->getParsedBody();
            $Silian_payload = is_array($Silian_body) ? $Silian_body : [];

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => $this->passkeyService->beginRegistration($Silian_user, $Silian_payload),
            ]);
        } catch (PasskeyOperationException $Silian_exception) {
            $this->logException($Silian_exception, $Silian_request, 'Passkey registration options operation failed');
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => $Silian_exception->getMessage(),
                'code' => $Silian_exception->getErrorCode(),
            ], $Silian_exception->getHttpStatus());
        } catch (\Throwable $Silian_exception) {
            $this->logException($Silian_exception, $Silian_request, 'Failed to create passkey registration options');
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to create passkey registration options',
                'code' => 'PASSKEY_REGISTRATION_OPTIONS_FAILED',
            ], 500);
        }
    }

    public function completeRegistration(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Unauthorized',
                    'code' => 'UNAUTHORIZED',
                ], 401);
            }

            $Silian_body = $Silian_request->getParsedBody();
            $Silian_payload = is_array($Silian_body) ? $Silian_body : [];

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => [
                    'passkey' => $this->passkeyService->completeRegistration($Silian_user, $Silian_payload),
                ],
            ], 201);
        } catch (PasskeyOperationException $Silian_exception) {
            $this->logException($Silian_exception, $Silian_request, 'Passkey registration verification operation failed');
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => $Silian_exception->getMessage(),
                'code' => $Silian_exception->getErrorCode(),
            ], $Silian_exception->getHttpStatus());
        } catch (\Throwable $Silian_exception) {
            $this->logException($Silian_exception, $Silian_request, 'Failed to complete passkey registration');
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to complete passkey registration',
                'code' => 'PASSKEY_REGISTRATION_FAILED',
            ], 500);
        }
    }

    public function beginAuthentication(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_body = $Silian_request->getParsedBody();
            $Silian_payload = is_array($Silian_body) ? $Silian_body : [];

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => $this->passkeyService->beginAuthentication($Silian_payload),
            ]);
        } catch (PasskeyOperationException $Silian_exception) {
            $this->logException($Silian_exception, $Silian_request, 'Passkey authentication options operation failed');
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => $Silian_exception->getMessage(),
                'code' => $Silian_exception->getErrorCode(),
            ], $Silian_exception->getHttpStatus());
        } catch (\Throwable $Silian_exception) {
            $this->logException($Silian_exception, $Silian_request, 'Failed to create passkey authentication options');
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to create passkey authentication options',
                'code' => 'PASSKEY_AUTHENTICATION_OPTIONS_FAILED',
            ], 500);
        }
    }

    public function completeAuthentication(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_body = $Silian_request->getParsedBody();
            $Silian_payload = is_array($Silian_body) ? $Silian_body : [];
            $Silian_result = $this->passkeyService->completeAuthentication($Silian_payload);

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'message' => 'Login successful',
                'data' => [
                    'token' => $this->authService->generateToken($Silian_result['user']),
                    'user' => $Silian_result['user'],
                    'passkey' => $Silian_result['passkey'],
                ],
            ]);
        } catch (PasskeyOperationException $Silian_exception) {
            $this->logException($Silian_exception, $Silian_request, 'Passkey authentication verification operation failed');
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => $Silian_exception->getMessage(),
                'code' => $Silian_exception->getErrorCode(),
            ], $Silian_exception->getHttpStatus());
        } catch (\Throwable $Silian_exception) {
            $this->logException($Silian_exception, $Silian_request, 'Failed to complete passkey authentication');
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to complete passkey authentication',
                'code' => 'PASSKEY_AUTHENTICATION_FAILED',
            ], 500);
        }
    }

    public function delete(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Unauthorized',
                    'code' => 'UNAUTHORIZED',
                ], 401);
            }

            $Silian_passkeyId = isset($Silian_args['id']) ? (int) $Silian_args['id'] : 0;
            if ($Silian_passkeyId <= 0) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Invalid passkey id',
                    'code' => 'INVALID_PASSKEY_ID',
                ], 400);
            }

            $this->passkeyService->deleteForUser($Silian_user, $Silian_passkeyId);

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'message' => 'Passkey deleted successfully',
            ]);
        } catch (PasskeyOperationException $Silian_exception) {
            $this->logException($Silian_exception, $Silian_request, 'Passkey delete operation failed');
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => $Silian_exception->getMessage(),
                'code' => $Silian_exception->getErrorCode(),
            ], $Silian_exception->getHttpStatus());
        } catch (\Throwable $Silian_exception) {
            $this->logException($Silian_exception, $Silian_request, 'Failed to delete passkey');
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to delete passkey',
                'code' => 'PASSKEY_DELETE_FAILED',
            ], 500);
        }
    }

    public function update(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Unauthorized',
                    'code' => 'UNAUTHORIZED',
                ], 401);
            }

            $Silian_passkeyId = isset($Silian_args['id']) ? (int) $Silian_args['id'] : 0;
            if ($Silian_passkeyId <= 0) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Invalid passkey id',
                    'code' => 'INVALID_PASSKEY_ID',
                ], 400);
            }

            $Silian_body = $Silian_request->getParsedBody();
            $Silian_payload = is_array($Silian_body) ? $Silian_body : [];
            $Silian_passkey = $this->passkeyService->updateLabelForUser(
                $Silian_user,
                $Silian_passkeyId,
                isset($Silian_payload['label']) ? (string) $Silian_payload['label'] : null
            );

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => [
                    'passkey' => $Silian_passkey,
                ],
            ]);
        } catch (PasskeyOperationException $Silian_exception) {
            $this->logException($Silian_exception, $Silian_request, 'Passkey update operation failed');
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => $Silian_exception->getMessage(),
                'code' => $Silian_exception->getErrorCode(),
            ], $Silian_exception->getHttpStatus());
        } catch (\Throwable $Silian_exception) {
            $this->logException($Silian_exception, $Silian_request, 'Failed to update passkey');
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to update passkey',
                'code' => 'PASSKEY_UPDATE_FAILED',
            ], 500);
        }
    }

    public function adminList(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Access denied',
                    'code' => 'ACCESS_DENIED',
                ], 403);
            }

            $Silian_payload = $this->passkeyService->listForAdmin((int) $Silian_user['id'], $Silian_request->getQueryParams());

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => $Silian_payload,
            ]);
        } catch (\Throwable $Silian_exception) {
            $this->logException($Silian_exception, $Silian_request, 'Failed to list admin passkeys');
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to list admin passkeys',
                'code' => 'ADMIN_PASSKEY_LIST_FAILED',
            ], 500);
        }
    }

    public function adminStats(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->jsonResponse($Silian_response, [
                    'success' => false,
                    'message' => 'Access denied',
                    'code' => 'ACCESS_DENIED',
                ], 403);
            }

            $Silian_stats = $this->passkeyService->getAdminStats((int) $Silian_user['id']);

            return $this->jsonResponse($Silian_response, [
                'success' => true,
                'data' => $Silian_stats,
            ]);
        } catch (\Throwable $Silian_exception) {
            $this->logException($Silian_exception, $Silian_request, 'Failed to fetch admin passkey stats');
            return $this->jsonResponse($Silian_response, [
                'success' => false,
                'message' => 'Failed to fetch admin passkey stats',
                'code' => 'ADMIN_PASSKEY_STATS_FAILED',
            ], 500);
        }
    }

    private function logException(\Throwable $Silian_exception, Request $Silian_request, string $Silian_message): void
    {
        $this->logger->error($Silian_message, [
            'error' => $Silian_exception->getMessage(),
            'exception' => get_class($Silian_exception),
        ]);

        try {
            if ($this->errorLogService !== null) {
                $this->errorLogService->logException($Silian_exception, $Silian_request);
            }
        } catch (\Throwable $Silian_ignored) {
            $this->logger->error('PasskeyController failed to persist error log', [
                'error' => $Silian_ignored->getMessage(),
            ]);
        }
    }

    private function jsonResponse(Response $Silian_response, array $Silian_data, int $Silian_status = 200): Response
    {
        $Silian_response->getBody()->write(json_encode($Silian_data, JSON_UNESCAPED_UNICODE));
        return $Silian_response->withHeader('Content-Type', 'application/json')->withStatus($Silian_status);
    }
}
