// Supabase Edge Function: report-alert
// 새 신고(reports insert)가 생기면 운영자 이메일로 알림을 보내요.
// DB 트리거(0004_report_alert.sql)가 이 함수를 호출해요.
//
// 필요한 시크릿(supabase secrets set):
//   RESEND_API_KEY      : Resend API 키 (https://resend.com — 무료 플랜 가능)
//   REPORT_ALERT_SECRET : DB 트리거와 공유하는 호출 인증 토큰
//   ALERT_EMAIL_TO      : 받는 사람 (기본 garsu1035@gmail.com)
//   ALERT_EMAIL_FROM    : 보내는 사람 (기본 "돛단배 신고 <onboarding@resend.dev>")
//
// 중요: verify_jwt = false (config.toml). 대신 x-alert-secret 헤더로 자체 인증해요.

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY") ?? "";
const ALERT_SECRET = Deno.env.get("REPORT_ALERT_SECRET") ?? "";
const EMAIL_TO = Deno.env.get("ALERT_EMAIL_TO") ?? "garsu1035@gmail.com";
const EMAIL_FROM =
  Deno.env.get("ALERT_EMAIL_FROM") ?? "돛단배 신고 <onboarding@resend.dev>";
const PROJECT_REF = "nezccqxpwejurrekiqxy";

const CONTEXT_LABEL: Record<string, string> = {
  bottle: "편지",
  reply: "답장",
  chat: "채팅",
};

interface ReportPayload {
  id?: string;
  reporter_id?: string;
  reported_id?: string | null;
  context_type?: string;
  context_id?: string;
  reason?: string;
  content_snapshot?: string | null;
  created_at?: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

Deno.serve(async (req) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }
  // 공유 시크릿 검증 (DB 트리거만 호출하도록)
  if (ALERT_SECRET === "" || req.headers.get("x-alert-secret") !== ALERT_SECRET) {
    return new Response("Unauthorized", { status: 401 });
  }

  let report: ReportPayload;
  try {
    const body = await req.json();
    // pg_net 또는 Database Webhook 페이로드 모두 대응 (record 래핑 여부)
    report = (body?.record ?? body) as ReportPayload;
  } catch {
    return new Response("Bad Request", { status: 400 });
  }

  const typeLabel = CONTEXT_LABEL[report.context_type ?? ""] ?? report.context_type ?? "기타";
  const reason = report.reason ?? "(사유 없음)";

  // 필터하기 쉬운 제목: 고정 접두사 [돛단배신고] + [유형] + 사유
  const subject = `[돛단배신고][${typeLabel}] ${reason}`;

  const snapshot = report.content_snapshot ?? "(스냅샷 없음)";
  const created = report.created_at ?? new Date().toISOString();
  const editorUrl = `https://supabase.com/dashboard/project/${PROJECT_REF}/editor`;

  const textBody = [
    "돛단배 신고가 접수됐어요. 24시간 이내에 확인해 주세요.",
    "",
    `유형: ${typeLabel} (${report.context_type ?? "-"})`,
    `사유: ${reason}`,
    `신고 ID: ${report.id ?? "-"}`,
    `대상 사용자(reported_id): ${report.reported_id ?? "-"}`,
    `신고자(reporter_id): ${report.reporter_id ?? "-"}`,
    `맥락 ID(context_id): ${report.context_id ?? "-"}`,
    `접수 시각: ${created}`,
    "",
    "신고된 내용:",
    snapshot,
    "",
    `처리: Supabase 콘솔에서 확인 → ${editorUrl}`,
    "제재: select public.sanction_user('<대상 user id>'); -- 3회 누적 시 영구차단",
  ].join("\n");

  const htmlBody = `
    <div style="font-family:sans-serif;line-height:1.6;color:#1B3B6F">
      <h2 style="margin:0 0 8px">🚩 돛단배 신고 접수</h2>
      <p style="margin:0 0 12px">24시간 이내에 확인해 주세요.</p>
      <table style="border-collapse:collapse;font-size:14px">
        <tr><td style="padding:2px 8px"><b>유형</b></td><td style="padding:2px 8px">${escapeHtml(typeLabel)} (${escapeHtml(report.context_type ?? "-")})</td></tr>
        <tr><td style="padding:2px 8px"><b>사유</b></td><td style="padding:2px 8px">${escapeHtml(reason)}</td></tr>
        <tr><td style="padding:2px 8px"><b>신고 ID</b></td><td style="padding:2px 8px">${escapeHtml(report.id ?? "-")}</td></tr>
        <tr><td style="padding:2px 8px"><b>대상 사용자</b></td><td style="padding:2px 8px">${escapeHtml(report.reported_id ?? "-")}</td></tr>
        <tr><td style="padding:2px 8px"><b>신고자</b></td><td style="padding:2px 8px">${escapeHtml(report.reporter_id ?? "-")}</td></tr>
        <tr><td style="padding:2px 8px"><b>맥락 ID</b></td><td style="padding:2px 8px">${escapeHtml(report.context_id ?? "-")}</td></tr>
        <tr><td style="padding:2px 8px"><b>접수</b></td><td style="padding:2px 8px">${escapeHtml(created)}</td></tr>
      </table>
      <p style="margin:12px 0 4px"><b>신고된 내용</b></p>
      <blockquote style="margin:0;padding:10px 14px;background:#F3E9D2;border-radius:8px;white-space:pre-wrap">${escapeHtml(snapshot)}</blockquote>
      <p style="margin:14px 0 0;font-size:13px">
        처리하기 → <a href="${editorUrl}">Supabase 콘솔 열기</a><br/>
        제재 SQL: <code>select public.sanction_user('대상 user id');</code> (3회 누적 시 영구차단)
      </p>
    </div>
  `;

  if (RESEND_API_KEY === "") {
    // 아직 Resend 키가 없으면 발송은 못 하지만 인입은 정상 (로그만 남겨요)
    console.error("RESEND_API_KEY 미설정 — 이메일을 보내지 못했어요.", subject);
    return new Response(
      JSON.stringify({ ok: false, reason: "RESEND_API_KEY not set" }),
      { status: 200, headers: { "Content-Type": "application/json" } },
    );
  }

  const res = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${RESEND_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: EMAIL_FROM,
      to: [EMAIL_TO],
      subject,
      text: textBody,
      html: htmlBody,
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error("Resend 발송 실패:", res.status, detail);
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
