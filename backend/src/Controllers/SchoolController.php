<?php

namespace CarbonTrack\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use CarbonTrack\Models\School;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Support\InputValueNormalizer;
use PDO;
use Illuminate\Database\QueryException;

class SchoolController extends BaseController
{
    protected $auditLogService;
    protected $errorLogService;
    /** @var PDO */
    protected $db;

    private const ERR_SCHOOL_NOT_FOUND = 'School not found';
    private const CODE_SCHOOL_NOT_FOUND = 'SCHOOL_NOT_FOUND';

    public function __construct(
        AuditLogService $Silian_auditLogService,
        ErrorLogService $Silian_errorLogService,
        PDO $Silian_db
    )
    {
        $this->auditLogService = $Silian_auditLogService;
        $this->errorLogService = $Silian_errorLogService;
        $this->db = $Silian_db;
    }

    // Get schools with optional fuzzy search and pagination (public)
    public function index(Request $Silian_request, Response $Silian_response, array $Silian_args)
    {
        $Silian_params = $Silian_request->getQueryParams();

        $Silian_limit = (int)($Silian_params['limit'] ?? 20);
        $Silian_limit = max(1, min(100, $Silian_limit));
        $Silian_page = (int)($Silian_params['page'] ?? 1);
        $Silian_page = max(1, $Silian_page);
        $Silian_offset = ($Silian_page - 1) * $Silian_limit;

        $Silian_query = School::query()->whereNull('deleted_at')->where('is_active', true);

        if (!empty($Silian_params['search'])) {
            $Silian_search = trim((string)$Silian_params['search']);
            $Silian_query->where(function ($Silian_q) use ($Silian_search) {
                $Silian_q->where('name', 'LIKE', '%' . $Silian_search . '%')
                  ->orWhere('location', 'LIKE', '%' . $Silian_search . '%');
            });
        }

        // 获取总数与数据
        $Silian_total = (clone $Silian_query)->count();
        // 优先按 sort_order 排序；若目标数据库缺少该列，则回退到按 name 排序
        try {
            $Silian_items = (clone $Silian_query)->orderBy('sort_order', 'asc')->offset($Silian_offset)->limit($Silian_limit)->get();
        } catch (QueryException $Silian_e) {
            $Silian_items = (clone $Silian_query)->orderBy('name', 'asc')->offset($Silian_offset)->limit($Silian_limit)->get();
        }

        return $this->response($Silian_response, [
            'success' => true,
            'data' => [
                'schools' => $Silian_items,
                'pagination' => [
                    'total_items' => $Silian_total,
                    'current_page' => $Silian_page,
                    'per_page' => $Silian_limit,
                    'total_pages' => (int)ceil($Silian_total / $Silian_limit)
                ]
            ]
        ]);
    }

    // Admin: Get all schools with pagination and filters
    public function adminIndex(Request $Silian_request, Response $Silian_response, array $Silian_args)
    {
        $Silian_params = $Silian_request->getQueryParams();
        $Silian_query = School::query();

        if (isset($Silian_params["search"]) && !empty($Silian_params["search"])) {
            $Silian_search = "::" . $Silian_params["search"] . "::";
            $Silian_query->where(function ($Silian_q) use ($Silian_search) {
                $Silian_q->where("name", "LIKE", "%" . $Silian_search . "%")
                  ->orWhere("location", "LIKE", "%" . $Silian_search . "%");
            });
        }

        $Silian_limit = $Silian_params["limit"] ?? 10;
        $Silian_page = $Silian_params["page"] ?? 1;

        $Silian_schools = $Silian_query->paginate($Silian_limit, ["*"], "page", $Silian_page);

        return $this->response($Silian_response, [
            "data" => $Silian_schools->items(),
            "pagination" => [
                "total_items" => $Silian_schools->total(),
                "total_pages" => $Silian_schools->lastPage(),
                "current_page" => $Silian_schools->currentPage(),
                "per_page" => $Silian_schools->perPage(),
            ]
        ]);
    }

