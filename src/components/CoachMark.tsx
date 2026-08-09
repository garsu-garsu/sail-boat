import { useEffect, useState, type RefObject } from "react";
import { createPortal } from "react-dom";

import { ocean } from "../theme";

const PAD = 6;

/**
 * 온보딩 코치마크 — 대상만 남기고 화면을 어둡게 덮어요.
 *
 * 덮개는 `pointer-events: none`이라 클릭이 그대로 통과하고, 진행은 화면이 창
 * 전체에서 가로챕니다. 건너뛰기만 실제로 눌려야 해서 그 버튼만 `pointer-events: auto`로 되돌려요.
 */
export function CoachMark({
  targetRef,
  message,
  index,
  total,
  onSkip,
}: {
  targetRef: RefObject<HTMLElement | null>;
  message: string;
  index: number;
  total: number;
  onSkip: () => void;
}) {
  const [rect, setRect] = useState<DOMRect | null>(null);

  useEffect(() => {
    // 단계가 바뀌면 이전 단계 위치는 버리고 새로 찾아요.
    setRect(null);
    const update = () => {
      const el = targetRef.current;
      // 리렌더 사이에 ref 가 잠깐 비는 구간이 있어요. 그때 위치를 지우면
      // 구멍이 깜빡이며 사라지니, 못 찾은 프레임은 그냥 넘깁니다.
      if (el == null) return;
      const next = el.getBoundingClientRect();
      setRect((prev) =>
        prev != null &&
        prev.top === next.top &&
        prev.left === next.left &&
        prev.width === next.width &&
        prev.height === next.height
          ? prev
          : next,
      );
    };

    // 매 프레임 따라가요. 대상이 부드러운 스크롤로 움직이는 중일 수도 있어서
    // 시간을 정해두고 멈추면 영영 못 찾습니다. 투어 중에만 붙어 있어 비용은 작아요.
    let raf = 0;
    const tick = () => {
      update();
      raf = requestAnimationFrame(tick);
    };
    tick();

    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [targetRef]);

  if (rect == null) return null;

  // 문구·진행표시·건너뛰기를 합치면 100px 쯤 돼요. 그만큼 위가 비어 있을 때만
  // 위에 두고, 아니면 아래에 둡니다. (기준이 낮으면 화면 제목과 겹쳐요)
  const above = rect.top > 130;

  return createPortal(
    <div style={{ position: "fixed", inset: 0, zIndex: 1000, pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute",
          top: rect.top - PAD,
          left: rect.left - PAD,
          width: rect.width + PAD * 2,
          height: rect.height + PAD * 2,
          borderRadius: 20,
          boxShadow: "0 0 0 9999px rgba(20,18,16,0.62)",
        }}
      />
      <div
        style={{
          position: "absolute",
          top: above ? rect.top - PAD - 104 : rect.bottom + PAD + 14,
          left: 16,
          right: 16,
          textAlign: "center",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "#FFFFFF",
            fontSize: 16,
            fontWeight: 700,
            lineHeight: 1.4,
            textShadow: "0 1px 6px rgba(0,0,0,0.55)",
          }}
        >
          {message}
        </p>
        <p
          style={{
            margin: "8px 0 0",
            color: "rgba(255,255,255,0.75)",
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          {index + 1} / {total}
        </p>
        <button
          type="button"
          data-tour-skip
          onClick={(event) => {
            event.stopPropagation();
            onSkip();
          }}
          style={{
            pointerEvents: "auto",
            marginTop: 10,
            border: "none",
            background: "none",
            padding: 8,
            fontSize: 14,
            fontWeight: 600,
            color: ocean.white,
            textDecoration: "underline",
            cursor: "pointer",
          }}
        >
          건너뛰기
        </button>
      </div>
    </div>,
    document.body,
  );
}
