import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {mkdir,writeFile} from 'node:fs/promises';
import path from 'node:path';
const [base,out]=process.argv.slice(2); await mkdir(out,{recursive:true});
const result={base,redirects:[],pages:[]};
for(const route of ['/live','/upcoming','/live/2026-10-28','/upcoming/week']) {
 const r=await fetch(base+route,{redirect:'manual'});assert.equal(r.status,302);assert.equal(new URL(r.headers.get('location'),base).pathname,'/'); result.redirects.push({route,status:r.status,location:r.headers.get('location')});
}
const latest=await fetch(base+'/starts',{redirect:'manual'});assert.equal(latest.status,302);assert.equal(new URL(latest.headers.get('location'),base).pathname,'/starts/2026-10-28');
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
try {
for(const width of [1440,390]) for(const [route,count] of [['/starts',2],['/starts/2026-09-27',28],['/starts/2026-10-22',0]]) {
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});
 await page.goto(base+route,{waitUntil:'networkidle',timeout:120000});
 const text=await page.locator('main').innerText();assert(!/No starts scheduled|Check upcoming matchups|Generated image/i.test(text));
 const nav=page.getByRole('navigation',{name:'Primary',exact:true});assert.deepEqual((await nav.locator('a').allTextContents()).map(s=>s.trim().toUpperCase()),['HOME','RANKED STARTS','HEAT CHECK','WATCHLIST']);
 assert.equal(await page.locator('main a[href^="/upcoming"]').count(),0);
 const rows=page.locator('[data-responsive-check="ranked-start-card"]:not([data-skeleton-row]),[data-responsive-check="short-start-card"]');
 assert.equal(await rows.count(),count);
 if(count) assert.equal(Number(await page.locator('[data-slate-counts="ranked"]').getAttribute('data-slate-total-starts')),count);
 if(count===0) assert(text.includes('season archive. No starts were recorded'));
 if(count===28) assert(text.includes('SLATE COMPLETE · 28 STARTS'));
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'no overflow');
 await page.screenshot({path:path.join(out,`${route.replaceAll('/','-')}-${width}.png`),fullPage:true});
 result.pages.push({route,width,url:page.url(),rows:count,chipMatches:true,nav:4,offseasonCopy:true});await page.close();
}
} finally {await browser.close();await writeFile(path.join(out,'results.json'),JSON.stringify(result,null,2));}
console.log(JSON.stringify(result,null,2));
