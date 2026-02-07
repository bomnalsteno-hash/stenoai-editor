<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/1ZxWe5TwT9JJLHOEgql5twmsqkpBFSFZo

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

## GitHub에 올리기

1. **GitHub에서 새 저장소 생성**
   - [github.com/new](https://github.com/new) 에서 저장소 생성 (예: `stenoai-editor`)
   - "Add a README file" 등은 체크하지 않고 **Create repository**만 누릅니다.

2. **프로젝트 폴더에서 Git 초기화 및 푸시**
   ```bash
   cd "c:\Users\sieun\Downloads\개발\StenoAI Editor"

   git init
   git add .
   git commit -m "Initial commit: StenoAI Editor"

   git branch -M main
   git remote add origin https://github.com/내아이디/저장소이름.git
   git push -u origin main
   ```
   `내아이디/저장소이름`을 본인 GitHub 사용자명과 방금 만든 저장소 이름으로 바꾸세요.

3. **이후 수정사항 올리기**
   ```bash
   git add .
   git commit -m "변경 내용 요약"
   git push
   ```

## 웹 앱 배포 (Vercel)

1. **Vercel 로그인** (최초 1회)
   ```bash
   npx vercel login
   ```
   브라우저에서 로그인 후 이메일 인증을 완료하세요.

2. **GitHub 연동으로 배포 (권장)**
   - [vercel.com/new](https://vercel.com/new) → **Import Git Repository**
   - 방금 올린 GitHub 저장소 선택 → **Import**
   - **Environment Variables**에 `GEMINI_API_KEY` 추가 후 **Deploy**

   이후 `main` 브랜치에 `git push`할 때마다 자동으로 배포됩니다.

3. **CLI로 한 번만 배포**
   ```bash
   cd "c:\Users\sieun\Downloads\개발\StenoAI Editor"
   npx vercel
   ```
   배포 후 [Vercel 대시보드](https://vercel.com/dashboard) → 해당 프로젝트 → **Settings** → **Environment Variables**에서 `GEMINI_API_KEY`를 넣고 **Redeploy** 하세요.
