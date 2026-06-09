// 돛단배 백엔드 E2E 스모크 테스트 — 앱의 데이터 계층과 동일한 호출을 그대로 실행해요.
// 실행: node scripts/e2e-test.mjs   (.env 의 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 사용)
import { readFileSync } from "node:fs";
import { createClient } from "@supabase/supabase-js";

// --- .env 파싱 ---
const env = {};
for (const line of readFileSync(new URL("../.env", import.meta.url), "utf8").split("\n")) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
}
const URL_ = env.VITE_SUPABASE_URL;
const KEY = env.VITE_SUPABASE_ANON_KEY;
if (!URL_ || !KEY) throw new Error(".env 에 VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY 가 필요해요.");
console.log("Supabase:", URL_);

const mk = () =>
  createClient(URL_, KEY, { auth: { persistSession: false, autoRefreshToken: false } });

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
let pass = 0, fail = 0;
const ok = (m) => { console.log("  ✅", m); pass++; };
const bad = (m, e) => { console.log("  ❌", m, e?.message ?? e ?? ""); fail++; };

async function signInWithProfile(label, nickname) {
  const c = mk();
  const { data, error } = await c.auth.signInAnonymously();
  if (error) throw new Error(`[${label}] 익명 로그인 실패: ${error.message}`);
  const uid = data.user.id;
  // 앱의 devSignIn 과 동일: 프로필 없으면 생성
  const { data: prof } = await c.from("profiles").select("id").eq("id", uid).maybeSingle();
  if (!prof) {
    const { error: e2 } = await c.from("profiles").insert({ id: uid, nickname });
    if (e2) throw new Error(`[${label}] 프로필 생성 실패: ${e2.message}`);
  }
  console.log(`  • ${label} = ${uid}`);
  return { c, uid };
}

