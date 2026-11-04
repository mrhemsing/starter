import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadProjectTs } from './lib/load-project-ts.mjs';
import { ImageConfigContext } from 'next/dist/shared/lib/image-config-context.shared-runtime.js';
import { imageConfigDefault } from 'next/dist/shared/lib/image-config.js';
const review = JSON.parse(readFileSync('src/data/season-review-2026.json'));
const { SeasonReviewTopStarts } = loadProjectTs('src/components/season-review.tsx');
const imageConfig = {...imageConfigDefault,...loadProjectTs('next.config.ts').default.images};
for (const limit of [5,25]) {
 const html = renderToStaticMarkup(createElement(ImageConfigContext.Provider,{value:imageConfig},createElement(SeasonReviewTopStarts,{review,limit})));
 const ids = [...html.matchAll(/data-review-start-id="([^"]+)"/g)].map(match=>match[1]);
 assert.deepEqual(ids,review.topStarts.slice(1,limit).map(start=>start.id));
 assert(!ids.includes(review.startOfYear.id));
 assert.equal((html.match(/data-review-gem=/g)||[]).length,4);
 assert(html.includes('#2') && html.includes(`#${limit}`));
 assert(html.includes('#1 is featured above as Start of the Year.'));
}
console.log('PASS: homepage ranks 2-5 and archive ranks 2-25; winner omitted by ID, original ranks preserved, four full highlights, no duplicate winner card/video.');
