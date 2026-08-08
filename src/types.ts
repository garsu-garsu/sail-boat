// 돛단배(Sailboat) — 공통 도메인 타입

export type Gender = "male" | "female";
export type Nationality = "domestic" | "foreign";
export type AgeBand = "10s" | "20s" | "30s" | "40s" | "50s" | "60plus";

/** 필터에서 "상관없음"을 표현 */
export type FilterValue<T> = T | "any";

export interface Filter {
  gender: FilterValue<Gender>;
  ageBand: FilterValue<AgeBand>;
  nationality: FilterValue<Nationality>;
}

export const DEFAULT_FILTER: Filter = {
  gender: "any",
  ageBand: "any",
  nationality: "any",
};

/** 필터가 하나라도 지정되어 있으면(=광고 필요) true */
export function isFilterActive(filter: Filter): boolean {
  return (
    filter.gender !== "any" ||
    filter.ageBand !== "any" ||
    filter.nationality !== "any"
  );
}

export interface Profile {
  id: string; // supabase auth uid
  tossUserKey: string | null;
  nickname: string | null;
  /** 익명 일련번호 (가입 순서대로 1, 2, 3 ...) */
  anonNo: number | null;
  gender: Gender | null;
  ageBand: AgeBand | null;
  nationality: Nationality | null;
  createdAt: string;
}

/** 닉네임이 없으면 "익명의 항해자{번호}" 로 표시할 이름을 만들어요. */
export function anonNickname(anonNo: number | null | undefined): string {
  return anonNo != null ? `익명의 항해자${anonNo}` : "익명의 항해자";
}

/** 프로필의 표시 이름 (닉네임 우선, 없으면 익명 인덱스) */
export function profileDisplayName(
  p: Pick<Profile, "nickname" | "anonNo">,
): string {
  return p.nickname ?? anonNickname(p.anonNo);
}

/**
 * 발송 횟수 정책 현황.
 * 무료 freeLimit건(랜덤) → 광고로 dailyLimit건까지 → 공유+광고로 shareLimit건까지.
 */
export interface SendQuota {
  sentToday: number;
  freeLimit: number; // 무료 발송 한도 (기본 3)
  dailyLimit: number; // 광고만으로 도달 가능한 한도 (기본 10)
  shareLimit: number; // 공유까지 포함한 절대 상한 (기본 15, 서버 강제)
}

export type BottleStatus = "sent" | "read";

export interface Bottle {
  id: string;
  authorId: string;
  // 보낼 때 시스템이 랜덤으로 배정한 수신자 (필터를 쓰면 해당 타겟 중에서 랜덤)
  recipientId: string;
  content: string;
  // 수신자가 보낸 사람을 식별할 수 있도록 비정규화한 작성자 인구통계 (없으면 null)
  authorGender: Gender | null;
  authorAgeBand: AgeBand | null;
  authorNationality: Nationality | null;
  // 작성자 익명 일련번호 (인구통계가 없을 때 "익명의 항해자{번호}" 표시용)
  authorAnonNo: number | null;
  status: BottleStatus; // 'sent' = 안 읽음, 'read' = 읽음
  receivedAt: string | null;
  createdAt: string;
}

export type ReplyStatus = "sent" | "read" | "chatOpened";

export interface Reply {
  id: string;
  bottleId: string;
  fromId: string; // 답장 보낸 사람(=유리병 주운 사람)
  toId: string; // 받는 사람(=원래 작성자)
  content: string;
  status: ReplyStatus;
  createdAt: string;
}

export interface ChatRoom {
  id: string;
  bottleId: string;
  replyId: string;
  userA: string; // 원작성자
  userB: string; // 답장한 사람
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  roomId: string;
  senderId: string;
  content: string;
  createdAt: string;
}

// ---- 신고/차단 (모니터링·대응) ----
export type ReportContextType = "bottle" | "reply" | "chat";

/** 신고 대상 식별 정보 */
export interface ReportTarget {
  /** 신고당하는 사용자 id (작성자/상대) */
  reportedId: string;
  contextType: ReportContextType;
  /** 신고 맥락의 id (편지/답장/채팅방 id) */
  contextId: string;
  /** 신고된 내용 스냅샷 (운영자 확인용, 선택) */
  snapshot?: string;
}

// ---- 표시용 한글 라벨 ----
export const GENDER_LABEL: Record<Gender, string> = {
  male: "남성",
  female: "여성",
};
export const NATIONALITY_LABEL: Record<Nationality, string> = {
  domestic: "내국인",
  foreign: "외국인",
};
export const AGE_BAND_LABEL: Record<AgeBand, string> = {
  "10s": "10대",
  "20s": "20대",
  "30s": "30대",
  "40s": "40대",
  "50s": "50대",
  "60plus": "60대 이상",
};
