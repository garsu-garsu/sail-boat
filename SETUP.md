# 돛단배 — 셋업 가이드

유리병에 편지를 적어 바다에 띄우면 누군가 랜덤으로 받는 앱인토스 미니앱이에요.
코드는 완성되어 있고, **외부 키만 채우면** 바로 동작해요.

## 0. 동작 흐름

```
편지 작성 → 보내기(보내는 순간 랜덤 수신자에게 배정) → 상대의 받은 편지함에 도착 → 읽기
   → 광고 보고 답장 → 답장함에서 확인 → 광고 보고 채팅방 생성 → 실시간 채팅
```

- **보내는 순간** 시스템이 랜덤 수신자를 골라 전달해요(pull 아님, push).
- 기본값은 **전체 중 무작위**. 성별/연령대/내외국인 조건을 지정하면 **그 타겟 중에서 랜덤**으로 보내며 **보낼 때 광고 1회** 시청.
- 답장 보내기 / 채팅방 만들기도 각각 **광고 1회**.
- 성별·연령대·내외국인 정보는 **토스 로그인 동의**로 받아요. 동의가 없는 사람은 조건 필터에 걸리지 않고 '전체 랜덤'으로만 받을 대상이 돼요.

## 0-1. 비밀(시크릿) 관리 — 공개 레포 주의

이 레포는 **공개**돼요. 실제 비밀은 깃에 올리지 않고, 아래 표의 위치에서 복구해요.
`.env`는 `.gitignore`로 제외돼 있고, **키 목록은 `.env.example`이 문서 역할**을 해요.
(`VITE_SUPABASE_ANON_KEY`는 RLS로 보호되는 **공개용 키**라 노출돼도 안전하지만, 습관적으로 `.env`에만 둬요.)

| 비밀 | 위치 (원본) | 새 컴에서 복구 방법 |
|---|---|---|
| `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` | Supabase 대시보드 > Project Settings > API | `cp .env.example .env` 후 값 붙여넣기 |
| `VITE_AD_GROUP_ID`, `VITE_NOTIFY_TEMPLATE_CODE` | 앱인토스 콘솔 (광고/스마트 발송) | 위와 동일하게 `.env`에 입력 (없으면 비워둬도 동작) |
| Supabase **service_role**, `TOSS_MTLS_*`, `TOSS_DECRYPT_*`, `TOSS_DISCONNECT_*`, Resend 키 | **Supabase 호스팅 시크릿** (서버) | 로컬엔 불필요 — 함수가 서버에서 읽어요. 재설정 시 `supabase secrets set ...` (§3·§4 참고) |
| Supabase 관리(Management) 토큰 | `~/.supabase/access-token` (레포 밖) | Supabase 계정 > Access Tokens에서 재발급 |
| 앱인토스 배포 키 | `~/.ait/credentials` (레포 밖) | `npx ait token add <키>` 또는 `npx ait deploy --api-key <키>` |

> 💡 실제 값들은 **비밀번호 매니저(1Password 등)**에 보관하고, 새 컴에서는 `.env.example`을 보며 거기서 복붙하는 흐름을 권장해요.
> 서버 시크릿(service_role/mTLS/Resend)은 Supabase에 이미 저장돼 있어 **새 컴에서 다시 넣을 필요가 없어요.**

## 1. 로컬 실행 (브라우저, 백엔드 없이 둘러보기)

```bash
npm install
cp .env.example .env   # 값은 비워둬도 둘러보기 가능
npm run dev
```

- `.env`가 비어 있으면 Supabase 호출은 실패하지만, 온보딩의 **"둘러보기(익명)"** 로 화면 흐름은 볼 수 있어요.
- 광고는 토스 앱/샌드박스에서만 동작하고, 브라우저에서는 `VITE_AD_GROUP_ID`가 비어 있으면 **즉시 통과**해요(개발 편의).

## 2. Supabase 셋업 (백엔드)

