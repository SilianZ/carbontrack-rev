<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\AdminAiResultFormatterService;
use PHPUnit\Framework\TestCase;

class AdminAiResultFormatterServiceTest extends TestCase
{
    public function testBuildProposalSummaryIncludesKeyMutationFields(): void
    {
        $Silian_service = new AdminAiResultFormatterService();

        $Silian_summary = $Silian_service->buildProposalSummary(
            ['label' => '调整积分'],
            [
                'user_id' => 42,
                'delta' => 25,
                'reason' => 'manual compensation',
            ]
        );

        $this->assertStringContainsString('调整积分', $Silian_summary);
        $this->assertStringContainsString('用户 #42', $Silian_summary);
        $this->assertStringContainsString('积分变动 25', $Silian_summary);
        $this->assertStringContainsString('原因：manual compensation', $Silian_summary);
    }

    public function testFormatWriteActionResultSummarizesInventoryChange(): void
    {
        $Silian_service = new AdminAiResultFormatterService();

        $Silian_message = $Silian_service->formatWriteActionResult('adjust_product_inventory', [
            'product' => ['name' => 'Eco Bottle'],
            'old_stock' => 12,
            'new_stock' => 20,
        ]);

        $this->assertSame('商品 Eco Bottle 库存已从 12 调整到 20。', $Silian_message);
    }
}
