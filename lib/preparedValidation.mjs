import {MAX_IMAGE_BYTES} from './mobileImages.mjs';
export async function preparedDimensions(file,{bitmap=globalThis.createImageBitmap,ImageImpl=globalThis.Image,url=URL}={}){
 if(typeof bitmap==='function'){try{const image=await bitmap(file);try{return {width:image.width,height:image.height};}finally{image.close();}}catch{}}
 const src=url.createObjectURL(file);
 try{const image=new ImageImpl();image.src=src;await image.decode();return {width:image.naturalWidth,height:image.naturalHeight};}finally{url.revokeObjectURL(src);}
}
export function downloadPrepared(blob,name){
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 try{a.href=url;a.download=name;document.body.appendChild(a);a.click();}finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
}
// Memory only. No re-encoding, localStorage, provider call or evidence upload.
export function createPreparedValidation({getFiles,revision,cryptoImpl=globalThis.crypto,dimensions=preparedDimensions,download=downloadPrepared}){
 let active=null,generation=0;
 const invalidate=()=>{generation++;active=null;};
 function check(a){const now=getFiles();if(!a||a!==active||a.consumed||now.busy||now.front!==a.front||now.back!==a.back||now.version!==a.version){invalidate();throw Error('Preparation changed or expired. Freeze and export again.');}}
 async function descriptor(file,side){
  if(!file||file.type!=='image/jpeg'||!file.size||file.size>MAX_IMAGE_BYTES)throw Error('Prepared JPEG required.');
  const hash=await cryptoImpl.subtle.digest('SHA-256',await file.arrayBuffer()),d=await dimensions(file);
  if(!Number.isInteger(d.width)||!Number.isInteger(d.height)||d.width<1||d.height<1||d.width*d.height>40000000)throw Error('Invalid prepared dimensions.');
  return {side,name:'prepared-'+side+'.jpg',sha256:Array.from(new Uint8Array(hash),b=>b.toString(16).padStart(2,'0')).join(''),size:file.size,mime:file.type,...d};
 }
 return {
  invalidate,
  async freeze(){invalidate();const token=generation,files=getFiles();if(files.busy||!files.front||!files.back||!/^[a-f0-9]{40}$/.test(revision||''))throw Error('Both prepared photos and Preview authorization are required.');
   const a={front:files.front,back:files.back,version:files.version,consumed:false,downloaded:new Set(),verified:new Set()};
   try{const front=await descriptor(a.front,'front'),back=await descriptor(a.back,'back');if(token!==generation)throw Error();active=a;check(a);a.manifest=Object.freeze({version:1,attemptId:cryptoImpl.randomUUID(),revision,files:Object.freeze({front:Object.freeze(front),back:Object.freeze(back)})});Object.defineProperty(a,'front',{writable:false});Object.defineProperty(a,'back',{writable:false});return a;}catch{invalidate();throw Error('Could not freeze/hash this preparation. No scan was submitted.');}
  },
  async export(a,kind){try{check(a);if(!['front','back','manifest'].includes(kind))throw Error();const blob=kind==='manifest'?new Blob([JSON.stringify(a.manifest,null,2)+'\n'],{type:'application/json'}):a[kind];await download(blob,a.manifest.attemptId+'-'+(kind==='manifest'?'manifest.json':'prepared-'+kind+'.jpg'));check(a);a.downloaded.add(kind);}catch{invalidate();throw Error('Download failed. Controlled scan blocked; prepare again.');}},
  async verifySaved(a,kind,file){try{check(a);if(!a.downloaded.has(kind)||!file)throw Error();if(kind==='manifest'){if(file.size>6000||JSON.stringify(JSON.parse(await file.text()))!==JSON.stringify(a.manifest))throw Error();}else{const actual=await descriptor(file,kind);if(JSON.stringify(actual)!==JSON.stringify(a.manifest.files[kind]))throw Error();}check(a);a.verified.add(kind);}catch{invalidate();throw Error('Saved evidence does not match. Controlled scan blocked; prepare again.');}},
  consume(a){check(a);if(['front','back','manifest'].some(k=>!a.downloaded.has(k)||!a.verified.has(k)))throw Error('Download and verify all three saved files first.');a.consumed=true;return {front:a.front,back:a.back,version:a.version,manifest:JSON.stringify(a.manifest)};}
 };
}
