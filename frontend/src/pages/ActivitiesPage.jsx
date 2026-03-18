import React, { useState } from 'react';
import { useQuery } from 'react-query';
import { useTranslation } from '../hooks/useTranslation';
import { ActivityFilters } from '../components/activities/ActivityFilters';
import { ActivityTable } from '../components/activities/ActivityTable';
import { ActivityDetailModal } from '../components/activities/ActivityDetailModal';
import { Pagination } from '../components/ui/Pagination';
import { carbonAPI } from '../lib/api';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function ActivitiesPage() {
  const { t } = useTranslation();
  const [filters, setFilters] = useState({
    search: '',
    category: '',
    status: '',
    start_date: '',
    end_date: '',
    sort: 'created_at_desc',
    page: 1,
    limit: 10
  });
  const [selectedActivity, setSelectedActivity] = useState(null);

  const { data, isLoading, error, isFetching } = useQuery(
    ['activities', filters],
    () => carbonAPI.getTransactions(filters),
    { keepPreviousData: true }
  );

  const { data: categoriesData } = useQuery('activityCategories', () => carbonAPI.getActivities({ grouped: true }));

  const handleFiltersChange = (newFilters) => {
    setFilters(newFilters);
  };

  const handlePageChange = (page) => {
    setFilters(prev => ({ ...prev, page }));
  };

  const handleRowClick = (activity) => {
    setSelectedActivity(activity);
  };

  const closeModal = () => {
    setSelectedActivity(null);
  };

  const activities = data?.data?.data || [];
  const pagination = data?.data?.pagination || {};
  const categories = categoriesData?.data?.data || [];

  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold tracking-tight">{t('activities.history.title')}</h1>
        <p className="text-muted-foreground">{t('activities.history.subtitle')}</p>
      </div>

      <ActivityFilters
        filters={filters}
        onFiltersChange={handleFiltersChange}
        categories={categories}
        isLoading={isFetching}
      />

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <Loader2 className="h-8 w-8 animate-spin text-green-500" />
        </div>
      ) : error ? (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{t('errors.loadFailed')}</AlertDescription>
        </Alert>
      ) : activities.length === 0 ? (
        <div className="rounded-lg border border-border bg-card/95 py-16 text-center shadow-sm">
          <h3 className="text-xl font-semibold">{t('activities.history.noActivitiesFound')}</h3>
          <p className="text-muted-foreground mt-2">{t('activities.history.tryDifferentFilters')}</p>
        </div>
      ) : (
        <>
          <ActivityTable activities={activities} onRowClick={handleRowClick} />
          <Pagination
            currentPage={pagination.current_page}
            totalPages={pagination.total_pages}
            onPageChange={handlePageChange}
            itemsPerPage={pagination.per_page}
            totalItems={pagination.total_items}
          />
        </>
      )}

      <ActivityDetailModal
        activity={selectedActivity}
        isOpen={!!selectedActivity}
        onClose={closeModal}
      />
    </div>
  );
}

