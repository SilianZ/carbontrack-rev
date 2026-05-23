<?php

declare(strict_types=1);

namespace CarbonTrack\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\BadgeService;
use CarbonTrack\Services\CloudflareR2Service;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use Monolog\Logger;

class BadgeController
{
    public function __construct(
        private AuthService $authService,
        private BadgeService $badgeService,
        private AuditLogService $auditLogService,
        private ?CloudflareR2Service $r2Service = null,
        private ?ErrorLogService $errorLogService = null,
        private ?Logger $logger = null
    ) {}

    public function list(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'Unauthorized'], 401);
            }

            $Silian_query = $Silian_request->getQueryParams();
            $Silian_includeInactive = false;
            if (!empty($Silian_query['include_inactive']) && $this->authService->isAdminUser($Silian_user)) {
                $Silian_includeInactive = filter_var($Silian_query['include_inactive'], FILTER_VALIDATE_BOOLEAN);
            }

            $Silian_badges = $this->badgeService->listBadges($Silian_includeInactive);
            $Silian_data = array_map(function ($Silian_badge) {
                return $this->formatBadge($Silian_badge->toArray());
            }, $Silian_badges);

            return $this->json($Silian_response, ['success' => true, 'data' => $Silian_data]);
        } catch (\Throwable $Silian_e) {
            $this->logError($Silian_e, $Silian_request, 'badge_list_failed');
            return $this->json($Silian_response, ['success' => false, 'message' => 'Failed to load badges'], 500);
        }
    }

    public function myBadges(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'Unauthorized'], 401);
            }

            $Silian_query = $Silian_request->getQueryParams();
            $Silian_includeRevoked = !empty($Silian_query['include_revoked']) && filter_var($Silian_query['include_revoked'], FILTER_VALIDATE_BOOLEAN);
            $Silian_records = $this->badgeService->getUserBadges((int) $Silian_user['id'], $Silian_includeRevoked);

            $Silian_data = array_map(function ($Silian_entry) {
                $Silian_badge = $Silian_entry['badge'] ?? [];
                $Silian_userBadge = $Silian_entry['user_badge'] ?? [];
                return [
                    'badge' => $Silian_badge ? $this->formatBadge($Silian_badge) : null,
                    'user_badge' => $Silian_userBadge,
                ];
            }, $Silian_records);

            return $this->json($Silian_response, ['success' => true, 'data' => $Silian_data]);
        } catch (\Throwable $Silian_e) {
            $this->logError($Silian_e, $Silian_request, 'user_badges_failed');
            return $this->json($Silian_response, ['success' => false, 'message' => 'Failed to load user badges'], 500);
        }
    }

    public function triggerAuto(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'Access denied'], 403);
            }

            $Silian_query = $Silian_request->getParsedBody();
            if (empty($Silian_query)) {
                $Silian_query = $Silian_request->getQueryParams();
            }
            $Silian_badgeId = isset($Silian_query['badge_id']) ? (int) $Silian_query['badge_id'] : null;
            $Silian_targetUserId = isset($Silian_query['user_id']) ? (int) $Silian_query['user_id'] : null;
            if ($Silian_badgeId === 0) {
                $Silian_badgeId = null;
            }
            if ($Silian_targetUserId === 0) {
                $Silian_targetUserId = null;
            }

            $Silian_result = $this->badgeService->runAutoGrant($Silian_badgeId, $Silian_targetUserId);

            $this->auditLogService->log([
                'user_id' => $Silian_user['id'],
                'action' => 'badge_auto_triggered',
                'entity_type' => 'achievement_badge',
                'new_value' => json_encode($Silian_result, JSON_UNESCAPED_UNICODE),
                'notes' => 'Manual trigger via /badges/auto-trigger',
            ]);

            return $this->json($Silian_response, ['success' => true, 'data' => $Silian_result]);
        } catch (\Throwable $Silian_e) {
            $this->logError($Silian_e, $Silian_request, 'badge_auto_trigger_failed');
            return $this->json($Silian_response, ['success' => false, 'message' => 'Failed to run auto grant'], 500);
        }
    }

    private function formatBadge(array $Silian_badge): array
    {
        if ($this->r2Service && !empty($Silian_badge['icon_path'])) {
            try {
                $Silian_badge['icon_url'] = $this->r2Service->getPublicUrl($Silian_badge['icon_path']);
                $Silian_badge['icon_presigned_url'] = $this->r2Service->generatePresignedUrl($Silian_badge['icon_path'], 600);
            } catch (\Throwable $Silian_e) {
                if ($this->logger) {
                    $this->logger->warning('Failed to build badge icon URLs', ['error' => $Silian_e->getMessage(), 'icon_path' => $Silian_badge['icon_path']]);
                }
            }
        }
        if ($this->r2Service && !empty($Silian_badge['icon_thumbnail_path'])) {
            try {
                $Silian_badge['icon_thumbnail_url'] = $this->r2Service->getPublicUrl($Silian_badge['icon_thumbnail_path']);
            } catch (\Throwable $Silian_ignore) {
            }
        }
        return $Silian_badge;
    }

    private function json(Response $Silian_response, array $Silian_payload, int $Silian_status = 200): Response
    {
        $Silian_response->getBody()->write(json_encode($Silian_payload, JSON_UNESCAPED_UNICODE));
        return $Silian_response->withHeader('Content-Type', 'application/json')->withStatus($Silian_status);
    }

    private function logError(\Throwable $Silian_e, Request $Silian_request, string $Silian_type): void
    {
        if ($this->logger) {
            $this->logger->error($Silian_type, ['error' => $Silian_e->getMessage(), 'trace' => $Silian_e->getTraceAsString()]);
        }
        if ($this->errorLogService) {
            try {
                $this->errorLogService->logException($Silian_e, $Silian_request);
            } catch (\Throwable $Silian_ignore) {
                if ($this->logger) {
                    $this->logger->error('ErrorLogService failed', ['error' => $Silian_ignore->getMessage()]);
                }
            }
        }
    }
}
