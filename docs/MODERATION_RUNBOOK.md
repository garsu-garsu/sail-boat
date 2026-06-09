# 돛단배 신고·대응 운영 매뉴얼 (Runbook)

앱인토스 소셜/채팅 서비스 출시 요건의 **"신고 접수 후 24시간 이내 대응"**을 운영하기 위한 매뉴얼이에요.
앱 안에 별도 관리자 화면은 없고, **Supabase 콘솔(SQL 편집기)**로 처리해요.

---

## 1. 지금 갖춰진 것

| 기능 | 구현 |
|------|------|
| 불법 광고(조건만남·성매매 등) 자동 차단 | `banned_keywords` + 전송 시 차단 (편지/답장/채팅) |
| 사용자 신고 | 받은 편지·답장·채팅 화면의 **🚩 신고** 버튼 |
| 사용자 차단 | 신고 시트의 **차단하기** (양방향 — 서로 편지 안 감) |
| 신고 알림 메일 | 신고 발생 시 **garsu1035@gmail.com** 으로 자동 발송 |
| 제재(영구 차단) | `sanction_user()` — 위반 3회 누적 시 자동 영구 차단 |
| 대화 보존 | 편지/답장/채팅이 DB에 저장, 신고 시 내용 스냅샷 함께 보관 |

> 운영 약속: **신고 메일을 받으면 24시간 이내에 확인하고 조치**해요.

---

## 2. 신고 알림 메일 받기

신고가 들어오면 아래 형식의 메일이 와요. 제목에 고정 접두사 **`[돛단배신고]`** 가 있어 필터하기 쉬워요.

```
제목: [돛단배신고][채팅] 불법 광고 (조건만남·성매매 등)
```

**Gmail 필터 추천 (라벨 자동 분류):**
1. Gmail → 검색창 우측 옵션 → 검색어 `subject:([돛단배신고])`
2. "필터 만들기" → 라벨 적용(예: `돛단배/신고`) + 중요 표시
3. 신고가 한곳에 모여 놓치지 않아요.

---

## 3. 매일 신고 확인 (SQL 편집기)

Supabase 콘솔 → **SQL Editor** 에서 실행해요.
(콘솔: https://supabase.com/dashboard/project/nezccqxpwejurrekiqxy )

**처리 안 된 신고 목록:**
```sql
select id, created_at, context_type, reason, reported_id, reporter_id, content_snapshot
from public.reports
where status = 'open'
order by created_at;
```

**특정 사용자가 받은 신고 모아보기:**
```sql
select * from public.reports
where reported_id = '대상-user-id'
order by created_at desc;
```

---

## 4. 판단 후 조치

### 4-1. 위반이 맞으면 → 제재
위반 1회를 누적해요. **3회째에 자동으로 영구 차단**돼요.
```sql
select public.sanction_user('대상-user-id');
```
바로 영구 차단하려면:
```sql
select public.sanction_user('대상-user-id', true);
```

### 4-2. 신고 처리 상태 정리
```sql
-- 조치 완료
update public.reports set status = 'resolved' where id = '신고-id';
-- 문제 없음(반려)
update public.reports set status = 'dismissed' where id = '신고-id';
```

### 4-3. 사용자 상태 확인
```sql
select id, nickname, violation_count, is_banned
from public.profiles
where id = '대상-user-id';
```

> 정지(`is_banned = true`)된 사용자는 편지·답장·채팅을 **보낼 수 없고**, 다른 사람이 보낸 편지의 **수신 대상에서도 제외**돼요.

### 4-4. 차단 해제 / 정지 해제 (오조치 복구)
```sql
update public.profiles set is_banned = false where id = '대상-user-id';
-- 필요하면 누적 위반 초기화
update public.profiles set violation_count = 0 where id = '대상-user-id';
```

---

## 5. 금칙어 관리

```sql
-- 추가
insert into public.banned_keywords (keyword) values ('새금칙어') on conflict do nothing;
-- 삭제
delete from public.banned_keywords where keyword = '뺄단어';
-- 전체 보기
select keyword from public.banned_keywords order by keyword;
```
> 앱 클라이언트에도 동일한 사전 안내 목록이 있어요: `src/data/moderation.ts` 의 `BANNED_KEYWORDS`.
> 서버가 최종 차단을 하므로 클라 목록은 "보내기 전 안내" 용도예요. 크게 바뀌면 양쪽을 맞춰 주세요.

---

## 6. 이메일 알림 활성화 (1회 설정 — 남은 작업)

현재 알림 파이프라인은 모두 연결돼 있고, **Resend API 키만 넣으면** 메일이 실제로 발송돼요.

1. https://resend.com 가입 (받는 주소 **garsu1035@gmail.com** 으로 가입하면 도메인 인증 없이 본인에게 발송 가능)
2. API Keys 에서 키 발급
3. 키 등록:
   ```sh
   supabase secrets set RESEND_API_KEY=re_xxxxxxxx
   ```
4. (선택) 본인 도메인을 Resend 에 인증했다면 보내는 주소 변경:
   ```sh
   supabase secrets set ALERT_EMAIL_FROM="돛단배 신고 <alert@yourdomain.com>"
   ```

**동작 점검:**
```sh
curl -X POST "https://nezccqxpwejurrekiqxy.supabase.co/functions/v1/report-alert" ^
  -H "x-alert-secret: nzGwAS6l87XDG7gIJ2UDNHlW0cuBMow9" ^
  -H "Content-Type: application/json" ^
  -d "{\"id\":\"test\",\"context_type\":\"chat\",\"reason\":\"테스트\",\"content_snapshot\":\"동작 확인\"}"
```
응답이 `{"ok":true}` 면 메일이 발송돼요. (키 없으면 `{"ok":false,"reason":"RESEND_API_KEY not set"}`)

---

## 7. 수사기관 협조 / 데이터 보존

- 편지·답장·채팅·신고 내용은 DB에 보존돼요. 적법한 요청 시 다음으로 추출해요:
```sql
-- 특정 사용자 관련 채팅
select * from public.chat_messages
where room_id in (
  select id from public.chat_rooms where user_a = '대상-id' or user_b = '대상-id'
) order by created_at;
```
- 회원 탈퇴(토스 연결 끊기) 시 `toss-disconnect` 가 cascade 삭제하므로, 보존이 필요한 사안은 **삭제 전에** 추출하세요.

---

## 8. 보안 메모

- DB 트리거 → 알림 함수 호출은 공유 토큰 `REPORT_ALERT_SECRET` 로 보호돼요.
- 토큰을 바꾸려면 **두 곳을 같은 값으로** 맞춰야 해요:
  1. `supabase secrets set REPORT_ALERT_SECRET=새값`
  2. `supabase/migrations/0004_report_alert.sql` 의 `v_secret` → 새 마이그레이션으로 함수 갱신 후 `supabase db push`
- `sanction_user` 와 제재 컬럼(violation_count/is_banned)은 일반 클라이언트가 못 바꿔요. **service_role(운영 함수) 또는 직접 DB 접속(SQL 편집기)** 에서만 변경돼요.
