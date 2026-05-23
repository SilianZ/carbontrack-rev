import Silian_React from 'react';
import { X as Silian_X, CalendarDays as Silian_CalendarDays, Info as Silian_Info, Image as Silian_ImageIcon, MessageSquare as Silian_MessageSquare, CheckCircle as Silian_CheckCircle, Clock as Silian_Clock, XCircle as Silian_XCircle, AlertCircle as Silian_AlertCircle } from 'lucide-react';
import { ImagePreviewGallery as Silian_ImagePreviewGallery } from '../common/ImagePreviewGallery';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { formatNumber as Silian_formatNumber, formatDateSafe as Silian_formatDateSafe } from '../../lib/utils';
import { Button as Silian_Button } from '../ui/Button';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../ui/Card';

export function ActivityDetailModal({ activity: Silian_activity, isOpen: Silian_isOpen, onClose: Silian_onClose }) {
   const { t: Silian_t } = Silian_useTranslation(['activities', 'common', 'date', 'units']);

  if (!Silian_isOpen || !Silian_activity) return null;

  const Silian_getName = (Silian_a) => Silian_a.activity_name || Silian_a.activity_name_zh || Silian_a.activity_name_en || Silian_a.activity || '';
  const Silian_getCategory = (Silian_a) => Silian_a.activity_category || Silian_a.category || 'unknown';
  const Silian_getUnit = (Silian_a) => Silian_a.activity_unit || Silian_a.unit || '';
  const Silian_getDate = (Silian_a) => Silian_a.activity_date || Silian_a.date || Silian_a.created_at;
  const Silian_getDescription = (Silian_a) => Silian_a.description || Silian_a.notes || Silian_a.note || Silian_a.remark || Silian_a.comments || '';
  const Silian_images = Array.isArray(Silian_activity.images) ? Silian_activity.images
    : (Array.isArray(Silian_activity.proof_images) ? Silian_activity.proof_images : []);

  const Silian_toNormalizedImage = (Silian_img) => {
    if (!Silian_img) return null;

    if (typeof Silian_img === 'string') {
      const Silian_trimmed = Silian_img.trim();
      if (!Silian_trimmed) return null;
      if (/^https?:\/\//i.test(Silian_trimmed)) {
        return { url: Silian_trimmed };
      }
      return { file_path: Silian_trimmed };
    }

    if (typeof Silian_img !== 'object') return null;

    const Silian_presignedUrl = typeof Silian_img.presigned_url === 'string' ? Silian_img.presigned_url : null;
    const Silian_publicUrl = typeof Silian_img.public_url === 'string' ? Silian_img.public_url : null;
    const Silian_rawUrl = typeof Silian_img.url === 'string' ? Silian_img.url : null;
    const Silian_httpUrl = Silian_rawUrl && /^https?:\/\//i.test(Silian_rawUrl) ? Silian_rawUrl : null;
    const Silian_inferredFilePath = Silian_img.file_path || Silian_img.path || Silian_img.key || (!Silian_httpUrl && Silian_rawUrl ? Silian_rawUrl : null);

    return {
      url: Silian_publicUrl || Silian_httpUrl || Silian_presignedUrl || null,
      presigned_url: Silian_presignedUrl || null,
      file_path: Silian_inferredFilePath || null,
      thumbnail_path: Silian_img.thumbnail_path || Silian_img.preview_path || null,
      original_name: Silian_img.original_name || Silian_img.name || null,
    };
  };

  const Silian_normalizedImages = Silian_images
    .map(Silian_toNormalizedImage)
    .filter((Silian_item) => Silian_item && (Silian_item.presigned_url || Silian_item.url || Silian_item.file_path));

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
      <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-lg border border-border bg-card">
        <Silian_Card className="border-0 shadow-none">
          <Silian_CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
            <div>
              <Silian_CardTitle className="text-xl">{Silian_t('activities.detail.title')}</Silian_CardTitle>
              <Silian_CardDescription>{Silian_t('activities.detail.subtitle')}</Silian_CardDescription>
            </div>
            <Silian_Button
              variant="ghost"
              size="sm"
              onClick={Silian_onClose}
              className="h-8 w-8 p-0"
            >
              <Silian_X className="h-4 w-4" />
            </Silian_Button>
          </Silian_CardHeader>

          <Silian_CardContent className="space-y-6">
            {/* 基本信息 */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">{Silian_t('activities.table.activity')}</p>
                <p className="text-lg font-semibold text-foreground">{Silian_getName(Silian_activity)}</p>
              <p className="text-sm text-muted-foreground">{Silian_t(`activities.categories.${Silian_getCategory(Silian_activity)}`, Silian_getCategory(Silian_activity))}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{Silian_t('activities.table.status')}</p>
                {Silian_getStatusBadge(Silian_activity.status)}
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{Silian_t('activities.table.date')}</p>
                  <p className="text-foreground">{Silian_formatDateSafe(Silian_getDate(Silian_activity), 'yyyy-MM-dd')}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{Silian_t('activities.table.data')}</p>
              <p className="text-foreground">{Silian_formatNumber(Silian_activity.data_value ?? Silian_activity.amount)} {Silian_t(`units.${Silian_getUnit(Silian_activity)}`, Silian_getUnit(Silian_activity))}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{Silian_t('activities.table.carbonSaved')}</p>
                 <p className="text-green-600 font-semibold">{Silian_formatNumber(Silian_activity.carbon_saved)} kg CO2e</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">{Silian_t('activities.table.points')}</p>
                 <p className="text-green-600 font-semibold">+{Silian_formatNumber(Silian_activity.points_earned)} {Silian_t('common.points')}</p>
              </div>
            </div>

            {/* 描述/备注 */}
            {Silian_getDescription(Silian_activity) && (
              <div>
                <h4 className="mb-2 flex items-center text-md font-semibold text-foreground">
                  <Silian_MessageSquare className="h-4 w-4 mr-2" />{Silian_t('activities.detail.notes')}
                </h4>
                <p className="rounded-md bg-muted/60 p-3 whitespace-pre-wrap break-words text-foreground">{Silian_getDescription(Silian_activity)}</p>
              </div>
            )}

            {/* 审核信息 */}
            {Silian_activity.status === 'rejected' && Silian_activity.admin_notes && (
              <div>
                <h4 className="mb-2 flex items-center text-md font-semibold text-red-400">
                  <Silian_AlertCircle className="h-4 w-4 mr-2" />{Silian_t('activities.detail.rejectionReason')}
                </h4>
                <p className="rounded-md border border-red-500/20 bg-red-500/10 p-3 text-red-200">{Silian_activity.admin_notes}</p>
              </div>
            )}

            {/* 证明图片 */}
            {Silian_normalizedImages.length > 0 && (
              <div>
                <h4 className="mb-2 flex items-center text-md font-semibold text-foreground">
                  <Silian_ImageIcon className="h-4 w-4 mr-2" />{Silian_t('activities.detail.proofImages')}
                </h4>
                <Silian_ImagePreviewGallery images={Silian_normalizedImages} maxThumbnails={6} size="md" />
              </div>
            )}

            {/* 操作按钮 */}
            <div className="flex justify-end pt-4">
              <Silian_Button onClick={Silian_onClose}>{Silian_t('common.close')}</Silian_Button>
            </div>
          </Silian_CardContent>
        </Silian_Card>
      </div>
    </div>
  );
}

