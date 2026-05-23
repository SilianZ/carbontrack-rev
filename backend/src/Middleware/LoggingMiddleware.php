<?php

declare(strict_types=1);

namespace CarbonTrack\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use Psr\Log\LoggerInterface;
use CarbonTrack\Services\ErrorLogService;

class LoggingMiddleware implements MiddlewareInterface
{
    private LoggerInterface $logger;
    private ?ErrorLogService $errorLogService;

    public function __construct(LoggerInterface $Silian_logger, ?ErrorLogService $Silian_errorLogService = null)
    {
        $this->logger = $Silian_logger;
        $this->errorLogService = $Silian_errorLogService;
    }

    public function process(Request $Silian_request, RequestHandler $Silian_handler): Response
    {
        $Silian_start = microtime(true);

        // Log request with error handling
        try {
            $this->logger->info('Request received', [
                'method' => $Silian_request->getMethod(),
                'uri' => (string) $Silian_request->getUri(),
                'ip' => $this->getClientIp($Silian_request),
                'user_agent' => $Silian_request->getHeaderLine('User-Agent')
            ]);
        } catch (\Exception $Silian_e) {
            // 如果日志记录失败，不要中断请求处理
            $this->logExceptionWithFallback($Silian_e, $Silian_request, 'LoggingMiddleware request logging failed: ' . $Silian_e->getMessage());
        }

        try {
            $Silian_response = $Silian_handler->handle($Silian_request);

            $Silian_duration = microtime(true) - $Silian_start;

            // Log response with error handling
            try {
                $this->logger->info('Request completed', [
                    'method' => $Silian_request->getMethod(),
                    'uri' => (string) $Silian_request->getUri(),
                    'status' => $Silian_response->getStatusCode(),
                    'duration' => round($Silian_duration * 1000, 2) . 'ms'
                ]);
            } catch (\Exception $Silian_e) {
                // 如果日志记录失败，不要中断响应
                $this->logExceptionWithFallback($Silian_e, $Silian_request, 'LoggingMiddleware request logging failed: ' . $Silian_e->getMessage());
            }

            return $Silian_response;

        } catch (\Exception $Silian_e) {
            $Silian_duration = microtime(true) - $Silian_start;

            // Log error with error handling
            try {
                $this->logger->error('Request failed', [
                    'method' => $Silian_request->getMethod(),
                    'uri' => (string) $Silian_request->getUri(),
                    'error' => $Silian_e->getMessage(),
                    'duration' => round($Silian_duration * 1000, 2) . 'ms'
                ]);
            } catch (\Exception $Silian_logError) {
                // 如果日志记录失败，至少记录到error_log
                $this->logExceptionWithFallback($Silian_logError, $Silian_request, 'LoggingMiddleware error logging failed: ' . $Silian_logError->getMessage() . ' | Original error: ' . $Silian_e->getMessage());
            }

            throw $Silian_e;
        }
    }

    private function getClientIp(Request $Silian_request): string
    {
        $Silian_serverParams = $Silian_request->getServerParams();

        if (!empty($Silian_serverParams['HTTP_CF_CONNECTING_IP'])) {
            return $Silian_serverParams['HTTP_CF_CONNECTING_IP'];
        }

        if (!empty($Silian_serverParams['HTTP_X_FORWARDED_FOR'])) {
            return explode(',', $Silian_serverParams['HTTP_X_FORWARDED_FOR'])[0];
        }

        if (!empty($Silian_serverParams['HTTP_X_REAL_IP'])) {
            return $Silian_serverParams['HTTP_X_REAL_IP'];
        }

        return $Silian_serverParams['REMOTE_ADDR'] ?? 'unknown';
    }


    private function logExceptionWithFallback(\Throwable $Silian_exception, Request $Silian_request, string $Silian_contextMessage): void
    {
        if ($this->errorLogService) {
            try {
                $this->errorLogService->logException($Silian_exception, $Silian_request, ['context_message' => $Silian_contextMessage]);
                return;
            } catch (\Throwable $Silian_loggingError) {
                error_log('ErrorLogService logging failed: ' . $Silian_loggingError->getMessage());
            }
        }
        error_log($Silian_contextMessage);
    }

}
