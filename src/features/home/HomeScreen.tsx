import { useEffect, useRef } from "react";

import { Button, Paragraph, useToast } from "@toss/tds-mobile";

import { CoachMark } from "../../components/CoachMark";
import { SampleLetterCard } from "../../components/SampleLetterCard";
import { ScreenLayout } from "../../components/ScreenLayout";
import { canRequestNotifyConsent, requestNotifyConsent } from "../../data/notify";
import { useHomeTour } from "../../hooks/useHomeTour";
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
  const { profile, logout, isGuest, loading } = useSession();
  const { openToast } = useToast();

  const isLoggedIn = profile != null;

  // 첫 방문(로그인 전) 사람에게만 이 화면의 핵심 두 버튼을 코치마크로 짚어줘요.
  // 세션을 아직 모르는 동안에는 띄우지 않아요 — 이미 로그인한 사람에게 잠깐 떴다 사라지면
  // 그 사이 화면 터치까지 코치마크가 가로채요.
  const tourSteps = loading || isLoggedIn ? [] : ["send", "receive"];
  const { current: tourStep, index: tourIndex, total: tourTotal, next: tourNext, skip: tourSkip } =
    useHomeTour(tourSteps);
  const sendRef = useRef<HTMLDivElement>(null);
  const receiveRef = useRef<HTMLDivElement>(null);

  // 코치마크 진행 중엔 화면 아무 곳이나 눌러도 다음 단계로 — 건너뛰기 버튼 클릭만 그대로 통과시켜요.
  useEffect(() => {
    if (tourStep == null) return;
    const onClick = (event: MouseEvent) => {
      if ((event.target as HTMLElement | null)?.closest("[data-tour-skip]") != null) return;
      event.preventDefault();
      event.stopPropagation();
      tourNext();
    };
    window.addEventListener("click", onClick, true);
    return () => window.removeEventListener("click", onClick, true);
  }, [tourStep, tourNext]);

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

  // 로그인 전이어도 해당 화면으로 바로 보내요. 각 화면이 필요한 순간에만 로그인을 받고,
  // 로그인이 끝나면 하던 자리로 되돌아와요.
  const handleFloat = () => {
    navigate({ name: "compose" });
  };

  const handlePick = () => {
    navigate({ name: "receive" });
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
          누가 받을지 모르는 익명 편지를 유리병에 담아 띄우고,
          <br />
          낯선 누군가의 편지를 랜덤으로 받아요.
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
        /* 로그인 전에는 설명 대신 읽을거리부터 보여줘요. 로그인은 편지를 쓰거나 열 때 받아요. */
        <div style={{ marginTop: 16 }}>
          <SampleLetterCard context="home" />
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
        <div ref={sendRef}>
          <Button size="xlarge" display="full" onClick={handleFloat}>
            ✉️ 편지 보내기
          </Button>
        </div>
        <div ref={receiveRef}>
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
        {!isLoggedIn && (
          <Paragraph
            typography="t7"
            color={ocean.ink}
            textAlign="center"
            style={{ margin: 0, lineHeight: 1.5, opacity: 0.7 }}
          >
            토스로 시작하면 받을 사람 조건을 골라 편지를 보낼 수 있어요.
          </Paragraph>
        )}
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

      {tourStep != null && (
        <CoachMark
          targetRef={tourStep === "send" ? sendRef : receiveRef}
          message={
            tourStep === "send"
              ? "누가 받을지 모르니까 더 솔직해져요. 눌러서 편지를 띄워보세요."
              : "누군가 띄운 편지가 무작위로 도착해요. 받은 편지엔 한 번 답장할 수 있어요."
          }
          index={tourIndex}
          total={tourTotal}
          onSkip={tourSkip}
        />
      )}
    </ScreenLayout>
  );
}
