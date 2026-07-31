import { HomeWarmingUpLoader } from "@/components/home-warming-up-loader";
import { SiteHeader } from "@/components/site-header";

export default function HomeLoading() {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Los_Angeles",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return (
    <main className="min-h-screen bg-[#08080a] text-zinc-100">
      <section className="relative overflow-hidden px-4 pb-6 pt-6 sm:px-6 lg:px-8">
        <div className="absolute inset-0 bg-[#08080a]" />
        <div
          className="absolute inset-x-0 top-0 h-[520px] bg-no-repeat opacity-[0.58] saturate-[0.92] sm:h-[440px] sm:opacity-[0.44] lg:hidden"
          style={{
            backgroundImage: "url('/images/header-baseball-bg.jpg')",
            backgroundPosition: "right -54px top 82px",
            backgroundSize: "clamp(360px, 108vw, 520px) auto",
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 top-0 hidden h-[380px] bg-no-repeat opacity-100 saturate-[0.92] lg:block"
          style={{
            backgroundImage: "url('/images/header-baseball-bg.jpg')",
            backgroundPosition: "76% 74%",
            backgroundSize: "min(720px, 115vw) auto",
          }}
          aria-hidden="true"
        />
        <div className="absolute inset-0 bg-[linear-gradient(90deg,rgba(8,8,10,0.98)_0%,rgba(8,8,10,0.82)_42%,rgba(8,8,10,0.42)_74%,rgba(8,8,10,0.58)_100%),linear-gradient(180deg,rgba(8,8,10,0.78)_0%,rgba(8,8,10,0.26)_44%,#08080a_100%)]" aria-hidden="true" />
        <div className="relative z-10 mx-auto max-w-7xl">
          <SiteHeader
            active="home"
            today={today}
            rankedDate={today}
            liveSnapshot={{ liveStarts: 0, warmingStarts: 0 }}
            showNoHitterAlerts={false}
          />
          <div className="grid gap-5 py-4 lg:pb-0 lg:pt-5">
            <div className="min-w-0 lg:max-w-none">
              <HomeWarmingUpLoader slateState="post" />
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
