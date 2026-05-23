import Silian_React, { useState as Silian_useState, useCallback as Silian_useCallback, useMemo as Silian_useMemo } from 'react';
import { useSearchParams as Silian_useSearchParams } from 'react-router-dom';
import { CheckCircle as Silian_CheckCircle, ArrowLeft as Silian_ArrowLeft, Leaf as Silian_Leaf } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { carbonAPI as Silian_carbonAPI } from '../../lib/api';
import { ActivitySelector as Silian_ActivitySelector } from './ActivitySelector';
import Silian_DataInputForm from './DataInputForm';
import { Button as Silian_Button } from '../ui/Button';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription } from '../ui/Alert';
import { SmartActivityInput as Silian_SmartActivityInput } from './SmartActivityInput';

const Silian_InteractiveReceipt = Silian_React.lazy(() => import('./InteractiveReceipt'));

export function CarbonCalculator() {
  const { t: Silian_t } = Silian_useTranslation(['activities', 'common', 'errors', 'images']);
  const [Silian_searchParams, Silian_setSearchParams] = Silian_useSearchParams();
  const [Silian_currentStep, Silian_setCurrentStep] = Silian_useState(1);
  const [Silian_activities, Silian_setActivities] = Silian_useState([]); // Store fetched activities
  const [Silian_selectedActivity, Silian_setSelectedActivity] = Silian_useState(null);
  const [Silian_smartData, Silian_setSmartData] = Silian_useState(null); // Data from AI
  const [Silian_calculationResult, Silian_setCalculationResult] = Silian_useState(null);
  const [Silian_isCalculating, Silian_setIsCalculating] = Silian_useState(false);
  const [Silian_isSubmitting, Silian_setIsSubmitting] = Silian_useState(false);
  const [Silian_submitResult, Silian_setSubmitResult] = Silian_useState(null);
  const [Silian_error, Silian_setError] = Silian_useState('');

  const Silian_checkinDate = Silian_useMemo(() => {
    const Silian_raw = Silian_searchParams.get('checkin_date');
    if (!Silian_raw) {
      return null;
    }
    const Silian_trimmed = String(Silian_raw).trim();
    return /^\d{4}-\d{2}-\d{2}$/.test(Silian_trimmed) ? Silian_trimmed : null;
  }, [Silian_searchParams]);

  const Silian_clearCheckinDate = Silian_useCallback(() => {
    const Silian_next = new URLSearchParams(Silian_searchParams);
    Silian_next.delete('checkin_date');
    Silian_setSearchParams(Silian_next, { replace: true });
  }, [Silian_searchParams, Silian_setSearchParams]);

  // Fetch activities on mount to support Smart matching
  Silian_React.useEffect(() => {
    const Silian_fetchActivities = async () => {
      try {
        const Silian_response = await Silian_carbonAPI.getActivities();
        if (Silian_response?.data?.success) {
          const Silian_payload = Silian_response?.data?.data;
          const Silian_raw = Array.isArray(Silian_payload?.activities) ? Silian_payload.activities : (Array.isArray(Silian_payload) ? Silian_payload : []);
          Silian_setActivities(Silian_raw); // Store raw for now, or processed if needed
        }
      } catch (Silian_err) {
        console.error("Failed to fetch activities for smart matching", Silian_err);
      }
    };
    Silian_fetchActivities();
  }, []);

  const Silian_handleSmartSuggestion = (Silian_prediction) => {
    if (!Silian_prediction) return;

    // Prefer UUID match
    let Silian_match = null;
    if (Silian_prediction.activity_uuid) {
      Silian_match = Silian_activities.find(
        (Silian_a) =>
          String(Silian_a.id) === String(Silian_prediction.activity_uuid) ||
          String(Silian_a.uuid || '') === String(Silian_prediction.activity_uuid)
      );
    }

    // Fallback to name matching
    if (!Silian_match && Silian_prediction.activity_name) {
      const Silian_name = Silian_prediction.activity_name.toLowerCase();
      Silian_match = Silian_activities.find(
        (Silian_a) =>
          (Silian_a.name_en && Silian_a.name_en.toLowerCase() === Silian_name) ||
          (Silian_a.name_zh && Silian_a.name_zh.toLowerCase() === Silian_name) ||
          (Silian_a.name && Silian_a.name.toLowerCase() === Silian_name)
      );
    }

    if (Silian_match) {
      Silian_setSelectedActivity(Silian_match);
      Silian_setSmartData({
        amount: Silian_prediction.amount,
        unit: Silian_prediction.unit,
        description: Silian_prediction.notes || Silian_prediction.description, // if AI returns it
        activity_date: Silian_prediction.activity_date || null,
      });
      Silian_setCurrentStep(2);
      Silian_setError('');
    } else {
      // Fallback: Show error or try fuzzy match (omitted for now)
      Silian_setError(Silian_t('activities.smartAdd.notFound') || `Could not find activity type: ${Silian_prediction.activity_name}`);
    }
  };

  const Silian_steps = [
    { id: 1, title: Silian_t('activities.form.selectActivity'), description: Silian_t('activities.form.selectActivityDesc') },
    { id: 2, title: Silian_t('activities.form.dataInput'), description: Silian_t('activities.form.dataInputDesc') },
    { id: 3, title: Silian_t('activities.form.submit'), description: Silian_t('activities.form.submitDesc') }
  ];

  // 选择活动
  const Silian_handleActivitySelect = (Silian_activity) => {
    Silian_setSelectedActivity(Silian_activity);
    Silian_setCalculationResult(null);
    Silian_setError('');
    Silian_setCurrentStep(2);
  };

  // 计算碳减排
  // 使用 useCallback 保持函数引用稳定，避免子组件 useEffect 因 onCalculate 引用变化而重复触发
  const Silian_handleCalculate = Silian_useCallback(async (Silian_data) => {
    if (!Silian_selectedActivity) return;

    Silian_setIsCalculating(true);
    Silian_setError('');

    try {
      const Silian_activityId = Silian_selectedActivity.id || Silian_selectedActivity.uuid;
      const Silian_response = await Silian_carbonAPI.calculate(Silian_activityId, Silian_data);

      if (Silian_response.data.success) {
        Silian_setCalculationResult(Silian_response.data.data);
      } else {
        Silian_setError(Silian_response.data.message || Silian_t('activities.form.calculationFailed'));
      }
    } catch (Silian_err) {
      // 忽略被取消的请求（快速输入时会取消上一次未完成的计算）
      const Silian_msg = Silian_err?.message || '';
      if (Silian_err?.code === 'ERR_CANCELED' || /aborted|canceled/i.test(Silian_msg)) {
        return;
      }
      Silian_setError(Silian_msg || Silian_t('activities.form.calculationFailed'));
    } finally {
      Silian_setIsCalculating(false);
    }
  }, [Silian_selectedActivity, Silian_t]);

  // 提交记录
  const Silian_handleSubmit = async (Silian_formData) => {
    Silian_setIsSubmitting(true);
    Silian_setError('');

    try {
      const Silian_response = await Silian_carbonAPI.recordActivity({
        ...Silian_formData
      });

      if (Silian_response.data.success) {
        // 后端 submitRecord 返回 { success, record_id, calculation: { carbon_saved, points_earned }, message }
        const Silian_calc = Silian_response.data.calculation || {};
        Silian_setSubmitResult({
          carbon_saved: Silian_calc.carbon_saved || 0,
          points_earned: Silian_calc.points_earned || 0,
          record_id: Silian_response.data.record_id,
          amount: Silian_formData.amount,
          date: Silian_formData.date,
          checkin_date: Silian_formData.checkin_date || null,
          description: Silian_formData.description || '',
          images: Array.isArray(Silian_formData.images) ? Silian_formData.images : [],
          image_count: Array.isArray(Silian_formData.images) ? Silian_formData.images.length : 0,
          submitted_at: new Date().toISOString(),
          activity: Silian_selectedActivity ? { ...Silian_selectedActivity } : null,
        });
        Silian_setCurrentStep(3);
      } else {
        Silian_setError(Silian_response.data.message || Silian_t('activities.form.submitFailed'));
      }
    } catch (Silian_err) {
      Silian_setError(Silian_err.message || Silian_t('activities.form.submitFailed'));
    } finally {
      Silian_setIsSubmitting(false);
    }
  };

  // 重新开始
  const Silian_handleRestart = () => {
    Silian_setCurrentStep(1);
    Silian_setSelectedActivity(null);
    Silian_setSmartData(null);
    Silian_setCalculationResult(null);
    Silian_setSubmitResult(null);
    Silian_setError('');
  };

  // 返回上一步
  const Silian_handleBack = () => {
    if (Silian_currentStep > 1) {
      Silian_setCurrentStep(Silian_currentStep - 1);
      Silian_setError('');
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
            <Silian_Leaf className="w-8 h-8 text-green-600" />
          </div>
          <h1 className="mb-2 text-4xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60">
            {Silian_t('activities.title')}
          </h1>
          <p className="text-lg text-muted-foreground">
            {Silian_t('activities.description')}
          </p>
        </div>

      {/* 步骤指示器 */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          {Silian_steps.map((Silian_step, Silian_index) => (
            <div key={Silian_step.id} className="flex items-center">
              <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${Silian_currentStep >= Silian_step.id
                ? 'bg-green-600 border-green-600 text-white'
                : 'border-border text-muted-foreground'
                }`}>
                {Silian_currentStep > Silian_step.id ? (
                  <Silian_CheckCircle className="w-6 h-6" />
                ) : (
                  <span className="text-sm font-medium">{Silian_step.id}</span>
                )}
              </div>

              <div className="ml-3 hidden sm:block">
                <div className={`text-sm font-medium ${Silian_currentStep >= Silian_step.id ? 'text-green-600' : 'text-muted-foreground'
                  }`}>
                  {Silian_step.title}
                </div>
                <div className="text-xs text-muted-foreground">
                  {Silian_step.description}
                </div>
              </div>

              {Silian_index < Silian_steps.length - 1 && (
                <div className={`mx-4 h-0.5 flex-1 ${Silian_currentStep > Silian_step.id ? 'bg-green-600' : 'bg-border'
                  }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* 错误提示 */}
      {Silian_error && (
        <Silian_Alert variant="destructive" className="mb-6">
          <Silian_AlertDescription>{Silian_error}</Silian_AlertDescription>
        </Silian_Alert>
      )}

      {Silian_checkinDate && (
        <Silian_Alert className="mb-6 border-emerald-200 bg-emerald-50 text-emerald-800">
          <Silian_AlertDescription className="flex flex-wrap items-center justify-between gap-2">
            <span>{Silian_t('activities.checkin.makeupNotice',  { date: Silian_checkinDate })}</span>
            <Silian_Button variant="ghost" size="sm" onClick={Silian_clearCheckinDate}>
              {Silian_t('activities.checkin.clear')}
            </Silian_Button>
          </Silian_AlertDescription>
        </Silian_Alert>
      )}

      {/* 步骤内容 */}
      <div className="space-y-6">
        {/* 步骤1: 选择活动 */}
        {Silian_currentStep === 1 && (
          <>
            <Silian_SmartActivityInput onSuggestion={Silian_handleSmartSuggestion} />
            <Silian_ActivitySelector
              onActivitySelect={Silian_handleActivitySelect}
              selectedActivity={Silian_selectedActivity}
            />
          </>
        )}

        {/* 步骤2: 输入数据 */}
        {Silian_currentStep === 2 && (
          <div className="space-y-6">
            <div className="flex items-center gap-4">
              <Silian_Button
                variant="outline"
                onClick={Silian_handleBack}
                className="flex items-center gap-2"
              >
                <Silian_ArrowLeft className="w-4 h-4" />
                {Silian_t('common.back')}
              </Silian_Button>
              <div className="text-sm text-muted-foreground">
                {Silian_t('activities.form.step2Of3')}
              </div>
            </div>

            <Silian_DataInputForm
              activity={Silian_selectedActivity}
              onCalculate={Silian_handleCalculate}
              onSubmit={Silian_handleSubmit}
              calculationResult={Silian_calculationResult}
              isCalculating={Silian_isCalculating}
              isSubmitting={Silian_isSubmitting}
              initialData={Silian_smartData}
              checkinDate={Silian_checkinDate}
            />
          </div>
        )}

        {/* 步骤3: 提交成功 */}
        {Silian_currentStep === 3 && Silian_submitResult && (
          <Silian_React.Suspense fallback={<div className="h-[560px] rounded-[36px] border border-black/6 bg-white" />}>
            <Silian_InteractiveReceipt
              receipt={Silian_submitResult}
              onRestart={Silian_handleRestart}
              onGoDashboard={() => {
                window.location.href = '/dashboard';
              }}
            />
          </Silian_React.Suspense>
        )}
      </div>
    </div>
    </div>
  );
}
