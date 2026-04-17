import supabase from '../lib/supabaseAdmin.js';

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

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') return res.status(204).end();

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const category = String(req.query?.category || '').trim().toLowerCase();
    const limit = Math.min(Math.max(Number(req.query?.limit || 100) || 100, 1), 200);

    let query = supabase
      .from('ts_v2025_content_items')
      .select('*')
      .eq('published', true)
      .order('featured', { ascending: false })
      .order('sort_order', { ascending: true })
      .order('published_at', { ascending: false, nullsFirst: false })
      .order('created_at', { ascending: false })
      .limit(limit);

    if (category && category !== 'all') {
      query = query.eq('category', category);
    }

    const { data, error } = await query;
    if (error) throw error;

    return res.status(200).json({ items: (data || []).map(buildContentPayload) });
  } catch (err) {
    return res.status(500).json({ error: err.message || 'Server error' });
  }
}
