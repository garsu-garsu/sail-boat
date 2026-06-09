-- 0012: 차단 완전 차단(#5) + 신고 누적 자동 가림(#6)

-- =========================================================
-- #5. 차단된 상대와는 답장/채팅 메시지도 주고받지 못하게 (양방향)
--     기존 guard_content_moderation(정지/금칙어)에 차단 검사를 추가해요.
--     - replies   : 보내는 사람(from_id) ↔ 받는 사람(to_id)
--     - chat_messages : 보내는 사람(sender_id) ↔ 방의 상대(user_a/user_b)
-- =========================================================
create or replace function public.guard_content_moderation()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_sender uuid;
  v_peer   uuid;
  v_obj    jsonb := to_jsonb(new);
begin
  v_sender := coalesce(
    (v_obj ->> 'from_id')::uuid,
    (v_obj ->> 'sender_id')::uuid
  );

  -- 정지 계정 차단
  if v_sender is not null
     and exists (select 1 from public.profiles where id = v_sender and is_banned) then
    raise exception '이용이 제한된 계정이에요.';
  end if;

  -- 금칙어(불법 광고 등) 차단
  if public.contains_banned_keyword(new.content) then
    raise exception '부적절한 표현(불법 광고 등)이 포함되어 있어 보낼 수 없어요.';
  end if;

  -- 상대 식별 (답장=to_id, 채팅=방의 반대편)
  if v_obj ? 'to_id' then
    v_peer := (v_obj ->> 'to_id')::uuid;
  elsif v_obj ? 'room_id' then
    select case when v_sender = r.user_a then r.user_b else r.user_a end
      into v_peer
      from public.chat_rooms r
      where r.id = (v_obj ->> 'room_id')::uuid;
  end if;

  -- 차단 관계(어느 방향이든)면 차단
  if v_sender is not null and v_peer is not null and exists (
    select 1 from public.blocks b
    where (b.blocker_id = v_sender and b.blocked_id = v_peer)
       or (b.blocker_id = v_peer  and b.blocked_id = v_sender)
  ) then
    raise exception '차단된 상대와는 대화할 수 없어요.';
  end if;

  return new;
end; $$;

-- =========================================================
-- #6. 신고가 일정 횟수(서로 다른 신고자 3명) 누적되면 자동으로 콘텐츠를 가려요.
--     reports 는 (reporter_id, context_type, context_id) 유니크라 count = 고유 신고자 수.
--     bottle/reply 만 자동 가림(채팅은 방 단위라 제외 — 차단/신고로 대응).
-- =========================================================
alter table public.bottles add column if not exists is_hidden boolean not null default false;
alter table public.replies add column if not exists is_hidden boolean not null default false;

create or replace function public.apply_report_threshold()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_cnt int;
  v_threshold int := 3;
begin
  select count(*) into v_cnt
  from public.reports
  where context_type = new.context_type and context_id = new.context_id;

  if v_cnt >= v_threshold then
    if new.context_type = 'bottle' then
      update public.bottles set is_hidden = true where id = new.context_id;
    elsif new.context_type = 'reply' then
      update public.replies set is_hidden = true where id = new.context_id;
    end if;
  end if;
  return new;
end; $$;

drop trigger if exists trg_report_threshold on public.reports;
create trigger trg_report_threshold
  after insert on public.reports
  for each row execute function public.apply_report_threshold();
