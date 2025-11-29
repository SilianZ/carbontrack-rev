import React, { useEffect, useState } from 'react';
import { useTranslation } from '../../hooks/useTranslation';
import { Input } from '../ui/Input';

export function RegionSelector({ 
  countryCode, 
  stateCode, 
  onCountryChange, 
  onStateChange, 
  errors = {} 
}) {
  const { t, i18n } = useTranslation();
  const [countries, setCountries] = useState([]);
  const [states, setStates] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchCountries = async () => {
      try {
        const response = await fetch('/locales/states.json');
        const data = await response.json();
        setCountries(data);
        setLoading(false);
      } catch (error) {
        console.error('Failed to load countries data:', error);
        setLoading(false);
      }
    };

    fetchCountries();
  }, []);

  useEffect(() => {
    if (countryCode && countries.length > 0) {
      const selectedCountry = countries.find(c => c.iso2 === countryCode);
      if (selectedCountry) {
        setStates(selectedCountry.states || []);
      } else {
        setStates([]);
      }
    } else {
      setStates([]);
    }
  }, [countryCode, countries]);

  const handleCountryChange = (e) => {
    const newCountryCode = e.target.value;
    onCountryChange(newCountryCode);
    onStateChange(''); // Reset state when country changes
  };

  const handleStateChange = (e) => {
    onStateChange(e.target.value);
  };

  // Helper to get translated country name if available, otherwise use English name
  const getCountryName = (country) => {
    const lang = i18n.language; // e.g., 'en', 'zh-CN'
    if (lang.startsWith('zh') && country.translations?.cn) {
      return country.translations.cn;
    }
    // Add other languages if needed
    return country.name;
  };

  if (loading) {
    return <div className="text-sm text-gray-500">Loading regions...</div>;
  }

  return (
    <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
      <div>
        <label htmlFor="country" className="block text-sm font-medium text-gray-700">
          {t('auth.country', 'Country')}
        </label>
        <div className="mt-1">
          <select
            id="country"
            value={countryCode}
            onChange={handleCountryChange}
            className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
          >
            <option value="">{t('auth.selectCountry', 'Select Country')}</option>
            {countries.map((country) => (
              <option key={country.iso2} value={country.iso2}>
                {getCountryName(country)}
              </option>
            ))}
          </select>
          {errors.country && (
            <p className="mt-1 text-sm text-red-600">
              {errors.country.message || t('auth.countryRequired', 'Country is required')}
            </p>
          )}
        </div>
      </div>

      <div>
        <label htmlFor="state" className="block text-sm font-medium text-gray-700">
          {t('auth.state', 'State/Province')}
        </label>
        <div className="mt-1">
          {states.length > 0 ? (
            <select
              id="state"
              value={stateCode}
              onChange={handleStateChange}
              className="block w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-green-500 focus:border-green-500 sm:text-sm"
              disabled={!countryCode}
            >
              <option value="">{t('auth.selectState', 'Select State')}</option>
              {states.map((state) => (
                <option key={state.id} value={state.state_code}>
                  {state.name}
                </option>
              ))}
            </select>
          ) : (
            <Input
              id="state"
              type="text"
              value={stateCode}
              onChange={handleStateChange}
              placeholder={t('auth.statePlaceholder', 'Enter State/Province')}
              disabled={!countryCode}
            />
          )}
          {errors.state && (
            <p className="mt-1 text-sm text-red-600">
              {errors.state.message || t('auth.stateRequired', 'State is required')}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
