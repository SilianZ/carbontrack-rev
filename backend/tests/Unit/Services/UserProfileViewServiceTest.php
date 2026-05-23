<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\RegionService;
use CarbonTrack\Services\UserProfileViewService;
use PHPUnit\Framework\TestCase;

class UserProfileViewServiceTest extends TestCase
{
    public function testBuildProfileFieldsFallsBackToLegacyLocationAndSchool(): void
    {
        $Silian_regionService = $this->createMock(RegionService::class);
        $Silian_regionService->expects($this->once())
            ->method('getRegionContext')
            ->with('US-UM-81')
            ->willReturn([
                'region_code' => 'US-UM-81',
                'region_label' => null,
                'country_code' => 'US',
                'state_code' => 'UM-81',
                'country_name' => 'United States',
                'state_name' => null,
            ]);

        $Silian_service = new UserProfileViewService($Silian_regionService);

        $Silian_fields = $Silian_service->buildProfileFields([
            'school' => 'Legacy Academy',
            'location' => 'US-UM-81',
        ]);

        $this->assertNull($Silian_fields['school_id']);
        $this->assertSame('Legacy Academy', $Silian_fields['school_name']);
        $this->assertSame('US-UM-81', $Silian_fields['region_code']);
        $this->assertSame('US', $Silian_fields['country_code']);
        $this->assertSame('UM-81', $Silian_fields['state_code']);
    }

    public function testBuildProfileFieldsFallsBackToLegacySchoolWhenJoinedNameMissing(): void
    {
        $Silian_regionService = $this->createMock(RegionService::class);
        $Silian_regionService->expects($this->once())
            ->method('getRegionContext')
            ->with('US-UM-81')
            ->willReturn([
                'region_code' => 'US-UM-81',
                'region_label' => 'US-UM-81',
                'country_code' => 'US',
                'state_code' => 'UM-81',
                'country_name' => 'United States',
                'state_name' => null,
            ]);

        $Silian_service = new UserProfileViewService($Silian_regionService);

        $Silian_row = [
            'school_id' => 7,
            'school_name' => null,
            'school' => 'Legacy Academy',
            'region_code' => 'US-UM-81',
        ];
        $Silian_fields = $Silian_service->buildProfileFields($Silian_row);

        $Silian_legacy = $Silian_service->buildLegacyDisplayFields($Silian_row, $Silian_fields);

        $this->assertSame(7, $Silian_fields['school_id']);
        $this->assertSame('Legacy Academy', $Silian_fields['school_name']);
        $this->assertSame('Legacy Academy', $Silian_legacy['school']);
        $this->assertSame('US-UM-81', $Silian_legacy['location']);
    }

    public function testCanonicalFieldsTakePriorityOverLegacyValues(): void
    {
        $Silian_regionService = $this->createMock(RegionService::class);
        $Silian_regionService->expects($this->once())
            ->method('getRegionContext')
            ->with('US-UM-81')
            ->willReturn([
                'region_code' => 'US-UM-81',
                'region_label' => 'United States · Baker Island',
                'country_code' => 'US',
                'state_code' => 'UM-81',
                'country_name' => 'United States',
                'state_name' => 'Baker Island',
            ]);

        $Silian_service = new UserProfileViewService($Silian_regionService);

        $Silian_row = [
            'school_id' => 7,
            'school_name' => 'Canonical Academy',
            'school' => 'Legacy Academy',
            'region_code' => 'US-UM-81',
            'location' => 'CN-GD',
        ];

        $Silian_fields = $Silian_service->buildProfileFields($Silian_row);
        $Silian_legacy = $Silian_service->buildLegacyDisplayFields($Silian_row, $Silian_fields);

        $this->assertSame(7, $Silian_fields['school_id']);
        $this->assertSame('Canonical Academy', $Silian_fields['school_name']);
        $this->assertSame('US-UM-81', $Silian_fields['region_code']);
        $this->assertSame('Canonical Academy', $Silian_legacy['school']);
        $this->assertSame('United States · Baker Island', $Silian_legacy['location']);
    }
}
