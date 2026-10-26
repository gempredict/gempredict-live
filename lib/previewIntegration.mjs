// Private Preview preflight. Only same-origin GETs to the existing prediction
// method guard are used; no card scan, database write or provider call occurs.
import { internalMarketContext } from './internalMarketAuth.mjs';
import { resolveMarketBaseUrl } from './internalMarketRouting.mjs';
import { verifyRuntimeCatalogAssets } from './runtimeCatalogAssets.mjs';
export const isVercelPreview = env => env.VERCEL === '1' && env.VERCEL_ENV === 'preview';
export async function verifyPreviewIntegration({ env = process.env, requestHeaders = {}, fetchImpl = globalThis.fetch, verifyAssets = verifyRuntimeCatalogAssets } = {}) {
  const checks = { routing: false, protection: false, catalogSnapshot: false, catalogLicense: false };
  if (!isVercelPreview(env)) return { integrationReady: false, checks };
  const origin = resolveMarketBaseUrl(env.NEXT_PUBLIC_SITE_URL, env);
  checks.routing = origin.ok;
  const context = internalMarketContext(env.NEXT_PUBLIC_SITE_URL, env, requestHeaders);
  const assets = await verifyAssets();
  checks.catalogSnapshot = assets?.snapshot === true;
  checks.catalogLicense = assets?.license === true;
  if (!context.ok || !checks.catalogSnapshot || !checks.catalogLicense) return { integrationReady: false, checks };
  try {
    const url = `${context.baseUrl}/api/predict`;
    const signal = AbortSignal.timeout(5000);
    const [anonymous, authenticated] = await Promise.all([
      fetchImpl(url, { method: 'GET', signal, redirect: 'manual', cache: 'no-store' }),
      fetchImpl(url, { method: 'GET', signal, redirect: 'manual', cache: 'no-store', headers: context.headers }),
    ]);
    // Anonymous access must be stopped by protection. Authenticated access must
    // reach the existing no-scan method guard. Never follow either redirect.
    const protectedStatus = [401, 403, 302, 303, 307, 308].includes(anonymous.status);
    if (protectedStatus && authenticated.status === 405) {
      const body = await authenticated.json();
      checks.protection = body?.error === 'Method not allowed.';
    }
  } catch { /* Never return token-bearing exceptions, HTML or response headers. */ }
  return { integrationReady: Object.values(checks).every(Boolean), checks };
}
