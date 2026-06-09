// 채팅 제거 확인: 온보딩 3단계 / 하단탭 3개 / 답장함(채팅버튼 없음)
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:5173/";
const REF = "nezccqxpwejurrekiqxy";
const TOKEN = readFileSync("C:/Users/Mureung/.supabase/access-token", "utf8").trim();
const sql = (q) =>
  fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: q }),
  });
const WIPE =
  "delete from public.chat_messages; delete from public.chat_rooms; delete from public.replies; delete from public.bottles; delete from public.blocks; delete from public.reports; delete from public.profiles; delete from auth.users; alter sequence public.profiles_anon_seq restart with 1;";
await sql(WIPE);

const browser = await chromium.launch();
const opts = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true };
const tap = (p, t) => p.getByRole("button", { name: t }).first().click();
const tapText = (p, t) => p.getByText(t, { exact: false }).first().click();
const wait = (p, t) => p.getByText(t, { exact: false }).first().waitFor({ timeout: 15000 });

const A = await (await browser.newContext(opts)).newPage();
await A.goto(BASE, { waitUntil: "networkidle" });
await wait(A, "돛단배");
await tap(A, "시작하기");
await wait(A, "한 번 답장해요"); // 온보딩 3단계 변경 확인
await A.waitForTimeout(400);
await A.screenshot({ path: "screenshots/21-onboarding-nochat.png" });
console.log("📸 21-onboarding-nochat.png");
await tap(A, "둘러보기");
await wait(A, "님");
await A.waitForTimeout(400);
await A.screenshot({ path: "screenshots/22-home-3tabs.png" });
console.log("📸 22-home-3tabs.png");

// B 생성
const B = await (await browser.newContext(opts)).newPage();
await B.goto(BASE, { waitUntil: "networkidle" });
await wait(B, "돛단배");
await tap(B, "시작하기");
await wait(B, "편지를 띄워요");
await tap(B, "둘러보기");
await wait(B, "님");

// A → B 편지
await tap(A, "편지 보내기");
await wait(A, "편지 쓰기");
await A.locator("textarea").fill("바다 건너 안녕하세요. 좋은 하루 보내세요!");
await tap(A, "보내기");
await wait(A, "편지를 보냈어요");
await tap(A, "홈으로");
await wait(A, "님");

// B: 편지 읽고 답장
await tap(B, "편지 보내기");
await wait(B, "편지 쓰기");
await B.locator("textarea").fill("덕분에 힘이 났어요. 답장 테스트예요, 반가워요!");
// B도 받을 사람(A)이 있으니 보내짐 — 하지만 우리가 원하는 건 B가 A에게 '답장'하는 것.
// 그래서 위 B의 편지는 무시하고, B는 받은편지함에서 A 편지에 답장해요.
await tap(B, "편지 보내기");
await wait(B, "편지를 보냈어요");
await tap(B, "받은 편지함 보기");
await wait(B, "새 편지");
await tapText(B, "바다 건너 안녕");
await B.getByRole("button", { name: "답장 쓰기" }).first().waitFor();
await tap(B, "답장 쓰기");
await wait(B, "답장 쓰기");
await B.locator("textarea").fill("답장 테스트예요. 반가워요! 마음 잘 받았어요 😊");
await tap(B, "답장 보내기");
await wait(B, "님");

// A: 답장함 → 펼치기 (채팅 버튼 없는지 확인)
await A.goto(BASE, { waitUntil: "networkidle" });
await wait(A, "님");
await tap(A, "답장함");
await wait(A, "새 답장");
await tapText(A, "답장 테스트예요");
await wait(A, "한 번의 답장으로 마무리");
await A.waitForTimeout(400);
await A.screenshot({ path: "screenshots/23-replies-nochat.png" });
const hasChatBtn = await A.getByText("채팅", { exact: false }).count();
console.log("📸 23-replies-nochat.png  (채팅 단어 노출:", hasChatBtn, ")");

await browser.close();
await sql(WIPE);
console.log("✅ done + cleaned");
