const PRODUCTION_HOST = 'gempredict-live.vercel.app';

// Server configuration only. Never infer authorization from NODE_ENV, a request
// Host header, or the configured URL itself: local next start uses production too.
export function resolveMarketBaseUrl(value, env = {}) {
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
  return { ok: true, baseUrl: url.origin };
}
