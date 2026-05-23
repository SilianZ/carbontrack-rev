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

class ProductExchangeQueryTest extends TestCase
{
    public function testUserCanViewExchangeHistoryAndDetail(): void
    {
        $Silian_pdo = $this->createConnection();
        $this->createSchema($Silian_pdo);
        $this->seedUsers($Silian_pdo);
        $this->seedProducts($Silian_pdo);
        $this->seedUserExchanges($Silian_pdo);

        $Silian_messageService = $this->createMock(MessageService::class);
        $Silian_auditLog = $this->createMock(AuditLogService::class);
        $Silian_authService = $this->makeUserAuthService(10);

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_auditLog, $Silian_authService);

        $Silian_listRequest = makeRequest('GET', '/me/exchanges', null, ['limit' => 10]);
        $Silian_listResponse = new Response();
        $Silian_listResult = $Silian_controller->getExchangeTransactions($Silian_listRequest, $Silian_listResponse);

        $this->assertSame(200, $Silian_listResult->getStatusCode(), (string)$Silian_listResult->getBody());
        $Silian_payload = json_decode((string)$Silian_listResult->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame(2, $Silian_payload['pagination']['total']);
        $this->assertCount(2, $Silian_payload['data']);

        $Silian_ids = array_column($Silian_payload['data'], 'id');
        $this->assertSame(['ex-user-1', 'ex-user-2'], $Silian_ids);

        $Silian_byId = [];
        foreach ($Silian_payload['data'] as $Silian_row) {
            $Silian_byId[$Silian_row['id']] = $Silian_row;
        }
        $this->assertSame('pending', $Silian_byId['ex-user-1']['status']);
        $this->assertSame('completed', $Silian_byId['ex-user-2']['status']);
        $this->assertSame(2, (int)$Silian_byId['ex-user-2']['quantity']);

        $Silian_detailRequest = makeRequest('GET', '/me/exchanges/ex-user-1');
        $Silian_detailResponse = new Response();
        $Silian_detailResult = $Silian_controller->getExchangeTransaction($Silian_detailRequest, $Silian_detailResponse, ['id' => 'ex-user-1']);

        $this->assertSame(200, $Silian_detailResult->getStatusCode(), (string)$Silian_detailResult->getBody());
        $Silian_detailPayload = json_decode((string)$Silian_detailResult->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertTrue($Silian_detailPayload['success']);
        $this->assertSame('pending', $Silian_detailPayload['data']['status']);
        $this->assertSame(150, (int)$Silian_detailPayload['data']['points_used']);

        $Silian_otherRequest = makeRequest('GET', '/me/exchanges/ex-other');
        $Silian_otherResponse = new Response();
        $Silian_otherResult = $Silian_controller->getExchangeTransaction($Silian_otherRequest, $Silian_otherResponse, ['id' => 'ex-other']);
        $this->assertSame(404, $Silian_otherResult->getStatusCode());
    }

    public function testUserExchangeHistorySupportsSearchStatusAndSort(): void
    {
        $Silian_pdo = $this->createConnection();
        $this->createSchema($Silian_pdo);
        $this->seedUsers($Silian_pdo);
        $this->seedProducts($Silian_pdo);
        $this->seedUserExchanges($Silian_pdo);

        $Silian_messageService = $this->createMock(MessageService::class);
        $Silian_auditLog = $this->createMock(AuditLogService::class);
        $Silian_authService = $this->makeUserAuthService(10);

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_auditLog, $Silian_authService);

        $Silian_filteredRequest = makeRequest('GET', '/me/exchanges', null, [
            'status' => 'completed',
            'search' => 'solar',
            'sort' => 'points_desc',
            'limit' => 10,
        ]);
        $Silian_filteredResponse = new Response();
        $Silian_filteredResult = $Silian_controller->getExchangeTransactions($Silian_filteredRequest, $Silian_filteredResponse);

        $this->assertSame(200, $Silian_filteredResult->getStatusCode(), (string) $Silian_filteredResult->getBody());
        $Silian_filteredPayload = json_decode((string) $Silian_filteredResult->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertTrue($Silian_filteredPayload['success']);
        $this->assertSame(1, $Silian_filteredPayload['pagination']['total']);
        $this->assertSame(['ex-user-2'], array_column($Silian_filteredPayload['data'], 'id'));

        $Silian_sortedRequest = makeRequest('GET', '/me/exchanges', null, [
            'sort' => 'points_asc',
            'limit' => 10,
        ]);
        $Silian_sortedResponse = new Response();
        $Silian_sortedResult = $Silian_controller->getExchangeTransactions($Silian_sortedRequest, $Silian_sortedResponse);

        $this->assertSame(200, $Silian_sortedResult->getStatusCode(), (string) $Silian_sortedResult->getBody());
        $Silian_sortedPayload = json_decode((string) $Silian_sortedResult->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame(['ex-user-1', 'ex-user-2'], array_column($Silian_sortedPayload['data'], 'id'));
    }

    public function testAdminCanViewExchangeRecordDetail(): void
    {
        $Silian_pdo = $this->createConnection();
        $this->createSchema($Silian_pdo);
        $this->seedUsers($Silian_pdo);
        $this->seedProducts($Silian_pdo);
        $this->seedAdminExchange($Silian_pdo);

        $Silian_messageService = $this->createMock(MessageService::class);
        $Silian_auditLog = $this->createMock(AuditLogService::class);
        $Silian_authService = $this->makeAdminAuthService();

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_auditLog, $Silian_authService);

        $Silian_detailRequest = makeRequest('GET', '/admin/exchanges/ex-admin-1');
        $Silian_detailResponse = new Response();

        $Silian_result = $Silian_controller->getExchangeRecordDetail($Silian_detailRequest, $Silian_detailResponse, ['id' => 'ex-admin-1']);

        $this->assertSame(200, $Silian_result->getStatusCode(), (string)$Silian_result->getBody());
        $Silian_payload = json_decode((string)$Silian_result->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertTrue($Silian_payload['success']);

        $Silian_data = $Silian_payload['data'];
        $this->assertSame('shipped', $Silian_data['status']);
        $this->assertSame('admin_user', $Silian_data['username']);
        $this->assertSame('admin@example.com', $Silian_data['email']);
        $this->assertSame('Eco Bottle', $Silian_data['product_name']);
        $this->assertSame('eco-bottle-img', $Silian_data['current_product_image_path']);
        $this->assertSame('Warehouse A', $Silian_data['delivery_address']);
        $this->assertSame('TRACK-ADMIN', $Silian_data['tracking_number']);
        $this->assertSame('Warehouse A', $Silian_data['shipping_address']);
        $this->assertSame('admin_user', $Silian_data['user_username']);
        $this->assertSame('admin@example.com', $Silian_data['user_email']);
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

        $Silian_pdo->exec('CREATE TABLE products (
            id INTEGER PRIMARY KEY,
            name TEXT,
            images TEXT,
            image_path TEXT,
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
            (10, 'user_a', 'user_a@example.com', 300, 0, 'active', '$Silian_now'),
            (11, 'user_b', 'user_b@example.com', 120, 0, 'active', '$Silian_now')
        ");
    }

    private function seedProducts(PDO $Silian_pdo): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_pdo->exec("INSERT INTO products (id, name, images, image_path, created_at) VALUES
            (100, 'Eco Bottle', '[\"eco-bottle-img\"]', 'eco-bottle-img', '$Silian_now'),
            (101, 'Solar Charger', '[\"solar-img\"]', 'solar-img', '$Silian_now')
        ");
    }

    private function seedUserExchanges(PDO $Silian_pdo): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_pdo->exec("INSERT INTO point_exchanges (
            id, user_id, product_id, quantity, points_used, product_name, product_price,
            status, tracking_number, notes, created_at
        ) VALUES
            ('ex-user-1', 10, 100, 1, 150, 'Eco Bottle', 150, 'pending', 'TRACK-USER-1', 'Awaiting dispatch', '$Silian_now'),
            ('ex-user-2', 10, 101, 2, 400, 'Solar Charger', 200, 'completed', 'TRACK-SOLAR', 'Delivered to dorm', datetime('$Silian_now','-1 day')),
            ('ex-other', 11, 100, 1, 150, 'Eco Bottle', 150, 'pending', 'TRACK-OTHER', 'Other user order', datetime('$Silian_now','-2 day'))
        ");
    }

    private function seedAdminExchange(PDO $Silian_pdo): void
    {
        $Silian_now = date('Y-m-d H:i:s');
        $Silian_pdo->exec("INSERT INTO point_exchanges (
            id, user_id, product_id, quantity, points_used, product_name, product_price,
            delivery_address, contact_area_code, contact_phone, notes,
            status, tracking_number, created_at, updated_at
        ) VALUES (
            'ex-admin-1', 1, 100, 1, 150, 'Eco Bottle', 150,
            'Warehouse A', '021', '12345678', 'Handle with care',
            'shipped', 'TRACK-ADMIN', '$Silian_now', '$Silian_now'
        )");
    }

    private function makeUserAuthService(int $Silian_userId): AuthService
    {
        $Silian_userRow = [
            'id' => $Silian_userId,
            'username' => $Silian_userId === 10 ? 'user_a' : 'user_b',
            'email' => $Silian_userId === 10 ? 'user_a@example.com' : 'user_b@example.com',
            'points' => 300,
            'is_admin' => false
        ];

        return new class('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'HS256', 3600, $Silian_userRow) extends AuthService {
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

    private function makeAdminAuthService(): AuthService
    {
        $Silian_adminUser = [
            'id' => 1,
            'username' => 'admin_user',
            'email' => 'admin@example.com',
            'points' => 1000,
            'is_admin' => true
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
}
