// Volatile capability storage only. Never attach handles to a report or storage.
const access=new WeakMap();
export function rememberScanDiagnostic(report,response){
 const ticket=response.headers?.get('X-GemPredict-Diagnostic-Ticket');
 const scanId=response.headers?.get('X-GemPredict-Diagnostic-Scan');
 if(report&&typeof report==='object'&&typeof ticket==='string'&&ticket.length<=6000&&/^[-a-f0-9]{36}$/.test(scanId||''))access.set(report,{ticket,scanId});
}
export const scanDiagnosticAccess=report=>report&&access.get(report)||null;
