import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const base=process.argv[2]||'http://localhost:3014',out=process.argv[3]||'outputs/off14/local';mkdirSync(out,{recursive:true});
const baseline=JSON.parse(readFileSync('scripts/fixtures/off14/production-row-baseline.json','utf8'));
const b=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const results=[];const sources=new Set();
function approved(value){const u=new URL(value,base);if(u.pathname==='/_next/image')return approved(u.searchParams.get('url'));return u.origin===new URL(base).origin||['img.youtube.com','img.mlbstatic.com'].includes(u.hostname);}
try {for(const width of [1440,390]){const p=await b.newPage({viewport:{width,height:1000}});p.on('request',r=>{if(r.resourceType()==='image'){assert(approved(r.url()),r.url());sources.add(r.url());}});
for(const route of (base.includes('localhost')?['/2026']:['/2026','/'])){await p.goto(base+route,{waitUntil:'networkidle'});const rows=p.locator('[data-review-start-id]');const n=await rows.count();assert.equal(n,route==='/2026'?25:5);assert.equal(await p.locator('[data-review-gem]').count(),5);
const text=await rows.evaluateAll(es=>es.map(e=>({id:e.dataset.reviewStartId,text:e.querySelector('article').innerText})));assert.deepEqual(text,baseline[route],'frozen row text unchanged');
let maxHeight=0;
for(let i=0;i<n;i++){const row=rows.nth(i);const compact=row.locator('[data-highlight-thumbnail]');assert.equal(await compact.count(),i<5?0:1);if(i>=5){await compact.scrollIntoViewIfNeeded();const box=await compact.boundingBox();assert(Math.abs(box.width/box.height-16/9)<.05);assert.equal(box.width,width===390?80:112);assert.match(await compact.getAttribute('aria-label'),/^Watch highlight: .+, 2026-\d\d-\d\d$/);assert.match(await compact.getAttribute('title'),/Highlight · MLB/);const img=compact.locator('img');await img.evaluate(im=>im.decode());assert(await img.evaluate(im=>im.naturalWidth>0));const height=(await row.boundingBox()).height;maxHeight=Math.max(maxHeight,height);if(width===390)assert(height<=210,`compact row ${i+1}: ${height} >210px`);}}
assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
if(route==='/2026'){
for(let i=3;i<7;i++){for(const im of await rows.nth(i).locator('img:visible').all()){await im.scrollIntoViewIfNeeded();await im.evaluate(im=>im.decode());}}
await rows.nth(3).scrollIntoViewIfNeeded();await p.evaluate(()=>window.scrollTo(0,0));const a=await rows.nth(3).boundingBox(),z=await rows.nth(6).boundingBox();await p.screenshot({path:`${out}/rows-4-7-${width}.png`,fullPage:true,clip:{x:a.x,y:a.y,width:a.width,height:z.y+z.height-a.y}});
await rows.nth(5).locator('[data-highlight-thumbnail]').click();await p.getByRole('dialog').waitFor();assert.equal(await p.getByRole('dialog').locator('iframe,video').count(),1);await p.getByRole('button',{name:'Close highlight'}).click();}
results.push({route,width,rows:n,cards:5,compact:n-5,maxCompactHeight:maxHeight,frozenText:'identical',overflow:false});}
await p.close();}
writeFileSync(`${out}/results.json`,JSON.stringify({base,results,approvedImageRequests:sources.size},null,2));console.log(JSON.stringify({base,results,approvedImageRequests:sources.size},null,2));}finally{await b.close();}

