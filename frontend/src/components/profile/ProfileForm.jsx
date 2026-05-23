import Silian_React, { useEffect as Silian_useEffect, useMemo as Silian_useMemo, useRef as Silian_useRef, useState as Silian_useState } from 'react';
import { Loader2 as Silian_Loader2 } from 'lucide-react';
import { useQueryClient as Silian_useQueryClient } from 'react-query';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { profileAPI as Silian_profileAPI, schoolAPI as Silian_schoolAPI } from '../../lib/api';
import { userManager as Silian_userManager } from '../../lib/auth';
import { Input as Silian_Input } from '../ui/Input';
import { Button as Silian_Button } from '../ui/Button';
import { Alert as Silian_Alert, AlertDescription as Silian_AlertDescription } from '../ui/Alert';
import { Badge as Silian_Badge } from '../ui/badge';
import Silian_Turnstile from '../common/Turnstile';
import { RegionSelector as Silian_RegionSelector } from '../common/RegionSelector';

const Silian_FALLBACK = '—';

const Silian_renderField = (Silian_label, Silian_value) => (
  <div className="space-y-1" key={Silian_label}>
    <p className="text-sm font-medium text-foreground">{Silian_label}</p>
    <div className="rounded-md border border-dashed border-border bg-muted/40 px-3 py-2 text-sm text-foreground">
      {Silian_value ?? Silian_FALLBACK}
    </div>
  </div>
);

const Silian_useDebouncedValue = (Silian_value, Silian_delay = 350) => {
  const [Silian_debounced, Silian_setDebounced] = Silian_useState(Silian_value);

  Silian_useEffect(() => {
    const Silian_id = setTimeout(() => Silian_setDebounced(Silian_value), Silian_delay);
    return () => clearTimeout(Silian_id);
  }, [Silian_value, Silian_delay]);

  return Silian_debounced;
};

