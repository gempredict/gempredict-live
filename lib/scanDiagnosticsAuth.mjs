// Server-only. No provider credential is used for diagnostic authorization.
import crypto from 'node:crypto';
import {deflateRawSync,inflateRawSync} from 'node:zlib';
import {resolveMarketBaseUrl} from './internalMarketRouting.mjs';
export const SESSION_COOKIE='__Host-gp-scan-diagnostics';
export const TICKET_HEADER='X-GemPredict-Diagnostic-Ticket';
export const SCAN_HEADER='X-GemPredict-Diagnostic-Scan';
export const EXPIRY_HEADER='X-GemPredict-Diagnostic-Expires';
export const diagnosticExpiry=(session,now)=>Math.min(session.exp,now+300000);
export const MAX_JSON=24576;
export function diagnosticDeployment(req,env=process.env){
 if(env.GEMPREDICT_PREVIEW_SCAN_DIAGNOSTICS_ENABLED!=='true'||env.VERCEL_ENV!=='preview'||env.VERCEL!=='1'||
  env.VERCEL_GIT_COMMIT_REF!=='reconcile/iphone-upload-2026-11-03'||env.VERCEL_GIT_REPO_OWNER!=='gempredict'||env.VERCEL_GIT_REPO_SLUG!=='gempredict-live'||
  env.VERCEL_PROJECT_ID!=='prj_hu0Q2BybH0PskmTxFaEkz1NVtus4'||!/^[a-f0-9]{40}$/i.test(env.VERCEL_GIT_COMMIT_SHA||'')||
  !/^[a-f0-9]{64}$/i.test(env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY||'')||
  !/^[a-f0-9]{64}$/i.test(env.GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY||'')||env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY===env.GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY)return null;
 const route=resolveMarketBaseUrl(undefined,env);if(!route.ok)return null;
 const origin=route.baseUrl;
 if(req.headers?.host!==new URL(origin).host||req.headers?.origin && req.headers.origin!==origin)return null;
 if(req.method!=='GET'&&req.headers?.origin!==origin)return null;
 return {origin,commit:env.VERCEL_GIT_COMMIT_SHA,ownerKey:env.GEMPREDICT_SCAN_DIAGNOSTICS_OWNER_KEY,signingKey:env.GEMPREDICT_SCAN_DIAGNOSTICS_SIGNING_KEY};
}
function seal(data,purpose,deployment){
 const key=crypto.createHash('sha256').update(purpose+'\0'+deployment.signingKey+'\0'+deployment.ownerKey).digest();
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);
 cipher.setAAD(Buffer.from(purpose+'\0'+deployment.origin+'\0'+deployment.commit));
 const json=Buffer.from(JSON.stringify(data));if(json.length>MAX_JSON)throw Error('diagnostic_limit');
 const bytes=Buffer.concat([iv,cipher.update(deflateRawSync(json)),cipher.final(),cipher.getAuthTag()]);
 const token=bytes.toString('base64url');if(token.length>6000)throw Error('diagnostic_limit');return token;
}
function open(token,purpose,deployment,now){
 try{
  if(typeof token!=='string'||token.length>6000||!/^[a-zA-Z0-9_-]+$/.test(token))return null;
  const bytes=Buffer.from(token,'base64url');if(bytes.length<29||bytes.toString('base64url')!==token)return null;
  const key=crypto.createHash('sha256').update(purpose+'\0'+deployment.signingKey+'\0'+deployment.ownerKey).digest();
  const cipher=crypto.createDecipheriv('aes-256-gcm',key,bytes.subarray(0,12));
  cipher.setAAD(Buffer.from(purpose+'\0'+deployment.origin+'\0'+deployment.commit));cipher.setAuthTag(bytes.subarray(-16));
  const data=JSON.parse(inflateRawSync(Buffer.concat([cipher.update(bytes.subarray(12,-16)),cipher.final()]),{maxOutputLength:MAX_JSON}).toString());
  return data.v===1&&Number.isFinite(data.iat)&&data.iat<=now&&Number.isFinite(data.exp)&&data.exp>now?data:null;
 }catch{return null;}
}
export function diagnosticSession(req,env=process.env,now=Date.now()){
 const deployment=diagnosticDeployment(req,env);if(!deployment)return null;
 const cookie=req.headers?.cookie;if(typeof cookie!=='string'||cookie.length>8192)return null;
 const token=cookie.split(';').map(v=>v.trim()).find(v=>v.startsWith(SESSION_COOKIE+'='))?.slice(SESSION_COOKIE.length+1);
 const session=open(token,'gp-diagnostic-session-v1',deployment,now);
 return session&&session.exp-session.iat===900000&&typeof session.sid==='string'?{deployment,sid:session.sid,exp:session.exp}:null;
}
export function authorizeDiagnosticOwner(req,provided,env=process.env,now=Date.now()){
 const deployment=diagnosticDeployment(req,env);if(!deployment||typeof provided!=='string'||provided.length!==64)return null;
 if(!crypto.timingSafeEqual(crypto.createHash('sha256').update(provided).digest(),crypto.createHash('sha256').update(deployment.ownerKey).digest()))return null;
 const token=seal({v:1,iat:now,exp:now+900000,sid:crypto.randomUUID()},'gp-diagnostic-session-v1',deployment);
 return `${SESSION_COOKIE}=${token}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=900`;
}
export function issueDiagnosticTicket(diagnostics,session,now=Date.now()){
 return seal({v:1,iat:now,exp:diagnosticExpiry(session,now),sid:session.sid,scanId:diagnostics.scanId,diagnostics},'gp-diagnostic-export-v1',session.deployment);
}
export function readDiagnosticTicket(req,ticket,scanId,env=process.env,now=Date.now()){
 const session=diagnosticSession(req,env,now);if(!session||typeof scanId!=='string'||!/^[-a-f0-9]{36}$/.test(scanId))return null;
 const d=open(ticket,'gp-diagnostic-export-v1',session.deployment,now);
 return d&&d.exp-d.iat<=300000&&d.sid===session.sid&&d.scanId===scanId&&d.diagnostics?.scanId===scanId?d.diagnostics:null;
}
