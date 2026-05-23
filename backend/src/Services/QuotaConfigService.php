<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

class QuotaConfigService
{
    public function getQuotaDefinitions(): array
    {
        static $Silian_definitions = null;
        if ($Silian_definitions !== null) {
            return $Silian_definitions;
        }

        $Silian_raw = $_ENV['QUOTA_DEFINITIONS'] ?? getenv('QUOTA_DEFINITIONS') ?: '';
        $Silian_definitions = array_values(array_filter(array_map('trim', explode(',', $Silian_raw)), 'strlen'));
        return $Silian_definitions;
    }

    public function decodeJsonToArray($Silian_value): ?array
    {
        if (is_array($Silian_value)) {
            return $Silian_value;
        }
        if (!is_string($Silian_value)) {
            return null;
        }
        $Silian_trimmed = trim($Silian_value);
        if ($Silian_trimmed === '') {
            return null;
        }
        $Silian_decoded = json_decode($Silian_trimmed, true);
        if (is_array($Silian_decoded)) {
            return $Silian_decoded;
        }
        if (is_string($Silian_decoded)) {
            $Silian_decodedAgain = json_decode($Silian_decoded, true);
            return is_array($Silian_decodedAgain) ? $Silian_decodedAgain : null;
        }
        return null;
    }

    public function flattenQuotas(?array $Silian_json): array
    {
        $Silian_json = $this->normalizeQuotaConfig($Silian_json);
        $Silian_flat = [];
        foreach ($this->getQuotaDefinitions() as $Silian_key) {
            $Silian_parts = explode('.', $Silian_key);
            $Silian_value = $Silian_json;
            foreach ($Silian_parts as $Silian_part) {
                if (is_array($Silian_value) && array_key_exists($Silian_part, $Silian_value)) {
                    $Silian_value = $Silian_value[$Silian_part];
                } else {
                    $Silian_value = null;
                    break;
                }
            }
            $Silian_flat[$Silian_key] = $Silian_value;
        }
        return $Silian_flat;
    }

    public function unflattenQuotas(array $Silian_flat, ?array $Silian_currentJson): array
    {
        $Silian_result = $this->normalizeQuotaConfig($Silian_currentJson);

        foreach ($Silian_flat as $Silian_dotKey => $Silian_value) {
            if (!in_array($Silian_dotKey, $this->getQuotaDefinitions(), true)) {
                continue;
            }

            $Silian_parts = explode('.', $Silian_dotKey);
            $Silian_temp = &$Silian_result;

            foreach ($Silian_parts as $Silian_i => $Silian_part) {
                if ($Silian_i === count($Silian_parts) - 1) {
                    if ($Silian_value === '' || $Silian_value === null) {
                        unset($Silian_temp[$Silian_part]);
                    } else {
                        $Silian_temp[$Silian_part] = is_numeric($Silian_value) ? (int) $Silian_value : $Silian_value;
                    }
                } else {
                    if (!isset($Silian_temp[$Silian_part]) || !is_array($Silian_temp[$Silian_part])) {
                        $Silian_temp[$Silian_part] = [];
                    }
                    $Silian_temp = &$Silian_temp[$Silian_part];
                }
            }
        }

        return $Silian_result;
    }

    public function normalizeQuotaConfig(?array $Silian_config): array
    {
        $Silian_normalized = $Silian_config ?? [];

        foreach ($this->getQuotaDefinitions() as $Silian_dotKey) {
            if (!array_key_exists($Silian_dotKey, $Silian_normalized)) {
                continue;
            }
            $Silian_value = $Silian_normalized[$Silian_dotKey];
            unset($Silian_normalized[$Silian_dotKey]);

            $Silian_parts = explode('.', $Silian_dotKey);
            $Silian_temp = &$Silian_normalized;
            foreach ($Silian_parts as $Silian_i => $Silian_part) {
                if ($Silian_i === count($Silian_parts) - 1) {
                    $Silian_temp[$Silian_part] = $Silian_value;
                } else {
                    if (!isset($Silian_temp[$Silian_part]) || !is_array($Silian_temp[$Silian_part])) {
                        $Silian_temp[$Silian_part] = [];
                    }
                    $Silian_temp = &$Silian_temp[$Silian_part];
                }
            }
        }

        return $Silian_normalized;
    }
}
