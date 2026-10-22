import test from 'node:test';
import assert from 'node:assert/strict';
import { HttpsProxyAgent } from 'https-proxy-agent';
import { createAnthropicClient } from '../lib/anthropicClient.mjs';

class MockAnthropic {
  constructor(options) { this.options = options; }
}
class MockProxyAgent {
  constructor(proxy) { this.proxy = proxy; }
}
const mocks = { Anthropic: MockAnthropic, HttpsProxyAgent: MockProxyAgent };
const create = env => createAnthropicClient(env, mocks);

test('canonical credential takes precedence over development fallback', () => {
  assert.equal(create({ NODE_ENV: 'development', CLAUDE_API_KEY: 'canonical-test', Claude_API_Key: 'fallback-test' }).options.apiKey, 'canonical-test');
});

test('fallback is accepted only in development, including an empty canonical credential', () => {
  assert.equal(create({ NODE_ENV: 'development', CLAUDE_API_KEY: '', Claude_API_Key: 'placeholder-test' }).options.apiKey, 'placeholder-test');
  for (const NODE_ENV of ['production', 'test', undefined]) {
    assert.equal(create({ NODE_ENV, Claude_API_Key: 'fallback-test' }), null);
  }
  assert.equal(create({ NODE_ENV: 'development' }), null);
});

test('HTTPS proxy takes precedence and is passed through SDK httpAgent', () => {
  const client = create({ NODE_ENV: 'development', CLAUDE_API_KEY: 'test', HTTPS_PROXY: 'http://https-proxy:8080', HTTP_PROXY: 'http://http-proxy:8080' });
  assert.ok(client.options.httpAgent instanceof MockProxyAgent);
  assert.equal(client.options.httpAgent.proxy, 'http://https-proxy:8080');
});

test('HTTP and lowercase proxy variables are supported', () => {
  for (const name of ['HTTP_PROXY', 'https_proxy', 'http_proxy']) {
    assert.equal(create({ NODE_ENV: 'development', CLAUDE_API_KEY: 'test', [name]: 'http://proxy:8080' }).options.httpAgent.proxy, 'http://proxy:8080');
  }
});

test('production and direct development transport retain default SDK options', () => {
  for (const env of [
    { NODE_ENV: 'production', HTTPS_PROXY: 'http://proxy:8080', Claude_API_Key: 'fallback-test' },
    { NODE_ENV: 'development' },
  ]) assert.deepEqual(create({ ...env, CLAUDE_API_KEY: 'canonical-test' }).options, { apiKey: 'canonical-test' });
});

test('real proxy agent retains Node TLS defaults without connecting', () => {
  const client = createAnthropicClient({ NODE_ENV: 'development', CLAUDE_API_KEY: 'test', HTTPS_PROXY: 'http://proxy:8080' }, { Anthropic: MockAnthropic });
  assert.ok(client.options.httpAgent instanceof HttpsProxyAgent);
  assert.notEqual(client.options.httpAgent.options.rejectUnauthorized, false);
  assert.equal(client.options.httpAgent.options.ca, undefined);
  assert.deepEqual(Object.keys(client.options).sort(), ['apiKey', 'httpAgent']);
  client.options.httpAgent.destroy();
});

test('installed Anthropic SDK accepts the configured agent without an API request', () => {
  const client = createAnthropicClient({ NODE_ENV: 'development', Claude_API_Key: 'placeholder-test', HTTPS_PROXY: 'http://proxy:8080' });
  assert.ok(client.httpAgent instanceof HttpsProxyAgent);
  assert.equal(client.apiKey, 'placeholder-test');
  assert.equal(typeof client.messages.create, 'function');
  client.httpAgent.destroy();
});
