import Silian_React, { useCallback as Silian_useCallback, useEffect as Silian_useEffect, useMemo as Silian_useMemo, useRef as Silian_useRef, useState as Silian_useState } from 'react';
import { useForm as Silian_useForm } from 'react-hook-form';
import { useNavigate as Silian_useNavigate, useSearchParams as Silian_useSearchParams } from 'react-router-dom';
import { toast as Silian_toast } from 'react-hot-toast';
import { Loader2 as Silian_Loader2, MailCheck as Silian_MailCheck } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { authAPI as Silian_authAPI, tokenManager as Silian_tokenManager, userManager as Silian_userManager } from '../lib/auth';
import { Button as Silian_Button } from '../components/ui/Button';
import { Input as Silian_Input } from '../components/ui/Input';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../components/ui/Card';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription } from '../components/ui/Alert';
import Silian_Turnstile from '../components/common/Turnstile';

const Silian_toTimestamp = (Silian_value) => {
  if (!Silian_value) return null;
  const Silian_ts = Date.parse(Silian_value);
  return Number.isNaN(Silian_ts) ? null : Silian_ts;
};

const Silian_getSessionValue = (Silian_key) => {
  if (typeof window === 'undefined') return null;
  return sessionStorage.getItem(Silian_key);
};

const Silian_VerifyEmailPage = () => {
  const { t: Silian_t } = Silian_useTranslation(['activities', 'auth', 'errors']);
  const Silian_navigate = Silian_useNavigate();
  const [Silian_searchParams] = Silian_useSearchParams();
  const Silian_tokenParam = Silian_searchParams.get('token');
  const Silian_returnParam = Silian_searchParams.get('return');

  const Silian_initialEmail = Silian_useMemo(() => {
    return Silian_searchParams.get('email')
      || Silian_getSessionValue('pending_verification_email')
      || Silian_userManager.getUser()?.email
      || '';
  }, [Silian_searchParams]);

  const {
    register: Silian_register,
    handleSubmit: Silian_handleSubmit,
    setValue: Silian_setValue,
    getValues: Silian_getValues,
    watch: Silian_watch,
    formState: { errors: Silian_errors }
  } = Silian_useForm({
    defaultValues: {
      email: Silian_initialEmail,
      code: ''
    }
  });

  Silian_useEffect(() => {
    if (Silian_initialEmail) {
      Silian_setValue('email', Silian_initialEmail);
    }
  }, [Silian_initialEmail, Silian_setValue]);

  const [Silian_isSubmitting, Silian_setIsSubmitting] = Silian_useState(false);
  const [Silian_tokenHandled, Silian_setTokenHandled] = Silian_useState(false);
  const [Silian_tokenStatus, Silian_setTokenStatus] = Silian_useState(Silian_tokenParam ? 'pending' : 'idle');
  const [Silian_status, Silian_setStatus] = Silian_useState(null);
  const [Silian_resendAvailableAt, Silian_setResendAvailableAt] = Silian_useState(() => Silian_toTimestamp(Silian_getSessionValue('verification_resend_available_at')));
  const [Silian_resendCountdown, Silian_setResendCountdown] = Silian_useState(0);
  const Silian_turnstileRef = Silian_useRef(null);
  const [Silian_turnstileToken, Silian_setTurnstileToken] = Silian_useState('');
  const Silian_requiresTurnstile = Boolean(import.meta.env?.VITE_TURNSTILE_SITE_KEY);

  const Silian_emailValue = Silian_watch('email');

  const Silian_processVerifiedSession = Silian_useCallback((Silian_payload) => {
    const Silian_token = Silian_payload?.token;
    const Silian_user = Silian_payload?.user;

    if (Silian_token) {
      Silian_tokenManager.setToken(Silian_token);
    }
    if (Silian_user) {
      Silian_userManager.setUser(Silian_user);
    }

    if (typeof window !== 'undefined') {
      sessionStorage.removeItem('pending_verification_email');
      sessionStorage.removeItem('verification_resend_available_at');
      const Silian_storedReturn = sessionStorage.getItem('verification_return_path');
      sessionStorage.removeItem('verification_return_path');
      const Silian_target = Silian_returnParam || Silian_storedReturn || '/dashboard';
      Silian_navigate(Silian_target, { replace: true });
    } else {
      Silian_navigate(Silian_returnParam || '/dashboard', { replace: true });
    }
  }, [Silian_navigate, Silian_returnParam]);

  Silian_useEffect(() => {
    if (!Silian_resendAvailableAt) {
      Silian_setResendCountdown(0);
      return;
    }

    const Silian_updateCountdown = () => {
      const Silian_diff = Silian_resendAvailableAt - Date.now();
      if (Silian_diff <= 0) {
        Silian_setResendCountdown(0);
        Silian_setResendAvailableAt(null);
        if (typeof window !== 'undefined') {
          sessionStorage.removeItem('verification_resend_available_at');
        }
      } else {
        Silian_setResendCountdown(Silian_diff);
      }
    };

    Silian_updateCountdown();
    const Silian_timer = window.setInterval(Silian_updateCountdown, 1000);
    return () => window.clearInterval(Silian_timer);
  }, [Silian_resendAvailableAt]);

  Silian_useEffect(() => {
    if (Silian_tokenParam && !Silian_tokenHandled) {
      const Silian_verifyWithToken = async () => {
        Silian_setTokenStatus('pending');
        Silian_setIsSubmitting(true);
        Silian_setStatus(null);
        try {
          const Silian_response = await Silian_authAPI.verifyEmail({ token: Silian_tokenParam });
          if (Silian_response.success) {
            Silian_toast.success(Silian_t('auth.verification.tokenSuccess'));
            Silian_processVerifiedSession(Silian_response.data);
          } else {
            Silian_setTokenStatus('failed');
            const Silian_message = Silian_response.message || Silian_t('auth.verification.tokenFailed');
            Silian_setStatus({ variant: 'destructive', message: Silian_message });
            Silian_toast.error(Silian_message);
          }
        } catch (Silian_error) {
          Silian_setTokenStatus('failed');
          const Silian_message = Silian_error?.response?.data?.message || Silian_error.message || Silian_t('auth.verification.tokenFailed');
          Silian_setStatus({ variant: 'destructive', message: Silian_message });
          Silian_toast.error(Silian_message);
        } finally {
          Silian_setIsSubmitting(false);
          Silian_setTokenHandled(true);
        }
      };

      Silian_verifyWithToken();
    }
  }, [Silian_processVerifiedSession, Silian_t, Silian_tokenHandled, Silian_tokenParam]);

  const Silian_ensureTurnstile = () => {
    if (Silian_requiresTurnstile && !Silian_turnstileToken) {
      const Silian_message = Silian_t('auth.verification.turnstileRequired');
      Silian_setStatus({ variant: 'warning', message: Silian_message });
      Silian_toast.error(Silian_message);
      return false;
    }
    return true;
  };

  const Silian_resetTurnstile = () => {
    Silian_setTurnstileToken('');
    Silian_turnstileRef.current?.reset?.();
  };

  const Silian_handleManualVerify = async (Silian_values) => {
    const Silian_email = Silian_values.email.trim();
    const Silian_code = Silian_values.code.trim();

    if (!Silian_email) {
      Silian_setStatus({ variant: 'warning', message: Silian_t('auth.verification.emailRequired') });
      return;
    }
    if (!Silian_code) {
      Silian_setStatus({ variant: 'warning', message: Silian_t('auth.verification.codeRequired') });
      return;
    }

    if (!Silian_ensureTurnstile()) {
      return;
    }

    Silian_setIsSubmitting(true);
    Silian_setStatus(null);

    try {
      const Silian_response = await Silian_authAPI.verifyEmail({ email: Silian_email, code: Silian_code, cf_turnstile_response: Silian_turnstileToken });
      if (Silian_response.success) {
        Silian_toast.success(Silian_t('auth.verification.codeSuccess'));
        Silian_processVerifiedSession(Silian_response.data);
      } else {
        const Silian_message = Silian_response.message || Silian_t('auth.verification.codeFailed');
        Silian_setStatus({ variant: 'destructive', message: Silian_message });
        Silian_toast.error(Silian_message);
      }
    } catch (Silian_error) {
      const Silian_message = Silian_error?.response?.data?.message || Silian_error.message || Silian_t('auth.verification.codeFailed');
      Silian_setStatus({ variant: 'destructive', message: Silian_message });
      Silian_toast.error(Silian_message);
    } finally {
      Silian_resetTurnstile();
      Silian_setIsSubmitting(false);
    }
  };

  const Silian_handleResend = async () => {
    const Silian_email = Silian_getValues('email').trim();
    if (!Silian_email) {
      Silian_setStatus({ variant: 'warning', message: Silian_t('auth.verification.emailRequired') });
      return;
    }

    if (!Silian_ensureTurnstile()) {
      return;
    }

    Silian_setIsSubmitting(true);
    try {
      const Silian_response = await Silian_authAPI.sendVerificationCode({ email: Silian_email, cf_turnstile_response: Silian_turnstileToken });
      if (Silian_response.success) {
        const Silian_meta = Silian_response.data || {};
        const Silian_nextAt = Silian_toTimestamp(Silian_meta.verification_resend_available_at);
        if (typeof window !== 'undefined') {
          sessionStorage.setItem('pending_verification_email', Silian_email);
          if (Silian_meta.verification_resend_available_at) {
            sessionStorage.setItem('verification_resend_available_at', Silian_meta.verification_resend_available_at);
          } else {
            sessionStorage.removeItem('verification_resend_available_at');
          }
        }
        Silian_setResendAvailableAt(Silian_nextAt);
        const Silian_message = Silian_response.message || Silian_t('auth.verification.resendSuccess');
        Silian_setStatus({ variant: 'info', message: Silian_message });
        Silian_toast.success(Silian_message);
      } else {
        const Silian_message = Silian_response.message || Silian_t('auth.verification.tokenFailed');
        Silian_setStatus({ variant: 'destructive', message: Silian_message });
        Silian_toast.error(Silian_message);
      }
    } catch (Silian_error) {
        const Silian_message = Silian_error?.response?.data?.message || Silian_error.message || Silian_t('auth.verification.tokenFailed');
        Silian_setStatus({ variant: 'destructive', message: Silian_message });
        Silian_toast.error(Silian_message);
      } finally {
      Silian_resetTurnstile();
        Silian_setIsSubmitting(false);
      }
    };

  const Silian_resendDisabled = Silian_isSubmitting
    || (Silian_resendAvailableAt !== null && Silian_resendAvailableAt > Date.now())
    || (Silian_requiresTurnstile && !Silian_turnstileToken);
  const Silian_secondsRemaining = Math.max(0, Math.ceil(Silian_resendCountdown / 1000));

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-6">
        <Silian_Card>
          <Silian_CardHeader className="space-y-1">
            <div className="flex items-center gap-2">
              <Silian_MailCheck className="h-6 w-6 text-green-600" />
              <Silian_CardTitle>{Silian_t('auth.verification.title')}</Silian_CardTitle>
            </div>
            <Silian_CardDescription>
              {Silian_t('auth.verification.description', { email: Silian_emailValue || Silian_t('auth.verification.yourEmail') })}
            </Silian_CardDescription>
          </Silian_CardHeader>
          <Silian_CardContent className="space-y-4">
            {Silian_tokenStatus === 'pending' && (
              <Silian_Alert variant="info">
                <Silian_AlertDescription className="flex items-center gap-2">
                  <Silian_Loader2 className="h-4 w-4 animate-spin" />
                  {Silian_t('auth.verification.tokenVerifying')}
                </Silian_AlertDescription>
              </Silian_Alert>
            )}

            {Silian_status?.message && (
              <Silian_Alert variant={Silian_status.variant || 'info'}>
                <Silian_AlertDescription>{Silian_status.message}</Silian_AlertDescription>
              </Silian_Alert>
            )}

            <form onSubmit={Silian_handleSubmit(Silian_handleManualVerify)} className="space-y-4">
              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="email">
                  {Silian_t('auth.verification.emailLabel')}
                </label>
                <Silian_Input
                  id="email"
                  type="email"
                  autoComplete="email"
                  placeholder={Silian_t('auth.verification.emailPlaceholder')}
                  {...Silian_register('email', { required: Silian_t('auth.verification.emailRequired') })}
                />
                {Silian_errors.email && (
                  <p className="text-sm text-red-600">{Silian_errors.email.message}</p>
                )}
              </div>

              <div className="space-y-1">
                <label className="text-sm font-medium text-foreground" htmlFor="code">
                  {Silian_t('auth.verification.codeLabel')}
                </label>
                <Silian_Input
                  id="code"
                  inputMode="numeric"
                  maxLength={6}
                  placeholder="123456"
                  {...Silian_register('code', {
                    required: Silian_t('auth.verification.codeRequired'),
                    pattern: {
                      value: /^\d{6}$/,
                      message: Silian_t('auth.verification.codePattern')
                    }
                  })}
                />
                {Silian_errors.code && (
                  <p className="text-sm text-red-600">{Silian_errors.code.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Silian_Turnstile
                  ref={Silian_turnstileRef}
                  className="flex justify-center"
                  require={Silian_requiresTurnstile}
                  onVerify={(Silian_token) => Silian_setTurnstileToken(Silian_token)}
                  onExpire={() => Silian_setTurnstileToken('')}
                  onError={() => Silian_setTurnstileToken('')}
                />
              </div>

              <Silian_Button
                type="submit"
                className="w-full"
                disabled={Silian_isSubmitting || (Silian_requiresTurnstile && !Silian_turnstileToken)}
              >
                {Silian_isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <Silian_Loader2 className="h-4 w-4 animate-spin" />
                    {Silian_t('auth.verification.submitting')}
                  </span>
                ) : (
                  Silian_t('auth.verification.submit')
                )}
              </Silian_Button>
            </form>

            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <Silian_Button
                variant="outline"
                onClick={Silian_handleResend}
                disabled={Silian_resendDisabled}
              >
                {Silian_resendDisabled && Silian_secondsRemaining > 0
                  ? Silian_t('auth.verification.resendCountdown', { seconds: Silian_secondsRemaining })
                  : Silian_t('auth.verification.resend')}
              </Silian_Button>
              <Silian_Button
                variant="ghost"
                onClick={() => Silian_navigate('/auth/login')}
              >
                {Silian_t('auth.verification.backToLogin')}
              </Silian_Button>
            </div>

            <p className="text-sm text-muted-foreground">
              {Silian_t('auth.verification.helper')}
            </p>
          </Silian_CardContent>
        </Silian_Card>
      </div>
    </div>
  );
};

export default Silian_VerifyEmailPage;
