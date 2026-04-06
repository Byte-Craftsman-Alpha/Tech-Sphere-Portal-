import supabase from '../lib/supabaseAdmin.js';
import { sendUserDetailsEmail } from '../lib/server/email.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  const { user_id, temp_password } = req.body || {};
  if (!user_id || !temp_password) {
    return res.status(400).json({ error: 'user_id and temp_password are required' });
  }

  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: requesterProfile } = await supabase
      .from('ts_v2025_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (requesterProfile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    const { data: profile, error: profileError } = await supabase
      .from('ts_v2025_profiles')
      .select('*')
      .eq('id', user_id)
      .single();
    if (profileError || !profile) return res.status(404).json({ error: 'User profile not found' });
    if (!profile.email) return res.status(400).json({ error: 'User email not found' });

    const { error: updateError } = await supabase.auth.admin.updateUserById(user_id, {
      password: String(temp_password)
    });
    if (updateError) throw updateError;

    const loginUrl = process.env.PUBLIC_APP_URL || process.env.APP_URL || process.env.VERCEL_URL;
    const emailResult = await sendUserDetailsEmail({
      to: profile.email,
      user: profile,
      tempPassword: String(temp_password),
      loginUrl: loginUrl ? `https://${String(loginUrl).replace(/^https?:\/\//, '')}` : undefined
    });

    return res.status(200).json({
      success: true,
      sent: Boolean(emailResult?.sent),
      skipped: Boolean(emailResult?.skipped),
      reason: emailResult?.reason || null
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
