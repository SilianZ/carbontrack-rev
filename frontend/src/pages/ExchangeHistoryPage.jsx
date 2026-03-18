import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  ArrowLeft,
  Clock3,
  Coins,
  History,
  MapPin,
  Package,
  Phone,
  StickyNote,
  Truck,
} from 'lucide-react';
import { useTranslation } from '../hooks/useTranslation';
import { productAPI } from '../lib/api';
import { formatDateSafe, formatNumber } from '../lib/utils';
import { Alert } from '../components/ui/Alert';
import { Button } from '../components/ui/Button';
import { Card, CardContent, CardDescription, CardTitle } from '../components/ui/Card';
import { Badge } from '../components/ui/badge';
import { Pagination } from '../components/ui/Pagination';
import R2Image from '../components/common/R2Image';

const STATUS_STYLES = {
  pending: 'border-blue-500/25 bg-blue-500/12 text-blue-600 dark:border-blue-400/25 dark:bg-blue-400/15 dark:text-blue-300',
  completed: 'border-emerald-500/25 bg-emerald-500/12 text-emerald-600 dark:border-emerald-400/25 dark:bg-emerald-400/15 dark:text-emerald-300',
  shipped: 'border-amber-500/25 bg-amber-500/12 text-amber-600 dark:border-amber-400/25 dark:bg-amber-400/15 dark:text-amber-300',
  rejected: 'border-red-500/25 bg-red-500/12 text-red-600 dark:border-red-400/25 dark:bg-red-400/15 dark:text-red-300',
  cancelled: 'border-red-500/25 bg-red-500/12 text-red-600 dark:border-red-400/25 dark:bg-red-400/15 dark:text-red-300',
  default: 'border-border bg-muted/70 text-foreground',
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
    <Card className="border-border/80 bg-card/90 shadow-sm">
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

function ExchangeCard({ exchange, t }) {
  const contact = formatContact(exchange);
  const productName = resolveProductName(exchange, t);
  const imageMeta = resolveExchangeImage(exchange);
  const totalPoints = Number(exchange.points_used ?? exchange.total_points ?? 0);
  const quantity = Number(exchange.quantity ?? 1);
  const unitPoints = quantity > 0 ? totalPoints / quantity : totalPoints;

  return (
    <Card className="overflow-hidden border-border/80 bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border/70 bg-muted/20 px-6 py-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex min-w-0 flex-col gap-2">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <span className="rounded-full border border-border bg-background/70 px-3 py-1">
              {t('store.history.exchangeId')}: {exchange.id}
            </span>
            <span>{t('store.history.orderDate')}: {formatDateSafe(exchange.created_at, 'yyyy-MM-dd HH:mm', '--')}</span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className={getStatusBadgeClass(exchange.status)}>
              {getStatusLabel(exchange.status, t)}
            </Badge>
            {exchange.tracking_number && (
              <span className="text-sm text-muted-foreground">
                {t('store.history.trackingNumber')}: {exchange.tracking_number}
              </span>
            )}
          </div>
        </div>
      </div>

      <CardContent className="p-0">
        <div className="grid gap-0 lg:grid-cols-[minmax(0,1.2fr)_minmax(320px,0.8fr)]">
          <div className="border-b border-border/70 p-6 lg:border-b-0 lg:border-r">
            <div className="flex flex-col gap-5 sm:flex-row">
              <div className="h-28 w-full shrink-0 overflow-hidden rounded-2xl border border-border bg-muted sm:w-28">
                {imageMeta.src || imageMeta.filePath ? (
                  <R2Image
                    src={imageMeta.src || undefined}
                    filePath={imageMeta.filePath || undefined}
                    alt={productName}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="flex h-full w-full items-center justify-center bg-muted text-muted-foreground">
                    <Package className="h-8 w-8" />
                  </div>
                )}
              </div>

              <div className="min-w-0 flex-1 space-y-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground">
                    {t('store.history.productInfo')}
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{productName}</h2>
                </div>

                <div className="grid gap-3 sm:grid-cols-3">
                  <div className="rounded-2xl border border-border bg-background/80 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{t('store.history.quantity')}</p>
                    <p className="mt-2 text-xl font-semibold text-foreground">{quantity}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/80 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{t('store.history.unitPoints')}</p>
                    <p className="mt-2 text-xl font-semibold text-foreground">
                      {formatNumber(unitPoints)} {t('common.points')}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-border bg-background/80 p-4">
                    <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">{t('store.history.pointsUsed')}</p>
                    <p className="mt-2 text-xl font-semibold text-foreground">
                      {formatNumber(totalPoints)} {t('common.points')}
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-4 bg-muted/15 p-6">
            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <MapPin className="h-4 w-4 text-muted-foreground" />
                <span>{t('store.history.deliveryInfo')}</span>
              </div>
              <p className="break-words text-sm text-foreground">
                {exchange.delivery_address || t('store.history.notProvided')}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <Phone className="h-4 w-4 text-muted-foreground" />
                <span>{t('store.history.contactPhone')}</span>
              </div>
              <p className="break-words text-sm text-foreground">
                {contact || t('store.history.notProvided')}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <Truck className="h-4 w-4 text-muted-foreground" />
                <span>{t('store.history.trackingNumber')}</span>
              </div>
              <p className="break-words text-sm text-foreground">
                {exchange.tracking_number || t('store.history.notAvailable')}
              </p>
            </div>

            <div className="rounded-2xl border border-border bg-card p-4">
              <div className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
                <StickyNote className="h-4 w-4 text-muted-foreground" />
                <span>{t('store.history.notes')}</span>
              </div>
              <p className="break-words text-sm text-foreground">
                {exchange.notes || t('store.history.noNotes')}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ExchangeHistoryPage() {
  const { t } = useTranslation();
  const [exchanges, setExchanges] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [pagination, setPagination] = useState({
    page: 1,
    pages: 1,
    total: 0,
    limit: 10,
  });

  const overview = useMemo(() => {
    const summary = {
      pendingOrders: 0,
      shippedOrders: 0,
      totalPointsSpent: 0,
    };

    exchanges.forEach((exchange) => {
      const normalizedStatus = String(exchange.status || '').toLowerCase();
      if (normalizedStatus === 'pending') {
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

      const res = await productAPI.getExchangeTransactions({
        page: pagination.page,
        limit: pagination.limit,
      });

      if (res.data?.success === false) {
        throw new Error('Exchange history request failed');
      }

      const items = Array.isArray(res.data?.data) ? res.data.data : [];
      const pageInfo = res.data?.pagination || {};

      setExchanges(items);
      setPagination((prev) => ({
        ...prev,
        page: pageInfo.page ?? prev.page,
        pages: pageInfo.pages ?? 1,
        total: pageInfo.total ?? items.length,
        limit: pageInfo.limit ?? prev.limit,
      }));
    } catch (fetchError) {
      console.error('Failed to fetch exchange history:', fetchError);
      setError(t('store.history.loadFailed'));
      setExchanges([]);
    } finally {
      setLoading(false);
    }
  }, [pagination.page, pagination.limit, t]);

  useEffect(() => {
    fetchExchanges();
  }, [fetchExchanges]);

  const handlePageChange = (page) => {
    setPagination((prev) => ({ ...prev, page }));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 py-8">
        <div className="overflow-hidden rounded-[28px] border border-border/80 bg-gradient-to-br from-green-500/10 via-background to-blue-500/10 shadow-sm">
          <div className="flex flex-col gap-6 px-6 py-7 md:px-8">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-2 rounded-full border border-border/80 bg-background/80 px-3 py-1 text-sm text-muted-foreground backdrop-blur">
                  <History className="h-4 w-4" />
                  <span>{t('store.viewExchangeHistory')}</span>
                </div>
                <div>
                  <h1 className="text-3xl font-bold tracking-tight text-foreground">{t('store.history.title')}</h1>
                  <p className="mt-2 max-w-2xl text-muted-foreground">{t('store.history.subtitle')}</p>
                </div>
              </div>
              <Button
                variant="outline"
                onClick={() => { window.location.href = '/store'; }}
                className="w-full border-border bg-background/80 md:w-auto"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                {t('store.history.backToStore')}
              </Button>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <OverviewCard
                icon={Package}
                label={t('store.history.overview.totalOrders')}
                value={pagination.total}
                hint={t('store.history.overview.totalOrdersHint')}
                accentClass="bg-blue-500/12 text-blue-600 dark:bg-blue-400/15 dark:text-blue-300"
              />
              <OverviewCard
                icon={Clock3}
                label={t('store.history.overview.pendingOrders')}
                value={overview.pendingOrders}
                hint={t('store.history.overview.pendingOrdersHint')}
                accentClass="bg-amber-500/12 text-amber-600 dark:bg-amber-400/15 dark:text-amber-300"
              />
              <OverviewCard
                icon={Truck}
                label={t('store.history.overview.shippedOrders')}
                value={overview.shippedOrders}
                hint={t('store.history.overview.shippedOrdersHint')}
                accentClass="bg-emerald-500/12 text-emerald-600 dark:bg-emerald-400/15 dark:text-emerald-300"
              />
              <OverviewCard
                icon={Coins}
                label={t('store.history.overview.pointsSpent')}
                value={`${formatNumber(overview.totalPointsSpent)} ${t('common.points')}`}
                hint={t('store.history.overview.pointsSpentHint')}
                accentClass="bg-green-500/12 text-green-600 dark:bg-green-400/15 dark:text-green-300"
              />
            </div>
          </div>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </Alert>
        )}

        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={`exchange-loading-${index}`} className="animate-pulse overflow-hidden border-border bg-card">
                <div className="h-16 border-b border-border bg-muted/40" />
                <CardContent className="space-y-5 p-6">
                  <div className="flex gap-5">
                    <div className="h-28 w-28 shrink-0 rounded-2xl bg-muted" />
                    <div className="flex-1 space-y-4">
                      <div className="h-8 w-1/3 rounded bg-muted" />
                      <div className="grid gap-3 sm:grid-cols-3">
                        {Array.from({ length: 3 }).map((__, statIndex) => (
                          <div key={`exchange-loading-stat-${statIndex}`} className="h-24 rounded-2xl bg-muted" />
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <div className="h-56 rounded-2xl bg-muted" />
                    <div className="h-56 rounded-2xl bg-muted" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : exchanges.length === 0 ? (
          <Card className="border-border bg-card py-12 text-center shadow-sm">
            <CardContent className="space-y-4">
              <Package className="mx-auto h-14 w-14 text-muted-foreground" />
              <div className="space-y-2">
                <CardTitle className="text-2xl text-foreground">{t('store.history.noRecords')}</CardTitle>
                <CardDescription>{t('store.history.noRecordsDescription')}</CardDescription>
              </div>
              <Button
                onClick={() => { window.location.href = '/store'; }}
                className="bg-green-600 hover:bg-green-700"
              >
                {t('store.history.backToStore')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="space-y-4">
              {exchanges.map((exchange) => (
                <ExchangeCard key={exchange.id} exchange={exchange} t={t} />
              ))}
            </div>

            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.pages}
              onPageChange={handlePageChange}
              itemsPerPage={pagination.limit}
              totalItems={pagination.total}
              className="pt-2"
            />
          </>
        )}
      </div>
    </div>
  );
}
