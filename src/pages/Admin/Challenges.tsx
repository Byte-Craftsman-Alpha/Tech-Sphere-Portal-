import { useEffect, useState, useRef } from 'react';
import { Icon } from '@iconify/react';
import supabase from '../../lib/supabase';
import { Skeleton } from '../../components/Skeleton';
import { QRCodeSVG } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import * as XLSX from 'xlsx';

const AdminChallenges = () => {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [currentChallenge, setCurrentChallenge] = useState<any>(null);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [customForm, setCustomForm] = useState<any[]>([]);
  const [passSettings, setPassSettings] = useState({ qr_size: 25, qr_x: 50, qr_y: 50, bg_image: '' });
  const [isOpen, setIsOpen] = useState(true);
  const [hasPasses, setHasPasses] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isTracking, setIsTracking] = useState(false);
  const [showTracking, setShowTracking] = useState(false);
  const [formValues, setFormValues] = useState<any>({ title: '' });
  const trackingRef = useRef<HTMLDivElement>(null);
  const [shareLink, setShareLink] = useState<any>(null);
  const [shareLoading, setShareLoading] = useState(false);
  const [selectedRegs, setSelectedRegs] = useState<Set<string>>(new Set());
  const [trackingMenuOpen, setTrackingMenuOpen] = useState(false);
  const [bulkMenuOpen, setBulkMenuOpen] = useState(false);
  const [challengeMenuOpenId, setChallengeMenuOpenId] = useState<string | null>(null);

  useEffect(() => {
    fetchChallenges();
  }, []);

  useEffect(() => {
    if (currentChallenge) {
      setCustomForm(currentChallenge.custom_form || []);
      setPassSettings(currentChallenge.pass_settings || { qr_size: 25, qr_x: 50, qr_y: 50, bg_image: '' });
      setIsOpen(currentChallenge.pass_settings?.is_open ?? currentChallenge.is_open ?? true);
      setHasPasses(currentChallenge.pass_settings?.has_passes ?? currentChallenge.has_passes ?? false);
      setFormValues({ title: currentChallenge.title || '' });
    } else {
      setCustomForm([]);
      setPassSettings({ qr_size: 25, qr_x: 50, qr_y: 50, bg_image: '' });
      setIsOpen(true);
      setHasPasses(false);
      setFormValues({ title: '' });
    }
  }, [currentChallenge]);

  const fetchChallenges = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ts_v2025_events')
        .select('*')
        .order('date', { ascending: false });
      
      if (error) throw error;
      // Filter in JS since 'type' column is missing in DB
      const onlyChallenges = (data || []).filter(e => (e.pass_settings?.type ?? e.type) === 'challenge');
      setChallenges(onlyChallenges);
    } catch (err: any) {
      console.error('Error fetching challenges:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchRegistrations = async (challengeId: string) => {
    setIsTracking(true);
    setShowTracking(true);
    setRegistrations([]);
    setShareLink(null);
    
    setTimeout(() => {
      trackingRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);

    try {
      const { data: regs, error: regsError } = await supabase
        .from('ts_v2025_registrations')
        .select('*')
        .eq('event_id', challengeId);
      
      if (regsError) throw regsError;
      
      if (regs && regs.length > 0) {
        const userIds = [...new Set(regs.map(r => r.user_id))];
        const { data: profiles, error: profError } = await supabase
          .from('ts_v2025_profiles')
          .select('*')
          .in('id', userIds);
        
        if (profError) throw profError;
        
        const combined = regs.map(r => ({
          ...r,
          profiles: profiles?.find(p => p.id === r.user_id) || { full_name: 'Unknown User' }
        }));
        setRegistrations(combined);
      } else {
        setRegistrations([]);
      }
      setSelectedRegs(new Set());
      await loadShareLink(challengeId);
    } catch (err: any) {
      console.error('Error fetching registrations:', err.message);
    } finally {
      setIsTracking(false);
    }
  };

  const loadShareLink = async (eventId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch(`/api/registration-share?event_id=${encodeURIComponent(eventId)}`, {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (res.ok) setShareLink(data);
    } catch (err) {
      console.warn('Share link fetch failed:', err);
    }
  };

  const updateShareLink = async (eventId: string, action: 'create' | 'rotate' | 'revoke') => {
    try {
      setShareLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch('/api/registration-share', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ event_id: eventId, action })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update share link');
      setShareLink(data);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setShareLoading(false);
    }
  };

  const copyShareUrl = async (token?: string) => {
    if (!token) return;
    const url = `${window.location.origin}/share/${token}`;
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      alert('Copy failed. Please copy manually.');
    }
  };

  const addFormField = () => {
    setCustomForm([...customForm, { id: crypto.randomUUID(), label: '', type: 'text', required: false, options: '', regex: '' }]);
  };

  const updateFormField = (id: string, field: string, value: any) => {
    setCustomForm(customForm.map(f => f.id === id ? { ...f, [field]: value } : f));
  };

  const removeFormField = (id: string) => {
    setCustomForm(customForm.filter(f => f.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const formDataObj = new FormData(e.target as HTMLFormElement);
    const challengeData = Object.fromEntries(formDataObj.entries());
    
    try {
      const body = {
        ...challengeData,
        custom_form: customForm,
        pass_settings: {
          ...passSettings,
          type: 'challenge',
          has_passes: hasPasses,
          is_open: isOpen
        }
      };

      let error;
      if (currentChallenge?.id) {
        const { error: updateError } = await supabase
          .from('ts_v2025_events')
          .update(body)
          .eq('id', currentChallenge.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase
          .from('ts_v2025_events')
          .insert([body]);
        error = insertError;
      }

      if (error) throw error;

      setIsModalOpen(false);
      setCurrentChallenge(null);
      fetchChallenges();
    } catch (err: any) {
      alert('Error saving challenge: ' + err.message);
    }
  };

  const handleExportExcel = () => {
    if (!currentChallenge || registrations.length === 0) return;

    const exportData = [
      ["CHALLENGE REGISTRATION REPORT"],
      ["Challenge Title:", currentChallenge.title],
      ["Date:", new Date(currentChallenge.date).toLocaleDateString()],
      ["Generated On:", new Date().toLocaleString()],
      [], // spacer
    ];

    const customFields = currentChallenge.custom_form || [];
    const headers = ["#", "Full Name", "Branch", ...customFields.map((f: any) => f.label), "Status", "Date"];
    exportData.push(headers);

    registrations.forEach((reg, index) => {
      const row = [
        index + 1,
        reg.profiles?.full_name || 'N/A',
        reg.profiles?.branch || 'N/A',
        ...customFields.map((f: any) => formatResponseValue(reg.form_responses?.[f.id])),
        reg.status,
        new Date(reg.created_at).toLocaleDateString()
      ];
      exportData.push(row);
    });

    const worksheet = XLSX.utils.aoa_to_sheet(exportData);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Participants");
    XLSX.writeFile(workbook, `Challenge_${currentChallenge.title.replace(/\s+/g, '_')}.xlsx`);
  };

  const handleExportPDF = () => {
    if (!currentChallenge || registrations.length === 0) return;

    const doc = new jsPDF() as any;
    const pageWidth = doc.internal.pageSize.getWidth();

    doc.setFontSize(22);
    doc.setTextColor(33, 43, 54);
    doc.text("Challenge Registration Report", pageWidth / 2, 20, { align: 'center' });
    
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text(`Challenge: ${currentChallenge.title}`, 14, 30);
    doc.text(`Date: ${new Date(currentChallenge.date).toLocaleDateString()}`, 14, 35);
    doc.text(`Generated On: ${new Date().toLocaleString()}`, 14, 40);

    const customFields = currentChallenge.custom_form || [];
    const headers = [["#", "Full Name", "Branch", ...customFields.map((f: any) => f.label), "Status"]];
    const data = registrations.map((reg, index) => [
      index + 1,
      reg.profiles?.full_name || 'N/A',
      reg.profiles?.branch || 'N/A',
      ...customFields.map((f: any) => formatResponseValue(reg.form_responses?.[f.id])),
      reg.status
    ]);

    autoTable(doc, {
      startY: 50,
      head: headers,
      body: data,
      theme: 'grid',
      headStyles: { fillColor: [79, 70, 229] },
      styles: { fontSize: 8, cellPadding: 3 },
      alternateRowStyles: { fillColor: [249, 250, 251] }
    });

    doc.save(`Challenge_${currentChallenge.title.replace(/\s+/g, '_')}.pdf`);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure?')) return;
    try {
      const { error } = await supabase
        .from('ts_v2025_events')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      fetchChallenges();
    } catch (err: any) {
      alert('Error deleting challenge: ' + err.message);
    }
  };

  const updateRegistration = async (id: string, patch: any) => {
    try {
      const { data, error } = await supabase
        .from('ts_v2025_registrations')
        .update({ ...patch })
        .eq('id', id)
        .select()
        .maybeSingle();
      if (error) throw error;
      if (data) {
        setRegistrations(prev => prev.map(r => r.id === id ? { ...r, ...data } : r));
      }
    } catch (err: any) {
      alert('Failed to update registration: ' + err.message);
    }
  };

  const handleDeleteRegistration = async (id: string) => {
    if (!confirm('Delete this registration?')) return;
    try {
      const { error } = await supabase
        .from('ts_v2025_registrations')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setRegistrations(prev => prev.filter(r => r.id !== id));
      setSelectedRegs(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    } catch (err: any) {
      alert('Failed to delete registration: ' + err.message);
    }
  };

  const formatResponseValue = (value: any) => {
    if (Array.isArray(value)) return value.join(', ');
    if (value === null || value === undefined || value === '') return '—';
    return String(value);
  };

  const toggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedRegs(new Set(registrations.map(r => r.id)));
    } else {
      setSelectedRegs(new Set());
    }
  };

  const toggleSelectOne = (id: string) => {
    setSelectedRegs(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleBulkDeleteRegistrations = async () => {
    const ids = Array.from(selectedRegs);
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length} selected registrations?`)) return;
    try {
      const { error } = await supabase
        .from('ts_v2025_registrations')
        .delete()
        .in('id', ids);
      if (error) throw error;
      setRegistrations(prev => prev.filter(r => !selectedRegs.has(r.id)));
      setSelectedRegs(new Set());
    } catch (err: any) {
      alert('Failed to delete: ' + err.message);
    }
  };

  const handleBulkAddXp = async () => {
    const ids = Array.from(selectedRegs);
    if (ids.length === 0) return;
    const raw = prompt('Add XP points to selected users (number):', '10');
    if (!raw) return;
    const delta = Number(raw);
    if (!Number.isFinite(delta)) {
      alert('Please enter a valid number.');
      return;
    }
    const selectedUsers = registrations.filter(r => selectedRegs.has(r.id) && r.user_id);
    const uniqueUserIds = Array.from(new Set(selectedUsers.map(r => r.user_id)));
    try {
      await Promise.all(uniqueUserIds.map(async (userId) => {
        const reg = selectedUsers.find(r => r.user_id === userId);
        const currentPoints = Number(reg?.profiles?.points || 0);
        const nextPoints = currentPoints + delta;
        const { error } = await supabase
          .from('ts_v2025_profiles')
          .update({ points: nextPoints })
          .eq('id', userId);
        if (error) throw error;
      }));
      setRegistrations(prev => prev.map(r => {
        if (!uniqueUserIds.includes(r.user_id)) return r;
        return { ...r, profiles: { ...r.profiles, points: Number(r.profiles?.points || 0) + delta } };
      }));
      setSelectedRegs(new Set());
    } catch (err: any) {
      alert('Failed to update XP: ' + err.message);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-[#212B36] tracking-tight mb-1">Challenge Maintenance</h1>
          <p className="text-gray-500 text-sm font-medium">Create and manage technical tasks.</p>
        </div>
        <button 
          onClick={() => { setCurrentChallenge(null); setIsModalOpen(true); }}
          className="flex items-center gap-2 px-6 py-2.5 bg-indigo-600 text-white rounded-lg font-bold hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 text-sm uppercase tracking-wider"
        >
          <Icon icon="solar:add-circle-bold" fontSize={20} /> New Challenge
        </button>
      </header>

      <div className="grid grid-cols-1 gap-4">
        {loading ? (
          [1, 2, 3].map(i => <Skeleton key={i} className="h-32 w-full rounded-xl" />)
        ) : challenges.map((c: any) => (
          <div key={c.id} className="bg-white p-5 rounded-xl border border-gray-100 shadow-sm flex flex-col lg:flex-row gap-6 items-center group hover:shadow-md transition-all">
            <div className="w-full lg:w-40 h-28 bg-indigo-50 rounded-lg flex items-center justify-center shrink-0">
              <Icon icon="solar:cup-bold" className="text-indigo-600" fontSize={48} />
            </div>
            <div className="flex-1 space-y-1.5 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[#212B36] truncate">{c.title}</h3>
                <span className={`px-2 py-0.5 rounded text-[9px] font-bold uppercase ${(c.pass_settings?.is_open ?? c.is_open) !== false ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                  {(c.pass_settings?.is_open ?? c.is_open) !== false ? 'Open' : 'Closed'}
                </span>
              </div>
              <p className="text-gray-400 text-xs line-clamp-1">{c.description}</p>
              <div className="flex flex-wrap gap-4 text-[11px] text-gray-400 font-bold uppercase tracking-wider">
                <span className="flex items-center gap-1.5"><Icon icon="solar:calendar-bold" /> {new Date(c.date).toLocaleDateString()}</span>
                <span className="flex items-center gap-1.5 font-black text-indigo-500"><Icon icon="solar:star-bold" /> 500 XP</span>
              </div>
            </div>
            <div className="relative">
              <button
                onClick={() => setChallengeMenuOpenId(challengeMenuOpenId === c.id ? null : c.id)}
                className="p-2.5 bg-gray-50 text-gray-600 rounded-lg hover:bg-gray-100 transition-all"
              >
                <Icon icon="solar:menu-dots-bold" fontSize={20} />
              </button>
              {challengeMenuOpenId === c.id && (
                <div className="absolute right-0 mt-2 w-44 bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden z-10">
                  <button
                    onClick={() => { setCurrentChallenge(c); fetchRegistrations(c.id); setChallengeMenuOpenId(null); }}
                    className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <Icon icon="solar:chart-2-bold" /> Track
                  </button>
                  <button
                    onClick={() => { setCurrentChallenge(c); setIsModalOpen(true); setChallengeMenuOpenId(null); }}
                    className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                  >
                    <Icon icon="solar:pen-new-square-bold" /> Edit
                  </button>
                  <button
                    onClick={() => { handleDelete(c.id); setChallengeMenuOpenId(null); }}
                    className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-red-600 hover:bg-red-50 flex items-center gap-2"
                  >
                    <Icon icon="solar:trash-bin-trash-bold" /> Delete
                  </button>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 bg-[#212B36]/60 backdrop-blur-sm z-[100] overflow-y-auto p-4 flex justify-center">
          <div className="bg-white w-full max-w-5xl rounded-xl shadow-2xl h-fit my-auto relative overflow-hidden">
            <form onSubmit={handleSubmit} className="p-6 sm:p-10 space-y-8">
              <div className="flex items-center justify-between sticky top-0 bg-white z-10 pb-4 border-b border-gray-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-indigo-50 rounded-lg flex items-center justify-center text-indigo-600">
                    <Icon icon="solar:cup-bold" fontSize={24} />
                  </div>
                  <h2 className="text-xl font-bold">{currentChallenge ? 'Edit Challenge' : 'New Challenge'}</h2>
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200">
                    <span className="text-[10px] font-bold text-gray-500 uppercase">Registration</span>
                    <button type="button" onClick={() => setIsOpen(!isOpen)} className={`w-10 h-5 rounded-full relative transition-colors ${isOpen ? 'bg-green-500' : 'bg-gray-300'}`}>
                      <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-transform ${isOpen ? 'left-6' : 'left-1'}`} />
                    </button>
                  </div>
                  <button type="button" onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><Icon icon="solar:close-circle-bold" fontSize={24} className="text-gray-400" /></button>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                <div className="space-y-8">
                  <section className="space-y-4">
                    <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Core Information</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Title</label>
                        <input name="title" required className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium" value={formValues.title} onChange={e => setFormValues({...formValues, title: e.target.value})} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Deadline</label>
                        <input name="date" type="date" required className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium" defaultValue={currentChallenge?.date ? new Date(currentChallenge.date).toISOString().split('T')[0] : ''} />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Points (XP)</label>
                        <input name="capacity" type="number" defaultValue={currentChallenge?.capacity || 500} className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium" />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Difficulty</label>
                        <select name="location" className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium" defaultValue={currentChallenge?.location || 'Easy'}>
                          <option>Beginner</option>
                          <option>Intermediate</option>
                          <option>Advanced</option>
                        </select>
                      </div>
                      <div className="md:col-span-2 space-y-1.5">
                        <label className="text-[11px] font-bold text-gray-500 uppercase tracking-wider">Description & Tasks</label>
                        <textarea name="description" rows={5} required className="w-full px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium" defaultValue={currentChallenge?.description} />
                      </div>
                    </div>
                  </section>

                  {isOpen && (
                    <section className="space-y-4 pt-4">
                      <div className="flex items-center justify-between">
                        <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Entry Form Fields</h3>
                        <button type="button" onClick={addFormField} className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100 transition-all"><Icon icon="solar:add-square-bold" fontSize={18} /></button>
                      </div>
                      <div className="space-y-3">
                        {customForm.map((field) => (
                          <div key={field.id} className="p-4 bg-white rounded-xl border border-gray-100 shadow-sm space-y-4 hover:border-indigo-100 transition-all">
                            <div className="flex flex-col md:flex-row items-center gap-3">
                              <input 
                                className="flex-1 w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold" 
                                value={field.label} 
                                onChange={e => updateFormField(field.id, 'label', e.target.value)} 
                                placeholder="GitHub Profile, Lab ID, etc." 
                              />
                              <select 
                                className="w-full md:w-32 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold" 
                                value={field.type} 
                                onChange={e => updateFormField(field.id, 'type', e.target.value)}
                              >
                                <option value="text">Text</option>
                                <option value="number">Number</option>
                                <option value="textarea">Long Text</option>
                                <option value="select">Dropdown</option>
                                <option value="radio">Radio</option>
                                <option value="checkbox">Checkboxes</option>
                              </select>
                              <button type="button" onClick={() => removeFormField(field.id)} className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-all"><Icon icon="solar:trash-bin-minimalistic-bold" fontSize={18} /></button>
                            </div>
                          </div>
                        ))}
                      </div>
                    </section>
                  )}
                </div>

                <div className="space-y-8">
                  <section className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h3 className="text-[11px] font-bold text-gray-400 uppercase tracking-widest">Challenge Pass Settings</h3>
                      <div className="flex items-center gap-2 bg-gray-50 px-3 py-1.5 rounded-lg border border-gray-200 scale-90 text-[10px] font-bold uppercase">
                        <span>Enable Passes</span>
                        <button type="button" onClick={() => setHasPasses(!hasPasses)} className={`w-8 h-4 rounded-full relative transition-colors ${hasPasses ? 'bg-indigo-500' : 'bg-gray-300'}`}>
                          <div className={`absolute top-0.5 w-3 h-3 bg-white rounded-full transition-transform ${hasPasses ? 'left-4.5' : 'left-0.5'}`} />
                        </button>
                      </div>
                    </div>
                    {hasPasses ? (
                      <div className="bg-gray-50 p-6 rounded-xl border border-gray-200 space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-500 uppercase">QR Scale ({passSettings.qr_size}%)</label><input type="range" min="10" max="50" value={passSettings.qr_size} onChange={e => setPassSettings({...passSettings, qr_size: parseInt(e.target.value)})} className="w-full accent-indigo-600" /></div>
                          <div className="space-y-1.5"><label className="text-[10px] font-bold text-gray-500 uppercase">QR X ({passSettings.qr_x}%)</label><input type="range" min="0" max="100" value={passSettings.qr_x} onChange={e => setPassSettings({...passSettings, qr_x: parseInt(e.target.value)})} className="w-full accent-indigo-600" /></div>
                          <div className="space-y-1.5 text-center col-span-2">
                             <div className="relative w-full aspect-[3/4] max-w-[200px] mx-auto bg-[#161C24] rounded-xl overflow-hidden shadow-2xl border border-gray-800">
                               <div className="absolute inset-0 flex flex-col items-center justify-between p-5 text-white z-10">
                                 <div><p className="text-[6px] font-bold text-indigo-400 uppercase tracking-widest">Official Entry</p><p className="text-[9px] font-bold truncate">{formValues.title || 'Challenge'}</p></div>
                               </div>
                               <div className="absolute bg-white p-1 rounded shadow-2xl overflow-hidden" 
                                    style={{ 
                                      width: `${passSettings.qr_size}%`, 
                                      aspectRatio: '1/1', 
                                      left: `${passSettings.qr_x}%`, 
                                      top: `${passSettings.qr_y}%`, 
                                      transform: 'translate(-50%, -50%)' 
                                    }}>
                                 <QRCodeSVG value="preview" size={256} className="w-full h-full" />
                               </div>
                             </div>
                          </div>
                          {(field.type === 'select' || field.type === 'radio' || field.type === 'checkbox') && (
                            <div className="space-y-1">
                              <label className="text-[9px] font-bold text-gray-400 uppercase">Options (comma separated)</label>
                              <input
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs font-bold"
                                value={field.options || ''}
                                onChange={e => updateFormField(field.id, 'options', e.target.value)}
                                placeholder="Option A, Option B"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="bg-gray-50/50 p-12 rounded-xl border border-dashed border-gray-200 text-center">
                        <Icon icon="solar:ticket-bold" fontSize={48} className="text-gray-300 mb-2" />
                        <p className="text-[10px] font-bold text-gray-400 uppercase">Passes Disabled</p>
                      </div>
                    )}
                  </section>
                </div>
              </div>

              <div className="pt-6 border-t border-gray-100">
                <button type="submit" className="w-full py-4 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all uppercase tracking-widest shadow-xl shadow-indigo-100">
                  {currentChallenge ? 'Update Challenge' : 'Create Challenge'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {showTracking && currentChallenge && (
        <div ref={trackingRef} className="bg-white p-8 rounded-2xl border border-gray-100 shadow-xl space-y-8 animate-in slide-in-from-bottom-4 duration-500 overflow-hidden relative">
          <div className="absolute top-0 left-0 w-full h-1 bg-indigo-500" />
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Icon icon="solar:users-group-rounded-bold" fontSize={28} className="text-indigo-600" />
              <div><h2 className="text-xl font-bold">{currentChallenge.title}</h2><p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Entry Tracking</p></div>
            </div>
            <div className="flex items-center gap-2">
              <div className="hidden md:flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-lg px-3 py-1.5">
                <Icon icon="solar:link-minimalistic-bold" className="text-gray-400" fontSize={14} />
                <input
                  readOnly
                  value={shareLink?.is_active ? `${window.location.origin}/share/${shareLink.token}` : ''}
                  placeholder="Share link not created"
                  className="bg-transparent text-[10px] font-bold text-gray-500 outline-none w-52"
                />
                <button
                  onClick={() => copyShareUrl(shareLink?.token)}
                  className="text-[10px] font-bold uppercase text-indigo-600"
                  disabled={!shareLink?.is_active}
                >
                  Copy
                </button>
              </div>
              <div className="relative">
                <button
                  onClick={() => setTrackingMenuOpen(!trackingMenuOpen)}
                  className="px-3 py-1.5 bg-gray-50 text-gray-600 rounded-lg font-bold text-[10px] uppercase tracking-widest border border-gray-100 hover:bg-gray-100 transition-all flex items-center gap-1.5"
                >
                  <Icon icon="solar:settings-bold" /> Actions
                </button>
                {trackingMenuOpen && (
                  <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden z-10">
                    {!shareLink?.is_active ? (
                      <button
                        onClick={() => { updateShareLink(currentChallenge.id, 'create'); setTrackingMenuOpen(false); }}
                        disabled={shareLoading}
                        className="w-full px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                      >
                        <Icon icon="solar:link-bold" /> {shareLoading ? 'Working...' : 'Create Share Link'}
                      </button>
                    ) : (
                      <>
                        <button
                          onClick={() => { copyShareUrl(shareLink?.token); setTrackingMenuOpen(false); }}
                          className="w-full px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                        >
                          <Icon icon="solar:copy-bold" /> Copy Share Link
                        </button>
                        <button
                          onClick={() => { updateShareLink(currentChallenge.id, 'rotate'); setTrackingMenuOpen(false); }}
                          disabled={shareLoading}
                          className="w-full px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                        >
                          <Icon icon="solar:refresh-bold" /> {shareLoading ? 'Working...' : 'Regenerate Link'}
                        </button>
                        <button
                          onClick={() => { updateShareLink(currentChallenge.id, 'revoke'); setTrackingMenuOpen(false); }}
                          disabled={shareLoading}
                          className="w-full px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Icon icon="solar:close-circle-bold" /> Revoke Link
                        </button>
                      </>
                    )}
                    <button
                      onClick={() => { handleExportPDF(); setTrackingMenuOpen(false); }}
                      className="w-full px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-red-600 hover:bg-red-50 flex items-center gap-2"
                    >
                      <Icon icon="solar:file-download-bold" /> Export PDF
                    </button>
                    <button
                      onClick={() => { handleExportExcel(); setTrackingMenuOpen(false); }}
                      className="w-full px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-green-600 hover:bg-green-50 flex items-center gap-2"
                    >
                      <Icon icon="solar:file-excel-bold" /> Export Excel
                    </button>
                    <button
                      onClick={() => { setShowTracking(false); setTrackingMenuOpen(false); }}
                      className="w-full px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                    >
                      <Icon icon="solar:close-circle-bold" /> Dismiss
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
          
          {isTracking ? (
            <div className="py-20 flex justify-center"><Icon icon="eos-icons:loading" fontSize={48} className="text-indigo-600" /></div>
          ) : registrations.length > 0 ? (
            <div className="space-y-3">
              {selectedRegs.size > 0 && (
                <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-50/60 border border-indigo-100 rounded-xl px-4 py-3">
                  <div className="text-xs font-bold uppercase tracking-widest text-indigo-700">
                    {selectedRegs.size} Selected
                  </div>
                  <div className="relative">
                    <button
                      onClick={() => setBulkMenuOpen(!bulkMenuOpen)}
                      className="px-3 py-2 bg-white border border-indigo-100 text-indigo-700 rounded-lg text-[11px] font-bold uppercase tracking-widest flex items-center gap-2"
                    >
                      <Icon icon="solar:sort-by-alphabet-bold" /> Bulk Actions
                    </button>
                    {bulkMenuOpen && (
                      <div className="absolute right-0 mt-2 w-52 bg-white border border-gray-100 rounded-xl shadow-xl overflow-hidden z-10">
                        <button
                          onClick={() => { handleBulkAddXp(); setBulkMenuOpen(false); }}
                          className="w-full px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
                        >
                          <Icon icon="solar:star-bold" /> Add XP Points
                        </button>
                        <button
                          onClick={() => { handleBulkDeleteRegistrations(); setBulkMenuOpen(false); }}
                          className="w-full px-4 py-2.5 text-left text-[10px] font-bold uppercase tracking-widest text-red-600 hover:bg-red-50 flex items-center gap-2"
                        >
                          <Icon icon="solar:trash-bin-trash-bold" /> Delete Selected
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              )}
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="text-left border-b border-gray-100">
                      <th className="py-4 px-4 font-bold text-[10px] uppercase text-gray-400">
                        <input
                          type="checkbox"
                          className="h-4 w-4 accent-indigo-600"
                          checked={selectedRegs.size > 0 && selectedRegs.size === registrations.length}
                          onChange={(e) => toggleSelectAll(e.target.checked)}
                        />
                      </th>
                      <th className="py-4 px-6 font-bold text-[10px] uppercase text-gray-400">Student</th>
                      <th className="py-4 px-6 font-bold text-[10px] uppercase text-gray-400">Submission</th>
                      <th className="py-4 px-6 font-bold text-[10px] uppercase text-gray-400">Attendance</th>
                      <th className="py-4 px-6 font-bold text-[10px] uppercase text-gray-400">Status</th>
                      <th className="py-4 px-6 font-bold text-[10px] uppercase text-gray-400 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {registrations.map((reg) => (
                      <tr key={reg.id} className="border-b border-gray-50 hover:bg-gray-50/50">
                        <td className="py-4 px-4">
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-indigo-600"
                            checked={selectedRegs.has(reg.id)}
                            onChange={() => toggleSelectOne(reg.id)}
                          />
                        </td>
                        <td className="py-4 px-6">
                          <div className="font-bold text-sm text-[#212B36] truncate max-w-[180px]">{reg.profiles?.full_name || 'N/A'}</div>
                          <div className="text-[10px] font-semibold text-gray-400 truncate max-w-[180px]">{reg.profiles?.email || 'No email'}</div>
                        </td>
                        <td className="py-4 px-6">
                          {Object.entries(reg.form_responses || {}).length > 0 ? (
                            <div className="space-y-2">
                              <div className="space-y-1">
                                {Object.entries(reg.form_responses || {}).slice(0, 2).map(([k, v]: [string, any]) => (
                                  <div key={k} className="text-[11px]">
                                    <span className="font-bold text-gray-400 uppercase tracking-tighter mr-2">{currentChallenge.custom_form?.find((f: any) => f.id === k)?.label}:</span>
                                    {formatResponseValue(v)}
                                  </div>
                                ))}
                              </div>
                              {Object.entries(reg.form_responses || {}).length > 2 && (
                                <details className="text-[10px] text-gray-500">
                                  <summary className="cursor-pointer font-bold uppercase tracking-widest text-gray-400">More details</summary>
                                  <div className="mt-2 space-y-1">
                                    {Object.entries(reg.form_responses || {}).map(([k, v]: [string, any]) => (
                                      <div key={k} className="text-[11px]">
                                        <span className="font-bold text-gray-400 uppercase tracking-tighter mr-2">{currentChallenge.custom_form?.find((f: any) => f.id === k)?.label}:</span>
                                        {formatResponseValue(v)}
                                      </div>
                                    ))}
                                  </div>
                                </details>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-gray-400 font-medium">No extra details</span>
                          )}
                        </td>
                        <td className="py-4 px-6">
                          <label className="flex items-center gap-2 text-xs font-semibold text-gray-600">
                            <input
                              type="checkbox"
                              checked={Boolean(reg.attended)}
                              onChange={(e) => {
                                const attended = e.target.checked;
                                updateRegistration(reg.id, {
                                  attended,
                                  attended_at: attended ? new Date().toISOString() : null,
                                  status: attended ? 'attended' : (reg.status === 'attended' ? 'registered' : reg.status)
                                });
                              }}
                              className="h-4 w-4 accent-indigo-600"
                            />
                            {reg.attended ? 'Present' : 'Absent'}
                          </label>
                        </td>
                        <td className="py-4 px-6">
                          <select
                            className="w-32 px-2 py-1 bg-gray-50 border border-gray-200 rounded-md text-[10px] font-bold uppercase tracking-wider text-gray-600"
                            value={reg.status || 'registered'}
                            onChange={(e) => {
                              const nextStatus = e.target.value;
                              updateRegistration(reg.id, {
                                status: nextStatus,
                                attended: nextStatus === 'attended' ? true : reg.attended,
                                attended_at: nextStatus === 'attended' ? (reg.attended_at || new Date().toISOString()) : reg.attended_at
                              });
                            }}
                          >
                            <option value="registered">Registered</option>
                            <option value="attended">Attended</option>
                            <option value="cancelled">Cancelled</option>
                          </select>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <button
                            onClick={() => handleDeleteRegistration(reg.id)}
                            className="px-3 py-1.5 bg-red-50 text-red-600 rounded-lg font-bold text-[10px] uppercase tracking-widest border border-red-100 hover:bg-red-600 hover:text-white transition-all"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            <div className="py-20 text-center text-gray-400 font-bold uppercase text-[10px] tracking-widest animate-pulse">No submissions tracked yet</div>
          )}
        </div>
      )}
    </div>
  );
};

export default AdminChallenges;
