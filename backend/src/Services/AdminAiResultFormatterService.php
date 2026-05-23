<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

class AdminAiResultFormatterService
{
    /**
     * @param array<string,mixed> $definition
     * @param array<string,mixed> $payload
     */
    public function buildProposalSummary(array $Silian_definition, array $Silian_payload): string
    {
        $Silian_label = (string) ($Silian_definition['label'] ?? $Silian_definition['name'] ?? '后台操作');
        $Silian_recordIds = isset($Silian_payload['record_ids']) && is_array($Silian_payload['record_ids']) ? array_values($Silian_payload['record_ids']) : [];
        $Silian_segments = [$Silian_label];

        if ($Silian_recordIds !== []) {
            $Silian_segments[] = sprintf('记录 %s', implode(', ', array_map(static fn ($Silian_item) => (string) $Silian_item, $Silian_recordIds)));
        }
        if (!empty($Silian_payload['user_id'])) {
            $Silian_segments[] = sprintf('用户 #%s', (string) $Silian_payload['user_id']);
        } elseif (!empty($Silian_payload['user_uuid'])) {
            $Silian_segments[] = sprintf('用户 UUID %s', (string) $Silian_payload['user_uuid']);
        }
        if (!empty($Silian_payload['exchange_id'])) {
            $Silian_segments[] = sprintf('兑换单 %s', (string) $Silian_payload['exchange_id']);
        }
        if (!empty($Silian_payload['badge_id'])) {
            $Silian_segments[] = sprintf('徽章 #%s', (string) $Silian_payload['badge_id']);
        }
        if (!empty($Silian_payload['product_id'])) {
            $Silian_segments[] = sprintf('商品 #%s', (string) $Silian_payload['product_id']);
        }
        if (!empty($Silian_payload['username'])) {
            $Silian_segments[] = sprintf('用户名 %s', (string) $Silian_payload['username']);
        }
        if (!empty($Silian_payload['email'])) {
            $Silian_segments[] = sprintf('邮箱 %s', (string) $Silian_payload['email']);
        }
        if (!empty($Silian_payload['region_code'])) {
            $Silian_segments[] = sprintf('地区 %s', (string) $Silian_payload['region_code']);
        }
        if (isset($Silian_payload['delta']) && is_numeric((string) $Silian_payload['delta'])) {
            $Silian_segments[] = sprintf('积分变动 %s', (string) $Silian_payload['delta']);
        }
        if (isset($Silian_payload['stock_delta']) && is_numeric((string) $Silian_payload['stock_delta'])) {
            $Silian_segments[] = sprintf('库存增量 %s', (string) $Silian_payload['stock_delta']);
        }
        if (isset($Silian_payload['target_stock']) && is_numeric((string) $Silian_payload['target_stock'])) {
            $Silian_segments[] = sprintf('目标库存 %s', (string) $Silian_payload['target_stock']);
        }
        if (!empty($Silian_payload['status'])) {
            $Silian_segments[] = sprintf('状态 %s', (string) $Silian_payload['status']);
        }
        if (!empty($Silian_payload['review_note'])) {
            $Silian_segments[] = sprintf('备注：%s', trim((string) $Silian_payload['review_note']));
        }
        if (!empty($Silian_payload['notes'])) {
            $Silian_segments[] = sprintf('备注：%s', trim((string) $Silian_payload['notes']));
        }
        if (!empty($Silian_payload['reason'])) {
            $Silian_segments[] = sprintf('原因：%s', trim((string) $Silian_payload['reason']));
        }
        if (!empty($Silian_payload['admin_notes'])) {
            $Silian_segments[] = sprintf('管理员备注：%s', trim((string) $Silian_payload['admin_notes']));
        }
        if (!empty($Silian_payload['tracking_number'])) {
            $Silian_segments[] = sprintf('物流单号：%s', trim((string) $Silian_payload['tracking_number']));
        }
        if (!empty($Silian_payload['days'])) {
            $Silian_segments[] = sprintf('范围 %d 天', (int) $Silian_payload['days']);
        }

        return implode('；', $Silian_segments);
    }

