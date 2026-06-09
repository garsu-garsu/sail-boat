import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  devSignIn,
  getCurrentProfile,
  loginWithToss,
  logout as logoutClient,
} from "./data/authClient";
import type { Profile } from "./types";

interface SessionContextValue {
  profile: Profile | null;
  loading: boolean;
  /** 토스 로그인 (인구통계 동의 포함) */
  loginToss: () => Promise<Profile>;
  /** 개발/브라우저용 익명 입장 */
  devLogin: () => Promise<Profile>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
  /** 인구통계가 있어 필터를 쓸 수 있는지 */
  hasDemographics: boolean;
  /** 둘러보기(익명)로 입장한 상태인지 (토스 로그인 안 함) */
  isGuest: boolean;
}

const SessionContext = createContext<SessionContextValue | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      setProfile(await getCurrentProfile());
    } catch (e) {
      console.error("세션 조회 실패:", e);
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    void (async () => {
      await refresh();
      setLoading(false);
    })();
  }, [refresh]);

  const loginToss = useCallback(async () => {
    const p = await loginWithToss();
    setProfile(p);
    return p;
  }, []);

  const devLogin = useCallback(async () => {
    const p = await devSignIn();
    setProfile(p);
    return p;
  }, []);

  const logout = useCallback(async () => {
    await logoutClient();
    setProfile(null);
  }, []);

  const value = useMemo<SessionContextValue>(
    () => ({
      profile,
      loading,
      loginToss,
      devLogin,
      logout,
      refresh,
      hasDemographics:
        profile != null &&
        (profile.gender != null ||
          profile.ageBand != null ||
          profile.nationality != null),
      isGuest: profile != null && profile.tossUserKey == null,
    }),
    [profile, loading, loginToss, devLogin, logout, refresh],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionContextValue {
  const ctx = useContext(SessionContext);
  if (ctx == null) {
    throw new Error("useSession must be used within SessionProvider");
  }
  return ctx;
}
