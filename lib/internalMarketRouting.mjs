const PRODUCTION_HOST = 'gempredict-live.vercel.app';

// Server configuration only. Never infer authorization from NODE_ENV, a request
// Host header, or the configured URL itself: local next start uses production too.
export function resolveMarketBaseUrl(value, env = {}) {
  const preview = env.VERCEL_ENV === 'preview';
  let expected;
  if (preview) {
    // VERCEL_URL is the platform's immutable deployment hostname. Neither
    // request headers nor moving aliases can supply the trust anchor.
    const hostname = env.VERCEL_URL;
    try {
      const configured = new URL(value);
      const h = configured.hostname.toLowerCase().replace(/\.+$/, '');
      if (h === PRODUCTION_HOST || h.endsWith(`.${PRODUCTION_HOST}`)) return { ok: false, reason: 'production_host_blocked' };
    } catch {}
    if (env.VERCEL !== '1' || typeof hostname !== 'string' ||
        !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.vercel\.app$/i.test(hostname) ||
        [env.VERCEL_BRANCH_URL, env.VERCEL_PROJECT_PRODUCTION_URL, PRODUCTION_HOST].filter(Boolean).some(alias => alias.toLowerCase() === hostname.toLowerCase())) {
      return { ok: false, reason: 'missing_or_invalid_deployment_origin' };
    }
    expected = `https://${hostname.toLowerCase()}`;
    // An absent legacy public origin is allowed only because the mandatory
    // trusted deployment origin supplies routing. An explicit mismatch fails.
    if (value == null || value === '') value = expected;
  }
  if (typeof value !== 'string' || !value.trim()) return { ok: false, reason: 'missing_internal_base_url' };
  let url;
  try { url = new URL(value.trim()); }
  catch { return { ok: false, reason: 'invalid_internal_base_url' }; }
  if (!['http:', 'https:'].includes(url.protocol) || !url.hostname || url.username || url.password ||
      url.pathname !== '/' || url.search || url.hash) return { ok: false, reason: 'invalid_internal_base_url' };

  const host = url.hostname.toLowerCase().replace(/\.+$/, '');
  const productionHost = host === PRODUCTION_HOST || host.endsWith(`.${PRODUCTION_HOST}`);
  if (productionHost) {
    const authorized = env.NODE_ENV === 'production' && env.VERCEL === '1' && env.VERCEL_ENV === 'production' &&
      env.GEMPREDICT_ALLOW_PRODUCTION_MARKET_ROUTING === 'true' && url.protocol === 'https:' && !url.port;
    if (!authorized) return { ok: false, reason: 'production_host_blocked' };
  }
  url.hostname = host;
  if (preview && url.origin !== expected) return { ok: false, reason: 'mismatched_deployment_origin' };
  return { ok: true, baseUrl: url.origin };
}
