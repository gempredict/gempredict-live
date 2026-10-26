// Server-only request context. Tokens are forwarded solely to a routing-validated
// same-deployment Preview origin, never returned in diagnostics or query strings.
import { resolveMarketBaseUrl } from './internalMarketRouting.mjs';
export const TRUSTED_OIDC_HEADER = 'x-vercel-trusted-oidc-idp-token';
export function internalMarketContext(value, env = {}, requestHeaders = {}) {
  const routing = resolveMarketBaseUrl(value, env);
  if (!routing.ok) return routing;
  if (env.VERCEL_ENV !== 'preview') return { ...routing, headers: {} };
  // Vercel supplies this header at runtime when OIDC Federation is enabled.
  // Vercel Deployment Protection verifies the token on the receiving request.
  const token = requestHeaders?.['x-vercel-oidc-token'];
  if (typeof token !== 'string' || token.length > 16384 || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)) {
    return { ok: false, reason: 'preview_protection_token_unavailable' };
  }
  return { ...routing, headers: { [TRUSTED_OIDC_HEADER]: token } };
}
