import assert from 'node:assert/strict';
import {chromium} from 'playwright-core';
import sharp from 'sharp';
import {mkdirSync,writeFileSync} from 'node:fs';
const base=process.argv[2]||'http://localhost:3017',out=process.argv[3]||'outputs/off151/local';mkdirSync(out,{recursive:true});
const browser=await chromium.launch({executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe',headless:true});const results=[];
const lum=rgb=>rgb.map(c=>c/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4).reduce((a,c,i)=>a+c*[.2126,.7152,.0722][i],0);
try{for(const width of [1440,390]){
 const page=await browser.newPage({viewport:{width,height:1000},reducedMotion:'reduce'});await page.goto(base+'/',{waitUntil:'networkidle'});
 const section=page.locator('[data-offseason-header]');await section.waitFor();assert.equal(await page.locator('[data-review-baseball]').count(),0);
 const mobile=width<1024,layer=page.locator(`[data-responsive-check="home-header-background${mobile?'-mobile':''}"]`);
 const styles=await layer.evaluate(el=>{const s=getComputedStyle(el);return{opacity:s.opacity,filter:s.filter,position:s.position,top:s.top,height:s.height,backgroundImage:s.backgroundImage,backgroundPosition:s.backgroundPosition,backgroundSize:s.backgroundSize,blend:s.mixBlendMode};});
 assert(styles.backgroundImage.endsWith('/images/header-baseball-bg.jpg")'));assert.equal(styles.opacity,mobile?'0.44':'1');assert.equal(styles.filter,'saturate(0.92)');assert.equal(styles.position,'absolute');assert.equal(styles.top,'0px');assert.equal(styles.height,mobile?'520px':'380px');assert.equal(styles.blend,'normal');assert.equal(styles.backgroundPosition,mobile?'calc(100% + 54px) 82px':'76% 74%');
 const box=await section.boundingBox();assert.equal(box.x,0);assert.equal(box.width,width);
 const z=await page.locator('[data-offseason-header-content]').evaluate(el=>getComputedStyle(el).zIndex);assert.equal(z,'10');
 for(const target of [page.locator('h1'),...await section.locator('nav a').all()]){const hit=await target.evaluate(el=>{const r=el.getBoundingClientRect();const top=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);return top===el||el.contains(top);});assert(hit,'Background must not cover text/nav hit targets');}
 const records=await section.evaluate(root=>{const out=[];for(const el of root.querySelectorAll('*')){const cs=getComputedStyle(el);if(cs.visibility==='hidden'||cs.display==='none')continue;for(const node of el.childNodes){if(node.nodeType!==Node.TEXT_NODE||!node.textContent.trim())continue;const range=document.createRange();range.selectNodeContents(node);const rects=[...range.getClientRects()].filter(r=>r.width>0&&r.height>0).map(r=>({x:r.x,y:r.y,width:r.width,height:r.height}));if(!rects.length)continue;const probe=document.createElement('canvas').getContext('2d');probe.fillStyle=cs.color;probe.fillRect(0,0,1,1);const cssColor=[...probe.getImageData(0,0,1,1).data];let opacity=1;for(let p=el;p&&p!==root.parentElement;p=p.parentElement)opacity*=Number(getComputedStyle(p).opacity);out.push({text:node.textContent.trim(),color:cssColor,opacity,size:parseFloat(cs.fontSize),weight:parseFloat(cs.fontWeight)||400,nav:Boolean(el.closest('nav')),rects});}}return out;});
 await section.screenshot({path:`${out}/home-header-${width}.png`});
 // Measurement-only screenshot: hide foreground without changing layout or the background.
 await page.locator('[data-offseason-header-content]').evaluate(el=>el.style.visibility='hidden');
 const buffer=await page.screenshot({clip:{x:0,y:0,width,height:Math.ceil(box.height)}});
 await page.locator('[data-offseason-header-content]').evaluate(el=>el.style.removeProperty('visibility'));
 const {data,info}=await sharp(buffer).removeAlpha().raw().toBuffer({resolveWithObject:true});
 const contrast=[];
 for(const r of records){const color=r.color.slice(0,3);r.opacity*=r.color[3]/255;let minimum=Infinity;
  for(const rect of r.rects){for(let y=Math.max(0,Math.floor(rect.y));y<Math.min(info.height,Math.ceil(rect.y+rect.height));y++){for(let x=Math.max(0,Math.floor(rect.x));x<Math.min(info.width,Math.ceil(rect.x+rect.width));x++){const i=(y*info.width+x)*3,bg=[data[i],data[i+1],data[i+2]],fg=color.map((c,j)=>c*r.opacity+bg[j]*(1-r.opacity)),a=lum(fg),b=lum(bg);minimum=Math.min(minimum,(Math.max(a,b)+.05)/(Math.min(a,b)+.05));}}}
  const threshold=r.size>=24||(r.size>=18.66&&r.weight>=700)?3:4.5;assert(minimum>=threshold,`${r.text}: ${minimum.toFixed(2)} < ${threshold}`);contrast.push({text:r.text,nav:r.nav,minimum,threshold});
 }
 assert(contrast.filter(r=>r.nav).length>=4);results.push({width,styles,contentZ:z,opaqueThumbnail:false,contrast,minContrast:Math.min(...contrast.map(r=>r.minimum)),positionPolicy:'Exact June 30 values; mobile right overflow 54px, desktop background cropped above its 380px layer. Not a fabricated both-edges claim.'});await page.close();
}
writeFileSync(`${out}/results.json`,JSON.stringify({base,results},null,2));console.log(JSON.stringify(results.map(r=>({width:r.width,textChecks:r.contrast.length,minContrast:r.minContrast,stacking:'PASS'})),null,2));
}finally{await browser.close();}
