-- 🔄 AUTOMATIC PROFILE SYNC TRIGGER
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/slpfkzezumbjbfwzgjyy/sql/new

-- 1. Create the sync function
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.ts_v2025_profiles (id, email, full_name, role)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'full_name', 'TechSphere User'),
    'user'
  )
  ON CONFLICT (id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Create the trigger on Auth.users
-- This ensures every new signup (Google OR Email) gets a profile row automatically!
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 3. Backfill Current User(s)
-- This fixes any users (like your current one) that already exist but have no profile.
INSERT INTO public.ts_v2025_profiles (id, email, full_name, role)
SELECT id, email, COALESCE(raw_user_meta_data->>'full_name', 'Registered User'), 'user'
FROM auth.users
ON CONFLICT (id) DO NOTHING;
