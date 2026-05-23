<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Models\CarbonActivity;
use CarbonTrack\Support\SyntheticRequestFactory;
use Monolog\Logger;

class CarbonCalculatorService
{
    private ?Logger $logger;
    private ?AuditLogService $auditLogService;
    private ?ErrorLogService $errorLogService;

    public function __construct(?Logger $Silian_logger = null, ?AuditLogService $Silian_auditLogService = null, ?ErrorLogService $Silian_errorLogService = null)
    {
        $this->logger = $Silian_logger;
        $this->auditLogService = $Silian_auditLogService;
        $this->errorLogService = $Silian_errorLogService;
    }

    /**
     * Calculate carbon reduction (for testing)
     */
    public function calculateCarbonReduction(array $Silian_activity, float $Silian_amount): float
    {
        if ($Silian_amount < 0) {
            return 0.0;
        }

        $Silian_carbonFactor = $Silian_activity['carbon_factor'] ?? 0;
        return $Silian_carbonFactor * $Silian_amount;
    }

    /**
     * Calculate points from carbon amount
     */
    public function calculatePoints(float $Silian_carbonAmount, int $Silian_pointsPerKg = 10): int
    {
        return (int) ($Silian_carbonAmount * $Silian_pointsPerKg);
    }

    /**
     * Validate activity data for create/update flows.
     */
    public function validateActivityData(array $Silian_activity, bool $Silian_isUpdate = false): bool
    {
        $Silian_required = ['name_zh', 'name_en', 'carbon_factor', 'unit', 'category'];
        $Silian_allowed = array_merge($Silian_required, ['description_zh', 'description_en', 'icon', 'is_active', 'sort_order']);

        // Ensure at least one recognised field is present for updates
        if ($Silian_isUpdate) {
            $Silian_presentKeys = array_intersect(array_keys($Silian_activity), $Silian_allowed);
            if (empty($Silian_presentKeys)) {
                return false;
            }
        }

        foreach ($Silian_required as $Silian_field) {
            if ($Silian_isUpdate && !array_key_exists($Silian_field, $Silian_activity)) {
                continue;
            }

            if ($this->isBlank($Silian_activity[$Silian_field] ?? null)) {
                return false;
            }
        }

        if (array_key_exists('carbon_factor', $Silian_activity)) {
            if (!is_numeric($Silian_activity['carbon_factor'])) {
                return false;
            }

            if ((float) $Silian_activity['carbon_factor'] < 0) {
                return false;
            }
        }

        if (array_key_exists('sort_order', $Silian_activity) && !is_numeric($Silian_activity['sort_order'])) {
            return false;
        }

        if (array_key_exists('is_active', $Silian_activity)) {
            $Silian_value = $Silian_activity['is_active'];
            if (!is_bool($Silian_value) && !in_array($Silian_value, [0, 1, '0', '1', 'true', 'false', 'on', 'off', 'yes', 'no'], true)) {
                return false;
            }
        }

        return true;
    }

    /**
     * Validate amount
     */
    public function validateAmount(float $Silian_amount): bool
    {
        return $Silian_amount >= 0;
    }

    /**
     * Get supported units
     */
    public function getSupportedUnits(): array
    {
        return ['km', 'kg', 'hours', 'times', 'kWh', 'liters', 'days', 'minutes'];
    }

    /**
     * Get carbon factor by category
     */
    public function getCarbonFactorByCategory(string $Silian_category): array
    {
        $Silian_factors = [
            'transport' => [
                'car' => 2.3,
                'bus' => 0.8,
                'bicycle' => 0.0,
                'walking' => 0.0
            ],
            'energy' => [
                'electricity' => 0.5,
                'gas' => 2.0
            ]
        ];

        return $Silian_factors[$Silian_category] ?? [];
    }

    /**
     * Convert units
     */
    public function convertUnits(float $Silian_value, string $Silian_fromUnit, string $Silian_toUnit): float
    {
        $Silian_conversions = [
            'km' => ['m' => 1000],
            'kg' => ['g' => 1000],
        ];

        if ($Silian_fromUnit === $Silian_toUnit) {
            return $Silian_value;
        }

        if (isset($Silian_conversions[$Silian_fromUnit][$Silian_toUnit])) {
            return $Silian_value * $Silian_conversions[$Silian_fromUnit][$Silian_toUnit];
        }

        return $Silian_value; // Return original if conversion not supported
    }

    /**
     * Calculate monthly stats
     */
    public function calculateMonthlyStats(array $Silian_activities): array
    {
        if (empty($Silian_activities)) {
            return [
                'total_carbon_saved' => 0.0,
                'total_points_earned' => 0,
                'total_activities' => 0,
                'average_carbon_per_activity' => 0.0
            ];
        }

        $Silian_totalCarbon = array_sum(array_column($Silian_activities, 'carbon_amount'));
        $Silian_totalPoints = array_sum(array_column($Silian_activities, 'points'));
        $Silian_totalCount = count($Silian_activities);

        return [
            'total_carbon_saved' => $Silian_totalCarbon,
            'total_points_earned' => $Silian_totalPoints,
            'total_activities' => $Silian_totalCount,
            'average_carbon_per_activity' => $Silian_totalCount > 0 ? $Silian_totalCarbon / $Silian_totalCount : 0.0
        ];
    }

