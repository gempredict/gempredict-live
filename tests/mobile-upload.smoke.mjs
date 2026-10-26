// Actual production UI + bundled HEIC decoder. All prediction traffic is mocked.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { setTimeout as delay } from 'node:timers/promises';
import sharp from 'sharp';
import { MAX_UPLOAD_BYTES, MAX_IMAGE_BYTES } from '../lib/mobileImages.mjs';
const { chromium, devices } = createRequire(import.meta.url)('playwright');
const server = spawn(process.execPath, ['node_modules/next/dist/bin/next', 'start', '--port', '3100', '--hostname', '127.0.0.1'], { stdio: 'ignore' });
let browser;
try {
  let ready = false;
  for (let i = 0; i < 60; i++) { try { if ((await fetch('http://127.0.0.1:3100')).ok) { ready = true; break; } } catch {} await delay(250); }
  assert.ok(ready);
  browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  const heic = readFileSync(new URL('./fixtures/mobile/example.heic', import.meta.url));
  const source = sharp({ create: { width: 180, height: 120, channels: 3, background: '#bb2222' } });
  const rotated = await source.clone().withMetadata({ orientation: 6 }).jpeg().toBuffer();
  const png = await source.clone().png().toBuffer();
  const webp = await source.clone().webp().toBuffer();
  const large = await sharp({ create: { width: 4032, height: 3024, channels: 3, background: '#345678' } }).png().toBuffer();
  for (const device of ['iPhone 13', 'Pixel 7']) {
    const context = await browser.newContext({ ...devices[device] });
    const page = await context.newPage(); const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    let mode = 'json', calls = 0;
    await page.route('**/*', async route => {
      if (route.request().url().endsWith('/api/predict')) {
        calls++;
        const body = route.request().postDataBuffer();
        assert.ok(body.length < MAX_UPLOAD_BYTES);
        const form = await new Request('http://local/api/predict', { method: 'POST', headers: { 'content-type': route.request().headers()['content-type'] }, body }).formData();
        for (const field of ['image', 'backImage']) {
          const file = form.get(field); assert.ok(file); assert.equal(file.type, 'image/jpeg'); assert.ok(file.size <= MAX_IMAGE_BYTES);
          const meta = await sharp(Buffer.from(await file.arrayBuffer())).metadata();
          assert.equal(meta.format, 'jpeg'); assert.ok(Math.max(meta.width, meta.height) <= 2560); assert.equal(meta.orientation, undefined);
        }
        if (mode === 'network') return route.abort('failed');
        if (mode === 'authentication') return route.fulfill({ status: 401, contentType: 'text/html', body: 'private sign in' });
        if (mode === 'redirect') return route.fulfill({ status: 307, headers: { location: 'https://vercel.com/login' }, body: '' });
        if (mode === 'html') return route.fulfill({ status: 502, contentType: 'text/html', body: 'private gateway details' });
        return route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Mock prediction unavailable.' }) });
      }
      if (route.request().url().startsWith('http://127.0.0.1:3100')) return route.continue();
      return route.abort();
    });
    await page.goto('http://127.0.0.1:3100', { waitUntil: 'domcontentloaded' });
    const front = page.locator('input[type=file]').nth(0), back = page.locator('input[type=file]').nth(1);
    const submit = page.getByRole('button', { name: 'Analyze My Card' });
    assert.equal(await page.getByLabel('Take front photo').getAttribute('capture'), 'environment');
    assert.equal(await page.getByLabel('Take back photo').getAttribute('capture'), 'environment');
    // HEIF with an empty MIME and 2.1 MB transfer size exercises actual fallback.
    const padded = Buffer.concat([heic, Buffer.alloc(Math.ceil(2.1 * 1024 * 1024) - heic.length)]);
    await front.setInputFiles({ name: 'IMG.HEIF', mimeType: '', buffer: padded });
    await page.locator('img[alt="Card preview"]').waitFor({ timeout: 60000 });
    await back.setInputFiles({ name: 'back.jpg', mimeType: 'image/jpeg', buffer: rotated });
    await page.locator('img[alt="Back preview"]').waitFor();
    const dimensions = await page.locator('img[alt="Back preview"]').evaluate(img => ({ width: img.naturalWidth, height: img.naturalHeight }));
    assert.deepEqual(dimensions, { width: 120, height: 180 }, 'EXIF orientation is baked exactly once');
    for (const [nextMode, message] of [['json', 'Mock prediction unavailable.'], ['authentication', 'Preview authentication is required'], ['redirect', 'Preview authentication is required'], ['html', 'non-JSON response'], ['network', 'Connection failed before a response']]) {
      mode = nextMode; await submit.click();
      await page.getByText(message, { exact: false }).waitFor();
    }
    assert.equal(calls, 5);
    for (const [name, mimeType, buffer] of [['saved.png', 'image/png', png], ['android.webp', 'image/webp', webp], ['large.png', 'image/png', large]]) {
      await front.setInputFiles({ name, mimeType, buffer });
      await page.locator('img[alt="Card preview"]').waitFor();
      const info = await page.locator('img[alt="Card preview"]').evaluate(img => ({ width: img.naturalWidth, height: img.naturalHeight }));
      assert.ok(Math.max(info.width, info.height) <= 2560);
    }
    await front.setInputFiles({ name: 'corrupt.jpg', mimeType: 'image/jpeg', buffer: Buffer.from('invalid image') });
    await page.getByText('Unsupported image.', { exact: false }).waitFor();
    assert.ok(await submit.isDisabled()); assert.equal(calls, 5);
    assert.deepEqual(errors, []);
    console.log(`PASS mobile browser ${device}: real HEIF fallback, front/back, JPEG/PNG/WebP, orientation, resizing, invalid file and distinct failures; no providers.`);
    await context.close();
  }
} finally { if (browser) await browser.close(); server.kill('SIGTERM'); }
