import React, { useState, useCallback, useRef, useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { correctTranscript } from '../services/geminiService';
import { ArrowRight, Copy, Sparkles, CheckCheck, FileText, Eraser, Download, Upload } from 'lucide-react';

/** 문단 구분: 빈 줄(\n\n) 기준. 빈 줄이 없으면 한 줄씩(\n) 기준 */
function splitParagraphs(text: string): string[] {
  if (!text.trim()) return [];
  const byDouble = text.split(/\n\n+/).map((s) => s.trim()).filter(Boolean);
  if (byDouble.length > 1) return byDouble;
  return text.split(/\n/).map((s) => s.trim()).filter(Boolean);
}

/** 각 문단의 start/end 문자 위치 (textarea selection용). splitParagraphs와 같은 경계 사용 */
function getParagraphRanges(text: string): { start: number; end: number }[] {
  if (!text.trim()) return [];
  const raw = text.replace(/\r\n/g, '\n');
  const hasDouble = /\n\n+/.test(raw);
  const sep = hasDouble ? /\n\n+/ : /\n/;
  const boundaries: number[] = [0];
  let match: RegExpExecArray | null;
  const re = new RegExp(sep.source, 'g');
  while ((match = re.exec(raw)) !== null) {
    boundaries.push(match.index + match[0].length);
  }
  boundaries.push(raw.length);
  const ranges: { start: number; end: number }[] = [];
  for (let i = 0; i < boundaries.length - 1; i++) {
    const start = boundaries[i];
    const end = boundaries[i + 1];
    if (raw.slice(start, end).trim()) ranges.push({ start, end });
  }
  return ranges.length ? ranges : [{ start: 0, end: raw.length }];
}

interface EditorProps {}

export const Editor: React.FC<EditorProps> = () => {
  const { session } = useAuth();
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState<boolean>(false);
  const [inputFileName, setInputFileName] = useState<string | null>(null);
  const [selectedParagraphIndex, setSelectedParagraphIndex] = useState<number | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputFileNameRef = useRef<string | null>(null);
  inputFileNameRef.current = inputFileName;
  const outputPanelRef = useRef<HTMLDivElement>(null);
  const outputParagraphRefs = useRef<(HTMLParagraphElement | null)[]>([]);

  const inputRanges = useMemo(() => getParagraphRanges(inputText), [inputText]);
  const inputParagraphs = useMemo(() => splitParagraphs(inputText), [inputText]);
  const outputParagraphs = useMemo(() => splitParagraphs(outputText), [outputText]);

  const handleDownload = useCallback(() => {
    if (!outputText) return;
    const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = inputFileName ?? `stenoai-교정본-${new Date().toISOString().slice(0, 19).replace(/[-:T]/g, '').slice(0, 12)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [outputText, inputFileName]);

  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (!file) return;
    const name = file.name.toLowerCase();
    if (!name.endsWith('.txt')) {
      setError('TXT 파일만 넣을 수 있습니다.');
      return;
    }
    setError(null);
    setInputFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setInputText(String(reader.result ?? ''));
    reader.readAsText(file, 'UTF-8');
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleCorrect = useCallback(async () => {
    if (!inputText.trim()) return;

    setIsProcessing(true);
    setError(null);
    setSelectedParagraphIndex(null);
    setOutputText(''); // Clear previous output to show loading state effectively

    try {
      if (!session?.access_token) throw new Error('로그인이 필요합니다.');
      const filenameToSend = inputFileNameRef.current ?? inputFileName;
      const result = await correctTranscript(inputText, session.access_token, filenameToSend);
      setOutputText(result);
    } catch (err: any) {
      setError(err.message || "교정 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsProcessing(false);
    }
  }, [inputText, session?.access_token, inputFileName]);

  const handleCopy = useCallback(() => {
    if (!outputText) return;
    navigator.clipboard.writeText(outputText);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [outputText]);

  const handleClear = useCallback(() => {
    if (window.confirm('입력된 내용과 결과가 모두 지워집니다. 계속하시겠습니까?')) {
      setInputText('');
      setOutputText('');
      setError(null);
      setInputFileName(null);
      setSelectedParagraphIndex(null);
    }
  }, []);

  const onInputClickForSync = useCallback(() => {
    const ta = textareaRef.current;
    if (!ta || !outputParagraphs.length) return;
    const cursor = ta.selectionStart;
    const idx = inputRanges.findIndex((r) => cursor >= r.start && cursor <= r.end);
    if (idx === -1) return;
    setSelectedParagraphIndex(idx);
    const r = inputRanges[idx];
    ta.setSelectionRange(r.start, r.end);
    ta.focus();
    requestAnimationFrame(() => {
      outputParagraphRefs.current[idx]?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    });
  }, [outputParagraphs.length, inputRanges]);

  const onOutputParagraphClick = useCallback(
    (index: number) => {
      setSelectedParagraphIndex(index);
      const ta = textareaRef.current;
      if (ta && inputRanges.length > 0) {
        const safeIdx = Math.min(index, inputRanges.length - 1);
        const r = inputRanges[safeIdx];
        ta.setSelectionRange(r.start, r.end);
        ta.focus();
        ta.scrollTop = Math.max(0, ta.scrollHeight * (r.start / (inputText.length || 1)) - ta.clientHeight / 2);
      }
    },
    [inputRanges, inputText.length]
  );

  return (
    <main className="flex-1 flex flex-col min-h-0 relative">
      {/* Toolbar / Action Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 shadow-sm z-10">
        <div className="flex items-center gap-4">
          <button
            onClick={handleClear}
            disabled={!inputText && !outputText}
            className="flex items-center gap-2 text-sm text-slate-500 hover:text-red-600 disabled:opacity-30 disabled:hover:text-slate-500 transition-colors px-3 py-2 rounded-md hover:bg-slate-50"
          >
            <Eraser size={16} />
            <span>초기화</span>
          </button>
        </div>

        <div className="flex items-center gap-3">
          {error && (
            <span className="text-sm text-red-500 font-medium px-4 animate-pulse">
              {error}
            </span>
          )}
          <button
            onClick={handleCorrect}
            disabled={isProcessing || !inputText.trim()}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white shadow-md transition-all
              ${isProcessing 
                ? 'bg-indigo-400 cursor-not-allowed' 
                : !inputText.trim() 
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500' 
                  : 'bg-indigo-600 hover:bg-indigo-700 hover:shadow-lg active:scale-95'}
            `}
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>교정 중...</span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>AI 교정 시작</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Split Editor Area */}
      <div className="flex-1 flex flex-col md:flex-row min-h-0 bg-slate-50">
        
        {/* Input Panel */}
        <div className="flex-1 flex flex-col border-b md:border-b-0 md:border-r border-slate-200 min-h-[50%] md:min-h-0">
          <div className="bg-slate-100 px-4 py-2 border-b border-slate-200 flex items-center justify-between">
            <div className="flex items-center gap-2 text-slate-600 font-medium text-sm">
              <FileText size={14} />
              <span>STT 초안 (Draft)</span>
            </div>
            <span className="text-xs text-slate-400">{inputText.length}자</span>
          </div>
          <div
            className={`flex-1 relative group border-2 border-dashed rounded-lg transition-colors ${dragOver ? 'border-indigo-400 bg-indigo-50/30' : 'border-transparent'}`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleFileDrop}
          >
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onClick={outputText ? onInputClickForSync : undefined}
              placeholder="여기에 음성 인식(STT) 초안 텍스트를 붙여넣거나, TXT 파일을 드래그 앤 드롭하세요..."
              className="w-full h-full p-6 resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/10 bg-white text-slate-700 leading-relaxed text-base font-sans rounded-lg"
              spellCheck={false}
            />
            {!inputText && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300 rounded-lg">
                <div className="text-center">
                  <Upload className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">텍스트 입력·붙여넣기 또는 TXT 파일 드래그 앤 드롭</p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Output Panel */}
        <div className="flex-1 flex flex-col min-h-[50%] md:min-h-0 bg-white">
          <div className="bg-indigo-50/50 px-4 py-2 border-b border-indigo-100 flex items-center justify-between">
            <div className="flex items-center gap-2 text-indigo-700 font-medium text-sm">
              <Sparkles size={14} />
              <span>교정 완료 (Final)</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleDownload}
                disabled={!outputText}
                className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
              >
                <Download size={12} />
                다운로드
              </button>
              <button
                onClick={handleCopy}
                disabled={!outputText}
                className={`
                  flex items-center gap-1.5 px-3 py-1 rounded text-xs font-medium transition-all
                  ${copied 
                    ? 'bg-green-100 text-green-700 border border-green-200' 
                    : 'bg-white text-slate-600 border border-slate-200 hover:border-indigo-300 hover:text-indigo-600'}
                  disabled:opacity-50 disabled:cursor-not-allowed
                `}
              >
                {copied ? <CheckCheck size={12} /> : <Copy size={12} />}
                {copied ? '복사됨' : '결과 복사'}
              </button>
            </div>
          </div>
          <div ref={outputPanelRef} className="flex-1 relative bg-indigo-50/10 overflow-auto">
            {isProcessing ? (
               <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-white/50 backdrop-blur-sm">
                  <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                  <p className="text-slate-500 text-sm font-medium animate-pulse">전문가가 교정 중입니다...</p>
                  <p className="text-slate-400 text-xs mt-2">문맥 파악 및 오류 수정 중</p>
               </div>
            ) : null}

            {outputText ? (
              <div className="p-6 space-y-4">
                {outputParagraphs.map((para, i) => (
                  <p
                    key={i}
                    ref={(el) => {
                      outputParagraphRefs.current[i] = el;
                    }}
                    onClick={() => onOutputParagraphClick(i)}
                    className={`
                      leading-relaxed text-base font-sans text-slate-800 cursor-pointer rounded-md py-1 px-2 -mx-2 transition-colors
                      ${selectedParagraphIndex === i ? 'bg-amber-200/80 ring-1 ring-amber-400/60' : 'hover:bg-indigo-100/60'}
                    `}
                  >
                    {para}
                  </p>
                ))}
              </div>
            ) : null}

            {!outputText && !isProcessing && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300">
                <div className="text-center">
                  <ArrowRight className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">교정 시작 버튼을 눌러주세요</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};