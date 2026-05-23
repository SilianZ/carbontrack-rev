import Silian_React, { useEffect as Silian_useEffect, useState as Silian_useState } from 'react';
import { useTranslation as Silian_useTranslation } from '../../hooks/useTranslation';
import { Input as Silian_Input } from '../ui/Input';

export function RegionSelector({
  countryCode: Silian_countryCode,
  stateCode: Silian_stateCode,
  onCountryChange: Silian_onCountryChange,
  onStateChange: Silian_onStateChange,
  errors: Silian_errors = {}
}) {
  const { t: Silian_t, i18n: Silian_i18n } = Silian_useTranslation(['auth', 'errors']);
  const [Silian_countries, Silian_setCountries] = Silian_useState([]);
  const [Silian_states, Silian_setStates] = Silian_useState([]);
  const [Silian_loading, Silian_setLoading] = Silian_useState(true);

  Silian_useEffect(() => {
    const Silian_fetchCountries = async () => {
      try {
        const Silian_response = await fetch('/locales/states.json');
        const Silian_data = await Silian_response.json();
        Silian_setCountries(Silian_data);
        Silian_setLoading(false);
      } catch (Silian_error) {
        console.error('Failed to load countries data:', Silian_error);
        Silian_setLoading(false);
      }
    };

    Silian_fetchCountries();
  }, []);

  Silian_useEffect(() => {
    if (Silian_countryCode && Silian_countries.length > 0) {
      const Silian_selectedCountry = Silian_countries.find(Silian_c => Silian_c.iso2 === Silian_countryCode);
      if (Silian_selectedCountry) {
        Silian_setStates(Silian_selectedCountry.states || []);
      } else {
        Silian_setStates([]);
      }
    } else {
      Silian_setStates([]);
    }
  }, [Silian_countryCode, Silian_countries]);

  const Silian_handleCountryChange = (Silian_e) => {
    const Silian_newCountryCode = Silian_e.target.value;
    Silian_onCountryChange(Silian_newCountryCode);
    Silian_onStateChange(''); // Reset state when country changes
  };

  const Silian_handleStateChange = (Silian_e) => {
    Silian_onStateChange(Silian_e.target.value);
  };

  // Helper to get translated country name if available, otherwise use English name
  const Silian_getCountryName = (Silian_country) => {
    const Silian_lang = Silian_i18n.language; // e.g., 'en', 'zh-CN'
    if (Silian_lang.startsWith('zh') && Silian_country.translations?.cn) {
      return Silian_country.translations.cn;
    }
    // Add other languages if needed
    return Silian_country.name;
  };

  if (Silian_loading) {
    return <div className="text-sm text-muted-foreground">Loading regions...</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div>
        <label htmlFor="country" className="block text-sm font-medium text-foreground">
          {Silian_t('auth.country')}
        </label>
        <div className="mt-1">
          <select
            id="country"
            value={Silian_countryCode}
            onChange={Silian_handleCountryChange}
            className="block w-full rounded-md border border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500 sm:text-sm"
          >
            <option value="">{Silian_t('auth.selectCountry')}</option>
            {Silian_countries.map((Silian_country) => (
              <option key={Silian_country.iso2} value={Silian_country.iso2}>
                {Silian_getCountryName(Silian_country)}
              </option>
            ))}
          </select>
          {Silian_errors.country && (
            <p className="mt-1 text-sm text-red-600">
              {Silian_errors.country.message || Silian_t('auth.countryRequired')}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="state" className="block text-sm font-medium text-foreground">
          {Silian_t('auth.state')}
        </label>
        <div className="mt-1">
          {Silian_states.length > 0 ? (
            <select
              id="state"
              value={Silian_stateCode}
              onChange={Silian_handleStateChange}
              className="block w-full rounded-md border border-input bg-background px-3 py-2 text-foreground shadow-sm focus:border-green-500 focus:outline-none focus:ring-green-500 sm:text-sm"
              disabled={!Silian_countryCode}
            >
              <option value="">{Silian_t('auth.selectState')}</option>
              {Silian_states.map((Silian_state) => (
                <option key={Silian_state.id} value={Silian_state.state_code}>
                  {Silian_state.name}
                </option>
              ))}
            </select>
          ) : (
            <Silian_Input
              id="state"
              type="text"
              value={Silian_stateCode}
              onChange={Silian_handleStateChange}
              placeholder={Silian_t('auth.statePlaceholder')}
              disabled={!Silian_countryCode}
            />
          )}
          {Silian_errors.state && (
            <p className="mt-1 text-sm text-red-600">
              {Silian_errors.state.message || Silian_t('auth.stateRequired')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