    /**
     * @param array<string,mixed> $result
     */
    public function formatReadActionResult(string $Silian_actionName, array $Silian_result): string
    {
        return match ($Silian_actionName) {
            'get_admin_stats' => sprintf(
                '后台总览：用户 %s，待审核记录 %s，累计减排 %s kg。',
                $this->safeReadValue($Silian_result, ['data', 'user_count'], '0'),
                $this->safeReadValue($Silian_result, ['data', 'pending_records'], '0'),
                $this->safeReadValue($Silian_result, ['data', 'total_carbon_saved'], '0')
            ),
            'get_pending_carbon_records' => sprintf(
                '当前共有 %d 条待处理记录。%s',
                (int) ($Silian_result['total'] ?? 0),
                $this->summarizeRecordList((array) ($Silian_result['items'] ?? []))
            ),
            'get_llm_usage_analytics' => sprintf(
                '近 %d 天 LLM 调用 %d 次，共 %d tokens，主要模型为 %s。',
                (int) ($Silian_result['days'] ?? 0),
                (int) ($Silian_result['total_calls'] ?? 0),
                (int) ($Silian_result['total_tokens'] ?? 0),
                (string) ($Silian_result['top_model'] ?? '未知')
            ),
            'get_activity_statistics' => $this->summarizeActivityStats((array) ($Silian_result['items'] ?? [])),
            'generate_admin_report' => sprintf(
                '已生成 %d 天管理摘要：待处理记录 %d 条，LLM 调用 %d 次。',
                (int) ($Silian_result['days'] ?? 0),
                (int) ($Silian_result['pending']['total'] ?? 0),
                (int) ($Silian_result['llm']['total_calls'] ?? 0)
            ),
            'search_users' => sprintf(
                '匹配到 %d 位用户。%s',
                (int) ($Silian_result['total'] ?? 0),
                $this->summarizeUserList((array) ($Silian_result['items'] ?? []))
            ),
            'get_user_overview' => sprintf(
                '用户 %s：状态 %s，积分 %d，累计减排 %.2f kg，Passkey %d 个。',
                (string) ($Silian_result['user']['username'] ?? '未知用户'),
                (string) ($Silian_result['user']['status'] ?? 'unknown'),
                (int) ($Silian_result['user']['points'] ?? 0),
                (float) ($Silian_result['metrics']['total_carbon_saved'] ?? 0),
                (int) ($Silian_result['metrics']['passkey_count'] ?? 0)
            ),
            'get_exchange_orders' => sprintf(
                '匹配到 %d 条兑换单。%s',
                (int) ($Silian_result['total'] ?? 0),
                $this->summarizeExchangeList((array) ($Silian_result['items'] ?? []))
            ),
            'get_exchange_order_detail' => sprintf(
                '兑换单 %s：用户 %s，商品 %s，状态 %s，积分 %s。',
                (string) ($Silian_result['exchange']['id'] ?? '-'),
                (string) ($Silian_result['exchange']['username'] ?? '未知用户'),
                (string) ($Silian_result['exchange']['product_name'] ?? '未知商品'),
                (string) ($Silian_result['exchange']['status'] ?? 'unknown'),
                (string) ($Silian_result['exchange']['points_used'] ?? '0')
            ),
            'get_product_catalog' => sprintf(
                '商品列表共匹配 %d 项。%s',
                (int) ($Silian_result['total'] ?? 0),
                $this->summarizeProductList((array) ($Silian_result['items'] ?? []))
            ),
            'get_passkey_admin_stats' => sprintf(
                '当前共有 %d 个 Passkey，覆盖 %d 位用户，近 30 天活跃 %d 个。',
                (int) ($Silian_result['total_passkeys'] ?? 0),
                (int) ($Silian_result['users_with_passkeys'] ?? 0),
                (int) ($Silian_result['used_recently_30d'] ?? 0)
            ),
            'get_passkey_admin_list' => sprintf(
                '匹配到 %d 个 Passkey。%s',
                (int) ($Silian_result['total'] ?? 0),
                $this->summarizePasskeyList((array) ($Silian_result['items'] ?? []))
            ),
            'search_system_logs' => sprintf(
                '日志检索返回 %d 条结果。%s',
                (int) ($Silian_result['returned_count'] ?? 0),
                $this->summarizeLogList((array) ($Silian_result['items'] ?? []))
            ),
            'get_broadcast_history' => sprintf(
                '广播历史共 %d 条。%s',
                (int) ($Silian_result['total'] ?? 0),
                $this->summarizeBroadcastList((array) ($Silian_result['items'] ?? []))
            ),
            'search_broadcast_recipients' => sprintf(
                '匹配到 %d 位候选接收人。%s',
                (int) ($Silian_result['total'] ?? 0),
                $this->summarizeUserList((array) ($Silian_result['items'] ?? []))
            ),
            default => '已完成查询。'
        };
    }

