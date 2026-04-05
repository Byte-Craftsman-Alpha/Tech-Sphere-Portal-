import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Manually load .env since dotenv isn't available
const envPath = path.resolve(process.cwd(), '.env');
const envContent = fs.readFileSync(envPath, 'utf8');
const env: any = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.split('=');
  if (key && value.length > 0) {
    env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || '';
const supabaseServiceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const ADMIN_EMAIL = 'admin@techsphere.com';
const ADMIN_PASS = 'admin123';

async function createAdmin() {
  console.log(`🚀 Creating/Resetting Admin: ${ADMIN_EMAIL}...`);

  // 1. Create or Reset the user in Auth
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: ADMIN_EMAIL,
    password: ADMIN_PASS,
    email_confirm: true,
    user_metadata: { full_name: 'System Administrator' }
  });

  if (authError && !authError.message.includes('already registered')) {
    console.error('❌ Error creating auth user:', authError.message);
    return;
  }
  
  if (authError?.message.includes('already registered')) {
    console.log('✅ Auth user already exists. Proceeding to profile sync...');
  }

  // 2. Fetch the user again to get ID
  const { data: listData } = await supabase.auth.admin.listUsers();
  const adminUser = listData?.users.find(u => u.email === ADMIN_EMAIL);

  if (!adminUser) {
    console.error('❌ Could not find admin user after creation.');
    return;
  }

  // 3. Upsert into Profiles table
  const { error: profileError } = await supabase
    .from('ts_v2025_profiles')
    .upsert({
      id: adminUser.id,
      email: ADMIN_EMAIL,
      full_name: 'Admin',
      role: 'admin',
      points: 9999
    }, { onConflict: 'id' });

  if (profileError) {
    console.error('❌ Error syncing profile:', profileError.message);
    if (profileError.message.includes('relation "ts_v2025_profiles" does not exist')) {
      console.log('💡 TIP: Run the full_db_setup.sql script in Supabase SQL Editor first!');
    }
  } else {
    console.log('🌟 Admin profile synced successfully!');
    console.log('\n✅ Setup Complete! You can now log in with:');
    console.log(`📧 Email: ${ADMIN_EMAIL}`);
    console.log(`🔑 Pass: ${ADMIN_PASS}`);
  }
}

createAdmin();
