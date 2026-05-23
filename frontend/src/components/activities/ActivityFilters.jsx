import Silian_React from 'react';
import { Search as Silian_Search, Filter as Silian_Filter, X as Silian_X, CalendarDays as Silian_CalendarDays, CheckCircle as Silian_CheckCircle, Clock as Silian_Clock, XCircle as Silian_XCircle } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { Button as Silian_Button } from '../ui/Button';
import { Input as Silian_Input } from '../ui/Input';

export function ActivityFilters({
  filters: Silian_filters,
  onFiltersChange: Silian_onFiltersChange,
  categories: Silian_categories = [],
  isLoading: Silian_isLoading = false
}) {
  const { t: Silian_t } = Silian_useTranslation(['activities', 'common']);

  // 将 categories 归一化为数组，兼容多种返回结构：
  // - 数组: 直接使用
  // - 对象映射: 使用对象键作为类别名 [{ category: key }]
  // - 字符串: 单值转为数组
  const Silian_normalizedCategories = Silian_React.useMemo(() => {
    if (Array.isArray(Silian_categories)) return Silian_categories;
    if (Silian_categories && typeof Silian_categories === 'object') {
      return Object.keys(Silian_categories).map((Silian_key) => ({ category: Silian_key }));
    }
    if (typeof Silian_categories === 'string') return [{ category: Silian_categories }];
    return [];
  }, [Silian_categories]);

  const Silian_handleFilterChange = (Silian_key, Silian_value) => {
    Silian_onFiltersChange({
      ...Silian_filters,
      [Silian_key]: Silian_value,
      page: 1 // Reset to first page on filter change
    });
  };

  const Silian_clearFilters = () => {
    Silian_onFiltersChange({
      search: '',
      category: '',
      status: '',
      start_date: '',
      end_date: '',
      sort: 'created_at_desc',
      page: 1
    });
  };

  const Silian_hasActiveFilters = Silian_filters.search || Silian_filters.category || Silian_filters.status || Silian_filters.start_date || Silian_filters.end_date;

  const Silian_statusOptions = [
    { value: 'pending', label: Silian_t('activities.status.pending'), icon: <Silian_Clock className="h-4 w-4 text-blue-500" /> },
    { value: 'approved', label: Silian_t('activities.status.approved'), icon: <Silian_CheckCircle className="h-4 w-4 text-green-500" /> },
    { value: 'rejected', label: Silian_t('activities.status.rejected'), icon: <Silian_XCircle className="h-4 w-4 text-red-500" /> }
  ];

  const Silian_sortOptions = [
    { value: 'created_at_desc', label: Silian_t('common.sort.newest') },
    { value: 'created_at_asc', label: Silian_t('common.sort.oldest') },
    { value: 'points_desc', label: Silian_t('common.sort.pointsHighToLow') },
    { value: 'points_asc', label: Silian_t('common.sort.pointsLowToHigh') }
  ];

  return (
    <div className="mb-6 rounded-lg border border-border bg-card/95 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Silian_Filter className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">{Silian_t('activities.filters.title')}</h3>
        </div>
        {Silian_hasActiveFilters && (
          <Silian_Button
            variant="ghost"
            size="sm"
            onClick={Silian_clearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <Silian_X className="h-4 w-4 mr-1" />
            {Silian_t('common.clear')}
          </Silian_Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 搜索框 */}
        <div className="lg:col-span-2">
          <label className="mb-2 block text-sm font-medium text-foreground">
            {Silian_t('common.search')}
          </label>
          <div className="relative">
            <Silian_Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
            <Silian_Input
              type="text"
              value={Silian_filters.search}
              onChange={(Silian_e) => Silian_handleFilterChange('search', Silian_e.target.value)}
              placeholder={Silian_t('activities.filters.searchPlaceholder')}
              className="pl-10"
            />
          </div>
        </div>

        {/* 分类筛选 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            {Silian_t('activities.filters.category')}
          </label>
          <select
            value={Silian_filters.category}
            onChange={(Silian_e) => Silian_handleFilterChange('category', Silian_e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={Silian_isLoading}
          >
            <option value="">{Silian_t('activities.filters.allCategories')}</option>
            {Silian_normalizedCategories.map((Silian_category) => (
              <option key={Silian_category.category} value={Silian_category.category}>
                    {Silian_t(`activities.categories.${Silian_category.category}`, Silian_category.category)}
              </option>
            ))}
          </select>
        </div>

        {/* 状态筛选 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            {Silian_t('activities.filters.status')}
          </label>
          <select
            value={Silian_filters.status}
            onChange={(Silian_e) => Silian_handleFilterChange('status', Silian_e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={Silian_isLoading}
          >
            <option value="">{Silian_t('activities.filters.allStatus')}</option>
            {Silian_statusOptions.map((Silian_option) => (
              <option key={Silian_option.value} value={Silian_option.value}>
                {Silian_option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 日期范围筛选 */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            <Silian_CalendarDays className="h-4 w-4 inline mr-1" />
            {Silian_t('activities.filters.startDate')}
          </label>
          <Silian_Input
            type="date"
            value={Silian_filters.start_date}
            onChange={(Silian_e) => Silian_handleFilterChange('start_date', Silian_e.target.value)}
            className="w-full"
          />
        </div>
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            <Silian_CalendarDays className="h-4 w-4 inline mr-1" />
            {Silian_t('activities.filters.endDate')}
          </label>
          <Silian_Input
            type="date"
            value={Silian_filters.end_date}
            onChange={(Silian_e) => Silian_handleFilterChange('end_date', Silian_e.target.value)}
            className="w-full"
          />
        </div>
      </div>

      {/* 排序 */}
      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-foreground">
          {Silian_t('common.sort.sortBy')}
        </label>
        <select
          value={Silian_filters.sort}
          onChange={(Silian_e) => Silian_handleFilterChange('sort', Silian_e.target.value)}
          className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
          disabled={Silian_isLoading}
        >
          {Silian_sortOptions.map((Silian_option) => (
            <option key={Silian_option.value} value={Silian_option.value}>
              {Silian_option.label}
            </option>
          ))}
        </select>
      </div>

      {/* 活动筛选结果提示 */}
      {Silian_hasActiveFilters && (
        <div className="mt-4 rounded-lg bg-blue-500/10 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-blue-500">
              <Silian_Filter className="h-4 w-4" />
              <span>{Silian_t('activities.filters.activeFilters')}:</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {Silian_filters.search && (
              <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-1 text-xs text-blue-500">
                {Silian_t('common.search')}: "{Silian_filters.search}"
                <button
                  onClick={() => Silian_handleFilterChange('search', '')}
                  className="ml-1 hover:text-blue-600"
                >
                  <Silian_X className="h-3 w-3" />
                </button>
              </span>
            )}
            {Silian_filters.category && (
              <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-1 text-xs text-blue-500">
                {Silian_t(`activities.categories.${Silian_filters.category}`, Silian_filters.category)}
                <button
                  onClick={() => Silian_handleFilterChange('category', '')}
                  className="ml-1 hover:text-blue-600"
                >
                  <Silian_X className="h-3 w-3" />
                </button>
              </span>
            )}
            {Silian_filters.status && (
              <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-1 text-xs text-blue-500">
                {Silian_t(`activities.status.${Silian_filters.status}`)}
                <button
                  onClick={() => Silian_handleFilterChange('status', '')}
                  className="ml-1 hover:text-blue-600"
                >
                  <Silian_X className="h-3 w-3" />
                </button>
              </span>
            )}
            {(Silian_filters.start_date || Silian_filters.end_date) && (
              <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-1 text-xs text-blue-500">
                {Silian_filters.start_date} - {Silian_filters.end_date}
                <button
                  onClick={() => {
                    Silian_handleFilterChange('start_date', '');
                    Silian_handleFilterChange('end_date', '');
                  }}
                  className="ml-1 hover:text-blue-600"
                >
                  <Silian_X className="h-3 w-3" />
                </button>
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
