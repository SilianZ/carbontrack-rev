<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;
use CarbonTrack\Controllers\CarbonTrackController;
use CarbonTrack\Services\{CarbonCalculatorService, MessageService, AuditLogService, AuthService, ErrorLogService, CloudflareR2Service};
use CarbonTrack\Services\RegionService;
use CarbonTrack\Services\UserProfileViewService;
use Slim\Psr7\Factory\ServerRequestFactory;
use Slim\Psr7\UploadedFile;
use Slim\Psr7\Response;

final class CarbonRecordImagePersistenceTest extends TestCase
{
    private PDO $pdo;

    protected function setUp(): void
    {
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->exec("CREATE TABLE carbon_records (id TEXT PRIMARY KEY,user_id INTEGER,activity_id TEXT,amount REAL,unit TEXT,carbon_saved REAL,points_earned INTEGER,date TEXT,description TEXT,images TEXT,status TEXT,created_at TEXT DEFAULT CURRENT_TIMESTAMP,deleted_at TEXT);");
    $this->pdo->exec("CREATE TABLE carbon_activities (id TEXT PRIMARY KEY,name_zh TEXT,name_en TEXT,category TEXT,carbon_factor REAL,unit TEXT,icon TEXT,points_factor REAL DEFAULT 1,description_zh TEXT,description_en TEXT,sort_order INTEGER DEFAULT 0,is_active INTEGER DEFAULT 1,deleted_at TEXT);");
    $this->pdo->exec("INSERT INTO carbon_activities (id,name_zh,name_en,category,carbon_factor,unit,icon) VALUES ('act-1','活动','Activity','daily',1.5,'times','icon-car');");
    // minimal users table for controller queries (notifyAdminsNewRecord & auth mocks)
    $this->pdo->exec("CREATE TABLE users (id INTEGER PRIMARY KEY, username TEXT, email TEXT, is_admin INTEGER DEFAULT 0, school_id INTEGER, points REAL DEFAULT 0, deleted_at TEXT, reset_token TEXT, reset_token_expires_at TEXT, email_verified_at TEXT, verification_code TEXT, verification_token TEXT, verification_code_expires_at TEXT, verification_attempts INTEGER DEFAULT 0, verification_send_count INTEGER DEFAULT 0, verification_last_sent_at TEXT, notification_email_mask INTEGER DEFAULT 0);");
    $this->pdo->exec("INSERT INTO users (id,username,email,is_admin,school_id,points) VALUES (1,'tester','t@example.com',0,1,0);");
    $this->pdo->exec("INSERT INTO users (id,username,email,is_admin,school_id,points) VALUES (2,'admin','admin@example.com',1,1,0);");
    }

