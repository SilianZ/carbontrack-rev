<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

class PasskeyIntegrationUnavailableException extends PasskeyOperationException
{
    public function __construct(string $Silian_packageName, ?\Throwable $Silian_previous = null)
    {
        parent::__construct(
            sprintf(
                'WebAuthn verification is not available because %s is not installed in this environment.',
                $Silian_packageName
            ),
            'WEBAUTHN_LIBRARY_UNAVAILABLE',
            501,
            $Silian_previous
        );
    }
}
