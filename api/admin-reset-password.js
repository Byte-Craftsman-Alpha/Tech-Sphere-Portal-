import supabase from '../lib/supabaseAdmin.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const { data: { user: adminUser } } = await supabase.auth.getUser(token);
    const { data: adminProfile } = await supabase.from('ts_v2025_profiles').select('role').eq('id', adminUser?.id).single();
    if (adminProfile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const { user_id, new_password } = req.body;
    const { error } = await supabase.auth.admin.updateUserById(user_id, { password: new_password });
    if (error) throw error;
    return res.status(200).json({ success: true });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
