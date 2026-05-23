<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Models\UserGroup;
use CarbonTrack\Services\QuotaConfigService;
use CarbonTrack\Services\UserGroupService;
use PHPUnit\Framework\TestCase;

class UserGroupServiceTest extends TestCase
{
    public function testPreparePayloadNormalizesDefaultFlagFromStringInputs(): void
    {
        $Silian_service = new UserGroupService(new QuotaConfigService());
        $Silian_method = new \ReflectionMethod($Silian_service, 'preparePayload');
        $Silian_method->setAccessible(true);

        $Silian_normalizedFalse = $Silian_method->invoke($Silian_service, [
            'name' => 'Standard',
            'code' => 'standard',
            'is_default' => '',
        ], null);
        $Silian_normalizedTrue = $Silian_method->invoke($Silian_service, [
            'name' => 'VIP',
            'code' => 'vip',
            'is_default' => '1',
        ], null);
        $Silian_normalizedIndeterminate = $Silian_method->invoke($Silian_service, [
            'name' => 'Draft',
            'code' => 'draft',
            'is_default' => 'indeterminate',
        ], null);

        $this->assertArrayHasKey('is_default', $Silian_normalizedFalse);
        $this->assertFalse($Silian_normalizedFalse['is_default']);
        $this->assertTrue($Silian_normalizedTrue['is_default']);
        $this->assertFalse($Silian_normalizedIndeterminate['is_default']);
    }

    public function testPreparePayloadRejectsInvalidDefaultFlag(): void
    {
        $Silian_service = new UserGroupService(new QuotaConfigService());
        $Silian_method = new \ReflectionMethod($Silian_service, 'preparePayload');
        $Silian_method->setAccessible(true);

        $this->expectException(\InvalidArgumentException::class);
        $this->expectExceptionMessage('is_default must be a boolean');

        $Silian_method->invoke($Silian_service, [
            'name' => 'Broken',
            'code' => 'broken',
            'is_default' => 'maybe',
        ], null);
    }

    public function testPreparePayloadMergesSupportRoutingIntoConfigAndClampsValues(): void
    {
        $Silian_service = new UserGroupService(new QuotaConfigService());
        $Silian_method = new \ReflectionMethod($Silian_service, 'preparePayload');
        $Silian_method->setAccessible(true);

        $Silian_payload = $Silian_method->invoke($Silian_service, [
            'name' => 'Support',
            'code' => 'support',
            'support_routing' => [
                'first_response_minutes' => '0',
                'resolution_minutes' => '2880',
                'routing_weight' => '0.05',
                'min_agent_level' => '9',
                'overdue_boost' => '-2',
                'tier_label' => '  escalated  ',
            ],
        ], [
            'quotas' => ['daily' => 5],
        ]);

        $this->assertSame(['daily' => 5], $Silian_payload['config']['quotas']);
        $this->assertSame([
            'first_response_minutes' => 1,
            'resolution_minutes' => 2880,
            'routing_weight' => 0.1,
            'min_agent_level' => 5,
            'overdue_boost' => 0.0,
            'tier_label' => 'escalated',
        ], $Silian_payload['config']['support_routing']);
    }

    public function testPreparePayloadFallsBackToDefaultsForInvalidSupportRoutingTypes(): void
    {
        $Silian_service = new UserGroupService(new QuotaConfigService());
        $Silian_method = new \ReflectionMethod($Silian_service, 'preparePayload');
        $Silian_method->setAccessible(true);

        $Silian_payload = $Silian_method->invoke($Silian_service, [
            'name' => 'Fallback',
            'code' => 'fallback',
            'support_routing' => [
                'first_response_minutes' => 'soon',
                'resolution_minutes' => [],
                'routing_weight' => 'heavy',
                'min_agent_level' => 2.5,
                'overdue_boost' => new \stdClass(),
                'tier_label' => '   ',
            ],
        ], null);

        $this->assertSame([
            'first_response_minutes' => 240,
            'resolution_minutes' => 1440,
            'routing_weight' => 1.0,
            'min_agent_level' => 1,
            'overdue_boost' => 1.0,
            'tier_label' => 'standard',
        ], $Silian_payload['config']['support_routing']);
    }

    public function testFormatGroupHandlesMissingConfigWithoutNullOffset(): void
    {
        $Silian_service = new UserGroupService(new QuotaConfigService());
        $Silian_method = new \ReflectionMethod($Silian_service, 'formatGroup');
        $Silian_method->setAccessible(true);

        $Silian_group = new UserGroup([
            'id' => 1,
            'name' => 'Default',
            'code' => 'default',
            'config' => null,
        ]);

        $Silian_formatted = $Silian_method->invoke($Silian_service, $Silian_group);

        $this->assertNull($Silian_formatted['config']);
        $this->assertIsArray($Silian_formatted['quota_flat']);
        $this->assertSame([
            'first_response_minutes' => 240,
            'resolution_minutes' => 1440,
            'routing_weight' => 1.0,
            'min_agent_level' => 1,
            'overdue_boost' => 1.0,
            'tier_label' => 'standard',
        ], $Silian_formatted['support_routing']);
    }
}
