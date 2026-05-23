<?php

declare(strict_types=1);

namespace CarbonTrack\Services\Webauthn;

final class CborDecoder
{
    public static function decode(string $Silian_payload)
    {
        $Silian_offset = 0;
        $Silian_value = self::decodeWithOffset($Silian_payload, $Silian_offset);
        if ($Silian_offset !== strlen($Silian_payload)) {
            throw new \InvalidArgumentException('Unexpected trailing bytes in CBOR payload.');
        }

        return $Silian_value;
    }

    public static function decodeWithOffset(string $Silian_payload, int &$Silian_offset)
    {
        return self::readItem($Silian_payload, $Silian_offset);
    }

    private static function readItem(string $Silian_payload, int &$Silian_offset)
    {
        if (!isset($Silian_payload[$Silian_offset])) {
            throw new \InvalidArgumentException('Unexpected end of CBOR payload.');
        }

        $Silian_initial = ord($Silian_payload[$Silian_offset++]);
        $Silian_majorType = $Silian_initial >> 5;
        $Silian_additional = $Silian_initial & 0x1f;

        switch ($Silian_majorType) {
            case 0:
                return self::readLength($Silian_payload, $Silian_offset, $Silian_additional);
            case 1:
                return -1 - self::readLength($Silian_payload, $Silian_offset, $Silian_additional);
            case 2:
                $Silian_length = self::readLength($Silian_payload, $Silian_offset, $Silian_additional);
                return self::readBytes($Silian_payload, $Silian_offset, $Silian_length);
            case 3:
                $Silian_length = self::readLength($Silian_payload, $Silian_offset, $Silian_additional);
                return self::readBytes($Silian_payload, $Silian_offset, $Silian_length);
            case 4:
                $Silian_length = self::readLength($Silian_payload, $Silian_offset, $Silian_additional);
                $Silian_items = [];
                for ($Silian_index = 0; $Silian_index < $Silian_length; $Silian_index++) {
                    $Silian_items[] = self::readItem($Silian_payload, $Silian_offset);
                }
                return $Silian_items;
            case 5:
                $Silian_length = self::readLength($Silian_payload, $Silian_offset, $Silian_additional);
                $Silian_items = [];
                for ($Silian_index = 0; $Silian_index < $Silian_length; $Silian_index++) {
                    $Silian_items[self::readItem($Silian_payload, $Silian_offset)] = self::readItem($Silian_payload, $Silian_offset);
                }
                return $Silian_items;
            case 7:
                return self::readSimpleValue($Silian_payload, $Silian_offset, $Silian_additional);
            default:
                throw new \InvalidArgumentException('Unsupported CBOR major type.');
        }
    }

    private static function readLength(string $Silian_payload, int &$Silian_offset, int $Silian_additional): int
    {
        if ($Silian_additional < 24) {
            return $Silian_additional;
        }

        if ($Silian_additional === 24) {
            return ord(self::readBytes($Silian_payload, $Silian_offset, 1));
        }

        if ($Silian_additional === 25) {
            return unpack('n', self::readBytes($Silian_payload, $Silian_offset, 2))[1];
        }

        if ($Silian_additional === 26) {
            return unpack('N', self::readBytes($Silian_payload, $Silian_offset, 4))[1];
        }

        if ($Silian_additional === 27) {
            $Silian_parts = unpack('N2', self::readBytes($Silian_payload, $Silian_offset, 8));
            return ((int) $Silian_parts[1] << 32) | (int) $Silian_parts[2];
        }

        throw new \InvalidArgumentException('Unsupported CBOR additional information value.');
    }

    private static function readSimpleValue(string $Silian_payload, int &$Silian_offset, int $Silian_additional)
    {
        if ($Silian_additional === 20) {
            return false;
        }

        if ($Silian_additional === 21) {
            return true;
        }

        if ($Silian_additional === 22) {
            return null;
        }

        throw new \InvalidArgumentException('Unsupported CBOR simple value.');
    }

    private static function readBytes(string $Silian_payload, int &$Silian_offset, int $Silian_length): string
    {
        if ($Silian_length < 0 || ($Silian_offset + $Silian_length) > strlen($Silian_payload)) {
            throw new \InvalidArgumentException('Unexpected end of CBOR payload.');
        }

        $Silian_value = substr($Silian_payload, $Silian_offset, $Silian_length);
        $Silian_offset += $Silian_length;

        return $Silian_value;
    }
}
