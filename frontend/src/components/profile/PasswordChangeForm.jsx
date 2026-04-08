import React from 'react';
import { useForm } from 'react-hook-form';
import { useTranslation } from '../../hooks/useTranslation';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { toast } from 'react-hot-toast';
import api from '../../lib/api';

export function PasswordChangeForm() {
  const { t } = useTranslation(['errors', 'profile', 'validation']);
  const { register, handleSubmit, formState: { errors }, reset, watch } = useForm();

  const onSubmit = async (data) => {
    try {
      await api.post('/auth/change-password', data);
      toast.success(t('profile.passwordChangeSuccess'));
      reset();
    } catch (error) {
      toast.error(t('profile.passwordChangeFailed'));
      console.error('Password change failed:', error);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t('profile.changePassword')}</h3>
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground">{t('profile.currentPassword')}</label>
          <Input
            type="password"
            {...register('current_password', { required: t('validation.required') })}
          />
          {errors.current_password && <p className="text-red-500 text-xs mt-1">{errors.current_password.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">{t('profile.newPassword')}</label>
          <Input
            type="password"
            {...register('new_password', {
              required: t('validation.required'),
              minLength: { value: 8, message: t('validation.minLength', { min: 8 }) },
            })}
          />
          {errors.new_password && <p className="text-red-500 text-xs mt-1">{errors.new_password.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">{t('profile.confirmNewPassword')}</label>
          <Input
            type="password"
            {...register('confirm_new_password', {
              required: t('validation.required'),
              validate: (value) =>
                value === watch('new_password') || t('validation.passwordMismatch'),
            })}
          />
          {errors.confirm_new_password && <p className="text-red-500 text-xs mt-1">{errors.confirm_new_password.message}</p>}
        </div>
        <Button type="submit">{t('profile.changePassword')}</Button>
      </form>
    </div>
  );
}

