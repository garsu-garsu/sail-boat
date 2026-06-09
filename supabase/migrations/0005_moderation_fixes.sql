-- 0005: 운영자(직접 DB 접속) 제재 가능하도록 권한 가드 보정
--
-- 배경: guard_profile_demographics / sanction_user 가 'service_role' 만 허용해서,
--       Supabase SQL 편집기(역할이 'postgres', auth.role()='') 에서 운영자가 제재할 수 없었어요.
-- 해결: PostgREST 를 거치지 않는 직접 DB 접속(auth.role()='')도 권한자로 인정해요.
--       일반 클라이언트(anon/authenticated)는 그대로 차단돼요.

create or replace function public.guard_profile_demographics()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  -- 'service_role' 또는 직접 DB 접속(빈 role) 이 아니면(=일반 클라이언트면) 민감/제재 컬럼을 잠가요.
  if coalesce(auth.role(), '') not in ('service_role', '') then
    if tg_op = 'INSERT' then
      new.gender := null; new.age_band := null; new.nationality := null;
      new.violation_count := 0; new.is_banned := false;
    else
      new.gender          := old.gender;
      new.age_band        := old.age_band;
      new.nationality     := old.nationality;
      new.toss_user_key   := old.toss_user_key;
      new.violation_count := old.violation_count;
      new.is_banned       := old.is_banned;
    end if;
  end if;
  return new;
end; $$;

create or replace function public.sanction_user(
  p_user_id uuid,
  p_permanent boolean default false
)
returns void language plpgsql security definer set search_path = public as $$
begin
  -- service_role(운영 Edge Function) 또는 직접 DB 접속(SQL 편집기)만 허용
  if coalesce(auth.role(), '') not in ('service_role', '') then
    raise exception '권한이 없어요.';
  end if;
  update public.profiles
  set violation_count = violation_count + 1,
      is_banned = (p_permanent or violation_count + 1 >= 3 or is_banned)
  where id = p_user_id;
end; $$;
