// 돛단배 공통 비주얼 토큰 (바다/유리병 컨셉)
import { colors } from "@toss/tds-colors";

export const ocean = {
  /** 화면 배경 그라데이션 (위: 하늘, 아래: 바다) */
  skyToSea: "linear-gradient(180deg, #BBE1FA 0%, #6FB7E0 45%, #2E6CA4 100%)",
  deepSea: "linear-gradient(180deg, #2E6CA4 0%, #1B3B6F 100%)",
  sand: "#F3E9D2",
  foam: "rgba(255,255,255,0.85)",
  bottleGlass: "rgba(178, 222, 247, 0.55)",
  primary: "#9575CD", // granite.config primaryColor 와 동일
  white: colors.white,
  ink: "#1B3B6F",
};

/** 화면 전체를 덮는 바다 배경 스타일 */
export const screenBackground: React.CSSProperties = {
  minHeight: "100dvh",
  background: ocean.skyToSea,
  display: "flex",
  flexDirection: "column",
};

/** 콘텐츠 카드 (반투명 글래스) */
export const glassCard: React.CSSProperties = {
  background: ocean.foam,
  borderRadius: 24,
  padding: 20,
  boxShadow: "0 8px 24px rgba(27,59,111,0.18)",
};

export const bottleEmoji = "🍾";
export const waveEmoji = "🌊";
export const boatEmoji = "⛵";
