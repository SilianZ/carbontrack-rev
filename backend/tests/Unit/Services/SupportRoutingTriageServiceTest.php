<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Services\Ai\LlmClientInterface;
use CarbonTrack\Services\SupportRoutingTriageService;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

class SupportRoutingTriageServiceTest extends TestCase
{
    public function testFallsBackWhenAiIsDisabled(): void
    {
        $Silian_service = new SupportRoutingTriageService(
            null,
            $this->createMock(LoggerInterface::class)
        );

        $Silian_result = $Silian_service->triage([
            'id' => 11,
            'priority' => 'high',
        ], [
            'ai_enabled' => false,
            'group_routing' => ['min_agent_level' => 2],
        ]);

        $this->assertFalse($Silian_result['used_ai']);
        $this->assertSame('ai_disabled', $Silian_result['fallback_reason']);
        $this->assertSame('high', $Silian_result['triage']['severity']);
        $this->assertSame(3, $Silian_result['triage']['required_agent_level']);
    }

    public function testParsesJsonResponseFromLlm(): void
    {
        $Silian_client = $this->createMock(LlmClientInterface::class);
        $Silian_client->expects($this->once())
            ->method('createChatCompletion')
            ->willReturn([
                'model' => 'test-model',
                'choices' => [[
                    'message' => [
                        'content' => json_encode([
                            'severity' => 'critical',
                            'escalation_risk' => 'high',
                            'required_agent_level' => 5,
                            'suggested_skills' => ['billing', 'vip'],
                            'language' => 'zh-CN',
                            'confidence' => 0.92,
                            'summary' => 'VIP escalation',
                        ], JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES),
                    ],
                ]],
            ]);

        $Silian_service = new SupportRoutingTriageService(
            $Silian_client,
            $this->createMock(LoggerInterface::class)
        );

        $Silian_result = $Silian_service->triage([
            'id' => 22,
            'subject' => 'VIP complaint',
            'priority' => 'urgent',
        ], [
            'ai_enabled' => true,
            'group_routing' => ['min_agent_level' => 2],
            'message_body' => 'I want this escalated now',
        ]);

        $this->assertTrue($Silian_result['used_ai']);
        $this->assertNull($Silian_result['fallback_reason']);
        $this->assertSame('critical', $Silian_result['triage']['severity']);
        $this->assertSame(5, $Silian_result['triage']['required_agent_level']);
        $this->assertSame(['billing', 'vip'], $Silian_result['triage']['suggested_skills']);
    }
}