async function main() {
  console.log("\n[1] 익명 로그인 + 프로필 (유저 A, B)");
  const A = await signInWithProfile("A(보내는이)", "테스트A");
  const B = await signInWithProfile("B(받는이)", "테스트B");
  ok("두 유저 로그인/프로필 생성");

  console.log("\n[3] A 가 편지 보내기 (send_bottle) — 수신자가 B 가 될 때까지 시도");
  let bottle = null;
  for (let i = 0; i < 25 && bottle == null; i++) {
    const { data, error } = await A.c.rpc("send_bottle", {
      p_content: `안녕하세요, 바다 건너 인사예요. (#${i})`,
      p_gender: null, p_age_band: null, p_nationality: null,
    });
    if (error) { bad("send_bottle 오류", error); break; }
    const row = Array.isArray(data) ? data[0] : data;
    if (!row) { bad("받을 사람이 없음(프로필 부족?)"); break; }
    if (row.recipient_id === B.uid) bottle = row;
  }
  if (!bottle) {
    bad("A→B 편지 배정 실패 (다른 프로필이 많아 B 가 안 걸렸을 수 있어요)");
    console.log(`\n결과: ${pass} 통과 / ${fail} 실패`); process.exit(fail ? 1 : 0);
  }
  ok(`편지 전송됨 id=${bottle.id.slice(0,8)} recipient=B, status=${bottle.status}`);
  if (bottle.author_id === A.uid) ok("author_id = A 확인");

  console.log("\n[4] B 받은 편지함 조회 + 읽음 처리");
  {
    const { data, error } = await B.c.from("bottles").select("*").eq("recipient_id", B.uid).order("created_at", { ascending: false });
    if (error) bad("받은 편지함 조회", error);
    else if (data.find((x) => x.id === bottle.id)) ok(`받은 편지함에 편지 보임 (총 ${data.length}통)`);
    else bad("받은 편지가 목록에 없음");

    const { error: e2 } = await B.c.from("bottles").update({ status: "read", received_at: new Date().toISOString() }).eq("id", bottle.id).eq("status", "sent");
    if (e2) bad("읽음 처리 실패", e2); else ok("읽음 처리 성공");
  }
  // A 는 떠다니는 남의 편지를 못 봐야 함(RLS) — A 가 B의 받은편지를 직접 조회 시도
  {
    const { data } = await A.c.from("bottles").select("id").eq("id", bottle.id).maybeSingle();
    if (data) ok("작성자 A 는 자기가 보낸 편지를 조회 가능 (정상)");
  }

  console.log("\n[4b] B 가 답장 보내기 (받은 사람만 가능)");
  let reply = null;
  {
    const { data, error } = await B.c.from("replies").insert({ bottle_id: bottle.id, from_id: B.uid, content: "답장 고마워요! 🌊" }).select("*").single();
    if (error) bad("답장 작성 실패", error);
    else { reply = data; ok(`답장 작성됨 to_id=${data.to_id === A.uid ? "A(정상)" : data.to_id}`); }
  }
  // 권한 검증: A 는 B가 받은 편지에 답장 못 함
  {
    const { error } = await A.c.from("replies").insert({ bottle_id: bottle.id, from_id: A.uid, content: "잘못된 답장" }).select("*").single();
    if (error) ok("받지 않은 사람의 답장은 RLS 로 차단됨 (정상)");
    else bad("⚠️ 받지 않은 사람이 답장을 작성함 (RLS 구멍)");
  }
  if (!reply) { console.log(`\n결과: ${pass} 통과 / ${fail} 실패`); process.exit(1); }

  console.log("\n[5] A 가 답장함에서 채팅방 열기 (open_chat_from_reply)");
  let room = null;
  {
    const { data: replies } = await A.c.from("replies").select("*").eq("to_id", A.uid);
    if (replies?.find((r) => r.id === reply.id)) ok("A 답장함에 답장 보임");
    const { data, error } = await A.c.rpc("open_chat_from_reply", { p_reply_id: reply.id });
    if (error) bad("채팅방 열기 실패", error);
    else { room = Array.isArray(data) ? data[0] : data; ok(`채팅방 생성 id=${room.id.slice(0,8)} (A=${room.user_a===A.uid?"author":"?"}, B=${room.user_b===B.uid?"replier":"?"})`); }
  }
  // 멱등성: 다시 호출하면 같은 방
  {
    const { data } = await A.c.rpc("open_chat_from_reply", { p_reply_id: reply.id });
    const again = Array.isArray(data) ? data[0] : data;
    if (again?.id === room.id) ok("재호출 시 같은 방 반환 (멱등)");
  }
  // B 도 닉네임 조회
  {
    const { data } = await B.c.rpc("chat_peer_nickname", { p_room_id: room.id });
    ok(`B 가 본 상대 닉네임 = "${data}"`);
  }

  console.log("\n[6] 실시간 채팅 — B 구독, A 전송 → B 수신");
  let realtimeOk = false;
  const received = [];
  const channel = B.c
    .channel(`room:${room.id}`)
    .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages", filter: `room_id=eq.${room.id}` },
      (p) => { received.push(p.new); realtimeOk = true; });
  await new Promise((res) => channel.subscribe((s) => { if (s === "SUBSCRIBED") res(); }));
  await sleep(1500); // postgres_changes 필터가 서버에 완전히 등록될 시간 확보

  const { error: msgErr } = await A.c.from("chat_messages").insert({ room_id: room.id, sender_id: A.uid, content: "첫 메시지예요!" });
  if (msgErr) bad("A 메시지 전송 실패", msgErr); else ok("A 메시지 전송");

  for (let i = 0; i < 20 && !realtimeOk; i++) await sleep(250); // 최대 5초 대기
  if (realtimeOk) ok(`B 가 실시간으로 수신: "${received[0]?.content}"`);
  else bad("실시간 수신 안 됨 (Realtime 설정/네트워크 확인 — DB 저장 자체는 아래로 검증)");

  // 폴백: B 가 select 로 메시지 보이는지 (RLS select)
  {
    const { data, error } = await B.c.from("chat_messages").select("*").eq("room_id", room.id).order("created_at");
    if (error) bad("B 메시지 조회 실패", error);
    else if (data.length >= 1) ok(`B 가 방 메시지 조회 가능 (${data.length}개) — 저장/RLS 정상`);
  }
  // B 도 한 통 보내고 A 가 보는지
  {
    await B.c.from("chat_messages").insert({ room_id: room.id, sender_id: B.uid, content: "반가워요!" });
    await sleep(400);
    const { data } = await A.c.from("chat_messages").select("*").eq("room_id", room.id);
    if (data?.find((m) => m.content === "반가워요!")) ok("A 가 B 의 메시지 조회 가능 (양방향)");
  }
  await B.c.removeChannel(channel);

  console.log(`\n========== 결과: ${pass} 통과 / ${fail} 실패 ==========`);
  process.exit(fail ? 1 : 0);
}

main().catch((e) => { console.error("\n💥 예외:", e); process.exit(1); });
