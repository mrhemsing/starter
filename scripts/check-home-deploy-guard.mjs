import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { verifyHome, verifyHtml } from './verify-home-deploy.mjs';
const sha = 'a'.repeat(40);
const html = `<meta name="tts-build" content="${sha.slice(0,12)}-time"/><nav aria-label="Primary">${'<a href="/">Link</a>'.repeat(4)}</nav><h1>2026 Season in Review</h1>`;
verifyHtml(html, sha, true);
for (const bad of [html.replace('aaaaaaaaaaaa', 'bbbbbbbbbbbb'), html.replace('tts-build','missing'), html+'Warming up', html.replace('Season in Review','Old season'), html.replace('</nav>','<a href="/">Extra</a></nav>')]) assert.throws(()=>verifyHtml(bad,sha,true));
console.log('PASS current HTML; reject stale SHA, missing marker, skeleton, old H1, wrong nav');
const out = await mkdtemp(`${tmpdir()}/home-guard-`);
let status = 200;
const server = createServer((req,res)=>{
  assert.equal(req.url,'/');
  assert.equal(req.headers['cache-control'],undefined);
  assert.equal(req.headers.pragma,undefined);
  res.writeHead(status); res.end(html);
});
await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
try {
  const base = `http://127.0.0.1:${server.address().port}/`;
  await verifyHome(base,sha,out,true);
  await assert.rejects(verifyHome(`${base}?v=x`,sha,out));
  status=302; await assert.rejects(verifyHome(base,sha,out));
  console.log('PASS real HTTP plain GET, no bypass headers; reject query URL and redirect');
} finally { server.close(); await rm(out,{recursive:true,force:true}); }
