import { getTossShareLink, share } from "@apps-in-toss/web-framework";

import { isInTossApp } from "../lib/tossEnv";

const SHARE_TEXT =
  "낯선 누군가에게 익명 편지를 띄우고, 랜덤으로 편지를 받아요 🌊 유리병 편지 앱 [돛단배]";

// getTossShareLink 는 `intoss://` 로 시작하는 딥링크만 받아요. "/" 같은 웹 경로를 주면
// 링크가 만들어지지 않아 텍스트만 공유돼요. appName(apps-in-toss.config.ts) 과 같아야 해요.
const DEEP_LINK = "intoss://sailboat";
const OG_IMAGE =
  "https://static.toss.im/appsintoss/13203/b1d22d57-56c1-4ccf-8fdf-c1c44fba457a.png";

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
      link = await getTossShareLink(DEEP_LINK, OG_IMAGE);
    } catch (e) {
      // 링크 생성 실패해도 텍스트만으로 공유는 계속 진행해요.
      // 조용히 삼키면 링크가 빠진 걸 모르니 로그는 남겨요.
      console.error("공유 링크 생성 실패:", e);
    }
    const message = link !== "" ? `${SHARE_TEXT}\n${link}` : SHARE_TEXT;
    await share({ message });
    return true;
  } catch {
    return false;
  }
}
