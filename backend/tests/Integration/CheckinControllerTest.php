<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Integration;

use CarbonTrack\Controllers\CheckinController;
use CarbonTrack\Models\User;
use CarbonTrack\Models\UserGroup;
use CarbonTrack\Services\AuthService;
use CarbonTrack\Services\AuditLogService;
use CarbonTrack\Services\CheckinService;
use CarbonTrack\Services\QuotaService;
use DateTimeImmutable;
use DateTimeZone;
use Illuminate\Database\Capsule\Manager as Capsule;
use Monolog\Handler\NullHandler;
use Monolog\Logger;
use PDO;
use PHPUnit\Framework\TestCase;
use Psr\Http\Message\ServerRequestInterface as Request;
use Slim\Psr7\Response;

class CheckinControllerTest extends TestCase
{
    private PDO $pdo;
    private string $dbPath;
    private Capsule $capsule;
    private CheckinService $checkinService;
    private User $user;

    protected function setUp(): void
    {
        parent::setUp();

        $this->dbPath = tempnam(sys_get_temp_dir(), 'carbontrack_checkins_');
        $this->pdo = new PDO('sqlite:' . $this->dbPath);
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        TestSchemaBuilder::init($this->pdo);

        $this->capsule = new Capsule();
        $this->capsule->addConnection([
            'driver' => 'sqlite',
            'database' => $this->dbPath,
            'prefix' => '',
            'pdo' => $this->pdo,
        ]);
        $this->capsule->setAsGlobal();
        $this->capsule->bootEloquent();

        $this->seedUser(1);
        $this->checkinService = new CheckinService($this->pdo, null, 'UTC');
    }

    protected function tearDown(): void
    {
        if (is_file($this->dbPath)) {
            @unlink($this->dbPath);
        }
        parent::tearDown();
    }

    public function testListCheckinsReturnsCalendarPayload(): void
    {
        $Silian_controller = $this->makeController();

        $Silian_today = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $Silian_start = $Silian_today->modify('-5 days');
        $Silian_end = $Silian_today;
        $Silian_recordDate = $Silian_today->modify('-3 days');
        $Silian_makeupDate = $Silian_today->modify('-2 days');

        $this->checkinService->recordCheckinFromSubmission(
            (int) $this->user->id,
            'rec-1',
            $Silian_recordDate
        );
        $this->checkinService->createMakeupCheckin(
            (int) $this->user->id,
            $Silian_makeupDate->format('Y-m-d'),
            'missed',
            'rec-makeup-3'
        );

        $Silian_request = makeRequest('GET', '/users/me/checkins', null, [
            'start_date' => $Silian_start->format('Y-m-d'),
            'end_date' => $Silian_end->format('Y-m-d'),
        ]);
        $Silian_response = new Response();

        $Silian_result = $Silian_controller->list($Silian_request, $Silian_response);
        $this->assertSame(200, $Silian_result->getStatusCode());

        $Silian_payload = json_decode((string) $Silian_result->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame(2, count($Silian_payload['data']['checkins']));
        $this->assertSame(2, (int) $Silian_payload['data']['stats']['total_days']);
        $this->assertSame(1, (int) $Silian_payload['data']['makeup_quota']['limit']);
    }

    public function testMakeupCheckinConsumesQuota(): void
    {
        $Silian_controller = $this->makeController();

        $Silian_today = new DateTimeImmutable('now', new DateTimeZone('UTC'));
        $Silian_firstDate = $Silian_today->modify('-2 days')->format('Y-m-d');
        $Silian_secondDate = $Silian_today->modify('-1 day')->format('Y-m-d');
        $Silian_activityId = (string) $this->pdo->query("SELECT id FROM carbon_activities LIMIT 1")->fetchColumn();
        $Silian_insertRecord = $this->pdo->prepare("INSERT INTO carbon_records (id, user_id, activity_id, amount, unit, carbon_saved, points_earned, date, status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now'))");
        $Silian_insertRecord->execute(['rec-makeup-1', $this->user->id, $Silian_activityId, 1, 'km', 0.1, 0, $Silian_firstDate]);
        $Silian_insertRecord->execute(['rec-makeup-2', $this->user->id, $Silian_activityId, 1, 'km', 0.1, 0, $Silian_secondDate]);

        $Silian_request = makeRequest('POST', '/users/me/checkins/makeup', [
            'date' => $Silian_firstDate,
            'note' => 'catch-up',
            'record_id' => 'rec-makeup-1',
        ]);
        $Silian_response = new Response();
        $Silian_result = $Silian_controller->makeup($Silian_request, $Silian_response);

        $Silian_payload = json_decode((string) $Silian_result->getBody(), true, 512, JSON_THROW_ON_ERROR);
        $this->assertSame(200, $Silian_result->getStatusCode());
        $this->assertTrue($Silian_payload['success']);
        $this->assertSame($Silian_firstDate, $Silian_payload['data']['checkin_date']);
        $this->assertSame(1, (int) $Silian_payload['data']['makeup_quota']['used']);
        $this->assertSame(0, (int) $Silian_payload['data']['makeup_quota']['remaining']);

        $Silian_secondRequest = makeRequest('POST', '/users/me/checkins/makeup', [
            'date' => $Silian_secondDate,
            'record_id' => 'rec-makeup-2',
        ]);
        $Silian_secondResponse = new Response();
        $Silian_secondResult = $Silian_controller->makeup($Silian_secondRequest, $Silian_secondResponse);
        $this->assertSame(429, $Silian_secondResult->getStatusCode());
    }

    private function seedUser(int $Silian_monthlyLimit): void
    {
        $Silian_now = (new DateTimeImmutable('now', new DateTimeZone('UTC')))->format('Y-m-d H:i:s');
        $Silian_group = UserGroup::create([
            'name' => 'Checkin Group',
            'code' => 'checkin-' . uniqid(),
            'config' => [
                'checkin_makeup' => [
                    'monthly_limit' => $Silian_monthlyLimit,
                ],
            ],
            'is_default' => false,
            'notes' => null,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $this->user = User::create([
            'username' => 'checkin_user',
            'email' => 'checkin@example.com',
            'status' => 'active',
            'points' => 0,
            'is_admin' => false,
            'group_id' => $Silian_group->id,
            'quota_override' => json_encode([]),
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);
    }

    private function makeController(): CheckinController
    {
        $Silian_logger = new Logger('checkin-test');
        $Silian_logger->pushHandler(new NullHandler());

        $Silian_user = $this->user;
        $Silian_authService = new class($Silian_user) extends AuthService {
            private User $user;

            public function __construct(User $Silian_user)
            {
            parent::__construct('0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef', 'HS256', 3600);
                $this->user = $Silian_user;
            }

            public function getCurrentUser(Request $Silian_request): ?array
            {
                return [
                    'id' => $this->user->id,
                    'username' => $this->user->username,
                    'is_admin' => false,
                ];
            }

            public function getCurrentUserModel(Request $Silian_request): ?User
            {
                return $this->user;
            }
        };

        $Silian_auditLog = $this->createMock(AuditLogService::class);

        return new CheckinController(
            $Silian_authService,
            $this->checkinService,
            new QuotaService(),
            $Silian_auditLog,
            $Silian_logger
        );
    }
}
