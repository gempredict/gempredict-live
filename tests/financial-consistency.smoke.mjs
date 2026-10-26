// Real mocked pipeline + production UI. All external transport is blocked.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
import { liveReportScenario } from './helpers/liveReportFixture.mjs';
import { scenarios } from './helpers/phase1Scenarios.mjs';
import { formatMoney } from '../lib/gradingEconomics.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', '3100', '--hostname', '127.0.0.1'], { stdio: 'ignore' });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://127.0.0.1:3100')).ok) { ready = true; break; } } catch {}
    await delay(250);
  }
  assert.ok(ready);
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const base = scenarios.find(s => s.id === 'text-complete');
  for (const [price, psa9, psa10, probability, net] of [[56.99, 75, 180, 30, -30.49], [3.17, 8.37, 23.93, 37, -69.04], [0.99, 15.25, 200.99, 50, 27.13]]) {
    const scenario = price === 56.99 ? liveReportScenario() : base;
    const market = price === 56.99 ? scenario.neutral.slice(0,1) : base.market;
    const result = await runPipeline({ ...scenario, market: market.map(item => ({ ...item, price: { value: String(price), currency: 'USD' } })), model: { rawValue: 150, psa9Value: psa9, psa10Value: psa10, psa10Probability: probability }, predictionReply: { analysis: 'Guaranteed $150 profits.', action: 'Grade immediately.', verdict: 'grade', gradingUpside: 9999 } });
    assert.equal(result.report.expectedNetValue, net);
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.__copy = text; } }, configurable: true });
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });
    await page.route('**/*', async route => {
      const url = route.request().url();
      if (url.endsWith('/api/predict')) await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(result.payload) });
      else if (url.startsWith('http://127.0.0.1:3100')) await route.continue();
      else await route.abort();
    });
    await page.goto('http://127.0.0.1:3100', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('e.g. Charizard Holo, LeBron Rookie, Black Lotus').fill(base.fields.cardName);
    await page.getByPlaceholder('e.g. 1999 Base Set, 2003 Topps Chrome').fill(base.fields.cardSet);
    await page.getByRole('button', { name: 'Analyze My Card', exact: true }).click();
    await page.getByTestId('market-evidence-analysis').waitFor();
    const assertVisible = async () => {
      const body = await page.getByTestId('market-evidence-analysis').locator('..').innerText();
      assert.match(body, /Provisional market analysis/);
      assert.match(body, /modeled estimate, not verified sales/);
      assert.match(body, /Not verified fair market value/);
      assert.match(body, /Sold-data status: unavailable/);
      assert.ok(body.includes('$' + formatMoney(net)));
      assert.ok(body.includes('$' + formatMoney(price)));
      assert.doesNotMatch(body, /Guaranteed \$150|Grade immediately|Strong Grade Candidate|Skip It|Grade It|Consider It|Atlas Intelligence/);
      assert.equal(result.report.marketData.marketSummary.fairMarketValue, null);
      assert.equal(result.report.atlas, null);
      await page.getByRole('button', { name: 'Copy Summary', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__copy), result.copied);
      await page.getByRole('button', { name: 'Share', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__copy), result.copied);
    };
    await assertVisible();
    await page.getByRole('button', { name: 'Save Report', exact: true }).click();
    const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gp_saved_reports'))[0]);
    assert.equal(saved.rawValue, price);
    assert.equal(saved.expectedNetValue, net);
    assert.equal(saved.gradingUpside, result.report.gradingUpside);
    assert.equal(saved.verdict, result.report.verdict);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Load', exact: true }).click();
    await assertVisible();
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS financial browser: raw $${formatMoney(price)}, expected net ${net}, display/narrative/save/reopen/copy/share consistent.`);
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
