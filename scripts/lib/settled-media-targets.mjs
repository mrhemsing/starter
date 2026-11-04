import assert from 'node:assert/strict';
export function mediaTier(record,postseason) {
 return postseason.has(record.gamePk)?'postseason':record.gameScorePlus>=70?'gem':'other';
}
export function assertSettledMediaCoverage(records,outcomes,postseason) {
 assert.equal(outcomes.length,records.length,'Every settled start must have an outcome');
 const indexed=new Map(outcomes.map(x=>[x.startId,x]));
 assert.equal(indexed.size,records.length,'Duplicate or missing start outcomes');
 for(const record of records) {
  const row=indexed.get(record.id);assert(row,`Unqueried start ${record.id}`);
  assert.equal(row.gamePk,record.gamePk);assert.equal(row.tier,mediaTier(record,postseason));
  assert(row.lookups.some(x=>x.status===200&&x.url===`https://statsapi.mlb.com/api/v1/game/${record.gamePk}/content`),'Exact-game content lookup required');
  if(row.tier==='other') {assert.equal(row.youtubeAttempted,false);assert(row.lookups.every(x=>!x.url.includes('googleapis.com')),'No bulk YouTube fallback');}
  if(row.selected.image) assert(/^https:\/\/img\.mlbstatic\.com\/mlb-images\/image\/upload\//.test(row.selected.image.imageUrl));
  if(row.selected.highlight) assert(/^https:\/\/(mlb-cuts-diamond\.mlb\.com|bdata-producedclips\.mlb\.com|www\.youtube-nocookie\.com)\//.test(row.selected.highlight.embedUrl));
 }
 return true;
}
