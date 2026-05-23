<?php

declare(strict_types=1);

namespace CarbonTrack\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Psr\Http\Message\ServerRequestInterface as Request;
use CarbonTrack\Services\SystemLogService;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Support\Uuid;
use Monolog\Logger;

class RequestLoggingMiddleware implements MiddlewareInterface
{
    private SystemLogService $systemLogService;
    private AuthService $authService;
    private Logger $logger;

    private const EXCLUDE_PATHS = [
        '/',
        '/api/v1',
        '/api/v1/health',
    ];

    public function __construct(SystemLogService $Silian_systemLogService, AuthService $Silian_authService, Logger $Silian_logger)
    {
        $this->systemLogService = $Silian_systemLogService;
        $this->authService = $Silian_authService;
        $this->logger = $Silian_logger;
    }

    public function process(Request $Silian_request, RequestHandler $Silian_handler): Response
    {
        $Silian_start = microtime(true);
        $Silian_requestId = $this->resolveRequestId($Silian_request->getHeaderLine('X-Request-ID'));
        $Silian_request = $Silian_request
            ->withHeader('X-Request-ID', $Silian_requestId)
            ->withAttribute('request_id', $Silian_requestId);
        // Allow legacy listeners that rely on $_SERVER to access the request id
        $_SERVER['HTTP_X_REQUEST_ID'] = $Silian_requestId;

        $Silian_path = $Silian_request->getUri()->getPath();
        $Silian_method = $Silian_request->getMethod();
        $Silian_skip = $this->shouldSkip($Silian_path);

        $Silian_userId = null;
        $Silian_userUuid = null;
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if ($Silian_user) {
                $Silian_userId = $Silian_user['id'] ?? null;
                $Silian_userUuid = $Silian_user['uuid'] ?? null;
            }
        } catch (\Throwable $Silian_e) {
            // ignore auth errors for logging middleware
        }

        $Silian_parsedBody = null;
        if (!$Silian_skip) {
            try { $Silian_parsedBody = $Silian_request->getParsedBody(); } catch (\Throwable $Silian_e) { $Silian_parsedBody = null; }
        }

        $Silian_response = $Silian_handler->handle($Silian_request);

        if (!$Silian_skip) {
            $Silian_serverParams = $this->snapshotServerParams($Silian_request);
            $Silian_ipAddress = $this->resolveClientIp($Silian_serverParams);

            $Silian_duration = (microtime(true) - $Silian_start) * 1000.0;
            $Silian_respBody = null;
            try {
                // clone body stream contents cautiously (may be non-seekable)
                $Silian_stream = $Silian_response->getBody();
                if ($Silian_stream->isSeekable()) {
                    $Silian_pos = $Silian_stream->tell();
                    $Silian_stream->rewind();
                    $Silian_respBody = $Silian_stream->getContents();
                    $Silian_stream->seek($Silian_pos);
                }
            } catch (\Throwable $Silian_e) { $Silian_respBody = null; }

            $this->systemLogService->log([
                'request_id' => $Silian_requestId,
                'method' => $Silian_method,
                'path' => $Silian_path,
                'status_code' => $Silian_response->getStatusCode(),
                'user_id' => $Silian_userId,
                'user_uuid' => $Silian_userUuid,
                'ip_address' => $Silian_ipAddress,
                'user_agent' => $Silian_request->getHeaderLine('User-Agent'),
                'duration_ms' => round($Silian_duration, 2),
                'request_body' => $Silian_parsedBody,
                'response_body' => $this->decodeIfJson($Silian_respBody),
                'server_params' => $Silian_serverParams,
            ]);
        }

        return $Silian_response->withHeader('X-Request-ID', $Silian_requestId);
    }

    private function resolveRequestId(?string $Silian_incoming): string
    {
        $Silian_incoming = trim((string) $Silian_incoming);

        if ($Silian_incoming !== '' && Uuid::isValid($Silian_incoming)) {
            return strtolower($Silian_incoming);
        }

        return Uuid::generateV4();
    }

    private function shouldSkip(string $Silian_path): bool
    {
        foreach (self::EXCLUDE_PATHS as $Silian_skip) {
            if ($Silian_path === $Silian_skip) return true;
        }
        // skip system log endpoints themselves to prevent recursion once added
        if (strpos($Silian_path, '/api/v1/admin/system-logs') === 0) return true;
        return false;
    }

    private function decodeIfJson(?string $Silian_body)
    {
        if ($Silian_body === null) return null;
        $Silian_trim = trim($Silian_body);
        if ($Silian_trim === '') return null;
        if (($Silian_trim[0] === '{' && substr($Silian_trim, -1) === '}') || ($Silian_trim[0] === '[' && substr($Silian_trim, -1) === ']')) {
            $Silian_decoded = json_decode($Silian_trim, true);
            if (json_last_error() === JSON_ERROR_NONE) return $Silian_decoded;
        }
        return $Silian_trim;
    }

    /**
     * Merge PSR-7 server params with the global $_SERVER snapshot for richer metadata.
     */
    private function snapshotServerParams(Request $Silian_request): array
    {
        $Silian_psrServer = $Silian_request->getServerParams();
        if (!is_array($Silian_psrServer)) {
            $Silian_psrServer = [];
        }
        $Silian_globals = $_SERVER ?? [];
        return array_replace($Silian_globals, $Silian_psrServer);
    }

    /**
     * Resolve client IP preferring Cloudflare's connecting IP headers when present.
     */
    private function resolveClientIp(array $Silian_serverParams): ?string
    {
        $Silian_candidates = [
            $Silian_serverParams['HTTP_CF_CONNNECTING_IP'] ?? null, // handle potential typo key
            $Silian_serverParams['HTTP_CF_CONNECTING_IP'] ?? null,
            $Silian_serverParams['CF_CONNECTING_IP'] ?? null,
            $_SERVER['HTTP_CF_CONNNECTING_IP'] ?? null,
            $_SERVER['HTTP_CF_CONNECTING_IP'] ?? null,
            $_SERVER['CF_CONNECTING_IP'] ?? null,
            $Silian_serverParams['REMOTE_ADDR'] ?? null,
            $_SERVER['REMOTE_ADDR'] ?? null,
        ];

        foreach ($Silian_candidates as $Silian_raw) {
            if (!is_string($Silian_raw)) {
                continue;
            }
            $Silian_value = trim($Silian_raw);
            if ($Silian_value === '') {
                continue;
            }
            $Silian_first = trim(explode(',', $Silian_value)[0]);
            if ($Silian_first === '') {
                continue;
            }
            if (filter_var($Silian_first, FILTER_VALIDATE_IP)) {
                return $Silian_first;
            }
        }
        return null;
    }
}
