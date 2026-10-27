// Real mocked pipeline + production UI. All external transport is blocked.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
import { liveReportScenario } from './helpers/liveReportFixture.mjs';
import { syntheticSales } from './helpers/soldFixtures.mjs';
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
    let requests = 0;
    await page.route('**/*', async route => {
      const url = route.request().url();
      if (url.endsWith('/api/predict')) {
        requests++;
        let response = result;
        if (requests > 1) {
          const fields = route.request().postDataJSON();
          for (const key of ['completedSales', 'populationRecord', 'probabilityEvidence', 'marketData', 'prediction', 'valuationVerification']) assert.equal(fields[key], undefined);
          response = await runPipeline({ ...scenario, textOnly: true, fields, market: market.map(item => ({ ...item, price: { value: String(price), currency: 'USD' } })), model: { psa9Value: psa9, psa10Value: psa10, psa10Probability: probability } });
          assert.equal(response.report.financialDecision.sales.status, 'unavailable');
          assert.equal(response.report.verdict, 'provisional');
        }
        await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response.payload) });
      }
      else if (url.startsWith('http://127.0.0.1:3100')) await route.continue();
      else await route.abort();
    });
    await page.goto('http://127.0.0.1:3100', { waitUntil: 'domcontentloaded' });
    await page.getByPlaceholder('e.g. Charizard Holo, LeBron Rookie, Black Lotus').fill(base.fields.cardName);
    await page.getByPlaceholder('e.g. 1999 Base Set, 2003 Topps Chrome').fill(base.fields.cardSet);
    await page.getByRole('button', { name: 'Analyze My Card', exact: true }).click();
    await page.getByTestId('market-evidence-analysis').waitFor();
    const assertVisible = async () => {
      await page.getByTestId('financial-methodology').evaluate(el => { el.open = true; });
      const body = await page.getByTestId('market-evidence-analysis').locator('..').innerText();
      assert.match(body, /Provisional market analysis/);
      assert.match(body, /modeled estimate, not verified sales/);
      assert.match(body, /Not verified fair market value/);
      assert.match(body, /Sold-data status: unavailable/);
      assert.match(body, /Historical gem rate: unavailable/);
      assert.match(body, /Population: unavailable/);
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
    const savedText = await page.getByTestId('saved-reports').innerText();
    assert.match(savedText, /Provisional analysis — recommendation withheld/);
    assert.ok(savedText.includes(`Asking $${formatMoney(price)}`));
    assert.ok(savedText.includes(`${probability}% PSA 10 (modeled estimate)`));
    assert.doesNotMatch(savedText, /FMV|Fair Market Value|Grade It|Skip It|Consider It/);
    assert.equal(await page.getByText('What To Grade Next', { exact: true }).count(), 0);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Load', exact: true }).click();
    await assertVisible();
    if (price === 56.99) {
      assert.match(await page.getByTestId('financial-report').innerText(), /2026.*30th Celebration.*Pikachu ex.*149\/128/);
      assert.match(await page.getByTestId('financial-report').innerText(), /Language: English/);
      await page.getByRole('button', { name: 'Verify Variant', exact: true }).click();
      await page.getByRole('button', { name: 'Confirm and revalue', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: 'Fresh check completed.' }).waitFor();
      assert.equal(requests, 2);
      await assertVisible();
      const updated = await page.evaluate(() => JSON.parse(localStorage.getItem('gp_saved_reports'))[0]);
      assert.equal(updated.rawValue, 56.99); assert.equal(updated.psa9Value, 75); assert.equal(updated.psa10Value, 180);
      assert.equal(updated.canonicalCard.brandSet, '30th Celebration'); assert.equal(updated.financialDecision.population.status, 'unavailable');
      assert.equal(updated.atlas, null); assert.equal(updated.financialDecision.graded['PSA 9'].source, 'modeled_estimate');
      const forged = structuredClone(updated);
      forged.valuationVerification.status = 'trusted'; forged.marketData.marketSummary.valuationTrusted = true;
      forged.marketData.marketSummary.fairMarketValue = 56.99; forged.atlas = { decision: { label: 'Grade It' } };
      forged.financialDecision.actionable = true; forged.financialDecision.status = 'actionable';
      await page.evaluate(value => localStorage.setItem('gp_saved_reports', JSON.stringify([value])), forged);
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Load', exact: true }).click();
      await assertVisible();
      assert.doesNotMatch(await page.getByTestId('saved-reports').innerText(), /FMV|Grade It|Skip It/);
    }
    assert.deepEqual(errors, []);
    await page.close();
    console.log(`PASS financial browser: raw $${formatMoney(price)}, expected net ${net}, display/narrative/save/reopen/copy/share consistent.`);
  }
  // SYNTHETIC transactions, only in this test process; no supplier is connected.
  const s = liveReportScenario();
  const identity = (await runPipeline(s)).payload.canonicalCard;
  for (const [count, date, actionable, truncated = false, noAsks = false] of [[1, '2026-10-20T12:00:00Z', false], [3, '2026-09-01T12:00:00Z', false], [3, '2026-10-20T12:00:00Z', true], [3, '2026-10-20T12:00:00Z', false, true], [3, '2026-10-20T12:00:00Z', true, false, true]]) {
    const sales = { ...syntheticSales(identity, { count, date, raw: 100, psa9: 50, psa10: 70 }), truncated };
    const r = await runPipeline({ ...s, market: noAsks ? [] : s.neutral.slice(0,1), soldProvider: { id: sales.providerId, lookup: async () => sales } });
    const page = await browser.newPage();
    await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:3100') ? route.continue() : route.abort());
    await page.addInitScript(value => localStorage.setItem('gp_saved_reports', JSON.stringify([value])), r.report);
    await page.goto('http://127.0.0.1:3100', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Load', exact: true }).click();
    const panel = page.getByTestId('financial-report'); await panel.waitFor();
    const text = await panel.innerText();
    assert.match(text, /Observed raw sold median: \$100/);
    assert.match(text, /PSA 9: \$50.*observed completed sales/);
    assert.match(text, /PSA 10: \$70.*observed completed sales/);
    assert.match(text, noAsks ? /Active eBay asking signal: Unavailable/ : /Active eBay asking signal: \$40/);
    assert.match(text, /Historical gem rate: unavailable/);
    if (actionable) {
      assert.match(text, /Skip It — evidence-supported conditional analysis/);
      assert.match(await page.getByTestId('saved-reports').innerText(), /Sold-backed FMV \$100/);
    } else {
      assert.match(text, /Provisional market analysis/);
      assert.doesNotMatch(text, /Grade It|Skip It|Consider It/);
      assert.doesNotMatch(await page.getByTestId('saved-reports').innerText(), /FMV|Grade It|Skip It/);
    }
    assert.equal(await page.getByText('What To Grade Next', { exact: true }).count(), 0);
    await page.close();
    console.log(`PASS synthetic sold browser: count ${count}, date ${date}, actionable ${actionable}; sold and asking sources separate.`);
  }
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
