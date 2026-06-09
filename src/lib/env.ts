// 환경 변수 접근 (Vite). 값은 .env 또는 배포 환경에서 주입돼요.
// SETUP.md 참고.

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? "";
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY ?? "";

/** 광고 그룹 ID (앱인토스 콘솔에서 발급). 비어있으면 광고는 무시되고 콜백만 즉시 실행돼요. */
export const AD_GROUP_ID = import.meta.env.VITE_AD_GROUP_ID ?? "";

/**
 * 알림 수신 동의 템플릿 코드 (앱인토스 콘솔 > 스마트 발송에서 발급).
 * 비어있으면 알림 동의 요청을 건너뛰어요. 코드를 넣으면 데일리 리마인드 등 마케팅 푸시 동의를 받아요.
 */
export const NOTIFY_TEMPLATE_CODE =
  import.meta.env.VITE_NOTIFY_TEMPLATE_CODE ?? "";

export const HAS_SUPABASE = SUPABASE_URL !== "" && SUPABASE_ANON_KEY !== "";
