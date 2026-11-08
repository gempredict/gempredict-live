// Owner-authorized Preview extension of Full Analysis, not a financial gate.
import crypto from 'node:crypto';
import sharp from 'sharp';
import {diagnosticSession} from './scanDiagnosticsAuth.mjs';
export async function verifyConditionValidation(req,fields,front,back,env=process.env){
 const session=diagnosticSession(req,env);
 if(!session)throw Error('validation_unauthorized');
 let manifest;
 try{if(typeof fields.validationManifest!=='string'||fields.validationManifest.length>6000)throw Error();manifest=JSON.parse(fields.validationManifest);}catch{throw Error('validation_manifest_invalid');}
 if(manifest?.version!==1||!/^[-a-f0-9]{36}$/.test(manifest.attemptId||'')||manifest.revision!==session.deployment.commit||!front||!back)throw Error('validation_manifest_invalid');
 for(const [side,bytes] of [['front',front],['back',back]]){
  const f=manifest.files?.[side],m=await sharp(bytes).metadata();
  if(!f||f.side!==side||f.mime!=='image/jpeg'||m.format!=='jpeg'||f.size!==bytes.length||f.width!==m.width||f.height!==m.height||f.sha256!==crypto.createHash('sha256').update(bytes).digest('hex'))throw Error('validation_manifest_mismatch');
 }
 return {attemptId:manifest.attemptId,revision:manifest.revision,preparedImagesMatched:true,marketplace:'not_requested',reason:'owner_condition_validation'};
}
