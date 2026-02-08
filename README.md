# StenoAI Editor

전문가용 속기 교정 어시스턴트. 로그인한 사용자만 사용 가능하며, 관리자 페이지에서 아이디별 토큰 사용량을 조회할 수 있습니다.

## 기능

- **로그인/회원가입** (Supabase Auth)
- **STT 초안** 입력·TXT 드래그 앤 드롭 → **AI 교정** → **교정본 다운로드** (같은 파일명)
- **관리자 전용 페이지** (`/admin`): 아이디(이메일)별 토큰 사용량·마지막 사용 시각·요청 횟수 조회

## 로컬 실행

**필요:** Node.js, Supabase 프로젝트

1. 의존성 설치: `npm install`
2. Supabase 프로젝트 생성 후 [supabase/schema.sql](supabase/schema.sql) 를 SQL Editor에서 실행
3. `.env.local` 생성 ( [.env.example](.env.example) 참고 )
   - `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` (Supabase 대시보드 → Settings → API)
   - `VITE_APP_URL` 은 로컬에서는 비워두거나 `http://localhost:3000`
4. 개발 서버: `npm run dev`

로컬에서는 API가 없으므로 **교정 기능**을 쓰려면 Vercel에 배포한 뒤, `VITE_APP_URL` 에 배포 URL을 넣고 다시 빌드하거나, 같은 프로젝트를 Vercel에서 실행해야 합니다.

## 배포 (Vercel)

1. **Supabase**
   - [supabase.com](https://supabase.com) 에서 프로젝트 생성
   - SQL Editor에서 [supabase/schema.sql](supabase/schema.sql) 실행
   - 관리자 로그에서 **파일명**이 보이게 하려면 [supabase/add-filename-column.sql](supabase/add-filename-column.sql) 도 실행
   - Settings → API 에서 **URL**, **anon key**, **service_role key** 복사

2. **관리자 지정**
   - Supabase 대시보드 → Table Editor → `profiles` → 관리자로 쓸 이메일의 `role` 을 `admin` 으로 변경  
   - 또는 SQL: `update public.profiles set role = 'admin' where email = 'your@email.com';`

3. **Vercel**
   - [vercel.com/new](https://vercel.com/new) → GitHub 저장소 Import
   - **Environment Variables** 추가:
     - `GEMINI_API_KEY` (Gemini API 키)
     - `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (Supabase)
   - 배포 후, **한 번 더** 환경 변수에 `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` 추가 (클라이언트용)
   - **Redeploy** 후 배포 URL 확인

4. **배포 URL을 클라이언트에 반영 (선택)**
   - Vercel에서 배포 URL이 `https://xxx.vercel.app` 이면, 같은 도메인에서 API를 쓰므로 `VITE_APP_URL` 은 비워두면 됨.
   - 다른 도메인에서 API를 호출할 경우에만 `VITE_APP_URL` 에 API 기준 URL 설정

## GitHub 푸시

```bash
git add .
git commit -m "메시지"
git push
```

Vercel과 GitHub를 연동해 두면 `main` 브랜치 푸시 시 자동 배포됩니다.
