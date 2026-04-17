import http from 'http';
import { parse } from 'url';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';
import pg from 'pg';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const API_DIR = path.join(__dirname, '..', 'api_handlers');
const SQL_PATH = path.join(__dirname, '..', 'full_db_setup.sql');
const REQUIRED_TABLE = 'ts_v2025_profiles';
const REQUIRED_COLUMNS = [
  'email',
  'full_name',
  'branch',
  'semester',
  'points',
  'role',
  'avatar_url',
  'github_url',
  'linkedin_url',
  'instagram',
  'whatsapp'
];
const HEALTH_RATE = {
  windowMs: 60_000,
  max: 20
};

const { Client } = pg;
const initState = { started: false, done: false };
const adminState = { started: false, done: false };
const healthLimiter = new Map();

// Environment Check
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error('\nAPI ERROR: Supabase environment variables are missing!');
  console.error('Please ensure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are set in your .env file.\n');
} else {
  console.log('Environment variables loaded successfully.');
}

function shouldAutoCreateAdmin() {
  return String(process.env.AUTO_CREATE_ADMIN || '').toLowerCase() === 'true';
}

function shouldProtectHealth() {
  return String(process.env.HEALTH_PROTECT || '').toLowerCase() === 'true';
}

function isHealthAuthValid(req) {
  const configuredToken = process.env.HEALTH_TOKEN;
  if (!configuredToken) return true;
  const header = req.headers['authorization'];
  if (!header || typeof header !== 'string') return false;
  const token = header.startsWith('Bearer ') ? header.slice(7) : header;
  return token === configuredToken;
}

function checkRateLimit(req) {
  const now = Date.now();
  const key = req.socket?.remoteAddress || 'unknown';
  const entry = healthLimiter.get(key) || { count: 0, resetAt: now + HEALTH_RATE.windowMs };
  if (now > entry.resetAt) {
    entry.count = 0;
    entry.resetAt = now + HEALTH_RATE.windowMs;
  }
  entry.count += 1;
  healthLimiter.set(key, entry);
  if (entry.count > HEALTH_RATE.max) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }
  return { allowed: true };
}

async function ensureDatabaseInitialized() {
  if (initState.done || initState.started) return;
  initState.started = true;
  console.log('[DB Init] Starting database initialization checks...');

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const databaseUrl = process.env.DATABASE_URL;

  if (!supabaseUrl || !serviceKey) {
    console.warn('[DB Init] Missing Supabase URL or Service Role key. Skipping auto-init.');
    initState.done = true;
    return;
  }

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  const { error: precheckError } = await supabase.from(REQUIRED_TABLE).select('id').limit(1);
  const tableMissing =
    precheckError &&
    typeof precheckError.message === 'string' &&
    /relation .* does not exist/i.test(precheckError.message);

  if (precheckError && !tableMissing) {
    console.warn('[DB Init] Precheck failed:', precheckError.message);
    initState.done = true;
    return;
  }

  if (!databaseUrl) {
    console.warn('[DB Init] DATABASE_URL not set. Cannot auto-apply SQL.');
    initState.done = true;
    return;
  }

  if (!fs.existsSync(SQL_PATH)) {
    console.error(`[DB Init] Missing SQL file: ${SQL_PATH}`);
    initState.done = true;
    return;
  }

  let shouldApply = tableMissing;
  try {
    if (!tableMissing) {
      const client = new Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
      });
      await client.connect();
      const colResult = await client.query(
        `select column_name from information_schema.columns where table_schema = 'public' and table_name = $1`,
        [REQUIRED_TABLE]
      );
      const existing = new Set(colResult.rows.map(r => r.column_name));
      const missingCols = REQUIRED_COLUMNS.filter(c => !existing.has(c));
      if (missingCols.length > 0) {
        console.warn('[DB Init] Missing columns:', missingCols.join(', '));
        shouldApply = true;
      }
      await client.end();
    }
  } catch (err) {
    console.warn('[DB Init] Column check failed:', err.message);
  }

  if (shouldApply) {
    try {
      console.log('[DB Init] Applying schema from full_db_setup.sql ...');
      const client = new Client({
        connectionString: databaseUrl,
        ssl: { rejectUnauthorized: false }
      });
      await client.connect();
      const setupSql = fs.readFileSync(SQL_PATH, 'utf8');
      await client.query(setupSql);
      await client.end();
      console.log('[DB Init] Schema applied successfully.');
    } catch (err) {
      console.error('[DB Init] Schema apply failed:', err.message);
      initState.done = true;
      return;
    }
  } else {
    console.log('[DB Init] Database schema already present.');
  }

  const { error: verifyError } = await supabase.from(REQUIRED_TABLE).select('id').limit(1);
  if (verifyError) {
    console.warn('[DB Init] Verification failed:', verifyError.message);
  } else {
    console.log('[DB Init] Database verified.');
  }

  initState.done = true;
}

