<?php
declare(strict_types=1);

namespace CarbonTrack\Controllers;

use Psr\Http\Message\ServerRequestInterface as Request;
use Psr\Http\Message\ResponseInterface as Response;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Support\RequestIdNormalizer;
use PDO;

/**
 * LogSearchController
 * 统一搜索 system_logs / audit_logs / error_logs
 * GET /api/v1/admin/logs/search
 * Query params:
 *   q: mixed keyword (LIKE)
 *   date_from, date_to
 *   types: comma list (system,audit,error) default all
 *   limit_per_type: each category page size (default 50, max 200)
 *   system_page / audit_page / error_page: 页码(>=1) 分别控制三类分页
 */
class LogSearchController
{
    private PDO $db;
    private AuthService $authService;
    private AuditLogService $auditLogService;
    private ?ErrorLogService $errorLogService;
    private const SEP_AND = ' AND ';
    private const KW_WHERE = 'WHERE ';
    private const LIMIT_PARAM = ':limit';
    private const OFFSET_PARAM = ':offset';

    public function __construct(PDO $Silian_db, AuthService $Silian_authService, AuditLogService $Silian_auditLogService, ErrorLogService $Silian_errorLogService = null)
    {
        $this->db = $Silian_db;
        $this->authService = $Silian_authService;
        $this->auditLogService = $Silian_auditLogService;
        $this->errorLogService = $Silian_errorLogService;
    }

    public function search(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_admin = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_admin || !$this->authService->isAdminUser($Silian_admin)) {
                return $this->json($Silian_response, ['error' => 'Access denied'], 403);
            }

            $Silian_q = $Silian_request->getQueryParams();
            $Silian_keyword = trim((string)($Silian_q['q'] ?? ''));
            $Silian_types = isset($Silian_q['types']) ? array_filter(array_map('trim', explode(',', (string)$Silian_q['types']))) : ['system','audit','error','llm'];
            if (!$Silian_types) { $Silian_types = ['system','audit','error','llm']; }
            $Silian_limit = (int)($Silian_q['limit_per_type'] ?? 50); $Silian_limit = max(1, min(200, $Silian_limit));
            $Silian_systemPage = max(1, (int)($Silian_q['system_page'] ?? 1));
            $Silian_auditPage = max(1, (int)($Silian_q['audit_page'] ?? 1));
            $Silian_errorPage = max(1, (int)($Silian_q['error_page'] ?? 1));
            $Silian_llmPage = max(1, (int)($Silian_q['llm_page'] ?? 1));
            $Silian_dateFrom = $Silian_q['date_from'] ?? null;
            $Silian_dateTo = $Silian_q['date_to'] ?? null;
            $Silian_conversationId = $this->normalizeConversationId($Silian_q['conversation_id'] ?? null);
            $Silian_conversationRequestIds = $Silian_conversationId !== null
                ? $this->findRequestIdsByConversation($Silian_conversationId)
                : [];

            // new explicit filter params
            $Silian_systemFilters = [
                'method' => $Silian_q['method'] ?? null,
                'status_code' => $Silian_q['status_code'] ?? null,
                'user_id' => $Silian_q['user_id'] ?? null,
                'request_id' => $Silian_q['request_id'] ?? null,
                'path' => $Silian_q['path'] ?? null,
                'min_duration' => $Silian_q['min_duration'] ?? null,
                'max_duration' => $Silian_q['max_duration'] ?? null,
                'conversation_id' => $Silian_conversationId,
                'request_ids' => $Silian_conversationRequestIds,
            ];
            $Silian_auditFilters = [
                'user_id' => $Silian_q['user_id'] ?? null,
                'action' => $Silian_q['action'] ?? null,
                'status' => $Silian_q['audit_status'] ?? null,
                'request_id' => $Silian_q['request_id'] ?? null,
                'conversation_id' => $Silian_conversationId,
            ];
            $Silian_errorFilters = [
                'error_type' => $Silian_q['error_type'] ?? null,
                'request_id' => $Silian_q['request_id'] ?? null,
                'conversation_id' => $Silian_conversationId,
                'request_ids' => $Silian_conversationRequestIds,
            ];
            $Silian_llmFilters = [
                'actor_type' => $Silian_q['actor_type'] ?? null,
                'actor_id' => $Silian_q['actor_id'] ?? ($Silian_q['user_id'] ?? null),
                'status' => $Silian_q['llm_status'] ?? null,
                'model' => $Silian_q['model'] ?? null,
                'source' => $Silian_q['source'] ?? null,
                'request_id' => $Silian_q['request_id'] ?? null,
                'conversation_id' => $Silian_conversationId,
                'turn_no' => $Silian_q['turn_no'] ?? null,
            ];

            $Silian_result = [];
            if (in_array('system', $Silian_types, true)) {
                $Silian_result['system'] = $this->searchSystem($Silian_keyword, $Silian_limit, $Silian_dateFrom, $Silian_dateTo, $Silian_systemPage, $Silian_systemFilters);
            }
            if (in_array('audit', $Silian_types, true)) {
                $Silian_result['audit'] = $this->searchAudit($Silian_keyword, $Silian_limit, $Silian_dateFrom, $Silian_dateTo, $Silian_auditPage, $Silian_auditFilters);
            }
            if (in_array('error', $Silian_types, true)) {
                $Silian_result['error'] = $this->searchError($Silian_keyword, $Silian_limit, $Silian_dateFrom, $Silian_dateTo, $Silian_errorPage, $Silian_errorFilters);
            }
            if (in_array('llm', $Silian_types, true)) {
                $Silian_result['llm'] = $this->searchLlm($Silian_keyword, $Silian_limit, $Silian_dateFrom, $Silian_dateTo, $Silian_llmPage, $Silian_llmFilters);
            }

