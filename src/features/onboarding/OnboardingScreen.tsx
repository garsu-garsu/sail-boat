import { useState } from "react";

import { Button, Paragraph, useToast } from "@toss/tds-mobile";

import { ScreenLayout } from "../../components/ScreenLayout";
import { EVENT, track } from "../../lib/analytics";
import { useRouter } from "../../router";
import { useSession } from "../../session";
import { glassCard, ocean } from "../../theme";

const STEPS = [
  {
    emoji: "✉️",
    title: "익명 편지를 띄워요",
    desc: "누가 받을지 모르니까 더 솔직해져요. 속마음도, 고민도 유리병에 담아 띄워보세요.",
  },
  {
    emoji: "🌊",
    title: "랜덤으로 편지를 받아요",
    desc: "누군가 띄운 유리병 편지가 받은 편지함에 무작위로 도착해요.",
  },
  {
    emoji: "💌",
    title: "한 번 답장해요",
    desc: "받은 편지에 익명으로 한 번 답장할 수 있어요. 그렇게 마음이 오가요.",
  },
];

export function OnboardingScreen() {
  // 이 화면은 두 가지로 쓰여요.
  // - 첫 실행 소개 (App.tsx 가 reset 으로 띄움 → canGoBack=false): 로그인 없이 홈으로 보내요.
  // - 행동 직전 로그인 (편지 쓰기·받은 편지함에서 navigate → canGoBack=true): 로그인 후 하던 화면으로 돌아가요.
  const { back, canGoBack, reset } = useRouter();
  const introOnly = !canGoBack;
  const goOn = () => (canGoBack ? back() : reset({ name: "home" }));
  const { loginToss, devLogin } = useSession();
  const { openToast } = useToast();

  const [tossLoading, setTossLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);

  const busy = tossLoading || guestLoading;

  const handleTossLogin = async () => {
    if (busy) return;
    setTossLoading(true);
    try {
      await loginToss();
      track(EVENT.signup, { method: "toss" });
      openToast("환영해요!");
      goOn();
    } catch {
      openToast(
        "토스 앱(또는 샌드박스)에서 실행해 주세요. 브라우저에서는 아래 '둘러보기'를 눌러주세요.",
      );
    } finally {
      setTossLoading(false);
    }
  };

  const handleGuestLogin = async () => {
    if (busy) return;
    setGuestLoading(true);
    try {
      await devLogin();
      track(EVENT.signup, { method: "guest" });
      goOn();
    } catch {
      openToast("입장에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <ScreenLayout hideAd title="익명 편지 시작하기" background="sky">
      {/* 컨셉 3단계 카드 */}
      <div
        style={{ display: "flex", flexDirection: "column", gap: 12, marginTop: 8 }}
      >
        {STEPS.map((step, i) => (
          <div
            key={step.title}
            style={{
              ...glassCard,
              display: "flex",
              alignItems: "center",
              gap: 14,
              padding: 16,
            }}
          >
            <div style={{ fontSize: 36, lineHeight: 1 }}>{step.emoji}</div>
            <div style={{ flex: 1 }}>
              <Paragraph
                typography="t6"
                fontWeight="bold"
                color={ocean.ink}
                style={{ marginBottom: 4 }}
              >
                {i + 1}. {step.title}
              </Paragraph>
              <Paragraph
                typography="t7"
                color={ocean.ink}
                style={{ lineHeight: 1.5, opacity: 0.75 }}
              >
                {step.desc}
              </Paragraph>
            </div>
          </div>
        ))}
      </div>

      {/* 커뮤니티 가이드 (이용 규칙) 고지 */}
      <div style={{ ...glassCard, marginTop: 16, padding: 16 }}>
        <Paragraph typography="t6" fontWeight="bold" color={ocean.ink}>
          따뜻한 항해를 위한 약속
        </Paragraph>
        <Paragraph
          typography="t7"
          color={ocean.ink}
          style={{ marginTop: 6, lineHeight: 1.7, opacity: 0.8 }}
        >
          • 불법 광고·성매매·도박 등 불법 행위 금지
          <br />
          • 욕설·혐오·성적 불쾌감을 주는 내용 금지
          <br />• 타인 사칭, 개인정보·금전 요구 금지
          <br />
          위반 시 이용이 제한될 수 있고, 누적되면 영구 정지돼요. 불쾌한 내용은
          신고·차단할 수 있어요.
        </Paragraph>
      </div>

      {/* 개인정보 안내 */}
      <Paragraph
        typography="t7"
        color={ocean.white}
        style={{ margin: "16px 4px 0", lineHeight: 1.5, opacity: 0.85 }}
      >
        토스 로그인 시 성별·연령대·내·외국인 정보를 받아, 원하는 조건으로 편지를
        골라 받는 데에만 사용해요. 시작하면 커뮤니티 가이드에 동의하는 것으로
        간주돼요.
      </Paragraph>

      {/* 시작 버튼 — 첫 실행 소개에서는 로그인 없이 홈으로 보내요. */}
      <div
        style={{
          marginTop: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {introOnly ? (
          <Button size="xlarge" display="full" onClick={goOn}>
            시작하기
          </Button>
        ) : (
          <>
            <Button
              size="xlarge"
              display="full"
              loading={tossLoading}
              disabled={busy}
              onClick={handleTossLogin}
            >
              토스로 시작하기
            </Button>
            <Button
              size="xlarge"
              display="full"
              color="dark"
              variant="weak"
              loading={guestLoading}
              disabled={busy}
              onClick={handleGuestLogin}
            >
              둘러보기 (익명으로 시작)
            </Button>
          </>
        )}
      </div>
    </ScreenLayout>
  );
}
