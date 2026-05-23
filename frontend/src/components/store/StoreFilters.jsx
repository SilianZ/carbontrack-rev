import Silian_React, { useCallback as Silian_useCallback, useEffect as Silian_useEffect, useMemo as Silian_useMemo, useState as Silian_useState } from 'react';
import {
  ChevronDown as Silian_ChevronDown,
  ChevronUp as Silian_ChevronUp,
  Filter as Silian_Filter,
  Loader2 as Silian_Loader2,
  Search as Silian_Search,
  SlidersHorizontal as Silian_SlidersHorizontal,
  Tag as Silian_Tag,
  X as Silian_X,
} from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { productAPI as Silian_productAPI } from '../../lib/api';
import { Button as Silian_Button } from '../ui/Button';
import { Input as Silian_Input } from '../ui/Input';
import { Badge as Silian_Badge } from '../ui/badge';
import { Collapsible as Silian_Collapsible, CollapsibleContent as Silian_CollapsibleContent } from '../ui/collapsible';

const Silian_DEFAULT_SORT = 'created_at';

const Silian_buildDefaultFilters = (Silian_limit = 12) => ({
  search: '',
  category: '',
  min_points: '',
  max_points: '',
  sort: Silian_DEFAULT_SORT,
  page: 1,
  limit: Silian_limit,
  tags: [],
});

const Silian_normalizeTagList = (Silian_value) => (Array.isArray(Silian_value) ? Silian_value : []);

