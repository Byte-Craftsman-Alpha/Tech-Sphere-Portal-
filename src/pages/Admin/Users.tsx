import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Icon } from '@iconify/react';
import supabase from '../../lib/supabase';
import { UserSkeleton } from '../../components/Skeleton';
import { EmptyState } from '../../components/EmptyState';
import * as XLSX from 'xlsx';

const AdminUsers = () => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [pointsExists, setPointsExists] = useState(true);
  const [repairLoading, setRepairLoading] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState<string | null>(null);
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createTab, setCreateTab] = useState<'manual' | 'import'>('manual');
  const [createLoading, setCreateLoading] = useState(false);
  const [importLoading, setImportLoading] = useState(false);
  const [importRows, setImportRows] = useState<any[]>([]);
  const [importError, setImportError] = useState<string | null>(null);
  const [actionsMenuUserId, setActionsMenuUserId] = useState<string | null>(null);
  const [actionsMenuPos, setActionsMenuPos] = useState<{ top: number; left: number } | null>(null);
  const actionsMenuRef = useRef<HTMLDivElement>(null);
  const [approvalFilter, setApprovalFilter] = useState<'all' | 'pending' | 'approved'>('all');
  const [sendDetailsLoadingUserId, setSendDetailsLoadingUserId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; title: string; message?: string } | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const [createForm, setCreateForm] = useState<any>({
    email: '',
    password: '',
    full_name: '',
    branch: '',
    semester: '',
    roll_no: '',
    role: 'user',
    points: 0,
    approved: false,
    github_url: '',
    linkedin_url: '',
    instagram: '',
    whatsapp: ''
  });

  useEffect(() => {
    fetchUsers();
  }, []);

  const showToast = (next: { type: 'success' | 'error' | 'info'; title: string; message?: string }, timeoutMs = 4500) => {
    if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
    setToast(next);
    toastTimerRef.current = window.setTimeout(() => setToast(null), timeoutMs);
  };

  useEffect(() => {
    if (!actionsMenuUserId) return;
    const handleClose = () => setActionsMenuUserId(null);
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [actionsMenuUserId]);

  useEffect(() => {
    if (!actionsMenuUserId || !actionsMenuPos) return;
    const el = actionsMenuRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const margin = 12;
    const maxLeft = window.innerWidth - rect.width - margin;
    const maxTop = window.innerHeight - rect.height - margin;
    const nextLeft = Math.min(Math.max(margin, actionsMenuPos.left), maxLeft);
    const nextTop = Math.min(Math.max(margin, actionsMenuPos.top), maxTop);
    if (nextLeft !== actionsMenuPos.left || nextTop !== actionsMenuPos.top) {
      setActionsMenuPos({ top: nextTop, left: nextLeft });
    }
  }, [actionsMenuUserId, actionsMenuPos]);

  const generateTempPassword = () => {
    const upper = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower = 'abcdefghijkmnopqrstuvwxyz';
    const digits = '23456789';
    const symbols = '!@#$%&*?';
    const all = `${upper}${lower}${digits}${symbols}`;
    const length = 12;
    const pick = (set: string) => set[Math.floor(Math.random() * set.length)];
    let pwd = `${pick(upper)}${pick(lower)}${pick(digits)}${pick(symbols)}`;
    for (let i = pwd.length; i < length; i += 1) pwd += pick(all);
    return pwd.split('').sort(() => Math.random() - 0.5).join('');
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      setError(null);
      const { data, error: fetchError } = await supabase
        .from('ts_v2025_profiles')
        .select('*')
        .order('full_name', { ascending: true });

      if (fetchError) throw fetchError;
      
      const userList = data || [];
      if (userList.length > 0 && !('points' in userList[0])) {
        setPointsExists(false);
      } else {
        setPointsExists(true);
      }
      
      setUsers(userList);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const TEMPLATE_COLUMNS = [
    'email',
    'password',
    'full_name',
    'branch',
    'semester',
    'roll_no',
    'role',
    'points',
    'approved',
    'github_url',
    'linkedin_url',
    'instagram',
    'whatsapp'
  ];

  const downloadTemplate = () => {
    const sample = [{
      email: 'student@example.com',
      password: 'TempPass@123',
      full_name: 'Student Name',
      branch: 'Computer Science',
      semester: '5th',
      roll_no: '23CS104',
      role: 'user',
      points: 0,
      approved: false,
      github_url: '',
      linkedin_url: '',
      instagram: '',
      whatsapp: ''
    }];
    const worksheet = XLSX.utils.json_to_sheet(sample, { header: TEMPLATE_COLUMNS });
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Users');
    XLSX.writeFile(workbook, 'TechSphere_User_Import_Template.xlsx');
  };

  const handleImportFile = async (file: File) => {
    try {
      setImportError(null);
      const data = await file.arrayBuffer();
      const workbook = XLSX.read(data, { type: 'array' });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const rows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: '' });
      const normalized = rows
        .map((row) => {
          const mapped: any = {};
          TEMPLATE_COLUMNS.forEach((col) => {
            if (Object.prototype.hasOwnProperty.call(row, col)) mapped[col] = row[col];
          });
          return mapped;
        })
        .filter((row) => String(row.email || '').trim() !== '');

      if (normalized.length === 0) {
        setImportError('No valid rows found. Ensure the template layout is unchanged.');
        setImportRows([]);
        return;
      }
      const required = ['email', 'password', 'full_name', 'branch', 'semester'];
      const missingRequired = required.filter((col) => !TEMPLATE_COLUMNS.includes(col));
      if (missingRequired.length > 0) {
        setImportError('Template is missing required columns.');
        setImportRows([]);
        return;
      }
      setImportRows(normalized);
    } catch (err: any) {
      setImportError(err.message || 'Failed to read file.');
    }
  };

  const handleCreateUser = async () => {
    setCreateLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');
      const payload = { ...createForm };
      if (!pointsExists) delete payload.points;
      const res = await fetch('/api/admin-create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify(payload)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Creation failed');
      const result = data.results?.[0];
      if (result?.status === 'created') {
        alert('User created successfully.');
      } else if (result?.status === 'exists') {
        alert('User already exists.');
      } else {
        alert(result?.error || 'User creation failed.');
      }
      setIsCreateModalOpen(false);
      setCreateForm({
        email: '',
        password: '',
        full_name: '',
        branch: '',
        semester: '',
        roll_no: '',
        role: 'user',
        points: 0,
        approved: false,
        github_url: '',
        linkedin_url: '',
        instagram: '',
        whatsapp: ''
      });
      fetchUsers();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setCreateLoading(false);
    }
  };

  const handleImportUsers = async () => {
    if (importRows.length === 0) {
      setImportError('No rows to import.');
      return;
    }
    setImportLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');
      const payloadRows = pointsExists ? importRows : importRows.map(({ points, ...rest }) => rest);
      const res = await fetch('/api/admin-create-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ users: payloadRows })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Import failed');
      alert(`Import complete. Created: ${data.created || 0}, Exists: ${data.exists || 0}, Errors: ${data.errors || 0}`);
      setIsCreateModalOpen(false);
      setImportRows([]);
      fetchUsers();
    } catch (err: any) {
      setImportError(err.message || 'Import failed');
    } finally {
      setImportLoading(false);
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    const formData = new FormData(e.target as HTMLFormElement);
    const updates = Object.fromEntries(formData.entries());
    
    
    const finalUpdates: any = { ...updates };
    if (finalUpdates.approved !== undefined) {
      finalUpdates.approved = String(finalUpdates.approved).toLowerCase() === 'true';
    }
    if (!pointsExists) {
      delete finalUpdates.points;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');
      const res = await fetch('/api/admin-update-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ user_id: selectedUser.id, updates: finalUpdates })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const filteredUsers = users.filter((u: any) => {
    const matchesSearch =
      u.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email?.toLowerCase().includes(searchTerm.toLowerCase());
    if (!matchesSearch) return false;
    if (approvalFilter === 'pending') return !u.approved;
    if (approvalFilter === 'approved') return Boolean(u.approved);
    return true;
  });

  const handleResetPassword = async () => {
    if (!selectedUser?.id) return;
    const newPass = prompt('Enter new password for ' + selectedUser.full_name);
    if (!newPass) return;
    
    setResetLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin-reset-password', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ user_id: selectedUser.id, new_password: newPass })
      });
      
      // Handle the case where the API is served as a static file (local Vite dev)
      const text = await res.text();
      if (text.startsWith('import')) {
        throw new Error('Local API is not running. Please use "vercel dev" to use password reset, or deploy the app to Vercel.');
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid server response. Please ensure you are running with "vercel dev".');
      }

      if (!res.ok) throw new Error(data.error || 'Server error');
      alert('Password updated successfully.');
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setResetLoading(false);
    }
  };

  const handleRepairOrphans = async () => {
    setRepairLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/repair-orphans', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        }
      });

      const text = await res.text();
      if (text.startsWith('import')) {
        throw new Error('Local API is not running. Please start the API server.');
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid server response.');
      }

      if (!res.ok) throw new Error(data.error || 'Server error');
      alert(`Repaired ${data.repaired || 0} missing profiles.`);
      fetchUsers();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setRepairLoading(false);
    }
  };

  const handleDeleteUser = async (userId: string, userRole?: string) => {
    if (!userId) return;
    if (userRole === 'admin') {
      alert('Admins cannot delete another admin.');
      return;
    }
    const ok = window.confirm('Delete this user permanently? This will remove all their data.');
    if (!ok) return;
    setDeleteLoading(userId);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/delete-user', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ user_id: userId })
      });
      const text = await res.text();
      if (text.startsWith('import')) {
        throw new Error('Local API is not running. Please start the API server.');
      }
      const data = JSON.parse(text);
      if (!res.ok) throw new Error(data.error || 'Server error');
      alert('User deleted successfully.');
      if (selectedUser?.id === userId) setSelectedUser(null);
      fetchUsers();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setDeleteLoading(null);
    }
  };

  const handleSetApproval = async (userId: string, approved: boolean) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('No active session');
      const res = await fetch('/api/admin-approve-user', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ user_id: userId, approved })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Server error');
      fetchUsers();
    } catch (err: any) {
      alert('Failed to update approval: ' + err.message);
    }
  };

  const handleSendUserDetails = async (user: any) => {
    if (!user?.id) return;
    const ok = window.confirm(`Send account details to ${user.full_name || user.email}? This will reset their password.`);
    if (!ok) return;
    const tempPass = generateTempPassword();

    setSendDetailsLoadingUserId(user.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/admin-send-user-details', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({ user_id: user.id, temp_password: tempPass })
      });

      const text = await res.text();
      if (text.startsWith('import')) {
        throw new Error('Local API is not running. Please use "vercel dev" or deploy the app to send emails.');
      }

      let data;
      try {
        data = JSON.parse(text);
      } catch (e) {
        throw new Error('Invalid server response. Please ensure you are running with "vercel dev".');
      }

      if (!res.ok) throw new Error(data.error || 'Server error');

      if (data.sent) {
        showToast({
          type: 'success',
          title: 'Email sent',
          message: `Account details were sent to ${user.email}.`
        });
      } else {
        showToast({
          type: 'error',
          title: 'Email not sent',
          message: data.reason || 'Email could not be sent. Check SMTP settings.'
        });
      }
    } catch (err: any) {
      showToast({
        type: 'error',
        title: 'Send failed',
        message: err.message || 'Unable to send email.'
      });
    } finally {
      setSendDetailsLoadingUserId(null);
    }
  };

  return (
    <div className="space-y-8">
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-[#212B36] tracking-tight mb-1">Manage Users</h1>
          <p className="text-gray-500 text-sm font-medium">View and edit community member profiles.</p>
        </div>
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <button
            onClick={() => { setIsCreateModalOpen(true); setCreateTab('manual'); }}
            className="px-4 py-2.5 bg-indigo-600 text-white rounded-lg font-bold text-[11px] uppercase tracking-wider hover:bg-indigo-700 transition-all flex items-center justify-center gap-2"
          >
            <Icon icon="solar:add-circle-bold" fontSize={18} /> Add Users
          </button>
          <div className="relative flex-1">
            <Icon icon="solar:magnifer-bold" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" fontSize={20} />
            <input type="text" placeholder="Search members..." className="w-full md:w-72 pl-11 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 shadow-sm transition-all text-sm" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>
      </header>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2 py-2">
          <button
            onClick={() => setApprovalFilter('all')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${approvalFilter === 'all' ? 'bg-indigo-600 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            All
          </button>
          <button
            onClick={() => setApprovalFilter('pending')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${approvalFilter === 'pending' ? 'bg-amber-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Pending
          </button>
          <button
            onClick={() => setApprovalFilter('approved')}
            className={`px-3 py-1.5 rounded-md text-[10px] font-bold uppercase tracking-wider ${approvalFilter === 'approved' ? 'bg-emerald-500 text-white' : 'text-gray-500 hover:bg-gray-50'}`}
          >
            Approved
          </button>
        </div>
        <button
          onClick={handleRepairOrphans}
          disabled={repairLoading}
          className="px-4 py-2.5 bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg font-bold text-[11px] uppercase tracking-wider hover:bg-indigo-100 transition-all disabled:opacity-60"
        >
          {repairLoading ? 'Repairing...' : 'Repair Missing Profiles'}
        </button>
        <span className="text-[11px] text-gray-400 font-bold uppercase tracking-wider">
          Fixes auth users without profile rows
        </span>
      </div>

      <div className="bg-white rounded-xl border border-gray-100 shadow-sm overflow-visible">
        {loading ? (
          <div className="divide-y divide-gray-100">
            {[1, 2, 3, 4, 5].map(i => <UserSkeleton key={i} />)}
          </div>
        ) : error ? (
          <div className="p-12 text-center">
            <div className="bg-red-50 text-red-600 p-4 rounded-xl inline-block font-bold text-sm border border-red-100">Error: {error}</div>
            <button onClick={fetchUsers} className="block mx-auto mt-4 text-indigo-600 font-bold hover:underline text-sm uppercase tracking-wider">Try Again</button>
          </div>
        ) : filteredUsers.length === 0 ? (
          <EmptyState 
            icon="solar:users-group-rounded-bold"
            title="No Users Registered"
            description="Your community hasn't populated yet. Users will appear here automatically once they sign up and complete their profiles."
            actionLabel="Setup Guide"
            actionLink="/home"
          />
        ) : (
          <div className="overflow-x-auto overflow-y-visible">
            <table className="w-full">
              <thead>
                <tr className="text-left border-b border-gray-100 bg-gray-50/50">
                  <th className="py-4 px-6 font-bold text-gray-400 uppercase text-[10px] tracking-widest">User</th>
                  <th className="py-4 px-6 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Branch</th>
                  <th className="py-4 px-6 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-center">XP</th>
                  <th className="py-4 px-6 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Status</th>
                  <th className="py-4 px-6 font-bold text-gray-400 uppercase text-[10px] tracking-widest">Role</th>
                  <th className="py-4 px-6 font-bold text-gray-400 uppercase text-[10px] tracking-widest text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredUsers.map((user: any) => (
                  <tr key={user.id} className="group hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-600 font-bold text-sm">
                          {user.full_name ? user.full_name[0] : 'U'}
                        </div>
                        <div>
                          <p className="font-bold text-sm text-[#212B36] truncate max-w-[200px]">{user.full_name || 'Anonymous'}</p>
                          <p className="text-[10px] text-gray-400 font-medium lowercase truncate max-w-[200px]">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <p className="text-xs font-bold text-gray-600 whitespace-nowrap">{user.branch}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase whitespace-nowrap">{user.semester} Sem</p>
                    </td>
                    <td className="py-4 px-6 text-center">
                      <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded-md text-[10px] font-black tracking-wider border border-amber-100 shadow-sm whitespace-nowrap">
                        {user.points || 0} XP
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${user.approved ? 'bg-green-50 text-green-600' : 'bg-amber-50 text-amber-600'}`}>
                        {user.approved ? 'Approved' : 'Pending'}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider whitespace-nowrap ${user.role?.toLowerCase() === 'admin' ? 'bg-indigo-50 text-indigo-600' : 'bg-gray-100 text-gray-500'}`}>
                        {user.role}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right">
                      <div className="relative inline-block text-left">
                        <button
                          onClick={(e) => {
                            if (actionsMenuUserId === user.id) {
                              setActionsMenuUserId(null);
                              return;
                            }
                            const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
                            const menuWidth = 192;
                            setActionsMenuPos({
                              top: rect.bottom + 8,
                              left: Math.max(8, rect.right - menuWidth)
                            });
                            setActionsMenuUserId(user.id);
                          }}
                          className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-indigo-600"
                        >
                          <Icon icon="solar:menu-dots-bold" fontSize={20} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedUser && (
        <div className="fixed inset-0 bg-[#212B36]/60 backdrop-blur-sm z-[100] overflow-y-auto p-4 flex justify-center">
          <div className="bg-white w-full max-w-lg rounded-xl shadow-2xl h-fit my-auto relative overflow-hidden">
            <form onSubmit={handleUpdateUser} className="p-6 sm:p-8 space-y-6">
              <div className="flex items-center justify-between mb-4 sticky top-0 bg-white z-10 pb-2 border-b border-gray-100">
                <h2 className="text-xl font-bold">Edit User</h2>
                <button type="button" onClick={() => setSelectedUser(null)} className="p-2 hover:bg-gray-100 rounded-lg transition-colors"><Icon icon="solar:close-circle-bold" fontSize={24} className="text-gray-400" /></button>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">Full Name</label>
                  <input name="full_name" required className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm" defaultValue={selectedUser.full_name} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">Role</label>
                  <select name="role" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm" defaultValue={selectedUser.role}>
                    <option value="user">User</option>
                    <option value="admin">Admin</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">Approval</label>
                  <select name="approved" className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm" defaultValue={String(Boolean(selectedUser.approved))}>
                    <option value="true">Approved</option>
                    <option value="false">Pending</option>
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">Branch</label>
                  <input name="branch" required className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm" defaultValue={selectedUser.branch} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">Semester</label>
                  <input name="semester" required className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm" defaultValue={selectedUser.semester} />
                </div>
                <div className="space-y-1.5 flex-1 min-w-[200px]">
                  <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">XP Points</label>
                  <div className="relative">
                    <input 
                      name="points" 
                      type="number" 
                      disabled={!pointsExists}
                      title={!pointsExists ? "Database column missing" : ""}
                      required 
                      className={`w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm font-bold text-indigo-600 ${!pointsExists ? 'opacity-50 grayscale' : ''}`} 
                      defaultValue={selectedUser.points || 0} 
                    />
                    {!pointsExists && (
                      <div className="mt-2 p-2 bg-amber-50 border border-amber-200 rounded text-[10px] text-amber-700 font-bold leading-tight">
                        ⚠️ The 'points' column is NOT in your database. Update is disabled for this field. 
                        Run: <code className="bg-white/50 px-1">ALTER TABLE ts_v2025_profiles ADD COLUMN points INTEGER DEFAULT 0;</code>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-col gap-3 pt-4 border-t border-gray-100">
                <button type="submit" className="w-full py-3.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 uppercase tracking-wider">Save Changes</button>
                <button 
                  type="button" 
                  onClick={handleResetPassword} 
                  disabled={resetLoading}
                  className="w-full py-3.5 bg-red-50 text-red-600 rounded-lg font-bold text-sm hover:bg-red-100 transition-all uppercase tracking-wider disabled:opacity-50"
                >
                  {resetLoading ? 'Processing...' : 'Direct Password Reset'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isCreateModalOpen && (
        <div className="fixed inset-0 bg-[#212B36]/60 backdrop-blur-sm z-[100] overflow-y-auto p-4 flex justify-center">
          <div className="bg-white w-full max-w-2xl rounded-xl shadow-2xl h-fit my-auto relative overflow-hidden">
            <div className="p-6 border-b border-gray-100 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-[#212B36]">Add Users</h2>
                <p className="text-xs text-gray-400 font-bold uppercase tracking-widest">Manual or Excel Import</p>
              </div>
              <button
                type="button"
                onClick={() => { setIsCreateModalOpen(false); setImportRows([]); setImportError(null); }}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Icon icon="solar:close-circle-bold" fontSize={24} className="text-gray-400" />
              </button>
            </div>

            <div className="flex border-b border-gray-100">
              <button
                type="button"
                onClick={() => setCreateTab('manual')}
                className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest ${createTab === 'manual' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Manual Entry
              </button>
              <button
                type="button"
                onClick={() => setCreateTab('import')}
                className={`flex-1 py-4 text-xs font-bold uppercase tracking-widest ${createTab === 'import' ? 'text-indigo-600 border-b-2 border-indigo-600 bg-white' : 'text-gray-400 hover:text-gray-600'}`}
              >
                Import Excel
              </button>
            </div>

            {createTab === 'manual' ? (
              <form
                onSubmit={(e) => { e.preventDefault(); handleCreateUser(); }}
                className="p-6 space-y-6"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">Email</label>
                    <input
                      required
                      type="email"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm"
                      value={createForm.email}
                      onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">Password</label>
                    <input
                      required
                      type="text"
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm"
                      value={createForm.password}
                      onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">Full Name</label>
                    <input
                      required
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm"
                      value={createForm.full_name}
                      onChange={(e) => setCreateForm({ ...createForm, full_name: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">Branch</label>
                    <input
                      required
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm"
                      value={createForm.branch}
                      onChange={(e) => setCreateForm({ ...createForm, branch: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">Semester</label>
                    <input
                      required
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm"
                      value={createForm.semester}
                      onChange={(e) => setCreateForm({ ...createForm, semester: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">Roll No</label>
                    <input
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm"
                      value={createForm.roll_no}
                      onChange={(e) => setCreateForm({ ...createForm, roll_no: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">Role</label>
                    <select
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm"
                      value={createForm.role}
                      onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
                    >
                      <option value="user">User</option>
                      <option value="admin">Admin</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">Approval</label>
                    <select
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm"
                      value={String(createForm.approved)}
                      onChange={(e) => setCreateForm({ ...createForm, approved: e.target.value === 'true' })}
                    >
                      <option value="true">Approved</option>
                      <option value="false">Pending</option>
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">XP Points</label>
                    <input
                      type="number"
                      disabled={!pointsExists}
                      className={`w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm ${!pointsExists ? 'opacity-50 grayscale' : ''}`}
                      value={createForm.points}
                      onChange={(e) => setCreateForm({ ...createForm, points: Number(e.target.value) })}
                    />
                    {!pointsExists && (
                      <p className="text-[10px] font-bold text-amber-600 uppercase tracking-wider">XP column missing</p>
                    )}
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">GitHub</label>
                    <input
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm"
                      value={createForm.github_url}
                      onChange={(e) => setCreateForm({ ...createForm, github_url: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">LinkedIn</label>
                    <input
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm"
                      value={createForm.linkedin_url}
                      onChange={(e) => setCreateForm({ ...createForm, linkedin_url: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">Instagram</label>
                    <input
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm"
                      value={createForm.instagram}
                      onChange={(e) => setCreateForm({ ...createForm, instagram: e.target.value })}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[11px] font-bold text-gray-500 ml-1 uppercase tracking-wider">WhatsApp</label>
                    <input
                      className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-indigo-600 transition-all text-sm"
                      value={createForm.whatsapp}
                      onChange={(e) => setCreateForm({ ...createForm, whatsapp: e.target.value })}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={createLoading}
                  className="w-full py-3.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 uppercase tracking-wider disabled:opacity-60"
                >
                  {createLoading ? 'Creating...' : 'Create User'}
                </button>
              </form>
            ) : (
              <div className="p-6 space-y-5">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    onClick={downloadTemplate}
                    className="px-4 py-2.5 bg-gray-50 text-gray-700 rounded-lg font-bold text-[11px] uppercase tracking-wider hover:bg-gray-100 transition-all flex items-center gap-2"
                  >
                    <Icon icon="solar:file-download-bold" fontSize={16} /> Download Template
                  </button>
                  <label className="px-4 py-2.5 bg-indigo-50 text-indigo-700 rounded-lg font-bold text-[11px] uppercase tracking-wider hover:bg-indigo-100 transition-all flex items-center gap-2 cursor-pointer">
                    <Icon icon="solar:file-upload-bold" fontSize={16} /> Upload Excel
                    <input
                      type="file"
                      accept=".xlsx,.xls"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) handleImportFile(file);
                      }}
                    />
                  </label>
                </div>

                {importError && (
                  <div className="p-3 bg-red-50 text-red-600 rounded-lg text-xs font-bold border border-red-100">
                    {importError}
                  </div>
                )}

                <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 text-sm text-gray-600">
                  <p className="text-[11px] font-bold uppercase tracking-widest text-gray-400 mb-2">Template Rules</p>
                  <p>Keep the exact column headers. Required: email, password, full_name, branch, semester.</p>
                </div>
                {!pointsExists && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-[10px] font-bold text-amber-700 uppercase tracking-wider">
                    XP column missing. Points will be ignored during import.
                  </div>
                )}

                <div className="text-xs font-bold uppercase tracking-widest text-gray-500">
                  {importRows.length} rows ready to import
                </div>

                <button
                  onClick={handleImportUsers}
                  disabled={importLoading || importRows.length === 0}
                  className="w-full py-3.5 bg-indigo-600 text-white rounded-lg font-bold text-sm hover:bg-indigo-700 transition-all shadow-lg shadow-indigo-100 uppercase tracking-wider disabled:opacity-60"
                >
                  {importLoading ? 'Importing...' : 'Import Users'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed bottom-6 right-6 z-[120]">
          <div className={`min-w-[260px] max-w-[360px] rounded-xl border px-4 py-3 shadow-xl ${
            toast.type === 'success'
              ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
              : toast.type === 'error'
                ? 'bg-red-50 border-red-200 text-red-700'
                : 'bg-indigo-50 border-indigo-200 text-indigo-700'
          }`}>
            <div className="flex items-start gap-3">
              <Icon
                icon={
                  toast.type === 'success'
                    ? 'solar:check-circle-bold'
                    : toast.type === 'error'
                      ? 'solar:danger-bold'
                      : 'solar:info-circle-bold'
                }
                fontSize={18}
              />
              <div>
                <div className="text-[11px] font-bold uppercase tracking-wider">{toast.title}</div>
                {toast.message && <div className="text-xs font-medium mt-1">{toast.message}</div>}
              </div>
              <button
                onClick={() => setToast(null)}
                className="ml-auto text-xs font-bold opacity-60 hover:opacity-100"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {actionsMenuUserId && actionsMenuPos && createPortal((() => {
        const openUser = users.find(u => u.id === actionsMenuUserId);
        if (!openUser) return null;
        return (
          <div
            ref={actionsMenuRef}
            className="fixed z-[9999]"
            style={{ top: actionsMenuPos.top, left: actionsMenuPos.left }}
          >
            <div className="w-48 bg-white border border-gray-100 shadow-xl rounded-xl overflow-hidden">
              <button
                onClick={() => { setSelectedUser(openUser); setActionsMenuUserId(null); }}
                className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-indigo-600 hover:bg-indigo-50 flex items-center gap-2"
              >
                <Icon icon="solar:pen-new-square-bold" /> Edit
              </button>
              <button
                onClick={() => { handleSendUserDetails(openUser); setActionsMenuUserId(null); }}
                disabled={sendDetailsLoadingUserId === openUser.id}
                className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-sky-600 hover:bg-sky-50 flex items-center gap-2 disabled:opacity-50"
              >
                <Icon icon="solar:mailbox-bold" />
                {sendDetailsLoadingUserId === openUser.id ? 'Sending...' : 'Send Details'}
              </button>
              <button
                onClick={() => { handleSetApproval(openUser.id, !openUser.approved); setActionsMenuUserId(null); }}
                className={`w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider ${openUser.approved ? 'text-amber-600 hover:bg-amber-50' : 'text-green-600 hover:bg-green-50'} flex items-center gap-2`}
              >
                <Icon icon={openUser.approved ? 'solar:close-circle-bold' : 'solar:check-circle-bold'} />
                {openUser.approved ? 'Mark Pending' : 'Approve'}
              </button>
              <button
                onClick={() => { handleDeleteUser(openUser.id, openUser.role); setActionsMenuUserId(null); }}
                disabled={deleteLoading === openUser.id}
                className="w-full px-4 py-2.5 text-left text-xs font-bold uppercase tracking-wider text-red-600 hover:bg-red-50 flex items-center gap-2 disabled:opacity-50"
              >
                <Icon icon="solar:trash-bin-trash-bold" /> Delete
              </button>
            </div>
          </div>
        );
      })(), document.body)}
    </div>
  );
};

export default AdminUsers;
