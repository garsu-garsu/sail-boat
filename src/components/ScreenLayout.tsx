import type { ReactNode } from "react";

import { Top } from "@toss/tds-mobile";

import { isInTossApp } from "../lib/tossEnv";
import { useRouter } from "../router";
import { ocean } from "../theme";

interface ScreenLayoutProps {
  title?: string;
  /** 뒤로가기 버튼 표시 (기본: 스택에 이전 화면이 있으면 표시) */
  showBack?: boolean;
  /** 제목 우측 영역 (신고 버튼 등) */
  headerRight?: ReactNode;
  /** 화면 하단 고정 영역 (CTA 등) */
  footer?: ReactNode;
  /** 배경 종류 */
  background?: "sky" | "deep";
  children: ReactNode;
}

/**
 * 바다 배경 + (본문 상단 제목) + 스크롤 본문의 공통 화면 틀.
 *
 * 상단 바는 토스 네이티브 바에 맡기고(뒤로가기), 화면 제목은 본문 맨 위에 큰 제목(TDS Top)으로 보여줘요.
 * 토스 밖(브라우저)에서는 네이티브 바가 없으므로 인앱 뒤로가기 버튼을 폴백으로 보여줘요.
 */
export function ScreenLayout({
  title,
  showBack,
  headerRight,
  footer,
  background = "sky",
  children,
}: ScreenLayoutProps) {
  const { back, canGoBack } = useRouter();
  // 브라우저(둘러보기)에서만 인앱 back 노출. 토스 앱에서는 네이티브 바가 처리해요.
  const showInAppBack = (showBack ?? canGoBack) && !isInTossApp();

  return (
    <div
      style={{
        height: "100%",
        minHeight: 0,
        background: background === "deep" ? ocean.deepSea : ocean.skyToSea,
        display: "flex",
        flexDirection: "column",
      }}
    >
      <main
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "8px 20px 24px",
          paddingTop: "max(8px, env(safe-area-inset-top))",
          WebkitOverflowScrolling: "touch",
        }}
      >
        {showInAppBack && (
          <button
            type="button"
            onClick={back}
            aria-label="뒤로가기"
            style={{
              border: "none",
              background: "transparent",
              fontSize: 24,
              lineHeight: 1,
              color: ocean.white,
              cursor: "pointer",
              padding: "4px 4px 0",
              marginLeft: -4,
            }}
          >
            ‹
          </button>
        )}

        {title != null && (
          <Top
            title={
              <Top.TitleParagraph size={22} color={ocean.white}>
                {title}
              </Top.TitleParagraph>
            }
            right={headerRight}
          />
        )}

        {children}
      </main>

      {footer != null && (
        <div
          style={{
            padding: "12px 20px",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
          }}
        >
          {footer}
        </div>
      )}
    </div>
  );
}
