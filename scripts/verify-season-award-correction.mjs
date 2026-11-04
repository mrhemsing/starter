import assert from 'node:assert/strict';
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
const [base='https://www.toetheslab.com',out='outputs/arm25/production'] = process.argv.slice(2);
mkdirSync(out,{recursive:true});
const review=JSON.parse(readFileSync('src/data/season-review-2026.json'));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];
try {
 for(const width of [390,1440]) for(const route of ['/','/2026']) {
  const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
  const response=await page.goto(base+route,{waitUntil:'networkidle'});assert.equal(response.status(),200);
  await page.evaluate(()=>document.fonts.ready);
  const arm=page.locator('#arm'),text=await arm.innerText();
  assert(!text.includes('Ohtani'));assert(text.includes('at least 25 starts'));
  assert.deepEqual(await arm.locator('.award-person-heading a').allTextContents(),review.arms.map(row=>row.name));
  assert.equal((text.match(/Qualification: 25 starts/g)||[]).length,3);
  const list=page.locator('[data-review-top-starts]');
  const ids=await list.locator('[data-review-start-id]').evaluateAll(elements=>elements.map(e=>e.dataset.reviewStartId));
  const limit=route==='/'?5:25;
  assert.deepEqual(ids,review.topStarts.slice(1,limit).map(row=>row.id));
  assert((await list.innerText()).includes('#2'));
  assert.equal(await page.locator('[data-top-performer-rank="1"]').count(),1);
  assert.equal(await list.locator('[data-review-gem]').count(),4);
  const cards=await arm.locator('[data-award-person]').evaluateAll(elements=>elements.map(e=>({height:e.parentElement.getBoundingClientRect().height,head:e.querySelector('.headshot').getBoundingClientRect().right,text:e.querySelector('.award-person-text').getBoundingClientRect().left})));
  if(width===390)for(const card of cards){assert(card.height<=120);assert(card.text>card.head);}
  assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
  const label=route==='/'?'home':'hub';
  for(const [name,locator] of [['arm',arm],['top-starts',page.locator('#top-starts')]]) {
   await locator.scrollIntoViewIfNeeded();
   await locator.locator('img').evaluateAll(images=>Promise.all(images.map(image=>{image.loading='eager';return image.decode();})));
   await locator.screenshot({path:`${out}/${label}-${name}-${width}.png`});
  }
  results.push({route,width,podium:review.arms.map(({name,starts})=>({name,starts})),cards,listRanks:`2-${limit}`,duplicateWinner:false});
  await page.close();
 }
} finally {await browser.close();}
writeFileSync(`${out}/results.json`,JSON.stringify(results,null,2));console.log(JSON.stringify(results,null,2));
