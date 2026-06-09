import { supabase } from "../lib/supabase";
import type { Bottle, Filter, SendQuota } from "../types";
import { toBottle } from "./mappers";

/** 오늘 발송 횟수/한도 조회 (무료 freeLimit건 → 광고 dailyLimit건 → 공유 shareLimit건) */
export async function getSendQuota(): Promise<SendQuota> {
  const { data, error } = await supabase.rpc("get_send_quota");
  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return {
    sentToday: row?.sent_today ?? 0,
    freeLimit: row?.free_limit ?? 3,
    dailyLimit: row?.daily_limit ?? 10,
    shareLimit: row?.share_limit ?? 15,
  };
}

/**
 * 편지를 보내요. 보내는 순간 시스템이 랜덤 수신자에게 배정해요.
 * 필터의 "any" 는 서버에 null 로 전달돼 무시되고, 지정하면 그 타겟 중에서 랜덤 1명에게 보내요.
 * 조건에 맞는 받을 사람이 아무도 없으면 null 을 반환해요.
 */
export async function sendBottle(
  content: string,
  filter: Filter,
): Promise<Bottle | null> {
  const { data, error } = await supabase.rpc("send_bottle", {
    p_content: content,
    p_gender: filter.gender === "any" ? null : filter.gender,
    p_age_band: filter.ageBand === "any" ? null : filter.ageBand,
    p_nationality: filter.nationality === "any" ? null : filter.nationality,
  });

  if (error) throw error;
  const row = Array.isArray(data) ? data[0] : data;
  return row ? toBottle(row) : null;
}

/** 단일 편지 조회 (읽기 화면용) */
export async function getBottle(id: string): Promise<Bottle | null> {
  const { data, error } = await supabase
    .from("bottles")
    .select("*")
    .eq("id", id)
    .eq("is_hidden", false) // 가려진 편지는 열람 불가
    .maybeSingle();

  if (error) throw error;
  return data ? toBottle(data) : null;
}

/** 받은 편지함 — 나에게 도착한 편지들 (최신순) */
export async function listInboxBottles(): Promise<Bottle[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (uid == null) return [];

  const { data, error } = await supabase
    .from("bottles")
    .select("*")
    .eq("recipient_id", uid)
    .eq("is_hidden", false) // 신고 누적으로 가려진 편지는 제외
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toBottle);
}

/** 내가 보낸 편지들 (최신순) */
export async function listSentBottles(): Promise<Bottle[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (uid == null) return [];

  const { data, error } = await supabase
    .from("bottles")
    .select("*")
    .eq("author_id", uid)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toBottle);
}

/** 받은 편지를 읽음 처리 */
export async function markBottleRead(id: string): Promise<void> {
  const { error } = await supabase
    .from("bottles")
    .update({ status: "read", received_at: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "sent");
  if (error) throw error;
}