export function ProfileForm({ user: Silian_user }) {
  const { t: Silian_t } = Silian_useTranslation(['auth', 'profile']);
  const Silian_queryClient = Silian_useQueryClient();
  const Silian_turnstileRef = Silian_useRef(null);

  const [Silian_inputValue, Silian_setInputValue] = Silian_useState('');
  const [Silian_selectedSchool, Silian_setSelectedSchool] = Silian_useState(
    Silian_user?.school_id ? { id: Silian_user.school_id, name: Silian_user.school_name || '' } : null
  );
  const [Silian_suggestions, Silian_setSuggestions] = Silian_useState([]);
  const [Silian_loadingSuggestions, Silian_setLoadingSuggestions] = Silian_useState(false);
  const [Silian_isSaving, Silian_setIsSaving] = Silian_useState(false);
  const [Silian_turnstileToken, Silian_setTurnstileToken] = Silian_useState('');
  const [Silian_feedback, Silian_setFeedback] = Silian_useState(null); // { type: 'success' | 'error', message: string }

  // Region state
  const [Silian_countryCode, Silian_setCountryCode] = Silian_useState(Silian_user?.country_code || '');
  const [Silian_stateCode, Silian_setStateCode] = Silian_useState(Silian_user?.state_code || '');

  const Silian_debouncedQuery = Silian_useDebouncedValue(Silian_inputValue.trim(), 350);

  const Silian_currentSchoolId = Silian_user?.school_id ?? null;
  const Silian_currentSchoolName = (Silian_user?.school_name || '').trim();

  Silian_useEffect(() => {
    Silian_setSelectedSchool(Silian_currentSchoolId ? { id: Silian_currentSchoolId, name: Silian_currentSchoolName } : null);
    Silian_setInputValue(Silian_currentSchoolName);
  }, [Silian_currentSchoolId, Silian_currentSchoolName]);

  Silian_useEffect(() => {
    Silian_setCountryCode(Silian_user?.country_code || '');
    Silian_setStateCode(Silian_user?.state_code || '');
  }, [Silian_user?.country_code, Silian_user?.state_code]);

  Silian_useEffect(() => {
    let Silian_cancelled = false;
    Silian_setLoadingSuggestions(true);
    Silian_schoolAPI
      .getSchools({ search: Silian_debouncedQuery || undefined, limit: 8, page: 1 })
      .then((Silian_response) => {
        if (Silian_cancelled) return;
        const Silian_list = Silian_response.data?.data?.schools ?? [];
        Silian_setSuggestions(Silian_list);
      })
      .catch(() => {
        if (!Silian_cancelled) {
          Silian_setSuggestions([]);
        }
      })
      .finally(() => {
        if (!Silian_cancelled) {
          Silian_setLoadingSuggestions(false);
        }
      });

    return () => {
      Silian_cancelled = true;
    };
  }, [Silian_debouncedQuery]);

  const Silian_trimmedInput = Silian_useMemo(() => Silian_inputValue.trim(), [Silian_inputValue]);

  const Silian_pendingPayload = Silian_useMemo(() => {
    if (!Silian_user) return null;
    const Silian_payload = {};
    let Silian_hasChanges = false;

    if (Silian_selectedSchool && Silian_selectedSchool.id !== Silian_currentSchoolId) {
      Silian_payload.school_id = Silian_selectedSchool.id;
      Silian_hasChanges = true;
    }
    if (!Silian_selectedSchool && Silian_trimmedInput && Silian_trimmedInput !== Silian_currentSchoolName) {
      Silian_payload.new_school_name = Silian_trimmedInput;
      Silian_hasChanges = true;
    }

    // Region changes
    if (Silian_countryCode !== (Silian_user.country_code || '') || Silian_stateCode !== (Silian_user.state_code || '')) {
        if (Silian_countryCode && Silian_stateCode) {
             Silian_payload.country_code = Silian_countryCode;
             Silian_payload.state_code = Silian_stateCode;
             Silian_hasChanges = true;
        }
    }

    return Silian_hasChanges ? Silian_payload : null;
  }, [Silian_currentSchoolId, Silian_currentSchoolName, Silian_selectedSchool, Silian_trimmedInput, Silian_user, Silian_countryCode, Silian_stateCode]);

  const Silian_requiresVerification = Boolean(Silian_pendingPayload);
  const Silian_submitDisabled = !Silian_pendingPayload || Silian_isSaving || (Silian_requiresVerification && !Silian_turnstileToken);

  const Silian_formattedUpdatedAt = Silian_useMemo(() => {
    if (!Silian_user?.updated_at) return Silian_FALLBACK;
    const Silian_dateValue = new Date(Silian_user.updated_at);
    if (Number.isNaN(Silian_dateValue.getTime())) {
      return Silian_user.updated_at;
    }
    return Silian_dateValue.toLocaleString();
  }, [Silian_user?.updated_at]);

  const Silian_summaryItems = [
    {
      label: Silian_t('profile.userId'),
      value: Silian_user?.id ?? Silian_FALLBACK,
    },
    {
      label: Silian_t('profile.uuid'),
      value: Silian_user?.uuid || Silian_FALLBACK,
    },
    {
      label: Silian_t('profile.points'),
      value: Silian_user?.points ?? 0,
    },
    {
      label: Silian_t('profile.lastUpdated'),
      value: Silian_formattedUpdatedAt,
    },
  ];

  const Silian_detailFields = [
    {
      label: Silian_t('profile.username'),
      value: Silian_user?.username || Silian_FALLBACK,
    },
    {
      label: Silian_t('profile.email'),
      value: Silian_user?.email || Silian_FALLBACK,
    },
    {
      label: Silian_t('profile.region'),
      value: Silian_user?.region_label || Silian_user?.region_code || Silian_FALLBACK,
    },
    {
      label: Silian_t('profile.school'),
      value: Silian_currentSchoolName || Silian_t('profile.schoolUnset'),
    },
  ];

  const Silian_handleInputChange = (Silian_event) => {
    const { value: Silian_value } = Silian_event.target;
    Silian_setInputValue(Silian_value);
    Silian_setFeedback(null);

    if (Silian_selectedSchool && Silian_value.trim() !== (Silian_selectedSchool.name || '').trim()) {
      Silian_setSelectedSchool(null);
    }
  };

  const Silian_handleSelectSchool = (Silian_school) => {
    Silian_setSelectedSchool({ id: Silian_school.id, name: Silian_school.name });
    Silian_setInputValue(Silian_school.name || '');
    Silian_setFeedback(null);
  };

  const Silian_handleClearSelection = () => {
    Silian_setSelectedSchool(null);
    Silian_setInputValue('');
    Silian_setFeedback(null);
  };

  const Silian_handleReset = () => {
    Silian_setSelectedSchool(Silian_currentSchoolId ? { id: Silian_currentSchoolId, name: Silian_currentSchoolName } : null);
    Silian_setInputValue(Silian_currentSchoolName);
    Silian_setCountryCode(Silian_user?.country_code || '');
    Silian_setStateCode(Silian_user?.state_code || '');
    Silian_setFeedback(null);
    Silian_setTurnstileToken('');
    Silian_turnstileRef.current?.reset?.();
  };

  const Silian_handleSubmit = async (Silian_event) => {
    Silian_event.preventDefault();
    if (!Silian_pendingPayload) {
      Silian_setFeedback({
        type: 'error',
        message: Silian_t('profile.noChanges'),
      });
      return;
    }

    Silian_setIsSaving(true);
    Silian_setFeedback(null);

    try {
      const Silian_payload = {
        ...Silian_pendingPayload,
        cf_turnstile_response: Silian_turnstileToken || undefined,
      };
      const Silian_response = await Silian_profileAPI.updateProfile(Silian_payload);
      if (!Silian_response.data?.success) {
        throw new Error(Silian_response.data?.message || 'Failed to update profile');
      }

      const Silian_updatedUser = Silian_response.data?.data;
      if (Silian_updatedUser) {
        Silian_userManager.setUser(Silian_updatedUser);
        Silian_queryClient.invalidateQueries('currentUser');
        Silian_setSelectedSchool(
          Silian_updatedUser.school_id
            ? { id: Silian_updatedUser.school_id, name: Silian_updatedUser.school_name || '' }
            : null
        );
        Silian_setCountryCode(Silian_updatedUser.country_code || '');
        Silian_setStateCode(Silian_updatedUser.state_code || '');
      }

      Silian_setInputValue('');
      Silian_setFeedback({
        type: 'success',
        message: Silian_t('profile.updateSuccess'),
      });
    } catch (Silian_error) {
      const Silian_message =
        Silian_error.response?.data?.message ||
        Silian_error.message ||
        Silian_t('profile.updateFailed');
      Silian_setFeedback({ type: 'error', message: Silian_message });
    } finally {
      Silian_setIsSaving(false);
      Silian_setTurnstileToken('');
      Silian_turnstileRef.current?.reset?.();
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 rounded-lg border bg-muted/40 p-4 sm:grid-cols-2">
        {Silian_summaryItems.map((Silian_item) => (
          <div className="min-w-0" key={Silian_item.label}>
            <p className="text-xs text-muted-foreground">{Silian_item.label}</p>
            <p className="break-words text-sm font-medium">{Silian_item.value}</p>
          </div>
        ))}
      </div>

      <div className="space-y-4">
        {Silian_detailFields.map(({ label: Silian_label, value: Silian_value }) => Silian_renderField(Silian_label, Silian_value))}
      </div>

      <section className="rounded-lg border p-4">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between mb-4">
          <div>
            <h3 className="text-base font-semibold text-foreground">
              {Silian_t('profile.editProfile')}
            </h3>
            <p className="text-sm text-muted-foreground">
              {Silian_t(
                'profile.editDescription')}
            </p>
          </div>
        </div>

        <form className="space-y-6" onSubmit={Silian_handleSubmit}>

          <div className="space-y-4">
             <h4 className="border-b border-border pb-2 text-sm font-medium text-foreground">{Silian_t('profile.regionSettings')}</h4>
             <Silian_RegionSelector
                countryCode={Silian_countryCode}
                stateCode={Silian_stateCode}
                onCountryChange={Silian_setCountryCode}
                onStateChange={Silian_setStateCode}
             />
          </div>

          <div className="space-y-4">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <h4 className="w-full border-b border-border pb-2 text-sm font-medium text-foreground">{Silian_t('profile.schoolSettings')}</h4>
            </div>

            <div>
                <label htmlFor="schoolSearch" className="block text-sm font-medium text-foreground">
                {Silian_t('auth.school')}
                </label>
                <Silian_Input
                id="schoolSearch"
                className="mt-2"
                placeholder={Silian_t(
                    'profile.schoolSearchPlaceholder')}
                value={Silian_inputValue}
                onChange={Silian_handleInputChange}
                />
                <p className="mt-1 text-xs text-muted-foreground">
                {Silian_t(
                    'profile.schoolInputHint')}
                </p>
            </div>

            <div className="rounded-md border border-border bg-card">
                <div className="flex items-center justify-between border-b border-border px-3 py-2">
                <span className="text-sm font-medium text-muted-foreground">
                    {Silian_t('profile.schoolSuggestions')}
                </span>
                <Silian_Button type="button" variant="ghost" size="sm" onClick={Silian_handleClearSelection}>
                    {Silian_t('profile.clearSelection')}
                </Silian_Button>
                </div>
                <div className="max-h-48 overflow-y-auto">
                {Silian_loadingSuggestions ? (
                    <div className="flex items-center gap-2 px-3 py-3 text-sm text-muted-foreground">
                    <Silian_Loader2 className="h-4 w-4 animate-spin" />
                    {Silian_t('profile.loadingSchools')}
                    </div>
                ) : Silian_suggestions.length > 0 ? (
                    Silian_suggestions.map((Silian_school) => {
                    const Silian_isActive = Silian_selectedSchool?.id === Silian_school.id;
                    return (
                        <button
                        type="button"
                        key={Silian_school.id}
                        onClick={() => Silian_handleSelectSchool(Silian_school)}
                        className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-muted ${
                            Silian_isActive ? 'bg-green-500/12 text-green-500' : 'text-foreground'
                        }`}
                        >
                        <span>{Silian_school.name}</span>
                        {Silian_isActive && <Silian_Badge variant="outline">{Silian_t('profile.selected')}</Silian_Badge>}
                        </button>
                    );
                    })
                ) : (
                    <div className="px-3 py-3 text-sm text-muted-foreground">
                    {Silian_t('profile.schoolNoResults')}
                    </div>
                )}
                </div>
            </div>
          </div>

          {Silian_feedback && (
            <Silian_Alert variant={Silian_feedback.type === 'error' ? 'destructive' : 'success'}>
              <Silian_AlertDescription>{Silian_feedback.message}</Silian_AlertDescription>
            </Silian_Alert>
          )}

          <div className="space-y-3">
            <Silian_Turnstile
              ref={Silian_turnstileRef}
              className="flex flex-col items-center"
              onVerify={Silian_setTurnstileToken}
              onExpire={() => Silian_setTurnstileToken('')}
              onError={() => Silian_setTurnstileToken('')}
              require
            />
            <p className="text-xs text-muted-foreground text-center">
              {Silian_t(
                'profile.turnstileNotice')}
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <Silian_Button type="submit" className="flex-1" loading={Silian_isSaving} disabled={Silian_submitDisabled}>
              {Silian_t('profile.saveChanges')}
            </Silian_Button>
            <Silian_Button type="button" variant="outline" className="flex-1" onClick={Silian_handleReset}>
              {Silian_t('profile.reset')}
            </Silian_Button>
          </div>
        </form>
      </section>
    </div>
  );
}
