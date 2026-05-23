<?php

declare(strict_types=1);

namespace CarbonTrack\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;
use Illuminate\Support\Str;

class CarbonActivity extends Model
{
    use SoftDeletes;

    protected $table = 'carbon_activities';

    // Use UUID as primary key
    protected $keyType = 'string';
    public $incrementing = false;

    protected $fillable = [
        'id',
        'name_zh',
        'name_en',
        'category',
        'carbon_factor',
        'unit',
        'description_zh',
        'description_en',
        'icon',
        'is_active',
        'sort_order'
    ];

    protected $casts = [
        'carbon_factor' => 'decimal:4',
        'is_active' => 'boolean',
        'sort_order' => 'integer',
        'created_at' => 'datetime',
        'updated_at' => 'datetime',
        'deleted_at' => 'datetime'
    ];

    protected $dates = ['deleted_at'];

    public $timestamps = true;

    /**
     * Boot the model and generate UUID for new records
     */
    protected static function boot()
    {
        parent::boot();

        static::creating(function ($Silian_model) {
            if (empty($Silian_model->id)) {
                $Silian_model->id = (string) Str::uuid();
            }
        });
    }

    /**
     * Get points transactions using this activity
     */
    public function pointsTransactions()
    {
        // Temporarily disabled due to missing PointsTransaction model
        // return $this->hasMany(PointsTransaction::class, 'activity_id', 'id');
        return collect([]);
    }

    /**
     * Scope to get active activities only
     */
    public function scopeActive($Silian_query)
    {
        return $Silian_query->where('is_active', true);
    }

    /**
     * Scope to get activities by category
     */
    public function scopeByCategory($Silian_query, string $Silian_category)
    {
        return $Silian_query->where('category', $Silian_category);
    }

    /**
     * Scope to order by sort order
     */
    public function scopeOrdered($Silian_query)
    {
        return $Silian_query->orderBy('sort_order')->orderBy('name_zh');
    }

    /**
     * Calculate carbon savings for given input
     */
    public function calculateCarbonSavings(float $Silian_dataInput): float
    {
        return $Silian_dataInput * $this->carbon_factor;
    }

    /**
     * Get display name based on locale
     */
    public function getDisplayName(string $Silian_locale = 'zh'): string
    {
        return $Silian_locale === 'en' ? $this->name_en : $this->name_zh;
    }

    /**
     * Get description based on locale
     */
    public function getDescription(string $Silian_locale = 'zh'): ?string
    {
        return $Silian_locale === 'en' ? $this->description_en : $this->description_zh;
    }

    /**
     * Get combined name (Chinese / English)
     */
    public function getCombinedName(): string
    {
        return $this->name_zh . ' / ' . $this->name_en;
    }

    /**
     * Get activity statistics
     */
    public function getStatistics(): array
    {
        // Return default statistics for now to avoid missing model dependency
        // TODO: Implement proper statistics once PointsTransaction model is created
        return [
            'total_records' => 0,
            'total_carbon_saved' => 0,
            'total_data_input' => 0,
            'unique_users' => 0,
            'avg_per_record' => 0
        ];
    }

    /**
     * Check if activity is available for new records
     */
    public function isAvailable(): bool
    {
        return $this->is_active && !$this->trashed();
    }

    /**
     * Get all categories
     */
    public static function getCategories(): array
    {
        return static::distinct('category')
            ->whereNotNull('category')
            ->pluck('category')
            ->toArray();
    }

    /**
     * Get activities grouped by category
     */
    public static function getGroupedByCategory(): array
    {
        return static::active()
            ->ordered()
            ->get()
            ->groupBy('category')
            ->toArray();
    }

    /**
     * Backward-compatible finder used by controllers that still call a static findById with PDO.
     * Returns a plain associative array for compatibility with array-based controller logic.
     */
    public static function findById(\PDO $Silian_db, string $Silian_id): ?array
    {
        $Silian_sql = "SELECT id, name_zh, name_en, category, carbon_factor, unit, icon FROM carbon_activities WHERE id = :id AND deleted_at IS NULL";
        $Silian_stmt = $Silian_db->prepare($Silian_sql);
        $Silian_stmt->execute(['id' => $Silian_id]);
        $Silian_row = $Silian_stmt->fetch(\PDO::FETCH_ASSOC);
        return $Silian_row ?: null;
    }

    /**
     * Search activities by name
     */
    public function scopeSearch($Silian_query, string $Silian_search)
    {
        return $Silian_query->where(function ($Silian_q) use ($Silian_search) {
            $Silian_q->where('name_zh', 'like', "%{$Silian_search}%")
              ->orWhere('name_en', 'like', "%{$Silian_search}%")
              ->orWhere('description_zh', 'like', "%{$Silian_search}%")
              ->orWhere('description_en', 'like', "%{$Silian_search}%");
        });
    }

