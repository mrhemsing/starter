import { RouteLoadingShell } from "@/components/route-loading-shell";

export default function AppLoading() {
  return (
    <RouteLoadingShell label="Loading page" responsiveCheck="app-route-loading">
      <section className="grid gap-5 py-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="min-h-72 animate-pulse rounded border border-white/10 bg-[#101014]" />
        <div className="space-y-3">
          <div className="h-24 animate-pulse rounded border border-white/10 bg-[#101014]" />
          <div className="h-24 animate-pulse rounded border border-white/10 bg-[#101014]" />
          <div className="h-24 animate-pulse rounded border border-white/10 bg-[#101014]" />
        </div>
      </section>
    </RouteLoadingShell>
  );
}
