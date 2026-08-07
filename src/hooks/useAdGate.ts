import {
  loadFullScreenAd,
  showFullScreenAd,
} from "@apps-in-toss/web-framework";
import { useToast } from "@toss/tds-mobile";
import { useCallback, useEffect, useRef, useState } from "react";

import { AD_GROUP_ID_REWARDED } from "../lib/env";
import { EVENT, track } from "../lib/analytics";

interface UseAdGateReturn {
  /** 광고 환경이 준비됐는지 (앱/샌드박스 + 광고 로드 완료) */
  ready: boolean;
  /**
   * 광고를 보여주고, 보상을 받으면 onReward 를 실행해요.
   * 광고가 지원되지 않거나(브라우저/개발) AD_GROUP_ID_REWARDED 가 비어있으면 즉시 onReward 실행.
   * context 는 분석용 구분값이에요 (예: 'send' | 'reply' | 'chat').
   */
  watchThen: (onReward: () => void, context?: string) => void;
}

/**
 * "광고 보고 → 액션 실행" 게이트.
 * 답장 보내기, 채팅방 열기, 필터 적용 등에 사용해요.
 */
export function useAdGate(): UseAdGateReturn {
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const supportedRef = useRef(false);
  const unloadRef = useRef<(() => void) | null>(null);

  const load = useCallback(() => {
    if (AD_GROUP_ID_REWARDED === "") return;
    try {
      if (!loadFullScreenAd.isSupported()) return;
      supportedRef.current = true;
      unloadRef.current = loadFullScreenAd({
        options: { adGroupId: AD_GROUP_ID_REWARDED },
        onEvent: (e) => {
          if (e.type === "loaded") setReady(true);
        },
        onError: (err) => console.error("광고 로드 실패:", err),
      });
    } catch (err) {
      console.error("광고 환경 확인 실패:", err);
    }
  }, []);

  useEffect(() => {
    load();
    return () => unloadRef.current?.();
  }, [load]);

  const watchThen = useCallback(
    (onReward: () => void, context?: string) => {
      // 광고 미설정/미지원 환경 → 즉시 통과 (개발 편의)
      if (AD_GROUP_ID_REWARDED === "" || !supportedRef.current) {
        onReward();
        return;
      }
      if (!ready) {
        toast.openToast("광고를 준비 중이에요. 잠시 후 다시 시도해 주세요.");
        load();
        return;
      }

      let rewarded = false;
      try {
        showFullScreenAd({
          options: { adGroupId: AD_GROUP_ID_REWARDED },
          onEvent: (e) => {
            if (e.type === "userEarnedReward") {
              rewarded = true;
              track(EVENT.adRewarded, { context: context ?? "" });
            } else if (e.type === "dismissed") {
              setReady(false);
              load();
              if (rewarded) onReward();
              // 보상 없이 닫았으면 아무 일도 안 일어나요. 왜 안 됐는지 알려줘야 해요.
              else toast.openToast("광고를 끝까지 봐야 이어서 진행돼요.");
            } else if (e.type === "failedToShow") {
              setReady(false);
              load();
              toast.openToast("광고를 띄우지 못했어요. 잠시 후 다시 시도해 주세요.");
            }
          },
          onError: (err) => {
            console.error("광고 표시 실패:", err);
            setReady(false);
            load();
            toast.openToast("광고를 띄우지 못했어요. 잠시 후 다시 시도해 주세요.");
          },
        });
      } catch (err) {
        console.error("광고 표시 실패:", err);
        toast.openToast("광고를 띄우지 못했어요. 잠시 후 다시 시도해 주세요.");
      }
    },
    [ready, load, toast],
  );

  return { ready, watchThen };
}
