-- 교정본 저장 테이블 (마이페이지에서 목록/열기용)
-- Supabase 대시보드 → SQL Editor에서 실행

create table if not exists public.corrected_docs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  title text not null,
  content text not null,
  created_at timestamptz default now()
);

alter table public.corrected_docs enable row level security;

-- 본인 행만 조회 가능 (마이페이지 목록/상세)
create policy "Users can read own corrected_docs"
  on public.corrected_docs for select
  using (auth.uid() = user_id);

-- insert는 API(service_role)에서만 수행
comment on table public.corrected_docs is '교정 완료본 저장. 제목: 파일명 또는 사용 시각.';
