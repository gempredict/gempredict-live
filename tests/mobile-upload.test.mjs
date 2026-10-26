import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import fs from 'node:fs';
import vm from 'node:vm';
import { Readable } from 'node:stream';
import formidable from 'formidable';
import { imageKind, imageDimensions, normalizeMobileImage, assertUploadBudget, MAX_SOURCE_BYTES, MAX_IMAGE_BYTES, UploadError } from '../lib/mobileImages.mjs';
import { validateAnalysisImage } from '../lib/uploadValidation.mjs';
import { requestPrediction } from '../lib/predictionTransport.mjs';
const picture = sharp({ create: { width: 120, height: 180, channels: 3, background: '#deb928' } });
const jpeg = await picture.clone().jpeg().toBuffer();
const heic = fs.readFileSync(new URL('./fixtures/mobile/example.heic', import.meta.url));
for (const format of ['jpeg', 'png', 'webp', 'gif']) test(`valid ${format} bytes pass server validation regardless of filename/MIME`, async () => {
  const bytes = await picture.clone().toFormat(format).toBuffer();
  assert.equal(imageKind(bytes.subarray(0, 64)), format);
  assert.equal(await validateAnalysisImage(bytes), `image/${format}`);
});
test('HEIF signatures and empty mobile MIME types are recognized by bytes, not extensions', async () => {
  assert.equal(imageKind(heic.subarray(0, 64)), 'heic');
  const seen = [];
  const file = new File([heic], 'IMG.HEIF', { type: '' });
  const normalized = await normalizeMobileImage(file, { decodeImage: async (_, kind) => { seen.push(kind); return { width: 120, height: 180, close() { seen.push('closed'); } }; }, makeCanvas: () => fakeCanvas() });
  assert.equal(normalized.type, 'image/jpeg'); assert.equal(normalized.name, 'card-photo.jpg');
  assert.deepEqual(seen, ['heic', 'closed']);
});
function fakeCanvas({ size = 100, type = 'image/jpeg', collect = [] } = {}) {
  return { getContext: () => ({ fillRect() {}, drawImage() {} }), toBlob(callback, mime, quality) { collect.push([this.width, this.height, quality]); callback(new Blob([new Uint8Array(size)], { type })); } };
}
test('resizing preserves aspect ratio, caps pixels and never upscales', () => {
  assert.deepEqual(imageDimensions(4032, 3024), { width: 2560, height: 1920 });
  assert.deepEqual(imageDimensions(3024, 4032), { width: 1920, height: 2560 });
  assert.deepEqual(imageDimensions(120, 180), { width: 120, height: 180 });
  for (const pair of [[0, 40], [NaN, 20], [10000, 10000]]) assert.throws(() => imageDimensions(...pair), { code: 'image_dimensions' });
});
test('large originals are prepared locally with a quality floor; unfit photos fail instead of losing more detail', async () => {
  const file = new File([jpeg, new Uint8Array(6 * 1024 * 1024)], 'large.jpg');
  let closed = false;
  const collect = [];
  const options = { decodeImage: async () => ({ width: 4032, height: 3024, close() { closed = true; } }), makeCanvas: () => fakeCanvas({ size: MAX_IMAGE_BYTES + 1, collect }) };
  await assert.rejects(normalizeMobileImage(file, options), { code: 'image_detail_budget' });
  assert.ok(closed); assert.equal(collect.length, 9); assert.equal(Math.min(...collect.map(x => x[2])), 0.86);
  assert.equal(collect.at(-1)[0], 1600);
});
test('empty, oversized, unsupported, decode-failed and encoding-failed photos never produce upload files', async () => {
  const never = { decodeImage: () => assert.fail('must not decode') };
  for (const file of [new File([], 'empty.jpg'), { size: MAX_SOURCE_BYTES + 1 }]) await assert.rejects(normalizeMobileImage(file, never), { code: 'image_size' });
  await assert.rejects(normalizeMobileImage(new File(['<svg/>'], 'fake.jpg', { type: 'image/jpeg' }), never), { code: 'image_format' });
  const file = new File([jpeg], 'photo.jpg');
  await assert.rejects(normalizeMobileImage(file, { decodeImage: () => { throw Error('private'); } }), { code: 'image_processing' });
  await assert.rejects(normalizeMobileImage(file, { decodeImage: async () => ({ width: 120, height: 180 }), makeCanvas: () => fakeCanvas({ type: 'image/png' }) }), { code: 'image_processing' });
});
test('multipart budget counts front/back and text before any fetch', async () => {
  const form = new FormData();
  form.append('image', new Blob([new Uint8Array(MAX_IMAGE_BYTES)]));
  form.append('backImage', new Blob([new Uint8Array(MAX_IMAGE_BYTES)]));
  await assertUploadBudget(form);
  form.append('extra', 'x'.repeat(400 * 1024));
  await assert.rejects(assertUploadBudget(form), { code: 'upload_size' });
});
test('server refuses raw HEIC, unknown bytes, truncated images, huge files and decompression bombs', async () => {
  const bomb = await sharp({ create: { width: 6400, height: 6400, channels: 3, background: '#fff' } }).png().toBuffer();
  for (const bytes of [heic, Buffer.from('fake'), jpeg.subarray(0, 100), Buffer.alloc(MAX_IMAGE_BYTES + 1), bomb]) await assert.rejects(validateAnalysisImage(bytes));
});
const source = fs.readFileSync(new URL('../pages/api/predict.js', import.meta.url), 'utf8');
const parserSource = source.slice(source.indexOf('async function parseRequest('), source.indexOf('// ─── Claude response parsing'));
const parse = vm.runInNewContext(`${parserSource}\nparseRequest`, { formidable, fs, IMAGE_MAX_BYTES: MAX_IMAGE_BYTES, validateAnalysisImage });
async function multipart(entries) {
  const form = new FormData();
  for (const [key, value] of entries) form.append(key, value);
  const req = new Request('http://local/api/predict', { method: 'POST', body: form });
  const body = Buffer.from(await req.arrayBuffer());
  const stream = Readable.from([body]); stream.headers = { 'content-type': req.headers.get('content-type'), 'content-length': String(body.length) };
  return parse(stream);
}
test('real multipart parser accepts front/back validated bytes with untrusted MIME labels', async () => {
  const r = await multipart([['image', new File([jpeg], 'front.heic', { type: 'application/octet-stream' })], ['backImage', new File([jpeg], 'back.png', { type: 'image/png' })]]);
  assert.equal(r.imageMimeType, 'image/jpeg'); assert.equal(r.backImageMimeType, 'image/jpeg');
});
test('real multipart parser rejects bad backs, raw HEIF, back-only, duplicate and unexpected file fields', async () => {
  const front = new File([jpeg], 'front.jpg', { type: 'image/jpeg' });
  for (const entries of [
    [['image', front], ['backImage', new File(['fake'], 'back.jpg', { type: 'image/jpeg' })]],
    [['image', new File([heic], 'raw.heic', { type: 'image/heic' })]],
    [['backImage', front]], [['image', front], ['image', front]], [['unrecognized', front]],
  ]) await assert.rejects(multipart(entries));
});
for (const [id, response, code] of [
  ['sign-in', new Response('private login', { status: 401 }), 'authentication'],
  ['forbidden', new Response('{}', { status: 403 }), 'authentication'],
  ['redirect', new Response('', { status: 307 }), 'authentication'],
  ['platform limit', new Response('oversize', { status: 413 }), 'http'],
  ['HTML', new Response('<html>private</html>', { status: 200, headers: { 'content-type': 'text/html' } }), 'response_format'],
  ['JSON parse', new Response('{bad', { headers: { 'content-type': 'application/json' } }), 'response_format'],
  ['JSON shape', Response.json(null), 'response_format'],
  ['server error', Response.json({ error: 'Prediction unavailable.' }, { status: 503 }), 'http'],
]) test(`upload reports ${id} distinctly without raw response contents`, async () => {
  await assert.rejects(requestPrediction({ method: 'POST' }, async () => response), error => error instanceof UploadError && error.code === code && !error.message.includes('private'));
});
test('genuine network rejection is separate; requests retain same-origin credentials and never follow redirects', async () => {
  await assert.rejects(requestPrediction({}, () => { throw Error('sensitive transport details'); }), { code: 'network' });
  const result = await requestPrediction({ method: 'POST' }, async (url, options) => {
    assert.equal(url, '/api/predict'); assert.equal(options.credentials, 'same-origin'); assert.equal(options.redirect, 'manual');
    return Response.json({ remaining: 2 });
  });
  assert.equal(result.data.remaining, 2);
});
test('rate limits retain their separate user-facing state', async () => {
  const r = await requestPrediction({}, async () => Response.json({ message: 'Wait before retrying.' }, { status: 429 }));
  assert.equal(r.response.status, 429); assert.equal(r.data.message, 'Wait before retrying.');
});

test('stuck decoding fails with a processing timeout and releases a late bitmap', async () => {
  const { boundedImageDecode } = await import('../lib/mobileImages.mjs');
  let finish, closed = false;
  await assert.rejects(boundedImageDecode(() => new Promise(resolve => { finish = resolve; }), 5), { code: 'image_timeout' });
  finish({ close() { closed = true; } });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(closed, true);
});

test('oversized multipart files are rejected during parsing rather than sent to analysis', async () => {
  await assert.rejects(multipart([['image', new File([jpeg, new Uint8Array(MAX_IMAGE_BYTES)], 'oversize.jpg', { type: 'image/jpeg' })]]));
});
