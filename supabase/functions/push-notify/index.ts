// Supabase Edge Function: push-notify
// 새 편지/답장이 도착하면 수신자에게 앱인토스 기능성 메시지(푸시)를 보내요.
// DB 트리거(0008_push_notify.sql)가 호출해요.
//
// 동작 조건(아래가 모두 있어야 실제 발송, 없으면 자동으로 건너뜀 = no-op):
//   PUSH_NOTIFY_SECRET     : DB 트리거와 공유하는 호출 인증 토큰
//   PUSH_TEMPLATE_BOTTLE   : "새 편지 도착" 캠페인 템플릿 코드 (콘솔 발급, 검수 승인)
//   PUSH_TEMPLATE_REPLY    : "새 답장 도착" 캠페인 템플릿 코드 (콘솔 발급, 검수 승인)
//   TOSS_MTLS_CERT/KEY     : 토스 파트너 API mTLS 인증서/키
//   TOSS_API_BASE          : (선택) 기본 https://apps-in-toss-api.toss.im
//
// 중요: verify_jwt = false (config.toml). x-push-secret 헤더로 자체 인증해요.

const PUSH_SECRET = Deno.env.get("PUSH_NOTIFY_SECRET") ?? "";
const TEMPLATE_BOTTLE = Deno.env.get("PUSH_TEMPLATE_BOTTLE") ?? "";
const TEMPLATE_REPLY = Deno.env.get("PUSH_TEMPLATE_REPLY") ?? "";
const API_BASE = Deno.env.get("TOSS_API_BASE") ?? "https://apps-in-toss-api.toss.im";
const MTLS_CERT = Deno.env.get("TOSS_MTLS_CERT") ?? "";
const MTLS_KEY = Deno.env.get("TOSS_MTLS_KEY") ?? "";

function templateFor(kind: string): string {
  if (kind === "bottle") return TEMPLATE_BOTTLE;
  if (kind === "reply") return TEMPLATE_REPLY;
  return "";
}

function skip(reason: string): Response {
  console.log("push-notify skipped:", reason);
  return new Response(JSON.stringify({ ok: false, skipped: reason }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Method Not Allowed", { status: 405 });
  if (PUSH_SECRET === "" || req.headers.get("x-push-secret") !== PUSH_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let userKey: string | undefined;
  let kind: string | undefined;
  try {
    const body = await req.json();
    userKey = body.userKey != null ? String(body.userKey) : undefined;
    kind = body.kind;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  if (!userKey) return skip("no userKey (anonymous recipient)");

  const templateSetCode = templateFor(kind ?? "");
  if (templateSetCode === "") return skip(`no template for kind=${kind}`);
  if (MTLS_CERT === "" || MTLS_KEY === "") return skip("no mTLS credentials");

  // mTLS 클라이언트 (Supabase 런타임이 막으면 별도 mTLS 백엔드 필요)
  let client: unknown = undefined;
  try {
    // deno-lint-ignore no-explicit-any
    client = (Deno as any).createHttpClient({ cert: MTLS_CERT, key: MTLS_KEY });
  } catch (e) {
    console.error("mTLS 클라이언트 생성 실패:", e);
    return skip("mTLS client init failed");
  }

  const init: RequestInit = {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-toss-user-key": userKey,
    },
    body: JSON.stringify({ templateSetCode, context: {} }),
  };
  // deno-lint-ignore no-explicit-any
  const res = await fetch(
    `${API_BASE}/api-partner/v1/apps-in-toss/messenger/send-message`,
    client ? ({ ...init, client } as any) : init,
  );

  if (!res.ok) {
    const detail = await res.text();
    console.error("기능성 메시지 발송 실패:", res.status, detail);
    return new Response(JSON.stringify({ ok: false, status: res.status }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
});
