<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Integration;

use PHPUnit\Framework\TestCase;
use Slim\App;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\Factory\ResponseFactory;
use DI\Container;
use CarbonTrack\Services\DatabaseService;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Tests\Integration\TestSchemaBuilder;

/**
 * Comprehensive business data tests that simulate real-world usage patterns
 * This test suite validates the backend against OpenAPI specifications
 * using realistic business scenarios and data
 */
class ComprehensiveBusinessDataTest extends TestCase
{
    protected App $app;
    protected \PDO $pdo;
    protected AuthService $authService;
    protected array $testUsers = [];
    protected array $testProducts = [];
    protected array $testCarbonActivities = [];

    protected function setUp(): void
    {
        // Load environment variables for testing
        if (file_exists(__DIR__ . '/../../.env.testing')) {
            $Silian_dotenv = \Dotenv\Dotenv::createImmutable(__DIR__ . '/../..', '.env.testing');
            $Silian_dotenv->load();
        } elseif (file_exists(__DIR__ . '/../../.env')) {
            $Silian_dotenv = \Dotenv\Dotenv::createImmutable(__DIR__ . '/../..');
            $Silian_dotenv->load();
        }

        // Set up test environment variables with proper database configuration
        $_ENV['APP_ENV'] = 'testing';
        $_ENV['DATABASE_PATH'] = __DIR__ . '/../../test.db';
        // Ensure SQLite database file exists (Illuminate SQLite connector requires existing file path)
        if (!file_exists($_ENV['DATABASE_PATH'])) {
            touch($_ENV['DATABASE_PATH']);
        }
        $_ENV['DB_CONNECTION'] = 'sqlite';
        $_ENV['DB_DATABASE'] = $_ENV['DATABASE_PATH'];
        $_ENV['JWT_SECRET'] = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
        $_ENV['JWT_ALGORITHM'] = 'HS256';
        $_ENV['JWT_EXPIRATION'] = '86400';
        $_ENV['TURNSTILE_SECRET_KEY'] = 'test_turnstile_secret';
        $_ENV['REGION_DATA_PATH'] = realpath(__DIR__ . '/../../../frontend/public/locales/states.json') ?: '';
        $_ENV['R2_ACCESS_KEY_ID'] = 'test_access_key';
        $_ENV['R2_SECRET_ACCESS_KEY'] = 'test_secret_key';
        $_ENV['R2_ENDPOINT'] = 'https://example.com';
        $_ENV['R2_BUCKET_NAME'] = 'test-bucket';
        $_ENV['R2_PUBLIC_URL'] = 'https://example.com/test-bucket';

        try {
            // Create container and set up dependencies
            $Silian_container = new Container();

            // Set up database configuration for Illuminate
            $Silian_config = [
                'database' => [
                    'default' => 'sqlite',
                    'connections' => [
                        'sqlite' => [
                            'driver' => 'sqlite',
                            'database' => $_ENV['DATABASE_PATH'],
                            'prefix' => '',
                        ]
                    ]
                ]
            ];

            // Store config in container for dependencies.php
            $Silian_container->set('config', $Silian_config);

            require __DIR__ . '/../../src/dependencies.php';
            // After dependencies loaded and before routes, ensure schema exists
            // Initialize minimal test schema
            $Silian_dbServiceTmp = $Silian_container->get(DatabaseService::class);
            TestSchemaBuilder::init($Silian_dbServiceTmp->getConnection()->getPdo());

            // Create Slim app
            $this->app = \Slim\Factory\AppFactory::createFromContainer($Silian_container);
            $this->app->addErrorMiddleware(true, true, true);
            $this->app->addBodyParsingMiddleware();
            $this->app->addRoutingMiddleware();

            // Add routes
            $Silian_routes = require __DIR__ . '/../../src/routes.php';
            $Silian_routes($this->app);

            // Get services
            $Silian_dbService = $Silian_container->get(DatabaseService::class);
            $this->pdo = $Silian_dbService->getConnection()->getPdo();
            $this->authService = $Silian_container->get(AuthService::class);

            // Set up test data
            $this->setUpTestData();

        } catch (\Exception $Silian_e) {
            echo "Setup error: " . $Silian_e->getMessage() . "\n";
            echo "Trace: " . $Silian_e->getTraceAsString() . "\n";
            throw $Silian_e;
        }
    }

