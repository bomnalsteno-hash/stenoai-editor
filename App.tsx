import React from 'react';
import { Header } from './components/Header';
import { Editor } from './components/Editor';

function App() {
  return (
    <div className="h-full flex flex-col bg-slate-50">
      <Header />
      <Editor />
      
      {/* Footer / Status Bar (Optional) */}
      <footer className="bg-white border-t border-slate-200 px-6 py-2 text-xs text-slate-400 flex justify-between shrink-0">
        <div>
          StenoAI v1.0.0
        </div>
        <div className="flex gap-4">
          <span>상태: {process.env.API_KEY ? '온라인' : 'API 키 확인 필요'}</span>
          <span>© 2024 StenoAI</span>
        </div>
      </footer>
    </div>
  );
}

export default App;