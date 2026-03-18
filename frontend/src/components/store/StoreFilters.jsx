import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Search, Filter, X, Package, Star, Tag, Loader2 } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/badge';
import { productAPI } from '../../lib/api';

export function StoreFilters({ 
  filters, 
  onFiltersChange, 
  categories = [], 
  isLoading = false 
}) {
  const { t } = useTranslation();
  const normalizeSlugValue = useCallback((value) => {
    if (typeof value !== 'string') {
      value = value !== undefined && value !== null ? String(value) : '';
    }
    const trimmed = value.trim().toLowerCase();
    if (!trimmed) return '';
    const slug = trimmed
      .replace(/[^a-z0-9\-\s]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return slug || ('tag-' + Math.random().toString(36).slice(2, 8));
  }, []);
  const [tagQuery, setTagQuery] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(false);

  const selectedTags = useMemo(() => Array.isArray(filters.tags) ? filters.tags : [], [filters.tags]);

  const handleFilterChange = (key, value) => {
    onFiltersChange({
      ...filters,
      [key]: value,
      page: 1 // 重置到第一页
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      category: '',
      min_points: '',
      max_points: '',
      sort: 'created_at',
      page: 1,
      limit: filters.limit ?? 12,
      tags: []
    });
  };

  const hasActiveFilters = Boolean(
    filters.search ||
    filters.category ||
    filters.min_points ||
    filters.max_points ||
    selectedTags.length
  );

  const loadTagSuggestions = useCallback(async (searchText) => {
    setTagsLoading(true);
    try {
      const response = await productAPI.searchTags({ search: searchText || '', limit: 12 });
      const items = response.data?.data?.tags;
      setTagSuggestions(Array.isArray(items) ? items : []);
    } catch (error) {
      console.error('Failed to load tag suggestions', error);
      setTagSuggestions([]);
    } finally {
      setTagsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadTagSuggestions('');
  }, [loadTagSuggestions]);

  useEffect(() => {
    const handler = setTimeout(() => {
      loadTagSuggestions(tagQuery.trim());
    }, 250);
    return () => clearTimeout(handler);
  }, [tagQuery, loadTagSuggestions]);

  const addTag = (tag) => {
    const nameSource = tag?.name || tag?.label || tag?.value || tag;
    const rawName = nameSource !== undefined && nameSource !== null ? String(nameSource).trim() : '';
    const slugSource = tag?.slug || tag?.value || tag;
    const slug = normalizeSlugValue(slugSource ?? rawName);
    if (!rawName || !slug) {
      return;
    }
    const normalized = { name: rawName, slug };
    if (!normalized || !normalized.slug) {
      return;
    }
    const exists = selectedTags.some((item) => (item.slug || item) === normalized.slug);
    if (exists) {
      return;
    }
    handleFilterChange('tags', selectedTags.concat([{ name: normalized.name, slug: normalized.slug }]));
  };

  const removeTag = (index) => {
    const next = selectedTags.slice();
    next.splice(index, 1);
    handleFilterChange('tags', next);
  };

  const sortOptions = [
    { value: 'created_at', label: t('store.filters.sort.newest') },
    { value: 'points_asc', label: t('store.filters.sort.pointsLowToHigh') },
    { value: 'points_desc', label: t('store.filters.sort.pointsHighToLow') },
    { value: 'popular', label: t('store.filters.sort.popular') },
    { value: 'name', label: t('store.filters.sort.name') }
  ];

  return (
    <div className="mb-6 rounded-lg border border-border bg-card/95 p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <Filter className="h-5 w-5 text-muted-foreground" />
          <h3 className="text-lg font-semibold">{t('store.filters.title')}</h3>
        </div>
        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            onClick={clearFilters}
            className="text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4 mr-1" />
            {t('store.filters.clear')}
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* 搜索框 */}
        <div className="lg:col-span-2">
          <label className="mb-2 block text-sm font-medium text-foreground">
            {t('store.filters.search')}
          </label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
            <Input
              type="text"
              value={filters.search}
              onChange={(e) => handleFilterChange('search', e.target.value)}
              placeholder={t('store.filters.searchPlaceholder')}
              className="pl-10"
            />
          </div>
        </div>

        {/* 分类筛选 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            {t('store.filters.category')}
          </label>
          <select
            value={filters.category}
            onChange={(e) => handleFilterChange('category', e.target.value)}
            className="w-full rounded-md border border-input bg-background px-3 py-2 text-foreground focus:border-green-500 focus:outline-none focus:ring-2 focus:ring-green-500"
            disabled={isLoading}
          >
            <option value="">{t('store.filters.allCategories')}</option>
            {categories.map((category, index) => {
              const key = (category.slug || category.category || category.name || `category-${index}`).toString();
              const label = category.name || category.category || key;
              const count = category.product_count ?? category.count ?? category.total ?? 0;
              return (
                <option key={key} value={key}>
                    {t(`store.categories.${key}`, label)} ({count})
                </option>
              );
            })}
          </select>
        </div>

        {/* 排序 */}
        <div>
          <label className="mb-2 block text-sm font-medium text-foreground">
            {t('store.filters.sortBy')}
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
      </div>

      {/* 积分范围筛选 */}
      <div className="mt-4">
        <label className="mb-2 block text-sm font-medium text-foreground">
          {t('store.filters.pointsRange')}
        </label>
        <div className="flex items-center space-x-3">
          <Input
            type="number"
            value={filters.min_points}
            onChange={(e) => handleFilterChange('min_points', e.target.value)}
            placeholder={t('store.filters.minPoints')}
            className="w-32"
            min="0"
          />
          <span className="text-muted-foreground">-</span>
          <Input
            type="number"
            value={filters.max_points}
            onChange={(e) => handleFilterChange('max_points', e.target.value)}
            placeholder={t('store.filters.maxPoints')}
            className="w-32"
            min="0"
          />
        </div>
      </div>

      {/* 标签筛选 */}
      <div className="mt-4 border-t border-border pt-4">
        <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
          <Tag className="h-4 w-4 text-muted-foreground" />
          {t('store.filters.tags')}
        </label>
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedTags.map((tag, index) => (
            <Badge key={`selected-tag-${tag.slug}-${index}`} variant="secondary" className="flex items-center gap-1 uppercase">
              <span>{tag.name || tag.slug}</span>
              <button
                type="button"
                className="rounded-full p-0.5 hover:bg-muted"
                onClick={() => removeTag(index)}
                aria-label={t('store.filters.removeTag')}
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
        <div className="flex gap-2">
          <Input
            value={tagQuery}
            onChange={(event) => setTagQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault();
                if (tagQuery.trim()) {
                  const input = tagQuery.trim();
                  addTag({ name: input, slug: normalizeSlugValue(input) });
                  setTagQuery('');
                }
              }
            }}
            placeholder={t('store.filters.tagPlaceholder')}
            disabled={isLoading}
          />
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (tagQuery.trim()) {
                const input = tagQuery.trim();
                addTag({ name: input, slug: normalizeSlugValue(input) });
                setTagQuery('');
              }
            }}
            disabled={!tagQuery.trim() || isLoading}
          >
            {t('store.filters.addTag')}
          </Button>
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{t('store.filters.tagHint')}</p>
        <div className="mt-3 rounded-md border border-border bg-muted/40">
          <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
            <span>{t('store.filters.suggestions')}</span>
            {tagsLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" /> : null}
          </div>
          <div className="max-h-44 overflow-y-auto">
            {tagSuggestions.length === 0 && !tagsLoading ? (
              <div className="px-3 py-2 text-sm text-muted-foreground">{t('store.filters.noTagSuggestions')}</div>
            ) : (
              tagSuggestions.map((suggestion, index) => (
                <button
                  type="button"
                  key={`tag-suggestion-${suggestion.id ?? suggestion.slug ?? suggestion.name ?? index}`}
                  onClick={() => {
                    addTag(suggestion);
                    setTagQuery('');
                  }}
                  className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground hover:bg-background/70"
                >
                  <span>{suggestion.name}</span>
                  {suggestion.slug ? <span className="text-xs uppercase text-muted-foreground">{suggestion.slug}</span> : null}
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {/* 快速筛选标签 */}
      <div className="mt-4 border-t border-border pt-4">
        <div className="flex flex-wrap gap-2">
          <Button
            variant={!filters.category ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange('category', '')}
            className="text-xs"
          >
            <Package className="h-3 w-3 mr-1" />
            {t('store.filters.allProducts')}
          </Button>
          
          {categories.slice(0, 5).map((category, index) => {
            const key = (category.slug || category.category || category.name || `category-${index}`).toString();
            const label = category.name || category.category || key;
            const count = category.product_count ?? category.count ?? category.total ?? 0;
            return (
              <Button
                key={key}
                variant={filters.category === key ? "default" : "outline"}
                size="sm"
                onClick={() => handleFilterChange('category', key)}
                className="text-xs"
              >
                    {t(`store.categories.${key}`, label)}
                <span className="ml-1 text-xs opacity-75">({count})</span>
              </Button>
            );
          })}

          <Button
            variant={filters.sort === 'popular' ? "default" : "outline"}
            size="sm"
            onClick={() => handleFilterChange('sort', 'popular')}
            className="text-xs"
          >
            <Star className="h-3 w-3 mr-1" />
            {t('store.filters.popular')}
          </Button>
        </div>
      </div>

      {/* 活动筛选结果提示 */}
      {hasActiveFilters && (
        <div className="mt-4 rounded-lg bg-blue-500/10 p-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2 text-sm text-blue-500">
              <Filter className="h-4 w-4" />
              <span>{t('store.filters.activeFilters')}:</span>
            </div>
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {filters.search && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                {t('store.filters.search')}: "{filters.search}"
                <button
                  onClick={() => handleFilterChange('search', '')}
                  className="ml-1 hover:text-blue-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {filters.category && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                {t(`store.categories.${filters.category}`, filters.category)}
                <button
                  onClick={() => handleFilterChange('category', '')}
                  className="ml-1 hover:text-blue-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {(filters.min_points || filters.max_points) && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                {filters.min_points || 0} - {filters.max_points || '∞'} {t('common.points')}
                <button
                  onClick={() => {
                    handleFilterChange('min_points', '');
                    handleFilterChange('max_points', '');
                  }}
                  className="ml-1 hover:text-blue-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            )}
            {selectedTags.map((tag, index) => (
              <span key={`active-tag-${tag.slug}-${index}`} className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-blue-100 text-blue-800">
                {tag.name || tag.slug}
                <button
                  onClick={() => removeTag(index)}
                  className="ml-1 hover:text-blue-600"
                >
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
