-- 돛단배(Sailboat) 초기 스키마
-- 실행: supabase db push  (또는 SQL Editor 에 붙여넣기)

-- =========================================================
-- 1. 테이블
-- =========================================================

create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  toss_user_key text unique,
  nickname      text,
  gender        text check (gender in ('male','female')),
  age_band      text check (age_band in ('10s','20s','30s','40s','50s','60plus')),
  nationality   text check (nationality in ('domestic','foreign')),
  created_at    timestamptz not null default now()
);

create table if not exists public.bottles (
  id                  uuid primary key default gen_random_uuid(),
  author_id           uuid not null references public.profiles(id) on delete cascade,
  recipient_id        uuid not null references public.profiles(id) on delete cascade,
  content             text not null check (char_length(content) between 1 and 1000),
  author_gender       text,
  author_age_band     text,
  author_nationality  text,
  status              text not null default 'sent' check (status in ('sent','read')),
  received_at         timestamptz,
  created_at          timestamptz not null default now()
);
create index if not exists bottles_recipient_idx on public.bottles (recipient_id, created_at desc);
create index if not exists bottles_author_idx on public.bottles (author_id, created_at desc);

create table if not exists public.replies (
  id          uuid primary key default gen_random_uuid(),
  bottle_id   uuid not null references public.bottles(id) on delete cascade,
  from_id     uuid not null references public.profiles(id) on delete cascade,
  to_id       uuid not null references public.profiles(id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 1000),
  status      text not null default 'sent' check (status in ('sent','read','chatOpened')),
  created_at  timestamptz not null default now()
);
create index if not exists replies_to_idx on public.replies (to_id);
create index if not exists replies_from_idx on public.replies (from_id);

create table if not exists public.chat_rooms (
  id          uuid primary key default gen_random_uuid(),
  bottle_id   uuid not null references public.bottles(id) on delete cascade,
  reply_id    uuid not null unique references public.replies(id) on delete cascade,
  user_a      uuid not null references public.profiles(id) on delete cascade, -- 원작성자
  user_b      uuid not null references public.profiles(id) on delete cascade, -- 답장한 사람
  created_at  timestamptz not null default now()
);
create index if not exists chat_rooms_users_idx on public.chat_rooms (user_a, user_b);

create table if not exists public.chat_messages (
  id          uuid primary key default gen_random_uuid(),
  room_id     uuid not null references public.chat_rooms(id) on delete cascade,
  sender_id   uuid not null references public.profiles(id) on delete cascade,
  content     text not null check (char_length(content) between 1 and 2000),
  created_at  timestamptz not null default now()
);
create index if not exists chat_messages_room_idx on public.chat_messages (room_id, created_at);

-- =========================================================
-- 2. 비정규화 트리거 (작성자 인구통계 / 답장 수신자)
-- =========================================================

create or replace function public.fill_bottle_demographics()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select gender, age_band, nationality
    into new.author_gender, new.author_age_band, new.author_nationality
  from public.profiles where id = new.author_id;
  return new;
end; $$;

drop trigger if exists trg_fill_bottle_demographics on public.bottles;
create trigger trg_fill_bottle_demographics
  before insert on public.bottles
  for each row execute function public.fill_bottle_demographics();

create or replace function public.fill_reply_to()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select author_id into new.to_id from public.bottles where id = new.bottle_id;
  if new.to_id is null then
    raise exception '유리병을 찾을 수 없어요.';
  end if;
  return new;
end; $$;

drop trigger if exists trg_fill_reply_to on public.replies;
create trigger trg_fill_reply_to
  before insert on public.replies
  for each row execute function public.fill_reply_to();

-- =========================================================
-- 3. 편지 보내기 RPC — 보내는 순간 랜덤 수신자에게 배정
--    필터(성별/연령대/국적)를 주면 그 타겟 중에서 랜덤 1명 선택.
--    모두 null 이면 전체 유저 중 랜덤.
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
  if char_length(coalesce(p_content, '')) < 1 then
    raise exception '내용을 입력해 주세요.';
  end if;

  -- 조건(=수신자 인구통계)에 맞는 유저를 본인 제외하고 랜덤으로 1명 선택
  select id into v_recipient
  from public.profiles
  where id <> v_uid
    and (p_gender      is null or gender      = p_gender)
    and (p_age_band    is null or age_band    = p_age_band)
    and (p_nationality is null or nationality = p_nationality)
  order by random()
  limit 1;

  if v_recipient is null then
    return; -- 받을 사람이 없음 → 0행 반환
  end if;

  -- 작성자 인구통계는 fill_bottle_demographics 트리거가 자동으로 채워요.
  return query
    insert into public.bottles (author_id, recipient_id, content)
    values (v_uid, v_recipient, p_content)
    returning *;
end; $$;

