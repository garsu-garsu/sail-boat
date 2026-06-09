-- 0004: 신고 접수 시 운영자 이메일 알림 (B안)
-- reports 에 새 신고가 insert 되면 pg_net 으로 report-alert Edge Function 을 호출하고,
-- 함수가 Resend 로 운영자에게 메일을 보내요.
--
-- 사전 준비(이 마이그레이션과 별개로 1회):
--   supabase functions deploy report-alert
--   supabase secrets set REPORT_ALERT_SECRET=... RESEND_API_KEY=... ALERT_EMAIL_TO=garsu1035@gmail.com

-- pg_net (비동기 HTTP) 확장
create extension if not exists pg_net with schema extensions;

create or replace function public.notify_report_alert()
returns trigger language plpgsql security definer set search_path = public, extensions as $$
declare
  v_url    text := 'https://nezccqxpwejurrekiqxy.supabase.co/functions/v1/report-alert';
  v_secret text := 'nzGwAS6l87XDG7gIJ2UDNHlW0cuBMow9';
begin
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-alert-secret', v_secret
    ),
    body    := jsonb_build_object(
      'id',               new.id,
      'reporter_id',      new.reporter_id,
      'reported_id',      new.reported_id,
      'context_type',     new.context_type,
      'context_id',       new.context_id,
      'reason',           new.reason,
      'content_snapshot', new.content_snapshot,
      'created_at',       new.created_at
    )
  );
  return new;
exception
  when others then
    -- 알림 실패가 신고 저장 자체를 막으면 안 돼요. 조용히 넘어가요.
    return new;
end; $$;

drop trigger if exists trg_notify_report_alert on public.reports;
create trigger trg_notify_report_alert
  after insert on public.reports
  for each row execute function public.notify_report_alert();
