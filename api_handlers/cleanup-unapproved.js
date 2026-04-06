import supabase from '../lib/supabaseAdmin.js';

const DAYS = 7;

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    const cutoff = new Date(Date.now() - DAYS * 24 * 60 * 60 * 1000).toISOString();

    const { data: staleProfiles, error } = await supabase
      .from('ts_v2025_profiles')
      .select('id, email, created_at')
      .eq('approved', false)
      .lt('created_at', cutoff);
    if (error) throw error;

    const ids = (staleProfiles || []).map((p) => p.id);
    let deleted = 0;

    for (const id of ids) {
      const { error: deleteError } = await supabase.auth.admin.deleteUser(id);
      if (deleteError) {
        await supabase.from('ts_v2025_profiles').delete().eq('id', id);
      }
      deleted += 1;
    }

    return res.status(200).json({ success: true, deleted });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
