import { Paragraph } from "@toss/tds-mobile";

import { glassCard, ocean } from "../../theme";

/**
 * 위기(자해·자살) 신호가 감지된 편지/작성 내용 옆에 보여주는 상담 안내 배너.
 * 차단하지 않고, 도움받을 수 있는 정보를 부드럽게 안내해요.
 */
export function SupportNotice() {
  return (
    <div
      style={{
        ...glassCard,
        marginTop: 12,
        display: "flex",
        gap: 12,
        alignItems: "flex-start",
        padding: 16,
      }}
    >
      <div style={{ fontSize: 24, lineHeight: 1 }}>🫶</div>
      <div style={{ flex: 1 }}>
        <Paragraph typography="t6" fontWeight="bold" color={ocean.ink}>
          혼자 견디지 않아도 괜찮아요
        </Paragraph>
        <Paragraph
          typography="t7"
          color={ocean.ink}
          style={{ marginTop: 4, lineHeight: 1.6, opacity: 0.8 }}
        >
          힘든 마음이 든다면 언제든 이야기할 수 있어요.
          <br />
          자살예방 상담전화{" "}
          <a
            href="tel:109"
            style={{ color: ocean.primary, fontWeight: 700 }}
          >
            ☎ 109
          </a>{" "}
          (24시간)
        </Paragraph>
      </div>
    </div>
  );
}
