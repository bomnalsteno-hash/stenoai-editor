import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Header } from './Header';
import { FileText, ChevronRight, Copy, Download, Loader2, Keyboard, Trash2 } from 'lucide-react';

type DocRow = { id: string; title: string; created_at: string };

export const MyPage: React.FC = () => {
  const [list, setList] = useState<DocRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [content, setContent] = useState<string>('');
  const [originalContent, setOriginalContent] = useState<string>('');
  const [contentLoading, setContentLoading] = useState(false);
  const [copied, setCopied] = useState(false);
  const [groupMode, setGroupMode] = useState<'day' | 'month'>('day');

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
      setOriginalContent('');
      return;
    }
    setContentLoading(true);
    supabase
      .from('corrected_docs')
      .select('content, original_content, title, created_at')
      .eq('id', selectedId)
      .single()
      .then(({ data, error }) => {
        if (!error && data) {
          const row = data as { content: string; original_content?: string | null };
          setContent(row.content ?? '');
          setOriginalContent(row.original_content ?? '');
        } else {
          setContent('');
          setOriginalContent('');
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

  const handleDelete = async () => {
    if (!selectedId) return;
    const target = list.find((r) => r.id === selectedId);
    const name = target?.title ?? '이 교정본';
    if (!window.confirm(`'${name}' 기록을 삭제하시겠습니까? 되돌릴 수 없습니다.`)) return;
    const { error } = await supabase.from('corrected_docs').delete().eq('id', selectedId);
    if (!error) {
      const nextList = list.filter((r) => r.id !== selectedId);
      setList(nextList);
      setSelectedId(nextList.length > 0 ? nextList[0].id : null);
    }
  };

  const groupKey = (row: DocRow) => {
    const d = new Date(row.created_at);
    if (Number.isNaN(d.getTime())) return '기타';
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return groupMode === 'day' ? `${y}-${m}-${day}` : `${y}-${m}`;
  };

  const grouped = list.reduce<Record<string, DocRow[]>>((acc, row) => {
    const key = groupKey(row);
    if (!acc[key]) acc[key] = [];
    acc[key].push(row);
    return acc;
  }, {});
  const groupKeys = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1));

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
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-xl font-bold text-slate-800">교정한 파일</h1>
          {list.length > 0 && (
            <div className="inline-flex items-center rounded-lg border border-slate-200 bg-white overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setGroupMode('day')}
                className={`px-3 py-1.5 ${groupMode === 'day' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                일별
              </button>
              <button
                type="button"
                onClick={() => setGroupMode('month')}
                className={`px-3 py-1.5 border-l border-slate-200 ${groupMode === 'month' ? 'bg-indigo-50 text-indigo-700 font-semibold' : 'text-slate-500 hover:bg-slate-50'}`}
              >
                월별
              </button>
            </div>
          )}
        </div>

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
                {groupKeys.map((key) => (
                  <li key={key} className="border-b border-slate-100 last:border-b-0">
                    <div className="px-4 py-2 text-[11px] font-semibold text-slate-400 bg-slate-50 sticky top-0 z-10">
                      {groupMode === 'day' ? key : `${key.slice(0, 4)}년 ${key.slice(5, 7)}월`}
                    </div>
                    {grouped[key].map((row) => (
                      <button
                        key={row.id}
                        type="button"
                        onClick={() => setSelectedId(row.id)}
                        className={`w-full text-left px-4 py-3 border-b border-slate-50 hover:bg-indigo-50/50 transition-colors ${
                          selectedId === row.id ? 'bg-indigo-50 border-l-4 border-l-indigo-600' : 'border-l-4 border-l-transparent'
                        }`}
                      >
                        <div className="font-medium text-slate-800 truncate" title={row.title}>
                          {row.title}
                        </div>
                        <div className="text-xs text-slate-400 mt-0.5">{formatDate(row.created_at)}</div>
                      </button>
                    ))}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex-1 flex flex-col min-w-0 bg-white rounded-xl border border-slate-200 overflow-hidden">
              {selectedId ? (
                <>
                  <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between shrink-0">
                    <div className="flex flex-col">
                      <span className="font-medium text-slate-800 truncate">{selectedRow?.title}</span>
                      {selectedRow?.created_at && (
                        <span className="text-[11px] text-slate-400 mt-0.5">
                          교정 일시: {formatDate(selectedRow.created_at)}
                        </span>
                      )}
                    </div>
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
                      <button
                        type="button"
                        onClick={handleDelete}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-rose-50 text-rose-600 hover:bg-rose-100"
                      >
                        <Trash2 size={12} />
                        삭제
                      </button>
                    </div>
                  </div>
                  <div className="flex-1 overflow-auto p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* 원본 초안 */}
                    <div className="flex flex-col min-h-0 border border-slate-100 rounded-lg">
                      <div className="px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-500 bg-slate-50 flex items-center justify-between">
                        <span>교정 전 (STT 초안)</span>
                      </div>
                      <div className="flex-1 overflow-auto p-3">
                        {contentLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 size={20} className="animate-spin text-indigo-600" />
                          </div>
                        ) : (
                          <pre className="whitespace-pre-wrap font-sans text-slate-700 text-xs md:text-sm leading-relaxed">
                            {originalContent || '(저장된 교정 전 텍스트가 없습니다.)'}
                          </pre>
                        )}
                      </div>
                    </div>
                    {/* 교정 후 */}
                    <div className="flex flex-col min-h-0 border border-slate-100 rounded-lg">
                      <div className="px-3 py-2 border-b border-slate-100 text-xs font-semibold text-slate-500 bg-indigo-50/60 flex items-center justify-between">
                        <span>교정 후 (최종본)</span>
                      </div>
                      <div className="flex-1 overflow-auto p-3">
                        {contentLoading ? (
                          <div className="flex items-center justify-center py-8">
                            <Loader2 size={20} className="animate-spin text-indigo-600" />
                          </div>
                        ) : (
                          <pre className="whitespace-pre-wrap font-sans text-slate-700 text-xs md:text-sm leading-relaxed">
                            {content || '(내용 없음)'}
                          </pre>
                        )}
                      </div>
                    </div>
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
