import "./App.css";

import { closeView, graniteEvent } from "@apps-in-toss/web-framework";
import { useEffect } from "react";

import { BannerAd } from "./components/BannerAd";
import { BottomNav } from "./components/BottomNav";
import { trackScreen } from "./lib/analytics";
import { ComposeScreen } from "./features/compose/ComposeScreen";
import { FloatedScreen } from "./features/compose/FloatedScreen";
import { FilterProvider } from "./features/filter/filterStore";
import { FilterScreen } from "./features/filter/FilterScreen";
import { HomeScreen } from "./features/home/HomeScreen";
import { OnboardingScreen } from "./features/onboarding/OnboardingScreen";
import { ReadScreen } from "./features/receive/ReadScreen";
import { ReceiveScreen } from "./features/receive/ReceiveScreen";
import { RepliesScreen } from "./features/replies/RepliesScreen";
import { ReplyScreen } from "./features/reply/ReplyScreen";
import { RouterProvider, useRouter, type RouteName } from "./router";
import { SessionProvider, useSession } from "./session";

// 하단 탭이 보이는 메인 화면들
const TAB_SCREENS: RouteName[] = ["home", "receive", "replies"];

function CurrentScreen() {
  const { route } = useRouter();

  switch (route.name) {
    case "home":
      return <HomeScreen />;
    case "onboarding":
      return <OnboardingScreen />;
    case "compose":
      return <ComposeScreen />;
    case "floated":
      return <FloatedScreen />;
    case "receive":
      return <ReceiveScreen />;
    case "filter":
      return <FilterScreen />;
    case "read":
      return <ReadScreen bottleId={route.bottleId} />;
    case "reply":
      return <ReplyScreen bottleId={route.bottleId} />;
    case "replies":
      return <RepliesScreen />;
    default:
      return <HomeScreen />;
  }
}

function Shell() {
  const { route, back, canGoBack } = useRouter();
  const { loading } = useSession();
  const showTabs = TAB_SCREENS.includes(route.name);

  // 화면 조회 분석 (route 이름 기준)
  useEffect(() => {
    trackScreen(route.name);
  }, [route.name]);

  // 토스 네이티브 상단 바의 뒤로가기를 앱 내 화면 이동에 연결해요.
  // 이전 화면이 있으면 그쪽으로, 없으면(루트) 미니앱을 닫아요. (브라우저에서는 미지원이라 무시)
  useEffect(() => {
    try {
      return graniteEvent.addEventListener("backEvent", {
        onEvent: () => {
          if (canGoBack) {
            back();
          } else {
            try {
              closeView();
            } catch {
              /* noop */
            }
          }
        },
      });
    } catch {
      return undefined;
    }
  }, [back, canGoBack]);

  if (loading) {
    return (
      <div
        style={{
          minHeight: "100dvh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#6FB7E0",
          color: "#fff",
          fontSize: 32,
        }}
      >
        ⛵
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100dvh",
        overflow: "hidden",
      }}
    >
      <div style={{ flex: 1, minHeight: 0 }}>
        <CurrentScreen />
      </div>
      {showTabs && <BannerAd slot={route.name} />}
      {showTabs && <BottomNav />}
    </div>
  );
}

function App() {
  return (
    <SessionProvider>
      <FilterProvider>
        <RouterProvider initial={{ name: "home" }}>
          <Shell />
        </RouterProvider>
      </FilterProvider>
    </SessionProvider>
  );
}

export default App;
