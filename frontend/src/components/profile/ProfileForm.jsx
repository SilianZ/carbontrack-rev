import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { useQueryClient } from 'react-query';
import { useTranslation } from '../../hooks/useTranslation';
import { profileAPI, schoolAPI } from '../../lib/api';
import { userManager } from '../../lib/auth';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { Alert, AlertDescription } from '../ui/Alert';
import { Badge } from '../ui/badge';
import Turnstile from '../common/Turnstile';
import { RegionSelector } from '../common/RegionSelector';

const FALLBACK = '—';

const renderField = (label, value) => (
  <div className="space-y-1" key={label}>
    <p className="text-sm font-medium text-gray-700">{label}</p>
    <div className="rounded-md border border-dashed border-gray-200 bg-muted/40 px-3 py-2 text-sm text-gray-900">
      {value ?? FALLBACK}
    </div>
  </div>
);

const useDebouncedValue = (value, delay = 350) => {
  const [debounced, setDebounced] = useState(value);

  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(id);
  }, [value, delay]);

  return debounced;
};

export function ProfileForm({ user }) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const turnstileRef = useRef(null);

  const [inputValue, setInputValue] = useState('');
  const [selectedSchool, setSelectedSchool] = useState(
    user?.school_id ? { id: user.school_id, name: user.school_name || '' } : null
  );
  const [suggestions, setSuggestions] = useState([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState('');
  const [feedback, setFeedback] = useState(null); // { type: 'success' | 'error', message: string }
  
  // Region state
  const [countryCode, setCountryCode] = useState(user?.country_code || '');
  const [stateCode, setStateCode] = useState(user?.state_code || '');

  const debouncedQuery = useDebouncedValue(inputValue.trim(), 350);

  const currentSchoolId = user?.school_id ?? null;
  const currentSchoolName = (user?.school_name || '').trim();

  useEffect(() => {
    setSelectedSchool(currentSchoolId ? { id: currentSchoolId, name: currentSchoolName } : null);
  }, [currentSchoolId, currentSchoolName]);

  useEffect(() => {
    setCountryCode(user?.country_code || '');
    setStateCode(user?.state_code || '');
  }, [user?.country_code, user?.state_code]);

  useEffect(() => {
    let cancelled = false;
    setLoadingSuggestions(true);
    schoolAPI
      .getSchools({ search: debouncedQuery || undefined, limit: 8, page: 1 })
      .then((response) => {
        if (cancelled) return;
        const list = response.data?.data?.schools ?? [];
        setSuggestions(list);
      })
      .catch(() => {
        if (!cancelled) {
          setSuggestions([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setLoadingSuggestions(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  const trimmedInput = useMemo(() => inputValue.trim(), [inputValue]);

  const pendingPayload = useMemo(() => {
    if (!user) return null;
    const payload = {};
    let hasChanges = false;

    if (selectedSchool && selectedSchool.id !== currentSchoolId) {
      payload.school_id = selectedSchool.id;
      hasChanges = true;
    }
    if (!selectedSchool && trimmedInput && trimmedInput !== currentSchoolName) {
      payload.new_school_name = trimmedInput;
      hasChanges = true;
    }

    // Region changes
    if (countryCode !== (user.country_code || '') || stateCode !== (user.state_code || '')) {
        if (countryCode && stateCode) {
             payload.country_code = countryCode;
             payload.state_code = stateCode;
             hasChanges = true;
        }
    }

    return hasChanges ? payload : null;
  }, [currentSchoolId, currentSchoolName, selectedSchool, trimmedInput, user, countryCode, stateCode]);

  const requiresVerification = Boolean(pendingPayload);
  const submitDisabled = !pendingPayload || isSaving || (requiresVerification && !turnstileToken);

  const formattedUpdatedAt = useMemo(() => {
    if (!user?.updated_at) return FALLBACK;
    const dateValue = new Date(user.updated_at);
    if (Number.isNaN(dateValue.getTime())) {
      return user.updated_at;
    }
    return dateValue.toLocaleString();
  }, [user?.updated_at]);

  const summaryItems = [
    {
      label: t('profile.userId', '用户ID'),
      value: user?.id ?? FALLBACK,
    },
    {
      label: t('profile.uuid', 'UUID'),
      value: user?.uuid || FALLBACK,
    },
    {
      label: t('profile.points', '积分'),
      value: user?.points ?? 0,
    },
    {
      label: t('profile.lastUpdated', '最后更新'),
      value: formattedUpdatedAt,
    },
  ];

  const detailFields = [
    {
      label: t('profile.username'),
      value: user?.username || FALLBACK,
    },
    {
      label: t('profile.email'),
      value: user?.email || FALLBACK,
    },
    {
      label: t('profile.region', 'Region'),
      value: user?.region_label || FALLBACK,
    },
    {
      label: t('profile.school'),
      value: currentSchoolName || t('profile.schoolUnset', 'Not set'),
    },
  ];

  const handleInputChange = (event) => {
    const { value } = event.target;
    setInputValue(value);
    setFeedback(null);

    if (selectedSchool && value.trim() !== (selectedSchool.name || '').trim()) {
      setSelectedSchool(null);
    }
  };

  const handleSelectSchool = (school) => {
    setSelectedSchool({ id: school.id, name: school.name });
    setInputValue(school.name || '');
    setFeedback(null);
  };

  const handleClearSelection = () => {
    setSelectedSchool(null);
    setInputValue('');
    setFeedback(null);
  };

  const handleReset = () => {
    setSelectedSchool(currentSchoolId ? { id: currentSchoolId, name: currentSchoolName } : null);
    setInputValue('');
    setCountryCode(user?.country_code || '');
    setStateCode(user?.state_code || '');
    setFeedback(null);
    setTurnstileToken('');
    turnstileRef.current?.reset?.();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!pendingPayload) {
      setFeedback({
        type: 'error',
        message: t('profile.noChanges', 'No changes detected.'),
      });
      return;
    }

    setIsSaving(true);
    setFeedback(null);

    try {
      const payload = {
        ...pendingPayload,
        cf_turnstile_response: turnstileToken || undefined,
      };
      const response = await profileAPI.updateProfile(payload);
      if (!response.data?.success) {
        throw new Error(response.data?.message || 'Failed to update profile');
      }

      const updatedUser = response.data?.data;
      if (updatedUser) {
        userManager.setUser(updatedUser);
        queryClient.invalidateQueries('currentUser');
        setSelectedSchool(
          updatedUser.school_id
            ? { id: updatedUser.school_id, name: updatedUser.school_name || '' }
            : null
        );
        setCountryCode(updatedUser.country_code || '');
        setStateCode(updatedUser.state_code || '');
      }

      setInputValue('');
      setFeedback({
        type: 'success',
        message: t('profile.updateSuccess', 'Profile updated successfully.'),
      });
    } catch (error) {
      const message =
        error.response?.data?.message ||
        error.message ||
        t('profile.updateFailed', 'Unable to update profile.');
      setFeedback({ type: 'error', message });
    } finally {
      setIsSaving(false);
      setTurnstileToken('');
      turnstileRef.current?.reset?.();
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2">
        {summaryItems.map((item) => (
          <div className="min-w-0" key={item.label}>
            <p className="text-xs text-muted-foreground">{item.label}</p>
            <p className="break-words text-sm font-medium">{item.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {detailFields.map(({ label, value }) => renderField(label, value))}
      </div>

      <section className="rounded-lg border p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-gray-900">
              {t('profile.editProfile', 'Edit Profile')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {t(
                'profile.editDescription',
                'Update your region and school information.'
              )}
            </p>
          </div>
        </div>

        <form className="space-y-6" onSubmit={handleSubmit}>
          
          <div className="space-y-4">
             <h4 className="text-sm font-medium text-gray-900 border-b pb-2">{t('profile.regionSettings', 'Region Settings')}</h4>
             <RegionSelector
                countryCode={countryCode}
                stateCode={stateCode}
                onCountryChange={setCountryCode}
                onStateChange={setStateCode}
             />
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="text-sm font-medium text-gray-900 border-b pb-2 w-full">{t('profile.schoolSettings', 'School Settings')}</h4>
            </div>
            
            <div>
                <label htmlFor="schoolSearch" className="block text-sm font-medium text-gray-700">
                {t('auth.school', 'School')}
                </label>
                <Input
                id="schoolSearch"
                className="mt-2"
                placeholder={t(
                    'profile.schoolSearchPlaceholder',
                    'Search for a school or enter a new name'
                )}
                value={inputValue}
                onChange={handleInputChange}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                {t(
                    'profile.schoolInputHint',
                    'Selecting an existing school keeps data consistent. Typing a new school name will create it after verification.'
                )}
                </p>
            </div>

            <div className="rounded-md border bg-white">
                <div className="flex items-center justify-between border-b px-3 py-2">
                <span className="text-sm font-medium text-muted-foreground">
                    {t('profile.schoolSuggestions', 'Suggestions')}
                </span>
                <Button type="button" variant="ghost" size="sm" onClick={handleClearSelection}>
                    {t('profile.clearSelection', 'Clear selection')}
                </Button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                {loadingSuggestions ? (
                    <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    {t('profile.loadingSchools', 'Loading schools...')}
                    </div>
                ) : suggestions.length > 0 ? (
                    suggestions.map((school) => {
                    const isActive = selectedSchool?.id === school.id;
                    return (
                        <button
                        type="button"
                        key={school.id}
                        onClick={() => handleSelectSchool(school)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${
                            isActive ? 'bg-green-50 text-green-700' : ''
                        }`}
                        >
                        <span>{school.name}</span>
                        {isActive && <Badge variant="outline">{t('profile.selected', 'Selected')}</Badge>}
                        </button>
                    );
                    })
                ) : (
                    <div className="px-3 py-3 text-sm text-muted-foreground">
                    {t('profile.schoolNoResults', 'No matching schools. Enter a new name above.')}
                    </div>
                )}
                </div>
            </div>
          </div>

          {feedback && (
            <Alert variant={feedback.type === 'error' ? 'destructive' : 'success'}>
              <AlertDescription>{feedback.message}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-3">
            <Turnstile
              ref={turnstileRef}
              className="flex flex-col items-center"
              onVerify={setTurnstileToken}
              onExpire={() => setTurnstileToken('')}
              onError={() => setTurnstileToken('')}
              require
            />
            <p className="text-xs text-muted-foreground text-center">
              {t(
                'profile.turnstileNotice',
                'Verification is required to prevent automated updates.'
              )}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Button type="submit" className="flex-1" loading={isSaving} disabled={submitDisabled}>
              {t('profile.saveChanges', 'Save Changes')}
            </Button>
            <Button type="button" variant="outline" className="flex-1" onClick={handleReset}>
              {t('profile.reset', 'Reset')}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
