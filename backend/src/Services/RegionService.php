<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Support\SyntheticRequestFactory;
use Monolog\Logger;

/**
 * Lightweight helper providing country/state lookups and validation backed by the shared states.json dataset.
 */
class RegionService
{
    private const DEFAULT_SEPARATOR = ' · ';
    private const COUNTRY_CODE_PATTERN = '/^[A-Z]{2}$/';
    private const STATE_CODE_PATTERN = '/^(?=.{1,10}$)[A-Z0-9]+(?:-[A-Z0-9]+)*$/';

    private array $countries = [];
    private ?Logger $logger;
    private string $datasetPath;
    private ?AuditLogService $auditLogService;
    private ?ErrorLogService $errorLogService;

    public function __construct(
        ?string $Silian_datasetPath = null,
        ?Logger $Silian_logger = null,
        ?AuditLogService $Silian_auditLogService = null,
        ?ErrorLogService $Silian_errorLogService = null
    )
    {
        $Silian_projectRoot = dirname(__DIR__, 3);
        $Silian_backendRoot = dirname(__DIR__, 2);
        $Silian_defaultPath = $Silian_projectRoot . DIRECTORY_SEPARATOR . 'frontend' . DIRECTORY_SEPARATOR . 'public'
            . DIRECTORY_SEPARATOR . 'locales' . DIRECTORY_SEPARATOR . 'states.json';

        $Silian_configured = trim((string) ($_ENV['REGION_DATA_PATH'] ?? ''));
        if ($Silian_configured !== '') {
            $this->datasetPath = $this->normalizePath($Silian_configured, $Silian_projectRoot, $Silian_backendRoot);
        } elseif ($Silian_datasetPath !== null && $Silian_datasetPath !== '') {
            $this->datasetPath = $this->normalizePath($Silian_datasetPath, $Silian_projectRoot, $Silian_backendRoot);
        } else {
            $this->datasetPath = $Silian_defaultPath;
        }

        $this->logger = $Silian_logger;
        $this->auditLogService = $Silian_auditLogService;
        $this->errorLogService = $Silian_errorLogService;
        $this->hydrateDataset();
    }

    public function isReady(): bool
    {
        return !empty($this->countries);
    }

    public function normalizeCountryCode(?string $Silian_code): ?string
    {
        if (!is_string($Silian_code)) {
            return null;
        }
        $Silian_code = strtoupper(trim($Silian_code));
        if ($Silian_code === '') {
            return null;
        }
        if (!empty($this->countries)) {
            return isset($this->countries[$Silian_code]) ? $Silian_code : null;
        }

        return preg_match(self::COUNTRY_CODE_PATTERN, $Silian_code) === 1 ? $Silian_code : null;
    }

    public function normalizeStateCode(?string $Silian_code): ?string
    {
        if (!is_string($Silian_code)) {
            return null;
        }
        $Silian_code = strtoupper(trim(str_replace([' ', '.'], '', $Silian_code)));
        if ($Silian_code === '') {
            return null;
        }

        return preg_match(self::STATE_CODE_PATTERN, $Silian_code) === 1 ? $Silian_code : null;
    }

    public function buildRegionCode(string $Silian_countryCode, string $Silian_stateCode): string
    {
        return sprintf('%s-%s', strtoupper($Silian_countryCode), strtoupper($Silian_stateCode));
    }

    public function parseRegionCode(?string $Silian_regionCode): ?array
    {
        if (!is_string($Silian_regionCode) || trim($Silian_regionCode) === '') {
            return null;
        }
        $Silian_normalized = strtoupper(trim($Silian_regionCode));
        $Silian_separatorPosition = strpos($Silian_normalized, '-');
        if ($Silian_separatorPosition === false) {
            return null;
        }

        $Silian_country = substr($Silian_normalized, 0, $Silian_separatorPosition);
        $Silian_state = substr($Silian_normalized, $Silian_separatorPosition + 1);
        $Silian_country = $this->normalizeCountryCode($Silian_country);
        $Silian_state = $this->normalizeStateCode($Silian_state);
        if ($Silian_country === null || $Silian_state === null) {
            return null;
        }

        return [
            'country_code' => $Silian_country,
            'state_code' => $Silian_state,
        ];
    }

