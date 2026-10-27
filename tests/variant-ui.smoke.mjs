import { verifiedIdentity, verifiedVariant } from './helpers/verifiedIdentity.mjs';
// Optional browser smoke test: uses the environment's Playwright + Chromium.
// Run after npm run build: node tests/variant-ui.smoke.mjs
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import { protectValuation } from '../lib/valuationProtection.mjs';
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', '3100', '--hostname', '127.0.0.1'], { stdio: 'ignore' });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) {
    try { if ((await fetch('http://127.0.0.1:3100')).ok) { ready = true; break; } } catch {}
    await delay(250);
  }
  assert.ok(ready, 'Production server starts');
  browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  const report = {
    cardTitle: 'Eustass Captain Kid', cardMeta: 'One Piece',
    canonicalCard: { subject: 'Eustass Captain Kid', cardNumber: 'OP14-014', year: '2026', brandSet: 'One Piece', parallel: 'Standard Art' },
    rawValue: 987654, gradingUpside: 987654, expectedNetValue: 987654, gemPredictScore: 99, verdict: 'grade',
    marketData: { marketSummary: { rawUsedCount: 1, rawMedian: 987654 } },
    variantVerification: { status: 'needs_confirmation', materialAmbiguity: true, explanation: 'Standard and alternate artwork evidence conflict.' },
    valuationVerification: { status: 'untrusted', reason: 'variant_unresolved', explanation: 'Standard and alternate artwork evidence conflict.' },
    imageAnalysis: { centering: 'good', corners: 'good', edges: 'good', surface: 'fair', visualObservations: [{ attribute: 'corners', code: 'whitening' }], overallScore: 7, imageSummary: 'Visible corner whitening remains available.' },
  };
  const textOnly = process.env.TEXT_ONLY_SMOKE === '1';
  if (textOnly) {
    report.canonicalCard = { subject: 'Eustass Captain Kid', cardNumber: null, year: null, brandSet: null, parallel: null };
    report.variantVerification = { status: 'insufficient_evidence', materialAmbiguity: false };
    report.valuationVerification.explanation = 'Enter card number, year, set and version. No photo is required.';
    report.imageAnalysis = null;
  }
  await page.addInitScript(value => {
    localStorage.setItem('gp_saved_reports', JSON.stringify([value]));
    Object.defineProperty(navigator, 'clipboard', { value: { writeText: async text => { window.__copied = text; } }, configurable: true });
    Object.defineProperty(navigator, 'share', { value: undefined, configurable: true });
  }, report);
  let revaluations = 0;
  await page.route('**/*', async route => {
    const url = route.request().url();
    if (url.endsWith('/api/predict')) {
      revaluations++;
      const input = route.request().postDataJSON();
      assert.equal(input.confirmedVariant.parallel, 'Alternate Art');
      assert.equal(input.confirmedCardIdentity.cardNumber, 'OP14-014');
      assert.equal(input.confirmedIdentity.year, '2026');
      assert.equal(input.confirmedIdentity.brandSet, 'One Piece');
      assert.equal(input.marketData, undefined);
      assert.equal(input.rawValue, undefined);
      const canonicalCard = { ...input.confirmedCardIdentity, parallel: 'Alternate Art', displayName: '2026 One Piece Eustass Captain Kid Alternate Art OP14-014' };
      const payload = protectValuation({
        ...verifiedIdentity(canonicalCard),
        prediction: { cardTitle: report.cardTitle, cardMeta: '2026 One Piece Alternate Art', rawValue: 80, psa9Value: 100, psa10Value: 150, gradingUpside: -10, expectedNetValue: -20, verdict: 'maybe', psa10Probability: 50, gemPredictScore: 60 },
        canonicalCard,
        variantVerification: verifiedVariant(canonicalCard, 'user_confirmed'),
        marketData: { marketSummary: { rawUsedCount: 1, rawMedian: 80 } },
      });
      await route.fulfill({ contentType: 'application/json', body: JSON.stringify(payload) });
    } else if (url.startsWith('http://127.0.0.1:3100')) await route.continue();
    else await route.abort();
  });
  await page.goto('http://127.0.0.1:3100', { waitUntil: 'domcontentloaded' });
  await page.getByRole('button', { name: 'Load', exact: true }).click();
  await page.getByRole('button', { name: 'Verify Variant', exact: true }).waitFor();
  assert.ok((await page.locator('body').innerText()).includes('Valuation and grading ROI withheld'));
  assert.ok(!(await page.locator('body').innerText()).includes('987,654'));
  assert.ok(!(await page.locator('body').innerText()).includes('987654'));
  if (!textOnly) assert.ok((await page.locator('body').innerText()).includes('Visible corner whitening.'));
  const nameInput = page.getByPlaceholder('e.g. Charizard Holo, LeBron Rookie, Black Lotus');
  const setInput = page.getByPlaceholder('e.g. 1999 Base Set, 2003 Topps Chrome');
  await nameInput.fill('Different card'); await setInput.fill('1999 Wrong Set');
  const chooser = page.waitForEvent('filechooser');
  await page.getByRole('button', { name: 'Rescan', exact: true }).click();
  await (await chooser).setFiles([]);
  assert.equal(await nameInput.inputValue(), '');
  assert.equal(await setInput.inputValue(), '');
  await page.getByRole('button', { name: 'Copy Summary', exact: true }).click();
  assert.doesNotMatch(await page.evaluate(() => window.__copied), /\$|987654|Grade It/);
  await page.getByRole('button', { name: 'Share', exact: true }).click();
  assert.doesNotMatch(await page.evaluate(() => window.__copied), /\$|987654|Grade It/);
  await page.getByRole('button', { name: 'Verify Variant', exact: true }).click();
  await page.getByLabel('Card subject', { exact: true }).fill('Eustass Captain Kid');
  await page.getByLabel('Card number', { exact: true }).fill('OP14-014');
  await page.getByLabel('Year', { exact: true }).fill('2026');
  await page.getByLabel('Set / product', { exact: true }).fill('One Piece');
  await page.getByLabel('Version / parallel').fill('Alternate Art');
  await page.getByRole('button', { name: 'Confirm and revalue' }).click();
  await page.getByTestId('market-evidence-analysis').waitFor();
  assert.match(await page.getByTestId('market-evidence-analysis').innerText(), /\$80/);
  assert.equal(revaluations, 1);
  assert.ok(!(await page.locator('body').innerText()).includes('987,654'));
  const saved = await page.evaluate(() => JSON.parse(localStorage.getItem('gp_saved_reports')));
  assert.equal(saved[0].marketData.marketSummary.rawMedian, 80);
  // Restored iPhone regression: show final catalog identity ahead of the
  // superseded AI interpretation, even when variant evidence withholds prices.
  const pikachu = {
    canonicalCard: { subject: 'Pikachu ex', cardNumber: '149/128', year: '2026', brandSet: '30th Celebration', parallel: 'Holo Special Art', language: 'English', variant: { finish: 'holo', art: 'special art' } },
    identityVerification: { year: { status: 'corrected', value: '2026' }, set: { status: 'corrected', value: '30th Celebration' }, catalog: {
      status: 'corrected', source: 'tcgdex', referenceId: '30th-149', conflicts: [], corrections: [{ field: 'brandSet', originalValue: 'Stellar Crown', value: '30th Celebration' }],
      candidate: { subject: 'Pikachu ex', cardNumber: '149/128', year: '2026', brandSet: '30th Celebration', parallel: 'Special Art', language: 'en', provider: 'tcgdex', variants: { normal: false, holo: true, reverse: false } },
    } },
    imageAnalysis: { identifiedSubject: 'Pikachu ex', identifiedYear: '2024', identifiedBrandSet: 'Stellar Crown', identifiedParallel: 'Special Art', identifiedCardNumber: '149/128', identityConfidence: 98,
      imageSummary: 'Visible corner whitening. High market value justifies grading.', cornersNote: 'Minor whitening at the top corner.', worthGrading: true, worthGradingReason: 'Worth grading for resale profit.', psa10Upside: 'Sell for a premium.', overallScore: 8 },
    variantVerification: { status: 'insufficient_evidence', explanation: 'Not enough informative listings.' },
    valuationVerification: { status: 'untrusted' }, marketData: { marketSummary: { rawUsedCount: 0 } },
  };
  const photoPage = await browser.newPage();
  photoPage.on('pageerror', error => errors.push(error.message));
  await photoPage.addInitScript(value => localStorage.setItem('gp_saved_reports', JSON.stringify([value])), pikachu);
  await photoPage.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:3100') ? route.continue() : route.abort());
  await photoPage.goto('http://127.0.0.1:3100', { waitUntil: 'domcontentloaded' });
  await photoPage.getByRole('button', { name: 'Load', exact: true }).click();
  await photoPage.getByTestId('photo-final-identity').waitFor();
  const photoIdentity = await photoPage.getByTestId('photo-final-identity').innerText();
  assert.match(photoIdentity, /Catalog-supported identity/i);
  assert.match(photoIdentity, /2026.*30th Celebration.*Pikachu ex.*Holo Special Art.*149\/128/);
  assert.doesNotMatch(photoIdentity, /Stellar Crown/);
  await photoPage.getByTestId('photo-initial-identity').locator('summary').click();
  const photoText = await photoPage.locator('body').innerText();
  assert.match(photoText, /Initial AI interpretation — unverified/i);
  assert.match(photoText, /Initial AI confidence:/);
  assert.match(photoText, /Stellar Crown/);
  assert.doesNotMatch(photoText, /High Confidence|High market value|resale profit|Sell for a premium/);
  assert.match(photoText, /Visible corner whitening/);
  assert.match(photoText, /Visible corner whitening/);
  assert.match(photoText, /Grading recommendation withheld/i);
  await photoPage.close();
  // A previously trusted browser report must lose pricing/Atlas when its
  // variant receipt is erased/downgraded or its comparable facts contradict it.
  for (const mutation of ['missing', 'downgraded', 'malformed', 'contradictory-listing']) {
    const stale = structuredClone(saved[0]);
    if (mutation === 'missing') stale.variantVerification = null;
    if (mutation === 'downgraded') stale.variantVerification.status = 'needs_confirmation';
    if (mutation === 'malformed') stale.variantVerification.value = [];
    if (mutation === 'contradictory-listing') stale.marketData.rawComparableItems = [{ title: '2026 One Piece Eustass Captain Kid OP14-014 Alternate Art', localizedAspects: [{ name: 'Year Manufactured', value: '2024' }] }];
    const stalePage = await browser.newPage();
    stalePage.on('pageerror', error => errors.push(error.message));
    await stalePage.route('**/*', route => route.request().url().startsWith('http://127.0.0.1:3100') ? route.continue() : route.abort());
    await stalePage.addInitScript(value => localStorage.setItem('gp_saved_reports', JSON.stringify([value])), stale);
    await stalePage.goto('http://127.0.0.1:3100', { waitUntil: 'domcontentloaded' });
    await stalePage.getByRole('button', { name: 'Load', exact: true }).click();
    await stalePage.getByRole('button', { name: 'Verify Variant', exact: true }).waitFor();
    const text = await stalePage.locator('body').innerText();
    assert.match(text, /Valuation and grading ROI withheld/, mutation);
    const resultText = await stalePage.getByText('Valuation and grading ROI withheld', { exact: true }).locator('..').innerText();
    assert.doesNotMatch(resultText, /\$80/, mutation);
    assert.doesNotMatch(text, /Selected listing evidence/i, mutation);
    assert.equal(await stalePage.getByText('Atlas Intelligence', { exact: true }).count(), 0, mutation);
    await stalePage.close();
  }
  assert.deepEqual(errors, []);
  console.log('PASS browser: unsafe result/saved values hidden, condition retained, copy/share safe, confirmation fetches fresh valuation and updates saved report.');
} finally {
  await browser?.close();
  server.kill('SIGTERM');
}