    // Admin: Create a new school
    public function store(Request $Silian_request, Response $Silian_response, array $Silian_args)
    {
        $Silian_payload = $Silian_request->getParsedBody();
        if (!is_array($Silian_payload)) {
            return $this->response($Silian_response, [
                'success' => false,
                'message' => 'Request body must be a JSON object',
                'code' => 'INVALID_REQUEST_BODY',
            ], 400);
        }

        try {
            $Silian_data = $this->sanitizeSchoolPayload($Silian_payload);
        } catch (\InvalidArgumentException $Silian_exception) {
            return $this->response($Silian_response, [
                'success' => false,
                'message' => $Silian_exception->getMessage(),
                'code' => 'VALIDATION_ERROR',
            ], 400);
        }

        $this->validate($Silian_data, [
            "name" => "required|string|max:255",
            "location" => "required|string|max:255",
            "is_active" => "boolean",
            "sort_order" => "integer"
        ]);

        $Silian_school = $this->createSchoolWithCompatibility($Silian_data);

        $this->auditLogService->log(
            $Silian_request->getAttribute("user_id"),
            "School",
            $Silian_school->id,
            "create",
            "Created new school: " . $Silian_school->name
        );

        return $this->response($Silian_response, ["school" => $Silian_school], 201);
    }

    // Public: Create or fetch a school (authenticated users)
    public function createOrFetch(Request $Silian_request, Response $Silian_response, array $Silian_args)
    {
        $Silian_data = $Silian_request->getParsedBody();
        $Silian_name = trim((string)($Silian_data['name'] ?? ''));
        $Silian_location = isset($Silian_data['location']) ? trim((string)$Silian_data['location']) : null;

        $Silian_httpStatus = 200;
        $Silian_payload = null;

        if ($Silian_name === '') {
            $Silian_httpStatus = 400;
            $Silian_payload = [
                'success' => false,
                'message' => 'School name is required',
                'code' => 'MISSING_NAME'
            ];
        } else {
            // 查找同名（不区分大小写）学校
            $Silian_existing = School::whereRaw('LOWER(name) = LOWER(?)', [$Silian_name])
                ->whereNull('deleted_at')
                ->first();

            if ($Silian_existing) {
                $Silian_httpStatus = 200;
                $Silian_payload = [
                    'success' => true,
                    'data' => ['school' => $Silian_existing]
                ];
            } else {
                // 兼容缺少 sort_order 列的数据库：优先携带 sort_order 创建，失败则回退为不带该字段
                try {
                    try {
                        $Silian_school = School::create([
                            'name' => $Silian_name,
                            'location' => $Silian_location,
                            'is_active' => true,
                            'sort_order' => 0
                        ]);
                    } catch (QueryException $Silian_e) {
                        $Silian_school = School::create([
                            'name' => $Silian_name,
                            'location' => $Silian_location,
                            'is_active' => true
                        ]);
                    }

                    // 记录审计
                    $this->auditLogService->log(
                        $Silian_request->getAttribute('user_id'),
                        'School',
                        $Silian_school->id,
                        'create',
                        'User created school (public): ' . $Silian_school->name
                    );

                    $Silian_httpStatus = 201;
                    $Silian_payload = [
                        'success' => true,
                        'data' => ['school' => $Silian_school]
                    ];
                } catch (\Throwable $Silian_e) {
                    $this->logExceptionWithFallback($Silian_e, $Silian_request, 'SchoolController::create error: ' . $Silian_e->getMessage());
                    $Silian_httpStatus = 500;
                    $Silian_payload = [
                        'success' => false,
                        'message' => 'Failed to create school'
                    ];
                }
            }
        }

        return $this->response($Silian_response, $Silian_payload ?? ['success' => false], $Silian_httpStatus);
    }

    // Admin: Get a single school
    public function show(Request $Silian_request, Response $Silian_response, array $Silian_args)
    {
        $Silian_school = School::find($Silian_args["id"]);
        if (!$Silian_school) {
            return $this->response($Silian_response, [
                'success' => false,
                'message' => self::ERR_SCHOOL_NOT_FOUND,
                'code' => self::CODE_SCHOOL_NOT_FOUND
            ], 404);
        }
        return $this->response($Silian_response, ["school" => $Silian_school]);
    }

