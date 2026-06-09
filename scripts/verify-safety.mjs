// 안전 기능 확인: #2 커뮤니티 가이드 고지 / #3 개인정보 경고 / #4 위기 상담 배너
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
await sql("delete from public.profiles; delete from auth.users; alter sequence public.profiles_anon_seq restart with 1;");

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
const p = await ctx.newPage();
const tap = (t) => p.getByRole("button", { name: t }).first().click();
const wait = (t) => p.getByText(t, { exact: false }).first().waitFor({ timeout: 15000 });

await p.goto(BASE, { waitUntil: "networkidle" });
await wait("돛단배");
await tap("시작하기");
await wait("편지를 띄워요");

// #2 커뮤니티 가이드 고지
await wait("따뜻한 항해를 위한 약속");
await p.waitForTimeout(400);
await p.screenshot({ path: "screenshots/18-community-guide.png" });
console.log("📸 18-community-guide.png");

await tap("둘러보기");
await wait("님");
await tap("편지 보내기");
await wait("편지 쓰기");

// #3 개인정보 경고 (전화번호)
await p.locator("textarea").fill("안녕하세요! 제 번호 010-1234-5678 로 연락 주세요.");
await tap("보내기");
await wait("포함된 것 같아요");
await p.waitForTimeout(400);
await p.screenshot({ path: "screenshots/19-personal-info-warning.png" });
console.log("📸 19-personal-info-warning.png");
await tap("수정할게요"); // 취소

// #4 위기 상담 배너 (작성 중 감지)
await p.locator("textarea").fill("요즘 너무 지치고 힘들어요. 가끔 죽고싶다는 생각도 들어요.");
await wait("혼자 견디지 않아도");
await p.waitForTimeout(400);
await p.screenshot({ path: "screenshots/20-crisis-support.png" });
console.log("📸 20-crisis-support.png");

await browser.close();
await sql("delete from public.profiles; delete from auth.users; alter sequence public.profiles_anon_seq restart with 1;");
console.log("✅ done + cleaned");
