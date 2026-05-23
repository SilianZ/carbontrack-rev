import Silian_React, { useEffect as Silian_useEffect, useMemo as Silian_useMemo, useState as Silian_useState } from 'react';
import { useSearchParams as Silian_useSearchParams } from 'react-router-dom';
import { useQuery as Silian_useQuery } from 'react-query';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { ActivityFilters as Silian_ActivityFilters } from '../components/activities/ActivityFilters';
import { ActivityTable as Silian_ActivityTable } from '../components/activities/ActivityTable';
import { ActivityDetailModal as Silian_ActivityDetailModal } from '../components/activities/ActivityDetailModal';
import { Pagination as Silian_Pagination } from '../components/ui/Pagination';
import { carbonAPI as Silian_carbonAPI } from '../lib/api';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription, AlertTitle as Silian_AlertTitle } from '../components/ui/Alert';
import { AlertCircle as Silian_AlertCircle, Loader2 as Silian_Loader2 } from 'lucide-react';

export default function ActivitiesPage() {
  const { t: Silian_t } = Silian_useTranslation(['activities', 'common', 'errors', 'pagination']);
  const [Silian_searchParams, Silian_setSearchParams] = Silian_useSearchParams();
  const [Silian_filters, Silian_setFilters] = Silian_useState({
    search: '',
    category: '',
    status: '',
    start_date: '',
    end_date: '',
    sort: 'created_at_desc',
    page: 1,
    limit: 10
  });
  const [Silian_selectedActivity, Silian_setSelectedActivity] = Silian_useState(null);
  const Silian_activityIdParam = Silian_searchParams.get('activityId');

  const { data: Silian_data, isLoading: Silian_isLoading, error: Silian_error, isFetching: Silian_isFetching } = Silian_useQuery(
    ['activities', Silian_filters],
    () => Silian_carbonAPI.getTransactions(Silian_filters),
    { keepPreviousData: true }
  );

  const { data: Silian_categoriesData } = Silian_useQuery('activityCategories', () => Silian_carbonAPI.getActivities({ grouped: true }));
  const { data: Silian_activityDetailData } = Silian_useQuery(
    ['activityDetail', Silian_activityIdParam],
    () => Silian_carbonAPI.getTransaction(Silian_activityIdParam),
    { enabled: Boolean(Silian_activityIdParam) }
  );

  const Silian_activities = Silian_useMemo(() => Silian_data?.data?.data || [], [Silian_data?.data?.data]);
  const Silian_pagination = Silian_data?.data?.pagination || {};
  const Silian_categories = Silian_categoriesData?.data?.data || [];

  const Silian_selectedActivityFromQuery = Silian_useMemo(() => {
    if (!Silian_activityIdParam) return null;

    const Silian_matchedActivity = Silian_activities.find((Silian_activity) => String(Silian_activity.id) === String(Silian_activityIdParam));
    if (Silian_matchedActivity) {
      return Silian_matchedActivity;
    }

    return (
      Silian_activityDetailData?.data?.data?.data ??
      Silian_activityDetailData?.data?.data ??
      Silian_activityDetailData?.data ??
      null
    );
  }, [Silian_activities, Silian_activityDetailData, Silian_activityIdParam]);

  Silian_useEffect(() => {
    if (!Silian_activityIdParam) {
      Silian_setSelectedActivity(null);
      return;
    }

    if (Silian_selectedActivityFromQuery) {
      Silian_setSelectedActivity(Silian_selectedActivityFromQuery);
    }
  }, [Silian_activityIdParam, Silian_selectedActivityFromQuery]);

  const Silian_handleFiltersChange = (Silian_newFilters) => {
    Silian_setFilters(Silian_newFilters);
  };

  const Silian_handlePageChange = (Silian_page) => {
    Silian_setFilters(Silian_prev => ({ ...Silian_prev, page: Silian_page }));
  };

  const Silian_handleRowClick = (Silian_activity) => {
    Silian_setSelectedActivity(Silian_activity);
    Silian_setSearchParams((Silian_prev) => {
      const Silian_next = new URLSearchParams(Silian_prev);
      Silian_next.set('activityId', String(Silian_activity.id));
      return Silian_next;
    });
  };

  const Silian_closeModal = () => {
    Silian_setSelectedActivity(null);
    Silian_setSearchParams((Silian_prev) => {
      const Silian_next = new URLSearchParams(Silian_prev);
      Silian_next.delete('activityId');
      return Silian_next;
    });
  };

  return (
    <div className="container mx-auto py-8 px-4 relative min-h-[calc(100vh-4rem)]">
      {/* Ambient Glow */}
      <div className="absolute top-0 right-0 -z-10 h-[500px] w-[500px] blur-[120px] bg-gradient-to-bl from-blue-50/50 via-green-50/30 to-transparent opacity-50 dark:from-blue-900/20 dark:via-green-900/10 dark:opacity-30 pointer-events-none" />

      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60">{Silian_t('activities.history.title')}</h1>
        <p className="text-muted-foreground mt-2">{Silian_t('activities.history.subtitle')}</p>
      </div>

      <Silian_ActivityFilters
        filters={Silian_filters}
        onFiltersChange={Silian_handleFiltersChange}
        categories={Silian_categories}
        isLoading={Silian_isFetching}
      />

      {Silian_isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Silian_Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </div>
      ) : Silian_error ? (
        <Silian_Alert variant="destructive">
          <Silian_AlertCircle className="h-4 w-4" />
          <Silian_AlertTitle>{Silian_t('common.error')}</Silian_AlertTitle>
          <Silian_AlertDescription>{Silian_t('errors.loadFailed')}</Silian_AlertDescription>
        </Silian_Alert>
      ) : Silian_activities.length === 0 ? (
        <div className="rounded-lg border border-border bg-card/95 py-16 text-center shadow-sm">
          <h3 className="text-xl font-semibold">{Silian_t('activities.history.noActivitiesFound')}</h3>
          <p className="text-muted-foreground mt-2">{Silian_t('activities.history.tryDifferentFilters')}</p>
        </div>
      ) : (
        <>
          <Silian_ActivityTable activities={Silian_activities} onRowClick={Silian_handleRowClick} />
          <Silian_Pagination
            currentPage={Silian_pagination.current_page}
            totalPages={Silian_pagination.total_pages}
            onPageChange={Silian_handlePageChange}
            itemsPerPage={Silian_pagination.per_page}
            totalItems={Silian_pagination.total_items}
          />
        </>
      )}

      <Silian_ActivityDetailModal
        activity={Silian_selectedActivity}
        isOpen={!!Silian_selectedActivity}
        onClose={Silian_closeModal}
      />
    </div>
  );
}

