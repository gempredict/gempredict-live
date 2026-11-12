// Volatile capability storage only. Never attach handles to a report or storage.
const access=new WeakMap();
export function rememberScanDiagnostic(report,response,{controlled=false,manifest=null,failed=false}={}){
 const ticket=response.headers?.get('X-GemPredict-Diagnostic-Ticket');
 const scanId=response.headers?.get('X-GemPredict-Diagnostic-Scan');
 const valid=typeof ticket==='string'&&ticket.length>0&&ticket.length<=6000&&/^[-a-f0-9]{36}$/.test(scanId||'');
 const expires=Number(response.headers?.get('X-GemPredict-Diagnostic-Expires'));
 if(report&&typeof report==='object'&&(valid||controlled))access.set(report,{ticket:valid?ticket:null,scanId:valid?scanId:null,expiresAt:Number.isSafeInteger(expires)&&expires>0?expires:null,controlled:controlled===true,failed:failed===true,attemptId:manifest?.attemptId||null,preparedHashes:manifest?{front:manifest.files?.front?.sha256,back:manifest.files?.back?.sha256}:null});
}
export const scanDiagnosticAccess=report=>report&&access.get(report)||null;
