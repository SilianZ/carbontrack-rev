<?php

declare(strict_types=1);

namespace CarbonTrack\Support;

final class Uuid
{
    private const V4_PATTERN = '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i';

    public static function generateV4(): string
    {
        $Silian_bytes = random_bytes(16);
        $Silian_bytes[6] = chr((ord($Silian_bytes[6]) & 0x0f) | 0x40);
        $Silian_bytes[8] = chr((ord($Silian_bytes[8]) & 0x3f) | 0x80);

        return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($Silian_bytes), 4));
    }

    public static function isValid(string $Silian_uuid): bool
    {
        return preg_match(self::V4_PATTERN, $Silian_uuid) === 1;
    }
}
