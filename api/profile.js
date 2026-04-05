import supabase from '../lib/supabaseAdmin.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

    if (req.method === 'GET') {
      const { data, error } = await supabase.from('ts_v2025_profiles').select('*').eq('id', user.id).single();
      if (error && error.code !== 'PGRST116') throw error;
      return res.status(200).json(data || { id: user.id, email: user.email });
    }

    if (req.method === 'POST') {
      const payload = { approved: false, ...req.body, id: user.id };
      const { data, error } = await supabase
        .from('ts_v2025_profiles')
        .insert(payload)
        .select()
        .single();
      if (error) {
        const msg = String(error.message || '');
        if (msg.includes('duplicate') || msg.includes('already exists')) {
          const { data: updated, error: updateError } = await supabase
            .from('ts_v2025_profiles')
            .update(payload)
            .eq('id', user.id)
            .select()
            .single();
          if (updateError) throw updateError;
          return res.status(200).json(updated);
        }
        throw error;
      }
      return res.status(200).json(data);
    }

    if (req.method === 'PUT') {
      const { data, error } = await supabase
        .from('ts_v2025_profiles')
        .update({ ...req.body })
        .eq('id', user.id)
        .select()
        .single();
      if (error) throw error;
      return res.status(200).json(data);
    }
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
