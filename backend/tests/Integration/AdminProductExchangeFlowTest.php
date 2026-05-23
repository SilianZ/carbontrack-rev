<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Integration;

use CarbonTrack\Controllers\ProductController;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\MessageService;
use PDO;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ServerRequestInterface;
use Slim\Psr7\Response;

class AdminProductExchangeFlowTest extends TestCase
{
    public function testAdminProductLifecycle(): void
    {
        $Silian_pdo = $this->createConnection();
        $this->createSchema($Silian_pdo);
        $this->seedUsers($Silian_pdo);

        $Silian_messageService = $this->createMock(MessageService::class);
        $Silian_auditLog = $this->createMock(AuditLogService::class);
        $Silian_auditLog->method('log')->willReturn(true);
        $Silian_authService = $this->makeAdminAuthService();

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_auditLog, $Silian_authService);

        $Silian_createRequest = makeRequest('POST', '/admin/products', [
            'name' => 'Solar Charger',
            'description' => 'Portable solar charger',
            'points_required' => 450,
            'stock' => 25,
            'category' => 'Outdoor',
            'tags' => ['Eco', ['name' => '热门', 'slug' => 'hot']],
            'sort_order' => 3
        ]);
        $Silian_createResponse = new Response();

        $Silian_created = $Silian_controller->createProduct($Silian_createRequest, $Silian_createResponse);
        $this->assertSame(201, $Silian_created->getStatusCode(), (string)$Silian_created->getBody());

