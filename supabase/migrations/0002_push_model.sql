-- 0002: "줍기(pull)" → "보내는 순간 랜덤 전송(push)" 모델로 전환
-- 0001 을 이미 실행한 DB 에서만 추가로 실행하세요. (SQL Editor 붙여넣기 또는 supabase db push)
--
-- ⚠️ 주의: recipient_id(NOT NULL) 추가를 위해 기존 편지/답장/채팅 데이터를 비워요.
--    profiles(로그인 유저)는 그대로 유지돼요. 운영 데이터가 있다면 백업 후 실행하세요.

-- =========================================================
-- 1. 기존 편지/답장/채팅 데이터 비우기 (개발 단계)
-- =========================================================
truncate table public.bottles cascade; -- replies, chat_rooms, chat_messages 까지 함께 비워져요

-- =========================================================
-- 2. bottles 테이블 재구성 (picked_* 제거, recipient_* 추가)
-- =========================================================
alter table public.bottles drop column if exists picked_by;
alter table public.bottles drop column if exists picked_at;

alter table public.bottles
  add column if not exists recipient_id uuid not null
    references public.profiles(id) on delete cascade;
alter table public.bottles
  add column if not exists received_at timestamptz;

-- status: 'floating'|'picked'  →  'sent'|'read'
alter table public.bottles alter column status set default 'sent';
alter table public.bottles drop constraint if exists bottles_status_check;
alter table public.bottles
  add constraint bottles_status_check check (status in ('sent','read'));

-- 인덱스 교체
drop index if exists public.bottles_floating_idx;
drop index if exists public.bottles_picked_by_idx;
create index if not exists bottles_recipient_idx
  on public.bottles (recipient_id, created_at desc);
create index if not exists bottles_author_idx
  on public.bottles (author_id, created_at desc);

-- =========================================================
-- 3. RPC: pick_bottle 제거 → send_bottle 생성
-- =========================================================
drop function if exists public.pick_bottle(text, text, text);

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

  return query
    insert into public.bottles (author_id, recipient_id, content)
    values (v_uid, v_recipient, p_content)
    returning *;
end; $$;

-- =========================================================
-- 4. RLS 정책 교체 (picked_by → recipient_id)
-- =========================================================
drop policy if exists bottles_select on public.bottles;
create policy bottles_select on public.bottles
  for select using (author_id = auth.uid() or recipient_id = auth.uid());

-- 직접 insert 차단(전송은 send_bottle RPC 로만)
drop policy if exists bottles_insert on public.bottles;

-- 수신자 읽음 처리 허용
drop policy if exists bottles_update_read on public.bottles;
create policy bottles_update_read on public.bottles
  for update using (recipient_id = auth.uid()) with check (recipient_id = auth.uid());

-- 답장: 편지를 '받은' 사람만 작성 가능
drop policy if exists replies_insert on public.replies;
create policy replies_insert on public.replies
  for insert with check (
    from_id = auth.uid()
    and exists (
      select 1 from public.bottles b
      where b.id = bottle_id and b.recipient_id = auth.uid()
    )
  );