    /**
     * @param array<string,mixed> $result
     */
    public function formatWriteActionResult(string $Silian_actionName, array $Silian_result): string
    {
        return match ($Silian_actionName) {
            'approve_carbon_records' => sprintf(
                '已批准 %d 条记录。%s',
                (int) ($Silian_result['processed_count'] ?? 0),
                $this->formatSkippedSummary((array) ($Silian_result['skipped'] ?? []))
            ),
            'reject_carbon_records' => sprintf(
                '已驳回 %d 条记录。%s',
                (int) ($Silian_result['processed_count'] ?? 0),
                $this->formatSkippedSummary((array) ($Silian_result['skipped'] ?? []))
            ),
            'adjust_user_points' => sprintf(
                '已为用户 %s 调整积分 %s，当前积分 %d。',
                (string) ($Silian_result['user']['username'] ?? '未知用户'),
                (string) ($Silian_result['delta'] ?? '0'),
                (int) ($Silian_result['new_points'] ?? 0)
            ),
            'create_user' => sprintf(
                '已创建用户 %s（%s），状态 %s。',
                (string) ($Silian_result['user']['username'] ?? '未知用户'),
                (string) ($Silian_result['user']['email'] ?? '-'),
                (string) ($Silian_result['user']['status'] ?? 'unknown')
            ),
            'update_user_status' => sprintf(
                '已将用户 %s 的状态更新为 %s。',
                (string) ($Silian_result['user']['username'] ?? '未知用户'),
                (string) ($Silian_result['new_status'] ?? 'unknown')
            ),
            'award_badge_to_user' => sprintf(
                '已向用户 %s 发放徽章 %s。',
                (string) ($Silian_result['user']['username'] ?? '未知用户'),
                (string) ($Silian_result['badge']['name'] ?? '未命名徽章')
            ),
            'revoke_badge_from_user' => sprintf(
                '已撤销用户 %s 的徽章 %s。',
                (string) ($Silian_result['user']['username'] ?? '未知用户'),
                (string) ($Silian_result['badge']['name'] ?? '未命名徽章')
            ),
            'update_exchange_status' => sprintf(
                '兑换单 %s 已更新为 %s。',
                (string) ($Silian_result['exchange']['id'] ?? '-'),
                (string) ($Silian_result['exchange']['status'] ?? 'unknown')
            ),
            'update_product_status' => sprintf(
                '商品 %s 已更新为 %s。',
                (string) ($Silian_result['product']['name'] ?? '未命名商品'),
                (string) ($Silian_result['product']['status'] ?? 'unknown')
            ),
            'adjust_product_inventory' => sprintf(
                '商品 %s 库存已从 %d 调整到 %d。',
                (string) ($Silian_result['product']['name'] ?? '未命名商品'),
                (int) ($Silian_result['old_stock'] ?? 0),
                (int) ($Silian_result['new_stock'] ?? 0)
            ),
            default => '操作已执行。'
        };
    }

    /**
     * @param array<int,array<string,mixed>> $items
     */
    private function summarizeRecordList(array $Silian_items): string
    {
        if ($Silian_items === []) {
            return '当前没有匹配记录。';
        }

        $Silian_parts = [];
        foreach (array_slice($Silian_items, 0, 3) as $Silian_item) {
            $Silian_parts[] = sprintf(
                '#%s %s %skg',
                (string) ($Silian_item['id'] ?? '-'),
                (string) ($Silian_item['username'] ?? '未知用户'),
                (string) ($Silian_item['carbon_saved'] ?? 0)
            );
        }

        return '示例：' . implode('；', $Silian_parts) . (count($Silian_items) > 3 ? '。' : '。');
    }

    /**
     * @param array<int,array<string,mixed>> $items
     */
    private function summarizeActivityStats(array $Silian_items): string
    {
        if ($Silian_items === []) {
            return '当前没有可汇总的活动统计数据。';
        }

        $Silian_top = $Silian_items[0];
        return sprintf(
            '活动统计已整理，当前领先项为“%s”，通过 %d 条，待处理 %d 条。',
            (string) ($Silian_top['activity_name'] ?? '未命名活动'),
            (int) ($Silian_top['approved_count'] ?? 0),
            (int) ($Silian_top['pending_count'] ?? 0)
        );
    }

    /**
     * @param array<int,array<string,mixed>> $items
     */
    private function summarizeUserList(array $Silian_items): string
    {
        if ($Silian_items === []) {
            return '当前没有匹配用户。';
        }

        $Silian_parts = [];
        foreach (array_slice($Silian_items, 0, 3) as $Silian_item) {
            $Silian_parts[] = sprintf(
                '#%s %s（%s，积分 %s）',
                (string) ($Silian_item['id'] ?? '-'),
                (string) ($Silian_item['username'] ?? '未知用户'),
                (string) ($Silian_item['status'] ?? 'unknown'),
                (string) ($Silian_item['points'] ?? 0)
            );
        }

        return '示例：' . implode('；', $Silian_parts) . '。';
    }

