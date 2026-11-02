import crypto from "node:crypto";
// Short-lived scan binding, not an authentication token. Server validation only.
const secret=()=>process.env.IDENTITY_REVIEW_SIGNING_KEY||null;
const b64=o=>Buffer.from(JSON.stringify(o)).toString("base64url");
export function issueIdentityReviewToken(scan){
 const key=secret();if(!key)return null;
 const payload=b64({v:1,t:Date.now(),catalogId:scan.catalogId||null,subject:scan.subject||null,
 number:scan.number||null,set:scan.set||null,conflicts:scan.conflicts||[],
 imageAnalyzed:scan.imageAnalyzed===true});
 const sig=crypto.createHmac("sha256",key).update("gempredict-identity-review-v1."+payload).digest("base64url");
 return payload+"."+sig;
}
export function verifyIdentityReviewToken(token){
 const key=secret();if(!key||typeof token!=="string"||token.length>1600)return null;
 const [p,s,...extra]=token.split(".");if(!p||!s||extra.length)return null;
 const sig=crypto.createHmac("sha256",key).update("gempredict-identity-review-v1."+p).digest("base64url");
 const a=Buffer.from(sig),b=Buffer.from(s);
 if(a.length!==b.length||!crypto.timingSafeEqual(a,b))return null;
 try{
  const d=JSON.parse(Buffer.from(p,"base64url").toString("utf8"));
  if(d.v!==1||!Number.isFinite(d.t)||d.t>Date.now()+30000||Date.now()-d.t>15*60*1000||!d.imageAnalyzed)return null;
  return d;
 }catch{return null;}
}
