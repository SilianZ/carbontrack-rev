import Silian_React, { useCallback as Silian_useCallback, useEffect as Silian_useEffect, useRef as Silian_useRef, useState as Silian_useState } from 'react';
import { useNavigate as Silian_useNavigate } from 'react-router-dom';
import { schoolAPI as Silian_schoolAPI, profileAPI as Silian_profileAPI } from '../lib/api';
import { userManager as Silian_userManager } from '../lib/auth';
import { Input as Silian_Input } from '../components/ui/Input';
import { Button as Silian_Button } from '../components/ui/Button';
import { Card as Silian_Card, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription } from '../components/ui/Card';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription } from '../components/ui/Alert';
import Silian_Turnstile from '../components/common/Turnstile';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';

export default function OnboardingPage() {
  const Silian_navigate = Silian_useNavigate();
  const { t: Silian_t } = Silian_useTranslation(['auth', 'common', 'errors', 'onboarding', 'success']);
  const Silian_user = Silian_userManager.getUser();
  const Silian_currentSchoolId = Silian_user?.school_id;
  const [Silian_schools, Silian_setSchools] = Silian_useState([]);
  const [Silian_schoolQuery, Silian_setSchoolQuery] = Silian_useState('');
  const [Silian_selectedSchoolId, Silian_setSelectedSchoolId] = Silian_useState('');
  const [Silian_isSubmitting, Silian_setIsSubmitting] = Silian_useState(false);
  const [Silian_error, Silian_setError] = Silian_useState('');
  const [Silian_success, Silian_setSuccess] = Silian_useState('');
  const Silian_turnstileRef = Silian_useRef(null);
  const [Silian_turnstileToken, Silian_setTurnstileToken] = Silian_useState('');
  const Silian_requiresTurnstile = Boolean(import.meta.env?.VITE_TURNSTILE_SITE_KEY || import.meta.env?.MODE !== 'production');

  const Silian_loadSchools = Silian_useCallback(async (Silian_search) => {
    try {
      const Silian_res = await Silian_schoolAPI.getSchools({ search: Silian_search, limit: 20, page: 1 });
      const Silian_list = Silian_res.data?.data?.schools || [];
      Silian_setSchools(Silian_list);
    } catch (Silian_e) {
      console.error('Load schools failed:', Silian_e);
    }
  }, []);

  Silian_useEffect(() => {
    if (Silian_currentSchoolId) {
      Silian_navigate('/dashboard', { replace: true });
    }
  }, [Silian_currentSchoolId, Silian_navigate]);

  Silian_useEffect(() => {
    if (Silian_currentSchoolId) {
      return undefined;
    }

    const Silian_trimmedQuery = Silian_schoolQuery.trim();
    const Silian_timer = setTimeout(() => {
      Silian_loadSchools(Silian_trimmedQuery);
    }, Silian_trimmedQuery ? 300 : 0);

    return () => clearTimeout(Silian_timer);
  }, [Silian_currentSchoolId, Silian_loadSchools, Silian_schoolQuery]);

  const Silian_ensureTurnstile = () => {
    if (Silian_requiresTurnstile && !Silian_turnstileToken) {
      Silian_setError(Silian_t('auth.verification.turnstileRequired'));
      return false;
    }

    return true;
  };

  const Silian_resetTurnstile = () => {
    Silian_setTurnstileToken('');
    Silian_turnstileRef.current?.reset?.();
  };

  const Silian_onSubmit = async (Silian_e) => {
    Silian_e.preventDefault();
    Silian_setIsSubmitting(true);
    Silian_setError('');
    Silian_setSuccess('');

    try {
      const Silian_payload = {};
      if (Silian_selectedSchoolId) {
        Silian_payload.school_id = parseInt(Silian_selectedSchoolId, 10);
      } else if (Silian_schoolQuery.trim()) {
        Silian_payload.new_school_name = Silian_schoolQuery.trim();
      }

      if (Object.keys(Silian_payload).length === 0) {
        Silian_setError(Silian_t('onboarding.leastOneField'));
        Silian_setIsSubmitting(false);
        return;
      }

      if (!Silian_ensureTurnstile()) {
        Silian_setIsSubmitting(false);
        return;
      }

      Silian_payload.cf_turnstile_response = Silian_turnstileToken;

      const Silian_res = await Silian_profileAPI.updateProfile(Silian_payload);
      if (Silian_res.data?.success) {
        // 更新本地用户缓存（优先使用后端返回的完整用户数据）
        const Silian_newUser = Silian_res.data?.data ? Silian_res.data.data : { ...(Silian_user || {}), ...Silian_payload };
        Silian_userManager.setUser(Silian_newUser);
  try { sessionStorage.removeItem('onboarding_skipped'); } catch { /* no-op */ }
        Silian_setSuccess(Silian_t('onboarding.saved'));
        setTimeout(() => Silian_navigate('/dashboard', { replace: true }), 800);
      } else {
        Silian_setError(Silian_res.data?.message || Silian_t('common.error'));
      }
    } catch (Silian_e) {
      Silian_setError(Silian_e?.response?.data?.message || Silian_e?.message || Silian_t('common.error'));
      Silian_resetTurnstile();
    } finally {
      Silian_setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12 text-foreground sm:px-6 lg:px-8">
      <div className="max-w-lg w-full space-y-6">
        <Silian_Card>
          <Silian_CardHeader>
            <Silian_CardTitle>{Silian_t('onboarding.title')}</Silian_CardTitle>
            <Silian_CardDescription>{Silian_t('onboarding.subtitle')}</Silian_CardDescription>
          </Silian_CardHeader>
          <Silian_CardContent>
            {Silian_error && (
              <Silian_Alert variant="destructive" className="mb-4">
                <Silian_AlertDescription>{Silian_error}</Silian_AlertDescription>
              </Silian_Alert>
            )}
            {Silian_success && (
              <Silian_Alert variant="success" className="mb-4">
                <Silian_AlertDescription>{Silian_success}</Silian_AlertDescription>
              </Silian_Alert>
            )}

            <form onSubmit={Silian_onSubmit} className="space-y-5">
              <div>
                <label htmlFor="schoolSearch" className="mb-1 block text-sm font-medium text-foreground">{Silian_t('auth.school')}</label>
                <Silian_Input
                  id="schoolSearch"
                  placeholder={Silian_t('onboarding.schoolPlaceholder')}
                  value={Silian_schoolQuery}
                  onChange={(Silian_e) => {
                    Silian_setSchoolQuery(Silian_e.target.value);
                    Silian_setSelectedSchoolId('');
                  }}
                />
                <div className="mt-2 max-h-40 overflow-auto rounded border border-border bg-card">
                  {Silian_schools.map((Silian_s) => (
                    <button
                      key={Silian_s.id}
                      type="button"
                      className={`w-full px-3 py-2 text-left text-foreground hover:bg-muted/60 ${String(Silian_selectedSchoolId)===String(Silian_s.id)?'bg-green-500/12 text-green-500':''}`}
                      onClick={() => {
                        Silian_setSelectedSchoolId(String(Silian_s.id));
                        Silian_setSchoolQuery(Silian_s.name);
                      }}
                    >
                      {Silian_s.name}
                    </button>
                  ))}
                  {Silian_schools.length === 0 && (
                    <div className="px-3 py-2 text-muted-foreground">{Silian_t('onboarding.noSchoolMatches')}</div>
                  )}
                </div>
              </div>

              <div>
                {/* class_name UI 已移除 */}
              </div>

              {Silian_requiresTurnstile && (
                <div className="space-y-3">
                  <p className="text-sm text-muted-foreground">{Silian_t('auth.turnstileNotice')}</p>
                  <div className="flex justify-center">
                    <Silian_Turnstile
                      ref={Silian_turnstileRef}
                      require={Silian_requiresTurnstile}
                      onVerify={(Silian_token) => Silian_setTurnstileToken(Silian_token)}
                      onExpire={() => Silian_setTurnstileToken('')}
                      onError={() => Silian_setTurnstileToken('')}
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-3">
                <Silian_Button
                  type="submit"
                  className="flex-1"
                  loading={Silian_isSubmitting}
                  disabled={Silian_isSubmitting || (Silian_requiresTurnstile && !Silian_turnstileToken)}
                >
                  {Silian_t('onboarding.saveAndContinue')}
                </Silian_Button>
                <Silian_Button
                  type="button"
                  variant="ghost"
                  className="flex-1"
                  onClick={() => {
                    try { sessionStorage.setItem('onboarding_skipped', '1'); } catch { /* no-op */ }
                    Silian_navigate('/dashboard');
                  }}
                >
                  {Silian_t('onboarding.skipForNow')}
                </Silian_Button>
              </div>
            </form>
          </Silian_CardContent>
        </Silian_Card>
      </div>
    </div>
  );
}
