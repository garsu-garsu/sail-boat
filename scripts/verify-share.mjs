// 공유 구간(10~14건) compose UI 확인용 스크린샷
import { chromium } from "playwright";
import { readFileSync } from "node:fs";

const BASE = "http://localhost:5173/";
const REF = "nezccqxpwejurrekiqxy";
const TOKEN = readFileSync("C:/Users/Mureung/.supabase/access-token", "utf8").trim();

async function sql(query) {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: { Authorization: `Bearer ${TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  return r.json();
}

// 깨끗이 비우기
await sql(
  "delete from public.chat_messages; delete from public.chat_rooms; delete from public.replies; delete from public.bottles; delete from public.blocks; delete from public.reports; delete from public.profiles; delete from auth.users; alter sequence public.profiles_anon_seq restart with 1;",
);

const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
  isMobile: true,
  hasTouch: true,
});
const page = await ctx.newPage();

await page.goto(BASE, { waitUntil: "networkidle" });
await page.getByText("돛단배").first().waitFor();
await page.getByRole("button", { name: "시작하기" }).click();
await page.getByText("편지를 띄워요").first().waitFor();
await page.getByRole("button", { name: "둘러보기" }).click();
await page.getByText("님").first().waitFor();

// 로그인된 익명 사용자 uid 추출 (supabase localStorage)
const uid = await page.evaluate((ref) => {
  const raw = window.localStorage.getItem(`sb-${ref}-auth-token`);
  if (!raw) return null;
  const obj = JSON.parse(raw);
  return obj?.user?.id ?? obj?.currentSession?.user?.id ?? null;
}, REF);
console.log("uid =", uid);

// 오늘 12통 심기 (author=uid, recipient=uid). 공유 구간(12/15)으로 만들기
await sql(
  `insert into public.bottles (author_id, recipient_id, content)
   select '${uid}', '${uid}', '시드 편지 ' || g
   from generate_series(1, 12) g;`,
);

// compose 진입 → 공유 버튼/안내 확인
await page.goto(BASE, { waitUntil: "networkidle" });
await page.getByText("님").first().waitFor();
await page.getByRole("button", { name: "편지 보내기" }).click();
await page.getByText("편지 쓰기").first().waitFor();
await page.waitForTimeout(700);
await page.screenshot({ path: "screenshots/15-compose-share.png" });
console.log("📸 screenshots/15-compose-share.png");

await browser.close();
