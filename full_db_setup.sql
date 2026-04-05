-- ☢️ FULL DATABASE INITIALIZATION FOR TECHSPHERE V2
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/slpfkzezumbjbfwzgjyy/sql/new

-- ----------------------------------------------------------------
-- 1. PROFILES TABLE (Core user data + XP Points)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ts_v2025_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE,
  full_name TEXT,
  roll_no TEXT,
  branch TEXT,
  semester TEXT,
  points INTEGER DEFAULT 0,
  role TEXT DEFAULT 'user',
  approved BOOLEAN DEFAULT false,
  avatar_url TEXT,
  github_url TEXT,
  linkedin_url TEXT,
  instagram TEXT,
  whatsapp TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 2. EVENTS TABLE (Events and Challenges)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ts_v2025_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT,
  date TIMESTAMPTZ NOT NULL,
  location TEXT,         -- Reused as 'Difficulty' for Challenges
  capacity INTEGER,       -- Reused as 'Points (XP)' for Challenges
  image_url TEXT,
  registration_link TEXT,
  type TEXT DEFAULT 'event', -- 'event' or 'challenge'
  is_open BOOLEAN DEFAULT true,
  has_passes BOOLEAN DEFAULT false,
  pass_settings JSONB DEFAULT '{"is_open": true, "qr_size": 25, "qr_x": 50, "qr_y": 50}'::jsonb,
  custom_form JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 3. REGISTRATIONS TABLE (Entry Passes)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ts_v2025_registrations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  event_id UUID REFERENCES ts_v2025_events(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'registered',
  qr_data TEXT UNIQUE,
  scan_count INTEGER DEFAULT 0,
  attended BOOLEAN DEFAULT false,
  attended_at TIMESTAMPTZ,
  form_responses JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------
-- 4. ROW LEVEL SECURITY (RLS) - Basic Setup
-- ----------------------------------------------------------------

-- Profiles: Users can view all profiles but edit only their own
ALTER TABLE ts_v2025_profiles ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- 5. OTPS FOR REGISTRATION
-- ----------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE IF NOT EXISTS ts_v2025_otps (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    email TEXT NOT NULL,
    code TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    expires_at TIMESTAMPTZ NOT NULL,
    UNIQUE(email)
);

-- RLS for OTPs (Strictly Service Role Only)
ALTER TABLE ts_v2025_otps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Service Role Only" ON ts_v2025_otps;
CREATE POLICY "Service Role Only" ON ts_v2025_otps FOR ALL TO service_role USING (true);

DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON ts_v2025_profiles;
CREATE POLICY "Public profiles are viewable by everyone" ON ts_v2025_profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON ts_v2025_profiles;
CREATE POLICY "Users can update their own profile" ON ts_v2025_profiles FOR UPDATE USING (auth.uid() = id);

DROP POLICY IF EXISTS "Admins can update any profile" ON ts_v2025_profiles;
CREATE POLICY "Admins can update any profile" ON ts_v2025_profiles
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM ts_v2025_profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

DROP POLICY IF EXISTS "Users can insert their own profile" ON ts_v2025_profiles;
CREATE POLICY "Users can insert their own profile" ON ts_v2025_profiles FOR INSERT WITH CHECK (auth.uid() = id);

-- Events: Everyone can view events
ALTER TABLE ts_v2025_events ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Events are viewable by everyone" ON ts_v2025_events;
CREATE POLICY "Events are viewable by everyone" ON ts_v2025_events FOR SELECT USING (true);

DROP POLICY IF EXISTS "Admins can manage events" ON ts_v2025_events;
CREATE POLICY "Admins can manage events" ON ts_v2025_events
FOR INSERT WITH CHECK (
  EXISTS (SELECT 1 FROM ts_v2025_profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "Admins can update events" ON ts_v2025_events
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM ts_v2025_profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);
CREATE POLICY "Admins can delete events" ON ts_v2025_events
FOR DELETE USING (
  EXISTS (SELECT 1 FROM ts_v2025_profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- Registrations: Users see only their own registrations
ALTER TABLE ts_v2025_registrations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view their own registrations" ON ts_v2025_registrations;
CREATE POLICY "Users can view their own registrations" ON ts_v2025_registrations FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can view all registrations" ON ts_v2025_registrations;
CREATE POLICY "Admins can view all registrations" ON ts_v2025_registrations
FOR SELECT USING (
  EXISTS (SELECT 1 FROM ts_v2025_profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

DROP POLICY IF EXISTS "Users can register themselves" ON ts_v2025_registrations;
CREATE POLICY "Users can register themselves" ON ts_v2025_registrations FOR INSERT WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can edit their own registration" ON ts_v2025_registrations;
CREATE POLICY "Users can edit their own registration" ON ts_v2025_registrations FOR UPDATE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can update registrations" ON ts_v2025_registrations;
CREATE POLICY "Admins can update registrations" ON ts_v2025_registrations
FOR UPDATE USING (
  EXISTS (SELECT 1 FROM ts_v2025_profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

DROP POLICY IF EXISTS "Users can unregister themselves" ON ts_v2025_registrations;
CREATE POLICY "Users can unregister themselves" ON ts_v2025_registrations FOR DELETE USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins can delete registrations" ON ts_v2025_registrations;
CREATE POLICY "Admins can delete registrations" ON ts_v2025_registrations
FOR DELETE USING (
  EXISTS (SELECT 1 FROM ts_v2025_profiles p WHERE p.id = auth.uid() AND p.role = 'admin')
);

-- ----------------------------------------------------------------
-- 6. SUBMISSIONS TABLE (For Hackathons/Challenges)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ts_v2025_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES ts_v2025_events(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  project_url TEXT,
  github_url TEXT,
  demo_url TEXT,
  description TEXT,
  tech_stack TEXT[],
  score INTEGER,
  feedback TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id, user_id)
);

ALTER TABLE ts_v2025_submissions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Users can view all submissions" ON ts_v2025_submissions;
CREATE POLICY "Users can view all submissions" ON ts_v2025_submissions FOR SELECT USING (true);
DROP POLICY IF EXISTS "Users can submit their own" ON ts_v2025_submissions;
CREATE POLICY "Users can submit their own" ON ts_v2025_submissions FOR INSERT WITH CHECK (auth.uid() = user_id);
DROP POLICY IF EXISTS "Users can update their own submissions" ON ts_v2025_submissions;
CREATE POLICY "Users can update their own submissions" ON ts_v2025_submissions FOR UPDATE USING (auth.uid() = user_id);

-- ----------------------------------------------------------------
-- 6b. PUBLIC SHARE LINKS (View-only registration sharing)
-- ----------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ts_v2025_registration_shares (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID REFERENCES ts_v2025_events(id) ON DELETE CASCADE,
  token TEXT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(event_id)
);

ALTER TABLE ts_v2025_registration_shares ENABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------
-- 7. SAFE COLUMN BACKFILL (FOR EXISTING DATABASES)
-- ----------------------------------------------------------------
ALTER TABLE ts_v2025_profiles ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE ts_v2025_profiles ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE ts_v2025_profiles ADD COLUMN IF NOT EXISTS roll_no TEXT;
ALTER TABLE ts_v2025_profiles ADD COLUMN IF NOT EXISTS approved BOOLEAN DEFAULT false;
ALTER TABLE ts_v2025_events ADD COLUMN IF NOT EXISTS registration_link TEXT;
ALTER TABLE ts_v2025_events ADD COLUMN IF NOT EXISTS is_open BOOLEAN DEFAULT true;
ALTER TABLE ts_v2025_events ADD COLUMN IF NOT EXISTS has_passes BOOLEAN DEFAULT false;
ALTER TABLE ts_v2025_events ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE ts_v2025_registrations ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE ts_v2025_registrations ADD COLUMN IF NOT EXISTS attended BOOLEAN DEFAULT false;
ALTER TABLE ts_v2025_registrations ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ;
ALTER TABLE ts_v2025_registration_shares ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE ts_v2025_registration_shares ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
