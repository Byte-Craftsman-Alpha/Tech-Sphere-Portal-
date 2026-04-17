import { useEffect, useState, useRef } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import { QRCodeSVG } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { useCache } from '../context/CacheContext';
import supabase from '../lib/supabase';
import { EmptyState } from '../components/EmptyState';

const Challenges = () => {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [showForm, setShowForm] = useState<any>(null);
  const [formResponses, setFormResponses] = useState<any>({});
  const [formErrors, setFormErrors] = useState<any>({});
  const [availableUsers, setAvailableUsers] = useState<any[]>([]);
  const [availableTeams, setAvailableTeams] = useState<any[]>([]);
  const [optionsLoading, setOptionsLoading] = useState(false);
  const [profileInfo, setProfileInfo] = useState<any>(null);
  const [selectedChallenge, setSelectedChallenge] = useState<any>(null);
  const passRef = useRef<HTMLDivElement>(null);
  const { getCache, setCache } = useCache();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const cachedData = getCache('challenges');
      if (cachedData) {
        setChallenges(cachedData);
        setLoading(false);
      }
      const { data: eventsData, error: eventsError } = await supabase.from('ts_v2025_events').select('*').order('date', { ascending: true });
      if (eventsError) throw eventsError;
      const onlyChallenges = (eventsData || []).filter(e => (e.pass_settings?.type ?? e.type) === 'challenge');
      setCache('challenges', onlyChallenges);
      setChallenges(onlyChallenges);
      let registrationsData = [];
      if (session?.user) {
        const { data: regsData, error: regsError } = await supabase.from('ts_v2025_registrations').select('*').eq('user_id', session.user.id);
        if (regsError) throw regsError;
        registrationsData = regsData || [];
      }
      setRegistrations(registrationsData);
    } catch (err: any) {
      console.error('Error fetching data:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const normalizeMulti = (value: any) => {
    if (Array.isArray(value)) return value.filter(Boolean);
    if (typeof value === 'string') {
      return value.split(',').map(v => v.trim()).filter(Boolean);
    }
    return [];
  };

  const getOptions = (field: any) =>
    String(field?.options || '')
      .split(',')
      .map((o) => o.trim())
      .filter(Boolean);

  const hydrateDefaults = (challenge: any, existing: any = {}) => {
    const responses = { ...existing };
    (challenge.custom_form || []).forEach((field: any) => {
      if (responses[field.id] === undefined && field.default_value !== undefined && field.default_value !== '') {
        responses[field.id] = field.default_value;
      }
    });
    return responses;
  };

  const fetchDynamicOptions = async () => {
    setOptionsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      const { data: profile } = await supabase
        .from('ts_v2025_profiles')
        .select('full_name, email, roll_no, semester, branch, whatsapp, avatar_url, github_url, linkedin_url, instagram')
        .eq('id', user?.id || '')
        .maybeSingle();
      const { data: teamMember } = await supabase
        .from('ts_v2025_team_members')
        .select('status, team:ts_v2025_teams(name)')
        .eq('user_id', user?.id || '')
        .eq('status', 'approved')
        .maybeSingle();
      const teamName = Array.isArray((teamMember as any)?.team)
        ? (teamMember as any).team[0]?.name
        : (teamMember as any)?.team?.name;
      const enrichedProfile: Record<string, any> = {
        ...(profile || {}),
        team_name: teamName || ''
      };
      setProfileInfo(enrichedProfile);

      const { data: users } = await supabase
        .from('ts_v2025_profiles')
        .select('id, full_name, email')
        .eq('approved', true)
        .order('full_name', { ascending: true });
      const userList = users || [];
      setAvailableUsers(userList);

      const { data: teams } = await supabase
        .from('ts_v2025_teams')
        .select('id, name')
        .order('name', { ascending: true });
      const teamList = teams || [];
      setAvailableTeams(teamList);

      if (showForm) {
        setFormResponses((prev: any) => {
          const next = { ...prev };
          (showForm.custom_form || []).forEach((field: any) => {
            if (next[field.id]) return;
            if (field.type === 'profile_field' && field.profile_key && enrichedProfile) {
              next[field.id] = (enrichedProfile as Record<string, any>)[field.profile_key] || '';
              return;
            }
            if (field.type === 'user_select' && field.default_value) {
              const match = userList.find((u: any) =>
                u.id === field.default_value ||
                u.email?.toLowerCase() === String(field.default_value).toLowerCase() ||
                u.full_name?.toLowerCase() === String(field.default_value).toLowerCase()
              );
              if (match) next[field.id] = match.id;
            }
            if (field.type === 'team_select' && field.default_value) {
              const match = teamList.find((t: any) =>
                t.id === field.default_value ||
                t.name?.toLowerCase() === String(field.default_value).toLowerCase()
              );
              if (match) next[field.id] = match.id;
            }
          });
          return next;
        });
      }
    } catch (err: any) {
      console.error('Failed loading dynamic options:', err.message || err);
    } finally {
      setOptionsLoading(false);
    }
  };

  const normalizeUniqueValue = (value: any) => {
    if (Array.isArray(value)) {
      return value.map((v) => String(v).trim().toLowerCase()).filter(Boolean).join('|');
    }
    if (value === undefined || value === null) return '';
    return String(value).trim().toLowerCase();
  };

  const validateForm = async (challenge: any, responses: any = formResponses) => {
    const errors: any = {};
    challenge.custom_form?.forEach((field: any) => {
      const value = responses[field.id];
      const isEmpty = Array.isArray(value) ? value.length === 0 : !value;
      if (field.required && isEmpty) errors[field.id] = 'This field is required';
    });
    if (Object.keys(errors).length > 0) {
      setFormErrors(errors);
      return false;
    }

    const uniqueFields = (challenge.custom_form || []).filter((field: any) => field.constraint === 'unique');
    if (uniqueFields.length === 0) {
      setFormErrors(errors);
      return true;
    }

    const { data: existingRegs, error } = await supabase
      .from('ts_v2025_registrations')
      .select('id, form_responses')
      .eq('event_id', challenge.id);
    if (error) {
      console.error('Unique constraint check failed:', error.message);
      setFormErrors(errors);
      return true;
    }

    const existingId = getPass(challenge.id)?.id;
    uniqueFields.forEach((field: any) => {
      const valueKey = normalizeUniqueValue(responses[field.id]);
      if (!valueKey) return;
      const conflict = (existingRegs || []).find((reg: any) => {
        if (reg.id === existingId) return false;
        const regValue = normalizeUniqueValue(reg.form_responses?.[field.id]);
        return regValue && regValue === valueKey;
      });
      if (conflict) errors[field.id] = `${field.label || 'This field'} must be unique`;
    });

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getProfileSnapshot = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;
    const { data: profile } = await supabase
      .from('ts_v2025_profiles')
      .select('full_name, email, roll_no, semester, branch, whatsapp, avatar_url, github_url, linkedin_url, instagram')
      .eq('id', user.id)
      .maybeSingle();
    const { data: teamMember } = await supabase
      .from('ts_v2025_team_members')
      .select('status, team:ts_v2025_teams(name)')
      .eq('user_id', user.id)
      .eq('status', 'approved')
      .maybeSingle();
    const teamName = Array.isArray((teamMember as any)?.team)
      ? (teamMember as any).team[0]?.name
      : (teamMember as any)?.team?.name;
    return {
      ...(profile || {}),
      team_name: teamName || ''
    };
  };

  const applyProfileOverrides = (challenge: any, responses: any, snapshot: any) => {
    const next = { ...responses };
    (challenge.custom_form || []).forEach((field: any) => {
      if (field.type === 'profile_field' && field.profile_key) {
        next[field.id] = snapshot?.[field.profile_key] || '';
      }
    });
    return next;
  };

  const getMissingProfileFields = (challenge: any, snapshot: any) => {
    return (challenge.custom_form || []).filter((field: any) => {
      if (field.type !== 'profile_field') return false;
      if (!field.required) return false;
      const key = field.profile_key;
      if (!key) return false;
      const value = snapshot?.[key];
      return value === null || value === undefined || String(value).trim() === '';
    });
  };

  const handleMissingProfileFields = (missing: any[]) => {
    if (missing.length === 0) return false;
    const errors: any = {};
    missing.forEach((field) => {
      errors[field.id] = `Update your profile: ${field.label || field.profile_key || 'Required field'}`;
    });
    setFormErrors(errors);
    alert(`Please update your profile before registering: ${missing.map((f) => f.label || f.profile_key).join(', ')}`);
    return true;
  };

  const handleRegister = async (challenge: any) => {
    const isClosed = (challenge.pass_settings?.is_open ?? challenge.is_open) === false;
    if (isClosed) return;
    if (loading && !showForm) return;
    if (challenge.custom_form?.length > 0 && !showForm) {
      const profileSnapshot = (profileInfo || await getProfileSnapshot());
      const missing = getMissingProfileFields(challenge, profileSnapshot);
      if (handleMissingProfileFields(missing)) return;
      const existing = getPass(challenge.id);
      setShowForm(challenge);
      setFormResponses(hydrateDefaults(challenge, existing?.form_responses || {}));
      setFormErrors({});
      await fetchDynamicOptions();
      return;
    }
    let finalResponses = formResponses;
    if (showForm) {
      const profileSnapshot = (profileInfo || await getProfileSnapshot());
      const missing = getMissingProfileFields(showForm, profileSnapshot);
      if (handleMissingProfileFields(missing)) return;
      const lockedResponses = applyProfileOverrides(showForm, formResponses, profileSnapshot);
      setFormResponses(lockedResponses);
      if (!(await validateForm(showForm, lockedResponses))) return;
      finalResponses = lockedResponses;
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setLoading(true);
    try {
      const existing = getPass(challenge.id);
      const payload = { user_id: session.user.id, event_id: challenge.id, status: 'registered', qr_data: `pass_${session.user.id}_${challenge.id}`, form_responses: finalResponses || {} };
      if (existing) {
        await supabase.from('ts_v2025_registrations').update({ status: 'registered', form_responses: finalResponses || {} }).eq('id', existing.id);
      } else {
        await supabase.from('ts_v2025_registrations').insert(payload);
      }
      setShowForm(null);
      await fetchData();
    } finally {
      setLoading(false);
    }
  };

  const handleUnregister = async (regId: string, challenge?: any) => {
    if (loading) return;
    if (challenge && (challenge.pass_settings?.is_open ?? challenge.is_open) === false) return;
    if (!confirm('Leave Challenge?')) return;
    setLoading(true);
    try {
      await supabase.from('ts_v2025_registrations').delete().eq('id', regId);
      await fetchData();
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPNG = async () => {
    if (!passRef.current || !selectedChallenge) return;
    try {
      const dataUrl = await toPng(passRef.current, { 
        cacheBust: true, 
        pixelRatio: 2, 
        backgroundColor: '#161C24' 
      });
      const link = document.createElement('a');
      link.download = `ChallengePass_${selectedChallenge.title.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('PNG error:', err);
    }
  };

  const isRegistered = (id: string) => registrations.some((r: any) => r.event_id === id);
  const getPass = (id: string) => registrations.find((r: any) => r.event_id === id);

  return (
    <div className="space-y-8 font-sans">
      <header>
        <h1 className="text-3xl font-bold text-[#212B36] tracking-tight mb-1">Challenges</h1>
        <p className="text-gray-500 text-sm font-medium">Sharpen your skills and climb the leaderboard.</p>
      </header>

      <div className={challenges.length > 0 ? "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6" : ""}>
        {loading && challenges.length === 0 ? (
          [1, 2, 3].map(i => <div key={i} className="h-48 bg-white rounded-xl border border-gray-100 animate-pulse" />)
        ) : challenges.length > 0 ? (
          challenges.map((c) => {
            const registered = isRegistered(c.id);
            const isClosed = (c.pass_settings?.is_open ?? c.is_open) === false;

            return (
              <div key={c.id} className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm flex flex-col group hover:shadow-md transition-all">
                <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center mb-5 uppercase font-black text-xs">XP</div>
                <h3 className="text-lg font-bold text-[#212B36] truncate">{c.title}</h3>
                <p className="text-gray-500 text-xs line-clamp-2 mb-6">{c.description}</p>
                <div className="mt-auto pt-5 border-t border-gray-50 flex items-center justify-between">
                  {registered ? (
                    <div className="flex items-center gap-2 w-full">
                      <div className="flex items-center gap-1 text-green-600 font-bold text-[10px] uppercase tracking-wider mr-auto">
                        <Icon icon="solar:check-circle-bold" fontSize={14} /> Joined
                      </div>
                      <div className="flex gap-2">
                        {c.custom_form?.length > 0 && !isClosed && (
                          <button 
                            onClick={() => handleRegister(c)}
                            className="p-2 bg-gray-50 text-gray-400 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-gray-100"
                            title="Edit Details"
                          >
                            <Icon icon="solar:pen-new-square-bold" fontSize={16} />
                          </button>
                        )}
                        <button 
                          onClick={() => setSelectedChallenge({ ...c, pass: getPass(c.id) })} 
                          className="px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700 transition-all shadow-lg uppercase tracking-wider"
                        >
                          Pass
                        </button>
                        {!isClosed && (
                          <button 
                            onClick={() => handleUnregister(getPass(c.id).id, c)} 
                            className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all shadow-sm"
                          >
                            <Icon icon="solar:trash-bin-trash-bold" />
                          </button>
                        )}
                      </div>
                    </div>
                  ) : (
                    <button onClick={() => handleRegister(c)} className={`px-5 py-2.5 rounded-lg font-bold text-xs uppercase tracking-wider ${isClosed ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#212B36] text-white hover:bg-[#161C24]'}`} disabled={isClosed}>
                      {isClosed ? 'Closed' : 'Join Challenge'}
                    </button>
                  )}
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState 
            icon="solar:cup-bold"
            title="No Active Challenges"
            description="The competition Arena is currently quiet. Be ready—new challenges for your technical skills are coming soon!"
          />
        )}
      </div>

      {showForm && createPortal(
        <div className="fixed inset-0 bg-[#212B36]/60 backdrop-blur-sm z-[110] flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl p-8 relative">
            <button onClick={() => setShowForm(null)} className="absolute top-4 right-4 text-gray-400"><Icon icon="solar:close-circle-bold" fontSize={24} /></button>
            <h2 className="text-xl font-bold mb-6">Challenge Entry</h2>
            <div className="space-y-4">
              {showForm.custom_form.map((field: any) => {
                const value = formResponses[field.id];
                const options = getOptions(field);
                const multiValue = normalizeMulti(value);
                return (
                  <div key={field.id} className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{field.label}</label>
                    {(field.type === 'user_select' || field.type === 'team_select') && optionsLoading && (
                      <div className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Loading options...</div>
                    )}
                    {field.type === 'profile_field' ? (
                      <div className="inline-flex items-center gap-2 px-3 py-2 bg-indigo-50 border border-indigo-100 rounded-xl text-xs font-bold text-indigo-700 uppercase tracking-wider">
                        <Icon icon="solar:lock-keyhole-minimalistic-bold" fontSize={14} />
                        <span className="truncate max-w-[220px]">{value || 'Not set'}</span>
                      </div>
                    ) : field.type === 'textarea' ? (
                      <textarea
                        rows={4}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                        value={value || ''}
                        onChange={(e) => setFormResponses({ ...formResponses, [field.id]: e.target.value })}
                      />
                    ) : field.type === 'user_select' ? (
                      <select
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                        value={value || ''}
                        onChange={(e) => setFormResponses({ ...formResponses, [field.id]: e.target.value })}
                      >
                        <option value="">{field.default_value ? 'Default Selected' : 'Select user'}</option>
                        {availableUsers.map((user: any) => (
                          <option key={user.id} value={user.id}>
                            {user.full_name || user.email || user.id}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'team_select' ? (
                      <select
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                        value={value || ''}
                        onChange={(e) => setFormResponses({ ...formResponses, [field.id]: e.target.value })}
                      >
                        <option value="">{field.default_value ? 'Default Selected' : 'Select team'}</option>
                        {availableTeams.map((team: any) => (
                          <option key={team.id} value={team.id}>
                            {team.name || team.id}
                          </option>
                        ))}
                      </select>
                    ) : field.type === 'select' ? (
                      <select
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                        value={value || ''}
                        onChange={(e) => setFormResponses({ ...formResponses, [field.id]: e.target.value })}
                      >
                        <option value="">Select</option>
                        {options.map((opt: string) => (
                          <option key={opt} value={opt}>{opt}</option>
                        ))}
                      </select>
                    ) : field.type === 'radio' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {options.map((opt: string) => (
                          <label key={opt} className="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600">
                            <input
                              type="radio"
                              name={field.id}
                              value={opt}
                              checked={value === opt}
                              onChange={(e) => setFormResponses({ ...formResponses, [field.id]: e.target.value })}
                              className="accent-indigo-600"
                            />
                            {opt}
                          </label>
                        ))}
                      </div>
                    ) : field.type === 'checkbox' ? (
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {options.map((opt: string) => {
                          const checked = multiValue.includes(opt);
                          return (
                            <label key={opt} className="flex items-center gap-2 p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-semibold text-gray-600">
                              <input
                                type="checkbox"
                                value={opt}
                                checked={checked}
                                onChange={(e) => {
                                  const next = e.target.checked
                                    ? Array.from(new Set([...multiValue, opt]))
                                    : multiValue.filter((v) => v !== opt);
                                  setFormResponses({ ...formResponses, [field.id]: next });
                                }}
                                className="accent-indigo-600"
                              />
                              {opt}
                            </label>
                          );
                        })}
                      </div>
                    ) : (
                      <input
                        type={field.type === 'number' ? 'number' : 'text'}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                        value={value || ''}
                        onChange={(e) => setFormResponses({ ...formResponses, [field.id]: e.target.value })}
                      />
                    )}
                    {formErrors[field.id] && (
                      <p className="text-[10px] font-bold text-red-600">{formErrors[field.id]}</p>
                    )}
                  </div>
                );
              })}
              <button onClick={() => handleRegister(showForm)} className="w-full py-4 bg-indigo-600 text-white rounded-lg font-bold">Submit Entry</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {selectedChallenge && createPortal(
        <div className="fixed inset-0 bg-[#212B36]/80 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-xl p-8 text-center space-y-6 relative animate-in zoom-in-95 duration-200">
             <button onClick={() => setSelectedChallenge(null)} className="absolute top-4 right-4 text-gray-400 font-sans"><Icon icon="solar:close-circle-bold" fontSize={24} /></button>
             <span className="font-bold text-sm text-indigo-600 uppercase tracking-widest">Entry Pass</span>
             <div ref={passRef} className="relative aspect-[3/4] w-full bg-[#161C24] rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
               {selectedChallenge.pass_settings?.bg_image && (
                 <img src={selectedChallenge.pass_settings.bg_image} className="absolute inset-0 w-full h-full object-cover opacity-60" crossOrigin="anonymous" />
               )}
               <div className="relative z-10 w-full h-full flex flex-col items-center justify-between p-8 text-white">
                 <div className="text-center">
                   <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-[0.3em] mb-1">Official Entry Pass</p>
                   <h2 className="text-lg font-bold leading-tight">{selectedChallenge.title}</h2>
                 </div>
                 <div className="absolute bg-white p-1 rounded-sm overflow-hidden" 
                   style={{ 
                     width: `${selectedChallenge.pass_settings?.qr_size || 25}%`, 
                     aspectRatio: '1/1',
                     left: `${selectedChallenge.pass_settings?.qr_x || 50}%`,
                     top: `${selectedChallenge.pass_settings?.qr_y || 50}%`,
                     transform: 'translate(-50%, -50%)'
                   }}>
                   <QRCodeSVG value={selectedChallenge.pass?.qr_data || 'techsphere'} size={256} className="w-full h-full" />
                 </div>
                 <div className="w-full border-t border-white/10 pt-4 text-left">
                   <p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest">Technosphere Member</p>
                   <p className="text-[9px] font-mono opacity-60">ID: #{String(selectedChallenge.pass?.id || '').slice(0, 8).toUpperCase()}</p>
                 </div>
               </div>
             </div>
             <button onClick={handleDownloadPNG} className="w-full py-4 bg-indigo-600 text-white rounded-lg font-bold flex items-center justify-center gap-2">
               <Icon icon="solar:download-bold" /> Download Pass
             </button>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
};

export default Challenges;