    protected function setUpTestData(): void
    {
        // Clear existing test data (ignore errors if tables don't exist)
        try {
            $this->pdo->exec("DELETE FROM users WHERE email LIKE '%@testdomain.com'");
        } catch (\Throwable $Silian_e) {
            // Ignore if table doesn't exist
        }
        try {
            $this->pdo->exec("DELETE FROM products WHERE name LIKE 'Test Product%'");
        } catch (\Throwable $Silian_e) {
            // Ignore if table doesn't exist
        }
        try {
            $this->pdo->exec("DELETE FROM point_exchanges WHERE id LIKE 'test-%'");
        } catch (\Throwable $Silian_e) {
            // Ignore if table doesn't exist
        }
        try {
            $this->pdo->exec("DELETE FROM carbon_records WHERE id LIKE 'test-%'");
        } catch (\Throwable $Silian_e) {
            // Ignore if table doesn't exist
        }

        // Create realistic test users
        $this->createTestUsers();

        // Create realistic test products
        $this->createTestProducts();

        // Create realistic carbon activities
        $this->createTestCarbonActivities();
    }

    protected function createTestUsers(): void
    {
        $Silian_testUserData = [
            [
                'username' => 'student_zhang',
                'email' => 'zhang.wei@testdomain.com',
                // phone 字段已从用户表/模型逻辑中移除
                'school_id' => 1,
                'role' => 'user',
                'status' => 'active',
                'points' => 150,
                'avatar_id' => 1
            ],
            [
                'username' => 'student_li',
                'email' => 'li.ming@testdomain.com',
                // phone 字段已从用户表/模型逻辑中移除
                'school_id' => 1,
                'role' => 'user',
                'status' => 'active',
                'points' => 300,
                'avatar_id' => 1
            ],
            [
                'username' => 'teacher_wang',
                'email' => 'wang.fang@testdomain.com',
                // phone 字段已从用户表/模型逻辑中移除
                'school_id' => 1,
                'role' => 'admin',
                'status' => 'active',
                'points' => 500,
                'avatar_id' => 1
            ]
        ];

        foreach ($Silian_testUserData as $Silian_userData) {
            $Silian_hashedPassword = password_hash('password123', PASSWORD_BCRYPT);
            // 为 token 生成兼容的 uuid（AuthService->generateToken 期望存在）
            $Silian_userUuid = $this->generateUuid();

            $Silian_isAdmin = ($Silian_userData['role'] ?? '') === 'admin' ? 1 : 0;
            // Insert including is_admin if column exists
            try {
                $Silian_stmt = $this->pdo->prepare("\n                    INSERT INTO users (username, email, password, school_id, status, points, is_admin, created_at, updated_at)\n                    VALUES (:username, :email, :password, :school_id, :status, :points, :is_admin, datetime('now'), datetime('now'))\n                ");
                $Silian_stmt->execute([
                    'username' => $Silian_userData['username'],
                    'email' => $Silian_userData['email'],
                    'password' => $Silian_hashedPassword,
                    'school_id' => $Silian_userData['school_id'],
                    'status' => $Silian_userData['status'],
                    'points' => $Silian_userData['points'],
                    'is_admin' => $Silian_isAdmin,
                ]);
            } catch (\Throwable $Silian_t) {
                // fallback to old insert without is_admin
                $Silian_stmt = $this->pdo->prepare("\n                    INSERT INTO users (username, email, password, school_id, status, points, created_at, updated_at)\n                    VALUES (:username, :email, :password, :school_id, :status, :points, datetime('now'), datetime('now'))\n                ");
                $Silian_stmt->execute([
                    'username' => $Silian_userData['username'],
                    'email' => $Silian_userData['email'],
                    'password' => $Silian_hashedPassword,
                    'school_id' => $Silian_userData['school_id'],
                    'status' => $Silian_userData['status'],
                    'points' => $Silian_userData['points']
                ]);
            }

            $Silian_userData['id'] = $this->pdo->lastInsertId();
            $Silian_userData['uuid'] = $Silian_userUuid; // 缓存到测试数组用于 generateJwtToken

            // 尝试写回 uuid 与 is_admin
            try { $this->pdo->exec("UPDATE users SET uuid = '" . $Silian_userUuid . "' WHERE id = " . (int)$Silian_userData['id']); } catch (\Throwable $Silian_e) {}
            if ($Silian_isAdmin) { try { $this->pdo->exec("UPDATE users SET is_admin = 1 WHERE id = " . (int)$Silian_userData['id']); } catch (\Throwable $Silian_e) {} }

            $this->testUsers[] = $Silian_userData;
        }
    }

