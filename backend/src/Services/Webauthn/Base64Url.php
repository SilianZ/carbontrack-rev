<?php

declare(strict_types=1);

namespace CarbonTrack\Services\Webauthn;

final class Base64Url
{
    public static function encode(string $Silian_value): string
    {
        return rtrim(strtr(base64_encode($Silian_value), '+/', '-_'), '=');
    }

    public static function decode(string $Silian_value): string
    {
        $Silian_normalized = strtr($Silian_value, '-_', '+/');
        $Silian_padding = strlen($Silian_normalized) % 4;
        if ($Silian_padding > 0) {
            $Silian_normalized .= str_repeat('=', 4 - $Silian_padding);
        }

        $Silian_decoded = base64_decode($Silian_normalized, true);
        if ($Silian_decoded === false) {
            throw new \InvalidArgumentException('Invalid base64url payload.');
        }

        return $Silian_decoded;
    }
}
