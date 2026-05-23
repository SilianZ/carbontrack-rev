import Silian_React, { useMemo as Silian_useMemo, useState as Silian_useState } from 'react';
import { useForm as Silian_useForm } from 'react-hook-form';
import { Link as Silian_Link, useNavigate as Silian_useNavigate, useSearchParams as Silian_useSearchParams } from 'react-router-dom';
import { Eye as Silian_Eye, EyeOff as Silian_EyeOff, Lock as Silian_Lock } from 'lucide-react';
import { toast as Silian_toast } from 'react-hot-toast';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { authAPI as Silian_authAPI } from '../lib/auth';
import { Button as Silian_Button } from '../components/ui/Button';
import { Input as Silian_Input } from '../components/ui/Input';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardDescription as Silian_CardDescription, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../components/ui/Card';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription } from '../components/ui/Alert';

const Silian_TogglePasswordButton = ({ visible: Silian_visible, onClick: Silian_onClick }) => (
  <button
    type="button"
    className="absolute inset-y-0 right-0 pr-3 flex items-center"
    onClick={Silian_onClick}
  >
    {Silian_visible ? <Silian_EyeOff className="h-4 w-4 text-muted-foreground" /> : <Silian_Eye className="h-4 w-4 text-muted-foreground" />}
  </button>
);

