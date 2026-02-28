import React from 'react';
import { X, CalendarDays, Info, Image as ImageIcon, MessageSquare, CheckCircle, Clock, XCircle } from 'lucide-react';
import { ImagePreviewGallery } from '../common/ImagePreviewGallery';
import { useTranslation } from '../../hooks/useTranslation';
import { formatNumber, formatDateSafe } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';

export function ActivityDetailModal({ activity, isOpen, onClose }) {
   const { t } = useTranslation();

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

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
            <Clock className="h-3 w-3 mr-1" /> {t('activities.status.pending')}
          </span>
        );
      case 'approved':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" /> {t('activities.status.approved')}
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
            <XCircle className="h-3 w-3 mr-1" /> {t('activities.status.rejected')}
          </span>
        );
      default:
        return null;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
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
                <p className="text-sm font-medium text-gray-500">{t('activities.table.activity')}</p>
                <p className="text-lg font-semibold text-gray-900">{getName(activity)}</p>
                <p className="text-sm text-gray-600">{t(`activities.categories.${getCategory(activity)}`, getCategory(activity))}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{t('activities.table.status')}</p>
                {getStatusBadge(activity.status)}
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{t('activities.table.date')}</p>
                  <p className="text-gray-900">{formatDateSafe(getDate(activity), 'yyyy-MM-dd')}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{t('activities.table.data')}</p>
            <p className="text-gray-900">{formatNumber(activity.data_value ?? activity.amount)} {t(`units.${getUnit(activity)}`, getUnit(activity))}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{t('activities.table.carbonSaved')}</p>
                 <p className="text-green-600 font-semibold">{formatNumber(activity.carbon_saved)} kg CO2e</p>
              </div>
              <div>
                <p className="text-sm font-medium text-gray-500">{t('activities.table.points')}</p>
                 <p className="text-green-600 font-semibold">+{formatNumber(activity.points_earned)} {t('common.points')}</p>
              </div>
            </div>

            {/* 描述/备注 */}
            {getDescription(activity) && (
              <div>
                <h4 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
                  <MessageSquare className="h-4 w-4 mr-2" />{t('activities.detail.notes')}
                </h4>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-md whitespace-pre-wrap break-words">{getDescription(activity)}</p>
              </div>
            )}

            {/* 审核信息 */}
            {activity.status === 'rejected' && activity.admin_notes && (
              <div>
                <h4 className="text-md font-semibold text-red-700 mb-2 flex items-center">
                  <AlertCircle className="h-4 w-4 mr-2" />{t('activities.detail.rejectionReason')}
                </h4>
                <p className="text-red-700 bg-red-50 p-3 rounded-md">{activity.admin_notes}</p>
              </div>
            )}

            {/* 证明图片 */}
            {normalizedImages.length > 0 && (
              <div>
                <h4 className="text-md font-semibold text-gray-700 mb-2 flex items-center">
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

