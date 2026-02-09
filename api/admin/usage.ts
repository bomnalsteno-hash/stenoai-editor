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

  // input_filename, batch_id 컬럼이 없어도 기록은 항상 조회되도록
  type LogRow = { user_id: string; tokens_input: number; tokens_output: number; created_at: string | null; input_filename?: string | null; batch_id?: string | null };
  let logs: LogRow[] | null = null;
  const withBatch = await supabase
    .from('usage_logs')
    .select('user_id, tokens_input, tokens_output, input_filename, created_at, batch_id')
    .order('created_at', { ascending: false });
  if (withBatch.error) {
    const withFilename = await supabase
      .from('usage_logs')
      .select('user_id, tokens_input, tokens_output, input_filename, created_at')
      .order('created_at', { ascending: false });
    if (withFilename.error) {
      const basic = await supabase
        .from('usage_logs')
        .select('user_id, tokens_input, tokens_output, created_at')
        .order('created_at', { ascending: false });
      logs = (basic.data ?? []).map((row) => ({ ...row, input_filename: null as string | null, batch_id: null as string | null }));
    } else {
      logs = (withFilename.data ?? []).map((row) => ({ ...row, batch_id: null as string | null }));
    }
  } else {
    logs = withBatch.data as LogRow[];
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

  // batch_id가 같으면 한 파일(한 번의 교정 실행)로 묶음. batch_id 없으면 행마다 한 건
  const byUserAndBatch = new Map<string, { input_filename: string | null; tokens_input: number; tokens_output: number; created_at: string | null }[]>();
  let singleIndex = 0;
  for (const row of logs ?? []) {
    const r = row as LogRow;
    const batchKey = r.batch_id ?? `single-${singleIndex++}`;
    const key = `${row.user_id}:${batchKey}`;
    const list = byUserAndBatch.get(key) ?? [];
    list.push({
      input_filename: row.input_filename ?? null,
      tokens_input: row.tokens_input ?? 0,
      tokens_output: row.tokens_output ?? 0,
      created_at: row.created_at ?? null,
    });
    byUserAndBatch.set(key, list);
  }

  for (const [key, list] of byUserAndBatch) {
    const user_id = key.split(':')[0];
    const tokens_input = list.reduce((s, d) => s + d.tokens_input, 0);
    const tokens_output = list.reduce((s, d) => s + d.tokens_output, 0);
    const created_at = list.map((d) => d.created_at).filter(Boolean).sort().pop() ?? null;
    const first = list[0];
    const cur = byUser.get(user_id) ?? {
      total_input: 0,
      total_output: 0,
      request_count: 0,
      last_used: null as string | null,
      details: [],
    };
    cur.total_input += tokens_input;
    cur.total_output += tokens_output;
    cur.request_count += 1;
    if (!cur.last_used || (created_at && created_at > cur.last_used)) {
      cur.last_used = created_at;
    }
    cur.details.push({
      input_filename: first?.input_filename ?? null,
      tokens_input,
      tokens_output,
      created_at,
    });
    byUser.set(user_id, cur);
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
