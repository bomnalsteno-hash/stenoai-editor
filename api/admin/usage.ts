import { createClient } from '@supabase/supabase-js';

async function getUserIdAndRoleFromToken(token: string): Promise<{ id: string; role: string } | null> {
  const url = process.env.SUPABASE_URL!;
  const key = process.env.SUPABASE_ANON_KEY!;
  const res = await fetch(`${url}/auth/v1/user`, {
    headers: { Authorization: `Bearer ${token}`, apikey: key },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const id = data?.id;
  if (!id) return null;
  const supabase = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY!);
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', id).single();
  return { id, role: profile?.role ?? 'user' };
}

export default async function handler(req: any, res: any) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization');
  if (req.method === 'OPTIONS') return res.status(200).end();

  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const auth = req.headers?.authorization;
  const token = auth?.startsWith('Bearer ') ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: '로그인이 필요합니다.' });

  const user = await getUserIdAndRoleFromToken(token);
  if (!user) return res.status(401).json({ error: '유효하지 않은 세션입니다.' });
  if (user.role !== 'admin') return res.status(403).json({ error: '관리자만 접근할 수 있습니다.' });

  const supabase = createClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  // input_filename 컬럼이 없어도 기록은 항상 조회되도록: 먼저 전체 컬럼 시도, 실패 시 기본 컬럼만
  let logs: { user_id: string; tokens_input: number; tokens_output: number; created_at: string | null; input_filename?: string | null }[] | null = null;
  const withFilename = await supabase
    .from('usage_logs')
    .select('user_id, tokens_input, tokens_output, input_filename, created_at')
    .order('created_at', { ascending: false });
  if (withFilename.error) {
    const withoutFilename = await supabase
      .from('usage_logs')
      .select('user_id, tokens_input, tokens_output, created_at')
      .order('created_at', { ascending: false });
    logs = withoutFilename.data ?? null;
    if (logs) {
      logs = logs.map((row) => ({ ...row, input_filename: null as string | null }));
    }
  } else {
    logs = withFilename.data;
  }

  const { data: profiles } = await supabase.from('profiles').select('id, email');

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p.email]));

  type Agg = {
    total_input: number;
    total_output: number;
    request_count: number;
    last_used: string | null;
    details: { input_filename: string | null; tokens_input: number; tokens_output: number; created_at: string | null }[];
  };
  const byUser = new Map<string, Agg>();

  for (const row of logs ?? []) {
    const cur = byUser.get(row.user_id) ?? {
      total_input: 0,
      total_output: 0,
      request_count: 0,
      last_used: null as string | null,
      details: [],
    };
    cur.total_input += row.tokens_input ?? 0;
    cur.total_output += row.tokens_output ?? 0;
    cur.request_count += 1;
    if (!cur.last_used || (row.created_at && row.created_at > cur.last_used)) {
      cur.last_used = row.created_at ?? null;
    }
    cur.details.push({
      input_filename: row.input_filename ?? null,
      tokens_input: row.tokens_input ?? 0,
      tokens_output: row.tokens_output ?? 0,
      created_at: row.created_at ?? null,
    });
    byUser.set(row.user_id, cur);
  }

  const usage = Array.from(byUser.entries()).map(([user_id, agg]) => ({
    user_id,
    email: profileMap.get(user_id) ?? null,
    total_input: agg.total_input,
    total_output: agg.total_output,
    total_tokens: agg.total_input + agg.total_output,
    last_used: agg.last_used,
    request_count: agg.request_count,
    details: agg.details,
  }));

  usage.sort((a, b) => (b.last_used ?? '').localeCompare(a.last_used ?? ''));

  return res.status(200).json({ usage });
}
