-- 0008: 편지/답장 도착 시 수신자에게 푸시 알림 (앱인토스 기능성 메시지)
-- bottles/replies insert → 수신자의 toss_user_key 가 있으면 push-notify Edge Function 호출.
-- 익명(둘러보기) 수신자는 toss_user_key 가 없어 자동으로 건너뜀.
--
-- 사전 준비(별도 1회): push-notify 배포 + 시크릿
--   supabase secrets set PUSH_NOTIFY_SECRET=... PUSH_TEMPLATE_BOTTLE=... PUSH_TEMPLATE_REPLY=...
--   (+ TOSS_MTLS_CERT/KEY) — 없으면 함수가 no-op 으로 조용히 건너뜀.

create extension if not exists pg_net with schema extensions;

-- 공통: 수신자 userKey + 종류로 push-notify 호출
create or replace function public.send_push(p_recipient uuid, p_kind text)
returns void language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url    text := 'https://nezccqxpwejurrekiqxy.supabase.co/functions/v1/push-notify';
  v_secret text := 'LWCQQhqpbN31UWQxFpbZJBLlnhLypkc5';
  v_key    text;
begin
  select toss_user_key into v_key from public.profiles where id = p_recipient;
  if v_key is null then
    return; -- 익명(둘러보기) 수신자 → 푸시 대상 아님
  end if;
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret),
    body    := jsonb_build_object('userKey', v_key, 'kind', p_kind)
  );
exception
  when others then
    return; -- 푸시 실패가 본 작업(편지/답장 저장)을 막지 않아요.
end; $$;

-- 새 편지 도착
create or replace function public.notify_new_bottle()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.send_push(new.recipient_id, 'bottle');
  return new;
end; $$;

drop trigger if exists trg_notify_new_bottle on public.bottles;
create trigger trg_notify_new_bottle
  after insert on public.bottles
  for each row execute function public.notify_new_bottle();

-- 새 답장 도착 (수신자 = 원작성자 to_id)
create or replace function public.notify_new_reply()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  perform public.send_push(new.to_id, 'reply');
  return new;
end; $$;

drop trigger if exists trg_notify_new_reply on public.replies;
create trigger trg_notify_new_reply
  after insert on public.replies
  for each row execute function public.notify_new_reply();
