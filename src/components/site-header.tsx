import Link from "next/link";
import { MlbSeasonKicker } from "@/components/mlb-season-kicker";
import { NoHitterAlertBars } from "@/components/no-hitter-alert-bars";
import { SiteNav, type NavKey } from "@/components/site-nav";
import { currentSeasonFromDate } from "@/lib/season";

export async function SiteHeader({
  active,
  today,
  rankedDate,
  className = "",
  responsiveCheck,
  liveSnapshot,
  showNoHitterAlerts = true,
}: {
  active: NavKey | null;
  today: string;
  rankedDate?: string;
  className?: string;
  responsiveCheck?: string;
  liveSnapshot?: { liveStarts: number; warmingStarts: number };
  showNoHitterAlerts?: boolean;
}) {
  const currentSeason = currentSeasonFromDate(today);

  return (
    <>
      <header className={`site-header-nav flex flex-wrap items-center justify-between gap-4 pb-5 ${className}`} data-responsive-check={responsiveCheck}>
        <Link href="/" className="site-logo-lockup" aria-label="Toe the Slab home">
          <span className="site-logo-wordmark">Toe the Slab</span>
          <MlbSeasonKicker season={currentSeason} />
        </Link>
        <SiteNav active={active} today={today} rankedDate={rankedDate} liveSnapshot={liveSnapshot} />
      </header>
      {showNoHitterAlerts ? <NoHitterAlertBars today={today} /> : null}
    </>
  );
}
