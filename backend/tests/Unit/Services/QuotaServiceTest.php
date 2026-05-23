<?php

declare(strict_types=1);

namespace CarbonTrack\Tests\Unit\Services;

use CarbonTrack\Models\User;
use CarbonTrack\Models\UserGroup;
use CarbonTrack\Models\UserUsageStats;
use CarbonTrack\Services\QuotaService;
use Illuminate\Database\Capsule\Manager as Capsule;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Carbon;
use PHPUnit\Framework\TestCase;

class QuotaServiceTest extends TestCase
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

        self::migrate();
    }

    public static function tearDownAfterClass(): void
    {
        $Silian_schema = self::$capsule->schema();
        $Silian_schema->dropIfExists('user_usage_stats');
        $Silian_schema->dropIfExists('users');
        $Silian_schema->dropIfExists('user_groups');
    }

    protected function setUp(): void
    {
        parent::setUp();
        self::$capsule->table('user_usage_stats')->delete();
        self::$capsule->table('users')->delete();
        self::$capsule->table('user_groups')->delete();
    }

    public function testDailyQuotaHandlesCarbonDates(): void
    {
        $Silian_user = $this->makeUserWithGroup(['daily_limit' => 2]);

        UserUsageStats::create([
            'user_id' => $Silian_user->id,
            'resource_key' => 'llm_daily',
            'counter' => 1,
            'last_updated_at' => Carbon::now()->subDay(),
            'reset_at' => Carbon::now()->subDay(),
        ]);

        $this->assertEquals(['daily_limit' => 2], $Silian_user->group->getQuotaConfig('llm'));

        $Silian_service = new QuotaService();

        $this->assertTrue($Silian_service->checkAndConsume($Silian_user, 'llm', 1));

        $Silian_stats = UserUsageStats::where('user_id', $Silian_user->id)
            ->where('resource_key', 'llm_daily')
            ->firstOrFail();

        $this->assertSame(1, (int) $Silian_stats->counter, 'Counter should reset then consume cost.');
        $this->assertTrue($Silian_stats->reset_at->greaterThan(Carbon::now()), 'Reset time should be in the future.');
    }

    public function testTokenBucketHandlesCarbonDates(): void
    {
        $Silian_user = $this->makeUserWithGroup(['rate_limit' => 2.0]);

        UserUsageStats::create([
            'user_id' => $Silian_user->id,
            'resource_key' => 'llm_bucket',
            'counter' => 1.0,
            'last_updated_at' => Carbon::now()->subSeconds(30),
        ]);

        $this->assertEquals(['rate_limit' => 2.0], $Silian_user->group->getQuotaConfig('llm'));

        $Silian_service = new QuotaService();

        $this->assertTrue($Silian_service->checkAndConsume($Silian_user, 'llm', 1));

        $Silian_stats = UserUsageStats::where('user_id', $Silian_user->id)
            ->where('resource_key', 'llm_bucket')
            ->firstOrFail();

        $this->assertGreaterThanOrEqual(0.0, (float) $Silian_stats->counter);
        $this->assertNotNull($Silian_stats->last_updated_at);
    }

    public function testDailyQuotaInitializesWhenMissing(): void
    {
        $Silian_user = $this->makeUserWithGroup(['daily_limit' => 1]);

        $Silian_service = new QuotaService();

        // No existing stats row
        $this->assertNull(UserUsageStats::where('user_id', $Silian_user->id)->where('resource_key', 'llm_daily')->first());

        $this->assertTrue($Silian_service->checkAndConsume($Silian_user, 'llm', 1));

        $Silian_stats = UserUsageStats::where('user_id', $Silian_user->id)
            ->where('resource_key', 'llm_daily')
            ->firstOrFail();

        $this->assertSame(1, (int) $Silian_stats->counter);
        $this->assertTrue($Silian_stats->reset_at->greaterThan(Carbon::now()));
    }

    private static function migrate(): void
    {
        $Silian_schema = self::$capsule->schema();

        $Silian_schema->create('user_groups', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->string('name');
            $Silian_table->string('code')->unique();
            $Silian_table->longText('config')->nullable();
            $Silian_table->boolean('is_default')->default(false);
            $Silian_table->text('notes')->nullable();
            $Silian_table->timestamps();
        });

        $Silian_schema->create('users', function (Blueprint $Silian_table): void {
            $Silian_table->increments('id');
            $Silian_table->string('username')->nullable();
            $Silian_table->string('email')->nullable();
            $Silian_table->string('password')->nullable();
            $Silian_table->string('role')->default('user');
            $Silian_table->string('status')->default('active');
            $Silian_table->decimal('points', 10, 2)->default(0);
            $Silian_table->boolean('is_admin')->default(false);
            $Silian_table->integer('group_id')->nullable();
            $Silian_table->longText('quota_override')->nullable();
            $Silian_table->text('admin_notes')->nullable();
            $Silian_table->timestamps();
            $Silian_table->softDeletes();
        });

        $Silian_schema->create('user_usage_stats', function (Blueprint $Silian_table): void {
            $Silian_table->integer('user_id');
            $Silian_table->string('resource_key', 50);
            $Silian_table->decimal('counter', 10, 4)->default(0);
            $Silian_table->dateTime('last_updated_at')->nullable();
            $Silian_table->dateTime('reset_at')->nullable();
            $Silian_table->primary(['user_id', 'resource_key']);
        });
    }

    private function makeUserWithGroup(array $Silian_quotaConfig): User
    {
        $Silian_now = Carbon::now()->format('Y-m-d H:i:s');
        $Silian_groupId = self::$capsule->table('user_groups')->insertGetId([
            'name' => 'Test Group',
            'code' => 'code-' . uniqid(),
            'config' => json_encode(['llm' => $Silian_quotaConfig]),
            'is_default' => false,
            'notes' => null,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        $Silian_userId = self::$capsule->table('users')->insertGetId([
            'username' => 'user-' . uniqid(),
            'email' => 'test@example.com',
            'password' => 'secret',
            'role' => 'user',
            'status' => 'active',
            'group_id' => $Silian_groupId,
            'quota_override' => json_encode([]),
            'points' => 0,
            'is_admin' => false,
            'admin_notes' => null,
            'created_at' => $Silian_now,
            'updated_at' => $Silian_now,
        ]);

        return User::with('group')->findOrFail($Silian_userId);
    }
}
