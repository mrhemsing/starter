import assert from 'node:assert/strict';
import {readFileSync,writeFileSync} from 'node:fs';
import {createElement} from 'react';
import {renderToStaticMarkup} from 'react-dom/server';
import {loadProjectTs} from './lib/load-project-ts.mjs';
const {ImageConfigContext}=await import('next/dist/shared/lib/image-config-context.shared-runtime.js');
const {imageConfigDefault}=await import('next/dist/shared/lib/image-config.js');
const config={...imageConfigDefault,...loadProjectTs('next.config.ts').default.images};
const render=n=>renderToStaticMarkup(createElement(ImageConfigContext.Provider,{value:config},n));
const review=JSON.parse(readFileSync('src/data/season-review-2026.json','utf8'));
const {SeasonReviewTopStarts}=loadProjectTs('src/components/season-review.tsx');
const html=render(createElement(SeasonReviewTopStarts,{review}));
const rows=html.split('data-review-start-id=').slice(1).map(s=>s.split('</li>')[0]);
assert.equal(rows.length,25);
rows.forEach((s,i)=>{assert.equal(s.includes('data-review-gem'),i<5);assert.equal(s.includes('data-highlight-thumbnail="true"'),i>=5);if(i>=5){assert(s.includes(`Watch highlight: ${review.topStarts[i].pitcher.name}, ${review.topStarts[i].date}`));assert(s.includes('Highlight · MLB'));assert(!s.includes('rounded-full border border-amber'));}});
for(const index of [3,5]) {const fixture={...review,topStarts:review.topStarts.map((s,i)=>i===index?{...s,id:'no-asset-fixture'}:s)};const out=render(createElement(SeasonReviewTopStarts,{review:fixture})).split('data-review-start-id="no-asset-fixture"')[1].split('</li>')[0];assert(!/data-review-gem|data-highlight-thumbnail|placeholder/.test(out));}
assert(readFileSync('src/components/season-review.tsx','utf8').includes('from "@/components/featured-start-highlight"'));
console.log('PASS OFF-1.4: five shared cards, twenty compact thumbnails with dates and attribution, no circular row controls, card/compact no-asset fixtures.');