async function ensureDefaultAdmin() {
  if (adminState.done || adminState.started) return;
  adminState.started = true;

  if (!shouldAutoCreateAdmin()) {
    adminState.done = true;
    return;
  }

  const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceKey) {
    console.warn('[Admin Init] Missing Supabase URL or Service Role key. Skipping admin auto-create.');
    adminState.done = true;
    return;
  }

  const adminEmail = process.env.ADMIN_EMAIL || 'admin@techsphere.com';
  const adminPass = process.env.ADMIN_PASSWORD || 'admin123';

  const supabase = createClient(supabaseUrl, serviceKey, {
    auth: { autoRefreshToken: false, persistSession: false }
  });

  console.log(`[Admin Init] Ensuring admin user: ${adminEmail}`);
  const { error: authError } = await supabase.auth.admin.createUser({
    email: adminEmail,
    password: adminPass,
    email_confirm: true,
    user_metadata: { full_name: 'Admin' }
  });

  if (authError && !authError.message.includes('already registered')) {
    console.warn('[Admin Init] Auth error:', authError.message);
    adminState.done = true;
    return;
  }

  const { data: listData } = await supabase.auth.admin.listUsers();
  const adminId = listData?.users.find(u => u.email === adminEmail)?.id;

  if (adminId) {
    const { error: profError } = await supabase
      .from('ts_v2025_profiles')
      .upsert({ id: adminId, email: adminEmail, role: 'admin', full_name: 'Admin' });

    if (profError) {
      console.warn('[Admin Init] Profile sync error:', profError.message);
    } else {
      console.log('[Admin Init] Admin profile synchronized.');
    }
  } else {
    console.warn('[Admin Init] Could not resolve admin user id.');
  }

  adminState.done = true;
}

const server = http.createServer(async (req, res) => {
  // Fix for proxy rewrites that might leave a trailing slash or leading /api
  const parsedUrl = parse(req.url, true);
  let pathname = parsedUrl.pathname || '/';
  
  // Normalize pathname: ensure it starts with / and remove /api if present 
  // (redundant due to proxy rewrite but safer for manual testing)
  if (pathname.startsWith('/api')) {
    pathname = pathname.replace(/^\/api/, '');
  }
  if (pathname === '/' || pathname === '') pathname = '/index';

  if (pathname === '/health' && shouldProtectHealth()) {
    const rateResult = checkRateLimit(req);
    if (!rateResult.allowed) {
      res.statusCode = 429;
      res.setHeader('Retry-After', Math.ceil(rateResult.retryAfterMs / 1000));
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Rate limit exceeded' }));
    }
    if (!isHealthAuthValid(req)) {
      res.statusCode = 401;
      res.setHeader('Content-Type', 'application/json');
      return res.end(JSON.stringify({ error: 'Unauthorized' }));
    }
  }

  // Find the file: handle both /send-otp and /send-otp.js patterns
  const scriptName = pathname.endsWith('.js') ? pathname : `${pathname}.js`;
  const filePath = path.join(API_DIR, scriptName);

  console.log(`\n[API] ${req.method} ${pathname} -> ${filePath}`);

  // Set default CORS for local dev
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
    try {
      await ensureDatabaseInitialized();
      await ensureDefaultAdmin();

      // 1. Process Body (only for non-safe methods)
      let bodyData = {};
      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        const rawBody = await new Promise((resolve) => {
          let chunks = '';
          req.on('data', chunk => { chunks += chunk.toString(); });
          req.on('end', () => resolve(chunks));
        });
        try {
          bodyData = rawBody ? JSON.parse(rawBody) : {};
        } catch (e) {
          console.error('[API] Body parsing failed:', e.message);
          bodyData = {};
        }
      }

      // 2. Load the serverless function
      const module = await import(`file://${filePath}?t=${Date.now()}`); // cache busting
      const handler = module.default;

      // 3. Mock Vercel req/res objects
      const vercelReq = Object.assign(req, {
        query: parsedUrl.query,
        body: bodyData
      });

      const vercelRes = Object.assign(res, {
        status: (code) => {
          res.statusCode = code;
          return vercelRes;
        },
        json: (data) => {
          if (!res.writableEnded) {
            res.setHeader('Content-Type', 'application/json');
            res.end(JSON.stringify(data || {}));
          }
          return vercelRes;
        },
        send: (data) => {
          if (!res.writableEnded) {
            res.end(typeof data === 'object' ? JSON.stringify(data) : data);
          }
          return vercelRes;
        }
      });

      // 4. Exec handler
      await handler(vercelReq, vercelRes);

      // 5. Final fallback for handlers that don't call res.end()
      if (!res.writableEnded) {
        res.end();
      }
    } catch (err) {
      console.error('[API Handler Error]', err);
      if (!res.writableEnded) {
        res.statusCode = 500;
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify({ error: err.message, stack: err.stack }));
      }
    }
  } else {
    console.warn(`[API] 404: ${filePath} not found`);
    res.statusCode = 404;
    res.setHeader('Content-Type', 'application/json');
    res.end(JSON.stringify({ error: `Route ${pathname} not found in api/ folder` }));
  }
});

console.log('[Server] Boot sequence starting...');
await ensureDatabaseInitialized();
await ensureDefaultAdmin();
console.log('[Server] Boot sequence complete.');

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\nLocal API Server running at http://127.0.0.1:${PORT}`);
  console.log(`Serving folder: ${API_DIR}\n`);
});
