import Silian_React, { useRef as Silian_useRef, useState as Silian_useState } from 'react';
import { useForm as Silian_useForm } from 'react-hook-form';
import { Link as Silian_Link } from 'react-router-dom';
import { Mail as Silian_Mail, ArrowLeft as Silian_ArrowLeft } from 'lucide-react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { authAPI as Silian_authAPI, getValidationRules as Silian_getValidationRules } from '../../lib/auth';
import { Button as Silian_Button } from '../ui/Button';
import { Input as Silian_Input } from '../ui/Input';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../ui/Card';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription } from '../ui/Alert';
import Silian_Turnstile from '../common/Turnstile';

export function ForgotPasswordForm() {
  const { t: Silian_t } = Silian_useTranslation(['auth', 'errors', 'success']);
  const [Silian_error, Silian_setError] = Silian_useState('');
  const [Silian_success, Silian_setSuccess] = Silian_useState('');
  const [Silian_isLoading, Silian_setIsLoading] = Silian_useState(false);
  const Silian_turnstileRef = Silian_useRef(null);
  const [Silian_turnstileToken, Silian_setTurnstileToken] = Silian_useState('');
  const Silian_requiresTurnstile = Boolean(import.meta.env?.VITE_TURNSTILE_SITE_KEY);

  const {
    register: Silian_register,
    handleSubmit: Silian_handleSubmit,
    formState: { errors: Silian_errors }
  } = Silian_useForm();
  const Silian_validationRules = Silian_getValidationRules();

  const Silian_onSubmit = async (Silian_data) => {
    if (Silian_requiresTurnstile && !Silian_turnstileToken) {
      Silian_setError(Silian_t('auth.verification.turnstileRequired'));
      return;
    }

    Silian_setIsLoading(true);
    Silian_setError('');
    Silian_setSuccess('');

    try {
      const Silian_result = await Silian_authAPI.forgotPassword({
        email: Silian_data.email,
        cf_turnstile_response: Silian_turnstileToken,
      });

      if (Silian_result.success) {
        Silian_setSuccess(Silian_t('auth.resetEmailSent'));
      } else {
        Silian_setError(Silian_result.message || Silian_t('auth.resetEmailFailed'));
      }
    } catch (Silian_err) {
      Silian_setError(Silian_err.message || Silian_t('auth.resetEmailFailed'));
    } finally {
      Silian_setTurnstileToken('');
      Silian_turnstileRef.current?.reset?.();
      Silian_setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
            <Silian_Mail className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-foreground">
            {Silian_t('auth.forgotPassword')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {Silian_t('auth.forgotPasswordDescription')}
          </p>
        </div>

        <Silian_Card>
          <Silian_CardHeader>
            <Silian_CardTitle>{Silian_t('auth.resetPassword.title')}</Silian_CardTitle>
            <Silian_CardDescription>
              {Silian_t('auth.enterEmailForReset')}
            </Silian_CardDescription>
          </Silian_CardHeader>
          <Silian_CardContent>
            <form onSubmit={Silian_handleSubmit(Silian_onSubmit)} className="space-y-6">
              {Silian_error && (
                <Silian_Alert variant="destructive">
                  <Silian_AlertDescription>{Silian_error}</Silian_AlertDescription>
                </Silian_Alert>
              )}

              {Silian_success && (
                <Silian_Alert variant="success">
                  <Silian_AlertDescription>{Silian_success}</Silian_AlertDescription>
                </Silian_Alert>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-foreground">
                  {Silian_t('auth.email')}
                </label>
                <div className="mt-1">
                  <Silian_Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder={Silian_t('auth.emailPlaceholder')}
                    error={Silian_errors.email}
                    {...Silian_register('email', Silian_validationRules.email)}
                  />
                  {Silian_errors.email && (
                    <p className="mt-1 text-sm text-red-600">
                      {Silian_errors.email.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Silian_Turnstile
                  ref={Silian_turnstileRef}
                  className="flex justify-center"
                  require={Silian_requiresTurnstile}
                  onVerify={(Silian_token) => Silian_setTurnstileToken(Silian_token)}
                  onExpire={() => Silian_setTurnstileToken('')}
                  onError={() => Silian_setTurnstileToken('')}
                />
              </div>

              <div>
                <Silian_Button
                  type="submit"
                  className="w-full"
                  loading={Silian_isLoading}
                  disabled={Silian_isLoading || Silian_success || (Silian_requiresTurnstile && !Silian_turnstileToken)}
                >
                  {Silian_isLoading ? Silian_t('auth.sending') : Silian_t('auth.sendResetEmail')}
                </Silian_Button>
              </div>
            </form>
          </Silian_CardContent>
        </Silian_Card>

        <div className="text-center">
          <Silian_Link
            to="/auth/login"
            className="inline-flex items-center text-sm font-medium text-green-600 hover:text-green-500"
          >
            <Silian_ArrowLeft className="h-4 w-4 mr-1" />
            {Silian_t('auth.backToLogin')}
          </Silian_Link>
        </div>
      </div>
    </div>
  );
}
