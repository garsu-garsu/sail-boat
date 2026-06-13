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
/** 화면 하단 등에 붙이는 배너 광고. 지원되지 않으면 공간을 차지하지 않아요. */
export function BannerAd({ slot }: BannerAdProps) {
  const targetRef = useRef<HTMLDivElement | null>(null);
  const [visible, setVisible] = useState(false);

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

      const { destroy } = TossAds.attachBanner(AD_GROUP_ID_BANNER, target, {
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
      detach = destroy;
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
  }, [slot]);

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
