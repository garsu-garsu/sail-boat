// 환경 변수 접근 (Vite). 값은 .env 또는 배포 환경에서 주입돼요.
// SETUP.md 참고.

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

// 광고 그룹 ID (앱인토스 콘솔 > 수익화 > 인앱광고에서 광고 유형별로 발급).
// 비어있으면 해당 광고는 무시돼요(보상형은 콜백을 즉시 실행해 개발/브라우저에서도 흐름이 끊기지 않아요).
const LEGACY_AD_GROUP_ID = import.meta.env.VITE_AD_GROUP_ID ?? "";

/** 배너 광고 그룹 ID (TossAds.attachBanner). 비어있으면 배너를 렌더링하지 않아요. */
export const AD_GROUP_ID_BANNER = import.meta.env.VITE_AD_GROUP_ID_BANNER ?? "";

/** 이미지 강조형 배너 광고 그룹 ID. 각 화면 본문 맨 아래에 붙는 지면이에요. */
export const AD_GROUP_ID_BANNER_IMAGE =
  import.meta.env.VITE_AD_GROUP_ID_BANNER_IMAGE ?? "";

/** 전면형 광고 그룹 ID (loadFullScreenAd). 비어있으면 전면 광고를 건너뛰어요. */
export const AD_GROUP_ID_INTERSTITIAL =
  import.meta.env.VITE_AD_GROUP_ID_INTERSTITIAL ?? "";

/**
 * 보상형 광고 그룹 ID (loadFullScreenAd + userEarnedReward).
 * 구버전 변수명(VITE_AD_GROUP_ID)을 폴백으로 둬서 기존 설정과 호환돼요.
 */
export const AD_GROUP_ID_REWARDED =
  import.meta.env.VITE_AD_GROUP_ID_REWARDED ?? LEGACY_AD_GROUP_ID;

/** @deprecated AD_GROUP_ID_REWARDED 를 사용하세요. (구버전 호환용 별칭) */
export const AD_GROUP_ID = AD_GROUP_ID_REWARDED;

/**
 * 알림 수신 동의 템플릿 코드 (앱인토스 콘솔 > 스마트 발송에서 발급).
 * 비어있으면 알림 동의 요청을 건너뛰어요. 코드를 넣으면 데일리 리마인드 등 마케팅 푸시 동의를 받아요.
 */
export const NOTIFY_TEMPLATE_CODE =
  import.meta.env.VITE_NOTIFY_TEMPLATE_CODE ?? "";

export const HAS_SUPABASE = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";
