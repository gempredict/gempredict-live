// Actual mocked pipeline + production UI. No external traffic/provider calls.
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { runPipeline } from './helpers/phase1Pipeline.mjs';
import { liveReportScenario } from './helpers/liveReportFixture.mjs';
const { chromium } = createRequire(import.meta.url)('playwright');
const identityFirst = process.env.IDENTITY_FIRST_SMOKE === '1';
const scenario = () => {
  const base = liveReportScenario();
  if (!identityFirst) return base;
  return { ...base, proposal: { ...base.proposal, brandSet: 'Obsidian Flames' }, vision: { ...base.vision, identifiedBrandSet: '2023 Obsidian Flames', identityConfidence: 90, imageSummary: 'This Obsidian Flames card is a guaranteed PSA 10 candidate.', cornersNote: 'Obsidian Flames has premium corners.', visualObservations: [{ attribute: 'corners', code: 'whitening' }], imageLimitations: ['glare'] } };
};
const initial = await runPipeline(scenario());
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', '3100', '--hostname', '127.0.0.1'], { stdio: 'ignore' });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://127.0.0.1:3100')).ok) { ready = true; break; } } catch {} await delay(250); }
  assert.ok(ready);
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  for (const failStorage of [false, true]) {
    const page = await browser.newPage(), errors = [], messages = [];
    page.on('pageerror', e => errors.push(e.message)); page.on('console', m => messages.push(m.text()));
    await page.addInitScript(({ report, failStorage }) => {
      localStorage.setItem('gp_saved_reports', JSON.stringify([report]));
      if (failStorage) Storage.prototype.setItem = () => { throw new DOMException('Quota exceeded', 'QuotaExceededError'); };
    }, { report: initial.report, failStorage });
    let mode = 'auth', calls = 0, latest;
    await page.route('**/*', async route => {
      const url = route.request().url();
      if (url.endsWith('/api/predict')) {
        calls++;
        if (mode === 'auth') return route.fulfill({ status: 401, contentType: 'text/html', body: 'private authentication page' });
        const fields = route.request().postDataJSON();
        assert.equal(fields.marketData, undefined); assert.equal(fields.rawValue, undefined);
        latest = await runPipeline({ ...scenario(), fields, textOnly: true });
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(latest.payload) });
      }
      return url.startsWith('http://127.0.0.1:3100') ? route.continue() : route.abort();
    });
    await page.goto('http://127.0.0.1:3100', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Load', exact: true }).click();
    await page.getByTestId('photo-final-identity').waitFor();
    assert.match(await page.getByTestId('photo-final-identity').innerText(), /2026.*30th Celebration.*149\/128/);
    await page.getByTestId('photo-initial-identity').locator('summary').click();
    assert.match(await page.getByTestId('photo-initial-identity').innerText(), identityFirst ? /Obsidian Flames/ : /Paldea Evolved/);
    assert.equal(initial.report.imageAnalysis.identityConfidence, identityFirst ? 90 : 92);
    const visibleFacts = await page.locator('body').evaluate(body => { const copy = body.cloneNode(true); copy.querySelectorAll('[data-testid="photo-initial-identity"]').forEach(node => node.remove()); return copy.textContent; });
    assert.doesNotMatch(visibleFacts, /Paldea Evolved|Obsidian Flames|PSA 8[–-]9|PSA 10 candidate|92%|90%/);
    assert.match(visibleFacts, /Visible corner whitening/);
    await page.getByRole('button', { name: 'Verify Variant', exact: true }).click();
    await page.getByRole('button', { name: 'Confirm and revalue', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Preview authentication' }).waitFor();
    assert.equal(calls, 1);
    mode = 'empty';
    await page.getByRole('button', { name: 'Confirm and revalue', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Fresh check completed. Valuation remains withheld' }).waitFor();
    assert.equal(calls, 2); assert.equal(latest.report.pricingDiagnostics.outcome, 'no_usable_comparables');
    const stored = await page.evaluate(() => JSON.parse(localStorage.getItem('gp_saved_reports'))[0]);
    assert.equal(stored.pricingDiagnostics.requestId, failStorage ? initial.report.pricingDiagnostics.requestId : latest.report.pricingDiagnostics.requestId);
    assert.ok(messages.some(m => m.includes('Revaluation state') && m.includes('updated')));
    assert.ok(messages.some(m => m.includes('Revaluation persistence') && m.includes(failStorage ? 'storage_failed' : 'saved')));
    assert.deepEqual(errors, []);
    console.log(`PASS live report browser ${identityFirst ? "Obsidian/90%" : "Paldea/92%"}: canonical facts, unverified AI provenance, withheld projections, auth failure, fresh no-market feedback, ${failStorage ? 'storage failure diagnosed' : 'saved-state updated'}.`);
    await page.close();
  }
} finally { if (browser) await browser.close(); server.kill('SIGTERM'); }
