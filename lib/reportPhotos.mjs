// Session-only association with the exact normalized File objects submitted.
// No bytes, blob URLs or remote references are serialized into a report.
const images=new WeakMap();
export function attachReportPhotos(report,{front=null,back=null}={}){if(report&&typeof report==='object')images.set(report,{front,back});return report;}
export function reportPhotos(report){return report&&typeof report==='object'?images.get(report)||null:null;}
