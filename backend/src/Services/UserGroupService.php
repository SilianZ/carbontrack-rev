<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use CarbonTrack\Models\UserGroup;
use CarbonTrack\Support\InputValueNormalizer;

class UserGroupService
{
    private const SUPPORT_ROUTING_FIELDS = [
        [
            'key' => 'first_response_minutes',
            'type' => 'number',
            'min' => 1,
            'step' => 1,
            'default' => 240,
            'label_key' => 'admin.groups.supportFirstResponseMinutes',
        ],
        [
            'key' => 'resolution_minutes',
            'type' => 'number',
            'min' => 1,
            'step' => 1,
            'default' => 1440,
            'label_key' => 'admin.groups.supportResolutionMinutes',
        ],
        [
            'key' => 'routing_weight',
            'type' => 'number',
            'min' => 0.1,
            'step' => 0.1,
            'default' => 1,
            'label_key' => 'admin.groups.supportRoutingWeight',
        ],
        [
            'key' => 'min_agent_level',
            'type' => 'number',
            'min' => 1,
            'max' => 5,
            'step' => 1,
            'default' => 1,
            'label_key' => 'admin.groups.supportMinAgentLevel',
        ],
        [
            'key' => 'overdue_boost',
            'type' => 'number',
            'min' => 0,
            'step' => 0.1,
            'default' => 1,
            'label_key' => 'admin.groups.supportOverdueBoost',
        ],
        [
            'key' => 'tier_label',
            'type' => 'text',
            'default' => 'standard',
            'label_key' => 'admin.groups.supportTierLabel',
        ],
    ];

    public function __construct(
        private QuotaConfigService $quotaConfigService
    ) {}

    public function getAllGroups()
    {
        return UserGroup::orderBy('id', 'asc')
            ->get()
            ->map(fn (UserGroup $Silian_group) => $this->formatGroup($Silian_group))
            ->values()
            ->all();
    }

    public function getGroupById(int $Silian_id)
    {
        $Silian_group = UserGroup::find($Silian_id);
        return $Silian_group ? $this->formatGroup($Silian_group) : null;
    }

    public function createGroup(array $Silian_data)
    {
        $Silian_payload = $this->preparePayload($Silian_data, null);
        $Silian_group = UserGroup::create($Silian_payload);
        return $this->formatGroup($Silian_group);
    }

    public function updateGroup(int $Silian_id, array $Silian_data)
    {
        $Silian_group = UserGroup::findOrFail($Silian_id);
        $Silian_payload = $this->preparePayload($Silian_data, $Silian_group->config);
        $Silian_group->update($Silian_payload);
        return $this->formatGroup($Silian_group->fresh());
    }

    public function deleteGroup(int $Silian_id)
    {
        $Silian_group = UserGroup::findOrFail($Silian_id);
        $Silian_group->delete();
    }

    public function getQuotaDefinitions(): array
    {
        return $this->quotaConfigService->getQuotaDefinitions();
    }

    public function getSupportRoutingFieldDefinitions(): array
    {
        return self::SUPPORT_ROUTING_FIELDS;
    }

    public function getSupportRoutingDefaults(): array
    {
        $Silian_defaults = [];
        foreach (self::SUPPORT_ROUTING_FIELDS as $Silian_field) {
            $Silian_defaults[$Silian_field['key']] = $Silian_field['default'] ?? null;
        }
        return $Silian_defaults;
    }

    private function formatGroup(UserGroup $Silian_group): array
    {
        $Silian_data = $Silian_group->toArray();
        $Silian_config = $this->quotaConfigService->decodeJsonToArray($Silian_data['config'] ?? null);
        $Silian_normalized = $Silian_config === null ? null : $this->quotaConfigService->normalizeQuotaConfig($Silian_config);
        $Silian_data['config'] = $Silian_normalized;
        $Silian_fullConfig = is_array($Silian_normalized) ? $Silian_normalized : [];
        $Silian_quotaConfig = $Silian_fullConfig;
        unset($Silian_quotaConfig['support_routing']);
        $Silian_data['quota_flat'] = $this->quotaConfigService->flattenQuotas($Silian_quotaConfig);
        $Silian_data['support_routing'] = $this->normalizeSupportRouting($Silian_fullConfig['support_routing'] ?? null);
        return $Silian_data;
    }

