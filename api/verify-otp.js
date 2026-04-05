import supabase from '../lib/supabaseAdmin.js';
import { sendAdminRegistrationEmail } from '../lib/server/email.js';

const TABLE = 'ts_v2025_otps';

async function findUserByEmail(email) {
  const perPage = 1000;
  let page = 1;
  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const users = data?.users || [];
    const found = users.find(u => u.email?.toLowerCase() === email.toLowerCase());
    if (found) return found;
    if (users.length < perPage) return null;
    page += 1;
  }
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const { email, otp, password, full_name, branch, semester, github, linkedin, instagram, whatsapp, roll_no } = req.body;

  try {
    if (!email || !otp || !password || !full_name || !branch || !semester) {
      return res.status(400).json({ error: 'Incomplete registration data' });
    }

    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Account already exists. Please sign in or use Forgot Password.' });
    }

    const { data: otpData } = await supabase
      .from(TABLE)
      .select('*')
      .eq('email', email)
      .eq('code', otp)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle(); // Safe fetch

    if (!otpData) return res.status(400).json({ error: 'Invalid or expired verification code' });

    const { data: authUser, error: authError } = await supabase.auth.admin.createUser({ email, password: password || '123456', email_confirm: true });
    if (authError) throw authError;

    const { error: profileError } = await supabase.from('ts_v2025_profiles').upsert({
      id: authUser.user.id,
      email,
      full_name,
      roll_no,
      branch,
      semester,
      approved: false,
      github_url: github,
      linkedin_url: linkedin,
      instagram,
      whatsapp,
      role: 'user'
    });
    if (profileError) {
      await supabase.auth.admin.deleteUser(authUser.user.id);
      throw profileError;
    }

    await supabase.from(TABLE).delete().eq('email', email);
    try {
      await sendAdminRegistrationEmail({
        adminEmail: process.env.ADMIN_EMAIL,
        user: { email, full_name, branch, semester, roll_no }
      });
    } catch (err) {
      console.warn('Admin email notify failed:', err?.message || err);
    }
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
