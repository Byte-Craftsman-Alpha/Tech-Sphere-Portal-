import supabase from '../lib/supabaseAdmin.js';

async function listAllUsers() {
  const all = [];
  let page = 1;
  const perPage = 1000;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    all.push(...users);
    if (users.length < perPage) break;
    page += 1;
  }
  return all;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: profile } = await supabase.from('ts_v2025_profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const authUsers = await listAllUsers();
    if (authUsers.length === 0) return res.status(200).json({ repaired: 0, totalAuth: 0 });

    const authIds = authUsers.map(u => u.id);
    const { data: profiles } = await supabase
      .from('ts_v2025_profiles')
      .select('id')
      .in('id', authIds);

    const existingIds = new Set((profiles || []).map(p => p.id));
    const missing = authUsers.filter(u => !existingIds.has(u.id));

    if (missing.length === 0) {
      return res.status(200).json({ repaired: 0, totalAuth: authUsers.length });
    }

    const payload = missing.map(u => ({
      id: u.id,
      email: u.email,
      full_name: u.user_metadata?.full_name || u.raw_user_meta_data?.full_name || 'Registered User',
      role: 'user'
    }));

    const { error: upsertError } = await supabase
      .from('ts_v2025_profiles')
      .upsert(payload, { onConflict: 'id' });

    if (upsertError) throw upsertError;

    return res.status(200).json({
      repaired: payload.length,
      totalAuth: authUsers.length
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
