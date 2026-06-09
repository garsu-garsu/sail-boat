import { supabase } from "../lib/supabase";
import type { Profile } from "../types";
import { toProfile } from "./mappers";

/** 현재 로그인 유저의 프로필. 로그인 안 했으면 null */
export async function getMyProfile(): Promise<Profile | null> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (uid == null) return null;

  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", uid)
    .maybeSingle();

  if (error) throw error;
  return data ? toProfile(data) : null;
}

/** 닉네임 등 수정 가능한 필드 업데이트 */
export async function updateMyNickname(nickname: string): Promise<void> {
  const { data: auth } = await supabase.auth.getUser();
  const uid = auth.user?.id;
  if (uid == null) throw new Error("로그인이 필요해요.");

  const { error } = await supabase
    .from("profiles")
    .update({ nickname })
    .eq("id", uid);
  if (error) throw error;
}
