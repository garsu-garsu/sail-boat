// 데모 GIF 생성 — Playwright로 핵심 플로우 프레임을 캡처해 gifenc로 인코딩해요.
// 사전조건: dev 서버(http://localhost:5173) 실행, DB 비운 상태.
// 출력: docs/demo.gif
import { chromium } from "playwright";
import { PNG } from "pngjs";
import gifenc from "gifenc";
const { GIFEncoder, quantize, applyPalette } = gifenc;
import { writeFileSync, mkdirSync } from "node:fs";

const BASE = "http://localhost:5173/";
const OUT = "docs/demo.gif";
const VIEWPORT = { width: 360, height: 760 };
const TARGET_W = 300; // 다운스케일 폭 (파일 크기 절감)

mkdirSync("docs", { recursive: true });

const frames = []; // { buf, delay }
const cap = async (page, delay = 700) => {
  frames.push({ buf: await page.screenshot(), delay });
};

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

const browser = await chromium.launch();
const ctxOpts = { viewport: VIEWPORT, deviceScaleFactor: 1, isMobile: true, hasTouch: true };

// ── 사용자 A (촬영 대상) ──
const A = await (await browser.newContext(ctxOpts)).newPage();
await A.goto(BASE, { waitUntil: "networkidle" });
await wait(A, "돛단배");
await tap(A, "시작하기");
await wait(A, "편지를 띄워요");
await cap(A, 1600); // 온보딩 (오래 보여주기)
await tap(A, "둘러보기");
await wait(A, "님");
await cap(A, 900); // 홈

// ── 사용자 B (상대, 화면 밖) ──
const B = await (await browser.newContext(ctxOpts)).newPage();
await B.goto(BASE, { waitUntil: "networkidle" });
await wait(B, "돛단배");
await tap(B, "시작하기");
await wait(B, "편지를 띄워요");
await tap(B, "둘러보기");
await wait(B, "님");

// ── A: 편지 쓰기 (받을 사람 선택 → 작성 → 전송) ──
await tap(A, "편지 보내기");
await wait(A, "편지 쓰기");
await cap(A, 700); // 빈 작성 화면
await tap(A, "받을 사람 설정");
await wait(A, "받을 사람 조건");
await cap(A, 1100); // 필터
await tap(A, "적용하기");
await wait(A, "편지 쓰기");
// 필터에서 돌아온 뒤 작성 (돌아오면 textarea 가 초기화돼요)
await A.locator("textarea").fill("바다 건너 어딘가의 당신께,");
await cap(A, 500);
await A.locator("textarea").fill(
  "바다 건너 어딘가의 당신께,\n오늘 하루도 평안하시길 바라요. 🌊",
);
await cap(A, 1000); // 작성 완료
await tap(A, "편지 보내기");
await wait(A, "편지를 보냈어요");
await cap(A, 1500); // 띄움 연출
await tap(A, "홈으로");
await wait(A, "님");

// ── B: A에게 편지 → A 편지에 답장 ──
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

// ── A: 받은 편지함 → 읽기 ──
await A.goto(BASE, { waitUntil: "networkidle" });
await wait(A, "님");
await tap(A, "받은 편지함");
await wait(A, "새 편지");
await cap(A, 900); // 받은 편지함
await tapText(A, "유리병 편지");
await waitBtn(A, "답장 쓰기");
await cap(A, 1500); // 편지 읽기
await tap(A, "답장 쓰기");
await wait(A, "답장 쓰기");
await A.locator("textarea").fill("답장 고마워요! 당신도 좋은 밤 보내세요.");
await cap(A, 1300); // 답장 작성

// ── A: 답장함 → 펼치기 ──
await A.goto(BASE, { waitUntil: "networkidle" });
await wait(A, "님");
await tap(A, "답장함");
await wait(A, "새 답장");
await cap(A, 800); // 답장함 목록
await tapText(A, "편지 잘 받았어요");
await wait(A, "받은 답장");
await cap(A, 2000); // 답장 펼침 (마무리, 길게)

await browser.close();
console.log(`🎬 ${frames.length} 프레임 캡처`);

// ── 다운스케일 (nearest) ──
function scaleRGBA(src, sw, sh, dw, dh) {
  const dst = new Uint8Array(dw * dh * 4);
  for (let y = 0; y < dh; y++) {
    const sy = Math.min(sh - 1, ((y * sh) / dh) | 0);
    for (let x = 0; x < dw; x++) {
      const sx = Math.min(sw - 1, ((x * sw) / dw) | 0);
      const si = (sy * sw + sx) * 4;
      const di = (y * dw + x) * 4;
      dst[di] = src[si];
      dst[di + 1] = src[si + 1];
      dst[di + 2] = src[si + 2];
      dst[di + 3] = src[si + 3];
    }
  }
  return dst;
}

// ── 인코딩 ──
const gif = GIFEncoder();
let dw = TARGET_W;
let dh = 0;
for (const f of frames) {
  const png = PNG.sync.read(f.buf);
  if (dh === 0) dh = Math.round((png.height / png.width) * dw);
  const rgba = scaleRGBA(png.data, png.width, png.height, dw, dh);
  const palette = quantize(rgba, 256);
  const index = applyPalette(rgba, palette);
  gif.writeFrame(index, dw, dh, { palette, delay: f.delay });
}
gif.finish();
writeFileSync(OUT, Buffer.from(gif.bytes()));
console.log(`✅ ${OUT} (${dw}x${dh}, ${frames.length} frames)`);
