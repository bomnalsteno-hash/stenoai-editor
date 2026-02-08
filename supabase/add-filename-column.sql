-- 기존 프로젝트에 이미 schema.sql 실행한 경우: 이 파일만 SQL Editor에서 실행
-- usage_logs에 input_filename 컬럼 추가
alter table public.usage_logs add column if not exists input_filename text;
