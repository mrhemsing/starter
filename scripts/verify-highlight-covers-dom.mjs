import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
const base=process.argv[2]||'http://localhost:3016',out=process.argv[3]||'outputs/off15/local';mkdirSync(out,{recursive:true});
const baseline=JSON.parse(readFileSync('scripts/fixtures/off14/production-row-baseline.json','utf8'));
const review=JSON.parse(readFileSync('src/data/season-review-2026.json'));
const media=JSON.parse(readFileSync('src/data/season-review-media-2026.json'));
const photos=JSON.parse(readFileSync('src/data/start-media-2026.json'));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[],images=new Set(),sample=[];
function source(value){const u=new URL(value,base);return u.pathname==='/_next/image'?source(u.searchParams.get('url')):u;}
try {for(const width of [1440,390]) {
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:"reduce"});
 page.on('request',r=>{if(r.resourceType()==='image' && r.frame()===page.mainFrame()){const u=source(r.url());assert(u.origin===new URL(base).origin||u.hostname==='img.mlbstatic.com','unapproved cover/image '+u);images.add(r.url());}});
 for(const route of (base.includes('localhost')?['/2026']:['/2026','/'])) {
  await page.goto(base+route,{waitUntil:'networkidle'});
  const rows=page.locator('[data-review-start-id]');await rows.first().waitFor();
  assert.deepEqual(await rows.evaluateAll(es=>es.map(e=>({id:e.dataset.reviewStartId,text:e.querySelector('article').innerText}))),baseline[route]);
  const frames=page.locator('[data-highlight-frame]');const count=await frames.count();assert(count>=5);
  for(const frame of await frames.all()) {
   await frame.scrollIntoViewIfNeeded();const box=await frame.boundingBox();assert(Math.abs(box.width/box.height-16/9)<.04);
   const img=frame.locator('img');assert.equal(await img.getAttribute('data-highlight-cover'),'action');assert.equal(source(await img.getAttribute('src')).hostname,'img.mlbstatic.com');await img.evaluate(im=>im.decode());
   const css=await img.evaluate(im=>({fit:getComputedStyle(im).objectFit,position:getComputedStyle(im).objectPosition}));assert.equal(css.fit,'cover');assert(css.position);
  }
  for(let i=0;i<await rows.count();i++) {const row=rows.nth(i),start=review.topStarts[i],img=row.locator('[data-highlight-cover]');const expected=start.id===media.startId?media.image:photos[start.id].image;assert.equal(source(await img.getAttribute('src')).href,expected.imageUrl);const position=await img.evaluate(im=>getComputedStyle(im).objectPosition);assert.equal(position,width<1024?(expected.mobileObjectPosition??expected.objectPosition):expected.objectPosition);}
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  if(route==='/2026') {
   for(const im of await rows.locator('img:visible').all()){await im.scrollIntoViewIfNeeded();await im.evaluate(im=>im.decode());}
   await page.evaluate(()=>scrollTo(0,0));const a=await rows.nth(0).boundingBox(),z=await rows.nth(5).boundingBox();
   await page.screenshot({path:`${out}/rows-1-6-${width}.png`,fullPage:true,clip:{x:a.x,y:a.y,width:a.width,height:z.y+z.height-a.y}});
   for(const i of [3,4,5,6,7]) {
    const row=rows.nth(i),asset=media.highlights[review.topStarts[i].id];await row.getByRole('button').focus();await row.getByRole('button').press('Enter');
    const player=i<5?row.locator('iframe,video'):page.getByRole('dialog').locator('iframe,video');await player.waitFor();assert.equal(await player.getAttribute('src'),asset.embedUrl);
    let dimensions=null;
    if(asset.source==='mlb-game-content'){dimensions=await player.evaluate(v=>new Promise((resolve,reject)=>{const done=()=>resolve({width:v.videoWidth,height:v.videoHeight,duration:v.duration});if(v.readyState>=1)return done();const t=setTimeout(()=>reject(Error('video metadata timeout')),20000);v.addEventListener('loadedmetadata',()=>{clearTimeout(t);done();},{once:true});v.addEventListener('error',()=>reject(Error('video error')),{once:true});}));assert(Math.abs(dimensions.width/dimensions.height-16/9)<.03);}
    sample.push({width,rank:i+1,pitcher:review.topStarts[i].pitcher.name,date:review.topStarts[i].date,url:asset.watchUrl,embed:asset.embedUrl,dimensions});
    if(i>=5)await page.getByRole('button',{name:'Close highlight'}).click();
   }
  } else {
   // OFF-1.5.1 supersedes the thumbnail and its no-overlap criterion.
   assert.equal(await page.locator('[data-review-baseball]').count(),0);
   const background=page.locator(`[data-responsive-check="home-header-background${width<1024?'-mobile':''}"]`);
   assert((await background.evaluate(el=>getComputedStyle(el).backgroundImage)).includes('/images/header-baseball-bg.jpg'));
   await page.locator('[data-offseason-header]').screenshot({path:`${out}/home-header-${width}.png`});
  }
  results.push({route,width,frames:count,allFrames16by9:true,allCoversActionPhotos:true,frozenText:'identical'});
 }
 await page.close();
}
writeFileSync(`${out}/results.json`,JSON.stringify({base,results,approvedImages:images.size,sample},null,2));console.log(JSON.stringify({base,results,approvedImages:images.size},null,2));
}finally{await browser.close();}
