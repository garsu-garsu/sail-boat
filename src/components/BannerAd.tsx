import { TossAds } from "@apps-in-toss/web-framework";
import { useEffect, useRef, useState } from "react";

import { AD_GROUP_ID_BANNER } from "../lib/env";
import { EVENT, track } from "../lib/analytics";

interface BannerAdProps {
  /** 분석용 노출 위치 구분값 (예: 'home' | 'receive' | 'replies') */
  slot?: string;
}

// 참고문서: https://developers-apps-in-toss.toss.im/bedrock/reference/framework/광고/BannerAd.html
//
// TossAds.attachBanner 는 네이티브 광고 SDK를 대상 DOM에 붙여요.
// - 브라우저/미지원 환경에서는 isSupported() 가 false → 아무것도 렌더링하지 않아요.
// - AD_GROUP_ID_BANNER 가 비어있으면(미설정) 렌더링하지 않아요.
/**
 * 한 번 붙은 배너는 같은 광고를 계속 물고 있어요. 주기마다 떼었다 다시 붙여
 * 새 광고를 받아옵니다.
 *
 * 30초인 이유: 토스 배너는 AdMob 기반인데 AdMob 은 30초보다 잦은 갱신을
 * 무효 트래픽으로 봐요. 더 짧게 잡으면 수익보다 제재 위험이 커져요.
 */
const REFRESH_MS = 30_000;

/** 화면 하단에 고정으로 붙이는 배너 광고. 지원되지 않으면 공간을 차지하지 않아요. */
export function BannerAd({ slot }: BannerAdProps) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);
  // 이 값이 바뀔 때마다 아래 effect 가 다시 돌면서 배너를 새로 붙여요.
  const [round, setRound] = useState(0);

  useEffect(() => {
    const target = targetRef.current;
    if (AD_GROUP_ID_BANNER === "" || target == null) return;

    let detach: (() => void) | undefined;

    try {
      if (!TossAds.attachBanner.isSupported()) return;

      // SDK 초기화 (이미 초기화돼 있어도 안전하게 재호출 가능)
      try {
        if (TossAds.initialize.isSupported()) {
          TossAds.initialize({});
        }
      } catch {
        /* 초기화 중복/미지원 무시 */
      }

      // destroy 를 따로 떼어내면 SDK 안에서 this 를 잃어 정리가 안 될 수 있어요.
      // 객체째 들고 있다가 attached.destroy() 로 부릅니다.
      const attached = TossAds.attachBanner(AD_GROUP_ID_BANNER, target, {
        theme: "auto",
        variant: "card",
        callbacks: {
          onAdRendered: () => {
            setVisible(true);
            track(EVENT.adBannerImpression, { slot: slot ?? "" }, "impression");
          },
          onAdFailedToRender: (payload) => {
            console.error("배너 광고 렌더 실패:", payload.error);
            setVisible(false);
          },
          onNoFill: () => setVisible(false),
        },
      });
      detach = () => attached?.destroy();
    } catch (err) {
      console.error("배너 광고 연결 실패:", err);
    }

    return () => {
      try {
        detach?.();
      } catch {
        /* noop */
      }
    };
  }, [slot, round]);

  // 화면을 보고 있을 때만 갱신해요. 안 보이는 동안 돌리면 노출로 잡히지 않고
  // 호출만 쌓여요.
  useEffect(() => {
    if (AD_GROUP_ID_BANNER === "") return;
    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (timer != null) clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      stop();
      timer = setInterval(() => setRound((n) => n + 1), REFRESH_MS);
    };
    const onVisibility = () => (document.hidden ? stop() : start());

    if (!document.hidden) start();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      stop();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);

  // 미설정 환경에서는 빈 컨테이너조차 만들지 않아요.
  if (AD_GROUP_ID_BANNER === "") return null;

  return (
    <div
      ref={targetRef}
      style={{
        // 광고가 실제로 렌더되기 전(또는 noFill)에는 높이 0 으로 공간을 차지하지 않아요.
        minHeight: visible ? undefined : 0,
        overflow: "hidden",
      }}
    />
  );
}
