import supabase from '../lib/supabaseAdmin.js';

const buildCertificatePayload = (row) => ({
  id: row.id,
  holder_name: row.holder_name,
  event_name: row.event_name,
  certificate_type: row.certificate_type,
  credential: row.credential,
  issued_at: row.created_at
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const credential = String(req.query?.credential || '').trim();
  if (!credential) return res.status(400).json({ error: 'credential is required' });

  try {
    const { data, error } = await supabase
      .from('ts_v2025_certificates')
      .select('*')
      .eq('credential', credential)
      .maybeSingle();

    if (error) throw error;
    if (!data) return res.status(404).json({ valid: false, error: 'Certificate not found' });

    return res.status(200).json({ valid: true, certificate: buildCertificatePayload(data) });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}

