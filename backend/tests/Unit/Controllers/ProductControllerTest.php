<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Controllers;

use PHPUnit\Framework\TestCase;
use CarbonTrack\Controllers\ProductController;

class ProductControllerTest extends TestCase
{
    public function testControllerClassExists(): void
    {
        $this->assertTrue(class_exists(ProductController::class));
    }

    public function testGetProductsReturnsJson(): void
    {
        // Mocks
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);

        // count statement
        $Silian_countStmt = $this->createMock(\PDOStatement::class);
        $Silian_countStmt->method('execute')->willReturn(true);
        $Silian_countStmt->method('fetch')->willReturn(['total' => 1]);

        // list statement
        $Silian_listStmt = $this->createMock(\PDOStatement::class);
        $Silian_listStmt->method('bindValue')->willReturn(true);
        $Silian_listStmt->method('execute')->willReturn(true);
        $Silian_listStmt->method('fetchAll')->willReturn([
            [
                'id' => 1,
                'name' => 'Eco Bottle',
                'description' => 'Nice',
                'images' => json_encode(['/a.png']),
                'stock' => 10,
                'points_required' => 100,
                'status' => 'active'
            ]
        ]);

        $Silian_tagStmt = $this->createMock(\PDOStatement::class);
        $Silian_tagStmt->method('execute')->willReturn(true);
        $Silian_tagStmt->method('fetchAll')->willReturn([
            ['product_id' => 1, 'id' => 7, 'name' => 'Popular', 'slug' => 'popular']
        ]);

