import supabase from './_supabase.js';

const TABLE = 'ts_v2025_registrations';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData?.user) {
      console.error('Auth error:', userError);
      return res.status(401).json({ error: 'Unauthorized' });
    }
    const user = userData.user;

    if (req.method === 'GET') {
      const { challenge_id } = req.query;
      
      let query = supabase.from(TABLE).select('*');
      if (challenge_id) {
        // In V2, challenge_id is mapped directly to event_id
        query = query.eq('event_id', challenge_id);
      } else {
        query = query.eq('user_id', user.id);
      }

      const { data: regs, error: regsError } = await query;
      if (regsError) {
        console.error('Challenge regs fetch error:', regsError);
        return res.status(200).json([]);
      }

      if (!regs || regs.length === 0) return res.status(200).json([]);

      const userIds = [...new Set(regs.map(r => r.user_id))].filter(id => !!id);
      if (userIds.length === 0) return res.status(200).json(regs);

      const { data: profiles, error: profError } = await supabase
        .from('ts_v2025_profiles')
        .select('*')
        .in('id', userIds);
      
      if (profError) {
        console.error('Profiles fetch error:', profError);
        return res.status(200).json(regs);
      }

      const enrichedRegs = regs.map(reg => ({
        ...reg,
        profiles: profiles?.find(p => p.id === reg.user_id) || null
      }));

      return res.status(200).json(enrichedRegs);
    }

    if (req.method === 'POST') {
      const { challenge_id } = req.body;
      if (!challenge_id) return res.status(400).json({ error: 'challenge_id is required' });

      const { data, error } = await supabase
        .from(TABLE)
        .insert({ user_id: user.id, event_id: challenge_id, status: 'started' })
        .select()
        .single();
      
      if (error) {
        console.error('Challenge insert error:', error);
        return res.status(400).json({ error: error.message });
      }
      return res.status(201).json(data);
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    console.error('Global Challenge API Error:', err);
    res.status(500).json({ error: err.message });
  }
}
