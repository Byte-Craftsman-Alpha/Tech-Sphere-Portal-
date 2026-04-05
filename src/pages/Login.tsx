import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import supabase from '../lib/supabase';
import { signInWithGoogle } from '../lib/googleAuth';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    else navigate('/home');
    setLoading(false);
  };

  const handleForgotPassword = async () => {
    if (!email) {
      setResetMessage('Please enter your email first.');
      return;
    }
    setResetLoading(true);
    setResetMessage(null);
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin + '/login',
    });
    if (error) setResetMessage(error.message);
    else setResetMessage('Password reset link sent. Please check your email.');
    setResetLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex flex-col justify-center items-center p-4">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-xl shadow-gray-200/50 border border-gray-100">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-[#212B36] mb-1">Welcome Back</h2>
          <p className="text-gray-500 text-sm font-medium">Sign in to your TechSphere account</p>
        </div>

        <form onSubmit={handleLogin} className="space-y-5">
          {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100 flex items-center gap-2"><Icon icon="solar:danger-bold" fontSize={18} /> {error}</div>}
          {resetMessage && <div className="p-3 bg-emerald-50 text-emerald-700 rounded-lg text-xs font-bold border border-emerald-100 flex items-center gap-2"><Icon icon="solar:check-circle-bold" fontSize={18} /> {resetMessage}</div>}
          
          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">Email Address</label>
            <div className="relative">
              <Icon icon="solar:letter-bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fontSize={20} />
              <input type="email" required className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all text-sm" placeholder="name@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">Password</label>
            <div className="relative">
              <Icon icon="solar:lock-password-bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fontSize={20} />
              <input type="password" required className="w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all text-sm" placeholder="********" value={password} onChange={(e) => setPassword(e.target.value)} />
            </div>
            <div className="flex justify-end">
              <button type="button" onClick={handleForgotPassword} disabled={resetLoading} className="text-[11px] font-bold text-indigo-600 hover:underline uppercase tracking-wider disabled:opacity-60">
                {resetLoading ? 'Sending...' : 'Forgot Password?'}
              </button>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-3.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 flex items-center justify-center gap-2 uppercase tracking-wider disabled:opacity-50">
            {loading ? 'Signing in...' : 'Sign In'} <Icon icon="solar:arrow-right-bold" />
          </button>
        </form>

        <div className="mt-8 flex items-center gap-3">
          <div className="h-px bg-gray-100 flex-1" />
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Or</span>
          <div className="h-px bg-gray-100 flex-1" />
        </div>

        <button onClick={() => signInWithGoogle()} className="mt-6 w-full flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all font-bold text-sm text-gray-700">
          <Icon icon="logos:google-icon" fontSize={18} /> Google
        </button>

        <p className="mt-8 text-center text-gray-500 text-xs font-bold uppercase tracking-wider">
          New here? <Link to="/register" className="text-indigo-600 hover:underline">Create Account</Link>
        </p>
      </div>
    </div>
  );
};

export default Login;
