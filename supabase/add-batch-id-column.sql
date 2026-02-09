-- usage_logs: 청크 요청을 한 파일(배치)로 묶기 위한 컬럼
-- Supabase 대시보드 → SQL Editor에서 실행

alter table public.usage_logs add column if not exists batch_id uuid;

comment on column public.usage_logs.batch_id is '같은 교정 실행(청크 여러 번)을 묶는 ID. null이면 단일 요청.';