            $this->logAudit('admin_logs_search_viewed', $Silian_admin, $Silian_request, [
                'data' => [
                    'keyword_present' => $Silian_keyword !== '',
                    'types' => $Silian_types,
                    'limit' => $Silian_limit,
                ],
            ]);

            return $this->json($Silian_response, ['success' => true, 'data' => $Silian_result]);
        } catch (\Exception $Silian_e) {
            try { $this->errorLogService?->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { /* swallow secondary */ }
            $this->logAudit('admin_logs_search_failed', null, $Silian_request, [
                'data' => ['error' => $Silian_e->getMessage()],
            ], 'failed');
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

        /**
         * 导出日志 (CSV / NDJSON)
         */
        public function export(Request $Silian_request, Response $Silian_response): Response
        {
            try {
                $Silian_admin = $this->authService->getCurrentUser($Silian_request);
                if (!$Silian_admin || !$this->authService->isAdminUser($Silian_admin)) {
                    return $this->json($Silian_response, ['error' => 'Access denied'], 403);
                }

                $Silian_q = $Silian_request->getQueryParams();
                $Silian_format = strtolower($Silian_q['format'] ?? 'csv');
                if (!in_array($Silian_format, ['csv','ndjson'], true)) {
                    return $this->json($Silian_response, ['success'=>false,'message'=>'format must be csv or ndjson'], 400);
                }
                $Silian_keyword = trim((string)($Silian_q['q'] ?? ''));
                $Silian_dateFrom = $Silian_q['date_from'] ?? null;
                $Silian_dateTo = $Silian_q['date_to'] ?? null;
                $Silian_conversationId = $this->normalizeConversationId($Silian_q['conversation_id'] ?? null);
                $Silian_conversationRequestIds = $Silian_conversationId !== null
                    ? $this->findRequestIdsByConversation($Silian_conversationId)
                    : [];
                $Silian_types = isset($Silian_q['types']) && $Silian_q['types'] !== '' ? array_values(array_filter(array_map('trim', explode(',', $Silian_q['types'])))) : ['system','audit','error','llm'];
                $Silian_allowed = ['system','audit','error','llm'];
                $Silian_types = array_values(array_intersect($Silian_types, $Silian_allowed));
                if (!$Silian_types) { $Silian_types = ['system','audit','error','llm']; }
                $Silian_max = (int)($Silian_q['max'] ?? 1000); $Silian_max = max(1, min(10000, $Silian_max));

                // 收集每类记录（最多 max / count(types) 各自抓取 或 统一累积直到总数达到）
                $Silian_perTypeCap = (int)ceil($Silian_max / max(1,count($Silian_types)));

                $Silian_datasets = [];
                foreach ($Silian_types as $Silian_t) {
                    $Silian_datasets[$Silian_t] = $this->exportFetch($Silian_t, $Silian_keyword, $Silian_dateFrom, $Silian_dateTo, $Silian_perTypeCap, [
                        'request_id' => $Silian_q['request_id'] ?? null,
                        'conversation_id' => $Silian_conversationId,
                        'request_ids' => $Silian_conversationRequestIds,
                        'actor_type' => $Silian_q['actor_type'] ?? null,
                        'actor_id' => $Silian_q['actor_id'] ?? ($Silian_q['user_id'] ?? null),
                        'status' => $Silian_q['llm_status'] ?? null,
                        'model' => $Silian_q['model'] ?? null,
                        'source' => $Silian_q['source'] ?? null,
                        'turn_no' => $Silian_q['turn_no'] ?? null,
                        'user_id' => $Silian_q['user_id'] ?? null,
                        'action' => $Silian_q['action'] ?? null,
                        'audit_status' => $Silian_q['audit_status'] ?? null,
                        'error_type' => $Silian_q['error_type'] ?? null,
                    ]);
                }

                $this->logAudit('admin_logs_exported', $Silian_admin, $Silian_request, [
                    'data' => [
                        'format' => $Silian_format,
                        'types' => $Silian_types,
                        'max' => $Silian_max,
                    ],
                ]);

                if ($Silian_format === 'csv') {
                    $Silian_filename = 'logs_export_' . date('Ymd_His') . '.csv';
                    $Silian_response = $Silian_response->withHeader('Content-Type', 'text/csv; charset=UTF-8')
                                         ->withHeader('Content-Disposition', 'attachment; filename="' . $Silian_filename . '"');
                    $Silian_fh = fopen('php://temp','w+');
                    // 统一列: type,id,request_id,method,path,status_code,user_id,duration_ms,created_at,action,operation_category,actor_type,audit_status,error_type,error_message,error_file,error_line,error_time,actor_id,source,model,llm_status,prompt,response_id,prompt_tokens,completion_tokens,total_tokens,latency_ms
                    $Silian_header = [
                        'type','id','conversation_id','turn_no','request_id','method','path','status_code','user_id','duration_ms','created_at',
                        'action','operation_category','actor_type','audit_status','error_type','error_message','error_file',
                        'error_line','error_time','actor_id','source','model','llm_status','prompt','response_id',
                        'prompt_tokens','completion_tokens','total_tokens','latency_ms'
                    ];
                    fputcsv($Silian_fh, $Silian_header);
                    foreach ($Silian_datasets as $Silian_type => $Silian_rows) {
                        foreach ($Silian_rows as $Silian_r) {
                            fputcsv($Silian_fh, [
                                $Silian_type,
                                $Silian_r['id'] ?? null,
                                $Silian_r['conversation_id'] ?? null,
                                $Silian_r['turn_no'] ?? null,
                                $Silian_r['request_id'] ?? null,
                                $Silian_r['method'] ?? null,
                                $Silian_r['path'] ?? null,
                                $Silian_r['status_code'] ?? null,
                                $Silian_r['user_id'] ?? null,
                                $Silian_r['duration_ms'] ?? null,
                                $Silian_r['created_at'] ?? null,
                                $Silian_r['action'] ?? null,
                                $Silian_r['operation_category'] ?? null,
                                $Silian_r['actor_type'] ?? null,
                                $Silian_r['status'] ?? null,
                                $Silian_r['error_type'] ?? null,
                                $Silian_r['error_message'] ?? null,
                                $Silian_r['error_file'] ?? null,
                                $Silian_r['error_line'] ?? null,
                                $Silian_r['error_time'] ?? null,
                                $Silian_r['actor_id'] ?? null,
                                $Silian_r['source'] ?? null,
                                $Silian_r['model'] ?? null,
                                $Silian_r['status'] ?? null,
                                $Silian_r['prompt'] ?? null,
                                $Silian_r['response_id'] ?? null,
                                $Silian_r['prompt_tokens'] ?? null,
                                $Silian_r['completion_tokens'] ?? null,
                                $Silian_r['total_tokens'] ?? null,
                                $Silian_r['latency_ms'] ?? null,
                            ]);
                        }
                    }
                    rewind($Silian_fh);
                    $Silian_csv = stream_get_contents($Silian_fh) ?: '';
                    fclose($Silian_fh);
                    $Silian_response->getBody()->write($Silian_csv);
                    return $Silian_response;
                }

                // NDJSON
                $Silian_response = $Silian_response->withHeader('Content-Type', 'application/x-ndjson')
                                     ->withHeader('Content-Disposition', 'attachment; filename="logs_export_' . date('Ymd_His') . '.ndjson"');
                $Silian_body = $Silian_response->getBody();
                foreach ($Silian_datasets as $Silian_type => $Silian_rows) {
                    foreach ($Silian_rows as $Silian_r) {
                        $Silian_r['type'] = $Silian_type;
                        $Silian_body->write(json_encode($Silian_r, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES) . "\n");
                    }
                }
                return $Silian_response;
            } catch (\Throwable $Silian_e) {
                try { $this->errorLogService?->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { /* swallow secondary */ }
                $this->logAudit('admin_logs_export_failed', null, $Silian_request, [
                    'data' => ['error' => $Silian_e->getMessage()],
                ], 'failed');
                return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
            }
        }

        /**
         * 获取关联日志 (audit + error by request_id)
         */
        public function related(Request $Silian_request, Response $Silian_response): Response
        {
            try {
                $Silian_admin = $this->authService->getCurrentUser($Silian_request);
                if (!$Silian_admin || !$this->authService->isAdminUser($Silian_admin)) {
                    return $this->json($Silian_response, ['error' => 'Access denied'], 403);
                }

                $Silian_q = $Silian_request->getQueryParams();
                $Silian_rid = RequestIdNormalizer::normalize($Silian_q['request_id'] ?? null);
                if ($Silian_rid === null) {
                    return $this->json($Silian_response, ['success'=>false,'message'=>'request_id required'], 400);
                }
                $Silian_system = $this->fetchByRequestId('system_logs', $Silian_rid, ['id','request_id','method','path','status_code','user_id','duration_ms','created_at']);
                $Silian_audit = $this->fetchByRequestId('audit_logs', $Silian_rid, ['id','conversation_id','request_id','action','operation_category','actor_type','status','user_id','ip_address','created_at']);
                $Silian_error = $this->fetchByRequestId('error_logs', $Silian_rid, ['id','request_id','error_type','error_message','error_file','error_line','error_time']);
                $Silian_llm = $this->fetchByRequestId('llm_logs', $Silian_rid, ['id','conversation_id','request_id','turn_no','actor_type','actor_id','source','model','status','prompt','response_id','total_tokens','latency_ms','created_at']);

                $this->logAudit('admin_logs_related_viewed', $Silian_admin, $Silian_request, [
                    'data' => ['request_id' => $Silian_rid],
                ]);

                return $this->json($Silian_response, ['success'=>true,'data'=>[
                    'request_id' => $Silian_rid,
                    'system' => $Silian_system,
                    'audit' => $Silian_audit,
                    'error' => $Silian_error,
                    'llm' => $Silian_llm
                ]]);
            } catch (\Throwable $Silian_e) {
                try { $this->errorLogService?->logException($Silian_e, $Silian_request); } catch (\Throwable $Silian_ignore) { /* swallow secondary */ }
                $this->logAudit('admin_logs_related_failed', null, $Silian_request, [
                    'data' => ['error' => $Silian_e->getMessage()],
                ], 'failed');
                return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
            }
        }

        private function logAudit(string $Silian_action, ?array $Silian_admin, Request $Silian_request, array $Silian_context = [], string $Silian_status = 'success'): void
        {
            try {
                $Silian_adminId = isset($Silian_admin['id']) && is_numeric((string)$Silian_admin['id']) ? (int)$Silian_admin['id'] : null;
                $this->auditLogService->logAdminOperation($Silian_action, $Silian_adminId, 'log_search', array_merge([
                    'request_id' => $Silian_request->getAttribute('request_id'),
                    'request_method' => $Silian_request->getMethod(),
                    'endpoint' => (string)$Silian_request->getUri()->getPath(),
                    'status' => $Silian_status,
                    'request_data' => $Silian_context['data'] ?? null,
                ], $Silian_context));
            } catch (\Throwable $Silian_ignore) {
                // 审计日志失败不阻断主流程
            }
        }

        private function fetchByRequestId(string $Silian_table, string $Silian_rid, array $Silian_columns): array
        {
            $Silian_cols = implode(',', $Silian_columns);
            $Silian_sql = "SELECT $Silian_cols FROM {$Silian_table} WHERE request_id = :rid ORDER BY id DESC LIMIT 200"; // 安全上限
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->bindValue(':rid', $Silian_rid);
            $Silian_stmt->execute();
            return $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        }

        private function exportFetch(string $Silian_type, string $Silian_kw, ?string $Silian_from, ?string $Silian_to, int $Silian_limit, array $Silian_filters = []): array
        {
            switch ($Silian_type) {
                case 'system':
                    return $this->rawFetch(
                        'system_logs',
                        ['id','request_id','method','path','status_code','user_id','duration_ms','created_at'],
                        ['method','path','request_body','response_body','error_message','server_meta'],
                        $Silian_kw,
                        $Silian_limit,
                        ['from'=>$Silian_from,'to'=>$Silian_to,'date'=>'created_at'],
                        $Silian_filters
                    );
                case 'audit':
                    return $this->rawFetch(
                        'audit_logs',
                        ['id','conversation_id','action','operation_category','actor_type','status','user_id','ip_address','created_at','request_id'],
                        ['action','operation_category','details_raw','summary','old_data','new_data'],
                        $Silian_kw,
                        $Silian_limit,
                        ['from'=>$Silian_from,'to'=>$Silian_to,'date'=>'created_at'],
                        $Silian_filters
                    );
                case 'error':
                    return $this->rawFetch(
                        'error_logs',
                        ['id','error_type','error_message','error_file','error_line','error_time','request_id'],
                        ['error_type','error_message','error_file','stack_trace'],
                        $Silian_kw,
                        $Silian_limit,
                        ['from'=>$Silian_from,'to'=>$Silian_to,'date'=>'error_time'],
                        $Silian_filters
                    );
                case 'llm':
                    return $this->rawFetch(
                        'llm_logs',
                        ['id','conversation_id','turn_no','request_id','actor_type','actor_id','source','model','status','prompt','response_id','prompt_tokens','completion_tokens','total_tokens','latency_ms','created_at'],
                        ['prompt','response_raw','source','model','error_message','request_id'],
                        $Silian_kw,
                        $Silian_limit,
                        ['from'=>$Silian_from,'to'=>$Silian_to,'date'=>'created_at'],
                        $Silian_filters
                    );
                default:
                    return [];
            }
        }

        private function rawFetch(string $Silian_table, array $Silian_selectCols, array $Silian_likeCols, string $Silian_kw, int $Silian_limit, array $Silian_dateFilter, array $Silian_filters = []): array
        {
            $Silian_conditions = [];
            $Silian_params = [];
            $Silian_from = $Silian_dateFilter['from'] ?? null;
            $Silian_to = $Silian_dateFilter['to'] ?? null;
            $Silian_dateColumn = $Silian_dateFilter['date'] ?? 'created_at';
            if ($Silian_kw !== '') {
                $Silian_likeParts = [];
                foreach ($Silian_likeCols as $Silian_i => $Silian_col) {
                    $Silian_p = 'k' . $Silian_i;
                    $Silian_likeParts[] = "$Silian_col LIKE :$Silian_p";
                    $Silian_params[$Silian_p] = '%' . $Silian_kw . '%';
                }
                $Silian_conditions[] = '(' . implode(' OR ', $Silian_likeParts) . ')';
            }
            if ($Silian_from) { $Silian_conditions[] = "$Silian_dateColumn >= :dfrom"; $Silian_params['dfrom'] = $Silian_from . ' 00:00:00'; }
            if ($Silian_to) { $Silian_conditions[] = "$Silian_dateColumn <= :dto"; $Silian_params['dto'] = $Silian_to . ' 23:59:59'; }
            $this->applyRawFetchFilters($Silian_table, $Silian_conditions, $Silian_params, $Silian_filters);
            $Silian_where = $Silian_conditions ? ('WHERE ' . implode(' AND ', $Silian_conditions)) : '';
            $Silian_cols = implode(',', $Silian_selectCols);
            $Silian_sql = "SELECT $Silian_cols FROM {$Silian_table} $Silian_where ORDER BY id DESC LIMIT :limit";
            $Silian_stmt = $this->db->prepare($Silian_sql);
            foreach ($Silian_params as $Silian_k=>$Silian_v) { $Silian_stmt->bindValue(':'.$Silian_k, $Silian_v); }
            $Silian_stmt->bindValue(':limit', $Silian_limit, PDO::PARAM_INT);
            $Silian_stmt->execute();
            return $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        }

    private function searchSystem(string $Silian_kw, int $Silian_limit, ?string $Silian_from, ?string $Silian_to, int $Silian_page, array $Silian_filters = []): array
    {
        $Silian_conditions = [];
        $Silian_params = [];
        $Silian_conversationId = $this->normalizeConversationId($Silian_filters['conversation_id'] ?? null);
        if ($Silian_kw !== '') {
            $Silian_likeCols = ['path','request_id','method','user_agent','ip_address','request_body','response_body','server_meta'];
            $Silian_likeParts = [];
            foreach ($Silian_likeCols as $Silian_i => $Silian_col) {
                $Silian_ph = ':kw_s_' . $Silian_i;
                $Silian_likeParts[] = "$Silian_col LIKE $Silian_ph";
                $Silian_params['kw_s_' . $Silian_i] = '%' . $Silian_kw . '%';
            }
            $Silian_conditions[] = '(' . implode(' OR ', $Silian_likeParts) . ')';
        }
        if ($Silian_from) { $Silian_conditions[] = 'created_at >= :from'; $Silian_params['from'] = $this->normalizeStart($Silian_from); }
        if ($Silian_to) { $Silian_conditions[] = 'created_at <= :to'; $Silian_params['to'] = $this->normalizeEnd($Silian_to); }
        if (!empty($Silian_filters['method'])) { $Silian_conditions[] = 'method = :f_method'; $Silian_params['f_method'] = $Silian_filters['method']; }
        if (!empty($Silian_filters['status_code'])) { $Silian_conditions[] = 'status_code = :f_status'; $Silian_params['f_status'] = (int)$Silian_filters['status_code']; }
        if (!empty($Silian_filters['user_id'])) { $Silian_conditions[] = 'user_id = :f_user'; $Silian_params['f_user'] = (int)$Silian_filters['user_id']; }
        $Silian_rid = RequestIdNormalizer::normalize($Silian_filters['request_id'] ?? null);
        if ($Silian_rid !== null) {
            $Silian_conditions[] = 'request_id = :f_rid';
            $Silian_params['f_rid'] = $Silian_rid;
        }
        if (!empty($Silian_filters['path'])) { $Silian_conditions[] = 'path LIKE :f_path'; $Silian_params['f_path'] = '%' . $Silian_filters['path'] . '%'; }
        if (!empty($Silian_filters['min_duration'])) { $Silian_conditions[] = 'duration_ms >= :f_min_d'; $Silian_params['f_min_d'] = (int)$Silian_filters['min_duration']; }
        if (!empty($Silian_filters['max_duration'])) { $Silian_conditions[] = 'duration_ms <= :f_max_d'; $Silian_params['f_max_d'] = (int)$Silian_filters['max_duration']; }
        if ($Silian_conversationId !== null) {
            $Silian_requestIds = is_array($Silian_filters['request_ids'] ?? null) ? array_values(array_filter($Silian_filters['request_ids'], static fn ($Silian_id) => is_string($Silian_id) && $Silian_id !== '')) : [];
            if ($Silian_requestIds === []) {
                return [ 'items' => [], 'count' => 0, 'page' => $Silian_page, 'pages' => 0, 'limit' => $Silian_limit ];
            }
            $this->appendInCondition($Silian_conditions, $Silian_params, 'request_id', $Silian_requestIds, 'sys_conv_req');
        }
        $Silian_where = $Silian_conditions ? (self::KW_WHERE . implode(self::SEP_AND, $Silian_conditions)) : '';
        $Silian_offset = ($Silian_page - 1) * $Silian_limit;
        $Silian_sql = "SELECT id, request_id, method, path, status_code, user_id, duration_ms, created_at FROM system_logs {$Silian_where} ORDER BY id DESC LIMIT :limit OFFSET :offset";
        $Silian_stmt = $this->db->prepare($Silian_sql);
        foreach ($Silian_params as $Silian_k=>$Silian_v) { $Silian_stmt->bindValue(':' . $Silian_k, $Silian_v); }
        $Silian_stmt->bindValue(self::LIMIT_PARAM, $Silian_limit, PDO::PARAM_INT);
        $Silian_stmt->bindValue(self::OFFSET_PARAM, $Silian_offset, PDO::PARAM_INT);
        $Silian_stmt->execute();
        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $Silian_total = $this->countRows('system_logs', $Silian_where, $Silian_params);
        return [ 'items' => $Silian_rows, 'count' => (int)$Silian_total, 'page' => $Silian_page, 'pages' => (int)ceil($Silian_total / $Silian_limit), 'limit' => $Silian_limit ];
    }

    private function searchAudit(string $Silian_kw, int $Silian_limit, ?string $Silian_from, ?string $Silian_to, int $Silian_page, array $Silian_filters = []): array
    {
        $Silian_conditions = [];
        $Silian_params = [];
        $Silian_conversationId = $this->normalizeConversationId($Silian_filters['conversation_id'] ?? null);
        if ($Silian_kw !== '') {
            $Silian_likeCols = ['action','operation_category','operation_subtype','endpoint','ip_address','data','old_data','new_data'];
            $Silian_likeParts = [];
            foreach ($Silian_likeCols as $Silian_i => $Silian_col) {
                $Silian_ph = ':kw_a_' . $Silian_i;
                $Silian_likeParts[] = "$Silian_col LIKE $Silian_ph";
                $Silian_params['kw_a_' . $Silian_i] = '%' . $Silian_kw . '%';
            }
            $Silian_conditions[] = '(' . implode(' OR ', $Silian_likeParts) . ')';
        }
        if ($Silian_from) { $Silian_conditions[] = 'created_at >= :from'; $Silian_params['from'] = $this->normalizeStart($Silian_from); }
        if ($Silian_to) { $Silian_conditions[] = 'created_at <= :to'; $Silian_params['to'] = $this->normalizeEnd($Silian_to); }
        if (!empty($Silian_filters['user_id'])) { $Silian_conditions[] = 'user_id = :a_user'; $Silian_params['a_user'] = (int)$Silian_filters['user_id']; }
        if (!empty($Silian_filters['action'])) { $Silian_conditions[] = 'action = :a_action'; $Silian_params['a_action'] = $Silian_filters['action']; }
        if (!empty($Silian_filters['status'])) { $Silian_conditions[] = 'status = :a_status'; $Silian_params['a_status'] = $Silian_filters['status']; }
        if ($Silian_conversationId !== null) { $Silian_conditions[] = 'conversation_id = :a_conversation_id'; $Silian_params['a_conversation_id'] = $Silian_conversationId; }
        $Silian_rid = RequestIdNormalizer::normalize($Silian_filters['request_id'] ?? null);
        if ($Silian_rid !== null) {
            $Silian_conditions[] = 'request_id = :a_rid';
            $Silian_params['a_rid'] = $Silian_rid;
        }
        $Silian_where = $Silian_conditions ? (self::KW_WHERE . implode(self::SEP_AND, $Silian_conditions)) : '';
        $Silian_offset = ($Silian_page - 1) * $Silian_limit;
    // Include old_data & new_data for diff visualization on frontend (may be NULL for many rows)
    $Silian_sql = "SELECT id, user_id, conversation_id, request_id, actor_type, action, operation_category, status, ip_address, created_at, old_data, new_data FROM audit_logs {$Silian_where} ORDER BY id DESC LIMIT :limit OFFSET :offset";
        $Silian_stmt = $this->db->prepare($Silian_sql);
        foreach ($Silian_params as $Silian_k=>$Silian_v) { $Silian_stmt->bindValue(':' . $Silian_k, $Silian_v); }
        $Silian_stmt->bindValue(self::LIMIT_PARAM, $Silian_limit, PDO::PARAM_INT);
        $Silian_stmt->bindValue(self::OFFSET_PARAM, $Silian_offset, PDO::PARAM_INT);
        $Silian_stmt->execute();
        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $Silian_total = $this->countRows('audit_logs', $Silian_where, $Silian_params);
        return [ 'items' => $Silian_rows, 'count' => (int)$Silian_total, 'page' => $Silian_page, 'pages' => (int)ceil($Silian_total / $Silian_limit), 'limit' => $Silian_limit ];
    }

    private function searchError(string $Silian_kw, int $Silian_limit, ?string $Silian_from, ?string $Silian_to, int $Silian_page, array $Silian_filters = []): array
    {
        $Silian_conditions = [];
        $Silian_params = [];
        $Silian_conversationId = $this->normalizeConversationId($Silian_filters['conversation_id'] ?? null);
        if ($Silian_kw !== '') {
            $Silian_likeCols = ['error_type','error_message','error_file','script_name','client_get','client_post'];
            $Silian_likeParts = [];
            foreach ($Silian_likeCols as $Silian_i => $Silian_col) {
                $Silian_ph = ':kw_e_' . $Silian_i;
                $Silian_likeParts[] = "$Silian_col LIKE $Silian_ph";
                $Silian_params['kw_e_' . $Silian_i] = '%' . $Silian_kw . '%';
            }
            $Silian_conditions[] = '(' . implode(' OR ', $Silian_likeParts) . ')';
        }
        if ($Silian_from) { $Silian_conditions[] = 'error_time >= :from'; $Silian_params['from'] = $this->normalizeStart($Silian_from); }
        if ($Silian_to) { $Silian_conditions[] = 'error_time <= :to'; $Silian_params['to'] = $this->normalizeEnd($Silian_to); }
        if (!empty($Silian_filters['error_type'])) { $Silian_conditions[] = 'error_type = :e_type'; $Silian_params['e_type'] = $Silian_filters['error_type']; }
        $Silian_rid = RequestIdNormalizer::normalize($Silian_filters['request_id'] ?? null);
        if ($Silian_rid !== null) {
            $Silian_conditions[] = 'request_id = :e_rid';
            $Silian_params['e_rid'] = $Silian_rid;
        }
        if ($Silian_conversationId !== null) {
            $Silian_requestIds = is_array($Silian_filters['request_ids'] ?? null) ? array_values(array_filter($Silian_filters['request_ids'], static fn ($Silian_id) => is_string($Silian_id) && $Silian_id !== '')) : [];
            if ($Silian_requestIds === []) {
                return [ 'items' => [], 'count' => 0, 'page' => $Silian_page, 'pages' => 0, 'limit' => $Silian_limit ];
            }
            $this->appendInCondition($Silian_conditions, $Silian_params, 'request_id', $Silian_requestIds, 'err_conv_req');
        }
        $Silian_where = $Silian_conditions ? (self::KW_WHERE . implode(self::SEP_AND, $Silian_conditions)) : '';
        $Silian_offset = ($Silian_page - 1) * $Silian_limit;
        $Silian_sql = "SELECT id, request_id, error_type, error_message, error_file, error_line, error_time FROM error_logs {$Silian_where} ORDER BY id DESC LIMIT :limit OFFSET :offset";
        $Silian_stmt = $this->db->prepare($Silian_sql);
        foreach ($Silian_params as $Silian_k=>$Silian_v) { $Silian_stmt->bindValue(':' . $Silian_k, $Silian_v); }
        $Silian_stmt->bindValue(self::LIMIT_PARAM, $Silian_limit, PDO::PARAM_INT);
        $Silian_stmt->bindValue(self::OFFSET_PARAM, $Silian_offset, PDO::PARAM_INT);
        $Silian_stmt->execute();
        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $Silian_total = $this->countRows('error_logs', $Silian_where, $Silian_params);
        return [ 'items' => $Silian_rows, 'count' => (int)$Silian_total, 'page' => $Silian_page, 'pages' => (int)ceil($Silian_total / $Silian_limit), 'limit' => $Silian_limit ];
    }

    private function searchLlm(string $Silian_kw, int $Silian_limit, ?string $Silian_from, ?string $Silian_to, int $Silian_page, array $Silian_filters = []): array
    {
        $Silian_conditions = [];
        $Silian_params = [];
        $Silian_conversationId = $this->normalizeConversationId($Silian_filters['conversation_id'] ?? null);
        if ($Silian_kw !== '') {
            $Silian_likeCols = ['prompt','response_raw','source','model','error_message','request_id'];
            $Silian_likeParts = [];
            foreach ($Silian_likeCols as $Silian_i => $Silian_col) {
                $Silian_ph = ':kw_l_' . $Silian_i;
                $Silian_likeParts[] = "$Silian_col LIKE $Silian_ph";
                $Silian_params['kw_l_' . $Silian_i] = '%' . $Silian_kw . '%';
            }
            $Silian_conditions[] = '(' . implode(' OR ', $Silian_likeParts) . ')';
        }
        if ($Silian_from) { $Silian_conditions[] = 'created_at >= :from'; $Silian_params['from'] = $this->normalizeStart($Silian_from); }
        if ($Silian_to) { $Silian_conditions[] = 'created_at <= :to'; $Silian_params['to'] = $this->normalizeEnd($Silian_to); }
        if (!empty($Silian_filters['actor_type'])) { $Silian_conditions[] = 'actor_type = :l_actor_type'; $Silian_params['l_actor_type'] = $Silian_filters['actor_type']; }
        if (!empty($Silian_filters['actor_id'])) { $Silian_conditions[] = 'actor_id = :l_actor_id'; $Silian_params['l_actor_id'] = (int)$Silian_filters['actor_id']; }
        if (!empty($Silian_filters['status'])) { $Silian_conditions[] = 'status = :l_status'; $Silian_params['l_status'] = $Silian_filters['status']; }
        if (!empty($Silian_filters['model'])) { $Silian_conditions[] = 'model LIKE :l_model'; $Silian_params['l_model'] = '%' . $Silian_filters['model'] . '%'; }
        if (!empty($Silian_filters['source'])) { $Silian_conditions[] = 'source LIKE :l_source'; $Silian_params['l_source'] = '%' . $Silian_filters['source'] . '%'; }
        if ($Silian_conversationId !== null) { $Silian_conditions[] = 'conversation_id = :l_conversation_id'; $Silian_params['l_conversation_id'] = $Silian_conversationId; }
        if (!empty($Silian_filters['turn_no']) && is_numeric((string) $Silian_filters['turn_no'])) {
            $Silian_conditions[] = 'turn_no = :l_turn_no';
            $Silian_params['l_turn_no'] = (int) $Silian_filters['turn_no'];
        }
        $Silian_rid = RequestIdNormalizer::normalize($Silian_filters['request_id'] ?? null);
        if ($Silian_rid !== null) {
            $Silian_conditions[] = 'request_id = :l_rid';
            $Silian_params['l_rid'] = $Silian_rid;
        }
        $Silian_where = $Silian_conditions ? (self::KW_WHERE . implode(self::SEP_AND, $Silian_conditions)) : '';
        $Silian_offset = ($Silian_page - 1) * $Silian_limit;
        $Silian_sql = "SELECT id, conversation_id, turn_no, request_id, actor_type, actor_id, source, model, status, response_id, total_tokens, latency_ms, created_at, prompt, error_message
                FROM llm_logs {$Silian_where}
                ORDER BY id DESC LIMIT :limit OFFSET :offset";
        $Silian_stmt = $this->db->prepare($Silian_sql);
        foreach ($Silian_params as $Silian_k=>$Silian_v) { $Silian_stmt->bindValue(':' . $Silian_k, $Silian_v); }
        $Silian_stmt->bindValue(self::LIMIT_PARAM, $Silian_limit, PDO::PARAM_INT);
        $Silian_stmt->bindValue(self::OFFSET_PARAM, $Silian_offset, PDO::PARAM_INT);
        $Silian_stmt->execute();
        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $Silian_total = $this->countRows('llm_logs', $Silian_where, $Silian_params);
        return [ 'items' => $Silian_rows, 'count' => (int)$Silian_total, 'page' => $Silian_page, 'pages' => (int)ceil($Silian_total / $Silian_limit), 'limit' => $Silian_limit ];
    }

    private function normalizeConversationId(mixed $Silian_value): ?string
    {
        if (!is_string($Silian_value)) {
            return null;
        }

        $Silian_value = trim($Silian_value);
        if ($Silian_value === '') {
            return null;
        }

        return preg_match('/^[A-Za-z0-9._:-]{8,64}$/', $Silian_value) === 1 ? $Silian_value : null;
    }

    /**
     * @return array<int,string>
     */
    private function findRequestIdsByConversation(string $Silian_conversationId): array
    {
        $Silian_stmt = $this->db->prepare("
            SELECT DISTINCT request_id
            FROM (
                SELECT request_id FROM audit_logs WHERE conversation_id = :conversation_id_audit
                UNION
                SELECT request_id FROM llm_logs WHERE conversation_id = :conversation_id_llm
            ) requests
            WHERE request_id IS NOT NULL AND request_id <> ''
        ");
        $Silian_stmt->execute([
            ':conversation_id_audit' => $Silian_conversationId,
            ':conversation_id_llm' => $Silian_conversationId,
        ]);
        return array_values(array_filter(array_map(
            static fn ($Silian_value): ?string => is_string($Silian_value) && trim($Silian_value) !== '' ? trim($Silian_value) : null,
            $Silian_stmt->fetchAll(PDO::FETCH_COLUMN) ?: []
        )));
    }

    /**
     * @param array<int,string> $conditions
     * @param array<string,mixed> $params
     * @param array<int,string> $values
     */
    private function appendInCondition(array &$Silian_conditions, array &$Silian_params, string $Silian_column, array $Silian_values, string $Silian_prefix): void
    {
        if ($Silian_values === []) {
            return;
        }

        $Silian_placeholders = [];
        foreach (array_values($Silian_values) as $Silian_index => $Silian_value) {
            $Silian_placeholder = ':' . $Silian_prefix . '_' . $Silian_index;
            $Silian_placeholders[] = $Silian_placeholder;
            $Silian_params[substr($Silian_placeholder, 1)] = $Silian_value;
        }

        $Silian_conditions[] = sprintf('%s IN (%s)', $Silian_column, implode(', ', $Silian_placeholders));
    }

    /**
     * @param array<int,string> $conditions
     * @param array<string,mixed> $params
     * @param array<string,mixed> $filters
     */
    private function applyRawFetchFilters(string $Silian_table, array &$Silian_conditions, array &$Silian_params, array $Silian_filters): void
    {
        $Silian_conversationId = $this->normalizeConversationId($Silian_filters['conversation_id'] ?? null);
        $Silian_requestId = RequestIdNormalizer::normalize($Silian_filters['request_id'] ?? null);

        if ($Silian_requestId !== null) {
            $Silian_conditions[] = 'request_id = :f_request_id';
            $Silian_params['f_request_id'] = $Silian_requestId;
        }

        if ($Silian_table === 'system_logs' || $Silian_table === 'error_logs') {
            if ($Silian_conversationId !== null) {
                $Silian_requestIds = is_array($Silian_filters['request_ids'] ?? null) ? array_values(array_filter($Silian_filters['request_ids'], static fn ($Silian_id) => is_string($Silian_id) && $Silian_id !== '')) : [];
                if ($Silian_requestIds === []) {
                    $Silian_conditions[] = '1 = 0';
                    return;
                }
                $this->appendInCondition($Silian_conditions, $Silian_params, 'request_id', $Silian_requestIds, $Silian_table === 'system_logs' ? 'raw_sys_conv_req' : 'raw_err_conv_req');
            }
        }

        if ($Silian_table === 'audit_logs') {
            if (!empty($Silian_filters['user_id']) && is_numeric((string) $Silian_filters['user_id'])) {
                $Silian_conditions[] = 'user_id = :f_a_user';
                $Silian_params['f_a_user'] = (int) $Silian_filters['user_id'];
            }
            if (!empty($Silian_filters['action'])) {
                $Silian_conditions[] = 'action = :f_a_action';
                $Silian_params['f_a_action'] = (string) $Silian_filters['action'];
            }
            if (!empty($Silian_filters['audit_status'])) {
                $Silian_conditions[] = 'status = :f_a_status';
                $Silian_params['f_a_status'] = (string) $Silian_filters['audit_status'];
            }
            if ($Silian_conversationId !== null) {
                $Silian_conditions[] = 'conversation_id = :f_a_conversation_id';
                $Silian_params['f_a_conversation_id'] = $Silian_conversationId;
            }
        }

        if ($Silian_table === 'error_logs') {
            if (!empty($Silian_filters['error_type'])) {
                $Silian_conditions[] = 'error_type = :f_e_type';
                $Silian_params['f_e_type'] = (string) $Silian_filters['error_type'];
            }
        }

        if ($Silian_table === 'llm_logs') {
            if (!empty($Silian_filters['actor_type'])) {
                $Silian_conditions[] = 'actor_type = :f_l_actor_type';
                $Silian_params['f_l_actor_type'] = (string) $Silian_filters['actor_type'];
            }
            if (!empty($Silian_filters['actor_id']) && is_numeric((string) $Silian_filters['actor_id'])) {
                $Silian_conditions[] = 'actor_id = :f_l_actor_id';
                $Silian_params['f_l_actor_id'] = (int) $Silian_filters['actor_id'];
            }
            if (!empty($Silian_filters['status'])) {
                $Silian_conditions[] = 'status = :f_l_status';
                $Silian_params['f_l_status'] = (string) $Silian_filters['status'];
            }
            if (!empty($Silian_filters['model'])) {
                $Silian_conditions[] = 'model LIKE :f_l_model';
                $Silian_params['f_l_model'] = '%' . (string) $Silian_filters['model'] . '%';
            }
            if (!empty($Silian_filters['source'])) {
                $Silian_conditions[] = 'source LIKE :f_l_source';
                $Silian_params['f_l_source'] = '%' . (string) $Silian_filters['source'] . '%';
            }
            if ($Silian_conversationId !== null) {
                $Silian_conditions[] = 'conversation_id = :f_l_conversation_id';
                $Silian_params['f_l_conversation_id'] = $Silian_conversationId;
            }
            if (!empty($Silian_filters['turn_no']) && is_numeric((string) $Silian_filters['turn_no'])) {
                $Silian_conditions[] = 'turn_no = :f_l_turn_no';
                $Silian_params['f_l_turn_no'] = (int) $Silian_filters['turn_no'];
            }
        }
    }

    /**
     * @param array<string,mixed> $params
     */
    private function countRows(string $Silian_table, string $Silian_whereClause, array $Silian_params): int
    {
        $Silian_stmt = $this->db->prepare("SELECT COUNT(*) FROM {$Silian_table} {$Silian_whereClause}");
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_stmt->bindValue(':' . $Silian_key, $Silian_value);
        }
        $Silian_stmt->execute();
        return (int) ($Silian_stmt->fetchColumn() ?: 0);
    }

    private function normalizeStart(string $Silian_d): string
    { return preg_match('/\d{2}:\d{2}:\d{2}/', $Silian_d) ? $Silian_d : trim($Silian_d) . ' 00:00:00'; }
    private function normalizeEnd(string $Silian_d): string
    { return preg_match('/\d{2}:\d{2}:\d{2}/', $Silian_d) ? $Silian_d : trim($Silian_d) . ' 23:59:59'; }

    private function json(Response $Silian_response, array $Silian_data, int $Silian_status = 200): Response
    {
        $Silian_response->getBody()->write(json_encode($Silian_data, JSON_UNESCAPED_UNICODE));
        return $Silian_response->withHeader('Content-Type', 'application/json')->withStatus($Silian_status);
    }
}
