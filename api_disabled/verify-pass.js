import supabase from './_supabase.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  const { data: { user } } = await supabase.auth.getUser(token);
  const { data: profile } = await supabase.from('ts_v2025_profiles').select('role').eq('id', user?.id).single();
  if (profile?.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });

  const { qr_data } = req.body;
  if (!qr_data) return res.status(400).json({ error: 'QR data is required' });

  try {
    // Find registration
    const { data: reg, error: regError } = await supabase
      .from('ts_v2025_registrations')
      .select('*, ts_v2025_profiles(*), ts_v2025_events(*)')
      .eq('qr_data', qr_data)
      .single();

    if (regError || !reg) {
      return res.status(404).json({ error: 'Invalid Pass: Registration not found' });
    }

    // Increment scan count
    const { data: updatedReg, error: updateError } = await supabase
      .from('ts_v2025_registrations')
      .update({ scan_count: (reg.scan_count || 0) + 1 })
      .eq('id', reg.id)
      .select()
      .single();

    if (updateError) throw updateError;

    return res.status(200).json({
      success: true,
      user: reg.ts_v2025_profiles,
      event: reg.ts_v2025_events,
      scan_count: updatedReg.scan_count
    });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
