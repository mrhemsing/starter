import {readFile,writeFile} from 'node:fs/promises';
import {loadProjectTs} from './lib/load-project-ts.mjs';
process.env.YOUTUBE_SEARCH_ENABLED='0';
const review=JSON.parse(await readFile('src/data/season-review-2026.json','utf8'));
const media=JSON.parse(await readFile('src/data/season-review-media-2026.json','utf8'));
const {resolveFeaturedStartHighlight}=loadProjectTs('src/lib/data/featured-highlight-service.ts');
for(const start of review.topStarts.slice(3,25)) {
 media.highlights[start.id]=await resolveFeaturedStartHighlight(start);
 console.log(start.rank,start.pitcher.name,Boolean(media.highlights[start.id]));
}
await writeFile('src/data/season-review-media-2026.json',JSON.stringify(media,null,2)+'\n');
