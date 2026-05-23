<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Jobs\EmailJobRunner;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\EmailService;
use CarbonTrack\Services\ErrorLogService;
use Monolog\Handler\NullHandler;
use Monolog\Logger;
use PHPUnit\Framework\TestCase;

class EmailJobRunnerTest extends TestCase
{
    public function testRunLogsAuditWhenJobTypeMissing(): void
    {
        $Silian_emailService = $this->createMock(EmailService::class);
        $Silian_auditLogService = $this->createMock(AuditLogService::class);
        $Silian_errorLogService = $this->createMock(ErrorLogService::class);

        $Silian_auditLogService->expects($this->once())
            ->method('logSystemEvent')
            ->with('email_job_missing_type', 'email_job', $this->isType('array'))
            ->willReturn(true);

        $Silian_logger = new Logger('test-email-job');
        $Silian_logger->pushHandler(new NullHandler());

        EmailJobRunner::run($Silian_emailService, $Silian_logger, '', [], $Silian_auditLogService, $Silian_errorLogService);

        $this->assertTrue(true);
    }
}