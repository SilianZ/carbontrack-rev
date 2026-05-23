<?php

declare(strict_types=1);

namespace CarbonTrack\Controllers;

use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\UserGroupService;
use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;

class AdminUserGroupController
{
    public function __construct(
        private UserGroupService $groupService,
        private AuditLogService $auditLogService,
        private ErrorLogService $errorLogService
    ) {}

    public function list(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_groups = $this->groupService->getAllGroups();
            $this->logAudit('admin_user_groups_listed', $Silian_request, [
                'data' => ['count' => count($Silian_groups)],
            ]);

            return $this->json($Silian_response, ['success' => true, 'data' => $Silian_groups]);
        } catch (\Throwable $Silian_e) {
            return $this->handleException($Silian_e, $Silian_request, $Silian_response, 'Failed to load user groups', 'admin_user_groups_list_failed');
        }
    }

    public function create(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_body = $Silian_request->getParsedBody();
            if (!is_array($Silian_body)) {
                $Silian_body = [];
            }

            $Silian_group = $this->groupService->createGroup($Silian_body);
            $this->logAudit('admin_user_group_created', $Silian_request, [
                'record_id' => $Silian_group['id'] ?? null,
                'new_data' => $Silian_group,
                'data' => ['name' => $Silian_group['name'] ?? null],
            ]);

            return $this->json($Silian_response, ['success' => true, 'data' => $Silian_group]);
        } catch (\Throwable $Silian_e) {
            return $this->handleException($Silian_e, $Silian_request, $Silian_response, 'Failed to create user group', 'admin_user_group_create_failed');
        }
    }

    public function update(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_id = (int)$Silian_args['id'];
            $Silian_body = $Silian_request->getParsedBody();
            if (!is_array($Silian_body)) {
                $Silian_body = [];
            }

            $Silian_oldGroup = $this->groupService->getGroupById($Silian_id);
            $Silian_group = $this->groupService->updateGroup($Silian_id, $Silian_body);
            $this->logAudit('admin_user_group_updated', $Silian_request, [
                'record_id' => $Silian_id,
                'old_data' => $Silian_oldGroup,
                'new_data' => $Silian_group,
                'data' => ['name' => $Silian_group['name'] ?? null],
            ]);

            return $this->json($Silian_response, ['success' => true, 'data' => $Silian_group]);
        } catch (\Throwable $Silian_e) {
            return $this->handleException($Silian_e, $Silian_request, $Silian_response, 'Failed to update user group', 'admin_user_group_update_failed');
        }
    }

    public function delete(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_id = (int)$Silian_args['id'];
            $Silian_oldGroup = $this->groupService->getGroupById($Silian_id);
            $this->groupService->deleteGroup($Silian_id);
            $this->logAudit('admin_user_group_deleted', $Silian_request, [
                'record_id' => $Silian_id,
                'old_data' => $Silian_oldGroup,
                'data' => ['name' => $Silian_oldGroup['name'] ?? null],
            ]);

            return $this->json($Silian_response, ['success' => true]);
        } catch (\Throwable $Silian_e) {
            return $this->handleException($Silian_e, $Silian_request, $Silian_response, 'Failed to delete user group', 'admin_user_group_delete_failed');
        }
    }

    public function meta(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_definitions = $this->groupService->getQuotaDefinitions();
            $this->logAudit('admin_user_group_meta_viewed', $Silian_request, [
                'data' => ['count' => count($Silian_definitions)],
            ]);

            return $this->json($Silian_response, [
                'success' => true,
                'data' => [
                    'quota_definitions' => $Silian_definitions,
                    'support_routing_fields' => $this->groupService->getSupportRoutingFieldDefinitions(),
                    'support_routing_defaults' => $this->groupService->getSupportRoutingDefaults(),
                ],
            ]);
        } catch (\Throwable $Silian_e) {
            return $this->handleException($Silian_e, $Silian_request, $Silian_response, 'Failed to load quota definitions', 'admin_user_group_meta_failed');
        }
    }

    private function logAudit(string $Silian_action, Request $Silian_request, array $Silian_context = [], string $Silian_status = 'success'): void
    {
        try {
            $this->auditLogService->logAdminOperation($Silian_action, $this->resolveActorId($Silian_request), 'admin_user_group', array_merge([
                'table' => 'user_groups',
                'record_id' => $Silian_context['record_id'] ?? null,
                'request_id' => $Silian_request->getAttribute('request_id'),
                'request_method' => $Silian_request->getMethod(),
                'endpoint' => (string)$Silian_request->getUri()->getPath(),
                'status' => $Silian_status,
                'request_data' => $Silian_context['data'] ?? null,
                'old_data' => $Silian_context['old_data'] ?? null,
                'new_data' => $Silian_context['new_data'] ?? null,
            ], $Silian_context));
        } catch (\Throwable $Silian_ignore) {
            // 审计日志失败不阻断主流程
        }
    }

    private function handleException(\Throwable $Silian_e, Request $Silian_request, Response $Silian_response, string $Silian_message, string $Silian_auditAction): Response
    {
        try {
            $this->errorLogService->logException($Silian_e, $Silian_request, ['context' => $Silian_auditAction]);
        } catch (\Throwable $Silian_ignore) {
            // swallow
        }

        $this->logAudit($Silian_auditAction, $Silian_request, [
            'data' => ['error' => $Silian_e->getMessage()],
        ], 'failed');

        return $this->json($Silian_response, [
            'success' => false,
            'error' => $Silian_message,
        ], 500);
    }

    private function resolveActorId(Request $Silian_request): ?int
    {
        $Silian_userId = $Silian_request->getAttribute('user_id');
        return is_numeric($Silian_userId) ? (int)$Silian_userId : null;
    }

    private function json(Response $Silian_response, array $Silian_data, int $Silian_status = 200): Response
    {
        $Silian_response->getBody()->write(json_encode($Silian_data));
        return $Silian_response->withHeader('Content-Type', 'application/json')->withStatus($Silian_status);
    }
}
