import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormCalibration, parseFormWindow } from "@/lib/data/form-service";
import { HEAT_BANDS } from "@/lib/form-tokens";

type FormDebugPageProps = {
  searchParams?: Promise<{
    window?: string;
  }>;
};

export const dynamic = "force-dynamic";

export default async function FormDebugPage({ searchParams }: FormDebugPageProps) {
  if (!isFormDebugEnabled()) notFound();

  const params = await searchParams;
  const window = parseFormWindow(params?.window);
  const calibration = await getFormCalibration({ window });

  return (
    <main className="min-h-screen bg-[#08080a] px-4 pb-8 pt-6 text-zinc-100 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <header className="border-b border-white/10 pb-6">
          <Link href="/heat-check" className="font-mono text-xs uppercase tracking-[0.2em] text-amber-300">Heat Check</Link>
          <h1 className="mt-4 font-serif text-5xl font-black text-zinc-50">Form calibration</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-zinc-400">
            Internal readout for tuning rolling form, trend, and Heat Index thresholds against the live archive.
          </p>
        </header>

        <section className="my-5 grid gap-3 font-mono text-xs sm:grid-cols-3 lg:grid-cols-6">
          <Metric label="Total pitchers" value={String(calibration.counts.totalPitchers)} />
          <Metric label="Qualified" value={String(calibration.counts.qualified)} />
          <Metric label="Insufficient" value={String(calibration.counts.insufficient)} />
          <Metric label="Limited sample" value={String(calibration.counts.limitedSample)} />
          <Metric label="Rising" value={String(calibration.counts.heating)} />
          <Metric label="Falling" value={String(calibration.counts.cooling)} />
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="rounded border border-white/10 bg-[#101014] p-5">
            <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Heat bands</p>
            <div className="mt-4 space-y-3">
              {HEAT_BANDS.map((band) => (
                <div key={band.key} className="grid grid-cols-[112px_1fr_74px] items-center gap-3 font-mono text-xs">
                  <span style={{ color: band.color }}>{band.label} &gt;= {band.min}</span>
                  <div className="h-2 overflow-hidden rounded bg-black/40">
                    <div className="h-full" style={{ width: `${bandPercent(calibration.counts.bands[band.key], calibration.counts.qualified)}%`, backgroundColor: band.color }} />
                  </div>
                  <span className="text-right text-zinc-300">{calibration.counts.bands[band.key]} / {calibration.bandShare[band.key]}%</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-5 md:grid-cols-3">
            <Distribution title="Rolling form" values={calibration.rgs} />
            <Distribution title="Trend delta" values={calibration.trendDelta} />
            <Distribution title="Heat Index" values={calibration.heatIndex} />
          </div>
        </section>

        <section className="mt-5 rounded border border-white/10 bg-[#101014] p-5">
          <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">Config snapshot</p>
          <pre className="mt-4 overflow-x-auto rounded bg-black/30 p-4 text-xs text-zinc-300">{JSON.stringify(calibration.config, null, 2)}</pre>
        </section>
      </div>
    </main>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded border border-white/10 bg-[#101014] p-3">
      <p className="text-zinc-50">{value}</p>
      <p className="mt-1 text-[10px] uppercase tracking-[0.16em] text-zinc-500">{label}</p>
    </div>
  );
}

function Distribution({ title, values }: { title: string; values: Record<string, number> }) {
  return (
    <div className="rounded border border-white/10 bg-[#101014] p-5">
      <p className="font-mono text-xs uppercase tracking-[0.2em] text-zinc-500">{title}</p>
      <dl className="mt-4 grid grid-cols-2 gap-2 font-mono text-xs">
        {Object.entries(values).map(([key, value]) => (
          <div key={key} className="flex justify-between gap-4 rounded border border-white/10 bg-black/20 px-2 py-1">
            <dt className="uppercase text-zinc-500">{key}</dt>
            <dd className="text-zinc-200">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function bandPercent(count: number, total: number) {
  return total > 0 ? Math.round((count / total) * 1000) / 10 : 0;
}

function isFormDebugEnabled() {
  return process.env.NODE_ENV !== "production" || process.env.THE_BUMP_FORM_DEBUG === "1";
}
