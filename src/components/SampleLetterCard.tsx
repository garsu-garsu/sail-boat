import { useState } from "react";

import { Button, Paragraph } from "@toss/tds-mobile";

import { SAMPLE_LETTERS } from "../data/sampleLetters";
import { EVENT, track } from "../lib/analytics";
import { glassCard, ocean } from "../theme";

/**
 * 맛보기 편지 카드.
 * 받은 편지가 아직 없어도 바로 읽을거리가 있게 해줘요.
 * 실제 사용자의 편지가 아니라서 "예시"라고 분명히 표시해요.
 */
export function SampleLetterCard({ context }: { context: string }) {
  const [index, setIndex] = useState(() =>
    Math.floor(Math.random() * SAMPLE_LETTERS.length),
  );
  const letter = SAMPLE_LETTERS[index];

  const handleNext = () => {
    setIndex((prev) => (prev + 1) % SAMPLE_LETTERS.length);
    track(EVENT.samplePeek, { context });
  };

  return (
    <div style={{ ...glassCard, background: ocean.sand, padding: 20 }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 12,
        }}
      >
        <Paragraph typography="t6" fontWeight="bold" color={ocean.ink}>
          🍾 이런 편지가 오가요
        </Paragraph>
        <Paragraph
          display="inline"
          typography="t7"
          fontWeight="semibold"
          color={ocean.ink}
          style={{
            background: "rgba(27,59,111,0.10)",
            borderRadius: 999,
            padding: "3px 10px",
          }}
        >
          예시
        </Paragraph>
      </div>

      <Paragraph
        typography="t6"
        color={ocean.ink}
        style={{ margin: 0, lineHeight: 1.8, wordBreak: "break-word" }}
      >
        {letter.content}
      </Paragraph>

      <Paragraph
        typography="t7"
        color={ocean.ink}
        style={{ margin: "14px 0 0", opacity: 0.6 }}
      >
        {letter.from}
      </Paragraph>

      <div style={{ marginTop: 14 }}>
        <Button
          size="medium"
          display="full"
          color="dark"
          variant="weak"
          onClick={handleNext}
        >
          다른 편지 읽어보기
        </Button>
      </div>
    </div>
  );
}
