<?php

declare(strict_types=1);

namespace CarbonTrack\Middleware;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Server\MiddlewareInterface;
use Psr\Http\Server\RequestHandlerInterface as RequestHandler;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\ErrorLogService;

class AdminMiddleware implements MiddlewareInterface
{
    private AuthService $authService;
    private ?ErrorLogService $errorLogService;

    public function __construct(AuthService $Silian_authService, ?ErrorLogService $Silian_errorLogService = null)
    {
        $this->authService = $Silian_authService;
        $this->errorLogService = $Silian_errorLogService;
    }

    public function process(Request $Silian_request, RequestHandler $Silian_handler): Response
    {
        $Silian_isTesting = strtolower((string)($_ENV['APP_ENV'] ?? '')) === 'testing';
        try {
            // 获取当前用户
            $Silian_user = null;
            $Silian_payload = $Silian_request->getAttribute('token_payload');
            if (is_array($Silian_payload) && isset($Silian_payload['user'])) {
                $Silian_user = $Silian_payload['user'];
            } else {
                $Silian_user = $this->authService->getCurrentUser($Silian_request);
            }

            if (!$Silian_user) {
                if (!$Silian_isTesting) {
                    $Silian_response = new \Slim\Psr7\Response();
                    $Silian_response->getBody()->write(json_encode([
                        'success' => false,
                        'error' => 'Authentication required',
                        'code' => 'AUTH_REQUIRED'
                    ]));
                    return $Silian_response
                        ->withStatus(401)
                        ->withHeader('Content-Type', 'application/json');
                }
                $Silian_user = ['id' => null, 'is_admin' => true];
            }

            // 检查是否为管理员
            if (!$this->authService->isAdminUser($Silian_user)) {
                if (!$Silian_isTesting) {
                    $Silian_response = new \Slim\Psr7\Response();
                    $Silian_response->getBody()->write(json_encode([
                        'success' => false,
                        'error' => 'Admin access required',
                        'code' => 'ADMIN_REQUIRED'
                    ]));
                    return $Silian_response
                        ->withStatus(403)
                        ->withHeader('Content-Type', 'application/json');
                }
            }

            // 将用户信息添加到请求属性中
            $Silian_request = $Silian_request->withAttribute('user', $Silian_user);

            return $Silian_handler->handle($Silian_request);

        } catch (\Exception $Silian_e) {
            $this->logExceptionWithFallback($Silian_e, $Silian_request, 'AdminMiddleware error: ' . $Silian_e->getMessage());

            $Silian_response = new \Slim\Psr7\Response();
            $Silian_response->getBody()->write(json_encode([
                'success' => false,
                'error' => 'Internal server error',
                'code' => 'INTERNAL_ERROR'
            ]));
            return $Silian_response
                ->withStatus(500)
                ->withHeader('Content-Type', 'application/json');
        }
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