    /**
     * Calculate carbon savings for a given activity and data input
     *
     * @param string $activityId UUID of the carbon activity
     * @param float $dataInput Input data (quantity, times, etc.)
     * @return array Result with carbon savings and activity details
     * @throws \InvalidArgumentException If activity not found or invalid
     */
    public function calculateCarbonSavings(string $Silian_activityId, float $Silian_dataInput, ?array $Silian_activity = null): array
    {
        if ($Silian_dataInput < 0) {
            throw new \InvalidArgumentException('Data input cannot be negative');
        }

        $Silian_resolvedActivity = $Silian_activity ?? $this->resolveActivity($Silian_activityId);

        if (!$Silian_resolvedActivity) {
            throw new \InvalidArgumentException('Activity not found');
        }

        $Silian_carbonFactor = $this->extractCarbonFactor($Silian_resolvedActivity);
        $Silian_unit = $Silian_resolvedActivity['unit'] ?? null;
        $Silian_nameZh = $Silian_resolvedActivity['name_zh'] ?? null;
        $Silian_nameEn = $Silian_resolvedActivity['name_en'] ?? null;
        $Silian_combinedName = trim(($Silian_nameZh ?? '') . ' ' . ($Silian_nameEn ?? ''));
        if ($Silian_combinedName === '') {
            $Silian_combinedName = $Silian_nameZh ?? $Silian_nameEn ?? '';
        }

        $Silian_carbonSavings = $Silian_carbonFactor * $Silian_dataInput;
        $Silian_pointsEarned = (int) round($Silian_carbonSavings * 10);

        return [
            'activity_id' => $Silian_activityId,
            'activity_name_zh' => $Silian_nameZh,
            'activity_name_en' => $Silian_nameEn,
            'activity_combined_name' => $Silian_combinedName,
            'category' => $Silian_resolvedActivity['category'] ?? null,
            'carbon_factor' => $Silian_carbonFactor,
            'unit' => $Silian_unit,
            'data_input' => $Silian_dataInput,
            'carbon_savings' => $Silian_carbonSavings,
            'points_earned' => $Silian_pointsEarned,
        ];
    }

    private function resolveActivity(string $Silian_activityId): ?array
    {
        try {
            $Silian_model = CarbonActivity::find($Silian_activityId);
        } catch (\Throwable $Silian_e) {
            $this->logFailure('carbon_activity_resolve_failed', $Silian_e, ['activity_id' => $Silian_activityId], '/internal/carbon-activities/resolve');
            if ($this->logger) {
                $this->logger->warning('Failed to resolve carbon activity', [
                    'activity_id' => $Silian_activityId,
                    'error' => $Silian_e->getMessage(),
                ]);
            }
            $Silian_model = null;
        }

        if (!$Silian_model) {
            return null;
        }

        return [
            'id' => $Silian_model->id,
            'name_zh' => $Silian_model->name_zh,
            'name_en' => $Silian_model->name_en,
            'category' => $Silian_model->category,
            'carbon_factor' => (float) $Silian_model->carbon_factor,
            'unit' => $Silian_model->unit,
        ];
    }

    private function extractCarbonFactor(array $Silian_activity): float
    {
        $Silian_factor = $Silian_activity['carbon_factor'] ?? $Silian_activity['factor'] ?? 0;
        if (!is_numeric($Silian_factor)) {
            return 0.0;
        }

        return (float) $Silian_factor;
    }

