import React from 'react';
import { Keyboard, Wand2 } from 'lucide-react';

export const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between shrink-0">
      <div className="flex items-center gap-3">
        <div className="p-2 bg-indigo-600 rounded-lg text-white">
          <Keyboard size={24} />
        </div>
        <div>
          <h1 className="text-xl font-bold text-slate-800 tracking-tight">StenoAI Editor</h1>
          <p className="text-xs text-slate-500 font-medium">전문가용 속기 교정 어시스턴트</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100 flex items-center gap-1">
          <Wand2 size={12} />
          Gemini 3 Flash Powered
        </span>
      </div>
    </header>
  );
};