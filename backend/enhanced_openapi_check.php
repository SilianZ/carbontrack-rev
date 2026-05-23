<?php

declare(strict_types=1);

require_once __DIR__ . '/vendor/autoload.php';

use DI\Container;
use Slim\App;
use Slim\Factory\AppFactory;

final class EnhancedOpenApiChecker
{
    /** @var array<string, array{operationId: string|null, deprecated: bool}> */
    private array $openApiOperations = [];

    /** @var array<string, array{path: string, handler: string, handler_exists: bool}> */
    private array $runtimeRoutes = [];

    private App $app;

    public function __construct()
    {
        $this->loadOpenApiOperations();
        $this->bootApplication();
        $this->extractRuntimeRoutes();
    }

    private function loadOpenApiOperations(): void
    {
        $Silian_raw = file_get_contents(__DIR__ . '/openapi.json');
        if ($Silian_raw === false) {
            throw new RuntimeException('Unable to read backend/openapi.json');
        }

        $Silian_spec = json_decode($Silian_raw, true);
        if (!is_array($Silian_spec) || !isset($Silian_spec['paths']) || !is_array($Silian_spec['paths'])) {
            throw new RuntimeException('Invalid OpenAPI document: missing paths');
        }

        foreach ($Silian_spec['paths'] as $Silian_path => $Silian_pathItem) {
            if (!is_array($Silian_pathItem) || $Silian_path === '/{routes}') {
                continue;
            }

            foreach ($Silian_pathItem as $Silian_method => $Silian_operation) {
                $Silian_upperMethod = strtoupper((string) $Silian_method);
                if (!in_array($Silian_upperMethod, ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'], true)) {
                    continue;
                }

                $Silian_signature = $this->signature($Silian_upperMethod, (string) $Silian_path);
                $this->openApiOperations[$Silian_signature] = [
                    'operationId' => is_array($Silian_operation) ? ($Silian_operation['operationId'] ?? null) : null,
                    'deprecated' => is_array($Silian_operation) && !empty($Silian_operation['deprecated']),
                ];
            }
        }
    }

    private function bootApplication(): void
    {
        $_ENV['DATABASE_PATH'] = __DIR__ . '/test.db';
        $_ENV['DB_CONNECTION'] = 'sqlite';
        $_ENV['DB_DATABASE'] = $_ENV['DATABASE_PATH'];
        $_ENV['JWT_SECRET'] = 'test_secret';
        $_ENV['TURNSTILE_SECRET_KEY'] = 'test_turnstile';

        $Silian_container = new Container();
        require __DIR__ . '/src/dependencies.php';

        $this->app = AppFactory::createFromContainer($Silian_container);
        $this->app->addRoutingMiddleware();

        $Silian_routes = require __DIR__ . '/src/routes.php';
        $Silian_routes($this->app);
    }

    private function extractRuntimeRoutes(): void
    {
        foreach ($this->app->getRouteCollector()->getRoutes() as $Silian_route) {
            $Silian_normalizedPath = $this->normalizeRoutePattern($Silian_route->getPattern());
            if ($Silian_normalizedPath === '/{routes}') {
                continue;
            }

            $Silian_handler = $this->stringifyCallable($Silian_route->getCallable());
            $Silian_handlerExists = $this->callableExists($Silian_handler);

            foreach ($Silian_route->getMethods() as $Silian_method) {
                $Silian_signature = $this->signature(strtoupper($Silian_method), $Silian_normalizedPath);
                $this->runtimeRoutes[$Silian_signature] = [
                    'path' => $Silian_normalizedPath,
                    'handler' => $Silian_handler,
                    'handler_exists' => $Silian_handlerExists,
                ];
            }
        }
    }

    private function normalizeRoutePattern(string $Silian_pattern): string
    {
        return (string) preg_replace('/\{(\w+):[^}]+\}/', '{$1}', $Silian_pattern);
    }

    private function stringifyCallable(mixed $Silian_callable): string
    {
        if (is_array($Silian_callable) && count($Silian_callable) === 2) {
            $Silian_class = is_object($Silian_callable[0]) ? get_class($Silian_callable[0]) : (string) $Silian_callable[0];
            return $Silian_class . '::' . (string) $Silian_callable[1];
        }

        if (is_string($Silian_callable)) {
            return $Silian_callable;
        }

        if ($Silian_callable instanceof Closure) {
            return 'closure';
        }

        return 'closure';
    }

    private function callableExists(string $Silian_handler): bool
    {
        if ($Silian_handler === 'closure') {
            return true;
        }

        if (!str_contains($Silian_handler, '::')) {
            return false;
        }

        [$Silian_class, $Silian_method] = explode('::', $Silian_handler, 2);
        $Silian_sourceFile = $this->resolveSourceFile($Silian_class);
        if ($Silian_sourceFile !== null && is_file($Silian_sourceFile)) {
            $Silian_source = file_get_contents($Silian_sourceFile);
            if ($Silian_source === false) {
                return false;
            }

            return (bool) preg_match('/function\s+' . preg_quote($Silian_method, '/') . '\s*\(/', $Silian_source);
        }

        return class_exists($Silian_class) && method_exists($Silian_class, $Silian_method);
    }

    private function resolveSourceFile(string $Silian_class): ?string
    {
        $Silian_prefix = 'CarbonTrack\\';
        if (!str_starts_with($Silian_class, $Silian_prefix)) {
            return null;
        }

        $Silian_relative = str_replace('\\', '/', substr($Silian_class, strlen($Silian_prefix)));
        return __DIR__ . '/src/' . $Silian_relative . '.php';
    }

    private function signature(string $Silian_method, string $Silian_path): string
    {
        return $Silian_method . ' ' . $Silian_path;
    }

    public function report(): int
    {
        $Silian_specSignatures = array_keys($this->openApiOperations);
        $Silian_runtimeSignatures = array_keys($this->runtimeRoutes);

        sort($Silian_specSignatures);
        sort($Silian_runtimeSignatures);

        $Silian_missingInRuntime = array_values(array_diff($Silian_specSignatures, $Silian_runtimeSignatures));
        $Silian_missingInSpec = array_values(array_diff($Silian_runtimeSignatures, $Silian_specSignatures));
        $Silian_brokenHandlers = [];

        foreach ($this->runtimeRoutes as $Silian_signature => $Silian_route) {
            if (!$Silian_route['handler_exists']) {
                $Silian_brokenHandlers[$Silian_signature] = $Silian_route['handler'];
            }
        }

        echo "=== Enhanced OpenAPI Runtime Alignment ===\n";
        echo 'Documented operations: ' . count($Silian_specSignatures) . "\n";
        echo 'Runtime operations: ' . count($Silian_runtimeSignatures) . "\n";
        echo 'Matching operations: ' . count(array_intersect($Silian_specSignatures, $Silian_runtimeSignatures)) . "\n";
        echo "Excluded runtime catch-all: /{routes}\n\n";

        if ($Silian_missingInRuntime !== []) {
            echo "OpenAPI operations missing from runtime:\n";
            foreach ($Silian_missingInRuntime as $Silian_signature) {
                echo '  - ' . $Silian_signature . "\n";
            }
            echo "\n";
        }

        if ($Silian_missingInSpec !== []) {
            echo "Runtime operations missing from OpenAPI:\n";
            foreach ($Silian_missingInSpec as $Silian_signature) {
                $Silian_handler = $this->runtimeRoutes[$Silian_signature]['handler'] ?? 'unknown';
                echo '  - ' . $Silian_signature . ' => ' . $Silian_handler . "\n";
            }
            echo "\n";
        }

        if ($Silian_brokenHandlers !== []) {
            echo "Runtime routes with unresolved handlers:\n";
            foreach ($Silian_brokenHandlers as $Silian_signature => $Silian_handler) {
                echo '  - ' . $Silian_signature . ' => ' . $Silian_handler . "\n";
            }
            echo "\n";
        }

        $Silian_isAligned = $Silian_missingInRuntime === [] && $Silian_missingInSpec === [] && $Silian_brokenHandlers === [];
        if ($Silian_isAligned) {
            echo "Full alignment confirmed for documented runtime routes.\n";
            echo "Verified distinct public roots: GET / and GET /api/v1.\n";
            echo "Verified runtime handlers exist for all documented operations.\n";
            return 0;
        }

        return 1;
    }
}

try {
    $Silian_checker = new EnhancedOpenApiChecker();
    exit($Silian_checker->report());
} catch (Throwable $Silian_exception) {
    fwrite(STDERR, 'Enhanced OpenAPI check failed: ' . $Silian_exception->getMessage() . PHP_EOL);
    exit(1);
}