    public function isValidRegion(?string $Silian_countryCode, ?string $Silian_stateCode): bool
    {
        $Silian_country = $this->normalizeCountryCode($Silian_countryCode);
        if ($Silian_country === null) {
            return false;
        }
        $Silian_state = $this->normalizeStateCode($Silian_stateCode);
        if ($Silian_state === null) {
            return false;
        }
        if (empty($this->countries)) {
            return true;
        }
        return isset($this->countries[$Silian_country]['states'][$Silian_state]);
    }

    public function getRegionContext(?string $Silian_regionCode): ?array
    {
        $Silian_parsed = $this->parseRegionCode($Silian_regionCode);
        if (!$Silian_parsed) {
            return null;
        }

        $Silian_countryCode = $Silian_parsed['country_code'];
        $Silian_stateCode = $Silian_parsed['state_code'];
        $Silian_countryName = $this->getCountryName($Silian_countryCode);
        $Silian_stateName = $this->getStateName($Silian_countryCode, $Silian_stateCode);

        return [
            'region_code' => $this->buildRegionCode($Silian_countryCode, $Silian_stateCode),
            'country_code' => $Silian_countryCode,
            'state_code' => $Silian_stateCode,
            'country_name' => $Silian_countryName,
            'state_name' => $Silian_stateName,
            'region_label' => $this->getRegionLabel($Silian_regionCode),
        ];
    }

    public function getCountryName(?string $Silian_countryCode): ?string
    {
        $Silian_code = $this->normalizeCountryCode($Silian_countryCode);
        return $Silian_code !== null ? ($this->countries[$Silian_code]['name'] ?? null) : null;
    }

    public function getStateName(?string $Silian_countryCode, ?string $Silian_stateCode): ?string
    {
        $Silian_country = $this->normalizeCountryCode($Silian_countryCode);
        if ($Silian_country === null) {
            return null;
        }
        $Silian_state = $this->normalizeStateCode($Silian_stateCode);
        if ($Silian_state === null) {
            return null;
        }
        return $this->countries[$Silian_country]['states'][$Silian_state]['name'] ?? null;
    }

    public function getRegionLabel(?string $Silian_regionCode, string $Silian_separator = self::DEFAULT_SEPARATOR): ?string
    {
        $Silian_parsed = $this->parseRegionCode($Silian_regionCode);
        if (!$Silian_parsed) {
            return null;
        }
        $Silian_country = $this->getCountryName($Silian_parsed['country_code']);
        $Silian_state = $this->getStateName($Silian_parsed['country_code'], $Silian_parsed['state_code']);
        if ($Silian_country === null && $Silian_state === null) {
            return null;
        }
        if ($Silian_country !== null && $Silian_state !== null) {
            return $Silian_country . $Silian_separator . $Silian_state;
        }
        return $Silian_country ?? $Silian_state;
    }

