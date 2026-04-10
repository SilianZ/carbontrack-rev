import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { schoolAPI, profileAPI } from '../lib/api';
import { userManager } from '../lib/auth';
import { Input } from '../components/ui/Input';
import { Button } from '../components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent, CardDescription } from '../components/ui/Card';
import { Alert, AlertDescription } from '../components/ui/Alert';
import Turnstile from '../components/common/Turnstile';
import { useTranslation } from '../hooks/useTranslation';

export default function OnboardingPage() {
  const navigate = useNavigate();
  const { t } = useTranslation(['auth', 'common', 'errors', 'onboarding', 'success']);
  const user = userManager.getUser();
  const currentSchoolId = user?.school_id;
  const [schools, setSchools] = useState([]);
  const [schoolQuery, setSchoolQuery] = useState('');
  const [selectedSchoolId, setSelectedSchoolId] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const turnstileRef = useRef(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const requiresTurnstile = Boolean(import.meta.env?.VITE_TURNSTILE_SITE_KEY || import.meta.env?.MODE !== 'production');

  const loadSchools = useCallback(async (search) => {
    try {
      const res = await schoolAPI.getSchools({ search, limit: 20, page: 1 });
      const list = res.data?.data?.schools || [];
      setSchools(list);
    } catch (e) {
      console.error('Load schools failed:', e);
    }
  }, []);

  useEffect(() => {
    if (currentSchoolId) {
      navigate('/dashboard', { replace: true });
    }
  }, [currentSchoolId, navigate]);

  useEffect(() => {
    if (currentSchoolId) {
      return undefined;
    }

    const trimmedQuery = schoolQuery.trim();
    const timer = setTimeout(() => {
      loadSchools(trimmedQuery);
    }, trimmedQuery ? 300 : 0);

    return () => clearTimeout(timer);
  }, [currentSchoolId, loadSchools, schoolQuery]);

  const ensureTurnstile = () => {
    if (requiresTurnstile && !turnstileToken) {
      setError(t('auth.verification.turnstileRequired'));
      return false;
    }

    return true;
  };

  const resetTurnstile = () => {
    setTurnstileToken('');
    turnstileRef.current?.reset?.();
  };

  const onSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError('');
    setSuccess('');

    try {
      const payload = {};
      if (selectedSchoolId) {
        payload.school_id = parseInt(selectedSchoolId, 10);
      } else if (schoolQuery.trim()) {
        payload.new_school_name = schoolQuery.trim();
      }

      if (Object.keys(payload).length === 0) {
        setError(t('onboarding.leastOneField'));
        setIsSubmitting(false);
        return;
      }

      if (!ensureTurnstile()) {
        setIsSubmitting(false);
        return;
      }

      payload.cf_turnstile_response = turnstileToken;

      const res = await profileAPI.updateProfile(payload);
      if (res.data?.success) {
        // 更新本地用户缓存（优先使用后端返回的完整用户数据）
        const newUser = res.data?.data ? res.data.data : { ...(user || {}), ...payload };
        userManager.setUser(newUser);
  try { sessionStorage.removeItem('onboarding_skipped'); } catch { /* no-op */ }
        setSuccess(t('onboarding.saved'));
        setTimeout(() => navigate('/dashboard', { replace: true }), 800);
      } else {
        setError(res.data?.message || t('common.error'));
      }
    } catch (e) {
      setError(e?.response?.data?.message || e?.message || t('common.error'));
      resetTurnstile();
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>{t('onboarding.title')}</CardTitle>
            <CardDescription>{t('onboarding.subtitle')}</CardDescription>
          </CardHeader>
          <CardContent>
            {error && (
              <Alert variant="destructive" className="mb-4">
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            {success && (
              <Alert variant="success" className="mb-4">
                <AlertDescription>{success}</AlertDescription>
              </Alert>
            )}

            <form onSubmit={onSubmit} className="space-y-5">
              <div>
                <label htmlFor="schoolSearch" className="mb-1 block text-sm font-medium text-foreground">{t('auth.school')}</label>
                <Input
                  id="schoolSearch"
                  placeholder={t('onboarding.schoolPlaceholder')}
                  value={schoolQuery}
                  onChange={(e) => {
                    setSchoolQuery(e.target.value);
                    setSelectedSchoolId('');
                  }}
                />
                <div className="mt-2 max-h-40 overflow-auto rounded border border-border bg-card">
                  {schools.map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      className={`w-full px-3 py-2 text-left text-foreground hover:bg-muted/60 ${String(selectedSchoolId)===String(s.id)?'bg-green-500/12 text-green-500':''}`}
                      onClick={() => {
                        setSelectedSchoolId(String(s.id));
                        setSchoolQuery(s.name);
                      }}
                    >
                      {s.name}
                    </button>
                  ))}
                  {schools.length === 0 && (
                    <div className="px-3 py-2 text-muted-foreground">{t('onboarding.noSchoolMatches')}</div>
                  )}
                </div>
              </div>

              <div>
                {/* class_name UI 已移除 */}
              </div>

              {requiresTurnstile && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{t('auth.turnstileNotice')}</p>
                  <div className="flex justify-center">
                    <Turnstile
                      ref={turnstileRef}
                      require={requiresTurnstile}
                      onVerify={(token) => setTurnstileToken(token)}
                      onExpire={() => setTurnstileToken('')}
                      onError={() => setTurnstileToken('')}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Button
                  type="submit"
                  className="flex-1"
                  loading={isSubmitting}
                  disabled={isSubmitting || (requiresTurnstile && !turnstileToken)}
                >
                  {t('onboarding.saveAndContinue')}
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    try { sessionStorage.setItem('onboarding_skipped', '1'); } catch { /* no-op */ }
                    navigate('/dashboard');
                  }}
                >
                  {t('onboarding.skipForNow')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
