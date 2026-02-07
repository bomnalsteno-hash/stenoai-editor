import React, { useState, useCallback, useRef, useEffect } from 'react';
import { correctTranscript } from '../services/geminiService';
import { ArrowRight, Copy, RotateCcw, Sparkles, CheckCheck, FileText, Eraser } from 'lucide-react';

interface EditorProps {}

export const Editor: React.FC<EditorProps> = () => {
  const [inputText, setInputText] = useState<string>('');
  const [outputText, setOutputText] = useState<string>('');
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleCorrect = useCallback(async () => {
    if (!inputText.trim()) return;

    setIsProcessing(true);
    setError(null);
    setOutputText(''); // Clear previous output to show loading state effectively

    try {
      const result = await correctTranscript(inputText);
      setOutputText(result);
    } catch (err: any) {
      setError(err.message || "교정 중 오류가 발생했습니다. 다시 시도해주세요.");
    } finally {
      setIsProcessing(false);
    }
  }, [inputText]);

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
    }
  }, []);

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
          <div className="flex-1 relative group">
            <textarea
              ref={textareaRef}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              placeholder="여기에 음성 인식(STT) 초안 텍스트를 붙여넣으세요..."
              className="w-full h-full p-6 resize-none focus:outline-none focus:ring-2 focus:ring-inset focus:ring-indigo-500/10 bg-white text-slate-700 leading-relaxed text-base font-sans"
              spellCheck={false}
            />
            {!inputText && (
              <div className="absolute inset-0 pointer-events-none flex items-center justify-center text-slate-300">
                <div className="text-center">
                  <FileText className="w-12 h-12 mx-auto mb-2 opacity-20" />
                  <p className="text-sm">텍스트를 입력하거나 붙여넣기 하세요</p>
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
                  <div className="w-8 h-8 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
                  <p className="text-slate-500 text-sm font-medium animate-pulse">전문가가 교정 중입니다...</p>
                  <p className="text-slate-400 text-xs mt-2">문맥 파악 및 오류 수정 중</p>
               </div>
            ) : null}
            
            <textarea
              readOnly
              value={outputText}
              placeholder={isProcessing ? "" : "교정된 결과가 여기에 표시됩니다."}
              className={`
                w-full h-full p-6 resize-none focus:outline-none bg-transparent leading-relaxed text-base font-sans
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