import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Header } from './Header';
import { FileText, ChevronRight, Copy, Download, Loader2, Keyboard } from 'lucide-react';

type DocRow = { id: string; title: string; created_at: string };

export const MyPage: React.FC = () => {
  const [list, setList] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [contentLoading, setContentLoading] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase
        .from('corrected_docs')
        .select('id, title, created_at')
        .order('created_at', { ascending: false });
      if (!error) setList(data ?? []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!selectedId) {
      setContent('');
      return;
    }
    setContentLoading(true);
    supabase
      .from('corrected_docs')
      .select('content, title')
      .eq('id', selectedId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          setContent((data as { content: string }).content ?? '');
        } else {
          setContent('');
        }
        setContentLoading(false);
      });
  }, [selectedId]);

  const selectedRow = list.find((r) => r.id === selectedId);
  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleString('ko-KR', { dateStyle: 'short', timeStyle: 'short' });
    } catch {
      return iso;
    }
  };

  const handleCopy = () => {
    if (!content) return;
    navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    if (!content) return;
    const name = selectedRow?.title?.replace(/\.txt$/i, '') ?? '교정본';
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name.endsWith('.txt') ? name : `${name}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full flex flex-col bg-slate-50">
      <Header />
      <main className="flex-1 flex flex-col min-h-0 p-6">
        <div className="flex items-center gap-2 mb-4">
          <Link to="/" className="text-sm text-slate-500 hover:text-indigo-600 flex items-center gap-1">
            <Keyboard size={14} />
            편집기
          </Link>
          <ChevronRight size={14} className="text-slate-400" />
          <span className="text-sm font-medium text-slate-700">마이페이지</span>
        </div>
        <h1 className="text-xl font-bold text-slate-800 mb-4">교정한 파일</h1>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 size={28} className="animate-spin text-indigo-600" />
          </div>
        ) : list.length === 0 ? (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center text-slate-500">
            <FileText size={40} className="mx-auto mb-2 opacity-40" />
            <p>아직 저장된 교정본이 없습니다.</p>
            <p className="text-sm mt-1">편집기에서 AI 교정을 실행하면 여기에 자동으로 저장됩니다.</p>
            <Link to="/" className="inline-block mt-4 px-4 py-2 bg-indigo-600 text-white text-sm font-medium rounded-lg hover:bg-indigo-700">
              편집기로 이동
            </Link>
          </div>
        ) : (
          <div className="flex-1 flex gap-4 min-h-0">
            <div className="w-80 shrink-0 bg-white rounded-xl border border-slate-200 overflow-hidden flex flex-col">
              <div className="px-4 py-3 border-b border-slate-200 text-sm font-medium text-slate-600">
                목록 ({list.length}건)
              </div>
              <ul className="flex-1 overflow-y-auto">
                {list.map((row) => (
                  <li key={row.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(row.id)}
                      className={`w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-indigo-50/50 transition-colors ${selectedId === row.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'border-l-4 border-l-transparent'}`}
                    >
                      <div className="font-medium text-slate-800 truncate" title={row.title}>
                        {row.title}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5">{formatDate(row.created_at)}</div>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 flex flex-col min-w-0 bg-white rounded-xl border border-slate-200 overflow-hidden">
              {selectedId ? (
                <>
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
                    <span className="font-medium text-slate-800 truncate">{selectedRow?.title}</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCopy}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-100 text-slate-600 hover:bg-slate-200"
                      >
                        {copied ? '복사됨' : '복사'}
                        {copied ? null : <Copy size={12} />}
                      </button>
                      <button
                        type="button"
                        onClick={handleDownload}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                      >
                        다운로드
                        <Download size={12} />
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto p-4">
                    {contentLoading ? (
                      <div className="flex items-center justify-center py-12">
                        <Loader2 size={24} className="animate-spin text-indigo-600" />
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap font-sans text-slate-700 text-sm leading-relaxed">
                        {content || '(내용 없음)'}
                      </pre>
                    )}
                  </div>
                </>
              ) : (
                <div className="flex-1 flex items-center justify-center text-slate-400">
                  <div className="text-center">
                    <FileText size={36} className="mx-auto mb-2 opacity-30" />
                    <p className="text-sm">목록에서 항목을 선택하면 내용을 볼 수 있습니다.</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};
