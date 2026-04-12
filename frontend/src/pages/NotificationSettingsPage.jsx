import React, { useMemo, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { Loader2 } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { useTranslation } from '../hooks/useTranslation';
import { userAPI } from '../lib/api';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Switch } from '../components/ui/switch';
import { Button } from '../components/ui/Button';
import { Alert, AlertDescription } from '../components/ui/Alert';

const NotificationSettingsPage = () => {
  const { t } = useTranslation(['activities', 'common', 'settings']);
  const queryClient = useQueryClient();
  const [localPrefs, setLocalPrefs] = useState([]);
  const [status, setStatus] = useState(null);
  const [testStatus, setTestStatus] = useState(null);
  const [sendingCategory, setSendingCategory] = useState(null);

  const preferencesQuery = useQuery(
    ['notification-preferences'],
    async () => {
      const res = await userAPI.getNotificationPreferences();
      return res.data?.data?.preferences ?? [];
    },
    {
      onSuccess: (data) => {
        setLocalPrefs(data);
      },
    }
  );

  const mutation = useMutation(
    async (prefs) => {
      const res = await userAPI.updateNotificationPreferences({ preferences: prefs });
      return res.data?.data?.preferences ?? [];
    },
    {
      onSuccess: (data) => {
        toast.success(t('settings.notifications.saveSuccess'));
        setStatus({ variant: 'success', message: t('settings.notifications.saveSuccess') });
        setLocalPrefs(data);
        queryClient.setQueryData(['notification-preferences'], data);
      },
      onError: (err) => {
        const message = err?.response?.data?.message || err?.message || t('settings.notifications.saveFailed');
        toast.error(message);
        setStatus({ variant: 'destructive', message });
      },
    }
  );

  const testEmailMutation = useMutation(
    async (category) => {
      setSendingCategory(category);
      const res = await userAPI.sendNotificationTestEmail(category);
      return { category, payload: res.data };
    },
    {
      onSuccess: ({ category, payload }) => {
        const message = payload?.message || t('settings.notifications.testEmail.success');
        toast.success(message);
        setTestStatus({ category, variant: 'success', message });
      },
      onError: (err, category) => {
        const message = err?.response?.data?.message || err?.message || t('settings.notifications.testEmail.error');
        toast.error(message);
        setTestStatus({ category, variant: 'destructive', message });
      },
      onSettled: () => {
        setSendingCategory(null);
      },
    }
  );

  const loading = preferencesQuery.isLoading;
  const saving = mutation.isLoading;

  const hasChanges = useMemo(() => {
    if (!preferencesQuery.data) return false;
    return JSON.stringify(localPrefs) !== JSON.stringify(preferencesQuery.data);
  }, [localPrefs, preferencesQuery.data]);

  const handleToggle = (category, locked) => (checked) => {
    if (locked) {
      return;
    }
    setLocalPrefs((prev) =>
      prev.map((item) =>
        item.category === category ? { ...item, email_enabled: Boolean(checked) } : item
      )
    );
    setStatus(null);
    setTestStatus(null);
  };

  const handleReset = () => {
    if (preferencesQuery.data) {
      setLocalPrefs(preferencesQuery.data);
    }
    setStatus(null);
    setTestStatus(null);
  };

  const handleSave = () => {
    setTestStatus(null);
    mutation.mutate(localPrefs.map(({ category, email_enabled }) => ({ category, email_enabled })));
  };

  const handleSendTestEmail = (category) => {
    setTestStatus(null);
    testEmailMutation.mutate(category);
  };

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-0 right-1/3 -z-10 h-[500px] w-[500px] blur-[120px] bg-gradient-to-tr from-sky-50/50 via-slate-50/30 to-transparent opacity-50 dark:from-sky-900/20 dark:via-slate-900/10 dark:opacity-30 pointer-events-none" />
      
      <div className="max-w-3xl mx-auto px-4 py-10 relative">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60">
            {t('settings.notifications.title')}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground">
            {t('settings.notifications.subtitle')}
          </p>
        </div>

      <Card>
        <CardHeader>
          <CardTitle>{t('settings.notifications.emailHeading')}</CardTitle>
          <CardDescription>{t('settings.notifications.emailDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              {t('common.loading')}
            </div>
          ) : (
            <>
              {status?.message && (
                <Alert variant={status.variant || 'info'}>
                  <AlertDescription>{status.message}</AlertDescription>
                </Alert>
              )}

              <div className="space-y-4">
                {localPrefs.map((pref) => {
                  const isSending = sendingCategory === pref.category;
                  const prefTestStatus = testStatus && testStatus.category === pref.category ? testStatus : null;

                  return (
                    <div
                      key={pref.category}
                      className="rounded-lg border border-border bg-muted/40 px-4 py-3"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div>
                          <p className="text-sm font-medium text-foreground">
                            {t(`settings.notifications.categories.${pref.category}.label`)}
                          </p>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {t(`settings.notifications.categories.${pref.category}.description`)}
                          </p>
                          {pref.locked && (
                            <p className="text-xs text-amber-600 mt-2">
                              {t('settings.notifications.locked')}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center">
                          <Switch
                            checked={pref.email_enabled}
                            onCheckedChange={handleToggle(pref.category, pref.locked)}
                            disabled={pref.locked || saving}
                          />
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => handleSendTestEmail(pref.category)}
                            disabled={saving || isSending}
                          >
                            {isSending ? (
                              <span className="flex items-center gap-2">
                                <Loader2 className="h-4 w-4 animate-spin" />
                                {t('settings.notifications.testEmail.sending')}
                              </span>
                            ) : (
                              t('settings.notifications.testEmail.button')
                            )}
                          </Button>
                        </div>
                      </div>
                      {prefTestStatus && (
                        <Alert variant={prefTestStatus.variant || 'info'} className="mt-3">
                          <AlertDescription>{prefTestStatus.message}</AlertDescription>
                        </Alert>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-end gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={!hasChanges || saving}
                >
                  {t('settings.notifications.reset')}
                </Button>
                <Button
                  type="button"
                  onClick={handleSave}
                  disabled={!hasChanges || saving}
                >
                  {saving ? (
                    <span className="flex items-center gap-2">
                      <Loader2 className="h-4 w-4 animate-spin" />
                      {t('settings.notifications.saving')}
                    </span>
                  ) : (
                    t('settings.notifications.save')
                  )}
                </Button>
              </div>

            </>
          )}
        </CardContent>
      </Card>
    </div>
    </div>
  );
};

export default NotificationSettingsPage;
