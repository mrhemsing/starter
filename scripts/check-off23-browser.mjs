import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium} from 'playwright-core';
const base=process.argv[2]??'http://localhost:3030';const out=process.argv[3]??'outputs/off23/local';fs.mkdirSync(out,{recursive:true});
const proof=JSON.parse(fs.readFileSync('src/data/gs-plus-examples-2026.json'));
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const results=[];const links=new Set();
try {for(const route of ['/','/2026'])for(const width of [390,1440]) {
 const page=await browser.newPage({viewport:{width,height:900},deviceScaleFactor:1});const response=await page.goto(base+route,{waitUntil:'networkidle',timeout:120000});assert.equal(response.status(),200);await page.evaluate(()=>document.fonts.ready);
 const section=page.locator('[data-responsive-check="home-gs-plus-differentiator-band"]');assert.equal(await section.count(),1);
 assert.equal(await section.locator('[data-home-gs-plus-proof-card]').count(),3);
 const text=await section.innerText();assert(!/proof packet|debug|fallback|canonical|cron|runtime|\u2014|Ã|Â/i.test(text));assert(text.includes('2026 EXAMPLES, FROZEN AT SEASON END'));
 const order=await section.evaluate(el=>{let top=document.querySelector('#top-starts'),awards=document.querySelector('[data-season-awards]');return {afterTop:!!(top.compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING),beforeAwards:!!(el.compareDocumentPosition(awards)&Node.DOCUMENT_POSITION_FOLLOWING),overflow:document.documentElement.scrollWidth>innerWidth};});assert(order.afterTop&&order.beforeAwards&&!order.overflow);
 for(const item of proof.contextPair){const card=section.locator(`[data-home-gs-plus-context-start="${item.id}"]`);assert((await card.innerText()).includes(item.line));assert((await card.innerText()).includes(String(item.gsPlus)));}
 assert.equal(await section.locator('[data-home-gs-plus-lock]').count(),1);assert.equal(await section.locator('[data-home-gs-plus-breakdown-link]').getAttribute('href'),proof.breakdown.href);
 for(const href of await section.locator('a').evaluateAll(as=>as.map(a=>a.getAttribute('href'))))links.add(href);
 const box=await section.boundingBox();assert(box.width<=width);await section.screenshot({path:`${out}/${route==='/'?'home':'archive'}-why-${width}.png`});
 const documentY=await section.evaluate(el=>el.getBoundingClientRect().top+window.scrollY);
 await page.screenshot({fullPage:true,path:`${out}/${route==='/'?'home':'archive'}-placement-${width}.png`,clip:{x:0,y:Math.max(0,documentY-75),width,height:box.height+175}});
 results.push({route,width,panels:3,...order,text});await page.close();
 }
 for(const href of links){const res=await fetch(base+href);assert.equal(res.status,200,href);results.push({link:href,status:res.status});}
 for(const route of ['/','/2026']) {const responses=[];for(let i=0;i<2;i++){const res=await fetch(base+route);const html=await res.text();assert.equal(res.status,200);assert(html.includes('data-home-gs-plus-proof-panels'));responses.push({status:res.status,cache:res.headers.get('x-vercel-cache'),build:html.match(/name="tts-build" content="([^"]+)"/)?.[1]});fs.writeFileSync(`${out}/${route==='/'?'home':'archive'}.html`,html);}if(base.includes('toetheslab.com'))assert.equal(responses[1].cache,'HIT');results.push({rawHtmlRoute:route,responses});}
 fs.writeFileSync(out+'/results.json',JSON.stringify({passed:true,results},null,2));console.log(JSON.stringify({passed:true,pages:4,links:links.size,out}));
}finally{await browser.close();}
