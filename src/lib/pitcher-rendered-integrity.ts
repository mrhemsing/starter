import type { CanonicalStartRecord } from "@/lib/canonical-start-record";
import { outsFromIP } from "@/lib/innings";

export function parseRenderedPitcher(html: string) {
  const rows = [...html.matchAll(/<details\b[^>]*data-responsive-check="pitcher-game-log-row"[^>]*>([\s\S]*?)<\/details>/g)];
  const dates = rows.map(row=>row[1].match(/>(\d{4}-\d{2}-\d{2})<\//)?.[1]).filter((date): date is string=>Boolean(date));
  const stats = html.match(/<p\b[^>]*data-pitcher-season-stats[^>]*>([\s\S]*?)<\/p>/)?.[1].replace(/<[^>]*>/g, "") ?? "";
  const ip = stats.match(/\b(\d+(?:\.\d)?)\s+IP as starter/)?.[1] ?? stats.match(/\bIP\s+(\d+(?:\.\d)?)/)?.[1];
  return { count: rows.length, datedRows: dates.length, last: dates.sort().at(-1) ?? null, outs: ip === undefined ? null : outsFromIP(ip) };
}

export function compareRenderedPitcher(html: string, records: CanonicalStartRecord[]) {
  const rendered = parseRenderedPitcher(html);
  const expected = { count: records.length, last: records.map(row=>row.date).sort().at(-1) ?? null, outs: records.reduce((sum,row)=>sum+outsFromIP(row.line.inningsPitched),0) };
  const mismatches = (['count','last','outs'] as const).filter(key=>rendered[key]!==expected[key]);
  if(rendered.datedRows!==rendered.count)mismatches.push('last');
  return {ok:mismatches.length===0,rendered,expected,mismatches};
}

export async function checkRenderedPitchers(
  samples: Array<{pitcherId:string; records:CanonicalStartRecord[]}>,
  readPage: (pitcherId:string)=>Promise<string>,
  alert: (message:string,details:unknown)=>void = console.error,
) {
  const results = await Promise.all(samples.map(async sample=>{
    try{return {pitcherId:sample.pitcherId,...compareRenderedPitcher(await readPage(sample.pitcherId),sample.records)};}
    catch(error){return {pitcherId:sample.pitcherId,ok:false,error:String(error)};}
  }));
  const failures=results.filter(result=>!result.ok);
  if(failures.length)alert('[settled-slate-integrity] rendered pitcher mismatch',failures);
  return {ok:failures.length===0,results};
}

export function compareCanonicalOfficial(records: CanonicalStartRecord[], official: {starts:Array<{gamePk:number}>}) {
  const actual = new Set(records.map(row=>row.gamePk));
  const expected = new Set(official.starts.map(row=>row.gamePk));
  const missing = [...expected].filter(id=>!actual.has(id));
  const extra = [...actual].filter(id=>!expected.has(id!));
  return {ok:records.length===official.starts.length&&!missing.length&&!extra.length, canonicalCount:records.length,officialCount:official.starts.length,missing,extra};
}