-- =========================================================
-- 4. 답장 → 채팅방 열기 RPC (멱등)
-- =========================================================

create or replace function public.open_chat_from_reply(p_reply_id uuid)
returns setof public.chat_rooms
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
  v_reply public.replies;
  v_existing public.chat_rooms;
begin
  if v_uid is null then
    raise exception '로그인이 필요해요.';
  end if;

  select * into v_reply from public.replies where id = p_reply_id;
  if v_reply.id is null then
    raise exception '답장을 찾을 수 없어요.';
  end if;
  if v_reply.to_id <> v_uid then
    raise exception '채팅방을 열 권한이 없어요.';
  end if;

  select * into v_existing from public.chat_rooms where reply_id = p_reply_id;
  if v_existing.id is not null then
    return next v_existing; return;
  end if;

  update public.replies set status = 'chatOpened' where id = p_reply_id;

  return query
    insert into public.chat_rooms (bottle_id, reply_id, user_a, user_b)
    values (v_reply.bottle_id, p_reply_id, v_reply.to_id, v_reply.from_id)
    returning *;
end; $$;

-- =========================================================
-- 5. 채팅 상대 닉네임 조회 RPC (프로필 직접 노출 없이)
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
  return (select coalesce(nickname, '익명의 항해자') from public.profiles where id = v_peer);
end; $$;

-- =========================================================
-- 6. RLS
-- =========================================================

alter table public.profiles      enable row level security;
alter table public.bottles       enable row level security;
alter table public.replies       enable row level security;
alter table public.chat_rooms    enable row level security;
alter table public.chat_messages enable row level security;

-- profiles: 본인 것만
drop policy if exists profiles_select_own on public.profiles;
create policy profiles_select_own on public.profiles
  for select using (id = auth.uid());
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());
drop policy if exists profiles_insert_self on public.profiles;
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid());

-- 인구통계(gender/age_band/nationality)는 service_role(=toss-auth Edge Function)만
-- 쓸 수 있어요. 일반 클라이언트가 직접 채우면 필터를 속일 수 있으니 트리거로 막아요.
create or replace function public.guard_profile_demographics()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.role(), '') <> 'service_role' then
    if tg_op = 'INSERT' then
      new.gender := null; new.age_band := null; new.nationality := null;
    else
      new.gender := old.gender;
      new.age_band := old.age_band;
      new.nationality := old.nationality;
      new.toss_user_key := old.toss_user_key;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_guard_profile_demographics on public.profiles;
create trigger trg_guard_profile_demographics
  before insert or update on public.profiles
  for each row execute function public.guard_profile_demographics();

-- bottles: 보낸 사람/받은 사람만 조회. 생성은 send_bottle RPC 로만(직접 insert 차단).
drop policy if exists bottles_select on public.bottles;
create policy bottles_select on public.bottles
  for select using (author_id = auth.uid() or recipient_id = auth.uid());
-- 수신자가 읽음 처리할 수 있도록 update 허용 (data 계층은 status 만 변경)
drop policy if exists bottles_update_read on public.bottles;
create policy bottles_update_read on public.bottles
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- replies: 편지를 받은 사람만 답장 작성, 당사자만 조회, 수신자만 읽음처리
drop policy if exists replies_select on public.replies;
create policy replies_select on public.replies
  for select using (from_id = auth.uid() or to_id = auth.uid());
drop policy if exists replies_insert on public.replies;
create policy replies_insert on public.replies
  for insert with check (
    from_id = auth.uid()
    and exists (
      select 1 from public.bottles b
      where b.id = bottle_id and b.recipient_id = auth.uid()
    )
  );
drop policy if exists replies_update on public.replies;
create policy replies_update on public.replies
  for update using (to_id = auth.uid()) with check (to_id = auth.uid());

-- chat_rooms: 멤버만 조회 (생성은 RPC 로만)
drop policy if exists chat_rooms_select on public.chat_rooms;
create policy chat_rooms_select on public.chat_rooms
  for select using (user_a = auth.uid() or user_b = auth.uid());

-- chat_messages: 멤버만 조회/작성
drop policy if exists chat_messages_select on public.chat_messages;
create policy chat_messages_select on public.chat_messages
  for select using (
    exists (
      select 1 from public.chat_rooms r
      where r.id = room_id and (r.user_a = auth.uid() or r.user_b = auth.uid())
    )
  );
drop policy if exists chat_messages_insert on public.chat_messages;
create policy chat_messages_insert on public.chat_messages
  for insert with check (
    sender_id = auth.uid()
    and exists (
      select 1 from public.chat_rooms r
      where r.id = room_id and (r.user_a = auth.uid() or r.user_b = auth.uid())
    )
  );

-- =========================================================
-- 7. Realtime
-- =========================================================
alter publication supabase_realtime add table public.chat_messages;
