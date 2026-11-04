import assert from 'node:assert/strict';
import { chromium } from 'playwright-core';
import { mkdirSync, writeFileSync, readFileSync } from 'node:fs';
const base = process.argv[2] || 'http://localhost:3018', out = process.argv[3] || 'outputs/off2/local';
mkdirSync(out, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true });
const results = [], images = new Set(), violations = [];
const baseline = JSON.parse(readFileSync('scripts/fixtures/off14/production-row-baseline.json','utf8'));
const audit = JSON.parse(readFileSync('src/data/season-no-hitters-2026.json','utf8'));
function imageSource(value) { const u = new URL(value,base); return u.pathname === '/_next/image' ? imageSource(u.searchParams.get('url')) : u; }
try {
  for (const width of [1440,390]) for (const route of ['/2026','/']) {
    const page = await browser.newPage({ viewport: { width, height: 1000 }, reducedMotion: 'reduce' });
    page.on('request', r => { if(r.resourceType() === 'image') { const u = imageSource(r.url()); images.add(u.href); if(u.origin !== new URL(base).origin && u.hostname !== 'img.mlbstatic.com') violations.push(u.href); } });
    const response = await page.goto(base+route, { waitUntil: 'networkidle' });
    assert.equal(response.status(),200);
    const raw = await response.text();
    assert(!raw.includes('Warming up'));assert(!/data-skeleton[\w-]*=|route-shell-shimmer/.test(raw));
    assert.equal((raw.match(/data-season-rotation-row="true"/g)||[]).length,35,'5 preview plus all 30 in initial HTML');
    const section = page.locator('[data-season-awards]');
    await section.waitFor();
    assert.equal(await section.locator('[data-rotation-top-five] > li').count(),5);
    assert.equal(await section.locator('[data-rotation-all] > li').count(),30);
    assert.equal(await section.locator('[data-rotation-top-five] [data-winner]').count(),1);
    if(route === '/') {
      for(const id of ['arm','rotation','no-hitter-bids','gems','blowup','streak']) assert.equal(await section.locator(`#${id} h2 a`).getAttribute('href'),`/2026#${id}`);
      const order = await page.evaluate(() => {const top=document.querySelector('#top-starts'),awards=document.querySelector('[data-season-awards]');return !!(top.compareDocumentPosition(awards)&Node.DOCUMENT_POSITION_FOLLOWING);});
      assert(order);
    }
    const grids = await section.locator('[data-award-grid]').evaluateAll(elements => elements.map(el => ({name:el.dataset.awardGrid,columns:getComputedStyle(el).gridTemplateColumns,children:[...el.children].map(e=>{const r=e.getBoundingClientRect();return {x:r.x,y:r.y,width:r.width,height:r.height};})})));
    for(const grid of grids) { const [a,b]=grid.children; if(width>=1024){assert(Math.abs(a.y-b.y)<2,'baseline');assert(b.x>a.x+a.width,'two columns');}else{assert(Math.abs(a.x-b.x)<2);assert(b.y>=a.y+a.height);} }
    const padding = await section.locator('[data-award-panel]').evaluateAll(es=>es.map(e=>{const a=e.getBoundingClientRect(),b=e.lastElementChild.getBoundingClientRect();return {id:e.id,bottomVoid:a.bottom-b.bottom};}));
    for(const p of padding) assert(p.bottomVoid<=40,JSON.stringify(p));
    const line = await section.locator('[data-no-hitter-verdict]').innerText();
    assert(line.includes('No individual no-hitter was completed in 2026'));
    assert(line.includes('Tatsuya Imai (6.0 IP, 0 H)'));
    for(const event of audit.combined) {const row=section.locator(`[data-start-id="${event.startId}"]`);assert.equal(await row.locator('[data-combined-no-hitter]').innerText(),'COMBINED NO-HITTER');assert((await row.locator('a').first().getAttribute('href')).startsWith(`/starts/${event.date}/`));}
    assert.deepEqual(await page.locator('[data-review-start-id]').evaluateAll(es=>es.map(e=>({id:e.dataset.reviewStartId,text:e.querySelector('article').innerText}))),baseline[route]);
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow');
    for(const image of await section.locator('img:visible').all()){await image.scrollIntoViewIfNeeded(); await image.evaluate(im=>im.decode());}
    const label = route === '/' ? 'home' : 'hub';
    await section.screenshot({path:`${out}/${label}-awards-${width}.png`});
    await section.locator('[data-award-grid="gems-blowup-streak"]').screenshot({path:`${out}/${label}-grid-${width}.png`});
    await section.locator('#no-hitter-bids').screenshot({path:`${out}/${label}-no-hitters-${width}.png`});
    await section.locator('#rotation').screenshot({path:`${out}/${label}-rotation-collapsed-${width}.png`});
    const disclosure=section.locator('[data-rotation-disclosure]');
    await disclosure.locator('summary').focus();
    await page.waitForTimeout(300);
    const requests=[];const observe=r=>requests.push({url:r.url(),type:r.resourceType()});page.on('request',observe);
    await disclosure.locator('summary').press('Enter');
    await page.waitForTimeout(500);page.off('request',observe);
    assert(await disclosure.evaluate(e=>e.open));
    assert.equal(await section.locator('[data-rotation-all] > li:visible').count(),30);
    assert.equal(requests.filter(r=>['fetch','xhr','document'].includes(r.type)).length,0,'expansion data fetch: '+JSON.stringify(requests));
    await section.locator('#rotation').screenshot({path:`${out}/${label}-rotation-expanded-${width}.png`});
    results.push({route,width,line,grids,padding,serverRotationRows:35,expandedRows:30,expansionRequests:requests,cache:response.headers()['x-vercel-cache']});
    await page.close();
  }
  assert.equal(violations.length,0,JSON.stringify(violations));
  writeFileSync(`${out}/results.json`,JSON.stringify({base,results,approvedImageCount:images.size,violations},null,2));
  console.log(JSON.stringify({base,viewports:results.length,approvedImageCount:images.size,results},null,2));
} finally { await browser.close(); }
