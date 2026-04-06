import supabase from '../lib/supabaseAdmin.js';

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

const parseBoolean = (value) => {
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value === 1;
  if (typeof value !== 'string') return false;
  return ['true', 'yes', '1', 'y'].includes(value.trim().toLowerCase());
};

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

    const rawUsers = Array.isArray(req.body?.users) ? req.body.users : [req.body];
    if (!rawUsers || rawUsers.length === 0) {
      return res.status(400).json({ error: 'No users provided' });
    }

    const results = [];

    for (const input of rawUsers) {
      const email = String(input?.email || '').trim().toLowerCase();
      const password = String(input?.password || '').trim();
      const full_name = String(input?.full_name || '').trim();
      const branch = String(input?.branch || '').trim();
      const semester = String(input?.semester || '').trim();
      const role = String(input?.role || 'user').trim() || 'user';
      const approved = parseBoolean(input?.approved);

      if (!email || !password || !full_name || !branch || !semester) {
        results.push({ email, status: 'error', error: 'Missing required fields' });
        continue;
      }

      const existing = await findUserByEmail(email);
      if (existing) {
        results.push({ email, status: 'exists' });
        continue;
      }

      const { data: created, error: createError } = await supabase.auth.admin.createUser({
        email,
        password,
        email_confirm: true
      });

      if (createError || !created?.user?.id) {
        results.push({ email, status: 'error', error: createError?.message || 'Auth creation failed' });
        continue;
      }

      const payload = {
        id: created.user.id,
        email,
        full_name,
        branch,
        semester,
        roll_no: input?.roll_no || null,
        role,
        points: Number.isFinite(Number(input?.points)) ? Number(input.points) : 0,
        approved,
        github_url: input?.github_url || null,
        linkedin_url: input?.linkedin_url || null,
        instagram: input?.instagram || null,
        whatsapp: input?.whatsapp || null
      };

      const { error: profileError } = await supabase.from('ts_v2025_profiles').upsert(payload);
      if (profileError) {
        await supabase.auth.admin.deleteUser(created.user.id);
        results.push({ email, status: 'error', error: profileError.message || 'Profile creation failed' });
        continue;
      }

      results.push({ email, status: 'created' });
    }

    const createdCount = results.filter(r => r.status === 'created').length;
    const existsCount = results.filter(r => r.status === 'exists').length;
    const errorCount = results.filter(r => r.status === 'error').length;

    return res.status(200).json({ success: true, created: createdCount, exists: existsCount, errors: errorCount, results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
