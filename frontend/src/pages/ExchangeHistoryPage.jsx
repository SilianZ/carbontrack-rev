import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  ChevronDown,
  ChevronUp,
  Clock3,
  Coins,
  History,
  MapPin,
  Package,
  Phone,
  Search,
  SlidersHorizontal,
  StickyNote,
  Truck,
  X,
} from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { productAPI } from '../lib/api';
import { formatDateSafe, formatNumber } from '../lib/utils';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/badge';
import { Pagination } from '../components/ui/Pagination';
import { Collapsible, CollapsibleContent } from '../components/ui/collapsible';
import { Input } from '../components/ui/Input';
import R2Image from '../components/common/R2Image';

const STATUS_STYLES = {
  pending: 'border-blue-500/25 bg-blue-500/12 text-blue-600 dark:border-blue-400/30 dark:bg-blue-500/20 dark:text-blue-300',
  processing: 'border-indigo-500/25 bg-indigo-500/12 text-indigo-600 dark:border-indigo-400/30 dark:bg-indigo-500/20 dark:text-indigo-300',
  completed: 'border-emerald-500/25 bg-emerald-500/12 text-emerald-600 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-300',
  shipped: 'border-amber-500/25 bg-amber-500/12 text-amber-600 dark:border-amber-400/30 dark:bg-amber-500/20 dark:text-amber-300',
  rejected: 'border-red-500/25 bg-red-500/12 text-red-600 dark:border-red-400/30 dark:bg-red-500/20 dark:text-red-300',
  cancelled: 'border-slate-400/25 bg-slate-500/10 text-slate-600 dark:border-slate-400/30 dark:bg-slate-500/20 dark:text-slate-300',
  default: 'border-border bg-muted/70 text-foreground',
};

const DEFAULT_FILTERS = {
  search: '',
  status: '',
  sort: 'created_at_desc',
  date_from: '',
  date_to: '',
};

function getStatusBadgeClass(status) {
  return STATUS_STYLES[String(status || '').toLowerCase()] || STATUS_STYLES.default;
}

function getStatusLabel(status, t) {
  const normalized = String(status || '').toLowerCase();
  return t(`store.history.statuses.${normalized}`, {
    defaultValue: status || t('store.history.statuses.unknown'),
  });
}

function formatContact(exchange) {
  const areaCode = typeof exchange.contact_area_code === 'string' ? exchange.contact_area_code.trim() : '';
  const phone = typeof exchange.contact_phone === 'string' ? exchange.contact_phone.trim() : '';
  return [areaCode, phone].filter(Boolean).join(' ');
}

function resolveProductName(exchange, t) {
  return exchange.current_product_name || exchange.product_name || exchange.product?.name || t('store.history.unknownProduct');
}

function resolveExchangeImage(exchange) {
  const source = Array.isArray(exchange.current_product_images) && exchange.current_product_images.length > 0
    ? exchange.current_product_images[0]
    : exchange.current_product_images;

  if (!source) {
    return { src: null, filePath: null };
  }

  if (typeof source === 'string') {
    const isHttp = /^https?:\/\//.test(source);
    return { src: isHttp ? source : null, filePath: isHttp ? null : source };
  }

  if (typeof source === 'object') {
    const publicUrl = typeof source.public_url === 'string' && source.public_url ? source.public_url : null;
    const url = typeof source.url === 'string' && source.url ? source.url : null;
    const presignedUrl = typeof source.presigned_url === 'string' && source.presigned_url ? source.presigned_url : null;
    const src = publicUrl || url || presignedUrl || null;
    const filePath = typeof source.file_path === 'string' && source.file_path ? source.file_path : null;
    return { src, filePath };
  }

  return { src: null, filePath: null };
}

function OverviewCard({ icon, label, value, hint, accentClass }) {
  const iconElement = React.createElement(icon, { className: 'h-5 w-5' });

  return (
    <Card className="border border-black/5 bg-card/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:bg-white/5 dark:border-white/10 dark:shadow-none dark:hover:bg-white/10 dark:backdrop-blur-md">
      <CardContent className="flex items-start gap-4 p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${accentClass}`}>
          {iconElement}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
        </div>
      </CardContent>
    </Card>
  );
}

