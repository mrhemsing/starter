import assert from 'node:assert/strict';
import { mkdirSync, writeFileSync } from 'node:fs';
import { chromium } from 'playwright-core';
const [base='https://www.toetheslab.com',out='outputs/heading-fonts/production',mode='verify']=process.argv.slice(2);
mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];
try {
 for(const width of [390,1440]) {
  let reference;
  for(const route of ['/','/2026']) {
   const page=await browser.newPage({viewport:{width,height:900},reducedMotion:'reduce'});
   const response=await page.goto(base+route,{waitUntil:'networkidle'});assert.equal(response.status(),200);
   await page.evaluate(()=>document.fonts.ready);
   if(route==='/')reference=await page.getByRole('heading',{name:'Final 2026 form',exact:true}).evaluate(e=>getComputedStyle(e).fontFamily);
   assert(reference.includes('Playfair'),'reference is the loaded site display font');
   const headings=await page.locator('#top-starts h2,[data-season-awards] h2').evaluateAll(elements=>elements.map(e=>{
    const walker=document.createTreeWalker(e,NodeFilter.SHOW_TEXT),runs=[];
    while(walker.nextNode()){const node=walker.currentNode;if(node.textContent.trim())runs.push({text:node.textContent,font:getComputedStyle(node.parentElement).fontFamily});}
    return {text:e.textContent,runs};
   }));
   assert(headings.length>=8);
   if(mode==='verify')for(const heading of headings)for(const run of heading.runs)assert.equal(run.font,reference,heading.text);
   const stats=await page.locator('#arm .award-person-text > p.font-mono').evaluateAll(es=>es.map(e=>getComputedStyle(e).fontFamily));
   assert(stats.length>=3 && stats.every(font=>font.includes('Mono')),'actual stats remain mono');
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   for(const [label,selector] of [['top','#top-starts h2'],['awards','[data-season-awards] > h2'],['bids','#no-hitter-bids h2'],...(route==='/'?[['reference','[data-responsive-check="heat-check-hero"] h2']]:[])]) {
    const heading=page.locator(selector);await heading.scrollIntoViewIfNeeded();await heading.screenshot({path:`${out}/${route==='/'?'home':'hub'}-${label}-${width}.png`});
   }
   results.push({route,width,reference,headings,stats});await page.close();
  }
 }
}finally{await browser.close();}
writeFileSync(`${out}/fonts.json`,JSON.stringify(results,null,2));
console.log(`${mode}: ${results.length} page/viewport combinations; all heading text runs checked against Final 2026 form; actual stats monospace; no overflow.`);
