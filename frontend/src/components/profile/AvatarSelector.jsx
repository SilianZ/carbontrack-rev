import Silian_React, { useState as Silian_useState } from 'react';
import { useQuery as Silian_useQuery, useMutation as Silian_useMutation, useQueryClient as Silian_useQueryClient } from 'react-query';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { avatarAPI as Silian_avatarAPI } from '../../lib/api';
import { Button as Silian_Button } from '../ui/Button';
import { Loader2 as Silian_Loader2, CheckCircle as Silian_CheckCircle } from 'lucide-react';
import { toast as Silian_toast } from 'react-hot-toast';
import Silian_R2Image from '../common/R2Image';
import { buildAvatarDisplayProps as Silian_buildAvatarDisplayProps } from '../../lib/avatarUtils';

export function AvatarSelector({ currentAvatarId: Silian_currentAvatarId, onAvatarChange: Silian_onAvatarChange }) {
  const { t: Silian_t } = Silian_useTranslation(['common', 'profile']);
  const Silian_queryClient = Silian_useQueryClient();
  const [Silian_selectedAvatar, Silian_setSelectedAvatar] = Silian_useState(Silian_currentAvatarId);

  const { data: Silian_avatarsData, isLoading: Silian_isLoadingAvatars, error: Silian_avatarsError } = Silian_useQuery(
    'avatars',
    () => Silian_avatarAPI.getAvatars()
  );

  const Silian_updateAvatarMutation = Silian_useMutation(
    (Silian_avatarId) => Silian_avatarAPI.selectAvatar(Silian_avatarId),
    {
      onSuccess: () => {
        Silian_toast.success(Silian_t('profile.avatarUpdateSuccess'));
        Silian_queryClient.invalidateQueries('currentUser');
        Silian_onAvatarChange(Silian_selectedAvatar);
      },
      onError: (Silian_err) => {
        Silian_toast.error(Silian_t('profile.avatarUpdateFailed'));
        console.error('Avatar update failed:', Silian_err);
      }
    }
  );

  const Silian_avatars = Silian_avatarsData?.data?.data || [];

  const Silian_AvatarThumbnail = ({ avatar: Silian_avatar }) => {
    const { src: Silian_src, filePath: Silian_filePath, alt: Silian_alt, fallbackInitial: Silian_fallbackInitial } = Silian_buildAvatarDisplayProps(Silian_avatar);
    const Silian_fallback = (
      <div className="flex aspect-square w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
        {Silian_fallbackInitial || 'IMG'}
      </div>
    );
    return (
      <Silian_R2Image
        src={Silian_src || undefined}
        filePath={!Silian_src && Silian_filePath ? Silian_filePath : undefined}
        alt={Silian_alt || Silian_avatar?.name}
        className="w-full h-auto rounded-md object-cover"
        fallback={Silian_fallback}
      />
    );
  };

  const Silian_handleSelectAvatar = (Silian_avatarId) => {
    Silian_setSelectedAvatar(Silian_avatarId);
  };

  const Silian_handleSaveAvatar = () => {
    if (Silian_selectedAvatar && Silian_selectedAvatar !== Silian_currentAvatarId) {
      Silian_updateAvatarMutation.mutate(Silian_selectedAvatar);
    }
  };

  if (Silian_isLoadingAvatars) {
    return (
      <div className="flex justify-center items-center h-32">
        <Silian_Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    );
  }

  if (Silian_avatarsError) {
    return (
      <div className="text-center text-red-500">
        {Silian_t('profile.avatarLoadError')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{Silian_t('profile.selectAvatar')}</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
        {Silian_avatars.map((Silian_avatar) => (
          <div
            key={Silian_avatar.id}
            className={`relative p-2 border-2 rounded-lg cursor-pointer
              ${Silian_selectedAvatar === Silian_avatar.id ? 'border-green-500' : 'border-border hover:border-border/80'}`}
            onClick={() => Silian_handleSelectAvatar(Silian_avatar.id)}
          >
            <Silian_AvatarThumbnail avatar={Silian_avatar} />
            {Silian_selectedAvatar === Silian_avatar.id && (
              <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                <Silian_CheckCircle className="h-4 w-4 text-white" />
              </div>
            )}
            <p className="text-center text-sm mt-1">{Silian_avatar.name}</p>
          </div>
        ))}
      </div>
      <Silian_Button
        onClick={Silian_handleSaveAvatar}
        disabled={Silian_selectedAvatar === Silian_currentAvatarId || Silian_updateAvatarMutation.isLoading}
        className="w-full"
      >
        {Silian_updateAvatarMutation.isLoading ? Silian_t('common.saving') : Silian_t('common.save')}
      </Silian_Button>
    </div>
  );
}

