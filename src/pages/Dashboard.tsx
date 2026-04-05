import { useEffect, useState } from 'react';
import { Icon } from '@iconify/react';
import { Link } from 'react-router-dom';
import supabase from '../lib/supabase';
import { Skeleton } from '../components/Skeleton';
import { useCache } from '../context/CacheContext';
import { EmptyState } from '../components/EmptyState';

const Dashboard = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    upcomingEvents: 0,
    activeChallenges: 0,
    totalMembers: 0
  });
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const { setCache } = useCache();

  const [tableStatus, setTableStatus] = useState<'ok' | 'missing'>('ok');

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        
        // 1. Fetch Events & Stats
        const { data: allEvents, error: eventsErr } = await supabase.from('ts_v2025_events').select('*');
        
        if (eventsErr) {
          if (eventsErr.message.includes('relation "ts_v2025_events" does not exist')) {
            setTableStatus('missing');
          }
          throw eventsErr;
        }
        setTableStatus('ok');

        const eventsData = [...(allEvents || [])].sort((a,b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 3);
        const upcomingEvents = (allEvents || []).filter(e => (e.pass_settings?.type ?? e.type) !== 'challenge').length;
        const activeChallenges = (allEvents || []).filter(e => (e.pass_settings?.type ?? e.type) === 'challenge').length;

        // 2. Fetch Member Count
        const { count, error: countErr } = await supabase.from('ts_v2025_profiles').select('id', { count: 'exact', head: true });
        const totalMembers = countErr ? 0 : (count || 0);

        // 3. Fetch Leaderboard (Resilient to missing 'points' column)
        let leaderboardRes;
        try {
          leaderboardRes = await supabase
            .from('ts_v2025_profiles')
            .select('id, full_name, avatar_url, points')
            .order('points', { ascending: false })
            .limit(5);
          
          if (leaderboardRes.error) throw leaderboardRes.error;
        } catch (lErr) {
          console.warn('Leaderboard fetch failed (likely missing points column):', lErr);
          leaderboardRes = await supabase
            .from('ts_v2025_profiles')
            .select('id, full_name, avatar_url')
            .limit(5);
        }

        const leaderboardData = (leaderboardRes.data || []).map((u: any, i: number) => ({
          ...u,
          points: u.points || 0,
          rank: i + 1
        }));

        const newStats = { upcomingEvents, activeChallenges, totalMembers };
        setStats(newStats);
        setEvents(eventsData);
        setLeaderboard(leaderboardData);

        // Update cache
        setCache('dashboard_events', eventsData);
        setCache('dashboard_stats', newStats);
        setCache('dashboard_leaderboard', leaderboardData);

      } catch (err) {
        console.error('Dashboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, []); // Empty dependency array: Only fetch once on mount

  return (
    <div className="space-y-8 font-sans">
      <header>
        <h1 className="text-3xl font-bold text-[#212B36] tracking-tight mb-1">Dashboard</h1>
        <p className="text-gray-500 text-sm font-medium">Welcome back to TechSphere community hub.</p>
      </header>

      {tableStatus === 'missing' && (
        <div className="bg-amber-50 border border-amber-200 p-4 rounded-xl flex items-start gap-4 animate-in slide-in-from-top-4 duration-300">
          <div className="p-2 bg-amber-100 rounded-lg text-amber-600">
            <Icon icon="solar:danger-bold" fontSize={24} />
          </div>
          <div className="flex-1">
            <h3 className="text-sm font-bold text-amber-900 mb-1">Database Setup Required</h3>
            <p className="text-xs text-amber-700 leading-relaxed mb-3">
              It looks like your database connection is new. You need to initialize the tables before the dashboard can display real data.
            </p>
            <div className="flex gap-3">
              <code className="px-2 py-1 bg-amber-100 rounded text-[10px] font-bold text-amber-800">npm run setup</code>
              <button onClick={() => window.location.reload()} className="text-[10px] font-bold text-amber-900 underline">Refresh after setup</button>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {[
          { label: 'Upcoming Events', val: stats.upcomingEvents, icon: 'solar:calendar-minimalistic-bold', color: 'text-blue-600', bg: 'bg-blue-50' },
          { label: 'Active Challenges', val: stats.activeChallenges, icon: 'solar:cup-bold', color: 'text-amber-600', bg: 'bg-amber-50' },
          { label: 'Total Members', val: stats.totalMembers > 999 ? `${(stats.totalMembers/1000).toFixed(1)}k` : stats.totalMembers, icon: 'solar:users-group-rounded-bold', color: 'text-indigo-600', bg: 'bg-indigo-50' },
        ].map((s, i) => (
          <div key={i} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex items-center gap-5 group hover:shadow-md transition-all">
            <div className={`w-14 h-14 ${s.bg} rounded-xl flex items-center justify-center ${s.color} group-hover:scale-110 transition-transform`}>
              <Icon icon={s.icon} fontSize={32} />
            </div>
            <div>
              <p className="text-2xl font-bold text-[#212B36]">{loading ? '...' : s.val}</p>
              <p className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">{s.label}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-bold text-[#212B36]">Recent Events</h2>
            <Link to="/events" className="text-indigo-600 font-bold text-sm flex items-center gap-1 hover:underline">
              View All <Icon icon="solar:arrow-right-bold" />
            </Link>
          </div>

          <div className="space-y-4">
            {loading && events.length === 0 ? (
              [1, 2, 3].map(i => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
            ) : events.length > 0 ? (
              events.map((event: any) => (
                <div key={event.id} className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm flex gap-5 group hover:shadow-md transition-all">
                  <div className="w-24 h-24 bg-gray-50 rounded-lg overflow-hidden shrink-0">
                    <img src={event.image_url || `https://images.unsplash.com/photo-1517245386807-bb43f82c33c4?auto=format&fit=crop&q=80&w=200`} alt="" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="px-2 py-0.5 bg-indigo-50 text-indigo-600 text-[10px] font-bold rounded-md uppercase tracking-wider">
                        { (event.pass_settings?.type ?? event.type) === 'challenge' ? 'Challenge' : 'Event' }
                      </span>
                      <span className="text-[11px] text-gray-400 font-bold">{new Date(event.date).toLocaleDateString()}</span>
                    </div>
                    <h3 className="text-base font-bold text-[#212B36] mb-1 truncate">{event.title}</h3>
                    <p className="text-gray-500 text-xs line-clamp-2 leading-relaxed">{event.description}</p>
                  </div>
                  <div className="flex items-center">
                    <Link to={(event.pass_settings?.type ?? event.type) === 'challenge' ? '/challenges' : '/events'} className="p-2.5 bg-gray-50 rounded-lg text-gray-400 group-hover:bg-indigo-600 group-hover:text-white transition-all">
                      <Icon icon="solar:alt-arrow-right-bold" fontSize={18} />
                    </Link>
                  </div>
                </div>
              ))
            ) : (
              <EmptyState 
                icon="solar:calendar-bold"
                title="No Events Hosted Yet"
                description="The community is just getting started. Check back soon for exciting meetups and workshops!"
              />
            )}
          </div>
        </div>

        <div className="space-y-5">
          <h2 className="text-xl font-bold text-[#212B36]">Leaderboard</h2>
          <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm space-y-5">
            {loading && leaderboard.length === 0 ? (
              [1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-12 w-full" />)
            ) : leaderboard.length > 0 ? (
              leaderboard.map((u, i) => (
                <div key={u.id} className="flex items-center gap-4 animate-in fade-in slide-in-from-right-4 duration-300" style={{ animationDelay: `${i * 100}ms` }}>
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${i === 0 ? 'bg-amber-100 text-amber-600' : i === 1 ? 'bg-gray-100 text-gray-600' : i === 2 ? 'bg-orange-100 text-orange-600' : 'bg-gray-50 text-gray-400'}`}>
                    {i + 1}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-[#212B36] truncate">{u.full_name}</p>
                    <p className="text-[11px] text-gray-400 font-bold">{u.points || 0} XP</p>
                  </div>
                  {i === 0 && <Icon icon="solar:star-bold" className="text-amber-400" fontSize={16} />}
                </div>
              ))
            ) : (
              <div className="py-8 text-center">
                <Icon icon="solar:cup-bold" className="text-gray-300 mx-auto mb-3" fontSize={32} />
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest leading-relaxed">
                  Competitions Coming Soon!<br/>
                  <span className="opacity-60">Join events to earn points.</span>
                </p>
              </div>
            )}
            <Link to="/leaderboard" className="block text-center w-full py-3 bg-gray-50 text-gray-600 rounded-lg font-bold text-[11px] uppercase tracking-wider hover:bg-gray-100 transition-all">
              View Full Ranking
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
