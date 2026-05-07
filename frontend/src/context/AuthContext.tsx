import { useEffect, useCallback, useMemo, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { authApi } from '../api/auth';
import type { ApiError, UserOut } from '../types/api';
import { queryKeys } from '../utils/queryKeys';
import { AuthContext, type AuthContextValue } from './useAuth';

const AUTH_CHANNEL_NAME = 'snickr-auth';

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const meQuery = useQuery({
    queryKey: queryKeys.me,
    queryFn: async () => {
      try {
        return await authApi.me();
      } catch (error) {
        if ((error as ApiError).status === 401) return null;
        throw error;
      }
    },
    retry: false,
    refetchOnWindowFocus: true,
  });

  const setAuthUser = useCallback(
    (user: UserOut | null) => {
      queryClient.setQueryData(queryKeys.me, user);
      const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
      channel.postMessage({ type: 'auth-changed' });
      channel.close();
    },
    [queryClient],
  );

  const refreshAuth = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.me });
  }, [queryClient]);

  useEffect(() => {
    const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
    channel.onmessage = (event) => {
      if (event.data?.type === 'auth-changed') {
        void queryClient.invalidateQueries();
      }
    };
    return () => {
      channel.close();
    };
  }, [queryClient]);

  const logout = useCallback(async () => {
    await authApi.logout();
    setAuthUser(null);
    queryClient.clear();
  }, [queryClient, setAuthUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: meQuery.data ?? null,
      isLoading: meQuery.isLoading,
      isAuthenticated: Boolean(meQuery.data),
      refreshAuth,
      setAuthUser,
      logout,
    }),
    [meQuery.data, meQuery.isLoading, refreshAuth, setAuthUser, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
