import { createClient } from '@supabase/supabase-js';

const REQUIRED_TABLE = 'ts_v2025_profiles';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    return res.status(500).json({
      ok: false,
      db: 'unconfigured',
      message: 'Missing Supabase environment variables',
      time: new Date().toISOString()
    });
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const smtpConfig = {
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
    from: process.env.SMTP_FROM
  };

  const smtpReady = Boolean(
    smtpConfig.host &&
    smtpConfig.port &&
    smtpConfig.user &&
    smtpConfig.pass &&
    smtpConfig.from
  );

  const { error } = await supabase.from(REQUIRED_TABLE).select('id').limit(1);

  if (error) {
    return res.status(500).json({
      ok: false,
      db: 'error',
      smtp: smtpReady ? 'ready' : 'missing',
      message: error.message,
      time: new Date().toISOString()
    });
  }

  return res.status(200).json({
    ok: true,
    db: 'ready',
    smtp: smtpReady ? 'ready' : 'missing',
    time: new Date().toISOString()
  });
}
