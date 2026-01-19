import React, { useState, useEffect, useRef } from 'react';
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

export default function DataInputForm({
  activity,
  onCalculate,
  onSubmit,
  calculationResult,
  isSubmitting,
  initialData
}) {
  const { t, currentLanguage } = useTranslation();
  // 选中的本地文件（未立即上传）
  const [selectedFiles, setSelectedFiles] = useState([]);
  const [uploadError, setUploadError] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadedMeta, setUploadedMeta] = useState([]); // 成功上传后的元数据
  const [previewUrls, setPreviewUrls] = useState([]);
  const [progress, setProgress] = useState({ done: 0, total: 0 });
  const [showCalculation, setShowCalculation] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const fileInputRef = useRef(null);

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

  const onFormSubmit = async (data) => {
    setUploadError('');
    // 校验至少一张图片
    if (!selectedFiles.length && !uploadedMeta.length) {
      setUploadError(t('activities.form.imageRequired') || '请至少选择一张图片');
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
        setUploadError(e.message || '上传失败');
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
    onSubmit(payload);
  };

  const processFiles = (files) => {
    setUploadError('');
    const MAX = 5;
    const MAX_SIZE = 5 * 1024 * 1024;

    const currentFiles = [...selectedFiles];
    const currentPreviews = [...previewUrls];

    if (currentFiles.length + files.length > MAX) {
      setUploadError(t('activities.form.maxFilesReached') || '最多只能上传 5 张图片');
      return;
    }

    const newFiles = [];
    const newPreviews = [];

    for (const f of files) {
      if (f.size > MAX_SIZE) {
        setUploadError(t('activities.form.fileTooLarge') || '文件过大');
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
          <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <p className="text-gray-600">{t('activities.selectActivityFirst')}</p>
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
    <Card className="bg-green-50 border-green-200 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-sm font-medium text-green-800">
          {t('activities.form.calculationResult')}
        </CardTitle>
        <CardDescription className="text-xs">
          {t('activities.form.previewAutoUpdate') || '实时预览'}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="space-y-4">
          <div className="bg-white rounded-lg p-3 border">
            <div className="text-xs text-gray-500 mb-1">{t('activities.carbonSaved')} (kg CO₂)</div>
            <div className="text-2xl font-bold text-green-600 leading-none">
              {(() => { const v = calculationResult.carbon_saved; const num = typeof v === 'number' ? v : Number(v); return Number.isFinite(num) ? num.toFixed(2) : '0.00'; })()}
            </div>
          </div>
          <div className="bg-white rounded-lg p-3 border">
            <div className="text-xs text-gray-500 mb-1">{t('activities.form.expectedPoints')}</div>
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
                <span className="text-gray-500">{t('activities.category')}:</span>
                <div className="font-medium">
                  {t(`activities.categories.${activity.category}`)}
                </div>
              </div>
              <div>
                <span className="text-gray-500">{t('activities.unit')}:</span>
                <div className="font-medium">{t(`units.${activity.unit}`, activity.unit)}</div>
              </div>
              <div>
                <span className="text-gray-500">{t('activities.carbonFactor')}:</span>
                <div className="font-medium text-green-600">
                  {activity.carbon_factor}
                </div>
              </div>
              {activity.points_per_unit && (
                <div>
                  <span className="text-gray-500">{t('activities.pointsPerUnit')}:</span>
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
              </div>

              {/* 备注/描述 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
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
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Upload className="inline h-4 w-4 mr-1" />
                  {t('activities.form.uploadImage')}
                </label>

                <div
                  className={cn(
                    "border-2 border-dashed rounded-lg p-6 flex flex-col items-center justify-center gap-3 transition-all duration-200 cursor-pointer",
                    isDragging ? "border-green-500 bg-green-50 scale-[1.02]" : "border-gray-300 hover:border-green-400 hover:bg-gray-50",
                    uploadError ? "border-red-300 bg-red-50" : ""
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

                  <div className={cn("p-3 rounded-full transition-colors", isDragging ? "bg-green-100" : "bg-gray-100")}>
                    <Upload className={cn("h-6 w-6", isDragging ? "text-green-600" : "text-gray-500")} />
                  </div>

                  <div className="text-center">
                    <p className="text-sm font-medium text-gray-700">
                      {isDragging ? (t('activities.form.dropHere') || '释放以上传') : (t('activities.form.clickOrDrag') || '点击或拖拽上传图片')}
                    </p>
                    <p className="text-xs text-gray-500 mt-1">
                      {t('activities.form.uploadHint') || '支持 JPG, PNG (最大 5MB)'}
                    </p>
                  </div>
                </div>

                {/* File List & Status */}
                <div className="mt-4 space-y-3">
                  {selectedFiles.length > 0 && (
                    <ul className="space-y-2 text-sm">
                      {selectedFiles.map((f, i) => (
                        <li key={i} className="flex items-center justify-between bg-gray-50 px-3 py-2 rounded-md border border-gray-200 hover:border-gray-300 transition-colors">
                          <div className="flex items-center gap-3 min-w-0">
                            {previewUrls[i] && <img src={previewUrls[i]} alt={f.name} className="h-10 w-10 object-cover rounded border border-gray-200" />}
                            <div className="flex flex-col min-w-0">
                              <span className="truncate font-medium text-gray-700">{f.name}</span>
                              <span className="text-xs text-gray-500">{(f.size / 1024).toFixed(1)} KB</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); removeFile(i); }}
                            className="p-1 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                          >
                            <X className="h-4 w-4" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}

                  {uploading && (
                    <div className="text-xs text-blue-600 flex items-center gap-2">
                      <div className="animate-spin rounded-full h-3 w-3 border-2 border-blue-600 border-t-transparent"></div>
                      {t('common.uploading') || '正在上传...'} {progress.total > 0 ? `${progress.done}/${progress.total}` : ''}
                    </div>
                  )}

                  {uploadError && (
                    <p className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" />
                      {uploadError}
                    </p>
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
                  {(isSubmitting || uploading) ? (t('activities.form.submitting') || '提交中...') : t('activities.form.submit')}
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
                <CardTitle className="text-sm text-gray-600">
                  {t('activities.form.calculationResult')}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t('activities.form.enterDataToPreview') || '输入数值后出现'}
                </CardDescription>
              </CardHeader>
              <CardContent className="text-xs text-gray-400">
                {t('activities.form.previewPlaceholder') || '填写数据以查看实时计算'}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>  /* END grid container */
  );
}
