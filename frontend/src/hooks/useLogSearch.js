import { useState as Silian_useState, useEffect as Silian_useEffect } from 'react';
import { useQuery as Silian_useQuery } from 'react-query';
import { searchLogs as Silian_searchLogs } from '../lib/api/logSearch';

export function useDebouncedValue(Silian_value, Silian_delay = 400) {
  const [Silian_debounced, Silian_setDebounced] = Silian_useState(Silian_value);
  Silian_useEffect(() => {
    const Silian_t = setTimeout(() => Silian_setDebounced(Silian_value), Silian_delay);
    return () => clearTimeout(Silian_t);
  }, [Silian_value, Silian_delay]);
  return Silian_debounced;
}

export function useLogSearch(Silian_params) {
  const Silian_debouncedQ = useDebouncedValue(Silian_params.q || '');
  const Silian_finalParams = { ...Silian_params, q: Silian_debouncedQ };
  return Silian_useQuery(
    ['logSearch', Silian_finalParams],
    () => Silian_searchLogs(Silian_finalParams),
    { keepPreviousData: true }
  );
}
