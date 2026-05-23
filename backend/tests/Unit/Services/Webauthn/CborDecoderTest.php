<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services\Webauthn;

use CarbonTrack\Services\Webauthn\CborDecoder;
use PHPUnit\Framework\TestCase;

final class CborDecoderTest extends TestCase
{
    public function testDecodeWithOffsetAdvancesPastSingleItemAndLeavesTrailingBytes(): void
    {
        $Silian_item = $this->cborEncode($this->cborMap([
            'credentialPublicKey' => $this->cborMap([
                1 => 2,
                3 => -7,
            ]),
        ]));
        $Silian_payload = $Silian_item . "\x01\x02extensions";
        $Silian_offset = 0;

        $Silian_decoded = CborDecoder::decodeWithOffset($Silian_payload, $Silian_offset);

        $this->assertSame([
            'credentialPublicKey' => [
                1 => 2,
                3 => -7,
            ],
        ], $Silian_decoded);
        $this->assertSame(strlen($Silian_item), $Silian_offset);
        $this->assertSame("\x01\x02extensions", substr($Silian_payload, $Silian_offset));
    }

    /**
     * @param mixed $value
     */
    private function cborEncode($Silian_value): string
    {
        if (is_array($Silian_value) && array_key_exists('__map', $Silian_value)) {
            $Silian_encoded = '';
            foreach ($Silian_value['__map'] as $Silian_key => $Silian_item) {
                $Silian_encoded .= $this->cborEncode($Silian_key) . $this->cborEncode($Silian_item);
            }

            return $this->encodeCborHeader(5, count($Silian_value['__map'])) . $Silian_encoded;
        }

        if (is_string($Silian_value)) {
            return $this->encodeCborItem(3, $Silian_value);
        }

        if (is_int($Silian_value)) {
            if ($Silian_value >= 0) {
                return $this->encodeCborHeader(0, $Silian_value);
            }

            return $this->encodeCborHeader(1, (-1 - $Silian_value));
        }

        throw new \InvalidArgumentException('Unsupported CBOR test value.');
    }

    /**
     * @return array{__map:array<mixed,mixed>}
     */
    private function cborMap(array $Silian_value): array
    {
        return ['__map' => $Silian_value];
    }

    private function encodeCborItem(int $Silian_majorType, string $Silian_payload): string
    {
        return $this->encodeCborHeader($Silian_majorType, strlen($Silian_payload)) . $Silian_payload;
    }

    private function encodeCborHeader(int $Silian_majorType, int $Silian_value): string
    {
        if ($Silian_value < 24) {
            return chr(($Silian_majorType << 5) | $Silian_value);
        }

        if ($Silian_value < 256) {
            return chr(($Silian_majorType << 5) | 24) . chr($Silian_value);
        }

        if ($Silian_value < 65536) {
            return chr(($Silian_majorType << 5) | 25) . pack('n', $Silian_value);
        }

        return chr(($Silian_majorType << 5) | 26) . pack('N', $Silian_value);
    }
}
