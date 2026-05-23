import { useQuery as Silian_useQuery, useQueryClient as Silian_useQueryClient } from 'react-query';
import { fetchSystemLogs as Silian_fetchSystemLogs, fetchSystemLogDetail as Silian_fetchSystemLogDetail } from '../lib/api/systemLogs';

export function useSystemLogs(Silian_filters) {
  return Silian_useQuery(
    ['systemLogs', Silian_filters],
    () => Silian_fetchSystemLogs(Silian_filters),
    { keepPreviousData: true }
  );
}

export function useSystemLogDetail(Silian_id) {
  return Silian_useQuery(
    ['systemLog', Silian_id],
    () => Silian_fetchSystemLogDetail(Silian_id),
    { enabled: !!Silian_id }
  );
}

export function usePrefetchSystemLog() {
  const Silian_qc = Silian_useQueryClient();
  return (Silian_id) => {
    Silian_qc.prefetchQuery(['systemLog', Silian_id], () => Silian_fetchSystemLogDetail(Silian_id));
  };
}