    // Admin: Update an existing school
    public function update(Request $Silian_request, Response $Silian_response, array $Silian_args)
    {
        $Silian_school = School::find($Silian_args["id"]);
        if (!$Silian_school) {
            return $this->response($Silian_response, [
                'success' => false,
                'message' => self::ERR_SCHOOL_NOT_FOUND,
                'code' => self::CODE_SCHOOL_NOT_FOUND
            ], 404);
        }

        $Silian_payload = $Silian_request->getParsedBody();
        if (!is_array($Silian_payload)) {
            return $this->response($Silian_response, [
                'success' => false,
                'message' => 'Request body must be a JSON object',
                'code' => 'INVALID_REQUEST_BODY',
            ], 400);
        }

        try {
            $Silian_data = $this->sanitizeSchoolPayload($Silian_payload);
        } catch (\InvalidArgumentException $Silian_exception) {
            return $this->response($Silian_response, [
                'success' => false,
                'message' => $Silian_exception->getMessage(),
                'code' => 'VALIDATION_ERROR',
            ], 400);
        }

        $this->validate($Silian_data, [
            "name" => "string|max:255",
            "location" => "string|max:255",
            "is_active" => "boolean",
            "sort_order" => "integer"
        ]);

        $Silian_oldData = $Silian_school->toArray();
        $this->updateSchoolWithCompatibility($Silian_school, $Silian_data);

        $this->auditLogService->log(
            $Silian_request->getAttribute("user_id"),
            "School",
            $Silian_school->id,
            "update",
            "Updated school: " . $Silian_school->name,
            json_encode(array_diff_assoc($Silian_school->toArray(), $Silian_oldData))
        );

        return $this->response($Silian_response, ["school" => $Silian_school]);
    }

    // Admin: Soft delete a school
    public function delete(Request $Silian_request, Response $Silian_response, array $Silian_args)
    {
        $Silian_school = School::find($Silian_args["id"]);
        if (!$Silian_school) {
            return $this->response($Silian_response, [
                'success' => false,
                'message' => self::ERR_SCHOOL_NOT_FOUND,
                'code' => self::CODE_SCHOOL_NOT_FOUND
            ], 404);
        }

        $Silian_school->delete(); // Soft delete

        $this->auditLogService->log(
            $Silian_request->getAttribute("user_id"),
            "School",
            $Silian_school->id,
            "delete",
            "Soft deleted school: " . $Silian_school->name
        );

        return $this->response($Silian_response, ["message" => "School soft deleted successfully"]);
    }

    // Admin: Restore a soft deleted school
    public function restore(Request $Silian_request, Response $Silian_response, array $Silian_args)
    {
        $Silian_school = School::onlyTrashed()->find($Silian_args["id"]);
        if (!$Silian_school) {
            return $this->response($Silian_response, [
                'success' => false,
                'message' => 'Soft deleted school not found',
                'code' => self::CODE_SCHOOL_NOT_FOUND
            ], 404);
        }

        $Silian_school->restore();

        $this->auditLogService->log(
            $Silian_request->getAttribute("user_id"),
            "School",
            $Silian_school->id,
            "restore",
            "Restored school: " . $Silian_school->name
        );

        return $this->response($Silian_response, ["message" => "School restored successfully"]);
    }

    // Admin: Permanently delete a school
    public function forceDelete(Request $Silian_request, Response $Silian_response, array $Silian_args)
    {
        $Silian_school = School::onlyTrashed()->find($Silian_args["id"]);
        if (!$Silian_school) {
            return $this->response($Silian_response, [
                'success' => false,
                'message' => 'School not found in trash',
                'code' => self::CODE_SCHOOL_NOT_FOUND
            ], 404);
        }

        $Silian_school->forceDelete();

        $this->auditLogService->log(
            $Silian_request->getAttribute("user_id"),
            "School",
            $Silian_school->id,
            "force_delete",
            "Permanently deleted school: " . $Silian_school->name
        );

        return $this->response($Silian_response, ["message" => "School permanently deleted successfully"]);
    }

    // Admin: Get school statistics
    public function stats(Request $Silian_request, Response $Silian_response, array $Silian_args)
    {
        $Silian_totalSchools = School::count();
        $Silian_activeSchools = School::where("is_active", true)->count();
        $Silian_inactiveSchools = School::where("is_active", false)->count();
        $Silian_deletedSchools = School::onlyTrashed()->count();

        return $this->response($Silian_response, [
            "total_schools" => $Silian_totalSchools,
            "active_schools" => $Silian_activeSchools,
            "inactive_schools" => $Silian_inactiveSchools,
            "deleted_schools" => $Silian_deletedSchools,
        ]);
    }

