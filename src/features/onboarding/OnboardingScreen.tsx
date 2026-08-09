import { useState } from "react";

import { Button, Paragraph, useToast } from "@toss/tds-mobile";

import { ScreenLayout } from "../../components/ScreenLayout";
import { EVENT, track } from "../../lib/analytics";
import { useRouter } from "../../router";
import { useSession } from "../../session";
import { glassCard, ocean } from "../../theme";

/**
 * 로그인 화면 — 편지 쓰기·받은 편지함에서 로그인 없이 들어왔다가(행동 직전) 뜨는 화면이에요.
 * 앱 소개는 홈 화면 코치마크로 옮겼고, 여기는 실제 로그인이 꼭 필요한 부분만 남아있어요.
 * 로그인이 끝나면 하던 화면으로 돌아가요.
 */
export function OnboardingScreen() {
  const { back } = useRouter();
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
      back();
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
      back();
    } catch {
      openToast("입장에 실패했어요. 잠시 후 다시 시도해 주세요.");
    } finally {
      setGuestLoading(false);
    }
  };

  return (
    <ScreenLayout hideAd title="익명 편지 시작하기" background="sky">
      {/* 커뮤니티 가이드 (이용 규칙) 고지 */}
      <div style={{ ...glassCard, marginTop: 8, padding: 16 }}>
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

      {/* 로그인 버튼 */}
      <div
        style={{
          marginTop: 20,
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
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
      </div>
    </ScreenLayout>
  );
}
