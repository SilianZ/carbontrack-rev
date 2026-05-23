import Silian_React, { useMemo as Silian_useMemo, useState as Silian_useState } from 'react';
import { useQuery as Silian_useQuery, useMutation as Silian_useMutation, useQueryClient as Silian_useQueryClient } from 'react-query';
import { Loader2 as Silian_Loader2 } from 'lucide-react';
import { toast as Silian_toast } from 'react-hot-toast';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { userAPI as Silian_userAPI } from '../lib/api';
import { Card as Silian_Card, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle, CardDescription as Silian_CardDescription, CardContent as Silian_CardContent } from '../components/ui/Card';
import { Switch as Silian_Switch } from '../components/ui/switch';
import { Button as Silian_Button } from '../components/ui/Button';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription } from '../components/ui/Alert';

const Silian_NotificationSettingsPage = () => {
  const { t: Silian_t } = Silian_useTranslation(['activities', 'common', 'settings']);
  const Silian_queryClient = Silian_useQueryClient();
  const [Silian_localPrefs, Silian_setLocalPrefs] = Silian_useState([]);
  const [Silian_status, Silian_setStatus] = Silian_useState(null);
  const [Silian_testStatus, Silian_setTestStatus] = Silian_useState(null);
  const [Silian_sendingCategory, Silian_setSendingCategory] = Silian_useState(null);

  const Silian_preferencesQuery = Silian_useQuery(
    ['notification-preferences'],
    async () => {
      const Silian_res = await Silian_userAPI.getNotificationPreferences();
      return Silian_res.data?.data?.preferences ?? [];
    },
    {
      onSuccess: (Silian_data) => {
        Silian_setLocalPrefs(Silian_data);
      },
    }
  );

  const Silian_mutation = Silian_useMutation(
    async (Silian_prefs) => {
      const Silian_res = await Silian_userAPI.updateNotificationPreferences({ preferences: Silian_prefs });
      return Silian_res.data?.data?.preferences ?? [];
    },
    {
      onSuccess: (Silian_data) => {
        Silian_toast.success(Silian_t('settings.notifications.saveSuccess'));
        Silian_setStatus({ variant: 'success', message: Silian_t('settings.notifications.saveSuccess') });
        Silian_setLocalPrefs(Silian_data);
        Silian_queryClient.setQueryData(['notification-preferences'], Silian_data);
      },
      onError: (Silian_err) => {
        const Silian_message = Silian_err?.response?.data?.message || Silian_err?.message || Silian_t('settings.notifications.saveFailed');
        Silian_toast.error(Silian_message);
        Silian_setStatus({ variant: 'destructive', message: Silian_message });
      },
    }
  );

  const Silian_testEmailMutation = Silian_useMutation(
    async (Silian_category) => {
      Silian_setSendingCategory(Silian_category);
      const Silian_res = await Silian_userAPI.sendNotificationTestEmail(Silian_category);
      return { category: Silian_category, payload: Silian_res.data };
    },
    {
      onSuccess: ({ category: Silian_category, payload: Silian_payload }) => {
        const Silian_message = Silian_payload?.message || Silian_t('settings.notifications.testEmail.success');
        Silian_toast.success(Silian_message);
        Silian_setTestStatus({ category: Silian_category, variant: 'success', message: Silian_message });
      },
      onError: (Silian_err, Silian_category) => {
        const Silian_message = Silian_err?.response?.data?.message || Silian_err?.message || Silian_t('settings.notifications.testEmail.error');
        Silian_toast.error(Silian_message);
        Silian_setTestStatus({ category: Silian_category, variant: 'destructive', message: Silian_message });
      },
      onSettled: () => {
        Silian_setSendingCategory(null);
      },
    }
  );

  const Silian_loading = Silian_preferencesQuery.isLoading;
  const Silian_saving = Silian_mutation.isLoading;

  const Silian_hasChanges = Silian_useMemo(() => {
    if (!Silian_preferencesQuery.data) return false;
    return JSON.stringify(Silian_localPrefs) !== JSON.stringify(Silian_preferencesQuery.data);
  }, [Silian_localPrefs, Silian_preferencesQuery.data]);

  const Silian_handleToggle = (Silian_category, Silian_locked) => (Silian_checked) => {
    if (Silian_locked) {
      return;
    }
    Silian_setLocalPrefs((Silian_prev) =>
      Silian_prev.map((Silian_item) =>
        Silian_item.category === Silian_category ? { ...Silian_item, email_enabled: Boolean(Silian_checked) } : Silian_item
      )
    );
    Silian_setStatus(null);
    Silian_setTestStatus(null);
  };

  const Silian_handleReset = () => {
    if (Silian_preferencesQuery.data) {
      Silian_setLocalPrefs(Silian_preferencesQuery.data);
    }
    Silian_setStatus(null);
    Silian_setTestStatus(null);
  };

  const Silian_handleSave = () => {
    Silian_setTestStatus(null);
    Silian_mutation.mutate(Silian_localPrefs.map(({ category: Silian_category, email_enabled: Silian_email_enabled }) => ({ category: Silian_category, email_enabled: Silian_email_enabled })));
  };

  const Silian_handleSendTestEmail = (Silian_category) => {
    Silian_setTestStatus(null);
    Silian_testEmailMutation.mutate(Silian_category);
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-0 right-1/3 -z-10 h-[500px] w-[500px] blur-[120px] bg-gradient-to-tr from-sky-50/50 via-slate-50/30 to-transparent opacity-50 dark:from-sky-900/20 dark:via-slate-900/10 dark:opacity-30 pointer-events-none" />

      <div className="max-w-3xl mx-auto px-4 py-10 relative">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60">
            {Silian_t('settings.notifications.title')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {Silian_t('settings.notifications.subtitle')}
          </p>
        </div>

      <Silian_Card>
        <Silian_CardHeader>
          <Silian_CardTitle>{Silian_t('settings.notifications.emailHeading')}</Silian_CardTitle>
          <Silian_CardDescription>{Silian_t('settings.notifications.emailDescription')}</Silian_CardDescription>
        </Silian_CardHeader>
        <Silian_CardContent className="space-y-5">
          {Silian_loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Silian_Loader2 className="h-4 w-4 animate-spin" />
              {Silian_t('common.loading')}
            </div>
          ) : (
            <>
              {Silian_status?.message && (
                <Silian_Alert variant={Silian_status.variant || 'info'}>
                  <Silian_AlertDescription>{Silian_status.message}</Silian_AlertDescription>
                </Silian_Alert>
              )}

              <div className="space-y-4">
                {Silian_localPrefs.map((Silian_pref) => {
                  const Silian_isSending = Silian_sendingCategory === Silian_pref.category;
                  const Silian_prefTestStatus = Silian_testStatus && Silian_testStatus.category === Silian_pref.category ? Silian_testStatus : null;

                  return (
                    <div
                      key={Silian_pref.category}
                      className="rounded-lg border border-border bg-muted/40 px-4 py-3"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {Silian_t(`settings.notifications.categories.${Silian_pref.category}.label`)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {Silian_t(`settings.notifications.categories.${Silian_pref.category}.description`)}
                          </p>
                          {Silian_pref.locked && (
                            <p className="text-xs text-amber-600 mt-2">
                              {Silian_t('settings.notifications.locked')}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                          <Silian_Switch
                            checked={Silian_pref.email_enabled}
                            onCheckedChange={Silian_handleToggle(Silian_pref.category, Silian_pref.locked)}
                            disabled={Silian_pref.locked || Silian_saving}
                          />
                          <Silian_Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => Silian_handleSendTestEmail(Silian_pref.category)}
                            disabled={Silian_saving || Silian_isSending}
                          >
                            {Silian_isSending ? (
                              <span className="flex items-center gap-2">
                                <Silian_Loader2 className="h-4 w-4 animate-spin" />
                                {Silian_t('settings.notifications.testEmail.sending')}
                              </span>
                            ) : (
                              Silian_t('settings.notifications.testEmail.button')
                            )}
                          </Silian_Button>
                        </div>
                      </div>
                      {Silian_prefTestStatus && (
                        <Silian_Alert variant={Silian_prefTestStatus.variant || 'info'} className="mt-3">
                          <Silian_AlertDescription>{Silian_prefTestStatus.message}</Silian_AlertDescription>
                        </Silian_Alert>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
                <Silian_Button
                  type="button"
                  variant="outline"
                  onClick={Silian_handleReset}
                  disabled={!Silian_hasChanges || Silian_saving}
                >
                  {Silian_t('settings.notifications.reset')}
                </Silian_Button>
                <Silian_Button
                  type="button"
                  onClick={Silian_handleSave}
                  disabled={!Silian_hasChanges || Silian_saving}
                >
                  {Silian_saving ? (
                    <span className="flex items-center gap-2">
                      <Silian_Loader2 className="h-4 w-4 animate-spin" />
                      {Silian_t('settings.notifications.saving')}
                    </span>
                  ) : (
                    Silian_t('settings.notifications.save')
                  )}
                </Silian_Button>
              </div>

            </>
          )}
        </Silian_CardContent>
      </Silian_Card>
    </div>
    </div>
  );
};

export default Silian_NotificationSettingsPage;
