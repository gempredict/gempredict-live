import Anthropic from '@anthropic-ai/sdk';
import { HttpsProxyAgent } from 'https-proxy-agent';

// Server-only: keep credentials and proxy placeholders out of browser bundles.
export function createAnthropicClient(env = process.env, dependencies = {}) {
  const Client = dependencies.Anthropic ?? Anthropic;
  const ProxyAgent = dependencies.HttpsProxyAgent ?? HttpsProxyAgent;
  const development = env.NODE_ENV === 'development';
  const apiKey = env.CLAUDE_API_KEY || (development ? env.Claude_API_Key : undefined);
  if (!apiKey) return null;

  const options = { apiKey };
  // Preserve production transport. Node inherits NODE_EXTRA_CA_CERTS; do not
  // override its trust store or disable certificate verification.
  const proxy = development && (
    env.HTTPS_PROXY || env.https_proxy || env.HTTP_PROXY || env.http_proxy
  );
  if (proxy) options.httpAgent = new ProxyAgent(proxy);
  return new Client(options);
}
