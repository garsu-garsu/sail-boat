import { supabase } from "../lib/supabase";
import type { Reply } from "../types";
import { toReply } from "./mappers";

/**
 * 주운 유리병에 답장을 보내요. (광고 시청 후 호출)
 * to_id(원작성자)는 서버 트리거가 bottle.author_id 로 채워요.
 */
export async function sendReply(
  bottleId: string,
  content: string,
): Promise<Reply> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (uid == null) throw new Error("로그인이 필요해요.");

  const { data, error } = await supabase
    .from("replies")
    .insert({ bottle_id: bottleId, from_id: uid, content })
    .select("*")
    .single();

  if (error) throw error;
  return toReply(data);
}

/** 내가 받은 답장 목록 (원작성자 입장) */
export async function listReceivedReplies(): Promise<Reply[]> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (uid == null) return [];

  const { data, error } = await supabase
    .from("replies")
    .select("*")
    .eq("to_id", uid)
    .eq("is_hidden", false) // 신고 누적으로 가려진 답장은 제외
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []).map(toReply);
}

/** 답장을 읽음 처리 */
export async function markReplyRead(replyId: string): Promise<void> {
  const { error } = await supabase
    .from("replies")
    .update({ status: "read" })
    .eq("id", replyId)
    .eq("status", "sent");
  if (error) throw error;
}

/** 내가 이 편지에 이미 답장했는지 여부 */
export async function hasRepliedToBottle(bottleId: string): Promise<boolean> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (uid == null) return false;

  const { data, error } = await supabase
    .from("replies")
    .select("id")
    .eq("bottle_id", bottleId)
    .eq("from_id", uid)
    .maybeSingle();
  if (error) throw error;
  return data != null;
}

export async function getReply(id: string): Promise<Reply | null> {
  const { data, error } = await supabase
    .from("replies")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? toReply(data) : null;
}
