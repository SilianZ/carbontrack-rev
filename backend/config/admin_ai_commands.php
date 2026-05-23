<?php

declare(strict_types=1);

$Silian_path = __DIR__ . '/admin_ai_commands.json';

if (!is_file($Silian_path) || !is_readable($Silian_path)) {
    return [
        'agent' => [],
        'navigationTargets' => [],
        'quickActions' => [],
        'managementActions' => [],
    ];
}

$Silian_contents = file_get_contents($Silian_path);

if ($Silian_contents === false) {
    return [
        'agent' => [],
        'navigationTargets' => [],
        'quickActions' => [],
        'managementActions' => [],
    ];
}

return json_decode($Silian_contents, true, 512, JSON_THROW_ON_ERROR);

