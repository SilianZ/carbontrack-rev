<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Models\User;
use CarbonTrack\Services\NotificationPreferenceService;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;
use Monolog\Handler\NullHandler;
use Monolog\Logger;
use PHPUnit\Framework\TestCase;

class NotificationPreferenceServiceTest extends TestCase
{
    private static Capsule $capsule;

    public static function setUpBeforeClass(): void
    {
        self::$capsule = new Capsule();
        self::$capsule->addConnection([
            'driver' => 'sqlite',
            'database' => ':memory:',
            'prefix' => '',
        ]);
        self::$capsule->setAsGlobal();
        self::$capsule->bootEloquent();

        self::$capsule->schema()->create('users', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->string('username')->nullable();
            $Silian_table->string('email')->nullable();
            $Silian_table->string('password')->nullable();
            $Silian_table->string('status')->nullable();
            $Silian_table->integer('notification_email_mask')->default(0);
            $Silian_table->timestamp('created_at')->nullable();
            $Silian_table->timestamp('updated_at')->nullable();
            $Silian_table->timestamp('deleted_at')->nullable();
        });
    }

    public static function tearDownAfterClass(): void
    {
        self::$capsule->schema()->dropIfExists('users');
    }

    protected function setUp(): void
    {
        parent::setUp();
        self::$capsule->table('users')->delete();
    }

    private function makeService(): NotificationPreferenceService
    {
        $Silian_logger = new Logger('notification-preference-test');
        $Silian_logger->pushHandler(new NullHandler());

        return new NotificationPreferenceService($Silian_logger);
    }

    public function testGetPreferencesForUserDefaultsToEnabled(): void
    {
        $Silian_user = User::create([
            'username' => 'pref-default',
            'email' => 'default@example.com',
            'password' => 'secret',
            'status' => 'active',
            'notification_email_mask' => 0,
        ]);

        $Silian_service = $this->makeService();
        $Silian_preferences = $Silian_service->getPreferencesForUser((int) $Silian_user->id);

        $Silian_byCategory = [];
        foreach ($Silian_preferences as $Silian_row) {
            $Silian_byCategory[$Silian_row['category']] = $Silian_row;
        }

        $this->assertTrue($Silian_byCategory[NotificationPreferenceService::CATEGORY_SYSTEM]['email_enabled']);
        $this->assertTrue($Silian_byCategory[NotificationPreferenceService::CATEGORY_TRANSACTION]['email_enabled']);
        $this->assertTrue($Silian_byCategory[NotificationPreferenceService::CATEGORY_ACTIVITY]['email_enabled']);
        $this->assertTrue($Silian_byCategory[NotificationPreferenceService::CATEGORY_ANNOUNCEMENT]['email_enabled']);
        $this->assertTrue($Silian_byCategory[NotificationPreferenceService::CATEGORY_SUPPORT]['email_enabled']);
        $this->assertTrue($Silian_byCategory[NotificationPreferenceService::CATEGORY_VERIFICATION]['email_enabled'], 'Locked categories must remain enabled.');
    }

    public function testUpdatePreferencesPersistsBitmaskAndEnforcesChecks(): void
    {
        $Silian_user = User::create([
            'username' => 'pref-toggle',
            'email' => 'toggle@example.com',
            'password' => 'secret',
            'status' => 'active',
            'notification_email_mask' => 0,
        ]);

        $Silian_service = $this->makeService();
        $Silian_service->updatePreferences((int) $Silian_user->id, [
            [
                'category' => NotificationPreferenceService::CATEGORY_SYSTEM,
                'email_enabled' => false,
            ],
            [
                'category' => NotificationPreferenceService::CATEGORY_ANNOUNCEMENT,
                'email_enabled' => false,
            ],
            [
                'category' => NotificationPreferenceService::CATEGORY_SUPPORT,
                'email_enabled' => false,
            ],
        ]);

        $Silian_user->refresh();
        $this->assertSame(25, $Silian_user->notification_email_mask, 'System (bit0), announcement (bit3), and support (bit4) should be disabled.');
        $this->assertFalse($Silian_service->shouldSendEmail((int) $Silian_user->id, NotificationPreferenceService::CATEGORY_SYSTEM));
        $this->assertFalse($Silian_service->shouldSendEmailByEmail($Silian_user->email, NotificationPreferenceService::CATEGORY_ANNOUNCEMENT));
        $this->assertFalse($Silian_service->shouldSendEmail((int) $Silian_user->id, NotificationPreferenceService::CATEGORY_SUPPORT));
        $this->assertTrue($Silian_service->shouldSendEmail((int) $Silian_user->id, NotificationPreferenceService::CATEGORY_TRANSACTION));
        $this->assertTrue($Silian_service->shouldSendEmailByEmail($Silian_user->email, NotificationPreferenceService::CATEGORY_VERIFICATION), 'Locked verification category should ignore mask.');

        $Silian_service->updatePreferences((int) $Silian_user->id, [
            [
                'category' => NotificationPreferenceService::CATEGORY_SYSTEM,
                'email_enabled' => true,
            ],
        ]);

        $Silian_user->refresh();
        $this->assertSame(24, $Silian_user->notification_email_mask, 'Announcement (bit3) and support (bit4) should remain disabled.');
        $this->assertTrue($Silian_service->shouldSendEmail((int) $Silian_user->id, NotificationPreferenceService::CATEGORY_SYSTEM));
        $this->assertFalse($Silian_service->shouldSendEmail((int) $Silian_user->id, NotificationPreferenceService::CATEGORY_ANNOUNCEMENT));
        $this->assertFalse($Silian_service->shouldSendEmail((int) $Silian_user->id, NotificationPreferenceService::CATEGORY_SUPPORT));
    }
}
