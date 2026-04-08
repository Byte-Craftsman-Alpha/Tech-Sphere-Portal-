import { useEffect, useRef, useState } from 'react';
import type { FormEvent } from 'react';
import { Icon } from '@iconify/react';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';
import supabase from '../../lib/supabase';
import { Skeleton } from '../../components/Skeleton';

const defaultForm = {
  holder_name: '',
  event_name: '',
  certificate_type: 'Participation',
  credential: '',
  holder_email: '',
  event_id: ''
};

const AdminCertificates = () => {
  const [form, setForm] = useState({ ...defaultForm });
  const [items, setItems] = useState<any[]>([]);
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [importMessage, setImportMessage] = useState<string | null>(null);
  const [editing, setEditing] = useState<any | null>(null);
  const [editForm, setEditForm] = useState({ ...defaultForm });
  const [editSaving, setEditSaving] = useState(false);
  const [qrItem, setQrItem] = useState<any | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchCertificates();
    fetchEvents();
  }, []);

  const fetchCertificates = async () => {
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { setLoading(false); return; }
      const res = await fetch('/api/admin-certificates', {
        headers: { 'Authorization': `Bearer ${session.access_token}` }
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load certificates');
      setItems(data.items || []);
    } catch (err: any) {
      console.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('ts_v2025_events')
        .select('id, title, type, pass_settings, date')
        .order('date', { ascending: false });
      if (error) throw error;
      const onlyEvents = (data || []).filter(e => (e.pass_settings?.type ?? e.type) !== 'challenge');
      setEvents(onlyEvents);
    } catch (err: any) {
      console.error('Failed to load events:', err.message);
    }
  };

  const updateForm = (field: string, value: string) => {
    setForm(prev => ({ ...prev, [field]: value }));
  };

  const updateEditForm = (field: string, value: string) => {
    setEditForm(prev => ({ ...prev, [field]: value }));
  };

  const generateCredential = () => {
    const stamp = new Date().getFullYear();
    const random = Math.random().toString(36).slice(2, 8).toUpperCase();
    updateForm('credential', `TS-${stamp}-${random}`);
  };

  const handleEventPick = (eventId: string) => {
    if (!eventId) {
      setForm(prev => ({ ...prev, event_id: '' }));
      return;
    }
    const selected = events.find(e => e.id === eventId);
    if (!selected) return;
    setForm(prev => ({
      ...prev,
      event_id: selected.id,
      event_name: selected.title || prev.event_name
    }));
  };

  const handleEditEventPick = (eventId: string) => {
    if (!eventId) {
      setEditForm(prev => ({ ...prev, event_id: '' }));
      return;
    }
    const selected = events.find(e => e.id === eventId);
    if (!selected) return;
    setEditForm(prev => ({
      ...prev,
      event_id: selected.id,
      event_name: selected.title || prev.event_name
    }));
  };

  const downloadTemplate = () => {
    const rows = [
      ['holder_name', 'event_name', 'certificate_type', 'credential', 'holder_email'],
      ['Jane Doe', 'TechSphere 2026', 'Participation', 'TS-2026-ABC123', 'jane@college.edu']
    ];
    const sheet = XLSX.utils.aoa_to_sheet(rows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, 'Certificates');
    XLSX.writeFile(workbook, 'certificate_import_template.xlsx');
  };

  const normalizeHeader = (value: any) => {
    return String(value || '')
      .trim()
      .toLowerCase()
      .replace(/\s+/g, '_')
      .replace(/[^a-z0-9_]/g, '');
  };

  const handleImportFile = async (file?: File | null) => {
    if (!file) return;
    try {
      setImporting(true);
      setImportMessage(null);
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      if (!sheet) throw new Error('No worksheet found');
      const raw = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' }) as any[][];
      if (!raw.length) throw new Error('Sheet is empty');

      const headers = (raw[0] || []).map(normalizeHeader);
      const rows = raw.slice(1).map((row) => {
        const record: any = {};
        headers.forEach((header, index) => {
          if (!header) return;
          record[header] = String(row[index] ?? '').trim();
        });
        return record;
      });

      const items = rows
        .filter((row) => Object.values(row).some(val => String(val || '').trim()))
        .map((row) => ({
          holder_name: row.holder_name || '',
          event_name: row.event_name || '',
          certificate_type: row.certificate_type || '',
          credential: row.credential || '',
          holder_email: row.holder_email || ''
        }))
        .filter((row) => row.holder_name && row.event_name && row.certificate_type && row.credential);

      if (!items.length) throw new Error('No valid rows found. Please check the template.');

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired');
      const res = await fetch('/api/admin-certificates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ items })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');

      setImportMessage(`Imported ${data.items?.length || items.length} certificates successfully.`);
      await fetchCertificates();
    } catch (err: any) {
      setImportMessage(err.message || 'Import failed');
    } finally {
      setImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setMessage(null);

    if (!form.holder_name || !form.event_name || !form.certificate_type || !form.credential) {
      setMessage('Please fill in all required fields.');
      return;
    }

    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired');

      const res = await fetch('/api/admin-certificates', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to create certificate');

      setMessage('Certificate added successfully.');
      setForm({ ...defaultForm });
      setItems(prev => [data.certificate, ...prev]);
    } catch (err: any) {
      setMessage(err.message || 'Failed to create certificate');
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (cert: any) => {
    setEditing(cert);
    setEditForm({
      holder_name: cert.holder_name || '',
      event_name: cert.event_name || '',
      certificate_type: cert.certificate_type || 'Participation',
      credential: cert.credential || '',
      holder_email: cert.holder_email || '',
      event_id: cert.event_id || ''
    });
  };

  const handleUpdate = async (e: FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    if (!editForm.holder_name || !editForm.event_name || !editForm.certificate_type || !editForm.credential) {
      setMessage('Please fill in all required fields before saving.');
      return;
    }
    try {
      setEditSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired');
      const res = await fetch('/api/admin-certificates', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id: editing.id, updates: editForm })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to update certificate');
      setItems(prev => prev.map(item => item.id === editing.id ? data.certificate : item));
      setEditing(null);
    } catch (err: any) {
      setMessage(err.message || 'Failed to update certificate');
    } finally {
      setEditSaving(false);
    }
  };

  const handleDelete = async (cert: any) => {
    if (!cert?.id) return;
    if (!confirm('Delete this certificate?')) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Session expired');
      const res = await fetch('/api/admin-certificates', {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ id: cert.id })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to delete certificate');
      setItems(prev => prev.filter(item => item.id !== cert.id));
    } catch (err: any) {
      setMessage(err.message || 'Failed to delete certificate');
    }
  };

  const verificationUrl = (credential: string) => {
    return `${window.location.origin}/certificates/verify?credential=${encodeURIComponent(credential)}`;
  };

  return (
    <div className="space-y-8 pb-20">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#212B36] tracking-tight mb-1">Certificate Management</h1>
          <p className="text-gray-500 text-sm font-medium">Create credentials and enable public verification.</p>
        </div>
        <div className="w-12 h-12 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
          <Icon icon="solar:diploma-verified-bold" fontSize={24} />
        </div>
      </header>

      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={downloadTemplate}
          className="px-4 py-2 bg-gray-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest"
        >
          Download Template
        </button>
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={importing}
          className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg text-[10px] font-bold uppercase tracking-widest border border-indigo-100"
        >
          {importing ? 'Importing...' : 'Import Excel'}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls"
          className="hidden"
          onChange={(e) => handleImportFile(e.target.files?.[0])}
        />
        {importMessage && (
          <span className={`text-xs font-semibold ${importMessage.toLowerCase().includes('imported') ? 'text-green-600' : 'text-amber-600'}`}>
            {importMessage}
          </span>
        )}
      </div>

      <form onSubmit={handleSubmit} className="bg-white border border-gray-100 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Icon icon="solar:calendar-add-bold" fontSize={22} />
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Event Creation</p>
            <h2 className="text-xl font-bold text-[#1A2230]">Add Certificate Details</h2>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Certificate Holder Name *</label>
            <input
              value={form.holder_name}
              onChange={(e) => updateForm('holder_name', e.target.value)}
              placeholder="Student full name"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Link Existing Event (optional)</label>
            <select
              value={form.event_id}
              onChange={(e) => handleEventPick(e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="">Select event</option>
              {events.map((event) => (
                <option key={event.id} value={event.id}>
                  {event.title}
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Event Name *</label>
            <input
              value={form.event_name}
              onChange={(e) => updateForm('event_name', e.target.value)}
              placeholder="TechSphere 2026"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Certificate Type *</label>
            <select
              value={form.certificate_type}
              onChange={(e) => updateForm('certificate_type', e.target.value)}
              className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200"
            >
              <option value="Participation">Participation</option>
              <option value="Winner">Winner</option>
              <option value="Runner Up">Runner Up</option>
              <option value="Speaker">Speaker</option>
              <option value="Volunteer">Volunteer</option>
            </select>
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Credential ID *</label>
            <div className="flex gap-2">
              <input
                value={form.credential}
                onChange={(e) => updateForm('credential', e.target.value)}
                placeholder="TS-2026-XXXXXX"
                className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200"
              />
              <button
                type="button"
                onClick={generateCredential}
                className="px-4 py-3 bg-gray-900 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest"
              >
                Generate
              </button>
            </div>
          </div>
          <div className="space-y-2 md:col-span-2">
            <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Certificate Holder Email (optional)</label>
            <input
              value={form.holder_email}
              onChange={(e) => updateForm('holder_email', e.target.value)}
              placeholder="student@college.edu"
              className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200"
            />
            <p className="text-[11px] text-gray-400 font-medium">If this email matches a registered user, the certificate will link to their profile.</p>
          </div>
        </div>

        {message && (
          <div className={`rounded-xl px-4 py-3 text-sm font-semibold ${message.toLowerCase().includes('success') ? 'bg-green-50 text-green-600 border border-green-100' : 'bg-amber-50 text-amber-700 border border-amber-100'}`}>
            {message}
          </div>
        )}

        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-400 font-medium">Public verification is available at /certificates/verify</p>
          <button
            type="submit"
            disabled={saving}
            className="px-6 py-3 bg-indigo-600 text-white rounded-lg font-bold text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 transition-all"
          >
            {saving ? 'Saving...' : 'Add Certificate'}
          </button>
        </div>
      </form>

      <section className="bg-white border border-gray-100 rounded-2xl shadow-xl p-6 sm:p-8 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-[#1A2230]">Recent Certificates</h2>
            <p className="text-xs text-gray-400 font-medium">Latest 50 credentials added by admins.</p>
          </div>
          <button
            onClick={fetchCertificates}
            className="px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-bold uppercase tracking-widest text-gray-600"
          >
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <Skeleton key={i} className="h-16 w-full rounded-xl" />)}
          </div>
        ) : items.length === 0 ? (
          <div className="py-10 text-center text-gray-400 text-sm font-semibold">
            No certificates yet. Add your first credential above.
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {items.map((cert) => (
              <div key={cert.id} className="py-4 flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div>
                  <p className="font-bold text-[#1A2230]">{cert.holder_name}</p>
                  <p className="text-xs text-gray-400 font-semibold">{cert.event_name} - {cert.certificate_type}</p>
                </div>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-[10px] font-bold uppercase tracking-widest">
                    {cert.credential}
                  </span>
                  <span className="text-[10px] text-gray-400 font-semibold">
                    {cert.issued_at ? new Date(cert.issued_at).toLocaleDateString() : '-'}
                  </span>
                  <button
                    onClick={() => setQrItem(cert)}
                    className="px-3 py-1 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-bold uppercase tracking-widest text-gray-600"
                  >
                    QR
                  </button>
                  <button
                    onClick={() => openEdit(cert)}
                    className="px-3 py-1 bg-blue-50 border border-blue-100 rounded-lg text-[10px] font-bold uppercase tracking-widest text-blue-600"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => window.open(`/admin/certificates/print/${cert.id}`, '_blank')}
                    className="px-3 py-1 bg-emerald-50 border border-emerald-100 rounded-lg text-[10px] font-bold uppercase tracking-widest text-emerald-600"
                  >
                    Print
                  </button>
                  <button
                    onClick={() => handleDelete(cert)}
                    className="px-3 py-1 bg-red-50 border border-red-100 rounded-lg text-[10px] font-bold uppercase tracking-widest text-red-600"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {qrItem && (
        <div className="fixed inset-0 bg-[#212B36]/60 backdrop-blur-sm z-[100] p-4 flex items-center justify-center">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl p-6 space-y-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Certificate QR</p>
                <h3 className="text-xl font-bold text-[#1A2230]">{qrItem.holder_name}</h3>
              </div>
              <button
                onClick={() => setQrItem(null)}
                className="p-2 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
              >
                <Icon icon="solar:close-circle-bold" fontSize={18} />
              </button>
            </div>
            <div className="flex flex-col items-center gap-4">
              <div className="p-4 bg-gray-50 border border-gray-100 rounded-2xl">
                <QRCodeSVG value={verificationUrl(qrItem.credential)} size={180} />
              </div>
              <div className="text-center">
                <p className="text-xs font-semibold text-gray-500">{qrItem.event_name} - {qrItem.certificate_type}</p>
                <p className="text-[11px] text-gray-400 font-semibold">Credential: {qrItem.credential}</p>
              </div>
              <div className="w-full flex items-center gap-2 bg-gray-50 border border-gray-100 rounded-xl px-3 py-2">
                <input
                  readOnly
                  value={verificationUrl(qrItem.credential)}
                  className="flex-1 bg-transparent text-[10px] font-semibold text-gray-600 outline-none"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(verificationUrl(qrItem.credential))}
                  className="text-[10px] font-bold uppercase tracking-widest text-indigo-600"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editing && (
        <div className="fixed inset-0 bg-[#212B36]/60 backdrop-blur-sm z-[100] p-4 flex items-center justify-center">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl p-6 sm:p-8">
            <form onSubmit={handleUpdate} className="space-y-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Edit Certificate</p>
                  <h3 className="text-xl font-bold text-[#1A2230]">Update Details</h3>
                </div>
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="p-2 rounded-full border border-gray-200 text-gray-500 hover:bg-gray-50"
                >
                  <Icon icon="solar:close-circle-bold" fontSize={18} />
                </button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Certificate Holder Name *</label>
                  <input
                    value={editForm.holder_name}
                    onChange={(e) => updateEditForm('holder_name', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Link Existing Event (optional)</label>
                  <select
                    value={editForm.event_id}
                    onChange={(e) => handleEditEventPick(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="">Select event</option>
                    {events.map((event) => (
                      <option key={event.id} value={event.id}>
                        {event.title}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Event Name *</label>
                  <input
                    value={editForm.event_name}
                    onChange={(e) => updateEditForm('event_name', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Certificate Type *</label>
                  <select
                    value={editForm.certificate_type}
                    onChange={(e) => updateEditForm('certificate_type', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200"
                  >
                    <option value="Participation">Participation</option>
                    <option value="Winner">Winner</option>
                    <option value="Runner Up">Runner Up</option>
                    <option value="Speaker">Speaker</option>
                    <option value="Volunteer">Volunteer</option>
                  </select>
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Credential ID *</label>
                  <input
                    value={editForm.credential}
                    onChange={(e) => updateEditForm('credential', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Certificate Holder Email (optional)</label>
                  <input
                    value={editForm.holder_email}
                    onChange={(e) => updateEditForm('holder_email', e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 bg-white text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-indigo-200"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-3">
                <button
                  type="button"
                  onClick={() => setEditing(null)}
                  className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-lg text-[10px] font-bold uppercase tracking-widest text-gray-600"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="px-5 py-2 bg-indigo-600 text-white rounded-lg text-[10px] font-bold uppercase tracking-widest shadow-lg shadow-indigo-100"
                >
                  {editSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCertificates;







