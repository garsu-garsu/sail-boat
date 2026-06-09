// 돛단배 전체 화면 스크린샷 — Playwright
// 익명 사용자 두 명(A↔B)으로 실제 플로우를 돌려 데이터가 있는 화면까지 캡처해요.
// 사전조건: dev 서버(http://localhost:5173) 실행, Supabase .env 설정, DB 비운 상태(익명 2명만 생성).
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";

const BASE = "http://localhost:5173/";
const OUT = "screenshots";
mkdirSync(OUT, { recursive: true });

const VIEWPORT = { width: 390, height: 844 };
let n = 0;

async function shot(page, name) {
  n += 1;
  const file = `${OUT}/${String(n).padStart(2, "0")}-${name}.png`;
  await page.waitForTimeout(450);
  await page.screenshot({ path: file });
  console.log("📸", file);
}

/** 텍스트(부분일치)를 포함한 버튼/요소 클릭 */
async function tap(page, text) {
  const btn = page.getByRole("button", { name: text }).first();
  if (await btn.count()) {
    await btn.click();
    return;
  }
  await page.getByText(text, { exact: false }).first().click();
}

/** 일반 텍스트 클릭 (리스트 행 등) */
async function tapText(page, text) {
  await page.getByText(text, { exact: false }).first().click();
}

async function waitText(page, text, timeout = 15000) {
  await page.getByText(text, { exact: false }).first().waitFor({ timeout });
}

async function waitBtn(page, name, timeout = 15000) {
  await page.getByRole("button", { name }).first().waitFor({ timeout });
}

/** 새 익명 사용자로 입장 (home(게스트) → 온보딩 → 둘러보기 → home) */
async function enterGuest(page, { capture = false } = {}) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await waitText(page, "돛단배");
  if (capture) await shot(page, "home-guest");
  await tap(page, "시작하기");
  await waitText(page, "편지를 띄워요");
  if (capture) await shot(page, "onboarding");
  await tap(page, "둘러보기");
  await waitText(page, "님"); // home 로그인 상태
}

/** 새로고침으로 홈(탭 화면)으로 복귀 — 세션은 localStorage 로 유지돼요 */
async function gotoHome(page) {
  await page.goto(BASE, { waitUntil: "networkidle" });
  await waitText(page, "님");
}

const browser = await chromium.launch();
const ctxOpts = {
  viewport: VIEWPORT,
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
};

// ── 사용자 A (주 캡처 대상) ──
const ctxA = await browser.newContext(ctxOpts);
const A = await ctxA.newPage();
await enterGuest(A, { capture: true }); // 01 home-guest, 02 onboarding
await shot(A, "home"); // 03 home

// ── 사용자 B (상대) 먼저 생성 ──
const ctxB = await browser.newContext(ctxOpts);
const B = await ctxB.newPage();
await enterGuest(B);

// ── A: 편지 쓰기 / 받을 사람 조건 / 보내기(→B) ──
await tap(A, "편지 보내기");
await waitText(A, "편지 쓰기");
await shot(A, "compose"); // 04 compose
await tap(A, "받을 사람 설정");
await waitText(A, "받을 사람 조건");
await shot(A, "filter"); // 05 filter
await tap(A, "적용하기");
await waitText(A, "편지 쓰기");
await A.locator("textarea").fill(
  "안녕하세요, 처음 띄워보는 편지예요. 오늘 하루도 평안하시길 바라요. 🌊",
);
await tap(A, "편지 보내기");
await waitText(A, "편지를 보냈어요");
await shot(A, "floated"); // 06 floated
await tap(A, "홈으로");
await waitText(A, "님");

// ── B: A에게 편지 보내기 → A 편지 읽고 답장 ──
await tap(B, "편지 보내기");
await waitText(B, "편지 쓰기");
await B.locator("textarea").fill(
  "유리병 편지 너무 낭만적이네요! 답장 기다릴게요. 좋은 하루 보내세요. ⛵",
);
await tap(B, "편지 보내기");
await waitText(B, "편지를 보냈어요");
await tap(B, "받은 편지함 보기");
await waitText(B, "새 편지");
await tapText(B, "처음 띄워보는"); // A 편지 행 클릭
await waitBtn(B, "답장 쓰기");
await tap(B, "답장 쓰기");
await waitText(B, "답장 쓰기");
await B.locator("textarea").fill(
  "편지 잘 받았어요. 저도 반가워요! 따뜻한 마음 감사해요. 😊",
);
await tap(B, "답장 보내기");
await waitText(B, "님");

// ── A: 받은 편지함(데이터 O) → 읽기 → 답장쓰기 ──
await gotoHome(A);
await tap(A, "받은 편지함");
await waitText(A, "새 편지");
await shot(A, "receive"); // 07 receive
await tapText(A, "유리병 편지"); // B 편지 행 클릭
await waitBtn(A, "답장 쓰기");
await shot(A, "read"); // 08 read
await tap(A, "답장 쓰기");
await waitText(A, "답장 쓰기");
await A.locator("textarea").fill("답장 고마워요! 잘 지내고 계신가요?");
await shot(A, "reply"); // 09 reply (전송 안 함)

// ── A: 답장함(데이터 O) → 펼치기 (1회 답장으로 교류 종료, 채팅 없음) ──
await gotoHome(A);
await tap(A, "답장함");
await waitText(A, "새 답장");
await shot(A, "replies"); // 10 replies
await tapText(A, "편지 잘 받았어요"); // 답장 행 펼치기
await waitText(A, "받은 답장");
await shot(A, "replies-expanded"); // 11 replies-expanded (답장+원본+마무리 안내)

await browser.close();
console.log(`\n✅ 완료: ${n}장 → ${OUT}/`);
