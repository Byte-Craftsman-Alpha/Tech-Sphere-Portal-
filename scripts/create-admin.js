import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createAdmin(email, password, fullName) {
  console.log(`Attempting to create admin user: ${email}...`);

  // 1. Create the user in Auth (bypassing rate limits and email confirmation)
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: { full_name: fullName }
  });

  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log('User already exists in Auth. Proceeding to update profile...');
      // Get the existing user
      const { data: { users } } = await supabase.auth.admin.listUsers();
      const existingUser = users.find(u => u.email === email);
      if (!existingUser) throw new Error('User supposedly exists but not found in list.');
      await updateProfile(existingUser.id, email, fullName);
    } else {
      throw authError;
    }
  } else {
    console.log('User created in Auth successfully.');
    await updateProfile(authData.user.id, email, fullName);
  }
}

async function updateProfile(id, email, fullName) {
  // 2. Insert/Update the profile with admin role
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({
      id,
      email,
      full_name: fullName,
      role: 'admin',
      branch: 'Admin',
      semester: 'N/A',
      roll_no: 'ADMIN-001'
    });

  if (profileError) throw profileError;
  console.log('Profile created/updated with ADMIN role successfully!');
}

const [,, email, password, name] = process.argv;

if (!email || !password || !name) {
  console.log('Usage: node scripts/create-admin.js <email> <password> <full_name>');
  process.exit(1);
}

createAdmin(email, password, name).catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