export function StoreFilters({
  filters: Silian_filters,
  onFiltersChange: Silian_onFiltersChange,
  categories: Silian_categories = [],
  isLoading: Silian_isLoading = false,
}) {
  const { t: Silian_t } = Silian_useTranslation(['common', 'store']);
  const [Silian_basicSearch, Silian_setBasicSearch] = Silian_useState(Silian_filters.search ?? '');
  const [Silian_advancedOpen, Silian_setAdvancedOpen] = Silian_useState(Boolean(
    Silian_filters.category || Silian_filters.min_points || Silian_filters.max_points || (Array.isArray(Silian_filters.tags) && Silian_filters.tags.length)
  ));
  const [Silian_advancedFilters, Silian_setAdvancedFilters] = Silian_useState({
    category: Silian_filters.category ?? '',
    min_points: Silian_filters.min_points ?? '',
    max_points: Silian_filters.max_points ?? '',
    sort: Silian_filters.sort ?? Silian_DEFAULT_SORT,
    tags: Silian_normalizeTagList(Silian_filters.tags),
  });
  const [Silian_tagQuery, Silian_setTagQuery] = Silian_useState('');
  const [Silian_tagSuggestions, Silian_setTagSuggestions] = Silian_useState([]);
  const [Silian_tagsLoading, Silian_setTagsLoading] = Silian_useState(false);

  Silian_useEffect(() => {
    Silian_setBasicSearch(Silian_filters.search ?? '');
  }, [Silian_filters.search]);

  Silian_useEffect(() => {
    Silian_setAdvancedFilters({
      category: Silian_filters.category ?? '',
      min_points: Silian_filters.min_points ?? '',
      max_points: Silian_filters.max_points ?? '',
      sort: Silian_filters.sort ?? Silian_DEFAULT_SORT,
      tags: Silian_normalizeTagList(Silian_filters.tags),
    });
  }, [Silian_filters.category, Silian_filters.min_points, Silian_filters.max_points, Silian_filters.sort, Silian_filters.tags]);

  const Silian_normalizeSlugValue = Silian_useCallback((Silian_value) => {
    if (typeof Silian_value !== 'string') {
      Silian_value = Silian_value !== undefined && Silian_value !== null ? String(Silian_value) : '';
    }

    const Silian_trimmed = Silian_value.trim().toLowerCase();
    if (!Silian_trimmed) {
      return '';
    }

    return Silian_trimmed
      .replace(/[^a-z0-9\-\s]+/g, '-')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
  }, []);

  const Silian_selectedTags = Silian_useMemo(() => Silian_normalizeTagList(Silian_advancedFilters.tags), [Silian_advancedFilters.tags]);
  const Silian_quickCategories = Silian_useMemo(() => Silian_categories.slice(0, 6), [Silian_categories]);

  const Silian_activeAdvancedCount = Silian_useMemo(() => {
    let Silian_count = 0;
    if (Silian_filters.category) Silian_count += 1;
    if (Silian_filters.min_points || Silian_filters.max_points) Silian_count += 1;
    if ((Silian_filters.sort ?? Silian_DEFAULT_SORT) !== Silian_DEFAULT_SORT) Silian_count += 1;
    if (Array.isArray(Silian_filters.tags) && Silian_filters.tags.length) Silian_count += 1;
    return Silian_count;
  }, [Silian_filters.category, Silian_filters.min_points, Silian_filters.max_points, Silian_filters.sort, Silian_filters.tags]);

  const Silian_hasAnyFilters = Boolean(
    Silian_filters.search ||
    Silian_filters.category ||
    Silian_filters.min_points ||
    Silian_filters.max_points ||
    (Array.isArray(Silian_filters.tags) && Silian_filters.tags.length) ||
    (Silian_filters.sort ?? Silian_DEFAULT_SORT) !== Silian_DEFAULT_SORT
  );

  const Silian_loadTagSuggestions = Silian_useCallback(async (Silian_searchText) => {
    Silian_setTagsLoading(true);
    try {
      const Silian_response = await Silian_productAPI.searchTags({ search: Silian_searchText || '', limit: 12 });
      const Silian_items = Silian_response.data?.data?.tags;
      Silian_setTagSuggestions(Array.isArray(Silian_items) ? Silian_items : []);
    } catch (Silian_error) {
      console.error('Failed to load tag suggestions', Silian_error);
      Silian_setTagSuggestions([]);
    } finally {
      Silian_setTagsLoading(false);
    }
  }, []);

  Silian_useEffect(() => {
    Silian_loadTagSuggestions('');
  }, [Silian_loadTagSuggestions]);

  Silian_useEffect(() => {
    const Silian_handler = window.setTimeout(() => {
      Silian_loadTagSuggestions(Silian_tagQuery.trim());
    }, 250);

    return () => window.clearTimeout(Silian_handler);
  }, [Silian_tagQuery, Silian_loadTagSuggestions]);

  const Silian_pushFilters = (Silian_nextFilters) => {
    Silian_onFiltersChange({
      ...Silian_filters,
      ...Silian_nextFilters,
      page: 1,
      limit: Silian_filters.limit ?? 12,
    });
  };

  const Silian_handleQuickSearchSubmit = (Silian_event) => {
    Silian_event.preventDefault();
    Silian_pushFilters({ search: Silian_basicSearch.trim() });
  };

  const Silian_handleQuickCategory = (Silian_categoryValue) => {
    Silian_setAdvancedFilters((Silian_prev) => ({ ...Silian_prev, category: Silian_categoryValue }));
    Silian_pushFilters({ category: Silian_categoryValue });
  };

  const Silian_handleAdvancedChange = (Silian_key, Silian_value) => {
    Silian_setAdvancedFilters((Silian_prev) => ({ ...Silian_prev, [Silian_key]: Silian_value }));
  };

  const Silian_addTag = (Silian_tag) => {
    const Silian_nameSource = Silian_tag?.name || Silian_tag?.label || Silian_tag?.value || Silian_tag;
    const Silian_rawName = Silian_nameSource !== undefined && Silian_nameSource !== null ? String(Silian_nameSource).trim() : '';
    const Silian_slugSource = Silian_tag?.slug || Silian_tag?.value || Silian_tag;
    const Silian_slug = Silian_normalizeSlugValue(Silian_slugSource ?? Silian_rawName);
    if (!Silian_rawName || !Silian_slug) {
      return;
    }

    const Silian_exists = Silian_selectedTags.some((Silian_item) => (Silian_item.slug || Silian_item) === Silian_slug);
    if (Silian_exists) {
      return;
    }

    Silian_setAdvancedFilters((Silian_prev) => ({
      ...Silian_prev,
      tags: Silian_prev.tags.concat([{ name: Silian_rawName, slug: Silian_slug }]),
    }));
  };

  const Silian_removeDraftTag = (Silian_index) => {
    Silian_setAdvancedFilters((Silian_prev) => {
      const Silian_nextTags = Silian_prev.tags.slice();
      Silian_nextTags.splice(Silian_index, 1);
      return { ...Silian_prev, tags: Silian_nextTags };
    });
  };

  const Silian_applyAdvancedFilters = () => {
    Silian_pushFilters({
      category: Silian_advancedFilters.category,
      min_points: Silian_advancedFilters.min_points,
      max_points: Silian_advancedFilters.max_points,
      sort: Silian_advancedFilters.sort,
      tags: Silian_advancedFilters.tags,
    });
  };

  const Silian_clearAllFilters = () => {
    const Silian_nextDefaults = Silian_buildDefaultFilters(Silian_filters.limit ?? 12);
    Silian_setBasicSearch('');
    Silian_setAdvancedFilters({
      category: '',
      min_points: '',
      max_points: '',
      sort: Silian_DEFAULT_SORT,
      tags: [],
    });
    Silian_setTagQuery('');
    Silian_onFiltersChange(Silian_nextDefaults);
  };

  const Silian_removeAppliedFilter = (Silian_key, Silian_value) => {
    if (Silian_key === 'search') {
      Silian_setBasicSearch('');
      Silian_pushFilters({ search: '' });
      return;
    }

    if (Silian_key === 'range') {
      Silian_setAdvancedFilters((Silian_prev) => ({ ...Silian_prev, min_points: '', max_points: '' }));
      Silian_pushFilters({ min_points: '', max_points: '' });
      return;
    }

    if (Silian_key === 'tag') {
      const Silian_nextTags = Silian_normalizeTagList(Silian_filters.tags).filter((Silian_tag) => (Silian_tag.slug || Silian_tag) !== Silian_value);
      Silian_setAdvancedFilters((Silian_prev) => ({ ...Silian_prev, tags: Silian_nextTags }));
      Silian_pushFilters({ tags: Silian_nextTags });
      return;
    }

    Silian_setAdvancedFilters((Silian_prev) => ({ ...Silian_prev, [Silian_key]: '' }));
    Silian_pushFilters({ [Silian_key]: Silian_key === 'sort' ? Silian_DEFAULT_SORT : '' });
  };

  const Silian_sortOptions = [
    { value: Silian_DEFAULT_SORT, label: Silian_t('store.filters.sort.newest') },
    { value: 'points_asc', label: Silian_t('store.filters.sort.pointsLowToHigh') },
    { value: 'points_desc', label: Silian_t('store.filters.sort.pointsHighToLow') },
    { value: 'popular', label: Silian_t('store.filters.sort.popular') },
    { value: 'name', label: Silian_t('store.filters.sort.name') },
  ];

  const Silian_categoryPreview = Silian_advancedFilters.category
    ? Silian_t(`store.categories.${Silian_advancedFilters.category}`, Silian_advancedFilters.category)
    : Silian_t('store.filters.allCategories');

  return (
    <div className="mb-8 rounded-[28px] border border-black/5 bg-card/95 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.5fr)_minmax(280px,0.9fr)]">
        <div className="space-y-5">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-emerald-600 dark:text-emerald-300">
              <Silian_Search className="h-3.5 w-3.5" />
              <span>{Silian_t('store.filters.quickTitle')}</span>
            </div>
            <div>
              <h3 className="text-2xl font-semibold tracking-tight text-foreground">{Silian_t('store.filters.title')}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{Silian_t('store.filters.quickDescription')}</p>
            </div>
          </div>

          <form onSubmit={Silian_handleQuickSearchSubmit} className="flex flex-col gap-3 md:flex-row">
            <div className="relative flex-1">
              <Silian_Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Silian_Input
                type="text"
                value={Silian_basicSearch}
                onChange={(Silian_event) => Silian_setBasicSearch(Silian_event.target.value)}
                placeholder={Silian_t('store.filters.searchPlaceholder')}
                className="h-12 rounded-2xl border-border bg-background pl-10"
                disabled={Silian_isLoading}
              />
            </div>
            <div className="flex gap-2">
              <Silian_Button type="submit" className="h-12 rounded-2xl px-5" disabled={Silian_isLoading}>
                {Silian_t('store.filters.searchButton')}
              </Silian_Button>
              {Silian_filters.search ? (
                <Silian_Button type="button" variant="outline" className="h-12 rounded-2xl px-4" onClick={() => Silian_removeAppliedFilter('search')}>
                  <Silian_X className="mr-2 h-4 w-4" />
                  {Silian_t('store.filters.clearSearch')}
                </Silian_Button>
              ) : null}
            </div>
          </form>

          <div className="flex flex-wrap gap-2">
            <Silian_Button
              type="button"
              variant={!Silian_filters.category ? 'default' : 'outline'}
              size="sm"
              onClick={() => Silian_handleQuickCategory('')}
              className="rounded-full"
            >
              {Silian_t('store.filters.allProducts')}
            </Silian_Button>
            {Silian_quickCategories.map((Silian_category, Silian_index) => {
              const Silian_key = (Silian_category.slug || Silian_category.category || Silian_category.name || `category-${Silian_index}`).toString();
              const Silian_label = Silian_category.name || Silian_category.category || Silian_key;
              const Silian_count = Silian_category.product_count ?? Silian_category.count ?? Silian_category.total ?? 0;
              return (
                <Silian_Button
                  key={Silian_key}
                  type="button"
                  variant={Silian_filters.category === Silian_key ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => Silian_handleQuickCategory(Silian_key)}
                  className="rounded-full"
                >
                  {Silian_t(`store.categories.${Silian_key}`, Silian_label)}
                  <span className="ml-1 text-xs opacity-70">({Silian_count})</span>
                </Silian_Button>
              );
            })}
          </div>
        </div>

        <div className="rounded-[24px] border border-black/5 bg-muted/30 p-5 dark:border-white/10 dark:bg-black/15">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                <Silian_SlidersHorizontal className="h-3.5 w-3.5" />
                <span>{Silian_t('store.filters.advancedTitle')}</span>
              </div>
              <p className="text-sm text-muted-foreground">{Silian_t('store.filters.advancedDescription')}</p>
            </div>

            <Silian_Button type="button" variant="outline" className="rounded-2xl" onClick={() => Silian_setAdvancedOpen((Silian_prev) => !Silian_prev)}>
              {Silian_advancedOpen ? <Silian_ChevronUp className="mr-2 h-4 w-4" /> : <Silian_ChevronDown className="mr-2 h-4 w-4" />}
              {Silian_t('store.filters.advancedToggle', { count: Silian_activeAdvancedCount })}
            </Silian_Button>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{Silian_t('store.filters.category')}</p>
              <p className="mt-2 text-sm font-medium text-foreground">{Silian_categoryPreview}</p>
            </div>
            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{Silian_t('store.filters.sortBy')}</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {Silian_sortOptions.find((Silian_option) => Silian_option.value === Silian_advancedFilters.sort)?.label ?? Silian_t('store.filters.sort.newest')}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{Silian_t('store.filters.pointsRange')}</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {Silian_advancedFilters.min_points || 0} - {Silian_advancedFilters.max_points || '∞'}
              </p>
            </div>
            <div className="rounded-2xl border border-border bg-background/80 p-4">
              <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{Silian_t('store.filters.tags')}</p>
              <p className="mt-2 text-sm font-medium text-foreground">
                {Silian_selectedTags.length > 0 ? Silian_t('store.filters.tagCount', { count: Silian_selectedTags.length }) : Silian_t('store.filters.noTagsSelected')}
              </p>
            </div>
          </div>
        </div>
      </div>

      <Silian_Collapsible open={Silian_advancedOpen} onOpenChange={Silian_setAdvancedOpen}>
        <Silian_CollapsibleContent className="mt-6">
          <div className="rounded-[24px] border border-border bg-muted/20 p-5">
            <div className="grid gap-4 lg:grid-cols-2">
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">{Silian_t('store.filters.category')}</label>
                <select
                  value={Silian_advancedFilters.category}
                  onChange={(Silian_event) => Silian_handleAdvancedChange('category', Silian_event.target.value)}
                  className="w-full rounded-2xl border border-input bg-background px-3 py-3 text-foreground focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  disabled={Silian_isLoading}
                >
                  <option value="">{Silian_t('store.filters.allCategories')}</option>
                  {Silian_categories.map((Silian_category, Silian_index) => {
                    const Silian_key = (Silian_category.slug || Silian_category.category || Silian_category.name || `category-${Silian_index}`).toString();
                    const Silian_label = Silian_category.name || Silian_category.category || Silian_key;
                    const Silian_count = Silian_category.product_count ?? Silian_category.count ?? Silian_category.total ?? 0;
                    return (
                      <option key={Silian_key} value={Silian_key}>
                        {Silian_t(`store.categories.${Silian_key}`, Silian_label)} ({Silian_count})
                      </option>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">{Silian_t('store.filters.sortBy')}</label>
                <select
                  value={Silian_advancedFilters.sort}
                  onChange={(Silian_event) => Silian_handleAdvancedChange('sort', Silian_event.target.value)}
                  className="w-full rounded-2xl border border-input bg-background px-3 py-3 text-foreground focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                  disabled={Silian_isLoading}
                >
                  {Silian_sortOptions.map((Silian_option) => (
                    <option key={Silian_option.value} value={Silian_option.value}>
                      {Silian_option.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="mt-4">
              <label className="mb-2 block text-sm font-medium text-foreground">{Silian_t('store.filters.pointsRange')}</label>
              <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] sm:items-center">
                <Silian_Input
                  type="number"
                  value={Silian_advancedFilters.min_points}
                  onChange={(Silian_event) => Silian_handleAdvancedChange('min_points', Silian_event.target.value)}
                  placeholder={Silian_t('store.filters.minPoints')}
                  min="0"
                  className="rounded-2xl"
                />
                <span className="hidden text-center text-muted-foreground sm:block">-</span>
                <Silian_Input
                  type="number"
                  value={Silian_advancedFilters.max_points}
                  onChange={(Silian_event) => Silian_handleAdvancedChange('max_points', Silian_event.target.value)}
                  placeholder={Silian_t('store.filters.maxPoints')}
                  min="0"
                  className="rounded-2xl"
                />
              </div>
            </div>

            <div className="mt-5 rounded-[22px] border border-border bg-background/80 p-4">
              <label className="mb-2 flex items-center gap-2 text-sm font-medium text-foreground">
                <Silian_Tag className="h-4 w-4 text-muted-foreground" />
                {Silian_t('store.filters.tags')}
              </label>

              <div className="mb-3 flex flex-wrap gap-2">
                {Silian_selectedTags.map((Silian_tag, Silian_index) => (
                  <Silian_Badge key={`draft-tag-${Silian_tag.slug}-${Silian_index}`} variant="secondary" className="flex items-center gap-1 uppercase">
                    <span>{Silian_tag.name || Silian_tag.slug}</span>
                    <button
                      type="button"
                      className="rounded-full p-0.5 hover:bg-muted"
                      onClick={() => Silian_removeDraftTag(Silian_index)}
                      aria-label={Silian_t('store.filters.removeTag')}
                    >
                      <Silian_X className="h-3 w-3" />
                    </button>
                  </Silian_Badge>
                ))}
              </div>

              <div className="flex flex-col gap-2 md:flex-row">
                <Silian_Input
                  value={Silian_tagQuery}
                  onChange={(Silian_event) => Silian_setTagQuery(Silian_event.target.value)}
                  onKeyDown={(Silian_event) => {
                    if (Silian_event.key === 'Enter') {
                      Silian_event.preventDefault();
                      if (Silian_tagQuery.trim()) {
                        Silian_addTag({ name: Silian_tagQuery.trim(), slug: Silian_normalizeSlugValue(Silian_tagQuery.trim()) });
                        Silian_setTagQuery('');
                      }
                    }
                  }}
                  placeholder={Silian_t('store.filters.tagPlaceholder')}
                  disabled={Silian_isLoading}
                  className="rounded-2xl"
                />
                <Silian_Button
                  type="button"
                  variant="outline"
                  className="rounded-2xl"
                  onClick={() => {
                    if (Silian_tagQuery.trim()) {
                      Silian_addTag({ name: Silian_tagQuery.trim(), slug: Silian_normalizeSlugValue(Silian_tagQuery.trim()) });
                      Silian_setTagQuery('');
                    }
                  }}
                  disabled={!Silian_tagQuery.trim() || Silian_isLoading}
                >
                  {Silian_t('store.filters.addTag')}
                </Silian_Button>
              </div>

              <p className="mt-2 text-xs text-muted-foreground">{Silian_t('store.filters.tagHint')}</p>

              <div className="mt-4 rounded-2xl border border-border bg-muted/40">
                <div className="flex items-center justify-between border-b border-border px-3 py-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  <span>{Silian_t('store.filters.suggestions')}</span>
                  {Silian_tagsLoading ? <Silian_Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" /> : null}
                </div>
                <div className="max-h-44 overflow-y-auto">
                  {Silian_tagSuggestions.length === 0 && !Silian_tagsLoading ? (
                    <div className="px-3 py-2 text-sm text-muted-foreground">{Silian_t('store.filters.noTagSuggestions')}</div>
                  ) : (
                    Silian_tagSuggestions.map((Silian_suggestion, Silian_index) => (
                      <button
                        type="button"
                        key={`tag-suggestion-${Silian_suggestion.id ?? Silian_suggestion.slug ?? Silian_suggestion.name ?? Silian_index}`}
                        onClick={() => {
                          Silian_addTag(Silian_suggestion);
                          Silian_setTagQuery('');
                        }}
                        className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-foreground hover:bg-background/70"
                      >
                        <span>{Silian_suggestion.name}</span>
                        {Silian_suggestion.slug ? <span className="text-xs uppercase text-muted-foreground">{Silian_suggestion.slug}</span> : null}
                      </button>
                    ))
                  )}
                </div>
              </div>
            </div>

            <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div className="text-sm text-muted-foreground">
                {Silian_t('store.filters.refinedResults')}
              </div>
              <div className="flex gap-2">
                <Silian_Button type="button" variant="outline" className="rounded-2xl" onClick={Silian_clearAllFilters}>
                  {Silian_t('store.filters.clear')}
                </Silian_Button>
                <Silian_Button type="button" className="rounded-2xl" onClick={Silian_applyAdvancedFilters} disabled={Silian_isLoading}>
                  {Silian_t('store.filters.applyAdvanced')}
                </Silian_Button>
              </div>
            </div>
          </div>
        </Silian_CollapsibleContent>
      </Silian_Collapsible>

      {Silian_hasAnyFilters ? (
        <div className="mt-5 rounded-[22px] border border-blue-500/15 bg-blue-500/8 p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-2 text-sm font-medium text-blue-600 dark:text-blue-300">
              <Silian_Filter className="h-4 w-4" />
              <span>{Silian_t('store.filters.activeFilters')}</span>
            </div>
            <Silian_Button type="button" variant="ghost" size="sm" onClick={Silian_clearAllFilters}>
              {Silian_t('store.filters.clear')}
            </Silian_Button>
          </div>

          <div className="mt-3 flex flex-wrap gap-2">
            {Silian_filters.search ? (
              <button
                type="button"
                onClick={() => Silian_removeAppliedFilter('search')}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-800 dark:bg-blue-500/20 dark:text-blue-100"
              >
                <span>{Silian_t('store.filters.search')}: "{Silian_filters.search}"</span>
                <Silian_X className="h-3 w-3" />
              </button>
            ) : null}

            {Silian_filters.category ? (
              <button
                type="button"
                onClick={() => Silian_removeAppliedFilter('category')}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-800 dark:bg-blue-500/20 dark:text-blue-100"
              >
                <span>{Silian_t(`store.categories.${Silian_filters.category}`, Silian_filters.category)}</span>
                <Silian_X className="h-3 w-3" />
              </button>
            ) : null}

            {(Silian_filters.min_points || Silian_filters.max_points) ? (
              <button
                type="button"
                onClick={() => Silian_removeAppliedFilter('range')}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-800 dark:bg-blue-500/20 dark:text-blue-100"
              >
                <span>{Silian_filters.min_points || 0} - {Silian_filters.max_points || '∞'} {Silian_t('common.points')}</span>
                <Silian_X className="h-3 w-3" />
              </button>
            ) : null}

            {(Silian_filters.sort ?? Silian_DEFAULT_SORT) !== Silian_DEFAULT_SORT ? (
              <button
                type="button"
                onClick={() => Silian_removeAppliedFilter('sort')}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-800 dark:bg-blue-500/20 dark:text-blue-100"
              >
                <span>{Silian_sortOptions.find((Silian_option) => Silian_option.value === Silian_filters.sort)?.label ?? Silian_filters.sort}</span>
                <Silian_X className="h-3 w-3" />
              </button>
            ) : null}

            {Silian_normalizeTagList(Silian_filters.tags).map((Silian_tag, Silian_index) => (
              <button
                type="button"
                key={`applied-tag-${Silian_tag.slug || Silian_tag}-${Silian_index}`}
                onClick={() => Silian_removeAppliedFilter('tag', Silian_tag.slug || Silian_tag)}
                className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-3 py-1 text-xs text-blue-800 dark:bg-blue-500/20 dark:text-blue-100"
              >
                <span>{Silian_tag.name || Silian_tag.slug || Silian_tag}</span>
                <Silian_X className="h-3 w-3" />
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
