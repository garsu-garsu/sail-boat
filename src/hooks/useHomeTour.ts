import { useCallback, useState } from "react";

const KEY = "sailboat:home_tour_done";

/**
 * 첫 방문에만 도는 홈 화면 코치마크. 화면 아무 곳이나 누르면 다음 단계로 넘어가요.
 * 저장 자체가 막힌 환경(프라이빗 모드 등)에서는 매번 뜨는 걸 막기 위해
 * 읽기 실패를 "이미 봤음"으로 처리해요.
 */
export function useHomeTour(steps: string[]) {
  const [index, setIndex] = useState(() => {
    try {
      return localStorage.getItem(KEY) != null ? -1 : 0;
    } catch {
      return -1;
    }
  });

  const skip = useCallback(() => {
    try {
      localStorage.setItem(KEY, "1");
    } catch {
      /* noop */
    }
    setIndex(-1);
  }, []);

  const next = useCallback(() => {
    setIndex((prev) => {
      if (prev < 0) return prev;
      const nextIndex = prev + 1;
      if (nextIndex >= steps.length) {
        try {
          localStorage.setItem(KEY, "1");
        } catch {
          /* noop */
        }
        return -1;
      }
      return nextIndex;
    });
  }, [steps.length]);

  return {
    current: index >= 0 ? steps[index] : undefined,
    index,
    total: steps.length,
    next,
    skip,
  };
}
