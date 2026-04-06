import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import supabase from '../lib/supabase';
import { Skeleton } from '../components/Skeleton';
import { EmptyState } from '../components/EmptyState';

const Leaderboard = () => {
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<any[]>([]);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      try {
        setLoading(true);

        const { data: { session } } = await supabase.auth.getSession();
        setCurrentUserId(session?.user?.id || null);

        let res;
        try {
          res = await supabase
            .from('ts_v2025_profiles')
            .select('id, full_name, avatar_url, points')
            .order('points', { ascending: false });
          if (res.error) throw res.error;
        } catch (err) {
          res = await supabase
            .from('ts_v2025_profiles')
            .select('id, full_name, avatar_url');
        }

        const data = (res.data || []).map((u: any, i: number) => ({
          ...u,
          points: u.points || 0,
          rank: i + 1
        }));

        setRows(data);
      } catch (err) {
        console.error('Leaderboard fetch error:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchLeaderboard();
  }, []);

  const me = useMemo(() => rows.find(r => r.id === currentUserId), [rows, currentUserId]);

  return (
    <div className="space-y-8 font-sans">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#212B36] tracking-tight mb-1">Leaderboard</h1>
          <p className="text-gray-500 text-sm font-medium">Track rankings and see where you stand.</p>
        </div>
        <div className="hidden md:flex items-center gap-2 bg-indigo-50 text-indigo-700 px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-widest">
          <Icon icon="solar:cup-star-bold" fontSize={18} />
          Rankings
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-lg font-bold text-[#212B36]">All Members</h2>
              <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{rows.length} Players</span>
            </div>

            {loading ? (
              <div className="p-6 space-y-3">
                {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-12 w-full" />)}
              </div>
            ) : rows.length > 0 ? (
              <div className="divide-y divide-gray-50">
                {rows.map((u, i) => {
                  const isMe = u.id === currentUserId;
                  return (
                    <div
                      key={u.id || i}
                      className={`flex items-center gap-4 px-6 py-4 ${isMe ? 'bg-indigo-50/60' : 'bg-white'} hover:bg-gray-50 transition-colors`}
                    >
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-xs ${
                        u.rank === 1 ? 'bg-amber-100 text-amber-700' :
                        u.rank === 2 ? 'bg-gray-100 text-gray-600' :
                        u.rank === 3 ? 'bg-orange-100 text-orange-700' :
                        'bg-gray-50 text-gray-400'
                      }`}>
                        {u.rank}
                      </div>
                      <div className="w-10 h-10 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-gray-500 font-bold text-xs">
                        {u.avatar_url ? (
                          <img src={u.avatar_url} alt="" className="w-full h-full object-cover" />
                        ) : (
                          (u.full_name || 'U')[0]
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-bold text-sm truncate ${isMe ? 'text-indigo-700' : 'text-[#212B36]'}`}>
                          {u.full_name || 'Unnamed User'}
                          {isMe && <span className="ml-2 text-[10px] font-black uppercase tracking-widest text-indigo-600">You</span>}
                        </p>
                        <p className="text-[11px] text-gray-400 font-bold whitespace-nowrap">{u.points || 0} XP</p>
                      </div>
                      {u.rank === 1 && <Icon icon="solar:star-bold" className="text-amber-400" fontSize={18} />}
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="p-10">
                <EmptyState
                  icon="solar:cup-bold"
                  title="No Rankings Yet"
                  description="Join events and challenges to start earning points."
                />
              </div>
            )}
          </div>
        </div>

        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
            <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Your Position</h3>
            {loading ? (
              <div className="space-y-3">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-10 w-full" />
              </div>
            ) : me ? (
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-indigo-100 text-indigo-700 flex items-center justify-center font-black">
                  #{me.rank}
                </div>
                <div>
                  <p className="text-sm font-bold text-[#212B36]">{me.full_name || 'Your Account'}</p>
                  <p className="text-[11px] font-bold text-gray-400 whitespace-nowrap">{me.points || 0} XP</p>
                </div>
              </div>
            ) : (
              <div className="text-xs text-gray-400 font-bold uppercase tracking-widest">
                Login to view your rank
              </div>
            )}
          </div>

          <div className="bg-gradient-to-br from-[#161C24] to-[#1F2A37] rounded-2xl p-6 text-white shadow-xl">
            <p className="text-[11px] font-bold uppercase tracking-widest text-indigo-300 mb-2">How To Rank Up</p>
            <ul className="space-y-2 text-sm font-medium text-white/90">
              <li className="flex items-start gap-2">
                <Icon icon="solar:check-circle-bold" className="text-indigo-300 mt-0.5" fontSize={16} />
                Join events and challenges
              </li>
              <li className="flex items-start gap-2">
                <Icon icon="solar:check-circle-bold" className="text-indigo-300 mt-0.5" fontSize={16} />
                Complete registrations and attend
              </li>
              <li className="flex items-start gap-2">
                <Icon icon="solar:check-circle-bold" className="text-indigo-300 mt-0.5" fontSize={16} />
                Earn points from activities
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Leaderboard;
