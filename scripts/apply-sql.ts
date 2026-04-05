import pg from 'pg';
const { Client } = pg;
import * as fs from 'fs';
import * as path from 'path';
import dns from 'dns';
import { promises as dnsPromises } from 'dns';

function parseDbUrl(databaseUrl: string) {
  const url = new URL(databaseUrl);
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

async function connectWithFallback(databaseUrl: string) {
  try {
    const client = new Client({
      connectionString: databaseUrl,
      ssl: { rejectUnauthorized: false }
    });
    await client.connect();
    return client;
  } catch (err: any) {
    if (err?.code !== 'ENOTFOUND') throw err;

    const parsed = parseDbUrl(databaseUrl);
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

export async function applySql(databaseUrl: string) {
  if (!databaseUrl) {
    console.error('❌ Error: DATABASE_URL is required for automated SQL setup.');
    return false;
  }

  let client: pg.Client | null = null;
  try {
    console.log('📡 Connecting to database for schema initialization...');
    try {
      client = await connectWithFallback(databaseUrl);
    } catch (err: any) {
      if (err?.code === 'ENETUNREACH' && process.env.DATABASE_POOLER_URL) {
        console.warn('⚠️  IPv6 unreachable. Retrying with DATABASE_POOLER_URL...');
        client = await connectWithFallback(process.env.DATABASE_POOLER_URL);
      } else {
        throw err;
      }
    }

    // 1. Load SQL files
    const sqlDir = process.cwd();
    let setupSql = fs.readFileSync(path.join(sqlDir, 'full_db_setup.sql'), 'utf8');
    
    // 2. Execute SQL
    console.log('📜 Applying database schema (tables, RLS, triggers)...');
    
    // Remove known duplicate-policy errors by dropping problematic policies pre-run.
    // Guard with to_regclass so brand-new DBs don't error.
    const prelude = `
      do $$
      begin
        if to_regclass('public.ts_v2025_events') is not null then
          drop policy if exists "Admins can manage events" on ts_v2025_events;
          drop policy if exists "Admins can update events" on ts_v2025_events;
          drop policy if exists "Admins can delete events" on ts_v2025_events;
        end if;
      end $$;
    `;
    setupSql = prelude + '\n' + setupSql;

    await client.query(setupSql);
    
    console.log('✅ Database schema applied successfully!');
    return true;
  } catch (err) {
    console.error('❌ SQL Execution Error:', (err as Error).message);
    return false;
  } finally {
    if (client) {
      try { await client.end(); } catch {}
    }
  }
}
