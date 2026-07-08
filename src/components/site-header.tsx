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
}: {
  active: NavKey | null;
  today: string;
  rankedDate?: string;
  className?: string;
  responsiveCheck?: string;
}) {
  const currentSeason = currentSeasonFromDate(today);

  return (
    <>
      <header className={`site-header-nav flex flex-wrap items-center justify-between gap-4 pb-5 ${className}`} data-responsive-check={responsiveCheck}>
        <div className="site-logo-lockup">
          <Link href="/" className="site-logo-wordmark" aria-label="Toe the Slab home">
            Toe the Slab
          </Link>
          <MlbSeasonKicker season={currentSeason} />
        </div>
        <SiteNav active={active} today={today} rankedDate={rankedDate} />
      </header>
      <NoHitterAlertBars today={today} />
    </>
  );
}
