import Silian_React from 'react';
import { useForm as Silian_useForm } from 'react-hook-form';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { Button as Silian_Button } from '../ui/Button';
import { Input as Silian_Input } from '../ui/Input';
import { toast as Silian_toast } from 'react-hot-toast';
import Silian_api from '../../lib/api';

export function PasswordChangeForm() {
  const { t: Silian_t } = Silian_useTranslation(['errors', 'profile', 'validation']);
  const { register: Silian_register, handleSubmit: Silian_handleSubmit, formState: { errors: Silian_errors }, reset: Silian_reset, watch: Silian_watch } = Silian_useForm();

  const Silian_onSubmit = async (Silian_data) => {
    try {
      await Silian_api.post('/auth/change-password', Silian_data);
      Silian_toast.success(Silian_t('profile.passwordChangeSuccess'));
      Silian_reset();
    } catch (Silian_error) {
      Silian_toast.error(Silian_t('profile.passwordChangeFailed'));
      console.error('Password change failed:', Silian_error);
    }
  };

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{Silian_t('profile.changePassword')}</h3>
      <form onSubmit={Silian_handleSubmit(Silian_onSubmit)} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-foreground">{Silian_t('profile.currentPassword')}</label>
          <Silian_Input
            type="password"
            {...Silian_register('current_password', { required: Silian_t('validation.required') })}
          />
          {Silian_errors.current_password && <p className="text-red-500 text-xs mt-1">{Silian_errors.current_password.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">{Silian_t('profile.newPassword')}</label>
          <Silian_Input
            type="password"
            {...Silian_register('new_password', {
              required: Silian_t('validation.required'),
              minLength: { value: 8, message: Silian_t('validation.minLength', { min: 8 }) },
            })}
          />
          {Silian_errors.new_password && <p className="text-red-500 text-xs mt-1">{Silian_errors.new_password.message}</p>}
        </div>
        <div>
          <label className="block text-sm font-medium text-foreground">{Silian_t('profile.confirmNewPassword')}</label>
          <Silian_Input
            type="password"
            {...Silian_register('confirm_new_password', {
              required: Silian_t('validation.required'),
              validate: (Silian_value) =>
                Silian_value === Silian_watch('new_password') || Silian_t('validation.passwordMismatch'),
            })}
          />
          {Silian_errors.confirm_new_password && <p className="text-red-500 text-xs mt-1">{Silian_errors.confirm_new_password.message}</p>}
        </div>
        <Silian_Button type="submit">{Silian_t('profile.changePassword')}</Silian_Button>
      </form>
    </div>
  );
}

