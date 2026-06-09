-- 0003: 모니터링·대응 시스템 (신고 / 차단 / 금칙어(불법광고) 필터 / 제재)
-- 0001, 0002 실행 후 추가로 실행하세요. (supabase db push 또는 SQL Editor 붙여넣기)
--
-- 앱인토스 소셜/채팅 서비스 출시 요건 대응:
--   - 불법 광고(조건만남·성매매 등) 탐지·차단  (banned_keywords + 트리거/RPC)
--   - 사용자 신고                              (reports + report_content)
--   - 사용자 차단                              (blocks + block_user/unblock_user)
--   - 반복 위반자 영구 차단                    (profiles.violation_count/is_banned + sanction_user)

-- =========================================================
-- 1. profiles 에 제재 컬럼 추가
-- =========================================================
alter table public.profiles
  add column if not exists violation_count int not null default 0;
alter table public.profiles
  add column if not exists is_banned boolean not null default false;

-- =========================================================
-- 2. 신고 / 차단 / 금칙어 테이블
-- =========================================================
create table if not exists public.reports (
  id               uuid primary key default gen_random_uuid(),
  reporter_id      uuid not null references public.profiles(id) on delete cascade,
  reported_id      uuid references public.profiles(id) on delete set null,
  context_type     text not null check (context_type in ('bottle','reply','chat')),
  context_id       uuid not null,
  reason           text not null,
  content_snapshot text,
  status           text not null default 'open' check (status in ('open','resolved','dismissed')),
  created_at       timestamptz not null default now(),
  -- 같은 사람이 같은 대상을 중복 신고하면 갱신(누적 아님)
  unique (reporter_id, context_type, context_id)
);
create index if not exists reports_status_idx on public.reports (status, created_at desc);
create index if not exists reports_reported_idx on public.reports (reported_id);

