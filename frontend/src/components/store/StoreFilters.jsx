import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ChevronDown,
  ChevronUp,
  Filter,
  Loader2,
  Search,
  SlidersHorizontal,
  Tag,
  X,
} from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { productAPI } from '../../lib/api';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Badge } from '../ui/badge';
import { Collapsible, CollapsibleContent } from '../ui/collapsible';

const DEFAULT_SORT = 'created_at';

const buildDefaultFilters = (limit = 12) => ({
  search: '',
  category: '',
  min_points: '',
  max_points: '',
  sort: DEFAULT_SORT,
  page: 1,
  limit,
  tags: [],
});

const normalizeTagList = (value) => (Array.isArray(value) ? value : []);

export function StoreFilters({
  filters,
  onFiltersChange,
  categories = [],
  isLoading = false,
}) {
  const { t } = useTranslation();
  const [basicSearch, setBasicSearch] = useState(filters.search ?? '');
  const [advancedOpen, setAdvancedOpen] = useState(Boolean(
    filters.category || filters.min_points || filters.max_points || (Array.isArray(filters.tags) && filters.tags.length)
  ));
  const [advancedFilters, setAdvancedFilters] = useState({
    category: filters.category ?? '',
    min_points: filters.min_points ?? '',
    max_points: filters.max_points ?? '',
    sort: filters.sort ?? DEFAULT_SORT,
    tags: normalizeTagList(filters.tags),
  });
  const [tagQuery, setTagQuery] = useState('');
  const [tagSuggestions, setTagSuggestions] = useState([]);
  const [tagsLoading, setTagsLoading] = useState(false);

  useEffect(() => {
    setBasicSearch(filters.search ?? '');
  }, [filters.search]);

  useEffect(() => {
    setAdvancedFilters({
      category: filters.category ?? '',
      min_points: filters.min_points ?? '',
      max_points: filters.max_points ?? '',
      sort: filters.sort ?? DEFAULT_SORT,
      tags: normalizeTagList(filters.tags),
    });
  }, [filters.category, filters.min_points, filters.max_points, filters.sort, filters.tags]);

  const normalizeSlugValue = useCallback((value) => {
    if (typeof value !== 'string') {
      value = value !== undefined && value !== null ? String(value) : '';
    }

    const trimmed = value.trim().toLowerCase();
    if (!trimmed) {
      return '';
    }

    return trimmed
      .replace(/[^a-z0-9\-\s]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }, []);

  const selectedTags = useMemo(() => normalizeTagList(advancedFilters.tags), [advancedFilters.tags]);
  const quickCategories = useMemo(() => categories.slice(0, 6), [categories]);

  const activeAdvancedCount = useMemo(() => {
    let count = 0;
    if (filters.category) count += 1;
    if (filters.min_points || filters.max_points) count += 1;
    if ((filters.sort ?? DEFAULT_SORT) !== DEFAULT_SORT) count += 1;
    if (Array.isArray(filters.tags) && filters.tags.length) count += 1;
    return count;
  }, [filters.category, filters.min_points, filters.max_points, filters.sort, filters.tags]);

  const hasAnyFilters = Boolean(
    filters.search ||
    filters.category ||
    filters.min_points ||
    filters.max_points ||
    (Array.isArray(filters.tags) && filters.tags.length) ||
    (filters.sort ?? DEFAULT_SORT) !== DEFAULT_SORT
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
    const handler = window.setTimeout(() => {
      loadTagSuggestions(tagQuery.trim());
    }, 250);

    return () => window.clearTimeout(handler);
  }, [tagQuery, loadTagSuggestions]);

  const pushFilters = (nextFilters) => {
    onFiltersChange({
      ...filters,
      ...nextFilters,
      page: 1,
      limit: filters.limit ?? 12,
    });
  };

  const handleQuickSearchSubmit = (event) => {
    event.preventDefault();
    pushFilters({ search: basicSearch.trim() });
  };

  const handleQuickCategory = (categoryValue) => {
    setAdvancedFilters((prev) => ({ ...prev, category: categoryValue }));
    pushFilters({ category: categoryValue });
  };

  const handleAdvancedChange = (key, value) => {
    setAdvancedFilters((prev) => ({ ...prev, [key]: value }));
  };

  const addTag = (tag) => {
    const nameSource = tag?.name || tag?.label || tag?.value || tag;
    const rawName = nameSource !== undefined && nameSource !== null ? String(nameSource).trim() : '';
    const slugSource = tag?.slug || tag?.value || tag;
    const slug = normalizeSlugValue(slugSource ?? rawName);
    if (!rawName || !slug) {
      return;
    }

    const exists = selectedTags.some((item) => (item.slug || item) === slug);
    if (exists) {
      return;
    }

    setAdvancedFilters((prev) => ({
      ...prev,
      tags: prev.tags.concat([{ name: rawName, slug }]),
    }));
  };

  const removeDraftTag = (index) => {
    setAdvancedFilters((prev) => {
      const nextTags = prev.tags.slice();
      nextTags.splice(index, 1);
      return { ...prev, tags: nextTags };
    });
  };

  const applyAdvancedFilters = () => {
    pushFilters({
      category: advancedFilters.category,
      min_points: advancedFilters.min_points,
      max_points: advancedFilters.max_points,
      sort: advancedFilters.sort,
      tags: advancedFilters.tags,
    });
  };

  const clearAllFilters = () => {
    const nextDefaults = buildDefaultFilters(filters.limit ?? 12);
    setBasicSearch('');
    setAdvancedFilters({
      category: '',
      min_points: '',
      max_points: '',
      sort: DEFAULT_SORT,
      tags: [],
    });
    setTagQuery('');
    onFiltersChange(nextDefaults);
  };

  const removeAppliedFilter = (key, value) => {
    if (key === 'search') {
      setBasicSearch('');
      pushFilters({ search: '' });
      return;
    }

    if (key === 'range') {
      setAdvancedFilters((prev) => ({ ...prev, min_points: '', max_points: '' }));
      pushFilters({ min_points: '', max_points: '' });
      return;
    }

    if (key === 'tag') {
      const nextTags = normalizeTagList(filters.tags).filter((tag) => (tag.slug || tag) !== value);
      setAdvancedFilters((prev) => ({ ...prev, tags: nextTags }));
      pushFilters({ tags: nextTags });
      return;
    }

    setAdvancedFilters((prev) => ({ ...prev, [key]: '' }));
    pushFilters({ [key]: key === 'sort' ? DEFAULT_SORT : '' });
  };

  const sortOptions = [
    { value: DEFAULT_SORT, label: t('store.filters.sort.newest') },
    { value: 'points_asc', label: t('store.filters.sort.pointsLowToHigh') },
    { value: 'points_desc', label: t('store.filters.sort.pointsHighToLow') },
    { value: 'popular', label: t('store.filters.sort.popular') },
    { value: 'name', label: t('store.filters.sort.name') },
  ];

  const categoryPreview = advancedFilters.category
    ? t(`store.categories.${advancedFilters.category}`, advancedFilters.category)
    : t('store.filters.allCategories');

  return (
    <div className="mb-8 rounded-[28px] border border-black/5 bg-card/95 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">
              <Search className="h-3.5 w-3.5" />
              <span>{t('store.filters.quickTitle')}</span>
            </div>
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-foreground">{t('store.filters.title')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{t('store.filters.quickDescription')}</p>
            </div>
          </div>

          <form onSubmit={handleQuickSearchSubmit} className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                type="text"
                value={basicSearch}
                onChange={(event) => setBasicSearch(event.target.value)}
                placeholder={t('store.filters.searchPlaceholder')}
                className="h-12 rounded-2xl border-border bg-background pl-10"
                disabled={isLoading}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="h-12 rounded-2xl px-5" disabled={isLoading}>
                {t('store.filters.searchButton')}
              </Button>
              {filters.search ? (
                <Button type="button" variant="outline" className="h-12 rounded-2xl px-4" onClick={() => removeAppliedFilter('search')}>
                  <X className="mr-2 h-4 w-4" />
                  {t('store.filters.clearSearch')}
                </Button>
              ) : null}
            </div>
          </form>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant={!filters.category ? 'default' : 'outline'}
              size="sm"
              onClick={() => handleQuickCategory('')}
              className="rounded-full"
            >
              {t('store.filters.allProducts')}
            </Button>
            {quickCategories.map((category, index) => {
              const key = (category.slug || category.category || category.name || `category-${index}`).toString();
              const label = category.name || category.category || key;
              const count = category.product_count ?? category.count ?? category.total ?? 0;
              return (
                <Button
                  key={key}
                  type="button"
                  variant={filters.category === key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleQuickCategory(key)}
                  className="rounded-full"
                >
                  {t(`store.categories.${key}`, label)}
                  <span className="ml-1 text-xs opacity-70">({count})</span>
                </Button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[24px] border border-black/5 bg-muted/30 p-5 dark:border-white/10 dark:bg-black/15">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                <SlidersHorizontal className="h-3.5 w-3.5" />
                <span>{t('store.filters.advancedTitle')}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t('store.filters.advancedDescription')}</p>
            </div>

            <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setAdvancedOpen((prev) => !prev)}>
              {advancedOpen ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
              {t('store.filters.advancedToggle', { count: activeAdvancedCount })}
            </Button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{t('store.filters.category')}</p>
              <p className="mt-2 text-sm font-medium text-foreground">{categoryPreview}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{t('store.filters.sortBy')}</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {sortOptions.find((option) => option.value === advancedFilters.sort)?.label ?? t('store.filters.sort.newest')}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{t('store.filters.pointsRange')}</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {advancedFilters.min_points || 0} - {advancedFilters.max_points || '∞'}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{t('store.filters.tags')}</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {selectedTags.length > 0 ? t('store.filters.tagCount', { count: selectedTags.length }) : t('store.filters.noTagsSelected')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleContent className="mt-6">
          <div className="rounded-[24px] border border-border bg-muted/20 p-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">{t('store.filters.category')}</label>
                <select
                  value={advancedFilters.category}
                  onChange={(event) => handleAdvancedChange('category', event.target.value)}
                  className="w-full rounded-2xl border border-input bg-background px-3 py-3 text-foreground focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">{t('store.filters.sortBy')}</label>
                <select
                  value={advancedFilters.sort}
                  onChange={(event) => handleAdvancedChange('sort', event.target.value)}
                  className="w-full rounded-2xl border border-input bg-background px-3 py-3 text-foreground focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
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

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-foreground">{t('store.filters.pointsRange')}</label>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                <Input
                  type="number"
                  value={advancedFilters.min_points}
                  onChange={(event) => handleAdvancedChange('min_points', event.target.value)}
                  placeholder={t('store.filters.minPoints')}
                  min="0"
                  className="rounded-2xl"
                />
                <span className="hidden text-center text-muted-foreground sm:block">-</span>
                <Input
                  type="number"
                  value={advancedFilters.max_points}
                  onChange={(event) => handleAdvancedChange('max_points', event.target.value)}
                  placeholder={t('store.filters.maxPoints')}
                  min="0"
                  className="rounded-2xl"
                />
              </div>
            </div>

            <div className="mt-5 rounded-[22px] border border-border bg-background/80 p-4">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <Tag className="h-4 w-4 text-muted-foreground" />
                {t('store.filters.tags')}
              </label>

              <div className="mb-3 flex flex-wrap gap-2">
                {selectedTags.map((tag, index) => (
                  <Badge key={`draft-tag-${tag.slug}-${index}`} variant="secondary" className="flex items-center gap-1 uppercase">
                    <span>{tag.name || tag.slug}</span>
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-muted"
                      onClick={() => removeDraftTag(index)}
                      aria-label={t('store.filters.removeTag')}
                    >
                      <X className="h-3 w-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              <div className="flex flex-col gap-2 md:flex-row">
                <Input
                  value={tagQuery}
                  onChange={(event) => setTagQuery(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') {
                      event.preventDefault();
                      if (tagQuery.trim()) {
                        addTag({ name: tagQuery.trim(), slug: normalizeSlugValue(tagQuery.trim()) });
                        setTagQuery('');
                      }
                    }
                  }}
                  placeholder={t('store.filters.tagPlaceholder')}
                  disabled={isLoading}
                  className="rounded-2xl"
                />
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => {
                    if (tagQuery.trim()) {
                      addTag({ name: tagQuery.trim(), slug: normalizeSlugValue(tagQuery.trim()) });
                      setTagQuery('');
                    }
                  }}
                  disabled={!tagQuery.trim() || isLoading}
                >
                  {t('store.filters.addTag')}
                </Button>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">{t('store.filters.tagHint')}</p>

              <div className="mt-4 rounded-2xl border border-border bg-muted/40">
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

            <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                {t('store.filters.refinedResults')}
              </div>
              <div className="flex gap-2">
                <Button type="button" variant="outline" className="rounded-2xl" onClick={clearAllFilters}>
                  {t('store.filters.clear')}
                </Button>
                <Button type="button" className="rounded-2xl" onClick={applyAdvancedFilters} disabled={isLoading}>
                  {t('store.filters.applyAdvanced')}
                </Button>
              </div>
            </div>
          </div>
        </CollapsibleContent>
      </Collapsible>

      {hasAnyFilters ? (
        <div className="mt-5 rounded-[22px] border border-blue-500/15 bg-blue-500/8 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-300">
              <Filter className="h-4 w-4" />
              <span>{t('store.filters.activeFilters')}</span>
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clearAllFilters}>
              {t('store.filters.clear')}
            </Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {filters.search ? (
              <button
                type="button"
                onClick={() => removeAppliedFilter('search')}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-800 dark:bg-blue-500/20 dark:text-blue-100"
              >
                <span>{t('store.filters.search')}: "{filters.search}"</span>
                <X className="h-3 w-3" />
              </button>
            ) : null}

            {filters.category ? (
              <button
                type="button"
                onClick={() => removeAppliedFilter('category')}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-800 dark:bg-blue-500/20 dark:text-blue-100"
              >
                <span>{t(`store.categories.${filters.category}`, filters.category)}</span>
                <X className="h-3 w-3" />
              </button>
            ) : null}

            {(filters.min_points || filters.max_points) ? (
              <button
                type="button"
                onClick={() => removeAppliedFilter('range')}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-800 dark:bg-blue-500/20 dark:text-blue-100"
              >
                <span>{filters.min_points || 0} - {filters.max_points || '∞'} {t('common.points')}</span>
                <X className="h-3 w-3" />
              </button>
            ) : null}

            {(filters.sort ?? DEFAULT_SORT) !== DEFAULT_SORT ? (
              <button
                type="button"
                onClick={() => removeAppliedFilter('sort')}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-800 dark:bg-blue-500/20 dark:text-blue-100"
              >
                <span>{sortOptions.find((option) => option.value === filters.sort)?.label ?? filters.sort}</span>
                <X className="h-3 w-3" />
              </button>
            ) : null}

            {normalizeTagList(filters.tags).map((tag, index) => (
              <button
                type="button"
                key={`applied-tag-${tag.slug || tag}-${index}`}
                onClick={() => removeAppliedFilter('tag', tag.slug || tag)}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-800 dark:bg-blue-500/20 dark:text-blue-100"
              >
                <span>{tag.name || tag.slug || tag}</span>
                <X className="h-3 w-3" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
