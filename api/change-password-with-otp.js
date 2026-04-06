import supabase from '../lib/supabaseAdmin.js';

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
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const { email, otp, new_password } = req.body;
  if (!email || !otp || !new_password) {
    return res.status(400).json({ error: 'Email, OTP, and new password are required' });
  }

  try {
    const { data: otpData } = await supabase
      .from(TABLE)
      .select('*')
      .eq('email', email)
      .eq('code', otp)
      .gt('expires_at', new Date().toISOString())
      .maybeSingle();

    if (!otpData) return res.status(400).json({ error: 'Invalid or expired verification code' });

    const existingUser = await findUserByEmail(email);
    if (!existingUser) {
      return res.status(404).json({ error: 'Account not found for this email.' });
    }

    const { error: updateError } = await supabase.auth.admin.updateUserById(existingUser.id, {
      password: new_password
    });
    if (updateError) throw updateError;

    await supabase.from(TABLE).delete().eq('email', email);
    return res.status(200).json({ success: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
