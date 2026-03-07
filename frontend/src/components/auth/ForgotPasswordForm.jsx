import React, { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft } from 'lucide-react';
import { useTranslation } from '../../hooks/useTranslation';
import { authAPI, getValidationRules } from '../../lib/auth';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '../ui/Card';
import { Alert, AlertDescription } from '../ui/Alert';
import Turnstile from '../common/Turnstile';

export function ForgotPasswordForm() {
  const { t } = useTranslation();
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const turnstileRef = useRef(null);
  const [turnstileToken, setTurnstileToken] = useState('');
  const requiresTurnstile = Boolean(import.meta.env?.VITE_TURNSTILE_SITE_KEY);

  const {
    register,
    handleSubmit,
    formState: { errors }
  } = useForm();
  const validationRules = getValidationRules();

  const onSubmit = async (data) => {
    if (requiresTurnstile && !turnstileToken) {
      setError(t('auth.verification.turnstileRequired'));
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await authAPI.forgotPassword({
        email: data.email,
        cf_turnstile_response: turnstileToken,
      });

      if (result.success) {
        setSuccess(t('auth.resetEmailSent'));
      } else {
        setError(result.message || t('auth.resetEmailFailed'));
      }
    } catch (err) {
      setError(err.message || t('auth.resetEmailFailed'));
    } finally {
      setTurnstileToken('');
      turnstileRef.current?.reset?.();
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
            <Mail className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-gray-900">
            {t('auth.forgotPassword')}
          </h2>
          <p className="mt-2 text-sm text-gray-600">
            {t('auth.forgotPasswordDescription')}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t('auth.resetPassword.title')}</CardTitle>
            <CardDescription>
              {t('auth.enterEmailForReset')}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              {error && (
                <Alert variant="destructive">
                  <AlertDescription>{error}</AlertDescription>
                </Alert>
              )}

              {success && (
                <Alert variant="success">
                  <AlertDescription>{success}</AlertDescription>
                </Alert>
              )}

              <div>
                <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                  {t('auth.email')}
                </label>
                <div className="mt-1">
                  <Input
                    id="email"
                    type="email"
                    autoComplete="email"
                    placeholder={t('auth.emailPlaceholder')}
                    error={errors.email}
                    {...register('email', validationRules.email)}
                  />
                  {errors.email && (
                    <p className="mt-1 text-sm text-red-600">
                      {errors.email.message}
                    </p>
                  )}
                </div>
              </div>

              <div>
                <Turnstile
                  ref={turnstileRef}
                  className="flex justify-center"
                  require={requiresTurnstile}
                  onVerify={(token) => setTurnstileToken(token)}
                  onExpire={() => setTurnstileToken('')}
                  onError={() => setTurnstileToken('')}
                />
              </div>

              <div>
                <Button
                  type="submit"
                  className="w-full"
                  loading={isLoading}
                  disabled={isLoading || success || (requiresTurnstile && !turnstileToken)}
                >
                  {isLoading ? t('auth.sending') : t('auth.sendResetEmail')}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="text-center">
          <Link
            to="/auth/login"
            className="inline-flex items-center text-sm font-medium text-green-600 hover:text-green-500"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            {t('auth.backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
}

