import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, Loader2, ArrowLeft, User, Calendar, Hash } from 'lucide-react';

type UsageRow = {
  user_id: string;
  email: string | null;
  total_input: number;
  total_output: number;
  total_tokens: number;
  last_used: string | null;
  request_count: number;
};

export function Admin() {
  const { profile, session, loading: authLoading } = useAuth();
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        {loading ? (
          <div className="flex justify-center py-12">
            <Loader2 size={32} className="animate-spin text-indigo-600" />
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 border-b border-slate-200">
                  <tr>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 flex items-center gap-1">
                      <User size={14} /> 아이디(이메일)
                    </th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">요청 횟수</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">입력 토큰</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">출력 토큰</th>
                    <th className="text-right px-4 py-3 font-medium text-slate-600">총 토큰</th>
                    <th className="text-left px-4 py-3 font-medium text-slate-600 flex items-center gap-1">
                      <Calendar size={14} /> 마지막 사용
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {usage.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                        사용 기록이 없습니다.
                      </td>
                    </tr>
                  ) : (
                    usage.map((row) => (
                      <tr key={row.user_id} className="border-b border-slate-100 hover:bg-slate-50/50">
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
                        <td className="px-4 py-3 text-slate-600">
                          {row.last_used
                            ? new Date(row.last_used).toLocaleString('ko-KR', {
                                dateStyle: 'short',
                                timeStyle: 'short',
                              })
                            : '-'}
                        </td>
                      </tr>
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
