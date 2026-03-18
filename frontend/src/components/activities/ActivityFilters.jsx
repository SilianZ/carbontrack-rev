import React from 'react';
import { Search, Filter, X, CalendarDays, CheckCircle, Clock, XCircle } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

export function ActivityFilters({
  filters,
  onFiltersChange,
  categories = [],
  isLoading = false
}) {
  const { t } = useTranslation();

  // 将 categories 归一化为数组，兼容多种返回结构：
  // - 数组: 直接使用
  // - 对象映射: 使用对象键作为类别名 [{ category: key }]
  // - 字符串: 单值转为数组
  const normalizedCategories = React.useMemo(() => {
    if (Array.isArray(categories)) return categories;
    if (categories && typeof categories === 'object') {
      return Object.keys(categories).map((key) => ({ category: key }));
    }
    if (typeof categories === 'string') return [{ category: categories }];
    return [];
  }, [categories]);

  const handleFilterChange = (key, value) => {
    onFiltersChange({
      ...filters,
      [key]: value,
      page: 1 // Reset to first page on filter change
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      category: '',
      status: '',
      start_date: '',
      end_date: '',
      sort: 'created_at_desc',
      page: 1
    });
  };

  const hasActiveFilters = filters.search || filters.category || filters.status || filters.start_date || filters.end_date;

  const statusOptions = [
    { value: 'pending', label: t('activities.status.pending'), icon: <Clock className="h-4 w-4 text-blue-500" /> },
    { value: 'approved', label: t('activities.status.approved'), icon: <CheckCircle className="h-4 w-4 text-green-500" /> },
    { value: 'rejected', label: t('activities.status.rejected'), icon: <XCircle className="h-4 w-4 text-red-500" /> }
  ];

  const sortOptions = [
    { value: 'created_at_desc', label: t('common.sort.newest') },
    { value: 'created_at_asc', label: t('common.sort.oldest') },
    { value: 'points_desc', label: t('common.sort.pointsHighToLow') },
    { value: 'points_asc', label: t('common.sort.pointsLowToHigh') }
  ];

  return (
    <div className="mb-6 rounded-lg border border-border bg-card/95 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">{t('activities.filters.title')}</h3>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            {t('common.clear')}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 搜索框 */}
        <div className="lg:col-span-2">
          <label className="mb-2 block text-sm font-medium text-foreground">
            {t('common.search')}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
            <Input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder={t('activities.filters.searchPlaceholder')}
              className="pl-10"
            />
          </div>
        </div>

        {/* 分类筛选 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            {t('activities.filters.category')}
          </label>
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={isLoading}
          >
            <option value="">{t('activities.filters.allCategories')}</option>
            {normalizedCategories.map((category) => (
              <option key={category.category} value={category.category}>
                    {t(`activities.categories.${category.category}`, category.category)}
              </option>
            ))}
          </select>
        </div>

        {/* 状态筛选 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            {t('activities.filters.status')}
          </label>
          <select
            value={filters.status}
            onChange={(e) => handleFilterChange('status', e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={isLoading}
          >
            <option value="">{t('activities.filters.allStatus')}</option>
            {statusOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 日期范围筛选 */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            <CalendarDays className="h-4 w-4 inline mr-1" />
            {t('activities.filters.startDate')}
          </label>
          <Input
            type="date"
            value={filters.start_date}
            onChange={(e) => handleFilterChange('start_date', e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            <CalendarDays className="h-4 w-4 inline mr-1" />
            {t('activities.filters.endDate')}
          </label>
          <Input
            type="date"
            value={filters.end_date}
            onChange={(e) => handleFilterChange('end_date', e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      {/* 排序 */}
      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-foreground">
          {t('common.sort.sortBy')}
        </label>
        <select
          value={filters.sort}
          onChange={(e) => handleFilterChange('sort', e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={isLoading}
        >
          {sortOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {/* 活动筛选结果提示 */}
      {hasActiveFilters && (
        <div className="mt-4 rounded-lg bg-blue-500/10 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-blue-500">
              <Filter className="h-4 w-4" />
              <span>{t('activities.filters.activeFilters')}:</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {filters.search && (
              <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-1 text-xs text-blue-500">
                {t('common.search')}: "{filters.search}"
                <button
                  onClick={() => handleFilterChange('search', '')}
                  className="ml-1 hover:text-blue-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.category && (
              <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-1 text-xs text-blue-500">
                {t(`activities.categories.${filters.category}`, filters.category)}
                <button
                  onClick={() => handleFilterChange('category', '')}
                  className="ml-1 hover:text-blue-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.status && (
              <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-1 text-xs text-blue-500">
                {t(`activities.status.${filters.status}`)}
                <button
                  onClick={() => handleFilterChange('status', '')}
                  className="ml-1 hover:text-blue-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {(filters.start_date || filters.end_date) && (
              <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-1 text-xs text-blue-500">
                {filters.start_date} - {filters.end_date}
                <button
                  onClick={() => {
                    handleFilterChange('start_date', '');
                    handleFilterChange('end_date', '');
                  }}
                  className="ml-1 hover:text-blue-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
