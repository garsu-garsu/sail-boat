// Supabase Edge Function: toss-disconnect
// 토스앱 "연결 끊기"(회원 탈퇴) 콜백 엔드포인트.
// 토스 콘솔에 등록할 값:
//   콜백 URL : https://<project-ref>.supabase.co/functions/v1/toss-disconnect
//   메서드   : GET 또는 POST (아래에서 둘 다 처리)
//   Basic Auth: 콘솔에 입력한 ID/PW 를 아래 시크릿과 동일하게 맞추세요.
//
// 필요한 시크릿:
//   TOSS_DISCONNECT_BASIC_USER, TOSS_DISCONNECT_BASIC_PASS
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (기본 주입)
//
// 중요: 이 함수는 토스 서버가 직접 호출하므로 Supabase JWT 검증을 꺼야 해요.
//   → supabase/functions/config.toml 에서 verify_jwt = false (아래 파일 참고)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const BASIC_USER = Deno.env.get("TOSS_DISCONNECT_BASIC_USER") ?? "";
const BASIC_PASS = Deno.env.get("TOSS_DISCONNECT_BASIC_PASS") ?? "";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function checkBasicAuth(req: Request): boolean {
  const header = req.headers.get("authorization") ?? "";
  if (!header.startsWith("Basic ")) return false;
  const decoded = atob(header.slice(6));
  const [user, pass] = decoded.split(":");
  return user === BASIC_USER && pass === BASIC_PASS;
}

/** 요청에서 토스 유저 식별키를 추출 (GET 쿼리 / POST 본문 모두 대응) */
async function extractUserKey(req: Request): Promise<string | null> {
  const url = new URL(req.url);
  const fromQuery =
    url.searchParams.get("userKey") ?? url.searchParams.get("user_key");
  if (fromQuery) return fromQuery;

  if (req.method === "POST") {
    try {
      const body = await req.json();
      return body.userKey ?? body.user_key ?? body.userHashKey ?? null;
    } catch {
      return null;
    }
  }
  return null;
}

Deno.serve(async (req) => {
  // 브라우저/콘솔의 프리플라이트(OPTIONS) 대응 — 없으면 "Failed to fetch" 가 떠요.
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  if (!checkBasicAuth(req)) {
    return new Response("Unauthorized", {
      status: 401,
      headers: { ...cors, "WWW-Authenticate": "Basic" },
    });
  }

  const userKey = await extractUserKey(req);
  if (!userKey) {
    return new Response(JSON.stringify({ error: "userKey required" }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  // toss_user_key → profile(id) 찾기 → auth 유저 삭제 (cascade 로 데이터 정리)
  const { data: profile } = await admin
    .from("profiles")
    .select("id")
    .eq("toss_user_key", userKey)
    .maybeSingle();

  if (profile?.id) {
    // profiles.id 가 auth.users 를 참조하고 모든 테이블이 on delete cascade 이므로
    // auth 유저 한 번 삭제로 유리병/답장/채팅이 함께 정리돼요.
    await admin.auth.admin.deleteUser(profile.id);
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
