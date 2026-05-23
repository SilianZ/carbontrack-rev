<?php

declare(strict_types=1);

use CarbonTrack\Services\SupportRoutingEngineService;
use DI\Container;
use Dotenv\Dotenv;

require_once __DIR__ . '/../vendor/autoload.php';

try {
    $Silian_dotenv = Dotenv::createImmutable(__DIR__ . '/..');
    if (method_exists($Silian_dotenv, 'safeLoad')) {
        $Silian_dotenv->safeLoad();
    } else {
        $Silian_dotenv->load();
    }
} catch (Throwable) {
    // Ignore environment bootstrap failures and continue with defaults.
}

$Silian_container = new Container();
$Silian_dependencies = require __DIR__ . '/../src/dependencies.php';
$Silian_dependencies($Silian_container);

/** @var SupportRoutingEngineService $engine */
$Silian_engine = $Silian_container->get(SupportRoutingEngineService::class);
$Silian_result = $Silian_engine->runSlaSweep();

fwrite(STDOUT, json_encode([
    'success' => true,
    'data' => $Silian_result,
], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . PHP_EOL);

exit(0);
