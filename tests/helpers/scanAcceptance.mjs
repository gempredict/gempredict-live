// Explicit offline fixtures. The HEIF is libheif's sample, NOT the user's card.
import vm from 'node:vm';
import fs from 'node:fs';
import { Readable } from 'node:stream';
import formidable from 'formidable';
import { createHash } from 'node:crypto';
import { validateAnalysisImage } from '../../lib/uploadValidation.mjs';
import { MAX_IMAGE_BYTES } from '../../lib/mobileImages.mjs';
import { title } from './liveReportFixture.mjs';
const source = fs.readFileSync(new URL('../../pages/api/predict.js',import.meta.url),'utf8');
const parser = source.slice(source.indexOf('async function parseRequest('),source.indexOf('// ─── Claude response parsing'));
const parse = vm.runInNewContext(`${parser}\nparseRequest`,{formidable,fs,validateAnalysisImage,IMAGE_MAX_BYTES:MAX_IMAGE_BYTES});
export async function parseBrowserUpload(body,contentType) {
 const stream=Readable.from([body]);stream.headers={'content-type':contentType,'content-length':String(body.length)};
 return parse(stream);
}
export const digest = value => createHash('sha256').update(typeof value === 'string' || Buffer.isBuffer(value) ? value : JSON.stringify(value)).digest('hex');
export const askingFixture=()=>({itemId:'v1|123456789012|0',itemWebUrl:'https://www.ebay.com/itm/123456789012',title,condition:'Ungraded',localizedAspects:[{name:'Language',value:'English'}],price:{value:'56.99',currency:'USD'}});
