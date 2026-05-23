<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

class UserProfileViewService
{
    public function __construct(private RegionService $regionService)
    {
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function buildProfileFields(array $Silian_row): array
    {
        return array_merge(
            $this->buildSchoolFields($Silian_row),
            $this->buildRegionFields($Silian_row)
        );
    }

    /**
     * @param array<string, mixed> $row
     * @param array<string, mixed>|null $profileFields
     * @return array<string, mixed>
     */
    public function buildLegacyDisplayFields(array $Silian_row, ?array $Silian_profileFields = null): array
    {
        $Silian_profileFields ??= $this->buildProfileFields($Silian_row);
        $Silian_legacySchool = $this->normalizeText($Silian_row['school'] ?? null);
        $Silian_legacyLocation = $this->normalizeText($Silian_row['location'] ?? null);

        return [
            'school' => $Silian_profileFields['school_name'] ?? $Silian_legacySchool,
            'location' => $Silian_profileFields['region_label']
                ?? $Silian_profileFields['region_code']
                ?? $Silian_legacyLocation,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function buildSchoolFields(array $Silian_row): array
    {
        $Silian_schoolId = $this->normalizeSchoolId($Silian_row['school_id'] ?? null);
        $Silian_joinedSchoolName = $this->normalizeText($Silian_row['school_name'] ?? null);
        $Silian_legacySchoolName = $this->normalizeText($Silian_row['school'] ?? null);

        $Silian_schoolName = $Silian_joinedSchoolName ?? $Silian_legacySchoolName;

        return [
            'school_id' => $Silian_schoolId,
            'school_name' => $Silian_schoolName,
        ];
    }

    /**
     * @param array<string, mixed> $row
     * @return array<string, mixed>
     */
    public function buildRegionFields(array $Silian_row): array
    {
        $Silian_storedRegionCode = $this->normalizeText($Silian_row['region_code'] ?? null);
        $Silian_legacyLocation = $this->normalizeText($Silian_row['location'] ?? null);

        $Silian_resolved = $this->resolveCompatibleRegion($Silian_storedRegionCode)
            ?? $this->resolveCompatibleRegion($Silian_legacyLocation);

        if ($Silian_resolved !== null) {
            return $Silian_resolved;
        }

        return [
            'region_code' => $Silian_storedRegionCode ?? $Silian_legacyLocation,
            'region_label' => null,
            'country_code' => null,
            'state_code' => null,
            'country_name' => null,
            'state_name' => null,
        ];
    }

    /**
     * @return array<string, mixed>|null
     */
    private function resolveCompatibleRegion(?string $Silian_value): ?array
    {
        if ($Silian_value === null) {
            return null;
        }

        return $this->regionService->getRegionContext($Silian_value);
    }

    private function normalizeText(mixed $Silian_value): ?string
    {
        if ($Silian_value === null) {
            return null;
        }

        $Silian_text = trim((string) $Silian_value);
        return $Silian_text === '' ? null : $Silian_text;
    }

    private function normalizeSchoolId(mixed $Silian_value): ?int
    {
        if (!is_numeric($Silian_value)) {
            return null;
        }

        $Silian_schoolId = (int) $Silian_value;
        return $Silian_schoolId > 0 ? $Silian_schoolId : null;
    }
}
