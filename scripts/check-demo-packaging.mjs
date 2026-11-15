import fs from 'node:fs';
import path from 'node:path';
const marker='gempredict-private-synthetic-fixtures-v1';
function files(dir){return fs.readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?files(path.join(dir,e.name)):[path.join(dir,e.name)]);}
const chunks=files('.next/static').filter(f=>/\.(?:js|json)$/.test(f));
if(!chunks.length)throw Error('No built client assets to inspect');
for(const f of chunks)if(fs.readFileSync(f,'utf8').includes(marker))throw Error('Server-only demo fixture leaked into client assets: '+f);
const pages=JSON.parse(fs.readFileSync('.next/server/pages-manifest.json','utf8'));
if(!pages['/demo-report']||!pages['/api/demo-report'])throw Error('Demo page/API missing from server build');
if(!files('.next/server').filter(f=>f.endsWith('.js')).some(f=>fs.readFileSync(f,'utf8').includes(marker)))throw Error('Demo fixture not bundled with server page');
console.log('PASS demo packaging: owner-gated server page/API built; synthetic fixture excluded from client assets');
