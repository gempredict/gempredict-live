// Private transport envelope only. No archive extraction, URL redirects or logs.
import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,createCipheriv,createDecipheriv} from 'node:crypto';
import https from 'node:https';
import dns from 'node:dns';
import net from 'node:net';
import {HttpsProxyAgent} from 'https-proxy-agent';
import {hash,planBenchmark,providers,benchmarkProxy} from './core.mjs';
const MAGIC=Buffer.from('GPVB0001');
export const MAX_BUNDLE_BYTES=24*1024*1024;
export const ROLES=['original-front','original-back','improved-front','improved-back'];
export function dataKey(encoded) {
 if(typeof encoded!=='string'||!/^[A-Za-z0-9+/]{43}=$/.test(encoded))throw Error('invalid_data_key');
 const key=Buffer.from(encoded,'base64');if(key.length!==32)throw Error('invalid_data_key');return key;
}
export function seal(value,keyText,{purpose,revision,now=Date.now(),ttlMs=20*60000}={}) {
 if(!['photos','metrics'].includes(purpose)||!Number.isFinite(ttlMs)||ttlMs<=0||ttlMs>30*60000||!/^[a-f0-9]{40}$/.test(revision||''))throw Error('invalid_envelope_policy');
 const header=Buffer.from(JSON.stringify({version:1,purpose,revision,repository:'gempredict/gempredict-live',createdAt:now,expiresAt:now+ttlMs}));
 const plaintext=Buffer.from(JSON.stringify(value));if(plaintext.length>20*1024*1024)throw Error('bundle_size');
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',dataKey(keyText),iv);cipher.setAAD(header);
 const encrypted=Buffer.concat([cipher.update(plaintext),cipher.final()]),length=Buffer.alloc(4);length.writeUInt32BE(header.length);
 return Buffer.concat([MAGIC,length,header,iv,cipher.getAuthTag(),encrypted]);
}
export function openEnvelope(buffer,keyText,{purpose,revision,now=Date.now(),allowExpiredMetrics=false}={}) {
 if(!Buffer.isBuffer(buffer)||buffer.length>MAX_BUNDLE_BYTES||buffer.length<64||!buffer.subarray(0,8).equals(MAGIC))throw Error('invalid_envelope');
 const length=buffer.readUInt32BE(8);if(length<10||length>2048||buffer.length<12+length+29)throw Error('invalid_header');
 const header=buffer.subarray(12,12+length),iv=buffer.subarray(12+length,24+length),tag=buffer.subarray(24+length,40+length);
 const cipher=createDecipheriv('aes-256-gcm',dataKey(keyText),iv);cipher.setAAD(header);cipher.setAuthTag(tag);
 const plaintext=Buffer.concat([cipher.update(buffer.subarray(40+length)),cipher.final()]);
 const meta=JSON.parse(header);
 if(meta.version!==1||meta.purpose!==purpose||meta.revision!==revision||meta.repository!=='gempredict/gempredict-live'||!Number.isSafeInteger(meta.createdAt)||!Number.isSafeInteger(meta.expiresAt)||meta.expiresAt-meta.createdAt>30*60000||meta.expiresAt<=meta.createdAt||meta.createdAt>now+60000||meta.expiresAt<=now&&!(purpose==='metrics'&&allowExpiredMetrics))throw Error('envelope_expired_or_wrong_context');
 return JSON.parse(plaintext);
}
export function validatePrivateManifest(manifest) {
 if(!manifest||!Array.isArray(manifest.fixtures)||manifest.fixtures.length!==2||manifest.fixtures[0].id!=='original'||manifest.fixtures[1].id!=='improved'||manifest.fixtures.some(f=>f.category!=='pokemon'||!f.back?.path))throw Error('four_photo_manifest_required');
 const env=Object.fromEntries(Object.values(providers).map(p=>[p.key,'synthetic_validation_only']));
 const check=planBenchmark({...manifest,repeats:3,maxRequests:18,maxEstimatedCostUSD:4.25},{live:true,authorized:true,env});
 if(check.status!=='READY_FOR_AUTHORIZED_CALLS')throw Error('independently_reviewed_labels_and_consent_required');
}
export function packPhotos(manifest,root) {
 validatePrivateManifest(manifest);const photos={};let total=0;
 for(const fixture of manifest.fixtures)for(const side of ['front','back']){
  const spec=fixture[side],bytes=fs.readFileSync(path.resolve(root,spec.path));total+=bytes.length;
  if(!bytes.length||bytes.length>6*1024*1024||total>12*1024*1024||hash(bytes)!==spec.sha256)throw Error('photo_hash_or_size');
  photos[`${fixture.id}-${side}`]={sha256:spec.sha256,base64:bytes.toString('base64')};
 }
 return {version:1,manifest,photos};
}
export function unpackPhotos(value,directory) {
 validatePrivateManifest(value?.manifest);
 if(value.version!==1||JSON.stringify(Object.keys(value.photos||{}).sort())!==JSON.stringify([...ROLES].sort()))throw Error('unexpected_photo_entries');
 fs.mkdirSync(directory,{recursive:false,mode:0o700});const manifest=structuredClone(value.manifest);let total=0;
 for(const fixture of manifest.fixtures)for(const side of ['front','back']){
  const role=`${fixture.id}-${side}`,photo=value.photos[role];
  if(typeof photo.base64!=='string'||photo.base64.length>8*1024*1024||!/^[A-Za-z0-9+/]*={0,2}$/.test(photo.base64))throw Error('photo_encoding');
  const bytes=Buffer.from(photo.base64,'base64');total+=bytes.length;
  if(!bytes.length||bytes.length>6*1024*1024||total>12*1024*1024||hash(bytes)!==photo.sha256||photo.sha256!==fixture[side].sha256)throw Error('photo_hash_or_size');
  const file=path.join(directory,role+'.image');fs.writeFileSync(file,bytes,{flag:'wx',mode:0o600});fixture[side].path=file;
 }
 return manifest;
}
export function storageUrl(value,approvedHost) {
 if(typeof value!=='string'||value.length>8192||typeof approvedHost!=='string'||!approvedHost.includes('.'))throw Error('storage_configuration');
 const url=new URL(value);
 if(url.protocol!=='https:'||url.hostname!==approvedHost.toLowerCase()||url.port&&url.port!=='443'||url.username||url.password||url.hash||net.isIP(url.hostname)||/(?:^|\.)(?:localhost|local|internal)$/.test(url.hostname))throw Error('storage_origin');
 return url;
}
export function publicAddress(address) {
 if(net.isIPv4(address))return !/^(?:0\.|10\.|127\.|169\.254\.|172\.(?:1[6-9]|2\d|3[01])\.|192\.168\.|100\.(?:6[4-9]|[7-9]\d|1[01]\d|12[0-7])\.|198\.(?:18|19)\.|22[4-9]\.|2[3-5]\d\.)/.test(address);
 // Reject mapped IPv4 and local/link-local/multicast/unspecified IPv6 ranges.
 if(net.isIPv6(address))return !/^(?:::|fc|fd|fe[89ab]|ff)/i.test(address);
 return false;
}
export async function requestObject(value,host,{method='GET',body}={}) {
 const url=storageUrl(value,host);
 if(process.env.NODE_TLS_REJECT_UNAUTHORIZED==='0')throw Error('storage_tls_required');
 const addresses=await new Promise((resolve,reject)=>dns.lookup(url.hostname,{all:true},(error,rows)=>error?reject(Error('storage_dns')):resolve(rows)));
 if(!addresses.length||addresses.some(row=>!publicAddress(row.address)))throw Error('storage_dns');
 const proxy=benchmarkProxy(),agent=proxy?new HttpsProxyAgent(proxy):undefined;
 if(!['GET','PUT'].includes(method))throw Error('storage_method');
 return new Promise((resolve,reject)=>{
  const request=https.request(url,{method,agent,signal:AbortSignal.timeout(15000),headers:method==='PUT'?{'Content-Type':'application/octet-stream','Content-Length':body.length}:{Accept:'application/octet-stream'},lookup:(hostname,options,callback)=>{
   dns.lookup(hostname,{all:true},(error,addresses)=>{
    if(error||!addresses?.length||addresses.some(row=>!publicAddress(row.address)))return callback(Error('storage_dns'));
    callback(null,options?.all?addresses:addresses[0].address,addresses[0].family);
   });
  }},response=>{
   if(method==='GET'&&response.statusCode!==200||method==='PUT'&&![200,201,204].includes(response.statusCode)){response.destroy();reject(Error('storage_http'));return;}
   const chunks=[];let size=0;response.on('data',chunk=>{size+=chunk.length;if(size>(method==='GET'?MAX_BUNDLE_BYTES:65536))response.destroy(Error('storage_size'));else if(method==='GET')chunks.push(chunk);});
   response.on('error',()=>reject(Error('storage_transport')));response.on('end',()=>resolve(Buffer.concat(chunks)));
  });request.on('error',()=>reject(Error('storage_transport')));request.end(body);
 }).finally(()=>agent?.destroy());
}