    private function makeController(array $Silian_uploadResults = []): CarbonTrackController
    {
    $Silian_calc = $this->getMockBuilder(CarbonCalculatorService::class)->disableOriginalConstructor()->getMock();
    $Silian_msg = $this->getMockBuilder(MessageService::class)->disableOriginalConstructor()->getMock();
    $Silian_audit = $this->getMockBuilder(AuditLogService::class)->disableOriginalConstructor()->getMock();
    $Silian_auth = $this->getMockBuilder(AuthService::class)->disableOriginalConstructor()->getMock();
    $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'username' => 'tester', 'is_admin' => 0]);
    $Silian_auth->method('isAdminUser')->willReturn(false);
    $Silian_err = $this->getMockBuilder(ErrorLogService::class)->disableOriginalConstructor()->getMock();
    $Silian_r2 = $this->getMockBuilder(CloudflareR2Service::class)->disableOriginalConstructor()->getMock();
        if ($Silian_uploadResults) {
            $Silian_r2->method('uploadMultipleFiles')->willReturn(['results' => $Silian_uploadResults]);
            $Silian_r2->method('getPublicUrl')->willReturnCallback(fn(string $Silian_p) => 'https://cdn.example/' . ltrim($Silian_p,'/'));
        }
        return new CarbonTrackController(
            $this->pdo,
            $Silian_calc,
            $Silian_msg,
            $Silian_audit,
            $Silian_auth,
            new UserProfileViewService(new RegionService(null, null, null, null)),
            $Silian_err,
            $Silian_r2,
            null,
            null,
            null
        );
    }

    public function testStoresImageUrlsFromRequestBody(): void
    {
        $Silian_controller = $this->makeController();
        $Silian_body = [
            'activity_id' => 'act-1',
            'amount' => 2,
            'date' => '2025-09-01',
            'images' => ['https://a/img1.png','https://b/img2.png']
        ];
        $Silian_req = (new ServerRequestFactory())->createServerRequest('POST','/api/v1/carbon-records');
        $Silian_req = $Silian_req->withParsedBody($Silian_body);
    $Silian_resp = new Response();
    $Silian_out = $Silian_controller->submitRecord($Silian_req, $Silian_resp);
        $Silian_raw = (string)$Silian_out->getBody();
        $Silian_data = json_decode($Silian_raw, true);
        if (!isset($Silian_data['success'])) {
            fwrite(STDERR, "RAW RESPONSE: $Silian_raw\n");
        }
        $this->assertArrayHasKey('success', $Silian_data);
        $this->assertTrue($Silian_data['success']);
        $Silian_recId = $Silian_data['data']['record_id'];
        $Silian_row = $this->pdo->query("SELECT images FROM carbon_records WHERE id = '$Silian_recId'")->fetch(PDO::FETCH_ASSOC);
        $Silian_decoded = json_decode($Silian_row['images'], true);
        $this->assertCount(2, $Silian_decoded);
        $this->assertEquals('https://a/img1.png', $Silian_decoded[0]['public_url'] ?? $Silian_decoded[0]['url']);
    }

    public function testStoresUploadedImagesFromR2(): void
    {
        $Silian_uploadResults = [
            ['success' => true, 'file_path' => 'activities/1/a.jpg', 'public_url' => 'https://cdn.example/activities/1/a.jpg', 'original_name' => 'a.jpg', 'mime_type' => 'image/jpeg', 'file_size' => 1234]
        ];
        $Silian_controller = $this->makeController($Silian_uploadResults);
    $Silian_tmpFile = tempnam(sys_get_temp_dir(), 'upl');
    file_put_contents($Silian_tmpFile, 'dummy');
    $Silian_uploaded = new UploadedFile($Silian_tmpFile, 'a.jpg', 'image/jpeg', filesize($Silian_tmpFile), UPLOAD_ERR_OK);
        $Silian_req = (new ServerRequestFactory())->createServerRequest('POST','/api/v1/carbon-records');
        $Silian_req = $Silian_req->withUploadedFiles(['images' => [$Silian_uploaded]])->withParsedBody([
            'activity_id' => 'act-1',
            'amount' => 1,
            'date' => '2025-09-01'
        ]);
    $Silian_resp = new Response();
    $Silian_out = $Silian_controller->submitRecord($Silian_req, $Silian_resp);
    $Silian_raw = (string)$Silian_out->getBody();
    $Silian_data = json_decode($Silian_raw, true);
    $this->assertArrayHasKey('success', $Silian_data, 'Response missing success key. Raw: ' . $Silian_raw);
    $this->assertTrue($Silian_data['success']);
        $Silian_recId = $Silian_data['data']['record_id'];
        $Silian_row = $this->pdo->query("SELECT images FROM carbon_records WHERE id = '$Silian_recId'")->fetch(PDO::FETCH_ASSOC);
        $Silian_decoded = json_decode($Silian_row['images'], true);
        $this->assertCount(1, $Silian_decoded);
        $this->assertEquals('https://cdn.example/activities/1/a.jpg', $Silian_decoded[0]['public_url'] ?? $Silian_decoded[0]['url']);
    }

    public function testRejectsWhenNoImagesProvided(): void
    {
        $Silian_controller = $this->makeController();
        $Silian_req = (new ServerRequestFactory())->createServerRequest('POST','/api/v1/carbon-records');
        $Silian_req = $Silian_req->withParsedBody([
            'activity_id' => 'act-1',
            'amount' => 5,
            'date' => '2025-09-02'
        ]);
        $Silian_resp = new Response();
        $Silian_out = $Silian_controller->submitRecord($Silian_req, $Silian_resp);
        $Silian_raw = (string)$Silian_out->getBody();
        $Silian_data = json_decode($Silian_raw, true);
        $this->assertArrayNotHasKey('success', $Silian_data, 'Should not succeed without images. Raw: ' . $Silian_raw);
        $this->assertEquals('Missing required field: images', $Silian_data['error'] ?? null, 'Expected images required error');
    }
}
