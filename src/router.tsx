import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";

// 앱 내 화면 라우팅 (앱인토스 WebView 단일 SPA 패턴).
// 각 화면은 파라미터를 가질 수 있어요.
export type Route =
  | { name: "home" }
  | { name: "onboarding" }
  | { name: "compose" }
  | { name: "floated" }
  | { name: "receive" }
  | { name: "filter" }
  | { name: "read"; bottleId: string }
  | { name: "reply"; bottleId: string }
  | { name: "replies" };

export type RouteName = Route["name"];

interface RouterContextValue {
  route: Route;
  /** 새 화면으로 이동 (스택에 쌓임) */
  navigate: (route: Route) => void;
  /** 이전 화면으로 (스택이 비면 home) */
  back: () => void;
  /** 스택을 비우고 해당 화면으로 (탭 전환 등) */
  reset: (route: Route) => void;
  canGoBack: boolean;
}

const RouterContext = createContext<RouterContextValue | null>(null);

export function RouterProvider({
  children,
  initial = { name: "home" },
}: {
  children: ReactNode;
  initial?: Route;
}) {
  const [stack, setStack] = useState<Route[]>([initial]);

  const navigate = useCallback((route: Route) => {
    setStack((prev) => [...prev, route]);
  }, []);

  const back = useCallback(() => {
    setStack((prev) => (prev.length > 1 ? prev.slice(0, -1) : prev));
  }, []);

  const reset = useCallback((route: Route) => {
    setStack([route]);
  }, []);

  const value = useMemo<RouterContextValue>(
    () => ({
      route: stack[stack.length - 1],
      navigate,
      back,
      reset,
      canGoBack: stack.length > 1,
    }),
    [stack, navigate, back, reset],
  );

  return (
    <RouterContext.Provider value={value}>{children}</RouterContext.Provider>
  );
}

export function useRouter(): RouterContextValue {
  const ctx = useContext(RouterContext);
  if (ctx == null) {
    throw new Error("useRouter must be used within RouterProvider");
  }
  return ctx;
}
