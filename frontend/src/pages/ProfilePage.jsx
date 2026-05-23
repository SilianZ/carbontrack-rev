import Silian_React from 'react';
import { useQuery as Silian_useQuery, useQueryClient as Silian_useQueryClient } from 'react-query';
import { useTranslation as Silian_useTranslation } from '../hooks/useTranslation';
import { userAPI as Silian_userAPI } from '../lib/api';
import { ProfileForm as Silian_ProfileForm } from '../components/profile/ProfileForm';
import { AvatarSelector as Silian_AvatarSelector } from '../components/profile/AvatarSelector';
import Silian_R2Image from '../components/common/R2Image';
import { buildAvatarDisplayProps as Silian_buildAvatarDisplayProps } from '../lib/avatarUtils';
import { PasswordChangeForm as Silian_PasswordChangeForm } from '../components/profile/PasswordChangeForm';
import { PasskeyManagement as Silian_PasskeyManagement } from '../components/profile/PasskeyManagement';
import { SecurityActivityCard as Silian_SecurityActivityCard } from '../components/profile/SecurityActivityCard';
import { Card as Silian_Card, CardContent as Silian_CardContent, CardHeader as Silian_CardHeader, CardTitle as Silian_CardTitle } from '../components/ui/Card';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription, AlertTitle as Silian_AlertTitle } from '../components/ui/Alert';
import { AlertCircle as Silian_AlertCircle, Loader2 as Silian_Loader2 } from 'lucide-react';

export default function ProfilePage() {
  const { t: Silian_t } = Silian_useTranslation(['common', 'profile']);
  const Silian_queryClient = Silian_useQueryClient();

  const { data: Silian_userData, isLoading: Silian_isLoading, error: Silian_error } = Silian_useQuery(
    'currentUser',
    () => Silian_userAPI.getCurrentUser(),
    { staleTime: Infinity } // User data is relatively static, can be cached longer
  );

  const Silian_responsePayload = Silian_userData?.data ?? null;
  const Silian_user = Silian_responsePayload?.data ?? Silian_responsePayload ?? null;

  const Silian_handleAvatarChange = () => {
    // Optionally update local state or re-fetch user data if needed
    Silian_queryClient.invalidateQueries('currentUser');
  };

  const Silian_avatarDisplay = Silian_React.useMemo(() => {
    if (!Silian_user) return { src: '', filePath: '', alt: '', fallbackInitial: '' };
    return Silian_buildAvatarDisplayProps({
      ...Silian_user,
      name: Silian_user.username,
    });
  }, [Silian_user]);

  if (Silian_isLoading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <Silian_Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    );
  }

  if (Silian_error) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Silian_Alert variant="destructive">
          <Silian_AlertCircle className="h-4 w-4" />
          <Silian_AlertTitle>{Silian_t('common.error')}</Silian_AlertTitle>
          <Silian_AlertDescription>{Silian_t('profile.loadError')}</Silian_AlertDescription>
        </Silian_Alert>
      </div>
    );
  }

  if (!Silian_user) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Silian_Alert variant="warning">
          <Silian_AlertCircle className="h-4 w-4" />
          <Silian_AlertTitle>{Silian_t('common.notice')}</Silian_AlertTitle>
          <Silian_AlertDescription>{Silian_t('profile.noUserData')}</Silian_AlertDescription>
        </Silian_Alert>
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
                {Silian_avatarDisplay.src || Silian_avatarDisplay.filePath ? (
                  <Silian_R2Image
                    src={Silian_avatarDisplay.src || undefined}
                    filePath={!Silian_avatarDisplay.src && Silian_avatarDisplay.filePath ? Silian_avatarDisplay.filePath : undefined}
                    alt={Silian_avatarDisplay.alt || Silian_user.username}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{Silian_avatarDisplay.fallbackInitial || (Silian_user.username ? Silian_user.username.charAt(0).toUpperCase() : 'U')}</span>
                )}
              </div>
            </div>
            <div className="space-y-1">
              <h2 className="text-3xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-br from-gray-900 to-gray-600 dark:from-white dark:to-white/60">{Silian_user.username}</h2>
              {Silian_user.email && <p className="text-sm text-muted-foreground">{Silian_user.email}</p>}
              <div className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground mt-2">
                <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-1 text-xs font-medium text-blue-700 ring-1 ring-inset ring-blue-700/10 dark:bg-blue-400/10 dark:text-blue-400 dark:ring-blue-400/30">{Silian_t('profile.points')}: {Silian_user.points ?? 0}</span>
                {Silian_user.school_name && <span className="inline-flex items-center gap-1.5 rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 ring-1 ring-inset ring-green-600/20 dark:bg-green-500/10 dark:text-green-400 dark:ring-green-500/20"><span className="h-1.5 w-1.5 rounded-full bg-green-500 dark:bg-green-400" />{Silian_user.school_name}</span>}
              </div>
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-semibold mb-6">{Silian_t('profile.title')}</h1>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          <Silian_Card>
            <Silian_CardHeader>
              <Silian_CardTitle>{Silian_t('profile.basicInfo')}</Silian_CardTitle>
            </Silian_CardHeader>
            <Silian_CardContent>
              <Silian_ProfileForm user={Silian_user} />
            </Silian_CardContent>
          </Silian_Card>

        <Silian_Card>
          <Silian_CardHeader>
            <Silian_CardTitle>{Silian_t('profile.avatar')}</Silian_CardTitle>
          </Silian_CardHeader>
          <Silian_CardContent>
            <Silian_AvatarSelector currentAvatarId={Silian_user?.avatar_id} onAvatarChange={Silian_handleAvatarChange} />
          </Silian_CardContent>
        </Silian_Card>

        <Silian_Card className="lg:col-span-2">
          <Silian_CardHeader>
            <Silian_CardTitle>{Silian_t('profile.changePassword')}</Silian_CardTitle>
          </Silian_CardHeader>
          <Silian_CardContent>
            <Silian_PasswordChangeForm />
          </Silian_CardContent>
        </Silian_Card>

        <div className="grid gap-8 lg:col-span-2 xl:grid-cols-2">
          <Silian_PasskeyManagement />
          <Silian_SecurityActivityCard />
        </div>
      </div>
    </div>
    </div>
  );
}

