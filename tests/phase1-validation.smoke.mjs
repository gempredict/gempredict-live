// Stage A browser audit against actual mocked-pipeline payloads, not hand-built
// success reports. Requires build + PHASE1_VALIDATION_OUTPUT test run first.
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { scenarios } from './helpers/phase1Scenarios.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const results = JSON.parse(readFileSync(process.env.PHASE1_VALIDATION_OUTPUT || '/tmp/gp-phase1-stage-a.json', 'utf8'));
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', '3100', '--hostname', '127.0.0.1'], { stdio: 'ignore' });
const checks = [];
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://127.0.0.1:3100')).ok) { ready = true; break; } } catch {}
    await delay(250);
  }
  assert.ok(ready, 'Local production server starts');
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  for (const result of results) {
    const scenario = scenarios.find(item => item.id === result.id);
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.addInitScript(() => {
      Object.defineProperty(navigator, 'clipboard', { value: { writeText: async value => { window.__stageACopy = value; } }, configurable: true });
      Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
    });
    let requestCount = 0;
    await page.route('**/*', async route => {
      const url = route.request().url();
      if (url.endsWith('/api/predict')) {
        requestCount++;
        const initial = scenario.confirmation && requestCount === 1 ? results.find(item => item.id === 'kid-art-unresolved') : result;
        if (scenario.confirmation && requestCount === 2) {
          const input = route.request().postDataJSON();
          assert.equal(input.confirmedVariant.parallel, 'Alternate Art');
          assert.equal(input.confirmedCardIdentity.cardNumber, 'OP14-014');
          assert.equal(input.rawValue, undefined);
        }
        await route.fulfill({ status: initial.httpStatus, contentType: 'application/json', body: JSON.stringify(initial.payload) });
      }
      else if (url.startsWith('http://127.0.0.1:3100')) await route.continue();
      else await route.abort(); // never contact integrations, analytics or fonts
    });
    await page.goto('http://127.0.0.1:3100', { waitUntil: 'domcontentloaded' });
    if (scenario.textOnly && !scenario.confirmation) {
      await page.getByPlaceholder('e.g. Charizard Holo, LeBron Rookie, Black Lotus').fill(scenario.fields.cardName);
      if (scenario.fields.cardSet) await page.getByPlaceholder('e.g. 1999 Base Set, 2003 Topps Chrome').fill(scenario.fields.cardSet);
    } else {
      await page.locator('input[type="file"]').first().setInputFiles({ name: 'mock.png', mimeType: 'image/png', buffer: Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/l9sAAAAASUVORK5CYII=', 'base64') });
    }
    await page.getByRole('button', { name: 'Analyze My Card', exact: true }).click();
    if (scenario.confirmation) {
      await page.getByRole('button', { name: 'Verify Variant', exact: true }).click();
      await page.getByLabel('Version / parallel').fill('Alternate Art');
      await page.getByRole('button', { name: 'Confirm and revalue', exact: true }).click();
      await page.getByRole('alert').filter({ hasText: result.payload.error }).waitFor();
      assert.equal(requestCount, 2);
      assert.equal(await page.getByText('Live Raw Market', { exact: true }).count(), 0);
      checks.push({ id: result.id, uiCorrect: false, reason: 'Fresh confirmation request returns HTTP 500; old price remains withheld', pageErrors: errors });
    } else if (result.httpStatus !== 200) {
      await page.getByText(result.payload.error, { exact: true }).waitFor();
      checks.push({ id: result.id, uiCorrect: false, reason: 'HTTP 500: generic error, no result or Verify Variant action', pageErrors: errors });
    } else {
      await page.getByRole('button', { name: 'Copy Summary', exact: true }).waitFor();
      const withheld = await page.getByText('Valuation and grading ROI withheld', { exact: true }).count() > 0;
      const trusted = result.observed.valuationStatus === 'trusted';
      assert.equal(withheld, !trusted, result.id + ': UI honors API trust');
      let shownRaw = null;
      if (trusted) {
        shownRaw = await page.getByText('Live Raw Market', { exact: true }).locator('..').innerText();
        assert.ok(shownRaw.includes('$' + result.observed.marketMedian));
      } else {
        await page.getByRole('button', { name: 'Verify Variant', exact: true }).click();
        await page.getByLabel('Card number', { exact: true }).waitFor();
        assert.equal(await page.getByText('Live Raw Market', { exact: true }).count(), 0);
      }
      if (!scenario.textOnly) assert.ok((await page.locator('body').innerText()).includes('Visible corner whitening.'));
      await page.getByRole('button', { name: 'Copy Summary', exact: true }).click();
      const copied = await page.evaluate(() => window.__stageACopy);
      assert.equal(copied, result.copied);
      await page.getByRole('button', { name: 'Share', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__stageACopy), copied);
      if (withheld) assert.doesNotMatch(copied, /\$|Grade It|Skip It/);
      await page.getByRole('button', { name: 'Save Report', exact: true }).click();
      const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gp_saved_reports'))[0]);
      assert.equal(saved.rawValue, result.observed.modelRaw);
      assert.equal(saved.marketData.marketSummary.rawMedian, result.observed.marketMedian);
      // Reload persistence and load the actual saved report into the result UI.
      await page.reload({ waitUntil: 'domcontentloaded' });
      await page.getByRole('button', { name: 'Load', exact: true }).click();
      await page.getByRole('button', { name: 'Copy Summary', exact: true }).click();
      assert.equal(await page.evaluate(() => window.__stageACopy), copied);
      const atlasConsistent = !trusted || result.payload.atlas.marketEvidence.comparableCount === result.observed.usedCount;
      let atlasMarket = null;
      if (trusted) {
        atlasMarket = await page.getByText('Market', { exact: true }).locator('..').innerText();
        assert.ok(atlasMarket.includes(result.payload.atlas.marketEvidence.confidence + '%'));
      }
      const numericalAgreement = !trusted || result.report.rawValue === result.observed.marketMedian && result.report.expectedNetValue === result.report.expectedGradedValue - result.observed.marketMedian - result.report.psaFee && result.report.gradingUpside === result.report.psa10Value - result.observed.marketMedian - result.report.psaFee;
      checks.push({ id: result.id, uiCorrect: trusted === scenario.expectedTrusted && numericalAgreement && atlasConsistent, valuationFlowCorrect: trusted === scenario.expectedTrusted && numericalAgreement, atlasConsistent, atlasMarket, showsTrusted: trusted, shownRaw, copied, persistedRaw: saved.rawValue, persistedMedian: saved.marketData.marketSummary.rawMedian, numericalAgreement, pageErrors: errors });
    }
    assert.deepEqual(errors, [], result.id);
    console.log(`${checks.at(-1).uiCorrect ? 'PASS' : 'FAIL'} Stage A browser ${result.id}`);
    await page.close();
  }
  writeFileSync(process.env.PHASE1_BROWSER_OUTPUT || '/tmp/gp-stage-a-browser.json', JSON.stringify(checks, null, 2));
  const failed = checks.filter(check => !check.uiCorrect).length;
  console.log(`Stage A browser: ${checks.length - failed} pass; ${failed} readiness failures. No live integration calls.`);
  if (failed) process.exitCode = 1;
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
