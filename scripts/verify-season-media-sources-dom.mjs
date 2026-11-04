import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const [sha]=process.argv.slice(2);assert(sha);
const records=JSON.parse(await readFile('data/season-reviews/2026-canonical.json','utf8'));
const dates=[...new Set(records.map(x=>x.date))];
const base='https://www.toetheslab.com',output='outputs/off131/production';await mkdir(output,{recursive:true});
const results={pages:[],images:[],errors:[]};let index=0;
const approved=value=>{const u=new URL(value,base);if(u.pathname==='/_next/image')return approved(u.searchParams.get('url'));return u.origin===base||['img.mlbstatic.com','img.youtube.com'].includes(u.hostname);};
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
async function worker(){const context=await browser.newContext({viewport:{width:1440,height:1000},reducedMotion:'reduce'});const page=await context.newPage();let date;
 page.on('request',r=>{if(r.resourceType()==='image')results.images.push({date,url:r.url(),approved:approved(r.url())});});
 try{while(index<dates.length){date=dates[index++];try{
  const response=await page.goto(`${base}/starts/${date}`,{waitUntil:'networkidle',timeout:120000});assert.equal(response.status(),200);
  const build=await page.locator('meta[name="tts-build"]').getAttribute('content');assert(build.startsWith(sha.slice(0,12)),`Stale page ${date}`);
  const sources=await page.locator('main img').evaluateAll(images=>images.map(img=>img.currentSrc||img.src));assert(sources.every(approved),`Unapproved rendered image on ${date}`);
  // Trigger lazy images through all rows, not just the above-fold hero.
  await page.evaluate(async()=>{for(const img of document.querySelectorAll('main img')){if(img.getClientRects().length){img.scrollIntoView();await new Promise(resolve=>setTimeout(resolve,20));}}});
  await page.waitForLoadState('networkidle');
  const rows=await page.locator('[data-responsive-check="ranked-start-card"], [data-responsive-check="short-start-card"]').count();
  assert.equal(rows,records.filter(x=>x.date===date).length,`Missing settled rows ${date}`);
  results.pages.push({date,build,rows,renderedImageSources:sources.length});console.log(`PASS ${results.pages.length}/${dates.length} ${date}: ${rows} rows`);
 }catch(error){results.errors.push({date,error:error.message});console.log(`FAIL ${date}: ${error.message}`);}}}finally{await context.close();}}
try{await Promise.all([worker(),worker(),worker()]);assert.equal(results.errors.length,0,'Season DOM failures');assert.equal(results.pages.length,dates.length);assert.equal(results.pages.reduce((sum,x)=>sum+x.rows,0),4425);assert(results.images.length>0&&results.images.every(x=>x.approved),'Unapproved image network request');results.passed=true;console.log(`PASS ${dates.length} plain dated slates, 4425 rendered starts, ${results.images.length} approved image requests`);}finally{await writeFile(`${output}/season-sources-results.json`,JSON.stringify(results,null,2));await browser.close();}
