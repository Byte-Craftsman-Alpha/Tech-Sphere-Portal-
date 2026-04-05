import { useEffect, useState, useRef } from 'react';
import { Icon } from '@iconify/react';
import { QRCodeSVG } from 'qrcode.react';
import { toPng } from 'html-to-image';
import { useCache } from '../context/CacheContext';
import supabase from '../lib/supabase';
import { EmptyState } from '../components/EmptyState';

const Events = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [registrations, setRegistrations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEvent, setSelectedEvent] = useState<any>(null);
  const passRef = useRef<HTMLDivElement>(null);
  const { getCache, setCache } = useCache();
  const [showForm, setShowForm] = useState<any>(null);
  const [formResponses, setFormResponses] = useState<any>({});
  const [formErrors, setFormErrors] = useState<any>({});

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const cachedData = getCache('events');
      if (cachedData) {
        setEvents(cachedData);
        setLoading(false);
      }
      const { data: eventsData, error: eventsError } = await supabase
        .from('ts_v2025_events')
        .select('*')
        .order('date', { ascending: true });
      if (eventsError) throw eventsError;
      const filteredEvents = (eventsData || []).filter(e => (e.pass_settings?.type ?? e.type) !== 'challenge');
      setCache('events', filteredEvents);
      setEvents(filteredEvents);
      let registrationsData = [];
      if (session?.user) {
        const { data: regsData, error: regsError } = await supabase
          .from('ts_v2025_registrations')
          .select('*')
          .eq('user_id', session.user.id);
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

  const validateForm = (event: any) => {
    const errors: any = {};
    event.custom_form?.forEach((field: any) => {
      const value = formResponses[field.id];
      const isEmpty = Array.isArray(value) ? value.length === 0 : !value;
      if (field.required && isEmpty) errors[field.id] = 'This field is required';
    });
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const handleRegister = async (event: any) => {
    const isClosed = (event.pass_settings?.is_open ?? event.is_open) === false;
    if (isClosed) return;
    if (loading && !showForm) return;
    if (event.custom_form?.length > 0 && !showForm) {
      const existing = getPass(event.id);
      setShowForm(event);
      setFormResponses(existing?.form_responses || {});
      setFormErrors({});
      return;
    }
    if (showForm && !validateForm(showForm)) return;
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return;
    setLoading(true);
    try {
      const existing = getPass(event.id);
      const payload = { 
        user_id: session.user.id, 
        event_id: event.id, 
        status: 'registered', 
        qr_data: `pass_${session.user.id}_${event.id}`, 
        form_responses: formResponses || {}
      };
      let error;
      if (existing) {
        const { error: updateError } = await supabase.from('ts_v2025_registrations').update({ status: 'registered', form_responses: formResponses || {} }).eq('id', existing.id);
        error = updateError;
      } else {
        const { error: insertError } = await supabase.from('ts_v2025_registrations').insert(payload);
        error = insertError;
      }
      if (error) throw error;
      setShowForm(null);
      await fetchData();
    } catch (err: any) {
      console.error('Registration error:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUnregister = async (regId: string, event?: any) => {
    if (loading) return;
    if (event && (event.pass_settings?.is_open ?? event.is_open) === false) return;
    if (!confirm('Are you sure?')) return;
    setLoading(true);
    try {
      await supabase.from('ts_v2025_registrations').delete().eq('id', regId);
      await fetchData();
    } finally {
      setLoading(false);
    }
  };

  const handleDownloadPNG = async () => {
    if (!passRef.current || !selectedEvent) return;
    try {
      const dataUrl = await toPng(passRef.current, { 
        cacheBust: true, 
        pixelRatio: 2, 
        backgroundColor: '#161C24' 
      });
      const link = document.createElement('a');
      link.download = `Pass_${selectedEvent.title.replace(/\s+/g, '_')}.png`;
      link.href = dataUrl;
      link.click();
    } catch (err) {
      console.error('PNG error:', err);
    }
  };

  const isRegistered = (eventId: string) => registrations.some((r: any) => r.event_id === eventId);
  const getPass = (eventId: string) => registrations.find((r: any) => r.event_id === eventId);
  const isPassEnabled = (event: any) => Boolean(event?.pass_settings?.has_passes ?? event?.has_passes ?? false);

  return (
    <div className="space-y-8 font-sans">
      <header>
        <h1 className="text-3xl font-bold text-[#212B36] tracking-tight mb-1">Events</h1>
        <p className="text-gray-500 text-sm font-medium">Explore and register for upcoming technical events.</p>
      </header>

      <div className={events.length > 0 ? "grid grid-cols-1 md:grid-cols-2 gap-6" : ""}>
        {loading && events.length === 0 ? (
          [1, 2, 3, 4].map(i => <div key={i} className="h-64 bg-white rounded-xl border border-gray-100 animate-pulse" />)
        ) : events.length > 0 ? (
          events.map((event: any) => {
            const registered = isRegistered(event.id);
            const pass = getPass(event.id);
            const isClosed = (event.pass_settings?.is_open ?? event.is_open) === false;
            const passEnabled = isPassEnabled(event);

            return (
              <div key={event.id} className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-hidden flex flex-col group hover:shadow-md transition-all">
                <div className="h-52 relative overflow-hidden">
                  <img src={event.image_url || `https://images.unsplash.com/photo-1540575467063-178a50c2df87`} alt="" className="w-full h-full object-cover" />
                </div>
                <div className="p-6 flex-1 flex flex-col">
                  <h3 className="text-xl font-bold text-[#212B36] mb-3">{event.title}</h3>
                  <p className="text-gray-500 text-xs mb-5 line-clamp-3 leading-relaxed">{event.description}</p>
                  <div className="mt-auto pt-5 border-t border-gray-50 flex items-center justify-between">
                    {registered ? (
                      <div className="flex items-center gap-2 w-full">
                         <div className="flex items-center gap-1.5 text-green-600 font-bold text-[10px] uppercase tracking-wider mr-auto">
                           <Icon icon="solar:check-circle-bold" fontSize={14} /> Joined
                         </div>
                         <div className="flex gap-2">
                           {event.custom_form?.length > 0 && !isClosed && (
                             <button 
                               onClick={() => handleRegister(event)} 
                               className="p-2.5 bg-gray-50 text-gray-400 rounded-lg hover:bg-indigo-50 hover:text-indigo-600 transition-all border border-gray-100"
                               title="Edit Details"
                             >
                               <Icon icon="solar:pen-new-square-bold" fontSize={18} />
                             </button>
                           )}
                           {passEnabled && (
                             <button 
                               onClick={() => setSelectedEvent({ ...event, pass })} 
                               className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg font-bold text-xs hover:bg-indigo-700 transition-all shadow-lg uppercase tracking-wider"
                             >
                               <Icon icon="solar:qr-code-bold" fontSize={16} /> Pass
                             </button>
                           )}
                           {!isClosed && (
                             <button 
                               onClick={() => handleUnregister(pass.id, event)} 
                               className="p-2.5 bg-red-50 text-red-600 rounded-lg hover:bg-red-600 hover:text-white transition-all"
                             >
                               <Icon icon="solar:trash-bin-trash-bold" fontSize={18} />
                             </button>
                           )}
                         </div>
                      </div>
                    ) : (
                      <button onClick={() => handleRegister(event)} className={`w-full py-3 rounded-lg font-bold text-sm ${isClosed ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-[#212B36] text-white hover:bg-[#161C24]'}`} disabled={isClosed}>
                        {isClosed ? 'Registration Closed' : 'Register Now'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <EmptyState 
            icon="solar:calendar-bold"
            title="No Events Hosted Yet"
            description="Our technical calendar is currently being updated. Check back soon for workshops, hackathons, and more!"
          />
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-[#212B36]/60 backdrop-blur-sm z-[110] flex justify-center items-center p-4">
          <div className="bg-white w-full max-w-lg rounded-xl p-8 relative">
            <button onClick={() => setShowForm(null)} className="absolute top-4 right-4 text-gray-400"><Icon icon="solar:close-circle-bold" fontSize={24} /></button>
            <h2 className="text-xl font-bold mb-6">Registration Form</h2>
            <div className="space-y-4">
              {showForm.custom_form.map((field: any) => {
                const value = formResponses[field.id];
                const options = getOptions(field);
                const multiValue = normalizeMulti(value);
                return (
                  <div key={field.id} className="space-y-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea
                        rows={4}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm"
                        value={value || ''}
                        onChange={(e) => setFormResponses({ ...formResponses, [field.id]: e.target.value })}
                      />
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
              <button onClick={() => handleRegister(showForm)} className="w-full py-4 bg-indigo-600 text-white rounded-lg font-bold">Confirm Registration</button>
            </div>
          </div>
        </div>
      )}

      {selectedEvent && isPassEnabled(selectedEvent) && (
        <div className="fixed inset-0 bg-[#212B36]/80 backdrop-blur-md z-[100] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-xl p-8 text-center space-y-6 relative animate-in zoom-in-95 duration-200">
            <button onClick={() => setSelectedEvent(null)} className="absolute top-4 right-4 text-gray-400"><Icon icon="solar:close-circle-bold" fontSize={24} /></button>
            <span className="font-bold text-sm text-indigo-600 uppercase tracking-widest">TechSphere Pass</span>
            <div ref={passRef} className="relative aspect-[3/4] w-full bg-[#161C24] rounded-2xl overflow-hidden shadow-2xl border border-gray-800">
              {selectedEvent.pass_settings?.bg_image && (
                <img src={selectedEvent.pass_settings.bg_image} className="absolute inset-0 w-full h-full object-cover opacity-60" crossOrigin="anonymous" />
              )}
              <div className="relative z-10 w-full h-full flex flex-col items-center justify-between p-8 text-white">
                <div className="text-center">
                  <p className="text-[8px] font-bold text-indigo-400 uppercase tracking-[0.3em] mb-1">Official Entry Pass</p>
                  <h2 className="text-lg font-bold leading-tight">{selectedEvent.title}</h2>
                </div>
                <div className="absolute bg-white p-1 rounded-sm overflow-hidden" 
                  style={{ 
                    width: `${selectedEvent.pass_settings?.qr_size || 25}%`, 
                    aspectRatio: '1/1',
                    left: `${selectedEvent.pass_settings?.qr_x || 50}%`,
                    top: `${selectedEvent.pass_settings?.qr_y || 50}%`,
                    transform: 'translate(-50%, -50%)'
                  }}>
                  <QRCodeSVG value={selectedEvent.pass?.qr_data || 'techsphere'} size={256} className="w-full h-full" />
                </div>
                <div className="w-full border-t border-white/10 pt-4 text-left">
                  <p className="text-[7px] font-bold text-gray-400 uppercase tracking-widest">Technosphere Member</p>
                  <p className="text-[9px] font-mono opacity-60">ID: #{String(selectedEvent.pass?.id || '').slice(0, 8).toUpperCase()}</p>
                </div>
              </div>
            </div>
            <button onClick={handleDownloadPNG} className="w-full py-3.5 bg-indigo-600 text-white rounded-lg font-bold text-sm flex items-center justify-center gap-2">
              <Icon icon="solar:download-bold" /> Download Pass
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Events;