        $Silian_payload = json_decode((string)$Silian_created->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertTrue($Silian_payload['success']);
        $Silian_productId = (int)$Silian_payload['id'];
        $this->assertGreaterThan(0, $Silian_productId);

        $Silian_productRow = $Silian_pdo->query('SELECT * FROM products WHERE id = ' . $Silian_productId)->fetch(PDO::FETCH_ASSOC);
        $this->assertSame('Solar Charger', $Silian_productRow['name']);
        $this->assertSame('Outdoor', $Silian_productRow['category']);
        $this->assertNotEmpty($Silian_productRow['category_slug']);
        $this->assertSame('active', $Silian_productRow['status']);
        $this->assertSame('25', (string)$Silian_productRow['stock']);

        $Silian_tagCount = (int)$Silian_pdo->query('SELECT COUNT(*) FROM product_tags')->fetchColumn();
        $this->assertSame(2, $Silian_tagCount);

        $Silian_map = $Silian_pdo->query('SELECT tag_id FROM product_tag_map WHERE product_id = ' . $Silian_productId)->fetchAll(PDO::FETCH_COLUMN);
        $this->assertCount(2, $Silian_map);

        $Silian_existingTagId = (int)$Silian_pdo->query("SELECT id FROM product_tags WHERE slug = 'hot'")->fetchColumn();

        $Silian_updateRequest = makeRequest('PUT', '/admin/products/' . $Silian_productId, [
            'status' => 'inactive',
            'stock' => 10,
            'category' => 'Electronics',
            'tags' => [
                ['id' => $Silian_existingTagId, 'name' => '热门']
            ]
        ]);
        $Silian_updateResponse = new Response();

        $Silian_updated = $Silian_controller->updateProduct($Silian_updateRequest, $Silian_updateResponse, ['id' => $Silian_productId]);
        $this->assertSame(200, $Silian_updated->getStatusCode(), (string)$Silian_updated->getBody());

        $Silian_updatePayload = json_decode((string)$Silian_updated->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertTrue($Silian_updatePayload['success']);

        $Silian_productAfterUpdate = $Silian_pdo->query('SELECT * FROM products WHERE id = ' . $Silian_productId)->fetch(PDO::FETCH_ASSOC);
        $this->assertSame('inactive', $Silian_productAfterUpdate['status']);
        $this->assertSame('10', (string)$Silian_productAfterUpdate['stock']);
        $this->assertSame('Electronics', $Silian_productAfterUpdate['category']);

        $Silian_mapAfterUpdate = $Silian_pdo->query('SELECT tag_id FROM product_tag_map WHERE product_id = ' . $Silian_productId)->fetchAll(PDO::FETCH_COLUMN);
        $this->assertSame([$Silian_existingTagId], array_map('intval', $Silian_mapAfterUpdate));
    }

    public function testAdminCanListAndUpdateExchangeStatus(): void
    {
        $Silian_pdo = $this->createConnection();
        $this->createSchema($Silian_pdo);
        $this->seedUsers($Silian_pdo);
        $this->seedProduct($Silian_pdo);
        $this->seedExchange($Silian_pdo);

        $Silian_messageService = $this->createMock(MessageService::class);
        $Silian_messageService->expects($this->once())
            ->method('sendMessage')
            ->with(
                $this->equalTo(2),
                $this->equalTo('exchange_status_updated'),
                $this->equalTo('您的兑换商品已发货'),
                $this->stringContains('状态已更新为'),
                $this->equalTo('normal')
            );

        $Silian_messageService->expects($this->once())
            ->method('sendExchangeStatusUpdateEmailToUser')
            ->with(
                $this->equalTo(2),
                $this->equalTo('Eco Bottle'),
                $this->equalTo('shipped'),
                $this->equalTo('TRACK123'),
                $this->equalTo('发货完成'),
                $this->anything(),
                $this->anything()
            );

        $Silian_auditLog = $this->createMock(AuditLogService::class);
        $Silian_auditLog->method('log')->willReturn(true);

        $Silian_authService = $this->makeAdminAuthService();
        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_auditLog, $Silian_authService);

        $Silian_listRequest = makeRequest('GET', '/admin/exchanges', null, [
            'status' => 'pending',
            'search' => 'ex-1',
            'sort' => 'created_at_desc',
        ]);
        $Silian_listResponse = new Response();
        $Silian_listResult = $Silian_controller->getExchangeRecords($Silian_listRequest, $Silian_listResponse);
        $this->assertSame(200, $Silian_listResult->getStatusCode(), (string)$Silian_listResult->getBody());

        $Silian_listPayload = json_decode((string)$Silian_listResult->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertTrue($Silian_listPayload['success']);
        $this->assertCount(1, $Silian_listPayload['data']);
        $Silian_exchangeRow = $Silian_listPayload['data'][0];
        $this->assertSame('pending', $Silian_exchangeRow['status']);
        $this->assertSame('eco-bottle', $Silian_exchangeRow['current_product_image_path']);

        $Silian_updateRequest = makeRequest('PUT', '/admin/exchanges/ex-1', [
            'status' => 'shipped',
            'tracking_number' => 'TRACK123',
            'admin_notes' => '发货完成'
        ]);
        $Silian_updateResponse = new Response();
        $Silian_updateResult = $Silian_controller->updateExchangeStatus($Silian_updateRequest, $Silian_updateResponse, ['id' => 'ex-1']);
        $this->assertSame(200, $Silian_updateResult->getStatusCode(), (string)$Silian_updateResult->getBody());

        $Silian_updatePayload = json_decode((string)$Silian_updateResult->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertTrue($Silian_updatePayload['success']);

        $Silian_dbExchange = $Silian_pdo->query("SELECT status, tracking_number, notes FROM point_exchanges WHERE id = 'ex-1'")->fetch(PDO::FETCH_ASSOC);
        $this->assertSame('shipped', $Silian_dbExchange['status']);
        $this->assertSame('TRACK123', $Silian_dbExchange['tracking_number']);
        $this->assertSame('发货完成', $Silian_dbExchange['notes']);
    }

    public function testAdminCanRejectExchangeStatus(): void
    {
        $Silian_pdo = $this->createConnection();
        $this->createSchema($Silian_pdo);
        $this->seedUsers($Silian_pdo);
        $this->seedProduct($Silian_pdo);
        $this->seedExchange($Silian_pdo);

        $Silian_messageService = $this->createMock(MessageService::class);
        $Silian_messageService->expects($this->once())
            ->method('sendMessage')
            ->with(
                $this->equalTo(2),
                $this->equalTo('exchange_status_updated'),
                $this->equalTo('您的兑换订单已被驳回'),
                $this->logicalAnd(
                    $this->stringContains('您的兑换订单（Eco Bottle x1）状态已更新为：您的兑换订单已被驳回'),
                    $this->stringContains('备注：库存不足')
                ),
                $this->equalTo('normal')
            );

        $Silian_messageService->expects($this->once())
            ->method('sendExchangeStatusUpdateEmailToUser')
            ->with(
                $this->equalTo(2),
                $this->equalTo('Eco Bottle'),
                $this->equalTo('rejected'),
                $this->equalTo(null),
                $this->equalTo('库存不足'),
                $this->anything(),
                $this->anything()
            );

        $Silian_auditLog = $this->createMock(AuditLogService::class);
        $Silian_auditLog->method('log')->willReturn(true);

        $Silian_authService = $this->makeAdminAuthService();
        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_auditLog, $Silian_authService);

        $Silian_request = makeRequest('PUT', '/admin/exchanges/ex-1', [
            'status' => 'rejected',
            'admin_notes' => '库存不足'
        ]);
        $Silian_response = new Response();

        $Silian_result = $Silian_controller->updateExchangeStatus($Silian_request, $Silian_response, ['id' => 'ex-1']);
        $this->assertSame(200, $Silian_result->getStatusCode(), (string) $Silian_result->getBody());

        $Silian_payload = json_decode((string)$Silian_result->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertTrue($Silian_payload['success']);

        $Silian_dbExchange = $Silian_pdo->query("SELECT status, tracking_number, notes FROM point_exchanges WHERE id = 'ex-1'")->fetch(PDO::FETCH_ASSOC);
        $this->assertSame('rejected', $Silian_dbExchange['status']);
        $this->assertNull($Silian_dbExchange['tracking_number']);
        $this->assertSame('库存不足', $Silian_dbExchange['notes']);
    }
    public function testAdminExchangeListSupportsSearchAndSort(): void
    {
        $Silian_pdo = $this->createConnection();
        $this->createSchema($Silian_pdo);
        $this->seedUsers($Silian_pdo);
        $this->seedProduct($Silian_pdo);
        $this->seedExchange($Silian_pdo);

        $Silian_messageService = $this->createMock(MessageService::class);
        $Silian_auditLog = $this->createMock(AuditLogService::class);
        $Silian_auditLog->method('log')->willReturn(true);

        $Silian_authService = $this->makeAdminAuthService();
        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_auditLog, $Silian_authService);

        $Silian_searchRequest = makeRequest('GET', '/admin/exchanges', null, [
            'search' => 'track-second',
            'limit' => 10,
        ]);
        $Silian_searchResponse = new Response();
        $Silian_searchResult = $Silian_controller->getExchangeRecords($Silian_searchRequest, $Silian_searchResponse);

        $this->assertSame(200, $Silian_searchResult->getStatusCode(), (string) $Silian_searchResult->getBody());
        $Silian_searchPayload = json_decode((string) $Silian_searchResult->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame(['ex-2'], array_column($Silian_searchPayload['data'], 'id'));

        $Silian_sortedRequest = makeRequest('GET', '/admin/exchanges', null, [
            'sort' => 'created_at_asc',
            'limit' => 10,
        ]);
        $Silian_sortedResponse = new Response();
        $Silian_sortedResult = $Silian_controller->getExchangeRecords($Silian_sortedRequest, $Silian_sortedResponse);

        $this->assertSame(200, $Silian_sortedResult->getStatusCode(), (string) $Silian_sortedResult->getBody());
        $Silian_sortedPayload = json_decode((string) $Silian_sortedResult->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame(['ex-2', 'ex-1'], array_column($Silian_sortedPayload['data'], 'id'));
    }

    public function testStoreProductListSupportsSortModes(): void
    {
        $Silian_pdo = $this->createConnection();
        $this->createSchema($Silian_pdo);
        $this->seedUsers($Silian_pdo);
        $this->seedStoreProducts($Silian_pdo);
        $this->seedCompletedExchangeStats($Silian_pdo);

        $Silian_messageService = $this->createMock(MessageService::class);
        $Silian_auditLog = $this->createMock(AuditLogService::class);
        $Silian_authService = $this->makeUserAuthService();

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_auditLog, $Silian_authService);

        $Silian_pointsRequest = makeRequest('GET', '/products', null, ['sort' => 'points_asc', 'limit' => 10]);
        $Silian_pointsResponse = new Response();
        $Silian_pointsResult = $Silian_controller->getProducts($Silian_pointsRequest, $Silian_pointsResponse);

        $this->assertSame(200, $Silian_pointsResult->getStatusCode(), (string) $Silian_pointsResult->getBody());
        $Silian_pointsPayload = json_decode((string) $Silian_pointsResult->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame(['Seed Packet', 'Eco Bottle', 'Solar Charger'], array_column($Silian_pointsPayload['data']['products'], 'name'));

        $Silian_popularRequest = makeRequest('GET', '/products', null, ['sort' => 'popular', 'limit' => 10]);
        $Silian_popularResponse = new Response();
        $Silian_popularResult = $Silian_controller->getProducts($Silian_popularRequest, $Silian_popularResponse);

        $this->assertSame(200, $Silian_popularResult->getStatusCode(), (string) $Silian_popularResult->getBody());
        $Silian_popularPayload = json_decode((string) $Silian_popularResult->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame(['Solar Charger', 'Eco Bottle', 'Seed Packet'], array_column($Silian_popularPayload['data']['products'], 'name'));
    }

    private function createConnection(): PDO
    {
        $Silian_pdo = new PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        if (method_exists($Silian_pdo, 'sqliteCreateFunction')) {
            $Silian_pdo->sqliteCreateFunction('NOW', static fn() => date('Y-m-d H:i:s'));
        }
        return $Silian_pdo;
    }

    private function createSchema(PDO $Silian_pdo): void
    {
        $Silian_pdo->exec('CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            username TEXT,
            email TEXT,
            points INTEGER,
            is_admin INTEGER,
            status TEXT,
            created_at TEXT,
            deleted_at TEXT,
            notification_email_mask INTEGER DEFAULT 0
        )');

        $Silian_pdo->exec('CREATE TABLE product_categories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            slug TEXT UNIQUE,
            created_at TEXT
        )');

        $Silian_pdo->exec('CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            category TEXT,
            category_slug TEXT,
            points_required INTEGER,
            description TEXT,
            image_path TEXT,
            images TEXT,
            stock INTEGER,
            status TEXT,
            sort_order INTEGER,
            created_at TEXT,
            updated_at TEXT,
            deleted_at TEXT
        )');

        $Silian_pdo->exec('CREATE TABLE product_tags (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            slug TEXT UNIQUE,
            created_at TEXT,
            updated_at TEXT
        )');

        $Silian_pdo->exec('CREATE TABLE product_tag_map (
            product_id INTEGER,
            tag_id INTEGER,
            created_at TEXT
        )');

        $Silian_pdo->exec('CREATE TABLE point_exchanges (
            id TEXT PRIMARY KEY,
            user_id INTEGER,
            product_id INTEGER,
            quantity INTEGER,
            points_used INTEGER,
            product_name TEXT,
            product_price INTEGER,
            delivery_address TEXT,
            contact_area_code TEXT,
            contact_phone TEXT,
            notes TEXT,
            status TEXT,
            tracking_number TEXT,
            created_at TEXT,
            updated_at TEXT,
            deleted_at TEXT
        )');
    }

    private function seedUsers(PDO $Silian_pdo): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_pdo->exec("INSERT INTO users (id, username, email, points, is_admin, status, created_at) VALUES
            (1, 'admin_user', 'admin@example.com', 1000, 1, 'active', '$Silian_now'),
            (2, 'normal_user', 'user@example.com', 320, 0, 'active', '$Silian_now')
        ");
    }

    private function seedProduct(PDO $Silian_pdo): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_pdo->exec("INSERT INTO products (id, name, category, category_slug, points_required, description, image_path, images, stock, status, sort_order, created_at)
            VALUES (1, 'Eco Bottle', 'Lifestyle', 'lifestyle', 150, 'Reusable bottle', 'eco-bottle', '[\"eco-bottle\"]', 20, 'active', 1, '$Silian_now')
        ");
    }

    private function seedExchange(PDO $Silian_pdo): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_pdo->exec("INSERT INTO point_exchanges (
            id, user_id, product_id, quantity, points_used, product_name, product_price,
            status, tracking_number, created_at
        ) VALUES (
            'ex-1', 2, 1, 1, 150, 'Eco Bottle', 150, 'pending', 'TRACK123', '$Silian_now'
        ), (
            'ex-2', 2, 1, 1, 150, 'Eco Bottle', 150, 'completed', 'TRACK-SECOND', datetime('$Silian_now', '-1 day')
        )");
    }

    private function seedStoreProducts(PDO $Silian_pdo): void
    {
        $Silian_pdo->exec("INSERT INTO products (id, name, category, category_slug, points_required, description, image_path, images, stock, status, sort_order, created_at)
            VALUES
            (10, 'Eco Bottle', 'Lifestyle', 'lifestyle', 150, 'Reusable bottle', 'eco-bottle', '[\"eco-bottle\"]', 20, 'active', 2, '2026-01-02 10:00:00'),
            (11, 'Solar Charger', 'Electronics', 'electronics', 300, 'Portable charger', 'solar-charger', '[\"solar-charger\"]', 20, 'active', 3, '2026-01-03 10:00:00'),
            (12, 'Seed Packet', 'Lifestyle', 'lifestyle', 50, 'Plantable seeds', 'seed-packet', '[\"seed-packet\"]', 20, 'active', 1, '2026-01-01 10:00:00')
        ");
    }

    private function seedCompletedExchangeStats(PDO $Silian_pdo): void
    {
        $Silian_pdo->exec("INSERT INTO point_exchanges (
            id, user_id, product_id, quantity, points_used, product_name, product_price,
            status, tracking_number, created_at
        ) VALUES
            ('stat-1', 2, 11, 1, 300, 'Solar Charger', 300, 'completed', 'STAT-1', '2026-01-04 10:00:00'),
            ('stat-2', 2, 11, 1, 300, 'Solar Charger', 300, 'completed', 'STAT-2', '2026-01-05 10:00:00'),
            ('stat-3', 2, 10, 1, 150, 'Eco Bottle', 150, 'completed', 'STAT-3', '2026-01-06 10:00:00')
        ");
    }

    private function makeAdminAuthService(): AuthService
    {
        $Silian_adminUser = [
            'id' => 1,
            'username' => 'admin_user',
            'email' => 'admin@example.com',
            'is_admin' => true,
            'points' => 1000
        ];

        return new class('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'HS256', 3600, $Silian_adminUser) extends AuthService {
            private array $user;

            public function __construct(string $Silian_secret, string $Silian_alg, int $Silian_exp, array $Silian_user)
            {
                parent::__construct($Silian_secret, $Silian_alg, $Silian_exp);
                $this->user = $Silian_user;
            }

            public function getCurrentUser(ServerRequestInterface $Silian_request): ?array
            {
                return $this->user;
            }

            public function isAdminUser($Silian_user): bool
            {
                return true;
            }
        };
    }

    private function makeUserAuthService(): AuthService
    {
        $Silian_normalUser = [
            'id' => 2,
            'username' => 'normal_user',
            'email' => 'user@example.com',
            'is_admin' => false,
            'points' => 320,
        ];

        return new class('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'HS256', 3600, $Silian_normalUser) extends AuthService {
            private array $user;

            public function __construct(string $Silian_secret, string $Silian_alg, int $Silian_exp, array $Silian_user)
            {
                parent::__construct($Silian_secret, $Silian_alg, $Silian_exp);
                $this->user = $Silian_user;
            }

            public function getCurrentUser(ServerRequestInterface $Silian_request): ?array
            {
                return $this->user;
            }

            public function isAdminUser($Silian_user): bool
            {
                return false;
            }
        };
    }
}
