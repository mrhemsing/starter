import { NextResponse } from "next/server";
import { getSeasonState } from "@/lib/season-state";
import { readCanonicalPitcherSeasonRecords } from "@/lib/data/canonical-start-store";
import { checkRenderedPitchers, compareCanonicalOfficial } from "@/lib/pitcher-rendered-integrity";
import { fetchMlbPitcherSeasonStartLedger } from "@/lib/data/mlb-stats-client";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(request: Request) {
  if (!process.env.CRON_SECRET || request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({error:'Unauthorized'},{status:401});
  // Deliberately runs in season_complete: frozen pages must remain complete all winter.
  const state=await getSeasonState();
  // Soroka regression, heavy/postseason Misiorowski, LTD Ohtani.
  const ids=['647336','694819','660271'];
  const origin=new URL(request.url).origin;
  try {
    const samples=await Promise.all(ids.map(async pitcherId=>({pitcherId,records:await readCanonicalPitcherSeasonRecords(pitcherId,String(state.year))})));
    if(samples.some(sample=>!sample.records.length))throw new Error('Missing canonical integrity sample');
    const result=await checkRenderedPitchers(samples,async id=>{
      const response=await fetch(`${origin}/pitchers/${id}`,{cache:'no-store',signal:AbortSignal.timeout(45000)});
      if(!response.ok)throw new Error(`Pitcher page ${id} HTTP ${response.status}`);
      return response.text();
    });
    const official = await Promise.all(samples.map(async sample=>({pitcherId:sample.pitcherId,...compareCanonicalOfficial(sample.records,await fetchMlbPitcherSeasonStartLedger(Number(sample.pitcherId),String(state.year),{fetchLive:true}))})));
    const failedOfficial = official.filter(row=>!row.ok);
    if(failedOfficial.length)console.error('[settled-slate-integrity] canonical versus official mismatch',failedOfficial);
    const ok=result.ok&&!failedOfficial.length;
    return NextResponse.json({...result,ok,official,seasonState:state.status},{status:ok?200:500});
  } catch(error) {
    console.error('[settled-slate-integrity] rendered pitcher probe failed',error);
    return NextResponse.json({ok:false,error:String(error),seasonState:state.status},{status:500});
  }
}
