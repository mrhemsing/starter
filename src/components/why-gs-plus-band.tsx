// Recovered from 20af591 (P2-44 shipped panels); extracted without structural changes.
import type { HomeGsPlusProofs, HomeGsPlusProofStart } from "@/lib/data/home-gs-plus-proof-service";
import { startMatchupLabel } from "@/lib/start-matchup-label";

const GS_PLUS_DIFFERENTIATORS = [
  {
    title: "Context, not just the line.",
    body: "Seven scoreless against the Yankees in the Bronx is not seven against the A's in Sacramento. GS+ knows the difference.",
  },
  {
    title: "Stuff counts.",
    body: "Velocity and swing-and-miss factor in, so the electric starts you would actually want to watch grade like it.",
  },
  {
    title: "Show your work.",
    body: "Every score's full breakdown is public, and settled scores never change.",
  },
] as const;

export function WhyGsPlusBand({ proof, season }: { proof: HomeGsPlusProofs; season?: number }) {
  const [contextWinner, contextRunnerUp] = proof.contextPair;
  return (
    <section className="border-y border-white/10 bg-[#0c0c10] px-4 py-10 sm:px-6 lg:px-8" data-responsive-check="home-gs-plus-differentiator-band" aria-labelledby="home-gs-plus-differentiator-kicker">
      <div className="mx-auto max-w-7xl">
        <div className="mb-5 flex flex-col justify-between gap-3 border-b border-white/10 pb-5 md:flex-row md:items-end">
          <div>
            <p id="home-gs-plus-differentiator-kicker" className="font-mono text-xs uppercase tracking-[0.24em] text-zinc-500">
              WHY GS+
            </p>
            <h2 className="section-title mt-2 font-serif text-4xl font-bold text-zinc-50">Why GS+ is different</h2>
          </div>
          <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500" data-home-gs-plus-proof-source={proof.source}>
            {season ? `${season} examples, frozen at season end` : proof.source === "cron" ? "Real comparison, updated daily" : "Real comparison, frozen examples"}
          </p>
        </div>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,0.95fr)_minmax(0,0.9fr)]" data-home-gs-plus-differentiator-cards data-home-gs-plus-proof-panels>
          <article className="rounded border border-amber-300/25 bg-[#101014] p-4 shadow-[0_18px_44px_rgba(0,0,0,0.18)]" data-home-gs-plus-differentiator-card="1" data-home-gs-plus-proof-card="context">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-amber-300">01 / Context proof</p>
                <h3 className="mt-2 font-serif text-xl font-bold leading-tight text-zinc-50" data-home-gs-plus-differentiator-title>{GS_PLUS_DIFFERENTIATORS[0].title}</h3>
              </div>
              <span className="rounded border border-amber-300/25 px-2 py-1 font-mono text-[10px] text-amber-200">2 starts</span>
            </div>
            <p className="mt-2 text-sm leading-6 text-zinc-400" data-home-gs-plus-differentiator-body={GS_PLUS_DIFFERENTIATORS[0].body}>{GS_PLUS_DIFFERENTIATORS[0].body}</p>
            <div className="mt-4 grid gap-2 sm:grid-cols-2" data-home-gs-plus-context-pair>
              <ContextProofStart start={contextWinner} emphasis />
              <ContextProofStart start={contextRunnerUp} />
            </div>
            <p className="mt-3 text-xs leading-5 text-zinc-500">Similar lines, different park and opponent context. The GS+ gap is {Math.abs(contextWinner.gsPlus - contextRunnerUp.gsPlus)} points.</p>
          </article>

          <article className="rounded border border-white/10 bg-[#141418] p-4" data-home-gs-plus-differentiator-card="2" data-home-gs-plus-proof-card="stuff">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#8FCBFF]">02 / Stuff proof</p>
            <h3 className="mt-2 font-serif text-xl font-bold leading-tight text-zinc-50" data-home-gs-plus-differentiator-title>{GS_PLUS_DIFFERENTIATORS[1].title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400" data-home-gs-plus-differentiator-body={GS_PLUS_DIFFERENTIATORS[1].body}>{GS_PLUS_DIFFERENTIATORS[1].body}</p>
            <div className="mt-4 rounded border border-white/10 bg-black/20 p-3" data-home-gs-plus-stuff-proof={proof.stuff.start.id}>
              <a href={proof.stuff.start.href} className="font-semibold text-zinc-50 hover:text-amber-200">{proof.stuff.start.pitcherName}</a>
              <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">{proof.stuff.start.line} · {proof.stuff.start.gsPlus} GS+</p>
              <div className="mt-3 grid grid-cols-2 gap-2">
                <ProofMetric label="Whiff credit" value={proof.stuff.whiffValue} detail={proof.stuff.whiffDescription} />
                <ProofMetric label="Velo credit" value={proof.stuff.velocityValue} detail={proof.stuff.velocityDescription} />
              </div>
              <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#8FCBFF]">{season ? "Stuff credit" : "Stuff added"} {formatSignedProofValue(proof.stuff.totalStuffValue)} {season ? "before scale adjustment" : "GS+ pts"}</p>
            </div>
          </article>

          <article className="rounded border border-white/10 bg-[#101014] p-4" data-home-gs-plus-differentiator-card="3" data-home-gs-plus-proof-card="breakdown">
            <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-zinc-500">03 / Verification</p>
            <h3 className="mt-2 font-serif text-xl font-bold leading-tight text-zinc-50" data-home-gs-plus-differentiator-title>{GS_PLUS_DIFFERENTIATORS[2].title}</h3>
            <p className="mt-2 text-sm leading-6 text-zinc-400" data-home-gs-plus-differentiator-body={GS_PLUS_DIFFERENTIATORS[2].body}>
              Every score&apos;s <a href="/methodology" className="text-amber-300 underline-offset-4 hover:underline" data-home-gs-plus-methodology-link>full breakdown is public</a>, and settled scores never change.
            </p>
            <div className="mt-4 rounded border border-white/10 bg-black/20 p-3" data-home-gs-plus-freeze-proof={proof.breakdown.id}>
              <div className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-1 rounded border border-white/15 px-2 py-1 font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-300" data-home-gs-plus-lock>
                  <svg aria-hidden="true" viewBox="0 0 16 16" className="h-3 w-3 fill-none stroke-current stroke-[1.8]">
                    <rect x="3.5" y="7" width="9" height="6" rx="1.25" />
                    <path d="M5.5 7V5.5a2.5 2.5 0 0 1 5 0V7" />
                  </svg>
                  Locked
                </span>
                <span className="font-mono text-[10px] uppercase tracking-[0.14em] text-zinc-500">Frozen at settle</span>
              </div>
              <p className="mt-3 text-sm leading-6 text-zinc-300">{proof.breakdown.pitcherName}: {proof.breakdown.line}, {proof.breakdown.gsPlus} GS+.</p>
              <a href={proof.breakdown.href} className="mt-3 inline-flex min-h-9 items-center rounded border border-amber-300/30 px-3 font-mono text-[10px] uppercase tracking-[0.14em] text-amber-300 hover:border-amber-300/60" data-home-gs-plus-breakdown-link>
                Open full breakdown
              </a>
            </div>
          </article>
        </div>
        {season ? <a href="/methodology" className="mt-5 inline-block font-mono text-xs uppercase tracking-[0.12em] text-amber-300 underline underline-offset-4">Methodology</a> : null}
      </div>
    </section>
  );
}

