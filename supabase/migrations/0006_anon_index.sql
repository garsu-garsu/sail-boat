-- 0006: 익명 사용자 인덱스 (익명의 항해자1, 2, 3 ...)
-- 모든 프로필에 고정 일련번호(anon_no)를 부여하고, 닉네임이 없으면 "익명의 항해자{anon_no}" 로 표시해요.

-- =========================================================
-- 1. profiles.anon_no (시퀀스 기반 고정 번호)
-- =========================================================
create sequence if not exists public.profiles_anon_seq;
alter table public.profiles add column if not exists anon_no int;

-- 기존 프로필 backfill (가입 순서대로 1부터)
with ordered as (
  select id, row_number() over (order by created_at) as rn
  from public.profiles
  where anon_no is null
)
update public.profiles p
set anon_no = o.rn
from ordered o
where p.id = o.id;

-- 시퀀스를 현재 최대값 다음으로 맞춰요 (is_called=false → 다음 nextval 이 해당 값 반환)
select setval(
  'public.profiles_anon_seq',
  coalesce((select max(anon_no) from public.profiles), 0) + 1,
  false
);

-- 새 프로필은 자동으로 다음 번호를 받아요
alter table public.profiles alter column anon_no set default nextval('public.profiles_anon_seq');
alter sequence public.profiles_anon_seq owned by public.profiles.anon_no;

-- =========================================================
-- 2. bottles 에 작성자 익명번호 비정규화 (받은 편지에서 표시)
-- =========================================================
alter table public.bottles add column if not exists author_anon_no int;

create or replace function public.fill_bottle_demographics()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select gender, age_band, nationality, anon_no
    into new.author_gender, new.author_age_band, new.author_nationality, new.author_anon_no
  from public.profiles where id = new.author_id;
  return new;
end; $$;

-- =========================================================
-- 3. 채팅 상대 표시 이름: 닉네임 없으면 "익명의 항해자{anon_no}"
-- =========================================================
create or replace function public.chat_peer_nickname(p_room_id uuid)
returns text language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_room public.chat_rooms;
  v_peer uuid;
begin
  select * into v_room from public.chat_rooms where id = p_room_id;
  if v_room.id is null then return null; end if;
  if v_uid not in (v_room.user_a, v_room.user_b) then return null; end if;
  v_peer := case when v_uid = v_room.user_a then v_room.user_b else v_room.user_a end;
  return (
    select coalesce(
      nullif(nickname, ''),
      '익명의 항해자' || coalesce(anon_no::text, '')
    )
    from public.profiles where id = v_peer
  );
end; $$;

-- =========================================================
-- 4. 가드: anon_no 도 클라이언트가 못 바꾸게 보호 (업데이트 시 유지)
-- =========================================================
create or replace function public.guard_profile_demographics()
returns trigger language plpgsql security definer set search_path = public as $$
begin
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
      new.anon_no         := old.anon_no;
    end if;
  end if;
  return new;
end; $$;
