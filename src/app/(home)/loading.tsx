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
          className="absolute inset-x-0 top-0 h-[755px] translate-x-[8%] bg-no-repeat opacity-80 saturate-[0.92] sm:hidden"
          style={{
            backgroundImage: "url('/images/header-baseball-bg-mobile.jpg')",
            backgroundPosition: "center",
            backgroundSize: "cover",
          }}
          aria-hidden="true"
        />
        <div
          className="absolute inset-x-0 top-0 hidden h-[647px] bg-no-repeat opacity-80 saturate-[0.92] sm:block lg:h-[590px]"
          style={{
            backgroundImage: "url('/images/header-baseball-bg-desktop.jpg')",
            backgroundPosition: "right center",
            backgroundSize: "contain",
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
