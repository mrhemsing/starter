import assert from 'node:assert/strict';
import fs from 'node:fs';
import {execFileSync} from 'node:child_process';
import crypto from 'node:crypto';
import React from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadProjectTs} from './lib/load-project-ts.mjs';
const source=execFileSync('git',['show','20af591:src/app/(home)/page.tsx'],{encoding:'utf8'}).replaceAll('\r\n','\n');
const component=fs.readFileSync('src/components/why-gs-plus-band.tsx','utf8');
const old=source.slice(source.indexOf('function WhyGsPlusBand'),source.indexOf('function addDays')).trim();
const recovered=component.slice(component.indexOf('export function WhyGsPlusBand')).trim()
 .replace('export function WhyGsPlusBand({ proof, season }: { proof: HomeGsPlusProofs; season?: number })','function WhyGsPlusBand({ proof }: { proof: HomeGsPlusProofs })')
 .replace('season ? `${season} examples, frozen at season end` : ','')
 .replace('        {season ? <a href="/methodology" className="mt-5 inline-block font-mono text-xs uppercase tracking-[0.12em] text-amber-300 underline underline-offset-4">Methodology</a> : null}\n','')
 .replace('{season ? "Stuff credit" : "Stuff added"} {formatSignedProofValue(proof.stuff.totalStuffValue)} {season ? "before scale adjustment" : "GS+ pts"}','Stuff added {formatSignedProofValue(proof.stuff.totalStuffValue)} GS+ pts');
assert.equal(recovered,old,'P2-44 component markup must be exact apart from enumerated offseason adaptations');
const proof=JSON.parse(fs.readFileSync('src/data/gs-plus-examples-2026.json'));
const {WhyGsPlusBand}=loadProjectTs('src/components/why-gs-plus-band.tsx');
const render=()=>renderToStaticMarkup(React.createElement(WhyGsPlusBand,{proof,season:2026}));
const html=render();assert.equal(html,render());assert.equal((html.match(/data-home-gs-plus-proof-card=/g)||[]).length,3);
assert(!/proof packet|debug|fallback|runtime|canonical|cron|\u2014/i.test(html.replace(/data-[\w-]+="[^"]*"/g,'')),'No internal vocabulary');
assert(html.includes('2026 examples, frozen at season end'));assert(html.includes('before scale adjustment'));assert(html.includes('href="/methodology"'));
for(const file of ['src/components/offseason-home.tsx','src/app/2026/page.tsx']) {const s=fs.readFileSync(file,'utf8');assert(s.includes('import { FrozenSeasonGsPlus }'));assert(s.indexOf('<SeasonReviewTopStarts')<s.indexOf('<FrozenSeasonGsPlus'));assert(s.indexOf('<FrozenSeasonGsPlus')<s.indexOf('<SeasonReviewAwards'));}
assert(fs.readFileSync('src/app/(home)/page.tsx','utf8').includes('import { WhyGsPlusBand }'));
let files=execFileSync('git',['ls-tree','-r','--name-only','4b23a50','data','src/data'],{encoding:'utf8'}).trim().split('\n');
for(const file of files){assert.deepEqual(fs.readFileSync(file),execFileSync('git',['show',`4b23a50:${file}`],{maxBuffer:100*1024*1024}),`Frozen file changed: ${file}`);}
const digest=crypto.createHash('sha256').update(fs.readFileSync('src/data/gs-plus-examples-2026.json')).digest('hex');
console.log(JSON.stringify({passed:true,sourceCommit:'20af591',exactRecoveredComponent:true,panels:3,deterministicHtml:true,exampleSha256:digest,unchangedFrozenFiles:files.length},null,2));
