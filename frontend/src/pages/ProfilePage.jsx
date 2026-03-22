import React from 'react';
import { useQuery, useQueryClient } from 'react-query';
import { useTranslation } from '../hooks/useTranslation';
import { userAPI } from '../lib/api';
import { ProfileForm } from '../components/profile/ProfileForm';
import { AvatarSelector } from '../components/profile/AvatarSelector';
import R2Image from '../components/common/R2Image';
import { buildAvatarDisplayProps } from '../lib/avatarUtils';
import { PasswordChangeForm } from '../components/profile/PasswordChangeForm';
import { PasskeyManagement } from '../components/profile/PasskeyManagement';
import { SecurityActivityCard } from '../components/profile/SecurityActivityCard';
import { Card, CardContent, CardHeader, CardTitle } from '../components/ui/Card';
import { Alert, AlertDescription, AlertTitle } from '../components/ui/Alert';
import { AlertCircle, Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();

  const { data: userData, isLoading, error } = useQuery(
    'currentUser',
    () => userAPI.getCurrentUser(),
    { staleTime: Infinity } // User data is relatively static, can be cached longer
  );

  const responsePayload = userData?.data ?? null;
  const user = responsePayload?.data ?? responsePayload ?? null;

  const handleAvatarChange = () => {
    // Optionally update local state or re-fetch user data if needed
    queryClient.invalidateQueries('currentUser');
  };

  const avatarDisplay = React.useMemo(() => {
    if (!user) return { src: '', filePath: '', alt: '', fallbackInitial: '' };
    return buildAvatarDisplayProps({
      ...user,
      name: user.username,
    });
  }, [user]);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('common.error')}</AlertTitle>
          <AlertDescription>{t('profile.loadError')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Alert variant="warning">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>{t('common.notice')}</AlertTitle>
          <AlertDescription>{t('profile.noUserData')}</AlertDescription>
        </Alert>
      </div>
    );
  }

  return (
    <div className="relative min-h-screen bg-background text-foreground overflow-hidden">
      {/* Ambient Glow */}
      <div className="absolute top-0 right-1/4 -z-10 h-[500px] w-[500px] blur-[120px] bg-gradient-to-br from-indigo-50/50 via-slate-50/30 to-transparent opacity-50 dark:from-indigo-900/20 dark:via-slate-900/10 dark:opacity-30 pointer-events-none" />

      <div className="container mx-auto py-8 px-4 relative">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-8">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div className="flex h-24 w-24 items-center justify-center overflow-hidden rounded-full bg-muted text-3xl font-semibold text-muted-foreground ring-4 ring-background shadow-[0_8px_30px_rgb(0,0,0,0.12)] dark:shadow-none dark:ring-white/10">
                {avatarDisplay.src || avatarDisplay.filePath ? (
                  <R2Image
                    src={avatarDisplay.src || undefined}
                    filePath={!avatarDisplay.src && avatarDisplay.filePath ? avatarDisplay.filePath : undefined}
                    alt={avatarDisplay.alt || user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{avatarDisplay.fallbackInitial || (user.username ? user.username.charAt(0).toUpperCase() : 'U')}</span>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60">{user.username}</h2>
              {user.email && <p className="text-sm text-muted-foreground">{user.email}</p>}
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-2">
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">{t('profile.points')}: {user.points ?? 0}</span>
                {user.school_name && <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20"><span className="h-1.5 w-1.5 rounded-full bg-green-500 dark:bg-green-400" />{user.school_name}</span>}
              </div>
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-semibold mb-6">{t('profile.title')}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Card>
            <CardHeader>
              <CardTitle>{t('profile.basicInfo')}</CardTitle>
            </CardHeader>
            <CardContent>
              <ProfileForm user={user} />
            </CardContent>
          </Card>

        <Card>
          <CardHeader>
            <CardTitle>{t('profile.avatar')}</CardTitle>
          </CardHeader>
          <CardContent>
            <AvatarSelector currentAvatarId={user?.avatar_id} onAvatarChange={handleAvatarChange} />
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>{t('profile.changePassword')}</CardTitle>
          </CardHeader>
          <CardContent>
            <PasswordChangeForm />
          </CardContent>
        </Card>

        <div className="grid gap-8 lg:col-span-2 xl:grid-cols-2">
          <PasskeyManagement />
          <SecurityActivityCard />
        </div>
      </div>
    </div>
    </div>
  );
}

