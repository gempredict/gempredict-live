// Source URLs are data, never navigation supplied without validation. US Browse
// links must identify the same original listing; tracking parameters are removed.
const idFromUrl = value => {
 try { const url = new URL(value); if (url.protocol !== 'https:' || !['www.ebay.com','ebay.com'].includes(url.hostname) || url.username || url.password || url.port) return null;
 return url.pathname.match(/^\/itm\/(?:[^/]+\/)?(\d{1,15})\/?$/)?.[1] || null;
 } catch { return null; }
};
const idFromItem = value => typeof value === 'string' ? value.match(/^v1\|(\d{9,15})\|[^|]+$/)?.[1] || value.match(/^\d{9,15}$/)?.[0] || null : null;
export function safeEbayListingUrl(item) {
 const urlId = idFromUrl(item?.itemWebUrl), itemId = idFromItem(item?.itemId);
 return urlId && urlId.length >= 9 && itemId === urlId ? `https://www.ebay.com/itm/${urlId}` : null;
}
export function stableListingKeys(item) {
 const keys = [];
 if (typeof item?.itemId === 'string' && item.itemId.trim()) keys.push(`id:${item.itemId.trim()}`);
 const original = idFromItem(item?.itemId), url = idFromUrl(item?.itemWebUrl);
 if (original) keys.push(`original:${original}`);
 if (url) keys.push(`original:${url}`);
 return [...new Set(keys)];
}
const normalized = value => String(value ?? '').trim().toLowerCase().replace(/\s+/g,' ');
const fingerprint = item => JSON.stringify([normalized(item.title), Number(item.price?.value), item.price?.currency,
 normalized(item.condition), (Array.isArray(item.localizedAspects) ? item.localizedAspects : []).map(x => [normalized(x.name),normalized(x.value)]).sort()]);
export function deduplicateBrowseListings(items) {
 const groups=[], seen=new Map();
 for(const item of items){
  const keys=stableListingKeys(item); const matches=[...new Set(keys.map(key=>seen.get(key)).filter(Boolean))];
  const group=matches[0] || {items:[],keys:[]};
  if(!matches.length) groups.push(group);
  for(const other of matches.slice(1)){group.items.push(...other.items);group.keys.push(...other.keys);other.removed=true;}
  group.items.push(item);group.keys.push(...keys);
  for(const key of group.keys)seen.set(key,group);
 }
 const unique=[];let duplicateCount=0,conflictingDuplicateCount=0;
 for(const group of groups.filter(g=>!g.removed)){
  if(group.items.some(item=>fingerprint(item)!==fingerprint(group.items[0]))){conflictingDuplicateCount+=group.items.length;continue;}
  duplicateCount+=group.items.length-1;unique.push(group.items[0]);
 }
 return {items:unique,duplicateCount,conflictingDuplicateCount};
}
