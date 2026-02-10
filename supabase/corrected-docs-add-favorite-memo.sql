-- corrected_docs 테이블에 즐겨찾기/메모 컬럼과 업데이트 정책 추가
-- Supabase 대시보드 → SQL Editor에서 이 파일 내용을 실행

alter table public.corrected_docs
  add column if not exists is_favorite boolean not null default false,
  add column if not exists memo text;

-- 본인 교정본만 수정 가능하도록 업데이트 정책 추가
create policy if not exists "Users can update own corrected_docs"
  on public.corrected_docs for update
  using (auth.uid() = user_id);

