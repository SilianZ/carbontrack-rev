<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Integration;

use CarbonTrack\Controllers\ProductController;
use CarbonTrack\Models\Message;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\MessageService;
use Monolog\Handler\NullHandler;
use Monolog\Logger;
use PDO;
use PHPUnit\Framework\TestCase;
use Slim\Psr7\Response;

class ProductExchangeLegacySchemaTest extends TestCase
{
    private string $dbPath;

    protected function setUp(): void
    {
        parent::setUp();
        $Silian_tmp = tempnam(sys_get_temp_dir(), 'carbontrack_legacy_');
        if ($Silian_tmp !== false) {
            @unlink($Silian_tmp);
            $Silian_path = $Silian_tmp . '.sqlite';
        } else {
            $Silian_path = sys_get_temp_dir() . DIRECTORY_SEPARATOR . uniqid('carbontrack_legacy_', true) . '.sqlite';
        }
        $this->dbPath = $Silian_path;
    }

    protected function tearDown(): void
    {
        if (!empty($this->dbPath) && file_exists($this->dbPath)) {
            @unlink($this->dbPath);
        }

        parent::tearDown();
    }

    public function testExchangeProductWithLegacySchema(): void
    {
        $Silian_pdo = new PDO('sqlite:' . $this->dbPath);
        $Silian_pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        if (method_exists($Silian_pdo, 'sqliteCreateFunction')) {
            $Silian_pdo->sqliteCreateFunction('NOW', static fn() => date('Y-m-d H:i:s'));
        }

        $this->createLegacySchema($Silian_pdo);
        $this->seedLegacyData($Silian_pdo);

        $Silian_logger = new Logger('legacy-test');
        $Silian_logger->pushHandler(new NullHandler());

        $Silian_auditLogMock = $this->createMock(AuditLogService::class);
        $Silian_auditLogMock->expects($this->atLeastOnce())->method('log');

        $Silian_messageService = new class($Silian_logger, $Silian_auditLogMock, $Silian_pdo) extends MessageService {
            private PDO $pdo;

            public function __construct(Logger $Silian_logger, AuditLogService $Silian_auditLogService, PDO $Silian_pdo)
            {
                parent::__construct($Silian_logger, $Silian_auditLogService);
                $this->pdo = $Silian_pdo;
            }

            public function sendMessage(
                int $Silian_receiverId,
                string $Silian_type,
                string $Silian_title,
                string $Silian_content,
                string $Silian_priority = Message::PRIORITY_NORMAL,
                ?int $Silian_senderId = null,
                bool $Silian_sendEmail = true
            ): Message {
                $Silian_stmt = $this->pdo->prepare('INSERT INTO messages (sender_id, receiver_id, title, content, is_read, created_at, updated_at) VALUES (:sender_id, :receiver_id, :title, :content, 0, :now, :now)');
                $Silian_now = date('Y-m-d H:i:s');
                $Silian_stmt->execute([
                    'sender_id' => $Silian_senderId,
                    'receiver_id' => $Silian_receiverId,
                    'title' => $Silian_title,
                    'content' => $Silian_content,
                    'now' => $Silian_now
                ]);

                $Silian_message = new Message();
                $Silian_message->receiver_id = $Silian_receiverId;
                $Silian_message->title = $Silian_title;
                $Silian_message->content = $Silian_content;
                return $Silian_message;
            }
        };

        $Silian_userPayload = [
            'id' => 1,
            'username' => 'legacy_user',
            'email' => 'legacy@example.com',
            'points' => 500,
            'is_admin' => false
        ];

        $Silian_authService = new class('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'HS256', 3600, $Silian_userPayload) extends AuthService {
            private array $mockUser;

            public function __construct($Silian_secret, $Silian_alg, $Silian_exp, array $Silian_user)
            {
                parent::__construct($Silian_secret, $Silian_alg, $Silian_exp);
                $this->mockUser = $Silian_user;
            }

            public function getCurrentUser(\Psr\Http\Message\ServerRequestInterface $Silian_request): ?array
            {
                return $this->mockUser;
            }
        };

        $Silian_controller = new ProductController($Silian_pdo, $Silian_messageService, $Silian_auditLogMock, $Silian_authService);

        $Silian_request = makeRequest('POST', '/products/exchange', [
            'product_id' => 1,
            'quantity' => 2,
            'delivery_address' => '测试地址',
            'contact_phone' => '13800000000'
        ]);
        $Silian_response = new Response();

        $Silian_result = $Silian_controller->exchangeProduct($Silian_request, $Silian_response);

        $this->assertSame(200, $Silian_result->getStatusCode(), (string)$Silian_result->getBody());
        $Silian_payload = json_decode((string)$Silian_result->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame(200, $Silian_payload['points_used']);
        $this->assertArrayHasKey('exchange_id', $Silian_payload);

        $Silian_exchangeStmt = $Silian_pdo->prepare('SELECT * FROM point_exchanges WHERE id = :id');
        $Silian_exchangeStmt->execute(['id' => $Silian_payload['exchange_id']]);
        $Silian_exchangeRow = $Silian_exchangeStmt->fetch(PDO::FETCH_ASSOC);
        $this->assertNotEmpty($Silian_exchangeRow);
        $this->assertSame(1, (int)$Silian_exchangeRow['user_id']);
        $this->assertSame(1, (int)$Silian_exchangeRow['product_id']);
        $this->assertSame(2, (int)$Silian_exchangeRow['quantity']);
        $this->assertSame(200, (int)$Silian_exchangeRow['points_used']);
        $this->assertSame('pending', $Silian_exchangeRow['status']);

        $Silian_pointsTxRow = $Silian_pdo->query('SELECT * FROM points_transactions ORDER BY id DESC LIMIT 1')->fetch(PDO::FETCH_ASSOC);
        $this->assertNotEmpty($Silian_pointsTxRow);
        $this->assertSame('legacy@example.com', $Silian_pointsTxRow['email']);
        $this->assertSame('legacy_user', $Silian_pointsTxRow['username']);
        $this->assertSame('product_exchange', $Silian_pointsTxRow['auth']);
        $this->assertSame('spend', $Silian_pointsTxRow['type']);
        $this->assertSame('approved', $Silian_pointsTxRow['status']);
        $this->assertEquals(-200, (int)$Silian_pointsTxRow['points']);
        $this->assertEquals(200, (int)$Silian_pointsTxRow['raw']);
        $this->assertNotEmpty($Silian_pointsTxRow['time']);

        $Silian_updatedPoints = (int)$Silian_pdo->query('SELECT points FROM users WHERE id = 1')->fetchColumn();
        $this->assertSame(300, $Silian_updatedPoints);

        $Silian_messageRow = $Silian_pdo->query('SELECT * FROM messages ORDER BY id DESC LIMIT 1')->fetch(PDO::FETCH_ASSOC);
        $this->assertNotEmpty($Silian_messageRow);
        $this->assertSame(1, (int)$Silian_messageRow['receiver_id']);
        $this->assertSame('商品兑换成功', $Silian_messageRow['title']);
        $this->assertSame(0, (int)$Silian_messageRow['is_read']);
    }

    private function createLegacySchema(PDO $Silian_pdo): void
    {
        $Silian_pdo->exec('CREATE TABLE users (
            id INTEGER PRIMARY KEY,
            username TEXT NOT NULL,
            email TEXT NOT NULL,
            points INTEGER NOT NULL DEFAULT 0,
            is_admin INTEGER NOT NULL DEFAULT 0,
            status TEXT,
            reset_token TEXT,
            reset_token_expires_at TEXT,
            email_verified_at TEXT,
            verification_code TEXT,
            verification_token TEXT,
            verification_code_expires_at TEXT,
            verification_attempts INTEGER NOT NULL DEFAULT 0,
            verification_send_count INTEGER NOT NULL DEFAULT 0,
            verification_last_sent_at TEXT,
            deleted_at TEXT,
            notification_email_mask INTEGER NOT NULL DEFAULT 0
        )');

        $Silian_pdo->exec('CREATE TABLE products (
            id INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            category TEXT,
            category_slug TEXT,
            images TEXT,
            image_path TEXT,
            stock INTEGER NOT NULL DEFAULT 0,
            points_required INTEGER NOT NULL,
            status TEXT NOT NULL,
            deleted_at TEXT
        )');

        $Silian_pdo->exec('CREATE TABLE point_exchanges (
            id TEXT PRIMARY KEY,
            user_id INTEGER NOT NULL,
            product_id INTEGER NOT NULL,
            quantity INTEGER NOT NULL DEFAULT 1,
            points_used INTEGER NOT NULL,
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

        $Silian_pdo->exec('CREATE TABLE points_transactions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            username TEXT,
            email TEXT NOT NULL,
            time TEXT NOT NULL,
            img TEXT,
            points REAL NOT NULL,
            auth TEXT,
            raw REAL NOT NULL,
            act TEXT,
            uid INTEGER NOT NULL,
            activity_id TEXT,
            type TEXT,
            notes TEXT,
            activity_date TEXT,
            status TEXT,
            approved_by INTEGER,
            approved_at TEXT,
            created_at TEXT,
            updated_at TEXT,
            deleted_at TEXT
        )');

        $Silian_pdo->exec('CREATE TABLE messages (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id INTEGER,
            receiver_id INTEGER NOT NULL,
            title TEXT NOT NULL,
            content TEXT NOT NULL,
            is_read INTEGER NOT NULL DEFAULT 0,
            created_at TEXT,
            updated_at TEXT,
            deleted_at TEXT
        )');
    }

    private function seedLegacyData(PDO $Silian_pdo): void
    {
        $Silian_pdo->exec("INSERT INTO users (id, username, email, points, is_admin, status) VALUES (1, 'legacy_user', 'legacy@example.com', 500, 0, 'active')");
        $Silian_pdo->exec("INSERT INTO products (id, name, description, category, category_slug, images, image_path, stock, points_required, status) VALUES (
            1,
            '环保水杯',
            '易于携带的环保水杯',
            'daily',
            'daily',
            '[]',
            '/images/products/cup.png',
            10,
            100,
            'active'
        )");
    }
}
