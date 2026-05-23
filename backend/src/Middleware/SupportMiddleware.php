<?php

declare(strict_types=1);

namespace CarbonTrack\Middleware;

use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\ErrorLogService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Psr\Log\LoggerInterface;

class SupportMiddleware implements MiddlewareInterface
{
    public function __construct(
        private AuthService $authService,
        private LoggerInterface $logger,
        private ?ErrorLogService $errorLogService = null
    ) {
    }

    public function process(Request $Silian_request, RequestHandler $Silian_handler): Response
    {
        try {
            $Silian_user = $Silian_request->getAttribute('authenticated_user');
            if (!is_array($Silian_user)) {
                $Silian_user = $this->authService->getCurrentUser($Silian_request);
            }

            if (!$Silian_user) {
                return $this->jsonError($Silian_request, 401, 'Authentication required', 'AUTH_REQUIRED');
            }

            if (!$this->authService->isSupportUser($Silian_user)) {
                return $this->jsonError($Silian_request, 403, 'Support access required', 'SUPPORT_REQUIRED');
            }

            return $Silian_handler->handle($Silian_request->withAttribute('user', $Silian_user));
        } catch (\Throwable $Silian_e) {
            $this->logExceptionWithFallback($Silian_e, $Silian_request, 'SupportMiddleware error: ' . $Silian_e->getMessage());
            return $this->jsonError($Silian_request, 500, 'Internal server error', 'INTERNAL_ERROR');
        }
    }

    private function jsonError(Request $Silian_request, int $Silian_status, string $Silian_message, string $Silian_code): Response
    {
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_payload = [
            'success' => false,
            'message' => $Silian_message,
            'error' => $Silian_message,
            'code' => $Silian_code,
        ];

        $Silian_requestId = $this->resolveRequestId($Silian_request);
        if (is_string($Silian_requestId) && $Silian_requestId !== '') {
            $Silian_payload['request_id'] = $Silian_requestId;
        }

        $Silian_json = json_encode($Silian_payload);
        if ($Silian_json === false) {
            $Silian_fallbackPayload = [
                'success' => false,
                'message' => 'Internal server error',
                'error' => 'Internal server error',
                'code' => 'JSON_ENCODE_ERROR',
            ];
            if (isset($Silian_payload['request_id'])) {
                $Silian_fallbackPayload['request_id'] = $Silian_payload['request_id'];
            }
            $Silian_json = json_encode($Silian_fallbackPayload);
            if ($Silian_json === false) {
                $Silian_json = '{"success":false,"message":"Internal server error","error":"Internal server error","code":"JSON_ENCODE_ERROR"}';
            }
        }

        $Silian_response->getBody()->write($Silian_json);

        return $Silian_response->withStatus($Silian_status)->withHeader('Content-Type', 'application/json');
    }

    private function logExceptionWithFallback(\Throwable $Silian_exception, Request $Silian_request, string $Silian_contextMessage): void
    {
        if ($this->errorLogService) {
            try {
                $this->errorLogService->logException($Silian_exception, $Silian_request, ['context_message' => $Silian_contextMessage]);
                return;
            } catch (\Throwable $Silian_loggingError) {
                $this->logWithFallback('error', 'ErrorLogService logging failed for support middleware', [
                    'context_message' => $Silian_contextMessage,
                    'request_id' => $this->resolveRequestId($Silian_request),
                    'path' => (string) $Silian_request->getUri()->getPath(),
                    'method' => $Silian_request->getMethod(),
                    'exception_type' => get_class($Silian_exception),
                    'logging_exception_type' => get_class($Silian_loggingError),
                    'logging_error_message' => $Silian_loggingError->getMessage(),
                ]);
            }
        }

        $this->logWithFallback('warning', $Silian_contextMessage, [
            'request_id' => $this->resolveRequestId($Silian_request),
            'path' => (string) $Silian_request->getUri()->getPath(),
            'method' => $Silian_request->getMethod(),
            'exception_type' => get_class($Silian_exception),
            'exception_message' => $Silian_exception->getMessage(),
        ]);
    }

    private function resolveRequestId(Request $Silian_request): ?string
    {
        $Silian_attribute = $Silian_request->getAttribute('request_id');
        if (is_string($Silian_attribute) && trim($Silian_attribute) !== '') {
            return trim($Silian_attribute);
        }

        $Silian_header = trim($Silian_request->getHeaderLine('X-Request-ID'));
        if ($Silian_header !== '') {
            return $Silian_header;
        }

        return null;
    }

    /**
     * @param array<string,mixed> $context
     */
    private function logWithFallback(string $Silian_level, string $Silian_message, array $Silian_context): void
    {
        try {
            if ($Silian_level === 'error') {
                $this->logger->error($Silian_message, $Silian_context);
                return;
            }

            $this->logger->warning($Silian_message, $Silian_context);
        } catch (\Throwable) {
            // Swallow logger failures to preserve the original 500 response path.
        }
    }
}
