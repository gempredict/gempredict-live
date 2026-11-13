// Syntax validates a transcription, never a catalog identity. Alphabetic sports
// schemes need explicit review; do not accept arbitrary hyphenated words.
const sportsAlphabeticPrefixes=new Set(['PA']); // Observed Bowman autograph PA-JD.
export function isCollectorReading(value,category){
 if(typeof value!=='string')return false;
 const text=value.trim().replace(/^#\s*/,'').replace(/\s*([/-])\s*/g,'$1');
 if(category==='sports'){
  if(value.length>40||/[\x00-\x1f\x7f]/.test(value)||text.length>20)return false;
  if(/^\d{1,6}$/.test(text))return true;
  if(/^(?:[a-z]{1,6}\d{1,6}|[a-z]{1,6}-[a-z0-9]{1,8})$/i.test(text)&&/\d/.test(text))return true;
  const initials=text.toUpperCase().match(/^([A-Z]{2,4})-([A-Z]{2,3})$/);
  return !!initials&&sportsAlphabeticPrefixes.has(initials[1]);
 }
 // Existing Pokémon/legacy grammar, including promo and subset identifiers.
 return text.length<=40&&/\d/.test(text)&&/^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)?$/i.test(text);
}
