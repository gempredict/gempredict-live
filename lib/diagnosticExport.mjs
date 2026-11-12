// Explicit owner export only. No persistent storage, provider call or report trust mutation.
export async function prepareDiagnosticExport(handle,{fetchImpl=fetch,now=Date.now,signal}={}){
 if(!handle?.ticket||!handle.scanId||!handle.expiresAt||now()>=handle.expiresAt)throw Error('Diagnostic unavailable or expired. This export cannot be recovered here. Do not run another scan to recover it.');
 const r=await fetchImpl('/api/scan-diagnostics',{method:'POST',credentials:'same-origin',cache:'no-store',redirect:'error',signal,headers:{'Content-Type':'application/json'},body:JSON.stringify({action:'download',ticket:handle.ticket,scanId:handle.scanId})});
 if(!r.ok)throw Error(r.status===403?'Owner authorization or diagnostic access expired. Reauthorizing creates a new session and cannot restore this ticket. Do not repeat the paid scan.':'Diagnostic export request failed. Check your connection and tap Download Scan Diagnostics again before the displayed expiry. No scan was submitted.');
 const blob=await r.blob();if(blob.size>24576)throw Error('Diagnostic export was invalid. Keep the existing prepared files and contact the owner for review; do not rescan.');
 let d;try{d=JSON.parse(await blob.text());}catch{throw Error('Diagnostic export was invalid. Keep the existing prepared files; do not rescan.');}
 if(now()>=handle.expiresAt)throw Error('Diagnostic expired while preparing the file. No download was initiated. Do not repeat the paid scan.');
 if(handle.failed&&(!Number.isInteger(d?.responseStatus)||d.responseStatus<400||d.responseStatus>599))throw Error('Diagnostic does not describe this failed attempt. Keep existing evidence and stop; do not rescan.');
 if(d?.version!==1||d.scanId!==handle.scanId||d.environment!=='preview'||d.stage!=='full'||d.conditionValidation?.attemptId!==handle.attemptId||d.conditionValidation?.preparedImagesMatched!==true||d.conditionValidation?.marketplace!=='not_requested'||['front','back'].some(side=>!handle.preparedHashes?.[side]||d.images?.[side]?.preparedSha256!==handle.preparedHashes[side]))throw Error('Diagnostic does not match this controlled pair. Keep the prepared JPEGs and manifest for review; do not rescan.');
 return new Blob([await blob.arrayBuffer()],{type:'application/json'});
}
export function initiateDiagnosticDownload(blob,scanId){
 const url=URL.createObjectURL(blob),a=document.createElement('a');
 try{a.href=url;a.download='gempredict-scan-'+scanId+'.json';document.body.appendChild(a);a.click();}
 finally{a.remove();setTimeout(()=>URL.revokeObjectURL(url),30000);}
}