    private function hydrateDataset(): void
    {
        $Silian_path = $this->datasetPath;
        if (!is_file($Silian_path)) {
            $this->logDatasetIssue('region_dataset_missing', 'Region dataset not found', ['path' => $Silian_path]);
            $this->log('warning', 'Region dataset not found', ['path' => $Silian_path]);
            return;
        }

        $Silian_contents = @file_get_contents($Silian_path);
        if ($Silian_contents === false) {
            $this->logDatasetIssue('region_dataset_unreadable', 'Unable to read region dataset', ['path' => $Silian_path]);
            $this->log('warning', 'Unable to read region dataset', ['path' => $Silian_path]);
            return;
        }

        $Silian_decoded = json_decode($Silian_contents, true);
        if (!is_array($Silian_decoded)) {
            $this->logDatasetIssue('region_dataset_decode_failed', 'Unable to decode region dataset', ['path' => $Silian_path]);
            $this->log('warning', 'Unable to decode region dataset', ['path' => $Silian_path]);
            return;
        }

        foreach ($Silian_decoded as $Silian_country) {
            if (!is_array($Silian_country)) {
                continue;
            }
            $Silian_code = isset($Silian_country['iso2']) ? strtoupper(trim((string) $Silian_country['iso2'])) : null;
            $Silian_name = isset($Silian_country['name']) ? trim((string) $Silian_country['name']) : null;
            if (!$Silian_code || !$Silian_name) {
                continue;
            }

            $Silian_states = [];
            if (!empty($Silian_country['states']) && is_array($Silian_country['states'])) {
                foreach ($Silian_country['states'] as $Silian_state) {
                    if (!is_array($Silian_state)) {
                        continue;
                    }
                    $Silian_stateCode = isset($Silian_state['state_code']) ? strtoupper(trim((string) $Silian_state['state_code'])) : null;
                    $Silian_stateName = isset($Silian_state['name']) ? trim((string) $Silian_state['name']) : null;
                    if (!$Silian_stateCode || !$Silian_stateName) {
                        continue;
                    }
                    $Silian_states[$Silian_stateCode] = [
                        'code' => $Silian_stateCode,
                        'name' => $Silian_stateName,
                    ];
                }
            }

            if (empty($Silian_states)) {
                continue;
            }

            $this->countries[$Silian_code] = [
                'code' => $Silian_code,
                'name' => $Silian_name,
                'states' => $Silian_states,
            ];
        }

        if (empty($this->countries)) {
            $this->logDatasetIssue('region_dataset_empty', 'Region dataset parsed but no usable countries were found', ['path' => $Silian_path]);
            $this->log('warning', 'Region dataset parsed but no usable countries were found', ['path' => $Silian_path]);
        }
    }

    private function normalizePath(string $Silian_path, string $Silian_projectRoot, string $Silian_backendRoot): string
    {
        if ($Silian_path[0] === '/' || $Silian_path[0] === '\\' || preg_match('/^[A-Za-z]:[\\\\\\/]/', $Silian_path)) {
            return $Silian_path;
        }

        $Silian_trimmed = ltrim($Silian_path, "/\\");
        $Silian_normalized = str_replace(['/', '\\'], DIRECTORY_SEPARATOR, $Silian_trimmed);

        $Silian_projectResolved = rtrim($Silian_projectRoot, "/\\") . DIRECTORY_SEPARATOR . $Silian_normalized;
        if (is_file($Silian_projectResolved)) {
            return $Silian_projectResolved;
        }

        $Silian_backendResolved = rtrim($Silian_backendRoot, "/\\") . DIRECTORY_SEPARATOR . $Silian_normalized;
        if (is_file($Silian_backendResolved)) {
            return $Silian_backendResolved;
        }

        return $Silian_projectResolved;
    }

    private function log(string $Silian_level, string $Silian_message, array $Silian_context = []): void
    {
        if (!$this->logger) {
            return;
        }
        try {
            $this->logger->log($Silian_level, $Silian_message, $Silian_context);
        } catch (\Throwable $Silian_ignore) {
            // suppress logging failures
        }
    }

    private function logDatasetIssue(string $Silian_action, string $Silian_message, array $Silian_context): void
    {
        if ($this->auditLogService !== null) {
            try {
                $this->auditLogService->log([
                    'action' => $Silian_action,
                    'operation_category' => 'system',
                    'actor_type' => 'system',
                    'status' => 'failed',
                    'data' => $Silian_context,
                ]);
            } catch (\Throwable $Silian_ignore) {
                // ignore audit failures for region service
            }
        }

        if ($this->errorLogService === null) {
            return;
        }

        try {
            $Silian_request = SyntheticRequestFactory::fromContext('/internal/regions/dataset', 'GET', null, $Silian_context);
            $this->errorLogService->logError('RegionDatasetError', $Silian_message, $Silian_request, $Silian_context);
        } catch (\Throwable $Silian_ignore) {
            // ignore error log failures for region service
        }
    }
}
