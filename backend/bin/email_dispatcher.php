<?php

declare(strict_types=1);

use CarbonTrack\Jobs\EmailJobRunner;
use CarbonTrack\Services\EmailService;
use Dotenv\Dotenv;
use DI\Container;
use Monolog\Logger;

require_once __DIR__ . '/../vendor/autoload.php';

$Silian_jobFile = $argv[1] ?? null;
if ($Silian_jobFile === null || !is_file($Silian_jobFile)) {
    fwrite(STDERR, "Missing email job payload file.\n");
    exit(1);
}

$Silian_rawPayload = file_get_contents($Silian_jobFile);
@unlink($Silian_jobFile);
if ($Silian_rawPayload === false) {
    fwrite(STDERR, "Unable to read email job payload.\n");
    exit(1);
}

$Silian_jobData = json_decode($Silian_rawPayload, true);
if (!is_array($Silian_jobData)) {
    fwrite(STDERR, "Invalid email job payload.\n");
    exit(1);
}

try {
    $Silian_dotenv = Dotenv::createImmutable(__DIR__ . '/..');
    if (method_exists($Silian_dotenv, 'safeLoad')) {
        $Silian_dotenv->safeLoad();
    } else {
        $Silian_dotenv->load();
    }
} catch (Throwable $Silian_e) {
    // Ignore failures to load environment; defaults will be used.
}

$Silian_container = new Container();
$Silian_dependencies = require __DIR__ . '/../src/dependencies.php';
$Silian_dependencies($Silian_container);

/** @var EmailService $emailService */
$Silian_emailService = $Silian_container->get(EmailService::class);
/** @var Logger $logger */
$Silian_logger = $Silian_container->get(Logger::class);

$Silian_jobs = $Silian_jobData['jobs'] ?? null;
if (is_array($Silian_jobs)) {
    foreach ($Silian_jobs as $Silian_job) {
        $Silian_jobType = (string) ($Silian_job['job_type'] ?? '');
        $Silian_payload = is_array($Silian_job['payload'] ?? null) ? $Silian_job['payload'] : [];
        EmailJobRunner::run($Silian_emailService, $Silian_logger, $Silian_jobType, $Silian_payload);
    }
    exit(0);
}

$Silian_jobType = (string) ($Silian_jobData['job_type'] ?? '');
$Silian_payload = is_array($Silian_jobData['payload'] ?? null) ? $Silian_jobData['payload'] : [];

EmailJobRunner::run($Silian_emailService, $Silian_logger, $Silian_jobType, $Silian_payload);

exit(0);

