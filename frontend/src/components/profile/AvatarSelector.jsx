import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { avatarAPI } from '../../lib/api';
import { Button } from '../ui/Button';
import { Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'react-hot-toast';
import R2Image from '../common/R2Image';
import { buildAvatarDisplayProps } from '../../lib/avatarUtils';

export function AvatarSelector({ currentAvatarId, onAvatarChange }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [selectedAvatar, setSelectedAvatar] = useState(currentAvatarId);

  const { data: avatarsData, isLoading: isLoadingAvatars, error: avatarsError } = useQuery(
    'avatars',
    () => avatarAPI.getAvatars()
  );

  const updateAvatarMutation = useMutation(
    (avatarId) => avatarAPI.selectAvatar(avatarId),
    {
      onSuccess: () => {
        toast.success(t('profile.avatarUpdateSuccess'));
        queryClient.invalidateQueries('currentUser');
        onAvatarChange(selectedAvatar);
      },
      onError: (err) => {
        toast.error(t('profile.avatarUpdateFailed'));
        console.error('Avatar update failed:', err);
      }
    }
  );

  const avatars = avatarsData?.data?.data || [];

  const AvatarThumbnail = ({ avatar }) => {
    const { src, filePath, alt, fallbackInitial } = buildAvatarDisplayProps(avatar);
    const fallback = (
      <div className="flex aspect-square w-full items-center justify-center rounded-md bg-muted text-xs text-muted-foreground">
        {fallbackInitial || 'IMG'}
      </div>
    );
    return (
      <R2Image
        src={src || undefined}
        filePath={!src && filePath ? filePath : undefined}
        alt={alt || avatar?.name}
        className="w-full h-auto rounded-md object-cover"
        fallback={fallback}
      />
    );
  };

  const handleSelectAvatar = (avatarId) => {
    setSelectedAvatar(avatarId);
  };

  const handleSaveAvatar = () => {
    if (selectedAvatar && selectedAvatar !== currentAvatarId) {
      updateAvatarMutation.mutate(selectedAvatar);
    }
  };

  if (isLoadingAvatars) {
    return (
      <div className="flex justify-center items-center h-32">
        <Loader2 className="h-8 w-8 animate-spin text-green-500" />
      </div>
    );
  }

  if (avatarsError) {
    return (
      <div className="text-center text-red-500">
        {t('profile.avatarLoadError')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h3 className="text-lg font-semibold">{t('profile.selectAvatar')}</h3>
      <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 gap-4">
        {avatars.map((avatar) => (
          <div
            key={avatar.id}
            className={`relative p-2 border-2 rounded-lg cursor-pointer
              ${selectedAvatar === avatar.id ? 'border-green-500' : 'border-border hover:border-border/80'}`}
            onClick={() => handleSelectAvatar(avatar.id)}
          >
            <AvatarThumbnail avatar={avatar} />
            {selectedAvatar === avatar.id && (
              <div className="absolute top-1 right-1 bg-green-500 rounded-full p-1">
                <CheckCircle className="h-4 w-4 text-white" />
              </div>
            )}
            <p className="text-center text-sm mt-1">{avatar.name}</p>
          </div>
        ))}
      </div>
      <Button
        onClick={handleSaveAvatar}
        disabled={selectedAvatar === currentAvatarId || updateAvatarMutation.isLoading}
        className="w-full"
      >
        {updateAvatarMutation.isLoading ? t('common.saving') : t('common.save')}
      </Button>
    </div>
  );
}