function ContextProofStart({ start, emphasis = false }: { start: HomeGsPlusProofStart; emphasis?: boolean }) {
  return (
    <a href={start.href} className={`block rounded border p-3 transition hover:border-amber-300/50 ${emphasis ? "border-amber-300/35 bg-amber-300/[0.08]" : "border-white/10 bg-black/20"}`} data-home-gs-plus-context-start={start.id}>
      <p className="truncate font-semibold text-zinc-50">{start.pitcherName}</p>
      <p className="mt-1 font-mono text-[10px] uppercase tracking-[0.12em] text-zinc-500">{startMatchupLabel({ pitcher: { team: start.team }, opponent: start.opponent, side: start.side })}</p>
      <p className="mt-2 text-sm text-zinc-300">{start.line}</p>
      <div className="mt-3 flex items-end justify-between gap-3">
        <div>
          <p className="font-mono text-[9px] uppercase tracking-[0.14em] text-zinc-500">Context</p>
          <p className="font-mono text-xs text-zinc-300">Park {formatSignedProofValue(start.parkValue)} · Opp {formatSignedProofValue(start.opponentValue)}</p>
        </div>
        <p className="font-serif text-4xl font-black leading-none text-amber-300">{start.gsPlus}</p>
      </div>
    </a>
  );
}

function ProofMetric({ label, value, detail }: { label: string; value: number; detail: string }) {
  return (
    <div className="rounded border border-white/10 px-2 py-2">
      <p className="font-mono text-[9px] uppercase tracking-[0.12em] text-zinc-500">{label}</p>
      <p className="mt-1 font-serif text-2xl font-black text-zinc-50">{formatSignedProofValue(value)}</p>
      <p className="mt-1 text-[11px] leading-4 text-zinc-500">{detail}</p>
    </div>
  );
}

function formatSignedProofValue(value: number) {
  if (!Number.isFinite(value)) return "0.0";
  return `${value >= 0 ? "+" : ""}${value.toFixed(1)}`;
}

