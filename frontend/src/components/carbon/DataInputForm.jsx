import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Calculator, Calendar, FileText, Upload, AlertCircle, Image as ImageIcon, X } from 'lucide-react';
import { batchUpload } from '../../lib/r2Upload';
import { useTranslation } from '../../hooks/useTranslation';
import { cn } from '../../lib/utils';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Alert, AlertDescription } from '../ui/Alert';
// 移除即时上传组件，改为提交时统一上传

const MAX_UPLOAD_FILES = 5;
const MAX_UPLOAD_SIZE = 5 * 1024 * 1024;
const SUPPORTED_IMAGE_MIME_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
const SUPPORTED_IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];

export default function DataInputForm({
  activity,
  onCalculate,
  onSubmit,
  calculationResult,
  isSubmitting,
  initialData,
  checkinDate
}) {
  const { t, currentLanguage, tFileSize } = useTranslation(['activities', 'common', 'date', 'errors', 'units', 'validation']);
  // 选中的本地文件（未立即上传）
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadError, setUploadError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadedMeta, setUploadedMeta] = useState([]); // 成功上传后的元数据
  const [previewUrls, setPreviewUrls] = useState([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [showCalculation, setShowCalculation] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);
  const getSafePreviewUrl = useCallback((previewUrl) => (
    typeof previewUrl === 'string' && previewUrl.startsWith('blob:') ? previewUrl : ''
  ), []);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors }
  } = useForm({
    defaultValues: {
      activity_date: new Date().toISOString().split('T')[0],
      description: ''
    }
  });

  // Handle initial data from Smart Add
  useEffect(() => {
    if (initialData && initialData.amount) {
      setValue('data', initialData.amount);
      if (initialData.description) {
        setValue('description', initialData.description);
      }
      if (initialData.activity_date) {
        setValue('activity_date', initialData.activity_date);
      }
      // Trigger calculation if needed, but the existing useEffect watches 'watchedData' which will update when we setValue
    }
  }, [initialData, setValue]);

  const watchedData = watch('data');

  // 避免在开发模式 StrictMode 下的双调用，以及快速输入引发的请求风暴：
  // - 使用 debounce（300ms）
  // - 使用 lastCalcKeyRef 记录上次计算的 key（activityId+data），相同时不重复调用
  const lastCalcKeyRef = useRef('');
  const debounceTimerRef = useRef(null);

  useEffect(() => {
    const activityId = activity?.id || activity?.uuid || '';
    const val = watchedData;

    // 清理上一次的定时器
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = null;
    }

    // 输入为空或非正数时隐藏计算结果
    const parsed = parseFloat(val);
    if (!activityId || !val || isNaN(parsed) || parsed <= 0) {
      setShowCalculation(false);
      return;
    }

    // 设置防抖
    debounceTimerRef.current = setTimeout(() => {
      const key = `${activityId}::${parsed}`;
      if (lastCalcKeyRef.current === key) {
        // 与上次相同参数，避免重复调用
        setShowCalculation(true);
        return;
      }
      lastCalcKeyRef.current = key;
      onCalculate(parsed);
      setShowCalculation(true);
    }, 300);

    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
    };
  }, [activity, watchedData, onCalculate]);

  const setDetailedUploadError = (summary, details = []) => {
    setUploadError({
      summary,
      details: details.filter(Boolean),
    });
  };

  const buildUploadErrorFromException = (error) => {
    const rawMessage = String(error?.rawMessage || error?.message || '').trim();
    const normalizedMessage = rawMessage.toLowerCase();
    const status = error?.status ?? null;
    const requestId = error?.requestId || error?.request_id || null;
    const fileName = error?.fileName || error?.file_name || null;
    const step = error?.step || null;
    const details = [];
    const supportedFormats = SUPPORTED_IMAGE_EXTENSIONS.map((item) => item.toUpperCase()).join(', ');

    if (fileName) {
      details.push(t('activities.form.uploadErrors.details.file', { name: fileName }));
    }

    if (requestId) {
      details.push(t('activities.form.uploadErrors.details.requestId', { id: requestId }));
    }

    if (status === 401 || normalizedMessage === 'unauthorized') {
      return {
        summary: t('activities.form.uploadErrors.expiredSessionSummary'),
        details,
      };
    }

    if (rawMessage === 'MIME type not allowed' || rawMessage === 'File extension not allowed') {
      return {
        summary: t('activities.form.uploadErrors.unsupportedFormatSummary'),
        details: [
          ...details,
          t('activities.form.uploadErrors.details.supportedFormats', { formats: supportedFormats }),
        ],
      };
    }

    if (rawMessage === 'File size exceeds limit') {
      return {
        summary: t('activities.form.uploadErrors.fileTooLargeSummary'),
        details: [
          ...details,
          t('activities.form.uploadErrors.details.maxSize', { size: tFileSize(MAX_UPLOAD_SIZE) }),
        ],
      };
    }

    if (rawMessage === 'File not found in storage') {
      return {
        summary: t('activities.form.uploadErrors.storageDelaySummary'),
        details: [
          ...details,
          t('activities.form.uploadErrors.storageDelayDetail'),
        ],
      };
    }

    if (rawMessage === 'File ownership conflict detected' || error?.code === 'FILE_OWNERSHIP_CONFLICT') {
      return {
        summary: t('activities.form.uploadErrors.ownershipConflictSummary'),
        details: [
          ...details,
          t('activities.form.uploadErrors.ownershipConflictDetail'),
        ],
      };
    }

    if (rawMessage === 'Invalid directory name') {
      return {
        summary: t('activities.form.uploadErrors.invalidConfigSummary'),
        details: [
          ...details,
          t('activities.form.uploadErrors.invalidConfigDetail'),
        ],
      };
    }

    if (
      normalizedMessage.includes('network error') ||
      normalizedMessage.includes('failed to fetch') ||
      error?.code === 'ERR_NETWORK'
    ) {
      return {
        summary: t('activities.form.uploadErrors.networkSummary'),
        details: [
          ...details,
          t('activities.form.uploadErrors.networkDetail'),
        ],
      };
    }

    if (normalizedMessage.includes('timeout') || error?.code === 'ECONNABORTED') {
      return {
        summary: t('activities.form.uploadErrors.timeoutSummary'),
        details: [
          ...details,
          t('activities.form.uploadErrors.timeoutDetail'),
        ],
      };
    }

    if (step === 'put') {
      return {
        summary: t('activities.form.uploadErrors.putSummary'),
        details: [
          ...details,
          t('activities.form.uploadErrors.putDetail'),
        ],
      };
    }

    if (step === 'presign') {
      return {
        summary: t('activities.form.uploadErrors.presignSummary'),
        details: [
          ...details,
          t('activities.form.uploadErrors.presignDetail'),
        ],
      };
    }

    if (step === 'confirm') {
      return {
        summary: t('activities.form.uploadErrors.confirmSummary'),
        details: [
          ...details,
          t('activities.form.uploadErrors.confirmDetail'),
        ],
      };
    }

    return {
      summary: t('activities.form.uploadErrors.genericSummary'),
      details: [
        ...details,
        rawMessage
          ? t('activities.form.uploadErrors.details.serverMessage', { message: rawMessage })
          : t('activities.form.uploadErrors.genericDetail'),
      ],
    };
  };

  const isSupportedImageFile = (file) => {
    const ext = (file?.name?.split('.').pop() || '').toLowerCase();
    if (file?.type && SUPPORTED_IMAGE_MIME_TYPES.includes(file.type)) {
      return true;
    }
    return SUPPORTED_IMAGE_EXTENSIONS.includes(ext);
  };

  const onFormSubmit = async (data) => {
    setUploadError(null);
    // 校验至少一张图片
    if (!selectedFiles.length && !uploadedMeta.length) {
      setDetailedUploadError(
        t('activities.form.imageRequired'),
        [
          t('activities.form.uploadErrors.proofImageRequiredDetail'),
        ]
      );
      return;
    }
    // 若还未上传（正常情况）则先上传
    let finalImages = uploadedMeta;
    if (!uploadedMeta.length && selectedFiles.length) {
      try {
        setUploading(true);
        const total = selectedFiles.length;
        setProgress({ done: 0, total });
        const results = await batchUpload(selectedFiles, { directory: 'activities', entityType: 'carbon_record' }, (idx, len) => {
          setProgress({ done: idx, total: len });
        });
        finalImages = results.map(r => ({
          url: r.url,
          file_path: r.file_path,
          original_name: r.original_name,
          mime_type: r.mime_type,
          size: r.size
        }));
        setUploadedMeta(finalImages);
      } catch (e) {
        const readableError = buildUploadErrorFromException(e);
        setDetailedUploadError(readableError.summary, readableError.details);
        setUploading(false);
        return;
      }
      setUploading(false);
    }

    const payload = {
      activity_id: activity.id || activity.uuid,
      amount: parseFloat(data.data),
      date: data.activity_date,
      description: data.description,
      images: (finalImages || []).map(i => ({ url: i.url, file_path: i.file_path, original_name: i.original_name, mime_type: i.mime_type, size: i.size }))
    };
    if (checkinDate) {
      payload.checkin_date = checkinDate;
    }
    onSubmit(payload);
  };

  const processFiles = (files) => {
    setUploadError(null);

    const currentFiles = [...selectedFiles];
    const currentPreviews = [...previewUrls];

    if (currentFiles.length + files.length > MAX_UPLOAD_FILES) {
      setDetailedUploadError(
        t('activities.form.maxFilesReached'),
        [
          t('activities.form.uploadErrors.maxFilesDetail', { current: currentFiles.length, incoming: files.length }),
        ]
      );
      return;
    }

    const newFiles = [];
    const newPreviews = [];

    for (const f of files) {
      if (!isSupportedImageFile(f)) {
        setDetailedUploadError(
          t('activities.form.uploadErrors.unsupportedFormatSummary'),
          [
            t('activities.form.uploadErrors.details.file', { name: f.name }),
            t('activities.form.uploadErrors.details.supportedFormats', {
              formats: SUPPORTED_IMAGE_EXTENSIONS.map((item) => item.toUpperCase()).join(', '),
            }),
          ]
        );
        continue;
      }
      if (f.size > MAX_UPLOAD_SIZE) {
        setDetailedUploadError(
          t('activities.form.fileTooLarge'),
          [
            t('activities.form.uploadErrors.details.file', { name: f.name }),
            t('activities.form.uploadErrors.details.currentSize', { size: tFileSize(f.size) }),
            t('activities.form.uploadErrors.details.maxSize', { size: tFileSize(MAX_UPLOAD_SIZE) }),
          ]
        );
        continue;
      }
      // 简单去重：同名同大小
      if (currentFiles.some(existing => existing.name === f.name && existing.size === f.size)) {
        continue;
      }
      newFiles.push(f);
      newPreviews.push(URL.createObjectURL(f));
    }

    setSelectedFiles([...currentFiles, ...newFiles]);
    setPreviewUrls([...currentPreviews, ...newPreviews]);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    processFiles(files);
    e.target.value = null; // 重置 input，允许重复选择同一文件
  };

  const handleDragOver = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    const files = Array.from(e.dataTransfer.files || []);
    processFiles(files);
  };

  const triggerFileInput = () => {
    fileInputRef.current?.click();
  };

  const removeFile = (idx) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== idx));
    setPreviewUrls(prev => {
      const newUrls = prev.filter((_, i) => i !== idx);
      // 释放被删除的 URL 对象
      if (prev[idx]) URL.revokeObjectURL(prev[idx]);
      return newUrls;
    });
  };

  if (!activity) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <AlertCircle className="mx-auto mb-4 h-12 w-12 text-muted-foreground" />
          <p className="text-muted-foreground">{t('activities.selectActivityFirst')}</p>
        </CardContent>
      </Card>
    );
  }

  const getActivityName = (activity) => {
    const isEn = (currentLanguage || '').toLowerCase().startsWith('en');
    return isEn
      ? (activity.name_en || activity.name_zh || activity.name)
      : (activity.name_zh || activity.name_en || activity.name);
  };

  const getActivityDescription = (activity) => {
    const isEn = (currentLanguage || '').toLowerCase().startsWith('en');
    return isEn
      ? (activity.description_en || activity.description_zh || activity.description)
      : (activity.description_zh || activity.description_en || activity.description);
  };

  const calculationCard = (showCalculation && calculationResult) ? (
    <Card className="border-green-500/20 bg-green-500/10 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-green-500">
          {t('activities.form.calculationResult')}
        </CardTitle>
        <CardDescription className="text-xs">
          {t('activities.form.previewAutoUpdate')}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="mb-1 text-xs text-muted-foreground">{t('activities.form.carbonSavedMetric')}</div>
            <div className="text-2xl font-bold text-green-600 leading-none">
              {(() => { const v = calculationResult.carbon_saved; const num = typeof v === 'number' ? v : Number(v); return Number.isFinite(num) ? num.toFixed(2) : '0.00'; })()}
            </div>
          </div>
          <div className="rounded-lg border border-border bg-card p-3">
            <div className="mb-1 text-xs text-muted-foreground">{t('activities.form.expectedPoints')}</div>
            <div className="text-2xl font-bold text-blue-600 leading-none">
              {calculationResult.points_earned ?? 0}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  ) : null;

  return (
    <div className="space-y-6 md:space-y-0 md:grid md:grid-cols-12 md:gap-6">
      {/* 主列 */}
      <div className="md:col-span-8 space-y-6">
        {/* 选中的活动信息 */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calculator className="h-5 w-5 text-green-600" />
              {getActivityName(activity)}
            </CardTitle>
            <CardDescription>
              {getActivityDescription(activity)}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">{t('activities.category')}:</span>
                <div className="font-medium">
                  {t(`activities.categories.${activity.category}`)}
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">{t('activities.unit')}:</span>
                    <div className="font-medium">{t(`units.${activity.unit}`, activity.unit)}</div>
              </div>
              <div>
                <span className="text-muted-foreground">{t('activities.carbonFactor')}:</span>
                <div className="font-medium text-green-600">
                  {activity.carbon_factor}
                </div>
              </div>
              {activity.points_per_unit && (
                <div>
                  <span className="text-muted-foreground">{t('activities.pointsPerUnit')}:</span>
                  <div className="font-medium text-blue-600">
                    {activity.points_per_unit}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* 移动端显示预览（在表单上方） */}
        <div className="md:hidden">
          {calculationCard}
        </div>

        {/* 数据输入表单 */}
        <Card>
          <CardHeader>
            <CardTitle>{t('activities.form.dataInput')}</CardTitle>
            <CardDescription>
              {t('activities.form.inputDescription')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onFormSubmit)} className="space-y-6">
              {/* 数据输入 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  {t('activities.form.dataValue')} ({t(`units.${activity.unit}`, activity.unit)})
                </label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder={t('activities.form.dataPlaceholder')}
                  error={errors.data}
                  {...register('data', {
                    required: t('activities.form.dataRequired'),
                    min: { value: 0.01, message: t('activities.form.dataMinimum') }
                  })}
                />
                {errors.data && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.data.message}
                  </p>
                )}
              </div>

              {/* 活动日期 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  <Calendar className="inline h-4 w-4 mr-1" />
                  {t('activities.form.activityDate')}
                </label>
                <Input
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  error={errors.activity_date}
                  {...register('activity_date', {
                    required: t('activities.form.dateRequired')
                  })}
                />
                {errors.activity_date && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.activity_date.message}
                  </p>
                )}
                {checkinDate && (
                  <p className="mt-2 text-xs text-emerald-600">
                    {t('activities.checkin.makeupHelper',  { date: checkinDate })}
                  </p>
                )}
              </div>

              {/* 备注/描述 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  <FileText className="inline h-4 w-4 mr-1" />
                  {t('activities.form.notes')}
                </label>
                <textarea
                  rows={4}
                  placeholder={t('activities.form.notesPlaceholder')}
                  className={`flex w-full rounded-md border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${errors.description ? 'border-red-500 focus-visible:ring-red-500' : 'border-input ring-offset-background'}`}
                  {...register('description', {
                    maxLength: { value: 500, message: t('validation.maxLength', { max: 500 }) }
                  })}
                />
                {errors.description && (
                  <p className="mt-1 text-sm text-red-600">
                    {errors.description.message}
                  </p>
                )}
              </div>
              {/* 延迟上传：选择文件 */}
              <div>
                <label className="mb-2 block text-sm font-medium text-foreground">
                  <Upload className="inline h-4 w-4 mr-1" />
                  {t('activities.form.uploadImage')}
                </label>

                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 cursor-pointer",
                    isDragging ? "scale-[1.02] border-green-500 bg-green-500/10" : "border-border hover:border-green-500/60 hover:bg-muted/60",
                    uploadError ? "border-red-500/40 bg-red-500/10" : ""
                  )}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onDrop={handleDrop}
                  onClick={triggerFileInput}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileSelect}
                    className="hidden"
                  />

                  <div className={cn("rounded-full p-3 transition-colors", isDragging ? "bg-green-500/15" : "bg-muted")}>
                    <Upload className={cn("h-6 w-6", isDragging ? "text-green-500" : "text-muted-foreground")} />
                  </div>

                  <div className="text-center">
                    <p className="text-sm font-medium text-foreground">
                      {isDragging ? t('activities.form.dropHere') : t('activities.form.clickOrDrag')}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {t('activities.form.uploadHint')}
                    </p>
                  </div>
                </div>

                {/* File List & Status */}
                <div className="mt-4 space-y-3">
                  {selectedFiles.length > 0 && (
                    <ul className="space-y-2 text-sm">
                      {selectedFiles.map((f, i) => {
                        const safePreviewUrl = getSafePreviewUrl(previewUrls[i]);

                        return (
                          <li key={i} className="flex items-center justify-between rounded-md border border-border bg-muted/40 px-3 py-2 transition-colors hover:border-border/80">
                            <div className="flex items-center gap-3 min-w-0">
                              {safePreviewUrl && <img src={safePreviewUrl} alt={t('activities.form.imagePreviewAlt', { name: f.name })} className="h-10 w-10 rounded border border-border object-cover" />}
                              <div className="flex flex-col min-w-0">
                                <span className="truncate font-medium text-foreground">{f.name}</span>
                                <span className="text-xs text-muted-foreground">{t('activities.form.fileSizeLabel', { size: tFileSize(f.size) })}</span>
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                              className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-red-500/10 hover:text-red-500"
                            >
                              <X className="h-4 w-4" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}

                  {uploading && (
                    <div className="text-xs text-blue-600 flex items-center gap-2">
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent"></div>
                      {t('common.uploading')} {progress.total > 0 ? `${progress.done}/${progress.total}` : ''}
                    </div>
                  )}

                  {uploadError && (
                    <Alert variant="destructive" className="py-3">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription className="space-y-2">
                        <p className="text-sm font-medium">{uploadError.summary}</p>
                        {Array.isArray(uploadError.details) && uploadError.details.length > 0 && (
                          <ul className="list-disc space-y-1 pl-5 text-xs">
                            {uploadError.details.map((item) => (
                              <li key={item}>{item}</li>
                            ))}
                          </ul>
                        )}
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              </div>


              {/* 提交按钮 */}
              <div className="flex gap-4">
                <Button
                  type="submit"
                  className="flex-1"
                  loading={isSubmitting || uploading}
                  disabled={isSubmitting || uploading || !showCalculation}
                >
                  {(isSubmitting || uploading) ? t('activities.form.submitting') : t('activities.form.submit')}
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  onClick={() => window.location.reload()}
                >
                  {t('common.reset')}
                </Button>
              </div>

              {/* 提示信息 */}
              <Alert variant="info">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {t('activities.form.submitHint')}
                </AlertDescription>
              </Alert>
            </form>
          </CardContent>
        </Card>
      </div>{/* END 主列 */}

      {/* 侧栏：桌面端悬浮计算结果 */}
      <div className="hidden md:block md:col-span-4">
        <div className="sticky top-20 space-y-4">
          {calculationCard || (
            <Card className="border-dashed">
              <CardHeader className="pb-3">
                <CardTitle className="text-sm text-muted-foreground">
                  {t('activities.form.calculationResult')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('activities.form.enterDataToPreview')}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-muted-foreground">
                {t('activities.form.previewPlaceholder')}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>  /* END grid container */
  );
}
