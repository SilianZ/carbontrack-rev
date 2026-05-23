<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Integration;

use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\MultipartUploadService;
use Illuminate\Database\Capsule\Manager as Capsule;
use Monolog\Logger;
use PHPUnit\Framework\TestCase;

class MultipartUploadServiceTest extends TestCase
{
    private Capsule $capsule;

    protected function setUp(): void
    {
        parent::setUp();

        $this->capsule = new Capsule();
        $this->capsule->addConnection([
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
        ]);
        $this->capsule->setAsGlobal();
        $this->capsule->bootEloquent();

        TestSchemaBuilder::init($this->capsule->getConnection()->getPdo());
    }

    public function testRegisterAndClearUploadWriteAuditLogs(): void
    {
        $Silian_actions = [];
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->exactly(2))
            ->method('log')
            ->willReturnCallback(function (array $Silian_payload) use (&$Silian_actions): bool {
                $Silian_actions[] = $Silian_payload['action'] ?? null;
                return true;
            });

        $Silian_service = new MultipartUploadService(new Logger('multipart-test'), $Silian_audit, null);

        $Silian_upload = $Silian_service->registerUpload('upload-123', '/tmp/file.bin', 42, null, 120);
        $Silian_service->clearUpload('upload-123');

        $this->assertSame('upload-123', $Silian_upload->upload_id);
        $this->assertContains('multipart_upload_registered', $Silian_actions);
        $this->assertContains('multipart_upload_cleared', $Silian_actions);
        $this->assertSame(0, (int) $this->capsule->getConnection()->table('multipart_uploads')->count());
    }

    public function testRegisterUploadAcceptsLegacyFourthArgumentAsTtl(): void
    {
        $Silian_service = new MultipartUploadService(new Logger('multipart-test'));

        $Silian_before = time();
        $Silian_upload = $Silian_service->registerUpload('upload-legacy', '/tmp/file.bin', 42, 120);
        $Silian_after = time();

        $Silian_expiresAt = strtotime((string) $Silian_upload->expires_at);

        $this->assertNotFalse($Silian_expiresAt);
        $this->assertGreaterThanOrEqual($Silian_before + 60, $Silian_expiresAt);
        $this->assertLessThanOrEqual($Silian_after + 125, $Silian_expiresAt);
        $this->assertNull($Silian_upload->sha256);
    }
}
