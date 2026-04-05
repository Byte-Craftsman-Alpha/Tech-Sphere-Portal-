import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';
import { applySql } from './apply-sql.js';
import pg from 'pg';
import dns from 'dns';
import { promises as dnsPromises } from 'dns';

// ---------------------------------------------------------
// 1. ENVIRONMENT LOADING
// ---------------------------------------------------------
const envPath = path.resolve(process.cwd(), '.env');
if (!fs.existsSync(envPath)) {
  console.error('Error: .env file is missing! Please create it from .env.example');
  process.exit(1);
}

const envContent = fs.readFileSync(envPath, 'utf8');
const env: any = {};
envContent.split('\n').forEach(line => {
  const [key, ...value] = line.trim().split('=');
  if (key && !key.startsWith('#') && value.length > 0) {
    env[key.trim()] = value.join('=').trim().replace(/^["']|["']$/g, '');
  }
});

const supabaseUrl = env.VITE_SUPABASE_URL || '';
const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY || '';
const databaseUrl = env.DATABASE_URL || '';
const poolerUrl = env.DATABASE_POOLER_URL || '';

if (!supabaseUrl || !serviceKey) {
  console.error('Error: Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { Client } = pg;

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function parseDbUrl(urlString: string) {
  const url = new URL(urlString);
  return {
    host: url.hostname,
    port: Number(url.port || 5432),
    database: url.pathname.replace(/^\//, '') || 'postgres',
    user: decodeURIComponent(url.username),
    password: decodeURIComponent(url.password)
  };
}

async function resolveHost(host: string) {
  dns.setServers(['1.1.1.1', '8.8.8.8']);
  try {
    const v4 = await dnsPromises.resolve4(host);
    if (v4?.length) return { address: v4[0], family: 4 };
  } catch {}
  try {
    const v6 = await dnsPromises.resolve6(host);
    if (v6?.length) return { address: v6[0], family: 6 };
  } catch {}
  return null;
}

async function connectWithFallback(primaryUrl: string, secondaryUrl?: string) {
  try {
    const client = new Client({
      connectionString: primaryUrl,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    return client;
  } catch (err: any) {
    if (err?.code === 'ENETUNREACH' && secondaryUrl) {
      const client = new Client({
        connectionString: secondaryUrl,
        ssl: { rejectUnauthorized: false }
      });
      await client.connect();
      return client;
    }
    if (err?.code !== 'ENOTFOUND') throw err;

    const parsed = parseDbUrl(primaryUrl);
    const resolved = await resolveHost(parsed.host);
    if (!resolved) throw err;

    const client = new Client({
      host: resolved.address,
      port: parsed.port,
      user: parsed.user,
      password: parsed.password,
      database: parsed.database,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    return client;
  }
}

// ---------------------------------------------------------
// 2. INITIALIZATION LOGIC
// ---------------------------------------------------------
async function runSetup() {
  console.log('\n--- TECHSPHERE V2: ONE-CLICK SETUP ---');

  // A. Auto-apply SQL Schema if DATABASE_URL is provided
  console.log('\nStep 1: Initializing Database Schema...');
  if (databaseUrl) {
    const sqlApplied = await applySql(databaseUrl);
    if (!sqlApplied) {
      console.warn('SQL auto-apply failed. Checking if tables exist anyway...');
    }
  } else {
    console.warn('DATABASE_URL not set. Skipping auto SQL apply.');
    console.log('Add DATABASE_URL to your .env to enable fully automated setup.');
  }

  // B. Verify Tables (Supabase API may lag while cache refreshes)
  let tableOk = false;
  let lastTableError: any = null;
  for (let i = 0; i < 5; i += 1) {
    const { error: tableError } = await supabase.from('ts_v2025_profiles').select('id').limit(1);
    if (!tableError) {
      tableOk = true;
      break;
    }
    lastTableError = tableError;
    const msg = String(tableError.message || '');
    if (msg.includes('schema cache') || msg.includes('relation')) {
      await sleep(1500 * (i + 1));
      continue;
    }
    break;
  }

  if (!tableOk && databaseUrl) {
    try {
      const client = await connectWithFallback(databaseUrl, poolerUrl || undefined);
      const result = await client.query(`select to_regclass('public.ts_v2025_profiles') as name`);
      const exists = result.rows?.[0]?.name;
      await client.end();
      if (exists) {
        tableOk = true;
        console.warn('Supabase schema cache is still warming up. Continuing...');
      }
    } catch (err: any) {
      console.warn('Direct DB check failed:', err.message);
    }
  }

  if (!tableOk) {
    console.error('Tables still missing after setup attempt!');
    console.log('Please manually run full_db_setup.sql in your Supabase SQL Editor:');
    console.log('https://supabase.com/dashboard/project/_/sql/new\n');
    if (lastTableError) {
      console.log('Last error:', lastTableError.message || lastTableError);
    }
    return;
  }

  console.log('Database tables verified!');

  // C. Create Default Admin
  console.log('\nStep 2: Setting up Default Admin...');
  const adminEmail = env.ADMIN_EMAIL || 'admin@techsphere.com';
  const adminPass = env.ADMIN_PASSWORD || 'admin123';

  const { error: authError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPass,
    email_confirm: true,
    user_metadata: { full_name: 'Admin' }
  });

  if (authError) {
    if (authError.message.includes('already registered')) {
      console.log(`Admin (${adminEmail}) already exists.`);
    } else {
      console.error('Auth Error:', authError.message);
    }
  } else {
    console.log(`Admin (${adminEmail}) registered successfully.`);
  }

  // D. Sync Admin Profile
  const { data: listData } = await supabase.auth.admin.listUsers();
  const adminId = listData?.users.find(u => u.email === adminEmail)?.id;

  if (adminId) {
    const { error: profError } = await supabase
      .from('ts_v2025_profiles')
      .upsert({ id: adminId, email: adminEmail, role: 'admin', full_name: 'Admin' });

    if (profError) {
      const msg = String(profError.message || '');
      if ((msg.includes('schema cache') || msg.includes('permission denied')) && databaseUrl) {
        try {
          const client = await connectWithFallback(databaseUrl, poolerUrl || undefined);
          await client.query(
            `insert into ts_v2025_profiles (id, email, role, full_name)
             values ($1, $2, $3, $4)
             on conflict (id) do update
             set email = excluded.email, role = excluded.role, full_name = excluded.full_name`,
            [adminId, adminEmail, 'admin', 'Admin']
          );
          await client.end();
          console.warn('Admin profile synced via direct DB (RLS bypass).');
        } catch (err: any) {
          console.error('Profile Error:', err.message);
        }
      } else {
        console.error('Profile Error:', profError.message);
      }
    } else {
      console.log('Admin profile synchronized.');
    }
  }

  console.log('\n--- SETUP COMPLETE ---');
  console.log('1. Run: npm run fullstack');
  console.log('2. Log in with your admin credentials.');
  console.log('-------------------------------------------\n');
}

runSetup();
