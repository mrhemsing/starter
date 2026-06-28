import { RouteLoadingShell } from "@/components/route-loading-shell";

export default function RankedStartsLoading() {
  return (
    <RouteLoadingShell activeLabel="Ranked Starts" label="Loading ranked starts" responsiveCheck="ranked-starts-loading">
      <header className="mb-6 pb-6">
        <div className="mt-4 h-12 max-w-lg rounded bg-white/10" />
        <div className="mt-3 h-5 max-w-sm rounded bg-white/10" />
        <div className="mt-5 flex flex-wrap gap-2">
          <div className="h-11 w-28 rounded border border-white/10 bg-white/[0.04]" />
          <div className="h-11 w-24 rounded border border-white/10 bg-white/[0.04]" />
          <div className="h-11 w-32 rounded border border-white/10 bg-white/[0.04]" />
        </div>
      </header>
      <section className="space-y-3" aria-label="Loading ranked starts">
        {Array.from({ length: 8 }, (_, index) => (
          <div key={index} className="grid min-h-[76px] grid-cols-[48px_minmax(0,1fr)_64px] items-center gap-3 border-b border-white/10 py-3">
            <div className="h-10 w-10 rounded bg-white/10" />
            <div className="min-w-0 space-y-2">
              <div className="h-5 w-2/3 rounded bg-white/10" />
              <div className="h-4 w-1/2 rounded bg-white/[0.07]" />
            </div>
            <div className="h-10 rounded bg-amber-300/20" />
          </div>
        ))}
      </section>
    </RouteLoadingShell>
  );
}
