<?php

declare(strict_types=1);

namespace CarbonTrack\Support;

final class RequestIdNormalizer
{
    private const UUID_PATTERN = '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i';

    /**
     * Normalize request_id values with optional null-on-empty handling.
     *
     * @param mixed $value
     */
    public static function normalize($Silian_value, bool $Silian_nullIfEmpty = true): ?string
    {
        if ($Silian_value === null) {
            return null;
        }

        $Silian_trimmed = trim((string)$Silian_value);
        if ($Silian_trimmed === '') {
            return $Silian_nullIfEmpty ? null : '';
        }

        if (preg_match(self::UUID_PATTERN, $Silian_trimmed) === 1) {
            return strtolower($Silian_trimmed);
        }

        return $Silian_trimmed;
    }
}
