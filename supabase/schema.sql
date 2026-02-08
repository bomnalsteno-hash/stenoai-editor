-- StenoAI Editor: Supabase 스키마 (Supabase 대시보드 → SQL Editor에서 실행)

-- 1. 프로필 테이블 (auth.users 확장)
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  role text default 'user' check (role in ('user', 'admin')),
  created_at timestamptz default now()
);

-- 2. 토큰 사용 로그 (input_filename: 넣은 TXT 파일명, 없으면 null)
-- 주의: 이 테이블은 사용량 감사용이므로 TRUNCATE/DELETE 하지 말 것.
create table if not exists public.usage_logs (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references auth.users on delete cascade not null,
  tokens_input int not null default 0,
  tokens_output int not null default 0,
  input_filename text,
  created_at timestamptz default now()
);

-- 3. RLS
alter table public.profiles enable row level security;
alter table public.usage_logs enable row level security;

-- 본인 프로필만 조회
create policy "Users can read own profile"
  on public.profiles for select
  using (auth.uid() = id);

-- usage_logs는 클라이언트에서 직접 접근 불가 (API에서 service_role로만 사용)
create policy "No client access to usage_logs"
  on public.usage_logs for all
  using (false);

-- 4. 가입 시 프로필 자동 생성
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, role)
  values (new.id, new.email, 'user');
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 5. 관리자 지정 (이메일로 한 명 지정)
-- 예: update public.profiles set role = 'admin' where email = 'your-admin@example.com';
