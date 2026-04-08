import supabase from '../lib/supabaseAdmin.js';

const normalizeEmail = (value) => {
  if (!value) return null;
  const cleaned = String(value).trim().toLowerCase();
  return cleaned.length > 0 ? cleaned : null;
};

const buildCertificatePayload = (row) => ({
  id: row.id,
  holder_name: row.holder_name,
  event_name: row.event_name,
  event_id: row.event_id,
  certificate_type: row.certificate_type,
  credential: row.credential,
  holder_email: row.holder_email,
  user_id: row.user_id,
  issued_at: row.created_at
});

const isAdminUser = async (token) => {
  const { data: { user }, error: authError } = await supabase.auth.getUser(token);
  if (authError || !user) return { isAdmin: false };

  const { data: requesterProfile } = await supabase
    .from('ts_v2025_profiles')
    .select('role, email')
    .eq('id', user.id)
    .maybeSingle();

  const adminEmail = String(process.env.ADMIN_EMAIL || '').toLowerCase();
  const viteAdminEmail = String(process.env.VITE_ADMIN_EMAIL || '').toLowerCase();
  const metaRole = String(user?.user_metadata?.role || '').toLowerCase();
  const isAdmin =
    requesterProfile?.role === 'admin' ||
    metaRole === 'admin' ||
    (user.email || '').toLowerCase() === adminEmail ||
    (user.email || '').toLowerCase() === viteAdminEmail;

  return { isAdmin, user };
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  const authHeader = req.headers.authorization || '';
  const token = authHeader.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'No token' });

  try {
    const { isAdmin } = await isAdminUser(token);
    if (!isAdmin) return res.status(403).json({ error: 'Forbidden' });

    if (req.method === 'GET') {
      const id = String(req.query?.id || '').trim();
      if (id) {
        const { data, error } = await supabase
          .from('ts_v2025_certificates')
          .select('*')
          .eq('id', id)
          .maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Certificate not found' });
        return res.status(200).json({ certificate: buildCertificatePayload(data) });
      }

      const { data, error } = await supabase
        .from('ts_v2025_certificates')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return res.status(200).json({ items: (data || []).map(buildCertificatePayload) });
    }

    const resolveEventId = async (eventId, eventName, eventMap) => {
      if (eventId) return eventId;
      const cleaned = String(eventName || '').trim();
      if (!cleaned) return null;
      if (eventMap && eventMap[cleaned.toLowerCase()]) return eventMap[cleaned.toLowerCase()];
      const { data } = await supabase
        .from('ts_v2025_events')
        .select('id')
        .ilike('title', cleaned)
        .maybeSingle();
      return data?.id || null;
    };

    if (req.method === 'POST') {
      const body = req.body || {};
      const bulkItems = Array.isArray(body.items) ? body.items : null;

      if (bulkItems) {
        const cleanedItems = bulkItems
          .map((item) => ({
            holder_name: String(item?.holder_name || '').trim(),
            event_name: String(item?.event_name || '').trim(),
            certificate_type: String(item?.certificate_type || '').trim(),
            credential: String(item?.credential || '').trim(),
            holder_email: normalizeEmail(item?.holder_email),
            event_id: item?.event_id ? String(item.event_id).trim() : null
          }))
          .filter((item) => item.holder_name && item.event_name && item.certificate_type && item.credential);

        if (cleanedItems.length === 0) {
          return res.status(400).json({ error: 'No valid certificate rows found' });
        }

        const uniqueEmails = Array.from(
          new Set(cleanedItems.map((item) => item.holder_email).filter(Boolean))
        );

        const emailMap = {};
        if (uniqueEmails.length > 0) {
          const { data: profiles } = await supabase
            .from('ts_v2025_profiles')
            .select('id, email')
            .in('email', uniqueEmails);
          (profiles || []).forEach((profile) => {
            if (profile?.email) emailMap[String(profile.email).toLowerCase()] = profile.id;
          });
        }

        const needsEventLookup = cleanedItems.some((item) => !item.event_id);
        let eventMap = null;
        if (needsEventLookup) {
          const { data: events } = await supabase
            .from('ts_v2025_events')
            .select('id, title');
          eventMap = {};
          (events || []).forEach((event) => {
            if (event?.title) eventMap[String(event.title).toLowerCase()] = event.id;
          });
        }

        const payload = await Promise.all(cleanedItems.map(async (item) => {
          const resolvedEventId = await resolveEventId(item.event_id, item.event_name, eventMap);
          return {
            holder_name: item.holder_name,
            event_name: item.event_name,
            certificate_type: item.certificate_type,
            credential: item.credential,
            holder_email: item.holder_email,
            user_id: item.holder_email ? (emailMap[item.holder_email.toLowerCase()] || null) : null,
            event_id: resolvedEventId
          };
        }));

        const { data, error } = await supabase
          .from('ts_v2025_certificates')
          .insert(payload)
          .select();

        if (error) throw error;
        return res.status(200).json({ items: (data || []).map(buildCertificatePayload) });
      }

      const {
        holder_name,
        event_name,
        certificate_type,
        credential,
        holder_email,
        event_id
      } = body;

      if (!holder_name || !event_name || !certificate_type || !credential) {
        return res.status(400).json({ error: 'holder_name, event_name, certificate_type, credential are required' });
      }

      const normalizedEmail = normalizeEmail(holder_email);
      let userId = null;
      if (normalizedEmail) {
        const { data: profile } = await supabase
          .from('ts_v2025_profiles')
          .select('id')
          .ilike('email', normalizedEmail)
          .maybeSingle();
        if (profile?.id) userId = profile.id;
      }

      const resolvedEventId = await resolveEventId(event_id, event_name);

      const { data, error } = await supabase
        .from('ts_v2025_certificates')
        .insert([
          {
            holder_name: String(holder_name).trim(),
            event_name: String(event_name).trim(),
            certificate_type: String(certificate_type).trim(),
            credential: String(credential).trim(),
            holder_email: normalizedEmail,
            user_id: userId,
            event_id: resolvedEventId
          }
        ])
        .select()
        .single();

      if (error) throw error;

      return res.status(200).json({ certificate: buildCertificatePayload(data) });
    }

    if (req.method === 'PATCH') {
      const { id, updates } = req.body || {};
      if (!id || !updates) return res.status(400).json({ error: 'id and updates are required' });

      const nextUpdates = { ...updates };
      delete nextUpdates.id;
      delete nextUpdates.created_at;

      if (nextUpdates.holder_email !== undefined) {
        nextUpdates.holder_email = normalizeEmail(nextUpdates.holder_email);
      }

      if (nextUpdates.holder_email) {
        const { data: profile } = await supabase
          .from('ts_v2025_profiles')
          .select('id')
          .ilike('email', nextUpdates.holder_email)
          .maybeSingle();
        nextUpdates.user_id = profile?.id || null;
      }

      if (nextUpdates.event_id || nextUpdates.event_name) {
        nextUpdates.event_id = await resolveEventId(nextUpdates.event_id, nextUpdates.event_name);
      }

      const { data, error } = await supabase
        .from('ts_v2025_certificates')
        .update(nextUpdates)
        .eq('id', id)
        .select()
        .single();
      if (error) throw error;

      return res.status(200).json({ certificate: buildCertificatePayload(data) });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });
      const { error } = await supabase
        .from('ts_v2025_certificates')
        .delete()
        .eq('id', id);
      if (error) throw error;
      return res.status(200).json({ success: true });
    }

    return res.status(405).json({ error: 'Method not allowed' });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}

