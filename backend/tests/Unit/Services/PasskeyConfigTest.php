<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\PasskeyConfig;
use PHPUnit\Framework\TestCase;

class PasskeyConfigTest extends TestCase
{
    public function testGetRpIdKeepsConfiguredSuffixWhenCompatibleWithFrontendHost(): void
    {
        $Silian_config = new PasskeyConfig([
            'PASSKEYS_RP_ID' => 'carbontrackapp.com',
            'FRONTEND_URL' => 'https://dev.carbontrackapp.com',
        ]);

        $this->assertSame('carbontrackapp.com', $Silian_config->getRpId());
    }

    public function testGetRpIdFallsBackToFrontendHostWhenConfiguredRpIdMismatchesFrontendHost(): void
    {
        $Silian_config = new PasskeyConfig([
            'PASSKEYS_RP_ID' => 'carbontrack.com',
            'PASSKEYS_ORIGINS' => 'https://dev.carbontrack.com',
            'FRONTEND_URL' => 'https://dev.carbontrackapp.com',
        ]);

        $this->assertSame('dev.carbontrackapp.com', $Silian_config->getRpId());
    }

    public function testGetAllowedOriginsIncludesFrontendOriginWhenExplicitOriginsMissIt(): void
    {
        $Silian_config = new PasskeyConfig([
            'PASSKEYS_ORIGINS' => 'https://dev.carbontrack.com/',
            'FRONTEND_URL' => 'https://dev.carbontrackapp.com/',
        ]);

        $this->assertSame([
            'https://dev.carbontrack.com',
            'https://dev.carbontrackapp.com',
        ], $Silian_config->getAllowedOrigins());
    }

    public function testGetAllowedOriginsFallsBackToFrontendOriginBeforeAppUrl(): void
    {
        $Silian_config = new PasskeyConfig([
            'FRONTEND_URL' => 'https://dev.carbontrackapp.com/path',
            'APP_URL' => 'https://dev-api.carbontrackapp.com',
        ]);

        $this->assertSame([
            'https://dev.carbontrackapp.com',
        ], $Silian_config->getAllowedOrigins());
    }

    public function testGetAllowedOriginsFallsBackToAppUrlWhenFrontendUrlMissing(): void
    {
        $Silian_config = new PasskeyConfig([
            'APP_URL' => 'https://dev-api.carbontrackapp.com/api',
        ]);

        $this->assertSame([
            'https://dev-api.carbontrackapp.com',
        ], $Silian_config->getAllowedOrigins());
    }
}
