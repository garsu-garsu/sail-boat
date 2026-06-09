import { supabase } from "../lib/supabase";
import type { ReportTarget } from "../types";

/**
 * 불법 광고/유해 금칙어 목록 (클라이언트 사전 검사용).
 * 서버 `banned_keywords` 테이블과 동일한 의도이며, 서버 트리거/RPC가 최종 차단을 해요.
 * (클라 검사는 사용자에게 즉시 안내하기 위한 UX 용도)
 */
export const BANNED_KEYWORDS = [
  "조건만남",
  "조건팅",
  "성매매",
  "성매수",
  "출장만남",
  "오피",
  "스폰",
  "스폰서",
  "애인대행",
  "만남보장",
  "폰섹",
  "섹파",
  "실섹",
  "번개만남",
  "즉석만남",
  "대출광고",
  "도박사이트",
  "불법도박",
];

const normalize = (s: string) => s.toLowerCase().replace(/\s/g, "");

/** 내용에 금칙어가 있으면 매칭된 키워드를, 없으면 null 을 반환해요. */
export function findBannedKeyword(text: string): string | null {
  const norm = normalize(text);
  if (norm === "") return null;
  for (const keyword of BANNED_KEYWORDS) {
    if (norm.includes(normalize(keyword))) return keyword;
  }
  return null;
}

/**
 * 개인정보·외부 연락처가 포함됐는지 감지해요. (사기·외부유인·스토킹 예방, soft 경고용)
 * 감지되면 종류 라벨("전화번호"/"계좌번호"/"SNS 아이디")을, 없으면 null.
 */
export function findPersonalInfo(text: string): string | null {
  if (text.trim() === "") return null;
  const norm = normalize(text); // 공백 제거 + 소문자
  const digits = text.replace(/[^0-9]/g, ""); // 구분자(-, 공백 등) 무시

  // 휴대폰 번호 (010-1234-5678, 010 1234 5678, 01012345678 등)
  if (/01[016789]\d{7,8}/.test(digits)) return "전화번호";

  // SNS·메신저 아이디 유도
  const snsHints = [
    "카톡",
    "카카오톡",
    "오픈채팅",
    "오픈톡",
    "인스타",
    "insta",
    "텔레",
    "라인아이디",
    "라인id",
    "디스코드",
    "디코",
    "스노우",
  ];
  if (snsHints.some((h) => norm.includes(h))) return "SNS 아이디";
  if (/@[a-z0-9._]{3,}/.test(norm)) return "SNS 아이디";

  // 계좌번호 (은행/송금 맥락 + 숫자, 또는 구분자 포함 11자리 이상 연속 숫자)
  if (
    (/(계좌|입금|송금|은행|뱅크)/.test(norm) && /\d{4,}/.test(digits)) ||
    /\d[\d\s-]{9,}\d/.test(text)
  ) {
    return "계좌번호";
  }

  return null;
}

/**
 * 위기(자해·자살) 신호 키워드를 감지해요. (차단이 아니라 상담 안내를 위한 용도)
 * 감지되면 true.
 */
const CRISIS_KEYWORDS = [
  "자살",
  "죽고싶",
  "죽고파",
  "자해",
  "목숨을끊",
  "살기싫",
  "사라지고싶",
  "없어지고싶",
  "죽어버리",
  "극단적선택",
];
export function hasCrisisSignal(text: string): boolean {
  const norm = normalize(text);
  if (norm === "") return false;
  return CRISIS_KEYWORDS.some((k) => norm.includes(normalize(k)));
}

/** 편지/답장/채팅을 신고해요. (24시간 이내 운영자 검토) */
export async function reportContent(
  target: ReportTarget,
  reason: string,
): Promise<void> {
  const { error } = await supabase.rpc("report_content", {
    p_reported_id: target.reportedId,
    p_context_type: target.contextType,
    p_context_id: target.contextId,
    p_reason: reason,
    p_snapshot: target.snapshot ?? null,
  });
  if (error) throw error;
}

/** 사용자를 차단해요. 차단하면 서로 편지를 주고받지 않아요. */
export async function blockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc("block_user", {
    p_blocked_id: userId,
  });
  if (error) throw error;
}

/** 차단을 해제해요. */
export async function unblockUser(userId: string): Promise<void> {
  const { error } = await supabase.rpc("unblock_user", {
    p_blocked_id: userId,
  });
  if (error) throw error;
}
