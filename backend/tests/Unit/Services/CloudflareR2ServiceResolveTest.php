<?php

declare(strict_types=1);

namespace Tests\Unit\Services;

use CarbonTrack\Services\CloudflareR2Service;
use CarbonTrack\Services\AuditLogService;
use Monolog\Logger;
use PHPUnit\Framework\TestCase;

class CloudflareR2ServiceResolveTest extends TestCase
{
    private function makeService(string $Silian_endpoint, string $Silian_bucket, ?string $Silian_publicUrl = null): CloudflareR2Service
    {
        $Silian_logger = new Logger('test');
        $Silian_auditLog = $this->createMock(AuditLogService::class);

        return new CloudflareR2Service(
            'test-access',
            'test-secret',
            $Silian_endpoint,
            $Silian_bucket,
            $Silian_publicUrl,
            $Silian_logger,
            $Silian_auditLog
        );
    }

    public function testResolveKeyFromDerivedPublicUrl(): void
    {
        $Silian_service = $this->makeService('https://example.r2.cloudflarestorage.com', 'media', 'https://pub-example.r2.dev/media');

        $Silian_key = $Silian_service->resolveKeyFromUrl('https://pub-example.r2.dev/media/badges/2025/icon.png');
        $this->assertSame('badges/2025/icon.png', $Silian_key);
    }

    public function testResolveKeyFromCustomEndpoint(): void
    {
        $Silian_service = $this->makeService('https://files.example.com', 'media', null);

        $Silian_key = $Silian_service->resolveKeyFromUrl('https://files.example.com/media/uploads/2025/01/avatar.png');
        $this->assertSame('uploads/2025/01/avatar.png', $Silian_key);
    }

    public function testResolveKeyFromRelativePath(): void
    {
        $Silian_service = $this->makeService('https://files.example.com', 'media');

        $Silian_key = $Silian_service->resolveKeyFromUrl('uploads/2025/01/icon.webp');
        $this->assertSame('uploads/2025/01/icon.webp', $Silian_key);
    }

    public function testResolveKeyWithQueryString(): void
    {
        $Silian_service = $this->makeService('https://example.r2.cloudflarestorage.com', 'media', 'https://pub-example.r2.dev/media');

        $Silian_key = $Silian_service->resolveKeyFromUrl('https://pub-example.r2.dev/media/badges/icon.png?signature=123');
        $this->assertSame('badges/icon.png', $Silian_key);
    }
}
