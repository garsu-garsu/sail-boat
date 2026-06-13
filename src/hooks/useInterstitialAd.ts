import {
  loadFullScreenAd,
  showFullScreenAd,
} from "@apps-in-toss/web-framework";
import { useCallback, useEffect, useRef, useState } from "react";

import { AD_GROUP_ID_INTERSTITIAL } from "../lib/env";
import { EVENT, track } from "../lib/analytics";

/** 전면 광고를 N번째 호출마다 보여주는 빈도 제한(기본 3회마다 1번). */
const DEFAULT_FREQUENCY = 3;

// 빈도 카운터를 모듈 스코프에 둬서 화면 이동/리마운트 사이에도 유지돼요.
let callCount = 0;

interface UseInterstitialAdReturn {
  /**
   * 빈도 조건이 맞으면 전면 광고를 보여주고, 닫힌 뒤 onContinue 를 실행해요.
   * 광고 미설정/미지원/미로드이거나 빈도 차례가 아니면 onContinue 를 즉시 실행해요.
   * → 광고 때문에 사용자 흐름이 끊기지 않아요.
   */
  maybeShow: (onContinue: () => void, context?: string) => void;
}

/**
 * "콘텐츠 전환 사이에 가끔 전면 광고" 패턴.
 * 편지 열람처럼 화면을 넘어가는 자연스러운 지점에서 사용해요.
 */
export function useInterstitialAd(
  frequency: number = DEFAULT_FREQUENCY,
): UseInterstitialAdReturn {
  const [ready, setReady] = useState(false);
  const supportedRef = useRef(false);
  const unloadRef = useRef<(() => void) | null>(null);

  const load = useCallback(() => {
    if (AD_GROUP_ID_INTERSTITIAL === "") return;
    try {
      if (!loadFullScreenAd.isSupported()) return;
      supportedRef.current = true;
      unloadRef.current = loadFullScreenAd({
        options: { adGroupId: AD_GROUP_ID_INTERSTITIAL },
        onEvent: (e) => {
          if (e.type === "loaded") setReady(true);
        },
        onError: (err) => console.error("전면 광고 로드 실패:", err),
      });
    } catch (err) {
      console.error("전면 광고 환경 확인 실패:", err);
    }
  }, []);

  useEffect(() => {
    load();
    return () => unloadRef.current?.();
  }, [load]);

  const maybeShow = useCallback(
    (onContinue: () => void, context?: string) => {
      callCount += 1;
      const isTurn = frequency > 0 && callCount % frequency === 0;

      // 미설정/미지원/미로드/차례 아님 → 즉시 통과
      if (
        AD_GROUP_ID_INTERSTITIAL === "" ||
        !supportedRef.current ||
        !ready ||
        !isTurn
      ) {
        onContinue();
        return;
      }

      let continued = false;
      const continueOnce = () => {
        if (continued) return;
        continued = true;
        onContinue();
      };

      try {
        showFullScreenAd({
          options: { adGroupId: AD_GROUP_ID_INTERSTITIAL },
          onEvent: (e) => {
            switch (e.type) {
              case "dismissed":
                track(EVENT.adInterstitial, { context: context ?? "" });
                setReady(false);
                load();
                continueOnce();
                break;
              case "failedToShow":
                setReady(false);
                load();
                continueOnce();
                break;
            }
          },
          onError: (err) => {
            console.error("전면 광고 표시 실패:", err);
            setReady(false);
            load();
            continueOnce();
          },
        });
      } catch (err) {
        console.error("전면 광고 표시 실패:", err);
        continueOnce();
      }
    },
    [ready, frequency, load],
  );

  return { maybeShow };
}
