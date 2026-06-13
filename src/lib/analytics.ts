// 분석 이벤트 로깅 — 앱인토스 콘솔 "분석"(이벤트/전환 지표) 대시보드로 흘러가요.
// eventLog 는 init 없이 동작하고, 샌드박스에서는 콘솔에, 실서비스에서는 로그 시스템에 기록돼요.
// 브라우저(둘러보기)·미지원 환경에서는 조용히 무시해요.
import { eventLog } from "@apps-in-toss/web-framework";

type Primitive = string | number | boolean;
type Params = Record<string, Primitive | null | undefined>;
type LogType = "event" | "screen" | "click" | "impression";

/** undefined/null 값을 제거해 eventLog 규격(Record<string, Primitive>)으로 정리 */
function clean(params: Params): Record<string, Primitive> {
  const out: Record<string, Primitive> = {};
  for (const [k, v] of Object.entries(params)) {
    if (v != null) out[k] = v;
  }
  return out;
}

/** 커스텀 이벤트 기록 (퍼널 단계, 행동 등) */
export function track(
  name: string,
  params: Params = {},
  type: LogType = "event",
): void {
  try {
    void eventLog({ log_name: name, log_type: type, params: clean(params) }).catch(
      () => {},
    );
  } catch {
    /* 미지원 환경 무시 */
  }
}

/** 화면 조회 기록 (route 이름) */
export function trackScreen(name: string, params: Params = {}): void {
  track(`screen_${name}`, params, "screen");
}

// 퍼널 이벤트 이름 (전환 지표 설정 시 이 이름으로 단계 정의)
export const EVENT = {
  signup: "signup_complete", // params: { method: 'toss' | 'guest' }
  bottleSent: "bottle_sent", // params: { zone, has_filter, fallback }
  noRecipient: "bottle_send_no_recipient", // params: { has_filter }
  replySent: "reply_sent",
  chatStarted: "chat_started",
  chatMessageSent: "chat_message_sent",
  shareCompleted: "share_completed", // params: { context }
  adRewarded: "ad_rewarded", // params: { context }
  adInterstitial: "ad_interstitial_shown", // params: { context }
  adBannerImpression: "ad_banner_impression", // params: { slot }
  reportSubmitted: "report_submitted", // params: { type }
  loginUpsellClick: "login_upsell_click", // params: { subject }
  notifyConsent: "notify_consent", // params: { result }
} as const;
