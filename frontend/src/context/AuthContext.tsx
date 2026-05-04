import {
  createContext,
  useEffect,
  useCallback,
  useContext,
  useMemo,
  type ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { authApi } from "../api/auth";
import type { ApiError, UserOut } from "../types/api";
import { queryKeys } from "../utils/queryKeys";

interface AuthContextValue {
  user: UserOut | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  refreshAuth: () => Promise<void>;
  setAuthUser: (user: UserOut | null) => void;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);
const AUTH_CHANNEL_NAME = "snickr-auth";

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
      channel.postMessage({ type: "auth-changed" });
      channel.close();
    },
    [queryClient],
  );

  const refreshAuth = useCallback(async () => {
    await queryClient.invalidateQueries({ queryKey: queryKeys.me });
  }, [queryClient]);

  useEffect(() => {
    const refreshCurrentSession = async () => {
      await queryClient.invalidateQueries();
      await queryClient.refetchQueries({ queryKey: queryKeys.me });
    };

    const channel = new BroadcastChannel(AUTH_CHANNEL_NAME);
    channel.onmessage = (event) => {
      if (event.data?.type === "auth-changed") {
        void refreshCurrentSession();
      }
    };

    const handleFocus = () => {
      void refreshCurrentSession();
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleFocus);

    return () => {
      channel.close();
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleFocus);
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
