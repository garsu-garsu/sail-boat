// Supabase Edge Function: toss-auth
// 토스 로그인 인가코드를 받아 인구통계 동의 데이터를 수집하고 Supabase 세션을 발급해요.
//
// ⚠️ 토스 API 는 mTLS(서버 간 상호 TLS)가 필수이고, 개인정보는 암호화되어 와요.
//    아래 시크릿이 모두 있어야 실제 연동이 동작해요. 없으면 개발용 mock 으로 동작해요.
//
// 필요한 시크릿(supabase secrets set ...):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, SUPABASE_ANON_KEY  (Supabase 기본 주입)
//   TOSS_MTLS_CERT   : 콘솔 발급 mTLS 클라이언트 인증서(PEM 전체 문자열)
//   TOSS_MTLS_KEY    : 콘솔 발급 개인키(PEM 전체 문자열)
//   TOSS_DECRYPT_KEY : 개인정보 복호화 키 (콘솔 발급, hex 또는 base64 — 아래 KEY_ENCODING 확인)
//   TOSS_DECRYPT_AAD : 복호화 AAD (콘솔 발급 문자열)
//   TOSS_API_BASE    : (선택) 기본값 https://apps-in-toss-api.toss.im
//
// 참고: https://developers-apps-in-toss.toss.im/login/develop.html
//       https://developers-apps-in-toss.toss.im/development/integration-process.html (mTLS)

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!;
const API_BASE = Deno.env.get("TOSS_API_BASE") ?? "https://apps-in-toss-api.toss.im";
const MTLS_CERT = Deno.env.get("TOSS_MTLS_CERT") ?? "";
const MTLS_KEY = Deno.env.get("TOSS_MTLS_KEY") ?? "";
const DECRYPT_KEY = Deno.env.get("TOSS_DECRYPT_KEY") ?? "";
const DECRYPT_AAD = Deno.env.get("TOSS_DECRYPT_AAD") ?? "";

// 복호화 키 인코딩: 콘솔이 hex 로 주면 "hex", base64 면 "base64". (확인 필요)
const KEY_ENCODING: "hex" | "base64" = "base64";

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

type AgeBand = "10s" | "20s" | "30s" | "40s" | "50s" | "60plus";
interface TossUser {
  tossUserKey: string;
  gender: "male" | "female" | null;
  ageBand: AgeBand | null;
  nationality: "domestic" | "foreign" | null;
}

function birthYearToAgeBand(year: number): AgeBand {
  const age = new Date().getFullYear() - year;
  if (age < 20) return "10s";
  if (age < 30) return "20s";
  if (age < 40) return "30s";
  if (age < 50) return "40s";
  if (age < 60) return "50s";
  return "60plus";
}

// ── 개인정보 복호화 (AES-256-GCM) ───────────────────────────────
// 가정한 형식: base64( IV(12B) || ciphertext || tag(16B) ). 콘솔 샘플과 다르면 맞춰주세요.
function decodeBytes(s: string, enc: "hex" | "base64"): Uint8Array {
  if (enc === "hex") {
    const out = new Uint8Array(s.length / 2);
    for (let i = 0; i < out.length; i++) out[i] = parseInt(s.substr(i * 2, 2), 16);
    return out;
  }
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}

async function decryptField(encrypted: string): Promise<string> {
  const raw = decodeBytes(encrypted, "base64");
  const iv = raw.slice(0, 12);
  const body = raw.slice(12); // ciphertext + 16B tag (Web Crypto 가 tag 를 뒤에서 읽어요)
  const keyBytes = decodeBytes(DECRYPT_KEY, KEY_ENCODING);
  const key = await crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, [
    "decrypt",
  ]);
  const plain = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv, additionalData: new TextEncoder().encode(DECRYPT_AAD) },
    key,
    body,
  );
  return new TextDecoder().decode(plain);
}

/**
 * 토스 API(mTLS)로 인가코드를 교환하고 동의 데이터를 가져와 복호화해요.
 * 시크릿이 없으면 개발용 mock 을 반환해요.
 */