    // Public: List classes for a school with optional fuzzy search and pagination
    public function listClasses(Request $Silian_request, Response $Silian_response, array $Silian_args)
    {
        $Silian_schoolId = (int)($Silian_args['id'] ?? 0);
        if ($Silian_schoolId <= 0) {
            return $this->response($Silian_response, [
                'success' => false,
                'message' => 'Invalid school id',
                'code' => 'INVALID_SCHOOL_ID'
            ], 400);
        }

        // Ensure school exists
        $Silian_exists = School::where('id', $Silian_schoolId)->whereNull('deleted_at')->exists();
        if (!$Silian_exists) {
            return $this->response($Silian_response, [
                'success' => false,
                'message' => self::ERR_SCHOOL_NOT_FOUND,
                'code' => self::CODE_SCHOOL_NOT_FOUND
            ], 404);
        }

        $Silian_params = $Silian_request->getQueryParams();
        $Silian_limit = (int)($Silian_params['limit'] ?? 20);
        $Silian_limit = max(1, min(100, $Silian_limit));
        $Silian_page = (int)($Silian_params['page'] ?? 1);
        $Silian_page = max(1, $Silian_page);
        $Silian_offset = ($Silian_page - 1) * $Silian_limit;
        $Silian_search = trim((string)($Silian_params['search'] ?? ''));

        $Silian_where = 'WHERE school_id = :sid AND (deleted_at IS NULL)';
        $Silian_bind = ['sid' => $Silian_schoolId];
        if ($Silian_search !== '') {
            $Silian_where .= ' AND name LIKE :kw';
            $Silian_bind['kw'] = '%' . $Silian_search . '%';
        }

        $Silian_totalStmt = $this->db->prepare("SELECT COUNT(*) FROM school_classes $Silian_where");
        $Silian_totalStmt->execute($Silian_bind);
        $Silian_total = (int)$Silian_totalStmt->fetchColumn();

        $Silian_sql = "SELECT id, school_id, name, is_active, created_at, updated_at FROM school_classes $Silian_where ORDER BY name ASC LIMIT :limit OFFSET :offset";
        $Silian_stmt = $this->db->prepare($Silian_sql);
        foreach ($Silian_bind as $Silian_k => $Silian_v) {
            $Silian_paramType = is_int($Silian_v) ? PDO::PARAM_INT : PDO::PARAM_STR;
            $Silian_stmt->bindValue(':' . $Silian_k, $Silian_v, $Silian_paramType);
        }
        $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
        $Silian_stmt->bindValue(':offset', $Silian_offset, PDO::PARAM_INT);
        $Silian_stmt->execute();
        $Silian_items = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

        return $this->response($Silian_response, [
            'success' => true,
            'data' => [
                'classes' => $Silian_items,
                'pagination' => [
                    'total_items' => $Silian_total,
                    'current_page' => $Silian_page,
                    'per_page' => $Silian_limit,
                    'total_pages' => (int)ceil($Silian_total / $Silian_limit)
                ]
            ]
        ]);
    }

    // Authenticated: Create a class for a school (idempotent by name)
    public function createClass(Request $Silian_request, Response $Silian_response, array $Silian_args)
    {
        $Silian_schoolId = (int)($Silian_args['id'] ?? 0);
        if ($Silian_schoolId <= 0) {
            return $this->response($Silian_response, [
                'success' => false,
                'message' => 'Invalid school id',
                'code' => 'INVALID_SCHOOL_ID'
            ], 400);
        }

        // Ensure school exists
        $Silian_exists = School::where('id', $Silian_schoolId)->whereNull('deleted_at')->exists();
        if (!$Silian_exists) {
            return $this->response($Silian_response, [
                'success' => false,
                'message' => self::ERR_SCHOOL_NOT_FOUND,
                'code' => self::CODE_SCHOOL_NOT_FOUND
            ], 404);
        }

        $Silian_data = $Silian_request->getParsedBody();
        $Silian_name = trim((string)($Silian_data['name'] ?? ''));
    $Silian_body = null;

        if ($Silian_name === '') {
            $Silian_httpStatus = 400;
            $Silian_body = [
                'success' => false,
                'message' => 'Class name is required',
                'code' => 'MISSING_NAME'
            ];
        } else {
            // Check existing (case-insensitive)
            $Silian_check = $this->db->prepare('SELECT id, school_id, name, is_active FROM school_classes WHERE school_id = ? AND LOWER(name) = LOWER(?) AND deleted_at IS NULL LIMIT 1');
            $Silian_check->execute([$Silian_schoolId, $Silian_name]);
            $Silian_existing = $Silian_check->fetch(PDO::FETCH_ASSOC) ?: null;
            if ($Silian_existing) {
                $Silian_httpStatus = 200;
                $Silian_body = [
                    'success' => true,
                    'data' => ['class' => $Silian_existing]
                ];
            } else {
                $Silian_ins = $this->db->prepare('INSERT INTO school_classes (school_id, name, is_active, created_at, updated_at) VALUES (?, ?, 1, NOW(), NOW())');
                $Silian_ins->execute([$Silian_schoolId, $Silian_name]);
                $Silian_id = (int)$this->db->lastInsertId();

                $Silian_sel = $this->db->prepare('SELECT id, school_id, name, is_active, created_at, updated_at FROM school_classes WHERE id = ?');
                $Silian_sel->execute([$Silian_id]);
                $Silian_row = $Silian_sel->fetch(PDO::FETCH_ASSOC);

                // 审计日志
                $this->auditLogService->log(
                    $Silian_request->getAttribute('user_id'),
                    'SchoolClass',
                    $Silian_id,
                    'create',
                    'User created class for school #' . $Silian_schoolId . ': ' . $Silian_name
                );

                $Silian_httpStatus = 201;
                $Silian_body = [
                    'success' => true,
                    'data' => ['class' => $Silian_row]
                ];
            }
        }

        return $this->response($Silian_response, $Silian_body ?? [ 'success' => false, 'message' => 'Unexpected state' ], $Silian_httpStatus);
    }