    private function preparePayload(array $Silian_data, $Silian_currentConfig): array
    {
        $Silian_payload = $Silian_data;
        unset($Silian_payload['quota_flat']);
        unset($Silian_payload['support_routing']);

        if (array_key_exists('is_default', $Silian_payload)) {
            $Silian_payload['is_default'] = $this->normalizeBooleanValue($Silian_payload['is_default']);
        }

        $Silian_config = $this->quotaConfigService->decodeJsonToArray($Silian_data['config'] ?? null);
        $Silian_current = $this->quotaConfigService->decodeJsonToArray($Silian_currentConfig);

        if (isset($Silian_data['quota_flat']) && is_array($Silian_data['quota_flat'])) {
            $Silian_base = $Silian_config ?? $Silian_current ?? [];
            $Silian_config = $this->quotaConfigService->unflattenQuotas($Silian_data['quota_flat'], $Silian_base);
        }

        if (array_key_exists('support_routing', $Silian_data)) {
            $Silian_base = $Silian_config ?? $Silian_current ?? [];
            $Silian_base['support_routing'] = $this->normalizeSupportRouting($Silian_data['support_routing']);
            $Silian_config = $Silian_base;
        }

        if ($Silian_config !== null) {
            $Silian_payload['config'] = $this->quotaConfigService->normalizeQuotaConfig($Silian_config);
        }

        return $Silian_payload;
    }

    private function normalizeBooleanValue(mixed $Silian_value, bool $Silian_default = false): bool
    {
        if (is_string($Silian_value)) {
            $Silian_trimmed = trim($Silian_value);
            if ($Silian_trimmed === '' || strtolower($Silian_trimmed) === 'indeterminate') {
                return $Silian_default;
            }
        }

        return InputValueNormalizer::boolean($Silian_value, 'is_default', $Silian_default);
    }

    private function normalizeSupportRouting(mixed $Silian_value): array
    {
        $Silian_routing = is_array($Silian_value) ? $Silian_value : [];
        $Silian_defaults = $this->getSupportRoutingDefaults();

        return [
            'first_response_minutes' => $this->normalizeSupportRoutingInteger($Silian_routing, 'first_response_minutes', (int) ($Silian_defaults['first_response_minutes'] ?? 240), 1),
            'resolution_minutes' => $this->normalizeSupportRoutingInteger($Silian_routing, 'resolution_minutes', (int) ($Silian_defaults['resolution_minutes'] ?? 1440), 1),
            'routing_weight' => $this->normalizeSupportRoutingFloat($Silian_routing, 'routing_weight', (float) ($Silian_defaults['routing_weight'] ?? 1.0), 0.1),
            'min_agent_level' => $this->normalizeSupportRoutingInteger($Silian_routing, 'min_agent_level', (int) ($Silian_defaults['min_agent_level'] ?? 1), 1, 5),
            'overdue_boost' => $this->normalizeSupportRoutingFloat($Silian_routing, 'overdue_boost', (float) ($Silian_defaults['overdue_boost'] ?? 1.0), 0.0),
            'tier_label' => $this->normalizeSupportRoutingLabel($Silian_routing['tier_label'] ?? ($Silian_defaults['tier_label'] ?? 'standard')),
        ];
    }

    /**
     * @param array<string,mixed> $routing
     */
    private function normalizeSupportRoutingInteger(
        array $Silian_routing,
        string $Silian_field,
        int $Silian_default,
        int $Silian_min,
        ?int $Silian_max = null
    ): int {
        if (!array_key_exists($Silian_field, $Silian_routing) || $Silian_routing[$Silian_field] === null || $Silian_routing[$Silian_field] === '') {
            return $Silian_default;
        }

        try {
            $Silian_normalized = InputValueNormalizer::integer($Silian_routing[$Silian_field], $Silian_field, $Silian_default);
        } catch (\InvalidArgumentException) {
            return $Silian_default;
        }

        if ($Silian_normalized < $Silian_min) {
            $Silian_normalized = $Silian_min;
        }

        if ($Silian_max !== null && $Silian_normalized > $Silian_max) {
            $Silian_normalized = $Silian_max;
        }

        return $Silian_normalized;
    }

    /**
     * @param array<string,mixed> $routing
     */
    private function normalizeSupportRoutingFloat(
        array $Silian_routing,
        string $Silian_field,
        float $Silian_default,
        float $Silian_min,
        ?float $Silian_max = null
    ): float {
        if (!array_key_exists($Silian_field, $Silian_routing) || $Silian_routing[$Silian_field] === null || $Silian_routing[$Silian_field] === '') {
            return $Silian_default;
        }

        $Silian_value = $Silian_routing[$Silian_field];
        if (is_int($Silian_value) || is_float($Silian_value)) {
            $Silian_normalized = (float) $Silian_value;
        } elseif (is_string($Silian_value) && is_numeric(trim($Silian_value))) {
            $Silian_normalized = (float) trim($Silian_value);
        } else {
            return $Silian_default;
        }

        if ($Silian_normalized < $Silian_min) {
            $Silian_normalized = $Silian_min;
        }

        if ($Silian_max !== null && $Silian_normalized > $Silian_max) {
            $Silian_normalized = $Silian_max;
        }

        return $Silian_normalized;
    }

    private function normalizeSupportRoutingLabel(mixed $Silian_value): string
    {
        if (!is_string($Silian_value)) {
            return 'standard';
        }

        $Silian_normalized = trim($Silian_value);
        return $Silian_normalized !== '' ? $Silian_normalized : 'standard';
    }
}
