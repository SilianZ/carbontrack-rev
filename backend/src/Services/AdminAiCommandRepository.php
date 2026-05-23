<?php

declare(strict_types=1);

namespace CarbonTrack\Services;

use JsonException;

class AdminAiCommandRepository
{
    /**
     * @param array<int,string> $paths
     */
    public function __construct(array $Silian_paths)
    {
        $this->paths = array_values(array_filter($Silian_paths, static fn ($Silian_path) => is_string($Silian_path) && $Silian_path !== ''));
    }

    /**
     * @return array<string,mixed>
     */
    public function getConfig(): array
    {
        $this->ensureFreshConfig();

        return $this->cachedConfig ?? [];
    }

    public function getFingerprint(): string
    {
        $this->ensureFreshConfig();

        return $this->activeFingerprint ?? 'none';
    }

    public function getActivePath(): ?string
    {
        $this->ensureFreshConfig();

        return $this->activePath;
    }

    public function getLastModified(): ?int
    {
        $this->ensureFreshConfig();

        return $this->activeModifiedAt;
    }

    public function reload(): void
    {
        $this->resetCache();
        $this->ensureFreshConfig();
    }

    /**
     * @return array<int,string>
     */
    public function getPaths(): array
    {
        return $this->paths;
    }

    private function ensureFreshConfig(): void
    {
        foreach ($this->paths as $Silian_path) {
            if (!is_file($Silian_path) || !is_readable($Silian_path)) {
                continue;
            }

            $Silian_modifiedAt = @filemtime($Silian_path) ?: null;

            if ($this->activePath === $Silian_path && $this->cachedConfig !== null && $this->activeModifiedAt === $Silian_modifiedAt) {
                return;
            }

            $Silian_config = require $Silian_path;
            if (!is_array($Silian_config)) {
                continue;
            }

            $this->cachedConfig = $Silian_config;
            $this->activePath = $Silian_path;
            $this->activeModifiedAt = $Silian_modifiedAt;
            $this->activeFingerprint = $this->computeFingerprint($Silian_config, $Silian_path, $Silian_modifiedAt);
            $this->lastLoadedAt = microtime(true);

            return;
        }

        if ($this->cachedConfig === null) {
            $this->cachedConfig = [];
            $this->activePath = null;
            $this->activeModifiedAt = null;
            $this->activeFingerprint = null;
            $this->lastLoadedAt = microtime(true);
        }
    }

    private function resetCache(): void
    {
        $this->cachedConfig = null;
        $this->activePath = null;
        $this->activeModifiedAt = null;
        $this->activeFingerprint = null;
        $this->lastLoadedAt = null;
    }

    /**
     * @param array<string,mixed> $config
     */
    private function computeFingerprint(array $Silian_config, string $Silian_path, ?int $Silian_modifiedAt): string
    {
        try {
            $Silian_encoded = json_encode($Silian_config, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        } catch (JsonException) {
            $Silian_encoded = serialize($Silian_config);
        }

        return sha1($Silian_path . '|' . (string) $Silian_modifiedAt . '|' . $Silian_encoded);
    }

    /**
     * @var array<string,mixed>|null
     */
    private ?array $cachedConfig = null;

    private ?string $activePath = null;

    private ?int $activeModifiedAt = null;

    private ?string $activeFingerprint = null;

    private ?float $lastLoadedAt = null;

    /**
     * @var array<int,string>
     */
    private array $paths;
}