async function fetchTossUser(
  authorizationCode: string,
  referrer: string,
): Promise<TossUser> {
  // 복호화 키가 없으면 실연동 불가 → 개발용 mock
  if (DECRYPT_KEY === "") {
    return {
      tossUserKey: `dev-${authorizationCode.slice(0, 16)}`,
      gender: "female",
      ageBand: "20s",
      nationality: "domestic",
    };
  }

  // mTLS 는 선택적: 인증서가 있으면 클라이언트 인증서를 붙여 호출해요.
  // (Supabase 호스팅 런타임이 Deno.createHttpClient 를 막으면, 인증서 없이 먼저 시도하고
  //  토스가 거부하면 별도 mTLS 백엔드가 필요해요.)
  let client: unknown = undefined;
  if (MTLS_CERT !== "" && MTLS_KEY !== "") {
    try {
      // deno-lint-ignore no-explicit-any
      client = (Deno as any).createHttpClient({ cert: MTLS_CERT, key: MTLS_KEY });
    } catch (e) {
      console.error("mTLS 클라이언트 생성 실패(런타임 미지원일 수 있음):", e);
    }
  }
  const withClient = (init: RequestInit) =>
    client ? ({ ...init, client } as RequestInit) : init;

  // 1) 인가코드 → 토큰
  const tokenRes = await fetch(
    `${API_BASE}/api-partner/v1/apps-in-toss/user/oauth2/generate-token`,
    withClient({
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ authorizationCode, referrer }),
    }),
  );
  if (!tokenRes.ok) throw new Error(`generate-token failed ${tokenRes.status}`);
  const tokenJson = await tokenRes.json();
  const accessToken: string = tokenJson.success?.accessToken ?? tokenJson.accessToken;

  // 2) 토큰 → 유저 정보(암호화됨)
  const meRes = await fetch(
    `${API_BASE}/api-partner/v1/apps-in-toss/user/oauth2/login-me`,
    withClient({
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    }),
  );
  if (!meRes.ok) throw new Error(`login-me failed ${meRes.status}`);
  const meJson = await meRes.json();
  const me = meJson.success ?? meJson;

  const tossUserKey: string = me.userKey;

  // 3) 암호화 필드 복호화 (없거나 미동의면 null 로 둬요)
  let gender: TossUser["gender"] = null;
  let ageBand: TossUser["ageBand"] = null;
  let nationality: TossUser["nationality"] = null;

  try {
    if (me.gender) {
      const g = (await decryptField(me.gender)).toUpperCase();
      gender = g === "MALE" ? "male" : g === "FEMALE" ? "female" : null;
    }
    if (me.birthday) {
      const b = await decryptField(me.birthday); // 예: "1998-03-21" 또는 "19980321"
      const year = Number(b.replace(/[^0-9]/g, "").slice(0, 4));
      if (year > 1900) ageBand = birthYearToAgeBand(year);
    }
    if (me.nationality) {
      const n = (await decryptField(me.nationality)).toUpperCase();
      nationality = n === "LOCAL" ? "domestic" : n === "FOREIGNER" ? "foreign" : null;
    }
  } catch (e) {
    console.error("개인정보 복호화 실패(형식 확인 필요):", e);
  }

  return { tossUserKey, gender, ageBand, nationality };
}

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });

  try {
    const { authorizationCode, referrer, anonymousUserId } = await req.json();
    if (!authorizationCode) {
      return json({ error: "authorizationCode required" }, 400);
    }

    const toss = await fetchTossUser(authorizationCode, referrer ?? "");
    const email = `${toss.tossUserKey}@sailboat.tossapp`;
    const password = crypto.randomUUID() + crypto.randomUUID();

    const { data: existing } = await admin
      .from("profiles")
      .select("id")
      .eq("toss_user_key", toss.tossUserKey)
      .maybeSingle();

    let uid = existing?.id as string | undefined;

    if (uid == null) {
      // 이 토스 계정으로는 처음 로그인. 둘러보기(익명)로 쓰던 계정이 있으면
      // 그 계정을 그대로 토스 계정으로 승격해 기존 편지/답장/채팅을 이어받아요.
      let upgraded = false;
      if (anonymousUserId) {
        try {
          const { data: anon } = await admin.auth.admin.getUserById(
            anonymousUserId,
          );
          if (anon?.user?.is_anonymous === true) {
            const { error } = await admin.auth.admin.updateUserById(
              anonymousUserId,
              { email, password, email_confirm: true },
            );
            if (!error) {
              uid = anonymousUserId;
              upgraded = true;
            }
          }
        } catch (e) {
          console.error("익명 계정 승격 실패(새 계정으로 진행):", e);
        }
      }

      if (!upgraded) {
        const { data: created, error } = await admin.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (error) throw error;
        uid = created.user.id;
      }
    } else {
      const { error } = await admin.auth.admin.updateUserById(uid, { password });
      if (error) throw error;
    }

    // 프로필 upsert (service_role → 인구통계 기록 허용)
    await admin.from("profiles").upsert({
      id: uid,
      toss_user_key: toss.tossUserKey,
      gender: toss.gender,
      age_band: toss.ageBand,
      nationality: toss.nationality,
    });

    // password grant 로 세션 토큰 발급
    const tokenRes = await fetch(
      `${SUPABASE_URL}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY },
        body: JSON.stringify({ email, password }),
      },
    );
    if (!tokenRes.ok) throw new Error(`session mint failed ${tokenRes.status}`);
    const session = await tokenRes.json();

    return json({
      accessToken: session.access_token,
      refreshToken: session.refresh_token,
    });
  } catch (e) {
    return json({ error: String(e) }, 500);
  }
});

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}
