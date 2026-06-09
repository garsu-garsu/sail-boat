import { getTossShareLink, share } from "@apps-in-toss/web-framework";

import { isInTossApp } from "../lib/tossEnv";

const SHARE_TEXT = "바다 건너 누군가에게 마음을 담은 편지를 띄워보세요 🌊 [돛단배]";

/**
 * 앱을 공유해요. (토스 공유 링크 + 메시지 공유)
 * 공유 시트가 정상적으로 뜨고 끝나면 true 를 반환해요.
 * 브라우저(둘러보기)에서는 공유 SDK가 없으니 개발 편의상 통과(true)해요.
 *
 * 한계: "실제로 친구에게 보냈는지"는 검증할 수 없어요. 공유 시트 완료를 성공으로 봐요.
 */
export async function shareApp(): Promise<boolean> {
  if (!isInTossApp()) return true; // 브라우저 개발 환경
  try {
    let link = "";
    try {
      link = await getTossShareLink("/");
    } catch {
      // 링크 생성 실패해도 텍스트만으로 공유는 계속 진행해요.
    }
    const message = link !== "" ? `${SHARE_TEXT}\n${link}` : SHARE_TEXT;
    await share({ message });
    return true;
  } catch {
    return false;
  }
}
