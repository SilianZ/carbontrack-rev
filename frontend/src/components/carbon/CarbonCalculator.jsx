import React, { useState, useCallback } from 'react';
import { CheckCircle, ArrowLeft, Leaf } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { carbonAPI } from '../../lib/api';
import { ActivitySelector } from './ActivitySelector';
import DataInputForm from './DataInputForm';
import { Button } from '../ui/Button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Alert, AlertDescription } from '../ui/Alert';
import { SmartActivityInput } from './SmartActivityInput';

export function CarbonCalculator() {
  const { t } = useTranslation();
  const [currentStep, setCurrentStep] = useState(1);
  const [activities, setActivities] = useState([]); // Store fetched activities
  const [loadingActivities, setLoadingActivities] = useState(false);
  const [selectedActivity, setSelectedActivity] = useState(null);
  const [smartData, setSmartData] = useState(null); // Data from AI
  const [calculationResult, setCalculationResult] = useState(null);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitResult, setSubmitResult] = useState(null);
  const [error, setError] = useState('');

  // Fetch activities on mount to support Smart matching
  React.useEffect(() => {
    const fetchActivities = async () => {
      try {
        setLoadingActivities(true);
        const response = await carbonAPI.getActivities();
        if (response?.data?.success) {
          const payload = response?.data?.data;
          const raw = Array.isArray(payload?.activities) ? payload.activities : (Array.isArray(payload) ? payload : []);
          setActivities(raw); // Store raw for now, or processed if needed
        }
      } catch (err) {
        console.error("Failed to fetch activities for smart matching", err);
      } finally {
        setLoadingActivities(false);
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
        description: prediction.notes || prediction.description // if AI returns it (currently doesn't, but good for future)
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
          record_id: response.data.record_id
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
    <div className="max-w-4xl mx-auto p-6">
      {/* 页面标题 */}
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4">
          <Leaf className="w-8 h-8 text-green-600" />
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          {t('activities.title')}
        </h1>
        <p className="text-gray-600">
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
                : 'border-gray-300 text-gray-500'
                }`}>
                {currentStep > step.id ? (
                  <CheckCircle className="w-6 h-6" />
                ) : (
                  <span className="text-sm font-medium">{step.id}</span>
                )}
              </div>

              <div className="ml-3 hidden sm:block">
                <div className={`text-sm font-medium ${currentStep >= step.id ? 'text-green-600' : 'text-gray-500'
                  }`}>
                  {step.title}
                </div>
                <div className="text-xs text-gray-500">
                  {step.description}
                </div>
              </div>

              {index < steps.length - 1 && (
                <div className={`flex-1 h-0.5 mx-4 ${currentStep > step.id ? 'bg-green-600' : 'bg-gray-300'
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
              <div className="text-sm text-gray-600">
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
            />
          </div>
        )}

        {/* 步骤3: 提交成功 */}
        {currentStep === 3 && submitResult && (
          <Card className="bg-green-50 border-green-200">
            <CardHeader className="text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-green-100 rounded-full mb-4 mx-auto">
                <CheckCircle className="w-8 h-8 text-green-600" />
              </div>
              <CardTitle className="text-green-800">
                {t('activities.form.submitSuccess')}
              </CardTitle>
              <CardDescription>
                {t('activities.form.submitSuccessDesc')}
              </CardDescription>
            </CardHeader>

            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {(() => {
                      const v = submitResult.carbon_saved;
                      const num = typeof v === 'number' ? v : Number(v);
                      return Number.isFinite(num) ? num.toFixed(2) : '0.00';
                    })()}
                  </div>
                  <div className="text-sm text-gray-600">
                    {t('activities.carbonSaved')} (kg CO₂)
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {submitResult.points_earned || 0}
                  </div>
                  <div className="text-sm text-gray-600">
                    {t('activities.pointsEarned')}
                  </div>
                </div>

                <div className="bg-white rounded-lg p-4 text-center">
                  <div className="text-2xl font-bold text-orange-600">
                    {t('activities.status.pending')}
                  </div>
                  <div className="text-sm text-gray-600">
                    {t('activities.currentStatus')}
                  </div>
                </div>
              </div>

              <div className="text-center space-y-4">
                <p className="text-sm text-gray-600">
                  {t('activities.form.reviewNotice')}
                </p>

                <div className="flex gap-4 justify-center">
                  <Button onClick={handleRestart}>
                    {t('activities.form.recordAnother')}
                  </Button>

                  <Button variant="outline" onClick={() => window.location.href = '/dashboard'}>
                    {t('activities.form.goToDashboard')}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
