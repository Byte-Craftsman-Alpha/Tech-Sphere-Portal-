import supabase from '../lib/supabaseAdmin.js';
import { sendUserApprovalEmail } from '../lib/server/email.js';

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

    const { user_id, approved } = req.body || {};
    if (!user_id) return res.status(400).json({ error: 'user_id is required' });

    const { data: targetProfile, error: profileError } = await supabase
      .from('ts_v2025_profiles')
      .select('email, full_name')
      .eq('id', user_id)
      .maybeSingle();
    if (profileError) throw profileError;

    const { error } = await supabase
      .from('ts_v2025_profiles')
      .update({ approved: Boolean(approved) })
      .eq('id', user_id);
    if (error) throw error;

    if (targetProfile?.email) {
      try {
        await sendUserApprovalEmail({
          to: targetProfile.email,
          fullName: targetProfile.full_name,
          approved: Boolean(approved)
        });
      } catch (err) {
        console.warn('User approval email failed:', err?.message || err);
      }
    }

    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
