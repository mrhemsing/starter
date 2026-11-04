import {chromium} from 'playwright-core';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
const output='outputs/off131';await mkdir(output,{recursive:true});
const schedule=JSON.parse(await readFile(`${output}/postseason-schedule.json`,'utf8'));
const dates=schedule.dates.map(x=>x.date);
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});
const page=await browser.newPage({viewport:{width:1440,height:1000},reducedMotion:'reduce'});
const result={};
try {for(const date of dates) {
 const response=await page.goto(`https://www.toetheslab.com/starts/${date}`,{waitUntil:'networkidle',timeout:120000});
 if(response.status()!==200) throw new Error(`${date} ${response.status()}`);
 result[date]=await page.evaluate(()=>({
  build:document.querySelector('meta[name="tts-build"]')?.content,
  rows:[...document.querySelectorAll('[data-responsive-check="ranked-start-card"], [data-responsive-check="short-start-card"]')].map(el=>{const clone=el.cloneNode(true);clone.querySelectorAll('button,video,iframe').forEach(x=>x.remove());return {name:el.getAttribute('data-pitcher-name'),text:clone.textContent.replace(/\s+/g,' ').trim()};}),
  hero:document.querySelector('[data-top-performer-pitcher]')?.textContent.replace(/\s+/g,' ').trim()
 }));
 await writeFile(`${output}/baseline.json`,JSON.stringify(result,null,2));console.log(`Baseline ${date}`);
}}finally{await browser.close();}

