<?php

declare(strict_types=1);

namespace CarbonTrack\Middleware;

use Psr\Http\Message\ResponseInterface;
use Psr\Http\Message\ServerRequestInterface;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface;
use CarbonTrack\Services\DatabaseService;
use CarbonTrack\Models\IdempotencyRecord;
use Slim\Psr7\Response;
use Monolog\Logger;

class IdempotencyMiddleware implements MiddlewareInterface
{
    private DatabaseService $db;
    private Logger $logger;
    private array $idempotentMethods = ['POST', 'PUT', 'PATCH'];
    private array $sensitiveRoutes = [
        '/api/v1/auth/register',
        '/api/v1/carbon-track/record',
        '/api/v1/exchange',
        // Only require idempotency for broadcast/send endpoints and admin message actions
        '/api/v1/messages/broadcast',
        '/api/v1/admin/messages'
    ];

    public function __construct(DatabaseService $Silian_db, Logger $Silian_logger)
    {
        $this->db = $Silian_db;
        $this->logger = $Silian_logger;
    }

    public function process(ServerRequestInterface $Silian_request, RequestHandlerInterface $Silian_handler): ResponseInterface
    {
        $Silian_method = $Silian_request->getMethod();
        $Silian_uri = $Silian_request->getUri()->getPath();
        // Only apply idempotency to specific methods and routes
        if (!in_array($Silian_method, $this->idempotentMethods) || !$this->isSensitiveRoute($Silian_uri)) {
            return $Silian_handler->handle($Silian_request);
        }

        $Silian_response = null;
        $Silian_idempotencyKey = $Silian_request->getHeaderLine('X-Request-ID');

        // Validate header presence and format; build error response if invalid
        if (empty($Silian_idempotencyKey)) {
            $Silian_response = $this->badRequestResponse('X-Request-ID header is required for this operation');
        } elseif (!$this->isValidUuid($Silian_idempotencyKey)) {
            $Silian_response = $this->badRequestResponse('X-Request-ID must be a valid UUID');
        } else {
            try {
                // Check if this request has been processed before
                $Silian_existingRecord = IdempotencyRecord::where('idempotency_key', $Silian_idempotencyKey)
                    ->where('created_at', '>', date('Y-m-d H:i:s', strtotime('-24 hours'))) // Only check last 24 hours
                    ->first();

                if ($Silian_existingRecord) {
                    $this->logger->info('Idempotent request detected', [
                        'idempotency_key' => $Silian_idempotencyKey,
                        'original_status' => $Silian_existingRecord->response_status,
                        'uri' => $Silian_uri
                    ]);

                    $Silian_resp = new Response();
                    $Silian_resp->getBody()->write($Silian_existingRecord->response_body);
                    $Silian_response = $Silian_resp
                        ->withStatus($Silian_existingRecord->response_status)
                        ->withHeader('Content-Type', 'application/json')
                        ->withHeader('X-Idempotent-Replay', 'true');
                } else {
                    // Process the request and store result for future replays
                    $Silian_response = $Silian_handler->handle($Silian_request);
                    $this->storeIdempotencyRecord($Silian_idempotencyKey, $Silian_request, $Silian_response);
                }
            } catch (\Throwable $Silian_e) {
                $this->logger->error('Idempotency middleware error', [
                    'error' => $Silian_e->getMessage(),
                    'idempotency_key' => $Silian_idempotencyKey,
                    'uri' => $Silian_uri
                ]);

                // Continue with normal processing if idempotency check fails
                $Silian_response = $Silian_handler->handle($Silian_request);
            }
        }

        return $Silian_response;
    }

    private function isSensitiveRoute(string $Silian_uri): bool
    {
        foreach ($this->sensitiveRoutes as $Silian_route) {
            if (str_starts_with($Silian_uri, $Silian_route)) {
                return true;
            }
        }
        return false;
    }

    private function isValidUuid(string $Silian_uuid): bool
    {
        return preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i', $Silian_uuid) === 1;
    }

    private function storeIdempotencyRecord(string $Silian_idempotencyKey, ServerRequestInterface $Silian_request, ResponseInterface $Silian_response): void
    {
    try {
            $Silian_userId = $Silian_request->getAttribute('user_id');
            $Silian_responseBody = (string) $Silian_response->getBody();

            // Reset body stream position for subsequent reads
            $Silian_response->getBody()->rewind();

            IdempotencyRecord::create([
                'idempotency_key' => $Silian_idempotencyKey,
                'user_id' => $Silian_userId,
                'request_method' => $Silian_request->getMethod(),
                'request_uri' => $Silian_request->getUri()->getPath(),
                'request_body' => json_encode($Silian_request->getParsedBody()),
                'response_status' => $Silian_response->getStatusCode(),
                'response_body' => $Silian_responseBody,
                'ip_address' => $this->getClientIp($Silian_request),
                'user_agent' => $Silian_request->getHeaderLine('User-Agent')
            ]);

    } catch (\Throwable $Silian_e) {
            $this->logger->error('Failed to store idempotency record', [
                'error' => $Silian_e->getMessage(),
                'idempotency_key' => $Silian_idempotencyKey
            ]);
        }
    }

    private function badRequestResponse(string $Silian_message): ResponseInterface
    {
        $Silian_response = new Response();
        $Silian_response->getBody()->write(json_encode([
            'success' => false,
            'message' => $Silian_message,
            'code' => 'BAD_REQUEST'
        ]));

        return $Silian_response
            ->withStatus(400)
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

