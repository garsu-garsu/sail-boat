import { Button, Paragraph } from "@toss/tds-mobile";

import { ScreenLayout } from "../../components/ScreenLayout";
import { useRouter } from "../../router";
import { boatEmoji, bottleEmoji, ocean, waveEmoji } from "../../theme";

const FLOAT_KEYFRAMES = `
@keyframes sailboat-drift {
  0%   { transform: translateX(-8px) translateY(0) rotate(-3deg); }
  50%  { transform: translateX(8px) translateY(-6px) rotate(3deg); }
  100% { transform: translateX(-8px) translateY(0) rotate(-3deg); }
}
@keyframes sailboat-wave {
  0%, 100% { transform: translateY(0); opacity: 0.85; }
  50%      { transform: translateY(-4px); opacity: 1; }
}
`;

export function FloatedScreen() {
  const { reset } = useRouter();

  return (
    <ScreenLayout background="deep">
      <style>{FLOAT_KEYFRAMES}</style>
      <div
        style={{
          flex: 1,
          minHeight: "60dvh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          textAlign: "center",
          gap: 8,
          padding: "24px 8px",
        }}
      >
        {/* 떠가는 유리병/돛단배 연출 */}
        <div
          style={{
            fontSize: 64,
            lineHeight: 1.2,
            animation: "sailboat-drift 3.5s ease-in-out infinite",
          }}
        >
          {bottleEmoji}
          {boatEmoji}
        </div>
        <div
          style={{
            fontSize: 32,
            animation: "sailboat-wave 2.4s ease-in-out infinite",
          }}
        >
          {waveEmoji}
          {waveEmoji}
          {waveEmoji}
        </div>

        <Paragraph
          as="h2"
          typography="t4"
          fontWeight="bold"
          color={ocean.white}
          textAlign="center"
          style={{ margin: "20px 0 0" }}
        >
          편지를 보냈어요!
        </Paragraph>
        <Paragraph
          typography="t6"
          color={ocean.white}
          textAlign="center"
          style={{ margin: "8px 0 0", lineHeight: 1.6, opacity: 0.9 }}
        >
          바다 건너 누군가에게 닿았어요. 답장이 올지도 몰라요. {waveEmoji}
        </Paragraph>
      </div>

      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
          padding: "0 20px",
          paddingBottom: "max(12px, env(safe-area-inset-bottom))",
        }}
      >
        <Button
          size="xlarge"
          display="full"
          onClick={() => reset({ name: "receive" })}
        >
          받은 편지함 보기
        </Button>
        <Button
          size="xlarge"
          display="full"
          color="dark"
          variant="weak"
          onClick={() => reset({ name: "home" })}
        >
          홈으로
        </Button>
      </div>
    </ScreenLayout>
  );
}
