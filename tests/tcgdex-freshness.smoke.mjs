// Real mocked handler reports + production UI. No external traffic is allowed.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
const { chromium } = createRequire(import.meta.url)('playwright');
const reports = JSON.parse(readFileSync(process.env.FRESHNESS_VALIDATION_OUTPUT || '/tmp/gp-freshness-reports.json', 'utf8'));
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
  for (const [name, report] of Object.entries(reports)) {
    const page = await browser.newPage(); const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:3100') ? route.continue() : route.abort());
    await page.addInitScript(value => localStorage.setItem('gp_saved_reports', JSON.stringify([value])), report);
    await page.goto('http://127.0.0.1:3100', { waitUntil: 'domcontentloaded' });
    await page.getByRole('button', { name: 'Load', exact: true }).click();
    const identity = page.getByTestId('photo-final-identity'); await identity.waitFor();
    assert.match(await identity.innerText(), /2026.*30th Celebration.*Pikachu ex.*149\/128/);
    assert.doesNotMatch(await identity.innerText(), /Stellar Crown/);
    await page.getByTestId('photo-initial-identity').locator('summary').click();
    const body = await page.locator('body').innerText();
    assert.match(body, /Initial AI interpretation — unverified/i);
    assert.match(body, /Stellar Crown/); // initial interpretation is retained as provenance
    if (name === 'corrected') {
      assert.match(body, /\$40/);
      assert.match(body, /Visible corner whitening/);
      assert.doesNotMatch(body, /Light surface marks may limit the grade/);
      assert.match(body, /do not establish a PSA grade/);
      assert.doesNotMatch(body, /This Stellar Crown card has strong eye appeal|Stellar Crown is difficult to grade/);
      assert.equal(report.identityVerification.catalog.candidate.printingProvenance.revision, 'a211f11f3ba57d56c65c5ac33be35b77d3280757');
    } else {
      assert.match(body, /Valuation and grading ROI withheld/);
      assert.match(body, /Grading recommendation withheld/i);
      assert.doesNotMatch(body, /\$40/);
    }
    assert.deepEqual(errors, []); await page.close();
    console.log(`PASS freshness browser: ${name}, final identity, initial-AI provenance and safe grading narrative.`);
  }
} finally { await browser?.close(); server.kill('SIGTERM'); }