export default function ResetPasswordPage() {
  const { t: Silian_t } = Silian_useTranslation(['activities', 'auth', 'errors']);
  const Silian_navigate = Silian_useNavigate();
  const [Silian_searchParams] = Silian_useSearchParams();
  const Silian_token = Silian_searchParams.get('token') || '';
  const Silian_fromEmail = Silian_searchParams.get('email') || '';

  const [Silian_showPassword, Silian_setShowPassword] = Silian_useState(false);
  const [Silian_showConfirmPassword, Silian_setShowConfirmPassword] = Silian_useState(false);
  const [Silian_status, Silian_setStatus] = Silian_useState(null);
  const [Silian_isSubmitting, Silian_setIsSubmitting] = Silian_useState(false);

  const Silian_defaultValues = Silian_useMemo(() => ({
    password: '',
    confirmPassword: ''
  }), []);

  const {
    register: Silian_register,
    handleSubmit: Silian_handleSubmit,
    watch: Silian_watch,
    formState: { errors: Silian_errors }
  } = Silian_useForm({
    defaultValues: Silian_defaultValues
  });

  const Silian_passwordValue = Silian_watch('password');

  const Silian_handleReset = async (Silian_values) => {
    if (!Silian_token) {
      Silian_setStatus({ variant: 'destructive', message: Silian_t('auth.resetPassword.tokenMissing') });
      return;
    }

    Silian_setIsSubmitting(true);
    Silian_setStatus(null);

    try {
      const Silian_response = await Silian_authAPI.resetPassword(Silian_token, Silian_values.password, Silian_values.confirmPassword);
      if (Silian_response.success) {
        Silian_toast.success(Silian_t('auth.resetPassword.success'));
        Silian_setStatus({ variant: 'success', message: Silian_t('auth.resetPassword.success') });
        setTimeout(() => Silian_navigate('/auth/login'), 2000);
      } else {
        const Silian_message = Silian_response.message || Silian_t('auth.resetPassword.failed');
        Silian_setStatus({ variant: 'destructive', message: Silian_message });
        Silian_toast.error(Silian_message);
      }
    } catch (Silian_error) {
      const Silian_message = Silian_error?.response?.data?.message || Silian_error.message || Silian_t('auth.resetPassword.failed');
      Silian_setStatus({ variant: 'destructive', message: Silian_message });
      Silian_toast.error(Silian_message);
    } finally {
      Silian_setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background text-foreground py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 flex items-center justify-center rounded-full bg-green-100">
            <Silian_Lock className="h-6 w-6 text-green-600" />
          </div>
          <h2 className="mt-6 text-3xl font-extrabold text-foreground">
            {Silian_t('auth.resetPassword.newTitle')}
          </h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {Silian_t('auth.resetPassword.newSubtitle', { email: Silian_fromEmail || Silian_t('auth.verification.yourEmail') })}
          </p>
        </div>

        <Silian_Card>
          <Silian_CardHeader>
            <Silian_CardTitle>{Silian_t('auth.resetPassword.newTitle')}</Silian_CardTitle>
            <Silian_CardDescription>
              {Silian_t('auth.resetPassword.instructions')}
            </Silian_CardDescription>
          </Silian_CardHeader>
          <Silian_CardContent>
            {!Silian_token && (
              <Silian_Alert variant="warning" className="mb-4">
                <Silian_AlertDescription>{Silian_t('auth.resetPassword.tokenMissing')}</Silian_AlertDescription>
              </Silian_Alert>
            )}

            {Silian_status?.message && (
              <Silian_Alert variant={Silian_status.variant || 'info'} className="mb-4">
                <Silian_AlertDescription>{Silian_status.message}</Silian_AlertDescription>
              </Silian_Alert>
            )}

            <form onSubmit={Silian_handleSubmit(Silian_handleReset)} className="space-y-6">
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-foreground">
                  {Silian_t('auth.resetPassword.newPasswordLabel')}
                </label>
                <div className="mt-1 relative">
                  <Silian_Input
                    id="password"
                    type={Silian_showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder={Silian_t('auth.passwordPlaceholder')}
                    disabled={Silian_isSubmitting}
                    error={Silian_errors.password}
                    {...Silian_register('password', {
                      required: Silian_t('auth.passwordRequired'),
                      minLength: { value: 8, message: Silian_t('auth.passwordMinLength') }
                    })}
                  />
                  <Silian_TogglePasswordButton visible={Silian_showPassword} onClick={() => Silian_setShowPassword((Silian_prev) => !Silian_prev)} />
                  {Silian_errors.password && (
                    <p className="mt-1 text-sm text-red-600">{Silian_errors.password.message}</p>
                  )}
                </div>
              </div>

              <div>
                <label htmlFor="confirmPassword" className="block text-sm font-medium text-foreground">
                  {Silian_t('auth.resetPassword.confirmPasswordLabel')}
                </label>
                <div className="mt-1 relative">
                  <Silian_Input
                    id="confirmPassword"
                    type={Silian_showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    placeholder={Silian_t('auth.confirmPasswordPlaceholder')}
                    disabled={Silian_isSubmitting}
                    error={Silian_errors.confirmPassword}
                    {...Silian_register('confirmPassword', {
                      required: Silian_t('auth.resetPassword.confirmPasswordRequired'),
                      validate: (Silian_value) => Silian_value === Silian_passwordValue || Silian_t('auth.resetPassword.passwordMismatch')
                    })}
                  />
                  <Silian_TogglePasswordButton visible={Silian_showConfirmPassword} onClick={() => Silian_setShowConfirmPassword((Silian_prev) => !Silian_prev)} />
                  {Silian_errors.confirmPassword && (
                    <p className="mt-1 text-sm text-red-600">{Silian_errors.confirmPassword.message}</p>
                  )}
                </div>
              </div>

              <Silian_Button type="submit" className="w-full" disabled={Silian_isSubmitting || !Silian_token}>
                {Silian_isSubmitting ? Silian_t('auth.resetPassword.submitting') : Silian_t('auth.resetPassword.submit')}
              </Silian_Button>
            </form>

            <div className="mt-6 text-center">
              <Silian_Link to="/auth/login" className="text-sm font-medium text-green-600 hover:text-green-500">
                {Silian_t('auth.backToLogin')}
              </Silian_Link>
            </div>
          </Silian_CardContent>
        </Silian_Card>
      </div>
    </div>
  );
}
