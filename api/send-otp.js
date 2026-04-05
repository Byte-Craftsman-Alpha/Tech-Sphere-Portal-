import supabase from '../lib/supabaseAdmin.js';
import { sendOtpEmail } from './utils/email.js';
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
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });
  const otp = Math.floor(100000 + Math.random() * 900000).toString();
  const expiresAt = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  try {
    const existingUser = await findUserByEmail(email);
    if (existingUser) {
      return res.status(409).json({ error: 'Account already exists. Please sign in or use Forgot Password.' });
    }
    const { error: dbError } = await supabase.from(TABLE).upsert({ email, code: otp, expires_at: expiresAt }, { onConflict: 'email' });
    if (dbError) throw dbError;
    if (process.env.DEV_MODE === 'true') return res.status(200).json({ message: 'OTP generated (Dev Mode)', otp: otp });
    await sendOtpEmail({ to: email, otp });
    return res.status(200).json({ message: 'OTP sent successfully' });
  } catch (err) { return res.status(500).json({ error: err.message }); }
}
