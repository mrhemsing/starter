import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import sharp from 'sharp';
import {mkdirSync,readFileSync,writeFileSync} from 'node:fs';
const [base='https://www.toetheslab.com',out='outputs/off22/production',mode='verify']=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const baseline='outputs/off22/baseline';
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[],images=new Set();
try {for(const width of [1440,390]) for(const route of ['/','/2026']) {
 const label=route==='/'?'home':'hub',page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
 page.on('request',r=>{if(r.resourceType()==='image'){const u=new URL(r.url());const src=u.pathname==='/_next/image'?new URL(u.searchParams.get('url'),base):u;images.add(src.href);assert(src.origin===new URL(base).origin||['img.mlbstatic.com','www.mlbstatic.com'].includes(src.hostname),src.href);}});
 const response=await page.goto(base+route,{waitUntil:'networkidle'});assert.equal(response.status(),200);
 await page.evaluate(()=>document.fonts.ready);
 for(const id of ['arm','gems','streak']) {
  const section=page.locator(`#${id}`);await section.scrollIntoViewIfNeeded();
  await section.locator('img').evaluateAll(ims=>Promise.all(ims.map(im=>im.decode())));
  await page.mouse.move(0,0);
  const text=await section.innerText(),key=`${label}-${id}-${width}`;
  await section.screenshot({path:`${out}/${key}.png`,animations:'disabled'});
  if(mode==='baseline')writeFileSync(`${out}/${key}.txt`,text);
  else {
   assert.equal(text,readFileSync(`${baseline}/${key}.txt`,'utf8'),'frozen section text');
   if(width===1440){const a=await sharp(`${baseline}/${key}.png`).raw().toBuffer({resolveWithObject:true}),b=await sharp(`${out}/${key}.png`).raw().toBuffer({resolveWithObject:true});assert.deepEqual(b.info,a.info);assert(a.data.equals(b.data),`${key}: desktop pixel parity`);}
  }
 }
 if(mode!=='baseline'&&width===390){
  const cards=page.locator('#arm [data-award-person]');assert.equal(await cards.count(),3);
  const measure=async()=>cards.evaluateAll(es=>es.map(e=>{const r=e.getBoundingClientRect(),h=e.querySelector('.headshot').getBoundingClientRect(),t=e.querySelector('.award-person-text').getBoundingClientRect();return{height:e.parentElement.getBoundingClientRect().height,contentHeight:r.height,headWidth:h.width,headHeight:h.height,headRight:h.right,textLeft:t.left,textRight:t.right,right:r.right};}));
  const checks=await measure();for(const c of checks){assert(c.height<=120,JSON.stringify(c));assert(c.headWidth>=64&&c.headWidth<=80);assert(c.textLeft>c.headRight);assert(c.textRight<=c.right);}
  const streak=await page.locator('#streak [data-award-person]').evaluate(e=>({head:e.querySelector('.headshot').getBoundingClientRect().right,text:e.querySelector('.award-person-text').getBoundingClientRect().left}));assert(streak.text>streak.head);
  const podium=await page.locator('#arm ol').boundingBox();assert(podium.height<=400);
  // Stress the real shared card in the browser, without changing stored content.
  await cards.first().locator('a').evaluate(e=>e.textContent='Jacob Misiorowski');
  const long=(await measure())[0];assert(long.height<=120);assert.equal(long.headWidth,checks[0].headWidth);
  assert(await cards.first().evaluate(e=>e.scrollWidth<=e.clientWidth));
  await cards.first().screenshot({path:`${out}/${label}-long-name-390.png`});
  results.push({route,width,cards:checks,podiumHeight:podium.height,longName:long});
 }else results.push({route,width,desktopPixelParity:mode==='verify'&&width===1440});
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.close();
 }}finally{await browser.close();}
writeFileSync(`${out}/image-sources.json`,JSON.stringify([...images],null,2));
writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
