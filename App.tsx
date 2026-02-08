import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { Header } from './components/Header';
import { Editor } from './components/Editor';
import { Login } from './components/Login';
import { Signup } from './components/Signup';
import { Admin } from './components/Admin';
import { Loader2 } from 'lucide-react';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-50">
        <Loader2 size={32} className="animate-spin text-indigo-600" />
      </div>
    );
  }
  if (!session) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function EditorLayout() {
  return (
    <div className="h-full flex flex-col bg-slate-50">
      <Header />
      <Editor />
      <footer className="bg-white border-t border-slate-200 px-6 py-2 text-xs text-slate-400 flex justify-between shrink-0">
        <div>StenoAI v2.0.0</div>
        <div className="flex gap-4">
          <span>© 2024 StenoAI</span>
        </div>
      </footer>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <EditorLayout />
          </ProtectedRoute>
        }
      />
      <Route path="/admin" element={<Admin />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
