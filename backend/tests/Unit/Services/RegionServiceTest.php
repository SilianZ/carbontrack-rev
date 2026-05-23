<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\RegionService;
use PHPUnit\Framework\TestCase;

class RegionServiceTest extends TestCase
{
    public function testUsesDatasetWhenAvailable(): void
    {
        $Silian_previousRegionDataPath = $_ENV['REGION_DATA_PATH'] ?? null;
        unset($_ENV['REGION_DATA_PATH']);

        try {
            $Silian_datasetPath = realpath(__DIR__ . '/../../../storage/data/states.json');
            $this->assertNotFalse($Silian_datasetPath);

            $Silian_service = new RegionService($Silian_datasetPath, null);

            $this->assertSame('CN', $Silian_service->normalizeCountryCode('cn'));
            $this->assertSame('GD', $Silian_service->normalizeStateCode('gd'));
            $this->assertTrue($Silian_service->isValidRegion('CN', 'GD'));
            $this->assertFalse($Silian_service->isValidRegion('CN', 'INVALID'));
            $this->assertSame([
                'country_code' => 'US',
                'state_code' => 'UM-81',
            ], $Silian_service->parseRegionCode('us-um-81'));
        } finally {
            if ($Silian_previousRegionDataPath !== null) {
                $_ENV['REGION_DATA_PATH'] = $Silian_previousRegionDataPath;
            } else {
                unset($_ENV['REGION_DATA_PATH']);
            }
        }
    }

    public function testFallsBackToCodeFormatWhenDatasetMissing(): void
    {
        $Silian_previousRegionDataPath = $_ENV['REGION_DATA_PATH'] ?? null;
        unset($_ENV['REGION_DATA_PATH']);

        try {
            $Silian_service = new RegionService('__missing__/states.json', null);

            $this->assertSame('CN', $Silian_service->normalizeCountryCode('cn'));
            $this->assertSame('GD', $Silian_service->normalizeStateCode('gd'));
            $this->assertTrue($Silian_service->isValidRegion('CN', 'GD'));
            $this->assertFalse($Silian_service->isValidRegion('C', 'GD'));
            $this->assertFalse($Silian_service->isValidRegion('CN', ''));
            $this->assertFalse($Silian_service->isValidRegion('CN', '-'));
            $this->assertFalse($Silian_service->isValidRegion('CN', 'GD-'));
            $this->assertFalse($Silian_service->isValidRegion('CN', '-GD'));

            $Silian_context = $Silian_service->getRegionContext('US-UM-81');
            $this->assertNotNull($Silian_context);
            $this->assertSame('US-UM-81', $Silian_context['region_code']);
            $this->assertSame('US', $Silian_context['country_code']);
            $this->assertSame('UM-81', $Silian_context['state_code']);
            $this->assertNull($Silian_context['region_label']);
        } finally {
            if ($Silian_previousRegionDataPath !== null) {
                $_ENV['REGION_DATA_PATH'] = $Silian_previousRegionDataPath;
            } else {
                unset($_ENV['REGION_DATA_PATH']);
            }
        }
    }

    public function testMissingDatasetWritesAuditAndErrorLog(): void
    {
        $Silian_previousRegionDataPath = $_ENV['REGION_DATA_PATH'] ?? null;
        unset($_ENV['REGION_DATA_PATH']);
        $Silian_missingPath = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'ct_missing_region_' . uniqid('', true) . '.json';

        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_audit->expects($this->once())
            ->method('log')
            ->with($this->callback(function (array $Silian_payload): bool {
                return ($Silian_payload['action'] ?? null) === 'region_dataset_missing'
                    && ($Silian_payload['operation_category'] ?? null) === 'system';
            }))
            ->willReturn(true);

        $Silian_error = $this->createMock(ErrorLogService::class);
        $Silian_error->expects($this->once())
            ->method('logError')
            ->with(
                'RegionDatasetError',
                $this->stringContains('Region dataset not found'),
                $this->anything(),
                $this->arrayHasKey('path')
            )
            ->willReturn(1);

        try {
            new RegionService($Silian_missingPath, null, $Silian_audit, $Silian_error);
        } finally {
            if ($Silian_previousRegionDataPath !== null) {
                $_ENV['REGION_DATA_PATH'] = $Silian_previousRegionDataPath;
            } else {
                unset($_ENV['REGION_DATA_PATH']);
            }
        }
    }

    public function testRelativeEnvPathResolvesFromBackendDirectoryWhenPresent(): void
    {
        $Silian_previousRegionDataPath = $_ENV['REGION_DATA_PATH'] ?? null;
        $_ENV['REGION_DATA_PATH'] = 'storage/data/states.json';

        try {
            $Silian_service = new RegionService(null, null);

            $this->assertTrue($Silian_service->isReady());
            $this->assertSame('CN', $Silian_service->normalizeCountryCode('cn'));
            $this->assertTrue($Silian_service->isValidRegion('CN', 'GD'));
        } finally {
            if ($Silian_previousRegionDataPath !== null) {
                $_ENV['REGION_DATA_PATH'] = $Silian_previousRegionDataPath;
            } else {
                unset($_ENV['REGION_DATA_PATH']);
            }
        }
    }
}