    /**
     * Get activity by old string name (for migration compatibility)
     */
    public static function findByOldName(string $Silian_oldName): ?self
    {
        // Map old string names to UUIDs for backward compatibility
        $Silian_nameMapping = [
            '购物时自带袋子 / Bring your own bag when shopping' => '550e8400-e29b-41d4-a716-446655440001',
            '早睡觉一小时 / Sleep an hour earlier' => '550e8400-e29b-41d4-a716-446655440002',
            '刷牙时关掉水龙头 / Turn off the tap while brushing teeth' => '550e8400-e29b-41d4-a716-446655440003',
            '出门自带水杯 / Bring your own water bottle' => '550e8400-e29b-41d4-a716-446655440004',
            '垃圾分类 / Sort waste properly' => '550e8400-e29b-41d4-a716-446655440005',
            '减少打印纸 / Reduce unnecessary printing paper' => '550e8400-e29b-41d4-a716-446655440006',
            '减少使用一次性餐盒 / Reduce disposable meal boxes' => '550e8400-e29b-41d4-a716-446655440007',
            '简易包装礼物 / Use minimal gift wrapping' => '550e8400-e29b-41d4-a716-446655440008',
            '夜跑 / Night running' => '550e8400-e29b-41d4-a716-446655440009',
            '自然风干湿发 / Air-dry wet hair' => '550e8400-e29b-41d4-a716-446655440010',
            '点外卖选择"无需餐具" / Choose No-Cutlery when ordering delivery' => '550e8400-e29b-41d4-a716-446655440011',
            '下班时关电脑和灯 / Turn off computer and lights when off-duty' => '550e8400-e29b-41d4-a716-446655440012',
            '晚上睡觉全程关灯 / Keep lights off at night' => '550e8400-e29b-41d4-a716-446655440013',
            '快速洗澡 / Take a quick shower' => '550e8400-e29b-41d4-a716-446655440014',
            '阳光晾晒衣服 / Sun-dry clothes' => '550e8400-e29b-41d4-a716-446655440015',
            '夏天空调调至26°C以上 / Set AC to above 78°F during Summer' => '550e8400-e29b-41d4-a716-446655440016',
            '攒够一桶衣服再洗 / Save and wash a full load of clothes' => '550e8400-e29b-41d4-a716-446655440017',
            '化妆品用完购买替代装 / Buy refillable cosmetics or toiletries' => '550e8400-e29b-41d4-a716-446655440018',
            '购买本地应季水果 / Buy local seasonal fruits' => '550e8400-e29b-41d4-a716-446655440019',
            '自己做饭 / Cook at home' => '550e8400-e29b-41d4-a716-446655440020',
            '吃一顿轻食 / Have a light meal' => '550e8400-e29b-41d4-a716-446655440021',
            '吃完水果蔬菜 / Finish all fruits and vegetables' => '550e8400-e29b-41d4-a716-446655440022',
            '光盘行动 / Finish all food on the plate' => '550e8400-e29b-41d4-a716-446655440023',
            '喝燕麦奶或植物基食品 / Drink oat milk or plant-based food' => '550e8400-e29b-41d4-a716-446655440024',
            '公交地铁通勤 / Use public transport' => '550e8400-e29b-41d4-a716-446655440025',
            '骑行探索城市 / Explore the city by bike' => '550e8400-e29b-41d4-a716-446655440026',
            '种一棵树 / Plant a tree' => '550e8400-e29b-41d4-a716-446655440030',
            '购买二手书 / Buy a second-hand book' => '550e8400-e29b-41d4-a716-446655440031',
            '乘坐快轨去机场 / Take high-speed rail to the airport' => '550e8400-e29b-41d4-a716-446655440027',
            '拼车 / Carpool' => '550e8400-e29b-41d4-a716-446655440028',
            '自行车出行 / Travel by bike' => '550e8400-e29b-41d4-a716-446655440029',
            '旅行时自备洗漱用品 / Bring your own toiletries when traveling' => '550e8400-e29b-41d4-a716-446655440032',
            '旧物改造 / Repurpose old items' => '550e8400-e29b-41d4-a716-446655440033',
            '购买一级能效家电 / Buy an energy-efficient appliance' => '550e8400-e29b-41d4-a716-446655440034',
            '购买白色或浅色衣物 / Buy white or light-colored clothes' => '550e8400-e29b-41d4-a716-446655440035',
            '花一天享受户外 / Spend a full day outdoors' => '550e8400-e29b-41d4-a716-446655440036',
            '自己种菜并吃 / Grow and eat your own vegetables' => '550e8400-e29b-41d4-a716-446655440037',
            '减少使用手机时间 / Reduce screen time' => '550e8400-e29b-41d4-a716-446655440038',
            // Special activities
            '节约用电1度' => '550e8400-e29b-41d4-a716-446655440039',
            '节约用水1L' => '550e8400-e29b-41d4-a716-446655440040',
            '垃圾分类1次' => '550e8400-e29b-41d4-a716-446655440041'
        ];

        $Silian_uuid = $Silian_nameMapping[$Silian_oldName] ?? null;

        if ($Silian_uuid) {
            return static::find($Silian_uuid);
        }

        // Fallback: search by combined name
        return static::where(function ($Silian_query) use ($Silian_oldName) {
            $Silian_query->whereRaw("CONCAT(name_zh, ' / ', name_en) = ?", [$Silian_oldName])
                  ->orWhere('name_zh', $Silian_oldName)
                  ->orWhere('name_en', $Silian_oldName);
        })->first();
    }
}

