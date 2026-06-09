import { createClient } from "@supabase/supabase-js";

import { HAS_SUPABASE, SUPABASE_ANON_KEY, SUPABASE_URL } from "./env";

// .env 가 비어 있어도 모듈 로드 시 throw 하지 않도록 안전한 플레이스홀더를 써요.
// (이 경우 실제 호출은 실패하지만 try/catch 로 처리돼 앱이 죽지 않아요)
const url = HAS_SUPABASE ? SUPABASE_URL : "http://localhost:54321";
const key = HAS_SUPABASE ? SUPABASE_ANON_KEY : "public-anon-key-placeholder";

// 단일 Supabase 클라이언트 인스턴스.
// 세션은 토스 로그인 → Edge Function(toss-auth)에서 발급한 토큰으로 설정돼요.
export const supabase = createClient(url, key, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