1. https://supabase.com 에서 프로젝트 생성.
2. **SQL Editor** 에 `supabase/migrations/0001_init.sql` 전체를 붙여넣고 실행. (테이블·RLS·랜덤매칭 RPC·실시간 설정 한 번에)
3. **Authentication → Providers → Anonymous sign-in** 을 켜 주세요. (브라우저 둘러보기용 익명 로그인)
4. **Project Settings → API** 에서 값 복사 → `.env` 채우기:
   ```
   VITE_SUPABASE_URL=https://<프로젝트>.supabase.co
   VITE_SUPABASE_ANON_KEY=<anon key>
   ```
5. Edge Function 배포 (Supabase CLI 필요):
   ```bash
   supabase link --project-ref <프로젝트-ref>
   supabase functions deploy toss-auth
   supabase functions deploy toss-disconnect
   ```
   `supabase/config.toml` 에서 두 함수 모두 `verify_jwt = false` 로 설정돼 있어요(외부 호출용).

## 3. 토스 로그인 연동

플로우: 앱에서 `appLogin()` → `authorizationCode`+`referrer` → Edge Function `toss-auth`
→ 토스 API(mTLS)로 토큰 교환 → 유저정보(암호화) 조회 → 복호화 → Supabase 세션 발급.

**토스 API 스펙 (확인됨)**
- Base URL: `https://apps-in-toss-api.toss.im`
- 토큰 교환: `POST /api-partner/v1/apps-in-toss/user/oauth2/generate-token` (body: `authorizationCode`, `referrer`)
- 유저정보: `GET /api-partner/v1/apps-in-toss/user/oauth2/login-me` (`Authorization: Bearer`)
  - `userKey`(평문), `gender`(MALE/FEMALE), `nationality`(LOCAL/FOREIGNER), `birthday` 등은 **모두 암호화** → 콘솔 복호화 키+AAD로 AES‑256‑GCM 복호화
- ⚠️ **모든 호출에 mTLS 필수** — 콘솔에서 클라이언트 인증서/키 발급

**해야 할 일**
1. 앱인토스 콘솔에서:
   - 토스 로그인 활성화 + **동의 항목**(성별/생년월일/내외국인) 선택
   - **mTLS 인증서/키** 발급(다운로드)
   - **개인정보 복호화 키 + AAD** 확인
2. Supabase 함수 시크릿 등록(복호화 키/AAD는 **콘솔→이메일**로 받아요):
   ```bash
   # 필수
   supabase secrets set TOSS_DECRYPT_KEY=<복호화 키(base64)> TOSS_DECRYPT_AAD=<AAD 문자열>
   # mTLS 인증서가 필요하다고 판단되면 추가 (선택)
   supabase secrets set TOSS_MTLS_CERT="$(cat client-cert.pem)" TOSS_MTLS_KEY="$(cat client-key.pem)"
   ```
   배포: `supabase functions deploy toss-auth --no-verify-jwt`
3. 복호화 형식(문서로 확정됨, 코드와 일치):
   - AES‑256‑GCM, 키=**base64**, AAD=문자열 그대로(UTF‑8), 입력=base64( **IV 12B + 암호문 + 태그 16B** )
   - `toss-auth` 의 `KEY_ENCODING` 기본값 `base64` 그대로 두면 돼요.
   - `TOSS_DECRYPT_KEY` 가 비면 **개발용 mock**(20대·여성·내국인)으로 동작해 흐름 테스트 가능.

> ℹ️ **mTLS는 선택적**으로 구현돼 있어요. 인증서 시크릿이 없으면 일반 HTTPS로 호출해요(로그인 develop 문서 기준).
> 만약 토스가 인증서를 요구해 호출이 거부되면, 콘솔에서 mTLS 인증서를 발급해 위 시크릿을 추가하세요.
> 단, Supabase **호스팅** 런타임이 `Deno.createHttpClient`(클라이언트 인증서)를 막을 수 있어, 그 경우엔
> 토큰 교환/유저정보 조회만 **mTLS 지원 백엔드**로 분리해야 해요. (필요하면 만들어 드릴 수 있어요.)

