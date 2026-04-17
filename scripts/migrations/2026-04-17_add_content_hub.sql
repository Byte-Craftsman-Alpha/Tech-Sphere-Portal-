-- Incremental migration: add the admin-managed content hub without touching existing data.
-- Safe to run on an existing Supabase/Postgres database.

BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS ts_v2025_content_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  summary TEXT,
  category TEXT NOT NULL,
  external_url TEXT NOT NULL,
  source TEXT,
  image_url TEXT,
  published BOOLEAN DEFAULT true,
  featured BOOLEAN DEFAULT false,
  sort_order INTEGER DEFAULT 0,
  published_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ts_v2025_content_items_published_idx
  ON ts_v2025_content_items (published, featured, sort_order, published_at DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS ts_v2025_content_items_category_idx
  ON ts_v2025_content_items (category);

CREATE INDEX IF NOT EXISTS ts_v2025_content_items_sort_idx
  ON ts_v2025_content_items (sort_order, published_at DESC, created_at DESC);

ALTER TABLE ts_v2025_content_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Content items are viewable by everyone" ON ts_v2025_content_items;
CREATE POLICY "Content items are viewable by everyone" ON ts_v2025_content_items
FOR SELECT USING (
  published = true
  OR EXISTS (
    SELECT 1
    FROM ts_v2025_profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

DROP POLICY IF EXISTS "Admins can manage content items" ON ts_v2025_content_items;
DROP POLICY IF EXISTS "Admins can update content items" ON ts_v2025_content_items;
DROP POLICY IF EXISTS "Admins can delete content items" ON ts_v2025_content_items;

CREATE POLICY "Admins can manage content items" ON ts_v2025_content_items
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1
    FROM ts_v2025_profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can update content items" ON ts_v2025_content_items
FOR UPDATE USING (
  EXISTS (
    SELECT 1
    FROM ts_v2025_profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

CREATE POLICY "Admins can delete content items" ON ts_v2025_content_items
FOR DELETE USING (
  EXISTS (
    SELECT 1
    FROM ts_v2025_profiles p
    WHERE p.id = auth.uid()
      AND p.role = 'admin'
  )
);

CREATE OR REPLACE FUNCTION ts_v2025_touch_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS ts_v2025_content_items_touch_updated_at ON ts_v2025_content_items;
CREATE TRIGGER ts_v2025_content_items_touch_updated_at
BEFORE UPDATE ON ts_v2025_content_items
FOR EACH ROW
EXECUTE FUNCTION ts_v2025_touch_updated_at();

COMMIT;
