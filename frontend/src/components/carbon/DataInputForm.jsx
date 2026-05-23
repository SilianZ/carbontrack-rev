import Silian_React, { useCallback as Silian_useCallback, useEffect as Silian_useEffect, useRef as Silian_useRef, useState as Silian_useState } from 'react';
import { useForm as Silian_useForm } from 'react-hook-form';
import { Calculator as Silian_Calculator, Calendar as Silian_Calendar, FileText as Silian_FileText, Upload as Silian_Upload, AlertCircle as Silian_AlertCircle, Image as Silian_ImageIcon, X as Silian_X } from 'lucide-react';
import { batchUpload as Silian_batchUpload } from '../../lib/r2Upload';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { cn as Silian_cn } from '../../lib/utils';
import { Button as Silian_Button } from '../ui/Button';
import { Input as Silian_Input } from '../ui/Input';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../ui/Card';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription } from '../ui/Alert';
// 移除即时上传组件，改为提交时统一上传

const Silian_MAX_UPLOAD_FILES = 5;
const Silian_MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const Silian_SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const Silian_SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

export default function DataInputForm({
  activity: Silian_activity,
  onCalculate: Silian_onCalculate,
  onSubmit: Silian_onSubmit,
  calculationResult: Silian_calculationResult,
  isSubmitting: Silian_isSubmitting,
  initialData: Silian_initialData,
  checkinDate: Silian_checkinDate
}) {
  const { t: Silian_t, currentLanguage: Silian_currentLanguage, tFileSize: Silian_tFileSize } = Silian_useTranslation(['activities', 'common', 'date', 'errors', 'units', 'validation']);
  // 选中的本地文件（未立即上传）
  const [Silian_selectedFiles, Silian_setSelectedFiles] = Silian_useState([]);
  const [Silian_uploadError, Silian_setUploadError] = Silian_useState(null);
  const [Silian_uploading, Silian_setUploading] = Silian_useState(false);
  const [Silian_uploadedMeta, Silian_setUploadedMeta] = Silian_useState([]); // 成功上传后的元数据
  const [Silian_previewUrls, Silian_setPreviewUrls] = Silian_useState([]);
  const [Silian_progress, Silian_setProgress] = Silian_useState({ done: 0, total: 0 });
  const [Silian_showCalculation, Silian_setShowCalculation] = Silian_useState(false);
  const [Silian_isDragging, Silian_setIsDragging] = Silian_useState(false);
  const Silian_fileInputRef = Silian_useRef(null);
  const Silian_getSafePreviewUrl = Silian_useCallback((Silian_previewUrl) => (
    typeof Silian_previewUrl === 'string' && Silian_previewUrl.startsWith('blob:') ? Silian_previewUrl : ''
  ), []);

  const {
    register: Silian_register,
    handleSubmit: Silian_handleSubmit,
    watch: Silian_watch,
    setValue: Silian_setValue,
    formState: { errors: Silian_errors }
  } = Silian_useForm({
    defaultValues: {
      activity_date: new Date().toISOString().split('T')[0],
      description: ''
    }
  });

  // Handle initial data from Smart Add
  Silian_useEffect(() => {
    if (Silian_initialData && Silian_initialData.amount) {
      Silian_setValue('data', Silian_initialData.amount);
      if (Silian_initialData.description) {
        Silian_setValue('description', Silian_initialData.description);
      }
      if (Silian_initialData.activity_date) {
        Silian_setValue('activity_date', Silian_initialData.activity_date);
      }
      // Trigger calculation if needed, but the existing useEffect watches 'watchedData' which will update when we setValue
    }
  }, [Silian_initialData, Silian_setValue]);

  const Silian_watchedData = Silian_watch('data');

  // 避免在开发模式 StrictMode 下的双调用，以及快速输入引发的请求风暴：
  // - 使用 debounce（300ms）
  // - 使用 lastCalcKeyRef 记录上次计算的 key（activityId+data），相同时不重复调用
  const Silian_lastCalcKeyRef = Silian_useRef('');
  const Silian_debounceTimerRef = Silian_useRef(null);

  Silian_useEffect(() => {
    const Silian_activityId = Silian_activity?.id || Silian_activity?.uuid || '';
    const Silian_val = Silian_watchedData;

    // 清理上一次的定时器
    if (Silian_debounceTimerRef.current) {
      clearTimeout(Silian_debounceTimerRef.current);
      Silian_debounceTimerRef.current = null;
    }

    // 输入为空或非正数时隐藏计算结果
    const Silian_parsed = parseFloat(Silian_val);
    if (!Silian_activityId || !Silian_val || isNaN(Silian_parsed) || Silian_parsed <= 0) {
      Silian_setShowCalculation(false);
      return;
    }

    // 设置防抖
    Silian_debounceTimerRef.current = setTimeout(() => {
      const Silian_key = `${Silian_activityId}::${Silian_parsed}`;
      if (Silian_lastCalcKeyRef.current === Silian_key) {
        // 与上次相同参数，避免重复调用
        Silian_setShowCalculation(true);
        return;
      }
      Silian_lastCalcKeyRef.current = Silian_key;
      Silian_onCalculate(Silian_parsed);
      Silian_setShowCalculation(true);
    }, 300);

    return () => {
      if (Silian_debounceTimerRef.current) {
        clearTimeout(Silian_debounceTimerRef.current);
        Silian_debounceTimerRef.current = null;
      }
    };
  }, [Silian_activity, Silian_watchedData, Silian_onCalculate]);

  const Silian_setDetailedUploadError = (Silian_summary, Silian_details = []) => {
    Silian_setUploadError({
      summary: Silian_summary,
      details: Silian_details.filter(Boolean),
    });
  };

  const Silian_buildUploadErrorFromException = (Silian_error) => {
    const Silian_rawMessage = String(Silian_error?.rawMessage || Silian_error?.message || '').trim();
    const Silian_normalizedMessage = Silian_rawMessage.toLowerCase();
    const Silian_status = Silian_error?.status ?? null;
    const Silian_requestId = Silian_error?.requestId || Silian_error?.request_id || null;
    const Silian_fileName = Silian_error?.fileName || Silian_error?.file_name || null;
    const Silian_step = Silian_error?.step || null;
    const Silian_details = [];
    const Silian_supportedFormats = Silian_SUPPORTED_IMAGE_EXTENSIONS.map((Silian_item) => Silian_item.toUpperCase()).join(', ');

    if (Silian_fileName) {
      Silian_details.push(Silian_t('activities.form.uploadErrors.details.file', { name: Silian_fileName }));
    }

    if (Silian_requestId) {
      Silian_details.push(Silian_t('activities.form.uploadErrors.details.requestId', { id: Silian_requestId }));
    }

    if (Silian_status === 401 || Silian_normalizedMessage === 'unauthorized') {
      return {
        summary: Silian_t('activities.form.uploadErrors.expiredSessionSummary'),
        details: Silian_details,
      };
    }

    if (Silian_rawMessage === 'MIME type not allowed' || Silian_rawMessage === 'File extension not allowed') {
      return {
        summary: Silian_t('activities.form.uploadErrors.unsupportedFormatSummary'),
        details: [
          ...Silian_details,
          Silian_t('activities.form.uploadErrors.details.supportedFormats', { formats: Silian_supportedFormats }),
        ],
      };
    }

    if (Silian_rawMessage === 'File size exceeds limit') {
      return {
        summary: Silian_t('activities.form.uploadErrors.fileTooLargeSummary'),
        details: [
          ...Silian_details,
          Silian_t('activities.form.uploadErrors.details.maxSize', { size: Silian_tFileSize(Silian_MAX_UPLOAD_SIZE) }),
        ],
      };
    }

    if (Silian_rawMessage === 'File not found in storage') {
      return {
        summary: Silian_t('activities.form.uploadErrors.storageDelaySummary'),
        details: [
          ...Silian_details,
          Silian_t('activities.form.uploadErrors.storageDelayDetail'),
        ],
      };
    }

    if (Silian_rawMessage === 'File ownership conflict detected' || Silian_error?.code === 'FILE_OWNERSHIP_CONFLICT') {
      return {
        summary: Silian_t('activities.form.uploadErrors.ownershipConflictSummary'),
        details: [
          ...Silian_details,
          Silian_t('activities.form.uploadErrors.ownershipConflictDetail'),
        ],
      };
    }

    if (Silian_rawMessage === 'Invalid directory name') {
      return {
        summary: Silian_t('activities.form.uploadErrors.invalidConfigSummary'),
        details: [
          ...Silian_details,
          Silian_t('activities.form.uploadErrors.invalidConfigDetail'),
        ],
      };
    }

    if (
      Silian_normalizedMessage.includes('network error') ||
      Silian_normalizedMessage.includes('failed to fetch') ||
      Silian_error?.code === 'ERR_NETWORK'
    ) {
      return {
        summary: Silian_t('activities.form.uploadErrors.networkSummary'),
        details: [
          ...Silian_details,
          Silian_t('activities.form.uploadErrors.networkDetail'),
        ],
      };
    }

    if (Silian_normalizedMessage.includes('timeout') || Silian_error?.code === 'ECONNABORTED') {
      return {
        summary: Silian_t('activities.form.uploadErrors.timeoutSummary'),
        details: [
          ...Silian_details,
          Silian_t('activities.form.uploadErrors.timeoutDetail'),
        ],
      };
    }

    if (Silian_step === 'put') {
      return {
        summary: Silian_t('activities.form.uploadErrors.putSummary'),
        details: [
          ...Silian_details,
          Silian_t('activities.form.uploadErrors.putDetail'),
        ],
      };
    }

    if (Silian_step === 'presign') {
      return {
        summary: Silian_t('activities.form.uploadErrors.presignSummary'),
        details: [
          ...Silian_details,
          Silian_t('activities.form.uploadErrors.presignDetail'),
        ],
      };
    }

    if (Silian_step === 'confirm') {
      return {
        summary: Silian_t('activities.form.uploadErrors.confirmSummary'),
        details: [
          ...Silian_details,
          Silian_t('activities.form.uploadErrors.confirmDetail'),
        ],
      };
    }

    return {
      summary: Silian_t('activities.form.uploadErrors.genericSummary'),
      details: [
        ...Silian_details,
        Silian_rawMessage
          ? Silian_t('activities.form.uploadErrors.details.serverMessage', { message: Silian_rawMessage })
          : Silian_t('activities.form.uploadErrors.genericDetail'),
      ],
    };
  };

  const Silian_isSupportedImageFile = (Silian_file) => {
    const Silian_ext = (Silian_file?.name?.split('.').pop() || '').toLowerCase();
    if (Silian_file?.type && Silian_SUPPORTED_IMAGE_MIME_TYPES.includes(Silian_file.type)) {
      return true;
    }
    return Silian_SUPPORTED_IMAGE_EXTENSIONS.includes(Silian_ext);
  };

  const Silian_onFormSubmit = async (Silian_data) => {
    Silian_setUploadError(null);
    // 校验至少一张图片
    if (!Silian_selectedFiles.length && !Silian_uploadedMeta.length) {
      Silian_setDetailedUploadError(
        Silian_t('activities.form.imageRequired'),
        [
          Silian_t('activities.form.uploadErrors.proofImageRequiredDetail'),
        ]
      );
      return;
    }
    // 若还未上传（正常情况）则先上传
    let Silian_finalImages = Silian_uploadedMeta;
    if (!Silian_uploadedMeta.length && Silian_selectedFiles.length) {
      try {
        Silian_setUploading(true);
        const Silian_total = Silian_selectedFiles.length;
        Silian_setProgress({ done: 0, total: Silian_total });
        const Silian_results = await Silian_batchUpload(Silian_selectedFiles, { directory: 'activities', entityType: 'carbon_record' }, (Silian_idx, Silian_len) => {
          Silian_setProgress({ done: Silian_idx, total: Silian_len });
        });
        Silian_finalImages = Silian_results.map(Silian_r => ({
          url: Silian_r.url,
          file_path: Silian_r.file_path,
          original_name: Silian_r.original_name,
          mime_type: Silian_r.mime_type,
          size: Silian_r.size
        }));
        Silian_setUploadedMeta(Silian_finalImages);
      } catch (Silian_e) {
        const Silian_readableError = Silian_buildUploadErrorFromException(Silian_e);
        Silian_setDetailedUploadError(Silian_readableError.summary, Silian_readableError.details);
        Silian_setUploading(false);
        return;
      }
      Silian_setUploading(false);
    }

    const Silian_payload = {
      activity_id: Silian_activity.id || Silian_activity.uuid,
      amount: parseFloat(Silian_data.data),
      date: Silian_data.activity_date,
      description: Silian_data.description,
      images: (Silian_finalImages || []).map(Silian_i => ({ url: Silian_i.url, file_path: Silian_i.file_path, original_name: Silian_i.original_name, mime_type: Silian_i.mime_type, size: Silian_i.size }))
    };
    if (Silian_checkinDate) {
      Silian_payload.checkin_date = Silian_checkinDate;
    }
    Silian_onSubmit(Silian_payload);
  };

  const Silian_processFiles = (Silian_files) => {
    Silian_setUploadError(null);

    const Silian_currentFiles = [...Silian_selectedFiles];
    const Silian_currentPreviews = [...Silian_previewUrls];

    if (Silian_currentFiles.length + Silian_files.length > Silian_MAX_UPLOAD_FILES) {
      Silian_setDetailedUploadError(
        Silian_t('activities.form.maxFilesReached'),
        [
          Silian_t('activities.form.uploadErrors.maxFilesDetail', { current: Silian_currentFiles.length, incoming: Silian_files.length }),
        ]
      );
      return;
    }

    const Silian_newFiles = [];
    const Silian_newPreviews = [];

    for (const Silian_f of Silian_files) {
      if (!Silian_isSupportedImageFile(Silian_f)) {
        Silian_setDetailedUploadError(
          Silian_t('activities.form.uploadErrors.unsupportedFormatSummary'),
          [
            Silian_t('activities.form.uploadErrors.details.file', { name: Silian_f.name }),
            Silian_t('activities.form.uploadErrors.details.supportedFormats', {
              formats: Silian_SUPPORTED_IMAGE_EXTENSIONS.map((Silian_item) => Silian_item.toUpperCase()).join(', '),
            }),
          ]
        );
        continue;
      }
      if (Silian_f.size > Silian_MAX_UPLOAD_SIZE) {
        Silian_setDetailedUploadError(
          Silian_t('activities.form.fileTooLarge'),
          [
            Silian_t('activities.form.uploadErrors.details.file', { name: Silian_f.name }),
            Silian_t('activities.form.uploadErrors.details.currentSize', { size: Silian_tFileSize(Silian_f.size) }),
            Silian_t('activities.form.uploadErrors.details.maxSize', { size: Silian_tFileSize(Silian_MAX_UPLOAD_SIZE) }),
          ]
        );
        continue;
      }
      // 简单去重：同名同大小
      if (Silian_currentFiles.some(Silian_existing => Silian_existing.name === Silian_f.name && Silian_existing.size === Silian_f.size)) {
        continue;
      }
      Silian_newFiles.push(Silian_f);
      Silian_newPreviews.push(URL.createObjectURL(Silian_f));
    }

    Silian_setSelectedFiles([...Silian_currentFiles, ...Silian_newFiles]);
    Silian_setPreviewUrls([...Silian_currentPreviews, ...Silian_newPreviews]);
  };

  const Silian_handleFileSelect = (Silian_e) => {
    const Silian_files = Array.from(Silian_e.target.files || []);
    Silian_processFiles(Silian_files);
    Silian_e.target.value = null; // 重置 input，允许重复选择同一文件
  };

  const Silian_handleDragOver = (Silian_e) => {
    Silian_e.preventDefault();
    Silian_e.stopPropagation();
    Silian_setIsDragging(true);
  };

  const Silian_handleDragLeave = (Silian_e) => {
    Silian_e.preventDefault();
    Silian_e.stopPropagation();
    Silian_setIsDragging(false);
  };

  const Silian_handleDrop = (Silian_e) => {
    Silian_e.preventDefault();
    Silian_e.stopPropagation();
    Silian_setIsDragging(false);
    const Silian_files = Array.from(Silian_e.dataTransfer.files || []);
    Silian_processFiles(Silian_files);
  };

  const Silian_triggerFileInput = () => {
    Silian_fileInputRef.current?.click();
  };

  const Silian_removeFile = (Silian_idx) => {
    Silian_setSelectedFiles(Silian_prev => Silian_prev.filter((Silian__, Silian_i) => Silian_i !== Silian_idx));
    Silian_setPreviewUrls(Silian_prev => {
      const Silian_newUrls = Silian_prev.filter((Silian__, Silian_i) => Silian_i !== Silian_idx);
      // 释放被删除的 URL 对象
      if (Silian_prev[Silian_idx]) URL.revokeObjectURL(Silian_prev[Silian_idx]);
      return Silian_newUrls;
    });
  };

  if (!Silian_activity) {
    return (
      <Silian_Card>
        <Silian_CardContent className="py-12 text-center">
          <Silian_AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{Silian_t('activities.selectActivityFirst')}</p>
        </Silian_CardContent>
      </Silian_Card>
    );
  }

  const Silian_getActivityName = (Silian_activity) => {
    const Silian_isEn = (Silian_currentLanguage || '').toLowerCase().startsWith('en');
    return Silian_isEn
      ? (Silian_activity.name_en || Silian_activity.name_zh || Silian_activity.name)
      : (Silian_activity.name_zh || Silian_activity.name_en || Silian_activity.name);
  };

  const Silian_getActivityDescription = (Silian_activity) => {
    const Silian_isEn = (Silian_currentLanguage || '').toLowerCase().startsWith('en');
    return Silian_isEn
      ? (Silian_activity.description_en || Silian_activity.description_zh || Silian_activity.description)
      : (Silian_activity.description_zh || Silian_activity.description_en || Silian_activity.description);
  };

  const Silian_calculationCard = (Silian_showCalculation && Silian_calculationResult) ? (
    <Silian_Card className="border-green-500/20 bg-green-500/10 shadow-sm">
      <Silian_CardHeader className="pb-3">
        <Silian_CardTitle className="text-sm font-medium text-green-500">
          {Silian_t('activities.form.calculationResult')}
        </Silian_CardTitle>
        <Silian_CardDescription className="text-xs">
          {Silian_t('activities.form.previewAutoUpdate')}
        </Silian_CardDescription>
      </Silian_CardHeader>
      <Silian_CardContent className="pt-0">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="mb-1 text-xs text-muted-foreground">{Silian_t('activities.form.carbonSavedMetric')}</div>
            <div className="text-2xl font-bold text-green-600 leading-none">
              {(() => { const Silian_v = Silian_calculationResult.carbon_saved; const Silian_num = typeof Silian_v === 'number' ? Silian_v : Number(Silian_v); return Number.isFinite(Silian_num) ? Silian_num.toFixed(2) : '0.00'; })()}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="mb-1 text-xs text-muted-foreground">{Silian_t('activities.form.expectedPoints')}</div>
            <div className="text-2xl font-bold text-blue-600 leading-none">
              {Silian_calculationResult.points_earned ?? 0}
            </div>
          </div>
        </div>
      </Silian_CardContent>
    </Silian_Card>
  ) : null;

  return (
    <div className="space-y-6 md:space-y-0 md:grid md:grid-cols-12 md:gap-6">
      {/* 主列 */}
      <div className="md:col-span-8 space-y-6">
        {/* 选中的活动信息 */}
        <Silian_Card>
          <Silian_CardHeader>
            <Silian_CardTitle className="flex items-center gap-2">
              <Silian_Calculator className="h-5 w-5 text-green-600" />
              {Silian_getActivityName(Silian_activity)}
            </Silian_CardTitle>
            <Silian_CardDescription>
              {Silian_getActivityDescription(Silian_activity)}
            </Silian_CardDescription>
          </Silian_CardHeader>
          <Silian_CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{Silian_t('activities.category')}:</span>
                <div className="font-medium">
                  {Silian_t(`activities.categories.${Silian_activity.category}`)}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">{Silian_t('activities.unit')}:</span>
                    <div className="font-medium">{Silian_t(`units.${Silian_activity.unit}`, Silian_activity.unit)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">{Silian_t('activities.carbonFactor')}:</span>
                <div className="font-medium text-green-600">
                  {Silian_activity.carbon_factor}
                </div>
              </div>
              {Silian_activity.points_per_unit && (
                <div>
                  <span className="text-muted-foreground">{Silian_t('activities.pointsPerUnit')}:</span>
                  <div className="font-medium text-blue-600">
                    {Silian_activity.points_per_unit}
                  </div>
                </div>
              )}
            </div>
          </Silian_CardContent>
        </Silian_Card>

        {/* 移动端显示预览（在表单上方） */}
        <div className="md:hidden">
          {Silian_calculationCard}
        </div>

        {/* 数据输入表单 */}
        <Silian_Card>
          <Silian_CardHeader>
            <Silian_CardTitle>{Silian_t('activities.form.dataInput')}</Silian_CardTitle>
            <Silian_CardDescription>
              {Silian_t('activities.form.inputDescription')}
            </Silian_CardDescription>
          </Silian_CardHeader>
          <Silian_CardContent>
            <form onSubmit={Silian_handleSubmit(Silian_onFormSubmit)} className="space-y-6">
              {/* 数据输入 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {Silian_t('activities.form.dataValue')} ({Silian_t(`units.${Silian_activity.unit}`, Silian_activity.unit)})
                </label>
                <Silian_Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={Silian_t('activities.form.dataPlaceholder')}
                  error={Silian_errors.data}
                  {...Silian_register('data', {
                    required: Silian_t('activities.form.dataRequired'),
                    min: { value: 0.01, message: Silian_t('activities.form.dataMinimum') }
                  })}
                />
                {Silian_errors.data && (
                  <p className="mt-1 text-sm text-red-600">
                    {Silian_errors.data.message}
                  </p>
                )}
              </div>

              {/* 活动日期 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  <Silian_Calendar className="inline h-4 w-4 mr-1" />
                  {Silian_t('activities.form.activityDate')}
                </label>
                <Silian_Input
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  error={Silian_errors.activity_date}
                  {...Silian_register('activity_date', {
                    required: Silian_t('activities.form.dateRequired')
                  })}
                />
                {Silian_errors.activity_date && (
                  <p className="mt-1 text-sm text-red-600">
                    {Silian_errors.activity_date.message}
                  </p>
                )}
                {Silian_checkinDate && (
                  <p className="mt-2 text-xs text-emerald-600">
                    {Silian_t('activities.checkin.makeupHelper',  { date: Silian_checkinDate })}
                  </p>
                )}
              </div>

              {/* 备注/描述 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  <Silian_FileText className="inline h-4 w-4 mr-1" />
                  {Silian_t('activities.form.notes')}
                </label>
                <textarea
                  rows={4}
                  placeholder={Silian_t('activities.form.notesPlaceholder')}
                  className={`flex w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${Silian_errors.description ? 'border-red-500 focus-visible:ring-red-500' : 'border-input ring-offset-background'}`}
                  {...Silian_register('description', {
                    maxLength: { value: 500, message: Silian_t('validation.maxLength', { max: 500 }) }
                  })}
                />
                {Silian_errors.description && (
                  <p className="mt-1 text-sm text-red-600">
                    {Silian_errors.description.message}
                  </p>
                )}
              </div>
              {/* 延迟上传：选择文件 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  <Silian_Upload className="inline h-4 w-4 mr-1" />
                  {Silian_t('activities.form.uploadImage')}
                </label>

                <div
                  className={Silian_cn(
                    "border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 cursor-pointer",
                    Silian_isDragging ? "scale-[1.02] border-green-500 bg-green-500/10" : "border-border hover:border-green-500/60 hover:bg-muted/60",
                    Silian_uploadError ? "border-red-500/40 bg-red-500/10" : ""
                  )}
                  onDragOver={Silian_handleDragOver}
                  onDragLeave={Silian_handleDragLeave}
                  onDrop={Silian_handleDrop}
                  onClick={Silian_triggerFileInput}
                >
                  <input
                    ref={Silian_fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={Silian_handleFileSelect}
                    className="hidden"
                  />

                  <div className={Silian_cn("rounded-full p-3 transition-colors", Silian_isDragging ? "bg-green-500/15" : "bg-muted")}>
                    <Silian_Upload className={Silian_cn("h-6 w-6", Silian_isDragging ? "text-green-500" : "text-muted-foreground")} />
                  </div>

                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      {Silian_isDragging ? Silian_t('activities.form.dropHere') : Silian_t('activities.form.clickOrDrag')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {Silian_t('activities.form.uploadHint')}
                    </p>
                  </div>
                </div>

                {/* File List & Status */}
                <div className="mt-4 space-y-3">
                  {Silian_selectedFiles.length > 0 && (
                    <ul className="space-y-2 text-sm">
                      {Silian_selectedFiles.map((Silian_f, Silian_i) => {
                        const Silian_safePreviewUrl = Silian_getSafePreviewUrl(Silian_previewUrls[Silian_i]);

                        return (
                          <li key={Silian_i} className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 transition-colors hover:border-border/80">
                            <div className="flex items-center gap-3 min-w-0">
                              {Silian_safePreviewUrl && <img src={Silian_safePreviewUrl} alt={Silian_t('activities.form.imagePreviewAlt', { name: Silian_f.name })} className="h-10 w-10 rounded border border-border object-cover" />}
                              <div className="flex flex-col min-w-0">
                                <span className="truncate font-medium text-foreground">{Silian_f.name}</span>
                                <span className="text-xs text-muted-foreground">{Silian_t('activities.form.fileSizeLabel', { size: Silian_tFileSize(Silian_f.size) })}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(Silian_e) => { Silian_e.stopPropagation(); Silian_removeFile(Silian_i); }}
                              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                            >
                              <Silian_X className="h-4 w-4" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {Silian_uploading && (
                    <div className="text-xs text-blue-600 flex items-center gap-2">
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent"></div>
                      {Silian_t('common.uploading')} {Silian_progress.total > 0 ? `${Silian_progress.done}/${Silian_progress.total}` : ''}
                    </div>
                  )}

                  {Silian_uploadError && (
                    <Silian_Alert variant="destructive" className="py-3">
                      <Silian_AlertCircle className="h-4 w-4" />
                      <Silian_AlertDescription className="space-y-2">
                        <p className="text-sm font-medium">{Silian_uploadError.summary}</p>
                        {Array.isArray(Silian_uploadError.details) && Silian_uploadError.details.length > 0 && (
                          <ul className="list-disc space-y-1 pl-5 text-xs">
                            {Silian_uploadError.details.map((Silian_item) => (
                              <li key={Silian_item}>{Silian_item}</li>
                            ))}
                          </ul>
                        )}
                      </Silian_AlertDescription>
                    </Silian_Alert>
                  )}
                </div>
              </div>


              {/* 提交按钮 */}
              <div className="flex gap-4">
                <Silian_Button
                  type="submit"
                  className="flex-1"
                  loading={Silian_isSubmitting || Silian_uploading}
                  disabled={Silian_isSubmitting || Silian_uploading || !Silian_showCalculation}
                >
                  {(Silian_isSubmitting || Silian_uploading) ? Silian_t('activities.form.submitting') : Silian_t('activities.form.submit')}
                </Silian_Button>

                <Silian_Button
                  type="button"
                  variant="outline"
                  onClick={() => window.location.reload()}
                >
                  {Silian_t('common.reset')}
                </Silian_Button>
              </div>

              {/* 提示信息 */}
              <Silian_Alert variant="info">
                <Silian_AlertCircle className="h-4 w-4" />
                <Silian_AlertDescription>
                  {Silian_t('activities.form.submitHint')}
                </Silian_AlertDescription>
              </Silian_Alert>
            </form>
          </Silian_CardContent>
        </Silian_Card>
      </div>{/* END 主列 */}

      {/* 侧栏：桌面端悬浮计算结果 */}
      <div className="hidden md:block md:col-span-4">
        <div className="sticky top-20 space-y-4">
          {Silian_calculationCard || (
            <Silian_Card className="border-dashed">
              <Silian_CardHeader className="pb-3">
                <Silian_CardTitle className="text-sm text-muted-foreground">
                  {Silian_t('activities.form.calculationResult')}
                </Silian_CardTitle>
                <Silian_CardDescription className="text-xs">
                  {Silian_t('activities.form.enterDataToPreview')}
                </Silian_CardDescription>
              </Silian_CardHeader>
              <Silian_CardContent className="text-xs text-muted-foreground">
                {Silian_t('activities.form.previewPlaceholder')}
              </Silian_CardContent>
            </Silian_Card>
          )}
        </div>
      </div>
    </div>  /* END grid container */
  );
}
