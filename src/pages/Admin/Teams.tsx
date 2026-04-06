import { useEffect, useMemo, useState } from 'react';
import { Icon } from '@iconify/react';
import supabase from '../../lib/supabase';

const AdminTeams = () => {
  const [teams, setTeams] = useState<any[]>([]);
  const [selectedTeam, setSelectedTeam] = useState<any>(null);
  const [teamMembers, setTeamMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [renameValue, setRenameValue] = useState('');
  const [newLeaderId, setNewLeaderId] = useState('');
  const [addMemberEmail, setAddMemberEmail] = useState('');
  const [xpAmount, setXpAmount] = useState(0);
  const [actionLoading, setActionLoading] = useState(false);

  const fetchTeams = async () => {
    setLoading(true);
    try {
      const { data: teamRows, error } = await supabase
        .from('ts_v2025_teams')
        .select('id, name, leader_id, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const { data: memberRows, error: membersError } = await supabase
        .from('ts_v2025_team_members')
        .select('team_id, status');
      if (membersError) throw membersError;

      const leaderIds = Array.from(new Set((teamRows || []).map((team: any) => team.leader_id).filter(Boolean)));
      let leaderMap = new Map<string, any>();
      if (leaderIds.length > 0) {
        const { data: leaders, error: leaderError } = await supabase
          .from('ts_v2025_profiles')
          .select('id, full_name, email')
          .in('id', leaderIds);
        if (leaderError) throw leaderError;
        leaderMap = new Map((leaders || []).map((leader: any) => [leader.id, leader]));
      }

      const counts = (memberRows || []).reduce((acc: any, row: any) => {
        if (!acc[row.team_id]) acc[row.team_id] = { total: 0, pending: 0 };
        acc[row.team_id].total += 1;
        if (row.status === 'pending') acc[row.team_id].pending += 1;
        return acc;
      }, {});

      const enriched = (teamRows || []).map((team: any) => ({
        ...team,
        leader: team.leader_id ? leaderMap.get(team.leader_id) : null,
        member_count: counts[team.id]?.total || 0,
        pending_count: counts[team.id]?.pending || 0
      }));

      setTeams(enriched);
    } catch (err: any) {
      console.error('Failed to load teams:', err.message || err);
    } finally {
      setLoading(false);
    }
  };

  const fetchTeamMembers = async (teamId: string) => {
    const { data, error } = await supabase
      .from('ts_v2025_team_members')
      .select('id, user_id, status, role')
      .eq('team_id', teamId)
      .order('created_at', { ascending: true });
    if (error) throw error;
    const memberList = data || [];
    const profileIds = memberList.map((m: any) => m.user_id).filter(Boolean);
    let profilesMap = new Map<string, any>();
    if (profileIds.length > 0) {
      const { data: profilesData, error: profilesError } = await supabase
        .from('ts_v2025_profiles')
        .select('id, full_name, email, points')
        .in('id', profileIds);
      if (profilesError) throw profilesError;
      profilesMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
    }
    const hydrated = memberList.map((m: any) => ({
      ...m,
      profiles: profilesMap.get(m.user_id) || null
    }));
    setTeamMembers(hydrated);
  };

  useEffect(() => {
    fetchTeams();
  }, []);

  const filteredTeams = useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return teams;
    return teams.filter((team) => team.name?.toLowerCase().includes(query));
  }, [teams, search]);

  const handleSelectTeam = async (team: any) => {
    setSelectedTeam(team);
    setRenameValue(team.name || '');
    setNewLeaderId(team.leader_id || '');
    try {
      await fetchTeamMembers(team.id);
    } catch (err: any) {
      console.error('Failed to load team members:', err.message || err);
    }
  };

  const refreshSelected = async () => {
    if (!selectedTeam?.id) return;
    await fetchTeamMembers(selectedTeam.id);
    await fetchTeams();
  };

  const cleanupTeamIfEmpty = async (teamId: string) => {
    const { count, error } = await supabase
      .from('ts_v2025_team_members')
      .select('id', { count: 'exact', head: true })
      .eq('team_id', teamId);
    if (!error && (count || 0) === 0) {
      await supabase.from('ts_v2025_teams').delete().eq('id', teamId);
      setSelectedTeam(null);
      setTeamMembers([]);
    }
  };

  const handleRenameTeam = async () => {
    if (!selectedTeam?.id) return;
    const name = renameValue.trim();
    if (!name) return;
    setActionLoading(true);
    try {
      const { error } = await supabase
        .from('ts_v2025_teams')
        .update({ name })
        .eq('id', selectedTeam.id);
      if (error) throw error;
      await fetchTeams();
      setSelectedTeam((prev: any) => prev ? { ...prev, name } : prev);
    } catch (err: any) {
      alert('Failed to rename team: ' + (err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleSetLeader = async () => {
    if (!selectedTeam?.id || !newLeaderId) return;
    setActionLoading(true);
    try {
      const currentLeader = teamMembers.find((m) => m.role === 'leader');
      const { error: teamError } = await supabase
        .from('ts_v2025_teams')
        .update({ leader_id: newLeaderId })
        .eq('id', selectedTeam.id);
      if (teamError) throw teamError;

      await supabase
        .from('ts_v2025_team_members')
        .update({ role: 'leader', status: 'approved' })
        .eq('team_id', selectedTeam.id)
        .eq('user_id', newLeaderId);

      if (currentLeader?.user_id && currentLeader.user_id !== newLeaderId) {
        await supabase
          .from('ts_v2025_team_members')
          .update({ role: 'member' })
          .eq('team_id', selectedTeam.id)
          .eq('user_id', currentLeader.user_id);
      }

      await refreshSelected();
    } catch (err: any) {
      alert('Failed to update leader: ' + (err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddMember = async () => {
    if (!selectedTeam?.id) return;
    const email = addMemberEmail.trim();
    if (!email) return;
    setActionLoading(true);
    try {
      const { data: profile, error } = await supabase
        .from('ts_v2025_profiles')
        .select('id, full_name, email')
        .ilike('email', email)
        .maybeSingle();
      if (error) throw error;
      if (!profile) {
        alert('No user found with that email.');
        return;
      }

      const { error: insertError } = await supabase
        .from('ts_v2025_team_members')
        .insert({ team_id: selectedTeam.id, user_id: profile.id, role: 'member', status: 'approved' });
      if (insertError) throw insertError;

      setAddMemberEmail('');
      await refreshSelected();
    } catch (err: any) {
      const msg = String(err.message || '');
      if (msg.toLowerCase().includes('unique')) {
        alert('That user is already in a team.');
      } else {
        alert('Failed to add member: ' + msg);
      }
    } finally {
      setActionLoading(false);
    }
  };

  const handleRemoveMember = async (memberId: string) => {
    if (!selectedTeam?.id) return;
    setActionLoading(true);
    try {
      await supabase.from('ts_v2025_team_members').delete().eq('id', memberId);
      await cleanupTeamIfEmpty(selectedTeam.id);
      await refreshSelected();
    } catch (err: any) {
      alert('Failed to remove member: ' + (err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteTeam = async () => {
    if (!selectedTeam?.id) return;
    if (!confirm('Delete this team? This will remove all members.')) return;
    setActionLoading(true);
    try {
      await supabase.from('ts_v2025_teams').delete().eq('id', selectedTeam.id);
      setSelectedTeam(null);
      setTeamMembers([]);
      await fetchTeams();
    } catch (err: any) {
      alert('Failed to delete team: ' + (err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleApproveMember = async (memberId: string) => {
    setActionLoading(true);
    try {
      await supabase.from('ts_v2025_team_members').update({ status: 'approved' }).eq('id', memberId);
      await refreshSelected();
    } catch (err: any) {
      alert('Failed to approve member: ' + (err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  const handleAddXp = async () => {
    if (!selectedTeam?.id) return;
    const value = Number(xpAmount || 0);
    if (!value || value <= 0) return;
    setActionLoading(true);
    try {
      const approvedIds = teamMembers.filter((m) => m.status === 'approved').map((m) => m.user_id);
      if (approvedIds.length === 0) return;

      const { data: profiles, error } = await supabase
        .from('ts_v2025_profiles')
        .select('id, points')
        .in('id', approvedIds);
      if (error) throw error;

      await Promise.all(
        (profiles || []).map((p: any) =>
          supabase
            .from('ts_v2025_profiles')
            .update({ points: (p.points || 0) + value })
            .eq('id', p.id)
        )
      );

      await refreshSelected();
    } catch (err: any) {
      alert('Failed to add XP: ' + (err.message || err));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Admin Console</p>
          <h1 className="text-3xl font-bold text-[#212B36] tracking-tight">Team Management</h1>
        </div>
        <button
          onClick={fetchTeams}
          className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-[11px] uppercase tracking-wider hover:bg-indigo-700 transition-all flex items-center gap-2"
        >
          <Icon icon="solar:refresh-bold" fontSize={16} /> Refresh
        </button>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Icon icon="solar:magnifer-linear" className="text-gray-400" fontSize={18} />
            <input
              className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold"
              placeholder="Search team..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          {loading ? (
            <div className="py-10 flex justify-center">
              <div className="w-10 h-10 border-4 border-indigo-100 border-t-indigo-600 rounded-full animate-spin" />
            </div>
          ) : filteredTeams.length === 0 ? (
            <div className="text-center text-xs text-gray-400 font-bold uppercase tracking-widest py-10">No teams found</div>
          ) : (
            <div className="space-y-3">
              {filteredTeams.map((team: any) => (
                <button
                  key={team.id}
                  onClick={() => handleSelectTeam(team)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${selectedTeam?.id === team.id ? 'border-indigo-200 bg-indigo-50/60' : 'border-gray-100 hover:border-gray-200 hover:bg-gray-50'}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-bold text-gray-800 truncate">{team.name}</p>
                      <p className="text-[11px] text-gray-500">Leader: {team.leader?.full_name || 'Unassigned'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-indigo-600">{team.member_count}</p>
                      <p className="text-[9px] text-gray-400 uppercase tracking-widest">Members</p>
                    </div>
                  </div>
                  {team.pending_count > 0 && (
                    <p className="mt-2 text-[10px] font-bold uppercase tracking-widest text-amber-600">{team.pending_count} pending</p>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="lg:col-span-2 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">
          {!selectedTeam ? (
            <div className="py-16 text-center text-gray-400 font-bold uppercase text-xs tracking-widest">Select a team to manage</div>
          ) : (
            <div className="space-y-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Team Overview</p>
                  <h2 className="text-2xl font-bold text-[#212B36]">{selectedTeam.name}</h2>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={handleDeleteTeam}
                    disabled={actionLoading}
                    className="px-4 py-2 bg-red-50 text-red-600 rounded-lg text-xs font-bold uppercase tracking-wider hover:bg-red-100 transition-all"
                  >
                    Delete Team
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Rename Team</label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold"
                      value={renameValue}
                      onChange={(e) => setRenameValue(e.target.value)}
                    />
                    <button
                      onClick={handleRenameTeam}
                      disabled={actionLoading}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Set Team Leader</label>
                  <div className="flex gap-2">
                    <select
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold"
                      value={newLeaderId}
                      onChange={(e) => setNewLeaderId(e.target.value)}
                    >
                      <option value="">Select leader</option>
                      {teamMembers.filter((m) => m.status === 'approved').map((member) => (
                        <option key={member.user_id} value={member.user_id}>
                          {member.profiles?.full_name || member.profiles?.email || member.user_id}
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={handleSetLeader}
                      disabled={actionLoading || !newLeaderId}
                      className="px-3 py-2 bg-gray-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider"
                    >
                      Update
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Add Member By Email</label>
                  <div className="flex gap-2">
                    <input
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold"
                      value={addMemberEmail}
                      onChange={(e) => setAddMemberEmail(e.target.value)}
                      placeholder="member@techsphere.com"
                    />
                    <button
                      onClick={handleAddMember}
                      disabled={actionLoading}
                      className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider"
                    >
                      Add
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Add XP To Approved Members</label>
                  <div className="flex gap-2">
                    <input
                      type="number"
                      className="flex-1 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold"
                      value={xpAmount || ''}
                      onChange={(e) => setXpAmount(Number(e.target.value))}
                      placeholder="XP amount"
                    />
                    <button
                      onClick={handleAddXp}
                      disabled={actionLoading}
                      className="px-3 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-wider"
                    >
                      Apply
                    </button>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Members</p>
                {teamMembers.length === 0 ? (
                  <div className="text-xs text-gray-400 font-bold uppercase tracking-widest">No members</div>
                ) : (
                  <div className="space-y-2">
                    {teamMembers.map((member) => (
                      <div key={member.id} className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                        <div>
                          <p className="text-sm font-bold text-gray-800">{member.profiles?.full_name || 'Member'}</p>
                          <p className="text-[11px] text-gray-500">{member.profiles?.email || member.user_id}</p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider whitespace-nowrap ${member.status === 'pending' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'}`}>
                            {member.status}
                          </span>
                          {member.role === 'leader' && (
                            <span className="px-2 py-0.5 rounded text-[9px] font-bold uppercase tracking-wider whitespace-nowrap bg-indigo-50 text-indigo-600">Leader</span>
                          )}
                          {member.status === 'pending' ? (
                            <button
                              onClick={() => handleApproveMember(member.id)}
                              disabled={actionLoading}
                              className="text-[10px] font-bold uppercase text-emerald-600"
                            >
                              Approve
                            </button>
                          ) : null}
                          <button
                            onClick={() => handleRemoveMember(member.id)}
                            disabled={actionLoading || member.role === 'leader'}
                            className={`text-[10px] font-bold uppercase ${member.role === 'leader' ? 'text-gray-300' : 'text-red-500'}`}
                          >
                            Remove
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AdminTeams;
