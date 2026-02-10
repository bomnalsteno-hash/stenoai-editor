-- corrected_docs 테이블에 원본 초안 컬럼과 삭제 정책 추가
-- Supabase 대시보드 → SQL Editor에서 이 파일 내용을 실행

alter table public.corrected_docs
  add column if not exists original_content text;

-- 본인 교정본만 삭제 가능하도록 정책 추가
create policy if not exists "Users can delete own corrected_docs"
  on public.corrected_docs for delete
  using (auth.uid() = user_id);

