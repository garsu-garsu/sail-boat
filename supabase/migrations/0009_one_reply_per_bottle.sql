-- 0009: 한 편지에는 받은 사람이 한 번만 답장할 수 있어요. (중복 답장 차단)
-- UI 에서도 막지만, 직접 호출로도 중복되지 않도록 서버에 유니크 제약을 둬요.
alter table public.replies
  add constraint replies_one_per_author unique (bottle_id, from_id);
