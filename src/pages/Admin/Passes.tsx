import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '@iconify/react';
import { QRCodeSVG } from 'qrcode.react';
import supabase from '../../lib/supabase';
import { Skeleton } from '../../components/Skeleton';

const DEFAULT_PASS = {
  qr_size: 25,
  qr_x: 50,
  qr_y: 50,
  qr_unit: 'percent' as 'percent' | 'px',
  bg_image: '',
  has_passes: true,
  is_open: true
};

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

const AdminPasses = () => {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedEventId, setSelectedEventId] = useState('');
  const [currentEvent, setCurrentEvent] = useState<any>(null);
  const [passSettings, setPassSettings] = useState({ ...DEFAULT_PASS });
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('ts_v2025_events')
        .select('id, title, date, pass_settings, is_open, has_passes, image_url, type')
        .order('date', { ascending: false });
      if (error) throw error;
      const onlyEvents = (data || []).filter(e => (e.pass_settings?.type ?? e.type) !== 'challenge');
      setEvents(onlyEvents);
      if (onlyEvents.length > 0 && !selectedEventId) {
        setSelectedEventId(onlyEvents[0].id);
      }
    } catch (err: any) {
      console.error('Failed to load events:', err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedEventId) return;
    const event = events.find(e => e.id === selectedEventId) || null;
    setCurrentEvent(event);
    if (event) {
      const merged = {
        ...DEFAULT_PASS,
        ...event.pass_settings,
        is_open: event.pass_settings?.is_open ?? event.is_open ?? true,
        has_passes: event.pass_settings?.has_passes ?? event.has_passes ?? true
      };
      setPassSettings(merged);
    }
  }, [selectedEventId, events]);

  const updatePositionFromPointer = (clientX: number, clientY: number) => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) return;
    const xRaw = clientX - rect.left;
    const yRaw = clientY - rect.top;

    if (passSettings.qr_unit === 'px') {
      const nextX = clamp(xRaw, 0, rect.width);
      const nextY = clamp(yRaw, 0, rect.height);
      setPassSettings(prev => ({
        ...prev,
        qr_x: Math.round(nextX),
        qr_y: Math.round(nextY)
      }));
      return;
    }

    const percentX = clamp((xRaw / rect.width) * 100, 0, 100);
    const percentY = clamp((yRaw / rect.height) * 100, 0, 100);
    setPassSettings(prev => ({
      ...prev,
      qr_x: Math.round(percentX),
      qr_y: Math.round(percentY)
    }));
  };

  const handleDragStart = (e: React.MouseEvent) => {
    e.preventDefault();
    setDragging(true);
    updatePositionFromPointer(e.clientX, e.clientY);
  };

  useEffect(() => {
    if (!dragging) return;
    const handleMove = (e: MouseEvent) => updatePositionFromPointer(e.clientX, e.clientY);
    const handleUp = () => setDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [dragging, passSettings.qr_unit]);

  const switchUnit = (unit: 'percent' | 'px') => {
    const rect = previewRef.current?.getBoundingClientRect();
    if (!rect) {
      setPassSettings(prev => ({ ...prev, qr_unit: unit }));
      return;
    }

    if (unit === passSettings.qr_unit) return;

    if (unit === 'px') {
      const nextX = Math.round((passSettings.qr_x / 100) * rect.width);
      const nextY = Math.round((passSettings.qr_y / 100) * rect.height);
      setPassSettings(prev => ({ ...prev, qr_unit: unit, qr_x: nextX, qr_y: nextY }));
      return;
    }

    const nextX = Math.round((passSettings.qr_x / rect.width) * 100);
    const nextY = Math.round((passSettings.qr_y / rect.height) * 100);
    setPassSettings(prev => ({ ...prev, qr_unit: unit, qr_x: nextX, qr_y: nextY }));
  };

  const handleSave = async () => {
    if (!currentEvent) return;
    try {
      setSaving(true);
      setMessage(null);
      const payload = {
        ...currentEvent,
        pass_settings: {
          ...passSettings,
          type: 'event',
          has_passes: passSettings.has_passes,
          is_open: passSettings.is_open
        }
      };
      const { error } = await supabase
        .from('ts_v2025_events')
        .update({ pass_settings: payload.pass_settings })
        .eq('id', currentEvent.id);
      if (error) throw error;
      setMessage('Pass settings saved successfully.');
      await fetchEvents();
    } catch (err: any) {
      setMessage(err.message || 'Failed to save pass settings');
    } finally {
      setSaving(false);
    }
  };

  const qrStyle = useMemo(() => {
    if (passSettings.qr_unit === 'px') {
      return {
        width: `${passSettings.qr_size}%`,
        left: `${passSettings.qr_x}px`,
        top: `${passSettings.qr_y}px`,
        transform: 'translate(-50%, -50%)'
      };
    }

    return {
      width: `${passSettings.qr_size}%`,
      left: `${passSettings.qr_x}%`,
      top: `${passSettings.qr_y}%`,
      transform: 'translate(-50%, -50%)'
    };
  }, [passSettings]);

  return (
    <div className="space-y-8 pb-20">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#212B36] tracking-tight mb-1">Pass Studio</h1>
          <p className="text-gray-500 text-sm font-medium">Design and position QR passes with complete freedom.</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <Icon icon="solar:ticket-bold" fontSize={24} />
        </div>
      </header>

      <div className="bg-white border border-gray-100 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Select Event</label>
            {loading ? (
              <Skeleton className="h-10 w-64 rounded-lg" />
            ) : (
              <select
                value={selectedEventId}
                onChange={(e) => setSelectedEventId(e.target.value)}
                className="w-full lg:w-80 px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200"
              >
                {events.map((event) => (
                  <option key={event.id} value={event.id}>
                    {event.title}
                  </option>
                ))}
              </select>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => setPassSettings({ ...DEFAULT_PASS })}
              className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-bold uppercase tracking-widest text-gray-600"
            >
              Reset Defaults
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-indigo-100"
            >
              {saving ? 'Saving...' : 'Save Pass Settings'}
            </button>
          </div>
        </div>

        {message && (
          <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${message.toLowerCase().includes('saved') ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
            {message}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-[1.1fr_0.9fr] gap-8">
          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Passes Enabled</label>
                <button
                  type="button"
                  onClick={() => setPassSettings(prev => ({ ...prev, has_passes: !prev.has_passes }))}
                  className={`w-full px-4 py-3 rounded-lg border font-bold text-xs uppercase tracking-widest ${passSettings.has_passes ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                >
                  {passSettings.has_passes ? 'Enabled' : 'Disabled'}
                </button>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Registration Open</label>
                <button
                  type="button"
                  onClick={() => setPassSettings(prev => ({ ...prev, is_open: !prev.is_open }))}
                  className={`w-full px-4 py-3 rounded-lg border font-bold text-xs uppercase tracking-widest ${passSettings.is_open ? 'bg-emerald-50 border-emerald-100 text-emerald-600' : 'bg-red-50 border-red-100 text-red-600'}`}
                >
                  {passSettings.is_open ? 'Open' : 'Closed'}
                </button>
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Pass Background URL</label>
              <input
                value={passSettings.bg_image}
                onChange={(e) => setPassSettings(prev => ({ ...prev, bg_image: e.target.value }))}
                placeholder="Paste a background image URL"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">QR Size (%)</label>
                <input
                  type="number"
                  min={5}
                  max={80}
                  value={passSettings.qr_size}
                  onChange={(e) => setPassSettings(prev => ({ ...prev, qr_size: Number(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Position Unit</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => switchUnit('percent')}
                    className={`flex-1 px-4 py-3 rounded-lg border text-[10px] font-bold uppercase tracking-widest ${passSettings.qr_unit === 'percent' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                  >
                    Percent
                  </button>
                  <button
                    type="button"
                    onClick={() => switchUnit('px')}
                    className={`flex-1 px-4 py-3 rounded-lg border text-[10px] font-bold uppercase tracking-widest ${passSettings.qr_unit === 'px' ? 'bg-indigo-50 border-indigo-100 text-indigo-600' : 'bg-gray-50 border-gray-200 text-gray-500'}`}
                  >
                    Pixels
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">QR X ({passSettings.qr_unit === 'px' ? 'px' : '%'})</label>
                <input
                  type="number"
                  value={passSettings.qr_x}
                  onChange={(e) => setPassSettings(prev => ({ ...prev, qr_x: Number(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">QR Y ({passSettings.qr_unit === 'px' ? 'px' : '%'})</label>
                <input
                  type="number"
                  value={passSettings.qr_y}
                  onChange={(e) => setPassSettings(prev => ({ ...prev, qr_y: Number(e.target.value) || 0 }))}
                  className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200"
                />
              </div>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-xs text-gray-500 space-y-1">
              <p className="font-bold uppercase tracking-widest text-[10px] text-gray-400">Tips</p>
              <p>Drag the QR block directly inside the preview to reposition it.</p>
              <p>Switch between percent and pixels for precise unit control.</p>
            </div>
          </div>

          <div className="space-y-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400 text-center">Live Pass Preview</p>
            <div
              ref={previewRef}
              className="relative w-full aspect-[3/4] max-w-[320px] mx-auto bg-[#161C24] rounded-2xl overflow-hidden shadow-2xl border border-gray-800"
            >
              {passSettings.bg_image && (
                <img src={passSettings.bg_image} className="absolute inset-0 w-full h-full object-cover" alt="" />
              )}
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 to-black/60" />
              <div className="absolute inset-0 flex flex-col items-center justify-between p-6 text-white z-10 pointer-events-none">
                <div className="text-center">
                  <p className="text-[7px] font-bold text-indigo-300 uppercase tracking-widest">Entry Pass</p>
                  <p className="text-xs font-bold truncate max-w-[180px]">{currentEvent?.title || 'Event Title'}</p>
                </div>
                <div className="w-full border-t border-white/10 pt-3">
                  <p className="text-[7px] font-bold text-gray-300 uppercase">Member</p>
                  <p className="text-[9px] font-bold">Attendee Name</p>
                </div>
              </div>
              <div
                onMouseDown={handleDragStart}
                className={`absolute bg-white p-1 rounded-sm shadow-2xl overflow-hidden ${dragging ? 'ring-2 ring-indigo-500' : ''}`}
                style={qrStyle}
              >
                <QRCodeSVG value="preview" size={256} className="w-full h-full" />
              </div>
            </div>
            <div className="text-center text-[10px] font-semibold text-gray-400">
              {passSettings.qr_unit === 'px'
                ? `QR Position: ${passSettings.qr_x}px, ${passSettings.qr_y}px`
                : `QR Position: ${passSettings.qr_x}%, ${passSettings.qr_y}%`}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminPasses;