create table if not exists public.blocks (
  blocker_id  uuid not null references public.profiles(id) on delete cascade,
  blocked_id  uuid not null references public.profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table if not exists public.banned_keywords (
  keyword     text primary key,
  created_at  timestamptz not null default now()
);

-- 불법 광고/유해 키워드 시드 (운영하며 추가·삭제 가능)
insert into public.banned_keywords (keyword) values
  ('조건만남'), ('조건 만남'), ('조건팅'), ('성매매'), ('성매수'),
  ('출장만남'), ('출장 만남'), ('오피'), ('스폰'), ('스폰서'),
  ('애인대행'), ('만남보장'), ('폰섹'), ('섹파'), ('실섹'),
  ('번개만남'), ('즉석만남'), ('대출광고'), ('도박사이트'), ('불법도박')
on conflict (keyword) do nothing;

-- =========================================================
-- 3. 금칙어 검사 함수 (공백 제거 + 소문자 부분일치)
-- =========================================================
create or replace function public.contains_banned_keyword(p_text text)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_norm text;
  v_hit  boolean;
begin
  v_norm := lower(regexp_replace(coalesce(p_text, ''), '\s', '', 'g'));
  if v_norm = '' then
    return false;
  end if;
  select exists (
    select 1 from public.banned_keywords k
    where v_norm like '%' || lower(regexp_replace(k.keyword, '\s', '', 'g')) || '%'
  ) into v_hit;
  return coalesce(v_hit, false);
end; $$;

-- =========================================================
-- 4. send_bottle 재정의
--    - 정지 계정은 보낼 수 없음
--    - 금칙어(불법광고) 포함 시 차단
--    - 차단 관계(서로) 수신자 풀에서 제외, 정지 계정 제외
-- =========================================================
create or replace function public.send_bottle(
  p_content text,
  p_gender text default null,
  p_age_band text default null,
  p_nationality text default null
)
returns setof public.bottles
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_recipient uuid;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  if exists (select 1 from public.profiles where id = v_uid and is_banned) then
    raise exception '이용이 제한된 계정이에요.';
  end if;
  if char_length(coalesce(p_content, '')) < 1 then
    raise exception '내용을 입력해 주세요.';
  end if;
  if public.contains_banned_keyword(p_content) then
    raise exception '부적절한 표현(불법 광고 등)이 포함되어 있어 보낼 수 없어요.';
  end if;

  select p.id into v_recipient
  from public.profiles p
  where p.id <> v_uid
    and p.is_banned = false
    and (p_gender      is null or p.gender      = p_gender)
    and (p_age_band    is null or p.age_band    = p_age_band)
    and (p_nationality is null or p.nationality = p_nationality)
    and not exists (
      select 1 from public.blocks b
      where (b.blocker_id = v_uid and b.blocked_id = p.id)
         or (b.blocker_id = p.id  and b.blocked_id = v_uid)
    )
  order by random()
  limit 1;

  if v_recipient is null then
    return; -- 받을 사람이 없음 → 0행 반환
  end if;

  return query
    insert into public.bottles (author_id, recipient_id, content)
    values (v_uid, v_recipient, p_content)
    returning *;
end; $$;

-- =========================================================
-- 5. 답장 / 채팅 메시지 작성 시 금칙어·정지 검사 트리거
--    (replies, chat_messages 는 클라이언트가 직접 insert 하므로 트리거로 막아요)
-- =========================================================
create or replace function public.guard_content_moderation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sender uuid;
begin
  -- replies.from_id / chat_messages.sender_id
  v_sender := coalesce(
    (to_jsonb(new) ->> 'from_id')::uuid,
    (to_jsonb(new) ->> 'sender_id')::uuid
  );
  if v_sender is not null
     and exists (select 1 from public.profiles where id = v_sender and is_banned) then
    raise exception '이용이 제한된 계정이에요.';
  end if;
  if public.contains_banned_keyword(new.content) then
    raise exception '부적절한 표현(불법 광고 등)이 포함되어 있어 보낼 수 없어요.';
  end if;
  return new;
end; $$;

drop trigger if exists trg_guard_reply_content on public.replies;
create trigger trg_guard_reply_content
  before insert on public.replies
  for each row execute function public.guard_content_moderation();

drop trigger if exists trg_guard_message_content on public.chat_messages;
create trigger trg_guard_message_content
  before insert on public.chat_messages
  for each row execute function public.guard_content_moderation();

-- =========================================================
-- 6. 신고 / 차단 RPC
-- =========================================================
create or replace function public.report_content(
  p_reported_id  uuid,
  p_context_type text,
  p_context_id   uuid,
  p_reason       text,
  p_snapshot     text default null
)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  if p_context_type not in ('bottle','reply','chat') then
    raise exception '잘못된 신고 유형이에요.';
  end if;

  insert into public.reports
    (reporter_id, reported_id, context_type, context_id, reason, content_snapshot)
  values
    (v_uid, p_reported_id, p_context_type, p_context_id, p_reason, p_snapshot)
  on conflict (reporter_id, context_type, context_id)
  do update set reason = excluded.reason,
               content_snapshot = excluded.content_snapshot,
               status = 'open',
               created_at = now();
end; $$;

create or replace function public.block_user(p_blocked_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  if p_blocked_id = v_uid then
    raise exception '자기 자신은 차단할 수 없어요.';
  end if;
  insert into public.blocks (blocker_id, blocked_id)
  values (v_uid, p_blocked_id)
  on conflict do nothing;
end; $$;

create or replace function public.unblock_user(p_blocked_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;
  delete from public.blocks
  where blocker_id = v_uid and blocked_id = p_blocked_id;
end; $$;

-- =========================================================
-- 7. 운영자 제재 RPC (service_role 전용)
--    위반 1회 누적, 3회 이상이면 영구 차단(is_banned=true). p_permanent 로 즉시 영구차단 가능.
-- =========================================================
create or replace function public.sanction_user(
  p_user_id uuid,
  p_permanent boolean default false
)
returns void language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    raise exception '권한이 없어요.';
  end if;
  update public.profiles
  set violation_count = violation_count + 1,
      is_banned = (p_permanent or violation_count + 1 >= 3 or is_banned)
  where id = p_user_id;
end; $$;

-- =========================================================
-- 8. 채팅 상대 id 조회 RPC (신고/차단 대상 식별용, 프로필 직접 노출 없이)
-- =========================================================
create or replace function public.chat_peer_id(p_room_id uuid)
returns uuid language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_room public.chat_rooms;
begin
  select * into v_room from public.chat_rooms where id = p_room_id;
  if v_room.id is null then return null; end if;
  if v_uid not in (v_room.user_a, v_room.user_b) then return null; end if;
  return case when v_uid = v_room.user_a then v_room.user_b else v_room.user_a end;
end; $$;

-- =========================================================
-- 9. 프로필 가드 확장 — 제재 컬럼도 클라이언트가 못 바꾸게 보호
--    (0001 의 guard_profile_demographics 를 덮어써요)
-- =========================================================
create or replace function public.guard_profile_demographics()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
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

-- =========================================================
-- 10. RLS
-- =========================================================
alter table public.reports         enable row level security;
alter table public.blocks          enable row level security;
alter table public.banned_keywords enable row level security;

-- reports: 본인이 신고한 것만 조회. 생성은 report_content RPC 로만(직접 insert 차단).
drop policy if exists reports_select_own on public.reports;
create policy reports_select_own on public.reports
  for select using (reporter_id = auth.uid());

-- blocks: 본인 차단 목록만 조회/해제. 생성은 block_user RPC 로만.
drop policy if exists blocks_select_own on public.blocks;
create policy blocks_select_own on public.blocks
  for select using (blocker_id = auth.uid());
drop policy if exists blocks_delete_own on public.blocks;
create policy blocks_delete_own on public.blocks
  for delete using (blocker_id = auth.uid());

-- banned_keywords: 일반 클라이언트 접근 금지(정의자 함수/service_role 만 사용). 정책 없음 = 접근 불가.
