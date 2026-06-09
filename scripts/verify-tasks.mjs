// 작업1(빈 풀 폴백) + 작업2(첫 채팅 안전 고지) 확인 스크린샷
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:5173/";
const REF = "nezccqxpwejurrekiqxy";
const TOKEN = readFileSync("C:/Users/Mureung/.supabase/access-token", "utf8").trim();

async function sql(query) {
  await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
}
await sql(
  "delete from public.chat_messages; delete from public.chat_rooms; delete from public.replies; delete from public.bottles; delete from public.blocks; delete from public.reports; delete from public.profiles; delete from auth.users; alter sequence public.profiles_anon_seq restart with 1;",
);

const browser = await chromium.launch();
const opts = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const tap = (p, t) => p.getByRole("button", { name: t }).first().click();
const tapText = (p, t) => p.getByText(t, { exact: false }).first().click();
const wait = (p, t) => p.getByText(t, { exact: false }).first().waitFor({ timeout: 15000 });

async function guest(ctx) {
  const p = await ctx.newPage();
  await p.goto(BASE, { waitUntil: "networkidle" });
  await wait(p, "돛단배");
  await tap(p, "시작하기");
  await wait(p, "편지를 띄워요");
  await tap(p, "둘러보기");
  await wait(p, "님");
  return p;
}

const A = await guest(await browser.newContext(opts));
const B = await guest(await browser.newContext(opts)); // 받을 사람 풀 확보(익명, 인구통계 없음)

// ── 작업1: 조건(여성) 지정 → 익명 B는 매칭 안 됨 → 빈 풀 폴백 다이얼로그 ──
await tap(A, "편지 보내기");
await wait(A, "편지 쓰기");
await tap(A, "받을 사람 설정");
await wait(A, "받을 사람 조건");
await A.getByText("여성", { exact: true }).first().click(); // 성별=여성
await tap(A, "적용하기");
await wait(A, "편지 쓰기");
await A.locator("textarea").fill("조건을 걸어 보내볼게요. 받을 사람이 있을까요?");
await tap(A, "보내기"); // 필터 활성 → "광고 보고 보내기" (개발광고 즉시통과) → 0명
await wait(A, "조건에 맞는 사람이 없어요");
await A.waitForTimeout(400);
await A.screenshot({ path: "screenshots/16-empty-pool-fallback.png" });
console.log("📸 16-empty-pool-fallback.png");
await tap(A, "조건 없이 보내기"); // 폴백 발송 → B에게
await wait(A, "편지를 보냈어요");
console.log("✅ 폴백 발송 성공");

// ── 작업2: 첫 채팅 진입 시 안전 고지 ──
// B가 A에게 보내고, B가 A편지 읽고 답장 → A 답장함 → 채팅 시작 → 안전고지
await tap(B, "편지 보내기");
await wait(B, "편지 쓰기");
await B.locator("textarea").fill("안녕하세요, 답장 주고받아요!");
await tap(B, "편지 보내기");
await wait(B, "편지를 보냈어요");
await tap(B, "받은 편지함 보기");
await wait(B, "새 편지");
await tapText(B, "조건을 걸어"); // A가 폴백으로 보낸 편지
await B.getByRole("button", { name: "답장 쓰기" }).first().waitFor();
await tap(B, "답장 쓰기");
await wait(B, "답장 쓰기");
await B.locator("textarea").fill("답장이에요. 반가워요!");
await tap(B, "답장 보내기");
await wait(B, "님");

await A.goto(BASE, { waitUntil: "networkidle" });
await wait(A, "님");
await tap(A, "답장함");
await wait(A, "새 답장");
await tapText(A, "답장이에요");
await wait(A, "받은 답장");
await tap(A, "채팅 시작하기");
await A.waitForTimeout(1500); // 채팅 진입 + 안전고지 렌더 대기
await A.screenshot({ path: "screenshots/17-chat-safety-notice.png" });
const hasNotice = await A.getByText("안전하게 대화해요").count();
console.log("📸 17-chat-safety-notice.png  (안전고지 노출:", hasNotice > 0, ")");

await browser.close();
// 테스트 데이터 정리
await sql(
  "delete from public.chat_messages; delete from public.chat_rooms; delete from public.replies; delete from public.bottles; delete from public.blocks; delete from public.reports; delete from public.profiles; delete from auth.users; alter sequence public.profiles_anon_seq restart with 1;",
);
console.log("✅ done + cleaned");
