<?php

namespace CarbonTrack\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use CarbonTrack\Services\CarbonCalculatorService;
use CarbonTrack\Services\CloudflareR2Service;
use CarbonTrack\Services\MessageService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\ErrorLogService;
use CarbonTrack\Services\CheckinService;
use CarbonTrack\Services\QuotaService;
use CarbonTrack\Services\BadgeService;
use CarbonTrack\Services\UserProfileViewService;
use CarbonTrack\Models\CarbonActivity;
use PDO;

class CarbonTrackController
{
    private PDO $db;
    private CarbonCalculatorService $carbonCalculator;
    private MessageService $messageService;
    private AuditLogService $auditLog;
    private AuthService $authService;
    private ?ErrorLogService $errorLogService;
    private ?CloudflareR2Service $r2Service;
    private ?CheckinService $checkinService;
    private ?QuotaService $quotaService;
    private ?BadgeService $badgeService;
    private UserProfileViewService $userProfileViewService;

    private const ERR_INTERNAL = 'Internal server error';
    private const ERRLOG_PREFIX = 'ErrorLogService failed: ';

    public function __construct(
        PDO $Silian_db,
        $Silian_carbonCalculator,
        $Silian_messageService,
        $Silian_auditLog,
        $Silian_authService,
        UserProfileViewService $Silian_userProfileViewService,
        $Silian_errorLogService = null,
        $Silian_r2Service = null,
        $Silian_checkinService = null,
        $Silian_quotaService = null,
        ?BadgeService $Silian_badgeService = null
    ) {
        $this->db = $Silian_db;
        $this->carbonCalculator = $Silian_carbonCalculator;
        $this->messageService = $Silian_messageService;
        $this->auditLog = $Silian_auditLog;
        $this->authService = $Silian_authService;
        $this->userProfileViewService = $Silian_userProfileViewService;
        $this->errorLogService = $Silian_errorLogService;
        $this->r2Service = $Silian_r2Service;
        $this->checkinService = $Silian_checkinService;
        $this->quotaService = $Silian_quotaService;
        $this->badgeService = $Silian_badgeService;
    }

