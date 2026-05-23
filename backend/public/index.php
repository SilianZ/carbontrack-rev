<?php
declare(strict_types=1);

// Small shared constants
const APP_DATE_FMT = 'Y-m-d H:i:s';
const APP_JSON = 'application/json';

// --- Error Handling & Environment Setup ---
// Prevent PHP warnings and notices from breaking the JSON response format.
// In production, these should be logged, not displayed.
ini_set('display_errors', '0');
error_reporting(E_ALL);

use DI\Container;
use Psr\Log\LoggerInterface;
use Slim\Factory\AppFactory;
use Slim\Factory\ServerRequestCreatorFactory;
use Slim\ResponseEmitter;
use CarbonTrack\Middleware\CorsMiddleware;
use CarbonTrack\Middleware\LoggingMiddleware;
use CarbonTrack\Middleware\IdempotencyMiddleware;
use CarbonTrack\Services\DatabaseService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Support\ErrorResponseBuilder;
use Slim\Middleware\ErrorMiddleware;
use Slim\Exception\HttpException;

require_once __DIR__ . '/../vendor/autoload.php';

// Load environment variables (with fallback)
try {
    $Silian_dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
    $Silian_dotenv->load();
} catch (\Exception $Silian_e) {
    // If .env file doesn't exist, Dotenv will throw; fall back to defaults below.
}

$Silian_resolvedAppEnv = $_ENV['APP_ENV'] ?? $_SERVER['APP_ENV'] ?? getenv('APP_ENV') ?? 'development';
$Silian_resolvedAppEnv = is_string($Silian_resolvedAppEnv) ? strtolower($Silian_resolvedAppEnv) : 'development';
$_ENV['APP_ENV'] = $Silian_resolvedAppEnv;
$_SERVER['APP_ENV'] = $Silian_resolvedAppEnv;
putenv('APP_ENV=' . $Silian_resolvedAppEnv);
$Silian_isProduction = $Silian_resolvedAppEnv === 'production';

if (!defined('CARBONTRACK_NO_EMIT')) {
    define('CARBONTRACK_NO_EMIT', false);
}

// Create Container and register dependencies before creating the app
$Silian_container = new Container();
$Silian_dependencies = require_once __DIR__ . '/../src/dependencies.php';
$Silian_dependencies($Silian_container);

// Set container to create App with on AppFactory and then create the app
AppFactory::setContainer($Silian_container);
$Silian_app = AppFactory::create();

// --- Middleware Registration (Order is important: LIFO - Last In, First Out) ---
// The last middleware added is the first to be executed.

// 1. Error Middleware - Added first, so it executes last, catching all exceptions.
$Silian_errorMiddleware = $Silian_app->addErrorMiddleware(
    !$Silian_isProduction,
    true,
    true
);

// 2. Routing Middleware - This must run before the app's routes are processed.
$Silian_app->addRoutingMiddleware();

// 3. Body Parsing Middleware
$Silian_app->addBodyParsingMiddleware();

// 4. Application-specific middleware
try {
    $Silian_logger = $Silian_container->get(\Monolog\Logger::class);
    $Silian_app->add(new LoggingMiddleware($Silian_logger));
    $Silian_app->add(new IdempotencyMiddleware(
        $Silian_container->get(DatabaseService::class),
        $Silian_logger
    ));
} catch (\Exception $Silian_e) {
    error_log('Failed to create application middleware: ' . $Silian_e->getMessage());
}

// 5. CORS Middleware - Added last, so it executes first.
// This allows it to intercept preflight OPTIONS requests before the router even runs.
$Silian_app->add(new CorsMiddleware());

// Custom error handler for 404 errors
$Silian_errorMiddleware->setErrorHandler(
    Slim\Exception\HttpNotFoundException::class,
    function (Psr\Http\Message\ServerRequestInterface $Silian_request) {
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_response->getBody()->write(json_encode([
            'success' => false,
            'error' => 'Not Found',
            'message' => 'The requested resource was not found',
            'path' => $Silian_request->getUri()->getPath(),
            'method' => $Silian_request->getMethod(),
            'timestamp' => date(APP_DATE_FMT)
        ]));

        return $Silian_response
            ->withStatus(404)
            ->withHeader('Content-Type', APP_JSON);
    }
);

