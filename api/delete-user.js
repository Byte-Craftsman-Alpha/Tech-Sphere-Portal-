import supabase from '../lib/supabaseAdmin.js';

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

    const { data: requesterProfile } = await supabase
      .from('ts_v2025_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (requesterProfile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const { user_id } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    if (user_id === user.id) {
      return res.status(400).json({ error: 'Admins cannot delete their own account' });
    }

    const { data: targetProfile } = await supabase
      .from('ts_v2025_profiles')
      .select('role')
      .eq('id', user_id)
      .single();

    if (targetProfile?.role === 'admin') {
      return res.status(400).json({ error: 'Admins cannot delete another admin' });
    }

    const { error: deleteError } = await supabase.auth.admin.deleteUser(user_id);
    if (deleteError) throw deleteError;

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
