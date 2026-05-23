import Silian_React, { useCallback as Silian_useCallback, useEffect as Silian_useEffect, useMemo as Silian_useMemo, useState as Silian_useState } from 'react';
import {
  AlertCircle as Silian_AlertCircle,
  ArrowLeft as Silian_ArrowLeft,
  ChevronDown as Silian_ChevronDown,
  ChevronUp as Silian_ChevronUp,
  Clock3 as Silian_Clock3,
  Coins as Silian_Coins,
  History as Silian_History,
  MapPin as Silian_MapPin,
  Package as Silian_Package,
  Phone as Silian_Phone,
  Search as Silian_Search,
  SlidersHorizontal as Silian_SlidersHorizontal,
  StickyNote as Silian_StickyNote,
  Truck as Silian_Truck,
  X as Silian_X,
} from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { productAPI as Silian_productAPI } from '../lib/api';
import { formatDateSafe as Silian_formatDateSafe, formatNumber as Silian_formatNumber } from '../lib/utils';
import { Alert as Silian_Alert } from '../components/ui/Alert';
import { Button as Silian_Button } from '../components/ui/Button';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardTitle as Silian_CardTitle } from '../components/ui/Card';
import { Badge as Silian_Badge } from '../components/ui/badge';
import { Pagination as Silian_Pagination } from '../components/ui/Pagination';
import { Collapsible as Silian_Collapsible, CollapsibleContent as Silian_CollapsibleContent } from '../components/ui/collapsible';
import { Input as Silian_Input } from '../components/ui/Input';
import Silian_R2Image from '../components/common/R2Image';

const Silian_STATUS_STYLES = {
  pending: 'border-blue-500/25 bg-blue-500/12 text-blue-600 dark:border-blue-400/30 dark:bg-blue-500/20 dark:text-blue-300',
  processing: 'border-indigo-500/25 bg-indigo-500/12 text-indigo-600 dark:border-indigo-400/30 dark:bg-indigo-500/20 dark:text-indigo-300',
  completed: 'border-emerald-500/25 bg-emerald-500/12 text-emerald-600 dark:border-emerald-400/30 dark:bg-emerald-500/20 dark:text-emerald-300',
  shipped: 'border-amber-500/25 bg-amber-500/12 text-amber-600 dark:border-amber-400/30 dark:bg-amber-500/20 dark:text-amber-300',
  rejected: 'border-red-500/25 bg-red-500/12 text-red-600 dark:border-red-400/30 dark:bg-red-500/20 dark:text-red-300',
  cancelled: 'border-slate-400/25 bg-slate-500/10 text-slate-600 dark:border-slate-400/30 dark:bg-slate-500/20 dark:text-slate-300',
  default: 'border-border bg-muted/70 text-foreground',
};

const Silian_DEFAULT_FILTERS = {
  search: '',
  status: '',
  sort: 'created_at_desc',
  date_from: '',
  date_to: '',
};

function Silian_getStatusBadgeClass(Silian_status) {
  return Silian_STATUS_STYLES[String(Silian_status || '').toLowerCase()] || Silian_STATUS_STYLES.default;
}

function Silian_getStatusLabel(Silian_status, Silian_t) {
  const Silian_normalized = String(Silian_status || '').toLowerCase();
  return Silian_t(`store.history.statuses.${Silian_normalized}`, {
    defaultValue: Silian_status || Silian_t('store.history.statuses.unknown'),
  });
}

function Silian_formatContact(Silian_exchange) {
  const Silian_areaCode = typeof Silian_exchange.contact_area_code === 'string' ? Silian_exchange.contact_area_code.trim() : '';
  const Silian_phone = typeof Silian_exchange.contact_phone === 'string' ? Silian_exchange.contact_phone.trim() : '';
  return [Silian_areaCode, Silian_phone].filter(Boolean).join(' ');
}

function Silian_resolveProductName(Silian_exchange, Silian_t) {
  return Silian_exchange.current_product_name || Silian_exchange.product_name || Silian_exchange.product?.name || Silian_t('store.history.unknownProduct');
}

