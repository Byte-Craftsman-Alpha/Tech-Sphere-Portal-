function hasValue(value) {
  return Boolean(value && String(value).trim().length > 0);
}

function masked(value) {
  if (!hasValue(value)) return null;
  const str = String(value);
  if (str.length <= 8) return '***';
  return `${str.slice(0, 4)}***${str.slice(-4)}`;
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });

  const summary = {
    supabase: {
      url_set: hasValue(process.env.VITE_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL),
      service_role_set: hasValue(process.env.SUPABASE_SERVICE_ROLE_KEY)
    },
    database: {
      url_set: hasValue(process.env.DATABASE_URL)
    },
    google_oauth: {
      client_id_set: hasValue(process.env.VITE_GOOGLE_CLIENT_ID),
      auth_proxy_set: hasValue(process.env.VITE_GOOGLE_AUTH_PROXY)
    },
    smtp: {
      host_set: hasValue(process.env.SMTP_HOST),
      port_set: hasValue(process.env.SMTP_PORT),
      user_set: hasValue(process.env.SMTP_USER),
      pass_set: hasValue(process.env.SMTP_PASS),
      from_set: hasValue(process.env.SMTP_FROM)
    },
    admin: {
      auto_create: String(process.env.AUTO_CREATE_ADMIN || '').toLowerCase() === 'true',
      email: hasValue(process.env.ADMIN_EMAIL) ? process.env.ADMIN_EMAIL : null,
      password: masked(process.env.ADMIN_PASSWORD)
    }
  };

  return res.status(200).json({
    ok: true,
    summary,
    time: new Date().toISOString()
  });
}
