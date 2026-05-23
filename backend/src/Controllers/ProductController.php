<?php

namespace CarbonTrack\Controllers;

use Psr\Http\Message\ResponseInterface as Response;
use Psr\Http\Message\ServerRequestInterface as Request;
use CarbonTrack\Services\MessageService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\CloudflareR2Service;
use CarbonTrack\Services\ErrorLogService;
use PDO;
use PDOException;

class ProductController
{
    private PDO $db;
    private MessageService $messageService;
    private AuditLogService $auditLog;
    private AuthService $authService;
    private ?ErrorLogService $errorLogService;
    private ?CloudflareR2Service $r2Service;

    private const ERR_INTERNAL = 'Internal server error';
    private const ERR_ADMIN_REQUIRED = 'Admin access required';
    private const ERRLOG_PREFIX = 'ErrorLogService failed: ';

    private ?string $pointExchangeUserIdColumn = null;
    private ?string $pointsTransactionUserIdColumn = null;
    private ?array $pointsTransactionColumns = null;
    private ?bool $pointExchangeHasAreaCode = null;

    public function __construct(
        PDO $Silian_db,
        MessageService $Silian_messageService,
        AuditLogService $Silian_auditLog,
        AuthService $Silian_authService,
        ErrorLogService $Silian_errorLogService = null,
        CloudflareR2Service $Silian_r2Service = null
    ) {
        $this->db = $Silian_db;
        $this->messageService = $Silian_messageService;
        $this->auditLog = $Silian_auditLog;
        $this->authService = $Silian_authService;
        $this->errorLogService = $Silian_errorLogService;
        $this->r2Service = $Silian_r2Service;
    }

    /**
     * 获取商品列表
     */
    public function getProducts(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_params = $Silian_request->getQueryParams();
            // 管理端调用该方法时，会经过 AdminMiddleware，这里再做一次判定用于放宽筛选条件
            $Silian_currentUser = null;
            try { $Silian_currentUser = $this->authService->getCurrentUser($Silian_request); } catch (\Throwable $Silian_ignore) {}
            $Silian_isAdminCall = $Silian_currentUser && $this->authService->isAdminUser($Silian_currentUser);
            $Silian_page = max(1, intval($Silian_params['page'] ?? 1));
            $Silian_limit = min(50, max(10, intval($Silian_params['limit'] ?? 20)));
            $Silian_offset = ($Silian_page - 1) * $Silian_limit;

            // 构建查询条件
            $Silian_where = ['p.deleted_at IS NULL'];
            $Silian_bindings = [];

            $Silian_tagSlugs = [];
            if (isset($Silian_params['tag'])) {
                if (is_array($Silian_params['tag'])) {
                    $Silian_tagSlugs = array_merge($Silian_tagSlugs, $Silian_params['tag']);
                } else {
                    $Silian_tagSlugs[] = (string)$Silian_params['tag'];
                }
            }
            if (isset($Silian_params['tags'])) {
                if (is_array($Silian_params['tags'])) {
                    $Silian_tagSlugs = array_merge($Silian_tagSlugs, $Silian_params['tags']);
                } else {
                    $Silian_tagSlugs = array_merge($Silian_tagSlugs, explode(',', (string)$Silian_params['tags']));
                }
            }
            $Silian_tagSlugs = array_values(array_unique(array_filter(array_map('trim', $Silian_tagSlugs), static function ($Silian_slug) {
                return $Silian_slug !== '';
            })));

            // 前台商品列表默认仅展示 active；管理员列表可查看所有或按 status 过滤
            if (!$Silian_isAdminCall) {
                $Silian_where[] = 'p.status = "active"';
            } else if (!empty($Silian_params['status'])) {
                $Silian_where[] = 'p.status = :status';
                $Silian_bindings['status'] = $Silian_params['status'];
            }

            if (!empty($Silian_params['category'])) {
                $Silian_rawCategory = trim((string)$Silian_params['category']);
                if ($Silian_rawCategory !== '') {
                    $Silian_categorySlug = $this->normalizeSlug($Silian_rawCategory);
                    $Silian_categoryNames = [];
                    if ($Silian_categorySlug !== '') {
                        $Silian_resolvedCategories = $this->fetchCategoriesBySlugs([$Silian_categorySlug]);
                        if (isset($Silian_resolvedCategories[$Silian_categorySlug])) {
                            $Silian_categoryNames[] = $Silian_resolvedCategories[$Silian_categorySlug]['name'];
                        }
                    }
                    $Silian_categoryNames[] = $Silian_rawCategory;

                    $Silian_where[] = '(
                        p.category_slug = :filter_category_slug
                        OR p.category = :filter_category_name
                        OR p.category = :filter_category_raw
                    )';
                    $Silian_bindings['filter_category_slug'] = $Silian_categorySlug ?: $this->slugifyCategoryName($Silian_rawCategory);
                    $Silian_bindings['filter_category_name'] = $Silian_categoryNames[0];
                    $Silian_bindings['filter_category_raw'] = $Silian_rawCategory;
                }
            }

            if (!empty($Silian_params['search'])) {
                $Silian_where[] = '(p.name LIKE :search_name OR p.description LIKE :search_description)';
                $Silian_searchPattern = '%' . $Silian_params['search'] . '%';
                $Silian_bindings['search_name'] = $Silian_searchPattern;
                $Silian_bindings['search_description'] = $Silian_searchPattern;
            }

            if (isset($Silian_params['min_points'])) {
                $Silian_where[] = 'p.points_required >= :min_points';
                $Silian_bindings['min_points'] = intval($Silian_params['min_points']);
            }

            if (isset($Silian_params['max_points'])) {
                $Silian_where[] = 'p.points_required <= :max_points';
                $Silian_bindings['max_points'] = intval($Silian_params['max_points']);
            }

