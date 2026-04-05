import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '@iconify/react';
import supabase from '../lib/supabase';
import { signInWithGoogle } from '../lib/googleAuth';

const BRANCHES = ['Computer Science', 'Information Technology', 'Electronics', 'Mechanical', 'Civil', 'Electrical'];
const SEMESTERS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

const Register = () => {
  const [step, setStep] = useState(1);
  const [formData, setFormData] = useState({
    email: '', otp: '', password: '', full_name: '', branch: '', semester: '', github: '', linkedin: '', instagram: '', whatsapp: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const navigate = useNavigate();

  const handleSendOTP = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null); setMessage(null); setLoading(true);
    try {
      const res = await fetch('/api/send-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: formData.email })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send OTP');
      if (data.otp) {
        setFormData(prev => ({ ...prev, otp: data.otp }));
        setMessage(`DEV MODE: Your OTP is ${data.otp}`);
      } else {
        setMessage('Verification code sent to your email.');
      }
      setStep(2);
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const handleVerifyAndComplete = async (e: React.FormEvent) => {
    e.preventDefault();
    if (step === 2) { 
      if (!formData.otp || !formData.password) {
        setError('OTP and Password are required');
        return;
      }
      setStep(3); 
      return; 
    }
    if (step === 3) { 
      if (!formData.full_name || !formData.branch || !formData.semester) {
        setError('All fields are required');
        return;
      }
      setStep(4); 
      return; 
    }
    
    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/verify-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Registration failed');
      
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: formData.email,
        password: formData.password
      });
      
      if (signInError) navigate('/login');
      else navigate('/home');
    } catch (err: any) { setError(err.message); } finally { setLoading(false); }
  };

  const inputClass = "w-full pl-11 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 focus:bg-white transition-all text-sm";
  const labelClass = "text-[11px] font-bold text-gray-500 ml-1 mb-1.5 block uppercase tracking-wider";

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex flex-col justify-center items-center p-4 py-12">
      <div className="w-full max-w-md bg-white p-8 rounded-xl shadow-xl shadow-gray-200/50 border border-gray-100">
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold text-[#212B36] mb-1">Create Account</h2>
          <p className="text-gray-500 text-sm font-medium">Join the TechSphere community</p>
          <div className="flex justify-center gap-1.5 mt-5">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className={`h-1 w-6 rounded-full transition-colors duration-300 ${step >= i ? 'bg-indigo-600' : 'bg-gray-200'}`} />
            ))}
          </div>
        </div>

        {error && <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs font-bold mb-6 border border-red-100 flex items-center gap-2"><Icon icon="solar:danger-bold" fontSize={18} /> {error}</div>}
        {message && <div className="p-3 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold mb-6 border border-indigo-100 flex items-center gap-2"><Icon icon="solar:info-circle-bold" fontSize={18} /> {message}</div>}

        {step === 1 && (
          <form onSubmit={handleSendOTP} className="space-y-5">
            <div className="space-y-1.5">
              <label className={labelClass}>Institutional Email</label>
              <div className="relative">
                <Icon icon="solar:letter-bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fontSize={20} />
                <input type="email" required className={inputClass} placeholder="john@ietddu.ac.in" value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
              </div>
            </div>
            <button type="submit" disabled={loading} className="w-full py-3.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-100">
              {loading ? 'Processing...' : 'Verify Email'} <Icon icon="solar:arrow-right-bold" />
            </button>
            <div className="flex items-center gap-3 my-6">
              <div className="h-px bg-gray-100 flex-1" />
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Or</span>
              <div className="h-px bg-gray-100 flex-1" />
            </div>
            <button type="button" onClick={() => signInWithGoogle()} className="w-full flex items-center justify-center gap-2 py-3 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-all font-bold text-sm text-gray-700">
              <Icon icon="logos:google-icon" fontSize={18} /> Google
            </button>
          </form>
        )}

        {step === 2 && (
          <form onSubmit={handleVerifyAndComplete} className="space-y-5">
            <div className="space-y-1.5">
              <label className={labelClass}>Verification Code</label>
              <div className="relative">
                <Icon icon="solar:shield-keyhole-bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fontSize={20} />
                <input type="text" required className={inputClass} placeholder="123456" value={formData.otp} onChange={e => setFormData({...formData, otp: e.target.value})} />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className={labelClass}>Set Password</label>
              <div className="relative">
                <Icon icon="solar:lock-password-bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fontSize={20} />
                <input type="password" required className={inputClass} placeholder="••••••••" value={formData.password} onChange={e => setFormData({...formData, password: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(1)} className="px-4 py-3.5 bg-gray-50 text-gray-600 rounded-lg font-bold text-sm hover:bg-gray-100 transition-all">Back</button>
              <button type="submit" className="flex-1 py-3.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
                Continue
              </button>
            </div>
          </form>
        )}

        {step === 3 && (
          <form onSubmit={handleVerifyAndComplete} className="space-y-5">
            <div className="space-y-1.5">
              <label className={labelClass}>Full Name</label>
              <div className="relative">
                <Icon icon="solar:user-bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fontSize={20} />
                <input type="text" required className={inputClass} placeholder="John Doe" value={formData.full_name} onChange={e => setFormData({...formData, full_name: e.target.value})} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className={labelClass}>Branch</label>
                <select required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm" value={formData.branch} onChange={e => setFormData({...formData, branch: e.target.value})}>
                  <option value="">Select</option>
                  {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Semester</label>
                <select required className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm" value={formData.semester} onChange={e => setFormData({...formData, semester: e.target.value})}>
                  <option value="">Select</option>
                  {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
            </div>
            <button type="submit" className="w-full py-3.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all flex items-center justify-center gap-2">
              Next Step <Icon icon="solar:arrow-right-bold" />
            </button>
          </form>
        )}

        {step === 4 && (
          <form onSubmit={handleVerifyAndComplete} className="space-y-5">
            <div className="grid grid-cols-1 gap-4">
              <div className="space-y-1.5">
                <label className={labelClass}>GitHub</label>
                <input type="url" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm" placeholder="https://github.com/..." value={formData.github} onChange={e => setFormData({...formData, github: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>LinkedIn</label>
                <input type="url" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm" placeholder="https://linkedin.com/in/..." value={formData.linkedin} onChange={e => setFormData({...formData, linkedin: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>Instagram</label>
                <input type="url" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm" placeholder="https://instagram.com/..." value={formData.instagram} onChange={e => setFormData({...formData, instagram: e.target.value})} />
              </div>
              <div className="space-y-1.5">
                <label className={labelClass}>WhatsApp</label>
                <input type="tel" className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm" placeholder="+91..." value={formData.whatsapp} onChange={e => setFormData({...formData, whatsapp: e.target.value})} />
              </div>
            </div>
            <div className="flex gap-3">
              <button type="button" onClick={() => setStep(3)} className="px-4 py-3.5 bg-gray-50 text-gray-600 rounded-lg font-bold text-sm hover:bg-gray-100 transition-all">Back</button>
              <button type="submit" disabled={loading} className="flex-1 py-3.5 bg-[#212B36] text-white rounded-lg font-bold text-sm hover:bg-[#161C24] transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                {loading ? 'Creating Account...' : 'Complete Registration'}
              </button>
            </div>
          </form>
        )}

        <p className="mt-8 text-center text-gray-500 text-xs font-bold uppercase tracking-wider">
          Have an account? <Link to="/login" className="text-indigo-600 hover:underline">Sign In</Link>
        </p>
      </div>
    </div>
  );
};

export default Register;
