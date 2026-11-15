// Browser-only decoding; originals never leave the device. No sharpening,
// cropping, colour enhancement or upscaling is applied to condition evidence.
export const MAX_SOURCE_BYTES = 25 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 1600 * 1024;
export const MAX_UPLOAD_BYTES = 3500 * 1024; // Includes multipart fields/boundaries.
export class UploadError extends Error {
  constructor(code, message) { super(message); this.name = 'UploadError'; this.code = code; }
}
export function imageKind(bytes) {
  const ascii = (a, b) => String.fromCharCode(...bytes.slice(a, b));
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return 'jpeg';
  if (ascii(0, 8) === '\x89PNG\r\n\x1a\n') return 'png';
  if (['GIF87a', 'GIF89a'].includes(ascii(0, 6))) return 'gif';
  if (ascii(0, 4) === 'RIFF' && ascii(8, 12) === 'WEBP') return 'webp';
  if (ascii(4, 8) === 'ftyp') {
    const brands = [];
    for (let i = 8; i + 4 <= bytes.length; i += 4) brands.push(ascii(i, i + 4));
    if (brands.some(b => ['avif', 'avis'].includes(b))) return 'avif';
    if (brands.some(b => ['heic', 'heix', 'hevc', 'hevx', 'mif1', 'msf1'].includes(b))) return 'heic';
  }
  return null;
}
export function imageDimensions(width, height, maxEdge = 2560) {
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || width * height > 40000000) {
    throw new UploadError('image_dimensions', 'Photo dimensions are invalid or exceed 40 megapixels. Choose a smaller photo.');
  }
  const scale = Math.min(1, maxEdge / Math.max(width, height));
  return { width: Math.max(1, Math.round(width * scale)), height: Math.max(1, Math.round(height * scale)) };
}
async function browserDecode(file) {
  // Both paths apply native EXIF orientation once. Never manually rotate again.
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file, { imageOrientation: 'from-image' }); } catch {}
  }
  const url = URL.createObjectURL(file);
  try {
    const image = new Image();
    image.src = url;
    await image.decode();
    return { width: image.naturalWidth, height: image.naturalHeight, source: image };
  } finally { URL.revokeObjectURL(url); }
}
async function decode(file, kind) {
  try { return await browserDecode(file); } catch {
    if (kind !== 'heic') throw new UploadError('image_decode', 'Could not read this photo. Choose a valid photo or take a new picture.');
  }
  try {
    // Lazy, locally bundled CSP-compatible libheif worker; no CDN or upload.
    const { heicTo } = await import('heic-to/csp');
    return await heicTo({ blob: file, type: 'bitmap' });
  } catch {
    throw new UploadError('heic_decode', 'Could not convert this HEIF/HEIC photo on this device. Export it as JPEG or take a new picture.');
  }
}
export function boundedImageDecode(operation, timeoutMs = 45000) {
  return new Promise((resolve, reject) => {
    let expired = false;
    const timer = setTimeout(() => {
      expired = true;
      reject(new UploadError('image_timeout', 'Photo processing timed out. Choose a smaller photo or export it as JPEG.'));
    }, timeoutMs);
    Promise.resolve().then(operation).then(image => {
      clearTimeout(timer);
      if (expired) image?.close?.(); else resolve(image);
    }, error => { clearTimeout(timer); reject(error); });
  });
}
export async function normalizeMobileImage(file, { decodeImage = decode, makeCanvas = () => document.createElement('canvas') } = {}) {
  if (!file || !file.size || file.size > MAX_SOURCE_BYTES) throw new UploadError('image_size', 'Choose a nonempty photo under 25 MB.');
  const kind = imageKind(new Uint8Array(await file.slice(0, 64).arrayBuffer()));
  if (!kind) throw new UploadError('image_format', 'Unsupported image. Choose JPEG, PNG, WebP, GIF, AVIF or HEIF/HEIC.');
  let image, canvas;
  try {
    image = await boundedImageDecode(() => decodeImage(file, kind));
    imageDimensions(image.width, image.height);
    canvas = makeCanvas();
    for (const edge of [2560, 2048, 1600]) {
      const size = imageDimensions(image.width, image.height, edge);
      canvas.width = size.width; canvas.height = size.height;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas unavailable');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size.width, size.height);
      ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(image.source || image, 0, 0, size.width, size.height);
      for (const quality of [0.94, 0.90, 0.86]) {
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', quality));
        if (!blob || blob.type !== 'image/jpeg') throw new Error('JPEG encoding unavailable');
        if (blob.size <= MAX_IMAGE_BYTES) return new File([blob], 'card-photo.jpg', { type: 'image/jpeg' });
      }
    }
    throw new UploadError('image_detail_budget', 'This photo cannot fit safely without losing detail. Crop the background around the entire card or choose a smaller photo.');
  } catch (error) {
    if (error instanceof UploadError) throw error;
    throw new UploadError('image_processing', 'Photo processing failed. Choose another photo or try again.');
  } finally {
    image?.close?.();
    if (canvas) { canvas.width = 1; canvas.height = 1; }
  }
}
export async function assertUploadBudget(form) {
  // Request serialization calculates the actual multipart size, including text.
  if ((await new Response(form).blob()).size > MAX_UPLOAD_BYTES) throw new UploadError('upload_size', 'The combined photos are too large. Choose smaller front/back photos.');
}
