import supabase from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });
  
  try {
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

    if (req.method === 'GET') {
      const { event_id } = req.query;
      const { data: profile } = await supabase.from('ts_v2025_profiles').select('role').eq('id', user.id).single();
      
      let query = supabase.from('ts_v2025_registrations').select('*');
      if (event_id) {
        if (profile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
        query = query.eq('event_id', event_id);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data: regs, error: regsError } = await query;
      if (regsError) throw regsError;

      if (event_id && regs.length > 0) {
        const userIds = [...new Set(regs.map(r => r.user_id))];
        const { data: profiles } = await supabase.from('ts_v2025_profiles').select('*').in('id', userIds);
        const combined = regs.map(r => ({
          ...r,
          profiles: profiles?.find(p => p.id === r.user_id) || { full_name: 'Unknown User' }
        }));
        return res.status(200).json(combined);
      }
      return res.status(200).json(regs || []);
    }

    if (req.method === 'POST') {
      const { event_id, form_responses } = req.body;
      const { data, error } = await supabase.from('ts_v2025_registrations').insert({ 
        user_id: user.id, event_id, status: 'registered', qr_data: `pass_${user.id}_${event_id}`, form_responses: form_responses || {}
      }).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
