import { useEffect, useState } from 'react';
import { Routes, Route, useNavigate, useLocation, Link } from 'react-router-dom';
import { Icon } from '@iconify/react';
import supabase from './lib/supabase';
import { handleGoogleRedirect } from './lib/googleAuth';
import Landing from './pages/Landing';
import Login from './pages/Login';
import Register from './pages/Register';
import { AnimatePresence } from 'framer-motion';
import { CacheProvider } from './context/CacheContext';
import PageTransition from './components/PageTransition';

import Dashboard from './pages/Dashboard';
import Events from './pages/Events';
import Challenges from './pages/Challenges';
import Profile from './pages/Profile';
import Leaderboard from './pages/Leaderboard';
import PublicRegistrations from './pages/PublicRegistrations';
import CertificateVerify from './pages/CertificateVerify';
import AdminEvents from './pages/Admin/Events';
import AdminChallenges from './pages/Admin/Challenges';
import AdminUsers from './pages/Admin/Users';
import AdminTeams from './pages/Admin/Teams';
import AdminCertificates from './pages/Admin/Certificates';
import AdminCertificatePrint from './pages/Admin/CertificatePrint';
import AdminPasses from './pages/Admin/Passes';

handleGoogleRedirect();

const App = () => {
  const [session, setSession] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isAdminMenuOpen, setIsAdminMenuOpen] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      if (session) fetchProfile(session);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) fetchProfile(session);
      else {
        setProfile(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchProfile = async (session: any) => {
    try {
      const res = await fetch('/api/profile', {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${session.access_token}`
        }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Profile fetch failed');

      if (data) {
        // Auto-sync Google avatar if profile doesn't have one
        const metaAvatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture;
        if (!data.avatar_url && metaAvatar) {
          const res = await fetch('/api/profile', {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ avatar_url: metaAvatar, full_name: data.full_name || session.user.user_metadata?.full_name })
          });
          if (res.ok) {
            const updated = await res.json();
            setProfile(updated);
          } else {
            setProfile(data);
          }
        } else {
          setProfile(data);
        }
      } else {
        // Create minimal profile if missing (especially for OAuth users)
        const metaAvatar = session.user.user_metadata?.avatar_url || session.user.user_metadata?.picture;
        const res = await fetch('/api/profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session.access_token}`
          },
          body: JSON.stringify({
            email: session.user.email,
            full_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0],
            avatar_url: metaAvatar
          })
        });
        if (res.ok) {
          const created = await res.json();
          setProfile(created);
        } else {
          console.warn('Profile not found for user:', session.user.id);
        }
      }
    } catch (err) {
      console.error('Error fetching profile:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    navigate('/');
  };

  const getActiveTab = () => {
    const path = location.pathname;
    if (path === '/home' || path === '/') return '/home';
    if (path.startsWith('/events')) return '/events';
    if (path.startsWith('/challenges')) return '/challenges';
    if (path.startsWith('/leaderboard')) return '/leaderboard';
    if (path.startsWith('/profile')) return '/profile';
    if (path.startsWith('/admin/events')) return '/admin/events';
    if (path.startsWith('/admin/challenges')) return '/admin/challenges';
    if (path.startsWith('/admin/users')) return '/admin/users';
    if (path.startsWith('/admin/teams')) return '/admin/teams';
    if (path.startsWith('/admin/certificates/print')) return '/admin/certificates';
    if (path.startsWith('/admin/certificates')) return '/admin/certificates';
    if (path.startsWith('/admin/passes')) return '/admin/passes';
    return '/home';
  };

  const activeTab = getActiveTab();
  const isAuthPage = ['/', '/login', '/register'].includes(location.pathname);
  const isPublicShare = location.pathname.startsWith('/share/');
  const isPublicCert = location.pathname.startsWith('/certificates/verify');
  const profileComplete = Boolean(
    profile?.full_name &&
    profile?.branch &&
    profile?.semester &&
    profile?.roll_no
  );

  const adminEmail = (import.meta as any)?.env?.VITE_ADMIN_EMAIL || 'admin@techsphere.com';
  const computeIsAdmin = () => Boolean(
    (profile?.role && profile.role.toLowerCase().trim() === 'admin') ||
    (session?.user?.user_metadata?.role && String(session.user.user_metadata.role).toLowerCase().trim() === 'admin') ||
    (session?.user?.email && session.user.email.toLowerCase() === String(adminEmail).toLowerCase())
  );

  useEffect(() => {
    const handleProfileUpdated = () => {
      if (session) fetchProfile(session);
    };
    window.addEventListener('profile-updated', handleProfileUpdated);
    return () => window.removeEventListener('profile-updated', handleProfileUpdated);
  }, [session, fetchProfile]);

  useEffect(() => {
    // Only force profile when we actually have a profile object and it's incomplete.
    if (session && profile && !profileComplete && location.pathname !== '/profile') {
      navigate('/profile', { replace: true });
    }
  }, [session, profile, profileComplete, location.pathname, navigate]);

  useEffect(() => {
    if (session && profile && !computeIsAdmin() && location.pathname.startsWith('/admin')) {
      navigate('/home', { replace: true });
    }
  }, [session, profile, location.pathname, navigate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-[#F4F6F8]">
        <div className="animate-spin text-indigo-600">
          <Icon icon="solar:restart-bold" fontSize={48} />
        </div>
      </div>
    );
  }

  if ((isAuthPage || isPublicShare || isPublicCert) && !session) {
    return (
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<PageTransition><Landing /></PageTransition>} />
          <Route path="/login" element={<PageTransition><Login /></PageTransition>} />
          <Route path="/register" element={<PageTransition><Register /></PageTransition>} />
          <Route path="/share/:token" element={<PageTransition><PublicRegistrations /></PageTransition>} />
          <Route path="/certificates/verify" element={<PageTransition><CertificateVerify /></PageTransition>} />
        </Routes>
      </AnimatePresence>
    );
  }

  const isAdmin = computeIsAdmin();

  if (session && profile && profile.approved === false && !isAdmin) {
    return (
      <div className="min-h-screen bg-[#F4F6F8] flex items-center justify-center p-6">
        <div className="bg-white max-w-lg w-full p-8 rounded-2xl border border-gray-100 shadow-xl text-center space-y-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center">
            <Icon icon="solar:hourglass-bold" fontSize={28} />
          </div>
          <h1 className="text-2xl font-bold text-[#212B36]">Account Pending Approval</h1>
          <p className="text-sm text-gray-500">
            Your registration is under review by an admin. You’ll get access as soon as your account is approved.
          </p>
          <div className="text-[11px] font-bold uppercase tracking-widest text-gray-400">
            Please check back later or contact the TechSphere team
          </div>
          <button
            onClick={handleLogout}
            className="w-full py-3 bg-gray-900 text-white rounded-lg font-bold text-sm uppercase tracking-wider"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  const navItems = [
    { label: 'Home', icon: 'solar:home-2-bold', path: '/home' },
    { label: 'Events', icon: 'solar:calendar-minimalistic-bold', path: '/events' },
    { label: 'Challenges', icon: 'solar:cup-bold', path: '/challenges' },
    { label: 'Leaderboard', icon: 'solar:cup-star-bold', path: '/leaderboard' },
    { label: 'Profile', icon: 'solar:user-circle-bold', path: '/profile' },
  ];

  const adminItems = isAdmin ? [
    { label: 'Events Mgr', icon: 'solar:settings-minimalistic-bold', path: '/admin/events' },
    { label: 'Pass Studio', icon: 'solar:ticket-bold', path: '/admin/passes' },
    { label: 'Challenges Mgr', icon: 'solar:cup-bold', path: '/admin/challenges' },
    { label: 'Users Mgr', icon: 'solar:users-group-rounded-bold', path: '/admin/users' },
    { label: 'Teams Mgr', icon: 'solar:users-group-rounded-bold', path: '/admin/teams' },
    { label: 'Certificates', icon: 'solar:diploma-verified-bold', path: '/admin/certificates' },
  ] : [];

  const getIcon = (icon: string, active: boolean) => {
    if (active) return icon;
    if (icon.endsWith('-bold')) return icon.replace('-bold', '-outline');
    return icon;
  };

  return (
    <CacheProvider>
      <div className="min-h-screen bg-[#F9FAFB] text-[#212B36] font-sans">
        {/* Mobile Header */}
        <header className="lg:hidden fixed top-0 left-0 right-0 h-16 bg-white/80 backdrop-blur-md border-b border-gray-100 flex items-center justify-between px-4 z-40">
          <button onClick={() => setIsSidebarOpen(true)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
            <Icon icon="solar:hamburger-menu-linear" fontSize={24} />
          </button>
          <span className="font-bold text-lg tracking-tight text-indigo-600 tracking-tighter">TechSphere 2026</span>
          <div className="w-9 h-9 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold border border-indigo-100 text-sm">
            {profile?.full_name?.[0] || 'U'}
          </div>
        </header>

        {/* Desktop Sidebar */}
        <aside className={`fixed inset-y-0 left-0 w-72 bg-white border-r border-gray-100 z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'}`}>
          <div className="h-full flex flex-col p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-14 h-14 rounded-2xl bg-gray-50 border border-gray-100 shadow-sm flex items-center justify-center overflow-hidden">
                {profile?.avatar_url ? (
                  <img src={profile.avatar_url} alt="" className="w-full h-full object-cover" />
                ) : (
                  <Icon icon="solar:user-circle-bold" className="text-indigo-600" fontSize={28} />
                )}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">TechSphere 2026</p>
                <p className="font-black text-lg tracking-tight text-[#1A2230] truncate">{profile?.full_name || 'Member'}</p>
                <p className="text-[11px] font-semibold text-gray-500 truncate">{profile?.email || 'student@techsphere.com'}</p>
              </div>
              <button onClick={() => setIsSidebarOpen(false)} className="ml-auto p-2 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50 transition-colors lg:hidden">
                <Icon icon="solar:close-circle-bold" fontSize={18} />
              </button>
            </div>

            <nav className="flex-1 space-y-1 overflow-y-auto pr-1 min-h-0 max-h-[70vh]">
              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest px-2 mb-3">Navigation</p>
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group ${
                    activeTab === item.path
                      ? 'bg-gray-50 text-[#1A2230] shadow-sm'
                      : 'text-gray-500 hover:bg-gray-50 hover:text-[#1A2230]'
                  }`}
                >
                  <span className={`w-8 h-8 rounded-xl flex items-center justify-center border ${activeTab === item.path ? 'bg-white border-gray-200 text-indigo-600' : 'bg-white/70 border-gray-100 text-gray-400 group-hover:text-indigo-600'}`}>
                    <Icon icon={getIcon(item.icon, activeTab === item.path)} fontSize={18} />
                  </span>
                  <span className="font-semibold text-sm tracking-tight">{item.label}</span>
                  <span className={`ml-auto text-[11px] font-semibold ${activeTab === item.path ? 'text-indigo-600' : 'text-gray-400'}`}>
                    {item.label === 'Home' ? 'Home' : item.label}
                  </span>
                </Link>
              ))}

              {adminItems.length > 0 && (
                <>
                  <div className="h-px bg-gray-100 my-4" />
                  <button
                    type="button"
                    onClick={() => setIsAdminMenuOpen((prev) => !prev)}
                    className="w-full flex items-center justify-between px-2 py-2 text-[10px] font-bold uppercase tracking-widest text-gray-400 hover:text-gray-600"
                  >
                    <span>Management</span>
                    <Icon icon={isAdminMenuOpen ? 'solar:alt-arrow-up-bold' : 'solar:alt-arrow-down-bold'} fontSize={16} />
                  </button>
                  {isAdminMenuOpen && (
                    <div className="space-y-1">
                      {adminItems.map((item) => (
                        <Link
                          key={item.path}
                          to={item.path}
                          onClick={() => setIsSidebarOpen(false)}
                          className={`flex items-center gap-3 px-4 py-3 rounded-2xl transition-all duration-300 group ${
                            activeTab === item.path
                              ? 'bg-gray-50 text-[#1A2230] shadow-sm'
                              : 'text-gray-500 hover:bg-gray-50 hover:text-[#1A2230]'
                          }`}
                        >
                          <span className={`w-8 h-8 rounded-xl flex items-center justify-center border ${activeTab === item.path ? 'bg-white border-gray-200 text-indigo-600' : 'bg-white/70 border-gray-100 text-gray-400 group-hover:text-indigo-600'}`}>
                            <Icon icon={getIcon(item.icon, activeTab === item.path)} fontSize={18} />
                          </span>
                          <span className="font-semibold text-sm tracking-tight">{item.label}</span>
                          <span className={`ml-auto text-[11px] font-semibold ${activeTab === item.path ? 'text-indigo-600' : 'text-gray-400'}`}>
                            Admin
                          </span>
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              )}
            </nav>

            <div className="mt-6 bg-[#111827] rounded-2xl p-5 text-white shadow-xl">
              <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-200 mb-2">Support Portal</p>
              <p className="text-sm font-semibold text-white/90">Reach out for technical help or account issues.</p>
            </div>

            <button 
              onClick={handleLogout}
              className="mt-4 flex items-center justify-center gap-2 px-4 py-3 text-gray-500 hover:bg-red-50 hover:text-red-600 rounded-xl transition-all font-bold text-xs uppercase tracking-widest"
            >
              <Icon icon="solar:logout-bold" fontSize={18} />
              Logout
            </button>
          </div>
        </aside>

        {/* Main Content Area */}
        <main className="lg:ml-64 pt-16 lg:pt-0 min-h-screen pb-24 lg:pb-0">
          <div className="max-w-7xl mx-auto p-4 md:p-8 lg:p-10">
            <AnimatePresence mode="wait">
              {session && !profileComplete ? (
                <Routes location={location} key={location.pathname}>
                  <Route path="/profile" element={<PageTransition><Profile /></PageTransition>} />
                  <Route path="*" element={<PageTransition><Profile /></PageTransition>} />
                </Routes>
              ) : (
                <Routes location={location} key={location.pathname}>
                  <Route path="/home" element={<PageTransition><Dashboard /></PageTransition>} />
                  <Route path="/events" element={<PageTransition><Events /></PageTransition>} />
                  <Route path="/challenges" element={<PageTransition><Challenges /></PageTransition>} />
                  <Route path="/leaderboard" element={<PageTransition><Leaderboard /></PageTransition>} />
                  <Route path="/profile" element={<PageTransition><Profile /></PageTransition>} />
                  <Route path="/share/:token" element={<PageTransition><PublicRegistrations /></PageTransition>} />
                  <Route path="/certificates/verify" element={<PageTransition><CertificateVerify /></PageTransition>} />
                  <Route path="/admin/events" element={<PageTransition><AdminEvents /></PageTransition>} />
                  <Route path="/admin/challenges" element={<PageTransition><AdminChallenges /></PageTransition>} />
                  <Route path="/admin/users" element={<PageTransition><AdminUsers /></PageTransition>} />
                  <Route path="/admin/teams" element={<PageTransition><AdminTeams /></PageTransition>} />
                  <Route path="/admin/certificates" element={<PageTransition><AdminCertificates /></PageTransition>} />
                  <Route path="/admin/certificates/print/:id" element={<PageTransition><AdminCertificatePrint /></PageTransition>} />
                  <Route path="/admin/passes" element={<PageTransition><AdminPasses /></PageTransition>} />
                  <Route path="*" element={<PageTransition><Dashboard /></PageTransition>} />
                </Routes>
              )}
            </AnimatePresence>
          </div>
        </main>

        {/* Mobile Sidebar Overlay */}
        {isSidebarOpen && (
          <div 
            className="fixed inset-0 bg-[#212B36]/40 backdrop-blur-sm z-40 lg:hidden animate-in fade-in duration-300" 
            onClick={() => setIsSidebarOpen(false)} 
          />
        )}

        {/* Mobile Bottom Navigation */}
        <nav className="lg:hidden fixed bottom-0 left-0 right-0 z-40 pb-4 px-4">
          <div className="bg-white/90 backdrop-blur-md border border-gray-100 rounded-2xl shadow-2xl shadow-black/5 px-2 py-2 max-h-20 flex items-center justify-between gap-2">
            {navItems.map((item) => {
              const isActive = activeTab === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsSidebarOpen(false)}
                  className={`flex-1 min-w-0 flex flex-col items-center justify-center gap-1 px-3 py-2 rounded-2xl transition-all duration-300 ${
                    isActive
                      ? 'text-indigo-700 -translate-y-1'
                      : 'text-gray-500 hover:text-[#1A2230] active:scale-95'
                  }`}
                >
                  <span className={`w-11 h-11 rounded-2xl flex items-center justify-center transition-colors ${isActive ? 'bg-indigo-100 shadow-lg shadow-indigo-100' : 'bg-gray-50 group-hover:bg-gray-100'}`}>
                    <Icon
                      icon={getIcon(item.icon, isActive)}
                      fontSize={20}
                      className={`transition-transform duration-300 ${isActive ? 'scale-110' : 'scale-100'}`}
                    />
                  </span>
                  <span className={`text-[9px] font-bold uppercase tracking-wider ${isActive ? 'text-indigo-700' : 'text-gray-400'}`}>
                    {item.label}
                  </span>
                </Link>
              );
            })}
          </div>
        </nav>
      </div>
    </CacheProvider>
  );
};

export default App;
