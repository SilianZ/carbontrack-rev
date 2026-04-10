import React from 'react';
import { X, CalendarDays, Info, Image as ImageIcon, MessageSquare, CheckCircle, Clock, XCircle, AlertCircle } from 'lucide-react';
import { ImagePreviewGallery } from '../common/ImagePreviewGallery';
import { useTranslation } from '../../hooks/useTranslation';
import { formatNumber, formatDateSafe } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';

export function ActivityDetailModal({ activity, isOpen, onClose }) {
   const { t } = useTranslation(['activities', 'common', 'date', 'units']);

  if (!isOpen || !activity) return null;

  const getName = (a) => a.activity_name || a.activity_name_zh || a.activity_name_en || a.activity || '';
  const getCategory = (a) => a.activity_category || a.category || 'unknown';
  const getUnit = (a) => a.activity_unit || a.unit || '';
  const getDate = (a) => a.activity_date || a.date || a.created_at;
  const getDescription = (a) => a.description || a.notes || a.note || a.remark || a.comments || '';
  const images = Array.isArray(activity.images) ? activity.images
    : (Array.isArray(activity.proof_images) ? activity.proof_images : []);

  const toNormalizedImage = (img) => {
    if (!img) return null;

    if (typeof img === 'string') {
      const trimmed = img.trim();
      if (!trimmed) return null;
      if (/^https?:\/\//i.test(trimmed)) {
        return { url: trimmed };
      }
      return { file_path: trimmed };
    }

    if (typeof img !== 'object') return null;

    const presignedUrl = typeof img.presigned_url === 'string' ? img.presigned_url : null;
    const publicUrl = typeof img.public_url === 'string' ? img.public_url : null;
    const rawUrl = typeof img.url === 'string' ? img.url : null;
    const httpUrl = rawUrl && /^https?:\/\//i.test(rawUrl) ? rawUrl : null;
    const inferredFilePath = img.file_path || img.path || img.key || (!httpUrl && rawUrl ? rawUrl : null);

    return {
      url: publicUrl || httpUrl || presignedUrl || null,
      presigned_url: presignedUrl || null,
      file_path: inferredFilePath || null,
      thumbnail_path: img.thumbnail_path || img.preview_path || null,
      original_name: img.original_name || img.name || null,
    };
  };

  const normalizedImages = images
    .map(toNormalizedImage)
    .filter((item) => item && (item.presigned_url || item.url || item.file_path));

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card">
        <Card className="border-0 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <CardTitle className="text-xl">{t('activities.detail.title')}</CardTitle>
              <CardDescription>{t('activities.detail.subtitle')}</CardDescription>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="h-8 w-8 p-0"
            >
              <X className="h-4 w-4" />
            </Button>
          </CardHeader>

          <CardContent className="space-y-6">
            {/* 基本信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('activities.table.activity')}</p>
                <p className="text-lg font-semibold text-foreground">{getName(activity)}</p>
              <p className="text-sm text-muted-foreground">{t(`activities.categories.${getCategory(activity)}`, getCategory(activity))}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('activities.table.status')}</p>
                {getStatusBadge(activity.status)}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('activities.table.date')}</p>
                  <p className="text-foreground">{formatDateSafe(getDate(activity), 'yyyy-MM-dd')}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('activities.table.data')}</p>
              <p className="text-foreground">{formatNumber(activity.data_value ?? activity.amount)} {t(`units.${getUnit(activity)}`, getUnit(activity))}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('activities.table.carbonSaved')}</p>
                 <p className="text-green-600 font-semibold">{formatNumber(activity.carbon_saved)} kg CO2e</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{t('activities.table.points')}</p>
                 <p className="text-green-600 font-semibold">+{formatNumber(activity.points_earned)} {t('common.points')}</p>
              </div>
            </div>

            {/* 描述/备注 */}
            {getDescription(activity) && (
              <div>
                <h4 className="mb-2 flex items-center text-md font-semibold text-foreground">
                  <MessageSquare className="h-4 w-4 mr-2" />{t('activities.detail.notes')}
                </h4>
                <p className="rounded-md bg-muted/60 p-3 whitespace-pre-wrap break-words text-foreground">{getDescription(activity)}</p>
              </div>
            )}

            {/* 审核信息 */}
            {activity.status === 'rejected' && activity.admin_notes && (
              <div>
                <h4 className="mb-2 flex items-center text-md font-semibold text-red-400">
                  <AlertCircle className="h-4 w-4 mr-2" />{t('activities.detail.rejectionReason')}
                </h4>
                <p className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-red-200">{activity.admin_notes}</p>
              </div>
            )}

            {/* 证明图片 */}
            {normalizedImages.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center text-md font-semibold text-foreground">
                  <ImageIcon className="h-4 w-4 mr-2" />{t('activities.detail.proofImages')}
                </h4>
                <ImagePreviewGallery images={normalizedImages} maxThumbnails={6} size="md" />
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex justify-end pt-4">
              <Button onClick={onClose}>{t('common.close')}</Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

