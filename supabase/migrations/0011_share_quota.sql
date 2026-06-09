-- 0011: 공유로 발송 한도 확장
-- 무료 3건(랜덤) + 광고로 10건까지 + 공유+광고로 15건까지. KST 자정 리셋.
-- "공유했는지/광고 봤는지"는 서버가 검증할 수 없어요 → 서버는 절대 상한(15건)만 강제(도배 방지),
-- 무료/광고/공유 구분은 클라이언트가 처리해요. (광고 정책과 동일한 정직한 한계)

-- 남은 발송 횟수 + 한도(무료/광고상한/공유상한) 조회
-- 반환 컬럼이 늘어나(3→4) CREATE OR REPLACE 가 막히므로 먼저 DROP 해요.
drop function if exists public.get_send_quota();
create or replace function public.get_send_quota()
returns table(sent_today int, free_limit int, daily_limit int, share_limit int)
language plpgsql security definer set search_path = public as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    return query select 0, 3, 10, 15; return;
  end if;
  return query select public.sent_count_today(v_uid), 3, 10, 15;
end; $$;

-- send_bottle 재정의 — 절대 상한을 15건으로 (기존 밴/금칙어/차단 로직 유지)
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
  v_hard_limit int := 15; -- 무료3 + 광고7 + 공유5
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

  -- 하루 발송 절대 상한 (한국시간 기준)
  if public.sent_count_today(v_uid) >= v_hard_limit then
    raise exception '오늘 보낼 수 있는 편지를 모두 보냈어요. 내일 다시 보내주세요.';
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
    return; -- 받을 사람이 없음 → 0행 반환 (횟수 차감 안 됨)
  end if;

  return query
    insert into public.bottles (author_id, recipient_id, content)
    values (v_uid, v_recipient, p_content)
    returning *;
end; $$;