function InfoBlock({ icon, label, value }) {
  const Icon = icon;

  return (
    <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-card p-4 dark:bg-white/5 dark:backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span>{label}</span>
      </div>
      <p className="break-words text-sm text-foreground">{value}</p>
    </div>
  );
}

function ExchangeCard({ exchange, t }) {
  const contact = formatContact(exchange);
  const productName = resolveProductName(exchange, t);
  const imageMeta = resolveExchangeImage(exchange);
  const totalPoints = Number(exchange.points_used ?? exchange.total_points ?? 0);
  const quantity = Number(exchange.quantity ?? 1);
  const unitPoints = quantity > 0 ? totalPoints / quantity : totalPoints;

  return (
    <Card className="overflow-hidden border-black/5 dark:border-white/10 bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none dark:bg-white/5 dark:backdrop-blur-md">
      <div className="flex flex-col gap-3 border-b border-black/5 dark:border-white/10 bg-muted/20 dark:bg-black/20 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded-full border border-black/5 dark:border-white/10 bg-background/70 dark:bg-black/20 px-3 py-1">
              {t('store.history.exchangeId')}: {exchange.id}
            </span>
            <span>{t('store.history.orderDate')}: {formatDateSafe(exchange.created_at, 'yyyy-MM-dd HH:mm', '--')}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={getStatusBadgeClass(exchange.status)}>
              {getStatusLabel(exchange.status, t)}
            </Badge>
            {exchange.tracking_number ? <span className="text-sm text-muted-foreground">{t('store.history.trackingNumber')}: {exchange.tracking_number}</span> : null}
          </div>
        </div>
      </div>

      <CardContent className="p-0">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="border-b border-black/5 dark:border-white/10 p-6 lg:border-b-0 lg:border-r">
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="h-28 w-full shrink-0 overflow-hidden rounded-2xl border border-black/5 dark:border-white/10 bg-muted/50 sm:w-28">
                {imageMeta.src || imageMeta.filePath ? (
                  <R2Image src={imageMeta.src || undefined} filePath={imageMeta.filePath || undefined} alt={productName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted/50 text-muted-foreground">
                    <Package className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{t('store.history.productInfo')}</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{productName}</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <StatTile label={t('store.history.quantity')} value={quantity} />
                  <StatTile label={t('store.history.unitPoints')} value={`${formatNumber(unitPoints)} ${t('common.points')}`} />
                  <StatTile label={t('store.history.pointsUsed')} value={`${formatNumber(totalPoints)} ${t('common.points')}`} />
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4 bg-muted/10 dark:bg-black/10 p-6">
            <InfoBlock icon={MapPin} label={t('store.history.deliveryInfo')} value={exchange.delivery_address || t('store.history.notProvided')} />
            <InfoBlock icon={Phone} label={t('store.history.contactPhone')} value={contact || t('store.history.notProvided')} />
            <InfoBlock icon={Truck} label={t('store.history.trackingNumber')} value={exchange.tracking_number || t('store.history.notAvailable')} />
            <InfoBlock icon={StickyNote} label={t('store.history.notes')} value={exchange.notes || t('store.history.noNotes')} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function StatTile({ label, value }) {
  return (
    <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-background/50 dark:bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-xl font-semibold text-foreground">{value}</p>
    </div>
  );
}

export default function ExchangeHistoryPage() {
  const { t } = useTranslation();
  const [exchanges, setExchanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filters, setFilters] = useState(DEFAULT_FILTERS);
  const [searchInput, setSearchInput] = useState('');
  const [advancedOpen, setAdvancedOpen] = useState(false);
  const [draftAdvancedFilters, setDraftAdvancedFilters] = useState({
    status: '',
    sort: 'created_at_desc',
    date_from: '',
    date_to: '',
  });
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
    limit: 10,
  });

  useEffect(() => {
    setSearchInput(filters.search);
  }, [filters.search]);

  useEffect(() => {
    setDraftAdvancedFilters({
      status: filters.status,
      sort: filters.sort,
      date_from: filters.date_from,
      date_to: filters.date_to,
    });
    setAdvancedOpen(Boolean(filters.status || filters.date_from || filters.date_to || filters.sort !== 'created_at_desc'));
  }, [filters.status, filters.sort, filters.date_from, filters.date_to]);

  const overview = useMemo(() => {
    const summary = {
      pendingOrders: 0,
      shippedOrders: 0,
      totalPointsSpent: 0,
    };

    exchanges.forEach((exchange) => {
      const normalizedStatus = String(exchange.status || '').toLowerCase();
      if (normalizedStatus === 'pending' || normalizedStatus === 'processing') {
        summary.pendingOrders += 1;
      }
      if (normalizedStatus === 'shipped' || normalizedStatus === 'completed') {
        summary.shippedOrders += 1;
      }
      summary.totalPointsSpent += Number(exchange.points_used ?? exchange.total_points ?? 0);
    });

    return summary;
  }, [exchanges]);

  const fetchExchanges = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        page: pagination.page,
        limit: pagination.limit,
      };

      Object.entries(filters).forEach(([key, value]) => {
        if (value !== '' && value !== null && value !== undefined) {
          params[key] = value;
        }
      });

      const res = await productAPI.getExchangeTransactions(params);

      if (res.data?.success === false) {
        throw new Error('Exchange history request failed');
      }

      const items = Array.isArray(res.data?.data) ? res.data.data : [];
      const pageInfo = res.data?.pagination || {};

      setExchanges(items);
      setPagination((prev) => ({
        ...prev,
        page: pageInfo.page ?? pageInfo.current_page ?? prev.page,
        pages: pageInfo.pages ?? pageInfo.total_pages ?? 1,
        total: pageInfo.total ?? pageInfo.total_items ?? items.length,
        limit: pageInfo.limit ?? pageInfo.per_page ?? prev.limit,
      }));
    } catch (fetchError) {
      console.error('Failed to fetch exchange history:', fetchError);
      setError(t('store.history.loadFailed'));
      setExchanges([]);
    } finally {
      setLoading(false);
    }
  }, [filters, pagination.page, pagination.limit, t]);

  useEffect(() => {
    fetchExchanges();
  }, [fetchExchanges]);

  const statusOptions = useMemo(() => ([
    { value: '', label: t('store.history.filters.statusAll') },
    { value: 'pending', label: t('store.history.statuses.pending') },
    { value: 'processing', label: t('store.history.statuses.processing') },
    { value: 'shipped', label: t('store.history.statuses.shipped') },
    { value: 'completed', label: t('store.history.statuses.completed') },
    { value: 'rejected', label: t('store.history.statuses.rejected') },
    { value: 'cancelled', label: t('store.history.statuses.cancelled') },
  ]), [t]);

  const sortOptions = useMemo(() => ([
    { value: 'created_at_desc', label: t('store.history.filters.sortNewest') },
    { value: 'created_at_asc', label: t('store.history.filters.sortOldest') },
    { value: 'points_desc', label: t('store.history.filters.sortPointsHigh') },
    { value: 'points_asc', label: t('store.history.filters.sortPointsLow') },
  ]), [t]);

  const hasAnyFilters = Boolean(
    filters.search ||
    filters.status ||
    filters.date_from ||
    filters.date_to ||
    filters.sort !== 'created_at_desc'
  );

  const activeAdvancedCount = [
    filters.status,
    filters.date_from || filters.date_to ? 'date-range' : '',
    filters.sort !== 'created_at_desc' ? filters.sort : '',
  ].filter(Boolean).length;

  const applySearch = (event) => {
    event.preventDefault();
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFilters((prev) => ({ ...prev, search: searchInput.trim() }));
  };

  const applyAdvancedFilters = () => {
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFilters((prev) => ({
      ...prev,
      status: draftAdvancedFilters.status,
      sort: draftAdvancedFilters.sort,
      date_from: draftAdvancedFilters.date_from,
      date_to: draftAdvancedFilters.date_to,
    }));
  };

  const clearAllFilters = () => {
    setSearchInput('');
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFilters(DEFAULT_FILTERS);
    setDraftAdvancedFilters({
      status: '',
      sort: 'created_at_desc',
      date_from: '',
      date_to: '',
    });
  };

  const removeAppliedFilter = (key) => {
    if (key === 'search') {
      setSearchInput('');
      setPagination((prev) => ({ ...prev, page: 1 }));
      setFilters((prev) => ({ ...prev, search: '' }));
      return;
    }

    if (key === 'date_range') {
      setDraftAdvancedFilters((prev) => ({ ...prev, date_from: '', date_to: '' }));
      setPagination((prev) => ({ ...prev, page: 1 }));
      setFilters((prev) => ({ ...prev, date_from: '', date_to: '' }));
      return;
    }

    setDraftAdvancedFilters((prev) => ({ ...prev, [key]: key === 'sort' ? 'created_at_desc' : '' }));
    setPagination((prev) => ({ ...prev, page: 1 }));
    setFilters((prev) => ({ ...prev, [key]: key === 'sort' ? 'created_at_desc' : '' }));
  };

  const handlePageChange = (page) => {
    setPagination((prev) => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const statusPreview = filters.status
    ? statusOptions.find((option) => option.value === filters.status)?.label ?? filters.status
    : t('store.history.filters.statusAll');
  const sortPreview = sortOptions.find((option) => option.value === filters.sort)?.label ?? t('store.history.filters.sortNewest');
  const datePreview = filters.date_from || filters.date_to
    ? `${filters.date_from || '...'} - ${filters.date_to || '...'}`
    : t('store.history.filters.noDateRange');

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute top-0 right-0 -z-10 h-[500px] w-[500px] blur-[120px] bg-gradient-to-bl from-green-50/50 via-blue-50/30 to-transparent opacity-50 dark:from-green-900/20 dark:via-blue-900/10 dark:opacity-30 pointer-events-none" />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 relative">
        <div className="overflow-hidden rounded-[28px] border border-black/5 dark:border-white/10 bg-gradient-to-br from-green-500/10 via-background to-blue-500/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none dark:bg-white/5 dark:backdrop-blur-md">
          <div className="flex flex-col gap-6 px-6 py-7 md:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-sm text-muted-foreground backdrop-blur">
                  <History className="h-4 w-4" />
                  <span>{t('store.viewExchangeHistory')}</span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60">{t('store.history.title')}</h1>
                  <p className="mt-2 max-w-2xl text-muted-foreground">{t('store.history.subtitle')}</p>
                </div>
              </div>
              <Button variant="outline" onClick={() => { window.location.href = '/store'; }} className="w-full border-border bg-background/80 md:w-auto">
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('store.history.backToStore')}
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <OverviewCard icon={Package} label={t('store.history.overview.totalOrders')} value={pagination.total} hint={t('store.history.overview.totalOrdersHint')} accentClass="bg-blue-500/12 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300" />
              <OverviewCard icon={Clock3} label={t('store.history.overview.pendingOrders')} value={overview.pendingOrders} hint={t('store.history.overview.pendingOrdersHint')} accentClass="bg-amber-500/12 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300" />
              <OverviewCard icon={Truck} label={t('store.history.overview.shippedOrders')} value={overview.shippedOrders} hint={t('store.history.overview.shippedOrdersHint')} accentClass="bg-emerald-500/12 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300" />
              <OverviewCard icon={Coins} label={t('store.history.overview.pointsSpent')} value={`${formatNumber(overview.totalPointsSpent)} ${t('common.points')}`} hint={t('store.history.overview.pointsSpentHint')} accentClass="bg-green-500/12 text-green-600 dark:bg-green-500/20 dark:text-green-300" />
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-black/5 bg-card/95 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)]">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">
                  <Search className="h-3.5 w-3.5" />
                  <span>{t('store.history.filters.searchTitle')}</span>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">{t('store.history.filters.searchHeading')}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{t('store.history.filters.searchDescription')}</p>
                </div>
              </div>

              <form onSubmit={applySearch} className="flex flex-col gap-3 md:flex-row">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    type="text"
                    value={searchInput}
                    onChange={(event) => setSearchInput(event.target.value)}
                    placeholder={t('store.history.filters.searchPlaceholder')}
                    className="h-12 rounded-2xl border-border bg-background pl-10"
                    disabled={loading}
                  />
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="h-12 rounded-2xl px-5" disabled={loading}>
                    {t('store.history.filters.searchButton')}
                  </Button>
                  {filters.search ? (
                    <Button type="button" variant="outline" className="h-12 rounded-2xl px-4" onClick={() => removeAppliedFilter('search')}>
                      <X className="mr-2 h-4 w-4" />
                      {t('store.history.filters.clearSearch')}
                    </Button>
                  ) : null}
                </div>
              </form>

              <p className="text-sm text-muted-foreground">{t('store.history.filters.searchHint')}</p>
            </div>

            <div className="rounded-[24px] border border-black/5 bg-muted/30 p-5 dark:border-white/10 dark:bg-black/15">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    <SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>{t('store.history.filters.advancedTitle')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{t('store.history.filters.advancedDescription')}</p>
                </div>
                <Button type="button" variant="outline" className="rounded-2xl" onClick={() => setAdvancedOpen((prev) => !prev)}>
                  {advancedOpen ? <ChevronUp className="mr-2 h-4 w-4" /> : <ChevronDown className="mr-2 h-4 w-4" />}
                  {t('store.history.filters.advancedToggle', { count: activeAdvancedCount })}
                </Button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <StatPreview label={t('store.history.filters.status')} value={statusPreview} />
                <StatPreview label={t('store.history.filters.sort')} value={sortPreview} />
                <StatPreview label={t('store.history.filters.dateRange')} value={datePreview} />
              </div>
            </div>
          </div>

          <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
            <CollapsibleContent className="mt-6">
              <div className="rounded-[24px] border border-border bg-muted/20 p-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <SelectField label={t('store.history.filters.status')} value={draftAdvancedFilters.status} onChange={(value) => setDraftAdvancedFilters((prev) => ({ ...prev, status: value }))} options={statusOptions} disabled={loading} />
                  <SelectField label={t('store.history.filters.sort')} value={draftAdvancedFilters.sort} onChange={(value) => setDraftAdvancedFilters((prev) => ({ ...prev, sort: value }))} options={sortOptions} disabled={loading} />
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <DateField label={t('store.history.filters.dateFrom')} value={draftAdvancedFilters.date_from} onChange={(value) => setDraftAdvancedFilters((prev) => ({ ...prev, date_from: value }))} disabled={loading} />
                  <DateField label={t('store.history.filters.dateTo')} value={draftAdvancedFilters.date_to} onChange={(value) => setDraftAdvancedFilters((prev) => ({ ...prev, date_to: value }))} disabled={loading} />
                </div>

                <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-muted-foreground">{t('store.history.filters.refinedResults')}</div>
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" className="rounded-2xl" onClick={clearAllFilters}>{t('store.history.filters.resetFilters')}</Button>
                    <Button type="button" className="rounded-2xl" onClick={applyAdvancedFilters} disabled={loading}>{t('store.history.filters.applyFilters')}</Button>
                  </div>
                </div>
              </div>
            </CollapsibleContent>
          </Collapsible>

          {hasAnyFilters ? (
            <div className="mt-5 rounded-[22px] border border-blue-500/15 bg-blue-500/8 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm font-medium text-blue-600 dark:text-blue-300">{t('store.filters.activeFilters')}</div>
                <Button type="button" variant="ghost" size="sm" onClick={clearAllFilters}>{t('store.history.filters.resetFilters')}</Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {filters.search ? <FilterChip label={t('store.history.filters.searchChip', { value: filters.search })} onRemove={() => removeAppliedFilter('search')} /> : null}
                {filters.status ? <FilterChip label={statusPreview} onRemove={() => removeAppliedFilter('status')} /> : null}
                {filters.sort !== 'created_at_desc' ? <FilterChip label={sortPreview} onRemove={() => removeAppliedFilter('sort')} /> : null}
                {filters.date_from || filters.date_to ? <FilterChip label={datePreview} onRemove={() => removeAppliedFilter('date_range')} /> : null}
              </div>
            </div>
          ) : null}
        </div>

        {error ? (
          <Alert variant="destructive" className="border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-200">
            <AlertCircle className="h-4 w-4" />
            <div className="text-sm">{error}</div>
          </Alert>
        ) : null}

        {loading ? (
          <LoadingState t={t} />
        ) : exchanges.length === 0 ? (
          <EmptyState hasFilters={hasAnyFilters} onReset={clearAllFilters} t={t} />
        ) : (
          <>
            <div className="space-y-5">
              {exchanges.map((exchange) => (
                <ExchangeCard key={exchange.id} exchange={exchange} t={t} />
              ))}
            </div>

            <div className="rounded-[24px] border border-black/5 bg-card/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
              <Pagination
                currentPage={pagination.page}
                totalPages={pagination.pages}
                onPageChange={handlePageChange}
                itemsPerPage={pagination.limit}
                totalItems={pagination.total}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatPreview({ label, value }) {
  return (
    <div className="rounded-2xl border border-border bg-background/80 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}

function SelectField({ label, value, onChange, options, disabled = false }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-foreground">{label}</label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full rounded-2xl border border-input bg-background px-3 py-3 text-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        disabled={disabled}
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function DateField({ label, value, onChange, disabled = false }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-foreground">{label}</label>
      <Input
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-12 rounded-2xl border-border bg-background"
        disabled={disabled}
      />
    </div>
  );
}

function FilterChip({ label, onRemove }) {
  return (
    <button
      type="button"
      onClick={onRemove}
      className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 transition-colors hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-100 dark:hover:bg-blue-500/30"
    >
      <span>{label}</span>
      <X className="h-3 w-3" />
    </button>
  );
}

function LoadingState({ t }) {
  return (
    <div className="grid gap-5">
      {Array.from({ length: 3 }).map((_, index) => (
        <Card key={`exchange-skeleton-${index}`} className="overflow-hidden border-black/5 dark:border-white/10 bg-card/80 dark:bg-white/5">
          <CardContent className="space-y-4 p-6">
            <div className="h-5 w-40 animate-pulse rounded-full bg-muted" />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
              <div className="space-y-4">
                <div className="h-8 w-64 animate-pulse rounded-2xl bg-muted" />
                <div className="grid gap-3 sm:grid-cols-3">
                  {Array.from({ length: 3 }).map((__, statIndex) => (
                    <div key={`exchange-skeleton-stat-${index}-${statIndex}`} className="h-24 animate-pulse rounded-2xl bg-muted/80" />
                  ))}
                </div>
              </div>
              <div className="grid gap-3">
                {Array.from({ length: 4 }).map((__, blockIndex) => (
                  <div key={`exchange-skeleton-block-${index}-${blockIndex}`} className="h-24 animate-pulse rounded-2xl bg-muted/70" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
      <p className="text-center text-sm text-muted-foreground">{t('store.history.loading')}</p>
    </div>
  );
}

function EmptyState({ hasFilters, onReset, t }) {
  return (
    <Card className="border-dashed border-black/10 bg-card/80 text-center shadow-none dark:border-white/10 dark:bg-white/5">
      <CardContent className="flex flex-col items-center gap-4 px-6 py-14">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
          <Package className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <CardTitle>{hasFilters ? t('store.history.emptyFilteredTitle') : t('store.history.emptyTitle')}</CardTitle>
          <CardDescription className="max-w-md text-sm leading-6">
            {hasFilters ? t('store.history.emptyFilteredDescription') : t('store.history.emptyDescription')}
          </CardDescription>
        </div>
        {hasFilters ? (
          <Button type="button" variant="outline" className="rounded-2xl" onClick={onReset}>
            {t('store.history.filters.resetFilters')}
          </Button>
        ) : (
          <Button type="button" className="rounded-2xl" onClick={() => { window.location.href = '/store'; }}>
            {t('store.history.backToStore')}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