    /**
     * @param array<int,array<string,mixed>> $items
     */
    private function summarizeExchangeList(array $Silian_items): string
    {
        if ($Silian_items === []) {
            return '当前没有匹配兑换单。';
        }

        $Silian_parts = [];
        foreach (array_slice($Silian_items, 0, 3) as $Silian_item) {
            $Silian_parts[] = sprintf(
                '#%s %s / %s / %s',
                (string) ($Silian_item['id'] ?? '-'),
                (string) ($Silian_item['username'] ?? '未知用户'),
                (string) ($Silian_item['product_name'] ?? '未知商品'),
                (string) ($Silian_item['status'] ?? 'unknown')
            );
        }

        return '示例：' . implode('；', $Silian_parts) . '。';
    }

    /**
     * @param array<int,array<string,mixed>> $items
     */
    private function summarizeProductList(array $Silian_items): string
    {
        if ($Silian_items === []) {
            return '当前没有匹配商品。';
        }

        $Silian_parts = [];
        foreach (array_slice($Silian_items, 0, 3) as $Silian_item) {
            $Silian_parts[] = sprintf(
                '#%s %s（%s 积分，库存 %s）',
                (string) ($Silian_item['id'] ?? '-'),
                (string) ($Silian_item['name'] ?? '未命名商品'),
                (string) ($Silian_item['points_required'] ?? 0),
                (string) ($Silian_item['stock'] ?? 0)
            );
        }

        return '示例：' . implode('；', $Silian_parts) . '。';
    }

    /**
     * @param array<int,array<string,mixed>> $items
     */
    private function summarizePasskeyList(array $Silian_items): string
    {
        if ($Silian_items === []) {
            return '当前没有匹配 Passkey。';
        }

        $Silian_parts = [];
        foreach (array_slice($Silian_items, 0, 3) as $Silian_item) {
            $Silian_parts[] = sprintf(
                '#%s %s / sign_count=%s',
                (string) ($Silian_item['id'] ?? '-'),
                (string) (($Silian_item['username'] ?? null) ?: ($Silian_item['user_uuid'] ?? '未知用户')),
                (string) ($Silian_item['sign_count'] ?? 0)
            );
        }

        return '示例：' . implode('；', $Silian_parts) . '。';
    }

    /**
     * @param array<int,array<string,mixed>> $items
     */
    private function summarizeLogList(array $Silian_items): string
    {
        if ($Silian_items === []) {
            return '当前没有匹配日志。';
        }

        $Silian_parts = [];
        foreach (array_slice($Silian_items, 0, 3) as $Silian_item) {
            $Silian_parts[] = sprintf(
                '[%s] %s',
                (string) ($Silian_item['type'] ?? 'log'),
                (string) ($Silian_item['summary'] ?? '无摘要')
            );
        }

        return '示例：' . implode('；', $Silian_parts) . '。';
    }

    /**
     * @param array<int,array<string,mixed>> $items
     */
    private function summarizeBroadcastList(array $Silian_items): string
    {
        if ($Silian_items === []) {
            return '当前没有广播历史。';
        }

        $Silian_parts = [];
        foreach (array_slice($Silian_items, 0, 3) as $Silian_item) {
            $Silian_parts[] = sprintf(
                '#%s %s（发送 %s/%s）',
                (string) ($Silian_item['id'] ?? '-'),
                (string) ($Silian_item['title'] ?? '未命名广播'),
                (string) ($Silian_item['sent_count'] ?? 0),
                (string) ($Silian_item['target_count'] ?? 0)
            );
        }

        return '示例：' . implode('；', $Silian_parts) . '。';
    }

    /**
     * @param array<string,mixed> $result
     * @param array<int,string> $path
     */
    private function safeReadValue(array $Silian_result, array $Silian_path, string $Silian_fallback): string
    {
        $Silian_cursor = $Silian_result;
        foreach ($Silian_path as $Silian_segment) {
            if (!is_array($Silian_cursor) || !array_key_exists($Silian_segment, $Silian_cursor)) {
                return $Silian_fallback;
            }
            $Silian_cursor = $Silian_cursor[$Silian_segment];
        }

        return $Silian_cursor === null || $Silian_cursor === '' ? $Silian_fallback : (string) $Silian_cursor;
    }

    /**
     * @param array<int,array<string,mixed>> $skipped
     */
    private function formatSkippedSummary(array $Silian_skipped): string
    {
        if ($Silian_skipped === []) {
            return '没有跳过项。';
        }

        $Silian_parts = [];
        foreach (array_slice($Silian_skipped, 0, 3) as $Silian_item) {
            $Silian_parts[] = sprintf('#%s %s', (string) ($Silian_item['id'] ?? '-'), (string) ($Silian_item['reason'] ?? 'skipped'));
        }

        return '跳过：' . implode('；', $Silian_parts) . (count($Silian_skipped) > 3 ? ' 等。' : '。');
    }
}
