import supabase from '../lib/supabaseAdmin.js';
import crypto from 'crypto';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'No token' });
  const token = authHeader.split(' ')[1];

  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) return res.status(401).json({ error: 'Unauthorized' });

    const { data: adminProfile } = await supabase
      .from('ts_v2025_profiles')
      .select('role')
      .eq('id', user.id)
      .maybeSingle();
    if (adminProfile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

    if (req.method === 'GET') {
      const event_id = req.query.event_id;
      if (!event_id) return res.status(400).json({ error: 'Missing event_id' });
      const { data, error } = await supabase
        .from('ts_v2025_registration_shares')
        .select('*')
        .eq('event_id', event_id)
        .maybeSingle();
      if (error) throw error;
      return res.status(200).json(data || null);
    }

    if (req.method === 'POST') {
      const { event_id, action } = req.body || {};
      if (!event_id) return res.status(400).json({ error: 'Missing event_id' });

      if (action === 'revoke') {
        const { data, error } = await supabase
          .from('ts_v2025_registration_shares')
          .update({ is_active: false, updated_at: new Date().toISOString() })
          .eq('event_id', event_id)
          .select()
          .maybeSingle();
        if (error) throw error;
        return res.status(200).json(data || null);
      }

      const newToken = crypto.randomBytes(24).toString('base64url');
      const payload = {
        event_id,
        token: newToken,
        is_active: true,
        updated_at: new Date().toISOString()
      };

      const { data, error } = await supabase
        .from('ts_v2025_registration_shares')
        .upsert(payload, { onConflict: 'event_id' })
        .select()
        .maybeSingle();
      if (error) throw error;

      const baseUrl = process.env.PUBLIC_APP_URL || req.headers.origin || '';
      return res.status(200).json({
        ...data,
        public_url: baseUrl ? `${baseUrl}/share/${data.token}` : null
      });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
