import { useState } from "react";

import { Button, Paragraph, useToast } from "@toss/tds-mobile";

import { EVENT, track } from "../../lib/analytics";
import { useRouter } from "../../router";
import { useSession } from "../../session";
import { glassCard, ocean } from "../../theme";

/**
 * 둘러보기(익명) 유저에게 토스 로그인을 유도하는 배너.
 * 받은 편지함·답장함에 항목이 있을 때 보여줘요.
 * 로그인하면 지금까지 쓴 편지/답장이 그대로 이어지고(계정 연동), 알림을 받을 수 있어요.
 */
export function LoginUpsell({ subject }: { subject: string }) {
  const { loginToss, refresh } = useSession();
  const { reset } = useRouter();
  const { openToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (loading) return;
    setLoading(true);
    track(EVENT.loginUpsellClick, { subject });
    try {
      await loginToss();
      await refresh();
      track(EVENT.signup, { method: "toss_upsell" });
      openToast("토스 계정으로 연동했어요. 이제 알림을 받을 수 있어요!");
      reset({ name: "home" });
    } catch {
      openToast(
        "토스 앱(또는 샌드박스)에서 실행해야 로그인할 수 있어요.",
      );
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        ...glassCard,
        marginBottom: 12,
        display: "flex",
        flexDirection: "column",
        gap: 10,
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <div style={{ fontSize: 28, lineHeight: 1 }}>🔔</div>
        <div style={{ flex: 1 }}>
          <Paragraph typography="t6" fontWeight="bold" color={ocean.ink}>
            알림 받기
          </Paragraph>
          <Paragraph
            typography="t7"
            color={ocean.ink}
            style={{ marginTop: 2, lineHeight: 1.5, opacity: 0.75 }}
          >
            토스로 로그인하면 새 {subject}이 도착할 때 알림을 받아요. 지금까지 쓴
            편지도 그대로 이어져요.
          </Paragraph>
        </div>
      </div>
      <Button
        display="full"
        size="large"
        loading={loading}
        onClick={handleLogin}
      >
        토스 로그인하고 알림 받기
      </Button>
    </div>
  );
}
