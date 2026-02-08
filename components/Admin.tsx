import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Loader2, ArrowLeft, User, Calendar, ChevronDown, ChevronRight, FileText, BarChart2, ArrowLeftRight } from 'lucide-react';

// Gemini 3 Flash Preview 단가 (USD/1M tokens): 입력 $0.50, 출력 $3.00
const COST_PER_1M_INPUT = 0.5;
const COST_PER_1M_OUTPUT = 3;

function estimateCostUsd(inputTokens: number, outputTokens: number): number {
  return (inputTokens * COST_PER_1M_INPUT) / 1e6 + (outputTokens * COST_PER_1M_OUTPUT) / 1e6;
}

type ViewMode = 'total' | 'daily' | 'monthly';
type AggregateBy = 'all' | 'user';
type CostCurrency = 'USD' | 'KRW';

type LogDetail = {
  input_filename: string | null;
  tokens_input: number;
  tokens_output: number;
  created_at: string | null;
};

type UsageRow = {
  user_id: string;
  email: string | null;
  total_input: number;
  total_output: number;
  total_tokens: number;
  last_used: string | null;
  request_count: number;
  details: LogDetail[];
};

export function Admin() {
  const { profile, session, loading: authLoading } = useAuth();
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('total');
  const [aggregateBy, setAggregateBy] = useState<AggregateBy>('all');
  const [costCurrency, setCostCurrency] = useState<CostCurrency>('USD');
  const [krwPerUsd, setKrwPerUsd] = useState<number | null>(null);

  useEffect(() => {
    if (!session?.access_token || profile?.role !== 'admin') return;
    (async () => {
      try {
        const base = import.meta.env.VITE_APP_URL ?? '';
        const res = await fetch(`${base}/api/admin/usage`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (!res.ok) throw new Error(res.status === 403 ? '관리자만 접근할 수 있습니다.' : '조회 실패');
        const data = await res.json();
        setUsage(data.usage ?? []);
      } catch (e: any) {
        setError(e.message ?? '데이터를 불러오지 못했습니다.');
      } finally {
        setLoading(false);
      }
    })();
  }, [session?.access_token, profile?.role]);

  useEffect(() => {
    const base = import.meta.env.VITE_APP_URL ?? '';
    fetch(`${base}/api/exchange-rate`)
      .then((r) => r.json())
      .then((d) => setKrwPerUsd(typeof d?.krwPerUsd === 'number' ? d.krwPerUsd : null))
      .catch(() => setKrwPerUsd(null));
  }, []);

  const dailyRows = useMemo(() => {
    const byDay = new Map<
      string,
      { request_count: number; total_input: number; total_output: number }
    >();
    for (const row of usage) {
      for (const d of row.details) {
        if (!d.created_at) continue;
        const day = new Date(d.created_at).toISOString().slice(0, 10);
        const cur = byDay.get(day) ?? {
          request_count: 0,
          total_input: 0,
          total_output: 0,
        };
        cur.request_count += 1;
        cur.total_input += d.tokens_input ?? 0;
        cur.total_output += d.tokens_output ?? 0;
        byDay.set(day, cur);
      }
    }
    return Array.from(byDay.entries())
      .map(([date, agg]) => ({
        date,
        request_count: agg.request_count,
        total_input: agg.total_input,
        total_output: agg.total_output,
        total_tokens: agg.total_input + agg.total_output,
        costUsd: estimateCostUsd(agg.total_input, agg.total_output),
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
  }, [usage]);

  const monthlyRows = useMemo(() => {
    const byMonth = new Map<
      string,
      { request_count: number; total_input: number; total_output: number }
    >();
    for (const row of usage) {
      for (const d of row.details) {
        if (!d.created_at) continue;
        const month = new Date(d.created_at).toISOString().slice(0, 7);
        const cur = byMonth.get(month) ?? {
          request_count: 0,
          total_input: 0,
          total_output: 0,
        };
        cur.request_count += 1;
        cur.total_input += d.tokens_input ?? 0;
        cur.total_output += d.tokens_output ?? 0;
        byMonth.set(month, cur);
      }
    }
    return Array.from(byMonth.entries())
      .map(([month, agg]) => ({
        month,
        request_count: agg.request_count,
        total_input: agg.total_input,
        total_output: agg.total_output,
        total_tokens: agg.total_input + agg.total_output,
        costUsd: estimateCostUsd(agg.total_input, agg.total_output),
      }))
      .sort((a, b) => b.month.localeCompare(a.month));
  }, [usage]);

  const dailyRowsByUser = useMemo(() => {
    const byKey = new Map<
      string,
      { date: string; user_id: string; email: string | null; request_count: number; total_input: number; total_output: number }
    >();
    for (const row of usage) {
      for (const d of row.details) {
        if (!d.created_at) continue;
        const date = new Date(d.created_at).toISOString().slice(0, 10);
        const key = `${date}_${row.user_id}`;
        const cur = byKey.get(key) ?? {
          date,
          user_id: row.user_id,
          email: row.email,
          request_count: 0,
          total_input: 0,
          total_output: 0,
        };
        cur.request_count += 1;
        cur.total_input += d.tokens_input ?? 0;
        cur.total_output += d.tokens_output ?? 0;
        byKey.set(key, cur);
      }
    }
    return Array.from(byKey.values())
      .map((v) => ({
        ...v,
        total_tokens: v.total_input + v.total_output,
        costUsd: estimateCostUsd(v.total_input, v.total_output),
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || (a.email ?? a.user_id).localeCompare(b.email ?? b.user_id));
  }, [usage]);

  const monthlyRowsByUser = useMemo(() => {
    const byKey = new Map<
      string,
      { month: string; user_id: string; email: string | null; request_count: number; total_input: number; total_output: number }
    >();
    for (const row of usage) {
      for (const d of row.details) {
        if (!d.created_at) continue;
        const month = new Date(d.created_at).toISOString().slice(0, 7);
        const key = `${month}_${row.user_id}`;
        const cur = byKey.get(key) ?? {
          month,
          user_id: row.user_id,
          email: row.email,
          request_count: 0,
          total_input: 0,
          total_output: 0,
        };
        cur.request_count += 1;
        cur.total_input += d.tokens_input ?? 0;
        cur.total_output += d.tokens_output ?? 0;
        byKey.set(key, cur);
      }
    }
    return Array.from(byKey.values())
      .map((v) => ({
        ...v,
        total_tokens: v.total_input + v.total_output,
        costUsd: estimateCostUsd(v.total_input, v.total_output),
      }))
      .sort((a, b) => b.month.localeCompare(a.month) || (a.email ?? a.user_id).localeCompare(b.email ?? b.user_id));
  }, [usage]);

  const formatCost = (usd: number) => {
    if (costCurrency === 'KRW' && krwPerUsd != null) {
      return `₩${(usd * krwPerUsd).toLocaleString('ko-KR', { maximumFractionDigits: 0 })}`;
    }
    return `$${usd.toFixed(4)}`;
  };

  const toggleCostCurrency = () => setCostCurrency((c) => (c === 'USD' ? 'KRW' : 'USD'));

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <Loader2 size={32} className="animate-spin text-indigo-600" />
      </div>
    );
  }

  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <p className="text-slate-600 font-medium">로그인이 필요합니다.</p>
          <Link to="/login?redirect=/admin" className="mt-2 inline-block text-indigo-600 hover:underline">
            로그인
          </Link>
        </div>
      </div>
    );
  }

  if (profile?.role !== 'admin') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <p className="text-slate-600 font-medium">관리자만 접근할 수 있습니다.</p>
          <Link to="/" className="mt-2 inline-block text-indigo-600 hover:underline">
            에디터로 돌아가기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="p-2 bg-indigo-600 rounded-lg text-white">
            <ArrowLeft size={20} />
          </Link>
          <div className="flex items-center gap-2">
            <Shield size={24} className="text-indigo-600" />
            <div>
              <h1 className="text-xl font-bold text-slate-800">관리자</h1>
              <p className="text-xs text-slate-500">토큰 사용량 조회</p>
            </div>
          </div>
        </div>
      </header>

      <main className="p-6 max-w-5xl mx-auto">
        {error && (
          <div className="mb-4 text-sm text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {!loading && (
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <span className="text-sm text-slate-500 mr-1">보기:</span>
            {(['total', 'daily', 'monthly'] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setViewMode(mode)}
                className={`
                  flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition-colors
                  ${viewMode === mode ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}
                `}
              >
                {mode === 'total' && <User size={14} />}
                {mode === 'daily' && <Calendar size={14} />}
                {mode === 'monthly' && <BarChart2 size={14} />}
                {mode === 'total' ? '전체(사용자별)' : mode === 'daily' ? '일별' : '월별'}
              </button>
            ))}
            {(viewMode === 'daily' || viewMode === 'monthly') && (
              <>
                <span className="text-slate-300 mx-1">|</span>
                <span className="text-sm text-slate-500 mr-1">집계:</span>
                <button
                  type="button"
                  onClick={() => setAggregateBy('all')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${aggregateBy === 'all' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  전체
                </button>
                <button
                  type="button"
                  onClick={() => setAggregateBy('user')}
                  className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${aggregateBy === 'user' ? 'bg-indigo-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  아이디별
                </button>
              </>
            )}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={32} className="animate-spin text-indigo-600" />
          </div>
        ) : viewMode === 'daily' && aggregateBy === 'all' ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">날짜</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">요청 횟수</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">입력 토큰</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">출력 토큰</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">총 토큰</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">
                      예상 비용 <ArrowLeftRight size={14} className="inline ml-1 text-slate-400" title="클릭 시 달러↔원화" aria-label="클릭 시 달러↔원화" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        일별 기록이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    dailyRows.map((row) => (
                      <tr key={row.date} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-800">{row.date}</td>
                        <td className="text-right px-4 py-3 text-slate-700">{row.request_count}</td>
                        <td className="text-right px-4 py-3 text-slate-700">{row.total_input.toLocaleString()}</td>
                        <td className="text-right px-4 py-3 text-slate-700">{row.total_output.toLocaleString()}</td>
                        <td className="text-right px-4 py-3 font-medium text-slate-800">{row.total_tokens.toLocaleString()}</td>
                        <td
                          className="text-right px-4 py-3 font-medium text-slate-700 cursor-pointer select-none hover:bg-amber-50 rounded"
                          onClick={toggleCostCurrency}
                          title="클릭하면 달러↔원화 전환"
                        >
                          {formatCost(row.costUsd)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : viewMode === 'daily' && aggregateBy === 'user' ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">날짜</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">아이디(이메일)</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">요청 횟수</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">입력 토큰</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">출력 토큰</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">총 토큰</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">
                      예상 비용 <ArrowLeftRight size={14} className="inline ml-1 text-slate-400" title="클릭 시 달러↔원화" aria-label="클릭 시 달러↔원화" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {dailyRowsByUser.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        일별(아이디별) 기록이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    dailyRowsByUser.map((row, i) => (
                      <tr key={`${row.date}_${row.user_id}_${i}`} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-800">{row.date}</td>
                        <td className="px-4 py-3 text-slate-700">{row.email ?? row.user_id}</td>
                        <td className="text-right px-4 py-3 text-slate-700">{row.request_count}</td>
                        <td className="text-right px-4 py-3 text-slate-700">{row.total_input.toLocaleString()}</td>
                        <td className="text-right px-4 py-3 text-slate-700">{row.total_output.toLocaleString()}</td>
                        <td className="text-right px-4 py-3 font-medium text-slate-800">{row.total_tokens.toLocaleString()}</td>
                        <td
                          className="text-right px-4 py-3 font-medium text-slate-700 cursor-pointer select-none hover:bg-amber-50 rounded"
                          onClick={toggleCostCurrency}
                          title="클릭하면 달러↔원화 전환"
                        >
                          {formatCost(row.costUsd)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : viewMode === 'monthly' && aggregateBy === 'all' ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">월</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">요청 횟수</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">입력 토큰</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">출력 토큰</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">총 토큰</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">
                      예상 비용 <ArrowLeftRight size={14} className="inline ml-1 text-slate-400" title="클릭 시 달러↔원화" aria-label="클릭 시 달러↔원화" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        월별 기록이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    monthlyRows.map((row) => (
                      <tr key={row.month} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-800">{row.month}</td>
                        <td className="text-right px-4 py-3 text-slate-700">{row.request_count}</td>
                        <td className="text-right px-4 py-3 text-slate-700">{row.total_input.toLocaleString()}</td>
                        <td className="text-right px-4 py-3 text-slate-700">{row.total_output.toLocaleString()}</td>
                        <td className="text-right px-4 py-3 font-medium text-slate-800">{row.total_tokens.toLocaleString()}</td>
                        <td
                          className="text-right px-4 py-3 font-medium text-slate-700 cursor-pointer select-none hover:bg-amber-50 rounded"
                          onClick={toggleCostCurrency}
                          title="클릭하면 달러↔원화 전환"
                        >
                          {formatCost(row.costUsd)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : viewMode === 'monthly' && aggregateBy === 'user' ? (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">월</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">아이디(이메일)</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">요청 횟수</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">입력 토큰</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">출력 토큰</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">총 토큰</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">
                      예상 비용 <ArrowLeftRight size={14} className="inline ml-1 text-slate-400" title="클릭 시 달러↔원화" aria-label="클릭 시 달러↔원화" />
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {monthlyRowsByUser.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        월별(아이디별) 기록이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    monthlyRowsByUser.map((row, i) => (
                      <tr key={`${row.month}_${row.user_id}_${i}`} className="border-b border-slate-100 hover:bg-slate-50/50">
                        <td className="px-4 py-3 font-medium text-slate-800">{row.month}</td>
                        <td className="px-4 py-3 text-slate-700">{row.email ?? row.user_id}</td>
                        <td className="text-right px-4 py-3 text-slate-700">{row.request_count}</td>
                        <td className="text-right px-4 py-3 text-slate-700">{row.total_input.toLocaleString()}</td>
                        <td className="text-right px-4 py-3 text-slate-700">{row.total_output.toLocaleString()}</td>
                        <td className="text-right px-4 py-3 font-medium text-slate-800">{row.total_tokens.toLocaleString()}</td>
                        <td
                          className="text-right px-4 py-3 font-medium text-slate-700 cursor-pointer select-none hover:bg-amber-50 rounded"
                          onClick={toggleCostCurrency}
                          title="클릭하면 달러↔원화 전환"
                        >
                          {formatCost(row.costUsd)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="w-10 px-2 py-3" />
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      <User size={14} className="inline mr-1" /> 아이디(이메일)
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">요청 횟수</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">입력 토큰</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">출력 토큰</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">총 토큰</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">
                      예상 비용 <ArrowLeftRight size={14} className="inline ml-1 text-slate-400" title="클릭 시 달러↔원화" aria-label="클릭 시 달러↔원화" />
                    </th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600">
                      <Calendar size={14} className="inline mr-1" /> 마지막 사용
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usage.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-8 text-center text-slate-500">
                        사용 기록이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    usage.map((row) => (
                      <React.Fragment key={row.user_id}>
                        <tr className="border-b border-slate-100 hover:bg-slate-50/50">
                          <td className="px-2 py-3">
                            {row.details.length > 0 ? (
                              <button
                                type="button"
                                onClick={() => setExpandedUserId((id) => (id === row.user_id ? null : row.user_id))}
                                className="p-1 rounded hover:bg-slate-200 text-slate-500"
                                aria-label={expandedUserId === row.user_id ? '접기' : '로그 펼치기'}
                              >
                                {expandedUserId === row.user_id ? (
                                  <ChevronDown size={18} />
                                ) : (
                                  <ChevronRight size={18} />
                                )}
                              </button>
                            ) : null}
                          </td>
                          <td className="px-4 py-3">
                            <span className="font-medium text-slate-800">{row.email ?? row.user_id}</span>
                            {row.email ? (
                              <span className="block text-xs text-slate-400 font-mono">{row.user_id}</span>
                            ) : null}
                          </td>
                          <td className="text-right px-4 py-3 text-slate-700">{row.request_count}</td>
                          <td className="text-right px-4 py-3 text-slate-700">{row.total_input.toLocaleString()}</td>
                          <td className="text-right px-4 py-3 text-slate-700">{row.total_output.toLocaleString()}</td>
                          <td className="text-right px-4 py-3 font-medium text-slate-800">{row.total_tokens.toLocaleString()}</td>
                          <td
                            className="text-right px-4 py-3 text-slate-700 font-medium cursor-pointer select-none hover:bg-amber-50 rounded"
                            onClick={toggleCostCurrency}
                            title="클릭하면 달러↔원화 전환"
                          >
                            {formatCost(estimateCostUsd(row.total_input, row.total_output))}
                          </td>
                          <td className="px-4 py-3 text-slate-600">
                            {row.last_used
                              ? new Date(row.last_used).toLocaleString('ko-KR', {
                                  dateStyle: 'short',
                                  timeStyle: 'short',
                                })
                              : '-'}
                          </td>
                        </tr>
                        {expandedUserId === row.user_id && row.details.length > 0 ? (
                          <tr className="bg-slate-50/80">
                            <td colSpan={8} className="px-4 py-3">
                              <div className="text-xs font-medium text-slate-500 mb-2 flex items-center gap-1">
                                <FileText size={12} /> 로그 기록 (요청별)
                              </div>
                              <table className="w-full text-sm border border-slate-200 rounded-lg overflow-hidden bg-white">
                                <thead>
                                  <tr className="bg-slate-100">
                                    <th className="text-left px-3 py-2 font-medium text-slate-600">파일명</th>
                                    <th className="text-right px-3 py-2 font-medium text-slate-600">입력 토큰</th>
                                    <th className="text-right px-3 py-2 font-medium text-slate-600">출력 토큰</th>
                                    <th className="text-right px-3 py-2 font-medium text-slate-600">
                                    예상 비용 <ArrowLeftRight size={14} className="inline ml-1 text-slate-400" title="클릭 시 달러↔원화" aria-label="클릭 시 달러↔원화" />
                                  </th>
                                    <th className="text-left px-3 py-2 font-medium text-slate-600">사용 시각</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {row.details.map((d, i) => (
                                      <tr key={i} className="border-t border-slate-100">
                                        <td className="px-3 py-2 text-slate-700">
                                          {d.input_filename && d.input_filename.trim() !== '' ? d.input_filename : '(붙여넣기)'}
                                        </td>
                                        <td className="text-right px-3 py-2 text-slate-700">
                                          {d.tokens_input.toLocaleString()}
                                        </td>
                                        <td className="text-right px-3 py-2 text-slate-700">
                                          {d.tokens_output.toLocaleString()}
                                        </td>
                                        <td
                                        className="text-right px-3 py-2 text-slate-700 font-medium cursor-pointer select-none hover:bg-amber-50 rounded"
                                        onClick={toggleCostCurrency}
                                        title="클릭하면 달러↔원화 전환"
                                      >
                                        {formatCost(estimateCostUsd(d.tokens_input, d.tokens_output))}
                                      </td>
                                        <td className="px-3 py-2 text-slate-600">
                                          {d.created_at
                                            ? new Date(d.created_at).toLocaleString('ko-KR', {
                                                dateStyle: 'short',
                                                timeStyle: 'short',
                                              })
                                            : '-'}
                                        </td>
                                      </tr>
                                    ))}
                                </tbody>
                              </table>
                            </td>
                          </tr>
                        ) : null}
                      </React.Fragment>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
