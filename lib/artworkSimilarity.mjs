// A conservative, non-AI visual similarity diagnostic.
// This compares card-image patterns, not authenticity, printing, or grading.
// Unaligned/angled/glared user photos may be inconclusive. Never mark verified.
import sharp from "sharp";
const MAX_BYTES=5*1024*1024;
const SAFE_HOST="assets.tcgdex.net";
const SIZE=24;
async function readPattern(buffer, cropRatio=1) {
  const meta=await sharp(buffer,{limitInputPixels:20e6}).metadata();
  if(!meta.width||!meta.height)throw Error("unreadable");
  const width=Math.max(1,Math.floor(meta.width*cropRatio));
  const height=Math.max(1,Math.floor(meta.height*cropRatio));
  const left=Math.floor((meta.width-width)/2),top=Math.floor((meta.height-height)/2);
  const {data}=await sharp(buffer,{limitInputPixels:20e6}).extract({left,top,width,height})
    .resize(SIZE,SIZE,{fit:"fill"}).removeAlpha().raw().toBuffer({resolveWithObject:true});
  const vals=[];
  for(let i=0;i<data.length;i+=3){
    const [r,g,b]=[data[i],data[i+1],data[i+2]];
    // Chromaticity reduces overall lighting sensitivity.
    const sum=r+g+b+1;
    vals.push([(r-g)/sum,(g-b)/sum,(r+b-2*g)/sum]);
  }
  return vals;
}
function compare(a,b){
  let sum=0;
  for(let i=0;i<a.length;i++){
    for(let k=0;k<3;k++){
      const d=a[i][k]-b[i][k];sum+=d*d;
    }
  }
  return Math.max(0,1-Math.sqrt(sum/(a.length*3))/0.48);
}
export async function assessArtworkSimilarity(photoBuffer,referenceBaseUrl){
  if(!photoBuffer?.length||photoBuffer.length>MAX_BYTES)return {status:"inconclusive",verified:false,reason:"missing_or_oversize_photo"};
  let url;
  try{
    const base=new URL(String(referenceBaseUrl||""));
    if(base.protocol!=="https:"||base.hostname!==SAFE_HOST||!/^\/en\/[a-zA-Z0-9/_-]+$/.test(base.pathname))throw Error("bad");
    url=base.origin+base.pathname+"/low.webp";
  }catch{return {status:"inconclusive",verified:false,reason:"invalid_catalog_image_url"};}
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),5000);
  try{
    const response=await fetch(url,{signal:controller.signal,headers:{Accept:"image/webp"}});
    const len=Number(response.headers.get("content-length")||0);
    if(!response.ok||!String(response.headers.get("content-type")||"").startsWith("image/")||len>MAX_BYTES)
      return {status:"inconclusive",verified:false,reason:"reference_unavailable"};
    const ref=Buffer.from(await response.arrayBuffer());
    if(ref.length>MAX_BYTES)return {status:"inconclusive",verified:false,reason:"reference_too_large"};
    const target=await readPattern(ref);
    const candidates=await Promise.all([1,0.9,0.8,0.7].map(r=>readPattern(photoBuffer,r)));
    const similarity=Math.max(...candidates.map(x=>compare(x,target)));
    return {status: similarity>=0.8?"visual_pattern_similar":"inconclusive",
      verified:false,similarity:Number(similarity.toFixed(3)),
      method:"chromaticity thumbnail comparison (unaligned; diagnostic only)",
      reason:"Cannot independently establish exact artwork, image alignment or printing variant"};
  }catch{return {status:"inconclusive",verified:false,reason:"image_comparison_unavailable"};}
  finally{clearTimeout(timer);}
}
