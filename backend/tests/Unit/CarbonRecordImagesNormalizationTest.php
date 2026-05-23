<?php

declare(strict_types=1);

use PHPUnit\Framework\TestCase;
use CarbonTrack\Controllers\CarbonTrackController;
use CarbonTrack\Services\{CarbonCalculatorService, MessageService, AuditLogService, AuthService, ErrorLogService, CloudflareR2Service};
use CarbonTrack\Services\RegionService;
use CarbonTrack\Services\UserProfileViewService;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Psr7\Factory\ServerRequestFactory;

final class CarbonRecordImagesNormalizationTest extends TestCase
{
    private PDO $pdo;

    protected function setUp(): void
    {
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->exec("CREATE TABLE carbon_records (
            id TEXT PRIMARY KEY,
            user_id INTEGER,
            activity_id TEXT,
            amount REAL,
            unit TEXT,
            carbon_saved REAL,
            points_earned INTEGER,
            date TEXT,
            description TEXT,
            images TEXT,
            status TEXT,
            created_at TEXT DEFAULT CURRENT_TIMESTAMP,
            deleted_at TEXT
        );");
        $this->pdo->exec("CREATE TABLE carbon_activities (
            id TEXT PRIMARY KEY,
            name_zh TEXT,
            name_en TEXT,
            category TEXT,
            carbon_factor REAL,
            unit TEXT
        );");
        $this->pdo->exec("INSERT INTO carbon_activities (id,name_zh,name_en,category,carbon_factor,unit) VALUES
            ('act-1','测试活动','Test Activity','daily',1.0,'times');");
    }

    private function makeController(): CarbonTrackController
    {
        // 创建最小可用的依赖 mock/stub
    $Silian_calc = $this->createMock(CarbonCalculatorService::class);
    // Use existing method name from service for consistency
    $Silian_calc->method('calculateCarbonReduction')->willReturn(1.23);
        $Silian_msg = $this->createMock(MessageService::class);
        $Silian_audit = $this->createMock(AuditLogService::class);
        $Silian_auth = $this->createMock(AuthService::class);
    $Silian_auth->method('getCurrentUser')->willReturn(['id' => 1, 'username' => 'tester', 'is_admin' => 0]);
        $Silian_auth->method('isAdminUser')->willReturn(false);
        $Silian_err = $this->createMock(ErrorLogService::class);
        $Silian_r2 = $this->createMock(CloudflareR2Service::class);
        $Silian_r2->method('getPublicUrl')->willReturnCallback(fn(string $Silian_p) => 'https://cdn.example/' . ltrim($Silian_p,'/'));

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

    public function testNormalizeExistingStringArrayImages(): void
    {
        $Silian_controller = $this->makeController();
        $Silian_ref = new ReflectionClass($Silian_controller);
        $Silian_norm = $Silian_ref->getMethod('normalizeImages');
        $Silian_norm->setAccessible(true);
        $Silian_input = ['https://a/img1.png','https://b/img2.png'];
        $Silian_out = $Silian_norm->invoke($Silian_controller, $Silian_input);
        $this->assertCount(2, $Silian_out);
        $this->assertArrayHasKey('url', $Silian_out[0]);
        $this->assertEquals('https://a/img1.png', $Silian_out[0]['url']);
    }

    public function testNormalizeLegacyObjectWithoutPublicUrl(): void
    {
        $Silian_controller = $this->makeController();
        $Silian_ref = new ReflectionClass($Silian_controller);
        $Silian_norm = $Silian_ref->getMethod('normalizeImages');
        $Silian_norm->setAccessible(true);
        $Silian_input = [[ 'file_path' => 'activities/2025/09/01/img1.jpg', 'original_name' => 'img1.jpg' ]];
        $Silian_out = $Silian_norm->invoke($Silian_controller, $Silian_input);
        $this->assertCount(1, $Silian_out);
        $this->assertStringContainsString('activities/2025/09/01/img1.jpg', $Silian_out[0]['url']);
        $this->assertEquals('img1.jpg', $Silian_out[0]['original_name']);
    }
}
