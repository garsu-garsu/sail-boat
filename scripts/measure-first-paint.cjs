// dist 를 띄워 첫 화면이 보이기까지 걸리는 시간을 잽니다.
// 인자: <dist> <CPU 배수> [hang]
//   hang: 이전에 앱을 써서 로그인 정보가 남아 있는 기기 + supabase 응답이 오지 않는 상황
//         (= 심사자가 겪었을 상태)를 흉내냅니다.
const { chromium } = require("playwright");
const http = require("http");
const fs = require("fs");
const path = require("path");

const DIST = process.argv[2];
const CPU = Number(process.argv[3] || 6);
const HANG = process.argv[4] === "hang";
const PROJECT_REF = "nezccqxpwejurrekiqxy";

const types = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const url = req.url.split("?")[0];
  const file = path.join(DIST, url === "/" ? "index.html" : url);
  if (!fs.existsSync(file)) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { "content-type": types[path.extname(file)] || "application/octet-stream" });
  fs.createReadStream(file).pipe(res);
});

(async () => {
  await new Promise((r) => server.listen(8099, r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true });

  if (HANG) {
    // 저장된(만료된) 세션 → supabase 가 토큰 갱신을 시도해요.
    await ctx.addInitScript(
      ([key, value]) => window.localStorage.setItem(key, value),
      [
        `sb-${PROJECT_REF}-auth-token`,
        JSON.stringify({
          access_token: "expired.token.value",
          refresh_token: "expired-refresh",
          expires_at: 1000000000,
          token_type: "bearer",
          user: { id: "00000000-0000-0000-0000-000000000000" },
        }),
      ],
    );
    await ctx.route("**/*.supabase.co/**", () => {}); // 응답 없음
  }

  const page = await ctx.newPage();
  const cdp = await ctx.newCDPSession(page);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: CPU });

  const t0 = Date.now();
  await page.goto("http://localhost:8099/", { waitUntil: "commit" });
  let home;
  try {
    await page.waitForFunction(() => document.body.innerText.includes("편지 보내기"), { timeout: 40000 });
    home = `${Date.now() - t0} ms`;
  } catch { home = "40초 안에도 첫 화면이 안 뜸"; }

  console.log(`CPU x${CPU}${HANG ? " / 세션 남아있음 + supabase 응답 없음" : " / 정상"} → 홈 화면: ${home}`);
  await browser.close();
  server.close();
})();
