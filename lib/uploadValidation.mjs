import sharp from 'sharp';
import { imageKind, MAX_IMAGE_BYTES } from './mobileImages.mjs';
// Actual decoding, not client-supplied MIME or extension, establishes validity.
export async function validateAnalysisImage(buffer) {
  if (!buffer || !buffer.length || buffer.length > MAX_IMAGE_BYTES) throw new Error('image_size');
  const kind = imageKind(buffer.subarray(0, 64));
  const mime = { jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif' }[kind];
  if (!mime) throw new Error('image_format');
  const image = sharp(buffer, { limitInputPixels: 40000000, failOn: 'warning' });
  await image.stats(); // Forces decode; truncated/header-only files cannot pass.
  return mime;
}