            if (!empty($Silian_tagSlugs)) {
                $Silian_tagPlaceholders = [];
                foreach ($Silian_tagSlugs as $Silian_index => $Silian_slug) {
                    $Silian_paramKey = 'tag_slug_' . $Silian_index;
                    $Silian_tagPlaceholders[] = ':' . $Silian_paramKey;
                    $Silian_bindings[$Silian_paramKey] = $Silian_slug;
                }
                $Silian_where[] = 'EXISTS (
                    SELECT 1
                    FROM product_tag_map ptm
                    INNER JOIN product_tags pt ON ptm.tag_id = pt.id
                    WHERE ptm.product_id = p.id
                    AND pt.slug IN (' . implode(', ', $Silian_tagPlaceholders) . ')
                )';
            }

            $Silian_whereClause = implode(' AND ', $Silian_where);

            // 获取总数
            $Silian_countSql = "SELECT COUNT(*) as total FROM products p WHERE {$Silian_whereClause}";
            $Silian_countStmt = $this->db->prepare($Silian_countSql);
            $Silian_countStmt->execute($Silian_bindings);
            $Silian_total = $Silian_countStmt->fetch(PDO::FETCH_ASSOC)['total'];

            $Silian_orderByClause = $this->buildProductOrderByClause($Silian_params['sort'] ?? null);

            // 获取商品列表
            $Silian_sql = "
                SELECT
                    p.*,
                    COALESCE(e.total_exchanged, 0) as total_exchanged
                FROM products p
                LEFT JOIN (
                    SELECT product_id, COUNT(*) as total_exchanged
                    FROM point_exchanges
                    WHERE status = 'completed'
                    GROUP BY product_id
                ) e ON p.id = e.product_id
                WHERE {$Silian_whereClause}
                ORDER BY {$Silian_orderByClause}
                LIMIT :limit OFFSET :offset
            ";

            $Silian_stmt = $this->db->prepare($Silian_sql);
            foreach ($Silian_bindings as $Silian_key => $Silian_value) {
                $Silian_stmt->bindValue($Silian_key, $Silian_value);
            }
            $Silian_stmt->bindValue('limit', $Silian_limit, PDO::PARAM_INT);
            $Silian_stmt->bindValue('offset', $Silian_offset, PDO::PARAM_INT);
            $Silian_stmt->execute();

            $Silian_products = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC);

            $Silian_productIds = array_map(static function ($Silian_item) {
                return isset($Silian_item['id']) ? (int)$Silian_item['id'] : null;
            }, $Silian_products);
            $Silian_productIds = array_values(array_filter($Silian_productIds, static fn($Silian_v) => $Silian_v !== null));
            $Silian_tagsMap = $Silian_productIds ? $this->loadTagsForProducts($Silian_productIds) : [];

            foreach ($Silian_products as &$Silian_product) {
                $Silian_product = $this->prepareProductPayload($Silian_product, $Silian_isAdminCall, $Silian_request);
                $Silian_product['tags'] = $Silian_tagsMap[$Silian_product['id']] ?? [];
            }
            unset($Silian_product);

            $Silian_pages = (int)ceil($Silian_total / $Silian_limit);
            return $this->json($Silian_response, [
                'success' => true,
                'data' => [
                    'products' => $Silian_products,
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
                ]
            ]);

        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'ProductController::getProducts error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => self::ERR_INTERNAL], 500);
        }
    }

    /**
     * 获取商品详情
     */
    public function getProductDetail(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_currentUser = null;
            try { $Silian_currentUser = $this->authService->getCurrentUser($Silian_request); } catch (\Throwable $Silian_ignore) {}
            $Silian_isAdminCall = $Silian_currentUser && $this->authService->isAdminUser($Silian_currentUser);

            $Silian_productId = $Silian_args['id'];

            $Silian_sql = "
                SELECT
                    p.*,
                    COALESCE(e.total_exchanged, 0) as total_exchanged
                FROM products p
                LEFT JOIN (
                    SELECT product_id, COUNT(*) as total_exchanged
                    FROM point_exchanges
                    WHERE status = 'completed'
                    GROUP BY product_id
                ) e ON p.id = e.product_id
                WHERE p.id = :product_id AND p.deleted_at IS NULL
            ";

            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute(['product_id' => $Silian_productId]);
            $Silian_product = $Silian_stmt->fetch(PDO::FETCH_ASSOC);

            if (!$Silian_product) {
                return $this->json($Silian_response, ['error' => 'Product not found'], 404);
            }

            $Silian_product = $this->prepareProductPayload($Silian_product, $Silian_isAdminCall, $Silian_request);

            $Silian_tagMap = $this->loadTagsForProducts([(int)$Silian_product['id']]);
            $Silian_product['tags'] = $Silian_tagMap[$Silian_product['id']] ?? [];

            return $this->json($Silian_response, [
                'success' => true,
                'data' => $Silian_product
            ]);

        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'ProductController::getProductDetail error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => self::ERR_INTERNAL], 500);
        }
    }

    /**
     * 兑换商品
     */
    public function exchangeProduct(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, ['error' => 'Unauthorized'], 401);
            }

            $Silian_data = $Silian_request->getParsedBody();
            if (!is_array($Silian_data)) { $Silian_data = []; }

            // 字段同义词兼容：shipping_address -> delivery_address, address -> delivery_address
            // phone|mobile|contact -> contact_phone, remark|comments -> notes
            $Silian_synonyms = [
                'delivery_address' => ['shipping_address', 'address', 'ship_address'],
                'contact_phone' => ['phone', 'mobile', 'tel', 'contact'],
                'notes' => ['remark', 'remarks', 'comment', 'comments', 'note']
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

            if (!isset($Silian_data['product_id'])) {
                return $this->json($Silian_response, ['error' => 'Product ID is required'], 400);
            }

            $Silian_productId = $Silian_data['product_id'];
            $Silian_quantity = max(1, intval($Silian_data['quantity'] ?? 1));

            // 开始事务
            $this->db->beginTransaction();

            try {
                // 获取商品信息并锁定
                $Silian_sql = "SELECT * FROM products WHERE id = :id AND deleted_at IS NULL";
                try {
                    $Silian_driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME);
                } catch (\Throwable $Silian_driverError) {
                    $Silian_driver = null;
                }
                if ($Silian_driver !== 'sqlite') {
                    $Silian_sql .= ' FOR UPDATE';
                }
                $Silian_stmt = $this->db->prepare($Silian_sql);
                $Silian_stmt->execute(['id' => $Silian_productId]);
                $Silian_product = $Silian_stmt->fetch(PDO::FETCH_ASSOC);

                if (!$Silian_product) {
                    throw new \Exception('Product not found');
                }

                if ($Silian_product['status'] !== 'active') {
                    throw new \Exception('Product is not available');
                }

                // 检查库存
                if ($Silian_product['stock'] !== -1 && $Silian_product['stock'] < $Silian_quantity) {
                    throw new \Exception('Insufficient stock');
                }

                $Silian_totalPoints = $Silian_product['points_required'] * $Silian_quantity;

                // 检查用户积分
                if ($Silian_user['points'] < $Silian_totalPoints) {
                    throw new \Exception('Insufficient points');
                }

                // 扣除用户积分
                $Silian_sql = "UPDATE users SET points = points - :points WHERE id = :user_id";
                $Silian_stmt = $this->db->prepare($Silian_sql);
                $Silian_stmt->execute(['points' => $Silian_totalPoints, 'user_id' => $Silian_user['id']]);

                // 更新商品库存
                if ($Silian_product['stock'] !== -1) {
                    $Silian_sql = "UPDATE products SET stock = stock - :quantity WHERE id = :product_id";
                    $Silian_stmt = $this->db->prepare($Silian_sql);
                    $Silian_stmt->execute(['quantity' => $Silian_quantity, 'product_id' => $Silian_productId]);
                }

                // 创建兑换记录
                $Silian_exchangeId = $this->createExchangeRecord([
                    'user_id' => $Silian_user['id'],
                    'product_id' => $Silian_productId,
                    'quantity' => $Silian_quantity,
                    'points_used' => $Silian_totalPoints,
                    'product_name' => $Silian_product['name'],
                    'product_price' => $Silian_product['points_required'],
                    'delivery_address' => $Silian_data['delivery_address'] ?? null,
                    'contact_area_code' => $Silian_data['contact_area_code'] ?? null,
                    'contact_phone' => $Silian_data['contact_phone'] ?? null,
                    'notes' => $Silian_data['notes'] ?? null
                ]);

                // 记录积分交易
                $this->recordPointTransaction(
                    $Silian_user,
                    -$Silian_totalPoints,
                    'product_exchange',
                    "兑换商品：{$Silian_product['name']} x{$Silian_quantity}",
                    'point_exchanges',
                    $Silian_exchangeId
                );

                // 记录审计日志
                $this->auditLog->log(
                    $Silian_user['id'],
                    'product_exchanged',
                    'point_exchanges',
                    $Silian_exchangeId,
                    [
                        'product_id' => $Silian_productId,
                        'quantity' => $Silian_quantity,
                        'points_used' => $Silian_totalPoints
                    ]
                );

                // 发送站内信
                $this->messageService->sendMessage(
                    $Silian_user['id'],
                    'product_exchanged',
                    '商品兑换成功',
                    "您已成功兑换 {$Silian_product['name']} x{$Silian_quantity}，消耗 {$Silian_totalPoints} 积分。我们将尽快为您安排发货。",
                    'normal'
                );
                $this->messageService->sendExchangeConfirmationEmailToUser(
                    (int) $Silian_user['id'],
                    (string) ($Silian_product['name'] ?? ''),
                    $Silian_quantity,
                    (float) $Silian_totalPoints,
                    $Silian_user['email'] ?? null,
                    $Silian_user['username'] ?? ($Silian_user['full_name'] ?? ($Silian_user['name'] ?? null))
                );


                // 通知管理员
                $this->notifyAdminsNewExchange($Silian_exchangeId, $Silian_user, $Silian_product, $Silian_quantity);

                $this->db->commit();

                return $this->json($Silian_response, [
                    'success' => true,
                    'exchange_id' => $Silian_exchangeId,
                    'points_used' => $Silian_totalPoints,
                    'remaining_points' => $Silian_user['points'] - $Silian_totalPoints,
                    'message' => 'Product exchanged successfully'
                ]);

            } catch (\Exception $Silian_e) {
                $this->db->rollBack();
                throw $Silian_e;
            }

        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'ProductController::exchangeProduct error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, [
                'success' => false,
                'message' => $Silian_e->getMessage(),
                'error' => $Silian_e->getMessage(),
                'code' => 'EXCHANGE_FAILED'
            ], 400);
        }
    }

    /**
     * 获取当前用户兑换历史（路由别名，复用 getUserExchanges）
     */
    public function getExchangeTransactions(Request $Silian_request, Response $Silian_response): Response
    {
        return $this->getUserExchanges($Silian_request, $Silian_response);
    }

    /**
     * 获取当前用户某条兑换详情
     */
    public function getExchangeTransaction(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user) {
                return $this->json($Silian_response, ['error' => 'Unauthorized'], 401);
            }
            $Silian_exchangeId = $Silian_args['id'];
            $Silian_userColumn = $this->pointExchangeUserColumn();
            $Silian_sql = "SELECT * FROM point_exchanges WHERE id = :id AND {$Silian_userColumn} = :uid AND deleted_at IS NULL";
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute(['id' => $Silian_exchangeId, 'uid' => $Silian_user['id']]);
            $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC);
            if (!$Silian_row) {
                return $this->json($Silian_response, ['error' => 'Exchange not found'], 404);
            }
            return $this->json($Silian_response, ['success' => true, 'data' => $Silian_row]);
        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'ProductController::getExchangeTransaction error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => self::ERR_INTERNAL], 500);
        }
    }

    /**
     * 获取用户兑换历史
     */
    public function getUserExchanges(Request $Silian_request, Response $Silian_response): Response
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

            $Silian_where = [
                $this->pointExchangeUserColumn('e') . ' = :user_id',
                'e.deleted_at IS NULL',
            ];
            $Silian_bindings = [
                'user_id' => (int) $Silian_user['id'],
            ];

            if (!empty($Silian_params['status'])) {
                $Silian_where[] = 'e.status = :status';
                $Silian_bindings['status'] = trim((string) $Silian_params['status']);
            }

            $Silian_search = trim((string) ($Silian_params['search'] ?? ''));
            if ($Silian_search !== '') {
                [$Silian_searchClause, $Silian_searchBindings] = $this->buildNamedLikeClause([
                    'LOWER(e.id)',
                    'LOWER(COALESCE(e.product_name, \'\'))',
                    'LOWER(COALESCE(e.tracking_number, \'\'))',
                    'LOWER(COALESCE(e.notes, \'\'))',
                ], $Silian_search, 'exchange_search');
                $Silian_where[] = $Silian_searchClause;
                $Silian_bindings = array_merge($Silian_bindings, $Silian_searchBindings);
            }

            $Silian_dateFrom = trim((string) ($Silian_params['date_from'] ?? ''));
            if ($Silian_dateFrom !== '') {
                $Silian_where[] = 'e.created_at >= :date_from';
                $Silian_bindings['date_from'] = $Silian_dateFrom . ' 00:00:00';
            }

            $Silian_dateTo = trim((string) ($Silian_params['date_to'] ?? ''));
            if ($Silian_dateTo !== '') {
                $Silian_where[] = 'e.created_at <= :date_to';
                $Silian_bindings['date_to'] = $Silian_dateTo . ' 23:59:59';
            }

            $Silian_whereClause = implode(' AND ', $Silian_where);
            $Silian_orderByClause = $this->buildExchangeOrderByClause($Silian_params['sort'] ?? null, 'e');

            // 获取总数
            $Silian_countSql = "
                SELECT COUNT(*) as total
                FROM point_exchanges e
                WHERE {$Silian_whereClause}
            ";
            $Silian_countStmt = $this->db->prepare($Silian_countSql);
            $Silian_countStmt->execute($Silian_bindings);
            $Silian_total = $Silian_countStmt->fetch(PDO::FETCH_ASSOC)['total'];

            // 获取兑换记录
            $Silian_sql = "
                SELECT
                    e.*,
                    p.name as current_product_name,
                    p.images as current_product_images
                FROM point_exchanges e
                LEFT JOIN products p ON e.product_id = p.id
                WHERE {$Silian_whereClause}
                ORDER BY {$Silian_orderByClause}
                LIMIT :limit OFFSET :offset
            ";

            $Silian_stmt = $this->db->prepare($Silian_sql);
            foreach ($Silian_bindings as $Silian_key => $Silian_value) {
                $Silian_stmt->bindValue($Silian_key, $Silian_value);
            }
            $Silian_stmt->bindValue('limit', $Silian_limit, PDO::PARAM_INT);
            $Silian_stmt->bindValue('offset', $Silian_offset, PDO::PARAM_INT);
            $Silian_stmt->execute();

            $Silian_exchanges = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC);

            // 处理图片字段
            foreach ($Silian_exchanges as &$Silian_exchange) {
                $Silian_exchange['current_product_images'] = $Silian_exchange['current_product_images']
                    ? json_decode($Silian_exchange['current_product_images'], true)
                    : [];
            }

            return $this->json($Silian_response, [
                'success' => true,
                'data' => $Silian_exchanges,
                'pagination' => [
                    'page' => $Silian_page,
                    'limit' => $Silian_limit,
                    'total' => intval($Silian_total),
                    'pages' => (int) ceil($Silian_total / $Silian_limit),
                    'current_page' => $Silian_page,
                    'per_page' => $Silian_limit,
                    'total_items' => intval($Silian_total),
                    'total_pages' => (int) ceil($Silian_total / $Silian_limit),
                ]
            ]);

        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'ProductController::getUserExchanges error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => self::ERR_INTERNAL], 500);
        }
    }

    /**
     * 管理员获取兑换记录
     */
    public function getExchangeRecords(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->json($Silian_response, ['error' => self::ERR_ADMIN_REQUIRED], 403);
            }

            $Silian_params = $Silian_request->getQueryParams();
            $Silian_page = max(1, intval($Silian_params['page'] ?? 1));
            $Silian_limit = min(50, max(10, intval($Silian_params['limit'] ?? 20)));
            $Silian_offset = ($Silian_page - 1) * $Silian_limit;

            // 构建查询条件
            $Silian_where = ['e.deleted_at IS NULL'];
            $Silian_bindings = [];
            $Silian_userJoinSql = 'LEFT JOIN users u ON ' . $this->pointExchangeUserColumn('e') . ' = u.id';

            if (!empty($Silian_params['status'])) {
                $Silian_where[] = 'e.status = :status';
                $Silian_bindings['status'] = $Silian_params['status'];
            }

            if (!empty($Silian_params['user_id'])) {
                $Silian_where[] = $this->pointExchangeUserColumn('e') . ' = :user_id';
                $Silian_bindings['user_id'] = $Silian_params['user_id'];
            }

            $Silian_search = trim((string) ($Silian_params['search'] ?? ''));
            if ($Silian_search !== '') {
                [$Silian_searchClause, $Silian_searchBindings] = $this->buildNamedLikeClause([
                    'LOWER(e.id)',
                    'LOWER(COALESCE(e.product_name, \'\'))',
                    'LOWER(COALESCE(e.tracking_number, \'\'))',
                    'LOWER(COALESCE(e.contact_phone, \'\'))',
                    'LOWER(COALESCE(u.username, \'\'))',
                    'LOWER(COALESCE(u.email, \'\'))',
                ], $Silian_search, 'exchange_search');
                $Silian_where[] = $Silian_searchClause;
                $Silian_bindings = array_merge($Silian_bindings, $Silian_searchBindings);
            }

            $Silian_whereClause = implode(' AND ', $Silian_where);
            $Silian_orderByClause = $this->buildExchangeOrderByClause($Silian_params['sort'] ?? null, 'e');

            // 获取总数
            $Silian_countSql = "
                SELECT COUNT(*) as total
                FROM point_exchanges e
                {$Silian_userJoinSql}
                WHERE {$Silian_whereClause}
            ";
            $Silian_countStmt = $this->db->prepare($Silian_countSql);
            $Silian_countStmt->execute($Silian_bindings);
            $Silian_total = $Silian_countStmt->fetch(PDO::FETCH_ASSOC)['total'];

            // 获取兑换记录
            $Silian_sql = "
                SELECT
                    e.*,
                    u.username,
                    u.email,
                    p.name as current_product_name,
                    p.image_path as current_product_image_path,
                    p.images as current_product_images
                FROM point_exchanges e
                {$Silian_userJoinSql}
                LEFT JOIN products p ON e.product_id = p.id
                WHERE {$Silian_whereClause}
                ORDER BY {$Silian_orderByClause}
                LIMIT :limit OFFSET :offset
            ";

            $Silian_stmt = $this->db->prepare($Silian_sql);
            foreach ($Silian_bindings as $Silian_key => $Silian_value) {
                $Silian_stmt->bindValue($Silian_key, $Silian_value);
            }
            $Silian_stmt->bindValue('limit', $Silian_limit, PDO::PARAM_INT);
            $Silian_stmt->bindValue('offset', $Silian_offset, PDO::PARAM_INT);
            $Silian_stmt->execute();

            $Silian_exchanges = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC);

            // 映射前端期望字段
            foreach ($Silian_exchanges as &$Silian_ex) {
                // 别名：用户与积分
                $Silian_ex['user_username'] = $Silian_ex['username'] ?? null;
                $Silian_ex['user_email'] = $Silian_ex['email'] ?? null;
                if (!isset($Silian_ex['total_points']) && isset($Silian_ex['points_used'])) {
                    $Silian_ex['total_points'] = (int)$Silian_ex['points_used'];
                }
                if (!isset($Silian_ex['shipping_address']) && isset($Silian_ex['delivery_address'])) {
                    $Silian_ex['shipping_address'] = $Silian_ex['delivery_address'];
                }
                if (!isset($Silian_ex['admin_notes']) && isset($Silian_ex['notes'])) {
                    $Silian_ex['admin_notes'] = $Silian_ex['notes'];
                }

                // 产品图片URL
                $Silian_imgUrl = null;
                if (!empty($Silian_ex['current_product_images'])) {
                    $Silian_imgs = json_decode($Silian_ex['current_product_images'], true);
                    if (is_array($Silian_imgs) && count($Silian_imgs) > 0) {
                        $Silian_first = $Silian_imgs[0];
                        if (is_array($Silian_first)) {
                            $Silian_imgUrl = $Silian_first['public_url'] ?? ($Silian_first['url'] ?? null);
                        } elseif (is_string($Silian_first)) {
                            $Silian_imgUrl = $Silian_first;
                        }
                    }
                }
                if (!$Silian_imgUrl && !empty($Silian_ex['current_product_image_path'])) {
                    $Silian_imgUrl = $Silian_ex['current_product_image_path'];
                }
                if (!isset($Silian_ex['product_image_url'])) {
                    $Silian_ex['product_image_url'] = $Silian_imgUrl;
                }
            }

            $Silian_pages = (int)ceil($Silian_total / $Silian_limit);
            return $this->json($Silian_response, [
                'success' => true,
                'data' => $Silian_exchanges,
                'pagination' => [
                    'page' => $Silian_page,
                    'limit' => $Silian_limit,
                    'total' => intval($Silian_total),
                    'pages' => $Silian_pages,
                    // 别名
                    'current_page' => $Silian_page,
                    'per_page' => $Silian_limit,
                    'total_items' => intval($Silian_total),
                    'total_pages' => $Silian_pages
                ]
            ]);

        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'ProductController::getExchangeRecords error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => self::ERR_INTERNAL], 500);
        }
    }

    /**
     * 管理员获取单个兑换记录详情
     */
    public function getExchangeRecordDetail(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->json($Silian_response, ['error' => self::ERR_ADMIN_REQUIRED], 403);
            }

            $Silian_exchangeId = $Silian_args['id'];
            $Silian_sql = "
                SELECT
                    e.*,
                    u.username,
                    u.email,
                    p.name as current_product_name,
                    p.image_path as current_product_image_path,
                    p.images as current_product_images
                FROM point_exchanges e
                LEFT JOIN users u ON " . $this->pointExchangeUserColumn('e') . " = u.id
                LEFT JOIN products p ON e.product_id = p.id
                WHERE e.id = :id AND e.deleted_at IS NULL
            ";
            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute(['id' => $Silian_exchangeId]);
            $Silian_exchange = $Silian_stmt->fetch(PDO::FETCH_ASSOC);

            if (!$Silian_exchange) {
                return $this->json($Silian_response, ['error' => 'Exchange not found'], 404);
            }

            // 映射别名
            $Silian_exchange['user_username'] = $Silian_exchange['username'] ?? null;
            $Silian_exchange['user_email'] = $Silian_exchange['email'] ?? null;
            if (!isset($Silian_exchange['total_points']) && isset($Silian_exchange['points_used'])) {
                $Silian_exchange['total_points'] = (int)$Silian_exchange['points_used'];
            }
            if (!isset($Silian_exchange['shipping_address']) && isset($Silian_exchange['delivery_address'])) {
                $Silian_exchange['shipping_address'] = $Silian_exchange['delivery_address'];
            }
            if (!isset($Silian_exchange['admin_notes']) && isset($Silian_exchange['notes'])) {
                $Silian_exchange['admin_notes'] = $Silian_exchange['notes'];
            }
            // 产品图片
            $Silian_imgUrl = null;
            if (!empty($Silian_exchange['current_product_images'])) {
                $Silian_imgs = json_decode($Silian_exchange['current_product_images'], true);
                if (is_array($Silian_imgs) && count($Silian_imgs) > 0) {
                    $Silian_first = $Silian_imgs[0];
                    if (is_array($Silian_first)) {
                        $Silian_imgUrl = $Silian_first['public_url'] ?? ($Silian_first['url'] ?? null);
                    } elseif (is_string($Silian_first)) {
                        $Silian_imgUrl = $Silian_first;
                    }
                }
            }
            if (!$Silian_imgUrl && !empty($Silian_exchange['current_product_image_path'])) {
                $Silian_imgUrl = $Silian_exchange['current_product_image_path'];
            }
            $Silian_exchange['product_image_url'] = $Silian_exchange['product_image_url'] ?? $Silian_imgUrl;

            return $this->json($Silian_response, [
                'success' => true,
                'data' => $Silian_exchange
            ]);
        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'ProductController::getExchangeRecordDetail error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => self::ERR_INTERNAL], 500);
        }
    }

    /**
     * 管理员更新兑换状态
     */
    public function updateExchangeStatus(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->json($Silian_response, ['error' => self::ERR_ADMIN_REQUIRED], 403);
            }

            $Silian_exchangeId = $Silian_args['id'];
            $Silian_data = $Silian_request->getParsedBody();

            if (!isset($Silian_data['status']) || !in_array($Silian_data['status'], ['processing', 'shipped', 'completed', 'cancelled', 'rejected'], true)) {
                return $this->json($Silian_response, ['error' => 'Invalid status'], 400);
            }

            $Silian_status = $Silian_data['status'];
            $Silian_notes = $Silian_data['notes'] ?? ($Silian_data['admin_notes'] ?? null);
            $Silian_trackingNumber = $Silian_data['tracking_number'] ?? null;

            // 更新兑换状态
            $Silian_sql = "
                UPDATE point_exchanges
                SET status = :status,
                    notes = :notes,
                    tracking_number = :tracking_number,
                    updated_at = NOW()
                WHERE id = :exchange_id
            ";

            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute([
                'status' => $Silian_status,
                'notes' => $Silian_notes,
                'tracking_number' => $Silian_trackingNumber,
                'exchange_id' => $Silian_exchangeId
            ]);

            // 获取兑换信息用于通知
            $Silian_exchange = $this->getExchangeRecord($Silian_exchangeId);
            if ($Silian_exchange) {
                // 发送状态更新通知
                $this->sendStatusUpdateNotification($Silian_exchange, $Silian_status, $Silian_notes, $Silian_trackingNumber);
            }

            // 记录审计日志
            $this->auditLog->log(
                $Silian_user['id'],
                'exchange_status_updated',
                'point_exchanges',
                $Silian_exchangeId,
                ['status' => $Silian_status, 'notes' => $Silian_notes]
            );

            return $this->json($Silian_response, [
                'success' => true,
                'message' => 'Exchange status updated successfully'
            ]);

        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'ProductController::updateExchangeStatus error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => self::ERR_INTERNAL], 500);
        }
    }

    /**
     * 获取商品分类
     */
    public function getCategories(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_params = $Silian_request->getQueryParams();
            $Silian_search = trim((string)($Silian_params['search'] ?? ''));
            $Silian_limitParam = isset($Silian_params['limit']) ? (int)$Silian_params['limit'] : 50;
            $Silian_limit = max(5, min(100, $Silian_limitParam));

            $Silian_sql = "
                SELECT
                    pc.id,
                    pc.name,
                    pc.slug,
                    COALESCE(stats.product_count, 0) AS product_count
                FROM product_categories pc
                LEFT JOIN (
                    SELECT category_slug, COUNT(*) AS product_count
                    FROM products
                    WHERE deleted_at IS NULL
                    GROUP BY category_slug
                ) AS stats ON stats.category_slug = pc.slug
            ";

            $Silian_bindings = [];
            if ($Silian_search !== '') {
                $Silian_sql .= ' WHERE pc.name LIKE :search_name OR pc.slug LIKE :search_slug';
                $Silian_searchPattern = '%' . $Silian_search . '%';
                $Silian_bindings['search_name'] = $Silian_searchPattern;
                $Silian_bindings['search_slug'] = $Silian_searchPattern;
            }

            $Silian_sql .= ' ORDER BY pc.name ASC LIMIT :limit';

            $Silian_stmt = $this->db->prepare($Silian_sql);
            foreach ($Silian_bindings as $Silian_key => $Silian_value) {
                $Silian_stmt->bindValue($Silian_key, $Silian_value);
            }
            $Silian_stmt->bindValue('limit', $Silian_limit, PDO::PARAM_INT);
            $Silian_stmt->execute();
            $Silian_categoryRows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $Silian_map = [];
            foreach ($Silian_categoryRows as $Silian_row) {
                $Silian_name = $Silian_row['name'] ?? '';
                $Silian_slug = $Silian_row['slug'] ?? '';
                $Silian_key = strtolower($Silian_slug !== '' ? $Silian_slug : $Silian_name);
                $Silian_map[$Silian_key] = [
                    'id' => isset($Silian_row['id']) ? (int)$Silian_row['id'] : null,
                    'name' => $Silian_name !== '' ? $Silian_name : ($Silian_slug ?: ''),
                    'slug' => $Silian_slug,
                    'product_count' => (int)($Silian_row['product_count'] ?? 0),
                ];
            }

            $Silian_fallbackLimit = $Silian_limit * 2;
            $Silian_fallbackSql = "
                SELECT
                    COALESCE(NULLIF(category_slug, ''), NULL) AS slug,
                    category AS name,
                    COUNT(*) AS product_count
                FROM products
                WHERE deleted_at IS NULL
                  AND category IS NOT NULL
                  AND category <> ''
                GROUP BY category, category_slug
                ORDER BY category ASC
                LIMIT :fallback_limit
            ";

            $Silian_fallbackStmt = $this->db->prepare($Silian_fallbackSql);
            $Silian_fallbackStmt->bindValue('fallback_limit', $Silian_fallbackLimit, PDO::PARAM_INT);
            $Silian_fallbackStmt->execute();
            $Silian_fallbackRows = $Silian_fallbackStmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            $Silian_searchLower = strtolower($Silian_search);
            foreach ($Silian_fallbackRows as $Silian_row) {
                $Silian_name = isset($Silian_row['name']) ? trim((string)$Silian_row['name']) : '';
                $Silian_slug = isset($Silian_row['slug']) ? (string)$Silian_row['slug'] : '';
                $Silian_slug = $Silian_slug !== '' ? $this->normalizeSlug($Silian_slug) : '';
                if ($Silian_slug === '' && $Silian_name !== '') {
                    $Silian_slug = $this->slugifyCategoryName($Silian_name);
                }
                if ($Silian_name === '' && $Silian_slug === '') {
                    continue;
                }
                $Silian_key = strtolower($Silian_slug !== '' ? $Silian_slug : $Silian_name);

                if ($Silian_searchLower !== '') {
                    $Silian_matchesSearch = (strpos(strtolower($Silian_name), $Silian_searchLower) !== false)
                        || ($Silian_slug !== '' && strpos($Silian_slug, $Silian_searchLower) !== false);
                    if (!$Silian_matchesSearch) {
                        continue;
                    }
                }

                $Silian_count = (int)($Silian_row['product_count'] ?? 0);

                if (isset($Silian_map[$Silian_key])) {
                    $Silian_map[$Silian_key]['product_count'] += $Silian_count;
                    if ($Silian_map[$Silian_key]['name'] === '' && $Silian_name !== '') {
                        $Silian_map[$Silian_key]['name'] = $Silian_name;
                    }
                    if ($Silian_map[$Silian_key]['slug'] === '' && $Silian_slug !== '') {
                        $Silian_map[$Silian_key]['slug'] = $Silian_slug;
                    }
                    continue;
                }

                $Silian_map[$Silian_key] = [
                    'id' => null,
                    'name' => $Silian_name !== '' ? $Silian_name : $Silian_slug,
                    'slug' => $Silian_slug,
                    'product_count' => $Silian_count,
                ];
            }

            $Silian_categories = array_values($Silian_map);
            usort($Silian_categories, static function ($Silian_a, $Silian_b) {
                return strcmp($Silian_a['name'], $Silian_b['name']);
            });
            if (count($Silian_categories) > $Silian_limit) {
                $Silian_categories = array_slice($Silian_categories, 0, $Silian_limit);
            }

            return $this->json($Silian_response, [
                'success' => true,
                'data' => [
                    'categories' => $Silian_categories,
                ],
            ]);

        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'ProductController::getCategories error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => self::ERR_INTERNAL], 500);
        }
    }


    /**
     * 管理员创建商品
     */
    public function createProduct(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->json($Silian_response, ['error' => self::ERR_ADMIN_REQUIRED], 403);
            }

            $Silian_data = $Silian_request->getParsedBody() ?: [];

            // 输入校验
            if (empty($Silian_data['name']) || !isset($Silian_data['points_required']) || !isset($Silian_data['stock'])) {
                return $this->json($Silian_response, ['error' => 'Missing required fields: name, points_required, stock'], 400);
            }
            $Silian_tagPayload = $Silian_data['tags'] ?? [];
            $Silian_rawCategory = $Silian_data['category'] ?? null;
            $Silian_categoryRecord = $this->resolveCategoryFromPayload($Silian_rawCategory);
            $Silian_imagePath = $this->extractPrimaryImagePath($Silian_data);
            $Silian_imagesPayload = isset($Silian_data['images']) ? (is_string($Silian_data['images']) ? $Silian_data['images'] : json_encode($Silian_data['images'])) : null;
            $Silian_statusInput = $Silian_data['status'] ?? 'active';
            $Silian_status = in_array($Silian_statusInput, ['active', 'inactive'], true) ? $Silian_statusInput : 'active';

            $Silian_categoryName = $Silian_categoryRecord['name'] ?? (is_string($Silian_rawCategory) ? trim($Silian_rawCategory) : null);
            if ($Silian_categoryName === '') {
                $Silian_categoryName = null;
            }
            $Silian_categorySlug = $Silian_categoryRecord['slug'] ?? null;
            if (!$Silian_categorySlug && $Silian_categoryName) {
                $Silian_categorySlug = $this->slugifyCategoryName($Silian_categoryName);
            }

            $this->db->beginTransaction();
            try {
                $Silian_sql = "
                    INSERT INTO products (
                        name, category, category_slug, points_required, description, image_path, images,
                        stock, status, sort_order, created_at
                    ) VALUES (
                        :name, :category, :category_slug, :points_required, :description, :image_path, :images,
                        :stock, :status, :sort_order, NOW()
                    )
                ";

                $Silian_stmt = $this->db->prepare($Silian_sql);
                $Silian_stmt->execute([
                    'name' => $Silian_data['name'],
                    'category' => $Silian_categoryName,
                    'category_slug' => $Silian_categorySlug,
                    'points_required' => (int)$Silian_data['points_required'],
                    'description' => $Silian_data['description'] ?? '',
                    'image_path' => $Silian_imagePath,
                    'images' => $Silian_imagesPayload,
                    'stock' => (int)$Silian_data['stock'],
                    'status' => $Silian_status,
                    'sort_order' => (int)($Silian_data['sort_order'] ?? 0),
                ]);

                $Silian_newId = (int)$this->db->lastInsertId();

                $Silian_normalizedTags = $this->resolveTagsFromPayload($Silian_tagPayload);
                $this->syncProductTags($Silian_newId, $Silian_normalizedTags);

                $this->db->commit();

                // 写入审计日志
                $this->auditLog->log($Silian_user['id'], 'product_created', 'products', (string)$Silian_newId, [
                    'name' => $Silian_data['name'],
                    'category' => $Silian_categoryName,
                    'category_slug' => $Silian_categorySlug,
                    'tags' => array_map(static fn($Silian_tag) => $Silian_tag['name'], $Silian_normalizedTags),
                ]);

                return $this->json($Silian_response, ['success' => true, 'id' => $Silian_newId, 'message' => 'Product created successfully'], 201);
            } catch (\Throwable $Silian_txError) {
                try { $this->db->rollBack(); } catch (\Throwable $Silian_ignore) {}
                throw $Silian_txError;
            }
        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'ProductController::createProduct error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => self::ERR_INTERNAL], 500);
        }
    }


    /**
     * 管理员更新商品
     */
    public function updateProduct(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->json($Silian_response, ['error' => self::ERR_ADMIN_REQUIRED], 403);
            }

            $Silian_id = (int)($Silian_args['id'] ?? 0);
            if ($Silian_id <= 0) {
                return $this->json($Silian_response, ['error' => 'Invalid product id'], 400);
            }

            $Silian_data = $Silian_request->getParsedBody() ?: [];

            $Silian_fields = [];
            $Silian_params = ['id' => $Silian_id];

            $Silian_assign = function(string $Silian_column, $Silian_value) use (&$Silian_fields, &$Silian_params) {
                $Silian_fields[] = "$Silian_column = :$Silian_column";
                $Silian_params[$Silian_column] = $Silian_value;
            };

            foreach (['name','description'] as $Silian_col) {
                if (array_key_exists($Silian_col, $Silian_data)) { $Silian_assign($Silian_col, $Silian_data[$Silian_col]); }
            }

            $Silian_categoryName = null;
            $Silian_categorySlug = null;
            $Silian_hasCategoryPayload = array_key_exists('category', $Silian_data);
            if ($Silian_hasCategoryPayload) {
                $Silian_categoryRecord = $this->resolveCategoryFromPayload($Silian_data['category']);
                $Silian_categoryName = $Silian_categoryRecord['name'] ?? (is_string($Silian_data['category']) ? trim((string)$Silian_data['category']) : null);
                if ($Silian_categoryName === '') {
                    $Silian_categoryName = null;
                }
                $Silian_categorySlug = $Silian_categoryRecord['slug'] ?? null;
                if (!$Silian_categorySlug && $Silian_categoryName) {
                    $Silian_categorySlug = $this->slugifyCategoryName($Silian_categoryName);
                }
                $Silian_assign('category', $Silian_categoryName);
                $Silian_assign('category_slug', $Silian_categorySlug);
            }

            if (array_key_exists('points_required', $Silian_data)) { $Silian_assign('points_required', (int)$Silian_data['points_required']); }
            if (array_key_exists('stock', $Silian_data)) { $Silian_assign('stock', (int)$Silian_data['stock']); }
            if (array_key_exists('status', $Silian_data)) {
                $Silian_status = in_array($Silian_data['status'], ['active','inactive'], true) ? $Silian_data['status'] : 'inactive';
                $Silian_assign('status', $Silian_status);
            }
            if (array_key_exists('sort_order', $Silian_data)) { $Silian_assign('sort_order', (int)$Silian_data['sort_order']); }
            $Silian_imagePath = null;
            $Silian_hasImagePayload = array_key_exists('image_path', $Silian_data) || array_key_exists('image_url', $Silian_data) || array_key_exists('image', $Silian_data);
            if ($Silian_hasImagePayload) {
                $Silian_imagePath = $this->extractPrimaryImagePath($Silian_data);
                $Silian_assign('image_path', $Silian_imagePath);
            }
            if (array_key_exists('images', $Silian_data)) {
                $Silian_images = is_string($Silian_data['images']) ? $Silian_data['images'] : json_encode($Silian_data['images']);
                $Silian_assign('images', $Silian_images);
            }

            $Silian_shouldUpdateTags = array_key_exists('tags', $Silian_data);
            if (empty($Silian_fields) && !$Silian_shouldUpdateTags) {
                return $this->json($Silian_response, ['error' => 'No fields to update'], 400);
            }

            $Silian_normalizedTags = $Silian_shouldUpdateTags ? $this->resolveTagsFromPayload($Silian_data['tags']) : [];

            $this->db->beginTransaction();
            try {
                if (!empty($Silian_fields)) {
                    $Silian_sql = 'UPDATE products SET ' . implode(', ', $Silian_fields) . ', updated_at = NOW() WHERE id = :id AND deleted_at IS NULL';
                    $Silian_stmt = $this->db->prepare($Silian_sql);
                    $Silian_stmt->execute($Silian_params);
                }

                if ($Silian_shouldUpdateTags) {
                    $this->syncProductTags($Silian_id, $Silian_normalizedTags);
                }

                $this->db->commit();

                $this->auditLog->log($Silian_user['id'], 'product_updated', 'products', (string)$Silian_id, [
                    'updated_fields' => array_keys($Silian_data),
                    'category' => $Silian_hasCategoryPayload ? $Silian_categoryName : null,
                    'category_slug' => $Silian_hasCategoryPayload ? $Silian_categorySlug : null,
                    'tags' => $Silian_shouldUpdateTags ? array_map(static fn($Silian_tag) => $Silian_tag['name'], $Silian_normalizedTags) : null,
                ]);

                return $this->json($Silian_response, ['success' => true, 'message' => 'Product updated successfully']);
            } catch (\Throwable $Silian_txError) {
                try { $this->db->rollBack(); } catch (\Throwable $Silian_ignore) {}
                throw $Silian_txError;
            }
        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'ProductController::updateProduct error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => self::ERR_INTERNAL], 500);
        }
    }


    /**
     * 获取商品标签（用于自动补全）
     */
    public function searchProductTags(Request $Silian_request, Response $Silian_response): Response
    {
        try {
            $Silian_params = $Silian_request->getQueryParams();
            $Silian_search = trim((string)($Silian_params['search'] ?? ''));
            $Silian_limit = min(50, max(5, (int)($Silian_params['limit'] ?? 20)));

            $Silian_sql = 'SELECT id, name, slug FROM product_tags';
            $Silian_bindings = [];
            if ($Silian_search !== '') {
                $Silian_sql .= ' WHERE name LIKE :search_name OR slug LIKE :search_slug';
                $Silian_searchPattern = '%' . $Silian_search . '%';
                $Silian_bindings['search_name'] = $Silian_searchPattern;
                $Silian_bindings['search_slug'] = $Silian_searchPattern;
            }
            $Silian_sql .= ' ORDER BY name ASC LIMIT :limit';

            $Silian_stmt = $this->db->prepare($Silian_sql);
            foreach ($Silian_bindings as $Silian_key => $Silian_value) {
                $Silian_stmt->bindValue($Silian_key, $Silian_value);
            }
            $Silian_stmt->bindValue('limit', $Silian_limit, PDO::PARAM_INT);
            $Silian_stmt->execute();
            $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];

            return $this->json($Silian_response, [
                'success' => true,
                'data' => [
                    'tags' => array_map(static function ($Silian_row) {
                        return [
                            'id' => isset($Silian_row['id']) ? (int)$Silian_row['id'] : null,
                            'name' => $Silian_row['name'] ?? '',
                            'slug' => $Silian_row['slug'] ?? '',
                        ];
                    }, $Silian_rows)
                ]
                ]
            );
        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'ProductController::searchProductTags error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => self::ERR_INTERNAL], 500);
        }
    }

    private function prepareProductPayload(array $Silian_product, bool $Silian_withProtectedUrls = false, ?Request $Silian_request = null): array
    {
        $Silian_product['images'] = $this->normalizeProductImagesList($Silian_product['images'] ?? null, $Silian_withProtectedUrls, $Silian_request);

        $Silian_imagePathRaw = $Silian_product['image_path'] ?? null;
        $Silian_normalizedImagePath = null;
        if (is_string($Silian_imagePathRaw) && $Silian_imagePathRaw !== '') {
            $Silian_normalizedImagePath = ltrim(trim($Silian_imagePathRaw), '/');
            $Silian_product['image_path'] = $Silian_normalizedImagePath;
        }

        $Silian_imageUrl = $Silian_product['image_url'] ?? null;
        if ((!is_string($Silian_imageUrl) || $Silian_imageUrl === '') && $Silian_normalizedImagePath) {
            $Silian_publicUrl = $this->buildPublicUrl($Silian_normalizedImagePath, $Silian_request);
            if ($Silian_publicUrl) {
                $Silian_imageUrl = $Silian_publicUrl;
            }
        }

        $Silian_existingPresigned = $Silian_product['image_presigned_url'] ?? null;
        $Silian_presignedUrl = $Silian_existingPresigned && is_string($Silian_existingPresigned) ? $Silian_existingPresigned : null;
        if ($Silian_withProtectedUrls && $Silian_normalizedImagePath) {
            $Silian_freshPresigned = $this->buildPresignedUrl($Silian_normalizedImagePath, 600, $Silian_request);
            if ($Silian_freshPresigned) {
                $Silian_presignedUrl = $Silian_freshPresigned;
            }
        }

        if (!is_string($Silian_imageUrl) || $Silian_imageUrl === '') {
            if (!empty($Silian_product['images'])) {
                $Silian_firstImage = $Silian_product['images'][0];
                if (is_array($Silian_firstImage)) {
                    if (!empty($Silian_firstImage['url'])) {
                        $Silian_imageUrl = $Silian_firstImage['url'];
                    } elseif (!empty($Silian_firstImage['file_path'])) {
                        $Silian_fallbackUrl = $this->buildPublicUrl($Silian_firstImage['file_path'], $Silian_request);
                        if ($Silian_fallbackUrl) {
                            $Silian_imageUrl = $Silian_fallbackUrl;
                        }
                    }
                    if ($Silian_withProtectedUrls && !$Silian_presignedUrl && !empty($Silian_firstImage['file_path'])) {
                        $Silian_presignedUrl = $this->buildPresignedUrl($Silian_firstImage['file_path'], 600, $Silian_request);
                    }
                } elseif (is_string($Silian_firstImage) && $Silian_firstImage !== '') {
                    $Silian_imageUrl = $Silian_firstImage;
                }
            }
        } else {
            if ($Silian_withProtectedUrls && !$Silian_presignedUrl && $Silian_normalizedImagePath) {
                $Silian_presignedUrl = $this->buildPresignedUrl($Silian_normalizedImagePath, 600, $Silian_request);
            }
        }

        if ($Silian_withProtectedUrls && !$Silian_presignedUrl && !empty($Silian_product['images'])) {
            foreach ($Silian_product['images'] as $Silian_imageMeta) {
                if (!empty($Silian_imageMeta['presigned_url'])) {
                    $Silian_presignedUrl = $Silian_imageMeta['presigned_url'];
                    break;
                }
            }
        }

        if (!is_string($Silian_imageUrl) || $Silian_imageUrl === '') {
            if ($Silian_normalizedImagePath) {
                $Silian_imageUrl = $Silian_normalizedImagePath;
            }
        }

        if (is_string($Silian_imageUrl) && $Silian_imageUrl !== '') {
            $Silian_product['image_url'] = $Silian_imageUrl;
        }

        if ($Silian_withProtectedUrls) {
            $Silian_product['image_presigned_url'] = $Silian_presignedUrl ?: '';
        } else {
            unset($Silian_product['image_presigned_url']);
        }

        if (isset($Silian_product['stock'])) {
            $Silian_product['stock'] = (int)$Silian_product['stock'];
        }
        if (isset($Silian_product['points_required'])) {
            $Silian_product['points_required'] = (int)$Silian_product['points_required'];
        }

        $Silian_stockValue = $Silian_product['stock'] ?? null;
        $Silian_product['is_available'] = $Silian_stockValue === -1 || ($Silian_stockValue > 0);

        if (!isset($Silian_product['price']) && isset($Silian_product['points_required'])) {
            $Silian_product['price'] = (int)$Silian_product['points_required'];
        }

        return $Silian_product;
    }

    private function normalizeProductImagesList($Silian_rawImages, bool $Silian_withProtectedUrls = false, ?Request $Silian_request = null): array
    {
        if (empty($Silian_rawImages)) {
            return [];
        }

        if (is_string($Silian_rawImages)) {
            $Silian_decoded = json_decode($Silian_rawImages, true);
            if (json_last_error() === JSON_ERROR_NONE) {
                $Silian_rawImages = $Silian_decoded;
            } else {
                $Silian_rawImages = [$Silian_rawImages];
            }
        }

        if (!is_array($Silian_rawImages)) {
            return [];
        }

        $Silian_normalized = [];
        foreach ($Silian_rawImages as $Silian_item) {
            $Silian_image = $this->normalizeProductImageItem($Silian_item, $Silian_withProtectedUrls, $Silian_request);
            if ($Silian_image !== null) {
                $Silian_normalized[] = $Silian_image;
            }
        }

        return $Silian_normalized;
    }

    private function normalizeProductImageItem($Silian_item, bool $Silian_withProtectedUrls = false, ?Request $Silian_request = null): ?array
    {
        if (is_string($Silian_item)) {
            $Silian_item = ['file_path' => $Silian_item];
        } elseif (!is_array($Silian_item)) {
            return null;
        }

        $Silian_filePath = $Silian_item['file_path'] ?? ($Silian_item['path'] ?? null);
        if (is_string($Silian_filePath) && $Silian_filePath !== '') {
            $Silian_filePath = ltrim(trim($Silian_filePath), '/');
        } else {
            $Silian_filePath = null;
        }

        $Silian_url = $Silian_item['url'] ?? ($Silian_item['public_url'] ?? null);
        if ((!is_string($Silian_url) || $Silian_url === '') && $Silian_filePath) {
            $Silian_url = $this->buildPublicUrl($Silian_filePath, $Silian_request) ?? $Silian_url;
        }

        $Silian_existingPresigned = $Silian_item['presigned_url'] ?? null;
        $Silian_presignedUrl = null;
        if ($Silian_withProtectedUrls && $Silian_filePath) {
            $Silian_freshPresigned = $this->buildPresignedUrl($Silian_filePath, 600, $Silian_request);
            if ($Silian_freshPresigned) {
                $Silian_presignedUrl = $Silian_freshPresigned;
            } elseif (is_string($Silian_existingPresigned) && $Silian_existingPresigned !== '') {
                $Silian_presignedUrl = $Silian_existingPresigned;
            }
        } elseif ($Silian_withProtectedUrls && is_string($Silian_existingPresigned) && $Silian_existingPresigned !== '') {
            $Silian_presignedUrl = $Silian_existingPresigned;
        }

        $Silian_normalized = [
            'file_path' => $Silian_filePath,
            'url' => $Silian_url,
        ];

        if ($Silian_withProtectedUrls) {
            $Silian_normalized['presigned_url'] = $Silian_presignedUrl ?: null;
        }
        if (isset($Silian_item['thumbnail_path'])) {
            $Silian_normalized['thumbnail_path'] = $Silian_item['thumbnail_path'];
        }
        if (isset($Silian_item['original_name'])) {
            $Silian_normalized['original_name'] = $Silian_item['original_name'];
        }
        if (isset($Silian_item['mime_type'])) {
            $Silian_normalized['mime_type'] = $Silian_item['mime_type'];
        }
        $Silian_size = $Silian_item['size'] ?? ($Silian_item['file_size'] ?? null);
        if ($Silian_size !== null) {
            $Silian_normalized['size'] = $Silian_size;
        }
        if (isset($Silian_item['duplicate'])) {
            $Silian_normalized['duplicate'] = $Silian_item['duplicate'];
        }

        return $Silian_normalized;
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
        $Silian_fallbackMessage = $Silian_contextMessage !== '' ? $Silian_contextMessage : $Silian_exception->getMessage();
        error_log($Silian_fallbackMessage);
    }

    private function buildPresignedUrl(?string $Silian_filePath, int $Silian_ttlSeconds = 600, ?Request $Silian_request = null): ?string
    {
        if (!$Silian_filePath || !$this->r2Service) {
            return null;
        }
        try {
            return $this->r2Service->generatePresignedUrl($Silian_filePath, $Silian_ttlSeconds);
        } catch (\Throwable $Silian_ignore) {
            return null;
        }
    }

    private function buildPublicUrl(?string $Silian_filePath, ?Request $Silian_request = null): ?string
    {
        if (!$Silian_filePath || !$this->r2Service) {
            return null;
        }
        try {
            return $this->r2Service->getPublicUrl($Silian_filePath);
        } catch (\Throwable $Silian_ignore) {
            return null;
        }
    }

    private function extractPrimaryImagePath(array $Silian_payload): ?string
    {
        $Silian_candidates = [];
        if (array_key_exists('image_path', $Silian_payload)) {
            $Silian_candidates[] = $Silian_payload['image_path'];
        }
        if (array_key_exists('image_url', $Silian_payload)) {
            $Silian_candidates[] = $Silian_payload['image_url'];
        }
        if (array_key_exists('image', $Silian_payload)) {
            $Silian_candidates[] = $Silian_payload['image'];
        }
        if (array_key_exists('main_image', $Silian_payload)) {
            $Silian_candidates[] = $Silian_payload['main_image'];
        }

        foreach ($Silian_candidates as $Silian_candidate) {
            if (is_array($Silian_candidate)) {
                $Silian_filePath = $Silian_candidate['file_path'] ?? ($Silian_candidate['path'] ?? ($Silian_candidate['value'] ?? null));
                if (is_string($Silian_filePath) && trim($Silian_filePath) !== '') {
                    return trim($Silian_filePath);
                }
            } elseif (is_string($Silian_candidate)) {
                $Silian_candidate = trim($Silian_candidate);
                if ($Silian_candidate !== '') {
                    return $Silian_candidate;
                }
            }
        }

        return null;
    }

    private function resolveCategoryFromPayload($Silian_rawCategory): ?array
    {
        if ($Silian_rawCategory === null || $Silian_rawCategory === '') {
            return null;
        }

        $Silian_candidate = $this->normalizeCategoryCandidate($Silian_rawCategory);
        if (!$Silian_candidate) {
            return null;
        }

        if ($Silian_candidate['id'] !== null) {
            $Silian_byId = $this->fetchCategoriesByIds([$Silian_candidate['id']]);
            if (isset($Silian_byId[$Silian_candidate['id']])) {
                return $Silian_byId[$Silian_candidate['id']];
            }
        }

        if ($Silian_candidate['slug'] !== '') {
            $Silian_bySlug = $this->fetchCategoriesBySlugs([$Silian_candidate['slug']]);
            if (isset($Silian_bySlug[$Silian_candidate['slug']])) {
                return $Silian_bySlug[$Silian_candidate['slug']];
            }
        }

        $Silian_name = $Silian_candidate['name'] !== '' ? $Silian_candidate['name'] : null;
        if ($Silian_name === null && $Silian_candidate['slug'] !== '') {
            $Silian_name = $Silian_candidate['slug'];
        }
        if ($Silian_name === null) {
            return null;
        }

        $Silian_slug = $Silian_candidate['slug'] !== '' ? $Silian_candidate['slug'] : $this->slugifyCategoryName($Silian_name);

        return $this->createProductCategory($Silian_name, $Silian_slug);
    }

    private function normalizeCategoryCandidate($Silian_category): ?array
    {
        if (is_string($Silian_category)) {
            $Silian_name = trim($Silian_category);
            if ($Silian_name === '') {
                return null;
            }
            return [
                'id' => null,
                'name' => $Silian_name,
                'slug' => $this->slugifyCategoryName($Silian_name),
            ];
        }

        if (!is_array($Silian_category)) {
            return null;
        }

        $Silian_id = null;
        foreach (['id', 'category_id'] as $Silian_idKey) {
            if (isset($Silian_category[$Silian_idKey]) && $Silian_category[$Silian_idKey] !== '') {
                $Silian_id = (int)$Silian_category[$Silian_idKey];
                break;
            }
        }

        $Silian_name = '';
        foreach (['name', 'category', 'label', 'value'] as $Silian_nameKey) {
            if (isset($Silian_category[$Silian_nameKey]) && is_string($Silian_category[$Silian_nameKey])) {
                $Silian_candidate = trim($Silian_category[$Silian_nameKey]);
                if ($Silian_candidate !== '') {
                    $Silian_name = $Silian_candidate;
                    break;
                }
            }
        }

        $Silian_slug = '';
        foreach (['slug', 'category_slug', 'value'] as $Silian_slugKey) {
            if (isset($Silian_category[$Silian_slugKey]) && is_string($Silian_category[$Silian_slugKey])) {
                $Silian_candidate = $this->normalizeSlug($Silian_category[$Silian_slugKey]);
                if ($Silian_candidate !== '') {
                    $Silian_slug = $Silian_candidate;
                    break;
                }
            }
        }

        if ($Silian_slug === '' && $Silian_name !== '') {
            $Silian_slug = $this->slugifyCategoryName($Silian_name);
        }

        if ($Silian_id === null && $Silian_slug === '' && $Silian_name === '') {
            return null;
        }

        return [
            'id' => $Silian_id,
            'name' => $Silian_name,
            'slug' => $Silian_slug,
        ];
    }

    private function fetchCategoriesByIds(array $Silian_ids): array
    {
        $Silian_ids = array_values(array_unique(array_filter(array_map('intval', $Silian_ids), static fn($Silian_id) => $Silian_id > 0)));
        if (empty($Silian_ids)) {
            return [];
        }

        $Silian_placeholders = implode(',', array_fill(0, count($Silian_ids), '?'));
        $Silian_sql = 'SELECT id, name, slug FROM product_categories WHERE id IN (' . $Silian_placeholders . ')';
        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute($Silian_ids);

        $Silian_result = [];
        while ($Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC)) {
            if (!isset($Silian_row['id'])) {
                continue;
            }
            $Silian_identifier = (int)$Silian_row['id'];
            $Silian_result[$Silian_identifier] = [
                'id' => $Silian_identifier,
                'name' => $Silian_row['name'] ?? '',
                'slug' => $Silian_row['slug'] ?? '',
            ];
        }

        return $Silian_result;
    }

    private function createProductCategory(string $Silian_name, string $Silian_slug): array
    {
        $Silian_name = trim($Silian_name) !== '' ? trim($Silian_name) : $Silian_slug;
        $Silian_normalizedSlug = $this->slugifyCategoryName($Silian_slug ?: $Silian_name);
        $Silian_baseSlug = $Silian_normalizedSlug;
        $Silian_attempts = 0;

        while ($Silian_attempts < 5) {
            try {
                $Silian_stmt = $this->db->prepare('INSERT INTO product_categories (name, slug, created_at) VALUES (:name, :slug, NOW())');
                $Silian_stmt->execute([
                    'name' => $Silian_name,
                    'slug' => $Silian_normalizedSlug,
                ]);
                $Silian_id = (int)$this->db->lastInsertId();

                return [
                    'id' => $Silian_id,
                    'name' => $Silian_name,
                    'slug' => $Silian_normalizedSlug,
                ];
            } catch (PDOException $Silian_e) {
                if ($Silian_e->getCode() !== '23000') {
                    throw $Silian_e;
                }

                $Silian_existing = $this->fetchCategoriesBySlugs([$Silian_normalizedSlug]);
                if (isset($Silian_existing[$Silian_normalizedSlug])) {
                    return $Silian_existing[$Silian_normalizedSlug];
                }

                ++$Silian_attempts;
                $Silian_normalizedSlug = $Silian_baseSlug . '-' . $Silian_attempts;
            }
        }

        $Silian_normalizedSlug = $Silian_baseSlug . '-' . substr(md5((string)microtime(true)), 0, 6);
        $Silian_stmt = $this->db->prepare('INSERT INTO product_categories (name, slug, created_at) VALUES (:name, :slug, NOW())');
        $Silian_stmt->execute([
            'name' => $Silian_name,
            'slug' => $Silian_normalizedSlug,
        ]);
        $Silian_id = (int)$this->db->lastInsertId();

        return [
            'id' => $Silian_id,
            'name' => $Silian_name,
            'slug' => $Silian_normalizedSlug,
        ];
    }

    private function resolveTagsFromPayload($Silian_rawTags): array
    {
        if (!is_array($Silian_rawTags)) {
            return [];
        }

        $Silian_normalized = [];
        foreach ($Silian_rawTags as $Silian_tag) {
            $Silian_candidate = $this->normalizeTagCandidate($Silian_tag);
            if (!$Silian_candidate) {
                continue;
            }
            $Silian_key = $Silian_candidate['id'] !== null
                ? 'id-' . $Silian_candidate['id']
                : 'slug-' . $Silian_candidate['slug'];
            $Silian_normalized[$Silian_key] = $Silian_candidate;
        }

        if (empty($Silian_normalized)) {
            return [];
        }

        $Silian_byId = [];
        $Silian_bySlug = [];
        $Silian_idList = [];
        $Silian_slugList = [];
        foreach ($Silian_normalized as $Silian_candidate) {
            if ($Silian_candidate['id'] !== null) {
                $Silian_idList[$Silian_candidate['id']] = true;
            }
            $Silian_slugList[$Silian_candidate['slug']] = true;
        }

        if (!empty($Silian_idList)) {
            $Silian_byId = $this->fetchTagsByIds(array_keys($Silian_idList));
        }
        if (!empty($Silian_slugList)) {
            $Silian_bySlug = $this->fetchTagsBySlugs(array_keys($Silian_slugList));
        }

        $Silian_resolved = [];
        foreach (array_values($Silian_normalized) as $Silian_candidate) {
            if ($Silian_candidate['id'] !== null && isset($Silian_byId[$Silian_candidate['id']])) {
                $Silian_record = $Silian_byId[$Silian_candidate['id']];
                $Silian_resolved[$Silian_record['id']] = $Silian_record;
                continue;
            }

            if (isset($Silian_bySlug[$Silian_candidate['slug']])) {
                $Silian_record = $Silian_bySlug[$Silian_candidate['slug']];
                $Silian_resolved[$Silian_record['id']] = $Silian_record;
                continue;
            }

            $Silian_record = $this->createProductTag($Silian_candidate['name'], $Silian_candidate['slug']);
            $Silian_resolved[$Silian_record['id']] = $Silian_record;
            $Silian_bySlug[$Silian_record['slug']] = $Silian_record;
        }

        return array_values($Silian_resolved);
    }

    private function normalizeTagCandidate($Silian_tag): ?array
    {
        if (is_string($Silian_tag)) {
            $Silian_name = trim($Silian_tag);
            if ($Silian_name === '') {
                return null;
            }
            return [
                'id' => null,
                'name' => $Silian_name,
                'slug' => $this->slugifyTagName($Silian_name),
            ];
        }

        if (!is_array($Silian_tag)) {
            return null;
        }

        $Silian_id = null;
        if (isset($Silian_tag['id']) && $Silian_tag['id'] !== '') {
            $Silian_id = (int)$Silian_tag['id'];
        }

        $Silian_name = '';
        if (isset($Silian_tag['name']) && is_string($Silian_tag['name'])) {
            $Silian_name = trim($Silian_tag['name']);
        } elseif (isset($Silian_tag['label']) && is_string($Silian_tag['label'])) {
            $Silian_name = trim($Silian_tag['label']);
        } elseif (isset($Silian_tag['value']) && is_string($Silian_tag['value'])) {
            $Silian_name = trim($Silian_tag['value']);
        }

        $Silian_slug = null;
        if (isset($Silian_tag['slug']) && is_string($Silian_tag['slug'])) {
            $Silian_slug = $this->normalizeSlug($Silian_tag['slug']);
        }

        if ($Silian_id !== null && $Silian_slug === null) {
            $Silian_slug = $Silian_name !== '' ? $this->slugifyTagName($Silian_name) : 'tag-' . $Silian_id;
        }

        if ($Silian_slug === null && $Silian_name !== '') {
            $Silian_slug = $this->slugifyTagName($Silian_name);
        }

        if ($Silian_id === null && $Silian_name === '') {
            return null;
        }

        if ($Silian_slug === null) {
            $Silian_slug = $this->slugifyTagName($Silian_name ?: ('tag-' . md5(json_encode($Silian_tag))));
        }

        return [
            'id' => $Silian_id,
            'name' => $Silian_name,
            'slug' => $Silian_slug,
        ];
    }

    private function syncProductTags(int $Silian_productId, array $Silian_tags): void
    {
        $Silian_desiredIds = array_map(static fn($Silian_tag) => (int)$Silian_tag['id'], $Silian_tags);
        $Silian_desiredIds = array_values(array_unique(array_filter($Silian_desiredIds, static fn($Silian_id) => $Silian_id > 0)));

        $Silian_stmt = $this->db->prepare('SELECT tag_id FROM product_tag_map WHERE product_id = :product_id');
        $Silian_stmt->execute(['product_id' => $Silian_productId]);
        $Silian_existingIds = array_map('intval', $Silian_stmt->fetchAll(PDO::FETCH_COLUMN) ?: []);

        $Silian_toDelete = array_diff($Silian_existingIds, $Silian_desiredIds);
        $Silian_toInsert = array_diff($Silian_desiredIds, $Silian_existingIds);

        if (!empty($Silian_toDelete)) {
            $Silian_placeholders = implode(',', array_fill(0, count($Silian_toDelete), '?'));
            $Silian_sql = 'DELETE FROM product_tag_map WHERE product_id = ? AND tag_id IN (' . $Silian_placeholders . ')';
            $Silian_delStmt = $this->db->prepare($Silian_sql);
            $Silian_delStmt->execute(array_merge([$Silian_productId], array_values($Silian_toDelete)));
        }

        if (!empty($Silian_toInsert)) {
            $Silian_insertSql = 'INSERT INTO product_tag_map (product_id, tag_id, created_at) VALUES (:product_id, :tag_id, NOW())';
            $Silian_insStmt = $this->db->prepare($Silian_insertSql);
            foreach ($Silian_toInsert as $Silian_tagId) {
                $Silian_insStmt->execute([
                    'product_id' => $Silian_productId,
                    'tag_id' => $Silian_tagId,
                ]);
            }
        }
    }

    private function loadTagsForProducts(array $Silian_productIds): array
    {
        $Silian_productIds = array_values(array_unique(array_filter($Silian_productIds, static fn($Silian_id) => $Silian_id > 0)));
        if (empty($Silian_productIds)) {
            return [];
        }

        $Silian_placeholders = implode(',', array_fill(0, count($Silian_productIds), '?'));
        $Silian_sql = 'SELECT ptm.product_id, pt.id, pt.name, pt.slug
                FROM product_tag_map ptm
                INNER JOIN product_tags pt ON pt.id = ptm.tag_id
                WHERE ptm.product_id IN (' . $Silian_placeholders . ')
                ORDER BY pt.name ASC';

        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute($Silian_productIds);

        $Silian_rows = $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) ?: [];
        $Silian_map = [];
        foreach ($Silian_rows as $Silian_row) {
            $Silian_productId = isset($Silian_row['product_id']) ? (int)$Silian_row['product_id'] : null;
            if ($Silian_productId === null) {
                continue;
            }
            $Silian_map[$Silian_productId] ??= [];
            $Silian_map[$Silian_productId][] = [
                'id' => isset($Silian_row['id']) ? (int)$Silian_row['id'] : null,
                'name' => $Silian_row['name'] ?? '',
                'slug' => $Silian_row['slug'] ?? '',
            ];
        }

        return $Silian_map;
    }

    private function fetchTagsByIds(array $Silian_ids): array
    {
        $Silian_ids = array_values(array_unique(array_filter($Silian_ids, static fn($Silian_id) => $Silian_id > 0)));
        if (empty($Silian_ids)) {
            return [];
        }

        $Silian_placeholders = implode(',', array_fill(0, count($Silian_ids), '?'));
        $Silian_sql = 'SELECT id, name, slug FROM product_tags WHERE id IN (' . $Silian_placeholders . ')';
        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute($Silian_ids);

        $Silian_result = [];
        while ($Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC)) {
            $Silian_id = isset($Silian_row['id']) ? (int)$Silian_row['id'] : null;
            if ($Silian_id === null) {
                continue;
            }
            $Silian_result[$Silian_id] = [
                'id' => $Silian_id,
                'name' => $Silian_row['name'] ?? '',
                'slug' => $Silian_row['slug'] ?? '',
            ];
        }

        return $Silian_result;
    }

    private function fetchTagsBySlugs(array $Silian_slugs): array
    {
        $Silian_slugs = array_values(array_unique(array_filter($Silian_slugs, static fn($Silian_slug) => is_string($Silian_slug) && $Silian_slug !== '')));
        if (empty($Silian_slugs)) {
            return [];
        }

        $Silian_placeholders = implode(',', array_fill(0, count($Silian_slugs), '?'));
        $Silian_sql = 'SELECT id, name, slug FROM product_tags WHERE slug IN (' . $Silian_placeholders . ')';
        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute($Silian_slugs);

        $Silian_result = [];
        while ($Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC)) {
            if (!isset($Silian_row['slug'])) {
                continue;
            }
            $Silian_slug = $Silian_row['slug'];
            $Silian_result[$Silian_slug] = [
                'id' => isset($Silian_row['id']) ? (int)$Silian_row['id'] : null,
                'name' => $Silian_row['name'] ?? '',
                'slug' => $Silian_slug,
            ];
        }

        return $Silian_result;
    }

    private function fetchCategoriesBySlugs(array $Silian_slugs): array
    {
        $Silian_slugs = array_values(array_unique(array_filter($Silian_slugs, static fn($Silian_slug) => is_string($Silian_slug) && $Silian_slug !== '')));
        if (empty($Silian_slugs)) {
            return [];
        }

        $Silian_placeholders = implode(',', array_fill(0, count($Silian_slugs), '?'));
        $Silian_sql = 'SELECT id, name, slug FROM product_categories WHERE slug IN (' . $Silian_placeholders . ')';

        try {
            $Silian_stmt = $this->db->prepare($Silian_sql);
            if (!$Silian_stmt) {
                return [];
            }

            $Silian_stmt->execute($Silian_slugs);

            $Silian_result = [];
            while ($Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC)) {
                if (!isset($Silian_row['slug'])) {
                    continue;
                }
                $Silian_slug = $Silian_row['slug'];
                $Silian_result[$Silian_slug] = [
                    'id' => isset($Silian_row['id']) ? (int)$Silian_row['id'] : null,
                    'name' => $Silian_row['name'] ?? '',
                    'slug' => $Silian_slug,
                ];
            }

            return $Silian_result;
        } catch (\Throwable $Silian_e) {
            return [];
        }
    }

    private function slugifyCategoryName(string $Silian_name): string
    {
        $Silian_slug = $this->normalizeSlug($Silian_name);
        if ($Silian_slug === '') {
            $Silian_slug = 'category-' . substr(md5($Silian_name), 0, 8);
        }
        return $Silian_slug;
    }
    private function createProductTag(string $Silian_name, string $Silian_slug): array
    {
        $Silian_name = trim($Silian_name) !== '' ? trim($Silian_name) : $Silian_slug;
        $Silian_slug = $this->normalizeSlug($Silian_slug);
        $Silian_baseSlug = $Silian_slug;
        $Silian_attempts = 0;

        while ($Silian_attempts < 5) {
            try {
                $Silian_stmt = $this->db->prepare('INSERT INTO product_tags (name, slug, created_at, updated_at) VALUES (:name, :slug, NOW(), NOW())');
                $Silian_stmt->execute([
                    'name' => $Silian_name,
                    'slug' => $Silian_slug,
                ]);
                $Silian_id = (int)$this->db->lastInsertId();

                return [
                    'id' => $Silian_id,
                    'name' => $Silian_name,
                    'slug' => $Silian_slug,
                ];
            } catch (PDOException $Silian_e) {
                if ($Silian_e->getCode() !== '23000') {
                    throw $Silian_e;
                }

                $Silian_existing = $this->fetchTagsBySlugs([$Silian_slug]);
                if (isset($Silian_existing[$Silian_slug])) {
                    return $Silian_existing[$Silian_slug];
                }

                ++$Silian_attempts;
                $Silian_slug = $Silian_baseSlug . '-' . $Silian_attempts;
            }
        }

        $Silian_slug = $Silian_baseSlug . '-' . substr(md5((string)microtime(true)), 0, 6);
        $Silian_stmt = $this->db->prepare('INSERT INTO product_tags (name, slug, created_at, updated_at) VALUES (:name, :slug, NOW(), NOW())');
        $Silian_stmt->execute([
            'name' => $Silian_name,
            'slug' => $Silian_slug,
        ]);
        $Silian_id = (int)$this->db->lastInsertId();

        return [
            'id' => $Silian_id,
            'name' => $Silian_name,
            'slug' => $Silian_slug,
        ];
    }

    private function normalizeSlug(string $Silian_slug): string
    {
        $Silian_slug = trim($Silian_slug);
        if ($Silian_slug === '') {
            return '';
        }
        $Silian_slug = preg_replace('/[^\p{L}\p{N}\-]+/u', '-', $Silian_slug);
        $Silian_slug = strtolower(trim($Silian_slug, '-'));
        return $Silian_slug;
    }

    private function slugifyTagName(string $Silian_name): string
    {
        $Silian_trimmed = trim($Silian_name);
        $Silian_slug = function_exists('mb_strtolower') ? mb_strtolower($Silian_trimmed) : strtolower($Silian_trimmed);
        $Silian_slug = preg_replace('/[^\p{L}\p{N}\-]+/u', '-', $Silian_slug);
        $Silian_slug = trim($Silian_slug, '-');
        if ($Silian_slug === '') {
            $Silian_slug = 'tag-' . substr(md5($Silian_name), 0, 8);
        }
        return $Silian_slug;
    }

    /**
     * 管理员删除商品（软删除）
     */
    public function deleteProduct(Request $Silian_request, Response $Silian_response, array $Silian_args): Response
    {
        try {
            $Silian_user = $this->authService->getCurrentUser($Silian_request);
            if (!$Silian_user || !$this->authService->isAdminUser($Silian_user)) {
                return $this->json($Silian_response, ['error' => self::ERR_ADMIN_REQUIRED], 403);
            }

            $Silian_id = (int)($Silian_args['id'] ?? 0);
            if ($Silian_id <= 0) {
                return $this->json($Silian_response, ['error' => 'Invalid product id'], 400);
            }

            $Silian_stmt = $this->db->prepare('UPDATE products SET deleted_at = NOW() WHERE id = :id AND deleted_at IS NULL');
            $Silian_stmt->execute(['id' => $Silian_id]);

            $this->auditLog->log($Silian_user['id'], 'product_deleted', 'products', (string)$Silian_id, []);

            return $this->json($Silian_response, ['success' => true, 'message' => 'Product deleted successfully']);
        } catch (\Exception $Silian_e) {
            $this->logControllerException($Silian_e, $Silian_request, 'ProductController::deleteProduct error: ' . $Silian_e->getMessage());
            return $this->json($Silian_response, ['error' => self::ERR_INTERNAL], 500);
        }
    }

    /**
     * 创建兑换记录
     */
    private function createExchangeRecord(array $Silian_data): string
    {
        $Silian_userColumn = $this->resolvePointExchangeUserIdColumn();
        $Silian_supportsAreaCode = $this->pointExchangeSupportsAreaCode();

        $Silian_columns = [
            'id',
            $Silian_userColumn,
            'product_id',
            'quantity',
            'points_used',
            'product_name',
            'product_price',
            'delivery_address',
        ];

        $Silian_placeholders = [
            ':id',
            ':exchange_user_id',
            ':product_id',
            ':quantity',
            ':points_used',
            ':product_name',
            ':product_price',
            ':delivery_address',
        ];

        if ($Silian_supportsAreaCode) {
            $Silian_columns[] = 'contact_area_code';
            $Silian_placeholders[] = ':contact_area_code';
        }

        $Silian_columns = array_merge($Silian_columns, [
            'contact_phone',
            'notes',
            'status',
            'created_at',
        ]);
        $Silian_placeholders = array_merge($Silian_placeholders, [
            ':contact_phone',
            ':notes',
            "'pending'",
            'NOW()',
        ]);

        $Silian_sql = sprintf(
            'INSERT INTO point_exchanges (%s) VALUES (%s)',
            implode(', ', $Silian_columns),
            implode(', ', $Silian_placeholders)
        );

        $Silian_exchangeId = $this->generateUuid();
        $Silian_stmt = $this->db->prepare($Silian_sql);

        $Silian_params = [
            'id' => $Silian_exchangeId,
            'exchange_user_id' => $Silian_data['user_id'],
            'product_id' => $Silian_data['product_id'],
            'quantity' => $Silian_data['quantity'],
            'points_used' => $Silian_data['points_used'],
            'product_name' => $Silian_data['product_name'],
            'product_price' => $Silian_data['product_price'],
            'delivery_address' => $Silian_data['delivery_address'],
            'contact_phone' => $Silian_data['contact_phone'],
            'notes' => $Silian_data['notes'],
        ];

        if ($Silian_supportsAreaCode) {
            $Silian_params['contact_area_code'] = $Silian_data['contact_area_code'] ?? null;
        }

        $Silian_stmt->execute($Silian_params);

        return $Silian_exchangeId;
    }

    private function pointExchangeSupportsAreaCode(): bool
    {
        if ($this->pointExchangeHasAreaCode !== null) {
            return $this->pointExchangeHasAreaCode;
        }

        $Silian_hasColumn = false;

        try {
            $Silian_driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME) ?: null;

            if ($Silian_driver === 'sqlite') {
                $Silian_stmt = $this->db->query("PRAGMA table_info(point_exchanges)");
                if ($Silian_stmt) {
                    while ($Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC)) {
                        if (isset($Silian_row['name']) && strcasecmp((string) $Silian_row['name'], 'contact_area_code') === 0) {
                            $Silian_hasColumn = true;
                            break;
                        }
                    }
                }
            } elseif ($Silian_driver === 'mysql') {
                $Silian_stmt = $this->db->prepare('SHOW COLUMNS FROM point_exchanges LIKE ?');
                if ($Silian_stmt && $Silian_stmt->execute(['contact_area_code'])) {
                    $Silian_hasColumn = (bool) $Silian_stmt->fetch(PDO::FETCH_ASSOC);
                }
            } elseif ($Silian_driver === 'pgsql') {
                $Silian_stmt = $this->db->prepare('SELECT column_name FROM information_schema.columns WHERE table_name = ? AND column_name = ?');
                if ($Silian_stmt && $Silian_stmt->execute(['point_exchanges', 'contact_area_code'])) {
                    $Silian_hasColumn = (bool) $Silian_stmt->fetch(PDO::FETCH_ASSOC);
                }
            }
        } catch (\Throwable $Silian_exception) {
            $Silian_hasColumn = false;
        }

        $this->pointExchangeHasAreaCode = $Silian_hasColumn;
        return $Silian_hasColumn;
    }
    /**
     * 记录积分交易
     */
    private function recordPointTransaction(array $Silian_user, float $Silian_points, string $Silian_type, string $Silian_description, ?string $Silian_relatedTable = null, ?string $Silian_relatedId = null): void
    {
        $Silian_userId = (int)($Silian_user['id'] ?? 0);
        if ($Silian_userId <= 0) {
            throw new \InvalidArgumentException('Invalid user for points transaction');
        }

        $Silian_username = $Silian_user['username'] ?? null;
        $Silian_email = $Silian_user['email'] ?? null;

        if (!$Silian_username || !$Silian_email) {
            try {
                $Silian_stmt = $this->db->prepare('SELECT username, email FROM users WHERE id = :id');
                $Silian_stmt->execute(['id' => $Silian_userId]);
                $Silian_row = $Silian_stmt->fetch(PDO::FETCH_ASSOC) ?: [];
                $Silian_username = $Silian_username ?: ($Silian_row['username'] ?? null);
                $Silian_email = $Silian_email ?: ($Silian_row['email'] ?? null);
            } catch (\Throwable $Silian_ignore) {
                // 忽略补充信息失败，继续以已有数据写入
            }
        }

        $Silian_email = $Silian_email ?? '';
        $Silian_username = $Silian_username ?? '';

        $Silian_columns = $this->getPointsTransactionColumns();
        $Silian_now = (new \DateTimeImmutable())->format('Y-m-d H:i:s');
        $Silian_normalizedType = $Silian_points < 0 ? 'spend' : 'earn';
        $Silian_absolutePoints = abs($Silian_points);
        $Silian_isLegacySchema = isset($Silian_columns['time']);

        if ($Silian_isLegacySchema) {
            $Silian_columnMap = [];
            $Silian_params = [];

            $Silian_userColumn = $this->resolvePointsTransactionUserIdColumn();
            $Silian_columnMap[$Silian_userColumn] = 'user_column_value';
            $Silian_params['user_column_value'] = $Silian_userId;

            if (isset($Silian_columns['username'])) {
                $Silian_columnMap['username'] = 'username_value';
                $Silian_params['username_value'] = $Silian_username;
            }

            if (isset($Silian_columns['email'])) {
                $Silian_columnMap['email'] = 'email_value';
                $Silian_params['email_value'] = $Silian_email;
            }

            $Silian_columnMap['points'] = 'points_value';
            $Silian_params['points_value'] = $Silian_points;

            if (isset($Silian_columns['raw'])) {
                $Silian_columnMap['raw'] = 'raw_value';
                $Silian_params['raw_value'] = $Silian_absolutePoints;
            }

            if (isset($Silian_columns['auth'])) {
                $Silian_columnMap['auth'] = 'auth_value';
                $Silian_params['auth_value'] = $Silian_type;
            }

            $Silian_columnMap['type'] = 'type_value';
            $Silian_params['type_value'] = $Silian_normalizedType;

            if (isset($Silian_columns['notes'])) {
                $Silian_columnMap['notes'] = 'notes_value';
                $Silian_params['notes_value'] = $Silian_description;
            }

            if (isset($Silian_columns['status'])) {
                $Silian_columnMap['status'] = 'status_value';
                $Silian_params['status_value'] = 'approved';
            }

            if (isset($Silian_columns['time'])) {
                $Silian_columnMap['time'] = 'time_value';
                $Silian_params['time_value'] = $Silian_now;
            }

            if (isset($Silian_columns['activity_id'])) {
                $Silian_columnMap['activity_id'] = 'activity_id_value';
                $Silian_params['activity_id_value'] = $Silian_relatedId;
            }

            if (isset($Silian_columns['approved_at'])) {
                $Silian_columnMap['approved_at'] = 'approved_at_value';
                $Silian_params['approved_at_value'] = $Silian_now;
            }

            if (isset($Silian_columns['created_at'])) {
                $Silian_columnMap['created_at'] = 'created_at_value';
                $Silian_params['created_at_value'] = $Silian_now;
            }

            if (isset($Silian_columns['updated_at'])) {
                $Silian_columnMap['updated_at'] = 'updated_at_value';
                $Silian_params['updated_at_value'] = $Silian_now;
            }

            if (isset($Silian_columns['activity_date'])) {
                $Silian_columnMap['activity_date'] = 'activity_date_value';
                $Silian_params['activity_date_value'] = $Silian_now;
            }

            $Silian_columnsSql = implode(', ', array_keys($Silian_columnMap));
            $Silian_placeholdersSql = implode(', ', array_map(static fn(string $Silian_param) => ':' . $Silian_param, array_values($Silian_columnMap)));
            $Silian_sql = sprintf('INSERT INTO points_transactions (%s) VALUES (%s)', $Silian_columnsSql, $Silian_placeholdersSql);

            $Silian_stmt = $this->db->prepare($Silian_sql);
            $Silian_stmt->execute($Silian_params);

            return;
        }

        $Silian_columnMap = [];
        $Silian_params = [];

        $Silian_columnMap['id'] = 'transaction_id';
        $Silian_params['transaction_id'] = $this->generateUuid();

        if (isset($Silian_columns['uid'])) {
            $Silian_columnMap['uid'] = 'uid_value';
            $Silian_params['uid_value'] = $Silian_userId;
        }

        if (isset($Silian_columns['user_id'])) {
            $Silian_columnMap['user_id'] = 'user_id_value';
            $Silian_params['user_id_value'] = $Silian_userId;
        }

        if (!isset($Silian_columns['uid']) && !isset($Silian_columns['user_id'])) {
            $Silian_userColumn = $this->resolvePointsTransactionUserIdColumn();
            $Silian_columnMap[$Silian_userColumn] = 'user_column_value';
            $Silian_params['user_column_value'] = $Silian_userId;
        }

        $Silian_columnMap['points'] = 'points_value';
        $Silian_params['points_value'] = $Silian_points;

        if (isset($Silian_columns['raw'])) {
            $Silian_columnMap['raw'] = 'raw_value';
            $Silian_params['raw_value'] = $Silian_absolutePoints;
        }

        $Silian_columnMap['type'] = 'type_value';
        $Silian_params['type_value'] = $Silian_normalizedType;

        if (isset($Silian_columns['description'])) {
            $Silian_columnMap['description'] = 'description_value';
            $Silian_params['description_value'] = $Silian_description;
        }

        if (isset($Silian_columns['notes'])) {
            $Silian_columnMap['notes'] = 'notes_value';
            $Silian_params['notes_value'] = $Silian_description;
        }

        if (isset($Silian_columns['act'])) {
            $Silian_columnMap['act'] = 'act_value';
            $Silian_params['act_value'] = $Silian_description;
        }

        if (isset($Silian_columns['status'])) {
            $Silian_columnMap['status'] = 'status_value';
            $Silian_params['status_value'] = 'approved';
        }

        if (isset($Silian_columns['related_table'])) {
            $Silian_columnMap['related_table'] = 'related_table_value';
            $Silian_params['related_table_value'] = $Silian_relatedTable;
        }

        if (isset($Silian_columns['related_id'])) {
            $Silian_columnMap['related_id'] = 'related_id_value';
            $Silian_params['related_id_value'] = $Silian_relatedId;
        }

        if (isset($Silian_columns['username'])) {
            $Silian_columnMap['username'] = 'username_value';
            $Silian_params['username_value'] = $Silian_username;
        }

        if (isset($Silian_columns['email'])) {
            $Silian_columnMap['email'] = 'email_value';
            $Silian_params['email_value'] = $Silian_email;
        }

        if (isset($Silian_columns['auth'])) {
            $Silian_columnMap['auth'] = 'auth_value';
            $Silian_params['auth_value'] = $Silian_type;
        }

        if (isset($Silian_columns['approved_at'])) {
            $Silian_columnMap['approved_at'] = 'approved_at_value';
            $Silian_params['approved_at_value'] = $Silian_now;
        }

        if (isset($Silian_columns['approved_by'])) {
            $Silian_columnMap['approved_by'] = 'approved_by_value';
            $Silian_params['approved_by_value'] = null;
        }

        if (isset($Silian_columns['created_at'])) {
            $Silian_columnMap['created_at'] = 'created_at_value';
            $Silian_params['created_at_value'] = $Silian_now;
        }

        if (isset($Silian_columns['updated_at'])) {
            $Silian_columnMap['updated_at'] = 'updated_at_value';
            $Silian_params['updated_at_value'] = $Silian_now;
        }

        if (isset($Silian_columns['activity_id'])) {
            $Silian_columnMap['activity_id'] = 'activity_id_value';
            $Silian_params['activity_id_value'] = $Silian_relatedId;
        }

        if (isset($Silian_columns['activity_date'])) {
            $Silian_columnMap['activity_date'] = 'activity_date_value';
            $Silian_params['activity_date_value'] = $Silian_now;
        }

        $Silian_columnsSql = implode(', ', array_keys($Silian_columnMap));
        $Silian_placeholdersSql = implode(', ', array_map(static fn(string $Silian_param) => ':' . $Silian_param, array_values($Silian_columnMap)));
        $Silian_sql = sprintf('INSERT INTO points_transactions (%s) VALUES (%s)', $Silian_columnsSql, $Silian_placeholdersSql);

        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute($Silian_params);
    }

    private function getPointsTransactionColumns(): array
    {
        if ($this->pointsTransactionColumns !== null) {
            return $this->pointsTransactionColumns;
        }

        $Silian_columns = [];

        try {
            $Silian_driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME) ?: 'mysql';

            if ($Silian_driver === 'sqlite') {
                $Silian_stmt = $this->db->query('PRAGMA table_info(points_transactions)');
                if ($Silian_stmt) {
                    foreach ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) as $Silian_row) {
                        $Silian_name = $Silian_row['name'] ?? null;
                        if ($Silian_name) {
                            $Silian_columns[strtolower((string)$Silian_name)] = (string)$Silian_name;
                        }
                    }
                }
            } elseif ($Silian_driver === 'pgsql') {
                $Silian_stmt = $this->db->prepare('SELECT column_name FROM information_schema.columns WHERE table_name = :table');
                if ($Silian_stmt && $Silian_stmt->execute(['table' => 'points_transactions'])) {
                    foreach ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) as $Silian_row) {
                        $Silian_name = $Silian_row['column_name'] ?? null;
                        if ($Silian_name) {
                            $Silian_columns[strtolower((string)$Silian_name)] = (string)$Silian_name;
                        }
                    }
                }
            } else {
                $Silian_stmt = $this->db->query('SHOW COLUMNS FROM points_transactions');
                if ($Silian_stmt) {
                    foreach ($Silian_stmt->fetchAll(PDO::FETCH_ASSOC) as $Silian_row) {
                        $Silian_field = $Silian_row['Field'] ?? $Silian_row['field'] ?? null;
                        if ($Silian_field) {
                            $Silian_columns[strtolower((string)$Silian_field)] = (string)$Silian_field;
                        }
                    }
                }
            }
        } catch (\Throwable $Silian_ignore) {
            // 读取表结构失败时按空集合处理，后续逻辑会走“现代”路径
        }

        return $this->pointsTransactionColumns = $Silian_columns;
    }

    private function pointExchangeUserColumn(?string $Silian_alias = null): string
    {
        $Silian_column = $this->resolvePointExchangeUserIdColumn();
        if ($Silian_alias !== null && $Silian_alias !== '') {
            return $Silian_alias . '.' . $Silian_column;
        }

        return $Silian_column;
    }

    private function resolvePointExchangeUserIdColumn(): string
    {
        if ($this->pointExchangeUserIdColumn !== null) {
            return $this->pointExchangeUserIdColumn;
        }

        $Silian_detected = 'user_id';

        try {
            $Silian_driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME) ?: 'mysql';

            if ($Silian_driver === 'mysql') {
                $Silian_stmt = $this->db->query("SHOW COLUMNS FROM point_exchanges LIKE 'user_id'");
                $Silian_hasUserId = $Silian_stmt && $Silian_stmt->fetch(PDO::FETCH_ASSOC);
                if (!$Silian_hasUserId) {
                    $Silian_stmtUid = $this->db->query("SHOW COLUMNS FROM point_exchanges LIKE 'uid'");
                    if ($Silian_stmtUid && $Silian_stmtUid->fetch(PDO::FETCH_ASSOC)) {
                        $Silian_detected = 'uid';
                    }
                }
            } elseif ($Silian_driver === 'sqlite') {
                $Silian_stmt = $this->db->query("PRAGMA table_info(point_exchanges)");
                $Silian_columns = $Silian_stmt ? $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) : [];
                $Silian_names = array_map(static fn($Silian_col) => $Silian_col['name'] ?? '', $Silian_columns);
                if (!in_array('user_id', $Silian_names, true) && in_array('uid', $Silian_names, true)) {
                    $Silian_detected = 'uid';
                }
            } else {
                $Silian_stmt = $this->db->query("SELECT * FROM point_exchanges LIMIT 0");
                if ($Silian_stmt) {
                    $Silian_count = $Silian_stmt->columnCount();
                    for ($Silian_i = 0; $Silian_i < $Silian_count; $Silian_i++) {
                        $Silian_meta = $Silian_stmt->getColumnMeta($Silian_i);
                        $Silian_name = $Silian_meta['name'] ?? '';
                        if ($Silian_name === 'user_id') {
                            $Silian_detected = 'user_id';
                            break;
                        }
                        if ($Silian_name === 'uid') {
                            $Silian_detected = 'uid';
                        }
                    }
                }
            }
        } catch (\Throwable $Silian_e) {
            // ignore and fall back to default detected value
        }

        return $this->pointExchangeUserIdColumn = $Silian_detected;
    }

    private function resolvePointsTransactionUserIdColumn(): string
    {
        if ($this->pointsTransactionUserIdColumn !== null) {
            return $this->pointsTransactionUserIdColumn;
        }

        $Silian_detected = 'user_id';

        try {
            $Silian_driver = $this->db->getAttribute(PDO::ATTR_DRIVER_NAME) ?: 'mysql';

            if ($Silian_driver === 'mysql') {
                $Silian_stmt = $this->db->query("SHOW COLUMNS FROM points_transactions LIKE 'user_id'");
                $Silian_hasUserId = $Silian_stmt && $Silian_stmt->fetch(PDO::FETCH_ASSOC);
                if (!$Silian_hasUserId) {
                    $Silian_stmtUid = $this->db->query("SHOW COLUMNS FROM points_transactions LIKE 'uid'");
                    if ($Silian_stmtUid && $Silian_stmtUid->fetch(PDO::FETCH_ASSOC)) {
                        $Silian_detected = 'uid';
                    }
                }
            } elseif ($Silian_driver === 'sqlite') {
                $Silian_stmt = $this->db->query("PRAGMA table_info(points_transactions)");
                $Silian_columns = $Silian_stmt ? $Silian_stmt->fetchAll(PDO::FETCH_ASSOC) : [];
                $Silian_names = array_map(static fn($Silian_col) => $Silian_col['name'] ?? '', $Silian_columns);
                if (!in_array('user_id', $Silian_names, true) && in_array('uid', $Silian_names, true)) {
                    $Silian_detected = 'uid';
                }
            } else {
                $Silian_stmt = $this->db->query("SELECT * FROM points_transactions LIMIT 0");
                if ($Silian_stmt) {
                    $Silian_count = $Silian_stmt->columnCount();
                    for ($Silian_i = 0; $Silian_i < $Silian_count; $Silian_i++) {
                        $Silian_meta = $Silian_stmt->getColumnMeta($Silian_i);
                        $Silian_name = $Silian_meta['name'] ?? '';
                        if ($Silian_name === 'user_id') {
                            $Silian_detected = 'user_id';
                            break;
                        }
                        if ($Silian_name === 'uid') {
                            $Silian_detected = 'uid';
                        }
                    }
                }
            }
        } catch (\Throwable $Silian_e) {
            // ignore and fall back to detected value
        }

        return $this->pointsTransactionUserIdColumn = $Silian_detected;
    }

    private function buildProductOrderByClause($Silian_sort): string
    {
        $Silian_normalizedSort = is_string($Silian_sort) ? trim($Silian_sort) : '';

        switch ($Silian_normalizedSort) {
            case 'created_at':
            case 'created_at_desc':
                return 'p.created_at DESC, p.id DESC';
            case 'created_at_asc':
                return 'p.created_at ASC, p.id ASC';
            case 'points_asc':
                return 'p.points_required ASC, p.created_at DESC, p.id DESC';
            case 'points_desc':
                return 'p.points_required DESC, p.created_at DESC, p.id DESC';
            case 'popular':
                return 'COALESCE(e.total_exchanged, 0) DESC, p.created_at DESC, p.id DESC';
            case 'name':
                return 'p.name ASC, p.created_at DESC, p.id DESC';
            default:
                return 'p.sort_order ASC, p.created_at DESC, p.id DESC';
        }
    }

    private function buildExchangeOrderByClause($Silian_sort, string $Silian_alias = 'e'): string
    {
        $Silian_normalizedSort = is_string($Silian_sort) ? trim($Silian_sort) : '';
        $Silian_columnPrefix = $Silian_alias !== '' ? $Silian_alias . '.' : '';

        switch ($Silian_normalizedSort) {
            case 'created_at_asc':
                return $Silian_columnPrefix . 'created_at ASC, ' . $Silian_columnPrefix . 'id ASC';
            case 'points_asc':
                return $Silian_columnPrefix . 'points_used ASC, ' . $Silian_columnPrefix . 'created_at DESC';
            case 'points_desc':
                return $Silian_columnPrefix . 'points_used DESC, ' . $Silian_columnPrefix . 'created_at DESC';
            case 'status_asc':
                return $Silian_columnPrefix . 'status ASC, ' . $Silian_columnPrefix . 'created_at DESC';
            case 'status_desc':
                return $Silian_columnPrefix . 'status DESC, ' . $Silian_columnPrefix . 'created_at DESC';
            case 'created_at_desc':
            case 'created_at':
            default:
                return $Silian_columnPrefix . 'created_at DESC, ' . $Silian_columnPrefix . 'id DESC';
        }
    }

    private function buildNamedLikeClause(array $Silian_expressions, string $Silian_search, string $Silian_prefix = 'search'): array
    {
        $Silian_term = '%' . strtolower($Silian_search) . '%';
        $Silian_clauses = [];
        $Silian_bindings = [];

        foreach (array_values($Silian_expressions) as $Silian_index => $Silian_expression) {
            $Silian_param = $Silian_prefix . '_' . $Silian_index;
            $Silian_clauses[] = $Silian_expression . ' LIKE :' . $Silian_param;
            $Silian_bindings[$Silian_param] = $Silian_term;
        }

        return ['(' . implode("\n                    OR ", $Silian_clauses) . "\n                )", $Silian_bindings];
    }
    /**
     * 获取兑换记录
     */
    private function getExchangeRecord(string $Silian_exchangeId): ?array
    {
        $Silian_sql = "
            SELECT e.*, u.username, u.email
            FROM point_exchanges e
            LEFT JOIN users u ON " . $this->pointExchangeUserColumn('e') . " = u.id
            WHERE e.id = :id AND e.deleted_at IS NULL
        ";
        $Silian_stmt = $this->db->prepare($Silian_sql);
        $Silian_stmt->execute(['id' => $Silian_exchangeId]);
        return $Silian_stmt->fetch(PDO::FETCH_ASSOC) ?: null;
    }

    /**
     * 通知管理员新兑换
     */
    private function notifyAdminsNewExchange(string $Silian_exchangeId, array $Silian_user, array $Silian_product, int $Silian_quantity): void
    {
        // 获取管理员
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
            'new_exchange_pending',
            '有新兑换待处理',
            "用户 {$Silian_user['username']} 刚刚兑换了 {$Silian_product['name']} x{$Silian_quantity}，请尽快处理。",
            'high'
        );
    }

    /**
     * 发送状态更新通知
     */
    private function sendStatusUpdateNotification(array $Silian_exchange, string $Silian_status, ?string $Silian_notes, ?string $Silian_trackingNumber): void
    {
        $Silian_statusMessages = [
            'processing' => '您的兑换订单正在处理中',
            'shipped' => '您的兑换商品已发货',
            'completed' => '您的兑换订单已完成',
            'cancelled' => '您的兑换订单已取消',
            'rejected' => '您的兑换订单已被驳回',
        ];

        $Silian_title = $Silian_statusMessages[$Silian_status] ?? '兑换状态更新';
        $Silian_message = "您的兑换订单（{$Silian_exchange['product_name']} x{$Silian_exchange['quantity']}）状态已更新为：{$Silian_title}";

        if ($Silian_trackingNumber) {
            $Silian_message .= "\n物流单号：{$Silian_trackingNumber}";
        }

        if ($Silian_notes) {
            $Silian_message .= "\n备注：{$Silian_notes}";
        }

        $Silian_userColumn = $this->resolvePointExchangeUserIdColumn();
        $Silian_userId = isset($Silian_exchange[$Silian_userColumn]) ? (int)$Silian_exchange[$Silian_userColumn] : 0;

        if ($Silian_userId <= 0) {
            return;
        }

        $this->messageService->sendMessage(
            $Silian_userId,
            'exchange_status_updated',
            $Silian_title,
            $Silian_message,
            'normal'
        );

        $this->messageService->sendExchangeStatusUpdateEmailToUser(
            $Silian_userId,
            (string) ($Silian_exchange['product_name'] ?? ''),
            $Silian_status,
            $Silian_trackingNumber,
            $Silian_notes,
            $Silian_exchange['email'] ?? null,
            $Silian_exchange['username'] ?? null
        );
    }

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
    private function json(Response $Silian_response, array $Silian_data, int $Silian_status = 200): Response
    {
        $Silian_response->getBody()->write(json_encode($Silian_data));
        return $Silian_response->withStatus($Silian_status)->withHeader('Content-Type', 'application/json');
    }
}


