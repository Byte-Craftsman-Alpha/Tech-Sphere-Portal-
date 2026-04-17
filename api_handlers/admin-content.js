import supabase from '../lib/supabaseAdmin.js';

const normalizeCategory = (value) => {
  const cleaned = String(value || '').trim().toLowerCase();
  return cleaned.replace(/\s+/g, '-');
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined || value === null || value === '') return fallback;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'number') return value !== 0;
  return ['true', '1', 'yes', 'on'].includes(String(value).toLowerCase());
};

const buildContentPayload = (row) => ({
  id: row.id,
  title: row.title,
  summary: row.summary,
  category: row.category,
  external_url: row.external_url,
  source: row.source,
  image_url: row.image_url,
  published: row.published,
  featured: row.featured,
  sort_order: row.sort_order,
  published_at: row.published_at,
  created_at: row.created_at,
  updated_at: row.updated_at
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
      const category = String(req.query?.category || '').trim().toLowerCase();

      let query = supabase
        .from('ts_v2025_content_items')
        .select('*')
        .order('featured', { ascending: false })
        .order('sort_order', { ascending: true })
        .order('published_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });

      if (id) {
        const { data, error } = await query.eq('id', id).maybeSingle();
        if (error) throw error;
        if (!data) return res.status(404).json({ error: 'Content item not found' });
        return res.status(200).json({ item: buildContentPayload(data) });
      }

      if (category && category !== 'all') {
        query = query.eq('category', category);
      }

      const { data, error } = await query;
      if (error) throw error;
      return res.status(200).json({ items: (data || []).map(buildContentPayload) });
    }

    if (req.method === 'POST') {
      const body = req.body || {};
      const title = String(body.title || '').trim();
      const summary = String(body.summary || '').trim();
      const category = normalizeCategory(body.category);
      const external_url = String(body.external_url || '').trim();
      const source = String(body.source || '').trim();
      const image_url = String(body.image_url || '').trim();
      const published = parseBoolean(body.published, true);
      const featured = parseBoolean(body.featured, false);
      const sort_order = Number.isFinite(Number(body.sort_order)) ? Number(body.sort_order) : 0;
      const published_at = body.published_at ? new Date(body.published_at).toISOString() : null;

      if (!title || !category || !external_url) {
        return res.status(400).json({ error: 'title, category, and external_url are required' });
      }

      const { data, error } = await supabase
        .from('ts_v2025_content_items')
        .insert([{
          title,
          summary: summary || null,
          category,
          external_url,
          source: source || null,
          image_url: image_url || null,
          published,
          featured,
          sort_order,
          published_at,
          updated_at: new Date().toISOString()
        }])
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ item: buildContentPayload(data) });
    }

    if (req.method === 'PATCH') {
      const { id, updates } = req.body || {};
      if (!id || !updates) return res.status(400).json({ error: 'id and updates are required' });

      const nextUpdates = { ...updates };
      delete nextUpdates.id;
      delete nextUpdates.created_at;

      if (nextUpdates.category !== undefined) {
        nextUpdates.category = normalizeCategory(nextUpdates.category);
      }
      if (nextUpdates.title !== undefined) nextUpdates.title = String(nextUpdates.title || '').trim();
      if (nextUpdates.summary !== undefined) nextUpdates.summary = String(nextUpdates.summary || '').trim() || null;
      if (nextUpdates.external_url !== undefined) nextUpdates.external_url = String(nextUpdates.external_url || '').trim();
      if (nextUpdates.source !== undefined) nextUpdates.source = String(nextUpdates.source || '').trim() || null;
      if (nextUpdates.image_url !== undefined) nextUpdates.image_url = String(nextUpdates.image_url || '').trim() || null;
      if (nextUpdates.published !== undefined) nextUpdates.published = parseBoolean(nextUpdates.published);
      if (nextUpdates.featured !== undefined) nextUpdates.featured = parseBoolean(nextUpdates.featured);
      if (nextUpdates.sort_order !== undefined) nextUpdates.sort_order = Number(nextUpdates.sort_order) || 0;
      if (nextUpdates.published_at !== undefined) {
        nextUpdates.published_at = nextUpdates.published_at ? new Date(nextUpdates.published_at).toISOString() : null;
      }
      nextUpdates.updated_at = new Date().toISOString();

      const { data, error } = await supabase
        .from('ts_v2025_content_items')
        .update(nextUpdates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return res.status(200).json({ item: buildContentPayload(data) });
    }

    if (req.method === 'DELETE') {
      const { id } = req.body || {};
      if (!id) return res.status(400).json({ error: 'id is required' });

      const { error } = await supabase
        .from('ts_v2025_content_items')
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
