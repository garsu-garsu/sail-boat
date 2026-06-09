-- 0007: 레거시 익명 닉네임 정리
-- 예전 devSignIn 이 저장한 고정 닉네임 "익명의 항해자"(번호 없음)를 비워서,
-- "익명의 항해자{anon_no}" 로 표시되도록 해요.
update public.profiles
set nickname = null
where nickname = '익명의 항해자';