// Default error handler to ensure all unhandled exceptions are persisted to DB
$Silian_errorMiddleware->setDefaultErrorHandler(
    function (
        Psr\Http\Message\ServerRequestInterface $Silian_request,
        Throwable $Silian_exception,
        bool $Silian_displayErrorDetails,
        bool $Silian_logErrors,
        bool $Silian_logErrorDetails
    ) use ($Silian_container, $Silian_resolvedAppEnv) {
        try {
            $Silian_els = $Silian_container->get(ErrorLogService::class);
            $Silian_els->logException($Silian_exception, $Silian_request);
        } catch (Throwable $Silian_e) {
            error_log('Failed to persist unhandled exception: ' . $Silian_e->getMessage());
        }

        try {
            if ($Silian_container->has(LoggerInterface::class)) {
                $Silian_container->get(LoggerInterface::class)->error('Unhandled application exception', [
                    'exception' => $Silian_exception,
                    'environment' => $Silian_resolvedAppEnv,
                    'display_error_details' => $Silian_displayErrorDetails,
                    'log_errors' => $Silian_logErrors,
                    'log_error_details' => $Silian_logErrorDetails,
                ]);
            }
        } catch (Throwable $Silian_loggerEx) {
            error_log('Failed to log exception via logger: ' . $Silian_loggerEx->getMessage());
        }

        $Silian_response = new \Slim\Psr7\Response();
        $Silian_status = 500;

        // Derive an HTTP status code that works across Slim and other frameworks:
        // 1) Slim HttpException exposes the correct status via getCode()
        // 2) Some third-party exceptions expose getStatusCode()
        // 3) Fall back to Exception::getCode()
        $Silian_derivedStatus = null;
        if ($Silian_exception instanceof HttpException) {
            $Silian_derivedStatus = (int) $Silian_exception->getCode();
        } elseif (method_exists($Silian_exception, 'getStatusCode')) {
            try {
                $Silian_derivedStatus = (int) $Silian_exception->getStatusCode();
            } catch (\Throwable $Silian_statusEx) {
                $Silian_derivedStatus = null;
            }
        }

        if ($Silian_derivedStatus === null) {
            $Silian_derivedStatus = (int) $Silian_exception->getCode();
        }

        if ($Silian_derivedStatus >= 400 && $Silian_derivedStatus <= 599) {
            $Silian_status = $Silian_derivedStatus;
        }
        $Silian_payload = ErrorResponseBuilder::build($Silian_exception, $Silian_request, $Silian_resolvedAppEnv, $Silian_status);
        $Silian_response->getBody()->write(json_encode($Silian_payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
        return $Silian_response
            ->withStatus($Silian_status)
            ->withHeader('Content-Type', APP_JSON);
    }
);

// Add a debug route to test if routing is working
$Silian_app->get('/debug', function ($Silian_request, $Silian_response) {
    $Silian_response->getBody()->write(json_encode([
        'success' => true,
        'message' => 'Debug route working',
        'routes' => 'Routes registered successfully',
        'path' => $Silian_request->getUri()->getPath(),
        'method' => $Silian_request->getMethod(),
        'timestamp' => date(APP_DATE_FMT)
    ]));
    return $Silian_response->withHeader('Content-Type', APP_JSON);
});

// Register routes
$Silian_routes = require_once __DIR__ . '/../src/routes.php';
$Silian_routes($Silian_app);

if (CARBONTRACK_NO_EMIT === true) {
    return [
        'app' => $Silian_app,
        'container' => $Silian_container,
        'errorMiddleware' => $Silian_errorMiddleware,
        'environment' => $Silian_resolvedAppEnv,
    ];
}

// Create Request object from globals
$Silian_serverRequestCreator = ServerRequestCreatorFactory::create();
$Silian_request = $Silian_serverRequestCreator->createServerRequestFromGlobals();

// Run App
$Silian_response = $Silian_app->handle($Silian_request);
$Silian_responseEmitter = new ResponseEmitter();
$Silian_responseEmitter->emit($Silian_response);