## 3-1. 로컬에서 mock 으로 토스 로그인 흐름만 보기
mTLS/복호화 시크릿 없이 `toss-auth`를 배포하면, `appLogin()`은 토스 앱/샌드박스에서만 동작하지만
함수는 mock 인구통계를 돌려줘요. 브라우저 테스트는 온보딩의 **"둘러보기(익명)"** 를 쓰세요.

## 4. 토스앱 "연결 끊기"(회원 탈퇴) 콜백 — ✅ Supabase로 가능해요

질문하신 부분이에요. **Supabase Edge Function 이 콜백 URL 역할을 그대로 할 수 있어요.**

- 이름·이메일·성별 **외 추가 항목(생년월일/내외국인 등)** 을 받으므로 콜백 정보 입력이 필수인데, 이 앱은 이미 그 함수(`toss-disconnect`)를 포함하고 있어요.
- 콘솔에 입력할 값:

  | 항목 | 값 |
  |---|---|
  | 콜백 URL | `https://<프로젝트-ref>.supabase.co/functions/v1/toss-disconnect` |
  | HTTP 메서드 | `GET` 또는 `POST` (함수가 둘 다 처리) |
  | Basic Auth | 콘솔에 입력한 ID/PW 를 아래 시크릿과 **동일하게** 설정 |

- 시크릿 등록:
  ```bash
  supabase secrets set \
    TOSS_DISCONNECT_BASIC_USER=<콘솔에 넣을 ID> \
    TOSS_DISCONNECT_BASIC_PASS=<콘솔에 넣을 PW>
  ```
- 동작: 토스가 Basic Auth 헤더와 함께 호출 → 함수가 헤더를 검증 → 전달된 유저 식별키로 프로필을 찾아 **계정과 관련 데이터(유리병·답장·채팅)를 모두 삭제**해요. (모든 테이블이 `on delete cascade` 라 auth 유저 1건 삭제로 정리)
- 주의: `verify_jwt = false` 가 설정돼 있어야 토스 서버가 Supabase JWT 없이 호출할 수 있어요(이미 `config.toml` 에 반영).

## 5. 인앱광고

- 앱인토스 콘솔에서 인앱광고 그룹을 만들고 그룹 ID 를 `.env` 의 `VITE_AD_GROUP_ID` 에 넣어요.
- 비워두면 광고 없이 즉시 통과(개발용). 실제 광고는 토스 앱/샌드박스에서만 표시돼요.

## 6. 배포

```bash
npm run build   # vite 빌드
npm run deploy  # ait deploy (앱인토스 콘솔 연동)
```

---

### 폴더 구조 요약

```
src/
  types.ts              공통 도메인 타입/라벨
  lib/                  env, supabase 클라이언트
  theme.ts              바다/유리병 비주얼 토큰
  router.tsx            화면 라우팅(SPA)
  session.tsx           로그인 세션 컨텍스트
  hooks/useAdGate.ts    "광고 보고 → 실행" 게이트
  data/                 Supabase 데이터 접근 계층(bottles/replies/chat/profile/auth)
  components/           ScreenLayout, BottomNav
  features/             화면들 (home, onboarding, compose, receive, filter, reply, replies, chat)
supabase/
  migrations/0001_init.sql      스키마 + RLS + 랜덤매칭/채팅 RPC + Realtime
  functions/toss-auth/          토스 로그인 → 세션 발급 + 인구통계 수집
  functions/toss-disconnect/    연결끊기(회원탈퇴) 콜백
  config.toml                   함수 JWT 검증 설정
```

> 참고: `src/pages/InAppAdsPage.tsx`, `InAppPurchasePage.tsx` 와 `hooks/useInAppPurchase.ts` 는 스캐폴드 예제로, 현재 앱 흐름에서는 사용하지 않아요. 인앱결제를 도입할 때 참고용으로 남겨뒀어요.
