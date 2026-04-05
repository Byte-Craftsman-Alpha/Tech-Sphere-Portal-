import supabase from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) return res.status(401).json({ error: 'Unauthorized' });

  // Get user profile to check if admin
  const { data: profile } = await supabase.from('ts_v2025_profiles').select('role').eq('id', user.id).single();
  const isAdmin = profile?.role === 'admin';

  try {
    if (req.method === 'GET') {
      const { event_id } = req.query;
      let query = supabase.from('ts_v2025_submissions').select('*, ts_v2025_profiles(*)');
      
      if (event_id) {
        query = query.eq('event_id', event_id);
      }
      
      // Users can only see their own submissions unless they are admin
      if (!isAdmin) {
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json(data || []);
    }

    if (req.method === 'POST') {
      const { event_id, project_url, github_url, demo_url, description, tech_stack } = req.body;
      const { data, error } = await supabase
        .from('ts_v2025_submissions')
        .upsert({ 
          user_id: user.id, 
          event_id, 
          project_url,
          github_url,
          demo_url,
          description,
          tech_stack: tech_stack || []
        }, { onConflict: 'event_id,user_id' })
        .select()
        .single();
        
      if (error) throw error;
      return res.status(201).json(data);
    }

    if (req.method === 'PUT') {
      // Admins can update scores and feedback
      if (!isAdmin) return res.status(403).json({ error: 'Forbidden: Only admins can grade submissions.' });
      
      const { id, score, feedback } = req.body;
      const { data, error } = await supabase
        .from('ts_v2025_submissions')
        .update({ score, feedback })
        .eq('id', id)
        .select()
        .single();
        
      if (error) throw error;
      return res.status(200).json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}
