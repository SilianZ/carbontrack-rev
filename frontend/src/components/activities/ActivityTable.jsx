import React from 'react';
import { ImagePreviewGallery } from '../common/ImagePreviewGallery';
import { useTranslation } from '../../hooks/useTranslation';
import { formatNumber, formatDateSafe } from '../../lib/utils';
import { AlertCircle, CheckCircle, Clock, XCircle, Eye } from 'lucide-react';
import { Button } from '../ui/Button';

export function ActivityTable({ activities, onRowClick }) {
  const { t } = useTranslation();
  const getName = (a) => a.activity_name || a.activity_name_zh || a.activity_name_en || a.activity || '';
  const getCategory = (a) => a.activity_category || a.category || 'unknown';
  const getUnit = (a) => a.activity_unit || a.unit || '';
  const statusBadgeClassNames = {
    pending: 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/30',
    approved: 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30',
    rejected: 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/30',
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClassNames.pending}`}>
            <Clock className="h-3 w-3 mr-1" /> {t('activities.status.pending')}
          </span>
        );
      case 'approved':
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClassNames.approved}`}>
            <CheckCircle className="h-3 w-3 mr-1" /> {t('activities.status.approved')}
          </span>
        );
      case 'rejected':
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${statusBadgeClassNames.rejected}`}>
            <XCircle className="h-3 w-3 mr-1" /> {t('activities.status.rejected')}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="overflow-x-auto rounded-lg border border-border bg-card shadow-sm">
      <table className="min-w-full divide-y divide-border">
        <thead className="bg-muted/50">
          <tr>
            <th
              scope="col"
              className="px-4 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {t('activities.table.images')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {t('activities.table.activity')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {t('activities.table.data')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {t('activities.table.carbonSaved')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {t('activities.table.points')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {t('activities.table.status')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {t('activities.table.date')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {t('activities.table.actions')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {activities.map((activity) => (
            <tr key={activity.id} className="hover:bg-muted/40">
              <td className="px-4 py-4 whitespace-nowrap align-top">
                <ImagePreviewGallery images={activity.images || []} maxThumbnails={1} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-foreground">
                  {getName(activity)}
                </div>
                <div className="text-sm text-muted-foreground">
                    {t(`activities.categories.${getCategory(activity)}`, getCategory(activity))}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-foreground">
                    {formatNumber(activity.data_value ?? activity.amount)} {t(`units.${getUnit(activity)}`, getUnit(activity))}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-foreground">
                  {formatNumber(activity.carbon_saved)} kg CO2e
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-green-600 font-semibold">
                  +{formatNumber(activity.points_earned)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {getStatusBadge(activity.status)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                {formatDateSafe(activity.activity_date, 'yyyy-MM-dd')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => onRowClick(activity)}
                >
                  <Eye className="h-4 w-4 mr-1" /> {t('common.view')}
                </Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
