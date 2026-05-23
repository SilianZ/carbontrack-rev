<?php

declare(strict_types=1);

require __DIR__ . '/../vendor/autoload.php';

// Load test environment variables
if (file_exists(__DIR__ . '/../.env.testing')) {
    $Silian_dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..', '.env.testing');
    $Silian_dotenv->load();
} elseif (file_exists(__DIR__ . '/../.env')) {
    $Silian_dotenv = Dotenv\Dotenv::createImmutable(__DIR__ . '/..');
    $Silian_dotenv->load();
}

// Ensure tests run with safe mail defaults
$Silian_allowLiveEmailsValue = $_ENV['PHPUNIT_ALLOW_LIVE_EMAILS']
    ?? $_SERVER['PHPUNIT_ALLOW_LIVE_EMAILS']
    ?? getenv('PHPUNIT_ALLOW_LIVE_EMAILS');
$Silian_allowLiveEmails = filter_var($Silian_allowLiveEmailsValue, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
if ($Silian_allowLiveEmails === null) {
    $Silian_allowLiveEmails = false;
}

if (!$Silian_allowLiveEmails) {
    $_ENV['MAIL_SIMULATE'] = 'true';
    $_SERVER['MAIL_SIMULATE'] = 'true';
    putenv('MAIL_SIMULATE=true');
}

// CI often runs without backend/.env, so provide safe mail defaults for container wiring.
$Silian_mailDefaults = [
    'MAIL_HOST' => 'localhost',
    'MAIL_PORT' => '1025',
    'MAIL_USERNAME' => 'test',
    'MAIL_PASSWORD' => 'test',
    'MAIL_ENCRYPTION' => 'tls',
    'MAIL_FROM_ADDRESS' => 'noreply@carbontrack.test',
    'MAIL_FROM_NAME' => 'CarbonTrack Test',
    'MAIL_SMTP_DEBUG' => '0',
    'SUPPORT_EMAIL' => 'support@carbontrack.test',
    'FRONTEND_URL' => 'http://localhost:5173',
];

foreach ($Silian_mailDefaults as $Silian_key => $Silian_value) {
    if (!isset($_ENV[$Silian_key])) {
        $_ENV[$Silian_key] = $Silian_value;
    }

    $_SERVER[$Silian_key] = $_ENV[$Silian_key];
    putenv($Silian_key . '=' . $_ENV[$Silian_key]);
}

// Set test environment variables if not already set
$_ENV['APP_ENV'] = $_ENV['APP_ENV'] ?? 'testing';
$_ENV['DB_DATABASE'] = $_ENV['DB_DATABASE'] ?? 'carbontrack_test';
$_ENV['JWT_SECRET'] = $_ENV['JWT_SECRET'] ?? '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
$_ENV['JWT_EXPIRES_IN'] = $_ENV['JWT_EXPIRES_IN'] ?? '3600';

// Disable error reporting for cleaner test output
error_reporting(E_ALL & ~E_DEPRECATED & ~E_STRICT);

// Set timezone
date_default_timezone_set('UTC');

// Helper to create a Slim PSR-7 Request with sane defaults
if (!function_exists('makeRequest')) {
    function makeRequest(string $Silian_method, string $Silian_path, array $Silian_parsedBody = null, array $Silian_queryParams = null, array $Silian_headers = []): \Slim\Psr7\Request {
        $Silian_uri = new \Slim\Psr7\Uri('http', 'localhost', null, $Silian_path);
        $Silian_slimHeaders = new \Slim\Psr7\Headers($Silian_headers);
        $Silian_serverParams = [];
        $Silian_stream = new \Slim\Psr7\Stream(fopen('php://temp', 'r+'));
        $Silian_request = new \Slim\Psr7\Request($Silian_method, $Silian_uri, $Silian_slimHeaders, [], $Silian_serverParams, $Silian_stream);
        if ($Silian_parsedBody !== null) {
            $Silian_request = $Silian_request->withParsedBody($Silian_parsedBody);
        }
        if ($Silian_queryParams !== null) {
            $Silian_request = $Silian_request->withQueryParams($Silian_queryParams);
        }
        return $Silian_request;
    }
}