        // prepare returns count then list then tags
        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_countStmt, $Silian_listStmt, $Silian_tagStmt);

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth);

        $Silian_request = makeRequest('GET', '/products');
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->getProducts($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(1, $Silian_json['data']['pagination']['total']);
        $this->assertEquals('Eco Bottle', $Silian_json['data']['products'][0]['name']);
        $this->assertIsArray($Silian_json['data']['products'][0]['images']);
        $this->assertEquals('a.png', $Silian_json['data']['products'][0]['images'][0]['file_path'] ?? null);
        $this->assertTrue($Silian_json['data']['products'][0]['is_available']);
        $this->assertEquals('Popular', $Silian_json['data']['products'][0]['tags'][0]['name']);
    }

    public function testGetProductsUsesDistinctSearchBindings(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_listBound = [];
        $Silian_prepareCalls = 0;

        $Silian_countStmt = $this->createMock(\PDOStatement::class);
        $Silian_countStmt->expects($this->once())
            ->method('execute')
            ->with([
                'search_name' => '%eco%',
                'search_description' => '%eco%',
            ])
            ->willReturn(true);
        $Silian_countStmt->expects($this->once())->method('fetch')->willReturn(['total' => 0]);

        $Silian_listStmt = $this->createMock(\PDOStatement::class);
        $Silian_listStmt->expects($this->exactly(4))
            ->method('bindValue')
            ->willReturnCallback(function (string $Silian_key, $Silian_value, ?int $Silian_type = null) use (&$Silian_listBound) {
                $Silian_listBound[$Silian_key] = [$Silian_value, $Silian_type];
                return true;
            });
        $Silian_listStmt->expects($this->once())->method('execute')->willReturn(true);
        $Silian_listStmt->expects($this->once())->method('fetchAll')->willReturn([]);

        $Silian_pdo->expects($this->exactly(2))
            ->method('prepare')
            ->willReturnCallback(function (string $Silian_sql) use (&$Silian_prepareCalls, $Silian_countStmt, $Silian_listStmt) {
                $Silian_prepareCalls++;
                $this->assertStringContainsString('p.name LIKE :search_name', $Silian_sql);
                $this->assertStringContainsString('p.description LIKE :search_description', $Silian_sql);

                return $Silian_prepareCalls === 1 ? $Silian_countStmt : $Silian_listStmt;
            });

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/products', null, ['search' => 'eco']);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->getProducts($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());

        $this->assertSame('%eco%', $Silian_listBound['search_name'][0] ?? null);
        $this->assertSame('%eco%', $Silian_listBound['search_description'][0] ?? null);
        $this->assertSame(20, $Silian_listBound['limit'][0] ?? null);
        $this->assertSame(\PDO::PARAM_INT, $Silian_listBound['limit'][1] ?? null);
        $this->assertSame(0, $Silian_listBound['offset'][0] ?? null);
        $this->assertSame(\PDO::PARAM_INT, $Silian_listBound['offset'][1] ?? null);
    }

    public function testGetProductDetail(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);

        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_stmt->method('fetch')->willReturn([
            'id'=>1,'name'=>'Eco Bottle','images'=>json_encode(['/a.png']),'stock'=>5,'points_required'=>100
        ]);
        $Silian_tagStmt = $this->createMock(\PDOStatement::class);
        $Silian_tagStmt->method('execute')->willReturn(true);
        $Silian_tagStmt->method('fetchAll')->willReturn([
            ['product_id' => 1, 'id' => 3, 'name' => 'Eco', 'slug' => 'eco']
        ]);

        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_stmt, $Silian_tagStmt);

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/products/1');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getProductDetail($Silian_request, $Silian_response, ['id'=>1]);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_data = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_data['success']);
        $this->assertEquals('Eco Bottle', $Silian_data['data']['name']);
        $this->assertEquals('Eco', $Silian_data['data']['tags'][0]['name']);
    }

    public function testSearchProductTags(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);

        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('bindValue')->willReturn(true);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_stmt->method('fetchAll')->willReturn([
            ['id' => 1, 'name' => 'Eco', 'slug' => 'eco'],
            ['id' => 2, 'name' => 'Campus', 'slug' => 'campus'],
        ]);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/products/tags', null, ['search' => 'eco']);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->searchProductTags($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertCount(2, $Silian_json['data']['tags']);
        $this->assertEquals('eco', $Silian_json['data']['tags'][0]['slug']);
    }

    public function testSearchProductTagsUsesDistinctSearchBindings(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_bound = [];

        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->expects($this->exactly(3))
            ->method('bindValue')
            ->willReturnCallback(function (string $Silian_key, $Silian_value, ?int $Silian_type = null) use (&$Silian_bound) {
                $Silian_bound[$Silian_key] = [$Silian_value, $Silian_type];
                return true;
            });
        $Silian_stmt->expects($this->once())->method('execute')->willReturn(true);
        $Silian_stmt->expects($this->once())->method('fetchAll')->willReturn([]);

        $Silian_pdo->expects($this->once())
            ->method('prepare')
            ->with($this->callback(static function (string $Silian_sql): bool {
                return str_contains($Silian_sql, 'name LIKE :search_name')
                    && str_contains($Silian_sql, 'slug LIKE :search_slug')
                    && !str_contains($Silian_sql, 'slug LIKE :search ');
            }))
            ->willReturn($Silian_stmt);

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/products/tags', null, ['search' => 'eco']);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->searchProductTags($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $this->assertSame('%eco%', $Silian_bound['search_name'][0] ?? null);
        $this->assertSame('%eco%', $Silian_bound['search_slug'][0] ?? null);
        $this->assertSame(20, $Silian_bound['limit'][0] ?? null);
        $this->assertSame(\PDO::PARAM_INT, $Silian_bound['limit'][1] ?? null);
    }

    public function testExchangeProductInsufficientStock(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>1,'username'=>'u','points'=>1000]);

        // product select FOR UPDATE
        $Silian_select = $this->createMock(\PDOStatement::class);
        $Silian_select->method('execute')->willReturn(true);
        $Silian_select->method('fetch')->willReturn(['id'=>2,'name'=>'Gift','status'=>'active','stock'=>0,'points_required'=>50]);
        $Silian_pdo->method('beginTransaction')->willReturn(true);
        $Silian_pdo->method('rollBack')->willReturn(true);
        $Silian_pdo->method('prepare')->willReturn($Silian_select);

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('POST', '/exchange', ['product_id'=>2, 'quantity'=>1]);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->exchangeProduct($Silian_request, $Silian_response);
        $this->assertEquals(400, $Silian_resp->getStatusCode());
        $Silian_data = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertEquals('Insufficient stock', $Silian_data['error']);
    }

    public function testExchangeProductInsufficientPoints(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>1,'username'=>'u','points'=>10]);

        $Silian_select = $this->createMock(\PDOStatement::class);
        $Silian_select->method('execute')->willReturn(true);
        $Silian_select->method('fetch')->willReturn(['id'=>2,'name'=>'Gift','status'=>'active','stock'=>10,'points_required'=>50]);
        $Silian_pdo->method('beginTransaction')->willReturn(true);
        $Silian_pdo->method('rollBack')->willReturn(true);
        $Silian_pdo->method('prepare')->willReturn($Silian_select);

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('POST', '/exchange', ['product_id'=>2, 'quantity'=>1]);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->exchangeProduct($Silian_request, $Silian_response);
        $this->assertEquals(400, $Silian_resp->getStatusCode());
        $Silian_data = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertEquals('Insufficient points', $Silian_data['error']);
    }

    public function testExchangeProductSuccessFlow(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_messageService->expects($this->once())->method('sendMessage');
        $Silian_messageService->expects($this->once())
            ->method('sendExchangeConfirmationEmailToUser')
            ->with(
                $this->equalTo(1),
                $this->equalTo('Gift'),
                $this->equalTo(2),
                $this->equalTo(100.0),
                $this->equalTo(null),
                $this->equalTo('u')
            );
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>1,'username'=>'u','points'=>1000]);

        // product select
        $Silian_select = $this->createMock(\PDOStatement::class);
        $Silian_select->method('execute')->willReturn(true);
        $Silian_select->method('fetch')->willReturn(['id'=>2,'name'=>'Gift','status'=>'active','stock'=>10,'points_required'=>50]);
        // update user points
        $Silian_updateUser = $this->createMock(\PDOStatement::class);
        $Silian_updateUser->method('execute')->willReturn(true);
        // update stock
        $Silian_updateStock = $this->createMock(\PDOStatement::class);
        $Silian_updateStock->method('execute')->willReturn(true);
        // insert exchange record
        $Silian_insertExchange = $this->createMock(\PDOStatement::class);
        $Silian_insertExchange->method('execute')->willReturn(true);
        // insert points transaction
        $Silian_insertTxn = $this->createMock(\PDOStatement::class);
        $Silian_insertTxn->method('execute')->willReturn(true);
        // select admins to notify
        $Silian_selectAdmins = $this->createMock(\PDOStatement::class);
        $Silian_selectAdmins->method('execute')->willReturn(true);
        $Silian_selectAdmins->method('fetchAll')->willReturn([['id'=>9]]);

        $Silian_pdo->method('beginTransaction')->willReturn(true);
        $Silian_pdo->method('commit')->willReturn(true);
        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls(
            $Silian_select,
            $Silian_updateUser,
            $Silian_updateStock,
            $Silian_insertExchange,
            $Silian_insertTxn,
            $Silian_selectAdmins,
            $Silian_selectAdmins,
            $Silian_selectAdmins
        );

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('POST', '/exchange', ['product_id'=>2, 'quantity'=>2]);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->exchangeProduct($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(100, $Silian_json['points_used']);
    }

    public function testGetCategories(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);

        $Silian_categoryStmt = $this->createMock(\PDOStatement::class);
        $Silian_categoryStmt->method('execute')->willReturn(true);
        $Silian_categoryStmt->method('bindValue')->willReturn(true);
        $Silian_categoryStmt->method('fetchAll')->willReturn([
            ['id' => 1, 'name' => 'Eco Living', 'slug' => 'eco-living', 'product_count' => 5]
        ]);

        $Silian_fallbackStmt = $this->createMock(\PDOStatement::class);
        $Silian_fallbackStmt->method('execute')->willReturn(true);
        $Silian_fallbackStmt->method('bindValue')->willReturn(true);
        $Silian_fallbackStmt->method('fetchAll')->willReturn([
            ['name' => '社区种子', 'slug' => null, 'product_count' => 3]
        ]);

        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_categoryStmt, $Silian_fallbackStmt);

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/products/categories', null, ['limit' => 10]);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_resp = $Silian_controller->getCategories($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_data = json_decode((string) $Silian_resp->getBody(), true);
        $this->assertTrue($Silian_data['success']);
        $this->assertArrayHasKey('categories', $Silian_data['data']);
        $this->assertCount(2, $Silian_data['data']['categories']);
        $Silian_names = array_column($Silian_data['data']['categories'], 'name');
        $this->assertContains('Eco Living', $Silian_names);
        $this->assertContains('社区种子', $Silian_names);
    }

    public function testGetExchangeRecordsRequiresAdmin(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>1]);
        $Silian_auth->method('isAdminUser')->willReturn(false);

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/admin/exchanges');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getExchangeRecords($Silian_request, $Silian_response);
        $this->assertEquals(403, $Silian_resp->getStatusCode());
    }

    public function testGetExchangeRecordsSuccess(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>9]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_countStmt = $this->createMock(\PDOStatement::class);
        $Silian_countStmt->method('execute')->willReturn(true);
        $Silian_countStmt->method('fetch')->willReturn(['total'=>1]);

        $Silian_listStmt = $this->createMock(\PDOStatement::class);
        $Silian_listStmt->method('bindValue')->willReturn(true);
        $Silian_listStmt->method('execute')->willReturn(true);
        $Silian_listStmt->method('fetchAll')->willReturn([
            ['id'=>'e1','user_id'=>1,'status'=>'pending']
        ]);

        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_countStmt, $Silian_listStmt);

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/admin/exchanges');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getExchangeRecords($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(1, $Silian_json['pagination']['total']);
    }

    public function testGetExchangeRecordsSearchUsesDistinctBindings(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 9]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_countStmt = $this->createMock(\PDOStatement::class);
        $Silian_countStmt->expects($this->once())
            ->method('execute')
            ->with($this->callback(function ($Silian_params) {
                foreach (['exchange_search_0', 'exchange_search_1', 'exchange_search_2', 'exchange_search_3', 'exchange_search_4', 'exchange_search_5'] as $Silian_key) {
                    if (!array_key_exists($Silian_key, $Silian_params)) {
                        return false;
                    }
                }
                return !array_key_exists('search', $Silian_params);
            }))
            ->willReturn(true);
        $Silian_countStmt->method('fetch')->willReturn(['total' => 0]);

        $Silian_listStmt = $this->createMock(\PDOStatement::class);
        $Silian_listStmt->method('bindValue')->willReturn(true);
        $Silian_listStmt->method('execute')->willReturn(true);
        $Silian_listStmt->method('fetchAll')->willReturn([]);

        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_countStmt, $Silian_listStmt);

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/admin/exchanges', null, ['search' => '599ef56d-13ad-47ee-8f91-beb85d2d3b67']);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getExchangeRecords($Silian_request, $Silian_response);

        $this->assertEquals(200, $Silian_resp->getStatusCode());
    }

    public function testUpdateExchangeStatusInvalid(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>9]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('PUT', '/admin/exchanges/e1/status', ['status' => 'unknown']);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->updateExchangeStatus($Silian_request, $Silian_response, ['id' => 'e1']);
        $this->assertEquals(400, $Silian_resp->getStatusCode());
    }

    public function testUpdateExchangeStatusSuccess(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_messageService->expects($this->once())->method('sendMessage');
        $Silian_messageService->expects($this->once())
            ->method('sendExchangeStatusUpdateEmailToUser')
            ->with(
                $this->equalTo(1),
                $this->equalTo('Gift'),
                $this->equalTo('shipped'),
                $this->equalTo('T123'),
                $this->equalTo(null),
                $this->equalTo(null),
                $this->equalTo(null)
            );
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>9]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_update = $this->createMock(\PDOStatement::class);
        $Silian_update->method('execute')->willReturn(true);
        $Silian_select = $this->createMock(\PDOStatement::class);
        $Silian_select->method('execute')->willReturn(true);
        $Silian_select->method('fetch')->willReturn(['id'=>'e1','user_id'=>1,'product_name'=>'Gift','quantity'=>1]);

        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_update, $Silian_select);

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('PUT', '/admin/exchanges/e1/status', ['status' => 'shipped', 'tracking_number' => 'T123']);
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->updateExchangeStatus($Silian_request, $Silian_response, ['id' => 'e1']);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
    }

    public function testGetUserExchangesSuccess(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>5]);

        $Silian_countStmt = $this->createMock(\PDOStatement::class);
        $Silian_countStmt->method('execute')->willReturn(true);
        $Silian_countStmt->method('fetch')->willReturn(['total'=>1]);

        $Silian_listStmt = $this->createMock(\PDOStatement::class);
        $Silian_listStmt->method('bindValue')->willReturn(true);
        $Silian_listStmt->method('execute')->willReturn(true);
        $Silian_listStmt->method('fetchAll')->willReturn([
            ['id'=>'e1','current_product_images'=>null]
        ]);

        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_countStmt, $Silian_listStmt);

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/exchange/transactions');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getUserExchanges($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(1, $Silian_json['pagination']['total']);
    }

    public function testGetExchangeRecordDetailSuccess(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>9]);
        $Silian_auth->method('isAdminUser')->willReturn(true);

        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_stmt->method('fetch')->willReturn(['id'=>'e1','user_id'=>1,'product_name'=>'Gift']);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/admin/exchanges/e1');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getExchangeRecordDetail($Silian_request, $Silian_response, ['id' => 'e1']);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals('e1', $Silian_json['data']['id']);
    }

    public function testGetExchangeTransactionsAliasSuccess(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>5]);

        $Silian_countStmt = $this->createMock(\PDOStatement::class);
        $Silian_countStmt->method('execute')->willReturn(true);
        $Silian_countStmt->method('fetch')->willReturn(['total'=>1]);

        $Silian_listStmt = $this->createMock(\PDOStatement::class);
        $Silian_listStmt->method('bindValue')->willReturn(true);
        $Silian_listStmt->method('execute')->willReturn(true);
        $Silian_listStmt->method('fetchAll')->willReturn([
            ['id'=>'e1','current_product_images'=>null]
        ]);

        $Silian_pdo->method('prepare')->willReturnOnConsecutiveCalls($Silian_countStmt, $Silian_listStmt);

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/exchange/transactions');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getExchangeTransactions($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals(1, $Silian_json['pagination']['total']);
    }

    public function testGetExchangeTransactionDetailSuccess(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id'=>5]);

        $Silian_stmt = $this->createMock(\PDOStatement::class);
        $Silian_stmt->method('execute')->willReturn(true);
        $Silian_stmt->method('fetch')->willReturn(['id'=>'e1','user_id'=>5,'product_name'=>'Gift']);
        $Silian_pdo->method('prepare')->willReturn($Silian_stmt);

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth);
        $Silian_request = makeRequest('GET', '/exchange/transactions/e1');
        $Silian_response = new \Slim\Psr7\Response();
        $Silian_resp = $Silian_controller->getExchangeTransaction($Silian_request, $Silian_response, ['id' => 'e1']);
        $this->assertEquals(200, $Silian_resp->getStatusCode());
        $Silian_json = json_decode((string)$Silian_resp->getBody(), true);
        $this->assertTrue($Silian_json['success']);
        $this->assertEquals('e1', $Silian_json['data']['id']);
    }

    public function testCreateProductCreatesCategoryAndPersistsSlug(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        if (method_exists($Silian_pdo, 'sqliteCreateFunction')) {
            $Silian_pdo->sqliteCreateFunction('NOW', function () {
                return date('Y-m-d H:i:s');
            });
        }

        $Silian_pdo->exec('CREATE TABLE product_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT, created_at TEXT)');
        $Silian_pdo->exec('CREATE TABLE product_tags (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT, slug TEXT, description TEXT)');
        $Silian_pdo->exec('CREATE TABLE product_tag_map (product_id INTEGER, tag_id INTEGER, created_at TEXT)');
        $Silian_pdo->exec('CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT,
            category_slug TEXT,
            points_required INTEGER NOT NULL,
            description TEXT,
            image_path TEXT,
            images TEXT,
            stock INTEGER NOT NULL,
            status TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT,
            updated_at TEXT,
            deleted_at TEXT
        )');

        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_audit->expects($this->once())->method('log');
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_auth->method('getCurrentUser')->willReturn(['id' => 99]);
        $Silian_auth->method('isAdminUser')->willReturn(true);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);
        $Silian_capturedException = null;
        $Silian_errorLog->expects($this->any())
            ->method('logException')
            ->willReturnCallback(function ($Silian_exception) use (&$Silian_capturedException) {
                $Silian_capturedException = $Silian_exception;
            });

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth, $Silian_errorLog);

        $Silian_request = makeRequest('POST', '/admin/products', [
            'name' => 'Reusable Cup',
            'description' => 'Great for the office',
            'points_required' => 120,
            'stock' => 25,
            'category' => [
                'name' => 'Office Supplies',
                'slug' => 'office-supplies'
            ],
            'tags' => []
        ]);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_result = $Silian_controller->createProduct($Silian_request, $Silian_response);
        if ($Silian_result->getStatusCode() !== 201) {
            $Silian_details = $Silian_capturedException instanceof \Throwable ? $Silian_capturedException->getMessage() : 'no exception captured';
            $this->fail('Unexpected response: ' . (string) $Silian_result->getBody() . ' (reason: ' . $Silian_details . ')');
        }
        $Silian_payload = json_decode((string) $Silian_result->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertNotEmpty($Silian_payload['id']);

        $Silian_categoryRow = $Silian_pdo->query('SELECT name, slug FROM product_categories LIMIT 1')->fetch(\PDO::FETCH_ASSOC);
        $this->assertSame('Office Supplies', $Silian_categoryRow['name']);
        $this->assertSame('office-supplies', $Silian_categoryRow['slug']);

        $Silian_productRow = $Silian_pdo->query('SELECT category, category_slug FROM products LIMIT 1')->fetch(\PDO::FETCH_ASSOC);
        $this->assertSame('Office Supplies', $Silian_productRow['category']);
        $this->assertSame('office-supplies', $Silian_productRow['category_slug']);
    }

    public function testGetCategoriesReturnsStructuredResponse(): void
    {
        $Silian_pdo = new \PDO('sqlite::memory:');
        $Silian_pdo->setAttribute(\PDO::ATTR_ERRMODE, \PDO::ERRMODE_EXCEPTION);
        if (method_exists($Silian_pdo, 'sqliteCreateFunction')) {
            $Silian_pdo->sqliteCreateFunction('NOW', function () {
                return date('Y-m-d H:i:s');
            });
        }

        $Silian_pdo->exec('CREATE TABLE product_categories (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, slug TEXT NOT NULL UNIQUE, description TEXT, created_at TEXT)');
        $Silian_pdo->exec('CREATE TABLE products (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            category TEXT,
            category_slug TEXT,
            points_required INTEGER NOT NULL,
            description TEXT,
            image_path TEXT,
            images TEXT,
            stock INTEGER NOT NULL,
            status TEXT,
            sort_order INTEGER DEFAULT 0,
            created_at TEXT,
            updated_at TEXT,
            deleted_at TEXT
        )');
        $Silian_pdo->exec("INSERT INTO product_categories (name, slug, created_at) VALUES ('Eco Living', 'eco-living', NOW())");
        $Silian_pdo->exec("INSERT INTO products (name, category, category_slug, points_required, description, image_path, images, stock, status, sort_order, created_at) VALUES ('Bottle', 'Eco Living', 'eco-living', 100, '', '', '[]', 10, 'active', 0, NOW())");
        $Silian_pdo->exec("INSERT INTO products (name, category, category_slug, points_required, description, image_path, images, stock, status, sort_order, created_at) VALUES ('DIY Kit', '手工材料', '', 200, '', '', '[]', 5, 'active', 0, NOW())");

        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);
        $Silian_errorLog->expects($this->any())->method('logException');

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth, $Silian_errorLog);

        $Silian_request = makeRequest('GET', '/products/categories', null, ['limit' => 10]);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_result = $Silian_controller->getCategories($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_result->getStatusCode(), 'Unexpected response: ' . (string) $Silian_result->getBody());
        $Silian_payload = json_decode((string) $Silian_result->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertArrayHasKey('categories', $Silian_payload['data']);

        $Silian_categories = $Silian_payload['data']['categories'];
        $this->assertNotEmpty($Silian_categories);

        $Silian_names = array_column($Silian_categories, 'name');
        $this->assertContains('Eco Living', $Silian_names);
        $this->assertContains('手工材料', $Silian_names);
    }

    public function testGetCategoriesUsesDistinctSearchBindings(): void
    {
        $Silian_pdo = $this->createMock(\PDO::class);
        $Silian_messageService = $this->createMock(\CarbonTrack\Services\MessageService::class);
        $Silian_audit = $this->createMock(\CarbonTrack\Services\AuditLogService::class);
        $Silian_auth = $this->createMock(\CarbonTrack\Services\AuthService::class);
        $Silian_errorLog = $this->createMock(\CarbonTrack\Services\ErrorLogService::class);
        $Silian_errorLog->expects($this->never())->method('logException');
        $Silian_categoryBound = [];
        $Silian_prepareCalls = 0;

        $Silian_categoryStmt = $this->createMock(\PDOStatement::class);
        $Silian_categoryStmt->expects($this->exactly(3))
            ->method('bindValue')
            ->willReturnCallback(function (string $Silian_key, $Silian_value, ?int $Silian_type = null) use (&$Silian_categoryBound) {
                $Silian_categoryBound[$Silian_key] = [$Silian_value, $Silian_type];
                return true;
            });
        $Silian_categoryStmt->expects($this->once())->method('execute')->willReturn(true);
        $Silian_categoryStmt->expects($this->once())->method('fetchAll')->willReturn([]);

        $Silian_fallbackStmt = $this->createMock(\PDOStatement::class);
        $Silian_fallbackStmt->expects($this->once())
            ->method('bindValue')
            ->with('fallback_limit', 20, \PDO::PARAM_INT)
            ->willReturn(true);
        $Silian_fallbackStmt->expects($this->once())->method('execute')->willReturn(true);
        $Silian_fallbackStmt->expects($this->once())->method('fetchAll')->willReturn([]);

        $Silian_pdo->expects($this->exactly(2))
            ->method('prepare')
            ->willReturnCallback(function (string $Silian_sql) use (&$Silian_prepareCalls, $Silian_categoryStmt, $Silian_fallbackStmt) {
                $Silian_prepareCalls++;
                if ($Silian_prepareCalls === 1) {
                    $this->assertStringContainsString('pc.name LIKE :search_name', $Silian_sql);
                    $this->assertStringContainsString('pc.slug LIKE :search_slug', $Silian_sql);
                    $this->assertStringNotContainsString('pc.slug LIKE :search ', $Silian_sql);
                    return $Silian_categoryStmt;
                }

                $this->assertStringContainsString('LIMIT :fallback_limit', $Silian_sql);
                return $Silian_fallbackStmt;
            });

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_audit, $Silian_auth, $Silian_errorLog);
        $Silian_request = makeRequest('GET', '/products/categories', null, ['search' => 'eco', 'limit' => 10]);
        $Silian_response = new \Slim\Psr7\Response();

        $Silian_result = $Silian_controller->getCategories($Silian_request, $Silian_response);
        $this->assertEquals(200, $Silian_result->getStatusCode(), 'Unexpected response: ' . (string) $Silian_result->getBody());
        $Silian_payload = json_decode((string) $Silian_result->getBody(), true);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame([], $Silian_payload['data']['categories']);
        $this->assertSame('%eco%', $Silian_categoryBound['search_name'][0] ?? null);
        $this->assertSame('%eco%', $Silian_categoryBound['search_slug'][0] ?? null);
        $this->assertSame(10, $Silian_categoryBound['limit'][0] ?? null);
        $this->assertSame(\PDO::PARAM_INT, $Silian_categoryBound['limit'][1] ?? null);
    }

}