    private function logExceptionWithFallback(\Throwable $Silian_exception, Request $Silian_request, string $Silian_contextMessage = ''): void
    {
        if ($this->errorLogService) {
            try {
                $Silian_extra = $Silian_contextMessage !== '' ? ['context_message' => $Silian_contextMessage] : [];
                $this->errorLogService->logException($Silian_exception, $Silian_request, $Silian_extra);
                return;
            } catch (\Throwable $Silian_loggingError) {
                error_log('ErrorLogService logging failed: ' . $Silian_loggingError->getMessage());
            }
        }
        if ($Silian_contextMessage !== '') {
            error_log($Silian_contextMessage);
        } else {
            error_log($Silian_exception->getMessage());
        }
    }

    /**
     * @param mixed $payload
     * @return array<string,mixed>
     */
    private function sanitizeSchoolPayload(mixed $Silian_payload): array
    {
        if (!is_array($Silian_payload)) {
            throw new \InvalidArgumentException('Request body must be a JSON object');
        }

        if (array_key_exists('is_active', $Silian_payload)) {
            $Silian_payload['is_active'] = InputValueNormalizer::boolean($Silian_payload['is_active'], 'is_active');
        }

        if (array_key_exists('sort_order', $Silian_payload)) {
            $Silian_payload['sort_order'] = InputValueNormalizer::integer($Silian_payload['sort_order'], 'sort_order');
        }

        return $Silian_payload;
    }

    /**
     * @param array<string,mixed> $data
     */
    private function createSchoolWithCompatibility(array $Silian_data): School
    {
        try {
            return School::create($Silian_data);
        } catch (QueryException $Silian_exception) {
            if (!$this->shouldRetryWithoutSortOrder($Silian_data, $Silian_exception)) {
                throw $Silian_exception;
            }

            return School::create($this->withoutSortOrder($Silian_data));
        }
    }

    /**
     * @param array<string,mixed> $data
     */
    private function updateSchoolWithCompatibility(School $Silian_school, array $Silian_data): void
    {
        if ($Silian_data === []) {
            return;
        }

        try {
            $Silian_school->update($Silian_data);
        } catch (QueryException $Silian_exception) {
            if (!$this->shouldRetryWithoutSortOrder($Silian_data, $Silian_exception)) {
                throw $Silian_exception;
            }

            $Silian_retryData = $this->withoutSortOrder($Silian_data);
            if ($Silian_retryData !== []) {
                $Silian_school->update($Silian_retryData);
            }
        }
    }

    /**
     * @param array<string,mixed> $data
     */
    private function shouldRetryWithoutSortOrder(array $Silian_data, QueryException $Silian_exception): bool
    {
        if (!array_key_exists('sort_order', $Silian_data)) {
            return false;
        }

        $Silian_message = strtolower($Silian_exception->getMessage());
        if (!str_contains($Silian_message, 'sort_order')) {
            return false;
        }

        foreach (['unknown column', 'no such column', 'has no column named', 'undefined column'] as $Silian_needle) {
            if (str_contains($Silian_message, $Silian_needle)) {
                return true;
            }
        }

        return false;
    }

    /**
     * @param array<string,mixed> $data
     * @return array<string,mixed>
     */
    private function withoutSortOrder(array $Silian_data): array
    {
        unset($Silian_data['sort_order']);

        return $Silian_data;
    }

}
