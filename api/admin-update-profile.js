import supabase from '../lib/supabaseAdmin.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const authHeader = req.headers.authorization || '';
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: requesterProfile } = await supabase
      .from('ts_v2025_profiles')
      .select('role, email')
      .eq('id', user.id)
      .maybeSingle();

    const adminEmail = String(process.env.ADMIN_EMAIL || '').toLowerCase();
    const viteAdminEmail = String(process.env.VITE_ADMIN_EMAIL || '').toLowerCase();
    const metaRole = String(user?.user_metadata?.role || '').toLowerCase();
    const isAdmin =
      requesterProfile?.role === 'admin' ||
      metaRole === 'admin' ||
      (user.email || '').toLowerCase() === adminEmail ||
      (user.email || '').toLowerCase() === viteAdminEmail;
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    const { user_id, updates } = req.body || {};
    if (!user_id || !updates) return res.status(400).json({ error: 'user_id and updates are required' });

    const cleanedUpdates = { ...updates };
    delete cleanedUpdates.id;
    delete cleanedUpdates.created_at;
    delete cleanedUpdates.updated_at;

    if (cleanedUpdates.approved !== undefined) {
      cleanedUpdates.approved = String(cleanedUpdates.approved).toLowerCase() === 'true' || cleanedUpdates.approved === true;
    }

    const { data, error } = await supabase
      .from('ts_v2025_profiles')
      .update(cleanedUpdates)
      .eq('id', user_id)
      .select()
      .single();
    if (error) throw error;

    return res.status(200).json({ success: true, profile: data });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
