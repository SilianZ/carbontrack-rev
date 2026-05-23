<?php

declare(strict_types=1);

namespace CarbonTrack\Middleware;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use CarbonTrack\Services\TurnstileService;
use CarbonTrack\Services\AuditLogService;
use Slim\Psr7\Response;

class TurnstileMiddleware implements MiddlewareInterface
{
    private TurnstileService $turnstileService;
    private AuditLogService $auditLogService;
    private array $protectedRoutes = [
        '/api/v1/auth/register',
        '/api/v1/auth/login',
        '/api/v1/carbon-track/record',
        '/api/v1/exchange'
    ];

    public function __construct(TurnstileService $Silian_turnstileService, AuditLogService $Silian_auditLogService)
    {
        $this->turnstileService = $Silian_turnstileService;
        $this->auditLogService = $Silian_auditLogService;
    }

    public function process(ServerRequestInterface $Silian_request, RequestHandlerInterface $Silian_handler): ResponseInterface
    {
        $Silian_uri = $Silian_request->getUri()->getPath();
        $Silian_method = $Silian_request->getMethod();

        // Only apply Turnstile verification to protected routes and POST/PUT methods
        if (!$this->isProtectedRoute($Silian_uri) || !in_array($Silian_method, ['POST', 'PUT'])) {
            return $Silian_handler->handle($Silian_request);
        }

        // Skip verification in development/testing environment
        if (($_ENV['APP_ENV'] ?? 'production') === 'testing') {
            return $Silian_handler->handle($Silian_request);
        }

        $Silian_parsedBody = $Silian_request->getParsedBody();
        $Silian_turnstileToken = null;

        // Extract Turnstile token from request body or headers
        if (is_array($Silian_parsedBody) && isset($Silian_parsedBody['cf_turnstile_response'])) {
            $Silian_turnstileToken = $Silian_parsedBody['cf_turnstile_response'];
        } elseif ($Silian_request->hasHeader('X-Turnstile-Token')) {
            $Silian_turnstileToken = $Silian_request->getHeaderLine('X-Turnstile-Token');
        }

        if (empty($Silian_turnstileToken)) {
            $this->logTurnstileFailure($Silian_request, 'missing-token', 'Turnstile token is missing');
            return $this->forbiddenResponse('Turnstile verification is required for this operation');
        }

        // Verify Turnstile token
        $Silian_clientIp = $this->getClientIp($Silian_request);
        $Silian_verificationResult = $this->turnstileService->verify($Silian_turnstileToken, $Silian_clientIp);

        if (!$Silian_verificationResult['success']) {
            $this->logTurnstileFailure($Silian_request, $Silian_verificationResult['error'], $Silian_verificationResult['message']);
            return $this->forbiddenResponse('Turnstile verification failed: ' . $Silian_verificationResult['message']);
        }

        // Log successful verification
        $this->auditLogService->log([
            'user_id' => $Silian_request->getAttribute('user_id'),
            'action' => 'turnstile_verification_success',
            'entity_type' => 'security',
            'ip_address' => $Silian_clientIp,
            'user_agent' => $Silian_request->getHeaderLine('User-Agent'),
            'notes' => 'Turnstile verification successful for ' . $Silian_uri,
            'new_value' => json_encode([
                'hostname' => $Silian_verificationResult['hostname'] ?? null,
                'action' => $Silian_verificationResult['action'] ?? null,
                'challenge_ts' => $Silian_verificationResult['challenge_ts'] ?? null
            ])
        ]);

        // Add verification result to request attributes for potential use in controllers
        $Silian_request = $Silian_request->withAttribute('turnstile_verified', true)
                          ->withAttribute('turnstile_result', $Silian_verificationResult);

        return $Silian_handler->handle($Silian_request);
    }

    private function isProtectedRoute(string $Silian_uri): bool
    {
        foreach ($this->protectedRoutes as $Silian_route) {
            if (str_starts_with($Silian_uri, $Silian_route)) {
                return true;
            }
        }
        return false;
    }

    private function logTurnstileFailure(ServerRequestInterface $Silian_request, string $Silian_error, string $Silian_message): void
    {
        $this->auditLogService->log([
            'user_id' => $Silian_request->getAttribute('user_id'),
            'action' => 'turnstile_verification_failure',
            'entity_type' => 'security',
            'ip_address' => $this->getClientIp($Silian_request),
            'user_agent' => $Silian_request->getHeaderLine('User-Agent'),
            'notes' => 'Turnstile verification failed for ' . $Silian_request->getUri()->getPath(),
            'new_value' => json_encode([
                'error' => $Silian_error,
                'message' => $Silian_message
            ])
        ]);
    }

    private function forbiddenResponse(string $Silian_message): ResponseInterface
    {
        $Silian_response = new Response();
        $Silian_response->getBody()->write(json_encode([
            'success' => false,
            'message' => $Silian_message,
            'code' => 'TURNSTILE_VERIFICATION_FAILED'
        ]));

        return $Silian_response
            ->withStatus(403)
            ->withHeader('Content-Type', 'application/json');
    }

    private function getClientIp(ServerRequestInterface $Silian_request): string
    {
        $Silian_serverParams = $Silian_request->getServerParams();

        $Silian_headers = [
            'HTTP_CF_CONNECTING_IP',
            'HTTP_X_FORWARDED_FOR',
            'HTTP_X_REAL_IP',
            'HTTP_CLIENT_IP',
            'REMOTE_ADDR'
        ];

        foreach ($Silian_headers as $Silian_header) {
            if (!empty($Silian_serverParams[$Silian_header])) {
                $Silian_ip = $Silian_serverParams[$Silian_header];
                if (strpos($Silian_ip, ',') !== false) {
                    $Silian_ip = trim(explode(',', $Silian_ip)[0]);
                }
                if (filter_var($Silian_ip, FILTER_VALIDATE_IP, FILTER_FLAG_NO_PRIV_RANGE | FILTER_FLAG_NO_RES_RANGE)) {
                    return $Silian_ip;
                }
            }
        }

        return $Silian_serverParams['REMOTE_ADDR'] ?? 'unknown';
    }
}

