import supabase from '../lib/supabaseAdmin.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  try {
    const token = req.query.token;
    if (!token) return res.status(400).json({ error: 'Missing token' });

    const { data: share, error: shareError } = await supabase
      .from('ts_v2025_registration_shares')
      .select('*')
      .eq('token', token)
      .eq('is_active', true)
      .maybeSingle();
    if (shareError) throw shareError;
    if (!share) return res.status(404).json({ error: 'Invalid or revoked link' });

    const { data: event, error: eventError } = await supabase
      .from('ts_v2025_events')
      .select('id, title, description, date, location, capacity, custom_form, pass_settings')
      .eq('id', share.event_id)
      .maybeSingle();
    if (eventError) throw eventError;
    if (!event) return res.status(404).json({ error: 'Event not found' });

    const { data: regs, error: regsError } = await supabase
      .from('ts_v2025_registrations')
      .select('id, user_id, status, attended, attended_at, form_responses, created_at')
      .eq('event_id', share.event_id);
    if (regsError) throw regsError;

    let profiles = [];
    if (regs && regs.length > 0) {
      const userIds = [...new Set(regs.map(r => r.user_id))];
      const { data: profs, error: profError } = await supabase
        .from('ts_v2025_profiles')
        .select('id, full_name, email, branch, semester, roll_no, avatar_url')
        .in('id', userIds);
      if (profError) throw profError;
      profiles = profs || [];
    }

    const combined = (regs || []).map(r => ({
      ...r,
      profile: profiles.find(p => p.id === r.user_id) || { full_name: 'Unknown User' }
    }));

    return res.status(200).json({
      event,
      registrations: combined
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
