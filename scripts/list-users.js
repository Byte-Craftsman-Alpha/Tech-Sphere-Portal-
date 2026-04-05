import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error('Error: VITE_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function listUsers() {
  const { data: { users }, error } = await supabase.auth.admin.listUsers();
  if (error) throw error;
  console.log('--- Current Supabase Auth Users ---');
  users.forEach(u => console.log(`- ${u.email} (${u.id})`));
}

listUsers().catch(err => console.error(err.message));
