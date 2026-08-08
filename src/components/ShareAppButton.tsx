import { useState } from "react";

import { Button, useToast } from "@toss/tds-mobile";

import { shareApp } from "../data/share";
import { EVENT, track } from "../lib/analytics";

/**
 * 앱 공유 버튼.
 * 편지를 띄운 직후·답장을 받은 직후처럼 마음이 열린 순간에 놓아요.
 * 사람이 늘어야 편지가 오가는 서비스라 공유가 곧 편지 도착률이에요.
 */
export function ShareAppButton({
  context,
  label = "🔗 친구에게 알리기",
  weak = false,
  size = "xlarge",
}: {
  /** 어느 화면에서 눌렀는지 (분석용) */
  context: string;
  label?: string;
  weak?: boolean;
  size?: "medium" | "large" | "xlarge";
}) {
  const { openToast } = useToast();
  const [loading, setLoading] = useState(false);

  const handleShare = async () => {
    if (loading) return;
    setLoading(true);
    const ok = await shareApp();
    setLoading(false);
    if (ok) {
      track(EVENT.shareCompleted, { context });
      openToast("고마워요! 사람이 늘수록 편지도 더 자주 오가요.");
    } else {
      openToast("공유를 완료하지 못했어요. 잠시 후 다시 시도해 주세요.");
    }
  };

  return (
    <Button
      size={size}
      display="full"
      loading={loading}
      color={weak ? "dark" : undefined}
      variant={weak ? "weak" : undefined}
      onClick={handleShare}
    >
      {label}
    </Button>
  );
}
