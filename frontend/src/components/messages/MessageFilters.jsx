import Silian_React from 'react';
import { Search as Silian_Search, Filter as Silian_Filter, X as Silian_X, Mail as Silian_Mail, MailOpen as Silian_MailOpen } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { Button as Silian_Button } from '../ui/Button';
import { Input as Silian_Input } from '../ui/Input';

export function MessageFilters({
  filters: Silian_filters,
  onFiltersChange: Silian_onFiltersChange,
  isLoading: Silian_isLoading = false
}) {
  const { t: Silian_t } = Silian_useTranslation(['common', 'messages']);

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
      status: '',
      sort: 'created_at_desc',
      page: 1
    });
  };

  const Silian_hasActiveFilters = !!(Silian_filters.search || Silian_filters.status);

  const Silian_statusOptions = [
    { value: 'unread', label: Silian_t('messages.unread'), icon: <Silian_Mail className="h-4 w-4 text-blue-500" /> },
    { value: 'read', label: Silian_t('messages.read'), icon: <Silian_MailOpen className="h-4 w-4 text-muted-foreground" /> }
  ];

  // 后端无 type/priority 字段，移除相关选项

  return (
    <div className="mb-6 rounded-lg border border-border bg-card/95 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Silian_Filter className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">{Silian_t('messages.filters.title')}</h3>
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

  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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
              placeholder={Silian_t('messages.filters.searchPlaceholder')}
              className="pl-10"
            />
          </div>
        </div>

        {/* 状态筛选 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            {Silian_t('messages.filters.status')}
          </label>
          <select
            value={Silian_filters.status}
            onChange={(Silian_e) => Silian_handleFilterChange('status', Silian_e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={Silian_isLoading}
          >
            <option value="">{Silian_t('messages.filters.allStatus')}</option>
            {Silian_statusOptions.map((Silian_option) => (
              <option key={Silian_option.value} value={Silian_option.value}>
                {Silian_option.label}
              </option>
            ))}
          </select>
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
          <option value="created_at_desc">{Silian_t('common.sort.newest')}</option>
          <option value="created_at_asc">{Silian_t('common.sort.oldest')}</option>
          <option value="priority_desc">{Silian_t('messages.filters.priorityHighToLow')}</option>
          <option value="priority_asc">{Silian_t('messages.filters.priorityLowToHigh')}</option>
        </select>
      </div>

      {/* 活动筛选结果提示 */}
      {Silian_hasActiveFilters && (
        <div className="mt-4 rounded-lg bg-blue-500/10 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-blue-500">
              <Silian_Filter className="h-4 w-4" />
              <span>{Silian_t('messages.filters.activeFilters')}:</span>
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
            {Silian_filters.status && (
              <span className="inline-flex items-center rounded-full bg-blue-500/15 px-2 py-1 text-xs text-blue-500">
                {Silian_t(`messages.${Silian_filters.status}`)}
                <button
                  onClick={() => Silian_handleFilterChange('status', '')}
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
