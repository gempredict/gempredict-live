import test from 'node:test';
import assert from 'node:assert/strict';
import sharp from 'sharp';
import { imageKind, imageDimensions, normalizeMobileImage, assertUploadBudget, UploadError, MAX_IMAGE_BYTES } from '../lib/mobileImages.mjs';
import { validateAnalysisImage } from '../lib/uploadValidation.mjs';
import { requestPrediction } from '../lib/predictionTransport.mjs';

test('recognizes iPhone HEIC signatures independently of file extension and MIME', () => {
  const bytes = new Uint8Array(64);
  bytes.set([102,116,121,112,104,101,105,99], 4); // ftypheic
  assert.equal(imageKind(bytes), 'heic');
  assert.equal(imageKind(new Uint8Array([255,216,255,0])), 'jpeg');
  assert.equal(imageKind(new Uint8Array(64)), null);
});

test('preserves aspect ratio without upscaling and rejects excessive pixels', () => {
  assert.deepEqual(imageDimensions(4032,3024), {width:2560,height:1920});
  assert.deepEqual(imageDimensions(120,180), {width:120,height:180});
  assert.throws(() => imageDimensions(10000,5000), UploadError);
});

test('prepares front/back HEIC consistently as bounded JPEG, with no real service calls', async () => {
  const bytes = new Uint8Array(64);
  bytes.set([102,116,121,112,104,101,105,99], 4);
  let closed=0, decoded=0;
  const fakeCanvas = () => ({
    width:0,height:0,
    getContext:() => ({fillRect(){},drawImage(){}}),
    toBlob:cb => cb(new Blob([new Uint8Array([255,216,255,217])],{type:'image/jpeg'}))
  });
  for (const side of ['front','back']) {
    const file = new File([bytes], side+'.HEIC', {type:''});
    const output=await normalizeMobileImage(file,{
      decodeImage: async (_,kind)=>{ assert.equal(kind,'heic'); decoded++; return {width:120,height:180,close(){closed++}}; },
      makeCanvas:fakeCanvas
    });
    assert.equal(output.type,'image/jpeg');
    assert.equal(output.name,'card-photo.jpg');
    assert.ok(output.size <= MAX_IMAGE_BYTES);
  }
  assert.equal(decoded,2); assert.equal(closed,2);
});

test('rejects unknown photos before submitting anything', async () => {
  const file=new File([new Uint8Array(64)],'pretend.heic',{type:'image/heic'});
  await assert.rejects(normalizeMobileImage(file), e=>e instanceof UploadError && e.code==='image_format');
});

test('server validates decoded bytes rather than file MIME', async () => {
  const jpeg=await sharp({create:{width:20,height:30,channels:3,background:'#ffffff'}}).jpeg().toBuffer();
  assert.equal(await validateAnalysisImage(jpeg),'image/jpeg');
  await assert.rejects(validateAnalysisImage(Buffer.from('not an actual jpeg')));
  await assert.rejects(validateAnalysisImage(Buffer.alloc(MAX_IMAGE_BYTES+1)));
});

test('transport separates auth, invalid HTML, server errors and 429 rate limits', async () => {
  const mock = (status,type,body,extra={}) => async () => ({
    status,ok:status>=200&&status<300,type:extra.type||'basic',
    headers:{get:()=>type},json:async()=>body
  });
  await assert.rejects(requestPrediction({},mock(403,'text/html',null)),e=>e.code==='authentication');
  await assert.rejects(requestPrediction({},mock(200,'text/html',null)),e=>e.code==='response_format');
  await assert.rejects(requestPrediction({},mock(422,'application/json',{error:'No usable card photo'})),e=>e.message==='No usable card photo');
  const limited=await requestPrediction({},mock(429,'application/json',{message:'rate limit'}));
  assert.equal(limited.response.status,429);
  await assert.rejects(requestPrediction({},async()=>{throw Error('offline')}),e=>e.code==='network');
});

test('blocks oversized serialized multipart before upload', async () => {
  const form=new FormData();
  form.append('image',new File([new Uint8Array(4*1024*1024)],'large.jpg',{type:'image/jpeg'}));
  await assert.rejects(assertUploadBudget(form),e=>e.code==='upload_size');
});