    /**
     * Get all available carbon activities
     *
     * @param string|null $category Filter by category
     * @param string|null $search Search term
     * @return array List of activities
     */
    public function getAvailableActivities(
        ?string $Silian_category = null,
        ?string $Silian_search = null,
        bool $Silian_includeInactive = false,
        bool $Silian_includeDeleted = false
    ): array {
        try {
            $Silian_query = $Silian_includeDeleted ? CarbonActivity::withTrashed() : CarbonActivity::query();

            if (!$Silian_includeInactive) {
                $Silian_query->where('is_active', true);
            }

            if ($Silian_category) {
                $Silian_query->where('category', $Silian_category);
            }

            if ($Silian_search) {
                $Silian_query->where(function ($Silian_q) use ($Silian_search) {
                    $Silian_like = '%' . $Silian_search . '%';
                    $Silian_q->where('name_zh', 'LIKE', $Silian_like)
                        ->orWhere('name_en', 'LIKE', $Silian_like)
                        ->orWhere('description_zh', 'LIKE', $Silian_like)
                        ->orWhere('description_en', 'LIKE', $Silian_like);
                });
            }

            return $Silian_query->orderBy('category')
                ->orderBy('sort_order')
                ->orderBy('created_at')
                ->get()
                ->map(function (CarbonActivity $Silian_activity) use ($Silian_includeDeleted) {
                    return [
                        'id' => $Silian_activity->id,
                        'name_zh' => $Silian_activity->name_zh,
                        'name_en' => $Silian_activity->name_en,
                        'combined_name' => $Silian_activity->getCombinedName(),
                        'category' => $Silian_activity->category,
                        'carbon_factor' => (float) $Silian_activity->carbon_factor,
                        'unit' => $Silian_activity->unit,
                        'description_zh' => $Silian_activity->description_zh,
                        'description_en' => $Silian_activity->description_en,
                        'icon' => $Silian_activity->icon,
                        'is_active' => (bool) $Silian_activity->is_active,
                        'sort_order' => (int) $Silian_activity->sort_order,
                        'created_at' => $Silian_activity->created_at,
                        'updated_at' => $Silian_activity->updated_at,
                        'statistics' => null,
                        'deleted_at' => $Silian_includeDeleted ? $Silian_activity->deleted_at : null,
                    ];
                })
                ->toArray();
        } catch (\Exception $Silian_e) {
            $this->logFailure('carbon_activities_query_failed', $Silian_e, [
                'category' => $Silian_category,
                'search' => $Silian_search,
            ], '/internal/carbon-activities/list');
            if ($this->logger) {
                $this->logger->error('Failed to get activities from database', ['error' => $Silian_e->getMessage()]);
            }

            return [];
        }
    }

    /**
     * Get activities grouped by category
     *
     * @return array Activities grouped by category
     */
    public function getActivitiesGroupedByCategory(bool $Silian_includeInactive = false, bool $Silian_includeDeleted = false): array
    {
        $Silian_activities = $this->getAvailableActivities(null, null, $Silian_includeInactive, $Silian_includeDeleted);

        $Silian_grouped = [];
        foreach ($Silian_activities as $Silian_activity) {
            $Silian_category = $Silian_activity['category'] ?? 'uncategorized';

            if (!isset($Silian_grouped[$Silian_category])) {
                $Silian_grouped[$Silian_category] = [
                    'category' => $Silian_category,
                    'count' => 0,
                    'activities' => [],
                ];
            }

            $Silian_grouped[$Silian_category]['activities'][] = $Silian_activity;
            $Silian_grouped[$Silian_category]['count']++;
        }

        return array_values($Silian_grouped);
    }

    /**
     * Get all categories
     *
     * @return array List of categories
     */
    public function getCategories(bool $Silian_includeInactive = false, bool $Silian_includeDeleted = false): array
    {
        try {
            $Silian_query = $Silian_includeDeleted ? CarbonActivity::withTrashed() : CarbonActivity::query();

            if (!$Silian_includeInactive) {
                $Silian_query->where('is_active', true);
            }

            return $Silian_query->whereNotNull('category')
                ->distinct()
                ->orderBy('category')
                ->pluck('category')
                ->filter()
                ->values()
                ->toArray();
        } catch (\Exception $Silian_e) {
            $this->logFailure('carbon_categories_query_failed', $Silian_e, [], '/internal/carbon-activities/categories');
            if ($this->logger) {
                $this->logger->error('Failed to get categories from database', ['error' => $Silian_e->getMessage()]);
            }

            return [];
        }
    }

    private function isBlank($Silian_value): bool
    {
        if ($Silian_value === null) {
            return true;
        }

        if (is_string($Silian_value) && trim($Silian_value) === '') {
            return true;
        }

        return false;
    }

    /**
     * Get activity statistics (stub for tests)
     */
    public function getActivityStatistics(?string $Silian_activityId = null): array
    {
        // Provide a simple stub; tests can mock this method
        return [
            'total_records' => 0,
            'approved_records' => 0,
            'pending_records' => 0,
            'rejected_records' => 0,
        ];
    }

    private function logFailure(string $Silian_action, \Throwable $Silian_e, array $Silian_context, string $Silian_path): void
    {
        if ($this->auditLogService !== null) {
            try {
                $this->auditLogService->log([
                    'action' => $Silian_action,
                    'operation_category' => 'carbon_management',
                    'actor_type' => 'system',
                    'status' => 'failed',
                    'data' => $Silian_context,
                ]);
            } catch (\Throwable $Silian_ignore) {
                // ignore audit failures in calculator service
            }
        }

        if ($this->errorLogService === null) {
            return;
        }

        try {
            $Silian_request = SyntheticRequestFactory::fromContext($Silian_path, 'GET', null, $Silian_context);
            $this->errorLogService->logException($Silian_e, $Silian_request, ['context_message' => $Silian_action] + $Silian_context);
        } catch (\Throwable $Silian_ignore) {
            // ignore error log failures in calculator service
        }
    }
}

