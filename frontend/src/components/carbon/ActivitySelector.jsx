import Silian_React, { useState as Silian_useState, useEffect as Silian_useEffect } from 'react';
import { Search as Silian_Search, Filter as Silian_Filter, Leaf as Silian_Leaf, Car as Silian_Car, ShoppingBag as Silian_ShoppingBag, Recycle as Silian_Recycle } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { carbonAPI as Silian_carbonAPI } from '../../lib/api';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../ui/Card';
import { Input as Silian_Input } from '../ui/Input';
import { Button as Silian_Button } from '../ui/Button';

const Silian_categoryIcons = {
  daily: Silian_Leaf,
  transport: Silian_Car,
  consumption: Silian_ShoppingBag,
  environmental: Silian_Recycle,
  lifestyle: Silian_Leaf,
  energy: Silian_Leaf,
  water: Silian_Leaf,
  waste: Silian_Recycle,
  travel: Silian_Car
};

export function ActivitySelector({ onActivitySelect: Silian_onActivitySelect, selectedActivity: Silian_selectedActivity }) {
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['activities', 'common', 'errors', 'units']);
  const [Silian_activities, Silian_setActivities] = Silian_useState([]);
  const [Silian_filteredActivities, Silian_setFilteredActivities] = Silian_useState([]);
  const [Silian_categories, Silian_setCategories] = Silian_useState([]);
  const [Silian_selectedCategory, Silian_setSelectedCategory] = Silian_useState('all');
  const [Silian_searchTerm, Silian_setSearchTerm] = Silian_useState('');
  const [Silian_loading, Silian_setLoading] = Silian_useState(true);
  const [Silian_error, Silian_setError] = Silian_useState('');

  // 获取活动列表
  Silian_useEffect(() => {
    const Silian_fetchActivities = async () => {
      try {
        Silian_setLoading(true);
        const Silian_response = await Silian_carbonAPI.getActivities();

        if (Silian_response?.data?.success) {
          const Silian_payload = Silian_response?.data?.data;
          const Silian_rawActivities = Array.isArray(Silian_payload?.activities)
            ? Silian_payload.activities
            : Array.isArray(Silian_payload)
              ? Silian_payload
              : [];

          const Silian_normalized = Silian_rawActivities
            .filter((Silian_activity) => {
              if (!Silian_activity) return false;
              if (Silian_activity.deleted_at) return false;
              if (Object.prototype.hasOwnProperty.call(Silian_activity, 'is_active') && Silian_activity.is_active === false) {
                return false;
              }
              return true;
            })
            .map((Silian_activity) => ({
              ...Silian_activity,
              carbon_factor: Number(Silian_activity.carbon_factor ?? Silian_activity.factor ?? 0),
              sort_order: Number(Silian_activity.sort_order ?? 0),
            }))
            .sort((Silian_a, Silian_b) => {
              const Silian_orderDiff = (Silian_a.sort_order ?? 0) - (Silian_b.sort_order ?? 0);
              if (Silian_orderDiff !== 0) return Silian_orderDiff;
              return (Silian_a.name_zh || '').localeCompare(Silian_b.name_zh || '');
            });

          Silian_setActivities(Silian_normalized);
          Silian_setFilteredActivities(Silian_normalized);

          const Silian_uniqueCategories = Array.isArray(Silian_payload?.categories)
            ? Silian_payload.categories
            : [...new Set(Silian_normalized.map((Silian_activity) => Silian_activity.category).filter(Boolean))];
          Silian_setCategories(Silian_uniqueCategories);
        } else {
          Silian_setError(Silian_response?.data?.message || Silian_t('errors.loadFailed'));
        }
      } catch (Silian_err) {
        Silian_setError(Silian_err.message || Silian_t('errors.network'));
      } finally {
        Silian_setLoading(false);
      }
    };

    Silian_fetchActivities();
  }, [Silian_t]);

  // 筛选活动
  Silian_useEffect(() => {
    let Silian_filtered = Silian_activities;

    // 按分类筛选
    if (Silian_selectedCategory !== 'all') {
      Silian_filtered = Silian_filtered.filter(Silian_activity => Silian_activity.category === Silian_selectedCategory);
    }

    // 按搜索词筛选（字段容错处理）
    if (Silian_searchTerm) {
      const Silian_q = (Silian_searchTerm || '').toString().toLowerCase();
      const Silian_lower = (Silian_v) => (Silian_v ?? '').toString().toLowerCase();
      Silian_filtered = Silian_filtered.filter((Silian_activity) =>
        Silian_lower(Silian_activity.name_zh).includes(Silian_q) ||
        Silian_lower(Silian_activity.name_en).includes(Silian_q) ||
        Silian_lower(Silian_activity.description_zh).includes(Silian_q) ||
        Silian_lower(Silian_activity.description_en).includes(Silian_q)
      );
    }

    Silian_setFilteredActivities(Silian_filtered);
  }, [Silian_activities, Silian_selectedCategory, Silian_searchTerm]);

  const Silian_handleActivitySelect = (Silian_activity) => {
    Silian_onActivitySelect(Silian_activity);
  };

  const Silian_getCategoryName = (Silian_category) => {
    return Silian_t(`activities.categories.${Silian_category}`) || Silian_category;
  };

  const Silian_getActivityName = (Silian_activity) => {
    const Silian_isEn = (Silian_currentLanguage || '').toLowerCase().startsWith('en');
    return Silian_isEn
      ? (Silian_activity.name_en || Silian_activity.name_zh || Silian_activity.name)
      : (Silian_activity.name_zh || Silian_activity.name_en || Silian_activity.name);
  };

  const Silian_getActivityDescription = (Silian_activity) => {
    const Silian_isEn = (Silian_currentLanguage || '').toLowerCase().startsWith('en');
    return Silian_isEn
      ? (Silian_activity.description_en || Silian_activity.description_zh || Silian_activity.description)
      : (Silian_activity.description_zh || Silian_activity.description_en || Silian_activity.description);
  };

  if (Silian_loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-green-500"></div>
        <span className="ml-2 text-muted-foreground">{Silian_t('common.loading')}</span>
      </div>
    );
  }

  if (Silian_error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600 mb-4">{Silian_error}</p>
        <Silian_Button onClick={() => window.location.reload()}>
          {Silian_t('common.retry')}
        </Silian_Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 搜索和筛选 */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Silian_Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Silian_Input
            type="text"
            placeholder={Silian_t('activities.searchPlaceholder')}
            value={Silian_searchTerm}
            onChange={(Silian_e) => Silian_setSearchTerm(Silian_e.target.value)}
            className="pl-10"
          />
        </div>

        <div className="flex items-center gap-2">
          <Silian_Filter className="h-4 w-4 text-muted-foreground" />
          <select
            value={Silian_selectedCategory}
            onChange={(Silian_e) => Silian_setSelectedCategory(Silian_e.target.value)}
            className="rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-xs outline-none transition-colors focus:border-ring focus:ring-2 focus:ring-ring/40"
          >
            <option value="all">{Silian_t('activities.categories.all')}</option>
            {Silian_categories.map(Silian_category => (
              <option key={Silian_category} value={Silian_category}>
                {Silian_getCategoryName(Silian_category)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 活动列表 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {Silian_filteredActivities.map((Silian_activity) => {
          const Silian_IconComponent = Silian_categoryIcons[Silian_activity.category] || Silian_Leaf;
          const Silian_selectedId = Silian_selectedActivity?.id || Silian_selectedActivity?.uuid;
          const Silian_activityId = Silian_activity.id || Silian_activity.uuid;
          const Silian_isSelected = Silian_selectedId && Silian_activityId && Silian_selectedId === Silian_activityId;

          return (
            <Silian_Card
              key={Silian_activityId}
              className={`cursor-pointer transition-all duration-200 hover:shadow-md ${
                Silian_isSelected
                  ? 'border-green-500/40 bg-green-500/10 ring-2 ring-green-500/60'
                  : 'hover:bg-muted/60'
              }`}
              onClick={() => Silian_handleActivitySelect(Silian_activity)}
            >
              <Silian_CardHeader className="pb-3">
                <div className="flex items-center gap-3">
                  <div className={`p-2 rounded-lg ${
                    Silian_isSelected ? 'bg-green-500/15' : 'bg-muted'
                  }`}>
                    <Silian_IconComponent className={`h-5 w-5 ${
                      Silian_isSelected ? 'text-green-500' : 'text-muted-foreground'
                    }`} />
                  </div>
                  <div className="flex-1">
                    <Silian_CardTitle className="text-sm font-medium">
                      {Silian_getActivityName(Silian_activity)}
                    </Silian_CardTitle>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {Silian_getCategoryName(Silian_activity.category)}
                    </div>
                  </div>
                </div>
              </Silian_CardHeader>

              <Silian_CardContent className="pt-0">
                <Silian_CardDescription className="mb-3 text-sm text-muted-foreground">
                  {Silian_getActivityDescription(Silian_activity)}
                </Silian_CardDescription>

                <div className="flex items-center justify-between text-xs">
                  <div className="text-muted-foreground">
                    {Silian_t('activities.unit')}: {Silian_t(`units.${Silian_activity.unit}`, Silian_activity.unit)}
                  </div>
                  <div className="text-green-600 font-medium">
                    {Silian_activity.carbon_factor} {Silian_t('activities.carbonFactor')}
                  </div>
                </div>

                {Silian_activity.points_per_unit && (
                  <div className="mt-2 text-xs text-blue-600">
                    {Silian_activity.points_per_unit} {Silian_t('activities.pointsPerUnit')}
                  </div>
                )}
              </Silian_CardContent>
            </Silian_Card>
          );
        })}
      </div>

      {Silian_filteredActivities.length === 0 && (
        <div className="text-center py-12">
          <div className="mb-2 text-muted-foreground">
            <Silian_Search className="h-12 w-12 mx-auto" />
          </div>
          <p className="text-foreground">{Silian_t('activities.noActivitiesFound')}</p>
          <p className="mt-1 text-sm text-muted-foreground">
            {Silian_t('activities.tryDifferentSearch')}
          </p>
        </div>
      )}
    </div>
  );
}