function Silian_resolveExchangeImage(Silian_exchange) {
  const Silian_source = Array.isArray(Silian_exchange.current_product_images) && Silian_exchange.current_product_images.length > 0
    ? Silian_exchange.current_product_images[0]
    : Silian_exchange.current_product_images;

  if (!Silian_source) {
    return { src: null, filePath: null };
  }

  if (typeof Silian_source === 'string') {
    const Silian_isHttp = /^https?:\/\//.test(Silian_source);
    return { src: Silian_isHttp ? Silian_source : null, filePath: Silian_isHttp ? null : Silian_source };
  }

  if (typeof Silian_source === 'object') {
    const Silian_publicUrl = typeof Silian_source.public_url === 'string' && Silian_source.public_url ? Silian_source.public_url : null;
    const Silian_url = typeof Silian_source.url === 'string' && Silian_source.url ? Silian_source.url : null;
    const Silian_presignedUrl = typeof Silian_source.presigned_url === 'string' && Silian_source.presigned_url ? Silian_source.presigned_url : null;
    const Silian_src = Silian_publicUrl || Silian_url || Silian_presignedUrl || null;
    const Silian_filePath = typeof Silian_source.file_path === 'string' && Silian_source.file_path ? Silian_source.file_path : null;
    return { src: Silian_src, filePath: Silian_filePath };
  }

  return { src: null, filePath: null };
}

