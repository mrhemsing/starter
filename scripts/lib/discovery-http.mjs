import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {setTimeout as delay} from 'node:timers/promises';
const run=promisify(execFile);
export async function createDiscoveryFetch(output,{interval=500,reuse=[],offlineHosts=[]}={}) {
 await mkdir(`${output}/responses`,{recursive:true});let lastRequest=0;
 const log=[];
 const fetch=async input=>{
  const url=new URL(input);
  if(!['www.googleapis.com','statsapi.mlb.com'].includes(url.hostname)) throw new Error('Unapproved discovery host');
  const safe=new URL(url);safe.searchParams.delete('key');
  const key=createHash('sha256').update(safe.href).digest('hex');
  const file=`${output}/responses/${key}.json`;let saved;
  for(const directory of [output,...reuse]) {try {const value=JSON.parse(await readFile(`${directory}/responses/${key}.json`,'utf8'));if(value.status===200){saved=value;break;}}catch{}}
  if(!saved && offlineHosts.includes(url.hostname)) {
   log.push({url:safe.href,status:0,at:new Date().toISOString(),outcome:'deferred_quota',error:'No successful cached response; daily YouTube search quota exhausted'});
   throw new Error('YOUTUBE_QUOTA_DEFERRED');
  }
  if(!saved) {
   for(let attempt=0;attempt<4;attempt++) {
    const requestAt=Math.max(Date.now(),lastRequest+interval);lastRequest=requestAt;await delay(Math.max(0,requestAt-Date.now()));
    try {
     const {stdout}=await run('curl.exe',['--silent','--show-error','--max-time','30','--write-out','\n%{http_code}',url.href],{maxBuffer:25*1024*1024});
     const split=stdout.lastIndexOf('\n');saved={url:safe.href,at:new Date().toISOString(),status:Number(stdout.slice(split+1)),body:JSON.parse(stdout.slice(0,split))};
     if(saved.status!==429 && saved.status<500) break;
    }catch{saved=undefined;}
    await delay(2000*2**attempt);
   }
   if(!saved) throw new Error(`Discovery transport failed: ${safe.href}`);
  }
  await writeFile(file,JSON.stringify(saved));
  log.push({url:safe.href,status:saved.status,at:saved.at,responseFile:file});
  return new Response(JSON.stringify(saved.body),{status:saved.status});
 };
 return {fetch,log};
}
