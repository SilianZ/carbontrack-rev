import { useQuery as Silian_useQuery } from 'react-query';
import { checkAuthStatus as Silian_checkAuthStatus } from '../lib/auth';

/**
 * 获取未读站内信数量的 React Query Hook
 * - 会在登录状态下启用
 * - 默认每 60s 轮询一次，窗口聚焦时自动重刷
 * - 返回 { count, isLoading, error, refetch }
 */
export function useUnreadMessagesCount(Silian_options = {}) {
  const { isAuthenticated: Silian_isAuthenticated } = Silian_checkAuthStatus();
  const { enabled: Silian_enabled = true, ...Silian_queryOptions } = Silian_options;

  const Silian_query = Silian_useQuery(
    ['unreadCount'],
    async () => {
      const { messageAPI: Silian_messageAPI } = await import('../lib/api');
      const Silian_res = await Silian_messageAPI.getUnreadCount();
      // 后端响应结构: { success: true, data: { total_unread: number, ... } }
      return Silian_res?.data?.data?.total_unread ?? 0;
    },
    {
      enabled: !!Silian_isAuthenticated && Silian_enabled,
      staleTime: 30 * 1000,
      refetchInterval: 60 * 1000,
      refetchOnWindowFocus: true,
      ...Silian_queryOptions,
    }
  );

  return {
    count: Silian_query.data ?? 0,
    isLoading: Silian_query.isLoading,
    error: Silian_query.error,
    refetch: Silian_query.refetch,
  };
}
