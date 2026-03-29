import React, { useState, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { CheckCircle, ArrowLeft, Leaf } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { carbonAPI } from '../../lib/api';
import { ActivitySelector } from './ActivitySelector';
import DataInputForm from './DataInputForm';
import { Button } from '../ui/Button';
import { Alert, AlertDescription } from '../ui/Alert';
import { SmartActivityInput } from './SmartActivityInput';

const InteractiveReceipt = React.lazy(() => import('./InteractiveReceipt'));

export function CarbonCalculator() {
  const { t } = useTranslation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [currentStep, setCurrentStep] = useState(1);
  const [activities, setActivities] = useState([]); // Store fetched activities
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [smartData, setSmartData] = useState(null); // Data from AI
  const [calculationResult, setCalculationResult] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [error, setError] = useState('');

  const checkinDate = useMemo(() => {
    const raw = searchParams.get('checkin_date');
    if (!raw) {
      return null;
    }
    const trimmed = String(raw).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(trimmed) ? trimmed : null;
  }, [searchParams]);

  const clearCheckinDate = useCallback(() => {
    const next = new URLSearchParams(searchParams);
    next.delete('checkin_date');
    setSearchParams(next, { replace: true });
  }, [searchParams, setSearchParams]);

  // Fetch activities on mount to support Smart matching
  React.useEffect(() => {
    const fetchActivities = async () => {
      try {
        const response = await carbonAPI.getActivities();
        if (response?.data?.success) {
          const payload = response?.data?.data;
          const raw = Array.isArray(payload?.activities) ? payload.activities : (Array.isArray(payload) ? payload : []);
          setActivities(raw); // Store raw for now, or processed if needed
        }
      } catch (err) {
        console.error("Failed to fetch activities for smart matching", err);
      }
    };
    fetchActivities();
  }, []);

  const handleSmartSuggestion = (prediction) => {
    if (!prediction) return;

    // Prefer UUID match
    let match = null;
    if (prediction.activity_uuid) {
      match = activities.find(
        (a) =>
          String(a.id) === String(prediction.activity_uuid) ||
          String(a.uuid || '') === String(prediction.activity_uuid)
      );
    }

    // Fallback to name matching
    if (!match && prediction.activity_name) {
      const name = prediction.activity_name.toLowerCase();
      match = activities.find(
        (a) =>
          (a.name_en && a.name_en.toLowerCase() === name) ||
          (a.name_zh && a.name_zh.toLowerCase() === name) ||
          (a.name && a.name.toLowerCase() === name)
      );
    }

    if (match) {
      setSelectedActivity(match);
      setSmartData({
        amount: prediction.amount,
        unit: prediction.unit,
        description: prediction.notes || prediction.description, // if AI returns it
        activity_date: prediction.activity_date || null,
      });
      setCurrentStep(2);
      setError('');
    } else {
      // Fallback: Show error or try fuzzy match (omitted for now)
      setError(t('activities.smartAdd.notFound') || `Could not find activity type: ${prediction.activity_name}`);
    }
  };

  const steps = [
    { id: 1, title: t('activities.form.selectActivity'), description: t('activities.form.selectActivityDesc') },
    { id: 2, title: t('activities.form.dataInput'), description: t('activities.form.dataInputDesc') },
    { id: 3, title: t('activities.form.submit'), description: t('activities.form.submitDesc') }
  ];

  // 选择活动
  const handleActivitySelect = (activity) => {
    setSelectedActivity(activity);
    setCalculationResult(null);
    setError('');
    setCurrentStep(2);
  };

  // 计算碳减排
  // 使用 useCallback 保持函数引用稳定，避免子组件 useEffect 因 onCalculate 引用变化而重复触发
  const handleCalculate = useCallback(async (data) => {
    if (!selectedActivity) return;

    setIsCalculating(true);
    setError('');

    try {
      const activityId = selectedActivity.id || selectedActivity.uuid;
      const response = await carbonAPI.calculate(activityId, data);

      if (response.data.success) {
        setCalculationResult(response.data.data);
      } else {
        setError(response.data.message || t('activities.form.calculationFailed'));
      }
    } catch (err) {
      // 忽略被取消的请求（快速输入时会取消上一次未完成的计算）
      const msg = err?.message || '';
      if (err?.code === 'ERR_CANCELED' || /aborted|canceled/i.test(msg)) {
        return;
      }
      setError(msg || t('activities.form.calculationFailed'));
    } finally {
      setIsCalculating(false);
    }
  }, [selectedActivity, t]);

  // 提交记录
  const handleSubmit = async (formData) => {
    setIsSubmitting(true);
    setError('');

    try {
      const response = await carbonAPI.recordActivity({
        ...formData
      });

      if (response.data.success) {
        // 后端 submitRecord 返回 { success, record_id, calculation: { carbon_saved, points_earned }, message }
        const calc = response.data.calculation || {};
        setSubmitResult({
          carbon_saved: calc.carbon_saved || 0,
          points_earned: calc.points_earned || 0,
          record_id: response.data.record_id,
          amount: formData.amount,
          date: formData.date,
          checkin_date: formData.checkin_date || null,
          description: formData.description || '',
          images: Array.isArray(formData.images) ? formData.images : [],
          image_count: Array.isArray(formData.images) ? formData.images.length : 0,
          submitted_at: new Date().toISOString(),
          activity: selectedActivity ? { ...selectedActivity } : null,
        });
        setCurrentStep(3);
      } else {
        setError(response.data.message || t('activities.form.submitFailed'));
      }
    } catch (err) {
      setError(err.message || t('activities.form.submitFailed'));
    } finally {
      setIsSubmitting(false);
    }
  };

  // 重新开始
  const handleRestart = () => {
    setCurrentStep(1);
    setSelectedActivity(null);
    setSmartData(null);
    setCalculationResult(null);
    setSubmitResult(null);
    setError('');
  };

  // 返回上一步
  const handleBack = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
      setError('');
    }
  };

  return (
    <div className="relative min-h-full">
      {/* Ambient Glow */}
      <div className="absolute top-0 left-1/2 -z-10 h-[500px] w-[800px] -translate-x-1/2 blur-[120px] bg-gradient-to-tr from-green-50/50 via-emerald-100/30 to-transparent opacity-50 dark:from-green-900/20 dark:via-emerald-900/10 dark:opacity-30 pointer-events-none" />

      <div className="max-w-4xl mx-auto p-6 relative">
        {/* 页面标题 */}
        <div className="text-center mb-8">
          <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-green-500/12 shadow-sm border border-green-500/20 backdrop-blur-md">
            <Leaf className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60">
            {t('activities.title')}
          </h1>
          <p className="text-lg text-muted-foreground">
            {t('activities.description')}
          </p>
        </div>

      {/* 步骤指示器 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {steps.map((step, index) => (
            <div key={step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${currentStep >= step.id
                ? 'bg-green-600 border-green-600 text-white'
                : 'border-border text-muted-foreground'
                }`}>
                {currentStep > step.id ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <span className="text-sm font-medium">{step.id}</span>
                )}
              </div>

              <div className="ml-3 hidden sm:block">
                <div className={`text-sm font-medium ${currentStep >= step.id ? 'text-green-600' : 'text-muted-foreground'
                  }`}>
                  {step.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {step.description}
                </div>
              </div>

              {index < steps.length - 1 && (
                <div className={`mx-4 h-0.5 flex-1 ${currentStep > step.id ? 'bg-green-600' : 'bg-border'
                  }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 错误提示 */}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {checkinDate && (
        <Alert className="mb-6 border-emerald-200 bg-emerald-50 text-emerald-800">
          <AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{t('activities.checkin.makeupNotice',  { date: checkinDate })}</span>
            <Button variant="ghost" size="sm" onClick={clearCheckinDate}>
              {t('activities.checkin.clear')}
            </Button>
          </AlertDescription>
        </Alert>
      )}

      {/* 步骤内容 */}
      <div className="space-y-6">
        {/* 步骤1: 选择活动 */}
        {currentStep === 1 && (
          <>
            <SmartActivityInput onSuggestion={handleSmartSuggestion} />
            <ActivitySelector
              onActivitySelect={handleActivitySelect}
              selectedActivity={selectedActivity}
            />
          </>
        )}

        {/* 步骤2: 输入数据 */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex items-center gap-2"
              >
                <ArrowLeft className="w-4 h-4" />
                {t('common.back')}
              </Button>
              <div className="text-sm text-muted-foreground">
                {t('activities.form.step2Of3')}
              </div>
            </div>

            <DataInputForm
              activity={selectedActivity}
              onCalculate={handleCalculate}
              onSubmit={handleSubmit}
              calculationResult={calculationResult}
              isCalculating={isCalculating}
              isSubmitting={isSubmitting}
              initialData={smartData}
              checkinDate={checkinDate}
            />
          </div>
        )}

        {/* 步骤3: 提交成功 */}
        {currentStep === 3 && submitResult && (
          <React.Suspense fallback={<div className="h-[560px] rounded-[36px] border border-black/6 bg-white" />}>
            <InteractiveReceipt
              receipt={submitResult}
              onRestart={handleRestart}
              onGoDashboard={() => {
                window.location.href = '/dashboard';
              }}
            />
          </React.Suspense>
        )}
      </div>
    </div>
    </div>
  );
}