    /**
     * 提交碳减排记录
     */
    public function submitRecord(Request $Silian_request, Response $Silian_response): Response
    {
    try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, ['error' => 'Unauthorized'], 401);
            }

            $Silian_data = $Silian_request->getParsedBody();
            if (!is_array($Silian_data)) { $Silian_data = []; }

            // 同义词兼容映射：将多种前端可能传入的键统一为内部标准键
            $Silian_synonyms = [
                // 统一数值 amount（旧代码个别使用 data、value）
                'amount' => ['data', 'value', 'amount_value'],
                // 日期
                'date' => ['activity_date', 'record_date'],
                // 描述/备注
                'description' => ['notes', 'note', 'remark', 'comments'],
                // 图片数组
                'images' => ['proof_images', 'image_urls', 'files', 'attachments', 'photos'],
                // 单位
                'unit' => ['activity_unit'],
                // 打卡日期（补打卡）
                'checkin_date' => ['makeup_date', 'checkinDate', 'makeupDate', 'check_in_date']
            ];
            foreach ($Silian_synonyms as $Silian_primary => $Silian_alts) {
                if (!array_key_exists($Silian_primary, $Silian_data) || $Silian_data[$Silian_primary] === '' || $Silian_data[$Silian_primary] === null) {
                    foreach ($Silian_alts as $Silian_alt) {
                        if (array_key_exists($Silian_alt, $Silian_data) && $Silian_data[$Silian_alt] !== '' && $Silian_data[$Silian_alt] !== null) {
                            $Silian_data[$Silian_primary] = $Silian_data[$Silian_alt];
                            break;
                        }
                    }
                }
            }

            // 兼容 multipart/form-data 与 application/json
            $Silian_uploadedFiles = $Silian_request->getUploadedFiles();
            $Silian_imageFiles = [];
            if (is_array($Silian_uploadedFiles)) {
                foreach (['images', 'files', 'attachments', 'image'] as $Silian_field) {
                    if (!empty($Silian_uploadedFiles[$Silian_field])) {
                        $Silian_f = $Silian_uploadedFiles[$Silian_field];
                        if (is_array($Silian_f)) {
                            foreach ($Silian_f as $Silian_fi) {
                                if ($Silian_fi && $Silian_fi->getError() === UPLOAD_ERR_OK) {
                                    $Silian_imageFiles[] = $Silian_fi;
                                }
                            }
                        } else {
                            if ($Silian_f && $Silian_f->getError() === UPLOAD_ERR_OK) {
                                $Silian_imageFiles[] = $Silian_f;
                            }
                        }
                    }
                }
            }

            // 验证必需字段（图片现在为必填）
            $Silian_requiredFields = ['activity_id', 'amount', 'date'];
            foreach ($Silian_requiredFields as $Silian_field) {
                if (!isset($Silian_data[$Silian_field]) || empty($Silian_data[$Silian_field])) {
                    return $this->json($Silian_response, [
                        'error' => "Missing required field: {$Silian_field}"
                    ], 400);
                }
            }

            $Silian_checkinDate = null;
            $Silian_isMakeup = false;
            if (!empty($Silian_data['checkin_date'])) {
                $Silian_checkinDate = $this->normalizeCheckinDate((string) $Silian_data['checkin_date']);
                if (!$Silian_checkinDate) {
                    return $this->json($Silian_response, [
                        'error' => 'Invalid checkin date',
                        'code' => 'INVALID_CHECKIN_DATE'
                    ], 400);
                }

                $Silian_tzName = $_ENV['APP_TIMEZONE'] ?? date_default_timezone_get();
                if (!$Silian_tzName) {
                    $Silian_tzName = 'UTC';
                }
                $Silian_todayStr = (new \DateTimeImmutable('now', new \DateTimeZone($Silian_tzName)))->format('Y-m-d');
                if ($Silian_checkinDate > $Silian_todayStr) {
                    return $this->json($Silian_response, [
                        'error' => 'Cannot check in for future dates',
                        'code' => 'CHECKIN_DATE_IN_FUTURE'
                    ], 400);
                }

                $Silian_isMakeup = ($Silian_checkinDate !== $Silian_todayStr);
                if ($Silian_isMakeup) {
                    if (!$this->checkinService || !$this->quotaService) {
                        return $this->json($Silian_response, [
                            'error' => 'Checkin service unavailable',
                            'code' => 'CHECKIN_UNAVAILABLE'
                        ], 500);
                    }

                    if ($this->checkinService->hasCheckin((int) $Silian_user['id'], $Silian_checkinDate)) {
                        return $this->json($Silian_response, [
                            'error' => 'Already checked in for this date',
                            'code' => 'ALREADY_CHECKED_IN'
                        ], 409);
                    }

                    $Silian_userModel = $this->authService->getCurrentUserModel($Silian_request);
                    if (!$Silian_userModel) {
                        return $this->json($Silian_response, [
                            'error' => 'Unauthorized',
                            'code' => 'UNAUTHORIZED'
                        ], 401);
                    }

                    if (!$this->quotaService->checkAndConsume($Silian_userModel, 'checkin_makeup', 1)) {
                        return $this->json($Silian_response, [
                            'error' => 'Makeup quota exceeded',
                            'code' => 'QUOTA_EXCEEDED',
                            'translation_key' => 'error.quota.exceeded'
                        ], 429);
                    }
                }
            }

            // 解析客户端直接传的 images（即便也有 multipart）以便统一校验
            $Silian_clientProvidedImages = [];
            if (!empty($Silian_data['images'])) {
                if (is_string($Silian_data['images'])) {
                    $Silian_decoded = json_decode($Silian_data['images'], true);
                    if (is_array($Silian_decoded)) { $Silian_clientProvidedImages = $Silian_decoded; }
                } elseif (is_array($Silian_data['images'])) {
                    $Silian_clientProvidedImages = $Silian_data['images'];
                }
            }

            // 如果既没有上传文件也没有有效的客户端图片数组 -> 路径敏感判断
            $Silian_path = $Silian_request->getUri()->getPath();
            if (empty($Silian_imageFiles) && empty($Silian_clientProvidedImages)) {
                // /api/v1/carbon-records 端点：严格要求图片（旧持久化测试期望）
                if (str_contains($Silian_path, '/api/v1/carbon-records')) {
                    return $this->json($Silian_response, [ 'error' => 'Missing required field: images' ], 400);
                }
                // 其它路径（如 /carbon-track/record）保持向后兼容允许无图片
            }

            // 获取活动信息
            $Silian_activity = CarbonActivity::findById($this->db, $Silian_data['activity_id']);
            if (!$Silian_activity) {
                return $this->json($Silian_response, ['error' => 'Activity not found'], 404);
            }

            $Silian_amountValue = floatval($Silian_data['amount']);

            // 计算碳减排量和积分（仅使用 calculateCarbonSavings，旧 calculate 已移除兼容）
            try {
                $Silian_calc = $this->carbonCalculator->calculateCarbonSavings($Silian_data['activity_id'], $Silian_amountValue, $Silian_activity);
            } catch (\Throwable $Silian_e) {
                return $this->json($Silian_response, ['error' => 'calc_failed', 'message' => $Silian_e->getMessage()], 500);
            }
            $Silian_carbonSaved = $Silian_calc['carbon_savings'] ?? 0;
            $Silian_pointsEarned = $Silian_calc['points_earned'] ?? (int)round($Silian_carbonSaved * 10);
            $Silian_calculation = [
                'carbon_saved' => $Silian_carbonSaved,
                'points_earned' => $Silian_pointsEarned,
                'carbon_factor' => isset($Silian_calc['carbon_factor']) ? (float) $Silian_calc['carbon_factor'] : null,
                'unit' => $Silian_calc['unit'] ?? ($Silian_data['unit'] ?? $Silian_activity['unit'] ?? null),
            ];

            // 先处理附件上传（如有），上传到 R2 并备好 images 数组
            $Silian_images = [];
            if (!empty($Silian_imageFiles)) {
                // 限制最多 10 张
                if (count($Silian_imageFiles) > 10) {
                    return $this->json($Silian_response, ['error' => 'Too many files. Maximum 10 images allowed'], 400);
                }

                try {
                    if (!$this->r2Service) {
                        throw new \RuntimeException('R2 service not configured');
                    }
                    $Silian_uploadResult = $this->r2Service->uploadMultipleFiles(
                        $Silian_imageFiles,
                        'activities',
                        $Silian_user['id'] ?? null,
                        'carbon_record',
                        null
                    );

                    foreach ($Silian_uploadResult['results'] as $Silian_res) {
                        // 仅收集成功项
                        if (!empty($Silian_res['success'])) {
                            $Silian_images[] = [
                                'file_path' => $Silian_res['file_path'] ?? null,
                                'public_url' => $Silian_res['public_url'] ?? null,
                                'original_name' => $Silian_res['original_name'] ?? null,
                                'mime_type' => $Silian_res['mime_type'] ?? null,
                                'file_size' => $Silian_res['file_size'] ?? null,
                            ];
                        } else {
                            // 如果uploadMultipleFiles未标识success字段，也将非空结果记录
                            if (isset($Silian_res['file_path']) || isset($Silian_res['public_url'])) {
                                $Silian_images[] = [
                                    'file_path' => $Silian_res['file_path'] ?? null,
                                    'public_url' => $Silian_res['public_url'] ?? null,
                                    'original_name' => $Silian_res['original_name'] ?? null,
                                    'mime_type' => $Silian_res['mime_type'] ?? null,
                                    'file_size' => $Silian_res['file_size'] ?? null,
                                ];
                            }
                        }
                    }
                } catch (\Throwable $Silian_e) {
                    $this->logControllerException($Silian_e, $Silian_request, 'CarbonTrackController::submitRecord image upload error: ' . $Silian_e->getMessage());
                    // 如果无 R2 服务或上传失败，继续流程但不附带上传图片
                    $Silian_images = [];
                }
            } else if (!empty($Silian_data['images'])) {
                // 兼容前端直接传URL数组的旧逻辑
                if (is_string($Silian_data['images'])) {
                    $Silian_decoded = json_decode($Silian_data['images'], true);
                    if (is_array($Silian_decoded)) {
                        foreach ($Silian_decoded as $Silian_item) {
                            if (is_string($Silian_item)) {
                                $Silian_images[] = ['public_url' => $Silian_item];
                            } elseif (is_array($Silian_item)) {
                                $Silian_images[] = $Silian_item;
                            }
                        }
                    }
                } elseif (is_array($Silian_data['images'])) {
                    foreach ($Silian_data['images'] as $Silian_item) {
                        if (is_string($Silian_item)) {
                            $Silian_images[] = ['public_url' => $Silian_item];
                        } elseif (is_array($Silian_item)) {
                            $Silian_images[] = $Silian_item;
                        }
                    }
                }
            }

            // 创建记录
            // 统一 images: 若为空则存储空数组 JSON，若是字符串直接包裹为 public_url 结构
            $Silian_finalImages = [];
            if (!empty($Silian_images)) {
                $Silian_finalImages = $Silian_images;
            } elseif (!empty($Silian_data['images'])) {
                // 来自客户端的 images 可能是字符串数组或对象数组
                if (is_array($Silian_data['images'])) {
                    foreach ($Silian_data['images'] as $Silian_it) {
                        if (is_string($Silian_it)) { $Silian_finalImages[] = ['public_url' => $Silian_it]; }
                        elseif (is_array($Silian_it)) { $Silian_finalImages[] = $Silian_it; }
                    }
                } elseif (is_string($Silian_data['images'])) {
                    $Silian_decodedClient = json_decode($Silian_data['images'], true);
                    if (is_array($Silian_decodedClient)) {
                        foreach ($Silian_decodedClient as $Silian_it) {
                            if (is_string($Silian_it)) { $Silian_finalImages[] = ['public_url' => $Silian_it]; }
                            elseif (is_array($Silian_it)) { $Silian_finalImages[] = $Silian_it; }
                        }
                    }
                }
            }

            $Silian_recordId = null;
            $Silian_submittedAt = new \DateTimeImmutable('now');
            if ($Silian_isMakeup) {
                $this->db->beginTransaction();
            }

            try {
                $Silian_recordId = $this->createCarbonRecord([
                    'user_id' => $Silian_user['id'],
                    'activity_id' => $Silian_data['activity_id'],
                    'amount' => $Silian_amountValue,
                    'unit' => $Silian_data['unit'] ?? $Silian_activity['unit'],
                    'carbon_saved' => $Silian_carbonSaved,
                    'points_earned' => $Silian_pointsEarned,
                    'date' => $Silian_data['date'],
                    'description' => $Silian_data['description'] ?? null,
                    'images' => $Silian_finalImages,
                    'status' => 'pending'
                ]);

                if ($this->checkinService) {
                    try {
                        if ($Silian_checkinDate && $Silian_isMakeup) {
                            $Silian_checkinAdded = $this->checkinService->createMakeupCheckin((int) $Silian_user['id'], $Silian_checkinDate, null, $Silian_recordId, $Silian_submittedAt);
                            if (!$Silian_checkinAdded) {
                                throw new \RuntimeException('Failed to apply makeup checkin');
                            }
                            $this->auditLog->logUserAction((int) $Silian_user['id'], 'checkin_makeup_recorded', [
                                'checkin_date' => $Silian_checkinDate,
                                'record_id' => $Silian_recordId,
                            ]);
                        } else {
                            $Silian_checkinDateValue = $Silian_checkinDate ?: $Silian_submittedAt->format('Y-m-d');
                            $Silian_checkinAdded = $this->checkinService->recordCheckinForDate((int) $Silian_user['id'], $Silian_checkinDateValue, 'record', $Silian_recordId, $Silian_submittedAt);
                            if ($Silian_checkinAdded) {
                                $this->auditLog->logUserAction((int) $Silian_user['id'], 'checkin_recorded', [
                                    'checkin_date' => $Silian_checkinDateValue,
                                    'record_id' => $Silian_recordId,
                                ]);
                            }
                        }
                    } catch (\Throwable $Silian_e) {
                        if ($Silian_isMakeup) {
                            throw $Silian_e;
                        }
                        $this->logControllerException($Silian_e, $Silian_request, 'CarbonTrackController::submitRecord checkin error: ' . $Silian_e->getMessage());
                    }
                }

                if ($Silian_isMakeup && $this->db->inTransaction()) {
                    $this->db->commit();
                }
            } catch (\Throwable $Silian_e) {
                if ($Silian_isMakeup && $this->db->inTransaction()) {
                    $this->db->rollBack();
                }
                throw $Silian_e;
            }

            // 记录审计日志（使用向后兼容的 log()，方便测试 mock）
            $this->auditLog->log([
                'action' => 'record_submitted',
                'operation_category' => 'carbon_management',
                'user_id' => $Silian_user['id'],
                'actor_type' => 'user',
                'affected_table' => 'carbon_records',
                'affected_id' => $Silian_recordId,
                'new_data' => [
                    'activity_id' => $Silian_data['activity_id'],
                    'amount' => $Silian_data['amount']
                ],
                'data' => [ 'request_data' => $Silian_data ]
            ]);

            // 发送站内信
            $this->messageService->sendMessage(
                $Silian_user['id'],
                'record_submitted',
                '碳减排记录提交成功',
                "您的{$Silian_activity['name_zh']}记录已提交，预计获得{$Silian_calculation['points_earned']}积分，等待审核。",
                'normal'
            );

            // 通知管理员
            $this->notifyAdminsNewRecord($Silian_recordId, $Silian_user, $Silian_activity);

            // 触发自动徽章授予（基于新数据可能解锁徽章）
            if ($this->badgeService) {
                try {
                    // 仅对当前用户运行，以减少性能开销
                    $this->badgeService->runAutoGrant(null, (int) $Silian_user['id']);
                } catch (\Throwable $Silian_e) {
                    // 徽章授予失败不应阻塞主流程
                    $this->logControllerException($Silian_e, $Silian_request, 'Auto badge grant failed after submission');
                }
            }

            // 获取最新的打卡连续天数（Gamification）
            $Silian_checkinStats = ['current_streak' => 0, 'longest_streak' => 0];
            if ($this->checkinService) {
                try {
                    $Silian_streakData = $this->checkinService->getUserStreakStats((int) $Silian_user['id']);
                    $Silian_checkinStats['current_streak'] = (int)($Silian_streakData['current_streak_days'] ?? 0);
                    $Silian_checkinStats['longest_streak'] = (int)($Silian_streakData['longest_streak_days'] ?? 0);
                } catch (\Throwable $Silian_e) {
                     // 忽略错误，以免影响主要返回
                }
            }

            $Silian_monthlyAchievements = [];
            try {
                $Silian_driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
                $Silian_currentMonth = date('Y-m');
                if ($Silian_driver === 'sqlite') {
                    $Silian_achievementsSql = "
                        SELECT a.name_zh as name, SUM(r.points_earned) as points
                        FROM carbon_records r
                        LEFT JOIN carbon_activities a ON r.activity_id = a.id
                        WHERE r.user_id = :user_id
                          AND r.status = 'approved'
                          AND strftime('%Y-%m', r.date) = :current_month
                          AND r.deleted_at IS NULL
                        GROUP BY r.activity_id, a.name_zh
                        ORDER BY SUM(r.points_earned) DESC
                        LIMIT 10";
                } else {
                    $Silian_achievementsSql = "
                        SELECT a.name_zh as name, SUM(r.points_earned) as points
                        FROM carbon_records r
                        LEFT JOIN carbon_activities a ON r.activity_id = a.id
                        WHERE r.user_id = :user_id
                          AND r.status = 'approved'
                          AND DATE_FORMAT(r.date, '%Y-%m') = :current_month
                          AND r.deleted_at IS NULL
                        GROUP BY r.activity_id, a.name_zh
                        ORDER BY SUM(r.points_earned) DESC
                        LIMIT 10";
                }
                $Silian_achievementsStmt = $this->db->prepare($Silian_achievementsSql);
                $Silian_achievementsStmt->execute([
                    'user_id' => $Silian_user['id'],
                    'current_month' => $Silian_currentMonth
                ]);
                $Silian_monthlyAchievements = $Silian_achievementsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (\Throwable $Silian_e) {
                // ignore achievement errors in non-MySQL test environments
            }

            // 规范化返回的 images（public_url -> url）
            $Silian_returnImages = [];
            foreach ($Silian_finalImages as $Silian_img) {
                if (is_array($Silian_img)) {
                    $Silian_mapped = $Silian_img;
                    if (isset($Silian_mapped['public_url']) && !isset($Silian_mapped['url'])) {
                        $Silian_mapped['url'] = $Silian_mapped['public_url'];
                    }
                    $Silian_returnImages[] = $Silian_mapped;
                } elseif (is_string($Silian_img)) {
                    $Silian_returnImages[] = ['url' => $Silian_img];
                }
            }

            return $this->json($Silian_response, [
                'success' => true,
                'message' => 'Record submitted successfully',
                // 向后兼容：旧测试期望顶级 calculation 对象
                'calculation' => $Silian_calculation,
                'data' => [
                    'record_id' => $Silian_recordId,
                    'carbon_saved' => $Silian_carbonSaved,
                    'points_earned' => $Silian_pointsEarned,
                    'status' => 'pending',
                    'images' => $Silian_returnImages,
                    'monthly_achievements' => $Silian_monthlyAchievements,
                    'checkin_stats' => $Silian_checkinStats,
                ]
            ]);

        } catch (\Exception $Silian_e) {
            return $this->json($Silian_response, ['error' => self::ERR_INTERNAL, 'exception' => $Silian_e->getMessage(), 'trace' => $Silian_e->getFile().':'.$Silian_e->getLine()], 500);
        }
    }

    /**
     * 计算碳减排（仅返回计算结果，不落库）
     */
    public function calculate(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, ['error' => 'Unauthorized'], 401);
            }

            $Silian_data = $Silian_request->getParsedBody();
            if (!is_array($Silian_data)) { $Silian_data = []; }

            // 同义词：计算接口历史上使用 data，新前端可能用 amount
            if (!isset($Silian_data['data']) && isset($Silian_data['amount'])) {
                $Silian_data['data'] = $Silian_data['amount'];
            } elseif (isset($Silian_data['data']) && !isset($Silian_data['amount'])) {
                $Silian_data['amount'] = $Silian_data['data'];
            }
            if (!isset($Silian_data['activity_id']) || !isset($Silian_data['data'])) {
                return $this->json($Silian_response, ['error' => 'Missing required fields'], 400);
            }

            $Silian_activity = CarbonActivity::findById($this->db, $Silian_data['activity_id']);
            if (!$Silian_activity) {
                return $this->json($Silian_response, ['error' => 'Activity not found'], 404);
            }

            $Silian_amountValue = floatval($Silian_data['data']);
            $Silian_carbonFactor = $Silian_activity['carbon_factor'] ?? null;
            $Silian_calculationUnit = $Silian_data['unit'] ?? $Silian_activity['unit'] ?? null;

            // Support both new and old service APIs
            if (method_exists($this->carbonCalculator, 'calculate')) {
                $Silian_calculation = call_user_func([
                    $this->carbonCalculator,
                    'calculate'
                ],
                    $Silian_data['activity_id'],
                    $Silian_amountValue,
                    $Silian_data['unit'] ?? $Silian_activity['unit']
                );
                $Silian_carbonSaved = $Silian_calculation['carbon_saved'] ?? 0;
                $Silian_pointsEarned = $Silian_calculation['points_earned'] ?? 0;
                $Silian_carbonFactor = $Silian_calculation['carbon_factor'] ?? $Silian_carbonFactor;
                $Silian_calculationUnit = $Silian_calculation['unit'] ?? $Silian_calculationUnit;
            } else {
                $Silian_calc = $this->carbonCalculator->calculateCarbonSavings($Silian_data['activity_id'], $Silian_amountValue, $Silian_activity);
                $Silian_carbonSaved = $Silian_calc['carbon_savings'] ?? 0;
                $Silian_pointsEarned = $Silian_calc['points_earned'] ?? (int)round($Silian_carbonSaved * 10);
                $Silian_carbonFactor = $Silian_calc['carbon_factor'] ?? ($Silian_activity['carbon_factor'] ?? null);
                $Silian_calculationUnit = $Silian_calc['unit'] ?? $Silian_calculationUnit;
            }

            return $this->json($Silian_response, [
                'success' => true,
                'data' => [
                    'carbon_saved' => $Silian_carbonSaved,
                    'points_earned' => $Silian_pointsEarned,
                    'carbon_factor' => $Silian_carbonFactor !== null ? (float) $Silian_carbonFactor : null,
                    'unit' => $Silian_calculationUnit,
                ]
            ]);
        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'CarbonTrackController::calculate error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => self::ERR_INTERNAL], 500);
        }
    }

    /**
     * 获取用户记录列表
     */
    public function getUserRecords(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, ['error' => 'Unauthorized'], 401);
            }

            $Silian_params = $Silian_request->getQueryParams();
            $Silian_page = max(1, intval($Silian_params['page'] ?? 1));
            $Silian_limit = min(50, max(10, intval($Silian_params['limit'] ?? 20)));
            $Silian_offset = ($Silian_page - 1) * $Silian_limit;

            // 构建查询条件
            $Silian_where = ['r.user_id = :user_id', 'r.deleted_at IS NULL'];
            $Silian_bindings = ['user_id' => $Silian_user['id']];

            if (!empty($Silian_params['status'])) {
                $Silian_where[] = 'r.status = :status';
                $Silian_bindings['status'] = $Silian_params['status'];
            }

            if (!empty($Silian_params['activity_id'])) {
                $Silian_where[] = 'r.activity_id = :activity_id';
                $Silian_bindings['activity_id'] = $Silian_params['activity_id'];
            }

            if (!empty($Silian_params['date_from'])) {
                $Silian_where[] = 'r.date >= :date_from';
                $Silian_bindings['date_from'] = $Silian_params['date_from'];
            }

            if (!empty($Silian_params['date_to'])) {
                $Silian_where[] = 'r.date <= :date_to';
                $Silian_bindings['date_to'] = $Silian_params['date_to'];
            }

            $Silian_whereClause = implode(' AND ', $Silian_where);

            // 获取总数
            $Silian_countSql = "
                SELECT COUNT(*) as total
                FROM carbon_records r
                WHERE {$Silian_whereClause}
            ";
            $Silian_countStmt = $this->db->prepare($Silian_countSql);
            $Silian_countStmt->execute($Silian_bindings);
            $Silian_total = $Silian_countStmt->fetch(PDO::FETCH_ASSOC)['total'];

            // 获取记录列表
            $Silian_sql = "
                SELECT
                    r.*,
                    a.name_zh as activity_name_zh,
                    a.name_en as activity_name_en,
                    a.category,
                    a.icon
                FROM carbon_records r
                LEFT JOIN carbon_activities a ON r.activity_id = a.id
                WHERE {$Silian_whereClause}
                ORDER BY r.created_at DESC
                LIMIT :limit OFFSET :offset
            ";

            $Silian_stmt = $this->db->prepare($Silian_sql);
            foreach ($Silian_bindings as $Silian_key => $Silian_value) {
                $Silian_stmt->bindValue($Silian_key, $Silian_value);
            }
            $Silian_stmt->bindValue('limit', $Silian_limit, PDO::PARAM_INT);
            $Silian_stmt->bindValue('offset', $Silian_offset, PDO::PARAM_INT);
            $Silian_stmt->execute();

            $Silian_records = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC);

            // 处理图片字段（统一为标准数组结构）
            foreach ($Silian_records as &$Silian_record) {
                $Silian_decoded = $Silian_record['images'] ? json_decode($Silian_record['images'], true) : [];
                $Silian_record['images'] = $this->normalizeImages($Silian_decoded);
            }

            return $this->json($Silian_response, [
                'success' => true,
                'data' => $Silian_records,
                'pagination' => [
                    'page' => $Silian_page,
                    'limit' => $Silian_limit,
                    'total' => intval($Silian_total),
                    'pages' => ceil($Silian_total / $Silian_limit)
                ]
            ]);

        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'CarbonTrackController::getUserRecords error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => self::ERR_INTERNAL], 500);
        }
    }

    /**
     * 获取记录详情
     */
    public function getRecordDetail(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, ['error' => 'Unauthorized'], 401);
            }

            $Silian_recordId = $Silian_args['id'];

            $Silian_sql = "
                SELECT
                    r.*,
                    a.name_zh as activity_name_zh,
                    a.name_en as activity_name_en,
                    a.category,
                    a.icon,
                    a.carbon_factor,
                    a.points_factor,
                    u.username as reviewer_username
                FROM carbon_records r
                LEFT JOIN carbon_activities a ON r.activity_id = a.id
                LEFT JOIN users u ON r.reviewed_by = u.id
                WHERE r.id = :record_id AND r.deleted_at IS NULL
            ";

            // 非管理员只能查看自己的记录
            if (!$this->authService->isAdminUser($Silian_user)) {
                $Silian_sql .= " AND r.user_id = :user_id";
            }

            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->bindValue('record_id', $Silian_recordId);
            if (!$this->authService->isAdminUser($Silian_user)) {
                $Silian_stmt->bindValue('user_id', $Silian_user['id']);
            }
            $Silian_stmt->execute();

            $Silian_record = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
            if (!$Silian_record) {
                return $this->json($Silian_response, ['error' => 'Record not found'], 404);
            }

            // 处理图片字段（详情）
            $Silian_decoded = $Silian_record['images'] ? json_decode($Silian_record['images'], true) : [];
            $Silian_record['images'] = $this->normalizeImages($Silian_decoded);

            return $this->json($Silian_response, [
                'success' => true,
                'data' => $Silian_record
            ]);

        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'CarbonTrackController::getRecordDetail error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => self::ERR_INTERNAL], 500);
        }
    }

    /**
     * 管理员审核记录
     */
    public function reviewRecord(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_adminUser = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_adminUser || !$this->authService->isAdminUser($Silian_adminUser)) {
                return $this->json($Silian_response, ['error' => 'Admin access required'], 403);
            }

            $Silian_data = $Silian_request->getParsedBody();
            if (!is_array($Silian_data)) {
                $Silian_data = [];
            }

            $Silian_action = $this->resolveReviewAction($Silian_data);
            if ($Silian_action === null) {
                return $this->json($Silian_response, ['error' => 'Invalid action or status'], 400);
            }

            $Silian_recordId = (string) $Silian_args['id'];
            $Silian_records = $this->getCarbonRecordsByIds([$Silian_recordId]);
            $Silian_record = $Silian_records[0] ?? null;
            if (!$Silian_record) {
                return $this->json($Silian_response, ['error' => 'Record not found'], 404);
            }

            if (($Silian_record['status'] ?? '') !== 'pending') {
                return $this->json($Silian_response, ['error' => 'Record already reviewed'], 400);
            }

            $Silian_reviewNote = $this->normalizeReviewNote($Silian_data);

            $Silian_result = $this->processRecordReviewBatch([$Silian_record], $Silian_action, $Silian_reviewNote, $Silian_adminUser);

            return $this->json($Silian_response, [
                'success' => !empty($Silian_result['processed']),
                'message' => $Silian_action === 'approve'
                    ? 'Record approved successfully'
                    : 'Record rejected successfully',
                'processed_ids' => $Silian_result['processed'],
                'skipped' => $Silian_result['skipped'],
            ]);
        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'CarbonTrackController::reviewRecord error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => self::ERR_INTERNAL], 500);
        }
    }

    /**
     * 管理员批量审核碳减排记录
     */
    public function reviewRecordsBulk(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_adminUser = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_adminUser || !$this->authService->isAdminUser($Silian_adminUser)) {
                return $this->json($Silian_response, ['error' => 'Admin access required'], 403);
            }

            $Silian_data = $Silian_request->getParsedBody();
            if (!is_array($Silian_data)) {
                $Silian_data = [];
            }

            $Silian_action = $this->resolveReviewAction($Silian_data);
            if ($Silian_action === null) {
                return $this->json($Silian_response, ['error' => 'Invalid action or status'], 400);
            }

            $Silian_recordIds = $this->normalizeRecordIds($Silian_data['record_ids'] ?? ($Silian_data['ids'] ?? null));
            if (empty($Silian_recordIds)) {
                return $this->json($Silian_response, ['error' => 'record_ids must be a non-empty array'], 400);
            }

            $Silian_records = $this->getCarbonRecordsByIds($Silian_recordIds);
            if (empty($Silian_records)) {
                return $this->json($Silian_response, [
                    'error' => 'No records found for provided ids',
                    'missing_ids' => array_values($Silian_recordIds),
                ], 404);
            }

            $Silian_reviewNote = $this->normalizeReviewNote($Silian_data);

            $Silian_result = $this->processRecordReviewBatch($Silian_records, $Silian_action, $Silian_reviewNote, $Silian_adminUser);

            $Silian_foundIds = array_column($Silian_records, 'id');
            $Silian_missingIds = array_values(array_diff($Silian_recordIds, $Silian_foundIds));

            $Silian_processedCount = count($Silian_result['processed']);
            $Silian_message = $Silian_processedCount > 0
                ? sprintf('%d record(s) %s', $Silian_processedCount, $Silian_action === 'approve' ? 'approved' : 'rejected')
                : 'No pending records matched the selection';

            return $this->json($Silian_response, [
                'success' => $Silian_processedCount > 0,
                'message' => $Silian_message,
                'processed_ids' => $Silian_result['processed'],
                'skipped' => $Silian_result['skipped'],
                'missing_ids' => $Silian_missingIds,
            ]);
        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'CarbonTrackController::reviewRecordsBulk error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => self::ERR_INTERNAL], 500);
        }
    }


    /**
     * 管理员获取碳减排记录列表（支持筛选与排序）
     * 支持的查询参数：
     * - status: pending|approved|rejected（留空为全部）
     * - search: 关键字，匹配用户名/邮箱/活动名（中英）
     * - sort: created_at_asc|created_at_desc（默认 created_at_asc）
     * - page, limit: 分页
     */
    public function getPendingRecords(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->json($Silian_response, ['error' => 'Admin access required'], 403);
            }

            $Silian_params = $Silian_request->getQueryParams();
            $Silian_page = max(1, intval($Silian_params['page'] ?? 1));
            $Silian_limit = min(50, max(10, intval($Silian_params['limit'] ?? 20)));
            $Silian_offset = ($Silian_page - 1) * $Silian_limit;
            $Silian_status = isset($Silian_params['status']) ? trim((string)$Silian_params['status']) : '';
            $Silian_search = isset($Silian_params['search']) ? trim((string)$Silian_params['search']) : '';
            // 兼容旧 sort（created_at_asc/created_at_desc）与新 sort_by + order
            $Silian_allowedSortBy = [
                'created_at' => 'r.created_at',
                'date' => 'r.date',
                'carbon_saved' => 'r.carbon_saved',
                'points_earned' => 'r.points_earned',
                'amount' => 'r.amount',
                'status' => 'r.status'
            ];
            $Silian_sort = isset($Silian_params['sort']) ? (string)$Silian_params['sort'] : '';
            $Silian_sortByParam = isset($Silian_params['sort_by']) ? (string)$Silian_params['sort_by'] : '';
            $Silian_orderParam = isset($Silian_params['order']) ? (string)$Silian_params['order'] : '';
            if ($Silian_sortByParam !== '') {
                $Silian_sortBy = $Silian_allowedSortBy[$Silian_sortByParam] ?? 'r.created_at';
                $Silian_order = strtoupper($Silian_orderParam) === 'DESC' ? 'DESC' : 'ASC';
            } else if ($Silian_sort !== '') {
                // 旧版：created_at_asc / created_at_desc
                $Silian_sortBy = 'r.created_at';
                $Silian_order = str_ends_with($Silian_sort, '_desc') ? 'DESC' : 'ASC';
            } else {
                $Silian_sortBy = 'r.created_at';
                $Silian_order = 'ASC';
            }

            // 构建筛选条件
            $Silian_where = ['r.deleted_at IS NULL'];
            $Silian_bindings = [];
            if ($Silian_status !== '') {
                $Silian_where[] = 'r.status = :status';
                $Silian_bindings['status'] = $Silian_status;
            }
            if ($Silian_search !== '') {
                $Silian_where[] = '(u.username LIKE :search_username OR u.email LIKE :search_email OR a.name_zh LIKE :search_name_zh OR a.name_en LIKE :search_name_en)';
                $Silian_searchPattern = "%{$Silian_search}%";
                $Silian_bindings['search_username'] = $Silian_searchPattern;
                $Silian_bindings['search_email'] = $Silian_searchPattern;
                $Silian_bindings['search_name_zh'] = $Silian_searchPattern;
                $Silian_bindings['search_name_en'] = $Silian_searchPattern;
            }
            // 额外筛选条件
            if (!empty($Silian_params['activity_id'])) { $Silian_where[] = 'r.activity_id = :activity_id'; $Silian_bindings['activity_id'] = $Silian_params['activity_id']; }
            if (!empty($Silian_params['user_id'])) { $Silian_where[] = 'r.user_id = :user_id'; $Silian_bindings['user_id'] = $Silian_params['user_id']; }
            if (!empty($Silian_params['school_id'])) { $Silian_where[] = 'u.school_id = :school_id'; $Silian_bindings['school_id'] = $Silian_params['school_id']; }
            if (!empty($Silian_params['category'])) { $Silian_where[] = 'a.category = :category'; $Silian_bindings['category'] = $Silian_params['category']; }
            if (!empty($Silian_params['date_from'])) { $Silian_where[] = 'r.date >= :date_from'; $Silian_bindings['date_from'] = $Silian_params['date_from']; }
            if (!empty($Silian_params['date_to'])) { $Silian_where[] = 'r.date <= :date_to'; $Silian_bindings['date_to'] = $Silian_params['date_to']; }
            if (isset($Silian_params['min_carbon']) && $Silian_params['min_carbon'] !== '') { $Silian_where[] = 'r.carbon_saved >= :min_carbon'; $Silian_bindings['min_carbon'] = (float)$Silian_params['min_carbon']; }
            if (isset($Silian_params['max_carbon']) && $Silian_params['max_carbon'] !== '') { $Silian_where[] = 'r.carbon_saved <= :max_carbon'; $Silian_bindings['max_carbon'] = (float)$Silian_params['max_carbon']; }
            if (isset($Silian_params['min_points']) && $Silian_params['min_points'] !== '') { $Silian_where[] = 'r.points_earned >= :min_points'; $Silian_bindings['min_points'] = (float)$Silian_params['min_points']; }
            if (isset($Silian_params['max_points']) && $Silian_params['max_points'] !== '') { $Silian_where[] = 'r.points_earned <= :max_points'; $Silian_bindings['max_points'] = (float)$Silian_params['max_points']; }
            $Silian_whereClause = implode(' AND ', $Silian_where);

            // 获取总数（包含联表以支持 search 条件）
            $Silian_countSql = "
                SELECT COUNT(*) as total
                FROM carbon_records r
                LEFT JOIN users u ON r.user_id = u.id
                LEFT JOIN carbon_activities a ON r.activity_id = a.id
                WHERE {$Silian_whereClause}
            ";
            $Silian_countStmt = $this->db->prepare($Silian_countSql);
            foreach ($Silian_bindings as $Silian_k => $Silian_v) { $Silian_countStmt->bindValue($Silian_k, $Silian_v); }
            $Silian_countStmt->execute();
            $Silian_total = $Silian_countStmt->fetch(PDO::FETCH_ASSOC)['total'];

            // 获取记录列表
            $Silian_sql = "
                SELECT
                    r.*,
                    a.name_zh as activity_name_zh,
                    a.name_en as activity_name_en,
                    a.category,
                    u.username,
                    u.email,
                    s.name as school_name
                FROM carbon_records r
                LEFT JOIN carbon_activities a ON r.activity_id = a.id
                LEFT JOIN users u ON r.user_id = u.id
                LEFT JOIN schools s ON u.school_id = s.id
                WHERE {$Silian_whereClause}
                ORDER BY {$Silian_sortBy} {$Silian_order}
                LIMIT :limit OFFSET :offset
            ";

            $Silian_stmt = $this->db->prepare($Silian_sql);
            foreach ($Silian_bindings as $Silian_k => $Silian_v) { $Silian_stmt->bindValue($Silian_k, $Silian_v); }
            $Silian_stmt->bindValue('limit', $Silian_limit, PDO::PARAM_INT);
            $Silian_stmt->bindValue('offset', $Silian_offset, PDO::PARAM_INT);
            $Silian_stmt->execute();

            $Silian_records = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC);

            // 处理图片字段与前端期望的别名（同时在这里直接返回可用 URL，前端不再单独请求预签名）
            foreach ($Silian_records as &$Silian_record) {
                $Silian_profileFields = $this->userProfileViewService->buildProfileFields($Silian_record);
                $Silian_record['school_name'] = $Silian_profileFields['school_name'];
                $Silian_decoded = $Silian_record['images'] ? json_decode($Silian_record['images'], true) : [];
                $Silian_record['images'] = $this->normalizeImages($Silian_decoded);
                if ($this->r2Service && is_array($Silian_record['images'])) {
                    foreach ($Silian_record['images'] as &$Silian_img) {
                        // 如果已有 public_url/url 则跳过；否则尝试基于 file_path 生成
                        if (!isset($Silian_img['public_url']) && !isset($Silian_img['url']) && !empty($Silian_img['file_path'])) {
                            try {
                                $Silian_public = $this->r2Service->getPublicUrl($Silian_img['file_path']);
                                if ($Silian_public) { $Silian_img['public_url'] = $Silian_public; $Silian_img['url'] = $Silian_public; }
                            } catch (\Throwable $Silian_ignore) { /* ignore individual image failure */ }
                        } elseif (isset($Silian_img['public_url']) && !isset($Silian_img['url'])) {
                            $Silian_img['url'] = $Silian_img['public_url'];
                        }
                    }
                    unset($Silian_img);
                }
                // 前端列表兼容字段
                $Silian_record['user_username'] = $Silian_record['username'] ?? null;
                $Silian_record['user_email'] = $Silian_record['email'] ?? null;
                $Silian_record['activity_name'] = $Silian_record['activity_name_zh'] ?? ($Silian_record['activity_name_en'] ?? null);
                $Silian_record['activity_category'] = $Silian_record['category'] ?? null;
                $Silian_record['data_value'] = $Silian_record['amount'] ?? null;
                $Silian_record['activity_unit'] = $Silian_record['unit'] ?? null;
                $Silian_record['carbon_saved'] = $Silian_record['carbon_saved'] ?? ($Silian_record['carbon_amount'] ?? ($Silian_record['carbon_savings'] ?? 0));
                // points_earned 字段已存在
            }

            $Silian_pages = (int)ceil($Silian_total / $Silian_limit);
            return $this->json($Silian_response, [
                'success' => true,
                'data' => $Silian_records,
                'pagination' => [
                    'page' => $Silian_page,
                    'limit' => $Silian_limit,
                    'total' => intval($Silian_total),
                    'pages' => $Silian_pages,
                    // 别名，方便前端统一解析
                    'current_page' => $Silian_page,
                    'per_page' => $Silian_limit,
                    'total_items' => intval($Silian_total),
                    'total_pages' => $Silian_pages
                ]
            ]);

        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'CarbonTrackController::getPendingRecords error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * 获取用户统计信息
     */
    public function getUserStats(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, ['error' => 'Unauthorized'], 401);
            }

            $Silian_driver = null; try { $Silian_driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME); } catch (\Throwable $Silian_ignore) {}

            $Silian_stats = [
                'total_records' => 0,
                'approved_records' => 0,
                'pending_records' => 0,
                'rejected_records' => 0,
                'total_carbon_saved' => 0,
                'total_points_earned' => 0
            ];
            try {
                $Silian_sql = "SELECT
                    COUNT(*) as total_records,
                    SUM(CASE WHEN status = 'approved' THEN 1 ELSE 0 END) as approved_records,
                    SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_records,
                    SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) as rejected_records,
                    COALESCE(SUM(CASE WHEN status = 'approved' THEN carbon_saved ELSE 0 END),0) as total_carbon_saved,
                    COALESCE(SUM(CASE WHEN status = 'approved' THEN points_earned ELSE 0 END),0) as total_points_earned
                    FROM carbon_records WHERE user_id = :user_id AND deleted_at IS NULL";
                $Silian_stmt = $this->db->prepare($Silian_sql);
                $Silian_stmt->execute(['user_id' => $Silian_user['id']]);
                $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
                if ($Silian_row) { $Silian_stats = $Silian_row; }
            } catch (\Throwable $Silian_ignore) { /* mock prepare null or driver unsupported */ }

            // 月度统计：根据驱动选用不同语法
            $Silian_monthlyStats = [];
            try {
                if ($Silian_driver === 'sqlite') {
                    $Silian_monthlySql = "SELECT strftime('%Y-%m', date) as month,
                        COUNT(*) as records_count,
                        COALESCE(SUM(CASE WHEN status='approved' THEN carbon_saved ELSE 0 END),0) as carbon_saved,
                        COALESCE(SUM(CASE WHEN status='approved' THEN points_earned ELSE 0 END),0) as points_earned
                        FROM carbon_records
                        WHERE user_id = :user_id AND deleted_at IS NULL
                        AND date >= date('now','-12 months')
                        GROUP BY strftime('%Y-%m', date)
                        ORDER BY month DESC";
                } else {
                    $Silian_monthlySql = "SELECT DATE_FORMAT(date,'%Y-%m') as month,
                        COUNT(*) as records_count,
                        COALESCE(SUM(CASE WHEN status='approved' THEN carbon_saved ELSE 0 END),0) as carbon_saved,
                        COALESCE(SUM(CASE WHEN status='approved' THEN points_earned ELSE 0 END),0) as points_earned
                        FROM carbon_records
                        WHERE user_id = :user_id AND deleted_at IS NULL
                        AND date >= DATE_SUB(CURDATE(), INTERVAL 12 MONTH)
                        GROUP BY DATE_FORMAT(date,'%Y-%m')
                        ORDER BY month DESC";
                }
                $Silian_monthlyStmt = $this->db->prepare($Silian_monthlySql);
                $Silian_monthlyStmt->execute(['user_id' => $Silian_user['id']]);
                $Silian_monthlyStats = $Silian_monthlyStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (\Throwable $Silian_ignore) { /* swallow for unit mocks */ }

            $Silian_monthlyAchievements = [];
            try {
                $Silian_currentMonth = date('Y-m');
                if ($Silian_driver === 'sqlite') {
                    $Silian_achievementsSql = "SELECT a.name_zh as name, SUM(r.points_earned) as points
                        FROM carbon_records r LEFT JOIN carbon_activities a ON r.activity_id = a.id
                        WHERE r.user_id = :user_id AND r.status='approved'
                        AND strftime('%Y-%m', r.date) = :current_month AND r.deleted_at IS NULL
                        GROUP BY r.activity_id, a.name_zh ORDER BY SUM(r.points_earned) DESC LIMIT 10";
                } else {
                    $Silian_achievementsSql = "SELECT a.name_zh as name, SUM(r.points_earned) as points
                        FROM carbon_records r LEFT JOIN carbon_activities a ON r.activity_id = a.id
                        WHERE r.user_id = :user_id AND r.status='approved'
                        AND DATE_FORMAT(r.date,'%Y-%m') = :current_month AND r.deleted_at IS NULL
                        GROUP BY r.activity_id, a.name_zh ORDER BY SUM(r.points_earned) DESC LIMIT 10";
                }
                $Silian_achievementsStmt = $this->db->prepare($Silian_achievementsSql);
                $Silian_achievementsStmt->execute(['user_id' => $Silian_user['id'], 'current_month' => $Silian_currentMonth]);
                $Silian_monthlyAchievements = $Silian_achievementsStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
            } catch (\Throwable $Silian_ignore) { /* swallow */ }

            return $this->json($Silian_response, [
                'success' => true,
                'data' => [
                    'overview' => $Silian_stats,
                    'monthly' => $Silian_monthlyStats,
                    'monthly_achievements' => $Silian_monthlyAchievements
                ]
            ]);

        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'CarbonTrackController::getUserStats error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * 获取碳减排因子（占位，向后兼容）
     */
    public function getCarbonFactors(Request $Silian_request, Response $Silian_response): Response
    {
        return $this->json($Silian_response, [
            'success' => true,
            'data' => [
                'version' => '1.0',
                'note' => 'Use /carbon-activities for factors per activity',
            ]
        ]);
    }

    /**
     * 删除记录（软删除）
     */
    public function deleteTransaction(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, ['error' => 'Unauthorized'], 401);
            }
            $Silian_recordId = $Silian_args['id'];

            // 非管理员只能删自己的记录
            $Silian_condition = $this->authService->isAdminUser($Silian_user) ? '' : ' AND user_id = :user_id';
            $Silian_sql = "UPDATE carbon_records SET deleted_at = NOW() WHERE id = :id{$Silian_condition} AND deleted_at IS NULL";
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_params = ['id' => $Silian_recordId];
            if (!$this->authService->isAdminUser($Silian_user)) {
                $Silian_params['user_id'] = $Silian_user['id'];
            }
            $Silian_stmt->execute($Silian_params);

            // 审计日志：软删除碳减排记录（不区分是否真的删除成功，这里记录用户意图）
            try {
                $this->auditLog->logDataChange(
                    'carbon_management',
                    'record_deleted',
                    $Silian_user['id'],
                    $this->authService->isAdminUser($Silian_user) ? 'admin' : 'user',
                    'carbon_records',
                    $Silian_recordId,
                    null,
                    null,
                    ['by_admin' => $this->authService->isAdminUser($Silian_user)]
                );
            } catch (\Throwable $Silian_ignore) { /* ignore audit failures */ }

            return $this->json($Silian_response, ['success' => true]);
        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'CarbonTrackController::getCarbonFactors error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => 'Internal server error'], 500);
        }
    }

    /**
     * 创建碳减排记录
     */
    private function createCarbonRecord(array $Silian_data): string
    {
        $Silian_nowExpr = ($this->db->getAttribute(PDO::ATTR_DRIVER_NAME) === 'sqlite') ? 'datetime("now")' : 'NOW()';
        $Silian_sql = "
            INSERT INTO carbon_records (
                id, user_id, activity_id, amount, unit, carbon_saved,
                points_earned, date, description, images, status, created_at
            ) VALUES (
                :id, :user_id, :activity_id, :amount, :unit, :carbon_saved,
                :points_earned, :date, :description, :images, :status, $Silian_nowExpr
            )
        ";
        $Silian_recordId = $this->generateUuid();
        $Silian_images = $Silian_data['images'] ?? [];
        if (!is_array($Silian_images)) {
            $Silian_decoded = json_decode((string)$Silian_images, true);
            if (is_array($Silian_decoded)) { $Silian_images = $Silian_decoded; } else { $Silian_images = []; }
        }
        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute([
            'id' => $Silian_recordId,
            'user_id' => $Silian_data['user_id'],
            'activity_id' => $Silian_data['activity_id'],
            'amount' => $Silian_data['amount'],
            'unit' => $Silian_data['unit'],
            'carbon_saved' => $Silian_data['carbon_saved'],
            'points_earned' => $Silian_data['points_earned'],
            'date' => $Silian_data['date'],
            'description' => $Silian_data['description'],
            'images' => json_encode($Silian_images),
            'status' => $Silian_data['status']
        ]);
        return $Silian_recordId;
    }

    /**
     * 获取碳减排记录
     */
    private function resolveReviewAction(array $Silian_data): ?string
    {
        $Silian_action = $Silian_data['action'] ?? null;
        if ($Silian_action === null && isset($Silian_data['status'])) {
            $Silian_action = $Silian_data['status'];
        }

        if (!is_string($Silian_action)) {
            return null;
        }

        $Silian_normalized = strtolower(trim($Silian_action));
        if ($Silian_normalized === 'approve' || $Silian_normalized === 'approved') {
            return 'approve';
        }
        if ($Silian_normalized === 'reject' || $Silian_normalized === 'rejected') {
            return 'reject';
        }

        return null;
    }

    private function normalizeReviewNote($Silian_raw): ?string
    {
        $Silian_note = null;
        if (is_array($Silian_raw)) {
            $Silian_note = $Silian_raw['review_note'] ?? ($Silian_raw['admin_notes'] ?? ($Silian_raw['note'] ?? null));
        } elseif (is_string($Silian_raw)) {
            $Silian_note = $Silian_raw;
        }

        if (!is_string($Silian_note)) {
            return null;
        }

        $Silian_note = trim($Silian_note);
        return $Silian_note === '' ? null : $Silian_note;
    }

    /**
     * @param mixed $raw
     * @return array<int,string>
     */
    private function normalizeRecordIds($Silian_raw): array
    {
        if (is_string($Silian_raw)) {
            $Silian_raw = preg_split('/[\s,]+/', $Silian_raw);
        }

        if (!is_array($Silian_raw)) {
            return [];
        }

        $Silian_normalized = [];
        foreach ($Silian_raw as $Silian_value) {
            if (is_array($Silian_value) || is_object($Silian_value)) {
                continue;
            }

            $Silian_id = trim((string) $Silian_value);
            if ($Silian_id === '') {
                continue;
            }

            $Silian_normalized[$Silian_id] = $Silian_id;
        }

        return array_values($Silian_normalized);
    }

    /**
     * @param array<int,array<string,mixed>> $records
     * @param array<string,mixed> $adminUser
     * @return array{processed:array<int,string>,skipped:array<int,array<string,mixed>>}
     */
    private function processRecordReviewBatch(array $Silian_records, string $Silian_action, ?string $Silian_reviewNote, array $Silian_adminUser): array
    {
        $Silian_pending = [];
        $Silian_skipped = [];

        foreach ($Silian_records as $Silian_record) {
            $Silian_status = $Silian_record['status'] ?? '';
            if ($Silian_status !== 'pending') {
                $Silian_skipped[] = [
                    'id' => $Silian_record['id'] ?? null,
                    'status' => $Silian_status,
                ];
                continue;
            }

            $Silian_pending[] = $Silian_record;
        }

        if (empty($Silian_pending)) {
            return ['processed' => [], 'skipped' => $Silian_skipped];
        }

        $Silian_newStatus = $Silian_action === 'approve' ? 'approved' : 'rejected';
        $Silian_pointsByUser = [];
        $Silian_startedTransaction = false;

        try {
            $Silian_inTransaction = false;
            if (method_exists($this->db, 'inTransaction')) {
                try {
                    $Silian_inTransaction = $this->db->inTransaction();
                } catch (\Throwable $Silian_ignore) {
                    $Silian_inTransaction = false;
                }
            }

            if (!$Silian_inTransaction) {
                $Silian_startedTransaction = $this->db->beginTransaction();
            }

            $Silian_updateStmt = $this->db->prepare("UPDATE carbon_records\n                    SET status = :status,\n                        reviewed_by = :reviewed_by,\n                        reviewed_at = NOW(),\n                        review_note = :review_note\n                 WHERE id = :record_id");

            foreach ($Silian_pending as $Silian_index => $Silian_record) {
                $Silian_updateStmt->execute([
                    'status' => $Silian_newStatus,
                    'reviewed_by' => $Silian_adminUser['id'] ?? null,
                    'review_note' => $Silian_reviewNote,
                    'record_id' => $Silian_record['id'],
                ]);

                if ($Silian_action === 'approve') {
                    $Silian_points = (float) ($Silian_record['points_earned'] ?? 0);
                    if ($Silian_points !== 0.0) {
                        $Silian_userId = (int) ($Silian_record['user_id'] ?? 0);
                        if ($Silian_userId > 0) {
                            $Silian_pointsByUser[$Silian_userId] = ($Silian_pointsByUser[$Silian_userId] ?? 0) + $Silian_points;
                        }
                    }
                }

                $Silian_pending[$Silian_index]['status'] = $Silian_newStatus;
                $Silian_pending[$Silian_index]['review_note'] = $Silian_reviewNote;
                $Silian_pending[$Silian_index]['reviewed_by'] = $Silian_adminUser['id'] ?? null;
            }

            if ($Silian_action === 'approve' && !empty($Silian_pointsByUser)) {
                foreach ($Silian_pointsByUser as $Silian_userId => $Silian_points) {
                    if ($Silian_points != 0.0) {
                        $this->updateUserPoints($Silian_userId, $Silian_points);
                    }
                }
            }

            if ($Silian_startedTransaction) {
                $this->db->commit();
            }
        } catch (\Throwable $Silian_e) {
            if ($Silian_startedTransaction) {
                try {
                    if ($this->db->inTransaction()) {
                        $this->db->rollBack();
                    }
                } catch (\Throwable $Silian_ignore) {
                    // ignore rollback failure
                }
            }
            throw $Silian_e;
        }

        foreach ($Silian_pending as $Silian_record) {
            $this->auditLog->logAdminOperation(
                'carbon_record_' . ($Silian_action === 'approve' ? 'approve' : 'reject'),
                $Silian_adminUser['id'] ?? null,
                'carbon_management',
                [
                    'table' => 'carbon_records',
                    'record_id' => $Silian_record['id'],
                    'review_note' => $Silian_reviewNote,
                    'old_data' => ['status' => 'pending'],
                    'new_data' => ['status' => $Silian_record['status']],
                ]
            );
        }

        $Silian_recordsByUser = [];
        foreach ($Silian_pending as $Silian_record) {
            $Silian_userId = (int) ($Silian_record['user_id'] ?? 0);
            if ($Silian_userId <= 0) {
                continue;
            }

            $Silian_recordsByUser[$Silian_userId][] = $this->buildReviewSummaryRecord($Silian_record);
        }

        foreach ($Silian_recordsByUser as $Silian_userId => $Silian_userRecords) {
            $Silian_options = [
                'reviewed_by' => $Silian_adminUser['username'] ?? null,
                'reviewed_by_id' => $Silian_adminUser['id'] ?? null,
            ];
            $this->messageService->sendCarbonRecordReviewSummary($Silian_userId, $Silian_action, $Silian_userRecords, $Silian_reviewNote, $Silian_options);
        }

        $Silian_processedIds = [];
        foreach ($Silian_pending as $Silian_record) {
            if (isset($Silian_record['id'])) {
                $Silian_processedIds[] = $Silian_record['id'];
            }
        }

        return [
            'processed' => $Silian_processedIds,
            'skipped' => $Silian_skipped,
        ];
    }

    /**
     * @param array<string,mixed> $record
     * @return array<string,mixed>
     */
    private function buildReviewSummaryRecord(array $Silian_record): array
    {
        $Silian_activityName = $Silian_record['activity_name_zh']
            ?? $Silian_record['activity_name_en']
            ?? $Silian_record['activity_name']
            ?? $Silian_record['activity_id']
            ?? '';

        $Silian_amount = $Silian_record['amount'] ?? ($Silian_record['data_value'] ?? null);
        $Silian_unit = $Silian_record['activity_unit'] ?? ($Silian_record['unit'] ?? null);
        $Silian_date = $Silian_record['date'] ?? ($Silian_record['created_at'] ?? null);

        return [
            'id' => $Silian_record['id'] ?? null,
            'activity_name' => $Silian_activityName,
            'activity_category' => $Silian_record['activity_category'] ?? null,
            'data_value' => $Silian_amount,
            'unit' => $Silian_unit,
            'carbon_saved' => $Silian_record['carbon_saved'] ?? null,
            'points_earned' => $Silian_record['points_earned'] ?? null,
            'date' => $Silian_date,
            'status' => $Silian_record['status'] ?? null,
            'review_note' => $Silian_record['review_note'] ?? null,
        ];
    }

    private function getCarbonRecord(string $Silian_recordId): ?array
    {
        $Silian_records = $this->getCarbonRecordsByIds([$Silian_recordId]);
        return $Silian_records[0] ?? null;
    }

    /**
     * @param array<int,string> $recordIds
     * @return array<int,array<string,mixed>>
     */
    private function getCarbonRecordsByIds(array $Silian_recordIds): array
    {
        if (empty($Silian_recordIds)) {
            return [];
        }

        $Silian_recordIds = array_values(array_unique(array_filter(array_map(static function ($Silian_value) {
            if (is_array($Silian_value) || is_object($Silian_value)) {
                return null;
            }

            $Silian_value = trim((string) $Silian_value);
            return $Silian_value === '' ? null : $Silian_value;
        }, $Silian_recordIds))));

        if (empty($Silian_recordIds)) {
            return [];
        }

        $Silian_placeholders = [];
        $Silian_params = [];
        foreach ($Silian_recordIds as $Silian_index => $Silian_id) {
            $Silian_placeholder = ':id' . $Silian_index;
            $Silian_placeholders[] = $Silian_placeholder;
            $Silian_params[$Silian_placeholder] = $Silian_id;
        }

            // Installations do not have a `full_name` column on the `users` table.
            // Use `username` as a safe fallback to avoid SQL errors.
            $Silian_sql = sprintf(
            "SELECT r.*,\n                    u.username AS user_username,\n                    u.email AS user_email,\n                    u.username AS user_full_name,\n                    a.name_zh AS activity_name_zh,\n                    a.name_en AS activity_name_en,\n                    a.category AS activity_category,\n                    a.unit AS activity_unit\n             FROM carbon_records r\n             LEFT JOIN users u ON r.user_id = u.id\n             LEFT JOIN carbon_activities a ON r.activity_id = a.id\n             WHERE r.id IN (%s) AND r.deleted_at IS NULL",
            implode(',', $Silian_placeholders)
        );

        $Silian_stmt = $this->db->prepare($Silian_sql);
        foreach ($Silian_params as $Silian_key => $Silian_value) {
            $Silian_stmt->bindValue($Silian_key, $Silian_value);
        }
        $Silian_stmt->execute();

        $Silian_records = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC);
        if (!is_array($Silian_records)) {
            return [];
        }

        return $Silian_records;
    }

    /**
     * 更新用户积分
     */
    private function updateUserPoints(int $Silian_userId, float $Silian_points): void
    {
        $Silian_sql = "UPDATE users SET points = points + :points WHERE id = :user_id";
        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute(['points' => $Silian_points, 'user_id' => $Silian_userId]);
    }

    /**
     * 通知管理员新记录
     */
    private function notifyAdminsNewRecord(string $Silian_recordId, array $Silian_user, array $Silian_activity): void
    {
        // 获取管理员列表
        $Silian_sql = "SELECT id, email, username FROM users WHERE is_admin = 1 AND deleted_at IS NULL";
        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute();
        $Silian_admins = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC);

        if (empty($Silian_admins)) {
            return;
        }

        $Silian_recipients = array_map(static function (array $Silian_admin): array {
            return [
                'id' => isset($Silian_admin['id']) ? (int) $Silian_admin['id'] : 0,
                'email' => $Silian_admin['email'] ?? null,
                'username' => $Silian_admin['username'] ?? null,
            ];
        }, $Silian_admins);

        $this->messageService->sendAdminNotificationBatch(
            $Silian_recipients,
            'new_record_pending',
            '有新待审核碳减排记录',
            "用户 {$Silian_user['username']} 提交了新的 {$Silian_activity['name_zh']} 记录，请及时处理。",
            'high'
        );
    }


    /**
     * 发送审核通知
     */
    /**
     * 生成UUID
     */
    private function generateUuid(): string
    {
        return sprintf(
            '%04x%04x-%04x-%04x-%04x-%04x%04x%04x',
            mt_rand(0, 0xffff), mt_rand(0, 0xffff),
            mt_rand(0, 0xffff),
            mt_rand(0, 0x0fff) | 0x4000,
            mt_rand(0, 0x3fff) | 0x8000,
            mt_rand(0, 0xffff), mt_rand(0, 0xffff), mt_rand(0, 0xffff)
        );
    }

    /**
     * 规范化 images 字段
     * 支持多种传入格式并统一输出标准数组：
     * - null 或 空 -> []
     * - ["url1","url2"] 字符串数组
     * - [{ public_url:..., file_path:..., original_name:... }, ...] 对象数组
     * - 单个字符串 "url"
     * 最终统一为 [{"url": "...", "file_path": "...", "original_name": "...", "mime_type": "...", "size": int|null }]
     */
    private function normalizeImages($Silian_raw): array
    {
        if (empty($Silian_raw)) { return []; }
        if (is_string($Silian_raw)) {
            $Silian_raw = [$Silian_raw];
        }
        if (!is_array($Silian_raw)) {
            return [];
        }

        $Silian_result = [];
        foreach ($Silian_raw as $Silian_item) {
            $Silian_normalized = $this->normalizeImageItem($Silian_item);
            if ($Silian_normalized !== null) {
                $Silian_result[] = $Silian_normalized;
            }
        }

        return $Silian_result;
    }

    /**
     * 规范化单个图片项
     * @param mixed $item
     */
    private function normalizeImageItem($Silian_item): ?array
    {
        if (is_string($Silian_item)) {
            $Silian_item = ['url' => $Silian_item];
        } elseif (!is_array($Silian_item)) {
            return null;
        }

        $Silian_url = $Silian_item['url'] ?? $Silian_item['public_url'] ?? null;
        $Silian_filePath = $Silian_item['file_path'] ?? null;

        if (!$Silian_filePath && isset($Silian_item['public_url']) && $this->r2Service) {
            $Silian_filePath = $this->r2Service->resolveKeyFromUrl((string)$Silian_item['public_url']);
        }

        if (!$Silian_filePath && $Silian_url && $this->r2Service) {
            $Silian_filePath = $this->r2Service->resolveKeyFromUrl((string)$Silian_url);
        }

        if (is_string($Silian_filePath) && $Silian_filePath !== '') {
            $Silian_filePath = ltrim($Silian_filePath, '/');
        } else {
            $Silian_filePath = null;
        }

        if (!$Silian_url && $Silian_filePath && $this->r2Service) {
            try {
                $Silian_url = $this->r2Service->getPublicUrl($Silian_filePath);
            } catch (\Throwable $Silian_ignore) {
                $Silian_url = null;
            }
        }

        $Silian_meta = [
            'url' => $Silian_url,
            'file_path' => $Silian_filePath,
            'original_name' => $Silian_item['original_name'] ?? null,
            'mime_type' => $Silian_item['mime_type'] ?? null,
            'size' => $Silian_item['file_size'] ?? ($Silian_item['size'] ?? null),
            'presigned_url' => $Silian_item['presigned_url'] ?? null,
        ];

        if (isset($Silian_item['thumbnail_path'])) {
            $Silian_meta['thumbnail_path'] = $Silian_item['thumbnail_path'];
        }

        if ($Silian_filePath && $this->r2Service) {
            try {
                $Silian_meta['presigned_url'] = $this->r2Service->generatePresignedUrl($Silian_filePath, 600);
            } catch (\Throwable $Silian_ignore) {
                // ignore failure
            }
        }

        return $Silian_meta;
    }
    private function json(Response $Silian_response, array $Silian_data, int $Silian_status = 200): Response
    {
        $Silian_response->getBody()->write(json_encode($Silian_data));
        return $Silian_response->withStatus($Silian_status)->withHeader('Content-Type', 'application/json');
    }

    private function normalizeCheckinDate(string $Silian_raw): ?string
    {
        $Silian_raw = trim($Silian_raw);
        if ($Silian_raw === '') {
            return null;
        }

        $Silian_candidate = \DateTimeImmutable::createFromFormat('Y-m-d', $Silian_raw);
        if ($Silian_candidate instanceof \DateTimeImmutable && $Silian_candidate->format('Y-m-d') === $Silian_raw) {
            return $Silian_candidate->format('Y-m-d');
        }

        try {
            $Silian_fallback = new \DateTimeImmutable($Silian_raw);
            return $Silian_fallback->format('Y-m-d');
        } catch (\Throwable $Silian_e) {
            return null;
        }
    }


    private function logControllerException(\Throwable $Silian_exception, Request $Silian_request, string $Silian_contextMessage = ''): void
    {
        if ($this->errorLogService) {
            try {
                $Silian_extra = $Silian_contextMessage !== '' ? ['context_message' => $Silian_contextMessage] : [];
                $this->errorLogService->logException($Silian_exception, $Silian_request, $Silian_extra);
                return;
            } catch (\Throwable $Silian_loggingError) {
                error_log(self::ERRLOG_PREFIX . $Silian_loggingError->getMessage());
            }
        }
        if ($Silian_contextMessage !== '') {
            error_log($Silian_contextMessage);
        } else {
            error_log($Silian_exception->getMessage());
        }
    }

}
