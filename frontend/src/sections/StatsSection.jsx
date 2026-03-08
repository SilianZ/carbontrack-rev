import React, { useMemo } from 'react';
import { useQuery } from 'react-query';
import { useTranslation } from '../hooks/useTranslation';
import { statsAPI } from '../lib/api';

const ACCENT_CLASSES = ['text-green-600', 'text-blue-600', 'text-purple-600', 'text-orange-600'];
const integerFormatter = new Intl.NumberFormat();
const compactFormatter = new Intl.NumberFormat(undefined, { notation: 'compact', maximumFractionDigits: 1 });
const decimalFormatter = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 });

const formatInteger = (value) => integerFormatter.format(Math.max(0, Math.round(value || 0)));
const formatCompact = (value) => compactFormatter.format(Math.max(0, value || 0));

const formatCarbon = (value, t) => {
  const numericValue = Number(value || 0);
  if (numericValue >= 1000) {
    return `${decimalFormatter.format(numericValue / 1000)} ${t('units.t')}`;
  }
  return `${decimalFormatter.format(numericValue)} ${t('units.kg')}`;
};

export default function StatsSection() {
  const { t } = useTranslation();

  const { data: summaryData, isLoading, isError } = useQuery(
    ['public-stats-summary'],
    async () => {
      const response = await statsAPI.getPublicSummary();
      return response.data?.data ?? {};
    },
    {
      staleTime: 60_000,
      refetchOnWindowFocus: false,
    }
  );

  const metrics = useMemo(() => {
    const summary = summaryData || {};
    return [
      {
        key: 'users',
        label: t('home.stats.users'),
        value: formatCompact(summary.total_users ?? 0),
        accent: ACCENT_CLASSES[0],
        detail: t('home.stats.newUsers30d', {
          value: formatInteger(summary.new_users_30d ?? 0),
        }),
      },
      {
        key: 'records',
        label: t('home.stats.activities'),
        value: formatCompact(summary.total_records ?? 0),
        accent: ACCENT_CLASSES[1],
        detail: t('home.stats.approvedRecords', {
          value: formatInteger(summary.approved_records ?? 0),
        }),
      },
      {
        key: 'carbon',
        label: t('home.stats.carbonSaved'),
        value: formatCarbon(summary.total_carbon_saved ?? 0, t),
        accent: ACCENT_CLASSES[2],
        detail: t('home.stats.carbonLast7Days', {
          value: formatCarbon(summary.carbon_last7 ?? 0, t),
        }),
      },
      {
        key: 'points',
        label: t('home.stats.rewards'),
        value: `${formatCompact(summary.total_points_awarded ?? 0)} ${t('units.points')}`,
        accent: ACCENT_CLASSES[3],
        detail: t('home.stats.transactionsLast7', {
          value: formatInteger(summary.transactions_last7 ?? 0),
        }),
      },
    ];
  }, [summaryData, t]);

  const updatedAt = useMemo(() => {
    if (!summaryData?.generated_at) {
      return null;
    }
    const date = new Date(summaryData.generated_at);
    return Number.isNaN(date.getTime()) ? null : date;
  }, [summaryData?.generated_at]);

  const renderSkeleton = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
      {Array.from({ length: 4 }).map((_, index) => (
        <div key={`skeleton-${index}`} className="text-center">
          <div className="mx-auto mb-3 h-8 w-24 animate-pulse rounded bg-gray-200" />
          <div className="mx-auto h-4 w-20 animate-pulse rounded bg-gray-200" />
        </div>
      ))}
    </div>
  );

  const renderError = () => (
    <div className="rounded-md border border-red-200 bg-red-50 p-6 text-center text-sm text-red-600">
      {t('home.stats.loadError')}
    </div>
  );

  const renderContent = () => (
    <div className="space-y-12">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
        {metrics.map((metric) => (
          <div key={metric.key} className="text-center">
            <div className={`text-3xl font-bold mb-2 ${metric.accent}`}>{metric.value}</div>
            <div className="text-gray-600 text-sm font-medium">{metric.label}</div>
            {metric.detail && (
              <div className="mt-1 text-xs text-gray-400">{metric.detail}</div>
            )}
          </div>
        ))}
      </div>
    </div>
  );

  return (
    <section className="py-16 px-4 bg-white">
      <div className="max-w-7xl mx-auto">
        {isLoading && renderSkeleton()}
        {!isLoading && isError && renderError()}
        {!isLoading && !isError && renderContent()}
        {updatedAt && (
          <div className="mt-6 text-center text-xs text-gray-400">
            {t('home.stats.updatedAt', { time: updatedAt.toLocaleString() })}
          </div>
        )}
      </div>
    </section>
  );
}
