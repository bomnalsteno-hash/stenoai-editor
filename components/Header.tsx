import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Keyboard, Wand2, LogOut, Shield } from 'lucide-react';

export const Header: React.FC = () => {
  const { user, profile, signOut } = useAuth();

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
      <div className="flex items-center gap-3">
        <span className="px-3 py-1 bg-indigo-50 text-indigo-700 text-xs font-semibold rounded-full border border-indigo-100 flex items-center gap-1">
          <Wand2 size={12} />
          Gemini Powered
        </span>
        {user?.email && (
          <span className="text-sm text-slate-600 truncate max-w-[160px]" title={user.email}>
            {user.email}
          </span>
        )}
        {profile?.role === 'admin' && (
          <Link
            to="/admin"
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-indigo-600 border border-slate-200 rounded-lg hover:border-indigo-200 transition-colors"
          >
            <Shield size={14} />
            관리자
          </Link>
        )}
        <button
          onClick={() => signOut()}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-500 hover:text-red-600 border border-slate-200 rounded-lg hover:border-red-200 transition-colors"
        >
          <LogOut size={14} />
          로그아웃
        </button>
      </div>
    </header>
  );
};
