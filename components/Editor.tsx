import React, { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { correctTranscript, correctTranscriptChunked, CHUNK_SIZE } from '../services/geminiService';
import { ArrowRight, Copy, Sparkles, CheckCheck, FileText, Eraser, Download, Upload } from 'lucide-react';

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
  const [chunkProgress, setChunkProgress] = useState<{ current: number; total: number } | null>(null);
  const [remainingText, setRemainingText] = useState<string | null>(null);
  const [autoMode, setAutoMode] = useState<boolean>(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const inputFileNameRef = useRef<string | null>(null);
  inputFileNameRef.current = inputFileName;

  const remainingTextRef = useRef<string | null>(null);
  remainingTextRef.current = remainingText;

  const autoModeRef = useRef<boolean>(false);
  autoModeRef.current = autoMode;

  const autoAttemptRef = useRef<number>(0);
  const MAX_AUTO_ATTEMPTS = 10;

  // 브라우저 알림 권한 요청 (최초 1회, 가능할 때만)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'default') {
      Notification.requestPermission().catch(() => undefined);
    }
  }, []);

  const notifyWhenHidden = useCallback((title: string, body: string) => {
    if (typeof window === 'undefined') return;
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (document.visibilityState === 'visible') return;
    try {
      new Notification(title, { body });
    } catch {
      // 일부 브라우저에서 예외가 날 수 있으므로 조용히 무시
    }
  }, []);

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
    inputFileNameRef.current = file.name;
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
    const baseText = (remainingText ?? inputText).trim();
    if (!baseText) return;

    setIsProcessing(true);
    setError(null);
    // 이어서 교정하는 경우에는 이미 나온 결과는 유지하고, 처음부터 시작할 때만 초기화
    if (!remainingText) {
      setOutputText('');
    }
    setChunkProgress(null);

    try {
      if (!session?.access_token) throw new Error('로그인이 필요합니다.');
      const filenameToSend = inputFileNameRef.current ?? inputFileName;
      const useChunked = baseText.length > CHUNK_SIZE;
      const result = useChunked
        ? await correctTranscriptChunked(
            baseText,
            session.access_token,
            filenameToSend,
            (current, total) => setChunkProgress({ current, total })
          )
        : await correctTranscript(inputText, session.access_token, filenameToSend);
      // 모든 구간이 성공적으로 끝난 경우: 이어서 모드였다면 기존 결과 뒤에 붙이고, 아니면 전체 교정 결과로 사용
      if (remainingText && outputText) {
        const sep = outputText.endsWith('\n') || result.startsWith('\n') ? '' : '\n\n';
        setOutputText(outputText + sep + result);
      } else {
        setOutputText(result);
      }
      setRemainingText(null);
    } catch (err: any) {
      if (err?.partialResult) {
        // 청크 모드에서 일부 구간까지만 성공한 경우, 해당 부분이라도 결과 영역에 이어서 표시
        setOutputText((prev) => {
          if (!prev) return err.partialResult;
          const sep = prev.endsWith('\n') || String(err.partialResult).startsWith('\n') ? '' : '\n\n';
          return prev + sep + err.partialResult;
        });
        if (err.remainingText) {
          setRemainingText(String(err.remainingText));
        }
      }
      setError(err.message || '교정 중 오류가 발생했습니다. 다시 시도해주세요.');
    } finally {
      setIsProcessing(false);
      setChunkProgress(null);
    }
  }, [inputText, remainingText, session?.access_token, inputFileName, outputText]);

  const handleStartAuto = useCallback(async () => {
    if (isProcessing || autoMode) return;
    const baseText = (remainingText ?? inputText).trim();
    if (!baseText) return;
    setAutoMode(true);
    autoAttemptRef.current = 0;
    setError(null);
    await handleCorrect();
  }, [autoMode, handleCorrect, inputText, isProcessing, remainingText]);

  const handleStopAuto = useCallback(() => {
    setAutoMode(false);
    autoAttemptRef.current = 0;
  }, []);

  // 자동 모드일 때, 실패하거나 일부만 교정된 경우 남은 텍스트가 있으면 알아서 다음 턴을 이어서 실행
  useEffect(() => {
    if (!autoModeRef.current) return;
    if (isProcessing) return;
    const baseText = (remainingTextRef.current ?? inputText).trim();
    const hasRemaining = !!baseText;

    if (!autoModeRef.current) return;

    // 남은 텍스트가 없으면 자동 모드 종료
    if (!hasRemaining) {
      setAutoMode(false);
      autoAttemptRef.current = 0;
      return;
    }

    // 재시도 한도 초과 시 자동 모드 종료
    if (autoAttemptRef.current >= MAX_AUTO_ATTEMPTS) {
      setAutoMode(false);
      autoAttemptRef.current = 0;
      return;
    }

    // 다음 턴을 살짝 텀을 두고 자동 실행 (부분 성공이든 전체 실패든 남은 텍스트가 있으면 재시도)
    const id = window.setTimeout(() => {
      if (!autoModeRef.current) return;
      autoAttemptRef.current += 1;
      setError(null);
      handleCorrect();
    }, 2000);

    return () => window.clearTimeout(id);
  }, [handleCorrect, inputText, isProcessing]);

  // 한 턴이 끝날 때(처리 중 -> 대기 상태로 바뀔 때) 백그라운드 탭이라면 브라우저 알림
  const prevProcessingRef = useRef<boolean>(false);
  useEffect(() => {
    const wasProcessing = prevProcessingRef.current;
    prevProcessingRef.current = isProcessing;
    if (wasProcessing && !isProcessing) {
      // 턴 종료 시점
      if (!remainingTextRef.current) {
        notifyWhenHidden('StenoAI 교정 완료', '교정이 완료되었습니다. 결과를 확인해 주세요.');
      } else if (!autoModeRef.current) {
        notifyWhenHidden('StenoAI 일부 교정 완료', '일부 구간까지만 교정되었습니다. 이어서 교정하기를 눌러주세요.');
      }
    }
  }, [isProcessing, notifyWhenHidden]);

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
      setRemainingText(null);
    }
  }, []);

  return (
    <main className="flex-1 flex flex-col min-h-0 relative">
      {/* Toolbar / Action Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-3 flex items-center justify-between shrink-0 z-10">
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
            disabled={isProcessing || !inputText.trim() || autoMode}
            className={`
              flex items-center gap-2 px-6 py-2.5 rounded-lg text-sm font-semibold text-white shadow-md transition-all
              ${isProcessing 
                ? 'bg-indigo-400 cursor-not-allowed' 
                : !inputText.trim() 
                  ? 'bg-slate-300 cursor-not-allowed text-slate-500' 
                  : 'bg-indigo-600 hover:bg-indigo-700 shadow-lg active:scale-95'}
            `}
          >
            {isProcessing ? (
              <>
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                <span>
                  {remainingText ? '이어 교정 중...' : '교정 중...'}
                  {chunkProgress ? ` (${chunkProgress.current}/${chunkProgress.total})` : ''}
                </span>
              </>
            ) : (
              <>
                <Sparkles size={16} />
                <span>{remainingText ? '이어서 교정하기' : 'AI 교정 시작'}</span>
              </>
            )}
          </button>
          <button
            onClick={autoMode ? handleStopAuto : handleStartAuto}
            disabled={isProcessing || !inputText.trim()}
            className={`
              flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border transition-all
              ${
                autoMode
                  ? 'border-rose-300 text-rose-600 bg-rose-50 hover:bg-rose-100'
                  : 'border-indigo-200 text-indigo-600 bg-white hover:bg-indigo-50'
              }
            `}
          >
            {autoMode ? '자동 교정 중지' : '끝까지 자동 교정'}
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
          <div className="flex-1 relative bg-indigo-50/10">
            {isProcessing ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-white/50 backdrop-blur-sm">
                <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4" />
                <p className="text-slate-500 text-sm font-medium animate-pulse">전문가가 교정 중입니다...</p>
                <p className="text-slate-400 text-xs mt-2">
                  {chunkProgress ? `${chunkProgress.current}/${chunkProgress.total} 구간 교정 중` : '문맥 파악 및 오류 수정 중'}
                </p>
              </div>
            ) : null}

            <textarea
              readOnly
              value={outputText}
              placeholder={isProcessing ? '' : '교정된 결과가 여기에 표시됩니다.'}
              className={`
                w-full h-full p-6 resize-none focus:outline-none bg-transparent leading-relaxed text-base font-sans whitespace-pre-wrap
                ${outputText ? 'text-slate-800' : 'text-slate-400'}
              `}
              spellCheck={false}
            />

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
