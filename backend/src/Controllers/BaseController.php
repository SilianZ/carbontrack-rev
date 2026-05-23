<?php

declare(strict_types=1);

namespace CarbonTrack\Controllers;

use Psr\Http\Message\ResponseInterface as Response;

class BaseController
{
    protected function response(Response $Silian_response, array $Silian_data, int $Silian_status = 200): Response
    {
        // 自动附加 request_id 到 4xx/5xx 错误响应，便于前端提示用户反馈
        if ($Silian_status >= 400) {
            if (!isset($Silian_data['request_id'])) {
                $Silian_data['request_id'] = $_SERVER['HTTP_X_REQUEST_ID'] ?? ($_SERVER['REQUEST_ID'] ?? null);
            }
        }
        $Silian_response->getBody()->write(json_encode($Silian_data, JSON_UNESCAPED_UNICODE));
        return $Silian_response->withHeader('Content-Type', 'application/json')->withStatus($Silian_status);
    }

    protected function validate(array $Silian_data, array $Silian_rules): void
    {
        // Minimal no-op validator for tests; extend as needed
    }
}


