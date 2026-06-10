// 데모 GIF 생성 — Playwright로 핵심 플로우를 "영상"으로 녹화한 뒤 ffmpeg로 GIF 변환해요.
// 각 화면을 충분히 머무르고 타이핑도 애니메이션으로 보여줘서 전환이 천천히 읽혀요.
// 사전조건: dev 서버(http://localhost:5173) 실행, DB 비운 상태.
// 출력: docs/demo.gif
import { chromium } from "playwright";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { execFileSync } from "node:child_process";
import { rmSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const FFMPEG = ffmpegInstaller.path;
const BASE = "http://localhost:5173/";
const TMP = "docs/.demo-tmp";
const OUT = "docs/demo.gif";
const VIEWPORT = { width: 360, height: 760 };

// GIF 화질/크기 파라미터
const FPS = 12;
const WIDTH = 320; // 짝수 (ffmpeg 요구)

mkdirSync("docs", { recursive: true });
mkdirSync(TMP, { recursive: true });

// 주의: Playwright 스크린캐스트는 CSS 픽셀 기준으로만 캡처돼요 (deviceScaleFactor 올려도 영상 해상도는 안 올라감).
const ctxOpts = { viewport: VIEWPORT, deviceScaleFactor: 1, isMobile: true, hasTouch: true };

const tap = async (page, text) => {
  const btn = page.getByRole("button", { name: text }).first();
  if (await btn.count()) return btn.click();
  return page.getByText(text, { exact: false }).first().click();
};
const tapText = (page, text) =>
  page.getByText(text, { exact: false }).first().click();
const wait = (page, text, t = 15000) =>
  page.getByText(text, { exact: false }).first().waitFor({ timeout: t });
const waitBtn = (page, name, t = 15000) =>
  page.getByRole("button", { name }).first().waitFor({ timeout: t });
const hold = (page, ms) => page.waitForTimeout(ms);
const type = (page, text) =>
  page.locator("textarea").type(text, { delay: 50 }); // 애니메이션 타이핑

const browser = await chromium.launch();

// ── A: 녹화 대상 컨텍스트 ──
const ctxA = await browser.newContext({
  ...ctxOpts,
  recordVideo: { dir: TMP, size: VIEWPORT },
});
const A = await ctxA.newPage();
const video = A.video();
const t0 = performance.now(); // 영상 시작 기준점

await A.goto(BASE, { waitUntil: "networkidle" });
await wait(A, "돛단배");
await hold(A, 400); // 첫 화면 완전히 렌더
const tStart = (performance.now() - t0) / 1000; // 이 시점 이전(로딩 흰 화면)은 잘라내요
await hold(A, 2500); // 시작 화면 — 읽을 시간
await tap(A, "시작하기");
await wait(A, "편지를 띄워요");
await hold(A, 4200); // 온보딩 — 컨셉 읽을 시간
await tap(A, "둘러보기");
await wait(A, "님");
await hold(A, 3000); // 홈

// ── B: 상대 (녹화 안 함) ──
const ctxB = await browser.newContext(ctxOpts);
const B = await ctxB.newPage();
await B.goto(BASE, { waitUntil: "networkidle" });
await wait(B, "돛단배");
await tap(B, "시작하기");
await wait(B, "편지를 띄워요");
await tap(B, "둘러보기");
await wait(B, "님");

// ── A: 편지 쓰기 (받을 사람 → 작성 → 전송) ──
await tap(A, "편지 보내기");
await wait(A, "편지 쓰기");
await hold(A, 2500); // 빈 작성 화면
await tap(A, "받을 사람 설정");
await wait(A, "받을 사람 조건");
await hold(A, 3500); // 필터
await tap(A, "적용하기");
await wait(A, "편지 쓰기");
await hold(A, 1000);
await type(A, "바다 건너 어딘가의 당신께,\n오늘 하루도 평안하시길 바라요. 🌊");
await hold(A, 2500); // 작성 완료
await tap(A, "편지 보내기");
await wait(A, "편지를 보냈어요");
await hold(A, 3500); // 띄움 연출
await tap(A, "홈으로");
await wait(A, "님");
await hold(A, 1500);

// B가 답장하는 동안 A는 홈에서 대기 → 이 구간은 GIF 에서 잘라내요.
const idleStart = (performance.now() - t0) / 1000;

// ── B: A 편지에 답장 ──
await tap(B, "편지 보내기");
await wait(B, "편지 쓰기");
await B.locator("textarea").fill("유리병 편지 너무 낭만적이에요! 좋은 하루 보내세요. ⛵");
await tap(B, "편지 보내기");
await wait(B, "편지를 보냈어요");
await tap(B, "받은 편지함 보기");
await wait(B, "새 편지");
await tapText(B, "바다 건너");
await waitBtn(B, "답장 쓰기");
await tap(B, "답장 쓰기");
await wait(B, "답장 쓰기");
await B.locator("textarea").fill("편지 잘 받았어요. 따뜻한 마음 감사해요. 저도 평안한 하루 보낼게요. 😊");
await tap(B, "답장 보내기");
await wait(B, "님");
const idleEnd = (performance.now() - t0) / 1000;

// ── A: 받은 편지함 → 읽기 → 답장 작성 ──
await A.goto(BASE, { waitUntil: "networkidle" });
await wait(A, "님");
await tap(A, "받은 편지함");
await wait(A, "새 편지");
await hold(A, 3000); // 받은 편지함
await tapText(A, "유리병 편지");
await waitBtn(A, "답장 쓰기");
await hold(A, 4000); // 편지 읽기
await tap(A, "답장 쓰기");
await wait(A, "답장 쓰기");
await hold(A, 800);
await type(A, "답장 고마워요! 당신도 좋은 밤 보내세요.");
await hold(A, 3000); // 답장 작성

// ── A: 답장함 → 펼치기 ──
await A.goto(BASE, { waitUntil: "networkidle" });
await wait(A, "님");
await tap(A, "답장함");
await wait(A, "새 답장");
await hold(A, 3000); // 답장함 목록
await tapText(A, "편지 잘 받았어요");
await wait(A, "받은 답장");
await hold(A, 4500); // 답장 펼침 (마무리, 길게)

// 녹화 종료 → 영상 파일 확정
await ctxB.close();
await ctxA.close();
await browser.close();
const webm = await video.path();
console.log("🎬 녹화 완료:", webm);

// ── ffmpeg 2-pass: 고품질 팔레트 GIF (B 대기 구간 잘라냄) ──
const palette = join(TMP, "palette.png");
// fps 고정 → 대기 구간(select) 제거 → 남은 프레임 재타이밍 → 스케일
const cut = `select='gte(t,${tStart.toFixed(2)})*not(between(t,${idleStart.toFixed(2)},${idleEnd.toFixed(2)}))',setpts=N/${FPS}/TB`;
const vf = `fps=${FPS},${cut},scale=${WIDTH}:-1:flags=lanczos`;
console.log(`✂️  대기 구간 제거: ${idleStart.toFixed(1)}s ~ ${idleEnd.toFixed(1)}s`);
execFileSync(FFMPEG, [
  "-y", "-i", webm,
  "-vf", `${vf},palettegen=max_colors=256:stats_mode=diff`,
  palette,
], { stdio: "inherit" });
execFileSync(FFMPEG, [
  "-y", "-i", webm, "-i", palette,
  "-filter_complex", `${vf}[x];[x][1:v]paletteuse=dither=bayer:bayer_scale=3`,
  "-loop", "0",
  OUT,
], { stdio: "inherit" });

// 임시 파일 정리
rmSync(TMP, { recursive: true, force: true });
console.log(`✅ ${OUT} (${WIDTH}px, ${FPS}fps)`);
