import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import supabase from '../lib/supabase';
import { ProfileSkeleton } from '../components/Skeleton';

const BRANCHES = ['Computer Science', 'Information Technology', 'Electronics', 'Mechanical', 'Civil', 'Electrical'];
const SEMESTERS = ['1st', '2nd', '3rd', '4th', '5th', '6th', '7th', '8th'];

const Profile = () => {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState<any>({});
  const [activeTab, setActiveTab] = useState('academic');
  const [updateLoading, setUpdateLoading] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data, error } = await supabase
          .from('ts_v2025_profiles')
          .select('*')
          .eq('id', user.id)
          .maybeSingle(); // Better: handle zero rows gracefully
        
        if (error) throw error;

        if (data) {
          setProfile(data);
          setFormData(data);
        } else {
          // No profile row yet! Create a local fallback to allow UI to render
          const fallback = { id: user.id, email: user.email, full_name: user.user_metadata?.full_name || 'New User', role: 'user' };
          setProfile(fallback);
          setFormData(fallback);
        }
      }
    } catch (err: any) {
      console.error('Error fetching profile:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setUpdateLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');

      const { created_at, role, ...updates } = formData;
      const res = await fetch('/api/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({
          ...updates,
          email: session.user.email
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      
      setIsEditing(false);
      fetchProfile();
      window.dispatchEvent(new Event('profile-updated'));
    } catch (err: any) {
      console.error('Update error:', err.message);
      const msg = String(err.message || '');
      if (msg.includes('row-level security')) {
        alert('Update blocked by security policy. Please refresh and try again, or contact admin to fix profile permissions.');
      } else {
        alert('Update failed: ' + msg);
      }
    } finally {
      setUpdateLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!profile?.email) return;
    const { error } = await supabase.auth.resetPasswordForEmail(profile.email, {
      redirectTo: window.location.origin + '/login',
    });
    if (error) alert(error.message);
    else alert('Password reset link sent to your email.');
  };

  const profileComplete = Boolean(profile?.full_name && profile?.branch && profile?.semester && profile?.roll_no);

  useEffect(() => {
    if (!loading && profile && !profileComplete) {
      setIsEditing(true);
      setActiveTab('academic');
    }
  }, [loading, profile, profileComplete]);

  if (loading && !profile) return <ProfileSkeleton />;

  const socialLinks = [
    { id: 'github_url', icon: 'solar:code-square-bold', label: 'GitHub', color: 'text-gray-900', placeholder: 'https://github.com/username' },
    { id: 'linkedin_url', icon: 'solar:share-circle-bold', label: 'LinkedIn', color: 'text-blue-600', placeholder: 'https://linkedin.com/in/username' },
    { id: 'instagram', icon: 'solar:camera-minimalistic-bold', label: 'Instagram', color: 'text-pink-600', placeholder: 'https://instagram.com/username' },
  ];

  const inputClass = "w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm font-medium";
  const labelClass = "text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider";

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-20">
      {!profileComplete && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-sm font-semibold">
          Please complete your profile details to continue using the app.
        </div>
      )}
      <header className="bg-white p-6 sm:p-10 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-40 h-40 bg-indigo-50 rounded-full -mr-20 -mt-20 opacity-40" />
        
        <div className="flex flex-col md:flex-row items-center gap-6 md:gap-10 relative z-10">
          <div className="relative group shrink-0">
            <div className="w-32 h-32 rounded-2xl bg-indigo-50 flex items-center justify-center text-indigo-600 border-4 border-white shadow-xl overflow-hidden relative">
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
              ) : (
                <span className="text-5xl font-black">{profile?.full_name?.[0] || 'U'}</span>
              )}
            </div>
            <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-green-500 border-4 border-white rounded-full shadow-sm" />
          </div>
          
          <div className="flex-1 text-center md:text-left min-w-0">
            <div className="flex items-center justify-center md:justify-start gap-3 mb-1.5">
              <h1 className="text-3xl font-bold text-[#212B36] tracking-tight truncate">{profile?.full_name}</h1>
              {profile?.role?.toLowerCase() === 'admin' && (
                <div className="bg-indigo-50 text-indigo-600 px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 border border-indigo-100">
                  <Icon icon="solar:shield-check-bold" fontSize={14} />
                  Admin
                </div>
              )}
            </div>
            <div className="text-gray-500 font-bold text-xs mb-5 uppercase tracking-[0.15em] flex items-center justify-center md:justify-start gap-4">
              <span className="flex items-center gap-1.5">
                <Icon icon="solar:square-academic-cap-bold" fontSize={18} className="text-indigo-400" />
                {profile?.branch || 'No Branch'}
              </span>
              <span className="flex items-center gap-1.5 opacity-80">
                <Icon icon="solar:calendar-bold" fontSize={18} className="text-indigo-400" />
                {profile?.semester || 'N/A'} Semester
              </span>
              <span className="flex items-center gap-1.5 opacity-80">
                <Icon icon="solar:ticket-bold" fontSize={18} className="text-indigo-400" />
                {profile?.roll_no || 'No Roll No'}
              </span>
            </div>
            
            <div className="flex flex-wrap justify-center md:justify-start gap-2.5">
              {socialLinks.map((s) => profile?.[s.id] && (
                <a key={s.id} href={profile[s.id]} target="_blank" rel="noreferrer" className={`p-2.5 bg-gray-50 rounded-lg ${s.color} hover:bg-white hover:shadow-md hover:border-gray-200 transition-all border border-transparent group`}>
                  <Icon icon={s.icon} fontSize={22} className="group-hover:scale-110 transition-transform" />
                </a>
              ))}
              {profile?.whatsapp && (
                <a href={`https://wa.me/${profile.whatsapp}`} target="_blank" rel="noreferrer" className="p-2.5 bg-gray-50 rounded-lg text-emerald-600 hover:bg-white hover:shadow-md hover:border-gray-200 transition-all border border-transparent group">
                  <Icon icon="solar:phone-calling-bold" fontSize={22} className="group-hover:scale-110 transition-transform" />
                </a>
              )}
            </div>
          </div>

          <div className="flex flex-col gap-2.5 w-full md:w-auto">
            <button onClick={() => setIsEditing(!isEditing)} className={`px-6 py-3 rounded-lg font-bold text-xs transition-all shadow-lg uppercase tracking-widest flex items-center justify-center gap-2 ${isEditing ? 'bg-red-50 text-red-600 hover:bg-red-100' : 'bg-[#212B36] text-white hover:bg-[#161C24]'}`}>
              <Icon icon={isEditing ? "solar:close-circle-bold" : "solar:pen-bold"} fontSize={18} />
              {isEditing ? 'Cancel' : 'Edit Profile'}
            </button>
            <button onClick={handleResetPassword} className="px-6 py-3 bg-white border border-gray-200 text-gray-600 rounded-lg font-bold text-xs hover:bg-gray-50 transition-all uppercase tracking-widest flex items-center justify-center gap-2">
              <Icon icon="solar:lock-password-bold" fontSize={18} />
              Security
            </button>
          </div>
        </div>
      </header>

      {isEditing ? (
        <form onSubmit={handleUpdate} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden animate-in slide-in-from-bottom-2 duration-300">
          <div className="flex bg-gray-50/50 border-b border-gray-100">
            <button type="button" onClick={() => setActiveTab('academic')} className={`flex-1 py-5 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 ${activeTab === 'academic' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              <Icon icon="solar:user-bold" fontSize={20} />
              Personal & Academic
            </button>
            <button type="button" onClick={() => setActiveTab('socials')} className={`flex-1 py-5 text-xs font-bold uppercase tracking-widest border-b-2 transition-all flex items-center justify-center gap-2 ${activeTab === 'socials' ? 'border-indigo-600 text-indigo-600 bg-white' : 'border-transparent text-gray-400 hover:text-gray-600'}`}>
              <Icon icon="solar:globus-bold" fontSize={20} />
              Socials & Links
            </button>
          </div>

          <div className="p-6 sm:p-10 space-y-8">
            {activeTab === 'academic' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="md:col-span-2 space-y-1.5">
                  <label className={labelClass}>Profile Avatar URL</label>
                  <div className="relative">
                    <Icon icon="solar:camera-bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fontSize={20} />
                    <input className={inputClass.replace('px-4', 'pl-11')} value={formData.avatar_url || ''} onChange={e => setFormData({...formData, avatar_url: e.target.value})} placeholder="https://images.unsplash.com/photo-..." />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Full Name</label>
                  <input className={inputClass} value={formData.full_name || ''} onChange={e => setFormData({...formData, full_name: e.target.value})} />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Roll Number</label>
                  <input className={inputClass} value={formData.roll_no || ''} onChange={e => setFormData({...formData, roll_no: e.target.value})} placeholder="e.g. 23CS104" />
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Branch</label>
                  <select className={inputClass} value={formData.branch || ''} onChange={e => setFormData({...formData, branch: e.target.value})}>
                    <option value="">Select Branch</option>
                    {BRANCHES.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className={labelClass}>Semester</label>
                  <select className={inputClass} value={formData.semester || ''} onChange={e => setFormData({...formData, semester: e.target.value})}>
                    <option value="">Select Semester</option>
                    {SEMESTERS.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {socialLinks.map(s => (
                  <div key={s.id} className="space-y-1.5">
                    <label className={labelClass}>{s.label} Profile URL</label>
                    <div className="relative">
                      <Icon icon={s.icon} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fontSize={20} />
                      <input className={inputClass.replace('px-4', 'pl-11')} value={formData[s.id] || ''} onChange={e => setFormData({...formData, [s.id]: e.target.value})} placeholder={s.placeholder} />
                    </div>
                  </div>
                ))}
                <div className="space-y-1.5">
                  <label className={labelClass}>WhatsApp Number</label>
                  <div className="relative">
                    <Icon icon="solar:phone-bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fontSize={20} />
                    <input className={inputClass.replace('px-4', 'pl-11')} value={formData.whatsapp || ''} onChange={e => setFormData({...formData, whatsapp: e.target.value})} placeholder="+91..." />
                  </div>
                </div>
              </div>
            )}
            
            <div className="pt-8 border-t border-gray-100">
              <button type="submit" disabled={updateLoading} className="w-full py-4 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50">
                <Icon icon={updateLoading ? "solar:restart-bold" : "solar:check-read-bold"} fontSize={20} className={updateLoading ? "animate-spin" : ""} />
                {updateLoading ? 'Saving Changes...' : 'Save All Changes'}
              </button>
            </div>
          </div>
        </form>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-white p-6 sm:p-10 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-sm font-bold text-gray-400 mb-8 uppercase tracking-widest flex items-center gap-2">
              <Icon icon="solar:notebook-bold" fontSize={20} className="text-indigo-400" />
              Academic Profile
            </h2>
            <div className="space-y-6">
              {[
                { label: 'Roll Number', val: profile?.roll_no, icon: 'solar:ticket-bold', color: 'text-amber-600', bg: 'bg-amber-50' },
                { label: 'Branch', val: profile?.branch, icon: 'solar:square-academic-cap-bold', color: 'text-blue-600', bg: 'bg-blue-50' },
                { label: 'Semester', val: profile?.semester, icon: 'solar:calendar-bold', color: 'text-purple-600', bg: 'bg-purple-50' },
              ].map((item, i) => (
                <div key={i} className="flex items-center gap-5 group">
                  <div className={`w-12 h-12 ${item.bg} rounded-xl flex items-center justify-center ${item.color} group-hover:scale-110 transition-transform shadow-sm`}><Icon icon={item.icon} fontSize={24} /></div>
                  <div>
                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-0.5">{item.label}</p>
                    <p className="font-bold text-base text-[#212B36]">{item.val || 'Not set'}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white p-6 sm:p-10 rounded-xl border border-gray-200 shadow-sm">
            <h2 className="text-sm font-bold text-gray-400 mb-8 uppercase tracking-widest flex items-center gap-2">
              <Icon icon="solar:globus-bold" fontSize={20} className="text-indigo-400" />
              Digital Presence
            </h2>
            <div className="space-y-3.5">
              {socialLinks.map((s, i) => profile?.[s.id] ? (
                <a key={i} href={profile[s.id]} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100 hover:bg-white hover:shadow-md hover:border-gray-200 transition-all group">
                  <div className="flex items-center gap-4">
                    <Icon icon={s.icon} className={s.color} fontSize={24} />
                    <span className="text-sm font-bold text-gray-700">{s.label}</span>
                  </div>
                  <Icon icon="solar:arrow-right-up-linear" className="text-gray-300 group-hover:text-indigo-600 transition-colors" fontSize={18} />
                </a>
              ) : null)}
              {profile?.whatsapp && (
                <a href={`https://wa.me/${profile.whatsapp}`} target="_blank" rel="noreferrer" className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100 hover:bg-white hover:shadow-md hover:border-gray-200 transition-all group">
                  <div className="flex items-center gap-4">
                    <Icon icon="solar:phone-calling-bold" className="text-emerald-600" fontSize={24} />
                    <span className="text-sm font-bold text-gray-700">WhatsApp</span>
                  </div>
                  <Icon icon="solar:arrow-right-up-linear" className="text-gray-300 group-hover:text-indigo-600 transition-colors" fontSize={18} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Profile;
