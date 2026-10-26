// Server-only coarse configuration hints. JWT claims here are unverified hints,
// never authentication/authorization decisions. No key, claim or URL is returned.
export function supabaseConfigStatus(env = process.env) {
  const key = env.SUPABASE_SERVICE_ROLE_KEY;
  const url = env.NEXT_PUBLIC_SUPABASE_URL;
  let credentialClass = !key ? 'missing' : key.startsWith('sb_publishable_') ? 'publishable' : key.startsWith('sb_secret_') ? 'secret' : 'unrecognized';
  let projectBinding = 'unverified';
  if (key && key.split('.').length === 3) {
    try {
      const claims = JSON.parse(Buffer.from(key.split('.')[1], 'base64url').toString('utf8'));
      credentialClass = claims.role === 'service_role' ? 'legacy_service_role' : ['anon', 'authenticated'].includes(claims.role) ? 'non_service_role' : 'unrecognized';
      if (typeof claims.ref === 'string' && url) projectBinding = new URL(url).hostname === `${claims.ref}.supabase.co` ? 'matches' : 'mismatch';
    } catch {}
  }
  return { urlPresent: Boolean(url), keyPresent: Boolean(key), credentialClass, projectBinding };
}
export function loggingFailure(error, env = process.env) {
  return { operation: 'prediction_logs_insert', environment: ['preview', 'production'].includes(env.VERCEL_ENV) ? env.VERCEL_ENV : 'development', outcome: String(error?.code) === '42501' ? 'authorization_denied' : 'logging_unavailable', ...supabaseConfigStatus(env) };
}
