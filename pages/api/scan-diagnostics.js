import {diagnosticDeployment,diagnosticSession,authorizeDiagnosticOwner,readDiagnosticTicket} from '../../lib/scanDiagnosticsAuth.mjs';
export const config={api:{bodyParser:{sizeLimit:'10kb'}}};
export default function handler(req,res){
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Vary','Cookie, Origin');res.setHeader('X-Content-Type-Options','nosniff');
 if(!diagnosticDeployment(req))return res.status(404).json({error:'unavailable'});
 if(req.method==='GET'){const session=diagnosticSession(req);return res.status(200).json({enabled:true,authorized:!!session,expiresAt:session?.exp||null});}
 if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
 if(req.body?.action==='authorize'){
  const cookie=authorizeDiagnosticOwner(req,req.body.key);
  if(!cookie)return res.status(401).json({error:'unauthorized'});
  res.setHeader('Set-Cookie',cookie);return res.status(200).json({authorized:true,expiresAt:Date.now()+900000});
 }
 if(req.body?.action!=='download')return res.status(400).json({error:'invalid_request'});
 const diagnostics=readDiagnosticTicket(req,req.body.ticket,req.body.scanId);
 if(!diagnostics)return res.status(403).json({error:'invalid_or_expired_export'});
 res.setHeader('Content-Disposition',`attachment; filename="gempredict-scan-${diagnostics.scanId}.json"`);
 return res.status(200).json(diagnostics);
}