function Silian_OverviewCard({ icon: Silian_icon, label: Silian_label, value: Silian_value, hint: Silian_hint, accentClass: Silian_accentClass }) {
  const Silian_iconElement = Silian_React.createElement(Silian_icon, { className: 'h-5 w-5' });

  return (
    <Silian_Card className="border border-black/5 bg-card/90 shadow-[0_8px_30px_rgb(0,0,0,0.04)] transition-all duration-300 hover:shadow-[0_8px_30px_rgb(0,0,0,0.08)] dark:bg-white/5 dark:border-white/10 dark:shadow-none dark:hover:bg-white/10 dark:backdrop-blur-md">
      <Silian_CardContent className="flex items-start gap-4 p-5">
        <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ${Silian_accentClass}`}>
          {Silian_iconElement}
        </div>
        <div className="min-w-0">
          <p className="text-sm text-muted-foreground">{Silian_label}</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-foreground">{Silian_value}</p>
          <p className="mt-1 text-xs text-muted-foreground">{Silian_hint}</p>
        </div>
      </Silian_CardContent>
    </Silian_Card>
  );
}

function Silian_InfoBlock({ icon: Silian_icon, label: Silian_label, value: Silian_value }) {
  const Silian_Icon = Silian_icon;

  return (
    <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-card p-4 dark:bg-white/5 dark:backdrop-blur-sm">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
        <Silian_Icon className="h-4 w-4 text-muted-foreground" />
        <span>{Silian_label}</span>
      </div>
      <p className="break-words text-sm text-foreground">{Silian_value}</p>
    </div>
  );
}

function Silian_ExchangeCard({ exchange: Silian_exchange, t: Silian_t }) {
  const Silian_contact = Silian_formatContact(Silian_exchange);
  const Silian_productName = Silian_resolveProductName(Silian_exchange, Silian_t);
  const Silian_imageMeta = Silian_resolveExchangeImage(Silian_exchange);
  const Silian_totalPoints = Number(Silian_exchange.points_used ?? Silian_exchange.total_points ?? 0);
  const Silian_quantity = Number(Silian_exchange.quantity ?? 1);
  const Silian_unitPoints = Silian_quantity > 0 ? Silian_totalPoints / Silian_quantity : Silian_totalPoints;

  return (
    <Silian_Card className="overflow-hidden border-black/5 dark:border-white/10 bg-card shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none dark:bg-white/5 dark:backdrop-blur-md">
      <div className="flex flex-col gap-3 border-b border-black/5 dark:border-white/10 bg-muted/20 dark:bg-black/20 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded-full border border-black/5 dark:border-white/10 bg-background/70 dark:bg-black/20 px-3 py-1">
              {Silian_t('store.history.exchangeId')}: {Silian_exchange.id}
            </span>
            <span>{Silian_t('store.history.orderDate')}: {Silian_formatDateSafe(Silian_exchange.created_at, 'yyyy-MM-dd HH:mm', '--')}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Silian_Badge className={Silian_getStatusBadgeClass(Silian_exchange.status)}>
              {Silian_getStatusLabel(Silian_exchange.status, Silian_t)}
            </Silian_Badge>
            {Silian_exchange.tracking_number ? <span className="text-sm text-muted-foreground">{Silian_t('store.history.trackingNumber')}: {Silian_exchange.tracking_number}</span> : null}
          </div>
        </div>
      </div>

      <Silian_CardContent className="p-0">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="border-b border-black/5 dark:border-white/10 p-6 lg:border-b-0 lg:border-r">
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="h-28 w-full shrink-0 overflow-hidden rounded-2xl border border-black/5 dark:border-white/10 bg-muted/50 sm:w-28">
                {Silian_imageMeta.src || Silian_imageMeta.filePath ? (
                  <Silian_R2Image src={Silian_imageMeta.src || undefined} filePath={Silian_imageMeta.filePath || undefined} alt={Silian_productName} className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted/50 text-muted-foreground">
                    <Silian_Package className="h-8 w-8" />
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">{Silian_t('store.history.productInfo')}</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{Silian_productName}</h2>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Silian_StatTile label={Silian_t('store.history.quantity')} value={Silian_quantity} />
                  <Silian_StatTile label={Silian_t('store.history.unitPoints')} value={`${Silian_formatNumber(Silian_unitPoints)} ${Silian_t('common.points')}`} />
                  <Silian_StatTile label={Silian_t('store.history.pointsUsed')} value={`${Silian_formatNumber(Silian_totalPoints)} ${Silian_t('common.points')}`} />
                </div>
              </div>
            </div>
          </div>
          <div className="space-y-4 bg-muted/10 dark:bg-black/10 p-6">
            <Silian_InfoBlock icon={Silian_MapPin} label={Silian_t('store.history.deliveryInfo')} value={Silian_exchange.delivery_address || Silian_t('store.history.notProvided')} />
            <Silian_InfoBlock icon={Silian_Phone} label={Silian_t('store.history.contactPhone')} value={Silian_contact || Silian_t('store.history.notProvided')} />
            <Silian_InfoBlock icon={Silian_Truck} label={Silian_t('store.history.trackingNumber')} value={Silian_exchange.tracking_number || Silian_t('store.history.notAvailable')} />
            <Silian_InfoBlock icon={Silian_StickyNote} label={Silian_t('store.history.notes')} value={Silian_exchange.notes || Silian_t('store.history.noNotes')} />
          </div>
        </div>
      </Silian_CardContent>
    </Silian_Card>
  );
}

function Silian_StatTile({ label: Silian_label, value: Silian_value }) {
  return (
    <div className="rounded-2xl border border-black/5 dark:border-white/10 bg-background/50 dark:bg-black/20 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{Silian_label}</p>
      <p className="mt-2 text-xl font-semibold text-foreground">{Silian_value}</p>
    </div>
  );
}

export default function ExchangeHistoryPage() {
  const { t: Silian_t } = Silian_useTranslation(['common', 'errors', 'images', 'pagination', 'store']);
  const [Silian_exchanges, Silian_setExchanges] = Silian_useState([]);
  const [Silian_loading, Silian_setLoading] = Silian_useState(true);
  const [Silian_error, Silian_setError] = Silian_useState(null);
  const [Silian_filters, Silian_setFilters] = Silian_useState(Silian_DEFAULT_FILTERS);
  const [Silian_searchInput, Silian_setSearchInput] = Silian_useState('');
  const [Silian_advancedOpen, Silian_setAdvancedOpen] = Silian_useState(false);
  const [Silian_draftAdvancedFilters, Silian_setDraftAdvancedFilters] = Silian_useState({
    status: '',
    sort: 'created_at_desc',
    date_from: '',
    date_to: '',
  });
  const [Silian_pagination, Silian_setPagination] = Silian_useState({
    page: 1,
    pages: 1,
    total: 0,
    limit: 10,
  });

  Silian_useEffect(() => {
    Silian_setSearchInput(Silian_filters.search);
  }, [Silian_filters.search]);

  Silian_useEffect(() => {
    Silian_setDraftAdvancedFilters({
      status: Silian_filters.status,
      sort: Silian_filters.sort,
      date_from: Silian_filters.date_from,
      date_to: Silian_filters.date_to,
    });
    Silian_setAdvancedOpen(Boolean(Silian_filters.status || Silian_filters.date_from || Silian_filters.date_to || Silian_filters.sort !== 'created_at_desc'));
  }, [Silian_filters.status, Silian_filters.sort, Silian_filters.date_from, Silian_filters.date_to]);

  const Silian_overview = Silian_useMemo(() => {
    const Silian_summary = {
      pendingOrders: 0,
      shippedOrders: 0,
      totalPointsSpent: 0,
    };

    Silian_exchanges.forEach((Silian_exchange) => {
      const Silian_normalizedStatus = String(Silian_exchange.status || '').toLowerCase();
      if (Silian_normalizedStatus === 'pending' || Silian_normalizedStatus === 'processing') {
        Silian_summary.pendingOrders += 1;
      }
      if (Silian_normalizedStatus === 'shipped' || Silian_normalizedStatus === 'completed') {
        Silian_summary.shippedOrders += 1;
      }
      Silian_summary.totalPointsSpent += Number(Silian_exchange.points_used ?? Silian_exchange.total_points ?? 0);
    });

    return Silian_summary;
  }, [Silian_exchanges]);

  const Silian_fetchExchanges = Silian_useCallback(async () => {
    try {
      Silian_setLoading(true);
      Silian_setError(null);

      const Silian_params = {
        page: Silian_pagination.page,
        limit: Silian_pagination.limit,
      };

      Object.entries(Silian_filters).forEach(([Silian_key, Silian_value]) => {
        if (Silian_value !== '' && Silian_value !== null && Silian_value !== undefined) {
          Silian_params[Silian_key] = Silian_value;
        }
      });

      const Silian_res = await Silian_productAPI.getExchangeTransactions(Silian_params);

      if (Silian_res.data?.success === false) {
        throw new Error('Exchange history request failed');
      }

      const Silian_items = Array.isArray(Silian_res.data?.data) ? Silian_res.data.data : [];
      const Silian_pageInfo = Silian_res.data?.pagination || {};

      Silian_setExchanges(Silian_items);
      Silian_setPagination((Silian_prev) => ({
        ...Silian_prev,
        page: Silian_pageInfo.page ?? Silian_pageInfo.current_page ?? Silian_prev.page,
        pages: Silian_pageInfo.pages ?? Silian_pageInfo.total_pages ?? 1,
        total: Silian_pageInfo.total ?? Silian_pageInfo.total_items ?? Silian_items.length,
        limit: Silian_pageInfo.limit ?? Silian_pageInfo.per_page ?? Silian_prev.limit,
      }));
    } catch (Silian_fetchError) {
      console.error('Failed to fetch exchange history:', Silian_fetchError);
      Silian_setError(Silian_t('store.history.loadFailed'));
      Silian_setExchanges([]);
    } finally {
      Silian_setLoading(false);
    }
  }, [Silian_filters, Silian_pagination.page, Silian_pagination.limit, Silian_t]);

  Silian_useEffect(() => {
    Silian_fetchExchanges();
  }, [Silian_fetchExchanges]);

  const Silian_statusOptions = Silian_useMemo(() => ([
    { value: '', label: Silian_t('store.history.filters.statusAll') },
    { value: 'pending', label: Silian_t('store.history.statuses.pending') },
    { value: 'processing', label: Silian_t('store.history.statuses.processing') },
    { value: 'shipped', label: Silian_t('store.history.statuses.shipped') },
    { value: 'completed', label: Silian_t('store.history.statuses.completed') },
    { value: 'rejected', label: Silian_t('store.history.statuses.rejected') },
    { value: 'cancelled', label: Silian_t('store.history.statuses.cancelled') },
  ]), [Silian_t]);

  const Silian_sortOptions = Silian_useMemo(() => ([
    { value: 'created_at_desc', label: Silian_t('store.history.filters.sortNewest') },
    { value: 'created_at_asc', label: Silian_t('store.history.filters.sortOldest') },
    { value: 'points_desc', label: Silian_t('store.history.filters.sortPointsHigh') },
    { value: 'points_asc', label: Silian_t('store.history.filters.sortPointsLow') },
  ]), [Silian_t]);

  const Silian_hasAnyFilters = Boolean(
    Silian_filters.search ||
    Silian_filters.status ||
    Silian_filters.date_from ||
    Silian_filters.date_to ||
    Silian_filters.sort !== 'created_at_desc'
  );

  const Silian_activeAdvancedCount = [
    Silian_filters.status,
    Silian_filters.date_from || Silian_filters.date_to ? 'date-range' : '',
    Silian_filters.sort !== 'created_at_desc' ? Silian_filters.sort : '',
  ].filter(Boolean).length;

  const Silian_applySearch = (Silian_event) => {
    Silian_event.preventDefault();
    Silian_setPagination((Silian_prev) => ({ ...Silian_prev, page: 1 }));
    Silian_setFilters((Silian_prev) => ({ ...Silian_prev, search: Silian_searchInput.trim() }));
  };

  const Silian_applyAdvancedFilters = () => {
    Silian_setPagination((Silian_prev) => ({ ...Silian_prev, page: 1 }));
    Silian_setFilters((Silian_prev) => ({
      ...Silian_prev,
      status: Silian_draftAdvancedFilters.status,
      sort: Silian_draftAdvancedFilters.sort,
      date_from: Silian_draftAdvancedFilters.date_from,
      date_to: Silian_draftAdvancedFilters.date_to,
    }));
  };

  const Silian_clearAllFilters = () => {
    Silian_setSearchInput('');
    Silian_setPagination((Silian_prev) => ({ ...Silian_prev, page: 1 }));
    Silian_setFilters(Silian_DEFAULT_FILTERS);
    Silian_setDraftAdvancedFilters({
      status: '',
      sort: 'created_at_desc',
      date_from: '',
      date_to: '',
    });
  };

  const Silian_removeAppliedFilter = (Silian_key) => {
    if (Silian_key === 'search') {
      Silian_setSearchInput('');
      Silian_setPagination((Silian_prev) => ({ ...Silian_prev, page: 1 }));
      Silian_setFilters((Silian_prev) => ({ ...Silian_prev, search: '' }));
      return;
    }

    if (Silian_key === 'date_range') {
      Silian_setDraftAdvancedFilters((Silian_prev) => ({ ...Silian_prev, date_from: '', date_to: '' }));
      Silian_setPagination((Silian_prev) => ({ ...Silian_prev, page: 1 }));
      Silian_setFilters((Silian_prev) => ({ ...Silian_prev, date_from: '', date_to: '' }));
      return;
    }

    Silian_setDraftAdvancedFilters((Silian_prev) => ({ ...Silian_prev, [Silian_key]: Silian_key === 'sort' ? 'created_at_desc' : '' }));
    Silian_setPagination((Silian_prev) => ({ ...Silian_prev, page: 1 }));
    Silian_setFilters((Silian_prev) => ({ ...Silian_prev, [Silian_key]: Silian_key === 'sort' ? 'created_at_desc' : '' }));
  };

  const Silian_handlePageChange = (Silian_page) => {
    Silian_setPagination((Silian_prev) => ({ ...Silian_prev, page: Silian_page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const Silian_statusPreview = Silian_filters.status
    ? Silian_statusOptions.find((Silian_option) => Silian_option.value === Silian_filters.status)?.label ?? Silian_filters.status
    : Silian_t('store.history.filters.statusAll');
  const Silian_sortPreview = Silian_sortOptions.find((Silian_option) => Silian_option.value === Silian_filters.sort)?.label ?? Silian_t('store.history.filters.sortNewest');
  const Silian_datePreview = Silian_filters.date_from || Silian_filters.date_to
    ? `${Silian_filters.date_from || '...'} - ${Silian_filters.date_to || '...'}`
    : Silian_t('store.history.filters.noDateRange');

  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="absolute top-0 right-0 -z-10 h-[500px] w-[500px] blur-[120px] bg-gradient-to-bl from-green-50/50 via-blue-50/30 to-transparent opacity-50 dark:from-green-900/20 dark:via-blue-900/10 dark:opacity-30 pointer-events-none" />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8 relative">
        <div className="overflow-hidden rounded-[28px] border border-black/5 dark:border-white/10 bg-gradient-to-br from-green-500/10 via-background to-blue-500/10 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-none dark:bg-white/5 dark:backdrop-blur-md">
          <div className="flex flex-col gap-6 px-6 py-7 md:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-sm text-muted-foreground backdrop-blur">
                  <Silian_History className="h-4 w-4" />
                  <span>{Silian_t('store.viewExchangeHistory')}</span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60">{Silian_t('store.history.title')}</h1>
                  <p className="mt-2 max-w-2xl text-muted-foreground">{Silian_t('store.history.subtitle')}</p>
                </div>
              </div>
              <Silian_Button variant="outline" onClick={() => { window.location.href = '/store'; }} className="w-full border-border bg-background/80 md:w-auto">
                <Silian_ArrowLeft className="mr-2 h-4 w-4" />
                {Silian_t('store.history.backToStore')}
              </Silian_Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <Silian_OverviewCard icon={Silian_Package} label={Silian_t('store.history.overview.totalOrders')} value={Silian_pagination.total} hint={Silian_t('store.history.overview.totalOrdersHint')} accentClass="bg-blue-500/12 text-blue-600 dark:bg-blue-500/20 dark:text-blue-300" />
              <Silian_OverviewCard icon={Silian_Clock3} label={Silian_t('store.history.overview.pendingOrders')} value={Silian_overview.pendingOrders} hint={Silian_t('store.history.overview.pendingOrdersHint')} accentClass="bg-amber-500/12 text-amber-600 dark:bg-amber-500/20 dark:text-amber-300" />
              <Silian_OverviewCard icon={Silian_Truck} label={Silian_t('store.history.overview.shippedOrders')} value={Silian_overview.shippedOrders} hint={Silian_t('store.history.overview.shippedOrdersHint')} accentClass="bg-emerald-500/12 text-emerald-600 dark:bg-emerald-500/20 dark:text-emerald-300" />
              <Silian_OverviewCard icon={Silian_Coins} label={Silian_t('store.history.overview.pointsSpent')} value={`${Silian_formatNumber(Silian_overview.totalPointsSpent)} ${Silian_t('common.points')}`} hint={Silian_t('store.history.overview.pointsSpentHint')} accentClass="bg-green-500/12 text-green-600 dark:bg-green-500/20 dark:text-green-300" />
            </div>
          </div>
        </div>

        <div className="rounded-[28px] border border-black/5 bg-card/95 p-6 shadow-[0_18px_60px_rgba(15,23,42,0.08)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.45fr)_minmax(280px,0.85fr)]">
            <div className="space-y-5">
              <div className="space-y-2">
                <div className="inline-flex items-center gap-2 rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-1 text-xs font-medium uppercase tracking-[0.18em] text-sky-600 dark:text-sky-300">
                  <Silian_Search className="h-3.5 w-3.5" />
                  <span>{Silian_t('store.history.filters.searchTitle')}</span>
                </div>
                <div>
                  <h2 className="text-2xl font-semibold tracking-tight text-foreground">{Silian_t('store.history.filters.searchHeading')}</h2>
                  <p className="mt-1 text-sm text-muted-foreground">{Silian_t('store.history.filters.searchDescription')}</p>
                </div>
              </div>

              <form onSubmit={Silian_applySearch} className="flex flex-col gap-3 md:flex-row">
                <div className="relative flex-1">
                  <Silian_Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Silian_Input
                    type="text"
                    value={Silian_searchInput}
                    onChange={(Silian_event) => Silian_setSearchInput(Silian_event.target.value)}
                    placeholder={Silian_t('store.history.filters.searchPlaceholder')}
                    className="h-12 rounded-2xl border-border bg-background pl-10"
                    disabled={Silian_loading}
                  />
                </div>
                <div className="flex gap-2">
                  <Silian_Button type="submit" className="h-12 rounded-2xl px-5" disabled={Silian_loading}>
                    {Silian_t('store.history.filters.searchButton')}
                  </Silian_Button>
                  {Silian_filters.search ? (
                    <Silian_Button type="button" variant="outline" className="h-12 rounded-2xl px-4" onClick={() => Silian_removeAppliedFilter('search')}>
                      <Silian_X className="mr-2 h-4 w-4" />
                      {Silian_t('store.history.filters.clearSearch')}
                    </Silian_Button>
                  ) : null}
                </div>
              </form>

              <p className="text-sm text-muted-foreground">{Silian_t('store.history.filters.searchHint')}</p>
            </div>

            <div className="rounded-[24px] border border-black/5 bg-muted/30 p-5 dark:border-white/10 dark:bg-black/15">
              <div className="flex items-start justify-between gap-4">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background/80 px-3 py-1 text-xs font-medium uppercase tracking-[0.16em] text-muted-foreground">
                    <Silian_SlidersHorizontal className="h-3.5 w-3.5" />
                    <span>{Silian_t('store.history.filters.advancedTitle')}</span>
                  </div>
                  <p className="text-sm text-muted-foreground">{Silian_t('store.history.filters.advancedDescription')}</p>
                </div>
                <Silian_Button type="button" variant="outline" className="rounded-2xl" onClick={() => Silian_setAdvancedOpen((Silian_prev) => !Silian_prev)}>
                  {Silian_advancedOpen ? <Silian_ChevronUp className="mr-2 h-4 w-4" /> : <Silian_ChevronDown className="mr-2 h-4 w-4" />}
                  {Silian_t('store.history.filters.advancedToggle', { count: Silian_activeAdvancedCount })}
                </Silian_Button>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-3">
                <Silian_StatPreview label={Silian_t('store.history.filters.status')} value={Silian_statusPreview} />
                <Silian_StatPreview label={Silian_t('store.history.filters.sort')} value={Silian_sortPreview} />
                <Silian_StatPreview label={Silian_t('store.history.filters.dateRange')} value={Silian_datePreview} />
              </div>
            </div>
          </div>

          <Silian_Collapsible open={Silian_advancedOpen} onOpenChange={Silian_setAdvancedOpen}>
            <Silian_CollapsibleContent className="mt-6">
              <div className="rounded-[24px] border border-border bg-muted/20 p-5">
                <div className="grid gap-4 lg:grid-cols-2">
                  <Silian_SelectField label={Silian_t('store.history.filters.status')} value={Silian_draftAdvancedFilters.status} onChange={(Silian_value) => Silian_setDraftAdvancedFilters((Silian_prev) => ({ ...Silian_prev, status: Silian_value }))} options={Silian_statusOptions} disabled={Silian_loading} />
                  <Silian_SelectField label={Silian_t('store.history.filters.sort')} value={Silian_draftAdvancedFilters.sort} onChange={(Silian_value) => Silian_setDraftAdvancedFilters((Silian_prev) => ({ ...Silian_prev, sort: Silian_value }))} options={Silian_sortOptions} disabled={Silian_loading} />
                </div>

                <div className="mt-4 grid gap-4 lg:grid-cols-2">
                  <Silian_DateField label={Silian_t('store.history.filters.dateFrom')} value={Silian_draftAdvancedFilters.date_from} onChange={(Silian_value) => Silian_setDraftAdvancedFilters((Silian_prev) => ({ ...Silian_prev, date_from: Silian_value }))} disabled={Silian_loading} />
                  <Silian_DateField label={Silian_t('store.history.filters.dateTo')} value={Silian_draftAdvancedFilters.date_to} onChange={(Silian_value) => Silian_setDraftAdvancedFilters((Silian_prev) => ({ ...Silian_prev, date_to: Silian_value }))} disabled={Silian_loading} />
                </div>

                <div className="mt-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="text-sm text-muted-foreground">{Silian_t('store.history.filters.refinedResults')}</div>
                  <div className="flex gap-2">
                    <Silian_Button type="button" variant="outline" className="rounded-2xl" onClick={Silian_clearAllFilters}>{Silian_t('store.history.filters.resetFilters')}</Silian_Button>
                    <Silian_Button type="button" className="rounded-2xl" onClick={Silian_applyAdvancedFilters} disabled={Silian_loading}>{Silian_t('store.history.filters.applyFilters')}</Silian_Button>
                  </div>
                </div>
              </div>
            </Silian_CollapsibleContent>
          </Silian_Collapsible>

          {Silian_hasAnyFilters ? (
            <div className="mt-5 rounded-[22px] border border-blue-500/15 bg-blue-500/8 p-4">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div className="text-sm font-medium text-blue-600 dark:text-blue-300">{Silian_t('store.filters.activeFilters')}</div>
                <Silian_Button type="button" variant="ghost" size="sm" onClick={Silian_clearAllFilters}>{Silian_t('store.history.filters.resetFilters')}</Silian_Button>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {Silian_filters.search ? <Silian_FilterChip label={Silian_t('store.history.filters.searchChip', { value: Silian_filters.search })} onRemove={() => Silian_removeAppliedFilter('search')} /> : null}
                {Silian_filters.status ? <Silian_FilterChip label={Silian_statusPreview} onRemove={() => Silian_removeAppliedFilter('status')} /> : null}
                {Silian_filters.sort !== 'created_at_desc' ? <Silian_FilterChip label={Silian_sortPreview} onRemove={() => Silian_removeAppliedFilter('sort')} /> : null}
                {Silian_filters.date_from || Silian_filters.date_to ? <Silian_FilterChip label={Silian_datePreview} onRemove={() => Silian_removeAppliedFilter('date_range')} /> : null}
              </div>
            </div>
          ) : null}
        </div>

        {Silian_error ? (
          <Silian_Alert variant="destructive" className="border-red-500/20 bg-red-500/5 text-red-700 dark:text-red-200">
            <Silian_AlertCircle className="h-4 w-4" />
            <div className="text-sm">{Silian_error}</div>
          </Silian_Alert>
        ) : null}

        {Silian_loading ? (
          <Silian_LoadingState t={Silian_t} />
        ) : Silian_exchanges.length === 0 ? (
          <Silian_EmptyState hasFilters={Silian_hasAnyFilters} onReset={Silian_clearAllFilters} t={Silian_t} />
        ) : (
          <>
            <div className="space-y-5">
              {Silian_exchanges.map((Silian_exchange) => (
                <Silian_ExchangeCard key={Silian_exchange.id} exchange={Silian_exchange} t={Silian_t} />
              ))}
            </div>

            <div className="rounded-[24px] border border-black/5 bg-card/90 p-5 shadow-[0_10px_35px_rgba(15,23,42,0.06)] dark:border-white/10 dark:bg-white/5 dark:shadow-none">
              <Silian_Pagination
                currentPage={Silian_pagination.page}
                totalPages={Silian_pagination.pages}
                onPageChange={Silian_handlePageChange}
                itemsPerPage={Silian_pagination.limit}
                totalItems={Silian_pagination.total}
              />
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Silian_StatPreview({ label: Silian_label, value: Silian_value }) {
  return (
    <div className="rounded-2xl border border-border bg-background/80 p-4">
      <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{Silian_label}</p>
      <p className="mt-2 text-sm font-medium text-foreground">{Silian_value}</p>
    </div>
  );
}

function Silian_SelectField({ label: Silian_label, value: Silian_value, onChange: Silian_onChange, options: Silian_options, disabled: Silian_disabled = false }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-foreground">{Silian_label}</label>
      <select
        value={Silian_value}
        onChange={(Silian_event) => Silian_onChange(Silian_event.target.value)}
        className="w-full rounded-2xl border border-input bg-background px-3 py-3 text-foreground focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
        disabled={Silian_disabled}
      >
        {Silian_options.map((Silian_option) => (
          <option key={Silian_option.value} value={Silian_option.value}>
            {Silian_option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Silian_DateField({ label: Silian_label, value: Silian_value, onChange: Silian_onChange, disabled: Silian_disabled = false }) {
  return (
    <div>
      <label className="mb-2 block text-sm font-medium text-foreground">{Silian_label}</label>
      <Silian_Input
        type="date"
        value={Silian_value}
        onChange={(Silian_event) => Silian_onChange(Silian_event.target.value)}
        className="h-12 rounded-2xl border-border bg-background"
        disabled={Silian_disabled}
      />
    </div>
  );
}

function Silian_FilterChip({ label: Silian_label, onRemove: Silian_onRemove }) {
  return (
    <button
      type="button"
      onClick={Silian_onRemove}
      className="inline-flex items-center gap-2 rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 transition-colors hover:bg-blue-200 dark:bg-blue-500/20 dark:text-blue-100 dark:hover:bg-blue-500/30"
    >
      <span>{Silian_label}</span>
      <Silian_X className="h-3 w-3" />
    </button>
  );
}

function Silian_LoadingState({ t: Silian_t }) {
  return (
    <div className="grid gap-5">
      {Array.from({ length: 3 }).map((Silian__, Silian_index) => (
        <Silian_Card key={`exchange-skeleton-${Silian_index}`} className="overflow-hidden border-black/5 dark:border-white/10 bg-card/80 dark:bg-white/5">
          <Silian_CardContent className="space-y-4 p-6">
            <div className="h-5 w-40 animate-pulse rounded-full bg-muted" />
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
              <div className="space-y-4">
                <div className="h-8 w-64 animate-pulse rounded-2xl bg-muted" />
                <div className="grid gap-3 sm:grid-cols-3">
                  {Array.from({ length: 3 }).map((Silian___, Silian_statIndex) => (
                    <div key={`exchange-skeleton-stat-${Silian_index}-${Silian_statIndex}`} className="h-24 animate-pulse rounded-2xl bg-muted/80" />
                  ))}
                </div>
              </div>
              <div className="grid gap-3">
                {Array.from({ length: 4 }).map((Silian___, Silian_blockIndex) => (
                  <div key={`exchange-skeleton-block-${Silian_index}-${Silian_blockIndex}`} className="h-24 animate-pulse rounded-2xl bg-muted/70" />
                ))}
              </div>
            </div>
          </Silian_CardContent>
        </Silian_Card>
      ))}
      <p className="text-center text-sm text-muted-foreground">{Silian_t('store.history.loading')}</p>
    </div>
  );
}

function Silian_EmptyState({ hasFilters: Silian_hasFilters, onReset: Silian_onReset, t: Silian_t }) {
  return (
    <Silian_Card className="border-dashed border-black/10 bg-card/80 text-center shadow-none dark:border-white/10 dark:bg-white/5">
      <Silian_CardContent className="flex flex-col items-center gap-4 px-6 py-14">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/70 text-muted-foreground">
          <Silian_Package className="h-8 w-8" />
        </div>
        <div className="space-y-2">
          <Silian_CardTitle>{Silian_hasFilters ? Silian_t('store.history.emptyFilteredTitle') : Silian_t('store.history.emptyTitle')}</Silian_CardTitle>
          <Silian_CardDescription className="max-w-md text-sm leading-6">
            {Silian_hasFilters ? Silian_t('store.history.emptyFilteredDescription') : Silian_t('store.history.emptyDescription')}
          </Silian_CardDescription>
        </div>
        {Silian_hasFilters ? (
          <Silian_Button type="button" variant="outline" className="rounded-2xl" onClick={Silian_onReset}>
            {Silian_t('store.history.filters.resetFilters')}
          </Silian_Button>
        ) : (
          <Silian_Button type="button" className="rounded-2xl" onClick={() => { window.location.href = '/store'; }}>
            {Silian_t('store.history.backToStore')}
          </Silian_Button>
        )}
      </Silian_CardContent>
    </Silian_Card>
  );
}
