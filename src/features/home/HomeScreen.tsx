import { useEffect } from "react";

import { Button, Paragraph, useToast } from "@toss/tds-mobile";

import { ScreenLayout } from "../../components/ScreenLayout";
import { canRequestNotifyConsent, requestNotifyConsent } from "../../data/notify";
import { EVENT, track } from "../../lib/analytics";
import { useRouter } from "../../router";
import { useSession } from "../../session";
import { boatEmoji, bottleEmoji, glassCard, ocean } from "../../theme";
import {
  AGE_BAND_LABEL,
  GENDER_LABEL,
  NATIONALITY_LABEL,
  profileDisplayName,
} from "../../types";

export function HomeScreen() {
  const { navigate } = useRouter();
  const { profile, logout, isGuest } = useSession();
  const { openToast } = useToast();

  const isLoggedIn = profile != null;

  // 토스 로그인 유저에게 알림 수신 동의를 1회 요청해요 (데일리 리마인드 등 마케팅 푸시용).
  // 템플릿 코드가 없거나 브라우저면 아무 일도 일어나지 않아요.
  useEffect(() => {
    if (profile == null || isGuest || !canRequestNotifyConsent()) return;
    const KEY = "sailboat_notify_asked";
    try {
      if (localStorage.getItem(KEY) === "1") return;
      localStorage.setItem(KEY, "1");
    } catch {
      return;
    }
    void requestNotifyConsent().then((result) => {
      if (result != null) track(EVENT.notifyConsent, { result });
    });
  }, [profile, isGuest]);

  // 인구통계 요약 ("20대 · 여성 · 내국인" 형태, 없는 항목은 생략)
  const summaryParts: string[] = [];
  if (profile?.ageBand != null) {
    summaryParts.push(AGE_BAND_LABEL[profile.ageBand]);
  }
  if (profile?.gender != null) {
    summaryParts.push(GENDER_LABEL[profile.gender]);
  }
  if (profile?.nationality != null) {
    summaryParts.push(NATIONALITY_LABEL[profile.nationality]);
  }
  const demographicSummary = summaryParts.join(" · ");

  const handleFloat = () => {
    navigate(isLoggedIn ? { name: "compose" } : { name: "onboarding" });
  };

  const handlePick = () => {
    navigate(isLoggedIn ? { name: "receive" } : { name: "onboarding" });
  };

  const handleLogout = async () => {
    try {
      await logout();
      openToast("다음에 또 만나요");
    } catch {
      openToast("로그아웃에 실패했어요. 잠시 후 다시 시도해 주세요.");
    }
  };

  return (
    <ScreenLayout background="sky">
      {/* 타이틀 영역 */}
      <div style={{ textAlign: "center", padding: "16px 0 8px" }}>
        <div style={{ fontSize: 56, lineHeight: 1 }}>{boatEmoji}</div>
        <Paragraph
          as="h1"
          typography="st2"
          fontWeight="bold"
          color={ocean.white}
          style={{ margin: "12px 0 6px", letterSpacing: -0.5 }}
        >
          돛단배
        </Paragraph>
        <Paragraph
          typography="t6"
          color={ocean.white}
          style={{ margin: 0, lineHeight: 1.5, opacity: 0.95 }}
        >
          유리병에 마음을 담아 바다에 띄워보세요.
          <br />
          언젠가 누군가에게 닿아요.
        </Paragraph>
      </div>

      {/* 로그인 상태 안내 */}
      {isLoggedIn ? (
        <div
          style={{
            ...glassCard,
            marginTop: 16,
            textAlign: "center",
            padding: 16,
          }}
        >
          <Paragraph typography="t5" fontWeight="bold" color={ocean.ink}>
            {profileDisplayName(profile)} 님
          </Paragraph>
          {demographicSummary !== "" && (
            <Paragraph
              typography="t7"
              color={ocean.ink}
              style={{ marginTop: 4, opacity: 0.7 }}
            >
              {demographicSummary}
            </Paragraph>
          )}
        </div>
      ) : (
        <div
          style={{
            ...glassCard,
            marginTop: 16,
            textAlign: "center",
            padding: 16,
          }}
        >
          <Paragraph
            typography="t6"
            color={ocean.ink}
            style={{ margin: "0 0 12px", lineHeight: 1.5 }}
          >
            토스로 시작하면 받을 사람 조건을 골라 편지를 보낼 수 있어요.
          </Paragraph>
          <Button
            size="medium"
            display="inline"
            onClick={() => navigate({ name: "onboarding" })}
          >
            시작하기
          </Button>
        </div>
      )}

      {/* 메인 행동 버튼 */}
      <div
        style={{
          ...glassCard,
          marginTop: 16,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        <Button size="xlarge" display="full" onClick={handleFloat}>
          ✉️ 편지 보내기
        </Button>
        <Button
          size="xlarge"
          display="full"
          color="dark"
          variant="weak"
          onClick={handlePick}
        >
          📩 받은 편지함
        </Button>
      </div>

      {/* 로그아웃 */}
      {isLoggedIn && (
        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button
            type="button"
            onClick={handleLogout}
            style={{
              border: "none",
              background: "transparent",
              color: ocean.white,
              fontSize: 13,
              opacity: 0.85,
              cursor: "pointer",
              padding: 8,
              textDecoration: "underline",
            }}
          >
            로그아웃
          </button>
        </div>
      )}

      {/* 하단 장식 */}
      <div
        style={{
          textAlign: "center",
          marginTop: 24,
          fontSize: 28,
          opacity: 0.9,
        }}
      >
        {bottleEmoji}
      </div>
    </ScreenLayout>
  );
}
