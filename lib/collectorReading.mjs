export function isCollectorReading(value){
 if(typeof value!=='string')return false;
 const text=value.trim().replace(/^#\s*/,'').replace(/\s*([/-])\s*/g,'$1');
 return text.length<=40&&/\d/.test(text)&&/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/i.test(text);
}
