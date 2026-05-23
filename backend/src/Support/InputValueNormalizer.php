<?php

declare(strict_types=1);

namespace CarbonTrack\Support;

final class InputValueNormalizer
{
    private function __construct()
    {
    }

    public static function boolean(mixed $Silian_value, string $Silian_field, bool $Silian_default = false): bool
    {
        if (is_bool($Silian_value)) {
            return $Silian_value;
        }

        if (is_int($Silian_value)) {
            if ($Silian_value === 0 || $Silian_value === 1) {
                return $Silian_value === 1;
            }

            throw new \InvalidArgumentException($Silian_field . ' must be a boolean');
        }

        if (is_float($Silian_value)) {
            if (floor($Silian_value) !== $Silian_value || !in_array((int) $Silian_value, [0, 1], true)) {
                throw new \InvalidArgumentException($Silian_field . ' must be a boolean');
            }

            return ((int) $Silian_value) === 1;
        }

        if (is_string($Silian_value)) {
            $Silian_trimmed = trim($Silian_value);
            if ($Silian_trimmed === '') {
                return $Silian_default;
            }

            return match (strtolower($Silian_trimmed)) {
                '1', 'true', 'yes', 'on' => true,
                '0', 'false', 'no', 'off' => false,
                default => throw new \InvalidArgumentException($Silian_field . ' must be a boolean'),
            };
        }

        throw new \InvalidArgumentException($Silian_field . ' must be a boolean');
    }

    public static function integer(mixed $Silian_value, string $Silian_field, int $Silian_default = 0): int
    {
        if (is_int($Silian_value)) {
            return $Silian_value;
        }

        if (is_bool($Silian_value)) {
            return $Silian_value ? 1 : 0;
        }

        if (is_float($Silian_value)) {
            if (floor($Silian_value) !== $Silian_value) {
                throw new \InvalidArgumentException($Silian_field . ' must be an integer');
            }

            return (int) $Silian_value;
        }

        if (is_string($Silian_value)) {
            $Silian_trimmed = trim($Silian_value);
            if ($Silian_trimmed === '') {
                return $Silian_default;
            }

            if (preg_match('/^-?\d+$/', $Silian_trimmed) === 1) {
                return (int) $Silian_trimmed;
            }
        }

        throw new \InvalidArgumentException($Silian_field . ' must be an integer');
    }

    public static function booleanFlagInteger(mixed $Silian_value, string $Silian_field, int $Silian_default = 0): int
    {
        return self::boolean($Silian_value, $Silian_field, $Silian_default !== 0) ? 1 : 0;
    }
}
