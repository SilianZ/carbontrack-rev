<?php

declare(strict_types=1);

namespace CarbonTrack\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\BadgeService;
use CarbonTrack\Services\CloudflareR2Service;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\AuditLogService;
use Monolog\Logger;

class AdminBadgeController
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
            $Silian_admin = $this->requireAdmin($Silian_request);
            if (!$Silian_admin) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'Access denied'], 403);
            }

            $Silian_query = $Silian_request->getQueryParams();
            $Silian_includeInactive = !empty($Silian_query['include_inactive']) && filter_var($Silian_query['include_inactive'], FILTER_VALIDATE_BOOLEAN);
            $Silian_badges = $this->badgeService->listBadges($Silian_includeInactive);
            $Silian_badgeIds = array_map(function ($Silian_badge) {
                return (int) $Silian_badge->id;
            }, $Silian_badges);
            $Silian_statsByBadge = $this->badgeService->getBadgeAwardStats($Silian_badgeIds);
            $Silian_defaultStats = $this->defaultBadgeStats();
            $Silian_data = [];
            foreach ($Silian_badges as $Silian_badge) {
                $Silian_payload = $this->formatBadge($Silian_badge->toArray());
                $Silian_payload['stats'] = $Silian_statsByBadge[$Silian_badge->id] ?? $Silian_defaultStats;
                $Silian_data[] = $Silian_payload;
            }

            return $this->json($Silian_response, ['success' => true, 'data' => $Silian_data]);
        } catch (\Throwable $Silian_e) {
            $this->logError($Silian_e, $Silian_request, 'admin_badge_list_failed');
            return $this->json($Silian_response, ['success' => false, 'message' => 'Failed to load badges'], 500);
        }
    }

    public function detail(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_admin = $this->requireAdmin($Silian_request);
            if (!$Silian_admin) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'Access denied'], 403);
            }

            $Silian_badgeId = (int) ($Silian_args['id'] ?? 0);
            $Silian_badge = $this->badgeService->findBadge($Silian_badgeId);
            if (!$Silian_badge) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'Badge not found'], 404);
            }

            $Silian_payload = $this->formatBadge($Silian_badge->toArray());
            $Silian_stats = $this->badgeService->getBadgeAwardStats([$Silian_badgeId]);
            $Silian_payload['stats'] = $Silian_stats[$Silian_badgeId] ?? $this->defaultBadgeStats();
            $Silian_recent = $this->badgeService->getBadgeRecipients($Silian_badgeId, [
                'per_page' => 5,
                'include_revoked' => true,
            ]);
            $Silian_payload['recent_awards'] = $Silian_recent['items'];
            $Silian_payload['recent_awards_pagination'] = $Silian_recent['pagination'];

            return $this->json($Silian_response, ['success' => true, 'data' => $Silian_payload]);
        } catch (\Throwable $Silian_e) {
            $this->logError($Silian_e, $Silian_request, 'admin_badge_detail_failed');
            return $this->json($Silian_response, ['success' => false, 'message' => 'Failed to load badge'], 500);
        }
    }

    public function create(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_admin = $this->requireAdmin($Silian_request);
            if (!$Silian_admin) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'Access denied'], 403);
            }

            $Silian_data = $Silian_request->getParsedBody() ?: [];
            $Silian_badge = $this->badgeService->createBadge($Silian_data, (int) $Silian_admin['id']);
            return $this->json($Silian_response, ['success' => true, 'data' => $this->formatBadge($Silian_badge->toArray())], 201);
        } catch (\Throwable $Silian_e) {
            $this->logError($Silian_e, $Silian_request, 'admin_badge_create_failed');
            return $this->json($Silian_response, ['success' => false, 'message' => 'Failed to create badge'], 500);
        }
    }

    public function update(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_admin = $this->requireAdmin($Silian_request);
            if (!$Silian_admin) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'Access denied'], 403);
            }

            $Silian_data = $Silian_request->getParsedBody() ?: [];
            $Silian_badge = $this->badgeService->updateBadge((int) ($Silian_args['id'] ?? 0), $Silian_data, (int) $Silian_admin['id']);
            if (!$Silian_badge) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'Badge not found'], 404);
            }

            return $this->json($Silian_response, ['success' => true, 'data' => $this->formatBadge($Silian_badge->toArray())]);
        } catch (\Throwable $Silian_e) {
            $this->logError($Silian_e, $Silian_request, 'admin_badge_update_failed');
            return $this->json($Silian_response, ['success' => false, 'message' => 'Failed to update badge'], 500);
        }
    }

    public function award(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_admin = $this->requireAdmin($Silian_request);
            if (!$Silian_admin) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'Access denied'], 403);
            }

            $Silian_data = $Silian_request->getParsedBody() ?: [];
            $Silian_userId = isset($Silian_data['user_id']) ? (int) $Silian_data['user_id'] : 0;
            if ($Silian_userId <= 0) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'user_id is required'], 400);
            }

            $Silian_userBadge = $this->badgeService->awardBadge((int) ($Silian_args['id'] ?? 0), $Silian_userId, [
                'source' => 'manual',
                'admin_id' => (int) $Silian_admin['id'],
                'notes' => $Silian_data['notes'] ?? null,
            ]);
            if (!$Silian_userBadge) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'Badge or user not found'], 404);
            }

            return $this->json($Silian_response, ['success' => true, 'data' => $Silian_userBadge->toArray()]);
        } catch (\Throwable $Silian_e) {
            $this->logError($Silian_e, $Silian_request, 'admin_badge_award_failed');
            return $this->json($Silian_response, ['success' => false, 'message' => 'Failed to award badge'], 500);
        }
    }

    public function revoke(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_admin = $this->requireAdmin($Silian_request);
            if (!$Silian_admin) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'Access denied'], 403);
            }

            $Silian_data = $Silian_request->getParsedBody() ?: [];
            $Silian_userId = isset($Silian_data['user_id']) ? (int) $Silian_data['user_id'] : 0;
            if ($Silian_userId <= 0) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'user_id is required'], 400);
            }

            $Silian_ok = $this->badgeService->revokeBadge((int) ($Silian_args['id'] ?? 0), $Silian_userId, (int) $Silian_admin['id'], $Silian_data['notes'] ?? null);
            if (!$Silian_ok) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'Badge record not found or already revoked'], 404);
            }

            return $this->json($Silian_response, ['success' => true]);
        } catch (\Throwable $Silian_e) {
            $this->logError($Silian_e, $Silian_request, 'admin_badge_revoke_failed');
            return $this->json($Silian_response, ['success' => false, 'message' => 'Failed to revoke badge'], 500);
        }
    }

    public function triggerAuto(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_admin = $this->requireAdmin($Silian_request);
            if (!$Silian_admin) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'Access denied'], 403);
            }

            $Silian_query = $Silian_request->getQueryParams();
            $Silian_badgeId = isset($Silian_query['badge_id']) ? (int) $Silian_query['badge_id'] : null;
            $Silian_userId = isset($Silian_query['user_id']) ? (int) $Silian_query['user_id'] : null;
            if ($Silian_badgeId === 0) {
                $Silian_badgeId = null;
            }
            if ($Silian_userId === 0) {
                $Silian_userId = null;
            }

            $Silian_result = $this->badgeService->runAutoGrant($Silian_badgeId, $Silian_userId);

            $this->auditLogService->log([
                'user_id' => $Silian_admin['id'],
                'action' => 'badge_auto_triggered',
                'entity_type' => 'achievement_badge',
                'new_value' => json_encode($Silian_result, JSON_UNESCAPED_UNICODE),
                'notes' => 'Manual trigger by admin',
            ]);

            return $this->json($Silian_response, ['success' => true, 'data' => $Silian_result]);
        } catch (\Throwable $Silian_e) {
            $this->logError($Silian_e, $Silian_request, 'admin_badge_auto_failed');
            return $this->json($Silian_response, ['success' => false, 'message' => 'Failed to run auto grant'], 500);
        }
    }    public function recipients(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_admin = $this->requireAdmin($Silian_request);
            if (!$Silian_admin) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'Access denied'], 403);
            }

            $Silian_badgeId = (int) ($Silian_args['id'] ?? 0);
            if ($Silian_badgeId <= 0) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'Invalid badge id'], 400);
            }

            $Silian_badge = $this->badgeService->findBadge($Silian_badgeId);
            if (!$Silian_badge) {
                return $this->json($Silian_response, ['success' => false, 'message' => 'Badge not found'], 404);
            }

            $Silian_query = $Silian_request->getQueryParams();
            $Silian_options = [
                'page' => isset($Silian_query['page']) ? (int) $Silian_query['page'] : 1,
                'per_page' => isset($Silian_query['per_page']) ? (int) $Silian_query['per_page'] : 20,
                'include_revoked' => !empty($Silian_query['include_revoked']) && filter_var($Silian_query['include_revoked'], FILTER_VALIDATE_BOOLEAN),
            ];
            if (!empty($Silian_query['status']) && in_array($Silian_query['status'], ['awarded', 'revoked'], true)) {
                $Silian_options['status'] = $Silian_query['status'];
            }
            $Silian_searchTerm = $Silian_query['q'] ?? ($Silian_query['search'] ?? null);
            if (is_string($Silian_searchTerm) && trim($Silian_searchTerm) !== '') {
                $Silian_options['search'] = trim($Silian_searchTerm);
            }
            $Silian_options['page'] = max(1, (int) $Silian_options['page']);
            $Silian_options['per_page'] = min(100, max(1, (int) $Silian_options['per_page']));

            $Silian_result = $this->badgeService->getBadgeRecipients($Silian_badgeId, $Silian_options);
            $Silian_payload = $Silian_result;
            $Silian_payload['badge'] = $this->formatBadge($Silian_badge->toArray());

            return $this->json($Silian_response, ['success' => true, 'data' => $Silian_payload]);
        } catch (\Throwable $Silian_e) {
            $this->logError($Silian_e, $Silian_request, 'admin_badge_recipients_failed');
            return $this->json($Silian_response, ['success' => false, 'message' => 'Failed to load badge recipients'], 500);
        }
    }



    private function requireAdmin(Request $Silian_request): ?array
    {
        $Silian_user = $this->authService->getCurrentUser($Silian_request);
        if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
            return null;
        }
        return $Silian_user;
    }    private function defaultBadgeStats(): array
    {
        return [
            'total_records' => 0,
            'unique_users' => 0,
            'awarded_records' => 0,
            'revoked_records' => 0,
            'awarded_users' => 0,
            'last_awarded_at' => null,
        ];
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
            } catch (\Throwable $Silian_ignore) {}
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
