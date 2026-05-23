import Silian_React from 'react';
import { ImagePreviewGallery as Silian_ImagePreviewGallery } from '../common/ImagePreviewGallery';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { formatNumber as Silian_formatNumber, formatDateSafe as Silian_formatDateSafe } from '../../lib/utils';
import { AlertCircle as Silian_AlertCircle, CheckCircle as Silian_CheckCircle, Clock as Silian_Clock, XCircle as Silian_XCircle, Eye as Silian_Eye } from 'lucide-react';
import { Button as Silian_Button } from '../ui/Button';

export function ActivityTable({ activities: Silian_activities, onRowClick: Silian_onRowClick }) {
  const { t: Silian_t } = Silian_useTranslation(['activities', 'common', 'units']);
  const Silian_getName = (Silian_a) => Silian_a.activity_name || Silian_a.activity_name_zh || Silian_a.activity_name_en || Silian_a.activity || '';
  const Silian_getCategory = (Silian_a) => Silian_a.activity_category || Silian_a.category || 'unknown';
  const Silian_getUnit = (Silian_a) => Silian_a.activity_unit || Silian_a.unit || '';
  const Silian_statusBadgeClassNames = {
    pending: 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-400/30',
    approved: 'bg-emerald-100 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/30',
    rejected: 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-400/30',
  };

  const Silian_getStatusBadge = (Silian_status) => {
    switch (Silian_status) {
      case 'pending':
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${Silian_statusBadgeClassNames.pending}`}>
            <Silian_Clock className="h-3 w-3 mr-1" /> {Silian_t('activities.status.pending')}
          </span>
        );
      case 'approved':
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${Silian_statusBadgeClassNames.approved}`}>
            <Silian_CheckCircle className="h-3 w-3 mr-1" /> {Silian_t('activities.status.approved')}
          </span>
        );
      case 'rejected':
        return (
          <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${Silian_statusBadgeClassNames.rejected}`}>
            <Silian_XCircle className="h-3 w-3 mr-1" /> {Silian_t('activities.status.rejected')}
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
              {Silian_t('activities.table.images')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {Silian_t('activities.table.activity')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {Silian_t('activities.table.data')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {Silian_t('activities.table.carbonSaved')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {Silian_t('activities.table.points')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {Silian_t('activities.table.status')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {Silian_t('activities.table.date')}
            </th>
            <th
              scope="col"
              className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground"
            >
              {Silian_t('activities.table.actions')}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border bg-card">
          {Silian_activities.map((Silian_activity) => (
            <tr key={Silian_activity.id} className="hover:bg-muted/40">
              <td className="px-4 py-4 whitespace-nowrap align-top">
                <Silian_ImagePreviewGallery images={Silian_activity.images || []} maxThumbnails={1} />
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm font-medium text-foreground">
                  {Silian_getName(Silian_activity)}
                </div>
                <div className="text-sm text-muted-foreground">
                    {Silian_t(`activities.categories.${Silian_getCategory(Silian_activity)}`, Silian_getCategory(Silian_activity))}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-foreground">
                    {Silian_formatNumber(Silian_activity.data_value ?? Silian_activity.amount)} {Silian_t(`units.${Silian_getUnit(Silian_activity)}`, Silian_getUnit(Silian_activity))}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-foreground">
                  {Silian_formatNumber(Silian_activity.carbon_saved)} kg CO2e
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                <div className="text-sm text-green-600 font-semibold">
                  +{Silian_formatNumber(Silian_activity.points_earned)}
                </div>
              </td>
              <td className="px-6 py-4 whitespace-nowrap">
                {Silian_getStatusBadge(Silian_activity.status)}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-sm text-muted-foreground">
                {Silian_formatDateSafe(Silian_activity.activity_date, 'yyyy-MM-dd')}
              </td>
              <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                <Silian_Button
                  variant="ghost"
                  size="sm"
                  onClick={() => Silian_onRowClick(Silian_activity)}
                >
                  <Silian_Eye className="h-4 w-4 mr-1" /> {Silian_t('common.view')}
                </Silian_Button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