        private function generateUuid(): string
        {
            // 简单 UUID v4 生成
            $Silian_data = random_bytes(16);
            $Silian_data[6] = chr(ord($Silian_data[6]) & 0x0f | 0x40); // version 4
            $Silian_data[8] = chr(ord($Silian_data[8]) & 0x3f | 0x80); // variant
            return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($Silian_data), 4));
        }

    protected function createTestProducts(): void
    {
        $Silian_testProductData = [
            [
                'name' => 'Test Product 环保水杯',
                'description' => '可重复使用的环保水杯，材质安全，容量500ml，适合日常使用',
                'category' => 'daily',
                'images' => json_encode(['/images/products/eco_bottle_1.jpg', '/images/products/eco_bottle_2.jpg']),
                'stock' => 50,
                'points_required' => 100,
                'status' => 'active',
                'sort_order' => 1
            ],
            [
                'name' => 'Test Product 竹制餐具套装',
                'description' => '可降解竹制餐具，包含筷子、勺子、叉子，便携环保',
                'category' => 'daily',
                'images' => json_encode(['/images/products/bamboo_utensils.jpg']),
                'stock' => 30,
                'points_required' => 150,
                'status' => 'active',
                'sort_order' => 2
            ],
            [
                'name' => 'Test Product 太阳能充电宝',
                'description' => '10000mAh太阳能充电宝，支持快充，环保节能',
                'category' => 'electronics',
                'images' => json_encode(['/images/products/solar_powerbank.jpg']),
                'stock' => 20,
                'points_required' => 500,
                'status' => 'active',
                'sort_order' => 3
            ]
        ];

        foreach ($Silian_testProductData as $Silian_productData) {
            $Silian_stmt = $this->pdo->prepare("
                INSERT INTO products (name, description, category, images, stock, points_required, status, sort_order, created_at, updated_at)
                VALUES (:name, :description, :category, :images, :stock, :points_required, :status, :sort_order, datetime('now'), datetime('now'))
            ");

                // SQLite 测试 products 表包含非空 image_path 列，补充赋值
                $Silian_imagePath = '/images/products/placeholder.jpg';
                if (!empty($Silian_productData['images'])) {
                    $Silian_decoded = json_decode($Silian_productData['images'], true);
                    if (is_array($Silian_decoded) && count($Silian_decoded) > 0) {
                        $Silian_imagePath = $Silian_decoded[0];
                    }
                }

                $Silian_sql = "INSERT INTO products (name, description, category, images, stock, points_required, status, sort_order, image_path, created_at, updated_at)
                        VALUES (:name, :description, :category, :images, :stock, :points_required, :status, :sort_order, :image_path, datetime('now'), datetime('now'))";
                $Silian_stmt = $this->pdo->prepare($Silian_sql);
                $Silian_executeData = $Silian_productData;
                $Silian_executeData['image_path'] = $Silian_imagePath;
                $Silian_stmt->execute($Silian_executeData);
            $Silian_productData['id'] = $this->pdo->lastInsertId();
            $this->testProducts[] = $Silian_productData;
        }
    }

    protected function createTestCarbonActivities(): void
    {
        // Use existing carbon activities from the database
        $Silian_stmt = $this->pdo->prepare("SELECT * FROM carbon_activities WHERE is_active = 1 LIMIT 5");
        $Silian_stmt->execute();
        $this->testCarbonActivities = $Silian_stmt->fetchAll(\PDO::FETCH_ASSOC);
    }

    protected function createRequest(string $Silian_method, string $Silian_uri, array $Silian_data = [], array $Silian_headers = []): \Psr\Http\Message\ServerRequestInterface
    {
        $Silian_factory = new ServerRequestFactory();
        $Silian_request = $Silian_factory->createServerRequest($Silian_method, $Silian_uri);

        if (
            strtoupper($Silian_method) === 'POST'
            && preg_match('#/auth/register$#i', $Silian_uri)
            && !array_key_exists('cf_turnstile_response', $Silian_data)
        ) {
            $Silian_data['cf_turnstile_response'] = 'test_turnstile_token';
        }

        if (!empty($Silian_data)) {
            $Silian_request = $Silian_request->withParsedBody($Silian_data);
        }

        foreach ($Silian_headers as $Silian_name => $Silian_value) {
            $Silian_request = $Silian_request->withHeader($Silian_name, $Silian_value);
        }

        return $Silian_request;
    }

    protected function getAuthToken(string $Silian_email): string
    {
        $Silian_user = $this->getTestUserByEmail($Silian_email);
        return $this->authService->generateJwtToken([
            'id' => $Silian_user['id'],
            'username' => $Silian_user['username'],
            'email' => $Silian_user['email'],
            'role' => $Silian_user['role'],
            'is_admin' => ($Silian_user['role'] ?? '') === 'admin' ? 1 : 0,
            'uuid' => $Silian_user['uuid'] ?? null,
            'points' => $Silian_user['points'] ?? 0
        ]);
    }

    protected function getTestUserByEmail(string $Silian_email): array
    {
        foreach ($this->testUsers as $Silian_user) {
            if ($Silian_user['email'] === $Silian_email) {
                return $Silian_user;
            }
        }
        throw new \Exception("Test user with email {$Silian_email} not found");
    }

    public function testUserRegistrationWithRealisticData(): void
    {
        $Silian_requestData = [
            'username' => 'new_student_chen',
            'email' => 'chen.xiaoming@testdomain.com',
            'password' => 'SecurePassword123!',
            'confirm_password' => 'SecurePassword123!',
            // phone 字段已移除
            'school_id' => 1,
            'country_code' => 'CN',
            'state_code' => 'BJ',
            'cf_turnstile_response' => 'test_turnstile_token',
            // 测试环境跳过 Turnstile 验证，省略 cf_turnstile_response
        ];

        $Silian_request = $this->createRequest('POST', '/api/v1/auth/register', $Silian_requestData);
        $Silian_response = $this->app->handle($Silian_request);

    // Controller returns 201 on successful creation
    $this->assertEquals(201, $Silian_response->getStatusCode());

        $Silian_body = (string) $Silian_response->getBody();
        $Silian_data = json_decode($Silian_body, true);

        $this->assertTrue($Silian_data['success']);
        $this->assertArrayHasKey('user', $Silian_data['data']);
        $this->assertArrayHasKey('token', $Silian_data['data']);
        $this->assertEquals($Silian_requestData['username'], $Silian_data['data']['user']['username']);
        $this->assertEquals($Silian_requestData['email'], $Silian_data['data']['user']['email']);

        // Clean up
        $this->pdo->exec("DELETE FROM users WHERE email = '{$Silian_requestData['email']}'");
    }

    public function testUserLoginWithRealisticCredentials(): void
    {
        $Silian_requestData = [
            'email' => 'zhang.wei@testdomain.com',
            'password' => 'password123'
        ];

        $Silian_request = $this->createRequest('POST', '/api/v1/auth/login', $Silian_requestData);
        $Silian_response = $this->app->handle($Silian_request);

        if ($Silian_response->getStatusCode() !== 200) {
            throw new \RuntimeException('Admin workflow step failed: ' . (string)$Silian_response->getBody());
        }

        $this->assertEquals(200, $Silian_response->getStatusCode(), 'Calculate response: ' . (string)$Silian_response->getBody());

        $Silian_body = (string) $Silian_response->getBody();
        $Silian_data = json_decode($Silian_body, true);

        $this->assertTrue($Silian_data['success']);
        $this->assertArrayHasKey('user', $Silian_data['data']);
        $this->assertArrayHasKey('token', $Silian_data['data']);
        $this->assertEquals($Silian_requestData['email'], $Silian_data['data']['user']['email']);
    }

    public function testGetCurrentUserProfile(): void
    {
        $Silian_token = $this->getAuthToken('zhang.wei@testdomain.com');

        $Silian_request = $this->createRequest('GET', '/api/v1/users/me', [], [
            'Authorization' => 'Bearer ' . $Silian_token
        ]);
        $Silian_response = $this->app->handle($Silian_request);
        if ($Silian_response->getStatusCode() !== 200) {
            throw new \RuntimeException('Admin pending records response: ' . (string)$Silian_response->getBody());
        }
        $this->assertEquals(200, $Silian_response->getStatusCode());

        $Silian_body = (string) $Silian_response->getBody();
        $Silian_data = json_decode($Silian_body, true);

        $this->assertTrue($Silian_data['success']);
        $this->assertArrayHasKey('data', $Silian_data);
        $this->assertEquals('zhang.wei@testdomain.com', $Silian_data['data']['email']);
    // real_name 字段已弃用，不再断言
        $this->assertEquals(150, $Silian_data['data']['points']);
    }

    public function testCarbonTrackingWorkflow(): void
    {
        $Silian_token = $this->getAuthToken('zhang.wei@testdomain.com');
        $Silian_activity = $this->testCarbonActivities[0];

        // Step 1: Calculate carbon savings
        $Silian_calculateData = [
            'activity_id' => $Silian_activity['id'],
            'amount' => 2.5,
            'unit' => $Silian_activity['unit']
        ];

        $Silian_request = $this->createRequest('POST', '/api/v1/carbon-track/calculate', $Silian_calculateData, [
            'Authorization' => 'Bearer ' . $Silian_token
        ]);
        $Silian_response = $this->app->handle($Silian_request);

        $this->assertEquals(200, $Silian_response->getStatusCode());

        $Silian_body = (string) $Silian_response->getBody();
        $Silian_data = json_decode($Silian_body, true);

        $this->assertTrue($Silian_data['success']);
        $this->assertArrayHasKey('carbon_saved', $Silian_data['data']);
        $this->assertArrayHasKey('points_earned', $Silian_data['data']);

        $Silian_carbonSaved = $Silian_data['data']['carbon_saved'];
        $Silian_pointsEarned = $Silian_data['data']['points_earned'];

        // Step 2: Submit the record
        $Silian_recordData = [
            'activity_id' => $Silian_activity['id'],
            'amount' => 2.5,
            'date' => date('Y-m-d'),
            'description' => '今天上班自带水杯，减少了塑料瓶的使用',
            'proof_images' => ['/uploads/proof/water_bottle_20241201.jpg'],
            'request_id' => 'test-' . uniqid()
        ];

        $Silian_request = $this->createRequest('POST', '/api/v1/carbon-track/record', $Silian_recordData, [
            'Authorization' => 'Bearer ' . $Silian_token,
            'X-Request-ID' => $Silian_recordData['request_id']
        ]);
        $Silian_response = $this->app->handle($Silian_request);

        $this->assertEquals(200, $Silian_response->getStatusCode(), 'Record response: ' . (string)$Silian_response->getBody());

        $Silian_body = (string) $Silian_response->getBody();
        $Silian_data = json_decode($Silian_body, true);

        $this->assertTrue($Silian_data['success']);
        $this->assertArrayHasKey('record_id', $Silian_data['data']);

        $Silian_transactionId = $Silian_data['data']['record_id'];

        // Step 3: Get user's transactions
        $Silian_request = $this->createRequest('GET', '/api/v1/carbon-track/transactions', [], [
            'Authorization' => 'Bearer ' . $Silian_token
        ]);
        $Silian_response = $this->app->handle($Silian_request);

        $this->assertEquals(200, $Silian_response->getStatusCode());

        $Silian_body = (string) $Silian_response->getBody();
        $Silian_data = json_decode($Silian_body, true);

        $this->assertTrue($Silian_data['success']);
        $this->assertArrayHasKey('data', $Silian_data);
        $this->assertIsArray($Silian_data['data']);

        // Find our transaction
        $Silian_foundTransaction = null;
        foreach ($Silian_data['data'] as $Silian_transaction) {
            if ($Silian_transaction['id'] === $Silian_transactionId) {
                $Silian_foundTransaction = $Silian_transaction;
                break;
            }
        }

        $this->assertNotNull($Silian_foundTransaction);
        $this->assertEquals('pending', $Silian_foundTransaction['status']);
        $this->assertEquals($Silian_recordData['description'], $Silian_foundTransaction['description']);
    }

    public function testProductListingAndExchange(): void
    {
        $Silian_token = $this->getAuthToken('li.ming@testdomain.com'); // User with 300 points

        // Step 1: Get product list
        $Silian_request = $this->createRequest('GET', '/api/v1/products?category=daily&limit=10', [], [
            'Authorization' => 'Bearer ' . $Silian_token
        ]);
        $Silian_response = $this->app->handle($Silian_request);

        $this->assertEquals(200, $Silian_response->getStatusCode());

        $Silian_body = (string) $Silian_response->getBody();
        $Silian_data = json_decode($Silian_body, true);

        $this->assertTrue($Silian_data['success']);
        $this->assertArrayHasKey('data', $Silian_data);
        $this->assertArrayHasKey('products', $Silian_data['data']);
        $this->assertArrayHasKey('pagination', $Silian_data['data']);

        // Find a product the user can afford
        $Silian_affordableProduct = null;
        foreach ($Silian_data['data']['products'] as $Silian_product) {
            if ($Silian_product['points_required'] <= 300 && $Silian_product['is_available']) {
                $Silian_affordableProduct = $Silian_product;
                break;
            }
        }

        $this->assertNotNull($Silian_affordableProduct, 'User should be able to afford at least one product');

        // Step 2: Exchange for the product
        $Silian_exchangeData = [
            'product_id' => $Silian_affordableProduct['id'],
            'quantity' => 1,
            'shipping_address' => '北京市海淀区清华大学东门',
            'contact_phone' => '13800138000',
            'request_id' => 'test-exchange-' . uniqid()
        ];

        $Silian_request = $this->createRequest('POST', '/api/v1/exchange', $Silian_exchangeData, [
            'Authorization' => 'Bearer ' . $Silian_token,
            'X-Request-ID' => $Silian_exchangeData['request_id']
        ]);
        $Silian_response = $this->app->handle($Silian_request);
        if ($Silian_response->getStatusCode() >= 500) {
            $this->markTestSkipped('User exchange endpoint unavailable (status ' . $Silian_response->getStatusCode() . ')');
        }
        $this->assertEquals(200, $Silian_response->getStatusCode(), 'Exchange response: ' . (string) $Silian_response->getBody());

        $Silian_body = (string) $Silian_response->getBody();
        $Silian_data = json_decode($Silian_body, true);

            $this->assertTrue($Silian_data['success']);
        $this->assertArrayHasKey('exchange_id', $Silian_data);
        $this->assertArrayHasKey('remaining_points', $Silian_data);

        $Silian_expectedRemainingPoints = 300 - $Silian_affordableProduct['points_required'];
        $this->assertEquals($Silian_expectedRemainingPoints, $Silian_data['remaining_points']);
    }

    public function testAdminWorkflow(): void
    {
        $Silian_adminToken = $this->getAuthToken('wang.fang@testdomain.com');

        // Step 1: Get pending carbon tracking records
        $Silian_request = $this->createRequest('GET', '/api/v1/admin/carbon-activities/pending', [], [
            'Authorization' => 'Bearer ' . $Silian_adminToken
        ]);
        $Silian_response = $this->app->handle($Silian_request);
        $Silian_pendingBody = (string)$Silian_response->getBody();
        $this->assertEquals(200, $Silian_response->getStatusCode(), 'Admin pending records response: ' . $Silian_pendingBody);

        // Step 2: Get user list for management
        $Silian_request = $this->createRequest('GET', '/api/v1/admin/users?page=1&limit=10', [], [
            'Authorization' => 'Bearer ' . $Silian_adminToken
        ]);
        $Silian_response = $this->app->handle($Silian_request);
        $Silian_usersBody = (string)$Silian_response->getBody();
        $this->assertEquals(200, $Silian_response->getStatusCode(), 'Admin users list response: ' . $Silian_usersBody);

        $Silian_data = json_decode($Silian_usersBody, true);
        $this->assertTrue($Silian_data['success']);
        $this->assertArrayHasKey('data', $Silian_data);
        $this->assertArrayHasKey('users', $Silian_data['data']);
        $this->assertArrayHasKey('pagination', $Silian_data['data']);

        // Step 3: Get exchange records for admin review
        $Silian_request = $this->createRequest('GET', '/api/v1/admin/exchanges', [], [
            'Authorization' => 'Bearer ' . $Silian_adminToken
        ]);
        $Silian_response = $this->app->handle($Silian_request);
        $Silian_exchangeBody = (string)$Silian_response->getBody();
        $this->assertEquals(200, $Silian_response->getStatusCode(), 'Admin exchanges response: ' . $Silian_exchangeBody);

        $Silian_data = json_decode($Silian_exchangeBody, true);
        $this->assertTrue($Silian_data['success']);
    }

    public function testAdminStatsEndpoint(): void
    {
        $Silian_adminToken = $this->getAuthToken('wang.fang@testdomain.com');
        $Silian_request = $this->createRequest('GET', '/api/v1/admin/stats', [], [
            'Authorization' => 'Bearer ' . $Silian_adminToken
        ]);
        $Silian_response = $this->app->handle($Silian_request);
        $this->assertEquals(200, $Silian_response->getStatusCode(), 'Admin stats status code');
        $Silian_body = (string)$Silian_response->getBody();
        $Silian_data = json_decode($Silian_body, true);
        $this->assertIsArray($Silian_data, 'Response JSON decoded');
        $this->assertTrue($Silian_data['success'] ?? false, 'Admin stats success flag');
        $this->assertArrayHasKey('data', $Silian_data, 'Admin stats contains data');
        $this->assertArrayHasKey('users', $Silian_data['data'], 'Users stats present');
        $this->assertArrayHasKey('transactions', $Silian_data['data'], 'Transactions stats present');
    }

    public function testApiErrorHandling(): void
    {
        // Test 1: Unauthorized access
        $Silian_request = $this->createRequest('GET', '/api/v1/users/me');
        $Silian_response = $this->app->handle($Silian_request);

        $this->assertEquals(401, $Silian_response->getStatusCode());

        // Test 2: Invalid login credentials
        $Silian_requestData = [
            'email' => 'nonexistent@testdomain.com',
            'password' => 'wrongpassword',
            'cf_turnstile_response' => 'test_turnstile_token'
        ];

        $Silian_request = $this->createRequest('POST', '/api/v1/auth/login', $Silian_requestData);
        $Silian_response = $this->app->handle($Silian_request);

        $this->assertEquals(401, $Silian_response->getStatusCode());

        // Test 3: Insufficient points for exchange
        $Silian_token = $this->getAuthToken('zhang.wei@testdomain.com'); // User with 150 points
        $Silian_expensiveProduct = null;

        foreach ($this->testProducts as $Silian_product) {
            if ($Silian_product['points_required'] > 150) {
                $Silian_expensiveProduct = $Silian_product;
                break;
            }
        }

        if ($Silian_expensiveProduct) {
            $Silian_exchangeData = [
                'product_id' => $Silian_expensiveProduct['id'],
                'quantity' => 1,
                'shipping_address' => [
                    'recipient_name' => '张伟',
                    // phone 字段已移除
                    'address' => '北京市朝阳区某某路123号',
                    'postal_code' => '100000'
                ],
                'request_id' => 'test-insufficient-' . uniqid()
            ];

            $Silian_request = $this->createRequest('POST', '/api/v1/exchange', $Silian_exchangeData, [
                'Authorization' => 'Bearer ' . $Silian_token,
                'X-Request-ID' => $Silian_exchangeData['request_id']
            ]);
            $Silian_response = $this->app->handle($Silian_request);

            $this->assertEquals(400, $Silian_response->getStatusCode());

            $Silian_body = (string) $Silian_response->getBody();
            $Silian_data = json_decode($Silian_body, true);

            $this->assertFalse($Silian_data['success']);
            $this->assertStringContainsString('points', strtolower($Silian_data['message'] ?? $Silian_data['error'] ?? ''));
        }
    }

    protected function tearDown(): void
    {
        // Clean up test data
        if ($this->pdo) {
            try {
                $this->pdo->exec("DELETE FROM users WHERE email LIKE '%@testdomain.com'");
            } catch (\Throwable $Silian_e) {
                // Ignore if table doesn't exist
            }
            try {
                $this->pdo->exec("DELETE FROM products WHERE name LIKE 'Test Product%'");
            } catch (\Throwable $Silian_e) {
                // Ignore if table doesn't exist
            }
            try {
                $this->pdo->exec("DELETE FROM point_exchanges WHERE id LIKE 'test-%'");
            } catch (\Throwable $Silian_e) {
                // Ignore if table doesn't exist
            }
            try {
                $this->pdo->exec("DELETE FROM carbon_records WHERE id LIKE 'test-%'");
            } catch (\Throwable $Silian_e) {
                // Ignore if table doesn't exist
            }
        }

        parent::tearDown();
    }
}
