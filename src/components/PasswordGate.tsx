import { useState, useEffect, type ReactNode } from 'react';
import { Coffee } from 'lucide-react';

const SITE_PASSWORD = 'starbucks2026';

export default function PasswordGate({ children }: { children: ReactNode }) {
  const [authed, setAuthed] = useState(false);
  const [input, setInput] = useState('');
  const [error, setError] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('sb_auth') === '1') setAuthed(true);
  }, []);

  const submit = () => {
    if (input === SITE_PASSWORD) {
      sessionStorage.setItem('sb_auth', '1');
      setAuthed(true);
    } else {
      setError(true);
    }
  };

  if (authed) return <>{children}</>;

  return (
    <div className="flex items-center justify-center h-screen bg-gray-50">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 w-full max-w-sm text-center">
        <Coffee className="w-12 h-12 text-starbucks-500 mx-auto mb-4" />
        <h2 className="text-lg font-bold text-gray-800 mb-1">星巴克即饮进销存</h2>
        <p className="text-xs text-gray-400 mb-5">请输入访问密码</p>
        <input
          type="password"
          value={input}
          onChange={e => { setInput(e.target.value); setError(false); }}
          onKeyDown={e => e.key === 'Enter' && submit()}
          placeholder="输入密码"
          autoFocus
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-center text-sm focus:outline-none focus:border-gray-400 transition-colors"
        />
        {error && <p className="text-red-400 text-xs mt-2">密码错误</p>}
        <button onClick={submit} className="w-full mt-4 py-2.5 bg-starbucks-500 text-white rounded-xl text-sm font-medium hover:bg-starbucks-600 transition-colors">
          进入系统
        </button>
      </div>
    </div>
  );
}
