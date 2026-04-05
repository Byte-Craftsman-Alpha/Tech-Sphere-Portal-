-- SQL to add the missing 'points' column to the profiles table
-- Run this in your Supabase SQL Editor:
-- https://supabase.com/dashboard/project/zountfufskkcslcmrqlp/sql/new

ALTER TABLE ts_v2025_profiles 
ADD COLUMN IF NOT EXISTS points INTEGER DEFAULT 0;

-- Also ensuring other Prisma-synced columns exist if they were missing:
ALTER TABLE ts_v2025_profiles ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE ts_v2025_profiles ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE ts_v2025_profiles ADD COLUMN IF NOT EXISTS semester TEXT;
ALTER TABLE ts_v2025_profiles ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'user';
