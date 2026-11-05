import {chromium} from 'playwright-core';
import assert from 'node:assert/strict';
import {mkdirSync,writeFileSync,readFileSync} from 'node:fs';
const [base='http://localhost:3027',out='outputs/p07/browser-built']=process.argv.slice(2);mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});
 const response=await page.goto(base+'/pitchers/michael-soroka-647336',{waitUntil:'networkidle',timeout:120000});assert.equal(response.status(),200);
 await page.locator('[data-pitch-mix-coverage]').waitFor({timeout:120000});await page.evaluate(()=>document.fonts.ready);
 const stats=await page.locator('[data-pitcher-season-stats]').innerText();assert.match(stats,/21 starts · 112\.0 IP as starter/i);
 const relief=await page.locator('[data-relief-coverage]').innerText();assert.equal(relief,'4.0 IP in relief not included');
 const log=page.locator('[data-responsive-check="pitcher-game-log-row"]');assert.equal(await log.count(),21);
 const dates=await log.locator('summary a').allTextContents();assert(dates.includes('2026-09-27'));assert(dates.includes('2026-06-13'));assert(dates.includes('2026-06-19'));
 const chart=page.locator('svg[aria-label^="Season form chart"]');assert.match(await chart.getAttribute('aria-label'),/21 starts/);
 const titles=await chart.locator('circle title').allTextContents();assert.equal(titles.length,21);assert(titles.some(t=>t.startsWith('2026-09-27')));
 const mix=await page.locator('[data-pitch-mix-coverage]').innerText();assert.match(mix,/21 of 21/);assert.match(mix,/2026-09-27/);assert(!mix.includes('ARCHIVE THROUGH'));
 const api=await (await page.request.get(base+'/api/pitchers/647336')).json();assert.equal(api.velocityByStart.length,21);assert.equal(api.pitchMixByStart.length,21);
 assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'No document overflow');
 await page.screenshot({path:`${out}/soroka-${width}-full.png`,fullPage:true});
 await page.locator('[data-responsive-check="pitcher-form-hero"]').screenshot({path:`${out}/soroka-${width}-header.png`});
 await page.locator('[data-responsive-check="pitcher-profile-game-log"]').screenshot({path:`${out}/soroka-${width}-log.png`});
 await chart.locator('..').evaluate(el=>{el.scrollLeft=el.scrollWidth;});await chart.locator('..').screenshot({path:`${out}/soroka-${width}-trend-end.png`});
 results.push({width,stats,relief,startCount:21,lastStart:'2026-09-27',chartPoints:titles.length,mix});await page.close();
}
 const page=await browser.newPage();await page.goto(base+'/2026',{waitUntil:'networkidle',timeout:120000});const text=await page.locator('main').innerText();assert(/4,?938/.test(text));assert(text.includes('Jacob Misiorowski'));writeFileSync(`${out}/2026-text.txt`,text);
 await page.goto(base+'/heat-check',{waitUntil:'networkidle',timeout:120000});const heat=await page.locator('main').innerText();writeFileSync(`${out}/heat-check-text.txt`,heat);
 if(base.startsWith('https'))assert.equal(heat,readFileSync('outputs/p07/baseline-heat-check.txt','utf8'),'Heat Check unchanged');
}finally{await browser.close();}
writeFileSync(`${out}/assertions.json`,JSON.stringify(results,null,2));console.log('PASS',JSON.stringify(results));
