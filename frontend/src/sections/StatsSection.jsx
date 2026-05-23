import Silian_React, { useMemo as Silian_useMemo } from 'react';
import { useQuery as Silian_useQuery } from 'react-query';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { statsAPI as Silian_statsAPI } from '../lib/api';

const Silian_ACCENT_CLASSES = ['text-green-600', 'text-blue-600', 'text-purple-600', 'text-orange-600'];

export default function StatsSection() {
  const { t: Silian_t, currentLanguage: Silian_currentLanguage } = Silian_useTranslation(['home', 'units']);
  const Silian_integerFormatter = Silian_useMemo(() => new Intl.NumberFormat(Silian_currentLanguage), [Silian_currentLanguage]);
  const Silian_compactFormatter = Silian_useMemo(
    () => new Intl.NumberFormat(Silian_currentLanguage, { notation: 'compact', maximumFractionDigits: 1 }),
    [Silian_currentLanguage]
  );
  const Silian_decimalFormatter = Silian_useMemo(
    () => new Intl.NumberFormat(Silian_currentLanguage, { maximumFractionDigits: 2 }),
    [Silian_currentLanguage]
  );

  const Silian_formatInteger = (Silian_value) => Silian_integerFormatter.format(Math.max(0, Math.round(Silian_value || 0)));
  const Silian_formatCompact = (Silian_value) => Silian_compactFormatter.format(Math.max(0, Silian_value || 0));
  const Silian_formatCarbon = (Silian_value) => {
    const Silian_numericValue = Number(Silian_value || 0);
    if (Silian_numericValue >= 1000) {
      return `${Silian_decimalFormatter.format(Silian_numericValue / 1000)} ${Silian_t('units.t')}`;
    }
    return `${Silian_decimalFormatter.format(Silian_numericValue)} ${Silian_t('units.kg')}`;
  };

  const { data: Silian_summaryData, isLoading: Silian_isLoading, isError: Silian_isError } = Silian_useQuery(
    ['public-stats-summary'],
    async () => {
      const Silian_response = await Silian_statsAPI.getPublicSummary();
      return Silian_response.data?.data ?? {};
    },
    {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    }
  );

  const Silian_summary = Silian_summaryData || {};
  const Silian_metrics = [
    {
      key: 'users',
      label: Silian_t('home.stats.users'),
      value: Silian_formatCompact(Silian_summary.total_users ?? 0),
      accent: Silian_ACCENT_CLASSES[0],
      detail: Silian_t('home.stats.newUsers30d', {
        value: Silian_formatInteger(Silian_summary.new_users_30d ?? 0),
      }),
    },
    {
      key: 'records',
      label: Silian_t('home.stats.activities'),
      value: Silian_formatCompact(Silian_summary.total_records ?? 0),
      accent: Silian_ACCENT_CLASSES[1],
      detail: Silian_t('home.stats.approvedRecords', {
        value: Silian_formatInteger(Silian_summary.approved_records ?? 0),
      }),
    },
    {
      key: 'carbon',
      label: Silian_t('home.stats.carbonSaved'),
      value: Silian_formatCarbon(Silian_summary.total_carbon_saved ?? 0),
      accent: Silian_ACCENT_CLASSES[2],
      detail: Silian_t('home.stats.carbonLast7Days', {
        value: Silian_formatCarbon(Silian_summary.carbon_last7 ?? 0),
      }),
    },
    {
      key: 'points',
      label: Silian_t('home.stats.rewards'),
      value: `${Silian_formatCompact(Silian_summary.total_points_awarded ?? 0)} ${Silian_t('units.points')}`,
      accent: Silian_ACCENT_CLASSES[3],
      detail: Silian_t('home.stats.transactionsLast7', {
        value: Silian_formatInteger(Silian_summary.transactions_last7 ?? 0),
      }),
    },
  ];

  const Silian_updatedAt = Silian_useMemo(() => {
    if (!Silian_summaryData?.generated_at) {
      return null;
    }
    const Silian_date = new Date(Silian_summaryData.generated_at);
    return Number.isNaN(Silian_date.getTime()) ? null : Silian_date;
  }, [Silian_summaryData?.generated_at]);

  const Silian_renderSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
      {Array.from({ length: 4 }).map((Silian__, Silian_index) => (
        <div key={`skeleton-${Silian_index}`} className="text-center">
          <div className="bg-muted mx-auto mb-3 h-8 w-24 animate-pulse rounded" />
          <div className="bg-muted mx-auto h-4 w-20 animate-pulse rounded" />
        </div>
      ))}
    </div>
  );

  const Silian_renderError = () => (
    <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
      {Silian_t('home.stats.loadError')}
    </div>
  );

  const Silian_renderContent = () => (
    <div className="space-y-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        {Silian_metrics.map((Silian_metric) => (
          <div key={Silian_metric.key} className="text-center">
            <div className={`text-3xl font-bold mb-2 ${Silian_metric.accent}`}>{Silian_metric.value}</div>
            <div className="text-muted-foreground text-sm font-medium">{Silian_metric.label}</div>
            {Silian_metric.detail && (
              <div className="text-muted-foreground/80 mt-1 text-xs">{Silian_metric.detail}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <section className="bg-card/70 py-16 px-4 backdrop-blur-sm">
      <div className="max-w-7xl mx-auto">
        {Silian_isLoading && Silian_renderSkeleton()}
        {!Silian_isLoading && Silian_isError && Silian_renderError()}
        {!Silian_isLoading && !Silian_isError && Silian_renderContent()}
        {Silian_updatedAt && (
          <div className="text-muted-foreground/80 mt-6 text-center text-xs">
            {Silian_t('home.stats.updatedAt', { time: Silian_updatedAt.toLocaleString(Silian_currentLanguage) })}
          </div>
        )}
      </div>
    </section>
  );
}
