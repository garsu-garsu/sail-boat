import { requestNotificationAgreement } from "@apps-in-toss/web-framework";

import { NOTIFY_TEMPLATE_CODE } from "../lib/env";
import { isInTossApp } from "../lib/tossEnv";

export type NotifyConsent =
  | "newAgreement"
  | "alreadyAgreed"
  | "agreementRejected";

/** 알림 동의 요청을 보낼 수 있는 환경인지 (토스 앱 + 템플릿 코드 설정됨) */
export function canRequestNotifyConsent(): boolean {
  return isInTossApp() && NOTIFY_TEMPLATE_CODE !== "";
}

/**
 * 알림 수신 동의 화면을 띄우고 결과를 받아요.
 * 브라우저이거나 템플릿 코드가 없으면 요청하지 않고 null 을 반환해요.
 */
export function requestNotifyConsent(): Promise<NotifyConsent | null> {
  if (!canRequestNotifyConsent()) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const cleanup = requestNotificationAgreement({
        options: { templateCode: NOTIFY_TEMPLATE_CODE },
        onEvent: (result) => {
          resolve(result.type);
          cleanup();
        },
        onError: () => {
          resolve(null);
          cleanup();
        },
      });
    } catch {
      resolve(null);
    }
  });
}
