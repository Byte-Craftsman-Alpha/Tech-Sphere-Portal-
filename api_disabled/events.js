import supabase from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase.from('ts_v2025_events').select('*').order('date', { ascending: true });
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ error: 'No token' });
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: profile } = await supabase.from('ts_v2025_profiles').select('role').eq('id', user.id).single();
    if (profile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    if (req.method === 'POST') {
      const { id, created_at, ...body } = req.body;
      const { data, error } = await supabase.from('ts_v2025_events').insert(body).select().single();
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      const { id, created_at, ...updates } = req.body;
      const { data, error } = await supabase.from('ts_v2025_events').update(updates).eq('id', id).select().single();
      if (error) throw error;
      return res.status(200).json(data);
    }

    if (req.method === 'DELETE') {
      const { id } = req.query;
      const { error } = await supabase.from('ts_v2025_events').delete().eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
