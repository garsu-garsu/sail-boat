import { Asset, Paragraph } from "@toss/tds-mobile";

import { useRouter, type RouteName } from "../router";
import { ocean } from "../theme";

interface Tab {
  name: RouteName;
  label: string;
  /** 토스 모노 아이콘 이름 (static.toss.im/icons) */
  icon: string;
}

const TABS: Tab[] = [
  { name: "home", label: "홈", icon: "icon-home-mono" },
  { name: "receive", label: "받은편지", icon: "icon-mail-mono" },
  { name: "replies", label: "답장함", icon: "icon-letter-mono" },
];

/** 메인 탭 하단 내비게이션 */
export function BottomNav() {
  const { route, reset } = useRouter();

  return (
    <nav
      style={{
        display: "flex",
        background: ocean.white,
        borderTop: "1px solid rgba(27,59,111,0.08)",
        paddingBottom: "max(0px, env(safe-area-inset-bottom))",
      }}
    >
      {TABS.map((tab) => {
        const active = route.name === tab.name;
        return (
          <button
            key={tab.name}
            type="button"
            onClick={() => reset({ name: tab.name } as never)}
            style={{
              flex: 1,
              border: "none",
              background: "transparent",
              padding: "8px 0 10px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 3,
              cursor: "pointer",
            }}
          >
            <Asset.Icon
              name={tab.icon}
              color={active ? ocean.primary : ocean.ink}
              frameShape={Asset.frameShape.CleanW24}
              backgroundColor="transparent"
            />
            <Paragraph
              typography="t7"
              fontWeight={active ? "bold" : "medium"}
              color={active ? ocean.primary : ocean.ink}
              style={{ opacity: active ? 1 : 0.5 }}
            >
              {tab.label}
            </Paragraph>
          </button>
        );
      })}
    </nav>
  );
}
